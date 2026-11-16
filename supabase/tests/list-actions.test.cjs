const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, modules) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'), {
    compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX },
  }).outputText,{ exports,URL,require:name => { if (!(name in modules)) throw new Error('Unexpected dependency: '+name); return modules[name]; } });
  return exports;
}
const deferred=() => { let resolve,reject;const promise=new Promise((a,b) => { resolve=a;reject=b; });return { promise,resolve,reject }; };
const flush=async () => { for(let i=0;i<6;i++) await new Promise(setImmediate); };
function api(response={data:{id:'list',title:'Saved name',list_id:'list',group_id:'group'},error:null}) {
  const writes=[],filters=[],columns=[];
  const query={
    update:payload => {writes.push({op:'update',payload});return query;},
    delete:() => {writes.push({op:'delete'});return query;},
    insert:payload => {writes.push({op:'insert',payload});return query;},
    eq:(key,value) => {filters.push([key,value]);return query;},
    select:value => {columns.push(value);return query;},
    single:async () => {if(response instanceof Error)throw response;return response;},
  };
  return {...load('src/lib/lists-api.ts',{'@/lib/supabase':{supabase:{from:() => query}}}),writes,filters,columns};
}
test('rename trims input, returns the saved name, and rejects blanks before writing',async () => {
  const helper=api();assert.equal(await helper.renameList('list','  New name  '),'Saved name');
  assert.equal(helper.writes[0].payload.title,'New name');assert.deepEqual(helper.filters,[['id','list']]);
  await assert.rejects(helper.renameList('list','  '),/Enter a list name/);assert.equal(helper.writes.length,1);
});
test('rename, delete and sharing reject denied/no-op/malformed results and lost responses',async () => {
  for(const action of [helper => helper.renameList('list','Name'),helper => helper.deleteList('list'),helper => helper.setListShared('list','group',true),helper => helper.setListShared('list','group',false)]) {
    for(const response of [{data:null,error:null},{data:[],error:null},{data:{id:'other',list_id:'other',group_id:'other'},error:null},
      {data:null,error:{code:'PGRST116',message:'No rows'}},{data:null,error:new Error('denied')},new Error('offline')]) {
      await assert.rejects(action(api(response)));
    }
  }
});
test('sharing confirms the exact list/group pair and deletion returns only an ID',async () => {
  const helper=api();await helper.setListShared('list','group',false);
  assert.deepEqual(helper.filters,[['list_id','list'],['group_id','group']]);assert.deepEqual(helper.columns,['list_id,group_id']);
  const share=api();await share.setListShared('list','group',true);assert.equal(share.writes[0].payload.list_id,'list');assert.equal(share.writes[0].payload.group_id,'group');
  const remove=api();await remove.deleteList('list');assert.deepEqual(remove.columns,['id']);
});

