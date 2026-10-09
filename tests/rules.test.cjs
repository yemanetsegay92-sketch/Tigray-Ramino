const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function engine(){
 const context=vm.createContext({window:{},console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,setInterval,clearInterval,document:{getElementById:()=>null}});
 for(const file of ['config','state','cards','validation','joker','monte','game','multiplayer-game'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
 const T=context.window.TigrayRamino;
 T.setMessage=m=>T.message=m;T.renderAll=()=>{};T.showModal=()=>{};
 T.initGame(3);T.G.firstDiscardPending=false;T.G.phase='discard';
 for(const p of T.G.players){p.hand=[];p.combos=[];p.opened=false;}
 let id=0; const card=(rank,suit='♠')=>({rank:String(rank),suit,id:String(++id)});
 const seq=(ranks,suit='♠')=>ranks.map(r=>card(r,suit));
 const group=(rank,n=3)=>['♥','♠','♦','♣'].slice(0,n).map(s=>card(rank,s));
 const prepare=combos=>{const last=card('9','♣');T.G.players[0].hand=[...combos.flat(),last];return last;};
 return {T,context,card,seq,group,prepare};
}
test('deal: 14 for starter, 13 for others; first action is discard',()=>{
 const {T}=engine();T.initGame(4);assert.deepEqual(Array.from(T.G.players,p=>p.hand.length),[14,13,13,13]);
 const first=T.G.players[0].hand[0];T.doDraw();assert.equal(T.G.players[0].hand.length,14);
 T.doMonteWin();assert.equal(T.G.monteMode,false);T.doOpenCombo(T.G.players[0].hand.slice(0,3));assert.equal(T.G.players[0].combos.length,0);
 T.doDiscardCard(first);assert.equal(T.G.phase,'draw');assert.equal(T.G.currentPlayer,1);assert.equal(T.G.firstDiscardPending,false);
});
test('41 opening can span two combinations in the same turn',()=>{
 const {T,group,prepare}=engine();const combos=[group(7),group(8)];const last=prepare(combos);
 T.doOpenCombo(combos[0]);assert.equal(T.isOpened(0),false);T.doOpenCombo(combos[1]);assert.equal(T.isOpened(0),true);
 T.doDiscardCard(last);assert.equal(T.G.winner,0);
});
test('three combinations below 41 open',()=>{
 const {T,group,prepare}=engine();const combos=[group(2),group(3),group(4)];prepare(combos);
 combos.forEach(c=>T.doOpenCombo(c));assert.equal(T.totalPoints(0),27);assert.equal(T.isOpened(0),true);
});
test('four-image groups and J-Q-K-A sequence open',()=>{
 for(const rank of ['J','Q','K','A']){const {T,group,prepare}=engine();const combo=group(rank,4);prepare([combo]);T.doOpenCombo(combo);assert.equal(T.isOpened(0),true);}
 const {T,seq,prepare}=engine();const combo=seq(['J','Q','K','A']);prepare([combo]);T.doOpenCombo(combo);assert.equal(T.isOpened(0),true);
});
test('four low cards or mixed-suit images are not an image opening',()=>{
 const {T,group,prepare,card}=engine();const combo=group(5,4);const last=prepare([combo]);T.doOpenCombo(combo);assert.equal(T.isOpened(0),false);T.doDiscardCard(last);assert.ok(T.G.eliminated.includes(0));
 assert.equal(T.validateSeq([card('J','♥'),card('Q'),card('K'),card('A')]).valid,false);
});
test('incomplete opening eliminates at discard, cannot accumulate across turns',()=>{
 const {T,group,prepare}=engine();const combo=group(2);const last=prepare([combo]);T.doOpenCombo(combo);T.doDiscardCard(last);
 assert.ok(T.G.eliminated.includes(0));assert.equal(T.G.players[0].combos.length,0);assert.equal(T.G.currentPlayer,1);
});
test('normal closed turn without opening remains legal',()=>{
 const {T,card}=engine();T.G.players[0].hand=[card(5),card(6)];T.doDiscardCard(T.G.players[0].hand[0]);assert.equal(T.G.eliminated.length,0);assert.equal(T.G.currentPlayer,1);
});
test('playing combinations/additions before draw is blocked',()=>{
 const {T,group,prepare}=engine();const combo=group(8);prepare([combo]);T.G.phase='draw';T.doOpenCombo(combo);assert.equal(T.G.players[0].combos.length,0);
});
test('taking discard can be followed by Monte declaration and win',()=>{
 const {T,seq,card}=engine();const pairs=[2,3,4,5,6].map(r=>[card(r),card(r)]);const trio=seq([7,8,9],'♥');
 T.G.players[0].hand=[...pairs.flat(),...trio];T.G.discardPile=[card('K','♣')];T.G.phase='draw';T.doTakeDiscard();assert.equal(T.G.mustOpen,true);
 T.doMonteWin();assert.equal(T.G.mustOpen,false);pairs.forEach(p=>T.doOpenCombo(p));T.doOpenCombo(trio);
 assert.equal(T.G.winner,null);T.doDiscardCard(T.G.players[0].hand[0]);assert.equal(T.G.winner,0);
});
test('Monte accepts a Joker pair and a valid group trio',()=>{
 const {T,card,group,prepare}=engine();const pairs=[2,3,4,5].map(r=>[card(r),card(r)]);pairs.push([card(6),card('Joker','Joker')]);const trio=group(8);const last=prepare([...pairs,trio]);
 T.doMonteWin();[...pairs,trio].forEach(c=>T.doOpenCombo(c));T.doDiscardCard(last);assert.equal(T.G.winner,0);
});
test('failed Monte with cards remaining eliminates that turn and clears mode',()=>{
 const {T,card}=engine();T.G.players[0].hand=[card(3),card(4)];T.doMonteWin();T.doDiscardCard(T.G.players[0].hand[0]);
 assert.ok(T.G.eliminated.includes(0));assert.equal(T.G.monteMode,false);assert.equal(T.G.currentPlayer,1);
});
test('invalid finished Monte is eliminated',()=>{
 const {T,group,prepare}=engine();const combos=[group(2),group(3),group(4)];const last=prepare(combos);T.doMonteWin();combos.forEach(c=>T.doOpenCombo(c));T.doDiscardCard(last);assert.ok(T.G.eliminated.includes(0));
});
test('Monte privileges are restricted to declarer',()=>{
 const {T,card,prepare}=engine();T.G.monteMode=true;T.G.montePlayer=1;const pair=[card(2),card(2)];prepare([pair]);T.doOpenCombo(pair);assert.equal(T.G.players[0].combos.length,0);
});
test('Joker replacement forbidden in Monte and before drawing',()=>{
 const {T,seq,card}=engine();const combo=seq([4,5,'Joker']);T.G.players[1].combos=[{type:'sequence',cards:combo,points:15,displayCards:T.computeComboDisplay(combo,'sequence')}];T.G.players[0].hand=[card(6),card(9)];
 T.doMonteWin();T.G.selected=[0];T.tryJokerSwap(1,0,2);assert.equal(T.G.jokerSwapActive,false);assert.equal(T.doJokerSwap(),false);assert.equal(T.canSwapJoker(0),null);
});
test('normal Joker swap finds the Joker by ID in sorted display',()=>{
 const {T,card}=engine();const joker=card('Joker','Joker');const combo=[joker,card(4),card(5)];T.G.players[1].combos=[{type:'sequence',cards:combo,points:15,displayCards:T.computeComboDisplay(combo,'sequence')}];T.G.players[0].hand=[card(6),card(9)];T.G.players[0].opened=true;T.G.selected=[0];T.tryJokerSwap(1,0,0);assert.equal(T.G.jokerSwapActive,true);assert.equal(T.G.players[1].combos[0].cards[0].rank,'6');
});
test('sequence Joker scores match display, including low-A gap',()=>{
 const {T,seq}=engine();for(const ranks of [['Q','K','Joker'],['A',3,'Joker'],['K','A','Joker'],[2,4,'Joker']]){
  const cards=seq(ranks);const result=T.validateSeq(cards);const display=T.computeComboDisplay(cards,'sequence');assert.equal(result.valid,true);assert.equal(display.length,cards.length);assert.equal(result.points,display.reduce((s,d)=>s+(d.displayRank==='A'?(result.aceHigh?10:1):T.scoreVal(d.displayRank)),0));
 }
 assert.equal(T.validateSeq(seq(['Q','K','Joker'])).points,30);
 assert.deepEqual(Array.from(T.computeComboDisplay(seq(['A',3,'Joker']),'sequence'),d=>d.displayRank),['A','2','3']);
 assert.equal(T.validateSeq(seq(['K','A',2])).valid,false);
});
test('cannot use last card on table instead of final discard',()=>{
 const {T,group}=engine();const combo=group('A',4);T.G.players[0].hand=combo;T.doOpenCombo(combo);assert.ok(T.G.eliminated.includes(0));assert.notEqual(T.G.winner,0);
});
test('ordinary finish requires discard and final Joker remains double',()=>{
 const {T,group,card}=engine();const combo=group('A',4);const joker=card('Joker','Joker');T.G.players[0].hand=[...combo,joker];T.doOpenCombo(combo);assert.equal(T.G.winner,null);T.doDiscardCard(joker);assert.equal(T.G.winner,0);assert.equal(T.G.lastDiscardJoker,true);
});
test('duplicate physical card cannot be opened twice',()=>{
 const {T,card}=engine();const c=card(5);T.G.players[0].hand=[c,card(8)];T.G.monteMode=true;T.G.montePlayer=0;T.doOpenCombo([c,c]);assert.equal(T.G.players[0].combos.length,0);
});
async function online(){
 const e=engine();const {T,context}=e;const MP=context.window.TigrayRaminoMultiplayerGame;
 MP.roomId='test';MP.playerId='p0';MP.playerIndex=0;T.G.multiplayer=true;T.G.networkRevision=0;
 context.window.TigrayRaminoMultiplayer={player:{id:'p0'}};
 const store={state:{status:'playing',playerIds:['p0','p1','p2'],currentPlayer:0,phase:'discard',winner:null,revision:0,players:T.G.players.map(p=>MP.playerPublicData(p)),deck:T.G.deck,discardPile:[]},p0:{hand:[]}};
 const snap=v=>({exists:()=>!!v,data:()=>JSON.parse(JSON.stringify(v))});
 let fail=false;
 context.window.RaminoFirebase={db:{},doc:(_db,...parts)=>parts.at(-1),serverTimestamp:()=>1,getDoc:async r=>snap(store[r]),runTransaction:async(_db,fn)=>{
  const writes=[];await fn({get:async r=>snap(store[r]),update:(r,v)=>writes.push([r,{...store[r],...v}]),set:(r,v)=>writes.push([r,v])});
  if(fail)throw Error('test network failure');for(const [r,v] of writes)store[r]=JSON.parse(JSON.stringify(v));
 }};
 MP.patchActions();return {...e,MP,store,setFail:v=>fail=v};
}
test('online persists image opening, hand and cross-player additions together',async()=>{
 const {T,MP,store,group,card}=await online();const opening=group('J',4);const addition=card(6,'♥');T.G.players[0].hand=[...opening,addition,card(9)];
 const target=[card(3,'♥'),card(4,'♥'),card(5,'♥')];T.G.players[1].combos=[{type:'sequence',cards:target,points:12,displayCards:T.computeComboDisplay(target,'sequence')}];store.state.players[1]=MP.playerPublicData(T.G.players[1]);
 await T.doOpenCombo(opening);assert.equal(store.state.players[0].opened,true);assert.equal(store.p0.hand.length,2);
 await T.doAddToCombo(addition,1,0);assert.equal(store.state.players[1].combos[0].cards.length,4);assert.equal(store.p0.hand.length,1);
});
test('online partial opening survives synchronization, then eliminates on discard',async()=>{
 const {T,store,group,prepare}=await online();const combo=group(2);const last=prepare([combo]);await T.doOpenCombo(combo);assert.equal(T.G.openingAttempt,true);assert.equal(store.state.openingAttempt,true);
 await T.doDiscardCard(last);assert.ok(store.state.eliminated.includes(0));assert.equal(store.state.players[0].combos.length,0);
});
test('online failed Monte eliminates even with hand cards left',async()=>{
 const {T,store,card}=await online();T.G.players[0].hand=[card(3),card(4)];await T.doMonteWin();assert.equal(store.state.monteMode,true);
 await T.doDiscardCard(T.G.players[0].hand[0]);assert.ok(store.state.eliminated.includes(0));assert.equal(store.state.monteMode,false);assert.equal(store.p0.hand.length,1);
});
test('transaction failure leaves public state and private hand unchanged',async()=>{
 const {T,store,group,prepare,setFail}=await online();const combo=group('J',4);prepare([combo]);store.p0.hand=JSON.parse(JSON.stringify(T.G.players[0].hand));const prior=JSON.stringify(store);setFail(true);await T.doOpenCombo(combo);
 assert.equal(JSON.stringify(store),prior);assert.equal(T.G.players[0].hand.length,5);assert.equal(T.G.players[0].combos.length,0);
});
test('out-of-turn online player cannot declare Monte',async()=>{
 const {T,MP,store}=await online();MP.playerIndex=1;await T.doMonteWin();assert.equal(store.state.revision,0);assert.equal(T.G.monteMode,false);
});
test('stale revision is rejected without overwriting newer game',async()=>{
 const {T,store,group,prepare}=await online();const combo=group('J',4);prepare([combo]);store.p0.hand=JSON.parse(JSON.stringify(T.G.players[0].hand));store.state.revision=2;await T.doOpenCombo(combo);assert.equal(store.state.revision,2);assert.equal(store.state.players[0].opened,false);
});
test('four-image sequence can use a Joker for Ace',()=>{
 const {T,seq,prepare}=engine();const combo=seq(['J','Q','K','Joker']);prepare([combo]);T.doOpenCombo(combo);assert.equal(T.isOpened(0),true);
 assert.deepEqual(Array.from(T.G.players[0].combos[0].displayCards,d=>d.displayRank),['J','Q','K','A']);
});
test('online complete Monte wins and publishes zero-card private hand',async()=>{
 const {T,store,seq,card,prepare}=await online();const pairs=[2,3,4,5,6].map(r=>[card(r),card(r)]);const trio=seq([7,8,9],'♥');const last=prepare([...pairs,trio]);
 await T.doMonteWin();for(const c of [...pairs,trio])await T.doOpenCombo(c);await T.doDiscardCard(last);
 assert.equal(store.state.winner,0);assert.equal(store.p0.hand.length,0);assert.equal(store.state.monteMode,false);
});
test('all opening methods give discard-taking and add-on rights',()=>{
 for(const mode of ['points','three','images']){
 const {T,group,card,prepare}=engine();const combos=mode==='points'?[group(7),group(8)]:mode==='three'?[group(2),group(3),group(4)]:[group('Q',4)];prepare(combos);combos.forEach(c=>T.doOpenCombo(c));assert.equal(T.isOpened(0),true);
 T.G.phase='draw';const addition=card(6,'♥');T.G.discardPile=[addition];T.doTakeDiscard();assert.equal(T.G.mustOpen,false);
 const target=[card(3,'♥'),card(4,'♥'),card(5,'♥')];T.G.players[1].combos=[{cards:target,type:'sequence',points:12}];T.doAddToCombo(addition,1,0);assert.equal(T.G.players[1].combos[0].cards.length,4);
 }
});
test('Monte activation is rejected after normal opening',()=>{
 const {T,group,prepare}=engine();const combo=group('Q',4);prepare([combo]);T.doOpenCombo(combo);assert.equal(T.isOpened(0),true);
 T.doMonteWin();assert.equal(T.isOpened(0),true);assert.equal(T.G.monteMode,false);assert.match(T.message,/unavailable after normal opening/);
});
test('Joker replacement is rejected for a closed player',()=>{
 const {T,card}=engine();const joker=card('Joker');const cards=[card(3),card(4),joker];T.G.players[1].combos=[{type:'sequence',cards,displayCards:T.computeComboDisplay(cards,'sequence')}];
 T.G.players[0].hand=[card(5),card(9)];T.G.selected=[0];T.tryJokerSwap(1,0,2);assert.equal(T.G.jokerSwapActive,false);assert.equal(T.canSwapJoker(0),null);
});
function jokerTable(e){
 const {T,card}=e;const joker=card('Joker');const cards=[card(3),card(4),joker];
 T.G.players[1].combos=[{type:'sequence',cards,points:12,displayCards:T.computeComboDisplay(cards,'sequence'),contributors:Object.fromEntries(cards.map(c=>[c.id,1]))}];
 T.G.players[0].opened=true;return {joker,cards};
}
test('failed Joker swap removes the replacement from another player table',()=>{
 const e=engine();const {T,card}=e;const {cards}=jokerTable(e);const replacement=card(5);T.G.players[0].hand=[replacement,card(8),card(9)];T.G.selected=[0];T.tryJokerSwap(1,0,2);
 T.doDiscardCard(T.G.players[0].hand.find(c=>c.rank==='9'));assert.ok(T.G.eliminated.includes(0));assert.equal(T.G.players[1].combos.length,0);
 assert.ok(!T.G.players.some(p=>p.combos.some(c=>c.cards.some(x=>x.id===replacement.id))));
});
test('Joker swap permits winning only after required final discard',()=>{
 const e=engine();const {T,card}=e;jokerTable(e);const replacement=card(5);const second=[card(6,'♥'),card(7,'♥')];const last=card(9);
 T.G.players[0].hand=[replacement,...second,last];T.G.selected=[0];T.tryJokerSwap(1,0,2);const joker=T.G.players[0].hand.find(c=>T.isJoker(c));T.doOpenCombo([...second,joker]);assert.equal(T.G.winner,null);T.doDiscardCard(last);assert.equal(T.G.winner,0);assert.equal(T.G.eliminated.length,0);
});
test('elimination removes openings and add-ons while keeping a valid original sequence',()=>{
 const {T,card,group,prepare}=engine();const own=group('Q',4);prepare([own]);T.doOpenCombo(own);
 const original=[card(3,'♥'),card(4,'♥'),card(5,'♥')];T.G.players[1].combos=[{type:'sequence',cards:original,points:12}];const addon=card(6,'♥');T.G.players[0].hand.push(addon);T.doAddToCombo(addon,1,0);
 assert.equal(T.G.players[1].combos[0].contributors[addon.id],0);T.eliminatePlayer(0,'test');
 assert.equal(T.G.players[0].combos.length,0);assert.equal(T.G.players[0].opened,false);
 const restored=T.G.players[1].combos[0];assert.equal(restored.cards.length,3);assert.equal(restored.points,12);assert.ok(!restored.cards.some(c=>c.id===addon.id));assert.equal(T.G.currentPlayer,1);
});
test('eliminated contributions removed without removing other players valid additions',()=>{
 const {T,card}=engine();const originals=[card(3),card(4),card(5)];const fromZero=card(6);const fromTwo=card(2);
 const cards=[...originals,fromZero,fromTwo];T.G.players[1].combos=[{type:'sequence',cards,points:20,contributors:{[fromZero.id]:0,[fromTwo.id]:2}}];
 T.eliminatePlayer(0,'test');const remaining=T.G.players[1].combos[0];assert.equal(remaining.cards.length,4);assert.ok(remaining.cards.some(c=>c.id===fromTwo.id));assert.equal(remaining.contributors[fromTwo.id],2);
});
test('invalid remainder after removal cannot stay on table',()=>{
 const {T,card}=engine();const base=[card(3),card(4),card(5)];const addon=card(6);const further=card(7);
 T.G.players[1].combos=[{type:'sequence',cards:[...base,addon,further],points:25,contributors:{[addon.id]:0,[further.id]:2}}];
 T.eliminatePlayer(0,'test');assert.equal(T.G.players[1].combos.length,0);
});
test('online add-on provenance survives reload and obligation cleanup',async()=>{
 const {T,MP,store,card}=await online();T.G.players[0].opened=true;
 const original=[card(3,'♥'),card(4,'♥'),card(5,'♥')];T.G.players[1].combos=[{type:'sequence',cards:original,points:12}];store.state.players[1]=MP.playerPublicData(T.G.players[1]);const addon=card(6,'♥');T.G.players[0].hand=[addon,card(8),card(9)];
 await T.doAddToCombo(addon,1,0);assert.equal(store.state.players[1].combos[0].contributors[addon.id],0);assert.equal(T.G.players[1].combos[0].contributors[addon.id],0);
 T.G.jokerSwapActive=true;store.state.jokerSwapActive=true;await T.doDiscardCard(T.G.players[0].hand[0]);assert.ok(store.state.eliminated.includes(0));assert.equal(store.state.players[1].combos[0].cards.length,3);assert.ok(!store.state.players[1].combos[0].cards.some(c=>c.id===addon.id));
});
test('online Joker-swap obligation survives synchronization and eliminates on failure',async()=>{
 const e=await online();const {T,MP,store,card}=e;jokerTable(e);store.state.players[1]=MP.playerPublicData(T.G.players[1]);const replacement=card(5);T.G.players[0].hand=[replacement,card(8),card(9)];T.G.selected=[0];
 await T.tryJokerSwap(1,0,2);assert.equal(T.G.jokerSwapActive,true);assert.equal(store.state.jokerSwapActive,true);
 await T.doDiscardCard(T.G.players[0].hand.find(c=>c.rank==='9'));assert.ok(store.state.eliminated.includes(0));assert.equal(store.state.players[1].combos.length,0);
});
test('cleanup restores a valid three-card group after its fourth card is removed',()=>{
 const {T,group,card}=engine();const original=group(7);const addon=card(7,'♣');T.G.players[1].combos=[{type:'group',cards:original,points:21}];T.G.players[0].opened=true;T.G.players[0].hand=[addon,card(9)];
 T.doAddToCombo(addon,1,0);assert.equal(T.G.players[1].combos[0].cards.length,4);T.eliminatePlayer(0,'test');assert.equal(T.G.players[1].combos[0].cards.length,3);assert.equal(T.G.players[1].combos[0].points,21);
});
test('elimination clears its owner table even when others contributed',()=>{
 const {T,card}=engine();const cards=[card(3),card(4),card(5),card(6)];T.G.players[0].combos=[{type:'sequence',cards,contributors:{[cards[3].id]:2}}];T.eliminatePlayer(0,'test');assert.equal(T.G.players[0].combos.length,0);assert.ok(cards.every(c=>T.G.discardPile.some(d=>d.id===c.id)));
});
test('Ace scores 1 low, 10 high, and 33 for a three-Ace group',()=>{
 const {T,seq,group}=engine();assert.equal(T.validateSeq(seq(['A',2,3])).points,6);assert.equal(T.validateSeq(seq(['A',2,3,4])).points,10);assert.equal(T.validateSeq(seq(['Q','K','A'])).points,30);assert.equal(T.validateGroup(group('A')).points,33);
});
test('three Aces plus either example combination opens at 42',()=>{
 for(const useGroup of [true,false]){const {T,group,seq,prepare}=engine();const combos=[group('A'),useGroup?group(3):seq([2,3,4])];prepare(combos);combos.forEach(c=>T.doOpenCombo(c));assert.equal(T.totalPoints(0),42);assert.equal(T.isOpened(0),true);}
});
test('low-Ace points cannot incorrectly push two combinations above 41',()=>{
 const {T,seq,group,prepare}=engine();const combos=[seq(['A',2,3]),group(10)];prepare(combos);combos.forEach(c=>T.doOpenCombo(c));assert.equal(T.totalPoints(0),36);assert.equal(T.isOpened(0),false);
});
test('Monte with a final Joker is double, never quadruple',()=>{
 const {T,seq,card}=engine();const pairs=[2,3,4,5,6].map(r=>[card(r),card(r)]);const trio=seq([7,8,9],'♥');const last=card('Joker');T.G.players[0].hand=[...pairs.flat(),...trio,last];T.doMonteWin();[...pairs,trio].forEach(c=>T.doOpenCombo(c));T.doDiscardCard(last);assert.equal(T.G.winner,0);assert.match(T.message,/DOUBLE MONTE/);assert.doesNotMatch(T.message,/QUADRUPLE/);
});
test('A-2-3-4 plus Q-K-A stays closed at 40; J-Q-K-A opens by images',()=>{
 const {T,seq,prepare}=engine();const combos=[seq(['A',2,3,4]),seq(['Q','K','A'],'♥')];prepare(combos);combos.forEach(c=>T.doOpenCombo(c));assert.equal(T.totalPoints(0),40);assert.equal(T.isOpened(0),false);
 const e=engine();const images=e.seq(['J','Q','K','A']);e.prepare([images]);e.T.doOpenCombo(images);assert.equal(e.T.totalPoints(0),40);assert.equal(e.T.isOpened(0),true);assert.equal(e.T.openingStatus(0).images,true);
});
test('empty-deck draw preserves top discard and every physical card',()=>{
 const {T,card}=engine();const older=[card(2),card(3),card(4)];const top=card(5);const held=card(8);T.G.deck=[];T.G.discardPile=[...older,top];T.G.players[0].hand=[held];T.G.phase='draw';T.doDraw();
 assert.equal(T.G.discardPile.length,1);assert.equal(T.G.discardPile[0].id,top.id);assert.equal(T.G.deck.length,2);assert.equal(T.G.players[0].hand.length,2);assert.equal(T.G.phase,'discard');assert.equal(T.G.currentPlayer,0);
 const all=[...T.G.deck,...T.G.discardPile,...T.G.players[0].hand].map(c=>c.id);assert.equal(new Set(all).size,5);assert.deepEqual(all.sort(),[...older,top,held].map(c=>c.id).sort());
});
test('no older discards does not invent cards or lose the top discard',()=>{
 const {T,card}=engine();const top=card(3);T.G.deck=[];T.G.discardPile=[top];T.G.phase='draw';T.doDraw();assert.equal(T.G.phase,'draw');assert.equal(T.G.deck.length,0);assert.equal(T.G.discardPile[0].id,top.id);T.doTakeDiscard();assert.equal(T.G.players[0].hand[0].id,top.id);
});
test('draw does not recycle when wrong phase or hand already full',()=>{
 const {T,card}=engine();T.G.deck=[];T.G.discardPile=[card(2),card(3)];const ids=T.G.discardPile.map(c=>c.id);T.doDraw();assert.deepEqual(Array.from(T.G.discardPile,c=>c.id),ids);T.G.phase='draw';T.G.players[0].hand=Array.from({length:14},()=>card(5));T.doDraw();assert.equal(T.G.discardPile.length,2);assert.equal(T.G.deck.length,0);
});
test('online reshuffle and draw are synchronized in one action',async()=>{
 const {T,store,card}=await online();const older=[card(2),card(3)];const top=card(4);T.G.deck=[];T.G.discardPile=[...older,top];T.G.phase='draw';store.state.phase='draw';store.state.deck=[];store.state.discardPile=JSON.parse(JSON.stringify(T.G.discardPile));
 await T.doDraw();assert.equal(store.state.revision,1);assert.equal(store.state.phase,'discard');assert.equal(store.state.deck.length,1);assert.equal(store.state.discardPile.length,1);assert.equal(store.state.discardPile[0].id,top.id);assert.equal(store.p0.hand.length,1);
});
test('failed online reshuffle leaves original discard pile untouched',async()=>{
 const {T,store,card,setFail}=await online();T.G.deck=[];T.G.discardPile=[card(2),card(3),card(4)];T.G.phase='draw';store.state.phase='draw';store.state.deck=[];store.state.discardPile=JSON.parse(JSON.stringify(T.G.discardPile));const prior=JSON.stringify(store);setFail(true);await T.doDraw();assert.equal(JSON.stringify(store),prior);assert.equal(T.G.discardPile.length,3);assert.equal(T.G.phase,'draw');
});
test('new sequences stop at five cards without changing the hand on rejection',()=>{
 for(const n of [6,9]){
  const {T,seq,prepare}=engine();const cards=seq(Array.from({length:n},(_,i)=>i+2));prepare([cards]);const before=T.G.players[0].hand.map(c=>c.id);
  T.doOpenCombo(cards);assert.equal(T.G.players[0].combos.length,0);assert.deepEqual(Array.from(T.G.players[0].hand,c=>c.id),before);assert.equal(T.G.openingAttempt,false);assert.match(T.message,/3–5/);
 }
 const {T,seq,prepare}=engine();const cards=seq([5,6,7,8,9]);prepare([cards]);T.doOpenCombo(cards);assert.equal(T.G.players[0].combos.length,1);
});
test('six and nine card runs can be partitioned by the player',()=>{
 for(const sizes of [[3,3],[4,5],[3,3,3]]){
  const {T,seq,prepare}=engine();let rank=2;const combos=sizes.map(n=>seq(Array.from({length:n},()=>rank++)));prepare(combos);combos.forEach(c=>T.doOpenCombo(c));assert.deepEqual(Array.from(T.G.players[0].combos,c=>c.cards.length),sizes);assert.equal(T.isOpened(0),sizes.reduce((a,b)=>a+b,0)===9);
 }
});
test('additions can extend an existing five-card sequence',()=>{
 const {T,seq,card}=engine();const cards=seq([2,3,4,5,6]);T.G.players[1].combos=[{type:'sequence',cards,points:20}];T.G.players[0].opened=true;const addition=card(7);T.G.players[0].hand=[addition,card(9)];T.doAddToCombo(addition,1,0);assert.equal(T.G.players[1].combos[0].cards.length,6);
});
test('all three normal openings block Monte without eliminating the player',()=>{
 for(const mode of ['points','three','images']){
  const {T,group,prepare}=engine();const combos=mode==='points'?[group(7),group(8)]:mode==='three'?[group(2),group(3),group(4)]:[group('Q',4)];prepare(combos);combos.forEach(c=>T.doOpenCombo(c));T.doMonteWin();assert.equal(T.G.monteMode,false);assert.equal(T.isOpened(0),true);assert.equal(T.G.eliminated.length,0);
 }
});
test('Monte button follows the current player normal opening status',()=>{
 const {T,context}=engine();vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/render.js'),'utf8'),context);T.renderTable=()=>{};T.renderHand=()=>{};
 for(const key of ['playerLabel','statusBadge','deckCount','deckBox','discardDisplay','discardHint','discardBox','btnMonteWin'])T.dom[key]={classList:{toggle:()=>{},add:()=>{}}};T.G.discardPile=[];
 T.G.players[0].opened=true;T.renderAll();assert.equal(T.dom.btnMonteWin.disabled,true);T.G.currentPlayer=1;T.renderAll();assert.equal(T.dom.btnMonteWin.disabled,false);
});
test('elimination puts removed cards below existing discards and preserves final discard',()=>{
 const {T,group,card,prepare}=engine();const old=card(8),top=card(9);T.G.discardPile=[old,top];const combo=group(2);const last=prepare([combo]);T.doOpenCombo(combo);T.doDiscardCard(last);
 assert.deepEqual(Array.from(T.G.discardPile,c=>c.id),[...combo,old,top,last].map(c=>c.id));assert.equal(T.G.discardPile.at(-1).id,last.id);assert.ok(T.G.eliminated.includes(0));
});
test('online Monte cannot activate after opening and sequence cap preserves hand',async()=>{
 const {T,MP,store,seq,prepare}=await online();const cards=seq([2,3,4,5,6,7]);prepare([cards]);store.p0.hand=JSON.parse(JSON.stringify(T.G.players[0].hand));await T.doOpenCombo(cards);assert.equal(T.G.players[0].hand.length,7);assert.equal(T.G.players[0].combos.length,0);T.G.players[0].opened=true;store.state.players[0]=MP.playerPublicData(T.G.players[0]);await T.doMonteWin();assert.equal(T.G.monteMode,false);assert.ok(!store.state.monteMode);
});
test('online elimination preserves discard order beneath the final discard',async()=>{
 const {T,store,card,group,prepare}=await online();const old=card(8),top=card(9);T.G.discardPile=[old,top];store.state.discardPile=JSON.parse(JSON.stringify(T.G.discardPile));const combo=group(2);const last=prepare([combo]);await T.doOpenCombo(combo);await T.doDiscardCard(last);assert.deepEqual(store.state.discardPile.map(c=>c.id),[...combo,old,top,last].map(c=>c.id));assert.ok(store.state.eliminated.includes(0));
});
