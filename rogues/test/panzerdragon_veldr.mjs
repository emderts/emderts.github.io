// Panzerdragon Veldr: data, Dragon Roar, Panzercolony (Migrate / Germinate), Field / Remnant BP, Remnant Move, Turn to Rust, simulations.
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
const DS = data.monsters['panzerdragon-veldr'];
const mk = (seed, level = 1, kingdom = 'principality') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'panzerdragon-veldr', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
const put = (c, k, l) => { c.board.remove([k.pos]); k.pos = P(c, l); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); };
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op && !('stat' in x && 'gte' in x)) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...DS.cards.ai, ...DS.cards.bp, DS.cards.signature, DS.cards.routine, DS.traitBP.field, DS.traitBP.remnant].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['bane', 'parasitize', 'gainHeat'].includes(o)); ok(DS.cards.ai.length === 18 && DS.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.length === 9 && M.cells.every(x => x.c >= 7 && x.c <= 9 && x.r >= 6 && x.r <= 8) && M.facing === 'S' && L(c, c.pv.remnantG.cells[0]) === 'J8' && M.activations.length === 2, 'setup: 3x3 Panzerdragon on G7–I9 facing S, Primal Remnant on J8, 2 AI activations');
  ok(M.drawAI().isRoar, 'Dragon Roar is the first AI'); c.activationAI = async () => {}; await c.pvRoar(); const a = c.pv.armor; ok(a.dragon === 4 && a.remnant === 4 && a.field === 3 && c.divineTarget && c.knights.every(k => c.hasCondition(k, 'Fear') && c.knockedDown(k) && k.passion === 1), 'Dragon Roar: Fear, +1 [P], Knockdown, Divine Target, Germinate 4 / 4 / 3');
  const bp = M.bp.cards[0]; ok(c.bpAT(bp) === M.atOf(bp) + 4 && c.bpAT(c.guardianBP(c.pv.fieldG)) === 5 + 3 && c.bpAT(c.guardianBP(c.pv.remnantG)) === 5 + 8, 'AT: Dragon +1 / token, Field of Parasites 5 + tokens, Primal Remnant 5 + 2 / token');
  c.pvMigrate(); ok(a.field === 4 && a.dragon === 3 && a.remnant === 4, 'Migrate: Remnant → Field → Dragon → Remnant'); c.pvDiscard('dragon', 2); ok(a.dragon === 1 && c.pv.mortal === 2, 'Mortal Retribution: a Generic token for each discarded Armor token');
  c.pool.length = 0; c.poolAdd('break', 2); c.poolAdd('opening', 3); await c.pvFieldEat(c.knights[0]); ok(c.pool.length === 1, 'Field of Parasites: discard X Knight tokens at the end of the Second Ability Window'); }
{ const c = mk(2); await c.pvRemnantMove(4); ok(L(c, c.pv.remnantG.cells[0]) === 'H10' && !c.board.terrainAt(P(c, 'H10')), 'Remnant Move 4 clockwise: J8 → J9 → J10 → I10 → H10, the Column on H10 vanishes');
  const k = c.knights[0]; put(c, k, 'G10'); await c.pvRemnantMove(1); ok(!k.alive, 'Primal Remnant moving onto a Knight: the Knight vanishes (death)'); }
{ const c = mk(3); const k = c.knights[0]; put(c, k, 'H6'); const w = c.fx.usableWeapons(k)[0]; const tg = c.attackTargets(k, w); ok(tg.includes('boss') && tg.includes(c.pv.fieldG), 'a Knight adjacent to the left / right side may attack the Field of Parasites instead'); put(c, k, 'F8'); ok(!c.attackTargets(k, w).includes(c.pv.fieldG), 'not from the front'); }
{ const c = mk(4); const k = c.knights[0]; k.passion = 9; k.gainPassion(1); await c.pvRust(); ok(!k.alive, 'Turn to Rust: [P] would exceed 9 → death');
  const o = c.knights[1]; c.pv.armor.remnant = 6; let lost = false; try { await c.pvGerminate('remnant', 1); } catch (e) { lost = /lose/.test(e.message); } ok(lost || c.result === 'lose', 'Iron Apotheosis: 7 Armor tokens on the Primal Remnant card → the Clash is lost'); }
{ const c = mk(5); c.pv.mortal = 8; const k = c.knights[0]; k.actions = { move: false, combat: false }; ok(c.dgFreeActions(k).some(a => a.id === 'pv:mortal'), 'Mortal Retribution offered at 8 tokens'); await c.dgFree(k, 'pv:mortal'); ok(k.actions.combat && c.pv.mortal === 0, 'additional Combat action'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) { const lv = seed % 2 + 1; const c = mk(seed * 37 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 12, `simulations finished: ${done} (wins ${win})`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (panzerdragon veldr)'); process.exit(fails ? 1 : 0);
