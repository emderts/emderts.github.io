// White Ape Troll Boss Clash: Firstmen Guardians, Coordinated Attack, Thick Skin / Regeneration, Reinforcements, Avenger, 2x2 movement types, simulations.
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
const WA = data.monsters['white-ape-troll'];
const mk = (seed, level = 1) => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'white-ape-troll', level, kingdom: 'sunken', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const L = (c, cell) => c.board.label(cell);
{ const all = [...WA.cards.ai, ...WA.cards.bp, WA.cards.signature, WA.cards.routine, WA.guardian.attack, WA.guardian.bp]; const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk(all.map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['evasionDice', 'difficultyInstead', 'knockdownOnHit', 'ignoreReact'].includes(o)); ok(WA.cards.ai.length === 18 && WA.cards.bp.length === 19 && unknown.length === 0, `18 AI + 19 BP (incl. Thick Skin), every op known ${unknown.join(',')}`); }
{ const c = mk(1); ok(c.monster.cells.map(x => L(c, x)).sort().join() === 'E6,E7,F6,F7' && c.monster.facing === 'E', 'setup: White Ape Troll on E6–F7 facing right');
  ok(c.guardians.length === 2 && c.guardians[0].hasBP && c.guardians.map(g => L(c, g.cells[0])).sort().join() === 'D6,G6', 'setup: 2 Firstmen Guardians (G6, D6), Trait BP with the leftmost');
  ok(c.monster.bp.cards[0].isThickSkin, 'setup: Thick Skin on top of the BP deck'); }
{ const c = mk(2); ok(c.trollToHit().bonus === 2, 'To Hit +1 per adjacent Guardian'); await c.spawnGuardian(); await c.spawnGuardian(); await c.spawnGuardian(); ok(c.guardians.length === 4, 'Guardians Limit 4 at Level 1'); await c.guardiansToTroll(); ok(c.trollToHit().fullMiss, '4+ adjacent Guardians → every Attack Roll is a Full Miss'); }
{ const c = mk(3); const g = c.guardians[1]; c.killGuardian(c.guardians[0]); ok(c.guardians[0].hasBP && c.monster.wounds === 0, 'killing a Guardian: no Wound, Trait BP passes on'); }
{ const c = mk(4); c.monster.bp.cards = c.monster.bp.cards.filter(x => !x.isThickSkin); c.thickSkinAside = true; await c.trollStartMR(); ok(c.monster.bp.cards[0].isThickSkin, 'Regeneration: Thick Skin back on top at the Start of the Monster Round'); }
{ const c = mk(5); c.onTrollWound(2); c.onTrollWound(2); const n = c.guardians.length; await c.trollAfterAction(); ok(c.gTokens === 0 && c.guardians.length === n + 1, 'Reinforcements Have Arrived: 4 tokens → Guardian Spawn + Coordinated Attack'); }
{ const c = mk(6, 2); for (let i = 0; i < 5; i++) { c.avTokens++; } let ai = 0; const a0 = c.activationAI.bind(c); c.activationAI = async () => { ai++; }; await c.trollAfterAction(); ok(ai === 1 && c.avTokens === 0, 'Avenger of the Tribe (L2): 5 tokens → resolve the top AI card'); }
{ const c = mk(7); const fp = c.bossDiagramCells(WA.cards.ai.find(x => x.name === 'Fierce Swing').ops.zoneDiagram); ok(fp.map(x => L(c, x)).sort().join() === 'D8,E8,E9,F8,F9,G8', `Fierce Swing diagram facing right from E6–F7: ${fp.map(x => L(c, x)).sort().join()}`); }
{ const c = mk(8); await c.bossTreeClimb(); ok(c.tileCells('great mangrove').filter(t => c.monster.cells.some(x => x.c === t.c && x.r === t.r)).length === 4, `Tree Climb: base fully on a Great Mangrove (${c.monster.cells.map(x => L(c, x)).join('/')})`); }
{ const c = mk(9); const k = c.knights[0]; c.moveKnight(k, c.board.parse('B11')); await c.bossJump(k); ok(c.monster.cells.some(x => c.board.adjacent(x, k.pos)), 'Jump: Troll lands adjacent to the Target'); }
{ let wins = 0, losses = 0; const N = 10;
  for (let s = 1; s <= N; s++) { const c = mk(1000 + s); const r = await c.run(); if (r === 'win') wins++; else losses++; const bad = c.log.filter(l => /미구현/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded White Ape Troll Clashes finished: ${wins} win / ${losses} lose`);
  for (const lv of [2, 3, 4]) { const c = mk(1100 + lv, lv); const r = await c.run(); ok(['win', 'lose'].includes(r) && !c.log.some(l => /미구현/.test(l.msg)), `level ${lv} simulation finished (${r}, ${c.round} rounds)`); } }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
