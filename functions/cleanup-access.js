// Removes logins and access records that shouldn't be in Firebase: declined or
// removed people/devices, requests left unapproved too long, and leftover
// device logins. Called by the admin dashboard on load and after each
// decline/remove (see server/cleanup.js for the rules).
import { requireUser } from "../server/auth.js";
import { planCleanup } from "../server/cleanup.js";
import { adminClient, getAccessToken, readServiceAccount } from "../server/firebaseAdmin.js";
import { OWNER_UIDS } from "../src/accessConfig.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function onRequest(context) {
  if (context.request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const user = await requireUser(context, ["admin"]);
  if (user instanceof Response) return user;

  try {
    const sa = readServiceAccount(context.env);
    if (!sa) return json({ skipped: "FIREBASE_SERVICE_ACCOUNT is not set" }, 503);

    const admin = adminClient(sa, await getAccessToken(sa));
    const [authUsers, userDocs, deviceDocs] = await Promise.all([
      admin.listAuthUsers(),
      admin.listDocs("users"),
      admin.listDocs("devices"),
    ]);

    const plan = planCleanup({
      authUsers,
      users: userDocs.map((d) => ({ id: d.id, role: d.fields.role, createdAt: d.fields.createdAt })),
      devices: deviceDocs.map((d) => ({ id: d.id, status: d.fields.status, createdAt: d.fields.createdAt })),
      ownerUids: OWNER_UIDS,
    });

    // Records first, then logins, so nobody is left with a record pointing nowhere.
    await Promise.all([
      ...plan.userDocs.map((id) => admin.deleteDoc("users", id)),
      ...plan.deviceDocs.map((id) => admin.deleteDoc("devices", id)),
    ]);
    if (plan.accounts.length) await admin.deleteAuthUsers(plan.accounts);

    return json({ deletedLogins: plan.accounts.length, deletedPeople: plan.userDocs.length, deletedDevices: plan.deviceDocs.length });
  } catch (err) {
    console.error("cleanup-access failed:", err);
    return json({ error: "Cleanup failed" }, 500);
  }
}
