const { before, after, test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');

let environment;

before(async () => {
  const [host = '127.0.0.1', port = '8080'] =
    (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  environment = await initializeTestEnvironment({
    projectId: 'tigray-ramino-2-rules-test',
    firestore: {
      host,
      port: Number(port),
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8')
    }
  });

  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms', 'ABCDE'), {
      memberUids: ['host-uid', 'player-uid'],
      hostUid: 'host-uid',
      status: 'playing'
    });
    await setDoc(doc(db, 'rooms', 'ABCDE', 'game', 'public'), { revision: 1 });
    await setDoc(doc(db, 'rooms', 'ABCDE', 'privateHands', 'host-uid'), { hand: [] });
    await setDoc(doc(db, 'rooms', 'ABCDE', 'privateHands', 'player-uid'), { hand: [] });
    await setDoc(doc(db, 'rooms', 'ABCDE', 'server', 'game'), { deck: ['secret'] });
    await setDoc(doc(db, 'players_public', 'host-uid'), { displayName: 'Host' });
    await setDoc(doc(db, 'players_private', 'host-uid'), { settings: {} });
  });
});

after(async () => {
  await environment?.cleanup();
});

test('anonymous visitors cannot read rooms before authentication', async () => {
  const db = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'rooms', 'ABCDE')));
});

test('room members can read the room and public synchronized state', async () => {
  const db = environment.authenticatedContext('player-uid').firestore();
  await assertSucceeds(getDoc(doc(db, 'rooms', 'ABCDE')));
  await assertSucceeds(getDoc(doc(db, 'rooms', 'ABCDE', 'game', 'public')));
});

test('authenticated non-members cannot read a room or its game', async () => {
  const db = environment.authenticatedContext('outsider-uid').firestore();
  await assertFails(getDoc(doc(db, 'rooms', 'ABCDE')));
  await assertFails(getDoc(doc(db, 'rooms', 'ABCDE', 'game', 'public')));
});

test('members can read only their own private hand', async () => {
  const db = environment.authenticatedContext('player-uid').firestore();
  await assertSucceeds(getDoc(doc(db, 'rooms', 'ABCDE', 'privateHands', 'player-uid')));
  await assertFails(getDoc(doc(db, 'rooms', 'ABCDE', 'privateHands', 'host-uid')));
});

test('canonical server state is unreadable even to the host', async () => {
  const db = environment.authenticatedContext('host-uid').firestore();
  await assertFails(getDoc(doc(db, 'rooms', 'ABCDE', 'server', 'game')));
});

test('all direct client multiplayer writes are denied', async () => {
  const db = environment.authenticatedContext('host-uid').firestore();
  await assertFails(setDoc(doc(db, 'rooms', 'ABCDE'), { status: 'finished' }, { merge: true }));
  await assertFails(setDoc(doc(db, 'rooms', 'ABCDE', 'game', 'public'), { revision: 99 }));
  await assertFails(setDoc(doc(db, 'rooms', 'ABCDE', 'privateHands', 'host-uid'), { hand: ['forged'] }));
});

test('future profile collections separate public and private data', async () => {
  const ownerDb = environment.authenticatedContext('host-uid').firestore();
  const otherDb = environment.authenticatedContext('player-uid').firestore();
  await assertSucceeds(getDoc(doc(otherDb, 'players_public', 'host-uid')));
  await assertSucceeds(getDoc(doc(ownerDb, 'players_private', 'host-uid')));
  await assertFails(getDoc(doc(otherDb, 'players_private', 'host-uid')));
  await assertFails(setDoc(doc(ownerDb, 'players_public', 'host-uid'), { role: 'admin' }));
});
