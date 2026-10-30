import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt', 'meduketos', 'titanx'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const yes = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (lv = 1, seed = 41) => { const g = new Game(data, { seed }); g.ask = yes; g.setup({ primordialId: 'titanx', level: lv, argo: [], awakening: { enabled: true, spark: true }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Sirenblade', 'Siren Shield'] })) }); g.log.length = 0; return g; };
const has = (g, re) => g.log.some(l => re.test(l.msg));
const catchD = async f => { try { await f(); } catch (e) { if (!e.titan && !e.chainBreak && !e.result) throw e; } };
const O = data.primordials.titanx;
{ const g = mk(1); ok(g.prim.size === 1 && g.prim.anchor.c === 10 && g.prim.anchor.r === 7 && g.sig.name === 'Afterthought' && g.routine.name === 'Eyes on the Gleaming Prize' && g.prim.feints.deck.length === 10 && !g.bp.cards.some(b => b.overstep), 'setup: 1x1 at G10, sig/routine, 10 Feints, Overstep set aside');
  ok([...g.trauma.minor.cards].some(c => c.code === 'EM2624'), 'Titan X Trauma (Pain of Dying) in deck'); }
{ const g = mk(5); ok(g.board.cols === 10 && g.board.rows === 14, 'Play for Keeps: half board 10x14'); const g8 = mk(8); ok(g8.board.cols === 10 && g8.board.rows === 7 && g8.prim.anchor.c === 10 && g8.prim.anchor.r === 4, 'Just Fold: quarter board, Titan X D10'); }
{ const g = mk(2); ok(!g.trait('Toying') && g.trait('Dazzling Speed'), 'Lv2: -Toying'); const g1 = mk(1); ok(g1.trait('Toying') && !g1.trait('Death of Hope'), 'Toying disables Death of Hope'); }
// flash step
{ const g = mk(1); await g.startOfBattle(); const [A] = g.titans; A.pos = { c: 10, r: 10 }; g.prim.anchor = { c: 10, r: 7 }; for (const x of g.titans.slice(1)) x.pos = { c: 2 + x.id, r: 2 }; await g.txFlashStep(A); ok(g.prim.anchor.c === 10 && g.prim.anchor.r === 14 && A.alive && g.prim.facing === 'S', 'Flash Step: past target 8 spaces → board edge (row 14), faces target (' + JSON.stringify(g.prim.anchor) + ')'); }
{ const g = mk(1); await g.startOfBattle(); const [A, B] = g.titans; g.prim.anchor = { c: 10, r: 13 }; A.pos = { c: 5, r: 5 }; B.pos = { c: 5, r: 1 }; await catchD(() => g.txMove('N', 3)); ok(g.prim.anchor.r === 14 && A.pos.r === 3 && !B.alive, 'Unholy Halo: Titan X at edge → others move opposite; off-board Titan drowns'); }
// feints
{ const g = mk(3); await g.startOfBattle(); g.prim.feints.deck = [g.prim.def.feints.find(f => f.name === 'Riposte'), ...g.prim.feints.deck]; const a0 = g.titans.map(t => t.ambrosia); await g.txFeint(); ok(g.prim.feints.status && g.prim.feints.status.name === 'Riposte' && g.titans.every((t, i) => t.ambrosia === a0[i] + 1), 'Feint status + Nemesis Vow Ambrosia'); }
{ const g = mk(1); await g.startOfBattle(); g.prim.feints.deck = [g.prim.def.feints.find(f => f.name === 'Overstep (I)')]; await g.txFeint(); ok(g.bp.cards.some(b => b.overstep), 'Overstep (I) feint shuffles Overstep BP in'); }
{ const g = mk(1); await g.startOfBattle(); g.titans.forEach(t => t.pain = 3); g.prim.feints.deck = [g.prim.def.feints.find(f => f.name === 'Junction Seizure')]; const d0 = g.titans.map(t => t.danger); await catchD(() => g.txFeint()); ok(g.titans.every(t => !t.alive || t.pain === 0), 'Junction Seizure: 10+ Pain → discarded'); }
// targeting
{ const g = mk(6); await g.startOfBattle(); const L = g.txTargets(O.ai.find(a => a.name === 'Never Saw Me')); ok(L.length >= 2, 'You Cannot Advance / Faster Than Thought → simultaneous (' + L.length + ')'); }
{ const g = mk(1); await g.startOfBattle(); const [A, B] = g.titans; A.pain = 2; B.pain = 1; ok(g.txPick(['Least Pain', 'Closest Titan in sight'])[0] === B, 'Least Pain'); }
// all AI cards resolve
{ let bad = 0; for (const c of O.ai) for (const lv of [1, 4, 7]) { const g = mk(lv, 9); await g.startOfBattle(); try { await g.safe(() => g.resolveAI(c)); } catch (e) { if (!e.result) { bad++; console.log(c.name, lv, e.stack.split('\n').slice(0, 4).join(' | ')); } } const u = g.log.filter(l => /미구현|수동 적용/.test(l.msg)); if (u.length) { bad++; console.log(c.name, [...new Set(u.map(l => l.msg))]); } } ok(!bad, 'all AI cards resolve'); }
// BP
{ let bad = 0; for (const bp of O.bp.filter(b => !b.overstep)) { const g = mk(5, 9); await g.startOfBattle(); const A = g.titans[0]; A.pos = { c: g.prim.anchor.c - 1, r: g.prim.anchor.r }; if (g.titanAt(A.pos.c, A.pos.r) !== A) A.pos = { c: g.prim.anchor.c + 1, r: g.prim.anchor.r };
  for (const [k, txt] of Object.entries(bp.responses)) { try { await g.safe(() => g.doEffects(A, txt, { response: true })); } catch (e) { if (!e.result && !e.titan) { bad++; console.log('ERR', bp.name, k, e.stack.split('\n').slice(0, 3).join('|')); } } }
  try { await g.safe(() => g.txCritical(A, { t: A, bp })); } catch (e) { if (!e.result) { bad++; console.log('ERR crit', bp.name, e.message); } }
  const u = [...new Set(g.log.map(l => l.msg).filter(m => /미구현|수동 적용/.test(m)))]; if (u.length) { bad++; console.log(bp.name, u); } } ok(!bad, 'all BP responses / crits resolve'); }
