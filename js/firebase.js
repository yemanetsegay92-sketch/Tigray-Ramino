// ================================================================
// TIGRAY RAMINO — FIREBASE CONNECTION
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA2fDzqQVDQcQCy7oAVp3wygVLU5ys2Frc",
    authDomain: "ramino-41.firebaseapp.com",
    projectId: "ramino-41",
    storageBucket: "ramino-41.firebasestorage.app",
    messagingSenderId: "434798870247",
    appId: "1:434798870247:web:56169646afffab248eac42"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Make Firebase available to the Ramino multiplayer system.
window.RaminoFirebase = {
    db,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
};

window.dispatchEvent(new Event('ramino-firebase-ready'));

console.log('🔥 Tigray Ramino Firebase connected:', app.options.projectId);
alert('🔥 Firebase connected to Tigray Ramino!');
