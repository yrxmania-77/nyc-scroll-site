"""Assert that nothing pops at a segment boundary.

scroll-check.py samples during a continuous scroll, which is good for spotting a
cut but cannot separate "the image is moving fast here" from "the image jumped".
This parks the scrub either side of every boundary, lets it settle, and compares
the two frames directly. A boundary should look like ordinary motion; anything
much larger is a pop.

The end-of-journey boundary is special-cased: the tail hub holds the SAME frame
the final pull-up ended on, so its delta must be ~0. It was 31.6% of scale for a
while, because a hub segment derived its scale from its kind and the two hubs
sit at opposite ends of the journey.

    python3 scripts/boundary-check.py     # exits non-zero on a pop
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8080/NYC%20Folder/index.html"

# Same reason as scroll-check.py: headless defaults to a software rasteriser.
GPU_ARGS = ["--use-gl=angle", "--use-angle=metal",
            "--enable-gpu", "--ignore-gpu-blocklist"]

SETTLE = 2600      # scrub is 0.6; sampling sooner measures the harness, not the page
EPS = 0.0015       # scroll fraction either side of a boundary
POP_FACTOR = 2.5   # x the median boundary delta before it counts as a pop

# MOTION_LUT deliberately accelerates through the near-identical frames at a
# clip's end, so a fixed EPS spans far more real motion there than it does
# mid-clip — at EPS it is ~7 frames, which reads as a pop when it is not one.
# The end-of-journey check therefore samples much closer in, and separately
# asserts the tail hub is genuinely static.
EPS_END = 0.0002

SIG = """() => {
  const c = document.querySelector('[data-journey-canvas]');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const out = [];
  for (let y = 0; y < 24; y++) for (let x = 0; x < 40; x++) {
    const px = (Math.floor(c.height * (y + .5) / 24) * c.width
              + Math.floor(c.width * (x + .5) / 40)) * 4;
    out.push(0.2126 * d[px] + 0.7152 * d[px + 1] + 0.0722 * d[px + 2]);
  }
  return out;
}"""

# Mirrors buildSegments() in js/journey.js.
W = {"hub": 0.5, "dive": 2.4, "hold": 0.9, "pullup": 1.2}
PLACES = ["park", "bridge", "times", "statue"]


def boundaries():
    kinds = ["hub"]
    for _ in PLACES:
        kinds += ["dive", "hold", "pullup"]
    kinds.append("hub")
    total = sum(W[k] for k in kinds)
    out, cursor = [], 0.0
    for i, k in enumerate(kinds[:-1]):
        cursor += W[k]
        out.append((f"{k} -> {kinds[i + 1]}", cursor / total))
    return out


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=GPU_ARGS)
        pg = b.new_context(viewport={"width": 1440, "height": 900},
                           device_scale_factor=2).new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)

        st = pg.evaluate("""() => {const s = ScrollTrigger.getAll().find(t => t.pin);
            return {start: s.start, end: s.end};}""")
        span = st["end"] - st["start"]

        def sig_at(prog):
            pg.evaluate(f"window.scrollTo(0,{st['start'] + span * prog})")
            pg.wait_for_timeout(SETTLE)
            return pg.evaluate(SIG)

        def delta(p0, p1):
            a, c = sig_at(p0), sig_at(p1)
            return sum(abs(x - y) for x, y in zip(a, c)) / len(a)

        bnds = boundaries()
        end_prog = bnds[-1][1]

        rows = []
        for name, prog in bnds[:-1]:
            rows.append((name, prog, delta(prog - EPS, prog + EPS)))

        # End of journey, tested two ways.
        end_cross = delta(end_prog - EPS_END, end_prog + EPS_END)
        end_hold = delta(end_prog + 0.002, end_prog + 0.020)

        b.close()

    deltas = sorted(d for _, _, d in rows)
    med = deltas[len(deltas) // 2]
    ok = True

    print(f"{'boundary':<18}{'progress':>10}{'delta':>9}")
    for name, prog, d in rows:
        flag = ""
        if d > med * POP_FACTOR:
            flag, ok = "  POP", False
        print(f"{name:<18}{prog:>10.4f}{d:>9.2f}{flag}")

    # The tail hub holds the frame the final pull-up ended on. Crossing into it
    # must look like the last sliver of that pull-up, and once inside, nothing
    # may move at all.
    cross_ok = end_cross < med * 0.5
    hold_ok = end_hold < 1.0
    ok = ok and cross_ok and hold_ok
    print(f"\n{'pullup -> hub':<18}{end_prog:>10.4f}{end_cross:>9.2f}"
          f"  {'ok' if cross_ok else 'POP: end frame jumps'}")
    print(f"{'  tail hub static':<18}{'':>10}{end_hold:>9.2f}"
          f"  {'ok' if hold_ok else 'POP: end frame drifts'}")

    print(f"\nmedian boundary delta {med:.2f}; console errors {len(errs)}")
    if errs:
        ok = False
        print(f"  {errs[:2]}")
    print("boundaries: OK" if ok else "boundaries: FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
