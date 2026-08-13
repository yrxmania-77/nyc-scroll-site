/* NEW YORK — non-journey motion.
   The pinned journey lives in journey.js; this file owns the hero, the nav,
   the count-ups and the gallery reveals. */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ========================= WORDMARK SIZING =========================

   The wordmark is plain grey text over the sharp photo — no knockout, no image
   fill, so nothing needs registering to the background. All that is left is
   fitting it to the container width.

   A `vw`-based clamp cannot do that: the ratio of text width to font size is a
   property of the font's metrics, so any fixed vw either overflows or leaves a
   ragged gap. Measuring at a reference size and scaling linearly is exact —
   letter-spacing is in em, so it scales with the font size too. */

function fitWordmark() {
  const wrap = $('.wordmark');
  const text = $('.wordmark__layer');
  if (!wrap || !text) return;

  const avail = wrap.clientWidth;
  if (!avail) return;

  const REF = 200;
  wrap.style.fontSize = `${REF}px`;
  const refWidth = text.scrollWidth;
  if (!refWidth) return;

  wrap.style.fontSize = `${(REF * avail) / refWidth}px`;
}

/* ========================== HERO DEPARTURE ======================== */

function heroFade() {
  const hero = $('.hero');
  if (!hero) return () => {};
  return () => {
    const h = hero.offsetHeight || window.innerHeight;
    const p = clamp01(window.scrollY / (h * 0.8));
    hero.style.setProperty('--hero-fade', p.toFixed(4));
  };
}

/* ========================== THE MAP ARRIVING ======================

   This function also drove a rack focus on the hero until the user removed that
   effect — "it's not working the way I want" — so all that is left is the
   journey's paper cover retracting as the stage rises. See the note where the
   falloff lived in site.css; the About section's image field replaced it.

   `s` runs 0 when the stage's top edge is at the bottom of the viewport — the
   instant it appears, still fully covered — to 1 when it reaches the top and
   the pin takes over. A whole viewport of travel, so the dissolve stays quiet. */

function mapArrival() {
  const stage = $('.journey__stage');
  if (!stage) return () => {};

  // The journey's cover must clear completely, or the map would stay hidden.
  if (reduce.matches) {
    stage.style.setProperty('--arrive', '0');
    return () => {};
  }

  return () => {
    const st = stage.getBoundingClientRect();
    const s = clamp01((window.innerHeight - st.top) / window.innerHeight);
    /* Drives the gradient's REACH, not its opacity — see .journey__melt.
       The easing within the band lives in the gradient's own stops; this shapes
       how the band RETRACTS, and it is a square root rather than linear for a
       measured reason.

       The band cannot fade out, because the stage's top edge has to stay
       exactly paper for as long as the About section sits above it. So it can
       only retract, and a linear retraction ends by compressing a full-strength
       paper-to-map fade into a sub-pixel band — a hard line, which is the exact
       artefact this overlay exists to prevent. Worst one-pixel step below the
       join, measured with the nav excluded from the sample:

         reach                travel 0.35   0.20   0.10   0.05   worst
         linear x 4svh                11.4   19.8   35.9   61.5    61.5  <- edge
         linear x 16svh (the fog)      3.9    5.5   10.1   19.9    19.9
         sqrt   x 4svh                 7.9    9.2   12.5   17.9    17.9  <- chosen

       sqrt is steeper than the old 16svh version through the middle and gentler
       than it right at the end, so its worst step across the whole travel is
       the lowest of the three while the band runs ~3x tighter through
       mid-travel, which is where the fog was actually visible. At full extent
       sqrt(1) is 1, so the band still matches the hero's exactly. */
    stage.style.setProperty('--arrive', Math.sqrt(1 - s).toFixed(4));
  };
}

/* ============================== NAV =============================== */

function navState() {
  const nav = $('#nav');
  if (!nav) return () => {};
  return () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
}

/* ============================ COUNT-UPS =========================== */

function runCount(el) {
  const target   = parseFloat(el.dataset.count || '0');
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const suffix   = el.dataset.suffix || '';
  const render   = (v) => { el.textContent = v.toFixed(decimals) + suffix; };

  if (reduce.matches) { render(target); return; }

  const DURATION = 1700;
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);   // slow settle

  const step = (now) => {
    const t = clamp01((now - start) / DURATION);
    render(target * ease(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function countUps() {
  const nums = $$('[data-count]');
  if (!nums.length) return;

  if (!('IntersectionObserver' in window)) { nums.forEach(runCount); return; }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      runCount(e.target);
      io.unobserve(e.target);        // once only
    }
  }, { threshold: 0.4 });

  nums.forEach((n) => io.observe(n));
}

/* ============================= REVEALS ============================ */

