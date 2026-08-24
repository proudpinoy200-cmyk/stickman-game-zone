/* =========================================================
   DAILY CHALLENGES SYSTEM — Client-side, no backend needed
   
   - Each day: pick a random game + a specific goal
   - Deterministic: same game/goal for all players on same day
   - Reward: +2 achievement points if completed
   - UI: modal on home screen, tracks progress during gameplay
   ========================================================= */
const DAILY = (function(){
  const KEY = 'stickman_daily_challenge';
  const CHALLENGE_DEFS = [
    {game:'sword', target:45, desc:'Complete Sword Duel under 45 seconds'},
    {game:'martial', target:50, desc:'Complete Dojo Kicks under 50 seconds'},
    {game:'runner', target:300, desc:'Reach 300m in Stickman Dash'},
    {game:'hoops', target:8, desc:'Score 8 points in Hoop Shootout'},
    {game:'ninja', target:30, desc:'Score 30+ points in Ninja Fruit Slice'},
    {game:'memory', target:10, desc:'Complete Memory Match in 10 or fewer moves'},
    {game:'reaction', target:280, desc:'Average under 280ms in Reaction Time'},
    {game:'platformer', target:50, desc:'Collect 50 coins in Stickman Quest'},
    {game:'bubble', target:300, desc:'Score 300+ points in Bubble Shooter'},
    {game:'racer', target:35, desc:'Win Stickman Racer in under 35 seconds'},
    {game:'galaxy', target:5000, desc:'Score 5000+ points in Stick Galaxy'},
    {game:'sniper', target:60, desc:'Complete Stick Sharpshooter in under 60 seconds'},
    {game:'archery', target:3, desc:'Get 3+ kills in Stick Archery Royale'},
    {game:'swimmer', target:90, desc:'Complete Stick Swimmer Olympics in under 90 seconds'},
    {game:'tycoon', target:800, desc:'Earn 800+ gold in Coin Rush Tycoon'},
    {game:'fortdefense', target:300, desc:'Score 300+ points in Stick Fort Defense'},
    {game:'blockpuzzle', target:150, desc:'Score 150+ points in Block Puzzle'},
    {game:'wordscramble', target:8, desc:'Spell 8+ correct words in Word Scramble'},
    {game:'whackamole', target:15, desc:'Score 15+ points in Whack-a-Mole'},
  ];
  
  function getTodayKey(){
    const d = new Date();
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  }
  
  function getChallenge(){
    try{
      const d = new Date();
      const today = getTodayKey();
      let stored = null;
      try{ stored = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){}
      
      if(stored && stored.date === today) return stored; // today's challenge already generated
      
      // new day — generate today's challenge deterministically from date seed
      const seed = d.getFullYear()*372 + d.getMonth()*31 + d.getDate();
      const idx = seed % CHALLENGE_DEFS.length;
      const challenge = CHALLENGE_DEFS[idx];
      const data = {
        date: today,
        game: challenge.game,
        target: challenge.target,
        desc: challenge.desc,
        completed: false
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    } catch(e){ return null; }
  }
  
  function markCompleted(){
    try{
      const d = JSON.parse(localStorage.getItem(KEY)) || {};
      d.completed = true;
      localStorage.setItem(KEY, JSON.stringify(d));
      return true;
    } catch(e){ return false; }
  }
  
  function reset(){
    try{ localStorage.removeItem(KEY); }catch(e){}
  }
  
  return { getChallenge, markCompleted, reset };
})();

// Call this from a game's game-over moment to check if today's challenge was completed
function checkDailyChallenge(gameId, score){
  const challenge = DAILY.getChallenge();
  if(!challenge || challenge.completed || challenge.game !== gameId) return false;
  
  let qualifies = false;
  // most games: higher score wins
  if(['runner','hoops','ninja','platformer','bubble','galaxy','archery','tycoon','fortdefense','blockpuzzle','wordscramble','whackamole'].includes(gameId)){
    qualifies = score >= challenge.target;
  }
  // time-based: lower is better
  else if(['sword','martial','racer','sniper','swimmer'].includes(gameId)){
    qualifies = score <= challenge.target;
  }
  // reaction time: average time
  else if(gameId === 'reaction'){
    qualifies = score <= challenge.target;
  }
  // memory match: moves (fewer is better)
  else if(gameId === 'memory'){
    qualifies = score <= challenge.target;
  }
  
  if(qualifies){
    DAILY.markCompleted();
    showToast('🎯 Daily Challenge Complete! +2 bonus points!', {duration: 3500, big: true});
    SFX.victory();
    return true;
  }
  return false;
}