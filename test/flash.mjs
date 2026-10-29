import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
await p.goto('file://' + process.cwd() + '/dist/mnestis.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200);
await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('ato.loadout')); L.primordial = 'hekaton'; L.level = 1; localStorage.setItem('ato.loadout', JSON.stringify(L)); }); await p.reload(); await p.waitForTimeout(200);
await p.click('text=전투 시작'); await p.waitForTimeout(500);
ok(await p.$('#prim input[type=checkbox]') !== null, 'flash toggle present');
const seen = { dice: 0, power: 0, card: 0, d10: 0 }; let shot = false;
for (let i = 0; i < 220; i++) {
  const fc = await p.$('#flash .fcard'); if (fc) { const cls = await fc.getAttribute('class'); if (await fc.$('.fdice .die')) seen.dice++; if (await fc.$('.pdie')) seen.power++; if (await fc.$('.fname')) seen.card++; if (await fc.$('.fd10')) seen.d10++; if (!shot && await fc.$('.pdie')) { shot = true; await p.screenshot({ path: 'test/shot-flash.png' }); } }
  const cells = await p.$$('.cell.move'); if (cells.length) await cells[Math.floor(cells.length / 2)].click(); else { const btns = await p.$$('#prompt button'); if (btns.length) await btns[btns.length - 1].click(); }
  await p.waitForTimeout(60);
}
console.log(seen); ok(seen.dice > 0 && seen.power > 0, 'attack/evasion dice and power dice flashed');
console.log('errors:', errs); ok(!errs.length, 'no page errors'); await b.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS');
