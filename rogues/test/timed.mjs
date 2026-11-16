// Timed Techniques of the five new Knights (targeting, Evasion, involuntary movement, death, Judicium, BP draw) and the starting Gear choice.
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
const KN = data.knights;
const mk = (seed, defs, monster = 'eggknight') => { const c = new Clash({ data, knights: defs.map((d, i) => (typeof d === 'string' ? { def: d, name: d + i } : d)), monster, level: 1, kingdom: 'sunken', seed }); c.ask = autoAsk(c); c.setup(); return c; };
const give = (k, id, name) => { const t = { ...KN[id].techniques.find(x => x.name === name) }; k.hand.push(t); return t; };
const yes = c => { c.ask = async q => q.type === 'confirm' ? true : q.options ? (q.options.find(o => o.value !== 'skip') || q.options[0]).value : q.cells ? q.cells[0] : null; };
const P4 = ['stoneface', 'paracelsa', 'ser-sonch', 'ser-ubar'];

for (const id of ['kara', 'paracelsa', 'ser-sonch', 'ser-ubar', 'stoneface']) ok(KN[id].techniques.every(t => Array.isArray(t.ops) && t.ops.length), `${KN[id].name}: every Technique has ops`);
// Knight Stand
{ const c = mk(1, P4); const k = c.knights[0]; const t = k.hand.find(x => x.name === 'Knight Stand'); yes(c); const p0 = { ...k.pos }; await c.pushback(k, 3); ok(k.pos.c === p0.c && k.pos.r === p0.r && k.cooldown.includes(t), 'Knight Stand: involuntary movement reduced by up to 3'); }
{ const c = mk(2, P4); const k = c.knights[0]; k.leash = 7; yes(c); c.ask = async q => q.type === 'confirm' ? true : q.options ? (q.options.find(o => o.value === 'braced') || q.options[0]).value : null; const p0 = { ...k.pos }; await c.pushback(k, 6); ok(k.pos.c === p0.c && k.pos.r === p0.r && k.leash === 0, 'Knight Stand: Unleash 7 → Braced'); }
// Unshakeable
{ const c = mk(3, P4); const k = c.knights[0]; const t = give(k, 'stoneface', 'Unshakeable'); await c.addCondition(k, 'Poisoned', { tokens: 1 }); yes(c); await c.fx.useTechnique(k, t); ok(k.conditions.length === 0 && k._shelved.length === 1, 'Unshakeable: a Condition card is ignored'); c.extrasTurnStart(k); ok(k.conditions.length === 1, 'Unshakeable: the Condition returns at the start of the next turn'); }
// Vita Ex Mortis / Through the Fires
{ const c = mk(4, P4); const k = c.knights[0]; const t = give(k, 'stoneface', 'Vita Ex Mortis'); k.leash = 9; yes(c); c._inJud = true; await c.die(k, 'Judicium test'); c._inJud = false; ok(k.alive && k.discard.includes(t), 'Vita Ex Mortis: ignore a death caused by a Judicium draw'); await c.die(k, 'other'); ok(!k.alive, 'Vita Ex Mortis does not prevent other deaths'); }
{ const c = mk(5, P4); const k = c.knights[1]; const t = give(k, 'paracelsa', 'Through the Fires of Anatiocha'); k.zeal = 4; k.talent = { ...k.talent, abilities: [] }; yes(c); c.currentAttack = { card: { name: 'x', ops: {} }, targets: [k] }; const p0 = { ...k.pos }; await c.die(k, 'Instant Death test'); c.currentAttack = null; ok(k.alive && (k.pos.c !== p0.c || k.pos.r !== p0.r) && c.zealAvail(k) === 4 && k.zeal === 0, 'Through the Fires of Anatiocha: ignore an Instant Death and Displace (4 Zeal)'); }
// Armed with Truth
{ const c = mk(6, ['paracelsa', { def: 'renholder', name: 'Ren' }, 'kara', 'kara']); const k = c.knights[0]; const t = give(k, 'paracelsa', 'Armed with Truth'); await c.fx.useTechnique(k, t); const g = { name: 'Bow', type: 'weapon', text: 'Ranged 2-4.', exhausted: false }; c.fx.gearPay(k, g, { cost: { exhaust: true } }); ok(g.exhausted === false && k._keepRanged === false, 'Armed with Truth: the next Exhaust of a Ranged Weapon is ignored'); c.fx.gearPay(k, g, { cost: { exhaust: true } }); ok(g.exhausted === true, 'Armed with Truth works once'); }
// Power of the Pious
{ const c = mk(7, ['paracelsa', 'kara', 'kara', 'kara']); const k = c.knights[0]; const t = give(k, 'paracelsa', 'Power of the Pious'); k.actions = { move: true, combat: true }; ok(!c.fx.canPay(k, t.cost), 'Power of the Pious needs Zeal'); k.zeal = 3; ok(c.fx.canPay(k, t.cost), 'Power of the Pious: [Combat action] -X Zeal is payable'); let err = null; try { yes(c); await c.fx.useTechnique(k, t); } catch (e) { err = e; } ok(!err && k.actions.combat === false && c.zealAvail(k) <= 3 && k.discard.includes(t), `Power of the Pious resolves${err ? ' — ' + err.message : ''}`); }
// Know Thine Enemy
{ const c = mk(8, ['ser-sonch', 'kara', 'kara', 'kara']); const k = c.knights[0]; const t = give(k, 'ser-sonch', 'Know Thine Enemy'); const d = c.monster.bp; d.cards[2] = { ...d.cards[2], level: 2, name: 'L2 test' }; c.ask = async q => q.type === 'confirm' ? true : q.options ? (q.options.find(o => o.value === 2) || q.options[0]).value : null; const bp = await c.extrasDrawBP(k); ok(bp.level === 2 && !d.cards.includes(bp) && k.cooldown.includes(t), 'Know Thine Enemy: draw the first BP of a chosen Level'); }
// Knight in Shining Armor
{ const c = new Clash({ data, knights: [{ def: 'kara', name: 'Kara', gear: ['Knighves', 'Ragged Hauberk'] }, { def: 'fleischritter', name: 'F1' }], monster: 'eggknight', level: 1, kingdom: 'sunken', seed: 9 }); c.ask = autoAsk(c); c.setup(); const k = c.knights[0]; const t = give(k, 'kara', 'Knight in Shining Armor'); yes(c); await c.karaStartOfClash(k); ok(k._shining && !k.hand.includes(t) && c.karaSoak(k) === 2 && c.karaDeploy(k) === 1, 'Knight in Shining Armor: placed under the Armor at the start of the Clash — Deploy 1, Soak 2'); const o = c.knights[1]; const p0 = k.passion; c.moveKnight(o, c.board.neighbors(k.pos).find(x => !c.knightAt(x) && !c.board.isObstacle(x) && !c.monsterOccupies(x))); c.karaShiningCheck(); ok(!k._shining && k.discard.includes(t) && k.gear.find(g => g.type === 'armor').exhausted && k.passion === p0 + 1, 'Knight in Shining Armor: an Ally becomes adjacent → discard, exhaust the Armor, +1 Passion'); }
// Monster Attack hooks in full Clashes
for (const [seed, mon] of [[201, 'eggknight'], [202, 'ironcast-dead'], [203, 'white-ape-troll'], [204, 'knight-of-the-fen'], [205, 'winged-nightmare'], [206, 'pumpkinhead-monstrosities']]) {
  let res = null, err = null; try { const c = mk(seed, [{ def: 'stoneface', name: 'Stone' }, { def: 'paracelsa', name: 'Para' }, { def: 'ser-sonch', name: 'Sonch' }, { def: 'ser-ubar', name: 'Ubar' }], mon); for (const k of c.knights) { for (const t of KN[k.def.id].techniques) if (!k.hand.some(h => h.name === t.name)) k.hand.push({ ...t }); k.leash = 9; k.zeal = 3; } let n = 0; c.ask = async q => { if (q.type === 'confirm') return /사용\?/.test(q.text) ? (n++ % 2 === 0) : q.default; if (/시작하는 형태/.test(q.text || '')) return n % 2 ? 'ape' : 'human'; return autoAsk(c)(q); }; res = await c.run(); } catch (e) { err = e; }
  ok(!err && res, `full Clash using timed Techniques vs ${mon} completes${err ? ' — ' + (err.stack || err.message).split('\n').slice(0, 3).join(' | ') : ` (${res})`}`);
}
// starting Gear choice
{ ok(KN['ser-ubar'].setup.gearChoice.options.includes('Chipped Axe') && KN.stoneface.setup.gearChoice.default === 'Ragged Hauberk', 'Ser Ubar / Stoneface: starting Gear choice (Mob tier Merchant gear)'); const camp = new Campaign(data, { seed: 5, knights: [{ def: 'ser-ubar', startGear: 'Chipped Axe' }, { def: 'stoneface', startGear: 'Rusted Shield' }, { def: 'stoneface' }, { def: 'kara', startGear: 'Chipped Axe' }] }); ok(camp.knights[0].armory.includes('Chipped Axe') && camp.knights[1].armory.includes('Rusted Shield') && camp.knights[2].armory.includes('Ragged Hauberk') && camp.knights[3].armory.includes('Shoddy Pitchfork'), 'Campaign: the chosen starting Gear is used (default when not chosen; ignored for Knights without a choice)'); }
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS (timed techniques)'); if (fails) process.exit(1);
