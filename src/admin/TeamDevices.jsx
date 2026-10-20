import { useEffect, useState } from "react";
import { collection, onSnapshot, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { OWNER_UIDS } from "../accessConfig";
import "./team.css";

const toDate = (ts) => (ts?.toDate ? ts.toDate() : null);

function timeAgo(ts) {
  const date = toDate(ts);
  if (!date) return "just now";
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const shortDate = (ts) =>
  toDate(ts)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "";

const formatCode = (code = "") => `${code.slice(0, 3)}-${code.slice(3)}`;

const byNewest = (a, b) => (toDate(b.createdAt)?.getTime() || Date.now()) - (toDate(a.createdAt)?.getTime() || Date.now());

function ConfirmRow({ message, action, busy, onCancel, onConfirm }) {
  return (
    <div className="tm-confirm">
      <span>{message}</span>
      <div className="tm-actions">
        <button className="tm-btn ghost" onClick={onCancel}>Cancel</button>
        <button className="tm-btn danger" disabled={busy} onClick={onConfirm}>{action}</button>
      </div>
    </div>
  );
}

/** Approve / remove admin accounts and connected iPads. */
export default function TeamDevices({ user, onBack }) {
  const [people, setPeople] = useState(null);
  const [devices, setDevices] = useState(null);
  const [deviceNames, setDeviceNames] = useState({});
  const [confirming, setConfirming] = useState(null); // "device:<id>" | "user:<id>"
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onErr = (err) => {
      console.error(err);
      setError("Couldn't load the list. Check your connection and refresh the page.");
    };
    const unsubPeople = onSnapshot(collection(db, "users"), (snap) => setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    const unsubDevices = onSnapshot(collection(db, "devices"), (snap) => setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    return () => { unsubPeople(); unsubDevices(); };
  }, []);

  const review = async (collectionName, id, changes) => {
    setError("");
    setBusyId(id);
    try {
      await updateDoc(doc(db, collectionName, id), { ...changes, reviewedAt: serverTimestamp(), reviewedBy: user.email });
      setConfirming(null);
    } catch (err) {
      console.error(err);
      setError("That didn't save. Please try again.");
    }
    setBusyId(null);
  };

  const pendingDevices = (devices || []).filter((d) => d.status === "pending").sort(byNewest);
  const connectedDevices = (devices || []).filter((d) => d.status === "approved").sort(byNewest);
  const pendingPeople = (people || []).filter((p) => p.role === "pending").sort(byNewest);
  const admins = (people || []).filter((p) => p.role === "admin" || OWNER_UIDS.includes(p.id))
    .sort((a, b) => (OWNER_UIDS.includes(b.id) - OWNER_UIDS.includes(a.id)) || (a.name || "").localeCompare(b.name || ""));

  const loading = people === null || devices === null;

  return (
    <>
      <div className="ad-panel-title-row" style={{ marginBottom: 12 }}>
        <div>
          <div className="tm-page-title">Team &amp; devices</div>
          <div className="tm-page-sub">Approve who can open this dashboard and which iPads can enter reports.</div>
        </div>
        <button className="ad-back-btn ad-back-btn-solid" onClick={onBack}>← Back to Dashboard</button>
      </div>

      {error && <div className="ad-error-banner">⚠️ {error}</div>}
      {loading && !error && <div className="ad-panel tm-empty">Loading…</div>}

      {!loading && (
        <>
          {/* ---- iPads ---- */}
          <section className="ad-panel">
            <div className="tm-section-head">
              <h2 className="tm-h">iPads</h2>
              <span className="tm-count">{connectedDevices.length} connected</span>
            </div>

            {pendingDevices.map((d) => (
              <div key={d.id} className="tm-request">
                <div className="tm-request-main">
                  <div className="tm-tag">Waiting for approval</div>
                  <div className="tm-code" aria-label={`Pairing code ${d.code}`}>{formatCode(d.code)}</div>
                  <div className="tm-meta">{d.platform || "Device"} · requested {timeAgo(d.createdAt)}</div>
                  <div className="tm-hint">Only approve if this matches the code on the iPad.</div>
                </div>
                <div className="tm-request-side">
                  <label className="tm-label" htmlFor={`name-${d.id}`}>Name this iPad</label>
                  <input
                    id={`name-${d.id}`}
                    className="tm-input"
                    placeholder="e.g. Front counter iPad"
                    maxLength={40}
                    value={deviceNames[d.id] ?? ""}
                    onChange={(e) => setDeviceNames((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  />
                  <div className="tm-actions">
                    <button className="tm-btn ghost" disabled={busyId === d.id} onClick={() => review("devices", d.id, { status: "rejected" })}>Decline</button>
                    <button
                      className="tm-btn primary"
                      disabled={busyId === d.id}
                      onClick={() => review("devices", d.id, { status: "approved", name: (deviceNames[d.id] || "").trim() || "iPad" })}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {connectedDevices.length === 0 && pendingDevices.length === 0 && (
              <div className="tm-empty">
                No iPads connected yet. On the iPad, open <strong>{window.location.host}</strong> and tap <strong>Connect this iPad</strong>; its code will appear here.
              </div>
            )}

            {connectedDevices.map((d) => (
              <div key={d.id} className="tm-row">
                {confirming === `device:${d.id}` ? (
                  <ConfirmRow
                    busy={busyId === d.id}
                    onCancel={() => setConfirming(null)}
                    message={`Disconnect ${d.name || "this iPad"}? It will need a new code to connect again.`}
                    action="Disconnect"
                    onConfirm={() => review("devices", d.id, { status: "removed" })}
                  />
                ) : (
                  <>
                    <div className="tm-avatar device" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>
                    </div>
                    <div className="tm-row-main">
                      <div className="tm-name">{d.name || "iPad"}</div>
                      <div className="tm-meta">{d.platform || "Device"} · connected {shortDate(d.reviewedAt)}</div>
                    </div>
                    <button className="tm-btn ghost" onClick={() => setConfirming(`device:${d.id}`)}>Disconnect</button>
                  </>
                )}
              </div>
            ))}
          </section>

          {/* ---- People ---- */}
          <section className="ad-panel">
            <div className="tm-section-head">
              <h2 className="tm-h">People</h2>
              <span className="tm-count">{admins.length} with access</span>
            </div>

            {pendingPeople.map((p) => (
              <div key={p.id} className="tm-row request">
                <div className="tm-avatar" aria-hidden="true">{(p.name || p.email || "?").charAt(0).toUpperCase()}</div>
                <div className="tm-row-main">
                  <div className="tm-name">{p.name} <span className="tm-badge wait">Requested {timeAgo(p.createdAt)}</span></div>
                  <div className="tm-meta">{p.email}</div>
                </div>
                <div className="tm-actions">
                  <button className="tm-btn ghost" disabled={busyId === p.id} onClick={() => review("users", p.id, { role: "rejected" })}>Decline</button>
                  <button className="tm-btn primary" disabled={busyId === p.id} onClick={() => review("users", p.id, { role: "admin" })}>Approve</button>
                </div>
              </div>
            ))}

            {admins.map((p) => {
              const isOwner = OWNER_UIDS.includes(p.id);
              const isYou = p.id === user.uid;
              return (
                <div key={p.id} className="tm-row">
                  {confirming === `user:${p.id}` ? (
                    <ConfirmRow
                      busy={busyId === p.id}
                      onCancel={() => setConfirming(null)}
                      message={`Remove ${p.name || p.email}'s access to the dashboard?`}
                      action="Remove access"
                      onConfirm={() => review("users", p.id, { role: "rejected" })}
                    />
                  ) : (
                    <>
                      <div className="tm-avatar" aria-hidden="true">{(p.name || p.email || "?").charAt(0).toUpperCase()}</div>
                      <div className="tm-row-main">
                        <div className="tm-name">
                          {p.name || p.email}
                          {isOwner && <span className="tm-badge owner">Owner</span>}
                          {isYou && <span className="tm-badge">You</span>}
                        </div>
                        <div className="tm-meta">{p.email}</div>
                      </div>
                      {!isOwner && !isYou && (
                        <button className="tm-btn ghost" onClick={() => setConfirming(`user:${p.id}`)}>Remove</button>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div className="tm-footnote">
              New people sign up at <strong>{window.location.host}/admin</strong> → <strong>Create account</strong>, then appear here for approval.
            </div>
          </section>
        </>
      )}
    </>
  );
}
