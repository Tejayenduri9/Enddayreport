import { auth } from "../firebase";
import { authedFetch } from "../authedFetch";

// Asks the server to delete declined/removed/abandoned logins from Firebase
// (functions/cleanup-access.js). Best-effort: failures are only logged.
export async function cleanupAccess() {
  try {
    const res = await authedFetch(auth, "/cleanup-access", { method: "POST" });
    if (!res.ok && res.status !== 503) console.error("Access cleanup failed:", res.status);
  } catch (err) {
    console.error("Access cleanup failed:", err);
  }
}
