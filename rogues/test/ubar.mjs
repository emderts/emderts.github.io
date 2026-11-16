// Ser Ubar: data, Human / Ape forms and Shapeshift, form-gated Technique ops, Talents, full-Clash smoke runs.
import fs from 'fs';
import path from 'path';
import { Campaign } from '../src/engine/campaign.js';
import { Clash } from '../src/engine/clash.js';
import { KNOWN_OPS } from '../src/engine/effects.js';
import { KARA_OPS } from '../src/engine/kara.js';
import { PARA_OPS } from '../src/engine/paracelsa.js';
import { SONCH_OPS } from '../src/engine/sonch.js';
import { UBAR_OPS } from '../src/engine/ubar.js';
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
const K = data.knights['ser-ubar'];
const mk = (seed, monster = 'eggknight', level = 1, over = {}) => { const c = new Clash({ data, knights: [{ def: 'ser-ubar', name: 'Ubar', ...over }, { def: 'fleischritter', name: 'F1' }, { def: 'ser-sonch', name: 'Sonch' }, { def: 'paracelsa', name: 'Para' }], monster, level, kingdom: 'sunken', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const tech = (k, name) => { const t = { ...K.techniques.find(x => x.name === name) }; k.hand.push(t); return t; };
const yes = c => { c.ask = async q => q.type === 'confirm' ? true : q.options ? (q.options.find(o => o.value !== 'skip') || q.options[0]).value : q.cells ? q.cells[0] : null; };
const pickv = (c, want) => { c.ask = async q => { if (q.type === 'confirm') return true; if (q.cells) return q.cells[0]; const o = q.options.find(o => want.includes(o.value)); return (o || q.options.find(o => o.value !== 'skip') || q.options[0]).value; }; };
const no = c => { c.ask = async q => q.type === 'confirm' ? false : q.options ? (q.options.find(o => o.value === 'skip') || q.options[0]).value : null; };

// ---- data ----
ok(K.techniques.length === 26 && K.heroicArcs.length === 8 && K.talents.length === 5 && K.portraits.length === 3, 'Ser Ubar: 26 Techniques, 8 Heroic Arcs, 5 Talents, 3 Portraits');
ok(data.knights.peril_arcs.arcs['ser-ubar'].some(a => a.name === K.setup.perilArc) && K.heroicArcs.some(a => a.name === K.setup.heroicArc) && K.talents.some(t => t.name === K.setup.talent) && K.setup.techniques.every(n => K.techniques.some(t => t.name === n)), 'setup Talent / Heroic Arc / Peril Arc / Techniques exist');
{ const R = data.rosegraal.rewards; const names = [], arcs = [], ports = []; for (const lv of Object.values(R.levels)) { const v = lv['ser-ubar'] || {}; arcs.push(...(v.H || [])); for (const key of ['C', 'T']) for (const x of v[key] || []) (x.kind === 'technique' ? names : x.kind === 'portrait' ? ports : []).push(x.name); } ok(names.length > 0 && names.every(n => K.techniques.some(t => t.name === n)) && arcs.every(n => K.heroicArcs.some(a => a.name === n)) && ports.every(n => K.talents.some(t => t.name === n)), 'every Rosegraal reward Technique / Heroic Arc / Talent of Ser Ubar exists'); }
{ const bad = []; for (const t of K.techniques) for (const o of [...(t.ops || []), ...Object.values(t.gateOps || {}).flat(), ...Object.values(t.formOps || {}).flatMap(f => [...(f.add || []), ...(f.instead || [])])]) if (!Object.values(KNOWN_OPS).flat().includes(o.op) && !UBAR_OPS.has(o.op) && !SONCH_OPS.has(o.op) && !PARA_OPS.has(o.op) && !KARA_OPS.has(o.op) && !['timed', 'unshakeable', 'armedWithTruth', 'piousAttack', 'techArmorReroll', 'fieryEyes'].includes(o.op) && o.op !== 'poolToken') bad.push(`${t.name}:${o.op}`); ok(bad.length === 0, `every Ser Ubar Technique op has a handler ${bad.join(', ')}`); }
{ const none = K.techniques.filter(t => !t.ops).map(t => t.name).sort().join('|'); ok(none === '', `every Technique has an implementation (${none})`); }
{ const c = mk(1); const k = c.knights[0]; ok(k.gear.some(g => g.name === 'Militia Morgenstern') && k.hand.length === 5 && k.form === 'human' && k.virtues.Might === 2, 'Ser Ubar starts in Human form with 5 Techniques, 2 Might'); }

// ---- forms ----
{ const c = mk(2); const k = c.knights[0]; no(c); await c.shapeshift(k); ok(k.form === 'ape', 'Shapeshift: Human → Ape'); await c.shapeshift(k); ok(k.form === 'human', 'Shapeshift: Ape → Human'); const p0 = { ...k.pos }; pickv(c, ['move']); await c.shapeshift(k); ok(k.pos.c !== p0.c || k.pos.r !== p0.r, "Shifter's Grace: when you Shapeshift, you may move 1 space"); }
{ const c = mk(3); const k = c.knights[0]; const t = k.hand.find(x => x.name === 'Knight Pose'); ok(c.fx.activeOps(k, t).some(o => o.op === 'move'), 'HUMAN: Knight Pose — stand up, then move up to 1 space'); k.form = 'ape'; ok(!c.fx.activeOps(k, t).some(o => o.op === 'move'), 'APE: Knight Pose — stand up only'); const t2 = tech(k, 'Monkey See'); ok(c.fx.activeOps(k, t2)[0].deck === 'ai', 'APE: Monkey See looks at the AI deck'); k.form = 'human'; ok(c.fx.activeOps(k, t2)[0].deck === 'bp', 'HUMAN: Monkey See looks at the BP deck instead'); }
{ const c = mk(4); const k = c.knights[0]; k._formAsked = true; k.heat = 9; k.bane = 0; no(c); let shifted = 0; for (let s = 1; s <= 12; s++) { const c2 = mk(s); const k2 = c2.knights[0]; k2._formAsked = true; k2.heat = 5; no(c2); await c2.ubarTurnStart(k2); if (k2.form === 'ape') shifted++; } ok(shifted > 0 && shifted < 12, `Shifter's Grace: d10 (+Bane) ≤ Heat → Shapeshift (${shifted}/12 at Heat 5)`); }
{ const c = mk(5, 'eggknight', 1, { talent: 'Rising Ape' }); const k = c.knights[0]; no(c); k.heat = 2; k._heatQ.length = 0; k.heat = 3; await c.ubarDrain(k); ok(k.form === 'ape', 'Master of the Battlefield: Heat becomes exactly 3 → Shapeshift'); k.heat = 4; await c.ubarDrain(k); ok(k.form === 'ape', 'no Shapeshift at Heat 4'); }
{ const c = mk(6, 'eggknight', 1, { talent: 'Primal Warrior' }); const k = c.knights[0]; no(c); k.generic = 2; k.heat = 0; k._heatQ.length = 0; k.heat = 2; await c.ubarDrain(k); ok(k.form === 'ape' && k.heat === 0 && k.generic === 0, "Heart's Thunder: Heat equals the Generic tokens → Shapeshift, Heat reset, tokens discarded"); }
{ const c = mk(7, 'eggknight', 1, { talent: 'Simian Strategist' }); const k = c.knights[0]; k._formAsked = true; const h0 = k.heat; c.ask = async q => q.type === 'confirm' ? /Beast Mode/.test(q.text) : q.options ? (q.options.find(o => o.value === 'skip') || q.options[0]).value : null; await c.ubarTurnStart(k); ok(k.form === 'ape' && k.heat === h0 + 1, 'Beast Mode: +1 Heat at the start of the turn to Shapeshift'); }
{ const c = mk(8); const k = c.knights[0], o = c.knights[1]; const m = c.monsterCenter(); c._lastWounder = o; const same = c.ubarSide(k) === c.ubarSide(o); const A = { knight: k, weapon: k.gear[0], flags: new Set(), kw: [], extraPool: { raw: 0 } }; const b0 = c.poolCount('break'); await c.ubarBeforeAttack(k, A); ok(c.poolCount('break') === b0 + (same ? 0 : 1), `Troop Tactics: Auto-break 1 only when the last Knight who dealt a Wound is on another side (${same ? 'same side' : 'other side'})`); c._lastWounder = k; const b1 = c.poolCount('break'); await c.ubarBeforeAttack(k, A); ok(c.poolCount('break') === b1, 'Troop Tactics ignores your own Wounds'); }

// ---- Techniques ----
{ const c = mk(9); const k = c.knights[0]; const t = k.hand.find(x => x.name === "Put 'em Up"); yes(c); const b = await c.paraDefense(k); ok(k._defEvasion === (c.fx.evasionBonus(k) > 0 ? 0 : 1) && k._defGuard === 1 && k.cooldown.includes(t), "Put 'em Up (Human): Lesser Dodge and Guard 1"); }
{ const c = mk(10); const k = c.knights[0]; const t = tech(k, 'Great Ape Flex'); k.hand = [t]; yes(c); k.reinforce = null; await c.paraDefense(k); ok(k.reinforce && k.reinforce.red === 2, 'Great Ape Flex: Reinforce 2'); }
{ const c = mk(11); const k = c.knights[0]; const t = tech(k, 'Cold Open'); await c.fx.useTechnique(k, t); ok(c.poolCount('opening') === 1 && c.poolCount('break') === 1 && c.priorityTarget === k, 'Cold Open (Human): Opening + Break on an empty Knight Pool, and Provoke'); }
{ const c = mk(12); const k = c.knights[0]; const t = tech(k, 'Canopy Swing'); k.actions = { move: true, combat: true }; const p0 = { ...k.pos }; yes(c); await c.fx.useTechnique(k, t); const d = Math.abs(k.pos.c - p0.c) + Math.abs(k.pos.r - p0.r); ok(d >= 1 && d <= 4 && k.actions.move === false, `Canopy Swing: Move action + Heat, placed up to 4 spaces away (${d})`); }
{ const c = mk(13); const k = c.knights[0]; const t = tech(k, 'Simian Sprint'); k.form = 'ape'; k.actions = { move: false, combat: true }; await c.fx.useTechnique(k, t); ok(k.actions.move === true && k.actions.combat === false, 'Simian Sprint (Ape): Combat action → gain a Move action'); }
{ const c = mk(14); const k = c.knights[0]; const t14 = tech(k, 'Skull Crack'); await c.ubarOp(t14.ops[0], k, {}); ok(k.pendingUbar.autoHit === 1, 'Skull Crack: declared when the Attack is declared — 1 Attack die is set aside as an automatic hit'); }
{ const c = mk(15); const k = c.knights[0]; const t = tech(k, 'Feral Aggression'); k.form = 'ape'; await c.ubarOp(c.fx.activeOps(k, t)[0], k, {}); ok(k.pendingExtraPool.raw === 2 && c.poolCount('power') === 1, 'Feral Aggression (Ape): +2 Power and Power 1'); }
{ const c = mk(16); const k = c.knights[0]; const t = tech(k, 'Stand Aside'); await c.fx.useTechnique(k, t); ok(k._bypass === 1 && k.delay.includes(t), 'Stand Aside: the next movement may pass through other Knights'); }
{ const c = mk(17, 'eggknight', 1, { talent: 'Beast Tamer' }); const k = c.knights[0]; const t = tech(k, 'Mind over Body'); yes(c); await c.ubarPreTechnique(k, t); ok(k.form === 'ape', 'Constantly Evolving: Shapeshift before a Technique with a Gated Effect of the other shape'); }
{ const c = mk(18); const k = c.knights[0]; const t = tech(k, 'Warcry'); k.form = 'ape'; const o = c.knights[1]; await c.addCondition(o, 'Knockdown (Falling Down)'); yes(c); await c.fx.useTechnique(k, t); ok(!c.knockedDown(o), 'Warcry (Ape): Inspire 1'); }

// ---- full Clashes ----
for (const [seed, mon, tal, arc, por, form] of [[101, 'eggknight', 'Ape Knight', 'Ape Knight', 'ape-knight', 'human'], [102, 'ironcast-dead', 'Primal Warrior', 'Primal Warrior', 'primal-simian', 'ape'], [103, 'eggknight', 'Simian Strategist', 'Simian Strategist', 'primal-simian', 'human'], [104, 'white-ape-troll', 'Rising Ape', 'Rising Ape', 'rising-beast', 'ape'], [105, 'eggknight', 'Beast Tamer', 'Beast Tamer', 'rising-beast', 'human'], [106, 'knight-of-the-fen', 'Ape Knight', 'Champion of Utrebant', 'ape-knight', 'ape'], [107, 'winged-nightmare', 'Rising Ape', 'Ape Militant', 'ape-knight', 'human'], [108, 'pumpkinhead-monstrosities', 'Beast Tamer', 'Simianthrope', 'ape-knight', 'ape']]) {
  let res = null, err = null; try { const c = mk(seed, mon, 1, { talent: tal, heroicArc: arc, portrait: por }); const k = c.knights[0]; for (const t of K.techniques) if (!k.hand.some(h => h.name === t.name)) k.hand.push({ ...t }); let n = 0; c.ask = async q => { if (q.type === 'confirm') return /사용\?|Shapeshift|이동\?|Generic/.test(q.text) ? true : q.default; if (/시작하는 형태/.test(q.text || '')) return form; if (q.type === 'action' && n++ % 3 === 0) { const f = q.options.find(o => String(o.value).startsWith('tech:')); if (f) return f.value; } return autoAsk(c)(q); }; res = await c.run(); } catch (e) { err = e; }
  ok(!err && res, `full Clash with Ser Ubar (${tal} / ${arc} vs ${mon}, ${form}) completes${err ? ' — ' + (err.stack || err.message).split('\n').slice(0, 3).join(' | ') : ` (${res})`}`);
}
{ const camp = new Campaign(data, { seed: 5, knights: [{ def: 'ser-ubar' }, { def: 'fleischritter' }, { def: 'paracelsa' }, { def: 'kara' }] }); ok(camp.knights[0].def === 'ser-ubar' && camp.knights[0].loadout.talent === 'Ape Knight' && camp.knights[0].loadout.techniques.length === 5, 'Campaign with Ser Ubar is created (Ape Knight, 5 Techniques)'); }
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS (ser-ubar)'); if (fails) process.exit(1);
