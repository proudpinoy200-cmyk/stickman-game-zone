/* =========================================================
WORD SCRAMBLE + WHACK-A-MOLE — shared style setup
========================================================= */
(function(){
const st = document.createElement('style');
st.textContent = `
.wsProgress{ font-weight:800; font-size:.95em; color:#2b3a4a; }
.wsHint{ font-size:3em; line-height:1; }
.wsAnswerRow{ display:flex; gap:6px; flex-wrap:wrap; justify-content:center; }
.wsAnswerRow.shake{ animation: wsShake .4s ease; }
@keyframes wsShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
.wsSlot{
width:44px; height:50px; border-radius:8px; background:rgba(255,255,255,0.85);
box-shadow:0 3px 0 rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center;
font-weight:900; font-size:1.3em; color:#2b3a4a; cursor:pointer; touch-action:manipulation;
}
.wsSlot.solved{ background:#06d6a0; color:#fff; cursor:default; }
.wsTiles{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; max-width:420px; }
.wsTile{
width:44px; height:50px; border-radius:8px; border:none; background:#fff;
box-shadow:0 3px 0 rgba(0,0,0,0.15); font-weight:900; font-size:1.3em; color:#2b3a4a;
cursor:pointer; touch-action:manipulation;
}
.wsTile:active{ transform:translateY(2px); }
.wsTile.used, .wsTile:disabled{ visibility:hidden; }
.wamStats{ display:flex; gap:24px; font-weight:800; font-size:1em; color:#2b3a4a; }
.wamGrid{ display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); gap:10px; width:min(70vw,300px); aspect-ratio:1; margin:0 auto; }
.wamHole{
background:radial-gradient(circle at 50% 40%, #8a5a2b, #5c3a1a);
border-radius:50%; box-shadow:inset 0 6px 10px rgba(0,0,0,0.5);
display:flex; align-items:center; justify-content:center; font-size:2em;
cursor:pointer; touch-action:manipulation; user-select:none;
}
.wamHole.active{ animation: wamPop .15s ease; }
@keyframes wamPop { 0%{transform:scale(0.6)} 100%{transform:scale(1)} }
.wamHole.bandit{ box-shadow:inset 0 6px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,107,107,0.6); }
`;
document.head.appendChild(st);
})();

