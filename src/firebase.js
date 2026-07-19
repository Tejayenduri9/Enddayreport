import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCTA4j83zlxBSU3lrXiL43LxQpM7QB1ZKA",
  authDomain: "invoice-bded6.firebaseapp.com",
  projectId: "invoice-bded6",
  storageBucket: "invoice-bded6.firebasestorage.app",
  messagingSenderId: "1072275972159",
  appId: "1:1072275972159:web:773cb82812c1bf3308188a"
};

const app = initializeApp(firebaseConfig);

// 👉 This is what we use in app
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);