import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const names = data.gear.cards.map(c => c.name).filter(n => n !== 'Fists'); const classes = Object.keys(data.titans.classes);
const N = +process.argv[2] || 60; let crashes = 0; const res = {}; const feat = {}; const un = {}; const rounds = [];
const PAT = [/Sun Move/, /Unshaded 대상/, /Merciless Sun!/, /Feathery Ascent VP/, /Hold On! \(VP/, /소각/, /Black Lake/, /Triple Laser/, /Omnilaser/, /Rapid Adaptation/, /자동 실패/, /Regurgitate:/, /Consumed/, /Predation!/, /Bleeding 토큰/, /Pull \d/, /Devour Whole/, /Bloodlost/, /Perfection/, /Deep Cut/, /Rupture Veins/, /Vorpal Cut/, /Tear to Pieces/, /Apex Predator/, /Double the Pull/, /Black Ice/, /Slippery/,/Laser 대상/, /Double Laser/, /Omnilaser/, /옆으로 반사/, /파괴/, /Rewind → Time Anchor/, /Time Anchor가 없음/, /Time-clocked — Departing/, /Time-clocked — Arriving/, /Timefront \d칸 전진/, /Timefront \d칸 후퇴/, /존재에서 지워짐/, /텔레포트/, /Glaciate:/, /Giant Glaciate:/, /Voracious Parasite/, /Once Upon A Time: 토큰 4개/, /In Medias Res:/, /Darkest Timeline: /, /Tyranny of Stars:/, /Omega Terminus로/, /Omega Terminus에서/, /Gaze of the Void/, /Extinguish Possibilities: .*제거/, /ATEMPORAL/, /Quantum Eye/, /Lateral 이동/, /Temporal Ruthlessness/, /Layover/, /Death 토큰/, /Fate \+\d.*보너스/, /멀어짐/, /Timefront 쪽으로/, /Overclocked/, /반복 →/, /Paradox \+1/, /🏆/];
for (let i = 0; i < N; i++) {
  const seed = 9100 + i; let s = seed; const rng = () => { s = (s * 48271) % 2147483647; return s / 2147483647; }; const pick = a => a[Math.floor(rng() * a.length)];
  const MN = data.argonauts.mnemos.map(m => m.name); const PO = data.argonauts.portraits.map(p => p.code);
  const titans = Array.from({ length: 4 }, (_, k) => ({ name: 'T' + k, portrait: pick(PO), chosenSkill: 'Fury', mnemos: [{ name: pick(MN), level: 2 }, { name: pick(MN), level: 1 }], fated: [], cls: pick(classes), gear: Array.from({ length: 3 }, () => pick(names)) }));
  const level = 1 + (i % 9);
  const g = new Game(data, { seed });
  g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') { const c = q.cells; if (!c.length) return null; if (rng() < 0.75) { const s2 = [...c].sort((a, b) => b.c - a.c); return s2[Math.floor(rng() * Math.min(3, s2.length))]; } return c[Math.floor(rng() * c.length)]; } if (/후퇴/.test(q.title)) return false; const o = q.options; const at = o.find(x => /^공격/.test(x.label)); if (at && rng() < 0.7) return at.value; return o[Math.floor(rng() * o.length)].value; };
  try { g.setup({ primordialId: process.env.PID || 'hypertime', level, titans, argo: ['Chronosphere Warning System','Fate Converter','Opportunity Freeze','Possibility Matrix','Quantum Armory','Reverse Timeflow','Telehealing','Time Dilation','Time Skip'], awakening: { enabled: true, spark: true }, paradox: i % 4 }); const r = await g.run(); res[r] = (res[r] || 0) + 1; rounds.push(g.round);
    for (const l of g.log) { for (const p of PAT) if (p.test(l.msg)) feat[p.source] = (feat[p.source] || 0) + 1; if (/미구현|수동 적용/.test(l.msg)) un[l.msg] = (un[l.msg] || 0) + 1; } if (i === 0 && process.env.LOG) console.log(g.log.map(l => l.msg).join('\n')); }
  catch (e) { crashes++; console.log('seed', seed, 'lv', level, e.stack.split('\n').slice(0, 5).join('\n'), '\n', g.log.slice(-10).map(l => l.msg).join('\n')); if (crashes > 4) break; }
}
console.log(res, 'crashes', crashes, 'avg rounds', (rounds.reduce((a, b) => a + b, 0) / rounds.length).toFixed(1)); console.log(feat); console.log(un);
