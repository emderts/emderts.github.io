import fs from 'fs';
import { Game } from '../src/engine/game.js';
import { cellLabel } from '../src/engine/core.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const mk = lv => { const g = new Game(data, { seed: 9 }); g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: 'nietzschean', level: lv, argo: [], titans: [['Needle Sword'], ['Chain Whip'], ['Sail Spolas'], ['Sail Spolas']].map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
const AI = n => data.primordials.nietzschean.ai.find(a => a.name === n);
{ const g = mk(2); ok(g.weakspotCells().length === 0, 'no weakspot with empty discard');
  g.prim.anchor = { c: 10, r: 7 }; g.prim.facing = 'E'; // body cols 10-11, rows 7-8; front = east (col 12)
  g.ai.discard.push(AI('Grasscutter')); const w = g.weakspotCells(); console.log('  Grasscutter weakspot (facing E):', w.map(cellLabel), w);
  ok(w.length === 1 && w[0].c === 11, 'Grasscutter: front body column, side');
  g.ai.discard.push(AI('Abyssal Cleave')); const w2 = g.weakspotCells(); console.log('  Abyssal Cleave:', w2); ok(w2[0].c === 9, 'Abyssal Cleave: directly behind');
  g.ai.discard.push(AI('Rend')); ok(g.weakspotCells().length === 0, 'Rend (no diagram) → no weakspot');
  const lot = AI('Lot of the Weak'); await g.resolveAI(lot); g.ai.discard.push(lot); g.fixLot(); ok(g.ai.discard[0] === lot && g.ai.discard[g.ai.discard.length - 1].name === 'Rend', 'Lot of the Weak stays at the bottom');
  const dz = g.patternCells(AI('Dawn of Dust')); ok(dz.length > 40, 'Dawn of Dust diamond cells ' + dz.length);
}
{ const g = mk(3); g.ai.discard.push(AI('Grasscutter')); ok(g.weakspotCells().length === 0, 'Lv3 Flawless → no weakspot'); }
