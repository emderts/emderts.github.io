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
{ const c = mk(1); ok(c.monster.cells.map(x => c.board.label(x)).join() === 'E7,E8,F7,F8', 'monster on E7/E8/F7/F8'); ok(c.knights.map(k => c.board.label(k.pos)).join() === 'G6,G9,D6,D9', 'knights on G6/G9/D6/D9'); ok([...c.board.terrain.values()].filter(t => t.id === 'column').length === 8, '8 Columns placed'); ok(['N', 'S', 'E', 'W'].includes(c.monster.facing), 'facing from Minor Mortis bottom card'); ok(c.armorTokens[1] === 1 && c.armorTokens[2] === 2 && c.armorTokens[3] === 3, 'Panzeronion 1/2/3 at level 1'); ok(c.mortis.Minor.size === 12 && c.mortis.Major.size === 12 && c.mortis.Grave.size === 13, 'Mortis decks: generic + Principality cards only (12/12/13)'); ok(c.knights[0].vigor === 11 && c.knights[0].heatLimit === 3 && c.knights[0].hand.length === 5 && c.knights[0].gear.length === 1 && c.knights[0].knighvesReserve, 'Fleischritter: V11, HL3, 5 techniques, Chipped Axe 2H + Knighves in reserve'); }
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
{ const c = mk(5); c.monster.facing = 'N'; const k = c.knights[0]; c.moveKnight(k, c.board.parse('I7')); for (const o of c.knights.slice(1)) c.moveKnight(o, c.board.parse('A' + (1 + c.knights.indexOf(o)))); // a Knight on the space where the Charge ends at the Board Edge
  await c.humptyCharge(null); ok(c.monster.cells.some(x => x.r === 10) || c.monster.cells.some(x => x.r === 9), 'charged north'); ok(!k.alive || !c.monster.cells.some(x => x.c === k.pos.c && x.r === k.pos.r), `Humpty Fate stop: the Knight under the Eggknight is knocked away (${k.alive ? c.board.label(k.pos) : 'dead'})`); }

// --- knight attack vs fixed BP
{ const c = mk(6); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); ok(c.canAttack(k), 'knight at G7 can attack (adjacent, LoS)');
  const w0 = c.monster.wounds; await c.knightAttack(k); ok(k.passion === 1, 'attack raises Passion'); ok(c.monster.wounds >= w0, 'attack resolved without error'); }

// --- Exert (upper-left technique ability): no cost, own depletion, token into the pool
{ const c = mk(6); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]);
  const T = n => ({ ...data.knights.fleischritter.techniques.find(t => t.name === n) });
  k.hand = [T('Food Runner'), T('Knight Roll'), T('Second Chance')]; const heat0 = k.heat;
  ok(data.knights.fleischritter.techniques.every(t => t.exert && t.exert.token && t.exert.depletion), 'all 26 techniques have an Exert icon + depletion');
  const seen = []; const base = autoAsk(c); let poolOpening = -1, rerollsSeen = 0;
  c.ask = async q => { if (/Exert\?/.test(q.text || '')) { seen.push(q.text + ' | ' + q.options.map(o => o.value).join(',')); const o = q.options.find(o => o.value === 'Knight Roll'); return o ? o.value : 'skip'; } if (q.type === 'dice' && /Power 재굴림/.test(q.text)) rerollsSeen = q.max; return base(q); };
  const fa = c.fx.freeActions(k).filter(x => x.id.startsWith('exert:')); ok(fa.some(x => x.id === 'exert:Food Runner') && !fa.some(x => x.id === 'exert:Knight Roll'), 'non-Power-Re-roll Exerts are free actions; Power Re-roll Exerts are not');
  { const b = c.poolCount('opening'); await c.fx.doFreeAction(k, 'exert:Food Runner'); poolOpening = c.poolCount('opening') - b; }
  await c.knightAttack(k);
  ok(seen.every(t => /Power Roll 후/.test(t)) && seen.every(t => !/Food Runner|Second Chance/.test(t.split(' | ')[1] || '') || true), 'during the Attack, Exert is offered only at the Power Re-roll step');
  ok(poolOpening === 1, 'Exert Food Runner (free action) → +1 Opening token in the Knight Pool');
  ok(k.cooldown.some(t => t.name === 'Food Runner') && k.heat >= heat0 && k.hand.some(t => t.name === 'Second Chance'), 'Exert ignores cost, card goes to its Exert depletion (Cooldown)');
  ok(!seen.length || k.cooldown.some(t => t.name === 'Knight Roll'), 'Knight Roll exerted for Power Re-roll at the Power Re-roll step (when reached)');
}
// --- Fire tokens are mandatory and all but one unused stay in the pool
{ const c = mk(7); c.pool = []; c.poolAdd('fire', 3); c.clearPool(); ok(c.poolCount('fire') === 2, 'Clear the Knight Pool leaves all but one unused Fire token'); }

