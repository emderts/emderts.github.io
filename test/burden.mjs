import fs from 'fs';
import { Game } from '../src/engine/game.js';
import { cellLabel } from '../src/engine/core.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const mk = lv => { const g = new Game(data, { seed: 3 }); g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: 'burden', level: lv, argo: [], titans: [['Needle Sword'], ['Chain Whip'], ['Sail Spolas'], ['Sail Spolas']].map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
const AI = n => data.primordials.burden.ai.find(a => a.name === n);
{ const g = mk(1); const [A, B, C, D] = g.titans; ok(g.ai.cards.some(c => c.sisTask), 'Lv1: Sisyphean Task in deck'); ok(!A.sisyphean, 'no sisyphean at Lv1');
  // kickback bounce: place A right of a column with column to its east
  const col = [...g.board.terrain.values()].find(t => t.type === 'Column'); A.pos = { c: col.cell.c - 1, r: col.cell.r }; g.prim.anchor = { c: col.cell.c - 4, r: col.cell.r - 1 }; B.pos = { c: 2, r: 2 }; C.pos = { c: 2, r: 3 }; D.pos = { c: 2, r: 4 };
  const p0 = { ...A.pos }; await g.kickback(A, 4, 'E'); console.log('  kickback from', cellLabel(p0), 'col at', cellLabel(col.cell), '→', A.alive ? cellLabel(A.pos) : 'dead', g.log.filter(l => /튕겨|Crash/.test(l.msg)).map(l => l.msg));
  ok(g.log.some(l => /튕겨/.test(l.msg)) && A.pos.c < col.cell.c, 'bounced off column, moved towards column 1 (W)');
  // edge death
  A.alive = true; A.pos = { c: 2, r: 8 }; try { await g.kickback(A, 3, 'W'); } catch (e) { if (!e.titan) throw e; } ok(!A.alive && g.log.some(l => /산 아래/.test(l.msg)), 'kicked below column 1 → dies');
}
{ const g = mk(2); const [A] = g.titans; await g.startOfBattle(); ok(g.titans.every(t => t.sisyphean), 'Lv2: all Titans Sisyphean'); ok(!g.ai.cards.some(c => c.sisTask), 'Sisyphean Task removed');
  g.prim.anchor = { c: 10, r: 6 }; A.pos = { c: 9, r: 7 }; g.prim.anchor = { c: 10, r: 6 }; await g.spiral(A); ok(g.prim.anchor.c === 10 && g.primCells().every(p => p.c > A.pos.c), 'already above → no move'); A.pos = { c: 9, r: 7 }; await g.spiral(A); ok(g.primCells().every(p => p.c > A.pos.c), 'spiral: burden ends above target ' + cellLabel(g.prim.anchor));
  A.pos = { c: 20, r: 7 }; g.prim.anchor = { c: 18, r: 6 }; for (const x of g.titans.slice(1)) x.pos = { c: 2, r: 2 + x.id }; await g.spiral(A); console.log('  edge case anchor', g.prim.anchor, 'A', A.pos); ok(g.primContains({ c: 20, r: 7 }) && A.pos.c < 20, 'spiral at edge: burden takes target space, target displaced lower');
}
{ const g = mk(4); const [A] = g.titans; A.pos = { c: 3, r: 7 }; g.prim.anchor = { c: 4, r: 6 }; g.rng.d10 = () => 1; A.danger = 0; g.currentAI = { card: AI('Hurtle'), dangerDealt: 0 }; await g.safe(() => g.primAttackOn(A, AI('Hurtle'))); ok(g.log.some(l => /Antisherpa: \+/.test(l.msg)), 'Antisherpa +2/hit in cols 1-7'); }
{ const g = mk(5); ok([...g.board.terrain.values()].some(t => t.slippery), 'Lv5 slippery tiles'); const [A] = g.titans; const sl = [...g.board.terrain.values()].find(t => t.slippery); A.pos = { ...sl.cell }; g.titans.slice(1).forEach((x, i) => x.pos = { c: sl.cell.c - 2, r: Math.min(14, sl.cell.r + 2 + i) }); await g.slipCheck(A); ok(!g.board.terrainAt(A.pos.c, A.pos.r)?.slippery && A.pos.c < sl.cell.c, 'Icecapade slides towards column 1: ' + cellLabel(A.pos)); }
{ const g = mk(8); const [A, B, C, D] = g.titans; A.pos = { c: 3, r: 5 }; B.pos = { c: 12, r: 5 }; C.pos = { c: 12, r: 6 }; D.pos = { c: 12, r: 7 }; ok(g.timefront === 1, 'timefront starts 1'); try { await g.timefrontAdvance(); } catch (e) { if (!e.titan) throw e; } ok(g.timefront === 4 && !A.alive && B.alive, 'timefront 4: A erased'); }
{ const g = mk(9); const [A] = g.titans; A.sisyphean = true; g.woundStack.push({ card: null, value: 1 }); await g.endOfPrimRoundC2(); ok(g.woundCount() === 0, 'Game is Rigged: heal'); }
// --- Tethered
{ const g = mk(1); const [A, B, C, D] = g.titans; g.prim.anchor = { c: 18, r: 12 }; A.pos = { c: 3, r: 5 }; B.pos = { c: 9, r: 5 }; C.pos = { c: 9, r: 6 }; D.pos = { c: 9, r: 7 };
  ok(g.tetherScore() === 0, 'start within limit');
  ok(!g.tetherAllows(B, { c: 16, r: 5 }) || g.tetherExcess(A, new Map([[B, { c: 16, r: 5 }]])) === 0, 'B leaving: still C/D near A');
  ok(!g.tetherAllows(A, { c: 3, r: 5 }) || true, 'noop');
  // A moves far up past everyone: A would be top with closest below at col 9 → ok if ≤10
  ok(g.tetherAllows(A, { c: 15, r: 5 }), 'A to col 15 ok (6 from col 9)');
  B.pos = { c: 14, r: 5 }; C.pos = { c: 14, r: 6 }; D.pos = { c: 14, r: 7 }; ok(g.tetherExcess(A) > 0, 'A now >10 from closest above');
  ok(!g.tetherAllows(A, { c: 2, r: 5 }) && g.tetherAllows(A, { c: 5, r: 5 }), 'violating titan may only move closer');
  A.pos = { c: 5, r: 5 }; const r = await g.tetherStep(A, { c: 3, r: 5 }); ok(r === 'stop', 'involuntary move beyond limit stops');
  A.pos = { c: 2, r: 5 }; try { await g.tetherEndOfRound(); } catch (e) { if (!e.titan) throw e; } ok(!A.alive, 'end of titan round: violating titan dies'); }
{ const g = mk(3); const [A, B, C, D] = g.titans; g.prim.anchor = { c: 18, r: 12 }; let row = 1; for (let r = 1; r <= 14; r++) { if (g.tetherDist({ c: 3, r }, { c: 13, r }) === 10 && g.tetherDist({ c: 2, r }, { c: 13, r }) === 11 && !g.board.isObstacle(2, r) && !g.board.isObstacle(3, r)) { row = r; break; } } A.pos = { c: 3, r: row }; B.pos = { c: 13, r: row }; C.pos = { c: 14, r: row }; D.pos = { c: 15, r: row }; ok(g.tetherExcess(A) === 0, 'row ' + row + ' A within limit');
  const r = await g.tetherStep(A, { c: 2, r: row }); ok(r === 'ok', 'Lv3 Ties: involuntary move continues past limit'); A.pos = { c: 2, r: row }; ok(g.untethered(A), 'A untethered');
  g.ask = async q => q.type === 'move' ? (q.cells[0] || null) : q.options[0].value; const p0 = { ...A.pos }; await g.chooseMove(A, 5, '이동'); ok(A.pos.c === p0.c && A.pos.r === p0.r, 'untethered titan cannot move voluntarily');
  try { await g.tetherStep(A, { c: 1, r: row }); } catch (e) { if (!e.titan) throw e; } ok(!A.alive, 'untethered titan pushed again falls'); }
