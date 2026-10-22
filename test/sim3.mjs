import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = { primordials: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/primordials/' + i + '.json')])), scenarios: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/scenarios/' + i + '.json')])), titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
const loadout = [
  { name: 'A', cls: 'dreamwalker', gear: ['Hekatomb', 'Knuckle Shield', 'Smelted Breastplate', 'Analyticos Module', 'Spring Harness'] },
  { name: 'B', cls: 'earthshaker', gear: ['Pillarmace', 'Hekaton Panoply Armor', 'Impetus Breakers', 'Spring Harness'] },
  { name: 'C', cls: 'mazerunner', gear: ['Whale Knives', 'Bull Aspis', 'Instinct Linothorax', 'Aeolipile Engine'] },
  { name: 'D', cls: 'logicbreaker', gear: ['Rebound Hammer', 'Smelted Breastplate', 'Analyticos Module', 'Iapetus Lifeguard'] },
];
const N = +process.argv[2] || 100; const level = +process.argv[3] || 1; const pid = process.argv[4] || 'hekaton'; const res = {}; let w = 0;
for (let i = 0; i < N; i++) {
  const seed = 9000 + i; let s = seed; const rng = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const g = new Game(data, { seed });
  g.ask = async q => { if (q.type === 'multi') return [];
    const o = q.options; const by = re => o.find(x => re.test(x.label));
    if (q.type === 'move') { const cells = q.cells; if (!cells.length) return null; let best = null, bd = 1e9; for (const c of cells) { const d = Math.min(...g.primCells().map(x => Math.abs(x.c - c.c) + Math.abs(x.r - c.r))); if (d < bd) { bd = d; best = c; } } const cur = Math.min(...g.primCells().map(x => Math.abs(x.c - q.titan.pos.c) + Math.abs(x.r - q.titan.pos.r))); return bd < cur ? best : null; }
    if (/후퇴/.test(q.title)) return false;
    if (/Rush/.test(q.title)) {}
    let x; if ((x = by(/^Rush|^Improved Rush/))) return x.value; if ((x = by(/^공격/))) return x.value; if ((x = by(/^이동/))) return x.value;
    if (/재굴림\?/.test(q.title) && q.titan && q.titan.fate < 6 && o.length > 1) return o[1].value;
    if (/Power Re-roll/.test(q.title) && o.length > 1) return o[1].value;
    if (q.type === 'yn') { if (/Block|Second Chance|Reflex|Pushback|Sacrifice|Heavy Kopis|Spotlight/.test(q.title)) return true; return false; }
    if (/Kratos Table/.test(q.title)) return 0;
    if (/종류 선택/.test(q.title)) return 'break';
    return o[0].value;
  };
  try { g.setup({ primordialId: pid, level, titans: loadout }); const r = await g.run(); res[r] = (res[r] || 0) + 1; w += g.woundCount(); } catch (e) { console.log('crash', seed, e.stack); break; }
}
console.log(pid, 'lv', level, res, 'avg wounds', (w / N).toFixed(1));
// cause analysis
{
  const counts = {}; const seedBase = 9000;
  for (let i = 0; i < 30; i++) {
    const g = new Game(data, { seed: seedBase + i }); let s = seedBase + i; const rng = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
    g.ask = async q => { const o = q.options; if (q.type === 'move') { const c = q.cells; if (!c.length) return null; let best = null, bd = 1e9; for (const x of c) { const d = Math.min(...g.primCells().map(p => Math.abs(p.c - x.c) + Math.abs(p.r - x.r))); if (d < bd) { bd = d; best = x; } } return best; } if (/후퇴/.test(q.title)) return false; const by = re => o.find(x => re.test(x.label)); let x; if ((x = by(/^공격/))) return x.value; if ((x = by(/^이동/))) return x.value; if (q.type === 'yn') return /Block|Second Chance|Pushback/.test(q.title); return o[0].value; };
    g.setup({ level: 1, titans: loadout }); await g.run();
    for (const l of g.log) { const k = /OBOL/.test(l.msg) ? 'obol' : /Danger \+/.test(l.msg) ? 'danger:' + (/\((.*)\)$/.exec(l.msg) || [])[1]?.replace(/\d/g,'') : /사망/.test(l.msg) ? 'death:' + l.msg.slice(0, 30) : /WOUND/.test(l.msg) ? 'wound' : /Full Evade/.test(l.msg) ? 'fullevade' : /회피 굴림 결과/.test(l.msg) ? 'evroll' : null; if (k) counts[k] = (counts[k] || 0) + 1; }
  }
  console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 30));
}
