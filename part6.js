const swordControlsHtml = `
  <div class="padBtns">
    <button class="ctlBtn" id="btnLeft">◀</button>
    <button class="ctlBtn" id="btnRight">▶</button>
  </div>
  <div class="actionBtns">
    <button class="ctlBtn attack" id="btnAttack">⚔️</button>
    <button class="ctlBtn block" id="btnBlock">🛡️</button>
  </div>`;
const martialControlsHtml = `
  <div class="padBtns">
    <button class="ctlBtn" id="btnLeft">◀</button>
    <button class="ctlBtn" id="btnRight">▶</button>
  </div>
  <div class="actionBtns">
    <button class="ctlBtn punch" id="btnPunch">👊</button>
    <button class="ctlBtn kick" id="btnKick">🦵</button>
    <button class="ctlBtn block" id="btnBlock">🛡️</button>
  </div>`;

function bindMoveKeys(){
  bindHoldBtn('btnLeft','left');
  bindHoldBtn('btnRight','right');
  bindHoldBtn('btnBlock','block');
}

const GAMES = {
  sword: {
    title:'Sword Duel', hint:'Move ◀▶, tap ⚔️ to attack in range, hold 🛡️ to block! (arrows/space/shift on keyboard)',
    controlsHtml: swordControlsHtml,
    bindControls(){
      bindMoveKeys();
      bindTapBtn('btnAttack', ()=>{ keys['doAttack']=true; });
    },
    create(){ return createFightGame({
      gameId:'sword',
      weapon:'sword', title:'Sword Duel', hint:'', controlsHtml: swordControlsHtml,
      bindControls: this.bindControls,
      bg1:'#a6c9ff', bg2:'#eaf6ff',
      playerColor:'#2b6cb0', npcColor:'#e63946',
      playerLabel:'You',
      npcNameForLevel: l=>['Squire','Bandit','Knight','Champion','Dragon Lord'][l-1]||'Foe',
      levelWinText: l=>`You defeated the ${['Squire','Bandit','Knight','Champion'][l-1]}! Next up: a tougher opponent.`,
      finalTitle:'Sword Master',
      accessory:'band', accColorPlayer:()=>'#ffe27a', accColorNpc:()=>'#f4f4f4',
    }).create(); },
    restart(){ currentGame.restart(); },
    update(dt){ currentGame.update(dt); }, draw(g){ currentGame.draw(g); },
  },
  martial: {
    title:'Dojo Kicks', hint:'Move ◀▶, 👊 punch, 🦵 kick, hold 🛡️ block! (Z/X/shift on keyboard)',
    controlsHtml: martialControlsHtml,
    bindControls(){
      bindMoveKeys();
      bindTapBtn('btnPunch', ()=>{ keys['doPunch']=true; });
      bindTapBtn('btnKick', ()=>{ keys['doKick']=true; });
    },
    create(){ return createFightGame({
      gameId:'martial',
      weapon:'fists', title:'Dojo Kicks', hint:'', controlsHtml: martialControlsHtml,
      bindControls: this.bindControls,
      bg1:'#ffe0b3', bg2:'#fff6e6',
      playerColor:'#2ec4b6', npcColor:'#9b5de5',
      playerLabel:'You',
      npcNameForLevel: l=>['White Belt','Yellow Belt','Green Belt','Blue Belt','Black Belt Master'][l-1]||'Rival',
      levelWinText: l=>`You earned your next belt by beating the ${['White Belt','Yellow Belt','Green Belt','Blue Belt'][l-1]}!`,
      finalTitle:'Black Belt Legend',
      accessory:'band', accColorPlayer:l=>BELT_COLORS[l-1]||'#1c2b3a', accColorNpc:l=>BELT_COLORS[l-1]||'#1c2b3a',
    }).create(); },
    restart(){ currentGame.restart(); },
    update(dt){ currentGame.update(dt); }, draw(g){ currentGame.draw(g); },
  },
  runner: createRunnerGame(),
  hoops: createHoopsGame(),
  ninja: createNinjaGame(),
  memory: createMemoryGame(),
  reaction: createReactionGame(),
  platformer: createPlatformerGame(),
  bubble: createBubbleGame(),
  racer: createRacerGame(),
  galaxy: createGalaxyGame(),
  sniper: createSniperGame(),
  archery: createArcheryGame(),
  swimmer: createSwimmerGame(),
  tycoon: createTycoonGame(),
  fortdefense: createFortDefenseGame(),
blockpuzzle: createBlockPuzzleGame(),
coloring: createColoringGame(),
wordscramble: createWordScrambleGame(),
whackamole: createWhackAMoleGame(),
};

