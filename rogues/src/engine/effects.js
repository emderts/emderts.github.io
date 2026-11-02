// Effects: interprets data `ops` for Monster cards/traits, Mortis, Conditions, Techniques, Gear, Heroic Arcs, Talents.
// Every op name used by data must exist in MONSTER_OPS / MORTIS_OPS / KNIGHT_OPS; test/ops.mjs checks that.
import { ChainBreak } from './clash.js';

const TIER_RANK = { MOB: 1, VASSAL: 2, KING: 3, DEVIL: 4, DRAGON: 5 };
const POOL_TOKENS = ['opening', 'break', 'closing', 'hope', 'fire', 'black', 'sunder', 'rouse', 'power', 'diversion', 'improvedDiversion', 'cantrip', 'spell'];
const TOKEN_KEY = { Break: 'break', Opening: 'opening', Closing: 'closing', Hope: 'hope', Fire: 'fire', Black: 'black', Sunder: 'sunder', Rouse: 'rouse', Power: 'power', Diversion: 'diversion', ImprovedDiversion: 'improvedDiversion', Fleisch: 'fleisch' };

export class Effects {
  constructor(clash) { this.c = clash; }
  get rng() { return this.c.rng; }
  say(m, k) { return this.c.say(m, k); }
  tierOk(k, gate) { const need = TIER_RANK[gate]; return need ? (k.tier || 1) >= need : false; }
  perilGateOk(k, gate) { const order = ['Uninjured', 'Minor', 'Major', 'Grave', 'Judicium']; const i = order.indexOf(gate[0] + gate.slice(1).toLowerCase()); return i >= 1 && order.indexOf(k.peril()) >= i; }

  // ---------- knight stat queries ----------
  evasionBonus(k) { let b = 0; for (const g of k.gear) if (!g.discarded && g.evasion) b += g.evasion; for (const c of k.conditions) { const d = this.c.conditionDefs[c.id]; if (d && d.ops && d.ops.evasion) b += d.ops.evasion; } return b; }
  precision(k) { let p = 0; for (const c of k.conditions) { const d = this.c.conditionDefs[c.id]; if (d && d.ops && d.ops.precision) p += d.ops.precision; } p += k.modifiers.precision || 0; return p; }
  speed(k) { return k.speed + (k.modifiers.speed || 0); }
  armorDice(k) { const d = { red: 0, black: 0, white: 0 }; for (const g of k.gear) if (!g.discarded && g.armorDice) for (const col in g.armorDice) d[col] += g.armorDice[col]; if (k.tempArmor) for (const col in k.tempArmor) d[col] += k.tempArmor[col]; return d; }
  soak(k) { return k.soak || 0; }
  blockValue(k) { return k.block || 0; }
  involuntaryReduction(k) { return k.involuntaryReduction || 0; }
  has(k, flag, A = null) { if (k.flags && k.flags.has(flag)) return true; if (A && A.flags && A.flags.has(flag)) return true; if (flag === 'deadly' && A && this.weaponHas(A.weapon, 'deadly')) return true; return false; }
  weaponHas(w, kw) { return !!(w.ops && w.ops.keywords && w.ops.keywords.some(o => o.op === kw)); }
  extraAttackDice(k, w, A) { let n = 0; if (w.name === 'Knighves' && !k.gear.some(g => g.type === 'weapon' && g !== w && !g.discarded)) n += 1; /* two-handed Knighves */ return n + (A.extraAttackDice || 0); }
  enforceHandLimit(k) { const lim = k.handLimit + k.conditions.reduce((a, c) => { const d = this.c.conditionDefs[c.id]; return a + (d && d.ops && d.ops.handLimit ? d.ops.handLimit : 0); }, 0); while (k.hand.length > Math.max(0, lim)) { const card = k.hand.pop(); k.underCondition = k.underCondition || []; k.underCondition.push(card); this.say(`${k.name}: 손패 제한 ${lim} → ${card.name} 보류`); } }

