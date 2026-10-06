import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openDb, generateCode, normalizeCode, normalizeId, SHA256_RE, STATUSES, REPORT_TYPES,
} from './db.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const PRETTY_ROUTES = { '/': 'index.html', '/verify': 'verify.html', '/admin': 'admin.html' };

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self' mailto:",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  // Verification URLs carry the access code, so never leak them via Referer.
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const MAX_JSON = 64 * 1024;
const MAX_PDF_JSON = 30 * 1024 * 1024; // base64 of a ~22 MB PDF

class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

/** Fixed-window counter per key. Good enough for a single-process deployment. */
function createLimiter() {
  const buckets = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  }, 60_000).unref();
  return {
    hit(key, max, windowMs) {
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
      b.n++;
      return { ok: b.n <= max, retryAfter: Math.ceil((b.reset - now) / 1000) };
    },
    peek(key, max) {
      const b = buckets.get(key);
      return !b || b.reset < Date.now() || b.n < max;
    },
  };
}

function loadSalt(dataDir) {
  const p = join(dataDir, 'ip-salt');
  if (existsSync(p)) return readFileSync(p, 'utf8');
  const s = randomBytes(16).toString('hex');
  writeFileSync(p, s, { mode: 0o600 });
  return s;
}

function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function parseData(r) {
  try { return JSON.parse(r || '{}'); } catch { return {}; }
}

function publicView(r) {
  return {
    id: r.id,
    type: r.type,
    typeLabel: REPORT_TYPES[r.type]?.label ?? r.type,
    status: r.status,
    statusReason: r.status_reason || null,
    supersededBy: r.superseded_by || null,
    statusChangedAt: r.status_changed_at || null,
    compound: r.compound,
    labelClaim: r.label_claim,
    lot: r.lot,
    client: r.client,
    labId: r.lab_id,
    issued: r.issued,
    data: parseData(r.data),
    notes: r.notes,
    pdf: r.pdf_sha256 ? { sha256: r.pdf_sha256, name: r.pdf_name, size: r.pdf_size } : null,
    recordedAt: r.created_at,
    checkedAt: new Date().toISOString(),
  };
}

function adminView(r, baseUrl) {
  return {
    ...publicView(r),
    code: r.code,
    verifyUrl: `${baseUrl}/verify?id=${encodeURIComponent(r.id)}&k=${encodeURIComponent(r.code)}`,
    verifyCount: r.verify_count,
    lastVerifiedAt: r.last_verified_at,
    alerts: r.alerts ?? undefined,
  };
}

const str = (v, max = 200) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new HttpError(400, 'invalid_field');
  const s = v.trim();
  if (s.length > max) throw new HttpError(400, 'field_too_long');
  return s || null;
};
const date = (v) => {
  const s = str(v, 10);
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'invalid_date');
  return s;
};

/**
 * Report bodies differ by type (peptide tiles, blend components, element tables…), so
 * they are stored as JSON. This bounds their shape rather than enforcing a schema:
 * plain objects/arrays of strings, finite numbers and booleans, shallow and small.
 * The public page renders every value as text, never as HTML.
 */
function sanitizeData(value, depth = 0) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new HttpError(400, 'invalid_data');
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > 1000) throw new HttpError(400, 'field_too_long');
    return value.trim();
  }
  if (depth >= 4) throw new HttpError(400, 'invalid_data');
  if (Array.isArray(value)) {
    if (value.length > 50) throw new HttpError(400, 'invalid_data');
    return value.map((v) => sanitizeData(v, depth + 1));
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 50) throw new HttpError(400, 'invalid_data');
    const out = {};
    for (const k of keys) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(k)) throw new HttpError(400, 'invalid_data');
      out[k] = sanitizeData(value[k], depth + 1);
    }
    return out;
  }
  throw new HttpError(400, 'invalid_data');
}

