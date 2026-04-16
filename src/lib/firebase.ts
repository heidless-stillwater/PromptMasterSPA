import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'heidless-apps-0',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Triple-Database Architecture Mapping
export const db = getFirestore(app, 'promptmaster-spa-db-0');     // Registry Primary
export const toolDb = getFirestore(app, 'prompttool-db-0');        // Studio Satellite
export const resourcesDb = getFirestore(app, 'promptresources-db-0'); // Hub Satellite (Source of Truth)
export const accDb = getFirestore(app, 'promptaccreditation-db-0');   // Sovereign Registry (Compliance Engine)

export const storage = getStorage(app);
export default app;
