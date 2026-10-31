import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt', 'meduketos', 'titanx', 'dragonofphobos', 'urfleece'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const yes = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (lv = 1, seed = 41) => { const g = new Game(data, { seed }); g.ask = yes; g.setup({ primordialId: 'urfleece', level: lv, argo: [], awakening: { enabled: true, spark: true }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Sirenblade', 'Siren Shield'] })) }); g.log.length = 0; return g; };
const has = (g, re) => g.log.some(l => re.test(l.msg));
const catchD = async f => { try { await f(); } catch (e) { if (!e.titan && !e.chainBreak && !e.result) throw e; } };
const O = data.primordials.urfleece;
const tiles = g => g.prim.tiles.map(T => T.lane + ':' + T.c).sort().join(' ');
{ const g = mk(1); ok(g.prim.size === 2 && g.prim.anchor.c === 15 && g.prim.anchor.r === 6 && g.sig.name === 'Rising Tide' && g.routine.name === 'Coming of Darkness', 'setup: 2x2 at F15, sig/routine (Mnestis)');
  ok(g.prim.tiles.length === 4 && [...g.board.terrain.values()].filter(z => z.abyss).length === 36 && g.ufTile() && g.ufTile().lane === 3, '4 Black Abyss tiles, UF on lane 3'); ok(g.prim.argo === 4 && g.prim.track === 8, 'Abyss Track Lv1: Argo 4, UF 8'); ok(!g.board.inBounds(5, 1) && !g.board.inBounds(5, 14) && g.board.inBounds(5, 2), 'rows A/N not play area');
  const g5 = mk(5); ok(g5.prim.argo === 10 && g5.prim.track === 18, 'Lv5+: Argo 10, UF 18'); ok(g.prim.bonus.AT === -1, 'Just a Memory: -1 AT'); }
// flicker / fade in / march / race
{ const g = mk(1); await g.startOfBattle(); g.titans.forEach((t, i) => t.pos = { c: 18 + (i % 2), r: 2 + i * 3 }); await g.ufFlicker(); ok(g.ufTile().lane === 2 && g.prim.anchor.c === 10, 'Flicker → closest tile to the left, left spaces (' + JSON.stringify(g.prim.anchor) + ')'); }
{ const g = mk(1); await g.startOfBattle(); g.titans.forEach((t, i) => t.pos = { c: 18 + (i % 2), r: 2 + i * 3 }); g.prim.anchor = { c: 6, r: 3 }; await g.ufFadeIn(); ok(g.ufTile().lane === 2 && g.prim.anchor.c === 11, 'Fade In → closest tile to the right, right spaces'); }
{ const g = mk(1); await g.startOfBattle(); g.titans.forEach((t, i) => t.pos = { c: 18 + (i % 2), r: 2 + i * 3 }); let r = null; try { await g.ufFadeIn(); } catch (e) { r = e.result; } ok(r === 'defeat', 'Fade In with no tile to the right → defeat'); }
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; g.titans.forEach((t, i) => t.pos = { c: 1, r: 2 + i * 3 }); A.pos = { c: 13, r: 9 }; g.prim.anchor = { c: 10, r: 9 }; await g.ufMarch(); ok(g.prim.anchor.c === 15 && !A.alive && tiles(g).includes('2:15'), 'Black March: tile+UF 5 right, Titan in path devoured'); }
{ const g = mk(1); await g.startOfBattle(); g.titans.forEach((t, i) => t.pos = { c: 9, r: 2 + i * 3 }); g.prim.anchor = { c: 2, r: 12 }; let r = null; try { await g.ufRace(); } catch (e) { r = e.result; } ok(!r && tiles(g) === '1:7 2:15 3:1 4:11', 'Race: tiles +5, lane 3 tile removed → new tile at left (' + tiles(g) + ')'); }
{ const g = mk(1); await g.startOfBattle(); g.titans.forEach((t, i) => t.pos = { c: 9, r: 2 + i * 3 }); let r = null; try { await g.ufRace(); } catch (e) { r = e.result; } ok(!r && g.ufTile() && g.ufTile().lane === 3 && g.prim.anchor.c === 2, 'Race: UF tile wraps to the left edge, UF rides along (' + JSON.stringify(g.prim.anchor) + ')'); }
// track
{ const g = mk(1); await g.startOfBattle(); let r = null; try { await g.ufTrack(4, 't'); } catch (e) { r = e.result; } ok(r === 'defeat', 'UF catches the Argo → defeat'); }
{ const g = mk(1); await g.startOfBattle(); g.ask = async q => q.options[0].value; let r = null; try { await g.ufArgo(4, 't'); } catch (e) { r = e.result; } ok(r === 'victory' && g.prim.escaped, 'Argo escapes → declare victory'); }
// ur-knockback / ur-pull
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; A.pos = { c: 3, r: 6 }; await catchD(() => g.ufKnock(A, 4)); ok(!A.alive, 'Ur-Knockback toward Boundless left edge → dies'); }
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; A.pos = { c: 18, r: 6 }; g.prim.anchor = { c: 14, r: 6 }; await catchD(() => g.ufPull(A, 3)); ok(!A.alive, 'Ur-Pull through Black Abyss → devoured'); }
// smother
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; const L0 = g.lightOf(A); A.gear.push({ card: { name: 'Lamp', text: 'Light 2.', slot: 'misc' }, discarded: false, exhausted: false }); const L1 = g.lightOf(A); await g.gainAmbrosia(A, 1); const L2 = g.lightOf(A); ok(L1 === L0 + 2 && L2 === L0, 'Smother: Ambrosia on Light X gear disables its Light (' + [L0, L1, L2] + ')'); }
{ const g = mk(3); await g.startOfBattle(); ok(g.woundCount() === 86, "Argo's Parting Gift: Lv3 = 86 Wounds"); }
{ const g = mk(2); await g.startOfBattle(); const t = g.titans[0]; const bp = O.bp.find(b => b.name === 'The Black Truth'); g.titans.forEach((x, i) => x.pos = { c: 19, r: 2 + i * 3 }); let r = [];
  g.ufFlicker = async () => {}; for (const P of [30, 30, 30]) { const A = { t, bp, total: P, crit: false }; r.push(await g.ufAFA(t, A, 38)); } ok(r.join() === 'store,store,wound', 'All for All: 15+15+15 ≥ 38 → Wound on 3rd attack (' + r + ')');
  const A2 = { t, bp, total: 4, crit: false }; await g.ufAFA(t, { t, bp, total: 2, crit: false }, 38); await g.ufAFA(t, { t, bp, total: 2, crit: false }, 38); await g.ufAFA(t, { t, bp, total: 2, crit: false }, 38); ok((await g.ufAFA(t, A2, 38)) === null && !g.prim.afa, 'All for All: 4th attack fails → erase, normal fail'); }
