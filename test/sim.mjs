import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = { primordials: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/primordials/' + i + '.json')])), scenarios: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/scenarios/' + i + '.json')])), titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
const loadout = [
  { name: 'Herodotus', cls: 'dreamwalker', gear: ['Sirenblade', 'Siren Shield', 'Siren Panoply Armor', 'Iapetus Lifeguard'] },
  { name: 'Ulyssea', cls: 'dreamwalker', gear: ['Boatmace', 'Sail Spolas', 'Spring Harness'] },
  { name: 'Philoctera', cls: 'dreamwalker', gear: ['Sirenteeth', 'Sail Spolas', 'Makesheath'] },
  { name: 'Solon', cls: 'dreamwalker', gear: ['Kratos Kopis', 'Shipwrecker Shield', 'Siren Panoply Armor'] },
];
// auto-player: prefer attacking, move toward primordial, say yes to cheap stuff randomly
function makeAsk(g, rng) {
  return async q => { if (q.type === 'multi') return [];
    const opts = q.options;
    if (q.type === 'move') { // pick cell closest to the primordial (adjacent if possible)
      const cells = q.cells; if (!cells.length) return null; let best = null, bd = 1e9; for (const c of cells) { const d = Math.min(...g.primCells().map(x => Math.abs(x.c - c.c) + Math.abs(x.r - c.r))); if (d < bd) { bd = d; best = c; } } const cur = Math.min(...g.primCells().map(x => Math.abs(x.c - q.titan.pos.c) + Math.abs(x.r - q.titan.pos.r))); return bd < cur ? best : null;
    }
    const byLabel = re => opts.find(o => re.test(o.label));
    let o;
    if ((o = byLabel(/^공격/))) return o.value;
    if ((o = byLabel(/^이동/))) return o.value;
    if (/후퇴/.test(q.title)) return false;
    if (q.type === 'yn') return rng() < 0.5 ? opts[0].value : opts[1].value;
    if (/재굴림/.test(q.title)) return rng() < 0.3 ? opts[Math.min(1, opts.length - 1)].value : opts[0].value;
    return opts[Math.floor(rng() * opts.length)].value;
  };
}
const N = +process.argv[2] || 50; const level = +process.argv[3] || 1; const verbose = process.argv.includes('-v');
const results = {}; let totalRounds = 0, wounds = 0;
for (let i = 0; i < N; i++) {
  const seed = 1000 + i; let s = seed; const rng = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const g = new Game(data, { seed, onLog: verbose ? (m, c) => console.log((c ? `[${c}] ` : '') + m) : null });
  g.ask = makeAsk(g, rng);
  try { g.setup({ level, titans: loadout }); const r = await g.run(); results[r] = (results[r] || 0) + 1; totalRounds += g.round; wounds += g.woundCount(); }
  catch (e) { console.error(`seed ${seed} CRASH:`, e.stack); results.crash = (results.crash || 0) + 1; if (!verbose) { console.log(g.log.slice(-25).map(l => l.msg).join('\n')); } break; }
}
console.log('level', level, 'results', results, 'avg rounds', (totalRounds / N).toFixed(1), 'avg wounds', (wounds / N).toFixed(1));
