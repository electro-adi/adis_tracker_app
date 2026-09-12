import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import { setLogLevel } from "firebase/app";
const env = window.__ENV__ || import.meta.env;

setLogLevel('debug');

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
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