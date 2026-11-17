// Knighteater: data, Fleisch / Wolf Down / Berserk, Armor tokens, Brute, Forced Vault, Drag, Appear Behind, simulations.
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
const KE = data.monsters['knighteater'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'knighteater', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...KE.cards.ai, ...KE.cards.bp, KE.cards.signature, KE.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o)); ok(KE.cards.ai.length === 18 && KE.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.map(x => L(c, x)).sort().join() === 'G7,G8,H7,H8' && ['S', 'W'].includes(M.facing) && M.traits.has('Adaptable') && mk(1, 1, 'principality').monster.traits.has('Iron Confines'), `setup: G7/G8/H7/H8, facing ${M.facing}, Kingdom Trait`); }
{ const c = mk(2); const M = c.monster; c.poolAdd('fleisch', 2); const bp = M.bp.cards[0]; const at0 = c.bpAT(bp);
  await c.keWolf(2); ok(!c.ke.berserk && c.ke.armor === 1 && c.poolCount('fleisch') === 0 && c.bpAT(bp) === at0 + 1, 'Wolf Down 2 with exactly 2 Fleisch: not Berserk, +1 Armor token (+1 AT)');
  const pt0 = c.priorityTarget; await c.keWolf(1); ok(c.ke.berserk && c.priorityTarget === null, 'Wolf Down with too few Fleisch → Berserk, Priority Target token on the Knighteater Sheet'); c.priorityTarget = c.knights[1]; ok(c.priorityTarget === null, 'Knights cannot gain the Priority Target token while it is Berserk');
  const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, M.facing === 'S' ? 'F7' : 'G6')); const v0 = k.vigor; await c.keWolf(3); ok(c.ke.berserk && k.vigor < v0, `Berserk + too few Fleisch: a random adjacent Knight loses Vigor (${v0} → ${k.vigor})`);
  c.poolAdd('fleisch', 1); c.knights[2].passion = 3; await c.keWolf(1); ok(!c.ke.berserk && c.ke.armor === 2 && c.priorityTarget === c.knights[2], 'Berserk + exactly X: stops being Berserk, +1 Armor token, highest Passion gains the Priority Target'); }
{ const c = mk(3, 3); const k = c.knights[0]; c.ke.berserk = true; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'F7')); c.monster.facing = 'S'; await c.keWolf(2); ok(!k.alive && !c.ke.berserk, 'Lv3 Living Up to the Name: the adjacent Knight is devoured, then Berserk ends');
  const c4 = mk(3, 4); c4.ke.berserk = true; ok(c4.keFeral({}) === true, 'Lv4 Feral Guard: cannot be wounded while Berserk'); }
{ const c = mk(4, 2); c.keArmor(1); c.keBrute(1); ok(c.ke.brute === 2 && !c.ke.pendingSig, 'Brute: Generic tokens for Armor tokens and Wounds'); c.keBrute(1); ok(c.ke.pendingSig, 'Brute: 3 tokens → Signature pending'); let sig = 0; c.performSignature = async () => { sig++; }; await c.keBruteSig(); ok(sig === 1 && c.ke.brute === 0 && c.ke.armor === 0, 'Brute: discard Generic and Armor tokens, perform Signature'); }
{ const c = mk(5); const M = c.monster, B = c.board; M.facing = 'S'; const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'F7')); await c.keVault(k); ok(L(c, k.pos) === 'I7', `Forced Vault: the Knight is placed on the opposite side (${L(c, k.pos)})`);
  c.moveKnight(k, P(c, 'F8')); await c.keDrag(k, 2); ok(M.cells.map(x => L(c, x)).sort().join() === 'I7,I8,J7,J8' && L(c, k.pos) === 'H8', `Drag 2: the Knighteater moves away, the Knight follows (${M.cells.map(x => L(c, x)).join('/')}, ${L(c, k.pos)})`);
  const col = P(c, 'G9'); ok(B.terrainAt(col) && B.terrainAt(col).id === 'column', 'Measured Movement: Columns are not destroyed'); }
{ const c = mk(6); const M = c.monster, B = c.board; const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'D4')); await c.keAppearBehind(k); ok(B.footprintsAdjacent([k.pos], M.cells) && !M.cells.some(x => B.terrainAt(x) && B.terrainAt(x).obstacle), `Appear Behind: adjacent to the Target, Columns moved from under it (${M.cells.map(x => L(c, x)).join('/')})`); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const [lv, kd] of [[1, 'sunken'], [2, 'principality'], [3, 'sunken'], [4, 'principality']]) { if ((seed + lv) % 3) continue; const c = mk(seed * 17 + lv, lv, kd); try { const r = await c.run(); done++; if (r === 'win') win++; const bad = c.log.filter(l => /미구현 targeting/.test(l.msg)); if (bad.length) { console.log('WARN', bad[0].msg); fails++; } } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 5).join(' | ')); fails++; } }
  ok(done === 16, `simulations finished: ${done} (wins ${win})`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (knighteater)'); process.exit(fails ? 1 : 0);
