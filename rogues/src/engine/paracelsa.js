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
  gainZeal(k, n, why = '') { if (!n || n < 0) return 0; const z = this.zealCfg(k); const th = z && z.threshold ? z.threshold : Infinity; const onBoard = Math.max(0, Math.min(n, th - (k.zeal || 0))); k.zeal = (k.zeal || 0) + onBoard; const rest = n - onBoard; if (rest) this.poolAdd('zeal', rest, { resource: true }); this.say(`${k.name}: Zeal ${n}${why ? ` (${why})` : ''} → Knight Board ${k.zeal}${rest ? `, Knight Pool +${rest} (Zeal Threshold ${th})` : ''}`, 'tech'); if (z && th === 12 && k.zeal >= 12 && !k._zealIncarnDone && /12: Immediately Incarnate!/.test((k.talent && k.talent.abilities.map(a => a.text || '').join(' ')) || '')) k._zealIncarnPending = true; return n; },
  /** Inquisitor — Zeal 12: "Immediately Incarnate! (Once per Clash)": the patron Saint, or the Unknown Saint once unlocked (소유자 확인 2026-11-19). Resolved as soon as the current action is done. */
  async paraIncarnCheck() { for (const k of this.alive()) { if (!k._zealIncarnPending) continue; k._zealIncarnPending = false; k._zealIncarnDone = true; const camp = this.campaign; if (!camp) { this.say(`${k.name}: Zeal 12 — Incarnate는 캠페인에서만`, 'tech'); continue; } if (!k.saint && !camp.unknownSaintUnlocked) { this.say(`${k.name}: Zeal 12 — Saint가 없고 Unknown Saint도 열리지 않아 Incarnate 불가`, 'tech'); continue; } if (!await this.yesNo(`${k.name}: Zeal 12 — Immediately Incarnate! (${k.saint ? k.saint.title + ' — 끝나면 Saint 카드와 Devotion을 잃음' : 'Unknown Saint'})?`, true)) continue; if (k.saint) { k._incarn = k.saint.incarnation; k._incarnSkip = this._pzTurn === k; k._saintLost = true; this.say(`${k.name}: ${k.saint.incarnation.name} — ${k.saint.incarnation.text}`, 'mortis'); } try { await camp.incarnate(k, this); } catch (e) { if (!e || !e.chainBreak) throw e; } } },
  /** Spend n Zeal (synchronous; the source preference was chosen in paraChooseSource). */
  spendZeal(k, n) { let fromBoard = 0; for (let i = 0; i < n; i++) { const board = (k.zeal || 0) > 0, pool = this.poolCount('zeal') > 0; if (!board && !pool) break; if (board && (k._zealFrom !== 'pool' || !pool)) { k.zeal--; this.poolAdd('zeal', 1, { resource: true }); fromBoard++; } else this.poolTake('zeal', 1); } k._zealFrom = null; this.say(`${k.name}: Zeal ${n} 사용 (Knight Board → Pool ${fromBoard}, Pool에서 버림 ${n - fromBoard}) — Board ${k.zeal || 0} · Pool ${this.poolCount('zeal')}`, 'tech'); if (fromBoard && tops(k, 'preachersPyre').length) { this.poolAdd('fire', 1); this.say("Preacher's Pyre: Fire 토큰 1", 'tech'); } },
  async paraChooseSource(k, n) { if ((k.zeal || 0) > 0 && this.poolCount('zeal') > 0) k._zealFrom = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Zeal ${n} 사용 — 어디서? (Board ${k.zeal} · Pool ${this.poolCount('zeal')})`, options: [{ label: 'Knight Board → Knight Pool로 옮김 (먼저)', value: 'board' }, { label: 'Knight Pool에서 버림 (먼저)', value: 'pool' }] }) || 'board'; },
  async paraUse(k, t, text) { if (!t || !this.fx.canPay(k, this.fx.costOf(k, t))) return null; if (!await this.yesNo(`${k.name}: ${t.name} 사용? (${this.fx.costDep(k, t)}) — ${text || t.text}`, false)) return null; const pc = await this.fx.chooseCost(k, t); if (!pc) return null; this.fx.pay(k, pc.alt, pc.x); this.say(`${k.name} 기술 사용: ${t.name}`, 'tech'); const ops = this.fx.activeOps(k, t); const dep = (ops.find(o => o.depletion) || {}).depletion; this.fx.deplete(k, t, dep || t.depletion); await this.renTechniqueUsed(k); return ops; },
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
    if (this.paraStat(k, 'heartseeker')) { A.flags.add('heartseeker'); this.say(`${k.name}: Zeal ${k.zeal} 혜택 — Heartseeker`, 'tech'); }
    if (this.paraStat(k, 'bpSuppress') && !this.monster.isMob && await this.yesNo(`${k.name}: Zeal ${k.zeal} 혜택 — BP Suppress 수행?`, true)) this.ubarSuppress('bp', `${k.name} (Zeal)`);
    A.zealBreak = this.paraStat(k, 'break');
    if (ar || pr || pw || ab || A.zealBreak) this.say(`${k.name}: Zeal ${k.zeal} 혜택 —${ar ? ` Attack Re-roll ${ar}` : ''}${pr ? ` Power Re-roll ${pr}` : ''}${pw ? ` ${pw > 0 ? '+' : ''}${pw} Power` : ''}${ab ? ` Auto-break ${ab}` : ''}${A.zealBreak ? ` Break ${A.zealBreak}` : ''}`, 'tech');
    for (const o of tops(k, 'zealAutoHope')) if ((k.zeal || 0) >= o.need) { this.poolAdd('hope', o.n); this.say(`${k.name}: Zeal ${o.need}+ → Auto-hope ${o.n}`, 'tech'); }
    if (k.pendingPara && k.pendingPara.fireFaith) { const card = A.mob && A.mob.card; await this.fireOfFaithPay(k, Math.max(1, (card && card.level) || 1), A); }
    if (k.pendingPara) { A.paraSecond = k.pendingPara.second || null; if (k.pendingPara.spotlight && (this.priorityTarget === k || this.divineTarget === k)) { A.extraPool.red += 1; this.say(`${k.name}: Spotlight — Priority / Divine Target → +1 빨간 Power die`, 'tech'); } if (k.pendingPara.red) A.extraPool.red += k.pendingPara.red; if (k.pendingPara.noOpening) A.flags.add('noOpening'); k.pendingPara = null; }
  },
  /** After the Attack Roll: Falsity, Zeal on misses / Crit Miss. */
  async paraAfterAttackRoll(k, A, roll, isHit) {
    const crit = roll.dice[0];
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
  /** Imperial Templar's Kite Shield: "Crit Evade Fail: Immediately Zeal 1." */
  paraCritEvadeFail(k) { for (const g of k.gear) { if (g.discarded || g.exhausted) continue; for (const o of this.fx.constKw(k, g)) if (o.op === 'critEvadeFailZeal') this.gainZeal(k, o.n, `${g.name} — Crit Evade Fail`); } },
  async paraSecondWindow(k, A) {
    if ((A.kw || []).some(o => o.op === 'swapWeaponSecond')) { const z = (A.kw || []).find(o => o.op === 'elseZeal'); const others = k.gear.filter(g => g !== A.weapon && g.type === 'weapon' && !g.discarded && !g.exhausted && (g.hands || 1) === 1); const v = others.length ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${A.weapon.name} — 2차 창 전에 active Weapon 교체?${z ? ` (안 하면 Zeal ${z.n})` : ''}`, options: [{ label: `교체 안 함${z ? ` → Zeal ${z.n}` : ''}`, value: 'skip' }, ...others.map((g, i) => ({ label: g.name, value: i }))] }) : 'skip'; if (v != null && v !== 'skip' && others[v]) { const from = A.weapon.name; A.weapon = others[v]; A.kw = [...this.fx.constKw(k, A.weapon), ...k.gear.filter(g => g.type !== 'weapon' && !g.discarded && !g.exhausted).flatMap(g => this.fx.constKw(k, g))]; this.say(`${k.name}: active Weapon ${from} → ${A.weapon.name}`, 'tech'); } else if (z) this.gainZeal(k, z.n, A.weapon.name); }
    if (A.zealBreak) { this.poolAdd('break', A.zealBreak); A.zealBreak = 0; }
    if (A.paraSecond) { const s = A.paraSecond; A.paraSecond = null; if (s.hope) { this.poolAdd('hope', s.hope); this.say(`${k.name}: Hope ${s.hope}`, 'tech'); } if (s.daze && this.adjacentToMonster(k)) { const f = this.monster.facing; this.monster.facing = { N: 'S', S: 'N', E: 'W', W: 'E' }[f]; this.say('Daze: 몬스터가 등을 돌림', 'tech'); } }
    if (A.paraRepo && k.alive && !this.knockedDown(k)) { const n = A.paraRepo; A.paraRepo = 0; if (await this.yesNo(`${k.name}: Reposition ${n}?`, false)) await this.knightMove(k, n); }
  },
  /** Full Miss, after clearing the Knight Pool: In Failure, Find Perseverance. */
  async paraFullMiss(k, A) { const ops = await this.paraUse(k, techAt(k, 'onFullMiss')); const o = ops && ops.find(x => x.op === 'fullMissTokens'); if (o) for (const t in o.tokens) { this.poolAdd(t, o.tokens[t]); this.say(`${k.name}: ${t} ${o.tokens[t]}`, 'tech'); } },
  /** After an Attack that dealt no Wound: Flee From Evil. */
  async paraAfterAttack(k) { const A = this.lastAttack; if (!A || A.knight !== k || A.wounded || !k.alive || this.knockedDown(k)) return; const ops = await this.paraUse(k, techAt(k, 'onNoWound')); const o = ops && ops.find(x => x.op === 'flee'); if (o) { const tc = this.fx.targetCells(A); const dist = c => tc.length ? Math.min(...tc.map(t => Math.abs(t.c - c.c) + Math.abs(t.r - c.r))) : 0; const d0 = dist(k.pos); const cells = this.reachable(k, o.n).filter(c => dist(c) > d0); if (!cells.length) { this.say(`${k.name}: 대상에게서 멀어질 수 있는 칸 없음`); return; } const dest = await this.ask({ type: 'move', knight: k.id, text: `Flee From Evil — 대상에게서 멀어지는 칸 (최대 ${o.n})`, cells, options: cells.map(c => ({ label: this.board.label(c), value: c })) }); if (dest) { this.moveKnight(k, dest); await this.swampSweep(); } } },
  /** Target of a Monster Attack: Shield of Faith (Advanced Block), Ours is the Hope (Defy). Returns extra blocked hits. */
  /** Solid Outside, Human Inside — Superior Reinforce 1, when an Armor Roll is about to be resolved. */
  async paraReinforce(k) { const so = k.hand.find(t => t.name === 'Solid Outside, Human Inside' && t.ops); if (so && await this.paraUse(k, so, 'Superior Reinforce 1 (Armor Roll 직전)')) { k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce.white = (k.reinforce.white || 0) + 1; this.say(`${k.name}: Superior Reinforce 1`, 'tech'); } },
  async paraDefense(k) {
    let b = k._preBlock || 0; k._defEvasion = 0; k._defGuard = 0; k._armorReroll = 0;
    for (const t of k.hand.filter(x => x.timing === 'onDefense' && x.ops)) { const sh = await this.paraUse(k, t); if (!sh) continue; for (const o of sh) { if (o.op === 'techBlock') { b += o.n; this.say(`${k.name}: ${['', 'Block', 'Advanced Block', 'Superior Block'][o.n] || 'Block'}`, 'tech'); } else if (o.op === 'techDodge') { const n = o.lesser && this.fx.evasionBonus(k) > 0 ? 0 : o.n; k._defEvasion += n; this.say(`${k.name}: ${o.lesser ? 'Lesser Dodge' : o.n > 1 ? 'Advanced Dodge' : 'Dodge'} (+${n} Evasion)`, 'tech'); } else if (o.op === 'techArmorReroll') { if (!o.ls || this.lsOn(k)) { k._armorReroll += o.n; this.say(`${k.name}: Armor Re-roll ${o.n}`, 'tech'); } } else if (o.op === 'techGuard') { k._defGuard += o.n; this.say(`${k.name}: Guard ${o.n}`, 'tech'); } else if (o.op === 'techReinforce') { k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce[o.colour] = (k.reinforce[o.colour] || 0) + o.n; this.say(`${k.name}: ${o.colour === 'black' ? 'Advanced ' : ''}Reinforce ${o.n}`, 'tech'); } } await this.fx.runKnightOps(sh.filter(o => !['techBlock', 'techDodge', 'techGuard', 'techReinforce', 'techArmorReroll'].includes(o.op)), k, {}); }
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
  /** The Fire of my Faith: discard X Knight tokens to gain Deadly (Zeal 1 if a Black or Hope token was discarded). A = the Attack when it already started. */
  async fireOfFaithPay(k, lvl, A) { const cand = () => this.pool.filter(t => !t.resource); if (cand().length < lvl) { this.say(`${k.name}: The Fire of my Faith — Knight Pool 토큰 부족 (필요 ${lvl}) → 효과 없음`, 'warn'); return true; } let z = false; for (let i = 0; i < lvl; i++) { const kinds = [...new Set(cand().map(t => t.token))]; const v = kinds.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: The Fire of my Faith — 버릴 토큰 (${i + 1}/${lvl})`, options: kinds.map(t => ({ label: `${t} (${this.poolCount(t)})`, value: t })) }) : kinds[0]; this.poolTake(v || kinds[0], 1); if (['black', 'hope'].includes(v || kinds[0])) z = true; } if (A) A.flags.add('deadly'); else { k.pendingAttackFlags = k.pendingAttackFlags || new Set(); k.pendingAttackFlags.add('deadly'); } this.say(`${k.name}: 토큰 ${lvl}개 버림 → Deadly`, 'tech'); if (z) this.gainZeal(k, 1, 'Black/Hope 버림'); return true; },
  /** Technique ops used as free actions / before an Attack. Returns true when handled. */
  async paraOp(o, k, ctx) {
    const P = () => (k.pendingPara = k.pendingPara || {});
    switch (o.op) {
      case 'zealRush': k._rushFire = (k.zeal || 0) >= 3 ? o.fire : 0; return true;
      case 'righteousHand': this.gainZeal(k, 1, 'Righteous Hand of God'); k.pendingExtraPrecision = (k.pendingExtraPrecision || 0) + (k.zeal || 0); P().noOpening = true; this.say(`${k.name}: +${k.zeal || 0} Precision (Opening 토큰 혜택 없음)`, 'tech'); if (o.power && (k.zeal || 0) >= 3) { k.pendingExtraPool = k.pendingExtraPool || { red: 0, black: 0, white: 0, raw: 0 }; k.pendingExtraPool.raw += o.power; this.say(`${k.name}: Zeal 3+ → +${o.power} Power`, 'tech'); } return true;
      case 'fireOfFaith': { const M = this.monster; if (M.isMob) { P().fireFaith = true; this.say(`${k.name}: The Fire of my Faith — 공격할 BP 카드의 Level만큼 토큰을 버림 (대상 선택 후)`, 'tech'); return true; } return this.fireOfFaithPay(k, Math.max(1, (M.bp.cards[0] && M.bp.cards[0].level) || 1), null); }
      case 'theocratic': { const mind = k.conditions.find(c => this.conditionDefs[c.id] && this.conditionDefs[c.id].type === 'mind' && this.conditionDefs[c.id].flipSide); const opts = []; if (this.zealAvail(k) >= 3) opts.push({ label: 'Zeal 3 → Attack Re-roll 2', value: 'ar' }); if (mind) opts.push({ label: `[Discard] Mind Condition 뒤집기 (${mind.id})`, value: 'flip' }); opts.push({ label: '취소', value: 'skip' }); const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Theocratic Warfare`, options: opts }); const t = ctx.technique; if (v === 'ar') { await this.paraChooseSource(k, 3); this.spendZeal(k, 3); k.pendingAttackRerolls = (k.pendingAttackRerolls || 0) + 2; this.say(`${k.name}: 다음 공격에 Attack Re-roll 2`, 'tech'); } else if (v === 'flip' && mind) { mind.id = this.conditionDefs[mind.id].flipSide; this.say(`${k.name}: Condition 뒤집음 → ${mind.id}`, 'tech'); if (t) t._depletion = 'discard'; } else if (t) t._depletion = 'hand'; return true; }
      case 'oursHope': this.poolAdd('hope', o.n); this.say(`${k.name}: Hope ${o.n}`, 'tech'); return true;
      case 'rewarded': { const n = { Minor: 1, Major: 2, Grave: 3, Judicium: 4 }[k.peril()] || 0; if (!n) { this.say(`${k.name}: Peril Level 없음 → Zeal 0`); return true; } this.gainZeal(k, n, `${k.peril()} Peril`); if (o.vigor) { k.gainVigor(n); this.say(`${k.name}: Vigor +${n} (${k.vigor})`, 'tech'); } return true; }
      case 'scion': { let v = 'spot'; if (this.zealAvail(k) >= 2) v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Scion of the Light`, options: [{ label: 'Spotlight', value: 'spot' }, { label: 'Zeal 2 추가 사용 → 빨간 Power die +1', value: 'red' }] }) || 'spot'; if (v === 'red') { await this.paraChooseSource(k, 2); this.spendZeal(k, 2); P().red = (P().red || 0) + 1; this.say(`${k.name}: 빨간 Power die +1`, 'tech'); } else { P().spotlight = true; this.say(`${k.name}: Spotlight`, 'tech'); } return true; }
      case 'spotlightNow': P().spotlight = true; return true;
      case 'secondHopeDaze': P().second = { hope: o.n, daze: true }; return true;
      case 'notYourTime': { const dead = this.knights.filter(x => !x.alive); const cell = this.board.neighbors(k.pos).find(c => !this.knightAt(c) && !this.board.isObstacle(c) && !this.monsterOccupies(c)); if (!dead.length || !cell) { this.say(`${k.name}: 되살릴 기사 또는 빈 인접 칸 없음`, 'warn'); return true; } const id = dead.length > 1 ? await this.ask({ type: 'pickKnight', text: 'Not Your Time — 되살릴 기사', options: dead.map(x => ({ label: x.name, value: x.id })) }) : dead[0].id; const who = dead.find(x => x.id === id) || dead[0]; who.alive = true; who.vigor = 0; who.conditions = []; who.pos = cell; this.board.place({ kind: 'knight', id: who.id }, [cell]); this.say(`${who.name} 부활 (Vigor 0, Condition 모두 버림) → ${this.board.label(cell)}`, 'tech'); return true; }
      case 'divineIntervention': { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Divine Intervention — 덱 선택`, options: [{ label: 'AI 덱', value: 'ai' }, { label: 'BP 덱', value: 'bp' }] }) || 'ai'; const d = this.monster[v]; if (d && d.cards) { d.cards.push(...d.discard); d.discard = []; d.shuffle(); d.cards.reverse(); for (const c of d.cards) c.faceUp = true; if (d.cards[0]) this.say(`${v.toUpperCase()} 덱을 앞면으로 뒤집음 — 맨 위: ${d.cards[0].name}`, 'tech'); this.say(`${v.toUpperCase()} Suppress`, 'tech'); } return true; }
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