/* =========================================================
GAME 19 — Word Scramble (tap-to-unscramble spelling game with
a kid-friendly word bank and an emoji hint next to every word.
10 rounds per run, unlimited retries per word — a wrong order
just gently resets, never counts against you.)
========================================================= */
const WS_WORDS = [
{word:'CAT',emoji:'🐱'},{word:'DOG',emoji:'🐶'},{word:'SUN',emoji:'☀️'},{word:'STAR',emoji:'⭐'},
{word:'FISH',emoji:'🐟'},{word:'BIRD',emoji:'🐦'},{word:'MOON',emoji:'🌙'},{word:'TREE',emoji:'🌳'},
{word:'FROG',emoji:'🐸'},{word:'CAKE',emoji:'🎂'},{word:'BOOK',emoji:'📚'},{word:'BALL',emoji:'⚽'},
{word:'DUCK',emoji:'🦆'},{word:'LION',emoji:'🦁'},{word:'BEAR',emoji:'🐻'},{word:'KITE',emoji:'🪁'},
{word:'RAIN',emoji:'🌧️'},{word:'SHIP',emoji:'🚢'},{word:'CROWN',emoji:'👑'},{word:'HEART',emoji:'❤️'},

{word:'FOX',emoji:'🦊'},{word:'PIG',emoji:'🐷'},{word:'COW',emoji:'🐄'},{word:'BEE',emoji:'🐝'},
{word:'OWL',emoji:'🦉'},{word:'HEN',emoji:'🐔'},{word:'CRAB',emoji:'🦀'},{word:'WHALE',emoji:'🐳'},
{word:'SNAIL',emoji:'🐌'},{word:'ZEBRA',emoji:'🦓'},{word:'TIGER',emoji:'🐯'},{word:'SHARK',emoji:'🦈'},
{word:'MOUSE',emoji:'🐭'},{word:'HORSE',emoji:'🐴'},{word:'SNAKE',emoji:'🐍'},{word:'CLOCK',emoji:'🕐'},
{word:'CHAIR',emoji:'🪑'},{word:'PLANE',emoji:'✈️'},{word:'TRAIN',emoji:'🚂'},{word:'SMILE',emoji:'😊'},
];
function wsShuffleLetters(word){
let letters = word.split('');
let tries=0;
do{
for(let i=letters.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [letters[i],letters[j]]=[letters[j],letters[i]]; }
tries++;
}while(letters.join('')===word && tries<8 && word.length>1);
return letters;
}
function wsPickWords(n){
const pool = WS_WORDS.slice();
for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
return pool.slice(0,n);
}
function createWordScrambleGame(){
let state;
function fresh(){
return { words: wsPickWords(10), round:0, solved:0, letters:[], answer:[], over:false };
}
function loadRound(){
const w = state.words[state.round];
state.letters = wsShuffleLetters(w.word).map((ch,i)=>({ch, id:i, used:false}));
state.answer = [];
}
function checkAnswer(){
const formed = state.answer.map(a=>a.ch).join('');
const target = state.words[state.round].word;
if(formed === target){
state.solved++;
SFX.match();
renderRound(true);
setTimeout(()=> advance(), 850);
} else {
SFX.wrong();
const row = document.getElementById('wsAnswerRow');
if(row){ row.classList.add('shake'); setTimeout(()=>row.classList.remove('shake'),400); }
setTimeout(()=>{ state.answer=[]; state.letters.forEach(l=>l.used=false); renderRound(false); }, 650);
}
}
function advance(){
state.round++;
if(state.round>=state.words.length){ finish(); return; }
loadRound();
renderRound(false);
}
function finish(){
state.over = true;
PROG.setHighScore('wordscramble', state.solved);
const stars = state.solved>=9?3:state.solved>=6?2:1;
PROG.setStars('wordscramble', stars);
PROG.updateDisplay();
recordRoundComplete();
if(state.solved>=8) unlockAchievement('word_wizard');
setTimeout(()=>{
showGameOverOverlay('wordscramble', state.solved, '📖 Word Scramble Complete!', `You spelled ${state.solved} out of ${state.words.length} words correctly!`, [
{label:'Play Again', onClick:()=>{ state=fresh(); loadRound(); buildDOM(); hideOverlay(); }},
{label:'Home', onClick: goHome}
]);
},300);
}
function renderRound(justSolved){
const hint = document.getElementById('wsHint');
const progress = document.getElementById('wsProgress');
const tiles = document.getElementById('wsTiles');
const row = document.getElementById('wsAnswerRow');
if(!hint||!tiles||!row) return;
const w = state.words[state.round];
hint.textContent = w.emoji;
if(progress) progress.textContent = `Word ${state.round+1} / ${state.words.length} • Solved: ${state.solved}`;
row.innerHTML = '';
for(let i=0;i<w.word.length;i++){
const slot = document.createElement('div');
slot.className = 'wsSlot' + (justSolved?' solved':'');
const a = state.answer[i];
if(a){
slot.textContent = a.ch;
slot.onclick = ()=>{
if(justSolved) return;
const [rem] = state.answer.splice(i,1);
const lt = state.letters.find(l=>l.id===rem.id);
if(lt) lt.used=false;
SFX.click();
renderRound(false);
};
}
row.appendChild(slot);
}
tiles.innerHTML = '';
state.letters.forEach(l=>{
const t = document.createElement('button');
t.type = 'button';
t.className = 'wsTile' + (l.used?' used':'');
t.textContent = l.ch;
t.disabled = l.used || justSolved;
t.onclick = ()=>{
if(state.answer.length>=w.word.length) return;
l.used = true;
state.answer.push(l);
SFX.click();
renderRound(false);
if(state.answer.length===w.word.length) checkAnswer();
};
tiles.appendChild(t);
});
}
function buildDOM(){
renderRound(false);
const skip = document.getElementById('wsSkipBtn');
if(skip) skip.onclick = ()=>{ SFX.click(); advance(); };
}
function update(dt){}
function draw(g){ drawFlatBg('#e9f7ff','#fff7e0'); }
return {
title:'Word Scramble', hint:'Tap the letters in order to spell the word shown by the picture!',
domOverlay:true,
controlsHtml: `
<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">
<div class="wsProgress" id="wsProgress">Word 1 / 10</div>
<div class="wsHint" id="wsHint">🐱</div>
<div class="wsAnswerRow" id="wsAnswerRow"></div>
<div class="wsTiles" id="wsTiles"></div>
<button class="colActionBtn" id="wsSkipBtn" type="button">🔀 Skip Word</button>
</div>`,
bindControls(){ loadRound(); buildDOM(); },
create(){ state=fresh(); return this; },
restart(){ state=fresh(); loadRound(); buildDOM(); hideOverlay(); },
update, draw,
};
}

