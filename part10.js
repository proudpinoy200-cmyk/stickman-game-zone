/* =========================================================
   GAME — Stick Archery Royale
   A 10-archer free-for-all: drag to aim, release to fire.
   Player has 3 HP, every NPC has 1 HP. Last one standing wins.
   ========================================================= */
function createArcheryGame(){
  const GAME_ID = 'archery';
  const NPC_COUNT = 9;
  const GRAVITY = 145;          // gentle arc — predictable, not full artillery physics
  const ARROW_MIN_SPEED = 430;
  const ARROW_MAX_SPEED = 900;
  const MIN_DRAG = 14;          // ignore accidental taps/tiny nudges
  const MAX_DRAG = 220;         // drag distance that maps to full power
  const PLAYER_COOLDOWN = 1.0;  // seconds between player shots
  const ARENA_CX = 400, ARENA_RX = 330;

  const NPC_COLORS = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#38d9a9','#4dabf7','#748ffc','#e599f7','#f783ac'];
  const PLAYER_COLOR = '#2b6cb0';

  let state;

  function archerScale(t){ return 0.66 + t*0.42; } // t=0 far/back, t=1 near/front
  function archerY(t){ return GROUND_Y - (1-t)*88; }

  function idlePose(){ return {legF:100, legB:80, armF:-30, armB:-140, lean:-90, headBob:0}; }
  function hurtPose(){ return {legF:94, legB:86, armF:20, armB:-165, lean:-72, headBob:-2}; }
  function shootPose(){ return {legF:104, legB:78, armF:-8, armB:-172, lean:-88, headBob:0}; }

  function makeArcher(i){
    // spread 9 NPCs evenly around an ellipse, leaving the player's slot (bottom/front, angle 90deg) open
    const angle = deg(90 + (i+1)*(360/(NPC_COUNT+1)));
    const depth = Math.sin(angle);          // -1 (far) .. 1 (near)
    const t = clamp((depth+1)/2, 0, 1);
    const spread = 0.55 + 0.45*t;
    const x = clamp(ARENA_CX + Math.cos(angle)*ARENA_RX*spread, 40, 760);
    const y = archerY(t);
    const scale = archerScale(t);
    return {
      id: 'npc'+i, alive:true, x, y, scale, facing: (x<ARENA_CX?1:-1),
      color: NPC_COLORS[i%NPC_COLORS.length],
      cooldown: rand(1.5, 3.0),
      anim: {action:'idle', t:0, lock:0, cur: idlePose()},
      hitPulse: 0,
    };
  }

  function fresh(){
    const npcs = [];
    for(let i=0;i<NPC_COUNT;i++) npcs.push(makeArcher(i));
    return {
      player: {
        x: ARENA_CX, y: GROUND_Y, scale: 1.05, facing: 1,
        hp: 3, maxHp: 3, kills: 0,
        cooldown: 0, hurtT: 0, alive: true,
        anim: {action:'idle', t:0, lock:0, cur: idlePose()},
      },
      npcs,
      arrows: [],           // {x,y,vx,vy,owner,color,trail:[]}
      sparks: makeParticlePool(),
      dust: makeParticlePool(),
      aim: { active:false, sx:0, sy:0, cx:0, cy:0 },
      shakeT: 0,
      clock: 0,
      over: false, win: false,
      endTimer: -1,
    };
  }

  function bowPos(archer){
    return { x: archer.x, y: archer.y - 52*archer.scale };
  }

  function livingArchers(){
    const list = [];
    if(state.player.alive) list.push(state.player);
    state.npcs.forEach(n=>{ if(n.alive) list.push(n); });
    return list;
  }

  function nearestTarget(from){
    let best=null, bestD=Infinity;
    livingArchers().forEach(a=>{
      if(a===from) return;
      const d = dist(from.x, from.y, a.x, a.y);
      if(d<bestD){ bestD=d; best=a; }
    });
    return best;
  }

  function spawnArrow(owner, ownerObj, sx, sy, vx, vy, color){
    state.arrows.push({ x:sx, y:sy, vx, vy, owner, color, trail:[] });
  }

  function fireFrom(archer, targetX, targetY, speed, inaccuracy){
    const b = bowPos(archer);
    let ang = Math.atan2(targetY-b.y, targetX-b.x);
    ang += rand(-inaccuracy, inaccuracy);
    const vx = Math.cos(ang)*speed, vy = Math.sin(ang)*speed;
    const isPlayer = archer===state.player;
    spawnArrow(isPlayer?'player':archer.id, archer, b.x, b.y, vx, vy, isPlayer?'#ffd93d':archer.color);
    archer.anim.action='shoot'; archer.anim.t=0; archer.anim.lock=0.22;
    archer.facing = (vx>=0)?1:-1;
    SFX.whoosh();
  }

  function firePlayerArrow(){
    const dx = state.aim.cx-state.aim.sx, dy = state.aim.cy-state.aim.sy;
    const dragDist = Math.hypot(dx,dy);
    if(dragDist < MIN_DRAG) return;
    const p = state.player;
    if(!p.alive || p.cooldown>0 || state.over) return;
    const powerT = clamp((dragDist-MIN_DRAG)/(MAX_DRAG-MIN_DRAG), 0, 1);
    const speed = lerp(ARROW_MIN_SPEED, ARROW_MAX_SPEED, powerT);
    const ang = Math.atan2(dy,dx);
    const b = bowPos(p);
    const vx = Math.cos(ang)*speed, vy = Math.sin(ang)*speed;
    spawnArrow('player', p, b.x, b.y, vx, vy, '#ffd93d');
    p.anim.action='shoot'; p.anim.t=0; p.anim.lock=0.22;
    p.facing = (vx>=0)?1:-1;
    p.cooldown = PLAYER_COOLDOWN;
    SFX.whoosh();
  }

  function eliminateNpc(npc, byPlayer){
    npc.alive = false;
    spawnSpark(state.sparks, npc.x, npc.y-40*npc.scale, npc.color, 14);
    spawnDust(state.dust, npc.x, GROUND_Y-2, 8);
    SFX.hurt();
    if(byPlayer) state.player.kills++;
    checkEndConditions();
  }

  function hitPlayer(){
    const p = state.player;
    if(!p.alive) return;
    p.hp = clamp(p.hp-1, 0, p.maxHp);
    p.hurtT = 0.4;
    p.anim.action='hurt'; p.anim.t=0; p.anim.lock=0.3;
    state.shakeT = 0.22;
    spawnSpark(state.sparks, p.x, p.y-45*p.scale, '#ff6b6b', 12);
    SFX.hurt();
    if(p.hp<=0){
      p.alive = false;
      checkEndConditions();
    }
  }

  function checkEndConditions(){
    if(state.over) return;
    const npcsLeft = state.npcs.filter(n=>n.alive).length;
    if(!state.player.alive){
      state.over = true; state.win = false;
      SFX.gameover();
      state.endTimer = 0.9;
    } else if(npcsLeft===0){
      state.over = true; state.win = true;
      SFX.victory();
      state.endTimer = 0.9;
    }
    if(state.over) state.arrows = []; // freeze the arena the instant the round is decided
  }

  function finishRound(){
    if(state.win){
      recordRoundComplete();
      unlockAchievement('archery_champion');
      showGameOverOverlay(GAME_ID, state.player.kills, '🏆 Last One Standing!',
        `You outlasted all 9 rivals in the arena! Kills: ${state.player.kills}`, [
        {label:'Play Again', onClick:()=>{ state = fresh(); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    } else {
      recordRoundComplete();
      showGameOverOverlay(GAME_ID, state.player.kills, '💥 You Were Eliminated!',
        `You went down with ${state.player.kills} kill${state.player.kills===1?'':'s'}. Try again!`, [
        {label:'Retry', onClick:()=>{ state = fresh(); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    }
  }

  function poseFor(anim, breathe){
    switch(anim.action){
      case 'shoot': {
        const p = clamp(anim.t/0.22, 0, 1);
        const s = shootPose();
        return {legF:s.legF, legB:s.legB, armF:lerp(-8,-70,easeOutQuad(p)), armB:lerp(-172,-120,easeOutQuad(p)), lean:s.lean, headBob:0};
      }
      case 'hurt': {
        const h = hurtPose();
        return {legF:h.legF, legB:h.legB, armF:h.armF, armB:h.armB, lean:h.lean, headBob:h.headBob};
      }
      default: {
        const idle = idlePose();
        return {legF:idle.legF, legB:idle.legB, armF:idle.armF, armB:idle.armB, lean:idle.lean, headBob:breathe*0.4};
      }
    }
  }
  function exprFor(anim){
    if(anim.action==='hurt') return 'hurt';
    if(anim.action==='shoot') return 'shout';
    return 'idle';
  }
  function stepAnim(anim, dt, clock){
    anim.t += dt;
    if(anim.lock>0){ anim.lock -= dt; if(anim.lock<=0 && anim.action!=='idle') anim.action='idle'; }
    const breathe = Math.sin(clock*2.4)*1.6;
    const target = poseFor(anim, breathe);
    lerpPose(anim.cur, target, smoothT(anim.action==='idle'?12:24, dt));
  }

  function update(dt){
    window.__debug = {hp: state.player.hp, kills: state.player.kills, left: state.npcs.filter(n=>n.alive).length};
    state.clock += dt;
    if(state.shakeT>0) state.shakeT -= dt;
    if(state.player.hurtT>0) state.player.hurtT -= dt;
    if(state.player.cooldown>0) state.player.cooldown -= dt;
    updateParticles(state.sparks, dt, 260);
    updateParticles(state.dust, dt, 0);
    stepAnim(state.player.anim, dt, state.clock);
    state.npcs.forEach(n=>{ if(n.alive) stepAnim(n.anim, dt, state.clock); });

    if(state.over){
      if(state.endTimer>0){
        state.endTimer -= dt;
        if(state.endTimer<=0){ state.endTimer=-1; finishRound(); }
      }
      // let in-flight arrows and particles keep drifting to a stop, but no new shots
    } else {
      // NPC AI: independent random-ish cooldowns, aim at nearest living target with inaccuracy
      state.npcs.forEach(n=>{
        if(!n.alive) return;
        n.cooldown -= dt;
        if(n.cooldown<=0){
          const target = nearestTarget(n);
          if(target){
            fireFrom(n, target.x, target.y-40*target.scale, rand(480,620), deg(9));
          }
          n.cooldown = rand(1.5, 3.0);
        }
      });
    }

    // arrows: move, gravity droop, collide, cull
    // (capture a local reference — checkEndConditions() may swap in a fresh, empty
    // state.arrows array mid-loop once the round is decided, and we must keep
    // iterating/splicing the array we started with rather than the new one)
    const arrows = state.arrows;
    for(let i=arrows.length-1;i>=0;i--){
      const a = arrows[i];
      a.trail.push({x:a.x,y:a.y});
      if(a.trail.length>6) a.trail.shift();
      a.vy += GRAVITY*dt;
      a.x += a.vx*dt; a.y += a.vy*dt;
      let hit = false;
      // player hitbox
      if(state.player.alive && a.owner!=='player'){
        const hb = {x:state.player.x, y:state.player.y-42*state.player.scale};
        if(dist(a.x,a.y,hb.x,hb.y) < 26*state.player.scale){
          hitPlayer(); hit = true;
        }
      }
      if(!hit){
        for(const n of state.npcs){
          if(!n.alive || a.owner===n.id) continue;
          const hb = {x:n.x, y:n.y-42*n.scale};
          if(dist(a.x,a.y,hb.x,hb.y) < 26*n.scale){
            eliminateNpc(n, a.owner==='player');
            hit = true;
            break;
          }
        }
      }
      if(hit || a.x<-30 || a.x>CW+30 || a.y>CH+40 || a.y< -60){
        arrows.splice(i,1);
      }
      if(state.over) break; // round just ended — stop processing further in-flight arrows this frame
    }
  }

  function drawArcher(g, archer, isPlayer){
    const opts = { expr: exprFor(archer.anim), accessory:'band', accessoryColor: isPlayer ? '#ffd93d' : '#ffffff' };
    const flash = isPlayer && archer.hurtT>0 && Math.floor(archer.hurtT*20)%2===0;
    if(flash) g.globalAlpha = 0.55;
    const parts = drawStick(g, archer.x, archer.y, archer.scale, isPlayer?PLAYER_COLOR:archer.color, archer.facing, archer.anim.cur, opts);
    g.globalAlpha = 1;
    // bow — simple arc in the shooting hand
    const b = bowPos(archer);
    g.save();
    g.strokeStyle = isPlayer ? '#8a5a2b' : 'rgba(60,40,20,0.75)';
    g.lineWidth = 3*archer.scale;
    g.beginPath();
    g.arc(b.x, b.y, 22*archer.scale, deg(-70), deg(70));
    g.stroke();
    g.restore();
    return parts;
  }

  function drawArrow(g, a){
    const ang = Math.atan2(a.vy, a.vx);
    g.save();
    g.translate(a.x, a.y);
    g.rotate(ang);
    g.strokeStyle = a.color;
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(-16,0); g.lineTo(6,0); g.stroke();
    g.fillStyle = a.color;
    g.beginPath(); g.moveTo(10,0); g.lineTo(2,-3.5); g.lineTo(2,3.5); g.closePath(); g.fill();
    g.strokeStyle = a.color; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-16,0); g.lineTo(-22,-4); g.moveTo(-16,0); g.lineTo(-22,4); g.stroke();
    g.restore();
    // faint trail
    g.strokeStyle = a.color; g.globalAlpha = 0.28; g.lineWidth = 1.6;
    g.beginPath();
    a.trail.forEach((p,i)=>{ if(i===0) g.moveTo(p.x,p.y); else g.lineTo(p.x,p.y); });
    g.stroke();
    g.globalAlpha = 1;
  }

  function simulateTrajectory(bx, by, vx, vy){
    const pts = [];
    let x=bx, y=by, vx2=vx, vy2=vy;
    for(let i=0;i<16;i++){
      vy2 += GRAVITY*0.045;
      x += vx2*0.045; y += vy2*0.045;
      if(x<-20||x>CW+20||y>CH+20) break;
      pts.push({x,y});
    }
    return pts;
  }

  function draw(g){
    g.save();
    if(state.shakeT>0){ g.translate(rand(-5,5), rand(-5,5)); }
    drawGround('#bfe3ff', '#eafff2');

    // arena ring painted on the ground
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(ARENA_CX, GROUND_Y+10, ARENA_RX*0.62, 26, 0, 0, Math.PI*2);
    g.stroke();
    g.restore();

    // simple crowd banners
    for(let i=0;i<7;i++){
      const bx = 40 + i*115;
      g.fillStyle = ['#ff6b6b','#ffd166','#4dabf7','#69db7c','#f783ac','#748ffc','#ffa94d'][i%7];
      roundRect(bx, 14, 46, 20, 4); g.fill();
    }

    drawDust(g, state.dust);

    // draw archers back-to-front by y (further back drawn first)
    const drawList = state.npcs.filter(n=>n.alive).slice();
    drawList.push(state.player);
    drawList.sort((a,b)=>a.y-b.y);
    drawList.forEach(a=>{
      if(a===state.player) drawArcher(g, state.player, true);
      else drawArcher(g, a, false);
    });

    state.arrows.forEach(a=>drawArrow(g,a));
    drawSparks(g, state.sparks);

    // aim guide
    if(state.aim.active && state.player.alive && state.player.cooldown<=0){
      const dx = state.aim.cx-state.aim.sx, dy = state.aim.cy-state.aim.sy;
      const dragDist = Math.hypot(dx,dy);
      if(dragDist>=MIN_DRAG){
        const powerT = clamp((dragDist-MIN_DRAG)/(MAX_DRAG-MIN_DRAG), 0, 1);
        const speed = lerp(ARROW_MIN_SPEED, ARROW_MAX_SPEED, powerT);
        const ang = Math.atan2(dy,dx);
        const b = bowPos(state.player);
        const vx = Math.cos(ang)*speed, vy = Math.sin(ang)*speed;
        const pts = simulateTrajectory(b.x, b.y, vx, vy);
        g.fillStyle = 'rgba(28,43,58,0.55)';
        pts.forEach((p,i)=>{ if(i%2===0){ g.beginPath(); g.arc(p.x,p.y,3,0,Math.PI*2); g.fill(); } });
        g.strokeStyle = `rgba(255,217,61,${0.4+powerT*0.5})`;
        g.lineWidth = 3;
        g.setLineDash([2,6]);
        g.beginPath(); g.moveTo(b.x,b.y); g.lineTo(b.x+dx*0.9, b.y+dy*0.9); g.stroke();
        g.setLineDash([]);
      }
    }

    // HUD
    g.textAlign = 'left'; g.font = 'bold 16px Segoe UI'; g.fillStyle = '#1c2b3a';
    const left = state.npcs.filter(n=>n.alive).length + (state.player.alive?1:0);
    g.fillText('Archers Left: '+left+'/10', 24, 26);
    g.fillText('Kills: '+state.player.kills, 24, 46);

    // hearts
    for(let i=0;i<state.player.maxHp;i++){
      const hx = CW-30-i*28, hy = 22;
      g.fillStyle = i < state.player.hp ? '#ff6b6b' : 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.moveTo(hx, hy+6);
      g.bezierCurveTo(hx, hy, hx-10, hy, hx-10, hy+6);
      g.bezierCurveTo(hx-10, hy+12, hx, hy+16, hx, hy+20);
      g.bezierCurveTo(hx, hy+16, hx+10, hy+12, hx+10, hy+6);
      g.bezierCurveTo(hx+10, hy, hx, hy, hx, hy+6);
      g.fill();
    }

    if(state.player.cooldown>0 && !state.over){
      g.textAlign='center'; g.font='bold 13px Segoe UI'; g.fillStyle='rgba(28,43,58,0.7)';
      g.fillText('reloading…', CW/2, CH-14);
    }
    g.restore();
  }

  function onPointerDown(x,y){
    if(state.over || !state.player.alive) return;
    state.aim.active = true;
    state.aim.sx = x; state.aim.sy = y;
    state.aim.cx = x; state.aim.cy = y;
  }
  function onPointerMove(x,y){
    if(!state.aim.active) return;
    state.aim.cx = x; state.aim.cy = y;
  }
  function onPointerUp(x,y){
    if(!state.aim.active) return;
    state.aim.cx = x; state.aim.cy = y;
    firePlayerArrow();
    state.aim.active = false;
  }

  return {
    title: 'Stick Archery Royale',
    hint: 'Drag anywhere to aim — further pull-back = more power — release to fire!',
    controlsHtml: '',
    bindControls(){},
    create(){ state = fresh(); return this; },
    restart(){ state = fresh(); hideOverlay(); },
    update, draw, onPointerDown, onPointerMove, onPointerUp,
  };
}
