const isKaravalli = import.meta.env.VITE_FIREBASE_PROJECT === 'karavalli';

const spiceConfig = {
  apiKey: "AIzaSyCTA4j83zlxBSU3lrXiL43LxQpM7QB1ZKA",
  authDomain: "invoice-bded6.firebaseapp.com",
  projectId: "invoice-bded6",
  storageBucket: "invoice-bded6.firebasestorage.app",
  messagingSenderId: "1072275972159",
  appId: "1:1072275972159:web:773cb82812c1bf3308188a"
};

const karavalliConfig = {
  apiKey: "AIzaSyDzLLdmpWb3ygeITIl_3qNAsyDQ8WoGsEo",
  authDomain: "karavalli-7eae2.firebaseapp.com",
  projectId: "karavalli-7eae2",
  storageBucket: "karavalli-7eae2.firebasestorage.app",
  messagingSenderId: "466622468225",
  appId: "1:466622468225:web:d1efb54c424b8de8e87d80"
};

export const firebaseConfig = isKaravalli ? karavalliConfig : spiceConfig;
