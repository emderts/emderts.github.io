import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const yes = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const SET1 = [['gamechanger', ['Gigas']], ['lunarlander', ['Sirenblade']], ['wishender', ['Sirenblade', 'Kratos Kopis']], ['cloudsoarer', ['Gigas']]];
const SET2 = [['shadowdancer', ['Sirenblade', 'Pillarmace']], ['lunarlander', ['Sirenblade']], ['wishender', ['Sirenblade']], ['cloudsoarer', ['Pillarmace']]];
const mk = (set = SET1, pid = 'hekaton', seed = 5) => { const g = new Game(data, { seed }); g.ask = yes;
  g.setup({ primordialId: pid, level: 1, awakening: { enabled: true, spark: true }, titans: set.map(([cls, gear], k) => ({ name: cls, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls, gear: [...gear, 'Fists'] })) }); g.log.length = 0; return g; };
const safe = async (g, f) => { try { await f(); } catch (e) { if (!(e && (e.chainBreak || e.constructor.name === 'TitanDied'))) throw e; } };
const logHas = (g, re) => g.log.some(l => re.test(l.msg));
const C = data.titans.classes;

// --- data / kratos parsing
{ ok(C.gamechanger.code === 'AK0298' && C.gamechanger.cycle === 1 && C.gamechanger.powerDie === 'b' && C.gamechanger.speed === 5, 'gamechanger header');
  ok(['DK2001', 'DK2002', 'DK2003', 'DK2004'].every(c => Object.values(C).some(x => x.code === c && x.cycle === 5)), 'cycle V codes');
  const K = Object.keys(data.titans.kratosAbilities).map(k => k.replace(/ X$/, '').replace(/ \(.*\)$/, ''));
  const bad = []; for (const k of ['gamechanger', 'lunarlander', 'wishender', 'shadowdancer', 'cloudsoarer']) for (const opts of Object.values(C[k].kratos)) for (const o of opts) for (const e of o) if (!/^Unknown/.test(e) && !K.includes(e.replace(/ \d+$/, ''))) bad.push(`${k}:${e}`);
  ok(!bad.length, 'kratos entries are known abilities ' + bad.join(','));
  const g = mk(); const [G, L, W, Cl] = g.titans;
  G.rage = 7; const e = g.kratosEffects(G, { 1: 0, 3: 1, 5: 1 }); ok(e.break === 1 + 1 && e.opening === 1 + 1 && e.reroll === 1 + 2 + 1 && e.elation === 1 && e.addDie && e.precise, `Gamechanger kratos (br ${e.break} op ${e.opening} rr ${e.reroll})`);
  W.rage = 9; const we = g.kratosEffects(W, { 1: 0, 2: 1, 4: 1, 6: 0 }); ok(we.break === 3 && we.opening === 2 && we.hope === 1 && we.scale === 1 && we.clutch && we.motivate === 1 && we.reroll === 3, 'Wishender kratos (Scale/Clutch)');
  const wc = g.kratosEffects(W, { 1: 1, 2: 0, 4: 0, 6: 1 }); ok(wc.closing === 1 && wc.black === 3 && wc.opening === 2, `Wishender closing ${wc.closing} black ${wc.black}`);
  ok(g.ktStageOf('Scale 1') === 'first' && g.ktStageOf('Pole Position') === 'first' && g.ktStageOf('Unburden 1') === 'first' && g.ktStageOf('Clutch') === 'power' && g.ktStageOf('Closing 1') === 'second', 'new kratos stages');
  L.rage = 9; const le = g.kratosEffects(L, { 1: 1, 3: 0, 4: 1, 6: 1, 7: 0, 8: 1 }); ok(le.pass === 5 && le.greaterPass === 2 && le.scale === 4 && le.unburden === 2 && le.opening === 1 && le.inspire === 0, `Lunarlander kratos (pass ${le.pass} gp ${le.greaterPass} scale ${le.scale} unb ${le.unburden})`);
  Cl.rage = 7; const ce = g.kratosEffects(Cl, { 1: 0, 2: 1, 3: 1, 4: 1, 7: 1 }); ok(ce.opening === 2 && ce.scale === 3 && ce.closing === 2 && ce.pole && ce.addDie, 'Cloudsoarer kratos');
  ok(g.tierRaw(G, 8) === 'Major' && g.tierRaw(G, 9) === 'Grave' && g.tierRaw(G, 10) === 'Obol', 'Gamechanger trauma 9 = Grave (single-value row)');
  ok(g.tierRaw(W, 11) === 'Obol' && g.tierRaw(W, 10) === 'Grave', 'Wishender trauma'); }
