const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-product-lookup.cjs');
const image = load('src/lib/item-image.ts');
test('image links allow public HTTPS and reject unsafe, local and oversized URLs', () => {
 assert.equal(image.itemImageUrl('https://cdn.example/product.jpg?size=small'), 'https://cdn.example/product.jpg?size=small');
 for (const src of [null,'','http://cdn.example/a','javascript:alert(1)','data:image/svg+xml,bad','https://user:pass@cdn.example/a','https://127.0.0.1/a','https://0x7f000001/a','https://[::1]/a','https://router.local/a','https://localhost/a','https://cdn.example:9000/a','https://cdn.example/'+'x'.repeat(2048)]) assert.equal(image.itemImageUrl(src),null,src);
});
test('thumbnail errors switch to a neutral fallback without retrying or sending a referrer', () => {
 let failed=null; const jsx=(type,props)=>({type,props});
 const { default: Thumbnail } = load('src/components/items/item-thumbnail.tsx', {
  react:{useState:()=>[failed,next=>{failed=next;}]}, 'react/jsx-runtime':{jsx,jsxs:jsx},
 });
 const src='https://cdn.example/a.jpg';
 let node=Thumbnail({src}).props.children;
 assert.equal(node.type,'img'); assert.equal(node.props.referrerPolicy,'no-referrer'); assert.equal(node.props.loading,'lazy');
 node.props.onError(); assert.equal(Thumbnail({src}).props.children.type,'svg');
 assert.equal(Thumbnail({src:null}).props.children.type,'svg');
 assert.equal(Thumbnail({src:'https://cdn.example/new.jpg'}).props.children.type,'img');
});
test('thumbnail writes validate before network, support removal and preserve omitted images', async () => {
 const writes=[]; const query={insert(v){writes.push(v);return this;},update(v){writes.push(v);return this;},eq(){return this;},select(){return this;},async single(){return {data:{id:'gift',list_id:'list'},error:null};}};
 const api=load('src/lib/items-api.ts',{'@/lib/supabase':{supabase:{from:()=>query}}});
 await api.addItem('list',{title:'Gift',imageUrl:'https://cdn.example/a.jpg'}); assert.equal(writes[0].image_url,'https://cdn.example/a.jpg');
 await api.updateItem('gift',{title:'New name'}); assert.equal('image_url' in writes[1],false);
 await api.updateItem('gift',{image_url:null}); assert.equal(writes[2].image_url,null);
 await assert.rejects(api.addItem('list',{title:'Gift',imageUrl:'http://cdn.example/a'})); assert.equal(writes.length,3);
});

 test('manual additions omit image_url, including an explicitly empty suggestion', async () => {
 const writes=[]; const query={insert(v){writes.push(v);return this;},select(){return this;},async single(){return {data:{id:'gift',list_id:'list'},error:null};}};
 const api=load('src/lib/items-api.ts',{'@/lib/supabase':{supabase:{from:()=>query}}});
 for (const imageUrl of [undefined,null,'']) await api.addItem('list',{title:'Manual gift',imageUrl});
 for (const payload of writes) assert.equal('image_url' in payload,false);
 });
