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
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