/* Keyboard bindings shared across fight games */
window.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft') keys['left']=true;
  if(e.key==='ArrowRight') keys['right']=true;
  if(e.key==='ArrowUp') keys['jump']=true;
  if(e.key==='ArrowDown') keys['duck']=true;
  if(e.key===' ') keys['doAttack']=true;
  if(e.key==='Shift') keys['block']=true;
  if(e.key==='z'||e.key==='Z') keys['doPunch']=true;
  if(e.key==='x'||e.key==='X') keys['doKick']=true;
  if(e.key==='f'||e.key==='F') keys['doFire']=true;
});
window.addEventListener('keyup', e=>{
  if(e.key==='ArrowLeft') keys['left']=false;
  if(e.key==='ArrowRight') keys['right']=false;
  if(e.key==='ArrowDown') keys['duck']=false;
  if(e.key==='Shift') keys['block']=false;
});

/* =========================================================
   HOME SCREEN CARDS
   ========================================================= */
const CARD_DATA = [
  {id:'sword', icon:'⚔️', name:'Sword Duel', desc:'Battle 5 rising opponents with your blade.', tags:['action','fighting','boss'], color:['#334155','#64748b'], isNew:false, editorPick:true},
  {id:'martial', icon:'🥋', name:'Dojo Kicks', desc:'Punch & kick your way to Black Belt.', tags:['action','fighting'], color:['#7c2d12','#ea580c'], isNew:false, editorPick:false},
  {id:'runner', icon:'🏃', name:'Stickman Dash', desc:'Jump & duck an endless obstacle run.', tags:['action','endless','reflex'], color:['#0ea5e9','#38bdf8'], isNew:false, editorPick:false},
  {id:'hoops', icon:'🏀', name:'Hoop Shootout', desc:'Slingshot swishes before time runs out.', tags:['sports','arcade'], color:['#f97316','#fb923c'], isNew:false, editorPick:false},
  {id:'ninja', icon:'🍉', name:'Ninja Fruit Slice', desc:'Swipe fruit, dodge bombs, chain combos.', tags:['arcade','reflex','slicing'], color:['#166534','#22c55e'], isNew:false, editorPick:false},
  {id:'memory', icon:'🧠', name:'Memory Match', desc:'Flip & match the stickman card pairs!', tags:['puzzle','brain'], color:['#7c3aed','#a78bfa'], isNew:false, editorPick:false},
  {id:'reaction', icon:'⚡', name:'Reaction Time', desc:'Test your reflexes — tap fast!', tags:['arcade','reflex','brain'], color:['#ca8a04','#fde047'], isNew:false, editorPick:false},
  {id:'platformer', icon:'🏁', name:'Stickman Quest', desc:'Jump, collect, stomp, reach the flag!', tags:['adventure','platformer','music'], color:['#059669','#34d399'], isNew:false, editorPick:true},
  {id:'bubble', icon:'🫧', name:'Bubble Shooter', desc:'Aim, shoot, match 3+ to pop bubbles!', tags:['puzzle','arcade','colorful'], color:['#db2777','#f472b6'], isNew:false, editorPick:false},
  {id:'racer', icon:'🏎️', name:'Stickman Racer', desc:'Dodge hurdles, boost, win the race!', tags:['action','endless','driving'], color:['#dc2626','#f87171'], isNew:false, editorPick:false},
  {id:'galaxy', icon:'👾', name:'Stick Galaxy', desc:'Blast neon aliens, grab power-ups, beat the boss!', tags:['action','shooter','space','boss'], color:['#4c1d95','#7c3aed'], isNew:false, editorPick:true},
  {id:'sniper', icon:'🎯', name:'Stick Sharpshooter', desc:'Deactivate 10 rogue robots before their timer runs out!', tags:['action','precision','arcade','timed'], color:['#1e3a8a','#3b82f6'], isNew:false, editorPick:false},
  {id:'archery', icon:'🏹', name:'Stick Archery Royale', desc:'10 archers enter a free-for-all. Be the last one standing!', tags:['action','sports','battle','arcade'], color:['#92400e','#fbbf24'], isNew:false, editorPick:false},
  {id:'swimmer', icon:'🏊', name:'Stick Swimmer Olympics', desc:'Mash to swim! Race 8-lane heats for the podium.', tags:['sports','racing','olympics','arcade'], color:['#0e7490','#22d3ee'], isNew:false, editorPick:false},
  {id:'tycoon', icon:'💰', name:'Coin Rush Tycoon', desc:'Tap for gold, hire helpers, shoo the sneaky Coin Goblin!', tags:['clicker','tycoon','arcade'], color:['#b45309','#fbbf24'], isNew:false, editorPick:true},
  {id:'fortdefense', icon:'🏰', name:'Stick Fort Defense', desc:'Place defenders, hold 3 lanes, beat the big boss wave!', tags:['strategy','tower defense','boss'], color:['#166534','#4ade80'], isNew:false, editorPick:false},
{id:'blockpuzzle', icon:'🧩', name:'Block Puzzle', desc:'Place blocks to clear rows and columns. How high can you score?', tags:['puzzle','brain','strategy'], color:['#0f766e','#2dd4bf'], isNew:true, editorPick:true},
{id:'coloring', icon:'🎨', name:'Coloring Studio', desc:'Pick a color and paint! Try a template or draw something new.', tags:['creativity','art','relaxing'], color:['#be185d','#f9a8d4'], isNew:true, editorPick:false},
{id:'wordscramble', icon:'🔤', name:'Word Scramble', desc:'Unscramble the letters to spell 10 picture-clue words!', tags:['word','brain','educational'], color:['#1d4ed8','#60a5fa'], isNew:true, editorPick:false},
{id:'whackamole', icon:'🔨', name:'Whack-a-Mole', desc:'Whack the fighters fast — but dodge the sneaky bandit!', tags:['arcade','reflex','quick'], color:['#a16207','#fde047'], isNew:true, editorPick:false},
];

