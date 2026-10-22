import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const g = new Game(data, { seed: 21 }); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
g.setup({ primordialId: 'hekaton', level: 1, titans: [['firestarter', ['Sirenblade', 'Kratos Kopis']], ['warkeeper', ['Pillarmace', 'Sirenblade']], ['abysswatcher', ['Sirenblade', 'Kratos Kopis']], ['skyseer', ['Sirenblade']]].map(([cls, gear], k) => ({ name: cls, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls, gear })) });
g.log.length = 0; const [F, W, A, S] = g.titans;
console.log('speeds', g.titans.map(t => g.speedOf(t)), 'abyss amb limit', g.ambLimit(A));
await g.knockdown(F); console.log('F knockdown', F.knockdown);
await g.addCondition(A, 'Fear'); await g.gainDespair(A, 1); console.log('A cond', A.conditions, A.despair);
g.kratosPool.fire = 2; g.kratosPool.hope = 1; g.kratosPool.break = 1; console.log('convert pot3 blank1 →', g.convertTokens(3, 1), 'fire left', g.kratosPool.fire); g.clearPool(); console.log('after clear fire', g.kratosPool.fire);
S.pos = { c: 3, r: 3 }; const r = g.reachDiag(S, 1, new Set()); console.log('skyseer diag reach 1', [...r.keys()].length);
// attack sims for each with forced good rolls
g.rng.d10 = () => 9; const a = g.prim.anchor;
for (const t of g.titans) { const a = g.prim.anchor; t.pos = { c: a.c - 1, r: a.r }; for (const o of g.titans) if (o !== t) o.pos = { c: 1 + g.titans.indexOf(o), r: 1 }; t.rage = 7; await g.chainSafe(() => g.titanAttack(t)); }
A.rage = 9; A.alive = true; A.pos = { c: g.prim.anchor.c - 1, r: g.prim.anchor.r }; await g.solo(() => g.titanAttack(A)); console.log('ofa', g.ofaPower);
const i0 = g.log.findIndex(l => /abysswatcher: 「/.test(l.msg)); console.log(g.log.slice(i0 - 2).map(l => '  ' + l.msg).join('\n'));
