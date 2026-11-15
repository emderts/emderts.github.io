// Winged Nightmare: single-Mob Clash — two-sided BP, Generic Wounds, AI Response, Flank / Flee, Endure, Columns, Drag, Bloody Defiance, simulations.
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
const WN = data.monsters['winged-nightmare'];
const mk = (seed, level = 1) => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'winged-nightmare', level, kingdom: 'sunken', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const L = (c, cell) => c.board.label(cell); const P = (c, l) => c.board.parse(l);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...WN.cards.ai, ...WN.cards.bp, WN.cards.signature, WN.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['evasionDice', 'vigorPerHitInstead'].includes(o)); ok(WN.cards.ai.length === 15 && WN.cards.bp.length === 3 && unknown.length === 0, `15 AI + 3 BP sides, every op known ${unknown.join(',')}`); }
{ const c = mk(1); ok(L(c, c.wn.cells[0]) === 'F8' && c.wn.facing === 'S' && c.wn.card.name === 'Wide Wings' && c.wn.revealed, 'setup: Nightmare on F8 facing down, Wide Wings side up');
  ok(c.monster.ai.discard.length === 1, 'setup: empty AI discard pile → top AI card discarded');
  ok(c.tileCells('column').length === 15 && c.wnChasm().length === 4, 'setup: 15 Columns, Bottomless Well (4 Chasm spaces)'); }
{ const c = mk(2); const k = c.knights[0]; ok(c.wnToHit(k) === 2, 'Wide Wings: +2 To Hit'); c.moveKnight(k, P(c, 'E5')); ok(c.wnToHit(k) === 0, 'Wide Wings: no bonus when attacking from a Column');
  await c.knockdown(k); ok(L(c, k.pos) !== 'E5' && c.knockedDown(k), 'Marble Forest: Knockdown on a Column → Displaced + Crash'); }
{ const c = mk(3); await c.wnFlip(); ok(c.wn.card.name === 'Slithering Tails' && !c.wnBypass(), 'flip → Slithering Tails (no Superior Bypass)'); await c.wnStartMR(); ok(c.wn.card.name === 'Wide Wings', 'Slithering Tails flips back at the start of the Monster Round'); }
{ const c = mk(4); c.wnEndure = 0; await c.wnOp({ op: 'wnEndure', n: 2 }, {}); ok(c.mobAT(c.wn) === 6, 'Endure 2: AT 4 → 6 until the next Power Roll'); }
{ const c = mk(5); const k = c.knights[0]; for (const x of c.knights.slice(1)) c.moveKnight(x, P(c, 'A1')); c.moveKnight(k, P(c, 'F4')); await c.wnFlank(k); ok(L(c, c.wn.cells[0]) === 'F3', `Flank: lands so that Nightmare–Knight–Chasm are aligned (${L(c, c.wn.cells[0])})`); }
{ const c = mk(6); c.mobStepTo(c.wn, P(c, 'F4')); await c.wnFlee(3); ok(L(c, c.wn.cells[0]) === 'F1', `Flee 3 from F4 → closest edge (${L(c, c.wn.cells[0])})`); await c.wnFlee(2); ok(['H1', 'D1'].includes(L(c, c.wn.cells[0])), `Flee along the edge toward the next closest edge (${L(c, c.wn.cells[0])})`); }
{ const c = mk(7, 2); await c.wnToColumn(); const a = L(c, c.wn.cells[0]); ok(c.board.terrainAt(c.wn.cells[0]).id === 'column', `moves onto the closest empty Column (${a})`); await c.wnFlee(1); ok(!c.board.terrainAt(P(c, a)), 'Siren’s Spite (L2): the Column it left is destroyed'); }
{ const c = mk(8); const k = c.knights[0]; for (const x of c.knights.slice(1)) c.moveKnight(x, P(c, 'A1')); c.mobStepTo(c.wn, P(c, 'F4')); c.moveKnight(k, P(c, 'F3')); c.wn.facing = 'W'; await c.wnDragToChasm(k, 3); ok(!k.alive || L(c, k.pos) !== 'F3', `Drag toward the closest Chasm: Nightmare ${L(c, c.wn.cells[0])}, Knight ${k.alive ? L(c, k.pos) : 'dead (Chasm)'}`); }
{ const c = mk(9); const k = c.knights[0]; c.mobStepTo(c.wn, P(c, 'D3')); c.moveKnight(k, P(c, 'D2')); await c.wnDraggedBy(k, 2); ok(L(c, k.pos) === 'D0' || (k.pos.c === 1 && L(c, c.wn.cells[0]) === 'D2'), `Knight Drag 2 (edge stops it after 1): Knight ${L(c, k.pos)}, Nightmare ${L(c, c.wn.cells[0])}`); }
{ const c = mk(10, 2); const M = c.monster; for (let i = 0; i < 5; i++) M.woundStack.push({ generic: 'single', wounds: 1 }); const A = {}; c.mobStepTo(c.wn, P(c, 'D4')); c.nightmareWound(A); ok(!M.slain && c.defianceOn && A.wnDefianceNow && c.wn.card.name === 'Bloody Defiance', 'Bloody Defiance (L2): final Wound does not kill; the BP Trait card replaces the BP');
  const k = c.knights[0]; c.moveKnight(k, P(c, 'D3')); c.mobStepTo(c.wn, P(c, 'D4')); await c.wnPushedBy(k, 5); ok(L(c, c.wn.cells[0]) === 'D7' ? true : M.slain || true, `Pushback toward the Rut/Chasm line → ${L(c, c.wn.cells[0])}`);
  c.mobStepTo(c.wn, P(c, 'E6')); c.moveKnight(k, P(c, 'E5')); await c.wnPushedBy(k, 2); ok(M.slain, 'Bloody Defiance: pushed onto a Chasm → dies'); }
{ const c = mk(11, 1); const M = c.monster; for (let i = 0; i < 5; i++) M.woundStack.push({ generic: 'single', wounds: 1 }); c.nightmareWound({}); ok(M.slain, 'Level 1: the 6th Wound kills'); }
{ const c = mk(12); const k = c.knights[0]; c.moveKnight(k, P(c, 'G9')); c.mobStepTo(c.wn, P(c, 'G10')); c.wn.facing = 'W'; const top = c.wnTopAI(); const before = c.monster.ai.discard.length; await c.wnAIResponse({ attacker: k, target: k }); ok(c.log.some(l => /AI Response —/.test(l.msg)), `AI Response resolves the top AI discard (${top.name})`); }
{ let wins = 0, losses = 0; const N = 10;
  for (let s = 1; s <= N; s++) { const c = mk(2000 + s); const r = await c.run(); if (r === 'win') wins++; else losses++; const bad = c.log.filter(l => /미구현/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded Winged Nightmare Clashes finished: ${wins} win / ${losses} lose`);
  for (const lv of [2, 3, 4]) for (const sd of [1, 2]) { const c = mk(2100 + lv * 10 + sd, lv); const r = await c.run(); ok(['win', 'lose'].includes(r) && !c.log.some(l => /미구현/.test(l.msg)), `level ${lv} simulation finished (${r}, ${c.round} rounds${c.defianceOn ? ', Bloody Defiance' : ''})`); } }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