// crit strike
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; g._critFailT = A; const p0 = A.pain || 0; await catchD(() => g.txEffect(A, 'Each hit deals 3 DANGER.', 1, O.ai.find(a => a.name === 'Never Saw Me'))); ok((A.pain || 0) >= p0 + 3 || !A.alive, 'Critical Strikes: Deadly Wound → Pain 3'); }
{ const g = mk(4); await g.startOfBattle(); const A = g.titans[0]; await g.gainPain(A, 2, 't'); ok(A.pain === 4, 'Truth of the Shoals doubles Pain'); }
// full battles
{ let bad = 0, res = {}; for (const lv of [1, 3, 5, 7, 9]) for (const seed of [1, 2]) { const g = mk(lv, seed); g.ask = async q => { if (q.type === 'multi') return []; const o = q.options || []; if (q.type === 'move') return (q.cells || [])[0] || null; const ch = o.filter(x => !x.disabled); const at = ch.find(x => x.value === 'attack'); if (at) return 'attack'; return (ch.find(x => x.value === 'end') || ch[0] || {}).value; }; try { const r = await g.run(); res[r] = (res[r] || 0) + 1; } catch (e) { bad++; console.log('lv', lv, seed, e.stack.split('\n').slice(0, 5).join(' | ')); } const u = g.log.filter(l => /미구현|수동 적용/.test(l.msg)); if (u.length) { bad++; console.log(lv, [...new Set(u.map(l => l.msg))].slice(0, 5)); } } ok(!bad, 'full battles run ' + JSON.stringify(res)); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
