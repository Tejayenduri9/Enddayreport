// fetch() for our own /functions endpoints, which require a Firebase login.
// Sends the signed-in user's ID token so the server can check who is calling.
export async function authedFetch(auth, url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
}
