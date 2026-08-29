// ==========================================================================
// A&H Chat - Firebase Configuration & SDK Initialization
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  onChildAdded,
  onDisconnect,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-PlaceholderForSecurity",
  authDomain: "zapchat-pro-messenger.firebaseapp.com",
  databaseURL: "https://zapchat-pro-messenger-default-rtdb.firebaseio.com",
  projectId: "zapchat-pro-messenger",
  storageBucket: "zapchat-pro-messenger.appspot.com",
  messagingSenderId: "392819284719",
  appId: "1:392819284719:web:9c847291a82f30b91d"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Export Auth Methods
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
};

// Export Database Methods
export {
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  onChildAdded,
  onDisconnect,
  serverTimestamp
};
