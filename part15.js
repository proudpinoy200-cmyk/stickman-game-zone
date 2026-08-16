/* =========================================================
BLOCK PUZZLE + COLORING STUDIO — shared shape/style setup
========================================================= */
(function(){
const st = document.createElement('style');
st.textContent = `
.bpGrid{ display:grid; grid-template-columns:repeat(8,1fr); grid-template-rows:repeat(8,1fr); gap:3px; margin:0 auto; box-sizing:border-box; }
.bpCell{ background:rgba(255,255,255,0.55); border-radius:4px; box-shadow:inset 0 0 0 1px rgba(0,0,0,0.08); }
.bpCell.filled{ box-shadow:0 2px 0 rgba(0,0,0,0.18); }
.bpScore{ font-weight:800; font-size:.95em; color:#2b3a4a; }
.bpTray{ display:flex; gap:14px; justify-content:center; }
.bpPieceSlot{ width:74px; height:74px; background:rgba(255,255,255,0.6); border-radius:12px; display:flex; align-items:center; justify-content:center; padding:8px; box-shadow:0 3px 0 rgba(0,0,0,0.12); cursor:pointer; box-sizing:border-box; touch-action:manipulation; }
.bpPieceSlot.selected{ background:#fff; box-shadow:0 0 0 3px #ffb703, 0 3px 0 rgba(0,0,0,0.12); }
.bpPieceSlot.empty{ opacity:.25; box-shadow:none; cursor:default; }
.bpMini{ display:grid; gap:2px; width:100%; height:100%; }
.bpMiniCell{ border-radius:2px; }
.bpMiniGap{ background:transparent; }
.colToolbar{ display:flex; flex-direction:column; gap:6px; }
.colRow{ display:flex; flex-wrap:wrap; gap:6px; justify-content:center; align-items:center; }
.colSwatch{ width:30px; height:30px; border-radius:50%; border:3px solid rgba(255,255,255,0.7); box-shadow:0 2px 0 rgba(0,0,0,0.15); cursor:pointer; padding:0; touch-action:manipulation; }
.colSwatch.sel{ border-color:#1c2b3a; transform:scale(1.12); }
.colSizeBtn, .colTplBtn, .colActionBtn{
background:#fff; border:none; border-radius:999px; padding:8px 14px; font-weight:800; font-size:.9em;
cursor:pointer; box-shadow:0 3px 0 rgba(0,0,0,0.15); color:#2b3a4a; margin:2px; touch-action:manipulation;
}
.colSizeBtn.sel, .colTplBtn.sel{ background:#ffb703; }
.colActionBtn.colDone{ background:#06d6a0; color:#fff; }
.colSizes{ display:inline-flex; gap:4px; }
`;
document.head.appendChild(st);
})();

