const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(path,modules,globals={}){
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,console,...globals,require:name=>{if(!(name in modules))throw new Error('Unexpected dependency: '+name);return modules[name];}});return exports;
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
function refreshScreen(loader){
  let cursor=0,timerId=0;const slots=[],effects=[],effectDefinitions=[],cleanups=[],writes=[],timeouts=new Map(),intervals=new Map(),listeners=new Map(),channels=[];
  const hooks={
    useState(initial){const key=cursor++;if(!(key in slots))slots[key]=initial;return[slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value;writes.push(key);}];},
    useRef(initial){const key=cursor++;if(!(key in slots))slots[key]={current:initial};return slots[key];},
    useCallback(fn,deps){const key=cursor++;if(!(key in slots)||deps.some((v,i)=>v!==slots[key].deps[i]))slots[key]={deps,fn};return slots[key].fn;},
    useEffect(effect,deps){const key=cursor++;if(!(key in slots)||deps.some((v,i)=>v!==slots[key][i])){slots[key]=deps;effectDefinitions[key]=effect;effects.push(()=>{cleanups[key]?.();cleanups[key]=effect();});}},
  };
  const document={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const supabase={channel(name){const channel={name,callbacks:{},on(_event,filter,callback){channel.callbacks[filter.table]=callback;return channel;},subscribe(callback){channel.status=callback;return channel;}};channels.push(channel);return channel;},removeChannel(channel){channel.removed=true;}};
  const {useRefreshingData}=load('src/lib/use-refreshing-data.ts',{react:hooks,'@/lib/supabase':{supabase}},{window,document,
    setTimeout:(fn,ms)=>{const id=++timerId;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id),
    setInterval:(fn,ms)=>{const id=++timerId;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id)});
  function render(){cursor=0;const result=useRefreshingData(loader,'test-progress');while(effects.length)effects.shift()();return result;}
  render();return{render,writes,channels,intervals,listeners,timeouts,
    event:name=>listeners.get(name)?.(),visible:value=>{document.visibilityState=value;},
    change:table=>channels.at(-1).callbacks[table](),
    settleEvents:()=>{for(const[id,timer]of [...timeouts]){timeouts.delete(id);timer.fn();}},
    tick:()=>{for(const timer of intervals.values())timer.fn();},
    replay:()=>{cleanups.forEach(fn=>fn?.());effectDefinitions.forEach((effect,key)=>{cleanups[key]=effect();});},
    unmount:()=>cleanups.forEach(fn=>fn?.())};
}
test('item/list/share events coalesce and refresh via the loader, ignoring payload contents',async()=>{
  let calls=0;const page=refreshScreen(async()=>({purchased:calls++}));await flush();assert.equal(page.render().data.purchased,0);
  page.change('items');page.change('lists');page.change('list_shares');assert.equal(page.timeouts.size,1);page.settleEvents();await flush();
  assert.equal(calls,2);assert.equal(page.render().data.purchased,1);page.unmount();
});
test('focus, reconnection, tab return, subscription readiness and visible polling recover missed updates',async()=>{
  let calls=0;const page=refreshScreen(async()=>++calls);await flush();
  for(const event of ['focus','online','visibilitychange']){const before=calls;page.event(event);await flush();assert.equal(calls,before+1);}
  page.channels[0].status('SUBSCRIBED');page.settleEvents();await flush();assert.equal(calls,5);
  assert.equal([...page.intervals.values()][0].ms,30000);page.tick();await flush();assert.equal(calls,6);
  page.visible('hidden');page.tick();page.event('focus');page.change('items');page.settleEvents();await flush();assert.equal(calls,6);
  page.visible('visible');page.event('visibilitychange');await flush();assert.equal(calls,7);page.unmount();
});
test('failed refresh retains previous data, shows a warning, and clears it after a successful retry',async()=>{
  let failed=false;const page=refreshScreen(async()=>{if(failed)throw new Error('offline');return{total:7,purchased:3};});await flush();
  failed=true;page.event('online');await flush();assert.equal(page.render().data.total,7);assert.equal(page.render().data.purchased,3);assert.match(page.render().error,/out of date/);
  failed=false;page.render().retry();await flush();assert.equal(page.render().error,null);page.unmount();
});
test('initial failure never substitutes empty counts and supports retry',async()=>{
  let failed=true;const page=refreshScreen(async()=>{if(failed)throw new Error('offline');return[];});await flush();
  assert.equal(page.render().data,null);assert.equal(page.render().loading,false);assert.ok(page.render().error);
  failed=false;page.render().retry();await flush();assert.equal(page.render().data.length,0);assert.equal(page.render().error,null);page.unmount();
});
test('older refreshes cannot overwrite a newer read or a confirmed local action',async()=>{
  for(const local of [false,true]){
    const pending=deferred();let calls=0;const page=refreshScreen(()=>++calls===1?pending.promise:Promise.resolve({total:8}));
    if(local)page.render().updateData(()=>({total:9}));else{page.event('focus');await flush();}
    pending.resolve({total:1});await flush();assert.equal(page.render().data.total,local?9:8);page.unmount();
  }
});
test('unmount cleans subscriptions, timers and listeners even during initial load',async()=>{
  for(const failed of [false,true]){
    const pending=deferred();const page=refreshScreen(()=>pending.promise);page.change('items');page.unmount();const count=page.writes.length;
    assert.equal(page.channels.length,1);assert.equal(page.channels[0].removed,true);assert.equal(page.intervals.size,0);assert.equal(page.timeouts.size,0);assert.equal(page.listeners.size,0);
    if(failed)pending.reject(new Error('offline'));else pending.resolve([]);await flush();assert.equal(page.writes.length,count);
  }
});

