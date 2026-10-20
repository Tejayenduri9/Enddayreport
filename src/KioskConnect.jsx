import { useState } from "react";
import { AuthScreen, LoadingScreen, Spinner } from "./authUi";
import { Icons } from "./icons";

const ADMIN_PATH = "/admin";

const formatCode = (code = "") => (
  <>{code.slice(0, 3)}<span>-</span>{code.slice(3)}</>
);

/**
 * The iPad's opening screens until it's connected: welcome, waiting for
 * approval (with the pairing code), and disconnected / declined.
 */
export default function KioskConnect({ device }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(
        err?.code === "auth/admin-restricted-operation" || err?.code === "auth/operation-not-allowed"
          ? "Connecting devices isn't switched on yet. Ask the owner to turn on Anonymous sign-in in Firebase."
          : "Couldn't connect. Check the internet connection and try again."
      );
    }
    setBusy(false);
  };

  const dashboardUrl = `${window.location.host}${ADMIN_PATH}`;

  if (device.status === "loading" || (busy && device.status !== "pending")) {
    return <LoadingScreen />;
  }

  if (device.status === "pending") {
    return (
      <AuthScreen subtitle="Connect this iPad">
        <div className="au-icon">{Icons.clock}</div>
        <h1 className="au-h">Waiting for approval</h1>
        <p className="au-p">Ask the owner or a manager to approve this iPad. It only needs to be done once.</p>

        <div className="au-code-box" aria-label={`Pairing code ${device.code}`}>
          <div className="au-code-label">Pairing code</div>
          <div className="au-code">{formatCode(device.code)}</div>
        </div>

        <ol className="au-steps">
          <li><span>On a phone or computer, open <strong>{dashboardUrl}</strong> and sign in.</span></li>
          <li><span>Open <strong>Team &amp; devices</strong> from the profile menu.</span></li>
          <li><span>Check the code matches, then tap <strong>Approve</strong>.</span></li>
        </ol>

        <div className="au-live" role="status">
          <span className="au-dot" aria-hidden="true" />
          This screen continues on its own once approved.
        </div>

        <div className="au-foot" style={{ marginTop: 20 }}>
          <button className="au-link muted" onClick={() => run(device.startOver)} disabled={busy}>
            Cancel and start over
          </button>
        </div>
      </AuthScreen>
    );
  }

  if (device.status === "error") {
    return (
      <AuthScreen subtitle="Daily report">
        <div className="au-icon warn">{Icons.wifiOff}</div>
        <h1 className="au-h">Can&apos;t reach the server</h1>
        <p className="au-p">Check that this iPad is connected to the internet, then try again.</p>
        <div className="au-stack">
          <button className="au-btn primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </AuthScreen>
    );
  }

  const disconnected = device.status === "removed" || device.status === "rejected";

  return (
    <AuthScreen subtitle="Daily report">
      <div className={`au-icon${disconnected ? " warn" : ""}`}>{disconnected ? Icons.unplug : Icons.tablet}</div>
      <h1 className="au-h">{disconnected ? "This iPad isn't connected" : "Set up this iPad"}</h1>
      <p className="au-p">
        {device.status === "rejected"
          ? "The request to connect this iPad was declined. You can send a new one."
          : device.status === "removed"
            ? "This iPad was disconnected from the admin dashboard. Connect it again to keep entering reports."
            : "Connect this iPad to your restaurant so staff can enter the end-of-day report. You'll get a code for the owner to approve."}
      </p>

      <div className="au-stack">
        {error && <div className="au-alert error" role="alert">{error}</div>}
        <button className="au-btn primary" onClick={() => run(device.connect)} disabled={busy}>
          {busy ? <Spinner /> : null}
          {disconnected ? "Connect again" : "Connect this iPad"}
        </button>
      </div>

      <div className="au-divider" />
      <div className="au-foot">
        Owner or manager?
        <a className="au-link" href={ADMIN_PATH}>Open the dashboard</a>
      </div>
    </AuthScreen>
  );
}
