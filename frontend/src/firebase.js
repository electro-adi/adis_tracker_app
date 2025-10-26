import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import { setLogLevel } from "firebase/app";

setLogLevel('debug');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
console.log('[FIREBASE] apps:', getApps().length, 'options:', app.options);

export const db = getDatabase(app);

export function monitorConnection() {
  const connRef = ref(db, ".info/connected");
  return onValue(connRef, snap => {
    console.log('[DB] .info/connected ->', snap.val());
  }, err => {
    console.error('[DB] .info/connected error', err);
  });
}