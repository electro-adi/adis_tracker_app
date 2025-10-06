import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, push } from "firebase/database";
import { setLogLevel } from "firebase/app";
setLogLevel('debug');

const firebaseConfig = {
  apiKey: "AIzaSyBQMMU8S1KWDNceb-GUi79QlOOFrKhXPzo",
  authDomain: "aditracker-6ac11.firebaseapp.com",
  databaseURL: "https://aditracker-6ac11-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aditracker-6ac11",
  storageBucket: "aditracker-6ac11.firebasestorage.app",
  messagingSenderId: "318988643925",
  appId: "1:318988643925:web:28fbfd44b7320d74b06edc",
  measurementId: "G-WPQ6HJDKY4"
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