const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-product-lookup.cjs');
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const stamp='2026-11-17T12:00:00.123456Z';
const cutoff='2026-12-26T05:00:00Z';
const gift={id:id(201),purchased:true,purchased_at:stamp};
const response=({revealed=false,name='Alex',purchased=stamp,server=revealed?cutoff:'2026-12-26T04:59:59Z'}={})=>({
 server_time:server,timezone:'America/New_York',items:[{item_id:id(201),purchased_at:purchased,reveal_at:cutoff,revealed,buyer_name:revealed?name:null}],
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
const api=load('src/lib/buyer-reveal-api.ts',{'@/lib/supabase':{supabase:{}}});

test('client sends only the list ID and abort signal; rejects invalid calls before transport',async()=>{
 const calls=[];
 const client=load('src/lib/buyer-reveal-api.ts',{'@/lib/supabase':{supabase:{rpc:(name,body)=>({abortSignal:async signal=>{calls.push({name,body,signal});return {data:response(),error:null};}})}}});
 const signal=new AbortController().signal;await client.getListBuyerReveal(id(101),signal);
 assert.equal(calls[0].name,'get_list_buyer_reveal');assert.equal(calls[0].body.p_list_id,id(101));assert.deepEqual(Object.keys(calls[0].body),['p_list_id']);assert.equal(calls[0].signal,signal);
 await assert.rejects(client.getListBuyerReveal('wrong',signal));
 const canceled=new AbortController();canceled.abort();await assert.rejects(client.getListBuyerReveal(id(101),canceled.signal));assert.equal(calls.length,1);
});
test('hidden names, duplicate gifts and malformed or premature results fail closed; extras are stripped',()=>{
 const good=response({revealed:true});
 const parsed=api.parseBuyerReveal({...good,owner_user_id:id(1),items:[{...good.items[0],buyer_user_id:id(2),email:'unused@example.com'}]});
 assert.equal('buyer_user_id'in parsed.items[0],false);assert.equal('owner_user_id'in parsed,false);
 for(const bad of [null,{}, {...good,timezone:'UTC'}, {...good,server_time:'not a date'},
  {...good,items:[good.items[0],good.items[0]]},
  {...good,items:[{...good.items[0],revealed:false,buyer_name:'Hidden name'}]},
  {...good,server_time:'2026-12-25T12:00:00Z'},
  {...good,items:[{...good.items[0],purchased_at:'2027-01-01T00:00:00Z'}]},
  {...good,items:[{...good.items[0],revealed:'true'}]},
  {...good,items:[{...good.items[0],buyer_name:''}]},
 ])assert.throws(()=>api.parseBuyerReveal(bad),/couldn’t be loaded/);
});
test('timestamp matching normalizes offsets without losing Postgres microseconds',()=>{
 assert.equal(api.purchaseTimestampKey(stamp),api.purchaseTimestampKey('2026-11-17T07:00:00.123456-05:00'));
 assert.notEqual(api.purchaseTimestampKey(stamp),api.purchaseTimestampKey('2026-11-17T12:00:00.123457Z'));
 assert.equal(api.purchaseTimestampKey('2026-11-17T12:00:00Z'),api.purchaseTimestampKey('2026-11-17T12:00:00.000000+00:00'));
 assert.equal(api.purchaseTimestampKey('invalid'),null);
});

function screen(lookup,initial={}){
 let cursor=0,nextTimer=0,visible='visible';
 const slots=[],effects=[],writes=[],timers=new Map(),listeners=new Map();
 const props={listId:id(101),userId:id(1),items:[gift],...initial};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;writes.push(i);}];},
  useRef(value){const i=cursor++;return slots[i]??=({current:value});},
  useCallback(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
 };
 const events=prefix=>({addEventListener:(event,fn)=>listeners.set(prefix+event,fn),removeEventListener:event=>listeners.delete(prefix+event)});
 const {useListBuyerReveal}=load('src/lib/use-list-buyer-reveal.ts',{
  react:hooks,'@/lib/buyer-reveal-api':{...api,getListBuyerReveal:lookup},
 },{window:events('w:'),document:{...events('d:'),get visibilityState(){return visible;}},
  // A deliberately wrong device clock must not control disclosure or deadlines.
  Date:class extends Date{static now(){return Date.UTC(2099,11,31);}},
  setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
 });
 function render(patch={}){Object.assign(props,patch);cursor=0;const result=useListBuyerReveal(props);while(effects.length)effects.shift()();return result;}
 render();
 return {props,render,timers,listeners,writes,fire(delay){const entry=[...timers].find(([,v])=>v.delay===delay);assert.ok(entry,`timer ${delay}`);timers.delete(entry[0]);entry[1].fn();},
  event(event){listeners.get((event==='visibilitychange'?'d:':'w:')+event)?.();},visible(value){visible=value;},
  unmount(){for(const slot of slots)slot?.cleanup?.();},
 };
}
test('only owners with purchased gifts request details; deadline rechecks do not trust device time',async()=>{
 for(const initial of [{userId:null},{items:[]},{items:[{...gift,purchased:false}]}]){
  let calls=0;const page=screen(async()=>{calls++;return response();},initial);await flush();assert.equal(calls,0);assert.equal(page.render().names.size,0);page.unmount();
 }
 let calls=0;const page=screen(async()=>{calls++;return response({revealed:calls>1});});await flush();
 assert.equal(page.render().names.size,0);assert.equal(page.render().nextRevealAt,cutoff);
 assert.ok([...page.timers.values()].some(v=>v.delay===1150));page.fire(1150);await flush();assert.equal(page.render().names.get(gift.id),'Alex');page.unmount();
});
test('changed claim timestamp hides the old buyer immediately and ignores late responses',async()=>{
 let call=0;const second=deferred();
 const page=screen(()=>++call===1?Promise.resolve(response({revealed:true})):second.promise);await flush();assert.equal(page.render().names.get(gift.id),'Alex');
 const nextStamp='2026-12-26T05:00:00.123457Z';const nextGift={...gift,purchased_at:nextStamp};
 assert.equal(page.render({items:[nextGift]}).names.size,0);
 second.resolve(response({revealed:true,purchased:stamp}));await flush();assert.equal(page.render().names.size,0,'mismatching old claim cannot label a new purchase');
 page.unmount();
});
test('new list/account or cancellation invalidates pending lookups without stale updates',async()=>{
 for(const patch of [{listId:id(102),items:[]},{userId:null},{items:[{...gift,purchased:false}]}]){
  const pending=deferred();let signal;let calls=0;
  const page=screen((id,next)=>{calls++;signal=next;return pending.promise;});const oldSignal=signal;
  page.render(patch);assert.equal(oldSignal.aborted,true);
  pending.resolve(response({revealed:true}));await flush();
  assert.equal(page.render().names.size,0);page.unmount();
 }
});
test('failed refresh clears names; retry restores them while the gift data stays intact',async()=>{
 let failed=false;const page=screen(async()=>{if(failed)throw Error('offline');return response({revealed:true});});await flush();assert.equal(page.render().names.size,1);
 failed=true;page.event('online');await flush();assert.equal(page.render().names.size,0);assert.equal(page.render().error,true);assert.equal(page.props.items[0],gift);
 failed=false;page.render().retry();await flush();assert.equal(page.render().names.get(gift.id),'Alex');assert.equal(page.render().error,false);page.unmount();
});
test('timeout clears stale details even when transport ignores abort; retry and unmount are safe',async()=>{
 let call=0;const pending=deferred();let signal;
 const page=screen((id,next)=>{signal=next;return ++call===1?Promise.resolve(response({revealed:true})):pending.promise;});await flush();
 page.render().retry();page.fire(12000);assert.equal(signal.aborted,true);assert.equal(page.render().names.size,0);assert.equal(page.render().error,true);
 pending.resolve(response({revealed:true,name:'Late'}));await flush();assert.equal(page.render().names.size,0);
 page.unmount();assert.equal(page.timers.size,0);assert.equal(page.listeners.size,0);
 const late=deferred();const gone=screen(()=>late.promise);gone.unmount();const count=gone.writes.length;late.resolve(response({revealed:true}));await flush();assert.equal(gone.writes.length,count);
});
test('background polling waits while hidden; focus and visibility refresh without page reload',async()=>{
 let calls=0;const page=screen(async()=>{calls++;return response({revealed:true});});await flush();assert.equal(calls,1);
 page.visible('hidden');page.fire(30000);await flush();assert.equal(calls,1);
 page.event('focus');await flush();assert.equal(calls,1);
 page.visible('visible');page.event('visibilitychange');await flush();assert.equal(calls,2);
 page.event('focus');await flush();assert.equal(calls,3);page.unmount();
});

