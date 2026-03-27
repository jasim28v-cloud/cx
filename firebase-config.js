const firebaseConfig = {
    apiKey: "AIzaSyCVyQS6kuOBDyx_FXoGx6xgXxbbzjs5COg",
    authDomain: "fokx-c135a.firebaseapp.com",
    databaseURL: "https://fokx-c135a-default-rtdb.firebaseio.com",
    projectId: "fokx-c135a",
    storageBucket: "fokx-c135a.firebasestorage.app",
    messagingSenderId: "447033620521",
    appId: "1:447033620521:web:730fde0a59cb5624128438"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

const CLOUD_NAME = 'dk5kas1gc';
const UPLOAD_PRESET = 'go_kck';

console.log('✅ SHΔDØW System Ready');
