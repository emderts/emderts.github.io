// Board geometry, dice pools, knight tracks (rulebook pp.13–19, 42–59).
import fs from 'fs';
import { Rng } from '../src/engine/core.js';
import { Board, inFront, rearCells, faceToward } from '../src/engine/board.js';
import { rollD10s, d10Success, buildPowerPool, rollPowerPool, rollArmor } from '../src/engine/dice.js';
import { Knight } from '../src/engine/knight.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const BOARD = rd('../data/components/board.json'), DICE = rd('../data/components/dice.json');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

// --- board
const b = new Board(BOARD);
ok(b.cols === 14 && b.rows === 10 && b.label({ c: 7, r: 0 }) === 'A7' && b.label(b.parse('J14')) === 'J14', 'board 14×10, labels A1..J14');
ok(b.neighbors({ c: 1, r: 0 }).length === 2 && b.neighbors({ c: 7, r: 5 }).length === 4, 'cardinal neighbours clipped at edges');
ok(b.adjacent({ c: 3, r: 3 }, { c: 4, r: 3 }) && !b.adjacent({ c: 3, r: 3 }, { c: 4, r: 4 }), 'adjacency is edge-sharing, not diagonal');
ok(b.distance([{ c: 1, r: 0 }], [{ c: 4, r: 2 }]) === 5, 'distance is cardinal shortest path (3+2)');
{ for (let r = 0; r < 10; r++) if (r !== 9) b.terrain.set(b.key({ c: 5, r }), { obstacle: true }); // wall with a gap at top
  const d = b.distance([{ c: 4, r: 0 }], [{ c: 6, r: 0 }], c => !b.isObstacle(c)); ok(d === 20, `path detours around obstacles (${d} = 9 up + 2 across + 9 down)`);
  b.terrain.clear(); }
{ const fp = [{ c: 7, r: 4 }, { c: 8, r: 4 }, { c: 7, r: 5 }, { c: 8, r: 5 }];
  ok(b.footprintsAdjacent(fp, [{ c: 9, r: 5 }]) && !b.footprintsAdjacent(fp, [{ c: 9, r: 6 }]), '2×2 footprint adjacency');
  ok(inFront(b, fp, 'N', { c: 3, r: 6 }) && !inFront(b, fp, 'N', { c: 3, r: 5 }) && inFront(b, fp, 'E', { c: 9, r: 1 }), 'in front = beyond the front edge line');
  ok(JSON.stringify(rearCells(b, fp, 'N')) === JSON.stringify([{ c: 7, r: 3 }, { c: 8, r: 3 }]), 'rear = cells directly behind');
  ok(faceToward(fp, { c: 12, r: 5 }) === 'E' && faceToward(fp, { c: 7, r: 9 }) === 'N' && faceToward(fp, { c: 3, r: 0 }, 'S') === 'S' && faceToward(fp, { c: 1, r: 1 }, 'S') === 'W', 'turn toward target; diagonal tie keeps current facing when possible'); }
ok(b.zone([{ c: 7, r: 4 }], 1).length === 8 && b.zone([{ c: 1, r: 0 }], 2).length === 8, 'Zone X includes diagonals, clipped at edges');
{ b.terrain.set(b.key({ c: 5, r: 5 }), { obscuring: true });
  ok(b.hasLoS([{ c: 3, r: 5 }], [{ c: 8, r: 5 }]) === false, 'obscuring tile directly between blocks LoS (line along/through it)');
  ok(b.hasLoS([{ c: 3, r: 5 }], [{ c: 8, r: 8 }]) === true, 'LoS available around the tile from a corner');
  ok(b.hasLoS([{ c: 4, r: 5 }], [{ c: 5, r: 5 }]) === true, 'a tile never blocks LoS to itself');
  b.terrain.clear(); }

