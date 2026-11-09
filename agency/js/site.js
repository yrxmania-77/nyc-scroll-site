// ReviewLab — progressive enhancement. The page reads completely without JS.
(() => {
  'use strict';

  // Where form submissions fall back to while no Formspree id is set.
  // Leave empty to show an on-page notice instead of opening email.
  const CONTACT_EMAIL = '';

  const root = document.documentElement;
  root.classList.add('js');
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMq.matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Run fn once when el scrolls into view. Reads the LAST record: one
  // callback can carry several for the same target, oldest first.
  const onceInView = (el, fn, margin = '0px 0px -12% 0px') => {
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries[entries.length - 1].isIntersecting) return;
      io.disconnect();
      fn(el);
    }, { rootMargin: margin });
    io.observe(el);
  };

  // ---------- nav ----------
  const nav = $('[data-nav]');
  const toggle = $('[data-nav-toggle]');
  const onScrollNav = () => nav.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();
  const setOpen = (open) => { nav.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });

  if ('IntersectionObserver' in window) {
    const links = new Map($$('.nav__links a').map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.classList.remove('is-active'));
        const link = links.get(entry.target.id);
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['top', ...links.keys()].forEach((id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  // ---------- hero ----------
  const hero = $('.hero');
  const mark = $('[data-mark]');
  $$('.mark__word').forEach((word) => [...word.children].forEach((ch, i) => ch.style.setProperty('--i', i)));
  $$('[data-intro]').forEach((el) => el.style.setProperty('--d', el.dataset.intro));
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-loaded')));

  // Count-up on the business figure
  $$('[data-count-to]').forEach((el) => {
    const to = parseInt(el.dataset.countTo, 10);
    if (reduced()) return;
    el.textContent = '0';
    setTimeout(() => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / 1600);
        el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 4))));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, 1100);
  });

  // Fog: smooth value noise rendered at low resolution, upscaled and blurred
  // by CSS. Cheap enough to redraw ~30 times a second.
  const canvas = $('[data-fog]');
  const ctx = canvas.getContext('2d');
  const perm = new Uint8Array(512);
  const val = new Float32Array(256);
  {
    const p = Array.from({ length: 256 }, (_, i) => i);
    let s = 1337;
    for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) val[i] = perm[i] / 255;
  }
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
    const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => 0.5 * noise(x, y) + 0.3 * noise(x * 2.03, y * 2.03) + 0.2 * noise(x * 4.1, y * 4.1);

  // The noise is written into a small offscreen buffer, then drawn onto the
  // visible canvas through a blur, which is cheap at this size.
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d');
  let FW = 160, FH = 90, img = null;
  const sizeFog = () => {
    const r = hero.getBoundingClientRect();
    FW = 160;
    FH = Math.max(60, Math.min(240, Math.round(FW * r.height / Math.max(1, r.width))));
    canvas.width = buf.width = FW;
    canvas.height = buf.height = FH;
    img = bctx.createImageData(FW, FH);
  };
  // Fog lies densest across the lower half of the wordmark, thins out above
  // it, and eases off again behind the copy so the text stays readable.
  let bandTop = 0.3, bandMid = 0.55;
  const measureBand = () => {
    const h = hero.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    // Stacked on phones: keep "Review" clear and let "Lab" rise out of it
    const stacked = innerWidth < 600;
    bandTop = (m.top - h.top + m.height * (stacked ? 0.42 : 0.2)) / h.height;
    bandMid = (m.top - h.top + m.height * (stacked ? 0.98 : 0.72)) / h.height;
  };
  const drawFog = (now) => {
    const t = now * 0.00004;
    const data = img.data;
    let k = 0;
    for (let y = 0; y < FH; y++) {
      const fy = y / FH;
      const band = smooth(bandTop, bandMid, fy) * (1 - 0.6 * smooth(bandMid + 0.12, 1, fy));
      for (let x = 0; x < FW; x++) {
        if (band <= 0.001) { data[k + 3] = 0; k += 4; continue; }
        const fx = x / FW;
        const wx = fx * 3.4 + t * 1.5, wy = fy * 2.4 - t * 0.5;
        const warp = noise(wx * 0.6 + 7.3, wy * 0.6 - t * 0.8);
        const n = fbm(wx + warp * 1.6, wy + warp * 0.7);
        const a = smooth(0.3, 0.86, n) * band;
        data[k] = 142; data[k + 1] = 158; data[k + 2] = 190; data[k + 3] = a * 185;
        k += 4;
      }
    }
    bctx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, FW, FH);
    ctx.filter = 'blur(1.4px)';
    ctx.drawImage(buf, 0, 0);
  };

  // Light: a round window that moves over the word (pure transforms). It
  // follows the pointer on desktop and drifts on its own otherwise.
  const light = $('.mark__light');
  const lit = $('.mark__word--lit');
  const base = $('.mark__word:not(.mark__word--lit)');
  let R = 300, ox = 0, oy = 0, mw = 1, mh = 1;
  const layoutLight = () => {
    R = Math.round(innerWidth < 600 ? innerWidth * 0.5 : Math.min(innerWidth * 0.34, 440));
    light.style.width = light.style.height = `${R * 2}px`;
    ox = base.offsetLeft; oy = base.offsetTop; mw = base.offsetWidth; mh = base.offsetHeight;
    lit.style.width = `${mw}px`;
    lit.style.height = `${mh}px`;
  };
  // fx, fy: where the light's centre sits, as fractions of the word's box
  const placeLight = (fx, fy) => {
    const x = ox + fx * mw - R, y = oy + fy * mh - R;
    light.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    lit.style.transform = `translate3d(${(ox - x).toFixed(1)}px, ${(oy - y).toFixed(1)}px, 0)`;
  };
  let lx = 0.3, ly = 0.15, tx = 0.3, ty = 0.15, lastPointer = -1e9;
  if (finePointer) {
    hero.addEventListener('pointermove', (e) => {
      const r = base.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
      lastPointer = performance.now();
    });
  }

  let heroInView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { heroInView = entries[entries.length - 1].isIntersecting; }).observe(hero);
  }

  const relayout = () => {
    sizeFog();
    measureBand();
    layoutLight();
    placeLight(lx, ly);
    if (reduced()) drawFog(0);
  };
  relayout();
  addEventListener('resize', relayout);
  if (document.fonts) document.fonts.ready.then(relayout);

  if (reduced()) {
    lx = 0.5; ly = 0.18;
    relayout();
  } else {
    const FOG_MS = 42; // ~24 redraws a second: the fog moves slowly
    let lastFog = 0, lastSink = '';
    const frame = (now) => {
      if (heroInView && !document.hidden) {
        if (now - lastPointer > 2500) {
          tx = 0.5 + 0.42 * Math.sin(now / 5200);
          ty = 0.2 + 0.22 * Math.sin(now / 3700);
        }
        lx += (tx - lx) * 0.05;
        ly += (ty - ly) * 0.05;
        placeLight(lx, ly);
        // Scrolling away sinks the wordmark back into the fog
        const sink = Math.min(1, Math.max(0, scrollY / hero.offsetHeight)).toFixed(3);
        if (sink !== lastSink) { hero.style.setProperty('--sink', sink); lastSink = sink; }
        if (now - lastFog > FOG_MS) { drawFog(now); lastFog = now; }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // Event toast in the hero corner (illustrative)
  const toast = $('[data-toast]');
  const events = ['New review is live on Google', 'QR code scanned', 'Added to Sunday report'];
  let ev = 0;
  if (toast && !reduced()) {
    setInterval(() => {
      if (document.hidden || !heroInView) return;
      toast.classList.add('is-out');
      setTimeout(() => {
        ev = (ev + 1) % events.length;
        $('[data-toast-text]', toast).textContent = events[ev];
        toast.classList.remove('is-out');
      }, 450);
    }, 3600);
  }

  // ---------- how it works: steps drive the customer view ----------
  const steps = $('[data-steps]');
  const stage = $('[data-stage]');
  const statusText = $('[data-status]');
  const STATUS = { 1: 'Scanning QR code', 2: 'Leaving a review', 3: 'Live on Google' };
  const CYCLE = 3200;
  let current = 1;
  let cycleTimer = null;
  const show = (n) => {
    current = n;
    stage.dataset.state = String(n);
    statusText.textContent = STATUS[n];
    $$('.step', steps).forEach((b) => {
      const on = b.dataset.step === String(n);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  const stopCycle = () => { clearInterval(cycleTimer); cycleTimer = null; steps.classList.remove('is-cycling'); };
  const startCycle = () => {
    if (reduced()) return;
    stopCycle();
    steps.classList.add('is-cycling');
    cycleTimer = setInterval(() => { if (!document.hidden) show((current % 3) + 1); }, CYCLE);
  };
  $$('.step', steps).forEach((b) => b.addEventListener('click', () => {
    stopCycle();
    show(parseInt(b.dataset.step, 10));
  }));
  onceInView(stage, () => { show(1); startCycle(); }, '0px 0px -25% 0px');

  // Decorative QR pattern (not a scannable code)
  const qr = $('[data-qr]');
  if (qr) {
    const N = 25;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1.6"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.1" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".7"/>`;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    let cells = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inFinder(x, y) && rand() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1" rx=".25"/>`;
    }
    qr.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${N} ${N}" fill="#0d0f12" aria-hidden="true">${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}${cells}</svg>`);
  }

  // ---------- pricing estimator: $10 per confirmed live review ----------
  const RATE = 10;
  const weekly = $('[data-in="weekly"]');
  const weeklyOut = $('[data-out="weekly"]');
  const weekCost = $('[data-res="weekcost"]');
  const bump = (el) => { if (reduced()) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const estimate = () => {
    const n = parseInt(weekly.value, 10);
    weeklyOut.textContent = String(n);
    const text = '$' + (n * RATE).toLocaleString();
    if (weekCost.textContent !== text) { weekCost.textContent = text; bump(weekCost); }
    weekly.style.setProperty('--fill', `${((n - weekly.min) / (weekly.max - weekly.min)) * 100}%`);
  };
  if (weekly) { weekly.addEventListener('input', estimate); estimate(); }

  // ---------- reveals ----------
  if (!reduced()) {
    $$('.reveal').forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      el.style.transitionDelay = `${Math.min(sibs.indexOf(el), 5) * 80}ms`;
      onceInView(el, () => el.classList.add('is-in'));
    });
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  // ---------- contact form ----------
  const form = $('[data-form]');
  const status = $('[data-form-status]');
  const say = (msg, kind) => { status.textContent = msg; status.className = `form__status${kind ? ` is-${kind}` : ''}`; };
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      // No real endpoint yet: never POST into a 404 that looks like success.
      if (form.hasAttribute('data-preview') || form.action.includes('YOUR_FORM_ID')) {
        if (CONTACT_EMAIL) {
          const body = [`Name: ${data.get('name')}`, `Business: ${data.get('business')}`, `Email: ${data.get('email')}`, `Phone: ${data.get('phone') || '-'}`].join('\n');
          location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`ReviewLab: ${data.get('business')}`)}&body=${encodeURIComponent(body)}`;
          say('Opening your email app…', 'ok');
        } else {
          say('This form isn’t connected yet. It’s a preview of the site.', 'err');
        }
        return;
      }
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      say('Sending…');
      try {
        const r = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(String(r.status));
        form.reset();
        say('Got it. We’ll be in touch soon.', 'ok');
      } catch {
        say('That didn’t send. Check your connection and try again.', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
