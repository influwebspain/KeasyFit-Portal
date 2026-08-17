import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtRMPFsb3EaKAobFlDyaXv8q2LAmgCqgU",
  authDomain: "rutinagym-42e6c.firebaseapp.com",
  projectId: "rutinagym-42e6c",
  storageBucket: "rutinagym-42e6c.firebasestorage.app",
  messagingSenderId: "451968706402",
  appId: "1:451968706402:web:edabb7283e30318f456e3b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export instances to global window object so they can be accessed from vanilla JS app.js
window.firebaseDb = db;
window.firebaseDoc = doc;
window.firebaseGetDoc = getDoc;
window.firebaseSetDoc = setDoc;