const jsx=(type,props)=>({type,props:props??{}});
const view=load('src/components/items/buyer-reveal-notice.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx}}).default;
function text(node){return Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):typeof node==='string'||typeof node==='number'?String(node):'';}
test('notice uses Eastern release date, supports mixed seasons and preserves retry on failure',()=>{
 const props={hasPurchases:true,revealedCount:0,nextRevealAt:cutoff,loading:false,error:false,onRetry(){}};
 assert.match(text(view(props)),/December 26, 2026 at midnight Eastern time/);
 assert.match(text(view({...props,revealedCount:2})),/2 purchased gifts show/);
 const error=view({...props,error:true});assert.equal(error.props.role,'alert');assert.match(text(error),/Your gift list is still available/);
 assert.equal(view({...props,hasPurchases:false}),null);
});

test('a late response from the previous list cannot replace the new list response',async()=>{
 const old=deferred(),next=deferred();let calls=0;
 const page=screen(()=>++calls===1?old.promise:next.promise);
 const nextGift={...gift,id:id(202)};page.render({listId:id(102),items:[nextGift]});
 const newer=response({revealed:true,name:'Casey'});newer.items[0].item_id=nextGift.id;
 next.resolve(newer);await flush();assert.equal(page.render().names.get(nextGift.id),'Casey');
 old.resolve(response({revealed:true,name:'Old buyer'}));await flush();
 assert.equal(page.render().names.get(nextGift.id),'Casey');assert.equal(page.render().names.has(gift.id),false);page.unmount();
});
test('buyer label renders only on purchased gifts owned by the viewer',()=>{
 const Row=load('src/components/items/item-row.tsx',{
  react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect(){}},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  '@/components/items/item-thumbnail':{default:'Thumbnail'},
  '@/components/ui/stateful-checkbox':{StatefulCheckbox:'Checkbox'},
 }).default;
 const props={item:{...gift,title:'Scarf',price_cents:3500,link:null,notes:null},isOwner:true,buyerName:'Alex',onToggle:async()=>true,onDelete:async()=>true,onUpdate:async()=>true};
 assert.match(text(Row(props)),/Purchased by Alex/);
 assert.doesNotMatch(text(Row({...props,isOwner:false})),/Purchased by|Alex/);
 assert.doesNotMatch(text(Row({...props,item:{...props.item,purchased:false}})),/Purchased by|Alex/);
});

test('a slower refresh cannot overwrite a newer result for the same claim',async()=>{
 let call=0;const older=deferred(),newer=deferred();
 const page=screen(()=>++call===1?Promise.resolve(response({revealed:true})):call===2?older.promise:newer.promise);await flush();
 page.event('online');page.event('focus');
 newer.resolve(response({revealed:true,name:'Current name'}));await flush();
 older.resolve(response({revealed:true,name:'Outdated name'}));await flush();
 assert.equal(page.render().names.get(gift.id),'Current name');assert.equal(page.render().error,false);page.unmount();
});
