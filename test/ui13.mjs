import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/mnestis.html');
await p.evaluate(() => localStorage.clear()); await p.reload();
const addSel = async (ti, name) => { const sels = await p.$$('.titan-grid .tcard'); const s = await sels[ti].$$('select'); for (const x of s) { const has = await x.$(`option[value="${name}"]`); if (has && (await x.$eval('option', o => o.textContent)).includes('추가')) { await x.selectOption(name); await p.waitForTimeout(120); return true; } } return false; };
await addSel(0, 'Temenos Xiphos');
await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('ato.loadout')); const G = [['Temenos Xiphos', 'Puzzle Axe', 'Mazegma', 'Labyrinth Armor'], ['Muckbane', 'Collision Shield', 'Muck Armor', 'Medusa Extract'], ['Boom Spear', 'Faceshield', 'Impact Armor', 'Boost Kothornos'], ['Fireboat', 'Ladder Buckler', 'Stone Relief Armor', 'Covenant']]; L.titans.forEach((t, i) => t.gear = G[i]); localStorage.setItem('ato.loadout', JSON.stringify(L)); }); await p.reload(); await p.waitForTimeout(200);
console.log('errs shown', await p.$$eval('.err, .bad', e => e.map(x => x.textContent).slice(0, 5)));
const it = await p.$('.gearrow .link'); if (it) await it.click();
console.log('groups', await p.$$eval('optgroup', g => [...new Set(g.map(x => x.label))]));
await p.screenshot({ path: 'test/shot-gear2.png' });
console.log((await p.$eval('#lo-detail', e => e.innerText)).slice(0, 500).replace(/\n/g, ' | '));
await p.click('text=전투 시작'); await p.waitForTimeout(600);
for (let i = 0; i < 120; i++) { const cells = await p.$$('.cell.move'); if (cells.length) { await cells[Math.floor(cells.length / 2)].click(); } else { const btns = await p.$$('#prompt button'); if (!btns.length) break; await btns[Math.min(1, btns.length - 1)].click(); } await p.waitForTimeout(60); }
await p.screenshot({ path: 'test/shot-gear2-battle.png' });
const log = await p.$eval('#log', e => e.innerText); console.log(log.split('\n').filter(l => /Transform|Daze|Elation|Fire|Jump/.test(l)).slice(0, 12).join('\n'));
console.log('errors:', errs); await b.close();
