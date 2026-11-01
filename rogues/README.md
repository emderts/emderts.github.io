# Kingdoms Forlorn — Rogue's Path (web single-player)

Lives in `rogues/` of the `emderts/emderts.github.io` repo; published at https://emderts.github.io/rogues/ .
Same architecture as the ATO Mnestis Theatre project at the repo root (which this project never touches).

## Layout
```
src/engine/*.js   pure game engine (ES modules, no DOM) — core.js (Rng/Deck), board.js, dice.js, knight.js, monster.js,
                  clash.js (one Clash), effects.js (card ops), rosegraal.js (monster roll / rewards), campaign.js (Rogue's Path loop + save)
src/ui/main.js    vanilla-JS single-page UI, mobile-first; every player decision goes through the async `ask` hook (bottom sheet)
tools/audit.mjs   generates docs/audit/index.html (data ↔ engine ↔ test audit)
src/index.html    HTML shell; __DATA__ and __BUNDLE__ are replaced at build time
data/**/*.json    transcribed cards / rules (every data/*.json → DATA[name], data/<dir>/*.json → DATA[dir][name])
test/*.mjs        node tests, print PASS/FAIL per check and ALL PASS at the end
build.mjs         esbuild → dist/rogues.html (single self-contained file, works from file://)
```

## Build & test
```
npm install --no-save esbuild
npm run build      # → dist/rogues.html
npm test           # runs every test/*.mjs (build first: one test checks dist/rogues.html; ui.mjs needs Playwright, skipped otherwise)
node tools/audit.mjs   # → docs/audit/index.html
```

## Deploy
Copy this folder to `rogues/` in the Pages repo and push to `main`. `.github/workflows/pages.yml` runs
`cd rogues && npm install --no-save esbuild && node build.mjs` and publishes `rogues/dist/rogues.html` as `site/rogues/index.html`.
