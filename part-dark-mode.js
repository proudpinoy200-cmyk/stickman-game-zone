/* =========================================================
   DARK MODE SYSTEM
   
   Toggle dark/light theme for home screen
   Persisted in localStorage
   Keyboard shortcut: T to toggle
   ========================================================= */
const DARKMODE = (function(){
  const KEY = 'stickman_darkmode_enabled';
  const LIGHT_BG = 'linear-gradient(160deg,#6ec6ff 0%,#7ee8c2 45%,#ffe27a 100%)';
  const DARK_BG = 'linear-gradient(160deg,#1a1a2e 0%,#16213e 45%,#0f3460 100%)';
  
  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || false; }catch(e){ return false; }
  }
  
  function save(enabled){ try{ localStorage.setItem(KEY, JSON.stringify(enabled)); }catch(e){} }
  
  function apply(isDark){
    const html = document.documentElement;
    const body = document.body;
    
    if(isDark){
      html.style.background = DARK_BG;
      body.style.background = DARK_BG;
      body.style.color = '#e8e8e8';
      body.classList.add('dark-mode');
      
      // CSS for dark mode cards and text
      if(!document.getElementById('darkModeStyles')){
        const style = document.createElement('style');
        style.id = 'darkModeStyles';
        style.textContent = `
          body.dark-mode { background-attachment: fixed; }
          body.dark-mode .card { background: #2a2a3e; color: #e8e8e8; box-shadow: 0 8px 0 rgba(0,0,0,0.4); }
          body.dark-mode .card h3 { color: #e8e8e8; }
          body.dark-mode .card p { color: #b8b8c8; }
          body.dark-mode #homeScreen h1 { text-shadow: 3px 3px 0 #0a3a52, -1px -1px 0 #0a3a52, 1px -1px 0 #0a3a52, -1px 1px 0 #0a3a52; }
          body.dark-mode #homeScreen p.tagline { color: #b8b8c8; }
          body.dark-mode .quickBtn { background: #2a2a3e; color: #e8e8e8; box-shadow:0 4px 0 rgba(0,0,0,0.3); }
          body.dark-mode .sectionTitle { color: #e8e8e8; }
          body.dark-mode .lbList li { background: #3a3a4e; color: #e8e8e8; }
          body.dark-mode .lbList li:nth-child(1){ background: #4a4a5e; }
          body.dark-mode .lbList li:nth-child(2){ background: #3a3a4e; }
          body.dark-mode .lbList li:nth-child(3){ background: #4a4a5e; }
          body.dark-mode .lbRank { color: #a8a8b8; }
          body.dark-mode .topBar { background: #2a2a3e; box-shadow: 0 4px 0 rgba(0,0,0,0.3); }
          body.dark-mode .topBar .gTitle { color: #e8e8e8; }
          body.dark-mode #progBar { background: rgba(42,42,62,0.85); }
          body.dark-mode #progBar .pText { color: #e8e8e8; }
          body.dark-mode .dailyBanner { background: linear-gradient(120deg,#cc7722,#dd6633); }
        `;
        document.head.appendChild(style);
      }
    } else {
      html.style.background = LIGHT_BG;
      body.style.background = LIGHT_BG;
      body.style.color = '#1c2b3a';
      body.classList.remove('dark-mode');
    }
  }
  
  function toggle(){
    const current = load();
    const newState = !current;
    save(newState);
    apply(newState);
    return newState;
  }
  
  function init(){
    const isDark = load();
    apply(isDark);
    
    // Add dark mode toggle button
    const homeScreen = document.getElementById('homeScreen');
    if(homeScreen){
      let darkToggle = document.getElementById('btnDarkMode');
      if(!darkToggle){
        darkToggle = document.createElement('button');
        darkToggle.id = 'btnDarkMode';
        darkToggle.className = 'quickBtn';
        darkToggle.style.cssText = `position: fixed; top: 14px; right: 14px; z-index: 1000; background: rgba(255,255,255,0.8); padding: 10px 14px; border-radius: 50%; border: none; cursor: pointer; font-size: 1.2em;`;
        darkToggle.textContent = isDark ? '☀️' : '🌙';
        darkToggle.title = 'Toggle Dark Mode';
        darkToggle.onclick = ()=>{ DARKMODE.toggle(); darkToggle.textContent = DARKMODE.load() ? '☀️' : '🌙'; };
        document.body.appendChild(darkToggle);
      }
    }
  }
  
  return { toggle, load, apply, init };
})();

// Initialize dark mode on page load
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=>{ DARKMODE.init(); });
} else {
  DARKMODE.init();
}

// Keyboard shortcut: T to toggle dark mode
window.addEventListener('keydown', e=>{
  if(e.key === 't' || e.key === 'T'){
    if(!currentGame){ // only on home screen
      e.preventDefault();
      DARKMODE.toggle();
      const btn = document.getElementById('btnDarkMode');
      if(btn) btn.textContent = DARKMODE.load() ? '☀️' : '🌙';
    }
  }
});
