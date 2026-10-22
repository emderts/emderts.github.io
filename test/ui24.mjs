import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
for (const lv of [1, 8]) {
  await p.goto('file://' + process.cwd() + '/dist/mnestis.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200);
  { const sel = (await p.$$('.row select'))[0]; await sel.selectOption('babel'); await p.waitForTimeout(150); }
  await p.evaluate((lv) => { const L = JSON.parse(localStorage.getItem('ato.loadout')); L.level = lv; L.paradox = 3; localStorage.setItem('ato.loadout', JSON.stringify(L)); }, lv); await p.reload(); await p.waitForTimeout(200);
  if (lv === 1) await p.screenshot({ path: 'test/shot-bl-loadout.png' });
  await p.click('text=전투 시작'); await p.waitForTimeout(600);
  await p.screenshot({ path: `test/shot-bl-start${lv}.png` });
  for (let i = 0; i < 400; i++) { if (!(await p.$('#prompt'))) break; const cells = await p.$$('.cell.move'); if (cells.length) { await cells[cells.length - 1].click(); } else { const btns = await p.$$('#prompt button'); if (!btns.length) break; const txts = await Promise.all(btns.map(b => b.innerText())); const skip = txts.findIndex(t => /안 함|확인/.test(t)); if (txts.some(t => /재굴림 실행|선택 완료/.test(t)) && skip >= 0) await btns[skip].click(); else await btns[Math.min(1, btns.length - 1)].click(); } await p.waitForTimeout(20); }
  await p.screenshot({ path: `test/shot-bl-battle${lv}.png` });
  const prim = (await p.$('#prim')) ? await p.$eval('#prim', e => e.innerText) : await p.$eval('body', e => e.innerText.slice(0, 300)); console.log(prim.split('\n').filter(l => /Endless Staircase/.test(l)).join('\n'));
}
console.log('errors:', errs); await b.close();
