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

  // The haze under the word is pure CSS (.mark__haze): soft ellipses on
  // transform animations. It replaced a canvas noise field whose puffs read
  // as "dust or smoke" with a hard gap between them and the letters.

  // Highlight: sweeps across the word on its own (CSS); on desktop it
  // follows the pointer while the pointer is over the hero.
  const word = $('.mark__word');
  if (finePointer && !reduced()) {
    hero.addEventListener('pointermove', (e) => {
      const r = word.getBoundingClientRect();
      const fx = Math.min(1.15, Math.max(-0.15, (e.clientX - r.left) / r.width));
      mark.classList.add('is-tracking');
      word.style.setProperty('--sheen', `${(fx * 100).toFixed(1)}%`);
    });
    hero.addEventListener('pointerleave', () => {
      mark.classList.remove('is-tracking');
      word.style.removeProperty('--sheen');
    });
  }

  let heroInView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { heroInView = entries[entries.length - 1].isIntersecting; }).observe(hero);
  }

  // Scrolling away sinks the wordmark back into the shadow. Driven by
  // scroll events, at most once a frame, so nothing runs while idle.
  if (!reduced()) {
    let queued = false, lastSink = '';
    const sinkNow = () => {
      queued = false;
      const sink = Math.min(1, Math.max(0, scrollY / hero.offsetHeight)).toFixed(3);
      if (sink !== lastSink) { hero.style.setProperty('--sink', sink); lastSink = sink; }
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(sinkNow); } }, { passive: true });
    sinkNow();
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

  // ---------- feature cards: a soft light follows the pointer ----------
  if (finePointer) {
    $$('[data-spot]').forEach((card) => card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));
  }

  // ---------- how it works ----------
  // Three sides (business / customer / team), each told in three steps.
  // Whichever side is open drives the same QR card: scan, review, live.
  const stage = $('[data-stage]');
  const statusText = $('[data-status]');
  const headText = $('[data-head]');
  const tablist = $('[data-tabs]');
  const tabs = $$('[data-tab]');
  const flows = $$('[data-flow]');
  const glide = $('.audience__glide');
  const STATUS = { 1: 'Scanning QR code', 2: 'Leaving a review', 3: 'Live on Google' };
  const HEAD = { business: 'Enjoyed your visit?', customer: 'Scan to leave a review', team: 'Show this to your customer' };
  const CYCLE = 3200;
  let side = 'business';
  let current = 1;
  let cycleTimer = null;
  let started = false;

  const openSteps = () => $(`[data-flow="${side}"] [data-steps]`);
  const show = (n) => {
    current = n;
    stage.dataset.state = String(n);
    statusText.textContent = STATUS[n];
    $$('.step', openSteps()).forEach((b) => {
      const on = b.dataset.step === String(n);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  const stopCycle = () => {
    clearInterval(cycleTimer);
    cycleTimer = null;
    $$('[data-steps]').forEach((s) => s.classList.remove('is-cycling'));
  };
  const startCycle = () => {
    stopCycle();
    if (reduced()) return;
    openSteps().classList.add('is-cycling');
    cycleTimer = setInterval(() => { if (!document.hidden) show((current % 3) + 1); }, CYCLE);
  };

  const placeGlide = () => {
    const tab = tabs.find((t) => t.dataset.tab === side);
    if (!glide || !tab || !tab.offsetWidth) return;
    glide.style.width = `${tab.offsetWidth}px`;
    glide.style.transform = `translateX(${tab.offsetLeft}px)`;
    // Slide only after the first placement, so it never grows in from zero.
    requestAnimationFrame(() => tablist.classList.add('is-ready'));
  };
  const openSide = (name, focus) => {
    side = name;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    flows.forEach((f) => { f.hidden = f.dataset.flow !== name; });
    headText.textContent = HEAD[name];
    placeGlide();
    show(1);
    if (started) startCycle();
  };

  flows.forEach((f) => { f.setAttribute('role', 'tabpanel'); f.setAttribute('aria-labelledby', `tab-${f.dataset.flow}`); });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => openSide(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      openSide(tabs[(to + tabs.length) % tabs.length].dataset.tab, true);
    });
  });
  $$('.step').forEach((b) => b.addEventListener('click', () => {
    stopCycle();
    show(parseInt(b.dataset.step, 10));
  }));
  openSide('business');
  addEventListener('resize', placeGlide, { passive: true });
  if (document.fonts) document.fonts.ready.then(placeGlide);
  onceInView(stage, () => { started = true; show(1); startCycle(); }, '0px 0px -25% 0px');

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