/* =========================================================
GAME 20 — Whack-a-Mole (quick 30-second reflex arcade game —
tap the stickman fighter before he ducks back down, don't tap
the sneaky bandit decoy!)
========================================================= */
const WAM_HOLES = 9;
function createWhackAMoleGame(){
let state;
function fresh(){
return {
holes: new Array(WAM_HOLES).fill(null), // null or {kind:'mole'|'bandit', life}
score:0, timeLeft:30, spawnTimer:0.6, over:false, started:false,
};
}
function pickEmptyHole(){
const empties = [];
for(let i=0;i<WAM_HOLES;i++) if(!state.holes[i]) empties.push(i);
if(!empties.length) return -1;
return empties[Math.floor(Math.random()*empties.length)];
}
function spawn(){
const idx = pickEmptyHole();
if(idx<0) return;
const isBandit = Math.random()<0.25;
const life = rand(0.7,1.15);
state.holes[idx] = { kind: isBandit?'bandit':'mole', life };
}
function whack(i){
const h = state.holes[i];
if(!h || state.over) return;
if(h.kind==='bandit'){ state.score = Math.max(0,state.score-1); SFX.wrong(); }
else { state.score++; SFX.stomp(); }
state.holes[i] = null;
renderHoles();
const sc = document.getElementById('wamScore'); if(sc) sc.textContent = `Score: ${state.score}`;
}
function finish(){
state.over = true;
PROG.setHighScore('whackamole', state.score);
const stars = state.score>=22?3:state.score>=12?2:1;
PROG.setStars('whackamole', stars);
PROG.updateDisplay();
recordRoundComplete();
if(state.score>=20) unlockAchievement('mole_master');
SFX.gameover();
setTimeout(()=>{
showGameOverOverlay('whackamole', state.score, "🔨 Time's Up!", `You scored ${state.score} points whacking fighters!`, [
{label:'Play Again', onClick:()=>{ state=fresh(); buildDOM(); hideOverlay(); }},
{label:'Home', onClick: goHome}
]);
},250);
}
function update(dt){
if(!state || state.over || !state.started) return;
state.timeLeft -= dt;
const tEl = document.getElementById('wamTimer'); if(tEl) tEl.textContent = `⏱️ ${Math.max(0,Math.ceil(state.timeLeft))}s`;
if(state.timeLeft<=0){ finish(); return; }
state.spawnTimer -= dt;
if(state.spawnTimer<=0){ spawn(); state.spawnTimer = rand(0.55,0.95); renderHoles(); }
let changed = false;
for(let i=0;i<WAM_HOLES;i++){
const h = state.holes[i];
if(h){ h.life -= dt; if(h.life<=0){ state.holes[i]=null; changed=true; } }
}
if(changed) renderHoles();
}
function draw(g){ drawFlatBg('#dcffe4','#fff6cf'); }
function renderHoles(){
for(let i=0;i<WAM_HOLES;i++){
const cell = document.getElementById('wamHole'+i);
if(!cell) continue;
const h = state.holes[i];
cell.textContent = h ? (h.kind==='bandit' ? '🦹' : '🥊') : '';
cell.className = 'wamHole' + (h ? (' active'+(h.kind==='bandit'?' bandit':' mole')) : '');
}
}
function buildDOM(){
const grid = document.getElementById('wamGrid');
if(grid && !grid.childElementCount){
for(let i=0;i<WAM_HOLES;i++){
const cell = document.createElement('div');
cell.className = 'wamHole'; cell.id = 'wamHole'+i;
cell.addEventListener('pointerdown', ()=>{ if(!state.started){ state.started=true; const sb=document.getElementById('wamStartBtn'); if(sb) sb.style.display='none'; } whack(i); });
grid.appendChild(cell);
}
} else if(grid){
renderHoles();
}
const sc = document.getElementById('wamScore'); if(sc) sc.textContent = `Score: ${state.score}`;
const tEl = document.getElementById('wamTimer'); if(tEl) tEl.textContent = `⏱️ ${Math.ceil(state.timeLeft)}s`;
const startBtn = document.getElementById('wamStartBtn');
if(startBtn){
startBtn.style.display = state.started ? 'none' : 'block';
startBtn.onclick = ()=>{ state.started=true; startBtn.style.display='none'; SFX.click(); };
}
}
return {
title:'Whack-a-Mole', hint:'Tap the stickman fighters before they duck! Watch out for the sneaky bandit 🦹',
domOverlay:true,
controlsHtml: `
<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">
<div class="wamStats"><span id="wamScore">Score: 0</span><span id="wamTimer">⏱️ 30s</span></div>
<div class="wamGrid" id="wamGrid"></div>
<button class="colActionBtn" id="wamStartBtn" type="button">▶️ Start</button>
</div>`,
bindControls(){ buildDOM(); },
create(){ state=fresh(); return this; },
restart(){ state=fresh(); buildDOM(); hideOverlay(); },
update, draw,
};
}
