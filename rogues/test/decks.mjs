// Mortis / Condition / Terrain data integrity.
import fs from 'fs';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const M = rd('../data/decks/mortis.json'), C = rd('../data/decks/conditions.json'), T = rd('../data/terrain.json'), E = rd('../data/monsters/eggknight.json');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
ok(M.minor.length === 14 && M.major.length === 14 && M.grave.length === 15 && M.judicium.length === 6, 'Mortis 14/14/15 + Judicium 6');
ok(M.minor.every(c => ['up', 'down', 'left', 'right'].includes(c.marker.arrow)), 'every Minor has a direction arrow');
ok(M.major.every(c => c.marker.number >= 1 && c.marker.number <= 8), 'every Major has a number 1–8');
ok(M.grave.every(c => /^[A-J]\d{1,2}$/.test(c.marker.coord)), 'every Grave has a board coordinate');
const codes = [...M.minor, ...M.major, ...M.grave, ...M.judicium].map(c => c.code).sort(); ok(new Set(codes).size === 49 && codes[0] === '10A0401' && codes.at(-1) === '10A0449', 'codes 10A0401–10A0449 unique');
ok(M.judicium.filter(j => j.death).length === 5 && M.judicium.filter(j => j.massivePerilThreshold).map(j => j.massivePerilThreshold).sort((a, b) => b - a).join() === '-5,-9,-12', '5 death cards; Massive Peril thresholds -5/-9/-12');
ok(M.grave.filter(c => c.name === 'Disemboweled').length === 3, 'three Disemboweled');
const cnames = new Set(C.conditions.map(c => c.name));
ok(C.conditions.every(c => !c.flipSide || cnames.has(c.flipSide)) && C.conditions.filter(c => c.flipSide).length === 14, '7 flip pairs symmetric');
for (const n of ['Knockdown (Falling Down)', 'Distracted', 'Choked', 'Exposed']) ok(cnames.has(n), `condition exists: ${n}`);
const mentioned = [...E.cards.ai, ...E.cards.bp].flatMap(c => [...(c.effects || []), ...Object.values(c.responses || {})]).filter(Boolean).join(' ');
ok(/Distracted/.test(mentioned) && cnames.has('Distracted'), 'Eggknight-referenced Condition (Distracted) exists');
ok(T.terrain.length === 15 && T.terrain.find(t => t.name === 'Column').keywords.join() === 'Destructible,Obscuring,Obstacle', '15 terrain; Column = Destructible/Obscuring/Obstacle');
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