// all AI cards resolve
{ let bad = 0; for (const c of O.ai) for (const lv of [1, 4, 7]) { const g = mk(lv, 9); await g.startOfBattle(); try { await g.safe(() => g.resolveAI(c)); } catch (e) { if (!e.result) { bad++; console.log(c.name, lv, e.stack.split('\n').slice(0, 4).join(' | ')); } } const u = g.log.filter(l => /미구현|수동 적용/.test(l.msg)); if (u.length) { bad++; console.log(c.name, [...new Set(u.map(l => l.msg))]); } } ok(!bad, 'all AI cards resolve'); }
// BP
{ let bad = 0; for (const bp of O.bp) { const g = mk(5, 9); await g.startOfBattle(); const A = g.titans[0]; A.pos = { c: g.prim.anchor.c - 1, r: g.prim.anchor.r }; if (g.titanAt(A.pos.c, A.pos.r) !== A) A.pos = { c: g.prim.anchor.c + 1, r: g.prim.anchor.r };
  for (const [k, txt] of Object.entries(bp.responses)) { try { await g.safe(() => g.doEffects(A, txt, { response: true })); } catch (e) { if (!e.result && !e.titan) { bad++; console.log('ERR', bp.name, k, e.stack.split('\n').slice(0, 3).join('|')); } } }
  try { await g.safe(() => g.ufCritical(A, { t: A, bp })); } catch (e) { if (!e.result) { bad++; console.log('ERR crit', bp.name, e.message); } }
  const u = [...new Set(g.log.map(l => l.msg).filter(m => /미구현|수동 적용/.test(m)))]; if (u.length) { bad++; console.log(bp.name, u); } } ok(!bad, 'all BP responses / crits resolve'); }
// full battles
{ let bad = 0, res = {}; for (const lv of [1, 3, 5, 7, 9]) for (const seed of [1, 2]) { const g = mk(lv, seed); g.ask = async q => { if (q.type === 'multi') return []; const o = q.options || []; if (q.type === 'move') return (q.cells || [])[0] || null; const ch = o.filter(x => !x.disabled); const at = ch.find(x => x.value === 'attack'); if (at) return 'attack'; return (ch.find(x => x.value === 'end') || ch[0] || {}).value; }; try { const r = await g.run(); res[r] = (res[r] || 0) + 1; } catch (e) { bad++; console.log('lv', lv, seed, e.stack.split('\n').slice(0, 5).join(' | ')); } const u = g.log.filter(l => /미구현|수동 적용/.test(l.msg)); if (u.length) { bad++; console.log(lv, [...new Set(u.map(l => l.msg))].slice(0, 5)); } } ok(!bad, 'full battles run ' + JSON.stringify(res)); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
