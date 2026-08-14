/* ==========================================================================
   NEW YORK — the pinned journey.

   Scroll drives a scrubbed descent from an aerial hub map into a place, holds
   while that place introduces itself, then yanks back up to the hub. Four
   places, one hub, fully reversible.

   Three delivery modes, chosen once at boot and rebuilt live if the
   reduced-motion preference changes:

     scrub   GSAP present, motion allowed  — pinned canvas frame sequence
     static  reduced motion, or no GSAP    — stills stacked in normal flow
     (there is no fourth mode; anything unexpected falls through to static)

   The section never renders as a blank dark box.
   ========================================================================== */

const MEDIA = 'main%20scroll%20folder/';
const FRAME_COUNT = 121;             // clips are 24fps / 5.04s / 121 frames
const LAST_FRAME = FRAME_COUNT - 1;

const PLACES = [
  { key: 'park',   name: 'Central Park',      alt: 'Central Park at street level, ringed by skyline' },
  { key: 'bridge', name: 'Brooklyn Bridge',   alt: 'The Brooklyn Bridge over the East River' },
  { key: 'times',  name: 'Times Square',      alt: 'Times Square at full volume' },
  { key: 'statue', name: 'Statue of Liberty', alt: 'The Statue of Liberty in New York Harbor' }
];

/* Clip load order is also the memory window's axis: the visitor only ever
   travels along it, so "one step behind / one step ahead" is a slice of it. */
const CLIP_ORDER = PLACES.flatMap((p) => [`${p.key}-dive`, `${p.key}-pullup`]);

/* PACING. Every clip is exactly FRAME_COUNT frames, so weight IS rate: a clip
   given W units of scroll advances at FRAME_COUNT/W frames per viewport. Both
   clip types therefore run at one steady rate each, everywhere in the journey —
   no place is faster or slower than the same beat elsewhere.

   Dives stay deliberate and pull-ups stay quick, but the ratio is 2:1 rather
   than the 3:1 it was, which is what made pull-ups feel like they blew past
   while dives dragged. Totals: dive 50 frames/vh, pull-up 101 frames/vh. */
const W = { hub: 0.5, dive: 2.4, hold: 0.9, pullup: 1.2 };

/* ---- SEAM GEOMETRY ------------------------------------------------------

   The clips were generated at different framings, so the map is a different
   SIZE on each side of a join and the seam pops. Measured by searching scale
   and offset for the best alignment at every seam (all four places agree to
   within 0.01, so this is systematic, not noise):

     dive END      -> pull-up START     pull-up must be scaled 1.06
     pull-up END   -> next dive START   pull-up must be scaled 0.76

   So a pull-up drifts ~1.32x tighter than where the next dive begins. One
   constant scale cannot fix both ends; the correction has to RAMP across each
   clip. Scaling down would expose the frame edge, so the ramps are normalised
   to stay >= 1 and always crop inward:

     dive     ramps 1.316 -> 1.000   (starts cropped in to meet the pull-up)
     pull-up  ramps 1.060 -> 1.000

   Check both joins with those numbers: at the place, dive-end 1.000 against
   pull-up-start 1.060 — and 1.06 is exactly the measured correction. At the
   map, pull-up-end 1.000 against dive-start 1.316, and 0.76 x 1.316 = 1.000.
   Both sides match, so nothing changes size.

   The dive ramp is spread across the whole clip rather than crammed into the
   join: a dive is already a large continuous zoom, so a 32% correction spread
   over it is imperceptible, whereas the same correction over a few frames
   would read as a lurch. */
const DIVE_START_SCALE = 1.316;
const PULLUP_START_SCALE = 1.060;

/* What the scale match CANNOT remove.

   Measured after correcting scale, on the visible region of each side:
     exposure   per-channel gain 0.99-1.01 — already matched, nothing to fix
     offset     best alignment is dx=0 dy=0 over a wide search — nothing to fix
     residual   ~22 mean levels, and it does not respond to scale or translation

   That residual is PERSPECTIVE. The map shots were flown at different
   altitudes, so the foreshortening differs and no 2D transform can reconcile
   them. It can only be hidden, so the question is where to hide it.

   It used to be hidden at the START of a dive: slow, sharp, and the most
   scrutinised moment in the journey — the worst possible place. It now happens
   in the pull-up's TAIL instead, which is the fastest and most motion-blurred
   stretch of the whole sequence, where the eye cannot resolve the difference.
   By the time the dive begins, the canvas is already showing the dive's own
   first frame, so the dive starts clean with nothing to blend.

   Keep this SHORT. The blend target is a still, so while it is running the
   moving frames are being mixed toward something static — a long tail visibly
   kills the motion and the join reads as a stall followed by a jerk, which is
   worse than the mismatch it hides. */
const SEAM_TAIL_FRAMES = 4;

/* PACING WITHIN A CLIP — measured per clip, not guessed.

   Every clip is a bell curve of motion, because the source camera eases in,
   runs, and settles. Mean absolute frame-to-frame difference by 10-frame
   bucket, measured on the same 16:9 crop that ships:

     park-dive      6 -> 22 -> 4      statue-dive    5 -> 28 -> 1
     park-pullup    2 -> 33 -> 4      times-pullup  ~9 -> 19 -> 4

   Mid-clip motion is 4x to 25x the motion over the last five frames on EVERY
   clip — dives included, which the old pull-up-only exponent never touched, so
   all four dives have been crawling into their hold.

   Those eases were authored for linear playback at 24fps. In a scrub the
   visitor supplies the timing, so replaying the built-in ease on top of their
   constant scroll is exactly what reads as "crawls, then blasts past": the clip
   spends as much scroll on frames that barely differ as on the fast middle.

   MOTION_LUT inverts each clip's cumulative-motion curve, so equal scroll buys
   equal SCREEN motion. 33 samples, linearly interpolated; the sub-frame blend
   covers the rest. Regenerate with scripts/motion-table.py after any re-export.

   Frames that get skipped by this are frames that barely differ — that is the
   whole point, and it is invisible by construction. */
const MOTION_FLATTEN = 1;   // 0 = the source's own timing, 1 = constant velocity

