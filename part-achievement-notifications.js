/* =========================================================
   ACHIEVEMENT NOTIFICATION SYSTEM
   
   Enhanced toast notifications for achievement unlocks
   with animations, sounds, and visual effects
   ========================================================= */
const ACH_NOTIFY = (function(){
  function showAchievementNotification(achId, achName, achIcon){
    // Create a special achievement toast
    let container = document.getElementById('toastContainer');
    if(!container){
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    
    const t = document.createElement('div');
    t.className = 'toast toastBig';
    t.style.cssText = `
      background: linear-gradient(120deg, #fbbf24, #f59e0b) !important;
      font-size: 1.15em;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 480px;
    `;
    
    const icon = document.createElement('span');
    icon.textContent = achIcon || '🏆';
    icon.style.fontSize = '1.8em';
    icon.style.animation = 'spin 0.6s ease';
    
    const text = document.createElement('span');
    text.textContent = '✨ Achievement Unlocked: ' + achName;
    
    t.appendChild(icon);
    t.appendChild(text);
    container.appendChild(t);
    
    requestAnimationFrame(()=>t.classList.add('show'));
    
    // Longer duration for achievements
    const life = 4200;
    setTimeout(()=>{
      t.classList.remove('show');
      setTimeout(()=>t.remove(), 400);
    }, life);
    
    // Play special achievement sound (already done in unlockAchievement, but reinforce)
    SFX.victory();
  }
  
  return { showAchievementNotification };
})();

// Override the base unlockAchievement to use enhanced notifications
const originalUnlockAchievement = window.unlockAchievement;
window.unlockAchievement = function(id){
  const def = (typeof ACH_DEFS !== 'undefined') ? ACH_DEFS.find(a=>a.id===id) : null;
  if(!def) return;
  if(ACH.unlock(id)){
    ACH_NOTIFY.showAchievementNotification(id, def.name, def.icon);
    SFX.levelup();
  }
};
