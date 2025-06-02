// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDkk2AEREGmvksRhMg07wiPCtam64hKIPg",
  authDomain: "looknlink-a67f1.firebaseapp.com",
  databaseURL: "https://looknlink-a67f1-default-rtdb.firebaseio.com", // ✅ Add this line for Realtime DB
  projectId: "looknlink-a67f1",
  storageBucket: "looknlink-a67f1.appspot.com",
  messagingSenderId: "716231255221",
  appId: "1:716231255221:web:c01c4ad4ecb47d84c9cafc",
};

// Only initialize once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };
