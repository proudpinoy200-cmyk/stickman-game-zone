"use strict";
/* =========================================================
   STICKMAN GAME ZONE — shared engine + 5 mini games
   ========================================================= */
const CW = 800, CH = 450, GROUND_Y = 380;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const homeScreen = document.getElementById('homeScreen');
const gameScreen = document.getElementById('gameScreen');
const gTitle = document.getElementById('gTitle');
const touchControls = document.getElementById('touchControls');
const hintText = document.getElementById('hintText');
const overlayMsg = document.getElementById('overlayMsg');
const domOverlay = document.getElementById('domOverlay');
const omTitle = document.getElementById('omTitle');
const omText = document.getElementById('omText');
const omBtns = document.getElementById('omBtns');

let keys = {};
let pointer = { down:false, x:0, y:0, startX:0, startY:0, trail:[] };
let currentGame = null;
let rafId = null;
let lastTime = 0;
let activeGameId = null;

// Stickman Quest gets its own licensed background track (a real recorded loop,
// distinct from the procedural chiptune BGM used everywhere else) — preloaded up
// front so it's ready to go the instant the player enters the level, looped since
// it's meant to run for the whole play session, and kept a bit quieter than a lead
// track since it's just atmosphere behind the SFX.
const questBgm = new Audio('quest-bgm.mp3');
questBgm.loop = true;
questBgm.volume = 0.4;
questBgm.preload = 'auto';

function deg(a){ return a*Math.PI/180; }
function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function dist(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); }
function lerp(a,b,t){ return a+(b-a)*t; }
function easeOutQuad(t){ return 1-(1-t)*(1-t); }
function easeOutBack(t){ const c1=1.70158,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); }
function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
// exponential smoothing factor for a given "speed" and frame delta — converges fast but never snaps
function smoothT(rate,dt){ return 1-Math.exp(-rate*dt); }
function lerpPose(cur,target,t){
  cur.legF = lerp(cur.legF,target.legF,t);
  cur.legB = lerp(cur.legB,target.legB,t);
  cur.armF = lerp(cur.armF,target.armF,t);
  cur.armB = lerp(cur.armB,target.armB,t);
  cur.lean = lerp(cur.lean,target.lean,t);
  cur.headBob = lerp(cur.headBob||0,target.headBob||0,t);
  return cur;
}
function clonePose(p){ return {legF:p.legF,legB:p.legB,armF:p.armF,armB:p.armB,lean:p.lean,headBob:p.headBob||0}; }

