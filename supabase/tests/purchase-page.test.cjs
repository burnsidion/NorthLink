const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(
  fs.readFileSync("src/app/(authed)/lists/[id]/page.tsx", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }
).outputText;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let n = 0; n < 8; n++) await new Promise(setImmediate); };

// Exercise the actual page handlers and JSX with deterministic hooks/transport.
// A route key creates a fresh harness, just as React remounts keyed content.
function page(id, { save, refresh } = {}) {
  let index = 0;
  const slots = [], effects = [], cleanups = [], writes = [];
  let realtime, refreshes = 0;
  const router = { push() {} };
  const gift = { id: "gift-" + id, list_id: id, title: "Gift", purchased: false };
  const hooks = {
    useState(initial) {
      const key = index++;
      if (!(key in slots)) slots[key] = typeof initial === "function" ? initial() : initial;
      return [slots[key], value => {
        slots[key] = typeof value === "function" ? value(slots[key]) : value;
        writes.push({ key, value: slots[key] });
      }];
    },
    useRef(initial) {
      const key = index++;
      if (!(key in slots)) slots[key] = { current: initial };
      return slots[key];
    },
    useEffect(effect) {
      const key = index++;
      if (!(key in slots)) { slots[key] = true; effects.push(effect); }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const channel = { on(_event, _filter, callback) { realtime = callback; return channel; },
    subscribe() { return channel; } };
  const query = {
    select() { return query; }, eq() { return query; },
    order() { refreshes++; return refresh ? refresh() : Promise.resolve({ data: [gift], error: null }); },
  };
  const modules = {
    react: hooks,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/navigation": { useParams: () => ({ id }), useRouter: () => router },
    "motion/react": { motion: new Proxy({}, { get: (_, key) => "motion." + key }) },
    "@/lib/supabase": { supabase: { channel: () => channel, removeChannel() {}, from: () => query } },
    "@/lib/auth-helpers": { getCurrentUser: async () => ({ id: "owner" }) },
    "@/lib/list-helpers": {
      getUserFamilyGroup: async () => null,
      getListWithItems: async () => ({ list: { id, title: "List", owner_user_id: "owner", last_viewed_at: null },
        items: [gift], listError: null, itemsError: null }),
      calculateNewPurchases: () => 0, updateListLastViewed: async () => {},
      filterItems: items => items, sortItems: items => items,
    },
    "@/lib/items-api": { togglePurchased: save ?? (async () => ({ purchased: true, purchased_at: "2026-11-15T01:00:00Z" })) },
    "@/components/items/item-row": { default: "ItemRowCard" },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, console, require: name => modules[name] ?? new Proxy({ default: "component" }, { get: (obj, key) => obj[key] ?? (() => null) }),
  });
  const route = exports.default();
  function render() {
    index = 0;
    const tree = route.type(route.props);
    while (effects.length) { const cleanup = effects.shift()(); if (cleanup) cleanups.push(cleanup); }
    return tree;
  }
  function* nodes(node) {
    if (Array.isArray(node)) { for (const child of node) yield* nodes(child); }
    else if (node && typeof node === "object") { yield node; yield* nodes(node.props?.children); }
  }
  const all = () => [...nodes(render())];
  render();
  return {
    key: route.key, gift, writes,
    item: () => all().find(node => node.type === "ItemRowCard")?.props.item,
    toggle: () => all().find(node => node.type === "ItemRowCard").props.onToggle(gift.id, true),
    error: () => all().find(node => node.type === "p" && node.props.className === "text-red-600 text-sm")?.props.children,
    realtime: () => realtime(), refreshes: () => refreshes,
    unmount: () => cleanups.forEach(cleanup => cleanup()),
  };
}

test("lost save response plus failed refresh explains uncertain persistence", async () => {
  for (const refresh of [
    async () => ({ data: null, error: new Error("Offline") }),
    async () => { throw new Error("Offline"); },
  ]) {
    const screen = page("A", { save: async () => { throw new Error("Connection lost"); }, refresh });
    await flush();
    assert.equal(await screen.toggle(), false);
    assert.match(screen.error(), /couldn’t confirm whether.*saved/);
    assert.match(screen.error(), /Refresh the page before trying again/);
    screen.unmount();
  }
});
test("recovered refresh displays current state without claiming an interrupted save succeeded", async () => {
  const screen = page("A", {
    save: async () => { throw new Error("Connection lost"); },
    refresh: async () => ({ data: [{ id: "gift-A", list_id: "A", purchased: true }], error: null }),
  });
  await flush();
  assert.equal(await screen.toggle(), false);
  assert.equal(screen.item().purchased, true);
  assert.match(screen.error(), /list has been refreshed/);
  screen.unmount();
});
test("known conflict/permission rejection retains its useful message", async () => {
  for (const code of ["P0001", "42501", "23514"]) {
    const screen = page("A", {
      save: async () => { throw { code, message: "Only the buyer can undo this purchase." }; },
      refresh: async () => ({ data: null, error: new Error("Offline") }),
    });
    await flush();
    assert.equal(await screen.toggle(), false);
    assert.match(screen.error(), /Only the buyer/);
    assert.match(screen.error(), /list could not be refreshed/);
    screen.unmount();
  }
});
test("a late save after navigation cannot update state or start recovery on the old page", async () => {
  for (const failed of [false, true]) {
    const pending = deferred();
    const old = page("A", { save: () => pending.promise });
    await flush();
    const request = old.toggle();
    old.unmount();
    const count = old.writes.length;
    const current = page("B");
    await flush();
    assert.notEqual(old.key, current.key);
    if (failed) pending.reject(new Error("Offline"));
    else pending.resolve({ purchased: true, purchased_at: "2026-11-15T01:00:00Z" });
    assert.equal(await request, false);
    assert.equal(old.writes.length, count);
    assert.equal(old.refreshes(), 0);
    assert.equal(current.item().purchased, false);
    assert.equal(current.error(), undefined);
    current.unmount();
  }
});
test("a late realtime refresh after leaving the list is ignored", async () => {
  const pending = deferred();
  const screen = page("A", { refresh: () => pending.promise });
  await flush();
  screen.realtime();
  screen.unmount();
  const count = screen.writes.length;
  pending.resolve({ data: [], error: null });
  await flush();
  assert.equal(screen.writes.length, count);
});
test("a refresh started before save confirmation cannot overwrite the saved status", async () => {
  const pending = deferred();
  const screen = page("A", { refresh: () => pending.promise });
  await flush();
  screen.realtime();
  assert.equal(await screen.toggle(), true);
  pending.resolve({ data: [screen.gift], error: null });
  await flush();
  assert.equal(screen.item().purchased, true);
  screen.unmount();
});
