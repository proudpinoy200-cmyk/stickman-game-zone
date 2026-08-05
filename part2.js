function createFightGame(cfg){
  // cfg: weapon('sword'|'fists'), levels count, colors, names
  const LEVELS = 5;
  const MOVE_SPEED = 235; // agile: was 160
  let state;
  // How long (in seconds of actual duel time) it takes this playthrough to become Champion —
  // the leaderboard metric for these two games, since they don't otherwise have a numeric
  // score. Persists across "Next Level"/"Retry Level" within one run, and resets whenever
  // createFightGame() itself is invoked again (i.e. every time the player starts fresh from
  // the home screen), because part6.js constructs a brand-new instance of this whole closure
  // on every card click rather than reusing one across plays.
  let totalElapsed = 0;
  function idlePose(){ return {legF:100,legB:80,armF:-58,armB:-132,lean:-90,headBob:0}; }
  function freshState(level, carryHp){
    const npcMax = 26 + level*8;
    return {
      level,
      playerMax: 100,
      playerHp: carryHp!=null ? carryHp : 100,
      npcHp: npcMax, npcMax,
      px: 190, nx: 560, facing:1,
      pAnim: {t:0, action:'idle', lock:0, cur:idlePose(), dustT:0},
      nAnim: {t:0, action:'idle', lock:0, windup:0, attackTimer: rand(1.1, 1.9) - level*0.09, cur:idlePose(), dustT:0},
      blocking:false,
      shakeT:0, clock:0,
      floatTexts: [], sparks: makeParticlePool(), dust: makeParticlePool(),
      over:false, win:false,
    };
  }
  function addFloat(x,y,text,color){
    state.floatTexts.push({x,y,text,color,life:1});
  }
  function dmgFor(kind){
    if(cfg.weapon==='sword') return {attack: 10 + state.level*1.2, npc: 7+state.level*1.6};
    if(kind==='punch') return {attack: 6+state.level*0.8, npc: 6+state.level*1.4};
    return {attack: 12+state.level*1.2, npc: 6+state.level*1.4}; // kick
  }
  function tryAttack(kind){
    if(state.over) return;
    if(state.pAnim.lock>0) return;
    const range = cfg.weapon==='sword'?110:(kind==='kick'?95:80);
    const d = Math.abs(state.nx-state.px);
    state.pAnim.action = kind==='kick' ? 'kick' : (cfg.weapon==='sword'?'slash':'punch');
    state.pAnim.t = 0;
    state.pAnim.lock = kind==='kick'?0.42:0.26;
    SFX.whoosh();
    if(d<=range){
      const dm = dmgFor(kind);
      state.npcHp = clamp(state.npcHp - dm.attack, 0, state.npcMax);
      addFloat(state.nx, GROUND_Y-140, '-'+Math.round(dm.attack), '#ff6b6b');
      state.shakeT = 0.12;
      state.nAnim.action='hurt'; state.nAnim.t=0; state.nAnim.lock=0.22;
      spawnSpark(state.sparks, state.nx, GROUND_Y-95, cfg.weapon==='sword'?'#c9d6e3':'#ffe27a', 9);
      if(cfg.weapon==='sword') SFX.sword(); else if(kind==='kick') SFX.kick(); else SFX.punch();
      if(state.npcHp<=0){ endRound(true); }
    } else {
      if(cfg.weapon==='sword') SFX.swordMiss();
    }
  }
  function npcAttack(){
    if(state.over) return;
    const d = Math.abs(state.nx-state.px);
    if(d>115) return;
    const dm = dmgFor('punch');
    if(state.blocking){
      const chip = dm.npc*0.2;
      state.playerHp = clamp(state.playerHp-chip,0,state.playerMax);
      addFloat(state.px, GROUND_Y-140, 'Blocked!', '#4ecdc4');
      SFX.block();
      spawnSpark(state.sparks, state.px, GROUND_Y-95, '#4ecdc4', 5);
    } else {
      state.playerHp = clamp(state.playerHp-dm.npc,0,state.playerMax);
      addFloat(state.px, GROUND_Y-140, '-'+Math.round(dm.npc), '#ffd166');
      state.shakeT = 0.15;
      state.pAnim.action='hurt'; state.pAnim.t=0; state.pAnim.lock=0.22;
      spawnSpark(state.sparks, state.px, GROUND_Y-95, '#ffd166', 9);
      if(cfg.weapon==='sword') SFX.sword(); else SFX.punch();
      SFX.hurt();
      if(state.playerHp<=0){ endRound(false); }
    }
  }
  function endRound(won){
    state.over = true; state.win = won;
    if(won){ if(state.level>=LEVELS) SFX.victory(); else SFX.levelup(); }
    else SFX.gameover();
    setTimeout(()=>{
      if(won){
        if(state.level>=LEVELS){
          recordRoundComplete();
          unlockAchievement(cfg.gameId==='sword' ? 'sword_champion' : 'martial_blackbelt');
          showGameOverOverlay(cfg.gameId, totalElapsed, '🏆 Champion!',
            `You defeated every opponent and became the ${cfg.finalTitle}! Time: ${totalElapsed.toFixed(1)}s`, [
            {label:'Play Again', onClick:()=>{ state = freshState(1,100); totalElapsed = 0; hideOverlay(); }},
            {label:'Home', onClick: goHome}
          ]);
        } else {
          showOverlay(`Level ${state.level} Complete!`, cfg.levelWinText(state.level), [
            {label:'Next Level ▶', onClick:()=>{ state = freshState(state.level+1, clamp(state.playerHp+20,0,100)); hideOverlay(); }},
          ]);
        }
      } else {
        recordRoundComplete();
        showOverlay('You Got Knocked Down!', 'Every hero takes a hit sometimes. Try again!', [
          {label:'Retry Level', onClick:()=>{ state = freshState(state.level,100); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      }
    }, 250);
  }

  function poseFor(anim, blocking, clock){
    const t = anim.t;
    const breathe = Math.sin(clock*2.2)*1.6;
    if(blocking) return {legF:100,legB:80,armF:-150,armB:-30,lean:-95,headBob:breathe*0.3};
    switch(anim.action){
      case 'walk': {
        const w = Math.sin(t*9.5)*30;
        return {legF:100+w, legB:80-w, armF:-40-w*0.6, armB:-140+w*0.6, lean:-92, headBob:Math.abs(w)*0.09};
      }
      case 'slash': {
        const p = easeOutBack(clamp(t/0.26,0,1));
        return {legF:112, legB:74, armF: -165+p*168, armB:-28, lean:-86, headBob:0};
      }
      case 'punch': {
        const p = easeOutBack(clamp(t/0.22,0,1));
        return {legF:102,legB:80, armF:-96+p*99, armB:-140, lean:-88, headBob:0};
      }
      case 'kick': {
        const p = clamp(t/0.42,0,1);
        const k = Math.sin(easeOutQuad(p)*Math.PI)*74;
        return {legF:88-k, legB:86, armF:-55, armB:-152, lean:-78, headBob:0};
      }
      case 'windup': {
        const w = Math.sin(clock*22)*3;
        return {legF:96,legB:84, armF:-172, armB:-38, lean:-97, headBob:w*0.3};
      }
      case 'hurt': return {legF:96,legB:84, armF:14, armB:-172, lean:-76, headBob:-2};
      default: return {legF:100,legB:80, armF:-58, armB:-132, lean:-90, headBob:breathe*0.4};
    }
  }
  function exprFor(action){
    if(action==='hurt') return 'hurt';
    if(action==='slash'||action==='punch'||action==='kick'||action==='windup') return 'shout';
    return 'idle';
  }
  function stepAnim(anim, blocking, dt){
    anim.t += dt; if(anim.lock>0) anim.lock -= dt;
    const target = poseFor(anim, blocking, state.clock);
    const rate = (anim.action==='idle'||anim.action==='walk') ? 14 : 26;
    lerpPose(anim.cur, target, smoothT(rate, dt));
  }

  function update(dt){
    window.__debug = {level: state.level, playerHp: state.playerHp, npcHp: state.npcHp};
    totalElapsed += dt;
    state.clock += dt;
    if(state.shakeT>0) state.shakeT-=dt;
    state.blocking = !!keys['block'];
    stepAnim(state.pAnim, state.blocking, dt);
    stepAnim(state.nAnim, false, dt);
    state.floatTexts.forEach(f=>{ f.y-=40*dt; f.life-=dt*0.9; });
    state.floatTexts = state.floatTexts.filter(f=>f.life>0);
    updateParticles(state.sparks, dt, 320);
    updateParticles(state.dust, dt, 0);
    state.facing = state.nx>=state.px ? 1 : -1;
    if(state.over) return;

    // movement (agile: faster + footstep dust)
    let moved = false;
    if(state.pAnim.lock<=0 && !state.blocking){
      if(keys['left']){ state.px -= MOVE_SPEED*dt; moved=true; }
      if(keys['right']){ state.px += MOVE_SPEED*dt; moved=true; }
    }
    state.px = clamp(state.px, 60, 720);
    if(moved && state.pAnim.action!=='walk') state.pAnim.action='walk';
    if(!moved && state.pAnim.lock<=0 && state.pAnim.action==='walk') state.pAnim.action='idle';
    if(moved){
      state.pAnim.dustT -= dt;
      if(state.pAnim.dustT<=0){ spawnDust(state.dust, state.px-state.facing*14, GROUND_Y-2, 2); state.pAnim.dustT=0.11; }
    }

    // NPC AI: approach then attack with windup
    const d = state.nx-state.px;
    state.nAnim.attackTimer -= dt;
    if(Math.abs(d) > 118){
      state.nx -= Math.sign(d) * 92*dt;
      if(state.nAnim.lock<=0) state.nAnim.action = 'walk';
      state.nAnim.dustT -= dt;
      if(state.nAnim.dustT<=0){ spawnDust(state.dust, state.nx+state.facing*14, GROUND_Y-2, 2); state.nAnim.dustT=0.11; }
    } else if(state.nAnim.attackTimer<=0 && state.nAnim.lock<=0){
      state.nAnim.action='windup'; state.nAnim.t=0; state.nAnim.lock=0.42;
      state.nAnim.attackTimer = rand(1.2,2.0) - state.level*0.09;
      setTimeout(()=>{ if(!state.over) npcAttack(); }, 360);
    } else if(state.nAnim.lock<=0){
      state.nAnim.action='idle';
    }

    // one-shot actions triggered from input flags
    if(keys['doAttack']){ keys['doAttack']=false; tryAttack('slash'); }
    if(keys['doPunch']){ keys['doPunch']=false; tryAttack('punch'); }
    if(keys['doKick']){ keys['doKick']=false; tryAttack('kick'); }
  }

  function draw(g){
    g.save();
    if(state.shakeT>0){ g.translate(rand(-4,4), rand(-4,4)); }
    drawGround(cfg.bg1, cfg.bg2);
    // arena floor decoration
    g.fillStyle='rgba(255,255,255,0.35)';
    g.fillRect(0,GROUND_Y+8,CW,4);
    drawDust(g, state.dust);

    const facing = state.facing, nFacing = -facing;
    const pOpts = {expr: exprFor(state.pAnim.action), accessory: cfg.accessory, accessoryColor: cfg.accColorPlayer(state.level)};
    const pParts = drawStick(g, state.px, GROUND_Y, 1.05, cfg.playerColor, facing, state.pAnim.cur, pOpts);

    if(cfg.weapon==='sword'){
      g.save();
      g.strokeStyle = '#c9d6e3'; g.lineWidth=5; g.lineCap='round';
      const swingT = state.pAnim.action==='slash' ? easeOutBack(clamp(state.pAnim.t/0.26,0,1)) : 0;
      const baseAng = facing>0 ? -20-swingT*140 : 200+swingT*140;
      const len=54;
      const hx = pParts.hand.x, hy = pParts.hand.y;
      g.beginPath(); g.moveTo(hx,hy);
      g.lineTo(hx+Math.cos(deg(baseAng))*len, hy+Math.sin(deg(baseAng))*len);
      g.stroke();
      g.restore();
    }

    const nOpts = {expr: exprFor(state.nAnim.action), accessory: cfg.accessory, accessoryColor: cfg.accColorNpc(state.level)};
    drawStick(g, state.nx, GROUND_Y, 1.05, cfg.npcColor, nFacing, state.nAnim.cur, nOpts);
    if(cfg.weapon==='sword'){
      g.save();
      g.strokeStyle = '#e3b8b8'; g.lineWidth=5; g.lineCap='round';
      const hx = state.nx + nFacing*20, hy = GROUND_Y-52;
      const ang = state.nAnim.action==='windup' ? (nFacing>0?-90:270) : (nFacing>0? -20: 200);
      g.beginPath(); g.moveTo(hx,hy);
      g.lineTo(hx+Math.cos(deg(ang))*50, hy+Math.sin(deg(ang))*50);
      g.stroke(); g.restore();
    }
    if(state.nAnim.action==='windup'){
      g.fillStyle='#ffd166';
      g.beginPath(); g.arc(state.nx, GROUND_Y-170, 6+Math.sin(state.nAnim.t*20)*2, 0, Math.PI*2); g.fill();
    }

    drawSparks(g, state.sparks);

    // floating texts
    g.font='bold 20px Segoe UI'; g.textAlign='center';
    state.floatTexts.forEach(f=>{ g.globalAlpha=clamp(f.life,0,1); g.fillStyle=f.color; g.fillText(f.text,f.x,f.y); });
    g.globalAlpha=1;

    // HUD
    g.textAlign='left'; g.font='bold 16px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText(cfg.playerLabel, 24, 26);
    healthBar(24,32,220,16, state.playerHp/state.playerMax, '#06d6a0');
    g.textAlign='right';
    g.fillText(cfg.npcNameForLevel(state.level), CW-24, 26);
    healthBar(CW-244,32,220,16, state.npcHp/state.npcMax, '#ff6b6b');
    g.textAlign='center';
    g.font='bold 18px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText('Level '+state.level+' / '+LEVELS, CW/2, 26);
    g.restore();
  }

  return {
    title: cfg.title,
    hint: cfg.hint,
    controlsHtml: cfg.controlsHtml,
    bindControls: cfg.bindControls,
    create(){ state = freshState(1,100); return this; },
    restart(){ state = freshState(1,100); hideOverlay(); },
    update, draw,
  };
}

/* =========================================================
   GAME 3 — Stickman Dash (endless runner)
   ========================================================= */
function createRunnerGame(){
  let state;
  function fresh(){
    return {
      playerY: GROUND_Y, vy:0, jumping:false, ducking:false, duckAmt:0,
      groundOff:0, speed: 320, dist:0, obstacles:[], coins:[], t:0,
      spawnTimer: 1.1, coinTimer: 1.6, over:false, invuln:0,
      squashT:0, squashDir:0, dust: makeParticlePool(), sparkle: makeParticlePool(),
    };
  }
  function spawnObstacle(){
    const type = Math.random()<0.55 ? 'spike':'bar';
    state.obstacles.push({ x: CW+40, type, passed:false });
  }
  function spawnCoin(){
    const y = Math.random()<0.5 ? GROUND_Y-40 : GROUND_Y-110;
    state.coins.push({x:CW+40, y, taken:false});
  }
  function update(dt){
    window.__debug = {dist: Math.round(state.dist), over: state.over};
    if(state.squashT>0) state.squashT-=dt*3.2;
    updateParticles(state.dust, dt, 0);
    updateParticles(state.sparkle, dt, 200);
    if(state.over) return;
    state.t += dt;
    state.speed = Math.min(320 + state.t*11, 640);
    state.dist += state.speed*dt*0.1;
    state.groundOff = (state.groundOff + state.speed*dt) % 40;

    // jump physics (agile: snappier launch)
    const wantJump = keys['jump'];
    const wasJumping = state.jumping;
    if(wantJump && !state.jumping){
      state.jumping = true; state.vy = -560;
      keys['jump']=false;
      SFX.jump();
      spawnDust(state.dust, 150, GROUND_Y+2, 6);
      state.squashT = 1; state.squashDir = -1; // stretch on takeoff
    }
    state.ducking = !!keys['duck'] && !state.jumping;
    state.duckAmt = lerp(state.duckAmt, state.ducking?1:0, smoothT(18,dt));
    if(state.jumping){
      state.vy += 1500*dt;
      state.playerY += state.vy*dt;
      if(state.playerY>=GROUND_Y){
        state.playerY=GROUND_Y; state.jumping=false; state.vy=0;
        SFX.land(); spawnDust(state.dust, 150, GROUND_Y+2, 7);
        state.squashT = 1; state.squashDir = 1; // squash on landing
      }
    }

    state.spawnTimer -= dt;
    if(state.spawnTimer<=0){ spawnObstacle(); state.spawnTimer = rand(0.95,1.5) - Math.min(state.t*0.012,0.5); }
    state.coinTimer -= dt;
    if(state.coinTimer<=0){ spawnCoin(); state.coinTimer = rand(1.2,2.2); }

    state.obstacles.forEach(o=> o.x -= state.speed*dt);
    state.coins.forEach(c=> c.x -= state.speed*dt);
    state.obstacles = state.obstacles.filter(o=>o.x>-40);
    state.coins = state.coins.filter(c=>c.x>-40);

    if(state.invuln>0) state.invuln-=dt;

    const px = 150;
    // collision
    for(const o of state.obstacles){
      if(Math.abs(o.x-px)<28){
        if(o.type==='spike'){
          const hbY = state.playerY;
          if(!state.jumping || hbY > GROUND_Y-34){
            if(state.invuln<=0){ gameOver(); return; }
          }
        } else { // bar (must duck)
          if(!state.ducking && state.playerY>=GROUND_Y-10){
            if(state.invuln<=0){ gameOver(); return; }
          }
        }
      }
    }
    for(const c of state.coins){
      if(!c.taken && Math.abs(c.x-px)<26 && Math.abs(c.y-(state.playerY-30))<34){
        c.taken = true; state.dist += 8;
        SFX.coin();
        spawnSpark(state.sparkle, c.x, c.y, '#ffd166', 7);
      }
    }
    state.coins = state.coins.filter(c=>!c.taken);
  }
  function gameOver(){
    state.over = true;
    SFX.gameover();
    setTimeout(()=>{
      const score = Math.round(state.dist);
      recordRoundComplete();
      if(score >= 500) unlockAchievement('runner_500');
      showGameOverOverlay('runner', score, 'Game Over!', `You ran ${score}m as a stick hero! `+ (score>300?'Amazing run! 🌟':'Nice try — go further!'), [
        {label:'Play Again', onClick:()=>{ state=fresh(); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    },150);
  }
  function draw(g){
    drawGround('#a6e9ff','#eafff5');
    // parallax hills
    g.fillStyle='rgba(255,255,255,0.5)';
    for(let i=0;i<4;i++){
      const x = ((i*260 - state.dist*3)%(CW+300))-150;
      g.beginPath(); g.arc(x,GROUND_Y-10,60,Math.PI,0); g.fill();
    }
    // ground stripes
    g.strokeStyle='rgba(0,0,0,0.08)'; g.lineWidth=6;
    for(let x=-40;x<CW+40;x+=40){
      g.beginPath(); g.moveTo(x-state.groundOff,GROUND_Y+14); g.lineTo(x-state.groundOff+20,GROUND_Y+14); g.stroke();
    }
    drawDust(g, state.dust);
    // player
    const px=150;
    const t = state.t*10;
    const runIntensity = clamp((state.speed-320)/320,0,1);
    let pose;
    if(state.jumping) pose = {legF:120,legB:60,armF:-150,armB:-30,lean:-100-runIntensity*6,headBob:0};
    else { const w=Math.sin(t)*35; pose = {legF:100+w,legB:80-w,armF:-60-w,armB:-130+w,lean:-92-runIntensity*10,headBob:Math.abs(w)*0.06}; }
    // blend toward duck pose using duckAmt for a smooth crouch instead of an instant snap
    const duckPose = {legF:100,legB:80,armF:-30,armB:-150,lean:-40,headBob:0};
    if(state.duckAmt>0.001) pose = lerpPose(clonePose(pose), duckPose, state.duckAmt);
    const drawY = lerp(state.playerY, GROUND_Y+14, state.duckAmt);
    const baseScale = lerp(1, 0.8, state.duckAmt);
    // squash & stretch juice on takeoff/landing — all sizing lives in this outer transform,
    // so drawStick itself is always called with scale=1 to avoid compounding the scale twice
    let scaleX = baseScale, scaleY = baseScale;
    if(state.squashT>0){
      const amt = Math.max(0,state.squashT)*0.18;
      scaleY = baseScale*(1 - state.squashDir*amt);
      scaleX = baseScale*(1 + state.squashDir*amt*0.8);
    }
    g.save();
    g.translate(px, drawY);
    g.scale(scaleX, scaleY);
    g.translate(-px, -drawY);
    drawStick(g, px, drawY, 1, '#2b6cb0', 1, pose, {expr: state.jumping?'shout':'idle', accessory:'band', accessoryColor:'#ff8c42'});
    g.restore();

    // obstacles
    state.obstacles.forEach(o=>{
      if(o.type==='spike'){
        g.fillStyle='#e63946';
        g.beginPath();
        g.moveTo(o.x-16,GROUND_Y); g.lineTo(o.x,GROUND_Y-40); g.lineTo(o.x+16,GROUND_Y);
        g.closePath(); g.fill();
      } else {
        g.fillStyle='#8d5524';
        g.fillRect(o.x-20,GROUND_Y-96,40,14);
        g.fillRect(o.x-4,GROUND_Y-96,8,96);
      }
    });
    // coins
    state.coins.forEach(c=>{
      g.fillStyle='#ffd166';
      g.beginPath(); g.arc(c.x,c.y,12,0,Math.PI*2); g.fill();
      g.strokeStyle='#b37f00'; g.lineWidth=2; g.stroke();
      g.fillStyle='#b37f00'; g.font='bold 12px Segoe UI'; g.textAlign='center';
      g.fillText('★',c.x,c.y+4);
    });
    drawSparks(g, state.sparkle);

    // HUD
    g.textAlign='left'; g.font='bold 20px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText('Distance: '+Math.round(state.dist)+'m', 20, 30);
  }
  return {
    title:'Stickman Dash', hint:'Tap JUMP to leap spikes, hold DUCK under bars! (or ↑/↓ keys)',
    controlsHtml: `
      <div class="padBtns"></div>
      <div class="actionBtns" style="margin:0 auto;">
        <button class="ctlBtn wide" id="btnDuck" style="background:#ffd166;">⬇ DUCK</button>
        <button class="ctlBtn wide" id="btnJump" style="background:#06d6a0;color:#fff;">⬆ JUMP</button>
      </div>`,
    bindControls(){
      bindHoldBtn('btnDuck','duck');
      bindTapBtn('btnJump', ()=>{ keys['jump']=true; });
    },
    create(){ state=fresh(); return this; },
    restart(){ state=fresh(); hideOverlay(); },
    update, draw,
  };
}

/* =========================================================
   GAME 4 — Hoop Shootout (basketball)
   ========================================================= */