/* ---------------- Sound engine (synthesized — no external audio files needed) ---------------- */
const SFX = (function(){
  let actx = null, master = null, muted = false;
  // iOS Safari (and many in-app/webview browsers on phones) will report an AudioContext
  // as "running" after resume() yet still play nothing until a real buffer has actually
  // been started inside a user-gesture callback — the classic "silent buffer" unlock trick.
  function unlockBuffer(c){
    try{
      const buf = c.createBuffer(1,1,22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      if(src.start) src.start(0); else src.noteOn(0);
    }catch(e){}
  }
  function ensure(){
    if(!actx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(actx.destination);
      unlockBuffer(actx);
    }
    if(actx.state==='suspended') actx.resume().catch(()=>{});
    return actx;
  }
  function tone({freq=440,dur=0.12,type='sine',vol=0.3,glideTo=null,delay=0}={}){
    const c = ensure(); if(!c) return;
    try{
      const t0 = c.currentTime+delay;
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(freq,1), t0);
      if(glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo,1), t0+dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0+dur);
      osc.connect(gain); gain.connect(master);
      osc.start(t0); osc.stop(t0+dur+0.03);
    }catch(e){}
  }
  function noise({dur=0.15,vol=0.3,filterFreq=1500,filterType='bandpass',delay=0}={}){
    const c = ensure(); if(!c) return;
    try{
      const t0 = c.currentTime+delay;
      const n = Math.max(1,Math.floor(c.sampleRate*dur));
      const buf = c.createBuffer(1,n,c.sampleRate);
      const data = buf.getChannelData(0);
      for(let i=0;i<n;i++) data[i] = (Math.random()*2-1)*(1-i/n);
      const src = c.createBufferSource(); src.buffer = buf;
      const filt = c.createBiquadFilter(); filt.type = filterType; filt.frequency.value = filterFreq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0+dur);
      src.connect(filt); filt.connect(gain); gain.connect(master);
      src.start(t0); src.stop(t0+dur+0.03);
    }catch(e){}
  }
  return {
    unlock(){ const c = ensure(); if(c) unlockBuffer(c); },
    isMuted(){ return muted; },
    toggleMute(){ muted = !muted; if(master) master.gain.value = muted?0:0.55; return muted; },
    sword(){ tone({freq:1150,dur:0.07,type:'square',vol:0.16}); tone({freq:1700,dur:0.05,type:'square',vol:0.1,delay:0.03}); noise({dur:0.07,vol:0.13,filterFreq:3200}); },
    swordMiss(){ noise({dur:0.09,vol:0.09,filterFreq:2200,filterType:'highpass'}); },
    punch(){ tone({freq:150,dur:0.09,type:'sine',vol:0.28,glideTo:60}); noise({dur:0.05,vol:0.18,filterFreq:900}); },
    kick(){ tone({freq:110,dur:0.13,type:'sine',vol:0.3,glideTo:45}); noise({dur:0.07,vol:0.2,filterFreq:600}); },
    block(){ tone({freq:750,dur:0.07,type:'triangle',vol:0.18}); tone({freq:500,dur:0.05,type:'triangle',vol:0.1,delay:0.02}); },
    hurt(){ tone({freq:320,dur:0.14,type:'sawtooth',vol:0.16,glideTo:130}); },
    step(){ noise({dur:0.03,vol:0.045,filterFreq:350}); },
    jump(){ tone({freq:320,dur:0.15,type:'sine',vol:0.2,glideTo:680}); },
    land(){ noise({dur:0.07,vol:0.14,filterFreq:300,filterType:'lowpass'}); },
    coin(){ tone({freq:880,dur:0.07,type:'triangle',vol:0.22}); tone({freq:1320,dur:0.11,type:'triangle',vol:0.2,delay:0.06}); },
    gameover(){ tone({freq:420,dur:0.22,type:'sawtooth',vol:0.18,glideTo:260,delay:0}); tone({freq:260,dur:0.4,type:'sawtooth',vol:0.16,glideTo:90,delay:0.18}); },
    levelup(){ [523,659,784].forEach((f,i)=>tone({freq:f,dur:0.16,type:'triangle',vol:0.2,delay:i*0.09})); },
    victory(){ [523,659,784,1046].forEach((f,i)=>tone({freq:f,dur:0.22,type:'triangle',vol:0.24,delay:i*0.12})); },
    bounce(){ tone({freq:200,dur:0.07,type:'sine',vol:0.13,glideTo:100}); },
    swish(){ [1046,1318,1568].forEach((f,i)=>tone({freq:f,dur:0.12,type:'sine',vol:0.18,delay:i*0.05})); },
    whoosh(){ noise({dur:0.14,vol:0.15,filterFreq:2200,filterType:'highpass'}); },
    slice(){ noise({dur:0.08,vol:0.2,filterFreq:2600,filterType:'bandpass'}); tone({freq:1500,dur:0.06,type:'sine',vol:0.09,glideTo:2200}); },
    bomb(){ noise({dur:0.32,vol:0.32,filterFreq:400,filterType:'lowpass'}); tone({freq:90,dur:0.32,type:'sawtooth',vol:0.22,glideTo:40}); },
    click(){ tone({freq:620,dur:0.045,type:'square',vol:0.1}); },
    flip(){ tone({freq:780,dur:0.06,type:'triangle',vol:0.15}); },
    match(){ tone({freq:1046,dur:0.1,type:'triangle',vol:0.2}); tone({freq:1318,dur:0.12,type:'triangle',vol:0.18,delay:0.08}); },
    beep(){ tone({freq:880,dur:0.08,type:'square',vol:0.1}); },
    wrong(){ tone({freq:260,dur:0.15,type:'sawtooth',vol:0.12}); },
    stomp(){ noise({dur:0.1,vol:0.2,filterFreq:400,filterType:'lowpass'}); tone({freq:120,dur:0.08,type:'sine',vol:0.22}); },
    fire(){ tone({freq:220,dur:0.1,type:'sawtooth',vol:0.16,glideTo:520}); noise({dur:0.1,vol:0.14,filterFreq:2000,filterType:'bandpass'}); },
    powerup(){ tone({freq:660,dur:0.09,type:'triangle',vol:0.2}); tone({freq:990,dur:0.13,type:'triangle',vol:0.18,delay:0.05}); },
  };
})();

/* ---------------- Lightweight particle helpers (dust/sparks) shared across games ---------------- */
function makeParticlePool(){ return []; }
function spawnDust(list,x,y,n=4){
  for(let i=0;i<n;i++) list.push({x:x+rand(-6,6),y:y+rand(-2,2),vx:rand(-40,40),vy:rand(-70,-10),life:1,r:rand(2,4),color:'rgba(255,255,255,0.7)'});
}
function spawnSpark(list,x,y,color,n=8){
  for(let i=0;i<n;i++){
    const a = rand(0,Math.PI*2);
    list.push({x,y,vx:Math.cos(a)*rand(60,180),vy:Math.sin(a)*rand(60,180),life:1,len:rand(4,9),color});
  }
}
function updateParticles(list,dt,gravity=260){
  for(const p of list){ p.vy+=gravity*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt*2.2; }
  for(let i=list.length-1;i>=0;i--) if(list[i].life<=0) list.splice(i,1);
}
function drawDust(g,list){
  list.forEach(p=>{
    g.globalAlpha = clamp(p.life,0,1)*0.6;
    g.fillStyle = p.color;
    g.beginPath(); g.arc(p.x,p.y,p.r,0,Math.PI*2); g.fill();
  });
  g.globalAlpha = 1;
}
function drawSparks(g,list){
  g.lineCap='round';
  list.forEach(p=>{
    g.globalAlpha = clamp(p.life,0,1);
    g.strokeStyle = p.color; g.lineWidth = 2.5;
    const dx = p.vx*0.03, dy = p.vy*0.03;
    g.beginPath(); g.moveTo(p.x,p.y); g.lineTo(p.x-dx,p.y-dy); g.stroke();
  });
  g.globalAlpha = 1;
}

