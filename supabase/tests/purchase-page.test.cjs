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
function page(id, { save, refresh, update, remove, add, share, group, shared, newPurchases = 0 } = {}) {
  let index = 0;
  const slots = [], effects = [], cleanups = [], writes = [], messages = [];
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
      getUserFamilyGroup: async () => group ?? null,
      isListShared: async () => shared ?? false,
      getListWithItems: async () => ({ list: { id, title: "List", owner_user_id: "owner", last_viewed_at: null },
        items: [gift], listError: null, itemsError: null }),
      calculateNewPurchases: () => newPurchases, updateListLastViewed: async () => {},
      filterItems: items => items, sortItems: items => items,
    },
    "@/lib/items-api": { addItem: add ?? (async () => ({ ...gift, id: "added" })), updateItem: update ?? (async () => {}), deleteItem: remove ?? (async () => {}), togglePurchased: save ?? (async () => ({ purchased: true, purchased_at: "2026-11-15T01:00:00Z" })) },
    "sonner": { toast: { success: message => messages.push(["success", message]), error: message => messages.push(["error", message]) } },
    "@/lib/lists-api": { setListShared: share ?? (async () => {}) },
    "@/components/items/item-row": { default: "ItemRowCard" },
    "@/components/lists/list-scroll-reveal": { default: "ListScrollReveal" },
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
    key: route.key, gift, writes, messages, all,
    shareButton: () => all().find(node => node.type === "button" && ["Share to Family", "Unshare from Family", "Saving…"].includes(node.props.children)),
    openAdd: () => all().find(node => node.type === "button" && node.props.children === "Add item").props.onClick(),
    form: () => all().find(node => typeof node.props.onSubmit === "function")?.props,
    item: () => all().find(node => node.type === "ItemRowCard")?.props.item,
    toggle: () => all().find(node => node.type === "ItemRowCard").props.onToggle(gift.id, true),
    update: patch => all().find(node => node.type === "ItemRowCard").props.onUpdate(gift.id, patch),
    remove: () => all().find(node => node.type === "ItemRowCard").props.onDelete(gift.id),
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

test("gift edits and deletes wait for confirmation and failures preserve current items", async () => {
  for (const action of ['update', 'remove']) {
    const pending = deferred();
    const screen = page('A', { [action]: () => pending.promise });
    await flush();
    const request = action === 'update' ? screen.update({ title: 'Edited' }) : screen.remove();
    assert.equal(screen.item().title, 'Gift');
    pending.reject(new Error('No rows changed'));
    assert.equal(await request, false);
    assert.equal(screen.item().title, 'Gift');
    assert.match(screen.error(), /couldn’t confirm/); screen.unmount();
  }
});
test("confirmed gift edits merge into current state rather than an earlier snapshot", async () => {
  const pending = deferred(); const screen = page('A', { update: () => pending.promise });
  await flush(); const request = screen.update({ title: 'Edited' });
  await screen.toggle(); pending.resolve(); assert.equal(await request, true);
  assert.equal(screen.item().title, 'Edited'); assert.equal(screen.item().purchased, true); screen.unmount();
});
test("confirmed deletion removes the gift; late write completions after navigation do nothing", async () => {
  const screen = page('A'); await flush(); assert.equal(await screen.remove(), true); assert.equal(screen.item(), undefined); screen.unmount();
  for (const action of ['update', 'remove']) {
    const pending = deferred(); const old = page('A', { [action]: () => pending.promise }); await flush();
    const request = action === 'update' ? old.update({ title: 'Edited' }) : old.remove();
    old.unmount(); const count = old.writes.length; pending.resolve(); assert.equal(await request, false);
    assert.equal(old.writes.length, count);
  }
});

test("add failures preserve the form and block duplicate submissions while pending", async () => {
  const pending = deferred(); let calls = 0;
  const screen = page('A', { add: async () => { calls++; return pending.promise; } });
  await flush(); screen.openAdd(); screen.form().setTitle('New gift'); screen.form().setPrice('12.50');
  const submit = screen.form().onSubmit;
  const request = submit({ preventDefault() {} }); await submit({ preventDefault() {} }); assert.equal(calls,1);
  pending.reject(new Error('offline')); await request;
  assert.equal(screen.form().title,'New gift'); assert.equal(screen.form().price,'12.50'); assert.equal(screen.form().submitting,false);
  assert.ok(screen.error()); screen.unmount();
});

test("sharing reports success only after confirmation and blocks duplicate clicks", async () => {
  const pending = deferred(); let calls = 0;
  const screen = page('A', { group: 'group', share: async (id, group, next) => {
    calls++; assert.equal(id, 'A'); assert.equal(group, 'group'); assert.equal(next, true); return pending.promise;
  } });
  await flush(); const click = screen.shareButton().props.onClick; const request = click(); await click();
  assert.equal(calls, 1); assert.deepEqual(screen.messages, []); assert.equal(screen.shareButton().props.disabled, true);
  pending.resolve(); await request;
  assert.equal(screen.shareButton().props.children, 'Unshare from Family'); assert.equal(screen.messages[0][0], 'success'); screen.unmount();
});
test("failed unsharing keeps its current state, shows an error, and allows retry", async () => {
  let calls = 0;
  const screen = page('A', { group: 'group', shared: true, share: async (_id, _group, next) => {
    assert.equal(next, false); if (++calls === 1) throw new Error('No rows');
  } });
  await flush(); await screen.shareButton().props.onClick();
  assert.equal(screen.shareButton().props.children, 'Unshare from Family'); assert.equal(screen.messages[0][0], 'error');
  await screen.shareButton().props.onClick(); assert.equal(screen.shareButton().props.children, 'Share to Family');
  assert.equal(screen.error(), undefined); assert.equal(screen.messages.at(-1)[0], 'success'); screen.unmount();
});
test("late sharing completions after leaving cannot change state or display messages", async () => {
  for (const failed of [false, true]) {
    const pending = deferred(); const screen = page('A', { group: 'group', share: () => pending.promise });
    await flush(); const request = screen.shareButton().props.onClick(); screen.unmount(); const count = screen.writes.length;
    if (failed) pending.reject(new Error('offline')); else pending.resolve(); await request;
    assert.equal(screen.writes.length, count); assert.deepEqual(screen.messages, []);
  }
});


test("list entrance starts after loading and purchase notices wait outside the paper until it opens", async () => {
  const view = page("A", { newPurchases: 2 });
  assert.equal(view.all().some(node => node.type === "ListScrollReveal"), false);
  await flush();
  const reveal = view.all().find(node => node.type === "ListScrollReveal");
  assert.ok(reveal);
  assert.equal(view.all().some(node => node.props.className === "ledger-notification-title"), false);
  reveal.props.onComplete();
  assert.equal(view.all().some(node => node.props.className === "ledger-notification-title"), true);
  assert.equal(JSON.stringify(reveal.props.children).includes("Good News!"), false);
  const next = page("B"); await flush();
  assert.notEqual(view.key, next.key);
  assert.ok(next.all().some(node => node.type === "ListScrollReveal"));
});
