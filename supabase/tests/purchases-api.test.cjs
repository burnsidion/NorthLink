const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(rpc) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("src/lib/purchases-api.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if(name === '@/lib/item-image') return require('./helpers/load-product-lookup.cjs').load('src/lib/item-image.ts');
      assert.equal(name, "@/lib/supabase");
      return { supabase: { rpc } };
    },
  });
  return exports;
}
const row = {
  id: "00000000-0000-0000-0000-000000000201", title: "Gift",
  price_cents: null, link: null, notes: null, most_wanted: false,
  list_title: "Family list", list_owner_name: "Owner",
};
test("requests current user's purchases without client-supplied identity", async () => {
  const helper = load(async (...args) => {
    assert.deepEqual(args, ["get_my_purchases"]);
    return { data: [row], error: null };
  });
  const result = await helper.getMyPurchases();
  assert.equal(result.length, 1);
  assert.equal(result[0].list_owner_name, "Owner");
});
test("empty purchases is a successful empty state", async () => {
  assert.equal((await load(async () => ({ data: [], error: null })).getMyPurchases()).length, 0);
});
test("only documented fields reach screen state", async () => {
  const helper = load(async () => ({ data: [{ ...row, buyer_user_id: "unexpected" }], error: null }));
  const result = await helper.getMyPurchases();
  assert.equal("buyer_user_id" in result[0], false);
});
test("invalid responses do not masquerade as an empty purchase history", async () => {
  for (const data of [null, {}, [null], [{ ...row, id: "wrong" }],
    [{ ...row, price_cents: -1 }], [{ ...row, price_cents: 1.5 }],
    [{ ...row, list_title: null }], [{ ...row, most_wanted: "yes" }]]) {
    await assert.rejects(load(async () => ({ data, error: null })).getMyPurchases(), /Could not read/);
  }
});
test("permission errors and network failures propagate", async () => {
  await assert.rejects(load(async () => ({ data: null, error: new Error("Sign in") })).getMyPurchases(), /Sign in/);
  await assert.rejects(load(async () => { throw new Error("Offline"); }).getMyPurchases(), /Offline/);
});

test('purchase thumbnails are carried safely without accepting invalid image URLs', async () => {
 for (const [image_url, expected] of [['https://cdn.example/gift.jpg','https://cdn.example/gift.jpg'],['javascript:alert(1)',null],[null,null]]) {
  const result=await load(async()=>({data:[{...row,image_url}],error:null})).getMyPurchases();
  assert.equal(result[0].image_url,expected);
 }
});
