import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt', 'meduketos', 'titanx', 'dragonofphobos', 'urfleece'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const yes = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (lv = 1, seed = 41) => { const g = new Game(data, { seed }); g.ask = yes; g.setup({ primordialId: 'urfleece', level: lv, argo: [], awakening: { enabled: true, spark: true }, titans: [0, 1, 2, 3].map(i => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear: ['Sirenblade', 'Siren Shield'] })) }); g.log.length = 0; return g; };
const has = (g, re) => g.log.some(l => re.test(l.msg));
const catchD = async f => { try { await f(); } catch (e) { if (!e.titan && !e.chainBreak && !e.result) throw e; } };

const G = n => data.decks.godforms.find(g => g.name === n);
{ const g = mk(1); await g.startOfBattle(); const [A, B] = g.titans; g.ask = async q => { if (q.type === 'choice' && /Till Death/.test(q.title)) return B; return yes(q); }; try { await g.awaken(A, { force: G('Hera'), inline: true }); } catch (e) { if (!e.chainBreak) throw e; }
  ok(B.pt && !A.pt && A.godform.heraBond === B, 'Hera: bonded Titan gets PT'); const tr = A.godform.trespass; await catchD(() => g.kill(B, { fromObol: true })); ok(B.alive, 'Hera: bonded Titan cannot die from Obol'); await catchD(() => g.obolDraw(B, 10)); ok(A.godform && A.godform.trespass === tr - 1 && B.alive, 'Hera: Obol draw costs Trespass'); ok(g.scornedMother(A), 'Scorned Mother vs Ur-Fleece'); }
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; try { await g.awaken(A, { force: G('Poseidon Exalted'), inline: true }); } catch (e) { if (!e.chainBreak) throw e; } A.oxygen = 0; await catchD(() => g.flipOxygen(A, 1)); ok(A.alive, 'Poseidon Exalted: no Oxygen death'); A.ambrosia = 99; await catchD(() => g.ambOver(A)); ok(A.alive, 'Poseidon Exalted: no Ambrosia death'); ok(g.freeActions(A).some(o => /Source and Sacrifice/.test(o.label)), 'Source and Sacrifice action'); }
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; try { await g.awaken(A, { force: G('Zeus Exalted'), inline: true }); } catch (e) { if (!e.chainBreak) throw e; } g.titans.slice(1).forEach(x => x.alive = false); A.despair = 9; await catchD(() => g.checkDespair(A)); ok(A.alive, 'Zeus Exalted: no Despair death'); A.conditions = ['Dread']; await catchD(() => g.addCondition(A, 'Dread')); ok(A.alive, 'Zeus Exalted: no Dread death'); }
{ const g = mk(1); await g.startOfBattle(); const A = g.titans[0]; A.gear.push({ card: { name: 'Lamp A', text: 'Light 2.', slot: 'support' } }, { card: { name: 'Lamp B', text: 'Light 1.', slot: 'support' } }); await g.gainAmbrosia(A, 2); const s = A.gear.filter(x => x.smo > 0); ok(s.length === 1 && s[0].smo === 2, 'Smother: all tokens on a single element'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
