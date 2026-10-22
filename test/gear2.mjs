import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits;
const mk = (gears) => { const g = new Game(data, { seed: 7 }); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: 'temenos', level: 3, argo: [], titans: gears.map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
{ const g = mk([['Temenos Xiphos', 'Puzzle Axe', 'Mazegma'], ['Covenant', 'Hermes Cape', 'Cyclopean Totem', 'Cyclopean Linothorax']]); const [A, B] = g.titans;
  const xi = A.gear[0], ax = A.gear[1];
  ok(g.labSet(A) === 3, 'labSet 3 = ' + g.labSet(A));
  ok(/Break 2/.test(g.gearText(xi, A)) && !/Break 1/.test(g.gearText(xi, A)), 'Xiphos lab 2+ Break 2: ' + g.gearText(xi, A));
  A.danger = 3; ok(/Power Re-roll 2/.test(g.gearText(xi, A)), 'Mazegma +2 danger → Power Re-roll 2 at D3');
  ok(!/Deadly/.test(g.gearText(ax, A)) && /\+1 Precision/.test(g.gearText(ax, A)) && /Carving 1/.test(g.gearText(ax, A)), 'Puzzle Axe lab 3: Carving, +1 Precision, no Deadly (4+)');
  ok(g.skill(B, 'Courage') >= 1, 'Covenant +1 Courage → ' + g.skill(B, 'Courage'));
  ok(g.ambLimit(B) === 6, 'Amb limit 4+1+1 = ' + g.ambLimit(B));
  const sp0 = B.speed; ok(g.speedOf(B) === sp0 + 1, 'Hermes +1 Speed');
  g.transformGear(A, xi); ok(xi.card.name === 'Temenos Whip' && /Reach 2/.test(g.gearText(xi, A)), 'transform → Whip'); g.transformGear(A, xi); ok(xi.card.name === 'Temenos Xiphos', 'transform back');
  ok(g.freeActions(A).some(o => /Transform/.test(o.label)), 'Transform free action listed');
  const gr = data.gear.cards.find(c => c.name === 'Grand Ramaxe'); ok(JSON.stringify(g.weaponPowerDice(gr, 2, false)) === '["r","b","b"]' && g.weaponPowerDice(gr, 5, true).length === 3, 'powerByHits');
  const ka = data.gear.cards.find(c => c.name === 'Katarus'); ok(JSON.stringify(g.weaponPowerDice(ka, 3, true)) === '["r","r","r","b"]', 'fullHitPower');
}
{ const g = mk([['Muck Armor', 'Muckbane'], ['Stone Relief Armor', 'Impact Armor']]); const [A, B] = g.titans;
  A.ambrosia = 2; ok(JSON.stringify(g.armorDice(A)) === '["b"]', 'Muck Armor amb2 → black armor ' + JSON.stringify(g.armorDice(A)));
  ok(/becomes white/.test(g.gearText(A.gear[1], A)) && !/Armor-piercing/.test(g.gearText(A.gear[1], A)), 'Muckbane amb2 gates');
  B.danger = 7; ok(/by 2/.test(g.gearText(B.gear[1], B)) && !/by 1/.test(g.gearText(B.gear[1], B)), 'Impact 7+ instead');
  const x = await g.reduceSuffered(B, 'Pushbacks', 4); ok(x === 2, 'reduce pushback 4 → ' + x);
  B.fate = 0; const before = B.danger; B.danger = 7; await g.gainDanger(B, 1, { fromAttack: true }).catch(e => { if (!e.chainBreak) throw e; }); ok(g.log.some(l => /Reinforce 1/.test(l.msg)), 'Reinforce used'); ok(g.log.some(l => /Armor Re-roll/.test(l.msg)), 'Armor re-roll at D7? ' + B.danger);
}
{ const g = mk([['Ambramat Armor', 'Ambrostilts'], ['Fireboat']]); const [A, B] = g.titans; A.fate = 0;
  await g.gainAmbrosia(A, 3); ok(A.ambrosia === 1, 'Ambramat lowers to 1: ' + A.ambrosia);
  await g.gainAmbrosia(A, 1, true); ok(A.ambrosia === 1, 'Ambrostilts ignores terrain');
}
console.log(data.gear.cards.filter(c => c.cycle === 2).length, 'cycle II cards');
