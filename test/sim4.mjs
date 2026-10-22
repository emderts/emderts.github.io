import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = { primordials: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/primordials/' + i + '.json')])), scenarios: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/scenarios/' + i + '.json')])), titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
const names = data.gear.cards.filter(c => process.argv[4] === 'all' ? true : c.cycle === 2).map(c => c.name).filter(n => n !== 'Fists');
const classes = Object.keys(data.titans.classes);
const N = +process.argv[2] || 100; let crashes = 0; const res = {}; const unimpl = {};
for (let i = 0; i < N; i++) {
  const seed = 9000 + i; let s = seed; const rng = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const MN = data.argonauts.mnemos.map(m => m.name); const PO = data.argonauts.portraits.map(p => p.code);
  const titans = Array.from({ length: 4 }, (_, k) => ({ name: 'T' + k, portrait: pick(PO), chosenSkill: 'Fury', mnemos: [{ name: pick(MN), level: 2 + (rng() < 0.4 ? 1 : 0) }, { name: pick(MN), level: 1 }], fated: rng() < 0.4 ? [pick(data.argonauts.fatedMnemos.map(f => f.name))] : [], cls: pick(classes), gear: Array.from({ length: 2 + Math.floor(rng() * 3) }, () => pick(names)).concat(rng() < 0.5 ? ['Fists'] : []) }));
  const PR = process.argv[3] || 'mix'; const pid = PR === 'mix' ? ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'][i % 8] : PR;
  const level = pid === 'hekaton' ? Math.floor(rng() * 10) : 1 + Math.floor(rng() * 9);
  const g = new Game(data, { seed });
  g.ask = async q => { if (q.type === 'multi') return q.options.filter(() => rng() < 0.4).slice(0, q.max).map(o => o.value); if (q.type === 'move') { const c = q.cells; return c.length && rng() < 0.8 ? c[Math.floor(rng() * c.length)] : null; } if (/후퇴/.test(q.title)) return false; const o = q.options; return o[Math.floor(rng() * o.length)].value; };
  try { g.setup({ primordialId: pid, level, titans, argo: data.argonauts.argoAbilities.cards.map(c => c.name).sort(() => rng() - .5).slice(0, 4), awakening: { enabled: true, spark: true } }); const r = await g.run(); const k = pid + ':' + r; res[k] = (res[k] || 0) + 1; for (const l of g.log) if (/미구현|수동 적용/.test(l.msg)) unimpl[l.msg] = (unimpl[l.msg] || 0) + 1; }
  catch (e) { crashes++; console.log(`seed ${seed} ${pid} lv${level} ${titans.map(t => t.cls + ':' + t.gear.join('/')).join(' | ')}\n`, e.stack.split('\n').slice(0, 4).join('\n'), '\n', g.log.slice(-8).map(l => l.msg).join('\n'), '\n'); if (crashes > 5) break; }
}
console.log('results', res, 'crashes', crashes); console.log(unimpl);
