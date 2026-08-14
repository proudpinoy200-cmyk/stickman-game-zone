/* =========================================================
   GAME 13 — Coin Rush Tycoon (idle/clicker tycoon, condensed into a
   fast 75-second arcade session)
   Tap the treasure pile to earn gold, hire stickman helpers for passive
   income, and watch out for the sneaky Coin Goblin who scurries in every
   so often to steal your treasure — tap him fast to shoo him away!
   ========================================================= */
const tycoonControlsHtml = `
  <div style="display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; width:100%;">
    <button class="ctlBtn wide" id="btnHireHelper" style="background:#456990; color:#fff; font-size:.78em; line-height:1.3; padding:6px 14px; height:48px;">
      <span class="shopName">👷 Hire Helper</span><br><span class="shopCost">20g</span>
    </button>
    <button class="ctlBtn wide" id="btnLuckyCharm" style="background:#ffb703; color:#1c2b3a; font-size:.78em; line-height:1.3; padding:6px 14px; height:48px;">
      <span class="shopName">🍀 Lucky Charm</span><br><span class="shopCost">60g</span>
    </button>
    <button class="ctlBtn wide" id="btnCoinMagnet" style="background:#9b5de5; color:#fff; font-size:.78em; line-height:1.3; padding:6px 14px; height:48px;">
      <span class="shopName">🧲 Coin Magnet</span><br><span class="shopCost">150g</span>
    </button>
  </div>`;

