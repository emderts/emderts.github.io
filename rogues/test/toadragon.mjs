// Toadragon of the Great Marsh: data, Crescendo / Dirge, Hop, Toadlets, Wave blocking, VP, simulations.
import fs from 'fs';
import path from 'path';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const autoAsk = clash => async q => {
  const M = clash.monster; const near = c => Math.min(...M.cells.map(m => Math.abs(m.c - c.c) + Math.abs(m.r - c.r)), 99);
  switch (q.type) {
    case 'confirm': return q.default;
    case 'dice': return [];
    case 'number': return q.default ?? q.options.at(-1).value;
    case 'order': return q.options.map(o => o.value);
    case 'pick': { if (q.options.some(o => o.value === 'skip')) return 'skip'; return q.options[0].value; }
    case 'move': { if (!q.knight) return q.cells[0]; const k = clash.knights.find(x => x.id === q.knight); const best = [...q.cells].sort((a, b) => near(a) - near(b))[0]; return near(best) < near(k.pos) ? best : null; }
    case 'action': { const v = q.options.map(o => o.value); if (v.includes('attack')) return 'attack'; const k = clash.knights.find(x => x.id === q.knight); if (v.includes('move') && !clash.engaged(k)) return 'move'; return 'end'; }
    default: return q.options ? q.options[0].value : null;
  }
};
const DS = data.monsters['toadragon-of-the-great-marsh'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'toadragon-of-the-great-marsh', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
const put = (c, k, l) => { c.board.remove([k.pos]); k.pos = P(c, l); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); };
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op && !('stat' in x && 'gte' in x)) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...DS.cards.ai, ...DS.cards.bp, DS.cards.signature, DS.cards.routine, DS.crescendo].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['bane', 'poison', 'toxify'].includes(o)); ok(DS.cards.ai.length === 18 && DS.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.length === 9 && M.cells.every(x => x.c >= 8 && x.c <= 10 && x.r >= 1 && x.r <= 3) && M.facing === 'N' && c.judiciumBase.some(j => /Sacrament/.test(j.name)) && c.swampTiles().length === 7, 'setup: 3x3 Toadragon on B8–D10 facing N, 7 Swamp tiles, Dragonfeast Judicium card');
  ok(M.drawAI().isCrescendo, 'Crescendo of Subjugation is performed first'); c.round = 1; await c.tdOp({ op: 'tdCrescendo' }, {}); ok(c.td.crescendoDone && c.knights.every(k => c.hasCondition(k, 'Poisoned')), 'Crescendo (first Monster Round): each Knight suffers Poison 1, an additional AI is performed'); }
{ const c = mk(2); const M = c.monster; for (const k of c.knights) put(c, k, 'A' + (1 + c.knights.indexOf(k))); await c.tdHop(c.tdDirs().forward); ok(M.cells.every(x => x.r >= 4 && x.r <= 6), 'Hop forward: 3 spaces in a straight line'); ok(!await c.tdHop(c.tdDirs().forward), 'Hop blocked by the Indestructible Great Mangrove'); for (const l of ['I9', 'I10', 'H9', 'H10']) c.board.terrain.delete(c.board.key(P(c, l))); await c.tdHop(c.tdDirs().forward); ok(M.cells.every(x => x.r >= 7 && x.r <= 9), 'second Hop'); await c.tdHop(c.tdDirs().forward); ok(M.facing === 'S' && M.cells.every(x => x.r >= 4 && x.r <= 6), 'Hop beyond the Board Edge: turns to face away from it, then moves 3 spaces'); }
{ const c = mk(3); const k = c.knights[0]; put(c, k, 'F9'); for (const o of c.knights.slice(1)) put(c, o, 'A' + (1 + c.knights.indexOf(o))); await c.tdHop(c.tdDirs().forward); ok(!k.alive, 'Bounding Behemoth: a Knight crashed by the Toadragon movement dies'); }
{ const c = mk(4); await c.tdSpawn(); const t = c.td.toads[0]; const far = Math.max(...c.swampTiles().map(tl => Math.min(...tl.map(x => c.tdDist(x))))); ok(c.td.toads.length === 1 && c.tdDist(t) >= far, `Spawn: on the Swamp tile furthest from the Toadragon (${L(c, t)})`);
  for (let i = 0; i < 5; i++) await c.tdSpawn(); ok(c.tdCount() === 6 && new Set(c.td.toads.map(x => c.swampTiles().findIndex(tl => tl.some(y => y.c === x.c && y.r === x.r)))).size === 6, '6 Toadlets on 6 different Swamp tiles'); await c.tdSpawn(); ok(c.td.sheet === 1 && c.td.toads.length === 5, '7th Spawn: the furthest Toadlet moves onto the Monster Sheet instead');
  const k = c.knights[0]; const t2 = c.td.toads[0]; const n = c.board.neighbors(t2).find(x => c.board.inside(x) && !c.board.terrainAt(x) && !c.knightAt(x) && !c.monsterOccupies(x)); put(c, k, L(c, n)); await c.tdKnightMoved(k); const p = c.hasCondition(k, 'Poisoned'); ok(!c.td.toads.includes(t2) && p && p.tokens >= 1, 'ending movement adjacent to a Toadlet: discard it, Poison 1');
  const p0 = k.passion, v0 = k.vigor; await c.fx.endOfTurn(k); ok(k.passion === p0 + p.tokens && k.vigor === v0, 'Dirge of Dominion: Poisoned gives [P] instead of losing [V]'); }
{ const c = mk(5); c.round = 2; c.td.crescendoDone = true; const n0 = c.monster.ai.cards.length; c.ask = async q => q.options && q.options.some(o => o.value === 'submit') ? 'submit' : (q.options ? q.options[0].value : null); await c.tdDirge(); ok(c.monster.ai.cards.length === n0 - 4, 'Dirge of Dominion: each Knight who Submits discards the top AI card');
  c.monster.ai.cards.length = 0; let lost = false; try { await c.tdDiscardAI(1, 'test'); } catch (e) { lost = /lose/.test(e.message); } ok(lost || c.result === 'lose', 'Crescendo would be discarded → performed: all Knights die'); }
{ const c = mk(6); const k = c.knights[0]; const o = c.knights[1]; put(c, k, 'I8'); put(c, o, 'J9'); ok(!c.waveBlocked(k) && c.waveBlocked(o), 'Wave Attack: a Knight behind the Great Mangrove (I9) is excluded'); }
{ const c = mk(7); const k = c.knights[0]; c.dgCreateVP(k, 'test'); put(c, k, 'E9'); ok(c.dgFreeActions(k).some(a => a.id === 'dg:climb'), 'VP created: Climb offered to an adjacent Knight'); c.dgClimb(k); const A = { knight: k, extraPool: { raw: 0 } }; await c.tdBeforeAttack(k, A); ok(k.onVP && A.extraPool.raw === 2 && A.vpNoResp, 'Severed Ichor Spines: +2 Power, VP Responses'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) { const lv = seed % 2 + 1; const c = mk(seed * 31 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 12, `simulations finished: ${done} (wins ${win})`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (toadragon)'); process.exit(fails ? 1 : 0);
