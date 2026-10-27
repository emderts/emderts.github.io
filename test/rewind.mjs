import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
await p.click('button.primary'); await p.waitForTimeout(500);
const fp = () => p.evaluate(() => { const g = window.__game; return JSON.stringify({ r: g.round, t: g.titans.map(t => [t.pos, t.danger, t.fate, t.rage, t.alive]), a: g.prim.anchor, ai: g.ai.cards.map(c => c.name), bp: g.bp.cards.map(c => c.name), rng: g.rng.s }); });
let cpFp = null; let k = 0;
for (let i = 0; i < 400; i++) {
  if (!cpFp) { const cp = await p.evaluate(() => typeof bt !== 'undefined' ? bt.cp : (window.__bt ? window.__bt.cp : null)).catch(() => null); }
  const st = await p.evaluate(() => ({ r: window.__game.round, over: window.__game.over, cp: !!document.querySelector('#prim button.x') && /1라운드/.test(document.querySelector('#prim').innerText) }));
  if (st.over) break;
  if (st.cp && !cpFp) cpFp = await fp();
  if (st.r >= 2 && st.cp) break;
  const btns = await p.$$('#prompt button'); if (!btns.length) { await p.waitForTimeout(50); continue; } const txt = await p.$eval('#prompt', e => e.innerText); const multi = !!(await p.$('#prompt button.primary')); const pick = (multi || /행동 선택/.test(txt)) ? btns.length - 1 : (k++ % 3 === 0 ? Math.min(1, btns.length - 1) : 0); await btns[pick].click(); await p.waitForTimeout(20);
}
const before = await p.evaluate(() => window.__game.round);
const rb = await p.$$('#prim button.x'); const rw = []; for (const x of rb) if (/1라운드/.test(await x.innerText())) rw.push(x);
console.log('iters', 'round before rewind', before, 'rewind btn', rw.length);
if (rw.length) { await rw[0].click(); await p.waitForTimeout(100); const rb2 = await p.$$('#prim button.x'); for (const x of rb2) if (/1라운드/.test(await x.innerText())) { await x.click(); break; } await p.waitForTimeout(800); }
const after = await p.evaluate(() => ({ r: window.__game.round, log: document.querySelector('#log').innerText.split('\n').slice(-4).join(' | ') }));
console.log('after', JSON.stringify(after)); const fpA = await fp(); console.log((fpA === cpFp ? 'PASS' : 'FAIL') + ' state after rewind equals state at checkpoint'); if (fpA !== cpFp) console.log(cpFp, '\n', fpA);
console.log((after.r === 1 && /돌아옴|1라운드/.test(after.log) ? 'PASS' : 'FAIL') + ' rewind to round 1 titan round');
console.log('errors:', errs); await b.close();