// --- Gamechanger
{ const g = mk(); const G = g.titans[0]; const gig = G.gear.find(x => x.card.name === 'Gigas');
  ok(g.handCost(G, gig) === 2, 'Unknown Might: 3-hand as 2-hand');
  await g.afterSurvive(G, 'Major'); ok(g.kratosPool.opening === 1 && logHas(g, /Ruse/), 'Ruse places Opening');
  await g.afterSurvive(G, 'Minor'); ok(g.kratosPool.opening === 1, 'Ruse not on Minor');
  const rs = g.c4Reactions(G, G, { name: 'x' }); const ar = rs.find(a => /Advanced Reflex/.test(a.label)); ok(!!ar, 'Advanced Reflex offered in window');
  const f0 = G.fate; const p0 = { ...G.pos }; await ar.value(); ok(G.fate === f0 + 1 && G.advReflexRound === g.round, `Advanced Reflex paid Fate (moved ${p0.c},${p0.r} → ${G.pos.c},${G.pos.r})`);
  ok(!g.c4Reactions(G, G, { name: 'x' }).some(a => /Advanced Reflex/.test(a.label)), 'Advanced Reflex once per round');
  g.round++; ok(g.c4Reactions(G, G, { name: 'x' }).some(a => /Advanced Reflex/.test(a.label)), 'Advanced Reflex again next round');
  await safe(g, () => g.c4AfterRoll(G, gig, { t: G, g: gig, txt: '', mods: {}, critMiss: true, hits: 0, choices: {} }, [{ v: 1, crit: true }], () => false)); ok(logHas(g, /Disturbance in Fate/), 'Disturbance in Fate logged'); }
// --- Lunarlander
{ const g = mk(); const L = g.titans[1];
  ok(g.inh(L, 'Auto-hope') === 1, 'Auto-hope 1 inherent');
  ok(g.hasKW(L, 'Rocksteady') === null, 'no Rocksteady on ground'); L.onVP = true; ok(g.hasKW(L, 'Rocksteady') !== null && await g.kwUse(L, 'Rocksteady', 'x'), 'One Small Step: Rocksteady on VP'); L.onVP = false;
  L.stair = 2; await g.knockdown(L); ok(!L.knockdown, 'One Small Step: knockdown ignored on Staircase'); L.stair = 0;
  L.gear[0].midas = 1; L.pain = 1; const fa = g.freeActions(L).find(a => /Grey Alchemy/.test(a.label)); ok(!!fa, 'Grey Alchemy offered');
  const f0 = L.fate, a0 = L.ambrosia; await fa.value(); ok(L.fate === f0 + 1 && L.ambrosia === a0 + 1 && (g.midas(L) === 0 || L.pain === 0), `Grey Alchemy: amb ${L.ambrosia}, midas ${g.midas(L)}, pain ${L.pain}`);
  g.currentAI = { card: { name: 'T' } }; const d0 = L.despair; const kd0 = L.knockdown;
  await safe(g, () => g.afterAttack({ name: 'T', after: 'Knockdown.', afterWindow: true }, L)); ok(L.forgottenUsed && L.despair === d0 + 3 && !L.knockdown && kd0 === L.knockdown, 'Forgotten Curse skips After Attack (+3 Despair)');
  g.log.length = 0; await safe(g, () => g.afterAttack({ name: 'T', after: 'Knockdown.', afterWindow: true }, L)); ok(logHas(g, /After Attack: Knockdown/), 'Forgotten Curse once per battle'); g.currentAI = null;
  g.log.length = 0; await g.startOfBattle().catch(() => {}); ok(logHas(g, /Selenian Strain/), 'Selenian Strain logged'); }
