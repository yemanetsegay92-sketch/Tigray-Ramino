const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { deleteApp, initializeApp } = require('firebase/app');
const {
  connectAuthEmulator,
  getAuth,
  signInAnonymously
} = require('firebase/auth');
const {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore
} = require('firebase/firestore');
const {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable
} = require('firebase/functions');

const PROJECT_ID = 'tigray-ramino-2-prod';
const REGION = 'africa-south1';
const firebaseConfig = {
  projectId: PROJECT_ID,
  apiKey: 'emulator-only-api-key',
  authDomain: `${PROJECT_ID}.firebaseapp.com`
};

let host;
let guest;

function emulatorAddress(name, fallbackPort) {
  const [hostName = '127.0.0.1', port = String(fallbackPort)] =
    (process.env[name] || `127.0.0.1:${fallbackPort}`).split(':');
  return { host: hostName, port: Number(port) };
}

function createClient(name) {
  const app = initializeApp(firebaseConfig, name);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, REGION);
  const authAddress = emulatorAddress('FIREBASE_AUTH_EMULATOR_HOST', 9099);
  const firestoreAddress = emulatorAddress('FIRESTORE_EMULATOR_HOST', 8080);
  const functionsAddress = emulatorAddress('FUNCTIONS_EMULATOR_HOST', 5001);

  connectAuthEmulator(auth, `http://${authAddress.host}:${authAddress.port}`, {
    disableWarnings: true
  });
  connectFirestoreEmulator(db, firestoreAddress.host, firestoreAddress.port);
  connectFunctionsEmulator(functions, functionsAddress.host, functionsAddress.port);

  return {
    app,
    auth,
    db,
    call: name => httpsCallable(functions, name)
  };
}

before(async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  host = createClient(`ramino-host-${suffix}`);
  guest = createClient(`ramino-guest-${suffix}`);
  await Promise.all([signInAnonymously(host.auth), signInAnonymously(guest.auth)]);
});

after(async () => {
  await Promise.all([deleteApp(host.app), deleteApp(guest.app)]);
});

test('two anonymous players can create, join, reconnect, start and synchronize', async () => {
  const created = await host.call('createRoom')({ displayName: 'Host' });
  const roomCode = created.data.roomCode;
  assert.match(roomCode, /^[A-HJ-NP-Z2-9]{5}$/);

  const joined = await guest.call('joinRoom')({ roomCode, displayName: 'Guest' });
  assert.equal(joined.data.reconnected, false);

  const reconnected = await guest.call('joinRoom')({
    roomCode,
    displayName: 'Guest Reconnected'
  });
  assert.equal(reconnected.data.reconnected, true);

  const room = await getDoc(doc(host.db, 'rooms', roomCode));
  assert.equal(room.data().memberUids.length, 2);
  assert.deepEqual(room.data().playerOrder, [host.auth.currentUser.uid, guest.auth.currentUser.uid]);

  await host.call('startGame')({ roomCode });

  const publicRef = doc(host.db, 'rooms', roomCode, 'game', 'public');
  const hostHandRef = doc(
    host.db,
    'rooms',
    roomCode,
    'privateHands',
    host.auth.currentUser.uid
  );
  const guestHandRef = doc(
    guest.db,
    'rooms',
    roomCode,
    'privateHands',
    guest.auth.currentUser.uid
  );
  const [publicStart, hostHandStart, guestHandStart] = await Promise.all([
    getDoc(publicRef),
    getDoc(hostHandRef),
    getDoc(guestHandRef)
  ]);

  assert.equal(publicStart.data().revision, 0);
  assert.equal(hostHandStart.data().hand.length, 14);
  assert.equal(guestHandStart.data().hand.length, 13);
  assert.equal('deck' in publicStart.data(), false);
  assert.equal('hand' in publicStart.data().players[0], false);

  await assert.rejects(
    getDoc(doc(
      guest.db,
      'rooms',
      roomCode,
      'privateHands',
      host.auth.currentUser.uid
    )),
    /permission-denied/i
  );

  const cardId = hostHandStart.data().hand[0].id;
  const action = await host.call('submitAction')({
    roomCode,
    actionId: `e2e-${Date.now()}`,
    expectedRevision: 0,
    action: { type: 'discard', cardId }
  });
  assert.equal(action.data.accepted, true);
  assert.equal(action.data.revision, 1);

  const [publicAfter, hostHandAfter, guestHandAfter] = await Promise.all([
    getDoc(publicRef),
    getDoc(hostHandRef),
    getDoc(guestHandRef)
  ]);
  assert.equal(publicAfter.data().revision, 1);
  assert.equal(hostHandAfter.data().revision, 1);
  assert.equal(guestHandAfter.data().revision, 1);
  assert.equal(hostHandAfter.data().hand.length, 13);
});
