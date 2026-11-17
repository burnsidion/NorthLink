const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, modules = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, URL, Intl, require: name => {
    if(name === '@/lib/item-image') return require('./helpers/load-product-lookup.cjs').load('src/lib/item-image.ts'); if(name === '@/components/items/item-thumbnail') return {default:'ItemThumbnail'}; if(name === '@/components/ui/wreath-loader') return {WreathLoader:'WreathLoader'}; if (!(name in modules)) throw new Error('Unexpected import: ' + name);
    return modules[name];
  } });
  return exports;
}
const format = load('src/lib/format.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
test('prices distinguish unknown from free and convert exact decimal cents', () => {
  for (const [input, expected] of [['',null],['  ',null],['0',0],['0.00',0],['24.99',2499],['0.29',29],['12.5',1250],[' 12.50 ',1250],['21474836.47',2147483647]]) {
    assert.equal(format.toCents(input), expected, input);
  }
  for (const input of ['-2','abc','12abc34','1.234','NaN','Infinity','$12.00','1,200','1e3','1.2.3','21474836.48']) {
    assert.throws(() => format.toCents(input), undefined, input);
  }
});
function api(response = { data: { id:'gift', list_id:'list' }, error:null }) {
  const writes=[], selects=[];
  const query = {
    insert: payload => { writes.push({ operation:'insert', payload }); return query; },
    update: payload => { writes.push({ operation:'update', payload }); return query; },
    delete: () => { writes.push({ operation:'delete' }); return query; },
    eq: (key,value) => { assert.equal(key,'id'); assert.equal(value,'gift'); return query; },
    select: columns => { selects.push(columns); return query; },
    single: async () => { if (response instanceof Error) throw response; return response; },
  };
  return { ...load('src/lib/items-api.ts', { '@/lib/format':format, '@/lib/supabase':{ supabase:{ from: table => { assert.equal(table,'items'); return query; } } } }), writes, selects };
}
test('add/update preserve null and zero; invalid inputs never issue a write', async () => {
  const helper=api();
  await helper.addItem('list',{ title:'Gift', price:'' }); assert.equal(helper.writes[0].payload.price_cents,null);
  await helper.updateItem('gift',{ price:'0' }); assert.equal(helper.writes[1].payload.price_cents,0);
  await helper.updateItem('gift',{ price_cents:null }); assert.equal(helper.writes[2].payload.price_cents,null);
  await helper.updateItem('gift',{ most_wanted:false }); assert.equal(helper.writes[3].payload.most_wanted,false);
  const count=helper.writes.length;
  for (const price of ['-1','junk','1.234']) await assert.rejects(helper.addItem('list',{ title:'Gift', price }));
  for (const price_cents of [-1,1.5,NaN,Infinity,2147483648]) await assert.rejects(helper.updateItem('gift',{ price_cents }));
  await assert.rejects(helper.updateItem('gift',{})); assert.equal(helper.writes.length,count);
});
test('update/delete confirm the affected ID without reading buyer identity', async () => {
  for (const operation of ['updateItem','deleteItem']) {
    const helper=api(); await helper[operation]('gift',{ title:'Edited' });
    assert.deepEqual(helper.selects,['id']);
    for (const response of [{ data:null,error:null }, { data:[],error:null }, { data:{ id:'other' },error:null },
      { data:null,error:{ code:'PGRST116',message:'No rows' } }, { data:null,error:new Error('denied') }, new Error('offline')]) {
      await assert.rejects(api(response)[operation]('gift',{ title:'Edited' }));
    }
  }
  await assert.rejects(api({ data:null,error:null }).addItem('list',{ title:'Gift' }));
});

// Exercise actual edit controls and handlers with deterministic hooks.
function row(onUpdate = async () => true, onDelete = async () => true, link = null) {
  let index=0; const slots=[], effects=[], cleanups=[], writes=[];
  const hooks={
    useState(initial) { const key=index++; if (!(key in slots)) slots[key]=initial;
      return [slots[key], value => { slots[key]=typeof value==='function' ? value(slots[key]) : value; writes.push(key); }]; },
    useRef(initial) { const key=index++; if (!(key in slots)) slots[key]={ current:initial }; return slots[key]; },
    useEffect(effect) { const key=index++; if (!(key in slots)) { slots[key]=true; effects.push(effect); } },
  };
  const jsx=(type,props) => ({ type,props:props ?? {} });
  const component=load('src/components/items/item-row.tsx', {
    react:hooks, 'react/jsx-runtime':{ jsx,jsxs:jsx }, '@/lib/format':format,
    '@/lib/utils':{ cn:() => '' },
    'lucide-react':{ Snowflake:'Snowflake' }, '@/components/ui/stateful-checkbox':{ StatefulCheckbox:'PurchaseCheckbox' },
  }).default;
  const props={ item:{ id:'gift', title:'Gift', purchased:false, price_cents:null, link },onUpdate,onDelete,onToggle:async () => true };
  function render() { index=0; const tree=component(props); while (effects.length) { const cleanup=effects.shift()(); if (cleanup) cleanups.push(cleanup); } return tree; }
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); return node && typeof node==='object' ? [node,...nodes(node.props?.children)] : []; }
  const all=() => nodes(render());
  const button=label => all().find(node => node.type==='button' && node.props.children===label);
  render();
  return { all,button,writes, edit:() => button('Edit').props.onClick(),
    price:value => all().find(node => node.props.placeholder==='Price (e.g. 24.99)').props.onChange({ target:{ value } }),
    unmount:() => cleanups.forEach(fn => fn()) };
}
test('failed edits retain entered fields and stay open; invalid prices show an error without saving', async () => {
  let calls=0;
  const page=row(async () => { calls++; return false; }); page.edit(); page.price('12.50');
  await page.button('Save').props.onClick();
  assert.equal(page.all().find(node => node.props.placeholder==='Price (e.g. 24.99)').props.value,'12.50');
  assert.ok(page.all().some(node => node.props.role==='alert'));
  page.price('-1'); await page.button('Save').props.onClick(); assert.equal(calls,1);
  assert.ok(page.button('Save')); page.unmount();
});
test('confirmed saves close edits; pending saves block duplicate submissions and late state updates', async () => {
  const pending=deferred(); let calls=0;
  const page=row(async (_id,patch) => { calls++; assert.equal(patch.price_cents,null); return pending.promise; });
  page.edit(); const click=page.button('Save').props.onClick; const request=click(); await click(); assert.equal(calls,1);
  assert.equal(page.button('Saving…').props.disabled,true);
  pending.resolve(true); await request; assert.ok(page.button('Edit')); page.unmount();
  const late=deferred(); const other=row(() => late.promise); other.edit(); const saving=other.button('Save').props.onClick();
  other.unmount(); const count=other.writes.length; late.resolve(true); await saving; assert.equal(other.writes.length,count);
});
test('delete and sale-toggle failures remain visible without a success animation', async () => {
  for (const label of ['Delete','On Sale']) {
    const page=row(async () => false,async () => false);
    await page.button(label).props.onClick();
    assert.ok(page.all().some(node => node.props.role==='alert')); assert.ok(page.button('Delete')); page.unmount();
  }
});

