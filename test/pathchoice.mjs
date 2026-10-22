import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = { primordials: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/primordials/' + i + '.json')])), scenarios: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'].map(i => [i, rd('../data/scenarios/' + i + '.json')])), titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
const g = new Game(data, { seed: 3 }); let asked = null;
g.ask = async q => { if (/이동 경로/.test(q.title)) { asked = q; return q.options[q.options.length - 1].value; } if (q.type === 'multi') return []; return (q.options.find(o => o.value === null) || q.options[0]).value; };
g.setup({ primordialId: 'hekaton', level: 1, titans: ['A', 'B', 'C', 'D'].map((n, k) => ({ name: n, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls: 'dreamwalker', gear: k === 0 ? ['Sirenblade', 'Kratos Kopis'] : ['Sirenblade'] })) });
const [A, B, C, D] = g.titans; A.pos = { c: 15, r: 14 }; B.pos = { c: 12, r: 11 }; C.pos = { c: 1, r: 1 }; D.pos = { c: 2, r: 1 };
const path = await g.choosePrimPath(A.pos, 6, [A]);
console.log('options:'); for (const o of asked.options) console.log('  ', o.label);
console.log('chosen end', path[path.length - 1]);
// bonus attack with exhausted weapon
A.pos = { c: 12, r: 10 }; g.prim.anchor = { c: 10, r: 10 }; for (const x of A.gear) x.exhausted = true; g.log.length = 0;
g.ask = async q => { if (q.type === 'multi') return []; if (/무기/.test(q.title)) { console.log('weapon prompt:', q.title, q.options.map(o => o.label)); return q.options[0].value; } return (q.options.find(o => o.value === false) || q.options[0]).value; };
await g.safe(() => g.bonusAttackFlow(A));
console.log(g.log.map(l => l.msg).filter(m => /보너스|준비|공격 선언/.test(m)).join('\n'));
