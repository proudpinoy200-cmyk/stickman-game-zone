/* =========================================================
   GAME — Stick Swimmer Olympics
   8-lane Olympic swimming heats: mash/tap to swim, place top-3
   across 3 heats to become the Olympic Champion.
   ========================================================= */
function createSwimmerGame(){
  let state;
  // Persist across heats within one campaign (reset on create()/restart()), same
  // pattern as Stickman Racer's closure-scoped totalTime — lower total is better.
  let totalTime = 0;
  let goldCount = 0;

  const LEVELS = 3;
  const LANES = 8;
  const POOL_TOP = 54, POOL_BOT = 430;
  const LANE_H = (POOL_BOT - POOL_TOP) / LANES;
  const START_X = 92, FINISH_X = 742;
  const RACE_LEN = FINISH_X - START_X;
  const PLAYER_LANE = 4;
  const STROKE_KICK = 26, DRAG = 3.0, MAX_SPEED = 320;
  const NPC_NAMES = ['Riptide','Marlin','Bubbles','Torpedo','Splash','Finn','Nautica'];
  const SWIMMER_COLORS = ['#e63946','#ffb703','#06d6a0','#9b5de5','#118ab2','#f4a261','#ef476f'];
  const PLAYER_COLOR = '#2b6cb0';

  function laneY(i){ return POOL_TOP + (i+0.5)*LANE_H; }
  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const t = a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }
  function ordinal(n){
    const v = n % 100;
    if(v>=11 && v<=13) return n+'th';
    switch(n % 10){
      case 1: return n+'st';
      case 2: return n+'nd';
      case 3: return n+'rd';
      default: return n+'th';
    }
  }
  function medalFor(place){ return place===1?'🥇':place===2?'🥈':place===3?'🥉':(ordinal(place)); }

  function fresh(level){
    const laneChoices = shuffle([0,1,2,3,5,6,7]);
    const npcs = NPC_NAMES.map((name,i)=>({
      name, color: SWIMMER_COLORS[i], lane: laneChoices[i], isPlayer:false,
      dist:0, speed:0, finished:false, finishTime:0, place:0,
      baseSpeed: (74 + level*5) * rand(0.82,1.18),
      surging:false, surgeT: rand(1.2,3), surgeTimeLeft:0,
      wobbleSeed: rand(0, Math.PI*2),
      splashTimer: rand(0,0.2),
    }));
    const player = {
      name:'You', color: PLAYER_COLOR, lane: PLAYER_LANE, isPlayer:true,
      dist:0, speed:0, finished:false, finishTime:0, place:0,
      wobbleSeed: rand(0, Math.PI*2),
      splashTimer:0, sfxCooldown:0,
    };
    const swimmers = npcs.concat([player]);
    return {
      level, player, npcs, swimmers,
      clock:0, over:false,
      finishOrder:[], standings:[],
      postFinishTimer:null,
      sparks: makeParticlePool(),
    };
  }

  function spawnSplash(sw){
    const x = START_X + clamp(sw.dist,0,RACE_LEN);
    const y = laneY(sw.lane);
    spawnSpark(state.sparks, x+6, y+10, 'rgba(255,255,255,0.85)', sw.isPlayer?3:2);
    spawnSpark(state.sparks, x+6, y+10, '#bfe9ff', 2);
  }

  function doStroke(){
    if(!state || state.over) return;
    const player = state.player;
    if(player.finished) return;
    player.speed = clamp(player.speed + STROKE_KICK, 0, MAX_SPEED);
    if(player.sfxCooldown<=0){ SFX.swish(); player.sfxCooldown = 0.06; }
    spawnSpark(state.sparks, START_X+clamp(player.dist,0,RACE_LEN)+8, laneY(player.lane)+8, '#eaffff', 5);
  }

  function finishSwimmer(sw){
    if(sw.finished) return;
    sw.finished = true;
    sw.finishTime = state.clock;
    state.finishOrder.push(sw);
    if(sw.isPlayer){
      SFX.powerup();
      state.postFinishTimer = 3.0;
    } else {
      SFX.coin();
    }
  }

  function endRace(){
    if(state.over) return;
    state.over = true;
    const unfinished = state.swimmers.filter(s=>!s.finished).sort((a,b)=>b.dist-a.dist);
    const standings = state.finishOrder.concat(unfinished);
    standings.forEach((s,i)=>{ s.place = i+1; });
    state.standings = standings;
    const place = state.player.place;
    if(place===1){ SFX.victory(); goldCount++; }
    else if(place<=3) SFX.levelup();
    else SFX.wrong();
    setTimeout(showRaceResult, 900);
  }

  function showRaceResult(){
    const player = state.player;
    const place = player.place;
    const top3 = state.standings.slice(0,3);
    const podiumSummary = top3.map(s=>`${medalFor(s.place)} ${s.name}${s.isPlayer?' (You!)':''}`).join('   ');
    if(place<=3){
      totalTime += state.clock;
      if(state.level>=LEVELS){
        recordRoundComplete();
        unlockAchievement('swim_gold');
        const goldLine = goldCount>0 ? ` You touched the wall first for gold ${goldCount} time${goldCount>1?'s':''} along the way!` : '';
        showGameOverOverlay('swimmer', totalTime, '🏅 Olympic Champion!',
          `${podiumSummary} — You medaled in all ${LEVELS} heats!${goldLine} Total swim time: ${totalTime.toFixed(1)}s`,
          [
            {label:'Swim Again', onClick:()=>{ totalTime=0; goldCount=0; state=fresh(1); hideOverlay(); }},
            {label:'Home', onClick: goHome}
          ]);
      } else {
        showOverlay(`Heat ${state.level} Complete!`,
          `${podiumSummary} — You finished ${ordinal(place)}! Great swimming — get ready for the next heat.`,
          [ {label:'Next Heat ▶', onClick:()=>{ state=fresh(state.level+1); hideOverlay(); }} ]);
      }
    } else {
      showOverlay(`Heat ${state.level} Results`,
        `${podiumSummary} — You finished ${ordinal(place)}. Top 3 advances to the next heat — give it another go, you've got this!`,
        [ {label:'Retry Heat', onClick:()=>{ state=fresh(state.level); hideOverlay(); }} ]);
    }
  }

  function updateNpc(n, dt){
    if(n.finished) return;
    n.surgeT -= dt;
    if(!n.surging && n.surgeT<=0){
      if(Math.random()<0.5){ n.surging = true; n.surgeTimeLeft = rand(0.35,0.9); }
      n.surgeT = rand(1.6,3.2);
    }
    let mult = 1;
    if(n.surging){
      mult = 1.55;
      n.surgeTimeLeft -= dt;
      if(n.surgeTimeLeft<=0) n.surging = false;
    }
    const wobble = 1 + Math.sin(state.clock*1.3 + n.wobbleSeed)*0.07;
    n.speed = n.baseSpeed*mult*wobble;
    n.dist = clamp(n.dist + n.speed*dt, 0, RACE_LEN);
    n.splashTimer -= dt;
    if(n.speed>20 && n.splashTimer<=0){ spawnSplash(n); n.splashTimer = rand(0.09,0.17); }
    if(n.dist>=RACE_LEN) finishSwimmer(n);
  }

  function update(dt){
    updateParticles(state.sparks, dt, 190);
    if(state.player.sfxCooldown>0) state.player.sfxCooldown -= dt;
    window.__debug = {level: state.level, over: state.over, place: state.player.place || currentPlace()};
    if(state.over) return;
    state.clock += dt;

    if(keys[' ']){ keys[' '] = false; doStroke(); }

    const player = state.player;
    if(!player.finished){
      player.speed *= Math.exp(-DRAG*dt);
      player.dist = clamp(player.dist + player.speed*dt, 0, RACE_LEN);
      player.splashTimer -= dt;
      if(player.speed>20 && player.splashTimer<=0){ spawnSplash(player); player.splashTimer = 0.08; }
      if(player.dist>=RACE_LEN) finishSwimmer(player);
    }

    state.npcs.forEach(n=>updateNpc(n, dt));

    if(state.postFinishTimer!=null){
      state.postFinishTimer -= dt;
      if(state.postFinishTimer<=0){ endRace(); return; }
    }
    if(state.finishOrder.length>=LANES) endRace();
  }

  function currentPlace(){
    const player = state.player;
    if(player.finished) return player.place || (state.finishOrder.indexOf(player)+1);
    return 1 + state.swimmers.filter(s=> s!==player && (s.finished || s.dist>player.dist)).length;
  }

  function swimPose(sw, t){
    if(sw.finished){
      return {legF:96, legB:88, armF:-70, armB:-110, lean:-84, headBob: Math.sin(t*2+sw.wobbleSeed)*1.4};
    }
    const rate = 1.7 + clamp(sw.speed,0,320)*0.011;
    const phase = sw.wobbleSeed;
    const armAngle = (t*rate*360 + phase*57.3);
    const kick = Math.sin(t*rate*4 + phase*3)*22;
    return {
      legF: 176 + kick,
      legB: 184 - kick,
      armF: armAngle,
      armB: armAngle + 180,
      lean: -6 + Math.sin(t*rate*2 + phase)*5,
      headBob: Math.sin(t*rate*4 + phase)*1.6,
    };
  }

  function drawPool(g){
    drawFlatBg('#bdeeff','#eafcff');
    const grad = g.createLinearGradient(0, POOL_TOP, 0, POOL_BOT);
    grad.addColorStop(0, '#3aa9e0');
    grad.addColorStop(0.55, '#1c7fc4');
    grad.addColorStop(1, '#155f96');
    g.fillStyle = grad;
    g.fillRect(0, POOL_TOP, CW, POOL_BOT-POOL_TOP);
    // shimmer streaks
    g.save();
    g.globalAlpha = 0.16;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    for(let i=0;i<10;i++){
      const off = (i*90 - state.clock*40) % (CW+120) - 60;
      g.beginPath();
      g.moveTo(off, POOL_TOP+8);
      g.lineTo(off+50, POOL_BOT-8);
      g.stroke();
    }
    g.restore();
    // lane ropes
    for(let i=1;i<LANES;i++){
      const y = POOL_TOP + i*LANE_H;
      for(let x=6; x<CW; x+=16){
        g.fillStyle = (Math.floor(x/16)%2===0) ? '#e63946' : '#ffffff';
        g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI*2); g.fill();
      }
    }
    // pool deck edges
    g.fillStyle = '#e9edf2';
    g.fillRect(0, POOL_TOP-8, CW, 8);
    g.fillRect(0, POOL_BOT, CW, 8);
    // start blocks
    for(let i=0;i<LANES;i++){
      g.fillStyle = '#8d99ae';
      g.fillRect(START_X-26, POOL_TOP+i*LANE_H+6, 16, LANE_H-12);
    }
    // finish line + flag
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 4;
    g.setLineDash([10,8]);
    g.beginPath(); g.moveTo(FINISH_X, POOL_TOP-4); g.lineTo(FINISH_X, POOL_BOT+4); g.stroke();
    g.setLineDash([]);
    g.font = 'bold 22px Segoe UI';
    g.textAlign = 'center';
    g.fillText('🏁', FINISH_X, POOL_TOP-10);
  }

  function drawSwimmers(g){
    drawSparks(g, state.sparks);
    state.swimmers.forEach(sw=>{
      const x = START_X + clamp(sw.dist,0,RACE_LEN);
      const y = laneY(sw.lane);
      const pose = swimPose(sw, state.clock);
      drawStick(g, x, y, 0.6, sw.color, 1, pose,
        {expr: sw.finished ? 'happy' : 'shout', accessory:'band', accessoryColor:'#ffffff'});
      g.font = 'bold 10px Segoe UI';
      g.textAlign = 'center';
      g.fillStyle = sw.isPlayer ? '#1c2b3a' : 'rgba(28,43,58,0.75)';
      g.fillText(sw.isPlayer ? 'YOU' : sw.name, x, y - 22);
    });
  }

  function drawHUD(g){
    g.textAlign = 'left'; g.font = 'bold 16px Segoe UI'; g.fillStyle = '#1c2b3a';
    g.fillText('Heat '+state.level+'/'+LEVELS, 14, 24);
    g.fillText('Time: '+state.clock.toFixed(1)+'s', 14, 44);
    g.textAlign = 'right';
    g.fillText('Place: '+currentPlace()+'/'+LANES, CW-14, 24);
    const pct = clamp(state.player.dist/RACE_LEN, 0, 1);
    g.textAlign = 'center';
    g.fillText(Math.round(pct*100)+'%', CW/2, 24);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(CW/2-100, 30, 200, 8);
    g.fillStyle = '#06d6a0'; g.fillRect(CW/2-100, 30, 200*pct, 8);
  }

  function drawPodiumScene(g){
    roundRect(150, 60, 500, 360, 22);
    g.fillStyle = 'rgba(8,20,38,0.5)';
    g.fill();
    const standings = state.standings || [];
    const spots = [
      {rank:1, x:400, h:120, color:'#ffd166', medal:'🥇'},
      {rank:2, x:290, h:82, color:'#d9d9e3', medal:'🥈'},
      {rank:3, x:510, h:58, color:'#cd7f32', medal:'🥉'},
    ];
    const baseY = 400;
    g.textAlign = 'center';
    spots.forEach(spot=>{
      const s = standings[spot.rank-1];
      g.fillStyle = spot.color;
      g.fillRect(spot.x-46, baseY-spot.h, 92, spot.h);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
      g.strokeRect(spot.x-46, baseY-spot.h, 92, spot.h);
      g.font = 'bold 22px Segoe UI';
      g.fillStyle = 'rgba(28,43,58,0.75)';
      g.fillText(String(spot.rank), spot.x, baseY-spot.h/2+8);
      if(s){
        const pose = {legF:98, legB:82, armF:-60, armB:-120, lean:-90, headBob: Math.sin(state.clock*2+spot.rank)*1.5};
        drawStick(g, spot.x, baseY-spot.h, 0.85, s.color, 1, pose,
          {expr:'happy', accessory:'band', accessoryColor:'#ffffff'});
        g.font = 'bold 26px Segoe UI';
        g.fillText(spot.medal, spot.x, baseY-spot.h-78);
        g.font = 'bold 13px Segoe UI';
        g.fillStyle = '#ffffff';
        g.fillText(s.isPlayer ? 'YOU!' : s.name, spot.x, baseY-spot.h-58);
      }
    });
  }

  function draw(g){
    drawPool(g);
    drawSwimmers(g);
    drawHUD(g);
    if(state.over) drawPodiumScene(g);
  }

  return {
    title: 'Stick Swimmer Olympics',
    hint: 'Tap SWIM! (or mash the spacebar) again and again — steady rapid strokes swim fastest! Finish top 3 to advance.',
    controlsHtml: `
      <div class="actionBtns" style="margin:0 auto;">
        <button class="ctlBtn wide" id="btnSwim" style="background:#2ec4b6;color:#fff;font-size:1.15em;">🏊 SWIM!</button>
      </div>`,
    bindControls(){
      bindTapBtn('btnSwim', ()=>{ doStroke(); });
    },
    create(){ totalTime = 0; goldCount = 0; state = fresh(1); return this; },
    restart(){ totalTime = 0; goldCount = 0; state = fresh(1); hideOverlay(); },
    update, draw,
  };
}
