// Puppet King Edelhardt: data, Fallen Knight Army, Armor tokens, Wave blocking / Shockwave, VP, Commands, On Command, simulations.
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
const DS = data.monsters['puppet-king-edelhardt'];
const mk = (seed, level = 1, kingdom = 'principality') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'puppet-king-edelhardt', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
const put = (c, k, l) => { c.board.remove([k.pos]); k.pos = P(c, l); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); };
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op && !('stat' in x && 'gte' in x)) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...DS.cards.ai, ...DS.cards.bp, DS.cards.routine, DS.traitAttack, DS.fallenKnight.bp].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['bane', 'gainHeat', 'cooldown', 'delay', 'discard', 'parasitize'].includes(o)); ok(DS.cards.ai.length === 18 && DS.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.cells.map(x => L(c, x)).sort().join() === 'E12,E13,F12,F13' && M.facing === 'W' && c.guardians.length === 10 && c.guardians.every(g => g.isFK && g.cells[0].c === 1) && c.pkeStrings().length === 2, 'setup: King on E12/E13/F12/F13 facing W, 10 Fallen Knights in column 1, 2 Loose String tiles');
  const g = c.guardians.find(g => g.cells[0].r === 0); ok(await c.pkeMoveFK(g, 5) && L(c, g.cells[0]) === 'A6', 'Fallen Knight moves 5 spaces toward the highest column');
  await c.pkeMoveFK(g, 5); await c.pkeMoveFK(g, 5); ok(!c.guardians.includes(g) && c.pke.armor === 1, 'Fallen Knight reaching column 14 is removed → King gains 1 Armor token');
  const bp = M.bp.cards[0]; const a0 = c.bpAT(bp); c.pke.armor = 3; ok(c.bpAT(bp) === a0 + 2 && c.bpAT(c.guardianBP(c.guardians[0])) === 7 + 3, 'Armor tokens: +1 AT each for the King and the Fallen Knights (AT 7)');
  c.pke.armor = 4; try { await c.pkeArmor(1); } catch (e) { if (!/lose/.test(e.message)) throw e; } ok(c.pke.armor === 0 && c.knights.some(k => k.bane > 0 || !k.alive), '5th Armor token: discard all, each Knight suffers Bane 5'); }
{ const c = mk(2); const [a, b] = c.knights; put(c, a, 'G8'); put(c, b, 'F9'); ok(c.pkeBlocked(a) && !c.pkeBlocked(b), 'Wave Attack: a Knight behind an adjacent Column (G9) is excluded, a Knight in the open is not');
  const v = b.vigor; a.vigor = a.maxVigor; const va = a.vigor; await c.pkeShockwave(); ok(a.vigor === va && b.vigor <= v - 3, `Shockwave: X = 4 + 1 − 2 = 3 for a Knight 2 spaces away (${v}→${b.vigor}), blocked behind the Column`); }
{ const c = mk(3, 2); const g = c.guardians.find(g => g.cells[0].r === 4); const k = c.knights[0]; put(c, k, 'E3'); await c.pkeMoveFK(g, 5); ok(L(c, g.cells[0]) === 'E2', 'Fallen Knight stops in front of a Knight (below Level 3)'); }
{ const c = mk(3, 3); const g = c.guardians.find(g => g.cells[0].r === 4); const k = c.knights[0]; put(c, k, 'E3'); await c.pkeMoveFK(g, 5); ok(L(c, g.cells[0]) === 'E6' && L(c, k.pos) === 'E2' && c.knockedDown(k), 'Unstoppable Force (Lv3): Forced Vault + Knockdown, the Fallen Knight keeps moving'); }
{ const c = mk(4); const k = c.knights[0]; const s = c.pkeStrings()[0]; put(c, k, L(c, s)); await c.pkeStringCheck(k); ok(k.onVP && c.pkeStrings().length === 1 && c.adjacentToMonster(k), 'Loose String: ending movement on it → VP, tile removed');
  c.pke.armor = 3; const A = { knight: k, extraPool: { raw: 0 }, hits: 1 }; await c.pkeBeforeAttack(k, A); c.currentKnightAttack = A; ok(A.pkeVP && A.vpNoResp && A.extraPool.raw === 1 && c.bpAT(c.monster.bp.cards[0]) === c.monster.atOf(c.monster.bp.cards[0]), 'The Seat of Power: +1 Power, Armor tokens ignored, normal Responses replaced');
  A.wounded = true; A.bp = { name: 'Cold Feet' }; c.pke.stack.length = 0; await c.pkeAfterAttack(k, A); ok(!k.onVP && c.hasCondition(k, 'Subjugated') && k.pos.c === 11, `VP WOUND: Subjugated, moved to a space in front of the King (${L(c, k.pos)})`); c.currentKnightAttack = null; }
{ const c = mk(5); const k = c.knights[0]; const n0 = c.guardians.length; c.pke.tokens = 2; const w0 = c.monster.wounds; await c.pkeAfterAttack(k, { knight: k, guardian: c.guardians[0], hits: 1 }); ok(c.monster.wounds === w0 + 1 && c.pke.tokens === 0, 'Fallen Knight Army: 2 Generic tokens → Generic Single Wound');
  const g = c.guardians[0]; const cell = g.cells[0]; c.pkeFlipFK(g); ok(c.guardians.length === n0 - 1 && c.board.terrainAt(cell).id === 'column', 'Fallen Knight flipped to a Column Terrain tile');
  await c.pkeFinger(k, 5); ok(c.monster.wounds === w0 + 3, '5th Finger: Generic Double Wound'); }
{ const c = mk(6); const k = c.knights[0]; await c.addCondition(k, 'Subjugated'); const card = DS.cards.ai.find(x => x.name === 'The King Commands: Bow Down!'); const attack = { card, targets: [k], hits: {}, firstHits: {} }; await c.attackOneTarget(attack, k); ok(attack.cmd.obeyed.includes(k) && c.knockedDown(k) && k.bane === 2, 'Command: a Subjugated Knight must Obey (Bow Down!: Knockdown, Bane 2)'); }
{ const c = mk(7, 4); const M = c.monster; const [x, y] = M.ai.cards; const pick = M.drawAI(); const isC = z => !!(z.ops && z.ops.command); ok(pick.pkeMarker ? (x.level === y.level && !isC(x) && !isC(y)) : (x.level !== y.level ? pick.level === Math.max(x.level, y.level) : isC(pick)), `On Command (Lv4): ${x.name} / ${y.name} → ${pick.name}`); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3, 4]) { if ((seed + lv) % 4) continue; const c = mk(seed * 29 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 6).join(' | ')); fails++; } }
  ok(done === 12, `simulations finished: ${done} (wins ${win})`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (puppet king edelhardt)'); process.exit(fails ? 1 : 0);
