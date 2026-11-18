'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ENGINE_FILES = [
  'config',
  'state',
  'cards',
  'validation',
  'joker',
  'monte',
  'game'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadEngine() {
  const context = vm.createContext({
    window: {},
    console,
    Math,
    setTimeout,
    clearTimeout,
    document: {
      getElementById: () => null,
      querySelector: () => null
    }
  });

  for (const file of ENGINE_FILES) {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'js', `${file}.js`),
      'utf8'
    );
    vm.runInContext(source, context, { filename: `${file}.js` });
  }

  const engine = context.window.TigrayRamino;
  engine.setMessage = message => {
    engine.lastServerMessage = String(message || '');
  };
  engine.renderAll = () => {};
  engine.showModal = () => {};
  engine.dom = engine.dom || {};
  return engine;
}

function newGame(playerCount) {
  const engine = loadEngine();
  engine.initGame(playerCount);
  engine.G.multiplayer = false;
  engine.G.networkRevision = 0;
  return clone(engine.G);
}

function requireCard(hand, cardId) {
  const card = hand.find(item => String(item.id) === String(cardId));
  if (!card) throw new Error('That card is not in your hand.');
  return card;
}

function applyAction(state, actorIndex, action) {
  if (!action || typeof action.type !== 'string') {
    throw new Error('A valid action is required.');
  }
  if (!Number.isInteger(actorIndex) || actorIndex < 0) {
    throw new Error('Player is not part of this room.');
  }
  if (state.winner !== null && state.winner !== undefined) {
    throw new Error('This game is already finished.');
  }
  if (state.currentPlayer !== actorIndex) {
    throw new Error('It is not your turn.');
  }

  const engine = loadEngine();
  engine.G = clone(state);
  engine.G.multiplayer = false;
  engine.lastServerMessage = '';

  const player = engine.G.players[actorIndex];
  if (!player) throw new Error('Player state is unavailable.');
  const before = JSON.stringify(engine.G);

  switch (action.type) {
    case 'draw':
      engine.doDraw();
      break;
    case 'takeDiscard':
      engine.doTakeDiscard();
      break;
    case 'discard':
      engine.doDiscardCard(requireCard(player.hand, action.cardId));
      break;
    case 'openCombo': {
      if (!Array.isArray(action.cardIds) || action.cardIds.length > 14) {
        throw new Error('Choose a valid set of cards.');
      }
      const cards = action.cardIds.map(id => requireCard(player.hand, id));
      engine.doOpenCombo(cards);
      break;
    }
    case 'addToCombo':
      engine.doAddToCombo(
        requireCard(player.hand, action.cardId),
        Number(action.targetPlayerIndex),
        Number(action.targetComboIndex)
      );
      break;
    case 'swapJoker': {
      const handIndex = player.hand.findIndex(
        card => String(card.id) === String(action.cardId)
      );
      if (handIndex < 0) throw new Error('Replacement card is unavailable.');
      engine.G.selected = [handIndex];
      engine.tryJokerSwap(
        Number(action.targetPlayerIndex),
        Number(action.targetComboIndex),
        Number(action.jokerCardIndex)
      );
      break;
    }
    case 'swapJokerAuto':
      engine.doJokerSwap();
      break;
    case 'monteWin':
      engine.doMonteWin();
      break;
    default:
      throw new Error('Unsupported game action.');
  }

  const after = JSON.stringify(engine.G);
  if (after === before) {
    throw new Error(engine.lastServerMessage || 'The action is not valid right now.');
  }

  engine.G.multiplayer = false;
  return {
    state: clone(engine.G),
    message: engine.lastServerMessage || 'Action accepted.'
  };
}

function cardData(card) {
  return {
    id: String(card.id),
    suit: card.suit,
    rank: card.rank
  };
}

function comboData(combo) {
  return {
    contributors: { ...(combo.contributors || {}) },
    cards: (combo.cards || []).map(cardData),
    type: combo.type || 'sequence',
    points: Number(combo.points || 0),
    displayCards: (combo.displayCards || []).map(display => ({
      card: display.card ? cardData(display.card) : null,
      displayRank: display.displayRank,
      displaySuit: display.displaySuit
    }))
  };
}

function publicState(state, playerOrder, revision) {
  return {
    schemaVersion: 2,
    status: state.winner === null || state.winner === undefined ? 'playing' : 'finished',
    playerIds: playerOrder.slice(),
    currentPlayer: Number(state.currentPlayer || 0),
    phase: state.phase || 'draw',
    winner: state.winner === undefined ? null : state.winner,
    eliminated: (state.eliminated || []).slice(),
    lastDiscardJoker: !!state.lastDiscardJoker,
    monteMode: !!state.monteMode,
    montePlayer: state.montePlayer ?? null,
    mustOpen: !!state.mustOpen,
    openingAttempt: !!state.openingAttempt,
    firstDiscardPending: !!state.firstDiscardPending,
    jokerSwapActive: !!state.jokerSwapActive,
    deckCount: (state.deck || []).length,
    discardPile: (state.discardPile || []).map(cardData),
    players: (state.players || []).map(player => ({
      opened: !!player.opened,
      handCount: (player.hand || []).length,
      combos: (player.combos || []).map(comboData)
    })),
    revision
  };
}

function privateHand(state, playerIndex, uid, revision) {
  const player = state.players[playerIndex];
  return {
    schemaVersion: 2,
    playerId: uid,
    hand: (player?.hand || []).map(cardData),
    handCount: (player?.hand || []).length,
    revision
  };
}

module.exports = {
  applyAction,
  clone,
  newGame,
  privateHand,
  publicState
};
