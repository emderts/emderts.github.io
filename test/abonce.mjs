import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const mk = (pid, gears, lv = 3) => { const g = new Game(data, { seed: 4 }); g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: pid, level: lv, argo: [], titans: gears.map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
{ const g = mk('chimera', [['Analyticos Module'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; await g.startOfBattle(); g.round = 1; A.fate = 0; A.turn = { moved: false, attacked: false };
  const find = () => g.freeActions(A).find(o => /Analyticos Module/.test(o.label));
  const o = find(); ok(!!o, 'ability offered'); if (o) await o.value();
  for (const q of A.gear) q.exhausted = false; ok(!find(), 'same ability not offered again after unexhaust (same round)');
  g.round = 2; ok(!!find(), 'offered again next round');
}
{ const g = mk('chimera', [['Analyticos Module'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; const G = A.gear.find(q => q.card.name === 'Analyticos Module'); const t0 = G.card.text; G.card.text = 'Ψ⟳ Gain +2 Speed for your next Move. Ψ⟳ Place 1 Break or 1 Opening in the Kratos Pool.'; const k1 = g.abKey(A, 'Analyticos Module: 다음 이동 Speed +2 (Fate+1, 소진)'), k2 = g.abKey(A, 'Analyticos Module: Kratos Pool에 Break 1 (Fate+1, 소진)'); ok(k1 && k2 && k1 !== k2, 'multi-ability card: separate keys'); G.card.text = t0; }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A, B, C] = g.titans; const pc = g.primCells(); const p0 = pc[0];
  const adjCell = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ c: p0.c + dx, r: p0.r + dy })).find(q => g.board.inBounds(q.c, q.r) && !pc.some(z => z.c === q.c && z.r === q.r));
  A.onVP = true; B.pos = adjCell; C.pos = { c: adjCell.c + (adjCell.c - p0.c) * 3, r: adjCell.r + (adjCell.r - p0.r) * 3 };
  ok(g.tDist(A, B) === 1, 'VP titan adjacent to titan adjacent to Primordial'); ok(g.tDist(B, A) > 1, 'ground titan NOT adjacent to VP titan'); ok(g.tDist(A, C) > 1, 'VP titan not adjacent to far titan'); }
