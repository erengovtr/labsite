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
    analyte_required: 'Analyte is required.',
    invalid_id: 'Report ID may only contain A–Z, 0–9 and dashes (3–40 characters).',
    id_exists: 'That report ID already exists.',
    invalid_date: 'Dates must be YYYY-MM-DD.',
    result_test_required: 'Every result row needs a test name.',
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
    if (!$('#rows').children.length) addPreset('core');
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

  // ---- Result rows ----
  const PRESETS = {
    core: [
      { test: 'Identity', method: 'HPLC-MS/MS', spec: 'Matches theoretical mass' },
      { test: 'Purity', method: 'HPLC-UV 214 nm', spec: '>= 98.0%' },
      { test: 'Net peptide content', method: 'HPLC-UV', spec: 'Report', outcome: 'report' },
    ],
    metals: [{ test: 'Heavy metals (Pb, Cd, As, Hg)', method: 'ICP-MS', spec: '< 10 ppm total' }],
    lal: [{ test: 'Bacterial endotoxin', method: 'LAL kinetic chromogenic', spec: '< 5 EU/mg' }],
  };
  function addRow(v = {}) {
    const outcome = el('select', { name: 'outcome', ariaLabel: 'Outcome' },
      ...['pass', 'fail', 'report'].map((o) => el('option', { value: o, selected: (v.outcome || 'pass') === o }, o[0].toUpperCase() + o.slice(1))));
    const row = el('div', { className: 'row' },
      el('input', { name: 'test', placeholder: 'Test', value: v.test || '', ariaLabel: 'Test' }),
      el('input', { name: 'method', placeholder: 'Method', value: v.method || '', ariaLabel: 'Method' }),
      el('input', { name: 'result', placeholder: 'Result', value: v.result || '', ariaLabel: 'Result' }),
      el('input', { name: 'spec', placeholder: 'Specification', value: v.spec || '', ariaLabel: 'Specification' }),
      outcome,
      el('button', { type: 'button', className: 'iconbtn', title: 'Remove row', ariaLabel: 'Remove row', onclick: () => row.remove() }, '×'));
    $('#rows').append(row);
  }
  const addPreset = (k) => PRESETS[k].forEach(addRow);
  $('#presetCore').addEventListener('click', () => addPreset('core'));
  $('#presetMetals').addEventListener('click', () => addPreset('metals'));
  $('#presetLal').addEventListener('click', () => addPreset('lal'));
  $('#addRow').addEventListener('click', () => addRow());

  // ---- Issue ----
  $('#issueForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    $('#issueErr').textContent = '';
    const d = Object.fromEntries(new FormData(f));
    const results = $$('#rows .row').map((r) => Object.fromEntries(
      ['test', 'method', 'result', 'spec', 'outcome'].map((k) => [k, $(`[name=${k}]`, r).value.trim()]),
    )).filter((r) => r.test || r.result);
    try {
      const rep = await api('/reports', {
        method: 'POST',
        body: {
          id: d.id || undefined, analyte: d.analyte, lot: d.lot, client: d.client, sampleDesc: d.sampleDesc,
          received: d.received, released: d.released, notes: d.notes, results,
        },
      });
      f.reset(); $('#rows').replaceChildren(); addPreset('core');
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
      el('dt', {}, 'Report ID'), el('dd', { className: 'mono' }, r.id),
      el('dt', {}, 'Access code'), el('dd', { className: 'mono' }, r.code),
      el('dt', {}, 'Verify URL'), el('dd', { className: 'mono small' }, r.verifyUrl),
      el('dt', {}, 'Status'), el('dd', {}, statusChip(r.status), r.statusReason ? ` — ${r.statusReason}` : '', r.supersededBy ? ` → ${r.supersededBy}` : ''),
      el('dt', {}, 'Analyte / lot'), el('dd', {}, `${r.analyte}${r.lot ? ` · ${r.lot}` : ''}`),
      el('dt', {}, 'PDF'), el('dd', { className: r.pdf ? 'mono small' : '' }, r.pdf ? `${r.pdf.name} · sha256 ${r.pdf.sha256}` : 'Not attached yet'),
      el('dt', {}, 'Verifications'), el('dd', {}, `${r.verifyCount}${r.lastVerifiedAt ? ` (last ${new Date(r.lastVerifiedAt).toLocaleString()})` : ''}`),
    );

    const actions = el('div', { className: 'btnrow' },
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', onclick: () => download(`${r.id}-qr.svg`, svg, 'image/svg+xml') }, 'Download QR (SVG)'),
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', onclick: () => copy(r.verifyUrl) }, 'Copy verify URL'),
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', onclick: () => copy(`Report ID: ${r.id}\nAccess code: ${r.code}\nVerify: ${r.verifyUrl}`) }, 'Copy COA text'),
      el('a', { className: 'btn btn--ghost btn--sm', href: r.verifyUrl, target: '_blank', rel: 'noopener' }, 'Open public page'),
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
    const rows = allReports.filter((r) => !q || [r.id, r.analyte, r.lot, r.client].some((v) => v && v.toLowerCase().includes(q)));
    $('#reportRows').replaceChildren(...rows.map((r) => {
      const tr = el('tr', { className: 'clickable', tabIndex: 0 },
        el('td', { className: 'mono' }, r.id), el('td', {}, r.analyte), el('td', {}, r.lot || '—'), el('td', {}, r.client || '—'),
        el('td', {}, r.released || '—'), el('td', {}, statusChip(r.status)),
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
