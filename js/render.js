(function () {
'use strict';
const TR = window.TigrayRamino;

TR.renderAll=function(){
    if(TR.modalActive)return;

    const p=TR.currentPlayer();
    if(!p){
        TR.dom.messageDiv.textContent='Game over.';
        return;
    }

    const pts=TR.totalPoints(TR.G.currentPlayer);
    const combos=p.combos.length;
    const opened=TR.isOpened(TR.G.currentPlayer);

    TR.dom.playerLabel.textContent=`👤 Player ${TR.G.currentPlayer+1}`;

    let statusText=opened?'✅ Open':'🔒 Closed';
    if(opened){
        if(pts>=41)statusText+=` (${pts} pts)`;
        else if(combos>=3)statusText+=` (${combos} combos)`;
    }else{
        statusText+=` (${pts} pts, ${combos} combos)`;
    }

    TR.dom.statusBadge.textContent=statusText;
    TR.dom.deckCount.textContent=TR.G.deck.length;
    TR.dom.deckBox.classList.toggle('disabled',TR.G.phase!=='draw'||TR.G.winner!==null);

    if(TR.G.discardPile.length){
        const top=TR.G.discardPile[TR.G.discardPile.length-1];
        TR.dom.discardDisplay.textContent=TR.cardShort(top);
        TR.dom.discardDisplay.className='discard-card'+(TR.isJoker(top)?' joker-dc':'');
        const cc=TR.colorClass(top);
        if(cc)TR.dom.discardDisplay.classList.add(cc);
        TR.dom.discardHint.textContent=TR.G.phase==='draw'?'tap to take':'drop to discard';
        TR.dom.discardBox.classList.toggle('takeable',TR.G.phase==='draw'&&TR.G.winner===null);
    }else{
        TR.dom.discardDisplay.textContent='—';
        TR.dom.discardDisplay.className='discard-card';
        TR.dom.discardHint.textContent=TR.G.phase==='draw'?'empty':'drop to discard';
        TR.dom.discardBox.classList.toggle('takeable',false);
    }

    TR.renderTable();
    TR.renderHand();

    if (TR.dom.btnMonte) {
        TR.dom.btnMonte.disabled = (TR.G.winner!==null || !!TR.G.monteRequest);
        TR.dom.btnMonte.textContent = TR.G.monteRequest ? '⏳ Monte Requested' : '🎰 Declare Monte';
        TR.dom.btnMonte.classList.toggle('active', !!TR.G.monteRequest);
    }
    if (TR.dom.btnMonteWin) {
        const monteBelongsToCurrent =
            TR.G.monteMode && TR.G.montePlayer===TR.G.currentPlayer;

        // Once a player declares Monte Win, the declaration stays attached
        // to that player. Other players cannot accidentally activate or
        // inherit the Monte attempt on their turns.
        TR.dom.btnMonteWin.disabled =
            TR.G.winner!==null ||
            !!TR.G.monteRequest ||
            (TR.G.monteMode && TR.G.montePlayer!==TR.G.currentPlayer);

        TR.dom.btnMonteWin.textContent = '🏆 Monte Win';
        TR.dom.btnMonteWin.classList.toggle('active', monteBelongsToCurrent);
    }
};

TR.renderTable=function(){
    const area=TR.dom.tableArea;
    area.innerHTML='';

    for(let i=0;i<TR.G.players.length;i++){
        if(TR.G.eliminated.includes(i))continue;
        const pl=TR.G.players[i];

        for(let j=0;j<pl.combos.length;j++){
            const combo=pl.combos[j];

            const div=document.createElement('div');
            div.className='combo-group';
            div.dataset.playerIdx=i;
            div.dataset.comboIdx=j;

            const lbl=document.createElement('span');
            lbl.className='owner-label';
            lbl.textContent=`P${i+1}${i===TR.G.currentPlayer?' (you)':''}`;
            div.appendChild(lbl);

            const cd=document.createElement('div');
            cd.className='combo-cards';

            let displayCards=combo.displayCards;
            if(!displayCards){
                displayCards=TR.computeComboDisplay(combo.cards,combo.type);
                combo.displayCards=displayCards;
            }

            displayCards.forEach(dc=>{
                if(!dc)return;

                const sp=document.createElement('span');
                sp.className='cm-card';

                const isJoker=TR.isJoker(dc.card);
                if(isJoker)sp.classList.add('joker-cm');

                if(isJoker){
                    sp.innerHTML='';
                    const rep=document.createElement('span');
                    rep.className='joker-representation';
                    rep.textContent=dc.displaySuit;

                    const joker=document.createElement('span');
                    joker.className='joker-symbol';
                    joker.textContent='🃏';

                    sp.appendChild(rep);
                    sp.appendChild(joker);

                    sp.classList.add('joker-tappable');
                    sp.addEventListener('click',e=>{
                        e.stopPropagation();
                        if(TR.G.selected.length!==1)return;

                        const actualCardIdx=combo.cards.findIndex(c=>c.id===dc.card.id);
                        if(actualCardIdx===-1)return;

                        TR.tryJokerSwap(i,j,actualCardIdx);
                    });
                }else{
                    sp.textContent=dc.displayRank+dc.displaySuit;
                }

                const cc=TR.colorClass({suit:dc.displaySuit,rank:dc.displayRank});
                if(cc)sp.classList.add(cc);
                cd.appendChild(sp);
            });

            div.appendChild(cd);
            area.appendChild(div);
        }
    }

    // Exactly ONE permanent opening space. Existing combos stay visible,
    // while this single + slot remains available for the next new combo.
    const openingSlot=document.createElement('div');
    openingSlot.className='opening-slot';
    openingSlot.style.cssText='width:88px;height:88px;min-width:88px;border:2px dashed rgba(150,205,70,.55);border-radius:16px;display:flex;align-items:center;justify-content:center;color:#7fb83c;font-size:3rem;font-weight:700;box-sizing:border-box;margin:10px auto;';
    openingSlot.textContent='+';
    openingSlot.setAttribute('aria-label','Open a new combination here');
    area.appendChild(openingSlot);
};

TR.renderHand=function(){
    const area=TR.dom.handArea;
    area.innerHTML='';
    const hand=TR.currentPlayer().hand;

    for(let slotIdx=0;slotIdx<14;slotIdx++){
        const slot=document.createElement('div');
        slot.className='hand-slot';
        slot.dataset.slot=slotIdx;

        if(slotIdx>=hand.length){
            slot.classList.add('empty-slot');
        }else{
            const card=hand[slotIdx];
            const cardDiv=document.createElement('div');

            cardDiv.className='hand-card'+(TR.isJoker(card)?' joker-hc':'');
            cardDiv.dataset.handIdx=slotIdx;
            cardDiv.dataset.slot=slotIdx;
            cardDiv.dataset.cid=card.id;

            if(TR.G.selected.includes(slotIdx))cardDiv.classList.add('selected');

            const textSpan=document.createElement('span');
            textSpan.className='card-text';
            textSpan.textContent=TR.cardShort(card);
            const cc=TR.colorClass(card);
            if(cc)textSpan.classList.add(cc);
            cardDiv.appendChild(textSpan);

            TR.attachCardPointerEvents(cardDiv,slotIdx);
            slot.appendChild(cardDiv);
        }
        area.appendChild(slot);
    }
};
})();
