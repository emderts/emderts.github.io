import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200);
await p.click('text=13th Muse Grand Cannon'); await p.waitForTimeout(150);
await p.click('text=Argo Payload'); await p.click('text=자원 무제한'); await p.waitForTimeout(150);
await p.screenshot({ path: 'test/shot-cannon-loadout.png', fullPage: true });
await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('ato.loadout')); L.cannon.res = { Mortal: 3, Ambrosia: 2, 'Living Abyss': 1 }; localStorage.setItem('ato.loadout', JSON.stringify(L)); }); await p.reload(); await p.waitForTimeout(200);
await p.click('text=전투 시작'); await p.waitForTimeout(600);
let sawPrime = false;
for (let i = 0; i < 200; i++) { const t = await p.$eval('#prompt', e => e.innerText).catch(() => ''); if (/Grand Cannon 장전/.test(t)) sawPrime = true; const cells = await p.$$('.cell.move'); if (cells.length) { await cells[Math.floor(cells.length / 2)].click(); } else { const btns = await p.$$('#prompt button'); if (!btns.length) break; await btns[Math.min(1, btns.length - 1)].click(); } await p.waitForTimeout(25); }
await p.screenshot({ path: 'test/shot-cannon-battle.png' });
const prim = await p.$eval('#prim', e => e.innerText); console.log(prim.split('\n').filter(l => /Grand Cannon|Godform|Poisoned/.test(l)).join('\n'));
console.log('saw priming prompt', sawPrime, 'errors:', errs); await b.close();
