// Run with: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { requireUser, escapeHtml, ownerEmails } from "./auth.js";

const PROJECT_ID = "invoice-bded6";
const env = {};

// Fake Firestore: path -> fields. Only answers when the caller sends a token.
const firestore = {
  "users/admin-1": { role: { stringValue: "admin" } },
  "users/pending-1": { role: { stringValue: "pending" } },
  "devices/ipad-1": { status: { stringValue: "approved" } },
  "devices/ipad-2": { status: { stringValue: "pending" } },
};

let signingKey, otherKey;

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const encodeJson = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function makeKey(kid) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"]
  );
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid, alg: "RS256", use: "sig" };
  return { kid, privateKey: pair.privateKey, jwk };
}

async function makeToken(claims = {}, { key = signingKey, kid = key.kid } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "RS256", kid, typ: "JWT" });
  const payload = encodeJson({
    aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`,
    sub: "ipad-1", firebase: { sign_in_provider: "anonymous" }, iat: now - 10, exp: now + 3600, ...claims,
  });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

const adminClaims = { sub: "admin-1", email: "Owner@Example.com", firebase: { sign_in_provider: "password" } };

const contextWith = (token) => ({
  env,
  request: new Request("https://example.com/x", { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
});

before(async () => {
  signingKey = await makeKey("key-1");
  otherKey = await makeKey("key-2"); // not published - stands in for a forged token
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).includes("securetoken@system")) {
      return new Response(JSON.stringify({ keys: [signingKey.jwk] }), { headers: { "cache-control": "public, max-age=3600" } });
    }
    const path = String(url).split("/documents/")[1];
    if (!opts.headers?.Authorization || !firestore[path]) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ fields: firestore[path] }));
  };
});

test("accepts an approved iPad", async () => {
  assert.deepEqual(await requireUser(contextWith(await makeToken())), { uid: "ipad-1", email: "", role: "kiosk" });
});

test("accepts an approved admin", async () => {
  const user = await requireUser(contextWith(await makeToken(adminClaims)));
  assert.deepEqual(user, { uid: "admin-1", email: "owner@example.com", role: "admin" });
});

test("rejects an iPad that is still waiting for approval", async () => {
  assert.equal((await requireUser(contextWith(await makeToken({ sub: "ipad-2" })))).status, 403);
});

test("rejects an account that is still waiting for approval", async () => {
  const claims = { ...adminClaims, sub: "pending-1" };
  assert.equal((await requireUser(contextWith(await makeToken(claims)))).status, 403);
});

test("an anonymous login can never be an admin", async () => {
  const claims = { sub: "admin-1", firebase: { sign_in_provider: "anonymous" } };
  assert.equal((await requireUser(contextWith(await makeToken(claims)))).status, 403);
});

test("rejects a request with no login", async () => {
  assert.equal((await requireUser(contextWith(null))).status, 401);
});

test("rejects a token signed with an unknown key", async () => {
  assert.equal((await requireUser(contextWith(await makeToken({}, { key: otherKey })))).status, 401);
});

test("rejects a tampered token", async () => {
  const [h, , s] = (await makeToken()).split(".");
  const forgedPayload = encodeJson({ aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, sub: "admin-1", firebase: { sign_in_provider: "password" }, iat: 0, exp: 9999999999 });
  assert.equal((await requireUser(contextWith(`${h}.${forgedPayload}.${s}`))).status, 401);
});

test("rejects an expired token", async () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal((await requireUser(contextWith(await makeToken({ iat: now - 7200, exp: now - 3600 })))).status, 401);
});

test("rejects a token from another Firebase project", async () => {
  assert.equal((await requireUser(contextWith(await makeToken({ aud: "some-other-project" })))).status, 401);
});

test("rejects a valid login with no access", async () => {
  const claims = { sub: "stranger", email: "stranger@example.com", firebase: { sign_in_provider: "password" } };
  assert.equal((await requireUser(contextWith(await makeToken(claims)))).status, 403);
});

test("enforces allowed roles", async () => {
  assert.equal((await requireUser(contextWith(await makeToken()), ["admin"])).status, 403);
});

test("owner emails come from the server config", () => {
  assert.deepEqual(ownerEmails({ OWNER_EMAILS: " A@x.com, b@x.com ," }), ["a@x.com", "b@x.com"]);
  assert.deepEqual(ownerEmails({}), []);
});

test("escapeHtml neutralises markup", () => {
  assert.equal(escapeHtml(`<a href="x">Hi</a> & 'bye'`), "&lt;a href=&quot;x&quot;&gt;Hi&lt;/a&gt; &amp; &#39;bye&#39;");
});
