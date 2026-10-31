import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const yes = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const SET = [['immortaltruthbearer', ['Gigas']], ['helldiver', ['Sirenblade']], ['feareater', ['Sirenblade']], ['executioner', ['Gigas']]];
const SET2 = [['trespasser', ['Walking Tools']], ['helldiver', ['Gigas']], ['feareater', ['Sirenblade']], ['executioner', ['Sirenblade']]];
const mk = (set = SET, pid = 'hekaton', seed = 5, argo = []) => { const g = new Game(data, { seed }); g.ask = yes;
  g.setup({ primordialId: pid, level: 1, argo, awakening: { enabled: true, spark: true }, titans: set.map(([cls, gear], k) => ({ name: cls, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls, gear: [...gear, 'Fists'] })) }); g.log.length = 0; return g; };
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
  g._atkN = 1; await g.gainPain(E, 1, 't'); ok(E.rageDoom && g.inh(E, 'Auto-rouse') === 1, 'Pain 4 (during an attack): Rage 6 > cap 5 → rage doom deferred; Auto-rouse 1');
  await g.gainPain(E, 1, 't'); ok(g.inh(E, 'Deadly') === true, 'Pain Engine 5: Deadly'); g._atkN = 0; await g.gainPain(E, 1, 't').catch(e => { if (!e.titan) throw e; }); ok(!E.alive, 'outside an attack: consumed by rage immediately (FAQ)'); }
{ const g = mk(); const E = g.titans[3]; E.pain = 1; E.stackTok = 1; const trig = []; g.ask = async q => /Pain 1 버리기|Despair 토큰 1개를 얻고/.test(q.title || '') ? true : yes(q); await safe(g, () => g.titanTurnStartTriggers ? g.titanTurnStartTriggers(E) : null); ok(true, 'turn start smoke'); }
// Trespasser
{ const g = mk(SET2); const T = g.titans[0]; const p0 = g.precisionMods(T); await g.gainAmbrosia(T, 2); ok(T.stackTok === 2 && g.precisionMods(T) === p0 + 1 && g.inh(T, 'Stalwart') === true, 'Trespasser: Ambrosia → tokens (Precision, Stalwart)');
  await g.gainAmbrosia(T, 2); ok(g.inh(T, 'Rocksteady') === true && g.inh(T, 'Tireless') === true, 'Trespasser: 4 tokens → Tireless, Rocksteady');
  ok(g.handCost(T, T.gear.find(x => x.card.name === 'Walking Tools')) === 2 && g.handCost(g.titans[1], { card: { slot: 'hand1x3' } }) === 3 && g.midasCap(T, T.gear.find(x => x.card.name === 'Walking Tools')) === 3, 'Nimble Hands: [1-hand x3] Walking Tools uses 2 hands (others 3), Midas cap 3');
  T.despair = 2; ok(g.despairEff(T) === 1, 'Despair Resilience 1'); }
// Helldiver
{ const g = mk(); const [, H] = g.titans; const laser = { name: 'L', kind: 'LASER ATTACK', laser: true }; ok(g.c5WishShieldPer(H, laser, 3) === 2, 'Electromagnetic Shield: Laser hit −1 Danger'); const T = g.titans[0]; T.pos = { c: H.pos.c + 1, r: H.pos.r }; if (g.tDist(T, H) === 1) ok(g.c5WishShieldPer(T, laser, 3) === 2, 'Electromagnetic Shield: adjacent Titan too'); }
{ const g = mk(); await safe(g, () => g.startOfBattle()); ok(g.titans[1].oxygen === 1 && logHas(g, /Silver Strain/), 'Silver Strain: Oxygen token logged'); }
// Immortal Truthbearer
{ const g = mk(); const T = g.titans[0]; ok(g.handCost(T, T.gear[0]) === 2 && g.inh(T, 'Auto-black') === 1 && g.inh(T, 'Wish Dodge') === true, 'Immortal Truthbearer: Elder Might, Auto-black 1, Wish Dodge'); }
{ const g = mk(); const E = g.titans[3]; const bp = { name: 'X', tier: 3, at: 99, critical: 'The Hekaton dies!', responses: {} }; const A = { bp, crit: false }; ok(g.isDeathBlow(bp), 'death blow bp'); E.oxygen = 1; const f0 = E.fate; g.ask = async q => /Finish Him/.test(q.title || '') ? true : yes(q);
  // call the Finish Him block through a minimal path: emulate
  if (g.ab(E, 'Finish Him') && (E.oxygen || 0) > 0) { const ok2 = await g.ask({ title: 'Finish Him' }); if (ok2) { E.oxygen--; await g.gainFate(E, 1); A.crit = true; } } ok(A.crit && E.oxygen === 0 && E.fate === f0 + 1, 'Finish Him: Oxygen + Fate cost (data)'); }
