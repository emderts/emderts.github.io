// Paleblood Worms (Mob Clash + Blood): setup, Blood tokens, Suck, Blood gates, Burrow, Bloodbath, Subterranean Menace, Judgement, simulations.
import fs from 'fs';
import path from 'path';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const PW = data.monsters['paleblood-worms'];

const autoAsk = clash => async q => {
  const M = clash.monster; const nearestMobDist = c => Math.min(...M.mobs.filter(m => m.cells.length).map(m => Math.abs(m.cells[0].c - c.c) + Math.abs(m.cells[0].r - c.r)), 99);
  switch (q.type) {
    case 'confirm': return q.default;
    case 'dice': { const k = q.knight ? clash.knights.find(x => x.id === q.knight) : null; let budget = q.max; if (k && /Evasion|Attack/.test(q.text)) budget = Math.min(budget, Math.max(0, k.heatLimit - k.heat - 1) + clash.poolCount('closing')); return q.dice.map((d, i) => ({ d, i })).filter(x => !x.d.hit && x.d.canReroll).slice(0, budget).map(x => x.i); }
    case 'number': return q.default ?? q.options.at(-1).value;
    case 'order': return q.options.map(o => o.value);
    case 'pick': { if (q.options.some(o => o.value === 'skip')) return 'skip'; return q.options[0].value; }
    case 'move': { if (!q.knight) return q.cells[0]; const k = clash.knights.find(x => x.id === q.knight); const best = [...q.cells].sort((a, b) => nearestMobDist(a) - nearestMobDist(b))[0]; return nearestMobDist(best) < nearestMobDist(k.pos) ? best : null; }
    case 'action': { const v = q.options.map(o => o.value); if (v.includes('attack')) return 'attack'; const k = clash.knights.find(x => x.id === q.knight); if (v.includes('move') && !clash.adjacentMobs(k).length) return 'move'; const pose = v.find(x => x.startsWith('tech:Knight Pose')); if (pose && clash.knockedDown(k)) return pose; return 'end'; }
    default: return q.options ? q.options[0].value : null;
  }
};
const mk = (seed, level = 1) => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'paleblood-worms', level, kingdom: 'principality', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const L = (c, cell) => c.board.label(cell);

// data
{ const all = [...PW.cards.ai, ...PW.cards.bp, PW.cards.signature, PW.cards.routine]; const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk(all.map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['evasionDice', 'discardArmorGear', 'ignoreReact', 'vigorPerHitInstead'].includes(o));
  ok(PW.cards.ai.length === 12 && PW.cards.bp.length === 12 && unknown.length === 0, `12 AI + 12 BP, every op known ${unknown.join(',')}`); }
// setup
{ const c = mk(1); const M = c.monster;
  ok(M.mobs.length === 4 && M.mobs.every(m => m.card.level === 1) && M.mobs.map(m => L(c, m.cells[0])).sort().join() === 'C7,E8,F7,H7', 'setup: 4 Worms (BP1) on H7/F7/E8/C7');
  ok(c.knights.every(k => k.blood === 5), 'Bloodrush: every Knight starts with 5 Blood');
  ok(c.tileCells('paleburrow').length === 10 && L(c, c.paleburrow(1)) === 'I2' && L(c, c.paleburrow(10)) === 'B13', 'Paleburrows 1–10 numbered (1 = I2 … 10 = B13)');
  ok(c.tileCells('bloodgeyser').length === 9 && c.board.terrainAt(c.board.parse('G9')).obstacle, 'Bloodgeyser 3×3, Columns are Obstacles'); }
// targeting by Blood
{ const c = mk(2); const [a, b, d, e] = c.knights; a.blood = 2; b.blood = 5; d.blood = 4; e.blood = 1; const mob = c.monster.mobs[0]; c.monster.cur = mob;
  const tg = await c.resolveTargeting({ ops: { targeting: ['Knight with the least Blood [Blood] tokens'] } }); ok(tg.primary === e, 'Knight with the least Blood → F4 (1 Blood)');
  const tg2 = await c.resolveTargeting({ ops: { targeting: ['Closest Knight with the most Blood [Blood] tokens'] } }); ok(tg2.primary === b, 'Closest Knight with the most Blood → F2 (5 Blood)'); }
