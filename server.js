import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3188;
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 30_000,
});


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
);
CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  name varchar(40) NOT NULL,
  email varchar(120) NOT NULL DEFAULT '',
  email_enc text NOT NULL DEFAULT '',
  kind varchar(60) NOT NULL DEFAULT 'SOMETHING ELSE',
  body varchar(500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'NEW',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS films (
  id serial PRIMARY KEY,
  slug varchar(40) UNIQUE NOT NULL,
  title varchar(80) NOT NULL,
  studio varchar(80) NOT NULL DEFAULT '',
  year varchar(20) NOT NULL DEFAULT '',
  meta varchar(120) NOT NULL DEFAULT '',
  tick varchar(120) NOT NULL DEFAULT '',
  yt_id varchar(24),
  img_url varchar(200) NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS film_likes (
  id serial PRIMARY KEY,
  film_id int NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  session_id varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (film_id, session_id)
);`;
pool.query(SCHEMA)
  .then(() => console.log('[soot] the ledger stands — postgres answers, six tables ready'))
  .catch((e) => {
    if (e.code === '42501') console.log('[soot] the ledger was already furnished — this desk may only read and write');
    else console.error('[soot] postgres spoke:', e.message);
  });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); 
app.use(express.json({ limit: '4kb' }));


app.use('/api', (req, res, next) => {
  res.on('finish', () => console.log('[soot] ' + req.method + ' ' + req.originalUrl + ' -> ' + res.statusCode));
  next();
});

const CANONICAL_HOST = (process.env.CANONICAL_HOST || '').toLowerCase();
app.use((req, res, next) => {
  if (CANONICAL_HOST && (req.headers.host || '').toLowerCase() !== CANONICAL_HOST) {
    return res.redirect(301, 'https://' + CANONICAL_HOST + req.originalUrl);
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, pid: process.pid, up: Math.round(process.uptime()) }));


function rate(limit, windowMs) {
  const hits = new Map();    
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
  const okEmail = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '';
  try {
    const { rows } = await pool.query(
      'INSERT INTO wires (name, email, email_enc, body) VALUES ($1, $2, $3, $4) RETURNING id, name, email, body, created_at',
      [name, okEmail ? maskEmail(okEmail) : '', sealEmail(okEmail), body]);
    res.status(201).json(rows[0]);
  } catch (e) { vaultDown(res, e); }
});

app.post('/api/visit', rate(30, 60_000), async (req, res) => {
  const sid = clip(req.body.sid, 64);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ ok: false });
  try {
    await pool.query('INSERT INTO visits (session_id) VALUES ($1) ON CONFLICT (session_id) DO NOTHING', [sid]);
    const { rows } = await pool.query('SELECT count(*)::int AS admits FROM visits');
    res.json({ ok: true, admits: rows[0].admits });
  } catch (e) { vaultDown(res, e); }
});

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

app.get('/api/films', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT f.slug, f.title, f.studio, f.year, f.meta, f.tick, f.yt_id AS yt, f.img_url AS img, count(l.id)::int AS bravo ' +
      'FROM films f LEFT JOIN film_likes l ON l.film_id = f.id ' +
      'GROUP BY f.id ORDER BY f.sort_order, f.id');
    res.json(rows);
  } catch (e) { vaultDown(res, e); }
});
app.post('/api/films/:slug/like', rate(6, 60_000), async (req, res) => {
  const slug = clip(req.params.slug, 40);
  const sid = clip(req.body.sid, 64);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ ok: false });
  try {
    const hit = await pool.query('SELECT id FROM films WHERE slug = $1', [slug]);
    if (!hit.rows[0]) return res.status(404).json({ ok: false });
    await pool.query('INSERT INTO film_likes (film_id, session_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [hit.rows[0].id, sid]);
    const { rows } = await pool.query('SELECT count(*)::int AS bravo FROM film_likes WHERE film_id = $1', [hit.rows[0].id]);
    res.json({ ok: true, bravo: rows[0].bravo });
  } catch (e) { vaultDown(res, e); }
});

app.post('/api/order', rate(3, 60_000), async (req, res) => {
  const name = clip(req.body.name, 40) || 'A GUEST';
  const email = clip(req.body.email, 120);
  const kind = clip(req.body.kind, 60) || 'SOMETHING ELSE';
  const body = clip(req.body.body, 500);
  if (body.length < 2) return res.status(400).json({ ok: false, error: 'an order needs words' });
  const okEmail = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '';
  try {
    const { rows } = await pool.query(
      'INSERT INTO orders (name, email, email_enc, kind, body) VALUES ($1, $2, $3, $4, $5) RETURNING id, kind, created_at',
      [name, okEmail ? maskEmail(okEmail) : '', sealEmail(okEmail), kind, body]);
    res.status(201).json({ ok: true, order: rows[0] });
  } catch (e) { vaultDown(res, e); }
});

function vaultDown(res, e) {
  console.error('[soot] the vault jammed:', e.message);
  res.status(503).json({ ok: false, error: 'the vault desk is closed — try again later' });
}

app.use('/css', express.static(path.join(here, 'css')));
app.use('/js', express.static(path.join(here, 'js')));
app.use('/assets', express.static(path.join(here, 'assets')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(here, 'robots.txt')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(here, 'assets', 'favicon.ico')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(here, 'sitemap.xml')));

const PAGES = ['index.html', 'work.html', 'about.html', 'capabilities.html', 'process.html', 'order.html', 'contact.html', 'film.html', '404.html'];
app.get('/', (req, res) => res.sendFile(path.join(here, 'html', 'index.html')));
PAGES.forEach((p) => app.get('/' + p, (req, res) => res.sendFile(path.join(here, 'html', p))));
app.get('/html/:page', (req, res) => {
  if (PAGES.includes(req.params.page)) return res.redirect(301, '/' + req.params.page);
  res.status(404).sendFile(path.join(here, 'html', '404.html'));
});

app.get(/^\/(yandex_[a-z0-9]+|google[a-z0-9]+)\.html$/i, (req, res) => {
  const name = req.path.split('/').pop();
  res.sendFile(path.join(here, 'html', name), (err) => {
    if (err) res.status(404).sendFile(path.join(here, 'html', '404.html'));
  });
});

app.use((req, res) => res.status(404).sendFile(path.join(here, 'html', '404.html')));

app.listen(PORT, HOST, () => console.log('[soot] the projector hums on ' + HOST + ':' + PORT));
