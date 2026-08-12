# Design

<!-- impeccable:design-schema 1 -->

Durable visual system for **NEW YORK**. Shared source of truth — every agent
working on this project builds against this file. Product truth lives in
[PRODUCT.md](PRODUCT.md).

## Direction contract

**THESIS** — The page is a *light room around dark windows*. The city is only
ever seen through apertures: the knockout wordmark, the pinned journey canvas,
the gallery frames. Everything between them is quiet warm paper. It refuses the
category default of a full-bleed dark cinematic site with white text floating
over video.

**OWN-WORLD** — Warm paper ground (`#F5F3EF`) with near-black ink. Dark media
inset into it, never bleeding to the page edge except in the two moments that
earn it (hero, quote). Chrome is rounded and minimal — a dark frosted nav pill,
soft rounded buttons, no glow and no ornament. The architectural language
(zero radius, hairline frame, notched top-right corner, solid ink bar down the
left edge) is scoped to the **journey place cards only**; see the SHAPE
CONTRACT below. One restrained cool grey is the only non-neutral.

**STORY** — The visitor understands within one viewport that this is a journey
through New York, not a page about it. They believe it when scroll physically
dives them into Central Park and yanks them back out. They finish the journey
and make contact.

**FIRST VIEWPORT** — Full-bleed `front-main.png`, slightly desaturated and
lifted toward paper at the edges. NEW YORK set enormous and tall across the
lower-middle, filled with the same photograph aligned to the viewport so the
letters reveal the city behind them at half transparency. Headline and subline
sit above the wordmark at left; two actions below it at left. Corner tag top-right,
scroll hint bottom-centre.

**FORM** — Precisely specified by the brief; no concept tournament run. Pinned
aesthetics honored verbatim: light tones, Archivo Black display, Inter body,
notched sharp cards, no gold or brass.

## Color

Strategy: **Restrained** — neutrals plus a single cool grey. The media supplies
all saturation; the chrome stays out of its way. This is a light surface because
the physical scene is someone evaluating craft in daylight on a laptop, and
because a dark UI would make the dark media disappear into it rather than sit
inside it.

```css
--paper:        #F5F3EF;  /* warm off-white, the ground */
--paper-deep:   #EBE8E2;  /* alternating section bands, card fills on paper */
--paper-edge:   #DEDAD3;  /* hairline on paper, dividers */
--ink:          #14161A;  /* near-black, primary text, accent bars */
--ink-soft:     #575D65;  /* secondary text */
--ink-faint:    #91979F;  /* labels, meta, inactive dots */
--cool:         #6E7A85;  /* the single restrained cool neutral */
--frost:        rgba(245,243,239,0.90); /* card surface over dark media */
--frost-edge:   rgba(20,22,26,0.16);    /* hairline on frosted surfaces */
```

**No gold, brass, amber, or warm metallic anywhere.** Explicitly ruled out by the
brief. The one permitted non-neutral is `--cool`.

## Type

| Role | Face | Treatment |
|---|---|---|
| Display | **Archivo Black** | `NEW YORK`, `THAT'S NEW YORK`, stat numerals. Set TALL: `transform: scaleY(1.14)` with `letter-spacing: -0.02em`. Stretched vertically, never wider. |
| Body / UI | **Inter** | Everything else. |
| Labels | Inter | `0.72rem`, `letter-spacing: 0.16em`, uppercase, `--ink-faint`. |

Both faces are pinned by the brief. Fluid scale via `clamp()`; the wordmark is
`clamp(4rem, 19vw, 20rem)`.

Rhythm: more space above a heading than below it. One spacing scale throughout,
based on `0.5rem` steps.

## Components

### The notch

The signature. A 22px angled cut on the **top-right** corner, recurring on cards,
the nav pill's right end, and primary buttons.

```css
--notch: 22px;
clip-path: polygon(0 0, calc(100% - var(--notch)) 0, 100% var(--notch), 100% 100%, 0 100%);
```

