
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  enableIndexedDbPersistence, 
  initializeFirestore,
  CACHE_SIZE_UNLIMITED 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDOr4USQd6B_u-h0ent9ZLQoKEguJBAqNg",
  authDomain: "learnmate-ai-1e305.firebaseapp.com",
  projectId: "learnmate-ai-1e305",
  storageBucket: "learnmate-ai-1e305.firebasestorage.app",
  messagingSenderId: "562496990162",
  appId: "1:562496990162:web:b48dc48ae254a464a4360b",
  measurementId: "G-7M6HGE04RC"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let googleProvider: GoogleAuthProvider | undefined;

// Only initialize if we have an API Key. 
// This prevents the "auth/api-key-not-valid" crash loop.
if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Initialize Firestore with explicit settings
    db = initializeFirestore(app, {
       cacheSizeBytes: CACHE_SIZE_UNLIMITED
    });
    
    // Enable Offline Persistence
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code == 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one tab at a a time.
          console.warn('Firestore persistence failed: Multiple tabs open');
      } else if (err.code == 'unimplemented') {
          // The current browser does not support all of the features required to enable persistence
          console.warn('Firestore persistence not supported in this browser');
      }
    });

    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else {
  console.warn("Firebase API Key missing from environment. Authentication features are disabled.");
}

export { auth, db, googleProvider };
