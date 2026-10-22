import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'temenos', 'harpy', 'babel', 'midascore', 'oracle'].filter(i => fs.existsSync(new URL(`../data/primordials/${i}.json`, import.meta.url)));
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits;
const yes = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options.find(o => o.value === true) || q.options.find(o => o.value != null) || q.options[0]; return o && o.value; };
const mk = (mn = [], fated = [], pid = 'temenos') => { const g = new Game(data, { seed: 7 }); g.ask = yes; g.setup({ primordialId: pid, level: 3, argo: [], titans: [0, 1].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: i ? [] : mn, fated: i ? [] : fated, cls: 'dreamwalker', gear: ['Sirenblade'] })) }); g.log.length = 0; for (const t of g.titans) for (const m of t.mnemos || []) m.level = 3; return g; };
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const acts = (g, t, re) => g.mnemosActions(t).filter(o => re.test(o.label));
// Family Feud / Disgraceful Parent: closing token makes pool non-empty
{ const g = mk([{ name: 'Family Feud', level: 3 }, { name: 'Disgraceful Parent', level: 3 }]); const [A] = g.titans; A.danger = 9; A.rage = 9; A.fate = 0; g.kratosPool.closing = 1; ok(!acts(g, A, /풀이 비었음/).length, 'closing token → not empty'); g.kratosPool.closing = 0; ok(acts(g, A, /풀이 비었음/).length >= 1, 'empty pool offers'); }
// Superstitious blocks Thousandth Night L2
{ const g = mk([{ name: 'The Thousandth Night', level: 3 }], ['Superstitious']); const [A] = g.titans; A.danger = 9; A.rage = 9; const r = await g.maybeSecondChance(A, { name: 'x', pol: '-' }); ok(r === false, 'Superstitious blocks redraw'); }
// Siren Survivor L1 can drop bleeding token
{ const g = mk([{ name: 'Siren Survivor', level: 3 }]); const [A] = g.titans; A.danger = 9; A.rage = 9; A.conditions.push('Bleeding'); A.bleeding = 2; const a = acts(g, A, /Condition 토큰 1개 제거/)[0]; ok(!!a, 'Siren offers bleeding'); if (a) await a.value(); ok(A.bleeding === 1, 'bleeding −1'); }
// Runt L2 temp evasion removed on round
{ const g = mk([{ name: 'Runt of the Litter', level: 3 }]); const [A] = g.titans; A.danger = 9; A.rage = 9; const e0 = A.tokens.evasion; const a = acts(g, A, /임시 \+Evasion/)[0]; await a.value(); ok(A.tokens.evasion === e0 + 1 && A._tmpEv === 1, 'temp ev'); }
// Indebted bleeding buildup +1
{ const g = mk([], ['Indebted']); const [A] = g.titans; const n = await g.bleedGain(A, 1); ok(n === 2, 'Indebted bleedGain +1'); }
// Fate-Hexed setter
{ const g = mk([], ['Fate-Hexed']); const [A] = g.titans; ok(g.hasFated(A, 'Fate-Hexed'), 'fated set'); }
// Betrayal hermes no stop
{ const g = mk([], ['Betrayal']); const [A, B] = g.titans; const q = { c: B.pos.c + 1, r: B.pos.r }; ok(g.fatedNoStop(A, q) === true, 'Betrayal blocks adjacent stop'); }
// Too Big to Fail L3 curse ignore
{ const g = mk([{ name: 'Too Big to Fail', level: 3 }]); const [A] = g.titans; A.danger = 9; A.rage = 9; const r = await g.curseIgnore(A, { name: 'WIND' }); ok(r === true && A.mnemos[0].discarded, 'TBTF L3 ignores curse'); }
// Spewed L3 on direct obol
{ const g = mk([{ name: 'Spewed by the Abyss', level: 3 }]); const [A] = g.titans; A.danger = 9; A.rage = 9; const a0 = A.ambrosia; await g.obolDraw(A); ok(A.alive && A.ambrosia >= a0 + 1 && !A.pendingObol, 'Spewed L3 replaces obol'); }
// Hoarder blocks X / Discard mnemos and X gear costs
{ const g = mk([{ name: 'Runt of the Litter', level: 3 }, { name: 'Siren Survivor', level: 3 }], ['Hoarder']); const [A] = g.titans; A.danger = 9; A.rage = 9; ok(!g.mn(A, 'Runt of the Litter', 3) && !!g.mn(A, 'Runt of the Litter', 2), 'Hoarder blocks X mnemos only'); ok(!g.mn(A, 'Siren Survivor', 1), 'Hoarder blocks Discard mnemos'); ok(!g.costOK(A, 'X', A.gear[0]), 'Hoarder blocks X gear cost'); }
// Siren: ambrosia is not a condition token
{ const g = mk([{ name: 'Siren Survivor', level: 3 }]); const [A] = g.titans; A.danger = 9; A.rage = 9; A.ambrosia = 2; ok(!acts(g, A, /Condition 토큰 1개 제거/).length, 'ambrosia not condition token'); }
// temp evasion removed after evasion roll
{ const g = mk([{ name: 'Runt of the Litter', level: 3 }]); const [A] = g.titans; A.danger = 9; A.rage = 9; const e0 = A.tokens.evasion; await acts(g, A, /임시 \+Evasion/)[0].value(); try { await g.evasionRoll(A, 1, 1, { name: 'x' }); } catch (e) {} ok(A.tokens.evasion === e0 && !A._tmpEv, 'temp ev removed after evasion'); }