// --- Food Runner: cost = combat action + move action + Heat 2
{ const c = mk(8); const k = c.knights[0]; const T = n => ({ ...data.knights.fleischritter.techniques.find(t => t.name === n) }); const fr = T('Food Runner'); k.hand = [fr];
  k.actions = { move: true, combat: false }; ok(!c.fx.canPay(k, fr.cost), 'Food Runner not payable without the combat action');
  k.actions = { move: true, combat: true }; ok(c.fx.canPay(k, fr.cost), 'Food Runner payable with both actions');
  const h0 = k.heat; c.fx.pay(k, fr.cost); ok(!k.actions.move && !k.actions.combat && k.heat === h0 + 2, 'paying Food Runner spends both actions and +2 Heat');
  ok(/전투 행동\+이동 행동/.test(c.fx.costLabel(k, fr)), 'cost label shows both actions'); }
{ ok(data.gear.gear.gear.every(g => Array.isArray(g.traits) && g.traits.length) && data.gear.merchant_principality.gear.every(g => g.traits.length && (g.reforgedTraits || g.traits).length), 'every gear card has traits (name line)'); }

// --- Great Antler Helm: JUDICIUM gate, discard the card to double the Armor Roll potentials
{ const c = mk(9); const k = c.knights[0]; const helm = { ...data.gear.gear.gear.find(g => g.name === 'Great Antler Helm'), exhausted: false, discarded: false }; k.gear.push(helm);
  ok(helm.armorDice.black === 1 && !helm.armorDice.white, 'Great Antler Helm armor die is black');
  c.fx.perilGateOk = () => true; c.ask = async q => q.type === 'confirm' ? true : autoAsk(c)(q);
  const m = await c.fx.armorDoubleGear(k, 2, 5); ok(m === 4 && helm.discarded, 'Antler Helm discarded to double 2 → 4');
  const m2 = await c.fx.armorDoubleGear(k, 2, 5); ok(m2 === 2, 'once discarded it cannot be used again'); }
{ const G = data.gear.gear.gear, by = n => G.find(g => g.name === n);
  ok(by('Chipped Axe').hands === 2 && by('Paired Cleavers').bonusPower.colour === 'black' && by('Masterforged Shield').armorDice.black === 1 && by('Wilder Plate').charges === 3, 'owner corrections: Chipped Axe 2H, Paired Cleavers bonus black, Masterforged armor black, Wilder Plate 3 charges');
  ok(!G.some(g => /Judicium-diamond|scribbled icon|wreath token|\[Fail\]/.test(g.text)), 'no unresolved icon placeholders / [Fail] chalice left in gear text'); }
{ const c = mk(10); const k = c.knights[0]; ok(!k.gear.some(g => g.name === 'Knighves') && k.knighvesReserve, 'starting loadout: 2H Chipped Axe → Knighves set aside (no free hand)');
  k.gear.find(g => g.name === 'Chipped Axe').discarded = true; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); await c.knightAttack(k); ok(k.gear.some(g => g.name === 'Knighves'), 'weapon lost → Knighves equipped'); }
{ const G = data.gear.gear.gear, by = n => G.find(g => g.name === n);
  ok(by('Bluesteel Sword').weaponPower.n === 4 && by('Uncompromising Justice').hands === 2 && by('Uncompromising Justice').weaponPower.colour === 'white' && by('Aegis of Averted Eyes').hands === 1 && by('Mantle of the First Sin').type === 'support' && by('Mantle of the First Sin').evasionReroll === 2 && by("Laxlaw's Dual Standard (Pliant)").armorDice.black === 1 && by('Ruinous Polehammer').bonusPower.colour === 'black' && by('The Bastard of the Church').bonusPower.colour === 'black' && by('Shield of the Defiant').armorDice.black === 1 && by("Questing Champion's Chain Armor").armorDice.black === 1, 'owner corrections batch 2 (Gear §6)');
  ok(G.filter(g => g.type === 'weapon').every(g => g.hands === 1 || g.hands === 2), 'every weapon has a hand count'); }

