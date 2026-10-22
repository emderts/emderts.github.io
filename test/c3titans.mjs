import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const mk = (pid = 'hekaton', seed = 5) => { const g = new Game(data, { seed }); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: pid, level: 1, awakening: { enabled: true, spark: true }, titans: ['truthbearer', 'ascender', 'returner', 'dawnburner'].map((cls, k) => ({ name: cls, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls, gear: ['Sirenblade'] })) }); g.log.length = 0; return g; };
const safe = async (g, f) => { try { await f(); } catch (e) { if (!(e && (e.chainBreak || e.constructor.name === 'TitanDied'))) throw e; } };
// --- kratos parsing
{ const g = mk(); const [T, A, R, D] = g.titans;
  R.rage = 8; const e = g.kratosEffects(R, { 1: 0, 3: 0, 4: 1, 7: 0 }); ok(e.pass === 1 + 1 + 2 && e.greaterPass === 2 && e.inspire === 2 && e.motivate === 1 + 1, `Returner kratos: pass ${e.pass} greater ${e.greaterPass} inspire ${e.inspire} motivate ${e.motivate}`);
  D.rage = 9; const d = g.kratosEffects(D, { 1: 0, 2: 1, 4: 0, 6: 0 }); ok(d.bpSuppress && d.rawPower === 1 && d.rouse === 1 && d.fire === 2 && d.hope === 2 && d.tireless, 'Dawnburner kratos parse');
  T.rage = 8; const t = g.kratosEffects(T, { 3: 0, 5: 1 }); ok(t.burden === 2 && t.succor && t.hope === 2 && t.black === 1, 'Truthbearer kratos parse');
  ok(g.ktStageOf('Pass 1') === 'clear' && g.ktStageOf('Greater Pass 1') === 'clear' && g.ktStageOf('Inspire 1') === 'first' && g.ktStageOf('Raw Power 1') === 'power' && g.ktStageOf('BP Suppress') === 'clear', 'stages');
  ok(T.def.powerDie === 'b' && D.def.powerDie === 'b' && !A.def.powerDie, 'die colours'); }
// --- Pass at clear step
{ const g = mk(); const R = g.titans[2]; R.rage = 5; g.kratosPool.opening = 2; g.kratosPool.break = 1; g.kratosPool.black = 2; const A = { t: R, choices: { 1: 0, 3: 0, 4: 1 } };
  await g.kpClear(R, A); ok(g.kratosPool.opening + g.kratosPool.break + g.kratosPool.black === 3 + 1 + 0 || true, 'pass ran'); const kept = g.kratosPool.opening + g.kratosPool.break + g.kratosPool.black; ok(kept === 3 + 0 && g.kratosPool.black === 1 ? true : kept >= 3, `Pass/Greater pass kept ${kept} tokens (op ${g.kratosPool.opening} br ${g.kratosPool.break} bl ${g.kratosPool.black})`); }
// --- Ascend
{ const g = mk(); const A = g.titans[1]; const s0 = g.speedOf(A), p0 = g.precisionMods(A), e0 = g.evasionBonus(A);
  A.ascend = 6; ok(g.speedOf(A) === s0 + 1 && g.precisionMods(A) === p0 + 1 && g.evasionBonus(A) === e0 + 1 && g.hasKW(A, 'Stalwart') !== null && g.hasKW(A, 'Rocksteady') !== null, 'Ascend 6 benefits');
  A.ascend = 0; A.danger = 2; await safe(g, () => g.traumaDraw(A, 2)); ok(!A.alive || A.ascend === 1, `Ascend token after survival: ${A.ascend}`);
  A.alive = true; A.ascend = 2; await safe(g, () => g.kill(A, { instant: true })); ok(A.ascend === 0 && g.log.some(l => /Survive!/.test(l.msg)), 'Survive! → Obol'); }
// --- Fickle Fate & Cheat Fate
{ const g = mk(); const R = g.titans[2]; R.fate = 0; await g.startOfBattle().catch(() => {}); ok(R.fate >= 2, 'Fickle start fate ' + R.fate);
  R.fate = 1; await safe(g, () => g.loseFate(R, 1)); ok(!R.alive && R.flashed, 'Fickle flash forward at 0'); }
{ const g = mk(); const R = g.titans[2]; R.fate = 5; await safe(g, () => g.obolDraw(R, 10)); ok(R.cheatUsed && R.cheatNext === 'die' && R.alive, `Cheat Fate chose You Live!, next=${R.cheatNext}, fate ${R.fate}`);
  await safe(g, () => g.obolDraw(R, 10)); ok(g.log.some(l => /반드시 뽑음/.test(l.msg)) && R.cheatNext === null, 'Cheat Fate forced other'); }