/* ---------------- Stick figure renderer ---------------- */
// pose angles in degrees, canvas convention: 0=right,90=down,-90=up,180=left
// opts: {expr:'idle'|'happy'|'hurt'|'shout', accessory:'band'|'mask'|null, accessoryColor}
function drawStick(g, x, y, scale, color, facing, pose, opts){
  opts = opts || {};
  const s = scale;
  const expr = opts.expr || 'idle';
  g.save();
  g.translate(x,y);
  g.scale(facing,1);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 5.5*s;
  g.lineCap = 'round';
  function seg(x1,y1,ang,len){
    const x2 = x1+Math.cos(deg(ang))*len, y2 = y1+Math.sin(deg(ang))*len;
    g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
    return {x:x2,y:y2};
  }
  // back leg + arm drawn first (behind)
  seg(0,0,pose.legB,34*s);
  const shoulder = seg(0,0,pose.lean,36*s);
  seg(shoulder.x,shoulder.y,pose.armB,26*s);
  // front leg
  seg(0,0,pose.legF,34*s);

  // neck — short segment continuing the torso lean, so the head reads as clearly separate
  const neckLen = 7.5*s;
  const neckTop = seg(shoulder.x,shoulder.y,pose.lean,neckLen);

  // head (bigger, sits on top of the neck)
  const headR = 14.5*s;
  const bob = (pose.headBob||0)*s;
  const hcx = neckTop.x, hcy = neckTop.y - headR*0.55 + bob;
  g.beginPath(); g.arc(hcx,hcy,headR,0,Math.PI*2); g.fill();

  // hair tuft for personality
  g.beginPath();
  g.moveTo(hcx-headR*0.55, hcy-headR*0.78);
  g.lineTo(hcx-headR*0.1, hcy-headR*1.3);
  g.lineTo(hcx+headR*0.35, hcy-headR*0.82);
  g.closePath(); g.fill();

  // accessory: headband or ninja mask
  if(opts.accessory==='band'){
    g.strokeStyle = opts.accessoryColor||'#fff';
    g.lineWidth = 3.4*s;
    g.beginPath(); g.arc(hcx,hcy,headR*0.74, deg(195), deg(345)); g.stroke();
    // little ribbon tail flying off the back
    g.beginPath();
    g.moveTo(hcx-headR*0.7, hcy-headR*0.05);
    g.lineTo(hcx-headR*1.15, hcy+headR*0.15);
    g.stroke();
  } else if(opts.accessory==='mask'){
    g.fillStyle = opts.accessoryColor||'#1c2b3a';
    g.beginPath();
    g.moveTo(hcx-headR*0.95, hcy+headR*0.05);
    g.quadraticCurveTo(hcx, hcy+headR*0.62, hcx+headR*0.95, hcy+headR*0.05);
    g.quadraticCurveTo(hcx, hcy+headR*0.32, hcx-headR*0.95, hcy+headR*0.05);
    g.fill();
  }

  // face — eye + pupil (profile style) + mouth, local +x = forward (facing already applied via ctx.scale)
  const eyeX = hcx + headR*0.34, eyeY = hcy - headR*0.02;
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(eyeX,eyeY,headR*0.23,0,Math.PI*2); g.fill();
  g.fillStyle = '#1c2b3a';
  const pupilOff = expr==='hurt' ? -headR*0.06 : headR*0.09;
  g.beginPath(); g.arc(eyeX+pupilOff, eyeY, headR*0.115, 0, Math.PI*2); g.fill();

  g.strokeStyle = '#1c2b3a'; g.lineWidth = 1.8*s; g.lineCap='round';
  if(expr==='hurt'){
    g.beginPath(); g.arc(eyeX-headR*0.1, eyeY+headR*0.48, headR*0.26, deg(200), deg(340)); g.stroke();
  } else if(expr==='shout'){
    g.beginPath(); g.ellipse(eyeX-headR*0.02, eyeY+headR*0.5, headR*0.15, headR*0.21, 0, 0, Math.PI*2);
    g.fillStyle='#1c2b3a'; g.fill();
  } else {
    g.beginPath(); g.arc(eyeX-headR*0.06, eyeY+headR*0.3, headR*0.22, deg(15), deg(165)); g.stroke();
  }

  // front arm (drawn last so it's on top, e.g. holding weapon)
  const hand = seg(shoulder.x,shoulder.y,pose.armF,26*s);
  g.restore();
  // return world-space attachment points
  return {
    shoulder: {x: x+facing*shoulder.x, y: y+shoulder.y},
    hand: {x: x+facing*hand.x, y: y+hand.y},
    head: {x: x+facing*hcx, y: y+hcy},
    footF: {x: x+facing*Math.cos(deg(pose.legF))*34*s, y: y+Math.sin(deg(pose.legF))*34*s},
  };
}

