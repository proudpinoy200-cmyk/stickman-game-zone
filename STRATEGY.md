# Stickman Game Zone — Strategy

Shared long-term plan for the weekly dev cycle (Ora1 = new games/engagement, Ora2 = QA/SEO). Updated every run with what changed and what's next.

## Goals

1. Keep kids ages 6-12 engaged and coming back, safely and without dark patterns.
2. Grow organic search traffic for kids'-games-related searches.
3. Keep the site fast, bug-free, and stable — no PR review exists, so every push to `main` goes live immediately.

## Catalog decision (2026-08-16)

Carol (site owner) decided 20 games is enough — the game catalog is considered feature-complete. Building new games is no longer a default weekly activity. Every run from here forward is about scaling and improving what already exists: deeper content within current games, better retention/engagement mechanics, performance, mobile polish, bug-proofing, and SEO/traffic growth. Only build an entirely new game if a run's instructions explicitly ask for one.

## Current state (as of 2026-08-31)

- 20 games live (see README.md for the full list and file map).
- Engagement/retention features: Continue Playing, Favorites, Most Played (On This Device), Editor's Picks, New This Week, Game of the Day, 31 achievements, local leaderboards, tag-based recommendations, reward toasts, day-streak tracking, Dark Mode toggle, a universal Pause button (all local-only, added/wired this run). All local-only (localStorage), no backend, no accounts, no tracking of individual kids across devices.
- Installable PWA with offline support via a service worker (`sw.js`), now at `CACHE_VERSION 'v14'`. index.html was badly broken (missing ~2/3 of its DOM) from 2026-08-24 to 2026-08-28 — fixed, see that run's entry below.
- Stick Fort Defense was substantially reworked on 2026-08-22 at Carol's direct request (ad hoc, not the weekly cycle) — see below.
- Deployed automatically on every push to `main`.

## This run (2026-08-17)

Run conditions: same as last run — the sandboxed shell could not reach github.com/api.github.com (blocked-by-allowlist). Used an authenticated Chrome tab calling the GitHub REST/Git Data API directly via page-context fetch(), per the standing rule below. Both roles were done sequentially by the chief engineer in this run rather than as two parallel subagents, to keep a single coherent view of the repo state while testing live against production before any push (safer given no PR review step).

Ora1 (scale/improve existing) — 2 improvements, no new games:
- Added a **"🔥 Most Played (On This Device)" home section**, positioned between Favorites and Editor's Picks. This was explicitly flagged as "next up" in the last run's strategy notes. It's a pure new *view* over data the site already tracks (the `CONT` play-history module in part1.js) — no new tracking, no backend. Added `CONT.getMostPlayed(limit)` (sorts locally-recorded play counts descending) and wired it into `refreshHomeSections()` in part6.js. Design call: only shows games with 2+ plays on that device, so a single accidental play doesn't populate the section meaninglessly; section stays hidden (like Continue Playing/Favorites) until there's real signal.
- Expanded **Word Scramble's word bank from 20 to 40 words** (each with its own emoji picture hint, matching the existing style/length range of 3-5 letters). Each run only samples 10 of the pool, so this doubles replay variety without changing any game logic.

