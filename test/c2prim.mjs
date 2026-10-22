import fs from 'fs';
import { Game } from '../src/engine/game.js';
import { cellLabel } from '../src/engine/core.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const mk = (pid, level, gears, askFn) => { const g = new Game(data, { seed: 5 }); g.ask = askFn || (async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; });
  g.setup({ primordialId: pid, level, argo: [], titans: gears.map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
// --- Cyclonus combo
{ const g = mk('cyclonus', 1, [['Needle Sword'], ['Chain Whip'], ['Heavy Spear'], ['Sail Spolas']]); const [A, B, C, D] = g.titans;
  ok(g.prim.combo && g.comboClass() === 'Mauls', 'combo track starts at Mauls');
  const a = g.prim.anchor; A.pos = { c: a.c - 1, r: a.r }; B.pos = { c: a.c + 2, r: a.r }; C.pos = { c: a.c, r: a.r + 2 }; D.pos = { c: 1, r: 1 }; A.pt = false; B.pt = false; C.pt = false; D.pt = true; D.ptLocked = false;
  g.rng.d10 = () => 5; let picked = null;
  g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; if (/Combo Break/.test(q.title)) { const o = q.options.find(x => x.value && x.value.g); picked = o && o.label; return o ? o.value : null; } const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  await g.comboPhase(); console.log('  picked:', picked);
  ok(/Chain Whip/.test(picked || '') && !/Needle Sword/.test(picked || ''), 'Mauls combo (Knife/Shield/Slabsword/Whip): Chain Whip breaks, Needle Sword (Sword) cannot: ' + picked);
  ok(g.comboClass() === 'Chain', 'track advanced to Chain: ' + g.comboClass());
  ok(B.pt || A.pt, 'breaker gained PT');
  console.log(g.log.filter(l => /Combo/.test(l.msg)).map(l => '  ' + l.msg).join('\n'));
}
// --- Cyclonus Unbeatable Guard / Dreadnought wound negation + Hardened
{ const g = mk('cyclonus', 3, [['Needle Sword'], ['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas']]); const [A] = g.titans; const a = g.prim.anchor; g.prim.facing = 'S'; A.pos = { c: a.c, r: Math.min(...g.primCells().map(x => x.r)) - 1 }; // front (S of prim = lower r)
  ok(g.inFront(A.pos), 'A in front'); g.rng.d10 = () => 9; g.bp.cards.unshift({ ...g.bp.cards.find(c => c.hardened) || g.bp.cards[0] });
  await g.chainSafe(() => g.titanAttack(A)); const msgs = g.log.map(l => l.msg).join('\n'); ok(/Unbeatable Guard/.test(msgs) || !/WOUND!/.test(msgs), 'front wound negated at Lv3'); console.log(g.log.filter(l => /Hardened|Unbeatable|Total Power/.test(l.msg)).map(l => '  ' + l.msg).join('\n')); }
// --- Chimera: This Train pushes target, slime trail, VP 2 slots, absorb
{ const g = mk('chimera', 5, [['Chain Whip'], ['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas']]); const [A, B, C, D] = g.titans; const a = g.prim.anchor; g.prim.facing = 'E';
  A.pos = { c: a.c + 4, r: a.r + 1 }; B.pos = { c: a.c + 3, r: a.r + 1 }; C.pos = { c: 1, r: 1 }; D.pos = { c: 1, r: 2 }; const b0 = { ...B.pos }, a0 = { ...A.pos };
  await g.thisTrain(A); console.log('  anchor', a, '→', g.prim.anchor, 'A', a0, '→', A.pos, 'B', b0, '→', B.pos);
  ok(g.prim.anchor.c > a.c, 'chimera moved east'); ok(B.pos.c > b0.c || !B.alive, 'adjacent B pushed'); ok([...g.board.terrain.values()].some(t => t.type === 'Ambrosia Trail'), 'Ambrosia Trail left behind');
  g.createVP(null); g.createVP(null); g.createVP(null); ok(g.prim.vp.count === 2 && g.prim.vp.tokens === 1, `VP 2 created + 1 token (${g.prim.vp.count}/${g.prim.vp.tokens})`);
  await g.absorb(C); ok(C.absorbed && C.onVP, 'C absorbed'); await g.knockback(C, 5); ok(C.absorbed, 'absorbed ignores knockback'); await g.indigestion(); await g.indigestion(); ok(!C.absorbed, 'regurgitated after 2 tokens');
  g.prim.state = 'Gelatinous'; g.rng.d10 = () => 9; A.pos = { c: g.prim.anchor.c + 3, r: g.prim.anchor.r + 1 }; g.prim.facing = 'E';
  await g.chainSafe(() => g.titanAttack(A)); console.log(g.log.filter(l => /Gelatinous|Corrosive|Plasmous|Metamorphosis|Total Power|AT/.test(l.msg)).slice(-5).map(l => '  ' + l.msg).join('\n'));
}
// --- Chimera level 3+ board, Voracious Bog chasm
{ const g = mk('chimera', 4, [['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas']]); ok([...g.board.terrain.values()].some(t => t.type === 'Spartan River Works' && t.destructible), 'Lv3+ river destructible'); const amb = [...g.board.terrain.values()].find(t => t.ambrosia); ok(!g.board.isChasm(amb.cell.c, amb.cell.r), 'ambrosia not chasm in titan round'); g.board.ambChasm = true; ok(g.board.isChasm(amb.cell.c, amb.cell.r), 'ambrosia chasm during prim round'); }
// --- patch4 checks
{ const g = mk('cyclonus', 4, [['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas']]); const [A] = g.titans; ok(g.dangerZoneCells().length === 4, 'danger zone 4 cells: ' + g.dangerZoneCells().map(p => `${p.c},${p.r}`).join(' '));
  A.rage = 5; g.rng.d10 = () => 4; await g.kratosRoll(A); ok(g.log.some(l => /Kratos Roll d10=4 vs Rage 5 → 실패/.test(l.msg)), 'kratos roll fail → card'); g.rng.d10 = () => 7; ok(await g.kratosRoll(A), 'kratos roll success');
  g.prim.facing = 'N'; const dz = g.dangerZoneCells()[0]; A.pos = { c: dz.c, r: dz.r - 1 }; g.rng.d10 = () => 3; g.ask = async q => q.type === 'move' ? (q.cells.find(c => c.c === dz.c && c.r === dz.r + 2) || null) : q.options[0].value; const d0 = A.danger;
  await g.chooseMove(A, 6, '이동'); ok(A.danger === d0 + 2 && g.log.some(l => /Danger Zone 통과/.test(l.msg)), `Danger Zone: ${d0} → ${A.danger}`); }
{ const g = mk('chimera', 5, [['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas'], ['Sail Spolas']]); const [A] = g.titans; ok(g.ambLimit(A) === 2, 'Highly Toxic Lv5: limit 4-2 = ' + g.ambLimit(A));
  g.prim.facing = 'E'; A.pos = { c: g.prim.anchor.c + 4, r: g.prim.anchor.r + 1 }; await g.thisTrain(A); const tr = [...g.board.terrain.values()].filter(t => t.type === 'Ambrosia Trail'); ok(tr.length >= 6 && tr.every(t => t.cell.c < g.prim.anchor.c && t.cell.c >= g.prim.anchor.c - 3), 'slime trail 3x3 behind: ' + tr.map(t => cellLabel(t.cell)).join(' ')); }
