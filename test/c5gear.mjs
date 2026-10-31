import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt', 'meduketos', 'titanx', 'dragonofphobos', 'urfleece'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const yes = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mkP = (pid, gear, lv = 1, seed = 41) => { const g = new Game(data, { seed }); g.ask = yes; g.setup({ primordialId: pid, level: lv, argo: [], awakening: { enabled: true, spark: true }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: gear[i] })) }); g.log.length = 0; return g; };
const mk = (lv = 1, seed = 41) => { const g = new Game(data, { seed }); g.ask = yes; g.setup({ primordialId: 'urfleece', level: lv, argo: [], awakening: { enabled: true, spark: true }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Sirenblade', 'Siren Shield'] })) }); g.log.length = 0; return g; };
const has = (g, re) => g.log.some(l => re.test(l.msg));
const catchD = async f => { try { await f(); } catch (e) { if (!e.titan && !e.chainBreak && !e.result) throw e; } };

const C5 = data.gear.cards.filter(c => c.cycle === 5);
const W = C5.filter(c => /^hand/.test(c.slot) && c.atk != null), O2 = C5.filter(c => !(/^hand/.test(c.slot) && c.atk != null));
const bot = async q => { if (q.type === 'multi') return []; const o = q.options || []; if (q.type === 'move') return (q.cells || [])[0] || null; const ch = o.filter(x => !x.disabled); const at = ch.find(x => x.value === 'attack'); if (at) return 'attack'; return (ch.find(x => x.value === 'end') || ch[0] || {}).value; };
{ let bad = 0, res = {}; const prims = ['meduketos', 'dragonofphobos', 'urfleece', 'titanx', 'hekaton']; let k = 0;
  for (let i = 0; i < W.length; i += 4) { const gear = [0, 1, 2, 3].map(j => { const w = W[(i + j) % W.length]; const o = O2[(k++) % O2.length]; return [w.name, o.name, 'Siren Shield']; }); const pid = prims[(i / 4) % prims.length];
    let g; try { g = mkP(pid, gear, 1 + (i % 5), i + 3); g.ask = bot; const r = await g.run(); res[r] = (res[r] || 0) + 1; } catch (e) { bad++; console.log('ERR', pid, gear.map(x => x[0] + '+' + x[1]).join(' | '), e.stack.split('\n').slice(0, 5).join(' | ')); }
    const u = g ? g.log.filter(l => /미구현|수동 적용/.test(l.msg)) : []; if (u.length) console.log('  manual:', [...new Set(u.map(l => l.msg))].slice(0, 4)); }
  ok(!bad, 'battles with every Cycle V gear run ' + JSON.stringify(res)); }
// keyword unit checks
{ const g = mkP('dragonofphobos', [['Liquid Bow'], [], [], []]); await g.startOfBattle(); const A = g.titans[0]; const lb = A.gear.find(x => x.card.name === 'Liquid Bow'); ok(!!lb, 'Liquid Bow equipped'); }
{ const g = mkP('dragonofphobos', [['Strungstring', 'Siren Shield'], [], [], []]); await g.startOfBattle(); const A = g.titans[0]; const w = A.gear.find(x => x.card.name === 'Strungstring'); const a = g.prim.anchor; A.pos = { c: a.c - 1, r: a.r }; const orth = g.inWeaponRange(A, w); A.pos = { c: a.c - 1, r: a.r - 1 }; const dg = g.inWeaponRange(A, w); ok(!orth && dg, 'Non-euclidean: diagonal only'); }
{ const g = mkP('dragonofphobos', [['Pearlstalk Mace', 'Siren Shield'], [], [], []]); await g.startOfBattle(); const A = g.titans[0]; const w = A.gear.find(x => x.card.name === 'Pearlstalk Mace'); const a = g.prim.anchor; A.pos = { c: a.c - 1, r: a.r - 1 }; ok(g.inWeaponRange(A, w), 'Liquid Edge: diagonal adjacency in range'); }
{ const g = mkP('meduketos', [['Fire-Resistant Suit'], [], [], []]); await g.startOfBattle(); const A = g.titans[0]; ok(g.gearKWSum(A, 'Microwave Resistance') === 2, 'Microwave Resistance 2 from gear'); }
{ const g = mkP('urfleece', [['Chain Kusarigama', 'Bladedance Armor'], [], [], []]); await g.startOfBattle(); const A = g.titans[0]; ok(g.rageCap(A) === 9 && (A.pain = 2, g.rageCap(A) === 9), 'Pain Resilience from gear (' + g.rageCap(A) + ')'); }
// starred weapon stats / gear fixes
{ const g = mkP('urfleece', [['Eternal Vow'], ['Chain Kusarigama'], ['Deadalive Spear'], ['Veilwrappings']]); const [A, B, C, D] = g.titans; A.despair = 2; B.pain = 5;
  ok(g.xCard(A, A.gear[0].card).power.length === 3, 'Eternal Vow: X = 1 + Despair red dice'); ok(JSON.stringify(g.xCard(B, B.gear[0].card).bonusPower) === '["r","r"]', 'Chain Kusarigama: +half Pain red dice');
  ok(g.xCard(C, C.gear[0].card).bonusRaw === g.obolBase.length + g.obolExtra.length, 'Deadalive Spear: +X Power = Obol deck size');
  const s0 = g.speedOf(D); D.hidden = true; ok(g.speedOf(D) === s0 + 2, 'Veilwrappings: +2 Speed when Hidden'); }
{ const G = n => data.gear.cards.find(c => c.name === n && c.cycle === 5); ok(G('Abyss Wetsuit').evasion === 1 && !/Speed/.test(G('Abyss Wetsuit').text), 'Abyss Wetsuit: +1 Evasion'); ok(G('Coral Armor').evasionReroll === 2 && !G('Coral Armor').evasion, 'Coral Armor: Evasion Re-roll'); ok(G('Needleknives').pain && !G('Needleknives').amb, 'Needleknives: Pain set'); ok(G('Lunar Blade').prec === 2 && G('Penitent Whip').prec === 2, 'Lunar Blade / Penitent Whip +2'); }
{ const g = mkP('urfleece', [['Will Anthropos'], ['Aether Extinguisher'], [], []]); await g.startOfBattle(); const [A, B, C] = g.titans; ok(A.conditions.includes('Bravery'), 'Will Anthropos: Bravery at start of Battle');
  g.titans.forEach((t, i) => t.pos = { c: 2 + i * 4, r: 1 }); C.pos = { c: B.pos.c + 1, r: 1 }; const b0 = C.conditions.includes('Bravery'); await g.burn(C); ok(has(g, /Burn 무시/) && C.conditions.includes('Bravery') && !b0, 'Aether Extinguisher: adjacent Titan Burn ignored → Bravery'); }
// FAQ rulings
{ const g = mkP('urfleece', [['Illuminating Blinder'], [], [], []]); const [A] = g.titans; A.conditions = ['Dread']; await g.addCondition(A, 'Fear'); ok(A.alive && A.conditions.includes('Fear') && !A.conditions.includes('Dread'), 'Illuminating Blinder (FAQ): discard the existing Dread, keep the new Fear'); }
{ const g = mkP('urfleece', [['Darklight Wiring'], [], [], []]); const [A] = g.titans; A.despair = 3; A.ambrosia = 2; A.aether = 1; g._turnSeq = 5; const fa = g.freeActions(A).find(a => /Light X/.test(a.label)); ok(!!fa, 'Darklight Wiring: free action offered'); if (fa) { await fa.value(); ok(g.kwLight(A.gear[0], A) === 2, 'Darklight Wiring: the card itself has Light X'); } }
{ const g = mkP('hekaton', [['Golden Dawn'], [], [], []]); const [A] = g.titans; const gd = A.gear.find(x => x.card.name === 'Golden Dawn'); g.usableWeapons0 = () => [gd]; ok(g.usableWeapons(A).includes(gd), 'Golden Dawn usable with charges'); gd.charges = 0; ok(!g.usableWeapons(A).includes(gd), 'Commit ([charge]): no charge → cannot attack with it'); }
{ const g = mkP('hekaton', [['Sirenblade'], ['Sirenblade'], [], []]); const [A, B] = g.titans; let got = null; g.usableWeapons = () => [A.gear[0]]; const ot = g.titanAttack.bind(g); g.titanAttack = async (t) => { if (t === A) { g.pendingBonus = { titan: B, awaken: true }; const e = new Error('cb'); e.chainBreak = true; throw e; } }; g.awakenBonus = async (t) => { got = t; };
  await g.bonusAttackFlow(A, { bonus: true }); ok(got === B, 'Go Beyond / Awakening during a bonus attack: the Chain Break bonus attack is still granted'); }
{ const g = mkP('hekaton', [['Sirenblade'], ['Sirenblade'], [], []]); const [A, B] = g.titans; g.titans.forEach((t, i) => t.pos = { c: 1 + i, r: 1 }); A.pos = { ...g.prim.anchor }; g.titanAttack = async () => {}; await g.bonusAttackFlow(B, { bonus: true }); ok(!g.primContains(A.pos), 'Titan left under the Primordial after a Chain Break is knocked back before the bonus attack'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