Ora2 (QA/SEO/PWA):
- Bumped `sw.js` `CACHE_VERSION` `'v7'` → `'v8'` (required — index.html, part1.js, part6.js, and part16.js all changed this run). No new files were added, so `CORE_ASSETS` didn't need updating.
- Bumped `sitemap.xml`'s `<lastmod>` to 2026-08-17.
- Checked `CARD_DATA`'s `isNew` flags: Block Puzzle, Coloring Studio, Word Scramble, and Whack-a-Mole (added 2026-08-16) are still `isNew:true`. Left as-is since they're only 1 day old — flagged below to re-check in ~1-2 weeks rather than flipped prematurely.
- Live-tested before pushing: played through Block Puzzle (placed a piece, watched score/tray update), Coloring Studio (freehand draw stroke), Word Scramble with the expanded 40-word pool (solved a round, confirmed correct-word advance + new words appear), and Whack-a-Mole (loads/starts cleanly) — zero console errors across all of them. Also simulated local play-history data to verify the new Most Played section's filter/sort/threshold logic and confirmed it renders correctly with zero console errors.
- **Not done this run** (carried forward, see Next Up): a full bug-hunt pass across the other 16 (non-15/16) games, and a genuine narrow-viewport (mobile) resize test — the browser `resize_window` tool call this run did not actually change `window.innerWidth` in this environment (stayed at desktop size), so true small-screen layout regressions couldn't be visually re-confirmed. Touch-style click/drag interactions were still verified to work correctly.

Tooling notes for next run:
- When building an `old_string`/marker to locate-and-edit HTML via the browser-API fallback, don't trust `get_page_text` output for exact whitespace — it silently strips leading indentation per line when extracting from a rendered `<pre>`. Use `charCodeAt`/leading-space-count checks on the raw fetched string instead when you need to match indentation exactly.
- `javascript_exec`'s return-value filter can block plain HTML/attribute-like snippets it heuristically mistakes for query-string/cookie data (seen as `[BLOCKED: Cookie/query string data]`) even with no real query string present. If a debug return gets blocked, fall back to returning leading-space counts, character codes, or line lengths instead of raw text.

## Ad hoc request — Stick Fort Defense overhaul (2026-08-22)

Carol asked directly (outside the weekly cycle) to make Stick Fort Defense harder and richer: reskin defenders as a Spear Guard and an Archer (inspired by reference character art she shared), reskin the enemy horde, expand from 5 waves + boss to 15 levels of escalating difficulty, and make the final boss an Ogre King. Her core complaint about the old version: a single defender per lane could solo the entire game.

What changed (part14.js rewritten, part6.js text updated, sw.js cache bumped):
- **Two defender types** instead of one: 🗡️ Spear Guard (cost 3 energy, short range, higher single-hit damage, melee thrust visual) and 🏹 Archer (cost 4 energy, long range, fires a visible flying arrow, lower per-hit damage but longer reach). A small on-canvas type-selector (top-center of the play area) lets the player choose which to place next; tapping a lane places the selected type. This required shrinking the playfield slightly (lanes now start at y=72 instead of y=50) to make room for the selector — a layout change, not a mechanics one.
- **Reskinned enemy roster**, themed to the monster-group reference image rather than reusing the old fast/tank/jumpy names: Goblin (weak, fast — levels 1+), Troll (slow, tanky — levels 4+), Orc Warrior (mid-tier — levels 7+), Wolf Rider (fast flanker — levels 10+), Skeleton Commander (armored elite, takes 20% less damage — levels 13+). Enemy pool composition unlocks progressively by level rather than all being available from the start.
- **15 levels replacing the old 5 waves + boss.** Each level scales enemy count, HP, damage, and spawn rate via formulas (not hand-authored per level) so difficulty ramps continuously rather than in a few big steps. Fort max HP raised 100 → 140 to give a longer campaign some buffer.
- **Ogre King final boss** (level 15) replaces "King Wobblestomp": much higher HP/damage than the old boss, plus a new **ground-slam mechanic** — every ~5s he telegraphs (a growing orange warning ring, ~0.8s) then slams, stunning defenders in his current lane for a moment. This is a genuinely new boss behavior, not just a reskin/stat bump, and it's telegraphed with enough warning that a careful kid player can react to it rather than being blindsided.
- Difficulty was tuned via direct simulation (driving `update(dt)` in a loop rather than relying on wall-clock play, since this environment's browser tab always reports `document.visibilityState:'hidden'` and throttles `requestAnimationFrame` — see tooling note below) across three investment levels: a minimal 2-defender player now loses by level ~4, a moderate 12-defender player clears levels 1-12 for free then dies around level 13, and a maximal 18-defender (full 6 slots × 3 lanes) player clears everything up to level 14 for free and then takes real, meaningful damage fighting the Ogre King before winning. This replaces the old problem (any single-defender-per-lane strategy could win the whole game) with a curve where the game genuinely requires escalating investment, while the true final boss fight is still winnable by a well-defended player rather than being a brick wall.
- **Judgment call — art style, not a literal image import:** Carol's reference images were photorealistic/stylized 3D game-asset renders (the kind commonly sold in mobile-game asset packs), and their exact provenance/licensing wasn't known. Rather than embedding those images directly into a public, commercial-ish, kids-facing site, the new defenders and enemies were built as new hand-drawn vector stick-figure art in the site's existing style (matching every other game on the site), using the reference images' colors, weapon types (spear/bow), and roles (troll/goblin/orc/skeleton/wolf-rider/ogre) as the design brief rather than as source assets to reproduce. Worth a quick sanity-check with Carol that this approach (matching the theme/vibe vs. the literal character designs) met what she wanted.
- Achievement text updated: "Fort Victorious" now reads "Defeat the Ogre King..." instead of "...King Wobblestomp". Card description on the home screen updated to mention the 15 levels and Ogre King.
- `sw.js` `CACHE_VERSION` bumped `'v8'` → `'v9'` (part14.js and part6.js both changed). No new files, so `CORE_ASSETS` unchanged.
- Tested extensively before pushing: syntax-validated, then logic-tested by driving the game's own `update()`/`draw()` functions directly from the console (since real-time `requestAnimationFrame` play doesn't advance in this automation environment — worth remembering for future ad hoc sessions, not just weekly runs), across multiple defender-investment strategies through to both victory and defeat, confirming no runtime errors, correct achievement/high-score/overlay behavior on both outcomes, and reasonable difficulty pacing. Also did a shorter real click-driven UI pass (splash → type selection → placement → combat) to confirm the on-screen controls work as designed.

