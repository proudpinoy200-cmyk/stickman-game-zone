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
  process.env.REDIS_REST_API_URL;

const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN;

// Only these games have global leaderboards for now. Each entry defines
// whether a lower or higher number is a better score, and a generous but
// real min/max sanity range used to reject obviously-impossible submitted
// scores (basic anti-cheat - a determined cheater with devtools can still
// fake a plausible-looking number, there's no way around that without
// server-side game replay verification, but this blocks careless/blatant
// cases and typos).
const ALLOWED_GAMES = {
  sword: { higherIsBetter: false, min: 3, max: 600 }, // seconds to clear all 5 duels
  platformer: { higherIsBetter: true, min: 0, max: 999 }, // coins collected
  galaxy: { higherIsBetter: true, min: 0, max: 999999 }, // score
  tycoon: { higherIsBetter: true, min: 0, max: 100000 }, // gold earned in a 75s run
  blockpuzzle: { higherIsBetter: true, min: 0, max: 20000 }, // score
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
      // zremrangebyrank with negative indices trims everything below that.
      await kv(['zremrangebyrank', key, '0', String(-(KEEP_N + 1))]);

      res.status(200).json({ ok: true, name });
      return;
    }

    res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};
