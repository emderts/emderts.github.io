// Clash engine: Boss Clash loop (rulebook pp.42–66) — Monster Round, Knight Round, Knight Attack, Peril/Mortis/Judicium,
// Conditions, Terrain, Escalation. Monster/knight card effects are interpreted from data `ops` (see effects.js).
import { Rng, Deck, GameOver } from './core.js';
import { Board, DIRS, inFront, rearCells, faceToward } from './board.js';
import { rollD10s, d10Success, buildPowerPool, rollPowerPool, rollArmor } from './dice.js';
import { Knight } from './knight.js';
import { Monster } from './monster.js';
import { Effects } from './effects.js';
import { MobMixin } from './mobs.js';
import { BloodMixin } from './blood.js';
import { HauntsMixin } from './haunts.js';
import { FirstmenMixin } from './firstmen.js';
import { TrollMixin } from './troll.js';
import { NightmareMixin } from './nightmare.js';
import { FenMixin } from './fen.js';
import { PumpMixin } from './pump.js';
import { RatMixin } from './ratwolves.js';
import { PanzerMixin } from './panzergeists.js';
import { MasonMixin } from './stonemason.js';
import { EaterMixin } from './knighteater.js';
import { LictorMixin } from './lictor.js';
import { WitchMixin } from './bogwitch.js';
import { applyReactPlan } from './reactplan.js';
import { IroncastMixin } from './ironcast.js';
import { RenholderMixin } from './renholder.js';
import { KaraMixin, installKara } from './kara.js';
import { ParacelsaMixin, installParacelsa } from './paracelsa.js';
import { SonchMixin, installSonch } from './sonch.js';
import { UbarMixin, installUbar } from './ubar.js';
import { StonefaceMixin } from './stoneface.js';
import { KingLowMixin } from './kinglaidlow.js';
import { DevilMixin } from './devils.js';
import { SmeltedMixin } from './smeltedfears.js';
import { PuppetMixin } from './puppetking.js';
import { DragonMixin } from './dragons.js';
import { VeldrMixin } from './veldr.js';
import { DevourMixin } from './devourdragon.js';
import { ExtrasMixin, installExtras } from './extras.js';

export class ChainBreak extends Error { constructor(msg = 'Chain Break') { super(msg); this.chainBreak = true; } }
const sum = a => a.reduce((x, y) => x + y, 0);
const uniq = a => [...new Set(a)];
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;

export class Clash {
  get priorityTarget() { return this._pt || null; }
  set priorityTarget(v) { const cur = this._pt; if (cur && v !== cur && cur.alive && !cur.possessed && this.fx && this.fx.gearHas(cur, 'keepPriority')) { if (v) this.say(`${cur.name}: Priority Target 토큰을 잃을 수 없음 (Gear)`, 'tech'); return; } this._pt = v; }
  /**
   * cfg: { data, knights:[{def, portrait, heroicArc, perilArc, talent, techniques, gear}], monster:'eggknight', level, kingdom, seed, ask }
   */
  constructor(cfg) {
    this.data = cfg.data; this.rng = new Rng(cfg.seed); this.log = []; this.ask = cfg.ask || (async q => { throw new Error('ask not wired: ' + q.type); });
    this.kingdom = cfg.kingdom || 'principality'; this.round = 0; this.result = null; this.listeners = cfg.listeners || {};
    this.board = new Board(this.data.components.board);
    this.pool = []; // Knight Pool tokens: {token, temp}
    this.monsterDef = this.data.monsters[cfg.monster]; applyReactPlan(this.monsterDef); this.monster = new Monster(this.monsterDef, cfg.level, this.rng); this.nodeLevel = cfg.nodeLevel || cfg.level || 1; /* Rogue's Path: tier gates ([VASSAL] etc.) follow the node level */
    this.knights = cfg.knights.map((k, i) => this._mkKnight(k, i));
    this.fx = new Effects(this);
    this._setupDecks();
    this.priorityTarget = null; this.firstRound = true; this.currentAttack = null; this.bpCounter = 0;
  }
  flash(kind, d) { if (this.listeners.flash) this.listeners.flash(kind, d); }
  say(msg, kind = 'info') { this.log.push({ msg, kind, round: this.round }); if (this.listeners.log) this.listeners.log(msg, kind); return msg; }

  // ---------- setup ----------
  /** Gear card by name: knight / generic gear first, then Merchant gear (front side) — starting equipment can be Merchant gear (e.g. Crude Bow). */
  gearByName(n) { const G = this.data.gear; const g = G.gear.gear.find(x => x.name === n); if (g) return g; for (const key of Object.keys(G)) { if (!/^merchant/.test(key)) continue; const m = (G[key].gear || []).find(x => x.name === n); if (m) { const { side, reforged, ...rest } = m; return { ...rest, ...(side || {}), merchant: true }; } } return undefined; /* other Gear (monster / kingdom) is attached by the Campaign after construction */ }
  _mkKnight(k, i) {
    const def = this.data.knights[k.def]; const portrait = def.portraits.find(p => p.id === (k.portrait || def.setup.portrait));
    const perilArc = this.data.knights.peril_arcs.arcs[k.def].find(a => a.name === (k.perilArc || def.setup.perilArc));
    const th = ['Minor', 'Major', 'Grave', 'Judicium'].map(p => ({ peril: p, atVigor: perilArc.levels[p].vigor[0], heatLimit: perilArc.levels[p].heatLimit }));
    const kn = new Knight({ id: `${k.def}-${i}`, name: k.name || def.name + (cfg0(i)), portrait, perilArc: { maxVigor: perilArc.maxVigor + (k.maxVigorMod || 0), uninjuredHeatLimit: perilArc.levels.Uninjured.heatLimit, thresholds: th } });
    kn.def = def; kn.knightId = k.def; kn.devotion = k.devotion || 0; kn.perilArcDef = perilArc; kn.portraitDef = portrait;
    kn.heroicArc = def.heroicArcs.find(a => a.name === (k.heroicArc || def.setup.heroicArc)); kn.talent = def.talents.find(t => t.name === (k.talent || def.setup.talent));
    kn.hand = (k.techniques || def.setup.techniques).map(n => ({ ...def.techniques.find(t => t.name === n) }));
    kn.gear = (k.gear || def.setup.gear).map(n => ({ ...this.gearByName(n), exhausted: false, discarded: false }));
    { const otherHands = kn.gear.filter(g => g.type === 'weapon' && g.name !== 'Knighves').reduce((a, g) => a + (g.hands || 1), 0); if (otherHands >= 2) { const kv = kn.gear.find(g => g.name === 'Knighves'); if (kv) { kn.gear = kn.gear.filter(g => g !== kv); kn.knighvesReserve = kv; } } } // Knighves only in a free hand slot (p.20)
    kn.virtues = { ...def.setup.virtues }; kn.tier = k.tier || 1; kn.pos = null; kn.conditions = []; kn.chokeLimit = 0; kn.braced = false; kn.usedArcLevels = new Set(); kn.bonusAttacks = 0; kn.heroicUsed = {};
    kn.gold = k.gold ?? 0; kn.sigh = k.sigh ?? 0; kn.fleischBoard = 0; kn.firstDeath = k.firstDeath || false; kn.turnsTaken = 0; kn.powerDice = portrait.powerDice || 1; this.renSetup(kn); this.ubarSetup(kn);
    return kn;
    function cfg0(i) { return i ? ' ' + (i + 1) : ''; }
  }
  _setupDecks() {
    const M = this.data.decks.mortis; const kf = c => !c.kingdom || c.kingdom === this.kingdom;
    this.mortis = { Minor: new Deck(M.minor.filter(kf).map(c => ({ ...c, tier: 'Minor' })), this.rng).shuffle(), Major: new Deck(M.major.filter(kf).map(c => ({ ...c, tier: 'Major' })), this.rng).shuffle(), Grave: new Deck(M.grave.filter(kf).map(c => ({ ...c, tier: 'Grave' })), this.rng).shuffle() };
    const J = M.judicium; this.judiciumBase = [J.find(c => c.name === 'You Live!'), J.find(c => c.name === 'You Died')]; this.judiciumExtra = []; this.judiciumAll = J;
    this.conditionDefs = Object.fromEntries(this.data.decks.conditions.conditions.map(c => [c.name, c]));
  }
  setup() {
    const cs = this.monsterDef.clashSetup; const B = this.board;
    // terrain
    for (const t of cs.terrain) { const tdef = this.data.terrain.terrain.find(x => x.name.toLowerCase() === t.tile); t.cells.forEach((lab, i) => B.terrain.set(B.key(B.parse(lab)), { num: t.numbers ? t.numbers[i] : t.num, id: t.tile, obstacle: tdef.keywords.includes('Obstacle'), obscuring: tdef.keywords.includes('Obscuring'), destructible: tdef.keywords.includes('Destructible'), chasm: tdef.keywords.includes('Chasm'), difficult: tdef.keywords.includes('Difficult Terrain') })); }
    // monster
    if (this.monster.isMob) { this.hauntsSetup(); if (this.monsterDef.nightmare) this.nightmareSetup(cs); else if (this.monsterDef.pump) this.pumpSetup(cs); else this.setupMobs(cs); if (this.monsterDef.rat) this.ratSetup(); if (this.monsterDef.pz) this.pzSetup(cs); this.bloodSetup(); this.firstmenSetup(); if (this.monsterDef.lh) this.lhSetup(); } else {
    this.monster.cells = cs.monsterCells.map(l => B.parse(l)); B.place({ kind: 'monster', id: this.monster.id }, this.monster.cells);
    if (cs.facing) { this.monster.facing = cs.facing; this.say(`${this.monster.name} 배치 ${cs.monsterCells.join('/')} · 방향 ${cs.facing}`); } else { const bottom = this.mortis.Minor.cards.at(-1); const arrowDir = { up: 'N', down: 'S', left: 'W', right: 'E' }[bottom.marker.arrow]; this.monster.facing = arrowDir; this.say(`Eggknight 배치 ${cs.monsterCells.join('/')} · 방향 ${arrowDir} (Minor Mortis 바닥: ${bottom.name})`); }
    this.trollSetup(cs); this.fenSetup(); if (this.monsterDef.sm) this.smSetup(cs); if (this.monsterDef.ke) this.keSetup(cs); if (this.monsterDef.bw) this.bwSetup(cs); if (this.monsterDef.kl) this.klSetup(cs); if (this.monsterDef.dad) this.dadSetup(cs); if (this.monsterDef.dsf) this.dsfSetup(cs); if (this.monsterDef.pke) this.pkeSetup(cs); if (this.monsterDef.td) this.tdSetup(cs); if (this.monsterDef.pv) this.pvSetup(cs); if (this.monsterDef.ydd) this.yddSetup(cs); }
    // knights
    this.knights.forEach((k, i) => { k.pos = B.parse(cs.knightStart[i]); B.place({ kind: 'knight', id: k.id }, [k.pos]); });
    // traits additional setup (Panzeronion)
    this.armorTokens = { 1: 0, 2: 0, 3: 0 }; this.jackedTokens = 0;
    const pz = this.monsterDef.traits.find(t => t.id === 'panzeronion'); if (pz && this.monster.hasTrait('Panzeronion') && pz.setup) { for (const l of [1, 2, 3]) this.armorTokens[l] = pz.setup.armorTokens['bp' + l] + (this.monster.level >= 2 ? pz.setup.level2plus : 0); this.say(`Panzeronion: Armor 토큰 BP1 ${this.armorTokens[1]} / BP2 ${this.armorTokens[2]} / BP3 ${this.armorTokens[3]}`); }
    if (!this.monster.isMob) for (let i = 0; i < this.monster.bonuses.escalations; i++) this.monster.escalateX(1);
    // priority target: highest passion (all 0 → first knight)
    this.priorityTarget = this.knights[0]; this._askPriority = true;
    this.say(`Clash 시작: ${this.monster.name} Lv${this.monster.level} (To Hit ${this.monster.toHit}+, Wounds ${this.monster.woundsToKill}) vs ${this.knights.map(k => k.name).join(', ')}`);
    return this;
  }

  // ---------- helpers ----------
  alive() { return this.knights.filter(k => k.alive && !k.possessed); }
  knightAt(cell) { return this.knights.find(k => k.alive && !k.engulfed && !k.possessed && !k.onVP && cellEq(k.pos, cell)); }
  distKM(k) { if (this.monster.isMob) return this.mobDist(this.monster.cur, k.pos); return this.board.distance([k.pos], this.monster.cells, c => !this.board.isObstacle(c)); }
  /** Is the Knight within the active weapon's range of its Attack target (Reach / Ranged / Unwieldy)? */
  inAttackRange(k, A) { if (k.engulfed) return true; const cells = A.guardian ? A.guardian.cells : A.mob ? A.mob.cells : this.monster.cells; return this.fx.inWeaponRange(k, A.weapon, cells); }
  /** Everything the Knight can attack with weapon `w` right now: Mobs (Mob Clash) or 'boss' / Guardians (Boss Clash). */
  attackTargets(k, w) { const out = []; if (this.monster.isMob) { const adj = this.adjacentMobs(k), att = this.attackableMobs(k); const locked = att.length < adj.length; for (const m of [...this.monster.mobs, ...(this.troll ? [this.troll] : [])]) if (m.cells.length && this.fx.inWeaponRange(k, w, m.cells) && (!locked || att.includes(m))) out.push(m); return out; } if (this.fx.inWeaponRange(k, w, this.monster.cells) && (k.engulfed || this.board.hasLoS([k.pos], this.monster.cells))) out.push('boss'); for (const g of this.guardians || []) if (!k.engulfed && this.fx.inWeaponRange(k, w, g.cells)) out.push(g); return out; }
  /** Knockback / Knockdown printed on a melee Attack or a BP Response needs the Knight to be adjacent to its source (e.g. it does not apply after a Reflex move away). */
  kbAdjacent(t, ctx = {}) { const g = (ctx.attack && ctx.attack.guardian) || this.actingGuardian; if (g && g.cells && g.cells.length && !t.onVP && !g.isField) return this.board.footprintsAdjacent([t.pos], g.cells); return this.adjacentToMonster(t); }
  kbNeedsAdjacent(ctx = {}) { if (ctx.attacker) return true; const c = ctx.attack && ctx.attack.card; if (!c || !c.ops) return false; const o = c.ops; return c.type !== 'zone' && !o.range && !o.zoneAroundTarget && !o.zoneAroundSelf && !o.zoneDiagram && !o.zoneFn && !o.command && !o.pathAttack; }
  kbSkip(t, ctx, what = 'Knockback') { if (!t || !t.alive || !this.kbNeedsAdjacent(ctx) || this.kbAdjacent(t, ctx)) return false; this.say(`${t.name}: ${what} 무시 — ${ctx.attacker ? 'BP Response' : '근접 공격'}의 ${what}은 인접해 있어야 적용 (비인접)`, 'tech'); return true; }
  /** A guardian (Firstmen Warrior etc.) whose space the boss moved onto is Displaced to the closest empty space. */
  async guardiansUnder() { const B = this.board, M = this.monster; if (this.isFen || M.isMob || this.actingGuardian) return; for (const g of [...(this.guardians || [])]) { if (g.isRemnant || !g.cells || !g.cells.some(c => M.cells.some(m => cellEq(m, c)))) continue; const free = []; for (let c = 1; c <= B.cols; c++) for (let r = 0; r < B.rows; r++) { const x = { c, r }; if (!B.isObstacle(x) && !this.knightAt(x) && !this.monsterOccupies(x) && !this.guardianAt(x) && !M.cells.some(m => cellEq(m, x))) free.push(x); } if (!free.length) continue; const from = g.cells[0]; const dd = x => Math.max(Math.abs(x.c - from.c), Math.abs(x.r - from.r)) * 100 + Math.abs(x.c - from.c) + Math.abs(x.r - from.r); const best = Math.min(...free.map(dd)); const pool = free.filter(x => dd(x) === best); const c = pool.length === 1 ? pool[0] : await this.ask({ type: 'move', text: `${this.guardianName(g)}: ${M.name}이(가) 그 칸으로 이동 — Displace할 칸`, cells: pool, options: pool.map(c => ({ label: B.label(c), value: c })) }) || pool[0]; g.cells = [c]; B.place({ kind: 'monster', id: M.id }, M.cells); B.place({ kind: 'mob', n: 'G' + g.n }, [c]); this.say(`${this.guardianName(g)}: ${M.name} 아래 → ${B.label(c)}(으)로 Displace`, 'ai'); } }
  adjacentToMonster(k) { if (k.onVP) return true; if (k.engulfed) return !this.actingGuardian; return this.board.footprintsAdjacent([k.pos], this.monster.cells); }
  inBlindspot(k) { if (!(this.monsterDef.basicAbilities || []).some(b => /blindspot/i.test(b.name)) && !(this.monster.cur && this.monster.cur.isTroll)) return false; return rearCells(this.board, this.monster.cells, this.monster.facing).some(c => cellEq(c, k.pos)); }
  inSight(k) { return !k.onVP && !this.inBlindspot(k) && this.losTo(k); }
  knockedDown(k) { return k.conditions.some(c => /^Knockdown/.test(c.id)); }
  hasCondition(k, id) { return k.conditions.find(c => c.id === id); }
  monsterCenter() { const cs = this.monster.cells; return { c: sum(cs.map(x => x.c)) / cs.length, r: sum(cs.map(x => x.r)) / cs.length }; }
  frontCells() { const d = DIRS[this.monster.facing]; return this.monster.cells.map(x => ({ c: x.c + d.c, r: x.r + d.r })).filter(x => this.board.inside(x) && !this.monster.cells.some(m => cellEq(m, x))); }
  poolCount(token) { return this.pool.filter(t => t.token === token).length; }
  poolTake(token, n = 1) { let k = 0; this.pool = this.pool.filter(t => { if (t.token === token && k < n) { k++; return false; } return true; }); return k; }
  poolAdd(token, n = 1, extra = {}) { for (let i = 0; i < n; i++) this.pool.push({ token, ...extra }); this.say(`Knight Pool +${n} ${token}`, 'pool'); if (token === 'break' && n > 0 && !extra.resource) { const a = this._atkK || this._pzTurn; if (a && a.alive && this.fx && this.fx.gearHas(a, 'breakToHope')) (this._trophyQ = this._trophyQ || []).push({ k: a, n }); } }
  /** Trophy Armor: "When you are about to place Break tokens in the Knight Pool, you may place Hope tokens instead." Asked at the first prompt after the placement, for exactly the tokens just placed. */
  get ask() { return this._askW; }
  set ask(f) { this._askRaw = f; this._askW = async q => { await this.trophyFlush(); return f(q); }; }
  async trophyFlush() { if (!this._trophyQ || !this._trophyQ.length || this._trophyBusy) return; this._trophyBusy = true; try { while (this._trophyQ.length) { const { k, n } = this._trophyQ.shift(); const have = Math.min(n, this.poolCount('break')); if (!have || !k.alive) continue; const v = await this._askRaw({ type: 'pick', knight: k.id, text: `${k.name}: Trophy Armor — 놓는 Break ${have}개 중 Hope로 대신 놓을 개수`, options: Array.from({ length: have + 1 }, (_, i) => ({ label: `${i}`, value: i })) }); if (v > 0) { this.poolTake('break', v); for (let i = 0; i < v; i++) this.pool.push({ token: 'hope' }); this.say(`${k.name}: Trophy Armor — Break ${v} → Hope ${v}`, 'tech'); } } } finally { this._trophyBusy = false; } }
  async choose(type, options, extra = {}) {
    if (options.length === 1 && !extra.allowNone) return options[0].value;
    const v = await this.ask({ type, options, ...extra }); return v;
  }
  async askCount(text, max, def = max) { if (max <= 0) return 0; const v = await this.ask({ type: 'number', text, default: def, options: Array.from({ length: max + 1 }, (_, i) => ({ label: String(i), value: i })) }); return typeof v === 'number' ? v : def; }
  async yesNo(text, def = true) { return !!(await this.ask({ type: 'confirm', text, default: def, options: [{ label: '예', value: true }, { label: '아니오', value: false }] })); }

  // ---------- run ----------
  async run() {
    try {
      if (!this._deployed) { this._deployed = true; await this.fx.deployAll(); }
      await this.fenStart(); await this.keStart(); await this.pkeStart();
      if (this._askPriority) { this._askPriority = false; const mx = Math.max(...this.knights.map(k => k.passion)); const top = this.knights.filter(k => k.passion === mx); const id = top.length === 1 ? top[0].id : await this.ask({ type: 'pickKnight', text: 'Passion 동률 — 시작 Priority Target 선택', options: top.map(k => ({ label: k.name, value: k.id })) }); this.priorityTarget = top.find(k => k.id === id) || top[0]; this.say(`Priority Target: ${this.priorityTarget.name}`); }
      while (!this.result) { this.round++; await this.monsterRound(); if (this.result) break; await this.knightRound(); this.firstRound = false; this.renRoundEnd(); this.karaRoundEnd(); }
    } catch (e) { if (e instanceof GameOver) this.result = e.result; else throw e; }
    if (this.isPz) this.pzEndOfClash();
    this.say(`Clash 종료: ${this.result === 'win' ? '승리' : '패배'}`, 'end');
    return this.result;
  }
  /** Runs one engine step; a Chain Break that escapes it (e.g. a death → Incarnation outside an attack) ends only that step instead of the whole Clash loop. */
  async guard(fn) { try { return await fn(); } catch (e) { if (!e || !e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); this.currentAttack = null; this.currentKnightAttack = null; } }
  checkEnd() {
    if (this.monster.slain) { this.result = 'win'; throw new GameOver('win'); }
    if (!this.alive().length) { this.result = 'lose'; throw new GameOver('lose'); }
  }

  // ---------- Monster Round ----------
  async monsterRound() {
    this.phase = 'monster'; this.say(`— 라운드 ${this.round}: Monster Round —`, 'phase'); if (this.monster.isMob) return this.mobMonsterRound(); this.monster.readyActivations(); await this.guard(async () => { await this.trollStartMR(); await this.trollAfterAction(); }); this.checkEnd();
    for (const act of this.monster.activations) { if (!act.ready) continue; act.ready = false; await this.guard(async () => { if (act.type === 'AI') await this.activationAI(); else await this.performSignature(); }); await this.guard(() => this.afterAction()); this.checkEnd(); }
    await this.guard(() => this.trollEndMR()); this.checkEnd();
  }
  async activationAI() {
    for (const k of this.alive()) { const t = k.hand.find(t => t.timing === 'onAIDraw' && t.ops && this.fx.canPay(k, this.fx.costOf(k, t))); if (t && await this.yesNo(`${k.name}: ${t.name} 사용? (${this.fx.costLabel(k, t)}) — 몬스터가 AI를 뽑는 대신 Signature 수행`, false)) { const pc = await this.fx.chooseCost(k, t); if (!pc) continue; this.fx.pay(k, pc.alt, pc.x); this.say(`${k.name} 기술 사용: ${t.name} — AI 대신 Signature`, 'tech'); this.fx.deplete(k, t); await this.renTechniqueUsed(k); await this.performSignature(); return; } }
    let card = this.monster.drawAI(); if (!card) { this.say('AI 덱 없음'); return; }
    for (const k of this.alive()) { const g = k.gear.find(g => !g.discarded && !g.exhausted && this.fx.kwList(g).some(o => o.op === 'aiRedraw' && k.heat + o.heat <= k.heatLimit)); if (!g) continue; const o = this.fx.kwList(g).find(o => o.op === 'aiRedraw'); if (await this.yesNo(`${k.name}: ${g.name} (Monarch) — AI "${card.name}"을 버리고 ${this.fx.perilGateOk(k, 'GRAVE') && /\[GRAVE\] When using the Monarch/.test(g.text || '') ? '대신 Signature 수행' : '다시 뽑기'} (Heat +${o.heat}, Exhaust)?`, false)) { k.gainHeat(o.heat, { voluntary: true }); g.exhausted = true; if (this.monster.ai && this.monster.ai.discard && !this.monster.ai.discard.includes(card)) this.monster.ai.discard.push(card); if (this.fx.perilGateOk(k, 'GRAVE') && /\[GRAVE\] When using the Monarch ability, trigger Signature instead/.test(g.text || '')) { this.say(`${g.name} [GRAVE]: AI ${card.name} 버림 → 대신 Signature`, 'tech'); await this.performSignature(); return; } this.say(`${g.name}: AI ${card.name} 버림 → 다시 뽑음`, 'tech'); const c2 = this.monster.drawAI(); if (c2) card = c2; break; } }
    this.say(`AI ${card.level}: ${card.name}`, 'ai'); this.lastAI = card; this.flash('card', { title: `AI ${card.level}`, name: card.name, text: (card.targeting || []).join(' / '), cls: 'ai', card });
    this.lastChainBreak = false; await this.resolveMonsterAttack(card, { isAI: true });
    this.monster.discardAI(card); await this.fenDoppelgangers(card);
  }
  async performSignature(opt = {}) { if (this.flags && this.flags.fenIgnoreSignature) { this.flags.fenIgnoreSignature = false; this.say('Signature 무시 (Decaying Brain Collection Critical)'); return; } const s = this.monster.signature; this.say(`Signature: ${s.name}`, 'ai'); this.lastAI = s; this.flash('card', { title: 'Signature', name: s.name, cls: 'ai', card: s }); this.lastChainBreak = false; await this.resolveMonsterAttack(s, { isSignature: true, forceTarget: opt.forceTarget }); if (!this.monster.isMob) await this.fenDoppelgangers(s); }
  async performRoutine() { const r = this.monster.routine; this.say(`Routine: ${r.name}`, 'ai'); await this.fx.runMonsterOps(r.ops, { targets: this.alive(), routine: true }); }

