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
