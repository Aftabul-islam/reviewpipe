# reviewpipe — documentation site

This branch (`gh-pages`) holds the static documentation site for
[reviewpipe](https://github.com/Aftabul-islam/reviewpipe), served via GitHub
Pages. It is intentionally separate from the code on `main`.

## Contents

- `index.html` — the documentation (single page, sticky sidebar).
- `assets/docs.css`, `assets/docs.js` — styling and a small amount of behavior
  (theme toggle, mobile drawer, scrollspy).
- `.nojekyll` — tells GitHub Pages to serve the files as-is.

The site is fully self-contained: no build step, no external fonts, scripts, or
CDNs. Light and dark themes are supported.

## Preview locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Deploy (one-time setup)

In the repository **Settings → Pages**, set the source to the `gh-pages` branch
(`/root`). The site publishes at
`https://aftabul-islam.github.io/reviewpipe/`.

## Updating

Edit `index.html` (or the assets) on this branch and push — GitHub Pages
redeploys automatically. Update the docs whenever the public API changes.
