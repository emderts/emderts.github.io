// Pumpkinhead Monstrosities: two-sided BPs, Cursed Overgrowth, Fast Regrowth, Ecological Cataclysm, Controlled Burn, Fire Walk with Me, Kingdom Trait, simulations.
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
const PH = data.monsters['pumpkinhead-monstrosities'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'pumpkinhead-monstrosities', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const L = (c, cell) => c.board.label(cell); const P = (c, l) => c.board.parse(l);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...PH.cards.ai, ...PH.cards.bp, ...PH.cards.bp.map(b => b.back), PH.cards.signature, PH.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['vigorByHitsTable'].includes(o)); ok(PH.cards.ai.length === 13 && PH.cards.bp.length === 6 && unknown.length === 0, `13 AI + 6 two-sided BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; const sap = M.mobs.filter(m => m.side === 'sapling'), pk = M.mobs.filter(m => m.side === 'pumpkin');
  ok(M.mobs.length === 6 && sap.length === 2 && pk.length === 4 && sap.every(m => m.generic === 1 && m.red) && sap.every(m => ['I8', 'B7'].includes(L(c, m.cells[0]))), 'setup: 4 Pumpkinheads + 2 Red Saplings (1 Generic token each) on the designated spaces');
  ok(M.mobs.filter(m => m.tokens.length).length === 2 && M.hasTrait('Venomous Quagmire'), 'setup: 2 AI Activation tokens, Kingdom Trait Venomous Quagmire');
  const m = pk[0]; const base = m.card.at; ok(c.mobAT(m) >= base && c.mobAT(sap[0]) >= sap[0].card.at + 1, 'Ecological Cataclysm: Generic tokens raise the AT'); }
{ const c = mk(2); const M = c.monster; const m = M.mobs.find(x => x.side === 'pumpkin'); const A = { mob: m, wounded: true }; const w0 = M.wounds; ok(c.pumpWound(A) === 0 && A.pumpFlip === m, 'wounding a Pumpkinhead: no Wound Stack entry'); await c.pumpAfterResponses(c.knights[0], A);
  ok(m.side === 'sapling' && m.red && m.generic === 1 && M.wounds === w0 && m.cells.length === 1, `Cursed Overgrowth: BP flipped (+1 Generic token), Red Sapling placed by the Fool's deck (${L(c, m.cells[0])})`); }
{ const c = mk(3); const M = c.monster; const s = M.mobs.find(x => x.side === 'sapling'); const A = { mob: s }; const n = c.pumpWound(A); ok(n === 1 && M.wounds === 1 && !M.mobs.includes(s), 'wounding a Sapling: token discarded, BP → Wound Stack, AI Escalation'); }
{ const c = mk(4); const M = c.monster; const s = M.mobs.find(x => x.side === 'sapling'); s.red = false; const other = M.mobs.find(x => x.side === 'sapling' && x !== s); await c.pumpFastRegrowth(s, 'all'); ok(s.side === 'pumpkin' && !other.red && [...c.board.terrain.values()].filter(t => t.id === 'swamp').length > 16, 'Fast Regrowth: Green Sapling → Pumpkinhead (Venomous Quagmire places a 2x2 Swamp), Red Saplings turn Green'); }
{ const c = mk(5); const M = c.monster; const m = M.mobs.find(x => x.side === 'pumpkin'); m.generic = 3; let lost = false; try { c.pumpToken(m); } catch (e) { lost = c.result === 'lose'; } ok(lost, 'Ecological Cataclysm: 4 Generic tokens on a BP → the Clash is lost'); }
{ const c = mk(6); const M = c.monster; const m = M.mobs.find(x => x.side === 'pumpkin'); c.mobStepTo(m, P(c, 'G6')); m.burning = false; c.mobStepTo(m, P(c, 'F6')); const k = c.knights[0]; for (const x of c.knights) c.moveKnight(x, P(c, 'A14')); c.moveKnight(k, P(c, 'F10')); const w0 = M.wounds; await c.pumpMoveToward(m, k.pos, {}); await c.pumpBurn();
  ok(m.side === 'sapling' && M.wounds === w0 + 1, 'Fire Walk with Me: a Pumpkinhead crossing the Campfire dies → Generic Single Wound, new Sapling'); }
{ const c = mk(7); const k = c.knights[0]; c.moveKnight(k, P(c, 'G7')); ok(c.pumpFreeActions(k).length === 1, 'Campfire: adjacent Knights may gain Heat for Fire tokens (free action)'); await c.pumpCampfire(k); ok(c.poolCount('fire') >= 1, 'Campfire free action adds Fire tokens to the Knight Pool'); }
{ let wins = 0, losses = 0; const N = 10;
  for (let s = 1; s <= N; s++) { const c = mk(5000 + s); const r = await c.run(); if (r === 'win') wins++; else losses++; const bad = c.log.filter(l => /\[미구현/.test(l.msg) && !/Parasitize/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded Pumpkinhead Clashes finished: ${wins} win / ${losses} lose`);
  for (const lv of [2, 3, 4]) for (const sd of [1, 2]) { const c = mk(5100 + lv * 10 + sd, lv, sd === 1 ? 'sunken' : 'principality'); const r = await c.run(); ok(['win', 'lose'].includes(r), `level ${lv} simulation finished (${r}, ${c.round} rounds)`); } }
// --- v0.68.26: a Pumpkinhead that ends any other movement (e.g. following a Pushback) on a Campfire space dies too
{ const c = mk(77, 2); const B = c.board, M = c.monster; const mob = M.mobs.find(m => m.side === 'pumpkin'); await c.pumpBurn(); const w0 = M.wounds;
  let fire = null; for (const [key, t] of B.terrain) if (t.id === 'campfire') { const [cc, r] = key.split(',').map(Number); if (!B.occ.get(key)) { fire = { c: cc, r }; break; } }
  if (!fire) { for (let r = 0; r < B.rows && !fire; r++) for (let cc = 0; cc < B.cols && !fire; cc++) { const p = { c: cc, r }; if (!B.terrainAt(p) && !B.occ.get(B.key(p))) { fire = p; B.terrain.set(B.key(p), { id: 'campfire', name: 'Campfire' }); } } }
  B.remove(mob.cells); mob.cells = [fire]; B.place({ kind: 'mob', n: mob.n }, [fire]); await c.pumpBurn();
  ok(mob.side === 'sapling' && M.wounds === w0 + 1, 'Pumpkinhead moved onto a Campfire by another movement → dies (Fire Walk with Me)'); }

console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