  // ---------- Heroic Arc ----------
  /** Options available this attack: levels ≤ passion whose option not yet used this attack. */
  arcLevels(k) { return k.heroicArc.levels.filter(l => l.level <= k.passion + (this.c.poolCount('rouse') ? 1 : 0)); }
  arcPlus(k) { return k.heroicArc.plus ? k.heroicArc.plus.ops || [] : []; }
  tokensOf(opt, timing) { return opt.filter(t => (timing === 'first' ? ['Pushback', 'Vault', 'Hug', 'Reposition', 'Drag', 'Daze', 'Provoke', 'Tireless', 'Deadly', 'Heartseeker', 'Envenomed'].includes(t.token) : timing === 'power' ? ['PowerReroll', 'PowerDieRed', 'PowerDieBlack', 'PowerDieWhite', 'PowerDicePromotion'].includes(t.token) : ['Break', 'Opening', 'Closing', 'Hope', 'Fire', 'Black', 'Sunder', 'Rouse', 'Power', 'Diversion', 'Fleisch', 'BPSuppress', 'AISuppress'].includes(t.token))); }
  async beforeAttack(k, A) {
    A.flags = new Set(); A.arcChoice = {};
    // Talent: Meat Provisions
    if (k.talent && k.talent.abilities.some(a => a.ops && a.ops.some(o => o.op === 'onAttackDeclare'))) { if (!this.c.poolCount('opening') && !this.c.poolCount('break')) { this.c.poolAdd('opening', 1); this.c.poolAdd('break', 1); this.say('Meat Provisions'); } }
    // Heroic Arc: choose one option per level (ask when two)
    for (const L of this.arcLevels(k)) { let opt = L.options[0]; if (L.options.length > 1) { const v = await this.c.ask({ type: 'arcOption', knight: k.id, level: L.level, options: L.options.map((o, i) => ({ label: `L${L.level}: ${o.map(t => t.token + (t.n != null ? ' ' + t.n : '')).join(' + ')}`, value: i })) }); opt = L.options[v]; } A.arcChoice[L.level] = opt; }
    // plus row + power-timing tokens
    const allTok = [...this.arcPlus(k).map(o => ({ token: o.token, n: o.n })), ...Object.values(A.arcChoice).flat()];
    for (const t of allTok) { if (t.token === 'PowerReroll') A.powerRerolls += t.n || 1; if (t.token === 'PowerDieRed') A.extraPool.red += t.n || 1; if (t.token === 'PowerDieBlack') A.extraPool.black += t.n || 1; if (t.token === 'PowerDieWhite') A.extraPool.white += t.n || 1; if (t.token === 'Deadly') A.flags.add('deadly'); if (t.token === 'Heartseeker') A.flags.add('heartseeker'); if (t.token === 'Tireless') A.flags.add('tireless'); if (t.token === 'Envenomed') A.envenomed = (A.envenomed || 0) + (t.n || 1); if (t.token === 'Precision') A.extraPrecision = (A.extraPrecision || 0) + (t.n || 1); if (t.token === 'ArmorReroll') { /* defensive */ } if (t.token === 'AutoHope') { this.c.poolAdd('hope', t.n || 1); } if (t.token === 'AutoBlack') this.c.poolAdd('black', t.n || 1); }
    // Courage: Auto-break 1
    if (this.c.hasCondition(k, 'Courage')) this.c.poolAdd('break', 1);
    // pre-attack techniques (Prized Morsel, Butcher's Twine) are used as free actions before attacking; flags set there
    if (k.pendingAttackFlags) { for (const f of k.pendingAttackFlags) A.flags.add(f); if (k.pendingExtraPool) for (const col in k.pendingExtraPool) A.extraPool[col] += k.pendingExtraPool[col]; k.pendingAttackFlags = null; k.pendingExtraPool = null; }
    // weapon keywords with first-window timing are offered in firstWindow
  }
  async firstWindow(k, A) {
    const first = Object.values(A.arcChoice).flat().filter(t => ['Pushback', 'Vault', 'Hug', 'Reposition', 'Drag', 'Daze', 'Provoke'].includes(t.token)).map((t, i) => ({ ...t, id: i }));
    const avail = [...first];
    while (avail.length) {
      const pick = await this.c.ask({ type: 'pick', knight: k.id, text: '1차 능력 창 — 사용할 능력과 순서를 선택 (끝내려면 "넘어가기")', options: [...avail.map(t => ({ label: `${t.token}${t.n ? ' ' + t.n : ''}`, value: t.id })), { label: '넘어가기', value: 'skip' }] });
      if (pick === 'skip' || pick == null) break;
      const t = avail.find(x => x.id === pick); if (!t) break; avail.splice(avail.indexOf(t), 1);
      if (t.token === 'Pushback') await this.pushMonster(k, t.n);
      else if (t.token === 'Vault') await this.vault(k);
      else if (t.token === 'Hug') await this.hug(k, t.n);
      else if (t.token === 'Provoke') { this.c.priorityTarget = k; this.c.turnToward(k.pos); this.say(`Provoke: ${k.name}이 Priority Target, 몬스터가 바라봄`); }
      else if (t.token === 'Daze') { if (this.c.adjacentToMonster(k)) { const f = this.c.monster.facing; this.c.monster.facing = { N: 'S', S: 'N', E: 'W', W: 'E' }[f]; this.say('Daze: 몬스터가 등을 돌림'); } }
      else if (t.token === 'Reposition') await this.c.knightMove(k, t.n);
      else this.say(`[1st window 미구현] ${t.token}`, 'warn');
      if (!this.c.adjacentToMonster(k)) throw new ChainBreak(`${k.name}: 사거리 이탈`);
    }
    const ap = A.weapon.ops && A.weapon.ops.gates ? A.weapon.ops.gates.filter(g => g.when === 'GRAVE' && this.perilGateOk(k, 'GRAVE')).flatMap(g => g.ops).filter(o => o.op === 'armorPiercing') : []; for (const o of ap) { A.armorPiercing += o.n; this.say(`Armor-piercing ${o.n}`); }
  }
  async secondWindow(k, A) {
    // Heroic Arc tokens (mandatory, 1 option per level) + weapon keywords (Break X etc.)
    const toks = Object.values(A.arcChoice || {}).flat();
    for (const t of toks) { const key = TOKEN_KEY[t.token]; if (key === 'fleisch') { this.c.poolAdd('fleisch', t.n || 1, { resource: true }); } else if (key) this.c.poolAdd(key, t.n || 1); else if (t.token === 'BPSuppress') { this.c.monster.bp.cards.push(...this.c.monster.bp.discard); this.c.monster.bp.discard = []; this.c.monster.bp.shuffle(); this.say('BP Suppress'); } else if (t.token === 'AISuppress') { this.c.monster.ai.cards.push(...this.c.monster.ai.discard); this.c.monster.ai.discard = []; this.c.monster.ai.shuffle(); this.say('AI Suppress'); } }
    if (A.weapon.ops && A.weapon.ops.keywords) for (const o of A.weapon.ops.keywords) { if (o.op === 'break') this.c.poolAdd('break', o.n); if (o.op === 'opening') this.c.poolAdd('opening', o.n); }
    // Hangry technique
    if (A.flags && A.flags.has('hangry')) { const n = Math.floor(Math.max(0, A.overAT || 0) / 3); if (n) this.c.poolAdd('power', n); }
    if (A.leaveTokens) { for (const [tok, n] of A.leaveTokens) this.c.poolAdd(tok, n); }
  }
  async onWound(k, A) { if (A.envenomed) { const extra = Math.min(A.envenomed, Math.max(0, A.overAT)); this.c.poolAdd('break', A.envenomed + extra); this.say(`Envenomed ${A.envenomed}`); } if (this.c.hasCondition(k, 'Courage')) { /* stays */ } }
  async onFullMiss(k, A) { if (this.c.hasCondition(k, 'Courage')) this.c.removeCondition(k, 'Courage'); }
  async onFullHit(k, A) { }
  async onArmorRoll(k, mitigated) { const rb = k.talent && k.talent.abilities.find(a => a.ops && a.ops.some(o => o.op === 'onArmorRoll')); if (rb && mitigated > 0) { const op = rb.ops.find(o => o.op === 'onArmorRoll'); for (let i = 1; i <= Math.min(5, mitigated); i++) for (const o of op.byMitigated[i] || []) this.c.poolAdd(o.token, o.n, o.token === 'fleisch' ? { resource: true } : {}); } }