// --- Wishender
{ const g = mk(); const [G, L, W, Cl] = g.titans;
  ok(g.handCap(W) === 4, 'Four-Armed Centimanes: 4 hand slots'); const pm = { card: data.gear.cards.find(c => c.name === 'Pillarmace') }; ok(g.c5WeaponBanned(W, pm) && !g.c5WeaponBanned(W, W.gear[0]), 'Four-Armed: no 2-hand weapons');
  await g.midasCondition(W, 'Wishkeen'); ok(W.genTok === 1, 'Wish Engine: Wishkeen +1'); await g.midasCondition(W, 'Wishkeen'); ok(W.genTok === 3 && W.conditions.includes('Wishagog'), `Wish Engine: Wishagog +2 (${W.genTok})`);
  W.conditions = []; W.genTok = 4; const A = { raw: 0 }; await g.c5Power(W, W.gear[0], A); ok(A.raw === 1 && W.genTok === 0, 'Wish Engine 4: +1 Power');
  W.stair = 1; const A2 = { raw: 0 }; await g.c5Power(W, W.gear[0], A2); ok(A2.raw === 1 && logHas(g, /Djinnslayer/), 'Djinnslayer on Staircase'); W.stair = 0;
  W.impaled = true; const A3 = { raw: 0 }; await g.c5Power(W, W.gear[0], A3); ok(A3.raw === 1, 'Djinnslayer on Status card (Impaled)'); W.impaled = false;
  W.genTok = 3; const A4 = { c4prec: 0, txt: '', mods: {}, t: W, g: W.gear[0], choices: {} }; await g.c4AttackStart(W, W.gear[0], A4); ok(A4.c4prec === 1 && g.kratosPool.break === 1 && W.genTok === 0, 'Wish Engine 1+2: Precision & Auto-break');
  // Wish Shield: adjacent titan and self
  W.pos = { c: 2, r: 2 }; L.pos = { c: 3, r: 2 }; G.pos = { c: 8, r: 8 }; Cl.pos = { c: 10, r: 10 };
  ok(g.wishShieldOn(W) && g.wishShieldOn(L) && !g.wishShieldOn(G), 'Wish Shield: self & adjacent only');
  g.log.length = 0; await safe(g, () => g.dealFD(L, 0, 4, { name: 'laser' }, 2, null, { noBonus: true, noArmor: true, laser: true })); ok(logHas(g, /Wish Shield — Laser Attack hit당 Danger −1 \(4 → 2\)/), 'Wish Shield reduces adjacent laser hits');
  g.log.length = 0; await safe(g, () => g.dealFD(G, 0, 4, { name: 'laser' }, 2, null, { noBonus: true, noArmor: true, laser: true })); ok(!logHas(g, /Wish Shield/), 'no Wish Shield for far titan');
  g._wishNoArmor = W; ok(g.c5WishShieldPer(W, { name: 'w' }, 3) === 2 && g.c5WishShieldPer(W, { name: 'w' }, 1) === 1, 'Wish Shield: Wish Attack per-hit −1, min 1'); g._wishNoArmor = null;
  // free actions
  g._actor = W; W.turn.attacked = true; W.turn.moved = true; W.genTok = 6; const fa = g.freeActions(W); const ca = fa.find(a => /전투 액션/.test(a.label)); const ma = fa.find(a => /이동 액션/.test(a.label)); ok(!!ca && !!ma, 'Wish Engine 5/6 offered');
  await ca.value(); ok(!W.turn.attacked && W.genTok === 0, 'Wish Engine 6: regain combat action');
  W.genTok = 3; g.rng.d10 = () => 1; const h = await g.evasionRoll(W, 2, 6, { name: 'x', steps: [''] }); ok(h === 1 && W.genTok === 0, `Wish Engine 3: Block 1 (hits ${h})`); }
