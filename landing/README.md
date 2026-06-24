# TRIOS® Landing Page

Standalone static landing page for the TRIOS® Offline School Management System.
Self-contained — Tailwind is **built locally** to `assets/tailwind.css`, so the
page works fully offline (no CDN).

Rebuild the CSS after editing `index.html` (only if you add new Tailwind classes):

```bash
npx @tailwindcss/cli@4 -i landing/_tw-input.css -o landing/assets/tailwind.css --minify
```

## Run it

Just open `index.html` in any browser, or serve the folder:

```bash
npx serve landing
```

## Images you need to add

Drop these files into `landing/assets/` with **exactly these names**:

| File | What it is | Used in |
|------|------------|---------|
| `author.jpg` | Photo of Ven. Vithikuliye Dhammarathana Thero (the monk photo) | Creator card |
| `qr.png` | The green circular hovercode / QR ("Scan to connect") | Creator card |
| `damas-logo.png` | The DAMAS blue lion logo | Creator card |
| `icon.ico` | ✅ Already copied from the app (`public/Icon.ico`) | Nav, hero, footer |

Until `author.jpg`, `qr.png` and `damas-logo.png` are added, those three slots in
the Creator card will show broken-image icons — everything else renders fully.

## OG / social-preview image generator

`og/template.html` is a branded 1200×630 card; `og/generate.mjs` screenshots it
to `assets/og.png` using Electron (already a project dependency — runs offline).

Generate the default image:

```bash
npm run og
```

Generate a custom variant (all flags optional):

```bash
npm run og -- --out=assets/og.png \
  --title="Your headline | *gradient part*" \
  --sub="Supporting line of text" \
  --badge="100% Offline · No Server" \
  --footLeft="trios · Offline School Management System" \
  --theme=dark            # or: light
```

Title syntax: `|` = line break, `*phrase*` = gradient-coloured text.

The `index.html` `<head>` already references `assets/og.png` via Open Graph /
Twitter tags. **Before deploying**, replace `https://YOUR-DOMAIN` in those tags
with the real site origin — `og:image` / `og:url` must be absolute URLs for
link previews to work on social platforms.
