import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
await p.click('.gearrow .link'); await p.waitForTimeout(200);
await p.screenshot({ path: 'test/shot-loadout2.png' });
await p.click('button.primary'); await p.waitForTimeout(500);
for (let i = 0; i < 8; i++) { const btn = await p.$('#prompt button'); if (btn) { await btn.click(); await p.waitForTimeout(120); } }
await p.screenshot({ path: 'test/shot-battle2.png' });
await p.click('.gear .g'); await p.waitForTimeout(200);
await p.screenshot({ path: 'test/shot-modal.png' });
console.log('errors:', errs); await b.close();
