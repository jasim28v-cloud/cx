import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, get, child } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAQEHv1K69ZtA48l1TpqUfAIJlmM20gZyA",
    authDomain: "tlgr-1436a.firebaseapp.com",
    databaseURL: "https://tlgr-1436a-default-rtdb.firebaseio.com",
    projectId: "tlgr-1436a",
    storageBucket: "tlgr-1436a.firebasestorage.app",
    messagingSenderId: "128259219683",
    appId: "1:128259219683:web:b59f803204f226a5bda5d6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export { ref, push, set, onValue, update, get, child };

// Cloudinary Configuration
export const CLOUD_NAME = 'dqzjfaqg4';
export const UPLOAD_PRESET = 'vox_god';
