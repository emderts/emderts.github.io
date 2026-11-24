// Bog Witch: data, Bog track / Bog Move, Hexes, Mud Wisp / Stray, Talisman Hunt, simulations.
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
const BW = data.monsters['bog-witch'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'bog-witch', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...BW.cards.ai, ...BW.cards.bp, BW.cards.signature, BW.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o)); ok(BW.cards.ai.length === 18 && BW.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.map(x => L(c, x)).sort().join() === 'C7,C8,D7,D8' && M.facing === 'N' && c.bw.swamps.length === 4 && BW.cards.ai.every(a => a.ops.hex), 'setup: Bog Witch on D7/D8/C7/C8 facing N, 4 Swamp tiles, every AI card carries a Hex'); }
{ const c = mk(2); const M = c.monster, B = c.board; const k = c.knights[0];
  await c.bwBogMove(k); ok(c.bw.track === 1 && ['C7', 'C8', 'D7', 'D8'].every(l => B.terrain.get(B.key(P(c, l))).id === 'swamp') && c.bw.swamps.length === 5, `Bog Move 1 (Swamp): Swamp under the Witch, Witch moves to the Swamp tile furthest from the Target (${M.cells.map(x => L(c, x)).join('/')})`);
  await c.bwBogMove(k); ok(c.bw.track === 2 && !!c.bw.wisp, `Bog Move 2 (Mud Wisp): marker on a Weakspot space (${c.bw.wisp && L(c, c.bw.wisp)}), Witch moves away`);
  const cells = M.cells.map(x => L(c, x)); await c.bwBogMove(k); ok(c.bw.track === 0 && c.bw.off && !M.cells.length && cells.every(l => B.terrain.get(B.key(P(c, l))).id === 'rotten stump'), 'Bog Move 3 (Rotten Stump): tile under the Witch, Witch removed from the Board');
  const w = c.bw.wisp; c.moveKnight(k, w); await c.bwWispCheck(); ok(!c.bw.off && !c.bw.wisp && M.cells.length === 4 && M.cells.some(x => x.c === w.c && x.r === w.r), `a Knight on the Mud Wisp: the Witch is placed on it (${M.cells.map(x => L(c, x)).join('/')})`); }
{ const c = mk(3); const M = c.monster; const k = c.knights[0]; const card = M.ai.cards.find(x => x.name === 'Broom Sweep') || M.ai.cards[0]; const n0 = M.ai.cards.length + M.ai.discard.length;
  await c.bwGainHex(k, card, true); ok(k.hexes.length === 1 && M.ai.cards.length + M.ai.discard.length === n0 - 1 && c.bwHexed(k, card.ops.hex.name), `Hex Weaver: the AI card goes to the Knight Board (${card.ops.hex.name})`);
  const c2 = M.ai.cards[0]; await c.bwGainHex(k, c2, true); ok(k.hexes.length === 1 && M.ai.cards.length + M.ai.discard.length === n0 - 1, 'Lv1: only one Hex at a time (the other card returns to the AI discard pile)');
  c.bw.disabled.add(k.hexes[0].ops.hex.type.replace(/ Party Hex| Hex/g, '')); ok(!c.bwHexed(k, k.hexes[0].ops.hex.name), 'a disabled Hex type has no effect');
  const cm = mk(3, 2); const km = cm.knights[0]; await cm.bwGainHex(km, cm.monster.ai.cards[0], true); await cm.bwGainHex(km, cm.monster.ai.cards[0], true); ok(km.hexes.length === 2, 'Lv2 Misfortune’s Mistress: several Hexes'); }
{ const c = mk(4); const k = c.knights[0]; const mire = { ...BW.cards.ai.find(x => x.name === 'Broom Sweep') }; c.monster.ai.cards.push(mire); await c.bwGainHex(k, mire, true); const v0 = k.vigor; await c.bwTurnStart(k); ok(mire._tok === 2 && k.vigor === v0 - 2, 'Mire Sores: start of turn +1 token, lose that much Vigor');
  const mal = { ...BW.cards.ai.find(x => x.name === 'Anthropophagy') }; k.hexes = [mal]; ok(c.bwHexed(k, 'Morass Malady'), 'Morass Malady Hex present'); k.heat = 2; k._noRefresh = true; k.refresh(); ok(k.heat === 2, 'Morass Malady: the Refresh step is skipped'); k._noRefresh = false; }
{ const c = mk(5); const M = c.monster, B = c.board; const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.bw.wisp = P(c, 'G12'); c.moveKnight(k, P(c, 'G7')); await c.bwStray(k, 3); ok(L(c, k.pos) === 'G10', `Stray 3: toward the Mud Wisp (${L(c, k.pos)})`); ok(c.bwInWisper(k.pos) && c.reachable(k, 4).every(x => c.bwInWisper(x)), 'Wisper Zone: no voluntary movement out of Zone 2 of the Mud Wisp'); }
{ const c = mk(6); const M = c.monster; const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); const ws = c.bwWeakspots(); ok(ws.map(x => L(c, x)).sort().join() === 'D6,D9', `Weakspots: left and right of the front row (${ws.map(x => L(c, x)).join(',')})`);
  c.moveKnight(k, P(c, 'J1')); c.moveKnight(c.knights[1], P(c, 'E4')); c.moveKnight(c.knights[2], P(c, 'E3')); c.moveKnight(c.knights[3], P(c, 'F7')); const cz = c.bwCarrionTargets(); ok(cz.includes(k) && !cz.includes(c.knights[1]) && cz.includes(c.knights[2]) && cz.includes(c.knights[3]), 'Carrion Zone: everything outside the 8x4 rectangle around the Witch (E4 safe; E3, F7, J1 in the Zone)'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3, 4]) { if ((seed + lv) % 3) continue; const c = mk(seed * 23 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; const bad = c.log.filter(l => /미구현 targeting/.test(l.msg)); if (bad.length) { console.log('WARN', bad[0].msg); fails++; } } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 16, `simulations finished: ${done} (wins ${win})`); }
{ const c = mk(8, 3); ok(c.monster.bonuses.vigorLoss === 1, 'Lv3 Vigor bonus +1 (errata)'); const k = c.knights[0]; const sick = { ...BW.cards.ai.find(x => x.name === 'Ancestors’ Memories') }; k.hexes = [sick]; await c.fx.runKnightOp({ op: 'poison', n: 3 }, k, {}); ok(!!c.hasCondition(k, 'Toxified'), 'Slough Sickness: Poison Limit -1 (3 tokens → Toxified)');
  const k2 = c.knights[1]; await c.fx.runKnightOp({ op: 'poison', n: 3 }, k2, {}); ok(!!c.hasCondition(k2, 'Poisoned') && !c.hasCondition(k2, 'Toxified'), 'without the Hex 3 Poison tokens stay Poisoned');
  const g = BW.cards.ai.find(x => x.name === 'Child Eater').ops.gates[0]; ok(g.op === 'difficultyInstead' && g.stat === 'tier' && g.gte === 3 && g.n === 12, 'KING gate: Difficulty 12+ at King-level nodes');
  const k3 = c.knights[2]; k3.hexes = [{ ...BW.cards.ai.find(x => x.name === 'Child Eater') }]; const t = c.board.terrainAt({ c: k3.pos.c + 1, r: k3.pos.r }); ok(t && t.id === 'swamp', 'Burden of the Fen: spaces in Zone 1 count as Swamp'); }
{ const c = mk(9, 3); const k = c.knights[0], o = c.knights[1]; k.hexes = [{ ...BW.cards.ai.find(x => x.name === 'Vile Soup Spill') }];
  ok(c.bwHexed(k, 'Morass Residue') && !c.bwMayTarget(k, o) && c.bwMayTarget(k, k) && c.bwMayTarget(o, k), 'Morass Residue: no keywords/abilities that target other Knights');
  const an = BW.cards.ai.find(x => x.name === 'Anthropophagy').ops.gates[0]; ok(an.op === 'bwDoomed' && an.stat === 'vigor' && an.gte === 4, 'Anthropophagy gate: Vigor 4+ → Doomed');
  o.heatLimitBonus = 2; await c.bwOp({ op: 'bwHeatReset' }, { target: o }); ok(o.heatLimit === o.uninjuredHeatLimit, 'Mudcurse: Heat Limit reset to the Maximum Vigor threshold value'); }
