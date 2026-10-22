import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const mk = (pid = 'pursuer') => { const g = new Game(data, { seed: 11 }); g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: pid, level: 3, argo: ['Ambrosia Containment', 'Forced Kratos Cooldown', 'Trireme Ballista Fire', 'Hyperadrenaline Infusion'], titans: [
    { name: 'A', portrait: data.argonauts.portraits[0].code, chosenSkill: 'Fury', mnemos: [{ name: 'Castoff', level: 2 }, { name: 'Death Precedes', level: 1 }], fated: ['Hapless', 'Weak'], cls: 'dreamwalker', gear: ['Sirenblade', 'Kratos Kopis'] },
    { name: 'B', portrait: data.argonauts.portraits[1].code, chosenSkill: 'Fury', mnemos: [{ name: 'Spewed by the Abyss', level: 2 }], fated: ['Reluctant', 'Clumsy', 'Ambrosia Addiction'], cls: 'dreamwalker', gear: ['Sirenblade', 'Boatmace'] },
    { name: 'C', portrait: data.argonauts.portraits[2].code, chosenSkill: 'Fury', mnemos: [{ name: "Coward's Way", level: 2 }], fated: ['Scapegoat'], cls: 'dreamwalker', gear: ['Sirenblade'] },
    { name: 'D', portrait: data.argonauts.portraits[3].code, chosenSkill: 'Fury', mnemos: [{ name: 'Scorned Champion', level: 2 }], fated: [], cls: 'dreamwalker', gear: ['Sirenblade'] }] }); g.log.length = 0; return g; };
const g = mk(); const [A, B, C, D] = g.titans;
console.log('A skills', A.argonaut.skills, 'B amb limit', g.ambLimit(B), 'B weapons', g.data && B.gear.map(x => x.card.name + (g.gearBlocked(B, x) ? '(blocked)' : '')));
await g.startOfBattle(); console.log('C pt/locked', C.pt, C.ptLocked);
await g.gainAmbrosia(B, 3); console.log('B ambrosia', B.ambrosia);
await g.gainRage(A, 1); console.log('A rage', A.rage);
A.danger = 9; await g.solo(() => g.obolDraw(A, 10));
A.alive = true; A.knockdown = null; await g.knockdown(A); g.standUp(A); console.log('castoffBuff', A.castoffBuff, 'speed', g.speedOf(A));
await g.solo(() => g.gainFated(D)); console.log('D fated', D.fated, D.argonaut.skills);
console.log(g.log.map(l => '  ' + l.msg).join('\n'));
console.log('=== keywords');
{ const g2 = mk('hekaton'); const [A2, B2] = g2.titans; A2.mnemos = [{ card: data.argonauts.mnemos.find(m => m.name === 'Forbidden Love'), level: 3, exhausted: false }, { card: data.argonauts.mnemos.find(m => m.name === 'Scorned Champion'), level: 1, exhausted: false }]; A2.danger = 5;
  const a = g2.prim.anchor; A2.pos = { c: a.c - 1, r: a.r }; g2.prim.facing = 'W'; B2.knockdown = 'falling'; g2.rng.d10 = () => 9;
  await g2.chainSafe(() => g2.titanAttack(A2)); console.log('facing', g2.prim.facing, 'inRear', g2.inRear(A2.pos), 'B kd', B2.knockdown, 'pool rouse', g2.kratosPool.rouse);
  g2.titans[2].rage = 2; g2.titans[2].rouseBonus = g2.kratosPool.rouse; console.log('C kratos rows with rouse', g2.kratosRows(g2.titans[2]).map(r => r.level));
  A2.mnemos[1].exhausted = false; const col = [...g2.board.terrain.values()].find(x => x.type === 'Column').cell; A2.pos = { c: col.c - 1, r: col.r }; const r = g2.reachJump(A2, 2, new Set()); console.log('jump over column reaches', `${col.c + 1},${col.r}`, r.has(`${col.c + 1},${col.r}`), 'ends on column?', r.has(`${col.c},${col.r}`));
  console.log(g2.log.map(l => '  ' + l.msg).filter(m => /Daze|Inspire|Rouse|기립/.test(m)).join('\n')); }
