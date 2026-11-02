// Clash engine: Boss Clash loop (rulebook pp.42–66) — Monster Round, Knight Round, Knight Attack, Peril/Mortis/Judicium,
// Conditions, Terrain, Escalation. Monster/knight card effects are interpreted from data `ops` (see effects.js).
import { Rng, Deck, GameOver } from './core.js';
import { Board, DIRS, inFront, rearCells, faceToward } from './board.js';
import { rollD10s, d10Success, buildPowerPool, rollPowerPool, rollArmor } from './dice.js';
import { Knight } from './knight.js';
import { Monster } from './monster.js';
import { Effects } from './effects.js';

export class ChainBreak extends Error { constructor(msg = 'Chain Break') { super(msg); this.chainBreak = true; } }
const sum = a => a.reduce((x, y) => x + y, 0);
const uniq = a => [...new Set(a)];
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;

export class Clash {
  /**
   * cfg: { data, knights:[{def, portrait, heroicArc, perilArc, talent, techniques, gear}], monster:'eggknight', level, kingdom, seed, ask }
   */
  constructor(cfg) {
    this.data = cfg.data; this.rng = new Rng(cfg.seed); this.log = []; this.ask = cfg.ask || (async q => { throw new Error('ask not wired: ' + q.type); });
    this.kingdom = cfg.kingdom || 'principality'; this.round = 0; this.result = null; this.listeners = cfg.listeners || {};
    this.board = new Board(this.data.components.board);
    this.pool = []; // Knight Pool tokens: {token, temp}
    this.monsterDef = this.data.monsters[cfg.monster]; this.monster = new Monster(this.monsterDef, cfg.level, this.rng);
    this.knights = cfg.knights.map((k, i) => this._mkKnight(k, i));
    this.fx = new Effects(this);
    this._setupDecks();
    this.priorityTarget = null; this.firstRound = true; this.currentAttack = null; this.bpCounter = 0;
  }
  say(msg, kind = 'info') { this.log.push({ msg, kind, round: this.round }); if (this.listeners.log) this.listeners.log(msg, kind); return msg; }

  // ---------- setup ----------
  _mkKnight(k, i) {
    const def = this.data.knights[k.def]; const portrait = def.portraits.find(p => p.id === (k.portrait || def.setup.portrait));
    const perilArc = this.data.knights.peril_arcs.arcs[k.def].find(a => a.name === (k.perilArc || def.setup.perilArc));
    const th = ['Minor', 'Major', 'Grave', 'Judicium'].map(p => ({ peril: p, atVigor: perilArc.levels[p].vigor[0], heatLimit: perilArc.levels[p].heatLimit }));
    const kn = new Knight({ id: `${k.def}-${i}`, name: k.name || def.name + (cfg0(i)), portrait, perilArc: { maxVigor: perilArc.maxVigor, uninjuredHeatLimit: perilArc.levels.Uninjured.heatLimit, thresholds: th } });
    kn.def = def; kn.knightId = k.def; kn.perilArcDef = perilArc; kn.portraitDef = portrait;
    kn.heroicArc = def.heroicArcs.find(a => a.name === (k.heroicArc || def.setup.heroicArc)); kn.talent = def.talents.find(t => t.name === (k.talent || def.setup.talent));
    kn.hand = (k.techniques || def.setup.techniques).map(n => ({ ...def.techniques.find(t => t.name === n) }));
    kn.gear = (k.gear || def.setup.gear).map(n => ({ ...this.data.gear.gear.gear.find(g => g.name === n), exhausted: false, discarded: false }));
    { const otherHands = kn.gear.filter(g => g.type === 'weapon' && g.name !== 'Knighves').reduce((a, g) => a + (g.hands || 1), 0); if (otherHands >= 2) { const kv = kn.gear.find(g => g.name === 'Knighves'); if (kv) { kn.gear = kn.gear.filter(g => g !== kv); kn.knighvesReserve = kv; } } } // Knighves only in a free hand slot (p.20)
    kn.virtues = { ...def.setup.virtues }; kn.tier = k.tier || 1; kn.pos = null; kn.conditions = []; kn.chokeLimit = 0; kn.braced = false; kn.usedArcLevels = new Set(); kn.bonusAttacks = 0; kn.heroicUsed = {};
    kn.gold = k.gold ?? 0; kn.sigh = k.sigh ?? 0; kn.fleischBoard = 0; kn.firstDeath = k.firstDeath || false; kn.turnsTaken = 0;
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
    for (const t of cs.terrain) { const tdef = this.data.terrain.terrain.find(x => x.name.toLowerCase() === t.tile); for (const lab of t.cells) B.terrain.set(B.key(B.parse(lab)), { id: t.tile, obstacle: tdef.keywords.includes('Obstacle'), obscuring: tdef.keywords.includes('Obscuring'), destructible: tdef.keywords.includes('Destructible'), chasm: tdef.keywords.includes('Chasm'), difficult: tdef.keywords.includes('Difficult Terrain') }); }
    // monster
    this.monster.cells = cs.monsterCells.map(l => B.parse(l)); B.place({ kind: 'monster', id: this.monster.id }, this.monster.cells);
    const bottom = this.mortis.Minor.cards.at(-1); const arrowDir = { up: 'N', down: 'S', left: 'W', right: 'E' }[bottom.marker.arrow]; this.monster.facing = arrowDir; this.say(`Eggknight 배치 ${cs.monsterCells.join('/')} · 방향 ${arrowDir} (Minor Mortis 바닥: ${bottom.name})`);
    // knights
    this.knights.forEach((k, i) => { k.pos = B.parse(cs.knightStart[i]); B.place({ kind: 'knight', id: k.id }, [k.pos]); });
    // traits additional setup (Panzeronion)
    this.armorTokens = { 1: 0, 2: 0, 3: 0 }; this.jackedTokens = 0;
    const pz = this.monsterDef.traits.find(t => t.id === 'panzeronion'); if (this.monster.hasTrait('Panzeronion') && pz.setup) { for (const l of [1, 2, 3]) this.armorTokens[l] = pz.setup.armorTokens['bp' + l] + (this.monster.level >= 2 ? pz.setup.level2plus : 0); this.say(`Panzeronion: Armor 토큰 BP1 ${this.armorTokens[1]} / BP2 ${this.armorTokens[2]} / BP3 ${this.armorTokens[3]}`); }
    for (let i = 0; i < this.monster.bonuses.escalations; i++) this.monster.escalateX(1);
    // priority target: highest passion (all 0 → first knight)
    this.priorityTarget = this.knights[0]; this._askPriority = true;
    this.say(`Clash 시작: ${this.monster.name} Lv${this.monster.level} (To Hit ${this.monster.toHit}+, Wounds ${this.monster.woundsToKill}) vs ${this.knights.map(k => k.name).join(', ')}`);
    return this;
  }

