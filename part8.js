/* =========================================================
   GAME 11 — Stick Galaxy (Galaga-style neon space shooter)
   ========================================================= */
function createGalaxyGame(){
  let state;
  const LEVELS = 5;
  const PLAYER_SPEED = 320;
  const BULLET_SPEED = 520;
  const ENEMY_BULLET_SPEED = 260;
  const PLAYER_Y = CH - 50;
  const POWERUP_COLORS = {star:'#ffd166', spread:'#7CFFF3', rapid:'#ff9f45', shield:'#5b8def', bomb:'#ff5050', life:'#39ff88'};
  const POWERUP_ICONS = {star:'★', spread:'⋔', rapid:'⚡', shield:'🛡', bomb:'💣', life:'❤'};
  function easeInQuad(t){ return t*t; }

  function makeStarfield(){
    const stars = [];
    for(let i=0;i<70;i++) stars.push({x:rand(0,CW), y:rand(0,CH), r:rand(0.6,2.2), phase:rand(0,Math.PI*2), speed:rand(0.4,1.2)});
    return stars;
  }
  function fresh(level, carryScore){
    const rows = Math.min(3+level-1, 5);
    const cols = Math.min(6+level-1, 8);
    const spacingX = 64, spacingY = 46;
    const startX = CW/2 - (cols-1)*spacingX/2, startY = 58;
    const enemies = [];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const elite = r===0;
        const bx = startX + c*spacingX, by = startY + r*spacingY;
        enemies.push({
          row:r, col:c, baseX:bx, baseY:by, x:bx, y:by,
          elite, hp: elite?2:1, maxHp: elite?2:1,
          alive:true, diving:false, diveT:0, diveDur: rand(2.6,3.2),
          startX:bx, startY:by, diveTargetX:bx, diveTargetY:by,
          firedThisDive:false, hitFlash:0,
        });
      }
    }
    return {
      level, rows, cols, enemies, boss:null, bossPending:false,
      score: carryScore||0, lives:3,
      px: CW/2, py: PLAYER_Y, invulnT:0,
      fireT:0, fireRate:0.22,
      spreadT:0, rapidT:0, shieldOn:false, bombs:1,
      playerBullets:[], enemyBullets:[], powerups:[],
      diveTimer: rand(1.6,2.4),
      over:false, win:false,
      particles: makeParticlePool(), stars: makeStarfield(), t:0, clock:0, shakeT:0,
      poseCur: clonePose({legF:100,legB:100,armF:-40,armB:-40,lean:-90,headBob:0}),
    };
  }

  function hitEnemy(e){
    if(!e.alive) return;
    e.hp--; e.hitFlash = 0.15;
    spawnSpark(state.particles, e.x, e.y, e.elite?'#ff2fd0':'#39ff88', 8);
    if(e.hp<=0){
      e.alive = false; e.diving = false;
      state.score += e.elite?120:50;
      spawnSpark(state.particles, e.x, e.y, e.elite?'#ff2fd0':'#39ff88', 18);
      state.shakeT = 0.12;
      SFX.stomp();
      maybeDropPowerup(e.x, e.y);
    } else {
      SFX.hurt();
    }
  }
  function hitBoss(dmg){
    const b = state.boss;
    if(!b || !b.alive) return;
    b.hp -= dmg; b.hitFlash = 0.15;
    spawnSpark(state.particles, b.x, b.y, '#ffd166', 10);
    if(b.hp<=0){
      b.alive = false;
      state.score += 1000;
      spawnSpark(state.particles, b.x, b.y, '#ffd166', 34);
      state.shakeT = 0.3;
      SFX.victory();
      state.powerups.push({x:b.x, y:b.y, type:'life', taken:false, bob:0});
    } else {
      SFX.hurt();
    }
  }
  function maybeDropPowerup(x,y){
    if(Math.random()>0.15) return;
    const table = [['star',40],['spread',12],['rapid',12],['shield',12],['bomb',12],['life',12]];
    let r = Math.random()*100, acc=0, chosen='star';
    for(const [type,w] of table){ acc+=w; if(r<=acc){ chosen=type; break; } }
    state.powerups.push({x,y,type:chosen, taken:false, bob:Math.random()*10});
  }
  function applyPowerup(type){
    SFX.powerup();
    if(type==='star') state.score += 250;
    else if(type==='spread') state.spreadT = 10;
    else if(type==='rapid') state.rapidT = 10;
    else if(type==='shield') state.shieldOn = true;
    else if(type==='bomb') state.bombs = Math.min(3, state.bombs+1);
    else if(type==='life') state.lives = Math.min(5, state.lives+1);
  }
  function tryBomb(){
    if(state.over || state.bombs<=0) return;
    state.bombs--;
    SFX.bomb();
    state.enemyBullets = [];
    state.shakeT = 0.3;
    state.enemies.forEach(e=>{ if(e.alive){ hitEnemy(e); hitEnemy(e); } });
    if(state.boss && state.boss.alive) hitBoss(3);
    spawnSpark(state.particles, state.px, state.py-100, '#fff', 40);
  }
  function damagePlayer(){
    if(state.shieldOn){
      state.shieldOn = false;
      state.invulnT = 0.6;
      SFX.block();
      spawnSpark(state.particles, state.px, state.py, '#7CFFF3', 12);
      return;
    }
    state.lives--;
    state.invulnT = 1.2;
    state.shakeT = 0.25;
    SFX.hurt();
    spawnSpark(state.particles, state.px, state.py, '#ff5050', 14);
    if(state.lives<=0) gameOver();
  }
  function fireFromPlayer(){
    const baseY = state.py-24;
    if(state.spreadT>0){
      [-0.28,0,0.28].forEach(ang=>{
        state.playerBullets.push({x:state.px, y:baseY, vx:Math.sin(ang)*260, vy:-BULLET_SPEED, color:'#7CFFF3'});
      });
    } else {
      state.playerBullets.push({x:state.px, y:baseY, vx:0, vy:-BULLET_SPEED, color:'#7CFFF3'});
    }
    SFX.fire();
  }
  function fireFromEnemy(e){
    const dx = state.px-e.x, dy = state.py-e.y;
    const d = Math.max(1, Math.hypot(dx,dy));
    state.enemyBullets.push({x:e.x, y:e.y, vx:dx/d*ENEMY_BULLET_SPEED, vy:dy/d*ENEMY_BULLET_SPEED, color: e.elite?'#ff2fd0':'#ff5050'});
    SFX.fire();
  }
  function startRandomDive(){
    const candidates = state.enemies.filter(e=>e.alive && !e.diving);
    if(!candidates.length) return;
    const e = candidates[Math.floor(Math.random()*candidates.length)];
    e.diving = true; e.diveT = 0; e.firedThisDive = false;
    e.startX = e.x; e.startY = e.y;
    e.diveTargetX = clamp(state.px + rand(-50,50), 50, CW-50);
    e.diveTargetY = CH-110;
    SFX.whoosh();
  }
  function updateDive(e, dt){
    e.diveT += dt;
    const dur = e.diveDur, half = dur/2;
    if(e.diveT<=half){
      const t = easeOutQuad(e.diveT/half);
      e.x = lerp(e.startX, e.diveTargetX, t);
      e.y = lerp(e.startY, e.diveTargetY, t);
    } else {
      const t = easeInQuad((e.diveT-half)/half);
      e.x = lerp(e.diveTargetX, e.startX, t);
      e.y = lerp(e.diveTargetY, e.startY, t);
    }
    if(!e.firedThisDive && e.diveT>=half*0.85 && e.diveT<=half*1.15){
      e.firedThisDive = true;
      fireFromEnemy(e);
    }
    if(e.diveT>=dur){
      e.diving=false; e.x=e.baseX; e.y=e.baseY; e.diveT=0; e.firedThisDive=false;
    }
  }
  function makeBoss(level){
    return { x: CW/2, y: 110, baseX: CW/2, hp: 6+level*2, maxHp: 6+level*2, alive:true, hitFlash:0, t:0, fireTimer: rand(1.2,1.8) };
  }
  function updateBoss(b, dt){
    if(!b.alive) return;
    b.t += dt;
    if(b.hitFlash>0) b.hitFlash -= dt;
    b.x = b.baseX + Math.sin(b.t*0.9)*180;
    b.fireTimer -= dt;
    const rate = b.hp <= b.maxHp*0.4 ? 1.0 : 1.7;
    if(b.fireTimer<=0){
      [-0.5,-0.2,0,0.2,0.5].forEach(ang=>{
        state.enemyBullets.push({x:b.x, y:b.y+20, vx:Math.sin(ang)*220, vy:Math.cos(ang)*220, color:'#ff2fd0'});
      });
      SFX.fire();
      b.fireTimer = rate;
    }
  }
  function levelComplete(){
    state.over = true; state.win = true;
    SFX.victory();
    setTimeout(()=>{
      if(state.level>=LEVELS){
        showGameOverOverlay('galaxy', state.score, '🏆 Galaxy Saved!', `You defended the galaxy through all ${LEVELS} waves! Final score: ${state.score}`, [
          {label:'Play Again', onClick:()=>{ state=fresh(1,0); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      } else {
        showOverlay(`Wave ${state.level} Cleared!`, `Boss defeated! Score: ${state.score}`, [
          {label:'Next Wave ▶', onClick:()=>{ state=fresh(state.level+1, state.score); hideOverlay(); }},
        ]);
      }
    }, 400);
  }
  function gameOver(){
    state.over = true; state.win = false;
    SFX.gameover();
    setTimeout(()=>{
      showGameOverOverlay('galaxy', state.score, '💥 Ship Down!', `Final score: ${state.score}. The galaxy needs you again!`, [
        {label:'Retry Wave', onClick:()=>{ state=fresh(state.level,0); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    }, 300);
  }

  function update(dt){
    window.__debug = {score:state.score, level:state.level, lives:state.lives, enemiesAlive: state.enemies.filter(e=>e.alive).length, boss: state.boss?{hp:state.boss.hp,alive:state.boss.alive}:null};
    state.t += dt; state.clock += dt;
    if(state.shakeT>0) state.shakeT -= dt;
    updateParticles(state.particles, dt, 40);
    if(state.invulnT>0) state.invulnT -= dt;
    if(state.spreadT>0) state.spreadT -= dt;
    if(state.rapidT>0) state.rapidT -= dt;
    if(state.over) return;

    if(keys['left']) state.px -= PLAYER_SPEED*dt;
    if(keys['right']) state.px += PLAYER_SPEED*dt;
    state.px = clamp(state.px, 34, CW-34);
    if(keys['doFire']){ keys['doFire']=false; tryBomb(); }

    state.fireT -= dt;
    if(state.fireT<=0){
      fireFromPlayer();
      state.fireT = state.rapidT>0 ? state.fireRate*0.5 : state.fireRate;
    }

    const swayX = Math.sin(state.t*1.4)*26;
    state.enemies.forEach(e=>{
      if(!e.alive) return;
      if(e.hitFlash>0) e.hitFlash -= dt;
      if(!e.diving){
        e.x = e.baseX + swayX;
        e.y = e.baseY + Math.sin(state.t*1.4 + e.col*0.4)*4;
      } else {
        updateDive(e, dt);
      }
    });

    if(!state.boss && !state.bossPending){
      state.diveTimer -= dt;
      if(state.diveTimer<=0){
        startRandomDive();
        state.diveTimer = Math.max(0.9, rand(1.8,2.6) - state.level*0.12);
      }
    }
    if(state.boss) updateBoss(state.boss, dt);

    state.playerBullets.forEach(b=>{ b.y += b.vy*dt; b.x += (b.vx||0)*dt; });
    state.playerBullets = state.playerBullets.filter(b=> b.y>-20 && !b.dead);
    state.enemyBullets.forEach(b=>{ b.y += b.vy*dt; b.x += (b.vx||0)*dt; });
    state.enemyBullets = state.enemyBullets.filter(b=> b.y<CH+20 && b.y>-20 && !b.dead);

    state.powerups.forEach(p=> p.y += 120*dt);
    state.powerups = state.powerups.filter(p=> p.y<CH+20 && !p.taken);

    for(const b of state.playerBullets){
      if(b.dead) continue;
      if(!state.boss){
        for(const e of state.enemies){
          if(!e.alive) continue;
          if(Math.abs(b.x-e.x)<18 && Math.abs(b.y-e.y)<16){ b.dead=true; hitEnemy(e); break; }
        }
      } else if(state.boss.alive){
        const bo = state.boss;
        if(Math.abs(b.x-bo.x)<40 && Math.abs(b.y-bo.y)<30){ b.dead=true; hitBoss(1); }
      }
    }
    state.playerBullets = state.playerBullets.filter(b=>!b.dead);

    if(state.invulnT<=0){
      for(const b of state.enemyBullets){
        if(b.dead) continue;
        if(Math.abs(b.x-state.px)<20 && Math.abs(b.y-state.py)<20){ b.dead=true; damagePlayer(); break; }
      }
    }
    state.enemyBullets = state.enemyBullets.filter(b=>!b.dead);

    if(state.invulnT<=0){
      for(const e of state.enemies){
        if(e.alive && e.diving && Math.abs(e.x-state.px)<24 && Math.abs(e.y-state.py)<22){
          hitEnemy(e); damagePlayer(); break;
        }
      }
    }

    for(const p of state.powerups){
      if(!p.taken && Math.abs(p.x-state.px)<26 && Math.abs(p.y-state.py)<26){
        p.taken = true; applyPowerup(p.type);
      }
    }

    const aliveGrunts = state.enemies.some(e=>e.alive);
    if(!aliveGrunts && !state.boss && !state.bossPending && !state.over){
      state.bossPending = true;
      setTimeout(()=>{ if(!state.over){ state.boss = makeBoss(state.level); state.bossPending=false; } }, 900);
    }
    if(state.boss && !state.boss.alive && !state.over){
      levelComplete();
    }

    const lean = clamp((keys['left']?-1:keys['right']?1:0)*14, -14, 14);
    const target = {legF:96+lean*0.4, legB:96-lean*0.4, armF:-30+lean, armB:-30-lean, lean:-92, headBob:Math.sin(state.t*3)*1.5};
    lerpPose(state.poseCur, target, smoothT(14,dt));
  }

  function glowLine(g,x1,y1,x2,y2,color,width){
    g.save();
    g.shadowColor = color; g.shadowBlur = 10;
    g.strokeStyle = color; g.lineWidth = width; g.lineCap='round';
    g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
    g.restore();
  }
  function glowCircle(g,x,y,r,color,alpha){
    g.save();
    g.globalAlpha = alpha==null?1:alpha;
    g.shadowColor = color; g.shadowBlur = 14;
    g.fillStyle = color;
    g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
    g.restore();
  }
  function drawSpaceBg(g){
    const grad = g.createLinearGradient(0,0,0,CH);
    grad.addColorStop(0,'#0b0620'); grad.addColorStop(0.5,'#160b3a'); grad.addColorStop(1,'#1c0a2e');
    g.fillStyle = grad; g.fillRect(0,0,CW,CH);
    const n1x = CW*0.25 + Math.sin(state.t*0.15)*40, n1y=CH*0.3;
    const n2x = CW*0.75 + Math.cos(state.t*0.12)*40, n2y=CH*0.6;
    let ng = g.createRadialGradient(n1x,n1y,0,n1x,n1y,180);
    ng.addColorStop(0,'rgba(255,45,208,0.14)'); ng.addColorStop(1,'rgba(255,45,208,0)');
    g.fillStyle = ng; g.fillRect(0,0,CW,CH);
    ng = g.createRadialGradient(n2x,n2y,0,n2x,n2y,200);
    ng.addColorStop(0,'rgba(64,200,255,0.12)'); ng.addColorStop(1,'rgba(64,200,255,0)');
    g.fillStyle = ng; g.fillRect(0,0,CW,CH);
  }
  function drawEnemy(g,e){
    const color = e.elite ? '#ff2fd0' : '#39ff88';
    const flash = e.hitFlash>0;
    g.save();
    g.translate(e.x, e.y);
    g.shadowColor = color; g.shadowBlur = flash?22:12;
    g.fillStyle = flash ? '#fff' : color;
    if(e.elite){
      g.beginPath();
      for(let i=0;i<6;i++){
        const ang = Math.PI/3*i - Math.PI/2;
        const px = Math.cos(ang)*15, py = Math.sin(ang)*15;
        i===0?g.moveTo(px,py):g.lineTo(px,py);
      }
      g.closePath(); g.fill();
    } else {
      g.beginPath();
      g.moveTo(0,-13); g.lineTo(11,0); g.lineTo(0,13); g.lineTo(-11,0); g.closePath(); g.fill();
    }
    g.fillStyle = '#0b0620';
    g.beginPath(); g.arc(0,1,3.2,0,Math.PI*2); g.fill();
    g.restore();
  }
  function drawBoss(g,b){
    if(!b.alive) return;
    const flash = b.hitFlash>0;
    g.save();
    g.translate(b.x,b.y);
    g.shadowColor = '#ffd166'; g.shadowBlur = flash?30:18;
    g.fillStyle = flash?'#fff':'#ffd166';
    g.beginPath();
    for(let i=0;i<8;i++){
      const ang = Math.PI/4*i;
      const rr = i%2===0?38:24;
      const px=Math.cos(ang)*rr, py=Math.sin(ang)*rr;
      i===0?g.moveTo(px,py):g.lineTo(px,py);
    }
    g.closePath(); g.fill();
    g.fillStyle='#7a1d0a';
    g.beginPath(); g.arc(-10,0,5,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(10,0,5,0,Math.PI*2); g.fill();
    g.restore();
    g.textAlign='center'; g.font='bold 13px Segoe UI'; g.fillStyle='#fff';
    g.fillText('⭐ Star Reaper', b.x, b.y-56);
    healthBar(b.x-50, b.y-50, 100, 8, b.hp/b.maxHp, '#ff2fd0');
  }
  function drawPowerup(g,p){
    const bob = Math.sin(state.t*4 + p.bob)*3;
    glowCircle(g, p.x, p.y+bob, 13, POWERUP_COLORS[p.type]||'#fff', 0.9);
    g.fillStyle='#0b0620'; g.font='bold 13px Segoe UI'; g.textAlign='center';
    g.fillText(POWERUP_ICONS[p.type]||'?', p.x, p.y+bob+4);
  }
  function drawPlayerShip(g){
    const flame = 8+Math.sin(state.t*22)*3;
    glowCircle(g, state.px, state.py+22, flame, '#7CFFF3', 0.5);
    if(state.shieldOn){
      g.save();
      g.globalAlpha = 0.55+0.25*Math.sin(state.t*6);
      g.strokeStyle='#7CFFF3'; g.lineWidth=3; g.shadowColor='#7CFFF3'; g.shadowBlur=14;
      g.beginPath(); g.arc(state.px, state.py-6, 34, 0, Math.PI*2); g.stroke();
      g.restore();
    }
    g.save();
    g.shadowColor = '#7CFFF3'; g.shadowBlur = 10;
    drawStick(g, state.px, state.py, 0.95, '#eafcff', 1, state.poseCur, {expr:'shout', accessory:'band', accessoryColor:'#7CFFF3'});
    g.restore();
  }
  function drawHud(g){
    g.textAlign='left'; g.font='bold 16px Segoe UI'; g.fillStyle='#eafcff';
    g.fillText('Score: '+state.score, 16, 24);
    let hearts=''; for(let i=0;i<state.lives;i++) hearts+='❤️';
    g.fillText(hearts||'💀', 16, 46);
    g.textAlign='center';
    g.fillText('Wave '+state.level+'/'+LEVELS, CW/2, 24);
    g.textAlign='right';
    g.fillText('💣 x'+state.bombs, CW-16, 24);
    if(state.spreadT>0){ g.fillStyle='#7CFFF3'; g.fillText('Spread '+state.spreadT.toFixed(1)+'s', CW-16, 46); }
    else if(state.rapidT>0){ g.fillStyle='#ff9f45'; g.fillText('Rapid '+state.rapidT.toFixed(1)+'s', CW-16, 46); }
  }
  function draw(g){
    drawSpaceBg(g);
    state.stars.forEach(s=>{
      const tw = 0.5+0.5*Math.sin(state.t*s.speed*2+s.phase);
      g.globalAlpha = 0.4+tw*0.6;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI*2); g.fill();
    });
    g.globalAlpha = 1;

    if(state.shakeT>0) g.save(), g.translate(rand(-5,5), rand(-5,5));

    state.enemies.forEach(e=>{ if(e.alive) drawEnemy(g,e); });
    if(state.boss) drawBoss(g, state.boss);
    state.playerBullets.forEach(b=> glowLine(g, b.x, b.y, b.x, b.y+16, b.color, 4));
    state.enemyBullets.forEach(b=> glowLine(g, b.x, b.y, b.x, b.y-14, b.color, 4));
    state.powerups.forEach(p=> drawPowerup(g,p));
    drawSparks(g, state.particles);

    const flashOn = state.invulnT>0 && Math.floor(state.invulnT*14)%2===0;
    if(!flashOn) drawPlayerShip(g);

    if(state.shakeT>0) g.restore();

    drawHud(g);
  }

  return {
    title:'Stick Galaxy',
    hint:'◀▶ to strafe (auto-fire is always on) — grab glowing power-ups, tap 💣 BOMB to clear the screen!',
    controlsHtml: `
      <div class="padBtns">
        <button class="ctlBtn" id="btnGLeft">◀</button>
        <button class="ctlBtn" id="btnGRight">▶</button>
      </div>
      <div class="actionBtns" style="margin:0 auto;">
        <button class="ctlBtn wide" id="btnGBomb" style="background:#ff5050;color:#fff;">💣 BOMB</button>
      </div>`,
    bindControls(){
      bindHoldBtn('btnGLeft','left');
      bindHoldBtn('btnGRight','right');
      bindTapBtn('btnGBomb', ()=>{ tryBomb(); });
    },
    create(){ state = fresh(1,0); return this; },
    restart(){ state = fresh(state.level,0); hideOverlay(); },
    update, draw,
  };
}
