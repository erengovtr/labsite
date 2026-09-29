# SideChain Analytics — site concept

A redesigned, dependency-free static website concept for **SideChain Analytics**, an independent peptide-analysis laboratory in Mississauga, Ontario.

## Structure

```
index.html        Single-page site (all sections)
assets/styles.css Design system + layout (light/dark aware)
assets/main.js    Nav, quote builder, COA verification demo, FAQ, reveal animations
```

## Run locally

No build step. Open `index.html`, or:

```bash
python3 -m http.server 8080
```

## Notes for the lab

- **COA verification** is a front-end demo. Try `SCA-2026-0417` (verified) or any other ID (not found). Wire `verifyCOA()` in `assets/main.js` to a real endpoint / database to go live.
- **Quote builder** composes an email to `info@sidechainanalytics.com`; swap for a form backend (Formspree, Netlify Forms, custom API) if preferred.
- Pricing is intentionally not shown — the builder collects what's needed for a quote.
- Content is based on publicly listed information (address, methods, turnaround). Please review wording, and add accreditations/instrument details you want to highlight.
