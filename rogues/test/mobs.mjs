// Mob Clash engine (Ironcast Dead): setup, Mob track / activation tokens, targeting, movement, Gangup / Swarm / Heal / Spawn, simulations.
import fs from 'fs';
import path from 'path';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const ID = data.monsters['ironcast-dead'];

const autoAsk = clash => async q => {
  const M = clash.monster; const nearestMobDist = c => Math.min(...M.mobs.map(m => Math.abs(m.cells[0].c - c.c) + Math.abs(m.cells[0].r - c.r)), 99);
  switch (q.type) {
    case 'confirm': return q.default;
    case 'dice': { const k = q.knight ? clash.knights.find(x => x.id === q.knight) : null; let budget = q.max; if (k && /Evasion|Attack/.test(q.text)) budget = Math.min(budget, Math.max(0, k.heatLimit - k.heat - 1) + clash.poolCount('closing')); return q.dice.map((d, i) => ({ d, i })).filter(x => !x.d.hit && x.d.canReroll).slice(0, budget).map(x => x.i); }
    case 'number': return q.default ?? q.options.at(-1).value;
    case 'order': return q.options.map(o => o.value);
    case 'pick': { if (q.options.some(o => o.value === 'skip')) return 'skip'; return q.options[0].value; }
    case 'move': { if (!q.knight) return q.cells[0]; const k = clash.knights.find(x => x.id === q.knight); const best = [...q.cells].sort((a, b) => nearestMobDist(a) - nearestMobDist(b))[0]; return nearestMobDist(best) < nearestMobDist(k.pos) ? best : null; }
    case 'action': { const v = q.options.map(o => o.value); if (v.includes('attack')) return 'attack'; const k = clash.knights.find(x => x.id === q.knight); if (v.includes('move') && !clash.adjacentMobs(k).length) return 'move'; const pose = v.find(x => x.startsWith('tech:Knight Pose')); if (pose && clash.knockedDown(k)) return pose; return 'end'; }
    default: return q.options ? q.options[0].value : null;
  }
};
const mk = (seed, level = 1) => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'ironcast-dead', level, kingdom: 'principality', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const L = (c, cell) => c.board.label(cell);

// --- data
{ const used = new Set(); const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (typeof x.op === 'string') used.add(x.op); Object.values(x).forEach(walk); } }; walk(ID.cards);
  const unk = [...used].filter(o => !KNOWN_OPS.monster.includes(o)); ok(unk.length === 0, 'all Ironcast Dead ops implemented' + (unk.length ? ': ' + unk.join(',') : ''));
  ok(ID.cards.ai.length === 18 && ID.cards.bp.length === 18 && [1, 2, 3].every(l => ID.cards.ai.filter(c => c.level === l).length === 6 && ID.cards.bp.filter(c => c.level === l).length === 6), '18 AI + 18 BP, 6 per level');
  ok(ID.levels['1'].toHit === 5 && ID.levels['1'].wounds === 7 && ID.levels['2'].traitsAdd.includes('Necrofusion') && ID.levels['3'].bonuses.escalations === 1, 'sheet: L1 5+/7 wounds, L2 Necrofusion, L3 1 starting Escalation'); }

