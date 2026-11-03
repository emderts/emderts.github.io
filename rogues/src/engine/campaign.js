// Rogue's Path campaign (rulebook p.76–77): Rosegraal rounds, node → monster, Clash, Aftermath (resurrections, Loot, Rosegraal
// Rewards), Outpost (buy / reforge / hire), Sigh of the Graal replay, save/load.
import { Rng } from './core.js';
import { rollMonster, eligibleRewards, rewardId } from './rosegraal.js';
import { Clash, ChainBreak } from './clash.js';

const TIER = { 1: 'Mob', 2: 'Vassal', 3: 'King', 4: 'Devil', 5: 'Dragon' };
const TIER_IDX = { Mob: 1, Vassal: 2, King: 3, Devil: 4, Dragon: 5, All: 0 };
const SLOTS = { hand: 2, armor: 1, support: 2 };

export class Campaign {
  /** cfg: { data, seed, knights:[{def,name}], ownedMonsters:[ids]|null } */
  constructor(data, cfg = {}) {
    this.data = data; this.rng = new Rng(cfg.seed); this.ask = cfg.ask || (async q => { throw new Error('ask not wired: ' + q.type); }); this.log = [];
    this.map = data.rosegraal.map; this.tables = data.rosegraal.monster_tables; this.rewards = data.rosegraal.rewards;
    if (cfg.restore) { Object.assign(this, cfg.restore); this.rng = new Rng(cfg.restore.rngSeed); this.rng.s = cfg.restore.rngState; return; }
    this.owned = cfg.ownedMonsters || null;
    this.knights = cfg.knights.map((k, i) => this._newKnight(k, i));
    this.resurrections = 5; this.crossed = ['S']; this.round = 0; this.result = null; this.curseLevel = 0;
    this.unknownSaintUnlocked = false; this.mercPool = this._mercDeck(); this.hired = []; this.history = [];
    this.current = null; // { nodeId, monster, level, kingdom }
    this.say(`Rogue's Path 캠페인 시작 — 기사 ${this.knights.map(k => k.name).join(', ')}, 부활 ${this.resurrections}, 각 기사 Gold 10`);
  }
  say(m, kind = 'info') { this.log.push({ msg: m, kind, round: this.round }); return m; }
  _newKnight(k, i) {
    const def = this.data.knights[k.def];
    return { id: `${k.def}-${i}`, def: k.def, name: k.name || def.name + (i ? ' ' + (i + 1) : ''), gold: 10, sigh: 0, bane: 0, firstDeath: false, alive: true, dead: false,
      virtues: { ...def.setup.virtues }, unlocked: { techniques: [...def.setup.techniques], heroicArcs: [def.setup.heroicArc], perilArcs: [def.setup.perilArc], talents: [def.setup.talent], portraits: [def.setup.portrait] },
      loadout: { portrait: def.setup.portrait, heroicArc: def.setup.heroicArc, perilArc: def.setup.perilArc, talent: def.setup.talent, techniques: [...def.setup.techniques], gear: this._normalizeGear([...def.setup.gear]) },
      armory: [...def.setup.gear], claimed: [], rapport: {}, devotion: 0, saint: null };
  }
  _mercDeck() { return this.data.decks.mercenaries.mercenaries.filter(m => m.level === 1 || m.class === 'Ruin Stalker').map(m => ({ class: m.class, level: m.level, cost: m.cost, side: 'A', kingdom: m.kingdom })); }
  knightDef(k) { return this.data.knights[k.def]; }
  _normalizeGear(names) { const hands = names.filter(n => n !== 'Knighves').map(n => this.gearDef(n)).filter(g => g && g.type === 'weapon').reduce((a, g) => a + (g.hands || 1), 0); return hands >= 2 ? names.filter(n => n !== 'Knighves') : names; }
  handLimit(k) { const p = this.knightDef(k).portraits.find(p => p.id === k.loadout.portrait); return p ? p.handLimit : 4; }
  gearDef(name) { const G = this.data.gear; return G.gear.gear.find(g => g.name === name) || (G.monster_gear ? this._withKw(G.monster_gear.gear.find(g => g.name === name)) : null) || this._withKw(this.kingdomGearList().find(g => g.name === name)) || this._consumableAsGear(name) || this._merchantAsGear(name); }
  _withKw(g) { if (!g) return null; return g.ops ? g : { ...g, ops: { keywords: this._kwFromText(g.text) } }; }
  kingdomGearList(kingdom = null) { const G = this.data.gear; const all = [G.kingdom_principality ? G.kingdom_principality.gear : []].flat(); return kingdom ? all.filter(g => g.kingdom === kingdom) : all; }
  ownedCount(name) { return this.knights.reduce((a, k) => a + k.armory.filter(n => n === name).length, 0); }
  consumableDef(name) { const C = this.data.gear.consumables; return C ? C.consumables.find(c => c.name === name) : null; }
  _consumableAsGear(name) { const c = this.consumableDef(name); if (!c) return null; return { name: c.name, code: c.code, traits: c.traits, type: 'support', hands: null, tier: c.tier, consumable: true, price: c.price, charges: c.charges, text: c.text, gates: c.gates, ops: { keywords: this._kwFromText(c.text) } }; }
  upgradeDef(name) { const U = this.data.gear.upgrades; return U ? U.upgrades.find(u => u.name === name) : null; }
  /** Upgrade (rulebook p.21): attach to a non-Merchant Gear card of the matching type (Weapon / Armor), at most one per card, detachable. */
  setUpgrade(ck, gearName, upgradeName) {
    ck.upgrades = ck.upgrades || []; ck.loadout.upgrades = ck.loadout.upgrades || {};
    if (!upgradeName) { delete ck.loadout.upgrades[gearName]; return; }
    const u = this.upgradeDef(upgradeName), g = this.gearDef(gearName); if (!u || !g) throw new Error('없는 카드');
    if (!ck.upgrades.includes(upgradeName)) throw new Error('미보유 Upgrade'); if (g.merchant) throw new Error('Merchant Gear에는 Upgrade를 붙일 수 없음');
    if ((u.kind === 'weapon') !== (g.type === 'weapon') || (u.kind === 'armor' && g.type !== 'armor')) throw new Error(`${u.kind === 'weapon' ? 'Weapon' : 'Armor'} 전용 Upgrade`);
    for (const [gn, un] of Object.entries(ck.loadout.upgrades)) if (un === upgradeName && gn !== gearName) delete ck.loadout.upgrades[gn];
    ck.loadout.upgrades[gearName] = upgradeName;
  }
  _merchantAsGear(name) { for (const g of this.data.gear.merchant_principality.gear) { if (g.name === name) return this._sideToGear(g, g.side, false); if (g.reforgedName === name) return this._sideToGear(g, g.reforged, true); } return null; }
  _sideToGear(g, side, reforged) { return { name: reforged ? g.reforgedName : g.name, code: g.code, traits: reforged ? (g.reforgedTraits || g.traits) : g.traits, type: g.type, hands: g.type === 'weapon' ? (g.hands || 1) : null, tier: g.tier, merchant: true, price: g.price, reforgePrice: g.reforgePrice, reforgedName: reforged ? null : g.reforgedName, attackDice: side.attackDice, precision: side.precision, weaponPower: side.weaponPower ? { n: side.weaponPower.n, colour: side.weaponPower.colour === 'mixed' ? side.weaponPower.dice[0] : side.weaponPower.colour, dice: side.weaponPower.dice } : null, bonusPower: side.bonusPower, evasion: side.evasion, evasionReroll: side.evasionReroll, armorDice: side.armorDice ? (side.armorDice.dice ? side.armorDice.dice.reduce((a, c) => { a[c] = (a[c] || 0) + 1; return a; }, {}) : side.armorDice) : null, text: side.text, gates: side.gates, triggers: side.triggers, ops: { keywords: this._kwFromText(side.text) } }; }
  _kwFromText(t) { const out = []; for (const kw of ['break', 'opening', 'commit', 'cumbersome', 'deadly', 'closing', 'hope', 'sunder', 'black', 'fire']) { const m = new RegExp('(^|\\. |\\n)' + kw[0].toUpperCase() + kw.slice(1) + '( (\\d+))?\\.', 'i').exec(t || ''); if (m) out.push(m[3] ? { op: kw, n: +m[3] } : { op: kw }); } return out; }

