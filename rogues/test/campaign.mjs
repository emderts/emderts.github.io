// Campaign layer: node choice → monster roll → Clash → Aftermath (loot, rewards, resurrections) → Outpost, save/restore.
import fs from 'fs'; import path from 'path';
import { Campaign } from '../src/engine/campaign.js';
const loadData = dir => { const out = {}; for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) out[ent.name] = loadData(full); else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); } return out; };
const data = loadData(new URL('../data/', import.meta.url).pathname);
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const clashAsk = (clash) => async q => { switch (q.type) { case 'confirm': return q.default; case 'dice': { const k = q.knight ? clash.knights.find(x => x.id === q.knight) : null; let budget = q.max; if (k && /Evasion|Attack/.test(q.text)) budget = Math.min(budget, Math.max(0, k.heatLimit - k.heat - 1) + clash.poolCount('closing')); return q.dice.map((d, i) => ({ d, i })).filter(x => !x.d.hit && x.d.canReroll).slice(0, budget).map(x => x.i); } case 'number': return q.default ?? q.options.at(-1).value; case 'order': return q.options.map(o => o.value); case 'weapon': { const o = q.options.find(o => /Axe|Cleaver|Sword|Spear/.test(o.label)); return o ? o.value : q.options[0].value; } case 'pick': return q.options.some(o => o.value === 'skip') ? 'skip' : q.options[0].value; case 'move': { const k = clash.knights.find(x => x.id === q.knight); const d = c => clash.board.distance([c], clash.monster.cells, x => !clash.board.isObstacle(x)); const best = [...q.cells].sort((a, b) => d(a) - d(b))[0]; if (/Displace/.test(q.text || '')) return best; return d(best) < d(k.pos) ? best : null; } case 'action': { const v = q.options.map(o => o.value); if (v.includes('attack')) return 'attack'; const k = clash.knights.find(x => x.id === q.knight); if (v.includes('move') && !clash.adjacentToMonster(k)) return 'move'; const pose = v.find(x => x.startsWith('tech:Knight Pose')); if (pose && clash.knockedDown(k)) return pose; const heal = v.find(x => x.startsWith('tech:Cured Darklin')); if (heal && k.vigor <= k.maxVigor - 3) return heal; return 'end'; } default: return q.options ? q.options[0].value : null; } };
const campAsk = async q => { if (q.type === 'confirm') return /Sigh/.test(q.text) ? false : q.default; if (q.options) { const gear = q.options.find(o => String(o.value).startsWith('gear:')); return gear && Math.random() < 0.3 ? gear.value : q.options[0].value; } return null; };
// knights: 4 Fleischritter (owner decision)
const mk = seed => new Campaign(data, { seed, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter' })), ask: campAsk, ownedMonsters: ['eggknight'] });
{ const c = mk(1); ok(c.resurrections === 5 && c.knights.every(k => k.gold === 10) && c.availableNodes().length === 6, 'start: 5 resurrections, 10 gold each, 6 nodes adjacent to S'); ok(c.availableNodes().every(n => n.level === 1 || n.level === 2), `S neighbours are low level: ${c.availableNodes().map(n => n.id + 'L' + n.level).join(' ')}`); }
{ const c = mk(2); let threw = false; try { c.chooseNode('K01'); } catch (e) { threw = true; } ok(threw, 'cannot choose a non-adjacent node'); }
// full rounds with only the Eggknight owned (tables re-roll until an owned monster appears)
const stats = { win: 0, lose: 0, rounds: 0 };
for (let seed = 10; seed < 16; seed++) {
  const c = mk(seed); let guard = 0;
  while (!c.result && guard++ < 6) {
    const node = c.availableNodes().filter(n => c.nodePlayable(n)).sort((a, b) => a.level - b.level)[0]; if (!node) { ok(false, 'no playable node'); break; } const enc = c.chooseNode(node.id);
    if (enc.monster !== 'eggknight') { ok(false, 'unowned monster rolled'); break; }
    const clash = c.buildClash(); clash.ask = clashAsk(clash); clash.setup(); const r = await clash.run(); const res = await c.aftermath(clash);
    stats[res === 'win' ? 'win' : 'lose']++; stats.rounds++;
    if (res === 'win') ok(c.crossed.includes(node.id) && c.resurrections >= 1, `seed ${seed} R${c.round}: won ${node.id} (Lv${enc.level}), resurrections ${c.resurrections}, crossed ${c.crossed.length}`);
    else ok(!c.crossed.includes(node.id), `seed ${seed} R${c.round}: lost at ${node.id}, resurrections ${c.resurrections}`);
    // outpost: buy something affordable for the richest knight, set loadout
    if (c.result) break;
    const rich = c.knights.filter(k => !k.dead).sort((a, b) => b.gold - a.gold)[0]; const deck = c.merchantDeck(node.level).filter(g => g.price <= rich.gold); if (deck.length) { c.buyGear(rich, deck[0].name, node.level); try { c.setLoadoutGear(rich, [deck[0].name]); } catch (e) { } }
    if (c.hired.length === 0 && c.knights.some(k => !k.dead && k.gold >= 3)) c.hire(c.knights.find(k => !k.dead && k.gold >= 3), 'Warrior', 1);
    c.endOutpost();
  }
}
ok(stats.rounds >= 8, `campaign rounds simulated: ${stats.rounds} (win ${stats.win} / lose ${stats.lose})`);
{ const c = mk(3); const n = c.availableNodes().find(n => c.nodePlayable(n)); c.chooseNode(n.id); const clash = c.buildClash(); clash.ask = clashAsk(clash); clash.setup(); await clash.run(); await c.aftermath(clash);
  const saved = JSON.stringify(c.serialize()); const c2 = Campaign.restore(data, JSON.parse(saved)); ok(c2.round === c.round && c2.crossed.join() === c.crossed.join() && c2.knights[0].gold === c.knights[0].gold && c2.availableNodes().length === c.availableNodes().length, 'save → restore keeps state'); ok(JSON.stringify(c2.knights[0].claimed) === JSON.stringify(c.knights[0].claimed), 'claimed rewards survive restore'); }
{ const c = mk(4); const k = c.knights[0]; k.armory.push('Cleaver Sword'); c.setLoadoutGear(k, ['Cleaver Sword']); ok(k.loadout.gear.join() === 'Cleaver Sword', '2H weapon fills both hand slots (no Knighves)'); c.setLoadoutGear(k, ['Chipped Axe']); ok(k.loadout.gear.join() === 'Chipped Axe', 'Chipped Axe is 2H (no Knighves)'); k.armory.push('Broken Sword'); c.setLoadoutGear(k, ['Broken Sword']); ok(k.loadout.gear.includes('Knighves'), '1H weapon → Knighves auto-fills the free hand'); let threw = false; try { c.setLoadoutGear(k, ['Cleaver Sword', 'Broken Sword']); } catch (e) { threw = true; } ok(threw, '3 hand slots rejected'); }
{ const c = mk(5); const k = c.knights[0]; let threw = false; try { c.setLoadoutTechniques(k, ['Second Chance', 'Knight Roll', 'Knight Pose', 'Cured Darklin', 'Food Runner']); } catch (e) { threw = true; } ok(threw, 'Hand Limit 4 enforced for 5 techniques'); }
// Sigh of the Graal replay: rewind to pre-Clash state, Sigh spent exactly once, First Death never re-triggers, no negative counters
{ let found = false;
  for (let seed = 20; seed < 60 && !found; seed++) {
    const c = mk(seed); c.ask = async q => { if (q.type === 'confirm' && /Sigh of the Graal 사용/.test(q.text)) return true; return campAsk(q); };
    const n = c.availableNodes().filter(n => c.nodePlayable(n)).sort((a, b) => a.level - b.level)[0]; c.chooseNode(n.id);
    const goldBefore = c.knights.map(k => k.gold).join(); const resBefore = c.resurrections;
    const clash = c.buildClash(); clash.ask = clashAsk(clash); clash.setup(); await clash.run();
    if (!c.knights.some(k => k.sigh > 0)) continue; // nobody earned a Sigh this clash
    found = true;
    const fd = c.knights.filter(k => k.firstDeath).map(k => k.name);
    const res = await c.aftermath(clash);
    ok(res === 'replay', `seed ${seed}: Sigh → replay`);
    ok(c.knights.every(k => k.sigh === 0), `Sigh consumed (counts ${c.knights.map(k => k.sigh).join('/')})`);
    ok(c.knights.map(k => k.gold).join() === goldBefore && c.resurrections === resBefore && c.current && c.current.sighUsed === 1, 'state rewound to pre-Clash snapshot');
    ok(fd.every(nm => c.knights.find(k => k.name === nm).firstDeath), 'First Death remains recorded after rewind');
    // second attempt: nobody holds a Sigh any more, so a replay can't be offered again
    c.ask = campAsk; const clash2 = c.buildClash(); clash2.ask = clashAsk(clash2); clash2.setup(); await clash2.run(); const res2 = await c.aftermath(clash2);
    ok(res2 === 'win' || res2 === 'lose', `second attempt resolves (${res2})`);
  }
  ok(found, 'a Clash granting a Sigh via First Death was found'); }
// Resurrection rule: survivors present → all dead revived even if resurrections run short
{ const c = mk(7); const n = c.availableNodes().find(n => c.nodePlayable(n)); c.chooseNode(n.id); c.resurrections = 1;
  const clash = c.buildClash(); clash.ask = clashAsk(clash); clash.setup();
  clash.knights[0].alive = false; clash.knights[1].alive = false; clash.result = 'lose'; clash.over = true;
  await c.aftermath(clash);
  ok(c.knights.every(k => !k.dead) && c.resurrections === 0, `2 deaths, 1 resurrection, survivors → all revived, resurrections ${c.resurrections}`); }
{ const c = mk(8); const n = c.availableNodes().find(n => c.nodePlayable(n)); c.chooseNode(n.id); c.resurrections = 3;
  const clash = c.buildClash(); clash.ask = clashAsk(clash); clash.setup(); clash.knights.forEach(k => k.alive = false); clash.result = 'lose';
  const r = await c.aftermath(clash); ok(r === 'lose' && c.result === 'lose', 'wipe with 3 resurrections < 4 deaths → campaign lost'); }
{ const c = mk(9); const n = c.availableNodes().find(n => c.nodePlayable(n)); c.chooseNode(n.id); c.resurrections = 4;
  const clash = c.buildClash(); clash.ask = clashAsk(clash); clash.setup(); clash.knights.forEach(k => k.alive = false); clash.result = 'lose';
  const r = await c.aftermath(clash); ok(r === 'lose' && !c.result && c.knights.every(k => !k.dead) && c.resurrections === 0, 'wipe with 4 resurrections → all revived, campaign continues'); }
// Outpost: Early Bird (first section) + Inn (6/7 re-rolled), buffs applied to the next Clash only
{ const c = mk(31); c.ask = async q => q.type === 'confirm' ? true : campAsk(q);
  const n0 = c.mercPool.length; await c.earlyBird('mercenaryGuild', 4); ok(c.mercPool.length === n0 + 1 && c.mercPool.at(-1).level === 3 && c.outpostState().earlyBird === 'mercenaryGuild', 'Early Bird Mercenary Guild at Devil tier → level 3 mercenary added');
  await c.earlyBird('inn', 4); ok(c.outpostState().earlyBird === 'mercenaryGuild', 'only the first section gets the Early Bird');
  const r = await c.innVisit(4); ok(r >= 1 && r <= 10 && r !== 6 && r !== 7, `Inn rolled ${r} (6/7 never used)`); let threw = false; try { await c.innVisit(4); } catch (e) { threw = true; } ok(threw, 'Inn once per Outpost');
  c.endOutpost(); ok(c.mercPool.length === n0, 'temporary Early Bird mercenary removed at end of Outpost'); }
{ const c = mk(32); await c.earlyBird('inn', 1); await c.innVisit(1, 2); const buffed = Object.keys(c.roundBuffs); ok(buffed.length === 2, 'Inn 2 (chosen via Early Bird): two knights Heat Limit +1');
  const n = c.availableNodes().find(n => c.nodePlayable(n)); c.chooseNode(n.id); const clash = c.buildClash(); const kn = clash.knights.find(k => k.name === buffed[0]); ok(kn.heatLimit === 4, `buffed knight Heat Limit ${kn.heatLimit} (3+1)`);
  clash.ask = clashAsk(clash); clash.setup(); await clash.run(); await c.aftermath(clash); ok(!c.roundBuffs || !Object.keys(c.roundBuffs).length, 'Inn effects end with the Rosegraal round'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
