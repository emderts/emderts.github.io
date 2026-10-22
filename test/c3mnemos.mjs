import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const yes = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (pid, mn, fated = [[], [], [], []]) => { const g = new Game(data, { seed: 9 }); g.ask = yes;
  g.setup({ primordialId: pid, level: 1, titans: ['warkeeper', 'skyseer', 'firestarter', 'returner'].map((cls, k) => ({ name: 'T' + k, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: mn[k] || [], fated: fated[k] || [], cls, gear: ['Sirenblade'] })) }); g.log.length = 0; return g; };
const safe = async f => { try { await f(); } catch (e) { if (!(e && (e.chainBreak || e.constructor.name === 'TitanDied'))) throw e; } };
const has = (g, re) => g.log.some(l => re.test(l.msg));
const act = async (g, t, re) => { const a = g.mnemosActions(t).find(x => re.test(x.label)); if (!a) return false; await a.value(); return true; };
// Fall from Eden
{ const g = mk('hypertime', [[{ name: 'A Fall from Eden', level: 3 }]]); const t = g.titans[0]; t.danger = 9;
  await g.knockdown(t); ok(t.offBoard === 'clock' && !t.knockdown, 'Fall from Eden L1: knockdown → Time-clocked');
  await g.timeArrive(t); const c = { name: 'X', pol: '-' }; ok(await g.maybeSecondChance(t, c), 'Fall from Eden L2 Second Chance'); }
// Disgraceful Parent
{ const g = mk('hekaton', [[{ name: 'Disgraceful Parent', level: 3 }]]); const t = g.titans[0]; t.danger = 6;
  ok(await act(g, t, /Hope 3/), 'DP L3 offered on empty pool'); ok(g.kratosPool.hope === 3 && t.fate === 1, 'DP L3 hope 3, fate+1'); }
// Hero by Mistake
{ const g = mk('hekaton', [[{ name: 'Hero by Mistake', level: 3 }]]); const t = g.titans[0]; for (const x of g.titans) x.pt = false; ok(await act(g, t, /Priority Target/), 'HbM L1'); ok(t.pt && t.fate === 1, 'HbM PT gained'); }
// Life of Regret + Queasy
{ const g = mk('harpy', [[{ name: 'Life of Regret', level: 3 }], []], [[], ['Queasy']]); const [t, q] = g.titans; t.danger = 5;
  await g.addCondition(t, 'Bleeding', { tokens: 2 }); ok(!t.conditions.includes('Bleeding'), 'Life of Regret L2 ignores Bleeding');
  await g.addCondition(q, 'Bleeding', { tokens: 1 }); ok(q.bleeding === 2, 'Queasy +1 bleeding ' + q.bleeding); }
// The Returned
{ const g = mk('hekaton', [[{ name: 'The Returned', level: 3 }]]); const t = g.titans[0]; t.danger = 7; g.reestablishAnchor(t); const p0 = g.precisionMods(t); ok(g.anchorPrec(t) === 1, 'Returned L1 +1 precision on anchor (non-C3)');
  t.pos = { c: t.pos.c + 1, r: t.pos.r }; await safe(() => g.kill(t)); ok(t.alive && has(g, /The Returned — 죽음에서/), 'Returned L3 return from death'); }
// Timekeeper's Child
{ const g = mk('hypertime', [[{ name: "Timekeeper's Child", level: 3 }]]); const t = g.titans[0]; await g.timeClock(t); await g.timeArrive(t); ok(t.tkBuff && !t.offBoard, 'Timekeeper L3 buff on arrival'); }
// Unearned Life L1 Assist + L3 Succor
{ const g = mk('hekaton', [[], [{ name: 'Unearned Life', level: 3 }]]); const [a, h] = g.titans; const an = g.prim.anchor; a.pos = { c: an.c - 1, r: an.r }; h.pos = { c: an.c - 1, r: an.r + 1 };
  g._potLeft = 1; const r = await g.assistCheck(a, { total: 6 }, 7); ok(r === 1 && h.fatigue === 'combat' && h.fate === 1, 'Unearned Life L1 Assist');
  h.fatigue = false; const A = { total: 6 }; const s = await g.succorCheck(a, A, 7); ok(s === 1 && A.succorObol && A.succorObol[0] === h, 'Unearned Life L3 Succor → obol queued'); }