A `clip-path` erases borders, so the hairline frame is built as two stacked
clipped layers: an outer element filled with the hairline color, and an inner
element inset by 1px carrying the same `clip-path` and the surface fill. Never
fake this with a `border` — it will not follow the cut.

### Place card

Zero radius. Notched top-right. Hairline frame following the cut. A **3px solid
`--ink` bar down the full left edge**. Sits over dark video, so the surface is
`--frost` with `backdrop-filter: blur(20px) saturate(1.1)` and `--ink` text —
light and frosted, dark type, which measured well above 4.5:1 against every
tested frame. Contents: index numeral + place + borough on one label line,
uppercase place name in display, a sentence of body, then a `FACT:` line
separated by a hairline rule.

### Nav

Fixed, pill-shaped, **light** frosted (`--frost` + blur), hairline edge, `--ink`
links. Not a dark bar. Right end carries the notch. Links: About · Places ·
The City · Explore, plus a Get in Touch button.

### Progress dots

Right edge, vertically centred, 6 dots: hero, 4 places, outro. `--ink-faint`
inactive, `--ink` active with a 1px ring. Hidden under 900px.

## Motion

Slow, smooth, unhurried. Soft easing everywhere.

```css
--ease-soft: cubic-bezier(0.22, 0.61, 0.36, 1);   /* default reveal */
--ease-out:  cubic-bezier(0.16, 1, 0.3, 1);       /* card entrance */
--dur-slow:  1.1s;
--dur-med:   0.7s;
```

The journey's pulse is load-bearing: **dives are slow** (long scroll distance),
**pull-ups are fast** (roughly one third the distance) so they read as a yank.
Flattening this asymmetry destroys the concept.

Reveals are orchestrated, not scattered. No hover effects that move layout. Spend
boldness on the hero knockout and the journey; everything else stays quiet.

### Reduced motion

`prefers-reduced-motion: reduce` replaces the scrubbed journey entirely: each
place shows its freeze-frame still (`stills/<place>-hold.jpg`) with a gentle
opacity crossfade and its card. No pin, no scrub, no dive, no yank. Count-ups
render final values immediately. This is a vestibular-safety requirement — the
dive/yank motion is precisely what triggers it.

## Layout

- Max content width `1280px`, gutters `clamp(1.25rem, 5vw, 5rem)`.
- Sections alternate `--paper` / `--paper-deep` to band the page.
- Two moments break the frame to full-bleed: the hero and the quote. Everything
  else stays inset so the dark media reads as a window in a light wall.
- Breakpoints: `1024px`, `760px`, `520px`.
- The pinned journey degrades on touch/small screens — see PRODUCT.md constraints.

## SHAPE CONTRACT — user-locked, do not revisit

The user reviewed a notched/angular treatment across the nav and buttons and
**rejected it**, then asked explicitly that design-system and `impeccable` passes
stop restyling these back. This section outranks aesthetic judgement, detector
findings, and anything above it in this file. Changing it requires the user.

| Element | Shape | Treatment |
|---|---|---|
| Nav pill | `--r-pill` (999px) | Dark translucent frosted. `NYC` bold left, links normal weight, light. |
| Nav "Get in Touch" | `--r-pill` | White fill, dark text. |
| "Start the journey" | `--r-btn` (10px) | Light fill, dark text. |
| "Learn more →" | none | Plain text plus an arrow. No box, no border, no fill. |
| Gallery tiles, all other chrome | rounded | Clean and minimal. |
| **Journey place cards** | **notched** | The **only** notched element on the site. Keep it. |

**Banned outright, everywhere except where noted:**

- **No notch or `clip-path` on anything but `.card__frame` / `.card__surface`.**
- **No glow, no shine, no outer `box-shadow`, no `text-shadow`.** A page-wide
  sweep asserts zero of these; see "Verifying" below.