  // ---------- helpers ----------
  alive() { return this.knights.filter(k => k.alive); }
  knightAt(cell) { return this.knights.find(k => k.alive && cellEq(k.pos, cell)); }
  distKM(k) { return this.board.distance([k.pos], this.monster.cells, c => !this.board.isObstacle(c)); }
  adjacentToMonster(k) { return this.board.footprintsAdjacent([k.pos], this.monster.cells); }
  inBlindspot(k) { return rearCells(this.board, this.monster.cells, this.monster.facing).some(c => cellEq(c, k.pos)); }
  inSight(k) { return !this.inBlindspot(k) && this.board.hasLoS(this.monster.cells, [k.pos]); }
  knockedDown(k) { return k.conditions.some(c => /^Knockdown/.test(c.id)); }
  hasCondition(k, id) { return k.conditions.find(c => c.id === id); }
  monsterCenter() { const cs = this.monster.cells; return { c: sum(cs.map(x => x.c)) / cs.length, r: sum(cs.map(x => x.r)) / cs.length }; }
  frontCells() { const d = DIRS[this.monster.facing]; return this.monster.cells.map(x => ({ c: x.c + d.c, r: x.r + d.r })).filter(x => this.board.inside(x) && !this.monster.cells.some(m => cellEq(m, x))); }
  poolCount(token) { return this.pool.filter(t => t.token === token).length; }
  poolTake(token, n = 1) { let k = 0; this.pool = this.pool.filter(t => { if (t.token === token && k < n) { k++; return false; } return true; }); return k; }
  poolAdd(token, n = 1, extra = {}) { for (let i = 0; i < n; i++) this.pool.push({ token, ...extra }); this.say(`Knight Pool +${n} ${token}`, 'pool'); }
  async choose(type, options, extra = {}) {
    if (options.length === 1 && !extra.allowNone) return options[0].value;
    const v = await this.ask({ type, options, ...extra }); return v;
  }
  async askCount(text, max, def = max) { if (max <= 0) return 0; const v = await this.ask({ type: 'number', text, default: def, options: Array.from({ length: max + 1 }, (_, i) => ({ label: String(i), value: i })) }); return typeof v === 'number' ? v : def; }
  async yesNo(text, def = true) { return !!(await this.ask({ type: 'confirm', text, default: def, options: [{ label: '예', value: true }, { label: '아니오', value: false }] })); }

  // ---------- run ----------
  async run() {
    try {
      if (this._askPriority) { this._askPriority = false; const id = await this.ask({ type: 'pickKnight', text: 'Passion 동률 — 시작 Priority Target 선택', options: this.knights.map(k => ({ label: k.name, value: k.id })) }); this.priorityTarget = this.knights.find(k => k.id === id) || this.knights[0]; this.say(`Priority Target: ${this.priorityTarget.name}`); }
      while (!this.result) { this.round++; await this.monsterRound(); if (this.result) break; await this.knightRound(); this.firstRound = false; }
    } catch (e) { if (e instanceof GameOver) this.result = e.result; else throw e; }
    this.say(`Clash 종료: ${this.result === 'win' ? '승리' : '패배'}`, 'end');
    return this.result;
  }
  checkEnd() {
    if (this.monster.slain) { this.result = 'win'; throw new GameOver('win'); }
    if (!this.alive().length) { this.result = 'lose'; throw new GameOver('lose'); }
  }

  // ---------- Monster Round ----------
  async monsterRound() {
    this.say(`— 라운드 ${this.round}: Monster Round —`, 'phase'); this.monster.readyActivations();
    for (const act of this.monster.activations) { if (!act.ready) continue; act.ready = false; if (act.type === 'AI') await this.activationAI(); else await this.performSignature(); await this.afterAction(); this.checkEnd(); }
  }
  async activationAI() {
    const card = this.monster.drawAI(); if (!card) { this.say('AI 덱 없음'); return; }
    this.say(`AI ${card.level}: ${card.name}`, 'ai');
    await this.resolveMonsterAttack(card, { isAI: true });
    this.monster.discardAI(card);
  }
  async performSignature() { const s = this.monster.signature; this.say(`Signature: ${s.name}`, 'ai'); await this.resolveMonsterAttack(s, { isSignature: true }); }
  async performRoutine() { const r = this.monster.routine; this.say(`Routine: ${r.name}`, 'ai'); await this.fx.runMonsterOps(r.ops, { targets: this.alive() }); }

  /** Targeting (p.48): read lines top to bottom; first resolvable wins. Returns { targets:[Knight], zone?:[cells], line } or null. */
  async resolveTargeting(card, opts = {}) {
    const alive = this.alive(); const B = this.board;
    const closest = arr => { if (!arr.length) return []; const ds = arr.map(k => this.distKM(k)); const m = Math.min(...ds); return arr.filter((k, i) => ds[i] === m && m < Infinity); };
    for (const line of card.ops.targeting) {
      const L = line.toLowerCase();
      if (L.startsWith('zone ')) { const x = +L.match(/\d/)[0]; const cells = B.zone(this.monster.cells, x); return { zone: cells, targets: alive.filter(k => cells.some(c => cellEq(c, k.pos))), line, zoneX: x }; }
      let cand = alive; const behind = /and 1 space behind target/.test(L);
      if (L.includes('priority target')) cand = alive.filter(k => k === this.priorityTarget);
      else if (L.includes('knight in blindspot')) cand = alive.filter(k => this.inBlindspot(k));
      else if (L.includes('closest knight in front')) cand = closest(alive.filter(k => inFront(B, this.monster.cells, this.monster.facing, k.pos) && B.hasLoS(this.monster.cells, [k.pos])));
      else if (L.includes('closest knight in sight')) cand = closest(alive.filter(k => this.inSight(k)));
      else if (L.includes('closest knight')) cand = closest(alive);
      else { this.say(`[미구현 targeting] ${line}`, 'warn'); continue; }
      if (!cand.length) continue;
      let t = cand[0]; if (cand.length > 1) { if (cand.includes(this.priorityTarget)) t = this.priorityTarget; else { const id = await this.ask({ type: 'pickKnight', text: `Targeting 동률 (${line}) — 대상 선택`, options: cand.map(k => ({ label: `${k.name} (${this.board.label(k.pos)})`, value: k.id })) }); t = cand.find(k => k.id === id) || cand[0]; } }
      return { targets: [t], primary: t, line, behind };
    }
    return null;
  }

