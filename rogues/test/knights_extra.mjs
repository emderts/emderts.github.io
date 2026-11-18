// Knight abilities added in v0.56.0: Stoneface, Ser Ubar, Kara, Paracelsa, Renholder.
import fs from 'fs';
import path from 'path';
import { Clash } from '../src/engine/clash.js';
const root = new URL('../data/', import.meta.url);
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(root.pathname);
let fails = 0; const ok = (c, m) => { if (c) console.log('PASS', m); else { fails++; console.log('FAIL', m); } };
const mk = (defs, seed = 1, monster = 'eggknight') => { const c = new Clash({ data, knights: defs.map((d, i) => ({ def: d, name: d + i })), monster, level: 1, kingdom: 'sunken', seed }); c.ask = async q => q.type === 'confirm' ? !!q.default : q.options ? q.options[0].value : null; c.setup(); return c; };
const tech = (id, n) => data.knights[id].techniques.find(t => t.name === n);

{ const t = tech('stoneface', 'Go Beyond!'); ok(t.ops.some(o => o.op === 'goBeyond') && !t.unclear.length, 'Go Beyond!: goBeyond op (Fail Responses ignored, Critical on Overcome/Overpower)');
  const c = mk(['stoneface', 'fleischritter', 'fleischritter', 'fleischritter']); const s = c.knights[0], x = c.knights[1]; const B = c.board;
  const sw = B.neighbors(x.pos).find(q => !B.terrainAt(q) && !c.knightAt(q) && !c.monsterOccupies(q)) || x.pos; const near = B.zone([sw], 2).find(q => !B.terrainAt(q) && !c.knightAt(q) && !c.monsterOccupies(q) && !(q.c === sw.c && q.r === sw.r) && B.neighbors(q).some(n => !B.terrainAt(n) && !c.knightAt(n) && !c.monsterOccupies(n) && !(n.c === sw.c && n.r === sw.r)));
  if (near) { c.moveKnight(s, near); s._moved = false; s.hand = [{ ...tech('stoneface', "I'll Be Your Rock") }]; s.heat = 0; c.ask = async q => q.type === 'confirm' ? true : q.options ? q.options[0].value : null; ok(await c.stoneRock(x, 'Swamp') && B.adjacent(x.pos, s.pos) && (s.leash || 0) >= 3, "I'll Be Your Rock: a Terrain death is ignored, the Knight is placed next to Stoneface, Leash 3"); }
  const lc = c.lineCells(s.pos, { c: 1, r: 0 }, 2); ok(Array.isArray(lc), 'lineCells helper'); }
{ const c = mk(['ser-ubar', 'fleischritter', 'fleischritter', 'fleischritter']); const u = c.knights[0]; u.form = 'ape'; u.talent = data.knights['ser-ubar'].talents.find(t => t.abilities.some(a => (a.ops || []).some(o => o.op === 'reduceInvol'))); u.heat = 0; c.ask = async q => q.type === 'confirm' ? true : q.options ? q.options[0].value : null;
  ok(await c.ubarReduce(u, 3) === 1 && u.heat === 1, "You're in Here With Me [APE]: 1 Heat reduces involuntary movement by 2"); u.form = 'human'; ok(await c.ubarReduce(u, 3) === 3, '…not in Human form');
  ok(tech('ser-ubar', 'Knight Roll').apeWhileDown && tech('ser-ubar', 'Knuckle Charge').apeNoDifficult && tech('ser-ubar', 'Untouchable').delayedReflex === 3, 'Ser Ubar form flags on Knight Roll / Knuckle Charge / Untouchable'); }
{ const c = mk(['kara', 'renholder', 'fleischritter', 'fleischritter']); const k = c.knights[0], r = c.knights[1]; const lw = { ...tech('kara', 'Living Weapon') }; ok(lw.returnOnFullEvade && tech('kara', 'Fleet of Foot').straightWithMonster && tech('kara', 'Avert a Dire Fate').acrobaticsHeat === 1, 'Kara flags: Living Weapon / Fleet of Foot / Avert a Dire Fate');
  r.cooldown.push({ name: 'Shadows Between Worlds' }); const card = c.monster.signature || c.monster.ai.deck[0]; const seen = new Set(); for (let i = 0; i < 12; i++) { const tg = await c.resolveTargeting(card); if (tg && tg.targets) tg.targets.forEach(t => seen.add(t)); } ok(!seen.has(r), 'Shadows Between Worlds: not targeted while another viable Target exists'); }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS (knights extra)'); process.exit(fails ? 1 : 0);
