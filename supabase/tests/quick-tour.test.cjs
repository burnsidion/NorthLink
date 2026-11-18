const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-product-lookup.cjs');
function storage() { const saved=new Map(); return { saved, getItem:k=>saved.get(k)??null, setItem:(k,v)=>saved.set(k,v) }; }
function page(userId='owner', localStorage=storage(), onOpenChange) {
 let cursor=0; const slots=[], effects=[];
 const react={
  useState(initial) { const i=cursor++; if(!(i in slots)) slots[i]=typeof initial==='function'?initial():initial; return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}]; },
  useRef(initial) { const i=cursor++; return slots[i]??=( {current:initial} ); },
  useEffect(fn,deps) { const i=cursor++; if(!slots[i]||deps.some((v,j)=>!Object.is(v,slots[i].deps[j]))) effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};}); },
 };
 const jsx=(type,props)=>({type,props:props??{}});
 const body={style:{overflow:'auto'}};
 const {default:Tour}=load('src/components/tour/quick-tour.tsx',{
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/components/ui/use-dialog-focus':{useDialogFocus:()=>{}},
 },{window:{localStorage},document:{body}});
 const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];
 function all(){cursor=0; const result=nodes(Tour({userId,onOpenChange}));while(effects.length)effects.shift()();return result;}
 const button=label=>all().find(n=>n.type==='button'&&n.props.children===label);
 return {all,body,button,click:label=>{const b=button(label);assert.ok(b,label);b.props.onClick();all();},unmount:()=>{for(const slot of slots)slot?.cleanup?.();}};
}
test('first visit offers an optional tour, skipping persists per account and browser',()=>{
 const saved=storage(); const tour=page('owner',saved);
 assert.ok(tour.button('Take a quick tour')); assert.equal(tour.body.style.overflow,'hidden');
 tour.click('Skip for now'); assert.equal(tour.all().some(n=>n.props.role==='dialog'),false); assert.equal(tour.body.style.overflow,'auto'); tour.unmount();
 const returning=page('owner',saved); assert.equal(returning.all().some(n=>n.props.role==='dialog'),false);returning.unmount();
 const other=page('shopper',saved); assert.ok(other.button('Take a quick tour'));other.unmount();
});
test('all steps support back, next, finish and replay without page navigation',()=>{
 const tour=page();tour.click('Take a quick tour');
 assert.ok(tour.all().some(n=>n.props.children==='Create or join a family group'));
 tour.click('Next');tour.click('Back'); assert.ok(tour.all().some(n=>n.props.children==='Create or join a family group'));
 for(let i=0;i<4;i++)tour.click('Next');
 assert.ok(tour.all().some(n=>n.props.children==='Mark items as purchased'));
 tour.click('Finish tour');assert.equal(tour.all().some(n=>n.props.role==='dialog'),false);
 tour.click('Quick tour');assert.ok(tour.button('Take a quick tour'));tour.unmount();
});
test('Escape skips at any step; modal has labels and restores body scrolling',()=>{
 const tour=page();tour.click('Take a quick tour');
 const dialog=tour.all().find(n=>n.props.role==='dialog');assert.equal(dialog.props['aria-modal'],'true');assert.equal(dialog.props['aria-labelledby'],'quick-tour-title');
 let stopped=false;dialog.props.onKeyDown({key:'Escape',stopPropagation(){stopped=true;}});
 assert.equal(stopped,true);tour.all();assert.equal(tour.body.style.overflow,'auto');tour.unmount();
});
test('blocked storage does not break skip or replay, and remembers dismissal in this page session',()=>{
 const api=load('src/lib/quick-tour.ts',{}, {window:{localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}}});
 assert.equal(api.tourWasDismissed('owner'),false);assert.doesNotThrow(()=>api.dismissTour('owner'));
 assert.equal(api.tourWasDismissed('owner'),true); assert.equal(api.tourWasDismissed('other'),false);
});

test('tour reports its open state so other dashboard dialogs can wait',()=>{
 const changes=[];const tour=page('notification-owner',storage(),open=>changes.push(open));
 tour.all();assert.equal(changes.at(-1),true);tour.click('Skip for now');assert.equal(changes.at(-1),false);
 tour.click('Quick tour');assert.equal(changes.at(-1),true);tour.unmount();
});
