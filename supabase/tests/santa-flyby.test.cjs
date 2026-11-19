const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function setup({reduced=false,hidden=false,path='/landing'}={}){
 const timers=new Map(),events={},animations=[];let next=0,cleanup;
 const media={matches:reduced,addEventListener:(name,fn)=>events.motion=fn,removeEventListener:()=>delete events.motion};
 const document={hidden,addEventListener:(name,fn)=>events.visibility=fn,removeEventListener:()=>delete events.visibility};
 const sprite={animate:(frames,options)=>{const animation={frames,options,cancelled:false,cancel(){this.cancelled=true}};animations.push(animation);return animation}};
 const jsx=(type,props)=>({type,props});const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/brand/santa-flyby.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,window:{matchMedia:()=>media},document,setTimeout:(fn,delay)=>{timers.set(++next,{fn,delay});return next},clearTimeout:id=>timers.delete(id),require:name=>name==='react'?{useRef:()=>({current:sprite}),useEffect:fn=>{cleanup=fn()}}:name==='next/navigation'?{usePathname:()=>path}:{jsx,jsxs:jsx}});
 return {exports,timers,events,media,document,animations,mount:()=>exports.SantaSleighFlight(),unmount:()=>cleanup?.(),tick(){const [id,timer]=timers.entries().next().value;timers.delete(id);timer.fn();return timer.delay}};
}
test('sleigh is limited to overview routes and never mounts on individual lists',()=>{
 for(const path of ['/landing','/family-lists','/user-lists']) assert.ok(setup({path}).exports.SantaFlyby());
 for(const path of ['/lists/123','/login','/purchased-items','/onboarding']) assert.equal(setup({path}).exports.SantaFlyby(),null);
});
test('first flight is delayed, lasts twelve seconds, then waits sixty to ninety seconds',()=>{
 const view=setup();view.mount();assert.equal(view.animations.length,0);assert.equal(view.tick(),15000);
 assert.equal(view.animations[0].options.duration,12000);assert.equal(view.tick(),12000);
 const pause=[...view.timers.values()][0].delay;assert.ok(pause>=60000&&pause<=90000);view.unmount();assert.equal(view.timers.size,0);
});
test('hidden tabs and reduced motion suppress flights and cancel active motion',()=>{
 for(const options of [{hidden:true},{reduced:true}]){const view=setup(options);view.mount();assert.equal(view.timers.size,0);view.unmount()}
 const view=setup();view.mount();view.tick();view.document.hidden=true;view.events.visibility();assert.equal(view.animations[0].cancelled,true);assert.equal(view.timers.size,0);
 view.document.hidden=false;view.events.visibility();assert.equal([...view.timers.values()][0].delay,15000);
 view.media.matches=true;view.events.motion();assert.equal(view.timers.size,0);view.unmount();assert.deepEqual(view.events,{});
});
