const PROG = (function(){
  const KEY = 'stickman_zone_progress';
  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; }
  }
  function save(data){ try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){} }
  function getStars(gameId){
    const d = load();
    return d.stars && d.stars[gameId] ? d.stars[gameId] : 0;
  }
  function setStars(gameId, n){
    const d = load();
    if(!d.stars) d.stars = {};
    if(!d.highScores) d.highScores = {};
    d.stars[gameId] = Math.max(d.stars[gameId]||0, n);
    save(d);
  }
  function getHighScore(gameId){
    const d = load();
    return d.highScores && d.highScores[gameId] ? d.highScores[gameId] : 0;
  }
  function setHighScore(gameId, score){
    const d = load();
    if(!d.highScores) d.highScores = {};
    if(!d.stars) d.stars = {};
    d.highScores[gameId] = Math.max(d.highScores[gameId]||0, score);
    save(d);
  }
  function totalStars(){
    const d = load();
    if(!d.stars) return 0;
    return Object.values(d.stars).reduce((a,b)=>a+b,0);
  }
  function maxPossible(){
    return CARD_DATA.length * 3;
  }
  function updateDisplay(){
    const el = document.getElementById('starDisplay');
    if(el){
      const ear = totalStars();
      const max = maxPossible();
      el.innerHTML = '';
      for(let i=0;i<max;i++){
        const s = document.createElement('span');
        s.className = 'star' + (i<ear ? ' earned' : '');
        s.textContent = '⭐';
        el.appendChild(s);
      }
      el.innerHTML += '<span class="pText">'+ear+' / '+max+' stars</span>';
    }
  }
  return { getStars, setStars, getHighScore, setHighScore, totalStars, maxPossible, updateDisplay };
})();

/* =========================================================
   SPLASH SCREEN
   ========================================================= */
