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

    TR.dom.btnMonte.addEventListener('click',TR.doDeclareMonte);

    let cnt=prompt('Tigray Ramino — How many players? (2-4)','2');
    let n=parseInt(cnt)||2;
    if(n<2)n=2;
    if(n>4)n=4;

    TR.initGame(n);

    window.__G=TR.G;
    window.TigrayRaminoGame=TR;
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start);
}else{
    start();
}
})();