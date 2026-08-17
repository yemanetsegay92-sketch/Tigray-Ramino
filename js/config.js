(function () {
'use strict';
window.TigrayRamino = window.TigrayRamino || {};
const TR = window.TigrayRamino;

TR.SUITS = ['♠', '♥', '♦', '♣'];
TR.RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
TR.SCORE = {A:11,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:10,Q:10,K:10};
TR.NUM_LOW = {A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};
TR.NUM_HIGH = {A:14,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};
TR.JOKER_RANK = 'Joker';
TR.JOKER_SUIT = 'Joker';
TR.SUIT_ORDER = {'♠':0,'♥':1,'♦':2,'♣':3,Joker:4};
TR.MAX_HAND = 14;
})();