- **No gradients on nav or buttons.**
- **No gold/brass/amber.** Original brief constraint, still binding.

## Other prohibitions

- **The hero photograph is sharp.** No blur, no filter, no scale on
  `.hero__media`. A previous half-blur treatment was rejected.

  **Amended — the focus falloff is intentional. Do not remove it.** The user
  later asked for a depth-of-field transition into "About the journey", so the
  hero now defocuses toward its own bottom edge. What the original rule was
  protecting is intact and still enforced:

  - `.hero__media` carries **no `filter`** and is never scaled or washed;
    `shape-check.py` still asserts this, and it still passes.
  - The blur is `backdrop-filter` on `.hero__defocus`, three stacked layers with
    staggered masks, starting at **52%** — below the headline and subline.
  - The top half of the photograph is untouched. Measured sharpness by band with
    the falloff at full strength: 25% unchanged at 1.96, 80% falls 3.68 → 0.39.

  `backdrop-filter` rather than a blurred duplicate is a correctness choice, not
  a preference: a duplicate would have to register pixel-exactly with the
  original or the crossfade shows a shift. There is only ever one image here.
- **No white/paper wash over the hero — REVERSED for the bottom `--melt` only,
  on an explicit decision.** The rule stands for the photograph as a whole:
  nothing washes, tints or lifts the image above `--melt` from its bottom edge.
  That band was 26% when the reversal was granted and is now **4svh (~36px)** —
  the reversal has only ever been narrowed, never widened.

  Below that, paper now fades in (`.hero__melt`) so the hero's last row and the
  About section's first row are the same colour. This was decided after
  measuring that no alternative could work — the photograph's own bottom edge is
  simply dark:

  | hero bottom | median luma |
  |---|---|
  | veil as shipped | 16.0 |
  | veil released entirely | 41.1 |
  | `--paper-deep` target | **232.2** |

  Releasing the scrim moves the median from 16 to 41 against a target of 232, so
  scrim tuning could never close the gap; only adding paper does. Measured join
  across the section boundary afterwards: **1.9–2.0 luma at every viewport**.

  Two consequences, both accepted:
  - `.hero__veil` now releases below 32% (it is unchanged above that, so the
    headline, subline and buttons keep the exact scrim they were measured on).
  - The scroll hint is dark, not light, since it sits inside the melt. It moved
    from 10.19:1 to 5.63:1 — still above the floor.

### The two section transitions are one technique, mirrored

`hero → about` and `about → journey` must match. Both dissolve between the
photograph and `--paper-deep`, both end on that colour exactly (via `color-mix`
on the token, so no seam is possible), and both ease.

**One length: `--melt`, 4svh.** Both seams read their band from the same token,
so they are the same size in *pixels* rather than the same percentage of two
boxes that merely happen to both be `100svh`. The hero can outgrow `100svh` when
its copy wraps; the stage cannot. Three places consume it — `.hero__melt`,
`.journey__melt`, and static mode's first still — so there is one dial.

**Curve: `1 - smoothstep`, flat at both ends. Not a power curve.** An earlier
revision of this file argued for `t^2` on the grounds that smoothstep's slow end
crawls and reads as glow. That was tried and it is wrong in the direction that
matters: a power curve is steepest exactly at the *paper* end, which is the end
touching the next section, and it reopened the seam to **15.8 luma**. Being flat
at both ends is the property that makes the join invisible. Composite luma is
`a*paper + (1-a)*photo`, linear in `a`, so nothing can overshoot paper — there
is no hotspot to create, and darkening the fade cannot help.

**Haze is distance, not brightness — measured twice.** Across the full width the
99th-percentile pixel never exceeds `--paper-deep`; the brightest row mean sits
*below* paper (−0.5 to −1.0 luma) and the worst single pixel is +3.2. With the
gradient switched off, the hero's bottom 300px is a flat 48–67 luma with no ramp
at all, so neither the veil release nor the focus falloff brightens anything.
What reads as fog is the distance spent half-faded, so band length is the only
dial. Washed zone (15–85% alpha) against band:

