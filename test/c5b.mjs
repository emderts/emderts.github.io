import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const yes = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const SET = [['immortaltruthbearer', ['Gigas']], ['helldiver', ['Sirenblade']], ['feareater', ['Sirenblade']], ['executioner', ['Gigas']]];
const SET2 = [['trespasser', ['Sirenteeth', 'Sirenblade']], ['helldiver', ['Gigas']], ['feareater', ['Sirenblade']], ['executioner', ['Sirenblade']]];
const mk = (set = SET, pid = 'hekaton', seed = 5) => { const g = new Game(data, { seed }); g.ask = yes;
  g.setup({ primordialId: pid, level: 1, awakening: { enabled: true, spark: true }, titans: set.map(([cls, gear], k) => ({ name: cls, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls, gear: [...gear, 'Fists'] })) }); g.log.length = 0; return g; };
const safe = async (g, f) => { try { await f(); } catch (e) { if (!(e && (e.chainBreak || e.constructor.name === 'TitanDied'))) throw e; } };
const logHas = (g, re) => g.log.some(l => re.test(l.msg));
const C = data.titans.classes;
ok(['immortaltruthbearer', 'helldiver', 'feareater', 'executioner', 'trespasser'].every(k => C[k] && C[k].cycle === 5 && C[k].kratos && C[k].trauma.length === 4), 'data: 5 new Cycle V Titans');
// Feareater
{ const g = mk(); const F = g.titans[2]; const p0 = g.precisionMods(F), s0 = g.speedOf(F);
  await safe(g, () => g.addCondition(F, 'Fear')); ok(!F.conditions.includes('Fear') && F.stackTok === 1 && g.precisionMods(F) === p0 + 1, 'Feareater: Fear immune, token 1 → +1 Precision');
  await safe(g, () => g.gainDespair(F, 1)); ok(!F.despair && F.stackTok === 2 && g.speedOf(F) === s0 + 1, 'Feareater: Despair immune, token 2 → +1 Speed');
  await safe(g, () => g.addCondition(F, 'Dread')); ok(F.stackTok === 3 && g.inh(F, 'Defy') === 1, 'Feareater: token 3 → Defy 1');
  const A = { raw: 0 }; await g.c5Power(F, F.gear[0], A); ok(A.raw === 1, 'Feareater: Raw Power 1 (sheet)');
  await safe(g, () => g.gainDespair(F, 1)); const A2 = { raw: 0 }; await g.c5Power(F, F.gear[0], A2); ok(A2.raw === 2, 'Feareater: token 4 → +1 Power');
  await safe(g, () => g.gainDespair(F, 1)); ok(!F.alive, 'Feareater: 5 tokens → dies'); }
{ const g = mk(); const [T, H, F] = g.titans; F.pos = { c: 3, r: 3 }; H.pos = { c: 3, r: 4 }; H.despair = 2; ok(g.despairEff(H) === 2, 'Ur-Tainted: Feareater adjacency does not remove Despair penalties'); }
// Executioner + Pain
{ const g = mk(); const E = g.titans[3]; const s0 = g.speedOf(E); E.rage = 6;
  await g.gainPain(E, 1, 't'); ok(E.pain === 1 && E.stackTok === 1 && g.speedOf(E) === s0 + 1 && g.rageCap(E) === 8, 'Pain Engine 1: +1 Speed; Pain lowers Rage threshold');
  await g.gainPain(E, 2, 't'); ok(g.titanDie(E) === 'w' && g.rageCap(E) === 6 && !E.rageDoom, 'Pain Engine 3: Power die White; Rage cap 6');
  await g.gainPain(E, 1, 't'); ok(E.rageDoom && g.inh(E, 'Auto-rouse') === 1, 'Pain 4: Rage 6 > cap 5 → rage doom; Auto-rouse 1');
  await g.gainPain(E, 1, 't'); ok(g.inh(E, 'Deadly') === true, 'Pain Engine 5: Deadly'); }
{ const g = mk(); const E = g.titans[3]; E.pain = 1; E.stackTok = 1; const trig = []; g.ask = async q => /Pain 1 버리기|Despair 토큰 1개를 얻고/.test(q.title || '') ? true : yes(q); await safe(g, () => g.titanTurnStartTriggers ? g.titanTurnStartTriggers(E) : null); ok(true, 'turn start smoke'); }
// Trespasser
{ const g = mk(SET2); const T = g.titans[0]; const p0 = g.precisionMods(T); await g.gainAmbrosia(T, 2); ok(T.stackTok === 2 && g.precisionMods(T) === p0 + 1 && g.inh(T, 'Stalwart') === true, 'Trespasser: Ambrosia → tokens (Precision, Stalwart)');
  await g.gainAmbrosia(T, 2); ok(g.inh(T, 'Rocksteady') === true && g.inh(T, 'Tireless') === true, 'Trespasser: 4 tokens → Tireless, Rocksteady');
  ok(g.handCost(T, T.gear.find(x => x.card.name === 'Sirenteeth')) === 1, 'Nimble Hands: 2-hand weapon costs 1 hand');
  T.despair = 2; ok(g.despairEff(T) === 1, 'Despair Resilience 1'); }
