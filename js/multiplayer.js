/* ================================================================
   TIGRAY RAMINO — MULTIPLAYER LOBBY
   Stage 1: Firebase room/lobby
   ================================================================ */

(function () {
    'use strict';

    const Multiplayer = {

        player: null,
        currentRoom: null,


        // ------------------------------------------------------------
        // Get Telegram player
        // ------------------------------------------------------------
        getTelegramUser() {

            try {

                const u =
                    window.Telegram
                        ?.WebApp
                        ?.initDataUnsafe
                        ?.user;

                if (u) {

                    return {
                        id: String(u.id),
                        firstName:
                            u.first_name ||
                            'Player',
                        username:
                            u.username ||
                            ''
                    };
                }

            } catch (e) {

                console.error(
                    'Telegram user error:',
                    e
                );
            }


            return {

                id:
                    'local-' +
                    Date.now(),

                firstName:
                    'Player',

                username:
                    ''
            };
        },


        // ------------------------------------------------------------
        // Create room code
        // ------------------------------------------------------------
        createRoomCode() {

            const chars =
                'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

            let code = '';

            for (
                let i = 0;
                i < 5;
                i++
            ) {

                code +=
                    chars[
                        Math.floor(
                            Math.random() *
                            chars.length
                        )
                    ];
            }

            return code;
        },


        // ------------------------------------------------------------
        // Open lobby
        // ------------------------------------------------------------
        openLobby() {

            this.player =
                this.getTelegramUser();


            const old =
                document.getElementById(
                    'ramino-multiplayer-overlay'
                );


            if (old) {
                old.remove();
            }


            const el =
                document.createElement(
                    'div'
                );


            el.id =
                'ramino-multiplayer-overlay';


            el.innerHTML = `

                <div class="ramino-mp-panel">

                    <button
                        class="ramino-mp-close"
                        id="mp-close"
                    >
                        ×
                    </button>

                    <h2>
                        🃏 Multiplayer
                    </h2>

                    <p class="ramino-mp-subtitle">
                        Create a room or join a friend's room.
                    </p>


                    <button
                        class="ramino-mp-primary"
                        id="mp-create"
                    >
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
                    >


                    <button
                        class="ramino-mp-secondary"
                        id="mp-join"
                    >
                        🔑 Join Game
                    </button>


                    <div
                        id="mp-status"
                        class="ramino-mp-status"
                    ></div>

                </div>
            `;


            document.body.appendChild(el);


            // --------------------------------------------------------
            // Close
            // --------------------------------------------------------
            document.getElementById(
                'mp-close'
            ).onclick = () => {

                this.closeLobby();

            };


            // --------------------------------------------------------
            // Create
            // --------------------------------------------------------
            document.getElementById(
                'mp-create'
            ).onclick = () => {

                const code =
                    this.createRoomCode();

                this.showRoom(
                    code,
                    true
                );

            };


            // --------------------------------------------------------
            // Join
            // --------------------------------------------------------
            document.getElementById(
                'mp-join'
            ).onclick = () => {

                const input =
                    document.getElementById(
                        'mp-code'
                    );


                const code =
                    input.value
                        .trim()
                        .toUpperCase();


                if (
                    !/^[A-Z0-9]{5}$/.test(
                        code
                    )
                ) {

                    document.getElementById(
                        'mp-status'
                    ).textContent =
                        'Enter a valid 5-character room code.';

                    return;
                }


                this.showRoom(
                    code,
                    false
                );
            };
        },


        // ------------------------------------------------------------
        // Show room
        // ------------------------------------------------------------
        showRoom(
            code,
            isHost
        ) {

            this.currentRoom = {

                id: code,

                hostId:
                    isHost
                        ? this.player.id
                        : null
            };


            const panel =
                document.querySelector(
                    '.ramino-mp-panel'
                );


            if (!panel) {
                return;
            }


            panel.innerHTML = `

                <button
                    class="ramino-mp-close"
                    id="mp-close"
                >
                    ×
                </button>


                <h2>
                    🎮 Game Room
                </h2>


                <div class="ramino-mp-code">
                    ${code}
                </div>


                <p class="ramino-mp-subtitle">

                    ${
                        isHost
                            ? 'Share this code with the other players.'
                            : 'Room connection is ready.'
                    }

                </p>


                <div class="ramino-mp-players">

                    <div class="ramino-mp-player">

                        👤

                        <strong>
                            ${this.escape(
                                this.player.firstName
                            )}
                        </strong>

                        <small>
                            ${
                                isHost
                                    ? 'Host'
                                    : 'Player'
                            }
                        </small>

                    </div>


                    <div class="ramino-mp-waiting">

                        ⏳ Waiting for players...

                    </div>

                </div>


                <button
                    class="ramino-mp-primary"
                    id="mp-start"
                >
                    🎮 Start Game
                </button>


                <button
                    class="ramino-mp-secondary"
                    id="mp-copy"
                >
                    📋 Copy Room Code
                </button>


                <div
                    id="mp-status"
                    class="ramino-mp-status"
                >
                    Stage 1 lobby ready.
                </div>

            `;


            // --------------------------------------------------------
            // Close
            // --------------------------------------------------------
            document.getElementById(
                'mp-close'
            ).onclick = () => {

                this.closeLobby();

            };


            // --------------------------------------------------------
            // Copy
            // --------------------------------------------------------
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


            // --------------------------------------------------------
            // Start
            // --------------------------------------------------------
            document.getElementById(
                'mp-start'
            ).onclick = () => {

                document.getElementById(
                    'mp-status'
                ).textContent =
                    '⏳ Firebase game connection comes next.';

            };
        },


        // ------------------------------------------------------------
        // Close lobby
        // ------------------------------------------------------------
        closeLobby() {

            const overlay =
                document.getElementById(
                    'ramino-multiplayer-overlay'
                );


            if (overlay) {
                overlay.remove();
            }
        },


        // ------------------------------------------------------------
        // Escape HTML
        // ------------------------------------------------------------
        escape(value) {

            return String(
                value
            ).replace(
                /[&<>"']/g,
                m => ({

                    '&':
                        '&amp;',

                    '<':
                        '&lt;',

                    '>':
                        '&gt;',

                    '"':
                        '&quot;',

                    "'":
                        '&#039;'

                }[m])
            );
        }

    };


    // --------------------------------------------------------------
    // Make globally available
    // --------------------------------------------------------------
    window.TigrayRaminoMultiplayer =
        Multiplayer;


})();