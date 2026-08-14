"""Phase-resolved profile of the pinned journey.

Kept because scroll-check.py cannot see this class of defect: it averages the
whole journey into one number, so anything that degrades as you scroll averages
away. This buckets every measurement by segment, which is how the delivery
shortfall was finally located.

scroll-check.py reports ONE number for the whole journey, so a defect that grows
as you scroll averages away. This buckets every measurement by journey segment.

Measures, per segment:
  - dropped rAF frames and p95 interval  (where does it break?)
  - live Image objects, made vs released  (are frames actually freed?)
  - frame requests, and RE-requests       (is the store thrashing?)
  - loader visible                        (is it stalling on decode/load?)

    python3 scripts/journey-profile.py [desktop|mobile] [slow|fast]
"""
import sys, json
from playwright.sync_api import sync_playwright

URL = "http://localhost:8080/NYC%20Folder/index.html"
GPU = ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
PROFILES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=2),
    "mobile": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                   is_mobile=True, has_touch=True),
}

# Journey weights from journey.js: hub .5 | (dive 2.4, hold .9, pullup 1.2) x4 | hub .5
PLACES = ["park", "bridge", "times", "statue"]
def segments():
    out, acc = [], 0.0
    out.append(("hub", acc, acc + 0.5)); acc += 0.5
    for p in PLACES:
        for kind, w in (("dive", 2.4), ("hold", 0.9), ("pullup", 1.2)):
            out.append((f"{p}-{kind}", acc, acc + w)); acc += w
    out.append(("hub-tail", acc, acc + 0.5)); acc += 0.5
    return [(n, a / acc, b / acc) for n, a, b in out]

SEGS = segments()

# Runs BEFORE any page script, so it wraps the Image constructor journey.js uses.
PROBE = """
window.__p = { made: 0, released: 0, srcs: [], frames: {} };
const NativeImage = window.Image;
window.Image = function (...a) {
  const img = new NativeImage(...a);
  window.__p.made++;
  return img;
};
window.Image.prototype = NativeImage.prototype;
const ra = HTMLImageElement.prototype.removeAttribute;
HTMLImageElement.prototype.removeAttribute = function (n) {
  if (n === 'src') window.__p.released++;
  return ra.call(this, n);
};
// count frame fetches per clip, and re-fetches of the same URL
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    const m = e.name.match(/frames(?:-sm)?\\/([^/]+)\\/(\\d+)\\.jpg/);
    if (!m) continue;
    const f = window.__p.frames;
    (f[m[1]] = f[m[1]] || { n: 0, refetch: 0, seen: new Set() });
    if (f[m[1]].seen.has(m[2])) f[m[1]].refetch++;
    f[m[1]].seen.add(m[2]);
    f[m[1]].n++;
  }
}).observe({ type: 'resource', buffered: true });
"""

TICKER = """() => {
  window.__fr = [];
  let last = performance.now();
  const loader = document.querySelector('[data-journey-loader]');
  const tick = (now) => {
    window.__fr.push([now - last, window.scrollY,
                      window.__p.made - window.__p.released,
                      loader && getComputedStyle(loader).opacity > 0.05 ? 1 : 0]);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}"""


def run(profile, speed):
    steps = 260 if speed == "slow" else 90
    dwell = 16 if speed == "slow" else 8
    with sync_playwright() as p:
        b = p.chromium.launch(args=GPU)
        ctx = b.new_context(**PROFILES[profile])
        ctx.add_init_script(PROBE)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)

        pin = pg.evaluate("""() => {const s = ScrollTrigger.getAll().find(t => t.pin);
            return s ? {start: s.start, end: s.end} : null;}""")
        span = pin["end"] - pin["start"]
        pg.evaluate(f"window.scrollTo(0,{pin['start']})")
        pg.wait_for_timeout(3500)

        base = pg.evaluate("() => ({made: window.__p.made, released: window.__p.released})")
        pg.evaluate(TICKER)
        for _ in range(steps):
            pg.mouse.wheel(0, span / steps)
            pg.wait_for_timeout(dwell)
        pg.wait_for_timeout(500)

        fr = pg.evaluate("() => window.__fr")
        frames = pg.evaluate("""() => Object.fromEntries(Object.entries(window.__p.frames)
            .map(([k,v]) => [k, {n: v.n, refetch: v.refetch, unique: v.seen.size}]))""")
        final = pg.evaluate("() => ({made: window.__p.made, released: window.__p.released})")

        print(f"\n== {profile} / {speed} scroll ==  pin span {span}px, {steps} steps")
        print(f"   Image objects: made {final['made']}  released {final['released']}  "
              f"LIVE {final['made'] - final['released']}   (before scroll: "
              f"{base['made'] - base['released']} live)")

        print("\n   segment      | drops | p95ms | worst | live imgs | loader")
        rows = []
        for name, a, b_ in SEGS:
            lo, hi = pin["start"] + a * span, pin["start"] + b_ * span
            sel = [f for f in fr if lo <= f[1] < hi]
            if len(sel) < 4:
                continue
            d = sorted(x[0] for x in sel)
            drops = sum(1 for x in d if x > 33)
            p95 = d[int(len(d) * .95)]
            live = max(x[2] for x in sel)
            stall = sum(1 for x in sel if x[3]) / len(sel)
            rows.append((name, drops, len(d), p95, d[-1], live, stall))
            print(f"   {name:12s} | {drops:3d}/{len(d):<3d}| {p95:5.1f} | {d[-1]:5.1f} | "
                  f"{live:6d}    | {stall*100:4.0f}%")

        print("\n   clip           requested  unique  RE-fetched")
        for k, v in frames.items():
            flag = "  <-- thrash" if v["refetch"] else ""
            print(f"   {k:14s} {v['n']:6d}   {v['unique']:5d}   {v['refetch']:6d}{flag}")

        if errs:
            print(f"\n   page errors: {errs[:3]}")
        ctx.close(); b.close()
        return rows


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "desktop",
        sys.argv[2] if len(sys.argv) > 2 else "slow")
