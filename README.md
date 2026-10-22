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
