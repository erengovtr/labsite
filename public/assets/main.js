(() => {
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

})();
