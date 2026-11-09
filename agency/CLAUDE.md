# ReviewLab — site

A self-contained one-page site for ReviewLab, a Google review and reputation
management company. All copy comes from the owner's brief: 500+ businesses,
hundreds of workers across locations, QR codes to the Google review page,
$10 per confirmed live review, dashboard tracking and a report every Sunday.
Do not add services, figures or claims the owner has not supplied. Plain
HTML/CSS/JS, no build step, self-hosted fonts. It is NOT part of the NYC
scroll site in the rest of this repo and must not be wired into that site's
GitHub Pages deploy (`.github/workflows/pages.yml`). Hosting is not decided
yet; it lives here only because this is the repository the work started in.

Preview locally: `python3 -m http.server` from this folder.

## Design brief
Product: ReviewLab — Google review and reputation management (QR codes, on-site team, pay per confirmed live review)
Audience: owners of local and service businesses (restaurants, salons, clinics, trades, retail)
Feeling: strict, professional, tasteful (NOT a spa or salon look)
References: user-supplied frosted-glass job card over a dark, softly blurred photo (translucent dark glass, soft corners, thin light border, pill chips, outline buttons)
Style skill: none
Copy: SHORT. The user rejected the previous version as overloaded ("too many steps, written in paragraphs, not something you want to read"). One line per idea, five sections only (hero, how it works, pricing, FAQ, contact). Measured: 921 visible words cut to ~197. Do not grow it back.
Hero: the "ReviewLab" wordmark, huge, rising out of drifting fog (user's request: dark, "peeking out from under shadow and fog", as dramatic as possible). Base letters sit in shadow; a round window of light moves over them (pure transforms, see `.mark__light`). Fog is value noise on a 160px canvas, blurred inside the canvas. Do not put a CSS blur or a blend mode over the hero: both cost a full-screen repaint per fog frame (measured 50-66ms frames before, 17-33ms after, in software rendering). Phones stack "Review" / "Lab" at 26vw ("Review" is 3.19em of ink).
Themes: mixed — near-black scenes (hero, pricing, contact) alternate with white / cool-grey sections
Palette: accent blue #5b8cff (deep #2f63e6), star #f4b740 (stars only), slate #8fa3bd; neutrals night #0a0b0d / grey #f3f4f6 / white #ffffff / ink #0d0f12
Fonts: Geist only. Headings 400–500 with tight tracking; emphasis is colour (blue in the hero, muted grey elsewhere), never italic
Type scale: 13 / 16 / 20 / 28 / 44 / 88 px (fluid with clamp)
Spacing: section padding desktop 140px / mobile 88px
Motion: CSS + small vanilla JS (no library), durations 200–700ms, easing cubic-bezier(0.22, 1, 0.36, 1), entrances once on scroll, signature moment = hero load sequence, respects prefers-reduced-motion
Glass: ALLOWED (user asked). Few surfaces only: nav pill, hero event toast, QR card, pricing estimator and report, contact form. Always over a blurred light scene, thin light edge + inset top highlight.
Banned: italic/cursive or serif display type (user rejected: "not a nail spa"), cream/beige/warm paper tones (user rejected), grid/net/graph-paper background textures (user rejected), heavy black display faces such as Archivo Black (user rejected as "AI slop"), lime-on-black, gradient cards, purple-to-blue gradients, emoji as icons, placeholder copy, fake testimonials or invented client results
