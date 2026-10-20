// Decides which logins and access records to delete so that nobody stays in
// Firebase without access. Pure function - the Firebase calls are in
// firebaseAdmin.js / functions/cleanup-access.js.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const LIMITS = {
  pendingDevice: DAY, // unapproved device request
  pendingPerson: 30 * DAY, // unapproved account request
  orphanDevice: HOUR, // device login with no request (e.g. after "Start over")
  orphanPerson: DAY, // account login that never created its request record
  missingLogin: HOUR, // record whose login is gone (grace period avoids racing a brand-new sign-up)
};

/**
 * @param authUsers [{ uid, anonymous, createdAt (ms) }]
 * @param users     [{ id, role, createdAt (ms|null) }]   - users/{uid} records
 * @param devices   [{ id, status, createdAt (ms|null) }] - devices/{uid} records
 * @returns { accounts: uid[], userDocs: id[], deviceDocs: id[] } to delete
 */
export function planCleanup({ authUsers, users, devices, ownerUids, now = Date.now() }) {
  const owners = new Set(ownerUids);
  const accountIds = new Set(authUsers.map((u) => u.uid));
  const userById = new Map(users.map((u) => [u.id, u]));
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const age = (ms) => (ms ? now - ms : 0);

  const userDocs = users
    .filter((u) => !owners.has(u.id))
    .filter((u) =>
      (!accountIds.has(u.id) && age(u.createdAt) > LIMITS.missingLogin) || u.role === "rejected" ||
      (u.role === "pending" && age(u.createdAt) > LIMITS.pendingPerson))
    .map((u) => u.id);

  const deviceDocs = devices
    .filter((d) => !owners.has(d.id))
    .filter((d) =>
      (!accountIds.has(d.id) && age(d.createdAt) > LIMITS.missingLogin) || d.status === "rejected" || d.status === "removed" ||
      (d.status === "pending" && age(d.createdAt) > LIMITS.pendingDevice))
    .map((d) => d.id);

  // A login goes once none of its records are left (or it never made one).
  const leaving = new Set([...userDocs, ...deviceDocs]);
  const keepsARecord = (uid) =>
    (userById.has(uid) && !userDocs.includes(uid)) || (deviceById.has(uid) && !deviceDocs.includes(uid));

  const accounts = authUsers
    .filter((a) => !owners.has(a.uid) && !keepsARecord(a.uid))
    .filter((a) => leaving.has(a.uid) || age(a.createdAt) > (a.anonymous ? LIMITS.orphanDevice : LIMITS.orphanPerson))
    .map((a) => a.uid);

  return { accounts, userDocs, deviceDocs };
}
