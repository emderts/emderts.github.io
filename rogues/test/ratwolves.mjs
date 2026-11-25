// Ratwolves: data, Strength of the Pack (Toughness tokens, Immediate Spawn + Signature), Rising Pressure, Afflict, Drag traits, simulations.
import fs from 'fs';
import path from 'path';
import { Clash, ChainBreak } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const autoAsk = clash => async q => {
  const M = clash.monster; const near = c => Math.min(...M.mobs.filter(m => m.cells.length).map(m => Math.abs(m.cells[0].c - c.c) + Math.abs(m.cells[0].r - c.r)), 99);
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
const RW = data.monsters.ratwolves;
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'ratwolves', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...RW.cards.ai, ...RW.cards.bp, RW.cards.signature, RW.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o)); ok(RW.cards.ai.length === 10 && RW.cards.bp.length === 9 && unknown.length === 0, `10 AI + 9 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.mobs.length === 4 && M.mobs.every(m => m.card.level === 1) && M.mobs.map(m => L(c, m.cells[0])).sort().join() === 'C10,E4,F10,I6' && M.traits.has('Bile and Poison'), 'setup: 4 BP1 Ratwolves on the designated spaces, Sunken Kingdom Trait');
  ok(mk(1, 1, 'principality').monster.traits.has('Parasite Bed'), 'Principality → Parasite Bed'); }
{ const c = mk(2); const M = c.monster; const mob = M.mobs[0]; const T = mob.card.toughness; const A = { mob };
  const w0 = c.ratWound(A); ok(w0 === 0 && mob.gen === 1 && A.ratToken && M.mobs.includes(mob) && M.wounds === 0, 'Strength of the Pack: first wound places a Generic token (no Wound)');
  for (let i = 1; i < T; i++) c.ratWound({ mob });
  const n = mob.n; const w = c.ratWound({ mob }); ok(w === 1 && !M.mobs.includes(mob) && M.wounds === 1 && c.ratPending.length === 1, 'token count = Toughness → the Ratwolf dies (Wound)');
  await c.ratDeaths(); const nm = M.mobs.find(m => m.n === n); const k = c.alive().find(x => nm && c.board.adjacent(x.pos, nm.cells[0]));
  ok(nm && nm.card.level === 2 && !!k && c.ratPending.length === 0, `Immediate Spawn: BP2 Ratwolf on the same track space, adjacent to a Knight (${nm && L(c, nm.cells[0])})`); }
{ const c = mk(3); const k = c.knights[0]; const h0 = k.heat; await c.fx.runKnightOp({ op: 'poison', n: 2 }, k, {}); ok(c.condTokens(k) === 2 && k.heat === h0 + 2, 'Rising Pressure: Poison 2 → Heat +2');
  const c2 = mk(3, 1, 'principality'); const k2 = c2.knights[0]; await c2.ratAfflict(k2, 1); ok(c2.hasCondition(k2, 'Panzer Parasite') && c2.condTokens(k2) === 1, 'Afflict 1 (Parasite Bed) → Parasitize 1'); await c.ratAfflict(c.knights[1], 1); ok(!!c.hasCondition(c.knights[1], 'Poisoned'), 'Afflict 1 (Bile and Poison) → Poison 1'); }
{ const c = mk(4); const M = c.monster, B = c.board; const mob = M.mobs[0], k = c.knights[0]; for (const o of c.knights.slice(1)) c.moveKnight(o, P(c, 'A' + (10 + c.knights.indexOf(o))));
  B.remove(mob.cells); mob.cells = []; c.moveKnight(k, P(c, 'F6')); c.mobStepTo(mob, P(c, 'F7')); await c.ratDrag(mob, k, 3); ok(L(c, mob.cells[0]) === 'F10' || L(c, mob.cells[0]) === 'F9', `Drag 3 (Lv1): Ratwolf moves away, Knight follows (${L(c, mob.cells[0])}, ${L(c, k.pos)})`); ok(B.adjacent(mob.cells[0], k.pos), 'Knight stays adjacent after Drag'); }
{ const c = mk(5, 2); const M = c.monster, B = c.board; const mob = M.mobs[0], k = c.knights[0]; B.remove(mob.cells); mob.cells = []; c.moveKnight(k, P(c, 'G4')); c.mobStepTo(mob, P(c, 'G5')); k.conditions.push({ id: 'Poisoned', tokens: 2 });
  await c.ratDrag(mob, k, 1); ok(mob.cells[0].c === 2 && k.pos.c === 3, `Lv2: Drag toward the closest short edge, +1 per Condition token (Ratwolf ${L(c, mob.cells[0])}, Knight ${L(c, k.pos)})`); }
{ const c = mk(6, 4); const M = c.monster, B = c.board; const mob = M.mobs[0], k = c.knights[0]; B.remove(mob.cells); mob.cells = []; c.moveKnight(k, P(c, 'G3')); c.mobStepTo(mob, P(c, 'G2')); await c.ratDrag(mob, k, 4); ok(!k.alive && mob.cells.length === 1, 'Lv4 Ravening Ratswarm: dragged past the short edge → the Target dies, the Ratwolf is placed again'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const [lv, kd] of [[1, 'sunken'], [2, 'principality'], [3, 'sunken'], [4, 'principality']]) { if ((seed + lv) % 3) continue; const c = mk(seed * 7 + lv, lv, kd); try { const r = await c.run(60); done++; if (r === 'win' || c.result === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 4).join(' | ')); fails++; } }
  ok(done > 0, `simulations finished: ${done} (wins ${win})`); }
{ const c = mk(51, 3); const k = c.knights[0]; c.curseLevel = 0; k.alive = false; await c.ratOp({ op: 'ratCurseIfDied', n: 1 }, { target: k }); ok(c.curseLevel === 1, 'Cursed Bite: a Knight dying from the Attack gives +1 Curse'); }
// Chain Break during a Ratwolf Attack (e.g. a Mortis Bonus Attack): the rest of that Attack — card Afflict, Go for the Weakest Link — is not resolved
{ let seen = 0, bad = 0; for (let sd = 500; sd < 540 && seen < 3; sd++) { const c = mk(sd); const lv = c.loseVigor.bind(c); let thrown = false; c.loseVigor = async (k, n, o) => { await lv(k, n, o); if (c.currentAttack && !thrown && (!o || !o.source || o.source === 'attack')) { thrown = true; throw new ChainBreak('test'); } };
    const l0 = c.log.length; await c.monsterRound(); if (!thrown) continue; seen++; const L = c.log.slice(l0).map(l => l.msg); const i = L.findIndex(m => /^Chain Break: test/.test(m)); const next = L.findIndex((m, x) => x > i && /^(Ratwolf #\d+ |AI:|Signature:|Activation)/.test(m)); const seg = L.slice(i + 1, next < 0 ? L.length : next); if (i < 0 || seg.some(m => /Go for the Weakest Link|Afflict \d → /.test(m))) { bad++; console.log(seg.join(' | ').slice(0, 400)); } }
  ok(seen > 0 && bad === 0, `Chain Break in a Ratwolf Attack skips the card Afflict and Go for the Weakest Link (${seen} cases)`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (ratwolves)'); process.exit(fails ? 1 : 0);
