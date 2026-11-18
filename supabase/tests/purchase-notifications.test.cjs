const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-product-lookup.cjs');
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const before='2026-11-17T12:00:00Z', after='2026-11-18T12:00:00Z';
const item=(n,stamp=after,purchased=true)=>({id:id(n),purchased,purchased_at:stamp});
const list=(n,items,seen=null)=>({id:id(n),title:'Christmas list '+n,owner_user_id:id(1),last_viewed_at:seen,items});
const helpers=load('src/lib/list-helpers.ts',{'@/lib/supabase':{supabase:{}}});
const summary=load('src/lib/purchase-activity.ts',{'@/lib/supabase':{supabase:{}},'@/lib/purchases-api':{getMyPurchases(){} }});

test('first-visit lists count valid other-user purchases, excluding self purchases and cancellations',()=>{
 const rows=summary.summarizePurchaseActivity([list(101,[item(201),item(202),item(203,after,false),item(204,null),item(205,'bad')])],new Set([id(202)]));
 assert.equal(rows.length,1);assert.equal(rows[0].count,1);assert.deepEqual(Object.keys(rows[0]).sort(),['count','id','title']);
});
test('counts aggregate per list using the seen watermark; zero and already seen activity stays quiet',()=>{
 const rows=summary.summarizePurchaseActivity([list(101,[item(201,before),item(202,after)],before),list(102,[item(203),item(204)]),list(103,[item(205,before)],after)],new Set());
 assert.equal(rows.length,2);assert.equal(rows.reduce((sum,row)=>sum+row.count,0),3);
 assert.equal(helpers.calculateNewPurchases([item(201,before)],before),0);
});
test('acknowledgement uses only the loaded purchases, preserves monotonic filtering, and skips failed/empty snapshots',async()=>{
 const writes=[];let filters=[];
 const query={update(value){writes.push(value);return this;},eq(key,value){filters.push([key,value]);return this;},or(value){filters.push(['or',value]);return Promise.resolve({error:null});}};
 const api=load('src/lib/list-helpers.ts',{'@/lib/supabase':{supabase:{from:()=>query}}});
 const seen=api.latestObservedPurchase([item(201,before),item(202,after),item(203,'2099-01-01T00:00:00Z',false)]);
 assert.equal(seen,after);await api.updateListLastViewed(id(101),id(1),seen);
 assert.equal(writes[0].last_viewed_at,after);assert.equal(filters[0][1],id(101));assert.equal(filters[1][1],id(1));assert.match(filters[2][1],/last_viewed_at.is.null,last_viewed_at.lt/);
 await api.updateListLastViewed(id(101),id(1),null);assert.equal(writes.length,1);
 assert.equal(api.latestObservedPurchase([]),null);
 assert.equal(api.calculateNewPurchases([item(204,'2026-11-18T12:01:00Z')],seen),1,'a purchase arriving after the snapshot remains unread');
});
test('transport selects statuses without buyer fields and rejects failures or an unexpected owner',async()=>{
 const calls=[];let owned={data:[list(101,[item(201),item(202)])],error:null},failOwn=false;
 const api=load('src/lib/purchase-activity.ts',{
  '@/lib/supabase':{supabase:{from:table=>({select:columns=>({eq:async(key,value)=>{calls.push({table,columns,key,value});return owned;}})})}},
  '@/lib/purchases-api':{getMyPurchases:async()=>{if(failOwn)throw Error('offline');return [{id:id(202)}];}},
 });
 assert.equal((await api.getPurchaseActivity(id(1)))[0].count,1);
 assert.doesNotMatch(calls[0].columns,/buyer|purchased_by/);assert.equal(calls[0].value,id(1));
 failOwn=true;await assert.rejects(api.getPurchaseActivity(id(1)));failOwn=false;
 owned={data:[{...list(101,[item(201)]),owner_user_id:id(2)}],error:null};await assert.rejects(api.getPurchaseActivity(id(1)));
 owned={data:null,error:Error('offline')};await assert.rejects(api.getPurchaseActivity(id(1)));
});

