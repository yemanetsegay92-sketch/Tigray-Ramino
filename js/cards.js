(function () {
'use strict';
const TR = window.TigrayRamino;

TR.isJoker = function (c) {
    return !!c && c.rank === TR.JOKER_RANK;
};

TR.cardShort = function (c) {
    return TR.isJoker(c) ? '🃏' : c.rank + c.suit;
};

TR.colorClass = function (c) {
    if (TR.isJoker(c)) return '';
    return (c.suit === '♥' || c.suit === '♦') ? 'red-suit' : 'black-suit';
};

TR.scoreVal = function (rank) {
    return TR.SCORE[rank] || 0;
};

TR.numVal = function (rank, aceHigh) {
    return aceHigh ? (TR.NUM_HIGH[rank] || null) : (TR.NUM_LOW[rank] || null);
};

TR.getSuitColor = function (suit) {
    if (suit === '♥' || suit === '♦') return 'red';
    if (suit === '♠' || suit === '♣') return 'black';
    return null;
};

TR.createDeck = function () {
    const d = [];
    for (let t = 0; t < 2; t++) {
        for (const s of TR.SUITS) {
            for (const r of TR.RANKS) {
                d.push({suit:s, rank:r, id:r+s+t});
            }
        }
        d.push({suit:TR.JOKER_SUIT, rank:TR.JOKER_RANK, id:'Joker'+t+'a'});
        d.push({suit:TR.JOKER_SUIT, rank:TR.JOKER_RANK, id:'Joker'+t+'b'});
    }
    return d;
};

TR.shuffle = function (a) {
    for (let i=a.length-1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
};
})();
