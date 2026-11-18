// Stonemason Knight: data, Lodestone Armor (Ward Nodes), Ruin / Rubble tiles, Move Lateral, hit tables, simulations.
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
const SM = data.monsters['stonemason-knight'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'stonemason-knight', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...SM.cards.ai, ...SM.cards.bp, SM.cards.signature, SM.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o)); ok(SM.cards.ai.length === 18 && SM.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.map(x => L(c, x)).sort().join() === 'G7,G8,H7,H8' && M.facing === 'S' && c.sm.tiles.length === 3, 'setup: Stonemason on G7/G8/H7/H8 facing S, 3 Rubble tiles'); }
{ const c = mk(2); const M = c.monster; ok(c.smSide(P(c, 'F7')) === 'front' && c.smSide(P(c, 'I8')) === 'rear' && c.smSide(P(c, 'G6')) === 'right' && c.smSide(P(c, 'H9')) === 'left', 'sides relative to facing S: F7 front, I8 rear, G6 right, H9 left');
  const bp = M.bp.cards[0]; const at0 = c.bpAT(bp); await c.smLodestone('front'); c.sm.side = 'front'; ok(c.sm.nodes.front === 1 && c.bpAT(bp) === at0 + 1, 'Lodestone Armor: token on the attacked side, +1 AT from that side'); c.sm.side = 'rear'; ok(c.bpAT(bp) === at0, 'no bonus from a side without a token'); c.sm.side = null;
  await c.smLodestone('front'); ok(c.sm.nodes.front === 1, 'no second token on a side that already has one (Lv1)');
  await c.smLodestone('left'); await c.smLodestone('right'); await c.smLodestone('rear'); ok(Object.values(c.sm.nodes).join() === '0,0,0,0' && c.sm.locked, 'fourth Ward Node: one token discarded from every Node, locked until the end of the Round');
  await c.smLodestone('front'); ok(c.sm.nodes.front === 0, 'no tokens while locked'); }
{ const c = mk(3, 3); c.sm.nodes.front = 2; c.sm.side = 'front'; ok(c.smImpervious({}) === true, 'Lv3 Impervious Armor: cannot be wounded from a side with 2+ tokens'); c.sm.side = 'rear'; ok(!c.smImpervious({}), 'other sides can be wounded'); c.sm.side = null;
  const c4 = mk(3, 4); await c4.smLodestone('front'); await c4.smLodestone('front'); await c4.smLodestone('front'); ok(c4.sm.nodes.front === 2, 'Lv4 Unwavering Devotion: a second token on a side with one'); }
{ const c = mk(4); const M = c.monster, B = c.board; for (const k of c.knights) c.moveKnight(k, P(c, 'A' + (1 + c.knights.indexOf(k)))); await c.smRuin(); ok(['F7', 'F8', 'E7', 'E8'].every(l => c.smRubbleAt(P(c, l))) && c.sm.tiles.length === 4, 'Ruin: 2x2 Rubble in front of and adjacent to the Stonemason');
  const k = c.knights[0]; c.moveKnight(k, P(c, 'E9')); await c.smRubbleUnder(k, 'test'); ok(c.smRubbleAt(k.pos) && c.sm.tiles.length === 5 && new Set(c.sm.tiles.flat().map(x => L(c, x))).size === 20, `Rubble under a Knight overlapping a tile: the old tile is moved next to the new one (${c.sm.tiles.map(t => L(c, t[0])).join(' ')})`); }
{ const c = mk(5, 2); const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'I4')); let jud = 0; const dj = c.drawJudicium.bind(c); c.drawJudicium = async x => { jud++; }; await c.smRubbleUnder(k, 'test'); ok(jud === 1, 'Lv2 Buried Alive: Rubble placed on a Knight already on Rubble → Judicium'); }
{ const c = mk(6); const M = c.monster; const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (1 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'D3')); const card = M.aiEsc[2].cards.find(x => x.name === 'Hammer Launch') || M.ai.cards.find(x => x.name === 'Hammer Launch') || data.monsters['stonemason-knight'].cards.ai.find(x => x.name === 'Hammer Launch');
  await c.smLateral(card, k); M.facing = 'S'; c.turnToward(k.pos); ok(c.bossDiagramCells(card.ops.zoneDiagram).some(x => x.c === k.pos.c && x.r === k.pos.r), `Move Lateral: straight move until the Target is inside the Zone (Stonemason ${M.cells.map(x => L(c, x)).join('/')}, facing ${M.facing})`); }
{ const c = mk(7); const k = c.knights[0]; const v0 = k.vigor; await c.smOp({ op: 'smHits', table: [3, 5] }, { target: k, hits: 3, gatesOn: [{ op: 'smThree', n: 2 }] }); ok(v0 - k.vigor >= 1 && v0 - k.vigor <= 7, `hit table with the Heat 3+ gate: 3 hits → -5 -2 before Armor (lost ${v0 - k.vigor})`); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3, 4]) { if ((seed + lv) % 3) continue; const c = mk(seed * 13 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 5).join(' | ')); fails++; } }
  ok(done === 16, `simulations finished: ${done} (wins ${win})`); }
{ const ai = n => SM.cards.ai.find(x => x.name === n); ok(ai('Stone Smite').ops.zoneDiagram.red.length === 6 && ai('Mass Driver').ops.zoneDiagram.red.length === 16, 'Stone Smite = front 2x2 + 2 diagonals, Mass Driver = front 2x8');
  const c = mk(61); const M = c.monster; const xs = M.cells.map(q => q.c), ys = M.cells.map(q => q.r); const diag = { c: Math.max(...xs) + 1, r: Math.max(...ys) + 1 }, str = { c: Math.max(...xs) + 1, r: Math.max(...ys) };
  ok(c.smSideOptions(diag).length === 2 && c.smSideOptions(str).length === 1, 'Lodestone Armor: a diagonal position may be either side (player choice)');
  c.monNegPrecTemp = 0; await c.fx.runMonsterOp({ op: 'monsterNegPrecision' }, {}); await c.fx.runMonsterOp({ op: 'monsterNegPrecision', permanent: true }, {}); ok(c.monNegPrecTemp === 1 && c.monNegPrecPerm === 1, 'negative Precision tokens on the Monster (temporary / permanent)');
  ok(SM.cards.bp.find(x => x.name === 'Sturdy Backplate').ops.critical[0].hug === true, 'Sturdy Backplate Critical uses Hug'); }
{ const c = mk(62); const M = c.monster; const xs = M.cells.map(q => q.c), ys = M.cells.map(q => q.r); const diag = { c: Math.max(...xs) + 1, r: Math.max(...ys) + 1 }; const o = c.smSideOptions(diag); const cnt = {}; for (const s of o) cnt[s] = 1; ok(o.length === 2 && Object.keys(cnt).length === 2, 'a diagonal Knight counts on both adjoining sides (Magnetite Reinforcement)'); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (stonemason knight)'); process.exit(fails ? 1 : 0);
