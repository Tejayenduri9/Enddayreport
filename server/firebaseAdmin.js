// Minimal Firebase admin access for Pages Functions, using the service account
// key stored in the Cloudflare secret FIREBASE_SERVICE_ACCOUNT (the JSON file
// from Firebase console -> Project settings -> Service accounts). Admin calls
// bypass firestore.rules, so only use this after requireUser(..., ["admin"]).

const SCOPES = "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit";

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlJson = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

function pemToPkcs8(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

export function readServiceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing fields");
  return sa;
}

// OAuth access token for the service account (signed JWT -> token exchange).
export async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT" })}.${b64urlJson({
    iss: sa.client_email, scope: SCOPES, aud: tokenUri, iat: now, exp: now + 3600,
  })}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Service account token request failed (${res.status})`);
  return (await res.json()).access_token;
}

export function adminClient(sa, accessToken) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const authBase = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}`;
  const docsBase = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

  const call = async (url, init = {}) => {
    const res = await fetch(url, { ...init, headers: { ...auth, ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`${init.method || "GET"} ${url.split("?")[0]} failed (${res.status})`);
    return res.status === 204 ? null : res.json();
  };

  return {
    // All Firebase Auth users: [{ uid, anonymous, createdAt }]
    async listAuthUsers() {
      const out = [];
      let pageToken = "";
      do {
        const page = await call(`${authBase}/accounts:batchGet?maxResults=1000${pageToken ? `&nextPageToken=${encodeURIComponent(pageToken)}` : ""}`);
        for (const u of page.users || []) {
          out.push({ uid: u.localId, anonymous: !u.email && !(u.providerUserInfo || []).length, createdAt: Number(u.createdAt) || 0 });
        }
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      return out;
    },

    async deleteAuthUsers(uids) {
      for (let i = 0; i < uids.length; i += 1000) {
        await call(`${authBase}/accounts:batchDelete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localIds: uids.slice(i, i + 1000), force: true }),
        });
      }
    },

    // All docs in a top-level collection: [{ id, fields }] (fields as plain values)
    async listDocs(collection) {
      const out = [];
      let pageToken = "";
      do {
        const page = await call(`${docsBase}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
        for (const d of page.documents || []) {
          const fields = {};
          for (const [k, v] of Object.entries(d.fields || {})) {
            fields[k] = v.stringValue ?? (v.timestampValue ? Date.parse(v.timestampValue) : null);
          }
          out.push({ id: d.name.split("/").pop(), fields });
        }
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      return out;
    },

    deleteDoc(collection, id) {
      return call(`${docsBase}/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