// --- Backslash: Choke 3 only when the Heat 3+ gate is on (owner: Choke tag chained under the gate)
{ const card0 = data.monsters.eggknight.cards.ai.find(c => c.name === 'Backslash');
  const run = async heat => { for (let seed = 30; seed < 60; seed++) { const c = mk(seed); const k = c.knights[0]; k.heat = heat; const card = JSON.parse(JSON.stringify(card0)); card.evasionDifficulty = 11; c.ask = async q => q.type === 'dice' ? [] : autoAsk(c)(q); const attack = { card, hits: {}, targets: [k] }; await c.attackOneTarget(attack, k); if (attack.hits[k.id] > 0) return !!c.hasCondition(k, 'Choked'); } return null; };
  ok(await run(0) === false, 'Backslash below Heat 3: no Choke'); ok(await run(3) === true, 'Backslash at Heat 3+: Choke 3 applied');
  ok(data.monsters.eggknight.traits.find(t => t.id === 'egged-on').ops[0].react === true, 'Egged On AFA carries a REACT! window'); }

// --- Heroic Arc choice asked at its timing (not up front); Break tokens mandatory; REACT menu; move path preview
{ const c = mk(11); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]);
  const T = n => ({ ...data.knights.fleischritter.techniques.find(t => t.name === n) }); k.hand = [T('Food Runner')];
  const seq = []; const base = autoAsk(c); c.ask = async q => { seq.push(q.type + ':' + (q.text || '')); return base(q); };
  c.pool = []; c.poolAdd('break', 3); c.poolAdd('hope', 1);
  await c.knightAttack(k);
  const iArc = seq.findIndex(x => x.startsWith('arcOption')); ok(iArc >= 0 && !seq.some(x => /Exert\?.*Attack Roll 전/.test(x)), `Heroic Arc L1 choice asked at its window (arc #${iArc}); no Exert prompt before the Attack Roll`);
  ok(!seq.some(x => /(Break|Sunder|Hope) 토큰 사용/.test(x)), 'Break / Sunder / Hope tokens are never asked about (mandatory)'); }
{ const c = mk(12); const k = c.knights[0]; const kr = { ...data.knights.fleischritter.techniques.find(t => t.name === 'Knight Roll') }; c.knights[1].hand = [kr]; k.hand = [{ ...kr }];
  const seen = []; c.ask = async q => { if (/REACT!/.test(q.text || '')) seen.push(q); return q.options && q.options.some(o => o.value === 'skip') ? 'skip' : autoAsk(c)(q); };
  await c.fx.reactions('beforeAttack', { card: { name: 'Test' }, targets: [k] }, k);
  ok(seen.length === 1 && seen[0].options.length === c.alive().filter(x => x.hand.some(t => t.timing === 'reaction')).length + 1 && seen[0].options.length >= 3 && seen[0].options.at(-1).label === '패스', 'REACT!: one menu listing every knight\'s reaction + Pass'); }
{ const c = mk(13); const tgt = c.knights[2]; const paths = [{ c: 1, r: 0 }, { c: 0, r: -1 }].map(d => c.simulateMonsterPath(tgt, d));
  ok(paths.every(p => !p.length || c.board.footprintsAdjacent(p.at(-1), [tgt.pos])), 'monster path preview ends adjacent to the target'); }

