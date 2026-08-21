/* ================================================================
   TIGRAY RAMINO — MULTIPLAYER STAGE 2
   Real Firestore Lobby
   ================================================================ */

(function () {
    'use strict';

    const Multiplayer = {

        player: null,
        currentRoom: null,
        unsubscribeRoom: null,

        // ------------------------------------------------------------
        // Wait until firebase.js has finished loading
        // ------------------------------------------------------------
        async waitForFirebase() {

            if (window.RaminoFirebase) {
                return window.RaminoFirebase;
            }

            return new Promise((resolve, reject) => {

                let attempts = 0;

                const check = setInterval(() => {

                    if (window.RaminoFirebase) {
                        clearInterval(check);
                        resolve(window.RaminoFirebase);
                        return;
                    }

                    attempts++;

                    if (attempts > 100) {
                        clearInterval(check);
                        reject(new Error('Firebase did not load.'));
                    }

                }, 100);
            });
        },


        // ------------------------------------------------------------
        // Telegram player
        // ------------------------------------------------------------
        getTelegramUser() {

            try {

                const u =
                    window.Telegram?.WebApp?.initDataUnsafe?.user;

                if (u) {

                    return {
                        id: String(u.id),
                        firstName: u.first_name || 'Player',
                        username: u.username || ''
                    };

                }

            } catch (e) {}

            return {
                id: 'local-' + Date.now() + '-' +
                    Math.floor(Math.random() * 10000),

                firstName: 'Player',

                username: ''
            };
        },


        // ------------------------------------------------------------
        // Generate room code
        // ------------------------------------------------------------
        createRoomCode() {

            const chars =
                'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

            let code = '';

            for (let i = 0; i < 5; i++) {

                code += chars[
                    Math.floor(Math.random() * chars.length)
                ];

            }

            return code;
        },


        // ------------------------------------------------------------
        // Open lobby
        // ------------------------------------------------------------
        openLobby() {

            this.player = this.getTelegramUser();

            if (this.unsubscribeRoom) {
                this.unsubscribeRoom();
                this.unsubscribeRoom = null;
            }

            let old =
                document.getElementById(
                    'ramino-multiplayer-overlay'
                );

            if (old) old.remove();

            const el = document.createElement('div');

            el.id = 'ramino-multiplayer-overlay';

            el.innerHTML = `

                <div class="ramino-mp-panel">

                    <button
                        class="ramino-mp-close"
                        id="mp-close">
                        ×
                    </button>

                    <h2>🃏 Multiplayer</h2>

                    <p class="ramino-mp-subtitle">
                        Create a room or join a friend's room.
                    </p>

                    <button
                        class="ramino-mp-primary"
                        id="mp-create">
                        🎮 Create Game
                    </button>

                    <div class="ramino-mp-divider">
                        OR
                    </div>

                    <input
                        id="mp-code"
                        class="ramino-mp-input"
                        maxlength="5"
                        placeholder="Enter room code"
                        autocomplete="off"
                        autocapitalize="characters">

                    <button
                        class="ramino-mp-secondary"
                        id="mp-join">
                        🔑 Join Game
                    </button>

                    <div
                        id="mp-status"
                        class="ramino-mp-status">
                    </div>

                </div>
            `;

            document.body.appendChild(el);


            // Close
            document.getElementById('mp-close').onclick = () => {
                this.closeLobby();
            };


            // Create
            document.getElementById('mp-create').onclick = () => {
                this.createRoom();
            };


            // Join
            document.getElementById('mp-join').onclick = () => {

                const input =
                    document.getElementById('mp-code');

                const code =
                    input.value.trim().toUpperCase();

                if (!/^[A-Z0-9]{5}$/.test(code)) {

                    document.getElementById(
                        'mp-status'
                    ).textContent =
                        'Enter a valid 5-character room code.';

                    return;
                }

                this.joinRoom(code);
            };
        },


        // ------------------------------------------------------------
        // Close lobby
        // ------------------------------------------------------------
        closeLobby() {

            if (this.unsubscribeRoom) {
                this.unsubscribeRoom();
                this.unsubscribeRoom = null;
            }

            const overlay =
                document.getElementById(
                    'ramino-multiplayer-overlay'
                );

            if (overlay) overlay.remove();

            this.currentRoom = null;
        },


        // ------------------------------------------------------------
        // CREATE ROOM
        // ------------------------------------------------------------
        async createRoom() {

            const status =
                document.getElementById('mp-status');

            const createButton =
                document.getElementById('mp-create');

            if (status) {
                status.textContent =
                    '⏳ Creating game room...';
            }

            if (createButton) {
                createButton.disabled = true;
            }

            try {

                const Firebase =
                    await this.waitForFirebase();

                const db = Firebase.db;

                let roomCode = null;
                let roomRef = null;

                // Try a few times in case the random code
                // already exists.
                for (let attempt = 0; attempt < 5; attempt++) {

                    const code =
                        this.createRoomCode();

                    const ref =
                        Firebase.doc(
                            db,
                            'rooms',
                            code
                        );

                    const existing =
                        await Firebase.getDoc(ref);

                    if (!existing.exists()) {

                        roomCode = code;
                        roomRef = ref;
                        break;
                    }
                }

                if (!roomRef) {
                    throw new Error(
                        'Could not create a unique room.'
                    );
                }


                const now =
                    Firebase.serverTimestamp();


                await Firebase.setDoc(roomRef, {

                    roomId: roomCode,

                    hostId: this.player.id,

                    status: 'waiting',

                    maxPlayers: 4,

                    createdAt: now,

                    updatedAt: now,

                    players: {

                        [this.player.id]: {

                            id: this.player.id,

                            firstName:
                                this.player.firstName,

                            username:
                                this.player.username,

                            role: 'host',

                            joinedAt: now
                        }
                    }

                });


                this.currentRoom = {

                    id: roomCode,

                    hostId: this.player.id,

                    role: 'host'
                };


                this.showRoom(roomCode, true);

                this.listenToRoom(roomCode);

            } catch (error) {

                console.error(
                    'Create room error:',
                    error
                );

                if (status) {

                    status.textContent =
                        '❌ Could not create the room. ' +
                        'Please try again.';
                }

                if (createButton) {
                    createButton.disabled = false;
                }
            }
        },


        // ------------------------------------------------------------
        // JOIN ROOM
        // ------------------------------------------------------------
        async joinRoom(code) {

            const status =
                document.getElementById('mp-status');

            const joinButton =
                document.getElementById('mp-join');

            if (status) {
                status.textContent =
                    '⏳ Looking for room ' +
                    code +
                    '...';
            }

            if (joinButton) {
                joinButton.disabled = true;
            }

            try {

                const Firebase =
                    await this.waitForFirebase();

                const db = Firebase.db;

                const roomRef =
                    Firebase.doc(
                        db,
                        'rooms',
                        code
                    );

                const roomSnap =
                    await Firebase.getDoc(roomRef);


                // Room doesn't exist
                if (!roomSnap.exists()) {

                    if (status) {
                        status.textContent =
                            '❌ Room not found.';
                    }

                    if (joinButton) {
                        joinButton.disabled = false;
                    }

                    return;
                }


                const room =
                    roomSnap.data();


                // Don't allow joining a finished game
                if (room.status === 'playing' ||
                    room.status === 'finished') {

                    if (status) {
                        status.textContent =
                            '❌ This game has already started.';
                    }

                    if (joinButton) {
                        joinButton.disabled = false;
                    }

                    return;
                }


                const players =
                    room.players || {};

                const playerIds =
                    Object.keys(players);


                // Already in room
                if (players[this.player.id]) {

                    this.currentRoom = {

                        id: code,

                        hostId: room.hostId,

                        role:
                            room.hostId ===
                            this.player.id
                                ? 'host'
                                : 'player'
                    };

                    this.showRoom(
                        code,
                        room.hostId ===
                        this.player.id
                    );

                    this.listenToRoom(code);

                    return;
                }


                // Room full
                if (playerIds.length >=
                    (room.maxPlayers || 4)) {

                    if (status) {
                        status.textContent =
                            '❌ This room is full.';
                    }

                    if (joinButton) {
                        joinButton.disabled = false;
                    }

                    return;
                }


                // Add player
                players[this.player.id] = {

                    id: this.player.id,

                    firstName:
                        this.player.firstName,

                    username:
                        this.player.username,

                    role: 'player',

                    joinedAt:
                        Firebase.serverTimestamp()
                };


                await Firebase.updateDoc(
                    roomRef,
                    {

                        players: players,

                        updatedAt:
                            Firebase.serverTimestamp()
                    }
                );


                this.currentRoom = {

                    id: code,

                    hostId: room.hostId,

                    role: 'player'
                };


                this.showRoom(
                    code,
                    false
                );

                this.listenToRoom(code);


            } catch (error) {

                console.error(
                    'Join room error:',
                    error
                );

                if (status) {

                    status.textContent =
                        '❌ Could not join the room.';
                }

                if (joinButton) {
                    joinButton.disabled = false;
                }
            }
        },


        // ------------------------------------------------------------
        // SHOW ROOM
        // ------------------------------------------------------------
        showRoom(code, isHost) {

            const panel =
                document.querySelector(
                    '.ramino-mp-panel'
                );

            if (!panel) return;


            panel.innerHTML = `

                <button
                    class="ramino-mp-close"
                    id="mp-close">
                    ×
                </button>

                <h2>🎮 Game Room</h2>

                <div class="ramino-mp-code">
                    ${this.escape(code)}
                </div>

                <p class="ramino-mp-subtitle">
                    ${isHost
                        ? 'Share this code with your friends.'
                        : 'You joined this game.'}
                </p>

                <div
                    class="ramino-mp-players"
                    id="mp-players">

                    <div class="ramino-mp-waiting">
                        ⏳ Connecting...
                    </div>

                </div>

                <button
                    class="ramino-mp-primary"
                    id="mp-start">
                    🎮 Start Game
                </button>

                <button
                    class="ramino-mp-secondary"
                    id="mp-copy">
                    📋 Copy Room Code
                </button>

                <div
                    id="mp-status"
                    class="ramino-mp-status">
                    Waiting for players...
                </div>
            `;


            // Close
            document.getElementById(
                'mp-close'
            ).onclick = () => {
                this.closeLobby();
            };


            // Copy
            document.getElementById(
                'mp-copy'
            ).onclick = async () => {

                try {

                    await navigator.clipboard.writeText(
                        code
                    );

                    document.getElementById(
                        'mp-status'
                    ).textContent =
                        '✅ Room code copied: ' +
                        code;

                } catch (e) {

                    document.getElementById(
                        'mp-status'
                    ).textContent =
                        'Room code: ' +
                        code;
                }
            };


            // Start button
const startButton =
    document.getElementById('mp-start');

if (startButton) {

    // Only the host can start the game.
    if (!isHost) {

        startButton.disabled = true;

        startButton.textContent =
            '⏳ Waiting for Host...';

    } else {

        startButton.onclick = async () => {

            const status =
                document.getElementById('mp-status');

            startButton.disabled = true;

            if (status) {
                status.textContent =
                    '🎮 Starting game...';
            }

            try {

                if (
                    !window.TigrayRaminoMultiplayerGame
                ) {
                    throw new Error(
                        'multiplayer-game.js is not loaded.'
                    );
                }

                if (!this.currentRoom) {
                    throw new Error(
                        'No multiplayer room is active.'
                    );
                }

                const started =
                    await window
                        .TigrayRaminoMultiplayerGame
                        .start(
                            this.currentRoom
                        );

                if (started) {

                    // Game has successfully started.
                    // Now close the lobby.
                    this.closeLobby();
                }

            } catch (error) {

                console.error(
                    'Multiplayer start error:',
                    error
                );

                if (status) {
                    status.textContent =
                        '❌ Could not start game: ' +
                        error.message;
                }

                startButton.disabled = false;
            }
        };
    }
}
        },


        // ------------------------------------------------------------
        // REAL-TIME ROOM LISTENER
        // ------------------------------------------------------------
        listenToRoom(code) {

            if (this.unsubscribeRoom) {
                this.unsubscribeRoom();
                this.unsubscribeRoom = null;
            }


            this.waitForFirebase()
                .then(Firebase => {

                    const roomRef =
                        Firebase.doc(
                            Firebase.db,
                            'rooms',
                            code
                        );


                    this.unsubscribeRoom =
                        Firebase.onSnapshot(
                            roomRef,
                            snapshot => {

                                if (!snapshot.exists()) {

                                    const status =
                                        document.getElementById(
                                            'mp-status'
                                        );

                                    if (status) {

                                        status.textContent =
                                            '❌ Room no longer exists.';
                                    }

                                    return;
                                }


                                const room =
    snapshot.data();


// --------------------------------------------------------
// GAME HAS STARTED
// --------------------------------------------------------

if (room.status === 'playing') {

    // Keep the latest room information.
    this.currentRoom = {

        id: code,

        hostId:
            room.hostId,

        role:
            room.hostId ===
            this.player?.id
                ? 'host'
                : 'player'
    };

    // Tell the multiplayer game to enter the
    // Firestore-controlled game.
    if (
        window.TigrayRaminoMultiplayerGame
    ) {

        try {

            window
                .TigrayRaminoMultiplayerGame
                .start(
                    this.currentRoom
                );

        } catch (error) {

            console.error(
                'Could not enter multiplayer game:',
                error
            );
        }
    }

    // Close the lobby for Player 2.
    // The game itself is now controlled by Firestore.
    this.closeLobby();

    return;
}


// Normal waiting-room behavior.
this.renderPlayers(
    room
);
                            },

                            error => {

                                console.error(
                                    'Room listener error:',
                                    error
                                );

                                const status =
                                    document.getElementById(
                                        'mp-status'
                                    );

                                if (status) {

                                    status.textContent =
                                        '❌ Connection error.';
                                }
                            }
                        );
                });
        },


        // ------------------------------------------------------------
        // DISPLAY PLAYERS
        // ------------------------------------------------------------
        renderPlayers(room) {

            const container =
                document.getElementById(
                    'mp-players'
                );

            if (!container) return;


            const players =
                Object.values(
                    room.players || {}
                );


            if (!players.length) {

                container.innerHTML = `
                    <div class="ramino-mp-waiting">
                        ⏳ Waiting for players...
                    </div>
                `;

                return;
            }


            let html = '';


            players.forEach(player => {

                const isMe =
                    player.id ===
                    this.player?.id;

                html += `

                    <div class="ramino-mp-player">

                        👤

                        <strong>
                            ${this.escape(
                                player.firstName
                            )}
                            ${isMe ? '(You)' : ''}
                        </strong>

                        <small>
                            ${player.role === 'host'
                                ? 'Host'
                                : 'Player'}
                        </small>

                    </div>
                `;
            });


            container.innerHTML = html;


            const status =
                document.getElementById(
                    'mp-status'
                );


            if (status) {

                if (players.length >= 2) {

                    status.textContent =
                        '✅ ' +
                        players.length +
                        ' players connected.';

                } else {

                    status.textContent =
                        '⏳ Waiting for another player...';
                }
            }
        },


        // ------------------------------------------------------------
        // HTML ESCAPE
        // ------------------------------------------------------------
        escape(value) {

            return String(value)
                .replace(
                    /[&<>"']/g,
                    m => ({
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#039;'
                    }[m])
                );
        }
    };


    // ------------------------------------------------------------
    // PUBLIC API
    // ------------------------------------------------------------

    window.TigrayRaminoMultiplayer =
        Multiplayer;

})();