| band | washed zone | steepest 1px step | |
|---|---|---|---|
| 8svh | 37px | 3.8 luma | the version that read as fog |
| 6svh | 28px | — | |
| **4svh** | **19px** | **7.6 luma** | **chosen** |
| 2.5svh | 12px | 12.2 luma | reads as an edge, not a fade |

All four sit far under the ~50 luma/px where a step becomes visible, so the
floor is perceptual, not numeric: below about 3svh the eye resolves the band as
a line. Verified at 1440×900 and at 390×844.

**The journey side scales a gradient's REACH, not a sheet's opacity.** Fading a
uniform cover made the stage's top edge semi-transparent the moment it appeared,
against a fully-opaque About section above it: a 64.0-luma jump in one pixel.
`--arrive` scales the gradient's extent instead, so the top edge stays exactly
paper while the map takes over from the bottom upward.

**`--arrive` is `sqrt(1 - s)`, not linear — and shortening the band is what
made that necessary.** Because the band can only retract and never fade, a
linear retraction ends by compressing a full-strength paper-to-map fade into a
sub-pixel band: a hard line, the exact artefact the overlay exists to prevent.
It was invisible at the old 16% reach and appeared as soon as the reach was cut.
Worst 1px step below the join, nav excluded from the sample:

| reach | travel 0.35 | 0.20 | 0.10 | 0.05 | worst |
|---|---|---|---|---|---|
| linear × 4svh | 11.4 | 19.8 | 35.9 | **61.5** | 61.5 — visible edge |
| linear × 16svh | 3.9 | 5.5 | 10.1 | 19.9 | 19.9 — the foggy one |
| **sqrt × 4svh** | 7.9 | 9.2 | 12.5 | 17.9 | **17.9 — chosen** |

`sqrt` is steeper than the old 16svh reach through the middle and gentler right
at the end, so its worst step across the whole travel is the lowest of the three
while the band runs ~3× tighter through mid-travel, which is where the fog was
visible. At full extent `sqrt(1) = 1`, so the two seams still match exactly.

It also cannot blend inside the About section. The journey draws its frame
height-fit and zoomed by `DIVE_START_SCALE`; any box in the About section is
width-fit at a different crop, so the map arrived at one size and changed size at
the boundary.

Measured joins, both transitions, every viewport: **1.1–2.4 luma.** Static mode
needs its own copy of the second one, because reduced motion swaps the canvas for
stills in normal flow and leaves `.journey__melt` inside a hidden stage —
and `.journey--static` must drop the ink background, since the stack is inset and
ink there produced a 212-luma cut before the first image began.

That copy had drifted. It was **46% of the still (294px, eight times the scrub
seam) on the rejected `(1 - u)^2` curve**, so reduced-motion visitors were still
getting both the fog and the steep-at-the-paper-end seam that the other two modes
had already been fixed for. It is now the same `--melt` length and the same
`1 - smoothstep` ladder as the other two: measured **6.2 luma** at the first
still's top edge.
- **The wordmark is plain grey at ~30% opacity.** No knockout, no
  `background-clip: text`, no split, no mask, no image fill.
- **No glassmorphism on paper.** Frost only where a surface sits over dark
  media (nav, journey cards).
- **No scattered hover micro-effects.** Motion is orchestrated at section scale.

## SEAM GEOMETRY — the clips do not share framing

The source clips were generated at different framings, so the map is a
different SIZE on each side of a join. Measured by searching scale and offset
for best alignment at every seam; all four places agree to within 0.01, so this
is systematic:

| join | measured correction |
|---|---|
| dive END → pull-up START | pull-up × **1.06** |
| pull-up END → next dive START | pull-up × **0.76** |

A pull-up therefore drifts ~1.32× tighter than where the next dive begins. One
constant scale cannot fix both ends, so the correction **ramps** across each
clip, normalised to stay ≥ 1 so it always crops inward (scaling below 1 would
expose the frame edge):

