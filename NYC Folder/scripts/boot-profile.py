"""What actually happens in the first 15 seconds after a cold load.

Reports: paint milestones, when the journey can first draw, and a second-by-
second breakdown of what is being downloaded — so "it takes forever to load"
can be attributed to something specific.

    python3 scripts/boot-profile.py [local|live] [mbps]

Note the `wait_until="commit"`: this page never reaches networkidle while frames
stream, so a networkidle wait just times out after 90s. That is not a bug in the
page, but it will hang any harness that assumes otherwise.
"""
import sys
from playwright.sync_api import sync_playwright

URLS = {"local": "http://localhost:8080/NYC%20Folder/index.html",
        "live": "https://yrxmania-77.github.io/nyc-scroll-site/"}
GPU = ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]

PROBE = """
window.__b = { res: [], firstDraw: null };
new PerformanceObserver((l) => { for (const e of l.getEntries())
  window.__b.res.push([e.name, e.startTime, e.responseEnd,
                       e.transferSize || e.encodedBodySize || 0]);
}).observe({ type: 'resource', buffered: true });
// when does the journey canvas first get real pixels?
const seek = setInterval(() => {
  const c = document.querySelector('[data-journey-canvas]');
  if (!c) return;
  const g = c.getContext('2d');
  try {
    const d = g.getImageData(c.width >> 1, c.height >> 1, 4, 4).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i+1] + d[i+2];
    if (s > 0) { window.__b.firstDraw = performance.now(); clearInterval(seek); }
  } catch (e) {}
}, 100);
"""


def kind(url):
    if "/frames/" in url or "/frames-sm/" in url: return "FRAMES"
    if "/stills/" in url: return "stills"
    if "/optimized/" in url: return "photos"
    if url.endswith(".woff2") or "/fonts/" in url: return "fonts"
    if "gsap" in url: return "gsap"
    if url.endswith(".css") or url.endswith(".js"): return "code"
    return "other"


def run(where, mbps=None):
    with sync_playwright() as p:
        b = p.chromium.launch(args=GPU)
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        ctx.add_init_script(PROBE)
        pg = ctx.new_page()
        if mbps:
            cdp = ctx.new_cdp_session(pg); cdp.send("Network.enable")
            cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 30,
                "downloadThroughput": int(mbps*1e6/8), "uploadThroughput": int(5e6/8)})
        # NOT networkidle: this page never reaches it while frames stream.
        pg.goto(URLS[where], wait_until="commit", timeout=90000)
        pg.wait_for_timeout(15000)

        m = pg.evaluate("""() => {
          const nav = performance.getEntriesByType('navigation')[0] || {};
          const fcp = performance.getEntriesByName('first-contentful-paint')[0];
          return { dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd,
                   fcp: fcp ? fcp.startTime : null,
                   firstDraw: window.__b.firstDraw,
                   scrollable: document.body.scrollHeight };
        }""")
        res = pg.evaluate("() => window.__b.res")

        print(f"\n== {where} — cold load" + (f", throttled {mbps:.0f}Mbps" if mbps else "") + " ==")
        print(f"   first contentful paint : {m['fcp']:.0f}ms" if m['fcp'] else "   FCP: n/a")
        print(f"   DOMContentLoaded       : {m['dcl']:.0f}ms")
        print(f"   load event             : {m['load']:.0f}ms" if m['load'] else "   load: not fired in 15s")
        print(f"   journey first draws    : "
              + (f"{m['firstDraw']:.0f}ms" if m['firstDraw'] else "NOT within 15s"))

        print("\n   what is downloading, by second:")
        print("   sec |  FRAMES        photos   fonts  gsap  code  stills | reqs")
        for s in range(15):
            lo, hi = s * 1000, (s + 1) * 1000
            win = [r for r in res if lo <= r[1] < hi]
            if not win: continue
            agg = {}
            for r in win:
                agg[kind(r[0])] = agg.get(kind(r[0]), 0) + r[3]
            fm = agg.get("FRAMES", 0) / 1e6
            print(f"   {s:3d} | {fm:7.1f}MB  {agg.get('photos',0)/1e6:7.2f} "
                  f"{agg.get('fonts',0)/1e3:6.0f}k {agg.get('gsap',0)/1e3:5.0f}k "
                  f"{agg.get('code',0)/1e3:5.0f}k {agg.get('stills',0)/1e3:6.0f}k | {len(win)}")

        tot = sum(r[3] for r in res)
        fr = sum(r[3] for r in res if kind(r[0]) == "FRAMES")
        nfr = sum(1 for r in res if kind(r[0]) == "FRAMES")
        print(f"\n   in 15s: {tot/1e6:.0f}MB total, of which {fr/1e6:.0f}MB is "
              f"{nfr} frame files ({100*fr/max(1,tot):.0f}%)")
        # what competes with the hero image?
        hero = [r for r in res if "front-main" in r[0]]
        if hero:
            print(f"   hero photo finished at : {hero[0][2]:.0f}ms")
        ctx.close(); b.close()


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "local",
        float(sys.argv[2]) if len(sys.argv) > 2 else None)
