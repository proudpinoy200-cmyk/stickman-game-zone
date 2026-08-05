/* =========================================================
   GAME 12 — Stick Sharpshooter (spy-movie reaction/aiming game)
   Deactivate 10 rogue robot decoys before they duck away. Kid-friendly
   reskin of the classic "sniper" concept: no humans, no realism — just
   silver/red cartoon warning-light robots and a heroic secret-agent tone.
   ========================================================= */
function createSniperGame(){
  let state;
  const TOTAL_TARGETS = 10;
  const MAX_STRIKES = 3;      // a 4th escape ends the mission
  const HELI_DURATION = 1.9;  // seconds for the extraction flourish

  const AGENT_POSE = {legF:100,legB:96,armF:-70,armB:-100,lean:-88,headBob:0};

  function fresh(){
    return {
      phase: 'playing',          // 'playing' | 'victory' | 'failed' | 'done'
      targets: [],
      spawnedCount: 0,
      deactivated: 0,
      strikes: 0,
      elapsed: 0,
      animT: 0,
      spawnCooldown: 1.0,        // brief "get ready" beat before the first bot appears
      shakeT: 0,
      flashT: 0,
      flashColor: 'rgba(255,255,255,0.3)',
      particles: makeParticlePool(),
      popups: [],
      heliT: 0,
      heliDone: false,
      poseCur: clonePose(AGENT_POSE),
      buildings: makeSkyline(),
      searchAngle: rand(0, Math.PI*2),
    };
  }

  function makeSkyline(){
    const list = [];
    let x = -10;
    while(x < CW+20){
      const w = rand(46,90);
      list.push({x, w, h: rand(50,150)});
      x += w + rand(2,10);
    }
    return list;
  }

  /* ---------------- target spawning ---------------- */
  function pickPositions(n){
    const positions = [];
    let tries = 0;
    while(positions.length < n && tries < 60){
      tries++;
      const x = rand(80, CW-80);
      const y = rand(110, 320);
      if(positions.every(p=>dist(p.x,p.y,x,y) > 150)) positions.push({x,y});
    }
    while(positions.length < n) positions.push({x:rand(80,CW-80), y:rand(110,320)});
    return positions;
  }
  function spawnBatch(){
    const remaining = TOTAL_TARGETS - state.spawnedCount;
    if(remaining<=0) return;
    let batchSize = 1;
    // occasional double-target waves later in the mission for variety/difficulty
    if(state.spawnedCount>=5 && remaining>=2 && Math.random()<0.4) batchSize = 2;
    batchSize = Math.min(batchSize, remaining);
    const positions = pickPositions(batchSize);
    for(let i=0;i<batchSize;i++){
      const progress = clamp(state.spawnedCount/(TOTAL_TARGETS-1), 0, 1);
      const duration = lerp(3.2, 1.8, progress);
      state.targets.push({
        x: positions[i].x, y: positions[i].y, r: 30,
        duration, t: 0,
        bornT: 0, spin: rand(-0.3,0.3),
        lightPhase: rand(0,Math.PI*2),
      });
      state.spawnedCount++;
    }
    SFX.beep();
  }

  /* ---------------- resolving targets ---------------- */
  function removeTarget(t){
    const i = state.targets.indexOf(t);
    if(i>=0) state.targets.splice(i,1);
  }
  function deactivateTarget(t){
    state.deactivated++;
    spawnSpark(state.particles, t.x, t.y, '#ffd166', 12);
    spawnSpark(state.particles, t.x, t.y, '#ff5050', 8);
    spawnSpark(state.particles, t.x, t.y, '#c9d6e3', 8);
    SFX.stomp();
    if(state.deactivated===TOTAL_TARGETS) SFX.bomb();
    state.popups.push({x:t.x, y:t.y-36, text:'DEACTIVATED!', color:'#39ff88', life:1});
    state.shakeT = 0.16;
    state.flashT = 0.12;
    state.flashColor = 'rgba(255,255,255,0.28)';
    removeTarget(t);
    state.spawnCooldown = 0.45;
  }
  function registerEscape(t){
    state.strikes++;
    SFX.hurt();
    state.popups.push({x:t.x, y:t.y-36, text:'ESCAPED!', color:'#ff5050', life:1});
    spawnSpark(state.particles, t.x, t.y, '#9aa8b8', 10);
    state.shakeT = 0.22;
    state.flashT = 0.2;
    state.flashColor = 'rgba(255,60,60,0.32)';
    removeTarget(t);
    state.spawnCooldown = 0.5;
    if(state.strikes >= MAX_STRIKES+1){
      triggerFail();
    }
  }
  function triggerFail(){
    state.phase = 'failed';
    state.targets = [];
    SFX.gameover();
    setTimeout(()=>{
      recordRoundComplete();
      showGameOverOverlay('sniper', Number(state.elapsed.toFixed(1)), '🚨 Mission Failed',
        `${state.strikes} rogue bots slipped away! You deactivated ${state.deactivated}/${TOTAL_TARGETS} before backup was called off. Regroup and try again, agent!`,
        [
          {label:'Retry Mission', onClick:()=>{ state=fresh(); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      state.phase = 'done';
    }, 500);
  }
  function startVictory(){
    state.phase = 'victory';
    state.targets = [];
    state.heliT = 0;
    state.heliDone = false;
    SFX.victory();
  }
  function finishVictory(){
    recordRoundComplete();
    unlockAchievement('sniper_hero');
    const finalScore = Number(state.elapsed.toFixed(1));
    showGameOverOverlay('sniper', finalScore, '🚁 Mission Complete!',
      `All ${TOTAL_TARGETS} rogue robot decoys deactivated in ${finalScore}s with ${state.strikes} strike${state.strikes===1?'':'s'}. The city is safe — you're a true Stick Sharpshooter hero!`,
      [
        {label:'Play Again', onClick:()=>{ state=fresh(); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    state.phase = 'done';
  }

  /* ---------------- update ---------------- */
  function update(dt){
    state.animT += dt;
    state.searchAngle += dt*0.35;
    updateParticles(state.particles, dt, 200);
    if(state.shakeT>0) state.shakeT -= dt;
    if(state.flashT>0) state.flashT -= dt;
    state.popups.forEach(p=>{ p.y -= 28*dt; p.life -= dt*1.3; });
    state.popups = state.popups.filter(p=>p.life>0);

    const lean = Math.sin(state.animT*1.6)*3;
    const target = clonePose(AGENT_POSE);
    target.headBob = Math.sin(state.animT*2.2)*1.4;
    target.lean = AGENT_POSE.lean + lean*0.3;
    lerpPose(state.poseCur, target, smoothT(10, dt));

    if(state.phase === 'playing'){
      state.elapsed += dt;
      if(state.spawnCooldown>0) state.spawnCooldown -= dt;
      if(state.targets.length===0 && state.spawnCooldown<=0){
        if(state.spawnedCount >= TOTAL_TARGETS){
          // every target has been spawned and resolved (hit or escaped) — the
          // mission is over either way: a perfect 10/10 is victory, anything
          // less (even without ever hitting the 4th-strike fail trigger) means
          // the mission wasn't fully completed.
          if(state.deactivated >= TOTAL_TARGETS) startVictory();
          else triggerFail();
        } else {
          spawnBatch();
        }
      }
      for(const t of state.targets.slice()){
        t.t += dt;
        t.bornT += dt;
        if(t.t >= t.duration) registerEscape(t);
      }
    } else if(state.phase === 'victory'){
      state.heliT += dt;
      if(!state.heliDone && state.heliT >= HELI_DURATION){
        state.heliDone = true;
        finishVictory();
      }
    }
  }

  /* ---------------- tap handling ---------------- */
  function onPointerDown(x,y){
    if(state.phase !== 'playing') return;
    let best = null, bestD = Infinity;
    for(const t of state.targets){
      const d = dist(x,y,t.x,t.y);
      if(d <= t.r+10 && d < bestD){ best = t; bestD = d; }
    }
    if(best){
      deactivateTarget(best);
    } else {
      SFX.wrong();
      spawnSpark(state.particles, x, y, '#9aa8b8', 4);
    }
  }

  /* ---------------- drawing ---------------- */
  function drawSkyBg(g){
    const grad = g.createLinearGradient(0,0,0,CH);
    grad.addColorStop(0,'#0c1330');
    grad.addColorStop(0.55,'#1a1f4d');
    grad.addColorStop(1,'#241a3f');
    g.fillStyle = grad;
    g.fillRect(0,0,CW,CH);
    // moon
    g.save();
    g.fillStyle = '#eaf2ff';
    g.shadowColor = '#eaf2ff'; g.shadowBlur = 20;
    g.beginPath(); g.arc(CW-90, 70, 30, 0, Math.PI*2); g.fill();
    g.restore();
    // slow-sweeping spy searchlight beams
    g.save();
    g.globalAlpha = 0.08;
    for(let i=0;i<2;i++){
      const ang = state.searchAngle + i*Math.PI;
      const bx = CW*0.3 + i*CW*0.4;
      g.save();
      g.translate(bx, CH+20);
      g.rotate(Math.sin(ang)*0.6 - 0.3);
      g.fillStyle = '#7CFFF3';
      g.beginPath();
      g.moveTo(0,0); g.lineTo(-70,-360); g.lineTo(70,-360);
      g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    // twinkling stars
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for(let i=0;i<26;i++){
      const x = (i*67)%CW, y = (i*41)%230;
      const tw = 0.4+0.6*Math.abs(Math.sin(state.animT*1.5+i));
      g.globalAlpha = tw*0.6;
      g.fillRect(x,y,2,2);
    }
    g.globalAlpha = 1;
    // skyline silhouette
    g.fillStyle = '#141233';
    state.buildings.forEach(b=>{
      const y = 340 - b.h;
      g.fillRect(b.x, y, b.w, b.h+40);
      // lit windows
      g.fillStyle = 'rgba(255,214,102,0.5)';
      for(let wy=y+10; wy<330; wy+=16){
        for(let wx=b.x+6; wx<b.x+b.w-6; wx+=14){
          if((Math.floor(wx+wy)%5)===0) g.fillRect(wx,wy,4,6);
        }
      }
      g.fillStyle = '#141233';
    });
    // rooftop foreground ledge the agent crouches behind
    g.fillStyle = '#0a0a1c';
    g.fillRect(0, 336, CW, CH-336);
    roundRect(0, 330, CW, 14, 3);
    g.fillStyle = '#171638';
    g.fill();
  }

  function drawRobot(g,t){
    const remain = clamp(1 - t.t/t.duration, 0, 1);
    const pulse = 0.8+0.2*Math.sin(state.animT*8 + t.lightPhase);
    const pop = clamp(t.bornT/0.18, 0, 1); // little pop-in scale
    g.save();
    g.translate(t.x, t.y);
    g.scale(pop, pop);

    // shrinking timer ring
    g.save();
    g.beginPath();
    g.arc(0,0, t.r+9, -Math.PI/2, -Math.PI/2 + Math.PI*2*remain);
    g.strokeStyle = remain>0.5 ? '#39ff88' : (remain>0.25 ? '#ffd166' : '#ff5050');
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.stroke();
    g.restore();

    // warning-stripe collar
    g.save();
    g.beginPath(); g.arc(0,0,t.r+3,0,Math.PI*2); g.clip();
    g.fillStyle = '#2a2f38';
    g.fillRect(-t.r-4,-t.r-4,(t.r+4)*2,(t.r+4)*2);
    g.fillStyle = '#ffd166';
    for(let a=0;a<Math.PI*2;a+=Math.PI/6){
      g.save(); g.rotate(a);
      g.fillRect(-4, -t.r-4, 8, (t.r+4)*2*0.18);
      g.restore();
    }
    g.restore();

    // body (silver decoy robot head/torso blob)
    g.fillStyle = '#c9d6e3';
    g.beginPath(); g.arc(0,0,t.r,0,Math.PI*2); g.fill();
    g.fillStyle = '#8fa3b8';
    g.beginPath(); g.arc(0,t.r*0.15,t.r*0.86,0,Math.PI*2); g.fill();

    // antenna
    g.strokeStyle = '#8fa3b8'; g.lineWidth=3;
    g.beginPath(); g.moveTo(0,-t.r); g.lineTo(t.r*0.35,-t.r*1.5); g.stroke();
    g.fillStyle = '#ff5050';
    g.globalAlpha = pulse;
    g.beginPath(); g.arc(t.r*0.35,-t.r*1.5,4.5,0,Math.PI*2); g.fill();
    g.globalAlpha = 1;

    // single blinking warning-light eye
    g.fillStyle = '#1c2b3a';
    g.beginPath(); g.arc(0,-2,t.r*0.5,0,Math.PI*2); g.fill();
    g.fillStyle = '#ff3b3b';
    g.globalAlpha = pulse;
    g.shadowColor = '#ff3b3b'; g.shadowBlur = 10;
    g.beginPath(); g.arc(0,-2,t.r*0.24,0,Math.PI*2); g.fill();
    g.shadowBlur = 0;
    g.globalAlpha = 1;

    // mischievous grin
    g.strokeStyle = '#1c2b3a'; g.lineWidth=2.5; g.lineCap='round';
    g.beginPath(); g.arc(0, t.r*0.35, t.r*0.4, deg(20), deg(160)); g.stroke();

    g.restore();
  }

  function drawCrosshair(g){
    const x = pointer.x, y = pointer.y;
    g.save();
    g.translate(x,y);
    g.rotate(state.animT*0.6);
    g.strokeStyle = '#ff3b3b';
    g.lineWidth = 2.4;
    g.shadowColor = '#ff3b3b'; g.shadowBlur = 6;
    g.beginPath(); g.arc(0,0,17,0,Math.PI*2); g.stroke();
    g.beginPath(); g.arc(0,0,6,0,Math.PI*2); g.stroke();
    [0,90,180,270].forEach(a=>{
      const ang = deg(a);
      const x1 = Math.cos(ang)*22, y1 = Math.sin(ang)*22;
      const x2 = Math.cos(ang)*28, y2 = Math.sin(ang)*28;
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
    });
    g.restore();
  }

  function drawHeli(g){
    // flies in from the left, hovers to extract the agent, rotor spinning throughout
    const p = clamp(state.heliT/(HELI_DURATION*0.55), 0, 1);
    const hx = lerp(-90, CW*0.5-40, easeOutQuad(p));
    const hy = 90 + Math.sin(state.animT*6)*4;
    g.save();
    g.translate(hx,hy);
    g.fillStyle = '#3a4a63';
    roundRect2(g,-38,-14,60,26,10); g.fill();
    g.beginPath(); g.moveTo(22,-4); g.lineTo(48,2); g.lineTo(22,8); g.closePath(); g.fill();
    g.fillStyle = '#ffd166';
    g.beginPath(); g.arc(-6,0,8,0,Math.PI*2); g.fill();
    // rotor
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth=3;
    const spin = state.animT*30;
    g.save(); g.translate(-8,-16); g.rotate(spin);
    g.beginPath(); g.moveTo(-34,0); g.lineTo(34,0); g.stroke();
    g.restore();
    // rope ladder down to the rooftop once mostly arrived
    if(p>0.9){
      g.strokeStyle = '#cbb994'; g.lineWidth=2;
      g.beginPath(); g.moveTo(-6,10); g.lineTo(-6,110); g.moveTo(6,10); g.lineTo(6,110); g.stroke();
      for(let ry=20; ry<105; ry+=16){ g.beginPath(); g.moveTo(-6,ry); g.lineTo(6,ry); g.stroke(); }
    }
    g.restore();
  }
  function roundRect2(g,x,y,w,h,r){
    g.beginPath();
    g.moveTo(x+r,y);
    g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);
    g.arcTo(x,y,x+w,y,r);
    g.closePath();
  }

  function drawHud(g){
    g.textAlign='left'; g.font='bold 17px Segoe UI'; g.fillStyle='#eafcff';
    g.fillText('🎯 Deactivated: '+state.deactivated+'/'+TOTAL_TARGETS, 16, 26);
    g.textAlign='center';
    g.fillText('⏱ '+state.elapsed.toFixed(1)+'s', CW/2, 26);
    g.textAlign='right';
    g.fillStyle = state.strikes>=MAX_STRIKES ? '#ff5050' : '#eafcff';
    g.fillText('⚠️ '+state.strikes+'/'+MAX_STRIKES, CW-16, 26);
    if(state.phase==='playing' && state.spawnedCount===0 && state.targets.length===0){
      g.textAlign='center'; g.font='bold 26px Segoe UI'; g.fillStyle='rgba(255,255,255,0.85)';
      g.fillText('Get ready, agent...', CW/2, CH/2-40);
    }
  }

  function draw(g){
    let shakeX=0, shakeY=0;
    if(state.shakeT>0){ shakeX = rand(-5,5); shakeY = rand(-5,5); }
    g.save();
    g.translate(shakeX, shakeY);

    drawSkyBg(g);

    state.targets.forEach(t=>drawRobot(g,t));
    drawSparks(g, state.particles);

    // agent stick figure crouched behind the rooftop ledge, taking aim
    drawStick(g, 400, 372, 0.85, '#e2c290', 1, state.poseCur, {expr:'idle', accessory:'band', accessoryColor:'#ff5050'});

    state.popups.forEach(p=>{
      g.globalAlpha = clamp(p.life,0,1);
      g.fillStyle = p.color; g.font='bold 16px Segoe UI'; g.textAlign='center';
      g.fillText(p.text, p.x, p.y);
    });
    g.globalAlpha = 1;

    if(state.phase==='playing') drawCrosshair(g);
    if(state.phase==='victory') drawHeli(g);

    drawHud(g);
    g.restore();

    if(state.flashT>0){
      g.save();
      g.globalAlpha = clamp(state.flashT/0.2, 0, 1);
      g.fillStyle = state.flashColor;
      g.fillRect(0,0,CW,CH);
      g.restore();
    }
    if(state.phase==='victory'){
      g.save();
      g.textAlign='center'; g.font='bold 22px Segoe UI'; g.fillStyle='#39ff88';
      g.fillText('🚁 Extraction in progress...', CW/2, 60);
      g.restore();
    }
  }

  return {
    title: 'Stick Sharpshooter',
    hint: 'Tap the rogue robot decoys before their timer ring runs out — 3 escapes and the mission is over!',
    controlsHtml: '',
    bindControls(){},
    create(){ state = fresh(); return this; },
    restart(){ state = fresh(); hideOverlay(); },
    update, draw, onPointerDown,
  };
}