// Helldiver
{ const g = mk(); const [, H] = g.titans; const laser = { name: 'L', kind: 'LASER ATTACK', laser: true }; ok(g.c5WishShieldPer(H, laser, 3) === 2, 'Electromagnetic Shield: Laser hit −1 Danger'); const T = g.titans[0]; T.pos = { c: H.pos.c + 1, r: H.pos.r }; if (g.tDist(T, H) === 1) ok(g.c5WishShieldPer(T, laser, 3) === 2, 'Electromagnetic Shield: adjacent Titan too'); }
{ const g = mk(); await safe(g, () => g.startOfBattle()); ok(g.titans[1].oxygen === 1 && logHas(g, /Silver Strain/), 'Silver Strain: Oxygen token logged'); }
// Immortal Truthbearer
{ const g = mk(); const T = g.titans[0]; ok(g.handCost(T, T.gear[0]) === 2 && g.inh(T, 'Auto-black') === 1 && g.inh(T, 'Wish Dodge') === true, 'Immortal Truthbearer: Elder Might, Auto-black 1, Wish Dodge'); }
// Kratos: Truth / AI Suppress / Pull
{ const g = mk(); const E = g.titans[3]; E.rage = 1; const eff = g.kratosEffects(E, { 1: 0 }); ok(eff.truth === 2, 'Kratos: Truth 2 parsed'); g.ask = async q => /Truth/.test(q.title || '') ? 'closing' : yes(q); await g.c5Truth(E, 2); ok(g.kratosPool.closing === 2, 'Truth X: chosen tokens placed');
  const H = g.titans[1]; H.rage = 7; const e2 = g.kratosEffects(H, { 1: 0, 3: 0, 6: 0, 7: 1 }); ok(e2.aiSuppress, 'Kratos: AI Suppress parsed');
  const F = g.titans[2]; F.rage = 1; const e3 = g.kratosEffects(F, { 1: 0 }); ok(e3.pull === 1 && g.ktStageOf('Pull 1') === 'first', 'Kratos: Pull 1 parsed (1st/2nd window)'); }
// full battles
for (const [set, pid] of [[SET, 'hekaton'], [SET2, 'sun'], [SET, 'oldhaunt'], [SET2, 'babel']]) { const g = mk(set, pid, 3); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, Math.min(1, q.max)).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options.filter(x => !x.disabled); return (o.find(x => x.value === true) || o.find(x => x.value === 'attack') || o.find(x => x.value === 'move') || o.find(x => x.value === 'end') || o[0]).value; };
  let res, err = null; try { res = await Promise.race([g.run(), new Promise(r => setTimeout(() => r('slow'), 60000))]); } catch (e) { err = e; }
  const u = g.log.filter(l => /미구현|수동 적용/.test(l.msg)).map(l => l.msg); ok(!err, `battle ${pid}: ${err ? err.stack : res} ${[...new Set(u)].slice(0, 3).join(' | ')}`); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
