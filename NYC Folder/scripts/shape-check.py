"""Assert the user-locked shape and effects contract from DESIGN.md.

The user rejected notched/glowing chrome and asked that design passes stop
reintroducing it. This makes that contract machine-checkable rather than a note
someone has to remember. Run after any styling change.

    python3 scripts/shape-check.py        # exits non-zero on violation
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8080/NYC%20Folder/index.html"

SWEEP = """() => {
  const bad = [];
  const name = (el) => el.id || (typeof el.className === 'string' && el.className) || el.tagName;
  for (const el of document.querySelectorAll('*')) {
    const c = getComputedStyle(el);
    const inCard = el.closest('.card');

    // No glow / shine anywhere. Inset shadows are fine (hairlines).
    if (c.boxShadow && c.boxShadow !== 'none' && !/inset/.test(c.boxShadow))
      bad.push(['outer box-shadow', name(el), c.boxShadow.slice(0, 44)]);
    if (c.textShadow && c.textShadow !== 'none')
      bad.push(['text-shadow', name(el), c.textShadow.slice(0, 44)]);

    // No gradients on nav or buttons.
    if (/gradient/.test(c.backgroundImage) && (el.closest('.nav') || el.closest('.btn')))
      bad.push(['gradient on chrome', name(el), c.backgroundImage.slice(0, 44)]);

    // The notch belongs to journey place cards and nothing else.
    if (c.clipPath && c.clipPath !== 'none' && !inCard)
      bad.push(['clip-path outside .card', name(el), c.clipPath.slice(0, 44)]);
  }

  // Positive assertions: the things that must still be true.
  const must = [];
  const pill = document.querySelector('.nav__pill');
  const media = document.querySelector('.hero__media');
  const card = document.querySelector('.card__frame');
  const wm = document.querySelector('.wordmark__layer');
  if (pill && parseFloat(getComputedStyle(pill).borderRadius) < 20)
    must.push('nav pill is not rounded');
  // The photograph itself is never filtered, scaled or washed — the original
  // prohibition, and now the whole of it again: the focus falloff that used to
  // amend this was removed at the user's request, so the hero is sharp from top
  // to bottom. The assertion that .hero__defocus must EXIST was deleted with it.
  if (media && getComputedStyle(media).filter !== 'none')
    must.push('hero photo has a filter (must be sharp)');
  // No blur may creep back onto the hero by another route either.
  for (const el of document.querySelectorAll('.hero *')) {
    const s = getComputedStyle(el);
    if (/blur/.test(s.backdropFilter) || /blur/.test(s.filter))
      must.push(`hero blur is back on .${el.className || el.tagName} (it was removed on purpose)`);
  }
  // The melt reverses "no paper wash over the hero" deliberately, for the
  // bottom --melt only. A later pass restoring the rule wholesale would
  // reopen a dark band between the hero and the About section.
  if (!document.querySelector('.hero__melt'))
    must.push('hero melt is missing (it is intentional — see DESIGN.md)');
  if (card && getComputedStyle(card).clipPath === 'none')
    must.push('journey card lost its notch');
  if (wm && /url\\(/.test(getComputedStyle(wm).backgroundImage))
    must.push('wordmark has an image fill (must be plain grey)');
  return { bad, must };
}"""


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
        pg.goto(URL, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)
        r = pg.evaluate(SWEEP)
        b.close()

    ok = True
    if r["bad"]:
        ok = False
        print(f"VIOLATIONS ({len(r['bad'])}):")
        for kind, who, val in r["bad"]:
            print(f"  {kind:26s} {who[:34]:34s} {val}")
    if r["must"]:
        ok = False
        print("REGRESSIONS:")
        for m in r["must"]:
            print(f"  {m}")
    print("shape contract: OK" if ok else "shape contract: FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