export function createApp({ dataDir, adminToken, publicUrl, trustProxy = false } = {}) {
  const db = openDb(dataDir);
  const salt = loadSalt(dataDir);
  const limiter = createLimiter();
  const pdfPath = (id) => join(dataDir, 'pdfs', `${id}.pdf`);

  const clientIp = (req) => {
    if (trustProxy) {
      const xf = req.headers['x-forwarded-for'];
      if (xf) return String(xf).split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  };
  const ipHash = (ip) => createHash('sha256').update(salt + ip).digest('hex').slice(0, 16);

  function send(res, status, body, headers = {}) {
    const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    });
    res.end(payload);
  }

  async function readJson(req, max = MAX_JSON) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > max) throw new HttpError(413, 'payload_too_large');
      chunks.push(c);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
    catch { throw new HttpError(400, 'invalid_json'); }
  }

  // ---- Public verification ----

  // Every lookup counts toward a general limit; failed ones also count toward a much
  // stricter one, so guessing access codes is impractical even for a known report ID.
  function guardPublic(ip) {
    const g = limiter.hit(`pub:${ip}`, 60, 60_000);
    if (!g.ok) throw Object.assign(new HttpError(429, 'rate_limited'), { retryAfter: g.retryAfter });
    if (!limiter.peek(`fail:${ip}`, 10)) throw Object.assign(new HttpError(429, 'too_many_failures'), { retryAfter: 900 });
  }
  const recordFailure = (ip) => limiter.hit(`fail:${ip}`, 10, 15 * 60_000);

  /** Resolves a report by ID + access code. Unknown IDs and wrong codes look identical to the caller. */
  function authorize(ip, rawId, rawCode) {
    guardPublic(ip);
    const id = normalizeId(rawId);
    const code = normalizeCode(rawCode);
    const r = id && db.get(id);
    if (!r) {
      recordFailure(ip);
      db.logEvent(id, 'not_found', ipHash(ip));
      throw new HttpError(404, 'not_found');
    }
    if (!code || !safeEqual(code, r.code)) {
      recordFailure(ip);
      db.logEvent(r.id, 'bad_code', ipHash(ip));
      throw new HttpError(404, 'not_found');
    }
    return r;
  }

  async function handlePublic(req, res, url, ip) {
    const parts = url.pathname.split('/').filter(Boolean); // api, coa, :id, ...

    if (req.method === 'GET' && parts.length === 3 && parts[1] === 'coa') {
      const r = authorize(ip, decodeURIComponent(parts[2]), url.searchParams.get('k'));
      db.touch(r.id);
      db.logEvent(r.id, 'verified', ipHash(ip));
      return send(res, 200, publicView(r));
    }

    if (req.method === 'GET' && parts.length === 4 && parts[1] === 'coa' && parts[3] === 'pdf') {
      const r = authorize(ip, decodeURIComponent(parts[2]), url.searchParams.get('k'));
      if (!r.pdf_sha256) throw new HttpError(404, 'no_pdf');
      const buf = await readFile(pdfPath(r.id));
      db.logEvent(r.id, 'pdf_download', ipHash(ip));
      return send(res, 200, buf, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${r.id}.pdf"`,
      });
    }

    // Compare a hash the browser computed locally (the file itself never leaves the device).
    if (req.method === 'POST' && parts.length === 4 && parts[1] === 'coa' && parts[3] === 'compare') {
      const body = await readJson(req);
      const r = authorize(ip, decodeURIComponent(parts[2]), body.k);
      const sha = String(body.sha256 || '').toLowerCase();
      if (!SHA256_RE.test(sha)) throw new HttpError(400, 'invalid_hash');
      if (!r.pdf_sha256) return send(res, 200, { match: null, reason: 'no_pdf_on_file' });
      const match = sha === r.pdf_sha256;
      db.logEvent(r.id, match ? 'hash_match' : 'hash_mismatch', ipHash(ip), match ? null : sha);
      return send(res, 200, { match });
    }

    // Look a report up by file fingerprint alone. Holding the byte-exact original is
    // proof enough, and a SHA-256 cannot be guessed, so no access code is required.
    if (req.method === 'POST' && parts.length === 2 && parts[1] === 'verify-file') {
      guardPublic(ip);
      const body = await readJson(req);
      const sha = String(body.sha256 || '').toLowerCase();
      if (!SHA256_RE.test(sha)) throw new HttpError(400, 'invalid_hash');
      const r = db.byHash(sha);
      if (!r) {
        db.logEvent(null, 'file_unknown', ipHash(ip), sha);
        throw new HttpError(404, 'not_found');
      }
      db.touch(r.id);
      db.logEvent(r.id, 'file_verified', ipHash(ip));
      return send(res, 200, { ...publicView(r), code: r.code });
    }

    throw new HttpError(404, 'no_route');
  }

  // ---- Admin ----

  function requireAdmin(req, ip) {
    if (!adminToken) throw new HttpError(503, 'admin_disabled', 'Set ADMIN_TOKEN to enable the admin API');
    const g = limiter.peek(`adminfail:${ip}`, 10);
    if (!g) throw Object.assign(new HttpError(429, 'too_many_failures'), { retryAfter: 900 });
    const h = String(req.headers.authorization || '');
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token || !safeEqual(token, adminToken)) {
      limiter.hit(`adminfail:${ip}`, 10, 15 * 60_000);
      throw new HttpError(401, 'unauthorized');
    }
  }

  async function handleAdmin(req, res, url, ip) {
    requireAdmin(req, ip);
    const base = (publicUrl || `http://${req.headers.host}`).replace(/\/$/, '');
    const parts = url.pathname.split('/').filter(Boolean); // api, admin, reports, :id, action

    if (parts[2] === 'reports' && parts.length === 3) {
      if (req.method === 'GET') {
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        return send(res, 200, { total: db.count(), items: db.list(limit, offset).map((r) => adminView(r, base)) });
      }
      if (req.method === 'POST') {
        const b = await readJson(req);
        if (!REPORT_TYPES[b.type]) throw new HttpError(400, 'invalid_type');
        const compound = str(b.compound);
        if (!compound) throw new HttpError(400, 'compound_required');
        const data = sanitizeData(b.data ?? {});
        if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 32_000) {
          throw new HttpError(400, 'invalid_data');
        }
        let id;
        if (b.id) {
          id = normalizeId(b.id);
          if (!id) throw new HttpError(400, 'invalid_id');
          if (db.get(id)) throw new HttpError(409, 'id_exists');
        } else {
          id = db.nextId(b.type);
        }
        const r = db.insert({
          id, code: generateCode(), type: b.type, compound,
          labelClaim: str(b.labelClaim), lot: str(b.lot), client: str(b.client), labId: str(b.labId),
          issued: date(b.issued), data, notes: str(b.notes, 2000),
        });
        db.logEvent(id, 'issued', null);
        return send(res, 201, adminView(r, base));
      }
    }

    if (parts[2] === 'reports' && parts.length >= 4) {
      const id = normalizeId(decodeURIComponent(parts[3]));
      const r = id && db.get(id);
      if (!r) throw new HttpError(404, 'not_found');
      const action = parts[4];

      if (!action && req.method === 'GET') {
        return send(res, 200, { ...adminView(r, base), events: db.eventsFor(id, 200) });
      }

      // A COA is immutable once its PDF is on file; corrections are a new report + supersede.
      if (action === 'pdf' && req.method === 'POST') {
        if (r.pdf_sha256) throw new HttpError(409, 'pdf_already_attached');
        const b = await readJson(req, MAX_PDF_JSON);
        const buf = Buffer.from(String(b.dataBase64 || ''), 'base64');
        if (buf.length < 8 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, 'not_a_pdf');
        const sha = createHash('sha256').update(buf).digest('hex');
        const dupe = db.byHash(sha);
        if (dupe) throw new HttpError(409, 'pdf_used_by_other_report', `Already attached to ${dupe.id}`);
        await writeFile(pdfPath(id), buf);
        if (!db.attachPdf(id, sha, str(b.name) || `${id}.pdf`, buf.length)) throw new HttpError(409, 'pdf_already_attached');
        db.logEvent(id, 'pdf_attached', null, sha);
        return send(res, 200, adminView(db.get(id), base));
      }

      if (action === 'status' && req.method === 'POST') {
        const b = await readJson(req);
        if (!STATUSES.includes(b.status)) throw new HttpError(400, 'invalid_status');
        let supersededBy = null;
        if (b.status === 'superseded') {
          supersededBy = normalizeId(b.supersededBy);
          if (!supersededBy || !db.get(supersededBy) || supersededBy === id) throw new HttpError(400, 'invalid_superseded_by');
        }
        db.setStatus(id, b.status, str(b.reason, 500), supersededBy);
        db.logEvent(id, `status_${b.status}`, null, str(b.reason, 500));
        return send(res, 200, adminView(db.get(id), base));
      }
    }

    if (parts[2] === 'events' && req.method === 'GET') {
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 200));
      return send(res, 200, { items: db.events(limit) });
    }

    throw new HttpError(404, 'no_route');
  }

  // ---- Static ----

  async function handleStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed');
    const rel = PRETTY_ROUTES[url.pathname] ?? decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = normalize(join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR) || file.slice(PUBLIC_DIR.length).split(sep).some((p) => p.startsWith('.'))) {
      throw new HttpError(404, 'not_found');
    }
    let st;
    try { st = await stat(file); } catch { st = null; }
    if (!st || !st.isFile()) {
      const body = await readFile(join(PUBLIC_DIR, '404.html')).catch(() => 'Not found');
      return send(res, 404, body, { 'Content-Type': MIME['.html'] });
    }
    const ext = extname(file);
    const body = req.method === 'HEAD' ? '' : await readFile(file);
    send(res, 200, body, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      ...(url.pathname === '/admin' || rel === 'admin.html' ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const ip = clientIp(req);
    try {
      if (url.pathname.startsWith('/api/admin/')) await handleAdmin(req, res, url, ip);
      else if (url.pathname.startsWith('/api/')) await handlePublic(req, res, url, ip);
      else await handleStatic(req, res, url);
    } catch (err) {
      if (err instanceof HttpError) {
        send(res, err.status, { error: err.code, message: err.message !== err.code ? err.message : undefined },
          err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {});
      } else {
        console.error(err);
        if (!res.headersSent) send(res, 500, { error: 'server_error' });
        else res.destroy();
      }
    }
  });

  server.on('close', () => db.close());
  return { server, db };
}
