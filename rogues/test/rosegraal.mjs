// Monster tables (p.77): every level/kingdom covers d10 results 1..10 exactly once; rollMonster honours the re-roll rule.
import fs from 'fs';
import { Rng } from '../src/engine/core.js';
import { rollMonster, monsterTable, TIER_NAMES } from '../src/engine/rosegraal.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const T = rd('../data/rosegraal/monster_tables.json');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

for (const lv of [1, 2, 3, 4, 5]) for (const k of ['principality', 'sunken']) {
  const rows = monsterTable(T, lv, k); const seen = new Map();
  for (const r of rows) for (const n of r.roll) seen.set(n, (seen.get(n) || 0) + 1);
  ok([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(n => seen.get(n) === 1), `level ${lv} ${k}: rolls 1–10 covered exactly once (${rows.length} rows)`);
  ok(rows.every(r => T.monsterNames[r.monster] && r.level >= 1 && r.level <= 4), `level ${lv} ${k}: every row names a known monster with level 1–4`);
}
ok(Object.values(TIER_NAMES).join() === 'Mob,Vassal,King,Devil,Dragon', 'tier names I–V');

{ // deterministic roll
  const r = rollMonster(T, new Rng(1), 1, 'principality');
  ok(r.roll >= 1 && r.roll <= 10 && r.rerolled === 0 && r.name, `roll without ownership filter: ${r.roll} → ${r.name} L${r.level}`);
}
{ // re-roll starred monsters not owned: own only the non-optional ones
  const owned = new Set(Object.keys(T.monsterNames).filter(id => !T.levels['1'].principality.some(r => r.monster === id && r.optional)));
  let rerolls = 0, bad = 0;
  for (let s = 0; s < 300; s++) { const r = rollMonster(T, new Rng(s), 1, 'principality', owned); rerolls += r.rerolled; if (!owned.has(r.monster)) bad++; }
  ok(bad === 0 && rerolls > 0, `starred monsters never returned when not owned (${rerolls} re-rolls over 300 seeds)`);
}
{ let threw = false; try { rollMonster(T, new Rng(1), 5, 'sunken', new Set(['eggknight'])); } catch (e) { threw = true; } ok(threw, 'table with no owned monster throws instead of looping'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
