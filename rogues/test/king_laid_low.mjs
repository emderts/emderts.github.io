// The King Laid Low: data, Drill / Ditch Digger, Malediction, Shallow Grave, VP, Putrid Penance, Shrug It Off, simulations.
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
const KL = data.monsters['king-laid-low'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'king-laid-low', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
const MD = 'Malediction (Dormant)', MM = 'Malediction (Manifested)';
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op && !('stat' in x)) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...KL.cards.ai, ...KL.cards.bp, KL.cards.signature, KL.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o)); ok(KL.cards.ai.length === 18 && KL.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.map(x => L(c, x)).sort().join() === 'E7,E8,F7,F8' && c.knights.filter(k => c.hasCondition(k, MD)).length === 1 && c.board.terrainAt(P(c, 'G4')).id === 'rut', 'setup: King on E7/E8/F7/F8, one Knight has Malediction (Dormant), Rut tiles placed'); }
{ const c = mk(2); const M = c.monster; const k = c.knights[0]; M.facing = 'E'; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'F11')); const p0 = { ...k.pos }; await c.klDrill(k, 4);
  ok(M.cells.some(x => x.c >= 10) && !(k.pos.c === p0.c && k.pos.r === p0.r) && k.alive, `Drill 4: King drills through the Target, who suffers Unavoidable Knockback (King ${M.cells.map(x => L(c, x)).join('/')}, Knight ${L(c, k.pos)})`);
  const ruts = [...c.board.terrain.values()].filter(t => t.id === 'rut' && t.tile > 100).length; ok(ruts === 2, 'Ditch Digger: a 1x2 Rut behind the King after the Drill'); }
{ const c = mk(3); const k = c.knights[0]; for (const x of c.knights) for (const id of [MD, MM]) { const i = x.conditions.findIndex(q => q.id === id); if (i >= 0) x.conditions.splice(i, 1); } k.conditions.push({ id: MD, tokens: 0 }); c.klTurnStart(k); ok(c.hasCondition(k, MM) && !c.canAttack(k), 'Malediction flips to Manifested at the start of the turn: cannot attack'); c.klTurnStart(k); ok(c.hasCondition(k, MD), 'and back to Dormant on the next turn');
  await c.die(k, 'test'); ok(c.alive().filter(x => c.hasCondition(x, MD)).length === 1, 'Heavy Is the Crown: when the holder dies the card passes to another Knight (Dormant)'); }
{ const c = mk(4, 2); const k = c.knights[0]; c.moveKnight(k, P(c, 'G6')); await c.pushback(k, 1, { dir: { c: -1, r: 0 } }); ok(!k.alive && c.board.terrainAt(P(c, 'G5')).id === 'swamp', 'Shallow Grave (Lv2): involuntary movement ending on a Rut — tile flips, the Knight dies'); }
{ const c = mk(5); const M = c.monster; const k = c.knights[0]; ok(!c.kl.vp, 'VP is locked at the start'); for (let i = 0; i < 6; i++) M.addSingleWound(); await c.klAfterAction(); ok(c.kl.vp, 'VP is created at 6+ Wounds');
  c.moveKnight(k, P(c, 'G7')); ok(c.klFreeActions(k).some(a => a.id === 'kl:climb'), 'Climb is offered to an adjacent Knight'); c.vpClimb(k); ok(k.onVP && c.adjacentToMonster(k) && !c.inSight(k) && !c.knightAt(M.cells[0]), 'on the VP: adjacent to the Monster, never in sight, not on the board');
  const cells0 = M.cells.map(x => ({ ...x })); await c.monsterStep({ c: 1, r: 0 }); ok(k.alive && k.onVP && k.pos.c === M.cells[0].c, 'the Knight on the VP rides along when the King moves');
  await c.knockdown(k); ok(!k.onVP && c.board.footprintsAdjacent([k.pos], M.cells) && c.knockedDown(k), 'Knockdown on the VP: Displaced to a space adjacent to the Monster first'); }
{ const c = mk(6, 2); const M = c.monster; c.kl.penance = 4; let sig = 0; c.performSignature = async () => { sig++; }; await c.klAfterAction(); ok(sig === 1 && c.kl.penance === 0, 'Putrid Penance: 4 tokens → discard them and perform Signature'); }
{ const c = mk(7, 4); const k = c.knights[0]; c.moveKnight(k, P(c, 'A1')); ok(c.klPotential(k, 3) === 0, 'Shrug It Off (Lv4): Potentials ignored off Rut / Blindspot / VP'); c.moveKnight(k, P(c, 'G4')); ok(c.klPotential(k, 3) === 3, 'Potentials count while on a Rut tile'); }
{ const c = mk(8); const [a, b] = c.knights; a.vigor = 3; a.heat = 2; a.passion = 1; b.vigor = 9; b.heat = 0; b.passion = 4; await c.klOp({ op: 'klSwapStats' }, { attack: { targets: [a, b] } }); ok(a.vigor === 9 && a.passion === 4 && b.vigor === 3 && b.heat === 2, 'Royal Decree: the two Targets swap [P], [H] and [V]'); }
{ const bpc = KL.cards.bp.find(x => x.name === 'Bejewelled Skull'); ok(bpc.ops.overcome.kind === 'overpower' && bpc.ops.overcome.n === 3 && KL.cards.bp.find(x => x.name === 'Slimy Skin').ops.overcome.kind === 'overcome', 'BP top lines: Overpower vs Overcome kept apart'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3, 4]) { if ((seed + lv) % 3) continue; const c = mk(seed * 17 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 16, `simulations finished: ${done} (wins ${win})`); }
// ---- v0.67.12: Rut flips however the King moves; Royal Decree tie; Slimy Throne ----
{ const c = mk(31); const M = c.monster, B = c.board; for (const key of [...B.terrain.keys()]) B.terrain.delete(key); const d = { c: 1, r: 0 }; const nc = M.cells.map(x => ({ c: x.c + d.c, r: x.r + d.r })).find(x => !M.cells.some(y => y.c === x.c && y.r === x.r)); for (const k of c.knights) if (c.knightAt(nc) === k) c.moveKnight(k, P(c, 'A1')); B.terrain.set(B.key(nc), { id: 'rut', obstacle: false, destructible: false, tile: 900 });
  await c.monsterStep(d); ok(B.terrainAt(nc) && B.terrainAt(nc).id === 'swamp', 'Rut flips when the King is moved onto it by any movement (plain step / push)'); }
{ const c = mk(32); const [a, b, d, e] = c.knights; a.heat = 3; b.heat = 1; d.heat = 1; e.heat = 1; const asks = []; const ask0 = c.ask; c.ask = async q => { if (/동률/.test(q.text || '')) { asks.push(q); return e.id; } return ask0(q); }; const card = c.monsterDef.cards.ai.find(x => x.name === 'Royal Decree');
  const tg = await c.resolveTargeting(card); ok(asks.length === 1 && asks[0].options.length === 3 && tg.targets.includes(a) && tg.targets.includes(e) && tg.targets.length === 2, `Royal Decree: a tie for the second-highest Heat is the players' choice (${tg.targets.map(k => k.name).join(', ')})`);
  a.heat = 3; b.heat = 2; const n0 = asks.length; const tg2 = await c.resolveTargeting(card); ok(asks.length === n0 && tg2.targets.includes(a) && tg2.targets.includes(b), 'Royal Decree: no prompt without a tie'); }
{ const c = mk(33); const B = c.board; const k = c.knights[0]; const free = []; for (let cc = 1; cc <= B.cols; cc++) for (let r = 1; r <= B.rows; r++) { const x = { c: cc, r }; if (c.klEmpty(x) && !c.knightAt(x)) free.push(x); } const ask0 = c.ask; let dest = free[0]; c.ask = async q => q.type === 'move' && /Slimy Throne/.test(q.text || '') ? dest : ask0(q);
  await c.klOp({ op: 'klThrone' }, { attacker: k }); ok(B.terrainAt(free[0]) && B.terrainAt(free[0]).id === 'slimy throne', 'Throne of a Defiled Nation (Critical): the Slimy Throne tile is placed on a chosen empty space');
  c.moveKnight(k, free[0]); ok(c.klOnThrone(k) && c.inBlindspot(k) && c.klFreeActions(k).some(o => o.id === 'kl:throne'), 'Slimy Throne: the Knight on it is in a Blindspot and gets the free action');
  dest = free[5]; c.d10For = async () => 10; await c.klFree(k, 'kl:throne'); ok(L(c, k.pos) === L(c, free[5]) && B.terrainAt(free[5]).id === 'slimy throne' && !B.terrainAt(free[0]), 'Slimy Throne: test passed — tile and Knight are placed on the chosen space');
  ok(!c.klFreeActions(k).some(o => o.id === 'kl:throne'), 'Slimy Throne: once per round (same source)'); c.round++;
  c.d10For = async () => 1; k.virtues = { ...(k.virtues || {}), Tenacity: 0 }; const p0 = L(c, k.pos); await c.klFree(k, 'kl:throne'); ok(L(c, k.pos) === p0 && c.hasCondition(k, 'Slimed'), 'Slimy Throne: test failed — Slimed'); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (king laid low)'); process.exit(fails ? 1 : 0);
