(function () {
'use strict';
const TR = window.TigrayRamino;

TR.validateMonte = function(playerIdx){
    const p=TR.G.players[playerIdx];
    if(!p) return {valid:false,reason:'Player not found.'};
    if(p.hand.length!==0)
        return {valid:false,reason:'You must discard your last card before validating Monte.'};

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

function closeMonteRequest(){
    TR.G.monteRequest=null;
    TR.G.monteWinPending=false;
    TR.G.monteMode=false;
    TR.G.montePlayer=null;
}

TR.restartAfterMonteAgreement=function(){
    const n=TR.G.numPlayers;
    TR.G.monteRequest=null;
    TR.G.monteWinPending=false;
    TR.G.monteMode=false;
    TR.G.montePlayer=null;
    TR.initGame(n);
    TR.setMessage('🔄 Monte agreed. New cards have been dealt.');
};

TR.requestMonteRestart=function(){
    if(TR.G.winner!==null || TR.G.monteRequest) return;
    const requester=TR.G.currentPlayer;
    TR.G.monteRequest={requester,approved:[requester],nextPlayer:(requester+1)%TR.G.numPlayers};
    TR.setMessage(`🎰 Player ${requester+1} requested Monte. All players must agree.`);
    TR.renderAll();
    TR.askNextMonteApproval();
};

TR.askNextMonteApproval=function(){
    const req=TR.G.monteRequest;
    if(!req)return;

    const remaining=[];
    for(let step=0;step<TR.G.numPlayers;step++){
        const idx=(req.nextPlayer+step)%TR.G.numPlayers;
        if(!req.approved.includes(idx)) { remaining.push(idx); break; }
    }

    if(!remaining.length){
        TR.restartAfterMonteAgreement();
        return;
    }

    const idx=remaining[0];
    req.nextPlayer=(idx+1)%TR.G.numPlayers;

    TR.modalActive=true;
    const old=document.querySelector('.modal-overlay'); if(old)old.remove();
    const div=document.createElement('div');
    div.className='modal-overlay';
    div.innerHTML=`<div class="modal-box">
        <div class="big-emoji">🎰</div>
        <h2>Monte Request</h2>
        <p>Player ${req.requester+1} wants to restart the game because of the starting cards.</p>
        <p><strong>Player ${idx+1}</strong>, do you agree?</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn-big" id="monte-yes">✅ Agree</button>
          <button class="btn-big" id="monte-no">❌ Reject</button>
        </div>
    </div>`;
    document.body.appendChild(div);

    div.querySelector('#monte-yes').addEventListener('click',()=>{
        div.remove(); TR.modalActive=false;
        if(!TR.G.monteRequest)return;
        TR.G.monteRequest.approved.push(idx);
        TR.setMessage(`✅ Player ${idx+1} agreed to Monte.`);
        TR.renderAll();
        TR.askNextMonteApproval();
    });
    div.querySelector('#monte-no').addEventListener('click',()=>{
        div.remove(); TR.modalActive=false;
        closeMonteRequest();
        TR.setMessage(`❌ Player ${idx+1} rejected Monte. The game continues.`);
        TR.renderAll();
    });
};

// Monte Win is the Monte-play control. Tapping it only declares that
// the player is attempting a Monte win. The player must still play the
// turn normally and discard the last card. When that final discard makes
// the Monte combination valid, the system declares the win automatically.
TR.doMonteWin=function(){
    if(TR.G.winner!==null)return;
    if(TR.G.monteRequest){
        TR.setMessage('🎰 A Monte restart request is already in progress.');
        return;
    }
    if(TR.G.phase!=='draw'&&TR.G.phase!=='discard')return;

    const playerIdx=TR.G.currentPlayer;

    // Monte Win belongs to the player who activated it. It must never
    // silently transfer to another player's turn.
    if(TR.G.monteMode && TR.G.montePlayer!==null){
        if(TR.G.montePlayer===playerIdx){
            TR.setMessage('🏆 Monte Win is already active. Finish your Monte and discard your last card.');
        }else{
            TR.setMessage(`🏆 Monte Win is already declared by Player ${TR.G.montePlayer+1}.`);
        }
        TR.renderAll();
        return;
    }

    TR.G.monteMode=true;
    TR.G.montePlayer=playerIdx;
    TR.G.monteWinPending=false;
    TR.setMessage(`🏆 Player ${playerIdx+1}: Monte Win active. Finish 5 pairs + 1 trio and discard your final card. The system will decide automatically.`);
    TR.renderAll();
};
})();
