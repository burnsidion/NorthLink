const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('dialog focus wraps in both directions, contains stray focus and returns to its trigger on close', () => {
 const events = {}, exports = {};
 let cleanup;
 class Element {
  isConnected = true;
  focus() { document.activeElement = this; }
  closest() { return null; }
 }
 const trigger = new Element(), first = new Element(), last = new Element();
 const document = { activeElement: trigger, addEventListener: (key, fn) => { events[key] = fn; }, removeEventListener: key => { delete events[key]; } };
 let controls = [first, last];
 const dialog = new Element();
 dialog.querySelectorAll = () => controls;
 dialog.contains = element => element === dialog || controls.includes(element);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ui/use-dialog-focus.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
 }).outputText, { exports, document, HTMLElement: Element, require: () => ({ useEffect: effect => { cleanup = effect(); } }) });
 exports.useDialogFocus(true, { current: dialog });
 assert.equal(document.activeElement, first);
 let prevented = 0;
 const tab = shiftKey => events.keydown({ key: 'Tab', shiftKey, preventDefault() { prevented++; } });
 tab(true); assert.equal(document.activeElement, last);
 tab(false); assert.equal(document.activeElement, first);
 trigger.focus(); events.focusin({ target: trigger }); assert.equal(document.activeElement, first);
 // Pending operations may disable every control; retain a focusable dialog.
 controls = []; tab(false); assert.equal(document.activeElement, dialog);
 assert.equal(prevented, 3);
 cleanup(); assert.equal(document.activeElement, trigger); assert.deepEqual(events, {});
});
