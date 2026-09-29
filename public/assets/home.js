(() => {
  const { $, el, normCode, sha256, api, wireDrop, wireTabs, reportUrl, rememberFile } = window.SCA;
  const result = $('#result');
  const form = $('#pane-id');
  const fId = $('#fId');
  const fCode = $('#fCode');

  const { tabs, select } = wireTabs($('#vpanel'));
  if (new URLSearchParams(location.search).get('mode') === 'file') select(tabs[1]);

  function show(state, title, sub) {
    result.className = `vresult is-${state}`;
    const kids = state === 'busy'
      ? [el('div', { className: 'busy' }, el('span', { className: 'spinner' }), title)]
      : [el('div', { className: 'banner' },
          el('span', { className: 'banner__icon', ariaHidden: 'true' }),
          el('div', {}, el('h2', { className: 'banner__title' }, title), el('p', { className: 'banner__sub' }, sub)))];
    result.replaceChildren(...kids);
  }

  // Report number + code → the full report page.
  [fId, fCode].forEach((i) => i.addEventListener('input', () => i.setCustomValidity('')));
  fCode.addEventListener('blur', () => { fCode.value = normCode(fCode.value); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = fId.value.trim().toUpperCase();
    const code = normCode(fCode.value);
    if (!id) { fId.setCustomValidity('Enter the report number'); form.reportValidity(); return; }
    if (code.length !== 9) { fCode.setCustomValidity('The verify code has 8 characters, e.g. ABCD-2345'); form.reportValidity(); return; }
    location.href = reportUrl(id, code);
  });

  // PDF → fingerprint → matching report.
  wireDrop($('#dropMain'), async (file) => {
    show('busy', 'Fingerprinting your file…');
    let hash;
    try { hash = await sha256(file); } catch (e) {
      return show('bad', 'Could not check this file', e.message === 'insecure_context'
        ? 'File checks need a secure (https) connection.' : 'That file could not be read.');
    }
    show('busy', 'Comparing with laboratory records…');
    const res = await api('/api/verify-file', { method: 'POST', body: JSON.stringify({ sha256: hash }) });
    if (res.ok) {
      rememberFile({ id: res.data.id, sha256: hash, name: file.name });
      location.href = reportUrl(res.data.id, res.data.code);
      return;
    }
    if (res.status === 404) {
      show('bad', 'No matching certificate', 'This file does not match any certificate we have released. It may have been edited, or it was not issued by SideChain Analytics. If you have the report number and verify code, check them on the other tab to see the results we recorded.');
    } else if (res.status === 429) {
      show('bad', 'Too many attempts', 'For security, verification is paused for your connection. Please try again in a few minutes.');
    } else {
      show('bad', 'Something went wrong', 'We could not reach the verification service. Please try again.');
    }
  });

  // Certificate header illustration: a real QR to the sample report.
  const qrBox = $('#docQr');
  if (qrBox && window.qrcode) {
    const qr = window.qrcode(0, 'M');
    qr.addData(`${location.origin}${reportUrl('COA-2026-SC-00417', 'DEMO-2026')}`);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
  }
})();
