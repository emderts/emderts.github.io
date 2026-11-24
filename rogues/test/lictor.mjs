// Firstmen Lictor Hunters: data, Decoys (Taunt & Decoy, Seek & Destroy), Mangrove Deployment + Dwell, Battle Tactics, simulations.
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
const LH = data.monsters['first-men-lictor-hunters'];
const mk = (seed, level = 1, kingdom = 'sunken') => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'first-men-lictor-hunters', level, kingdom, seed }); c.ask = autoAsk(c); c.setup(); return c; };
const P = (c, l) => c.board.parse(l), L = (c, x) => c.board.label(x);
{ const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk([...LH.cards.ai, ...LH.cards.bp, LH.cards.signature, LH.cards.routine].map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o)); ok(LH.cards.ai.length === 18 && LH.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP, every op known ${unknown.join(',')}`); }
{ const tw = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) tw.push(x.op); Object.values(x).forEach(walk); } }; walk([...Object.values(LH.battleTactics), ...Object.values(LH.lh.advancedTactics)].map(t => [t.ops.A, t.ops.B])); ok(Object.keys(LH.battleTactics).length === 3 && Object.keys(LH.lh.advancedTactics).length === 3 && tw.every(o => KNOWN_OPS.monster.includes(o)), '3 basic + 3 advanced Battle Tactics, ops known'); }
{ const c = mk(1); const M = c.monster; ok(M.mobs.length === 10 && M.mobs.filter(m => m.decoying).length === 6 && M.mobs.filter(m => m.card.level === 2).length === 2 && !!c.tactics && c.tactics.kind === 'basic', `setup: 10 BP on the track, 4 Lictor Hunters + 6 Decoys, Battle Tactics ${c.tactics && c.tactics.name}`);
  ok(mk(1, 3).tactics.kind === 'advanced', 'Lv3 Advanced Tactics'); const dec = M.mobs.filter(m => m.decoying).map(m => L(c, m.cells[0])).sort().join(); ok(dec === 'B5,D6,F2,G5,I10,I5', `Decoys on the designated spaces (${dec})`); }
{ const c = mk(2); const M = c.monster; const real = M.mobs.find(m => !m.decoying); c.lhDecoy(real); ok(real.decoying && c.lh.tokens === 1 && c.mobAura('mobAttackVigor') === 1, 'Decoy keyword: the Lictor Hunter becomes a Decoy, Generic token 1 → +1 Vigor loss'); c.lhDecoy(real); ok(c.lh.tokens === 1, 'already Decoying → ignored');
  c.lhToken(); ok(c.lhDice() === 1, '2 tokens → +1 die'); c.lhToken(); c.lhToken(); ok(c.lh.pending4, '4 tokens → extra activation pending'); }
{ const c = mk(3); const M = c.monster, B = c.board; const k = c.knights[0]; const decs = M.mobs.filter(m => m.decoying).sort((a, b) => a.n - b.n); const X = decs.at(-1), Lm = decs[0]; const cell = { ...X.cells[0] }; const A = { mob: X, wounded: false };
  const r = await c.lhDecoyHit(k, A); ok(r === 'ok' && A.mob === Lm && Lm.cells[0].c === cell.c && Lm.cells[0].r === cell.r && A.lhDecoy, 'Seek & Destroy: a hit Decoy is paired with the leftmost unrevealed Decoying BP');
  c.lhAttach(A); ok(!Lm.decoying && Lm.mangrove === 1 && !Lm.cells.length, 'failed wound: base ring attached, the Lictor Hunter goes to Great Mangrove #1');
  await c.lhDwell(Lm); const t = Lm.cells.length && B.terrainAt(Lm.cells[0]); ok(!Lm.mangrove && t && t.id === 'swamp', `Dwell: moves to the closest unoccupied Swamp space (${Lm.cells.length && L(c, Lm.cells[0])})`);
  for (const m of M.mobs.filter(m => m.decoying)) m.revealed = true; let rout = 0; c.performRoutine = async () => { rout++; }; const r2 = await c.lhDecoyHit(k, { mob: M.mobs.find(m => m.decoying) }); ok(r2 === 'routine' && rout === 1, 'every Decoying BP already revealed → Routine'); }
{ const c = mk(4); const M = c.monster; const d = M.mobs.find(m => m.decoying && c.lhOnSwamp(m)); const d2 = M.mobs.find(m => !m.decoying); if (d) { const at0 = d.card.at + M.bonuses.at; c.poolAdd('fire', 1); ok(c.mobAT(d) === at0 - 1 && c.firstmenToHit(d) === 2 - 1, 'Decoy on a Swamp: -1 AT, +2 To Hit, -1 To Hit per Fire token'); } else ok(true, 'no Decoy on Swamp in this seed'); ok(c.firstmenToHit(d2) === 0, 'no modifier for a non-Decoy'); }
{ const c = mk(5); const M = c.monster; const m = M.mobs.find(x => !x.decoying); const lv = m.card.level; c.killMob(m); await c.firstmenDeaths(); const nm = M.mobs.find(x => x.mangrove); ok(!!nm && nm.card.level === Math.min(3, lv + 1) && nm.mangrove === 1, 'Mangrove Deployment: a killed Lictor Hunter is replaced on Great Mangrove #1 (BP one Level higher)');
  await c.firstmenEndKnightRound(); ok(!nm.mangrove && nm.cells.length === 1, 'End of Knight Round: Lictor Hunters on Great Mangroves perform Dwell'); }
{ let done = 0, win = 0; for (let seed = 1; seed <= 12; seed++) for (const lv of [1, 2, 3, 4]) { if ((seed + lv) % 3) continue; const c = mk(seed * 19 + lv, lv); try { const r = await c.run(); done++; if (r === 'win') win++; const bad = c.log.filter(l => /미구현 targeting/.test(l.msg)); if (bad.length) { console.log('WARN', bad[0].msg); fails++; } } catch (e) { console.log('ERR', seed, lv, e.stack.split('\n').slice(0, 5).join(' | ')); fails++; } }
  ok(done === 16, `simulations finished: ${done} (wins ${win})`); }
{ const sp = LH.cards.bp.find(x => x.name === 'Speculatore'); ok(sp.ops.overcome.n === 4, 'Speculatore Overcome 4+ (owner)'); }
{ // Toxic Gas — "Zone 2 / No Knight in Zone: This Mob performs Signature"
  const c = mk(31); const card = LH.cards.ai.find(x => x.name === 'Toxic Gas'); const mob = c.monster.mobs.find(m => m.cells && m.cells.length);
  await c.withMob(mob, async () => { const cells = c.board.zone(c.monster.cells, 2); const free = x => !c.board.terrainAt(x) && !c.monsterOccupies(x) && !c.knightAt(x); const far = []; for (let cc = 1; cc <= c.board.cols; cc++) for (let r = 1; r <= c.board.rows; r++) { const x = { c: cc, r }; if (!cells.some(y => y.c === cc && y.r === r) && free(x)) far.push(x); }
    c.knights.forEach((k, i) => c.moveKnight(k, far[far.length - 1 - i * 3])); const tg = await c.resolveTargeting(card); ok(tg && tg.signatureInstead === true, 'Toxic Gas with no Knight in Zone 2 → the Mob performs Signature');
    const near = cells.find(x => c.board.inside(x) && free(x)); c.moveKnight(c.knights[0], near); const tg2 = await c.resolveTargeting(card); ok(tg2 && !tg2.signatureInstead && tg2.targets.includes(c.knights[0]), 'Toxic Gas with a Knight in Zone 2 → Zone Attack'); }); }
{ // Death from Above — Targeting "Clash Board": After Attack Knockdown reaches every Knight wherever they stand; one REACT window
  const c = mk(33); const card = LH.cards.ai.find(x => /Knockdown/.test(x.afterAttack || '') && x.targeting.some(t => /clash board/i.test(t))); ok(!!card, 'card with Targeting "Clash Board" and After Attack Knockdown found: ' + (card && card.name));
  const mob = c.monster.mobs.find(m => m.cells && m.cells.length); let windows = 0; const s0 = c.say.bind(c); c.say = (m, ...r) => { if (/REACT! \(After Attack/.test(String(m))) windows++; return s0(m, ...r); };
  await c.withMob(mob, async () => { await c.resolveMonsterAttack(card, {}); }); const up = c.knights.filter(k => k.alive); ok(up.length > 0 && up.every(k => c.knockedDown(k)), `every surviving Knight is knocked down (${up.filter(k => c.knockedDown(k)).length}/${up.length})`); ok(windows === 1, `the REACT window before After Attack opens once, not per Knight (${windows})`); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (lictor hunters)'); process.exit(fails ? 1 : 0);
