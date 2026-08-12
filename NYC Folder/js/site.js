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

/* ============================ RACK FOCUS ==========================

   The focus falloff itself is CSS — stacked masked blurs that need no script.
   This only makes the amount breathe with the scroll, so the defocus arrives as
   you approach the words rather than sitting there fully applied.

   It drives OPACITY, never the blur radius. Changing a blur radius re-rasterises
   the layer every frame; opacity is a compositor property and costs nothing.
   That distinction is the whole reason this can be tied to scroll at all.

   (The brief asked for Framer Motion. Same answer as the gallery: it is a React
   library and this site has no React or bundler, so the easing comes from the
   site's own tokens instead.) */

function rackFocus() {
  const hero = $('.hero');
  const stage = $('.journey__stage');
  if (!hero) return () => {};

  // Reduced motion gets a static falloff: still soft, just not scroll-linked.
  // The journey's cover must clear completely, or the map would stay hidden.
  if (reduce.matches) {
    hero.style.setProperty('--defocus', '1');
    if (stage) stage.style.setProperty('--arrive', '0');
    return () => {};
  }

  return () => {
    const h = hero.offsetHeight || window.innerHeight;
    /* SUBTLE on purpose, and the range matters more than it looks.

       The falloff is spatial — it is already on screen at scrollY 0, because
       the hero is one viewport tall and its soft bottom edge is visible
       immediately. Driving this from 0 would mean the depth of field only
       existed once you had scrolled past it, and the seam would be viewed at
       half strength. So it rests at 0.82 and breathes the last 18% in. */
    const d = clamp01(window.scrollY / (h * 0.55));
    hero.style.setProperty('--defocus', (0.82 + 0.18 * d).toFixed(4));

    /* The map arriving. `s` runs 0 when the stage's top edge is at the bottom of
       the viewport — the instant it appears, still fully covered — to 1 when it
       reaches the top and the pin takes over. A whole viewport of travel, so the
       dissolve is long and quiet.

       (1 - s)^2 is the hero's t^2 read backwards, which is what makes the two
       transitions mirror each other rather than merely both being soft. */
    if (!stage) return;
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

/* ============================== BOOT ============================== */

function onScrollFactory() {
  const fns = [heroFade(), navState(), rackFocus()];
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
