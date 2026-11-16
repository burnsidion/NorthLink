const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function reveal({ reduced = false, supported = true, failRoll = false, height = 1400 } = {}) {
 let cursor = 0, callbacks = 0;
 const slots = [], effects = [], cleanups = [], animations = [], timers = new Map();
 const events = { window: {}, document: {}, media: {} };
 const media = { matches: reduced, addEventListener: (name, fn) => { events.media[name] = fn; }, removeEventListener: name => { delete events.media[name]; } };
 const window = { innerHeight: 900, matchMedia: () => media,
  addEventListener: (name, fn) => { events.window[name] = fn; }, removeEventListener: name => { delete events.window[name]; } };
 const document = { hidden: false, addEventListener: (name, fn) => { events.document[name] = fn; }, removeEventListener: name => { delete events.document[name]; } };
 function animate(frames, timing) {
  let resolve, reject;
  const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
  const animation = { frames, timing, finished, resolve, cancel() { animation.cancelled = true; reject(new Error('cancelled')); } };
  animations.push(animation); return animation;
 }
 const paper = { style: {}, getBoundingClientRect: () => ({ height, top: 200 }), animate: supported ? animate : undefined };
 const roller = { style: {}, animate: supported ? (failRoll ? () => { throw new Error("animation unavailable"); } : animate) : undefined };
 const react = {
  useRef(value) { const key = cursor++; slots[key] ??= { current: value }; return slots[key]; },
  useState(value) { const key = cursor++; if (!(key in slots)) slots[key] = value; return [slots[key], next => { slots[key] = next; }]; },
  useEffect(effect, deps) { const key = cursor++; if (!(key in slots) || deps.some((value, i) => value !== slots[key][i])) { slots[key] = deps; effects.push(effect); } },
 };
 const jsx = (type, props) => ({ type, props: props ?? {} });
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/lists/list-scroll-reveal.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
 }).outputText, { exports, window, document, Promise,
  setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
  require: name => name === 'react' ? react : { jsx, jsxs: jsx },
 });
 function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
 const complete = () => { callbacks++; };
 function render(children = 'GIFTS') {
  cursor = 0;
  const tree = exports.default({ children, onComplete: complete });
  for (const node of nodes(tree)) {
   if (node.props.className === 'list-scroll-paper') node.props.ref.current = paper;
   if (node.props.className === 'list-scroll-roller list-scroll-travelling') node.props.ref.current = roller;
  }
  while (effects.length) { const cleanup = effects.shift()(); if (cleanup) cleanups.push(cleanup); }
  return tree;
 }
 render();
 return { render, animations, paper, roller, timers, events, media, document, callbacks: () => callbacks,
  sheet: () => nodes(render()).find(node => node.props.className === 'list-scroll-paper'),
  unmount: () => cleanups.forEach(cleanup => cleanup()),
 };
}

test('unroll gates controls until completion, keeps children mounted and never replays on content updates', async () => {
 const view = reveal();
 assert.equal(view.sheet().props.inert, true);
 assert.equal(view.sheet().props['aria-hidden'], true);
 assert.equal(view.sheet().props.children, 'GIFTS');
 assert.equal(view.animations.length, 2);
 assert.equal(view.animations[0].timing.duration, 620);
 view.animations.forEach(animation => animation.resolve()); await flush();
 assert.equal(view.sheet().props.inert, false);
 assert.equal(view.render().props['aria-busy'], false);
 assert.equal(view.paper.style.clipPath, 'none');
 assert.equal(view.callbacks(), 1);
 view.render('EDITED GIFTS');
 assert.equal(view.animations.length, 2); assert.equal(view.callbacks(), 1);
 assert.equal(view.timers.size, 0);
});

test('long paper reveals past the viewport without scaling text or animating its full height', () => {
 const view = reveal({ height: 5000 });
 assert.equal(view.animations[0].frames[1].clipPath, 'inset(0px 0px 4252px 0px)');
 assert.equal(view.animations[1].frames[1].transform, 'translateY(748px)');
 assert.equal(view.paper.style.height, undefined);
 view.unmount();
});

test('reduced motion and browsers without animation support release content without a timed delay', async () => {
 for (const options of [{ reduced: true }, { supported: false }]) {
  const view = reveal(options); await flush();
  assert.equal(view.animations.length, 0); assert.equal(view.timers.size, 0);
  assert.equal(view.sheet().props.inert, false); assert.equal(view.callbacks(), 1);
 }
});

test('fallback completion prevents stuck controls; viewport and preference changes finish safely', async () => {
 const stalled = reveal(); [...stalled.timers.values()][0](); await flush();
 assert.equal(stalled.sheet().props.inert, false); assert.equal(stalled.callbacks(), 1);
 const resized = reveal(); resized.events.window.resize(); await flush();
 assert.equal(resized.sheet().props.inert, false);
 const preference = reveal(); preference.media.matches = true; preference.events.media.change(); await flush();
 assert.equal(preference.sheet().props.inert, false);
 const hidden = reveal(); hidden.document.hidden = true; hidden.events.document.visibilitychange(); await flush();
 assert.equal(hidden.sheet().props.inert, false);
});

test('leaving mid-animation cancels work and ignores late completions; a new visit gets a fresh reveal', async () => {
 const old = reveal(); old.unmount(); old.animations.forEach(animation => animation.resolve()); await flush();
 assert.equal(old.callbacks(), 0); assert.equal(old.timers.size, 0);
 assert.ok(old.animations.every(animation => animation.cancelled));
 assert.deepEqual(old.events.window, {}); assert.deepEqual(old.events.media, {});
 const next = reveal(); assert.equal(next.sheet().props.inert, true); assert.equal(next.animations.length, 2);
 next.unmount(); await flush();
});


test('animation errors, including a partially started pair, still release the list', async () => {
 const partial = reveal({ failRoll: true }); await flush();
 assert.equal(partial.sheet().props.inert, false); assert.equal(partial.callbacks(), 1);
 assert.equal(partial.animations[0].cancelled, true);
 const failed = reveal(); failed.animations[0].cancel(); await flush();
 assert.equal(failed.sheet().props.inert, false); assert.equal(failed.callbacks(), 1);
});