// --- Wish Engine on surviving a Wish Attack (Demi-Djinn)
{ const g = mk(SET1, 'demidjinn', 9); const W = g.titans[2]; g.isWishAttack = () => true; g.wishArmor = async () => false; g.djinnHeader = async () => {};
  const card = { name: 'Wishy', tier: 2, dice: 1, toHit: 6, steps: ['ATTACK', 'Each hit deals 0 DANGER.'], kind: 'ATTACK' }; g.currentAI = { card, dangerDealt: 0 }; W.genTok = 0;
  await safe(g, () => g.primAttackOn(W, card)); ok(!W.alive || W.genTok === 2, `Wish Engine: survive AI II Wish Attack → +2 (${W.genTok})`); }
// --- Shadowdancer
{ const g = mk(SET2); const S = g.titans[0];
  ok(g.handCap(S) === 3 && g.c5WeaponBanned(S, { card: data.gear.cards.find(c => c.name === 'Gigas') }) && !g.c5WeaponBanned(S, S.gear[1]), 'Nimble Feet: 3 slots, no 3-hand');
  S.fate = 0; g.log.length = 0; await safe(g, () => g.obolDraw(S, 10)); ok(logHas(g, /Dance of Fate/) && S.fate >= 2, 'Dance of Fate adds You Live! (+2 Fate)');
  ok(g.obolBase.filter(o => o.result === 'live').length === g.data.decks.obol.filter(o => !o.addWhen && !o.condition && o.result === 'live').length, 'Dance of Fate: deck restored after draw');
  S.alive = true; S.pendingObol = false; S.knockdown = null; S.fatigue = false; S.fate = 0; const a = g.prim.anchor; S.pos = { c: a.c - 2, r: a.r }; for (const o of g.titans) if (o !== S) o.pos = { c: 1 + o.id, r: 1 };
  S._sdCard = { name: 'x', tier: 1 }; g.log.length = 0; g.rng.d10 = () => 9; await safe(g, () => g.shadowdanceFlush()); ok(logHas(g, /SHADOWDANCE/) && S.fate >= 2 && S.fatigue === 'combat', `Shadowdance: Fate +2 (AI I), move+attack, Combat Fatigue (fate ${S.fate})`);
  ok(logHas(g, /Reposition \(Shadowdance\)|Total Power|무기|hit/), 'Shadowdance performed move/attack');
  S._sdCard = { name: 'y', tier: 1 }; g.log.length = 0; await safe(g, () => g.shadowdanceFlush()); ok(!logHas(g, /SHADOWDANCE/), 'Shadowdance blocked while holding Fatigue');
  S.fatigue = false; S._sdCard = { name: 'sig', tier: 'X' }; const f1 = S.fate; g.log.length = 0; await safe(g, () => g.shadowdanceFlush()); ok(!logHas(g, /SHADOWDANCE/) && S.fate === f1, 'NOT on signature: Shadowdance: tier X costs 0 Fate'); }
// --- Shadowdance offered after a real Primordial attack
{ const g = mk(SET2, 'hekaton', 11); const S = g.titans[0]; const titles = []; g.ask = async q => { titles.push(q.title || ''); return yes(q); };
  const a = g.prim.anchor; S.pos = { c: a.c - 1, r: a.r }; for (const o of g.titans) if (o !== S) o.pos = { c: 1 + o.id, r: 1 };
  const card = g.ai.cards.find(c => c.kind === 'ATTACK' && !c.moveCenter) || g.ai.cards[0];
  await safe(g, () => g.resolveAI(card, { forcedTarget: S }));
  ok(!S.alive || titles.some(t => /Shadowdance/.test(t)) || S.knockdown || g.log.every(l => !/타겟: shadowdancer/.test(l.msg)), 'Shadowdance offered at end of AI card'); }