const MOTION_LUT = {
  'park-dive':    [0.0, 7.71, 13.94, 18.72, 22.92, 26.62, 30.0, 33.17, 36.26, 39.35, 42.39, 45.35, 48.12, 50.87, 53.56, 56.28, 59.05, 61.78, 64.41, 67.03, 69.79, 72.61, 75.32, 77.93, 80.84, 84.2, 87.22, 90.35, 94.49, 98.69, 104.47, 112.23, 120.0],
  'park-pullup':  [0.0, 8.28, 16.57, 23.42, 27.23, 30.42, 33.29, 35.51, 38.48, 41.44, 44.39, 46.65, 48.63, 50.63, 52.41, 53.99, 55.57, 57.17, 58.77, 60.34, 61.89, 63.53, 65.33, 67.29, 69.43, 71.92, 74.94, 79.15, 86.87, 95.15, 103.43, 111.72, 120.0],
  'bridge-dive':  [0.0, 7.98, 15.95, 23.38, 28.94, 33.32, 36.83, 40.09, 43.24, 46.35, 49.28, 52.06, 54.59, 57.19, 59.68, 62.0, 64.14, 66.09, 68.21, 70.24, 72.36, 74.6, 76.81, 79.03, 81.0, 83.26, 85.29, 87.56, 90.59, 96.12, 104.05, 112.02, 120.0],
  'bridge-pullup':[0.0, 8.27, 16.53, 24.8, 33.06, 39.82, 42.2, 44.02, 45.68, 47.38, 49.14, 50.84, 52.55, 54.46, 56.4, 58.13, 59.75, 61.25, 62.65, 63.99, 65.37, 66.75, 68.18, 69.68, 71.33, 73.21, 75.64, 79.51, 86.94, 95.2, 103.47, 111.73, 120.0],
  'times-dive':   [0.0, 7.89, 15.77, 23.11, 29.09, 34.24, 39.0, 43.5, 47.89, 52.18, 56.01, 59.54, 62.85, 65.79, 68.52, 71.12, 73.14, 75.33, 77.39, 79.23, 80.77, 82.23, 83.64, 85.03, 86.55, 88.29, 90.16, 92.08, 94.38, 97.98, 104.23, 112.11, 120.0],
  'times-pullup': [0.0, 7.49, 10.92, 13.26, 15.44, 17.66, 19.94, 22.29, 24.66, 26.98, 29.61, 32.4, 35.58, 38.68, 41.79, 44.6, 46.92, 49.19, 51.47, 53.92, 56.61, 59.3, 62.15, 65.12, 68.31, 72.12, 76.68, 82.89, 90.21, 96.99, 104.53, 112.26, 120.0],
  'statue-dive':  [0.0, 8.14, 16.28, 24.29, 30.42, 34.76, 38.17, 41.02, 43.71, 46.37, 48.88, 51.39, 53.75, 56.07, 58.39, 60.71, 62.95, 65.35, 68.12, 70.58, 72.7, 75.18, 77.63, 80.96, 83.48, 85.39, 87.41, 90.15, 93.59, 97.47, 103.72, 111.86, 120.0],
  'statue-pullup':[0.0, 8.41, 16.82, 25.23, 29.95, 32.78, 34.81, 36.66, 38.69, 40.65, 42.48, 44.46, 46.43, 48.48, 50.43, 52.3, 54.03, 55.7, 57.25, 58.79, 60.33, 61.96, 63.63, 65.42, 67.37, 69.57, 72.43, 78.08, 86.36, 94.77, 103.18, 111.59, 120.0]
};

/* The place join (dive end -> pull-up start) is a different case: those frames
   genuinely do nearly match (residual 6-15), so it keeps a short fade. */
const SEAM_FADE_FRAMES = 5;

/* Scroll fraction within a clip -> fractional frame index, through that clip's
   own motion curve. Pure: t in, frame out, no state, so reversing still costs
   nothing. */
function frameForT(clipName, t) {
  const linear = t * LAST_FRAME;
  const lut = MOTION_LUT[clipName];
  if (!lut || MOTION_FLATTEN <= 0) return linear;
  const k = lut.length - 1;
  const x = clamp01(t) * k;
  const i = x >= k ? k - 1 : Math.floor(x);
  const even = lut[i] + (lut[i + 1] - lut[i]) * (x - i);
  return linear + (even - linear) * MOTION_FLATTEN;
}

/* Ease the ramp so it has no hard start or stop at the segment boundary. */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* Content scale for whatever is on screen right now. Stills sit at the scale of
   the frame they were cut from: a hold still is a dive's last frame (1.0) and a
   return still is a pull-up's last frame (1.0).

   A hub segment carries its OWN scale rather than deriving one from its kind,
   because the two hubs show opposite ends of the journey: the lead-in hub is
   park-dive's first frame (needs DIVE_START_SCALE) while the tail hub is the
   last pull-up's final frame (already scale 1). Deriving both from the kind
   put a 31.6% instant zoom on the final frame — the same shot, cropped 1.316x
   tighter, one tick after the pull-up ended at 1.000.

   Driven by FRAME position, not scroll position. The seam correction was
   measured per frame (1.316 at frame 0 decaying to 1.000 at frame 120), and
   once MOTION_LUT decouples frames from scroll those two are no longer the
   same number. Keying it to scroll would put the wrong correction on the frame
   actually being drawn and re-open the seams this ramp exists to close. */
function scaleFor(seg, fp) {
  if (seg.kind === 'dive') return 1 + (DIVE_START_SCALE - 1) * (1 - easeInOut(fp));
  if (seg.kind === 'pullup') return 1 + (PULLUP_START_SCALE - 1) * (1 - easeInOut(fp));
  if (seg.kind === 'hub') return seg.scale;
  return 1;                                     // hold stills
}

/* Where in the HOLD the card lives. It must be fully gone before the pull-up
   starts, so the exit finishes well short of 1. */
const CARD_IN = 0.10;
const CARD_OUT = 0.78;

const KEEP_BACK = 1;    // clips retained behind the playhead (reverse scroll)
const KEEP_AHEAD = 2;   // clips prefetched in front of it

/* DECODE WINDOW — the thing that actually decides whether this scrolls smoothly.

   A frame's cost in memory is width*height*4 once decoded, whatever the file
   format. At native size that is 7.7MB per frame, so one 121-frame clip is
   ~894MB decoded. Nothing will hold that, so the browser evicts decoded
   bitmaps and silently re-decodes them when they are next drawn — measured at
   3.79ms each, which does not fit in a 16.7ms frame budget.

   Decoding every frame once at load does not help: they are all evicted long
   before the playhead arrives. So decoding is done in a WINDOW that travels
   with the playhead. Only ~30 frames are ever warm (~230MB), and frames are
   re-decoded as they enter the window, off the main thread, ahead of being
   needed.

   This is why the format cannot fix it: WebP would shrink the download, which
   already takes 164ms per clip, and would leave the decoded size identical. */
/* Quantisation levels for sub-frame interpolation.

   2, not the 4 it was. Below BLEND_MAX_SPEED the blend's redraw frequency is
   speed x BLEND_STEPS, so at a slow scroll this number sets the redraw rate
   directly — and every one of those redraws is two full-canvas draws. Halving
   it took desktop from 3% dropped back to 1%, and a slow-scroll stepping test
   still reports 0/89 frozen samples, so the smoothing it exists for is intact. */
const BLEND_STEPS = 2;

