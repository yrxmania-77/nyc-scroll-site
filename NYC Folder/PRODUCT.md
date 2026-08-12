# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Assumed, not confirmed** — the user was asked and did not answer; inferred from
the brief's own signals ("world-class", "awards-grade polish", a "Get in Touch"
CTA, and craft-first framing). Correct this section if wrong, since it drives
copy and CTA decisions.

Primary visitor: someone evaluating craft — a creative director, founder, or
design peer who has landed on the site and is judging, within seconds, whether
the work is exceptional. They arrive on desktop more often than mobile, scroll
immediately, and decide based on how the experience *feels* rather than what it
claims. Success is that they finish the journey and make contact.

## Product Purpose

A single-page, scroll-driven cinematic experience about New York. The city is
the subject; the demonstration of craft is the point. The site exists to move
someone through a journey — hero, a pinned dive-and-return sequence through four
places, then stats, a quote, a gallery, and a closing statement — and to leave
them impressed enough to reach out.

## Positioning

The mechanism is the pinned dive journey: scroll drives a scrubbed descent from
an aerial map into a place, holds while that place introduces itself, then yanks
back up to the map. Four places, one hub, all under scroll control in both
directions. The asymmetry is deliberate and load-bearing — dives are slow and
studied, pull-ups are fast and blurred — so the journey has a pulse rather than a
uniform speed. This is not a parallax landing page with video backgrounds.

## Operating Context

Consumed in one sitting, in a single scroll, usually on a trackpad or a phone.
There is no navigation to speak of beyond the journey itself and a few anchors.
The visitor cannot "use" this wrong; the only failure modes are jank, slow media,
and motion that makes them feel sick.

## Capabilities and Constraints

- Static single page. No backend, no build step, no framework.
- Vanilla HTML/CSS/JS with GSAP ScrollTrigger for the pinned journey.
- Scroll-scrubbed media is played as JPEG **frame sequences on canvas**, not
  `video.currentTime` seeking, because video seeking stutters badly on iOS Safari.
- Source clips are uniform: 24fps, 121 frames, 5.04s, H.264.
- **Source clips disagree on aspect ratio** — dives are 1856×1112 (1.67:1),
  pull-ups are 2196×940 (2.34:1). Both are centre-cropped to 16:9 in the frame
  pipeline; without this the frame visibly jumps at the dive→pull-up handoff.
- Desktop frame set is ~95MB total across 8 clips (~11MB per dive, ~8MB per
  pull-up). This is inherent to frame-sequence scrubbing and is managed by
  per-clip lazy loading, not by shrinking quality further — q7 was calibrated
  visually as the point where artifacts are not yet visible.
- A separate 900×506 mobile frame set exists for small screens.
- The toolchain's ffmpeg has **no libwebp encoder**, so all derived stills and
  frames are JPEG.

## Brand Commitments

Binding visual constraints stated by the user, recorded here without expansion:

- The site must read **light** — soft off-white / warm paper base for UI. Not a
  near-black site. Dark media sits inside light framing.
- **No gold or brass accent.** The accent stays neutral: near-black ink, soft
  greys, at most one restrained cool neutral.
- Wordmark is "NEW YORK" in a thick display face, set tall, as a half-transparent
  knockout filled with the hero photograph.
- Cards are sharp and architectural: zero border-radius, a notched top-right
  corner, a hairline frame following that shape, an accent bar down the left edge.
- Motion is slow, smooth, and unhurried with soft easing.

## Evidence on Hand

Real assets, all in `../main scroll folder/` (see CLAUDE.md for the full table):
hero image, aerial map, 4 dive clips, 4 pull-up clips, 5 gallery images.

Factual claims supplied by the user and treated as binding copy — these are
real-world facts about New York, not invented marketing claims:

- Central Park is 843 acres and entirely man-made, built in the 1850s–60s.
- The Brooklyn Bridge opened in 1883; 21 elephants were marched across it to
  demonstrate its safety.
- Times Square zoning requires bright illuminated signage.
- The Statue of Liberty has stood since 1886; a gift from France, its green is
  oxidation.
- Stats strip: 8.3M people, 5 boroughs, 843 acres of Central Park, 472 subway
  stations.

**No testimonials, clients, press, pricing, or company identity exist.** Future
work must not fabricate any.

## Product Principles

1. **The media leads; the interface recedes.** Chrome stays quiet and light so
   the photography and video carry all the color and drama.
2. **Motion has a pulse, not a speed.** Slow dives against fast pull-ups is the
   signature; flattening that asymmetry destroys the concept.
3. **Scroll is the only control.** Every beat of the journey is reversible by
   scrolling back. Nothing autoplays out from under the visitor.
4. **Smoothness outranks fidelity.** A dropped frame is more damaging than a
   slightly softer one. Budget bytes accordingly.
5. **Nothing fabricated.** Facts are real, contact is real, absences stay absent.

## Accessibility & Inclusion

- `prefers-reduced-motion` must be honored: the scrubbed journey is replaced by
  each place's freeze-frame still with a gentle crossfade and its card — no dive
  or pull-up motion. This is a medical requirement for vestibular disorders, not
  a nicety, and the dive/yank motion is exactly the kind that triggers it.
- Visible keyboard focus throughout; the journey must not trap keyboard users.
- Semantic structure so the content is readable without the motion layer.
- Contact CTA resolves to a real address: `yrxmania77@gmail.com` (confirmed).
