# Stickman Game Zone

Kid-friendly stick-figure multi-game website, live at [stickgames.co](https://stickgames.co).

20 games in one page: Sword Duel, Dojo Kicks, Stickman Dash, Hoop Shootout, Ninja Fruit Slice, Memory Match, Reaction Time, Stickman Quest (platformer, with background music), Bubble Shooter, Stickman Racer, Stick Galaxy (neon Galaga-style shooter — pilot a rocket ship with a distinct color scheme every wave through 10 waves, ending in the Nova Overlord boss fight), Stick Sharpshooter (precision-timed target elimination), Stick Archery Royale (10-player free-for-all), Stick Swimmer Olympics (mash-to-swim, 3-heat podium race), Coin Rush Tycoon (idle/clicker — tap for gold, hire helpers, dodge the Coin Goblin), Stick Fort Defense (3-lane tower-defense-lite with a final boss wave), Block Puzzle (tap-to-place, Blockudoku/Woodoku-style grid clearer), Coloring Studio (freeform drawing and creativity — no score, no losing), Word Scramble (tap-to-unscramble spelling game with a picture hint next to every word), and Whack-a-Mole (30-second reflex arcade, tap the fighters but dodge the bandit).

The last two were added to fill genre gaps identified from research on what keeps kids ages 6-12 replaying a game: idle/clicker and strategy/tower-defense were the two most commonly cited kid-popular genres missing from the catalog, and penalty/danger mechanics (the Coin Goblin raiding your gold pile) were found to be more memorable and exciting to kids than passive rewards alone, so that became Coin Rush Tycoon's core hook.

Every game (except the two fight games mid-campaign) saves top scores to a local, per-device leaderboard — players can enter their name after a qualifying run, and a "🏆 Leaderboards" button on the home screen lets anyone browse any game's top 5 at any time. This is stored in the browser's `localStorage`, the same way star progress is — there's no server/database behind it, so by default leaderboards are per-device, not shared across players' phones. 17 of the 20 games (see below) additionally have a **real, cross-player global leaderboard**.

## Global Leaderboards

All games except Memory Match, Reaction Time, and Coloring Studio (`GLOBAL_LB_GAMES` in `part6.js`) have a real global leaderboard on top of the local per-device one — an actual top-10 ranking shared across every player on every device, not just cosmetic. Memory Match and Reaction Time never had server-side score ranges configured in `ALLOWED_GAMES`, and Coloring Studio has no score at all, so those three stay local-only. Adding more games to the global list later is a one-line change to `GLOBAL_LB_GAMES`, as long as they're also added to `ALLOWED_GAMES` in `api/leaderboard.js`.

How it works:
- **`api/leaderboard.js`** — a Vercel Serverless Function (zero-config, auto-detected from the `/api` folder, no npm dependencies — talks to Redis with plain `fetch()`). `GET /api/leaderboard?game=<id>` returns the top 10 scores for a game; `POST /api/leaderboard` submits one.
- **Storage**: a Redis database connected via the Vercel dashboard's Storage tab → Upstash for Redis integration (free tier). Scores are kept in a Redis sorted set per game (`lb:<gameId>`), which gives fast, always-sorted top-N reads. **This is the one manual setup step Claude can't do through its tools** — Vercel doesn't expose database provisioning through any available API/MCP tool, so it has to be created once by hand: Vercel dashboard → the `stickman-game-zone` project → **Storage** tab → **Create Database** → **Upstash for Redis** → **Connect to Project** (accept the default env var names). Once connected, the feature works with no further changes — `api/leaderboard.js` reads whichever of `KV_REST_API_URL`/`UPSTASH_REDIS_REST_URL`/`REDIS_REST_API_URL` (and matching `_TOKEN`) Vercel populates. Until that's done, the API returns a clean error and every global-leaderboard UI on the site just falls back to showing "Global rankings aren't available right now" — nothing breaks, the local leaderboards are completely unaffected.
- **Submission flow**: piggybacks on the existing local high-score name-entry screen — no separate UI. When a player enters their name to save a qualifying *local* high score in one of the 17 supported games, the same name+score is also silently POSTed to the global API (`GLB.submit` in `part1.js`, fire-and-forget, wrapped in try/catch — a network hiccup or a not-yet-connected database never surfaces an error to the player).
- **Viewing**: the "🏆 Leaderboards" modal (`part6.js`) shows a "📱 This Device" / "🌍 Global" tab toggle for any of the 5 supported games; every other game only shows the local list, same as before.
- **Moderation**: a basic built-in profanity filter (`sanitizeName` in `api/leaderboard.js`, with leetspeak normalization) silently swaps a flagged name to "Player" rather than rejecting the submission, so a kid never sees a confusing error over a name choice. There's no manual admin removal tool for the global leaderboard by design — this was a deliberate scope decision, not an oversight.
- **Anti-cheat**: each game in `ALLOWED_GAMES` has a generous min/max plausibility range for its score type, so a wildly-out-of-range submission (a typo, or someone poking the API directly with an absurd number) gets rejected server-side. This is basic protection, not a complete solution — a determined cheater with devtools could still submit a fake-but-plausible score directly to the API; genuine anti-cheat would need server-side replay verification of the actual game session, which is out of scope for a static kids' game site.

## Homepage & engagement features (all local-only, no backend)

- **Homepage sections**: Continue Playing, Your Favorites, Editor's Picks, New This Week, and All Games — replacing the old single flat grid. A "🌟 Game of the Day" banner picks a game deterministically from the calendar date, so every visitor sees the same pick on a given day without needing a server.
- **Bigger, modern cards**: gradient artwork background per game, NEW/PICK badges, a ❤️ favorite toggle, and a "Played N× on this device" meta line once you've played it.
- **Reduce-clicks**: the pre-game splash countdown is shorter and can be tapped to skip instantly.
- **"You May Also Like"**: a tag-based recommendation strip on every game screen, scored by shared gameplay tags (no crowd data needed).
- **Achievements**: 27 local achievements (browsable via the 🏅 Achievements button) covering exploration, streaks, return visits, favoriting, and per-game milestones (e.g. Sword Master, Black Belt, Galaxy Saved, Extraction Complete, Tycoon Master, Fort Victorious). Unlocking one shows a celebratory toast.
- **🎰 Surprise Me**: a slot-machine-style spinner on the home screen for picking a random game.
- **Reward toasts**: short pop-up messages ("🎉 Nice choice!", "🔥 You're on a streak!", achievement unlocks) that celebrate play without being intrusive.
- **"X playing right now" badge**: a small pill under the tagline with a pulsing dot. This is cosmetic social proof, not a real visitor count — there's no backend to measure that on a static site. It follows a rough day/time curve (busier after school/evening, quiet overnight) plus a gentle random walk so the number feels alive rather than static or obviously fake. Lives in `part6.js` (`LIVE_COUNT`), purely client-side, nothing persisted or sent anywhere.

Deliberately **not** built this round: public star ratings, 👍/👎, comments, "Trending"/"Most Played Today", and a Weekly Top 10 — all of these need real aggregate data from many different players, which isn't possible on a static site with only per-device `localStorage`. Favorites (❤️) covers the "mark what I like" need without a backend.

## Structure

Plain HTML5 canvas + vanilla JS, no build step, no dependencies. Scripts are shipped as readable source (not minified) — since deploys now go through git rather than being embedded directly in a tool call, there's no token-cost reason to minify, and readable code is much easier to maintain.

- `index.html` — page shell, loads the scripts below in order
- `api/leaderboard.js` — Vercel Serverless Function backing the global leaderboard (see "Global Leaderboards" above). Not loaded by `index.html` — it's a server-side endpoint hit via `fetch()`, not a client script.
- `part1.js` — shared engine: input, drawing helpers, SFX (Web Audio), game loop, start/goHome logic, the local leaderboard module, the `GLB` global-leaderboard client module (`fetchTop`/`submit`, both best-effort/fail-silent), toasts, play-history/favorites/achievements modules. Also resets the page's scroll position to the top whenever a game starts or the player returns home (`startGame`/`goHome`) — without this, whatever scroll position a player was at on the home page (e.g. after scrolling down to find a game further down the grid) carried straight into the game screen and could visually look like the game had "jumped to the bottom of the page." Combined with the keydown handler's `preventDefault()` on scroll-triggering keys (space/arrows) during active gameplay, this fully covers the "spacebar scrolls the page" class of bug reported on Stick Swimmer Olympics.
- `part2.js` — Sword Duel / Dojo Kicks (fight game) + Stickman Dash (runner)
- `part3.js` — Hoop Shootout + Ninja Fruit Slice
- `part4.js` — progress/localStorage, splash screen, Memory Match + Reaction Time
- `part5.js` — Stickman Quest (platformer)
- `part7.js` — Bubble Shooter + Stickman Racer
- `part8.js` — Stick Galaxy (neon Galaga-style space shooter — 10 waves, player ship art is a hand-drawn vector rocket that changes color scheme every wave (10 palettes, no external image assets needed); wave 10 ends in the biggest boss in the game, the Nova Overlord, with 4 attack phases and escort drones — meant to be genuinely hard to beat without using power-ups)
- `part9.js` — Stick Sharpshooter (tap-timing target elimination — deactivate 10 rogue robot decoys before their countdown expires, then a helicopter extracts you)
- `part10.js` — Stick Archery Royale (drag-to-aim-and-release free-for-all against 9 NPC archers — you take 3 hits to fall, NPCs take 1)
- `part12.js` — Stick Swimmer Olympics (mash-to-swim 8-lane race, best-of-3 heats, podium ceremony for top 3 finishers)
- `part13.js` — Coin Rush Tycoon (idle/clicker — tap a treasure pile for gold, hire helpers and buy upgrades for passive income, in a 75-second timed session; a "Coin Goblin" periodically scurries in and steals a chunk of your gold pile unless you tap him away in time)
- `part14.js` — Stick Fort Defense (3-lane tower-defense-lite — tap a lane to place a permanent stick-soldier defender who auto-fights anything in range; defend your Fort's HP through 5 escalating waves plus a final boss wave against King Wobblestomp)
- `part15.js` — Block Puzzle + Coloring Studio
- `part16.js` — Word Scramble + Whack-a-Mole
- `part6.js` — game registry, extended card catalog (tags/colors/badges), home screen sections, achievements catalog + modal, Surprise Me spinner, recommendation engine, leaderboard browser modal (`GLOBAL_LB_GAMES` list + the Local/Global tab toggle), procedural home-screen music, first-tap audio unlock
- `quest-bgm.mp3` — background music loop for Stickman Quest

All `part*.js` files share one global scope (loaded as classic `<script src>` tags, not modules) — variables/functions declared in one are used by later ones. Load order matters: `part7.js` through `part14.js` must load before `part6.js`, since `part6.js`'s game registry calls each game's `createXGame()` factory function immediately when it runs. Current load order: part1 → part2 → part3 → part4 → part5 → part7 → part8 → part9 → part10 → part12 → part13 → part14 → part6.

(`part11.js`, an earlier Stick RPG Wars build, is no longer referenced by `index.html` and can be deleted from the repo — kept out of the load order rather than removed outright, so there's nothing extra to re-upload right now.)

## Progressive Web App (installable, offline-capable)

The site is a installable PWA — on mobile, visitors get an "Install Stick Games!" banner (bottom of the home screen) that adds it to their home screen like a real app, and once it's been opened once, all games keep working with no internet connection.

- `manifest.json` — app name/icons/colors used by the browser's install prompt and home-screen icon.
- `sw.js` — the service worker. On first visit it caches `index.html`, every `part*.js` file, `quest-bgm.mp3`, the manifest, and the icons, so the whole game works offline afterward.
- `icon-192.png` / `icon-512.png` — home-screen icons (generated to match the site's orange/gold button gradient).
- `offline.html` — rare-case fallback page, only shown if a page is requested that somehow isn't cached and there's no network.
- The install banner markup/CSS lives in `index.html` (`#installBanner`), and the small inline `<script>` at the bottom of `index.html` (after all the `part*.js` tags) registers the service worker and wires up the install button using the browser's `beforeinstallprompt`/`appinstalled` events.

**⚠️ Important — read this before shipping any future update:** `sw.js` caches every core file by name so the app works offline. That means whenever `index.html` or any `part*.js` file changes, returning players (especially ones who installed the app or play offline) will otherwise keep seeing the **old cached code forever**, because the browser has no other way to know a new version exists. To fix this, open `sw.js` and bump the `CACHE_VERSION` constant near the top (e.g. `'v1'` → `'v2'`) on every deploy that touches any cached file. That single change is what tells returning visitors' browsers to fetch the new files and drop the old cache. This is called out in a comment at the top of `sw.js` too. (Currently at `v11`.) Also remember to add any new `part*.js` file to the `CORE_ASSETS` list in `sw.js` — it was easy to miss for `part13.js`/`part14.js` since PWA support was added after most of the other game files already existed.

**`/api/*` routes are deliberately excluded** from `sw.js`'s caching entirely (see the `fetch` handler) — the global leaderboard needs live, current data on every request, not whatever happened to be cached from an earlier visit, so those requests always go straight to the network and are never written into the offline cache.

## Deploying

Connected to Vercel — pushes to `main` deploy to production automatically once the Vercel project's Git integration is set up (Project Settings → Git → Connect Git Repository, pointed at this repo).