/* Frame velocity, in frames per tick, above which sub-frame blending is
   dropped. 1.0 rather than the 1.2 it was: at one frame per tick every tick
   already shows a new source frame, so there is nothing left to interpolate,
   and 1.2 was paying a second full-canvas draw to smooth motion that was
   already smooth.

   This went unnoticed while the frame mapping was linear, because velocity then
   swung far above and below the threshold. MOTION_LUT holds velocity constant
   by design, and it settles at a measured median of 1.19 frames/tick — landing
   the entire journey just inside a 1.2 threshold and blending 51% of ticks,
   which cost 1% -> 4% dropped frames on desktop. */
const BLEND_MAX_SPEED = 1.0;

const WARM_AHEAD = 22;  // frames kept decoded in front of the playhead
const WARM_BACK = 8;    // and behind it, so reversing does not stall

/* The 1280x720 set, and the completeness below which we switch to it. See
   ClipStore.#checkPace — 0.75 rather than something stricter because a clip
   arriving 80% loaded still scrubs cleanly; the measured failures were 30-53%. */
const SMALL_SET = 'frames-sm';
const PACE_FLOOR = 0.75;
/* Eligibility is measured in CLIP TRANSITIONS, not milliseconds, and that is
   the whole trick. A clip is judged once the playhead has crossed at least one
   clip boundary since the clip was created — so it has had exactly one clip's
   worth of loading time, whatever the scroll speed happens to be.

   Two wall-clock versions of this failed first, in opposite directions. 4s was
   longer than a whole clip at a brisk scroll (~1.1s each), so nothing ever
   became eligible and the downgrade never fired. 1.5s worked there but a fast
   scroll covers a clip in ~0.44s, so it suppressed the check again and every
   later clip arrived with 12-24 frames of 121. A fixed duration cannot track a
   timescale the visitor sets; a count of transitions does, for free. */
/* Progress below which restarting a prefetched clip at the small size is
   cheaper than finishing it at full size. Derived, not tuned: ~49MB full
   against ~23MB small, so restarting wins while 23 < 49 x (1 - progress). */
const RESTART_BELOW = 0.53;
const LOAD_CONCURRENCY = 6;
const LOADER_DELAY = 140; // ms of starvation before the spinner is admitted

const $ = (sel, root = document) => root.querySelector(sel);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pad4 = (n) => String(n).padStart(4, '0');
const noop = () => {};

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

/* -------------------------------------------------------------------------
   Capability sniffing
   ---------------------------------------------------------------------- */

function wantsSmallFrames() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && conn.saveData) return true;
  /* A declared slow connection starts small rather than waiting for
     ClipStore.#checkPace to notice mid-journey. Only the clearly-slow tiers:
     Chrome caps `downlink` at 10 for privacy and reports '4g' for anything
     decent, so this can identify bad links but never confirm a good one —
     which is exactly why the runtime check exists as well. */
  if (conn && /^(slow-2g|2g|3g)$/.test(conn.effectiveType || '')) return true;
  if (window.matchMedia('(max-width: 759px)').matches) return true;
  // A coarse pointer on a modest screen is a phone or small tablet held close;
  // 900x506 is indistinguishable there and a third of the bytes.
  return window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches;
}

function hasGsap() {
  return !!(window.gsap && window.ScrollTrigger);
}

/* -------------------------------------------------------------------------
   Asset paths
   ---------------------------------------------------------------------- */

const framePath = (set, clip, i) => `${MEDIA}${set}/${clip}/${pad4(i + 1)}.jpg`;
const holdPath = (key) => `${MEDIA}stills/${key}-hold.jpg`;
const returnPath = (key) => `${MEDIA}stills/${key}-return.jpg`;
const mapStartPath = (key) => `${MEDIA}stills/${key}-mapstart.jpg`;
const hubPath = (small) => `${MEDIA}optimized/scroll-start${small ? '-sm' : ''}.jpg`;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* -------------------------------------------------------------------------
   Clip cache

   One entry per clip. Frames are plain Image objects, deliberately NOT
   ImageBitmaps: an ImageBitmap is always fully resident (1600x900x4 = 5.8MB
   each, so 700MB for one clip), whereas an Image lets the browser hold the
   compressed JPEG and manage decoded bitmaps in its own LRU. decode() is still
   awaited so the first draw of a frame never blocks on JPEG decode mid-scrub.

   Release drops every reference and cancels in-flight fetches. removeAttribute
   is used instead of src='' because src='' resolves to the document URL in
   Chromium and fires a pointless request.
   ---------------------------------------------------------------------- */

class Clip {
  constructor(name, set) {
    this.name = name;
    this.set = set;
    this.images = new Array(FRAME_COUNT).fill(null);
    this.have = new Uint8Array(FRAME_COUNT);
    this.warm = new Uint8Array(FRAME_COUNT);  // inside the decode window
    this.count = 0;
    this.complete = false;
    this.aborted = false;
    this.bornFocus = -1;             // set by ClipStore.ensure, for #checkPace
  }

  /* Keep a travelling window of frames decoded around `centre`.

     Frames entering the window get an explicit decode() so the work happens
     off the main thread before the playhead reaches them. Frames leaving it
     have their flag cleared, so if the visitor scrolls back they are decoded
     again rather than being assumed warm — the browser has almost certainly
     evicted them by then. */
  warmAround(centre, forward) {
    // Only re-scan when the window actually moves; this runs inside the rAF
    // loop and the playhead sits on the same frame for many ticks.
    if (centre === this.warmCentre && forward === this.warmForward) return;
    this.warmCentre = centre;
    this.warmForward = forward;

    const lo = Math.max(0, centre - (forward ? WARM_BACK : WARM_AHEAD));
    const hi = Math.min(LAST_FRAME, centre + (forward ? WARM_AHEAD : WARM_BACK));

    for (let i = 0; i < FRAME_COUNT; i++) {
      if (i >= lo && i <= hi) {
        if (this.warm[i] || !this.have[i]) continue;
        this.warm[i] = 1;
        const img = this.images[i];
        if (img && img.decode) img.decode().then(noop, noop);
      } else if (this.warm[i]) {
        this.warm[i] = 0;
      }
    }
  }

  frame(i) {
    return this.have[i] ? this.images[i] : null;
  }

  /* Nearest frame we can actually paint. Loading runs front-to-back, so a
     backward scan almost always hits; the forward scan covers a reversed
     visitor sitting in a gap. Returns null only for a completely empty clip. */
  nearest(i) {
    if (this.have[i]) return this.images[i];
    for (let j = i - 1; j >= 0; j--) if (this.have[j]) return this.images[j];
    for (let j = i + 1; j < FRAME_COUNT; j++) if (this.have[j]) return this.images[j];
    return null;
  }
}

class ClipStore {
  constructor(set) {
    this.set = set;
    this.cache = new Map();
    this.focus = -1;
  }

  get(index) {
    return this.cache.get(CLIP_ORDER[index]) || null;
  }

  ensure(index) {
    const name = CLIP_ORDER[index];
    if (!name) return null;
    let clip = this.cache.get(name);
    if (!clip) {
      clip = new Clip(name, this.set);
      clip.bornFocus = this.focus;
      this.cache.set(name, clip);
      this.#load(clip);
    }
    return clip;
  }