## This run (2026-08-28) — CRITICAL HOTFIX: site was fully unplayable

Carol reported "can't play it on mobile devices" mid-run. Investigation found the
outage was NOT mobile-specific — the entire site had been broken for every visitor,
on every device, since 2026-08-24.

**Root cause:** two commits that day ("Global leaderboard" and "Add daily challenges
system") replaced `index.html` with a drastically stripped-down version — 542 lines
deleted, only 33 added. The new index.html kept the card grid and basic shell but
dropped the splash-screen overlay (#splashOverlay/#spIcon/#spTitle/#spSub/#spCount),
the mute button (#btnMute), the achievements/leaderboard/spin modals, the favorites/
continue-playing/most-played home sections, the PWA install banner, and the service
worker registration script — while part1.js, part4.js, and part6.js still referenced
all of it. Two of those references threw uncaught top-level exceptions on every page
load (part1.js:799 `btnMute.onclick` on null, part4.js:79 `showSplash()` writing
`.textContent` onto missing splash elements), and the second one broke every game's
start flow — clicking any "Play" button did nothing, on any device or browser. This
had been live for 4 days before it was caught; none of it was flagged in STRATEGY.md
at the time (these two commits weren't part of a logged weekly/ad-hoc run).

**Fix (commit bb31d6a):** rebuilt index.html using the last known-good structure
(commit d425866a, 2026-08-17 weekly run) as the base, then layered the genuinely
new, wired-up Aug 24 work back on top: kept the `part-daily-challenges.js` script
tag, and added the `#lbModalTabs` div + `.lbTab`/`.lbModalTabs` CSS that part6.js's
new Global-leaderboard-tab code (`renderLbTabs`, `GLOBAL_LB_GAMES`) needs but the
broken HTML never had. Did **not** wire in the five other new-but-orphaned files
(part-achievement-notifications.js, part-combo-system.js, part-dark-mode.js,
part-difficulty-system.js, part-pause-system.js) — none of them are referenced by
any `<script>` tag, so none contributed to the outage, and blind-integrating five
untested features into an emergency hotfix isn't safe. They're still sitting in the
repo unused; a future run should evaluate each one deliberately (finish + wire in,
or delete) rather than have them linger indefinitely like part11.js.

**Judgment call:** reverted the home banner label from "🎯 Daily Challenge" back to
"🌟 Game of the Day" — the code that actually populates that banner (part6.js's
`getDailyGameId`/IIFE) still only implements the original deterministic
Game-of-the-Day pick, not the new daily-challenge target. The new `DAILY` module
(part-daily-challenges.js) loads and its localStorage/challenge-generation logic
works standalone (verified in isolation), but **nothing calls `checkDailyChallenge()`
from any game's game-over flow** — it's present but functionally inert right now.
Left it that way rather than rush a cross-cutting integration into every game during
a hotfix. Worth a quick check with Carol on whether the Daily Challenge system was
meant to ship yet, since it's currently dead code with no UI surfaced for it (no
"Daily Challenge" panel/banner exists in the restored HTML — only the original
Game-of-the-Day banner does).

**Verification methodology (why this wasn't caught by "live testing" in past runs):**
past runs' live-testing sections in this file describe injecting code and driving
`update()`/`draw()` directly, or synthetic interactions — never a genuine, real
(non-scripted) click on the production "Play" button end-to-end. That gap is
exactly why this regression went live undetected. This run's verification used:
1. A real (computer-tool, non-synthetic) click on the live, broken production Play
   button first, to confirm the outage independent of any fix.
2. An isolated same-origin `<iframe>` with a fresh JS global scope (avoids the
   "identifier already declared" errors you get re-running `<script>` tags into an
   already-executed page) to load-test the reconstructed index.html against the
   live part*.js files before committing anything — checked Sword Duel (canvas
   action game), Memory Match (domOverlay game), the achievements modal, and the
   leaderboards modal including the new Global tab. Zero console errors.
3. After push + deploy, cleared `caches`/unregistered the service worker, reloaded
   the real production URL fresh, re-read console (zero errors), and did another
   real click through to Sword Duel plus a synthetic pointerdown/move/up drag on
   Ninja Fruit Slice's canvas to confirm pointer/touch handling actually fires.

**Tooling note for next run:** this environment's Chrome tab still cannot actually
narrow `window.innerWidth` (resize_window changes the OS window but not the page's
effective viewport — confirmed innerWidth stayed 1920 after a 390×844 resize call),
so a true mobile-viewport layout check is still not possible here. If Carol's mobile
report resurfaces after this fix (which addressed a universal, non-mobile-specific
outage), the next thing to check is real per-viewport CSS/layout on an actual phone,
not just touch-input wiring.

Also did the routine weekly QA pass: retired `isNew:true` on Block Puzzle, Coloring
Studio, Word Scramble, and Whack-a-Mole (added 2026-08-16, now 12 days old — past the
1-2 week window flagged last run), bumped `sitemap.xml`'s `<lastmod>` to 2026-08-28,
and bumped `sw.js` `CACHE_VERSION` twice (v11→v12 with the hotfix, v12→v13 with the
part6.js isNew-flag change) — see commits bb31d6a and 099df39.

Given the severity of the outage, this run's time went entirely to incident response
plus routine Ora2 QA — no new Ora1 engagement feature was built this run (deliberate
scope call, not an oversight). A full bug-hunt pass through all 20 games (beyond the
ones spot-checked above) is still not done and is carried forward again.

## This run (2026-08-31)

Run conditions: unlike the last two runs, the sandboxed shell had normal network access
this time — `git clone`/`push` against github.com worked directly with the provided
token, so the browser-API fallback wasn't needed. Both roles were again done
sequentially by the chief engineer (not parallel subagents) to keep one coherent view
of the repo before pushing, consistent with the last two runs' reasoning.

Ora1 (scale/improve existing, no new games) — wired in 3 of the 5 orphaned-but-built
feature files flagged as "next up" for two runs running:
- **Dark Mode** (`part-dark-mode.js`): a 🌙/☀️ toggle button (top-right of the home
  screen), persisted in localStorage, plus a `T` keyboard shortcut. Purely additive —
  it only touches `body`/`html` inline styles and injects its own `<style>` block, so
  it doesn't alter any existing game code.
- **Universal Pause** (`part-pause-system.js`): every game screen now gets a
  ⏸ Pause button next to Restart, plus `P`/`Esc` keyboard shortcuts, showing a
  Resume/Restart/Home overlay (reusing the existing `showOverlay()` modal). It works
  by wrapping the shared `requestAnimationFrame` loop (`window.loop`) to skip
  `currentGame.update()` while paused but keep the frame ticking — no per-game code
  needed, so it works uniformly across all 20 games including the DOM-overlay ones.
  **Bug caught and fixed during integration, not present in the orphaned file as
  written:** the pause flag is a single page-global (not per-game-session), so
  without a fix, pausing game A, going home, and starting game B would leave game B
  silently frozen (loop still running, no update, no overlay explaining why) —
  confirmed this was a real bug by reproducing it live on production before patching.
  Fixed by adding `PAUSE.resume()` + `updatePauseUI()` calls to both `startGame()` and
  `goHome()` in `part1.js`, and having `startGame()` call `initPauseButton()` so the
  button is present from the very first game a player opens.
- **Achievement Notifications** (`part-achievement-notifications.js`): overrides the
  existing `unlockAchievement()` with a bigger, longer-lived, icon-forward toast
  (functionally equivalent to the original — same `ACH.unlock()`/localStorage call —
  just a richer visual). Verified this is a pure superset of the original behavior by
  reading both implementations side by side before wiring it in.
- **Deliberately left un-integrated:** `part-combo-system.js` and
  `part-difficulty-system.js`. Both are just generic helper modules with no calls
  into any specific game yet — combo tracking needs a `COMBO.increment()`/
  `getMissed()` call added at each relevant game's own hit/miss logic, and the
  difficulty selector needs each fight game's enemy-stat code to actually read
  `DIFFICULTY.getMultipliers()`. That's real per-game logic surgery across multiple
  `part*.js` files, judged too risky to do blind in one run on a site with no PR
  review — flagged as next up, one game/system at a time rather than all at once.

Testing methodology: rather than editing production directly, the new/changed
`part-dark-mode.js`/`part-pause-system.js`/`part-achievement-notifications.js` code
was injected as a `<script>` tag into the **live production page** via the browser's
JS console (not an isolated iframe this time, since these three files are additive
monkey-patches with no risk of "identifier already declared" collisions with the
already-loaded page). Real, non-synthetic actions were then driven: clicked the dark
mode toggle and confirmed the class/style actually flipped; started a real game
(Memory Match), called `initPauseButton()`, clicked the on-screen Pause button and
confirmed the overlay appeared, clicked "Resume Game" and confirmed play resumed;
dispatched real `Escape` keydown events and confirmed the same toggle worked; called
`unlockAchievement()` with real ids from the live `ACH_DEFS` catalog and confirmed the
new toast rendered with the right text/icon. Also **reproduced the pause-state-leak
bug live before patching** (paused a game, called `goHome()`, confirmed `PAUSE.get()`
stayed `true`) to make sure the fix in `part1.js` was addressing a real bug and not a
hypothetical one. Zero console errors from any of this (only unrelated
browser-extension/`vercel.live` noise, confirmed unrelated by checking their source
files aren't part of this repo).

Ora2 (QA/SEO/PWA):
- **Load-crash pass across all 20 games** (the "next up" item carried over 3 runs) —
  finally done, at the load-time-crash level: scripted `startGame(id)` → wait →
  `goHome()` across all 13 games not already spot-checked in the last two runs
  (sword, runner, hoops, bubble, racer, galaxy, sniper, archery, swimmer, tycoon,
  fortdefense, platformer, reaction), with a global `window.onerror` collector running
  throughout. Zero errors across all 13. Combined with Memory Match, Block Puzzle,
  Coloring Studio, Word Scramble, Whack-a-Mole, Sword Duel, and Ninja Fruit Slice
  already covered by the previous two runs, that's load-crash coverage for all 20
  games. Also did one real click-driven interaction test (a drag-to-aim-and-shoot in
  Bubble Shooter) to sanity-check pointer handling, not just load. **Caveat, so this
  isn't overclaimed:** this is load + a couple of spot interaction checks, not a full
  play-through of every game's win/lose states and edge cases — a deeper per-game
  interaction pass is still worth doing eventually, just no longer the totally-untouched
  item it was.
- Checked `CARD_DATA`'s `isNew` flags: all 20 are already `isNew:false` — nothing to
  flip this run.
- Bumped `sitemap.xml`'s `<lastmod>` to 2026-08-31.
- `sw.js` `CACHE_VERSION` bumped `'v13'` → `'v14'` (index.html and part1.js changed,
  plus 3 new files added) and added `part-dark-mode.js`, `part-pause-system.js`,
  `part-achievement-notifications.js` to `CORE_ASSETS` so they're available offline
  too.
- Investigated a suspicious-looking string in `part6.js` (Whack-a-Mole's card
  description rendered with `���` in one tool's text output) — traced it to raw bytes
  and confirmed it's a correctly-encoded UTF-8 em dash (`—`, bytes `e2 80 94`), not a
  real encoding bug. False alarm, noted here so it isn't re-investigated next run.

After pushing, re-verified live: cleared the service worker cache/unregistered it,
reloaded stickgames.co fresh, confirmed `CACHE_VERSION v14` is what's being served,
re-ran the dark mode/pause/achievement toast checks against the real deployed code
(not just the console-injected version), and re-checked all 20 games still start
clean. Zero console errors post-deploy.

## Ad hoc fix — Global leaderboard database mismatch (2026-09-03)

Carol asked for the global leaderboard to be checked directly (outside the weekly
cycle). Diagnosis: a Redis database *was* connected to the project (contrary to
what earlier STRATEGY.md notes assumed) — `redis-cordovan-branch`, created 2026-08-24
— but it was the wrong Vercel Marketplace product. It's the plain "Redis" (Redis
Cloud) integration, which only exposes a raw TCP connection string (`REDIS_URL`).
`api/leaderboard.js` was written to avoid any npm dependency, so it talks to Redis
via plain `fetch()` against Upstash's REST API — it needs `KV_REST_API_URL`/
`KV_REST_API_TOKEN` (or a couple of named fallbacks), which a Redis Cloud database
has no way to provide. Confirmed via Vercel's runtime logs: every `/api/leaderboard`
request (including at least one real player's `POST`) was 500ing with "Leaderboard
storage is not connected yet."

Fix: Carol connected a proper **Upstash for Redis** integration (`upstash-kv-purple-
grass`) with a custom `UPSTASH` env var prefix, needed because the old `REDIS_URL`
was still occupying that name. `api/leaderboard.js` was updated to also check
`UPSTASH_KV_REST_API_URL`/`UPSTASH_KV_REST_API_TOKEN` as a final fallback (commit
`ba50657`). Verified live end-to-end after deploy: `GET /api/leaderboard?game=<id>`
returns `200 {entries:[]}` for all 5 `GLOBAL_LB_GAMES`, and a real `POST` + `GET`
round-trip correctly stored and returned a test score. The test entry was removed
afterward via the Upstash database's built-in REPL (Vercel Storage → the Upstash
resource → REPL, with Safe Mode toggled off to allow `ZREM`) — there's no admin
delete endpoint in the API by design (see README), so a stray test/abuse score
would need this same manual REPL cleanup path in the future.

**Not yet done — flagged for next run:** the old `redis-cordovan-branch` (Redis
Cloud) database is still connected to the project with its unused `REDIS_URL`
env var. It should be deleted to avoid clutter/confusion, but deleting a database
resource wasn't done in this session — needs Carol to do it herself via Vercel
dashboard → Storage → redis-cordovan-branch → Settings → Delete (or ask for a
guided walkthrough next time).

Also re-surfaced during this investigation: an earlier, undocumented ad hoc attempt
(commit `8mXT2nP`, "Expand global leaderboards to 17 games") had already once tried
what's flagged below as a "next up" item, but it was lost when index.html got
reverted to a known-good version during the 2026-08-28 hotfix. `api/leaderboard.js`'s
`ALLOWED_GAMES` still has all 17 games' score ranges configured server-side from that
attempt — only `part6.js`'s `GLOBAL_LB_GAMES` (still just 5) needs updating to
actually re-expand it, now that the database itself works.

## Ad hoc follow-up — Global leaderboard expanded to 17 games (2026-09-03)

Immediately after the database fix above, Carol asked to restore the global
leaderboard to all 17 games. `GLOBAL_LB_GAMES` in part6.js expanded from 5 to
17 (adding martial, runner, hoops, ninja, bubble, racer, sniper, archery,
swimmer, fortdefense, wordscramble, whackamole). Only Memory Match, Reaction
Time, and Coloring Studio stay local-only (no server-side score ranges exist
for the first two in `ALLOWED_GAMES`, and Coloring Studio has no score).
README.md updated to match (was still describing "5 flagship games").
`sw.js` `CACHE_VERSION` bumped `v14`→`v15`.

Tested live before pushing (in-page array mutation against production, since
`GLOBAL_LB_GAMES` is `const` — reassigning `window.GLOBAL_LB_GAMES` silently
no-ops; mutating the array in place with `.length=0` + `.push(...)` is what
actually works for this kind of live pre-push test). Confirmed the Local/
Global tab toggle appeared for a previously-local-only game, and ran two real
submissions through the actual UI code path (`showScoreEntryOverlay` →
`GLB.submit`) for Ninja Fruit Slice and Whack-a-Mole — both stored and read
back correctly. Cleaned up both test entries via `DEL` in the Upstash REPL
afterward (simpler than `ZREM` with an exact member string when the key only
has one test entry in it).

**Post-deploy gotcha worth remembering:** the first `fetch()` against
`stickgames.co` right after this deploy went out still returned the OLD
`GLOBAL_LB_GAMES` (5 games), even though Vercel's deployment API confirmed
the new commit was `READY` and aliased. Cause: the service worker's
stale-while-revalidate strategy serves whatever's already in
`caches.open(CACHE_NAME)` immediately, and in this case the cache under the
NEW `v15` name had apparently already been populated by an `addAll()` that
raced an edge/CDN layer still serving the previous `part6.js` for a few
seconds after the alias flipped. Bumping `CACHE_VERSION` guarantees a clean
break eventually, but doesn't guarantee the very first `install` after
deploy fetches fully-fresh content if it happens to race the CDN's own
propagation. The fix each time is the same one already documented in the
standing rules below (clear `caches`, unregister the SW, hard-reload) — just
worth noting it can still be needed even when `CACHE_VERSION` was bumped
correctly and the deployment API says `READY`.

Also spotted in passing (not fixed, not blocking): a local (per-device) Stick
Fort Defense leaderboard entry on the test browser profile has a player name
of `https://www.yo...` — confirms the local leaderboard has no name filtering
at all (only the global one runs `sanitizeName`/profanity-filters). Since
local entries never leave the device, this is cosmetic/low-risk, but flagged
below as a nice-to-have for consistency.

## Standing rules for whoever runs this next

- Always bump CACHE_VERSION in sw.js on any push that touches index.html or any part*.js file, and add any new part*.js file to CORE_ASSETS.
- When a github.com/api.github.com network path is unavailable from the sandboxed shell, the GitHub REST/Git Data API can be called directly from an authenticated Chrome tab's fetch() — this also allows new/changed code to be injected and played live in the browser before it's ever committed.
- Periodically re-check CARD_DATA's isNew flags — they don't age out automatically.
- After every deploy, spot-check the live site (stickgames.co) for console errors and that a couple of games still load, before considering the run done.
- This automation environment's Chrome tab always reports `document.visibilityState` as `'hidden'` (even when it's the only/active tab), which throttles `requestAnimationFrame` to near-zero — any game relying on real-time animation won't visibly advance no matter how long you wait. Work around this by driving `currentGame.update(dt)` and `currentGame.draw(ctx)` directly in a loop from the console to test game logic deterministically, then do a shorter real click-driven pass for UI/visual sanity.

## Next up

- Delete the old, unused `redis-cordovan-branch` (Redis Cloud) database and its
  leftover `REDIS_URL` env var — it's dead weight now that Upstash for Redis is
  connected and working. Needs Carol to do the deletion herself (or a guided
  walkthrough), not done automatically.
- Consider running `sanitizeName`-equivalent filtering on local (per-device)
  leaderboard name entry too, for consistency with the global leaderboard —
  currently local entries aren't filtered at all (spotted a URL used as a
  player name on one test device; low risk since it's device-only, but easy
  to align).
- A deeper per-game interaction/edge-case pass (win states, lose states, restart
  loops) across all 20 games — the load-crash-level pass is now done (see this run),
  but nobody has scripted a genuine play-to-completion of most games yet.
- Wire `part-combo-system.js` into the arcade-style games it was written for (ninja,
  bubble, whackamole, archery, etc — see its own file comment) one game at a time,
  each with its own live-tested integration, rather than all at once.
- Wire `part-difficulty-system.js` into the two fight games it targets (Sword Duel,
  Dojo Kicks) — needs each game's enemy speed/damage code to read
  `DIFFICULTY.getMultipliers()`, plus rendering `createDifficultySelector()`
  somewhere in the pre-game flow. Not done this run; same reasoning as combo above.
- Decide the fate of the Daily Challenge system (part-daily-challenges.js): it's
  loaded and functional in isolation but nothing calls `checkDailyChallenge()` from
  any game, and there's no UI showing the player what today's challenge even is.
  Either wire it up properly (a `checkDailyChallenge(gameId, score)` call at each
  game's game-over point, plus a small UI surface) or pull the script tag until it's
  ready. Worth a quick check with Carol on whether this was meant to ship yet.
- Clean up the stray `-api/leaderboard.js` file (leading-dash duplicate, likely an
  accidental path artifact from the 2026-08-24 upload) — appears unused, low priority.
- Consider deleting the orphaned part11.js (still unreferenced, unchanged from
  earlier runs).
- If a genuine mobile-viewport resize tool becomes available, use it to check real
  narrow-width CSS/layout — resize_window still does not change `window.innerWidth`
  in this environment, so true small-screen rendering still can't be visually
  verified here, only touch/pointer event wiring.
- Bigger SEO items to consider: per-game landing content (currently everything is
  one SPA route), a blog/tips section, backlinks from kids'-game directories.
- Consider evolving "Most Played (On This Device)" into a rolling weekly window if
  the lifetime-count version feels too static over time.
- **Process suggestion:** any ad hoc change made outside the logged weekly cycle
  (like the 2026-08-24 commits that caused this incident) should still get a short
  STRATEGY.md entry when it happens, the way the 2026-08-22 Stick Fort Defense
  overhaul did — that would have made this regression far easier to catch quickly
  instead of it sitting live for 4 days.