- dive ramps `1.316 → 1.000`
- pull-up ramps `1.060 → 1.000`

Both joins then match: at the place, dive-end 1.000 vs pull-up-start 1.060 —
the measured correction. At the map, pull-up-end 1.000 vs dive-start 1.316, and
0.76 × 1.316 = 1.000. Constants live in `journey.js` as `DIVE_START_SCALE` and
`PULLUP_START_SCALE`.

Two consequences that are easy to break:

- **Each side of a seam crossfade is drawn at its own zoom.** Blending both at a
  shared scale dissolves one size into another and reproduces the pop.
- **The hub still carries `DIVE_START_SCALE`**, because it is park-dive's first
  frame. Drawing it at 1.0 makes the poster jump the moment the scrub takes over.

### What the scale match cannot remove

Measured on the visible region of each side, after correcting scale:

| | result |
|---|---|
| exposure | per-channel gain **0.99–1.01** — already matched, nothing to correct |
| translation | best alignment is **dx=0, dy=0** over a wide search — nothing to correct |
| residual | **~22 mean levels**, and it responds to neither scale nor translation |

That residual is **perspective**. The map shots were flown at different
altitudes, so the foreshortening differs and no 2D transform reconciles them.
Do not attempt an exposure fix here — the exposure is already matched, and a
colour correction would introduce a mismatch rather than remove one.

It can only be hidden, so it is hidden where the eye cannot resolve it: the
pull-up's **tail** (`SEAM_TAIL_FRAMES = 4`) dissolves into the next dive's
first frame, which is the fastest, most motion-blurred stretch of the whole
journey. The dive then opens on the image already on screen and needs no fade
of its own. Putting this blend at the *start of a dive* instead — slow, sharp,
and closely watched — is what made it visible before.

### The seam defect is a VELOCITY step, not a position jump

Worth knowing before chasing this again. Measured across the join with the
scrub fully settled, the best-fit displacement between consecutive samples is
`dx=0, dy=0` everywhere — nothing ever moves sideways. What was visible was
motion **dying and restarting**:

```
before   10.5 → 6.2 → 6.7 → 4.5 → 2.4 | 11.1    stall, then jerk
after    18.2 → 13.7 → 19.6 → 9.4     | 11.1    smooth deceleration
```

Two compounding causes, both fixed:

1. **The footage settles** — and not just on pull-ups. Measured mean absolute
   frame-to-frame difference, by 10-frame bucket, on every shipped clip:

   ```
   park-dive      6 → 22 → 4       park-pullup     2 → 33 → 4
   bridge-dive   19 → 33 → 3       bridge-pullup   ~ → 30 → 4
   times-dive    12 → 19 → 4       times-pullup    9 → 19 → 4
   statue-dive    5 → 28 → 1       statue-pullup   ~ → 33 → 5
   ```

   Every clip is a bell curve, because the camera eases in, runs, and settles.
   Mid-clip motion is **4× to 25×** the motion over the last five frames —
   `statue-dive` ends 24.7× slower than its middle. This was originally read as
   a pull-up problem and fixed with a pull-up-only exponent
   (`PULLUP_FRAME_EASE = 1.5`), which left all four dives crawling into their
   hold.

   Those eases were authored for linear playback at 24fps. In a scrub the
   visitor supplies the timing, so replaying the built-in ease on top of their
   scrolling is precisely what reads as "crawls, then blasts past".

   `MOTION_LUT` now inverts each clip's cumulative-motion curve, so equal
   scroll buys equal **screen** motion. Per-clip scroll distance is unchanged —
   only its distribution within the clip — so the even PACING contract still
   holds. Regenerate with `scripts/motion-table.py`.

   **Consequence: frame position and scroll position are no longer the same
   number.** Anything measured against a specific frame — the scale ramp, both
   seam windows — must be keyed to the frame index, not to `t`. At the head of
   a pull-up, `t = 0.03` is already 28 frames in.