  /* ADAPTIVE FRAME SET — the fix for "smooth at the start, then it breaks up".

     Measured on the live site over a 182 Mbps link, which is a fast one: an
     11-second scroll of the whole journey needs ~390MB of frames and only 255MB
     arrived. Frames present when the playhead reached each clip:

       park-dive 121/121   bridge-pullup 64/121   statue-dive   46/121
       park-pullup 121/121 times-dive    48/121   statue-pullup 36/121
       bridge-dive 121/121 times-pullup  38/121

     The first three are complete because they download while the visitor is
     still in the hero and About sections. Everything after has to arrive during
     the scroll, and cannot. The scrub then holds the nearest frame it has,
     which is what reads as breaking up — note the rAF rate stays at 60fps
     throughout, so this was never jank. The frames simply are not there.

     This is also why it looked like a memory leak and is not one: live Image
     objects peak at 497 and FALL to 255, 726 of 981 are explicitly released,
     and no frame is ever fetched twice.

     The trigger is the symptom itself rather than a bandwidth guess. If a clip
     is still substantially incomplete at the moment the playhead arrives on it,
     we are losing the race, so every clip loaded from here on comes from the
     1280x720 set instead — 195KB a frame against 412KB, so a little over half
     the bytes. Clips already in memory keep their own set (Clip stores it at
     construction), so nothing in flight is thrown away.

     Sticky on purpose: no upgrading back mid-journey. Flapping between two
     resolutions would be far more visible than the lower one. */
  #checkPace(index) {
    if (this.set === SMALL_SET) return;

    /* Judge the whole resident window, not just the clip we landed on.
       Watching only the current clip fires one clip too late: by the time the
       playhead ARRIVES somewhere short, the next two were already prefetched at
       full size and the downgrade cannot reach the visitor for another clip.
       A prefetched clip that has had a grace period and is still barely loaded
       is the same evidence, one clip earlier.

       Eligibility keeps this honest — a clip created moments ago is at 0% for
       entirely innocent reasons, and judging it would downgrade every visitor
       at boot. Only clips that have already survived a clip transition, and so
       have had a full clip's worth of loading time, can fail. */
    let behind = false;
    for (let i = index; i <= index + KEEP_AHEAD; i++) {
      const c = this.get(i);
      if (!c || c.complete) continue;
      if (c.bornFocus >= index) continue;      // created this transition: too new to judge
      if (c.count / FRAME_COUNT < PACE_FLOOR) { behind = true; break; }
    }
    if (!behind) return;
    this.set = SMALL_SET;
    this.downgraded = true;

    /* Switching the set alone would barely help: KEEP_AHEAD means the next two
       clips were already created at full size by an earlier focusOn, so the
       downgrade would not reach the playhead for three more clips — past the
       whole broken stretch. Their partial downloads are also exactly the
       backlog that lost the race.

       So drop the clips ahead of the playhead that are barely started.
       release() clears each src, which cancels the in-flight fetches too, and
       the ensure() loop below immediately re-creates them from the small set
       with a clear pipe. The current clip is deliberately untouched — it is the
       one being drawn.
       Not unconditionally, though — a clip most of the way through a full-size
       download is cheaper to finish than to restart. A full clip is ~49MB and a
       small one ~23MB, so restarting wins only while
       23 < 49 x (1 - progress), i.e. progress < 0.53. Above that, keeping it is
       both cheaper and higher quality. */
    for (const name of [...this.cache.keys()]) {
      const i = CLIP_ORDER.indexOf(name);
      const c = this.cache.get(name);
      if (i > index && c.count / FRAME_COUNT < RESTART_BELOW) this.release(name);
    }
  }

  /* The whole memory strategy in one call: pull in the clip under the
     playhead, prefetch the next one, drop everything outside the window. */
  focusOn(index) {
    if (index === this.focus || index < 0) return;
    this.focus = index;
    // Judge the clip we are arriving on BEFORE ensuring the next ones, so the
    // downgrade applies to everything this call is about to start loading.
    this.#checkPace(index);
    /* Ensure the whole window, not just its far edge. This used to be
       ensure(index) plus ensure(index + KEEP_AHEAD), which skipped every clip
       in between — so the very next clip was never prefetched and only began
       loading at the instant it became current. That produced a stall at every
       clip transition. */
    for (let i = index; i <= index + KEEP_AHEAD; i++) this.ensure(i);
    for (const name of [...this.cache.keys()]) {
      const i = CLIP_ORDER.indexOf(name);
      if (i < index - KEEP_BACK || i > index + KEEP_AHEAD) this.release(name);
    }
  }

  release(name) {
    const clip = this.cache.get(name);
    if (!clip) return;
    clip.aborted = true;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = clip.images[i];
      if (img) img.removeAttribute('src');
      clip.images[i] = null;
      clip.have[i] = 0;
    }
    this.cache.delete(name);
  }

  releaseAll() {
    for (const name of [...this.cache.keys()]) this.release(name);
    this.focus = -1;
  }

  async #load(clip) {
    let next = 0;
    const worker = async () => {
      while (!clip.aborted) {
        const i = next++;
        if (i >= FRAME_COUNT) return;
        await this.#frame(clip, i);
      }
    };
    await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker));
    if (!clip.aborted) clip.complete = clip.count === FRAME_COUNT;
  }

  #frame(clip, i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      const settle = () => {
        if (clip.aborted) {
          img.removeAttribute('src');
          return resolve();
        }
        clip.images[i] = img;
        clip.have[i] = 1;
        clip.count++;
        resolve();
      };
      img.onload = () => {
        if (clip.aborted) return resolve();
        // Loading no longer decodes. Decoding every frame here just fills the
        // browser's bitmap cache with frames that are evicted long before the
        // playhead reaches them; the travelling warm window owns it instead.
        settle();
      };
      img.onerror = () => resolve();
      img.src = framePath(clip.set, clip.name, i);
    });
  }
}

/* -------------------------------------------------------------------------
   The weighted segment timeline

   Progress 0..1 maps to a list of segments whose lengths are the pacing
   weights. Nothing here is stateful: progress in, (source, frame) out, which
   is what makes scrolling backward reverse cleanly for free.
   ---------------------------------------------------------------------- */