  /** Targeting (p.48): read lines top to bottom; first resolvable wins. Returns { targets:[Knight], zone?:[cells], line } or null. */
  async resolveTargeting(card, opts = {}) {
    const all0 = this.alive().filter(k => !k.engulfed); const shadow = k => [...(k.delay || []), ...(k.cooldown || [])].some(t => t.name === 'Shadows Between Worlds'); const alive = all0.some(k => !shadow(k)) ? all0.filter(k => !shadow(k)) : all0; const B = this.board; const ops0 = card.ops;
    const furthest = arr => { if (!arr.length) return []; const ds = arr.map(k => this.distKM(k)).map(d => d === Infinity ? -1 : d); const m = Math.max(...ds); return arr.filter((k, i) => ds[i] === m && m >= 0); };
    const closest = arr => { if (!arr.length) return []; const ds = arr.map(k => this.distKM(k)); const m = Math.min(...ds); return arr.filter((k, i) => ds[i] === m && m < Infinity); };
    for (const line of card.ops.targeting) {
      const L = line.toLowerCase();
      if (this.isDragon && !/^no target/.test(L)) { const pre = await this.dgTargetsPre(L, alive, card, { closest, furthest, inFront: k => inFront(B, this.monster.cells, this.monster.facing, k.pos) && this.losTo(k) }); if (pre) { if (pre.skip) continue; return { ...pre, line }; } }
      if (card.ops.zoneAroundTile && L.startsWith('zone')) { const zt = card.ops.zoneAroundTile; let z = zt.z; if (zt.gate && this.mobBlood() >= zt.gate.gte) { z = zt.gate.z; this.say(`Blood ${this.mobBlood()} ≥ ${zt.gate.gte} → Zone ${z}`); } const cells = []; for (const c of this.tileCells(zt.tile)) for (const x of B.zone([c], z)) if (!cells.some(y => cellEq(y, x))) cells.push(x); return { zone: cells, targets: alive.filter(k => cells.some(c => cellEq(c, k.pos))), line, zoneX: z }; }
      if (/^no target: perform signature/.test(L)) return { signatureInstead: true, targets: [], line };
      if (/^knights in zone (\d)/.test(L)) { const x = +L.match(/zone (\d)/)[1]; const ts = this.wnZoneTargets(x); if (!ts.length) continue; return { zone: null, targets: ts, line, wnZone: x }; }
      if (L === 'carrion zone' && this.isBw) { const ts = this.bwCarrionTargets(); return { zone: [], targets: ts, line }; }
      if (L.startsWith('all knights') || L === 'clash board') return { zone: null, targets: alive, all: true, line };
      if (card.ops.zoneDiagram && L === 'zone') return { zone: null, targets: [], line, diagram: true };
      if (card.ops.zoneAroundTile && card.ops.zoneAroundTile.tile === '*' && L.startsWith('zone')) { const z = card.ops.zoneAroundTile.z + (this.monster.hasTrait('No Mercy') ? 1 : 0); const cells = []; for (const [key] of B.terrain) { const [c, r] = key.split(',').map(Number); for (const x of B.zone([{ c, r }], z)) if (!cells.some(y => cellEq(y, x))) cells.push(x); } return { zone: cells, targets: alive.filter(k => cells.some(c => cellEq(c, k.pos))), line, zoneX: z }; }
      if (L.includes('blood')) { // Paleblood Worms: Knights by Blood tokens
        let pool = alive; if (L.includes('in front')) pool = pool.filter(k => inFront(B, this.monster.cells, this.monster.facing, k.pos) && this.losTo(k));
        if (pool.length) { const v = pool.map(k => k.blood || 0); const want = L.includes('least') ? Math.min(...v) : Math.max(...v); pool = pool.filter(k => (k.blood || 0) === want); if (L.startsWith('closest')) pool = closest(pool); }
        if (!pool.length) continue; let t = pool[0]; if (pool.length > 1) { if (pool.includes(this.priorityTarget)) t = this.priorityTarget; else { const id = await this.ask({ type: 'pickKnight', text: `Targeting 동률 (${line}) — 대상 선택`, options: pool.map(k => ({ label: `${k.name} (Blood ${k.blood})`, value: k.id })) }); t = pool.find(k => k.id === id) || pool[0]; } }
        return { targets: [t], primary: t, line };
      }
      if (L.startsWith('zone ')) { const x = +L.match(/\d/)[0]; const cells = B.zone(this.monster.cells, x); return { zone: cells, targets: alive.filter(k => cells.some(c => cellEq(c, k.pos))), line, zoneX: x }; }
      let cand = alive; const behind = /and 1 space behind target/.test(L);
      const chasmD = k => Math.min(...this.wnChasm().map(h => Math.abs(h.c - k.pos.c) + Math.abs(h.r - k.pos.r)), 99); const minBy = (arr, f) => { if (!arr.length) return []; const m = Math.min(...arr.map(f)); return arr.filter(k => f(k) === m); };
      const ext = (this.isKl ? this.klTargets(L, alive, closest) : undefined) ?? (this.isDsf ? this.dsfTargets(L, alive, closest) : undefined) ?? (this.isPke ? this.pkeTargets(L) : undefined); if (ext && ext.result) { if (!ext.result.targets.length) continue; this.say(`Targeting: ${line}`); return { ...ext.result, line }; }
      if (Array.isArray(ext)) cand = ext;
      else if (L === 'tactics target') cand = closest(this.tacticsTargetPool(alive).filter(k => !/in range/i.test(this.tactics.ops.target) || (ops0.range ? this.distKM(k) <= ops0.range : (this.monster.cur && this.monster.cur.decoying) || this.distKM(k) <= 1)));
      else if (L.includes('poisoned condition')) cand = closest(alive.filter(k => this.hasCondition(k, 'Poisoned') && (!ops0.range || this.distKM(k) <= ops0.range)));
      else if (L.includes('engaged knight in range') && ops0.range) cand = closest(alive.filter(k => this.engaged(k) && this.distKM(k) <= ops0.range));
      else if (L.includes('in range') && ops0.range) { const pool = alive.filter(k => this.distKM(k) <= ops0.range && (L.includes('in front') ? inFront(B, this.monster.cells, this.monster.facing, k.pos) && this.losTo(k) : this.inSight(k))); cand = L.startsWith('furthest') ? furthest(pool) : closest(pool); }
      else if (L.startsWith('highest [heat]')) cand = minBy(alive, k => -k.heat);
      else if (L.includes('last knight to wound')) cand = alive.filter(k => k === this.priorityLast);
      else if (L.includes('slimed condition')) cand = closest(alive.filter(k => this.hasCondition(k, 'Slimed')));
      else if (L.startsWith('two closest knights')) { const pool = alive.filter(k => L.includes('in front') ? inFront(B, this.monster.cells, this.monster.facing, k.pos) && this.losTo(k) : this.inSight(k)).sort((a, b) => this.distKM(a) - this.distKM(b)); if (!pool.length) continue; const ts = pool.slice(0, 2); return { targets: ts, primary: ts[0], line }; }
      else if (L.includes('lowest [heat] in sight')) cand = minBy(alive.filter(k => this.inSight(k)), k => k.heat);
      else if (L.includes('highest [vigor] in sight')) cand = minBy(alive.filter(k => this.inSight(k)), k => -k.vigor);
      else if (L.includes('lowest [vigor]')) cand = minBy(alive.filter(k => !L.includes('in front') || inFront(B, this.monster.cells, this.monster.facing, k.pos)), k => k.vigor);
      else if (L.includes('highest [vigor]')) cand = minBy(alive.filter(k => !L.includes('in front') || inFront(B, this.monster.cells, this.monster.facing, k.pos)), k => -k.vigor);
      else if (L.includes('without a hex card')) cand = alive.filter(k => !(k.hexes || []).length);
      else if (L.includes('with a hex card')) cand = alive.filter(k => (k.hexes || []).length);
      else if (L.includes('poisoned or toxified')) cand = alive.filter(k => this.hasCondition(k, 'Poisoned') || this.hasCondition(k, 'Toxified'));
      else if (L.startsWith('lowest [heat]') && !L.includes('in sight')) cand = minBy(alive, k => k.heat);
      else if (L.includes('two-handed weapon')) cand = closest(alive.filter(k => k.gear.some(g => g.type === 'weapon' && !g.discarded && g.hands === 2)));
      else if (L.includes('peril threshold')) { const R = { Uninjured: 0, Minor: 1, Major: 2, Grave: 3, Judicium: 4 }; const pv = k => R[k.peril()] ?? 0; cand = minBy(alive, k => L.includes('lowest') ? pv(k) : -pv(k)); }
      else if (L.includes('closest squire')) cand = [];
      else if (L.includes('fleischritter')) cand = closest(alive.filter(k => k.def && k.def.id === 'fleischritter'));
      else if (L.includes('highest [passion]')) cand = minBy(alive, k => -k.passion);
      else if (L.includes('lowest [passion]')) cand = minBy(alive, k => k.passion);
      else if (L.includes('closest to a chasm')) cand = minBy(alive.filter(k => this.inSight(k)), chasmD);
      else if (L.includes('closest knight not in front')) cand = closest(alive.filter(k => !inFront(B, this.monster.cells, this.monster.facing, k.pos) && (!L.includes('in sight') || this.inSight(k))));
      else if (L.includes('priority target')) cand = alive.filter(k => k === this.priorityTarget && (!L.includes('in sight') || this.inSight(k)));
      else if (L.includes('closest knocked down knight')) cand = closest(alive.filter(k => this.knockedDown(k)));
      else if (L.includes('closest lone knight')) cand = closest(alive.filter(k => this.isLone(k)));
      else if (L.includes('knight in rear')) { const bf = { N: 'S', S: 'N', E: 'W', W: 'E' }[this.monster.facing]; const dd = DIRS[bf]; const rear = this.monster.cells.map(x => ({ c: x.c + dd.c, r: x.r + dd.r })).filter(x => !this.monster.cells.some(m => cellEq(m, x))); cand = closest(alive.filter(k => rear.some(c => cellEq(c, k.pos)))); }
      else if (L.includes('knight in blindspot')) cand = alive.filter(k => this.inBlindspot(k));
      else if (L.includes('closest engaged knight in sight')) cand = closest(alive.filter(k => this.engaged(k) && this.inSight(k)));
      else if (L.includes('closest engaged knight')) cand = closest(alive.filter(k => this.engaged(k)));
      else if (L.includes('closest non-engaged knight')) cand = closest(alive.filter(k => !this.engaged(k)));
      else if (L.includes('furthest knight in front')) cand = furthest(alive.filter(k => inFront(B, this.monster.cells, this.monster.facing, k.pos) && this.losTo(k)));
      else if (L.includes('furthest knight in sight')) cand = furthest(alive.filter(k => this.inSight(k)));
      else if (L.includes('furthest knight')) cand = furthest(alive);
      else if (L.includes('closest grouped knight')) cand = closest(alive.filter(k => alive.some(o => o !== k && B.adjacent(o.pos, k.pos))));
      else if (L.includes('closest knight with a condition')) cand = closest(alive.filter(k => (k.conditions || []).length));
      else if (L.includes('closest knight in front')) cand = closest(alive.filter(k => inFront(B, this.monster.cells, this.monster.facing, k.pos) && this.losTo(k)));
      else if (L.includes('closest knight in sight')) cand = closest(alive.filter(k => this.inSight(k)));
      else if (L.includes('closest knight')) cand = closest(alive);
      else if (L.includes('knight not in front')) cand = closest(alive.filter(k => !inFront(B, this.monster.cells, this.monster.facing, k.pos)));
      else if (L.includes('knight in front')) cand = closest(alive.filter(k => inFront(B, this.monster.cells, this.monster.facing, k.pos) && this.losTo(k)));
      else if (L.includes('knight in sight')) cand = closest(alive.filter(k => this.inSight(k)));
      else { this.say(`[미구현 targeting] ${line}`, 'warn'); continue; }
      if (!cand.length) continue;
      if (cand.length > 1 && this.isKe && this.ke.berserk && card.type !== 'zone') { const c0 = this.monsterCenter(); const dd = k => Math.abs(k.pos.c - c0.c) + Math.abs(k.pos.r - c0.r); const seq = [...cand].sort((a, b) => dd(a) - dd(b)); this.say(`Frenzied Hunger: Targeting 동률 → Sequential (${seq.map(k => k.name).join(' → ')})`, 'bp'); return { targets: seq, primary: seq[0], line, keSeq: true }; }
      let t = cand[0]; if (cand.length > 1) { if (cand.includes(this.priorityTarget)) t = this.priorityTarget; else { const id = await this.ask({ type: 'pickKnight', text: `Targeting 동률 (${line}) — 대상 선택`, options: cand.map(k => ({ label: `${k.name} (${this.board.label(k.pos)})`, value: k.id })) }); t = cand.find(k => k.id === id) || cand[0]; } }
      if (card.ops.zoneJudge) { const z = card.ops.zoneJudge.z + (this.monster.hasTrait('No Mercy') ? 1 : 0); const cells = B.zone([t.pos], z); const ts = [t, ...alive.filter(k => k !== t && cells.some(c => cellEq(c, k.pos)))]; return { zone: null, targets: ts, primary: null, line, zoneJudge: t, zoneX: z }; }
      { const dk = cand.filter(x => x !== t); for (const x of dk) { if (await this.fx.gearUse(x, ['becomeOnlyTarget'], `${card.name}의 대상 후보 — 유일한 대상이 되기? (현재 대상 ${t.name})`)) { this.say(`${x.name}: 유일한 대상이 됨 (Gear)`, 'tech'); t = x; break; } } if (card !== this.monster.signature) for (const x of alive) { if (x === t) continue; if (await this.fx.gearUse(x, ['becomeTarget'], `${card.name} — 대상이 되기? (현재 대상 ${t.name})`)) { this.say(`${x.name}: 이 AI의 대상이 됨 (Gear)`, 'tech'); t = x; break; } } }
      return { targets: [t], primary: t, line, behind };
    }
    return null;
  }

