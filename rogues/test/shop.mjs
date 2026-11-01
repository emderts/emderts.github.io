// Merchant gear, mercenaries, loot deck integrity.
import fs from 'fs';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const M = rd('../data/gear/merchant_principality.json'), Me = rd('../data/decks/mercenaries.json'), L = rd('../data/decks/loot.json'), G = rd('../data/gear/gear.json');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
ok(M.gear.length === 42 && M.gear.every(g => g.reforgedName && g.side && g.reforged), '42 merchant cards with both sides');
const tiers = { Mob: 0, Vassal: 0, King: 0, Devil: 0, Dragon: 0 }; for (const g of M.gear) tiers[g.tier]++; ok(Object.values(tiers).every(n => n >= 8), `tier counts: ${JSON.stringify(tiers)}`);
ok(M.gear.every(g => g.price >= 3 && g.price <= 27 && g.reforgePrice >= 3), 'prices 3–27');
const codes = M.gear.map(g => g.code); ok(new Set(codes).size === 42, 'codes unique');
const axe = M.gear.find(g => g.name === 'Chipped Axe'), axeK = G.gear.find(g => g.name === 'Chipped Axe');
ok(axe && axe.side.attackDice === axeK.attackDice && axe.side.weaponPower.colour === axeK.weaponPower.colour && axe.price === axeK.price, 'Chipped Axe consistent between knight gear and merchant data');
ok(M.gear.every(g => ['weapon', 'armor'].includes(g.type)), 'merchant gear types are weapon/armor');
ok(Me.mercenaries.length === 17 && Me.mercenaries.filter(m => m.level === 1).length === 5, '17 mercenaries, 5 level-1');
ok(Me.mercenaries.every(m => m.cost >= 2 && m.sideA.clash && m.sideB.clash), 'mercenary cost + clash text on both sides');
ok(L.cards.length === 16 && L.cards.filter(c => c.type === 'kingdomGear').length === 4 && L.cards.every(c => c.gold.Mob <= c.gold.Dragon), 'loot deck 16 cards, gold rises with tier');
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