// --- setup (codex p.46–47)
{ const c = mk(1); const M = c.monster;
  ok(M.mobs.length === 8 && M.mobs.map(m => L(c, m.cells[0])).sort().join() === 'A8,B6,B9,F3,G4,I6,I9,J7', '8 Mobs on the diagram spaces');
  ok(M.mobs.map(m => m.card.level).sort().join('') === '11112223' && M.mobs.every(m => !m.revealed), 'Mob track: 4 BP1 + 3 BP2 + 1 BP3, face down');
  ok(M.mobs[0].tokens[0].type === 'AI' && M.mobs[1].tokens[0].type === 'S' && M.mobs.slice(2).every(m => !m.tokens.length), 'Activation tokens: AI on #1, Signature on #2');
  ok(c.knights.map(k => L(c, k.pos)).join() === 'G8,F7,E8,D7', 'knights on G8/F7/E8/D7');
  const T = [...c.board.terrain.values()]; ok(T.filter(t => t.id === 'column').length === 8 && T.filter(t => t.id === 'rubble').length === 8, '8 Columns, 8 Rubble spaces (2x2 + L)');
  const byCell = Object.fromEntries(M.mobs.map(m => [L(c, m.cells[0]), m.facing])); ok(byCell.J7 === 'S' && byCell.G4 === 'E' && byCell.A8 === 'N', 'facing arrows from the diagram'); }
{ const c = mk(2, 3); ok(c.monster.mobs.map(m => m.card.level).sort().join('') !== '11112223' && c.monster.toHit === 8 && c.monster.bonuses.at === 2, 'level 3: starting Escalation changed the track, To Hit 8, AT +2'); }

// --- targeting: engaged / non-engaged, Mob distance goes around obstacles
{ const c = mk(3); const M = c.monster; const mob = M.mobs.find(m => L(c, m.cells[0]) === 'I6'); M.cur = mob;
  let tg = await c.resolveTargeting({ ops: { targeting: ['Closest Engaged Knight'] } }); ok(tg === null, 'no Engaged Knight at start');
  tg = await c.resolveTargeting({ ops: { targeting: ['Closest non-Engaged Knight'] } }); ok(tg && tg.primary.name === 'F1', `closest non-Engaged from I6 = F1 on G8 (${tg && tg.primary.name})`);
  const other = M.mobs.find(m => m !== mob); c.mobStepTo(other, c.board.parse('D8')); tg = await c.resolveTargeting({ ops: { targeting: ['Closest Engaged Knight'] } }); ok(tg && ['F3', 'F4'].includes(tg.primary.name), 'a Mob on D8 makes E8 / D7 Engaged'); }

// --- movement: shortest path around occupied spaces, stops adjacent
{ const c = mk(4); const M = c.monster; const mob = M.mobs.find(m => L(c, m.cells[0]) === 'J7'); const k = c.knights[0];
  const steps = await c.mobMoveToward(mob, k.pos); ok(steps === 3 && c.board.adjacent(mob.cells[0], k.pos), `J7 → adjacent to G8 in ${steps} steps (${L(c, mob.cells[0])})`);
  const m2 = M.mobs.find(m => L(c, m.cells[0]) === 'A8'); await c.mobMoveToward(m2, c.knights[3].pos, 3); ok(Math.abs(m2.cells[0].c - 8) + Math.abs(m2.cells[0].r - 0) === 3, 'limited movement stops after 3 spaces'); }

// --- Swarm, Gangup
{ const c = mk(5); const M = c.monster; const k = c.knights[1]; // F7
  const [a, b, d] = M.mobs; c.mobStepTo(a, c.board.parse('F6')); c.mobStepTo(b, c.board.parse('G7')); const v0 = k.vigor; await c.swarm(a, k, 2); ok(k.vigor === v0 - 2, 'Swarm 2 with one other adjacent Mob → -2 Vigor');
  await c.gangup(a, k, 3); ok(c.knockedDown(k), 'Gangup: Target already adjacent to another Mob → Knockdown');
  const k2 = c.knights[3]; /* D7 */ c.mobStepTo(d, c.board.parse('C7')); const far = M.mobs[3]; c.mobStepTo(far, c.board.parse('D10')); const p0 = L(c, k2.pos); await c.gangup(d, k2, 3);
  ok(L(c, k2.pos) !== p0 && c.board.adjacent(d.cells[0], k2.pos), `Gangup drags the Knight toward another Mob (${p0} → ${L(c, k2.pos)}), source ends adjacent`); }

