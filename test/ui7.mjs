import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
// duplicate gear: add Siren Shield (2 copies) to titans 2 and 3 → 3 total
const adds = await p.$$('.tcard .gearlist + select');
await adds[1].selectOption('Siren Shield'); await p.waitForTimeout(100);
const adds2 = await p.$$('.tcard .gearlist + select');
const opts = await adds2[2].$$eval('option', os => os.map(o => o.value));
console.log('Siren Shield still offered to titan 3?', opts.includes('Siren Shield'));
// mnemos duplicate: set titan 2 Lv2 mnemos to Family Feud (used by titan 1)
const mn = await p.$$('.mnrow select'); const dis = await mn[3].$eval('option[value="Family Feud"]', o => o.disabled); console.log('Family Feud disabled for titan 2?', dis);
// preset save/load
await p.fill('input[placeholder="프리셋 이름"]', 'test1'); await p.click('text=현재 구성 저장'); await p.waitForTimeout(100);
const sel = await p.$('.tcard.argo select'); const n = await p.$$eval('.tcard.argo select option', os => os.map(o => o.textContent)); console.log('presets', n);
const start = await p.$eval('button.primary', b => b.disabled); console.log('start disabled', start, 'err text:', await p.$eval('.loadout', e => (e.querySelector('.err') || {}).textContent));
await p.screenshot({ path: 'test/shot-presets.png' });
console.log('errors:', errs); await b.close();
