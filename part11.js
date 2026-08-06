/* =========================================================
   GAME 12 — Stick RPG Wars (turn-based tactical mini-campaign)
   ========================================================= */
function createRpgWarsGame(){
  let state;

  /* ---------------- poses ---------------- */
  const POSE_IDLE   = {legF:100,legB:80,armF:-70,armB:-110,lean:-90,headBob:0};
  const POSE_ATTACK = {legF:112,legB:72,armF:-15,armB:-130,lean:-78,headBob:-2};
  const POSE_POWER  = {legF:118,legB:68,armF:10, armB:-150,lean:-70,headBob:-4};
  const POSE_HURT   = {legF:88, legB:92,armF:-150,armB:-30,lean:-105,headBob:4};
  const POSE_DEFEND = {legF:96, legB:88,armF:-95,armB:-95, lean:-92,headBob:0};
  const POSE_HEAL   = {legF:100,legB:80,armF:-170,armB:-170,lean:-92,headBob:-3};
  function poseFor(phase){
    if(phase==='attack') return POSE_ATTACK;
    if(phase==='power')  return POSE_POWER;
    if(phase==='hurt')   return POSE_HURT;
    if(phase==='defend') return POSE_DEFEND;
    if(phase==='heal')   return POSE_HEAL;
    return POSE_IDLE;
  }

  /* ---------------- rival faction roster (5 escalating battles) ---------------- */
  const ENEMY_DEFS = [
    {name:'Bandit Scout',      color:'#8a6642', accessory:'band', accessoryColor:'#c0392b', scale:1.15, specialName:'Sneak Slash'},
    {name:'Rogue Knight',      color:'#5b6b7a', accessory:'band', accessoryColor:'#2b6cb0', scale:1.25, specialName:'Shield Bash'},
    {name:'Dark Sorcerer',     color:'#5a3d8a', accessory:'mask', accessoryColor:'#1c0f2e', scale:1.2,  specialName:'Shadow Bolt'},
    {name:'Kingdom Champion',  color:'#b8860b', accessory:'band', accessoryColor:'#ffd166', scale:1.3,  specialName:"Champion's Fury"},
    {name:'The Warlord',       color:'#7a1f1f', accessory:'mask', accessoryColor:'#2b0000', scale:1.45, specialName:"Warlord's Wrath"},
  ];
  function makeEnemy(n){
    const def = ENEMY_DEFS[Math.min(Math.max(n,1),5)-1];
    const maxHp = 18 + n*8;
    const atk = 4 + n*2;
    return Object.assign({}, def, {
      maxHp, hp:maxHp, atk,
      charging:false, specialCooldown:0, specialMult:1.8,
      animPose: clonePose(POSE_IDLE), animPhase:'idle', animTimer:0,
    });
  }

  /* ---------------- state ---------------- */
  function fresh(){
    return {
      screen:'prep',      // 'prep' (camp/shop) | 'battle'
      battleNum:1,         // 1..5
      player:{
        maxHp:30, hp:30, atk:6, def:2, gold:40,
        animPose: clonePose(POSE_IDLE), animPhase:'idle', animTimer:0,
      },
      enemy:null,
      totalGold:0,          // score — gold earned from battles (not counting starting gold)
      turnLock:false,
      playerDefending:false,
      powerCooldown:0,
      healUses:2,
      turnCount:0,
      log:'',
      shakeMag:0,
      hitFlash:0,
      clock:0,
      particles: makeParticlePool(),
    };
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  /* ---------------- animation helpers ---------------- */
  function updateFighterAnim(f, dt){
    if(!f) return;
    if(f.animTimer>0){
      f.animTimer -= dt;
      if(f.animTimer<=0) f.animPhase = 'idle';
    }
    const target = poseFor(f.animPhase);
    const blended = clonePose(target);
    blended.headBob = (blended.headBob||0) + Math.sin(state.clock*2)*1.1;
    lerpPose(f.animPose, blended, smoothT(14, dt));
  }
  function triggerHit(target, x, y, color){
    target.animPhase = 'hurt';
    target.animTimer = 0.4;
    state.shakeMag = Math.min(9, state.shakeMag+6);
    state.hitFlash = 1;
    spawnSpark(state.particles, x, y, color, 10);
    SFX.hurt();
  }

  /* ---------------- combat ---------------- */
  function startBattle(){
    state.enemy = makeEnemy(state.battleNum);
    state.screen = 'battle';
    state.turnLock = false;
    state.playerDefending = false;
    state.powerCooldown = 0;
    state.healUses = 2;
    state.turnCount = 0;
    state.log = `A ${state.enemy.name} blocks your path!`;
    state.player.animPhase = 'idle'; state.player.animTimer = 0;
    buildDOM();
  }

  function playerAction(action){
    if(!state || state.screen!=='battle' || state.turnLock) return;
    const p = state.player, e = state.enemy;
    if(!e || e.hp<=0 || p.hp<=0) return;
    if(action==='power' && state.powerCooldown>0) return;
    if(action==='heal' && state.healUses<=0) return;
    state.turnLock = true;
    let msg = '';
    if(action==='attack'){
      const dmg = Math.max(1, Math.round(p.atk * rand(0.85,1.15)));
      e.hp = Math.max(0, e.hp - dmg);
      msg = `⚔️ You strike ${e.name} for ${dmg} damage!`;
      SFX.sword();
      p.animPhase='attack'; p.animTimer=0.35;
      triggerHit(e, 600, GROUND_Y-70, '#ff6b6b');
    } else if(action==='power'){
      const dmg = Math.max(1, Math.round(p.atk * 1.8 * rand(0.85,1.15)));
      e.hp = Math.max(0, e.hp - dmg);
      msg = `💥 Power Strike! ${dmg} damage to ${e.name}!`;
      state.powerCooldown = 2;
      SFX.kick();
      p.animPhase='power'; p.animTimer=0.4;
      triggerHit(e, 600, GROUND_Y-70, '#ffb703');
    } else if(action==='heal'){
      const amt = Math.round(p.maxHp * 0.25);
      p.hp = Math.min(p.maxHp, p.hp + amt);
      state.healUses--;
      msg = `💚 You heal for ${amt} HP!`;
      SFX.powerup();
      p.animPhase='heal'; p.animTimer=0.5;
      spawnSpark(state.particles, 200, GROUND_Y-70, '#06d6a0', 10);
    } else if(action==='defend'){
      state.playerDefending = true;
      msg = `🛡️ You brace behind your guard!`;
      SFX.block();
      p.animPhase='defend'; p.animTimer=0.5;
    } else {
      state.turnLock = false;
      return;
    }
    state.log = msg;
    buildDOM();
    if(e.hp<=0){
      finishBattleWin();
      return;
    }
    const ref = state;
    setTimeout(()=>{
      if(state!==ref) return; // campaign was restarted while this timer was pending
      enemyTurn();
    }, 700);
  }

  function enemyTurn(){
    const p = state.player, e = state.enemy;
    if(!e || e.hp<=0 || p.hp<=0){ state.turnLock=false; return; }
    state.turnCount++;
    let msg = '';
    if(e.charging){
      // unleash the telegraphed special attack
      e.charging = false;
      const raw = Math.round(e.atk * e.specialMult * rand(0.9,1.1));
      let dmg = Math.max(1, raw - p.def);
      if(state.playerDefending) dmg = Math.max(1, Math.round(dmg/2));
      p.hp = Math.max(0, p.hp - dmg);
      state.playerDefending = false;
      msg = `⚡ ${e.name} unleashes ${e.specialName} for ${dmg} damage!`;
      e.specialCooldown = 3;
      e.animPhase='power'; e.animTimer=0.45;
      SFX.punch();
      triggerHit(p, 200, GROUND_Y-70, '#e63946');
    } else if(e.specialCooldown<=0 && state.turnCount>=2 && Math.random()<0.3){
      // telegraph a special for next turn — no damage dealt this turn, so any
      // active Defend keeps holding until the real hit actually lands
      e.charging = true;
      msg = `⚠️ ${e.name} is winding up for ${e.specialName}!`;
      e.animPhase='idle';
    } else {
      if(e.specialCooldown>0) e.specialCooldown--;
      const raw = Math.round(e.atk * rand(0.85,1.15));
      let dmg = Math.max(1, raw - p.def);
      if(state.playerDefending) dmg = Math.max(1, Math.round(dmg/2));
      p.hp = Math.max(0, p.hp - dmg);
      state.playerDefending = false;
      msg = `${e.name} attacks for ${dmg} damage!`;
      e.animPhase='attack'; e.animTimer=0.35;
      SFX.punch();
      triggerHit(p, 200, GROUND_Y-70, '#e63946');
    }
    state.log = msg;
    if(state.powerCooldown>0) state.powerCooldown--;
    state.turnLock = false;
    buildDOM();
    if(p.hp<=0){
      finishBattleLose();
    }
  }

  function finishBattleWin(){
    const enemyName = state.enemy.name;
    const reward = 15 + state.battleNum*10;
    state.player.gold += reward;
    state.totalGold += reward;
    state.turnLock = true;
    SFX.victory();
    spawnSpark(state.particles, 600, GROUND_Y-70, '#ffd166', 18);
    buildDOM();
    const ref = state;
    setTimeout(()=>{
      if(state!==ref) return;
      if(state.battleNum>=5){
        recordRoundComplete();
        unlockAchievement('rpg_conqueror');
        showGameOverOverlay('rpgwars', state.totalGold, '👑 Kingdom Saved — War Hero!',
          `You defeated all 5 rivals, including ${enemyName}, and earned ${state.totalGold} gold along the way. The kingdom is saved!`,
          [
            {label:'Play Again', onClick:()=>{ state=fresh(); buildDOM(); hideOverlay(); }},
            {label:'Home', onClick: goHome}
          ]);
      } else {
        showOverlay('🎉 Victory!', `You defeated ${enemyName} and earned ${reward} gold!`, [
          {label:'Continue ▶', onClick:()=>{
            state.battleNum++;
            state.screen = 'prep';
            state.enemy = null;
            // a short camp rest between fights — recovers some HP, but not a full
            // heal, so surviving efficiently (and buying Max HP/Defense) still matters
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + Math.round(state.player.maxHp*0.2));
            state.turnLock = false;
            buildDOM();
            hideOverlay();
          }}
        ]);
      }
    }, 600);
  }

  function finishBattleLose(){
    const battleNum = state.battleNum;
    const totalGold = state.totalGold;
    const enemyName = state.enemy.name;
    state.turnLock = true;
    SFX.gameover();
    buildDOM();
    const ref = state;
    setTimeout(()=>{
      if(state!==ref) return;
      recordRoundComplete();
      showGameOverOverlay('rpgwars', totalGold, '💀 The Campaign Ends...',
        `${enemyName} defeated you on Battle ${battleNum} of 5. You earned ${totalGold} gold this run.`,
        [
          {label:'Retry Campaign', onClick:()=>{ state=fresh(); buildDOM(); hideOverlay(); }},
          {label:'Home', onClick: goHome}
        ]);
    }, 600);
  }

  function buyUpgrade(type){
    const p = state.player;
    let cost = 0;
    if(type==='hp') cost = 10;
    else if(type==='atk') cost = 12;
    else if(type==='def') cost = 10;
    if(p.gold < cost) return;
    p.gold -= cost;
    if(type==='hp'){ p.maxHp += 5; p.hp += 5; }
    else if(type==='atk'){ p.atk += 1; }
    else if(type==='def'){ p.def += 1; }
    SFX.coin();
    buildDOM();
  }

  /* ---------------- DOM (turn menu / camp shop) ---------------- */
  // Heights are set explicitly on every button style here (not left to the shared
  // .ctlBtn class, which defaults to a 62px circular-button height meant for the
  // big d-pad/jump buttons other games use). On a real phone the canvas area this
  // panel shares is only ~200-230px tall — four 62px-tall action buttons wrapping
  // to two rows alone would already blow that budget, silently pushing content
  // (in the worst case, the Attack button itself) up out of the visible, clipped
  // #domOverlay box. Every element below is sized so the common case fits in one
  // screen without scrolling; rpgPanel (see controlsHtml) is scrollable as a
  // fallback for extra-narrow/short viewports where wrapping still doesn't fit.
  function actBtnStyle(color, disabled){
    return `background:${color};color:#fff;font-weight:800;opacity:${disabled?0.4:1};`+
           `font-size:.76em;padding:0 10px;height:38px;`;
  }
  function shopBtnStyle(disabled){
    return `background:${disabled?'#c7ccd1':'#456990'};color:#fff;font-weight:800;font-size:.74em;`+
           `opacity:${disabled?0.6:1};padding:0 10px;height:36px;`;
  }
  function mainBtnStyle(){
    return `background:#ff8c42;color:#fff;font-weight:800;padding:0 22px;height:42px;font-size:.92em;`;
  }
  function badge(bg, text){
    return `<span style="background:${bg};border-radius:999px;padding:3px 9px;">${text}</span>`;
  }

  function prepHTML(){
    const p = state.player;
    const enemyDef = ENEMY_DEFS[Math.min(state.battleNum,5)-1];
    const title = state.battleNum===1 ? '🏕️ Prepare for War' : `🏕️ Camp — Battle ${state.battleNum} of 5 Ahead`;
    const btnLabel = state.battleNum===1 ? '⚔️ Start Battle 1' : `⚔️ Continue to Battle ${state.battleNum}`;
    return `
      <div style="text-align:center;">
        <div style="font-weight:800;font-size:1em;margin-bottom:3px;">${title}</div>
        <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;font-weight:700;font-size:.78em;margin-bottom:4px;">
          ${badge('#e9edf2', `❤️ HP ${p.hp}/${p.maxHp}`)}
          ${badge('#e9edf2', `⚔️ ATK ${p.atk}`)}
          ${badge('#e9edf2', `🛡️ DEF ${p.def}`)}
          ${badge('#fff3cd', `💰 ${p.gold}g`)}
        </div>
        <div style="font-size:.74em;color:#5a6b7a;margin-bottom:4px;">Next rival: <b>${escapeHtml(enemyDef.name)}</b></div>
        <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
          <button id="rpgBuyHp"  class="ctlBtn wide" style="${shopBtnStyle(p.gold<10)}" ${p.gold<10?'disabled':''}>+5 Max HP (10g)</button>
          <button id="rpgBuyAtk" class="ctlBtn wide" style="${shopBtnStyle(p.gold<12)}" ${p.gold<12?'disabled':''}>+1 Attack (12g)</button>
          <button id="rpgBuyDef" class="ctlBtn wide" style="${shopBtnStyle(p.gold<10)}" ${p.gold<10?'disabled':''}>+1 Defense (10g)</button>
        </div>
        <button id="rpgContinueBtn" class="ctlBtn wide" style="${mainBtnStyle()}">${btnLabel}</button>
      </div>`;
  }

  function battleHTML(){
    const locked = state.turnLock;
    const powerDisabled = locked || state.powerCooldown>0;
    const healDisabled = locked || state.healUses<=0;
    return `
      <div style="text-align:center;">
        <div style="min-height:18px;font-weight:700;font-size:.82em;color:#2b3a4a;margin-bottom:4px;">${escapeHtml(state.log||'')}</div>
        <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">
          <button id="rpgActAttack" class="ctlBtn wide" style="${actBtnStyle('#ff6b6b', locked)}" ${locked?'disabled':''}>⚔️ Attack</button>
          <button id="rpgActPower"  class="ctlBtn wide" style="${actBtnStyle('#9b5de5', powerDisabled)}" ${powerDisabled?'disabled':''}>💥 Power Strike${state.powerCooldown>0?` (${state.powerCooldown})`:''}</button>
          <button id="rpgActHeal"   class="ctlBtn wide" style="${actBtnStyle('#06d6a0', healDisabled)}" ${healDisabled?'disabled':''}>💚 Heal (${state.healUses} left)</button>
          <button id="rpgActDefend" class="ctlBtn wide" style="${actBtnStyle('#4ecdc4', locked)}" ${locked?'disabled':''}>🛡️ Defend</button>
        </div>
      </div>`;
  }

  function wirePrepButtons(){
    const hp = document.getElementById('rpgBuyHp');
    const atk = document.getElementById('rpgBuyAtk');
    const def = document.getElementById('rpgBuyDef');
    const cont = document.getElementById('rpgContinueBtn');
    if(hp) hp.addEventListener('click', ()=>buyUpgrade('hp'));
    if(atk) atk.addEventListener('click', ()=>buyUpgrade('atk'));
    if(def) def.addEventListener('click', ()=>buyUpgrade('def'));
    if(cont) cont.addEventListener('click', ()=>{ SFX.click(); startBattle(); });
  }
  function wireBattleButtons(){
    const map = {rpgActAttack:'attack', rpgActPower:'power', rpgActHeal:'heal', rpgActDefend:'defend'};
    Object.keys(map).forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.addEventListener('click', ()=>playerAction(map[id]));
    });
  }
  function buildDOM(){
    const panel = document.getElementById('rpgPanel');
    if(!panel) return;
    if(state.screen==='battle'){
      panel.innerHTML = battleHTML();
      wireBattleButtons();
    } else {
      panel.innerHTML = prepHTML();
      wirePrepButtons();
    }
  }

  /* ---------------- loop ---------------- */
  function update(dt){
    if(!state) return;
    state.clock += dt;
    state.shakeMag = Math.max(0, state.shakeMag - dt*45);
    state.hitFlash = Math.max(0, state.hitFlash - dt*3.2);
    updateParticles(state.particles, dt, 260);
    updateFighterAnim(state.player, dt);
    if(state.enemy) updateFighterAnim(state.enemy, dt);
  }

  function draw(g){
    drawGround('#bfe0ff','#eafff2');
    g.save();
    if(state.shakeMag>0.15){
      g.translate(rand(-state.shakeMag,state.shakeMag), rand(-state.shakeMag,state.shakeMag));
    }
    g.textAlign = 'center';
    g.fillStyle = '#1c2b3a';
    g.font = 'bold 20px "Trebuchet MS", sans-serif';
    g.fillText(state.screen==='battle' ? `⚔️ Battle ${state.battleNum} of 5` : '🏕️ War Camp', CW/2, 34);

    const p = state.player;
    drawStick(g, 200, GROUND_Y, 1.25, '#2b6cb0', 1, p.animPose, {
      expr: p.hp<=0 ? 'hurt' : (p.animPhase==='hurt' ? 'hurt' : (p.animPhase==='attack'||p.animPhase==='power' ? 'shout' : 'idle')),
      accessory:'band', accessoryColor:'#ffd166'
    });
    healthBar(120, GROUND_Y-165, 160, 16, p.maxHp>0 ? p.hp/p.maxHp : 0, '#06d6a0');
    g.font = 'bold 13px sans-serif';
    g.fillText('Hero', 200, GROUND_Y-172);
    g.fillText(`${Math.max(0,p.hp)}/${p.maxHp}`, 200, GROUND_Y-148);

    const e = state.enemy;
    if(e && state.screen==='battle'){
      drawStick(g, 600, GROUND_Y, e.scale||1.25, e.color, -1, e.animPose, {
        expr: e.hp<=0 ? 'hurt' : (e.animPhase==='hurt' ? 'hurt' : (e.animPhase==='attack'||e.animPhase==='power' ? 'shout' : 'idle')),
        accessory: e.accessory, accessoryColor: e.accessoryColor
      });
      healthBar(520, GROUND_Y-165, 160, 16, e.maxHp>0 ? Math.max(0,e.hp)/e.maxHp : 0, '#ff6b6b');
      g.fillText(e.name, 600, GROUND_Y-172);
      g.fillText(`${Math.max(0,e.hp)}/${e.maxHp}`, 600, GROUND_Y-148);
      if(e.charging){
        g.fillStyle = '#e63946';
        g.font = 'bold 16px sans-serif';
        g.fillText('⚠️ Charging a big attack!', 600, GROUND_Y-195);
      }
    }
    drawSparks(g, state.particles);
    g.restore();
    if(state.hitFlash>0.02){
      g.fillStyle = `rgba(255,255,255,${state.hitFlash*0.3})`;
      g.fillRect(0,0,CW,CH);
    }
    g.textAlign = 'left';
  }

  return {
    title: 'Stick RPG Wars',
    hint: 'Battle 5 rivals turn-by-turn — attack, defend, heal, and upgrade between fights!',
    domOverlay: true,
    controlsHtml: `
      <div id="rpgWrap" style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;box-sizing:border-box;overflow:hidden;">
        <div id="rpgPanel" style="width:100%;max-width:660px;max-height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;background:rgba(255,255,255,0.97);border-radius:16px;padding:8px 12px;box-shadow:0 4px 0 rgba(0,0,0,0.15);box-sizing:border-box;"></div>
      </div>`,
    bindControls(){ buildDOM(); },
    create(){ state = fresh(); return this; },
    restart(){ state = fresh(); buildDOM(); hideOverlay(); },
    update, draw,
  };
}
