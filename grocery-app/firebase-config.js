import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiqNN55PP4FEi823cQaewOoUJo85GQ3AI",
  authDomain: "grocery-list-c16cb.web.app",
  projectId: "grocery-list-c16cb",
  storageBucket: "grocery-list-c16cb.firebasestorage.app",
  messagingSenderId: "966337773448",
  appId: "1:966337773448:web:50bf2607d986eb86e3c43d",
  measurementId: "G-1F5KXB6DZH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