function drawGround(grad1,grad2){
  const g = ctx.createLinearGradient(0,0,0,CH);
  g.addColorStop(0,grad1||'#bfe9ff');
  g.addColorStop(1,grad2||'#e8fff2');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle = '#7cc576';
  ctx.fillRect(0,GROUND_Y,CW,CH-GROUND_Y);
  ctx.fillStyle = '#5fa85a';
  ctx.fillRect(0,GROUND_Y,CW,8);
}
// Plain gradient fill, no green "ground" floor band. Used by the DOM-overlay games
// (Memory Match, Reaction Time) whose actual play surface is HTML on top of the
// canvas, not the canvas itself — drawGround()'s floor strip served no purpose for
// them and was a visible bleed-through risk if the DOM overlay ever didn't cover
// the canvas down to the exact last pixel on a given device.
function drawFlatBg(grad1,grad2){
  const g = ctx.createLinearGradient(0,0,0,CH);
  g.addColorStop(0,grad1||'#bfe9ff');
  g.addColorStop(1,grad2||'#e8fff2');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,CW,CH);
}

function healthBar(x,y,w,h,pct,color){
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.fillStyle = '#e2e2e2';
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle = color;
  ctx.fillRect(x,y,w*clamp(pct,0,1),h);
  ctx.strokeStyle = '#1c2b3a'; ctx.lineWidth=2;
  ctx.strokeRect(x,y,w,h);
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* ---------------- Overlay helpers ---------------- */
function showOverlay(title, text, buttons){
  omTitle.textContent = title;
  omText.textContent = text;
  omBtns.innerHTML = '';
  buttons.forEach(b=>{
    const btn = document.createElement('button');
    btn.className = 'obtn';
    btn.textContent = b.label;
    btn.onclick = ()=>{ SFX.click(); b.onClick(); };
    omBtns.appendChild(btn);
  });
  overlayMsg.style.display = 'flex';
}
function hideOverlay(){ overlayMsg.style.display = 'none'; }

/* ---------------- Leaderboard (local, per-device — stored right in this browser) ---------------- */
// Every player who finishes a run on THIS device/browser can save their name next to their
// score. There's no server behind this — it's the same localStorage trick PROG already uses
// for star progress — so a leaderboard only shows scores set on that particular phone/browser,
// not everyone who's ever played the site. Good enough for "can I beat my own/my sibling's
// best?" bragging rights without needing any backend at all.
const LB = (function(){
  const KEY = 'stickman_zone_leaderboard';
  const MAX_ENTRIES = 5;
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; } }
  function save(data){ try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){} }
  function getScores(gameId){
    const d = load();
    return (d[gameId] || []).slice(0, MAX_ENTRIES);
  }
  function qualifies(gameId, score, higherIsBetter){
    const list = getScores(gameId);
    if(list.length < MAX_ENTRIES) return true;
    const worst = list[list.length-1].score;
    return higherIsBetter ? score > worst : score < worst;
  }
  function addScore(gameId, name, score, higherIsBetter){
    const d = load();
    const list = d[gameId] || [];
    list.push({name, score});
    list.sort((a,b)=> higherIsBetter ? b.score - a.score : a.score - b.score);
    d[gameId] = list.slice(0, MAX_ENTRIES);
    save(d);
  }
  return { getScores, qualifies, addScore };
})();