function buildSegments() {
  const segs = [];
  // Lead-in hub. It resolves to frame 0 of park-dive rather than the separate
  // hub still, so there is no seam when the dive starts.
  segs.push({
    kind: 'hub', weight: W.hub, clipIndex: 0, frame: 0, dot: 'park',
    scale: DIVE_START_SCALE   // showing park-dive frame 0, where the dive begins
  });

  PLACES.forEach((place, i) => {
    const dive = i * 2;
    const pullup = dive + 1;

    /* Seams, measured from the source frames:
         hub -> park-dive 0001      1.2  (same shot; no fade needed)
         dive 0121 -> pullup 0001   2.6-15.0
         pullup 0121 -> next dive   22.1-22.3
       Each clip that does not already start on the previous image dissolves
       out of a resident still rather than cutting to it. */
    /* No fadeFrom on a dive any more. The previous pull-up's tail has already
       dissolved the canvas onto this dive's own first frame, so the dive opens
       on exactly the image that is already showing. */
    segs.push({
      kind: 'dive', weight: W.dive, place, clipIndex: dive, dot: place.key
    });
    segs.push({ kind: 'hold', weight: W.hold, place, clipIndex: pullup, dot: place.key });
    segs.push({
      kind: 'pullup', weight: W.pullup, place, clipIndex: pullup, dot: place.key,
      // The hold IS the dive's last frame, so the pull-up dissolves out of it.
      fadeFrom: { kind: 'hold', key: place.key },
      // ...and its blurred tail dissolves INTO the next dive's first frame,
      // which is where the perspective mismatch gets buried. The last place has
      // no next dive, so it simply ends on the map.
      fadeTo: i < PLACES.length - 1 ? { key: PLACES[i + 1].key } : null
    });
  });

  /* Tail hub: last frame of the final pull-up, held while the pin releases.
     It is the SAME image the pull-up just ended on, so it must also be at the
     scale the pull-up ended at. There is no separate end image here and never
     was — the visible jump was this segment being drawn 1.316x tighter. */
  segs.push({
    kind: 'hub',
    weight: W.hub,
    clipIndex: CLIP_ORDER.length - 1,
    frame: LAST_FRAME,
    dot: 'statue',
    scale: 1
  });

  const total = segs.reduce((sum, s) => sum + s.weight, 0);
  let cursor = 0;
  for (const s of segs) {
    s.start = cursor / total;
    cursor += s.weight;
    s.end = cursor / total;
    s.span = s.end - s.start;
  }
  return { segs, totalWeight: total };
}

function resolve(segs, p) {
  const v = clamp01(p);
  let seg = segs[segs.length - 1];
  for (let i = 0; i < segs.length; i++) {
    if (v < segs[i].end) {
      seg = segs[i];
      break;
    }
  }
  return { seg, t: clamp01((v - seg.start) / (seg.span || 1)) };
}

/* -------------------------------------------------------------------------
   Canvas renderer — cover-fit, DPR aware
   ---------------------------------------------------------------------- */

class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.w = 0;
    this.h = 0;
    this.last = null;
    this.key = null;   // what is currently painted, including blend state
    this.dirty = true;
  }

  measure() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h) return false;

    /* Render at the display's native resolution. A canvas sized in CSS pixels
       is upscaled by the compositor on a retina screen and looks soft, so the
       backing store is devicePixelRatio times the CSS box, capped at 2.

       There WAS a cap here tying the backing store to the source frame width.
       It was wrong. It came from a fill-rate measurement taken in headless
       Chromium, which rasterises with SwiftShader in software — there, a
       2880x1800 canvas dropped 54% of frames. On the real GPU the same canvas
       drops 0%. The cap only ever protected a software rasteriser that no real
       visitor uses, and the cost was a visibly soft image on every retina
       screen. Measure on hardware (--use-angle=metal) before reinstating it. */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    this.ctx.imageSmoothingQuality = 'high';
    this.dirty = true;
    return true;
  }

  /* Cover fit: scale by the LARGER of the two axis ratios so the frame always
     overflows the shorter axis, then centre the overflow. Never stretch. Clips
     are exported at their own native size and only share a 16:9 crop, so they
     differ in pixel dimensions and this composites them identically.
  /* Cover fit, then an extra content scale that corrects the framing drift
     between clips. `zoom` is always >= 1 so the frame still covers the canvas;
     anything below 1 would pull the image in from the edges and show a gap. */
  blit(img, zoom = 1) {
    const scale = Math.max(this.w / img.naturalWidth, this.h / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    this.ctx.drawImage(img, (this.w - dw) / 2, (this.h - dh) / 2, dw, dh);
  }

  draw(img, zoom = 1, key = null) {
    if (!img || !img.naturalWidth || !this.w) return;
    this.blit(img, zoom);
    this.last = img;
    this.key = key || `${img.src}@${zoom.toFixed(4)}`;
    this.dirty = false;
  }

  /* Dissolve between two frames.

     This carries two jobs at once. Between adjacent frames of a clip it is
     sub-frame interpolation: 121 frames stretched over ~2000px of scroll means
     each frame would otherwise hold for ~18px and the motion reads as stepping.
     At a clip boundary it is the seam hider: the source clips do not share
     frames across a cut, so a hard switch shows a jump.

     alpha 0 paints a, alpha 1 paints b. Fully opaque frames, so `a` is simply
     painted first and `b` composited over it — no clearRect needed.

     Each side carries its OWN zoom. That is the point at a seam: the two frames
     are only aligned once each is drawn at its own corrected scale, so blending
     them at a shared scale would dissolve one size into another and produce
     exactly the pop this is meant to remove. */
  drawBlend(a, za, b, zb, alpha, key) {
    if (!a || !a.naturalWidth || !this.w) return;
    if (!b || !b.naturalWidth) return this.draw(a, za, key);
    this.blit(a, za);
    const prev = this.ctx.globalAlpha;
    this.ctx.globalAlpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    this.blit(b, zb);
    this.ctx.globalAlpha = prev;
    this.last = b;
    this.key = key;
    this.dirty = false;
  }
}

/* -------------------------------------------------------------------------
   Progress dots

   Place dots come from journey progress; hero and outro come from ordinary
   scroll. The journey wins whenever the pin is live.
   ---------------------------------------------------------------------- */

class Dots {
  constructor() {
    this.nodes = new Map();
    document.querySelectorAll('[data-dot]').forEach((el) => {
      this.nodes.set(el.getAttribute('data-dot'), el);
    });
    this.spy = 'hero';
    this.journey = null;
    this.current = null;
    this.observer = null;
    this.apply();
  }

  /* One dot at a time: with a -50%/-50% root margin only the section straddling
     the viewport's centre line is "intersecting". */
  watch(pairs) {
    this.unwatch();
    if (!('IntersectionObserver' in window)) return;
    const map = new WeakMap();
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            this.spy = map.get(e.target);
            this.apply();
          }
        }
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
    );
    for (const [sel, dot] of pairs) {
      const el = typeof sel === 'string' ? $(sel) : sel;
      if (!el) continue;
      map.set(el, dot);
      this.observer.observe(el);
    }
  }

  unwatch() {
    if (this.observer) this.observer.disconnect();
    this.observer = null;
  }

  setJourney(dot) {
    if (this.journey === dot) return;
    this.journey = dot;
    this.apply();
  }

  apply() {
    const want = this.journey || this.spy;
    if (want === this.current) return;
    this.current = want;
    this.nodes.forEach((el, key) => {
      el.classList.toggle('is-active', key === want);
      el.setAttribute('aria-current', key === want ? 'true' : 'false');
    });
  }
}

