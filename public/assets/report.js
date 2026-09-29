(() => {
  const { $, el, normCode, fmtDate, sha256, api, wireDrop, reportUrl, takeFile } = window.SCA;
  const statusBox = $('#status');
  const main = $('#rmain');

  const params = new URLSearchParams(location.search);
  const id = (params.get('id') || '').trim().toUpperCase();
  const code = normCode(params.get('k') || '');
  if (!id) { location.replace('/'); return; }

  const DISCLAIMER = 'Results relate only to the sample as received by Side-Chain Analytics Inc. and the tests performed, as and when received — not to any other unit, vial, lot, or batch, and not to any other product bearing the same name, label, or description. This report is not a verification of any lot or batch. For research use only: this report is not a certificate of quality, safety, efficacy, or regulatory compliance; the material tested is not authorized by Health Canada for human or veterinary use; and this report is not for human or veterinary administration, clinical or diagnostic use, or label claims. Side-Chain Analytics Inc. does not manufacture, source, or sell the material tested and makes no warranty, express or implied; its liability shall not exceed the testing fee. This report may not be reproduced except in full, and may not be reproduced, displayed, quoted, or referenced — in whole or in part, including by any badge, seal, or link — in connection with the advertising, offer for sale, sale, or distribution of any product. This certificate is valid only as currently shown at sidechainanalytics.com/verify and may be withdrawn.';

  // ---------- formatting ----------
  const num = (n, d = 2) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—');
  const withUnit = (n, unit, d) => (typeof n === 'number' ? `${num(n, d)} ${unit}` : '—');
  /** C62H98N16O22 → C<sub>62</sub>H<sub>98</sub>… built as nodes. */
  const formula = (f) => {
    const span = el('span');
    String(f).split(/(\d+)/).forEach((part) => span.append(/^\d+$/.test(part) ? el('sub', {}, part) : part));
    return span;
  };
  const section = (n, title, ...kids) => el('section', { className: 'coa__sec' },
    el('h2', { className: 'coa__h' }, el('span', { className: 'coa__n' }, `§ ${n}`), title), ...kids);

  // ---------- status ----------
  function renderStatus(r) {
    const map = {
      valid: ['ok', 'Genuine and current', `Issued by SideChain Analytics on ${fmtDate(r.issued || r.recordedAt)}. This is the current version of certificate ${r.id}.`],
      superseded: ['warn', 'Superseded — a newer certificate replaces this one', `${r.id} was issued by us but has been reissued as ${r.supersededBy}. Ask your supplier for the current certificate.`],
      revoked: ['bad', 'Withdrawn — do not rely on this certificate', `${r.id} was issued by us but has since been withdrawn.`],
    };
    const [state, title, sub] = map[r.status] || map.revoked;
    const banner = el('div', { className: `rbanner is-${state}` },
      el('span', { className: 'banner__icon', ariaHidden: 'true' }),
      el('div', {},
        el('p', { className: 'rbanner__kicker' }, 'Verification result'),
        el('h1', { className: 'rbanner__title' }, title),
        el('p', { className: 'rbanner__sub' }, sub),
        r.statusReason ? el('p', { className: 'rbanner__reason' }, el('b', {}, 'Reason: '), r.statusReason, r.statusChangedAt ? ` (${fmtDate(r.statusChangedAt)})` : '') : null,
        el('p', { className: 'rbanner__meta' }, `Checked against laboratory records · ${fmtDate(r.checkedAt, true)}`)));
    statusBox.replaceChildren(el('div', { className: 'container' }, banner));
    document.title = `${r.id} · ${r.compound} — Verified Report`;
  }

  function renderError(status) {
    const msg = {
      404: ['Certificate not found', 'No certificate matches that report number and verify code. Check both — including any -HM or -EN suffix. If it still fails, this certificate was not issued by SideChain Analytics.'],
      429: ['Too many attempts', 'For security, verification is paused for your connection. Please try again in a few minutes.'],
      0: ['Connection problem', 'We could not reach the verification service. Check your connection and try again.'],
    }[status] || ['Something went wrong', 'Please try again, or contact us if the problem persists.'];
    statusBox.replaceChildren(el('div', { className: 'container' },
      el('div', { className: 'rbanner is-bad' },
        el('span', { className: 'banner__icon', ariaHidden: 'true' }),
        el('div', {},
          el('p', { className: 'rbanner__kicker' }, 'Verification result'),
          el('h1', { className: 'rbanner__title' }, msg[0]),
          el('p', { className: 'rbanner__sub' }, msg[1]),
          el('p', { className: 'rbanner__meta' }, `Report number entered: ${id}`),
          el('div', { className: 'btnrow mt' },
            el('a', { className: 'btn', href: '/' }, 'Try again'),
            status === 404 ? el('a', { className: 'btn btn--ghost', href: 'mailto:info@sidechainanalytics.com?subject=Possible%20forged%20certificate' }, 'Report a suspicious certificate') : null)))));
    document.title = 'Certificate not found — SideChain Analytics';
  }

  // ---------- certificate body ----------
  function sampleInfo(r) {
    const s = r.data.sample || {};
    const rows = [
      ['Sample ID', s.sampleId], ['Compound', r.compound], ['Report No.', r.id], ['Lot Number', r.lot],
      ['Total Mass', s.totalMass], ['Appearance', s.appearance], ['Received', s.received && fmtDate(s.received)],
      ['Analyzed', s.analyzed && fmtDate(s.analyzed)], ['CAS', s.cas], ['Formula', s.formula && formula(s.formula)],
      ['Mol Weight', s.molWeight], ['Components', s.components], ['Total Claim', s.totalClaim], ['Total Net', s.totalNet],
    ].filter(([, v]) => v);
    return section('01', 'Sample Information',
      el('dl', { className: 'coa__dl' }, rows.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v)))));
  }

  function methodLine(r) {
    const m = r.data.method || {};
    return el('div', { className: 'coa__method' },
      m.title ? el('p', { className: 'coa__mtitle' }, m.title) : null,
      m.instrument ? el('p', { className: 'coa__minst' }, `Instrument · ${m.instrument}`) : null);
  }

  function peptideResults(r) {
    const p = r.data.peptide || {};
    const tile = (label, value, note) => el('div', { className: 'tile' },
      el('span', { className: 'tile__label' }, label), el('span', { className: 'tile__value' }, value), el('span', { className: 'tile__note' }, note));
    return [
      el('div', { className: 'tiles' },
        tile('Identity', p.identity || '—', p.identityBasis || 'Principal component confirmed against reference standard'),
        tile('Net peptide content', withUnit(p.netContentMg, 'mg', 2), 'Total peptide in the vial as received'),
        tile('Peptide fill accuracy', typeof p.fillAccuracyPct === 'number' ? `${num(p.fillAccuracyPct, 1)} %` : '—', 'Measured net content ÷ declared label claim'),
        tile('Chromatographic purity', typeof p.purityPct === 'number' ? `${num(p.purityPct, 1)} %` : '—', 'Principal-component peak area (Ph. Eur. 2.2.46)')),
      el('ul', { className: 'coa__notes' },
        p.mrm ? el('li', {}, el('b', {}, 'Identity confirmation criteria'), ` — MRM ${p.mrm}; retention time ${p.retentionTime || '—'}: in agreement with reference standard.`) : null,
        el('li', {}, el('b', {}, 'Chromatographic purity'), ' bounds peptide-related impurities only — not excipients, counter-ions, or residual water — and is separate from net peptide content.'),
        el('li', {}, 'Values are reported as measured; this document contains ', el('b', {}, 'no pass/fail determination'), ' against any specification or label claim.')),
    ];
  }

  function blendResults(r) {
    const b = r.data.blend || {};
    const comps = b.components || [];
    const total = typeof b.totalNetMg === 'number' ? b.totalNetMg : comps.reduce((a, c) => a + (c.netMg || 0), 0);
    const tbody = el('tbody', {}, comps.map((c, i) => el('tr', {},
      el('td', { className: 'bl__name' }, el('i', { className: `sw sw--${i % 5}`, ariaHidden: 'true' }), c.name),
      el('td', { dataset: { label: 'Claim (mg)' } }, num(c.claimMg)),
      el('td', { dataset: { label: 'Net content (mg)' } }, num(c.netMg)),
      el('td', { dataset: { label: 'Chrom. purity (%)' } }, num(c.purityPct)),
      el('td', { dataset: { label: 'Fill acc. (%)' } }, num(c.fillPct, 1)))));
    const bar = el('div', { className: 'compbar', role: 'img', ariaLabel: 'Blend composition, share of total net peptide content' },
      comps.map((c, i) => {
        const share = total ? (c.netMg / total) * 100 : 0;
        const seg = el('span', { className: `sw--${i % 5}`, title: `${c.name}: ${share.toFixed(0)}%` }, share >= 7 ? `${share.toFixed(0)}%` : '');
        seg.style.flexBasis = `${share}%`;
        return seg;
      }));
    return [
      el('div', { className: 'tablewrap' }, el('table', { className: 'coa__table coa__table--blend' },
        el('thead', {}, el('tr', {}, [['Peptide', ''], ['Claim', '(mg)'], ['Net content', '(mg)'], ['Chrom. purity', '(%)'], ['Fill acc.', '(%)']]
          .map(([h, u]) => el('th', {}, h, u ? el('span', { className: 'unit' }, ` ${u}`) : null)))),
        tbody,
        el('tfoot', {}, el('tr', {},
          el('td', {}, 'Total net content'), el('td', { dataset: { label: 'Claim (mg)' } }, num(comps.reduce((a, c) => a + (c.claimMg || 0), 0))),
          el('td', { dataset: { label: 'Net content (mg)' } }, num(total)), el('td', { dataset: { label: 'Chrom. purity (%)' } }, '—'),
          el('td', { dataset: { label: 'Fill acc. (%)' } }, num(b.totalFillPct, 1)))))),
      el('p', { className: 'coa__caption' }, el('b', {}, 'Blend composition'), ' · share of total net peptide content'),
      bar,
      el('ul', { className: 'coa__notes' },
        el('li', {}, 'Each component is confirmed by mass identity and quantified on a single HPLC-MS/MS run from one vial.'),
        el('li', {}, 'Values are reported as measured; this document contains ', el('b', {}, 'no pass/fail determination'), ' against any specification or label claim.')),
    ];
  }

  const statusMark = (s) => (s === 'ok'
    ? el('span', { className: 'mark mark--ok' }, 'Conforms')
    : s === 'warn' ? el('span', { className: 'mark mark--warn' }, 'Warning') : el('span', { className: 'mark mark--bad' }, 'Fail'));

  /** Result-vs-limit bar: the limit sits at 80% of the track so results above it stay visible. */
  function limitBar(value, limit, state) {
    const v = parseFloat(String(value).replace(/[^0-9.]/g, ''));
    const pos = Number.isFinite(v) && limit > 0 ? Math.min(100, (v / limit) * 80) : 0;
    const dot = el('i', { className: `lbar__dot is-${state}` });
    dot.style.left = `${pos}%`;
    return el('span', { className: 'lbar', ariaHidden: 'true' }, el('i', { className: 'lbar__limit' }), dot);
  }

  function metalsResults(r) {
    const m = r.data.metals || {};
    return [
      el('div', { className: 'tablewrap' }, el('table', { className: 'coa__table coa__table--metals' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Element'), el('th', {}, 'Result ', el('span', { className: 'unit' }, `(${m.unit || 'µg/g'})`)),
          el('th', {}, 'Result vs limit'), el('th', {}, 'Limit'), el('th', {}, 'Status'))),
        el('tbody', {}, (m.elements || []).map((e) => el('tr', {},
          el('td', {}, el('b', {}, e.symbol), ` ${e.name || ''}`),
          el('td', { className: 'num', dataset: { label: 'Result' } }, e.result ?? '—'),
          el('td', { className: 'hide-sm' }, limitBar(e.result, e.limit, e.status)),
          el('td', { className: 'num', dataset: { label: 'Limit' } }, `≤ ${e.limit}`),
          el('td', { dataset: { label: 'Status' } }, statusMark(e.status))))))),
      m.conclusion ? el('p', { className: `coa__conclusion ${(m.elements || []).every((e) => e.status === 'ok') ? 'is-ok' : 'is-bad'}` }, m.conclusion) : null,
      m.note ? el('p', { className: 'coa__caption' }, m.note) : null,
    ];
  }

  function endotoxinResults(r) {
    const e = r.data.endotoxin || {};
    return [
      el('div', { className: 'endo' },
        el('div', {},
          el('span', { className: 'tile__label' }, 'Bacterial endotoxin · kinetic chromogenic (quantitative)'),
          el('p', { className: 'endo__value' }, `${e.measured ?? '—'} ${e.unit || ''}`),
          el('p', { className: `coa__conclusion ${e.status === 'ok' ? 'is-ok' : 'is-bad'}` }, e.conclusion || '')),
        el('div', { className: 'endo__bar' }, limitBar(e.measured, e.limit, e.status),
          el('div', { className: 'endo__scale' }, el('span', {}, '0'), el('span', {}, `Limit ${e.limit} ${e.unit || ''}`)))),
      el('dl', { className: 'coa__dl coa__dl--compact' },
        el('div', {}, el('dt', {}, 'Test method'), el('dd', {}, r.data.method?.title || '—')),
        el('div', {}, el('dt', {}, 'Measured endotoxin'), el('dd', {}, `${e.measured ?? '—'} ${e.unit || ''}`)),
        el('div', {}, el('dt', {}, 'Endotoxin limit'), el('dd', {}, `${e.limit ?? '—'} ${e.unit || ''}`)),
        el('div', {}, el('dt', {}, 'Status'), el('dd', {}, statusMark(e.status)))),
    ];
  }

  function custody(r) {
    const steps = r.data.custody || [];
    return section('03', 'Record & Chain of Custody',
      steps.length ? el('ol', { className: 'timeline' }, steps.map((s) => el('li', {},
        el('span', { className: 'timeline__date' }, fmtDate(s.date)),
        el('span', { className: 'timeline__event' }, s.event),
        s.by ? el('span', { className: 'timeline__by' }, s.by) : null))) : el('p', { className: 'muted' }, 'No custody entries recorded.'),
      el('p', { className: 'coa__caption' }, `Entered into the verification record ${fmtDate(r.recordedAt, true)}. Every result is reviewed by a second analyst before release.`));
  }

  function integrity(r) {
    return section('04', 'Document Integrity',
      r.pdf
        ? el('dl', { className: 'coa__dl coa__dl--compact' },
            el('div', {}, el('dt', {}, 'Released file'), el('dd', {}, `${r.pdf.name} · ${(r.pdf.size / 1024).toFixed(0)} KB`)),
            el('div', { className: 'span2' }, el('dt', {}, 'SHA-256 fingerprint'), el('dd', { className: 'mono hash' }, r.pdf.sha256)))
        : el('p', { className: 'muted' }, 'No PDF has been registered for this certificate yet.'),
      el('p', { className: 'coa__caption' }, 'Any copy of this certificate whose fingerprint differs from the one above has been altered since release.'));
  }

  function renderReport(r) {
    const results = { peptide: peptideResults, blend: blendResults, heavy_metals: metalsResults, endotoxin: endotoxinResults }[r.type];
    const titles = { peptide: 'Analytical Results', blend: 'Analytical Results', heavy_metals: 'Heavy Metals Analysis', endotoxin: 'Endotoxin Analysis' };
    // replaceChildren() would print null/undefined as text, so drop empty slots first.
    $('#report').replaceChildren(...[
      el('header', { className: 'coa__top' },
        el('span', { className: 'brand' }, el('span', { className: 'brand__mark' }, 'SC'),
          el('span', { className: 'brand__text' }, el('span', { className: 'brand__name' }, 'SIDECHAIN'), el('span', { className: 'brand__sub' }, 'ANALYTICS'))),
        el('div', { className: 'coa__id' }, el('span', {}, 'Certificate No.'), el('b', { className: 'mono' }, r.id))),
      el('p', { className: 'coa__type' }, `Certificate of Analysis · ${r.typeLabel}`),
      el('h2', { className: 'coa__compound' }, r.compound),
      r.labelClaim ? el('p', { className: 'coa__claim' }, r.labelClaim) : null,
      el('div', { className: 'coa__client' },
        r.client ? el('p', {}, el('span', {}, 'Client: '), el('b', {}, r.client)) : null,
        el('p', { className: 'coa__ids' }, [r.labId && `Lab ID ${r.labId}`, r.issued && `Issued ${fmtDate(r.issued)}`].filter(Boolean).join('   ·   '))),
      sampleInfo(r),
      section('02', titles[r.type] || 'Analytical Results', methodLine(r), ...(results ? results(r) : [])),
      custody(r),
      integrity(r),
      r.notes ? el('section', { className: 'coa__sec' }, el('p', { className: 'coa__caption' }, el('b', {}, 'Notes: '), r.notes)) : null,
      el('footer', { className: 'coa__disclaimer' },
        el('p', { className: 'coa__dtitle' }, 'Disclaimer · Research use only'),
        el('p', {}, DISCLAIMER),
        el('p', { className: 'coa__ruo' }, 'For research use only — not authorized by Health Canada for human or veterinary use')),
    ].filter(Boolean));
  }

  function renderSide(r) {
    const chip = { valid: ['chip--ok', 'Current'], superseded: ['chip--warn', 'Superseded'], revoked: ['chip--bad', 'Withdrawn'] }[r.status] || ['chip--bad', r.status];
    $('#summary').replaceChildren(
      el('h3', {}, 'Verification summary'),
      el('dl', { className: 'kv' },
        el('dt', {}, 'Certificate'), el('dd', { className: 'mono' }, r.id),
        el('dt', {}, 'Type'), el('dd', {}, r.typeLabel),
        el('dt', {}, 'Compound'), el('dd', {}, r.compound),
        r.lot ? [el('dt', {}, 'Lot'), el('dd', {}, r.lot)] : null,
        el('dt', {}, 'Issued'), el('dd', {}, fmtDate(r.issued)),
        el('dt', {}, 'Status'), el('dd', {}, el('span', { className: `chip ${chip[0]}` }, chip[1])),
        el('dt', {}, 'File check'), el('dd', { id: 'fileState' }, r.pdf ? 'Not checked yet' : 'No PDF on record')));

    const dl = $('#download');
    if (r.pdf) {
      dl.href = `/api/coa/${encodeURIComponent(r.id)}/pdf?k=${encodeURIComponent(code)}`;
      dl.setAttribute('download', `${r.id}.pdf`);
    } else {
      dl.remove();
      $('#integrity').remove();
    }
    $('#print').addEventListener('click', () => window.print());
    $('#copy').addEventListener('click', async () => {
      const url = `${location.origin}${reportUrl(r.id, code)}`;
      try { await navigator.clipboard.writeText(url); $('#copy').textContent = 'Link copied'; } catch { prompt('Copy this link:', url); }
    });
  }

  // ---------- file comparison ----------
  function showCompare(match, detail) {
    const out = $('#compareOut');
    const state = $('#fileState');
    if (match === true) {
      out.replaceChildren(el('div', { className: 'cmp cmp--ok' }, el('b', {}, 'Identical to the released certificate'),
        el('p', {}, 'This PDF is byte-for-byte the file we released. Nothing has been changed.'), detail ? el('p', { className: 'mono cmp__hash' }, detail) : null));
      if (state) state.replaceChildren(el('span', { className: 'chip chip--ok' }, 'Unaltered'));
    } else if (match === false) {
      out.replaceChildren(el('div', { className: 'cmp cmp--bad' }, el('b', {}, 'Does NOT match — altered copy'),
        el('p', {}, 'This PDF differs from the one we released. Its contents may have been edited. Rely on the record shown on this page, or download the original.'),
        detail ? el('p', { className: 'mono cmp__hash' }, detail) : null));
      if (state) state.replaceChildren(el('span', { className: 'chip chip--bad' }, 'Altered'));
    } else {
      out.replaceChildren(el('p', { className: 'cmp cmp--neutral' }, detail));
    }
  }

  async function compare(hash, name) {
    const res = await api(`/api/coa/${encodeURIComponent(id)}/compare`, { method: 'POST', body: JSON.stringify({ k: code, sha256: hash }) });
    if (!res.ok) return showCompare(null, res.status === 429 ? 'Too many attempts — please wait a few minutes.' : 'Could not compare right now.');
    if (res.data.match === null) return showCompare(null, 'No PDF on record for this certificate.');
    showCompare(res.data.match, `${name} · sha256 ${hash.slice(0, 16)}…`);
  }

  // ---------- boot ----------
  (async () => {
    if (code.length !== 9) return renderError(404);
    const res = await api(`/api/coa/${encodeURIComponent(id)}?k=${encodeURIComponent(code)}`);
    if (!res.ok) return renderError(res.status);
    const r = res.data;
    renderStatus(r);
    renderReport(r);
    renderSide(r);
    main.hidden = false;

    if (r.pdf) {
      wireDrop($('#dropCompare'), async (file) => {
        $('#compareOut').replaceChildren(el('div', { className: 'busy' }, el('span', { className: 'spinner' }), 'Fingerprinting…'));
        try { await compare(await sha256(file), file.name); } catch (e) {
          showCompare(null, e.message === 'insecure_context' ? 'File checks need a secure (https) connection.' : 'That file could not be read.');
        }
      });
      // Arrived from the home page with a PDF: re-confirm it with the server.
      const handed = takeFile(r.id);
      if (handed) compare(handed.sha256, handed.name);
    }
  })();
})();
