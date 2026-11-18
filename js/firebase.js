// Tigray Ramino 2.0 — isolated Firebase client and durable anonymous identity.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import {
    browserLocalPersistence,
    connectAuthEmulator,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInAnonymously
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {
    connectFirestoreEmulator,
    doc,
    getDoc,
    getFirestore,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import {
    connectFunctionsEmulator,
    getFunctions,
    httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';

const firebaseConfig = {
    projectId: 'tigray-ramino-2-prod',
    appId: '1:1042823690441:web:e6c70ca97fdc79d813f518',
    storageBucket: 'tigray-ramino-2-prod.firebasestorage.app',
    apiKey: 'AIzaSyBvoSBp2hSQcArTHIxZdym-Q_pCWIRxU6w',
    authDomain: 'tigray-ramino-2-prod.firebaseapp.com',
    messagingSenderId: '1042823690441'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'europe-west1');

const useEmulators = ['localhost', '127.0.0.1'].includes(location.hostname) &&
    (new URLSearchParams(location.search).get('emulators') === '1' ||
     localStorage.getItem('ramino_use_emulators') === '1');

if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

const ready = (async () => {
    await setPersistence(auth, browserLocalPersistence);
    const existing = await new Promise(resolve => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            unsubscribe();
            resolve(user);
        });
    });
    const user = existing || (await signInAnonymously(auth)).user;
    return user;
})();

const callable = name => {
    const invoke = httpsCallable(functions, name);
    return async data => {
        await ready;
        const result = await invoke(data || {});
        return result.data;
    };
};

window.RaminoFirebase = {
    app,
    auth,
    db,
    functions,
    ready,
    doc,
    getDoc,
    onSnapshot,
    createRoom: callable('createRoom'),
    joinRoom: callable('joinRoom'),
    leaveRoom: callable('leaveRoom'),
    startGame: callable('startGame'),
    submitAction: callable('submitAction')
};

ready.then(user => {
    window.dispatchEvent(new CustomEvent('ramino-firebase-ready', {
        detail: { uid: user.uid }
    }));
    console.info('Tigray Ramino 2.0 backend ready:', firebaseConfig.projectId);
}).catch(error => {
    console.error('Firebase authentication failed:', error);
    window.dispatchEvent(new CustomEvent('ramino-firebase-error', { detail: error }));
});
