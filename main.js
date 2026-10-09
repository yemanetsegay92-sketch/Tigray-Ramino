(function () {
    'use strict';

    const TR = window.TigrayRamino;

    function start() {

        TR.initDOM();

        // ------------------------------------------------------------
        // NORMAL GAME CONTROLS
        // ------------------------------------------------------------

        TR.dom.deckBox.addEventListener('click', () => {

            if (
                TR.G.phase === 'draw' &&
                TR.G.winner === null
            ) {
                TR.doDraw();
            }

        });


        TR.dom.discardBox.addEventListener('click', () => {

            if (
                TR.G.phase === 'draw' &&
                TR.G.winner === null &&
                TR.G.discardPile.length
            ) {
                TR.doTakeDiscard();
            }

        });


        TR.dom.discardDisplay.addEventListener('click', e => {

            e.stopPropagation();

            if (
                TR.G.phase === 'draw' &&
                TR.G.winner === null &&
                TR.G.discardPile.length
            ) {
                TR.doTakeDiscard();
            }

        });


        if (TR.dom.btnMonte) {

            TR.dom.btnMonte.addEventListener(
                'click',
                TR.requestMonteRestart
            );

        }


        if (TR.dom.btnMonteWin) {

            TR.dom.btnMonteWin.addEventListener(
                'click',
                TR.doMonteWin
            );

        }


        const howToPlay=document.getElementById('btn-how-to-play');
        if(howToPlay)howToPlay.addEventListener('click',()=>{
            TR.modalActive=true;
            const overlay=document.createElement('div');
            overlay.className='modal-overlay';
            overlay.innerHTML=`<div class="modal-box" style="max-height:82vh;overflow:auto;text-align:left">
                <h2>🃏 How to Play</h2>
                <p><strong>Turns:</strong> The first player gets 14 cards and discards first.
                Other players get 13. Draw or take the last discard, play cards, then discard.
                A winning turn must also end with a discard.</p>
                <p><strong>Opening:</strong> In one turn, open 41+ points across valid combinations,
                three valid combinations of any total, or a valid four-image combination:
                same-suit J–Q–K–A or a four-card group of J, Q, K, or A.
                All three give the same rights. An unfinished opening attempt eliminates you.</p>
                <p><strong>Combinations:</strong> Sequences use the same suit, at least three consecutive cards,
                with Ace low or high and no K–A–2 wrap. Groups use three or four equal ranks,
                different suits, with alternating red/black colors. At most one Joker per combination.</p>
                <p><strong>Jokers:</strong> Only normally opened players can replace a table Joker
                with its exact card. After replacing one, win that turn with a final discard or be eliminated.</p>
                <p><strong>Monte Win:</strong> Tap to commit to winning this turn with five identical pairs,
                one valid three-card combination, and a final discard. A Joker can pair with an ordinary card.
                You may tap after taking the discard. Monte does not grant normal opening rights,
                and you cannot replace a table Joker. Failure eliminates you.</p>
                <p><strong>Elimination:</strong> Your openings and all cards you added to other players’ combinations
                are removed. A combination that becomes invalid is also cleared.</p>
                <p><strong>Declare Monte:</strong> This is the separate request to restart with everyone’s agreement.</p>
                <button class="btn-big" id="rules-close">Close</button>
            </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('#rules-close').addEventListener('click',()=>{
                overlay.remove();TR.modalActive=false;
            });
        });

        // ------------------------------------------------------------
        // TRAINING / LOCAL
        // ------------------------------------------------------------

        const trainingBtn =
            document.getElementById(
                'btn-training'
            );


        if (trainingBtn) {

            trainingBtn.addEventListener(
                'click',
                () => {

                    // Hide welcome screen
                    const modeScreen =
                        document.getElementById(
                            'mode-screen'
                        );

                    if (modeScreen) {
                        modeScreen.style.display =
                            'none';
                    }


                    // Show player-count selection
                    TR.showPlayerCountModal();

                }
            );

        }


        // ------------------------------------------------------------
        // ONLINE MULTIPLAYER
        // ------------------------------------------------------------

        const onlineBtn =
            document.getElementById(
                'btn-online'
            );


        if (onlineBtn) {

            onlineBtn.addEventListener(
                'click',
                () => {

                    // Hide welcome screen
                    const modeScreen =
                        document.getElementById(
                            'mode-screen'
                        );

                    if (modeScreen) {
                        modeScreen.style.display =
                            'none';
                    }


                    // Open Firestore multiplayer lobby
                    if (
                        window.TigrayRaminoMultiplayer &&
                        typeof
                            window
                                .TigrayRaminoMultiplayer
                                .openLobby ===
                            'function'
                    ) {

                        window
                            .TigrayRaminoMultiplayer
                            .openLobby();

                    } else {

                        console.error(
                            'Multiplayer lobby is not loaded.'
                        );

                        alert(
                            'Multiplayer is not ready yet.'
                        );

                    }

                }
            );

        }

    }


    // ================================================================
    // LOCAL PLAYER COUNT
    // ================================================================

    TR.showPlayerCountModal = function () {

        TR.modalActive = true;


        const old =
            document.querySelector(
                '.modal-overlay'
            );


        if (old) {
            old.remove();
        }


        const div =
            document.createElement(
                'div'
            );


        div.className =
            'modal-overlay';


        div.innerHTML = `

            <div class="modal-box">

                <div class="big-emoji">
                    🃏
                </div>

                <h2>
                    Training / Local
                </h2>

                <p>
                    Players will share the same phone.
                </p>

                <p>
                    How many players?
                </p>

                <div
                    style="
                        display:flex;
                        gap:10px;
                        justify-content:center;
                        flex-wrap:wrap
                    "
                >

                    <button
                        class="btn-big"
                        data-n="2"
                    >
                        2 Players
                    </button>

                    <button
                        class="btn-big"
                        data-n="3"
                    >
                        3 Players
                    </button>

                    <button
                        class="btn-big"
                        data-n="4"
                    >
                        4 Players
                    </button>

                </div>

            </div>
        `;


        document.body.appendChild(
            div
        );


        div
            .querySelectorAll(
                '[data-n]'
            )
            .forEach(btn => {

                btn.addEventListener(
                    'click',
                    () => {

                        const n =
                            parseInt(
                                btn.dataset.n,
                                10
                            );


                        div.remove();

                        TR.modalActive =
                            false;


                        TR.initGame(
                            n
                        );

                    }
                );

            });

    };


    // ================================================================
    // START
    // ================================================================

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            start
        );

    } else {

        start();

    }

})();