// Fivefold — progressive enhancement. The page reads completely without JS.
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

  // ---- nav: condense on scroll, mobile menu, active section ----
  const nav = $('[data-nav]');
  const toggle = $('[data-nav-toggle]');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });

  if ('IntersectionObserver' in window) {
    const links = new Map($$('.nav__links a').map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      // Last record wins: one callback can carry several for the same target.
      entries.forEach((entry) => {
        const link = links.get(entry.target.id);
        if (link && entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  // ---- hero intro: the page's one orchestrated moment ----
  const hero = $('.hero');
  $$('[data-intro]').forEach((el) => el.style.setProperty('--i', el.dataset.intro));
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-loaded')));

  const countUp = (el, delay) => {
    const to = parseFloat(el.dataset.countTo);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    if (reduced()) { el.textContent = to.toFixed(dec); return; }
    const from = dec ? 3.6 : Math.round(to * 0.55);
    const dur = 1500;
    el.textContent = from.toFixed(dec);
    setTimeout(() => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 4);
        el.textContent = (from + (to - from) * e).toFixed(dec);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  };
  $$('[data-count-to]').forEach((el) => countUp(el, 700));

  // Incoming review toast. Illustrative copy, cycling under the profile card.
  const toast = $('[data-toast]');
  const reviews = [
    ['M', '“Booked same day. Friendly, fast, fair price.”'],
    ['J', '“Best haircut I’ve had in years. Already rebooked.”'],
    ['A', '“They explained everything before starting. Honest work.”'],
    ['S', '“Lovely staff and the coffee is genuinely great.”'],
  ];
  let tIdx = 0;
  let toastTimer = null;
  const nextToast = () => {
    if (document.hidden || reduced()) return;
    toast.classList.add('is-out');
    setTimeout(() => {
      tIdx = (tIdx + 1) % reviews.length;
      $('[data-toast-initial]', toast).textContent = reviews[tIdx][0];
      $('[data-toast-text]', toast).textContent = reviews[tIdx][1];
      toast.classList.remove('is-out');
    }, 450);
  };
  if (toast) toastTimer = setInterval(nextToast, 4200);

  // Gentle pointer tilt on the profile card (desktop pointers only).
  const tilt = $('[data-tilt]');
  if (tilt && finePointer) {
    const area = $('.hero__visual');
    area.addEventListener('pointermove', (e) => {
      if (reduced()) return;
      const r = area.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
    });
    area.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
  }

  // ---- spotlight that follows the pointer on service tiles ----
  if (finePointer) {
    $$('[data-spot]').forEach((tile) => {
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
        tile.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  // ---- reveals, review flow, chat ----
  const chat = $('[data-chat]');
  const playChat = () => {
    const [ask, link, typing, reply] = $$('.sms', chat);
    const show = (el, ms) => setTimeout(() => el.classList.add('is-shown'), ms);
    show(ask, 200);
    show(link, 900);
    show(typing, 1700);
    setTimeout(() => { typing.classList.add('is-gone'); reply.classList.add('is-shown'); }, 3300);
  };

  const once = (el, fn, opts) => {
    const io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry.isIntersecting) return;
      io.disconnect();
      fn(el);
    }, opts);
    io.observe(el);
  };

  if ('IntersectionObserver' in window && !reduced()) {
    $$('.reveal').forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 80}ms`;
      once(el, () => el.classList.add('is-in'), { rootMargin: '0px 0px -10% 0px' });
    });
    const flow = $('[data-flow]');
    if (flow) once(flow, () => flow.classList.add('is-in'), { rootMargin: '0px 0px -20% 0px' });
    if (chat) once(chat, playChat, { rootMargin: '0px 0px -20% 0px' });
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
    const flow = $('[data-flow]');
    if (flow) flow.classList.add('is-in');
    if (chat) {
      $$('.sms', chat).forEach((el) => el.classList.add('is-shown'));
      $('.sms--typing', chat).classList.add('is-gone');
    }
  }

  // ---- review calculator ----
  const RESPONSE_RATE = 0.15; // share of invited customers who leave a review
  const NEW_AVG = 4.8;        // average star rating of the new reviews
  const MONTHS = 3;

  const inputs = {};
  $$('[data-in]').forEach((el) => { inputs[el.dataset.in] = el; });
  const out = (k) => $(`[data-out="${k}"]`);
  const res = (k) => $(`[data-res="${k}"]`);
  const setText = (el, text) => {
    if (el.textContent === text) return;
    el.textContent = text;
    if (reduced()) return;
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  };
  const fill = (el) => el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);

  const calc = () => {
    const rating = parseFloat(inputs.rating.value);
    const count = parseInt(inputs.count.value, 10);
    const customers = parseInt(inputs.customers.value, 10);
    out('rating').textContent = rating.toFixed(1);
    out('count').textContent = count.toLocaleString();
    out('customers').textContent = customers.toLocaleString();

    const added = Math.round(customers * MONTHS * RESPONSE_RATE);
    const total = count + added;
    const projected = total ? (rating * count + NEW_AVG * added) / total : NEW_AVG;

    setText(res('newcount'), `+${added.toLocaleString()}`);
    setText(res('total'), total.toLocaleString());
    // Never round a rating up past what the maths supports.
    setText(res('newrating'), (Math.floor(projected * 10) / 10).toFixed(1));
    Object.values(inputs).forEach(fill);
  };
  if (inputs.rating) {
    Object.values(inputs).forEach((el) => el.addEventListener('input', calc));
    calc();
  }

  // ---- plan buttons pre-fill the form ----
  const planField = $('[data-plan-field]');
  $$('[data-plan]').forEach((btn) => btn.addEventListener('click', () => { if (planField) planField.value = btn.dataset.plan; }));

  // ---- contact form ----
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
          const body = [
            `Name: ${data.get('name')}`, `Business: ${data.get('business')}`, `Email: ${data.get('email')}`,
            `Phone: ${data.get('phone') || '-'}`, `Website: ${data.get('website') || '-'}`,
            `Plan: ${data.get('plan') || '-'}`, `Needs: ${data.getAll('needs').join(', ') || '-'}`,
            '', data.get('message') || '',
          ].join('\n');
          location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Free audit: ${data.get('business')}`)}&body=${encodeURIComponent(body)}`;
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
        say('Got it. We’ll be in touch within one business day.', 'ok');
      } catch {
        say('That didn’t send. Check your connection and try again.', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  // Stop the toast cycling while the tab is hidden; resume after.
  document.addEventListener('visibilitychange', () => {
    if (!toast) return;
    clearInterval(toastTimer);
    if (!document.hidden) toastTimer = setInterval(nextToast, 4200);
  });
})();
