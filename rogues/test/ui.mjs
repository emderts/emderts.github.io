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
const jsClick = el => el.evaluate(e => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
await p.evaluate(() => { window.__fl = 0; new MutationObserver(() => { if (document.querySelector('#flash .fcard')) window.__fl++; }).observe(document.getElementById('flash'), { childList: true }); });
let answered = 0;
for (let i = 0; i < 60; i++) { const sel = await p.$('.cell.sel'); if (sel) { await jsClick(sel); answered++; await p.waitForTimeout(40); continue; } const btn = await p.$('.sheet .row button.primary') || await p.$('.sheet .opts button.primary') || await p.$('.sheet .opts button'); if (!btn) { await p.waitForTimeout(100); continue; } await jsClick(btn); answered++; await p.waitForTimeout(40); }
ok(await p.evaluate(() => window.__fl) > 0, 'result pop-ups (dice / cards) shown in the centre');
{ const lp = await p.$eval('#lpane', e => e.scrollHeight - e.scrollTop - e.clientHeight); ok(lp < 5, `log pane scrolled to the bottom (${lp}px left)`); }
await jsClick(await p.$('#mpane .tag.link')); await p.waitForTimeout(80); ok(await p.locator('.modal').count() === 1 && (await p.textContent('.modal')).includes('Trait'), 'tapping a trait opens its text'); await jsClick(await p.$('.modal .close')); await p.waitForTimeout(60);
await jsClick(await p.$('#mpane .link')); await p.waitForTimeout(80); ok(await p.locator('.modal').count() === 1, 'Wound Stack / card viewer opens'); await jsClick(await p.$('.modal .close')); await p.waitForTimeout(60);
await p.evaluate(() => document.querySelector('#kpane details').open = true); await p.waitForTimeout(80); { const t = await p.$('#kpane details .tag.link'); if (t) { await jsClick(t); await p.waitForTimeout(80); ok((await p.locator('.modal .cardview').count()) === 1, 'tapping a hand card shows the card'); await jsClick(await p.$('.modal .close')); } else ok(false, 'hand card tag present'); }
for (const lab of ['Heroic', 'Peril']) { const bt = await p.$(`#kpane button:has-text("${lab}")`); await jsClick(bt); await p.waitForTimeout(80); ok((await p.textContent('.modal')).includes(lab + ' Arc'), `knight card shows the ${lab} Arc`); await jsClick(await p.$('.modal .close')); await p.waitForTimeout(60); }
ok(!/(\w+), \1/.test(await p.textContent('#mpane')), 'Knight Pool shown grouped');
ok(answered > 10, `answered ${answered} prompts`);
ok((await p.textContent('#mpane')).includes('Wound Stack'), 'monster pane visible next to the board');
ok((await p.locator('#kpane .kbox').count()) === 4, 'knight pane shows 4 knights');
{ const bb = await p.$eval('#board', e => e.getBoundingClientRect().bottom); const st = await p.$eval('.battle .sheet', e => [e.getBoundingClientRect().top, getComputedStyle(e).position]); ok(st[1] !== 'fixed' && st[0] >= bb - 1, 'prompt sits below the board inline (does not cover it)'); }
const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `no horizontal overflow at 390px (${w})`);
// campaign flow
await p.evaluate(() => localStorage.setItem('kf.flash', '0'));
await p.goto(new URL('../dist/rogues.html', import.meta.url).href); p.on('dialog', d => d.accept());
await p.click('text=새 캠페인'); await p.waitForTimeout(200); ok((await p.textContent('body')).includes('라운드 0'), 'campaign map renders');
const nodes = await p.$$('svg g[style*="cursor"]'); ok(nodes.length === 6, `6 selectable nodes on the map (${nodes.length})`);
let started = false;
for (let i = 0; i < 6 && !started; i++) { const gs = await p.$$('svg g[style*="cursor"] circle'); await gs[i].scrollIntoViewIfNeeded(); await gs[i].click({ force: true }); await p.waitForTimeout(150); const btn = await p.$('button.primary:not([disabled])'); if (btn && (await btn.textContent()).includes('출정')) { await btn.click(); started = true; } }
ok(started, 'a playable node could be chosen'); await p.waitForTimeout(200); ok((await p.textContent('body')).includes('Lv'), 'encounter screen shows the rolled monster');
await p.click('text=Outpost'); await p.waitForTimeout(150); ok((await p.textContent('body')).includes("Merchant's Workshop"), 'outpost renders'); await p.click('text=나가기'); await p.waitForTimeout(100);
await p.click('text=Clash 시작'); await p.waitForTimeout(300);
for (let i = 0; i < 1500; i++) { const t = await p.textContent('body'); if (/지도로/.test(t)) break; const sel = await p.$('.cell.sel'); if (sel) { await sel.click(); await p.waitForTimeout(30); continue; } const sigh = await p.$('.sheet'); if (sigh && /Sigh of the Graal 사용/.test(await sigh.textContent())) { await p.click('text=사용 안 함'); await p.waitForTimeout(30); continue; } const btn = await p.$('.sheet .row button.primary') || await p.$('.sheet .opts button.primary') || await p.$('.sheet .opts button'); if (!btn) { await p.waitForTimeout(60); continue; } await btn.click(); await p.waitForTimeout(30); }
ok(/지도로/.test(await p.textContent('body')), 'clash → aftermath screen reached');
await p.click('text=지도로'); await p.waitForTimeout(150); ok((await p.textContent('body')).includes('라운드 1'), 'back on the map at round 1');
await p.reload(); await p.waitForTimeout(300); ok((await p.textContent('body')).includes('이어하기'), 'save persisted (이어하기 offered)');
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
