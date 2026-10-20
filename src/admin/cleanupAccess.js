import { auth } from "../firebase";
import { authedFetch } from "../authedFetch";

// Asks the server to delete declined/removed/abandoned logins from Firebase
// (functions/cleanup-access.js). Never throws; returns what happened:
// { ok: true, deletedLogins, ... } | { ok: false, notSetUp?: true, message }
export async function cleanupAccess() {
  try {
    const res = await authedFetch(auth, "/cleanup-access", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, ...body };
    if (res.status === 503) return { ok: false, notSetUp: true, message: "The FIREBASE_SERVICE_ACCOUNT key isn't set in Cloudflare." };
    console.error("Access cleanup failed:", res.status, body);
    return { ok: false, message: body.detail || `Server error ${res.status}` };
  } catch (err) {
    console.error("Access cleanup failed:", err);
    return { ok: false, message: err.message || "Couldn't reach the server" };
  }
}
