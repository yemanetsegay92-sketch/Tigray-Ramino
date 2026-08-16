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

    TR.dom.btnMonte.disabled=(TR.G.winner!==null||TR.G.monteMode);
    if(TR.G.monteMode){
        TR.dom.btnMonte.textContent='🔮 Monte Mode Active';
        TR.dom.btnMonte.classList.add('active');
    }else{
        TR.dom.btnMonte.textContent='🎰 Declare Monte';
        TR.dom.btnMonte.classList.remove('active');
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

    if(!area.children.length){
        const empty=document.createElement('div');
        empty.style.cssText='width:100%;text-align:center;color:#5a8a5a;padding:14px;font-size:0.9rem;';
        empty.textContent='🃏 Drop here to create a new combo · Drop onto a combo to add';
        area.appendChild(empty);
    }
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