function reveals() {
  const items = $$('[data-reveal]');
  if (!items.length) return;

  // Without IO, or with reduced motion, everything is simply visible.
  if (reduce.matches || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.style.transitionDelay = `${Math.min(i, 4) * 90}ms`;
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  items.forEach((el) => io.observe(el));
}

/* ======================== GALLERY DESCRIPTIONS ====================

   Each tile's "Learn more" toggles a translucent panel over its own image.

   The fade itself is CSS — `.tile.is-open` drives opacity on the site's own
   `--dur-med` / `--ease-soft`, the same pair the rest of the page fades on.
   (The brief asked for Framer Motion; that is a React library and this site has
   no React, no bundler and no package.json, so the equivalent is expressed in
   the tokens that already own motion here.)

   This function's job is the part CSS cannot do: keeping `aria-expanded`
   truthful, making the hidden panel unreachable by keyboard rather than merely
   invisible, and closing on Escape or an outside click. */

function galleryPanels() {
  const tiles = $$('.tile').filter((t) => $('.tile__panel', t));
  if (!tiles.length) return;

  const close = (tile) => {
    if (!tile.classList.contains('is-open')) return;
    tile.classList.remove('is-open');
    $('.tile__more', tile).setAttribute('aria-expanded', 'false');
    // A panel that is only transparent is still in the tab order.
    $('.tile__panel', tile).inert = true;
  };

  const open = (tile) => {
    tiles.forEach(close);            // one description at a time
    tile.classList.add('is-open');
    $('.tile__more', tile).setAttribute('aria-expanded', 'true');
    const panel = $('.tile__panel', tile);
    panel.inert = false;
    // Move focus in, so a keyboard user lands on the way out.
    $('.tile__close', panel).focus({ preventScroll: true });
  };

  tiles.forEach((tile) => {
    $('.tile__panel', tile).inert = true;

    $('.tile__more', tile).addEventListener('click', () => {
      tile.classList.contains('is-open') ? close(tile) : open(tile);
    });

    $('.tile__close', tile).addEventListener('click', () => {
      close(tile);
      $('.tile__more', tile).focus({ preventScroll: true });
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openTile = tiles.find((t) => t.classList.contains('is-open'));
    if (!openTile) return;
    close(openTile);
    $('.tile__more', openTile).focus({ preventScroll: true });
  });

  // Tapping elsewhere dismisses, which is what a touch user expects.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.tile')) return;
    tiles.forEach(close);
  });
}

/* =========================== CONTACT FORM =========================

   Progressive enhancement, not a JS-only form. The markup is a real
   `<form action method="POST">`, so with this script blocked it still submits —
   the browser just navigates to Formspree's own thank-you page instead of
   staying put. This upgrades that to a fetch() and reports inline.

   Validation is the browser's. The `submit` event does not fire at all while a
   `required` field is empty or an `email` is malformed, so by the time we get
   here the form is already valid and the messages came localised for free.

   (The brief asked for Framer Motion for the reveal. Same answer as the gallery
   and the hero: it is a React library, and this site has no React, no bundler
   and no package.json. The reveal is `data-reveal`, which eases on the site's
   own --ease-soft, and it already honours prefers-reduced-motion.) */

const FORMSPREE_PLACEHOLDER = 'YOUR_FORM_ID';

function contactForm() {
  const form = $('[data-contact-form]');
  if (!form) return;

  const status = $('[data-contact-status]', form);
  const button = $('button[type="submit"]', form);
  const say = (msg) => { if (status) status.textContent = msg; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Fail loudly rather than posting into the void. Without this the form
       would POST to a literal /f/YOUR_FORM_ID, get a 404, and look to the
       visitor exactly like a message that was sent. */
    if (form.action.includes(FORMSPREE_PLACEHOLDER)) {
      say('This form is not connected yet — email yrxmania77@gmail.com in the meantime.');
      return;
    }

    button.disabled = true;
    say('Sending…');

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        form.reset();
        say('Thank you — your message is on its way.');
      } else {
        // Formspree returns the reason in JSON; surface it rather than a shrug.
        const data = await res.json().catch(() => null);
        const why = data?.errors?.map((x) => x.message).join(', ');
        say(why || 'That did not send. Please try again, or email yrxmania77@gmail.com.');
      }
    } catch {
      say('That did not send — check your connection, or email yrxmania77@gmail.com.');
    } finally {
      button.disabled = false;
    }
  });
}

/* ============================== BOOT ============================== */

function onScrollFactory() {
  const fns = [heroFade(), navState(), mapArrival()];
  let ticking = false;
  return () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      fns.forEach((f) => f());
      ticking = false;
    });
  };
}

function init() {
  const onScroll = onScrollFactory();
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  countUps();
  reveals();
  galleryPanels();
  contactForm();

  fitWordmark();
  // Fonts change the wordmark's metrics, so refit once they land.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitWordmark);
  }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(fitWordmark, 120);
  }, { passive: true });

  window.addEventListener('load', fitWordmark);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
