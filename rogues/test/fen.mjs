// Knight of the Fen: Boss + Doppelknights — Spawn / BP stacks, Doppelganger, Spread Thin, Ooze Trap, Engulfed + Sabotage, Dwell, We Are Many, simulations.
import fs from 'fs';
import path from 'path';
import { Campaign } from '../src/engine/campaign.js';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const autoAsk = clash => async q => {
  const M = clash.monster; const nearestMobDist = c => Math.min(...M.cells.map(m => Math.abs(m.c - c.c) + Math.abs(m.r - c.r)), 99);
  switch (q.type) {
    case 'confirm': return q.default;
    case 'dice': { const k = q.knight ? clash.knights.find(x => x.id === q.knight) : null; let budget = q.max; if (k && /Evasion|Attack/.test(q.text)) budget = Math.min(budget, Math.max(0, k.heatLimit - k.heat - 1) + clash.poolCount('closing')); return q.dice.map((d, i) => ({ d, i })).filter(x => !x.d.hit && x.d.canReroll).slice(0, budget).map(x => x.i); }
    case 'number': return q.default ?? q.options.at(-1).value;
    case 'order': return q.options.map(o => o.value);
    case 'pick': { if (q.options.some(o => o.value === 'skip')) return 'skip'; return q.options[0].value; }
    case 'move': { if (!q.knight) return q.cells[0]; const k = clash.knights.find(x => x.id === q.knight); const best = [...q.cells].sort((a, b) => nearestMobDist(a) - nearestMobDist(b))[0]; return nearestMobDist(best) < nearestMobDist(k.pos) ? best : null; }
    case 'action': { const v = q.options.map(o => o.value); if (v.includes('attack')) return 'attack'; const k = clash.knights.find(x => x.id === q.knight); if (v.includes('move') && !clash.adjacentToMonster(k)) return 'move'; const pose = v.find(x => x.startsWith('tech:Knight Pose')); if (pose && clash.knockedDown(k)) return pose; return 'end'; }
    default: return q.options ? q.options[0].value : null;
  }
};
const KF = data.monsters['knight-of-the-fen'];
const mk = async (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'knight-of-the-fen', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); await c.fenStart(); return c; };
const L = (c, cell) => c.board.label(cell); const P = (c, l) => c.board.parse(l);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...KF.cards.ai, ...KF.cards.bp, KF.cards.signature, KF.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['evasionDice', 'difficultyInstead', 'ignoreReact', 'ifHits', 'vigorByHitsTable'].includes(o)); ok(KF.cards.ai.length === 18 && KF.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = await mk(1); ok(c.monster.cells.map(x => L(c, x)).sort().join() === 'E11,E12,F11,F12' && c.monster.facing === 'W', 'setup: Knight of the Fen on E11–F12 facing left');
  ok(c.guardians.length === 1 && c.guardians[0].isDopp && c.guardians[0].cards.length === 1 && c.board.terrainAt(c.guardians[0].cells[0]).id === 'swamp', `Start of Clash: 1 Doppelknight on the closest Swamp (${L(c, c.guardians[0].cells[0])}) with a face-down BP`);
  ok(c.monster.bp.cards.length === 5 && c.monster.hasTrait('Quick Summons') && c.knights.some(k => c.hasCondition(k, 'Exposed')), 'BP taken from the top of the BP deck; Quick Summons (Sunken): closest Knight Exposed');
  const bp = c.monster.bp.cards[0]; ok(c.bpAT(bp) === Math.max(1, bp.at - 1), 'Spread Thin: each Doppelknight lowers the AT by 1'); }
{ const c = await mk(2, 4); ok(c.guardians.length === 2 && !c.monster.hasTrait('Spread Thin') && c.guardians[0].cards.length === 2, 'Level 4: We Are Legion (2 Doppelknights, Spread Thin disabled), Concentrated Strength (2 BP each)'); }
{ const c = await mk(3); const g = c.guardians[0]; const A = { guardian: g, critical: false }; const w0 = c.monster.wounds; const cell = g.cells[0]; const d = await c.doppWound(A); ok(d >= 1 && c.monster.wounds === w0 + d && !c.guardians.length && c.board.terrainAt(cell).id === 'swamp', 'wounding a Doppelknight: BP → Wound Stack, token removed, Swamp on its space'); }
{ const c = await mk(4); const k = c.knights[0]; await c.fenEngulf(k); ok(k.engulfed && c.hasCondition(k, 'Slimed') && !c.knightAt(k.pos), 'Engulfed: off the board + Slimed'); ok(!(await c.resolveTargeting({ ops: { targeting: ['Closest Knight'] } })).targets.includes(k) || c.alive().length === 1, 'Engulfed Knights are not targeted'); await c.fenFree(k, 'test'); ok(!k.engulfed && c.monster.cells.some(m => c.board.adjacent(m, k.pos)), `freed → Displaced next to the Monster (${L(c, k.pos)})`); }
{ const c = await mk(5); await c.fenDwell(); ok(c.monster.cells.some(m => { const t = c.board.terrainAt(m); return t && t.id === 'swamp'; }), `Dwell: base covers a Swamp space (${c.monster.cells.map(x => L(c, x)).join('/')})`); }
{ const c = await mk(6); const k = c.knights[0]; c.moveKnight(k, P(c, 'E9')); const card = KF.cards.ai.find(x => x.name === 'Slimy Stab'); const g = c.guardians[0]; const okk = await c.fenDoppAttack(g, card); ok(okk && c.log.some(l => /Doppelganger —/.test(l.msg)) && c.fenKnights().some(x => c.board.adjacent(g.cells[0], x.pos)), `Doppelganger: the Doppelknight moves to and attacks the closest Knight (${L(c, g.cells[0])})`); }
{ const c = await mk(7); c.wamTokens = 4; const n = c.guardians.length; let sig = 0; const p0 = c.performSignature.bind(c); c.performSignature = async o => { sig++; }; await c.fenAfterAction(); ok(c.guardians.length === n + 1 && sig === 1 && c.wamTokens === 0, 'We Are Many: 4 tokens → Spawn + Signature'); }
{ const c = await mk(8); const M = c.monster; M.bp.cards = []; M.bp.discard = []; let lost = false; try { c.fenCheckBP(); } catch (e) { lost = c.result === 'lose'; } ok(lost, 'no cards in the BP deck and discard pile → the Clash is lost'); }
{ const c = await mk(9, 2); const k = c.knights[0]; const v0 = k.vigor; await c.fenOoze(k, 'boss'); ok(c.hasCondition(k, 'Slimed') && k.vigor === v0 - 2, 'Ooze Trap (Level 2): moved through → Slimed and -2 Vigor (no Crash)'); }
{ const c = await mk(12, 3); const g = c.guardians[0]; ok(g.cards.length === 2 && c.doppAT(g) === g.cards.reduce((a, x) => a + c.monster.atOf(x), 0), 'Concentrated Strength (L3): Doppelknight carries 2 BPs, AT = summed AT'); }
{ let wins = 0, losses = 0; const N = 10;
  for (let s = 1; s <= N; s++) { const c = await mk(3000 + s); const r = await c.run(); if (r === 'win') wins++; else losses++; const bad = c.log.filter(l => /미구현/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded Knight of the Fen Clashes finished: ${wins} win / ${losses} lose`);
  for (const lv of [2, 3, 4]) for (const sd of [1, 2]) { const c = await mk(3100 + lv * 10 + sd, lv, sd === 1 ? 'sunken' : 'principality'); const r = await c.run(); ok(['win', 'lose'].includes(r) && !c.log.some(l => /미구현/.test(l.msg)), `level ${lv} simulation finished (${r}, ${c.round} rounds)`); } }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
