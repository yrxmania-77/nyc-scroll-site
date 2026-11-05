// Fivefold — small progressive enhancements. The page is complete without JS.
(() => {
  'use strict';

  // Where form submissions fall back to when no Formspree id is set.
  // Leave empty to show an on-page notice instead of opening email.
  const CONTACT_EMAIL = '';

  document.documentElement.classList.add('js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- nav: background on scroll, mobile toggle ----
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.querySelectorAll('.nav__links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  // ---- reveal on scroll ----
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // Stagger siblings that enter together.
        const idx = [...el.parentElement.children].filter((c) => c.classList.contains('reveal')).indexOf(el);
        el.style.transitionDelay = `${Math.min(idx, 6) * 70}ms`;
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // ---- hero count-up ----
  if (!reduced) {
    document.querySelectorAll('[data-count-to]').forEach((el) => {
      const to = parseFloat(el.dataset.countTo);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const from = dec ? 3.8 : Math.round(to * 0.6);
      const start = performance.now();
      const dur = 1600;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        el.textContent = (from + (to - from) * e).toFixed(dec);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ---- review calculator ----
  const RESPONSE_RATE = 0.15;   // share of invited customers who leave a review
  const NEW_AVG = 4.8;          // average star rating of the new reviews
  const MONTHS = 3;

  const inputs = {};
  document.querySelectorAll('[data-in]').forEach((el) => { inputs[el.dataset.in] = el; });
  const out = (k) => document.querySelector(`[data-out="${k}"]`);
  const res = (k) => document.querySelector(`[data-res="${k}"]`);

  const fill = (el) => {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--fill', `${pct}%`);
  };

  const calc = () => {
    const rating = parseFloat(inputs.rating.value);
    const count = parseInt(inputs.count.value, 10);
    const customers = parseInt(inputs.customers.value, 10);

    out('rating').textContent = rating.toFixed(1);
    out('count').textContent = count.toLocaleString();
    out('customers').textContent = customers.toLocaleString();

    const added = Math.round(customers * MONTHS * RESPONSE_RATE);
    const total = count + added;
    const newRating = total ? (rating * count + NEW_AVG * added) / total : NEW_AVG;

    res('newcount').textContent = `+${added.toLocaleString()}`;
    res('total').textContent = total.toLocaleString();
    // Ratings never round up past what the math supports.
    res('newrating').textContent = (Math.floor(newRating * 10) / 10).toFixed(1);

    Object.values(inputs).forEach(fill);
  };
  if (inputs.rating) {
    Object.values(inputs).forEach((el) => el.addEventListener('input', calc));
    calc();
  }

  // ---- plan buttons pre-fill the form ----
  const planField = document.querySelector('[data-plan-field]');
  document.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', () => { if (planField) planField.value = btn.dataset.plan; });
  });

  // ---- contact form ----
  const form = document.querySelector('[data-form]');
  const status = document.querySelector('[data-form-status]');
  const say = (msg, kind) => {
    status.textContent = msg;
    status.className = `form__status ${kind ? `is-${kind}` : ''}`;
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const needs = data.getAll('needs').join(', ');

      // No real endpoint yet: never POST into a 404 that looks like success.
      if (form.action.includes('YOUR_FORM_ID')) {
        if (CONTACT_EMAIL) {
          const body = [
            `Name: ${data.get('name')}`,
            `Business: ${data.get('business')}`,
            `Email: ${data.get('email')}`,
            `Phone: ${data.get('phone') || '-'}`,
            `Website: ${data.get('website') || '-'}`,
            `Plan: ${data.get('plan') || '-'}`,
            `Needs: ${needs || '-'}`,
            '',
            data.get('message') || '',
          ].join('\n');
          location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Free audit — ${data.get('business')}`)}&body=${encodeURIComponent(body)}`;
          say('Opening your email app…', 'ok');
        } else {
          say('Thanks! The form isn’t connected yet — this is a preview of the site.', 'err');
        }
        return;
      }

      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      say('Sending…');
      try {
        const r = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(r.status);
        form.reset();
        say('Got it! We’ll be in touch within one business day.', 'ok');
      } catch {
        say('Something went wrong. Please try again in a moment.', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
