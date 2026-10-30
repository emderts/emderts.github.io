import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const mk = (pid, gears, lv = 3) => { const g = new Game(data, { seed: 4 }); g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: pid, level: lv, argo: [], titans: gears.map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
{ const g = mk('chimera', [['Analyticos Module'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; await g.startOfBattle(); g.round = 1; A.fate = 0; A.turn = { moved: false, attacked: false };
  const find = () => g.freeActions(A).find(o => /Analyticos Module/.test(o.label));
  const o = find(); ok(!!o, 'ability offered'); if (o) await o.value();
  for (const q of A.gear) q.exhausted = false; ok(!find(), 'same ability not offered again after unexhaust (same round)');
  g.round = 2; ok(!!find(), 'offered again next round');
}
{ const g = mk('chimera', [['Analyticos Module'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; const G = A.gear.find(q => q.card.name === 'Analyticos Module'); const t0 = G.card.text; G.card.text = 'Ψ⟳ Gain +2 Speed for your next Move. Ψ⟳ Place 1 Break or 1 Opening in the Kratos Pool.'; const k1 = g.abKey(A, 'Analyticos Module: 다음 이동 Speed +2 (Fate+1, 소진)'), k2 = g.abKey(A, 'Analyticos Module: Kratos Pool에 Break 1 (Fate+1, 소진)'); ok(k1 && k2 && k1 !== k2, 'multi-ability card: separate keys'); G.card.text = t0; }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A, B, C] = g.titans; const pc = g.primCells(); const p0 = pc[0];
  const adjCell = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ c: p0.c + dx, r: p0.r + dy })).find(q => g.board.inBounds(q.c, q.r) && !pc.some(z => z.c === q.c && z.r === q.r));
  A.onVP = true; B.pos = adjCell; C.pos = { c: adjCell.c + (adjCell.c - p0.c) * 3, r: adjCell.r + (adjCell.r - p0.r) * 3 };
  ok(g.tDist(A, B) === 1, 'VP titan adjacent to titan adjacent to Primordial'); ok(g.tDist(B, A) > 1, 'ground titan NOT adjacent to VP titan'); ok(g.tDist(A, C) > 1, 'VP titan not adjacent to far titan'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; const GL = g.data.gear.cards;
  const extra = GL.find(c => /^You have 1 additional Support slot\.?$/.test((c.text || '').trim()) || /You have 1 additional Support slot(?! for)/.test(c.text || '')); const sups = GL.filter(c => c.slot === 'support' && c !== extra && !/additional Support slot/.test(c.text || '')).slice(0, 3);
  A.gear = A.gear.filter(x => x.card.slot !== 'support'); for (const c of [extra, ...sups]) A.gear.push({ card: c, alt: null, exhausted: false, charges: 0, attached: null });
  const cnt = () => A.gear.filter(x => !x.discarded && x.card.slot === 'support').length; const c0 = cnt(); await g.slotOverflow(A); ok(cnt() === c0, `no overflow with extra slot (${extra && extra.name}, ${c0})`);
  g.discardGear(A, A.gear.find(x => x.card === extra)); await g.slotOverflow(A); ok(cnt() === 2, 'overflow discarded after losing slot card (' + cnt() + ')'); }
{ const g = new Game(data, { seed: 4 }); g.ask = async q => q.options ? q.options[0].value : null;
  g.setup({ primordialId: 'chimera', level: 3, argo: ['Cloud Support Fleet'], titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Red Polis'] })) });
  await g.startOfBattle(); g.round = 1; const A = g.titans[0]; A.turn = { moved: false, attacked: false };
  ok(g.argoActions(A).some(o => /Cloud Support Fleet/.test(o.label)), 'Cloud Support Fleet offered (non-cycle-4 primordial)'); }
{ const g = new Game(data, { seed: 4 }); g.ask = async q => q.options ? q.options[0].value : null;
  g.setup({ primordialId: 'chimera', level: 3, argo: [], awakening: { enabled: true, godforms: data.decks.godforms.map(x => x.name) }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Red Polis'] })) });
  await g.startOfBattle(); const A = g.titans[0];
  ok(g.godformChoices().some(x => x.name === 'Hades'), 'Hades in normal awakening choices');
  const card = data.decks.obol.find(o => o.code === 'AM0360'); try { await g.resolveDiedObol(A, card); } catch (e) { if (e.constructor.name !== 'ChainBreak') throw e; }
  ok(A.alive && g.gf(A, 'Hades') && A.godform.fromObol, 'AM0360 → Hades (obol awakening)');
  A.danger = 3; g.pendingBonus = null; await g.gainDanger(A, 2, { skipTrauma: true }); ok(A.danger === 1, 'Inverted Death: +2 → -2 (' + A.danger + ')');
  await g.gainDanger(A, 3, { skipTrauma: true }); ok(A.danger === 2 && A.godform.hadesDone, 'reach 0 then gain remainder (' + A.danger + ')');
  await g.gainDanger(A, 1, { skipTrauma: true }); ok(A.danger === 3, 'normal gain after token');
  ok(g.nonWeaponKW(A, null, 'Break') >= 1, 'Hades Break 1 on attacks');
  const B = g.titans[1]; await g.resolveDiedObol(B, card).catch(() => {}); ok(!B.alive, 'second AM0360 with Hades taken → die'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']], 7); const [A] = g.titans; const V = g.prim.vp;
  if (V && V.slots > 1) { V.created = true; V.count = 1; g.mountVP(A, 'test'); ok(V.occupants.includes(A), 'mounted multi-slot VP'); g.ask = async q => q.type === 'move' ? (q.cells.find(c => c) || null) : (q.options ? q.options[0].value : null); A.turn = { moved: false, attacked: false }; await g.chooseMove(A, 4, '이동');
    ok(!A.onVP && !V.occupants.includes(A), 'moving off multi-slot VP clears occupant'); } else ok(true, 'chimera VP single-slot (skip)'); }
{ const g = mk('chimera', [['Red Polis', 'Pandoran Cryptex'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; await g.startOfBattle(); g.round = 1; A.fate = 0; A.turn = { moved: false, attacked: false, usedAbilities: new Set() }; g._actor = A;
  const fs = () => g.freeActions(A).find(o => /Full Sync/.test(o.label)); ok(!!fs(), 'Pandoran Full Sync offered before attacking');
  A.turn.attacked = true; ok(!!fs(), 'Full Sync offered after attacking'); const o = fs(); if (o) await o.value(); ok(!A.turn.attacked && A.fatigueAtEnd === 'combat', 'Full Sync resets combat action, fatigue at end'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A, B] = g.titans; g._primRound = false; g._actor = A;
  await g.knockdown(A, true); ok(A.knockdown === 'falling' && A.kdOwnTurn, 'knockdown in own turn flagged');
  await g.knockdown(B, true); ok(B.knockdown === 'falling' && !B.kdOwnTurn, 'other titan knocked down during A turn not flagged'); }
{ const g = mk('cyclonus', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']], 8); const riv = [...g.board.terrain.values()].filter(z => /River/i.test(z.type || '')).length; ok(riv >= 30, 'Cyclonus Lv8 rivers ' + riv); ok(g.titans.some(t => t.pos && t.pos.r === 6 && t.pos.c === 8), 'Cyclonus Lv8 start F8'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; let seen = null; g.ask = async q => { if (q.type === 'move') { seen = q.options; return null; } return q.options ? q.options[0].value : null; };
  await g.chooseMove(A, 3, 'Heroic Death'); ok(seen && seen.some(o => /⚔/.test(o.label)), 'Heroic Death move marks attackable cells (' + (seen ? seen.filter(o => /⚔/.test(o.label)).length : 0) + ')'); }
{ const g = mk('hypertime', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; await g.toOmega(A, 'test'); ok(A.offBoard === 'omega', 'to omega'); await g.timeClock(A); ok(A.offBoard === 'clock' && A.clockSide === 'departing', 'Time-clocked from Omega Terminus → clocked (' + A.offBoard + ')'); }
{ const g = mk('hypertime', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); g.round = 2; const card = g.data.primordials.hypertime.ai.find(c => c.name === 'In Medias Res'); let n = 0; const od = g.traumaDraw.bind(g); g.traumaDraw = async (t, v, tier) => { n++; if (n === 1) { g.pendingBonus = null; const err = new Error('cb'); err.chainBreak = true; throw err; } };
  g.bonusAttackFlow = async () => {}; g.drawAI = () => null; await g.oracleSpecial({ ...card }, {}); ok(n === 3, 'In Medias Res continues after chain break (' + n + ' draws)'); }
{ const g = mk('hypertime', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; let asked = 0; g.ask = async q => { if (/행동 선택/.test(q.title || '')) { asked++; await g.timeClock(A); return q.options.find(o => o.value === 'move') ? 'move' : null; } if (q.type === 'move') return null; return q.options ? q.options[0].value : null; };
  try { await g.titanTurn(A); } catch (e) {} ok(asked === 1 && A.offBoard === 'clock', 'Time-clocked during own turn ends remaining actions (asked ' + asked + ')'); }
{ const g = mk('hypertime', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A, B, C, D] = g.titans; g.board.terrain.clear(); g.prim.facing = 'E'; const pc = g.primCells(); const maxC = Math.max(...pc.map(p => p.c)); const r0 = pc[0].r;
  for (const x of [C, D]) x.pos = { c: 1, r: 1 + x.id };
  A.pos = { c: maxC + 6, r: r0 }; B.pos = { c: maxC + 2, r: r0 }; const r1 = g.mainBeam(A).res; ok(r1.kind === 'titan' && r1.t === A, 'Laser: titan in path but not adjacent to target → no swap');
  B.pos = { c: maxC + 5, r: r0 }; const r2 = g.mainBeam(A).res; ok(r2.kind === 'titan' && r2.t === B, 'Laser: titan in path adjacent to target → swap'); }
{ const g = mk('harpy', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); await g.startOfBattle(); const [X, Y] = g.titans; g.board.terrain.clear(); X.pos = { c: 3, r: 3 }; Y.pos = { c: 4, r: 3 }; await g.harpyBleed(Y, 2, null); X.turn = { moved: false, attacked: false, usedAbilities: new Set() }; g._actor = X; g.round = 1;
  ok(g.freeActions(X).some(o => /Stop Bleeding Other/.test(o.label)), 'Stop Bleeding Other offered while actions remain (Harpy)'); }
{ const g = mk('harpy', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); await g.startOfBattle(); const [X, Y] = g.titans; g.board.terrain.clear(); X.pos = { c: 3, r: 3 }; Y.pos = { c: 4, r: 3 }; await g.harpyBleed(Y, 2, null); g.round = 1; let labels = null;
  g.ask = async q => { if (/행동 선택/.test(q.title || '') && !labels) { labels = q.options.map(o => o.label); return 'end'; } return q.options ? q.options[0].value : null; }; try { await g.titanTurn(X); } catch (e) {}
  ok(labels && labels.some(l => /Stop Bleeding Other/.test(l)), 'Stop Bleeding Other in the action menu (' + (labels || []).length + ' options)'); }
{ const g = mk('harpy', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); await g.startOfBattle(); const [X, Y, Z] = g.titans; g.board.terrain.clear(); X.pos = { c: 3, r: 3 }; Y.pos = { c: 4, r: 3 }; Z.pos = { c: 5, r: 3 }; if (!Y.conditions.includes('Bleeding')) Y.conditions.push('Bleeding'); Y.bleeding = 3; g.round = 1; for (const q of [X, Z]) { q.turn = { moved: false, attacked: false, usedAbilities: new Set() }; }
  g._actor = X; const o = g.freeActions(X).find(o => /Stop Bleeding Other/.test(o.label)); if (o) await o.value(); ok(!g.freeActions(X).some(o => /Stop Bleeding Other/.test(o.label)), 'Stop Bleeding Other once per round for the same Titan'); g._actor = Z; ok(g.freeActions(Z).some(o => /Stop Bleeding Other: T1/.test(o.label)), 'another Titan can still use Stop Bleeding Other');
  g._actor = X; g.round = 2; ok(g.freeActions(X).some(o => /Stop Bleeding Other: T1/.test(o.label)), 'available again next round'); }
{ const g = mk('harpy', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [X] = g.titans; if (!X.conditions.includes('Bleeding')) X.conditions.push('Bleeding'); X.bleeding = 3; g.round = 1; let menus = 0, sb = 0;
  g.ask = async q => { if (/행동 선택/.test(q.title || '')) { menus++; const o = q.options.find(o => o.value === 'bleedM' || o.value === 'bleedA'); if (o && menus < 4) { sb++; return o.value; } return 'end'; } return q.options ? q.options[0].value : null; }; try { await g.titanTurn(X); } catch (e) {} ok(sb === 1, 'Stop Bleeding (self) only once per round (' + sb + ')'); }
{ const g = mk('chimera', [['Red Polis', 'Muck Virus'], ['Red Polis'], ['The End'], ['Umbral Virus']]); let seen = null; const order = [];
  g.ask = async q => { if (/전투 시작: 동시에 발동하는 효과/.test(q.title || '') && !seen) { seen = q.options.map(o => o.label); return q.options[q.options.length - 1].value; } return q.options ? q.options[0].value : null; };
  const os = g.say.bind(g); g.say = (m, c) => { if (/전투 시작 —|Berserk|Ambrosia/.test(m)) order.push(m); return os(m, c); };
  await g.startOfBattle(); ok(seen && seen.length >= 3, 'Start of Battle: order prompt lists simultaneous effects (' + (seen || []).length + ')'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A, B] = g.titans; g.round = 1; if (!B.conditions.includes('Bleeding')) B.conditions.push('Bleeding'); B.bleeding = 3; B.gear[0].exhausted = true; let labels = null;
  g.ask = async q => { if (/Time Skip: .* 추가 전투 액션/.test(q.title || '')) { labels = q.options.map(o => o.label); return 'bleed'; } return q.options ? q.options[0].value : null; };
  await g.combatActionNow(B, 'Time Skip'); ok(labels && labels.some(l => /Stop Bleeding/.test(l)) && labels.some(l => /준비/.test(l)), 'Time Skip extra combat action offers Stop Bleeding / unexhaust'); ok(B.bleeding === 1, 'Stop Bleeding via Time Skip'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A, B] = g.titans; g.round = 1; B.gear[0].exhausted = true; let labels = null;
  g.ask = async q => { if (/Time Dilation: .* 추가 이동 액션/.test(q.title || '')) { labels = q.options.map(o => o.label); return 'unex'; } return q.options ? q.options[0].value : null; };
  await g.moveActionNow(B, 'Time Dilation'); ok(labels && labels.some(l => /이동 \(Speed/.test(l)) && labels.some(l => /준비/.test(l)) && !B.gear[0].exhausted, 'Time Dilation extra movement action offers move / unexhaust'); }
{ const g = mk('harpy', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A, B] = g.titans; A.gear.push({ card: { name: 'Hyperborean Strain', slot: 'tech', isTech: true, text: 'If you have exactly 1 Bleeding token, ignore the Bleeding Condition.' }, alt: null, exhausted: false, charges: 0 });
  for (const x of g.titans) { x.conditions = x.conditions.filter(c => c !== 'Bleeding'); x.bleeding = 0; } A.conditions.push('Bleeding'); A.bleeding = 1; g.attackedThisRound = new Set();
  ok(!g.bleeds(A) && g.predatorTarget() !== A, 'Hyperborean Strain: 1 Bleeding token ignored (not a Predation target)'); A.bleeding = 2; ok(g.bleeds(A), '2 tokens: Bleeding counts'); }
{ const g = mk('chimera', [['Red Polis', 'Aristeia Inducer'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; g.rng.pick = arr => arr.find(o => o.result === 'live') || arr[0]; g.ask = async q => q.options ? q.options[0].value : null;
  await g.obolDraw(A, 10).catch(() => {}); const ar = A.gear.find(x => x.card.name === 'Aristeia Inducer'); ok(ar && ar.tokens === 1, 'Aristeia Inducer: token after surviving an Obol (' + (ar && ar.tokens) + ')'); }
{ const g = mk('chimera', [['Red Polis', 'Aristeia Inducer'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; const ar = A.gear.find(x => x.card.name === 'Aristeia Inducer'); ar.tokens = 2; await g.awakenRoll(A, 10, 'test'); ok(ar.tokens === 2, 'Aristeia Inducer tokens are not spent by the Awakening roll'); }
{ const g = mk('harpy', [['Shieldblade'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; let asked = null; const w = A.gear.find(x => x.card.name === 'Shieldblade');
  g.ask = async q => { if (/Rapid Adaptation: 「Shieldblade」 이번 공격/.test(q.title || '')) { asked = q.options.map(o => o.label); throw new Error('stop'); } return q.options ? q.options[0].value : null; };
  A.pos = (() => { const pc = g.primCells(); const p0 = pc[0]; return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ c: p0.c + dx, r: p0.r + dy })).find(q => g.board.inBounds(q.c, q.r) && !g.primContains(q) && !g.titanAt(q.c, q.r)); })(); g.board.terrain.clear();
  try { await g.titanAttack(A); } catch (e) {} ok(asked && asked.length === 2, 'Rapid Adaptation: 2-class weapon asks at the start of each attack (' + (asked || []).join(' / ') + ')'); }
{ const g = new Game(data, { seed: 4 }); g.ask = async q => q.options ? q.options[0].value : null;
  g.setup({ primordialId: 'chimera', level: 3, argo: [], awakening: { enabled: true, godforms: data.decks.godforms.map(x => x.name) }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Red Polis'] })) });
  await g.startOfBattle(); const A = g.titans[0]; try { await g.awaken(A, { inline: true }); } catch (e) {} A.godform.beyond = true; const gf = A.godform.def.name;
  const r1 = await g.awaken(A, { inline: true }); const r2 = await g.awakenRoll(A, 1, 'test');
  ok(r1 === false && r2 === false && A.godform.def.name === gf, 'Went Beyond → cannot Awaken again (awaken & roll blocked)'); }
{ const g = new Game(data, { seed: 4 }); g.ask = async q => q.options ? q.options[0].value : null;
  g.setup({ primordialId: 'chimera', level: 3, argo: [], titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Red Polis'] })) });
  const r = g.powerDiceLimit(['r','r','r','r','r','r','r','b','b','b','b','w','w','w','m','m','m']).join('');
  ok(r === 'rrrrrbbbwwm', 'Power Dice Limit (r6 b4 w3 m1): 2 over-limit → 1 tier up, excess mortal dropped (' + r + ')'); }
{ const g = new Game(data, { seed: 4 }); g.ask = async q => q.options ? q.options[0].value : null;
  g.setup({ primordialId: 'chimera', level: 3, argo: [], titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Red Polis'] })) });
  await g.startOfBattle(); const A = g.titans[0]; A.knockdown = 'kd'; let atk = 0; const orig = g.titanAttack.bind(g); g.usableWeapons = () => { atk++; return []; };
  await g.bonusAttackFlow(A, {}); await g.titanAttack(A, { strikeback: true }); const kd = atk === 0 && g.log.some(l => /Knockdown 상태 — 보너스 공격 불가/.test(l.msg || l.text || l));
  A.knockdown = null; A.offBoard = 'clock'; await g.titanAttack(A, { bonus: true });
  ok(kd && atk === 0 && g.abilityLock(A) === 'Time-clocked', 'Knockdown / Time-clocked: bonus attack & strikeback blocked'); }
{ const g = new Game(data, { seed: 4 }); g.ask = async q => q.options ? q.options[0].value : null;
  g.setup({ primordialId: 'chimera', level: 3, argo: [], titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Red Polis'] })) });
  await g.startOfBattle(); g.round = 1; const A = g.titans[0]; A.turn = { moved: false, attacked: false, usedAbilities: new Set() }; A.fate = 0;
  const gA = { card: { name: 'GX', slot: 'support', text: 'Ψ⟳ Gain +2 Speed for your next movement this turn.' } }, gS = { card: { name: 'GS', slot: 'support', text: 'Ψ⟳ Stand up. You can use this ability while knocked down.' } };
  A.knockdown = 'kd'; const f0 = g.fr(A), r0 = g.frRaw(A); const c1 = g.costOK(A, 'Ψ⟳', gA), c2 = g.costOK(A, 'Ψ⟳', gS);
  const fa = g.freeActions(A).map(o => o.label); A.knockdown = null; const c3 = g.costOK(A, 'Ψ⟳', gA);
  ok(f0 === 0 && r0 === 9 && !c1 && c2 && c3 && !fa.some(l => /^\[Mnemos\]|Red Polis:/.test(l)), 'Knockdown: active abilities blocked (Ψ), "while knocked down" allowed, Fate rerolls still use raw'); }
{ const g = new Game(data, { seed: 4 }); g.ask = async q => q.options ? q.options[0].value : null;
  g.setup({ primordialId: 'chimera', level: 3, argo: [], titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Red Polis'] })) });
  await g.startOfBattle(); g.round = 1; const [A, B] = g.titans; A.turn = { moved: false, attacked: false, usedAbilities: new Set() }; B.pos = { c: A.pos.c + 1, r: A.pos.r }; if (!g.board.inBounds(B.pos.c, B.pos.r) || g.tDist(A, B) !== 1) B.pos = { c: A.pos.c - 1, r: A.pos.r };
  B.conditions.push('Bleeding'); B.bleeding = 2; const before = g.freeActions(A).some(o => /Stop Bleeding Other/.test(o.label)); A.knockdown = 'kd'; const after = g.freeActions(A).some(o => /Stop Bleeding/.test(o.label));
  ok(before && !after, 'Knockdown: Stop Bleeding Other blocked'); }
{ const g = mk('hekaton', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; const asked = [];
  g.ask = async q => { asked.push(q.title || ''); if (/보너스 공격: 공격 Response/.test(q.title || '')) return true; return q.options ? q.options[0].value : null; };
  A.pos = (() => { const pc = g.primCells(); const p0 = pc[0]; return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ c: p0.c + dx, r: p0.r + dy })).find(q => g.board.inBounds(q.c, q.r) && !g.primContains(q) && !g.titanAt(q.c, q.r)); })(); g.board.terrain.clear();
  const w = A.gear.find(x => x.card.name === 'Red Polis'); w.exhausted = true; for (const c of g.bp.cards) { c.at = 99; c.responses = { ...c.responses, FAIL: 'Pushback 2. Perform Signature against the Attacker.' }; }
  try { await g.titanAttack(A, { bonus: true }); } catch (e) {}
  ok(!w.exhausted || g.log.some(l => /보너스 공격 — 「Red Polis」 준비/.test(l.msg)), 'Bonus Attack: exhausted weapon may be declared (unexhausted)');
  ok(asked.some(x => /보너스 공격: 공격 Response/.test(x)) && g.log.some(l => /보너스 공격 — 공격 Response 무시 \(나머지 「Pushback 2\.」는 적용\)/.test(l.msg)), 'Bonus Attack: ignores only the attack part (Signature) of the Response'); }
{ const g = mk('hekaton', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; const asked = []; g.ask = async q => { asked.push(q.title || ''); return q.options ? q.options[0].value : null; };
  A.pos = (() => { const pc = g.primCells(); const p0 = pc[0]; return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ c: p0.c + dx, r: p0.r + dy })).find(q => g.board.inBounds(q.c, q.r) && !g.primContains(q) && !g.titanAt(q.c, q.r)); })(); g.board.terrain.clear();
  for (const c of g.bp.cards) { c.at = 99; c.responses = { FAIL: 'Pushback 2.' }; } try { await g.titanAttack(A, { bonus: true }); } catch (e) {}
  ok(!asked.some(x => /보너스 공격: 공격 Response/.test(x)), 'Bonus Attack: non-attack Response cannot be ignored'); }
{ const g = mk('pursuer', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']], 3); g.prim.traits['Darkness Comes With Me'] = true; g.prim.facing = 'E';
  const cells = g.primCells(); const minC = Math.min(...cells.map(x => x.c)); const rows = [...new Set(cells.map(x => x.r))]; const [A, B, C, D] = g.titans; g.board.terrain.clear();
  for (const x of g.titans) x.pos = { c: 20, r: 14 - x.id };
  A.pos = { c: Math.max(1, minC - 6), r: rows[0] }; B.pos = { c: minC - 1, r: Math.min(14, Math.max(...rows) + 1) }; C.pos = { c: minC - 1, r: rows[rows.length - 1] };
  const kb = []; g.knockback = async (o) => { kb.push(o.name); }; await g.darkness();
  ok(kb.includes(A.name) && kb.includes(C.name) && !kb.includes(B.name), 'Darkness Comes With Me: 2 lanes directly behind, to the board edge (' + kb.join(',') + ')'); }
{ const g = mk('burden', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; A._roundStart = { c: 1, r: 1 }; const p0 = { ...A.pos }; await g.rewind(A);
  ok(A.pos.c === p0.c && A.pos.r === p0.r && (g.prim.def.cycle === 2) && g.log.some(l => /Theatre에서는 하지 않음/.test(l.msg)), 'Burden (Theatre): Cycle II, Rewind not resolved'); }
// --- errata / FAQ batch ---
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; g.awk = g.awk || { avail: [], used: [] };
  const H = data.decks.godforms.find(x => x.name === 'Hephaestus'); A.godform = { def: H, trespass: 2 }; const died = data.decks.obol.find(o => o.code === 'AM0354');
  g.rng.pick = () => died; await g.obolDraw(A, 10).catch(() => {}); ok(A.godform && A.godform.trespass === 1 && A.alive, 'Hephaestus errata: You Died Obol → Trespass −1 (still cannot die)'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; const live = data.decks.obol.find(o => o.code === 'AM0353');
  g.rng.pick = () => live; await g.obolDraw(A, 10).catch(() => {}); const s1 = A._obolSurvived; const died = data.decks.obol.find(o => o.code === 'AM0354'); A.godform = { def: data.decks.godforms.find(x => x.name === 'Hephaestus'), trespass: 2 }; g.rng.pick = () => died; await g.obolDraw(A, 10).catch(() => {});
  ok(s1 === true && A._obolSurvived === false && A.alive, 'FAQ: only a drawn You Live counts as surviving an Obol'); }
{ const T = data.gear.cards || data.gear; const f = n => (Array.isArray(T) ? T : []).find(x => x.name === n) || {};
  ok(/Once per turn you may draw an Obol/.test(f('The End').text) && /Ranged 2-3/.test(f('Devolver').text) && !/Ψ Quantum/.test(f('Devolver').text) && ['Repurposed Cryptex', 'Future Cryptex', 'Argocryptex Alpha', 'Argocryptex Beta', 'Argocryptex Gamma'].every(n => /Titan Attachment\. Restricted \(Cryptex\)/.test(f(n).text)) && /Unholy Alchemy as a free action/.test(f('Slushbane').text), 'gear errata applied'); }
{ const g = mk('chimera', [['Slushbane'], ['Red Polis'], ['The End'], ['Umbral Virus']]); g.round = 1; const A = g.titans[0]; A.turn = { moved: false, attacked: false, usedAbilities: new Set() }; A.gear[0].midas = 1; ok(g.freeActions(A).some(o => /Unholy Alchemy/.test(o.label)), 'Slushbane: Unholy Alchemy as a free action'); }
{ const g = mk('hypertime', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; A.onVP = true; await g.reestablishAnchor(A); const a = g.anchorOf(A); ok(a && g.primCells().some(p => Math.abs(p.c - a.c) + Math.abs(p.r - a.r) === 1), 'FAQ: on a VP, Time Anchor goes adjacent to the Primordial'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); g.kratosPool.opening = 0; g.kratosPool.break = 0; g.ask = async q => q.options.find(o => /Opening 2 \/ Break 1|Opening 1 \/ Break 2/.test(o.label))?.value ?? q.options[0].value; await g.poolFromText('Place 3 Opening and/or Break tokens', g.titans[0]); ok(g.kratosPool.opening + g.kratosPool.break === 3 && g.kratosPool.opening > 0 && g.kratosPool.break > 0, 'FAQ: "N Opening and/or Break" = N tokens total, mix allowed'); }
{ const g = mk('hekaton', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const [A] = g.titans; g.ask = async q => q.type === 'multi' ? [] : q.options ? q.options[q.options.length - 1].value : null;
  A.pos = (() => { const pc = g.primCells(); const p0 = pc[0]; return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ c: p0.c + dx, r: p0.r + dy })).find(q => g.board.inBounds(q.c, q.r) && !g.primContains(q) && !g.titanAt(q.c, q.r)); })(); g.board.terrain.clear();
  const w = A.gear.find(x => x.card.name === 'Red Polis'); w.card = { ...w.card, text: (w.card.text || '') + ' Crit Miss: Knockdown.' }; g.kratosPool.opening = 2; g.rng.d10 = () => 1;
  try { await g.titanAttack(A); } catch (e) {} ok(A.knockdown && g.log.some(l => /남은 공격 취소/.test(l.msg)) && g.kratosPool.opening >= 2, 'FAQ: Crit Miss Knockdown cancels the rest of the Attack, Kratos Pool kept'); }
// --- FAQ batch 2 ---
{ const g = mk('chimera', [['Red Polis', 'Aristeia Inducer'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; g.awk = { avail: data.decks.godforms.map(x => x.name), used: [], spark: false }; const ar = A.gear.find(x => x.card.name === 'Aristeia Inducer'); ar.tokens = 3; try { await g.awaken(A, { inline: true }); } catch (e) {} ok(A.godform && ar.tokens === 0, 'FAQ: Aristeia Inducer loses all tokens after Awakening'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; A.stair = 2; const B = g.titans[1]; B.stair = 3; ok(g.tDist(A, B) === 99, 'FAQ: Titans in the Endless Staircase are never adjacent'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; A.gear.push({ card: { name: 'MR', slot: 'support', text: 'Midas Resistant 2.' }, midas: 0 }); const q = A.gear[A.gear.length - 1]; const c1 = g.midasCap(A, q); q.exhausted = true; ok(c1 === 3 && g.midasCap(A, q) === 1, 'FAQ: exhausted gear loses Midas Resistant'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; A.danger = 3; let drewBeforeKD = null; g.traumaDraw = async () => { drewBeforeKD = !A.knockdown; }; g.knockdown = async (t) => { t.knockdown = 'kd'; };
  g.applyAttackEffect0 = async function (t) { await this.gainDanger(t, 2, { fromAttack: true, noArmor: true }); await this.knockdown(t); }; await g.applyAttackEffect(A, 'Each hit deals 2 DANGER and Knockdown.', 1, { name: 'x' }); ok(drewBeforeKD === false, 'FAQ: "... DANGER and X" resolves X before the Trauma Draw'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; A.conditions.push('Abandon'); A.pos = { c: 2, r: 7 }; g.board.terrain.clear(); A.speed = 3; await g.abandonFlee(A).catch(() => {}); ok(!A.alive && A.ranAway, 'Abandon: flees toward the closest edge with full Speed, crossing it = runs away'); }
// --- FAQ batch 3 ---
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); g.round = 1; const [A, B] = g.titans; g.board.terrain.clear(); g.prim.anchor = { c: 18, r: 2 }; A.pos = { c: 10, r: 7 }; B.pos = { c: 8, r: 7 }; B.stonewall = 1; for (const x of g.titans.slice(2)) x.pos = { c: 20, r: x.id }; g.crash = async () => {};
  await g.kickback(A, 4, 'W').catch(e => console.log('E', e.message)); ok(g.log.some(l => /Stonewall 타이탄에 튕겨/.test(l.msg)) && A.pos.c === 9 && A.pos.r !== 7, 'FAQ: Kickback bounces off a Stonewall Titan (' + A.pos.c + ',' + A.pos.r + ')'); }
// --- FAQ batch 4 ---
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; const base = g.speedOf(A); A.godform = { def: data.decks.godforms.find(x => x.name === 'Hermes'), trespass: 2 }; const T = g.speedOf0(A); ok(g.speedOf(A) === Math.max(T + A.speed, 2 * T), 'FAQ: Hermes speed — best order of doubling/modifiers (' + g.speedOf(A) + ')'); }
{ const g = mk('chimera', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const A = g.titans[0]; g._actor = A; A.conditions.push('Covetous'); g._covN = 0; g._covP = 0; g.kratosPool.opening += 1; g.kratosPool.break += 1; g.kratosPool.opening += 1; g.kratosPool.break += 1; ok(g.kratosPool.opening + g.kratosPool.break === 2, 'FAQ: Covetous places half of the TOTAL tokens (' + (g.kratosPool.opening + g.kratosPool.break) + '/4)'); }
{ const g = mk('hekaton', [['Red Polis'], ['Red Polis'], ['The End'], ['Umbral Virus']]); const log = []; g.ask = async q => /동시에 발동하는 효과/.test(q.title || '') ? (q.options.find(o => o.value === 1) && log.length === 0 ? 1 : -1) : (q.options ? q.options[0].value : null);
  const trig = [{ t: null, label: 'A', run: async () => log.push('A') }, { t: null, label: 'B mandatory', run: async () => log.push('B') }, { t: null, label: 'C optional', run: async () => { if (await g.ask({ type: 'yn', title: 'C?', options: [{ label: '사용', value: true }, { label: '안 함', value: false }] })) log.push('C'); } }];
  await g.resolveTriggers(trig, 'test'); ok(log.join() === 'A,B' && g.log.some(l => /모두 안 함/.test(l.msg)), 'Simultaneous triggers: "모두 안 함" passes optional prompts, mandatory ones still resolve (' + log.join() + ')'); }
