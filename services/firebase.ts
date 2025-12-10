
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: any;
let auth: Auth | undefined;
let db: Firestore | undefined;
let googleProvider: GoogleAuthProvider | undefined;

// Only initialize if we have an API Key. 
// This prevents the "auth/api-key-not-valid" crash loop.
if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);

    if (app) {
        auth = getAuth(app);
        
        // Initialize Firestore with explicit settings for persistence (New SDK v9+ way)
        db = initializeFirestore(app, {
           localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager()
           })
        });
    
        googleProvider = new GoogleAuthProvider();
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else {
  console.warn("Firebase API Key missing from environment. Authentication features are disabled.");
}

export { auth, db, googleProvider };
