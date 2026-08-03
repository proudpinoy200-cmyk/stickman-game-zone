function createPlatformerGame(){
  let state;
  const GRAVITY = 1400;
  const MOVE_SPEED = 260;
  const JUMP_V = -520;
  const PLAT_W = 80, PLAT_H = 12;
  function fresh(){
    return {
      px: 60, py: GROUND_Y, vy: 0, onGround: true,
      facing:1, coins:[], enemies:[], platforms:[],
      coinCount:0, maxCoins:0, dist:0, t:0,
      camera:0, worldW: 2400, over:false, win:false,
      dead:false, dust: makeParticlePool(), sparkle: makeParticlePool(),
      level:1, poseCur: clonePose({legF:100,legB:80,armF:-60,armB:-130,lean:-90,headBob:0}),
      ammo:0, fireballs:[], fireCooldown:0, firePickups:[],
      enemyFireballs:[],
    };
  }
  function buildLevel(lvl){
    const s = fresh();
    s.level = lvl;
    const diff = 1 + (lvl-1)*0.25;
    s.worldW = 1600 + lvl*300;
    const coins = [];
    const enemies = [];
    const platforms = [];
    // ground gaps — width must stay within the player's actual max jump distance
    // (airTime = 2*|JUMP_V|/GRAVITY ≈ 0.74s, times MOVE_SPEED ≈ 193 world units), or the
    // pit is literally impossible to clear no matter how well the player times the jump.
    // The old formula (segLen*(0.5..1.0) = 150..300, and able to chain across consecutive
    // segments) regularly produced gaps far wider than that — this caps a single gap to a
    // safely-jumpable range and forbids two gaps back-to-back so they can never compound.
    const MAX_JUMP_DIST = 2*520/1400*260; // ≈193 world units
    let gx = 0;
    const segLen = 300;
    let prevWasGap = false;
    // Loop on gx (not a fixed iteration count) until ground actually reaches the
    // end of the level. The old version ran a FIXED number of iterations, one per
    // segLen-sized "slot" — but a gap iteration only advances gx by ~90-150, not
    // the full 300, so the loop routinely finished with gx short of worldW. That
    // left an untested, unbounded pit between the last placed platform and the
    // flag that was never checked against MAX_JUMP_DIST like every other gap —
    // exactly the "impossible jump right by the flag" bug. Refusing to start a
    // new gap once we're within 1.5 segments of the end, and always extending the
    // final platform a little past worldW, guarantees the flag is always standing
    // on solid, reachable ground.
    while(gx < s.worldW){
      const remaining = s.worldW - gx;
      const nearEnd = remaining < segLen*1.5;
      // gx>0 guards the very first segment — the player spawns at px:60, so the
      // start of the level must always be solid ground too, same as the original
      // "i>0" guard that this loop replaced.
      if(gx>0 && !nearEnd && !prevWasGap && Math.random()<0.25+diff*0.06){
        // gap — narrow enough to always be jumpable, with a healthy safety margin
        gx += rand(90, MAX_JUMP_DIST*0.78);
        prevWasGap = true;
        continue;
      }
      prevWasGap = false;
      // solid ground segment — near the end, stretch it a bit past worldW so the
      // flag never sits right at the crumbling edge of a platform
      const w = nearEnd ? remaining + 60 : segLen;
      platforms.push({x:gx, y:GROUND_Y, w, h:CH-GROUND_Y, type:'ground'});
      gx += segLen;
    }
    // floating platforms — laid out left-to-right with a minimum horizontal gap so they
    // never overlap each other, and kept well above standing-character height so they
    // don't visually intersect enemies/the player standing on the ground below. The old
    // version placed each platform fully independently (x AND y both random with no
    // relationship to its neighbors), which could stack two platforms on top of each
    // other in a broken-looking zigzag, or drop one right at head height over a ground
    // enemy — exactly the "doesn't make sense" layout reported from a screenshot.
    const floatCount = 4 + Math.floor(diff*3);
    const minGapX = 130;
    let lastFloatX = 180;
    for(let i=0;i<floatCount;i++){
      const x = lastFloatX + rand(minGapX, minGapX+100);
      if(x > s.worldW-160) break;
      const y = rand(GROUND_Y-150, GROUND_Y-75);
      const w = PLAT_W + rand(0,40);
      platforms.push({x, y, w, h:PLAT_H, type:'float'});
      lastFloatX = x + w;
    }
    // coins
    for(let i=0;i<6+Math.floor(diff*4);i++){
      coins.push({x:rand(150, s.worldW-50), y:rand(GROUND_Y-140, GROUND_Y-20), taken:false});
    }
    // enemies
    for(let i=0;i<1+Math.floor(diff*1.5);i++){
      enemies.push({x:rand(300, s.worldW-80), y:GROUND_Y-24, vx:rand(-60,-40)*Math.sign(Math.random()-0.5), alive:true, range:40});
    }
    // fire power-ups — a ranged option alongside the stomp, handy for enemies that are
    // awkward to jump on safely (e.g. one sitting right in a landing spot near a gap)
    const firePickups = [];
    for(let i=0;i<1+Math.floor(diff*0.5);i++){
      firePickups.push({x:rand(250, s.worldW-100), y:rand(GROUND_Y-90, GROUND_Y-20), taken:false});
    }
    // boss battle — every 2nd level ends with Epal, a small dragon/snake guarding the
    // flag. Epal MUST be defeated (3 hits, via stomp and/or fireballs — either works or
    // both mixed) before the level can be completed: an invisible wall just in front of
    // Epal's patrol zone (see the gate clamp on state.px in update()) blocks the player
    // from walking or jumping past — including over the platform above — until Epal's
    // hp hits 0. The elevated platform stays as a tactical perch for the fight itself
    // (jump up to dodge a pass, or drop back down to stomp) rather than as a bypass.
    const isBossLevel = lvl % 2 === 0;
    let boss = null;
    if(isBossLevel){
      const bossX = s.worldW - 220;
      const range = 90;
      boss = {
        x: bossX, baseX: bossX, y: GROUND_Y-30, range, vx: -55, hp: 3, maxHp: 3, alive: true, hitFlash: 0, t: 0,
        spitTimer: rand(1.5, 2.5), // delay before Epal's first fireball, so the player has time to get oriented
      };
      platforms.push({x: bossX-150, y: GROUND_Y-80, w: 300, h:PLAT_H, type:'float'});
      // guaranteed starting ammo — the boss fight is now mandatory (no more outrun/
      // bypass), so ammo can't be left to chance at all: relying on the player actually
      // colliding with a ground pickup turned out to be unreliable in practice (a player
      // moving fast/jumping a lot can skip right over a low pickup's narrow collision
      // window), so instead the level simply starts Epal-ready — 4 ammo, one more than
      // the 3 hits needed, so the fight is always winnable by fire alone even with zero
      // stomps landed. A bonus pickup near the gate (below) can top this back up if it's
      // spent early on regular enemies.
      s.ammo = 4;
      firePickups.push({x: bossX-range-60, y: GROUND_Y-40, taken:false});
    }
    return {...s, coins, enemies, platforms, firePickups, boss, maxCoins:coins.length};
  }
  function update(dt){
    window.__debug = {
      coins:state.coinCount, dist:Math.round(state.dist), over:state.over,
      ammo:state.ammo, fireballs:state.fireballs.length,
      enemiesAlive:state.enemies.filter(e=>e.alive).length,
      firePickupsLeft:state.firePickups.filter(p=>!p.taken).length,
      boss: state.boss ? {hp:state.boss.hp, alive:state.boss.alive, x:Math.round(state.boss.x)} : null,
      onGround: state.onGround,
      enemyFireballs: state.enemyFireballs.length,
    };
    state.t += dt;
    updateParticles(state.dust, dt, 0);
    updateParticles(state.sparkle, dt, 200);
    if(state.over) return;
    // input
    let moving = false;
    if(keys['left']){ state.px -= MOVE_SPEED*dt; state.facing=-1; moving=true; }
    if(keys['right']){ state.px += MOVE_SPEED*dt; state.facing=1; moving=true; }
    // jump
    if(keys['jump'] && state.onGround){
      state.vy = JUMP_V; state.onGround = false;
      keys['jump'] = false;
      SFX.jump();
      spawnDust(state.dust, state.px, GROUND_Y, 5);
    }
    // fire power-up — tap-to-fire, consumes one ammo, short cooldown so it can't be spammed
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    if(keys['doFire']){
      keys['doFire'] = false;
      if(state.ammo > 0 && state.fireCooldown <= 0){
        state.ammo--;
        state.fireCooldown = 0.35;
        state.fireballs.push({x: state.px + state.facing*18, y: state.py-14, vx: 420*state.facing, alive:true});
        SFX.fire();
      }
    }
    // gravity
    state.vy += GRAVITY*dt;
    state.px += 0; // no horizontal velocity from gravity
    const pyPrev = state.py;
    state.py += state.vy*dt;
    // platforms collision
    state.onGround = false;
    for(const p of state.platforms){
      if(state.px+14 > p.x && state.px-14 < p.x+p.w){
        if(state.vy > 0 && state.py+26 > p.y && state.py+26 < p.y+p.h+16){
          state.py = p.y - 26;
          state.vy = 0;
          state.onGround = true;
        }
      }
    }
    // death zone
    if(state.py > CH+30){ state.dead = true; gameOver(); return; }
    // world bounds
    state.px = clamp(state.px, 10, state.worldW-10);
    // boss gate — an invisible wall just before Epal's patrol zone. While Epal is alive
    // the player physically cannot walk or jump past this x, on the ground OR on the
    // platform above (px is clamped regardless of py), so the only way forward is to
    // fight. Fireballs are NOT clamped — they're spawned from the player's position but
    // fly on freely — so ranged attacks still reach Epal even while boxed in at the gate.
    // The gate sits only 10 units before Epal's own leftmost patrol point, so Epal swings
    // within stomp range of the gate every cycle too.
    if(state.boss && state.boss.alive){
      const gateX = state.boss.baseX - state.boss.range - 10;
      if(state.px > gateX) state.px = gateX;
    }
    // camera follow
    state.camera = clamp(state.px - 200, 0, state.worldW - CW);
    state.dist = state.px;
    // coins (world space)
    for(const c of state.coins){
      if(!c.taken && Math.abs(state.px-c.x)<20 && Math.abs(state.py-c.y)<20){
        c.taken = true; state.coinCount++;
        SFX.coin();
        spawnSpark(state.sparkle, c.x, c.y, '#ffd166', 7);
      }
    }
    // fire power-up pickups
    for(const p of state.firePickups){
      if(!p.taken && Math.abs(state.px-p.x)<20 && Math.abs(state.py-p.y)<20){
        p.taken = true; state.ammo = Math.min(state.ammo+4, 8);
        SFX.powerup();
        spawnSpark(state.sparkle, p.x, p.y, '#ff6b35', 9);
      }
    }
    // enemies
    for(const e of state.enemies){
      if(!e.alive) continue;
      e.x += e.vx*dt;
      if(e.x < e.range || e.x > state.worldW-e.range) e.vx *= -1;
      // collision — use a generous overlap box to detect "something happened",
      // then decide stomp vs. hurt by whether the player was clearly above the
      // enemy's head on the PREVIOUS frame (pyPrev), not just the exact y this
      // frame. At high fall speed the player can drop several pixels per frame,
      // so a narrow "must currently be in this exact band" check can jump right
      // over the stomp window and register as an unfair hit even when the
      // player was obviously falling onto the enemy from above.
      const overlapX = Math.abs(state.px-e.x) < 20;
      const overlapY = state.py+26 > e.y-14 && state.py < e.y+20;
      if(overlapX && overlapY){
        if(state.vy > 0 && pyPrev+18 <= e.y-4){
          // stomp
          e.alive = false;
          state.vy = -300;
          SFX.stomp();
          spawnSpark(state.sparkle, e.x, e.y, '#ffd166', 10);
        } else {
          state.dead = true;
          SFX.hurt();
          gameOver();
          return;
        }
      }
    }
    // boss battle — Epal appears at the end of every 2nd level, guarding the flag, and
    // must be defeated to proceed (see the gate clamp above). Touching Epal deals a hit
    // if stomped from above (bosses have HP, so it takes a few hits rather than an
    // instant kill like a regular enemy), or costs the player a life on a side hit, same
    // danger rule as regular enemies.
    if(state.boss){
      const b = state.boss;
      if(b.hitFlash > 0) b.hitFlash -= dt;
      if(b.alive){
        b.t += dt;
        b.x += b.vx*dt;
        if(b.x < b.baseX-b.range || b.x > b.baseX+b.range) b.vx *= -1;
        // Epal spits a fireball at the player every couple seconds once they're close
        // enough to be actually fighting it — a straight shot along Epal's height that
        // must be dodged (jump over it, or just back off out of range), giving the
        // fight some back-and-forth now that it can't be skipped anymore.
        if(Math.abs(state.px-b.x) < 500){
          b.spitTimer -= dt;
          if(b.spitTimer <= 0){
            b.spitTimer = rand(1.8, 2.8);
            const dir = state.px >= b.x ? 1 : -1;
            state.enemyFireballs.push({x:b.x, y:b.y-6, vx: 220*dir, alive:true});
            SFX.fire();
          }
        }
        const overlapX = Math.abs(state.px-b.x) < 32;
        const overlapY = state.py+26 > b.y-28 && state.py < b.y+22;
        if(overlapX && overlapY){
          // Stomping the boss is more forgiving than a regular enemy on purpose: the
          // fight is now mandatory (no bypass), so requiring the player to have been
          // clearly airborne well above Epal on the PREVIOUS frame (like regular enemy
          // stomps do) was punishing kids for imperfect timing on an encounter they
          // can't avoid. Falling (vy>0) while currently at-or-above Epal's own height
          // is enough to count as a stomp; only a touch while at/below that height (i.e.
          // walking or rising into it) still counts as a dangerous side hit.
          if(state.vy > 0 && state.py <= b.y + 4){
            // stomp — chips a hit off Epal instead of an instant kill
            b.hp--; b.hitFlash = 0.3;
            state.vy = -320;
            SFX.stomp();
            spawnSpark(state.sparkle, b.x, b.y, '#ff6b35', 12);
            if(b.hp<=0){
              b.alive = false;
              SFX.victory();
              spawnSpark(state.sparkle, b.x, b.y, '#ffd166', 26);
            }
          } else {
            state.dead = true;
            SFX.hurt();
            gameOver();
            return;
          }
        }
      }
    }
    // Epal's fireballs — straight-line projectiles the player must dodge; touching one
    // is the same danger as touching Epal directly (a jump timed to clear it, same as
    // hopping over a regular fireball thrown the other way, dodges it clean)
    for(const f of state.enemyFireballs){
      if(!f.alive) continue;
      f.x += f.vx*dt;
      if(f.x < -20 || f.x > state.worldW+20){ f.alive = false; continue; }
      if(Math.abs(state.px-f.x) < 18 && Math.abs(state.py-f.y) < 22){
        f.alive = false;
        state.dead = true;
        SFX.hurt();
        gameOver();
        return;
      }
    }
    state.enemyFireballs = state.enemyFireballs.filter(f=>f.alive);
    // fireballs — move in a straight line, defeat the first alive enemy they touch,
    // or chip a hit off Epal (same 3-hit HP as a stomp). Fireballs travel dead level
    // at whatever height they were fired from (no gravity), but enemies/Epal are all
    // squat, near-ground-height targets — a shot fired mid-jump used to sail harmlessly
    // over their heads with no way to tell why it "missed". Vertical tolerance is wide
    // enough to cover the player's full jump range (max jump height ≈97 units) so any
    // shot roughly in line horizontally connects regardless of the height it was fired
    // from — this is a ranged weapon in a kids' game, not a precision-aim mechanic.
    for(const f of state.fireballs){
      if(!f.alive) continue;
      f.x += f.vx*dt;
      if(f.x < -20 || f.x > state.worldW+20){ f.alive = false; continue; }
      for(const e of state.enemies){
        if(!e.alive) continue;
        if(Math.abs(f.x-e.x) < 20 && Math.abs(f.y-e.y) < 110){
          e.alive = false;
          f.alive = false;
          SFX.stomp();
          spawnSpark(state.sparkle, e.x, e.y, '#ff6b35', 10);
          break;
        }
      }
      if(f.alive && state.boss && state.boss.alive){
        const b = state.boss;
        if(Math.abs(f.x-b.x) < 34 && Math.abs(f.y-b.y) < 120){
          f.alive = false;
          b.hp--; b.hitFlash = 0.3;
          SFX.stomp();
          spawnSpark(state.sparkle, b.x, b.y, '#ff6b35', 12);
          if(b.hp<=0){
            b.alive = false;
            SFX.victory();
            spawnSpark(state.sparkle, b.x, b.y, '#ffd166', 26);
          }
        }
      }
    }
    state.fireballs = state.fireballs.filter(f=>f.alive);
    // win: reach end
    if(state.px >= state.worldW-30){
      state.win = true; state.over = true;
      const stars = state.coinCount >= state.maxCoins ? 3 : state.coinCount >= state.maxCoins*0.5 ? 2 : 1;
      PROG.setStars('platformer', Math.max(stars, PROG.getStars('platformer')));
      PROG.setHighScore('platformer', Math.max(PROG.getHighScore('platformer'), state.coinCount));
      PROG.updateDisplay();
      SFX.victory();
      // by the time px can reach worldW-30, the boss gate has already guaranteed
      // state.boss is either null or defeated — the "still alive" case is unreachable,
      // but the guard is kept defensively in case level geometry ever changes.
      const bossNote = !state.boss ? '' : (state.boss.alive ? '' : ' You defeated Epal!');
      setTimeout(()=>{
        showOverlay('🏆 Level Complete!', `Coins: ${state.coinCount}/${state.maxCoins}.${bossNote}`, [
          {label:'Next Level', onClick:()=>{ state=buildLevel(state.level+1); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      },250);
    }
    // animate
    if(!state.dead){
      let target;
      if(moving && state.onGround){
        const w = Math.sin(state.t*12)*28;
        target = {legF:100+w,legB:80-w,armF:-50-w,armB:-140+w,lean:-92,headBob:Math.abs(w)*0.08};
      } else if(!state.onGround){
        target = {legF:110,legB:70,armF:-160,armB:-20,lean:-100,headBob:0};
      } else {
        const b = Math.sin(state.t*2)*1.5;
        target = {legF:100,legB:80,armF:-60,armB:-130,lean:-90,headBob:b*0.3};
      }
      lerpPose(state.poseCur, target, smoothT(16,dt));
    }
  }
  function gameOver(){
    state.over = true;
    SFX.gameover();
    setTimeout(()=>{
      showGameOverOverlay('platformer', state.coinCount, '💀 Stumbled!', `You collected ${state.coinCount} coins. Try again!`, [
        {label:'Retry', onClick:()=>{ state=buildLevel(state.level); hideOverlay(); }},
        {label:'Home', onClick: goHome}
      ]);
    },200);
  }
  function draw(g){
    const cam = state.camera;
    // paint the full-screen background BEFORE the camera-scroll transform is applied —
    // drawGround fills via fillRect(0,0,CW,CH) in whatever transform is active, so doing
    // this after translate(-cam,0) only clears part of the canvas once cam>0, leaving old
    // frames to ghost/accumulate on the uncovered strip.
    const colors = [['#87ceeb','#e8fff2'],['#b8a9e8','#f0e6ff'],['#ffcc99','#ffe8cc']];
    const c = colors[(state.level-1)%colors.length];
    drawGround(c[0], c[1]);
    // drawGround() above paints a solid green "floor" band across the FULL canvas width,
    // regardless of whether a ground platform actually exists there — so gaps (the pits you
    // fall through and die) looked exactly like safe ground. Paint a lava/hazard band over
    // that same full-width strip first; the real ground platforms are drawn on top of it a
    // few lines down (in world space, camera-scrolled) and now fill their FULL depth, so
    // solid ground still looks fully green while any gap shows the hazard color through.
    const hazGrad = g.createLinearGradient(0,GROUND_Y,0,CH);
    hazGrad.addColorStop(0,'#ff8c42');
    hazGrad.addColorStop(0.4,'#e8531f');
    hazGrad.addColorStop(1,'#7a1d0a');
    g.fillStyle = hazGrad;
    g.fillRect(0,GROUND_Y,CW,CH-GROUND_Y);
    g.fillStyle = 'rgba(255,214,102,0.4)';
    for(let i=0;i<16;i++){
      const bx = (i*53 + state.t*22)%CW;
      const by = GROUND_Y + 12 + ((i*37)%(CH-GROUND_Y-12));
      g.beginPath(); g.arc(bx,by,3+(i%3),0,Math.PI*2); g.fill();
    }
    g.save();
    g.translate(-cam, 0);
    // platforms
    for(const p of state.platforms){
      if(p.type==='ground'){
        g.fillStyle = '#7cc576';
        g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = '#5fa85a';
        g.fillRect(p.x, p.y, p.w, 6);
      } else {
        g.fillStyle = '#8d5524';
        roundRect(p.x, p.y, p.w, p.h, 4);
        g.fill();
      }
    }
    // coins
    for(const c of state.coins){
      if(c.taken) continue;
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(c.x, c.y, 10, 0, Math.PI*2); g.fill();
      g.strokeStyle = '#b37f00'; g.lineWidth=1.5; g.stroke();
    }
    // enemies
    for(const e of state.enemies){
      if(!e.alive) continue;
      g.fillStyle = '#e63946';
      g.beginPath(); g.arc(e.x, e.y+6, 16, Math.PI, 0); g.fill();
      g.fillRect(e.x-6, e.y-8, 12, 14);
      g.fillStyle = '#fff';
      g.fillRect(e.x-4, e.y-14, 8, 8);
      g.fillStyle = '#000';
      g.fillRect(e.x+1, e.y-12, 3, 3);
    }
    // boss gate — a translucent barrier marking the invisible wall (see the px clamp in
    // update()) that Epal blocks until defeated, so it's visually obvious why the player
    // can't walk any further right, instead of just silently stopping.
    if(state.boss && state.boss.alive){
      const gateX = state.boss.baseX - state.boss.range - 10;
      const gateGrad = g.createLinearGradient(gateX-10,0,gateX+10,0);
      gateGrad.addColorStop(0,'rgba(230,57,70,0)');
      gateGrad.addColorStop(0.5,'rgba(230,57,70,0.5)');
      gateGrad.addColorStop(1,'rgba(230,57,70,0)');
      g.fillStyle = gateGrad;
      g.fillRect(gateX-10, 0, 20, GROUND_Y);
    }
    // boss — Epal, a small serpentine dragon guarding the flag on even levels
    if(state.boss && state.boss.alive){
      const b = state.boss;
      const flash = b.hitFlash > 0;
      const facing = b.vx < 0 ? -1 : 1;
      const wob = Math.sin(b.t*6)*6;
      // sinuous trailing body — a chain of shrinking circles that undulate over time,
      // giving a slithering snake-like read without needing any image assets
      for(let i=5;i>=1;i--){
        const segX = b.x - facing*i*13;
        const segY = b.y - 6 + Math.sin(b.t*5 - i*0.9)*7;
        const r = 15 - i*1.6;
        g.fillStyle = flash ? '#ffb703' : (i%2===0 ? '#3a7d44' : '#2f6636');
        g.beginPath(); g.arc(segX, segY, r, 0, Math.PI*2); g.fill();
      }
      // small wings
      g.fillStyle = 'rgba(58,125,68,0.7)';
      g.beginPath();
      g.moveTo(b.x-facing*4, b.y-10);
      g.quadraticCurveTo(b.x-facing*30, b.y-30+wob, b.x-facing*10, b.y-4);
      g.fill();
      // head
      g.fillStyle = flash ? '#ffd166' : '#3a7d44';
      g.beginPath(); g.arc(b.x, b.y-6+wob*0.2, 20, 0, Math.PI*2); g.fill();
      // horns
      g.strokeStyle = '#8d5524'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(b.x-facing*8, b.y-22); g.lineTo(b.x-facing*14, b.y-34); g.stroke();
      g.beginPath(); g.moveTo(b.x+facing*2, b.y-24); g.lineTo(b.x+facing*6, b.y-36); g.stroke();
      // glowing eyes
      g.fillStyle = '#ffe27a';
      g.beginPath(); g.arc(b.x+facing*10, b.y-10, 4, 0, Math.PI*2); g.fill();
      g.fillStyle = '#1c2b3a';
      g.beginPath(); g.arc(b.x+facing*11, b.y-10, 2, 0, Math.PI*2); g.fill();
      // name + health bar
      g.textAlign = 'center'; g.font = 'bold 13px Segoe UI'; g.fillStyle = '#1c2b3a';
      g.fillText('Epal', b.x, b.y-46);
      healthBar(b.x-30, b.y-42, 60, 8, b.hp/b.maxHp, '#e63946');
    }
    // fire power-up pickups
    g.font = '22px sans-serif';
    g.textAlign = 'center';
    for(const p of state.firePickups){
      if(p.taken) continue;
      const bob = Math.sin(state.t*3 + p.x)*3;
      g.fillText('🔥', p.x, p.y+7+bob);
    }
    // fireballs in flight
    for(const f of state.fireballs){
      g.fillStyle = '#ff6b35';
      g.beginPath(); g.arc(f.x, f.y, 7, 0, Math.PI*2); g.fill();
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(f.x, f.y, 3, 0, Math.PI*2); g.fill();
    }
    // Epal's fireballs — green-flamed so they read as clearly distinct (and dangerous)
    // from the player's own orange ones at a glance
    for(const f of state.enemyFireballs){
      g.fillStyle = '#3a7d44';
      g.beginPath(); g.arc(f.x, f.y, 7, 0, Math.PI*2); g.fill();
      g.fillStyle = '#a4de6c';
      g.beginPath(); g.arc(f.x, f.y, 3, 0, Math.PI*2); g.fill();
    }
    drawDust(g, state.dust);
    drawSparks(g, state.sparkle);
    // player
    const s = state.poseCur;
    const expr = state.dead ? 'hurt' : (state.onGround ? 'idle' : 'shout');
    drawStick(g, state.px, state.py, 0.95, '#2b6cb0', state.facing, s, {expr, accessory:'band', accessoryColor:'#ff8c42'});
    // finish flag
    g.fillStyle = '#ff6b6b';
    g.beginPath(); g.moveTo(state.worldW-30, GROUND_Y-50); g.lineTo(state.worldW-30, GROUND_Y); g.stroke();
    g.fillStyle = '#ffd166';
    g.beginPath(); g.moveTo(state.worldW-28, GROUND_Y-55); g.lineTo(state.worldW-10, GROUND_Y-35); g.lineTo(state.worldW-28, GROUND_Y-15); g.fill();
    g.restore();
    // HUD (screen space)
    g.textAlign='left'; g.font='bold 16px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText('Coins: '+state.coinCount+'/'+state.maxCoins, 16, 26);
    g.fillText('🔥 x'+state.ammo, 16, 48);
    g.textAlign='center';
    g.fillText('Level '+state.level, CW/2, 26);
    g.textAlign='right';
    g.fillText(Math.round(state.dist)+'m', CW-16, 26);
    if(state.boss && state.boss.alive){
      g.textAlign='center'; g.font='bold 15px Segoe UI'; g.fillStyle='#e63946';
      g.fillText('⚔️ Defeat Epal to pass!', CW/2, CH-14);
    }
  }
  return {
    title:'Stickman Quest', hint:'Collect coins, stomp enemies, reach the flag! Grab 🔥 power-ups to shoot fire at enemies from a distance — and dodge Epal’s fireballs! ◀▶ to move, ↑ to jump, 🔥 to shoot',
    controlsHtml:`
      <div class="padBtns">
        <button class="ctlBtn" id="btnPLeft">◀</button>
        <button class="ctlBtn" id="btnPRight">▶</button>
      </div>
      <div class="actionBtns" style="margin:0 auto;">
        <button class="ctlBtn wide" id="btnPJump" style="background:#06d6a0;color:#fff;">⬆ JUMP</button>
        <button class="ctlBtn wide" id="btnPFire" style="background:#ff6b35;color:#fff;">🔥 FIRE</button>
      </div>`,
    bindControls(){
      bindHoldBtn('btnPLeft','left');
      bindHoldBtn('btnPRight','right');
      bindTapBtn('btnPJump', ()=>{ keys['jump']=true; });
      bindTapBtn('btnPFire', ()=>{ keys['doFire']=true; });
    },
    create(){ state=buildLevel(1); return this; },
    restart(){ state=buildLevel(1); hideOverlay(); },
    update, draw,
  };
}

/* =========================================================
   GAME REGISTRY
   ========================================================= */