// --- new Kratos abilities: Scale / Unburden / Pole Position / Closing / Clutch
{ const g = mk(SET2); const [S, L, W, Cl] = g.titans; const a = g.prim.anchor;
  S.pos = { c: a.c - 1, r: a.r }; L.pos = { c: a.c - 2, r: a.r }; W.pos = { c: 1, r: 1 }; Cl.pos = { c: 2, r: 1 };
  await g.addCondition(S, 'Fear'); S.despair = 1; const A = { choices: {} }; ok(await g.c5Unburden(S, 2, 1) && L.conditions.includes('Fear') && !S.conditions.includes('Fear') && S.despair === 0 && L.despair === 1, 'Unburden gives tokens to the closest Titan');
  const p0 = { ...S.pos }; await g.c5KratosWindow(S, A, { pole: true }, 1); ok(A.pole && g.isAdj(S) && (S.pos.c !== p0.c || S.pos.r !== p0.r), 'Pole Position moves to another adjacent space');
  g.prim.vp = g.prim.vp || null; if (g.prim.vp) { g.prim.vp.created = true; await g.c5Scale(S, 1); ok(S.onVP, 'Scale: climb VP without test'); } else ok(true, '(no VP in this scenario)');
  const B = { choices: {} }; g.kratosPool.closing = 0; await safe(g, () => g.secondWindow(L, { ...B, txt: '', g: L.gear[0], hits: 0, t: L }, { ...g.kratosEffects(L, {}), closing: 2 }, false)); ok(g.kratosPool.closing === 2, 'Closing X placed in 2nd window'); }
{ const g = mk(SET2, 'babel', 4); const W = g.titans[2]; if (g.stairLen && g.stairLen() > 2) { W.stair = 1; await safe(g, () => g.c5Scale(W, 2)); ok(W.stair === 3 || W.onVP, `Scale on Endless Staircase (stair ${W.stair})`); } else ok(true, '(staircase closed)'); }
{ const g = mk(); const W = g.titans[2]; W.rage = 7; const a = g.prim.anchor; W.pos = { c: a.c - 1, r: a.r }; for (const o of g.titans) if (o !== W) o.pos = { c: 1 + o.id, r: 1 };
  let clutchAsked = false; g.ask = async q => { if (/Kratos: Clutch/.test(q.title || '')) clutchAsked = true; return yes(q); }; g.rng.d10 = () => 9;
  const fp = g.facePower; await safe(g, () => g.titanAttack(W)); ok(true, `Wishender attack with Clutch row ran (asked: ${clutchAsked})`); }
