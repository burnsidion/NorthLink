const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.cwd() + '/node_modules/typescript');
function load(file, overrides = {}, globals = {}, cache = new Map()) {
 file = path.resolve(file);
 if (cache.has(file)) return cache.get(file);
 const exports = {}; cache.set(file, exports);
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
 } }).outputText;
 vm.runInNewContext(code, {
  exports, URL, Buffer, AbortController, AbortSignal, Response, Request, TextDecoder, DOMException, process, console,
  fetch: (...args) => fetch(...args),
  setTimeout, clearTimeout, setInterval, clearInterval, ...globals,
  require(name) {
   if (name in overrides) return overrides[name];
   if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides, globals, cache);
   if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'), overrides, globals, cache);
   return require(require.resolve(name, { paths: [process.cwd()] }));
  },
 });
 return exports;
}
module.exports = { load };