/* =========================================================
   ACHIEVEMENTS — definitions (unlock state itself lives in the ACH
   module in part1.js; this is just the human-readable catalog).
   ========================================================= */
const ACH_DEFS = [
  {id:'first_steps', icon:'👣', name:'First Steps', desc:'Play your very first game.'},
  {id:'explorer', icon:'🗺️', name:'Explorer', desc:'Play every game at least once.'},
  {id:'dedicated_10', icon:'🎮', name:'Getting Good', desc:'Complete 10 rounds across any games.'},
  {id:'dedicated_50', icon:'🏋️', name:'Stickman Veteran', desc:'Complete 50 rounds across any games.'},
  {id:'streak_3', icon:'🔥', name:'On a Roll', desc:'Play 3 games in one visit.'},
  {id:'streak_10', icon:'💥', name:'Unstoppable', desc:'Play 10 games in one visit.'},
  {id:'return_player', icon:'📅', name:'Back Again!', desc:'Visit the site on 2 different days.'},
  {id:'week_regular', icon:'🗓️', name:'Regular', desc:'Visit the site on 5 different days.'},
  {id:'favorite_fan', icon:'💗', name:'Favorite Fan', desc:'Favorite 3 different games.'},
  {id:'sword_champion', icon:'⚔️', name:'Sword Master', desc:'Defeat all 5 opponents in Sword Duel.'},
  {id:'martial_blackbelt', icon:'🥋', name:'Black Belt', desc:'Earn the Black Belt in Dojo Kicks.'},
  {id:'runner_500', icon:'🏃', name:'Marathoner', desc:'Score 500m+ in Stickman Dash.'},
  {id:'hoops_allstar', icon:'🏀', name:'All-Star', desc:'Score 15+ points in Hoop Shootout.'},
  {id:'ninja_master', icon:'🍉', name:'Ninja Master', desc:'Score 40+ points in Ninja Fruit Slice.'},
  {id:'memory_genius', icon:'🧠', name:'Memory Genius', desc:'Finish Memory Match with a perfect no-miss run.'},
  {id:'reaction_lightning', icon:'⚡', name:'Lightning Reflexes', desc:'Average under 250ms in Reaction Time.'},
  {id:'quest_hero', icon:'🏁', name:'Quest Hero', desc:'Reach the flag in Stickman Quest.'},
  {id:'bubble_master', icon:'🫧', name:'Bubble Master', desc:'Clear the whole board in Bubble Shooter.'},
  {id:'racer_champion', icon:'🏎️', name:'Racing Champion', desc:'Win the race in Stickman Racer.'},
  {id:'galaxy_saved', icon:'👾', name:'Galaxy Saved', desc:'Beat all 5 waves and the boss in Stick Galaxy.'},
  {id:'sniper_hero', icon:'🎯', name:'Extraction Complete', desc:'Deactivate all 10 targets in Stick Sharpshooter.'},
  {id:'archery_champion', icon:'🏹', name:'Last One Standing', desc:'Win the free-for-all in Stick Archery Royale.'},
  {id:'swim_gold', icon:'🏊', name:'Olympic Champion', desc:'Finish top 3 in all 3 heats of Stick Swimmer Olympics.'},
  {id:'tycoon_richest', icon:'💰', name:'Tycoon Master', desc:'Earn 1500+ gold in one Coin Rush Tycoon run.'},
  {id:'tycoon_goblin_slayer', icon:'🧌', name:'Goblin Slayer', desc:'Shoo away 5 Coin Goblin raids in one run.'},
  {id:'fortdefense_boss_defeated', icon:'🏰', name:'Fort Victorious', desc:'Defeat King Wobblestomp in Stick Fort Defense.'},
  {id:'fortdefense_flawless', icon:'🛡️', name:'Flawless Defense', desc:'Win Stick Fort Defense with 90%+ Fort HP remaining.'},
{id:'blockpuzzle_master', icon:'🧩', name:'Block Master', desc:'Score 220+ points in Block Puzzle.'},
{id:'creative_spirit', icon:'🎨', name:'Creative Spirit', desc:'Finish a drawing in Coloring Studio.'},
{id:'word_wizard', icon:'🔤', name:'Word Wizard', desc:'Correctly spell 8+ words in one Word Scramble run.'},
{id:'mole_master', icon:'🔨', name:'Mole Master', desc:'Score 20+ points in Whack-a-Mole.'},
];