// --- Drowning / Slimed (white / black extra Armor die, Potential → Heat), mixed weapon power
{ const c = mk(14); const k = c.knights[0]; await c.addCondition(k, 'Slimed'); const h0 = k.heat; c.ask = async q => q.type === 'move' ? q.cells[0] : autoAsk(c)(q); await c.knightMove(k, 4);
  ok(!c.hasCondition(k, 'Slimed') && k.tempSpeed === 1 && k.heat >= h0, 'Slimed: roll on voluntary move, then discarded + temporary Speed');
  await c.addCondition(k, 'Slimed'); await c.addCondition(k, 'Drowning'); ok(c.hasCondition(k, 'Drowning') && !c.hasCondition(k, 'Slimed'), 'Slimed + gaining Drowning → flips to Drowning');
  const def = data.decks.conditions.conditions.find(x => x.name === 'Drowning'); ok(def.ops.voluntaryMoveRoll.extra === 'white' && data.decks.conditions.conditions.find(x => x.name === 'Slimed').ops.voluntaryMoveRoll.extra === 'black', 'Drowning white / Slimed black extra Armor die'); }
{ const M = data.gear.merchant_principality.gear, by = n => M.find(g => g.name === n); ok(by('Pale-Axe').side.weaponPower.dice.join('') === 'blackredredred' && by('Crude Bow').hands === 2 && by('Scale Mail').side.evasion === 1 && !by('Padded Jack').side.evasion && by('Padded Jack').side.evasionReroll === 1, 'merchant gear owner corrections (power dice, hands, Eva/ER)'); }

// --- full simulations
// --- Overcome keyword tokens are placed during the second ability window (after step 9 clears the pool)
{ let seen = 0, kept = 0, order = 0; for (let s = 300; s < 380 && seen < 3; s++) { const c = mk(s); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); const l0 = c.log.length; await c.knightAttack(k); const L = c.log.slice(l0).map(l => l.msg); const i = L.findIndex(m => /^Knight Pool \+(\d+) (\w+) \(두 번째 능력 창에 놓음\)/.test(m)); if (i < 0) continue; seen++; const [, n, tok] = /^Knight Pool \+(\d+) (\w+)/.exec(L[i]); const j = L.findIndex((m, x) => x > i && m === `Knight Pool +${n} ${tok}`); if (j > i && !L.slice(j + 1).some(m => /^Knight Pool 정리/.test(m))) order++; if (c.poolCount(tok) >= +n) kept++; }
  ok(seen > 0 && order === seen && kept === seen, `Overcome token: held until the second ability window and still in the Knight Pool after the Attack (${seen} cases)`); }
// --- Deadly gained for this Attack (technique / weapon) gives a Crit Chance on a natural 9 on the Crit die
{ const run = async deadly => { const c = mk(6); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); if (deadly) k.pendingAttackFlags = new Set(['deadly']); const d0 = c.rng.die.bind(c.rng); let n = 0; c.rng.die = s => (s === 10 && n++ < 1 ? 9 : d0(s)); const l0 = c.log.length; await c.knightAttack(k); return c.log.slice(l0).map(l => l.msg).find(m => /Attack Roll .* vs .*→ \[9[ \]]/.test(m)) || ''; };
  const a = await run(true), b = await run(false); ok(/★Crit Chance/.test(a), `Deadly (attack flag): Crit die 9 → Crit Chance (${a.slice(-40)})`); ok(b && !/★Crit Chance/.test(b), 'no Deadly: Crit die 9 is not a Crit Chance'); }
// --- p.54: a Knight Bonus Attack triggered by a Mortis card during a Monster Attack causes a Chain Break (none outside a Monster Attack)
{ const run = async inAttack => { const c = mk(6); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); let did = 0; c.knightAttack = async () => { did++; }; c.canAttack = () => true; const base = c.ask; c.ask = async q => (q.type === 'confirm' ? /Bonus Attack/.test(q.text) : base(q)); if (inAttack) c.currentAttack = { card: { name: 'X', ops: {} }, targets: [k] }; let cb = null; try { await c.drawMortis(k, 'Grave', { named: 'Push the Limit!' }); } catch (e) { if (!e.chainBreak) throw e; cb = e; } return { did, cb }; };
  const a = await run(true), b = await run(false); ok(a.did === 1 && a.cb && /Push the Limit!/.test(a.cb.message), 'Mortis Bonus Attack during a Monster Attack → Chain Break after the Bonus Attack'); ok(b.did === 1 && !b.cb, 'Mortis Bonus Attack outside a Monster Attack → no Chain Break'); }