/* -------------------------------------------------------------------------
   Fallback styling

   Injected at the TOP of <head> so anything css/site.css says later, at equal
   specificity, wins. This exists so the page is never broken while site.css is
   incomplete, and so the static mode has a shape even if nobody styles it.
   ---------------------------------------------------------------------- */

function injectFallbackCSS() {
  if (document.getElementById('ny-journey-fallback')) return;
  const style = document.createElement('style');
  style.id = 'ny-journey-fallback';
  style.textContent = `
.journey__stack{display:block}
.journey__still{position:relative;display:block;margin:0;width:100%;aspect-ratio:16/9;overflow:hidden;background:#14161A}
.journey__still>img{display:block;width:100%;height:100%;object-fit:cover}
.journey__loader{opacity:0;pointer-events:none;transition:opacity .25s linear}
.journey__loader.is-visible{opacity:1}
`;
  document.head.insertBefore(style, document.head.firstChild);
}

/* The stage only needs a rescue size if css/site.css has not laid it out yet.
   Feature-detected rather than assumed, so we never fight the real stylesheet. */
function rescueStageLayout(stage, canvas) {
  const h = stage.getBoundingClientRect().height;
  if (h > 80) return;
  stage.style.position = 'relative';
  stage.style.height = '100vh';
  stage.style.overflow = 'hidden';
  stage.style.background = '#14161A';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

/* -------------------------------------------------------------------------
   STATIC MODE — reduced motion, or GSAP missing

   The journey becomes a normal-flow sequence: hub still, then each place's
   freeze-frame with its card. Cards are MOVED, not cloned, so assistive tech
   sees each place exactly once. The crossfade uses the Web Animations API
   because tokens.css clamps every CSS transition to 0.01ms under reduced
   motion — a plain opacity fade is the sanctioned reduced-motion substitute,
   and WAAPI is not affected by that clamp.
   ---------------------------------------------------------------------- */

class StaticJourney {
  constructor(section, opts) {
    this.section = section;
    this.opts = opts;
    this.homes = [];
    this.observer = null;
    this.build();
  }

  build() {
    const { section } = this;
    const stage = $('.journey__stage', section);
    const canvas = $('[data-journey-canvas]', section);
    const loader = $('[data-journey-loader]', section);

    section.setAttribute('data-journey-mode', 'static');
    section.classList.add('journey--static');
    // The section is sized for a pin it is no longer getting; inline height
    // release is the one thing that must beat whatever site.css says here.
    section.style.height = 'auto';
    section.style.minHeight = '0';
    if (loader) loader.classList.remove('is-visible');

    const stack = document.createElement('div');
    stack.className = 'journey__stack';
    stack.setAttribute('data-journey-stack', '');

    stack.appendChild(this.still('hub', hubPath(this.opts.small), 'Aerial map of New York'));

    for (const place of PLACES) {
      const fig = this.still(place.key, holdPath(place.key), place.alt);
      const card = $(`[data-card="${place.key}"]`, section);
      if (card) {
        this.homes.push([card, card.parentNode, card.nextSibling]);
        fig.appendChild(card);
        card.classList.add('is-active');
        card.setAttribute('aria-hidden', 'false');
      }
      stack.appendChild(fig);
    }

    // Hide the canvas shell rather than remove it, so scrub mode can come back
    // if the visitor turns reduced motion off.
    if (stage) {
      stage.style.display = 'none';
      stage.setAttribute('aria-hidden', 'true');
      stage.after(stack);
    } else {
      section.appendChild(stack);
    }
    if (canvas) canvas.setAttribute('aria-hidden', 'true');

    this.stack = stack;
    this.reveal();
  }

  still(key, src, alt) {
    const fig = document.createElement('figure');
    fig.className = 'journey__still';
    fig.setAttribute('data-still', key);
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.loading = key === 'hub' ? 'eager' : 'lazy';
    img.decoding = 'async';
    fig.appendChild(img);
    return fig;
  }

  reveal() {
    const figs = [...this.stack.querySelectorAll('.journey__still')];
    if (!('IntersectionObserver' in window) || !figs[0].animate) {
      figs.forEach((f) => f.classList.add('is-visible'));
      return;
    }
    figs.forEach((f) => {
      f.style.opacity = '0';
    });
    this.observer = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          obs.unobserve(e.target);
          e.target.classList.add('is-visible');
          e.target.style.opacity = '';
          e.target.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 700,
            easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            fill: 'backwards'
          });
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.06 }
    );
    figs.forEach((f) => this.observer.observe(f));
  }

  stillNodes() {
    return [...this.stack.querySelectorAll('.journey__still')];
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
    // Put the cards back exactly where the markup had them.
    for (const [card, parent, before] of this.homes) {
      card.classList.remove('is-active');
      card.setAttribute('aria-hidden', 'true');
      parent.insertBefore(card, before);
    }
    this.homes = [];
    if (this.stack) this.stack.remove();
    const stage = $('.journey__stage', this.section);
    if (stage) {
      stage.style.display = '';
      stage.removeAttribute('aria-hidden');
    }
    const canvas = $('[data-journey-canvas]', this.section);
    if (canvas) canvas.removeAttribute('aria-hidden');
    this.section.classList.remove('journey--static');
    this.section.style.height = '';
    this.section.style.minHeight = '';
    this.section.removeAttribute('data-journey-mode');
  }
}

/* -------------------------------------------------------------------------
   SCRUB MODE — the pinned canvas frame sequence
   ---------------------------------------------------------------------- */

class ScrubJourney {
  constructor(section, opts, dots) {
    this.section = section;
    this.opts = opts;
    this.dots = dots;
    this.canvas = $('[data-journey-canvas]', section);
    this.loader = $('[data-journey-loader]', section);
    this.cards = new Map();
    PLACES.forEach((p) => {
      const el = $(`[data-card="${p.key}"]`, section);
      if (el) this.cards.set(p.key, el);
    });

    this.stage = new Stage(this.canvas);
    this.store = new ClipStore(opts.set);
    const { segs, totalWeight } = buildSegments();
    this.segs = segs;
    this.totalWeight = totalWeight;

    this.scrub = { p: 0 };
    this.active = false;
    this.destroyed = false;
    this.raf = 0;
    this.stopAt = 0;
    this.needsMeasure = true;
    this.activeCard = null;
    this.lastExact = 0;   // previous fractional frame index (scrub speed)
    this.starvedSince = 0;
    this.loaderOn = false;
    this.hub = null;
    this.holds = new Map();    // dive last frame  — the HOLD image
    this.returns = new Map();  // pull-up last frame — what the next dive fades out of
    this.mapStarts = new Map(); // dive first frame — what the previous pull-up fades INTO

    section.setAttribute('data-journey-mode', 'scrub');
    section.classList.add('journey--scrub');

    this.boot();
  }

