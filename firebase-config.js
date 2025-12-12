// ============================================================
// Firebase Configuration
// ============================================================
// INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select existing one
// 3. Go to Project Settings > General > Your apps
// 4. Click "Add app" and choose "Web" (</>) icon
// 5. Copy the firebaseConfig object values below
// 6. Enable Firestore Database in Firebase Console
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBhsTCxiTcBulfnS6poJAgEdVY3t_YQ23o",
  authDomain: "secretsanta-85ac9.firebaseapp.com",
  databaseURL: "https://secretsanta-85ac9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "secretsanta-85ac9",
  storageBucket: "secretsanta-85ac9.firebasestorage.app",
  messagingSenderId: "522678705348",
  appId: "1:522678705348:web:5d2feabddd664fc1f63d91",
};

// Initialize Firebase
let app;
let db;
let auth;

// Wait for Firebase SDK to load
if (typeof firebase !== 'undefined') {
  try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("✅ Firebase initialized successfully");
    console.log("✅ Firebase Auth enabled for email link verification");
    
    // Export for use in other files
    window.db = db;
    window.firebase = firebase;
    window.auth = auth;
  } catch (error) {
    console.error("❌ Firebase initialization error:", error);
    alert("Firebase configuration error. Please check your firebase-config.js file.");
  }
} else {
  console.error("❌ Firebase SDK not loaded");
  alert("Firebase SDK not loaded. Please check your internet connection.");
}