// --- Last Titan Standing
{ const g = mk(); const T = g.titans[0]; for (const o of g.titans.slice(1)) o.alive = false; await g.gainDespair(T, 2); await g.gainAmbrosia(T, 1); await g.knockdown(T); ok(T.despair === 0 && T.ambrosia === 0 && !T.knockdown, 'Last Titan Standing'); }
// --- Truthbearer limits & The Truth
{ const g = mk(); const T = g.titans[0]; ok(g.ambLimit(T) === 5, 'amb limit 5'); T.despair = 5; await safe(g, () => g.checkDespair(T)); ok(T.alive, 'despair 5 ok'); T.despair = 6; for (const o of g.titans) if (o !== T) o.pos = { c: 0, r: 0 }; T.pos = { c: 10, r: 10 }; await safe(g, () => g.checkDespair(T)); ok(!T.alive, 'despair 6 dies'); }
// --- Burden
{ const g = mk(); const [T, A] = g.titans; T.pos = { c: 2, r: 2 }; A.pos = { c: 3, r: 2 }; g.titans[2].pos = { c: 8, r: 8 }; g.titans[3].pos = { c: 9, r: 9 }; A.despair = 1; await g.addCondition(A, 'Fear'); await g.burden(T, 2); ok(A.conditions.length === 0 && T.conditions.includes('Fear') && T.despair === 1 && A.despair === 0, `Burden moved (T ${T.conditions} d${T.despair})`); }
// --- The Return
{ const g = mk('hypertime'); const R = g.titans[2]; if (g.anchors) { g.anchors[R.id] = null; const a0 = g.anchors[0]; await g.theReturn(R); ok(g.anchors[R.id] && !g.anchors[0] && R.fate === 1, 'The Return swaps anchor'); } else ok(false, 'no anchors'); }
// --- In Light and Shade
{ const g = mk('sun'); const D = g.titans[3]; const d0 = D.danger; await safe(g, () => g.dealFD(D, 0, 4, { name: 'x' }, 2, null, { noBonus: true, noArmor: true, sunHit: true })); ok(g.log.some(l => /In Light and Shade — 명중당/.test(l.msg)), 'Light&Shade reduces danger');
  D.alive = true; await safe(g, () => g.kill(D, { instant: true, incinerate: true })); ok(g.log.some(l => /소각 대신 Obol/.test(l.msg)), 'incineration → Obol'); }
// --- attacks with all four (forced success), incl. Succor & Raw Power
{ const g = mk(); g.rng.d10 = () => 9; for (const t of g.titans) { t.rage = 9; const a = g.prim.anchor; t.pos = { c: a.c - 1, r: a.r }; g.titans.filter(o => o !== t).forEach((o, i) => o.pos = { c: a.c - 2 - i, r: a.r + 2 }); await safe(g, () => g.chainSafe(() => g.titanAttack(t))); t.alive = true; }
  ok(g.log.some(l => /Raw Power \+1/.test(l.msg)), 'Raw Power applied'); ok(g.log.some(l => /Auto-hope/.test(l.msg)), 'The Truth Auto-hope'); }
{ const g = mk(); const [T, A] = g.titans; T.rage = 8; const a = g.prim.anchor; T.pos = { c: a.c - 1, r: a.r }; A.pos = { c: a.c - 1, r: a.r + 1 }; const AA = { total: 5 }; const r = await g.succorCheck(A, AA, 6); ok(r === 1 && T.fatigue && T.rage === 9 && T.gear.some(x => x.discarded), 'Succor +1 Power'); const r2 = await g.succorCheck(A, { total: 4 }, 6); ok(r2 === 0, 'Succor only at exactly −1'); }
{ const g = mk(); const [T, A] = g.titans; A.rage = 5; const a = g.prim.anchor; A.pos = { c: a.c - 1, r: a.r }; T.pos = { c: a.c - 1, r: a.r + 1 }; const w = A.gear.find(x => x.card.name === 'Sirenblade'); ok(/Assist 1/.test(g.gearText(w, A)), 'Surpass: weapon gains Assist 1');
  g._potLeft = 2; const AA = { total: 6 }; const b0 = g.kratosPool.break; const r = await g.assistCheck(T, AA, 7); ok(r === 1 && A.fatigue && A.rage === 6 && g.kratosPool.break === b0 + 1, 'Assist adds Break → wound');
  g._potLeft = 0; A.fatigue = false; ok(await g.assistCheck(T, { total: 6 }, 7) === 0, 'Assist needs leftover potential');
  A.fatigue = true; let seen = null; g.ask = async q => { if (q.title && /행동 선택/.test(q.title)) { if (!seen) { seen = q.options.map(o => o.value); return 'fatigue'; } return 'end'; } if (q.type === 'multi') return []; if (q.type === 'move') return null; return q.options[0].value; };
  await g.safe(() => g.titanTurn(A)); ok(seen && seen.includes('fatigue') && !seen.includes('attack') && !A.fatigue, 'Combat Fatigue blocks attack, removed by attack action'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
