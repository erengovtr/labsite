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
    body: {
      type: 'peptide', compound: 'BPC-157', labelClaim: '5 mg', lot: 'LOT-1', client: 'Acme', issued: '2026-09-19',
      data: {
        sample: { sampleId: 'S-1', totalMass: '27.4 mg' },
        peptide: { identity: 'BPC-157', netContentMg: 4.96, purityPct: 99.1, fillAccuracyPct: null },
        custody: [{ event: 'Received', date: '2026-09-14', by: 'AK' }],
      },
      ...extra,
    },
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
  assert.match(a.id, /^COA-\d{4}-SC-\d{5}$/);
  assert.equal(Number(b.id.slice(-4)), Number(a.id.slice(-4)) + 1);
  assert.match(a.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(a.verifyUrl.includes(`id=${a.id}`) && a.verifyUrl.includes(`k=${a.code}`));
});

test('custom IDs are validated and must be unique', async () => {
  const r = await issue({ id: 'legacy-001' });
  assert.equal(r.id, 'LEGACY-001');
  const dup = await call('/api/admin/reports', { method: 'POST', admin: true, body: { id: 'LEGACY-001', type: 'peptide', compound: 'X' } });
  assert.equal(dup.status, 409);
  const bad = await call('/api/admin/reports', { method: 'POST', admin: true, body: { id: '../etc', type: 'peptide', compound: 'X' } });
  assert.equal(bad.status, 400);
});

test('public lookup requires the correct access code, and hides which part was wrong', async () => {
  const r = await issue();
  const ok = await call(`/api/coa/${r.id}?k=${r.code}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.compound, 'BPC-157');
  assert.equal(ok.data.type, 'peptide');
  assert.equal(ok.data.typeLabel, 'Identity · Purity');
  assert.equal(ok.data.data.peptide.purityPct, 99.1);
  assert.equal(ok.data.data.custody[0].event, 'Received');
  assert.equal(ok.data.code, undefined, 'code must not be echoed back');

  // Code is normalised: lowercase, no dash
  const loose = await call(`/api/coa/${r.id.toLowerCase()}?k=${r.code.replace('-', '').toLowerCase()}`);
  assert.equal(loose.status, 200);

  const wrong = await call(`/api/coa/${r.id}?k=AAAA-AAAA`);
  const missing = await call('/api/coa/COA-1999-SC-99999?k=AAAA-AAAA');
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

test('heavy-metal and endotoxin reports get the lab\'s -HM / -EN suffix', async () => {
  const hm = await issue({ type: 'heavy_metals', compound: 'Tirzepatide', data: { metals: { elements: [{ symbol: 'Pb', result: '0.02', limit: 5, status: 'ok' }] } } });
  assert.match(hm.id, /^COA-\d{4}-SC-\d{5}-HM$/);
  const en = await issue({ type: 'endotoxin', compound: 'Semaglutide', data: { endotoxin: { measured: 0.05, limit: 1 } } });
  assert.match(en.id, /^COA-\d{4}-SC-\d{5}-EN$/);
  assert.equal(Number(en.id.slice(12, 17)), Number(hm.id.slice(12, 17)) + 1, 'suffixed reports share one number sequence');
  const next = await issue();
  assert.equal(Number(next.id.slice(-5)), Number(en.id.slice(12, 17)) + 1);
});

test('report data is type-checked and bounded', async () => {
  const post = (body) => call('/api/admin/reports', { method: 'POST', admin: true, body: { type: 'peptide', compound: 'X', ...body } });
  assert.equal((await post({ type: 'nope' })).status, 400);
  assert.equal((await post({ compound: '' })).status, 400);
  assert.equal((await post({ data: { peptide: { purityPct: 'x'.repeat(2000) } } })).status, 400);
  assert.equal((await post({ data: { 'bad key': 1 } })).status, 400);
  assert.equal((await post({ data: { a: { b: { c: { d: { e: 1 } } } } } })).status, 400, 'too deep');
  assert.equal((await post({ data: [1, 2] })).status, 400, 'must be an object');
  const ok = await post({ data: { peptide: { note: '<script>alert(1)</script>' } } });
  assert.equal(ok.status, 201, 'markup is stored as plain text; the page renders it with textContent');
});
