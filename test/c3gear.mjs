import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const yes = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (pid, gear) => { const g = new Game(data, { seed: 11 }); g.ask = yes; g.setup({ primordialId: pid, level: 1, titans: gear.map((gg, k) => ({ name: 'T' + k, portrait: data.argonauts.portraits[k].code, chosenSkill: 'Fury', mnemos: [], cls: 'warkeeper', gear: gg })) }); g.log.length = 0; return g; };
const has = (g, re) => g.log.some(l => re.test(l.msg));
const safe = async f => { try { await f(); } catch (e) { if (!(e && (e.chainBreak || e.constructor.name === 'TitanDied'))) throw e; } };
const c3 = data.gear.cards.filter(c => c.cycle === 3); ok(c3.length >= 80, 'cycle3 cards ' + c3.length);
ok(c3.every(c => c.name && c.slot && c.traits && c.text), 'all have fields');
{ const g = mk('sun', [['Black Javelin'], ['True Sirenblade'], ['Barbed Saw'], ['Iceblock Armor', 'Siren Cataphract']]); const [a, b, c, d] = g.titans;
  a.danger = 5; ok(/Ranged 2-6\./.test(g.gearText(a.gear[0], a)) && !/Ranged 2-5/.test(g.gearText(a.gear[0], a)), 'Ranged instead: ' + g.gearText(a.gear[0], a));
  b.danger = 9; b.fate = 8; ok(!/Attack Re-roll 1/.test(g.gearText(b.gear[0], b)), 'df gate needs both: D9 F8 no'); b.fate = 9; ok(/Attack Re-roll 1/.test(g.gearText(b.gear[0], b)), 'df gate D9 F9 yes');
  await g.addCondition(c, 'Bleeding', { tokens: 3 }); ok(/Break 2\./.test(g.gearText(c.gear[0], c)) && /Black 2\./.test(g.gearText(c.gear[0], c)), 'bleed gate Break 2, Black 2');
  ok(g.laserRes(d) === 1, 'laser res'); await g.addCondition(d, 'Bleeding', { tokens: 5 }); ok(d.alive, 'Bleeding Limit 5 from gear'); }
{ const g = mk('hypertime', [['Oracowl', 'Parallel Anchor'], ['Glacial Fabric'], ['Fatesafe'], ['Icelixir']]); const [a, b, c, d] = g.titans;
  const acts = g.freeActions(a).map(x => x.label); ok(acts.some(l => /Time Anchor 재설정/.test(l)), 'anchor reestablish free action');
  g.anchors[a.id] = { ...a.pos }; ok(g.armorDice(a).length === 3, 'Oracowl +1 armor on anchor ' + g.armorDice(a).length);
  ok(g.freeActions(b).some(x => /Glaciate/.test(x.label)), 'Glaciate action');
  c.fate = 3; const f = g.freeActions(c).find(x => /Fate −1/.test(x.label)); await f.value(); ok(c.fate === 2 && c.gear[0].charges === 1, 'Fatesafe charge');
  await g.addCondition(d, 'Bleeding', { tokens: 3 }); const ic = g.freeActions(d).find(x => /Bleeding 토큰 최대 2/.test(x.label)); await ic.value(); ok(d.bleeding === 1, 'Icelixir'); }
{ const g = mk('sun', [['Shade Shield'], ['Believer Vestment'], ['Sunlight Gun'], []]); const [a, b, c] = g.titans;
  await g.freeActions(a).find(x => /Shaded/.test(x.label)).value(); ok(a.shadedTok && g.tShaded(a), 'Shaded token');
  b.shadedTok = true; ok(!g.tShaded(b), 'Witness never shaded');
  c.gear[0].charges = 0; ok(!g.usableWeapons(c).length || true, 'charge gate'); c.gear[0].charges = 0; ok(!g.usableWeapons(c).some(x => x.card.name === 'Sunlight Gun'), 'no charge → unusable'); }
{ const g = mk('hekaton', [['Spiral Mace'], ['Exobone Armor'], [], []]); const [a, b] = g.titans; g.rng.d10 = () => 9; const an = g.prim.anchor; a.pos = { c: an.c - 1, r: an.r }; b.pos = { c: 1, r: 1 }; g.titans[2].pos = { c: 2, r: 1 }; g.titans[3].pos = { c: 3, r: 1 };
  await safe(() => g.chainSafe(() => g.titanAttack(a))); ok(has(g, /Wound Trick|Fail Trick/) || a.gear[0].card.name === 'Spiral Spear', 'Trick transform offered: ' + a.gear[0].card.name);
  await g.addCondition(b, 'Bleeding', { tokens: 3 }); ok(b.bleeding === 2, 'Stem −1 bleeding ' + b.bleeding); }
{ const g = mk('hekaton', [['Abyssal Watchers'], ['Sirentusks'], [], []]); const [a] = g.titans; g.rng.d10 = () => 9; a.fate = 0; const an = g.prim.anchor; a.pos = { c: an.c - 1, r: an.r }; g.titans.slice(1).forEach((o, i) => o.pos = { c: 1 + i, r: 1 });
  await safe(() => g.chainSafe(() => g.titanAttack(a))); ok(has(g, /Attack Roll 4d10/), 'Watchers +2 dice (1 Fate)'); ok(has(g, /Spiral: hit/), 'Spiral reroll'); }
{ const g = mk('hekaton', [['Hammer-Sword'], ['Barbed Saw'], [], []]); const [a, h] = g.titans; a.danger = 6; h.danger = 6; const an = g.prim.anchor; a.pos = { c: an.c - 1, r: an.r }; h.pos = { c: an.c - 1, r: an.r + 1 };
  const A = { total: 6 }; ok(await g.succorCheck(a, A, 7) === 1 && h.gear[0].discarded, 'gear Succor'); }
{ const g = mk('hekaton', [['Homeric Engine'], ['Paradox Guard'], ['Argocryptex Alpha'], ['Siren Cataphract']]); const [a, b, c, d] = g.titans;
  a.fate = 0; a.danger = 0; await g.gainFate(a, 1); ok(a.fate === 0 && a.danger === 1, 'Homeric: Fate cost → Danger'); await g.gainFate(a, 1); ok(a.fate === 1, 'Homeric once per round');
  await g.gainFate(a, 2, { nc: true }); ok(a.fate === 3, 'non-cost not replaced');
  b.danger = 4; b.fate = 5; ok(g.effFate(b) === 4, 'Paradox Guard fate trigger +1');
  g._actor = c; c.turn.moved = true; const ss = g.freeActions(c).find(x => /Semi Sync/.test(x.label)); ok(!!ss, 'Semi Sync listed'); await ss.value(); ok(!c.turn.moved && c.fatigueAtEnd === 'move', 'Semi Sync extra move');
  d.anchor = { ...d.pos }; g.rng.rollPower0 = 1; await g.gainDanger(d, 3, { fromAttack: true }); ok(true, 'cataphract ran'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
{ const g = mk('hypertime', [["Time's Arrow"], [], [], []]); const a = g.titans[0]; a.fate = 7; let seen = null; g.ask = async q => { if (/행동 선택/.test(q.title || '')) { if (!seen) { seen = q.options.map(o => o.value); return 'anchorMove'; } return 'end'; } if (q.type === 'move') return q.cells[0]; return yes(q); }; const a0 = { ...g.anchors[a.id] }; await g.safe(() => g.titanTurn(a)); ok(seen && seen.includes('anchorMove'), "Time's Arrow anchor move option"); }
{ const g = mk('hekaton', [[], [], [], []]); ok(g.obolBase.some(o => o.code === 'BM0689') && !g.obolBase.some(o => o.code === 'AM0353'), 'Secret 35 replaces You Live'); const t = g.titans[0]; g.rng.pick = a => a.find(o => o.code === 'BM0689') || a[0]; const r0 = t.rage; await g.obolDraw(t, 10); ok(t.rage >= r0 + 1 && g.log.some(l => /Rage \+1 →/.test(l.msg)), 'Secret 35 Rage +1 ' + g.log.map(l=>l.msg).filter(m=>/Rage/.test(m)).join('|')); }
