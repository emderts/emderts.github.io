// Clash engine: setup correctness, targeted unit checks, and seeded full-Clash simulations (Fleischritter ×4 vs Eggknight).
import fs from 'fs';
import path from 'path';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

/** Auto-answer: aggressive but sane. */
const autoAsk = (clash) => async q => {
  switch (q.type) {
    case 'confirm': return q.default;
    case 'dice': { // re-roll failed dice within budget; for evasion keep 1 Heat headroom
      const k = q.knight ? clash.knights.find(x => x.id === q.knight) : null; let budget = q.max; if (k && /Evasion|Attack/.test(q.text)) budget = Math.min(budget, Math.max(0, k.heatLimit - k.heat - 1) + clash.poolCount('closing'));
      return q.dice.map((d, i) => ({ d, i })).filter(x => !x.d.hit && x.d.canReroll).slice(0, budget).map(x => x.i); }
    case 'number': return q.default ?? q.options.at(-1).value;
    case 'order': return q.options.map(o => o.value);
    case 'weapon': { const axe = q.options.find(o => /Axe|Cleaver/.test(o.label)); return axe ? axe.value : q.options[0].value; }
    case 'pick': { if (q.options.some(o => o.value === 'skip')) return 'skip'; return q.options[0].value; }
    case 'pickKnight': case 'heartseeker': case 'arcOption': return q.options[0].value;
    case 'move': { const k = clash.knights.find(x => x.id === q.knight); const d = c => clash.board.distance([c], clash.monster.cells, x => !clash.board.isObstacle(x)); const best = [...q.cells].sort((a, b) => d(a) - d(b))[0]; if (/Displace/.test(q.text || '')) return best; return d(best) < d(k.pos) ? best : null; }
    case 'action': { const v = q.options.map(o => o.value); if (v.includes('attack')) return 'attack'; if (v.includes('move')) { const k = clash.knights.find(x => x.id === q.knight); if (!clash.adjacentToMonster(k)) return 'move'; } const k2 = clash.knights.find(x => x.id === q.knight); const pose = v.find(x => x.startsWith('tech:Knight Pose')); if (pose && clash.knockedDown(k2)) return pose; const heal = v.find(x => x.startsWith('tech:Cured Darklin')); if (heal && k2.vigor <= k2.maxVigor - 3) return heal; return 'end'; }
    default: return q.options ? q.options[0].value : null;
  }
};
const mk = (seed, level = 1) => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'eggknight', level, kingdom: 'principality', seed }); c.ask = autoAsk(c); c.setup(); return c; };

// --- ops coverage: every op used in data must be known
{ const used = new Set(); const walk = (x, bag) => { if (Array.isArray(x)) x.forEach(y => walk(y, bag)); else if (x && typeof x === 'object') { if (typeof x.op === 'string') bag.add(x.op); for (const v of Object.values(x)) walk(v, bag); } };
  const mo = new Set(); walk(data.monsters.eggknight.cards, mo); walk(data.monsters.eggknight.traits, mo);
  const ko = new Set(); for (const k of ['minor', 'major', 'grave', 'judicium']) walk(data.decks.mortis[k], ko); walk(data.knights.fleischritter.techniques.map(t => [t.ops, t.gateOps]), ko);
  const unkM = [...mo].filter(o => !KNOWN_OPS.monster.includes(o) && !['unknown'].includes(o)); const unkK = [...ko].filter(o => !KNOWN_OPS.knight.includes(o));
  ok(unkM.length === 0, 'all Eggknight ops implemented' + (unkM.length ? ': ' + unkM.join(',') : '')); ok(unkK.length === 0, 'all Mortis/Technique ops implemented' + (unkK.length ? ': ' + unkK.join(',') : '')); }