2. **A long blend into a still kills motion.** The tail target is a static
   image, so while the blend runs the moving frames are mixed toward something
   that is not moving. At 14 frames this was clearly visible; 4 is enough to
   cover the perspective mismatch without flattening the motion.

If a seam ever looks wrong again, measure displacement AND inter-sample motion
before assuming it is a position or colour problem. And allow the scrub to
settle (~1.7s at `scrub: 0.6`) before sampling — a shorter wait measures the
test's own lag and invents a shift that is not there.

The place join (dive end → pull-up start) is a different case: those frames
genuinely nearly match (residual 6–15), so it keeps a short 5-frame fade.

Re-measure with the alignment search if the clips are ever re-rendered, and
verify with `scripts/scroll-check.py` (seam spikes must stay at 0).

## IMAGE QUALITY — benchmark on the GPU, not in headless

**Measure performance with `--use-angle=metal --enable-gpu`.** Default headless
Chromium rasterises with SwiftShader, in software, where cost scales with pixel
count. That difference is not academic — it produced a wrong conclusion once:

| canvas | SwiftShader | Apple M2 |
|---|---|---|
| 2880×1800 (DPR 2) | **54% frames dropped** | **0–1% dropped** |

On the strength of the SwiftShader number the canvas was capped to the source
frame width, which made the scrub visibly soft on every retina screen for no
benefit. The cap is gone. `Stage.measure()` uses `devicePixelRatio` capped at 2,
full stop.

### Sharpness rules

1. **Export frames at native size.** Each clip keeps whatever the shared 16:9
   crop leaves it (dives 1664–1856 wide, pull-ups 1671). They are drawn
   cover-fit and never need to agree on size. `-q:v 2`.
2. **Unsharp at native size, before the browser touches them.** This is the
   biggest single win. The footage is only 936–1044px tall after cropping while
   a retina 900px viewport needs 1800 device px, so a ~1.9× upscale is
   unavoidable. Pre-compensating scores better on fine detail than a lanczos
   resize of the original, at no payload cost:

   | approach | detail |
   |---|---|
   | native → browser upscale | 4.99 |
   | **native + unsharp 0.6 → browser upscale** | **7.03** |
   | 1.5× lanczos pre-upscale (larger files) | 5.33 |
   | lanczos direct (reference) | 6.21 |

   0.6 was chosen over 1.0 by eye; 1.0 looks over-processed on foliage.
3. **Sub-frame blending stays adaptive** — it doubles fill cost and only helps
   while the scrub crawls, so it is skipped above `BLEND_MAX_SPEED` (1.0 frames
   per tick). Seam dissolves are exempt; a cut is worse than a dropped frame.

   Both blend constants were re-derived once `MOTION_LUT` landed, because a
   constant frame velocity interacts with them in a way a varying one did not:

   | constant | was | now | why |
   |---|---|---|---|
   | `BLEND_MAX_SPEED` | 1.2 | **1.0** | At one frame per tick every tick already shows a new source frame, so there is nothing to interpolate. Under the linear mapping velocity swung far either side of the threshold; under `MOTION_LUT` it sits at a median of 1.19 and parked the whole journey just inside 1.2, blending 51% of ticks. |
   | `BLEND_STEPS` | 4 | **2** | Below the threshold the blend's redraw frequency is `speed × BLEND_STEPS`, so at slow scroll this sets the redraw rate directly — and each redraw is two full-canvas draws. |

   Together: 4% dropped → 1%, with a slow-scroll stepping test still reporting
   0/89 frozen samples.

Result, measured like-for-like against the raw mp4 at the same on-screen size:
**1.08× at mid-dive, 1.37× at the hold** — at or above parity with playing the
source.

### There is no 1080p source

