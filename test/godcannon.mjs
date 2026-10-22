import fs from 'fs';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits; let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const yes = async q => { if (q.type === 'multi') return []; if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
const mk = (pid, gears, cannon = null, godforms) => { const g = new Game(data, { seed: 7 }); g.ask = yes;
  g.setup({ primordialId: pid, level: 3, argo: [], awakening: { enabled: true, spark: true, godforms }, cannon, titans: gears.map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
const pickGod = name => async q => { if (/Godform 선택/.test(q.title)) return q.options.find(o => o.value.name === name).value; if (/Poisoned Wisdom/.test(q.title)) return 'bp'; return yes(q); };
const has = (g, re) => g.log.some(l => re.test(l.msg));
// Ares
{ const g = mk('hekaton', [['Sirenblade'], ['Sirenblade']]); const [A] = g.titans; g.ask = pickGod('Ares'); await g.awaken(A, { inline: false }).catch(e => { if (!e.chainBreak) throw e; });
  ok(g.gf(A, 'Ares') && A.godform.trespass === 2, 'Ares awakened, Trespass 2'); A.rage = 8; await g.gainRage(A, 3); ok(A.rage === 9 && !A.rageDoom, 'God of War: no rage doom'); }
// Hermes
{ const g = mk('hekaton', [['Sirenblade', 'Siren Shield'], ['Sirenblade']]); const [A] = g.titans; const sp0 = g.speedOf(A); A.gear[0].exhausted = true; g.ask = pickGod('Hermes'); await g.awaken(A).catch(e => { if (!e.chainBreak) throw e; });
  ok(!A.gear[0].exhausted, 'Rearm unexhausts weapon'); A.gear[0].exhausted = true; ok(!A.gear[0].exhausted, 'Weapon cannot be exhausted during Hermes'); ok(g.speedOf(A) === sp0 + A.speed, `Hermes speed ${sp0} → ${g.speedOf(A)}`); ok(g.evasionBonus(A) >= 1, 'Hermes +1 evasion');
  await g.endAwakening(A); A.gear[0].exhausted = true; ok(A.gear[0].exhausted, 'after godform ends, exhaust works again'); }
// Hephaestus obol
{ const g = mk('hekaton', [['Sirenblade'], ['Sirenblade']]); const [A] = g.titans; g.ask = pickGod('Hephaestus'); await g.awaken(A).catch(e => { if (!e.chainBreak) throw e; }); await g.kill(A, { fromObol: true }); ok(A.alive && has(g, /Hephaestum Skin/), 'Hephaestum Skin: no obol death'); }
// Athena
{ const g = mk('hekaton', [['Sirenblade'], ['Sirenblade']]); const [A] = g.titans; g.ask = pickGod('Athena'); await g.awaken(A).catch(e => { if (!e.chainBreak) throw e; }); ok(A.godform.reveal === 'bp', 'Athena reveal BP deck'); }
// Artemis weapon availability
{ const g = mk('hekaton', [['Sirenblade'], ['Sirenblade']]); const [A] = g.titans; g.ask = pickGod('Artemis'); await g.awaken(A).catch(e => { if (!e.chainBreak) throw e; }); ok(A.godform.weapon && A.godform.weapon.card.atk === 3, 'Heavenly Bow ◆3'); ok(g.precisionMods(A) >= 3, 'Artemis +3 precision'); }
// Cannon
{ const g = mk('hekaton', [['Sirenblade'], ['Sirenblade']], { enabled: true, payload: 'Argo Payload', unlimited: false, res: { Mortal: 3, 'Living Abyss': 1 } }); const [A] = g.titans;
  ok(g.cannon.effects.length === 2 && g.cannon.effects.every(e => e.payload === 'Argo Payload'), 'single payload: Argo effects only');
  g.rng.d10 = () => 6; g.ask = async q => q.options.find(o => o.value && o.value.name === 'Trireme Spear')?.value ?? yes(q); await g.cannonPrime(A); ok(g.cannon.primed && g.cannon.primed.name === 'Trireme Spear', 'primed Trireme Spear on 6 (5+)');
  g.ask = yes; const fa = g.freeActions(A).find(o => /Godkiller Shot 「Trireme Spear」/.test(o.label)); ok(!!fa, 'free action offered'); const o0 = g.kratosPool.opening; await fa.value(); ok(g.kratosPool.opening === o0 + 3 && g.cannon.charges === 1 && g.cannon.res.Mortal === 0 && !g.cannon.primed, 'fire: +3 Opening, charge 1, Mortal 0');
  ok(!g.canCannonEmergency(), 'emergency not offered with 1 charge'); }

// Thunderram + Armorpiercer inside a real attack
{ const g = mk(process.argv[2] || 'nietzschean', [['Sirenblade'], ['Sirenblade']], { enabled: true, payload: 'Labyrinth Payload', unlimited: true }); const [A] = g.titans; await g.startOfBattle?.();
  const cells = g.board ? null : null; const adj = [];
  for (let c = 0; c < g.board.cols; c++) for (let r = 0; r < g.board.rows; r++) if (!g.primContains({ c, r }) && g.isAdj({ ...A, pos: { c, r } }) && !g.titanAt(c, r)) adj.push({ c, r });
  A.pos = adj[0]; g.cannon.primed = g.cannon.effects.find(e => e.name === 'Thunderram'); g.ask = yes;
  try { await g.titanAttack(A); } catch (e) { if (!e.chainBreak && !e.titan && !e.result) throw e; }
  ok(has(g, /Godkiller Shot — 「Thunderram」/) || has(g, /Full Miss/), 'Thunderram fired at attack (or full miss before window)');
  g.cannon.charges = 2; g.cannon.primed = data.argonauts.grandCannon.payloads[0].effects.find(e => e.name === 'Armorpiercer'); const hard = g.bp.cards.find(c => c.hardened); if (hard) { g.bp.cards.splice(g.bp.cards.indexOf(hard), 1); g.bp.putTop(hard); }
  A.pos = adj[0]; g.log.length = 0; let tries = 0; while (tries++ < 10 && !has(g, /Armorpiercer/)) { try { A.turn = { moved: false, attacked: false, usedAbilities: new Set() }; for (const x of A.gear) x.exhausted = false; await g.titanAttack(A); } catch (e) { if (!e.chainBreak && !e.titan && !e.result) throw e; } if (!A.alive) break; const h2 = g.bp.cards.find(c => c.hardened); if (h2) { g.bp.cards.splice(g.bp.cards.indexOf(h2), 1); g.bp.putTop(h2); } }
  if (process.env.DBG) console.log(g.log.map(l => l.msg).join("\n"));
  ok(!hard || has(g, /Godkiller Shot — 「Armorpiercer」/), 'Armorpiercer fired on Hardened BP' + (hard ? '' : ' (no hardened BP in deck)')); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
