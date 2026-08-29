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
  apiKey: "AIzaSyD0v3Yse32BOvXeHYrv3kwmlY_6WgYCwWc",
  authDomain: "our-chat-46.firebaseapp.com",
  databaseURL: "https://our-chat-46-default-rtdb.firebaseio.com",
  projectId: "our-chat-46",
  storageBucket: "our-chat-46.firebasestorage.app",
  messagingSenderId: "707446626223",
  appId: "1:707446626223:web:37f87dfeb72b37a00f415a"
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
