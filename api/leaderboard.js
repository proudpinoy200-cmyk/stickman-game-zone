// =========================================================================
// GLOBAL LEADERBOARD API
//
// GET  /api/leaderboard?game=<id>              -> top 10 scores for that game
// POST /api/leaderboard   { game, name, score } -> submit a score
//
// Backed by a Redis database connected to this Vercel project (via the
// "Storage" tab -> Upstash for Redis integration). Reads its connection
// info from whichever of these env var pairs Vercel populated when the
// database was connected - different integration versions have used
// slightly different names over time, so we check a few.
//
// No npm dependencies - talks to Upstash's plain REST API directly with
// fetch(), matching the rest of this project's "no build step" approach.
// =========================================================================

const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL ||
  // The Upstash-for-Redis Vercel Marketplace integration was connected with a
  // custom "UPSTASH" env var prefix (needed to avoid colliding with a REDIS_URL
  // left over from an earlier, wrong "Redis" (Redis Cloud) integration attempt
  // that only exposed a raw TCP connection string, not a REST API this
  // zero-dependency fetch()-based code can use). Keep this as the last fallback
  // rather than the first, so an unprefixed connection (the common case if this
  // is ever reconnected without a custom prefix) is still preferred.
  process.env.UPSTASH_KV_REST_API_URL;

const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN ||
  process.env.UPSTASH_KV_REST_API_TOKEN;

// All games with global leaderboards. Each entry defines:
// - higherIsBetter: whether higher/lower scores rank better
// - min/max: sanity range for score validation (anti-cheat)
// - Examples of ranges:
//   * Time-based games: lower is better (e.g., 3-600 seconds)
//   * Score-based games: higher is better (e.g., 0-999999 points)
const ALLOWED_GAMES = {
  // Fight games (time to complete all 5 levels)
  sword: { higherIsBetter: false, min: 3, max: 600 },
  martial: { higherIsBetter: false, min: 3, max: 600 },
  
  // Platformer (coins collected)
  platformer: { higherIsBetter: true, min: 0, max: 999 },
  
  // Space shooter (score across 10 waves)
  galaxy: { higherIsBetter: true, min: 0, max: 999999 },
  
  // Idle/Clicker (gold in 75s session)
  tycoon: { higherIsBetter: true, min: 0, max: 100000 },
  
  // Puzzle (blocks cleared)
  blockpuzzle: { higherIsBetter: true, min: 0, max: 20000 },
  
  // Runner (distance in meters)
  runner: { higherIsBetter: true, min: 0, max: 10000 },
  
  // Basketball (points before time runs out)
  hoops: { higherIsBetter: true, min: 0, max: 500 },
  
  // Ninja fruit (combo/points)
  ninja: { higherIsBetter: true, min: 0, max: 2000 },
  
  // Bubble shooter (points)
  bubble: { higherIsBetter: true, min: 0, max: 5000 },
  
  // Racing (time to finish)
  racer: { higherIsBetter: false, min: 3, max: 180 },
  
  // Precision shooter (time to eliminate targets)
  sniper: { higherIsBetter: false, min: 5, max: 120 },
  
  // Archery PvP (kills before knocked down)
  archery: { higherIsBetter: true, min: 0, max: 50 },
  
  // Swimming (time for 3-race heats)
  swimmer: { higherIsBetter: false, min: 6, max: 300 },
  
  // Tower defense (points + waves survived)
  fortdefense: { higherIsBetter: true, min: 0, max: 50000 },
  
  // Word puzzle (words spelled correctly)
  wordscramble: { higherIsBetter: true, min: 0, max: 10 },
  
  // Whack-a-mole (points)
  whackamole: { higherIsBetter: true, min: 0, max: 500 },
};

const TOP_N = 10;
const KEEP_N = 100; // trim each game's sorted set beyond this so it never grows unbounded

// --- tiny built-in profanity filter -------------------------------------
// Not exhaustive - no filter ever is - but catches common bad words plus a
// few leetspeak substitutions. On a hit, the name is silently swapped to
// "Player" rather than rejecting the submission outright, so a kid never
// sees a scary/confusing error over their name choice.
const BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'cunt',
  'nigger', 'nigga', 'fag', 'faggot', 'retard', 'whore', 'slut', 'rape',
  'porn', 'sex', 'penis', 'vagina', 'cum', 'hitler', 'nazi', 'kys',
];
function normalizeForFilter(s) {
  return s
    .toLowerCase()
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
    .replace(/[^a-z]/g, '');
}
function isClean(name) {
  const norm = normalizeForFilter(name);
  if (!norm) return true;
  return !BAD_WORDS.some((w) => norm.includes(w));
}
function sanitizeName(raw) {
  let name = (typeof raw === 'string' ? raw : '').trim().slice(0, 14);
  name = name.replace(/[<>]/g, ''); // strip angle brackets, just in case
  if (!name) return 'Player';
  if (!isClean(name)) return 'Player';
  return name;
}

async function kv(commandParts) {
  const path = commandParts.map((p) => encodeURIComponent(p)).join('/');
  const res = await fetch(`${KV_URL}/${path}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KV error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!KV_URL || !KV_TOKEN) {
    res.status(500).json({ error: 'Leaderboard storage is not connected yet.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const gameId = req.query.game;
      const cfg = ALLOWED_GAMES[gameId];
      if (!cfg) {
        res.status(400).json({ error: 'Unknown or unsupported game id.' });
        return;
      }
      const key = `lb:${gameId}`;
      // Sorted set is always stored so a HIGHER stored value = a better rank,
      // regardless of whether the game itself treats lower or higher as
      // better (see submit: we negate the raw score at write time for
      // lower-is-better games, then flip it back here on read).
      const raw = await kv(['zrevrange', key, '0', String(TOP_N - 1), 'withscores']);
      const entries = [];
      for (let i = 0; i < raw.length; i += 2) {
        const member = raw[i]; // "name::timestamp::rand"
        const storedScore = Number(raw[i + 1]);
        const realScore = cfg.higherIsBetter ? storedScore : -storedScore;
        const name = member.split('::')[0];
        entries.push({ name, score: realScore });
      }
      res.status(200).json({ entries });
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = {};
        }
      }
      body = body || {};

      const gameId = body.game;
      const cfg = ALLOWED_GAMES[gameId];
      if (!cfg) {
        res.status(400).json({ error: 'Unknown or unsupported game id.' });
        return;
      }

      const scoreNum = Number(body.score);
      if (!Number.isFinite(scoreNum) || scoreNum < cfg.min || scoreNum > cfg.max) {
        res.status(400).json({ error: 'Score out of plausible range.' });
        return;
      }

      const name = sanitizeName(body.name);
      const storedScore = cfg.higherIsBetter ? scoreNum : -scoreNum;
      const member = `${name}::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`;
      const key = `lb:${gameId}`;

      await kv(['zadd', key, String(storedScore), member]);
      // Keep only the best KEEP_N entries (ranks 0..KEEP_N-1 from the top);
      // Remove everything beyond rank KEEP_N-1 (i.e., from rank KEEP_N onwards).
      await kv(['zremrangebyrank', key, String(KEEP_N), '-1']);

      res.status(200).json({ ok: true, name });
      return;
    }

    res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};
