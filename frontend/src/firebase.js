import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, push } from "firebase/database";
import { setLogLevel } from "firebase/app";
setLogLevel('debug');

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
console.log('[FIREBASE] apps:', getApps().length, 'options:', app.options)
export const db = getDatabase(app);


export function monitorConnection() {
  const connRef = ref(db, ".info/connected");
  return onValue(connRef, snap => {
    console.log('[DB] .info/connected ->', snap.val());
  }, err => {
    console.error('[DB] .info/connected error', err);
  });
}