  /* One weight unit == one viewport height. Recomputed on every refresh, so
     the pacing survives resize and mobile URL-bar height changes. */
  distance() {
    const vh = Math.max(window.innerHeight, 560);
    return Math.round(this.totalWeight * vh);
  }

  async boot() {
    rescueStageLayout($('.journey__stage', this.section), this.canvas);
    this.stage.measure();
    this.watchSize();

    // Hub still is the poster: something real is on screen before any clip
    // exists. The four hold stills are ~130KB each and guarantee the HOLD
    // segments never blank, which also lets us free the dive clip early.
    this.hub = await loadImage(hubPath(this.opts.small));
    if (this.destroyed) return;
    // The hub still is park-dive's first frame, so it carries the dive's
    // start scale — otherwise the poster pops the moment the scrub takes over.
    if (this.hub) this.stage.draw(this.hub, DIVE_START_SCALE);

    this.setupScrollTrigger();
    this.start();

    /* Both seam stills per place stay resident for the whole journey. They are
       ~190KB each and they are what every dissolve paints FROM, so they must
       outlive the clips they came from — the store frees those as the visitor
       moves on. */
    PLACES.forEach(async (p) => {
      const [hold, ret, mapStart] = await Promise.all([
        loadImage(holdPath(p.key)),
        loadImage(returnPath(p.key)),
        loadImage(mapStartPath(p.key))
      ]);
      if (this.destroyed) return;
      if (hold) this.holds.set(p.key, hold);
      if (ret) this.returns.set(p.key, ret);
      if (mapStart) this.mapStarts.set(p.key, mapStart);
      if (hold || ret || mapStart) this.stage.dirty = true;
    });

    this.store.focusOn(0); // park-dive, immediately
  }

  /* Measuring the canvas is a forced layout read, so it happens on an actual
     size change rather than once per animation frame. */
  watchSize() {
    if (typeof ResizeObserver !== 'function') return;
    this.ro = new ResizeObserver(() => {
      this.needsMeasure = true;
      this.start();
    });
    this.ro.observe(this.canvas);
  }

