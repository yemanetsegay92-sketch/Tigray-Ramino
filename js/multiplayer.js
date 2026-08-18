/* TIGRAY RAMINO - MULTIPLAYER STAGE 1
   Lobby foundation only. No Firebase/game-state changes yet. */
(function () {
  'use strict';

  const Multiplayer = {
    player: null,
    currentRoom: null,

    getTelegramUser() {
      try {
        const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (u) return { id:String(u.id), firstName:u.first_name || 'Player', username:u.username || '' };
      } catch(e) {}
      return { id:'local-'+Date.now(), firstName:'Player', username:'' };
    },

    createRoomCode() {
      const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let s='';
      for(let i=0;i<5;i++) s+=chars[Math.floor(Math.random()*chars.length)];
      return s;
    },

    openLobby() {
      this.player=this.getTelegramUser();
      let old=document.getElementById('ramino-multiplayer-overlay');
      if(old) old.remove();

      const el=document.createElement('div');
      el.id='ramino-multiplayer-overlay';
      el.innerHTML=`
        <div class="ramino-mp-panel">
          <button class="ramino-mp-close" id="mp-close">×</button>
          <h2>🃏 Multiplayer</h2>
          <p class="ramino-mp-subtitle">Create a room or join a friend's room.</p>
          <button class="ramino-mp-primary" id="mp-create">🎮 Create Game</button>
          <div class="ramino-mp-divider">OR</div>
          <input id="mp-code" class="ramino-mp-input" maxlength="5"
                 placeholder="Enter room code" autocomplete="off">
          <button class="ramino-mp-secondary" id="mp-join">🔑 Join Game</button>
          <div id="mp-status" class="ramino-mp-status"></div>
        </div>`;
      document.body.appendChild(el);

      document.getElementById('mp-close').onclick=()=>el.remove();
      document.getElementById('mp-create').onclick=()=>this.showRoom(this.createRoomCode(),true);
      document.getElementById('mp-join').onclick=()=>{
        const code=document.getElementById('mp-code').value.trim().toUpperCase();
        if(!/^[A-Z0-9]{5}$/.test(code)){
          document.getElementById('mp-status').textContent='Enter a valid 5-character room code.';
          return;
        }
        this.showRoom(code,false);
      };
    },

    showRoom(code,isHost) {
      this.currentRoom={id:code,hostId:isHost?this.player.id:null};
      const panel=document.querySelector('.ramino-mp-panel');
      if(!panel) return;
      panel.innerHTML=`
        <button class="ramino-mp-close" id="mp-close">×</button>
        <h2>🎮 Game Room</h2>
        <div class="ramino-mp-code">${code}</div>
        <p class="ramino-mp-subtitle">${isHost?'Share this code with the other players.':'Room found locally for this test.'}</p>
        <div class="ramino-mp-players">
          <div class="ramino-mp-player">👤 <strong>${this.escape(this.player.firstName)}</strong>
            <small>${isHost?'Host':'Player'}</small></div>
          <div class="ramino-mp-waiting">⏳ Firebase room connection comes next.</div>
        </div>
        <button class="ramino-mp-primary" id="mp-start">Start Game</button>
        <button class="ramino-mp-secondary" id="mp-copy">📋 Copy Room Code</button>
        <div id="mp-status" class="ramino-mp-status">
          Stage 1 is ready for Acode testing.
        </div>`;
      document.getElementById('mp-close').onclick=()=>document.getElementById('ramino-multiplayer-overlay')?.remove();
      document.getElementById('mp-copy').onclick=async()=>{
        try{await navigator.clipboard.writeText(code);document.getElementById('mp-status').textContent='Copied: '+code;}
        catch(e){document.getElementById('mp-status').textContent='Room code: '+code;}
      };
      document.getElementById('mp-start').onclick=()=>{
        document.getElementById('mp-status').textContent='Real multiplayer starts after Firebase is connected.';
      };
    },

    escape(v) {
      return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }
  };

  window.TigrayRaminoMultiplayer=Multiplayer;
})();
