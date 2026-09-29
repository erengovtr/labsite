(() => {
  // ---- Sample report QR: a real, scannable link to the demo verification ----
  const qrBox = document.getElementById('docQr');
  if (qrBox && window.qrcode) {
    const qr = window.qrcode(0, 'M');
    qr.addData(`${location.origin}/verify?id=COA-2026-SC-00417&k=DEMO-2026`);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
  }

  // ---- Contact form → pre-filled email ----
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = new FormData(form);
      const body = [
        `Name: ${d.get('name')}`,
        `Email: ${d.get('email')}`,
        d.get('org') ? `Organization: ${d.get('org')}` : null,
        `Inquiry type: ${d.get('type')}`,
        '',
        d.get('message'),
      ].filter((l) => l !== null).join('\n');
      const subject = `${d.get('type')} — ${d.get('name')}`;
      window.location.href = `mailto:info@sidechainanalytics.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }
})();