  setupScrollTrigger() {
    const gsap = window.gsap;
    const ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });

    /* scrub needs a tween to smooth: a bare ScrollTrigger reports raw,
       unsmoothed progress. A one-property proxy tween is the cheapest way to
       get GSAP's scrub lerp, which the rAF loop then samples. */
    this.tl = gsap.timeline({
      scrollTrigger: {
        trigger: this.section,
        start: 'top top',
        end: () => `+=${this.distance()}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          this.active = self.isActive;
          if (self.isActive) this.start();
          else {
            this.stopAt = performance.now() + 900; // let the scrub settle out
            this.dots.setJourney(null);
          }
        },
        onRefresh: () => {
          this.needsMeasure = true;
          this.stage.dirty = true;
          this.start();
        }
      }
    });
    this.tl.to(this.scrub, { p: 1, ease: 'none', duration: 1 });
    this.st = this.tl.scrollTrigger;
    this.active = !!this.st.isActive;
  }

  start() {
    this.stopAt = Math.max(this.stopAt, performance.now() + 900);
    if (this.raf) return;
    const loop = (now) => {
      this.raf = 0;
      if (this.destroyed) return;
      this.tick();
      if (this.active || now < this.stopAt || this.stage.dirty) {
        this.raf = requestAnimationFrame(loop);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* Painting is driven from rAF reading the latest scrub value, never from the
     ScrollTrigger callback. Scroll events fire at unpredictable rates; this
     keeps at most one canvas write per displayed frame. */
  tick() {
    const { seg, t } = resolve(this.segs, this.scrub.p);

    this.store.focusOn(seg.clipIndex);
    this.dots.setJourney(this.active ? seg.dot : null);
    this.syncCard(seg, t);

    let img = null;
    let next = null;      // frame after img, for sub-frame interpolation
    let frac = 0;         // how far between img and next
    let frameKey = '';    // identifies exactly what is on the canvas
    let exactFrame = 0;   // fractional frame index, for measuring scrub speed
    let starved = false;

    if (seg.kind === 'hold') {
      // The hold still is byte-identical to the dive's last frame, so the
      // dive -> hold handoff has no seam, and the dive clip can be freed.
      img = this.holds.get(seg.place.key) || null;
      frameKey = `hold:${seg.place.key}`;
      if (!img) {
        starved = true;
        img = this.stage.last;
      }
    } else {
      /* Scroll progress -> a FRACTIONAL frame index. Rounding to the nearest
         whole frame is what made the scrub look stepped; the fraction is used
         below to dissolve into the next frame, so motion stays continuous
         between the 121 frames the source actually has. */
      const exact = seg.kind === 'hub'
        ? seg.frame
        : frameForT(CLIP_ORDER[seg.clipIndex], t);
      const clamped = exact < 0 ? 0 : exact > LAST_FRAME ? LAST_FRAME : exact;
      const i0 = Math.floor(clamped);
      const i1 = i0 < LAST_FRAME ? i0 + 1 : LAST_FRAME;
      frac = clamped - i0;
      exactFrame = clamped;

      const clip = this.store.get(seg.clipIndex);

      /* Keep the decode window travelling with the playhead, biased in the
         direction of travel. Without this the browser has evicted the frame we
         are about to draw and decodes it inline, which is the single largest
         source of stutter in this scrub. */
      if (clip) clip.warmAround(i0, clamped >= this.lastExact);

      img = clip ? clip.frame(i0) : null;
      next = clip && i1 !== i0 ? clip.frame(i1) : null;

      if (!img) {
        // Outran the loader: hold on the closest decoded frame rather than
        // flashing an empty canvas.
        starved = true;
        next = null;
        img = (clip && clip.nearest(i0)) || this.stage.last || this.hub;
      }
      frameKey = `${seg.clipIndex}:${i0}`;
    }

    this.syncLoader(starved);
    if (!img) return;

    if (this.needsMeasure) {
      this.needsMeasure = false;
      this.stage.measure();
    }

    /* A seam dissolve outranks sub-frame interpolation: at a clip boundary the
       image we are coming FROM is a different shot, and that discontinuity is
       far more visible than a fraction of a frame of motion.

       Everything below is keyed to FRAME position, never scroll position. The
       seam corrections were all measured against specific frames, and MOTION_LUT
       means a given scroll fraction no longer lands on the frame it used to —
       at the head of a pull-up it can already be 28 frames in. */
    const fp = exactFrame / LAST_FRAME;
    const zoom = scaleFor(seg, fp);

    /* At a join, the outgoing still and the incoming frame are each drawn at
       their own corrected scale, so the map is the same size on both sides and
       the short dissolve only has to hide the residual exposure difference. */
    if (seg.fadeFrom && exactFrame < SEAM_FADE_FRAMES && !starved) {
      const from = seg.fadeFrom.kind === 'hold'
        ? this.holds.get(seg.fadeFrom.key)
        : this.returns.get(seg.fadeFrom.key);
      if (from) {
        const a = exactFrame / SEAM_FADE_FRAMES;
        const key = `seam:${frameKey}:${a.toFixed(3)}`;
        if (!this.stage.dirty && key === this.stage.key) return;
        // Stills are cut from a clip end, which is always scale 1.
        this.stage.drawBlend(from, 1, img, zoom, a, key);
        return;
      }
    }

    /* The pull-up's tail dissolving into the next dive's first frame. The two
       are drawn at their own scales — pull-up ramping to 1, dive-start at
       DIVE_START_SCALE — so they are the same size, and only the perspective
       difference is left to hide under the motion blur. */
    if (seg.fadeTo && exactFrame > LAST_FRAME - SEAM_TAIL_FRAMES && !starved) {
      const into = this.mapStarts.get(seg.fadeTo.key);
      if (into) {
        const a = (exactFrame - (LAST_FRAME - SEAM_TAIL_FRAMES)) / SEAM_TAIL_FRAMES;
        const key = `tail:${frameKey}:${a.toFixed(3)}`;
        if (!this.stage.dirty && key === this.stage.key) return;
        this.stage.drawBlend(img, zoom, into, DIVE_START_SCALE, a, key);
        return;
      }
    }

    /* Sub-frame interpolation costs a second full-canvas draw, and it only buys
       anything while the scrub is crawling — that is when a single frame would
       otherwise sit still for many display frames and read as stepping. Above
       BLEND_MAX_SPEED the motion is carried by the frames themselves and the
       blend is invisible, so it is dropped and the fill rate is halved exactly
       when the scroll needs the headroom most. */
    const speed = Math.abs(exactFrame - this.lastExact);
    this.lastExact = exactFrame;

    /* Sub-frame interpolation, QUANTISED.

       Blending costs a second full-canvas draw, and at retina that canvas is
       5.2M pixels — measured, it is the difference between 0% and 5% dropped
       frames. The waste is that `frac` changes every single tick while the
       scrub crawls, so the canvas was being redrawn twice per frame to move the
       blend by an imperceptible amount.

       Snapping the blend to BLEND_STEPS levels keeps the smoothing that removes
       frame stepping while cutting those redraws by roughly the same factor,
       because the key only changes when a level is crossed. */
    if (next && speed < BLEND_MAX_SPEED) {
      const q = Math.round(frac * BLEND_STEPS) / BLEND_STEPS;
      if (q > 0.001 && q < 0.999) {
        const key = `${frameKey}+${q.toFixed(3)}@${zoom.toFixed(4)}`;
        if (!this.stage.dirty && key === this.stage.key) return;
        // Adjacent frames of one clip sit at effectively the same scale.
        this.stage.drawBlend(img, zoom, next, zoom, q, key);
        return;
      }
    }

    // The key carries the zoom as well as the frame: during a ramp the same
    // frame must be repainted as the scale moves, so identity alone is not
    // enough to decide the canvas is already correct.
    const key = `${frameKey}@${zoom.toFixed(4)}`;
    if (!this.stage.dirty && key === this.stage.key) return;
    this.stage.draw(img, zoom, key);
  }

  syncCard(seg, t) {
    const want = seg.kind === 'hold' && t >= CARD_IN && t <= CARD_OUT ? seg.place.key : null;
    if (want === this.activeCard) return;
    if (this.activeCard) {
      const prev = this.cards.get(this.activeCard);
      if (prev) {
        prev.classList.remove('is-active');
        prev.setAttribute('aria-hidden', 'true');
      }
    }
    this.activeCard = want;
    if (want) {
      const el = this.cards.get(want);
      if (el) {
        el.classList.add('is-active');
        el.setAttribute('aria-hidden', 'false');
      }
    }
  }

  syncLoader(starved) {
    if (!this.loader) return;
    const now = performance.now();
    if (!starved) this.starvedSince = 0;
    else if (!this.starvedSince) this.starvedSince = now;
    // Small grace period: a one-frame miss during a fast flick is not "loading".
    const on = starved && now - this.starvedSince > LOADER_DELAY;
    if (on === this.loaderOn) return;
    this.loaderOn = on;
    this.loader.classList.toggle('is-visible', on);
    this.section.classList.toggle('is-loading', on);
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.ro) this.ro.disconnect();
    if (this.st) this.st.kill(true);
    if (this.tl) this.tl.kill();
    this.store.releaseAll();
    this.cards.forEach((el) => {
      el.classList.remove('is-active');
      el.setAttribute('aria-hidden', 'true');
    });
    if (this.loader) this.loader.classList.remove('is-visible');
    this.section.classList.remove('journey--scrub', 'is-loading');
    this.section.removeAttribute('data-journey-mode');
    const stage = $('.journey__stage', this.section);
    if (stage) {
      stage.style.position = '';
      stage.style.height = '';
      stage.style.overflow = '';
      stage.style.background = '';
    }
  }
}

/* -------------------------------------------------------------------------
   Boot / rebuild
   ---------------------------------------------------------------------- */

const SPY_STATIC = [
  ['#hero', 'hero'],
  ['#about', 'hero'],
  ['#stats', 'statue'],
  ['#quote', 'outro'],
  ['#gallery', 'outro'],
  ['#outro', 'outro']
];

let current = null;
let dots = null;
let resizeTimer = 0;

function mount() {
  const section = $('[data-journey]');
  if (!section) return;

  if (current) {
    current.destroy();
    current = null;
  }

  const reduced = reduceMQ.matches;
  const opts = { small: wantsSmallFrames() };
  opts.set = opts.small ? 'frames-sm' : 'frames';

  const canvas = $('[data-journey-canvas]', section);
  const canScrub = hasGsap() && !reduced && !!canvas && !!canvas.getContext;

  if (canScrub) {
    current = new ScrubJourney(section, opts, dots);
    dots.watch(SPY_STATIC);
  } else {
    const journey = new StaticJourney(section, opts);
    current = journey;
    // In static mode the stills themselves drive the place dots.
    const pairs = SPY_STATIC.slice();
    journey.stillNodes().forEach((fig) => {
      const key = fig.getAttribute('data-still');
      if (key !== 'hub') pairs.push([fig, key]);
    });
    dots.watch(pairs);
    dots.setJourney(null);
  }
}

function init() {
  injectFallbackCSS();
  dots = new Dots();
  mount();

  // Degrade (or upgrade) live when the preference flips.
  const onPref = () => mount();
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onPref);
  else if (reduceMQ.addListener) reduceMQ.addListener(onPref);

  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      if (current instanceof ScrubJourney) {
        current.needsMeasure = true;
        current.stage.dirty = true;
        current.start();
      }
    }, 180);
  };
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });

  // Fonts and late images change layout; one refresh once everything settles.
  window.addEventListener('load', () => {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
