(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => n.append(k instanceof Node ? k : document.createTextNode(k ?? '')));
    return n;
  };
  const TOKEN_KEY = 'sca-admin-token';
  let token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch { /* storage blocked */ }

  const ERRORS = {
    unauthorized: 'Invalid token.',
    admin_disabled: 'The admin API is disabled on this server (ADMIN_TOKEN not set).',
    too_many_failures: 'Too many failed attempts. Try again in 15 minutes.',
    compound_required: 'Compound is required.',
    invalid_type: 'Choose a report type.',
    invalid_data: 'Some result values are malformed.',
    invalid_id: 'Report ID may only contain A–Z, 0–9 and dashes (3–40 characters).',
    id_exists: 'That report ID already exists.',
    invalid_date: 'Dates must be YYYY-MM-DD.',
    not_a_pdf: 'That file is not a PDF.',
    pdf_already_attached: 'A PDF is already attached to this report. Issue a new report to correct it.',
    pdf_used_by_other_report: 'This exact PDF is already attached to another report.',
    invalid_superseded_by: 'Enter the ID of an existing, different report.',
    payload_too_large: 'File too large.',
  };
  const errText = (d) => d?.message || ERRORS[d?.error] || `Error: ${d?.error || 'unknown'}`;

  function toast(msg) {
    document.querySelectorAll('.toast').forEach((n) => n.remove());
    const t = el('div', { className: 'toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2600);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`/api/admin${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) signOut();
    if (!res.ok) throw Object.assign(new Error(errText(data)), { data });
    return data;
  }

  // ---- Auth ----
  function signOut() {
    token = '';
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    $('#app').hidden = true; $('#logout').hidden = true; $('#login').hidden = false;
  }
  async function signIn(t) {
    token = t;
    await api('/reports?limit=1');
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
    $('#login').hidden = true; $('#app').hidden = false; $('#logout').hidden = false;
    if (!$('#rows-custody').children.length) resetIssueForm();
  }
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try { await signIn($('#token').value.trim()); } catch (err) { $('#loginErr').textContent = err.message; signOut(); }
  });
  $('#logout').addEventListener('click', signOut);

  // ---- Tabs ----
  function show(view) {
    $$('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    $$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== view; });
    $('#detail').hidden = true;
    if (view === 'reports') loadReports();
    if (view === 'activity') loadEvents();
  }
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

  // ---- Issue form (type-aware) ----
  const METHODS = {
    peptide: ['Qualitative and Quantitative chemical analysis by Liquid Chromatography Tandem Mass Spectrometry (HPLC-MS/MS)', 'Agilent 1290 Infinity II with Agilent 6495 QQQ'],
    blend: ['Qualitative and Quantitative chemical analysis by Liquid Chromatography Tandem Mass Spectrometry (HPLC-MS/MS)', 'Agilent 1290 Infinity II with Agilent 6495 QQQ'],
    heavy_metals: ['Heavy Metals Analysis · ICP-MS · ICH Q3D Class 1 · Parenteral', 'Agilent 8800 ICP-MS QQQ'],
    endotoxin: ['Kinetic Chromogenic LAL/TAL Endotoxin Test (USP <85>)', 'FireGene kit · kinetic chromogenic (quantitative)'],
  };
  const METALS = [['Pb', 'Lead', 5], ['Cd', 'Cadmium', 2], ['As', 'Arsenic', 15], ['Hg', 'Mercury', 3]];
  const CUSTODY = ['Sample received & logged', 'Sample preparation', 'Instrument analysis', 'Second-analyst review', 'Certificate released'];

  const input = (name, props = {}) => el('input', { name, ariaLabel: props.placeholder || name, ...props });
  const removeBtn = (row) => el('button', { type: 'button', className: 'iconbtn', title: 'Remove', ariaLabel: 'Remove row', onclick: () => row.remove() }, '×');
  const ROWS = {
    blend(v = {}) {
      const row = el('div', { className: 'row row--blend' });
      row.append(input('name', { placeholder: 'Peptide', value: v.name || '' }), input('claimMg', { placeholder: 'Claim', inputMode: 'decimal' }),
        input('netMg', { placeholder: 'Net', inputMode: 'decimal' }), input('purityPct', { placeholder: 'Purity', inputMode: 'decimal' }),
        input('fillPct', { placeholder: 'auto', inputMode: 'decimal' }), removeBtn(row));
      $('#rows-blend').append(row);
    },
    metals([symbol = '', name = '', limit = ''] = []) {
      const row = el('div', { className: 'row row--metals' });
      const status = el('select', { name: 'status', ariaLabel: 'Status' },
        el('option', { value: 'auto' }, 'Auto'), el('option', { value: 'ok' }, 'Conforms'), el('option', { value: 'warn' }, 'Warning'), el('option', { value: 'fail' }, 'Fail'));
      row.append(input('symbol', { placeholder: 'Symbol', value: symbol }), input('name', { placeholder: 'Element', value: name }),
        input('result', { placeholder: 'e.g. 0.021 or <0.005' }), input('limit', { placeholder: 'Limit', value: String(limit), inputMode: 'decimal' }), status, removeBtn(row));
      $('#rows-metals').append(row);
    },
    custody(event = '') {
      const row = el('div', { className: 'row row--custody' });
      row.append(input('event', { placeholder: 'Step', value: event }), input('date', { type: 'date' }), input('by', { placeholder: 'By (initials / role)' }), removeBtn(row));
      $('#rows-custody').append(row);
    },
  };
  $$('[data-add]').forEach((b) => b.addEventListener('click', () => ROWS[b.dataset.add]()));

  function resetIssueForm() {
    $('#issueForm').reset();
    ['blend', 'metals', 'custody'].forEach((k) => $(`#rows-${k}`).replaceChildren());
    ROWS.blend(); ROWS.blend();
    METALS.forEach((m) => ROWS.metals(m));
    CUSTODY.forEach((c) => ROWS.custody(c));
    applyType();
  }

  function applyType() {
    const type = $('#type').value;
    $$('.typeset').forEach((fs) => { fs.hidden = fs.dataset.type !== type; });
    $$('[data-for]').forEach((f) => { f.hidden = !f.dataset.for.split(' ').includes(type); });
    [$('#mTitle').value, $('#mInst').value] = METHODS[type];
  }
  $('#type').addEventListener('change', applyType);

  const toNum = (v) => {
    const s = String(v ?? '').trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`"${v}" is not a number.`);
    return n;
  };
  const setPath = (obj, path, value) => {
    const [a, b] = path.split('.');
    (obj[a] ||= {})[b] = value;
  };
  const rowsOf = (id, keys) => $$(`#${id} .row`).map((r) => Object.fromEntries(keys.map((k) => [k, $(`[name=${k}]`, r).value.trim()])));

  function collectData(type) {
    const data = {};
    $$('#issueForm [data-k]').forEach((i) => {
      const [group] = i.dataset.k.split('.');
      const wanted = ['sample', 'method', type === 'heavy_metals' ? 'metals' : type].includes(group);
      if (!wanted || i.closest('[hidden]')) return;
      const v = 'num' in i.dataset ? toNum(i.value) : i.value.trim();
      if (v !== '' && v !== null) setPath(data, i.dataset.k, v);
    });
    if (type === 'blend') {
      const components = rowsOf('rows-blend', ['name', 'claimMg', 'netMg', 'purityPct', 'fillPct']).filter((c) => c.name).map((c) => {
        const claimMg = toNum(c.claimMg); const netMg = toNum(c.netMg);
        const fillPct = toNum(c.fillPct) ?? (claimMg && netMg != null ? Math.round((netMg / claimMg) * 1000) / 10 : null);
        return { name: c.name, claimMg, netMg, purityPct: toNum(c.purityPct), fillPct };
      });
      if (!components.length) throw new Error('Add at least one blend component.');
      const totalNetMg = Math.round(components.reduce((a, c) => a + (c.netMg || 0), 0) * 100) / 100;
      const totalClaim = components.reduce((a, c) => a + (c.claimMg || 0), 0);
      data.blend = { components, totalNetMg, totalFillPct: totalClaim ? Math.round((totalNetMg / totalClaim) * 1000) / 10 : null };
      data.sample = { ...data.sample, components: `${components.length} peptides`, totalClaim: `${totalClaim.toFixed(2)} mg`, totalNet: `${totalNetMg.toFixed(2)} mg` };
    }
    if (type === 'heavy_metals') {
      const elements = rowsOf('rows-metals', ['symbol', 'name', 'result', 'limit', 'status']).filter((m) => m.symbol).map((m) => {
        const limit = toNum(m.limit);
        const value = parseFloat(m.result.replace(/[^0-9.]/g, ''));
        const status = m.status !== 'auto' ? m.status : (Number.isFinite(value) && limit != null && value > limit ? 'fail' : 'ok');
        return { symbol: m.symbol, name: m.name, result: m.result, limit, status };
      });
      if (!elements.length) throw new Error('Add at least one element.');
      data.metals = { unit: 'µg/g', ...data.metals, elements };
    }
    if (type === 'endotoxin') {
      const e = data.endotoxin || {};
      if (e.measured == null || e.limit == null) throw new Error('Enter the measured endotoxin and the limit.');
      e.status = e.measured <= e.limit ? 'ok' : 'fail';
      e.unit ||= 'EU/mL';
      e.conclusion = `Measured endotoxin ${e.measured} ${e.unit} is ${e.status === 'ok' ? 'within' : 'above'} the ${e.limit} ${e.unit} limit.`;
      data.endotoxin = e;
    }
    const custody = rowsOf('rows-custody', ['event', 'date', 'by']).filter((c) => c.event);
    if (custody.length) data.custody = custody;
    return data;
  }

  $('#issueForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    $('#issueErr').textContent = '';
    const d = Object.fromEntries(new FormData(f));
    try {
      if (!d.compound?.trim()) throw new Error('Compound is required.');
      const data = collectData(d.type);
      const rep = await api('/reports', {
        method: 'POST',
        body: {
          type: d.type, id: d.id || undefined, compound: d.compound, labelClaim: d.labelClaim, client: d.client,
          labId: d.labId, lot: d.lot, issued: d.issued, notes: d.notes, data,
        },
      });
      resetIssueForm();
      toast(`${rep.id} created`);
      openDetail(rep.id);
    } catch (err) { $('#issueErr').textContent = err.message; }
  });

  // ---- Detail ----
  function qrSvg(text) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: 'Verification QR code' });
  }
  function download(name, content, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([content], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast('Copied'), () => toast('Copy failed'));
  const statusChip = (s) => el('span', { className: `chip ${s === 'valid' ? 'chip--ok' : 'chip--bad'}` }, s);

  async function openDetail(id) {
    let r;
    try { r = await api(`/reports/${encodeURIComponent(id)}`); } catch (err) { return toast(err.message); }
    const box = $('#detail');
    const svg = qrSvg(r.verifyUrl);
    const qr = el('div', { className: 'qr' });
    qr.innerHTML = svg; // generated locally from our own URL

    const kv = el('dl', { className: 'kv' },
      el('dt', {}, 'Report No.'), el('dd', { className: 'mono' }, r.id),
      el('dt', {}, 'Verify code'), el('dd', { className: 'mono' }, r.code),
      el('dt', {}, 'Verify URL'), el('dd', { className: 'mono small' }, r.verifyUrl),
      el('dt', {}, 'Status'), el('dd', {}, statusChip(r.status), r.statusReason ? ` — ${r.statusReason}` : '', r.supersededBy ? ` → ${r.supersededBy}` : ''),
      el('dt', {}, 'Type'), el('dd', {}, r.typeLabel),
      el('dt', {}, 'Compound / lot'), el('dd', {}, `${r.compound}${r.lot ? ` · ${r.lot}` : ''}`),
      el('dt', {}, 'PDF'), el('dd', { className: r.pdf ? 'mono small' : '' }, r.pdf ? `${r.pdf.name} · sha256 ${r.pdf.sha256}` : 'Not attached yet'),
      el('dt', {}, 'Verifications'), el('dd', {}, `${r.verifyCount}${r.lastVerifiedAt ? ` (last ${new Date(r.lastVerifiedAt).toLocaleString()})` : ''}`),
    );

    const actions = el('div', { className: 'btnrow' },
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', onclick: () => download(`${r.id}-qr.svg`, svg, 'image/svg+xml') }, 'Download QR (SVG)'),
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', onclick: () => copy(r.verifyUrl) }, 'Copy verify URL'),
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', onclick: () => copy(`Report No.: ${r.id}\nVerify code: ${r.code}\nVerify: ${r.verifyUrl}`) }, 'Copy COA text'),
      el('a', { className: 'btn btn--ghost btn--sm', href: r.verifyUrl, target: '_blank', rel: 'noopener' }, 'Open verified report'),
    );

    const parts = [el('h2', {}, `${r.id}`), el('div', { className: 'issued' }, qr, el('div', {}, kv, actions))];

    if (!r.pdf) {
      const input = el('input', { type: 'file', accept: 'application/pdf,.pdf' });
      const err = el('p', { className: 'err' });
      const btn = el('button', { type: 'button', className: 'btn btn--sm' }, 'Upload & lock PDF');
      btn.addEventListener('click', async () => {
        const file = input.files[0];
        if (!file) { err.textContent = 'Choose the final PDF first.'; return; }
        if (!confirm(`Lock ${file.name} as the official PDF for ${r.id}? This cannot be changed afterwards.`)) return;
        btn.disabled = true; err.textContent = '';
        try {
          const b64 = await new Promise((ok, fail) => {
            const fr = new FileReader();
            fr.onload = () => ok(String(fr.result).split(',')[1]);
            fr.onerror = fail;
            fr.readAsDataURL(file);
          });
          await api(`/reports/${encodeURIComponent(r.id)}/pdf`, { method: 'POST', body: { name: file.name, dataBase64: b64 } });
          toast('PDF locked');
          openDetail(r.id);
        } catch (e2) { err.textContent = e2.message; btn.disabled = false; }
      });
      parts.push(el('div', { className: 'panel mt' },
        el('h3', {}, 'Step 3 — attach the final PDF'),
        el('p', { className: 'small muted' }, 'Upload the exact file you send to the client, after the ID, code and QR are printed on it. Its SHA-256 fingerprint is stored and used to detect edited copies.'),
        el('div', { className: 'btnrow' }, input, btn), err));
    }

    // Status management
    const sel = el('select', {}, ...['valid', 'revoked', 'superseded'].map((s) => el('option', { value: s, selected: s === r.status }, s)));
    const reason = el('input', { placeholder: 'Reason (shown publicly)', value: r.statusReason || '' });
    const sup = el('input', { placeholder: 'Superseded by (report ID)', className: 'mono up', value: r.supersededBy || '' });
    const serr = el('p', { className: 'err' });
    const sbtn = el('button', { type: 'button', className: 'btn btn--ghost btn--sm' }, 'Update status');
    sbtn.addEventListener('click', async () => {
      serr.textContent = '';
      try {
        await api(`/reports/${encodeURIComponent(r.id)}/status`, { method: 'POST', body: { status: sel.value, reason: reason.value, supersededBy: sup.value } });
        toast('Status updated'); openDetail(r.id);
      } catch (e2) { serr.textContent = e2.message; }
    });
    parts.push(el('div', { className: 'panel mt' },
      el('h3', {}, 'Status'),
      el('div', { className: 'row' }, sel, reason, sup, sbtn), serr));

    // Events
    const tb = el('tbody');
    r.events.forEach((ev) => tb.append(eventRow(ev)));
    parts.push(el('div', { className: 'mt' }, el('h3', {}, 'Activity'),
      el('div', { className: 'table-wrap' }, el('table', { className: 'table' },
        el('thead', {}, el('tr', {}, ...['Time', 'Report', 'Event', 'Visitor', 'Detail'].map((h) => el('th', {}, h)))), tb))));

    box.replaceChildren(...parts);
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Reports list ----
  let allReports = [];
  async function loadReports() {
    try {
      const d = await api('/reports?limit=500');
      allReports = d.items;
      $('#total').textContent = `(${d.total})`;
      renderReports();
    } catch (err) { toast(err.message); }
  }
  function renderReports() {
    const q = $('#filter').value.trim().toLowerCase();
    const rows = allReports.filter((r) => !q || [r.id, r.compound, r.lot, r.client].some((v) => v && v.toLowerCase().includes(q)));
    $('#reportRows').replaceChildren(...rows.map((r) => {
      const tr = el('tr', { className: 'clickable', tabIndex: 0 },
        el('td', { className: 'mono' }, r.id), el('td', {}, r.typeLabel), el('td', {}, r.compound), el('td', {}, r.lot || '—'), el('td', {}, r.client || '—'),
        el('td', {}, r.issued || '—'), el('td', {}, statusChip(r.status)),
        el('td', {}, r.pdf ? '✓' : el('span', { className: 'chip' }, 'missing')),
        el('td', {}, String(r.verifyCount)),
        el('td', {}, r.alerts ? el('span', { className: 'chip chip--bad' }, String(r.alerts)) : '0'));
      tr.addEventListener('click', () => openDetail(r.id));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDetail(r.id); });
      return tr;
    }));
  }
  $('#filter').addEventListener('input', renderReports);

  // ---- Events ----
  const ALERTS = new Set(['bad_code', 'hash_mismatch', 'file_unknown']);
  function eventRow(ev) {
    return el('tr', {},
      el('td', { className: 'small' }, new Date(ev.ts).toLocaleString()),
      el('td', { className: 'mono' }, ev.report_id || '—'),
      el('td', {}, el('span', { className: `chip ${ALERTS.has(ev.kind) ? 'chip--bad' : ev.kind.includes('verified') || ev.kind === 'hash_match' ? 'chip--ok' : ''}` }, ev.kind)),
      el('td', { className: 'mono small' }, ev.ip_hash ? ev.ip_hash.slice(0, 8) : '—'),
      el('td', { className: 'mono small' }, ev.detail ? (ev.detail.length > 24 ? `${ev.detail.slice(0, 24)}…` : ev.detail) : ''));
  }
  async function loadEvents() {
    try {
      const d = await api('/events?limit=500');
      const only = $('#alertsOnly').checked;
      $('#eventRows').replaceChildren(...d.items.filter((e) => !only || ALERTS.has(e.kind)).map(eventRow));
    } catch (err) { toast(err.message); }
  }
  $('#alertsOnly').addEventListener('change', loadEvents);

  // ---- Boot ----
  if (token) signIn(token).catch(signOut); else signOut();
})();