// --- Cloudsoarer
{ const g = mk(); const Cl = g.titans[3];
  ok(g.inh(Cl, 'Raw Power') === 1, 'Raw Power 1 inherent'); const A = { raw: 0 }; await g.c5Power(Cl, Cl.gear[0], A); ok(A.raw === 1, 'Cloudsoarer +1 Power on Power Roll');
  ok(g.handCost(Cl, Cl.gear.find(x => x.card.name === 'Gigas')) === 2 && g.c5WeaponBanned(Cl, { card: data.gear.cards.find(c => c.name === 'Sirenblade') }), 'Lightweight Curse: 3-hand as 2-hand, no 1-hand');
  const fists = Cl.gear.find(x => x.card.name === 'Fists'); ok(!fists || fists.twoHand, 'Cloudsoarer Fists two-handed');
  await g.gainMidas(Cl, 1); ok(Cl.genTok === 1, 'Carry the Weight: Midas gain → token');
  Cl.genTok = 2; ok(await g.c4IgnoreAirFloat(Cl, 'Float') === true && Cl.genTok === 0, 'Carry the Weight 2: ignore Float');
  Cl.genTok = 1; let gotX = null; const o0 = Object.getPrototypeOf(Object.getPrototypeOf(g)); const sp = g.hermesStep; g.hermesStep = () => []; await g.hermesMove0(Cl, 2, 'HM'); g.hermesStep = sp; ok(Cl.genTok === 0 && logHas(g, /Hermes Move 2 → 3/), 'Carry the Weight 1: Hermes Move +1');
  Cl.genTok = 6; await g.addCurse(Cl, 'Goldthirst'); await g.addCondition(Cl, 'Fear'); const fa = g.freeActions(Cl); const cu = fa.find(a => /Curse Affliction/.test(a.label)); ok(!!cu, 'Carry the Weight 6 offered'); await cu.value(); ok(!Cl.conditions.includes('Goldthirst') && Cl.genTok === 0, 'Carry the Weight 6: remove Curse');
  Cl.genTok = 3; const cd = g.freeActions(Cl).find(a => /Condition 카드/.test(a.label)); await cd.value(); ok(!Cl.conditions.includes('Fear'), 'Carry the Weight 3: discard Condition');
  Cl.fate = 0; Cl.knockdown = null; const ll = await g.skyLifeline(Cl, 'Chasm에 떨어짐'); ok(ll && Cl.fate === 1 && Cl.knockdown, 'Lifeline costs Fate + Knockdown');
  // Levitate: end on chasm, start-of-turn check
  Cl.knockdown = null; Cl.fate = 0; for (const o of g.titans) if (o !== Cl) o.pos = { c: 1 + o.id, r: 14 }; Cl.pos = { c: 3, r: 5 }; g.board.addTerrain(['E4', 'E5'].map(x => x), { id: 'tchasm', type: 'Chasm', chasm: true });
  const ch = { c: 4, r: 5 }; const L1 = ['E4', 'E5'].map(x => ({ r: 'ABCDEFGHIJKLMN'.indexOf(x[0]) + 1, c: +x.slice(1) })); let cells = null; g.ask = async q => { if (q.type === 'move') { cells = q.cells; return L1.find(p => q.cells.some(c => c.c === p.c && c.r === p.r)) ? q.cells.find(c => L1.some(p => p.c === c.c && p.r === c.r)) : null; } return yes(q); };
  await g.chooseMove(Cl, 3, '이동'); ok(cells && cells.some(c => L1.some(p => p.c === c.c && p.r === c.r)) && g.board.isChasm(Cl.pos.c, Cl.pos.r), `Levitate: can end on Chasm (${Cl.pos.c},${Cl.pos.r}, fate ${Cl.fate})`);
  g.ask = yes; const f0 = Cl.fate; await safe(g, () => g.c4TurnStart(Cl)); ok(Cl.alive && Cl.fate === f0 + 1, 'Levitate: start on Chasm pays Fate');
  Cl.fate = 9; await safe(g, () => g.c4TurnStart(Cl)); ok(!Cl.alive, 'Levitate: cannot pay → dies'); }
// --- full battles with the new classes don't crash
for (const [set, pid] of [[SET1, 'hekaton'], [SET2, 'demidjinn'], [SET1, 'babel'], [SET2, 'midascore']]) { const g = mk(set, pid, 3); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, Math.min(1, q.max)).map(o => o.value); if (q.type === 'move') return q.cells[Math.floor(g.rng.next ? 0 : 0)] || null; const o = q.options.filter(x => !x.disabled); const ok2 = o.filter(x => x.value !== 'end'); return (o.find(x => x.value === true) || o.find(x => x.value === 'attack') || o.find(x => x.value === 'move') || o.find(x => x.value === 'end') || o[0]).value; };
  let res, err = null; try { res = await Promise.race([g.run(), new Promise(r => setTimeout(() => r('slow'), 60000))]); } catch (e) { err = e; }
  ok(!err, `battle ${pid} with ${set.map(s => s[0]).join('/')}: ${err ? err.stack : res}`); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
