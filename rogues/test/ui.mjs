// UI smoke test: open the built page on a phone viewport, start a Clash, answer prompts, no page errors.
// playwright is resolved via require so a globally installed copy (NODE_PATH / CI) works too; skips cleanly when absent.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP playwright not installed'); process.exit(0); }
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(new URL('../dist/rogues.html', import.meta.url).href); ok(await p.locator('h1').count() === 1, 'home renders');
await p.fill('#seed', '7'); await p.click('text=Clash 시작'); await p.waitForTimeout(400);
ok(await p.locator('svg.bsvg').count() === 1 && await p.locator('.kn').count() === 4 && await p.locator('.mon').count() === 1, 'board with 4 knights and monster');
let answered = 0;
for (let i = 0; i < 60; i++) { const sel = await p.$('.cell.sel'); if (sel) { await sel.click(); answered++; await p.waitForTimeout(40); continue; } const btn = await p.$('.sheet .opts button.primary') || await p.$('.sheet .opts button'); if (!btn) { await p.waitForTimeout(100); continue; } await btn.click(); answered++; await p.waitForTimeout(40); }
ok(answered > 10, `answered ${answered} prompts`);
await p.click('text=몬스터'); ok((await p.textContent('.pane')).includes('Wound Stack'), 'monster pane');
await p.click('text=기사'); ok((await p.locator('.kbox').count()) === 4, 'knight pane shows 4 knights');
const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `no horizontal overflow at 390px (${w})`);
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