  // ---------- Rosegraal ----------
  node(id) { return this.map.nodes.find(n => n.id === id); }
  neighbors(id) { return this.map.edges.filter(e => e.a === id || e.b === id).map(e => e.a === id ? e.b : e.a); }
  availableNodes() { const s = new Set(); for (const c of this.crossed) for (const n of this.neighbors(c)) if (!this.crossed.includes(n)) s.add(n); return [...s].map(id => this.node(id)); }
  tierOf(level) { return TIER[level]; }
  /** A node is playable when its table contains at least one Monster that is owned AND has data in this build. */
  nodePlayable(n) { const rows = this.tables.levels[String(n.level)][n.kingdom]; return rows.some(r => (!this.owned || this.owned.includes(r.monster)) && this.data.monsters[r.monster]); }
  playableMonsters() { return this.owned ? this.owned.filter(m => this.data.monsters[m]) : Object.keys(this.data.monsters); }
  get won() { return this.map.nodes.every(n => this.crossed.includes(n.id)); }
  get lost() { return this.knights.every(k => k.dead) && this.resurrections <= 0; }

  /** Choose a node: roll the Monster (re-roll unowned starred ones). Returns the current encounter. */
  chooseNode(nodeId) {
    const n = this.node(nodeId); if (!n || n.id === 'S' || this.crossed.includes(n.id) || !this.availableNodes().some(x => x.id === n.id)) throw new Error('invalid node ' + nodeId);
    const r = rollMonster(this.tables, this.rng, n.level, n.kingdom, this.playableMonsters());
    this.round++; this.current = { nodeId: n.id, monster: r.monster, monsterName: r.name, level: r.level, kingdom: n.kingdom, nodeLevel: n.level, roll: r.rolls, snapshot: null };
    this.say(`라운드 ${this.round}: 노드 ${n.id} (${n.kingdom}, Lv${n.level}) → d10 ${r.rolls.join('→')} → ${r.name} Lv${r.level}`);
    return this.current;
  }
  /** Build a Clash from the current loadouts. */
  buildClash(opts = {}) {
    const cur = this.current; const m = this.data.monsters[cur.monster];
    if (!m) throw new Error(`몬스터 데이터 없음: ${cur.monsterName}`);
    cur.snapshot = JSON.stringify(this.serialize());
    const knights = this.knights.filter(k => !k.dead).map(k => ({ def: k.def, name: k.name, portrait: k.loadout.portrait, heroicArc: k.loadout.heroicArc, perilArc: k.loadout.perilArc, talent: k.loadout.talent, techniques: k.loadout.techniques, gear: k.loadout.gear, tier: cur.nodeLevel, gold: k.gold, sigh: k.sigh, firstDeath: k.firstDeath, bane: k.bane }));
    const clash = new Clash({ data: this.data, knights, monster: cur.monster, level: cur.level, kingdom: cur.kingdom, seed: this.rng.int(1e9), listeners: { ...(opts.listeners || {}), beforeDeath: (k, reason, c) => this.beforeDeath(k, reason, c), onDeath: (k, reason, c) => this.onDeath(k, reason, c) } });
    clash.ask = opts.ask || this.ask; clash.curseLevel = this.curseLevel; clash.gearDef = n => this.gearDef(n);
    for (const kn of clash.knights) { const ck = this.knights.find(x => x.name === kn.name); kn.bane = ck.bane; kn.gear = kn.gear.map(g => g.name ? g : g); }
    // resolve gear through gearDef (merchant gear isn't in gear.json)
    for (const kn of clash.knights) { const ck = this.knights.find(x => x.name === kn.name); kn.gear = ck.loadout.gear.map(n => { const g = { ...this.gearDef(n), exhausted: false, discarded: false }; const un = ck.loadout.upgrades && ck.loadout.upgrades[n]; const u = un && this.upgradeDef(un); if (u) { g.upgrade = u; g.text = `${g.text || ''}\n[Upgrade: ${u.name}] ${u.text}`; g.ops = { ...(g.ops || {}), keywords: [...((g.ops && g.ops.keywords) || []), ...this._kwFromText(u.text)] }; } if (g.consumable) g.chargesLeft = g.charges; return g; }); kn.hired = this.hired; }
    // Inn buffs for this Rosegraal round
    for (const kn of clash.knights) { const b = (this.roundBuffs || {})[kn.name]; if (!b) continue; if (b.heatLimit) kn.heatLimitBonus = (kn.heatLimitBonus || 0) + b.heatLimit; if (b.fortify) kn.extraVigor = (kn.extraVigor || 0) + b.fortify; if (b.passion) kn.gainPassion(b.passion); if (b.passionMin) kn.passionMin = b.passionMin; if (b.baneLimit) kn.baneLimit += b.baneLimit; if (b.resource) kn.fleischBoard = (kn.fleischBoard || 0) + b.resource; if (b.parasiteBait) { const pb = this.gearDef('Parasite Bait'); if (pb) kn.gear.push({ ...pb, exhausted: false, discarded: false, temp: true }); } }
    clash.hired = this.hired; clash.campaign = this;
    this.clash = clash; return clash;
  }
  /** Unknown Saint incarnation hook (Kingdom Mysteries 9999 + rulebook p.69). Returns true if the Knight is saved. */
  async beforeDeath(kn, reason, clash) {
    if (reason === 'Bane Limit exceeded') return false;
    const ck = this.knights.find(x => x.name === kn.name);
    if (!this.unknownSaintUnlocked) { this.unknownSaintUnlocked = true; clash.say(`✦ Kingdom Mysteries 9999: ${kn.name}이(가) 죽음의 문턱에서 Unknown Saint로 Incarnate! (이후 모든 기사는 사망 직전 d10=10으로 Incarnate 시도 가능)`, 'mortis'); await this.incarnate(kn, clash); return true; }
    if (ck && ck.saint) return false; // devoted to a specific Saint → that Saint's rules (not implemented)
    const r = clash.rng.die(10); clash.say(`${kn.name} Unknown Saint Incarnation d10 = ${r}${r === 10 ? ' → Incarnate!' : ''}`, 'dice');
    if (r === 10) { await this.incarnate(kn, clash); return true; }
    return false;
  }
  async incarnate(kn, clash) {
    kn.vigor = Math.max(1, kn.vigor); clash.standUp(kn); kn.conditions = []; kn.bane = Math.max(0, kn.bane - 2); kn.incarnated = true;
    const n = 2 + (this.knights.find(x => x.name === kn.name)?.devotion || 0); await clash.knightMove(kn, n);
    if (clash.canAttack(kn) && await clash.yesNo(`${kn.name} Incarnation: Bonus Attack 수행?`, true)) { kn.bonusAttacks = 0; await clash.knightAttack(kn, { bonus: true }); }
    clash.say(`${kn.name} Incarnation 종료 — 사망하지 않음`, 'mortis');
    throw new ChainBreak('Incarnation');
  }
  async onDeath(kn, reason, clash) {
    const ck = this.knights.find(x => x.name === kn.name); if (!ck) return;
    if (!ck.firstDeath) { ck.firstDeath = true; const fd = this.knightDef(ck).firstDeath; if (fd) { clash.say(`First Death Event (${ck.name}): ${fd.text}`, 'mortis'); for (const o of fd.ops || []) if (o.op === 'gainSigh') { if (ck.sigh < 1) { ck.sigh += o.n; clash.say(`${ck.name} Sigh of the Graal +${o.n}`); } else clash.say(`${ck.name}은 이미 Sigh 보유 (최대 1)`); } } }
  }

