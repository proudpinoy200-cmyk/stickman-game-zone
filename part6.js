const swordControlsHtml = `
  <div class="padBtns">
    <button class="ctlBtn" id="btnLeft">◀</button>
    <button class="ctlBtn" id="btnRight">▶</button>
  </div>
  <div class="actionBtns">
    <button class="ctlBtn attack" id="btnAttack">⚔️</button>
    <button class="ctlBtn block" id="btnBlock">🛡️</button>
  </div>`;
const martialControlsHtml = `
  <div class="padBtns">
    <button class="ctlBtn" id="btnLeft">◀</button>
    <button class="ctlBtn" id="btnRight">▶</button>
  </div>
  <div class="actionBtns">
    <button class="ctlBtn punch" id="btnPunch">👊</button>
    <button class="ctlBtn kick" id="btnKick">🦵</button>
    <button class="ctlBtn block" id="btnBlock">🛡️</button>
  </div>`;

function bindMoveKeys(){
  bindHoldBtn('btnLeft','left');
  bindHoldBtn('btnRight','right');
  bindHoldBtn('btnBlock','block');
}

const GAMES = {
  sword: {
    title:'Sword Duel', hint:'Move ◀▶, tap ⚔️ to attack in range, hold 🛡️ to block! (arrows/space/shift on keyboard)',
    controlsHtml: swordControlsHtml,
    bindControls(){
      bindMoveKeys();
      bindTapBtn('btnAttack', ()=>{ keys['doAttack']=true; });
    },
    create(){ return createFightGame({
      gameId:'sword',
      weapon:'sword', title:'Sword Duel', hint:'', controlsHtml: swordControlsHtml,
      bindControls: this.bindControls,
      bg1:'#a6c9ff', bg2:'#eaf6ff',
      playerColor:'#2b6cb0', npcColor:'#e63946',
      playerLabel:'You',
      npcNameForLevel: l=>['Squire','Bandit','Knight','Champion','Dragon Lord'][l-1]||'Foe',
      levelWinText: l=>`You defeated the ${['Squire','Bandit','Knight','Champion'][l-1]}! Next up: a tougher opponent.`,
      finalTitle:'Sword Master',
      accessory:'band', accColorPlayer:()=>'#ffe27a', accColorNpc:()=>'#f4f4f4',
    }).create(); },
    restart(){ currentGame.restart(); },
    update(dt){ currentGame.update(dt); }, draw(g){ currentGame.draw(g); },
  },
  martial: {
    title:'Dojo Kicks', hint:'Move ◀▶, 👊 punch, 🦵 kick, hold 🛡️ block! (Z/X/shift on keyboard)',
    controlsHtml: martialControlsHtml,
    bindControls(){
      bindMoveKeys();
      bindTapBtn('btnPunch', ()=>{ keys['doPunch']=true; });
      bindTapBtn('btnKick', ()=>{ keys['doKick']=true; });
    },
    create(){ return createFightGame({
      gameId:'martial',
      weapon:'fists', title:'Dojo Kicks', hint:'', controlsHtml: martialControlsHtml,
      bindControls: this.bindControls,
      bg1:'#ffe0b3', bg2:'#fff6e6',
      playerColor:'#2ec4b6', npcColor:'#9b5de5',
      playerLabel:'You',
      npcNameForLevel: l=>['White Belt','Yellow Belt','Green Belt','Blue Belt','Black Belt Master'][l-1]||'Rival',
      levelWinText: l=>`You earned your next belt by beating the ${['White Belt','Yellow Belt','Green Belt','Blue Belt'][l-1]}!`,
      finalTitle:'Black Belt Legend',
      accessory:'band', accColorPlayer:l=>BELT_COLORS[l-1]||'#1c2b3a', accColorNpc:l=>BELT_COLORS[l-1]||'#1c2b3a',
    }).create(); },
    restart(){ currentGame.restart(); },
    update(dt){ currentGame.update(dt); }, draw(g){ currentGame.draw(g); },
  },
  runner: createRunnerGame(),
  hoops: createHoopsGame(),
  ninja: createNinjaGame(),
  memory: createMemoryGame(),
  reaction: createReactionGame(),
  platformer: createPlatformerGame(),
  bubble: createBubbleGame(),
  racer: createRacerGame(),
};

/* Keyboard bindings shared across fight games */
window.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft') keys['left']=true;
  if(e.key==='ArrowRight') keys['right']=true;
  if(e.key==='ArrowUp') keys['jump']=true;
  if(e.key==='ArrowDown') keys['duck']=true;
  if(e.key===' ') keys['doAttack']=true;
  if(e.key==='Shift') keys['block']=true;
  if(e.key==='z'||e.key==='Z') keys['doPunch']=true;
  if(e.key==='x'||e.key==='X') keys['doKick']=true;
  if(e.key==='f'||e.key==='F') keys['doFire']=true;
});
window.addEventListener('keyup', e=>{
  if(e.key==='ArrowLeft') keys['left']=false;
  if(e.key==='ArrowRight') keys['right']=false;
  if(e.key==='ArrowDown') keys['duck']=false;
  if(e.key==='Shift') keys['block']=false;
});

