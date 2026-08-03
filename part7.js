/* =========================================================
   GAME 9 — Bubble Shooter
   ========================================================= */
function createBubbleGame(){
  let state;
  const LEVELS = 5;
  const R = 22, COLS = 14, ROWH = R*1.75, TOP = 30;
  const MARGIN = (CW - (COLS*R*2 + R)) / 2;
  const DANGER_Y = 320;
  const SHOOT_Y = CH - 40, SHOOT_X = CW/2;
  const ALL_COLORS = ['#ff6b6b','#2ec4b6','#9b5de5','#ffd166','#06d6a0','#2b6cb0'];
  const LEVEL_ROWS = [4,5,5,6,6];
  const LEVEL_COLORS = [3,4,4,5,5];
  const LEVEL_PUSH = [12,11,10,9,8];

  function cellX(r,c){ return MARGIN + R + c*R*2 + (r%2===1?R:0); }
  function cellY(r){ return TOP + R + r*ROWH; }
  // hex "odd-r" neighbor offsets — rows alternate which diagonal neighbors they touch
  // depending on whether they're shifted right by half a bubble-width or not.
  function neighbors(r,c){
    const n = (r%2===1)
      ? [[r,c-1],[r,c+1],[r-1,c],[r-1,c+1],[r+1,c],[r+1,c+1]]
      : [[r,c-1],[r,c+1],[r-1,c-1],[r-1,c],[r+1,c-1],[r+1,c]];
    return n.filter(([rr,cc])=> cc>=0 && cc<COLS && rr>=0);
  }
  function randomRow(colors){
    const row = [];
    for(let c=0;c<COLS;c++) row.push(colors[Math.floor(Math.random()*colors.length)]);
    return row;
  }
  function makeGrid(level){
    const colors = ALL_COLORS.slice(0, LEVEL_COLORS[level-1]);
    const rows = LEVEL_ROWS[level-1];
    const grid = [];
    for(let r=0;r<rows;r++) grid.push(randomRow(colors));
    return {grid, colors};
  }
  function fresh(level, carryScore){
    const {grid, colors} = makeGrid(level);
    return {
      level, grid, colors,
      score: carryScore||0,
      shotsSincePush: 0, pushEvery: LEVEL_PUSH[level-1],
      curColor: colors[Math.floor(Math.random()*colors.length)],
      nextColor: colors[Math.floor(Math.random()*colors.length)],
      aiming:false, aimAngle:-Math.PI/2,
      flying:null,
      over:false, win:false,
      sparks: makeParticlePool(), popups:[],
      clock:0,
    };
  }
  function inBounds(r,c){ return r>=0 && r<state.grid.length && c>=0 && c<COLS; }
  function cellAt(r,c){ return inBounds(r,c) ? state.grid[r][c] : null; }
  function ensureRow(r){ while(state.grid.length<=r) state.grid.push(new Array(COLS).fill(null)); }
  function nearestEmpty(x,y){
    let best=null, bestD=Infinity;
    const maxR = state.grid.length+1;
    for(let r=0;r<=maxR;r++){
      for(let c=0;c<COLS;c++){
        if(cellAt(r,c)) continue;
        const d = dist(x,y,cellX(r,c),cellY(r));
        if(d<bestD){ bestD=d; best={r,c}; }
      }
    }
    return best;
  }
  function floodMatch(r,c,color){
    const seen = new Set(); const stack=[[r,c]]; const group=[];
    while(stack.length){
      const [rr,cc] = stack.pop();
      const key = rr+'_'+cc;
      if(seen.has(key)) continue;
      seen.add(key);
      if(cellAt(rr,cc)!==color) continue;
      group.push([rr,cc]);
      neighbors(rr,cc).forEach(n=>stack.push(n));
    }
    return group;
  }
  function removeFloating(){
    const anchored = new Set(); const stack=[];
    for(let c=0;c<COLS;c++) if(cellAt(0,c)) stack.push([0,c]);
    while(stack.length){
      const [r,c] = stack.pop();
      const key = r+'_'+c;
      if(anchored.has(key)) continue;
      anchored.add(key);
      neighbors(r,c).forEach(([nr,nc])=>{ if(cellAt(nr,nc) && !anchored.has(nr+'_'+nc)) stack.push([nr,nc]); });
    }
    let removed = 0;
    for(let r=0;r<state.grid.length;r++){
      for(let c=0;c<COLS;c++){
        if(cellAt(r,c) && !anchored.has(r+'_'+c)){
          spawnSpark(state.sparks, cellX(r,c), cellY(r), state.grid[r][c], 8);
          state.grid[r][c] = null;
          removed++;
        }
      }
    }
    return removed;
  }
  function isEmpty(){ return state.grid.every(row=>row.every(cell=>cell===null)); }
  function checkDanger(){
    for(let r=0;r<state.grid.length;r++){
      if(cellY(r) >= DANGER_Y){
        for(let c=0;c<COLS;c++) if(state.grid[r][c]) return true;
      }
    }
    return false;
  }
  function settle(x,y,color){
    const slot = nearestEmpty(x,y);
    if(!slot) return;
    ensureRow(slot.r);
    state.grid[slot.r][slot.c] = color;
    const group = floodMatch(slot.r, slot.c, color);
    if(group.length>=3){
      group.forEach(([r,c])=>{ spawnSpark(state.sparks, cellX(r,c), cellY(r), color, 10); state.grid[r][c]=null; });
      state.score += group.length*15;
      state.popups.push({x, y, text:'+'+(group.length*15), color:'#06d6a0', life:1});
      SFX.match();
      const floatCount = removeFloating();
      if(floatCount>0){
        state.score += floatCount*20;
        state.popups.push({x, y:y-24, text:'+'+(floatCount*20)+' bonus!', color:'#ffd166', life:1});
        SFX.coin();
      }
    } else {
      SFX.click();
    }
    if(isEmpty()){ levelComplete(); return; }
    if(checkDanger()){ loseGame(); return; }
    state.shotsSincePush++;
    if(state.shotsSincePush >= state.pushEvery){
      state.shotsSincePush = 0;
      state.grid.unshift(randomRow(state.colors));
      SFX.bomb();
      if(checkDanger()){ loseGame(); return; }
    }
  }
  function levelComplete(){
    state.over = true; state.win = true;
    SFX.victory();
    setTimeout(()=>{
      if(state.level>=LEVELS){
        showGameOverOverlay('bubble', state.score, '🏆 Bubble Master!', `You cleared every board! Final score: ${state.score} pts`, [
          {label:'Play Again', onClick:()=>{ state=fresh(1,0); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      } else {
        showOverlay(`Level ${state.level} Complete!`, `Board cleared! Score: ${state.score} pts`, [
          {label:'Next Level ▶', onClick:()=>{ state=fresh(state.level+1, state.score); hideOverlay(); }},
        ]);
      }
    }, 300);
  }
  function loseGame(){
    state.over = true; state.win = false;
    SFX.gameover();
    setTimeout(()=>{
      showGameOverOverlay('bubble', state.score, '🫧 Bubbles Overflowed!', `Final score: ${state.score} pts. Try again!`, [
        {label:'Retry Level', onClick:()=>{ state=fresh(state.level, 0); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    }, 250);
  }
  function angleFromPointer(x,y){
    let a = Math.atan2(y-SHOOT_Y, x-SHOOT_X);
    if(a > -deg(8)) a = -deg(8);
    if(a < -deg(172)) a = -deg(172);
    return a;
  }
  function onPointerDown(x,y){
    if(state.over || state.flying) return;
    state.aiming = true;
    state.aimAngle = angleFromPointer(x,y);
    SFX.unlock();
  }
  function onPointerMove(x,y){
    if(!state.aiming) return;
    state.aimAngle = angleFromPointer(x,y);
  }
  function onPointerUp(x,y){
    if(!state.aiming) return;
    state.aiming = false;
    if(state.flying || state.over) return;
    const speed = 620;
    state.flying = { x:SHOOT_X, y:SHOOT_Y, vx:Math.cos(state.aimAngle)*speed, vy:Math.sin(state.aimAngle)*speed, color: state.curColor };
    state.curColor = state.nextColor;
    state.nextColor = state.colors[Math.floor(Math.random()*state.colors.length)];
    SFX.whoosh();
  }
  function update(dt){
    window.__debug = {score: state.score, level: state.level};
    state.clock += dt;
    updateParticles(state.sparks, dt, 220);
    state.popups.forEach(p=>{ p.y -= 26*dt; p.life -= dt*0.9; });
    state.popups = state.popups.filter(p=>p.life>0);
    if(state.over) return;
    if(state.flying){
      const f = state.flying;
      f.x += f.vx*dt; f.y += f.vy*dt;
      if(f.x - R < 0){ f.x = R; f.vx *= -1; }
      if(f.x + R > CW){ f.x = CW-R; f.vx *= -1; }
      let hit = f.y - R <= TOP;
      if(!hit){
        outer:
        for(let r=0;r<state.grid.length;r++){
          for(let c=0;c<COLS;c++){
            if(!cellAt(r,c)) continue;
            if(dist(f.x,f.y,cellX(r,c),cellY(r)) < R*2*0.92){ hit = true; break outer; }
          }
        }
      }
      if(hit){
        const color = f.color, fx = f.x, fy = f.y;
        state.flying = null;
        settle(fx, fy, color);
      }
    }
  }
  function draw(g){
    drawFlatBg('#dff1ff','#f5faff');
    g.strokeStyle = 'rgba(230,57,70,0.55)'; g.lineWidth=2; g.setLineDash([8,6]);
    g.beginPath(); g.moveTo(0,DANGER_Y); g.lineTo(CW,DANGER_Y); g.stroke(); g.setLineDash([]);
    for(let r=0;r<state.grid.length;r++){
      for(let c=0;c<COLS;c++){
        const color = state.grid[r][c];
        if(!color) continue;
        const x = cellX(r,c), y = cellY(r);
        g.fillStyle = color;
        g.beginPath(); g.arc(x,y,R-1,0,Math.PI*2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.beginPath(); g.arc(x-R*0.3,y-R*0.3,R*0.3,0,Math.PI*2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth=1.5;
        g.beginPath(); g.arc(x,y,R-1,0,Math.PI*2); g.stroke();
      }
    }
    drawSparks(g, state.sparks);
    if(state.aiming){
      g.strokeStyle='rgba(43,58,74,0.5)'; g.lineWidth=3; g.setLineDash([7,7]);
      g.beginPath(); g.moveTo(SHOOT_X,SHOOT_Y);
      g.lineTo(SHOOT_X+Math.cos(state.aimAngle)*260, SHOOT_Y+Math.sin(state.aimAngle)*260);
      g.stroke(); g.setLineDash([]);
    }
    if(state.flying){
      g.fillStyle = state.flying.color;
      g.beginPath(); g.arc(state.flying.x, state.flying.y, R-1, 0, Math.PI*2); g.fill();
    }
    g.save(); g.translate(SHOOT_X, SHOOT_Y);
    g.fillStyle = '#456990';
    g.beginPath(); g.arc(0,14,20,0,Math.PI*2); g.fill();
    g.restore();
    g.fillStyle = state.curColor;
    g.beginPath(); g.arc(SHOOT_X, SHOOT_Y, R-1, 0, Math.PI*2); g.fill();
    g.strokeStyle='#1c2b3a'; g.lineWidth=2; g.stroke();
    g.font='bold 13px Segoe UI'; g.fillStyle='#2b3a4a'; g.textAlign='center';
    g.fillText('Next', CW-40, SHOOT_Y-28);
    g.fillStyle = state.nextColor;
    g.beginPath(); g.arc(CW-40, SHOOT_Y-8, R*0.6, 0, Math.PI*2); g.fill();
    g.strokeStyle='#1c2b3a'; g.lineWidth=1.5; g.stroke();
    g.font='bold 18px Segoe UI'; g.textAlign='center';
    state.popups.forEach(p=>{ g.globalAlpha=clamp(p.life,0,1); g.fillStyle=p.color; g.fillText(p.text, p.x, p.y); });
    g.globalAlpha=1;
    g.textAlign='left'; g.font='bold 18px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText('Score: '+state.score, 20, 28);
    g.textAlign='center';
    g.fillText('Level '+state.level+' / '+LEVELS, CW/2, 26);
  }
  return {
    title:'Bubble Shooter',
    hint:"Drag to aim, release to shoot — match 3+ same-color bubbles to pop them! Don't let them reach the red line.",
    controlsHtml:'',
    bindControls(){},
    create(){ state = fresh(1,0); return this; },
    restart(){ state = fresh(state.level,0); hideOverlay(); },
    update, draw, onPointerDown, onPointerMove, onPointerUp,
  };
}

/* =========================================================
   GAME 10 — Stickman Racer
   ========================================================= */
function createRacerGame(){
  let state;
  // Total time across the whole 5-race career — the leaderboard metric for this game
  // (lower is better). Resets whenever create()/restart() is called (a fresh run from the
  // home screen), but persists across "Next Race" within one playthrough.
  let totalTime = 0;
  const LEVELS = 5;
  const TRACK_TOP = 90, TRACK_BOT = 430, LANE_H = (TRACK_BOT-TRACK_TOP)/3;
  const NAMES = ['Dash','Blaze','Turbo'];
  const COLORS = ['#e63946','#9b5de5','#2ec4b6'];
  function laneY(i){ return TRACK_TOP + (i+0.72)*LANE_H; }
  function idlePose(){ return {legF:100,legB:80,armF:-58,armB:-132,lean:-90,headBob:0}; }
  function spawnObstacle(){ return { x: CW+40, lane: Math.floor(rand(0,3)), hit:false }; }
  function fresh(level){
    const baseSpeed = 230 + level*14;
    const finishDist = 1500 + level*260;
    const rivals = NAMES.map((name,i)=>({
      name, color: COLORS[i], lane: Math.floor(rand(0,3)),
      speed: baseSpeed*rand(0.84,1.02) + level*8,
      dist:0, laneT: rand(1.5,3.5),
      poseCur: clonePose(idlePose()),
    }));
    return {
      level, baseSpeed, finishDist,
      dist:0, lane:1, figY: laneY(1),
      t:0, clock:0,
      stumbleT:0, boosting:false, boostT:0, boostCharges:3,
      obstacles:[], spawnTimer:1.0,
      rivals, over:false, place:0,
      poseCur: clonePose(idlePose()),
      dust: makeParticlePool(), sparkle: makeParticlePool(),
    };
  }
  function changeLane(dir){
    if(state.over) return;
    state.lane = clamp(state.lane+dir, 0, 2);
    SFX.click();
  }
  function tryBoost(){
    if(state.over || state.boosting || state.boostCharges<=0) return;
    state.boostCharges--; state.boosting = true; state.boostT = 1.0;
    SFX.powerup();
  }
  function currentPlace(){ return 1 + state.rivals.filter(r=>r.dist>state.dist).length; }
  function finishRace(){
    state.over = true;
    state.place = currentPlace();
    totalTime += state.clock;
    if(state.place===1) SFX.victory(); else SFX.levelup();
    setTimeout(()=>{
      if(state.level>=LEVELS){
        showGameOverOverlay('racer', totalTime, '🏆 Racing Champion!', `You finished all ${LEVELS} races! Total time: ${totalTime.toFixed(1)}s`, [
          {label:'Play Again', onClick:()=>{ totalTime=0; state=fresh(1); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      } else {
        const label = state.place===1?'🥇 1st place':state.place===2?'🥈 2nd place':state.place===3?'🥉 3rd place':state.place+'th place';
        showOverlay(`Race ${state.level} Complete!`, `You finished ${label}! Get ready for the next race.`, [
          {label:'Next Race ▶', onClick:()=>{ state=fresh(state.level+1); hideOverlay(); }},
        ]);
      }
    }, 300);
  }
  function update(dt){
    window.__debug = {dist: Math.round(state.dist), level: state.level, place: currentPlace()};
    state.t += dt;
    updateParticles(state.dust, dt, 0);
    updateParticles(state.sparkle, dt, 200);
    if(state.over) return;
    state.clock += dt;
    if(keys['jump']){ keys['jump']=false; changeLane(-1); }
    if(keys['duck']){ keys['duck']=false; changeLane(1); }
    if(keys['doAttack']){ keys['doAttack']=false; tryBoost(); }
    state.figY = lerp(state.figY, laneY(state.lane), smoothT(14, dt));
    if(state.stumbleT>0) state.stumbleT -= dt;
    if(state.boosting){ state.boostT -= dt; if(state.boostT<=0) state.boosting=false; }
    const rampSpeed = Math.min(state.baseSpeed + state.t*6, state.baseSpeed*1.4);
    let mult = state.stumbleT>0 ? 0.4 : 1;
    if(state.boosting) mult *= 1.8;
    state.speed = rampSpeed*mult;
    state.dist += state.speed*dt;

    state.rivals.forEach(r=>{
      r.laneT -= dt;
      if(r.laneT<=0){ r.lane = Math.floor(rand(0,3)); r.laneT = rand(2,4.5); }
      r.dist += r.speed*dt*(1+Math.sin(state.t*0.7+r.name.length)*0.05);
    });

    state.spawnTimer -= dt;
    if(state.spawnTimer<=0){ state.obstacles.push(spawnObstacle()); state.spawnTimer = rand(0.85,1.4); }
    state.obstacles.forEach(o=> o.x -= state.speed*dt);
    state.obstacles = state.obstacles.filter(o=>o.x>-40);
    for(const o of state.obstacles){
      if(!o.hit && o.lane===state.lane && Math.abs(o.x-150)<26){
        o.hit = true;
        state.stumbleT = 0.6;
        SFX.hurt();
        spawnSpark(state.sparkle, 150, state.figY, '#ff6b6b', 10);
      }
    }

    const w = Math.sin(state.t*11)*30;
    const target = state.stumbleT>0
      ? {legF:96,legB:84,armF:14,armB:-172,lean:-76,headBob:-2}
      : {legF:100+w,legB:80-w,armF:-40-w*0.6,armB:-140+w*0.6,lean:-92-(state.boosting?8:0),headBob:Math.abs(w)*0.09};
    lerpPose(state.poseCur, target, smoothT(16,dt));
    state.rivals.forEach(r=>{
      const rw = Math.sin(state.t*11+r.name.length)*30;
      lerpPose(r.poseCur, {legF:100+rw,legB:80-rw,armF:-40-rw*0.6,armB:-140+rw*0.6,lean:-92,headBob:0}, smoothT(16,dt));
    });

    if(state.dist >= state.finishDist){ state.dist = state.finishDist; finishRace(); }
  }
  function draw(g){
    drawFlatBg('#a6e9ff','#eafff5');
    g.fillStyle='rgba(255,255,255,0.5)';
    for(let i=0;i<4;i++){
      const x = ((i*260 - state.dist*1.5)%(CW+300))-150;
      g.beginPath(); g.arc(x,80,50,0,Math.PI*2); g.fill();
    }
    for(let i=0;i<3;i++){
      g.fillStyle = i%2===0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)';
      g.fillRect(0, TRACK_TOP+i*LANE_H, CW, LANE_H);
    }
    g.strokeStyle='rgba(43,58,74,0.35)'; g.lineWidth=3; g.setLineDash([16,12]);
    for(let i=1;i<3;i++){ g.beginPath(); g.moveTo(0,TRACK_TOP+i*LANE_H); g.lineTo(CW,TRACK_TOP+i*LANE_H); g.stroke(); }
    g.setLineDash([]);
    drawDust(g, state.dust);
    state.rivals.forEach(r=>{
      const offset = clamp((r.dist-state.dist)*0.12, -260, 260);
      const rx = 150+offset, ry = laneY(r.lane);
      drawStick(g, rx, ry, 0.85, r.color, 1, r.poseCur, {expr:'idle'});
      g.font='bold 11px Segoe UI'; g.textAlign='center'; g.fillStyle='#1c2b3a';
      g.fillText(r.name, rx, ry-58);
    });
    state.obstacles.forEach(o=>{
      const oy = laneY(o.lane);
      g.fillStyle='#8d5524'; g.fillRect(o.x-16, oy-30, 32, 30);
      g.fillStyle='#ffb703'; g.fillRect(o.x-16, oy-30, 32, 6);
    });
    drawSparks(g, state.sparkle);
    drawStick(g, 150, state.figY, 1.05, '#2b6cb0', 1, state.poseCur,
      {expr: state.stumbleT>0?'hurt':(state.boosting?'shout':'idle'), accessory:'band', accessoryColor: state.boosting?'#ffd166':'#ff8c42'});
    if(state.boosting){
      g.fillStyle='rgba(255,209,102,0.5)';
      g.beginPath(); g.moveTo(150-40,state.figY); g.lineTo(150-70,state.figY-14); g.lineTo(150-70,state.figY+14); g.fill();
    }
    if(state.finishDist - state.dist < 260){
      const fx = 150 + (state.finishDist-state.dist);
      g.fillStyle='#e63946'; g.fillRect(fx-3,60,6,TRACK_BOT-60);
      g.font='bold 20px Segoe UI'; g.textAlign='center';
      g.fillText('🏁', fx, 50);
    }
    g.textAlign='left'; g.font='bold 16px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText('Race '+state.level+'/'+LEVELS, 16, 26);
    g.fillText('⚡ x'+state.boostCharges, 16, 48);
    g.textAlign='right';
    g.fillText('Place: '+currentPlace()+'/4', CW-16, 26);
    const pct = clamp(state.dist/state.finishDist,0,1);
    g.textAlign='center';
    g.fillText(Math.round(pct*100)+'%', CW/2, 26);
    g.fillStyle='rgba(0,0,0,0.15)'; g.fillRect(CW/2-100, 34, 200, 8);
    g.fillStyle='#06d6a0'; g.fillRect(CW/2-100, 34, 200*pct, 8);
  }
  return {
    title:'Stickman Racer',
    hint:'▲▼ switch lanes to dodge hurdles, tap ⚡ BOOST for a burst of speed! (Arrow keys / Space)',
    controlsHtml: `
      <div class="padBtns">
        <button class="ctlBtn" id="btnLaneUp">▲</button>
        <button class="ctlBtn" id="btnLaneDown">▼</button>
      </div>
      <div class="actionBtns" style="margin:0 auto;">
        <button class="ctlBtn wide" id="btnBoost" style="background:#ffd166;">⚡ BOOST</button>
      </div>`,
    bindControls(){
      bindTapBtn('btnLaneUp', ()=>{ changeLane(-1); });
      bindTapBtn('btnLaneDown', ()=>{ changeLane(1); });
      bindTapBtn('btnBoost', ()=>{ tryBoost(); });
    },
    create(){ totalTime=0; state=fresh(1); return this; },
    restart(){ totalTime=0; state=fresh(1); hideOverlay(); },
    update, draw,
  };
}
