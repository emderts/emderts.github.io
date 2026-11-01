// Rosegraal Rewards table (pp.92–96): completeness + eligibility rules.
import fs from 'fs';
import { eligibleRewards, rewardId } from '../src/engine/rosegraal.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const R = rd('../data/rosegraal/rewards.json');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const knights = Object.keys(R.knights); const kinds = Object.keys(R.kinds);
ok(knights.length === 7 && kinds.join('') === 'CHPTVGW', '7 knights × 7 reward kinds');
let boxes = 0;
for (const lv of ['1', '2', '3', '4', '5']) for (const k of knights) {
  const row = R.levels[lv][k];
  ok(row && kinds.every(x => Array.isArray(row[x]) && row[x].length >= 1), `level ${lv} ${k}: every kind has ≥1 reward`);
  boxes += kinds.reduce((a, x) => a + row[x].length, 0);
  ok(JSON.stringify(row.H) === JSON.stringify(row.P), `level ${lv} ${k}: Heroic Arc and Peril Arc share names`);
  ok(row.T.length === 2 && row.T.every(t => t.kind === 'technique'), `level ${lv} ${k}: two Technique rewards`);
  ok(row.V.every(v => Object.keys(v.bonuses).every(n => R.virtues.includes(n))), `level ${lv} ${k}: virtue names valid`);
  ok(row.W.every(w => ['rapport', 'mercenary', 'saint', 'gold'].includes(w.kind)), `level ${lv} ${k}: wild card kind valid`);
  if (lv === '2' || lv === '4') ok(row.C.filter(c => c.kind === 'portrait').length === 2 && row.C.filter(c => c.kind === 'technique').length === 4 && row.H.length === 2, `level ${lv} ${k}: 2 portraits + 4 techniques, 2 arcs`);
  else ok(row.C.length === 1 && row.C[0].kind === 'technique' && row.H.length === 1, `level ${lv} ${k}: 1 class technique, 1 arc`);
}
ok(boxes === 378, `378 reward checkboxes total (${boxes})`);
{ const e = eligibleRewards(R, 'kara', 'T', 3); ok(e.length === 6 && e[0].level === 1 && e.at(-1).level === 3, 'node level 3 Technique: 6 options from levels 1–3'); }
{ const claimed = new Set([rewardId('kara', 1, 'T', 0), rewardId('kara', 1, 'T', 1)]); const e = eligibleRewards(R, 'kara', 'T', 1, claimed); ok(e.length === 0, 'all level-1 techniques claimed → nothing left at a level-1 node'); }
{ const e = eligibleRewards(R, 'fleischritter', 'C', 2); ok(e.length === 7 && e.filter(x => x.reward.kind === 'portrait').length === 2, 'level 2 Class: 1 (L1) + 6 (L2) incl. 2 portraits'); }
ok(eligibleRewards(R, 'kara', 'S', 5).length === 0, 'Sigh node has no table reward');
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
