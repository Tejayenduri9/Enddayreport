// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { planCleanup, LIMITS } from "./cleanup.js";

const NOW = Date.UTC(2026, 9, 20, 12);
const ago = (ms) => NOW - ms;
const MIN = 60 * 1000;
const owners = ["owner-1"];

const plan = (state) => {
  const r = planCleanup({ authUsers: [], users: [], devices: [], ownerUids: owners, now: NOW, ...state });
  return { accounts: r.accounts.sort(), userDocs: r.userDocs.sort(), deviceDocs: r.deviceDocs.sort() };
};
const none = { accounts: [], userDocs: [], deviceDocs: [] };

test("keeps approved admins and devices", () => {
  assert.deepEqual(plan({
    authUsers: [{ uid: "a1", createdAt: ago(LIMITS.pendingPerson * 9) }, { uid: "d1", anonymous: true, createdAt: ago(LIMITS.pendingDevice * 9) }],
    users: [{ id: "a1", role: "admin", createdAt: ago(LIMITS.pendingPerson * 9) }],
    devices: [{ id: "d1", status: "approved", createdAt: ago(LIMITS.pendingDevice * 9) }],
  }), none);
});

test("never touches owners, even declined or without a record", () => {
  assert.deepEqual(plan({
    authUsers: [{ uid: "owner-1", createdAt: ago(LIMITS.orphanPerson * 9) }],
    users: [{ id: "owner-1", role: "rejected", createdAt: ago(1) }],
  }), none);
  assert.deepEqual(plan({ authUsers: [{ uid: "owner-1", createdAt: ago(LIMITS.orphanPerson * 9) }] }), none);
});

test("deletes a declined person's login and record right away", () => {
  assert.deepEqual(plan({
    authUsers: [{ uid: "p1", createdAt: ago(5 * MIN) }],
    users: [{ id: "p1", role: "rejected", createdAt: ago(5 * MIN) }],
  }), { accounts: ["p1"], userDocs: ["p1"], deviceDocs: [] });
});

test("deletes declined and disconnected devices right away", () => {
  assert.deepEqual(plan({
    authUsers: [{ uid: "d1", anonymous: true, createdAt: ago(MIN) }, { uid: "d2", anonymous: true, createdAt: ago(MIN) }],
    devices: [{ id: "d1", status: "rejected", createdAt: ago(MIN) }, { id: "d2", status: "removed", createdAt: ago(MIN) }],
  }), { accounts: ["d1", "d2"], userDocs: [], deviceDocs: ["d1", "d2"] });
});

test("waiting requests are kept until they expire", () => {
  const state = (age) => ({
    authUsers: [{ uid: "p1", createdAt: ago(age.p) }, { uid: "d1", anonymous: true, createdAt: ago(age.d) }],
    users: [{ id: "p1", role: "pending", createdAt: ago(age.p) }],
    devices: [{ id: "d1", status: "pending", createdAt: ago(age.d) }],
  });
  assert.deepEqual(plan(state({ p: LIMITS.pendingPerson - MIN, d: LIMITS.pendingDevice - MIN })), none);
  assert.deepEqual(plan(state({ p: LIMITS.pendingPerson + MIN, d: LIMITS.pendingDevice + MIN })),
    { accounts: ["d1", "p1"], userDocs: ["p1"], deviceDocs: ["d1"] });
});

test("cleans up leftover logins with no request, after a grace period", () => {
  const authUsers = (age) => [{ uid: "d1", anonymous: true, createdAt: ago(age) }, { uid: "p1", createdAt: ago(age) }];
  assert.deepEqual(plan({ authUsers: authUsers(LIMITS.orphanDevice - MIN) }), none);
  assert.deepEqual(plan({ authUsers: authUsers(LIMITS.orphanDevice + MIN) }), { accounts: ["d1"], userDocs: [], deviceDocs: [] });
  assert.deepEqual(plan({ authUsers: authUsers(LIMITS.orphanPerson + MIN) }), { accounts: ["d1", "p1"], userDocs: [], deviceDocs: [] });
});

test("removes records whose login is gone, but not brand-new ones", () => {
  assert.deepEqual(plan({
    users: [{ id: "old", role: "admin", createdAt: ago(LIMITS.missingLogin + MIN) }, { id: "new", role: "pending", createdAt: ago(MIN) }],
    devices: [{ id: "dOld", status: "approved", createdAt: ago(LIMITS.missingLogin + MIN) }, { id: "dNew", status: "pending", createdAt: null }],
  }), { accounts: [], userDocs: ["old"], deviceDocs: ["dOld"] });
});
