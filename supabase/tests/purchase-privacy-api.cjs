// Talks only through docker exec to the disposable test container's loopback.
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const container = process.argv[2];
assert.match(container ?? "", /^northlink-owl58-privacy-\d+$/);
const secret = "northlink-local-privacy-test-secret-not-a-real-credential";
function token(user) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = encode({ alg: "HS256", typ: "JWT" }) + "." +
    encode({ role: "authenticated", sub: user, exp: Math.floor(Date.now() / 1000) + 60 });
  return body + "." + crypto.createHmac("sha256", secret).update(body).digest("base64url");
}
const id = n => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
function request(path, { user, body, schema } = {}) {
  const args = ["exec", container, "curl", "-sS", "-w", "\n%{http_code}",
    "http://127.0.0.1:3000/" + path];
  if (user) args.push("-H", "Authorization: Bearer " + token(user));
  if (schema) args.push("-H", "Accept-Profile: " + schema, "-H", "Content-Profile: " + schema);
  if (body !== undefined) args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  const output = execFileSync("docker", args, { encoding: "utf8" });
  const split = output.lastIndexOf("\n");
  return { status: Number(output.slice(split + 1)), data: JSON.parse(output.slice(0, split)) };
}
const signedOut = request("items?select=*");
assert.equal(signedOut.status, 200);
assert.equal(signedOut.data.length, 0);
const owner = request("items?select=*", { user: id(1) });
assert.equal(owner.status, 200);
assert.ok(owner.data.length > 0);
assert.ok(owner.data.every(row => !("purchased_by" in row) && !("buyer_user_id" in row)));
assert.equal(owner.data.find(row => row.id === id(201)).purchased, true);
const filter = request("items?select=id&purchased_by=eq." + id(2), { user: id(1) });
assert.equal(filter.status, 400);
const hidden = request("item_buyers?select=*", { user: id(1), schema: "northlink_private" });
assert.equal(hidden.status, 406);
const purchases = request("rpc/get_my_purchases", { user: id(2), body: {} });
assert.equal(purchases.status, 200);
assert.equal(purchases.data.length, 1);
assert.equal(purchases.data[0].id, id(201));
const ownerPurchases = request("rpc/get_my_purchases", { user: id(1), body: {} });
assert.equal(ownerPurchases.status, 200);
assert.ok(ownerPurchases.data.every(row => row.id !== id(201)));
const spoofed = request("rpc/get_my_purchases", { user: id(1), body: { user_id: id(2) } });
assert.ok(spoofed.status >= 400);
const anonPurchases = request("rpc/get_my_purchases", { body: {} });
assert.ok([401, 403].includes(anonPurchases.status));
console.log("PostgREST privacy checks passed");