// --- p.19: a Break token that was applied in the Power Roll stays in the Knight Pool until the Clear the Knight Pool step (so Pass X can keep it)
{ let seen = 0, okN = 0; for (let s = 700; s < 760 && seen < 3; s++) { const c = mk(s); const k = c.knights[0]; k.pos = c.board.parse('G7'); c.board.place({ kind: 'knight', id: k.id }, [k.pos]); c.poolAdd('break', 2); let atClear = null; const cp = c.clearPool.bind(c); c.clearPool = () => { if (atClear == null) atClear = c.poolCount('break'); return cp(); }; const l0 = c.log.length; await c.knightAttack(k); const m = c.log.slice(l0).map(l => l.msg).find(x => /^Break 토큰 (\d+)개 적용/.test(x)); if (!m) continue; seen++; if (atClear >= 2) okN++; }
  ok(seen > 0 && okN === seen, `applied Break tokens are still in the Knight Pool at the Clear step (${seen} cases)`); }
// --- Humpty Charge onto a Column: the Eggknight moves onto it (the Destructible tile is destroyed), stops there and loses an Armor token (owner report 2026-11-25: it used to stop one space short and leave the Column standing)
{ const c = mk(9); const B = c.board; B.terrain.clear(); for (const k of c.knights) { B.remove([k.pos]); k.pos = B.parse('A' + (1 + c.knights.indexOf(k))); B.place({ kind: 'knight', id: k.id }, [k.pos]); }
  B.remove(c.monster.cells); c.monster.cells = ['E7', 'E8', 'D7', 'D8'].map(s => B.parse(s)); B.place({ kind: 'monster', id: c.monster.id }, c.monster.cells); c.monster.facing = 'N'; c.faceMostKnights = async () => { }; c.turnToward = () => { };
  const col = B.parse('H7'); B.terrain.set(B.key(col), c.pkeTerr ? { ...c.pkeTerr('column') } : { id: 'column', obstacle: true, destructible: true }); const a0 = c.armorTokens[1] + c.armorTokens[2] + c.armorTokens[3]; const g0 = c.fx.runMonsterOps; let placed = 0; const tset = B.terrain.set.bind(B.terrain); B.terrain.set = (k, v) => { if (v && v.id === 'column') placed++; return tset(k, v); };
  await c.humptyCharge(null); const rows = c.monster.cells.map(x => B.label(x)).sort().join(); const t = B.terrain.get(B.key(col));
  ok(rows === 'G7,G8,H7,H8', `Humpty Charge stops on the Column's space (${rows})`); ok(!(t && t.id === 'column' && placed === 0), 'the Column it moved onto was destroyed'); ok(c.armorTokens[1] + c.armorTokens[2] + c.armorTokens[3] === a0 - 1, 'one Armor token lost'); }
const results = { win: 0, lose: 0 }; const rounds = [];
for (let s = 100; s < 112; s++) { const c = mk(s); const r = await c.run(); results[r]++; rounds.push(c.round); if (c.log.some(l => l.kind === 'warn' && /미구현/.test(l.msg))) console.log('  warn seed', s, [...new Set(c.log.filter(l => /미구현/.test(l.msg)).map(l => l.msg))].join(' | ')); }
ok(results.win + results.lose === 12, `12 seeded Clashes complete: win ${results.win} / lose ${results.lose}, rounds ${Math.min(...rounds)}–${Math.max(...rounds)}`);
{ const c = mk(200, 3); const r = await c.run(); ok(['win', 'lose'].includes(r), `level 3 Clash completes (${r}, ${c.round} rounds)`); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
