// Seeds demonstration reports modelled on the lab's published sample certificates —
// one per report type, plus a superseded report — and writes their PDFs to public/demo/.
// COA-2026-SC-00417-edited.pdf is the same document with the purity figure altered;
// dropping it on /verify shows how tampering is caught.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, REPORT_TYPES } from './db.js';

const CODE = 'DEMO-2026';
const HPLC = {
  title: 'Qualitative and Quantitative chemical analysis by Liquid Chromatography Tandem Mass Spectrometry (HPLC-MS/MS)',
  instrument: 'Agilent 1290 Infinity II with Agilent 6495 QQQ',
};
const custody = (received, analyzed, issued) => [
  { event: 'Sample received & logged', date: received, by: 'Sample receiving' },
  { event: 'Sample preparation', date: analyzed, by: 'Analyst A.K.' },
  { event: 'Instrument analysis', date: analyzed, by: 'Analyst A.K.' },
  { event: 'Second-analyst review', date: issued, by: 'Analyst M.R.' },
  { event: 'Certificate released', date: issued, by: 'Laboratory' },
];

const DEMOS = [
  {
    id: 'COA-2026-SC-00417', type: 'peptide', compound: 'BPC-157', labelClaim: '5 mg', lot: 'BPC-240912-A',
    client: 'Demo Customer', labId: 'SC-DEMO-04217', issued: '2026-09-19',
    data: {
      sample: { sampleId: 'SC-DEMO-04217', totalMass: '27.4 mg', appearance: 'Lyophilized powder', received: '2026-09-14', analyzed: '2026-09-17', cas: '137525-51-0', formula: 'C62H98N16O22', molWeight: '1419.5 g/mol' },
      method: HPLC,
      peptide: {
        identity: 'BPC-157', identityBasis: 'Principal component confirmed against reference standard',
        netContentMg: 4.96, fillAccuracyPct: 99.2, purityPct: 99.1,
        mrm: '710.4 › 70.1 (quantifier)', retentionTime: '4.82 min',
      },
      custody: custody('2026-09-14', '2026-09-17', '2026-09-19'),
    },
  },
  {
    id: 'COA-2026-SC-00418', type: 'blend', compound: 'KLOW', labelClaim: 'GHK-Cu: 50 mg, TB-500: 10 mg, BPC-157: 10 mg and KPV: 10 mg',
    client: 'Demo Customer', labId: 'BLD-DEMO-00418', issued: '2026-09-21',
    data: {
      sample: { sampleId: 'BLD-DEMO-00418', totalMass: '214.7 mg', appearance: 'Lyophilized powder', received: '2026-09-15', analyzed: '2026-09-18', components: '4 peptides', totalClaim: '80.00 mg', totalNet: '79.30 mg' },
      method: HPLC,
      blend: {
        components: [
          { name: 'GHK-Cu', claimMg: 50, netMg: 49.2, purityPct: 98.4, fillPct: 98.4 },
          { name: 'TB-500', claimMg: 10, netMg: 10.18, purityPct: 99.0, fillPct: 101.8 },
          { name: 'BPC-157', claimMg: 10, netMg: 9.87, purityPct: 98.9, fillPct: 98.7 },
          { name: 'KPV', claimMg: 10, netMg: 10.05, purityPct: 99.3, fillPct: 100.5 },
        ],
        totalNetMg: 79.3, totalFillPct: 99.1,
      },
      custody: custody('2026-09-15', '2026-09-18', '2026-09-21'),
    },
  },
  {
    id: 'COA-2026-SC-00419-HM', type: 'heavy_metals', compound: 'Tirzepatide', labelClaim: '10 mg', lot: 'TZP-2406-014',
    client: 'Demo Customer', labId: 'HM-TZP-DEMO-00419', issued: '2026-09-22',
    data: {
      sample: { sampleId: 'HM-TZP-DEMO-00419', totalMass: '61.4 mg', appearance: 'Lyophilized powder', received: '2026-09-15', analyzed: '2026-09-19', cas: '2023788-19-2', formula: 'C225H348N48O68', molWeight: '4814.6 g/mol' },
      method: { title: 'Heavy Metals Analysis · ICP-MS · ICH Q3D Class 1 · Parenteral', instrument: 'Agilent 8800 ICP-MS QQQ' },
      metals: {
        unit: 'µg/g',
        elements: [
          { symbol: 'Pb', name: 'Lead', result: '0.021', limit: 5, status: 'ok' },
          { symbol: 'Cd', name: 'Cadmium', result: '<0.005', limit: 2, status: 'ok' },
          { symbol: 'As', name: 'Arsenic', result: '0.14', limit: 15, status: 'ok' },
          { symbol: 'Hg', name: 'Mercury', result: '<0.010', limit: 3, status: 'ok' },
        ],
        conclusion: 'Class 1 heavy-metal screen: conforms',
        note: 'Class-1 limit = ICH Q3D Parenteral PDE (Cd 2.0 · Pb 5.0 · As 15.0 · Hg 3.0) · Units µg/g (≡ ppm) · LOQ 0.005–0.05 µg/g',
      },
      custody: custody('2026-09-15', '2026-09-19', '2026-09-22'),
    },
  },
  {
    id: 'COA-2026-SC-00420-EN', type: 'endotoxin', compound: 'Semaglutide', labelClaim: '5 mg', lot: 'SEM-2405-022',
    client: 'Demo Customer', labId: 'ENDO-SEM-DEMO-00420', issued: '2026-09-23',
    data: {
      sample: { sampleId: 'ENDO-SEM-DEMO-00420', totalMass: '47.8 mg', appearance: 'Lyophilized powder', received: '2026-09-16', analyzed: '2026-09-20', cas: '910463-68-2', formula: 'C187H291N45O59', molWeight: '4113.6 g/mol' },
      method: { title: 'Kinetic Chromogenic LAL/TAL Endotoxin Test (USP <85>)', instrument: 'FireGene kit · kinetic chromogenic (quantitative)' },
      endotoxin: { measured: 0.05, limit: 1, unit: 'EU/mL', status: 'ok', conclusion: 'Measured endotoxin 0.05 EU/mL is within the 1 EU/mL limit.' },
      custody: custody('2026-09-16', '2026-09-20', '2026-09-23'),
    },
  },
  {
    id: 'COA-2026-SC-00416', type: 'peptide', compound: 'BPC-157', labelClaim: '5 mg', lot: 'BPC-240912',
    client: 'Demo Customer', labId: 'SC-DEMO-04217', issued: '2026-09-18',
    data: {
      sample: { sampleId: 'SC-DEMO-04217', totalMass: '27.4 mg', appearance: 'Lyophilized powder', received: '2026-09-14', analyzed: '2026-09-17', cas: '137525-51-0', formula: 'C62H98N16O22', molWeight: '1419.5 g/mol' },
      method: HPLC,
      peptide: { identity: 'BPC-157', identityBasis: 'Principal component confirmed against reference standard', netContentMg: 4.96, fillAccuracyPct: 99.2, purityPct: 99.1, mrm: '710.4 › 70.1 (quantifier)', retentionTime: '4.82 min' },
      custody: custody('2026-09-14', '2026-09-17', '2026-09-18'),
    },
    status: { status: 'superseded', supersededBy: 'COA-2026-SC-00417', reason: 'Reissued with corrected lot number (BPC-240912-A).' },
  },
];