  /** Aftermath after a Clash (rulebook p.63 + p.76–77 Rogue's Path). `ask` drives Loot distribution and reward picks. */
  async aftermath(clash) {
    const cur = this.current; const node = this.node(cur.nodeId); const win = clash.result === 'win';
    const deaths = clash.knights.filter(k => !k.alive).length; const survivors = clash.knights.filter(k => k.alive).length;
    // carry back knight state
    for (const kn of clash.knights) { const ck = this.knights.find(x => x.name === kn.name); ck.bane = Math.max(0, kn.bane - 2); ck.gold = kn.gold; }
    this.say(`Clash ${win ? '승리' : '패배'} — 사망 ${deaths}, 생존 ${survivors}`);
    // Sigh of the Graal offer
    const withSigh = this.knights.filter(k => k.sigh > 0);
    if (withSigh.length && await this.ask({ type: 'confirm', text: `Sigh of the Graal 사용 — Clash를 처음부터 다시 치릅니다 (같은 ${cur.monsterName} Lv${cur.level}). ${withSigh.map(k => k.name).join('/')} 보유`, default: false, options: [{ label: '사용', value: true }, { label: '사용 안 함', value: false }] })) {
      let k = withSigh[0];
      if (withSigh.length > 1) k = await this.ask({ type: 'pick', text: '누구의 Sigh of the Graal을 사용합니까?', options: withSigh.map(x => ({ label: `${x.name} (Sigh ${x.sigh})`, value: x })) });
      // Restore the pre-Clash snapshot. Once-per-campaign facts (First Death happened, Sigh consumed) survive the rewind.
      const after = this.knights.map(x => ({ name: x.name, firstDeath: x.firstDeath }));
      const snap = JSON.parse(cur.snapshot); Object.assign(this, snap); this.rng = new Rng(snap.rngSeed); this.rng.s = snap.rngState;
      for (const x of this.knights) { const a = after.find(y => y.name === x.name); if (a && a.firstDeath) x.firstDeath = true; }
      const rk = this.knights.find(x => x.name === k.name);
      // If the Sigh existed before the Clash it is spent now; a Sigh gained during this Clash (First Death) is spent by being rewound.
      if (rk.sigh > 0) rk.sigh--;
      this.current.sighUsed = (this.current.sighUsed || 0) + 1;
      this.say(`${k.name}이 Sigh of the Graal 사용 → Clash 재시작`); return 'replay';
    }
    this.roundBuffs = {}; // Inn effects last for this Rosegraal round only
    // Consumable Gear equipped for this Clash moves to the Merchant deck (rulebook p.66 Loot / p.29)
    for (const ck of this.knights) { const used = (ck.loadout.gear || []).filter(n => this.consumableDef(n)); for (const n of used) { ck.loadout.gear = ck.loadout.gear.filter(x => x !== n); const i = ck.armory.indexOf(n); if (i >= 0) ck.armory.splice(i, 1); (this.merchantConsumables = this.merchantConsumables || []).push(n); this.say(`${ck.name}: Consumable ${n} → Merchant 덱으로`); } }
    // resurrections
    if (deaths && survivors > 0) {
      // 확정(2026-11-02): 생존자가 있으면 부활 수가 모자라도 사망 기사 전원 부활, 부활은 0 아래로 내려가지 않음
      const before = this.resurrections; this.resurrections = Math.max(0, before - deaths);
      this.say(`부활 -${deaths} → ${this.resurrections}${before < deaths ? ' (부족분 무시: 생존자 있음 → 전원 부활)' : ''}`);
    } else if (deaths) {
      // 확정(2026-11-02): 전멸 시 부활이 사망자 수 이상이면 전원 부활, 모자라면 캠페인 패배
      if (this.resurrections < deaths) { for (const ck of this.knights) ck.dead = true; this.say(`전멸 — 부활 ${this.resurrections} < 사망 ${deaths} → 캠페인 패배`, 'end'); }
      else { this.resurrections -= deaths; this.say(`전멸 — 부활 -${deaths} → ${this.resurrections}`); }
    }
    if (this.knights.every(k => k.dead)) { this.result = 'lose'; this.current = null; this.say('전멸, 부활 부족 — 캠페인 패배', 'end'); return 'lose'; }
    // Loot (Victorious: Clash Scavenge 1 + Scavenge 3 / Forlorn: Scavenge 3)
    const lootDeck = [];
    const L = this.data.decks.loot.cards;
    const take = type => { const c = L.find(c => c.type === type && !lootDeck.includes(c) && !this.lootUsed?.includes(c.code)); if (c) lootDeck.push(c); return c; };
    if (win) take('fullClash');
    for (let i = 0; i < 3; i++) { const t = await this.ask({ type: 'pick', text: `Scavenge ${i + 1}/3 — Loot 종류 선택`, options: [['kingdomGear', 'Kingdom Gear'], ['upgrade', 'Upgrade'], ['consumableGear', 'Consumable Gear']].map(([v, l]) => ({ label: l, value: v })) }); take(t || 'kingdomGear'); }
    this.say(`Loot deck: ${lootDeck.map(c => c.type).join(', ')}`);
    const tier = TIER[cur.nodeLevel]; const alive = this.knights.filter(k => !k.dead);
    // distribution: each Knight picks 1 (party decides order), then spare scrap round robin → gold
    const pool = [...lootDeck];
    for (const ck of alive) { if (!pool.length) break; const pick = await this.ask({ type: 'pick', text: `${ck.name} — Loot 1장 선택 (Gear 교환 또는 Gold)`, options: pool.map(c => ({ label: `${c.type} (${c.gold[tier]}G)`, value: c.code })) }); const card = pool.find(c => c.code === pick) || pool[0]; pool.splice(pool.indexOf(card), 1); await this.exchangeLoot(ck, card, tier, true); }
    let i = 0; while (pool.length) { const ck = alive[i % alive.length]; const card = pool.shift(); ck.gold += card.gold[tier]; this.say(`Spare Scrap: ${ck.name} +${card.gold[tier]}G (${card.type})`); i++; }
    if (!win) { this.say('패배 — Rosegraal 보상 없음, 노드 유지'); this.current = null; this.history.push({ round: this.round, node: node.id, monster: cur.monsterName, level: cur.level, result: 'lose' }); if (this.lost) this.result = 'lose'; return 'lose'; }
    // Rosegraal rewards
    let gain = node.res; if (this.resurrections === 0 && survivors < 4) gain = Math.max(gain, 4 - survivors); this.resurrections += gain; this.say(`부활 +${gain} → ${this.resurrections}`);
    for (const ck of alive) {
      if (node.reward === 'S') { if (ck.sigh < 1 && await this.ask({ type: 'confirm', text: `${ck.name} Sigh of the Graal 획득? (기사당 1개)`, default: true, options: [{ label: '획득', value: true }, { label: '다른 기사에게', value: false }] })) { ck.sigh = 1; this.say(`${ck.name} Sigh of the Graal 획득`); break; } continue; }
      const el = eligibleRewards(this.rewards, ck.def, node.reward, node.level, new Set(ck.claimed));
      if (!el.length) { this.say(`${ck.name}: ${this.rewards.kinds[node.reward]} 보상 남은 것 없음`); continue; }
      const pick = await this.ask({ type: 'pick', text: `${ck.name} — Rosegraal 보상 (${this.rewards.kinds[node.reward]}, Lv≤${node.level})`, options: el.map(e => ({ label: `L${e.level}: ${this.rewardLabel(e.reward)}`, value: e.id })) });
      const chosen = el.find(e => e.id === pick) || el[0]; ck.claimed.push(chosen.id); this.applyReward(ck, chosen.reward, chosen.kind); this.say(`${ck.name} 보상: ${this.rewardLabel(chosen.reward)}`);
    }
    this.crossed.push(node.id); this.history.push({ round: this.round, node: node.id, monster: cur.monsterName, level: cur.level, result: 'win' }); this.current = null;
    if (this.won) { this.result = 'win'; this.say('🏆 Rosegraal 완료 — 캠페인 승리!', 'end'); }
    return 'win';
  }
  rewardLabel(r) { if (typeof r === 'string') return r; if (r.kind === 'technique') return `${r.name} (Technique)`; if (r.kind === 'portrait') return `${r.name} (Portrait+Talent)`; if (r.kind === 'rapport') return `+${r.n} Rapport`; if (r.kind === 'mercenary') return `Tier ${r.tier} ${r.cls} Mercenary`; if (r.kind === 'saint') return `Saint ${r.name}`; if (r.kind === 'gold') return `+${r.n} Gold`; if (r.bonuses) return Object.entries(r.bonuses).map(([v, n]) => `+${n} ${v}`).join(' & '); return JSON.stringify(r); }
  applyReward(ck, r, kind) {
    const U = ck.unlocked;
    if (kind === 'H') { if (!U.heroicArcs.includes(r)) U.heroicArcs.push(r); }
    else if (kind === 'P') { if (!U.perilArcs.includes(r)) U.perilArcs.push(r); }
    else if (kind === 'G') { const n = r.split(' // ')[0]; ck.armory.push(n); }
    else if (kind === 'V') { for (const [v, n] of Object.entries(r.bonuses)) ck.virtues[v] = (ck.virtues[v] || 0) + n; }
    else if (kind === 'W') { if (r.kind === 'gold') ck.gold += r.n; else if (r.kind === 'rapport') ck.rapport._pending = (ck.rapport._pending || 0) + r.n; else if (r.kind === 'mercenary') { const m = this.data.decks.mercenaries.mercenaries.find(x => x.class === r.cls && x.level === r.tier); if (m && !this.mercPool.some(p => p.class === m.class && p.level === m.level)) this.mercPool.push({ class: m.class, level: m.level, cost: m.cost, side: 'A' }); } else if (r.kind === 'saint') { ck.saintUnlocked = ck.saintUnlocked || []; ck.saintUnlocked.push(r.name); } }
    else if (kind === 'C' || kind === 'T') { if (r.kind === 'technique') { if (!U.techniques.includes(r.name)) U.techniques.push(r.name); } else if (r.kind === 'portrait') { const def = this.knightDef(ck); const p = def.portraits.find(p => p.classes.includes(r.name)); if (p && !U.portraits.includes(p.id)) U.portraits.push(p.id); const t = def.talents.find(t => t.name === r.name); if (t && !U.talents.includes(t.name)) U.talents.push(t.name); } }
  }

