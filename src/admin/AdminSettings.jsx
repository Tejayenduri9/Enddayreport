import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../firebase";

export default function AdminSettings({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="ad-modal-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-modal-header">
          <div>
            <div className="ad-modal-title">Account Settings</div>
            <div className="ad-modal-subtitle">{auth.currentUser?.email}</div>
          </div>
          <button className="ad-modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="ad-settings-form" onSubmit={handleSubmit}>
          <div className="ad-settings-label">Change Password</div>

          {success ? (
            <div className="ad-settings-success">✅ Password updated successfully.</div>
          ) : (
            <>
              <input
                className="ad-lock-input-text"
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <input
                className="ad-lock-input-text"
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <input
                className="ad-lock-input-text"
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {error && <div className="ad-lock-error">⚠️ {error}</div>}
              <button className="ad-btn" type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}