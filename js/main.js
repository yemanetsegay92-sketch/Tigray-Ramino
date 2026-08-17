(function () {
'use strict';
const TR = window.TigrayRamino;

function start(){
    TR.initDOM();

    TR.dom.deckBox.addEventListener('click',()=>{
        if(TR.G.phase==='draw'&&TR.G.winner===null)TR.doDraw();
    });

    TR.dom.discardBox.addEventListener('click',()=>{
        if(TR.G.phase==='draw'&&TR.G.winner===null&&TR.G.discardPile.length)
            TR.doTakeDiscard();
    });

    TR.dom.discardDisplay.addEventListener('click',e=>{
        e.stopPropagation();
        if(TR.G.phase==='draw'&&TR.G.winner===null&&TR.G.discardPile.length)
            TR.doTakeDiscard();
    });

    if(TR.dom.btnMonte) TR.dom.btnMonte.addEventListener('click',TR.requestMonteRestart);
    if(TR.dom.btnMonteWin) TR.dom.btnMonteWin.addEventListener('click',TR.doMonteWin);

    // Clear, visible player-count choice instead of the browser prompt.
    TR.showPlayerCountModal();
}

TR.showPlayerCountModal=function(){
    TR.modalActive=true;
    const old=document.querySelector('.modal-overlay'); if(old)old.remove();
    const div=document.createElement('div');
    div.className='modal-overlay';
    div.innerHTML=`<div class="modal-box">
      <div class="big-emoji">🃏</div>
      <h2>Tigray Ramino</h2>
      <p>How many players?</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn-big" data-n="2">2 Players</button>
        <button class="btn-big" data-n="3">3 Players</button>
        <button class="btn-big" data-n="4">4 Players</button>
      </div>
    </div>`;
    document.body.appendChild(div);
    div.querySelectorAll('[data-n]').forEach(btn=>btn.addEventListener('click',()=>{
        const n=parseInt(btn.dataset.n,10);
        div.remove(); TR.modalActive=false;
        TR.initGame(n);
    }));
};

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start);
}else{
    start();
}
})();