// ---------- Minimal PDF writer (single page, standard fonts) ----------
function makePdf(ops) {
  const content = ops.join('\n');
  const font = (name) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 8 0 R /F5 9 0 R >> >> /Contents 7 0 R >>',
    font('Helvetica'),
    font('Helvetica-Bold'),
    font('Courier'),
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    font('Times-Roman'),
    font('Times-Italic'),
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

const TEAL = '0.11 0.306 0.329';
const GOLD = '0.776 0.639 0.361';
const GOLD_DEEP = '0.69 0.51 0.165';
const GREY = '0.4 0.42 0.45';
// WinAnsi covers µ, ·, §, – and —; map the rest to ASCII.
const toLatin = (t) => String(t ?? '—').replace(/›/g, '>').replace(/≤/g, '<=').replace(/≡/g, '=')
  .replace(/–/g, '\x96').replace(/—/g, '\x97').replace(/[^\x20-\x7E\x96\x97\xA0-\xFF]/g, '-');
const esc = (t) => toLatin(t).replace(/[\\()]/g, (m) => `\\${m}`);
const text = (x, y, s, font = 'F1', size = 9, color = '0.21 0.22 0.25') => `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`;
const rule = (y, rgb = '0.85 0.85 0.85', w = 0.75, x1 = 48, x2 = 564) => `${rgb} RG ${w} w ${x1} ${y} m ${x2} ${y} l S`;
const fmt = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : '—');

