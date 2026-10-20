import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig";

const app = initializeApp(firebaseConfig);
// 👉 This is what we use in app
export const db = getFirestore(app);
export const auth = getAuth(app);
// Session-only persistence: closing the tab/browser clears the login,
// so the admin dashboard always asks for credentials again on next open.
setPersistence(auth, browserSessionPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});
