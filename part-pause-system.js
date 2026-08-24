/* =========================================================
   PAUSE SYSTEM — Universal pause button for all games
   
   Pauses game loop, shows overlay with resume/restart/home
   Keyboard shortcut: P or ESC
   ========================================================= */
const PAUSE = (function(){
  let isPaused = false;
  let lastGameState = null;
  
  function toggle(){
    isPaused = !isPaused;
    return isPaused;
  }
  
  function pause(){ isPaused = true; }
  function resume(){ isPaused = false; }
  function get(){ return isPaused; }
  
  return { toggle, pause, resume, get };
})();

// Add pause button to game screen
function initPauseButton(){
  const topBar = document.querySelector('.topBar');
  if(!topBar) return;
  
  // Check if pause button already exists
  if(document.getElementById('btnPause')) return;
  
  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'btnPause';
  pauseBtn.className = 'restartBtn';
  pauseBtn.style.marginLeft = '8px';
  pauseBtn.textContent = '⏸ Pause';
  pauseBtn.onclick = ()=>{
    SFX.click();
    const wasPaused = PAUSE.get();
    PAUSE.toggle();
    updatePauseUI();
    if(!wasPaused){
      showPauseOverlay();
    }
  };
  
  // Insert before or after restart button
  const restartBtn = document.querySelector('.restartBtn');
  if(restartBtn && restartBtn.id !== 'btnPause'){
    restartBtn.parentNode.insertBefore(pauseBtn, restartBtn.nextSibling);
  }
}

function updatePauseUI(){
  const pauseBtn = document.getElementById('btnPause');
  if(!pauseBtn) return;
  pauseBtn.textContent = PAUSE.get() ? '▶ Resume' : '⏸ Pause';
}

function showPauseOverlay(){
  if(!PAUSE.get()) return; // only show if actually paused
  
  showOverlay('⏸ Game Paused', 'Your game is paused. What would you like to do?', [
    {label:'▶ Resume Game', onClick:()=>{ PAUSE.resume(); updatePauseUI(); hideOverlay(); }},
    {label:'🔄 Restart Level', onClick:()=>{ hideOverlay(); PAUSE.resume(); currentGame && currentGame.restart && currentGame.restart(); }},
    {label:'🏠 Home', onClick:()=>{ PAUSE.resume(); goHome(); }},
  ]);
}

// Keyboard shortcut: P or ESC to pause
window.addEventListener('keydown', e=>{
  if(!currentGame) return; // only in gameplay
  if(e.key === 'p' || e.key === 'P' || e.key === 'Escape'){
    e.preventDefault();
    SFX.click();
    const wasPaused = PAUSE.get();
    PAUSE.toggle();
    updatePauseUI();
    if(!wasPaused){
      showPauseOverlay();
    } else {
      hideOverlay();
    }
  }
});

// Wrap game update to respect pause state
const originalLoop = window.loop;
window.loop = function(ts){
  if(PAUSE.get()){
    // Still animate, just don't update game state
    if(!currentGame) return;
    lastTime = ts;
    rafId = requestAnimationFrame(window.loop);
    return;
  }
  if(originalLoop) originalLoop.call(this, ts);
};