function coaOps(r) {
  const d = r.data;
  const ops = [
    `${TEAL} rg 48 718 30 30 re f`,
    text(53, 728, 'SC', 'F2', 13, '1 1 1'),
    text(88, 738, 'SIDECHAIN', 'F2', 12, TEAL),
    text(88, 725, 'ANALYTICS', 'F1', 7, GREY),
    text(430, 740, 'SCAN TO VERIFY', 'F2', 7, GOLD_DEEP),
    text(430, 729, r.id, 'F2', 8, TEAL),
    text(430, 719, 'sidechainanalytics.com/verify', 'F1', 6),
    text(48, 690, `CERTIFICATE OF ANALYSIS  ·  ${REPORT_TYPES[r.type].label.toUpperCase()}`, 'F1', 7, GOLD),
    text(48, 652, r.compound, 'F4', 34, TEAL),
    text(48, 632, r.labelClaim, 'F4', 11, GREY),
    rule(622, GOLD, 0.75, 48, 220),
    text(48, 602, 'Client:', 'F1', 8, GREY),
    text(80, 602, r.client, 'F4', 11, TEAL),
    text(48, 590, `LAB ID  ${r.labId}      ISSUED  ${r.issued}`, 'F1', 6.5, GREY),
    text(48, 562, '§ 01', 'F2', 8, GOLD_DEEP),
    text(84, 562, 'Sample Information', 'F4', 13, TEAL),
    rule(554),
  ];
  const s = d.sample;
  const rows = [
    ['Sample ID', s.sampleId], ['Compound', r.compound], ['Report No.', r.id], ['Verify code', r.code],
    ['Lot Number', r.lot], ['Total Mass', s.totalMass], ['Appearance', s.appearance], ['Received', s.received],
    ['Analyzed', s.analyzed], ['CAS', s.cas], ['Formula', s.formula], ['Mol Weight', s.molWeight],
    ['Components', s.components], ['Total Claim', s.totalClaim], ['Total Net', s.totalNet],
  ].filter(([, v]) => v);
  rows.forEach(([k, v], i) => {
    const x = i % 2 ? 320 : 48;
    const y = 538 - Math.floor(i / 2) * 15;
    ops.push(text(x, y, `${k}:`, 'F1', 8, GREY), text(x + 78, y, v, k === 'Verify code' || k === 'Report No.' ? 'F3' : 'F2', 8, TEAL));
  });
  let y = 538 - Math.ceil(rows.length / 2) * 15 - 16;
  ops.push(text(48, y, '§ 02', 'F2', 8, GOLD_DEEP), text(84, y, 'Analytical Results', 'F4', 13, TEAL), rule(y - 8));
  y -= 24;
  ops.push(text(48, y, d.method.title, 'F5', 8, GREY));
  y -= 11;
  ops.push(text(48, y, `Instrument · ${d.method.instrument}`, 'F5', 7.5, GOLD_DEEP));
  y -= 26;

  if (r.type === 'peptide') {
    const p = d.peptide;
    const tiles = [
      ['IDENTITY', p.identity],
      ['NET PEPTIDE CONTENT', `${fmt(p.netContentMg)} mg`],
      ['PEPTIDE FILL ACCURACY', p.fillAccuracyPct == null ? '—' : `${fmt(p.fillAccuracyPct, 1)} %`],
      ['CHROMATOGRAPHIC PURITY', `${fmt(p.purityPct, 1)} %`],
    ];
    tiles.forEach(([k, v], i) => {
      const x = 48 + i * 130;
      ops.push(`${GOLD} RG 0.75 w ${x} ${y - 44} 122 56 re S`, text(x + 8, y, k, 'F2', 6, GOLD_DEEP), text(x + 8, y - 28, v, 'F4', 18, TEAL));
    });
    y -= 66;
    ops.push(text(48, y, `Identity confirmation criteria — MRM ${p.mrm}; retention time ${p.retentionTime}: in agreement with reference standard.`, 'F1', 7.5));
    ops.push(text(48, y - 12, 'Values are reported as measured; this document contains no pass/fail determination against any specification or label claim.', 'F1', 7.5));
  } else if (r.type === 'blend') {
    const b = d.blend;
    ops.push(text(48, y, 'PEPTIDE', 'F2', 7), text(300, y, 'NET CONTENT (mg)', 'F2', 7), text(400, y, 'CHROM. PURITY (%)', 'F2', 7), text(500, y, 'FILL ACC. (%)', 'F2', 7), rule(y - 5, TEAL, 1));
    for (const c of b.components) {
      y -= 17;
      ops.push(text(48, y, c.name, 'F4', 11, TEAL), text(320, y, fmt(c.netMg), 'F2', 9), text(420, y, fmt(c.purityPct), 'F2', 9), text(515, y, fmt(c.fillPct, 1), 'F2', 9));
    }
    y -= 18;
    ops.push(rule(y + 12, TEAL, 0.75), text(48, y, 'TOTAL NET CONTENT', 'F4', 10, TEAL), text(320, y, fmt(b.totalNetMg), 'F2', 9), text(420, y, '—', 'F2', 9), text(515, y, fmt(b.totalFillPct, 1), 'F2', 9));
  } else if (r.type === 'heavy_metals') {
    const m = d.metals;
    ops.push(text(48, y, 'ELEMENT', 'F2', 7), text(250, y, `RESULT (${m.unit})`, 'F2', 7), text(420, y, 'LIMIT', 'F2', 7), text(500, y, 'STATUS', 'F2', 7), rule(y - 5, TEAL, 1));
    for (const e of m.elements) {
      y -= 17;
      ops.push(text(48, y, `${e.symbol}  ${e.name}`, 'F2', 9, TEAL), text(250, y, e.result, 'F1', 9), text(420, y, `<= ${e.limit}`, 'F1', 9),
        text(500, y, e.status === 'ok' ? 'Conforms' : 'Fail', 'F2', 9, e.status === 'ok' ? '0.23 0.49 0.24' : '0.75 0.07 0.24'));
    }
    y -= 22;
    ops.push(text(48, y, m.conclusion, 'F2', 8, '0.23 0.49 0.24'), text(48, y - 11, m.note, 'F1', 6.5));
  } else if (r.type === 'endotoxin') {
    const e = d.endotoxin;
    ops.push(text(48, y - 10, `${e.measured} ${e.unit}`, 'F4', 26, TEAL), text(48, y - 28, e.conclusion, 'F1', 8.5));
    y -= 50;
    ops.push(text(48, y, 'Measured endotoxin', 'F1', 8), text(200, y, `${e.measured} ${e.unit}`, 'F2', 8),
      text(48, y - 13, 'Endotoxin limit', 'F1', 8), text(200, y - 13, `${e.limit} ${e.unit}`, 'F2', 8));
  }

  ops.push(
    rule(150, GOLD),
    text(48, 136, 'DISCLAIMER · RESEARCH USE ONLY', 'F2', 7, GOLD_DEEP),
    text(48, 124, 'Results relate only to the sample as received and the tests performed. This certificate is valid only as currently shown at', 'F1', 6.5),
    text(48, 115, 'sidechainanalytics.com/verify and may be withdrawn. Not authorized by Health Canada for human or veterinary use.', 'F1', 6.5),
    text(48, 100, 'DEMONSTRATION DOCUMENT — does not describe a real analysis.', 'F2', 6.5, '0.75 0.07 0.24'),
    rule(70, TEAL, 1),
    text(48, 58, `Issued ${r.issued}`, 'F2', 7, TEAL),
    text(430, 58, `Certificate No. ${r.id}`, 'F2', 7, TEAL),
    text(250, 44, 'Analysis performed by SideChain Analytics · Page 1 of 1', 'F1', 6, '0.5 0.5 0.5'),
  );
  return ops;
}

