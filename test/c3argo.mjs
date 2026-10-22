import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ARGO = ['Chronosphere Warning System', 'Fate Converter', 'Opportunity Freeze', 'Possibility Matrix', 'Quantum Armory', 'Reverse Timeflow', 'Telehealing', 'Time Dilation', 'Time Skip'];
const mk = (pid = 'hypertime') => { const g = new Game(data, { seed: 3 }); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: pid, level: 1, argo: ARGO, titans: ['ascender', 'returner', 'warkeeper', 'skyseer'].map((cls, k) => ({ name: cls, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls, gear: ['Sirenblade'] })) }); g.log.length = 0; return g; };
{ const g = mk(); ok(g.argo.length === 9, 'argo loaded ' + g.argo.length); const [A, R] = g.titans;
  R.fate = 5; await g.resolveArgo('Fate Converter', A); const tgt = g.titans.find(t => g.log.some(l => l.msg.includes(t.name + ': Fate −2'))); ok(!!tgt, 'Fate Converter');
  const top = g.trauma.minor.cards[0]; await g.resolveArgo('Possibility Matrix', A); ok(g.trauma.minor.cards[0] !== top && g.trauma.minor.cards[g.trauma.minor.cards.length - 1] === top, 'Possibility Matrix');
  const n0 = A.gear.length; await g.resolveArgo('Quantum Armory', A); ok(A.gear.some(x => x.card.name !== 'Sirenblade' && x.card.name !== 'Fists' && /^hand/.test(x.card.slot)), 'Quantum Armory equips');
  await g.addCondition(R, 'Bleeding', { tokens: 3 }); g.ask = async q => { if (q.title === '대상 타이탄 선택') return q.options.find(o => o.value === R)?.value; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  await g.resolveArgo('Telehealing', A); ok(R.bleeding === 1, 'Telehealing −2 bleeding ' + R.bleeding);
  if (g.timeClock) { await g.timeClock(R); ok(R.offBoard === 'clock', 'clocked'); await g.resolveArgo('Reverse Timeflow', A); ok(!R.offBoard, 'Reverse Timeflow arrives'); }
  g._actor = A; A.turn.moved = A.turn.attacked = true; g.ask = async q => { if (q.title === '대상 타이탄 선택') return A; if (q.type === 'move') return null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  await g.resolveArgo('Time Skip', A); ok(A.turn.attacked === false, 'Time Skip gives combat action'); }
{ const g = mk(); const A = g.titans[0]; g.kratosPool.break = 2; await g.argoHook('Opportunity Freeze', 'x', A); ok(g.argo.find(a => a.card.name === 'Opportunity Freeze').charges === 1, 'Opportunity Freeze hook'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
{ const g = mk(); const A = g.titans[0]; ok(!g.argoActions(A).some(a => /Chronosphere/.test(a.label)) && g.argoActions(A, true).some(a => /Chronosphere/.test(a.label)), 'Chronosphere window only'); }