function progressApi({total=1501,purchased=1001,fail=false,family=false}={}){
  const reads=[];
  const supabase={from(table){const filters=[];const query={select(columns,options){reads.push({table,columns,options,filters});return query;},eq(key,value){filters.push([key,value]);return query;},
    order:async()=>({data:family?[{id:'list',title:'Shared',owner_user_id:'other'},{id:'list',title:'Duplicate',owner_user_id:'other'},{id:'mine',owner_user_id:'me'}]:[{id:'list',title:'Mine'}],error:null}),
    then(resolve,reject){const selected=filters.some(([key])=>key==='purchased');return Promise.resolve({count:selected?purchased:total,error:fail?new Error('offline'):null}).then(resolve,reject);}};return query;}};
  return{...load('src/lib/list-progress.ts',{'@/lib/supabase':{supabase},'@/lib/auth-helpers':{getProfileUser:async()=>({id:'me'})}}),reads};
}
test('progress uses exact counts beyond the row cap and fetches no buyer data',async()=>{
  const helper=progressApi();const counts=await helper.getListProgress('list');assert.equal(counts.total,1501);assert.equal(counts.purchased,1001);
  assert.equal(helper.reads.length,2);for(const read of helper.reads){assert.equal(read.columns,'id');assert.equal(read.options.head,true);assert.equal(read.options.count,'exact');assert.equal(read.filters[0][1],'list');}
});
test('count failures or missing/inconsistent counts never masquerade as zero',async()=>{
  for(const options of [{total:null},{purchased:null},{purchased:2000},{total:-1},{purchased:NaN},{fail:true}])await assert.rejects(progressApi(options).getListProgress('list'));
  assert.equal((await progressApi({total:0,purchased:0}).getListProgress('list')).total,0);
});
test('my/family lists share the same counting rules; family lists deduplicate and exclude the owner',async()=>{
  for(const family of [false,true]){
    const helper=progressApi({family});const lists=await helper.getListsWithProgress(family);
    assert.equal(lists.length,1);assert.equal(lists[0].purchased,1001);
    const read=helper.reads.find(read=>read.table!=='items');assert.equal(read.table,family?'v_user_accessible_lists':'lists');
    assert.equal(read.filters[0][0],family?'shared_user_id':'owner_user_id');assert.equal(read.filters[0][1],'me');
  }
});
test('all three screens retain successful content beside a retry notice after refresh failure',()=>{
  const jsx=(type,props)=>({type,props:props??{}});
  const modules={'react/jsx-runtime':{jsx,jsxs:jsx},react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect(){}},
    '@/lib/use-refreshing-data':{useRefreshingData:()=>({data:[{id:'list',title:'Still here',created_at:'2026-11-14',list_title:'List',list_owner_name:'Name',price_cents:null}],error:'Refresh failed',loading:false,retry(){},updateData(){}})},
    '@/lib/list-progress':{getListsWithProgress(){}},'@/lib/purchases-api':{getMyPurchases(){}},'@/lib/lists-api':{},sonner:{toast:{}},
    '@/components/ui/refresh-notice':{RefreshNotice:'RefreshNotice'},'@/components/lists/list-card':{default:'ListCard'},'motion/react':{motion:new Proxy({},{get:(_,key)=>'motion.'+key})},
    '@/lib/format':{safeWebUrl:value=>value,usd:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})}};
  for(const name of ['next/link','@/components/ui/create-list-button','@/components/ui/manage-list-modal','@/components/ui/glare-card','@/components/ui/festive-glow','@/components/ui/snowfall','@/components/ui/stars-background','@/components/ui/countdown-banner','@/components/ui/skeleton-card','@/components/ui/page-fade','@/components/ui/hero-highlight','@/components/ui/colourful-text','@/components/ui/text-animate'])modules[name]=new Proxy({default:'component'},{get:(obj,key)=>obj[key]??'component'});
  function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);return node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
  for(const path of ['user-lists','family-lists','purchased-items']){
    const component=load('src/app/(authed)/'+path+'/page.tsx',modules).default;
    const all=nodes(component());assert.ok(all.some(node=>node.type==='RefreshNotice'));
    assert.ok(path==='purchased-items'?all.some(node=>node.type==='h2'&&node.props.children==='Still here'):all.some(node=>node.type==='ListCard'&&node.props.list.title==='Still here'));
  }
});

test('development effect replay uses a fresh subscription and ignores the old initial request',async()=>{
  const old=deferred();let calls=0;
  const page=refreshScreen(()=>++calls===1?old.promise:Promise.resolve({total:9}));
  page.replay();await flush();assert.equal(page.channels.length,2);assert.notEqual(page.channels[0].name,page.channels[1].name);
  assert.equal(page.channels[0].removed,true);assert.equal(page.channels[1].removed,undefined);
  old.resolve({total:1});await flush();assert.equal(page.render().data.total,9);assert.equal(page.intervals.size,1);page.unmount();
});
