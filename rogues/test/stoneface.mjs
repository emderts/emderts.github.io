// Stoneface: data, Leash / Unleash, Bane and Unleash costs, Talents, Technique ops, full-Clash smoke runs.
import fs from 'fs';
import path from 'path';
import { Campaign } from '../src/engine/campaign.js';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
import { KARA_OPS } from '../src/engine/kara.js';
import { PARA_OPS } from '../src/engine/paracelsa.js';
import { SONCH_OPS } from '../src/engine/sonch.js';
import { UBAR_OPS } from '../src/engine/ubar.js';
import { STONE_OPS } from '../src/engine/stoneface.js';
import { parseGearText, parseSentence } from '../src/engine/gearkw.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const autoAsk = clash => async q => {
  const M = clash.monster; const nearestMobDist = c => Math.min(...M.cells.map(m => Math.abs(m.c - c.c) + Math.abs(m.r - c.r)), 99);
  switch (q.type) {
    case 'confirm': return q.default;
    case 'dice': { const k = q.knight ? clash.knights.find(x => x.id === q.knight) : null; let budget = q.max; if (k && /Evasion|Attack/.test(q.text)) budget = Math.min(budget, Math.max(0, k.heatLimit - k.heat - 1) + clash.poolCount('closing')); return q.dice.map((d, i) => ({ d, i })).filter(x => !x.d.hit && x.d.canReroll).slice(0, budget).map(x => x.i); }
    case 'number': return q.default ?? q.options.at(-1).value;
    case 'order': return q.options.map(o => o.value);
    case 'pick': { if (q.options.some(o => o.value === 'skip')) return 'skip'; return q.options[0].value; }
    case 'move': { if (!q.knight) return q.cells[0]; const k = clash.knights.find(x => x.id === q.knight); const best = [...q.cells].sort((a, b) => nearestMobDist(a) - nearestMobDist(b))[0]; return nearestMobDist(best) < nearestMobDist(k.pos) ? best : null; }
    case 'action': { const v = q.options.map(o => o.value); if (v.includes('attack')) return 'attack'; const k = clash.knights.find(x => x.id === q.knight); if (v.includes('move') && !clash.adjacentToMonster(k)) return 'move'; const pose = v.find(x => x.startsWith('tech:Knight Pose')); if (pose && clash.knockedDown(k)) return pose; return 'end'; }
    default: return q.options ? q.options[0].value : null;
  }
};
const K = data.knights.stoneface;
const mk = (seed, monster = 'eggknight', level = 1, over = {}) => { const c = new Clash({ data, knights: [{ def: 'stoneface', name: 'Stone', ...over }, { def: 'fleischritter', name: 'F1' }, { def: 'ser-ubar', name: 'Ubar' }, { def: 'kara', name: 'Kara' }], monster, level, kingdom: 'sunken', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const tech = (k, name) => { const t = { ...K.techniques.find(x => x.name === name) }; k.hand.push(t); return t; };
const yes = c => { c.ask = async q => q.type === 'confirm' ? true : q.options ? (q.options.find(o => o.value !== 'skip') || q.options[0]).value : q.cells ? q.cells[0] : null; };
const no = c => { c.ask = async q => q.type === 'confirm' ? false : q.options ? (q.options.find(o => o.value === 'skip') || q.options[0]).value : null; };

// ---- data ----
ok(K.techniques.length === 26 && K.heroicArcs.length === 8 && K.talents.length === 5 && K.portraits.length === 3, 'Stoneface: 26 Techniques, 8 Heroic Arcs, 5 Talents, 3 Portraits');
ok(data.knights.peril_arcs.arcs.stoneface.some(a => a.name === K.setup.perilArc) && K.heroicArcs.some(a => a.name === K.setup.heroicArc) && K.talents.some(t => t.name === K.setup.talent) && K.setup.techniques.every(n => K.techniques.some(t => t.name === n)), 'setup Talent / Heroic Arc / Peril Arc / Techniques exist');
{ const R = data.rosegraal.rewards; const names = [], arcs = [], ports = []; for (const lv of Object.values(R.levels)) { const v = lv.stoneface || {}; arcs.push(...(v.H || [])); for (const key of ['C', 'T']) for (const x of v[key] || []) (x.kind === 'technique' ? names : x.kind === 'portrait' ? ports : []).push(x.name); } const missT = names.filter(n => !K.techniques.some(t => t.name === n || t.name === n + ' Technique')); ok(names.length > 0 && missT.length === 0 && arcs.every(n => K.heroicArcs.some(a => a.name === n)) && ports.every(n => K.talents.some(t => t.name === n)), `every Rosegraal reward Technique / Heroic Arc / Talent of Stoneface exists ${missT.join(', ')}`); }
{ const bad = []; for (const t of K.techniques) for (const o of [...(t.ops || []), ...Object.values(t.gateOps || {}).flat()]) if (!Object.values(KNOWN_OPS).flat().includes(o.op) && !STONE_OPS.has(o.op) && !UBAR_OPS.has(o.op) && !SONCH_OPS.has(o.op) && !PARA_OPS.has(o.op) && !KARA_OPS.has(o.op)) bad.push(`${t.name}:${o.op}`); ok(bad.length === 0, `every Stoneface Technique op has a handler ${bad.join(', ')}`); }
{ const none = K.techniques.filter(t => !t.ops).map(t => t.name).sort().join('|'); ok(none === 'Knight Stand|My Turn|Take the Hit|Unshakeable|Vita Ex Mortis', `not yet implemented Techniques are exactly the listed five (${none})`); }
{ const c = mk(1); const k = c.knights[0]; ok(k.gear.some(g => g.name === 'Ragged Hauberk') && k.gear.some(g => g.name === 'Knighves') && k.hand.length === 5 && k.virtues.Fortitude === 1, 'Stoneface starts with Knighves, a Ragged Hauberk and 5 Techniques'); }

// ---- Leash / Unleash ----
{ const c = mk(2); const k = c.knights[0]; c.leash(k, 2); ok(k.leash === 2 && !c.canUnleash(k, 3) && c.canUnleash(k, 2), 'Leash X places Generic tokens; Unleash X needs X or more'); c.leash(k, 3); ok(c.unleash(k, 3) && k.leash === 0, 'Unleash discards all Generic tokens'); c.stoneMitigated(k, 2); ok(k.leash === 2, 'mitigating Vigor loss by 2 → Leash 2'); c.stoneMitigated(c.knights[1], 2); ok(!c.knights[1].leash, 'only Stoneface gains Leash from mitigation'); }
{ const c = mk(3); const k = c.knights[0]; const t = k.hand.find(x => x.name === 'Second Chance'); ok(c.fx.canPay(k, t.cost), 'Second Chance: "+1 Bane or Unleash 3" is payable with Bane'); k.bane = k.baneLimit; ok(!c.fx.canPay(k, t.cost), 'a Bane cost cannot exceed the Bane Limit'); k.leash = 3; ok(c.fx.canPay(k, t.cost), 'the Unleash alternative is payable with 3 Generic tokens'); const pc = await c.fx.chooseCost(k, t); c.fx.pay(k, pc.alt, pc.x); ok(k.leash === 0 && k.bane === k.baneLimit, 'paying Unleash 3 discards all Generic tokens'); }
{ const c = mk(4); const k = c.knights[0]; const t = tech(k, 'Scrape Clean'); ok(!c.fx.canPay(k, t.cost), 'Scrape Clean needs Heat 2 and Unleash 3 (both)'); k.leash = 4; ok(c.fx.canPay(k, t.cost), 'Scrape Clean is payable with 4 Generic tokens'); }

// ---- Talents ----
{ const c = mk(5); const k = c.knights[0]; yes(c); const g = k.gear.find(x => x.type === 'armor'); k.reinforce = null; await c.stoneDefense(k); ok(g.exhausted && k.reinforce.red >= 1, 'Shell of Stone: exhaust the Armor to Reinforce 1'); const d = c.fx.armorDice(k); ok(d.red >= 2, 'Shell of Stone: the exhausted Armor still gives its Armor dice for this roll'); }
{ const c = mk(6, 'eggknight', 1, { talent: 'Obedient Son' }); const k = c.knights[0]; k.actions = { move: true, combat: true }; k.freeUsed = new Set(); ok(!c.fx.freeActions(k).some(a => a.id === 'stone:rush'), 'Rolling Stone is not offered below 5 Generic tokens'); k.leash = 5; ok(c.fx.freeActions(k).some(a => a.id === 'stone:rush'), 'Rolling Stone: Unleash 5 → Rush offered'); }
{ const c = mk(7, 'eggknight', 1, { talent: 'No Strings on Me' }); const k = c.knights[0]; k.leash = 9; c.poolAdd('break', 3); k.actions = { move: true, combat: true }; await c.fx.doFreeAction(k, 'stone:hope'); ok(c.poolCount('hope') === 3 && c.poolCount('break') === 0 && k.leash === 0, 'Undying Hope: Unleash 9 → all Break tokens become Hope'); const o = c.knights[1]; c.moveKnight(o, c.board.neighbors(k.pos).find(x => !c.knightAt(x) && !c.board.isObstacle(x) && !c.monsterOccupies(x))); const b0 = k.bane; yes(c); for (const x of c.knights) x._flowUsed = true; await c.fx.doFreeAction(k, 'stone:throw'); ok(k.bane === b0 + 1 && k.leash === k.bane, 'Tremortrial Throw: +1 Bane, the adjacent Knight is moved, Leash X (X = Bane tokens)'); }
{ const c = mk(8); const k = c.knights[0]; ok(c.stoneAccursed(k) === 1 && c.stoneAccursed(c.knights[1]) === 0, 'Accursed Strength: ignore up to -1 Speed penalty from Gear'); }

// ---- Techniques ----
{ const c = mk(9); const k = c.knights[0]; const t = k.hand.find(x => x.name === 'Granite Guardian'); k.hand = [t]; yes(c); await c.paraDefense(k); ok(k._defGuard === 2 && k.leash === 1 && k.delay.includes(t), 'Granite Guardian: Guard 2 and Leash 1'); }
{ const c = mk(10); const k = c.knights[0]; const t = tech(k, 'Hard Headed'); k.hand = [t]; k.leash = 2; yes(c); k.reinforce = null; await c.paraDefense(k); ok(k.reinforce.black === 2 && k.leash === 0, 'Hard Headed: Unleash 2 → Advanced Reinforce 2'); }
{ const c = mk(11); const k = c.knights[0]; const t = tech(k, 'Impossible to Ignore'); const p0 = k.passion; yes(c); await c.fx.useTechnique(k, t); ok(k.passion === p0 + 1 && c.priorityTarget === k && k.leash === 2, 'Impossible to Ignore: +1 Passion, Priority Target, Leash 2'); }
{ const c = mk(12); const k = c.knights[0]; const t = tech(k, 'Eshin Ishitsugi Technique'); k.vigor = 1; const b0 = k.bane; await c.fx.useTechnique(k, t); ok(k.vigor === 6 && k.bane === b0 + 1, 'Eshin Ishitsugi Technique: 3 Heat + 1 Bane → +5 Vigor'); }
{ const c = mk(13); const k = c.knights[0]; const t = tech(k, 'Avalanche Hammerstrike'); k.leash = 6; yes(c); await c.stoneOp(t.ops[0], k, {}); ok(k.pendingAttackRerolls === 2 && k.pendingPowerRerolls === 2 && c.poolCount('hope') === 1 && k.leash === 0, 'Avalanche Hammerstrike: Unleash 6 → Attack Re-roll 2, Power Re-roll 2, Auto-hope 1'); const c2 = mk(13); const k2 = c2.knights[0]; no(c2); await c2.stoneOp(t.ops[0], k2, {}); ok(k2.pendingAttackRerolls === 1 && c2.poolCount('break') === 1, 'Avalanche Hammerstrike: Attack Re-roll 1, Power Re-roll 1, Auto-break 1'); }
{ const c = mk(14); const k = c.knights[0]; const t = tech(k, 'Unstoppable Force'); yes(c); const A = {}; await c.stoneFullMiss(k, A); ok(A.keepPool === true && k.leash === 2, 'Unstoppable Force: skip Clear the Knight Pool after a Full Miss, Leash 2'); }
{ const c = mk(15); const k = c.knights[0]; const t = k.hand.find(x => x.name === 'Knight Pose'); k.leash = 7; await c.addCondition(k, 'Knockdown (Falling Down)'); yes(c); await c.fx.useTechnique(k, t); ok(!c.knockedDown(k) && k.hand.includes(t) && k.leash === 0, 'Knight Pose: stand up; Unleash 7 keeps the Technique in hand'); }
{ const c = mk(16); const k = c.knights[0], o = c.knights[1]; const t = k.hand.find(x => x.name === 'Gather No Moss'); c.moveKnight(o, c.board.neighbors(k.pos).find(x => !c.knightAt(x) && !c.board.isObstacle(x) && !c.monsterOccupies(x))); yes(c); await c.stoneMoveAction(o); ok(o.moveBoost === 1 && k.leash === 1 && k.cooldown.includes(t), 'Gather No Moss: an adjacent Knight performing a Move action gains +1 Speed; Leash 1'); }
{ const c = mk(17); const k = c.knights[0]; const t = tech(k, 'Split the Heavens'); const s0 = c.fx.speed(k); yes(c); await c.fx.useTechnique(k, t); ok(k.leash === 2 && c.fx.speed(k) === s0 + 2 && c.poolCount('hope') === 1, 'Split the Heavens: Leash 2; exhaust the Armor for +2 Speed, Spotlight, Auto-hope 1'); }
{ const R = data.knights.stoneface.heroicArcs.flatMap(a => [...a.levels.flatMap(l => l.options.flat()), ...((a.plus && a.plus.ops) || [])]); ok(R.some(t => t.token === 'Pull') && R.some(t => t.token === 'Knockback') && c0().fx.arcStage('Pull') === 'first' && c0().fx.arcStage('Knockback') === 'first', 'Heroic Arc tokens Pull / Knockback resolve in the first ability window'); function c0() { return mk(18); } }

// ---- full Clashes ----
for (const [seed, mon, tal, arc, por] of [[101, 'eggknight', 'Knight of Stone', 'Knight of Stone', 'knight-of-stone'], [102, 'ironcast-dead', 'Obedient Son', 'Obedient Son', 'obedient-rebellious'], [103, 'eggknight', 'Rebellious Child', 'Rebellious Child', 'obedient-rebellious'], [104, 'white-ape-troll', 'No Strings on Me', 'No Strings on Me', 'nostrings-mangiarovina'], [105, 'eggknight', 'Mangiarovina', 'Mangiarovina', 'nostrings-mangiarovina'], [106, 'knight-of-the-fen', 'Knight of Stone', 'Tableau Vivant', 'knight-of-stone'], [107, 'winged-nightmare', 'Rebellious Child', 'Marble Marionette', 'knight-of-stone'], [108, 'pumpkinhead-monstrosities', 'Obedient Son', 'Good, Strong Hands', 'knight-of-stone']]) {
  let res = null, err = null; try { const c = mk(seed, mon, 1, { talent: tal, heroicArc: arc, portrait: por }); const k = c.knights[0]; for (const t of K.techniques) if (!k.hand.some(h => h.name === t.name)) k.hand.push({ ...t }); k.leash = 6; let n = 0; c.ask = async q => { if (q.type === 'confirm') return /사용\?|Unleash|Martial|Shell|이동\?/.test(q.text) ? true : q.default; if (/시작하는 형태/.test(q.text || '')) return 'human'; if (q.type === 'action' && n++ % 3 === 0) { const f = q.options.find(o => String(o.value).startsWith('tech:') || String(o.value).startsWith('free:stone:')); if (f) return f.value; } return autoAsk(c)(q); }; res = await c.run(); } catch (e) { err = e; }
  ok(!err && res, `full Clash with Stoneface (${tal} / ${arc} vs ${mon}) completes${err ? ' — ' + (err.stack || err.message).split('\n').slice(0, 3).join(' | ') : ` (${res})`}`);
}
{ const camp = new Campaign(data, { seed: 5, knights: [{ def: 'stoneface' }, { def: 'ser-ubar' }, { def: 'ser-sonch' }, { def: 'paracelsa' }] }); ok(camp.knights[0].def === 'stoneface' && camp.knights[0].loadout.talent === 'Knight of Stone' && camp.knights[0].loadout.techniques.length === 5, 'Campaign with Stoneface is created (Knight of Stone, 5 Techniques)'); }
{ const ids = Object.keys(data.knights).filter(id => data.knights[id].setup).sort().join(','); ok(ids === 'fleischritter,kara,paracelsa,renholder,ser-sonch,ser-ubar,stoneface', `all seven Knights are available (${ids})`); }
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS (stoneface)'); if (fails) process.exit(1);
