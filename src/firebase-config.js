import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp,
    collection,
    addDoc,
    getDocs,
    getDoc
} from 'firebase/firestore';

// CRIAR VARIAVEL DE AMBIENTE PRA CHAVE API
const firebaseConfig = {
    apiKey: "AIzaSyDfn_yDbh-muAGRGRQRZdPr4RpDtUD-iZ0",
    authDomain: "sistema-escola-renascer.firebaseapp.com",
    projectId: "sistema-escola-renascer",
    storageBucket: "sistema-escola-renascer.firebasestorage.app",
    messagingSenderId: "357845611781",
    appId: "1:357845611781:web:0023ee32f83a121a8eb36c",
    measurementId: "G-9M6TKRJK2Y"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Exporta as instâncias e as funções do SDK
export {
    app,
    auth,
    db,
    analytics,
    // Funções do Firestore
    doc,
    setDoc,
    serverTimestamp,
    collection,
    addDoc,
    getDocs,
    getDoc,
    // Funções de Autenticação
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
};