/* =========================================================
GAME 17 — Block Puzzle (tap-to-place grid-clearing brain game,
Blockudoku/Woodoku-style but built around taps instead of drags
so it works cleanly on any touchscreen with no drag-and-drop code)
========================================================= */
const BP_SIZE = 8;
const BP_COLORS = ['#ff6b6b','#4ecdc4','#ffb703','#9b5de5','#06d6a0','#f72585','#4361ee','#fb8500'];
// Every shape is a list of [dx,dy] cell offsets, normalized so the smallest
// dx and smallest dy are both 0 — that lets a tapped board cell be used
// directly as the shape's top-left anchor with no extra math at placement time.
const BP_SHAPES = [
[[0,0]],
[[0,0],[1,0]],
[[0,0],[0,1]],
[[0,0],[1,0],[2,0]],
[[0,0],[0,1],[0,2]],
[[0,0],[1,0],[2,0],[3,0]],
[[0,0],[0,1],[0,2],[0,3]],
[[0,0],[1,0],[0,1],[1,1]],
[[0,0],[0,1],[0,2],[1,2]],
[[1,0],[1,1],[1,2],[0,2]],
[[0,0],[1,0],[2,0],[1,1]],
[[1,0],[2,0],[0,1],[1,1]],
[[0,0],[1,0],[1,1],[2,1]],
[[1,0],[0,1],[1,1],[2,1],[1,2]],
[[0,0],[1,0],[0,1]],
];
function bpRandomPiece(){
const shape = BP_SHAPES[Math.floor(Math.random()*BP_SHAPES.length)];
const color = BP_COLORS[Math.floor(Math.random()*BP_COLORS.length)];
return { shape, color, id: Math.random().toString(36).slice(2) };
}
function bpRefillTray(){ return [bpRandomPiece(), bpRandomPiece(), bpRandomPiece()]; }
function bpShapeDims(shape){
let mw=0, mh=0;
shape.forEach(([dx,dy])=>{ mw=Math.max(mw,dx+1); mh=Math.max(mh,dy+1); });
return {w:mw, h:mh};
}
function bpFits(board, shape, ar, ac){
for(const [dx,dy] of shape){
const r = ar+dy, c = ac+dx;
if(r<0||r>=BP_SIZE||c<0||c>=BP_SIZE) return false;
if(board[r][c]) return false;
}
return true;
}
function bpPieceFitsAnywhere(board, shape){
for(let r=0;r<BP_SIZE;r++) for(let c=0;c<BP_SIZE;c++) if(bpFits(board,shape,r,c)) return true;
return false;
}
function sizeBpGrid(){
const box = document.getElementById('bpGridBox');
const grid = document.getElementById('bpGrid');
if(!box||!grid) return;
const size = Math.max(0, Math.min(box.clientWidth, box.clientHeight));
grid.style.width = size+'px';
grid.style.height = size+'px';
}
window.addEventListener('resize', sizeBpGrid);
function createBlockPuzzleGame(){
let state;
function fresh(){
const board = [];
for(let r=0;r<BP_SIZE;r++) board.push(new Array(BP_SIZE).fill(null));
return { board, tray: bpRefillTray(), selected:0, score:0, over:false, best:PROG.getHighScore('blockpuzzle') };
}
function checkGameOver(){
return !state.tray.some(p=>p && bpPieceFitsAnywhere(state.board, p.shape));
}
function clearLines(){
const fullRows = [];
const fullCols = [];
for(let r=0;r<BP_SIZE;r++){ if(state.board[r].every(x=>x)) fullRows.push(r); }
for(let c=0;c<BP_SIZE;c++){ let full=true; for(let r=0;r<BP_SIZE;r++) if(!state.board[r][c]) full=false; if(full) fullCols.push(c); }
if(!fullRows.length && !fullCols.length) return 0;
fullRows.forEach(r=>{ for(let c=0;c<BP_SIZE;c++) state.board[r][c]=null; });
fullCols.forEach(c=>{ for(let r=0;r<BP_SIZE;r++) state.board[r][c]=null; });
return fullRows.length + fullCols.length;
}
function endRun(){
state.over = true;
PROG.setHighScore('blockpuzzle', state.score);
const stars = state.score>=220 ? 3 : state.score>=100 ? 2 : 1;
PROG.setStars('blockpuzzle', stars);
PROG.updateDisplay();
recordRoundComplete();
if(state.score>=220) unlockAchievement('blockpuzzle_master');
SFX.gameover();
setTimeout(()=>{
showGameOverOverlay('blockpuzzle', state.score, '🧩 Board Full!', `No more pieces fit — final score: ${state.score}`, [
{label:'Play Again', onClick:()=>{ state=fresh(); buildDOM(); hideOverlay(); }},
{label:'Home', onClick: goHome}
]);
},250);
}
function place(ar,ac){
const piece = state.tray[state.selected];
if(!piece || state.over) return;
if(!bpFits(state.board, piece.shape, ar, ac)){ SFX.wrong(); return; }
piece.shape.forEach(([dx,dy])=>{ state.board[ar+dy][ac+dx] = piece.color; });
state.score += piece.shape.length;
SFX.click();
state.tray[state.selected] = null;
const cleared = clearLines();
if(cleared){ state.score += cleared*10; SFX.match(); if(cleared>=2) SFX.levelup(); }
if(state.tray.every(p=>!p)) state.tray = bpRefillTray();
state.selected = state.tray.findIndex(p=>p);
if(state.selected<0) state.selected = 0;
buildDOM();
if(checkGameOver()) endRun();
}
function buildBoardDOM(){
const wrap = document.createElement('div');
wrap.className = 'bpGrid'; wrap.id = 'bpGrid';
for(let r=0;r<BP_SIZE;r++){
for(let c=0;c<BP_SIZE;c++){
const cell = document.createElement('div');
cell.className = 'bpCell';
if(state.board[r][c]){ cell.style.background = state.board[r][c]; cell.classList.add('filled'); }
cell.addEventListener('click', ()=> place(r,c));
wrap.appendChild(cell);
}
}
const existing = document.getElementById('bpGrid');
if(existing) existing.replaceWith(wrap); else { const box=document.getElementById('bpGridBox'); if(box) box.appendChild(wrap); }
sizeBpGrid();
}
function buildTrayDOM(){
const tray = document.getElementById('bpTray');
if(!tray) return;
tray.innerHTML = '';
state.tray.forEach((p,i)=>{
const slot = document.createElement('div');
slot.className = 'bpPieceSlot' + (i===state.selected?' selected':'') + (p?'':' empty');
if(p){
const {w,h} = bpShapeDims(p.shape);
const mini = document.createElement('div');
mini.className = 'bpMini';
mini.style.gridTemplateColumns = `repeat(${w},1fr)`;
mini.style.gridTemplateRows = `repeat(${h},1fr)`;
for(let y=0;y<h;y++) for(let x=0;x<w;x++){
const has = p.shape.some(([dx,dy])=>dx===x&&dy===y);
const d = document.createElement('div');
d.className = 'bpMiniCell' + (has?'':' bpMiniGap');
if(has) d.style.background = p.color;
mini.appendChild(d);
}
slot.appendChild(mini);
slot.onclick = ()=>{ state.selected=i; SFX.click(); buildTrayDOM(); };
}
tray.appendChild(slot);
});
}
function buildDOM(){
buildBoardDOM();
buildTrayDOM();
const sc=document.getElementById('bpScore');
if(sc) sc.textContent = `Score: ${state.score} • Best: ${Math.max(state.score,state.best)}`;
}
function update(dt){}
function draw(g){ drawFlatBg('#dff3ff','#f3ecff'); }
return {
title:'Block Puzzle', hint:'Tap a piece below, then tap the board to place it. Fill a row or column to clear it!',
domOverlay:true,
controlsHtml: `
<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;gap:8px;">
<div class="bpScore" id="bpScore">Score: 0</div>
<div id="bpGridBox" style="flex:1;min-height:0;width:100%;display:flex;justify-content:center;align-items:center;"></div>
<div class="bpTray" id="bpTray"></div>
</div>`,
bindControls(){ buildDOM(); },
create(){ state=fresh(); return this; },
restart(){ state=fresh(); buildDOM(); hideOverlay(); },
update, draw,
};
}

