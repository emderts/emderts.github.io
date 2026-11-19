// Young Devour Dragon: data, Bellow, Phases, To Hit, Ruined Bastion, Ram, Devour, Lunging Attack, VP / Divine Target, simulations.
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
const DS = data.monsters['young-devour-dragon'];
const mk = (seed, level = 1, kingdom = 'principality') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'young-devour-dragon', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
const put = (c, k, l) => { c.board.remove([k.pos]); k.pos = P(c, l); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); };
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op && !('stat' in x && 'gte' in x)) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...DS.cards.ai, ...DS.cards.bp, DS.cards.signature, DS.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['bane', 'toxify', 'gainHeat', 'condition'].includes(o)); ok(DS.cards.ai.length === 18 && DS.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.length === 9 && M.cells.every(x => x.c >= 8 && x.c <= 10 && x.r >= 6 && x.r <= 8) && c.yddTowers().length === 3 && c.dg.vp && c.yddOnTower(c.knights[0]) && M.ai.cards.every(x => x.level === 1), 'setup: 3x3 Dragon on G8–I10, 3 Towers, VP unlocked, a Knight starts on a Tower');
  ok(M.drawAI().isBellow, 'Bellow of the Famished is the first AI'); c.activationAI = async () => {}; await c.yddBellow(); ok(c.divineTarget && c.knights.filter(k => c.hasCondition(k, 'Called by the Heavens')).length === 2, 'Bellow: one Divine Target, two Called by the Heavens');
  const [a, b, d] = c.knights; put(c, b, 'A1'); put(c, d, 'I5'); ok(c.yddToHit(a, {}) === 0 && c.yddToHit(b, {}) === 4 && c.yddToHit(d, {}) === 2, 'Flying High: To Hit +4, +2 from a Ruined Wall, +0 from a Tower');
  put(c, b, 'H3'); const r = c.yddReachable(b, 3).map(x => L(c, x)); ok(r.includes('H4') && !r.includes('G4') === false || r.includes('H4'), 'Ruined Bastion: a Knight may move onto a Ruined Wall'); put(c, b, 'E3'); ok(!c.yddReachable(b, 2).some(x => L(c, x) === 'F3'), 'a Tower cannot be entered from the ground'); put(c, b, 'H4'); a.pos && put(c, a, 'A2'); ok(c.yddReachable(b, 2).some(x => L(c, x) === 'G4'), 'a Tower can be entered from a Ruined Wall'); }
{ const c = mk(2); const M = c.monster; c.ydd.bellow = true; const w = () => M.wounds; M.addSingleWound(); M.addSingleWound(); M.addSingleWound(); let ai = 0; c.activationAI = async () => { ai++; }; await c.yddPhaseCheck(); ok(c.ydd.phase === 2 && M.ai.cards.length === 6 && M.ai.cards.every(x => x.level === 2) && M.bp.cards.every(x => x.level === 2) && ai === 1, 'Falling Skies: 3 Wounds → Floating Low, AI 2 / BP 2 decks, the Dragon performs AI');
  ok(c.yddToHit(c.knights[1], {}) === 2, 'Floating Low: To Hit +2'); M.addSingleWound(); M.addSingleWound(); M.addSingleWound(); await c.yddPhaseCheck(); ok(c.ydd.phase === 3 && M.ai.cards.every(x => x.level === 3) && ai === 2 && c.yddToHit(c.knights[1], {}) === 0, '6 Wounds → Grounded, AI 3 / BP 3 decks'); }
{ const c = mk(3); const k = c.knights[0]; const tw = c.yddTowers().find(t => t.some(x => L(c, x) === 'G4')); c.board.distance = ((d) => (a, b) => b === tw || (b.length === 4 && b.every(x => tw.some(t => t.c === x.c && t.r === x.r))) ? 99 : d.call(c.board, a, b))(c.board.distance); const v = k.vigor; await c.yddRam(); ok(k.vigor === v - 1 && c.knockedDown(k) && c.board.terrainAt(P(c, 'G4')).id === 'tower', 'Ram (Flying High): each Knight on the Tower suffers Crash, the Tower stays');
  c.ydd.phase = 3; const k2 = c.knights[2]; await c.yddRam(); ok(c.yddTowers().length === 2, 'Ram (Grounded): the Tower is destroyed'); }
{ const c = mk(4); const k = c.knights[0]; c.ydd.phase = 3; await c.yddDevour(k, 'test'); ok(!k.alive && c.ydd.devoured.includes(k), 'Devoured Knights die'); await c.yddOp({ op: 'yddRegurgitate' }, {}); ok(k.alive && k.vigor === Math.ceil(k.maxVigor / 2), 'Bottomless Stomach Critical: regurgitated with half of maximum [V]'); }
{ const c = mk(5); const k = c.knights[0]; k.actions = { move: true, combat: true }; put(c, k, 'G4'); const Lc = c.yddLungeCell(k); ok(Lc && c.monster.cells.some(m => c.board.adjacent(m, Lc.cell)) && c.yddFreeActions(k).some(a => a.id === 'ydd:lunge'), `Lunging Attack offered from a Tower (${Lc && L(c, Lc.cell)})`);
  c.divineTarget = c.knights[1]; ok(!c.vpClimb(c.knights[1]), 'the Divine Target cannot move to the VP'); c.dgClimb(k); ok(k.onVP, 'VP'); const cell = await c.vpPickAdjacent(k, 'x'); c.vpLeave(k, cell); c.dgLeftVP(k); ok(c.divineTarget === k, 'leaving the VP: gain the Divine Target token'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) { const lv = seed % 2 + 1; const c = mk(seed * 41 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 12, `simulations finished: ${done} (wins ${win})`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (young devour dragon)'); process.exit(fails ? 1 : 0);
