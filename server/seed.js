// Creates the demo report used on the public site, plus two sample PDFs:
//   public/demo/COA-2026-SC-00417.pdf         – the original on file with the lab
//   public/demo/COA-2026-SC-00417-edited.pdf  – same document with the purity figure altered
// Dropping the edited copy on /verify shows how tampering is caught.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';

const DEMO = {
  id: 'COA-2026-SC-00417',
  code: 'DEMO-2026',
  analyte: 'BPC-157',
  lot: 'BPC-240912-A',
  client: 'Example Research Supply',
  sampleDesc: 'Lyophilised powder, 5 mg vial, white',
  received: '2026-09-14',
  released: '2026-09-19',
  results: [
    { test: 'Identity', method: 'HPLC-MS/MS', result: 'Conforms', spec: 'MW 1419.5 Da', outcome: 'pass' },
    { test: 'Purity', method: 'HPLC-UV 214 nm', result: '99.2%', spec: '>= 98.0%', outcome: 'pass' },
    { test: 'Net peptide content', method: 'HPLC-UV', result: '82.4% w/w', spec: 'Report', outcome: 'report' },
    { test: 'Heavy metals (Pb, Cd, As, Hg)', method: 'ICP-MS', result: '< LOQ', spec: '< 10 ppm total', outcome: 'pass' },
    { test: 'Bacterial endotoxin', method: 'LAL kinetic chromogenic', result: '< 0.5 EU/mg', spec: '< 5 EU/mg', outcome: 'pass' },
  ],
  notes: 'Demonstration record. Not a real analysis.',
};

/** Minimal single-page PDF writer (Helvetica, ASCII only). */
function makePdf(ops) {
  const content = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 8 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const esc = (t) => String(t).replace(/[\\()]/g, (m) => `\\${m}`);
const text = (x, y, s, font = 'F1', size = 10) => `BT /${font} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`;
const rule = (y, gray = 0.8) => `${gray} G 0.75 w 48 ${y} m 564 ${y} l S 0 G`;

function coaOps(r) {
  const ops = [
    '0.11 0.306 0.329 rg 0 776 612 16 re f',
    '0.776 0.639 0.361 rg 0 774 612 2 re f 0 g',
    '0.11 0.306 0.329 rg 48 732 26 26 re f 1 g',
    text(53.5, 740, 'SC', 'F2', 11),
    '0.11 0.306 0.329 rg',
    text(82, 748, 'SIDECHAIN', 'F1', 10),
    '0.4 g',
    text(82, 737, 'ANALYTICS', 'F1', 6),
    '0 g',
    '0.69 0.51 0.165 rg',
    text(380, 748, 'CERTIFICATE OF ANALYSIS', 'F2', 8),
    '0.4 g',
    text(380, 737, 'Demonstration document', 'F1', 7),
    '0 g',
    text(48, 700, r.analyte, 'F4', 22),
    rule(690),
  ];
  const meta = [
    ['Report No.', r.id], ['Verify code', r.code], ['Analyte', r.analyte], ['Lot / batch', r.lot],
    ['Submitted by', r.client], ['Sample', r.sampleDesc], ['Received', r.received], ['Released', r.released],
  ];
  meta.forEach(([k, v], i) => {
    const x = i % 2 ? 320 : 48;
    const y = 670 - Math.floor(i / 2) * 20;
    ops.push(text(x, y, k.toUpperCase(), 'F1', 7), text(x + 80, y, v, k === 'Report No.' || k === 'Verify code' ? 'F3' : 'F1', 10));
  });
  ops.push(rule(586));
  let y = 568;
  ops.push(text(48, y, 'TEST', 'F2', 8), text(210, y, 'METHOD', 'F2', 8), text(340, y, 'RESULT', 'F2', 8), text(450, y, 'SPECIFICATION', 'F2', 8));
  for (const row of r.results) {
    y -= 22;
    ops.push(text(48, y, row.test), text(210, y, row.method, 'F1', 9), text(340, y, row.result, 'F2'), text(450, y, `${row.spec}  [${row.outcome.toUpperCase()}]`, 'F1', 8));
    ops.push(rule(y - 8, 0.9));
  }
  y -= 40;
  ops.push(
    text(48, y, 'Verify this report at sidechainanalytics.com/verify using the report number and verify code above.', 'F1', 9),
    text(48, y - 14, 'Upload this PDF there to confirm it has not been altered since release.', 'F1', 9),
    text(48, 60, 'For research use only. Not for human or veterinary diagnostic or therapeutic use.', 'F1', 7),
    text(48, 48, 'This is a demonstration document and does not describe a real analysis.', 'F1', 7),
  );
  return ops;
}

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = process.env.DATA_DIR || join(root, 'data');
const demoDir = join(root, 'public', 'demo');
mkdirSync(demoDir, { recursive: true });

const original = makePdf(coaOps(DEMO));
const edited = makePdf(coaOps({ ...DEMO, results: DEMO.results.map((r) => (r.test === 'Purity' ? { ...r, result: '99.8%' } : r)) }));
writeFileSync(join(demoDir, `${DEMO.id}.pdf`), original);
writeFileSync(join(demoDir, `${DEMO.id}-edited.pdf`), edited);

const db = openDb(dataDir);
if (db.get(DEMO.id)) {
  console.log(`${DEMO.id} already exists – leaving database unchanged.`);
} else {
  db.insert(DEMO);
  const sha = createHash('sha256').update(original).digest('hex');
  copyFileSync(join(demoDir, `${DEMO.id}.pdf`), join(dataDir, 'pdfs', `${DEMO.id}.pdf`));
  db.attachPdf(DEMO.id, sha, `${DEMO.id}.pdf`, original.length);
  db.logEvent(DEMO.id, 'issued', null, 'seed');
  console.log(`Seeded ${DEMO.id} (code ${DEMO.code}), sha256 ${sha}`);
}
db.close();
