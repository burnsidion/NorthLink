const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the actual helper with only the network client replaced. No live
// credentials, database, browser session, or new test dependencies are needed.
function loadHelpers(client) {
  const source = fs.readFileSync("src/lib/family-group-helpers.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.equal(name, "@/lib/supabase");
      return { supabase: client };
    },
    console,
  });
  return exports;
}

const groupId = "00000000-0000-0000-0000-000000000011";

test("joining sends only a normalized invite and confirms a group ID", async () => {
  let calls = 0;
  const helpers = loadHelpers({
    rpc: async (name, params) => {
      calls++;
      assert.equal(name, "join_group_by_invite_code");
      assert.deepEqual(Object.keys(params), ["p_invite_code"]);
      assert.equal(params.p_invite_code, "ABCDEFGH");
      return { data: groupId, error: null };
    },
  });
  assert.equal(await helpers.joinFamilyGroup("  abcdefgh  "), groupId);
  assert.equal(calls, 1);
});

test("old group IDs and malformed codes never reach the backend", async () => {
  const helpers = loadHelpers({ rpc: () => assert.fail("Unexpected network request") });
  for (const code of ["", groupId, "ABCD", "ABCDEFGHI", "00000000", "' OR 1=1"]) {
    await assert.rejects(helpers.joinFamilyGroup(code), /8-character invite code/);
  }
});

test("backend rejection and network failures are not reported as success", async () => {
  const denied = loadHelpers({ rpc: async () => ({ data: null, error: new Error("Invalid invite code.") }) });
  await assert.rejects(denied.joinFamilyGroup("ABCDEFGH"), /Invalid invite code/);
  const offline = loadHelpers({ rpc: async () => { throw new Error("Network unavailable"); } });
  await assert.rejects(offline.joinFamilyGroup("ABCDEFGH"), /Network unavailable/);
});

test("a missing or malformed success response requires confirmation", async () => {
  for (const data of [null, {}, "not-a-group", "------------------------------------"]) {
    const helpers = loadHelpers({ rpc: async () => ({ data, error: null }) });
    await assert.rejects(helpers.joinFamilyGroup("ABCDEFGH"), /Could not confirm/);
  }
});

function membershipClient(result) {
  const query = {
    select: () => query,
    eq: () => query,
    limit: () => query,
    maybeSingle: async () => result,
  };
  return { from: () => query };
}

test("membership exposes the actual short invite rather than the group ID", async () => {
  const helpers = loadHelpers(membershipClient({
    data: { group_id: groupId, role: "member", groups: { name: "Test family", invite_code: "ABCDEFGH" } },
    error: null,
  }));
  const membership = await helpers.getUserGroupMembership("test-user");
  assert.equal(membership.group_id, groupId);
  assert.equal(membership.invite_code, "ABCDEFGH");
});

test("membership lookup failures do not masquerade as having no family", async () => {
  const helpers = loadHelpers(membershipClient({ data: null, error: new Error("Permission denied") }));
  await assert.rejects(helpers.getUserGroupMembership("test-user"), /Permission denied/);
});
