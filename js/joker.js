(function () {
'use strict';
const TR = window.TigrayRamino;

TR.computeSequenceDisplay = function (cards, aceHigh) {
    const non=cards.filter(c=>!TR.isJoker(c));
    const jok=cards.filter(c=>TR.isJoker(c));
    const sorted=non.slice().sort((a,b)=>
        (TR.numVal(a.rank,aceHigh)||0)-(TR.numVal(b.rank,aceHigh)||0)
    );
    const vals=sorted.map(c=>TR.numVal(c.rank,aceHigh));
    const suit=non[0].suit;
    let result=[];

    if (!jok.length) {
        return sorted.map(c=>({card:c,displayRank:c.rank,displaySuit:c.suit,ambiguous:false}));
    }

    const jokerCard=jok[0];
    let inserted=false;

    for (let i=0;i<sorted.length;i++) {
        if (i>0 && vals[i]-vals[i-1]===2 && !inserted) {
            const missingValue=vals[i-1]+1;
            const missingRank=TR.RANKS.find(r=>TR.numVal(r,aceHigh)===missingValue);
            if (missingRank) {
                result.push({card:jokerCard,displayRank:missingRank,displaySuit:suit,ambiguous:false});
                inserted=true;
            }
        }
        result.push({
            card:sorted[i],displayRank:sorted[i].rank,displaySuit:sorted[i].suit,ambiguous:false
        });
    }

    if (!inserted) {
        const missingValue=vals[vals.length-1]+1;
        const missingRank=TR.RANKS.find(r=>TR.numVal(r,aceHigh)===missingValue);
        if (missingRank) {
            result.push({card:jokerCard,displayRank:missingRank,displaySuit:suit,ambiguous:false});
            inserted=true;
        }
    }

    if (!inserted) {
        const missingValue=vals[0]-1;
        const missingRank=TR.RANKS.find(r=>TR.numVal(r,aceHigh)===missingValue);
        if (missingRank) {
            result.unshift({card:jokerCard,displayRank:missingRank,displaySuit:suit,ambiguous:false});
            inserted=true;
        }
    }

    if (!inserted) result.push({card:jokerCard,displayRank:'?',displaySuit:suit,ambiguous:false});
    return result;
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
    if (type==='sequence') {
        let aceHigh=false;
        const non=cards.filter(c=>!TR.isJoker(c));
        if (non.length>=2) {
            const vals=non.map(c=>TR.numVal(c.rank,false)).filter(v=>v!==null).sort((a,b)=>a-b);
            let works=true;
            for(let i=1;i<vals.length;i++) if(vals[i]-vals[i-1]!==1) works=false;
            if(!works) aceHigh=true;
        }
        return TR.computeSequenceDisplay(cards,aceHigh);
    }

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

TR.isOpened = function (playerIdx) {
    const p=TR.G.players[playerIdx];
    if(!p) return false;
    if(p.opened) return true;
    return TR.totalPoints(playerIdx)>=41 || p.combos.length>=3;
};

TR.totalPoints = function (pidx) {
    const p=TR.G.players[pidx];
    if(!p) return 0;
    return p.combos.reduce((s,c)=>s+(c.points||0),0);
};

TR.canSwapJoker = function (playerIdx) {
    const p=TR.G.players[playerIdx];
    if(!p || !TR.isOpened(playerIdx) || p.hand.length===0) return null;

    for(let pi=0;pi<TR.G.players.length;pi++){
        const pl=TR.G.players[pi];
        if(TR.G.eliminated.includes(pi)) continue;

        for(let ci=0;ci<pl.combos.length;ci++){
            const combo=pl.combos[ci];
            const display=combo.displayCards || TR.computeComboDisplay(combo.cards,combo.type);

            for(let i=0;i<combo.cards.length;i++){
                if(!TR.isJoker(combo.cards[i])) continue;
                const jd=display[i];
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
    const jd=display[jokerCardIdx];

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
