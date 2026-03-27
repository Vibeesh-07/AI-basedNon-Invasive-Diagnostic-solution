import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBF0Dkl1vj779oLgfVnXtJ9u6WNY6o4-aU",
  authDomain: "sentinel3ai.firebaseapp.com",
  databaseURL: "https://sentinel3ai-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sentinel3ai",
  storageBucket: "sentinel3ai.firebasestorage.app",
  messagingSenderId: "328641023125",
  appId: "1:328641023125:web:c3f49db2ee9ee05f3ddf9c",
  measurementId: "G-P6Q2ZN0KJ7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