function screen({rename=async () => 'Saved name',remove=async () => {}}={}) {
  let index=0;const slots=[],effects=[],cleanups=[],writes=[],messages=[];
  const hooks={
    useState(initial){const key=index++;if(!(key in slots))slots[key]=initial;return [slots[key],value => {slots[key]=typeof value==='function'?value(slots[key]):value;writes.push(key);}];},
    useRef(initial){const key=index++;if(!(key in slots))slots[key]={current:initial};return slots[key];},
    useCallback:fn => fn,
    useEffect(effect){const key=index++;if(!(key in slots)){slots[key]=true;effects.push(effect);}},
  };
  const jsx=(type,props) => ({type,props:props??{}});
  const query={select(){return query;},eq(){return query;},order:async () => ({data:[{id:'list',title:'Original',created_at:'2026-11-14'}],error:null}),then(resolve,reject){return Promise.resolve({count:1,error:null}).then(resolve,reject);}};
  const channel={on(){return channel;},subscribe(){return channel;}};
  const modules={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:() => ({push(){}})},
    '@/lib/supabase':{supabase:{auth:{getUser:async () => ({data:{user:{id:'owner'}},error:null})},from:() => query,channel:() => channel,removeChannel(){}}},
    '@/lib/list-progress':{getListsWithProgress:async () => []},
    '@/components/ui/refresh-notice':{RefreshNotice:'RefreshNotice'},
    '@/lib/use-refreshing-data':{useRefreshingData:() => {const [data,updateData]=hooks.useState([{id:'list',title:'Original',created_at:'2026-11-14'}]);return {data,updateData,error:null,loading:false,retry(){}};}},
    '@/lib/lists-api':{renameList:rename,deleteList:remove},sonner:{toast:{success:message => messages.push(['success',message]),error:message => messages.push(['error',message])}},
    'motion/react':{motion:new Proxy({},{get:(_,key) => 'motion.'+key})},
    '@/components/lists/list-card':{default:'ListCard'},'@/components/ui/manage-list-modal':{ManageListModal:'ManageListModal'},
  };
  for(const name of ['next/link','@/components/ui/create-list-button','@/components/ui/glare-card','@/components/ui/festive-glow','@/components/ui/snowfall','@/components/ui/stars-background','@/components/ui/countdown-banner','@/components/ui/skeleton-card','@/components/ui/page-fade'])modules[name]=new Proxy({default:'component'},{get:(object,key) => object[key]??'component'});
  const component=load('src/app/(authed)/user-lists/page.tsx',modules).default;
  function render(){index=0;const tree=component();while(effects.length){const cleanup=effects.shift()();if(cleanup)cleanups.push(cleanup);}return tree;}
  function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);return node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
  const all=() => nodes(render());render();
  const modal=() => all().find(node => node.type==='ManageListModal')?.props;
  return {modal,messages,writes,card:() => all().find(node => node.type==='ListCard')?.props,
    manage:() => all().find(node => node.type==='ListCard').props.onManage('list','Original'),unmount:() => cleanups.forEach(fn => fn())};
}
test('rename preserves input/dialog on failure, blocks duplicate/conflicting clicks, then recovers with saved title',async () => {
  const pending=deferred();let calls=0,deletes=0;
  const page=screen({rename:async () => ++calls===1?pending.promise:'Saved name',remove:async () => {deletes++;}});
  await flush();page.manage();page.modal().setNewTitle('My new name');const action=page.modal().onRename;
  const request=action();await action();await page.modal().onDelete();page.modal().onClose();
  assert.equal(calls,1);assert.equal(deletes,0);assert.ok(page.modal());assert.equal(page.card().list.title,'Original');assert.deepEqual(page.messages,[]);
  pending.reject(new Error('offline'));await request;
  assert.equal(page.modal().newTitle,'My new name');assert.ok(page.modal().error);assert.equal(page.messages[0][0],'error');
  await page.modal().onRename();assert.equal(page.modal(),undefined);assert.equal(page.card().list.title,'Saved name');assert.equal(page.messages.at(-1)[0],'success');page.unmount();
});
test('delete retains its card/dialog on failure and removes them only after confirmation',async () => {
  const pending=deferred();let calls=0;
  const page=screen({remove:async () => ++calls===1?pending.promise:undefined});await flush();page.manage();const request=page.modal().onDelete();
  assert.ok(page.card());assert.deepEqual(page.messages,[]);pending.reject(new Error('No rows'));await request;
  assert.ok(page.card());assert.ok(page.modal().error);await page.modal().onDelete();assert.equal(page.card(),undefined);assert.equal(page.messages.at(-1)[0],'success');page.unmount();
});
test('leaving the screen suppresses late action results and messages',async () => {
  for(const operation of ['rename','remove'])for(const failed of [false,true]){
    const pending=deferred();const page=screen({[operation]:() => pending.promise});await flush();page.manage();
    const request=operation==='rename'?page.modal().onRename():page.modal().onDelete();page.unmount();const count=page.writes.length;
    if(failed)pending.reject(new Error('offline'));else pending.resolve('Saved name');await request;
    assert.equal(page.writes.length,count);assert.deepEqual(page.messages,[]);
  }
});
test('manage dialog blocks edits, deletion, save, close and backdrop dismissal during either action',() => {
  const jsx=(type,props) => ({type,props:props??{}});
  const component=load('src/components/ui/manage-list-modal.tsx',{react:{useRef:() => ({current:null})},'./use-dialog-focus':{useDialogFocus(){}},'react/jsx-runtime':{jsx,jsxs:jsx},'@ant-design/icons':{DeleteOutlined:'DeleteIcon'}}).ManageListModal;
  function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);return node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
  for(const action of ['saving','deleting']){
    let closed=false;const tree=component({open:true,list:{id:'list',title:'Name'},newTitle:'Name',saving:false,deleting:false,[action]:true,onClose:() => {closed=true;}});
    assert.ok(nodes(tree).filter(node => ['input','button'].includes(node.type)).every(node => node.props.disabled));
    tree.props.onClick({target:'backdrop',currentTarget:'backdrop'});assert.equal(closed,false);
  }
});

test('the root layout mounts one message display inside the theme provider',() => {
  const jsx=(type,props) => ({type,props:props??{}});
  const component=load('src/app/layout.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx},'next/font/google':{Fredoka:() => ({variable:'font'}),Geist:() => ({variable:"sans"}),Merienda:() => ({variable:"serif"}),Geist_Mono(){}},
    '@/components/brand/ledger-background':{LedgerBackground:'Background'},'@/components/brand/ledger-motion':{LedgerMotion:'Motion'},'./globals.css':{},'next-themes':{ThemeProvider:'ThemeProvider'},'@/components/ui/sonner':{Toaster:'Toaster'},
  }).default;
  const body=component({children:'APP'}).props.children.props.children;
  assert.equal(body.filter(node => node?.type==='Background').length,1);
  const provider=body.find(node => node?.type==='ThemeProvider');
  assert.equal(provider.type,'ThemeProvider');assert.equal(provider.props.children.filter(node => node?.type==='Toaster').length,1);
});