  /** Monster Attack (p.47–54): targeting → movement → evasion per target → consequences → after attack. */
  async resolveMonsterAttack(card, ctx = {}) {
    this._slowSteps = null; this._stopMove = false;
    const ops = card.ops; if (ops.preReact && ops.pre) { this.say('REACT! (Targeting 앞)'); await this.windowOfOpportunity('react', null, null, 'pre'); }
    if (ops.pre) await this.fx.runMonsterOps(ops.pre, {});
    let tg = ctx.forceTarget && ctx.forceTarget.alive ? { targets: [ctx.forceTarget], primary: ctx.forceTarget, line: 'Signature 대상 지정' } : await this.resolveTargeting(card);
    if (tg && tg.signatureInstead) { this.say('No Target → Signature'); return this.performSignature(); }
    if (!tg) { this.say(`유효 대상 없음 → Routine`); await this.performRoutine(); return; }
    this.say(`Targeting: ${tg.line}${tg.primary ? ' → ' + tg.primary.name : ''}`);
    const attack = { card, ctx, targets: tg.targets, primary: tg.primary, zone: tg.zone, vigorLost: false, vigorLostTotal: 0, hits: {}, firstHits: {}, mob: this.monster.isMob ? this.monster.cur : null, judge: ops.judge || null };
    const bloodGate = op => (ops.gates || []).find(g => g.op === op && g.stat === 'blood' && this.mobBlood() >= g.gte); if (bloodGate('ignoreReact')) { attack.noReact = true; this.say(`Blood ${this.mobBlood()} → 이 공격은 REACT! 무시`); }
    { const hg = (ops.gates || []).find(g => g.op === 'ignoreReact' && g.stat === 'heat'); if (hg && tg.primary && tg.primary.heat >= hg.gte) { attack.noReact = hg.which || true; this.say(`Heat ${tg.primary.heat} ≥ ${hg.gte} → ${hg.which === 'targeting' ? 'Targeting 뒤 REACT! 무시' : hg.which === 'after' ? 'After Attack 앞 REACT! 무시' : '이 공격은 REACT! 무시'}`); } } if (!this.actingGuardian) this.lastAttackPrimary = tg.primary || tg.targets[0] || this.lastAttackPrimary;
    this.currentAttack = attack;
    try {
      // before-attack keywords (Choke etc. apply to targets at resolution; Choke is on the attack line → applied with effects)
      // movement
      if (ops.beforeAttack) await this.fx.runMonsterOps(ops.beforeAttack, { attack, targets: tg.targets, primary: tg.primary });
      if (this.isPump && tg.primary && this.monster.cur && this.monster.cur.isPump) { const m = this.monster.cur; if (m.side === 'pumpkin') { if (ops.pull) await this.pull(m, tg.primary, ops.pull); if (ops.move) await this.pumpMoveToward(m, tg.primary.pos, { range: ops.range || 1 }); if (m.burning) throw new ChainBreak('Pumpkinhead가 Campfire 위로 이동'); } if (!this.alive().includes(tg.primary)) throw new ChainBreak('target died during movement'); this.turnToward(tg.primary.pos); }
      else if (this.isWN && tg.wnZone) { this.say(`Zone ${tg.wnZone} (이동 전 위치 기준): ${tg.targets.map(t => t.name).join(', ')}`); }
      else if (this.isWN && tg.primary) { if (ops.flank) await this.wnFlank(tg.primary); else if (ops.move) await this.wnMoveToward(tg.primary); else this.turnToward(tg.primary.pos); if (!this.alive().includes(tg.primary)) throw new ChainBreak('target died during movement'); }
      else if (tg.primary && this.actingGuardian) { this.turnToward(tg.primary.pos); if (ops.move) await (this.actingGuardian.isDopp ? this.doppMoveToward(tg.primary.pos, ops.range) : this.guardianMoveToward(tg.primary.pos)); this.turnToward(tg.primary.pos); }
      else if (this.isFen && ops.moveRange && tg.primary) await this.fenMoveWithin(tg.primary, ops.range)
      else if (!this.monster.isMob && ops.treeClimb) { await this.bossTreeClimb(); if (tg.primary) this.turnToward(tg.primary.pos); if (this.flags && this.flags.trollNoRange) { this.say('Bulky Biceps: White Ape Troll은 Range Attack 불가 → 공격 없음'); return; } }
      else if (!this.monster.isMob && ops.jump && tg.primary) await this.bossJump(tg.primary);
      else if (!this.monster.isMob && ops.landOnTop && tg.primary) await this.bossLandOnTop(tg.primary);
      else if (!this.monster.isMob && ops.pathAttack && tg.primary) { const before = new Set(this.alive().filter(k => k !== tg.primary).map(k => k.id + '@' + k.vigor)); const crashed = []; const _crash = this.crash.bind(this); this.crash = async k => { if (!crashed.includes(k)) crashed.push(k); return _crash(k); }; try { this.turnToward(tg.primary.pos); await this.monsterMoveToward(tg.primary); } finally { this.crash = _crash; } tg.targets = [...crashed.filter(k => k !== tg.primary && k.alive), tg.primary]; if (ops.thenZone) { const zc = this.board.zone(this.monster.cells, ops.thenZone); for (const k of this.alive()) if (!k.engulfed && zc.some(c => cellEq(c, k.pos)) && !tg.targets.includes(k)) tg.targets.push(k); } attack.targets = tg.targets; this.say(`경로 공격: ${tg.targets.map(k => k.name).join(', ')}`); }
      else if (tg.primary && ops.keAppear && this.isKe) await this.keAppearBehind(tg.primary);
      else if (tg.primary && !tg.zone && ops.appearBehind && this.monster.isMob) await this.appearBehind(this.monster.cur, tg.primary);
      else if (tg.primary && ops.range) { this.turnToward(tg.primary.pos); this.say(`Range Attack (${ops.range === 'unlimited' ? '무제한' : ops.range})`); }
      else if (tg.primary && ops.landOnTop && this.monster.isMob) { const m = this.monster.cur, k0 = tg.primary, B = this.board; const to = k0.pos; this.mobStepTo(m, to); this.turnToward(to); const fr = DIRS[m.facing]; let dest = { c: to.c + fr.c, r: to.r + fr.r }; this.say(`Land on Top: Mob #${m.n} → ${B.label(to)}`, 'ai'); if (!B.inside(dest) || B.isObstacle(dest) || this.knightAt(dest) || this.monsterOccupies(dest)) { this.moveKnight(k0, dest = to); await this.displace(k0); } else { this.moveKnight(k0, dest); this.say(`${k0.name} 앞 칸으로 Displace → ${B.label(dest)}`); } }
      else if (tg.primary && !tg.zone && this.monster.isMob && this.monster.cur && this.monster.cur.isTroll) { this.turnToward(tg.primary.pos); if (ops.move) { await this.monsterMoveToward(tg.primary); for (const c of this.monster.cur.cells) { const o = this.monster.mobs.find(m => m.cells.length && cellEq(m.cells[0], c)); if (o) await this.displaceMob(o, c); } this.board.place({ kind: 'mob', n: 'W' }, this.monster.cur.cells); } }
      else if (tg.primary && !tg.zone) { this.turnToward(tg.primary.pos); if (ops.move) { if (this.monster.isMob && this.bypassMobs) await this.bypassMoveToward(this.monster.cur, tg.primary.pos); else if (this.monster.isMob) await this.mobMoveToward(this.monster.cur, tg.primary.pos); else await this.monsterMoveToward(tg.primary); } if (ops.moveGangup && this.monster.isMob) await this.gangup(this.monster.cur, tg.primary, ops.moveGangup); if (this.monster.isMob) for (const g of ops.gates.filter(g => g.op === 'moveGangup' && tg.primary.heat >= g.gte)) await this.gangup(this.monster.cur, tg.primary, g.n); if (ops.moveOps) await this.fx.runMonsterOps(ops.moveOps, { attack, target: tg.primary, primary: tg.primary }); if (!this.alive().includes(tg.primary)) throw new ChainBreak('target died during movement'); }
      // windows of opportunity: REACT! before attack
      if (this.cardHasTargetingReact(card)) await this.windowOfOpportunity('beforeAttack', attack, null, 'targeting'); else this.say('(이 카드는 Targeting 뒤 REACT! 창 없음)');
      // zone targets recomputed after movement
      let targets = attack.targets;
      let stepTo = null;
      if (ops.zoneFn && this[ops.zoneFn]) { targets = await this[ops.zoneFn](ops, tg, attack); this.say(`Zone: ${targets.map(t => t.name).join(', ') || '대상 없음'}`); }
      else if (this.isPke && (ops.command || ops.pkeZone)) { targets = this.pkeZoneTargets(ops); this.say(`${ops.command ? 'Wave Command' : 'Zone'}: ${targets.map(t => t.name).join(', ') || '대상 없음'}`); }
      else if (card.type === 'zone' && ops.zoneDiagram && this.monster.isMob) { if (tg.primary) this.turnToward(tg.primary.pos); const zc = this.diagramCells(ops.zoneDiagram); targets = this.alive().filter(k => zc.cells.some(c => cellEq(c, k.pos))); attack.zoneCells = zc.cells; stepTo = zc.step; this.say(`Zone (카드 도식${this.monster.hasTrait('No Mercy') ? '+노란 칸' : ''}): ${targets.map(t => t.name).join(', ') || '대상 없음'}`); }
      else if (card.type === 'zone' && ops.zoneDiagram && ops.zoneDiagram.block && !this.monster.isMob) { if (ops.smLateral && this.isSm && tg.primary) await this.smLateral(card, tg.primary); if (tg.primary) this.turnToward(tg.primary.pos); const cells = this.bossDiagramCells(ops.zoneDiagram); targets = this.alive().filter(k => cells.some(c => cellEq(c, k.pos))); attack.zoneCells = cells; this.say(`Zone (카드 도식): ${targets.map(t => t.name).join(', ') || '대상 없음'}`); }
      else if (card.type === 'zone' && !tg.zone && ops.zoneAroundSelf) { if (ops.prePushback && tg.primary && this.alive().includes(tg.primary)) { this.turnToward(tg.primary.pos); this.say(`Pushback ${ops.prePushback} (Zone Attack 전) — Target ${tg.primary.name}`); await this.pushback(tg.primary, ops.prePushback, { isPush: true }); } const cells = this.board.zone(this.monster.cells, ops.zoneAroundSelf); targets = this.alive().filter(k => cells.some(c => cellEq(c, k.pos))); attack.zoneCells = cells; this.say(`Zone ${ops.zoneAroundSelf} (Mob 주위): ${targets.map(t => t.name).join(', ') || '대상 없음'}`); }
      else if (card.type === 'zone' && !tg.zone) { const cells = this.frontCells(); if (tg.behind && tg.primary) { const d = this.dirFromMonster(tg.primary.pos); const b = { c: tg.primary.pos.c + d.c, r: tg.primary.pos.r + d.r }; cells.push(b); }
        targets = uniq([tg.primary, ...this.alive().filter(k => cells.some(c => cellEq(c, k.pos)))].filter(Boolean)); attack.zoneCells = cells; }
      else if (tg.zone) { targets = this.alive().filter(k => tg.zone.some(c => cellEq(c, k.pos))); }
      if (ops.zoneAroundTarget && tg.primary) { const zc = this.board.zone([tg.primary.pos], ops.zoneAroundTarget); targets = uniq([tg.primary, ...this.alive().filter(k => zc.some(c => cellEq(c, k.pos)))]); this.say(`Zone ${ops.zoneAroundTarget} (대상 주위): ${targets.map(t => t.name).join(', ')}`); }
      if (ops.wave && !ops.zoneFn && this.waveBlocked) { const bl = targets.filter(k => this.waveBlocked(k)); if (bl.length) { this.say(`Wave Attack: ${bl.map(k => k.name).join(', ')} — Obstacle 뒤 (대상 아님)`, 'ai'); targets = targets.filter(k => !bl.includes(k)); } }
      attack.targets = targets;
      if (!targets.length) { this.say('Zone 공격: 대상 없음(Zone은 수행된 것으로 간주)'); }
      // out of reach check for melee
      if (tg.primary && ops.prePushback && card.type !== 'zone' && this.alive().includes(tg.primary)) { this.say(`Pushback ${ops.prePushback} (공격 전)`); await this.pushback(tg.primary, ops.prePushback, { isPush: true }); }
      if (tg.primary && card.type !== 'zone' && !ops.judge && !ops.range && !ops.prePushback && !this.adjacentToMonster(tg.primary)) { this.say(`${tg.primary.name} Out of Reach → After Attack만 처리`); attack.targets = []; }
      if (attack.targets.length > 1) { const order = await this.ask({ type: 'order', text: 'Evasion Roll 순서 (여러 대상)', options: attack.targets.map(t => ({ label: t.name, value: t.id })) }); if (Array.isArray(order)) attack.targets = order.map(id => attack.targets.find(t => t.id === id)).filter(Boolean); }
      for (const t of attack.targets) { if (!t.alive) continue; if (tg.keSeq && t !== attack.targets[0] && ops.move && !this.adjacentToMonster(t)) { this.turnToward(t.pos); await this.monsterMoveToward(t); this.turnToward(t.pos); } try { await this.attackOneTarget(attack, t); } catch (e) { if (e.chainBreak && (card.type === 'zone' || attack.targets.length > 1)) { this.say(`Chain Break (${t.name}) — 다른 대상은 계속`); continue; } throw e; } }
      if (stepTo) attack.stepTo = stepTo;
      // Repeat this Attack (Sequential, once) / If you die, repeat this Attack — re-resolved without its After Final Attack
      if (attack.repeatAfter && (ctx.repeats || 0) < (attack.repeatAfter === 'chain' ? 4 : 1)) { this.say(`${card.name} 반복`); this.currentAttack = null; await this.resolveMonsterAttack({ ...card, ops: { ...card.ops, afterAttack: null, afterFinalAttack: null } }, { ...ctx, repeats: (ctx.repeats || 0) + 1 }); this.currentAttack = attack; }
      // after attack
      if (ops.afterAttack) { await this.stoneAfterAttack(); if (this.result) return; this.say('After Attack'); if (!tg.primary && attack.targets.length > 1) { for (const t of attack.targets.filter(x => x.alive)) await this.fx.runMonsterOps(ops.afterAttack, { attack, targets: attack.targets, target: t, primary: t }); } else await this.fx.runMonsterOps(ops.afterAttack, { attack, targets: attack.targets, primary: tg.primary || attack.targets[0] }); }
      await this.firstmenAfterAttack(attack);
      if (attack.stepTo && attack.mob) await this.spectralStep(attack.mob, attack.stepTo);
      let afa = ops.afterFinalAttack; if (!afa && card.type === 'zone' && this.monster.hasTrait('Egged On')) afa = [{ op: 'trait', id: 'humpty-charge' }];
      if (afa && !ops.afterFinalAttack) { this.say('Egged On — REACT!'); this._reactKind = 'after'; await this.windowOfOpportunity('react', attack); } // Egged On grants "REACT! After Final Attack: Humpty Charge" (owner-confirmed icon)
      if (afa) { this.say('After Final Attack'); await this.fx.runMonsterOps(afa, { attack, targets: attack.targets, primary: attack.targets.at(-1) || tg.primary, repeatCard: card }); }
    } catch (e) { if (e.chainBreak) { this.lastChainBreak = true; this.say(`Chain Break: ${e.message}`, 'warn'); } else throw e; }
    finally { this.currentAttack = null; }
  }
  dirName(d) { return d.c > 0 ? '동(→)' : d.c < 0 ? '서(←)' : d.r > 0 ? '북(↑)' : '남(↓)'; }
  dirFromMonster(cell) { const m = this.monsterCenter(); const dc = cell.c - m.c, dr = cell.r - m.r; return Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) }; }
  turnToward(cell) { const f = faceToward(this.monster.cells, cell, this.monster.facing); if (f !== this.monster.facing) { this.monster.facing = f; this.say(`몬스터 회전 → ${f}`); } }
  async faceMostKnights() { const counts = ['N', 'E', 'S', 'W'].map(f => ({ f, n: this.alive().filter(k => inFront(this.board, this.monster.cells, f, k.pos)).length })); const max = Math.max(...counts.map(x => x.n)); const best = counts.filter(x => x.n === max); let f = best[0].f; if (best.length > 1 && max > 0) { f = await this.ask({ type: 'pick', text: '가장 많은 기사를 향함 — 동률, 방향 선택', options: best.map(x => ({ label: this.dirName(DIRS[x.f]), value: x.f })) }); } else if (best.length > 1) f = best.includes(this.monster.facing) ? this.monster.facing : best[0].f; this.monster.facing = f; this.say(`몬스터가 가장 많은 기사 쪽(${f})을 향함`); }

  /** Boss movement toward target until adjacent (p.50): shortest path, moves through Knights (Crash), destroys Destructible terrain. */
  /** Pure preview of the zigzag path (p.50) for a given starting direction: list of footprints, ignoring Crash stops. */
  simulateMonsterPath(target, first) {
    const B = this.board; let cells = this.monster.cells.map(c => ({ ...c })); const out = []; let lastAxis = null; let d = first;
    for (let steps = 0; steps < 30 && !B.footprintsAdjacent(cells, [target.pos]); steps++) {
      const mc = cells.reduce((a, c) => ({ c: a.c + c.c / cells.length, r: a.r + c.r / cells.length }), { c: 0, r: 0 });
      const dc = target.pos.c - mc.c, dr = target.pos.r - mc.r; const opts = []; if (Math.abs(dc) > 0.5) opts.push({ c: Math.sign(dc), r: 0 }); if (Math.abs(dr) > 0.5) opts.push({ c: 0, r: Math.sign(dr) });
      const valid = opts.filter(o => cells.every(x => B.inside({ c: x.c + o.c, r: x.r + o.r }))); if (!valid.length) break;
      if (steps > 0 || !d) { d = (lastAxis ? valid.find(x => (x.c ? 'c' : 'r') !== lastAxis) : null) || valid[0]; }
      lastAxis = d.c ? 'c' : 'r'; cells = cells.map(c => ({ c: c.c + d.c, r: c.r + d.r })); out.push(cells);
    }
    return out;
  }
  async monsterMoveToward(target) { this._moveSeq = (this._moveSeq || 0) + 1;
    const B = this.board; let steps = 0; let lastAxis = null; this._moveCrashed = new Set();
    this._slowSteps = null; this._stopMove = false; const cap = this.slowToken ? 3 : 30; if (this.slowToken) { this.slowToken = false; this.say('임시 Speed 토큰: 이번 이동은 3칸에서 멈춤 (토큰 버림)', 'tech'); }
    while (!this.board.footprintsAdjacent(this.monster.cells, [target.pos]) && steps < cap) {
      const m = this.monsterCenter(); const dc = target.pos.c - m.c, dr = target.pos.r - m.r;
      const opts = []; if (Math.abs(dc) > 0.5) opts.push({ c: Math.sign(dc), r: 0 }); if (Math.abs(dr) > 0.5) opts.push({ c: 0, r: Math.sign(dr) });
      if (!opts.length) break;
      // zigzag (p.50): switch axis after each space; the players choose the starting direction
      const valid = opts.filter(d => this.monster.cells.every(x => B.inside({ c: x.c + d.c, r: x.r + d.r })));
      if (!valid.length) break;
      let d = valid[0];
      if (valid.length > 1) { const alt = lastAxis ? valid.find(x => (x.c ? 'c' : 'r') !== lastAxis) : null; if (alt) d = alt; else { const i = await this.ask({ type: 'pick', preview: 'path', text: '몬스터 이동 시작 방향 (지그재그) — 옵션을 눌러 보드에서 경로 미리보기 후 확정', options: valid.map((x, i) => ({ path: this.simulateMonsterPath(target, x), label: this.dirName(x) + ' — 밟히는 기사 ' + this.monster.cells.map(m => ({ c: m.c + x.c, r: m.r + x.r })).filter(cc => this.knightAt(cc) && !this.monster.cells.some(mc => cellEq(mc, cc))).length + '명', value: i })) }); d = valid[i] || valid[0]; } }
      lastAxis = d.c ? 'c' : 'r';
      await this.monsterStep(d); steps++; if (this._stopMove) break;
    }
    if (steps) this.say(`몬스터 이동 ${steps}칸 → ${this.monster.cells.map(c => B.label(c)).join('/')}`); await this.fenAfterMove(); await this.endMoveOnKnights();
  }
  /** Rulebook p.51: a Knight on a space the Boss ends its (normal) movement on suffers Crash and Unavoidable Knockback X (소유자 확인 2026-11-15).
   *  A Knight already crashed while the Boss moved onto it during this move is not crashed twice. */
  async endMoveOnKnights() { const ab = (this.monsterDef.basicAbilities || []).find(b => b.name === 'Unavoidable Knockback'); const done = this._moveCrashed || new Set(); this._moveCrashed = null; if (this.isFen || !ab || !ab.value || (this.monster.isMob && !(this.monster.cur && this.monster.cur.isTroll))) return;
    for (const k of this.alive()) if (this.monster.cells.some(c => cellEq(c, k.pos))) { this.say(`${k.name}: 몬스터가 이 칸에서 이동 종료 → Crash + Unavoidable Knockback ${ab.value}`); if (!done.has(k)) await this.crash(k); if (k.alive) await this.knockback(k, ab.value, { unavoidable: true }); } }
  /** One step of boss movement; returns false if blocked by board edge. */
  async monsterStep(d, { charge = false } = {}) {
    const B = this.board; const nc = this.monster.cells.map(x => ({ c: x.c + d.c, r: x.r + d.r })); this._monDir = { c: Math.sign(d.c), r: Math.sign(d.r) };
    if (this.slowToken) { this.slowToken = false; this._slowSteps = 3; this.say('임시 Speed 토큰: 이번 이동은 3칸에서 멈춤 (토큰 버림)', 'tech'); } if (this._stopMove) return 'slow'; if (this._slowSteps != null) { if (this._slowSteps <= 0) return 'slow'; this._slowSteps--; }
    if (!nc.every(x => B.inside(x))) return 'edge';
    const newCells = nc.filter(x => !this.monster.cells.some(mc => cellEq(mc, x)));
    for (const x of newCells) { const t = B.terrainAt(x); if (t && t.obstacle) { if (charge && !this.monster.hasTrait('Just a Scratch')) return 'obstacle'; if (t.destructible) { B.terrain.delete(B.key(x)); this.say(`지형 ${t.id} 파괴 (${B.label(x)})`); } else return 'obstacle'; } }
    B.remove(this.monster.cells); this.monster.cells = nc; B.place({ kind: 'monster', id: this.monster.id }, nc);
    for (const x of newCells) { const k = this.knightAt(x); if (k) { try { if (this._moveCrashed) this._moveCrashed.add(k); await this.crash(k, { charge, through: true }); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break 중 돌진 계속 (${e.message})`, 'warn'); } } }
    await this.guardiansUnder();
    if (!this._inMoved) { this._inMoved = true; try { if (await this.fx.monsterMoved(this.monster.cells)) this._stopMove = true; } finally { this._inMoved = false; } }
    return 'ok';
  }
  /** Crash (p.80): -1 Vigor + Knockdown. Charge over knocked-down Knight → Judicium instead (Humpty Charge). */
  async crash(k, opts = {}) { const { charge = false } = opts; if (this.isFen && opts.through && !this.actingGuardian) return this.monster.hasTrait('Inescapable Slime') ? this.fenOoze(k, 'boss') : this.fenPass(k);
    if (charge && this.knockedDown(k) && this.monster.hasTrait('Coup de Grace')) { this.say(`${k.name}: 넘어진 채로 돌진당함 — Coup de Grace: Judicium 대신 사망`, 'death'); await this.die(k, 'Coup de Grace'); return; }
    if (charge && this.knockedDown(k)) { this.say(`${k.name}: 넘어진 채로 돌진당함 → Judicium`); await this.drawJudicium(k); return; }
    if (this.fx.gearHas(k, 'tumble') || this.paraStat(k, 'tumble') > 0 || await this.fx.gearUse(k, ['tumblePaid'], 'Crash — Tumble 사용 (d10 6+로 무시)?') || await this.karaTumble(k)) { const d = await this.d10For(k, 'Tumble'); this.say(`${k.name} Tumble: d10 ${d} → ${d >= 6 ? 'Crash 무시' : '실패'}`, 'dice'); if (d >= 6) return; }
    this.say(`${k.name} Crash`); await this.loseVigor(k, 1, { source: 'crash' }); await this.knockdown(k);
  }
  /** Monster ends movement on a Knight: Crash + Unavoidable Knockback (p.51). */
  async displaceKnightsUnderMonster() { for (const k of this.alive()) if (this.monster.cells.some(c => cellEq(c, k.pos))) { await this.crash(k); if (k.alive) await this.knockback(k, this.monsterDef.basicAbilities.find(b => b.name === 'Unavoidable Knockback').value, { unavoidable: true }); } }

  /** Evasion roll + consequences for one target (pp.52–54). */
  async attackOneTarget(attack, k) {
    const card = attack.card, ops = card.ops; const M = this.monster;
    // gates
    const allG = this.allGatesOn(); const gatesOn = (this.isSm && this.sm.flags.noGates ? [] : ops.gates).filter(g => allG || g.stat === 'always' ? true : g.stat === 'heat' ? (k.heat >= g.gte || !!(g.orLevel && M.level >= g.orLevel)) : g.stat === 'blood' ? this.mobBlood() >= g.gte : g.stat === 'condTokens' ? this.condTokens(k) >= g.gte : g.stat === 'tier' ? (this.nodeLevel || 1) >= g.gte : g.stat === 'vigor' ? k.vigor >= g.gte : g.stat === 'passion' ? k.passion >= g.gte : g.stat === 'knockdown' ? this.knockedDown(k) : g.stat === 'vigorMax' ? k.vigor <= g.lte : g.stat === 'fn' ? !!(this[g.fn] && this[g.fn](k, g)) : false); if (gatesOn.some(g => g.op === 'doomed') && !attack.doomed) { attack.doomed = true; this.say(`${k.name}: Doomed — 이 공격 동안 Heat로 Evasion/Judgement 재굴림 불가`, 'ai'); } if (this.isBw && gatesOn.some(g => g.op === 'bwDoomed') && !this.bw.doomed) { this.bw.doomed = true; this.say(`${k.name} Vigor ${k.vigor} → Doomed: 이 공격 동안 Heat로 Evasion/Judgement 재굴림 불가`, 'ai'); }
    let dice = (ops.pzDice && this.isPz ? this.pzDice(M.cur) : 0) + (this.isLh ? this.lhDice() : 0) + (ops.diceFromDopps ? 1 + this.guardians.length : ops.diceFromVigor ? Math.min(6, k.vigor + 1) : ops.diceFromBlood ? ops.diceFromBlood * this.mobBlood() : ops.tdDiceToads && this.isTd ? this.tdToadDice(k) : ops.klMomentum && this.isKl ? this.kl.momentum : card.evasionDice) + M.bonuses.evasionDice + sum(gatesOn.filter(g => g.op === 'evasionDice').map(g => g.n)) + (M.isMob && !(M.cur && M.cur.isTroll) ? this.firstmenDice() : 0) + (this.isWAT && !this.actingGuardian && this.flags.trollMinusDie ? -1 : 0); let diff = card.evasionDifficulty + M.modifiers.precision;
    const diffInstead = gatesOn.find(g => g.op === 'difficultyInstead'); if (diffInstead) diff = diffInstead.n; if (attack._np == null) { attack._np = (this.monNegPrecPerm || 0) + (this.monNegPrecTemp || 0); if (this.monNegPrecTemp) { this.say(`임시 음수 Precision 토큰 ${this.monNegPrecTemp}개 사용 → 버림`, 'tech'); this.monNegPrecTemp = 0; } } if (attack._np && typeof diff === 'number') { diff -= attack._np; this.say(`음수 Precision 토큰: Difficulty -${attack._np} → ${diff}+`, 'tech'); }
    if (this.negMonPrecision) { diff = Math.max(2, diff - this.negMonPrecision); this.say(`임시 Precision -${this.negMonPrecision} 토큰: Evasion 난이도 → ${diff}+ (토큰 버림)`, 'tech'); this.negMonPrecision = 0; }
    if (this.monster.hasTrait('Jacked')) { if (this.jackedTokens >= 2) diff += 1; if (this.jackedTokens >= 5) dice += 1; }
    const dw = await this.fx.defenseWindow(k, { judge: !!ops.judge }); dw.block += await this.paraDefense(k); dw.evasion += k._defEvasion || 0;  this.karaTargeted(k); let evaBonus = this.fx.evasionBonus(k) + dw.evasion + this.karaEvasion(k); let virtue = null;
    let freeER = this.fx.evasionRerolls(k) + this.lsBoon(k, 'evasionReroll') + this.paraStat(k, 'evasionReroll'), cloak = 0;
    let extraGuard = this.lsBoon(k, 'guard') + (k._defGuard || 0), wilder = 0;
    if (k.perilArcDef && k.perilArcDef.bonus && /^Guard (\d+)/.test(k.perilArcDef.bonus.text || '')) extraGuard += +/^Guard (\d+)/.exec(k.perilArcDef.bonus.text)[1];
    if (k.perilArcDef && k.perilArcDef.bonus && /^Evasion Re-roll (\d+)/.test(k.perilArcDef.bonus.text || '')) freeER += +/^Evasion Re-roll (\d+)/.exec(k.perilArcDef.bonus.text)[1];
    if (this.cloaked(k)) { extraGuard += 2; this.say(`${k.name}: Cloak of Shadows — Guard 2`, 'tech'); }
    { const t = k.hand.find(t => t.timing === 'onTargeted' && t.ops && this.fx.canPay(k, this.fx.costOf(k, t))); if (t && await this.yesNo(`${k.name}: ${t.name} 사용? (${this.fx.costLabel(k, t)}) — ${t.text}`, false)) { const pc = await this.fx.chooseCost(k, t); if (pc) { this.fx.pay(k, pc.alt, pc.x); const ops2 = this.fx.activeOps(k, t); for (const o of ops2) { if (o.op === 'guard') extraGuard += o.n; if (o.op === 'evasionDifficulty') { diff = (k.peril() === 'Judicium' ? 6 : o.n) + M.modifiers.precision; this.say(`${t.name}: Evasion Roll 난이도 → ${diff}+`, 'tech'); } } this.say(`${k.name} 기술 사용: ${t.name} — Guard ${ops2.filter(o => o.op === 'guard').reduce((a, o) => a + o.n, 0)}`, 'tech'); if (ops2.some(o => o.op === 'passPriority')) await this.passPriority(k); this.fx.deplete(k, t); await this.renTechniqueUsed(k); } } }
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; if (this.fx.constKw(k, g).some(o => o.op === 'swapERArmor')) { const red = this.fx.armorDice(k).red; if (red !== freeER && await this.yesNo(`${k.name}: ${g.name} — Evasion Re-roll ${freeER} ↔ 빨간 Armor 주사위 ${red} 맞바꾸기?`, false)) { k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce.red += freeER - red; this.say(`${g.name}: Evasion Re-roll ${red} · 빨간 Armor 주사위 ${freeER}`, 'tech'); freeER = red; } } }
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) { if (o.op === 'targetFleisch') { if (this.fx.chargesOf(g) >= o.c) { g.chargesLeft -= o.c; this.poolAdd('fleisch', o.n, { resource: true }); this.say(`${g.name}: Attack의 대상 — Fleisch ${o.n}, Charge ${g.chargesLeft}`, 'tech'); } else { g.discarded = true; this.say(`${g.name}: Charge 없음 → 카드 버림`, 'tech'); } } else if (o.op === 'chargeReinforce' && this.fx.chargesOf(g) > 0) { const mx = g.chargesLeft; const x = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${g.name} — Charge X로 Reinforce X`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: `${mx - i}`, value: mx - i })) }); if (x > 0) { g.chargesLeft -= x; k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce.red += x; this.say(`${g.name}: Reinforce ${x}`, 'tech'); } } } }
    { const rc = this.fx.gearAbilities(k, ['reinforceCardArmor']).find(x => x.g._armorOn > 0); if (rc && await this.yesNo(`${k.name}: ${rc.g.name} — Advanced Reinforce ${rc.g._armorOn}?`, true)) { this.fx.gearPay(k, rc.g, rc.o); k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce.black += rc.g._armorOn; this.say(`${rc.g.name}: Advanced Reinforce ${rc.g._armorOn}`, 'tech'); } }
    if (dice > 1 && k.bane > 0 && await this.fx.gearUse(k, ['attackDiceMinusBane'], `Monster Attack ${dice}d — 주사위 -${k.bane} (최소 1)?`)) { dice = Math.max(1, dice - k.bane); this.say(`${k.name}: 몬스터 공격 주사위 → ${dice} (Gear)`, 'tech'); }
    if (k.bane > 0 && await this.fx.gearUse(k, ['evasionPlusBane'], `Evasion Roll 전 — +${k.bane} Evasion?`)) { evaBonus += k.bane; this.say(`${k.name}: Evasion +${k.bane} (Gear)`, 'tech'); }
    { const wp = this.fx.gearAbilities(k, ['wilderPlate'])[0]; if (wp) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${wp.g.name} — Attack의 대상 (1 Charge)`, options: [{ label: '사용 안 함', value: 'skip' }, { label: 'Guard 1', value: 'guard' }, { label: '빨간 Armor 주사위 1', value: 'armor' }, { label: 'Evasion Re-roll 1', value: 'er' }] }); if (v && v !== 'skip') { this.fx.gearPay(k, wp.g, wp.o); if (v === 'guard') extraGuard = 1; else if (v === 'er') freeER += 1; else { k.reinforce = k.reinforce || {}; k.reinforce.red = (k.reinforce.red || 0) + 1; } this.say(`${wp.g.name}: ${v === 'guard' ? 'Guard 1' : v === 'er' ? 'Evasion Re-roll 1' : '빨간 Armor 주사위 +1'}`, 'tech'); } } }
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; const o = this.fx.constKw(k, g).find(x => x.op === 'targetEvasionChoice'); if (!o) continue; const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${g.name} — Monster Attack의 대상`, options: [{ label: `+${o.e} Evasion`, value: 'e' }, { label: `Evasion Re-roll ${o.r}`, value: 'r' }, { label: '사용 안 함', value: 'skip' }] }); if (v === 'e') evaBonus += o.e; else if (v === 'r') freeER += o.r; if (v === 'e' || v === 'r') { const p = this.fx.constKw(k, g).find(x => x.op === 'targetEvasionPenalty'); cloak += p ? p.n : 0; this.say(`${g.name}: ${v === 'e' ? `+${o.e} Evasion` : `Evasion Re-roll ${o.r}`}`, 'tech'); } }
    if (ops.judge) { const vOf = v => ((k.virtues || {})[v] || 0) + this.fx.virtueBonus(k, v); const opts = ops.judge.map(v => ({ label: `${v} +${vOf(v)}`, value: v })); virtue = opts.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name} Judgement — 시험할 Virtue 선택`, options: opts }) || ops.judge[0] : ops.judge[0]; evaBonus = vOf(virtue) + (k._adrenaline ? 2 : 0) + await this.fx.virtueCharge(k, `${virtue} Judgement`); this.say(`${k.name} Judgement: ${virtue} 시험 (+${evaBonus}, ${dice}d ${diff}+)`); }
    if (ops.diceFromBlood) this.say(`Evasion 주사위 X = ${ops.diceFromBlood} × Blood ${this.mobBlood()} = ${dice}`);
    if (dice <= 0) { this.say(`${k.name}: 주사위 0개 → 명중 없음`); attack.hits[k.id] = 0; return; }
    for (const g of gatesOn.filter(g => g.op === 'evasionDice' && g.stat === 'blood')) this.say(`Blood ${this.mobBlood()} ≥ ${g.gte} → +${g.n} 주사위`);
    if (M.isMob) for (const g of gatesOn.filter(g => g.op === 'evasionDicePerAdjacentMob')) dice += g.n * M.mobs.filter(m => m !== M.cur && m.cells.length && this.board.adjacent(m.cells[0], k.pos)).length;
    // roll + Heat re-rolls: ask which dice to re-roll (cost +1 Heat each) — offered only if some die would fail
    const evade = async (n, label = '') => {
      const r = rollD10s(this.rng, n + (k._eyeStorm ? 1 : 0)); if (k._eyeStorm && r.dice.length > 1) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Eye of the Storm — 무시할 Evasion 주사위`, options: r.dice.map((d, i) => ({ label: `${d.v}${i === 0 ? '★' : ''}`, value: i })) }); let wi = typeof v === 'number' ? v : 0; if (typeof v !== 'number') r.dice.forEach((d, i) => { if (d.v < r.dice[wi].v) wi = i; }); const dr = r.dice.splice(wi, 1)[0]; this.say(`Eye of the Storm: 주사위 1개 추가, ${dr.v} 무시`, 'tech'); }
      if (k.gear.some(g => !g.discarded && !g.exhausted && g.evasionReroll === 'X')) { const x = r.dice.filter(d => !d10Success(d.v, evaBonus, diff)).length; if (x) { freeER += x; this.say(`${k.name}: Evasion Re-roll X = ${x} (맞은 주사위 수)`, 'tech'); } }
      if (r.dice.some(d => !d10Success(d.v, evaBonus, diff))) await this.fx.changeDieOffer(k, r.dice, 'Evasion Roll');
      if (r.dice.some(d => !d10Success(d.v, evaBonus, diff))) { for (const mt of k.hand.filter(t => t.timing === 'onGuard' && t.ops)) { const mo = await this.paraUse(k, mt, `Evasion [${r.dice.map(d => d.v).join(' ')}] vs ${diff}+ — ${mt.text}`); if (mo) for (const o of mo) { if (o.op === 'guard') extraGuard += o.n; else await this.fx.runKnightOp(o, k, { technique: mt }); } } let gd = await this.fx.gearUse(k, ['guard'], `Evasion [${r.dice.map(d => d.v).join(' ')}] vs ${diff}+ — Guard 사용?`); if (!gd && extraGuard && await this.yesNo(`${k.name}: Evasion [${r.dice.map(d => d.v).join(' ')}] vs ${diff}+ — Guard ${extraGuard} 사용?`, true)) { gd = { n: extraGuard }; extraGuard = 0; } if (gd) { for (let x = gd.n || 1; x > 0; x--) { const fail = r.dice.map((d, i) => ({ d, i })).filter(z => !d10Success(z.d.v, evaBonus, diff) && z.d.v > 1); if (!fail.length) break; const i = fail.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `Guard: +1을 줄 주사위 (남은 ${x})`, options: fail.map(z => ({ label: `주사위 ${z.i + 1}: ${z.d.v}`, value: z.i })) }) : fail[0].i; const d = r.dice[i == null ? fail[0].i : i]; d.v = Math.min(10, d.v + 1); d.rerolled = true; } this.say(`Guard → [${r.dice.map(d => d.v).join(' ')}]`); } }
      if (!k._noER && r.dice.some(d => !d10Success(d.v, evaBonus, diff)) && (k.heat < k.heatLimit || freeER > 0 || (this.fx.gearHas(k, 'vigorReroll') && k.vigor > 1))) {
        const picked = await this.ask({ type: 'dice', knight: k.id, text: `${k.name} Evasion ${label}${n}d ${diff}+ (보너스 +${evaBonus}) — 재굴림 (${freeER ? `무료 Evasion Re-roll ${freeER}, 이후 ` : ''}Heat ${k.heat}/${k.heatLimit}, 주사위당 +1)`, dice: r.dice.map(d => ({ v: d.v, crit: d.crit, hit: d10Success(d.v, evaBonus, diff), canReroll: !d.rerolled })), max: ((this.isBw && this.bw.doomed) || attack.doomed ? 0 : k.heatLimit - k.heat) + freeER + (this.fx.gearHas(k, 'vigorReroll') ? Math.max(0, k.vigor - 1) : 0) });
        if (picked && picked.length) { const fr = Math.min(freeER, picked.length); freeER -= fr; if (fr) this.say(`Evasion Re-roll ${fr}개 (무료)`); if (picked.length - fr) await this.fx.payRerolls(k, picked.length - fr); for (const i of picked) { const d = r.dice[i]; d.v = this.rng.die(10); d.rerolled = true; if (d.crit && d.v === 1) this.say('Crit Evade Fail (재굴림)'); } }
      }
      return r;
    };
    const roll = await evade(dice); if (roll.dice.length && !d10Success(roll.dice[0].v, evaBonus, diff)) this.paraCritEvadeFail(k); if (roll.dice.length && roll.dice[0].v === 10) { this.renCrit(k, 'Evasion'); await this.paraCritDrain(); if (this.cloaked(k)) { k.tempEvasion = (k.tempEvasion || 0) + 1; this.say(`${k.name}: Cloak of Shadows — Crit Evade → 임시 Evasion +1 토큰`, 'tech'); } } if (k.tempEvasion) { this.say(`${k.name}: 임시 Evasion 토큰 ${k.tempEvasion}개 사용 후 버림`, 'tech'); k.tempEvasion = 0; }
    // "For every N hits, roll an additional die (resolve once)" / "If hit, roll N additional dice"
    if (ops.extraDice) { const f = roll.dice.filter(d => !d10Success(d.v, evaBonus, diff)).length; const extra = ops.extraDice.perHits ? Math.floor(f / ops.extraDice.perHits) : (f > 0 ? ops.extraDice.ifHit : 0); if (extra > 0) { this.say(`명중 ${f} → 추가 주사위 ${extra}개`); const r2 = await evade(extra, '추가 '); for (const d of r2.dice) { d.crit = false; roll.dice.push(d); } dice += extra; } }
    let hits = roll.dice.filter(d => !d10Success(d.v, evaBonus, diff)).length;
    if (this.hasCondition(k, 'Exposed')) { if (M.hasTrait('Unnerving Presence')) { if (hits < roll.dice.length) { hits++; this.say(`Unnerving Presence: ${k.name}(Exposed) — Evasion 주사위 1개 자동 명중`); } } else { this.removeCondition(k, 'Exposed'); } }
    // Block keyword (not against Judgements, p.52)
    if (!ops.judge) hits = Math.max(0, hits - this.fx.blockValue(k) - dw.block); else hits = Math.max(0, hits - this.fx.defyValue(k) - dw.block);
    this.flash('dice', { title: `${k.name} Evasion ${diff}+ (+${evaBonus})`, dice: roll.dice.map(d => ({ v: d.v, ok: d10Success(d.v, evaBonus, diff), crit: d.crit })), sub: hits ? `명중 ${hits}` : 'Full Evade', cls: hits ? 'bad' : 'good' });
    this.say(`${k.name} Evasion ${dice}d ${diff}+ → [${roll.dice.map(d => d.v + (d.rerolled ? '*' : '')).join(' ')}] 명중 ${hits}${roll.critChance ? ' (Crit Evade)' : ''}${roll.critFail ? ' (Crit Evade Fail)' : ''}`, 'dice');
    if (hits === 0 && k.alive) for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) { if (o.op === 'fullEvadeLook') { const ai = M.ai && M.ai.cards[0], bp0 = M.isMob ? null : M.bp.cards[0]; this.say(`${g.name}: Full Evade — AI 맨 위: ${ai ? ai.name : '없음'}${bp0 ? ` · BP 맨 위: ${bp0.name}` : ''}`, 'tech'); } else if (o.op === 'fullEvadePush' && !attack._evadePushed) { attack._evadePushed = true; this.say(`${g.name}: Full Evade — 몬스터를 ${roll.dice.length}칸 밀어냄`, 'tech'); await this.fx.pushMonster(k, roll.dice.length, null); } } }
    k._evDice = roll.dice.length; k._evAttack = attack;
    if (hits > 0) for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) { if (o.op === 'hitSuppress') { for (const d of [M.ai, M.isMob ? null : M.bp]) if (d && d.discard) { d.cards.push(...d.discard); d.discard = []; d.shuffle(); } this.say(`${g.name}: 피격 → AI·BP Suppress`, 'tech'); } else if (o.op === 'hitPoisonNegAT' && await this.yesNo(`${k.name}: ${g.name} — Poison ${o.p}을 받고 임시 AT -${o.n} 토큰 놓기?`, false)) { await this.fx.runKnightOp({ op: 'poison', n: o.p }, k, {}); this.negAT = (this.negAT || 0) + o.n; this.say(`임시 AT -${o.n} 토큰 (다음 Power Roll에 적용)`, 'tech'); } } }
    if (hits > 0) this.renSympathy(k, '공격에 명중당함');
    if (hits > 0) { if (cloak && k.alive) { this.say(`${k.name}: Full Evade 실패 — Vigor -${cloak} (Gear)`); await this.fx.runKnightOp({ op: 'loseVigor', n: cloak }, k, {}); } for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) if (o.op === 'hitRevealMob' && M.isMob && M.cur && !M.cur.revealed && M.cur.cells.length && !M.cur.isTroll && !M.cur.isPump && !M.cur.isNightmare) { if (await this.yesNo(`${k.name}: ${g.name} — Mob #${M.cur.n}의 BP 공개?`, true)) await this.revealMob(M.cur); } else if (o.op === 'hitDiscardCharge') { if (this.fx.chargesOf(g) >= o.n) { g.chargesLeft -= o.n; this.say(`${g.name}: 피격 — Charge -${o.n} (${g.chargesLeft})`, 'tech'); } else { g.discarded = true; this.say(`${g.name}: 피격 — Charge 없음 → 카드 버림`, 'tech'); } } else if (o.op === 'hitPoolTokens') { this.say(`${g.name}: Monster Attack에 명중당함`, 'tech'); this.poolAdd('opening', o.opening); this.poolAdd('black', o.black); } } }
    attack.hits[k.id] = hits; attack.firstHits = attack.firstHits || {}; if (!(k.id in attack.firstHits)) attack.firstHits[k.id] = hits;
    if (ops.critEvadeFail && roll.critFail) { this.say('Crit Evade Fail'); await this.fx.runMonsterOps(ops.critEvadeFail, { attack, target: k, hits }); }
    if (ops.always) await this.fx.runMonsterOps(ops.always, { attack, target: k, hits, judgement: !!ops.judge }); const v0 = k.vigor;
    if (hits === 0) { this.say(`${k.name} Full Evade`); for (const pile of ['discard', 'cooldown', 'delay']) for (const t of [...(k[pile] || [])]) if (t.returnOnFullEvade) { k[pile].splice(k[pile].indexOf(t), 1); k.hand.push(t); this.say(`${k.name}: Full Evade → ${t.name} 손으로 복귀`, 'tech'); } return; }
    // effects in order
    await this.windowOfOpportunity('beforeEffects', attack, k);
    const vigInstead = gatesOn.find(g => g.op === 'vigorPerHitInstead');
    attack.keGates = gatesOn; attack.penetrate = gatesOn.some(g => g.op === 'keNoteGate'); if (attack.penetrate) this.say('Heat 게이트 → Penetrate', 'ai'); const ctx = { attack, target: k, hits, vigorPerHitOverride: vigInstead ? vigInstead.n : null, gatesOn, judgement: !!ops.judge };
    if (vigInstead && vigInstead.stat === 'blood') this.say(`Blood ${this.mobBlood()} ≥ ${vigInstead.gte} → 명중당 -${vigInstead.n} Vigor`);
    for (const g of gatesOn.filter(g => g.op === 'discardArmorGear')) { const arm = k.gear.filter(x => x.type === 'armor' && !x.discarded); if (!arm.length) { this.say(`${k.name}: 버릴 Armor Gear 없음`); continue; } const nm = arm.length === 1 ? arm[0].name : await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Armor Gear 카드 1장 버리기 (Blood ${g.gte}+)`, options: arm.map(x => ({ label: x.name, value: x.name })) }); const gg = arm.find(x => x.name === nm) || arm[0]; gg.discarded = true; this.say(`${k.name}: ${gg.name} 버림 (Vicious Bite)`); }
    for (const g of gatesOn.filter(g => g.op === 'pushback')) await this.pushback(k, g.n, { isPush: true });
    for (const b of ops.before) await this.fx.runMonsterOp(b, ctx);
    for (const g of gatesOn) for (const b of g.alsoOps || []) await this.fx.runMonsterOp(b, ctx); // gate tag chained under the Heat gate (e.g. Backslash/Backthrust Choke 3)
    await this.fx.runMonsterOps(ops.effects, ctx);
    if (k.alive && hits > 0 && k.vigor >= v0) (attack.noVigorLost = attack.noVigorLost || new Set()).add(k.id);
    if (wilder && k.alive) { k.gainPassion(wilder); this.say(`${k.name}: 살아남음 → Passion +${wilder} (Gear)`, 'tech'); }
    for (const g of gatesOn.filter(g => g.op === 'discard')) await this.fx.runMonsterOp({ op: 'discard', n: g.n }, ctx);
    for (const g of gatesOn.filter(g => g.op === 'die')) { this.say(`${k.name}: Heat ${k.heat} ≥ ${g.gte} → YOU DIE`); await this.die(k, 'Yolkman Strike'); }
  }

  // ---------- damage / peril ----------
  /** Vigor loss from a Monster Attack: Armor Roll first (if any armor dice), then apply; Peril Check / Judicium handled by caller flags. */
  async loseVigor(k, n, { source = 'attack', perilCheck = false, armor = true } = {}) {
    if (!k.alive || n <= 0) return 0;
    let loss = n;
    if (armor && source === 'attack' && !this.fx.gearHas(k, 'noArmorRoll')) { await this.stoneDefense(k); const dice = this.fx.armorDice(k); for (const g of k.gear) if (!g.discarded && !g.exhausted) for (const o of this.fx.constKw(k, g)) if (o.op === 'armorUpgrade' && dice.black > 0) { dice.black--; dice.white++; if (o.leash) this.leash(k, o.leash, g.name); this.say(`${g.name}: black Armor 주사위 → white`, 'tech'); } if (this.currentAttack && this.currentAttack.penetrate) { const col = ['white', 'black', 'red'].find(c => dice[c] > 0); if (col) { dice[col] -= 1; this.say(`Penetrate: ${k.name}의 ${col} Armor 주사위 1개 무시`, 'dice'); } } if (dice.red + dice.black + dice.white > 0) { const r = rollArmor(this.rng, dice, this.data.components.dice.faces, this.data.components.dice.armorSymbol); let mit = await this.fx.armorRollGear(k, r); if (this.fx.has(k, 'armorRollDoubleSymbols')) mit *= 2; else mit = await this.fx.armorDoubleGear(k, mit, loss); { const l0 = loss; loss = Math.max(0, loss - mit); k._mitigated = l0 - loss; } this.say(`${k.name} Armor Roll ${r.dice.length}d → 경감 ${mit}`, 'dice'); await this.fx.onArmorRoll(k, mit); if (loss === 0) { this.say(`${k.name} 피해 전부 경감 → Peril Check 없음`); return 0; } } }
    if (source === 'attack' && loss > 0) { const u = await this.fx.gearUse(k, ['soakPaid'], `Monster Attack Vigor -${loss} — Soak 사용?`); if (u) { loss -= u.n; this.say(`${k.name}: Soak ${u.n} (Gear)`, 'tech'); } }
    loss -= this.fx.soak(k); if (loss <= 0) return 0;
    const before = k.vigor; const eff = k.loseVigor(loss); this.say(`${k.name} Vigor -${loss} (${before}→${k.vigor})${eff < 0 ? ' [효과상 ' + eff + ']' : ''}`, 'dmg');
    await this.fx.gateSweep(k);
    this.renVigorLost(k, loss);
    for (const g of k.gear) if (!g.discarded && this.fx.kwList(g).some(o => o.op === 'vigorLossCharge')) { g.chargesLeft = this.fx.chargesOf(g) + loss; this.say(`${g.name}: Vigor ${loss} 손실 → Charge +${loss} (${g.chargesLeft})`, 'tech'); }
    if (this.currentAttack) { this.currentAttack.vigorLost = true; this.currentAttack.vigorLostTotal = (this.currentAttack.vigorLostTotal || 0) + loss; }
    if (eff <= 0) { await this.massivePeril(k, eff); await this.drawJudicium(k); return loss; }
    if (perilCheck) await this.perilCheck(k);
    return loss;
  }
  async massivePeril(k, eff) { const add = n => { const c = this.judiciumAll.find(j => j.massivePerilThreshold === n); if (c && !this.judiciumExtra.includes(c)) { this.judiciumExtra.push(c); this.say(`Massive Peril ${n}: ${c.name} 추가`, 'warn'); } }; if (eff <= -5) add(-5); if (eff <= -9) add(-9); if (eff <= -12) add(-12); }
  async perilCheck(k) {
    if (k.alive && k.fixedMortis && k.peril() !== 'Uninjured') { const fm = k.fixedMortis; k.fixedMortis = null; this.say(`${k.name}: 미리 뽑아둔 ${fm.tier} Mortis 해결 — ${fm.card.name}`, 'tech'); this.mortis[fm.tier].cards.unshift(fm.card); await this.drawMortis(k, fm.tier); return; }
    if (k.alive && k.peril() !== 'Uninjured' && await this.fx.gearUse(k, ['ignorePeril'], `Peril Check (${k.peril()}) — 무시?`)) { this.say(`${k.name}: Peril Check 무시 (Gear)`, 'tech'); return; }
    if (!k.alive) return; const tier = k.peril(); if (tier === 'Uninjured') { this.say(`${k.name} Peril Check: Uninjured → 없음`); return; }
    if (tier === 'Judicium' || (tier === 'Grave' && this.currentAttack && this.currentAttack.graveToJudicium)) { if (tier === 'Grave') this.say('Et Tu: Grave Mortis 대신 Judicium'); await this.drawJudicium(k); return; }
    await this.drawMortis(k, tier);
  }
  async drawMortis(k, tier, { named = null } = {}) {
    const deck = this.mortis[tier]; if (!named && deck.cards.length && await this.fx.gearUse(k, ['mortisPeek'], `${tier} Mortis를 뽑기 전 — 맨 위 카드 확인?`)) { const top = deck.cards[0]; this.say(`${tier} Mortis 맨 위: ${top.name} — ${top.text}`, 'mortis'); this.flash('card', { title: `${tier} Mortis 맨 위`, name: top.name, text: top.text, cls: 'bad' }); if (await this.yesNo(`${k.name}: ${tier} Mortis 덱을 섞기? (맨 위: ${top.name})`, false)) { deck.shuffle(); this.say(`${tier} Mortis 덱 섞음`, 'tech'); } }
    let card = named ? deck.cards.find(c => c.name === named) : deck.draw(); if (!named && card && deck.cards.length && await this.fx.gearUse(k, ['mortisTwo'], `${tier} Mortis — 위 2장 중 선택?`)) { const c2 = deck.draw(); const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 해결할 ${tier} Mortis`, options: [card, c2].map((c, i) => ({ label: `${c.name} — ${String(c.text).slice(0, 80)}`, value: i })) }); const keep = v === 1 ? c2 : card, back = v === 1 ? card : c2; deck.cards.unshift(back); card = keep; } if (named && card) deck.cards.splice(deck.cards.indexOf(card), 1);
    if (!card) { this.say(`${tier} Mortis 덱 비어 있음`); return; }
    this.say(`${k.name} ${tier} Mortis: ${card.name} — ${card.text}`, 'mortis'); if (this.isBw) { const r = this.bwMortis(k, card, deck); if (r === 'skip') return; if (r) card = r; } if (this.isKe && this.ke.setupPeril && card.positive) { this.say('Starved Slaughterman: 긍정 Mortis — 효과 무시'); deck.putBottom(card); return; } { const ig = k.gear.find(g => !g.discarded && !g.exhausted && this.fx.constKw(k, g).some(o => o.op === 'ignoreMortis' && o.names.includes(card.name))); if (ig) { this.say(`${k.name}: ${ig.name} — ${card.name} 무시`, 'tech'); deck.discard && deck.discard.push(card); return; } } this.flash('card', { title: `${k.name} — ${tier} Mortis`, name: card.name, text: card.text, cls: 'bad' });
    for (const g of k.gear) if (!g.discarded) for (const o of this.fx.kwList(g)) if (o.op === 'mortisCharge' && !card.positive) { g.chargesLeft = this.fx.chargesOf(g) + o.n; this.say(`${g.name}: Mortis 해결 → Charge +${o.n} (${g.chargesLeft})`, 'tech'); }
    if (!card.positive && (tier === 'Minor' || tier === 'Major')) { const n = tier === 'Minor' ? 1 : 2; const u = await this.fx.gearUse(k, ['mortisInstead'], `${card.name} (${tier} Mortis) — 대신 Vigor -${n}, 카드를 덱에 섞고 Peril Check 다시?`); if (u) { deck.putBottom(card); if (deck.shuffle) deck.shuffle(); k.vigor = Math.max(0, k.vigor - n); this.say(`${k.name}: Mortis 대신 Vigor -${n} (${k.vigor}) → Peril Check 다시`, 'tech'); await this.perilCheck(k); return; } }
    if (card.name === 'Disemboweled' && (k.zeal || 0) >= 3) { const t = k.hand.find(t => t.timing === 'onMortisDraw' && /ignore the Disemboweled/.test(t.text || '') && this.fx.canPay(k, this.fx.costOf(k, t))); if (t && await this.yesNo(`${k.name}: ${t.name} — Zeal 3+ → Disemboweled 무시? (${this.fx.costLabel(k, t)})`, true)) { const pc = await this.fx.chooseCost(k, t); if (pc) { this.fx.pay(k, pc.alt, pc.x); this.fx.deplete(k, t); if (this.renTechniqueUsed) await this.renTechniqueUsed(k); this.say(`${k.name}: ${t.name} — Disemboweled 무시`, 'tech'); deck.putBottom(card); return; } } }
    // Second Chance window
    const sc = await this.fx.secondChance(k, card, tier); if (sc) { deck.putBottom(card); card = deck.draw(); this.say(`Second Chance → 다시 뽑음: ${card.name} — ${card.text}`, 'mortis'); }
    const res = await this.fx.runMortis(card, k, tier);
    if (k._survivePassion) { const n = k._survivePassion; k._survivePassion = 0; if (k.alive) { k.gainPassion(n); this.say(`${k.name}: Superior Chance 뒤 살아남음 → Passion +${n} (Gear)`, 'tech'); } }
    if (!res || !res.shuffledBack) deck.putBottom(card);
  }
  async drawJudicium(k) {
    if (!k.alive) return; if (this.currentAttack && this.currentAttack.card.ops.judiciumDies) { this.say(`${k.name}: 이 공격으로 Judicium을 뽑게 됨 → 대신 사망`, 'death'); return this.die(k, this.currentAttack.card.name); } { const jm = this.fx.gearAbilities(k, ['judiciumToMortis'])[0]; const tiers = Object.keys(this.mortis || {}).filter(t => this.mortis[t] && this.mortis[t].cards && this.mortis[t].cards.length); if (jm && tiers.length) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${jm.g.name} — Judicium 대신 공개된 Mortis 해결`, options: [{ label: 'Judicium을 뽑는다', value: 'skip' }, ...tiers.map(t => ({ label: `${t}: ${this.mortis[t].cards[0].name}`, value: t }))] }); if (v && v !== 'skip') { this.fx.gearPay(k, jm.g, jm.o); this.say(`${jm.g.name}: Judicium 대신 ${v} Mortis 해결`, 'tech'); await this.drawMortis(k, v); return; } } } let cards = [...this.judiciumBase, ...this.judiciumExtra]; if (this.judiciumExtra.length && await this.fx.gearUse(k, ['judiciumNoMassive'], `Judicium (${cards.length}장) — Massive Peril 카드 제외?`)) { cards = [...this.judiciumBase]; this.say('Massive Peril Judicium 제외 (이번 뽑기만)', 'tech'); } const opp = await this.fx.gearUse(k, ['judiciumOpposite'], 'Judicium을 뽑기 전 — 반대 결과로 해결?', false); let card = this.rng.pick(cards); if (!k.fixedJudicium) { const jc = k.gear.find(g => !g.discarded && !g.exhausted && this.fx.constKw(k, g).some(o => o.op === 'judiciumChoose')); if (jc) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${jc.name} — Judicium을 뽑는 대신 선택 (다음 Judicium은 반대 카드)`, options: [{ label: 'You Live!', value: 'live' }, { label: 'You Died', value: 'died' }, { label: '그냥 뽑기', value: 'skip' }] }); if (v === 'live' || v === 'died') { card = this.judiciumBase.find(c => !!c.death === (v === 'died')); k._nextJudicium = this.judiciumBase.find(c => !!c.death !== (v === 'died')); this.say(`${jc.name}: ${card.name} 선택 — 다음 Judicium은 ${k._nextJudicium.name}`, 'tech'); this.flash('card', { title: `${k.name} — Judicium`, name: card.name, text: card.text || '', cls: card.death ? 'bad' : 'good' }); if (card.death) await this.die(k, card.name); return; } } } if (k._nextJudicium && !k.fixedJudicium) { k.fixedJudicium = k._nextJudicium; k._nextJudicium = null; } if (k.fixedJudicium) { card = k.fixedJudicium; k.fixedJudicium = null; this.say(`${k.name}: 미리 뽑아둔 Judicium으로 해결`, 'tech'); } if (!opp) { this.say(`${k.name} Judicium: ${card.name}`, 'mortis'); if (await this.fx.gearUse(k, ['judiciumOppositeAfter'], `Judicium ${card.name} — 반대 결과로 해결?`, !!card.death)) { const o2 = this.judiciumBase.find(c => !!c.death !== !!card.death); this.say(`Judicium ${card.name} → 반대: ${o2.name}`, 'tech'); card = o2; } } if (opp) { const o2 = this.judiciumBase.find(c => !!c.death !== !!card.death); this.say(`Judicium ${card.name} → 반대: ${o2.name}`, 'tech'); card = o2; }
    this.say(`${k.name} Judicium (${cards.length}장): ${card.name}`, 'mortis'); this.flash('card', { title: `${k.name} — Judicium`, name: card.name, text: card.text || '', cls: card.death ? 'bad' : 'good' });
    /* Second Chance / Superior Chance (Keyword List): "After you draw a Mortis or Judicium card, you may ignore its effect and discard it. Draw and resolve another card from the same deck … You cannot ignore the second draw in any way." Superior: without the You died horribly card. */
    if (await this.fx.secondChance(k, { name: `Judicium "${card.name}"`, ops: card.death ? [{ op: 'die' }] : [] }, 'Judicium')) { const sup = !!this.fx.lastChanceSuperior; const pool = sup ? cards.filter(c => !/Horribly/i.test(c.name)) : cards; card = this.rng.pick(pool.length ? pool : cards); this.say(`${sup ? 'Superior' : 'Second'} Chance → Judicium 다시 뽑음: ${card.name}`, 'mortis'); if (k._survivePassion) { const n = k._survivePassion; k._survivePassion = 0; if (!card.death) { k.gainPassion(n); this.say(`${k.name}: 살아남음 → Passion +${n} (Gear)`, 'tech'); } } }
    if (card.death) await this.die(k, card.name); else { k.vigor = Math.max(0, k.vigor); }
  }
  async die(k, reason) {
    if (!k.alive) return;
    // Unknown Saint incarnation attempt (campaign hook)
    if (await this.fx.gearUse(k, ['ignoreDeath'], `사망 직전 (${reason}) — 이 죽음을 무시?`)) { k.vigor = Math.max(0, k.vigor); this.say(`${k.name}: 죽음 무시 (Gear)`, 'tech'); return; }
    if (this.listeners.beforeDeath) { const saved = await this.listeners.beforeDeath(k, reason, this); if (saved) return; }
    k.die(reason); this.board.remove([k.pos]); this.say(`☠ ${k.name} 사망 (${reason})`, 'death'); for (const g of [...k.gear]) { if (g.discarded || !this.fx.kwList(g).some(o => o.op === 'deathPassOn')) continue; const others = this.alive().filter(x => x !== k); if (!others.length) break; const d = x => Math.abs(x.pos.c - k.pos.c) + Math.abs(x.pos.r - k.pos.r); const best = Math.min(...others.map(d)); const near = others.filter(x => d(x) === best); const id = near.length > 1 ? await this.ask({ type: 'pickKnight', text: `${g.name}: 물려받을 가장 가까운 기사`, options: near.map(x => ({ label: x.name, value: x.id })) }) : near[0].id; const x = near.find(y => y.id === id) || near[0]; for (const a of x.gear) if (a.type === 'armor' && !a.discarded) { a.discarded = true; this.say(`${x.name}: ${a.name} 버림`); } k.gear.splice(k.gear.indexOf(g), 1); g.exhausted = false; x.gear.push(g); this.say(`${g.name}: ${k.name} 사망 → ${x.name}이(가) 장착`, 'tech'); }
    if (this.priorityTarget === k) { const al = this.alive(); if (al.length) this.priorityTarget = al.reduce((a, b) => b.passion > a.passion ? b : a); }
    if (this.listeners.onDeath) await this.listeners.onDeath(k, reason, this);
    this.checkEnd();
    if (this.currentAttack && this.currentAttack.targets.includes(k)) throw new ChainBreak('Mercy Rule: target died');
  }

  // ---------- conditions / movement effects ----------
  async addCondition(k, id, { tokens = 0 } = {}) {
    { const cd = this.conditionDefs[id]; if (cd && cd.type) for (const g of k.gear) { if (g.discarded || g.exhausted) continue; const o = this.fx.constKw(k, g).find(x => x.op === 'ignoreCondType' && x.type === cd.type); if (o && (!o.ask || await this.yesNo(`${k.name}: ${g.name} — ${id} Condition 무시?`, true))) { this.say(`${k.name}: ${id} Condition 무시 (${g.name})`, 'tech'); return; } } }
    if (id === 'Exposed' && this.flags && this.flags.noExposed) { this.say(`${k.name}: Exposed를 받을 수 없음 (Milky Eyes)`); return; }
    const def = this.conditionDefs[id]; if (!def) { this.say(`[미구현 Condition] ${id}`, 'warn'); return; }
    for (const c of [...k.conditions]) { const cd = this.conditionDefs[c.id]; if (cd && cd.ops && cd.ops.crossGain && cd.flipSide === id) { if (cd.ops.crossGain === 'die') { this.say(`${k.name}: ${c.id} 상태에서 ${id} 획득 → 사망`, 'death'); await this.die(k, `${c.id} + ${id}`); return; } if (cd.ops.crossGain === 'flip') { c.id = cd.flipSide; this.say(`${k.name}: ${cd.name} 상태에서 ${id} 획득 → ${cd.flipSide}`, 'cond'); return; } } }
    const existing = this.hasCondition(k, id);
    if (existing) { if (def.ops && def.ops.secondTime === 'flip' && def.flipSide) { existing.id = def.flipSide; this.say(`${k.name}: ${id} 두 번째 → ${def.flipSide}`); } else if (def.ops && def.ops.secondTime === 'die') { await this.die(k, id + ' (second time)'); } else this.say(`${k.name}: 이미 ${id}`); return; }
    k.conditions.push({ id, tokens }); this.say(`${k.name} Condition: ${id}`, 'cond');
    if (/^Distracted|^Panicked/.test(id)) this.fx.enforceHandLimit(k);
  }
  removeCondition(k, id) { const i = k.conditions.findIndex(c => c.id === id); if (i >= 0) { k.conditions.splice(i, 1); this.say(`${k.name}: ${id} 제거`); return true; } return false; }
  async knockdown(k) { if (!k.alive) return; { const t = (k.discard || []).find(x => x.acrobaticsHeat); if (t && !this.monster.isMob && this.adjacentToMonster(k) && !this.knockedDown(k) && k.heat + t.acrobaticsHeat <= k.heatLimit && await this.yesNo(`${k.name}: Acrobatics (${t.name}) — ${t.acrobaticsHeat} Heat로 Knockdown 대신 Vault?`, true)) { k.gainHeat(t.acrobaticsHeat, { voluntary: true }); this.say(`${k.name}: Acrobatics — Knockdown 대신 Vault`, 'tech'); await this.fx.vault(k); return; } } if (await this.wnColumnGuard(k, 'Knockdown')) return; for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) { if (o.op === 'knockdownPool' && !this.pool.filter(t => !t.resource).length) { const b = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${g.name} — Knockdown, Knight Pool 비어 있음: Break 수 (나머지 Opening, 총 ${o.n})`, options: Array.from({ length: o.n + 1 }, (_, i) => ({ label: `Break ${i} / Opening ${o.n - i}`, value: i })) }); if (b > 0) this.poolAdd('break', b); if (o.n - b > 0) this.poolAdd('opening', o.n - b); } else if (o.op === 'knockdownOpenings' && this.fx.chargesOf(g) > 0) { const mx = this.fx.chargesOf(g); const x = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${g.name} — Knockdown: 쓸 Charge 수 (Opening X)`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: `${mx - i}`, value: mx - i })) }); if (x > 0) { g.chargesLeft -= x; this.poolAdd('opening', x); } } } } if (!this.knockedDown(k) && !k.engulfed && !this._rollOut && (this.monster.isMob ? this.adjacentMobs(k).length : this.adjacentToMonster(k)) && await this.fx.gearUse(k, ['rollOut'], 'Knockdown — Roll Out (대신 Knockback 4)?')) { this._rollOut = true; try { await this.knockback(k, 4); } finally { this._rollOut = false; } return; } if (k.braced || this.fx.has(k, 'rocksteady')) { this.say(`${k.name} Knockdown 무시`); return; } if (this.knockedDown(k)) return; await this.addCondition(k, 'Knockdown (Falling Down)'); }
  standUp(k) { const c = k.conditions.find(c => /^Knockdown/.test(c.id)); if (c) { k.conditions.splice(k.conditions.indexOf(c), 1); this.say(`${k.name} 일어남`); return true; } return false; }
  /** Involuntary straight-line movement away from the monster (Pushback / Knockback). Obstacles: Crash (+destroy if destructible); edge: slide along (p.56). */
  async pushback(k, n, opts = {}) { if (!k.alive || n <= 0 || k.engulfed) return; if (!opts.unavoidable) { if (await this.fx.ignoreInvol(k, `비자발적 이동 ${n}`)) return; n -= await this.fx.coneArmor(k, n, 'Pushback'); } try { if (n > 0) await this.pushback0(k, n, opts); } finally { this.fx.coneBreak(k); } }
  async pushback0(k, n, { unavoidable = false, dir = null, isPush = false } = {}) {
    if (!k.alive || n <= 0 || k.engulfed) return; n = await this.ubarReduce(k, n); if (n <= 0) return; if (!unavoidable) { const u = await this.fx.gearUse(k, ['reduceKB'], `Pushback/Knockback ${n} — 줄이기?`); if (u) { n -= u.n; this.say(`${k.name}: ${n + u.n} → ${n} (Gear)`, 'tech'); if (n <= 0) return; } } if (await this.wnColumnGuard(k, '비자발적 이동')) return; if (!unavoidable && !k.braced && !this.fx.gearHas(k, 'braced') && this.fx.gearAbilities(k, ['braced']).length && await this.fx.gearUse(k, ['braced'], `비자발적 이동 ${n}칸 — Braced 사용?`)) k.braced = true;
    if ((k.braced || k.rooted || this.fx.gearHas(k, 'braced')) && !unavoidable) { this.say(`${k.name} Braced: 밀려나지 않음`); return; }
    if (!unavoidable && n > 0) { const u = await this.fx.gearUse(k, ['reduceKnockback'], `Knockback/Pushback ${n} — 줄이기?`); if (u) { n = Math.max(0, n - u.n); this.say(`${k.name}: 비자발적 이동 → ${n} (Gear)`, 'tech'); if (n <= 0) return; } }
    if (!unavoidable && n > 0 && await this.fx.gearUse(k, ['bracedPaid'], `비자발적 이동 ${n} — Braced 획득?`)) { this.say(`${k.name} Braced (Gear): 밀려나지 않음`); return; }
    if (!unavoidable && n > 0) { const rb = this.fx.gearHas(k, 'reduceInvolBane') ? Math.min(k.bane || 0, n) : 0; if (rb > 0) { const x = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 비자발적 이동 ${n} — 줄일 칸 수 (Bane ${k.bane})`, options: Array.from({ length: rb + 1 }, (_, i) => ({ label: `${rb - i}`, value: rb - i })) }); if (x > 0) { n -= x; this.say(`${k.name}: 비자발적 이동 -${x} (Gear)`, 'tech'); if (n <= 0) return; } } }
    n = Math.max(0, n - (unavoidable ? 0 : this.fx.involuntaryReduction(k))); if (n > 1 && this.fx.gearHas(k, 'reduceInvol') && await this.yesNo(`${k.name}: 비자발적 이동 ${n} → ${n - 1}로 줄이기 (Gear)?`, true)) n--;
    if (isPush && !dir) return this.pushLoop(k, n);
    let d = dir || this.dirFromMonster(k.pos); const B = this.board; let moved = 0; const trail = []; let under = null; const start0 = { ...k.pos }; // under: a Knight whose space is being passed through
    const settle = async () => { const o = under; under = null; if (!o || !o.alive) return; if (k.alive && cellEq(k.pos, o.pos)) { this.say(`${k.name}의 이동이 ${o.name}의 칸에서 끝남 → ${o.name} Displace`); B.place({ kind: 'knight', id: k.id }, [k.pos]); await this.displace(o); B.place({ kind: 'knight', id: k.id }, [k.pos]); } else B.place({ kind: 'knight', id: o.id }, [o.pos]); };
    try {
    for (let i = 0; i < n; i++) {
      let next = { c: k.pos.c + d.c, r: k.pos.r + d.r };
      if (!B.inside(next)) { // slide along edge away from monster
        const alts = [{ c: d.r, r: d.c }, { c: -d.r, r: -d.c }].map(x => ({ x, cell: { c: k.pos.c + x.c, r: k.pos.r + x.r } })).filter(a => B.inside(a.cell));
        if (!alts.length) break; const m = this.monsterCenter(); const dist = a => Math.abs(a.cell.c - m.c) + Math.abs(a.cell.r - m.r); alts.sort((a, b) => dist(b) - dist(a)); let pick = alts[0]; if (alts.length > 1 && dist(alts[0]) === dist(alts[1])) { const i = await this.ask({ type: 'pick', text: `${k.name} 가장자리 미끄러짐 방향`, options: alts.map((a, i) => ({ label: B.label(a.cell), value: i })) }); pick = alts[i] || alts[0]; } d = pick.x; next = pick.cell;
      }
      const t = B.terrainAt(next);
      if (t && t.obstacle) { await this.crash(k); if (t.destructible) { this.destroyObstacle(next); this.say(`${t.id} 파괴`); } else break; if (!k.alive) return; }
      if (t && t.chasm) { this.moveKnight(k, next); if (await this.fx.gearUse(k, ['lifeline'], 'Chasm으로 이동 → 사망. Lifeline으로 Displace?')) { k._moved = false; await this.displace(k); return; } if (await this.stoneRock(k, 'Chasm')) return; await this.die(k, 'Chasm'); return; }
      if (this.isFen && this.guardianAt(next)) { this.say(`${k.name}: Doppelknight 위로 비자발적 이동 → Displace + Slimed`); await this.addCondition(k, 'Slimed'); break; }
      if (this.monsterOccupies(next)) { await this.crash(k); break; }
      const other = this.knights.find(o => o !== k && o.alive && !o.engulfed && !o.possessed && !o.onVP && cellEq(o.pos, next));
      this.moveKnight(k, next); moved++; trail.push(next);
      if (under) B.place({ kind: 'knight', id: under.id }, [under.pos]); under = other || null;
    }
    } finally { await settle(); }
    this.say(`${k.name} ${unavoidable ? 'Unavoidable Knockback' : 'Pushback'} ${moved}/${n}칸 → ${B.label(k.pos)}`);
    // Knockback X: "Knocked back Knights ignore all Terrain tiles they move through except Obstacles" — only the space the Knight ends on counts.
    if (k.alive && moved && !this.fx.gearHas(k, 'ignoreRubble') && B.terrainAt(k.pos) && B.terrainAt(k.pos).id === 'rubble') { this.say(`${k.name}: Rubble 위로 비자발적 이동 → Knockdown`); await this.knockdown(k); } if (k.alive) await this.involEnd(k, start0); else await this.swampSweep();
  }
  /** A destroyed Ruined Wall / Tower turns into Rubble (Terrain cards); other Destructible tiles are removed. */
  destroyObstacle(cell) { const B = this.board; const t = B.terrainAt(cell); if (!t) return; if (t.id === 'ruined wall' || t.id === 'tower') B.terrain.set(B.key(cell), this.pkeTerr('rubble')); else B.terrain.delete(B.key(cell)); }
  /** End of an involuntary move: Swamp / Campfire (end on), Bloodgeyser (start or end), Loose String (end on). */
  async involEnd(k, start) { await this.swampSweep(); if (!k.alive) return; if (this.geyserKnight && start) await this.geyserKnight(k, start); if (k.alive && this.isPke && this.pkeStringCheck) await this.pkeStringCheck(k); }
  /** Pushback X (rulebook p.85): turn the source toward the Knight, then the source moves up to X spaces in its direction, pushing it in a
   *  straight line (not adjacent → the source first moves along the shortest path). Non-Mob source: the Knight passes through other
   *  miniatures (ending on one Displaces it); Destructible Obstacle → removed, Crash, continue; Indestructible Obstacle / Board Edge →
   *  the Knight is Displaced so the source can enter its space, then continue (impossible → the Knight dies). Mob source: stops before
   *  another miniature, an Indestructible Obstacle (Crash) or the Board Edge (Displace if possible). */
  async pushLoop(k, n) {
    const B = this.board, M = this.monster; const g = this.actingGuardian || null; const wn = this.isWN && this.wn ? this.wn : null;
    // Guardians and the Winged Nightmare follow the Mob Pushback rules; Board Edge handling is the same for every source (소유자 확인 2026-11-20)
    const mob = !!M.isMob || !!g; const stepper = !M.isMob || !!wn; let moved = 0, steps = 0; const trail = []; let under = null; const start = { ...k.pos };
    const settle = async () => { const o = under; under = null; if (!o || !o.alive) return; if (k.alive && cellEq(k.pos, o.pos)) { this.say(`${k.name}의 이동이 ${o.name}의 칸에서 끝남 → ${o.name} Displace`); B.place({ kind: 'knight', id: k.id }, [k.pos]); await this.displace(o); B.place({ kind: 'knight', id: k.id }, [k.pos]); } else B.place({ kind: 'knight', id: o.id }, [o.pos]); };
    const mobShift = d => { const m = M.cur; if (!m || !m.cells.length) return false; const cs = m.cells.map(c => ({ c: c.c + d.c, r: c.r + d.r })); if (!cs.every(c => B.inside(c) && !B.isObstacle(c) && !this.knightAt(c) && !(B.terrainAt(c) && B.terrainAt(c).chasm) && !M.mobs.some(o => o !== m && o.cells.some(x => cellEq(x, c))))) return false; B.remove(m.cells); m.cells = cs; B.place({ kind: 'mob', n: m.n }, cs); return true; };
    // Rulebook Pushback X: the source itself "moves up to X spaces in the direction of the affected miniature, pushing it" — Mob sources too.
    const follow = async d => { if (!stepper) return mobShift(d); if (wn) { const c = { c: wn.cells[0].c + d.c, r: wn.cells[0].r + d.r }; if (!B.inside(c) || this.knightAt(c)) return false; await this.wnMoveTo(c, 'Pushback', [c]); return cellEq(wn.cells[0], c); } this._moveCrashed = this._moveCrashed || new Set(); const r = await this.monsterStep(d); if (g) B.place({ kind: 'mob', n: 'G' + g.n }, M.cells); return r === 'ok'; };
    const sideStep = async d => { const nextFp = M.cells.map(c => ({ c: c.c + d.c, r: c.r + d.r })); const free = B.neighbors(k.pos).filter(c => B.inside(c) && !B.isObstacle(c) && !(B.terrainAt(c) && B.terrainAt(c).chasm) && !this.knightAt(c) && !this.monsterOccupies(c) && !this.guardianAt(c) && !nextFp.some(x => cellEq(x, c))); if (!free.length) return false; const c = free.length === 1 ? free[0] : await this.ask({ type: 'move', knight: k.id, text: `${k.name}: Pushback — 막힘 → Displace할 칸 (몬스터가 이 칸으로 들어옴)`, cells: free, options: free.map(c => ({ label: B.label(c), value: c })) }) || free[0]; this.moveKnight(k, c); this.say(`${k.name}: Pushback 중 막힘 → ${B.label(c)}(으)로 Displace`); return true; };
    if (stepper) this.turnToward(k.pos);
    try {
      for (; steps < n && k.alive; steps++) {
        if (!mob && !k.onVP && !this.adjacentToMonster(k)) { // shortest path toward the Knight
          const dist = cs => B.distance(cs, [k.pos]); const cur = dist(M.cells); const opts = Object.values(DIRS).map(d => ({ d, cs: M.cells.map(c => ({ c: c.c + d.c, r: c.r + d.r })) })).filter(o => o.cs.every(c => B.inside(c)) && dist(o.cs) < cur).sort((a, b) => dist(a.cs) - dist(b.cs)); if (!opts.length) break; if (!await follow(opts[0].d)) break; this.turnToward(k.pos); continue; }
        if (!this.adjacentToMonster(k)) { if (!stepper && !M.cur) break; const dist = cs => B.distance(cs, [k.pos]); const cur = dist(M.cells); const opts = Object.values(DIRS).map(d => ({ d, cs: M.cells.map(c => ({ c: c.c + d.c, r: c.r + d.r })) })).filter(o => o.cs.every(c => B.inside(c)) && dist(o.cs) < cur).sort((a, b) => dist(a.cs) - dist(b.cs)); if (!opts.length || !await follow(opts[0].d)) break; this.turnToward(k.pos); continue; }
        const d = this.dirFromMonster(k.pos); const next = { c: k.pos.c + d.c, r: k.pos.r + d.r }; const inside = B.inside(next); const t = inside ? B.terrainAt(next) : null;
        if (!inside || (t && t.obstacle && !t.destructible)) {
          if (mob) { if (inside) { await this.crash(k); break; } if (!await sideStep(d)) break; moved++; continue; }
          const old = { ...k.pos }; if (!await sideStep(d)) { this.say(`${k.name}: Pushback — ${inside ? 'Indestructible Obstacle' : 'Board Edge'}에 막히고 Displace 불가 → 사망`, 'death'); await this.die(k, 'Pushback'); await follow(d); break; }
          moved++; if (!await follow(d)) break; this.turnToward(k.pos); continue; }
        if (t && t.obstacle && t.destructible) { this.destroyObstacle(next); this.say(`${k.name}: Pushback — ${B.label(next)}의 ${t.id} 파괴, Crash 후 계속`); await this.crash(k); if (!k.alive) break; }
        if (t && t.chasm) { this.moveKnight(k, next); if (await this.fx.gearUse(k, ['lifeline'], 'Chasm으로 이동 → 사망. Lifeline으로 Displace?')) { k._moved = false; await this.displace(k); break; } if (await this.stoneRock(k, 'Chasm')) break; await this.die(k, 'Chasm'); break; }
        if (this.isFen && this.guardianAt(next)) { this.say(`${k.name}: Doppelknight 위로 비자발적 이동 → Displace + Slimed`); await this.addCondition(k, 'Slimed'); break; }
        if (this.monsterOccupies(next) || this.guardianAt(next)) { if (mob) break; await this.crash(k); break; }
        const other = this.knights.find(o => o !== k && o.alive && !o.engulfed && !o.possessed && !o.onVP && cellEq(o.pos, next));
        if (other && mob) { this.say(`${k.name}: Pushback (Mob) — ${other.name}의 칸 앞에서 멈춤`); break; }
        this.moveKnight(k, next); moved++; trail.push(next); if (under) B.place({ kind: 'knight', id: under.id }, [under.pos]); under = other || null;
        if (!await follow(d)) break; // the source enters the space the pushed Knight left
      }
    } finally { await settle(); }

    this.say(`${k.name} Pushback ${moved}/${n}칸 → ${k.alive && k.pos ? B.label(k.pos) : '—'}${stepper ? ` (${g ? this.guardianName(g) : M.name} ${M.cells.map(c => B.label(c)).join('/')})` : ''}`);
    // "The affected miniature must resolve the effects of any Terrain tiles it moves through."
    if (k.alive) { const through = trail.slice(0, -1); await this.swampThrough(k, through.filter(c => B.terrainAt(c) && B.terrainAt(c).id === 'swamp')); for (const c of through) if (k.alive && B.terrainAt(c) && B.terrainAt(c).id === 'campfire') { this.say(`${k.name}: Campfire(${B.label(c)})를 지나감`); await this.campfireBurn(k); }
      if (k.alive && !this.fx.gearHas(k, 'ignoreRubble') && trail.some(c => B.terrainAt(c) && B.terrainAt(c).id === 'rubble')) { this.say(`${k.name}: Rubble 위로 비자발적 이동 → Knockdown`); await this.knockdown(k); } await this.involEnd(k, start); }
    if (stepper && !wn && !g) { await this.endMoveOnKnights(); }
  }
  async knockback(k, n, opts = {}) { if (!opts.unavoidable && k.alive && k.steady && await this.yesNo(`${k.name}: Knockback ${n} — Stalwart로 무시?`, true)) { this.say(`${k.name} Stalwart: Knockback 무시`); return; } if (!opts.unavoidable && k.alive && this.fx.gearAbilities(k, ['stalwart']).length && await this.fx.gearUse(k, ['stalwart'], `Knockback ${n} — Stalwart로 무시?`)) { this.say(`${k.name} Stalwart: Knockback 무시`); return; } return this.pushback(k, n, opts); }
  async displace(k) { if (k.engulfed) return; const B = this.board; const free = B.neighbors(k.pos).filter(c => !B.isObstacle(c) && !this.knightAt(c) && !this.monsterOccupies(c) && !this.guardianAt(c)); if (!free.length) { await this.die(k, 'Displace 불가'); return; } const dest = free.length === 1 ? free[0] : await this.ask({ type: 'move', knight: k.id, text: `${k.name} Displace — 칸 선택`, cells: free, options: free.map(c => ({ label: B.label(c), value: c })) }) || free[0]; this.moveKnight(k, dest); this.say(`${k.name} Displace → ${B.label(dest)}`); await this.swampSweep(); }
  moveKnight(k, cell) { k._moved = true; { const tr = this.board.terrainAt(cell); if (tr && tr.id === 'rut' && this.lastAttack && this.lastAttack.knight === k) this.lastAttack.rut = true; } this.board.remove([k.pos]); k.pos = cell; this.board.place({ kind: 'knight', id: k.id }, [cell]); if (k.hidden && this.monster && this.fx.inFrontOfMonster(k)) { k.hidden = false; this.say(`${k.name}: 몬스터 앞으로 이동 — Hidden 해제`); } }

  // ---------- Humpty Charge (Eggknight) ----------
  async humptyCharge(attacker) {
    const M = this.monster; const B = this.board;
    if (attacker && attacker.alive) this.turnToward(attacker.pos);
    const d = DIRS[M.facing]; let armorDiscarded = 0; const maxDiscard = M.hasTrait('Just a Scratch') ? 1 : 99;
    this.say(`Humpty Charge: ${M.facing} 방향으로 6칸 돌진`);
    for (let i = 0; i < 6; i++) {
      const r = await this.monsterStep(d, { charge: true });
      if (r === 'edge') {
        if (M.hasTrait('Hardboiled')) { await this.faceMostKnights(); this.say('Hardboiled: 가장자리에서 방향 전환 후 계속'); const d2 = DIRS[M.facing]; const r2 = await this.monsterStep(d2, { charge: true }); if (r2 !== 'ok') break; continue; }
        if (M.hasTrait('Humpty Fate')) { this.say('Humpty Fate: 가장자리 → 정지, Armor 토큰 1 상실'); await this.faceMostKnights(); if (armorDiscarded < maxDiscard) { await this.loseArmorToken('humptyCharge'); armorDiscarded++; } return; }
        break;
      }
      if (r === 'obstacle') { this.say('Humpty Charge: 장애물 → 정지, Armor 토큰 1 상실'); await this.faceMostKnights(); if (armorDiscarded < maxDiscard) { await this.loseArmorToken('humptyCharge'); armorDiscarded++; } return; }
      if (M.hasTrait('Just a Scratch') && this.monster.cells.some(c => { const t = B.terrainAt(c); return t && t.obstacle; })) { for (const c of this.monster.cells) { const t = B.terrainAt(c); if (t && t.obstacle && t.destructible) B.terrain.delete(B.key(c)); } }
    }
    await this.faceMostKnights(); await this.displaceKnightsUnderMonster();
  }
  async loseArmorToken(cause, { lowest = true, n = 1, noTrait = false } = {}) {
    for (let i = 0; i < n; i++) {
      const lv = [1, 2, 3].find(l => this.armorTokens[l] > 0); if (!lv) { this.say('Armor 토큰 없음'); return; }
      this.armorTokens[lv]--; this.say(`Panzeronion: BP${lv} Armor 토큰 -1 (남은 ${this.armorTokens[1]}/${this.armorTokens[2]}/${this.armorTokens[3]})`);
      if (this.monster.hasTrait('Jacked')) { this.jackedTokens++; this.say(`Jacked 토큰 ${this.jackedTokens}`); }
      if (cause === 'humptyCharge' && !noTrait && this.monster.hasTrait('Panzeronion')) { const g = this.mortis.Grave.draw(); if (g) { const cell = this.board.parse(g.marker.coord); this.say(`Grave Mortis ${g.name} → Column 배치 ${g.marker.coord}`); this.mortis.Grave.putBottom(g); await this.placeTerrain('column', cell); } }
    }
  }
  async placeTerrain(id, cell) {
    const B = this.board; const tdef = this.data.terrain.terrain.find(x => x.name.toLowerCase() === id); const t = { id, obstacle: tdef.keywords.includes('Obstacle'), obscuring: tdef.keywords.includes('Obscuring'), destructible: tdef.keywords.includes('Destructible') };
    const existing = B.terrainAt(cell); if (existing && !existing.destructible && existing.obstacle) { this.say('Indestructible 위 배치 불가 → 무시'); return; }
    if (this.monster.cells.some(c => cellEq(c, cell))) { this.say('몬스터 위 Destructible 배치 → 무시'); return; }
    const k = this.knightAt(cell); if (k) { await this.crash(k); this.say(`${k.name} 위 Column → 파괴됨(Crash)`); return; }
    const count = [...B.terrain.values()].filter(x => x.id === id).length; const total = this.monsterDef.clashSetup.requiredTiles[id] || 8;
    if (count >= total) { const tiles = [...B.terrain.entries()].filter(([, x]) => x.id === id).map(([key]) => { const [c, r] = key.split(',').map(Number); return { key, c, r, d: B.distance([{ c, r }], this.monster.cells) }; }).sort((a, b) => b.d - a.d); const far = tiles.filter(t => t.d === tiles[0].d); let pick = far[0]; if (far.length > 1) { const i = await this.ask({ type: 'pick', text: 'Column 회수 — 가장 먼 타일 동률, 선택', options: far.map((t, i) => ({ label: B.label(t), value: i })) }); pick = far[i] || far[0]; } B.terrain.delete(pick.key); this.say(`Column 전부 사용 중 → ${B.label(pick)} 회수`); }
    B.terrain.set(B.key(cell), t);
  }

  // ---------- Knight Round ----------
  async knightRound() {
    this.phase = 'knight'; this.say(`— 라운드 ${this.round}: Knight Round —`, 'phase');
    const acted = new Set(); this._nixie = false; const empty = () => this.knights.length - this.alive().length; if (this.isWN) await this.wnNixie(empty());
    while (true) {
      const avail = [...this.alive(), ...(this.isPz ? this.pzTurnKnights() : [])].filter(k => !acted.has(k.id)); if (!avail.length || this.result) break;
      let k = avail[0]; if (avail.length > 1) { const id = await this.ask({ type: 'pickKnight', options: avail.map(x => ({ label: x.possessed ? `${x.name} (빙의 — Signature)` : x.name, value: x.id })) }); k = this.knights.find(x => x.id === id) || avail[0]; }
      acted.add(k.id); if (k.possessed) { await this.guard(() => this.pzPossessedTurn(k)); continue; } await this.guard(() => this.knightTurn(k)); if (k._extraTurn && k.alive) { k._extraTurn = false; this.say(`${k.name}: 추가 턴`, 'turn'); await this.guard(() => this.knightTurn(k)); if (k.alive) { this.say(`${k.name}: 추가 턴 종료 → 사망`, 'death'); await this.guard(() => this.die(k, 'additional turn')); } } this.checkEnd(); if (this.isWN) await this.guard(() => this.wnNixie(acted.size + empty()));
    }
    for (const k of this.alive()) await this.guard(() => this.fx.endOfKnightRound(k));
    if (this.monster.isMob) { for (const k of this.knights) k.cestusLock = null; await this.guard(() => this.firstmenEndKnightRound()); await this.guard(() => this.icdEndKnightRound()); }
  }
  async knightTurn(k) { this._pzTurn = k;
    this.say(`▶ ${k.name} 턴 (V${k.vigor} H${k.heat}/${k.heatLimit} P${k.passion})`, 'turn'); k.turnsTaken++; k.cestusLock = null; if (this.monster.isMob) this.cestusCheck(k);
    // Knockdown handling
    const kd = k.conditions.find(c => /^Knockdown/.test(c.id));
    if (kd && kd.id === 'Knockdown (Standing Up)') { this.standUp(k); }
    k.steady = false; await this.renTurnStart(k); await this.karaTurnStart(k); await this.paraTurnStart(k); this.extrasTurnStart(k); await this.sonchTurnStart(k); await this.ubarTurnStart(k);
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) if (o.op === 'gateDiscardBane' && k.alive) { g.discarded = true; this.say(`${g.name}: ${o.gate} — 카드 버림, Bane ${o.n}`, 'tech'); await this.fx.runKnightOp({ op: 'bane', n: o.n }, k, {}); } } if (!k.alive) return; await this.fx.hideAtStartOfTurn(k);
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; if (this.fx.constKw(k, g).some(o => o.op === 'turnRevealMortis')) { const tops = Object.keys(this.mortis || {}).filter(t => this.mortis[t] && this.mortis[t].cards && this.mortis[t].cards.length).map(t => `${t}: ${this.mortis[t].cards[0].name}`); this.say(`${g.name}: Mortis 덱 맨 위 — ${tops.join(' · ')}`, 'tech'); } }
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) if (o.op === 'turnVigorBane' && k.alive) { k.gainVigor(o.v); this.say(`${g.name}: Start of your turn — Vigor +${o.v} (${k.vigor}), Bane ${o.n}`, 'tech'); await this.fx.runKnightOp({ op: 'bane', n: o.n }, k, {}); } else if (o.op === 'turnLoseVigor' && k.alive) { this.say(`${g.name}: Start of your turn — Vigor -${o.n}`, 'tech'); await this.fx.runKnightOp({ op: 'loseVigor', n: o.n }, k, {}); } }
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) if (o.op === 'turnBane' && k.alive) { this.say(`${g.name}: Start of your turn — Bane ${o.n}`, 'tech'); await this.fx.runKnightOp({ op: 'bane', n: o.n }, k, {}); } } if (!k.alive) return;
    const _h0 = k.heat; { const rsT = this.talentHas(k, 'unholyFurnace'); const rs = rsT ? { g: { name: 'Unholy Furnace' }, o: null } : this.fx.gearAbilities(k, ['refreshSwap'])[0]; const v = rs ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${rs.g.name} — Refresh 바꾸기`, options: [{ label: '사용 안 함', value: 'skip' }, { label: 'Card Refresh 대신 Heat Refresh (Heat Refresh 2회)', value: 'heat' }, { label: 'Heat Refresh 대신 Card Refresh (Card Refresh 2회)', value: 'card' }] }) : 'skip'; if (v === 'heat') { if (rs.o) this.fx.gearPay(k, rs.g, rs.o); k.refresh(() => []); k.heat = Math.max(0, k.heat - k.heatRefresh); } else if (v === 'card') { if (rs.o) this.fx.gearPay(k, rs.g, rs.o); const h = k.heat; k.refresh(cards => cards.slice(0, k.cardRefresh)); k.heat = h; await this.fx.runKnightOp({ op: 'refresh', n: k.cardRefresh }, k, {}); } else k.refresh(cards => cards.slice(0, k.cardRefresh)); } { const hx = this.fx.gearSum(k, 'heatRefreshExtra', { passive: true }); if (hx && k.heat > 0) { k.heat = Math.max(0, k.heat - hx); this.say(`${k.name}: Heat Refresh 추가 -${hx} (Gear)`, 'tech'); } } this.fx.heatRefreshPassion(k, _h0 - k.heat); this.say(`${k.name} Refresh: Heat ${k.heat}, 손패 ${k.hand.length}`);
    k.actions = { move: true, combat: true, extraCombat: 0 }; k.freeUsed = new Set();
    let done = false; if (k.engulfed) { await this.fenEngulfedTurn(k); done = true; }
    while (!done && k.alive) {
      const kdNow = k.conditions.find(c => c.id === 'Knockdown (Falling Down)');
      const opts = [];
      if (!kdNow) { if (k.actions.move) opts.push({ label: `이동 (Speed ${this.fx.speed(k)})`, value: 'move' }); if (k.actions.combat && this.fx.gearHas(k, 'combatAsMove')) opts.push({ label: `이동 — Combat action 사용 (Speed ${this.fx.speed(k)})`, value: 'moveC' }); if ((k.actions.combat || k.actions.extraCombat > 0) && this.canAttack(k)) opts.push({ label: '공격', value: 'attack' }); for (const t of this.fx.usableTechniques(k)) opts.push({ label: `기술: ${t.name} (${this.fx.costLabel(k, t)})`, value: 'tech:' + t.name }); for (const a of this.fx.freeActions(k)) opts.push({ label: a.label, value: 'free:' + a.id }); }
      else opts.push(...this.fx.usableTechniques(k).filter(t => t.ops.some(o => o.op === 'standUp')).map(t => ({ label: `기술: ${t.name}`, value: 'tech:' + t.name })));
      if (!kdNow && k.gear.some(g => g.exhausted && !g.discarded)) { if (k.actions.move) opts.push({ label: `Unexhaust — 이동 행동 사용 (${k.gear.filter(g => g.exhausted && !g.discarded).map(g => g.name).join(', ')})`, value: 'unex:move' }); if (k.actions.combat) opts.push({ label: 'Unexhaust — 전투 행동 사용', value: 'unex:combat' }); }
      opts.push({ label: '턴 종료', value: 'end' });
      const choice = opts.length === 1 ? 'end' : await this.ask({ type: 'action', knight: k.id, options: opts });
      if (choice === 'end') done = true;
      else if (choice.startsWith('unex:')) { k.actions[choice.slice(5)] = false; for (const g of k.gear) if (!g.discarded) g.exhausted = false; this.say(`${k.name}: ${choice.slice(5) === 'move' ? '이동' : '전투'} 행동으로 모든 장비 Unexhaust (p.21)`, 'tech'); }
      else if (choice === 'move') { await this.karaPreMove(k); await this.stoneMoveAction(k); await this.knightMove(k, this.fx.speed(k)); k.actions.move = false; await this.karaMoveAction(k); if (this.isKl) await this.klAfterMoveAction(k); }
      else if (choice === 'moveC') { await this.knightMove(k, this.fx.speed(k)); k.actions.combat = false; }
      else if (choice === 'attack') { if (k.actions.combat) k.actions.combat = false; else k.actions.extraCombat--; await this.knightAttack(k); }
      else if (choice.startsWith('tech:')) await this.fx.useTechnique(k, k.hand.find(t => t.name === choice.slice(5)));
      else if (choice.startsWith('free:')) await this.fx.doFreeAction(k, choice.slice(5));
      this.checkEnd(); await this.ubarDrain(k); await this.armedDrain();
    }
    // Drowning / Slimed: end of turn without moving
    for (const c of [...k.conditions]) { const def = this.conditionDefs[c.id]; const nm = def && def.ops && def.ops.endTurnNoMove; if (!nm || k.movedThisTurn) continue; if (/Slimed|Drowning/.test(c.id) && this.fx.gearHas(k, 'ignoreEndTurnCond')) { this.say(`${k.name}: ${c.id} 턴 종료 효과 무시 (Gear)`, 'tech'); continue; } if (nm === 'die') { this.say(`${k.name}: ${c.id} — 이동하지 않음 → 사망`, 'death'); await this.die(k, c.id); } else if (nm === 'flip' && def.flipSide) { c.id = def.flipSide; this.say(`${k.name}: ${def.name} — 이동하지 않음 → ${def.flipSide}`, 'cond'); } }
    await this.fx.hideAtEndOfTurn(k);
    this.renTurnEnd(k);
    k.moveBoost = 0;
    k.noUnwieldy = false; k.tempReach = 0; k.rangeDouble = false;
    k.turnSpeed = 0; for (const g of k.gear) { g._tempKw = null; g._tempTraits = null; }
    if (k._extraSlots == null) k._extraSlots = k.gear.some(g => this.fx.kwList(g).some(o => o.op === 'extraSlot')); await this.fx.slotCheck(k); k.swampFree = false; k._swampFreeNow = false; k._ignoreDifficult = false; k._devoteTech = null; k.terrainFree = false; k._terrainFreeNow = false;
    for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) if (o.op === 'endTurnNoCharge' && this.fx.chargesOf(g) <= 0 && k.alive) { this.say(`${g.name}: End of your turn — Charge 없음, Vigor -${o.n}`, 'tech'); await this.fx.runKnightOp({ op: 'loseVigor', n: o.n }, k, {}); } }
    if (!k.movedThisTurn && k.alive && this.fx.gearHas(k, 'takeRoot') && !k.rooted) { k.rooted = true; this.say(`${k.name}: Take Root — 이동할 때까지 Braced`, 'tech'); }
    k.movedThisTurn = false;
    // end of turn: Knockdown (Falling Down) → flip
    const kd2 = k.conditions.find(c => c.id === 'Knockdown (Falling Down)'); if (kd2) { kd2.id = 'Knockdown (Standing Up)'; this.say(`${k.name}: Knockdown → Standing Up (다음 턴 시작 시 일어남)`); }
    await this.fx.endOfTurn(k);
  }
  /** Devote (Rulebook p.68): "Gain a Devotion token." Tokens gained in the Clash go onto the Knight Sheet afterwards (they add to the Incarnation move). */
  devote(k) { k.devotionGained = (k.devotionGained || 0) + 1; this.say(`${k.name}: Devote — Devotion 토큰 +1`, 'tech'); }
  /** One d10 rolled by a Knight ("a [d10] you just rolled" effects such as Devil's Hand Charm may change it). */
  async d10For(k, label = 'd10') { const d = [{ v: this.rng.die(10) }]; if (k && k.alive) await this.fx.changeDieOffer(k, d, label); return d[0].v; }
  /** bonus: a Bonus Attack may use an exhausted Weapon. */
  canAttack(k, bonus = false) { if (this.fx.usableWeapons(k, bonus).some(w => this.attackTargets(k, w).length > 0)) return true; const r = this.fx.gearAbilities(k, ['atkReach'])[0], d = this.fx.gearAbilities(k, ['atkRangeDouble'])[0]; if (!r && !d) return false; const t0 = k.tempReach, d0 = k.rangeDouble; if (r) k.tempReach = Math.max(k.tempReach || 0, r.o.n); if (d) k.rangeDouble = true; try { return this.fx.usableWeapons(k, bonus).some(w => this.attackTargets(k, w).length > 0); } finally { k.tempReach = t0; k.rangeDouble = d0; } }
  reachable(k, speed) {
    const bl = Math.max(this.fx.gearHas(k, 'superiorBypass') ? 3 : 0, this.fx.gearHas(k, 'bypass') ? 2 : 0, k._bypass || 0, [...(k.delay || []), ...(k.cooldown || [])].some(t => t.name === 'Shadows Between Worlds') ? 2 : 0); const byp = bl > 0; const blT = k.terrainFree ? 3 : bl; const noDiff = !!k._ignoreDifficult; const thru = this.fx.gearHas(k, 'throughObstacles'); /* Ever-Sinking Stilts: ignore all Terrain tiles during this movement */ /* Bypass 1: through Knights · Advanced 2: through any miniature · Superior 3: also enter / end on Obstacles, ignore Difficult Terrain */ const diag = this.karaDiag(k); const B = this.board; const out = new Map(); const t0 = B.terrainAt(k.pos); const q = [{ cell: k.pos, d: t0 && t0.difficult ? 1 : 0 }]; /* starting a move on Difficult Terrain costs +1 (Q&A, owner reference 2026-11-15) */ const seen = new Set([B.key(k.pos)]);
    const jmax = this.knockedDown(k) ? 0 : (k._jump || 0); q[0].j = 0; const tileOf = c => { const t = B.terrainAt(c); return t ? `${t.tile || t.name || t.id}:${t.num != null ? t.num : ''}` : ''; }; seen.clear(); seen.add(B.key(k.pos) + ':0'); // Jump: ignore 1 space (Advanced Jump: up to 2) of a Terrain tile, including an Obstacle
    while (q.length) { const { cell, d, j, jc } = q.shift(); if (d >= speed) continue; for (const n of (diag ? B.zone([cell], 1).filter(z => !(z.c === cell.c && z.r === cell.r)) : B.neighbors(cell))) { const key = B.key(n); const obst = B.isObstacle(n); if (obst && blT < 3 && !thru && j >= jmax) continue; const occK = this.knightAt(n), occM = this.monsterOccupies(n); const occ = occK || occM; if ((occK && bl < 1) || (occM && bl < 2)) continue; const t = B.terrainAt(n); const jok = j < jmax && (!jc || (tileOf(jc) === tileOf(n) && B.adjacent(jc, n))); if (obst && blT < 3 && !thru && !jok) continue; const steps = obst ? ((blT >= 3 || thru) ? [[1, j]] : [[1, j + 1]]) : t && t.difficult ? (blT >= 3 || noDiff ? [[1, j]] : jok ? [[2, j], [1, j + 1]] : [[2, j]]) : [[1, j]]; for (const [cost, nj] of steps) { const sk = key + ':' + nj + (nj > j ? ':' + B.key(n) : jc ? ':' + B.key(jc) : ''); if (seen.has(sk) || d + cost > speed) continue; seen.add(sk); if (!occ && (!obst || blT >= 3)) out.set(key, n); q.push({ cell: n, d: d + cost, j: nj, jc: nj > j ? n : jc }); } } }
    return [...out.values()].filter(c => !(B.terrainAt(c) && B.terrainAt(c).id === 'swamp')); // ending a move on a Swamp kills → never offered as a destination
  }
  /** Cheapest path to `target` within `speed` that crosses the fewest Swamp spaces; returns the Swamp spaces moved through (destination excluded). */
  swampOnPath(k, target, speed) {
    const B = this.board; const key = c => B.key(c); const t0 = B.terrainAt(k.pos); const best = new Map([[key(k.pos), { s: 0, d: t0 && t0.difficult ? 1 : 0, via: [] }]]); let fr = [k.pos];
    while (fr.length) { const nx = []; for (const cell of fr) { const cur = best.get(key(cell)); for (const n of B.neighbors(cell)) { if (B.isObstacle(n) || this.knightAt(n) || this.monsterOccupies(n)) continue; const t = B.terrainAt(n); const d = cur.d + (t && t.difficult ? 2 : 1); if (d > speed) continue; const sw = t && (t.id === 'swamp' || t.id === 'campfire') && !cellEq(n, target); const s = cur.s + (sw ? 1 : 0); const old = best.get(key(n)); if (old && (old.s < s || (old.s === s && old.d <= d))) continue; best.set(key(n), { s, d, via: sw ? [...cur.via, n] : cur.via }); nx.push(n); } } fr = nx; }
    const r = best.get(key(target)); return r ? r.via : [];
  }
  armorGearDice(k) { let n = 0; for (const g of k.gear) if (!g.discarded && g.type === 'armor' && g.armorDice) for (const col in g.armorDice) n += g.armorDice[col]; return n; }
  /** Swamp: "When you move through this tile, roll a d10, +1 per Armor die on your Armor Gear. If the result is higher than your current Vigor, you die." */
  /** Campfire: moving through / ending on it → -1 Vigor per Metal Gear card, discard all Flammable Gear cards. */
  async campfireBurn(k) { const metal = k.gear.filter(g => !g.discarded && this.fx.gearTraits(k, g).includes('Metal')).length; const fl = k.gear.filter(g => !g.discarded && this.fx.gearTraits(k, g).includes('Flammable')); this.say(`${k.name}: Campfire — Metal Gear ${metal}장 → -${metal} Vigor${fl.length ? `, Flammable Gear 버림 (${fl.map(g => g.name).join(', ')})` : ''}`); for (const g of fl) g.discarded = true; if (metal) await this.loseVigor(k, metal, { source: 'effect', armor: false }); }
  async swampThrough(k, cells) { const noSw = this.fx.ignoresSwamp(k); for (const c of cells) { if (!k.alive) return; if (this.fx.gearHas(k, 'swampDrown') && this.board.terrainAt(c) && this.board.terrainAt(c).id === 'swamp') { this.say(`${k.name}: Swamp(${this.board.label(c)})를 지나감 → 익사 (Gear)`, 'death'); await this.die(k, 'Swamp'); return; } if (noSw && this.board.terrainAt(c) && this.board.terrainAt(c).id === 'swamp') continue; { const tt = this.board.terrainAt(c); if (tt && tt.id === 'campfire') { if (!k._terrainFreeNow) await this.campfireBurn(k); continue; } } let d = await this.d10For(k, 'Swamp'); const a = this.armorGearDice(k); if (d + a > k.vigor && this.fx.gearHas(k, 'swampReroll') && await this.yesNo(`${k.name}: Swamp d10 ${d}${a ? ' +' + a : ''} vs Vigor ${k.vigor} — 다시 굴리기 (Gear, 1회)?`, true)) { d = await this.d10For(k, 'Swamp 재굴림'); this.say(`Swamp 재굴림 → ${d}`, 'dice'); } const dead = d + a > k.vigor; this.say(`${k.name}: Swamp(${this.board.label(c)}) 통과 — d10 ${d}${a ? ` +${a} (Armor die)` : ''} = ${d + a} vs Vigor ${k.vigor} → ${dead ? '사망' : '통과'}`, dead ? 'death' : 'dice'); if (dead) await this.die(k, 'Swamp'); } }
  /** Swamp: "If you end your movement on this tile (voluntary or not), you die." Checked for every Knight that moved since the last sweep. */
  async swampSweep() { for (const k of this.knights) if (k._extraSlots) await this.fx.slotCheck(k); if (this.traps && this.traps.length) this.fx.trapCheck(this.monster.isMob ? this.monster.mobs.flatMap(m => m.cells) : this.monster.cells); for (const k of this.knights) { if (!k._moved) continue; k._moved = false; if (!k.alive) continue; if (this.fx.gearHas(k, 'moveEndBreak') && (this.monster.isMob ? this.adjacentMobs(k).length : this.adjacentToMonster(k))) { this.say(`${k.name}: 몬스터 옆에서 이동 종료 → Break 1 (Gear)`, 'tech'); this.poolAdd('break', 1); } const t = this.board.terrainAt(k.pos); if (t && t.id === 'campfire') { await this.campfireBurn(k); continue; } if (t && t.id === 'swamp' && this.fx.ignoresSwamp(k)) continue; if (t && t.id === 'swamp') { if (await this.fx.gearUse(k, ['lifeline'], 'Swamp에서 이동 종료 → 사망. Lifeline으로 Displace?')) { await this.displace(k); continue; } if (await this.stoneRock(k, 'Swamp')) continue; this.say(`${k.name}: Swamp(${this.board.label(k.pos)})에서 이동 종료 → 사망`, 'death'); await this.die(k, 'Swamp'); } } }
  async knightMove(k, speed) {
    const cells = this.reachable(k, speed); if (!cells.length) { this.say(`${k.name} 이동 불가`); return; }
    const target = await this.ask({ type: 'move', knight: k.id, cells, options: cells.map(c => ({ label: this.board.label(c), value: c })) });
    if (!target) return;
    // Drowning / Slimed: "When you're about to move voluntarily, roll [X Armor die] and all your Armor dice. For each [Potential] gain +1 Heat."
    for (const c of [...k.conditions]) { const def = this.conditionDefs[c.id]; const vr = def && def.ops && def.ops.voluntaryMoveRoll; if (!vr || typeof vr !== 'object') continue; const dice = this.fx.armorDice(k); dice[vr.extra] = (dice[vr.extra] || 0) + 1; const r = rollArmor(this.rng, dice, this.data.components.dice.faces, this.data.components.dice.armorSymbol); this.say(`${k.name} ${c.id}: Armor ${r.dice.length}d → ✦${r.mitigated} → Heat +${r.mitigated}`, 'cond'); if (r.mitigated) k.gainHeat(r.mitigated); }
    k.rooted = false; k.moveBoost = 0; k._swampFreeNow = !!k.swampFree; k.swampFree = false; k._terrainFreeNow = !!k.terrainFree; k.terrainFree = false; const start = k.pos; const sw = this.swampOnPath(k, target, speed); this.moveKnight(k, target); if (sw.length) await this.swampThrough(k, sw); if (!k.alive) return; this.say(`${k.name} 이동 → ${this.board.label(target)}`); k.movedThisTurn = true; k.tempSpeed = 0; await this.geyserKnight(k, start); if (this.monster.isMob) this.cestusCheck(k); if (k.tempSpeed) k.tempSpeed = 0;
    await this.swampSweep(); if (!k.alive) return; if (k._stoneDrag) { k._stoneDrag = false; await this.stoneDrag(k, start); }
    for (const c of [...k.conditions]) { const def = this.conditionDefs[c.id]; const on = def && def.ops && def.ops.onVoluntaryMove; if (on === 'flip' && def.flipSide) { c.id = def.flipSide; this.say(`${k.name}: ${def.name} → ${def.flipSide}`, 'cond'); } else if (on === 'discardSpeed') { this.removeCondition(k, c.id); k.tempSpeed = (k.tempSpeed || 0) + 1; this.say(`${k.name}: ${def.name} 제거, 임시 Speed +1`, 'cond'); } }
    const c = this.hasCondition(k, 'Knockdown (Standing Up)'); if (c) this.standUp(k);
  }

  // ---------- Knight Attack (pp.56–62) ----------
  async knightAttack(k, opts = {}) { this._slowSteps = null; this._stopMove = false; const atk0 = this._atkK; this._atkK = k; k.tempPrecision = k.tempPrecisionNext || 0; k.tempPrecisionNext = 0; let r; try { r = await (this.asBoss ? this.asBoss(() => this._knightAttack(k, opts)) : this._knightAttack(k, opts)); } finally { this._atkK = atk0; await this.trophyFlush(); k.tempReach = 0; k.rangeDouble = false; } if (k._bonusPending && k.alive) { k._bonusPending = false; if (this.canAttack(k, true)) { this.say(`${k.name}: Bonus Attack (Gear)`, 'tech'); await this.knightAttack(k, { bonus: true }); } } return r; }
  async _knightAttack(k, { bonus = false, weapon = null, techOp = null } = {}) {
    { const ws = weapon ? [weapon] : this.fx.usableWeapons(k, bonus); const isR = w => this.fx.kwList(w).some(o => o.op === 'ranged' && o.status === 'ok'); if (ws.some(w => !isR(w))) { const o = await this.fx.gearUse(k, ['atkReach'], '공격 직전 — 이번 근접 공격에 Reach 얻기?'); if (o) k.tempReach = Math.max(k.tempReach || 0, o.n); } if (ws.some(isR)) { const o = await this.fx.gearUse(k, ['atkRangeDouble'], '공격 직전 — 이번 Ranged 공격의 최대 사거리 2배?'); if (o) k.rangeDouble = true; } }
    let weapons = weapon ? [weapon] : this.fx.usableWeapons(k, bonus); { const inR = weapons.filter(w => this.attackTargets(k, w).length); if (inR.length) weapons = inR; else if (weapons.length) { this.say(`${k.name}: ${bonus ? 'Bonus Attack' : '공격'} 불가 — 사용할 수 있는 Weapon의 사거리 안에 대상이 없음`, 'warn'); return; } }
    if (!weapons.length && k.knighvesReserve && !k.gear.some(g => g.type === 'weapon' && !g.discarded)) { k.gear.push(k.knighvesReserve); weapons.push(k.knighvesReserve); k.knighvesReserve = null; this.say(`${k.name}: 무기를 잃어 Knighves 장착`); }
    if (!weapons.length) { this.say(`${k.name}: 사용 가능한 무기 없음`); return; }
    let w = weapons[0]; if (weapons.length > 1) { const wn = await this.ask({ type: 'weapon', knight: k.id, options: weapons.map(g => ({ label: `${g.name} (⚔${g.attackDice} +${g.precision})`, value: g.name })) }); w = weapons.find(g => g.name === wn) || weapons[0]; }
    if (bonus && w.exhausted) w.exhausted = false;
    let guardian = null; if (!this.monster.isMob && this.guardians && this.guardians.length) { const tg0 = this.attackTargets(k, w); const adjG = tg0.filter(x => x !== 'boss'); const canTroll = tg0.includes('boss'); if (adjG.length) { const opts = [...(canTroll ? [{ label: this.monster.name, value: 'T' }] : []), ...adjG.map(g => ({ label: `${this.guardianName(g)} (${this.board.label(g.cells[0])})`, value: 'G' + g.n }))]; const v = opts.length > 1 ? await this.ask({ type: 'pick', text: `${k.name}: 공격 대상`, options: opts }) : opts[0].value; if (v !== 'T') guardian = adjG.find(g => 'G' + g.n === v) || adjG[0]; } }
    let mobTarget = null; if (this.monster.isMob) { mobTarget = await this.pickMob(this.attackTargets(k, w), `${k.name}: 공격할 Mob 선택`); if (!mobTarget) { this.say(`${k.name}: 인접한 Mob 없음`); return; } this.monster.cur = mobTarget; const hop = this.revealedAura('hoplomachus').find(h => h !== mobTarget && this.inZoneOf(h, mobTarget)); if (hop) { this.say(`Hoplomachus: Zone 2 안의 다른 Monster 공격 → ${k.name} Vigor -2`); await this.loseVigor(k, 2, { source: 'effect', armor: false }); if (!k.alive) return; } }
    const A = { knight: k, weapon: w, bonus, mob: mobTarget, guardian, hits: 0, critChance: false, bp: null, totalPower: 0, wounded: false, critical: false, ignoreResponses: false, extraPool: { red: 0, black: 0, white: 0, raw: 0 }, powerRerolls: 0, armorPiercing: 0, techOp }; { const tr = this.board.terrainAt(k.pos); if (tr && tr.id === 'rut') A.rut = true; } { const ms = (A.kw || []).find(o => o.op === 'magicSwap'); if (ms && this.poolCount('magic') >= ms.n && await this.yesNo(`${k.name}: ${w.name} — Magic 토큰 ${ms.n}개를 써서 Opening을 Cantrip으로?`, false)) { for (let i = 0; i < ms.n; i++) { const j = this.pool.findIndex(t => t.token === 'magic'); if (j >= 0) this.pool.splice(j, 1); } A.kw = A.kw.map(o => o.op === 'token' && o.token === 'opening' ? { ...o, token: 'cantrip' } : o); this.say(`${w.name}: Magic ${ms.n} → Opening이 Cantrip으로`, 'tech'); } } this.lastAttack = A;
    this.currentKnightAttack = A; this.say(`${k.name} 공격 선언 — ${w.name}${bonus ? ' (Bonus Attack)' : ''}`, 'atk');
    const kc = this.hasCondition(k, 'Knockdown (Standing Up)'); if (kc) this.standUp(k);
    // Commit
    if ((this.fx.weaponHas(w, 'commit') || (w._primate && k.form === 'human')) && !this.fx.constKw(k, w).some(o => o.op === 'losesCommit') && !(w.hands === 2 && k.gear.some(x => x !== w && !x.discarded && !x.exhausted && this.fx.kwList(x).some(o => o.op === 'twoHandLose')))) { k.gainHeat(1); this.say(`Commit: Heat +1 (${k.heat})`); }
    // 2. Passion + priority target
    k.gainPassion(1); if ((!this.priorityTarget || k.passion > this.priorityTarget.passion) && !(this.priorityTarget && this.priorityTarget.alive && this.fx.gearHas(this.priorityTarget, 'keepPriority'))) { this.priorityTarget = k; }
    await this.fx.beforeAttack(k, A);
    // 3. Attack roll
    let dice = (parseInt(w.attackDice, 10) || 0) + this.fx.extraAttackDice(k, w, A); { const ck = this.fx.constKw(k, w); const di = ck.find(o => o.op === 'attackDiceInstead'); if (ck.some(o => o.op === 'powerHitCap')) A.powerHitCap = parseInt(w.attackDice, 10); if (di) { dice = dice - parseInt(w.attackDice, 10) + di.n; this.say(`${w.name}: ${di.gate} — 공격 주사위 ${di.n}개`, 'tech'); } } let prec = (Number(w.precision) || 0) + this.fx.precision(k) + (A.extraPrecision || 0) + (this.fx.gearHas(k, 'noOpening') || (A.flags && A.flags.has('noOpening')) ? 0 : this.poolCount('opening')) + this.poolCount('closing') + (this.monster.isMob ? this.mobAura('knightPrecision') : 0) + this.hauntPrecision(k) + (!A.guardian && !k.engulfed && (!this.monster.isMob || (A.mob && A.mob.isTroll)) && this.inBlindspot(k) ? 1 : 0);
    if (A.ubar && A.ubar.autoHit && dice > 1) { dice -= 1; A.autoHits = (A.autoHits || 0) + 1; A.ubar.autoHit = 0; this.say('Skull Crack: Attack die 1개를 따로 두고 자동 명중으로 처리', 'tech'); }
    if (!this.fx.has(k, 'deadly') && await this.fx.gearUse(k, ['deadlyPaid'], '공격 직전 — 이번 공격에 Deadly 얻기?', false)) A.deadlyPaid = true;
    const roll = rollD10s(this.rng, dice); if (this.isBw && this.bwHexed(k, 'Bog Cursed')) { roll.dice[0].v = 1; this.say(`${k.name}: Bog Cursed — Crit die는 굴리지 않고 1로 취급`, 'bp'); } const tt = !A.guardian ? this.trollToHit() : { bonus: 0, fullMiss: false }; const toHit = A.guardian ? this.guardianToHit(A.guardian) : this.monster.toHit + this.monster.modifiers.toHit + (this.isPz ? this.pzToHit(k, A) : 0) + this.hauntToHit() + tt.bonus + (this.isWN ? this.wnToHit(k) : 0) + (this.isYdd ? this.yddToHit(k, A) : 0) + (this.monster.isMob && A.mob ? this.firstmenToHit(A.mob) : 0); if (tt.bonus) this.say(`Firstmen Guardians: 인접 Guardian ${tt.bonus} → To Hit +${tt.bonus}${tt.fullMiss ? ' · 4+ → 모든 Attack Roll Full Miss' : ''}`); if (tt.fullMiss) for (const d of roll.dice) d.v = 1;
    const critSafe = this.fx.constKw(k, w).some(o => o.op === 'critOnlyMiss'); const swTH = this.fx.gearSum(k, 'swampToHit'); const swOn = swTH && (A.guardian ? A.guardian.cells : A.mob ? A.mob.cells : this.monster.cells).some(c => { const t = this.board.terrainAt(c); return t && t.id === 'swamp'; }) ? swTH : 0; if (swOn) this.say(`Swamp 위의 몬스터: To Hit -${swOn} (Gear)`, 'tech');
    const nth = this.negToHit || 0; if (nth) { this.negToHit = 0; this.say(`임시 To Hit -${nth} 토큰 적용 후 버림`, 'tech'); }
    const isHit = d => d.v === 10 ? true : d.v === 1 ? false : (critSafe && d === roll.dice[0]) ? true : d.v + prec >= toHit - swOn - nth;
    this.say(`${k.name} Attack Roll ${dice}d → [${roll.dice.map(d => d.v).join(' ')}] (재굴림 전)`, 'dice'); await this.fx.attackRollPre(k, A, roll, isHit);
    prec = (Number(w.precision) || 0) + this.fx.precision(k) + (A.extraPrecision || 0) + (this.fx.gearHas(k, 'noOpening') || (A.flags && A.flags.has('noOpening')) ? 0 : this.poolCount('opening')) + this.poolCount('closing') + (this.monster.isMob ? this.mobAura('knightPrecision') : 0) + this.hauntPrecision(k);
    let misses = roll.dice.filter(d => !isHit(d));
    const critD = roll.dice.find(d => d.crit) || roll.dice[0]; const falsOK = !!(critD && !critD.rerolled && (A.falsity || (A.kw || []).some(o => o.op === 'falsity'))); // Falsity: the Crit die may be re-rolled without Heat (Zeal 1 if it was already a hit)
    if (falsOK || (misses.length && (k.heat < k.heatLimit || this.poolCount('closing') || (A.attackRerolls || 0) > 0 || (this.fx.gearHas(k, 'vigorReroll') && k.vigor > 1)))) {
      const freeAR = A.attackRerolls || 0; const maxR = Math.min(misses.length + (falsOK && isHit(critD) ? 1 : 0), (k.heatLimit - k.heat) + this.poolCount('closing') + freeAR + (falsOK ? 1 : 0) + (this.fx.gearHas(k, 'vigorReroll') ? Math.max(0, k.vigor - 1) : 0));
      const picked = await this.ask({ type: 'dice', knight: k.id, text: `${k.name} Attack ${dice}d vs ${toHit}+ (보너스 +${prec}) — 재굴림 (Attack Re-roll ${freeAR}개 · Closing ${this.poolCount('closing')}개 무료, 이후 Heat +1/개${falsOK ? ' · Falsity: Crit die(★)는 Heat 없이 재굴림, 이미 명중이면 Zeal 1' : ''})`, dice: roll.dice.map(d => ({ v: d.v, crit: d.crit, hit: isHit(d), canReroll: !d.rerolled && !(this.isBw && d === roll.dice[0] && (this.bwHexed(k, 'Swamp-jinxed') || this.bwHexed(k, 'Bog Cursed'))) })), max: maxR });
      if (picked && picked.length) { const fUsed = falsOK && picked.includes(roll.dice.indexOf(critD)); const cnt = picked.length - (fUsed ? 1 : 0); if (fUsed) { this.say('Falsity: Crit die 재굴림 (Heat 없음)', 'tech'); if (isHit(critD)) this.gainZeal(k, 1, 'Falsity — 이미 명중인 Crit die 재굴림'); } const ar = Math.min(cnt, freeAR); A.attackRerolls = freeAR - ar; if (ar) this.say(`Attack Re-roll ${ar}개 (무료)`); const free = Math.min(cnt - ar, this.poolCount('closing')); this.poolTake('closing', free); const paid = cnt - ar - free; if (paid) await this.fx.payRerolls(k, paid); for (const i of picked) { const d = roll.dice[i]; d.v = this.rng.die(10); d.rerolled = true; } }
    }
    await this.fx.attackRollGear(k, A, roll, isHit); await this.paraAfterAttackRoll(k, A, roll, isHit); this.ubarAfterAttackRoll(k, A, roll, isHit); await this.karaAfterAttackRoll(k, A, roll, isHit, toHit, prec);
    if (A.mob && A.mob.revealed && A.mob.card.ops.aura && A.mob.card.ops.aura.retiarius && A.mob.generic > 0) { A.mob.generic--; prec -= 2; for (const d of roll.dice) { d.v = this.rng.die(10); d.rerolled = true; } this.say(`Retiarius: Generic 토큰 버림 → Attack Roll 다시 (-2 Precision): [${roll.dice.map(d => d.v).join(' ')}]`, 'dice'); }
    if (this.isFen && roll.dice[0].v === 1) { this.say(`${k.name} Crit Miss`); await this.fenCritMiss(k); }
    A.hits = roll.dice.filter(isHit).length + (A.autoHits || 0); A.critChance = roll.dice[0].v === 10 || ((this.fx.has(k, 'deadly') || A.deadlyPaid) && roll.dice[0].v >= 9); if (A.tdWCrit) A.critChance = true; if (A.critChance && this.isBw && this.bwHexed(k, 'Quagmire of Misfortune')) { A.critChance = false; this.say(`${k.name}: Quagmire of Misfortune — Crit Chance를 얻을 수 없음`, 'bp'); }
    this.flash('dice', { title: `${k.name} Attack Roll ${toHit}+ (+${prec})`, dice: roll.dice.map(d => ({ v: d.v, ok: isHit(d), crit: d.crit })), sub: `명중 ${A.hits}/${dice}${A.critChance ? ' ★Crit Chance' : ''}`, cls: A.hits ? 'good' : 'bad' });
    this.say(`${k.name} Attack Roll ${dice}d vs ${toHit}+ (+${prec}) → [${roll.dice.map(d => d.v + (d.rerolled ? '*' : '')).join(' ')}] 명중 ${A.hits}/${dice}${A.critChance ? ' ★Crit Chance' : ''}`, 'dice');
    if (A.hits === 0) { this.say(`${k.name} Full Miss`); await this.stoneFullMiss(k, A); await this.fx.onFullMiss(k, A); if (!A.keepPool) this.clearPool(); await this.paraFullMiss(k, A); /* rulebook p.57: a Full Miss goes straight to step 9, activates "Full Miss" abilities and ends the Attack — no second ability window */ this.currentKnightAttack = null; return; }
    if (A.hits === dice) await this.fx.onFullHit(k, A);
    // 4. first ability window (a Chain Break here ends the attack: clear pool + second window, p.54)
    await this.fx.afterHits(k, A, roll.dice.length);
    await this.fx.sacrificeWindow(k, A);
    try { await this.fx.firstWindow(k, A); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); this.clearPool(); await this.fx.secondWindow(k, A); this.currentKnightAttack = null; return; }
    // 5. determine BP
    if (this.monster.isMob && !this.monster.mobs.includes(A.mob)) { this.say('대상 Mob이 이미 없음'); this.clearPool(); this.currentKnightAttack = null; return; }
    if (this.isLh && A.mob && A.mob.decoying && await this.lhDecoyHit(k, A) === 'routine') { this.clearPool(); await this.fx.secondWindow(k, A); this.currentKnightAttack = null; return; }
    let bp = A.guardian ? this.guardianBP(A.guardian) : this.monster.isMob ? A.mob.card : (this.isBw && await this.bwTalisman(k), await this.extrasDrawBP(k)); if (this.monster.isMob) await this.revealMob(A.mob); if (!bp) { this.say('BP 덱 비어 있음'); this.currentKnightAttack = null; return; }
    if (!this.monster.isMob && !A.guardian && !bp.isThickSkin && this.monster.bp.discard.length && (A.flags.has('precise') ? await this.yesNo(`${k.name}: BP ${bp.name} 대신 버림 더미 맨 위 ${this.monster.bp.discard.at(-1).name}을(를) 공격 (Precise)?`, false) : await this.fx.gearUse(k, ['precise'], `BP ${bp.name} 대신 버림 더미 맨 위 ${this.monster.bp.discard.at(-1).name}을(를) 공격 (Precise)?`))) { const top = this.monster.bp.discard.pop(); this.monster.bp.cards.push(bp); this.monster.bp.shuffle(); bp = top; this.say(`Precise: 버림 더미의 ${bp.name} 공격, 뽑은 카드는 덱에 섞음`); }
    await this.fx.arcAt(k, A, 'bp');
    if (!this.monster.isMob && !A.guardian && A.flags.has('soulseeker')) { const alts = [bp]; for (let i = 0; i < 2; i++) { const c = this.monster.drawBP(); if (c) alts.push(c); } if (alts.length > 1) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Soulseeker — 공격할 BP`, options: alts.map((c, i) => ({ label: `${c.name} (AT ${this.bpAT(c)})`, value: i })) }); const chosen = alts[v] || alts[0]; this.monster.bp.cards.push(...alts.filter(c => c !== chosen)); this.monster.bp.shuffle(); bp = chosen; this.say(`Soulseeker: ${alts.length}장 중 ${bp.name} 선택, 나머지는 덱에 섞음`, 'tech'); } A.flags.delete('heartseeker'); }
    else if (!this.monster.isMob && !A.guardian && this.fx.has(k, 'heartseeker', A)) { const alt = this.monster.drawBP(); if (alt) { const pick = await this.ask({ type: 'heartseeker', options: [bp, alt].map(c => ({ label: `${c.name} (AT ${this.bpAT(c)})`, value: c.name })) }); const chosen = [bp, alt].find(c => c.name === pick); const other = chosen === bp ? alt : bp; this.monster.bp.cards.unshift(other); bp = chosen; } }
    A.bp = bp; this.lastBP = bp; if (this.multiBPActive(A) && A.overwhelm) this.say('Power Overwhelming: BP를 뒷면으로 뽑음', 'bp'); else { this.say(`BP ${bp.level}: ${bp.name} (AT ${this.bpAT(bp)})`, 'bp'); this.flash('card', { title: `BP ${bp.level}`, name: bp.name, text: `AT ${this.bpAT(bp)}`, cls: 'bp' }); } if (this.multiBPActive(A) && A.double) { const c2 = this.monster.drawBP(); if (c2) { A.extraBPs = [...(A.extraBPs || []), { bp: c2, power: null }]; this.say(`Doublestrike Enchantment: 추가 BP ${c2.level}: ${c2.name} (AT ${this.bpAT(c2)})`, 'bp'); } A.double = false; }
    // Ultrainstinct (Impenetrable Shell)
    if (!A.critChance && this.monster.hasTrait('Impenetrable Shell') && this.armorTokens[bp.level] > 0 && this.frontCells().some(c => cellEq(c, k.pos))) { this.say('Ultrainstinct: Impenetrable Shell → Knockback 1'); await this.pushback(k, 1); }
    if ((this.isKe && !A.guardian && await this.keUltra(k, A, bp)) || (this.isBw && !A.guardian && await this.bwMayEnd(k, A, bp))) { this.monster.discardBP(bp); this.currentKnightAttack = null; await this.afterAction(); return; }
    if (this.isDevil) await this.dvBargainOffer(k, A, bp); if ((!A.guardian || bp.pvKind) && bp.ops) { if (this.isYdd) this.yddReveal(k, A, bp); if (bp.ops.reveal) await this.fx.runMonsterOps(bp.ops.reveal, { attacker: k, attack: A }); if (bp.ops.ultrainstinct && !(this.dg && this.dg.flags.noUltra)) { this.say('Ultrainstinct Response'); await this.fx.runMonsterOps(bp.ops.ultrainstinct, { attacker: k, attack: A }); } } if (A.pvChain && k.alive) { if (!A.guardian) this.monster.discardBP(bp); this.clearPool(); this.currentKnightAttack = null; if (A.pvChain !== 'end') await this.pvOp({ op: 'pvAI' }, { attacker: k }); await this.afterAction(); return; } if (!k.alive) { this.monster.discardBP(bp); this.clearPool(); this.currentKnightAttack = null; return; }
    await this.fx.arcAt(k, A, 'power');
    // 6. power roll
    const TIERS = ['red', 'black', 'white']; const kd = TIERS[Math.min(2, TIERS.indexOf(k.powerDie) + (A.promote || 0))]; if (A.promote) this.say(`Power Dice Promotion: Knight Power die ${k.powerDie} → ${kd}`);
    const wpOf = col => { const p = w.weaponPower; if (!p) return 0; if (Array.isArray(p.dice)) return p.dice.filter(c => c === col).length; if (p.dice && typeof p.dice === 'object') return p.dice[col] || 0; return p.colour === col ? p.n : 0; }; // weapon power per hit, mixed colours supported
    const pHits = A.powerHitCap ? Math.min(A.hits, A.powerHitCap) : A.hits; if (pHits < A.hits) this.say(`Power Pool은 명중 ${pHits}개까지만 계산`);
    const pool = buildPowerPool({ red: wpOf('red') * pHits + (kd === 'red' ? (k.powerDice || 1) : 0) + A.extraPool.red, black: wpOf('black') * pHits + (kd === 'black' ? (k.powerDice || 1) : 0) + A.extraPool.black, white: wpOf('white') * pHits + (kd === 'white' ? (k.powerDice || 1) : 0) + A.extraPool.white, raw: (w.bonusPower && w.bonusPower.raw ? w.bonusPower.raw : 0) + A.extraPool.raw }, this.data.components.dice.limits);
    if (w.bonusPower && w.bonusPower.colour) pool[w.bonusPower.colour] += w.bonusPower.n;
    const pr = rollPowerPool(this.rng, pool, this.data.components.dice.faces);
    this.say(`Power Roll ${pr.dice.map(d => d.colour[0]).join('')} +raw${pool.raw} → ⚔${pr.power} ✦${pr.potential} 🕊${pr.hope}`, 'dice');
    await this.fx.exertWindow(k, A, `Power Roll 후, 재굴림 전 — ${pr.dice.map(d => d.colour[0].toUpperCase() + ':' + ('⚔'.repeat(d.face.P || 0) + '✦'.repeat(d.face.T || 0) + '🕊'.repeat(d.face.H || 0) || '—')).join(' ')}${pool.raw ? ' +⚔' + pool.raw : ''} vs AT ${this.bpAT(bp)}`);
    // power re-rolls (Heroic Arc / tokens)
    let rerolls = A.powerRerolls + this.poolCount('black');
    if (rerolls && pr.dice.length) { const face = f => `${'⚔'.repeat(f.P || 0)}${'✦'.repeat(f.T || 0)}${'🕊'.repeat(f.H || 0)}` || '—'; const picked = await this.ask({ type: 'dice', knight: k.id, text: `Power 재굴림 가능 ${rerolls}개 (Black 토큰 ${this.poolCount('black')} 포함)`, dice: pr.dice.map(d => ({ v: face(d.face), colour: d.colour, hit: !!d.face.P, canReroll: true })), max: rerolls }); if (picked && picked.length) { const fromBlack = Math.max(0, picked.length - A.powerRerolls); this.poolTake('black', fromBlack); for (const i of picked) pr.dice[i].face = this.rng.pick(this.data.components.dice.faces[pr.dice[i].colour]); this.say(`재굴림 ${picked.length} → ⚔${pr.dice.reduce((a, d) => a + (d.face.P || 0), 0) + pool.raw}`);
        // Black: the re-roll is optional, and so is turning 1 ✦ on a die re-rolled this way into ⚔ (owner ruling 2026-11-03)
        let blackLeft = fromBlack; for (const i of picked) { if (blackLeft <= 0) break; const f = pr.dice[i].face; if (!(f.T > 0)) continue; if (await this.yesNo(`Black: 재굴림한 ${pr.dice[i].colour} 주사위(${face(f)})의 ✦1 → ⚔1?`, true)) { pr.dice[i].face = { ...f, T: f.T - 1, P: (f.P || 0) + 1 }; blackLeft--; this.say('Black: ✦ → ⚔'); } } } }
    let power = pr.dice.reduce((a, d) => a + (d.face.P || 0), 0) + pool.raw; let potential = pr.dice.reduce((a, d) => a + (d.face.T || 0), 0) + pool.potential; if (this.isPz) potential = this.pzPotential(k, A, pr.dice, potential); if (this.isKl) potential = this.klPotential(k, potential); if (this.isBw && k._bwIgnorePower && power > 0) { power -= 1; this.say(`${k.name}: Beast of the Swamp — Power 1 무시`, 'bp'); } const hope = pr.dice.reduce((a, d) => a + (d.face.H || 0), 0);
    // potentials → power via Break / Sunder / Hope / Fire tokens
    // Break / Sunder / Hope are mandatory: every token converts while symbols remain (owner ruling 2026-11-03).
    // When ✦ are too few for both Sunder and Break, the player chooses how many go to Sunder (the rest to Break).
    let useS = 0, useB = 0, useH = 0; const nS = this.poolCount('sunder'), nB = this.poolCount('break');
    if (potential && (nS || nB)) {
      if (nS && nB && potential < nS + nB) { const lo = Math.max(0, potential - nB), hi = Math.min(potential, nS); useS = lo === hi ? lo : await this.ask({ type: 'number', knight: k.id, text: `✦${potential}개에 Sunder ${nS} / Break ${nB} — Sunder(✦1→⚔2)에 쓸 개수 (나머지는 Break)`, default: hi, options: Array.from({ length: hi - lo + 1 }, (_, i) => ({ label: String(lo + i), value: lo + i })) }); useB = Math.min(nB, potential - useS); }
      else { useS = Math.min(nS, potential); useB = Math.min(nB, potential - useS); }
      power += 2 * useS + useB; potential -= useS + useB; this.poolTake('sunder', useS); this.poolTake('break', useB);
      if (useS) this.say(`Sunder 토큰 ${useS}개 사용 (✦ → ⚔⚔)`); if (useB) this.say(`Break 토큰 ${useB}개 사용 (✦ → ⚔)`);
    }
    if ((potential || hope) && this.poolCount('hope')) { useH = Math.min(potential + hope, this.poolCount('hope')); const onT = Math.min(useH, potential); power += useH; potential -= onT; this.poolTake('hope', useH); this.say(`Hope 토큰 ${useH}개 사용 (✦/🕊 → ⚔)`); }
    A.hadFire = this.poolCount('fire') > 0;
    // Fire: other tokens may be used first, then as many Fire tokens as possible are mandatory (p.19)
    if (potential > 0 && this.poolCount('fire')) { const n = Math.min(potential, this.poolCount('fire')); power += n; potential -= n; this.poolTake('fire', n); this.say(`Fire 토큰 ${n}개 사용 (✦ → ⚔)`); }
    power += this.poolCount('power'); this.poolTake('power', 99);
    if (this.multiBPActive(A) && A.overwhelm) power = await this.overwhelmDistribute(k, A, power, bp); A.totalPower = power; const ignArm = A.ignoreArmor ? Math.min(A.ignoreArmor, this.fx.attackArmorOn(A, bp)) : 0; if (ignArm) this.say(`Armor 토큰 ${ignArm}개 무시 → AT -${ignArm}`, 'tech'); const neg = this.negAT || 0; if (neg) { this.say(`임시 AT -${neg} 토큰 적용 후 버림`, 'tech'); this.negAT = 0; } let at = this.bpAT(bp) - A.armorPiercing - neg - ignArm; if (A.baseATOnly && typeof bp.at === 'number') at = Math.min(at, bp.at - A.armorPiercing - neg); if (this.isWN && this.wnEndure) { this.say(`Endure: 임시 AT +${this.wnEndure} 적용 후 제거`); this.wnEndure = 0; }
    this.flash('power', { title: `${k.name} Power Roll vs AT ${at}`, dice: pr.dice.map(d => ({ colour: d.colour, face: d.face })), raw: pool.raw, sub: `Total Power ${power} → ${power >= at ? (A.critChance ? '★ Critical Wound' : 'Wound!') : 'Fail'}`, cls: power >= at ? 'good' : 'bad' });
    this.say(`Total Power ${power} vs AT ${at}${useB ? ` (Break ${useB})` : ''}${useS ? ` (Sunder ${useS})` : ''}`, 'dice');
    // 6.5 resolve
    const stack2 = !!(A.guardian && A.guardian.isDopp && A.guardian.cards.length > 1); A.wounded = stack2 ? power > at : power >= at; if (A.wounded && this.isPz && this.pzCannotWound(A)) A.wounded = false; if (A.wounded && this.isSm && this.smImpervious(A)) A.wounded = false; if (A.wounded && this.isKe && this.keFeral(A)) A.wounded = false; if (this.isLh) this.lhAttach(A); if (A.wounded && A.mob && A.mob.isPump && A.mob.side === 'sapling' && !A.hadFire && this.monster.hasTrait('Controlled Burn')) { A.wounded = false; this.say('Controlled Burn: Knight Pool에 Fire 토큰이 없어 Sapling을 Wound할 수 없음 → Fail', 'bp'); } if (stack2) this.say(`Concentrated Strength: Total Power가 두 BP의 합산 AT ${at}를 초과해야 Wound (${power > at ? '초과' : '미달'})`); if (A.wounded && A.mob && A.mob.revealed && A.mob.card.ops.aura && A.mob.card.ops.aura.murmillo && A.mob.generic > 0) { A.mob.generic--; A.wounded = false; this.say('Murmillo: Generic 토큰 버림 → Wound 대신 Fail', 'bp'); } A.critical = A.wounded && A.critChance; if (A.wounded && A.guardian && A.guardian.isDopp && A.guardian.cards.length > 1) A.critical = true; A.overAT = power - at;
    if (A.wounded && k._devoteTech) { const t = k._devoteTech; k._devoteTech = null; if (await this.yesNo(`${k.name}: ${t.name} — 이 Rush에서 Wound: 카드를 Discard하고 Devote?`, true)) { t._depletion = 'discard'; this.devote(k); } }
    const ops = bp.ops;
    if (A.wounded) this.say(`${A.critical ? '★ Critical Wound' : 'Wound'}!`, 'wound'); else { this.say('Fail to wound'); await this.fx.onFailToWound(k, A); }
    // Overcome
    if (ops.overcome && (A.forceOvercome || (!A.wounded && ops.overcome.kind !== 'overpower' && power >= ops.overcome.n) || (A.wounded && A.overAT >= ops.overcome.n))) { this.say(`${A.wounded ? 'Overpower' : 'Overcome'} ${ops.overcome.n}+`); A.overcame = true; if (A.wounded && A.weapon) for (const o of this.fx.constKw(k, A.weapon)) { if (o.op === 'overpowerBoon') { k.heat = Math.max(0, k.heat - o.n); A.ignoreCumbersome = true; this.say(`${A.weapon.name}: Overpower → Heat -${o.n}, Cumbersome 무시`, 'tech'); } if (o.op === 'overpowerCrit' && !A.critical) { A.critical = true; this.say(`${A.weapon.name}: Overpower → Crit Chance → ★ Critical Wound (Critical Response 해결)`, 'wound'); } } if (A.wounded && !A.critical && A.flags && A.flags.has('goBeyond')) { A.critical = true; this.say('Go Beyond!: Wound + Overcome/Overpower → ★ Critical Wound', 'wound'); } A.overcameMelee = this.monster.isMob ? !!(A.mob && A.mob.cells.length && this.board.adjacent(A.mob.cells[0], k.pos)) : this.adjacentToMonster(k); if (A.bp && A.bp.overcomeTag === 'OVERPOWER' && (A.kw || []).some(o => o.op === 'overpowerBonus') && k._opBonusRound !== this.round && await this.yesNo(`${k.name}: Overpower — Bonus Attack (라운드당 1회)?`, true)) { k._opBonusRound = this.round; k._bonusPending = true; } for (const o of A.kw || []) if (o.op === 'overpowerBoon' && A.bp && A.bp.overcomeTag === 'OVERPOWER') { k.heat = Math.max(0, k.heat - o.n); A.ignoreCumbersome = true; this.say(`${A.weapon.name}: Overpower — Heat -${o.n}, Cumbersome 무시`, 'tech'); } await this.fx.runMonsterOps(ops.overcome.ops, { attacker: k, attack: A }); }
    if (A.dadKnockdown && !A.wounded && power >= 6) { this.say('Bargain D: Overcome 6+ → Knockdown', 'bp'); await this.knockdown(k); }
    // 7. responses
    const resp = []; if (A.critical || A.respAsCrit) { if (ops.critical) resp.push(['Critical', ops.critical]); } else { if (A.wounded && ops.wound) resp.push(['Wound', ops.wound]); if (!A.wounded && ops.fail) resp.push(['Fail', ops.fail]); if (ops.instinct) resp.push(['Instinct', ops.instinct]); }
    if (stack2) { const b = A.guardian.cards[1]; const noAtk = l => (l || []).filter(o => !['signature', 'aiAttack', 'drawAIFor', 'fenPerformAI', 'signatureAgainstAttacker'].includes(o.op)); const add = (kind, l) => { const x = noAtk(l); if (x.length) resp.push([`${kind} (아래 BP: ${b.name})`, x]); }; if (A.critical) add('Critical', b.ops.critical); else { if (!A.wounded) add('Fail', b.ops.fail); add('Instinct', b.ops.instinct); } }
    if (A.flags && A.flags.has('goBeyond')) { const i = resp.findIndex(r => r[0] === 'Fail'); if (i >= 0) { resp.splice(i, 1); this.say('Go Beyond!: Fail Response 무시', 'tech'); } }
    const ignore = A.ignoreResponses || (this.poolCount('improvedDiversion') && !A.critical) || (this.poolCount('diversion') && !A.wounded && !A.critical);
    const deferred = [];
    // 8. wounds & escalation (before responses that move the monster? Rulebook: responses step 7 then wounds step 8; responses that are Monster Attacks happen after)
    if (A.wounded) { const dealt = A.guardian ? (A.guardian.isDopp ? await this.doppWound(A) : 0) : bp.isThickSkin ? (this.thickSkinAside = true, this.say('Thick Skin 부상: BP 덱 옆에 두고 뒤집음 — Wound·Escalation 없음', 'bp'), this.onTrollWound(1), 0) : this.monster.isMob ? (A.mob.isTroll ? this.trollWound() : A.mob.isNightmare ? this.nightmareWound(A) : A.mob.isPump ? this.pumpWound(A) : this.isRat ? this.ratWound(A) : this.killMob(A.mob)) : this.monster.wound(bp, { critical: A.critical }); if (!this.monster.isMob && !A.guardian && !bp.isThickSkin) this.onTrollWound(dealt); if (this.isFen && (!A.guardian || A.guardian.isDopp)) { this.wamTokens += dealt; this.wamKnight = k; if (this.monster.hasTrait('We Are Many')) this.say(`We Are Many 토큰 ${this.wamTokens}/4`); } this.monster.generic.counter = (this.monster.generic.counter || 0) + dealt; this.say(`Wound Stack ${this.monster.wounds}/${this.monster.woundsToKill}`, 'wound'); if (!A.ratToken) await this.fx.onWound(k, A); this.priorityLast = k; }
    else if (!this.monster.isMob && !A.guardian && bp.isThickSkin) { this.monster.bp.putTop(bp); this.say('Thick Skin: Wound 실패 → BP 덱 맨 위에 그대로'); }
    else if (!this.monster.isMob && !A.guardian) this.monster.discardBP(bp);
    if (A.wnDefianceNow) { const o2 = this.wn.card.ops; resp.length = 0; resp.push(A.critical ? ['Critical', o2.critical] : ['Wound', o2.wound]); }
    for (const [kind, rops] of resp) { if (A.techOp && A.techOp.repeatOver && A.wounded && (A.overAT || 0) >= A.techOp.repeatOver) { this.say(`${A.weapon.name}: AT를 ${A.techOp.repeatOver}+ 초과 — Response 무시`, 'tech'); continue; } if (A.vpNoResp) { this.say(`${kind} Response 무시 (VP — The Seat of Power)`, 'tech'); continue; } if (kind === 'Wound' && A.ignoreWoundResp) { this.say('Wound Response 무시 (Gear)', 'tech'); continue; } if (ignore && !kind.startsWith('Critical')) { this.say(`${kind} Response 무시 (${A.ignoreResponses ? 'Distracting Bait' : 'Diversion'})`); continue; } this.say(`${kind} Response`); const isAttack = rops.some(o => o.op === 'signature' || o.op === 'aiAttack' || o.op === 'drawAIFor'); const rIdx = this.bpReactIndices(bp, kind); if (isAttack) deferred.push([rops, rIdx]); else { try { await this.runResponseOps(rops, rIdx, { attacker: k, attack: A, target: k }); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); } } }
    await this.multiBPResolve(k, A);
    if (this.monster.isMob) { await this.resolveMobDeaths(); await this.firstmenDeaths(); }
    if (k.engulfed && A.wounded && k.alive) await this.fenFree(k, 'Wound');
    if (this.isPump) await this.pumpAfterResponses(k, A);
    if (this.isRat) await this.ratAfterResponses(k, A);
    if (this.isKe) await this.keAfterResponses(k, A);
    if (this.isLh) await this.lhAfterResponses(k, A);
    if (this.monster.slain) { this.checkEnd(); }
    // 9. clear pool
    await this.fx.passWindow(k, A); await this.karaClearPool(k, A);
    if (!this.fx.has(k, 'skipClearPool', A)) this.clearPool();
    if (A.swapPH && k.alive) { const p = k.passion; k.passion = k.heat; k.heat = p; this.say(`${k.name}: Passion ↔ Heat 교환 (Passion ${k.passion}, Heat ${k.heat})`, 'tech'); }
    // 10. second window
    await this.fx.secondWindow(k, A);
    if (k.hidden) { k.hidden = false; this.say(`${k.name}: 공격 후 Hidden 해제`); }
    this.currentKnightAttack = null;
    for (const [rops, rIdx] of deferred) { try { await this.runResponseOps(rops, rIdx, { attacker: k, attack: A, target: k }); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); } }
    for (let i = 0; i < k.bonusAttacks; i++) { k.bonusAttacks = 0; await this.knightAttack(k, { bonus: true }); }
    k.bonusAttacks = 0;
    await this.afterAction();
  }
  /** Rulebook p.81 Difficult Terrain: "Monsters on Difficult Terrain have -1 [AT]" (icon = AT, owner 2026-11-15). A Monster counts as on it when any occupied space is Difficult Terrain. */
  difficultTerrainAT(cells) { const ign = (this.monsterDef.basicAbilities || []).some(b => /ignore difficult terrain/i.test(b.name)); if (ign || !cells || !cells.length) return 0; return cells.some(c => { const t = this.board.terrainAt(c); return t && t.difficult; }) ? -1 : 0; }
  bpAT(bp) { if (bp && bp.isGuardianBP) return bp.at + this.monster.bonuses.at + this.monster.modifiers.at; if (this.isFen) { const g = this.guardians.find(g => g.cards.includes(bp)); return g ? this.doppAT(g) : this.fenAT(bp); } if (this.monster.isMob) { const m = this.monster.mobs.find(x => x.card === bp); return m ? this.mobAT(m) : bp.at + this.monster.bonuses.at + this.monster.modifiers.at; } return this.monster.atOf(bp, (this.monster.hasTrait('Panzeronion') ? this.armorTokens[bp.level] : 0) + this.difficultTerrainAT(this.monster.cells)); }
  clearPool() { const fire = this.pool.filter(t => t.token === 'fire'); if (fire.length) for (const k of this.alive()) for (const g of k.gear) if (!g.discarded && this.fx.kwList(g).some(o => o.op === 'fireRemovedCharge')) { g.chargesLeft = this.fx.chargesOf(g) + 1; this.say(`${g.name}: 쓰지 않은 Fire 토큰 제거 → Charge +1 (${g.chargesLeft})`, 'tech'); } const passed = this.pool.filter(t => t.pass); for (const t of passed) t.pass = false; const keep = [...this.pool.filter(t => t.resource), ...fire.slice(1), ...passed.filter(t => t.token !== 'fire' && !t.resource)]; /* Fire: leave all but one unused Fire token (p.19) */ const n = this.pool.length - keep.length; this.pool = keep; if (n) this.say(`Knight Pool 정리 (-${n})`, 'pool'); }
  /** After any action: Counter trait (Eggknight). */
  async afterAction() { for (const kn of this.knights) kn.reinforce = null; await this.swampSweep(); await this.fenAfterAction(); await this.pumpAfterAction(); if (!this.monster.isMob) await this.trollAfterAction();
    if (this.monster.isMob) await this.mobAfterAction();
    if (this.monster.hasTrait('Counter') && (this.monster.generic.counter || 0) >= 3) { this.monster.generic.counter = 0; this.say('Counter: 토큰 3 → Signature'); await this.performSignature(); }
  }
  /** BP REACT! markers (rulebook p.54: a REACT! symbol preceding an instruction opens a Window of Opportunity right before it).
   *  card.reactWindows entries: "on WOUND header" / "wound" → before the whole response; "fail:after 'Gangup 4.'" / "instinct:before 'Knockdown.'" → between sentences.
   *  Returns the op indices before which a window opens (sentence index ≙ op index when the counts match; otherwise the window opens before the response). */
  bpReactIndices(card, kind) {
    const K = kind.toLowerCase(); const text = (card.responses || {})[K] || ''; const ops = (card.ops || {})[K] || []; const out = new Set();
    const sents = text.split(/(?<=[.!])\s+/).map(x => x.trim()).filter(Boolean); const norm = x => x.replace(/\s+/g, ' ').trim().toLowerCase();
    const find = frag => { const f = norm(frag); const i = sents.findIndex(x => norm(x).startsWith(f) || f.startsWith(norm(x))); return i; };
    for (const raw of [].concat(card.reactWindows || card.react || [])) {
      const w = String(raw); const head = w.match(/^on (\w+) header/i); const pre = w.match(/^(\w+)(?::|$)/);
      let k2 = head ? head[1].toLowerCase() : pre && ['wound', 'fail', 'instinct', 'critical'].includes(pre[1].toLowerCase()) ? pre[1].toLowerCase() : null;
      const bef = w.match(/before '([^']+)'/i), aft = w.match(/after '([^']+)'/i);
      if (!k2 && (bef || aft)) k2 = ['wound', 'fail', 'instinct', 'critical'].find(x => { const t = norm((card.responses || {})[x] || ''); return t && t.includes(norm((bef || aft)[1]).slice(0, 12)); }) || null;
      if (k2 !== K) continue;
      let idx = 0;
      if (bef) { const i = find(bef[1]); idx = i < 0 ? 0 : i; } else if (aft) { const frag = aft[1]; const n = frag.split(/(?<=[.!])\s+/).filter(Boolean).length; const i = find(frag.split(/(?<=[.!])\s+/)[0]); idx = i < 0 ? 0 : i + n; }
      if (sents.length !== ops.length && idx > 0) idx = 0; // cannot align text with ops safely → open before the response
      out.add(Math.min(idx, Math.max(0, ops.length - 1)));
    }
    return [...out].sort((a, b) => a - b);
  }
  async runResponseOps(rops, rIdx, ctx) {
    if (!rIdx || !rIdx.length) return this.fx.runMonsterOps(rops, ctx);
    let from = 0; for (const i of [...rIdx, rops.length]) { if (i > from) await this.fx.runMonsterOps(rops.slice(from, i), ctx); if (i < rops.length) { this.say('REACT! (BP 응답)'); this._reactKind = 'response'; await this.windowOfOpportunity('react', ctx.attack); } from = i; }
  }
  /** AI card REACT! after Targeting: true when the card records one. Cards whose other windows the engine cannot place yet (no reactWindow op) keep the single window here. */
  cardHasTargetingReact(card) { const w = card.reactWindows ?? card.react; if (w == null) return true; const l = [].concat(w).map(String); if (l.some(x => /^(after )?targeting$/i.test(x))) return true; if (!l.length) return false; return !JSON.stringify(card.ops || {}).includes('"reactWindow"') && !card.reactExact; }
  async windowOfOpportunity(when, attack, target = null, at = null) { this._reactNow = this._reactKind || (at === 'after' ? 'after' : null); this._reactKind = null; const a = attack || this.currentAttack; if (a && a.noReact && when !== 'beforeEffects' && (a.noReact === true || a.noReact === at)) { this.say('REACT! 무시 (게이트)'); return; } await this.fx.reactions(when, attack, target); }
}
Object.assign(Clash.prototype, MobMixin, BloodMixin, HauntsMixin, FirstmenMixin, TrollMixin, NightmareMixin, FenMixin, PumpMixin, RatMixin, PanzerMixin, MasonMixin, EaterMixin, LictorMixin, WitchMixin, IroncastMixin, RenholderMixin, KaraMixin, ParacelsaMixin, SonchMixin, UbarMixin, StonefaceMixin, ExtrasMixin, KingLowMixin, DevilMixin, SmeltedMixin, PuppetMixin, DragonMixin, VeldrMixin, DevourMixin);
installKara(Clash);
installParacelsa(Clash);
installSonch(Clash);
installUbar(Clash);
installExtras(Clash);