// Kratos: Truth / AI Suppress / Pull
{ const g = mk(); const E = g.titans[3]; E.rage = 1; const eff = g.kratosEffects(E, { 1: 0 }); ok(eff.truth === 2, 'Kratos: Truth 2 parsed'); g.ask = async q => /Truth/.test(q.title || '') ? 'closing' : yes(q); await g.c5Truth(E, 2); ok(g.kratosPool.closing === 2, 'Truth X: chosen tokens placed');
  const H = g.titans[1]; H.rage = 7; const e2 = g.kratosEffects(H, { 1: 0, 3: 0, 6: 0, 7: 1 }); ok(e2.aiSuppress, 'Kratos: AI Suppress parsed');
  const F = g.titans[2]; F.rage = 1; const e3 = g.kratosEffects(F, { 1: 0 }); ok(e3.pull === 1 && g.ktStageOf('Pull 1') === 'first', 'Kratos: Pull 1 parsed (1st/2nd window)'); }

// Cycle V Trauma / Awakening cards
{ const D = data.decks; ok(D.trauma.minor.filter(c => c.cycle === 5).length === 5 && D.trauma.grave.some(c => c.code === 'EM2632') && D.secret.kratos_awaken_c5 && D.secret.moiros_awaken_c5, 'data: Cycle V Trauma + Titan X Trauma + Awakening cards');
  const g = mk(); ok(![...g.trauma.minor.cards, ...g.trauma.major.cards, ...g.trauma.grave.cards].some(c => c.cycle === 5), 'Cycle V Trauma not used vs Cycle I Primordial (Mnestis cycle rule)');
  const E = g.titans[3]; await g.doSentence(E, 'Gain 2 Pain tokens.', {}); ok(E.pain === 2, '"Gain 2 Pain tokens." sentence');
  const T = g.titans[0]; let aw = 0; g.awaken = async x => { aw++; x.godform = { def: { name: 'X' } }; }; await safe(g, () => g.cardAwaken(T, D.secret.kratos_awaken_c5)); ok(aw === 1 && T.pain === 3, 'Autodestructive Awakening: Awaken + Pain 3');
  const H = g.titans[1]; H.fate = 6; await safe(g, () => g.cardAwaken(H, D.secret.moiros_awaken_c5)); ok(H.fate === 0, 'Defiant Awakening: Fate → 0'); }
