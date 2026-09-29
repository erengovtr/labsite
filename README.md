# SideChain Analytics — website & COA verification

Website concept for **SideChain Analytics**, an independent peptide-analysis laboratory in Mississauga, Ontario. The design and copy follow the current sidechainanalytics.com (Newsreader + Helvetica, teal `#1C4E54` / gold `#C6A35C` / cream); the addition is a tamper-evident Certificate of Analysis (COA) verification system.

Zero dependencies: Node.js ≥ 22.13 (built-in `node:sqlite`) serves the site and API.

```bash
npm run seed    # demo report COA-2026-SC-00417 / code DEMO-2026 + sample PDFs
ADMIN_TOKEN=$(openssl rand -hex 24) npm start   # http://localhost:8080
npm test
```

| Page | Purpose |
| --- | --- |
| `/` | Marketing site (services, process, sample COA, quote builder, FAQ) |
| `/verify` | Public COA verification |
| `/admin` | Lab staff: issue reports, QR codes, lock PDFs, revoke/supersede, alerts |

## How verification works

Each COA carries a **report number** (`COA-YYYY-SC-NNNNN`, matching the lab's existing format), a private **verify code** (8 chars, no look-alike characters) and a **QR code** linking to `/verify?id=…&k=…`.

| Fraud | How it's caught |
| --- | --- |
| Fabricated COA / fake ID | ID + code must match a record |
| Real report reused for another product | Verification shows lab-recorded analyte, lot, client and every result |
| Edited PDF (e.g. purity 92% → 99%) | The SHA-256 of the released PDF is stored; visitors drop their copy and it's hashed **in the browser** (the file never leaves their device) and compared |
| Enumerating IDs to read others' reports | Access code required; unknown ID and wrong code return identical responses; 10 failures / 15 min per IP locks lookups |
| Withdrawn or corrected reports | `revoked` / `superseded` status shown publicly, with the replacement ID |

Visitors can also verify with **just the PDF**: a byte-exact original resolves to its report without any code.

Every lookup is logged. Wrong codes on real IDs (`bad_code`), mismatched PDFs (`hash_mismatch`) and unknown PDFs (`file_unknown`) show up as **alerts** in the admin panel — evidence that forged copies are circulating. Visitor IPs are stored only as salted hashes.

### Issuing workflow (admin)

1. Create the record → get report number, verify code, QR (SVG download).
2. Print them on the COA and export the final PDF.
3. Upload the PDF → its fingerprint is locked. Reports are immutable after this; corrections are a new report that supersedes the old one.

## Notes

- Register / client login / staff login link to the live site's existing portal.
- The live site already has a basic report lookup in its footer; this adds the PDF tamper check, revoked/superseded status, original-PDF download and forgery alerts.

## Demo for the pitch

On `/verify`, click **Fill in demo**, then download the two sample PDFs from the sidebar: the original matches, the *edited* copy (purity changed 99.2% → 99.8%) is flagged as tampered.

## Deploying

Any host that runs a Node process with a persistent disk (VPS, Fly.io, Render, Railway…). A `Dockerfile` is included; mount a volume at `/data`.

| Env var | |
| --- | --- |
| `ADMIN_TOKEN` | Required for `/admin` (≥ 24 chars). Admin API is disabled without it. |
| `DATA_DIR` | SQLite DB + stored PDFs (default `./data`). **Back this up.** |
| `PUBLIC_URL` | Base for verify links / QR codes, e.g. `https://sidechainanalytics.com` |
| `TRUST_PROXY=1` | Use `X-Forwarded-For` for rate limiting when behind a reverse proxy |
| `PORT` | Default `8080` |

Serve over **HTTPS** — browsers only allow in-page PDF hashing on secure origins.

## Structure

```
server/app.js    HTTP server: static files, public + admin API, rate limiting, security headers
server/db.js     SQLite schema and queries
server/seed.js   Demo record + sample PDFs
public/          index.html, verify.html, admin.html, assets/, vendor/qrcode.js (MIT)
test/            API tests (node:test)
```