function createTycoonGame(){
  let state;

  /* ---------------- tunables ---------------- */
  const SESSION_TIME = 75;          // total session length in seconds
  const TAP_BASE_GOLD = 3;          // gold earned per manual tap on the pile
  const LUCKY_CHARM_BONUS = 2;      // extra gold per tap once Lucky Charm is bought
  const LUCKY_CHARM_COST = 60;
  const HELPER_GOLD_PER_SEC = 1;    // passive gold/sec per hired helper
  const HELPER_COSTS = [20,45,80,130,200,300,430,600,820,1100];
  const MAGNET_COST = 150;
  const MAGNET_MULTIPLIER = 1.5;    // helper income multiplier once Coin Magnet is bought

  const GOBLIN_MIN = 8, GOBLIN_MAX = 14;   // seconds between goblin raids
  const GOBLIN_WARN = 0.6;                 // telegraph/peek duration
  const GOBLIN_ACTIVE = 2.0;               // window to tap him before he steals
  const GOBLIN_FLEE = 0.45;                // run-off animation duration
  const GOBLIN_STEAL_MIN = 0.15, GOBLIN_STEAL_MAX = 0.20; // % of gold stolen

  // Star thresholds — tuned so a mostly-idle player still gets 1 star, an
  // engaged tapper who buys a couple upgrades comfortably hits 2, and a
  // focused player who buys upgrades early and dodges the goblin reaches 3.
  const STAR1_GOLD = 150;
  const STAR2_GOLD = 500;
  const STAR3_GOLD = 1200;
  const RICHEST_GOLD = 1500;         // tycoon_richest achievement threshold
  const GOBLIN_SLAYER_COUNT = 5;     // tycoon_goblin_slayer achievement threshold

  const HELPER_SLOTS = [
    {x:170,y:368},{x:625,y:368},{x:212,y:340},{x:585,y:340},
    {x:140,y:396},{x:655,y:396},{x:252,y:315},{x:545,y:315}
  ];
  const HELPER_COLORS = ['#c98b4a','#4a90c9','#c94a7a','#4ac97a','#c9a44a','#7a4ac9','#4ac9c9','#c94a4a'];

  function fresh(){
    return {
      phase: 'playing',           // 'playing' | 'ending' | 'done'
      gold: 0,
      timeLeft: SESSION_TIME,
      elapsed: 0,
      animT: 0,
      helpers: 0,
      hasLuckyCharm: false,
      hasMagnet: false,
      tapPulse: 0,
      pileShrink: 0,
      shakeT: 0,
      tapPopups: [],
      particles: makeParticlePool(),
      goblin: null,
      goblinCooldown: rand(GOBLIN_MIN, GOBLIN_MAX),
      goblinsShooed: 0,
      goblinsStolen: 0,
      richestUnlocked: false,
      passiveAccum: 0,
    };
  }

  /* ---------------- economy helpers ---------------- */
  function helperCost(){
    const n = state.helpers;
    if(n < HELPER_COSTS.length) return HELPER_COSTS[n];
    return Math.round(HELPER_COSTS[HELPER_COSTS.length-1] * Math.pow(1.4, n-HELPER_COSTS.length+1));
  }
  function addGold(amount){
    state.gold += amount;
    if(!state.richestUnlocked && state.gold >= RICHEST_GOLD){
      state.richestUnlocked = true;
      unlockAchievement('tycoon_richest');
    }
  }

  function tapPile(x,y){
    const gain = TAP_BASE_GOLD + (state.hasLuckyCharm ? LUCKY_CHARM_BONUS : 0);
    addGold(gain);
    state.tapPulse = 1;
    spawnSpark(state.particles, x, y, '#ffd54a', 8);
    spawnSpark(state.particles, x, y, '#fff3b0', 5);
    state.tapPopups.push({x, y:y-20, text:'+'+gain, color:'#ffd54a', life:0.8});
    SFX.coin();
  }

  function tryBuyHelper(){
    if(state.phase!=='playing') return;
    const cost = helperCost();
    if(state.gold < cost) return;
    state.gold -= cost;
    state.helpers++;
    SFX.click();
    const slot = HELPER_SLOTS[Math.min(state.helpers-1, HELPER_SLOTS.length-1)];
    spawnSpark(state.particles, slot.x, slot.y-20, '#8bc34a', 10);
    updateShopLabels();
  }
  function tryBuyLuckyCharm(){
    if(state.phase!=='playing' || state.hasLuckyCharm) return;
    if(state.gold < LUCKY_CHARM_COST) return;
    state.gold -= LUCKY_CHARM_COST;
    state.hasLuckyCharm = true;
    SFX.levelup();
    updateShopLabels();
  }
  function tryBuyMagnet(){
    if(state.phase!=='playing' || state.hasMagnet) return;
    if(state.gold < MAGNET_COST) return;
    state.gold -= MAGNET_COST;
    state.hasMagnet = true;
    SFX.levelup();
    updateShopLabels();
  }

  function updateShopLabels(){
    const playing = state.phase==='playing';
    const hb = document.getElementById('btnHireHelper');
    if(hb){
      const cost = helperCost();
      const nameEl = hb.querySelector('.shopName'), costEl = hb.querySelector('.shopCost');
      if(nameEl) nameEl.textContent = '👷 Helper ('+state.helpers+')';
      if(costEl) costEl.textContent = cost+'g';
      const disabled = !playing || state.gold < cost;
      hb.disabled = disabled;
      hb.style.opacity = disabled ? 0.5 : 1;
    }
    const lb = document.getElementById('btnLuckyCharm');
    if(lb){
      const costEl = lb.querySelector('.shopCost');
      if(state.hasLuckyCharm){
        if(costEl) costEl.textContent = 'Owned!';
        lb.disabled = true; lb.style.opacity = 0.5;
      } else {
        if(costEl) costEl.textContent = LUCKY_CHARM_COST+'g';
        const disabled = !playing || state.gold < LUCKY_CHARM_COST;
        lb.disabled = disabled; lb.style.opacity = disabled ? 0.5 : 1;
      }
    }
    const mb = document.getElementById('btnCoinMagnet');
    if(mb){
      const costEl = mb.querySelector('.shopCost');
      if(state.hasMagnet){
        if(costEl) costEl.textContent = 'Owned!';
        mb.disabled = true; mb.style.opacity = 0.5;
      } else {
        if(costEl) costEl.textContent = MAGNET_COST+'g';
        const disabled = !playing || state.gold < MAGNET_COST;
        mb.disabled = disabled; mb.style.opacity = disabled ? 0.5 : 1;
      }
    }
  }

  /* ---------------- goblin raid state machine ---------------- */
  function spawnGoblin(){
    const side = Math.random()<0.5 ? 'left' : 'right';
    state.goblin = {
      phase:'warning', t:0,
      side,
      x: side==='left' ? 25 : CW-25, y:300,
      fleeT:0,
      fleeDir: side==='left' ? -1 : 1,
      stolenAmt: 0,
    };
  }
  function shooGoblin(gb){
    state.goblinsShooed++;
    gb.phase='fleeing'; gb.fleeT=0;
    SFX.wrong();
    spawnSpark(state.particles, gb.x, gb.y, '#8bc34a', 12);
    state.tapPopups.push({x:gb.x, y:gb.y-40, text:'Shooed away!', color:'#8bc34a', life:1});
    if(state.goblinsShooed >= GOBLIN_SLAYER_COUNT) unlockAchievement('tycoon_goblin_slayer');
  }
  function goblinSteals(gb){
    state.goblinsStolen++;
    const stolen = Math.round(state.gold * rand(GOBLIN_STEAL_MIN, GOBLIN_STEAL_MAX));
    state.gold = Math.max(0, state.gold - stolen);
    gb.stolenAmt = stolen;
    gb.phase='fleeing'; gb.fleeT=0;
    SFX.hurt();
    state.shakeT = 0.3;
    state.pileShrink = Math.min(1, state.pileShrink + 0.4);
    spawnSpark(state.particles, gb.x, gb.y, '#9aa8b8', 8);
    state.tapPopups.push({x:gb.x, y:gb.y-40, text: stolen>0 ? '-'+stolen+'g stolen!' : 'Whew, nothing to take!', color:'#ff5050', life:1.2});
    updateShopLabels();
  }
  function updateGoblin(dt){
    if(!state.goblin){
      state.goblinCooldown -= dt;
      if(state.goblinCooldown <= 0) spawnGoblin();
      return;
    }
    const gb = state.goblin;
    gb.t += dt;
    if(gb.phase==='warning'){
      if(gb.t >= GOBLIN_WARN){
        gb.phase='active'; gb.t=0;
        gb.x = gb.side==='left' ? rand(300,360) : rand(440,500);
        gb.y = 300;
      }
    } else if(gb.phase==='active'){
      if(gb.t >= GOBLIN_ACTIVE) goblinSteals(gb);
    } else if(gb.phase==='fleeing'){
      gb.fleeT += dt;
      gb.x += gb.fleeDir * 420 * dt;
      if(gb.fleeT >= GOBLIN_FLEE || gb.x < -60 || gb.x > CW+60){
        state.goblin = null;
        state.goblinCooldown = rand(GOBLIN_MIN, GOBLIN_MAX);
      }
    }
  }

  /* ---------------- end of session ---------------- */
  function endGame(){
    if(state.phase !== 'playing') return;
    state.phase = 'ending';
    SFX.victory();
    const finalGold = Math.round(state.gold);
    const stars = finalGold>=STAR3_GOLD ? 3 : finalGold>=STAR2_GOLD ? 2 : finalGold>=STAR1_GOLD ? 1 : 0;
    PROG.setStars('tycoon', stars);
    PROG.setHighScore('tycoon', finalGold);
    PROG.updateDisplay();
    recordRoundComplete();
    if(finalGold >= RICHEST_GOLD) unlockAchievement('tycoon_richest');
    if(state.goblinsShooed >= GOBLIN_SLAYER_COUNT) unlockAchievement('tycoon_goblin_slayer');
    setTimeout(()=>{
      const title = stars>=3 ? '🏆 Tycoon Master!' : stars===2 ? '💰 Great Haul!' : '🪙 Nice Start!';
      let raidText;
      if(state.goblinsStolen===0 && state.goblinsShooed===0) raidText = 'The Coin Goblin never even showed up — lucky run!';
      else if(state.goblinsStolen===0) raidText = `You shooed away all ${state.goblinsShooed} goblin raid${state.goblinsShooed===1?'':'s'} — your treasure stayed totally safe!`;
      else raidText = `You shooed away ${state.goblinsShooed} goblin${state.goblinsShooed===1?'':'s'} but lost some gold to ${state.goblinsStolen} raid${state.goblinsStolen===1?'':'s'}.`;
      const text = `You earned ${finalGold} gold! ${raidText} Buy helpers early and tap fast to earn even more next time!`;
      showGameOverOverlay('tycoon', finalGold, title, text, [
        {label:'Play Again', onClick:()=>{ state=fresh(); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
      state.phase = 'done';
    }, 200);
  }

  /* ---------------- update ---------------- */
  function update(dt){
    state.animT += dt;
    updateParticles(state.particles, dt, 220);
    if(state.shakeT>0) state.shakeT -= dt;
    if(state.tapPulse>0) state.tapPulse = Math.max(0, state.tapPulse - dt*4);
    if(state.pileShrink>0) state.pileShrink = Math.max(0, state.pileShrink - dt*0.7);
    state.tapPopups.forEach(p=>{ p.y -= 30*dt; p.life -= dt*1.2; });
    state.tapPopups = state.tapPopups.filter(p=>p.life>0);
    updateShopLabels();

    if(state.phase !== 'playing') return;

    state.timeLeft -= dt;
    state.elapsed += dt;

    if(state.helpers>0){
      const perSec = state.helpers * HELPER_GOLD_PER_SEC * (state.hasMagnet ? MAGNET_MULTIPLIER : 1);
      state.passiveAccum += perSec*dt;
      if(state.passiveAccum >= 1){
        const whole = Math.floor(state.passiveAccum);
        state.passiveAccum -= whole;
        addGold(whole);
      }
    }

    updateGoblin(dt);

    if(state.timeLeft <= 0){
      state.timeLeft = 0;
      endGame();
    }
  }

  /* ---------------- tap handling ---------------- */
  function isPileHit(x,y){
    const dx = (x-400)/150, dy = (y-300)/110;
    return dx*dx + dy*dy <= 1;
  }
  function onPointerDown(x,y){
    if(state.phase !== 'playing') return;
    if(state.goblin && state.goblin.phase==='active'){
      const gb = state.goblin;
      if(dist(x,y,gb.x,gb.y) <= 44){
        shooGoblin(gb);
        return;
      }
    }
    if(isPileHit(x,y)){
      tapPile(x,y);
    }
  }

  /* ---------------- drawing ---------------- */
  function drawBg(g){
    const grad = g.createLinearGradient(0,0,0,CH);
    grad.addColorStop(0,'#3b1f0f');
    grad.addColorStop(0.55,'#7a4a1e');
    grad.addColorStop(1,'#d8a94e');
    g.fillStyle = grad;
    g.fillRect(0,0,CW,CH);
    // twinkling ambient sparkles
    g.fillStyle = 'rgba(255,235,150,0.55)';
    for(let i=0;i<22;i++){
      const x = (i*53)%CW, y = (i*37)%320 + 10;
      const tw = 0.4+0.6*Math.abs(Math.sin(state.animT*1.6+i));
      g.globalAlpha = tw*0.6;
      g.fillRect(x,y,2,2);
    }
    g.globalAlpha = 1;
    // side pillars for a "treasure vault" feel
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0,0,60,CH);
    g.fillRect(CW-60,0,60,CH);
    // floor
    g.fillStyle = '#8a5a2a';
    g.fillRect(0,GROUND_Y,CW,CH-GROUND_Y);
    g.fillStyle = '#6b3f18';
    g.fillRect(0,GROUND_Y,CW,6);
  }

  function drawHelpers(g){
    const n = Math.min(state.helpers, HELPER_SLOTS.length);
    for(let i=0;i<n;i++){
      const slot = HELPER_SLOTS[i];
      const bob = Math.sin(state.animT*4 + i*1.7)*3;
      const pose = {
        legF:100, legB:96,
        armF:-55 + Math.sin(state.animT*5+i)*20,
        armB:-115,
        lean:-90, headBob:bob
      };
      drawStick(g, slot.x, slot.y, 0.42, HELPER_COLORS[i%HELPER_COLORS.length], slot.x<400?1:-1, pose, {expr:'happy'});
    }
    if(state.helpers > HELPER_SLOTS.length){
      g.save();
      g.textAlign='center'; g.font='bold 14px Segoe UI'; g.fillStyle='#fff';
      g.fillText('+'+(state.helpers-HELPER_SLOTS.length)+' more helpers!', 400, 415);
      g.restore();
    }
  }

  function drawPile(g){
    const punch = 1 + 0.12*Math.max(0,state.tapPulse);
    const shrink = 1 - 0.32*state.pileShrink;
    const scale = punch*shrink;
    g.save();
    g.translate(400,300);
    g.scale(scale,scale);
    // glow behind the pile
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = '#ffe27a';
    g.shadowColor = '#ffe27a'; g.shadowBlur = 40;
    g.beginPath(); g.arc(0,0,95,0,Math.PI*2); g.fill();
    g.restore();
    // chest base
    g.fillStyle = '#7a4a1e';
    roundRect(-72,18,144,58,12); g.fill();
    g.fillStyle = '#5c3714';
    roundRect(-72,18,144,14,6); g.fill();
    g.fillStyle = '#ffd166';
    g.fillRect(-6,26,12,42);
    // coin mound
    const coinColors = ['#ffd54a','#ffea70','#ffc93c','#fff3b0'];
    const coinSpots = [
      [0,-45,42],[-38,-18,34],[36,-20,34],[-14,-60,26],[16,-62,26],[0,-10,50],
      [-55,5,26],[55,3,26],[0,20,42]
    ];
    coinSpots.forEach((c,i)=>{
      g.fillStyle = coinColors[i%coinColors.length];
      g.beginPath(); g.arc(c[0],c[1],c[2],0,Math.PI*2); g.fill();
      g.strokeStyle = 'rgba(150,100,20,0.5)'; g.lineWidth = 2; g.stroke();
    });
    // sparkle highlights
    const sp = 0.6+0.4*Math.sin(state.animT*4);
    g.globalAlpha = sp;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(-20,-40,4,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(25,-25,3,0,Math.PI*2); g.fill();
    g.globalAlpha = 1;
    g.restore();
  }

  function drawGoblin(g, gb){
    const t = state.animT;
    const bob = gb.phase==='active' ? Math.sin(t*10)*3 : 0;
    g.save();
    g.translate(gb.x, gb.y+bob);
    const scale = gb.phase==='warning' ? 0.65 : 1;
    g.scale(scale, scale);
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(0,34,26,8,0,0,Math.PI*2); g.fill();
    // body
    g.fillStyle = '#7ec850';
    g.beginPath(); g.ellipse(0,10,24,28,0,0,Math.PI*2); g.fill();
    g.fillStyle = '#a8e07a';
    g.beginPath(); g.ellipse(0,16,14,18,0,0,Math.PI*2); g.fill();
    // ears
    g.fillStyle = '#6bb540';
    g.beginPath(); g.moveTo(-20,-4); g.lineTo(-38,-14); g.lineTo(-16,10); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(20,-4); g.lineTo(38,-14); g.lineTo(16,10); g.closePath(); g.fill();
    // eyes
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(-9,-2,8,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(9,-2,8,0,Math.PI*2); g.fill();
    g.fillStyle = '#1c2b3a';
    g.beginPath(); g.arc(-8,-1,4,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(10,-1,4,0,Math.PI*2); g.fill();
    // mischievous grin
    g.strokeStyle = '#1c2b3a'; g.lineWidth = 2; g.lineCap='round';
    g.beginPath(); g.arc(0,10,10,deg(20),deg(160)); g.stroke();
    // little bag of stolen coins while fleeing after a successful steal
    if(gb.phase==='fleeing' && gb.stolenAmt>0){
      g.fillStyle = '#caa14a';
      g.beginPath(); g.arc(22,14,9,0,Math.PI*2); g.fill();
      g.strokeStyle = '#8a6a2a'; g.lineWidth = 2; g.stroke();
    }
    g.restore();

    if(gb.phase==='warning'){
      g.save();
      const pulse = 0.7+0.3*Math.sin(t*10);
      g.globalAlpha = pulse;
      g.fillStyle = '#fff';
      g.font = 'bold 24px Segoe UI';
      g.textAlign = 'center';
      g.fillText('❗', gb.x, gb.y-46);
      g.globalAlpha = 1;
      g.restore();
    } else if(gb.phase==='active'){
      const remain = clamp(1-gb.t/GOBLIN_ACTIVE,0,1);
      g.save();
      g.beginPath();
      g.arc(gb.x, gb.y, 44, -Math.PI/2, -Math.PI/2 + Math.PI*2*remain);
      g.strokeStyle = remain>0.4 ? '#ffd166' : '#ff5050';
      g.lineWidth = 4; g.lineCap='round';
      g.stroke();
      g.restore();
    }
  }

  function drawPopups(g){
    state.tapPopups.forEach(p=>{
      g.globalAlpha = clamp(p.life,0,1);
      g.font = 'bold 20px Segoe UI'; g.textAlign='center';
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3;
      g.strokeText(p.text, p.x, p.y);
      g.fillStyle = p.color;
      g.fillText(p.text, p.x, p.y);
    });
    g.globalAlpha = 1;
  }

  function drawHud(g){
    g.textAlign='left'; g.font='bold 26px Segoe UI';
    g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=4;
    g.strokeText('💰 '+Math.round(state.gold)+'g', 16, 40);
    g.fillStyle='#fff';
    g.fillText('💰 '+Math.round(state.gold)+'g', 16, 40);

    g.textAlign='right'; g.font='bold 22px Segoe UI';
    const t = Math.max(0, state.timeLeft);
    g.strokeText('⏱ '+t.toFixed(1)+'s', CW-16, 34);
    g.fillStyle = t<=10 ? '#ff5050' : '#fff';
    g.fillText('⏱ '+t.toFixed(1)+'s', CW-16, 34);

    g.textAlign='right'; g.font='bold 14px Segoe UI'; g.fillStyle='#eafcff';
    g.fillText('🧌 Shooed '+state.goblinsShooed+'  •  Raided '+state.goblinsStolen+'x', CW-16, 58);

    if(state.helpers>0){
      g.textAlign='left'; g.font='bold 14px Segoe UI'; g.fillStyle='#eafcff';
      const perSec = (state.helpers*HELPER_GOLD_PER_SEC*(state.hasMagnet?MAGNET_MULTIPLIER:1)).toFixed(1);
      g.fillText('👷 '+state.helpers+' helper'+(state.helpers===1?'':'s')+' — +'+perSec+'g/sec', 16, 64);
    }
  }

  function draw(g){
    let shakeX=0, shakeY=0;
    if(state.shakeT>0){ shakeX = rand(-6,6); shakeY = rand(-6,6); }
    g.save();
    g.translate(shakeX, shakeY);

    drawBg(g);
    drawHelpers(g);
    drawPile(g);
    drawSparks(g, state.particles);
    if(state.goblin) drawGoblin(g, state.goblin);
    drawPopups(g);
    drawHud(g);

    g.restore();

    if(state.phase!=='playing'){
      g.save();
      g.textAlign='center'; g.font='bold 28px Segoe UI'; g.fillStyle='#ffd166';
      g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=4;
      g.strokeText("⏰ Time's up!", CW/2, 60);
      g.fillText("⏰ Time's up!", CW/2, 60);
      g.restore();
    }
  }

  return {
    title: 'Coin Rush Tycoon',
    hint: 'Tap the coins to earn gold! Buy helpers, and shoo away the sneaky Coin Goblin before he steals your treasure!',
    controlsHtml: tycoonControlsHtml,
    bindControls(){
      bindTapBtn('btnHireHelper', tryBuyHelper);
      bindTapBtn('btnLuckyCharm', tryBuyLuckyCharm);
      bindTapBtn('btnCoinMagnet', tryBuyMagnet);
    },
    create(){ state = fresh(); return this; },
    restart(){ state = fresh(); hideOverlay(); },
    update, draw, onPointerDown,
  };
}