/* =========================================================
   LEADERBOARDS (local, per-device) — which games track one, whether a
   lower or higher number wins, and how to format the raw stored number.
   ========================================================= */
const LB_GAMES = [
  {id:'sword', name:'Sword Duel', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
  {id:'martial', name:'Dojo Kicks', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
  {id:'runner', name:'Stickman Dash', higherIsBetter:true, format:s=>Math.round(s)+'m'},
  {id:'hoops', name:'Hoop Shootout', higherIsBetter:true, format:s=>s+' pts'},
  {id:'ninja', name:'Ninja Fruit Slice', higherIsBetter:true, format:s=>s+' pts'},
  {id:'memory', name:'Memory Match', higherIsBetter:false, format:s=>s+' moves'},
  {id:'reaction', name:'Reaction Time', higherIsBetter:false, format:s=>Math.round(s)+'ms'},
  {id:'platformer', name:'Stickman Quest', higherIsBetter:true, format:s=>s+' coins'},
  {id:'bubble', name:'Bubble Shooter', higherIsBetter:true, format:s=>s+' pts'},
  {id:'racer', name:'Stickman Racer', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
  {id:'galaxy', name:'Stick Galaxy', higherIsBetter:true, format:s=>s+' pts'},
  {id:'sniper', name:'Stick Sharpshooter', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
  {id:'archery', name:'Stick Archery Royale', higherIsBetter:true, format:s=>s+' kills'},
  {id:'swimmer', name:'Stick Swimmer Olympics', higherIsBetter:false, format:s=>s.toFixed(1)+'s'},
  {id:'tycoon', name:'Coin Rush Tycoon', higherIsBetter:true, format:s=>Math.round(s)+'g'},
  {id:'fortdefense', name:'Stick Fort Defense', higherIsBetter:true, format:s=>Math.round(s)+' pts'},
{id:'blockpuzzle', name:'Block Puzzle', higherIsBetter:true, format:s=>s+' pts'},
{id:'wordscramble', name:'Word Scramble', higherIsBetter:true, format:s=>s+'/10'},
{id:'whackamole', name:'Whack-a-Mole', higherIsBetter:true, format:s=>s+' pts'},
];
function populateLbModal(){
  const sel = document.getElementById('lbGameSelect');
  if(!sel) return;
  sel.innerHTML = '';
  LB_GAMES.forEach(cfg=>{
    const opt = document.createElement('option');
    opt.value = cfg.id; opt.textContent = cfg.name;
    sel.appendChild(opt);
  });
  sel.onchange = ()=> renderLbModalList(sel.value);
  renderLbModalList(sel.value);
}
function renderLbModalList(gameId){
  const cfg = LB_GAMES.find(g=>g.id===gameId);
  const list = document.getElementById('lbModalList');
  if(!list || !cfg) return;
  list.innerHTML = '';
  const entries = LB.getScores(gameId);
  if(!entries.length){
    const li = document.createElement('li');
    li.className = 'lbEmpty';
    li.textContent = 'No scores yet — be the first!';
    list.appendChild(li);
  } else {
    entries.forEach((e,i)=>{
      const li = document.createElement('li');
      const rank = document.createElement('span'); rank.className='lbRank'; rank.textContent=(i+1)+'.';
      const name = document.createElement('span'); name.className='lbName'; name.textContent=e.name;
      const sc = document.createElement('span'); sc.className='lbScore'; sc.textContent=cfg.format(e.score);
      li.appendChild(rank); li.appendChild(name); li.appendChild(sc);
      list.appendChild(li);
    });
  }
}
(function(){
  const openBtn = document.getElementById('btnLeaderboards');
  const modal = document.getElementById('lbModal');
  const closeBtn = document.getElementById('lbModalClose');
  if(openBtn && modal){
    openBtn.onclick = ()=>{ SFX.click(); populateLbModal(); modal.classList.add('show'); };
  }
  if(closeBtn && modal){
    closeBtn.onclick = ()=>{ SFX.click(); modal.classList.remove('show'); };
  }
})();
/* =========================================================
   CARD BUILDER — one shared card component used by every home
   section (All Games, Editor's Picks, New This Week, Continue
   Playing, Favorites) and by the in-game "You May Also Like" strip.
   ========================================================= */
function buildCard(c){
  const div = document.createElement('div');
  div.className = 'card';
  const playCount = CONT.getPlayCount(c.id);
  const isFav = FAV.isFav(c.id);
  const grad = 'linear-gradient(135deg,' + c.color[0] + ',' + c.color[1] + ')';
  div.innerHTML = `
    <div class="art" style="background:${grad}">
      ${c.isNew ? '<span class="badge new">NEW</span>' : ''}
      ${c.editorPick ? '<span class="badge pick">👑 PICK</span>' : ''}
      <span class="icon">${c.icon}</span>
      <button class="heart" aria-label="Favorite">${isFav ? '❤️' : '🤍'}</button>
    </div>
    <div class="body">
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      ${playCount > 0 ? `<div class="meta">Played ${playCount}× on this device</div>` : ''}
      <button class="playBtn">Play ▶</button>
    </div>`;
  const heartBtn = div.querySelector('.heart');
  heartBtn.onclick = (e)=>{
    e.stopPropagation();
    const nowFav = FAV.toggle(c.id);
    heartBtn.textContent = nowFav ? '❤️' : '🤍';
    SFX.click();
    if(nowFav){
      showToast('❤️ Added to Favorites!');
      if(FAV.getAll().length >= 3) unlockAchievement('favorite_fan');
    }
    refreshHomeSections();
  };
  div.onclick = ()=>{ SFX.unlock(); SFX.click(); startGame(c.id); };
  return div;
}
function renderGrid(gridId, ids){
  const grid = document.getElementById(gridId);
  if(!grid) return;
  grid.innerHTML = '';
  ids.forEach(id=>{
    const c = CARD_DATA.find(x=>x.id===id);
    if(c) grid.appendChild(buildCard(c));
  });
}
function updateAchBadge(){
  const badge = document.getElementById('achBadge');
  if(badge) badge.textContent = ACH.getCount() + '/' + ACH_DEFS.length;
}
function refreshHomeSections(){
  const recentIds = CONT.getRecent(6).map(r=>r.id);
  const secC = document.getElementById('sectionContinue');
  if(secC) secC.style.display = recentIds.length ? '' : 'none';
  renderGrid('gridContinue', recentIds);

  const favIds = FAV.getAll().filter(id=>CARD_DATA.some(c=>c.id===id));
  const secF = document.getElementById('sectionFav');
  if(secF) secF.style.display = favIds.length ? '' : 'none';
  renderGrid('gridFav', favIds);

  renderGrid('gridPicks', CARD_DATA.filter(c=>c.editorPick).map(c=>c.id));
  renderGrid('gridNew', CARD_DATA.filter(c=>c.isNew).map(c=>c.id));
  renderGrid('cardGrid', CARD_DATA.map(c=>c.id));
  updateAchBadge();
}
refreshHomeSections();

/* =========================================================
   DAILY GAME OF THE DAY — deterministic pick from the calendar date,
   no backend needed since every device computes the same index for
   the same date.
   ========================================================= */
function getDailyGameId(){
  const d = new Date();
  const key = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return CARD_DATA[key % CARD_DATA.length].id;
}
(function(){
  const c = CARD_DATA.find(x=>x.id===getDailyGameId());
  if(!c) return;
  const icon = document.getElementById('dailyIcon');
  const name = document.getElementById('dailyName');
  const banner = document.getElementById('dailyBanner');
  const playBtn = document.getElementById('dailyPlayBtn');
  if(icon) icon.textContent = c.icon;
  if(name) name.textContent = c.name;
  const openIt = ()=>{ SFX.unlock(); SFX.click(); startGame(c.id); };
  if(banner) banner.onclick = openIt;
  if(playBtn) playBtn.onclick = (e)=>{ e.stopPropagation(); openIt(); };
})();

/* =========================================================
   LIVE PLAYER COUNT BADGE — playful, kid-friendly "social proof" touch on
   the home screen. This is NOT a real live count (there's no backend/server
   to measure it — this whole site is static, per the README) — it's a
   believable-looking number that follows a rough day/time curve (more
   "players" in the after-school/evening hours, fewer overnight) plus a
   gentle random walk so it feels alive rather than static. Purely cosmetic,
   never persisted, never sent anywhere.
   ========================================================= */
const LIVE_COUNT = (function(){
  let current = null;
  // Rough 24-hour shape: quiet overnight, ramps up after school lets out,
  // peaks in the evening, tapers off toward bedtime.
  const HOURLY_BASE = [16,12,9,7,6,7,10,18,26,32,36,40,44,48,56,70,86,100,108,102,84,60,40,24];
  function baseForNow(){
    const d = new Date();
    const b = HOURLY_BASE[d.getHours()];
    // small day-to-day variety so it's not the exact same curve every day,
    // seeded off the calendar date (same trick getDailyGameId uses above)
    const seed = d.getFullYear()*372 + d.getMonth()*31 + d.getDate();
    const variance = (seed % 15) - 7; // -7..+7
    return Math.max(6, b + variance);
  }
  function tick(){
    const target = baseForNow();
    if(current==null) current = target;
    current += Math.round(rand(-3,3));
    current = clamp(current, Math.max(4,target-12), target+12);
    return current;
  }
  return { tick };
})();
(function(){
  const textEl = document.getElementById('liveCountText');
  if(!textEl) return;
  function render(){
    textEl.textContent = LIVE_COUNT.tick().toLocaleString() + ' playing right now';
  }
  render();
  setInterval(render, 5000);
})();

/* =========================================================
   RECOMMENDATIONS — "You May Also Like", scored by shared tags
   ========================================================= */
function scoreSimilarity(a,b){
  if(!a.tags || !b.tags) return 0;
  return a.tags.filter(t=>b.tags.includes(t)).length;
}
function getRelatedGames(gameId, limit){
  const base = CARD_DATA.find(c=>c.id===gameId);
  if(!base) return [];
  return CARD_DATA.filter(c=>c.id!==gameId)
    .map(c=>({c, score: scoreSimilarity(base,c) + Math.random()*0.01}))
    .sort((x,y)=>y.score-x.score)
    .slice(0, limit||6)
    .map(x=>x.c);
}
function renderRelatedGames(gameId){
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('gridRelated');
  if(!section || !grid) return;
  const related = getRelatedGames(gameId, 6);
  grid.innerHTML = '';
  related.forEach(c=>grid.appendChild(buildCard(c)));
  section.style.display = related.length ? '' : 'none';
}

/* =========================================================
   ACHIEVEMENTS MODAL
   ========================================================= */
function renderAchModal(){
  const list = document.getElementById('achList');
  if(!list) return;
  list.innerHTML = '';
  const unlockedIds = ACH.getAll();
  ACH_DEFS.forEach(a=>{
    const unlocked = unlockedIds.includes(a.id);
    const div = document.createElement('div');
    div.className = 'achItem' + (unlocked ? ' unlocked' : '');
    div.innerHTML = `<div class="achIcon">${a.icon}</div><div class="achText"><div class="achName">${a.name}</div><div class="achDesc">${unlocked ? a.desc : '🔒 ' + a.desc}</div></div>`;
    list.appendChild(div);
  });
  const countEl = document.getElementById('achModalCount');
  if(countEl) countEl.textContent = '(' + unlockedIds.length + '/' + ACH_DEFS.length + ')';
}
(function(){
  const openBtn = document.getElementById('btnAchievements');
  const modal = document.getElementById('achModal');
  const closeBtn = document.getElementById('achModalClose');
  if(openBtn && modal){
    openBtn.onclick = ()=>{ SFX.click(); renderAchModal(); modal.classList.add('show'); };
  }
  if(closeBtn && modal){
    closeBtn.onclick = ()=>{ SFX.click(); modal.classList.remove('show'); };
  }
})();

/* =========================================================
   SURPRISE ME — slot-machine style random game picker
   ========================================================= */
(function(){
  const openBtn = document.getElementById('btnSurprise');
  const modal = document.getElementById('spinModal');
  const closeBtn = document.getElementById('spinModalClose');
  const goBtn = document.getElementById('spinGoBtn');
  const playBtn = document.getElementById('spinPlayBtn');
  const inner = document.getElementById('spinReelInner');
  if(!openBtn || !modal || !inner) return;
  let chosen = null;
  const ITEM_H = 96;
  function buildReel(){
    inner.style.transition = 'none';
    inner.style.transform = 'translateY(0)';
    inner.innerHTML = '';
    const seq = [];
    for(let i=0;i<22;i++) seq.push(CARD_DATA[Math.floor(Math.random()*CARD_DATA.length)]);
    const winner = CARD_DATA[Math.floor(Math.random()*CARD_DATA.length)];
    seq.push(winner);
    seq.forEach(c=>{
      const item = document.createElement('div');
      item.className = 'spinReelItem';
      item.innerHTML = c.icon + `<div class="srName">${c.name}</div>`;
      inner.appendChild(item);
    });
    return { winner, count: seq.length };
  }
  function spin(){
    SFX.click();
    playBtn.style.display = 'none';
    const { winner, count } = buildReel();
    chosen = winner;
    requestAnimationFrame(()=>{
      inner.style.transition = 'transform 2.2s cubic-bezier(.12,.85,.2,1)';
      inner.style.transform = `translateY(-${(count-1)*ITEM_H}px)`;
    });
    setTimeout(()=>{
      SFX.powerup();
      playBtn.style.display = '';
      playBtn.textContent = 'Play ' + winner.name + '! ▶';
    }, 2300);
  }
  openBtn.onclick = ()=>{
    SFX.click();
    playBtn.style.display = 'none';
    inner.style.transition = 'none';
    inner.style.transform = 'translateY(0)';
    inner.innerHTML = '';
    modal.classList.add('show');
  };
  goBtn.onclick = spin;
  playBtn.onclick = ()=>{
    if(!chosen) return;
    modal.classList.remove('show');
    SFX.unlock(); SFX.click();
    startGame(chosen.id);
  };
  if(closeBtn) closeBtn.onclick = ()=>{ SFX.click(); modal.classList.remove('show'); };
})();

/* =========================================================
   BACKGROUND MUSIC (procedural — no external files)
   ========================================================= */
const BGM = (function(){
  let actx = null, playing = false, source = null, gain = null;
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
      gain = actx.createGain();
      gain.gain.value = 0.06;
      gain.connect(actx.destination);
      unlockBuffer(actx);
    }
    if(actx.state==='suspended') actx.resume().catch(()=>{});
    return actx;
  }
  function start(){
    const c = ensure(); if(!c || playing) return;
    playing = true;
    tick();
  }
  function stop(){
    playing = false;
    if(source){ try{ source.stop(); }catch(e){} source=null; }
  }
  const NOTES = [262,294,330,349,392,440,494,523]; // C4-C5
  let noteIdx = 0, beat = 0;
  function tick(){
    if(!playing) return;
    const c = actx;
    if(!c) return;
    try{
      const now = c.currentTime;
      // bass pulse every 2 beats
      const freq = NOTES[noteIdx % NOTES.length] * 0.5; // bass octave
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq*1.02, now+0.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.3);
      osc.connect(g); g.connect(gain);
      osc.start(now); osc.stop(now+0.35);
      // arp on beat 0
      if(beat % 4 === 0){
        const arp = c.createOscillator();
        arp.type = 'sine';
        arp.frequency.setValueAtTime(NOTES[(noteIdx+7)%8], now);
        arp.frequency.exponentialRampToValueAtTime(NOTES[(noteIdx+12)%8], now+0.15);
        const ag = c.createGain();
        ag.gain.setValueAtTime(0.04, now);
        ag.gain.exponentialRampToValueAtTime(0.001, now+0.2);
        arp.connect(ag); ag.connect(gain);
        arp.start(now); arp.stop(now+0.25);
      }
      beat = (beat+1) % 8;
      if(beat === 0) noteIdx = (noteIdx+1) % NOTES.length;
    } catch(e){}
    setTimeout(tick, 280); // ~90 BPM
  }
  return { start, stop };
})();

/* =========================================================
   HOME SCREEN PARTICLES (decorative floating elements)
   ========================================================= */
(function(){
  const hp = document.getElementById('homeParticles');
  if(!hp) return;
  const emojis = ['✦','●','◈','◆','☆','•','+'];
  for(let i=0;i<35;i++){
    const el = document.createElement('div');
    const size = 3 + Math.random()*5;
    const em = emojis[Math.floor(Math.random()*emojis.length)];
    el.textContent = em;
    el.style.cssText = `position:absolute;font-size:${size}px;color:rgba(255,255,255,${0.1+Math.random()*0.25});left:${Math.random()*100}%;top:${Math.random()*100}%;animation:homeFloat ${6+Math.random()*8}s ease-in-out infinite alternate;animation-delay:${Math.random()*4}s;opacity:${0.15+Math.random()*0.3};transform:rotate(${Math.random()*360}deg);`;
    hp.appendChild(el);
  }
})();

// Initialize progression display
PROG.updateDisplay();

// Start subtle BGM on first user interaction. Several listener types are registered
// because some mobile/in-app browsers don't reliably fire 'click' or Pointer Events
// from a touch in a way that counts as a "user gesture" for unlocking Web Audio —
// touchend is the one legacy iOS Safari has always honored.
let bgmStarted = false;
function unlockAndStartBgm(){
  if(bgmStarted) return;
  bgmStarted = true;
  SFX.unlock();
  BGM.start();
  // Prime the Stickman Quest music element on this very first user gesture too.
  // It's actually played later (after the splash-screen countdown resolves via a
  // Promise chain), and on iOS Safari / many mobile browsers a play() call that
  // isn't directly inside a synchronous gesture handler gets silently blocked —
  // .catch(()=>{}) swallows that rejection so no error ever surfaces. Playing +
  // immediately pausing it here, synchronously within this gesture, "unlocks" the
  // element so the later delayed play() call is allowed to succeed.
  try {
    const p = questBgm.play();
    if (p && p.catch) {
      p.then(() => { questBgm.pause(); questBgm.currentTime = 0; }).catch(() => {});
    } else {
      questBgm.pause();
      questBgm.currentTime = 0;
    }
  } catch (e) {}
}
document.addEventListener('click', unlockAndStartBgm, {once:true});
document.addEventListener('pointerdown', unlockAndStartBgm, {once:true});
document.addEventListener('touchend', unlockAndStartBgm, {once:true});