The clips are 2208×936 and 1856×1112, and the two aspect ratios must share a
16:9 crop. Nothing in the pipeline can produce more detail than that, and asking
for "1920×1080 frames" would mean upscaling, not recovering.

Likewise `fps=30` adds nothing: the source is 24fps with 121 real frames.
Extracting at 30fps yields 151 frames of which **30 are byte-identical
duplicates** — no new motion, 25% more bytes.

### What actually costs frames — measured, in order

Everything below was tested by isolation, on the real GPU. Most of the obvious
suspects cost nothing, so do not "optimise" them again:

| suspect | effect on dropped frames |
|---|---|
| payload 215MB → 389MB (`-q:v 4` → `2`) | none — re-confirmed, 1% → 1% |
| decode window / warming frames | none |
| `backdrop-filter` on the cards | none (6% → 5%) |
| cards hidden entirely | none |
| never releasing clips | none |
| load concurrency 6 → 2 | none |
| GSAP pin + scrub alone, no canvas | 0% — not GSAP |
| a fully warm second pass, zero loading | still 5% — not loading |
| **canvas 2880×1800 → 1440×900** | **5% → 1%** |
| **sub-frame blending disabled at retina** | **5% → 0%** |

So the binding cost is **canvas fill**, and blending doubles it by drawing the
full canvas twice. The fix keeps both sharpness and smoothness: the blend is
**quantised** to `BLEND_STEPS` levels, so it still removes frame stepping but
redraws only when a level is crossed instead of every tick.

Result: **1% dropped desktop, 0% mobile, median 16.7ms / p95 18.5ms**, at
**1.02× the raw mp4's sharpness**.

Verified across four scroll speeds in both directions — the mapping is pure, so
reverse costs the same as forward, and the numbers say so:

```
speed    dir        median     p95    dropped
slow     forward     16.7ms   18.6ms    2%
slow     reverse     16.7ms   18.6ms    2%
normal   forward     16.7ms   18.6ms    1%
normal   reverse     16.7ms   18.6ms    0%
fast     forward     16.7ms   18.6ms    2%
fast     reverse     16.7ms   18.5ms    1%
flick    forward     16.7ms   18.6ms    1%
flick    reverse     16.7ms   18.7ms    2%
```

### Two measurement traps that produced wrong fixes

1. **Headless Chromium defaults to SwiftShader**, a software rasteriser, where
   a retina canvas drops ~2/3 of frames. That reading once justified capping the
   canvas, which shipped a visibly soft scrub for no reason. `scroll-check.py`
   now always launches with `--use-angle=metal --enable-gpu`.
2. **`getImageData` on a retina canvas is a ~20MB GPU readback.** Sampling
   pixels inside the timed scroll made the script report 65% dropped frames
   that did not exist. Timing and pixel sampling now run as separate passes.

### Cost

Frames total ~389MB (plus a 184MB small set), ~43–60MB per clip at `-q:v 2`.
Lazy loading holds a 3-clip window.

`-q:v 2` is affordable for a reason worth keeping in mind: **decoded memory is
`width × height × 4` regardless of encoder quality**, so this number cannot
touch the smoothness budget at all. It moves download time only (~164ms → ~250ms
per clip), and only three clips are ever resident. Isolation re-confirmed it:
q4 → q2 left the drop rate at 1%.

Re-run `scripts/scroll-check.py` after any change to frame size, canvas sizing,
or the draw path, and `scripts/boundary-check.py` after any change to the
segment timeline, the scale ramps, or `MOTION_LUT`.

## Verifying

`scripts/qa.py` covers desktop/mobile/reduced. The shape and effects contract is
machine-checkable — a sweep over every computed style asserting no outer
box-shadow, no text-shadow, no gradient on nav/buttons, and no `clip-path`
outside `.card`. Run it after any styling change.

## Assets

Media is referenced from `../main scroll folder/` and never copied into the
project root. Paths encode spaces as `%20`. See CLAUDE.md for the full asset
table and the frame-pipeline layout.
