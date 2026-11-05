// files the vault catalog into postgres: node --env-file-if-exists=.env db/seed.js
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const films = JSON.parse(fs.readFileSync(path.join(here, 'films.json'), 'utf8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

let n = 0;
for (const [slug, f] of Object.entries(films)) {
  await pool.query(
    `INSERT INTO films (slug, title, studio, year, meta, tick, yt_id, img_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title, studio = EXCLUDED.studio, year = EXCLUDED.year,
       meta = EXCLUDED.meta, tick = EXCLUDED.tick, yt_id = EXCLUDED.yt_id,
       img_url = EXCLUDED.img_url, sort_order = EXCLUDED.sort_order`,
    [slug, f.title, f.studio || '', f.year || '', f.meta || '', f.tick || '',
     f.yt || null, f.img || '', n]
  );
  n++;
}
await pool.end();
console.log('[soot] the vault catalog stands — ' + n + ' reels filed');