// Clutch
{ const g = mk('hekaton', [[{ name: 'A Fall from Eden', level: 3 }]]); const t = g.titans[0]; t.danger = 9; g.rng.d10 = () => 9; const an = g.prim.anchor; t.pos = { c: an.c - 1, r: an.r }; g.titans.slice(1).forEach((o, i) => o.pos = { c: 1 + i, r: 1 });
  const orig = g.succorCheck.bind(g); g.succorCheck = async (tt, A, at) => { A.total = at - 1; return 0; }; await safe(() => g.chainSafe(() => g.titanAttack(t))); ok(has(g, /Clutch!/) && t.gear.find(x => x.card.name === 'Sirenblade').discarded, 'Clutch +1 and weapon discarded'); }
// Fated
{ const g = mk('hekaton', [], [['Fate-Hexed', 'Denigrated'], ['Late'], ['Psychosomatic Disorder'], ['Timid']]); const [a, b, c, d] = g.titans;
  g._actor = a; g.kratosPool.break += 2; ok(g.kratosPool.break === 1, 'Denigrated removes 1');
  g.timidHook(); for (const x of g.titans) x.pt = false; d.pt = true; await g.timidFlush(); ok(d.fate === 1, 'Timid +1 fate');
  let firstOpts = null; g.ask = async q => { if (q.title === '행동할 타이탄 선택' && !firstOpts) firstOpts = q.options.map(o => o.value.name); return yes(q); };
  try { await g.titanRound(); } catch (e) {} ok(firstOpts && !firstOpts.includes('T1'), 'Late not first: ' + firstOpts); }
{ const g = mk('hekaton', [], [['Enervated']]); g.ask = async q => /Enervated/.test(q.title || '') ? 'move' : yes(q); await g.startOfBattle().catch(() => {}); ok(g.titans[0].fatigue === 'move', 'Enervated movement fatigue'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
{ const g = mk('hekaton', [], [['Ikari'], ['Egotist'], ['Left Behind'], ['Late']]); const [a, b, c, d] = g.titans;
  const n = x => x.map(t => t.name).join(','); let ch = g.turnOrderChoices(g.titans, 0); ok(n(ch) === 'T1', 'Egotist first: ' + n(ch));
  ch = g.turnOrderChoices([a, c, d], 1); ok(!ch.includes(a) && ch.length >= 1, 'Ikari not before last: ' + n(ch));
  ch = g.turnOrderChoices([a, c], 2); ok(n(ch) === 'T2', 'Left Behind before Ikari: ' + n(ch));
  const t0 = mk('hekaton', [], [['Memory of Death']]); const m = t0.titans[0]; m.danger = 1; await t0.traumaDraw(m, 1).catch(() => {}); ok(t0.log.some(l => /Memory of Death/.test(l.msg)), 'Memory of Death'); }
{ const g = mk('hekaton', [], [['Selfishness']]); g._actor = g.titans[0]; const b0 = g.kratosPool.break; g.kratosPool.break += 2; ok(g.kratosPool.break === b0, 'Selfishness blocks tokens'); }
{ const g = mk('hekaton', [], [['Alone']]); const [a, ...o] = g.titans; a.pos = { c: 1, r: 1 }; o.forEach((x, i) => x.pos = { c: 15, r: 10 + i }); g.ask = async q => q.type === 'choice' && /행동 선택/.test(q.title) ? 'end' : yes(q); await g.safe(() => g.titanTurn(a)); ok(a.fate === 2, 'Alone +2 fate ' + a.fate); }
{ const g = mk('hekaton', [], [['Betrayal']]); const [a, b] = g.titans; a.pos = { c: 5, r: 5 }; b.pos = { c: 7, r: 5 }; let cells = null; g.ask = async q => { if (q.type === 'move') { cells = q.cells; return null; } return yes(q); }; await g.chooseMove(a, 3, '이동'); ok(cells && !cells.some(p => Math.abs(p.c - 7) + Math.abs(p.r - 5) === 1), 'Betrayal: no adjacent end cells'); }
console.log(fails ? `${fails} FAIL (extra)` : 'ALL PASS (extra)');
