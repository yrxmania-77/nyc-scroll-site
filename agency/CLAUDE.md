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
Copy: SHORT but not bare. The 921-word version was rejected as overloaded ("too many steps, written in paragraphs"); the 197-word cut was then judged too thin. Current balance is ~300 words in six sections: hero, overview, how it works (three steps), pricing, FAQ (six one-line answers), contact. The user asked to "focus on the overview": the Overview section is the owner's message as six cards in its own order (500+ businesses, hundreds of workers, QR codes, $10 per live review, dashboard, Sunday report) under the stated goal and the three words "Simple / Organized / Transparent". The worker-pay sentence sits under the price as one line. Add information as compact formatted pieces (cards, chips, short lists), never as paragraphs.
Hero: the "ReviewLab" wordmark, huge and dark, rising out of shadow (user: "as if it climbs out from under the shadow", as striking as possible). It is ONE layer of text (`.mark__word`). A version that laid a bright copy over a dim one read as doubled, blurry and shadowed on iPhone ("двоится в глазах"): never add a second copy, a text-shadow or a blur to it. The shadow is a static mask on `.mark__shade`; the word slides up through it on load. The mask runs ALL the way to transparent on a smoothstep curve and ends on the baseline: a fade that stopped near-but-not-at zero left the flat baselines showing as a hard cut ("the transition is kinda sharp"). Stops are placed on measured ink (cap top 14%, x-height 32%, baseline 85-87% of a line); re-measure if the font, size or line-height changes. Desktop dissolves the lower half of the one line; phones stack "Review" / "Lab" at 26vw ("Review" is 3.19em of ink), keep "Review" whole and dissolve only "Lab". The text gradient only lights the word (bright top, slate bottom) and never fades out itself. A `--sheen` highlight sweeps every 9s and follows the pointer on desktop. The haze is a faint mist over the dissolve, by request "figurative, not literal smoke" and then "a little more light": `.mark__haze`, three soft radial ellipses with eased falloff at staggered heights, drifting on transform animations. It replaced a canvas noise field whose puffs read as "dust or smoke" with dark gaps under the letters. No CSS blur or blend mode over the hero. Measured: 16.7ms median frame, and nothing runs while idle (the scroll sink is event-driven).
Themes: mixed — near-black scenes (hero, pricing, contact) alternate with white / cool-grey sections
Palette: accent blue #5b8cff (deep #2f63e6), star #f4b740 (stars only), slate #8fa3bd; neutrals night #0a0b0d / grey #f3f4f6 / white #ffffff / ink #0d0f12
Fonts: Geist only. Headings 400–500 with tight tracking; emphasis is colour (blue in the hero, muted grey elsewhere), never italic
Type scale: 13 / 16 / 20 / 28 / 44 / 88 px (fluid with clamp)
Spacing: section padding desktop 140px / mobile 88px
Motion: CSS + small vanilla JS (no library), durations 200–700ms, easing cubic-bezier(0.22, 1, 0.36, 1), entrances once on scroll, signature moment = hero load sequence, respects prefers-reduced-motion
Glass: ALLOWED (user asked). Few surfaces only: nav pill, hero event toast, QR card, pricing estimator and report, contact form. Always over a blurred light scene, thin light edge + inset top highlight.
Banned: italic/cursive or serif display type (user rejected: "not a nail spa"), cream/beige/warm paper tones (user rejected), grid/net/graph-paper background textures (user rejected), heavy black display faces such as Archivo Black (user rejected as "AI slop"), lime-on-black, gradient cards, purple-to-blue gradients, emoji as icons, placeholder copy, fake testimonials or invented client results
