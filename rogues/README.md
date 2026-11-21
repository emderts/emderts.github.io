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

## 언어 옵션 (English 원문 ↔ 한국어 번역)

화면 오른쪽 아래의 🌐 버튼으로 카드 이름·문구 표시 언어를 바꾼다 (선택은 브라우저에 저장).

- 게임 데이터(`data/`)는 영어 원문 그대로 두고, 번역은 사전 `data/i18n/ko.json`에만 넣는다. 키 = 영어 원문, 값 = 번역.
  - `names`: 카드·기사·몬스터·Gear·Condition 이름
  - `text`: 카드 문구 (카드 전체 문구 또는 한 줄 단위)
  - `ui`: 인터페이스 문자열(키 기준, 선택)
- 사전에 없는 항목은 원문이 그대로 나오므로 조금씩 채워도 된다.
- `node tools/i18n_extract.mjs` → `docs/i18n/ko.template.json`: 데이터에 쓰인 모든 이름과 문구 줄 목록(이미 번역한 값 포함).
- 코드: `src/ui/i18n.js` — `tn(name)`, `tx(text)`, `tu(key, fallback)`. DOM 헬퍼 `h()`가 사전에 있는 이름/문구와 정확히 같은 텍스트 노드를 자동으로 바꿔 준다. 이름이 다른 글자와 붙어 있는 곳은 `tn()`을 직접 쓴다.
- 엔진 로그(전투 기록)는 엔진이 만든 문장이라 번역 대상이 아니다.
