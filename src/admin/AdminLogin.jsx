import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import logo from "../assets/logo.png";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (evt) => {
    evt.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged in AdminApp will pick this up and render the dashboard
    } catch (err) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Incorrect email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="ad-lock-screen">
      <div className="ad-lock-card">
        <div className="ad-lock-header">
          {logo && <img src={logo} alt="logo" style={{ width: 100, marginBottom: 10, borderRadius: "10px" }} />}
          <div className="ad-lock-title">Restaurant Sales</div>
          <div className="ad-lock-sub">Admin Dashboard</div>
        </div>
        <form className="ad-lock-body" onSubmit={handleLogin}>
          <label className="ad-lock-label">Email</label>
          <input
            className="ad-lock-input-text"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@restaurant.com"
            required
          />
          <label className="ad-lock-label">Password</label>
          <input
            className="ad-lock-input-text"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <div className="ad-lock-error">⚠️ {error}</div>}
          <button className="ad-btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
