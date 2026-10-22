import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
for (const [pid, lv] of [['cyclonus', 6], ['chimera', 7], ['nietzschean', 5], ['burden', 3], ['burden', 8]]) {
  await p.goto('file://' + process.cwd() + '/dist/mnestis.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200);
  { const sel = (await p.$$('.row select'))[0]; await sel.selectOption('hekaton'); await p.waitForTimeout(100); }
  await p.evaluate(([pid, lv]) => { const L = JSON.parse(localStorage.getItem('ato.loadout')); L.primordial = pid; L.level = lv; const G = [['Needle Sword', 'Great Breaker', 'Impact Armor'], ['Chain Whip', 'Collision Shield', 'Muck Armor'], ['Heavy Spear', 'Stone Relief Armor', 'Roll Breakers'], ['Carver Kopis', 'Amphoras Belt', 'Archon Pauldron']]; L.titans.forEach((t, i) => t.gear = G[i]); localStorage.setItem('ato.loadout', JSON.stringify(L)); }, [pid, lv]); await p.reload(); await p.waitForTimeout(300);
  console.log(pid, 'select shows', await p.$eval('.row select', e => e.value));
  await p.click('text=전투 시작'); await p.waitForTimeout(600);
  for (let i = 0; i < 160; i++) { const cells = await p.$$('.cell.move'); if (cells.length) { await cells[Math.floor(cells.length / 2)].click(); } else { const btns = await p.$$('#prompt button'); if (!btns.length) break; await btns[Math.min(1, btns.length - 1)].click(); } await p.waitForTimeout(50); }
  await p.screenshot({ path: `test/shot-${pid}.png` });
  const log = await p.$eval('#log', e => e.innerText); console.log(log.split('\n').filter(l => /Combo|This Train|Absorbed|Round|VP|Hardened|Leleges|Pull/.test(l)).slice(0, 14).join('\n'));
  console.log('terrain cells', await p.$$eval('.ter', e => e.map(x => x.getAttribute('class')).reduce((a, c) => (a[c] = (a[c] || 0) + 1, a), {})));
}
console.log('errors:', errs); await b.close();
