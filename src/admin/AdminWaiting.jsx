import { useState } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { AuthScreen } from "../authUi";
import { Icons } from "../icons";

/** Shown to a signed-in account that isn't (or is no longer) an admin. */
export default function AdminWaiting({ user, access }) {
  const [verifySent, setVerifySent] = useState(false);

  if (access.status === "error") {
    return (
      <AuthScreen subtitle="Admin dashboard">
        <div className="au-icon warn">{Icons.wifiOff}</div>
        <h1 className="au-h">Can&apos;t load your account</h1>
        <p className="au-p">Check your internet connection and try again.</p>
        <div className="au-stack">
          <button className="au-btn primary" onClick={() => window.location.reload()}>Try again</button>
          <button className="au-btn secondary" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </AuthScreen>
    );
  }

  const declined = access.status === "rejected";

  const resendVerification = async () => {
    try {
      await sendEmailVerification(user);
      setVerifySent(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthScreen subtitle="Admin dashboard">
      <div className={`au-icon${declined ? " warn" : ""}`}>{declined ? Icons.lock : Icons.clock}</div>
      <h1 className="au-h">{declined ? "You don't have access" : "Waiting for approval"}</h1>
      <p className="au-p">
        {declined ? (
          <>The account <strong>{user.email}</strong> hasn&apos;t been given access to this dashboard. If you think this is a mistake, contact an admin.</>
        ) : (
          <>Thanks{access.name ? `, ${access.name}` : ""}. An admin has been asked to approve <strong>{user.email}</strong>. The dashboard will open on its own as soon as they do.</>
        )}
      </p>

      {!declined && (
        <div className="au-live" role="status">
          <span className="au-dot" aria-hidden="true" />
          You can leave this page open or come back later.
        </div>
      )}

      {!declined && !user.emailVerified && (
        <div className="au-alert info" style={{ marginTop: 14 }}>
          {verifySent ? (
            <>Verification email sent to {user.email}. Check your inbox and spam folder.</>
          ) : (
            <>
              Help the admin trust your request: confirm your email.{" "}
              <button className="au-link" style={{ padding: 0, fontSize: 14 }} onClick={resendVerification}>Send verification email</button>
            </>
          )}
        </div>
      )}

      <div className="au-stack">
        <button className="au-btn secondary" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </AuthScreen>
  );
}
