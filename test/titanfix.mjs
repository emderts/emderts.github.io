import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'temenos', 'sun', 'midascore', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const yes = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (classes, pid = 'hekaton') => { const g = new Game(data, { seed: 5 }); g.ask = yes; g.setup({ primordialId: pid, level: 1, awakening: { enabled: true, spark: true }, titans: classes.map((cls, k) => ({ name: cls, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls, gear: ['Sirenblade'] })) }); g.log.length = 0; return g; };
const god = (g, t, name) => { t.godform = { def: data.decks.godforms.find(x => x.name === name), trespass: 2 }; };
const safe = async f => { try { await f(); } catch (e) { if (!(e && (e.chainBreak || e.constructor.name === 'TitanDied'))) throw e; } };
// Stubborn ignores knockdown without prompts
{ const g = mk(['firestarter', 'dreamwalker']); const [F] = g.titans; let asked = 0; g.ask = async q => { asked++; return yes(q); }; await g.knockdown(F); ok(!F.knockdown && asked === 0, 'Stubborn: no knockdown, no prompt'); }
// Spartan-Bred ignores Strong Eat extra YD
{ const g = mk(['firestarter', 'dreamwalker']); ok(g.ab(g.titans[0], 'Spartan-Bred'), 'firestarter Spartan-Bred'); }
// Survive! only instant death
{ const g = mk(['ascender', 'dreamwalker']); const [A] = g.titans; A.ascend = 2; await safe(() => g.kill(A)); ok(!A.alive && A.ascend === 2, 'Survive! not on normal death'); }
// Poseidon cannot gain ambrosia; Demeter stays on knockback
{ const g = mk(['dreamwalker', 'earthshaker']); const [A, B] = g.titans; god(g, A, 'Poseidon'); await g.gainAmbrosia(A, 2); ok(!A.ambrosia, 'Poseidon no ambrosia'); god(g, B, 'Demeter'); const p0 = { ...B.pos }; await g.knockback(B, 3); ok(B.pos.c === p0.c && B.pos.r === p0.r, 'Demeter no knockback'); await g.knockdown(B); ok(!B.knockdown, 'Demeter no knockdown'); }
// Hephaestus dies to ambrosia limit
{ const g = mk(['dreamwalker', 'earthshaker']); const [A] = g.titans; god(g, A, 'Hephaestus'); A.ambrosia = g.ambLimit(A); await safe(() => g.gainAmbrosia(A, 1)); ok(!A.alive, 'Hephaestus dies to ambrosia limit'); }
// Godly Comforter saves bleeding death
{ const g = mk(['dreamwalker', 'earthshaker']); const [A, B] = g.titans; god(g, B, 'Dionysus'); A.conditions.push('Bleeding'); A.bleeding = 9; await g.bleedLimit(A); ok(A.alive && B.godform.trespass === 1 && A.bleeding === 3, 'Godly Comforter (bleeding ' + A.bleeding + ')'); }
// Helios: curse death ignored
{ const g = mk(['dreamwalker', 'earthshaker']); const [A] = g.titans; god(g, A, 'Helios Apollon Exalted'); await safe(() => g.kill(A, { curse: true })); ok(A.alive, 'Pitiful as the Sun'); }
// Rouse affects rage gates; reset
{ const g = mk(['dreamwalker', 'earthshaker']); const [A] = g.titans; A.rage = 3; A.rouseBonus = 2; ok(g.rageEff(A) === 5, 'rageEff with rouse'); }
// Rush: no valid cell when adjacent
{ const g = mk(['dreamwalker', 'earthshaker']); const [A] = g.titans; A.danger = 3; const cells = g.primCells(); const c = cells[0]; const adj = [[1,0],[-1,0],[0,1],[0,-1]].map(([x,y]) => ({ c: c.c + x, r: c.r + y })).find(p => g.board.inBounds(p.c, p.r) && !g.primContains(p) && !g.titanAt(p.c, p.r)); A.pos = adj; A._rushOK = true; await g.chooseMove(A, 6, 'Rush', 3); ok(A._rushOK === false && A.pos === adj, 'Rush blocked when already adjacent'); }
// Overbreak C4 / Lifeline C4 / UKB
{ const g = mk(['dreamwalker', 'earthshaker'], 'midascore'); const [A] = g.titans; ok((g.prim.def.cycle || 0) >= 4, 'midascore is cycle 4'); }
{ const g = mk(['dreamwalker', 'earthshaker']); const [A, B] = g.titans; god(g, B, 'Demeter'); const p0 = { ...B.pos }; await safe(() => g.knockback(B, 2, null, true)); ok(B.pos.c !== p0.c || B.pos.r !== p0.r || !B.alive, 'Demeter cannot ignore Unavoidable Knockback'); }
