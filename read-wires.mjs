/* ============================================================
   SOOT STUDIO — the desk drawer
   read the wires and open the SEALED reply-to addresses.
   local use only (never served, never exposed):
     node --env-file=.env read-wires.mjs
   ============================================================ */
import crypto from 'node:crypto';
import pg from 'pg';

const key = process.env.WIRE_KEY ? Buffer.from(process.env.WIRE_KEY, 'hex') : null;
if (!key || key.length !== 32) {
  console.error('no WIRE_KEY in the drawer — run me with the same .env the server uses:');
  console.error('  node --env-file=.env read-wires.mjs');
  process.exit(1);
}

/* the twin of sealEmail() on the server: iv:ciphertext:tag, all hex */
function open(sealed) {
  if (!sealed) return '(no address on this wire)';
  try {
    const [iv, data, tag] = sealed.split(':');
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    d.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString('utf8');
  } catch (e) {
    return '(sealed with another key — cannot open)';
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const { rows } = await pool.query(
  'SELECT id, name, email, email_enc, body, created_at FROM wires ORDER BY id DESC LIMIT 50');

if (!rows.length) { console.log('the rack is empty.'); }
for (const w of rows) {
  const stamp = new Date(w.created_at).toLocaleString();
  console.log('№' + String(w.id).padStart(3, '0') + ' | ' + w.name + ' | ' + w.email + ' | full: ' + open(w.email_enc) + ' | ' + stamp);
  console.log('    ' + w.body);
}
await pool.end();
