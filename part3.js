function createHoopsGame(){
  let state;
  const IDLE_POSE = {legF:100,legB:80,armF:-70,armB:-110,lean:-90,headBob:0};
  const AIM_POSE  = {legF:105,legB:75,armF:-40,armB:-140,lean:-88,headBob:0};
  const RELEASE_POSE = {legF:96,legB:84,armF:-175,armB:-95,lean:-95,headBob:0};
  function newHoop(){
    return { x: rand(520,720), y: rand(120,170) };
  }
  function fresh(){
    return {
      ballX:195, ballY:GROUND_Y-70, vx:0, vy:0, inAir:false,
      hoop:newHoop(), score:0, time:45, made:0, shots:0, dragging:false,
      dragStart:null, over:false, swish:0, releaseT:0,
      poseCur: clonePose(IDLE_POSE), clock:0,
      confetti: makeParticlePool(), dust: makeParticlePool(),
    };
  }
  function resetBall(){
    state.ballX=195; state.ballY=GROUND_Y-70; state.vx=0; state.vy=0; state.inAir=false;
  }
  function update(dt){
    window.__debug = {score: state.score, made: state.made, time: Math.round(state.time)};
    state.clock += dt;
    if(state.releaseT>0) state.releaseT -= dt;
    updateParticles(state.confetti, dt, 240);
    updateParticles(state.dust, dt, 0);
    // smooth pose blending: aiming pulls arm back, releasing snaps into a follow-through swing
    let target = IDLE_POSE;
    if(state.dragging) target = AIM_POSE;
    else if(state.releaseT>0.15) target = RELEASE_POSE;
    const breathe = Math.sin(state.clock*2)*1.4;
    const blended = clonePose(target);
    blended.headBob = breathe*0.3;
    lerpPose(state.poseCur, blended, smoothT(state.dragging?20:12, dt));

    if(state.over) return;
    state.time -= dt;
    if(state.swish>0) state.swish-=dt;
    if(state.time<=0){ endGame(); return; }
    if(state.inAir){
      state.vy += 650*dt;
      state.ballX += state.vx*dt;
      state.ballY += state.vy*dt;
      // hoop check
      const hx=state.hoop.x, hy=state.hoop.y;
      if(!state.scoredThisShot && Math.abs(state.ballX-hx)<24 && Math.abs(state.ballY-hy)<20 && state.vy>0){
        state.score += 2; state.made++; state.scoredThisShot=true; state.swish=0.6;
        SFX.swish();
        spawnSpark(state.confetti, hx, hy, '#ffd166', 12);
        state.hoop = newHoop();
      }
      if(state.ballY>CH+40 || state.ballX<-40 || state.ballX>CW+40){
        resetBall();
      }
      if(state.ballY>GROUND_Y-20 && state.vy>0){
        if(!state.scoredThisShot) SFX.bounce();
        spawnDust(state.dust, state.ballX, GROUND_Y-16, 4);
        resetBall();
      }
    }
  }
  function endGame(){
    state.over = true;
    let rank = 'Bronze 🥉';
    if(state.score>=30){ rank='Gold 🥇'; SFX.victory(); }
    else if(state.score>=16){ rank='Silver 🥈'; SFX.levelup(); }
    else { SFX.gameover(); }
    setTimeout(()=>{
      showGameOverOverlay('hoops', state.score, "Time's Up!", `Final Score: ${state.score} pts (${state.made} baskets) — ${rank}`, [
        {label:'Play Again', onClick:()=>{ state=fresh(); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    },150);
  }
  function onPointerDown(x,y){
    if(state.over || state.inAir) return;
    if(dist(x,y,state.ballX,state.ballY)<40){
      state.dragging = true; state.dragStart={x,y};
      SFX.unlock();
    }
  }
  function onPointerUp(x,y){
    if(!state.dragging) return;
    state.dragging=false;
    const dx = state.dragStart.x-x, dy = state.dragStart.y-y;
    const power = clamp(Math.hypot(dx,dy), 0, 420);
    if(power<20) return;
    const ang = Math.atan2(dy,dx);
    state.vx = Math.cos(ang)*power*2.2;
    state.vy = Math.sin(ang)*power*2.2;
    state.inAir = true; state.scoredThisShot=false; state.shots++;
    state.releaseT = 0.32;
    SFX.whoosh();
  }
  function draw(g){
    drawGround('#87ceeb','#ffe9b3');
    // backboard/pole
    const hx=state.hoop.x, hy=state.hoop.y;
    g.strokeStyle='#8d5524'; g.lineWidth=8;
    g.beginPath(); g.moveTo(hx+40,GROUND_Y); g.lineTo(hx+40,hy-30); g.stroke();
    g.fillStyle='#fff'; g.fillRect(hx+30,hy-55,10,45);
    g.strokeStyle='#e63946'; g.lineWidth=4;
    g.beginPath(); g.ellipse(hx,hy,20,7,0,0,Math.PI*2); g.stroke();
    // net
    g.strokeStyle='rgba(255,255,255,0.8)'; g.lineWidth=1.5;
    for(let i=-2;i<=2;i++){
      g.beginPath(); g.moveTo(hx+i*7,hy); g.lineTo(hx+i*4,hy+18); g.stroke();
    }
    drawDust(g, state.dust);
    // player (smoothly-blended pose: idle → aim → release follow-through)
    drawStick(g, 150, GROUND_Y, 1.05, '#9b5de5', 1, state.poseCur, {expr: state.dragging?'shout':'idle', accessory:'band', accessoryColor:'#ff8c42'});
    // ball
    g.fillStyle='#ff8c42';
    g.beginPath(); g.arc(state.ballX,state.ballY,13,0,Math.PI*2); g.fill();
    g.strokeStyle='#000'; g.lineWidth=1.5;
    g.beginPath(); g.moveTo(state.ballX-13,state.ballY); g.lineTo(state.ballX+13,state.ballY); g.stroke();
    g.beginPath(); g.moveTo(state.ballX,state.ballY-13); g.lineTo(state.ballX,state.ballY+13); g.stroke();
    // aim line
    if(state.dragging){
      g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=3; g.setLineDash([6,6]);
      g.beginPath(); g.moveTo(state.ballX,state.ballY);
      g.lineTo(state.ballX+(state.ballX-pointer.x), state.ballY+(state.ballY-pointer.y));
      g.stroke(); g.setLineDash([]);
    }
    drawSparks(g, state.confetti);
    if(state.swish>0){
      g.fillStyle='#06d6a0'; g.font='bold 26px Segoe UI'; g.textAlign='center';
      g.fillText('SWISH! +2', hx, hy-30);
    }
    // HUD
    g.textAlign='left'; g.font='bold 18px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText('Score: '+state.score, 20, 28);
    g.fillText('Baskets: '+state.made, 20, 50);
    g.textAlign='right';
    g.fillText('Time: '+Math.ceil(state.time)+'s', CW-20, 28);
  }
  return {
    title:'Hoop Shootout', hint:'Drag back from the ball and release to shoot — like a slingshot!',
    controlsHtml:'',
    bindControls(){},
    create(){ state=fresh(); return this; },
    restart(){ state=fresh(); hideOverlay(); },
    update, draw, onPointerDown, onPointerUp,
  };
}

/* =========================================================
   GAME 5 — Ninja Fruit Slice
   ========================================================= */
function createNinjaGame(){
  let state;
  const FRUIT_COLORS = [
    {c:'#ff6b6b', name:'apple'}, {c:'#ffb703', name:'orange'},
    {c:'#06d6a0', name:'melon'}, {c:'#9b5de5', name:'grape'}
  ];
  const IDLE_POSE = {legF:95,legB:85,armF:-60,armB:-120,lean:-90,headBob:0};
  function fresh(){
    return {
      items:[], spawnTimer:0.9, score:0, lives:3, combo:0, comboT:0, over:false, t:0, popups:[],
      reactT:0, reactDir:1, poseCur: clonePose(IDLE_POSE), bits: makeParticlePool(),
    };
  }
  function spawn(){
    const isBomb = Math.random()<0.15;
    const x = rand(100,700);
    const vy = rand(-680,-560);
    const vx = rand(-70,70);
    state.items.push({
      x, y:CH+20, vx, vy, isBomb, r: isBomb?22:24,
      sliced:false, rot:0, vr: rand(-3,3),
      color: isBomb?'#333':FRUIT_COLORS[Math.floor(Math.random()*FRUIT_COLORS.length)].c,
    });
  }
  function update(dt){
    window.__debug = {score: state.score, lives: state.lives};
    state.t += dt;
    if(state.reactT>0) state.reactT -= dt;
    updateParticles(state.bits, dt, 260);
    // idle breathing + quick reactive swipe pose when slicing, all eased for a graceful feel
    const breathe = Math.sin(state.t*2)*1.8;
    let target = clonePose(IDLE_POSE);
    target.headBob = breathe*0.35;
    if(state.reactT>0){
      const p = easeOutBack(1-clamp(state.reactT/0.22,0,1));
      target.armF = -60 + state.reactDir*140*p;
      target.armB = -120 - state.reactDir*40*p;
      target.lean = -90 + state.reactDir*6*p;
    }
    lerpPose(state.poseCur, target, smoothT(state.reactT>0?26:12, dt));
    if(state.over) return;
    state.spawnTimer -= dt;
    const rate = Math.max(0.45, 0.95 - state.t*0.01);
    if(state.spawnTimer<=0){ spawn(); if(Math.random()<0.3) spawn(); state.spawnTimer = rate; }
    if(state.comboT>0){ state.comboT-=dt; } else { state.combo=0; }

    state.items.forEach(it=>{
      it.vy += 900*dt; it.x+=it.vx*dt; it.y+=it.vy*dt; it.rot+=it.vr*dt;
    });
    state.items = state.items.filter(it=> it.y < CH+60);

    // check slicing via pointer trail
    if(pointer.down && pointer.trail.length>=2){
      const a = pointer.trail[pointer.trail.length-2];
      const b = pointer.trail[pointer.trail.length-1];
      state.items.forEach(it=>{
        if(it.sliced) return;
        const d = pointDistToSeg(it.x,it.y,a.x,a.y,b.x,b.y);
        if(d < it.r+8){
          it.sliced = true;
          state.reactT = 0.22; state.reactDir = (b.x>=a.x) ? 1 : -1;
          if(it.isBomb){
            state.lives--; state.combo=0;
            state.popups.push({x:it.x,y:it.y,text:'💥 -1 life',color:'#ff6b6b',life:1});
            spawnSpark(state.bits, it.x, it.y, '#ff8c42', 16);
            SFX.bomb();
            if(state.lives<=0){ endGame(); }
          } else {
            state.combo++; state.comboT=0.9;
            const pts = 1 + Math.max(0,state.combo-1);
            state.score += pts;
            state.popups.push({x:it.x,y:it.y,text:'+'+pts+(state.combo>1?' x'+state.combo:''),color:'#06d6a0',life:1});
            spawnSpark(state.bits, it.x, it.y, it.color, 10);
            SFX.slice();
          }
        }
      });
      state.items = state.items.filter(it=>!it.sliced);
    }
    state.popups.forEach(p=>{ p.y-=30*dt; p.life-=dt; });
    state.popups = state.popups.filter(p=>p.life>0);
  }
  function pointDistToSeg(px,py,x1,y1,x2,y2){
    const dx=x2-x1, dy=y2-y1;
    const len2 = dx*dx+dy*dy;
    let t = len2? ((px-x1)*dx+(py-y1)*dy)/len2 : 0;
    t = clamp(t,0,1);
    const cx = x1+t*dx, cy=y1+t*dy;
    return dist(px,py,cx,cy);
  }
  function endGame(){
    state.over = true;
    SFX.gameover();
    setTimeout(()=>{
      showGameOverOverlay('ninja', state.score, 'Game Over!', `Final Score: ${state.score} — nice slicing, ninja!`, [
        {label:'Play Again', onClick:()=>{ state=fresh(); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    },150);
  }
  function draw(g){
    drawGround('#2b3a55','#1c2b3a');
    // stars bg
    g.fillStyle='rgba(255,255,255,0.6)';
    for(let i=0;i<30;i++){
      const x=(i*97)%CW, y=(i*53)%GROUND_Y;
      g.fillRect(x,y,2,2);
    }
    state.items.forEach(it=>{
      g.save();
      g.translate(it.x,it.y); g.rotate(it.rot);
      if(it.isBomb){
        g.fillStyle='#222'; g.beginPath(); g.arc(0,0,it.r,0,Math.PI*2); g.fill();
        g.strokeStyle='#ff8c42'; g.lineWidth=3;
        g.beginPath(); g.moveTo(0,-it.r); g.lineTo(6,-it.r-10); g.stroke();
        g.fillStyle='#ffd166'; g.beginPath(); g.arc(6,-it.r-12,3,0,Math.PI*2); g.fill();
      } else {
        g.fillStyle = it.color;
        g.beginPath(); g.arc(0,0,it.r,0,Math.PI*2); g.fill();
        g.fillStyle='rgba(255,255,255,0.5)';
        g.beginPath(); g.arc(-it.r*0.3,-it.r*0.3,it.r*0.3,0,Math.PI*2); g.fill();
      }
      g.restore();
    });
    drawSparks(g, state.bits);
    // slice trail
    if(pointer.down && pointer.trail.length>1){
      g.strokeStyle='rgba(255,255,255,0.85)'; g.lineWidth=4; g.lineCap='round';
      g.beginPath();
      pointer.trail.forEach((p,i)=>{ i===0?g.moveTo(p.x,p.y):g.lineTo(p.x,p.y); });
      g.stroke();
    }
    // ninja stickman — idle bob + quick reactive swipe when slicing
    drawStick(g, 400, GROUND_Y+2, 0.9, '#06d6a0', 1, state.poseCur, {expr: state.reactT>0?'shout':'idle', accessory:'mask', accessoryColor:'#16202c'});

    state.popups.forEach(p=>{
      g.globalAlpha=clamp(p.life,0,1);
      g.fillStyle=p.color; g.font='bold 20px Segoe UI'; g.textAlign='center';
      g.fillText(p.text,p.x,p.y);
    });
    g.globalAlpha=1;

    g.textAlign='left'; g.font='bold 18px Segoe UI'; g.fillStyle='#fff';
    g.fillText('Score: '+state.score, 20, 28);
    g.textAlign='right';
    let hearts=''; for(let i=0;i<state.lives;i++) hearts+='❤️';
    g.fillText(hearts||'💔', CW-20, 28);
  }
  return {
    title:'Ninja Fruit Slice', hint:'Swipe across fruit to slice it — avoid the bombs! 💣',
    controlsHtml:'',
    bindControls(){},
    create(){ state=fresh(); return this; },
    restart(){ state=fresh(); hideOverlay(); },
    update, draw,
  };
}

/* =========================================================
   PROGRESSION SYSTEM (localStorage)
   ========================================================= */
