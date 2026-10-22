import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
await p.click('text=Tree of Knowledge'); await p.waitForTimeout(100);
await p.click('.tnode.open button.x'); await p.waitForTimeout(100);
await p.click('text=전투 시작'); await p.waitForTimeout(800);
await p.evaluate(() => { const g = window.__game; g.woundStack.push({ card: null, value: 99 }); });
for (let i = 0; i < 200; i++) {
  const txt = await p.$eval('#prompt', e => e.innerText).catch(() => null); if (txt === null) break;
  if (/로드아웃으로/.test(txt)) { console.log('prompt:', txt.split('\n')[0]); break; }
  const cells = await p.$$('.cell.move'); if (cells.length) { await cells[0].click(); } else { const skip = await p.$('#prompt button:has-text("재굴림 안 함")'); if (skip) { await skip.click(); } else { const btns = await p.$$('#prompt button'); if (!btns.length) { await p.waitForTimeout(100); continue; } const texts = await Promise.all(btns.map(b => b.textContent())); let k = btns.length > 1 ? 1 : 0; if (/후퇴/.test(texts[k])) k = texts.findIndex(t => !/후퇴/.test(t)); await btns[Math.max(0, k)].click(); } }
  await p.waitForTimeout(50);
}
const log = await p.$eval('#log', e => e.innerText).catch(() => ''); console.log(log.split('\n').filter(l => /Tree|승리|격파/.test(l)).join('\n'));
console.log('done nodes:', await p.evaluate(() => JSON.parse(localStorage.getItem('ato.tree')).done));
console.log('errors:', errs); await b.close();