const jsx=(type,props)=>({type,props:props??{}});
function controls(initial={}){
 let cursor=0;const slots=[],effects=[];const data={lists:[{id:id(101),title:'My Christmas List',count:2},{id:id(102),title:'Stocking fillers',count:1}],error:null,loading:false,...initial};
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
  useRef(initial){const i=cursor++;return slots[i]??=({current:initial});},
  useCallback(fn){cursor++;return fn;},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>!Object.is(v,slots[i].deps[j])))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
 };
 let retried=0;
 const module=load('src/components/items/purchase-notifications.tsx',{
  react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{__esModule:true,default:'Link'},
  '@/lib/purchase-activity':{getPurchaseActivity(){}},
  '@/lib/use-refreshing-data':{useRefreshingData:()=>({data:data.lists,error:data.error,loading:data.loading,retry(){retried++;}})},
  '@/components/ui/use-dialog-focus':{useDialogFocus(){}},
 },{document:{body:{style:{overflow:''}}}});
 const render=(tourOpen=false)=>{cursor=0;const tree=module.default({userId:id(1),tourOpen});while(effects.length)effects.shift()();return tree;};
 return {module,data,render,remount(){slots.length=0;},retried:()=>retried,dialog(props){cursor=0;const tree=module.PurchaseNotificationDialog(props);while(effects.length)effects.shift()();return tree;}};
}
const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];
const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):typeof node==='string'||typeof node==='number'?String(node):'';
test('notification waits for tour, closes without acknowledging purchases, and can be reopened from its banner',()=>{
 const page=controls();let tree=page.render(true);let modal=nodes(tree).find(node=>node.props.lists);
 assert.equal(modal.props.open,false);tree=page.render(false);modal=nodes(tree).find(node=>node.props.lists);assert.equal(modal.props.open,true);
 modal.props.onClose();tree=page.render(false);assert.equal(nodes(tree).find(node=>node.props.lists).props.open,false);assert.equal(page.data.lists.length,2);
 nodes(tree).find(node=>node.type==='button'&&node.props.children==='View purchase update').props.onClick();assert.equal(nodes(page.render()).find(node=>node.props.lists).props.open,true);
});
test('zero activity and failed reads do not show a misleading popup; failure offers retry',()=>{
 for(const data of [{lists:[]},{error:'offline'}]){
  const page=controls(data);const tree=page.render();assert.equal(nodes(tree).find(node=>node.props.lists).props.open,false);
  if(data.error){nodes(tree).find(node=>node.type==='button').props.onClick();assert.equal(page.retried(),1);}
 }
});
test('dialog shows counts and list links only, closes on Escape/link/Close, and never exposes buyer details',()=>{
 const page=controls();let closed=0;const tree=page.dialog({open:true,lists:page.data.lists,onClose(){closed++;}});
 assert.equal(tree.props.role,'dialog');assert.equal(tree.props['aria-modal'],'true');assert.match(text(tree),/3 gifts were purchased/);
 assert.equal(nodes(tree).filter(node=>node.type==='Link').length,2);assert.doesNotMatch(text(tree),/buyer|email|purchased_by/i);
 nodes(tree).find(node=>node.type==='Link').props.onClick();nodes(tree).find(node=>node.type==='button').props.onClick();tree.props.onKeyDown({key:'Escape',stopPropagation(){}});assert.equal(closed,3);
});

test('closing stays quiet across dashboard remounts during this visit without clearing unread data',()=>{
 const page=controls();let tree=page.render();nodes(tree).find(node=>node.props.lists).props.onClose();page.render();
 page.remount();tree=page.render();assert.equal(nodes(tree).find(node=>node.props.lists).props.open,false);assert.equal(page.data.lists.length,2);
 const nextLogin=controls();assert.equal(nodes(nextLogin.render()).find(node=>node.props.lists).props.open,true);
});
