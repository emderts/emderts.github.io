import fs from 'fs';
import { Game } from '../src/engine/game.js';
import { reachable } from '../src/engine/core.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const yes = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (lv = 1, gear = ['Sirenblade', 'Siren Shield']) => { const g = new Game(data, { seed: 31 }); g.ask = yes; g.setup({ primordialId: 'harpy', level: lv, argo: [], awakening: { enabled: true, spark: true }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
const has = (g, re) => g.log.some(l => re.test(l.msg));
const catchD = async f => { try { await f(); } catch (e) { if (!e.titan && !e.chainBreak && !e.result) throw e; } };
const AI = n => data.primordials.harpy.ai.find(c => c.name === n);
{ const g = mk(3); ok(g.prim.anchor.c === 10 && g.prim.anchor.r === 7 && g.board.terrainAt(10, 7)?.type === 'Black Lake', 'harpy on black lake G10'); ok(g.prim.ra.supply === 3, 'lv3: 3 RA tokens'); ok(g.anchors[0].c === 8 && g.anchors[0].r === 11, 'red anchor K8'); ok(g.board.terrainAt(4, 7)?.type === 'Black Glacier' && g.board.terrainAt(13, 8)?.type === 'Giant Black Iceberg' && g.board.terrainAt(5, 13)?.type === 'Time-frozen City', 'terrain'); }
// RA
{ const g = mk(1); const [A] = g.titans; const sb = A.gear.find(x => x.card.name === 'Sirenblade'); await g.raPlace(A, sb); ok(g.raCovered(0) && g.prim.ra.supply === 0, 'sword space covered'); ok(g.raBlocks(A, sb, {}), 'sword blocked'); ok(!g.raBlocks(A, sb, { ignoreRA: true }), 'ignoreRA'); const sh = A.gear.find(x => x.card.name === 'Siren Shield'); ok(g.raAT(A, sh, {}) === 0 && g.raAT(A, { card: { traits: ['Spear'] } }, {}) === 1 && g.raAT(A, { card: { traits: ['Bow'] } }, {}) === 1, 'adjacent +1 AT'); await g.raPlace(A, sh); ok(g.raCovered(4) && !g.raCovered(0), 'no supply → token moved'); }
// slippery
{ const g = mk(1); const B = g.board; B.terrain.clear(); B.addTerrain(['E5', 'E6', 'E7'], { id: 's', type: 'Black Glacier', slippery: true, indestructible: true }); const r = reachable(B, { c: 4, r: 5 }, 6, new Set()); ok((!r.has('5,5') || r.get('5,5') === 6) && (!r.has('6,5') || r.get('6,5') === 6) && r.get('8,5') === 4, 'slide across glacier (stop only when movement ends)'); const r2 = reachable(B, { c: 4, r: 5 }, 2, new Set()); ok(r2.has('6,5'), 'can stop on slippery when movement runs out'); }
// pull + consume + regurgitate
{ const g = mk(5); const [A] = g.titans; A.pos = { c: 10, r: 2 }; for (const x of g.titans.slice(1)) x.pos = { c: 1, r: x.id + 1 }; await g.pullTitan(A, 1); ok(A.pos.r === 6 || g.isAdj(A), 'tentacled monstrosity +3 pull'); A.knockdown = 'falling'; await catchD(() => g.harpyConsume('all', A)); ok(!A.alive, 'consume adjacent knocked down'); }
{ const g = mk(2); g.prim.anchor = { c: 15, r: 11 }; await g.harpyRegurgitate(); ok(g.board.terrainAt(15, 11)?.slippery && !g.board.terrainAt(15, 11).ambrosia, 'lv2 regurgitate = black glacier pool'); }
// bleeding traits
{ const g = mk(9); const [A] = g.titans; await g.addCondition(A, 'Bleeding', { tokens: 2 }); const sp = g.speedOf(A); ok(sp === A.speed - 2, 'bleed your heart out speed'); await catchD(() => g.startTurnConditions(A)); ok(A.bleeding === 4 && !A.alive, 'rupture veins doubles → over limit 3 → die'); }
// trauma level raise
{ const g = mk(1); const [A] = g.titans; A.danger = 2; g.currentAI = { card: {}, dangerDealt: 0 }; await catchD(() => g.raiseTraumaLevel(A, 1, { name: 'x', kind: 'ATTACK' })); ok(A.danger === 4 && has(g, /Major Trauma/), 'raise trauma level 1: 2 → 4 Major'); }
// obol extra died
{ const g = mk(1); const [A] = g.titans; let n = 0; const pick0 = g.rng.pick.bind(g.rng); g.rng.pick = arr => { n = arr.length; return pick0(arr); }; await catchD(() => g.obolDraw(A, 10, 3)); ok(n >= 5, 'obol deck +3 You Died: size ' + n); }
// crits
{ const g = mk(1); const [A, B] = g.titans; await g.raPlace(A, A.gear[0]); await g.harpyCritical(A, { bp: { critical: "Discard 1 Rapid Adaptation token from the Battle. If there aren't any, another Titan may move up to 3 spaces and perform a Bonus Attack!" } }); ok(!g.raCovered(0) && g.prim.ra.supply === 0, 'exoribcage removes from battle'); await g.harpyCritical(A, { bp: { critical: 'Gain the Priority Target token. You may perform a Bonus Attack, ignoring the Rapid Adaptation Trait!' } }); ok(A.pt && A._ignoreRA && g.pendingFollowUp === A, 'bonus ignoring RA'); }
// perfection lock
{ const g = mk(9); const [A] = g.titans; await g.raPlace(A, A.gear[0]); g.raPerfection(); ok(g.prim.ra.spaces[0].locked && !(await g.raDiscard(false)), 'perfection locks'); }
// all AI cards
{ let bad = 0; for (const c of data.primordials.harpy.ai) for (const lv of [3, 8]) { const g = mk(lv); g.paradox = 4; try { await g.safe(() => g.resolveAI(c)); } catch (e) { if (!e.result) { bad++; console.log(c.name, e.stack.split('\n').slice(0, 3).join(' | ')); } } if (g.log.some(l => /미구현/.test(l.msg))) { bad++; console.log(c.name, g.log.filter(l => /미구현/.test(l.msg)).map(l => l.msg)); } } ok(!bad, 'all AI cards resolve'); }
// all BP responses + crits
{ let bad = 0; for (const b of data.primordials.harpy.bp) { const g = mk(4); const [A] = g.titans; A.pos = { c: 9, r: 7 }; for (const [k, v] of Object.entries(b.responses)) { try { await g.safe(() => g.doEffects(A, v, { response: true, queue: [], card: { name: b.name } })); } catch (e) { if (!e.result) { bad++; console.log(b.name, e.message); } } } try { await g.critical(A, { bp: b, t: A }); } catch (e) { if (!e.result) { bad++; console.log(b.name, 'crit', e.message); } } if (g.log.some(l => /미구현/.test(l.msg))) { bad++; console.log(b.name, g.log.filter(l => /미구현/.test(l.msg)).map(l => l.msg)); } } ok(!bad, 'all BP responses/crits'); }
{ const g = mk(1); const [A] = g.titans; for (const c of [...g.bp.cards]) c.at = 0; A.pos = { c: 9, r: 7 }; for (const x of g.titans.slice(1)) x.pos = { c: 1, r: x.id + 1 };
  let n = 0; while (n++ < 15 && !has(g, /Rapid Adaptation: .* 칸에 토큰/)) { A.knockdown = null; A.offBoard = null; for (const x of A.gear) x.exhausted = false; await catchD(() => g.titanAttack(A)); }
  ok(has(g, /Rapid Adaptation: .* 칸에 토큰/), 'wound in real attack places RA token');
  const sp = g.prim.ra.spaces.findIndex(x => x.n > 0); g.log.length = 0; n = 0; while (n++ < 15 && !has(g, /자동 실패/)) { A.knockdown = null; A.offBoard = null; for (const x of A.gear) x.exhausted = false; const w = A.gear.find(x => g.raSpacesFor(x).includes(sp)); g.ask = async q => q.title && /무기 선택/.test(q.title) ? q.options.find(o => o.value === w).value : yes(q); await catchD(() => g.titanAttack(A)); }
  ok(has(g, /자동 실패/), 'adapted class auto-fails'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