  async pushMonster(k, n) {
    const M = this.c.monster, B = this.c.board; const m = this.c.monsterCenter(); const dc = m.c - k.pos.c, dr = m.r - k.pos.r; const d = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) };
    let moved = 0; for (let i = 0; i < n; i++) { const r = await this.c.monsterStep(d); if (r !== 'ok') break; moved++; }
    this.say(`${k.name} Pushback ${moved}/${n}: 몬스터 → ${M.cells.map(c => B.label(c)).join('/')}`);
  }
  async vault(k) { const B = this.c.board; const m = this.c.monsterCenter(); const d = { c: Math.sign(m.c - k.pos.c), r: Math.sign(m.r - k.pos.r) }; const far = this.c.monster.cells.map(c => ({ c: c.c + (d.c || 0), r: c.r + (d.r || 0) })).filter(c => B.inside(c) && !this.c.monster.cells.some(x => x.c === c.c && x.r === c.r) && !B.isObstacle(c) && !this.c.knightAt(c)); const dest = far.sort((a, b) => (Math.abs(b.c - k.pos.c) + Math.abs(b.r - k.pos.r)) - (Math.abs(a.c - k.pos.c) + Math.abs(a.r - k.pos.r)))[0]; if (dest) { this.c.moveKnight(k, dest); this.say(`Vault → ${B.label(dest)}`); } }
  async hug(k, n) { const B = this.c.board; const cells = this.c.reachable(k, n).filter(c => B.footprintsAdjacent([c], this.c.monster.cells)); if (!cells.length) return; const dest = await this.c.ask({ type: 'move', knight: k.id, cells, options: cells.map(c => ({ label: B.label(c), value: c })) }); if (dest) { this.c.moveKnight(k, dest); this.say(`Hug → ${B.label(dest)}`); } }

  // ---------- techniques / free actions ----------
  _payable(k, c) { return c.res === 'Heat' ? k.heat + c.n <= k.heatLimit : c.res === 'Fleisch' ? this.c.poolCount('fleisch') + (k.fleischBoard || 0) >= -c.n : c.res === 'Action' ? !!k.actions && c.actions.every(a => k.actions[a]) : false; }
  canPay(k, cost) { const alts = Array.isArray(cost[0]) ? cost : [cost]; return alts.some(alt => alt.every(c => this._payable(k, c))); }
  pay(k, cost) { const alts = Array.isArray(cost[0]) ? cost : [cost]; const alt = alts.find(a => a.every(c => this._payable(k, c))) || alts[0]; for (const c of alt) { if (c.res === 'Action') { for (const a of c.actions) k.actions[a] = false; this.say(`${k.name}: ${c.actions.map(a => a === 'combat' ? '전투 행동' : '이동 행동').join(' + ')} 소모`); } else if (c.res === 'Heat') { if (k.talent && k.talent.abilities.some(a => a.ops && a.ops.some(o => o.op === 'fleischAsHeat')) && this.c.poolCount('fleisch') >= c.n && k.fleischUseForHeat) this.c.poolTake('fleisch', c.n); else k.gainHeat(c.n, { voluntary: true }); } else { let need = -c.n; const fromPool = Math.min(need, this.c.poolCount('fleisch')); this.c.poolTake('fleisch', fromPool); need -= fromPool; k.fleischBoard = (k.fleischBoard || 0) - need; } } }
  costLabel(k, t) { const alts = Array.isArray(t.cost[0]) ? t.cost : [t.cost]; return alts.map(a => a.map(c => c.res === 'Heat' ? `Heat +${c.n}` : c.res === 'Action' ? c.actions.map(x => x === 'combat' ? '전투 행동' : '이동 행동').join('+') : `Fleisch ${c.n}`).join(', ')).join(' 또는 '); }
  usableTechniques(k) { return k.hand.filter(t => t.ops && t.timing === 'free' && this.canPay(k, t.cost) && !(this.c.hasCondition(k, 'Knockdown (Falling Down)') && !t.ops.some(o => o.op === 'standUp')) || (t.timing === 'complicated' && k.actions && k.actions.move && k.actions.combat && this.canPay(k, t.cost)) || (['beforeAttack', 'beforePowerRoll', 'secondWindow', 'afterAttackRoll', 'onClearPool'].includes(t.timing) && k.actions && (k.actions.combat || k.actions.extraCombat) && this.canPay(k, t.cost) && this.c.canAttack(k))); }
  activeOps(k, t) { const gates = Object.keys(t.gateOps || {}).filter(g => this.tierOk(k, g)).sort((a, b) => TIER_RANK[b] - TIER_RANK[a]); return gates.length ? t.gateOps[gates[0]] : t.ops; }
  async useTechnique(k, t) {
    this.pay(k, t.cost); this.say(`${k.name} 기술 사용: ${t.name}`, 'tech');
    const ops = this.activeOps(k, t);
    if (['beforeAttack', 'beforePowerRoll', 'secondWindow', 'afterAttackRoll', 'onClearPool'].includes(t.timing)) { k.pendingAttackFlags = k.pendingAttackFlags || new Set(); for (const o of ops) { if (o.op === 'heartseeker') k.pendingAttackFlags.add('heartseeker'); if (o.op === 'addPowerDie') { k.pendingExtraPool = k.pendingExtraPool || { red: 0, black: 0, white: 0, raw: 0 }; k.pendingExtraPool[o.colour]++; } if (o.op === 'ignoreResponses') k.pendingAttackFlags.add('ignoreResponses'); if (o.op === 'skipClearPool') k.pendingAttackFlags.add('skipClearPool'); if (o.op === 'poolPer') k.pendingAttackFlags.add('hangry'); if (o.op === 'reach') k.pendingAttackFlags.add('reach3'); if (o.op === 'if') { /* Prized Morsel: condition on pool */ if (o.cond === 'poolHas:opening' && this.c.poolCount('opening')) k.pendingAttackFlags.add('heartseeker'); } } }
    else await this.runKnightOps(ops, k, { technique: t });
    this.deplete(k, t);
  }
  deplete(k, t, how = t.depletion) { const i = k.hand.indexOf(t); if (i >= 0) k.hand.splice(i, 1); if (how === 'cooldown') k.cooldown.push(t); else if (how === 'delay') k.delay.push(t); else if (how === 'discard') k.discard.push(t); else if (how === 'instant') { (k.instant = k.instant || []).push(t); } else k.hand.push(t); }
  /** Exert (rulebook p.18/23): while performing an Attack, at any moment deplete a Technique from hand (no cost) to resolve
   *  only its upper-left Exert effect; deplete it by the symbol under the Exert icon. Offered at every step of the attack. */
  async exertWindow(k, A, stage) {
    const DEP = { cooldown: 'Cooldown', delay: 'Delay', discard: 'Discard', instant: 'Instant' };
    const NAME = { PowerReroll: 'Power Re-roll 1', Fleisch: 'Fleisch 토큰 1' };
    for (;;) {
      const opts = k.hand.filter(t => t.exert); if (!opts.length) return;
      const pick = await this.c.ask({ type: 'pick', knight: k.id, text: `${k.name} Exert? (${stage}) — 비용 없이 Technique를 소진하고 좌상단 효과만 사용`, options: [...opts.map(t => ({ label: `${t.name} → ${NAME[t.exert.token] || t.exert.token + ' 토큰 1'} (${DEP[t.exert.depletion]})`, value: t.name })), { label: '넘어가기', value: 'skip' }] });
      if (!pick || pick === 'skip') return;
      const t = opts.find(x => x.name === pick); if (!t) return;
      const e = t.exert;
      if (e.token === 'PowerReroll') { A.powerRerolls += e.n; this.say(`${k.name} Exert ${t.name}: Power Re-roll +${e.n}`); }
      else if (e.token === 'Fleisch') { this.c.poolAdd('fleisch', e.n, { resource: true }); this.say(`${k.name} Exert ${t.name}: Fleisch +${e.n}`); }
      else { this.c.poolAdd(TOKEN_KEY[e.token], e.n); this.say(`${k.name} Exert ${t.name}: ${e.token} +${e.n}`); }
      this.deplete(k, t, e.depletion);
    }
  }
  freeActions(k) { const out = []; const ch = this.c.hasCondition(k, 'Choked'); if (ch && k.chokeLimit > 0 && (k.actions.move || k.actions.combat)) out.push({ id: 'lowerChoke', label: `행동 소모 → Choke Limit -3 (현재 ${k.chokeLimit})` }); const ex = this.c.hasCondition(k, 'Exposed'); if (ex && (k.actions.move || k.actions.combat)) out.push({ id: 'discardExposed', label: '행동 소모 → Exposed 제거' }); if (k.talent && k.talent.id === 'fleischjager' && this.c.poolCount('fleisch') >= 1 && k.vigor > 1) out.push({ id: 'nurturing', label: 'Nurturing Fleisch (1 Fleisch, X Vigor → 인접 기사 +X)' }); return out; }
  async doFreeAction(k, id) {
    const spend = () => { if (k.actions.move) k.actions.move = false; else k.actions.combat = false; };
    if (id === 'lowerChoke') { spend(); k.chokeLimit = Math.max(0, k.chokeLimit - 3); if (k.chokeLimit === 0) this.c.removeCondition(k, 'Choked'); }
    else if (id === 'discardExposed') { spend(); this.c.removeCondition(k, 'Exposed'); }
    else if (id === 'nurturing') { const adj = this.c.alive().filter(o => o !== k && this.c.board.adjacent(o.pos, k.pos)); if (!adj.length) return; const whoId = await this.c.ask({ type: 'pickKnight', options: adj.map(o => ({ label: o.name, value: o.id })) }); const who = adj.find(o => o.id === whoId) || adj[0]; const x = await this.c.ask({ type: 'number', text: 'X (Vigor 지불)', options: Array.from({ length: k.vigor - 1 }, (_, i) => ({ label: String(i + 1), value: i + 1 })) }); this.c.poolTake('fleisch', 1); k.loseVigor(x); who.gainVigor(x); this.say(`Nurturing Fleisch: ${k.name} -${x} → ${who.name} +${x}`); }
  }
  async endOfTurn(k) { const p = this.c.hasCondition(k, 'Poisoned'); if (p && p.tokens) { const before = k.vigor; k.vigor = Math.max(1, k.vigor - p.tokens); this.say(`${k.name} Poisoned: Vigor -${before - k.vigor}`); } k.braced = false; }
  async endOfKnightRound(k) { }
  async reactions(when, attack, target) { /* Knight Roll (Reflex) as reaction: offered to the target before the attack */ if (when !== 'beforeAttack') return; for (const k of this.c.alive()) { for (const t of k.hand.filter(t => t.timing === 'reaction' && this.canPay(k, t.cost))) { if (attack.targets.includes(k) && await this.c.yesNo(`${k.name}: ${t.name} (${this.costLabel(k, t)}) 사용? (Reflex: 1칸 이동)`, false)) { this.pay(k, t.cost); const n = this.activeOps(k, t)[0].n || 1; const cells = this.c.reachable(k, n); if (cells.length) { const dest = await this.c.ask({ type: 'move', knight: k.id, cells, options: cells.map(c => ({ label: this.c.board.label(c), value: c })) }); if (dest) this.c.moveKnight(k, dest); } this.deplete(k, t); } } } }
  async secondChance(k, card, tier) { const t = k.hand.find(t => t.timing === 'onMortisDraw' && this.canPay(k, t.cost)); if (!t) return false; if (!await this.c.yesNo(`${k.name}: ${t.name} 사용해 ${card.name} 무시하고 다시 뽑기? (${this.costLabel(k, t)})`, card.ops.some(o => o.op === 'die'))) return false; this.pay(k, t.cost); this.deplete(k, t); return true; }

  // ---------- knight ops (Mortis / Technique) ----------
  async runKnightOps(ops, k, ctx = {}) { for (const o of ops) await this.runKnightOp(o, k, ctx); }
  async runKnightOp(o, k, ctx) {
    const C = this.c; const opt = async txt => !o.optional || await C.yesNo(txt, true);
    switch (o.op) {
      case 'loseVigor': return C.loseVigor(k, o.n, { source: 'effect', armor: false });
      case 'gainVigor': { const target = o.target === 'adjacentKnight' ? k : k; target.gainVigor(o.n); this.say(`${target.name} Vigor +${o.n} → ${target.vigor}`); return; }
      case 'loseHeat': k.heat = Math.max(0, k.heat - o.n); this.say(`${k.name} Heat -${o.n} → ${k.heat}`); return;
      case 'gainHeat': k.gainHeat(o.n); this.say(`${k.name} Heat +${o.n} → ${k.heat}`); return;
      case 'resetHeat': if (await opt('Heat를 0으로 리셋?')) { k.heat = 0; this.say(`${k.name} Heat 리셋`); } return;
      case 'resetHeatAndRaiseLimit': if (await opt(`Heat 리셋 + Heat Limit +${o.n}?`)) { k.heat = 0; k.heatLimitBonus = (k.heatLimitBonus || 0) + o.n; this.say(`${k.name} Heat 리셋, Heat Limit +${o.n}`); } return;
      case 'gainPassion': if (await opt(`Passion +${o.n}?`)) { k.gainPassion(o.n); this.say(`${k.name} Passion +${o.n} → ${k.passion}`); } return;
      case 'refresh': { for (let i = 0; i < o.n; i++) { if (k.cooldown.length) k.hand.push(k.cooldown.shift()); else if (k.delay.length) k.cooldown.push(k.delay.shift()); } this.say(`${k.name} Refresh ${o.n}`); return; }
      case 'restrain': { if (!k.cooldown.length) { if (o.ifNone) await this.runKnightOps(o.ifNone, k, ctx); return; } k.delay.push(...k.cooldown); k.cooldown = []; this.say(`${k.name} Restrain`); return; }
      case 'cooldown': { for (let i = 0; i < o.n; i++) { if (!k.hand.length) break; const c = k.hand.splice(this.rng.int(k.hand.length), 1)[0]; k.cooldown.push(c); this.say(`${k.name} Cooldown: ${c.name}`); } return; }
      case 'discard': { let n = 0; for (let i = 0; i < o.n; i++) { if (!k.hand.length) break; const c = k.hand.splice(this.rng.int(k.hand.length), 1)[0]; k.discard.push(c); n++; this.say(`${k.name} Discard: ${c.name}`); } if (!n && o.ifNone) await this.runKnightOps(o.ifNone, k, ctx); return; }
      case 'delay': { for (let i = 0; i < o.n; i++) { if (!k.hand.length) break; const c = k.hand.splice(this.rng.int(k.hand.length), 1)[0]; k.delay.push(c); } return; }
      case 'knockdown': return C.knockdown(k);
      case 'standUp': C.standUp(k); return;
      case 'condition': return C.addCondition(k, o.id);
      case 'discardCondition': { const cands = k.conditions.filter(c => !o.type || (this.c.conditionDefs[c.id] && this.c.conditionDefs[c.id].type === o.type)); if (!cands.length) { if (o.ifNot) await this.runKnightOps(o.ifNot, k, ctx); return; } if (o.optional && !await C.yesNo('Condition 카드 1장 제거?', true)) { if (o.ifNot) await this.runKnightOps(o.ifNot, k, ctx); return; } const id = cands.length === 1 ? cands[0].id : await C.ask({ type: 'pick', options: cands.map(c => ({ label: c.id, value: c.id })) }); C.removeCondition(k, id); return; }
      case 'discardAllConditions': { if (!k.conditions.length) { if (o.ifNone) await this.runKnightOps(o.ifNone, k, ctx); return; } k.conditions = []; this.say(`${k.name} 모든 Condition 제거`); return; }
      case 'exhaustAllGear': { const ex = k.gear.filter(g => !g.exhausted && !g.discarded && g.type === 'weapon'); if (!ex.length) { if (o.ifNone) await this.runKnightOps(o.ifNone, k, ctx); return; } for (const g of ex) g.exhausted = true; this.say(`${k.name} 모든 Gear 소진`); return; }
      case 'unexhaustGear': { const ex = k.gear.filter(g => g.exhausted); for (const g of (o.n === 'all' ? ex : ex.slice(0, 1))) g.exhausted = false; return; }
      case 'poolChoice': { for (let i = 0; i < o.n; i++) { const t = await C.ask({ type: 'pick', text: '토큰 선택', options: o.tokens.map(t => ({ label: t, value: t })) }); C.poolAdd(t, 1); } return; }
      case 'bonusAttack': { if (!k.alive || !C.canAttack(k)) { if (o.onFail) await this.runKnightOps(o.onFail, k, ctx); return; } if (o.optional && !await C.yesNo('Bonus Attack 수행?', true)) return; const w0 = C.monster.wounds; await C.knightAttack(k, { bonus: true }); if (o.onWound && C.monster.wounds > w0) { this.say('Wound 성공 → 생존'); ctx.lived = true; } else if (o.onFail) { await this.runKnightOps(o.onFail, k, ctx); } return; }
      case 'move': { const n = o.n === 'speed' ? this.speed(k) : o.n; if (!await opt(`최대 ${n}칸 이동?`)) return; await C.knightMove(k, n); return; }
      case 'chainBreak': throw new ChainBreak(ctx.card ? ctx.card.name : 'effect');
      case 'die': if (ctx.lived) return; return C.die(k, o.reason);
      case 'shuffleBack': { if (ctx.deck) { ctx.deck.cards.push(ctx.card); ctx.deck.shuffle(); ctx.shuffledBack = true; } return; }
      case 'perilCheck': return C.perilCheck(k);
      case 'judicium': return C.drawJudicium(k);
      case 'addJudicium': { const c = C.judiciumAll.find(j => j.name === o.name); if (c && !C.judiciumExtra.includes(c)) { C.judiciumExtra.push(c); this.say(`${o.name} Judicium 덱에 추가`, 'warn'); } return; }
      case 'drawNamed': return C.drawMortis(k, 'Minor', { named: o.name });
      case 'if': { const cond = o.cond === 'firstRound' ? C.firstRound : o.cond === 'knockedDown' ? C.knockedDown(k) : o.cond.startsWith('poolHas:') ? C.poolCount(o.cond.slice(8)) > 0 : false; return this.runKnightOps(cond ? o.then : (o.else || []), k, ctx); }
      case 'curseSave': { const diff = (C.curseLevel || 0) + o.level; const r = this.rng.die(10); this.say(`${k.name} Curse Save d10=${r} vs ${diff}`); if (r < diff) { ctx.failedBy = diff - r; await this.runKnightOps(o.fail, k, ctx); } return; }
      case 'bane': { const n = o.n === 'failedBy' ? ctx.failedBy : o.n; k.gainBane(n); this.say(`${k.name} Bane +${n} (${k.bane}/${k.baneLimit})`); if (!k.alive) { C.board.remove([k.pos]); C.checkEnd(); } return; }
      case 'parasitize': { const c = C.hasCondition(k, 'Panzer Parasite'); if (c) c.tokens += o.n; else await C.addCondition(k, 'Panzer Parasite', { tokens: o.n }); const c2 = C.hasCondition(k, 'Panzer Parasite'); if (c2 && c2.tokens >= 5) await C.die(k, 'Panzer Parasite'); return; }
      case 'poison': { const c = C.hasCondition(k, 'Poisoned'); if (c) c.tokens += o.n; else await C.addCondition(k, 'Poisoned', { tokens: o.n }); return; }
      case 'toxify': { await C.addCondition(k, 'Toxified', { tokens: o.n }); return; }
      case 'choice': { const i = await C.ask({ type: 'pick', options: o.options.map((x, i) => ({ label: x.map(y => y.op).join('+'), value: i })) }); return this.runKnightOps(o.options[i], k, ctx); }
      case 'provoke': C.priorityTarget = k; C.turnToward(k.pos); return;
      case 'daze': { const f = C.monster.facing; C.monster.facing = { N: 'S', S: 'N', E: 'W', W: 'E' }[f]; return; }
      case 'reflex': return C.knightMove(k, o.n);
      case 'rush': case 'improvedRush': { k.actions.move = false; k.actions.combat = false; const sp = this.speed(k) + (o.op === 'improvedRush' ? 2 : 1); await C.knightMove(k, sp); if (C.canAttack(k)) { C.poolAdd('break', 1); k.pendingAttackFlags = k.pendingAttackFlags || new Set(); if (o.op === 'improvedRush') k.pendingExtraPrecision = 1; await C.knightAttack(k); } return; }
      case 'braced': k.braced = true; this.say(`${k.name} Braced`); return;
      case 'rocksteady': k.flags = k.flags || new Set(); k.flags.add('rocksteady'); return;
      case 'motivate': { for (const o2 of C.alive().filter(x => x !== k)) await C.knightMove(o2, o.n); return; }
      case 'flipBodyCondition': { const c = k.conditions.find(c => this.c.conditionDefs[c.id] && this.c.conditionDefs[c.id].type === 'body' && this.c.conditionDefs[c.id].flipSide); if (c) { c.id = this.c.conditionDefs[c.id].flipSide; this.say(`${k.name}: Condition 뒤집음 → ${c.id}`); } return; }
      case 'resurrectAdjacent': { const dead = C.knights.filter(x => !x.alive); if (!dead.length) return; const who = dead[0]; who.alive = true; who.vigor = Math.ceil(who.maxVigor / 2); const cell = C.board.neighbors(k.pos).find(c => !C.knightAt(c) && !C.board.isObstacle(c) && !C.monster.cells.some(m => m.c === c.c && m.r === c.r)); if (cell) { who.pos = cell; C.board.place({ kind: 'knight', id: who.id }, [cell]); } this.say(`${who.name} 부활 (Vigor ${who.vigor})`); return; }
      case 'extraCombatAction': k.actions.extraCombat++; return;
      case 'meatPuppet': this.say('[미구현] Meat Puppet — 수동 처리', 'warn'); return;
      case 'secondChance': case 'superiorChance': case 'chooseJudicium': case 'reinforce': case 'reduceInvoluntary': case 'heartseeker': case 'addPowerDie': case 'ignoreResponses': case 'skipClearPool': case 'poolPer': case 'reach': return; // handled at their timing
      default: this.say(`[미구현 op] ${o.op}`, 'warn');
    }
  }
  async runMortis(card, k, tier) { const ctx = { card, deck: this.c.mortis[tier], shuffledBack: false }; try { await this.runKnightOps(card.ops || [], k, ctx); } catch (e) { if (e.chainBreak) throw e; throw e; } return ctx; }

  // ---------- monster ops (AI effects, responses, traits) ----------
  async runMonsterOps(ops, ctx) { for (const o of ops || []) await this.runMonsterOp(o, ctx); }
  async runMonsterOp(o, ctx) {
    const C = this.c; const t = ctx.target || ctx.attacker; const M = C.monster;
    switch (o.op) {
      case 'loseVigorPerHit': { const per = ctx.vigorPerHitOverride ?? o.n; const total = per * ctx.hits + M.bonuses.vigorLoss + (M.hasTrait('Jacked') && C.jackedTokens >= 9 ? 3 : 0) + (M.bonuses.vigorLossPerHit || 0) * ctx.hits; return C.loseVigor(t, total, { source: 'attack', perilCheck: o.perilCheck }); }
      case 'loseVigor': return C.loseVigor(t, o.n, { source: 'response', armor: false });
      case 'allKnightsLoseVigor': { for (const k of C.alive()) await C.loseVigor(k, o.n, { source: 'routine', armor: false }); return; }
      case 'knockdown': if (C.monsterDisabled && C.monsterDisabled.has('knockdown')) return; if (ctx.attack && ctx.attack.card && !C.adjacentToMonster(t) && ctx.attacker) return; return C.knockdown(t);
      case 'pushback': if (ctx.attacker && !C.adjacentToMonster(t)) { this.say('Pushback 무시 (비인접)'); return; } return C.pushback(t, o.n);
      case 'knockback': return C.pushback(t, o.n);
      case 'cooldown': if (C.monsterDisabled && C.monsterDisabled.has('cooldown')) return; return this.runKnightOp({ op: 'cooldown', n: o.n }, t, {});
      case 'discard': if (C.monsterDisabled && C.monsterDisabled.has('discard')) return; return this.runKnightOp({ op: 'discard', n: o.n }, t, {});
      case 'restrain': return this.runKnightOp({ op: 'restrain' }, t, {});
      case 'choke': { const c = C.hasCondition(t, 'Choked'); if (c) { t.chokeLimit += o.n; } else { await C.addCondition(t, 'Choked'); t.chokeLimit = o.n - 1; } if (t.heat <= t.chokeLimit) { t.heat = Math.min(t.heatLimit, t.chokeLimit + 1); } this.say(`${t.name} Choke Limit ${t.chokeLimit}`); return; }
      case 'condition': return C.addCondition(t, o.id);
      case 'perHitInOrder': { for (let i = 0; i < ctx.hits && i < o.effects.length; i++) await this.runMonsterOp(o.effects[i], ctx); return; }
      case 'gated': { if (t.heat >= o.gate.gte) await this.runMonsterOps(o.then, ctx); return; }
      case 'judicium': return C.drawJudicium(t);
      case 'die': return C.die(t, 'AI effect');
      case 'trait': { if (o.id === 'humpty-charge') { if (!M.hasTrait('Humpty Charge')) return; return C.humptyCharge(ctx.attacker || ctx.primary || null); } this.say(`[미구현 trait op] ${o.id}`, 'warn'); return; }
      case 'signature': return C.performSignature();
      case 'if': { const cond = o.cond === 'vigorLost' ? !!(ctx.attack && ctx.attack.vigorLost) : o.cond === 'attackerOnFrontSpace' ? C.frontCells().some(c => c.c === t.pos.c && c.r === t.pos.r) : false; return this.runMonsterOps(cond ? o.then : (o.else || []), ctx); }
      case 'repeatCard': { if (ctx.repeated) return; this.say(`${ctx.repeatCard.name} 반복`); await C.resolveMonsterAttack({ ...ctx.repeatCard, ops: { ...ctx.repeatCard.ops, afterFinalAttack: null } }, { repeated: true }); return; }
      case 'moveToCenter': { const B = C.board; const center = { c: 7, r: 4 }; const d = { c: Math.sign(center.c - C.monsterCenter().c + 0.5), r: Math.sign(center.r - C.monsterCenter().r + 0.5) }; let guard = 0; while (guard++ < 20 && !(C.monster.cells.some(c => c.c === 7 && c.r === 4))) { const dc = 7 - C.monster.cells[0].c, dr = 4 - C.monster.cells[0].r; if (!dc && !dr) break; const step = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) }; if (await C.monsterStep(step) !== 'ok') break; } await C.displaceKnightsUnderMonster(); this.say('몬스터가 보드 중앙으로 이동'); return; }
      case 'faceMostKnights': C.faceMostKnights(); return;
      case 'monsterModifier': M.modifiers[o.stat] += o.n; this.say(`몬스터 ${o.stat} ${o.n > 0 ? '+' : ''}${o.n} (영구)`); return;
      case 'bonusAttack': { const who = o.who === 'otherKnight' ? C.alive().filter(k => k !== ctx.attacker && C.canAttack(k)) : [ctx.attacker]; if (!who.length) return; let k = who[0]; if (who.length > 1) { const kid = await C.ask({ type: 'pickKnight', options: who.map(x => ({ label: x.name, value: x.id })) }); k = who.find(x => x.id === kid) || who[0]; } if (o.optional && !await C.yesNo(`${k.name} Bonus Attack?`, true)) return; k.bonusAttacks++; return; }
      case 'gainPassion': t.gainPassion(o.n); return;
      case 'leaveTokens': { ctx.attack.leaveTokens = ctx.attack.leaveTokens || []; for (let i = 0; i < o.n; i++) { const tok = await C.ask({ type: 'pick', text: '남길 토큰', options: o.tokens.map(x => ({ label: x, value: x })) }); ctx.attack.leaveTokens.push([tok, 1]); } return; }
      case 'returnAllTechniques': t.hand.push(...t.cooldown, ...t.delay, ...t.discard); t.cooldown = []; t.delay = []; t.discard = []; this.say(`${t.name} 모든 기술 회수`); return;
      case 'resetHeat': t.heat = 0; return;
      case 'discardArmorTokens': { if (o.from === 'all') { for (const l of [1, 2, 3]) C.armorTokens[l] = 0; this.say('모든 Armor 토큰 제거'); return; } for (let i = 0; i < o.n; i++) await C.loseArmorToken('response', { noTrait: o.noTrait }); return; }
      case 'disableMonsterKeywords': C.monsterDisabled = C.monsterDisabled || new Set(); for (const kw of o.keywords) C.monsterDisabled.add(kw); this.say(`몬스터 키워드 비활성: ${o.keywords.join(', ')}`); return;
      case 'additionalSingleWound': M.addSingleWound(); this.say(`추가 Single Wound (${M.wounds}/${M.woundsToKill})`, 'wound'); return;
      case 'disableTrait': M.disabledTraits.add(o.id === 'counter' ? 'Counter' : o.id); this.say(`Trait 비활성: ${o.id}`); return;
      case 'disableZoneAttacks': C.zoneDisabled = true; this.say('Zone 공격 비활성'); return;
      case 'slayMonster': { while (!M.slain) M.addSingleWound(); this.say('몬스터 즉사!', 'wound'); return; }
      case 'power': C.poolAdd('power', o.n); return;
      case 'armorTokens': C.armorTokens[o.bp] += o.n; this.say(`BP${o.bp} Armor 토큰 +${o.n}`); return;
      case 'passive': return;
      default: this.say(`[미구현 monster op] ${o.op}`, 'warn');
    }
  }
}
export const KNOWN_OPS = { monster: ['loseVigorPerHit', 'loseVigor', 'allKnightsLoseVigor', 'knockdown', 'pushback', 'knockback', 'cooldown', 'discard', 'restrain', 'choke', 'condition', 'perHitInOrder', 'gated', 'judicium', 'die', 'trait', 'signature', 'if', 'repeatCard', 'moveToCenter', 'faceMostKnights', 'monsterModifier', 'bonusAttack', 'gainPassion', 'leaveTokens', 'returnAllTechniques', 'resetHeat', 'discardArmorTokens', 'disableMonsterKeywords', 'additionalSingleWound', 'disableTrait', 'disableZoneAttacks', 'slayMonster', 'power', 'armorTokens', 'passive', 'humptyCharge', 'evasionDice', 'vigorPerHitInstead', 'difficultyInstead', 'drawGraveForColumn'],
  knight: ['loseVigor', 'gainVigor', 'loseHeat', 'gainHeat', 'resetHeat', 'resetHeatAndRaiseLimit', 'gainPassion', 'refresh', 'restrain', 'cooldown', 'discard', 'delay', 'knockdown', 'standUp', 'condition', 'discardCondition', 'discardAllConditions', 'exhaustAllGear', 'unexhaustGear', 'poolChoice', 'bonusAttack', 'move', 'chainBreak', 'die', 'shuffleBack', 'perilCheck', 'judicium', 'addJudicium', 'drawNamed', 'if', 'curseSave', 'bane', 'parasitize', 'poison', 'toxify', 'choice', 'provoke', 'daze', 'reflex', 'rush', 'improvedRush', 'braced', 'rocksteady', 'motivate', 'flipBodyCondition', 'resurrectAdjacent', 'extraCombatAction', 'meatPuppet', 'secondChance', 'superiorChance', 'chooseJudicium', 'reinforce', 'reduceInvoluntary', 'heartseeker', 'addPowerDie', 'ignoreResponses', 'skipClearPool', 'poolPer', 'reach'] };
