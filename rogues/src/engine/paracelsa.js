// Kingdoms Forlorn — Rogue's Path: Paracelsa (Knightbook "A Knight's Tale: Paracelsa") — Zeal tokens, Talents and Techniques.
// Zeal tokens live on the Knight Board (k.zeal). Spending one = move it from the Knight Board into the Knight Pool, or discard one from the Knight Pool.
const tops = (k, op) => (k.talent ? k.talent.abilities.flatMap(a => (a.ops || []).filter(o => o.op === op)) : []);
const techAt = (k, timing) => k.hand.find(t => t.timing === timing && t.ops);

export const ParacelsaMixin = {
  zealCfg(k) { return tops(k, 'zeal')[0] || null; },
  zealAvail(k) { return (k.zeal || 0) + this.poolCount('zeal'); },
  /** Sum of the stacking Talent benefits of one kind unlocked by the Zeal tokens on the Knight Board. */
  paraStat(k, kind) { const z = this.zealCfg(k); if (!z || !k.zeal) return 0; return z.benefits.filter(b => b.kind === kind && b.at <= k.zeal).reduce((a, b) => a + b.n, 0); },
  /** Zeal X: place X Zeal tokens on the Knight Board; above the Zeal Threshold the rest go to the Knight Pool. */
  gainZeal(k, n, why = '') { if (!n || n < 0) return 0; const z = this.zealCfg(k); const th = z && z.threshold ? z.threshold : Infinity; const onBoard = Math.max(0, Math.min(n, th - (k.zeal || 0))); k.zeal = (k.zeal || 0) + onBoard; const rest = n - onBoard; if (rest) this.poolAdd('zeal', rest, { resource: true }); this.say(`${k.name}: Zeal ${n}${why ? ` (${why})` : ''} → Knight Board ${k.zeal}${rest ? `, Knight Pool +${rest} (Zeal Threshold ${th})` : ''}`, 'tech'); return n; },
  /** Spend n Zeal (synchronous; the source preference was chosen in paraChooseSource). */
  spendZeal(k, n) { let fromBoard = 0; for (let i = 0; i < n; i++) { const board = (k.zeal || 0) > 0, pool = this.poolCount('zeal') > 0; if (!board && !pool) break; if (board && (k._zealFrom !== 'pool' || !pool)) { k.zeal--; this.poolAdd('zeal', 1, { resource: true }); fromBoard++; } else this.poolTake('zeal', 1); } k._zealFrom = null; this.say(`${k.name}: Zeal ${n} 사용 (Knight Board → Pool ${fromBoard}, Pool에서 버림 ${n - fromBoard}) — Board ${k.zeal || 0} · Pool ${this.poolCount('zeal')}`, 'tech'); if (fromBoard && tops(k, 'preachersPyre').length) { this.poolAdd('fire', 1); this.say("Preacher's Pyre: Fire 토큰 1", 'tech'); } },
  async paraChooseSource(k, n) { if ((k.zeal || 0) > 0 && this.poolCount('zeal') > 0) k._zealFrom = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Zeal ${n} 사용 — 어디서? (Board ${k.zeal} · Pool ${this.poolCount('zeal')})`, options: [{ label: 'Knight Board → Knight Pool로 옮김 (먼저)', value: 'board' }, { label: 'Knight Pool에서 버림 (먼저)', value: 'pool' }] }) || 'board'; },
  async paraUse(k, t, text) { if (!t || !this.fx.canPay(k, this.fx.costOf(k, t))) return null; if (!await this.yesNo(`${k.name}: ${t.name} 사용? (${this.fx.costLabel(k, t) || '비용 없음'}) — ${text || t.text}`, false)) return null; const pc = await this.fx.chooseCost(k, t); if (!pc) return null; this.fx.pay(k, pc.alt, pc.x); this.say(`${k.name} 기술 사용: ${t.name}`, 'tech'); const ops = this.fx.activeOps(k, t); const dep = (ops.find(o => o.depletion) || {}).depletion; this.fx.deplete(k, t, dep || t.depletion); await this.renTechniqueUsed(k); return ops; },
  async paraTurnStart(k) {
    for (const o of tops(k, 'turnZeal')) this.gainZeal(k, o.n, 'Start of your turn');
    for (const o of tops(k, 'fireOfZeal')) { const z = this.board.zone([k.pos], o.zone); const n = this.alive().filter(x => x !== k && z.some(c => c.c === x.pos.c && c.r === x.pos.r)).length; if (n) { this.poolAdd('fire', n); this.say(`The Fire of Zeal: Zone ${o.zone}의 다른 기사 ${n}명 → Fire ${n}`, 'tech'); } }
    k.pendingAttackRerolls = 0;
  },
  /** Start of an Attack: stacking benefits, Truthseeker Auto-hope, pending Technique effects. */
  async paraBeforeAttack(k, A) {
    const ar = this.paraStat(k, 'attackReroll') + (k.pendingAttackRerolls || 0); k.pendingAttackRerolls = 0; if (ar) A.attackRerolls = (A.attackRerolls || 0) + ar;
    const pr = this.paraStat(k, 'powerReroll'); if (pr) A.powerRerolls = (A.powerRerolls || 0) + pr;
    const pw = this.paraStat(k, 'power'); if (pw) A.extraPool.raw += pw;
    const ab = this.paraStat(k, 'autoBreak'); if (ab) this.poolAdd('break', ab);
    if (this.paraStat(k, 'deadly')) A.flags.add('deadly');
    A.zealBreak = this.paraStat(k, 'break');
    if (ar || pr || pw || ab || A.zealBreak) this.say(`${k.name}: Zeal ${k.zeal} 혜택 —${ar ? ` Attack Re-roll ${ar}` : ''}${pr ? ` Power Re-roll ${pr}` : ''}${pw ? ` +${pw} Power` : ''}${ab ? ` Auto-break ${ab}` : ''}${A.zealBreak ? ` Break ${A.zealBreak}` : ''}`, 'tech');
    for (const o of tops(k, 'zealAutoHope')) if ((k.zeal || 0) >= o.need) { this.poolAdd('hope', o.n); this.say(`${k.name}: Zeal ${o.need}+ → Auto-hope ${o.n}`, 'tech'); }
    if (k.pendingPara) { A.paraSecond = k.pendingPara.second || null; if (k.pendingPara.spotlight && this.priorityTarget === k) { A.extraPool.red += 1; this.say(`${k.name}: Spotlight — Priority Target → +1 빨간 Power die`, 'tech'); } if (k.pendingPara.red) A.extraPool.red += k.pendingPara.red; if (k.pendingPara.noOpening) A.flags.add('noOpening'); k.pendingPara = null; }
  },
  /** After the Attack Roll: Falsity, Zeal on misses / Crit Miss. */
  async paraAfterAttackRoll(k, A, roll, isHit) {
    const crit = roll.dice[0];
    if (crit && !crit.rerolled && (A.falsity || (A.kw || []).some(o => o.op === 'falsity')) && await this.yesNo(`${k.name}: Falsity — Crit die (${crit.v}${isHit(crit) ? ', 명중' : ', miss'})를 Heat 없이 재굴림?${isHit(crit) ? ' (이미 명중 → Zeal 1)' : ''}`, !isHit(crit))) { const was = isHit(crit); crit.v = this.rng.die(10); crit.rerolled = true; this.say(`Falsity: Crit die → ${crit.v}`, 'dice'); if (was) this.gainZeal(k, 1, 'Falsity'); }
    const z = this.zealCfg(k); if (!z) return; const miss = roll.dice.filter(d => !isHit(d)).length;
    if (z.onMiss && miss) this.gainZeal(k, z.onMiss, 'One or more Misses'); if (z.critMiss && crit && !isHit(crit)) this.gainZeal(k, z.critMiss, 'Crit Miss');
  },
  /** Dealing a Wound: Persecuted for Righteousness, Truthseeker / Apostate Talents. */
  async paraWound(k, A) {
    const ops = await this.paraUse(k, techAt(k, 'onDealWound')); if (ops) { this.gainZeal(k, 1, 'Persecuted for Righteousness'); this.priorityTarget = k; this.say(`${k.name}: Priority Target`, 'tech'); if ((k.zeal || 0) >= 3) { k.gainVigor(3); this.say(`${k.name}: Zeal 3+ → Vigor +3 (${k.vigor})`, 'tech'); } }
    for (const o of tops(k, 'woundChoice')) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Uncompromising Believer — Wound`, options: [{ label: 'Zeal 3 + Reposition 1', value: 'a' }, { label: 'Zeal 2 + Vigor +2', value: 'b' }, { label: 'Zeal 1 + Heat -3', value: 'c' }] }) || 'a'; if (v === 'a') { this.gainZeal(k, 3); A.paraRepo = (A.paraRepo || 0) + 1; } else if (v === 'b') { this.gainZeal(k, 2); k.gainVigor(2); this.say(`${k.name}: Vigor +2 (${k.vigor})`, 'tech'); } else { this.gainZeal(k, 1); k.heat = Math.max(0, k.heat - 3); this.say(`${k.name}: Heat -3 → ${k.heat}`, 'tech'); } }
    for (const o of tops(k, 'woundDiscardBonus')) if ((k.zeal || 0) >= o.need && await this.yesNo(`${k.name}: Dedicated Disciple — Talent를 버리고 (Clash 끝까지) Reposition 3 + Bonus Attack?`, false)) { this.say(`${k.name}: Talent ${k.talent.name} 버림 (Clash 끝까지)`, 'tech'); k.talent = { ...k.talent, abilities: [] }; A.paraRepo = (A.paraRepo || 0) + 3; k._bonusPending = true; }
  },
  /** Second ability window: Break X from Zeal benefits, Blinding Faith, Talent Reposition. */
  async paraSecondWindow(k, A) {
    if (A.zealBreak) { this.poolAdd('break', A.zealBreak); A.zealBreak = 0; }
    if (A.paraSecond) { const s = A.paraSecond; A.paraSecond = null; if (s.hope) { this.poolAdd('hope', s.hope); this.say(`${k.name}: Hope ${s.hope}`, 'tech'); } if (s.daze && this.adjacentToMonster(k)) { const f = this.monster.facing; this.monster.facing = { N: 'S', S: 'N', E: 'W', W: 'E' }[f]; this.say('Daze: 몬스터가 등을 돌림', 'tech'); } }
    if (A.paraRepo && k.alive && !this.knockedDown(k)) { const n = A.paraRepo; A.paraRepo = 0; if (await this.yesNo(`${k.name}: Reposition ${n}?`, false)) await this.knightMove(k, n); }
  },
  /** Full Miss, after clearing the Knight Pool: In Failure, Find Perseverance. */
  async paraFullMiss(k, A) { const ops = await this.paraUse(k, techAt(k, 'onFullMiss')); const o = ops && ops.find(x => x.op === 'fullMissTokens'); if (o) for (const t in o.tokens) { this.poolAdd(t, o.tokens[t]); this.say(`${k.name}: ${t} ${o.tokens[t]}`, 'tech'); } },
  /** After an Attack that dealt no Wound: Flee From Evil. */
  async paraAfterAttack(k) { const A = this.lastAttack; if (!A || A.knight !== k || A.wounded || !k.alive || this.knockedDown(k)) return; const ops = await this.paraUse(k, techAt(k, 'onNoWound')); const o = ops && ops.find(x => x.op === 'flee'); if (o) await this.knightMove(k, o.n); },
  /** Target of a Monster Attack: Shield of Faith (Advanced Block), Ours is the Hope (Defy). Returns extra blocked hits. */
  async paraDefense(k) {
    let b = k._preBlock || 0; k._defEvasion = 0; k._defGuard = 0;
    for (const t of k.hand.filter(x => x.timing === 'onDefense' && x.ops)) { const sh = await this.paraUse(k, t); if (!sh) continue; for (const o of sh) { if (o.op === 'techBlock') { b += o.n; this.say(`${k.name}: ${['', 'Block', 'Advanced Block', 'Superior Block'][o.n] || 'Block'}`, 'tech'); } else if (o.op === 'techDodge') { const n = o.lesser && this.fx.evasionBonus(k) > 0 ? 0 : o.n; k._defEvasion += n; this.say(`${k.name}: ${o.lesser ? 'Lesser Dodge' : o.n > 1 ? 'Advanced Dodge' : 'Dodge'} (+${n} Evasion)`, 'tech'); } else if (o.op === 'techGuard') { k._defGuard += o.n; this.say(`${k.name}: Guard ${o.n}`, 'tech'); } else if (o.op === 'techReinforce') { k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce[o.colour] = (k.reinforce[o.colour] || 0) + o.n; this.say(`${k.name}: ${o.colour === 'black' ? 'Advanced ' : ''}Reinforce ${o.n}`, 'tech'); } } await this.fx.runKnightOps(sh.filter(o => !['techBlock', 'techDodge', 'techGuard', 'techReinforce'].includes(o.op)), k, {}); }
    const oh = k.hand.find(t => t.ops && t.ops.some(o => o.op === 'oursHope')); const ops = oh && await this.paraUse(k, oh, 'Defy'); if (ops) { const o = ops.find(x => x.op === 'oursHope'); b += o.defy; this.say(`${k.name}: ${o.defy > 1 ? 'Advanced ' : ''}Defy`, 'tech'); }
    return b;
  },
  /** Signature of an adjacent Monster: Evade the Devil's Snare. */
  async paraSignature() { for (const k of this.alive()) { if (!(this.monster.isMob ? this.adjacentMobs(k).length : this.adjacentToMonster(k))) continue; const ops = await this.paraUse(k, techAt(k, 'onSignature')); const o = ops && ops.find(x => x.op === 'negPrecision'); if (o) { this.negMonPrecision = (this.negMonPrecision || 0) + o.n; this.say(`${k.name}: 임시 Precision -${o.n} 토큰`, 'tech'); } } },
  /** After a Monster's movement: Inquisitor's Pursuit. */
  async paraMonsterMoved(cells) {
    if (this._inPursuit) return; for (const k of this.alive()) { const t = techAt(k, 'onMonsterMoved'); if (!t || k._pursuitSeq === this._moveSeq || this.knockedDown(k) || k.engulfed) continue; k._pursuitSeq = this._moveSeq; const ops = await this.paraUse(k, t); const o = ops && ops.find(x => x.op === 'pursuit'); if (!o) continue; const n = (k.zeal || 0) >= 3 ? Math.max(o.n, this.fx.speed(k)) : o.n; this._inPursuit = true; try { await this.fx.motivateKnight(k, n, cells[0]); } finally { this._inPursuit = false; } }
  },
  /** Crit Chance: Spare Not The Rod. */
  async paraCrit(k) { const ops = await this.paraUse(k, techAt(k, 'onCritChance')); if (ops) { this.gainZeal(k, 1, 'Spare Not The Rod'); this.poolAdd('hope', 1); } },
  async paraCritDrain() { const q = this._critQueue || []; this._critQueue = []; for (const k of q) if (k.alive) await this.paraCrit(k); },
  /** Judicium draws: Zeal for Paracelsa (her own draw or another Knight's). */
  paraJudicium(drawer) { for (const x of this.knights) { if (!x.alive && x !== drawer) continue; const z = this.zealCfg(x); if (z && z.onJudicium && x.alive) this.gainZeal(x, z.onJudicium, x === drawer ? 'Judicium' : `${drawer.name}의 Judicium`); } },
  /** About to die: Martyr's Zeal / Undying Devotion / My Faith is My Rock. Returns true when the Knight survives. */
  async paraAboutToDie(k, reason) {
    const o = tops(k, 'dieStand')[0]; if (!o || k._standing || (k.zeal || 0) < o.need || (o.firstOnly && k._faithUsed) || this.result) return false;
    if (!await this.yesNo(`${k.name}: ${k.talent.name} — 사망 직전 (${reason}): 일어나 최대 3칸 이동 후 Bonus Attack?${o.survive ? ' (Wound를 주면 생존)' : ' (그 뒤 사망)'}`, true)) return false;
    k._standing = true; if (o.firstOnly) k._faithUsed = true; let wounded = false;
    try { for (const c of [...k.conditions]) if (/^Knockdown/.test(c.id)) this.standUp(k); await this.knightMove(k, 3); if (k.alive && this.canAttack(k)) { const w0 = this.monster.wounds; await this.knightAttack(k, { bonus: true }); wounded = this.monster.wounds > w0 || !!(this.lastAttack && this.lastAttack.knight === k && this.lastAttack.wounded); } } finally { k._standing = false; }
    if (o.survive && wounded && k.alive) { this.say(`${k.name}: Wound 성공 → 생존`, 'tech'); if (o.discardTalent) { this.say(`${k.name}: Talent ${k.talent.name} 버림 (Clash 끝까지)`, 'tech'); k.talent = { ...k.talent, abilities: [] }; } return true; }
    return false;
  },
  async paraKnightDied(dead) { for (const x of this.alive()) if (x !== dead && tops(x, 'bonusOnKnightDeath').length && !this.result && this.canAttack(x)) { this.say(`${x.name}: ${dead.name} 사망 → Bonus Attack`, 'tech'); await this.knightAttack(x, { bonus: true }); } },
  /** Technique ops used as free actions / before an Attack. Returns true when handled. */
  async paraOp(o, k, ctx) {
    const P = () => (k.pendingPara = k.pendingPara || {});
    switch (o.op) {
      case 'zealRush': k._rushFire = (k.zeal || 0) >= 3 ? o.fire : 0; return true;
      case 'righteousHand': this.gainZeal(k, 1, 'Righteous Hand of God'); k.pendingExtraPrecision = (k.pendingExtraPrecision || 0) + (k.zeal || 0); P().noOpening = true; this.say(`${k.name}: +${k.zeal || 0} Precision (Opening 토큰 혜택 없음)`, 'tech'); if (o.power && (k.zeal || 0) >= 3) { k.pendingExtraPool = k.pendingExtraPool || { red: 0, black: 0, white: 0, raw: 0 }; k.pendingExtraPool.raw += o.power; this.say(`${k.name}: Zeal 3+ → +${o.power} Power`, 'tech'); } return true;
      case 'fireOfFaith': { const M = this.monster; const lvl = M.isMob ? 1 : Math.max(1, (M.bp.cards[0] && M.bp.cards[0].level) || 1); const cand = () => this.pool.filter(t => !t.resource); if (cand().length < lvl) { this.say(`${k.name}: Knight Pool 토큰 부족 (필요 ${lvl})`, 'warn'); return true; } let z = false; for (let i = 0; i < lvl; i++) { const kinds = [...new Set(cand().map(t => t.token))]; const v = kinds.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: The Fire of my Faith — 버릴 토큰 (${i + 1}/${lvl})`, options: kinds.map(t => ({ label: `${t} (${this.poolCount(t)})`, value: t })) }) : kinds[0]; this.poolTake(v || kinds[0], 1); if (['black', 'hope'].includes(v || kinds[0])) z = true; } k.pendingAttackFlags = k.pendingAttackFlags || new Set(); k.pendingAttackFlags.add('deadly'); this.say(`${k.name}: 토큰 ${lvl}개 버림 → Deadly`, 'tech'); if (z) this.gainZeal(k, 1, 'Black/Hope 버림'); return true; }
      case 'theocratic': { const mind = k.conditions.find(c => this.conditionDefs[c.id] && this.conditionDefs[c.id].type === 'mind' && this.conditionDefs[c.id].flipSide); const opts = []; if (this.zealAvail(k) >= 3) opts.push({ label: 'Zeal 3 → Attack Re-roll 2', value: 'ar' }); if (mind) opts.push({ label: `[Discard] Mind Condition 뒤집기 (${mind.id})`, value: 'flip' }); opts.push({ label: '취소', value: 'skip' }); const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Theocratic Warfare`, options: opts }); const t = ctx.technique; if (v === 'ar') { await this.paraChooseSource(k, 3); this.spendZeal(k, 3); k.pendingAttackRerolls = (k.pendingAttackRerolls || 0) + 2; this.say(`${k.name}: 다음 공격에 Attack Re-roll 2`, 'tech'); } else if (v === 'flip' && mind) { mind.id = this.conditionDefs[mind.id].flipSide; this.say(`${k.name}: Condition 뒤집음 → ${mind.id}`, 'tech'); if (t) t._depletion = 'discard'; } else if (t) t._depletion = 'hand'; return true; }
      case 'oursHope': this.poolAdd('hope', o.n); this.say(`${k.name}: Hope ${o.n}`, 'tech'); return true;
      case 'rewarded': { const n = { Minor: 1, Major: 2, Grave: 3, Judicium: 4 }[k.peril()] || 0; if (!n) { this.say(`${k.name}: Peril Level 없음 → Zeal 0`); return true; } this.gainZeal(k, n, `${k.peril()} Peril`); if (o.vigor) { k.gainVigor(n); this.say(`${k.name}: Vigor +${n} (${k.vigor})`, 'tech'); } return true; }
      case 'scion': { P().spotlight = true; this.say(`${k.name}: Spotlight`, 'tech'); if (this.zealAvail(k) >= 2 && await this.yesNo(`${k.name}: Scion of the Light — Zeal 2를 더 써서 빨간 Power die +1?`, false)) { await this.paraChooseSource(k, 2); this.spendZeal(k, 2); P().red = (P().red || 0) + 1; } return true; }
      case 'spotlightNow': P().spotlight = true; return true;
      case 'secondHopeDaze': P().second = { hope: o.n, daze: true }; return true;
      case 'notYourTime': { const dead = this.knights.filter(x => !x.alive); const cell = this.board.neighbors(k.pos).find(c => !this.knightAt(c) && !this.board.isObstacle(c) && !this.monsterOccupies(c)); if (!dead.length || !cell) { this.say(`${k.name}: 되살릴 기사 또는 빈 인접 칸 없음`, 'warn'); return true; } const id = dead.length > 1 ? await this.ask({ type: 'pickKnight', text: 'Not Your Time — 되살릴 기사', options: dead.map(x => ({ label: x.name, value: x.id })) }) : dead[0].id; const who = dead.find(x => x.id === id) || dead[0]; who.alive = true; who.vigor = 0; who.conditions = []; who.pos = cell; this.board.place({ kind: 'knight', id: who.id }, [cell]); this.say(`${who.name} 부활 (Vigor 0, Condition 모두 버림) → ${this.board.label(cell)}`, 'tech'); return true; }
      case 'divineIntervention': { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Divine Intervention — 덱 선택`, options: [{ label: 'AI 덱', value: 'ai' }, { label: 'BP 덱', value: 'bp' }] }) || 'ai'; const d = this.monster[v]; if (d && d.cards) { d.cards.push(...d.discard); d.discard = []; d.shuffle(); this.say(`${v.toUpperCase()} Suppress`, 'tech'); } return true; }
      case 'persecuted': case 'fullMissTokens': case 'negPrecision': case 'flee': case 'techBlock': case 'spareRod': case 'pursuit': return true; // resolved at their timing
    }
    return false;
  },
};
export const PARA_OPS = new Set(['zealRush', 'righteousHand', 'fireOfFaith', 'theocratic', 'oursHope', 'rewarded', 'scion', 'spotlightNow', 'secondHopeDaze', 'notYourTime', 'divineIntervention', 'persecuted', 'fullMissTokens', 'negPrecision', 'flee', 'techBlock', 'spareRod', 'pursuit']);
/** Ops of 'beforeAttack'-timing Techniques that must run when the Technique is used (they set up the coming Attack). */
export const PARA_PRE = new Set(['righteousHand', 'fireOfFaith', 'scion', 'spotlightNow', 'secondHopeDaze']);
export function installParacelsa(Clash) {
  const die = Clash.prototype.die; Clash.prototype.die = async function (k, reason) { if (!k.alive) return; if (await this.paraAboutToDie(k, reason)) return; const r = await die.call(this, k, reason); if (!k.alive) await this.paraKnightDied(k); return r; };
  const dj = Clash.prototype.drawJudicium; Clash.prototype.drawJudicium = async function (k) { const r = await dj.call(this, k); this.paraJudicium(k); return r; };
  const sig = Clash.prototype.performSignature; Clash.prototype.performSignature = async function (opt) { await this.paraSignature(); return sig.call(this, opt); };
  const rc = Clash.prototype.renCrit; Clash.prototype.renCrit = function (k, what) { const r = rc.call(this, k, what); this._critQueue = this._critQueue || []; this._critQueue.push(k); return r; };
  const ka = Clash.prototype.knightAttack; Clash.prototype.knightAttack = async function (k, opts) { const r = await ka.call(this, k, opts); await this.paraAfterAttack(k); return r; };
}
