# Fivefold — agency site

A self-contained one-page site for a marketing agency that promotes local
businesses (ads, local SEO, social) and grows their Google reviews. Plain
HTML/CSS/JS, no build step, self-hosted fonts. Independent of the NYC site in
the rest of this repo; the Pages workflow copies it to `/agency/`.

Preview locally: `python3 -m http.server` from this folder.

## Design brief
Product: Fivefold — marketing, advertising and Google review generation for local businesses
Audience: owners of local and service businesses (restaurants, salons, clinics, trades, retail)
Feeling: warm, assured, crafted
References: user-supplied frosted-glass job card over a dark, softly blurred photo (translucent dark glass, soft corners, thin light border, pill chips, outline buttons)
Style skill: none
Themes: mixed — dark "evening" scenes (hero, review engine, contact) alternate with warm paper sections
Palette: accent ember #e58a5c, star #f4b740, sage #8fae94; neutrals night #0b0e0c / paper #eeeae3 / ink #151714
Fonts: display Geist 400–500 with tight tracking, accent words in Instrument Serif italic / body Geist 400
Type scale: 13 / 16 / 20 / 28 / 44 / 88 px (fluid with clamp)
Spacing: section padding desktop 140px / mobile 88px
Motion: CSS + small vanilla JS (no library), durations 200–700ms, easing cubic-bezier(0.22, 1, 0.36, 1), entrances once on scroll, signature moment = hero load sequence, respects prefers-reduced-motion
Glass: ALLOWED (user asked). Few surfaces only: nav pill, hero profile card + review toast, map-pack card, calculator result, contact form. Always over a blurred light scene, thin light edge + inset top highlight.
Banned: grid/net/graph-paper background textures (user rejected), heavy black display faces such as Archivo Black (user rejected as "AI slop"), lime-on-black, gradient cards, purple-to-blue gradients, emoji as icons, placeholder copy, fake testimonials or invented client results
