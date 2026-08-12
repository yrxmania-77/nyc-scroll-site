"""Scroll the ENTIRE pinned journey and measure how it actually feels.

Three things, all of which have regressed at least once:
  smoothness  rAF frame intervals during continuous wheel scrolling
  seams       frame-to-frame image change, looking for isolated jumps at cuts
  pacing      scroll distance per segment, which must be constant per clip type

    python3 scripts/scroll-check.py [desktop|mobile]
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8080/NYC%20Folder/index.html"

# MUST launch with these. Headless Chromium defaults to SwiftShader, a software
# rasteriser, where a retina-sized canvas drops ~2/3 of its frames. Measuring
# there once led to capping the canvas and shipping a visibly soft scrub for no
# reason. These flags put the real GPU behind the canvas, which is what every
# actual visitor has.
GPU_ARGS = ["--use-gl=angle", "--use-angle=metal",
            "--enable-gpu", "--ignore-gpu-blocklist"]

PROFILES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=2),
    "mobile": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                   is_mobile=True, has_touch=True),
}

# Coarse luma signature of the canvas — enough to detect a cut, cheap enough to
# sample every step.
SIG = """() => {
  const c = document.querySelector('[data-journey-canvas]');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const out = [];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) {
    const px = (Math.floor(c.height * (y + .5) / 12) * c.width + Math.floor(c.width * (x + .5) / 20)) * 4;
    out.push(0.2126 * d[px] + 0.7152 * d[px + 1] + 0.0722 * d[px + 2]);
  }
  return out;
}"""


def run(profile):
    with sync_playwright() as p:
        b = p.chromium.launch(args=GPU_ARGS)
        pg = b.new_context(**PROFILES[profile]).new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(URL, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)

        pin = pg.evaluate("""() => {const s = ScrollTrigger.getAll().find(t => t.pin);
            return s ? {start: s.start, end: s.end} : null;}""")
        vh = pg.evaluate("innerHeight")
        span = pin["end"] - pin["start"]
        print(f"  pinned journey: {span}px = {span/vh:.1f} viewports")

        # ---- PACING -------------------------------------------------------
        # weights in journey.js: hub .5 | (dive 2.4, hold .9, pullup 1.2) x4 | hub .5
        W, total = {"dive": 2.4, "hold": 0.9, "pullup": 1.2}, 19.0
        print("  pacing (constant per clip type == even):")
        for kind in ("dive", "hold", "pullup"):
            px = span * W[kind] / total
            fpp = 121 / px if kind != "hold" else 0
            note = f"{fpp*1000:5.1f} frames per 1000px" if fpp else "     (static hold)"
            print(f"    {kind:7s} {px:7.0f}px each, x4 identical   {note}")

        # ---- SMOOTHNESS (pass 1: NO canvas sampling) --------------------
        # getImageData on a retina canvas is a ~20MB GPU readback. Doing it
        # inside the timed scroll used to report 65% dropped frames that did
        # not exist. Timing and pixel sampling get separate passes.
        def scroll_pass(sample):
            pg.evaluate(f"window.scrollTo(0,{pin['start']})")
            pg.wait_for_timeout(3500)
            pg.evaluate("""() => {window.__fr = []; let l = performance.now();
                const t = (n) => {window.__fr.push(n - l); l = n; requestAnimationFrame(t);};
                requestAnimationFrame(t);}""")
            steps, prev, out = 260, None, []
            for i in range(steps):
                pg.mouse.wheel(0, span / steps)
                pg.wait_for_timeout(16)
                if sample and i % 3 == 0:
                    sig = pg.evaluate(SIG)
                    if prev:
                        out.append((i / steps, sum(abs(a - b) for a, b in zip(sig, prev)) / len(sig)))
                    prev = sig
            pg.wait_for_timeout(400)
            return out

        scroll_pass(sample=False)
        f = pg.evaluate("""() => {const f = window.__fr.slice(5); const s = [...f].sort((a,b)=>a-b);
            return {n: f.length, median: +s[Math.floor(s.length*.5)].toFixed(1),
                    p95: +s[Math.floor(s.length*.95)].toFixed(1),
                    worst: +s[s.length-1].toFixed(1),
                    dropped: f.filter(x => x > 33).length};}""")
        pct = round(100 * f["dropped"] / max(1, f["n"]))
        print(f"  smoothness: median {f['median']}ms  p95 {f['p95']}ms  worst {f['worst']}ms"
              f"  dropped {f['dropped']}/{f['n']} ({pct}%)")

        # ---- SEAMS (pass 2: sampling, timing ignored) --------------------
        deltas = scroll_pass(sample=True)
        vals = sorted(d for _, d in deltas)
        med = vals[len(vals) // 2]
        spikes = [(round(t, 3), round(d, 1)) for t, d in deltas if d > med * 3.5]
        print(f"  seams: median inter-frame delta {med:.1f};"
              f" spikes >3.5x median: {len(spikes)} {spikes[:5]}")

        print(f"  console errors: {len(errs)} {errs[:2]}")
        b.close()
        return pct, len(spikes), len(errs)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "desktop"
    print(f"== {which} ==")
    run(which)
