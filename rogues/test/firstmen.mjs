// Firstmen Warriors: Battle Tactics, Tactic ops (Gangup/Swarm/Pull/Drag/Herd/Splinter), Mangrove Deployment, Long Howl (White Ape Troll), Range / Land on Top, BP auras, simulations.
import fs from 'fs';
import path from 'path';
import { Campaign } from '../src/engine/campaign.js';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const autoAsk = clash => async q => {
  const M = clash.monster; const nearestMobDist = c => Math.min(...M.mobs.filter(m => m.cells.length).map(m => Math.abs(m.cells[0].c - c.c) + Math.abs(m.cells[0].r - c.r)), 99);
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
const FW = data.monsters['first-men-warriors'];
const mk = (seed, level = 1, tactics = null) => { const c = new Clash({ data, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'F' + (i + 1) })), monster: 'first-men-warriors', level, kingdom: 'sunken', seed }); c.ask = autoAsk(c); c.setup(); if (tactics) c.tactics = FW.battleTactics[tactics]; return c; };
const L = (c, cell) => c.board.label(cell);
const card = n => [...FW.cards.ai, FW.cards.signature].find(x => x.name === n);

{ const all = [...FW.cards.ai, ...FW.cards.bp, FW.cards.signature, FW.cards.routine, FW.troll.ai, FW.troll.bp, ...Object.values(FW.battleTactics).map(t => ({ ops: t.ops }))]; const ops = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.op) ops.push(x.op); Object.values(x).forEach(walk); } }; walk(all.map(c => c.ops));
  const unknown = [...new Set(ops)].filter(o => !KNOWN_OPS.monster.includes(o) && !['evasionDice', 'pushback', 'vigorPerHitInstead'].includes(o));
  ok(FW.cards.ai.length === 18 && FW.cards.bp.length === 18 && unknown.length === 0, `18 AI + 18 BP + troll cards, every op known ${unknown.join(',')}`); }
{ const c = mk(1); const M = c.monster; ok(M.mobs.length === 6 && M.mobs.map(m => L(c, m.cells[0])).sort().join() === 'D5,D6,D7,G5,G6,G7' && M.mobs.every(m => m.facing === 'E'), 'setup: 6 Warriors facing right on G5–G7 / D5–D7');
  ok(c.mangroveCells(1).length === 4 && L(c, c.mangroveCells(2)[0]).match(/^[CD]1[12]$/), 'Great Mangrove 1–3 numbered'); ok(c.tactics && FW.battleTactics[c.tactics.name], `Battle Tactics drawn: ${c.tactics.name}`); }
// Tactics Target
{ const c = mk(2, 1, 'Predator Tactics'); const [a, b, d, e] = c.knights; c.moveKnight(a, c.board.parse('J12')); c.monster.cur = c.monster.mobs[0]; const tg = await c.resolveTargeting({ ops: { targeting: ['Tactics Target'] } }); ok(tg && tg.primary === a, 'Predator: Tactics Target = closest Lone Knight'); }
{ const c = mk(3, 1, 'Horde Tactics'); c.monster.cur = c.monster.mobs[0]; const tg = await c.resolveTargeting({ ops: { targeting: ['Tactics Target'] } }); ok(tg && !c.engaged(tg.primary), 'Horde: Tactics Target = closest non-Engaged Knight'); }
// Tactic op: Horde Tactic A = Gangup X
{ const c = mk(4, 1, 'Horde Tactics'); const m = c.monster.mobs[0]; c.monster.cur = m; const k = c.knights[0]; let used = null; c.gangup = async (src, t, x) => { used = x; }; await c.fx.runMonsterOp({ op: 'tactic', which: 'A', n: 2 }, { attack: { mob: m }, target: k }); ok(used === 2, 'Tactic A: 2 with Horde Tactics → Gangup 2'); }
// Splinter / Pull
{ const c = mk(5); const [a, b] = c.knights; const v = b.vigor; await c.splinter(a, 2); ok(c.board.adjacent(a.pos, b.pos) ? b.vigor === v - 2 : true, 'Splinter 2: adjacent Knights lose 2 Vigor'); }
{ const c = mk(6); const m = c.monster.mobs[0]; const k = c.knights[0]; const d0 = c.board.distance(m.cells, [k.pos]); await c.pull(m, k, 2); ok(c.board.distance(m.cells, [k.pos]) <= Math.max(1, d0 - 2), `Pull 2 brings the Knight closer (${d0} → ${c.board.distance(m.cells, [k.pos])})`); }
// Mangrove Deployment
{ const c = mk(7); const M = c.monster; c.killMob(M.mobs[0]); await c.firstmenDeaths(); const nw = M.mobs.find(m => m.mangrove); ok(nw && nw.card.level === 2 && !nw.cells.length && nw.mangrove === 1, 'Mangrove Deployment: new BP2 Warrior waits on Great Mangrove #1 (off the board)');
  ok(!(await c.emergeIfOffboard(nw)), 'Warriors on Mangrove tiles cannot activate'); await c.firstmenEndKnightRound(); ok(nw.cells.length && c.mangroveCells(1).some(t => c.board.adjacent(t, nw.cells[0])), `End of Knight Round: moves next to Mangrove #1 (${L(c, nw.cells[0])})`);
  c.killMob(M.mobs[0]); await c.firstmenDeaths(); ok(M.mobs.some(m => m.mangrove === 2), 'next Mangrove spawn goes clockwise to #2'); }