  // ---------- Outpost (codex p.6, rulebook p.28–29) ----------
  merchantDeck(tierLevel) { const cons = [...(this.merchantConsumables || []), ...((this.outpost && this.outpost.round === this.round && this.outpost.tempConsumables) || [])].map(n => this.consumableDef(n)).filter(c => c && TIER_IDX[c.tier] <= tierLevel).map(c => ({ name: c.name, tier: c.tier, price: c.price, type: 'support', consumable: true, traits: c.traits, side: { text: `[Consumable · Charge ${c.charges}] ${c.text}` } }));
    return [...this.data.gear.merchant_principality.gear.filter(g => TIER_IDX[g.tier] <= tierLevel), ...cons]; }
  buyGear(ck, name, tierLevel) { const g = this.merchantDeck(tierLevel).find(g => g.name === name); if (!g) throw new Error('not in merchant deck'); if (ck.gold < g.price) throw new Error('Gold 부족'); ck.gold -= g.price; ck.armory.push(g.name); if (g.consumable) { const i = (this.merchantConsumables || []).indexOf(g.name); if (i >= 0) this.merchantConsumables.splice(i, 1); else if (this.outpost && this.outpost.tempConsumables) { const j = this.outpost.tempConsumables.indexOf(g.name); if (j >= 0) this.outpost.tempConsumables.splice(j, 1); } } ck.boughtThisOutpost = (ck.boughtThisOutpost || []).concat(g.name); this.say(`${ck.name} 구매: ${g.name} (-${g.price}G, 남은 ${ck.gold}G)`); }
  reforge(ck, name) { const g = this.data.gear.merchant_principality.gear.find(g => g.name === name); if (!g) throw new Error('재련 불가'); if ((ck.boughtThisOutpost || []).includes(name)) throw new Error('같은 Outpost에서 산 장비는 재련 불가'); if (!ck.armory.includes(name)) throw new Error('미보유'); if (ck.gold < g.reforgePrice) throw new Error('Gold 부족'); ck.gold -= g.reforgePrice; ck.armory[ck.armory.indexOf(name)] = g.reforgedName; const li = ck.loadout.gear.indexOf(name); if (li >= 0) ck.loadout.gear[li] = g.reforgedName; this.say(`${ck.name} 재련: ${name} → ${g.reforgedName} (-${g.reforgePrice}G)`); }
  hire(payer, mercClass, level) { if (this.hired.length >= 4) throw new Error('용병 최대 4'); const m = this.mercPool.find(m => m.class === mercClass && m.level === level); if (!m) throw new Error('없음'); if (this.hired.some(h => h.class === m.class)) throw new Error('같은 이름 용병 중복 불가'); if (payer.gold < m.cost) throw new Error('Gold 부족'); payer.gold -= m.cost; this.hired.push({ ...m, side: 'A' }); this.say(`${payer.name}이 ${m.class} L${m.level} 고용 (-${m.cost}G)`); }
  dismissAll() { this.hired = []; }
  /** Outpost state for this Rosegraal round: first section visited gets its Early Bird (rulebook p.28). */
  outpostState() { if (!this.outpost || this.outpost.round !== this.round) this.outpost = { round: this.round, earlyBird: null, inn: null, tempMercs: [] }; return this.outpost; }
  async earlyBird(section, tierLevel) {
    const st = this.outpostState(); if (st.earlyBird) return st.earlyBird; st.earlyBird = section; const ask = this.ask;
    const M = this.data.decks.mercenaries.mercenaries;
    if (section === 'mercenaryGuild') {
      let lvl = 2; if (tierLevel >= 4 && await ask({ type: 'confirm', text: 'Early Bird (Devil 티어): 레벨 2 대신 레벨 3 용병을 추가할까요?', default: true, options: [{ label: '레벨 3', value: true }, { label: '레벨 2', value: false }] })) lvl = 3;
      const cands = M.filter(m => m.level === lvl && !this.mercPool.some(x => x.class === m.class && x.level === m.level)); if (cands.length) { const m = this.rng.pick(cands); const e = { class: m.class, level: m.level, cost: m.cost, side: 'A', kingdom: m.kingdom, temp: true }; this.mercPool.push(e); st.tempMercs.push(e); this.say(`Early Bird (Mercenary Guild): 레벨 ${lvl} ${m.class} 임시 추가`); }
    } else if (section === 'inn') this.say('Early Bird (Inn): 굴리는 대신 결과를 고를 수 있음');
    else if (section === 'merchantsWorkshop') { const C = this.data.gear.consumables ? this.data.gear.consumables.consumables.filter(c => c.tier === this.tierOf(tierLevel)) : []; if (C.length) { const c = this.rng.pick(C); (st.tempConsumables = st.tempConsumables || []).push(c.name); this.say(`Early Bird (Merchant's Workshop): ${c.name} (${c.tier}, ${c.price}G) 임시 추가`); } else this.say('Early Bird (Merchant\'s Workshop): 해당 티어 Consumable 없음'); }
    return section;
  }
  /** Inn (codex p.6): once per Outpost, roll a d10 (results 6 and 7 are not used in Rogue's Path → re-roll), or choose with the Inn Early Bird. */
  async innVisit(tierLevel, chosen = null) {
    const st = this.outpostState(); if (st.inn) throw new Error('이번 Outpost에서 이미 Inn 사용'); if (!st.earlyBird) await this.earlyBird('inn', tierLevel);
    const R = this.data.outpost.principality.sections.inn.results; let n = chosen;
    if (n == null || st.earlyBird !== 'inn') { do { n = this.rng.die(10); } while (n === 6 || n === 7); }
    st.inn = n; const alive = this.knights.filter(k => !k.dead); const pick2 = () => this.rng.shuffle([...alive]).slice(0, 2); const buf = k => { this.roundBuffs = this.roundBuffs || {}; return (this.roundBuffs[k.name] = this.roundBuffs[k.name] || {}); };
    this.say(`Inn ${n}: ${R[n].text}`);
    if (n === 1) for (const k of pick2()) { buf(k).virtue = (buf(k).virtue || 0) + 1; this.say(`${k.name}: Virtue +1 (Delve 전용 — Clash 효과 없음)`); }
    else if (n === 2) for (const k of pick2()) { buf(k).heatLimit = (buf(k).heatLimit || 0) + 1; this.say(`${k.name}: Heat Limit +1 (이번 라운드)`); }
    else if (n === 3) for (const k of pick2()) { buf(k).fortify = (buf(k).fortify || 0) + 2; this.say(`${k.name}: Fortify 2 (최대 Vigor → 추가 Vigor 2)`); }
    else if (n === 4) { const k = this.rng.pick(alive); buf(k).passion = (buf(k).passion || 0) + 1; buf(k).passionMin = 1; this.say(`${k.name}: Passion +1, 이번 라운드 Passion 최소 1`); }
    else if (n === 5) { const L = this.data.decks.loot.cards.filter(c => c.gold); const c = this.rng.pick(L); const g = c.gold[this.tierOf(tierLevel)] || 0; for (const k of alive) k.gold += g; this.say(`Loot ${c.type}: 기사마다 +${g}G`); }
    else if (n === 8) { const k = this.rng.pick(alive); buf(k).baneLimit = (buf(k).baneLimit || 0) + 1; this.say(`${k.name}: Bane Limit +1 (이번 라운드)`); }
    else if (n === 9) { const who = alive.length > 1 ? await this.ask({ type: 'pick', text: 'Inn 9: Resource 토큰(Fleisch)을 받을 기사', options: alive.map(k => ({ label: k.name, value: k.name })) }) : alive[0].name; const k = alive.find(x => x.name === who) || alive[0]; buf(k).resource = (buf(k).resource || 0) + 1; this.say(`${k.name}: Clash 시작 시 Fleisch 토큰 1`); }
    else if (n === 10) { const k = this.rng.pick(alive); buf(k).parasiteBait = true; this.say(`${k.name}: Parasite Bait Kingdom 카드를 이번 라운드 동안 추가 장착`); }
    return n;
  }
  endOutpost() { for (const k of this.knights) delete k.boughtThisOutpost; const st = this.outpost; if (st && st.tempMercs.length) { this.mercPool = this.mercPool.filter(m => !st.tempMercs.includes(m) && !(m.temp && !this.hired.some(h => h.class === m.class && h.level === m.level))); st.tempMercs = []; } }
  /** Loadout validation: 2 hand slots (2H weapon = 2), 1 armor, 2 support; Knighves auto-fills a free hand slot. */
  setLoadoutGear(ck, names) { const defs = names.map(n => this.gearDef(n)).filter(Boolean); let hands = 0, armor = 0, support = 0; for (const g of defs) { if (g.type === 'weapon') hands += g.hands || 1; else if (g.type === 'armor') armor++; else support++; } if (hands > SLOTS.hand || armor > SLOTS.armor || support > SLOTS.support) throw new Error(`슬롯 초과 (손 ${hands}/2, 갑옷 ${armor}/1, 보조 ${support}/2)`); const out = defs.map(g => g.name); if (hands < SLOTS.hand && !out.includes('Knighves')) out.push('Knighves'); ck.loadout.gear = out; }
  setLoadoutTechniques(ck, names) { const lim = this.handLimit(ck); if (names.length > lim) throw new Error(`Hand Limit ${lim}`); if (!names.every(n => ck.unlocked.techniques.includes(n))) throw new Error('미해금 기술'); ck.loadout.techniques = [...names]; }
  setLoadoutCards(ck, { portrait, heroicArc, perilArc, talent }) { const U = ck.unlocked; if (portrait && U.portraits.includes(portrait)) ck.loadout.portrait = portrait; if (heroicArc && U.heroicArcs.includes(heroicArc)) ck.loadout.heroicArc = heroicArc; if (perilArc && U.perilArcs.includes(perilArc)) ck.loadout.perilArc = perilArc; if (talent && U.talents.includes(talent)) ck.loadout.talent = talent; if (ck.loadout.techniques.length > this.handLimit(ck)) ck.loadout.techniques = ck.loadout.techniques.slice(0, this.handLimit(ck)); }
  async exchangeLoot(ck, card, tier, allowGear) {
    const gold = card.gold[tier]; const tierLevel = TIER_IDX[tier];
    let gearOpts = [];
    if (allowGear) {
      const G = this.data.gear; const okTier = t => t !== 'Legendary' && TIER_IDX[t] <= tierLevel;
      if (card.type === 'fullClash' || card.type === 'exhibitionClash') { const mg = G.monster_gear ? G.monster_gear.gear.filter(g => g.monster === this.current.monster && okTier(g.tier)) : []; gearOpts = mg.map(g => ({ label: `${g.name} (${g.tier} · ${g.type}${g.hands ? ' ' + g.hands + 'H' : ''})`, value: 'gear:' + g.name })); if (!gearOpts.length) this.say(`${cur0(this)}: 교환 가능한 몬스터 Gear 없음 → Gold`); }
      else if (card.type === 'kingdomGear') { const kg = this.kingdomGearList(this.current.kingdom).filter(g => !g.story && okTier(g.tier) && this.ownedCount(g.name) < (g.copies || 1)); gearOpts = kg.map(g => ({ label: `${g.name} (${g.tier} Kingdom Gear)`, value: 'gear:' + g.name })); if (!this.kingdomGearList(this.current.kingdom).length) this.say(`${this.current.kingdom} Kingdom Gear 자료 없음 → Gold`); }
      else if (card.type === 'consumableGear') gearOpts = (G.consumables ? G.consumables.consumables.filter(c => okTier(c.tier)) : []).map(c => ({ label: `${c.name} (${c.tier} · Charge ${c.charges})`, value: 'gear:' + c.name }));
      else if (card.type === 'upgrade') gearOpts = (G.upgrades ? G.upgrades.upgrades.filter(u => okTier(u.tier)) : []).map(u => ({ label: `${u.name} (${u.tier} ${u.kind === 'weapon' ? 'Weapon' : 'Armor'} Upgrade)`, value: 'upg:' + u.name }));
    }
    const v = gearOpts.length ? await this.ask({ type: 'pick', text: `${ck.name} — ${card.type} Loot 교환`, options: [{ label: `Gold +${gold}`, value: 'gold' }, ...gearOpts] }) : 'gold';
    if (v === 'gold' || !v) { ck.gold += gold; this.say(`${ck.name} Loot → +${gold}G (${ck.gold}G)`); } else if (v.startsWith('upg:')) { const n = v.slice(4); (ck.upgrades = ck.upgrades || []).push(n); this.say(`${ck.name} Loot → Upgrade ${n}`); } else { const n = v.slice(5); ck.armory.push(n); this.say(`${ck.name} Loot → ${n}`); }
    function cur0(c) { return c.current ? c.current.monsterName : ''; }
  }

  // ---------- save / load ----------
  serialize() { const { data, rng, ask, log, clash, map, tables, rewards, ...rest } = this; return { ...JSON.parse(JSON.stringify(rest)), rngSeed: rng.seed, rngState: rng.s, log: log.slice(-300), version: this.data.meta.version }; }
  static restore(data, saved) { const c = new Campaign(data, { seed: 1, knights: [], restore: saved }); c.log = saved.log || []; return c; }
}
