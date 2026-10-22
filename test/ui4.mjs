import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
const sel = await p.$$('.loadout select'); await sel[0].selectOption('labyrinthauros'); await p.waitForTimeout(200);
const sel2 = await p.$$('.loadout select'); await sel2[1].selectOption('5'); await p.waitForTimeout(100);
await p.screenshot({ path: 'test/shot-lab-loadout.png' });
await p.click('button.primary'); await p.waitForTimeout(500);
await p.screenshot({ path: 'test/shot-lab-start.png' });
for (let i = 0; i < 60; i++) { const cells = await p.$$('.cell.move'); if (cells.length) { await cells[Math.floor(cells.length / 2)].click(); } else { const btns = await p.$$('#prompt button'); if (!btns.length) break; await btns[Math.min(1, btns.length - 1)].click(); } await p.waitForTimeout(80); }
await p.screenshot({ path: 'test/shot-lab-battle.png' });
console.log('errors:', errs); console.log((await p.$eval('#log', e => e.innerText)).split('\n').slice(-25).join('\n')); await b.close();
