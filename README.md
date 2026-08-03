# Stickman Game Zone

Kid-friendly stick-figure multi-game website, live at [stickgames.co](https://stickgames.co).

8 games in one page: Sword Duel, Dojo Kicks, Stickman Dash, Hoop Shootout, Ninja Fruit Slice, Memory Match, Reaction Time, and Stickman Quest (platformer, with background music).

## Structure

Plain HTML5 canvas + vanilla JS, no build step, no dependencies.

- `index.html` — page shell, loads the scripts below in order
- `part1.js` — shared engine: input, drawing helpers, SFX (Web Audio), game loop, start/goHome logic
- `part2.js` — Sword Duel / Dojo Kicks (fight game) + Stickman Dash (runner)
- `part3.js` — Hoop Shootout + Ninja Fruit Slice
- `part4.js` — progress/localStorage, splash screen, Memory Match + Reaction Time
- `part5.js` — Stickman Quest (platformer)
- `part6.js` — game registry, home screen cards, procedural home-screen music, first-tap audio unlock
- `quest-bgm.mp3` — background music loop for Stickman Quest

All six `part*.js` files share one global scope (loaded as classic `<script src>` tags, not modules) — variables/functions declared in one are used by later ones.

## Deploying

Connected to Vercel — pushes to `main` deploy to production automatically once the Vercel project's Git integration is set up (Project Settings → Git → Connect Git Repository, pointed at this repo).
