(function () {
'use strict';
const TR = window.TigrayRamino;

TR.dom = {};
TR.modalActive = false;

TR.G = {
    players: [],
    deck: [],
    discardPile: [],
    currentPlayer: 0,
    numPlayers: 2,
    phase: 'draw',
    selected: [],
    winner: null,
    mustOpen: false,
    lastDiscardJoker: false,
    monteMode: false,
    eliminated: [],
    jokerSwapActive: false
};

TR.drag = {
    active:false, type:null, ghost:null,
    startX:0, startY:0,
    fromSlotIdx:null, fromHandIdx:null, toSlotIdx:null,
    actionTarget:null, targetPlayerIdx:null, targetComboIdx:null,
    cards:[]
};

TR.initDOM = function () {
    const $ = id => document.getElementById(id);
    TR.dom.tableArea = $('table-area');
    TR.dom.handArea = $('hand-area');
    TR.dom.discardBox = $('discard-box');
    TR.dom.discardDisplay = $('discard-card-display');
    TR.dom.deckBox = $('deck-box');
    TR.dom.deckCount = $('deck-count');
    TR.dom.messageDiv = $('message');
    TR.dom.playerLabel = $('player-label');
    TR.dom.statusBadge = $('status-badge');
    TR.dom.discardHint = $('discard-hint');
    TR.dom.btnMonte = $('btn-monte');
};

TR.setMessage = function (msg) {
    if (TR.dom.messageDiv) TR.dom.messageDiv.textContent = msg;
};

TR.showModal = function (title, msg, showReady = true) {
    TR.modalActive = true;
    const old = document.querySelector('.modal-overlay');
    if (old) old.remove();

    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.innerHTML = `
        <div class="modal-box">
            <div class="big-emoji">📱</div>
            <h2>${title}</h2>
            <p>${msg}</p>
            ${showReady ? `<button class="btn-big" id="modal-ready">✅ I'm Ready</button>` : ''}
        </div>
    `;
    document.body.appendChild(div);

    if (showReady) {
        div.querySelector('#modal-ready').addEventListener('click', () => {
            div.remove();
            TR.modalActive = false;
            TR.renderAll();
        });
    } else {
        setTimeout(() => {
            if (div.parentNode) div.remove();
            TR.modalActive = false;
            TR.renderAll();
        }, 3000);
    }
};
})();