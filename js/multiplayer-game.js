/* Tigray Ramino 2.0 — read-only synchronized client; actions execute on server. */
(function () {
    'use strict';

    const TR = window.TigrayRamino;
    if (!TR) return;

    const GameMP = {
        roomId: null,
        playerId: null,
        playerIndex: null,
        unsubscribeGame: null,
        unsubscribePrivate: null,
        latestPublic: null,
        latestPrivate: null,
        actionPending: false,
        patched: false,
        originalActions: {},

        async waitForFirebase() {
            if (!window.RaminoFirebase) throw new Error('Firebase is not ready.');
            await window.RaminoFirebase.ready;
            return window.RaminoFirebase;
        },

        async start(room) {
            if (!room?.id) throw new Error('No multiplayer room is active.');
            const Firebase = await this.waitForFirebase();
            const playerId = Firebase.auth.currentUser?.uid;
            if (!playerId) throw new Error('Player identity is unavailable.');

            if (this.roomId === room.id && this.unsubscribeGame && this.unsubscribePrivate) {
                this.enterOnlineGame();
                return true;
            }

            this.stopListeners();
            this.roomId = room.id;
            this.playerId = playerId;
            this.latestPublic = null;
            this.latestPrivate = null;
            this.patchActions();
            this.enterOnlineGame();
            this.listen();
            return true;
        },

        enterOnlineGame() {
            TR.G.multiplayer = true;
            document.querySelector('.modal-overlay')?.remove();
            TR.modalActive = false;
            const modeScreen = document.getElementById('mode-screen');
            const app = document.getElementById('app');
            if (modeScreen) modeScreen.style.display = 'none';
            if (app) app.style.display = 'block';
            window.TigrayRaminoMultiplayer?.closeLobby(true);
            this.setStatus('Reconnecting to the secure game state…');
        },

        patchActions() {
            if (this.patched) return;
            this.patched = true;
            const names = [
                'doDraw', 'doTakeDiscard', 'doDiscardCard', 'doOpenCombo',
                'doAddToCombo', 'tryJokerSwap', 'doJokerSwap', 'doMonteWin'
            ];
            names.forEach(name => {
                const original = TR[name];
                this.originalActions[name] = original;
                TR[name] = (...args) => {
                    if (!TR.G.multiplayer) return original.apply(TR, args);
                    return this.requestAction(name, args);
                };
            });
        },

        wireAction(name, args) {
            const player = TR.G.players?.[this.playerIndex];
            switch (name) {
                case 'doDraw': return { type: 'draw' };
                case 'doTakeDiscard': return { type: 'takeDiscard' };
                case 'doDiscardCard': return { type: 'discard', cardId: String(args[0]?.id || '') };
                case 'doOpenCombo': return {
                    type: 'openCombo',
                    cardIds: (args[0] || []).map(card => String(card.id))
                };
                case 'doAddToCombo': return {
                    type: 'addToCombo',
                    cardId: String(args[0]?.id || ''),
                    targetPlayerIndex: Number(args[1]),
                    targetComboIndex: Number(args[2])
                };
                case 'tryJokerSwap': {
                    const selectedIndex = TR.G.selected?.[0];
                    return {
                        type: 'swapJoker',
                        cardId: String(player?.hand?.[selectedIndex]?.id || ''),
                        targetPlayerIndex: Number(args[0]),
                        targetComboIndex: Number(args[1]),
                        jokerCardIndex: Number(args[2])
                    };
                }
                case 'doJokerSwap': return { type: 'swapJokerAuto' };
                case 'doMonteWin': return { type: 'monteWin' };
                default: throw new Error('Unsupported action.');
            }
        },

        isMyTurn() {
            return Number.isInteger(this.playerIndex) &&
                this.playerIndex >= 0 && TR.G.currentPlayer === this.playerIndex;
        },

        async requestAction(name, args) {
            if (this.actionPending) {
                this.setStatus('Your previous action is still being confirmed.');
                return;
            }
            if (!this.isMyTurn()) {
                this.setStatus('It is not your turn.');
                return;
            }
            let action;
            try {
                action = this.wireAction(name, args);
            } catch (error) {
                this.setStatus(error.message);
                return;
            }

            this.actionPending = true;
            this.setStatus('Confirming action…');
            try {
                const actionId = globalThis.crypto?.randomUUID
                    ? globalThis.crypto.randomUUID()
                    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const result = await window.RaminoFirebase.submitAction({
                    roomCode: this.roomId,
                    actionId,
                    expectedRevision: Number(TR.G.networkRevision || 0),
                    action
                });
                this.setStatus(result.message || 'Action confirmed.');
            } catch (error) {
                this.setStatus(this.errorMessage(error));
            } finally {
                this.actionPending = false;
            }
        },

        listen() {
            const Firebase = window.RaminoFirebase;
            const publicRef = Firebase.doc(Firebase.db, 'rooms', this.roomId, 'game', 'public');
            const privateRef = Firebase.doc(
                Firebase.db, 'rooms', this.roomId, 'privateHands', this.playerId
            );

            this.unsubscribeGame = Firebase.onSnapshot(publicRef, snapshot => {
                if (!snapshot.exists()) return;
                this.latestPublic = snapshot.data();
                this.flushSnapshots();
            }, error => this.setStatus(`Game connection interrupted: ${this.errorMessage(error)}`));

            this.unsubscribePrivate = Firebase.onSnapshot(privateRef, snapshot => {
                if (!snapshot.exists()) return;
                this.latestPrivate = snapshot.data();
                this.flushSnapshots();
            }, error => this.setStatus(`Private hand connection interrupted: ${this.errorMessage(error)}`));
        },

        flushSnapshots() {
            if (!this.latestPublic || !this.latestPrivate) return;
            if (this.latestPublic.revision !== this.latestPrivate.revision) {
                this.setStatus('Synchronizing the latest turn…');
                return;
            }
            this.applySynchronizedState(this.latestPublic, this.latestPrivate);
        },

        applySynchronizedState(state, privateState) {
            const orderedIds = Array.isArray(state.playerIds) ? state.playerIds : [];
            this.playerIndex = orderedIds.indexOf(this.playerId);
            if (this.playerIndex < 0) {
                this.setStatus('You are no longer a member of this game.');
                return;
            }

            const existingHand = this.applyLocalHandOrder(this.cardsFromData(privateState.hand || []));
            TR.G.numPlayers = orderedIds.length;
            TR.G.currentPlayer = Number(state.currentPlayer || 0);
            TR.G.phase = state.phase || 'draw';
            TR.G.winner = state.winner ?? null;
            TR.G.eliminated = Array.isArray(state.eliminated) ? state.eliminated.slice() : [];
            TR.G.lastDiscardJoker = !!state.lastDiscardJoker;
            TR.G.monteMode = !!state.monteMode;
            TR.G.montePlayer = state.montePlayer ?? null;
            TR.G.mustOpen = !!state.mustOpen;
            TR.G.openingAttempt = !!state.openingAttempt;
            TR.G.firstDiscardPending = !!state.firstDiscardPending;
            TR.G.jokerSwapActive = !!state.jokerSwapActive;
            TR.G.networkRevision = Number(state.revision || 0);
            TR.G.multiplayer = true;
            TR.G.discardPile = this.cardsFromData(state.discardPile || []);
            TR.G.deck = Array.from({ length: Number(state.deckCount || 0) }, (_, index) => ({
                id: `hidden-${index}`,
                rank: '',
                suit: ''
            }));
            TR.G.selected = [];
            TR.G.players = (state.players || []).map((publicPlayer, index) => ({
                hand: index === this.playerIndex ? existingHand : [],
                opened: !!publicPlayer.opened,
                handCount: Number(publicPlayer.handCount || 0),
                combos: (publicPlayer.combos || []).map(combo => this.comboFromData(combo))
            }));

            TR.renderAll?.();
            if (TR.G.winner !== null) {
                this.setStatus(`Player ${TR.G.winner + 1} wins!`);
            } else if (TR.G.eliminated.includes(this.playerIndex)) {
                this.setStatus('You have been eliminated from this round.');
            } else if (this.isMyTurn()) {
                this.setStatus('Your turn.');
            } else {
                this.setStatus(`Waiting for Player ${TR.G.currentPlayer + 1}…`);
            }
        },

        cardsFromData(cards) {
            return (cards || []).filter(Boolean).map(card => ({
                id: String(card.id),
                suit: card.suit,
                rank: card.rank
            }));
        },

        comboFromData(combo) {
            return {
                contributors: { ...(combo.contributors || {}) },
                cards: this.cardsFromData(combo.cards),
                type: combo.type || 'sequence',
                points: Number(combo.points || 0),
                displayCards: (combo.displayCards || []).map(display => ({
                    card: display.card ? { ...display.card, id: String(display.card.id) } : null,
                    displayRank: display.displayRank,
                    displaySuit: display.displaySuit
                }))
            };
        },

        saveLocalHandOrder() {
            const hand = TR.G.players?.[this.playerIndex]?.hand;
            if (!this.roomId || !this.playerId || !Array.isArray(hand)) return;
            try {
                localStorage.setItem(
                    `ramino_hand_order_${this.roomId}_${this.playerId}`,
                    JSON.stringify(hand.map(card => String(card.id)))
                );
            } catch (error) {
                console.warn('Could not save hand order:', error);
            }
        },

        applyLocalHandOrder(hand) {
            if (!this.roomId || !this.playerId) return hand;
            try {
                const saved = JSON.parse(localStorage.getItem(
                    `ramino_hand_order_${this.roomId}_${this.playerId}`
                ) || '[]');
                if (!Array.isArray(saved) || !saved.length) return hand;
                const byId = new Map(hand.map(card => [String(card.id), card]));
                const ordered = [];
                saved.forEach(id => {
                    const card = byId.get(String(id));
                    if (card) {
                        ordered.push(card);
                        byId.delete(String(id));
                    }
                });
                return [...ordered, ...byId.values()];
            } catch (error) {
                return hand;
            }
        },

        setStatus(message) {
            window.TigrayRaminoMultiplayer?.setStatus(message);
            TR.setMessage?.(message);
        },

        errorMessage(error) {
            return String(error?.message || 'The action failed.').replace(/^Firebase:\s*/i, '');
        },

        stopListeners() {
            this.unsubscribeGame?.();
            this.unsubscribePrivate?.();
            this.unsubscribeGame = null;
            this.unsubscribePrivate = null;
        },

        stop() {
            this.stopListeners();
            Object.entries(this.originalActions).forEach(([name, original]) => {
                TR[name] = original;
            });
            this.originalActions = {};
            this.patched = false;
            this.roomId = null;
            this.playerId = null;
            this.playerIndex = null;
            TR.G.multiplayer = false;
        }
    };

    window.TigrayRaminoMultiplayerGame = GameMP;
})();
