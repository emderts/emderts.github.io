import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
const sel = await p.$$('.loadout select'); await sel[0].selectOption('pursuer'); await p.waitForTimeout(200);
const before = await p.evaluate(() => localStorage.getItem('ato.loadout'));
const exp = (await p.$$('button')).filter(async x => true); const btns = await p.$$('button'); let eb = null, ib = null; for (const x of btns) { const t = await x.innerText(); if (/내보내기/.test(t)) eb = x; if (/가져오기/.test(t)) ib = x; }
await eb.click(); await p.waitForTimeout(300); const str = await p.$eval('textarea', e => e.value);
console.log((/^ATO[12]:/.test(str) ? 'PASS' : 'FAIL') + ' export string ' + str.slice(0, 10) + '… len ' + str.length);
// change loadout then import
await p.evaluate(() => localStorage.setItem('ato.loadout', JSON.stringify({ titans: [] }))); await p.reload(); await p.waitForTimeout(300);
const btns2 = await p.$$('button'); for (const x of btns2) { const t = await x.innerText(); if (/가져오기/.test(t)) ib = x; }
await ib.click(); await p.waitForTimeout(100); await p.fill('textarea', str); const btns3 = await p.$$('button'); for (const x of btns3) { const t = await x.innerText(); if (/가져오기/.test(t)) ib = x; } await ib.click(); await p.waitForTimeout(1200);
const after = await p.evaluate(() => localStorage.getItem('ato.loadout'));
const A = JSON.parse(before), B = JSON.parse(after); console.log((A.primordial === B.primordial && JSON.stringify(A.titans) === JSON.stringify(B.titans) ? 'PASS' : 'FAIL') + ' import restores loadout (' + B.primordial + ')');
console.log('errors:', errs); await b.close();
