import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db, kioskAuth } from "./kioskFirebase";

// No 0/O or 1/I, so the code can't be misread.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makePairingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

// e.g. "iPad · Safari", shown to the admin so they can tell devices apart.
function platformLabel() {
  const ua = navigator.userAgent;
  const device =
    /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad"
      : /iPhone/.test(ua) ? "iPhone"
        : /Android/.test(ua) ? "Android"
          : /Windows/.test(ua) ? "Windows PC"
            : /Macintosh/.test(ua) ? "Mac"
              : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${device} · ${browser}` : device;
}

/**
 * Tracks whether this device is connected to the restaurant.
 *
 * A device signs in anonymously and creates devices/{uid} with a pairing code
 * (status "pending"); an admin approves it from Team & devices in the admin
 * dashboard. firestore.rules only give approved devices access to reports.
 *
 * status: "loading" | "signedOut" | "pending" | "approved" | "rejected" |
 *         "removed" | "error"
 */
export default function useDeviceAccess() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let unsubDoc = null;
    const unsubAuth = onAuthStateChanged(kioskAuth, (user) => {
      unsubDoc?.();
      unsubDoc = null;

      if (!user) {
        setState({ status: "signedOut" });
        return;
      }
      if (!user.isAnonymous) {
        // Signed in with the old shared kiosk email login - devices now
        // connect with a pairing code instead.
        signOut(kioskAuth);
        return;
      }

      unsubDoc = onSnapshot(
        doc(db, "devices", user.uid),
        (snap) => {
          if (!snap.exists()) {
            // Deleted by an admin (or not created yet - connect() handles that).
            setState({ status: "removed" });
            return;
          }
          const data = snap.data();
          setState({ status: data.status, code: data.code, name: data.name || "" });
        },
        (err) => {
          console.error("Device status check failed:", err);
          setState({ status: "error" });
        }
      );
    });
    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, []);

  // Starts a fresh connection request with a new pairing code.
  const connect = async () => {
    if (kioskAuth.currentUser) await signOut(kioskAuth);
    const { user } = await signInAnonymously(kioskAuth);
    await setDoc(doc(db, "devices", user.uid), {
      code: makePairingCode(),
      status: "pending",
      platform: platformLabel(),
      createdAt: serverTimestamp(),
    });
  };

  // Withdraws a pending request and goes back to the start.
  const startOver = async () => {
    const user = kioskAuth.currentUser;
    if (user && state.status === "pending") {
      await deleteDoc(doc(db, "devices", user.uid)).catch((err) => console.error(err));
    }
    await signOut(kioskAuth);
  };

  return { ...state, connect, startOver };
}
