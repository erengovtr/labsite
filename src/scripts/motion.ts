// Bioscience hareket katmanı: açılış (TV efekti), kaydırma animasyonları, parallax, eğilme efekti.
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function initReveal() {
  document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((g) => {
    [...g.children].forEach((c, i) => {
      const el = c as HTMLElement;
      if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', g.dataset.stagger || 'up');
      el.style.setProperty('--d', Math.min(i * 0.08, 0.5) + 's');
    });
  });
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); countUp(document.body, true); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target as HTMLElement;
      el.classList.add('in'); io.unobserve(el); countUp(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  els.forEach((e) => io.observe(e));
}

function initCounters() {
  const els = document.querySelectorAll<HTMLElement>('[data-count]');
  if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => countUp(e.parentElement as HTMLElement, true)); return; }
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) { countUp(en.target.parentElement as HTMLElement); io.unobserve(en.target); }
  }), { threshold: 0.6 });
  els.forEach((e) => io.observe(e));
}

function countUp(scope: HTMLElement, instant = false) {
  scope.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count); if (!isFinite(to) || el.dataset.done) return; el.dataset.done = '1';
    if (instant || to === 0) { el.textContent = String(to); return; }
    const t0 = performance.now(), dur = 1100;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

function initParallax() {
  const items = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
  if (reduce || !items.length) return;
  let ticking = false;
  const update = () => {
    const vh = innerHeight;
    items.forEach((el) => {
      const r = el.getBoundingClientRect(); if (r.bottom < -100 || r.top > vh + 100) return;
      const speed = Number(el.dataset.parallax) || 0.1;
      el.style.setProperty('--py', ((r.top + r.height / 2 - vh / 2) * -speed).toFixed(1) + 'px');
    });
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function initTilt() {
  if (reduce || matchMedia('(hover: none)').matches) return;
  document.querySelectorAll<HTMLElement>('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x + 0.5) * 100 + '%'); el.style.setProperty('--my', (y + 0.5) * 100 + '%');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

function initHeader() {
  const h = document.querySelector('.site-header'); if (!h) return;
  const on = () => h.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', on, { passive: true }); on();
}

function initImageFallback() {
  document.querySelectorAll<HTMLImageElement>('img[data-fallback]').forEach((img) => {
    img.addEventListener('error', () => {
      const d = document.createElement('div'); d.className = 'img-missing'; d.textContent = img.dataset.fallback || ''; img.replaceWith(d);
    }, { once: true });
  });
}

function start() {
  root.classList.add('ready');
  initReveal(); initCounters(); initParallax(); initTilt(); initHeader(); initImageFallback();
}

function runSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return start();
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    root.classList.remove('splash-on'); splash.remove(); start();
  };
  const out = () => { splash.classList.add('out'); setTimeout(finish, 900); };
  const t = setTimeout(out, 3200);
  const skip = () => { clearTimeout(t); if (!splash.classList.contains('out')) out(); };
  splash.addEventListener('click', skip);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip(); }, { once: true });
}

if (root.classList.contains('splash-on')) runSplash(); else start();
