(() => {
  // ---- Nav: scroll state + mobile menu ----
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    links.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // ---- Reveal on scroll ----
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = `${i * 70}ms`;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  // ---- COA verification (demo) ----
  // Replace with a real lookup, e.g. fetch(`/api/coa/${id}`).
  const DEMO_RECORDS = {
    'SCA-2026-0417': {
      analyte: 'BPC-157',
      client: 'Example Research Supply',
      received: '2026-09-14',
      released: '2026-09-19',
      tests: 'Identity, purity, net content, ICP-MS, LAL',
    },
  };

  async function verifyCOA(id) {
    await new Promise((r) => setTimeout(r, 450));
    return DEMO_RECORDS[id] || null;
  }

  const form = document.getElementById('verifyForm');
  const input = document.getElementById('coaId');
  const out = document.getElementById('verifyResult');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = input.value.trim().toUpperCase();
    if (!id) { input.focus(); return; }
    out.className = 'verify__result';
    out.innerHTML = '<p>Checking records…</p>';
    const rec = await verifyCOA(id);
    if (rec) {
      out.className = 'verify__result ok';
      out.innerHTML = `
        <h4><span class="chip chip--ok">Verified</span> ${esc(id)} was issued by SideChain Analytics</h4>
        <dl>
          <dt>Analyte</dt><dd>${esc(rec.analyte)}</dd>
          <dt>Submitted by</dt><dd>${esc(rec.client)}</dd>
          <dt>Received</dt><dd>${esc(rec.received)}</dd>
          <dt>Released</dt><dd>${esc(rec.released)}</dd>
          <dt>Tests</dt><dd>${esc(rec.tests)}</dd>
        </dl>`;
    } else {
      out.className = 'verify__result bad';
      out.innerHTML = `
        <h4><span class="chip chip--bad">Not found</span> No record for ${esc(id)}</h4>
        <p>Check the ID for typos. If it still doesn't match, the report was not issued by us — please let us know at info@sidechainanalytics.com.</p>`;
    }
  });

  document.querySelectorAll('[data-fill]').forEach((btn) =>
    btn.addEventListener('click', () => { input.value = btn.dataset.fill; form.requestSubmit(); })
  );

  // ---- Quote builder → mailto ----
  const quote = document.getElementById('quoteForm');
  quote.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!quote.reportValidity()) return;
    const d = new FormData(quote);
    const tests = d.getAll('tests');
    if (!tests.length) { alert('Please select at least one test.'); return; }
    const lines = [
      `Tests requested:`,
      ...tests.map((t) => `  - ${t}`),
      ``,
      `Peptide / analyte: ${d.get('peptide')}`,
      `Number of samples: ${d.get('count')}`,
      d.get('amount') ? `Claimed amount per vial: ${d.get('amount')}` : null,
      ``,
      `Name: ${d.get('name')}`,
      `Email: ${d.get('email')}`,
      d.get('org') ? `Organisation: ${d.get('org')}` : null,
      d.get('notes') ? `\nNotes:\n${d.get('notes')}` : null,
    ].filter((l) => l !== null);
    const subject = `Quote request — ${d.get('peptide')} (${d.get('count')} sample${d.get('count') > 1 ? 's' : ''})`;
    window.location.href = `mailto:info@sidechainanalytics.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
