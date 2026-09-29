(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const result = $('#result');
  const formId = $('#pane-id');
  const fId = $('#fId');
  const fCode = $('#fCode');
  const tpl = $('#tplResult');

  // ---- Tabs ----
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next); next.focus();
    });
  });

  // ---- Helpers ----
  const normCode = (v) => {
    const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
  };
  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(`${d.length === 10 ? `${d}T12:00:00` : d}`);
    return Number.isNaN(+dt) ? d : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const el = (tag, { dataset, ...props } = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    if (dataset) Object.assign(n.dataset, dataset);
    kids.flat().forEach((k) => n.append(k instanceof Node ? k : document.createTextNode(k ?? '')));
    return n;
  };

  async function sha256(file) {
    if (!window.crypto?.subtle) throw new Error('insecure_context');
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function api(path, opts) {
    let res;
    try { res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) } }); }
    catch { return { ok: false, status: 0, data: { error: 'network' } }; }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function setBusy(msg) {
    result.className = 'vresult is-busy';
    result.replaceChildren(el('div', { className: 'busy' }, el('span', { className: 'spinner' }), msg));
  }

  function showError(status, data, context, override) {
    result.className = 'vresult is-bad';
    const map = {
      404: context === 'file'
        ? ['No matching certificate', 'This file does not match any COA we have released. It may have been edited, or it was not issued by SideChain Analytics.']
        : ['Certificate not found', 'No report matches that ID and access code. Check for typos — if it still fails, this certificate was not issued by SideChain Analytics.'],
      429: ['Too many attempts', 'For security, verification is paused for your connection. Please try again in a few minutes.'],
      0: ['Connection problem', 'We could not reach the verification service. Check your connection and try again.'],
    };
    const [title, sub] = override || map[status] || ['Something went wrong', 'Please try again, or contact us if the problem persists.'];
    const box = el('div', { className: 'banner' },
      el('span', { className: 'banner__icon', ariaHidden: 'true' }),
      el('div', {}, el('h2', { className: 'banner__title' }, title), el('p', { className: 'banner__sub' }, sub)));
    result.replaceChildren(box);
    if (status === 404) {
      result.append(el('p', { className: 'small muted vresult__help' },
        'Received a certificate that fails verification? Please report it to ',
        el('a', { href: 'mailto:info@sidechainanalytics.com?subject=Possible%20forged%20COA' }, 'info@sidechainanalytics.com'), '.'));
    }
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderReport(r, code, { fileMatched = false } = {}) {
    const frag = tpl.content.cloneNode(true);
    const state = r.status === 'valid' ? 'ok' : r.status === 'superseded' ? 'warn' : 'bad';
    result.className = `vresult is-${state}`;

    const title = $('.banner__title', frag);
    const sub = $('.banner__sub', frag);
    if (r.status === 'valid') {
      title.textContent = 'Authentic certificate';
      sub.textContent = `${r.id} was issued by SideChain Analytics on ${fmtDate(r.released || r.issuedAt)}.`;
    } else if (r.status === 'superseded') {
      title.textContent = 'Superseded — use the newer report';
      sub.replaceChildren(`${r.id} was issued by us but has been replaced by `, el('b', {}, r.supersededBy || 'a newer report'), '. Ask the supplier for the current certificate.');
    } else {
      title.textContent = 'Revoked certificate';
      sub.textContent = `${r.id} was issued by us but has been withdrawn and must not be relied on.`;
    }
    if (r.statusReason) sub.append(el('span', { className: 'banner__reason' }, `Reason: ${r.statusReason}`));

    const meta = $('.rmeta', frag);
    [
      ['Report No.', r.id, true], ['Analyte', r.analyte], ['Lot / batch', r.lot], ['Submitted by', r.client],
      ['Sample', r.sampleDescription], ['Received', fmtDate(r.received)], ['Released', fmtDate(r.released)],
    ].forEach(([k, v, mono]) => {
      if (!v) return;
      meta.append(el('div', {}, el('dt', {}, k), el('dd', { className: mono ? 'mono' : '' }, v)));
    });

    const tbody = $('tbody', frag);
    if (!r.results?.length) $('.rtable-wrap', frag).remove();
    (r.results || []).forEach((row) => {
      const chip = el('span', { className: `chip ${row.outcome === 'pass' ? 'chip--ok' : row.outcome === 'fail' ? 'chip--bad' : ''}` },
        row.outcome === 'pass' ? 'Pass' : row.outcome === 'fail' ? 'Fail' : 'Report');
      tbody.append(el('tr', {},
        el('td', { dataset: { label: 'Test' } }, row.test),
        el('td', { className: 'mono', dataset: { label: 'Method' } }, row.method || '—'),
        el('td', { className: 'rtable__res', dataset: { label: 'Result' } }, row.result || '—'),
        el('td', { className: 'muted', dataset: { label: 'Spec' } }, row.spec || '—'),
        el('td', {}, chip)));
    });

    const notes = $('.rnotes', frag);
    if (r.notes) notes.textContent = r.notes; else notes.remove();

    const compare = $('.rcompare', frag);
    const dl = $('.rdownload', frag);
    if (r.pdf) {
      dl.href = `/api/coa/${encodeURIComponent(r.id)}/pdf?k=${encodeURIComponent(code)}`;
      dl.setAttribute('download', `${r.id}.pdf`);
      const out = $('.rcompare__out', compare);
      if (fileMatched) {
        showCompare(out, true);
        $('.drop', compare).remove();
        $('p', compare).remove();
      } else wireDrop($('.drop', compare), async (file) => {
        out.replaceChildren(el('div', { className: 'busy' }, el('span', { className: 'spinner' }), 'Fingerprinting…'));
        try {
          const hash = await sha256(file);
          const res = await api(`/api/coa/${encodeURIComponent(r.id)}/compare`, { method: 'POST', body: JSON.stringify({ k: code, sha256: hash }) });
          if (!res.ok) return showCompare(out, null, res.status === 429 ? 'Too many attempts — please wait a few minutes.' : 'Could not compare right now.');
          showCompare(out, res.data.match, null, file.name, hash);
        } catch (e) {
          showCompare(out, null, e.message === 'insecure_context' ? 'File checks need a secure (https) connection.' : 'Could not read that file.');
        }
      });
    } else {
      compare.remove();
      dl.remove();
    }

    $('.rreset', frag).addEventListener('click', reset);
    result.replaceChildren(frag);
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showCompare(out, match, errMsg, name, hash) {
    if (match === null) {
      out.replaceChildren(el('p', { className: 'cmp cmp--neutral' }, errMsg || 'No original PDF on file for this report.'));
      return;
    }
    const head = match ? 'File matches the original' : 'File does NOT match the original';
    const body = match
      ? 'This PDF is byte-for-byte identical to the certificate we released. Nothing has been changed.'
      : 'This PDF differs from the one we released — its contents may have been edited. Rely on the figures shown above or download the original from us.';
    const box = el('div', { className: `cmp ${match ? 'cmp--ok' : 'cmp--bad'}` },
      el('b', {}, head), el('p', {}, body));
    if (name) box.append(el('p', { className: 'mono cmp__hash' }, `${name} · sha256 ${hash.slice(0, 16)}…`));
    out.replaceChildren(box);
  }

  function wireDrop(zone, onFile) {
    const input = $('input[type=file]', zone);
    input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
    zone.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) onFile(f); });
  }

  function reset() {
    result.className = 'vresult';
    result.replaceChildren();
    history.replaceState(null, '', '/verify');
    fId.value = ''; fCode.value = '';
    selectTab(tabs[0]);
    fId.focus();
  }

  // ---- Flows ----
  async function verifyById(id, code) {
    id = id.trim().toUpperCase();
    code = normCode(code);
    if (!id || code.length !== 9) {
      (!id ? fId : fCode).focus();
      (!id ? fId : fCode).setCustomValidity('Required');
      formId.reportValidity();
      return;
    }
    history.replaceState(null, '', `/verify?id=${encodeURIComponent(id)}&k=${encodeURIComponent(code)}`);
    setBusy('Checking our records…');
    const res = await api(`/api/coa/${encodeURIComponent(id)}?k=${encodeURIComponent(code)}`);
    if (!res.ok) return showError(res.status, res.data, 'id');
    renderReport(res.data, code);
  }

  async function verifyByFile(file) {
    setBusy('Fingerprinting your file…');
    let hash;
    try { hash = await sha256(file); }
    catch (e) {
      return showError(-1, {}, 'file', ['Could not check this file',
        e.message === 'insecure_context' ? 'File verification requires a secure (https) connection.' : 'That file could not be read.']);
    }
    const res = await api('/api/verify-file', { method: 'POST', body: JSON.stringify({ sha256: hash }) });
    if (!res.ok) return showError(res.status, res.data, 'file');
    fId.value = res.data.id; fCode.value = res.data.code;
    renderReport(res.data, res.data.code, { fileMatched: true });
  }

  [fId, fCode].forEach((i) => i.addEventListener('input', () => i.setCustomValidity('')));
  fCode.addEventListener('blur', () => { fCode.value = normCode(fCode.value); });
  formId.addEventListener('submit', (e) => { e.preventDefault(); verifyById(fId.value, fCode.value); });
  wireDrop($('#dropMain'), verifyByFile);

  $('#demoFill').addEventListener('click', () => {
    selectTab(tabs[0]);
    fId.value = 'COA-2026-SC-00417'; fCode.value = 'DEMO-2026';
    verifyById(fId.value, fCode.value);
  });

  // Arriving from a QR code or the homepage form: /verify?id=…&k=…
  const params = new URLSearchParams(location.search);
  if (params.get('id')) {
    fId.value = params.get('id');
    fCode.value = normCode(params.get('k') || '');
    if (params.get('k')) verifyById(fId.value, fCode.value); else fCode.focus();
  } else if (params.get('mode') === 'file') {
    selectTab(tabs[1]);
  }
})();