  /** Monster Attack (p.47–54): targeting → movement → evasion per target → consequences → after attack. */
  async resolveMonsterAttack(card, ctx = {}) {
    const ops = card.ops; let tg = await this.resolveTargeting(card);
    if (!tg) { this.say(`유효 대상 없음 → Routine`); await this.performRoutine(); return; }
    this.say(`Targeting: ${tg.line}${tg.primary ? ' → ' + tg.primary.name : ''}`);
    const attack = { card, ctx, targets: tg.targets, primary: tg.primary, zone: tg.zone, vigorLost: false, hits: {} };
    this.currentAttack = attack;
    try {
      // before-attack keywords (Choke etc. apply to targets at resolution; Choke is on the attack line → applied with effects)
      // movement
      if (tg.primary && !tg.zone) { this.turnToward(tg.primary.pos); if (ops.move) await this.monsterMoveToward(tg.primary); if (!this.alive().includes(tg.primary)) throw new ChainBreak('target died during movement'); }
      // windows of opportunity: REACT! before attack
      await this.windowOfOpportunity('beforeAttack', attack);
      // zone targets recomputed after movement
      let targets = attack.targets;
      if (card.type === 'zone' && !tg.zone) { const cells = this.frontCells(); if (tg.behind && tg.primary) { const d = this.dirFromMonster(tg.primary.pos); const b = { c: tg.primary.pos.c + d.c, r: tg.primary.pos.r + d.r }; cells.push(b); }
        targets = uniq([tg.primary, ...this.alive().filter(k => cells.some(c => cellEq(c, k.pos)))].filter(Boolean)); attack.zoneCells = cells; }
      else if (tg.zone) { targets = this.alive().filter(k => tg.zone.some(c => cellEq(c, k.pos))); }
      attack.targets = targets;
      if (!targets.length) { this.say('Zone 공격: 대상 없음(Zone은 수행된 것으로 간주)'); }
      // out of reach check for melee
      if (tg.primary && card.type !== 'zone' && !this.adjacentToMonster(tg.primary)) { this.say(`${tg.primary.name} Out of Reach → After Attack만 처리`); attack.targets = []; }
      if (attack.targets.length > 1) { const order = await this.ask({ type: 'order', text: 'Evasion Roll 순서 (여러 대상)', options: attack.targets.map(t => ({ label: t.name, value: t.id })) }); if (Array.isArray(order)) attack.targets = order.map(id => attack.targets.find(t => t.id === id)).filter(Boolean); }
      for (const t of attack.targets) { if (!t.alive) continue; try { await this.attackOneTarget(attack, t); } catch (e) { if (e.chainBreak && (card.type === 'zone' || attack.targets.length > 1)) { this.say(`Chain Break (${t.name}) — 다른 대상은 계속`); continue; } throw e; } }
      // after attack
      if (ops.afterAttack) { this.say('After Attack'); await this.fx.runMonsterOps(ops.afterAttack, { attack, targets: attack.targets, primary: tg.primary }); }
      let afa = ops.afterFinalAttack; if (!afa && card.type === 'zone' && this.monster.hasTrait('Egged On')) afa = [{ op: 'trait', id: 'humpty-charge' }];
      if (afa && !ops.afterFinalAttack) { this.say('Egged On — REACT!'); await this.windowOfOpportunity('react', attack); } // Egged On grants "REACT! After Final Attack: Humpty Charge" (owner-confirmed icon)
      if (afa) { this.say('After Final Attack'); await this.fx.runMonsterOps(afa, { attack, targets: attack.targets, primary: attack.targets.at(-1) || tg.primary, repeatCard: card }); }
    } catch (e) { if (e.chainBreak) { this.say(`Chain Break: ${e.message}`, 'warn'); } else throw e; }
    finally { this.currentAttack = null; }
  }
  dirName(d) { return d.c > 0 ? '동(→)' : d.c < 0 ? '서(←)' : d.r > 0 ? '북(↑)' : '남(↓)'; }
  dirFromMonster(cell) { const m = this.monsterCenter(); const dc = cell.c - m.c, dr = cell.r - m.r; return Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) }; }
  turnToward(cell) { const f = faceToward(this.monster.cells, cell, this.monster.facing); if (f !== this.monster.facing) { this.monster.facing = f; this.say(`몬스터 회전 → ${f}`); } }
  async faceMostKnights() { const counts = ['N', 'E', 'S', 'W'].map(f => ({ f, n: this.alive().filter(k => inFront(this.board, this.monster.cells, f, k.pos)).length })); const max = Math.max(...counts.map(x => x.n)); const best = counts.filter(x => x.n === max); let f = best[0].f; if (best.length > 1 && max > 0) { f = await this.ask({ type: 'pick', text: '가장 많은 기사를 향함 — 동률, 방향 선택', options: best.map(x => ({ label: this.dirName(DIRS[x.f]), value: x.f })) }); } else if (best.length > 1) f = best.includes(this.monster.facing) ? this.monster.facing : best[0].f; this.monster.facing = f; this.say(`몬스터가 가장 많은 기사 쪽(${f})을 향함`); }

  /** Boss movement toward target until adjacent (p.50): shortest path, moves through Knights (Crash), destroys Destructible terrain. */
  async monsterMoveToward(target) {
    const B = this.board; let steps = 0; let lastAxis = null;
    while (!this.board.footprintsAdjacent(this.monster.cells, [target.pos]) && steps < 30) {
      const m = this.monsterCenter(); const dc = target.pos.c - m.c, dr = target.pos.r - m.r;
      const opts = []; if (Math.abs(dc) > 0.5) opts.push({ c: Math.sign(dc), r: 0 }); if (Math.abs(dr) > 0.5) opts.push({ c: 0, r: Math.sign(dr) });
      if (!opts.length) break;
      // zigzag (p.50): switch axis after each space; the players choose the starting direction
      const valid = opts.filter(d => this.monster.cells.every(x => B.inside({ c: x.c + d.c, r: x.r + d.r })));
      if (!valid.length) break;
      let d = valid[0];
      if (valid.length > 1) { const alt = lastAxis ? valid.find(x => (x.c ? 'c' : 'r') !== lastAxis) : null; if (alt) d = alt; else { const i = await this.ask({ type: 'pick', text: '몬스터 이동 시작 방향 (지그재그)', options: valid.map((x, i) => ({ label: this.dirName(x) + ' — 밟히는 기사 ' + this.monster.cells.map(m => ({ c: m.c + x.c, r: m.r + x.r })).filter(cc => this.knightAt(cc) && !this.monster.cells.some(mc => cellEq(mc, cc))).length + '명', value: i })) }); d = valid[i] || valid[0]; } }
      lastAxis = d.c ? 'c' : 'r';
      await this.monsterStep(d); steps++;
    }
    if (steps) this.say(`몬스터 이동 ${steps}칸 → ${this.monster.cells.map(c => B.label(c)).join('/')}`);
  }
  /** One step of boss movement; returns false if blocked by board edge. */
  async monsterStep(d, { charge = false } = {}) {
    const B = this.board; const nc = this.monster.cells.map(x => ({ c: x.c + d.c, r: x.r + d.r }));
    if (!nc.every(x => B.inside(x))) return 'edge';
    const newCells = nc.filter(x => !this.monster.cells.some(mc => cellEq(mc, x)));
    for (const x of newCells) { const t = B.terrainAt(x); if (t && t.obstacle) { if (charge && !this.monster.hasTrait('Just a Scratch')) return 'obstacle'; if (t.destructible) { B.terrain.delete(B.key(x)); this.say(`지형 ${t.id} 파괴 (${B.label(x)})`); } else return 'obstacle'; } }
    B.remove(this.monster.cells); this.monster.cells = nc; B.place({ kind: 'monster', id: this.monster.id }, nc);
    for (const x of newCells) { const k = this.knightAt(x); if (k) { try { await this.crash(k, { charge, through: true }); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break 중 돌진 계속 (${e.message})`, 'warn'); } } }
    return 'ok';
  }
  /** Crash (p.80): -1 Vigor + Knockdown. Charge over knocked-down Knight → Judicium instead (Humpty Charge). */
  async crash(k, { charge = false } = {}) {
    if (charge && this.knockedDown(k)) { this.say(`${k.name}: 넘어진 채로 돌진당함 → Judicium`); await this.drawJudicium(k); return; }
    this.say(`${k.name} Crash`); await this.loseVigor(k, 1, { source: 'crash' }); await this.knockdown(k);
  }
  /** Monster ends movement on a Knight: Crash + Unavoidable Knockback (p.51). */
  async displaceKnightsUnderMonster() { for (const k of this.alive()) if (this.monster.cells.some(c => cellEq(c, k.pos))) { await this.crash(k); if (k.alive) await this.knockback(k, this.monsterDef.basicAbilities.find(b => b.name === 'Unavoidable Knockback').value, { unavoidable: true }); } }

  /** Evasion roll + consequences for one target (pp.52–54). */
  async attackOneTarget(attack, k) {
    const card = attack.card, ops = card.ops; const M = this.monster;
    // gates
    const gatesOn = ops.gates.filter(g => g.stat === 'heat' ? k.heat >= g.gte : false);
    let dice = card.evasionDice + M.bonuses.evasionDice + sum(gatesOn.filter(g => g.op === 'evasionDice').map(g => g.n)); let diff = card.evasionDifficulty + M.modifiers.precision;
    const diffInstead = gatesOn.find(g => g.op === 'difficultyInstead'); if (diffInstead) diff = diffInstead.n;
    if (this.monster.hasTrait('Jacked')) { if (this.jackedTokens >= 2) diff += 1; if (this.jackedTokens >= 5) dice += 1; }
    const evaBonus = this.fx.evasionBonus(k);
    const roll = rollD10s(this.rng, dice);
    // Heat re-rolls: ask which dice to re-roll (cost +1 Heat each) — offer only if some die would fail
    let hits = roll.dice.filter(d => !d10Success(d.v, evaBonus, diff));
    if (hits.length && k.heat < k.heatLimit) {
      const picked = await this.ask({ type: 'dice', knight: k.id, text: `${k.name} Evasion ${dice}d ${diff}+ (보너스 +${evaBonus}) — Heat 재굴림 (Heat ${k.heat}/${k.heatLimit}, 주사위당 +1)`, dice: roll.dice.map(d => ({ v: d.v, crit: d.crit, hit: d10Success(d.v, evaBonus, diff), canReroll: !d.rerolled })), max: k.heatLimit - k.heat });
      if (picked && picked.length) { k.gainHeat(picked.length, { voluntary: true }); for (const i of picked) { const d = roll.dice[i]; d.v = this.rng.die(10); d.rerolled = true; if (d.crit && d.v === 1) this.say('Crit Evade Fail (재굴림)'); } }
    }
    hits = roll.dice.filter(d => !d10Success(d.v, evaBonus, diff)).length;
    // Block keyword
    hits = Math.max(0, hits - this.fx.blockValue(k));
    this.say(`${k.name} Evasion ${dice}d ${diff}+ → [${roll.dice.map(d => d.v + (d.rerolled ? '*' : '')).join(' ')}] 명중 ${hits}${roll.critChance ? ' (Crit Evade)' : ''}${roll.critFail ? ' (Crit Evade Fail)' : ''}`, 'dice');
    attack.hits[k.id] = hits;
    if (hits === 0) { this.say(`${k.name} Full Evade`); return; }
    // effects in order
    await this.windowOfOpportunity('beforeEffects', attack, k);
    const vigInstead = gatesOn.find(g => g.op === 'vigorPerHitInstead');
    const ctx = { attack, target: k, hits, vigorPerHitOverride: vigInstead ? vigInstead.n : null, gatesOn };
    for (const g of gatesOn.filter(g => g.op === 'pushback')) await this.pushback(k, g.n);
    for (const b of ops.before) await this.fx.runMonsterOp(b, ctx);
    for (const g of gatesOn) for (const b of g.alsoOps || []) await this.fx.runMonsterOp(b, ctx); // gate tag chained under the Heat gate (e.g. Backslash/Backthrust Choke 3)
    await this.fx.runMonsterOps(ops.effects, ctx);
    for (const g of gatesOn.filter(g => g.op === 'discard')) await this.fx.runMonsterOp({ op: 'discard', n: g.n }, ctx);
    for (const g of gatesOn.filter(g => g.op === 'die')) { this.say(`${k.name}: Heat ${k.heat} ≥ ${g.gte} → YOU DIE`); await this.die(k, 'Yolkman Strike'); }
  }

  // ---------- damage / peril ----------
  /** Vigor loss from a Monster Attack: Armor Roll first (if any armor dice), then apply; Peril Check / Judicium handled by caller flags. */
  async loseVigor(k, n, { source = 'attack', perilCheck = false, armor = true } = {}) {
    if (!k.alive || n <= 0) return 0;
    let loss = n;
    if (armor && source === 'attack') { const dice = this.fx.armorDice(k); if (dice.red + dice.black + dice.white > 0) { const r = rollArmor(this.rng, dice, this.data.components.dice.faces, this.data.components.dice.armorSymbol); let mit = r.mitigated; if (this.fx.has(k, 'armorRollDoubleSymbols')) mit *= 2; else mit = await this.fx.armorDoubleGear(k, mit, loss); loss = Math.max(0, loss - mit); this.say(`${k.name} Armor Roll ${r.dice.length}d → 경감 ${mit}`, 'dice'); await this.fx.onArmorRoll(k, mit); if (loss === 0) { this.say(`${k.name} 피해 전부 경감 → Peril Check 없음`); return 0; } } }
    loss -= this.fx.soak(k); if (loss <= 0) return 0;
    const before = k.vigor; const eff = k.loseVigor(loss); this.say(`${k.name} Vigor -${loss} (${before}→${k.vigor})${eff < 0 ? ' [효과상 ' + eff + ']' : ''}`, 'dmg');
    if (this.currentAttack) this.currentAttack.vigorLost = true;
    if (eff <= 0) { await this.massivePeril(k, eff); await this.drawJudicium(k); return loss; }
    if (perilCheck) await this.perilCheck(k);
    return loss;
  }
  async massivePeril(k, eff) { const add = n => { const c = this.judiciumAll.find(j => j.massivePerilThreshold === n); if (c && !this.judiciumExtra.includes(c)) { this.judiciumExtra.push(c); this.say(`Massive Peril ${n}: ${c.name} 추가`, 'warn'); } }; if (eff <= -5) add(-5); if (eff <= -9) add(-9); if (eff <= -12) add(-12); }
  async perilCheck(k) {
    if (!k.alive) return; const tier = k.peril(); if (tier === 'Uninjured') { this.say(`${k.name} Peril Check: Uninjured → 없음`); return; }
    if (tier === 'Judicium') { await this.drawJudicium(k); return; }
    await this.drawMortis(k, tier);
  }
  async drawMortis(k, tier, { named = null } = {}) {
    const deck = this.mortis[tier]; let card = named ? deck.cards.find(c => c.name === named) : deck.draw(); if (named && card) deck.cards.splice(deck.cards.indexOf(card), 1);
    if (!card) { this.say(`${tier} Mortis 덱 비어 있음`); return; }
    this.say(`${k.name} ${tier} Mortis: ${card.name} — ${card.text}`, 'mortis');
    // Second Chance window
    const sc = await this.fx.secondChance(k, card, tier); if (sc) { deck.putBottom(card); card = deck.draw(); this.say(`Second Chance → 다시 뽑음: ${card.name} — ${card.text}`, 'mortis'); }
    const res = await this.fx.runMortis(card, k, tier);
    if (!res || !res.shuffledBack) deck.putBottom(card);
  }
  async drawJudicium(k) {
    if (!k.alive) return; const cards = [...this.judiciumBase, ...this.judiciumExtra]; const card = this.rng.pick(cards);
    this.say(`${k.name} Judicium (${cards.length}장): ${card.name}`, 'mortis');
    if (card.death) await this.die(k, card.name); else { k.vigor = Math.max(0, k.vigor); }
  }
  async die(k, reason) {
    if (!k.alive) return;
    // Unknown Saint incarnation attempt (campaign hook)
    if (this.listeners.beforeDeath) { const saved = await this.listeners.beforeDeath(k, reason, this); if (saved) return; }
    k.die(reason); this.board.remove([k.pos]); this.say(`☠ ${k.name} 사망 (${reason})`, 'death');
    if (this.priorityTarget === k) { const al = this.alive(); if (al.length) this.priorityTarget = al.reduce((a, b) => b.passion > a.passion ? b : a); }
    if (this.listeners.onDeath) await this.listeners.onDeath(k, reason, this);
    this.checkEnd();
    if (this.currentAttack && this.currentAttack.targets.includes(k)) throw new ChainBreak('Mercy Rule: target died');
  }

  // ---------- conditions / movement effects ----------
  async addCondition(k, id, { tokens = 0 } = {}) {
    const def = this.conditionDefs[id]; if (!def) { this.say(`[미구현 Condition] ${id}`, 'warn'); return; }
    const existing = this.hasCondition(k, id);
    if (existing) { if (def.ops && def.ops.secondTime === 'flip' && def.flipSide) { existing.id = def.flipSide; this.say(`${k.name}: ${id} 두 번째 → ${def.flipSide}`); } else if (def.ops && def.ops.secondTime === 'die') { await this.die(k, id + ' (second time)'); } else this.say(`${k.name}: 이미 ${id}`); return; }
    k.conditions.push({ id, tokens }); this.say(`${k.name} Condition: ${id}`, 'cond');
    if (/^Distracted|^Panicked/.test(id)) this.fx.enforceHandLimit(k);
  }
  removeCondition(k, id) { const i = k.conditions.findIndex(c => c.id === id); if (i >= 0) { k.conditions.splice(i, 1); this.say(`${k.name}: ${id} 제거`); return true; } return false; }
  async knockdown(k) { if (!k.alive) return; if (k.braced || this.fx.has(k, 'rocksteady')) { this.say(`${k.name} Knockdown 무시`); return; } if (this.knockedDown(k)) return; await this.addCondition(k, 'Knockdown (Falling Down)'); }
  standUp(k) { const c = k.conditions.find(c => /^Knockdown/.test(c.id)); if (c) { k.conditions.splice(k.conditions.indexOf(c), 1); this.say(`${k.name} 일어남`); return true; } return false; }
  /** Involuntary straight-line movement away from the monster (Pushback / Knockback). Obstacles: Crash (+destroy if destructible); edge: slide along (p.56). */
  async pushback(k, n, { unavoidable = false } = {}) {
    if (!k.alive || n <= 0) return; if (k.braced && !unavoidable) { this.say(`${k.name} Braced: 밀려나지 않음`); return; }
    n = Math.max(0, n - (unavoidable ? 0 : this.fx.involuntaryReduction(k)));
    let d = this.dirFromMonster(k.pos); const B = this.board; let moved = 0;
    for (let i = 0; i < n; i++) {
      let next = { c: k.pos.c + d.c, r: k.pos.r + d.r };
      if (!B.inside(next)) { // slide along edge away from monster
        const alts = [{ c: d.r, r: d.c }, { c: -d.r, r: -d.c }].map(x => ({ x, cell: { c: k.pos.c + x.c, r: k.pos.r + x.r } })).filter(a => B.inside(a.cell));
        if (!alts.length) break; const m = this.monsterCenter(); const dist = a => Math.abs(a.cell.c - m.c) + Math.abs(a.cell.r - m.r); alts.sort((a, b) => dist(b) - dist(a)); let pick = alts[0]; if (alts.length > 1 && dist(alts[0]) === dist(alts[1])) { const i = await this.ask({ type: 'pick', text: `${k.name} 가장자리 미끄러짐 방향`, options: alts.map((a, i) => ({ label: B.label(a.cell), value: i })) }); pick = alts[i] || alts[0]; } d = pick.x; next = pick.cell;
      }
      const t = B.terrainAt(next);
      if (t && t.obstacle) { await this.crash(k); if (t.destructible) { B.terrain.delete(B.key(next)); this.say(`${t.id} 파괴`); } else break; if (!k.alive) return; }
      if (t && t.chasm) { this.moveKnight(k, next); await this.die(k, 'Chasm'); return; }
      if (this.monster.cells.some(c => cellEq(c, next))) { await this.crash(k); break; }
      const other = this.knightAt(next); this.moveKnight(k, next); moved++;
      if (other) await this.displace(other);
    }
    this.say(`${k.name} ${unavoidable ? 'Unavoidable Knockback' : 'Pushback'} ${moved}/${n}칸 → ${B.label(k.pos)}`);
  }
  async knockback(k, n, opts = {}) { return this.pushback(k, n, opts); }
  async displace(k) { const B = this.board; const free = B.neighbors(k.pos).filter(c => !B.isObstacle(c) && !this.knightAt(c) && !this.monster.cells.some(m => cellEq(m, c))); if (!free.length) { await this.die(k, 'Displace 불가'); return; } const dest = free.length === 1 ? free[0] : await this.ask({ type: 'move', knight: k.id, text: `${k.name} Displace — 칸 선택`, cells: free, options: free.map(c => ({ label: B.label(c), value: c })) }) || free[0]; this.moveKnight(k, dest); this.say(`${k.name} Displace → ${B.label(dest)}`); }
  moveKnight(k, cell) { this.board.remove([k.pos]); k.pos = cell; this.board.place({ kind: 'knight', id: k.id }, [cell]); }

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
    this.say(`— 라운드 ${this.round}: Knight Round —`, 'phase');
    const acted = new Set();
    while (true) {
      const avail = this.alive().filter(k => !acted.has(k.id)); if (!avail.length) break;
      let k = avail[0]; if (avail.length > 1) { const id = await this.ask({ type: 'pickKnight', options: avail.map(x => ({ label: x.name, value: x.id })) }); k = this.knights.find(x => x.id === id) || avail[0]; }
      acted.add(k.id); await this.knightTurn(k); this.checkEnd();
    }
    for (const k of this.alive()) await this.fx.endOfKnightRound(k);
  }
  async knightTurn(k) {
    this.say(`▶ ${k.name} 턴 (V${k.vigor} H${k.heat}/${k.heatLimit} P${k.passion})`, 'turn'); k.turnsTaken++;
    // Knockdown handling
    const kd = k.conditions.find(c => /^Knockdown/.test(c.id));
    if (kd && kd.id === 'Knockdown (Standing Up)') { this.standUp(k); }
    k.refresh(cards => cards.slice(0, k.cardRefresh)); this.say(`${k.name} Refresh: Heat ${k.heat}, 손패 ${k.hand.length}`);
    k.actions = { move: true, combat: true, extraCombat: 0 }; k.freeUsed = new Set();
    let done = false;
    while (!done && k.alive) {
      const kdNow = k.conditions.find(c => c.id === 'Knockdown (Falling Down)');
      const opts = [];
      if (!kdNow) { if (k.actions.move) opts.push({ label: `이동 (Speed ${this.fx.speed(k)})`, value: 'move' }); if ((k.actions.combat || k.actions.extraCombat > 0) && this.canAttack(k)) opts.push({ label: '공격', value: 'attack' }); for (const t of this.fx.usableTechniques(k)) opts.push({ label: `기술: ${t.name} (${this.fx.costLabel(k, t)})`, value: 'tech:' + t.name }); for (const a of this.fx.freeActions(k)) opts.push({ label: a.label, value: 'free:' + a.id }); }
      else opts.push(...this.fx.usableTechniques(k).filter(t => t.ops.some(o => o.op === 'standUp')).map(t => ({ label: `기술: ${t.name}`, value: 'tech:' + t.name })));
      opts.push({ label: '턴 종료', value: 'end' });
      const choice = opts.length === 1 ? 'end' : await this.ask({ type: 'action', knight: k.id, options: opts });
      if (choice === 'end') done = true;
      else if (choice === 'move') { await this.knightMove(k, this.fx.speed(k)); k.actions.move = false; }
      else if (choice === 'attack') { if (k.actions.combat) k.actions.combat = false; else k.actions.extraCombat--; await this.knightAttack(k); }
      else if (choice.startsWith('tech:')) await this.fx.useTechnique(k, k.hand.find(t => t.name === choice.slice(5)));
      else if (choice.startsWith('free:')) await this.fx.doFreeAction(k, choice.slice(5));
      this.checkEnd();
    }
    // end of turn: Knockdown (Falling Down) → flip
    const kd2 = k.conditions.find(c => c.id === 'Knockdown (Falling Down)'); if (kd2) { kd2.id = 'Knockdown (Standing Up)'; this.say(`${k.name}: Knockdown → Standing Up (다음 턴 시작 시 일어남)`); }
    await this.fx.endOfTurn(k);
  }
  canAttack(k) { return this.adjacentToMonster(k) && k.gear.some(g => g.type === 'weapon' && !g.exhausted && !g.discarded) && this.board.hasLoS([k.pos], this.monster.cells); }
  reachable(k, speed) {
    const B = this.board; const out = new Map(); const q = [{ cell: k.pos, d: 0 }]; const seen = new Set([B.key(k.pos)]);
    while (q.length) { const { cell, d } = q.shift(); if (d >= speed) continue; for (const n of B.neighbors(cell)) { const key = B.key(n); if (seen.has(key)) continue; if (B.isObstacle(n) || this.knightAt(n) || this.monster.cells.some(m => cellEq(m, n))) continue; seen.add(key); const t = B.terrainAt(n); const cost = t && t.difficult ? 2 : 1; if (d + cost > speed) continue; out.set(key, n); q.push({ cell: n, d: d + cost }); } }
    return [...out.values()];
  }
  async knightMove(k, speed) {
    const cells = this.reachable(k, speed); if (!cells.length) { this.say(`${k.name} 이동 불가`); return; }
    const target = await this.ask({ type: 'move', knight: k.id, cells, options: cells.map(c => ({ label: this.board.label(c), value: c })) });
    if (!target) return; this.moveKnight(k, target); this.say(`${k.name} 이동 → ${this.board.label(target)}`);
    const c = this.hasCondition(k, 'Knockdown (Standing Up)'); if (c) this.standUp(k);
  }

  // ---------- Knight Attack (pp.56–62) ----------
  async knightAttack(k, { bonus = false } = {}) {
    const weapons = k.gear.filter(g => g.type === 'weapon' && (!g.exhausted || bonus) && !g.discarded);
    if (!weapons.length && k.knighvesReserve && !k.gear.some(g => g.type === 'weapon' && !g.discarded)) { k.gear.push(k.knighvesReserve); weapons.push(k.knighvesReserve); k.knighvesReserve = null; this.say(`${k.name}: 무기를 잃어 Knighves 장착`); }
    if (!weapons.length) { this.say(`${k.name}: 사용 가능한 무기 없음`); return; }
    let w = weapons[0]; if (weapons.length > 1) { const wn = await this.ask({ type: 'weapon', knight: k.id, options: weapons.map(g => ({ label: `${g.name} (⚔${g.attackDice} +${g.precision})`, value: g.name })) }); w = weapons.find(g => g.name === wn) || weapons[0]; }
    if (bonus && w.exhausted) w.exhausted = false;
    const A = { knight: k, weapon: w, bonus, hits: 0, critChance: false, bp: null, totalPower: 0, wounded: false, critical: false, ignoreResponses: false, extraPool: { red: 0, black: 0, white: 0, raw: 0 }, powerRerolls: 0, armorPiercing: 0 };
    this.currentKnightAttack = A; this.say(`${k.name} 공격 선언 — ${w.name}${bonus ? ' (Bonus Attack)' : ''}`, 'atk');
    const kc = this.hasCondition(k, 'Knockdown (Standing Up)'); if (kc) this.standUp(k);
    // Commit
    if (this.fx.weaponHas(w, 'commit')) { k.gainHeat(1); this.say(`Commit: Heat +1 (${k.heat})`); }
    // 2. Passion + priority target
    k.gainPassion(1); if (!this.priorityTarget || k.passion > this.priorityTarget.passion) { this.priorityTarget = k; }
    await this.fx.beforeAttack(k, A);
    await this.fx.exertWindow(k, A, 'Attack Roll 전');
    // 3. Attack roll
    let dice = w.attackDice + this.fx.extraAttackDice(k, w, A); let prec = w.precision + this.fx.precision(k) + this.poolCount('opening') + this.poolCount('closing');
    const roll = rollD10s(this.rng, dice); const toHit = this.monster.toHit + this.monster.modifiers.toHit;
    const isHit = d => d.v === 10 ? true : d.v === 1 ? false : d.v + prec >= toHit;
    this.say(`${k.name} Attack Roll ${dice}d → [${roll.dice.map(d => d.v).join(' ')}] (재굴림 전)`, 'dice');
    await this.fx.exertWindow(k, A, 'Attack Roll 후, 재굴림 전');
    prec = w.precision + this.fx.precision(k) + this.poolCount('opening') + this.poolCount('closing');
    let misses = roll.dice.filter(d => !isHit(d));
    if (misses.length && (k.heat < k.heatLimit || this.poolCount('closing'))) {
      const maxR = Math.min(misses.length, (k.heatLimit - k.heat) + this.poolCount('closing'));
      const picked = await this.ask({ type: 'dice', knight: k.id, text: `${k.name} Attack ${dice}d vs ${toHit}+ (보너스 +${prec}) — 재굴림 (Closing ${this.poolCount('closing')}개 무료, 이후 Heat +1/개)`, dice: roll.dice.map(d => ({ v: d.v, crit: d.crit, hit: isHit(d), canReroll: !d.rerolled })), max: maxR });
      if (picked && picked.length) { const free = Math.min(picked.length, this.poolCount('closing')); this.poolTake('closing', free); const paid = picked.length - free; if (paid) k.gainHeat(paid, { voluntary: true }); for (const i of picked) { const d = roll.dice[i]; d.v = this.rng.die(10); d.rerolled = true; } }
    }
    A.hits = roll.dice.filter(isHit).length; A.critChance = roll.dice[0].v === 10 || (this.fx.has(k, 'deadly') && roll.dice[0].v >= 9);
    this.say(`${k.name} Attack Roll ${dice}d vs ${toHit}+ (+${prec}) → [${roll.dice.map(d => d.v + (d.rerolled ? '*' : '')).join(' ')}] 명중 ${A.hits}/${dice}${A.critChance ? ' ★Crit Chance' : ''}`, 'dice');
    if (A.hits === 0) { this.say(`${k.name} Full Miss`); await this.fx.onFullMiss(k, A); this.clearPool(); await this.fx.secondWindow(k, A); this.currentKnightAttack = null; return; }
    if (A.hits === dice) await this.fx.onFullHit(k, A);
    // 4. first ability window (a Chain Break here ends the attack: clear pool + second window, p.54)
    try { await this.fx.firstWindow(k, A); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); this.clearPool(); await this.fx.secondWindow(k, A); this.currentKnightAttack = null; return; }
    // 5. determine BP
    let bp = this.monster.drawBP(); if (!bp) { this.say('BP 덱 비어 있음'); this.currentKnightAttack = null; return; }
    if (this.fx.has(k, 'heartseeker', A)) { const alt = this.monster.drawBP(); if (alt) { const pick = await this.ask({ type: 'heartseeker', options: [bp, alt].map(c => ({ label: `${c.name} (AT ${this.bpAT(c)})`, value: c.name })) }); const chosen = [bp, alt].find(c => c.name === pick); const other = chosen === bp ? alt : bp; this.monster.bp.cards.unshift(other); bp = chosen; } }
    A.bp = bp; this.say(`BP ${bp.level}: ${bp.name} (AT ${this.bpAT(bp)})`, 'bp');
    // Ultrainstinct (Impenetrable Shell)
    if (!A.critChance && this.monster.hasTrait('Impenetrable Shell') && this.armorTokens[bp.level] > 0 && this.frontCells().some(c => cellEq(c, k.pos))) { this.say('Ultrainstinct: Impenetrable Shell → Knockback 1'); await this.pushback(k, 1); }
    await this.fx.exertWindow(k, A, 'Power Roll 전');
    // 6. power roll
    const pool = buildPowerPool({ red: (w.weaponPower && w.weaponPower.colour === 'red' ? w.weaponPower.n * A.hits : 0) + (k.powerDie === 'red' ? 1 : 0) + A.extraPool.red, black: (w.weaponPower && w.weaponPower.colour === 'black' ? w.weaponPower.n * A.hits : 0) + (k.powerDie === 'black' ? 1 : 0) + A.extraPool.black, white: (w.weaponPower && w.weaponPower.colour === 'white' ? w.weaponPower.n * A.hits : 0) + (k.powerDie === 'white' ? 1 : 0) + A.extraPool.white, raw: (w.bonusPower && w.bonusPower.raw ? w.bonusPower.raw : 0) + A.extraPool.raw }, this.data.components.dice.limits);
    if (w.bonusPower && w.bonusPower.colour) pool[w.bonusPower.colour] += w.bonusPower.n;
    const pr = rollPowerPool(this.rng, pool, this.data.components.dice.faces);
    this.say(`Power Roll ${pr.dice.map(d => d.colour[0]).join('')} +raw${pool.raw} → ⚔${pr.power} ✦${pr.potential} 🕊${pr.hope}`, 'dice');
    await this.fx.exertWindow(k, A, 'Power Roll 후, 재굴림 전');
    // power re-rolls (Heroic Arc / tokens)
    let rerolls = A.powerRerolls + this.poolCount('black');
    if (rerolls && pr.dice.length) { const face = f => `${'⚔'.repeat(f.P || 0)}${'✦'.repeat(f.T || 0)}${'🕊'.repeat(f.H || 0)}` || '—'; const picked = await this.ask({ type: 'dice', knight: k.id, text: `Power 재굴림 가능 ${rerolls}개 (Black 토큰 ${this.poolCount('black')} 포함)`, dice: pr.dice.map(d => ({ v: face(d.face), colour: d.colour, hit: !!d.face.P, canReroll: true })), max: rerolls }); if (picked && picked.length) { const fromBlack = Math.max(0, picked.length - A.powerRerolls); this.poolTake('black', fromBlack); for (const i of picked) pr.dice[i].face = this.rng.pick(this.data.components.dice.faces[pr.dice[i].colour]); this.say(`재굴림 ${picked.length} → ⚔${pr.dice.reduce((a, d) => a + (d.face.P || 0), 0) + pool.raw}`); } }
    let power = pr.dice.reduce((a, d) => a + (d.face.P || 0), 0) + pool.raw; let potential = pr.dice.reduce((a, d) => a + (d.face.T || 0), 0) + pool.potential; const hope = pr.dice.reduce((a, d) => a + (d.face.H || 0), 0);
    // potentials → power via Break / Sunder / Hope / Fire tokens
    let useS = 0, useB = 0, useH = 0;
    if (potential && this.poolCount('sunder')) { useS = await this.askCount(`Sunder 토큰 사용 (✦1 → ⚔2), 보유 ${this.poolCount('sunder')}, ✦${potential}`, Math.min(potential, this.poolCount('sunder'))); power += 2 * useS; potential -= useS; this.poolTake('sunder', useS); }
    if (potential && this.poolCount('break')) { useB = await this.askCount(`Break 토큰 사용 (✦1 → ⚔1), 보유 ${this.poolCount('break')}, ✦${potential}`, Math.min(potential, this.poolCount('break'))); power += useB; potential -= useB; this.poolTake('break', useB); }
    if ((potential || hope) && this.poolCount('hope')) { useH = await this.askCount(`Hope 토큰 사용 (✦/🕊 1 → ⚔1), 보유 ${this.poolCount('hope')}`, Math.min(potential + hope, this.poolCount('hope'))); power += useH; this.poolTake('hope', useH); }
    await this.fx.exertWindow(k, A, '✦ 변환 단계');
    if (potential && this.poolCount('sunder') && !useS) { const n = await this.askCount(`Sunder 토큰 사용 (✦1 → ⚔2), 보유 ${this.poolCount('sunder')}, ✦${potential}`, Math.min(potential, this.poolCount('sunder'))); power += 2 * n; potential -= n; this.poolTake('sunder', n); useS += n; }
    if (potential && this.poolCount('break')) { const n = await this.askCount(`Break 토큰 사용 (✦1 → ⚔1), 보유 ${this.poolCount('break')}, ✦${potential}`, Math.min(potential, this.poolCount('break'))); power += n; potential -= n; this.poolTake('break', n); useB += n; }
    if ((potential || hope) && this.poolCount('hope')) { const n = await this.askCount(`Hope 토큰 사용 (✦/🕊 1 → ⚔1), 보유 ${this.poolCount('hope')}`, Math.min(potential + hope - useH, this.poolCount('hope'))); power += n; this.poolTake('hope', n); useH += n; }
    // Fire: other tokens may be used first, then as many Fire tokens as possible are mandatory (p.19)
    if (potential > 0 && this.poolCount('fire')) { const n = Math.min(potential, this.poolCount('fire')); power += n; potential -= n; this.poolTake('fire', n); this.say(`Fire 토큰 ${n}개 사용 (✦ → ⚔)`); }
    power += this.poolCount('power'); this.poolTake('power', 99);
    A.totalPower = power; const at = this.bpAT(bp) - A.armorPiercing;
    this.say(`Total Power ${power} vs AT ${at}${useB ? ` (Break ${useB})` : ''}${useS ? ` (Sunder ${useS})` : ''}`, 'dice');
    // 6.5 resolve
    A.wounded = power >= at; A.critical = A.wounded && A.critChance; A.overAT = power - at;
    const ops = bp.ops;
    if (A.wounded) this.say(`${A.critical ? '★ Critical Wound' : 'Wound'}!`, 'wound'); else this.say('Fail to wound');
    // Overcome
    if (ops.overcome && ((!A.wounded && power >= ops.overcome.n) || (A.wounded && A.overAT >= ops.overcome.n))) { this.say(`Overcome ${ops.overcome.n}+`); await this.fx.runMonsterOps(ops.overcome.ops, { attacker: k, attack: A }); }
    // 7. responses
    const resp = []; if (A.critical) { if (ops.critical) resp.push(['Critical', ops.critical]); } else { if (A.wounded && ops.wound) resp.push(['Wound', ops.wound]); if (!A.wounded && ops.fail) resp.push(['Fail', ops.fail]); if (ops.instinct) resp.push(['Instinct', ops.instinct]); }
    const ignore = A.ignoreResponses || (this.poolCount('improvedDiversion') && !A.critical) || (this.poolCount('diversion') && !A.wounded && !A.critical);
    const deferred = [];
    // 8. wounds & escalation (before responses that move the monster? Rulebook: responses step 7 then wounds step 8; responses that are Monster Attacks happen after)
    if (A.wounded) { const dealt = this.monster.wound(bp, { critical: A.critical }); this.monster.generic.counter = (this.monster.generic.counter || 0) + dealt; this.say(`Wound Stack ${this.monster.wounds}/${this.monster.woundsToKill}`, 'wound'); await this.fx.onWound(k, A); this.priorityLast = k; }
    else this.monster.discardBP(bp);
    for (const [kind, rops] of resp) { if (ignore && kind !== 'Critical') { this.say(`${kind} Response 무시 (${A.ignoreResponses ? 'Distracting Bait' : 'Diversion'})`); continue; } this.say(`${kind} Response`); const isAttack = rops.some(o => o.op === 'signature' || o.op === 'aiAttack'); if (isAttack) deferred.push(rops); else { try { await this.fx.runMonsterOps(rops, { attacker: k, attack: A, target: k }); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); } } }
    if (this.monster.slain) { this.checkEnd(); }
    // 9. clear pool
    if (!this.fx.has(k, 'skipClearPool', A)) this.clearPool();
    // 10. second window
    await this.fx.secondWindow(k, A);
    this.currentKnightAttack = null;
    for (const rops of deferred) { try { await this.fx.runMonsterOps(rops, { attacker: k, attack: A, target: k }); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); } }
    for (let i = 0; i < k.bonusAttacks; i++) { k.bonusAttacks = 0; await this.knightAttack(k, { bonus: true }); }
    k.bonusAttacks = 0;
    await this.afterAction();
  }
  bpAT(bp) { return this.monster.atOf(bp, (this.monster.hasTrait('Panzeronion') ? this.armorTokens[bp.level] : 0)); }
  clearPool() { const fire = this.pool.filter(t => t.token === 'fire'); const keep = [...this.pool.filter(t => t.resource), ...fire.slice(1)]; /* Fire: leave all but one unused Fire token (p.19) */ const n = this.pool.length - keep.length; this.pool = keep; if (n) this.say(`Knight Pool 정리 (-${n})`, 'pool'); }
  /** After any action: Counter trait (Eggknight). */
  async afterAction() {
    if (this.monster.hasTrait('Counter') && (this.monster.generic.counter || 0) >= 3) { this.monster.generic.counter = 0; this.say('Counter: 토큰 3 → Signature'); await this.performSignature(); }
  }
  async windowOfOpportunity(when, attack, target = null) { await this.fx.reactions(when, attack, target); }
}