let splashResolve = null;
// Reduce-clicks: default duration is short (see startGame's 1100ms call), and a tap/click
// anywhere on the splash — or its "Tap to skip" hint — resolves it immediately, so a player
// who already knows the game doesn't have to sit through a countdown every single time.
function showSplash(icon, title, subtitle, durationMs){
  return new Promise(resolve => {
    let done = false;
    const finish = ()=>{
      if(done) return;
      done = true;
      ov.removeEventListener('pointerdown', skipHandler);
      clearInterval(interval);
      ov.classList.remove('show');
      resolve();
    };
    splashResolve = finish;
    const ov = document.getElementById('splashOverlay');
    const spIcon = document.getElementById('spIcon');
    const spTitle = document.getElementById('spTitle');
    const spSub = document.getElementById('spSub');
    const spCount = document.getElementById('spCount');
    spIcon.textContent = icon;
    spTitle.textContent = title;
    spSub.textContent = subtitle || '';
    spCount.textContent = '';
    ov.classList.add('show');
    const skipHandler = e=>{ e.preventDefault(); SFX.unlock(); finish(); };
    ov.addEventListener('pointerdown', skipHandler);
    // countdown 3..2..1..GO!
    const counts = ['3','2','1','GO!'];
    let i = 0;
    spCount.textContent = counts[0];
    spCount.style.animation = 'none';
    setTimeout(()=>{ spCount.style.animation = 'countPulse .8s ease'; }, 10);
    const interval = setInterval(()=>{
      i++;
      if(i>=counts.length){
        clearInterval(interval);
        setTimeout(finish, 150);
        return;
      }
      spCount.textContent = counts[i];
      spCount.style.animation = 'none';
      setTimeout(()=>{ spCount.style.animation = 'countPulse .8s ease'; }, 10);
    }, durationMs / (counts.length));
    // splash particles
    const spP = document.getElementById('spParticles');
    spP.innerHTML = '';
    for(let i=0;i<30;i++){
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;width:${Math.random()*4+2}px;height:${Math.random()*4+2}px;background:rgba(255,255,255,${Math.random()*0.4+0.1});border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;animation:spDrift ${2+Math.random()*3}s ease-in-out infinite alternate;animation-delay:${Math.random()*2}s`;
      spP.appendChild(d);
    }
  });
}
// keyframes for splash drift added inline via style injection
(function(){
  const st = document.createElement('style');
  st.textContent = `@keyframes spDrift { 0%{transform:translateY(0) translateX(0)} 100%{transform:translateY(-30px) translateX(10px)} }`;
  document.head.appendChild(st);
})();

/* =========================================================
   GAME 6 — Memory Match
   ========================================================= */
const MEM_ICONS = ['🦴','⚔️','🥋','🏀','🍉','🏃‍♂️','🎯','👑'];
// Sizes the card grid to the largest square that fits inside its box, in exact
// pixels. Reading clientWidth/clientHeight forces the browser to finish layout
// first, so this is reliable even on mobile browsers where the CSS chain of
// aspect-ratio + percentage-height inside nested flexboxes doesn't always
// resolve the same way — that mismatch was letting the grid grow taller than
// its panel and get its bottom row clipped against the card grid's own edge.
function sizeMemGrid(){
  const box = document.getElementById('memGridBox');
  const grid = document.getElementById('memGrid');
  if(!box || !grid) return;
  const size = Math.max(0, Math.min(box.clientWidth, box.clientHeight));
  grid.style.width = size+'px';
  grid.style.height = size+'px';
}
window.addEventListener('resize', sizeMemGrid);
function createMemoryGame(){
  let state;
  function fresh(){
    const cards = [];
    MEM_ICONS.forEach((icon,i)=>{
      cards.push({id:i, icon, flipped:false, matched:false});
      cards.push({id:i, icon, flipped:false, matched:false});
    });
    // shuffle
    for(let i=cards.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [cards[i],cards[j]] = [cards[j],cards[i]];
    }
    return {
      cards, flipped:[], matched:0, moves:0, lock:false,
      over:false, startTime:0, elapsed:0, running:false,
    };
  }
  function update(dt){
    if(state.running && !state.over){
      state.elapsed += dt;
    }
  }
  function draw(g){
    // memory match uses DOM, not canvas — draw just a bg. The Moves/Time readout
    // is a DOM element (#memStats) layered in #domOverlay above this, not canvas
    // text, so it never gets visually covered by the card grid sitting on top.
    // Flat fill (no green ground band) — see drawFlatBg comment for why.
    drawFlatBg('#b8d4ff','#e8f4ff');
    const ms = document.getElementById('memStats');
    if(ms) ms.textContent = `Moves: ${state.moves}   •   Time: ${Math.floor(state.elapsed)}s`;
  }
  function buildDOM(){
    const wrap = document.createElement('div');
    wrap.className = 'memGrid';
    wrap.id = 'memGrid';
    state.cards.forEach((c,i)=>{
      const el = document.createElement('div');
      el.className = 'memCard';
      el.dataset.idx = i;
      el.textContent = '';
      el.addEventListener('click', ()=>{
        if(state.over || state.lock || c.flipped || c.matched) return;
        SFX.click();
        if(!state.running){ state.running=true; state.startTime=performance.now(); }
        c.flipped = true;
        el.textContent = c.icon;
        el.classList.add('flipped');
        state.flipped.push({idx:i, el, card:c});
        if(state.flipped.length===2){
          state.moves++;
          state.lock = true;
          const [a,b] = state.flipped;
          if(a.card.id === b.card.id){
            // match!
            a.card.matched = true; b.card.matched = true;
            a.el.classList.add('matched'); b.el.classList.add('matched');
            a.el.classList.remove('flipped'); b.el.classList.remove('flipped');
            state.matched += 2;
            state.flipped = [];
            state.lock = false;
            SFX.match();
            if(state.matched >= state.cards.length){
              state.over = true;
              const stars = state.moves <= 20 ? 3 : state.moves <= 30 ? 2 : 1;
              PROG.setStars('memory', stars);
              PROG.setHighScore('memory', Math.max(PROG.getHighScore('memory'), -state.moves));
              PROG.updateDisplay();
              recordRoundComplete();
              if(state.moves <= MEM_ICONS.length) unlockAchievement('memory_genius');
              setTimeout(()=>{
                showGameOverOverlay('memory', state.moves, '🎉 Memory Complete!', `You matched all pairs in ${state.moves} moves (${Math.floor(state.elapsed)}s)`, [
                  {label:'Play Again', onClick:()=>{ state=fresh(); buildDOM(); hideOverlay(); }},
                  {label:'Home', onClick: goHome}
                ]);
              },200);
            }
          } else {
            setTimeout(()=>{
              a.card.flipped = false; b.card.flipped = false;
              a.el.textContent = ''; b.el.textContent = '';
              a.el.classList.remove('flipped'); b.el.classList.remove('flipped');
              state.flipped = [];
              state.lock = false;
            }, 700);
          }
        }
      });
      wrap.appendChild(el);
    });
    const existing = document.getElementById('memGrid');
    if(existing) existing.replaceWith(wrap);
    else document.getElementById('memGridBox').appendChild(wrap);
    sizeMemGrid();
  }
  return {
    title:'Memory Match', hint:'Flip cards and match the stickman-themed pairs!',
    domOverlay:true,
    controlsHtml:`
      <div id="memContainer" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; gap:6px;">
        <div class="memStats" id="memStats">Moves: 0   •   Time: 0s</div>
        <div id="memGridBox" style="flex:1; min-height:0; width:100%; display:flex; justify-content:center; align-items:center;"></div>
      </div>`,
    bindControls(){ buildDOM(); },
    create(){ state=fresh(); return this; },
    restart(){ state=fresh(); buildDOM(); hideOverlay(); },
    update, draw,
  };
}

/* =========================================================
   GAME 7 — Reaction Time
   ========================================================= */
function createReactionGame(){
  let state;
  function fresh(){
    return {
      phase: 'ready', // ready | wait | show | result | done
      times: [], round:0, maxRounds:5,
      targetX:400, targetY:110,
      waitTimer:0, showStart:0, over:false,
    };
  }
  function nextRound(){
    state.round++;
    if(state.round > state.maxRounds){
      state.phase = 'done'; state.over = true;
      const avg = state.times.length ? Math.round(state.times.reduce((a,b)=>a+b,0)/state.times.length) : 0;
      const stars = avg <= 300 ? 3 : avg <= 450 ? 2 : 1;
      PROG.setStars('reaction', stars);
      PROG.setHighScore('reaction', avg > 0 ? Math.min(PROG.getHighScore('reaction')||9999, avg) : (PROG.getHighScore('reaction')||0));
      PROG.updateDisplay();
      recordRoundComplete();
      if(avg > 0 && avg <= 250) unlockAchievement('reaction_lightning');
      const el = document.getElementById('reactTarget'); if(el) el.style.display='none';
      const rt = document.getElementById('reactResults');
      if(rt){
        rt.style.display='block';
        rt.innerHTML = `<div class="avgTime">${avg}ms</div><div>Average reaction time</div>`;
      }
      setTimeout(()=>{
        showGameOverOverlay('reaction', avg, '⏱️ All Done!', `Average reaction: ${avg}ms — ${avg<=300?'Lightning fast! ⚡':avg<=450?'Quick! 🎯':'Keep practicing! 💪'}`, [
          {label:'Play Again', onClick:()=>{ state=fresh(); hideOverlay(); document.getElementById('reactResults').style.display='none'; }},
          {label:'Home', onClick: goHome}
        ]);
      },300);
      return;
    }
    state.phase = 'wait';
    state.waitTimer = 1.0 + Math.random() * 2.5;
    const el = document.getElementById('reactTarget'); if(el) el.style.display='none';
    const rt = document.getElementById('reactText');
    if(rt) rt.textContent = `Round ${state.round}/${state.maxRounds} — Wait for it...`;
  }
  function update(dt){
    if(state.over) return;
    if(state.phase === 'wait'){
      state.waitTimer -= dt;
      if(state.waitTimer <= 0){
        state.phase = 'show';
        state.showStart = performance.now();
        state.targetX = rand(80, 520);
        state.targetY = rand(30, 170);
        const el = document.getElementById('reactTarget');
        if(el){
          el.style.display = 'block';
          el.style.left = state.targetX + 'px';
          el.style.top = state.targetY + 'px';
        }
        const rt = document.getElementById('reactText');
        if(rt) rt.textContent = 'CLICK NOW! ⚡';
      }
    }
  }
  function draw(g){
    drawFlatBg('#1a2a3a','#2b3a4a');
    g.fillStyle='rgba(255,255,255,0.05)';
    for(let i=0;i<20;i++){
      g.fillRect((i*43)%CW, (i*29)%180, 2, 2);
    }
  }
  function onTargetClick(){
    if(state.phase !== 'show') return;
    const elapsed = performance.now() - state.showStart;
    state.times.push(elapsed);
    SFX.coin();
    const el = document.getElementById('reactTarget'); if(el) el.style.display='none';
    const rt = document.getElementById('reactText');
    if(rt) rt.textContent = `${Math.round(elapsed)}ms — Nice!`;
    setTimeout(()=>{ nextRound(); }, 500);
  }
  return {
    title:'Reaction Time', hint:'Tap the target as fast as you can! 5 rounds.',
    domOverlay:true,
    controlsHtml:`
      <div id="reactArea">
        <div id="reactTarget" style="display:none;"></div>
        <div id="reactText">Tap anywhere or wait for the target...</div>
      </div>
      <div id="reactResults"></div>`,
    bindControls(){
      const ta = document.getElementById('reactArea');
      if(ta){
        ta.addEventListener('click', (e)=>{
          if(e.target.id === 'reactTarget') onTargetClick();
          else if(state.phase === 'wait' || state.phase === 'ready'){
            // false start in wait mode? penalize
          }
        });
      }
      const tg = document.getElementById('reactTarget');
      if(tg) tg.addEventListener('click', onTargetClick);
      nextRound();
    },
    create(){ state=fresh(); return this; },
    restart(){ state=fresh(); hideOverlay(); document.getElementById('reactResults').style.display='none'; },
    update, draw,
  };
}

/* =========================================================
   GAME 8 — Platformer (Stickman Quest)
   ========================================================= */
