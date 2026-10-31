# ATO Mnestis Theatre (web single-player)

## Build
```
npm install        # esbuild (+ playwright, only needed for UI tests)
npm run build      # → dist/mnestis.html (single self-contained file)
```
Open `dist/mnestis.html` in a browser. No server needed.

## GitHub Pages
`.github/workflows/pages.yml` builds on every push to `main` and publishes `dist/mnestis.html` as `index.html`.
Repo Settings → Pages → Source: **GitHub Actions**.

## Kingdom Forlorn — Rogue's Path (`/rogues/`)
Separate project living in `rogues/`. The Pages workflow publishes it at `emderts.github.io/rogues/`:
- while `rogues/build.mjs` does not exist, `rogues/index.html` is copied as the placeholder page;
- once `rogues/build.mjs` exists, it is run (`node build.mjs` → `rogues/dist/rogues.html`) and the result is published.
