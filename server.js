/* ============================================================
   SOOT STUDIO — the vault desk
   static reels + a small postgres ledger:
     · wires        — the telegraph office files every message
     · visits       — one admits count per browser
     · parry_scores — the house record wall
   run:  npm start   (reads .env)
   ============================================================ */
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3188;
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1'); // loopback at home, all doors on a host

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 30_000,
});
/* --- the ledger stands itself up on a fresh vault (neon, render, anywhere) --- */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS wires (
  id serial PRIMARY KEY,
  name varchar(40) NOT NULL,
  email varchar(120) NOT NULL DEFAULT '',
  email_enc text NOT NULL DEFAULT '',
  body varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS visits (
  id serial PRIMARY KEY,
  session_id varchar(64) UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS parry_scores (
  id serial PRIMARY KEY,
  name varchar(40) NOT NULL DEFAULT 'A GUEST',
  score int NOT NULL CHECK (score >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);`;
pool.query(SCHEMA)
  .then(() => console.log('[soot] the ledger stands — postgres answers, three tables ready'))
  .catch((e) => {
    if (e.code === '42501') console.log('[soot] the ledger was already furnished — this desk may only read and write');
    else console.error('[soot] postgres spoke:', e.message);
  });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);   // behind a host's front door req.ip stays the guest's own
app.use(express.json({ limit: '4kb' }));

/* --- the desk keeps a ledger of every knock on the API --- */
app.use('/api', (req, res, next) => {
  res.on('finish', () => console.log('[soot] ' + req.method + ' ' + req.originalUrl + ' -> ' + res.statusCode));
  next();
});

/* --- one true address: when CANONICAL_HOST is set, every other door politely sends the street there --- */
const CANONICAL_HOST = (process.env.CANONICAL_HOST || '').toLowerCase();
app.use((req, res, next) => {
  if (CANONICAL_HOST && (req.headers.host || '').toLowerCase() !== CANONICAL_HOST) {
    return res.redirect(301, 'https://' + CANONICAL_HOST + req.originalUrl);
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, pid: process.pid, up: Math.round(process.uptime()) }));

/* --- the house rule: a guest may only tap the key so fast --- */
function rate(limit, windowMs) {
  const hits = new Map();                                 // per-desk ledger: ip → recent hit timestamps
  return (req, res, next) => {
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      return res.status(429).json({ ok: false, error: 'the key is cooling down — try again shortly' });
    }
    arr.push(now);
    hits.set(req.ip, arr);
    next();
  };
}
const clip = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/* --- reply-to addresses: masked for the street, sealed for the vault --- */
const WIRE_KEY = process.env.WIRE_KEY ? Buffer.from(process.env.WIRE_KEY, 'hex') : null;
console.log(WIRE_KEY ? '[soot] reply-tos are sealed (aes-256-gcm)' : '[soot] no WIRE_KEY — reply-tos stay masked only');
function maskEmail(e) {
  const at = e.indexOf('@');
  return at > 0 ? e.slice(0, 2) + '*****' + e.slice(at) : '';
}
function sealEmail(e) {
  if (!WIRE_KEY || !e) return '';
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', WIRE_KEY, iv);
  const enc = Buffer.concat([c.update(e, 'utf8'), c.final()]).toString('hex');
  return iv.toString('hex') + ':' + enc + ':' + c.getAuthTag().toString('hex');
}

/* ---------------------------------------------------------
   WIRES — the telegraph office
--------------------------------------------------------- */
app.get('/api/wire', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, body, created_at FROM wires ORDER BY id DESC LIMIT 8');
    res.json(rows);
  } catch (e) { vaultDown(res, e); }
});
app.post('/api/wire', rate(3, 60_000), async (req, res) => {
  const name = clip(req.body.name, 40) || 'A GUEST';
  const email = clip(req.body.email, 120);
  const body = clip(req.body.body, 500);
  if (body.length < 2) return res.status(400).json({ ok: false, error: 'a wire needs words' });
  const okEmail = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '';   // no address, no fiction
  try {
    const { rows } = await pool.query(
      'INSERT INTO wires (name, email, email_enc, body) VALUES ($1, $2, $3, $4) RETURNING id, name, email, body, created_at',
      [name, okEmail ? maskEmail(okEmail) : '', sealEmail(okEmail), body]);
    res.status(201).json(rows[0]);
  } catch (e) { vaultDown(res, e); }
});

/* ---------------------------------------------------------
   ADMITS — one count per browser session
--------------------------------------------------------- */
app.post('/api/visit', rate(30, 60_000), async (req, res) => {
  const sid = clip(req.body.sid, 64);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ ok: false });
  try {
    await pool.query('INSERT INTO visits (session_id) VALUES ($1) ON CONFLICT (session_id) DO NOTHING', [sid]);
    const { rows } = await pool.query('SELECT count(*)::int AS admits FROM visits');
    res.json({ ok: true, admits: rows[0].admits });
  } catch (e) { vaultDown(res, e); }
});

/* ---------------------------------------------------------
   PARRY — the house record wall
--------------------------------------------------------- */
app.get('/api/parry', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT coalesce(max(score), 0)::int AS best FROM parry_scores');
    res.json({ ok: true, best: rows[0].best });
  } catch (e) { vaultDown(res, e); }
});
app.post('/api/parry', rate(6, 60_000), async (req, res) => {
  const score = Math.floor(Number(req.body.score));
  if (!Number.isFinite(score) || score < 0 || score > 100_000) {
    return res.status(400).json({ ok: false });
  }
  try {
    await pool.query('INSERT INTO parry_scores (name, score) VALUES ($1, $2)', ['A GUEST', score]);
    const { rows } = await pool.query('SELECT coalesce(max(score), 0)::int AS best FROM parry_scores');
    res.json({ ok: true, best: rows[0].best });
  } catch (e) { vaultDown(res, e); }
});

function vaultDown(res, e) {
  console.error('[soot] the vault jammed:', e.message);
  res.status(503).json({ ok: false, error: 'the vault desk is closed — try again later' });
}

/* --- the reels themselves (house files stay behind the desk) --- */
app.use((req, res, next) => {          // internals are none of the street's business
  if (/^\/(\.env($|[/?])|\.server-|\.git($|\/)|node_modules($|\/)|package(-lock)?\.json($|[/?])|read-wires\.mjs($|[/?]))/.test(req.url)) {
    return res.status(404).sendFile(path.join(here, '404.html'));
  }
  next();
});
app.use(express.static(here, { dotfiles: 'ignore' }));
app.use((req, res) => res.status(404).sendFile(path.join(here, '404.html')));

app.listen(PORT, HOST, () => console.log('[soot] the projector hums on ' + HOST + ':' + PORT));
