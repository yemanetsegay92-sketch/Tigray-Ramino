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
    montePlayer: null,
    monteRequest: null,
    monteWinPending: false,
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

    // The existing button is the restart/request button. Create the
    // separate Monte Win control without requiring HTML changes.
    if (TR.dom.btnMonte) {
        TR.dom.btnMonte.id = 'btn-declare-monte';
        TR.dom.btnMonte.textContent = '🎰 Declare Monte';
        TR.dom.btnMonte.style.width = 'auto';
        TR.dom.btnMonte.style.minWidth = '0';
        TR.dom.btnMonte.style.maxWidth = '48%';
        TR.dom.btnMonte.style.padding = '10px 16px';

        let wrap = TR.dom.btnMonte.parentElement;
        if (!wrap || !wrap.classList.contains('monte-controls')) {
            wrap = document.createElement('div');
            wrap.className = 'monte-controls';
            wrap.style.display = 'flex';
            wrap.style.justifyContent = 'center';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '10px';
            wrap.style.flexWrap = 'wrap';
            wrap.style.width = '100%';
            TR.dom.btnMonte.parentNode.insertBefore(wrap, TR.dom.btnMonte);
            wrap.appendChild(TR.dom.btnMonte);
        }

        let winBtn = document.getElementById('btn-monte-win');
        if (!winBtn) {
            winBtn = document.createElement('button');
            winBtn.id = 'btn-monte-win';
            winBtn.type = 'button';
            winBtn.textContent = '🏆 Monte Win';
            winBtn.style.width = 'auto';
            winBtn.style.minWidth = '0';
            winBtn.style.maxWidth = '48%';
            winBtn.style.padding = '10px 16px';
            wrap.appendChild(winBtn);
        }
        TR.dom.btnMonteWin = winBtn;
    }

    // Make the draw pile look like a neutral hidden card, never a Joker.
    const drawCard = TR.dom.deckBox && TR.dom.deckBox.querySelector('.deck-card');
    if (drawCard) {
        drawCard.textContent = '';
        drawCard.innerHTML = '';
        drawCard.removeAttribute('data-rank');
        drawCard.removeAttribute('data-card');
        drawCard.setAttribute('aria-label', 'Hidden draw pile card');
        drawCard.classList.add('neutral-draw-card');
    }
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