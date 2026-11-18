// Panzergeists: data, Suit Up! Armor tokens, All Things Die / Rust, Maximum Vigor and Possession, Recover, simulations.
import fs from 'fs';
import path from 'path';
import { Clash } from '../src/engine/clash.js';
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
const PZ = data.monsters.panzergeists;
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'panzergeists', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...PZ.cards.ai, ...PZ.cards.bp, PZ.cards.signature, PZ.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o)); ok(PZ.cards.ai.length === 10 && PZ.cards.bp.length === 10 && unknown.length === 0, `10 AI + 10 BP, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.mobs.length === 10 && M.mobs.filter(m => m.card.level === 1).length === 5 && M.mobs.filter(m => m.card.level === 3).length === 2 && c.pzBoardTokens() === 10 && M.mobs.filter(m => m.tokens.length).length === 2, 'setup: 10 Geists (5 BP1, 3 BP2, 2 BP3), 10 Armor tokens on the Board, AI + S tokens'); }
{ const c = mk(2); const M = c.monster, B = c.board; const mob = M.mobs.find(m => L(c, m.cells[0]) === 'I3') || M.mobs[0]; const from = mob.cells[0]; c.mobStepTo(mob, P(c, 'F3')); await c.pzThrough(mob, from);
  ok(mob.armor >= 2 && !c.icdPiles().has(B.key(P(c, 'F3'))) && !c.icdPiles().has(B.key(P(c, 'H3'))), `Suit Up!: tokens on and through the path are picked up (Armor ${mob.armor})`);
  const at0 = c.mobAT(mob); const n = mob.armor; c.killMob(mob); ok(c.icdPiles().get(B.key(P(c, 'F3'))) === n && M.wounds >= 1, 'wounded Geist drops its Armor tokens on its space'); ok(at0 === mob.card.at + M.bonuses.at + n, 'each Armor token = +1 AT'); }
{ const c = mk(3); const M = c.monster; const k = c.knights[0]; const mob = M.mobs[0]; mob.armor = 0; const w = k.gear.find(g => g.type === 'weapon'); const A = { mob, weapon: w };
  const metal = c.fx.gearTraits(k, w).includes('Metal'); ok(c.pzToHit(k, A) === 4, 'All Things Die: +4 To Hit vs a Geist without Armor tokens (weapon without Rust/Ethereal/Holy)'); mob.armor = 1; ok(c.pzToHit(k, A) === 0, 'no penalty when the Geist has an Armor token'); mob.armor = 0;
  const b0 = k.bane; for (const g of k.gear) if (!c.fx.gearTraits(k, g).includes('Metal')) g._tempTraits = ['Metal']; await c.pzRust(k); ok(c.fx.gearTraits(k, w).includes('Rust') && !c.fx.gearTraits(k, w).includes('Metal') && k.bane > b0 && c.pzToHit(k, A) === 0, `Rust: Metal Gear gains Rust / loses Metal, Bane +${k.bane - b0}; rusted weapon removes the +4`); }
{ const c = mk(4); const M = c.monster; const k = c.knights[0]; const m0 = k.maxVigor; await c.pzLower(k, 3); ok(k.maxVigor === m0 - 3 && k.vigor === m0 - 3 && !k.possessed, 'Lower Maximum Vigor by 3');
  c.pzRecover(k, 2); ok(k.maxVigor === m0 - 1 && k.vigor === m0 - 1, 'Recover 2: Maximum Vigor +2, Vigor +2');
  const pos = { ...k.pos }; await c.pzLower(k, 99); const mob = k.possessed; ok(!!mob && mob.possess === k && mob.cells[0].c === pos.c && mob.cells[0].r === pos.r && !c.alive().includes(k) && !c.knightAt(pos), 'Ceaseless Hunger: Maximum Vigor 0 → the closest Mob possesses the Knight (Mob on the Knight space, Knight out of play)');
  c.killMob(mob); ok(!k.possessed && k.maxVigor === m0 && c.alive().includes(k), 'wounding that Mob breaks the Possession and resets Maximum Vigor'); }
{ const c = mk(5); for (const k of c.knights.slice(0, 3)) await c.pzLower(k, 99); let lost = false; try { await c.pzLower(c.knights[3], 99); } catch (e) { lost = c.result === 'lose'; } ok(lost, 'all Knights Possessed → the Clash is lost'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3, 4]) { if ((seed + lv) % 3) continue; const c = mk(seed * 11 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 5).join(' | ')); fails++; } }
  ok(done === 16, `simulations finished: ${done} (wins ${win})`); }
{ ok(PZ.cards.signature.evasionDice === 1 && PZ.cards.signature.evasionDifficulty === 11, 'Ghostly Miasma: 1 die, 11+');
  const c = mk(41); const k = c.knights[0]; const g = k.gear.find(x => !x.discarded); g.rustBane = 2; k.bane = 3; const asked = []; const a0 = c.ask; c.ask = async q => { if (/버릴 Bane/.test(q.text || '')) { asked.push(q.options.map(o => o.value)); return g.name; } return a0(q); };
  await c.pzDiscardBane(k, 1); ok(asked.length === 1 && asked[0].includes('') && asked[0].includes(g.name) && g.rustBane === 1 && k.bane === 2, 'Discard Bane: the player picks Gear or non-Gear tokens'); }
{ const c = mk(42, 4); const k = c.knights[0]; const mob = c.monster.mobs.find(m => m.cells.length); k.possessed = mob; mob.possess = k; const ks = c.pzTurnKnights(); ok(c.monster.hasTrait('No Rest for Any') ? ks.includes(k) : ks.length === 0, 'No Rest for Any: Possessed Knights take a (skipped) turn in the chosen order');
  let sig = 0; c.performSignature = async () => { sig++; }; await c.pzPossessedTurn(k); ok(sig === 1, 'the possessing Mob performs Signature at the start of that turn'); }
{ const c = mk(43); const B = c.board; const mob = c.monster.mobs.find(m => m.cells.length); for (const key of [...c.icdPiles().keys()]) c.icdClear(key); const from = mob.cells[0]; const to = { c: from.c + (from.c > 3 ? -2 : 2), r: from.r + (from.r > 2 ? -2 : 2) }; const a = { c: to.c, r: from.r }, b = { c: from.c, r: to.r };
  for (const m of c.monster.mobs) if (m !== mob && m.cells.length && [a, b, to].some(x => x.c === m.cells[0].c && x.r === m.cells[0].r)) { B.remove(m.cells); m.cells = []; }
  c.pzPut(a, 1); c.pzPut(b, 1); let seen = 0; const a0 = c.ask; c.ask = async q => { if (/이동 경로/.test(q.text || '')) { seen = q.options.length; return q.options[q.options.length - 1].value; } return a0(q); };
  B.remove(mob.cells); mob.cells = [to]; const ar0 = mob.armor; await c.pzThrough(mob, from); ok(seen >= 3 && mob.armor === ar0, `movement route is the player's choice (${seen} routes; picked the one without tokens)`); }
{ const c = mk(44); const k = c.knights[0]; k.possessed = c.monster.mobs[0]; c.pzEndOfClash(); ok(!k.alive && k.permMaxVigor === -1, 'End of Clash while Possessed: die and Maximum Vigor permanently -1');
  const c2 = new Clash({ data, knights: [{ def: 'fleischritter', name: 'X', maxVigorMod: -1 }, { def: 'fleischritter', name: 'Y' }], monster: 'panzergeists', level: 1, kingdom: 'sunken', seed: 3 }); c2.ask = autoAsk(c2); c2.setup(); ok(c2.knights[0].maxVigor === c2.knights[1].maxVigor - 1, 'the permanent Maximum Vigor penalty carries into later Clashes'); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (panzergeists)'); process.exit(fails ? 1 : 0);