// ---------- Write PDFs and seed the database ----------
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = process.env.DATA_DIR || join(root, 'data');
const demoDir = join(root, 'public', 'demo');
mkdirSync(demoDir, { recursive: true });
for (const f of readdirSync(demoDir)) if (f.endsWith('.pdf')) unlinkSync(join(demoDir, f));

const db = openDb(dataDir);
for (const demo of DEMOS) {
  const r = { ...demo, code: CODE };
  const pdf = makePdf(coaOps(r));
  writeFileSync(join(demoDir, `${r.id}.pdf`), pdf);
  if (r.id === 'COA-2026-SC-00417') {
    const edited = structuredClone(r);
    edited.data.peptide.purityPct = 99.8;
    writeFileSync(join(demoDir, `${r.id}-edited.pdf`), makePdf(coaOps(edited)));
  }
  if (db.get(r.id)) { console.log(`${r.id} already exists – skipped.`); continue; }
  db.insert(r);
  const sha = createHash('sha256').update(pdf).digest('hex');
  copyFileSync(join(demoDir, `${r.id}.pdf`), join(dataDir, 'pdfs', `${r.id}.pdf`));
  db.attachPdf(r.id, sha, `${r.id}.pdf`, pdf.length);
  db.logEvent(r.id, 'issued', null, 'seed');
  if (demo.status) db.setStatus(r.id, demo.status.status, demo.status.reason, demo.status.supersededBy);
  console.log(`Seeded ${r.id} (${r.type}, code ${CODE})`);
}
db.close();
