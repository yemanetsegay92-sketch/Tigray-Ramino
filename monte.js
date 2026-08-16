(function () {
'use strict';
const TR = window.TigrayRamino;

TR.validateMonte = function(playerIdx){
    const p=TR.G.players[playerIdx];
    if(p.hand.length!==0)
        return {valid:false,reason:'You must discard your last card before validation.'};

    let pairs=[], trio=null;
    for(const combo of p.combos){
        if(combo.type==='pair') pairs.push(combo);
        else if(combo.type==='sequence'||combo.type==='group'){
            if(trio!==null) return {valid:false,reason:'You can only have one trio (sequence or group) in Monte.'};
            trio=combo;
        } else return {valid:false,reason:'Invalid combo type in Monte.'};
    }

    if(pairs.length!==5) return {valid:false,reason:`You have ${pairs.length} pairs. Need exactly 5 pairs.`};
    if(trio===null) return {valid:false,reason:'You need exactly 1 trio (sequence or group) in Monte.'};

    for(let i=0;i<pairs.length;i++){
        const result=TR.validatePair(pairs[i].cards);
        if(!result.valid) return {valid:false,reason:`Pair ${i+1} is invalid: ${result.reason}`};
    }

    let trioResult=TR.validateSeq(trio.cards);
    if(!trioResult.valid) trioResult=TR.validateGroup(trio.cards);
    if(!trioResult.valid) return {valid:false,reason:`Trio is invalid: ${trioResult.reason}`};

    const totalCards=p.combos.reduce((n,c)=>n+c.cards.length,0);
    if(totalCards!==13)
        return {valid:false,reason:`You have ${totalCards} cards on the table. Need exactly 13 cards (5 pairs + 1 trio).`};

    return {valid:true};
};

TR.doDeclareMonte=function(){
    if(TR.G.winner!==null) return;
    const p=TR.currentPlayer();
    if(!p) return;

    if(TR.G.monteMode){
        TR.G.monteMode=false;
        TR.dom.btnMonte.textContent='🎰 Declare Monte';
        TR.setMessage('❌ Monte mode cancelled.');
        TR.renderAll();
        return;
    }

    if(p.hand.length!==14){
        TR.setMessage('❌ You need exactly 14 cards to declare Monte.');
        return;
    }

    TR.G.monteMode=true;
    TR.dom.btnMonte.textContent='🔮 Monte Mode Active';
    TR.setMessage('🔮 Monte mode active. Open 5 pairs + 1 trio, then discard your last card.');
    TR.renderAll();
};
})();