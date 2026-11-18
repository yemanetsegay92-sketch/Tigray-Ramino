'use strict';

const { randomInt } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const {
  applyAction,
  newGame,
  privateHand,
  publicState
} = require('./engine.cjs');

initializeApp();

const db = getFirestore();
const REGION = process.env.RAMINO_FUNCTION_REGION || 'europe-west1';
const callableOptions = {
  region: REGION,
  enforceAppCheck: false,
  cors: true,
  maxInstances: 20,
  timeoutSeconds: 30,
  memory: '256MiB'
};
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{5}$/;
const ACTION_ID = /^[A-Za-z0-9_-]{8,80}$/;

function requireUid(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in before using multiplayer.');
  return uid;
}

function cleanDisplayName(value) {
  const name = String(value || 'Player')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
  return name || 'Player';
}

function cleanRoomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!ROOM_CODE.test(code)) {
    throw new HttpsError('invalid-argument', 'Enter a valid five-character room code.');
  }
  return code;
}

function randomRoomCode() {
  let code = '';
  for (let index = 0; index < 5; index += 1) {
    code += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)];
  }
  return code;
}

function memberPlayer(uid, displayName) {
  return {
    uid,
    displayName,
    joinedAtMs: Date.now()
  };
}

exports.createRoom = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  const displayName = cleanDisplayName(request.data?.displayName);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomRoomCode();
    const roomRef = db.doc(`rooms/${code}`);
    const memberRef = roomRef.collection('members').doc(uid);

    try {
      await db.runTransaction(async transaction => {
        const existing = await transaction.get(roomRef);
        if (existing.exists) throw new Error('ROOM_CODE_COLLISION');

        const player = memberPlayer(uid, displayName);
        transaction.create(roomRef, {
          schemaVersion: 2,
          roomId: code,
          hostUid: uid,
          status: 'waiting',
          maxPlayers: 4,
          memberUids: [uid],
          playerOrder: [uid],
          players: [player],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(memberRef, {
          schemaVersion: 2,
          uid,
          displayName,
          role: 'host',
          joinedAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp()
        });
      });
      return { roomCode: code, role: 'host', reconnected: false };
    } catch (error) {
      if (error.message === 'ROOM_CODE_COLLISION') continue;
      logger.error('createRoom failed', { uid, error: error.message });
      throw new HttpsError('internal', 'The room could not be created.');
    }
  }

  throw new HttpsError('resource-exhausted', 'Could not allocate a room code. Try again.');
});

exports.joinRoom = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  const code = cleanRoomCode(request.data?.roomCode);
  const displayName = cleanDisplayName(request.data?.displayName);
  const roomRef = db.doc(`rooms/${code}`);
  const memberRef = roomRef.collection('members').doc(uid);

  return db.runTransaction(async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists) throw new HttpsError('not-found', 'Room not found.');

    const room = roomSnapshot.data();
    const memberUids = Array.isArray(room.memberUids) ? room.memberUids : [];
    const isMember = memberUids.includes(uid);

    if (isMember) {
      transaction.set(memberRef, {
        schemaVersion: 2,
        uid,
        displayName,
        role: room.hostUid === uid ? 'host' : 'player',
        lastSeenAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return {
        roomCode: code,
        role: room.hostUid === uid ? 'host' : 'player',
        reconnected: true,
        status: room.status
      };
    }

    if (room.status !== 'waiting') {
      throw new HttpsError('failed-precondition', 'This game has already started.');
    }
    if (memberUids.length >= Number(room.maxPlayers || 4)) {
      throw new HttpsError('resource-exhausted', 'This room is full.');
    }

    const player = memberPlayer(uid, displayName);
    transaction.update(roomRef, {
      memberUids: [...memberUids, uid],
      playerOrder: [...(room.playerOrder || []), uid],
      players: [...(room.players || []), player],
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.create(memberRef, {
      schemaVersion: 2,
      uid,
      displayName,
      role: 'player',
      joinedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp()
    });

    return { roomCode: code, role: 'player', reconnected: false, status: 'waiting' };
  });
});

