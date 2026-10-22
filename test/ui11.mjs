import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
const fsel = await p.$$('.mnrow select'); const fated = []; for (const s of fsel) { const opts = await s.$$eval('option', os => os.map(o => o.textContent)); if (opts[0].includes('Fated')) fated.push(s); }
console.log('fated selects', fated.length); await fated[0].selectOption('Hapless'); await p.waitForTimeout(100);
console.log('tag shown', await p.$$eval('.tag.bad', ts => ts.map(t => t.textContent).filter(x => /Hapless/.test(x))));
console.log('AA options', await p.$$eval('.tcard.argo select', ss => ss.map(s => [...s.options].map(o => o.textContent)).find(x => x.some(y => /War Propylon/.test(y)))));
await p.screenshot({ path: 'test/shot-c2.png' });
console.log('errors:', errs); await b.close();
