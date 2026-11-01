// Fleischritter data integrity: setup references resolve, arcs/techniques/gear consistent with Rewards table and Knightbook component list.
import fs from 'fs';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const K = rd('../data/knights/fleischritter.json'), P = rd('../data/knights/peril_arcs.json'), G = rd('../data/gear/gear.json'), R = rd('../data/rosegraal/rewards.json');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const names = a => a.map(x => x.name);
ok(K.heroicArcs.length === 8 && P.arcs.fleischritter.length === 8, '8 Heroic Arcs + 8 Peril Arcs');
ok(JSON.stringify(names(K.heroicArcs).sort()) === JSON.stringify(names(P.arcs.fleischritter).sort()), 'Heroic and Peril Arc name sets match');
ok(K.techniques.length === 26, `26 Technique cards (Knightbook component list): ${K.techniques.length}`);
ok(K.setup.techniques.every(n => K.techniques.find(t => t.name === n && t.unlock === 'Start')) && K.techniques.filter(t => t.unlock === 'Start').length === 5, 'starting hand = the 5 Start techniques');
ok(K.heroicArcs.find(a => a.name === K.setup.heroicArc) && P.arcs.fleischritter.find(a => a.name === K.setup.perilArc) && K.talents.find(t => t.name === K.setup.talent), 'setup arc/talent names resolve');
for (const a of P.arcs.fleischritter) { const L = a.levels; ok(L.Uninjured.vigor[0] === a.maxVigor && L.Judicium.vigor[0] === 0 && L.Minor.vigor[0] === a.maxVigor - 1 && L.Major.vigor[0] === L.Minor.vigor[1] - 1 && L.Grave.vigor[0] === L.Major.vigor[1] - 1 && L.Grave.vigor[1] === 1, `${a.name}: Peril bands tile ${a.maxVigor}→0`); }
for (const k of Object.keys(P.arcs)) ok(P.arcs[k].length === 8 && P.arcs[k].every(a => [3, 4, 5, 6, 7, 8, 9].includes(a.levels.Judicium.heatLimit)), `${k}: 8 Peril Arcs, Judicium Heat Limit sane`);
// every Rogue's Path reward of kind H/P/T/G for Fleischritter must exist in data
const rewardNames = kind => Object.values(R.levels).flatMap(lv => lv.fleischritter[kind]).map(r => typeof r === 'string' ? r : r.name);
ok(rewardNames('H').every(n => K.heroicArcs.find(a => a.name === n)), 'all Heroic Arc rewards exist: ' + rewardNames('H').filter(n => !K.heroicArcs.find(a => a.name === n)).join(','));
ok(rewardNames('T').every(n => K.techniques.find(t => t.name === n)), 'all Technique rewards exist: ' + rewardNames('T').filter(n => !K.techniques.find(t => t.name === n)).join(','));
const classTech = Object.values(R.levels).flatMap(lv => lv.fleischritter.C).filter(c => c.kind === 'technique').map(c => c.name);
ok(classTech.every(n => K.techniques.find(t => t.name === n)), 'all Class-technique rewards exist: ' + classTech.filter(n => !K.techniques.find(t => t.name === n)).join(','));
ok(rewardNames('G').every(n => G.gear.find(g => g.name === n && g.knight === 'fleischritter')), 'all Gear rewards exist: ' + rewardNames('G').filter(n => !G.gear.find(g => g.name === n)).join(','));
ok(K.setup.gear.every(n => G.gear.find(g => g.name === n)), 'starting gear exists (Knighves, Chipped Axe)');
for (const k of Object.keys(R.knights)) { const want = Object.values(R.levels).flatMap(lv => lv[k].G).map(r => (typeof r === 'string' ? r : r.name).split(' // ')[0]); const miss = want.filter(n => !G.gear.find(g => g.name === n)); ok(miss.length === 0, `${k}: all 5 reward gear transcribed${miss.length ? ' — missing ' + miss.join(', ') : ''}`); }
ok(G.gear.every(g => ['weapon', 'armor', 'support'].includes(g.type) && (g.type !== 'weapon' || g.attackDice >= 1)), 'gear types valid, weapons have attack dice');
const unclear = K.heroicArcs.reduce((a, x) => a + x.unclear.length, 0) + K.techniques.reduce((a, x) => a + x.unclear.length, 0) + G.gear.reduce((a, x) => a + x.unclear.length, 0);
console.log(`INFO unclear items: arcs ${K.heroicArcs.reduce((a, x) => a + x.unclear.length, 0)}, techniques ${K.techniques.reduce((a, x) => a + x.unclear.length, 0)}, gear ${G.gear.reduce((a, x) => a + x.unclear.length, 0)} (total ${unclear})`);
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
