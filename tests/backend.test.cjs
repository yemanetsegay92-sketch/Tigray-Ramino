const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyAction,
  newGame,
  privateHand,
  publicState
} = require('../backend/engine.cjs');

test('server deals canonical private hands without exposing them publicly', () => {
  const state = newGame(3);
  assert.deepEqual(state.players.map(player => player.hand.length), [14, 13, 13]);
  const publicView = publicState(state, ['u1', 'u2', 'u3'], 0);
  assert.equal('deck' in publicView, false);
  assert.equal(publicView.deckCount, state.deck.length);
  assert.equal('hand' in publicView.players[0], false);
  assert.deepEqual(publicView.players.map(player => player.handCount), [14, 13, 13]);
});

test('private hand projection contains only the requested player hand', () => {
  const state = newGame(2);
  const hand = privateHand(state, 1, 'player-2', 4);
  assert.equal(hand.playerId, 'player-2');
  assert.equal(hand.hand.length, 13);
  assert.equal(hand.revision, 4);
  assert.equal('players' in hand, false);
  assert.equal('deck' in hand, false);
});

test('server rejects out-of-turn actions', () => {
  const state = newGame(2);
  assert.throws(() => applyAction(state, 1, { type: 'draw' }), /not your turn/i);
});

test('server rejects forged cards that are not in the actor hand', () => {
  const state = newGame(2);
  assert.throws(
    () => applyAction(state, 0, { type: 'discard', cardId: 'forged-card' }),
    /not in your hand/i
  );
});

test('server preserves the existing first-turn discard rule', () => {
  const state = newGame(2);
  const cardId = state.players[0].hand[0].id;
  const result = applyAction(state, 0, { type: 'discard', cardId });
  assert.equal(result.state.players[0].hand.length, 13);
  assert.equal(result.state.currentPlayer, 1);
  assert.equal(result.state.phase, 'draw');
  assert.equal(result.state.firstDiscardPending, false);
});

test('server rejects drawing during the initial forced discard', () => {
  const state = newGame(2);
  assert.throws(() => applyAction(state, 0, { type: 'draw' }), /discard first/i);
});
