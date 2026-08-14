/* =========================================================
   GAME 13 — Stick Fort Defense (lane-based tower-defense-lite)
   3 lanes, a friendly Fort on the left with an HP bar, and silly
   stickman invaders marching in from the right. Tap a lane to spend
   Energy and place a permanent Swordsman defender who auto-fights
   anything that wanders into range. 5 waves + a big goofy boss wave.
   ========================================================= */
function createFortDefenseGame(){
  let state;

  /* ---------------- layout constants ---------------- */
  const PLAY_TOP = 50, PLAY_BOT = 430;
  const LANE_H = (PLAY_BOT - PLAY_TOP) / 3;
  const LANE_Y = [0,1,2].map(i => PLAY_TOP + LANE_H*(i+0.5));
  const FORT_HIT_X = 150;      // enemies "arrive" once they cross this x
  const FORT_VIS_X = 88;       // center of the fort graphic
  const SPAWN_X = 780;
  const SLOT_XS = [230, 330, 430, 530, 630, 720];
  const DEFENDER_COST = 3;
  const DEFENDER_RANGE = 95;
  const DEFENDER_ATK_RATE = 0.5;
  const DEFENDER_DMG = 12;
  const POKE_DUR = 0.18;

  const ENEMY_TYPES = {
    fast:  { hp:20, speed:76,  dmg:8,  color:'#ff5b5b', accessory:'band', accessoryColor:'#c81e1e', scale:0.72, name:'Scout' },
    tank:  { hp:65, speed:32,  dmg:20, color:'#4d8ff0', accessory:'mask', accessoryColor:'#1c3a6e', scale:1.05, name:'Brute' },
    jumpy: { hp:30, speed:54,  dmg:12, color:'#39d16b', accessory:'band', accessoryColor:'#0f7a34', scale:0.9,  name:'Hopper' },
  };
  const BOSS_HP = 360, BOSS_DMG = 30, BOSS_SPEED = 22;

  const WAVES = [
    { n:1, count:6,  interval:1.75, mix:[['fast',3]] },
    { n:2, count:8,  interval:1.5,  mix:[['fast',3],['tank',1]] },
    { n:3, count:10, interval:1.3,  mix:[['fast',3],['tank',2],['jumpy',2]] },
    { n:4, count:12, interval:1.1,  mix:[['fast',3],['tank',2],['jumpy',3]] },
    { n:5, count:14, interval:0.95, mix:[['fast',2],['tank',3],['jumpy',3]] },
    { n:6, boss:true },
  ];

  function pickType(mix){
    let total = 0; mix.forEach(m=>total+=m[1]);
    let r = Math.random()*total, acc = 0;
    for(const [type,w] of mix){ acc += w; if(r<=acc) return type; }
    return mix[0][0];
  }

  /* ---------------- state ---------------- */
  function fresh(){
    const s = {
      phase: 'banner',        // banner | active | cleared | victory | gameover | done
      waveIndex: 0,
      bannerT: 2.0,
      bannerText: 'Wave 1',
      bannerSub: 'Get your defenders ready!',
      clearedT: 0,
      fortHP: 100, maxFortHP: 100,
      energy: 8, maxEnergy: 20, energyT: 0,
      defenders: [],
      enemies: [],
      slotsOccupied: {},
      spawnQueue: 0,
      spawnT: 0,
      particles: makeParticlePool(),
      popups: [],
      shakeT: 0,
      flashT: 0, flashColor: 'rgba(255,80,80,0.3)',
      t: 0,
    };
    return s;
  }
  function startWave(idx){
    state.waveIndex = idx;
    const w = WAVES[idx];
    state.phase = 'banner';
    state.bannerT = 2.0;
    if(w.boss){
      state.bannerText = '⚠️ FINAL BOSS! ⚠️';
      state.bannerSub = 'A big goofy invader is coming — focus fire together!';
      state.spawnQueue = 1;
    } else {
      state.bannerText = 'Wave ' + w.n;
      state.bannerSub = w.n===1 ? 'Tap a lane to place a defender!' : 'Here they come!';
      state.spawnQueue = w.count;
    }
    state.spawnT = 0.5;
    SFX.beep();
  }

  /* ---------------- enemy spawning ---------------- */
  function spawnEnemy(w){
    const type = pickType(w.mix);
    const T = ENEMY_TYPES[type];
    const lane = Math.floor(rand(0,3));
    state.enemies.push({
      isBoss:false, type, lane, x:SPAWN_X, y:LANE_Y[lane],
      hp:T.hp, maxHp:T.hp, speed:T.speed, dmg:T.dmg,
      color:T.color, accessory:T.accessory, accessoryColor:T.accessoryColor, scale:T.scale,
      hitFlash:0, animT:rand(0,10),
    });
  }
  function spawnBoss(){
    const lane = 1;
    const b = {
      isBoss:true, type:'boss', lane, x:SPAWN_X, y:LANE_Y[lane],
      hp:BOSS_HP, maxHp:BOSS_HP, speed:BOSS_SPEED, dmg:BOSS_DMG,
      color:'#b06bff', accessory:'mask', accessoryColor:'#5b21b6', scale:1.65,
      hitFlash:0, animT:0, laneSwitchT: rand(3.4,4.2),
    };
    state.enemies.push(b);
  }

  /* ---------------- combat ---------------- */
  function removeEnemy(e){
    const i = state.enemies.indexOf(e);
    if(i>=0) state.enemies.splice(i,1);
  }
  function killEnemy(e){
    spawnSpark(state.particles, e.x, e.y, e.color, e.isBoss?26:12);
    spawnSpark(state.particles, e.x, e.y, '#ffd166', e.isBoss?14:6);
    if(e.isBoss){
      SFX.bomb();
      state.shakeT = 0.45;
      state.popups.push({x:e.x, y:e.y-56, text:'BOSS DEFEATED!', color:'#ffd166', life:1.6});
    } else {
      SFX.stomp();
    }
    removeEnemy(e);
  }
  function damageFort(dmg, atY){
    if(state.phase==='victory' || state.phase==='gameover' || state.phase==='done') return;
    state.fortHP = Math.max(0, state.fortHP - dmg);
    state.flashT = 0.22;
    state.flashColor = 'rgba(255,70,70,0.32)';
    state.shakeT = 0.22;
    state.popups.push({x:FORT_VIS_X+40, y:(atY||240)-20, text:'-'+dmg+' HP', color:'#ff5050', life:0.9});
    SFX.hurt();
    if(state.fortHP<=0) triggerGameOver();
  }

  /* ---------------- placement ---------------- */
  function onPointerDown(x,y){
    if(!state.phase || state.phase==='victory' || state.phase==='gameover' || state.phase==='done') return;
    let lane = -1, bestLaneD = Infinity;
    for(let i=0;i<3;i++){ const d = Math.abs(y-LANE_Y[i]); if(d<bestLaneD){ bestLaneD=d; lane=i; } }
    if(bestLaneD > LANE_H*0.55){ SFX.wrong(); return; }
    let slotIdx = -1, bestSlotD = Infinity;
    SLOT_XS.forEach((sx,idx)=>{ const d = Math.abs(x-sx); if(d<bestSlotD){ bestSlotD=d; slotIdx=idx; } });
    if(bestSlotD > 44){ SFX.wrong(); return; }
    const key = lane+'-'+slotIdx;
    if(state.slotsOccupied[key]){ SFX.wrong(); return; }
    if(state.energy < DEFENDER_COST){
      SFX.wrong();
      state.popups.push({x, y:y-30, text:'Need '+DEFENDER_COST+' energy!', color:'#ffd166', life:0.9});
      return;
    }
    state.energy -= DEFENDER_COST;
    const d = { lane, x:SLOT_XS[slotIdx], y:LANE_Y[lane], cooldown:0.15, pokeT:0, wobbleT:rand(0,10) };
    state.defenders.push(d);
    state.slotsOccupied[key] = d;
    spawnSpark(state.particles, d.x, d.y, '#39ff88', 10);
    SFX.click();
  }

  /* ---------------- wave lifecycle ---------------- */
  function onWaveCleared(){
    if(state.phase !== 'active') return;
    state.phase = 'cleared';
    state.clearedT = 1.3;
    SFX.powerup();
    if(WAVES[state.waveIndex].boss){
      // boss already announced via popup on kill
    } else {
      state.popups.push({x:CW/2, y:CH/2-30, text:'Wave '+WAVES[state.waveIndex].n+' Cleared!', color:'#39ff88', life:1.2});
    }
  }
  function triggerVictory(){
    state.phase = 'victory';
    SFX.victory();
    setTimeout(finishVictory, 500);
  }
  function finishVictory(){
    const hpPct = state.fortHP / state.maxFortHP;
    const stars = hpPct>=0.7 ? 3 : hpPct>=0.35 ? 2 : 1;
    const score = 6*1000 + Math.round(state.fortHP);
    PROG.setStars('fortdefense', stars);
    PROG.setHighScore('fortdefense', score);
    PROG.updateDisplay();
    recordRoundComplete();
    unlockAchievement('fortdefense_boss_defeated');
    if(hpPct >= 0.9) unlockAchievement('fortdefense_flawless');
    setTimeout(()=>{
      showGameOverOverlay('fortdefense', score, '🏰 Fort Defended!',
        `Your defenders held the line through all 6 waves and toppled the boss with ${Math.round(state.fortHP)} HP left! Final score: ${score}`,
        [
          {label:'Play Again', onClick:()=>{ state=fresh(); startWave(0); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      state.phase = 'done';
    }, 200);
  }
  function triggerGameOver(){
    if(state.phase==='gameover' || state.phase==='done') return;
    state.phase = 'gameover';
    SFX.gameover();
    const wavesCompleted = state.waveIndex;
    const score = wavesCompleted*1000 + Math.round(Math.max(0,state.fortHP));
    const stars = wavesCompleted>=3 ? 1 : 0;
    PROG.setStars('fortdefense', stars);
    PROG.setHighScore('fortdefense', score);
    PROG.updateDisplay();
    recordRoundComplete();
    setTimeout(()=>{
      showGameOverOverlay('fortdefense', score, '🏰 Try Again!',
        `Your fort held strong through ${wavesCompleted} wave${wavesCompleted===1?'':'s'} before the invaders broke through. Place your defenders early and spread them out — you'll get it next time!`,
        [
          {label:'Play Again', onClick:()=>{ state=fresh(); startWave(0); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
      state.phase = 'done';
    }, 200);
  }

  /* ---------------- update ---------------- */
  function update(dt){
    state.t += dt;
    updateParticles(state.particles, dt, 140);
    if(state.shakeT>0) state.shakeT -= dt;
    if(state.flashT>0) state.flashT -= dt;
    state.popups.forEach(p=>{ p.y -= 24*dt; p.life -= dt*1.1; });
    state.popups = state.popups.filter(p=>p.life>0);

    if(state.phase==='victory' || state.phase==='gameover' || state.phase==='done') return;

    // energy regen
    state.energyT += dt;
    if(state.energyT >= 1.5){
      state.energyT -= 1.5;
      state.energy = Math.min(state.maxEnergy, state.energy+1);
    }

    if(state.phase==='banner'){
      state.bannerT -= dt;
      if(state.bannerT<=0) state.phase = 'active';
    } else if(state.phase==='cleared'){
      state.clearedT -= dt;
      if(state.clearedT<=0){
        if(state.waveIndex >= WAVES.length-1) triggerVictory();
        else startWave(state.waveIndex+1);
      }
    }

    if(state.phase==='active'){
      const w = WAVES[state.waveIndex];
      state.spawnT -= dt;
      if(state.spawnQueue>0 && state.spawnT<=0){
        if(w.boss) spawnBoss(); else spawnEnemy(w);
        state.spawnQueue--;
        state.spawnT = w.boss ? 9999 : w.interval;
      }
    }

    // defenders attack
    for(const d of state.defenders){
      d.cooldown -= dt;
      d.wobbleT += dt;
      if(d.pokeT>0) d.pokeT -= dt;
      if(d.cooldown<=0){
        let target = null, bestDist = Infinity;
        for(const e of state.enemies){
          if(e.lane !== d.lane) continue;
          const dd = Math.abs(e.x-d.x);
          if(dd<=DEFENDER_RANGE && dd<bestDist){ target = e; bestDist = dd; }
        }
        if(target){
          target.hp -= DEFENDER_DMG;
          target.hitFlash = 0.15;
          d.pokeT = POKE_DUR;
          d.cooldown = DEFENDER_ATK_RATE;
          spawnSpark(state.particles, target.x, target.y, '#ffd166', 5);
          SFX.sword();
          if(target.hp<=0) killEnemy(target);
        } else {
          d.cooldown = 0.15;
        }
      }
    }

    // enemies move
    for(const e of state.enemies.slice()){
      if(e.hitFlash>0) e.hitFlash -= dt;
      e.animT += dt;
      if(e.isBoss){
        e.laneSwitchT -= dt;
        if(e.laneSwitchT<=0){
          let newLane;
          do{ newLane = Math.floor(rand(0,3)); } while(newLane===e.lane);
          e.lane = newLane;
          e.laneSwitchT = rand(3.4,4.4);
        }
        e.y = lerp(e.y, LANE_Y[e.lane], smoothT(3.5,dt));
      }
      e.x -= e.speed*dt;
      if(e.x <= FORT_HIT_X){
        damageFort(e.dmg, e.y);
        spawnSpark(state.particles, FORT_HIT_X, e.y, '#ffffff', 8);
        removeEnemy(e);
      }
    }

    if(state.phase==='active' && state.spawnQueue<=0 && state.enemies.length===0){
      onWaveCleared();
    }
  }

  /* ---------------- drawing ---------------- */
  function drawBg(g){
    const grad = g.createLinearGradient(0,0,0,CH);
    grad.addColorStop(0,'#bfe9ff');
    grad.addColorStop(1,'#dff7e6');
    g.fillStyle = grad;
    g.fillRect(0,0,CW,CH);
    // lane bands
    for(let i=0;i<3;i++){
      const y0 = PLAY_TOP + LANE_H*i;
      g.fillStyle = i%2===0 ? 'rgba(255,255,255,0.35)' : 'rgba(120,200,140,0.18)';
      g.fillRect(0, y0, CW, LANE_H);
      g.strokeStyle = 'rgba(60,90,70,0.25)';
      g.lineWidth = 2;
      g.setLineDash([10,8]);
      g.beginPath(); g.moveTo(0,y0); g.lineTo(CW,y0); g.stroke();
      g.setLineDash([]);
    }
    g.strokeStyle = 'rgba(60,90,70,0.25)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0,PLAY_BOT); g.lineTo(CW,PLAY_BOT); g.stroke();
  }

  function drawFort(g){
    const x = FORT_VIS_X;
    g.save();
    const hurt = state.flashT>0;
    // wall
    g.fillStyle = hurt ? '#d98a6b' : '#c8946a';
    roundRect(x-58, PLAY_TOP-8, 116, (PLAY_BOT-PLAY_TOP)+16, 10);
    g.fill();
    g.strokeStyle = '#7a5230'; g.lineWidth = 3;
    roundRect(x-58, PLAY_TOP-8, 116, (PLAY_BOT-PLAY_TOP)+16, 10);
    g.stroke();
    // crenellations
    g.fillStyle = '#b98457';
    for(let cx=x-54; cx<x+54; cx+=20){
      g.fillRect(cx, PLAY_TOP-20, 12, 16);
    }
    // door
    g.fillStyle = '#6b4526';
    g.beginPath();
    g.moveTo(x-16, PLAY_BOT-4);
    g.lineTo(x-16, (PLAY_TOP+PLAY_BOT)/2+10);
    g.quadraticCurveTo(x, (PLAY_TOP+PLAY_BOT)/2-30, x+16, (PLAY_TOP+PLAY_BOT)/2+10);
    g.lineTo(x+16, PLAY_BOT-4);
    g.closePath(); g.fill();
    // friendly face on the door
    g.fillStyle = '#ffe6c9';
    g.beginPath(); g.arc(x-7,(PLAY_TOP+PLAY_BOT)/2-2,3.5,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(x+7,(PLAY_TOP+PLAY_BOT)/2-2,3.5,0,Math.PI*2); g.fill();
    g.strokeStyle = '#ffe6c9'; g.lineWidth = 2; g.lineCap='round';
    g.beginPath(); g.arc(x,(PLAY_TOP+PLAY_BOT)/2+6,7,deg(20),deg(160)); g.stroke();
    // flagpole + waving flag
    g.strokeStyle = '#5a3d20'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, PLAY_TOP-20); g.lineTo(x, PLAY_TOP-58); g.stroke();
    const wave = Math.sin(state.t*4)*6;
    g.fillStyle = '#ff5b5b';
    g.beginPath();
    g.moveTo(x, PLAY_TOP-58);
    g.quadraticCurveTo(x+22+wave, PLAY_TOP-52, x+2, PLAY_TOP-44);
    g.lineTo(x, PLAY_TOP-44);
    g.closePath(); g.fill();
    g.restore();
  }

  function walkPose(e){
    const spd = e.isBoss ? 3.2 : 8;
    const amp = e.isBoss ? 22 : 30;
    const sw = Math.sin(e.animT*spd)*amp;
    return { legF:92+sw, legB:92-sw, armF:-90+sw*1.2, armB:-90-sw*1.2, lean:-90, headBob:Math.sin(e.animT*spd)*1.6 };
  }
  function drawEnemy(g,e){
    const pose = walkPose(e);
    const flash = e.hitFlash>0;
    g.save();
    if(flash){ g.globalAlpha = 0.7; }
    drawStick(g, e.x, e.y+18, e.scale, flash?'#ffffff':e.color, -1, pose, {expr: e.isBoss?'shout':'idle', accessory:e.accessory, accessoryColor:e.accessoryColor});
    g.restore();
    const barW = e.isBoss ? 120 : 40;
    healthBar(e.x-barW/2, e.y+18-46*e.scale-14, barW, e.isBoss?8:5, e.hp/e.maxHp, e.isBoss?'#b06bff':'#ff5050');
    if(e.isBoss){
      g.textAlign='center'; g.font='bold 14px Segoe UI'; g.fillStyle='#5b21b6';
      g.fillText('👑 King Wobblestomp', e.x, e.y-70);
    }
  }
  function defenderPose(d){
    if(d.pokeT>0){
      const p = 1 - (d.pokeT/POKE_DUR);
      const swing = Math.sin(p*Math.PI);
      return { legF:98, legB:88, armF:-120+swing*135, armB:-140, lean:-90, headBob:0 };
    }
    return { legF:96, legB:92, armF:-115, armB:-140, lean:-90, headBob:Math.sin(d.wobbleT*2)*1.2 };
  }
  function drawDefender(g,d){
    const pose = defenderPose(d);
    drawStick(g, d.x, d.y+18, 0.86, '#2b6cb0', 1, pose, {expr:'shout', accessory:'band', accessoryColor:'#ffd166'});
    // little sword glint on poke
    if(d.pokeT>0){
      g.save();
      g.strokeStyle = '#eafcff'; g.lineWidth = 3; g.lineCap='round';
      g.beginPath(); g.moveTo(d.x+18,d.y+2); g.lineTo(d.x+DEFENDER_RANGE*0.35,d.y+2); g.stroke();
      g.restore();
    }
  }
  function drawSlots(g){
    if(state.phase==='victory' || state.phase==='gameover' || state.phase==='done') return;
    for(let lane=0;lane<3;lane++){
      SLOT_XS.forEach((sx,idx)=>{
        const key = lane+'-'+idx;
        if(state.slotsOccupied[key]) return;
        g.save();
        g.globalAlpha = state.energy>=DEFENDER_COST ? 0.35 : 0.15;
        g.strokeStyle = '#2b6cb0';
        g.setLineDash([4,4]);
        g.lineWidth = 2;
        g.beginPath(); g.arc(sx, LANE_Y[lane], 22, 0, Math.PI*2); g.stroke();
        g.setLineDash([]);
        g.restore();
      });
    }
  }
  function drawHud(g){
    // fort HP
    g.textAlign='left'; g.font='bold 13px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText('🏰 Fort HP', 14, 20);
    healthBar(14, 24, 150, 14, state.fortHP/state.maxFortHP, state.fortHP>40?'#39d16b':'#ff5050');
    g.fillStyle='#1c2b3a';
    g.fillText(Math.round(state.fortHP)+'/'+state.maxFortHP, 170, 35);
    // energy
    g.textAlign='right';
    g.fillText('⚡ Energy '+state.energy+'/'+state.maxEnergy+'  (place: '+DEFENDER_COST+')', CW-14, 20);
    const barW = 150;
    healthBar(CW-14-barW, 24, barW, 14, state.energy/state.maxEnergy, '#ffd166');
    // wave indicator
    g.textAlign='center'; g.font='bold 14px Segoe UI'; g.fillStyle='#1c2b3a';
    const w = WAVES[state.waveIndex];
    g.fillText(w.boss ? 'Final Boss Wave' : ('Wave '+w.n+'/'+ (WAVES.length-1)), CW/2, 20);
  }
  function drawBanner(g){
    if(state.phase!=='banner') return;
    g.save();
    g.globalAlpha = clamp(state.bannerT/0.4,0,1)*0.9 + 0.1;
    g.textAlign='center';
    g.font='bold 34px Segoe UI'; g.fillStyle='#1c2b3a';
    g.fillText(state.bannerText, CW/2, CH/2-20);
    g.font='bold 16px Segoe UI'; g.fillStyle='#33506b';
    g.fillText(state.bannerSub, CW/2, CH/2+14);
    g.restore();
  }

  function draw(g){
    let sx=0, sy=0;
    if(state.shakeT>0){ sx = rand(-5,5); sy = rand(-5,5); }
    g.save();
    g.translate(sx,sy);
    drawBg(g);
    drawSlots(g);
    drawFort(g);
    state.enemies.forEach(e=>drawEnemy(g,e));
    state.defenders.forEach(d=>drawDefender(g,d));
    drawSparks(g, state.particles);
    state.popups.forEach(p=>{
      g.globalAlpha = clamp(p.life,0,1);
      g.fillStyle = p.color; g.font='bold 17px Segoe UI'; g.textAlign='center';
      g.fillText(p.text, p.x, p.y);
    });
    g.globalAlpha = 1;
    drawHud(g);
    drawBanner(g);
    g.restore();
    if(state.flashT>0){
      g.save();
      g.globalAlpha = clamp(state.flashT/0.22,0,1);
      g.fillStyle = state.flashColor;
      g.fillRect(0,0,CW,CH);
      g.restore();
    }
  }

  return {
    title: 'Stick Fort Defense',
    hint: 'Tap a lane to place a defender! Stop the silly invaders before they reach your fort — watch out for the final boss!',
    controlsHtml: '',
    bindControls(){},
    create(){ state = fresh(); startWave(0); return this; },
    restart(){ state = fresh(); startWave(0); hideOverlay(); },
    update, draw, onPointerDown,
  };
}
