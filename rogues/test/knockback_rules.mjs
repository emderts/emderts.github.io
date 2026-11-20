// Knockback: pass-through / destination Displace, adjacency for melee + BP Response Knockback, boss moving onto a guardian.
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
const mk = (monster, seed = 1, level = 1) => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster, level, kingdom: 'principality', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
const put = (c, k, l) => { c.board.remove([k.pos]); k.pos = P(c, l); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); };
const clear = c => { for (const key of [...c.board.terrain.keys()]) c.board.terrain.delete(key); };
{ const c = mk('eggknight'); clear(c); const M = c.monster; const [a, b, d, e] = c.knights; put(c, d, 'A1'); put(c, e, 'A14'); const m = M.cells[0]; const row = 'ABCDEFGHIJ'[m.r]; put(c, a, row + 4); put(c, b, row + 3); // pushed West along the row
  await c.pushback(a, 2, { dir: { c: -1, r: 0 } }); ok(L(c, a.pos) === row + 2 && L(c, b.pos) === row + 3 && c.knightAt(P(c, row + 3)) === b, 'Knockback passes through another Knight: the Knight on the path is not Displaced');
  put(c, a, row + 4); await c.pushback(a, 1, { dir: { c: -1, r: 0 } }); ok(L(c, a.pos) === row + 3 && L(c, b.pos) !== row + 3 && c.knightAt(P(c, row + 3)) === a && c.knightAt(b.pos) === b, `Knockback ending on another Knight's space: only that Knight is Displaced (${L(c, b.pos)})`); }
{ const c = mk('eggknight'); clear(c); const M = c.monster; const k = c.knights[0]; const far = M.cells.every(x => x.c > 4) ? 'A1' : 'A14'; put(c, k, far); const pos = L(c, k.pos);
  await c.fx.runMonsterOps([{ op: 'knockback', n: 3 }], { attacker: k, attack: { knight: k } }); ok(L(c, k.pos) === pos, 'BP Response Knockback does not apply to a non-adjacent Knight');
  await c.fx.runMonsterOps([{ op: 'knockback', n: 3 }], { target: k, hits: 1, attack: { card: { type: 'attack', ops: {} } } }); ok(L(c, k.pos) === pos, 'melee Attack Knockback does not apply after the Knight moved away (e.g. Reflex)');
  await c.fx.runMonsterOps([{ op: 'knockback', n: 2 }], { target: k, hits: 1, attack: { card: { type: 'attack', ops: { range: 6 } } } }); ok(L(c, k.pos) !== pos, 'a Range Attack Knockback still applies at a distance');
  const adj = c.board.neighbors(M.cells[0]).find(x => c.board.inside(x) && !M.cells.some(y => y.c === x.c && y.r === x.r) && !c.knightAt(x)); put(c, k, L(c, adj)); const p2 = L(c, k.pos); await c.fx.runMonsterOps([{ op: 'knockback', n: 2 }], { attacker: k, attack: { knight: k } }); ok(L(c, k.pos) !== p2, 'adjacent: BP Response Knockback applies'); }
{ const c = mk('white-ape-troll'); const M = c.monster; ok(c.guardians.length > 0, `White Ape Troll: ${c.guardians.length} Firstmen Guardians`); const g = c.guardians[0]; const d = { c: 1, r: 0 }; const front = M.cells.map(x => ({ c: x.c + 1, r: x.r })).find(x => !M.cells.some(y => y.c === x.c && y.r === x.r)); for (const k of c.knights) if (k.pos.c === front.c && k.pos.r === front.r) put(c, k, 'A1'); c.board.terrain.delete(c.board.key(front)); for (const o of c.guardians) if (o !== g && o.cells[0].c === front.c && o.cells[0].r === front.r) o.cells = [{ c: 1, r: 9 }]; c.board.remove(g.cells); g.cells = [front]; c.board.place({ kind: 'mob', n: 'G' + g.n }, [front]);
  c._moveCrashed = new Set(); await c.monsterStep(d); ok(M.cells.some(x => x.c === front.c && x.r === front.r) && !M.cells.some(x => x.c === g.cells[0].c && x.r === g.cells[0].r) && c.guardianAt(g.cells[0]) === g, `the Troll stepping onto a Firstmen Warrior Displaces it (${L(c, g.cells[0])})`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (knockback rules)'); process.exit(fails ? 1 : 0);
