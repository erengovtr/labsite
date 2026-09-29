import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomInt } from 'node:crypto';

// Access codes avoid look-alike characters (0/O, 1/I/L) so they survive print and retyping.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ID_RE = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
export const SHA256_RE = /^[a-f0-9]{64}$/;
export const STATUSES = ['valid', 'revoked', 'superseded'];

export function generateCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Uppercases and strips everything but the code alphabet, then re-inserts the dash. */
export function normalizeCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : null;
}

export function normalizeId(raw) {
  const s = String(raw || '').trim().toUpperCase();
  return ID_RE.test(s) ? s : null;
}

export function openDb(dataDir) {
  mkdirSync(join(dataDir, 'pdfs'), { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'coa.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS reports (
      id               TEXT PRIMARY KEY,
      code             TEXT NOT NULL,
      analyte          TEXT NOT NULL,
      lot              TEXT,
      client           TEXT,
      sample_desc      TEXT,
      received         TEXT,
      released         TEXT,
      results          TEXT NOT NULL DEFAULT '[]',
      notes            TEXT,
      pdf_sha256       TEXT UNIQUE,
      pdf_name         TEXT,
      pdf_size         INTEGER,
      status           TEXT NOT NULL DEFAULT 'valid',
      status_reason    TEXT,
      superseded_by    TEXT,
      created_at       TEXT NOT NULL,
      verify_count     INTEGER NOT NULL DEFAULT 0,
      last_verified_at TEXT
    );

    -- Audit trail of every public lookup. Failed codes and hash mismatches on real
    -- report IDs are the signal that someone is circulating a forged or edited copy.
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      ts        TEXT NOT NULL,
      report_id TEXT,
      kind      TEXT NOT NULL,
      ip_hash   TEXT,
      detail    TEXT
    );
    CREATE INDEX IF NOT EXISTS events_report ON events(report_id);
    CREATE INDEX IF NOT EXISTS events_kind ON events(kind, ts);
  `);

  const q = {
    get: db.prepare('SELECT * FROM reports WHERE id = ?'),
    byHash: db.prepare('SELECT * FROM reports WHERE pdf_sha256 = ?'),
    lastForPrefix: db.prepare("SELECT id FROM reports WHERE id LIKE ? ORDER BY id DESC LIMIT 1"),
    insert: db.prepare(`INSERT INTO reports
      (id, code, analyte, lot, client, sample_desc, received, released, results, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    attachPdf: db.prepare('UPDATE reports SET pdf_sha256 = ?, pdf_name = ?, pdf_size = ? WHERE id = ? AND pdf_sha256 IS NULL'),
    setStatus: db.prepare('UPDATE reports SET status = ?, status_reason = ?, superseded_by = ? WHERE id = ?'),
    touch: db.prepare('UPDATE reports SET verify_count = verify_count + 1, last_verified_at = ? WHERE id = ?'),
    list: db.prepare(`SELECT r.*,
        (SELECT COUNT(*) FROM events e WHERE e.report_id = r.id AND e.kind IN ('bad_code','hash_mismatch')) AS alerts
      FROM reports r ORDER BY r.created_at DESC LIMIT ? OFFSET ?`),
    count: db.prepare('SELECT COUNT(*) AS n FROM reports'),
    event: db.prepare('INSERT INTO events (ts, report_id, kind, ip_hash, detail) VALUES (?, ?, ?, ?, ?)'),
    events: db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?'),
    eventsFor: db.prepare('SELECT * FROM events WHERE report_id = ? ORDER BY id DESC LIMIT ?'),
  };

  return {
    raw: db,
    get: (id) => q.get.get(id),
    byHash: (h) => q.byHash.get(h),
    /** Next number in the lab's report format, e.g. COA-2026-SC-00042. */
    nextId(year = new Date().getUTCFullYear()) {
      const prefix = `COA-${year}-SC-`;
      const last = q.lastForPrefix.get(`${prefix}%`);
      const n = last ? parseInt(last.id.slice(prefix.length), 10) + 1 : 1;
      return `${prefix}${String(n).padStart(5, '0')}`;
    },
    insert(r) {
      q.insert.run(r.id, r.code, r.analyte, r.lot ?? null, r.client ?? null, r.sampleDesc ?? null,
        r.received ?? null, r.released ?? null, JSON.stringify(r.results ?? []), r.notes ?? null,
        new Date().toISOString());
      return q.get.get(r.id);
    },
    attachPdf: (id, sha, name, size) => q.attachPdf.run(sha, name, size, id).changes === 1,
    setStatus: (id, status, reason, supersededBy) => q.setStatus.run(status, reason ?? null, supersededBy ?? null, id),
    touch: (id) => q.touch.run(new Date().toISOString(), id),
    list: (limit = 100, offset = 0) => q.list.all(limit, offset),
    count: () => q.count.get().n,
    logEvent: (reportId, kind, ipHash, detail) => q.event.run(new Date().toISOString(), reportId ?? null, kind, ipHash ?? null, detail ?? null),
    events: (limit = 100) => q.events.all(limit),
    eventsFor: (id, limit = 100) => q.eventsFor.all(id, limit),
    close: () => db.close(),
  };
}
