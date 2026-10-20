import { useState } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { AuthScreen, Spinner } from "../authUi";

const MIN_PASSWORD = 8;

function messageFor(err) {
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match. Check them and try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return `Choose a password with at least ${MIN_PASSWORD} characters.`;
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/admin-restricted-operation":
    case "auth/operation-not-allowed":
      return "Creating accounts isn't switched on yet. Ask an admin to enable it.";
    case "auth/network-request-failed":
      return "Can't reach the server. Check your internet connection.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Admin "front door": sign in, create an account, or reset a password. */
export default function AdminAuth({ onCreateAccount }) {
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setError("");
    setNotice("");

    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setError(`Choose a password with at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === "signup") {
        await onCreateAccount(name.trim(), email.trim(), password);
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        // Same message whether or not the account exists.
        setNotice(`If ${email.trim()} has an account, a reset link is on its way. Check your inbox and spam folder.`);
      }
    } catch (err) {
      console.error(err);
      setError(messageFor(err));
    }
    setLoading(false);
  };

  const submitLabel = { signin: "Sign in", signup: "Create account", reset: "Send reset link" }[mode];

  return (
    <AuthScreen subtitle="Admin dashboard">
      {mode === "reset" ? (
        <>
          <h1 className="au-h">Reset your password</h1>
          <p className="au-p">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
        </>
      ) : (
        <div className="au-tabs" role="tablist" aria-label="Sign in or create an account">
          <button type="button" role="tab" className="au-tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>
            Sign in
          </button>
          <button type="button" role="tab" className="au-tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>
            Create account
          </button>
        </div>
      )}

      <form className="au-stack" style={mode === "reset" ? undefined : { marginTop: 0 }} onSubmit={handleSubmit} noValidate>
        {mode === "signup" && (
          <div className="au-field">
            <label className="au-label" htmlFor="au-name">Your name</label>
            <input id="au-name" className="au-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
        )}

        <div className="au-field">
          <label className="au-label" htmlFor="au-email">Email</label>
          <input
            id="au-email"
            className="au-input"
            type="email"
            inputMode="email"
            autoComplete={mode === "signup" ? "email" : "username"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {mode !== "reset" && (
          <div className="au-field">
            <label className="au-label" htmlFor="au-password">
              Password
              {mode === "signin" && (
                <button type="button" className="au-link" style={{ fontSize: 13, padding: 0 }} onClick={() => switchMode("reset")}>
                  Forgot password?
                </button>
              )}
            </label>
            <input
              id="au-password"
              className="au-input"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === "signup" ? "au-password-hint" : undefined}
              required
            />
            {mode === "signup" && <div id="au-password-hint" className="au-hint">At least {MIN_PASSWORD} characters.</div>}
          </div>
        )}

        {mode === "signup" && (
          <div className="au-alert info">An admin approves new accounts before they can see any reports.</div>
        )}
        {error && <div className="au-alert error" role="alert">{error}</div>}
        {notice && <div className="au-alert success" role="status">{notice}</div>}

        <button
          className="au-btn primary"
          type="submit"
          disabled={loading || !email.trim() || (mode !== "reset" && !password) || (mode === "signup" && !name.trim())}
        >
          {loading && <Spinner />}
          {submitLabel}
        </button>
      </form>

      {mode === "reset" && (
        <div className="au-foot" style={{ marginTop: 18 }}>
          <button type="button" className="au-link" onClick={() => switchMode("signin")}>Back to sign in</button>
        </div>
      )}

      <div className="au-divider" />
      <div className="au-foot">
        Setting up a device for reports?
        <a className="au-link" href="/">Open the daily report</a>
      </div>
    </AuthScreen>
  );
}
