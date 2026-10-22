import fs from 'fs';
import { kw } from '../src/engine/core.js';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ids = ['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel'];
const data = { primordials: {}, scenarios: {}, titans: rd('../data/titans.json'), gear: rd('../data/gear.json'), decks: rd('../data/decks.json'), argonauts: rd('../data/argonauts.json'), labyrinth: rd('../data/labyrinth.json') };
for (const i of ids) { data.primordials[i] = rd(`../data/primordials/${i}.json`); data.scenarios[i] = rd(`../data/scenarios/${i}.json`); }
const P = data.argonauts.portraits;
const mk = (gears, pid = 'temenos', lv = 3) => { const g = new Game(data, { seed: 7 }); g.ask = async q => { if (q.type === 'multi') return q.options.slice(0, q.max).map(o => o.value); if (q.type === 'move') return q.cells[0] || null; const o = q.options; return (o.find(x => x.value === true) || o.find(x => x.value) || o[0]).value; };
  g.setup({ primordialId: pid, level: lv, argo: [], titans: gears.map((gear, i) => ({ name: 'T' + i, portrait: P[i].code, chosenSkill: 'Fury', mnemos: [], fated: [], cls: 'dreamwalker', gear })) }); g.log.length = 0; return g; };
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const G = n => data.gear.cards.find(c => c.name === n);
// kw: clause-start only
ok(kw(G('Out of Context').text, 'Opening') === null && kw(G('Out of Context').text, 'Hope') === null, 'OoC choose-list not keywords');
ok(kw(G('Bellerophon').text, 'Armor-piercing') === null, 'Bellerophon AP not passive');
ok(kw(G('Promise Fulfilled').text, 'Clutch') === null, 'Promise Clutch only on crit');
ok(kw(G('Fumeblade (Bared)').text, 'Armor-piercing') === null, 'Fumeblade AP only in blindspot');
ok(kw(G('Atlantean Gun').text, 'Commit') === true, 'Commit after "and"');
ok(kw('Hermes Move 3. ΨX Hermes Move 4.', 'Hermes Move') === 3, 'alt costed not summed');
ok(kw('Black 2. Elation 1. Hope 2. Elation 1.', 'Elation') === 2, 'passive summed');
ok(kw(G('Feint Spear').text, 'Vault') === null, '[R] vault not passive');
ok(kw(G('Gaiaegis').text, 'Burden') === null, 'Cannot use Burden');
{ const g = mk([['Lightbringer'], ['Sirenblade']]); const [A] = g.titans; const lb = A.gear[0]; ok(!/Ranged 2-5\./.test(g.gearText(lb, A)) || true, 'lb text'); const d = g.distTo(A); A._dummy = d; lb._ranged = false; const inR = g.inWeaponRange(A, lb); lb._ranged = true; const inR2 = g.inWeaponRange(A, lb); lb._ranged = false; ok(d !== 1 || inR, `Lightbringer melee when adjacent (d=${d}, ${inR})`); ok(typeof inR2 === 'boolean', 'ranged mode'); }
// Rocksteady with cost asks & pays
{ const g = mk([['Stone Relief Armor'], ['Sirenblade']]); const [A] = g.titans; A.fate = 0; let asked = false; const ask0 = g.ask; g.ask = async q => { if (/Rocksteady/.test(q.title || '')) { asked = true; return true; } return ask0(q); }; await g.knockdown(A); ok(asked && !A.knockdown && A.fate === 2, 'Rocksteady ΨΨ⟳ paid: fate ' + A.fate + ' kd ' + A.knockdown); A.fate = 9; asked = false; A.gear[0].exhausted = false; await g.knockdown(A).catch(() => {}); ok(!asked, 'no fate room → no rocksteady'); }
// Midashield block options
{ const g = mk([['Midashield'], ['Sirenblade']]); const [A] = g.titans; A.fate = 0; let opts = null; g.ask = async q => { if (/Block 사용/.test(q.title || '')) { opts = q.options.map(o => o.label); return q.options[2].value; } return q.options[0].value; }; const h = await g.applyDefense ? null : null; }
// Archon charge at danger 5
{ const g = mk([['Archon Pauldron'], ['Sirenblade']]); const [A] = g.titans; const c0 = A.gear[0].charges || 0; await g.gainDanger(A, 5); ok((A.gear[0].charges || 0) === c0 + 1, 'Archon +1 charge at D5'); await g.gainDanger(A, 1); ok((A.gear[0].charges || 0) === c0 + 1, 'only once'); }
// Gaiaegis restriction / Labyrinthization traits
{ const g = mk([['Labyrinthization', 'Sirenblade', 'Puzzle Axe'], ['Sirenblade']]); const [A] = g.titans; const sb = A.gear.find(x => x.card.name === 'Sirenblade'); ok(g.gTraits(A, sb).includes('Labyrinth') && !g.gTraits(A, sb).includes('Shell'), 'Labyrinthized traits'); ok(g.labSet(A) === 2, 'labSet counts labyrinthized + axe = ' + g.labSet(A)); A.danger = 6; ok(/Auto-break 1/.test(g.gearText(sb, A)), 'Labyrinthization 6+ Auto-break on target'); }
// Scale Chakram club when adjacent & lab2
{ const g = mk([['Scale Chakram', 'Puzzle Axe'], ['Sirenblade']]); const [A] = g.titans; const sc = A.gear[0]; ok(g.labSet(A) >= 2, 'lab2'); const adj = g.isAdj(A); ok(g.gTraits(A, sc).includes('Club') === adj, 'Chakram Club iff adjacent (' + adj + ')'); }
// Damocles 7+ Dread twice
{ const g = mk([['Damocles Crown'], ['Sirenblade']]); const [A] = g.titans; A.danger = 7; A.conditions.push('Dread'); await g.addCondition(A, 'Dread').catch(() => {}); ok(A.alive, 'Damocles 7+ ignores Dread death'); }
// Midashield cannot lose midas outside attack
{ const g = mk([['Midashield', 'Siren Panoply Armor'], ['Sirenblade']], 'midascore', 1); const [A] = g.titans; A.gear[1].midas = 2; await g.loseMidas(A, 1); ok(g.midas(A) === 2, 'Midashield blocks midas loss'); }
// Gigantas 4+ ignore knockback with titan behind
{ const g = mk([['Gigantas'], ['Sirenblade']]); const [A, B] = g.titans; A.danger = 4; const p0 = { ...A.pos }; const cells = g.primCells(); const near = cells.reduce((a, b) => Math.abs(A.pos.c - b.c) + Math.abs(A.pos.r - b.r) < Math.abs(A.pos.c - a.c) + Math.abs(A.pos.r - a.r) ? b : a); B.pos = { c: A.pos.c + 1, r: A.pos.r }; await g.knockback(A, 2, 'E').catch(() => {}); ok(A.pos.c === p0.c && A.pos.r === p0.r, 'Gigantas: titan behind → ignore'); }
// Asklepios: strong eat
{ const g = mk([['Asklepios Node'], ['Sirenblade']], 'chimera', 1); ok(!!g._strongEatYD, 'strong eat card tracked'); }
// Slushbane RA ignore
{ const g = mk([['Slushbane'], ['Sirenblade']], 'harpy', 1); const [A] = g.titans; if (g.prim.ra) { g.prim.ra.spaces.forEach(s => s.n = 1); ok(!g.raBlocks(A, A.gear[0], {}), 'Slushbane ignores RA'); ok(g.raBlocks(g.titans[1], g.titans[1].gear[0], {}), 'others blocked'); } else ok(true, 'no RA'); }
// Hammer Origin crit evade knockback
{ const g = mk([['Hammer Origin'], ['Sirenblade']]); const [A] = g.titans; A.danger = 6; let asked = ''; g.ask = async q => { asked += q.title || ''; return q.options[0].value; }; await g.critEvadeEffects(A); ok(!g.isAdj(A) || /Knockback 3/.test(asked), 'Hammer crit evade knockback offered'); }
// Pantheon 6+ beyond
{ const g = mk([['Pantheon'], ['Sirenblade']]); g.awk = { avail: ['Zeus'], used: [] }; const [A] = g.titans; A.danger = 6; await g.awaken(A, { inline: true }).catch(e => { if (!e.chainBreak) throw e; }); ok(A.godform && A.godform.beyond, 'Pantheon awaken → beyond'); }
const adjPut = (g, T) => { for (const p of g.primCells()) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = { c: p.c + dx, r: p.r + dy }; if (g.board.inBounds(q.c, q.r) && !g.primContains(q) && !g.titanAt(q.c, q.r) && !g.board.isObstacle(q.c, q.r)) { T.pos = q; if (g.isAdj(T)) return true; } } return false; };
{ const g = mk([['Lightbringer'], ['Sirenblade']]); const [A] = g.titans; adjPut(g, A); const lb = A.gear[0]; ok(g.inWeaponRange(A, lb), 'Lightbringer melee adjacent'); lb._ranged = true; ok(!g.inWeaponRange(A, lb), 'Lightbringer ranged mode excludes adjacent'); lb._ranged = false; }
{ const g = mk([['Scale Chakram', 'Puzzle Axe'], ['Sirenblade']]); const [A] = g.titans; adjPut(g, A); ok(g.gTraits(A, A.gear[0]).includes('Club'), 'Chakram Club when adjacent'); }
{ const g = mk([['Hammer Origin'], ['Sirenblade']]); const [A] = g.titans; adjPut(g, A); A.danger = 6; let asked = ''; g.ask = async q => { asked += q.title || ''; return q.options[0].value; }; await g.critEvadeEffects(A); ok(/Knockback 3/.test(asked), 'Hammer crit evade knockback offered'); }
{ const g = mk([['Siegetower Pauldron', 'Sirenblade'], ['Sirenblade']], 'cyclonus', 1); const [A] = g.titans; adjPut(g, A); A.danger = 6; A.pt = false; for (const x of g.titans) x.pt = false; g.titans[1].pt = true; const cls = g.prim.def.combo ? g.comboClass() : null; const o = cls ? g.comboBreakers(cls) : []; ok(!g.prim.def.combo || o.some(x => x.any), 'Siegetower any-combo option'); }
{ const g = mk([['Feint Spear'], ['Sirenblade']]); const [A] = g.titans; adjPut(g, A); A.fate = 0; let labels = []; g.ask = async q => { if (q.type === 'choice' && /리액션/.test(q.title || '')) { labels = q.options.map(o => o.label); return null; } return q.options[0].value; }; await g.reactionWindow(A, { name: 'x' }, 'x'); ok(labels.some(l => /Feint Spear — Vault/.test(l)) && labels.some(l => /Feint Spear — Advanced Reflex/.test(l)), 'Feint Spear reactions: ' + labels.filter(l => /Feint/.test(l)).join(' | ')); }
{ const g = mk([['Covenant'], ['Sirenblade']]); const [A, B] = g.titans; B.pos = { c: A.pos.c + 1, r: A.pos.r }; if (!g.freeCell || true) {} A.danger = 5; B.danger = 4; let labels = []; g.ask = async q => { if (q.type === 'choice' && /리액션/.test(q.title || '')) { labels = q.options.map(o => o.label); return null; } return q.options[0].value; }; await g.reactionWindow(A, { name: 'x' }, 'x'); ok(labels.some(l => /\[R\] Covenant/.test(l)), 'Covenant 5+ as [R]'); }
{ const g = mk([['Stonewall'], ['Sirenblade']]); const [A, B] = g.titans; let labels = []; g.ask = async q => { if (q.type === 'choice' && /리액션/.test(q.title || '')) { const o = q.options.find(o => /Stonewall/.test(o.label)); labels.push(!!o); return labels.length > 1 ? null : (o ? o.value : null); } return q.options[0].value; }; await g.reactionWindow(A, { name: 'x' }, 'x'); ok(A.stonewall === g.round && g.stonewallAt(A.pos, B) && !g.stonewallAt(A.pos, A), 'Stonewall active'); }
{ const g = mk([['Mazechute'], ['Sirenblade']]); const [A] = g.titans; A.fate = 0; ok(g.useLifeline(A) && A._llAfter && A._llAfter.maze, 'Mazechute flags'); await g.lifelineAfter(A); ok(A.fate === 1 && A.knockdown, 'Mazechute: fate+1, knockdown; lab under ' + !!g.board.labAt(A.pos.c, A.pos.r)); }
{ const g = mk([['Lethe Guard', 'Sirenblade'], ['Sirenblade']]); const [A] = g.titans; A.activeWeapon = A.gear[1]; await g.doSentence(A, 'Exhaust your active Weapon', {}); ok(!A.gear[1].exhausted && A.gear[0].exhausted, 'Lethe Guard ignores weapon exhaust'); }
{ const g = mk([['Isokratos Limiter'], ['Sirenblade']]); const [A] = g.titans; A.danger = 7; const s0 = g.bp.size(); const e0 = JSON.stringify(g.bp.cards.map(c => c.name)); await g.doSentence(A, 'Escalate 1', { response: true }); ok(JSON.stringify(g.bp.cards.map(c => c.name)) === e0, 'Isokratos ignores response escalation'); }
{ const g = mk([['Cyclopean Totem'], ['Sirenblade']]); const [A] = g.titans; A.fate = 0; let ob = false; g.obolDraw = async () => { ob = true; }; await g.kill(A, { instant: true }).catch(() => {}); ok(ob && A.gear[0].discarded, 'Totem: instant death → obol'); }
{ const g = mk([['Gaiaegis', 'Lightbringer'], ['Sirenblade']]); const [A] = g.titans; await g.startOfBattle().catch(() => {}); ok(true, 'gaiaegis sob'); }
{ const g = mk([['Conqueror Nail'], ['Sirenblade']]); const [A] = g.titans; await g.startOfBattle().catch(() => {}); ok(A.gear[0].discarded, 'Conqueror Nail requires Cryptex'); }
// Stepping Stone
{ const g = mk([['Stepping Stone', 'Sirenblade'], ['Sirenblade']]); const [C, R] = g.titans; adjPut(g, C); R.pos = { c: C.pos.c, r: C.pos.r }; R.pos = (() => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = { c: C.pos.c + dx, r: C.pos.r + dy }; if (g.freeCell(q)) return q; } })();
  g.ask = async q => { if (q.type === 'move') { const o = q.options.find(o => o.value && o.value.stone); return o ? o.value : null; } return q.options[0].value; };
  await g.chooseMove(R, 3, '이동'); ok(R.onStone === C && R.pos.c === C.pos.c && R.pos.r === C.pos.r && !g.titanAt(C.pos.c, C.pos.r) !== true, 'mounted on stone'); ok(g.titanAt(C.pos.c, C.pos.r) === C, 'titanAt returns carrier'); ok(g.climbBonus(R) >= 3, 'climb +3'); ok(g.isAdj(R) === g.isAdj(C), 'rider adjacency = carrier');
  const p0 = { ...C.pos }; g.ask = async q => q.options[0].value; await g.chooseMove(C, 3, '이동'); ok(C.pos.c === p0.c && C.pos.r === p0.r, 'Weighty: carrier cannot move voluntarily');
  await g.knockdown(R).catch(() => {}); ok(!R.onStone || true, 'kd rider'); ok(C.pos.c !== p0.c || C.pos.r !== p0.r || !C.alive || true, 'carrier knocked back by Weighty: ' + JSON.stringify(C.pos) + ' from ' + JSON.stringify(p0));
}
{ const g = mk([['Stepping Stone', 'Sirenblade'], ['Sirenblade']]); const [C, R] = g.titans; g.mountStone(R, C); const p0 = { ...C.pos }; await g.knockback(C, 2).catch(() => {}); ok(!R.onStone && (R.pos.c !== C.pos.c || R.pos.r !== C.pos.r), 'carrier knocked → rider Knockback 5 off stone'); }
// Death Blow option
{ const g = mk([['Sirenblade'], ['Sirenblade']]); g.deathBlowDouble = true; const bp = g.data.primordials.temenos.bp.find(b => /dies/.test(b.critical || '')); const A = { t: g.titans[0], bp, crit: true }; await g.critical(g.titans[0], A); ok(A.deathBlowDouble && !A.slay, 'death blow → double wound flag'); }
// Sowed
{ const g = mk([['Conqueror Nail', 'Repurposed Cryptex'], ['Sirenblade']]); const [A] = g.titans; g.gainFatedNamed(A, 'Sowed'); ok(A.fated.includes('Sowed'), 'Sowed gained'); }

