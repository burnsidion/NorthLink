const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, modules, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports, console, ...globals,
    require(name) {
      if(name === '@/lib/item-image') return require('./helpers/load-product-lookup.cjs').load('src/lib/item-image.ts'); if(name === '@/components/items/item-thumbnail') return {default:'ItemThumbnail'}; if (!(name in modules)) throw new Error("Unexpected dependency: " + name);
      return modules[name];
    },
  });
  return exports;
}

function api(rpc) {
  return load("src/lib/items-api.ts", {
    "@/lib/supabase": { supabase: { rpc } },
    "@/lib/format": {},
  });
}
const itemId = "00000000-0000-0000-0000-000000000201";
const timestamp = "2026-11-15T04:00:00Z";
test("purchase request sends no buyer, timestamp, or client session identity", async () => {
  const helper = api(async (name, params) => {
    assert.equal(name, "set_item_purchase");
    assert.deepEqual(Object.keys(params), ["p_item_id", "p_purchased"]);
    assert.equal(params.p_item_id, itemId);
    assert.equal(params.p_purchased, true);
    return { data: { purchased: true, purchased_at: timestamp }, error: null };
  });
  const saved = await helper.togglePurchased(itemId, true);
  assert.equal(saved.purchased_at, timestamp);
});
test("cancellation confirms canonical cleared state", async () => {
  const helper = api(async () => ({ data: { purchased: false, purchased_at: null }, error: null }));
  assert.equal((await helper.togglePurchased(itemId, false)).purchased, false);
});
test("conflicts and lost network responses propagate to the screen", async () => {
  await assert.rejects(api(async () => ({ error: new Error("Someone else already purchased this gift.") }))
    .togglePurchased(itemId, true), /Someone else/);
  await assert.rejects(api(async () => { throw new Error("Connection lost"); })
    .togglePurchased(itemId, true), /Connection lost/);
});
test("malformed responses never count as a saved purchase", async () => {
  for (const data of [null, {}, { purchased: false, purchased_at: null },
    { purchased: true, purchased_at: null }, { purchased: true, purchased_at: "bad" }]) {
    await assert.rejects(api(async () => ({ data, error: null })).togglePurchased(itemId, true), /Could not confirm/);
  }
});

// Test the actual click handler with lightweight hook/animation substitutes.
// This checks save timing and failure propagation without another test runtime.
function checkbox(onChange, { checked = false, reducedMotion = false } = {}) {
  const animations=[], states=[], slots=[];
  let cursor=0, unmount;
  const jsx=(type,props)=>({type,props});
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=value;states.push(value);}];},
    useRef(value){const i=cursor++;return slots[i]??=({current:value});},
    useEffect(effect){const i=cursor++;if(!(i in slots)){slots[i]=true;unmount=effect();}},
  };
  const {StatefulCheckbox}=load("src/components/ui/stateful-checkbox.tsx",{
    react,"react/jsx-runtime":{jsx,jsxs:jsx,Fragment:"fragment"},
    "@/lib/utils":{cn:(...values)=>values.filter(Boolean).join(' ')},
    "./wreath-loader":{WreathSpinner:"wreath"},
    "@/lib/confetti-helpers":{triggerPurchaseConfetti:()=>animations.push("confetti")},
  },{window:{matchMedia:()=>({matches:reducedMotion})}});
  function render(nextChecked=checked){checked=nextChecked;cursor=0;return StatefulCheckbox({checked,onChange});}
  const button=tree=>tree.props.children.find(node=>node?.type==="button");
  const tree=render();
  return {click:button(tree).props.onClick,render,button,animations,states,unmount};
}
test("save starts immediately, duplicate clicks are blocked, success follows confirmation", async () => {
  let finish;
  let requests = 0;
  const control = checkbox(() => { requests++; return new Promise(resolve => { finish = resolve; }); });
  const first = control.click();
  await control.click();
  assert.equal(requests, 1);
  assert.equal(control.animations.length, 0);
  finish(true);
  await first;
  assert.ok(control.animations.length > 0);
});
test("failed save does not animate success and permits retry", async () => {
  let requests = 0;
  const control = checkbox(async () => { requests++; return false; });
  await control.click();
  await control.click();
  assert.equal(requests, 2);
  assert.equal(control.animations.length, 0);
  assert.equal(control.states.at(-1), false);
});
test("thrown failure releases controls and does not animate success", async () => {
  const control = checkbox(async () => { throw new Error("Offline"); });
  await control.click();
  assert.equal(control.animations.length, 0);
  assert.ok(control.states.some(value => typeof value === "string"));
  assert.equal(control.states.at(-1), false);
});
test("leaving the screen suppresses later animation and state updates", async () => {
  let finish;
  const control = checkbox(() => new Promise(resolve => { finish = resolve; }));
  const pending = control.click();
  control.unmount();
  const count = control.states.length;
  finish(true);
  await pending;
  assert.equal(control.animations.length, 0);
  assert.equal(control.states.length, count);
});

test("pending purchase stays inside the disabled checkbox and reveals confirmed state without an overlay", async()=>{
 let finish;
 const control=checkbox(()=>new Promise(resolve=>{finish=resolve;}));
 const work=control.click();
 const pending=control.button(control.render());
 assert.equal(pending.props.disabled,true);assert.equal(pending.props['aria-busy'],true);
 assert.equal(pending.props.children.type,'wreath');
 assert.equal(control.animations.length,0);
 finish(true);await work;
 const saved=control.button(control.render(true));
 assert.equal(saved.props.disabled,false);assert.equal(saved.props['aria-pressed'],true);
 assert.equal(saved.props.children.type,'svg');assert.match(saved.props.children.props.className,/ledger-purchase-check-pop/);
 control.unmount();
});
test("reduced motion and unpurchasing suppress celebratory confetti", async()=>{
 for(const options of [{reducedMotion:true},{checked:true}]){
  const control=checkbox(async()=>true,options);await control.click();
  assert.equal(control.animations.length,0);control.unmount();
 }
});
