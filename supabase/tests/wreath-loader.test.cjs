const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-product-lookup.cjs');
const jsx=(type,props)=>({type,props});
const {WreathLoader,WreathSpinner}=load('src/components/ui/wreath-loader.tsx',{
 'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')},
});
test('page loading announces its actual task once while the wreath stays decorative',()=>{
 const loader=WreathLoader({label:'Loading family lists…',className:'ledger-empty'});
 assert.equal(loader.props.role,'status');assert.equal(loader.props.children[1].props.children,'Loading family lists…');
 assert.match(loader.props.className,/ledger-empty/);
 const icon=WreathSpinner({});assert.equal(icon.props['aria-hidden'],'true');assert.equal(icon.props.focusable,'false');
 assert.equal(icon.props.role,undefined);
});
test('generic route loading has a readable fallback and no fabricated percentage',()=>{
 const loader=WreathLoader({});assert.equal(loader.props.children[1].props.children,'Loading…');
 assert.equal(loader.props['aria-valuenow'],undefined);
});