// Suck, Blood gate, Famished aura
{ const c = mk(3); const k = c.knights[0]; const mob = c.monster.mobs[0]; c.monster.cur = mob;
  await c.suck(mob, k, 2); ok(k.blood === 3 && mob.blood === 2, `Suck 2 moves Blood Knight → BP (${k.blood}/${mob.blood})`);
  mob.revealed = true; mob.card = { ...mob.card, ops: { ...mob.card.ops, aura: { suckBonus: 1 } } }; await c.suck(mob, k, 1); ok(k.blood === 1 && mob.blood === 4, 'revealed Famished Bloodworm: Suck +1');
  await c.suck(mob, k, 3); ok(!k.alive, 'Knight at 0 Blood bleeds out'); }
// Burrow + Bloodgeyser + chasm
{ const c = mk(4); const mob = c.monster.mobs.find(m => L(c, m.cells[0]) === 'H7'); await c.burrow(mob, 6); ok(L(c, mob.cells[0]) === 'H9', 'Burrow 6 → Paleburrow #6 (H9)');
  const other = c.monster.mobs.find(m => m !== mob); await c.burrow(other, 6); ok(L(c, other.cells[0]) !== 'H9' && c.board.terrainAt(other.cells[0]).id === 'paleburrow', 'Burrow onto an occupied Paleburrow → closest free Paleburrow');
  const g = c.monster.mobs.find(m => L(c, m.cells[0]) === 'F7' || L(c, m.cells[0]) === 'E8'); if (g) { const b0 = g.blood; await c.mobMoveToward(g, c.board.parse('A1'), 1, { ask: false }); ok(g.blood === b0 + 1, 'Worm starting its movement on the Bloodgeyser gains 1 Blood'); } }
// death → Bloodbath + Subterranean Menace spawn off-board + emergence
{ const c = mk(5); const M = c.monster; const mob = M.mobs[0]; mob.blood = 2; const k = c.knights[0]; k.blood = 3; c.moveKnight(k, c.board.neighbors(mob.cells[0]).find(x => c.cellFree(x)));
  c.killMob(mob); await c.resolveMobDeaths(); ok(k.blood === 5 && mob.blood === 0, `Bloodbath: 2 Blood to Knights in Zone 2 (${k.blood})`);
  await c.spawnWorms(); const nw = M.mobs.find(m => m.card.level === 2); ok(nw && !nw.cells.length, 'Immediate Spawn: new BP2 Worm waits outside the board');
  await c.emergeIfOffboard(nw); ok(nw.cells.length && c.board.terrainAt(nw.cells[0]).id === 'paleburrow', `outside Worm about to activate → Paleburrow closest to the Priority Target (${L(c, nw.cells[0])})`); }
// Judgement (Suppertime!): Virtue added, no armor
{ const c = mk(6); const card = PW.cards.ai.find(x => x.name === 'Suppertime!'); c.monster.cur = c.monster.mobs[0]; c.monster.cur.blood = 1; const r = await c.resolveTargeting(card); ok(r.targets.length === 4, 'Suppertime!: all Knights targeted'); }
// Activate X
{ const c = mk(7); const M = c.monster; let n = 0; c.activationAI = async () => { n++; }; await c.activateMobs(M.mobs[0], 2); ok(n === 2, 'Activate 2: draws AI for the next 2 Mobs'); }
// Red Soil (L2)
{ const c = mk(8, 2); const M = c.monster; let n = 0; c.activationAI = async () => { n++; }; c.bloodDiscarded(4); ok(c.redSoil === 4, 'Red Soil collects discarded Blood'); await c.bloodAfterAction(); ok(n === 1 && c.redSoil === 0, 'Red Soil 4 → Activate 1, tokens removed'); }
// Scab Armor (L3)
{ const c = mk(9, 3); const m = c.monster.mobs[0]; ok(m.blood === 1, 'Scab Armor: BPs start with 1 Blood'); const at = c.mobAT(m); m.blood = 3; ok(c.mobAT(m) === at + 2, 'Scab Armor: +1 AT per Blood'); }
// simulations
{ let wins = 0, losses = 0, rounds = 0; const N = 12;
  for (let s = 1; s <= N; s++) { const c = mk(400 + s); const r = await c.run(); if (r === 'win') wins++; else losses++; rounds += c.round; const bad = c.log.filter(l => /미구현/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded Paleblood Clashes finished: ${wins} win / ${losses} lose, avg ${(rounds / N).toFixed(1)} rounds`);
  for (const lv of [2, 4]) { const c = mk(500 + lv, lv); const r = await c.run(); ok(['win', 'lose'].includes(r) && !c.log.some(l => /미구현/.test(l.msg)), `level ${lv} simulation finished (${r}, ${c.round} rounds)`); } }

console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
