/* NEW YORK — non-journey motion.
   The pinned journey lives in journey.js; this file owns the hero, the nav,
   the count-ups, the rotating quote, the day/night compare and the
   gallery reveals. */

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

/* The map's paper cover used to be driven from here — `mapArrival()`, setting
   `--arrive` so `.journey__melt`'s gradient retracted as the stage rose. Both
   the melt and this function are gone: it was the last soft transition on the
   page, and measuring the live site showed it was the one the user could
   actually see. `--arrive` had no other consumer. See site.css for the numbers.

   This file no longer touches the journey at all. */

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

/* =========================== ROTATING QUOTE =======================

   Three quotes over one photograph, one every five seconds.

   All of the appearance is CSS — the deck stacks them, `.is-current` fades them
   on --dur-med / --ease-soft, and prefers-reduced-motion unstacks the deck to
   show all three at once. This function owns only the part CSS cannot do:
   deciding when the timer should be running at all.

   It should not be running when nobody is watching. The section is a long way
   down a page whose journey is already saturating the connection with frames,
   and a timer that keeps swapping classes off-screen is a compositor wake-up
   for nothing. Three conditions gate it, and every one of them can change while
   the page is open: the section is on screen, the tab is visible, and motion is
   allowed. `start()` re-checks all three rather than trusting the caller, so
   there is no ordering to get wrong between them.

   The interval is restarted rather than resumed after a pause, so a quote that
   was interrupted at 4.9s does not swap the instant it scrolls back in. The
   progress bar is driven off the same two calls for exactly that reason — one
   clock, so the fill cannot promise a swap at a moment the interval disagrees
   with. It is a Web Animation rather than a CSS one because restarting a CSS
   animation means removing it, forcing a reflow and putting it back, and there
   is no reflow to force here: cancel() resets the fill to empty on its own. */

const QUOTE_HOLD = 5000;

function rotatingQuote() {
  const deck = $('[data-quote-deck]');
  if (!deck) return;

  const figs = $$('.quote__fig', deck);
  if (figs.length < 2) return;

  const section = deck.closest('.quote') || deck;
  const fill = $('[data-quote-timer]');

  let index = Math.max(0, figs.findIndex((f) => f.classList.contains('is-current')));
  let timer = null;
  let bar = null;
  let onScreen = true;      // no IntersectionObserver: assume watched

  /* Wired to the interval, not to the class change, so the bar always measures
     the wait rather than the fade. Older engines without the Web Animations API
     simply never show a fill; the track stays hidden and the rotation is
     unaffected. */
  const runBar = () => {
    if (!fill || !fill.animate) return;
    if (bar) bar.cancel();
    bar = fill.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: QUOTE_HOLD, easing: 'linear', fill: 'forwards' },
    );
  };

  const clearBar = () => {
    if (!bar) return;
    bar.cancel();            // drops the effect: the track goes back to empty
    bar = null;
  };

  const advance = () => {
    figs[index].classList.remove('is-current');
    index = (index + 1) % figs.length;
    figs[index].classList.add('is-current');
    runBar();
  };

  const stop = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    clearBar();
  };

  const start = () => {
    if (timer !== null || reduce.matches || !onScreen || document.hidden) return;
    timer = setInterval(advance, QUOTE_HOLD);
    runBar();
  };

  if ('IntersectionObserver' in window) {
    onScreen = false;
    /* The LAST record, not the first. One callback can carry several records
       for the same target when the section crosses the threshold more than once
       between frames, which a fast scroll or a jump down the page does easily —
       and they arrive oldest first. Reading entries[0] there latches the stale
       one: measured at 900x1000, arriving at the deck after a jump to #contact
       left `onScreen` false and the rotation stopped on a section in full view. */
    const io = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      onScreen ? start() : stop();
    }, { threshold: 0.25 });
    io.observe(section);
  }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  /* `is-rotating` is what reveals the progress track, so it states exactly one
     thing: quotes will change here. Not whether the timer is running this
     instant — the bar should not blink out every time the section scrolls off
     screen, where nobody can see it anyway. */
  const declare = () => section.classList.toggle('is-rotating', !reduce.matches);

  /* The preference can be turned on mid-visit, and journey.js already rebuilds
     itself when it is. The CSS handles the layout either way; this only has to
     put the timer down, and pick it back up if the visitor changes their mind. */
  reduce.addEventListener('change', () => {
    declare();
    reduce.matches ? stop() : start();
  });

  declare();
  start();
}

/* =========================== DAY / NIGHT ==========================

   Almost nothing, and deliberately so. The control is a real range input
   stretched across the frame, so mouse drag, touch drag, click-to-position,
   arrow keys and Home/End are the browser's problem and are already correct.
   All this does is mirror the value onto `--pos`, which the CSS clips the day
   layer and positions the line with.

   The one piece of behaviour it owns is the opening: the frame arrives showing
   the day photograph whole and wipes to the middle the first time it is seen,
   which says what the control does without a caption having to. It is a rAF
   tween rather than a CSS transition because `--pos` is an unregistered custom
   property — transitions on those do not interpolate, they jump at the end. */

const COMPARE_INTRO_MS = 1100;

function compareSlider() {
  const fig = $('[data-compare]');
  if (!fig) return;
  const frame = $('.compare__frame', fig);
  const range = $('[data-compare-range]', fig);
  if (!frame || !range) return;

  let intro = 0;

  const put = (p) => {
    frame.style.setProperty('--pos', `${p}%`);
    range.value = String(p);
  };

  /* Any touch of the control ends the intro immediately. A tween that keeps
     pulling the divider out of the visitor's hand is worse than no tween. */
  const grab = () => {
    if (!intro) return;
    cancelAnimationFrame(intro);
    intro = 0;
  };

  range.addEventListener('input', () => { grab(); put(+range.value); });
  range.addEventListener('pointerdown', grab);
  range.addEventListener('keydown', grab);

  const open = () => {
    if (reduce.matches) { put(50); return; }
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);   // the count-ups' settle
    put(100);
    const step = (now) => {
      const t = clamp01((now - start) / COMPARE_INTRO_MS);
      put(+(100 + (50 - 100) * ease(t)).toFixed(2));
      intro = t < 1 ? requestAnimationFrame(step) : 0;
    };
    intro = requestAnimationFrame(step);
  };

  put(50);
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    if (!entries[entries.length - 1].isIntersecting) return;
    io.disconnect();
    open();
  }, { threshold: 0.35 });
  io.observe(frame);
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
  const fns = [heroFade(), navState()];
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
  rotatingQuote();
  compareSlider();
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
