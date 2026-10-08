(function () {
'use strict';
const TR = window.TigrayRamino;

TR.computeSequenceDisplay = function (cards) {
    const result=TR.validateSeq(cards);
    if(!result.valid) return [];
    const real=cards.filter(c=>!TR.isJoker(c));
    const joker=cards.find(c=>TR.isJoker(c));
    const suit=real[0].suit;
    const display=[];
    for(let value=result.min;value<=result.max;value++){
        const rank=TR.RANKS.find(r=>TR.numVal(r,result.aceHigh)===value);
        const card=real.find(c=>c.rank===rank) || joker;
        display.push({card,displayRank:rank,displaySuit:suit,ambiguous:false});
    }
    return display;
};

TR.sortGroupCards = function (cards) {
    const validation=TR.validateGroup(cards);
    if (!validation.valid) return [];

    return cards.map(card => {
        if (!TR.isJoker(card)) {
            return {card,displayRank:card.rank,displaySuit:card.suit,ambiguous:false};
        }
        const rep=validation.jokerRepresentation;
        return {card,displayRank:rep.rank,displaySuit:rep.suit,ambiguous:false};
    });
};

TR.computeGroupDisplay = function (cards) {
    return TR.sortGroupCards(cards);
};

TR.computeComboDisplay = function (cards,type) {
    if (type==='sequence') return TR.computeSequenceDisplay(cards);

    if(type==='group') return TR.computeGroupDisplay(cards);

    if(type==='pair') {
        return cards.map(c=>{
            if(TR.isJoker(c) && cards.some(x=>!TR.isJoker(x))) {
                const real=cards.find(x=>!TR.isJoker(x));
                return {card:c,displayRank:real.rank,displaySuit:real.suit,ambiguous:false};
            }
            return {card:c,displayRank:c.rank,displaySuit:c.suit,ambiguous:false};
        });
    }

    return cards.map(c=>({card:c,displayRank:c.rank,displaySuit:c.suit,ambiguous:false}));
};

// Opening is earned in one turn and remains permanent afterwards.
TR.openingStatus = function (playerIdx) {
    const p=TR.G.players[playerIdx];
    if(!p) return {valid:false};
    const combos=p.combos.filter(c=>c.type==='sequence'||c.type==='group');
    const points=combos.reduce((sum,c)=>sum+(c.points||0),0);
    const images=combos.some(c=>c.cards.length===4 &&
        TR.computeComboDisplay(c.cards,c.type).every(d=>['J','Q','K','A'].includes(d.displayRank)));
    return {valid:points>=41 || combos.length>=3 || images,points,count:combos.length,images};
};

TR.isOpened = function (playerIdx) {
    return !!TR.G.players[playerIdx]?.opened;
};

TR.totalPoints = function (pidx) {
    const p=TR.G.players[pidx];
    if(!p) return 0;
    return p.combos.reduce((s,c)=>s+(c.points||0),0);
};

TR.canSwapJoker = function (playerIdx) {
    const p=TR.G.players[playerIdx];
    if(TR.isMonteTurn() || !p || !TR.isOpened(playerIdx) || p.hand.length===0) return null;

    for(let pi=0;pi<TR.G.players.length;pi++){
        const pl=TR.G.players[pi];
        if(TR.G.eliminated.includes(pi)) continue;

        for(let ci=0;ci<pl.combos.length;ci++){
            const combo=pl.combos[ci];
            const display=combo.displayCards || TR.computeComboDisplay(combo.cards,combo.type);

            for(let i=0;i<combo.cards.length;i++){
                if(!TR.isJoker(combo.cards[i])) continue;
                const jd=display.find(d=>d.card.id===combo.cards[i].id);
                if(!jd) continue;

                const matching=p.hand.find(card=>
                    !TR.isJoker(card) &&
                    card.rank===jd.displayRank &&
                    card.suit===jd.displaySuit
                );

                if(matching) return {playerIdx:pi,comboIdx:ci,cardIdx:i,realCard:matching};
            }
        }
    }
    return null;
};

TR.doJokerSwap = function () {
    if(!TR.canPlayCards() || TR.isMonteTurn()) return false;
    const idx=TR.G.currentPlayer;
    const p=TR.G.players[idx];
    if(!p || !TR.isOpened(idx)) return false;

    const info=TR.canSwapJoker(idx);
    if(!info) return false;

    const target=TR.G.players[info.playerIdx];
    const combo=target.combos[info.comboIdx];
    const joker=combo.cards[info.cardIdx];
    const real=info.realCard;

    const handIdx=p.hand.findIndex(c=>c.id===real.id);
    if(handIdx===-1) return false;

    combo.cards[info.cardIdx]=real;
    p.hand.splice(handIdx,1);
    p.hand.push(joker);

    combo.displayCards=TR.computeComboDisplay(combo.cards,combo.type);
    const result=combo.type==='sequence'
        ? TR.validateSeq(combo.cards)
        : TR.validateGroup(combo.cards);
    if(result.valid) combo.points=result.points;

    TR.G.jokerSwapActive=true;
    TR.G.selected=[];
    TR.setMessage('🔄 Joker swapped! You must win this turn. The Joker is now a normal card in your hand.');
    TR.renderAll();
    return true;
};

TR.tryJokerSwap = function(targetPlayerIdx,targetComboIdx,jokerCardIdx){
    if(!TR.canPlayCards()) return;
    if(TR.isMonteTurn()){
        TR.setMessage('❌ Joker replacement is not allowed in Monte.'); return;
    }
    const p=TR.currentPlayer();
    if(!p || TR.G.selected.length!==1) return;

    const selectedHandIdx=TR.G.selected[0];
    const real=p.hand[selectedHandIdx];

    if(!real || TR.isJoker(real)){
        TR.setMessage('❌ Select the real card that replaces this Joker first.');
        TR.renderAll(); return;
    }

    if(!TR.isOpened(TR.G.currentPlayer)){
        TR.setMessage('❌ You must be open to swap a Joker.');
        TR.renderAll(); return;
    }

    const target=TR.G.players[targetPlayerIdx];
    const combo=target && target.combos[targetComboIdx];
    if(!combo) return;

    const joker=combo.cards[jokerCardIdx];
    if(!joker || !TR.isJoker(joker)) return;

    const display=combo.displayCards || TR.computeComboDisplay(combo.cards,combo.type);
    const jd=display.find(d=>d.card.id===joker.id);

    if(!jd || !jd.displayRank || !jd.displaySuit){
        TR.setMessage('❌ This Joker has no valid representation.');
        TR.renderAll(); return;
    }

    if(real.rank!==jd.displayRank || real.suit!==jd.displaySuit){
        TR.setMessage(`❌ ${TR.cardShort(real)} does not replace this Joker.`);
        TR.renderAll(); return;
    }

    combo.cards[jokerCardIdx]=real;
    p.hand.splice(selectedHandIdx,1);
    p.hand.push(joker);
    combo.displayCards=TR.computeComboDisplay(combo.cards,combo.type);

    const result=combo.type==='sequence'
        ? TR.validateSeq(combo.cards)
        : TR.validateGroup(combo.cards);
    if(result.valid) combo.points=result.points;

    TR.G.jokerSwapActive=true;
    TR.G.selected=[];
    TR.setMessage('🔄 Joker swapped! You must win this turn. The Joker is now a normal card in your hand.');
    TR.renderAll();
};
})();
