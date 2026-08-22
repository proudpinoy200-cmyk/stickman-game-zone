/* =========================================================
GAME 13 — Stick Fort Defense (lane-based tower-defense-lite)
3 lanes, a friendly Fort on the left with an HP bar, and a themed
horde (Goblins, Trolls, Orc Warriors, Wolf Riders, and armored Skeleton
Commanders) marching in from the right. Tap Spear Guard or Archer to
pick a defender type, then tap a lane to place one — Spear Guards are
cheap short-range melee fighters, Archers cost more but fire arrows
the length of the lane. 15 escalating levels, capped off by the
Ogre King boss fight (ground slam stuns nearby defenders — spread out!).
========================================================= */
function createFortDefenseGame(){
let state;

const PLAY_TOP = 72, PLAY_BOT = 430;
const LANE_H = (PLAY_BOT - PLAY_TOP) / 3;
const LANE_Y = [0,1,2].map(i => PLAY_TOP + LANE_H*(i+0.5));
const FORT_HIT_X = 150;
const FORT_VIS_X = 88;
const SPAWN_X = 780;
const SLOT_XS = [230, 330, 430, 530, 630, 720];
const POKE_DUR = 0.18;
const ENEMY_MELEE_RANGE = 26;
const ENEMY_ATK_INTERVAL = 1.35;
const DEFENDER_MAX_HITS = 3;

const DEFENDER_TYPES = {
spear: { cost:3, range:120, atkRate:0.45, dmg:16, color:'#c0392b', accessory:'band', accessoryColor:'#ffd166', label:'Spear Guard', icon:'🗡️' },
archer:{ cost:4, range:260, atkRate:0.7, dmg:11, color:'#2b6cb0', accessory:'band', accessoryColor:'#eaf6ff', label:'Archer', icon:'🏹' },
};

const ENEMY_TYPES = {
goblin: { hp:16, speed:82, dmg:7, color:'#4a9c4f', accessory:'band', accessoryColor:'#1f5c22', scale:0.66, name:'Goblin' },
troll: { hp:72, speed:30, dmg:18, color:'#6b5233', accessory:'mask', accessoryColor:'#3a2a17', scale:1.15, name:'Troll' },
orc: { hp:42, speed:52, dmg:13, color:'#b2452f', accessory:'mask', accessoryColor:'#5c1f13', scale:0.95, name:'Orc Warrior' },
wolfrider: { hp:34, speed:104, dmg:15, color:'#7d7d8a', accessory:'band', accessoryColor:'#2e2e38', scale:0.85, name:'Wolf Rider' },
skeleton: { hp:96, speed:46, dmg:22, color:'#cfd6cf', accessory:'mask', accessoryColor:'#4a4a4a', scale:1.05, name:'Skeleton Commander', armor:0.8 },
};
const OGRE_HP = 1050, OGRE_DMG = 42, OGRE_SPEED = 19;

function enemyPoolForLevel(lvl){
if(lvl<=3) return [['goblin',5]];
if(lvl<=6) return [['goblin',4],['troll',2]];
if(lvl<=9) return [['goblin',3],['troll',2],['orc',3]];
if(lvl<=12) return [['goblin',2],['troll',2],['orc',3],['wolfrider',2]];
return [['goblin',1],['troll',2],['orc',2],['wolfrider',2],['skeleton',2]];
}
function buildLevel(lvl){
return {
n: lvl,
count: Math.round(7 + lvl*1.4),
interval: Math.max(0.42, 1.65 - lvl*0.075),
mix: enemyPoolForLevel(lvl),
hpMult: 1 + (lvl-1)*0.11,
dmgMult: 1 + (lvl-1)*0.07,
speedMult: 1 + (lvl-1)*0.018,
};
}
const LEVELS = [];
for(let i=1;i<=14;i++) LEVELS.push(buildLevel(i));
LEVELS.push({ n:15, boss:true });

function pickType(mix){
let total = 0; mix.forEach(m=>total+=m[1]);
let r = Math.random()*total, acc = 0;
for(const [type,w] of mix){ acc += w; if(r<=acc) return type; }
return mix[0][0];
}

function fresh(){
const s = {
phase: 'banner', waveIndex: 0, bannerT: 2.0, bannerText: 'Level 1', bannerSub: 'Pick a defender, then tap a lane!',
clearedT: 0, fortHP: 140, maxFortHP: 140, energy: 8, maxEnergy: 26, energyT: 0, selectedType: 'spear',
defenders: [], enemies: [], projectiles: [], slotsOccupied: {}, spawnQueue: 0, spawnT: 0,
particles: makeParticlePool(), popups: [], shakeT: 0, flashT: 0, flashColor: 'rgba(255,80,80,0.3)', t: 0,
};
return s;
}
function startWave(idx){
state.waveIndex = idx;
const w = LEVELS[idx];
state.phase = 'banner';
state.bannerT = 2.0;
if(w.boss){
state.bannerText = '⚠️ THE OGRE KING! ⚠️';
state.bannerSub = 'Focus fire together — watch out for his ground slam!';
state.spawnQueue = 1;
} else {
state.bannerText = 'Level ' + w.n;
state.bannerSub = w.n===1 ? 'Tap Spear Guard or Archer, then tap a lane! Guards fall after 3 hits — replace them fast!' : 'Here they come!';
state.spawnQueue = w.count;
}
state.spawnT = 0.5;
SFX.beep();
}
function spawnEnemy(w){
const type = pickType(w.mix);
const T = ENEMY_TYPES[type];
const lane = Math.floor(rand(0,3));
state.enemies.push({
isBoss:false, type, lane, x:SPAWN_X, y:LANE_Y[lane],
hp:T.hp*w.hpMult, maxHp:T.hp*w.hpMult, speed:T.speed*w.speedMult, dmg:Math.round(T.dmg*w.dmgMult),
color:T.color, accessory:T.accessory, accessoryColor:T.accessoryColor, scale:T.scale,
armor:T.armor||1, name:T.name, hitFlash:0, animT:rand(0,10), atkCooldown:rand(0,0.5),
});
}
function spawnOgre(){
const lane = 1;
const b = {
isBoss:true, type:'ogre', lane, x:SPAWN_X, y:LANE_Y[lane],
hp:OGRE_HP, maxHp:OGRE_HP, speed:OGRE_SPEED, dmg:OGRE_DMG,
color:'#9a8760', accessory:'mask', accessoryColor:'#4a3520', scale:2.05, armor:1, name:'Ogre King',
hitFlash:0, animT:0, laneSwitchT: rand(4.5,5.5), slamPhase:'idle', slamTimer: 5, slamT:0, atkCooldown:rand(0,0.5),
};
state.enemies.push(b);
}
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
state.popups.push({x:e.x, y:e.y-56, text:'OGRE DEFEATED!', color:'#ffd166', life:1.6});
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
function killDefender(d){
const i = state.defenders.indexOf(d);
if(i>=0) state.defenders.splice(i,1);
if(d.slotKey!=null) delete state.slotsOccupied[d.slotKey];
spawnSpark(state.particles, d.x, d.y, '#8a8a8a', 12);
state.popups.push({x:d.x, y:d.y-30, text:'Guard Down!', color:'#ff8a3d', life:1.0});
SFX.hurt();
}

function fireAt(d, target){
const AT = DEFENDER_TYPES[d.type];
const dmgAmt = Math.max(1, Math.round(AT.dmg * (target.armor||1)));
target.hp -= dmgAmt;
target.hitFlash = 0.15;
d.pokeT = POKE_DUR;
d.cooldown = AT.atkRate;
if(d.type==='archer'){
const dist = Math.abs(target.x-(d.x+14));
state.projectiles.push({ x:d.x+14, y:d.y-6, tx:target.x, ty:target.y-6, t:0, dur: Math.max(0.08, dist/650) });
SFX.whoosh();
} else {
spawnSpark(state.particles, target.x, target.y, '#ffd166', 5);
SFX.sword();
}
if(target.hp<=0) killEnemy(target);
}
const TYPE_BTN_W=136, TYPE_BTN_H=30, TYPE_BTN_Y=36, TYPE_BTN_GAP=8;
function typeBtnRect(which){
const totalW = TYPE_BTN_W*2+TYPE_BTN_GAP;
const x0 = CW/2 - totalW/2 + (which==='archer' ? TYPE_BTN_W+TYPE_BTN_GAP : 0);
return { x0, y0:TYPE_BTN_Y, x1:x0+TYPE_BTN_W, y1:TYPE_BTN_Y+TYPE_BTN_H };
}
function onPointerDown(x,y){
if(!state.phase || state.phase==='victory' || state.phase==='gameover' || state.phase==='done') return;
for(const tkey of ['spear','archer']){
const r = typeBtnRect(tkey);
if(x>=r.x0 && x<=r.x1 && y>=r.y0 && y<=r.y1){
if(state.selectedType!==tkey){ state.selectedType = tkey; SFX.click(); }
return;
}
}
let lane = -1, bestLaneD = Infinity;
for(let i=0;i<3;i++){ const d = Math.abs(y-LANE_Y[i]); if(d<bestLaneD){ bestLaneD=d; lane=i; } }
if(bestLaneD > LANE_H*0.55){ SFX.wrong(); return; }
let slotIdx = -1, bestSlotD = Infinity;
SLOT_XS.forEach((sx,idx)=>{ const d = Math.abs(x-sx); if(d<bestSlotD){ bestSlotD=d; slotIdx=idx; } });
if(bestSlotD > 44){ SFX.wrong(); return; }
const key = lane+'-'+slotIdx;
if(state.slotsOccupied[key]){ SFX.wrong(); return; }
const AT = DEFENDER_TYPES[state.selectedType];
if(state.energy < AT.cost){
SFX.wrong();
state.popups.push({x, y:y-30, text:'Need '+AT.cost+' energy!', color:'#ffd166', life:0.9});
return;
}
state.energy -= AT.cost;
const d = { type: state.selectedType, lane, x:SLOT_XS[slotIdx], y:LANE_Y[lane], cooldown:0.15, pokeT:0, wobbleT:rand(0,10), hitsTaken:0, maxHits:DEFENDER_MAX_HITS, slotKey:key, hurtT:0 };
state.defenders.push(d);
state.slotsOccupied[key] = d;
spawnSpark(state.particles, d.x, d.y, '#39ff88', 10);
SFX.click();
}

function onWaveCleared(){
if(state.phase !== 'active') return;
state.phase = 'cleared';
state.clearedT = 1.3;
SFX.powerup();
if(LEVELS[state.waveIndex].boss){
} else {
state.popups.push({x:CW/2, y:CH/2-30, text:'Level '+LEVELS[state.waveIndex].n+' Cleared!', color:'#39ff88', life:1.2});
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
const score = 15*1000 + Math.round(state.fortHP);
PROG.setStars('fortdefense', stars);
PROG.setHighScore('fortdefense', score);
PROG.updateDisplay();
recordRoundComplete();
unlockAchievement('fortdefense_boss_defeated');
if(hpPct >= 0.9) unlockAchievement('fortdefense_flawless');
setTimeout(()=>{
showGameOverOverlay('fortdefense', score, '🏰 Fort Defended!',
`Your Spear Guards and Archers held all 15 levels and brought down the Ogre King with ${Math.round(state.fortHP)} HP left! Final score: ${score}`,
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
const levelsCompleted = state.waveIndex;
const score = levelsCompleted*1000 + Math.round(Math.max(0,state.fortHP));
const stars = levelsCompleted>=6 ? 1 : 0;
PROG.setStars('fortdefense', stars);
PROG.setHighScore('fortdefense', score);
PROG.updateDisplay();
recordRoundComplete();
setTimeout(()=>{
showGameOverOverlay('fortdefense', score, '🏰 Try Again!',
`Your fort held strong through ${levelsCompleted} level${levelsCompleted===1?'':'s'} before the horde broke through. Mix Spear Guards up close with Archers at range, and spread them across all 3 lanes — you'll get it next time!`,
[
{label:'Play Again', onClick:()=>{ state=fresh(); startWave(0); hideOverlay(); }},
{label:'Home', onClick: goHome}
]);
state.phase = 'done';
}, 200);
}
function update(dt){
state.t += dt;
updateParticles(state.particles, dt, 140);
if(state.shakeT>0) state.shakeT -= dt;
if(state.flashT>0) state.flashT -= dt;
state.popups.forEach(p=>{ p.y -= 24*dt; p.life -= dt*1.1; });
state.popups = state.popups.filter(p=>p.life>0);
state.projectiles.forEach(p=>{ p.t += dt; });
state.projectiles = state.projectiles.filter(p=>p.t < p.dur);
if(state.phase==='victory' || state.phase==='gameover' || state.phase==='done') return;
state.energyT += dt;
if(state.energyT >= 1.25){
state.energyT -= 1.25;
state.energy = Math.min(state.maxEnergy, state.energy+1);
}
if(state.phase==='banner'){
state.bannerT -= dt;
if(state.bannerT<=0) state.phase = 'active';
} else if(state.phase==='cleared'){
state.clearedT -= dt;
if(state.clearedT<=0){
if(state.waveIndex >= LEVELS.length-1) triggerVictory();
else startWave(state.waveIndex+1);
}
}
if(state.phase==='active'){
const w = LEVELS[state.waveIndex];
state.spawnT -= dt;
if(state.spawnQueue>0 && state.spawnT<=0){
if(w.boss) spawnOgre(); else spawnEnemy(w);
state.spawnQueue--;
state.spawnT = w.boss ? 9999 : w.interval;
}
}
for(const d of state.defenders){
d.cooldown -= dt;
d.wobbleT += dt;
if(d.pokeT>0) d.pokeT -= dt;
if(d.hurtT>0) d.hurtT -= dt;
if(d.cooldown<=0){
const AT = DEFENDER_TYPES[d.type];
let target = null, bestDist = Infinity;
for(const e of state.enemies){
if(e.lane !== d.lane) continue;
const dd = Math.abs(e.x-d.x);
if(dd<=AT.range && dd<bestDist){ target = e; bestDist = dd; }
}
if(target){
fireAt(d, target);
} else {
d.cooldown = 0.15;
}
}
}
for(const e of state.enemies.slice()){
if(e.hitFlash>0) e.hitFlash -= dt;
e.animT += dt;
if(e.isBoss){
e.laneSwitchT -= dt;
if(e.laneSwitchT<=0){
let newLane;
do{ newLane = Math.floor(rand(0,3)); } while(newLane===e.lane);
e.lane = newLane;
e.laneSwitchT = rand(4.5,5.5);
}
e.y = lerp(e.y, LANE_Y[e.lane], smoothT(3.5,dt));
e.slamTimer -= dt;
if(e.slamPhase==='idle' && e.slamTimer<=0){
e.slamPhase = 'warning'; e.slamT = 0.8;
state.popups.push({x:e.x, y:e.y-70, text:'💥 Ground Slam!', color:'#ff8a3d', life:0.9});
} else if(e.slamPhase==='warning'){
e.slamT -= dt;
if(e.slamT<=0){
e.slamPhase = 'slam'; e.slamT = 0.35;
state.shakeT = Math.max(state.shakeT,0.3);
SFX.stomp();
for(const d of state.defenders){ if(d.lane===e.lane) d.cooldown = Math.max(d.cooldown, 1.1); }
spawnSpark(state.particles, e.x, e.y, '#ff8a3d', 16);
}
} else if(e.slamPhase==='slam'){
e.slamT -= dt;
if(e.slamT<=0){ e.slamPhase = 'idle'; e.slamTimer = 5; }
}
}
let inMelee = false;
for(const d of state.defenders){
if(d.lane !== e.lane) continue;
if(Math.abs(e.x - d.x) <= ENEMY_MELEE_RANGE){
inMelee = true;
e.atkCooldown -= dt;
if(e.atkCooldown <= 0){
e.atkCooldown = ENEMY_ATK_INTERVAL;
d.hitsTaken++;
d.hurtT = 0.25;
spawnSpark(state.particles, d.x, d.y, '#ff5050', 6);
SFX.swordMiss();
if(d.hitsTaken >= d.maxHits) killDefender(d);
}
break;
}
}
if(inMelee) continue;
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

function drawBg(g){
const grad = g.createLinearGradient(0,0,0,CH);
grad.addColorStop(0,'#bfe9ff');
grad.addColorStop(1,'#dff7e6');
g.fillStyle = grad;
g.fillRect(0,0,CW,CH);
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
g.fillStyle = hurt ? '#d98a6b' : '#c8946a';
roundRect(x-58, PLAY_TOP-8, 116, (PLAY_BOT-PLAY_TOP)+16, 10);
g.fill();
g.strokeStyle = '#7a5230'; g.lineWidth = 3;
roundRect(x-58, PLAY_TOP-8, 116, (PLAY_BOT-PLAY_TOP)+16, 10);
g.stroke();
g.fillStyle = '#b98457';
for(let cx=x-54; cx<x+54; cx+=20){
g.fillRect(cx, PLAY_TOP-20, 12, 16);
}
g.fillStyle = '#6b4526';
g.beginPath();
g.moveTo(x-16, PLAY_BOT-4);
g.lineTo(x-16, (PLAY_TOP+PLAY_BOT)/2+10);
g.quadraticCurveTo(x, (PLAY_TOP+PLAY_BOT)/2-30, x+16, (PLAY_TOP+PLAY_BOT)/2+10);
g.lineTo(x+16, PLAY_BOT-4);
g.closePath(); g.fill();
g.fillStyle = '#ffe6c9';
g.beginPath(); g.arc(x-7,(PLAY_TOP+PLAY_BOT)/2-2,3.5,0,Math.PI*2); g.fill();
g.beginPath(); g.arc(x+7,(PLAY_TOP+PLAY_BOT)/2-2,3.5,0,Math.PI*2); g.fill();
g.strokeStyle = '#ffe6c9'; g.lineWidth = 2; g.lineCap='round';
g.beginPath(); g.arc(x,(PLAY_TOP+PLAY_BOT)/2+6,7,deg(20),deg(160)); g.stroke();
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
if(e.isBoss){
g.save();
g.strokeStyle = '#5c4326'; g.lineWidth = 6.3; g.lineCap='round';
g.beginPath(); g.moveTo(e.x-16, e.y-8); g.lineTo(e.x-46, e.y+30); g.stroke();
g.fillStyle = '#7a5a34';
g.beginPath(); g.arc(e.x-48, e.y+34, 13, 0, Math.PI*2); g.fill();
g.restore();
if(e.slamPhase==='warning'){
const p = 1-(e.slamT/0.8);
g.save();
g.globalAlpha = 0.5;
g.strokeStyle = '#ff8a3d'; g.lineWidth = 3;
g.beginPath(); g.arc(e.x, e.y+18, 20+p*70, 0, Math.PI*2); g.stroke();
g.restore();
}
}
const barW = e.isBoss ? 130 : 40;
healthBar(e.x-barW/2, e.y+18-46*e.scale-14, barW, e.isBoss?8:5, e.hp/e.maxHp, e.isBoss?'#ff8a3d':'#ff5050');
if(e.isBoss){
g.textAlign='center'; g.font='bold 14px Segoe UI'; g.fillStyle='#8a4a1a';
g.fillText('👑 Ogre King', e.x, e.y-70);
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
const AT = DEFENDER_TYPES[d.type];
const pose = defenderPose(d);
const hurt = d.hurtT>0;
g.save();
if(hurt) g.globalAlpha = 0.65;
drawStick(g, d.x, d.y+18, 0.86, hurt?'#ffffff':AT.color, 1, pose, {expr:'shout', accessory:AT.accessory, accessoryColor:AT.accessoryColor});
g.restore();
const pipY = d.y+18-46*0.86-12;
for(let i=0;i<d.maxHits;i++){
const px = d.x - (d.maxHits-1)*5 + i*10;
g.beginPath();
g.arc(px, pipY, 3, 0, Math.PI*2);
g.fillStyle = i < (d.maxHits-d.hitsTaken) ? '#39d16b' : 'rgba(0,0,0,0.18)';
g.fill();
}
if(d.type==='spear' && d.pokeT>0){
g.save();
g.strokeStyle = '#d8d8d8'; g.lineWidth = 3.4; g.lineCap='round';
const reach = AT.range*0.42;
g.beginPath(); g.moveTo(d.x+18,d.y+2); g.lineTo(d.x+reach,d.y+2); g.stroke();
g.fillStyle = '#e8e8e8';
g.beginPath();
g.moveTo(d.x+reach,d.y+2-6); g.lineTo(d.x+reach+12,d.y+2); g.lineTo(d.x+reach,d.y+2+6);
g.closePath(); g.fill();
g.restore();
} else if(d.type==='archer'){
g.save();
g.strokeStyle = '#8a5a2b'; g.lineWidth = 2.4; g.lineCap='round';
g.beginPath(); g.arc(d.x+20, d.y-2, 11, deg(-60), deg(60)); g.stroke();
g.restore();
}
}
function drawProjectiles(g){
for(const p of state.projectiles){
const f = clamp(p.t/p.dur,0,1);
const x = lerp(p.x,p.tx,f), y = lerp(p.y,p.ty,f);
g.save();
g.translate(x,y);
const ang = Math.atan2(p.ty-p.y, p.tx-p.x);
g.rotate(ang);
g.strokeStyle = '#5a3d20'; g.lineWidth = 2.6; g.lineCap='round';
g.beginPath(); g.moveTo(-11,0); g.lineTo(9,0); g.stroke();
g.fillStyle = '#3a2a17';
g.beginPath(); g.moveTo(9,0); g.lineTo(3,-3.5); g.lineTo(3,3.5); g.closePath(); g.fill();
g.strokeStyle = '#eaf6ff'; g.lineWidth=1.6;
g.beginPath(); g.moveTo(-11,0); g.lineTo(-16,-3); g.moveTo(-11,0); g.lineTo(-16,3); g.stroke();
g.restore();
}
}
function drawSlots(g){
if(state.phase==='victory' || state.phase==='gameover' || state.phase==='done') return;
const AT = DEFENDER_TYPES[state.selectedType];
for(let lane=0;lane<3;lane++){
SLOT_XS.forEach((sx,idx)=>{
const key = lane+'-'+idx;
if(state.slotsOccupied[key]) return;
g.save();
g.globalAlpha = state.energy>=AT.cost ? 0.35 : 0.15;
g.strokeStyle = AT.color;
g.setLineDash([4,4]);
g.lineWidth = 2;
g.beginPath(); g.arc(sx, LANE_Y[lane], 22, 0, Math.PI*2); g.stroke();
g.setLineDash([]);
g.restore();
});
}
}
function drawTypeSelector(g){
['spear','archer'].forEach(tkey=>{
const AT = DEFENDER_TYPES[tkey];
const r = typeBtnRect(tkey);
const active = state.selectedType===tkey;
const afford = state.energy>=AT.cost;
g.save();
g.globalAlpha = afford?1:0.55;
g.fillStyle = active ? '#ffe27a' : '#ffffff';
roundRect(r.x0, r.y0, r.x1-r.x0, r.y1-r.y0, 8);
g.fill();
g.strokeStyle = active ? '#c8941a' : '#33506b';
g.lineWidth = active?2.6:1.6;
roundRect(r.x0, r.y0, r.x1-r.x0, r.y1-r.y0, 8);
g.stroke();
g.fillStyle = '#1c2b3a';
g.font='bold 12px Segoe UI'; g.textAlign='center';
g.fillText(AT.icon+' '+AT.label+' ('+AT.cost+'⚡)', (r.x0+r.x1)/2, r.y0+20);
g.restore();
});
}
function drawHud(g){
g.textAlign='left'; g.font='bold 13px Segoe UI'; g.fillStyle='#1c2b3a';
g.fillText('🏰 Fort HP', 14, 20);
healthBar(14, 24, 150, 14, state.fortHP/state.maxFortHP, state.fortHP>40?'#39d16b':'#ff5050');
g.fillStyle='#1c2b3a';
g.fillText(Math.round(state.fortHP)+'/'+state.maxFortHP, 170, 35);
g.textAlign='right';
g.fillText('⚡ Energy '+state.energy+'/'+state.maxEnergy, CW-14, 20);
const barW = 150;
healthBar(CW-14-barW, 24, barW, 14, state.energy/state.maxEnergy, '#ffd166');
g.textAlign='center'; g.font='bold 14px Segoe UI'; g.fillStyle='#1c2b3a';
const w = LEVELS[state.waveIndex];
g.fillText(w.boss ? 'Level 15/15 — Final Boss' : ('Level '+w.n+'/15'), CW/2, 20);
}
function drawBanner(g){
if(state.phase!=='banner') return;
g.save();
g.globalAlpha = clamp(state.bannerT/0.4,0,1)*0.9 + 0.1;
g.textAlign='center';
g.font='bold 30px Segoe UI'; g.fillStyle='#1c2b3a';
g.fillText(state.bannerText, CW/2, CH/2-20);
g.font='bold 15px Segoe UI'; g.fillStyle='#33506b';
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
drawProjectiles(g);
drawSparks(g, state.particles);
state.popups.forEach(p=>{
g.globalAlpha = clamp(p.life,0,1);
g.fillStyle = p.color; g.font='bold 17px Segoe UI'; g.textAlign='center';
g.fillText(p.text, p.x, p.y);
});
g.globalAlpha = 1;
drawHud(g);
drawTypeSelector(g);
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
hint: 'Pick 🗡️ Spear Guard or 🏹 Archer, then tap a lane to place them! Guards fall after 3 hits up close, so watch for empty slots and reinforce! Hold all 3 lanes through 15 levels and defeat the Ogre King!',
controlsHtml: '',
bindControls(){},
create(){ state = fresh(); startWave(0); return this; },
restart(){ state = fresh(); startWave(0); hideOverlay(); },
update, draw, onPointerDown,
};
}
