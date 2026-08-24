/* =========================================================
   DIFFICULTY LEVELS SYSTEM
   
   Add difficulty selector for fight games (sword, martial)
   - Easy: enemy 30% slower, less damage
   - Normal: baseline (current)
   - Hard: enemy 40% faster, more damage
   
   Stored in localStorage per game per session
   ========================================================= */
const DIFFICULTY = (function(){
  const KEY = 'stickman_difficulty_levels';
  
  const PRESETS = {
    easy: { label:'Easy', multipliers: {enemySpeed: 0.7, enemyDamage: 0.75, playerDamage: 1.15}, icon:'😊' },
    normal: { label:'Normal', multipliers: {enemySpeed: 1, enemyDamage: 1, playerDamage: 1}, icon:'🎮' },
    hard: { label:'Hard', multipliers: {enemySpeed: 1.4, enemyDamage: 1.3, playerDamage: 0.9}, icon:'💪' },
  };
  
  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; }
  }
  function save(data){ try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){} }
  
  function getCurrentDifficulty(gameId){
    const d = load();
    return d[gameId] || 'normal';
  }
  
  function setDifficulty(gameId, difficulty){
    const d = load();
    if(PRESETS[difficulty]) d[gameId] = difficulty;
    save(d);
  }
  
  function getMultipliers(gameId){
    const diff = getCurrentDifficulty(gameId);
    return PRESETS[diff]?.multipliers || PRESETS.normal.multipliers;
  }
  
  function getPreset(difficulty){
    return PRESETS[difficulty] || PRESETS.normal;
  }
  
  return { getCurrentDifficulty, setDifficulty, getMultipliers, getPreset, PRESETS };
})();

// Helper to add difficulty selector to fight games
function createDifficultySelector(gameId){
  const currentDiff = DIFFICULTY.getCurrentDifficulty(gameId);
  const presets = DIFFICULTY.PRESETS;
  
  let html = '<div style="text-align:center; padding:10px 0; color:#1c2b3a; font-weight:700;">'
    + 'Difficulty: ';
  
  Object.keys(presets).forEach(key => {
    const preset = presets[key];
    const isActive = key === currentDiff;
    html += `<button class="diffBtn ${isActive?'active':''} " data-difficulty="${key}" style="`
      + `margin:0 6px; padding:8px 16px; border-radius:20px; border:2px solid ${isActive?'#ff8c42':'#ddd'}; `
      + `background:${isActive?'#ffb703':'#fff'}; color:#1c2b3a; font-weight:700; cursor:pointer; font-size:0.9em;`
      + `">${preset.icon} ${preset.label}</button>`;
  });
  html += '</div>';
  
  return html;
}