/* =========================================================
   HOME SCREEN CARDS
   ========================================================= */
const CARD_DATA = [
  {id:'sword', icon:'⚔️', name:'Sword Duel', desc:'Battle 5 rising opponents with your blade.'},
  {id:'martial', icon:'🥋', name:'Dojo Kicks', desc:'Punch & kick your way to Black Belt.'},
  {id:'runner', icon:'🏃', name:'Stickman Dash', desc:'Jump & duck an endless obstacle run.'},
  {id:'hoops', icon:'🏀', name:'Hoop Shootout', desc:'Slingshot swishes before time runs out.'},
  {id:'ninja', icon:'🍉', name:'Ninja Fruit Slice', desc:'Swipe fruit, dodge bombs, chain combos.'},
  {id:'memory', icon:'🧠', name:'Memory Match', desc:'Flip & match the stickman card pairs!'},
  {id:'reaction', icon:'⚡', name:'Reaction Time', desc:'Test your reflexes — tap fast!'},
  {id:'platformer', icon:'🏁', name:'Stickman Quest', desc:'Jump, collect, stomp, reach the flag!'},
  {id:'bubble', icon:'🫧', name:'Bubble Shooter', desc:'Aim, shoot, match 3+ to pop bubbles!'},
  {id:'racer', icon:'🏎️', name:'Stickman Racer', desc:'Dodge hurdles, boost, win the race!'},
];

/* =========================================================
   LEADERBOARDS (local, per-device) — which games track one, whether a
   lower or higher number wins, and how to format the raw stored number.
   ========================================================= */
