// Devil of the Ancient Dusk: data, Primordial Soup setup, Deluge, Stains of Profanity, Swampwalk, Bargain, simulations.
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
const DD = data.monsters['devil-of-the-ancient-dusk'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'devil-of-the-ancient-dusk', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x); const T = (c, l) => (c.board.terrainAt(P(c, l)) || {}).id;
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op && !('stat' in x && 'gte' in x && !('then' in x))) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...DD.cards.ai, ...DD.cards.bp, DD.cards.signature, DD.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['bane', 'gainHeat', 'poison', 'toxify', 'perilCheck'].includes(o)); ok(DD.cards.ai.length === 18 && DD.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); ok(c.knights.every(k => k.heatLimit === 9) && T(c, 'H1') === 'swamp' && T(c, 'H14') === 'swamp' && T(c, 'J6') === 'column' && !T(c, 'H5'), 'Level 1 setup: Heat Limit 9, Swamp tiles on columns 1 and 14, 15 Columns'); ok(c.dadColumns().length === 15, '15 Columns at Level 1'); }
{ const c = mk(2, 2); ok(T(c, 'J4') === 'swamp' && T(c, 'J5') === 'swamp' && !T(c, 'J7') && T(c, 'A11') === 'swamp' && c.dadColumns().length === 14, 'Level 2+ setup: stepped Swamp tiles with Swamp spaces beyond them, 14 Columns'); }
{ const c = mk(3); const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'E' + (4 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'H5')); k._moved = false; await c.dadDeluge(k); const p = c.dadPair(P(c, 'H5').r); ok(p.L === 2 && T(c, 'H2') === 'swamp' && p.R === 11 && k.alive, `Deluge: the left tile stops on the first Column (destroyed), then the right tile (${p.L}/${p.R})`);
  await c.dadDeluge(k); ok(p.L === 7 && p.R === 8 && (!k.alive || T(c, 'H5') === 'swamp'), 'second Deluge: the left tile sweeps on to the next Column — then the right tile closes until adjacent; the Knight there is now in the Swamp'); }
{ const c = mk(4); const k = c.knights[0]; k.heat = 6; let tier = null; const dm = c.drawMortis.bind(c); c.drawMortis = async (x, t) => { tier = t; }; await c.perilCheck(k); ok(tier === 'Grave', 'Stains of Profanity: Heat 6 → Grave Mortis instead of the Peril Arc'); }
{ const c = mk(5); const k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (5 + c.knights.indexOf(o)))); c.moveKnight(k, P(c, 'E4')); await c.dadSwampwalk(k); ok(c.board.footprintsAdjacent(c.monster.cells, [k.pos]) && c.monster.cells.every(x => x.c <= 3), `Swampwalk: the Devil appears at the short Board Edge in the Target's row and moves adjacent (${c.monster.cells.map(x => L(c, x)).join('/')})`); }
{ const c = mk(6); const k = c.knights[0]; const n0 = c.dadColumns().length; const b0 = k.bane; c.ask = async q => q.type === 'pick' && /뽑을 장수/.test(q.text) ? 4 : q.type === 'move' ? q.cells[0] : q.type === 'confirm' ? q.default : q.options ? q.options[0].value : null; const n = await c.dvBargain(k, {}); ok(n === 4 && k.bane === b0 + 1 && (c.dadColumns().length === n0 + 2 || !k.alive), 'Bargain: Bane 1, 4 cards drawn → 2 Columns placed'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3]) { if ((seed + lv) % 3) continue; const c = mk(seed * 19 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 12, `simulations finished: ${done} (wins ${win})`); }
// ---- v0.67.18 (owner corrections 2026-11-21) ----
{ const DSD = data.monsters['devil-of-the-ancient-dusk']; const ai = n => DSD.cards.ai.find(x => x.name === n);
  ok(['Savage Swing', 'Tail Pierce', 'Sunder Foundations', 'Crushing Grasp', 'The Oldest Trick'].every(n => ai(n).ops.gates.some(g => g.stat === 'bane')) && !JSON.stringify(DSD.cards).includes('"passion"'), 'purple gates are Bane gates');
  ok(ai('Savage Swing').ops.zoneDiagram.red.length === 16 && ai('Sunder Foundations').ops.zoneDiagram.red.length === 16, 'Savage Swing / Sunder Foundations zones: 16 spaces each');
  const c = mk(51, 2); const k = c.knights[0]; let n = 0; c.dadDeluge = async () => { n++; }; await c.dadOp({ op: 'dadDeluge', who: 'target', perHit: true }, { target: k, hits: 3, attack: {} }); ok(n === 3, 'Drag to the Depths: Deluge once per hit');
  k.heat = 0; await c.dadOp({ op: 'dadK', k: { op: 'gainHeat', n: 3 }, who: 'target' }, { target: k, hits: 1, attack: {} }); ok(k.heat === 3 + (c.monster.bonuses.heat || 0) && c.monster.bonuses.heat === 1, `Level 2 [Heat] bonus: +1 whenever an Attack gives Heat (${k.heat})`);
  k.heat = 0; await c.dadOp({ op: 'dadK', k: { op: 'gainHeat', n: 3 }, who: 'target' }, { target: k, hits: 1 }); ok(k.heat === 3, 'no bonus outside an Attack');
  let armor = null; const lv = c.loseVigor.bind(c); c.loseVigor = async (kk, x, o = {}) => { armor = o.armor; return lv(kk, x, o); }; c.perilCheck = async () => {}; k.vigor = k.maxVigor; await c.dadOp({ op: 'dadRitual' }, { target: k, hits: 1, attack: {} }); ok(armor !== false, 'Ritual Macabre: the Vigor loss allows an Armor Roll'); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (devil of the ancient dusk)'); process.exit(fails ? 1 : 0);
