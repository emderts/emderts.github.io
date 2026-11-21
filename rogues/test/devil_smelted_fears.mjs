// Devil of the Smelted Fears: data, Ferrobaptism, Oubliette / Escape, The Gate, Bargain, Molten Chains, simulations.
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
const DS = data.monsters['devil-of-the-smelted-fears'];
const mk = (seed, level = 1, kingdom = 'principality') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'devil-of-the-smelted-fears', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op && !('stat' in x && 'gte' in x)) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...DS.cards.ai, ...DS.cards.bp, DS.cards.signature, DS.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['bane', 'gainHeat', 'cooldown', 'delay', 'discard'].includes(o)); ok(DS.cards.ai.length === 18 && DS.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.map(x => L(c, x)).sort().join() === 'H2,H3,I2,I3' && M.facing === 'E' && c.dsf.armor === 2 && c.knights.every(k => k.heatLimit === 9), 'setup: Devil on H2/H3/I2/I3 facing E, Start of Clash Ferrobaptism 2, Heat Limit 9');
  const bp = M.bp.cards[0]; const a0 = c.bpAT(bp); c.dsfFerro(3); ok(c.dsf.armor === 5 && c.bpAT(bp) === a0 + 3, 'Ferrobaptism 3: +3 Armor tokens, each +1 AT'); c.dsfTithe(2, 'test'); ok(c.dsf.armor === 3 && c.dsf.oub === 2, 'The Iron Tithe: discarded Armor tokens go onto the Smelter Oubliette card'); }
{ const c = mk(2); const k = c.knights[0]; ok(c.dsfIn(k) && k.inOub && c.adjacentToMonster(k) && c.inSight(k) && !c.knightAt(c.monster.cells[0]), 'Oubliette: off the board, adjacent to the Devil and in sight (Always There)'); const p = L(c, k.pos); await c.pushback(k, 3); ok(k.inOub, 'Knights in the Oubliette cannot be moved involuntarily');
  c.dsf.oub = 4; k.actions = { move: true, combat: true }; ok(c.dsfFreeActions(k).length === 0, 'Escape needs 5 Armor tokens on the card'); c.dsf.oub = 5; ok(c.dsfFreeActions(k).some(a => a.id === 'dsf:escape'), 'Escape offered with 5 tokens'); await c.dsfFree(k, 'dsf:escape'); const e = Math.min(k.pos.c - 1, 14 - k.pos.c, k.pos.r, 9 - k.pos.r); ok(!k.inOub && e >= 4 && c.hasCondition(k, 'Baptized in Metal') && c.dsf.oub === 0 && !k.actions.move, `Escape: 4+ spaces from every Board Edge (${L(c, k.pos)}), gains Baptized in Metal`); ok(c.dsfEscapeCost() === 6 && !c.dsfIn(k), 'Baptized in Metal: Escape costs 1 more for others, and this Knight cannot be moved to the Oubliette'); }
{ const c = mk(3); const k = c.knights[0]; c.dsfGatekeeper(k); ok(k.panzergate === 1, 'Gatekeeper: Panzergate token'); k.gear.push({ name: 'Test Shield', type: 'weapon', hands: 1, traits: ['Shield'], text: '' }); await c.dsfGatecrasher(k); ok(k.gear.filter(g => g.type === 'armor' || (g.traits || []).includes('Shield')).every(g => g.discarded), 'Gatecrasher with a Panzergate token: Armor and Shield Gear discarded'); }
{ const c = mk(4); const k = c.knights[0]; c.dvFools = ['E', 'D', 'C', 'F'].map(l => ({ name: l, letter: l })); c.dvFoolsDiscard = []; c.dsf.armor = 10; let n = 0; c.ask = async q => q.type === 'confirm' ? (/계속 뽑음/.test(q.text) ? ++n < 3 : /섞어 넣음/.test(q.text) ? false : q.default) : q.options ? q.options[0].value : null; const b0 = k.bane; await c.dvBargain(k); ok(k.bane === b0 + 1 && c.dsf.armor === 4 && c.dsf.oub === 6, 'Bargain: Bane 1, E + D + C drawn → 6 Armor tokens moved to the Oubliette card');
  c.dvFools = [{ name: 'A', letter: 'A' }]; await c.dvBargain(k); ok(k.inOub, 'Bargain "A": stop drawing and move to the Oubliette'); }
{ const c = mk(5, 2); const k = c.knights[0]; k.heat = 4; c.drawMortis = async () => {}; const g0 = k.gear.filter(g => g.exhausted).length; const d0 = k.delay.length; await c.perilCheck(k); ok(k.delay.length === d0 + 1 && k.gear.filter(g => g.exhausted).length === g0 + 1, 'Molten Chains (Lv2): Major via Stains of Profanity → Delay + Exhaust 1 Gear'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3]) { if ((seed + lv) % 3) continue; const c = mk(seed * 23 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 12, `simulations finished: ${done} (wins ${win})`); }
// ---- v0.67.19 (owner corrections 2026-11-21) ----
{ const DSD = data.monsters['devil-of-the-smelted-fears']; const ai = n => DSD.cards.ai.find(x => x.name === n); const idx = (n, f) => ai(n).ops.effects.findIndex(f);
  ok(['Spear Bash', 'Dragged Down Under', 'Searing Iron'].every(n => idx(n, o => o.op === 'reactWindow') >= 0 && idx(n, o => o.op === 'reactWindow') < idx(n, o => o.op === 'knockdown')), 'Spear Bash / Dragged Down Under / Searing Iron: the REACT! window comes before Knockdown');
  const c = mk(61, 3); const k = c.knights[0]; ok(c.monster.hasTrait('Only Fear Will Remain') && typeof c.dsfFearFlush === 'function', '(setup) Level 3 has Only Fear Will Remain'); let chokes = 0; const rmo = c.fx.runMonsterOp.bind(c.fx); c.fx.runMonsterOp = async (o, ctx) => { if (o.op === 'choke') { chokes++; return; } return rmo(o, ctx); };
  const g = k.gear.find(x => !x.exhausted); g.exhausted = true; await c.dsfFearFlush(); ok(chokes === 1, 'Only Fear Will Remain: exhausting a Gear card for any reason (a cost included) → Choke 1'); g.exhausted = false; g.exhausted = true; g.exhausted = true; await c.dsfFearFlush(); ok(chokes === 2, '... once per exhaust');
  c.dsfIn(k, 'test'); ok(k.inOub && c.inSight(k), 'Master of the Oubliette (Always There): a Knight in the Oubliette is not out of sight');
  c.dsf.flags.noSeqZone = true; let ran = 0; const zc = DSD.cards.ai.find(x => /ZONE/.test(x.typePrinted)); const logs0 = c.log.length; await c.resolveMonsterAttack(zc, {}); ok(c.log.slice(logs0).some(l => /비활성 \(Exposed Tendon Critical\)/.test(l.msg)), 'Exposed Tendon Critical: Zone / Sequential Attacks are not performed'); c.dsf.flags.noSeqZone = false;
  const c2 = mk(62, 2); const k2 = c2.knights[0]; k2.heat = 0; await c2.dsfOp({ op: 'dsfK', k: { op: 'gainHeat', n: 1 }, who: 'target', perHit: true }, { target: k2, hits: 2, attack: {} }); ok(k2.heat === 3, `[Heat] bonus is added once per effect, not per hit (2 hits x1 +1 = ${k2.heat})`);
  c2.dsf.ignoreBA = true; const w0 = c2.monster.wounds; await c2.knightAttack(k2, { bonus: true }); ok(c2.log.some(l => /Bonus Attack 무시/.test(l.msg)), 'Hell-ter Smelter (Heat 6+): Bonus Attacks are ignored'); c2.dsf.ignoreBA = false; }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (devil of the smelted fears)'); process.exit(fails ? 1 : 0);
