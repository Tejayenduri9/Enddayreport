// Login check shared by every Pages Function in /functions.
//
// The browser sends the signed-in user's Firebase ID token as
// "Authorization: Bearer <token>" (see src/authedFetch.js). This verifies the
// token's signature against Google's public keys and checks it was issued for
// this Firebase project, then maps the user's email to a role using the
// Cloudflare environment variables:
//   KIOSK_EMAIL   - the kiosk device account
//   ADMIN_EMAILS  - comma-separated admin dashboard accounts

const PROJECT_ID = "invoice-bded6";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const CLOCK_SKEW_SECONDS = 60;

let cachedKeys = null;
let cachedKeysExpireAt = 0;

async function getPublicKeys() {
  if (cachedKeys && Date.now() < cachedKeysExpireAt) return cachedKeys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`Could not fetch Firebase public keys (${res.status})`);
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1] || 3600);
  cachedKeys = keys;
  cachedKeysExpireAt = Date.now() + maxAge * 1000;
  return keys;
}

const base64UrlToBytes = (str) => {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const decodeJson = (part) => JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));

// Returns the token's payload if valid, otherwise null.
async function verifyIdToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;

  let header, payload;
  try {
    header = decodeJson(headerPart);
    payload = decodeJson(payloadPart);
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  const jwk = (await getPublicKeys()).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const signedData = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(signaturePart), signedData);
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (!(payload.exp > now - CLOCK_SKEW_SECONDS)) return null;
  if (!(payload.iat <= now + CLOCK_SKEW_SECONDS)) return null;
  return payload;
}

const emailList = (value) =>
  (value || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/**
 * Checks the request's login. Returns { email, role } where role is
 * "admin" or "kiosk", or a Response (401/403) to return as-is.
 */
export async function requireUser(context, allowedRoles = ["admin", "kiosk"]) {
  const match = /^Bearer (.+)$/.exec(context.request.headers.get("Authorization") || "");
  const payload = match ? await verifyIdToken(match[1]) : null;
  if (!payload) return new Response("Unauthorized", { status: 401 });

  const email = (payload.email || "").toLowerCase();
  let role = null;
  if (emailList(context.env.ADMIN_EMAILS).includes(email)) role = "admin";
  else if (email && email === (context.env.KIOSK_EMAIL || "").trim().toLowerCase()) role = "kiosk";

  if (!role || !allowedRoles.includes(role)) return new Response("Forbidden", { status: 403 });
  return { email, role };
}

// Owner recipients configured on the server (never taken from the request).
export const ownerEmails = (env) => emailList(env.OWNER_EMAILS);

export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
