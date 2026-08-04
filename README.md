# Stickman Game Zone

Kid-friendly stick-figure multi-game website, live at [stickgames.co](https://stickgames.co).

11 games in one page: Sword Duel, Dojo Kicks, Stickman Dash, Hoop Shootout, Ninja Fruit Slice, Memory Match, Reaction Time, Stickman Quest (platformer, with background music), Bubble Shooter, Stickman Racer, and Stick Galaxy (neon Galaga-style shooter).

Every game (except the two fight games mid-campaign) saves top scores to a local, per-device leaderboard — players can enter their name after a qualifying run, and a "🏆 Leaderboards" button on the home screen lets anyone browse any game's top 5 at any time. This is stored in the browser's `localStorage`, the same way star progress is — there's no server/database behind it, so leaderboards are per-device, not shared across players' phones.

## Structure

Plain HTML5 canvas + vanilla JS, no build step, no dependencies. Scripts are shipped as readable source (not minified) — since deploys now go through git rather than being embedded directly in a tool call, there's no token-cost reason to minify, and readable code is much easier to maintain.

- `index.html` — page shell, loads the scripts below in order
- `part1.js` — shared engine: input, drawing helpers, SFX (Web Audio), game loop, start/goHome logic, the local leaderboard module
- `part2.js` — Sword Duel / Dojo Kicks (fight game) + Stickman Dash (runner)
- `part3.js` — Hoop Shootout + Ninja Fruit Slice
- `part4.js` — progress/localStorage, splash screen, Memory Match + Reaction Time
- `part5.js` — Stickman Quest (platformer)
- `part7.js` — Bubble Shooter + Stickman Racer
- `part8.js` — Stick Galaxy (neon Galaga-style space shooter)
- `part6.js` — game registry, home screen cards, leaderboard browser modal, procedural home-screen music, first-tap audio unlock
- `quest-bgm.mp3` — background music loop for Stickman Quest

All `part*.js` files share one global scope (loaded as classic `<script src>` tags, not modules) — variables/functions declared in one are used by later ones. Load order matters: `part7.js` and `part8.js` must load before `part6.js`, since `part6.js`'s game registry calls `createBubbleGame()`/`createRacerGame()`/`createGalaxyGame()` immediately when it runs.

## Deploying

Connected to Vercel — pushes to `main` deploy to production automatically once the Vercel project's Git integration is set up (Project Settings → Git → Connect Git Repository, pointed at this repo).
