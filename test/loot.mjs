import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const mk = (pid, gears, lv = 3) => { const g = new Game(data, { seed: 4 }); g.ask = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: pid, level: lv, argo: [], titans: gears.map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
{ const g = mk('chimera', [['Muck Virus', 'Jaws of the Lion', 'Elephantine Armor'], ['Cowl of Char', 'Red Polis'], ['The End'], ['Necrotic Virus', 'Umbral Virus']]); const [A, B, C, D] = g.titans;
  await g.startOfBattle(); ok(A.ambrosia === 1 && B.ambrosia === 1 && B.rage === 1 && D.ambrosia === 2, 'start of battle ambrosia/rage');
  ok(B.conditions.includes('Berserk') && C.conditions.includes('Hatred'), 'Berserk / Hatred at start');
  ok(g.precisionMods(D) >= 1, 'Necrotic +1 Precision');
  A.danger = 5; A.fate = 0; g.ask = async q => q.options ? q.options[0].value : null; const k0 = g.kratosPool.opening; await g.gainDanger(A, 3, { source: 'test' }); ok(A.danger === 7 && g.kratosPool.opening === k0 + 2, `Soak (−1) + Jaws 2 tokens: D${A.danger} O${g.kratosPool.opening}`);
  D.ambrosia = 3; ok(/Transform/.test(g.gearText(D.gear[0], D)), 'Necrotic anyGate amb 3+ → Transform text');
  ok(g.nonWeaponKW(B, B.gear[1], 'Fire') === 1, 'Cowl Fire 1 counts');
}
{ const g = mk('hekaton', [["Sisyphus's Triumph"], ['Immeasurable Weight'], ["Horizon's Edge"], ['Skyreach', 'Context']]); const [A, B, C, D] = g.titans;
  ok(A.gear.filter(x => x.card.name === 'Fists').length === 0, 'handAll: no Fists');
  B.rage = 7; ok(/black Power die instead/.test(g.gearText(B.gear[0], B)), 'Rage 7+ gate');
  const n = await g.reduceSuffered(B, 'Kickbacks', 5); ok(n === 3, 'Immeasurable reduces Kickback by 2');
  // Skyreach reaction appears when not target
  D.fate = 0; const card = data.primordials.hekaton.ai.find(a => a.kind === 'ATTACK'); let saw = false; g.ask = async q => { if (q.options && q.options.some(o => /Skyreach/.test(o.label))) saw = true; return q.options ? q.options[0].value : null; }; await g.reactionWindow(A, card, 'test'); ok(saw, 'Skyreach offered to non-target');
}
{ const g = mk('chimera', [['Pyrasclepios']], 3); const [A] = g.titans; A.danger = 5; g._judging = A; await g.kill(A).catch(e => { if (!e.titan && !e.result && !/Battle over/.test(e.message)) throw e; }); ok(g.log.some(l => /심판 즉사 대신 Obol/.test(l.msg)), 'Pyrasclepios judgement death → obol'); }
{ const g = mk('chimera', [['Fumeblade (Bared)', 'Leg Khopesh'], ['Necrotic Virus', 'Umbral Virus'], ['Voice of the People', 'Left Maulfist'], ['Pyramidion']]); const [A, B, C, D] = g.titans; g.ask = async q => q.options ? (q.options.find(o => o.value === false) || q.options[0]).value : null;
  await g.startOfBattle(); ok(A.gear[0].card.name === 'Fumeblade (Bared)' && B.gear[0].card.name === 'Necrotic Virus', 'Must start this side up');
  ok(D.conditions.includes('Dread'), 'Pyramidion Dread at start');
  const fa = g.freeActions(A); ok(fa.some(o => /Leg Khopesh: Transform → Leg Spear \(무료\)/.test(o.label)), 'Leg Khopesh free transform'); ok(!fa.some(o => /Fumeblade \(Bared\): Transform/.test(o.label)), 'Fumeblade no plain transform');
  A.pos = { c: 1, r: 1 }; g.prim.facing = 'S'; await fa.find(o => /즉시 Hide/.test(o.label)).value(); ok(A.hidden && A.gear[0].card.name === 'Fumeblade (Hidden)', 'Fumeblade hide → Hidden side');
  await g.loseHidden(A, 'test'); ok(A.gear[0].card.name === 'Fumeblade (Bared)', 'lose Hidden → transform back');
  B.ambrosia = 3; const fb = g.freeActions(B); ok(fb.some(o => /Necrotic Virus: Transform → Necroxiphos/.test(o.label)), 'Necrotic Virus transform at Amb 3+'); await fb.find(o => /Necroxiphos/.test(o.label)).value(); ok(B.gear[0].card.name === 'Necroxiphos' && B.ambrosia === 2, 'Necroxiphos: discard ambrosia');
  B.fate = 8; const fb2 = g.freeActions(B); const um = fb2.find(o => /Umbral Carapace/.test(o.label)); ok(um, 'Umbral transform at Fate 8+'); await um.value(); ok(g.skill(B, 'Wisdom') === (B.argonaut.skills.Wisdom || 0) - 1, 'Umbral Carapace Wisdom -1');
  D.tokens.precision = 0; D.conditions = []; g.ask = async q => q.options ? q.options[0].value : null; await g.negPrec(D, 1); ok(D.tokens.precision === 0, 'Pyramidion: Fear instead of −Precision');
  const fc = g.freeActions(C); ok(fc.some(o => /Peaceful Transition \(Fate\+1\)/.test(o.label)), 'Voice Ψ Transform');
}
{ const g = mk('chimera', [["Sisyphus's Triumph"]]); const [A] = g.titans; A.despair = 1; A.ambrosia = 3; A.conditions = ['Dread']; ok(g.conditionTokens(A) === 3, 'Condition tokens = Despair 1 + Dread 2 (Ambrosia 제외)'); }
