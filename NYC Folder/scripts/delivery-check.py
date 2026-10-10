"""Does the journey actually ARRIVE for a real visitor on a real connection?

Kept because every other script here runs on localhost, where bytes are free —
and that is exactly how "crazy slow, barely loading, cuts midway" went unseen:
the renderer was perfect, scroll-check.py was green, and on a ~10 Mbps link
only 1.8 of 8 clips arrived during a 30-second scroll.

This plays one cold visit: land, read the hero for a few seconds, then scroll
the pin at a steady, ordinary pace. It throttles the network (CDP), reads the
journey's own state through the read-only `section.__journey` handle, and
reports what the visitor got:

  - share of the pinned scroll spent with the loader up
  - which place cards were shown
  - how far the governed playhead had got when the scroll left the pin
  - bytes downloaded, and by which delivery (video / frames)

    python3 scripts/delivery-check.py [mbps] [local|live] [video|frames]

    mbps     throttle; 0 = unthrottled (default 10)
    video    default; `frames` loads ?video=off to compare the JPEG path

Exits non-zero if the loader is up for more than 10% of the pin or fewer than
four cards were shown, so it can gate a change the way shape-check.py does.
"""
import sys
from playwright.sync_api import sync_playwright

URLS = {"local": "http://localhost:8080/NYC%20Folder/index.html",
        "live": "https://yrxmania-77.github.io/nyc-scroll-site/"}
GPU = ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
READ_HERO_MS = 5000
RATE_PX_S = 600          # a steady, unhurried scroll: ~30s for the whole pin

PROBE = """
window.__d = { bytes: 0, cards: new Set() };
new PerformanceObserver((l) => { for (const e of l.getEntries())
  window.__d.bytes += e.transferSize || e.encodedBodySize || 0;
}).observe({ type: 'resource', buffered: true });
"""

SAMPLE = """() => {
  const s = document.querySelector('[data-journey]');
  const j = s && s.__journey;
  document.querySelectorAll('[data-card].is-active').forEach((c) =>
    window.__d.cards.add(c.getAttribute('data-card')));
  const st = j && j.st;
  return {
    y: scrollY,
    inPin: !!st && scrollY >= st.start && scrollY <= st.end,
    shown: j ? j.shown : 0,
    loader: !!document.querySelector('[data-journey-loader].is-visible'),
    delivery: s ? (s.getAttribute('data-journey-delivery') || 'frames') : '?',
    edges: j ? j.store.clips
      ? j.store.clips.map((c) => c.edge + 1)
      : Array.from({length: 8}, (_, i) => { const c = j.store.get(i); return c ? c.edge + 1 : 0; })
      : [],
    tier: j && j.store.tier,
    mb: window.__d.bytes / 1e6,
    cards: [...window.__d.cards],
  };
}"""


def run(mbps, where, delivery):
    url = URLS[where] + ("?video=off" if delivery == "frames" else "")
    with sync_playwright() as p:
        b = p.chromium.launch(args=GPU)
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        ctx.add_init_script(PROBE)
        pg = ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        if mbps:
            cdp = ctx.new_cdp_session(pg)
            cdp.send("Network.enable")
            cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
            cdp.send("Network.emulateNetworkConditions", {
                "offline": False, "latency": 40,
                "downloadThroughput": int(mbps * 1e6 / 8), "uploadThroughput": int(5e6 / 8)})
        # Never networkidle: this page streams media for as long as it is open.
        pg.goto(url, wait_until="commit", timeout=90000)
        pg.wait_for_function("() => window.ScrollTrigger && ScrollTrigger.getAll().some(t => t.pin)",
                             timeout=90000)
        pg.wait_for_timeout(READ_HERO_MS)
        pin = pg.evaluate("() => { const s = ScrollTrigger.getAll().find(t => t.pin);"
                          " return { a: s.start, b: s.end }; }")
        # Programmatic scrolls are smoothed by `scroll-behavior: smooth`, which
        # makes a harness fight itself; see CLAUDE.md.
        pg.evaluate("document.documentElement.style.scrollBehavior = 'auto'")
        pg.evaluate(f"window.scrollTo(0, {pin['a'] - 900})")

        samples, left_pin_at = [], None
        t = 0.0
        while t < 120:
            for _ in range(5):
                pg.mouse.wheel(0, RATE_PX_S * 0.1)
                pg.wait_for_timeout(100)
            t += 0.5
            s = pg.evaluate(SAMPLE)
            s["t"] = t
            samples.append(s)
            if s["y"] > pin["b"] and left_pin_at is None:
                left_pin_at = s
            if s["y"] > pin["b"] + 1500:
                break
        b.close()

    pinned = [s for s in samples if s["inPin"]]
    loader = sum(1 for s in pinned if s["loader"]) / max(1, len(pinned))
    last = samples[-1]
    label = f"{mbps} Mbps" if mbps else "unthrottled"
    print(f"\n== {where} / {label} / {last['delivery']}"
          f"{' (' + str(last['tier']) + ')' if last['tier'] else ''} ==")
    print(f"   pinned for          {len(pinned) * 0.5:.1f}s of scrolling")
    print(f"   loader up           {loader * 100:.0f}% of the pin")
    print(f"   cards shown         {len(last['cards'])}/4  {sorted(last['cards'])}")
    if left_pin_at:
        print(f"   playhead at unpin   {left_pin_at['shown'] * 100:.0f}% of the journey")
    print(f"   frames ready/clip   {last['edges']}")
    print(f"   downloaded          {last['mb']:.0f}MB")
    if errors:
        print(f"   page errors         {errors[:3]}")
    ok = loader <= 0.10 and len(last["cards"]) == 4 and not errors
    print("   PASS" if ok else "   FAIL")
    return ok


if __name__ == "__main__":
    mbps = float(sys.argv[1]) if len(sys.argv) > 1 else 10
    where = sys.argv[2] if len(sys.argv) > 2 else "local"
    delivery = sys.argv[3] if len(sys.argv) > 3 else "video"
    sys.exit(0 if run(mbps, where, delivery) else 1)