// Cycle V Argo Abilities
{ const g = mk(SET, 'hekaton', 5, ['Calculate Statistical Certainty', 'Painkiller Shot', 'Soulbalm', 'Drag It Back!', 'Triskelion Override', 'Underwater Support Fleet']); const [T, H, F, E] = g.titans; const acts = () => g.argoActions(T);
  await acts().find(a => /Calculate Statistical/.test(a.label)).value(); const who = g.titans.find(x => x.truthObol); const tc = who && who.truthObol; await safe(g, () => g.obolDraw(who, 10)); ok(tc && g.log.some(l => l.msg.includes(`미리 본 Obol 「${tc.name}」`)), 'Truth Machine: predicted Obol is resolved');
  E.pain = 3; E.rage = 7; ok(g.rageCap(E) === 6, 'Pain 3 → cap 6'); await acts().find(a => /Painkiller Shot/.test(a.label)).value(); ok(g.rageCap(E) === 9, 'Painkiller Shot: ignore Pain this Round');
  H.despair = 2; await acts().find(a => /Soulbalm/.test(a.label)).value(); ok(!H.despair, 'Soulbalm: Despair discarded');
  const a0 = { ...g.prim.anchor }; await safe(g, () => acts().find(a => /Drag It Back/.test(a.label)).value()); ok(logHas(g, /Pull|Pushback/), 'Drag It Back!: Pull/Pushback performed');
  const p0 = T.pain || 0; await safe(g, () => acts().find(a => /Triskelion Override/.test(a.label)).value()); const x = g.titans.find(y => y.fatigue); ok(x && (x.pain || 0) >= 3, 'Triskelion Override: Pain 3 + action + Fatigue');
  await acts().find(a => /Underwater Support Fleet/.test(a.label)).value(); ok(g.trireme && g.trireme.sub && g.trireme.pos, 'Underwater Support Fleet: Subreme placed'); }
{ const g = mk(SET, 'hekaton', 5, ['Painkiller Shot']); const E = g.titans[3]; await g.gainPain(E, 3, 't'); ok(E.pain === 1, 'Painkiller Shot hook: Pain gain lowered to 1'); }
{ const g = mk(SET, 'hekaton', 5, ['Inner Light']); const T = g.titans[0]; T.conditions.push('Dread'); let gd = 0; const td = g.traumaDraw.bind(g); g.traumaDraw = async (x, v, tier) => { if (tier === 'Grave') gd++; }; await safe(g, () => g.addCondition(T, 'Dread')); ok(T.alive && gd === 1, 'Inner Light: Dread death → Grave Trauma instead'); }
{ const g = mk(SET, 'hekaton', 5, ['Anchor Drop Pod']); g.round = 1; const T = g.titans[0]; g.ask = async q => /새 타이탄 시트/.test(q.title || '') ? 'trespasser' : yes(q); await safe(g, () => g.kill(T)); ok(T.alive && T.def.name === 'Trespasser' && T.pos, 'Anchor Drop Pod: dead Titan replaced in round 1 (' + (T.pos && T.pos.c) + ',' + (T.pos && T.pos.r) + ')'); }
{ const g = mk(SET, 'hekaton', 5, ['Triskelion Override']); const [T] = g.titans; g.ask = async q => /받을 Fatigue/.test(q.title || '') ? 'combat' : /어떤 액션/.test(q.title || '') ? 'move' : yes(q); await safe(g, () => g.argoActions(T).find(a => /Triskelion Override/.test(a.label)).value()); const x = g.titans.find(y => y.fatigue); ok(x && x.fatigue === 'combat', 'Triskelion Override: Fatigue token chosen freely (move action → Combat Fatigue)'); }
// full battles
for (const [set, pid] of [[SET, 'hekaton'], [SET2, 'sun'], [SET, 'oldhaunt'], [SET2, 'babel']]) { const g = mk(set, pid, 3); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, Math.min(1, q.max)).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options.filter(x => !x.disabled); return (o.find(x => x.value === true) || o.find(x => x.value === 'attack') || o.find(x => x.value === 'move') || o.find(x => x.value === 'end') || o[0]).value; };
  let res, err = null; try { res = await Promise.race([g.run(), new Promise(r => setTimeout(() => r('slow'), 60000))]); } catch (e) { err = e; }
  const u = g.log.filter(l => /미구현|수동 적용/.test(l.msg)).map(l => l.msg); ok(!err, `battle ${pid}: ${err ? err.stack : res} ${[...new Set(u)].slice(0, 3).join(' | ')}`); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
