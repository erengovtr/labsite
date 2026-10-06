# SideChain Analytics — Report Verification Portal

A standalone verification site for **SideChain Analytics** Certificates of Analysis, designed to sit alongside the laboratory's main site (e.g. at `verify.sidechainanalytics.com`). Design follows sidechainanalytics.com: Newsreader + Helvetica, teal `#1C4E54` / gold `#C6A35C` / cream.

Zero dependencies: Node.js ≥ 22.13 (built-in `node:sqlite`) serves the site and API.

```bash
npm run seed    # sample certificates (code DEMO-2026) + their PDFs in public/demo/
ADMIN_TOKEN=$(openssl rand -hex 24) npm start   # http://localhost:8080
npm test
```

| Page | Purpose |
| --- | --- |
| `/` | Verify by report number + verify code, or by dropping the PDF. Explains what is checked, the four report types, where to find the details, and how to read a report. |
| `/verify?id=…&k=…` | The verified report: status, and the full certificate rendered online (sample information, results by type, chain of custody, document fingerprint). QR codes point here. |
| `/admin` | Lab staff: issue certificate records by type, QR codes, lock PDFs, revoke/supersede, alerts. |

## Report types

Modelled on the lab's published sample certificates. Report numbers follow the lab's format; `-HM` / `-EN` share the same number sequence.

| Type | Number | Results shown |
| --- | --- | --- |
| Identity · Purity | `COA-2026-SC-00417` | Identity, net peptide content, fill accuracy, chromatographic purity, MRM criteria — **no pass/fail** (as on the lab's certificates) |
| Blend Composition | `COA-2026-SC-00418` | Per-component claim / net / purity / fill, totals, composition bar |
| Heavy Metals | `COA-2026-SC-00419-HM` | Pb, Cd, As, Hg vs ICH Q3D parenteral limits, result-vs-limit bar, status |
| Bacterial Endotoxin | `COA-2026-SC-00420-EN` | Measured EU/mL vs limit, status |

`COA-2026-SC-00416` is a **superseded** sample. All samples use verify code `DEMO-2026`. `public/demo/COA-2026-SC-00417-edited.pdf` is an altered copy (purity 99.1 → 99.8) for demonstrating the tamper check.

## What verification protects against

| Fraud | How it's caught |
| --- | --- |
| Fabricated certificate / fake number | Number + verify code must match a record |
| Real certificate reused for another product | The full recorded certificate is shown — compound, lot, client, every result |
| Edited PDF (e.g. purity changed) | SHA-256 of the released PDF is stored; the visitor's copy is hashed **in the browser** (never uploaded) and compared |
| Enumerating numbers to read others' reports | Verify code required; unknown number and wrong code respond identically; 10 failures / 15 min per IP locks lookups |
| Withdrawn or corrected certificates | `superseded` / `revoked` shown prominently with reason and replacement number |

Every lookup is logged. Wrong codes on real numbers (`bad_code`), mismatched PDFs (`hash_mismatch`) and unknown PDFs (`file_unknown`) appear as **alerts** in the admin panel. Visitor IPs are stored only as salted hashes.

### Issuing workflow (admin)

1. Choose the report type and enter the certificate → get report number, verify code, QR (SVG).
2. Print them on the certificate and export the final PDF.
3. Upload the PDF → its fingerprint is locked. Records are immutable after this; corrections are a new certificate that supersedes the old one.

## Record format

`POST /api/admin/reports` takes `type`, `compound`, `labelClaim`, `lot`, `client`, `labId`, `issued` and a `data` object:

```jsonc
{
  "sample":   { "sampleId", "totalMass", "appearance", "received", "analyzed", "cas", "formula", "molWeight" },
  "method":   { "title", "instrument" },
  "peptide":  { "identity", "identityBasis", "netContentMg", "fillAccuracyPct", "purityPct", "mrm", "retentionTime" },
  "blend":    { "components": [{ "name", "claimMg", "netMg", "purityPct", "fillPct" }], "totalNetMg", "totalFillPct" },
  "metals":   { "unit", "elements": [{ "symbol", "name", "result", "limit", "status": "ok|warn|fail" }], "conclusion", "note" },
  "endotoxin":{ "measured", "limit", "unit", "status", "conclusion" },
  "custody":  [{ "event", "date", "by" }]
}
```

The server bounds its shape (depth, sizes, key names, value types); the page renders every value as text. This is also the shape an import from the lab's LIMS would produce.

## Deploying

Any host that runs a Node process with a persistent disk (VPS, Fly.io, Render, Railway…). A `Dockerfile` is included; mount a volume at `/data`.

| Env var | |
| --- | --- |
| `ADMIN_TOKEN` | Required for `/admin` (≥ 24 chars). Admin API is disabled without it. |
| `DATA_DIR` | SQLite DB + stored PDFs (default `./data`). **Back this up.** |
| `PUBLIC_URL` | Base for verify links / QR codes, e.g. `https://verify.sidechainanalytics.com` |
| `TRUST_PROXY=1` | Use `X-Forwarded-For` for rate limiting behind a reverse proxy |
| `PORT` | Default `8080` |

Serve over **HTTPS** — browsers only allow in-page PDF hashing on secure origins.

The lab's certificates currently print `sidechainanalytics.com/verify`; either point that path at this service or update the QR target.

## Earlier version

The full marketing-site version (ordering, capabilities, panel, contact…) is kept in `archive/full-site/` — see its README.

## Structure

```
server/app.js    HTTP server: static files, public + admin API, rate limiting, security headers
server/db.js     SQLite schema, report types and numbering
server/seed.js   Sample certificates + PDFs
public/          index.html (portal), verify.html (report), admin.html, assets/, vendor/qrcode.js (MIT)
test/            API tests (node:test)
archive/         Previous full-site front end
```
