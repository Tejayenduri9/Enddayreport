// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { getAccessToken, readServiceAccount, adminClient } from "./firebaseAdmin.js";

async function fakeServiceAccount() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]
  );
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
  return { sa: { project_id: "proj", client_email: "svc@proj.iam.gserviceaccount.com", private_key: pem, token_uri: "https://oauth2.example/token" }, publicKey: pair.publicKey };
}

test("readServiceAccount: missing secret means not configured", () => {
  assert.equal(readServiceAccount({}), null);
  assert.throws(() => readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: "{}" }));
});

test("getAccessToken sends a correctly signed request", async () => {
  const { sa, publicKey } = await fakeServiceAccount();
  globalThis.fetch = async (url, init) => {
    assert.equal(url, sa.token_uri);
    const assertion = new URLSearchParams(init.body).get("assertion");
    const [h, p, s] = assertion.split(".");
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${p}`));
    assert.ok(valid, "signature verifies with the service account's key");
    const claims = JSON.parse(Buffer.from(p, "base64url"));
    assert.equal(claims.iss, sa.client_email);
    assert.equal(claims.aud, sa.token_uri);
    return new Response(JSON.stringify({ access_token: "tok-123" }));
  };
  assert.equal(await getAccessToken(sa), "tok-123");
});

test("adminClient lists users, reads records and deletes in batches", async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(`${init.method || "GET"} ${url}`);
    assert.equal(init.headers.Authorization, "Bearer tok");
    if (url.includes("accounts:batchGet")) {
      return new Response(JSON.stringify({ users: [{ localId: "a", email: "a@x.com", createdAt: "1000" }, { localId: "d", createdAt: "2000" }] }));
    }
    if (url.includes("/documents/devices?")) {
      return new Response(JSON.stringify({ documents: [{ name: "x/documents/devices/d", fields: { status: { stringValue: "pending" }, createdAt: { timestampValue: "2026-10-20T00:00:00Z" } } }] }));
    }
    return new Response("{}");
  };
  const admin = adminClient({ project_id: "proj" }, "tok");
  assert.deepEqual(await admin.listAuthUsers(), [{ uid: "a", anonymous: false, createdAt: 1000 }, { uid: "d", anonymous: true, createdAt: 2000 }]);
  assert.deepEqual(await admin.listDocs("devices"), [{ id: "d", fields: { status: "pending", createdAt: Date.parse("2026-10-20T00:00:00Z") } }]);
  await admin.deleteAuthUsers(["a", "d"]);
  await admin.deleteDoc("devices", "d");
  assert.ok(calls.some((c) => c.startsWith("POST https://identitytoolkit.googleapis.com/v1/projects/proj/accounts:batchDelete")));
  assert.ok(calls.includes("DELETE https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/devices/d"));
});
