# NEW YORK

A single-page, scroll-driven site about New York. Vanilla HTML/CSS/JS — no build
step, no framework, no `package.json`.

The centrepiece is a pinned scroll journey that dives from an aerial map into
four places and yanks back up again: Central Park, the Brooklyn Bridge, Times
Square and the Statue of Liberty.

## Running it locally

```bash
python3 "NYC Folder/scripts/serve.py"
#   -> http://localhost:8080/NYC%20Folder/index.html
```

Use that rather than `python3 -m http.server`. The built-in server sends only
`Last-Modified`, so browsers cache heuristically — and with no build step there
are no hashed filenames to bust a stale copy. An edit lands, the page looks
untouched, and "it didn't work" is the natural but wrong conclusion.

**Do not open `index.html` as a `file://` URL.** ES modules and fonts are
CORS-blocked there, so `journey.js` never runs and the journey renders as a
black box.

## Layout

| Path | Role |
|---|---|
| `NYC Folder/` | All code: markup, styles, scripts, docs. |
| `main scroll folder/` | All media, source **and** derived. |
| `NYC Folder/main scroll folder` | **Symlink** to `../main scroll folder`. Do not delete. |

Media is referenced without a leading `../` (e.g. `main%20scroll%20folder/...`),
which resolves through that symlink. That is what lets the site be served from
either directory locally. Spaces must be `%20`-encoded in URLs.

## What is committed, and why

Everything — including the ~570MB of frame sequences that
`scripts/media-pipeline.sh` generates.

Normally generated files do not belong in a repository. They are here because
**the frames *are* the site**: `js/journey.js` draws them to a canvas, and
without them the journey renders as a black box. Committing them is what makes a
clone deployable as-is rather than after a 5-10 minute ffmpeg run.

The `.mp4` sources are committed too, so the pipeline can be re-run, but they are
never published — nothing on the site requests them, and there is no `<video>`
element anywhere.

Note for anyone tempted: **do not move the frames to Git LFS.** GitHub Pages does
not resolve LFS pointers, so every frame would 404 and the journey would go
black.

## Deployment

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on every push
to `main`.

It *assembles* the site rather than publishing the tree as-is, because Pages does
not follow symlinks — `NYC Folder/main scroll folder` would be served as a text
file containing the path it points at, and every frame would 404. The workflow
puts `index.html` and a real `main scroll folder` side by side instead, then
asserts 8 clips and 968 frames made it before deploying.

Published site is ~582MB, under the 1GB Pages limit. The `.mp4` sources are left
out.

To deploy elsewhere, serve the assembled layout — any static host works, since
there is nothing to build.

## Verifying changes

There is no test suite. Verification is done by driving a real browser; every
script assumes the server is already running.

```bash
cd "NYC Folder"
python3 scripts/qa.py [desktop|mobile|reduced]   # console errors, failed requests
python3 scripts/scroll-check.py [desktop|mobile] # smoothness, seams, pacing
python3 scripts/boundary-check.py                # pops at segment joins
python3 scripts/shape-check.py                   # the locked shape contract
python3 scripts/motion-table.py                  # regenerate MOTION_LUT
bash scripts/media-pipeline.sh                   # re-export ALL frames (~5-10 min)
```

A `BLANK` canvas in `qa.py`'s reduced-motion run is **correct** — that mode
replaces the canvas with stills.

## Documentation

- `NYC Folder/DESIGN.md` — the visual system, plus binding contracts on shape,
  seam geometry, and image quality. Mostly measured findings, not preference.
- `NYC Folder/PRODUCT.md` — product truth and accessibility requirements. Its
  audience section is explicitly labelled as assumed.
- `CLAUDE.md` — orientation for AI assistants, including a list of things that
  have misled people working on this before.

## Credits

Photography and footage supplied by the site's author. Type is Archivo Black and
Inter, self-hosted.

