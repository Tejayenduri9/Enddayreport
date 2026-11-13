// fetch() for our own /functions endpoints, which require a Firebase login.
// Sends the signed-in user's ID token so the server can check who is calling.
//
// A timeout is enforced so a slow or unresponsive backend can never leave the
// UI stuck on a spinner forever — the request aborts and the caller's catch
// block runs, showing an error the user can act on instead of a dead page.
export async function authedFetch(auth, url, options = {}, timeoutMs = 120000) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        "The request took too long and was stopped. Your report may not have been sent — " +
        "please check your email, and if it didn't arrive, contact the EndDay Reports admin at enddayreports.com."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
