(function () {
'use strict';
const TR = window.TigrayRamino;

TR.cleanupDrag=function(){
    if(TR.drag.ghost){
        TR.drag.ghost.remove();
        TR.drag.ghost=null;
    }

    document.querySelectorAll('.hand-card').forEach(el=>el.classList.remove('dragging'));
    document.querySelectorAll('.hand-slot.drag-over-slot').forEach(el=>el.classList.remove('drag-over-slot'));
    document.querySelectorAll('.combo-group.drag-over-combo').forEach(el=>el.classList.remove('drag-over-combo'));

    TR.dom.tableArea.classList.remove('drag-over');
    TR.dom.discardBox.classList.remove('drag-over');

    TR.drag.active=false;
    TR.drag.type=null;
    TR.drag.cards=[];
};

TR.reorderSelectedCards=function(dropIndex){
    const p=TR.currentPlayer();
    if(!p||!TR.G.selected.length)return;

    const selectedSet=new Set(TR.G.selected);
    const movingCards=p.hand.filter((_,i)=>selectedSet.has(i));
    const remaining=p.hand.filter((_,i)=>!selectedSet.has(i));

    let insertIndex=0;
    for(let i=0;i<dropIndex;i++){
        if(!selectedSet.has(i))insertIndex++;
    }

    remaining.splice(insertIndex,0,...movingCards);
    p.hand=remaining;
    TR.G.selected=[];
    TR.renderAll();
};

TR.attachCardPointerEvents=function(cardDiv,handIdx){
    let pointerId=null,isDragging=false,startX=0,startY=0,hasMoved=false;

    const onDown=e=>{
        if(TR.G.winner!==null)return;
        pointerId=e.pointerId;
        startX=e.clientX;
        startY=e.clientY;
        hasMoved=false;
        isDragging=false;

        try{cardDiv.setPointerCapture(pointerId);}catch(_){}

        cardDiv.addEventListener('pointermove',onMove);
        cardDiv.addEventListener('pointerup',onUp);
        cardDiv.addEventListener('pointercancel',onUp);
        e.preventDefault();
    };

    const onMove=e=>{
        const dx=e.clientX-startX,dy=e.clientY-startY;
        const dist=Math.sqrt(dx*dx+dy*dy);

        if(dist>10&&!isDragging){
            hasMoved=true;
            isDragging=true;

            if(!TR.G.selected.includes(handIdx))TR.G.selected=[handIdx];

            const hand=TR.currentPlayer().hand;
            const actionCards=TR.G.selected.map(i=>hand[i]).filter(Boolean);

            const ghost=document.createElement('div');
            ghost.className='drag-ghost';
            ghost.textContent=actionCards.length===1
                ?TR.cardShort(actionCards[0])
                :`🃏 ${actionCards.length} cards`;

            if(actionCards.length===1){
                const cc=TR.colorClass(actionCards[0]);
                if(cc)ghost.classList.add(cc);
                if(TR.isJoker(actionCards[0]))ghost.style.color='#f0d060';
            }else ghost.classList.add('multi');

            document.body.appendChild(ghost);
            ghost.style.left=(e.clientX-25)+'px';
            ghost.style.top=(e.clientY-25)+'px';

            TR.drag.ghost=ghost;
            TR.drag.active=true;
            TR.drag.type='hand-action';
            TR.drag.cards=actionCards;
            TR.drag.fromSlotIdx=handIdx;
            TR.drag.fromHandIdx=handIdx;

            document.querySelectorAll('.hand-card').forEach(el=>el.classList.add('dragging'));
        }

        if(!isDragging)return;

        if(TR.drag.ghost){
            TR.drag.ghost.style.left=(e.clientX-25)+'px';
            TR.drag.ghost.style.top=(e.clientY-25)+'px';
        }

        document.querySelectorAll('.hand-slot.drag-over-slot').forEach(el=>el.classList.remove('drag-over-slot'));
        document.querySelectorAll('.combo-group.drag-over-combo').forEach(el=>el.classList.remove('drag-over-combo'));
        TR.dom.tableArea.classList.remove('drag-over');
        TR.dom.discardBox.classList.remove('drag-over');

        const el=document.elementFromPoint(e.clientX,e.clientY);
        let overHand=false,overTable=false,overDiscard=false,targetComboEl=null;

        if(el){
            overHand=!!el.closest('#hand-area');
            targetComboEl=el.closest('.combo-group');
            if(targetComboEl)overTable=true;
            else if(el.closest('#table-area'))overTable=true;
            overDiscard=!!el.closest('#discard-box');
        }

        TR.drag.toSlotIdx=null;

        if(overHand){
            const slots=TR.dom.handArea.querySelectorAll('.hand-slot');
            let closest=null,closestDistance=Infinity;

            for(const slot of slots){
                const rect=slot.getBoundingClientRect();
                const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
                const distance=Math.sqrt((e.clientX-cx)**2+(e.clientY-cy)**2);
                if(distance<closestDistance){closestDistance=distance;closest=slot;}
            }

            if(closest){
                TR.drag.toSlotIdx=parseInt(closest.dataset.slot);
                closest.classList.add('drag-over-slot');
            }

            TR.drag.actionTarget='hand';
            TR.drag.targetPlayerIdx=null;
            TR.drag.targetComboIdx=null;
        }else if(targetComboEl){
            TR.dom.tableArea.classList.add('drag-over');
            targetComboEl.classList.add('drag-over-combo');

            TR.drag.targetPlayerIdx=parseInt(targetComboEl.dataset.playerIdx);
            TR.drag.targetComboIdx=parseInt(targetComboEl.dataset.comboIdx);
            TR.drag.actionTarget='combo';
        }else if(overTable){
            TR.dom.tableArea.classList.add('drag-over');
            TR.drag.targetPlayerIdx=null;
            TR.drag.targetComboIdx=null;
            TR.drag.actionTarget='table';
        }else if(overDiscard){
            TR.dom.discardBox.classList.add('drag-over');
            TR.drag.targetPlayerIdx=null;
            TR.drag.targetComboIdx=null;
            TR.drag.actionTarget='discard';
        }else{
            TR.drag.targetPlayerIdx=null;
            TR.drag.targetComboIdx=null;
            TR.drag.actionTarget=null;
        }
    };

    const onUp=e=>{
        cardDiv.removeEventListener('pointermove',onMove);
        cardDiv.removeEventListener('pointerup',onUp);
        cardDiv.removeEventListener('pointercancel',onUp);

        if(isDragging){
            // IMPORTANT: save everything BEFORE cleanup.
            const actionTarget=TR.drag.actionTarget;
            const cardsToProcess=TR.drag.cards.slice();
            const targetPlayerIdx=TR.drag.targetPlayerIdx;
            const targetComboIdx=TR.drag.targetComboIdx;
            const toSlotIdx=TR.drag.toSlotIdx;

            // IMPORTANT: cleanup BEFORE any action calls renderAll().
            TR.cleanupDrag();

            if(actionTarget==='hand'&&toSlotIdx!==null){
                TR.reorderSelectedCards(toSlotIdx);
            }else if(actionTarget==='combo'){
                if(cardsToProcess.length===1){
                    TR.doAddToCombo(cardsToProcess[0],targetPlayerIdx,targetComboIdx);
                }else{
                    TR.setMessage('⚠️ You can only add 1 card at a time');
                    TR.renderAll();
                }
            }else if(actionTarget==='table'){
                TR.doOpenCombo(cardsToProcess);
            }else if(actionTarget==='discard'){
                if(cardsToProcess.length===1){
                    TR.doDiscardCard(cardsToProcess[0]);
                }else{
                    TR.setMessage('⚠️ Select only 1 card to discard');
                    TR.renderAll();
                }
            }else{
                TR.setMessage('💡 Drop inside your hand to rearrange, on a combo to add, or on discard to discard.');
                TR.renderAll();
            }

            return;
        }

        if(!hasMoved){
            const pos=TR.G.selected.indexOf(handIdx);
            if(pos>-1)TR.G.selected.splice(pos,1);
            else TR.G.selected.push(handIdx);
            TR.renderAll();
        }
    };

    cardDiv.addEventListener('pointerdown',onDown);
};
})();