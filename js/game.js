(function () {
'use strict';
const TR = window.TigrayRamino;
TR.isOnlineGame=function(){
    return TR.G.multiplayer === true;
};
TR.isEliminated=function(playerIdx){ return TR.G.eliminated.includes(playerIdx); };

TR.eliminatePlayer=function(playerIdx, reason){
    const p=TR.G.players[playerIdx];
    if(!p || TR.G.eliminated.includes(playerIdx)) return false;

    TR.G.eliminated.push(playerIdx);
    TR.G.jokerSwapActive=false;
    TR.G.mustOpen=false;
    TR.G.selected=[];
  
    // Remove the eliminated player's table cards from play and return
    // them to the discard pile, just as a failed Monte is handled.
    const allCards=[];
    for(const combo of p.combos || []){
        for(const c of combo.cards || []) allCards.push(c);
    }
    if(allCards.length) TR.G.discardPile=TR.G.discardPile.concat(allCards);
    p.combos=[];

    const active=TR.G.players.filter((_,i)=>!TR.G.eliminated.includes(i));

    if(active.length===0){
        TR.setMessage(`❌ Player ${playerIdx+1} eliminated. ${reason} Game over.`);
        TR.renderAll();
        return true;
    }

    if(active.length===1){
        const winnerIdx=TR.G.players.findIndex((_,i)=>!TR.G.eliminated.includes(i));
        TR.G.winner=winnerIdx;
        TR.setMessage(`🏆 Player ${winnerIdx+1} wins! (opponent eliminated)`);
        TR.renderAll();
        TR.showModal(
            '🎉 WINNER!',
            `Player ${winnerIdx+1} wins!\n\n❌ Player ${playerIdx+1} eliminated.\n${reason}`,
            false
        );
        return true;
    }

    TR.G.currentPlayer=(playerIdx+1)%TR.G.numPlayers;
    while(TR.G.eliminated.includes(TR.G.currentPlayer)){
        TR.G.currentPlayer=(TR.G.currentPlayer+1)%TR.G.numPlayers;
    }

    const nextP=TR.G.players[TR.G.currentPlayer];
    if(nextP.hand.length===14){
        TR.G.phase='discard';
        TR.setMessage(`❌ Player ${playerIdx+1} eliminated. ${reason} 👉 Player ${TR.G.currentPlayer+1}: 14 cards. Discard one.`);
    }else{
        TR.G.phase='draw';
        TR.setMessage(`❌ Player ${playerIdx+1} eliminated. ${reason} 👉 Player ${TR.G.currentPlayer+1}'s turn.`);
    }

    TR.renderAll();
    if(!TR.isOnlineGame()){
    TR.showModal(
        `❌ Player ${playerIdx+1} Eliminated`,
        `${reason}\n\n👉 Player ${TR.G.currentPlayer+1}, pass the phone and press "I'm Ready".`,
        true
    );
    }
    return true;
};

TR.currentPlayer=function(){
    let idx=TR.G.currentPlayer, attempts=0;
    while(TR.isEliminated(idx) && attempts<TR.G.numPlayers){
        idx=(idx+1)%TR.G.numPlayers;
        attempts++;
    }
    return attempts>=TR.G.numPlayers ? null : TR.G.players[idx];
};

TR.initGame=function(num){
    if(num<2||num>4) num=2;

    TR.G.numPlayers=num;
    TR.G.currentPlayer=0;
    TR.G.winner=null;
    TR.G.phase='discard';
    TR.G.selected=[];
    TR.G.mustOpen=false;
    TR.G.lastDiscardJoker=false;
    TR.G.monteMode=false;
    TR.G.montePlayer=null;
    TR.G.monteRequest=null;
    TR.G.monteWinPending=false;
    TR.G.eliminated=[];
    TR.G.jokerSwapActive=false;

    TR.G.deck=TR.shuffle(TR.createDeck());
    TR.G.players=[];

    for(let i=0;i<num;i++) TR.G.players.push({hand:[],combos:[],opened:false});

    for(let i=0;i<14;i++) if(TR.G.deck.length) TR.G.players[0].hand.push(TR.G.deck.pop());

    for(let p=1;p<num;p++)
        for(let i=0;i<13;i++) if(TR.G.deck.length) TR.G.players[p].hand.push(TR.G.deck.pop());

    TR.G.discardPile=[];
    if(TR.dom.btnMonte) TR.dom.btnMonte.textContent='🎰 Declare Monte';
    if(TR.dom.btnMonteWin) TR.dom.btnMonteWin.textContent='🏆 Monte Win';
    TR.setMessage('🃏 Player 1: Discard one by dragging to discard pile.');
    TR.renderAll();
    if(!TR.isOnlineGame()){
    TR.showModal(
        '👤 Player 1',
        'Pass the phone and press "I\'m Ready"',
        true
    );
    }
};

TR.doDraw=function(){
    if(TR.G.winner!==null) return;
    if(TR.G.phase!=='draw'){TR.setMessage('⚠️ You must discard first');return;}
    if(!TR.G.deck.length){TR.setMessage('⚠️ Deck empty!');return;}

    const p=TR.currentPlayer();
    if(!p)return;
    if(p.hand.length>=14){TR.setMessage('⚠️ Hand full (14). Discard first.');return;}

    p.hand.push(TR.G.deck.pop());
    TR.G.phase='discard';
    TR.G.selected=[];
    TR.G.jokerSwapActive=false;
    TR.setMessage('📥 Drew a card. Discard or place combos.');
    TR.renderAll();
};

TR.doTakeDiscard=function(){
    if(TR.G.winner!==null)return;
    if(TR.G.phase!=='draw'){TR.setMessage('⚠️ You must discard first');return;}
    if(!TR.G.discardPile.length){TR.setMessage('⚠️ No card to take');return;}

    const p=TR.currentPlayer();
    if(!p)return;
    if(p.hand.length>=14){TR.setMessage('⚠️ Hand full (14). Cannot take.');return;}

    if(!TR.isOpened(TR.G.currentPlayer)){
        TR.G.mustOpen=true;
        TR.setMessage('📥 Took discard. You MUST open before discarding!');
    }else{
        TR.setMessage('📥 Took discard. Discard or place combos.');
    }

    p.hand.push(TR.G.discardPile.pop());
    TR.G.phase='discard';
    TR.G.selected=[];
    TR.renderAll();
};

TR.doOpenCombo=function(cards){
    if(TR.G.winner!==null)return;
    if(TR.G.phase!=='draw'&&TR.G.phase!=='discard')return;

    const p=TR.currentPlayer();
    if(!p)return;
    if(cards.length<2){TR.setMessage('⚠️ Need at least 2 cards');return;}

    const handIds=new Set(p.hand.map(c=>c.id));
    for(const card of cards){
        if(!handIds.has(card.id)){
            TR.setMessage('❌ One or more cards are not in your hand.');
            return;
        }
    }

    let result=TR.validateSeq(cards);
    let type='sequence';

    if(!result.valid){result=TR.validateGroup(cards);type='group';}

    if(!result.valid){
        if(!TR.G.monteMode){
            TR.setMessage(`❌ ${result.reason}. Pairs are only allowed in Monte mode. Tap "Declare Monte" first.`);
            return;
        }
        result=TR.validatePair(cards);
        type='pair';
    }

    if(!result.valid){TR.setMessage('❌ '+result.reason);return;}

    const ids=new Set(cards.map(c=>c.id));
    p.hand=p.hand.filter(c=>!ids.has(c.id));

    const combo={
        cards:cards.slice(),
        type,
        points:result.points,
        displayCards:TR.computeComboDisplay(cards,type)
    };
    p.combos.push(combo);
    TR.G.selected=[];

    const pts=TR.totalPoints(TR.G.currentPlayer);
    const combos=p.combos.length;
    const opened=(pts>=41||combos>=3);

    if(opened){
        p.opened=true;
        TR.G.mustOpen=false;
        TR.setMessage(pts>=41?`✅ Opened! (${pts} pts)`:`✅ Opened! (${combos} combos)`);
    }else if(TR.G.mustOpen){
        TR.setMessage(`⚠️ Need 41 pts or 3 combos to open! (${pts} pts, ${combos} combos)`);
    }else{
        TR.setMessage(`✅ Combo added. (${pts} pts, ${combos} combos)`);
    }

    // A turn can NEVER be won by opening alone. If the player's hand
    // becomes empty before the required discard, the player is eliminated.
    if(p.hand.length===0){
        TR.setMessage(`❌ Player ${TR.G.currentPlayer+1} eliminated: You used your last card before discarding.`);
        TR.eliminatePlayer(
            TR.G.currentPlayer,
            'You used your last card before discarding.'
        );
        return;
    }

    TR.renderAll();
};

TR.doAddToCombo=function(card,targetPlayerIdx,targetComboIdx){
    if(TR.G.winner!==null)return;
    if(TR.G.phase!=='draw'&&TR.G.phase!=='discard')return;

    const p=TR.currentPlayer();
    if(!p)return;

    if(!TR.isOpened(TR.G.currentPlayer)){
        TR.setMessage('❌ You must be opened (41 pts or 3 combos) to add to combos');
        return;
    }

    const handIdx=p.hand.findIndex(c=>c.id===card.id);
    if(handIdx===-1){TR.setMessage('⚠️ Card not in hand');return;}

    const target=TR.G.players[targetPlayerIdx];
    if(!target||targetComboIdx>=target.combos.length){
        TR.setMessage('⚠️ Target combo not found');return;
    }

    const combo=target.combos[targetComboIdx];
    if(combo.type==='pair'){TR.setMessage('⚠️ Cannot add to a pair');return;}

    if(combo.type==='group'){
        const existing=combo.cards;
        if(existing.length>=4){TR.setMessage('❌ A group cannot contain more than 4 cards.');return;}

        if(!TR.isJoker(card)){
            const existingReal=existing.filter(c=>!TR.isJoker(c));
            if(existingReal.length&&card.rank!==existingReal[0].rank){
                TR.setMessage('❌ The added card must have the same rank as the group.');
                return;
            }

            const occupiedSuits=existingReal.map(c=>c.suit);
            const display=TR.computeComboDisplay(existing,'group');
            const jd=display.find(d=>TR.isJoker(d.card));
            if(jd)occupiedSuits.push(jd.displaySuit);

            if(occupiedSuits.includes(card.suit)){
                TR.setMessage(`❌ ${card.suit} is already represented in this group.`);
                return;
            }
        }

        const newCards=[...existing,card];
        const result=TR.validateGroup(newCards);

        if(!result.valid){
            TR.setMessage('❌ Cannot add this card: '+result.reason+' The group order must remain valid.');
            return;
        }

        p.hand.splice(handIdx,1);
        combo.cards=newCards;
        combo.points=result.points;
        combo.displayCards=TR.computeComboDisplay(newCards,'group');

        TR.G.selected=[];
        const owner=targetPlayerIdx===TR.G.currentPlayer?'your':`Player ${targetPlayerIdx+1}'s`;
        TR.setMessage(`✅ Added ${TR.cardShort(card)} to ${owner} group!`);
    } else if(combo.type==='sequence'){
        const newCards=[...combo.cards,card];
        const result=TR.validateSeq(newCards);
        if(!result.valid){TR.setMessage('❌ Cannot add: '+result.reason);return;}

        p.hand.splice(handIdx,1);
        combo.cards=newCards;
        combo.points=result.points;
        combo.displayCards=TR.computeComboDisplay(newCards,'sequence');

        TR.G.selected=[];
        const owner=targetPlayerIdx===TR.G.currentPlayer?'your':`Player ${targetPlayerIdx+1}'s`;
        TR.setMessage(`✅ Added ${TR.cardShort(card)} to ${owner} sequence!`);
    }else{
        TR.setMessage('⚠️ Unknown combo type');
        return;
    }

    // A turn can NEVER be won by adding alone. If the player's hand
    // becomes empty before the required discard, eliminate immediately.
    if(p.hand.length===0){
        TR.setMessage(`❌ Player ${TR.G.currentPlayer+1} eliminated: You used your last card before discarding.`);
        TR.eliminatePlayer(
            TR.G.currentPlayer,
            'You used your last card before discarding.'
        );
        return;
    }

    TR.renderAll();
};

TR.doDiscardCard=function(card){
    if(TR.G.winner!==null)return;
    if(TR.G.phase!=='discard'){TR.setMessage('⚠️ You must draw or take first');return;}

    const p=TR.currentPlayer();
    if(!p)return;

    if(TR.G.mustOpen){
        TR.setMessage('⚠️ You MUST open (41 pts or 3 combos) before discarding!');
        return;
    }

    const idx=p.hand.findIndex(c=>c.id===card.id);
    if(idx===-1)return;

    p.hand.splice(idx,1);
    TR.G.discardPile.push(card);
    TR.G.lastDiscardJoker=TR.isJoker(card);
    TR.G.selected=[];

    if(TR.G.monteMode && TR.G.montePlayer===TR.G.currentPlayer && p.hand.length===0){
        const result=TR.validateMonte(TR.G.currentPlayer);

        if(result.valid){
            // The final card has already been discarded. A valid Monte
            // automatically wins immediately — no second claim/tap is needed.
            TR.G.winner=TR.G.currentPlayer;
            TR.G.monteWinPending=false;
            TR.G.monteMode=false;
            TR.G.montePlayer=null;
            const mult=TR.G.lastDiscardJoker?4:2;
            const msg=mult>=4
                ?`🏆 Player ${TR.G.currentPlayer+1} wins by QUADRUPLE MONTE! 🃏💰`
                :`🏆 Player ${TR.G.currentPlayer+1} wins by DOUBLE MONTE! 🃏`;
            TR.setMessage(msg);
            TR.renderAll();
            TR.showModal('🎉 MONTE!',msg,false);
            return;
        }

        const reason=result.reason;
        const allCards=[];
        for(const combo of p.combos)for(const c of combo.cards)allCards.push(c);
        p.combos=[];
        TR.G.discardPile=TR.G.discardPile.concat(allCards);
        TR.G.eliminated.push(TR.G.currentPlayer);
        TR.G.monteMode=false;
        TR.G.montePlayer=null;
        TR.G.monteWinPending=false;

        const active=TR.G.players.filter((_,i)=>!TR.G.eliminated.includes(i));

        if(active.length===1){
            const winnerIdx=TR.G.players.findIndex((_,i)=>!TR.G.eliminated.includes(i));
            TR.G.winner=winnerIdx;
            TR.setMessage(`🏆 Player ${winnerIdx+1} wins! (opponent eliminated)`);
            TR.renderAll();
            TR.showModal('🎉 WINNER!',`Player ${winnerIdx+1} wins!`,false);
            return;
        }

        TR.G.currentPlayer=(TR.G.currentPlayer+1)%TR.G.numPlayers;
        while(TR.G.eliminated.includes(TR.G.currentPlayer))
            TR.G.currentPlayer=(TR.G.currentPlayer+1)%TR.G.numPlayers;

        TR.G.phase='draw';
        TR.G.selected=[];
        TR.setMessage(`❌ Monte rejected: ${reason}. Player ${TR.G.currentPlayer+1}'s turn.`);
        TR.renderAll();
        TR.showModal('❌ Monte Failed',`Reason: ${reason}. Player eliminated.`,true);
        return;
    }

    // A Joker swap creates a special WIN-OR-LOSE turn. The swapped Joker
    // itself is completely normal; we only care whether this discard
    // actually finishes the game.
    if(TR.G.jokerSwapActive){
        if(p.hand.length===0 && TR.isOpened(TR.G.currentPlayer) && !(TR.G.monteMode && TR.G.montePlayer===TR.G.currentPlayer)){
            TR.G.winner=TR.G.currentPlayer;
            TR.G.jokerSwapActive=false;
            const mult=TR.G.lastDiscardJoker?2:1;
            const msg=mult>=2
                ?`🏆 Player ${TR.G.currentPlayer+1} wins by DOUBLE! 🤑`
                :`🏆 Player ${TR.G.currentPlayer+1} WINS! 🎉`;
            TR.setMessage(msg);
            TR.renderAll();
            TR.showModal('🎉 WINNER!',msg,false);
            return;
        }

        TR.eliminatePlayer(
            TR.G.currentPlayer,
            'You swapped a Joker but did not win the game on that turn.'
        );
        return;
    }

    if(p.hand.length===0 && TR.isOpened(TR.G.currentPlayer) && !(TR.G.monteMode && TR.G.montePlayer===TR.G.currentPlayer)){
        TR.G.winner=TR.G.currentPlayer;
        const mult=TR.G.lastDiscardJoker?2:1;
        const msg=mult>=2
            ?`🏆 Player ${TR.G.currentPlayer+1} wins by DOUBLE! 🤑`
            :`🏆 Player ${TR.G.currentPlayer+1} WINS! 🎉`;
        TR.setMessage(msg);
        TR.renderAll();
        TR.showModal('🎉 WINNER!',msg,false);
        return;
    }

    TR.G.currentPlayer=(TR.G.currentPlayer+1)%TR.G.numPlayers;
    while(TR.G.eliminated.includes(TR.G.currentPlayer))
        TR.G.currentPlayer=(TR.G.currentPlayer+1)%TR.G.numPlayers;

    const nextP=TR.G.players[TR.G.currentPlayer];
    if(!nextP){TR.setMessage('Game over.');TR.renderAll();return;}

    if(nextP.hand.length===14){
        TR.G.phase='discard';
        TR.setMessage(`👉 Player ${TR.G.currentPlayer+1}: 14 cards. Discard one.`);
    }else{
        TR.G.phase='draw';
        TR.setMessage(`👉 Player ${TR.G.currentPlayer+1}'s turn. Draw or take discard.`);
    }

    TR.G.mustOpen=false;
    TR.G.selected=[];
    TR.G.jokerSwapActive=false;
    TR.G.monteWinPending=false;

    TR.renderAll();
   if(!TR.isOnlineGame()){
    TR.showModal(
        `👤 Player ${TR.G.currentPlayer+1}`,
        `Pass the phone and press "I'm Ready"`,
        true
    );
   } 
};
})();