/* =========================================================
GAME 18 — Coloring Studio (freeform creativity/drawing — finger
paint on a blank canvas or a simple outline template. No score,
no losing, no time pressure — just make something and keep it.)
========================================================= */
const COL_COLORS = ['#1c2b3a','#ff6b6b','#ffb703','#fde047','#06d6a0','#4ecdc4','#4361ee','#9b5de5','#f72585','#ffffff'];
const COL_TEMPLATES = {
blank:null,
star: g=>{ g.beginPath(); const cx=g.canvas.width/2, cy=g.canvas.height/2, R=Math.min(cx,cy)*0.7; for(let i=0;i<10;i++){ const ang=-Math.PI/2+i*Math.PI/5; const r=i%2===0?R:R*0.45; const x=cx+Math.cos(ang)*r, y=cy+Math.sin(ang)*r; i===0?g.moveTo(x,y):g.lineTo(x,y); } g.closePath(); g.stroke(); },
heart: g=>{ const cx=g.canvas.width/2, cy=g.canvas.height/2, s=Math.min(cx,cy)/90; g.beginPath(); g.moveTo(cx,cy+60*s); g.bezierCurveTo(cx-120*s,cy-40*s,cx-40*s,cy-110*s,cx,cy-40*s); g.bezierCurveTo(cx+40*s,cy-110*s,cx+120*s,cy-40*s,cx,cy+60*s); g.closePath(); g.stroke(); },
rocket: g=>{ const cx=g.canvas.width/2, cy=g.canvas.height/2, s=Math.min(cx,cy)/100; g.beginPath(); g.moveTo(cx,cy-90*s); g.quadraticCurveTo(cx+40*s,cy-20*s,cx+28*s,cy+60*s); g.lineTo(cx+12*s,cy+40*s); g.lineTo(cx-12*s,cy+40*s); g.lineTo(cx-28*s,cy+60*s); g.quadraticCurveTo(cx-40*s,cy-20*s,cx,cy-90*s); g.closePath(); g.moveTo(cx-28*s,cy+30*s); g.lineTo(cx-55*s,cy+80*s); g.lineTo(cx-12*s,cy+55*s); g.moveTo(cx+28*s,cy+30*s); g.lineTo(cx+55*s,cy+80*s); g.lineTo(cx+12*s,cy+55*s); g.stroke(); g.beginPath(); g.arc(cx,cy-25*s,14*s,0,Math.PI*2); g.stroke(); },
bear: g=>{ const cx=g.canvas.width/2, cy=g.canvas.height/2, s=Math.min(cx,cy)/100; g.beginPath(); g.arc(cx,cy+10*s,55*s,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(cx-38*s,cy-45*s,18*s,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(cx+38*s,cy-45*s,18*s,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(cx-18*s,cy,6*s,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(cx+18*s,cy,6*s,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(cx,cy+18*s,8*s,0,Math.PI*2); g.stroke(); },
};
function createColoringGame(){
let state;
function fresh(){ return { color: COL_COLORS[1], size:8, template:'blank', drawing:false, strokes:0, over:false }; }
function paintCanvas(){ return document.getElementById('colCanvas'); }
function drawTemplate(){
const cv = paintCanvas(); if(!cv) return;
const g = cv.getContext('2d');
g.fillStyle = '#ffffff'; g.fillRect(0,0,cv.width,cv.height);
const t = COL_TEMPLATES[state.template];
if(t){ g.save(); g.strokeStyle='rgba(28,43,58,0.35)'; g.lineWidth=4; t(g); g.restore(); }
}
function sizeCanvas(){
const cv = paintCanvas(); const box = document.getElementById('colCanvasBox');
if(!cv||!box) return;
const w = Math.max(1, Math.round(box.clientWidth)), h = Math.max(1, Math.round(box.clientHeight));
if(cv.width!==w || cv.height!==h){ cv.width=w; cv.height=h; }
}
window.addEventListener('resize', ()=>{ sizeCanvas(); drawTemplate(); });
function pos(e,cv){ const r = cv.getBoundingClientRect(); return { x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height) }; }
function bindCanvas(){
const cv = paintCanvas();
if(!cv || cv.dataset.bound) return;
cv.dataset.bound = '1';
let last = null;
cv.addEventListener('pointerdown', e=>{ e.preventDefault(); SFX.unlock(); state.drawing=true; last=pos(e,cv); state.strokes++; const g=cv.getContext('2d'); g.fillStyle=state.color; g.beginPath(); g.arc(last.x,last.y,state.size/2,0,Math.PI*2); g.fill(); });
cv.addEventListener('pointermove', e=>{ if(!state.drawing) return; e.preventDefault(); const p=pos(e,cv); const g=cv.getContext('2d'); g.strokeStyle=state.color; g.lineWidth=state.size; g.lineCap='round'; g.lineJoin='round'; g.beginPath(); g.moveTo(last.x,last.y); g.lineTo(p.x,p.y); g.stroke(); last=p; });
const stop = ()=>{ state.drawing=false; last=null; };
cv.addEventListener('pointerup', stop);
cv.addEventListener('pointerleave', stop);
cv.addEventListener('contextmenu', e=>e.preventDefault());
}
function buildToolbar(){
const colRow = document.getElementById('colColors');
if(colRow){
colRow.innerHTML = '';
COL_COLORS.forEach(c=>{
const b = document.createElement('button');
b.className = 'colSwatch' + (c===state.color?' sel':''); b.style.background = c; b.type='button';
b.onclick = ()=>{ state.color=c; SFX.click(); document.querySelectorAll('.colSwatch').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); };
colRow.appendChild(b);
});
}
const sizeRow = document.getElementById('colSizes');
if(sizeRow){
sizeRow.innerHTML = '';
[['S',5],['M',12],['L',22]].forEach(([label,val])=>{
const b = document.createElement('button');
b.className = 'colSizeBtn' + (val===state.size?' sel':''); b.type='button'; b.textContent = label;
b.onclick = ()=>{ state.size=val; SFX.click(); document.querySelectorAll('.colSizeBtn').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); };
sizeRow.appendChild(b);
});
}
const tplRow = document.getElementById('colTemplates');
if(tplRow){
tplRow.innerHTML = '';
[['✏️','blank'],['⭐','star'],['❤️','heart'],['🚀','rocket'],['🐻','bear']].forEach(([icon,id])=>{
const b = document.createElement('button');
b.className = 'colTplBtn' + (id===state.template?' sel':''); b.type='button'; b.textContent = icon;
b.onclick = ()=>{ state.template=id; SFX.click(); drawTemplate(); document.querySelectorAll('.colTplBtn').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); };
tplRow.appendChild(b);
});
}
const clearBtn = document.getElementById('colClearBtn');
if(clearBtn) clearBtn.onclick = ()=>{ SFX.click(); drawTemplate(); };
const doneBtn = document.getElementById('colDoneBtn');
if(doneBtn) doneBtn.onclick = ()=>{
if(state.over) return;
state.over = true;
PROG.setStars('coloring', 3);
PROG.updateDisplay();
recordRoundComplete();
unlockAchievement('creative_spirit');
SFX.levelup();
const cv = paintCanvas();
let dataUrl = null;
try{ dataUrl = cv.toDataURL('image/png'); }catch(e){}
setTimeout(()=>{
showOverlay('🎨 Nice Creation!', 'Want to save it to your device?', [
{label:'💾 Save Picture', onClick:()=>{
if(!dataUrl){ hideOverlay(); return; }
const a = document.createElement('a');
a.href = dataUrl; a.download = 'my-stickman-drawing.png';
document.body.appendChild(a); a.click(); a.remove();
}},
{label:'🖌️ New Drawing', onClick:()=>{ state=fresh(); buildDOM(); hideOverlay(); }},
{label:'Home', onClick: goHome}
]);
},150);
};
}
function buildDOM(){
buildToolbar();
sizeCanvas();
drawTemplate();
bindCanvas();
}
function update(dt){}
function draw(g){ drawFlatBg('#fff3d6','#ffe9f5'); }
return {
title:'Coloring Studio', hint:'Pick a color and draw! Try a template outline or start from blank.',
domOverlay:true,
controlsHtml: `
<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:6px;">
<div class="colToolbar">
<div class="colRow" id="colTemplates"></div>
<div class="colRow" id="colColors"></div>
<div class="colRow">
<span class="colSizes" id="colSizes"></span>
<button class="colActionBtn" id="colClearBtn" type="button">🧹 Clear</button>
<button class="colActionBtn colDone" id="colDoneBtn" type="button">✅ I'm Done!</button>
</div>
</div>
<div id="colCanvasBox" style="flex:1;min-height:0;width:100%;border-radius:12px;overflow:hidden;background:#fff;">
<canvas id="colCanvas" style="width:100%;height:100%;display:block;touch-action:none;"></canvas>
</div>
</div>`,
bindControls(){ buildDOM(); },
create(){ state=fresh(); return this; },
restart(){ state=fresh(); buildDOM(); hideOverlay(); },
update, draw,
};
}