// --- dice
{ const r = rollD10s(new Rng(4), 3); ok(r.dice.length === 3 && r.dice[0].crit && !r.dice[1].crit, 'first d10 is the Crit die'); }
ok(d10Success(10, -9, 20) && !d10Success(1, 20, 2) && d10Success(6, 1, 7) && !d10Success(6, 0, 7), 'natural 10 always succeeds, natural 1 always fails, bonus applies otherwise');
{ const p = buildPowerPool({ red: 8 }); ok(p.red === 6 && p.black === 1, '8 red → 6 red + 1 black');
  const q = buildPowerPool({ red: 9 }); ok(q.red === 7 && q.black === 1, '9 red → 7 red + 1 black');
  const w = buildPowerPool({ white: 4 }); ok(w.white === 3 && w.raw === 1 && w.potential === 1, '4 white → 3 white + 1 raw Power + 1 Potential');
  const c = buildPowerPool({ red: 10, black: 4 }); ok(c.red === 6 && c.black === 4 && c.white === 1, 'overflow cascades red→black→white (10r+4b → 6r 4b 1w)'); }
{ const rng = new Rng(9); const res = rollPowerPool(rng, { red: 3, black: 1, raw: 2 }, DICE.faces); ok(res.dice.length === 4 && res.power >= 2, `power roll: ${res.dice.length} dice, power ${res.power} (incl. 2 raw), potential ${res.potential}, hope ${res.hope}`); }
{ const a = rollArmor(new Rng(2), { red: 2 }, DICE.faces, DICE.armorSymbol); ok(a.dice.length === 2 && a.mitigated >= 0, 'armor roll counts the chosen symbol'); }
ok(['red', 'black', 'white'].every(c => DICE.faces[c].length === 6), 'six faces per colour');

// --- knight (Fleischknecht Peril Arc from card: max 11; Minor 10–7 H4, Major 6–4 H4, Grave 3–1 H5, Judicium 0 H5; Uninjured H3)
const mk = () => new Knight({ id: 'f', name: 'Fleischritter', portrait: { powerDie: 'red', cardRefresh: 1, heatRefresh: 1, handLimit: 4, speed: 4, baneLimit: 4 },
  perilArc: { maxVigor: 11, uninjuredHeatLimit: 3, thresholds: [{ peril: 'Minor', atVigor: 10, heatLimit: 4 }, { peril: 'Major', atVigor: 6, heatLimit: 4 }, { peril: 'Grave', atVigor: 3, heatLimit: 5 }, { peril: 'Judicium', atVigor: 0, heatLimit: 5 }] } });
{ const k = mk(); ok(k.vigor === 11 && k.peril() === 'Uninjured' && k.heatLimit === 3, 'starts at max Vigor, Uninjured, Heat Limit 3');
  k.loseVigor(1); ok(k.peril() === 'Minor' && k.heatLimit === 4, 'Vigor 10 → Minor, Heat Limit 4');
  k.loseVigor(7); ok(k.vigor === 3 && k.peril() === 'Grave' && k.heatLimit === 5, 'Vigor 3 → Grave');
  const eff = k.loseVigor(5); ok(k.vigor === 0 && eff === -2 && k.peril() === 'Judicium', 'Vigor floors at 0, effective -2 reported for Massive Peril'); }
{ const k = mk(); k.heat = 2; const over = k.gainHeat(3); ok(over === 2 && k.heat === 3 && k.vigor === 9, 'Heat over limit → clamp + lose Vigor by the excess');
  let threw = false; try { k.gainHeat(2, { voluntary: true }); } catch (e) { threw = true; } ok(threw, 'voluntary Heat cost above the limit (now 4 at Minor) is illegal'); }
{ const k = mk(); for (let i = 0; i < 12; i++) k.gainPassion(); ok(k.passion === 9, 'Passion caps at 9'); }
{ const k = mk(); k.gainBane(4); ok(k.alive && k.bane === 4, 'Bane up to the limit is fine'); k.gainBane(1); ok(!k.alive && k.firstDeath, 'exceeding Bane Limit kills immediately'); }
{ const k = mk(); k.hand = ['a']; k.cooldown = ['b', 'c']; k.delay = ['d']; k.heat = 3; k.refresh(); ok(k.heat === 2 && k.hand.length === 2 && k.cooldown.length === 2 && k.delay.length === 0, 'Refresh: Heat -1, 1 card Cooldown→hand, Delay→Cooldown'); }
{ const k = mk(); k.vigor = 2; k.heat = 4; k.passion = 5; k.bane = 3; k.discard = ['x']; k.alive = false; k.aftermath(); ok(k.alive && k.vigor === 11 && k.heat === 0 && k.passion === 0 && k.bane === 1 && k.hand.includes('x'), 'Aftermath resets stats, returns techniques, Bane -2, resurrects'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
