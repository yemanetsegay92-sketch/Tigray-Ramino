/* ================================================================
   TIGRAY RAMINO — MULTIPLAYER GAME STAGE 2A

   Stage 2A:
   - Host starts the game
   - Firestore stores shared game state
   - Private hands are stored separately
   - Deck is synchronized
   - Discard pile is synchronized
   - Draw is synchronized
   - Take-discard is synchronized
   - Discard is synchronized
   - Current player is synchronized
   - Existing Ramino engine/rules are preserved

   NOT YET:
   - Full combo synchronization
   - Full joker synchronization
   - Full Monte synchronization
   - Full win synchronization
   ================================================================ */

(function () {
    'use strict';

    const TR = window.TigrayRamino;

    if (!TR) {
        console.error(
            'TigrayRamino engine is not loaded.'
        );
        return;
    }

    const GameMP = {

        roomId: null,
        playerId: null,
        playerIndex: null,

        unsubscribeGame: null,
        unsubscribePrivate: null,

        syncing: false,
        patched: false,

        originalDraw: null,
        originalTakeDiscard: null,
        originalDiscard: null,


        // ============================================================
        // WAIT FOR FIREBASE
        // ============================================================

        async waitForFirebase() {

            if (window.RaminoFirebase) {
                return window.RaminoFirebase;
            }

            return new Promise((resolve, reject) => {

                let attempts = 0;

                const timer = setInterval(() => {

                    if (window.RaminoFirebase) {

                        clearInterval(timer);

                        resolve(
                            window.RaminoFirebase
                        );

                        return;
                    }

                    attempts++;

                    if (attempts > 100) {

                        clearInterval(timer);

                        reject(
                            new Error(
                                'Firebase did not load.'
                            )
                        );
                    }

                }, 100);
            });
        },


        // ============================================================
        // CARD CONVERSION
        // ============================================================

        cardData(card) {

            if (!card) {
                return null;
            }

            return {
                id: String(card.id),
                suit: card.suit,
                rank: card.rank
            };
        },


        cardsData(cards) {

            return (cards || [])
                .filter(Boolean)
                .map(card =>
                    this.cardData(card)
                );
        },


        cardsFromData(cards) {

            return (cards || [])
                .filter(Boolean)
                .map(card => ({
                    id: String(card.id),
                    suit: card.suit,
                    rank: card.rank
                }));
        },


        // ============================================================
        // COMBO CONVERSION
        // ============================================================

        comboData(combo) {

            return {

                cards:
                    this.cardsData(
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
                    (combo.displayCards || [])
                        .map(dc => ({

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


        // ============================================================
        // PLAYER PUBLIC DATA
        // ============================================================

        playerPublicData(player) {

            return {

                opened:
                    !!player.opened,

                combos:
                    (player.combos || [])
                        .map(combo =>
                            this.comboData(combo)
                        ),

                handCount:
                    (player.hand || []).length
            };
        },


        // ============================================================
        // START
        // ============================================================

        async start(room) {

            if (!room || !room.id) {

                throw new Error(
                    'No multiplayer room is active.'
                );
            }


            if (!TR) {

                throw new Error(
                    'Ramino engine is not loaded.'
                );
            }


            this.roomId =
                room.id;


            this.playerId =
                window
                    .TigrayRaminoMultiplayer
                    ?.player
                    ?.id || null;


            if (!this.playerId) {

                throw new Error(
                    'Player identity not found.'
                );
            }


            const Firebase =
                await this.waitForFirebase();


            const db =
                Firebase.db;


            // --------------------------------------------------------
            // ROOM
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
            // MINIMUM PLAYERS
            // --------------------------------------------------------

            if (playerIds.length < 2) {

                this.setStatus(
                    '⏳ Need at least 2 players to start.'
                );

                return false;
            }


            // --------------------------------------------------------
            // HOST
            // --------------------------------------------------------

            const isHost =
                roomData.hostId ===
                this.playerId;


            if (!isHost) {

    // Player 2+ does NOT create the game.
    // They only enter the online game when
    // the host has started it.

    this.enterOnlineGame(room);

    return true;
}


            // --------------------------------------------------------
            // GAME DOCUMENT
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


            if (
                existing.exists() &&
                existing.data().status === 'playing'
            ) {

                this.listen(room);

                this.patchActions();

                return true;
            }


            // ========================================================
            // INITIALIZE EXISTING RAMINO ENGINE
            // ========================================================
// This is an ONLINE multiplayer game.
// Do not use the local pass-the-phone flow.
TR.G.multiplayer = true;
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


            TR.modalActive =
                false;


            // ========================================================
            // PLAYER ORDER
            // ========================================================

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


            // ========================================================
            // PUBLIC PLAYERS
            // ========================================================

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


                if (!localPlayer) {
                    continue;
                }


                publicPlayers.push({

                    id:
                        uid,

                    firstName:
                        players[uid]
                            ?.firstName ||
                        `Player ${i + 1}`,

                    username:
                        players[uid]
                            ?.username ||
                        '',

                    index:
                        i,

                    opened:
                        !!localPlayer.opened,

                    handCount:
                        localPlayer.hand.length,

                    combos:
                        (localPlayer.combos || [])
                            .map(combo =>
                                this.comboData(combo)
                            )
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

                            playerId:
                                uid,

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


            await Promise.all(
                privateWrites
            );


            // ========================================================
            // SHARED GAME STATE
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

                deck:
                    this.cardsData(
                        TR.G.deck
                    ),

                deckCount:
                    TR.G.deck.length,

                discardPile:
                    this.cardsData(
                        TR.G.discardPile
                    ),

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


            // --------------------------------------------------------
            // UPDATE ROOM STATUS
            // --------------------------------------------------------

            await Firebase.updateDoc(
                roomRef,
                {

                    status:
                        'playing',

                    updatedAt:
                        Firebase.serverTimestamp()
                }
            );


            this.setStatus(
                '🎮 Game started!'
            );


            this.patchActions();


            this.listen(room);


            return true;
        },

            
        // ============================================================
        // ENTER ONLINE GAME — NON-HOST PLAYERS
        // ============================================================

        enterOnlineGame(room) {

            if (!room || !room.id) {
                return;
            }

            this.roomId =
                room.id;

            this.playerId =
                window
                    .TigrayRaminoMultiplayer
                    ?.player
                    ?.id || null;

            if (!this.playerId) {

                console.error(
                    'Online player identity not found.'
                );

                return;
            }

            // This is an ONLINE game.
            // Do not use local pass-the-phone behavior.
            TR.G.multiplayer = true;

            // Initialize local engine structure.
            // Firestore will provide the real shared state.
            TR.initGame(2);

            // Remove local pass-phone modal.
            const modal =
                document.querySelector(
                    '.modal-overlay'
                );

            if (modal) {
                modal.remove();
            }

            TR.modalActive = false;

            // Connect game actions to multiplayer.
            this.patchActions();

            // Listen to Firestore.
            this.listen(room);

            // Close the multiplayer lobby.
            if (
                window.TigrayRaminoMultiplayer &&
                typeof window
                    .TigrayRaminoMultiplayer
                    .closeLobby === 'function'
            ) {

                window
                    .TigrayRaminoMultiplayer
                    .closeLobby();
            }
        },

        //      ============================================================
        // PATCH EXISTING RAMINO ACTIONS
        // ============================================================

        patchActions() {

            if (this.patched) {
                return;
            }


            this.patched =
                true;


            // --------------------------------------------------------
            // SAVE ORIGINAL FUNCTIONS
            // --------------------------------------------------------

            const originalDraw =
                TR.doDraw;

            const originalTakeDiscard =
                TR.doTakeDiscard;

            const originalDiscard =
                TR.doDiscardCard;


            this.originalDraw =
                originalDraw;

            this.originalTakeDiscard =
                originalTakeDiscard;

            this.originalDiscard =
                originalDiscard;


            // --------------------------------------------------------
            // DRAW
            // --------------------------------------------------------

            TR.doDraw = () => {

                this.requestDraw();
            };


            // --------------------------------------------------------
            // TAKE DISCARD
            // --------------------------------------------------------

            TR.doTakeDiscard = () => {

                this.requestTakeDiscard();
            };


            // --------------------------------------------------------
            // DISCARD
            // --------------------------------------------------------

            TR.doDiscardCard = (card) => {

                this.requestDiscard(
                    card
                );
            };
        },


        // ============================================================
        // CHECK MY TURN
        // ============================================================

        isMyTurn() {

            if (
                !this.playerIndex &&
                this.playerIndex !== 0
            ) {
                return false;
            }

            return (
                TR.G.currentPlayer ===
                this.playerIndex
            );
        },


        // ============================================================
        // REQUEST DRAW
        // ============================================================

        async requestDraw() {

            if (this.syncing) {
                return;
            }


            if (!this.isMyTurn()) {

                this.setStatus(
                    '⏳ It is not your turn.'
                );

                return;
            }


            if (TR.G.phase !== 'draw') {

                this.setStatus(
                    '⚠️ You must discard first.'
                );

                return;
            }


            if (!TR.G.deck.length) {

                this.setStatus(
                    '⚠️ Deck empty!'
                );

                return;
            }


            this.syncing =
                true;


            try {

                this.originalDraw.call(
                    TR
                );


                await this.publishCurrentState();


            } catch (error) {

                console.error(
                    'Multiplayer draw error:',
                    error
                );

                this.setStatus(
                    '❌ Draw failed: ' +
                    error.message
                );


            } finally {

                this.syncing =
                    false;
            }
        },


        // ============================================================
        // REQUEST TAKE DISCARD
        // ============================================================

        async requestTakeDiscard() {

            if (this.syncing) {
                return;
            }


            if (!this.isMyTurn()) {

                this.setStatus(
                    '⏳ It is not your turn.'
                );

                return;
            }


            if (TR.G.phase !== 'draw') {

                this.setStatus(
                    '⚠️ You must discard first.'
                );

                return;
            }


            if (!TR.G.discardPile.length) {

                this.setStatus(
                    '⚠️ No card to take.'
                );

                return;
            }


            this.syncing =
                true;


            try {

                this.originalTakeDiscard.call(
                    TR
                );


                await this.publishCurrentState();


            } catch (error) {

                console.error(
                    'Multiplayer take-discard error:',
                    error
                );

                this.setStatus(
                    '❌ Take failed: ' +
                    error.message
                );


            } finally {

                this.syncing =
                    false;
            }
        },


        // ============================================================
        // REQUEST DISCARD
        // ============================================================

        async requestDiscard(card) {

            if (this.syncing) {
                return;
            }


            if (!this.isMyTurn()) {

                this.setStatus(
                    '⏳ It is not your turn.'
                );

                return;
            }


            if (TR.G.phase !== 'discard') {

                this.setStatus(
                    '⚠️ You must draw or take discard first.'
                );

                return;
            }


            if (!card) {
                return;
            }


            this.syncing =
                true;


            try {

                const beforePlayer =
                    TR.G.currentPlayer;


                this.originalDiscard.call(
                    TR,
                    card
                );


                await this.publishCurrentState();


                if (
                    TR.G.winner === null &&
                    TR.G.currentPlayer !==
                    beforePlayer
                ) {

                    this.setStatus(

                        TR.G.currentPlayer ===
                        this.playerIndex

                            ? '👉 Your turn.'

                            : `⏳ Waiting for Player ${
                                TR.G.currentPlayer + 1
                              }...`
                    );
                }


            } catch (error) {

                console.error(
                    'Multiplayer discard error:',
                    error
                );

                this.setStatus(
                    '❌ Discard failed: ' +
                    error.message
                );


            } finally {

                this.syncing =
                    false;
            }
        },


        // ============================================================
        // PUBLISH CURRENT STATE
        // ============================================================

        async publishCurrentState() {

            const Firebase =
                await this.waitForFirebase();


            const db =
                Firebase.db;


            const gameRef =
                Firebase.doc(
                    db,
                    'rooms',
                    this.roomId,
                    'game',
                    'state'
                );


            const privateRef =
                Firebase.doc(
                    db,
                    'rooms',
                    this.roomId,
                    'privateHands',
                    this.playerId
                );


            // --------------------------------------------------------
            // MY PLAYER
            // --------------------------------------------------------

            const myPlayer =
                TR.G.players[
                    this.playerIndex
                ];


            if (!myPlayer) {

                throw new Error(
                    'Local player state not found.'
                );
            }


            // --------------------------------------------------------
            // READ CURRENT PUBLIC STATE
            // --------------------------------------------------------

            const gameSnap =
                await Firebase.getDoc(
                    gameRef
                );


            if (!gameSnap.exists()) {

                throw new Error(
                    'Multiplayer game state not found.'
                );
            }


            const currentState =
                gameSnap.data();


            const publicPlayers =
                Array.isArray(
                    currentState.players
                )
                    ? currentState.players
                        .map(p => ({
                            ...p
                        }))
                    : [];


            // --------------------------------------------------------
            // UPDATE OUR PUBLIC PLAYER DATA
            // --------------------------------------------------------

            if (
                publicPlayers[
                    this.playerIndex
                ]
            ) {

                publicPlayers[
                    this.playerIndex
                ].handCount =
                    myPlayer.hand.length;

                publicPlayers[
                    this.playerIndex
                ].opened =
                    !!myPlayer.opened;

                publicPlayers[
                    this.playerIndex
                ].combos =
                    (myPlayer.combos || [])
                        .map(combo =>
                            this.comboData(combo)
                        );
            }


            // ========================================================
            // PUBLIC UPDATE
            // ========================================================

            const update = {

                currentPlayer:
                    TR.G.currentPlayer,

                phase:
                    TR.G.phase,

                deck:
                    this.cardsData(
                        TR.G.deck
                    ),

                deckCount:
                    TR.G.deck.length,

                discardPile:
                    this.cardsData(
                        TR.G.discardPile
                    ),

                players:
                    publicPlayers,

                winner:
                    TR.G.winner,

                eliminated:
                    Array.isArray(
                        TR.G.eliminated
                    )
                        ? TR.G.eliminated.slice()
                        : [],

                lastDiscardJoker:
                    !!TR.G.lastDiscardJoker,

                monteMode:
                    !!TR.G.monteMode,

                montePlayer:
                    TR.G.montePlayer,

                mustOpen:
                    !!TR.G.mustOpen,

                updatedAt:
                    Firebase.serverTimestamp()
            };


            await Firebase.updateDoc(
                gameRef,
                update
            );


            // ========================================================
            // PRIVATE HAND
            // ========================================================

            await Firebase.setDoc(
                privateRef,
                {

                    playerId:
                        this.playerId,

                    hand:
                        this.cardsData(
                            myPlayer.hand
                        ),

                    handCount:
                        myPlayer.hand.length,

                    updatedAt:
                        Firebase.serverTimestamp()
                }
            );
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


                    // ------------------------------------------------
                    // STOP OLD LISTENERS
                    // ------------------------------------------------

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
                    // GAME STATE
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
                                // PRIVATE HAND
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
                })
                .catch(error => {

                    console.error(
                        'Multiplayer listen error:',
                        error
                    );

                    this.setStatus(
                        '❌ Could not connect to multiplayer game.'
                    );
                });
        },


        // ============================================================
        // APPLY PUBLIC STATE
        // ============================================================

        applyPublicState(state) {

            if (!TR) {
                return;
            }


            const orderedIds =
                state.playerIds || [];


            const publicPlayers =
                Array.isArray(state.players)
                    ? state.players
                    : [];


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


                        // ========================================================
            // FIND OUR PLAYER INDEX
            // ========================================================

            const myId =
                window
                    .TigrayRaminoMultiplayer
                    ?.player
                    ?.id;

            this.playerIndex =
                orderedIds.indexOf(
                    myId
                );


            // ========================================================
            // PUBLIC PLAYERS
            // ========================================================

            const existingMyHand =
                this.playerIndex !== null &&
                this.playerIndex !== undefined &&
                this.playerIndex >= 0 &&
                TR.G.players[this.playerIndex]
                    ? TR.G.players[this.playerIndex].hand || []
                    : [];


            TR.G.players =
                publicPlayers.map(
                    (pp, index) => ({

                        // Keep MY private hand locally.
                        // Other players' hands remain private.
                        hand:
                            index === this.playerIndex
                                ? existingMyHand
                                : [],

                        combos:
                            (pp.combos || [])
                                .map(c => ({

                                    cards:
                                        (c.cards || [])
                                            .map(x => ({
                                                ...x
                                            })),

                                    type:
                                        c.type ||
                                        'sequence',

                                    points:
                                        Number(
                                            c.points || 0
                                        ),

                                    displayCards:
                                        (c.displayCards || [])
                                            .map(dc => ({

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
                                            }))
                                })),

                        opened:
                            !!pp.opened
                    })
                );

            // ========================================================
            // PUBLIC DISCARD PILE
            // ========================================================

            TR.G.discardPile =
                (state.discardPile || [])
                    .map(
                        c => ({
                            ...c
                        })
                    );


            // ========================================================
// SYNCHRONIZED DECK
//
// The multiplayer game needs the actual card objects here.
// Using null placeholders causes the existing Ramino draw
// function to fail when it tries to read card.id.
// ========================================================

TR.G.deck =
    this.cardsFromData(
        state.deck || []
    );



            // ========================================================
            // RESET LOCAL SELECTION
            // ========================================================

            TR.G.selected =
                [];


            TR.G.jokerSwapActive =
                false;


            // ========================================================
            // RENDER
            // ========================================================

            if (
                typeof TR.renderAll ===
                'function'
            ) {

                TR.renderAll();
            }


            // ========================================================
            // TURN MESSAGE
            // ========================================================

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
                this.playerIndex === null ||
                this.playerIndex === undefined ||
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

                this.cardsFromData(
                    hand
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

            this.syncing =
                false;

            this.patched =
                false;
        }
    };


    // ================================================================
    // EXPORT
    // ================================================================

    window.TigrayRaminoMultiplayerGame =
        GameMP;

})();