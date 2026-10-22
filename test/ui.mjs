import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
await p.screenshot({ path: 'test/shot-loadout.png' });
await p.click('button.primary');
await p.waitForTimeout(500);
// auto-click first prompt button a number of times
for (let i = 0; i < 25; i++) { const btn = await p.$('#prompt button'); if (btn) { await btn.click(); await p.waitForTimeout(120); } }
await p.screenshot({ path: 'test/shot-battle.png' });
console.log('errors:', errs);
await b.close();