// ── Rotten Stump Search (free action, once per Round per tile) and the Mud Wisp appearing right away
{ let f2 = 0; const ok2 = (c, m) => { if (!c) { f2++; console.log('FAIL', m); } else console.log('PASS', m); };
  const stump = (c, cells, tile) => { for (const l of cells) c.board.terrain.set(c.board.key(P(c, l)), { id: 'rotten stump', tile, obstacle: true, destructible: true }); };
  const setup = seed => { const c = mk(seed); for (const key of [...c.board.terrain.keys()]) if ((c.board.terrain.get(key) || {}).id === 'rotten stump') c.board.terrain.delete(key); stump(c, ['B2', 'B3', 'C2', 'C3'], 'a'); stump(c, ['B8', 'B9', 'C8', 'C9'], 'b'); return c; };
  { const c = setup(11); const k = c.knights[0]; c.moveKnight(k, P(c, 'D2')); ok2(c.stumpTiles().length === 2 && c.fx.freeActions(k).some(a => a.id.startsWith('search:')), 'Search is offered next to a Rotten Stump');
    c.moveKnight(k, P(c, 'F5')); ok2(!c.fx.freeActions(k).some(a => a.id.startsWith('search:')), 'not offered away from one'); c.moveKnight(k, P(c, 'D2'));
    c.d10For = async () => 2; c.ask = async q => q.type === 'number' ? 0 : q.options[0].value; await c.fx.doFreeAction(k, c.fx.freeActions(k).find(a => a.id.startsWith('search:')).id);
    ok2(c.hasCondition(k, 'Slimed') && L(c, k.pos) === 'D2', 'result 2: Slimed, not placed'); ok2(!c.fx.freeActions(k).some(a => a.id.startsWith('search:')), 'the same Rotten Stump: once per Round'); c.round++; ok2(c.fx.freeActions(k).some(a => a.id.startsWith('search:')), 'next Round: again'); }
  { const c = setup(12); const k = c.knights[0]; c.moveKnight(k, P(c, 'D2')); const h0 = k.heat; c.d10For = async () => 2; c.ask = async q => q.type === 'number' ? 2 : q.type === 'move' ? P(c, 'D8') : q.options[0].value; await c.stumpSearch(k, c.stumpSearchable(k)[0].id);
    ok2(k.heat === h0 + 2 && L(c, k.pos) === 'D8' && c.hasCondition(k, 'Slimed'), 'd10 2 + Heat 2 = 4: placed next to the other Rotten Stump, Slimed, Heat +2'); }
  { const c = setup(13); const k = c.knights[0]; c.moveKnight(k, P(c, 'D2')); c.board.remove(c.monster.cells); c.monster.cells = []; c.bw.off = true; c.d10For = async () => 7; let seen = []; c.ask = async q => { if (q.type === 'number') return 0; if (q.type === 'pick') { seen = q.options.map(o => o.value); return 'witch'; } return q.options[0].value; }; await c.stumpSearch(k, c.stumpSearchable(k)[0].id);
    ok2(seen.includes('witch') && !c.bw.off && c.monster.cells.length === 4 && !c.hasCondition(k, 'Slimed') && !c.board.terrainAt(P(c, 'B2')), 'result 7 with the Witch off the board: she may be placed on this Rotten Stump tile; no Slimed'); }
  { const c = setup(14); const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (10 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'F5')); c.bw.wisp = P(c, 'F7'); k.actions = { move: true, combat: true };
    const r = c.reachable(k, 4); ok2(r.some(x => L(c, x) === 'F7') && !r.some(x => L(c, x) === 'F8'), 'a move cannot pass through the Mud Wisp space in a straight corridor? (F8 not offered past F7 when only reachable through it or equally by going around: ' + r.some(x => L(c, x) === 'F8') + ')') ; }
  { const c = setup(15); const k = c.knights[0]; c.moveKnight(k, P(c, 'F5')); c.bw.wisp = P(c, 'F6'); c.moveKnight(k, P(c, 'F6')); ok2(!!c.bw.wispHit, 'stepping on the marker by any effect is noted'); await c.ask({ type: 'pick', text: 'next decision', options: [{ label: 'x', value: 1 }] }); ok2(!c.bw.wisp && !c.bw.wispHit && c.monster.cells.some(x => L(c, x) === 'F6'), 'the Bog Witch appears before the next decision (not at the end of the turn)'); }
  { const c = setup(16); c.destroyObstacle(P(c, 'B2')); ok2(!['B2', 'B3', 'C2', 'C3'].some(l => c.board.terrainAt(P(c, l))) && !!c.board.terrainAt(P(c, 'B8')), 'destroying one space of a Rotten Stump removes the whole 2x2 tile (the other tile stays)');
    c.board.terrain.set(c.board.key(P(c, 'C9')), { id: 'swamp' }); ok2(!c.board.terrainAt(P(c, 'B8')) && c.board.terrainAt(P(c, 'C9')).id === 'swamp', 'a tile placed over one of its spaces also removes the whole Rotten Stump'); }
  if (f2) { console.log(f2 + ' FAILED'); process.exit(1); } console.log('ALL PASS (search / wisp)'); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (bog witch)'); process.exit(fails ? 1 : 0);