// LB_GAMES (which games have a leaderboard, whether lower/higher scores win, and how to
// format a raw score into a display string) is defined later in part6.js once all the game
// ids/names exist — but since these functions are only ever CALLED from user interaction
// after every script has finished loading, referencing LB_GAMES here (before it's declared)
// is safe: by the time a player actually finishes a game, part6.js has long since run.
function buildLeaderboardList(gameId, cfg){
  const entries = LB.getScores(gameId);
  const ol = document.createElement('ol');
  ol.className = 'lbList';
  if(!entries.length){
    const li = document.createElement('li');
    li.className = 'lbEmpty';
    li.textContent = 'No scores yet — be the first!';
    ol.appendChild(li);
  } else {
    entries.forEach((e,i)=>{
      const li = document.createElement('li');
      const rank = document.createElement('span'); rank.className='lbRank'; rank.textContent=(i+1)+'.';
      const name = document.createElement('span'); name.className='lbName'; name.textContent=e.name;
      const sc = document.createElement('span'); sc.className='lbScore'; sc.textContent=cfg.format(e.score);
      li.appendChild(rank); li.appendChild(name); li.appendChild(sc);
      ol.appendChild(li);
    });
  }
  return ol;
}
function showLeaderboardOverlay(gameId, cfg, buttons){
  omTitle.textContent = '🏆 Leaderboard — ' + cfg.name;
  omText.innerHTML = '';
  omText.appendChild(buildLeaderboardList(gameId, cfg));
  omBtns.innerHTML = '';
  buttons.forEach(b=>{
    const btn = document.createElement('button');
    btn.className = 'obtn';
    btn.textContent = b.label;
    btn.onclick = ()=>{ SFX.click(); b.onClick(); };
    omBtns.appendChild(btn);
  });
  overlayMsg.style.display = 'flex';
}
function showScoreEntryOverlay(gameId, score, cfg, buttons){
  omTitle.textContent = '🏆 New High Score!';
  omText.innerHTML = '';
  const p = document.createElement('p');
  p.style.margin = '4px 0 10px';
  p.textContent = 'Score: ' + cfg.format(score);
  omText.appendChild(p);
  const input = document.createElement('input');
  input.type = 'text'; input.maxLength = 14; input.placeholder = 'Enter your name'; input.className = 'lbInput';
  input.autocomplete = 'off';
  omText.appendChild(input);
  omBtns.innerHTML = '';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'obtn';
  saveBtn.textContent = 'Save Score';
  const doSave = ()=>{
    const name = (input.value||'').trim().slice(0,14) || 'Player';
    LB.addScore(gameId, name, score, cfg.higherIsBetter);
    SFX.click();
    showLeaderboardOverlay(gameId, cfg, buttons);
  };
  saveBtn.onclick = doSave;
  input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); doSave(); } });
  omBtns.appendChild(saveBtn);
  overlayMsg.style.display = 'flex';
  setTimeout(()=>{ input.focus(); }, 60);
}
// Drop-in replacement for showOverlay() at a game's true "run is over" moment (not mid-campaign
// checkpoints like "Level Complete"). Looks up gameId in LB_GAMES; if that game isn't registered
// there, it just behaves exactly like a plain showOverlay(). Otherwise: a qualifying score goes
// straight to the name-entry prompt, and a non-qualifying one gets a normal game-over overlay
// with an extra "🏆 Leaderboard" button so the player can still see how they stack up.
function showGameOverOverlay(gameId, score, title, text, buttons){
  const cfg = (typeof LB_GAMES !== 'undefined') ? LB_GAMES.find(g=>g.id===gameId) : null;
  if(!cfg){ showOverlay(title, text, buttons); return; }
  if(LB.qualifies(gameId, score, cfg.higherIsBetter)){
    showScoreEntryOverlay(gameId, score, cfg, buttons);
  } else {
    const withLb = buttons.concat([{label:'🏆 Leaderboard', onClick:()=>{ showLeaderboardOverlay(gameId, cfg, buttons); }}]);
    showOverlay(title, text, withLb);
  }
}

/* ---------------- Toasts (short-lived "dopamine" pop-ups) ---------------- */
// Small, non-blocking messages that celebrate something the player just did (first
// time trying a game, a session streak, an achievement). Auto-creates its own
// container the first time it's called so no HTML markup is required, though a
// dedicated #toastContainer also lives in index.html for CSS anchoring.
function showToast(msg, opts){
  opts = opts || {};
  let container = document.getElementById('toastContainer');
  if(!container){
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (opts.big ? ' toastBig' : '');
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  const life = opts.duration || 2600;
  setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(()=>t.remove(), 400);
  }, life);
}

/* ---------------- Play history / "Continue Playing" tracking (local only) ---------------- */
// Tracks which games have been played, how many times, when last, and which
// calendar days (device-local dates) the site was opened on — all without any
// server, purely to power "Continue Playing", session streak toasts, and a
// couple of the achievement conditions.
const CONT = (function(){
  const KEY = 'stickman_zone_history';
  function load(){
    try{
      const d = JSON.parse(localStorage.getItem(KEY));
      if(d && d.games && d.days) return d;
    }catch(e){}
    return {games:{}, days:[]};
  }
  function save(d){ try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){} }
  function todayKey(){ const d = new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function recordPlay(gameId){
    const d = load();
    const prev = d.games[gameId] || {count:0};
    d.games[gameId] = { last: Date.now(), count: prev.count + 1 };
    const t = todayKey();
    if(!d.days.includes(t)) d.days.push(t);
    save(d);
    return d;
  }
  function getRecent(limit){
    const d = load();
    return Object.keys(d.games).map(id=>({id, last:d.games[id].last, count:d.games[id].count}))
      .sort((a,b)=>b.last-a.last).slice(0, limit||6);
  }
  function getPlayCount(gameId){ const d=load(); return (d.games[gameId]&&d.games[gameId].count)||0; }
  function getTotalPlays(){ const d=load(); return Object.values(d.games).reduce((s,v)=>s+(v.count||0),0); }
  function getGamesPlayedCount(){ const d=load(); return Object.keys(d.games).length; }
  function getDaysPlayed(){ const d=load(); return d.days.length; }
  function getDayStreak(){
    const d = load();
    const daySet = new Set(d.days);
    let streak = 0;
    const cur = new Date();
    while(true){
      const key = cur.getFullYear()+'-'+(cur.getMonth()+1)+'-'+cur.getDate();
      if(daySet.has(key)){ streak++; cur.setDate(cur.getDate()-1); } else break;
    }
    return streak;
  }
  function getMostPlayed(limit){
const d = load();
return Object.keys(d.games).map(id=>({id, count:(d.games[id]&&d.games[id].count)||0}))
.filter(r=>r.count>0)
.sort((a,b)=>b.count-a.count)
.slice(0, limit||6);
}
return { recordPlay, getRecent, getPlayCount, getTotalPlays, getGamesPlayedCount, getDaysPlayed, getDayStreak, getMostPlayed };
})();