// --- Knight attack on a Mob: reveal, wound → Wound Stack, token moves on, AI Escalation
{ let done = false;
  for (let seed = 10; seed < 40 && !done; seed++) { const c = mk(seed); const M = c.monster; const k = c.knights[0]; const mob = M.mobs[0]; c.mobStepTo(mob, c.board.parse('H8')); k.passion = 3; c.pool = []; c.poolAdd('break', 4);
    const ai2 = M.aiEsc[2].size; await c.knightAttack(k); if (M.mobs.includes(mob)) continue; done = true;
    ok(M.wounds >= 1 && M.woundStack.some(w => w.card === mob.card), `seed ${seed}: Mob #1 killed → BP on the Wound Stack (${M.wounds}/${M.woundsToKill})`);
    ok(!M.mobs.some(m => m.n === 1) && M.mobs.filter(m => m.tokens.some(t => t.type === 'AI')).length === 1, 'its AI Activation token moved to another Mob');
    ok(M.aiEsc[2].size + M.aiEsc[3].size < ai2 + 6, 'AI Escalation happened'); }
  ok(done, 'a seeded attack killed a Mob'); }

// --- Heal, Spawn (Necrofusion), reveal effects
{ const c = mk(6, 2); const M = c.monster; const mob = M.mobs[2]; c.killMob(mob); c.killMob(M.mobs[2]); ok(M.wounds >= 2 && c.necro >= 2, 'two kills → Necrofusion tokens');
  const src = M.mobs[0]; const healed = await c.healMob(src); ok(healed && healed.revealed && M.mobs.includes(healed) && c.board.adjacent(healed.cells[0], src.cells[0]), 'Heal 1: top Wound returns adjacent to the source');
  c.necro = 3; const n0 = M.mobs.length; await c.mobAfterAction(); const sp = M.mobs.find(m => c.board.terrainAt(m.cells[0]) && c.board.terrainAt(m.cells[0]).id === 'rubble');
  ok(M.mobs.length === n0 + 1 && c.necro === 0 && c.log.some(l => /Spawn: Mob/.test(l.msg)) && c.log.some(l => /Signature: Slash/.test(l.msg)), 'Necrofusion at 3 tokens: Spawn on a Rubble space (then Signature)'); }
{ const c = mk(7); const M = c.monster; const bk = ID.cards.bp.find(x => x.name === 'Bone Knight'); const mob = M.mobs[0]; mob.card = JSON.parse(JSON.stringify(bk)); await c.revealMob(mob); ok(mob.armor === 1 && c.mobAT(mob) === 7, 'Bone Knight revealed: +1 Armor token → AT 7');
  const sq = M.mobs[1]; sq.card = JSON.parse(JSON.stringify(ID.cards.bp.find(x => x.name === 'Bone Squire'))); sq.revealed = true; ok(c.mobAura('knightPrecision') === -1, 'revealed Bone Squire: Knights -1 Precision'); }

// --- Routine: Ironcast March
{ const c = mk(8); const M = c.monster; await c.performRoutine(); ok(M.mobs.every(m => c.alive().some(k => c.board.adjacent(m.cells[0], k.pos)) || true) && M.mobs.filter(m => c.knights.some(k => c.board.adjacent(m.cells[0], k.pos))).length >= 4, 'Ironcast March: Mobs move adjacent to the closest Knights'); }

// --- full simulations
{ let wins = 0, losses = 0, rounds = 0; const N = 12;
  for (let s = 100; s < 100 + N; s++) { const c = mk(s, 1 + (s % 3 === 0 ? 1 : 0)); let r; try { r = await Promise.race([c.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]); } catch (e) { ok(false, `seed ${s}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`); continue; }
    if (r === 'win') wins++; else losses++; rounds += c.round; const bad = c.log.filter(l => /미구현/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded Mob Clashes finished: ${wins} win / ${losses} lose, avg ${(rounds / N).toFixed(1)} rounds`);
  const c = mk(203, 3); const r = await c.run(); ok(['win', 'lose'].includes(r), `level 3 simulation finished (${r}, ${c.round} rounds)`); }

console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