exports.leaveRoom = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  const code = cleanRoomCode(request.data?.roomCode);
  const roomRef = db.doc(`rooms/${code}`);
  const memberRef = roomRef.collection('members').doc(uid);

  await db.runTransaction(async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists) return;
    const room = roomSnapshot.data();
    if (!(room.memberUids || []).includes(uid)) return;
    if (room.status !== 'waiting') {
      throw new HttpsError('failed-precondition', 'Started games remain available for reconnection.');
    }

    const memberUids = room.memberUids.filter(id => id !== uid);
    const playerOrder = (room.playerOrder || []).filter(id => id !== uid);
    const players = (room.players || []).filter(player => player.uid !== uid);
    const hostUid = room.hostUid === uid ? (playerOrder[0] || null) : room.hostUid;
    transaction.update(roomRef, {
      memberUids,
      playerOrder,
      players,
      hostUid,
      status: memberUids.length ? 'waiting' : 'abandoned',
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.delete(memberRef);
    if (hostUid && hostUid !== room.hostUid) {
      transaction.set(roomRef.collection('members').doc(hostUid), {
        role: 'host',
        lastSeenAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  return { left: true };
});

exports.startGame = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  const code = cleanRoomCode(request.data?.roomCode);
  const roomRef = db.doc(`rooms/${code}`);
  const canonicalRef = roomRef.collection('server').doc('game');
  const publicRef = roomRef.collection('game').doc('public');

  await db.runTransaction(async transaction => {
    const [roomSnapshot, canonicalSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(canonicalRef)
    ]);
    if (!roomSnapshot.exists) throw new HttpsError('not-found', 'Room not found.');
    const room = roomSnapshot.data();
    if (room.hostUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the room host can start the game.');
    }
    if (canonicalSnapshot.exists || room.status === 'playing' || room.status === 'finished') {
      return;
    }
    const playerOrder = room.playerOrder || [];
    if (playerOrder.length < 2 || playerOrder.length > 4) {
      throw new HttpsError('failed-precondition', 'Two to four players are required.');
    }

    const state = newGame(playerOrder.length);
    const revision = 0;
    transaction.create(canonicalRef, {
      schemaVersion: 2,
      state,
      revision,
      recentActions: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.create(publicRef, {
      ...publicState(state, playerOrder, revision),
      updatedAt: FieldValue.serverTimestamp()
    });
    playerOrder.forEach((playerUid, playerIndex) => {
      transaction.create(roomRef.collection('privateHands').doc(playerUid), {
        ...privateHand(state, playerIndex, playerUid, revision),
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    transaction.update(roomRef, {
      status: 'playing',
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { roomCode: code, started: true };
});

exports.submitAction = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  const code = cleanRoomCode(request.data?.roomCode);
  const actionId = String(request.data?.actionId || '');
  const expectedRevision = Number(request.data?.expectedRevision);
  if (!ACTION_ID.test(actionId)) {
    throw new HttpsError('invalid-argument', 'A valid action ID is required.');
  }
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new HttpsError('invalid-argument', 'A valid state revision is required.');
  }

  const roomRef = db.doc(`rooms/${code}`);
  const canonicalRef = roomRef.collection('server').doc('game');
  const publicRef = roomRef.collection('game').doc('public');

  return db.runTransaction(async transaction => {
    const [roomSnapshot, canonicalSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(canonicalRef)
    ]);
    if (!roomSnapshot.exists || !canonicalSnapshot.exists) {
      throw new HttpsError('not-found', 'Game state was not found.');
    }
    const room = roomSnapshot.data();
    const canonical = canonicalSnapshot.data();
    const playerOrder = room.playerOrder || [];
    const actorIndex = playerOrder.indexOf(uid);
    if (actorIndex < 0) throw new HttpsError('permission-denied', 'You are not in this room.');

    const recentActions = Array.isArray(canonical.recentActions)
      ? canonical.recentActions
      : [];
    if (recentActions.includes(actionId)) {
      return { accepted: true, duplicate: true, revision: canonical.revision };
    }
    if (canonical.revision !== expectedRevision) {
      throw new HttpsError(
        'aborted',
        'The game changed. Your state will refresh; try the action again.'
      );
    }

    let result;
    try {
      result = applyAction(canonical.state, actorIndex, request.data?.action);
    } catch (error) {
      throw new HttpsError('failed-precondition', error.message);
    }

    const revision = canonical.revision + 1;
    const nextRecentActions = [...recentActions.slice(-31), actionId];
    transaction.update(canonicalRef, {
      state: result.state,
      revision,
      recentActions: nextRecentActions,
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.set(publicRef, {
      ...publicState(result.state, playerOrder, revision),
      updatedAt: FieldValue.serverTimestamp()
    });
    playerOrder.forEach((playerUid, playerIndex) => {
      transaction.set(roomRef.collection('privateHands').doc(playerUid), {
        ...privateHand(result.state, playerIndex, playerUid, revision),
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    if (result.state.winner !== null && result.state.winner !== undefined) {
      transaction.update(roomRef, {
        status: 'finished',
        finishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    return { accepted: true, duplicate: false, revision, message: result.message };
  });
});
