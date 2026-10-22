import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1400 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
await p.click('text=Tree of Knowledge'); await p.waitForTimeout(150);
const n = await p.$$('.tnode'); console.log('nodes', n.length, 'open', (await p.$$('.tnode.open')).length);
await p.click('.tnode.open button.x'); await p.waitForTimeout(150);
const sels = await p.$$eval('.loadout select', ss => ss.slice(0, 2).map(s => s.value)); console.log('selected prim/level', sels);
// simulate victory: mark complete manually via page API
await p.evaluate(() => { const btns = [...document.querySelectorAll('.tnode.cur button')]; btns[1].click(); });
await p.waitForTimeout(150); console.log('open after', (await p.$$('.tnode.open')).length, 'done', (await p.$$('.tnode.done')).length);
await p.screenshot({ path: 'test/shot-tree.png', fullPage: false });
console.log('errors:', errs); await b.close();