/* ---------------- Favorites (❤️, local only) ---------------- */
const FAV = (function(){
  const KEY = 'stickman_zone_favorites';
  function load(){ try{ const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
  function save(a){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(e){} }
  function isFav(id){ return load().includes(id); }
  function toggle(id){
    let list = load();
    if(list.includes(id)) list = list.filter(x=>x!==id);
    else list.push(id);
    save(list);
    return list.includes(id);
  }
  function getAll(){ return load(); }
  return { isFav, toggle, getAll };
})();

/* ---------------- Achievements (local only, no accounts needed) ---------------- */
// Unlocked achievement ids just live in localStorage as a flat list. ACH_DEFS (the
// human-readable name/icon/description for each id) is declared later in part6.js —
// same deferred-reference pattern as LB_GAMES above, safe because unlockAchievement()
// is only ever called from real gameplay, long after every script has loaded.
const ACH = (function(){
  const KEY = 'stickman_zone_achievements';
  function load(){ try{ const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
  function save(a){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(e){} }
  function isUnlocked(id){ return load().includes(id); }
  function unlock(id){
    const list = load();
    if(list.includes(id)) return false;
    list.push(id);
    save(list);
    return true;
  }
  function getAll(){ return load(); }
  function getCount(){ return load().length; }
  return { isUnlocked, unlock, getAll, getCount };
})();
function unlockAchievement(id){
  const def = (typeof ACH_DEFS !== 'undefined') ? ACH_DEFS.find(a=>a.id===id) : null;
  if(!def) return;
  if(ACH.unlock(id)){
    showToast('🏆 Achievement unlocked: ' + def.name, {duration: 3400, big:true});
    SFX.levelup();
  }
}
// Call once from a game's true "round is over" moment (win OR lose — any completed
// attempt counts) to power the "played N rounds" achievements.
function recordRoundComplete(){
  const KEY = 'stickman_zone_rounds';
  let n = 0;
  try{ n = parseInt(localStorage.getItem(KEY)||'0',10)||0; }catch(e){}
  n++;
  try{ localStorage.setItem(KEY, String(n)); }catch(e){}
  if(n===10) unlockAchievement('dedicated_10');
  if(n===50) unlockAchievement('dedicated_50');
  return n;
}

// Session-only streak of games opened (resets on page reload — that's fine, it's
// meant to reward "one sitting" play, not cross-visit tracking, which getDayStreak
// already covers separately).
let sessionStreak = 0;
const TOAST_FLAVORS = ['🎉 Nice choice!','🚀 Let\'s go!','✨ Have fun!','🎮 Game on!','😄 Enjoy!'];
function onGameStart(id){
  const isFirstEverPlay = CONT.getTotalPlays() === 0;
  const isFirstTimeThisGame = CONT.getPlayCount(id) === 0;
  CONT.recordPlay(id);
  sessionStreak++;
  if(isFirstEverPlay) unlockAchievement('first_steps');
  if(CONT.getGamesPlayedCount() >= (typeof CARD_DATA!=='undefined'?CARD_DATA.length:11)) unlockAchievement('explorer');
  if(CONT.getDaysPlayed() >= 2) unlockAchievement('return_player');
  if(CONT.getDaysPlayed() >= 5) unlockAchievement('week_regular');
  if(FAV.getAll().length >= 3) unlockAchievement('favorite_fan');
  if(sessionStreak === 3) unlockAchievement('streak_3');
  if(sessionStreak === 10) unlockAchievement('streak_10');
  if(isFirstTimeThisGame && !isFirstEverPlay){
    showToast('⭐ You found a hidden favorite!');
  } else if(sessionStreak===3){
    showToast('🔥 You\'re on a 3-game streak!');
  } else if(sessionStreak>3 && sessionStreak%5===0){
    showToast('🔥 '+sessionStreak+'-game streak! Keep going!');
  } else if(!isFirstEverPlay && Math.random()<0.55){
    showToast(TOAST_FLAVORS[Math.floor(Math.random()*TOAST_FLAVORS.length)]);
  }
}

/* ---------------- Touch control builder ---------------- */
function setControls(html){ touchControls.innerHTML = html; }
// Some games (Memory Match, Reaction Time) have a fully DOM-based game area
// instead of drawing their play area on the canvas. Those render inside the
// canvas panel itself (#domOverlay, layered on top of the canvas) rather than
// in the small button-strip area below it, so the game area reads as part of
// the "big screen" instead of a separate box underneath.
function setGameArea(factory){
  if(factory.domOverlay){
    touchControls.innerHTML = '';
    domOverlay.innerHTML = factory.controlsHtml || '';
    domOverlay.classList.add('active');
  } else {
    domOverlay.classList.remove('active');
    domOverlay.innerHTML = '';
    setControls(factory.controlsHtml || '');
  }
}
function bindHoldBtn(id, keyName){
  const el = document.getElementById(id);
  if(!el) return;
  const on = e=>{ e.preventDefault(); SFX.unlock(); keys[keyName]=true; };
  const off = e=>{ e.preventDefault(); keys[keyName]=false; };
  el.addEventListener('pointerdown',on);
  el.addEventListener('pointerup',off);
  el.addEventListener('pointerleave',off);
  el.addEventListener('pointercancel',off);
  // Belt-and-suspenders against iOS Safari's press-and-hold text-selection loupe / copy
  // callout showing up on repeated-press control buttons (the CSS touch-callout/user-select
  // rules handle most cases, but suppressing the actual contextmenu event too closes the gap).
  el.addEventListener('contextmenu', e=>e.preventDefault());
}
function bindTapBtn(id, fn){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('pointerdown', e=>{ e.preventDefault(); SFX.unlock(); fn(); });
  el.addEventListener('contextmenu', e=>e.preventDefault());
}

/* ---------------- Main loop ---------------- */
function loop(ts){
  if(!currentGame){ return; }
  const dt = Math.min((ts-lastTime)/1000, 0.05) || 0.016;
  lastTime = ts;
  try {
    currentGame.update(dt);
    currentGame.draw(ctx);
  } catch(err){
    console.error('Game loop error:', err);
  }
  rafId = requestAnimationFrame(loop);
}

function startGame(id){
  const factory = GAMES[id];
  const splashInfo = {
    sword:{icon:'⚔️',title:'Sword Duel',sub:'Face 5 opponents. One blade.'},
    martial:{icon:'🥋',title:'Dojo Kicks',sub:'Punch & kick to Black Belt.'},
    runner:{icon:'🏃',title:'Stickman Dash',sub:'Run forever. Dodge everything.'},
    hoops:{icon:'🏀',title:'Hoop Shootout',sub:'Swish before time runs out.'},
    ninja:{icon:'🍉',title:'Ninja Fruit Slice',sub:'Swipe. Slice. Survive.'},
    memory:{icon:'🧠',title:'Memory Match',sub:'Find the pairs!'},
    reaction:{icon:'⚡',title:'Reaction Time',sub:'Tap fast!'},
    platformer:{icon:'🏁',title:'Stickman Quest',sub:'Collect coins, reach the flag!'},
    bubble:{icon:'🫧',title:'Bubble Shooter',sub:'Match 3+ to pop the bubbles!'},
    racer:{icon:'🏎️',title:'Stickman Racer',sub:'Dodge hurdles. Win the race!'},
    galaxy:{icon:'👾',title:'Stick Galaxy',sub:'Blast aliens across 10 luminous waves — new ship every wave!'},
    sniper:{icon:'🎯',title:'Stick Sharpshooter',sub:'Deactivate 10 rogue robots before time runs out!'},
    archery:{icon:'🏹',title:'Stick Archery Royale',sub:'10 enter. Only one walks away.'},
    swimmer:{icon:'🏊',title:'Stick Swimmer Olympics',sub:'3 races. Podium or bust!'},
    tycoon:{icon:'💰',title:'Coin Rush Tycoon',sub:'Tap for gold. Dodge the goblin!'},
    fortdefense:{icon:'🏰',title:'Stick Fort Defense',sub:'Defend 3 lanes. Beat the boss wave!'},
  blockpuzzle:{icon:'🧩',title:'Block Puzzle',sub:'Clear rows and columns before the board fills up!'},
  coloring:{icon:'🎨',title:'Coloring Studio',sub:'Pick a color and create something fun!'},
  wordscramble:{icon:'🔤',title:'Word Scramble',sub:'Unscramble the letters to spell each word!'},
  whackamole:{icon:'🔨',title:'Whack-a-Mole',sub:'Whack fast — dodge the bandit!'},
  };
  const si = splashInfo[id]||{icon:'🎮',title:factory.title,sub:''};
  showSplash(si.icon, si.title, si.sub, 1100).then(()=>{
    homeScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    // Whatever scroll position the player was at on the home page (very likely
    // scrolled down — they had to find and tap the game's card, which for
    // games further down the grid can mean a long scroll) otherwise carries
    // straight into the game screen. Since the game screen is usually shorter
    // than that scroll offset, the browser clamps it to the new max, which can
    // visually look like the game "jumped to the bottom of the page" the moment
    // play starts — reported by players as controls (e.g. spacebar) scrolling
    // them away, even though the actual jump happens right here on game entry.
    window.scrollTo(0, 0);
    hideOverlay();
    keys = {};
    gTitle.textContent = factory.title;
    hintText.textContent = factory.hint || '';
    setGameArea(factory);
    currentGame = factory.create();
    factory.bindControls && factory.bindControls();
    lastTime = performance.now();
    if(rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    onGameStart(id);
    updateFavBtn();
    renderRelatedGames(id);
    // Stickman Quest swaps in its own track in place of the ambient chiptune BGM
    // (having both running together just muddies the mix) — pause the other one
    // out whichever direction we're switching, and only actually start playback
    // if sound isn't muted, so this never fights the mute button's silence.
    activeGameId = id;
    if(id === 'platformer'){
      BGM.stop();
      if(!SFX.isMuted()) questBgm.play().catch(()=>{});
    } else {
      questBgm.pause();
      if(bgmStarted && !SFX.isMuted()) BGM.start();
    }
  });
}
function goHome(){
  currentGame = null;
  activeGameId = null;
  if(rafId) cancelAnimationFrame(rafId);
  gameScreen.style.display='none';
  homeScreen.style.display='block';
  window.scrollTo(0, 0);
  questBgm.pause();
  if(bgmStarted && !SFX.isMuted()) BGM.start();
  if(typeof refreshHomeSections === 'function') refreshHomeSections();
}
document.getElementById('btnHome').onclick = ()=>{ SFX.click(); goHome(); };
document.getElementById('btnRestart').onclick = ()=>{ SFX.click(); currentGame && currentGame.restart && currentGame.restart(); hideOverlay(); };
const btnFavGame = document.getElementById('btnFavGame');
function updateFavBtn(){
  if(!btnFavGame || !activeGameId) return;
  btnFavGame.textContent = FAV.isFav(activeGameId) ? '❤️' : '🤍';
  btnFavGame.classList.toggle('isFav', FAV.isFav(activeGameId));
}
if(btnFavGame){
  btnFavGame.onclick = ()=>{
    if(!activeGameId) return;
    const nowFav = FAV.toggle(activeGameId);
    SFX.click();
    updateFavBtn();
    if(nowFav){ showToast('❤️ Added to Favorites!'); if(FAV.getAll().length>=3) unlockAchievement('favorite_fan'); }
  };
}
const btnMute = document.getElementById('btnMute');
btnMute.onclick = ()=>{
  const m = SFX.toggleMute();
  btnMute.textContent = m ? '🔇' : '🔊';
  if(activeGameId === 'platformer'){
    if(m) questBgm.pause(); else questBgm.play().catch(()=>{});
  } else if(bgmStarted){
    if(m) BGM.stop(); else BGM.start();
  }
};

/* pointer events on canvas, normalized to logical 800x450 coords */
function canvasPos(e){
  const r = canvas.getBoundingClientRect();
  const scaleX = CW / r.width, scaleY = CH / r.height;
  return { x: (e.clientX - r.left)*scaleX, y: (e.clientY - r.top)*scaleY };
}
canvas.addEventListener('pointerdown', e=>{
  SFX.unlock();
  const p = canvasPos(e);
  pointer.down = true; pointer.x=p.x; pointer.y=p.y; pointer.startX=p.x; pointer.startY=p.y;
  pointer.trail = [{x:p.x,y:p.y,t:performance.now()}];
  currentGame && currentGame.onPointerDown && currentGame.onPointerDown(p.x,p.y);
});
canvas.addEventListener('pointermove', e=>{
  const p = canvasPos(e);
  pointer.x=p.x; pointer.y=p.y;
  if(pointer.down){
    pointer.trail.push({x:p.x,y:p.y,t:performance.now()});
    if(pointer.trail.length>25) pointer.trail.shift();
  }
  currentGame && currentGame.onPointerMove && currentGame.onPointerMove(p.x,p.y);
});
window.addEventListener('pointerup', e=>{
  const p = canvasPos(e);
  currentGame && currentGame.onPointerUp && currentGame.onPointerUp(p.x,p.y);
  pointer.down = false; pointer.trail=[];
});
// Keys that trigger the browser's built-in page-scroll (space, arrows, page up/down,
// home/end). While a game is actively being played, these are game controls (e.g.
// mashing spacebar to swim in Stick Swimmer Olympics, arrows to move/jump in the
// fight games and platformer) — without preventDefault the browser scrolls the whole
// page on every press, which on mobile/short screens can shove the game itself out
// of view. Only suppressed during active gameplay, and never when a form field (like
// the leaderboard name-entry input) has focus, so normal page scrolling/typing elsewhere
// is untouched.
const SCROLL_KEYS = [' ','Spacebar','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End'];
window.addEventListener('keydown', e=>{
     SFX.unlock();
     keys[e.key]=true;
     const t = e.target;
     const isFormField = t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.isContentEditable);
     if(currentGame && !isFormField && SCROLL_KEYS.indexOf(e.key)!==-1){
            e.preventDefault();
     }
}, {passive:false});
window.addEventListener('keyup', e=>{ keys[e.key]=false; });

/* =========================================================
   GAME 1 & 2 — shared "Fight" engine (Sword Duel / Dojo Kicks)
   ========================================================= */
const BELT_COLORS = ['#f4f4f4','#ffd166','#06d6a0','#2b6cb0','#1c2b3a'];
