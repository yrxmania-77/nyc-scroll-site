# NYC COMPACTION

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

It is the **condensed** map: enough to be productive in one read. `CLAUDE.md` is
the long form, and carries the measurements and the mistakes behind every
decision summarised here. When the two disagree, `CLAUDE.md` is newer.

## What this is

A single-page, scroll-driven site about New York. Vanilla HTML/CSS/JS — **no
build step, no framework, no `package.json`, no test suite.** Verification is
done by driving a real browser.

Live at <https://yrxmania-77.github.io/nyc-scroll-site/>, deployed from `main`.

| Path | Role |
|---|---|
| `NYC Folder/` | All code: `index.html`, `css/`, `js/`, `scripts/`, docs |
| `main scroll folder/` | All media, source **and** derived. Never copy media out. |
| `NYC Folder/main scroll folder` | **Symlink** to `../main scroll folder`. Do not delete. |

Media URLs omit `../` and resolve through that symlink; spaces are `%20`. GitHub
Pages does not follow symlinks, so `.github/workflows/pages.yml` *assembles* a
real tree at deploy and asserts 8 clips / 968 frames before publishing.

## Commands

Everything assumes the server is already running.

```bash
python3 "NYC Folder/scripts/serve.py"      # -> localhost:8080/NYC%20Folder/index.html
                                           # NOT python3 -m http.server: no cache busting
# from NYC Folder/
python3 scripts/qa.py [desktop|mobile|reduced]    # console errors, failed requests
python3 scripts/scroll-check.py [desktop|mobile]  # smoothness, seams, pacing
python3 scripts/boundary-check.py                 # pops at segment joins
python3 scripts/shape-check.py                    # the user-locked shape contract
python3 scripts/journey-profile.py [desktop|mobile] [slow|fast]   # PER-SEGMENT
python3 scripts/boot-profile.py [local|live] [mbps]               # cold load
python3 scripts/motion-table.py                   # regenerate MOTION_LUT
bash   scripts/media-pipeline.sh                  # re-export ALL frames (~5-10 min)
```

Run `scroll-check` after touching frame size, canvas sizing or the draw path;
`boundary-check` after the segment timeline, scale ramps or `MOTION_LUT`;
`shape-check` after any styling change.

Two harness traps: **never open `index.html` as `file://`** (ES modules and
fonts are CORS-blocked, the journey renders black), and **never wait for
`networkidle`** — frames stream continuously, so it never fires. Use
`wait_until="commit"`.

## Architecture: scroll position to pixels

`js/journey.js` (1535 lines) owns the pinned journey; `js/site.js` (302) owns
everything else. They share `css/tokens.css` → `css/site.css`.

**1. Mode.** Chosen at boot, rebuilt if `prefers-reduced-motion` changes:
`scrub` (GSAP + motion allowed, pinned canvas) or `static` (stills in normal
flow). A `BLANK` canvas in `qa.py`'s reduced run is *correct*. Static mode needs
its own copy of anything built for the pinned stage.

**2. Timeline.** One pinned ScrollTrigger spans ~19 viewports. Progress →
`(segment, t)` → `(clip, frame)`, and the mapping is **pure** — which is why
reverse scrolling works for free. Segments are `hub`, then `dive → hold →
pullup` per place ×4, then a tail hub. Every clip is exactly 121 frames, so the
weights in `W` *are* the rate.

`MOTION_LUT` then inverts each clip's measured cumulative-motion curve so equal
scroll buys equal *screen* motion. **Consequence: scroll position and frame
position are different numbers.** Anything keyed to a specific frame — scale
ramps, seam windows — must use the frame index, never `t`.

**3. Delivery** (`ClipStore`) — the part that most often looks like something
else. One shared, priority-ordered queue serves the clip nearest the playhead
first; there is no per-clip worker pool. A 3-clip window is retained
(`KEEP_BACK`/`KEEP_AHEAD`) and `Clip.warmAround()` keeps ~30 frames decoded via
`img.decode()`.

Frames are HTMLImageElements **deliberately, not ImageBitmaps**: measured,
`createImageBitmap` takes dropped frames from 1% to 8–13% because each call
allocates a fresh full-size copy that contends with the main thread. `decode()`
populates the browser's own cache instead, which the compositor draws from.

Two triggers downgrade to the 1280×720 `frames-sm` set when the link cannot
keep up (sticky, never upgrades back): `#probe` projects throughput from the
first 14 frames of clip 0 at boot, and `#checkPace` catches it mid-journey if a
clip is under 75% loaded after a full clip transition. Eligibility is counted in
**clip transitions, not milliseconds** — the visitor sets that timescale.

**4. Rendering.** `Stage` draws cover-fit to a canvas at `devicePixelRatio × CSS`
capped at 2. `ScrubJourney.tick()` runs in its own rAF loop reading the latest
scrub value — never from the ScrollTrigger callback — and skips the draw when
nothing changed. Three corrections layer on: a per-clip **scale ramp** (the
source clips disagree on framing), a **seam dissolve** in the pull-up's blurred
tail (they disagree on perspective), and **quantised sub-frame blending**.

## The rules that are not preferences

- **The sources are 24fps.** Genuine 60fps motion needs re-rendered sources.
  Do not fake it with duplicate frames.
- **Every boundary is a hard cut**, by explicit user decision after several
  rounds: `hero → about` at 179.8 luma, `about → journey` at ~95.
  `shape-check.py` fails if `.hero__melt` or `.journey__melt` reappears.
- **No blur anywhere in the hero, and no filter on `.hero__media`.** Enforced.
- **`#about` carries the user's image with no blur, overlay or filter**; only
  `.about__media` may hold a mask, and both its edges must match.
- **No outer `box-shadow`, no notch outside `.card__frame`/`.card__surface`,
  no gradients on nav or buttons.** Swept page-wide by `shape-check.py`.
- **Never Git LFS** — Pages does not resolve pointers, every frame would 404.
- **Never re-export frames casually**: 1,936 files, ~570MB added to history
  permanently, against a repo already ~770MB of GitHub's 1GB soft warning.
- Copy is **real facts supplied by the user**. Do not rewrite or invent it.

## How to debug this codebase

Nearly every wrong turn here came from a plausible theory that a five-minute
measurement would have killed. Three specific ones, all paid for:

- **Benchmark with the GPU.** Headless Chromium defaults to SwiftShader, where a
  retina canvas drops ~2/3 of its frames. Every perf script passes
  `--use-angle=metal --enable-gpu`; any new one must too.
- **Aggregates hide progressive defects.** `scroll-check.py` averages the whole
  journey into one number, which completely hid a fault that only appeared after
  the third clip. Use `journey-profile.py` when something "degrades as you go".
- **Attribute a visual defect to a layer before editing one.** A fade reported
  at the bottom of `#about` belonged to `#journey`; three revisions went into
  the wrong element. Enumerate everything painting at the boundary and toggle
  each in turn.

Two content-vs-CSS traps worth internalising: an **out-of-focus image cannot be
sharpened in CSS**, and a **level gradient cannot look level over uneven
content** — both were reported as CSS bugs and neither was one.

## Where the detail lives

- `CLAUDE.md` — long form: every measurement, and the failures behind each rule.
- `NYC Folder/DESIGN.md` — the visual system and the binding contracts.
- `NYC Folder/PRODUCT.md` — product truth, real facts used as copy, a11y.
- `README.md` — public summary; why generated media is committed.

A Stop hook (`.claude/hooks/auto-push.sh`) commits and pushes after each task,
refusing above 200 staged files. Pushes to `main` deploy to Pages directly, so
anything left uncommitted ships under a generic message.
