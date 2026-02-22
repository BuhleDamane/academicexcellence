import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyB49ShVVKQmef4w68JLa9p0_KZVMMEzEYg",
    authDomain: "academic-excellence-hub.firebaseapp.com",
    projectId: "academic-excellence-hub",
    storageBucket: "academic-excellence-hub.appspot.com",
    messagingSenderId: "967792268188",
    appId: "1:967792268188:web:7dfd9f4ab5757205ae2e59"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log("Firebase initialized successfully");