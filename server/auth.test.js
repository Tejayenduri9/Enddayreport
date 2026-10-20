// Run with: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { requireUser, escapeHtml, ownerEmails } from "./auth.js";

const PROJECT_ID = "invoice-bded6";
const env = { KIOSK_EMAIL: "kiosk@example.com", ADMIN_EMAILS: "owner@example.com, Manager@Example.com" };

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
    sub: "user-1", email: "kiosk@example.com", iat: now - 10, exp: now + 3600, ...claims,
  });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

const contextWith = (token) => ({
  env,
  request: new Request("https://example.com/x", { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
});

before(async () => {
  signingKey = await makeKey("key-1");
  otherKey = await makeKey("key-2"); // not published - stands in for a forged token
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [signingKey.jwk] }), {
    headers: { "cache-control": "public, max-age=3600" },
  });
});

test("accepts the kiosk account", async () => {
  assert.deepEqual(await requireUser(contextWith(await makeToken())), { email: "kiosk@example.com", role: "kiosk" });
});

test("accepts admin accounts, case-insensitively", async () => {
  const user = await requireUser(contextWith(await makeToken({ email: "manager@example.com" })));
  assert.deepEqual(user, { email: "manager@example.com", role: "admin" });
});

test("rejects a request with no login", async () => {
  assert.equal((await requireUser(contextWith(null))).status, 401);
});

test("rejects a token signed with an unknown key", async () => {
  assert.equal((await requireUser(contextWith(await makeToken({}, { key: otherKey })))).status, 401);
});

test("rejects a tampered token", async () => {
  const [h, , s] = (await makeToken()).split(".");
  const forgedPayload = encodeJson({ aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, sub: "x", email: "owner@example.com", iat: 0, exp: 9999999999 });
  assert.equal((await requireUser(contextWith(`${h}.${forgedPayload}.${s}`))).status, 401);
});

test("rejects an expired token", async () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal((await requireUser(contextWith(await makeToken({ iat: now - 7200, exp: now - 3600 })))).status, 401);
});

test("rejects a token from another Firebase project", async () => {
  assert.equal((await requireUser(contextWith(await makeToken({ aud: "some-other-project" })))).status, 401);
});

test("rejects a valid login that isn't the kiosk or an admin", async () => {
  assert.equal((await requireUser(contextWith(await makeToken({ email: "stranger@example.com" })))).status, 403);
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