const LB_GAMES = [
  {id:'sword', name:'Sword Duel', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
  {id:'martial', name:'Dojo Kicks', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
  {id:'runner', name:'Stickman Dash', higherIsBetter:true, format:s=>Math.round(s)+'m'},
  {id:'hoops', name:'Hoop Shootout', higherIsBetter:true, format:s=>s+' pts'},
  {id:'ninja', name:'Ninja Fruit Slice', higherIsBetter:true, format:s=>s+' pts'},
  {id:'memory', name:'Memory Match', higherIsBetter:false, format:s=>s+' moves'},
  {id:'reaction', name:'Reaction Time', higherIsBetter:false, format:s=>Math.round(s)+'ms'},
  {id:'platformer', name:'Stickman Quest', higherIsBetter:true, format:s=>s+' coins'},
  {id:'bubble', name:'Bubble Shooter', higherIsBetter:true, format:s=>s+' pts'},
  {id:'racer', name:'Stickman Racer', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
];
function populateLbModal(){
  const sel = document.getElementById('lbGameSelect');
  if(!sel) return;
  sel.innerHTML = '';
  LB_GAMES.forEach(cfg=>{
    const opt = document.createElement('option');
    opt.value = cfg.id; opt.textContent = cfg.name;
    sel.appendChild(opt);
  });
  sel.onchange = ()=> renderLbModalList(sel.value);
  renderLbModalList(sel.value);
}
function renderLbModalList(gameId){
  const cfg = LB_GAMES.find(g=>g.id===gameId);
  const list = document.getElementById('lbModalList');
  if(!list || !cfg) return;
  list.innerHTML = '';
  const entries = LB.getScores(gameId);
  if(!entries.length){
    const li = document.createElement('li');
    li.className = 'lbEmpty';
    li.textContent = 'No scores yet — be the first!';
    list.appendChild(li);
  } else {
    entries.forEach((e,i)=>{
      const li = document.createElement('li');
      const rank = document.createElement('span'); rank.className='lbRank'; rank.textContent=(i+1)+'.';
      const name = document.createElement('span'); name.className='lbName'; name.textContent=e.name;
      const sc = document.createElement('span'); sc.className='lbScore'; sc.textContent=cfg.format(e.score);
      li.appendChild(rank); li.appendChild(name); li.appendChild(sc);
      list.appendChild(li);
    });
  }
}
(function(){
  const openBtn = document.getElementById('btnLeaderboards');
  const modal = document.getElementById('lbModal');
  const closeBtn = document.getElementById('lbModalClose');
  if(openBtn && modal){
    openBtn.onclick = ()=>{ SFX.click(); populateLbModal(); modal.classList.add('show'); };
  }
  if(closeBtn && modal){
    closeBtn.onclick = ()=>{ SFX.click(); modal.classList.remove('show'); };
  }
})();
const cardGrid = document.getElementById('cardGrid');
CARD_DATA.forEach(c=>{
  const div = document.createElement('div');
  div.className='card';
  div.innerHTML = `<div class="icon">${c.icon}</div><h3>${c.name}</h3><p>${c.desc}</p><button class="playBtn">Play ▶</button>`;
  div.onclick = ()=>{ SFX.unlock(); SFX.click(); startGame(c.id); };
  cardGrid.appendChild(div);
});

/* =========================================================
   BACKGROUND MUSIC (procedural — no external files)
   ========================================================= */
const BGM = (function(){
  let actx = null, playing = false, source = null, gain = null;
  function unlockBuffer(c){
    try{
      const buf = c.createBuffer(1,1,22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      if(src.start) src.start(0); else src.noteOn(0);
    }catch(e){}
  }
  function ensure(){
    if(!actx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      actx = new AC();
      gain = actx.createGain();
      gain.gain.value = 0.06;
      gain.connect(actx.destination);
      unlockBuffer(actx);
    }
    if(actx.state==='suspended') actx.resume().catch(()=>{});
    return actx;
  }
  function start(){
    const c = ensure(); if(!c || playing) return;
    playing = true;
    tick();
  }
  function stop(){
    playing = false;
    if(source){ try{ source.stop(); }catch(e){} source=null; }
  }
  const NOTES = [262,294,330,349,392,440,494,523]; // C4-C5
  let noteIdx = 0, beat = 0;
  function tick(){
    if(!playing) return;
    const c = actx;
    if(!c) return;
    try{
      const now = c.currentTime;
      // bass pulse every 2 beats
      const freq = NOTES[noteIdx % NOTES.length] * 0.5; // bass octave
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq*1.02, now+0.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.3);
      osc.connect(g); g.connect(gain);
      osc.start(now); osc.stop(now+0.35);
      // arp on beat 0
      if(beat % 4 === 0){
        const arp = c.createOscillator();
        arp.type = 'sine';
        arp.frequency.setValueAtTime(NOTES[(noteIdx+7)%8], now);
        arp.frequency.exponentialRampToValueAtTime(NOTES[(noteIdx+12)%8], now+0.15);
        const ag = c.createGain();
        ag.gain.setValueAtTime(0.04, now);
        ag.gain.exponentialRampToValueAtTime(0.001, now+0.2);
        arp.connect(ag); ag.connect(gain);
        arp.start(now); arp.stop(now+0.25);
      }
      beat = (beat+1) % 8;
      if(beat === 0) noteIdx = (noteIdx+1) % NOTES.length;
    } catch(e){}
    setTimeout(tick, 280); // ~90 BPM
  }
  return { start, stop };
})();

/* =========================================================
   HOME SCREEN PARTICLES (decorative floating elements)
   ========================================================= */
(function(){
  const hp = document.getElementById('homeParticles');
  if(!hp) return;
  const emojis = ['✦','●','◈','◆','☆','•','+'];
  for(let i=0;i<35;i++){
    const el = document.createElement('div');
    const size = 3 + Math.random()*5;
    const em = emojis[Math.floor(Math.random()*emojis.length)];
    el.textContent = em;
    el.style.cssText = `position:absolute;font-size:${size}px;color:rgba(255,255,255,${0.1+Math.random()*0.25});left:${Math.random()*100}%;top:${Math.random()*100}%;animation:homeFloat ${6+Math.random()*8}s ease-in-out infinite alternate;animation-delay:${Math.random()*4}s;opacity:${0.15+Math.random()*0.3};transform:rotate(${Math.random()*360}deg);`;
    hp.appendChild(el);
  }
})();

// Initialize progression display
PROG.updateDisplay();

// Start subtle BGM on first user interaction. Several listener types are registered
// because some mobile/in-app browsers don't reliably fire 'click' or Pointer Events
// from a touch in a way that counts as a "user gesture" for unlocking Web Audio —
// touchend is the one legacy iOS Safari has always honored.
let bgmStarted = false;
function unlockAndStartBgm(){
  if(bgmStarted) return;
  bgmStarted = true;
  SFX.unlock();
  BGM.start();
  // Prime the Stickman Quest music element on this very first user gesture too.
  // It's actually played later (after the splash-screen countdown resolves via a
  // Promise chain), and on iOS Safari / many mobile browsers a play() call that
  // isn't directly inside a synchronous gesture handler gets silently blocked —
  // .catch(()=>{}) swallows that rejection so no error ever surfaces. Playing +
  // immediately pausing it here, synchronously within this gesture, "unlocks" the
  // element so the later delayed play() call is allowed to succeed.
  try {
    const p = questBgm.play();
    if (p && p.catch) {
      p.then(() => { questBgm.pause(); questBgm.currentTime = 0; }).catch(() => {});
    } else {
      questBgm.pause();
      questBgm.currentTime = 0;
    }
  } catch (e) {}
}
document.addEventListener('click', unlockAndStartBgm, {once:true});
document.addEventListener('pointerdown', unlockAndStartBgm, {once:true});
document.addEventListener('touchend', unlockAndStartBgm, {once:true});
