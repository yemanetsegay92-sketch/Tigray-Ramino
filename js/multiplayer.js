/* Tigray Ramino 2.0 — authenticated, callable-backed multiplayer lobby. */
(function () {
    'use strict';

    const Multiplayer = {
        player: null,
        currentRoom: null,
        unsubscribeRoom: null,
        enteringGame: false,

        async waitForFirebase() {
            if (!window.RaminoFirebase) {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Firebase did not load.')), 12000);
                    window.addEventListener('ramino-firebase-ready', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                    window.addEventListener('ramino-firebase-error', event => {
                        clearTimeout(timeout);
                        reject(event.detail || new Error('Firebase authentication failed.'));
                    }, { once: true });
                });
            }
            await window.RaminoFirebase.ready;
            return window.RaminoFirebase;
        },

        telegramDisplayName() {
            try {
                const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
                if (user) {
                    return [user.first_name, user.last_name].filter(Boolean).join(' ').slice(0, 32) || 'Player';
                }
            } catch (error) {
                console.warn('Telegram display name was unavailable:', error);
            }
            return localStorage.getItem('ramino_display_name') || 'Player';
        },

        async openLobby() {
            this.enteringGame = false;
            this.renderLobbyShell('Connecting securely…');
            try {
                const Firebase = await this.waitForFirebase();
                this.player = {
                    uid: Firebase.auth.currentUser.uid,
                    displayName: this.telegramDisplayName()
                };
                localStorage.setItem('ramino_display_name', this.player.displayName);
                this.renderLobbyHome();
            } catch (error) {
                this.setStatus(`Could not connect: ${this.errorMessage(error)}`);
            }
        },

        renderLobbyShell(statusText) {
            this.removeOverlay();
            const overlay = document.createElement('div');
            overlay.id = 'ramino-multiplayer-overlay';
            overlay.innerHTML = `
                <div class="ramino-mp-panel" role="dialog" aria-modal="true" aria-label="Online multiplayer">
                    <button class="ramino-mp-close" id="mp-close" aria-label="Close">×</button>
                    <h2>🃏 Multiplayer 2.0</h2>
                    <p class="ramino-mp-subtitle">Secure rooms with automatic reconnection.</p>
                    <div id="mp-content"></div>
                    <div id="mp-status" class="ramino-mp-status" aria-live="polite">${this.escape(statusText || '')}</div>
                </div>`;
            document.body.appendChild(overlay);
            document.getElementById('mp-close').onclick = () => this.closeLobby();
        },

        renderLobbyHome() {
            const content = document.getElementById('mp-content');
            if (!content) return;
            const savedCode = localStorage.getItem('ramino_last_room');
            content.innerHTML = `
                <label class="ramino-mp-label" for="mp-name">Player name</label>
                <input id="mp-name" class="ramino-mp-input" maxlength="32" autocomplete="nickname" value="${this.escape(this.player.displayName)}">
                <button class="ramino-mp-primary" id="mp-create">Create Game</button>
                ${savedCode ? `<button class="ramino-mp-secondary" id="mp-reconnect">Reconnect to ${this.escape(savedCode)}</button>` : ''}
                <div class="ramino-mp-divider">OR</div>
                <input id="mp-code" class="ramino-mp-input" maxlength="5" placeholder="Room code" autocomplete="off" autocapitalize="characters" inputmode="text">
                <button class="ramino-mp-secondary" id="mp-join">Join Game</button>`;
            document.getElementById('mp-create').onclick = () => this.createRoom();
            document.getElementById('mp-join').onclick = () => this.joinRoom();
            const reconnect = document.getElementById('mp-reconnect');
            if (reconnect) reconnect.onclick = () => this.joinRoom(savedCode);
            document.getElementById('mp-code').addEventListener('keydown', event => {
                if (event.key === 'Enter') this.joinRoom();
            });
            this.setStatus('Anonymous identity is secured on this device.');
        },

        updateDisplayName() {
            const input = document.getElementById('mp-name');
            const displayName = String(input?.value || this.player.displayName)
                .replace(/[\u0000-\u001f\u007f]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 32) || 'Player';
            this.player.displayName = displayName;
            localStorage.setItem('ramino_display_name', displayName);
            return displayName;
        },

        async createRoom() {
            this.setBusy(true, 'Creating room…');
            try {
                const Firebase = await this.waitForFirebase();
                const result = await Firebase.createRoom({ displayName: this.updateDisplayName() });
                await this.attachRoom(result.roomCode, result.role);
            } catch (error) {
                this.setBusy(false, this.errorMessage(error));
            }
        },

        async joinRoom(codeOverride) {
            const inputCode = codeOverride || document.getElementById('mp-code')?.value;
            const roomCode = String(inputCode || '').trim().toUpperCase();
            if (!/^[A-HJ-NP-Z2-9]{5}$/.test(roomCode)) {
                this.setStatus('Enter a valid five-character room code.');
                return;
            }
            this.setBusy(true, `Joining ${roomCode}…`);
            try {
                const Firebase = await this.waitForFirebase();
                const result = await Firebase.joinRoom({
                    roomCode,
                    displayName: this.updateDisplayName()
                });
                await this.attachRoom(result.roomCode, result.role);
            } catch (error) {
                this.setBusy(false, this.errorMessage(error));
            }
        },

        async attachRoom(roomCode, role) {
            this.currentRoom = { id: roomCode, role };
            localStorage.setItem('ramino_last_room', roomCode);
            this.showRoom();
            this.listenToRoom(roomCode);
        },

        showRoom() {
            const content = document.getElementById('mp-content');
            if (!content || !this.currentRoom) return;
            const isHost = this.currentRoom.role === 'host';
            content.innerHTML = `
                <div class="ramino-mp-code">${this.escape(this.currentRoom.id)}</div>
                <p class="ramino-mp-subtitle">Share this code with up to three friends.</p>
                <div id="mp-players" class="ramino-mp-players"></div>
                ${isHost ? '<button class="ramino-mp-primary" id="mp-start" disabled>Start Game</button>' : ''}
                <button class="ramino-mp-secondary" id="mp-leave">Leave Waiting Room</button>`;
            const start = document.getElementById('mp-start');
            if (start) start.onclick = () => this.startGame();
            document.getElementById('mp-leave').onclick = () => this.leaveRoom();
            this.setStatus('Waiting for room state…');
        },

        listenToRoom(roomCode) {
            if (this.unsubscribeRoom) this.unsubscribeRoom();
            const Firebase = window.RaminoFirebase;
            const roomRef = Firebase.doc(Firebase.db, 'rooms', roomCode);
            this.unsubscribeRoom = Firebase.onSnapshot(roomRef, snapshot => {
                if (!snapshot.exists()) {
                    this.setStatus('This room no longer exists.');
                    return;
                }
                const room = snapshot.data();
                this.currentRoom.role = room.hostUid === this.player.uid ? 'host' : 'player';
                this.renderPlayers(room);
                if ((room.status === 'playing' || room.status === 'finished') && !this.enteringGame) {
                    this.enteringGame = true;
                    window.TigrayRaminoMultiplayerGame.start(this.currentRoom).catch(error => {
                        this.enteringGame = false;
                        this.setStatus(this.errorMessage(error));
                    });
                }
            }, error => {
                this.setStatus(`Connection interrupted: ${this.errorMessage(error)}`);
            });
        },

        renderPlayers(room) {
            const container = document.getElementById('mp-players');
            if (!container) return;
            const players = Array.isArray(room.players) ? room.players : [];
            container.innerHTML = players.map(player => `
                <div class="ramino-mp-player">
                    <span>👤</span>
                    <strong>${this.escape(player.displayName)}${player.uid === this.player.uid ? ' (You)' : ''}</strong>
                    <small>${player.uid === room.hostUid ? 'Host' : 'Player'}</small>
                </div>`).join('');
            const start = document.getElementById('mp-start');
            if (start) start.disabled = players.length < 2 || room.status !== 'waiting';
            this.setStatus(room.status === 'waiting'
                ? (players.length < 2 ? 'Waiting for another player…' : `${players.length} players connected.`)
                : 'Game is ready. Reconnecting…');
        },

        async startGame() {
            this.setBusy(true, 'Starting server-authoritative game…');
            try {
                await window.RaminoFirebase.startGame({ roomCode: this.currentRoom.id });
            } catch (error) {
                this.setBusy(false, this.errorMessage(error));
            }
        },

        async leaveRoom() {
            if (!this.currentRoom) return this.closeLobby();
            try {
                await window.RaminoFirebase.leaveRoom({ roomCode: this.currentRoom.id });
                localStorage.removeItem('ramino_last_room');
                this.currentRoom = null;
                if (this.unsubscribeRoom) this.unsubscribeRoom();
                this.unsubscribeRoom = null;
                this.renderLobbyHome();
            } catch (error) {
                this.setStatus(this.errorMessage(error));
            }
        },

        closeLobby(preserveRoom) {
            this.removeOverlay();
            if (!preserveRoom && !this.enteringGame) {
                const modeScreen = document.getElementById('mode-screen');
                if (modeScreen) modeScreen.style.display = '';
            }
        },

        removeOverlay() {
            document.getElementById('ramino-multiplayer-overlay')?.remove();
        },

        setBusy(busy, message) {
            document.querySelectorAll('#ramino-multiplayer-overlay button, #ramino-multiplayer-overlay input')
                .forEach(element => {
                    if (!element.classList.contains('ramino-mp-close')) element.disabled = !!busy;
                });
            this.setStatus(message);
        },

        setStatus(message) {
            const status = document.getElementById('mp-status');
            if (status) status.textContent = message || '';
        },

        errorMessage(error) {
            return String(error?.message || 'Please try again.')
                .replace(/^Firebase:\s*/i, '')
                .replace(/^\w+(?:-\w+)*:\s*/i, '');
        },

        escape(value) {
            return String(value).replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
            }[character]));
        }
    };

    window.TigrayRaminoMultiplayer = Multiplayer;
})();
