/* ================================================================
   TIGRAY RAMINO — MULTIPLAYER GAME STAGE 1
   Firestore game-start + private-hand foundation.

   Stage 1:
   - Host starts the game
   - Firestore stores the shared game state
   - Each player gets a private hand
   - Players receive game updates in real time

   Card moves are NOT synchronized yet.
   ================================================================ */

(function () {
    'use strict';

    const GameMP = {

        roomId: null,
        playerId: null,
        playerIndex: null,

        unsubscribeGame: null,
        unsubscribePrivate: null,


        // ------------------------------------------------------------
        // Wait for Firebase
        // ------------------------------------------------------------
        async waitForFirebase() {

            if (window.RaminoFirebase) {
                return window.RaminoFirebase;
            }

            return new Promise((resolve, reject) => {

                let attempts = 0;

                const timer = setInterval(() => {

                    if (window.RaminoFirebase) {
                        clearInterval(timer);
                        resolve(window.RaminoFirebase);
                        return;
                    }

                    attempts++;

                    if (attempts > 100) {
                        clearInterval(timer);
                        reject(
                            new Error('Firebase did not load.')
                        );
                    }

                }, 100);
            });
        },


        // ------------------------------------------------------------
        // Convert one card to Firestore-safe data
        // ------------------------------------------------------------
        cardData(card) {

            if (!card) return null;

            return {
                id: String(card.id),
                suit: card.suit,
                rank: card.rank
            };
        },


        // ------------------------------------------------------------
        // Convert cards
        // ------------------------------------------------------------
        cardsData(cards) {

            return (cards || []).map(card =>
                this.cardData(card)
            );
        },


        // ------------------------------------------------------------
        // Convert a combination
        // ------------------------------------------------------------
        comboData(combo) {

            return {

                cards: this.cardsData(
                    combo.cards
                ),

                type:
                    combo.type ||
                    'sequence',

                points:
                    Number(
                        combo.points || 0
                    ),

                displayCards:
                    (combo.displayCards || []).map(dc => ({

                        card:
                            this.cardData(
                                dc.card
                            ),

                        displayRank:
                            dc.displayRank,

                        displaySuit:
                            dc.displaySuit
                    }))
            };
        },


        // ------------------------------------------------------------
        // Public player information
        // ------------------------------------------------------------
        playerPublicData(player) {

            return {

                opened:
                    !!player.opened,

                combos:
                    (player.combos || []).map(
                        combo =>
                            this.comboData(combo)
                    ),

                handCount:
                    (player.hand || []).length
            };
        },


        // ============================================================
        // START MULTIPLAYER GAME
        // ============================================================
        async start(room) {

            if (!room || !room.id) {

                throw new Error(
                    'No multiplayer room is active.'
                );
            }


            this.roomId = room.id;


            this.playerId =
                window
                    .TigrayRaminoMultiplayer
                    ?.player
                    ?.id || null;


            const Firebase =
                await this.waitForFirebase();


            const db =
                Firebase.db;


            // --------------------------------------------------------
            // Read room
            // --------------------------------------------------------
            const roomRef =
                Firebase.doc(
                    db,
                    'rooms',
                    this.roomId
                );


            const roomSnap =
                await Firebase.getDoc(
                    roomRef
                );


            if (!roomSnap.exists()) {

                throw new Error(
                    'Room no longer exists.'
                );
            }


            const roomData =
                roomSnap.data();


            const players =
                roomData.players || {};


            const playerIds =
                Object.keys(players);


            // --------------------------------------------------------
            // Minimum 2 players
            // --------------------------------------------------------
            if (playerIds.length < 2) {

                this.setStatus(
                    '⏳ Need at least 2 players to start.'
                );

                return false;
            }


            // --------------------------------------------------------
            // Only host creates initial game
            // --------------------------------------------------------
            const isHost =
                roomData.hostId ===
                this.playerId;


            if (!isHost) {

                this.setStatus(
                    '⏳ Waiting for the host to start the game...'
                );

                this.listen(room);

                return false;
            }


            // --------------------------------------------------------
            // Game document
            // --------------------------------------------------------
            const gameRef =
                Firebase.doc(
                    db,
                    'rooms',
                    this.roomId,
                    'game',
                    'state'
                );


            const existing =
                await Firebase.getDoc(
                    gameRef
                );


            // Don't create another game
            if (
                existing.exists() &&
                existing.data().status === 'playing'
            ) {

                this.listen(room);

                return true;
            }


            // ========================================================
            // CREATE INITIAL RAMINO GAME
            // ========================================================

            /*
             * Uses your existing Ramino engine.
             *
             * Player 1 receives 14 cards.
             * Other players receive 13 cards.
             */

            TR.initGame(
                playerIds.length
            );


            // Remove local pass-phone modal.
            const modal =
                document.querySelector(
                    '.modal-overlay'
                );


            if (modal) {
                modal.remove();
            }


            TR.modalActive = false;


            // --------------------------------------------------------
            // Establish player order
            // --------------------------------------------------------
            const ordered =
                playerIds.slice().sort(
                    (a, b) => {

                        if (
                            a === roomData.hostId
                        ) {
                            return -1;
                        }

                        if (
                            b === roomData.hostId
                        ) {
                            return 1;
                        }

                        const at =
                            players[a]
                                ?.joinedAt
                                ?.seconds || 0;

                        const bt =
                            players[b]
                                ?.joinedAt
                                ?.seconds || 0;

                        return at - bt;
                    }
                );


            // --------------------------------------------------------
            // Build public player information
            // --------------------------------------------------------
            const publicPlayers = [];


            const privateWrites = [];


            for (
                let i = 0;
                i < ordered.length;
                i++
            ) {

                const uid =
                    ordered[i];


                const localPlayer =
                    TR.G.players[i];


                publicPlayers.push({

                    id: uid,

                    firstName:
                        players[uid]
                            ?.firstName ||
                        `Player ${i + 1}`,

                    username:
                        players[uid]
                            ?.username ||
                        '',

                    index: i,

                    opened: false,

                    handCount:
                        localPlayer.hand.length,

                    combos: []
                });


                // ----------------------------------------------------
                // PRIVATE HAND
                // ----------------------------------------------------
                privateWrites.push(

                    Firebase.setDoc(

                        Firebase.doc(

                            db,

                            'rooms',
                            this.roomId,

                            'privateHands',
                            uid
                        ),

                        {

                            playerId: uid,

                            hand:
                                this.cardsData(
                                    localPlayer.hand
                                ),

                            handCount:
                                localPlayer.hand.length,

                            updatedAt:
                                Firebase.serverTimestamp()
                        }
                    )
                );
            }


            // Write all private hands.
            await Promise.all(
                privateWrites
            );


            // ========================================================
            // PUBLIC GAME STATE
            // ========================================================

            const publicState = {

                status:
                    'playing',

                roomId:
                    this.roomId,

                playerIds:
                    ordered,

                players:
                    publicPlayers,

                currentPlayer:
                    0,

                phase:
                    TR.G.phase,

                deckCount:
                    TR.G.deck.length,

                discardPile:
                    [],

                winner:
                    null,

                eliminated:
                    [],

                lastDiscardJoker:
                    false,

                monteMode:
                    false,

                montePlayer:
                    null,

                mustOpen:
                    false,

                startedAt:
                    Firebase.serverTimestamp(),

                updatedAt:
                    Firebase.serverTimestamp()
            };


            await Firebase.setDoc(
                gameRef,
                publicState
            );


            this.setStatus(
                '🎮 Game started!'
            );


            this.listen(room);


            return true;
        },


        // ============================================================
        // LISTEN TO GAME
        // ============================================================
        listen(room) {

            if (
                !room ||
                !room.id
            ) {
                return;
            }


            this.roomId =
                room.id;


            this.waitForFirebase()
                .then(Firebase => {

                    const db =
                        Firebase.db;


                    // Stop previous listeners.
                    if (
                        this.unsubscribeGame
                    ) {

                        this.unsubscribeGame();

                        this.unsubscribeGame =
                            null;
                    }


                    if (
                        this.unsubscribePrivate
                    ) {

                        this.unsubscribePrivate();

                        this.unsubscribePrivate =
                            null;
                    }


                    // ------------------------------------------------
                    // Shared game document
                    // ------------------------------------------------
                    const gameRef =
                        Firebase.doc(

                            db,

                            'rooms',
                            this.roomId,

                            'game',
                            'state'
                        );


                    this.unsubscribeGame =

                        Firebase.onSnapshot(

                            gameRef,

                            snapshot => {

                                if (
                                    !snapshot.exists()
                                ) {
                                    return;
                                }


                                const state =
                                    snapshot.data();


                                if (
                                    state.status !==
                                    'playing'
                                ) {
                                    return;
                                }


                                this.applyPublicState(
                                    state
                                );


                                // ------------------------------------
                                // Listen to OUR private hand
                                // ------------------------------------
                                const myId =
                                    window
                                        .TigrayRaminoMultiplayer
                                        ?.player
                                        ?.id;


                                if (!myId) {
                                    return;
                                }


                                const privateRef =
                                    Firebase.doc(

                                        db,

                                        'rooms',
                                        this.roomId,

                                        'privateHands',
                                        myId
                                    );


                                if (
                                    this.unsubscribePrivate
                                ) {

                                    this.unsubscribePrivate();

                                    this.unsubscribePrivate =
                                        null;
                                }


                                this.unsubscribePrivate =

                                    Firebase.onSnapshot(

                                        privateRef,

                                        privateSnap => {

                                            if (
                                                !privateSnap.exists()
                                            ) {
                                                return;
                                            }


                                            const data =
                                                privateSnap.data();


                                            this.applyPrivateHand(
                                                data.hand ||
                                                []
                                            );
                                        }
                                    );
                            },

                            error => {

                                console.error(
                                    'Multiplayer game listener error:',
                                    error
                                );


                                this.setStatus(
                                    '❌ Game connection error.'
                                );
                            }
                        );
                });
        },


        // ============================================================
        // APPLY PUBLIC GAME STATE
        // ============================================================
        applyPublicState(state) {

            if (
                !window.TigrayRamino
            ) {
                return;
            }


            const orderedIds =
                state.playerIds || [];


            const publicPlayers =
                state.players || [];


            TR.G.numPlayers =
                orderedIds.length || 2;


            TR.G.currentPlayer =
                Number.isInteger(
                    state.currentPlayer
                )
                    ? state.currentPlayer
                    : 0;


            TR.G.phase =
                state.phase ||
                'draw';


            TR.G.winner =
                state.winner === null ||
                state.winner === undefined
                    ? null
                    : state.winner;


            TR.G.eliminated =
                Array.isArray(
                    state.eliminated
                )
                    ? state.eliminated.slice()
                    : [];


            TR.G.lastDiscardJoker =
                !!state.lastDiscardJoker;


            TR.G.monteMode =
                !!state.monteMode;


            TR.G.montePlayer =
                state.montePlayer === null ||
                state.montePlayer === undefined
                    ? null
                    : state.montePlayer;


            TR.G.mustOpen =
                !!state.mustOpen;


            // --------------------------------------------------------
            // Public information only.
            //
            // We deliberately DO NOT put other players' hands here.
            // --------------------------------------------------------
            TR.G.players =
                publicPlayers.map(
                    pp => ({

                        hand: [],

                        combos:
                            (pp.combos || [])
                                .map(c => ({

                                    cards:
                                        (c.cards || [])
                                            .map(
                                                x => ({
                                                    ...x
                                                })
                                            ),

                                    type:
                                        c.type,

                                    points:
                                        c.points,

                                    displayCards:
                                        (c.displayCards || [])
                                            .map(
                                                dc => ({

                                                    card:
                                                        dc.card
                                                            ? {
                                                                ...dc.card
                                                            }
                                                            : null,

                                                    displayRank:
                                                        dc.displayRank,

                                                    displaySuit:
                                                        dc.displaySuit
                                                })
                                            )
                                })),

                        opened:
                            !!pp.opened
                    })
                );


            // --------------------------------------------------------
            // Public discard pile
            // --------------------------------------------------------
            TR.G.discardPile =
                (state.discardPile || [])
                    .map(
                        c => ({
                            ...c
                        })
                    );


            // --------------------------------------------------------
            // Deck is represented only by its count for now.
            // --------------------------------------------------------
            TR.G.deck =
                new Array(
                    Math.max(
                        0,
                        Number(
                            state.deckCount ||
                            0
                        )
                    )
                ).fill(null);


            // --------------------------------------------------------
            // Find our player index.
            // --------------------------------------------------------
            const myId =
                window
                    .TigrayRaminoMultiplayer
                    ?.player
                    ?.id;


            this.playerIndex =
                orderedIds.indexOf(
                    myId
                );


            if (
                this.playerIndex < 0
            ) {
                return;
            }


            TR.G.selected = [];

            TR.G.jokerSwapActive =
                false;


            // Render current state.
            if (
                typeof TR.renderAll ===
                'function'
            ) {

                TR.renderAll();
            }


            // Turn message.
            if (
                TR.G.currentPlayer ===
                this.playerIndex
            ) {

                this.setStatus(
                    '👉 Your turn.'
                );

            } else {

                this.setStatus(
                    `⏳ Waiting for Player ${
                        TR.G.currentPlayer + 1
                    }...`
                );
            }
        },


        // ============================================================
        // APPLY PRIVATE HAND
        // ============================================================
        applyPrivateHand(hand) {

            if (
                this.playerIndex ===
                null ||
                this.playerIndex ===
                undefined ||
                this.playerIndex < 0
            ) {
                return;
            }


            if (
                !TR.G.players[
                    this.playerIndex
                ]
            ) {
                return;
            }


            TR.G.players[
                this.playerIndex
            ].hand =

                (hand || [])
                    .map(
                        card => ({
                            ...card
                        })
                    );


            if (
                typeof TR.renderAll ===
                'function'
            ) {

                TR.renderAll();
            }
        },


        // ============================================================
        // STATUS
        // ============================================================
        setStatus(message) {

            const el =
                document.getElementById(
                    'mp-status'
                );


            if (el) {
                el.textContent =
                    message;
            }


            if (
                window.TigrayRamino?.setMessage
            ) {

                TR.setMessage(
                    message
                );
            }
        },


        // ============================================================
        // STOP
        // ============================================================
        stop() {

            if (
                this.unsubscribeGame
            ) {

                this.unsubscribeGame();

                this.unsubscribeGame =
                    null;
            }


            if (
                this.unsubscribePrivate
            ) {

                this.unsubscribePrivate();

                this.unsubscribePrivate =
                    null;
            }


            this.roomId =
                null;

            this.playerId =
                null;

            this.playerIndex =
                null;
        }
    };


    window.TigrayRaminoMultiplayerGame =
        GameMP;

})();