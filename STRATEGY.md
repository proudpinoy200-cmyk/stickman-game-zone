# Stickman Game Zone — Strategy

Shared long-term plan for the weekly dev cycle (Ora1 = new games/engagement, Ora2 = QA/SEO). Updated every run with what changed and what's next.

## Goals

1. Keep kids ages 6-12 engaged and coming back, safely and without dark patterns.
2. Grow organic search traffic for kids'-games-related searches.
3. Keep the site fast, bug-free, and stable — no PR review exists, so every push to `main` goes live immediately.

## Current state (as of 2026-08-07)

- 14 games live (see README.md for the full list and file map).
- Engagement/retention features already built: Continue Playing, Favorites, Editor's Picks, New This Week, Game of the Day, 23 achievements, local leaderboards, Surprise Me spinner, tag-based recommendations, reward toasts, day-streak tracking. All local-only (localStorage), no backend, no accounts, no tracking of individual kids across devices.
- Installable PWA with offline support via a service worker (`sw.js`).
- Deployed via Vercel, auto-deploying every push to `main`.

## This run (2026-08-07)

Run conditions: the usual sandboxed dev/test environment (shell) was unavailable this run (`HYPERVISOR_VIRT_DISABLED`), so all work was done directly through GitHub's web editor with the user's own signed-in browser session, with no way to execute/test JavaScript before pushing. Given that constraint on a live kids' site with no PR review, changes were kept deliberately conservative — additive/config fixes only, nothing that touches game logic.

**Ora2 (bug fix + SEO):**
- **Bug fix:** `sw.js`'s `CACHE_VERSION` was still `'v1'` despite several rounds of new games and fixes shipped over the past few days (Aug 4-7). Per the service worker's own warning comment, that meant returning/installed PWA users were likely stuck on stale cached code and missing everything shipped since the last version bump. Bumped to `'v2'`.
- **SEO:** `index.html` had no meta description, no Open Graph/Twitter card tags, no canonical URL, and no structured data — added all of these, plus a `WebApplication` JSON-LD block describing the site (14 free kids' games, ages 6-12, free). Also added `robots.txt` and `sitemap.xml` (neither existed before).
- Did **not** attempt a full bug-hunt pass through all 12 `part*.js` files (~230KB of game code) this run — no execution environment to verify a fix actually works before it goes live. Flagged as next-run priority once shell access is available (see below).

**Ora1 (new game):**
- **Deferred this run.** The site already ships extremely active, retention-focused features (everything listed under "Current state" above was largely built very recently, based on commit history), and hand-writing a new canvas game's worth of logic through a browser text editor — with no way to run or test it before it goes live to kids — was judged too risky. A bug in a new game's factory function can halt `part6.js` (the registry) entirely, since it calls every game's `createXGame()` at parse time, which would break the whole home screen for every visitor, not just the new game.
- Recommended for next run: build the new game in an environment where it can actually be run/tested first (shell sandbox, or locally), then push the verified result.

## Standing rules for whoever runs this next

- **Always bump `CACHE_VERSION` in `sw.js`** on any push that touches `index.html` or any `part*.js` file. This was missed for several days straight before this run.
- Prefer testing game logic before pushing when any code-execution environment is available. Treat "push straight from a web text editor with zero test capability" as a fallback for small, additive, low-risk changes only (config, meta tags, docs, new static files) — not for new game logic.
- After every deploy, spot-check the live site (stickgames.co) for console errors and that a couple of games still load, before considering the run done.

## Next up

- Bug-hunt pass through `part7.js`-`part12.js` (the more recently added games: Bubble Shooter, Racer, Galaxy, Sniper, Archery, Swimmer) with an actual test environment.
- Build and ship 1 new game concept once testing is possible again — coloring/creativity or puzzle genres are still underrepresented relative to action/arcade.
- Bigger SEO items to consider: per-game landing content (currently everything is one SPA route, so there's nothing for search engines to index per-game), a blog/tips section, backlinks from kids'-game directories.