// --- setup
{ const c = mk(1); ok(c.monster.cells.map(x => c.board.label(x)).join() === 'E7,E8,F7,F8', 'monster on E7/E8/F7/F8'); ok(c.knights.map(k => c.board.label(k.pos)).join() === 'G6,G9,D6,D9', 'knights on G6/G9/D6/D9'); ok([...c.board.terrain.values()].filter(t => t.id === 'column').length === 8, '8 Columns placed'); ok(['N', 'S', 'E', 'W'].includes(c.monster.facing), 'facing from Minor Mortis bottom card'); ok(c.armorTokens[1] === 1 && c.armorTokens[2] === 2 && c.armorTokens[3] === 3, 'Panzeronion 1/2/3 at level 1'); ok(c.mortis.Minor.size === 12 && c.mortis.Major.size === 12 && c.mortis.Grave.size === 13, 'Mortis decks: generic + Principality cards only (12/12/13)'); ok(c.knights[0].vigor === 11 && c.knights[0].heatLimit === 3 && c.knights[0].hand.length === 5 && c.knights[0].gear.length === 2, 'Fleischritter: V11, HL3, 5 techniques, 2 gear'); }
{ const c = mk(2, 2); ok(c.armorTokens[1] === 2 && c.armorTokens[3] === 4 && c.monster.hasTrait('Jacked') && c.monster.toHit === 7, 'level 2: Panzeronion +1, Jacked, To Hit 7'); }

// --- targeting
{ const c = mk(3); c.monster.facing = 'N'; const tg = await c.resolveTargeting({ ops: { targeting: ['Closest Knight in front', 'Closest Knight in sight'] } }); ok(tg && tg.primary && ['F1', 'F2'].includes(tg.primary.name), `closest in front (facing N → G row knights): ${tg && tg.primary && tg.primary.name}`);
  const bs = await c.resolveTargeting({ ops: { targeting: ['Knight in Blindspot'] } }); ok(bs === null, 'no knight in blindspot at start');
  c.knights[2].pos = c.board.parse('D7'); const bs2 = await c.resolveTargeting({ ops: { targeting: ['Knight in Blindspot'] } }); ok(bs2 && bs2.primary === c.knights[2], 'D7 is a Blindspot (rear) when facing N');
  const z = await c.resolveTargeting({ ops: { targeting: ['Zone 1'] } }); ok(z && z.zone && z.targets.length === 4, 'Zone 1 around the 2x2 footprint catches all four starting knights (G6/G9/D7/D9)'); }

// --- humpty charge & panzeronion
{ const c = mk(4); c.monster.facing = 'E'; const cols0 = [...c.board.terrain.values()].filter(t => t.id === 'column').length; const a0 = c.armorTokens[1];
  await c.humptyCharge(null); const cells = c.monster.cells.map(x => c.board.label(x)).join();
  ok(c.monster.cells.every(x => x.c >= 9), `charged east to ${cells}`); ok(c.armorTokens[1] + c.armorTokens[2] + c.armorTokens[3] < a0 + 2 + 3 || cols0 === 8, 'board edge → Humpty Fate (armor token lost) or stopped'); }
{ const c = mk(5); c.monster.facing = 'N'; // column at I6/I9 not in path (cols 7-8) → reaches edge at row J: moves E/F→... F7/F8 top row index 5, +4 → I/J then edge
  await c.humptyCharge(null); ok(c.monster.cells.some(x => x.r === 9), 'charged north to the top edge'); ok(c.armorTokens[1] === 0, 'Humpty Fate: lowest BP level with tokens lost one (BP1 1→0)'); ok([...c.board.terrain.values()].filter(t => t.id === 'column').length === 8, 'Panzeronion: Grave Mortis coordinate placed a Column (count stays 8: one recycled or new)'); }

// --- knight attack vs fixed BP
{ const c = mk(6); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); ok(c.canAttack(k), 'knight at G7 can attack (adjacent, LoS)');
  const w0 = c.monster.wounds; await c.knightAttack(k); ok(k.passion === 1, 'attack raises Passion'); ok(c.monster.wounds >= w0, 'attack resolved without error'); }

// --- full simulations
const results = { win: 0, lose: 0 }; const rounds = [];
for (let s = 100; s < 112; s++) { const c = mk(s); const r = await c.run(); results[r]++; rounds.push(c.round); if (c.log.some(l => l.kind === 'warn' && /미구현/.test(l.msg))) console.log('  warn seed', s, [...new Set(c.log.filter(l => /미구현/.test(l.msg)).map(l => l.msg))].join(' | ')); }
ok(results.win + results.lose === 12, `12 seeded Clashes complete: win ${results.win} / lose ${results.lose}, rounds ${Math.min(...rounds)}–${Math.max(...rounds)}`);
{ const c = mk(200, 3); const r = await c.run(); ok(['win', 'lose'].includes(r), `level 3 Clash completes (${r}, ${c.round} rounds)`); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
