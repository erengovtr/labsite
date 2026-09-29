import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app.js';

const TOKEN = 'test-admin-token-0123456789abcdef';
const PDF = Buffer.from('%PDF-1.4\n% test certificate\n%%EOF\n');
const PDF_EDITED = Buffer.from('%PDF-1.4\n% test certificatf\n%%EOF\n');
const sha = (b) => createHash('sha256').update(b).digest('hex');

let dir, server, base;
// Each request gets its own fake client IP so rate limits don't bleed between tests.
let ipSeq = 0;
const nextIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

async function call(path, { method = 'GET', body, admin = false, ip = nextIp() } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'X-Forwarded-For': ip,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

async function issue(extra = {}) {
  const r = await call('/api/admin/reports', {
    method: 'POST', admin: true,
    body: { analyte: 'BPC-157', lot: 'LOT-1', client: 'Acme', released: '2026-09-19',
      results: [{ test: 'Purity', method: 'HPLC', result: '99.1%', spec: '>=98%', outcome: 'pass' }], ...extra },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sca-test-'));
  ({ server } = createApp({ dataDir: dir, adminToken: TOKEN, trustProxy: true }));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((ok) => server.close(ok));
  rmSync(dir, { recursive: true, force: true });
});

test('admin endpoints reject missing or wrong token', async () => {
  assert.equal((await call('/api/admin/reports')).status, 401);
  const r = await fetch(`${base}/api/admin/reports`, { headers: { Authorization: 'Bearer nope', 'X-Forwarded-For': nextIp() } });
  assert.equal(r.status, 401);
});

test('issuing assigns sequential IDs and a formatted access code', async () => {
  const a = await issue();
  const b = await issue();
  assert.match(a.id, /^SCA-\d{4}-\d{4}$/);
  assert.equal(Number(b.id.slice(-4)), Number(a.id.slice(-4)) + 1);
  assert.match(a.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(a.verifyUrl.includes(`id=${a.id}`) && a.verifyUrl.includes(`k=${a.code}`));
});

test('custom IDs are validated and must be unique', async () => {
  const r = await issue({ id: 'legacy-001' });
  assert.equal(r.id, 'LEGACY-001');
  const dup = await call('/api/admin/reports', { method: 'POST', admin: true, body: { id: 'LEGACY-001', analyte: 'X' } });
  assert.equal(dup.status, 409);
  const bad = await call('/api/admin/reports', { method: 'POST', admin: true, body: { id: '../etc', analyte: 'X' } });
  assert.equal(bad.status, 400);
});

test('public lookup requires the correct access code, and hides which part was wrong', async () => {
  const r = await issue();
  const ok = await call(`/api/coa/${r.id}?k=${r.code}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.analyte, 'BPC-157');
  assert.equal(ok.data.results[0].result, '99.1%');
  assert.equal(ok.data.code, undefined, 'code must not be echoed back');

  // Code is normalised: lowercase, no dash
  const loose = await call(`/api/coa/${r.id.toLowerCase()}?k=${r.code.replace('-', '').toLowerCase()}`);
  assert.equal(loose.status, 200);

  const wrong = await call(`/api/coa/${r.id}?k=AAAA-AAAA`);
  const missing = await call('/api/coa/SCA-1999-9999?k=AAAA-AAAA');
  assert.equal(wrong.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(wrong.data, missing.data);
});

test('repeated failures from one IP are locked out', async () => {
  const r = await issue();
  const ip = '192.0.2.77';
  for (let i = 0; i < 10; i++) assert.equal((await call(`/api/coa/${r.id}?k=BAD${i}-CODE`, { ip })).status, 404);
  const blocked = await call(`/api/coa/${r.id}?k=${r.code}`, { ip });
  assert.equal(blocked.status, 429, 'even the correct code is refused during lockout');
  assert.ok(blocked.headers.get('retry-after'));
  assert.equal((await call(`/api/coa/${r.id}?k=${r.code}`)).status, 200, 'other IPs unaffected');
});

test('PDF attach, compare, verify-by-file and download', async () => {
  const r = await issue();
  const noPdf = await call(`/api/coa/${r.id}/compare`, { method: 'POST', body: { k: r.code, sha256: sha(PDF) } });
  assert.equal(noPdf.data.match, null);

  const up = await call(`/api/admin/reports/${r.id}/pdf`, { method: 'POST', admin: true, body: { name: 'coa.pdf', dataBase64: PDF.toString('base64') } });
  assert.equal(up.status, 200);
  assert.equal(up.data.pdf.sha256, sha(PDF));

  const same = await call(`/api/coa/${r.id}/compare`, { method: 'POST', body: { k: r.code, sha256: sha(PDF) } });
  assert.equal(same.data.match, true);
  const edited = await call(`/api/coa/${r.id}/compare`, { method: 'POST', body: { k: r.code, sha256: sha(PDF_EDITED) } });
  assert.equal(edited.data.match, false);

  const byFile = await call('/api/verify-file', { method: 'POST', body: { sha256: sha(PDF) } });
  assert.equal(byFile.status, 200);
  assert.equal(byFile.data.id, r.id);
  assert.equal(byFile.data.code, r.code);
  assert.equal((await call('/api/verify-file', { method: 'POST', body: { sha256: sha(PDF_EDITED) } })).status, 404);

  const dl = await call(`/api/coa/${r.id}/pdf?k=${r.code}`);
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('content-type'), 'application/pdf');
  assert.ok(dl.data.equals(PDF));
  assert.equal((await call(`/api/coa/${r.id}/pdf?k=AAAA-AAAA`)).status, 404);
});

test('a PDF is locked once attached and cannot be reused on another report', async () => {
  const r = await issue();
  const body = { name: 'a.pdf', dataBase64: Buffer.from('%PDF-1.4\nlock-test\n').toString('base64') };
  assert.equal((await call(`/api/admin/reports/${r.id}/pdf`, { method: 'POST', admin: true, body })).status, 200);
  assert.equal((await call(`/api/admin/reports/${r.id}/pdf`, { method: 'POST', admin: true, body })).status, 409);
  const other = await issue();
  const reuse = await call(`/api/admin/reports/${other.id}/pdf`, { method: 'POST', admin: true, body });
  assert.equal(reuse.status, 409);
  assert.equal(reuse.data.error, 'pdf_used_by_other_report');
  const notPdf = await call(`/api/admin/reports/${other.id}/pdf`, { method: 'POST', admin: true, body: { dataBase64: Buffer.from('hello').toString('base64') } });
  assert.equal(notPdf.status, 400);
});

test('revoked and superseded status is visible publicly', async () => {
  const old = await issue();
  const fresh = await issue();
  const bad = await call(`/api/admin/reports/${old.id}/status`, { method: 'POST', admin: true, body: { status: 'superseded', supersededBy: 'NOPE-1' } });
  assert.equal(bad.status, 400);
  await call(`/api/admin/reports/${old.id}/status`, { method: 'POST', admin: true, body: { status: 'superseded', supersededBy: fresh.id, reason: 'Typo in lot' } });
  const pub = await call(`/api/coa/${old.id}?k=${old.code}`);
  assert.equal(pub.data.status, 'superseded');
  assert.equal(pub.data.supersededBy, fresh.id);
  assert.equal(pub.data.statusReason, 'Typo in lot');
});

test('failed lookups and mismatches are logged as alerts', async () => {
  const r = await issue();
  await call(`/api/coa/${r.id}?k=WRNG-CODE`);
  const list = await call('/api/admin/reports?limit=500', { admin: true });
  const row = list.data.items.find((x) => x.id === r.id);
  assert.equal(row.alerts, 1);
  const detail = await call(`/api/admin/reports/${r.id}`, { admin: true });
  assert.ok(detail.data.events.some((e) => e.kind === 'bad_code'));
});

test('static files are served with security headers and no traversal', async () => {
  const home = await call('/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(home.headers.get('referrer-policy'), 'no-referrer');
  assert.equal((await call('/verify')).status, 200);
  assert.equal((await call('/admin')).headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal((await call('/..%2fserver%2fapp.js')).status, 404);
  assert.equal((await call('/%2e%2e/package.json')).status, 404);
});