test('gift links are normal web links with no image or preview request on render', () => {
  const page=row(undefined,undefined,'https://shop.example/gift?size=large#details');
  const link=page.all().find(node=>node.type==='a');
  assert.equal(link.props.href,'https://shop.example/gift?size=large#details');
  assert.equal(link.props.target,'_blank');assert.equal(link.props.rel,'noopener noreferrer');
  assert.equal(page.all().some(node=>node.type==='img'||node.props.src||node.props.onMouseEnter||node.props.onMouseMove),false);
  page.unmount();
});
test('unsafe or invalid saved gift links are not clickable', () => {
  for(const value of ['javascript:alert(1)','data:text/html,bad','file:///tmp/gift','//shop.example/gift','not a URL','https://user:password@shop.example',null]){
    const page=row(undefined,undefined,value);assert.equal(page.all().filter(node=>node.type==='a').length,0);page.unmount();
  }
  assert.equal(format.safeWebUrl('HTTP://shop.example/gift'),'http://shop.example/gift');
});
test('purchased gifts apply the same web-link check without loading previews', () => {
  const jsx=(type,props)=>({type,props:props??{}});
  function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);return node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
  for(const link of ['https://shop.example/gift','javascript:alert(1)',null]){
    const modules={react:{useState:initial=>[typeof initial==='function'?initial():initial,()=>{}]},
      'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/purchases-api':{getMyPurchases(){}},
      '@/lib/use-refreshing-data':{useRefreshingData:()=>({data:[{id:'gift',title:'Gift',link,price_cents:null}],error:null,loading:false,retry(){}})},
      '@/lib/format':format,'@/components/ui/refresh-notice':{RefreshNotice:'RefreshNotice'},
      'motion/react':{motion:new Proxy({},{get:(_,key)=>'motion.'+key})}};
    for(const name of ['snowfall','colourful-text','stars-background','hero-highlight','skeleton-card','countdown-banner','text-animate'])modules['@/components/ui/'+name]=new Proxy({default:'component'},{get:(obj,key)=>obj[key]??'component'});
    const Page=load('src/app/(authed)/purchased-items/page.tsx',modules).default;
    const all=nodes(Page());const anchors=all.filter(node=>node.type==='a');
    assert.equal(anchors.length,link?.startsWith('https:')?1:0);
    if(anchors.length)assert.equal(anchors[0].props.rel,'noopener noreferrer');
    assert.equal(all.some(node=>node.type==='img'||node.props.src),false);
  }
});
