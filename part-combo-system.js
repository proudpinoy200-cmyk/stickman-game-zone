/* =========================================================
   COMBO SYSTEM — Action games arcade mechanics
   
   Track consecutive successful actions without missing.
   Visual feedback: counter + color intensity + bonus points
   
   Games using combo: ninja, bubble, whackamole, archery, etc
   ========================================================= */
const COMBO = (function(){
  let currentCombo = 0;
  let comboTimeout = null;
  const COMBO_RESET_TIME = 2.5; // seconds before combo breaks
  
  function increment(){
    currentCombo++;
    if(comboTimeout) clearTimeout(comboTimeout);
    // reset after inactivity
    comboTimeout = setTimeout(()=>{ currentCombo = 0; }, COMBO_RESET_TIME * 1000);
    return currentCombo;
  }
  
  function reset(){
    currentCombo = 0;
    if(comboTimeout) clearTimeout(comboTimeout);
  }
  
  function get(){ return currentCombo; }
  
  function getBonus(){
    // 3-combo: +10%, 5-combo: +25%, 10-combo: +50%, 20-combo: +100%
    const c = currentCombo;
    if(c < 3) return 1;
    if(c < 5) return 1.1;
    if(c < 10) return 1.25;
    if(c < 20) return 1.5;
    return 2;
  }
  
  function getDisplayText(){
    const c = currentCombo;
    if(c < 3) return '';
    if(c < 5) return '🔥 '+c+' COMBO';
    if(c < 10) return '🔥🔥 '+c+' COMBO!';
    if(c < 20) return '🔥🔥🔥 '+c+' ULTRA!';
    return '⚡💥 '+c+' MEGA COMBO! 💥⚡';
  }
  
  function getMissed(){
    // Call when player misses/fails an action
    const wasActive = currentCombo >= 3;
    reset();
    return wasActive; // return true if combo was broken (should show toast)
  }
  
  return { increment, reset, get, getBonus, getDisplayText, getMissed };
})();

function drawComboDisplay(g, x, y){
  const combo = COMBO.get();
  if(combo < 3) return;
  
  const text = COMBO.getDisplayText();
  const bonus = COMBO.getBonus();
  const scale = 0.9 + Math.min(combo / 20, 0.3); // grow as combo increases
  
  g.save();
  g.font = `bold ${Math.floor(32 * scale)}px Segoe UI`;
  g.textAlign = 'center';
  g.fillStyle = combo < 10 ? '#ff8c42' : '#ffb703';
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 2;
  g.fillText(text, x, y);
  
  if(bonus > 1){
    g.font = `bold ${Math.floor(18 * scale)}px Segoe UI`;
    g.fillStyle = '#06d6a0';
    g.fillText('×' + bonus.toFixed(2) + ' BONUS', x, y + 28);
  }
  g.restore();
}
