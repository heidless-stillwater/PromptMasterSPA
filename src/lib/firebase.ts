import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Modernized Architecture Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCXrNmotaqXMyESMn1-wXdCjXdAzwQQAJo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'heidless-apps-0.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'heidless-apps-0',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'heidless-apps-0.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '15797328912',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:15797328912:web:2007641065dcf1fc3cbe95',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-GNR7FZVGR8'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Multi-Authority Architecture Mapping (Project-Scoped Named Databases)
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || 'promptmaster-spa-db-0');
export const registryDb = getFirestore(app, 'prompttool-db-0');        // Shared Authority (Community Hub / leagueEntries)
export const toolDb = registryDb;                                       // Alias for legacy compatibility
export const resourcesDb = getFirestore(app, 'promptresources-db-0'); // Reference Library
export const accDb = getFirestore(app, 'promptaccreditation-db-0');    // Sovereign Registry (Compliance Engine)

export const storage = getStorage(app);
export default app;