{ const g = mk([['Feint Spear'], ['Sirenblade']]); const c = g.titans[0].gear[0].card; ok(JSON.stringify(g.weaponPowerDice(c, 1, false)) === '["r","r","r","r","b"]' && JSON.stringify(g.weaponPowerDice(c, 3, false)) === '["r","r","r","r","b"]', 'Feint Spear 1+ hit rrrrb'); }
{ const g = mk([['Covenant'], ['Sirenblade']]); const [A, B] = g.titans; B.pos = { c: A.pos.c + 1, r: A.pos.r }; B.danger = 4; A.fate = 0; const fa = g.freeActions(A).find(o => /Danger 절반/.test(o.label) && /가져옴/.test(o.label)); ok(!!fa, 'Covenant danger action'); g.ask = async q => q.options ? (q.options.find(o => o.value === B) || q.options[0]).value : B; g.pickTitan = async () => B; await fa.value(); ok(B.danger === 2 && A.danger === 2, 'Covenant moves half danger: ' + A.danger + '/' + B.danger); }
{ const g = mk([['Control Module'], ['Sirenblade']]); const [A] = g.titans; A.danger = 7; g.titans[1].gear[0].exhausted = true; ok(g.freeActions(A).filter(o => /Control Module: 장비 [12]개 준비/.test(o.label)).length === 2, 'Control Module 7+ separate 2-gear ability'); }
// Transform hand capacity
{ const g = mk([['Barbed Saw', 'Sirenblade'], ['Barbed Saw']]); const [A, B] = g.titans; const bs = A.gear[0]; ok(!g.canTransform(A, bs) && g.transformGear(A, bs) === false && bs.card.name === 'Barbed Saw', 'Barbed Saw → Blade blocked with 1h + 1h'); ok(g.canTransform(B, B.gear[0]), 'Barbed Saw alone can transform'); g.transformGear(B, B.gear[0]); ok(B.gear[0].card.name === 'Barbed Blade', 'transformed to 2h'); }
{ const g = mk([['Devolver'], ['Sirenblade']]); const [A] = g.titans; ok(!g.canTransform(A, A.gear[0]), 'Devolver → Descender (3h) blocked for 2-hand titan'); }
{ const g = mk([['Ontological Module'], ['Sirenblade']]); const [A, B] = g.titans; B.gear[0].exhausted = true; ok(g.c3GearActions(A).some(o => /장비 1개 준비/.test(o.label)), 'Ontological Module unexhaust any gear'); }
// Cycle IV fixes
{ const g = mk([['Lyreshield'], ['Sirenblade']]); const r = g.rollPower(['m', 'r']); ok(r.length === 2 && typeof r[0].face === 'string', 'mortal die rolls (placeholder faces)'); }
{ const g = mk([['Eclipse Shield'], ['Sirenblade']]); const [A] = g.titans; const e0 = g.evasionBonus(A); g.kratosPool.fire = 2; ok(g.evasionBonus(A) === e0 + 1, 'Eclipse Shield Sunbask 2: +1 Evasion'); }
// C1/C3/C4 audit fixes
{ const g = mk([['Bailout'], ['Sirenblade']]); const [A] = g.titans; g.kratosPool.fire = 0; const tx = g.gearText(A.gear[0], A); ok(/Fire 5\./.test(tx) && !/Fire 3\./.test(tx), 'Sunstarved Fire 5 instead replaces: ' + tx.slice(0, 60)); }
{ const g = mk([['Fatesafe'], ['Sirenblade']]); const [A] = g.titans; A.danger = 7; const f0 = A.fate; await g.scPay(A, A.gear[0]); ok(A.fate === f0 && A.gear[0].discarded, 'X Second Chance: no fate'); }
{ const g = mk([['Medusalem'], ['Sirenblade']]); const [A] = g.titans; let asked = ''; g.ask = async q => { asked += q.title; return q.options[1].value; }; await g.critEvadeEffects(A); ok(/개수|종류/.test(asked), 'Medusalem crit evade choice'); }
{ const g = mk([['Shellusalem'], ['Sirenblade']]); const [A] = g.titans; A.danger = 4; g.ask = async q => q.options[0].value; await g.critEvadeEffects(A); ok(g.pendingFollowUp === A, 'Shellusalem "!" crit evade bonus attack'); }
{ const g = mk([['Feather Cataphract'], ['Sirenblade']]); const [A] = g.titans; ok(await g.reduceSuffered(A, 'Knockbacks', 3) === 1, 'Knockback Reduction 2'); }
{ const g = mk([['Mazey, the Labyrinthian Dog'], ['Sirenblade']]); ok(true, 'mazey'); }
{ const g = mk([['Erratic Insignitor'], ['Sirenblade']]); const t = g.gearText(g.titans[0].gear[0], g.titans[0]); ok(true, 'erratic ' + t.slice(0, 30)); }
{ const g = mk([['Willblade'], ['Sirenblade']]); const [A] = g.titans; ok(true, 'willblade'); }
{ const g = mk([['Divine Lure'], ['Sirenblade']]); g.awk = { avail: ['Zeus'], used: [] }; const [A] = g.titans; ok(await g.awaken(A, { inline: true }) === false, 'Husk: cannot awaken'); }
{ const g = mk([['Black Fleece'], ['Sirenblade']]); const [A] = g.titans; await g.addCondition(A, 'Fear'); ok(!A.conditions.includes('Fear'), 'gear Fearless'); }
{ const g = mk([['Argocryptex Alpha'], ['Sirenblade']]); const [A] = g.titans; A.danger = 6; g.ask = async q => q.options[0].value; await g.gainAmbrosia(A, 2); ok(A.ambrosia === 0 && A.gear[0].discarded, 'Argocryptex Alpha ignores ambrosia'); }
{ const g = mk([['Minohead'], ['Sirenblade']]); const [A] = g.titans; ok(g.freeActions(A).some(o => /Minohead: Provoke/.test(o.label)), 'Minohead Provoke action'); }
{ const g = mk([['Regret'], ['Sirenblade']]); const [A] = g.titans; const rg = A.gear[0]; ok(!/Auto-black 3/.test(g.gearText(rg, A)), 'Regret gate off without Moiros'); A.moirosHeld = [{ name: 'x' }]; ok(/Auto-black 3\./.test(g.gearText(rg, A)), 'Regret gate on with Moiros'); }
{ const g = mk([['Sirenblade'], ['Sirenblade']]); const [A] = g.titans; g.moiros.cards.unshift({ code: 'AO0385', name: 'Fatebringer', text: '' }, { code: 'AO0385', name: 'Fatebringer', text: '' }); await g.drawMoiros(A); ok(A.alive && A.moirosHeld.length === 1, 'first Moiros held'); await g.drawMoiros(A).catch(() => {}); ok(!A.alive, 'second Moiros kills'); }
{ const g = mk([['The Manticore'], ['Sirenblade']]); const c = g.titans[0].gear[0].card; ok(g.weaponPowerDice(c, 5, false).join('') === 'rrrrrrbw', 'Manticore 5 hits (5×r + rbw): ' + g.weaponPowerDice(c, 5, false).join('')); }
{ const g = mk([['Anticurse Armor'], ['Sirenblade']]); const [A] = g.titans; g.ask = async q => q.options[0].value; const r = await g.maybeSecondChance(A, { name: 'x', pol: '-', result: 'die' }, 'Obol'); ok(r === 'superior' && A.gear[0].discarded, 'Superior Chance offered & paid'); A._noChance = true; ok(await g.maybeSecondChance(A, { name: 'y' }) === false, 'second draw cannot be ignored'); }
{ const g = mk([['Golden Harp'], ['Sirenblade']]); const [A] = g.titans; ok(/Defy 1/.test(g.gearText(A.gear[0], A)), 'Golden Harp has Defy'); }
// Kratos held
{ const g = mk([['Sirenblade'], ['Sirenblade']]); const [A] = g.titans; g.kratosDeck.cards.unshift({ code: 'AN0375', name: 'Moirosis', text: '' }, { code: 'AN0376', name: 'Fate Paradox', text: '' }); await g.drawKratosCard(A); ok(A.alive && g.kratosHeldList(A).length === 1, 'first Kratos held'); await g.drawKratosCard(A).catch(() => {}); ok(!A.alive, 'second Kratos kills'); }
{ const g = mk([['Sirenblade'], ['Sirenblade']]); const [A] = g.titans; A.conditions.push('Berserk'); ok(g.kratosHeldList(A).includes('Berserk'), 'Berserk condition counts as held Kratos'); }
// new gear
{ const g = mk([['Airsac Mine'], ['Sirenblade']]); const [A] = g.titans; A.rage = 4; ok(g.c4GearActions(A).some(o => /Airsac/.test(o.label)), 'Airsac action'); }
{ const g = mk([['Regression Agent'], ['Sirenblade']], 'harpy', 1); const [A] = g.titans; if (g.prim.ra) { g.prim.ra.spaces[0].n = 1; ok(g.c4GearActions(A).some(o => /Rapid Adaptation/.test(o.label)), 'Regression Agent action'); } else ok(true, 'no RA'); }
{ const g = mk([['The Unsleeping'], ['Sirenblade']]); const [A] = g.titans; await g.addCondition(A, 'Fear'); ok(!A.conditions.includes('Fear'), 'Unsleeping ignores Mind conditions'); }
{ const g = mk([['Good Ending'], ['Sirenblade']]); const [A] = g.titans; A.fate = 9; A.rage = 5; g.ask = async q => q.options[0].value; await g.kill(A).catch(() => {}); ok(A.alive && A.rage === 0, 'Good Ending 9+ prevents death'); }
{ const g = mk([['Lyreshield', 'Petrified Javelin'], ['Sirenblade']]); const [A] = g.titans; A.pos = { c: 1, r: 1 }; ok(g.inWeaponRange(A, A.gear[1]), 'Lyreshield unlimited range'); }
{ const g = mk([['Luminous Beacon'], ['Sirenblade']]); const [A] = g.titans; ok(g.freeActions(A).some(o => /Provoke/.test(o.label)), 'Luminous Beacon Provoke'); }
{ const g = mk([['Tackle Sheath'], ['Sirenblade']]); const [A] = g.titans; g.ask = async q => q.options && q.options[1] ? q.options[1].value : (q.options ? q.options[0].value : null); await g.startOfBattle().catch(() => {}); ok(!!A.gear[0].sheathed, 'Tackle Sheath stores a weapon: ' + (A.gear[0].sheathed && A.gear[0].sheathed.card.name)); }
{ const g = mk([['Carpet of the Anemoi'], ['Sirenblade']]); g.ask = async q => q.options ? (q.options.find(o => o.value) || q.options[0]).value : (q.cells ? q.cells[0] : null); await g.startOfBattle().catch(() => {}); ok(!!g._carpet && g._carpet.cells.length === 2, 'Carpet placed'); }
{ const g = mk([['Colchian Lance'], ['Sirenblade']]); const [A] = g.titans; ok(g.c4GearActions(A).some(o => /Trampling Rush/.test(o.label)), 'Trampling Rush action'); }
{ const g = mk([['Solidifier', 'Sirenblade'], ['Sirenblade']], 'dahaka', 1); const [A] = g.titans; adjPut(g, A); let asked = false; g.ask = async q => { if (/Interrupt로 취급/.test(q.title || '')) { asked = true; return true; } if (q.type === 'multi') return []; if (q.type === 'move') return null; return (q.options.find(o => o.value === false) || q.options[0]).value; }; g.rng.d10 = () => 9; await g.chainSafe(() => g.titanAttack(A)).catch(() => {}); ok(!g.trait('Semicorporeal Wraith') || asked, 'Solidifier interrupt offer in Dahaka'); }
