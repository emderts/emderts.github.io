import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html'); await p.waitForTimeout(800);
const opts = await p.$$eval('select option', os => os.map(o => o.textContent));
const locked = opts.filter(t => /🔒/.test(t)).length; const inAdd = opts.some(t => /Gigantas/.test(t) && !/🔒/.test(t) && /—/.test(t));
console.log('locked browse', locked, 'Gigantas addable', inAdd, 'errors:', errs);
await b.close();
