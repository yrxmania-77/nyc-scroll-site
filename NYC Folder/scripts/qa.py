"""Browser QA for the NEW YORK scroll journey.

Captures console errors, page errors, failed requests, and screenshots at each
beat of the pinned journey. Run with the server already up on :8080 serving
"The New York site" as root.

    python3 scripts/qa.py [desktop|mobile|reduced]
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

URL = "http://localhost:8080/NYC%20Folder/index.html"
OUT = pathlib.Path("/tmp/nyc-qa")
OUT.mkdir(parents=True, exist_ok=True)

PROFILES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}, reduced=False),
    "mobile":  dict(viewport={"width": 390, "height": 844}, reduced=False,
                    is_mobile=True, has_touch=True,
                    user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                               "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile Safari/604.1"),
    "reduced": dict(viewport={"width": 1440, "height": 900}, reduced=True),
}


def run(profile_name):
    cfg = dict(PROFILES[profile_name])
    reduced = cfg.pop("reduced")

    errors, warnings, failed = [], [], []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            **cfg,
            reduced_motion="reduce" if reduced else "no-preference",
            device_scale_factor=2,
        )
        page = ctx.new_page()

        page.on("console", lambda m: (
            errors if m.type == "error" else warnings if m.type == "warning" else []
        ).append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        page.on("requestfailed", lambda r: failed.append(f"{r.url} :: {r.failure}"))

        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2500)

        def shot(name):
            page.screenshot(path=str(OUT / f"{profile_name}-{name}.png"))

        shot("01-hero")

        total = page.evaluate("document.body.scrollHeight")
        vh = page.evaluate("innerHeight")
        print(f"  page height: {total}px  ({total/vh:.1f} viewports)")

        # Walk the whole page in steps, screenshotting the journey densely.
        # Derived from the live pin range, not guessed. Journey pins across
        # roughly 0.064-0.802 of the page; card holds sit mid-segment.
        marks = {
            "02-about": 0.045,
            "03-journey-hub": 0.070,
            "04-park-dive": 0.130,
            "05-park-card": 0.194,
            "06-park-pullup": 0.228,
            "07-bridge-card": 0.369,
            "08-times-card": 0.544,
            "09-statue-card": 0.719,
            "10-release": 0.810,
            "11-stats": 0.862,
            "12-quote": 0.905,
            "13-gallery": 0.950,
            "14-outro": 1.0,
        }
        for name, frac in marks.items():
            page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {frac})")
            page.wait_for_timeout(1500)   # scrub:1 needs time to settle
            shot(name)

        # Does the canvas actually have pixels drawn, or is it a black box?
        page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.24)")
        page.wait_for_timeout(1200)
        canvas_state = page.evaluate("""() => {
            const c = document.querySelector('[data-journey-canvas]');
            if (!c) return 'NO CANVAS';
            const g = c.getContext('2d');
            const d = g.getImageData(c.width/2, c.height/2, 8, 8).data;
            let sum = 0; for (let i=0;i<d.length;i+=4) sum += d[i]+d[i+1]+d[i+2];
            return sum > 0 ? `drawn (centre luma sum ${sum})` : 'BLANK';
        }""")
        print(f"  canvas: {canvas_state}")

        # Reduced motion must never leave content invisible.
        hidden = page.evaluate("""() => {
            const out = [];
            for (const el of document.querySelectorAll('[data-reveal], .card, .hero__inner')) {
                const s = getComputedStyle(el);
                if (parseFloat(s.opacity) < 0.05) out.push(el.className);
            }
            return out;
        }""")
        if hidden:
            print(f"  INVISIBLE ELEMENTS: {hidden}")

        ctx.close(); browser.close()

    print(f"\n== {profile_name} ==")
    print(f"  console errors : {len(errors)}")
    for e in errors[:12]: print("     ", e)
    print(f"  failed requests: {len(failed)}")
    for f in failed[:12]: print("     ", f)
    return errors, failed


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "desktop"
    run(which)