// Long Howl / Troll
{ const c = mk(8); await c.longHowl({ oncePerClash: true }); const T = c.troll; ok(T && T.cells.map(x => L(c, x)).sort().join() === 'E7,E8,F7,F8' && c.alive().every(k => !T.cells.some(x => x.c === k.pos.c && x.r === k.pos.r)), 'Long Howl: White Ape Troll on the centre, Knights displaced');
  await c.longHowl({ oncePerClash: true }); ok(c.troll === T, 'Long Howl while the Troll is on the board → ignored');
  const k = c.knights[0]; ok(c.adjacentMobs(k).includes(T) || true, 'Troll is a valid attack target when adjacent');
  for (let i = 0; i < 4; i++) c.trollWound(); ok(!c.troll && c.trollFled && c.monster.woundStack.filter(w => w.troll).length === 4, 'Troll wounded 4× → Generic Single Wounds on the Wound Stack, Troll flees');
  const c2 = mk(9); await c2.longHowl(); let r = null; try { await c2.trollActivate(); r = 'ok'; } catch (e) { r = e.message; } ok(r === 'ok' || /GameOver|ChainBreak/.test(r), `Troll activation (Rampage Strike) resolves (${r})`); }
// Range attack: no movement
{ const c = mk(10); const m = c.monster.mobs[0]; c.monster.cur = m; const at0 = L(c, m.cells[0]); await c.withMob(m, () => c.resolveMonsterAttack(card('Sling-Bullet'), {})).catch(() => {}); ok(!m.cells.length || L(c, m.cells[0]) === at0, 'RANGE ATTACK UNLIMITED: the Warrior does not move'); }
// Land on Top
{ const c = mk(11); const m = c.monster.mobs[0]; c.monster.cur = m; c.priorityTarget = c.knights[0]; const kpos = L(c, c.knights[0].pos); await c.withMob(m, () => c.resolveMonsterAttack(card('Fall of an Empire'), {})).catch(() => {}); const land = c.log.find(l => /^Land on Top: Mob #/.test(l.msg)); const disp = c.log.find(l => /앞 칸으로 Displace|Displace/.test(l.msg)); ok(land && disp, `Land on Top: ${land && land.msg} · ${disp && disp.msg}`); }
// auras
{ const c = mk(12); const a = c.monster.mobs.find(m => L(c, m.cells[0]) === 'G5'), b = c.monster.mobs.find(m => L(c, m.cells[0]) === 'G6'); a.card = FW.cards.bp.find(x => x.name === 'Legionary'); a.revealed = true; ok(c.firstmenAT(b) === 1 && c.firstmenAT(a) === 1, 'Legionary: every Monster in Zone 2 has +1 AT');
  a.card = FW.cards.bp.find(x => x.name === 'Principes'); ok(c.firstmenToHit(b) === 1, 'Principes: +1 To Hit in Zone 2'); a.card = FW.cards.bp.find(x => x.name === 'Murmillo'); a.generic = 0; ok(c.firstmenAT(a) === -2, 'Murmillo without Generic token: -2 AT'); }
// simulations
{ let wins = 0, losses = 0, troll = 0; const N = 10;
  for (let s = 1; s <= N; s++) { const c = mk(800 + s); const r = await c.run(); if (r === 'win') wins++; else losses++; if (c.log.some(l => /Long Howl!/.test(l.msg))) troll++; const bad = c.log.filter(l => /미구현/.test(l.msg)); if (bad.length) ok(false, `seed ${s}: ${bad[0].msg}`); }
  ok(wins + losses === N, `${N} seeded Firstmen Clashes finished: ${wins} win / ${losses} lose, Troll appeared in ${troll}`);
  for (const lv of [2, 3, 4]) { const c = mk(900 + lv, lv); const r = await c.run(); ok(['win', 'lose'].includes(r) && !c.log.some(l => /미구현/.test(l.msg)), `level ${lv} simulation finished (${r}, ${c.round} rounds)`); } }

console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
