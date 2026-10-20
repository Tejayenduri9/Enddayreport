import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, browserLocalPersistence } from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig";

// The kiosk uses its own Firebase app instance so its login is stored
// separately from the admin dashboard's. The kiosk stays signed in on the
// device (local persistence); the admin login is session-only (firebase.js).
const app = initializeApp(firebaseConfig, "kiosk");

export const db = getFirestore(app);
export const kioskAuth = initializeAuth(app, { persistence: browserLocalPersistence });
