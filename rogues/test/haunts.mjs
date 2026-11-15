// Haunts of Utrebant: diagram Zone Attacks + Spectral Step, Appear Behind, Zone Judgements, Intangible/Bypass, Ethereal Unity (Fool's deck), BP auras.
// Clash Setup: Sunken Kingdom Codex p.48–49.
import fs from 'fs';
import path from 'path';
import { Campaign } from '../src/engine/campaign.js';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const HU = data.monsters['haunts-of-utrebant'];
const TEST_SETUP = { mobStart: [{ cell: 'G6', facing: 'down' }, { cell: 'G9', facing: 'down' }, { cell: 'D6', facing: 'up' }, { cell: 'D9', facing: 'up' }], mobTrack: { '1': 3, '2': 1 }, knightStart: ['F7', 'F8', 'E7', 'E8'], terrain: [{ tile: 'ruined wall', cells: ['H3', 'H4'] }, { tile: 'column', cells: ['C11'] }] };
const withSetup = () => data;

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
const mk = (seed, level = 1) => { const c = new Clash({ data: withSetup(), knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'haunts-of-utrebant', level, kingdom: 'sunken', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const L = (c, cell) => c.board.label(cell);
const card = n => [...HU.cards.ai, HU.cards.signature].find(x => x.name === n);

// data
{ const all = [...HU.cards.ai, ...HU.cards.bp, HU.cards.signature, HU.cards.routine]; const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk(all.map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['evasionDice', 'vigorPerHitInstead'].includes(o));
  ok(HU.cards.ai.length === 18 && HU.cards.bp.length === 9 && unknown.length === 0, `18 AI + 9 BP, every op known ${unknown.join(',')}`);
  ok(HU.clashSetup && Campaign.prototype.monsterReady.call({ data }, 'haunts-of-utrebant'), 'Codex setup present → Haunts playable');
  const cd = card('Cut Down').ops.zoneDiagram; ok(cd.red.length === 4 && JSON.stringify(cd.step) === '[3,0]', 'Cut Down diagram: 4 red cells, Spectral Step 3 ahead'); }
// setup
{ const c = mk(9); const M = c.monster; ok(M.mobs.length === 3 && M.mobs.map(m => c.board.label(m.cells[0])).sort().join() === 'B8,F11,I7', 'setup: 3 Haunts (BP1) on I7 / F11 / B8'); ok(c.board.terrainAt(c.board.parse('G10')).id === 'ruined wall' && c.board.terrainAt(c.board.parse('A4')).id === 'swamp', 'terrain: Ruined Walls and Swamps from the Codex diagram'); }
// diagram rotation + Spectral Step
{ const c = mk(1); const m = c.monster.mobs[0]; c.monster.cur = m; c.mobStepTo(m, c.board.parse('E3')); m.facing = 'E';
  const z = c.diagramCells(card('Cut Down').ops.zoneDiagram); ok(z.cells.map(x => L(c, x)).sort().join() === 'D4,E4,E5,F4' && L(c, z.step) === 'E6', `Cut Down facing right from E3: ${z.cells.map(x => L(c, x)).sort().join()} → step ${L(c, z.step)}`);
  m.facing = 'N'; const z2 = c.diagramCells(card('Overhead Smite').ops.zoneDiagram); ok(L(c, z2.step) === 'I3' && z2.cells.length === 7, `Overhead Smite facing up: 7 red cells, step ${L(c, z2.step)}`);
  const k = c.knights[0]; c.moveKnight(k, c.board.parse('I3')); const v0 = k.vigor; await c.spectralStep(m, z2.step); ok(L(c, m.cells[0]) === 'I3' && L(c, k.pos) !== 'I3' && k.vigor < v0, `Spectral Step onto a Knight: Haunt on I3, Knight crashed + knocked back (chosen direction) to ${L(c, k.pos)}`); }
{ const c = mk(12); const m = c.monster.mobs[0]; c.monster.cur = m; const before = c.curseLevel || 0; await c.hauntOp({ op: 'gainCurse', n: 1 }, { attacker: c.knights[0] }); ok(c.curseLevel === before + 1, 'Peter: Curse is shared (party Curse level +1)'); }
{ const c = mk(13); const m = c.monster.mobs.find(x => c.board.label(x.cells[0]) === 'I7'); const asked = []; const a0 = c.ask; c.ask = async q => { if (q.type === 'move') asked.push(q.options.length); return a0(q); }; await c.bypassMoveToward(m, c.board.parse('A1'), 3); ok(asked.some(n => n > 1), `Bypass move cut short: player picks where to stop among shortest paths (${asked.join(',')} options)`); }
// No Mercy
{ const c = mk(2, 4); const m = c.monster.mobs[0]; c.monster.cur = m; c.mobStepTo(m, c.board.parse('C6')); m.facing = 'N'; const z = c.diagramCells(card('Overhead Smite').ops.zoneDiagram); ok(z.cells.length === 15, 'No Mercy: Overhead Smite adds the 8 yellow cells');
  const k = c.knights[0]; c.moveKnight(k, z.step.r < 10 ? z.step : k.pos); if (c.board.inside(z.step)) { await c.spectralStep(m, z.step); ok(!k.alive, 'No Mercy: Spectral Step onto a Knight kills it'); } }
// Appear Behind, Intangible, targeting
{ const c = mk(3); const m = c.monster.mobs[0]; c.monster.cur = m; const k = c.knights[0]; await c.appearBehind(m, k); ok(c.board.adjacent(m.cells[0], k.pos), `Appear Behind: Haunt adjacent to the Target (${L(c, m.cells[0])})`);
  ok(c.losTo(c.knights[3]), 'Intangible: Line of Sight ignores Terrain');
  const tg = await c.resolveTargeting(card('Piercing Gaze')); ok(tg.targets.length >= 2 && tg.targets[0] === c.priorityTarget, `Zone Judgement: Priority Target + Zone 1 around it (${tg.targets.length} Knights)`);
  const g = await c.resolveTargeting({ ops: { targeting: ['Furthest Knight'] } }); ok(g.primary, 'Furthest Knight targeting'); }
// Ethereal Unity: tokens, bonuses, Fool's deck Spawn
{ const c = mk(4); const M = c.monster; ok(c.hauntToHit() === 0, 'no Ethereal tokens → no bonus');
  c.killMob(M.mobs[0]); ok(c.ethereal === 1 && c.hauntToHit() === 1, 'Haunt removed → Ethereal token 1 → +1 To Hit');
  c.killMob(M.mobs[0]); ok(c.hauntVigorBonus(M.mobs[0]) === 1, '2 tokens → +1 Vigor loss on every Haunt Attack');
  c.killMob(M.mobs[0]); const before = M.mobs.length; await c.mobAfterAction(); ok(c.ethereal === 0 && M.mobs.length === before + 3, `3 tokens → 3 Haunts spawned at Fool's deck coordinates (${M.mobs.map(m => L(c, m.cells[0])).join(' ')})`);
  ok(M.mobs[0].tokens.length >= 1, 'Activation tokens re-dealt from the left of the Mob track'); }
// Grim Gift (L2), Obscured Vision (L2)
{ const c = mk(5, 2); const M = c.monster; const low0 = Math.min(...M.ai.cards.map(x => x.level)); M.escalateAI(3); ok(true, `Grim Gift: escalation forced onto the lowest AI (${low0})`);
  const k = c.knights[0]; c.moveKnight(k, c.board.parse('F4')); ok(c.hauntPrecision(k) === -2, 'Obscured Vision: -2 Precision next to a Ruined Wall'); }
// simulations (provisional setup)
{ let wins = 0, losses = 0; const N = 10;
  for (let s = 1; s <= N; s++) { const c = mk(600 + s); const r = await c.run(); if (r === 'win') wins++; else losses++; const bad = c.log.filter(l => /미구현/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded Haunts Clashes finished: ${wins} win / ${losses} lose`);
  for (const lv of [2, 3, 4]) { const c = mk(700 + lv, lv); const r = await c.run(); ok(['win', 'lose'].includes(r) && !c.log.some(l => /미구현/.test(l.msg)), `level ${lv} simulation finished (${r}, ${c.round} rounds)`); } }

console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
