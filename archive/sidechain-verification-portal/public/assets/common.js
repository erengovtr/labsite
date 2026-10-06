// Shared helpers for the verification portal (home + report pages).
window.SCA = (() => {
  const $ = (s, el = document) => el.querySelector(s);

  /** Tiny DOM builder. Children are appended as text unless they are Nodes — never parsed as HTML. */
  const el = (tag, { dataset, ...props } = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    if (dataset) Object.assign(n.dataset, dataset);
    kids.flat().forEach((k) => { if (k !== null && k !== undefined && k !== false) n.append(k instanceof Node ? k : String(k)); });
    return n;
  };

  const normCode = (v) => {
    const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
  };

  const fmtDate = (d, withTime = false) => {
    if (!d) return '—';
    const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d);
    if (Number.isNaN(+dt)) return d;
    return dt.toLocaleString(undefined, withTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'long', day: 'numeric' });
  };

  async function sha256(file) {
    if (!window.crypto?.subtle) throw new Error('insecure_context');
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    } catch {
      return { ok: false, status: 0, data: { error: 'network' } };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function wireDrop(zone, onFile) {
    const input = $('input[type=file]', zone);
    input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
    zone.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) onFile(f); });
  }

  function wireTabs(root = document) {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const select = (tab) => tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        select(next); next.focus();
      });
    });
    return { tabs, select };
  }

  const reportUrl = (id, code) => `/verify?id=${encodeURIComponent(id)}&k=${encodeURIComponent(code)}`;

  // A file verified on the home page is handed to the report page, which re-confirms it
  // with the server before showing the "unaltered" result.
  const FILE_KEY = 'sca-verified-file';
  const rememberFile = (v) => { try { sessionStorage.setItem(FILE_KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };
  const takeFile = (id) => {
    try {
      const v = JSON.parse(sessionStorage.getItem(FILE_KEY) || 'null');
      sessionStorage.removeItem(FILE_KEY);
      return v && v.id === id ? v : null;
    } catch { return null; }
  };

  return { $, el, normCode, fmtDate, sha256, api, wireDrop, wireTabs, reportUrl, rememberFile, takeFile };
})();
