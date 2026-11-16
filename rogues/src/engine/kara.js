// Kingdoms Forlorn — Rogue's Path: Kara (Knightbook "A Knight's Tale: Kara") — Talents, Techniques and the arc tokens she introduces.
// "Ally" (Knightbook p.3): any friendly miniature/standee and Party token on the Clash Board. [해석, 확인 필요] here Ally = the other Knights.
const talentHas = (k, op) => !!(k.talent && k.talent.abilities.some(a => a.ops && a.ops.some(o => o.op === op)));
const techAt = (k, timing) => k.hand.find(t => t.timing === timing && t.ops);

export const KaraMixin = {
  karaAllies(k) { return this.alive().filter(x => x !== k); },
  karaOccupied(c) { return !!(this.knightAt(c) || this.monsterOccupies(c) || this.board.isObstacle(c)); },
  /** Unconstrained: exactly one adjacent space occupied +1 Precision; all adjacent spaces empty +2. */
  karaPrecision(k) { if (!talentHas(k, 'unconstrained') || !k.pos) return 0; const n = this.board.neighbors(k.pos).filter(c => this.karaOccupied(c)).length; return n === 0 ? 2 : n === 1 ? 1 : 0; },
  /** I Work Alone: Lone Knight +1 Evasion ([JUDICIUM] +2). Master the Terrain is not tracked (Obstacles cannot be entered). */
  karaEvasion(k) { let n = 0; if (talentHas(k, 'iWorkAlone') && this.isLone(k)) n += k.peril() === 'Judicium' ? 2 : 1; if (k.pos && this.board.isObstacle(k.pos) && k.discard.some(t => t.name === 'Master the Terrain')) n += 1; return n; },
  /** About to move: Keep on Rolling — Bypass (DEVIL: Superior Bypass), offered when it opens up more spaces for this movement. */
  async karaBypassOffer(k, steps) { const t = k.hand.find(x => x.ops && x.name === 'Keep on Rolling'); if (!t || k._bypass || this._inBypassAsk || !k.alive || this.knockedDown(k)) return; const sup = this.fx.tierOk(k, 'DEVIL'); const n0 = this.reachable(k, steps).length; k._bypass = sup ? 3 : 1; const n1 = this.reachable(k, steps).length; k._bypass = 0; if (n1 <= n0) return; this._inBypassAsk = true; try { if (await this.karaUse(k, t, `이 이동에 ${sup ? 'Superior Bypass' : 'Bypass'} (도달 가능 칸 ${n0} → ${n1})`)) { k._bypass = sup ? 3 : 1; this.say(`${k.name}: ${sup ? 'Superior Bypass' : 'Bypass'}`, 'tech'); } } finally { this._inBypassAsk = false; } },
  async karaPreMove(k) {},
  /** Knight in Shining Armor: Start of Clash — Deploy 1, the card goes under the Armor; Soak 2 while that Armor is unexhausted. */
  async karaStartOfClash(k) { const t = k.hand.find(x => x.name === 'Knight in Shining Armor' && x.ops); const armor = k.gear.find(g => g.type === 'armor' && !g.discarded); if (!t || !armor || k._shining) return; if (!await this.yesNo(`${k.name}: Knight in Shining Armor — Start of Clash: Deploy 1, ${armor.name} 아래에 놓기 (Soak 2)?`, true)) return; k.hand.splice(k.hand.indexOf(t), 1); k._shining = { t, armor }; this.say(`${k.name}: Knight in Shining Armor — ${armor.name} 아래에 놓음 (Unexhaust 동안 Soak 2)`, 'tech'); },
  karaSoak(k) { const s = k._shining; return s && !s.armor.exhausted && !s.armor.discarded ? 2 : 0; },
  karaShiningCheck() { for (const k of this.alive()) { const s = k._shining; if (!s || !this.alive().some(x => x !== k && this.board.adjacent(x.pos, k.pos))) continue; k._shining = null; k.discard.push(s.t); s.armor.exhausted = true; k.gainPassion(1); this.say(`${k.name}: Ally가 인접 — Knight in Shining Armor 버림, ${s.armor.name} Exhaust, Passion +1 (${k.passion})`, 'tech'); } },
  karaDeploy(k) { let n = k._shining ? 1 : 0; if (k.talent) for (const a of k.talent.abilities) for (const o of a.ops || []) if (o.op === 'talentDeploy') n += o.n; return n; },
  /** We Go Together: Kara may move diagonally; during her turn so may her Allies. */
  karaDiag(k) { if (talentHas(k, 'weGoTogether')) return true; const t = this._turnKnight; return !!(this.phase === 'knight' && t && t !== k && t.alive && talentHas(t, 'weGoTogether')); },
  karaRoundEnd() { for (const k of this.knights) k._flowUsed = false; },
  async karaUse(k, t, text) { if (!t || !this.fx.canPay(k, this.fx.costOf(k, t))) return null; if (!await this.yesNo(`${k.name}: ${t.name} 사용? (${this.fx.costLabel(k, t) || '비용 없음'}) — ${text || t.text}`, false)) return null; const pc = await this.fx.chooseCost(k, t); if (!pc) return null; this.fx.pay(k, pc.alt, pc.x); this.say(`${k.name} 기술 사용: ${t.name}`, 'tech'); const ops = this.fx.activeOps(k, t); this.fx.deplete(k, t); await this.renTechniqueUsed(k); return ops; },
  /** Start of turn — Peek at the Devil's Hand. */
  async karaTurnStart(k) {
    if (!talentHas(k, 'peekDevilsHand')) return; const tiers = Object.keys(this.mortis || {}).filter(t => this.mortis[t] && this.mortis[t].cards && this.mortis[t].cards.length); if (!tiers.length) return;
    const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Peek at the Devil's Hand — 확인할 Mortis 덱`, options: [...tiers.map(t => ({ label: `${t} Mortis`, value: t })), { label: '사용 안 함', value: 'skip' }] }); if (!v || v === 'skip' || !this.mortis[v]) return;
    const d = this.mortis[v], top = d.cards[0]; this.say(`Peek at the Devil's Hand — ${v} Mortis 맨 위: ${top.name} — ${top.text || ''}`, 'mortis'); this.flash('card', { title: `${v} Mortis 맨 위`, name: top.name, text: top.text || '', cls: 'bad' });
    if (await this.yesNo(`${k.name}: ${top.name}을(를) ${v} Mortis 덱 맨 아래로?`, false)) { d.cards.push(d.cards.shift()); this.say(`${top.name} → 덱 맨 아래`, 'tech'); }
  },
  /** After a [Move action] of k: Natural Leader, Take a Breather. */
  async karaMoveAction(k) {
    if (!k.alive) return;
    if (talentHas(k, 'naturalLeader')) { const al = this.karaAllies(k).filter(x => !this.knockedDown(x) && !x.engulfed && this.reachable(x, 1).length); if (al.length) { const id = await this.ask({ type: 'pickKnight', text: `${k.name}: Natural Leader — 1칸 이동할 Ally`, options: [...al.map(x => ({ label: x.name, value: x.id })), { label: '사용 안 함', value: 'skip' }] }); const x = al.find(y => y.id === id); if (x) await this.knightMove(x, 1); } }
    if (talentHas(k, 'takeABreather') && k.actions && !k.actions.combat) { const ex = k.gear.filter(g => g.exhausted && !g.discarded); if (ex.length) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Take a Breather — Unexhaust할 Gear`, options: [...ex.map((g, i) => ({ label: g.name, value: i })), { label: '사용 안 함', value: 'skip' }] }); if (v != null && v !== 'skip' && ex[v]) { ex[v].exhausted = false; this.say(`Take a Breather: ${ex[v].name} Unexhaust`, 'tech'); } } }
  },
  /** Go with the Flow: once per Knight Round, when an Ally moves, Kara may move 1 space. */
  async karaAllyMoved(mover) {
    if (this._inFlow) return; for (const x of this.alive()) { if (x === mover || x._flowUsed || !talentHas(x, 'goWithTheFlow') || this.knockedDown(x) || x.engulfed || !this.reachable(x, 1).length) continue; if (!await this.yesNo(`${x.name}: Go with the Flow — ${mover.name} 이동 → 1칸 이동? (Knight Round당 1회)`, false)) continue; x._flowUsed = true; this._inFlow = true; try { await this.knightMove(x, 1); } finally { this._inFlow = false; } }
  },
  /** Start of an Attack: Strike as One (Kara), Oath of Valor (another Knight attacks). */
  async karaBeforeAttack(k, A) {
    if (talentHas(k, 'strikeAsOne')) { const tc = this.fx.targetCells(A); const n = this.karaAllies(k).filter(x => tc.some(c => this.board.adjacent(c, x.pos))).length; if (n >= 1) { A.extraPrecision = (A.extraPrecision || 0) + 1; if (n >= 2) this.poolAdd('break', 1); if (n >= 3) this.poolAdd('rouse', 1); this.say(`Strike as One: 대상 옆 Ally ${n}명 → +1 Precision${n >= 2 ? ' · Auto-break 1' : ''}${n >= 3 ? ' · Auto-rouse 1' : ''}`, 'tech'); } }
    for (const x of this.karaAllies(k)) { const t = techAt(x, 'onOtherAttack'); const ops = t && await this.karaUse(x, t, `${k.name}의 공격에 +2 Precision · Precise`); if (ops) { A.extraPrecision = (A.extraPrecision || 0) + 2; A.flags.add('precise'); break; } }
  },
  /** After the Attack Roll: Relentless Momentum, Living Weapon. */
  async karaAfterAttackRoll(k, A, roll, isHit, toHit, prec) {
    if (talentHas(k, 'relentlessMomentum')) { if (roll.dice.some(d => d.v + prec >= toHit + 2)) { this.poolAdd('sunder', 1); this.say('Relentless Momentum: To Hit +2 이상 → Sunder 토큰 1', 'tech'); } const miss = roll.dice.filter(d => !isHit(d)).length; if (miss) { this.poolAdd('hope', miss); this.say(`Relentless Momentum: miss ${miss} → Auto-hope ${miss}`, 'tech'); } }
    if (A.flags && A.flags.has('livingWeapon')) { const n = roll.dice.filter(d => d.v === 10).length; if (n) { A.extraPool.raw += n; this.say(`Living Weapon: "10" ${n}개 → +${n} Power`, 'tech'); } }
  },
  /** Keep up to n Knight Pool tokens through the Clear the Knight Pool step. */
  async karaKeep(k, n, label, ok) { while (n > 0) { const cand = this.pool.filter(t => !t.pass && !t.resource && ok(t)); if (!cand.length) break; const kinds = [...new Set(cand.map(t => t.token))]; const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${label} — Knight Pool에 남길 토큰 (남은 ${n})`, options: [{ label: '그만', value: 'skip' }, ...kinds.map(t => ({ label: `${t} (${cand.filter(c => c.token === t).length})`, value: t }))] }); if (v == null || v === 'skip') break; cand.find(t => t.token === v).pass = true; n--; this.say(`${label}: ${v} 토큰 1개 유지`, 'tech'); } },
  /** Clear the Knight Pool step: Greater Pass X (Heroic Arc), I'll Finish What You Started (another Knight's attack). */
  async karaClearPool(k, A) {
    if (A.greaterPass) await this.karaKeep(k, A.greaterPass, 'Greater Pass', t => !['sunder', 'power'].includes(t.token));
    for (const x of this.karaAllies(k)) { const t = techAt(x, 'onOtherClearPool'); const left = this.pool.filter(p => !p.pass && !p.resource).length; if (!t || !left) continue; const ops = await this.karaUse(x, t); if (!ops) continue; const all = ops.some(o => o.all); if (all) { for (const p of this.pool) if (!p.resource) p.pass = true; this.say(`${t.name}: Knight Pool 토큰을 제거하지 않음`, 'tech'); } else await this.karaKeep(x, Math.floor(left / 2), t.name, () => true); break; }
  },
  /** Crash: Keep on Rolling (Tumble). */
  async karaTumble(k) { return !!(await this.karaUse(k, techAt(k, 'onCrash'), 'Crash — Tumble (d10 6+로 무시)')); },
  /** Becoming the Target of an Attack: Act on Instinct returns to hand; Dodge and Weave Reinforce. */
  karaTargeted(k) {
    for (const pile of ['cooldown', 'delay']) { const i = k[pile].findIndex(t => t.name === 'Act on Instinct'); if (i >= 0) { k.hand.push(k[pile].splice(i, 1)[0]); k.heat = Math.max(0, k.heat - 1); this.say(`${k.name}: Act on Instinct — 손으로 돌아옴, Heat -1 → ${k.heat}`, 'tech'); } }
    if (k.cooldown.some(t => t.name === 'Dodge and Weave') && this.fx.isHidden(k)) { const adv = this.fx.tierOk(k, 'DEVIL'); k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce[adv ? 'black' : 'red'] += 1; this.say(`${k.name}: Dodge and Weave — ${adv ? 'Advanced ' : ''}Reinforce 1`, 'tech'); }
  },
  /** Surviving a Grave Mortis or Judicium draw: Rebuke, Reposition, Retaliate! */
  async karaSurvived(k) {
    if (!k.alive) return; const ops = await this.karaUse(k, techAt(k, 'onSurvive')); if (!ops) return; const o = ops.find(x => x.op === 'rebuke'); if (!o) return;
    if (!this.knockedDown(k)) await this.knightMove(k, o.n); const [a, b] = o.tokens; const na = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 토큰 4개 — ${a} 개수 (나머지는 ${b})`, options: [4, 3, 2, 1, 0].map(i => ({ label: `${a} ${i} / ${b} ${4 - i}`, value: i })) }); const n = typeof na === 'number' ? na : 4; if (n) this.poolAdd(a, n); if (4 - n) this.poolAdd(b, 4 - n); this.say(`${k.name}: ${a} ${n} · ${b} ${4 - n}`, 'tech');
  },
  /** Motivate X: other Knights move up to X spaces among them. */
  async karaMotivate(k, n) {
    let rem = n; const done = new Set();
    while (rem > 0) { const al = this.karaAllies(k).filter(x => !done.has(x) && !this.knockedDown(x) && !x.engulfed && this.reachable(x, rem).length); if (!al.length) break; const id = await this.ask({ type: 'pickKnight', text: `Motivate — 이동할 기사 (남은 ${rem}칸)`, options: [...al.map(x => ({ label: x.name, value: x.id })), { label: '그만', value: 'skip' }] }); const x = al.find(y => y.id === id); if (!x) break; const p = x.pos; await this.knightMove(x, rem); done.add(x); rem -= Math.max(1, Math.abs(x.pos.c - p.c) + Math.abs(x.pos.r - p.r)); }
  },
  /** Technique ops. Returns true when handled. */
  async karaOp(o, k, ctx) {
    switch (o.op) {
      case 'turnSpeed': k.turnSpeed = (k.turnSpeed || 0) + o.n; this.say(`${k.name}: 턴 종료까지 Speed +${o.n}`, 'tech'); return true;
      case 'rushBoost': k.turnSpeed = (k.turnSpeed || 0) + o.speed; k._rushBoost = o.speed; k.pendingAttackFlags = k.pendingAttackFlags || new Set(); k.pendingExtraPool = k.pendingExtraPool || { red: 0, black: 0, white: 0, raw: 0 }; k.pendingExtraPool.raw += o.power; return true;
      case 'rushBoostEnd': k.turnSpeed = Math.max(0, (k.turnSpeed || 0) - (k._rushBoost || 0)); k._rushBoost = 0; return true;
      case 'hideNow': if (this.fx.inFrontOfMonster(k)) { this.say(`${k.name}: 몬스터 정면 — Hide 불가`, 'warn'); return true; } k.hidden = true; k.hiddenTurn = k.turnsTaken; this.say(`${k.name}: Hidden`, 'tech'); return true;
      case 'bpBottomOrFlip': { const M = this.monster; if (M.isMob) { const rev = (M.mobs || []).filter(m => m.revealed); if (!rev.length) { this.say('공개된 BP 카드 없음'); return true; } const i = rev.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: '뒤집을 공개 BP 카드', options: rev.map((m, i) => ({ label: this.mobLabel(m), value: i })) }) : 0; const m = rev[i] || rev[0]; m.revealed = false; this.say(`${this.mobLabel(m)}: BP 카드를 뒷면으로`, 'tech'); } else if (M.bp.cards.length) { const c = M.bp.cards.shift(); M.bp.cards.push(c); this.say('BP 덱 맨 위 카드를 맨 아래로', 'tech'); } return true; }
      case 'unexhaustWeapon': { const ex = k.gear.filter(g => g.exhausted && !g.discarded && g.type === 'weapon'); if (!ex.length) return true; const i = ex.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: 'Unexhaust할 무기', options: ex.map((g, i) => ({ label: g.name, value: i })) }) : 0; const g = ex[i] || ex[0]; g.exhausted = false; this.say(`${g.name} Unexhaust`, 'tech'); return true; }
      case 'motivateTotal': await this.karaMotivate(k, o.n); return true;
      case 'avertFate': { const top = this.monster.ai && this.monster.ai.cards[0]; if (top) { this.say(`AI 덱 맨 위: ${top.name}`, 'tech'); this.flash('card', { title: 'AI 덱 맨 위', name: top.name, text: top.text || '', cls: 'bad' }); } this.priorityTarget = k; this.turnToward(k.pos); this.say(`${k.name}: Priority Target, 몬스터가 바라봄`, 'tech'); return true; }
      case 'moveAction': k._bypass = 3; this.say(`${k.name}: Superior Bypass`, 'tech'); await this.knightMove(k, this.fx.speed(k)); await this.karaMoveAction(k); return true;
      case 'practised': for (const x of this.karaAllies(k)) { if (this.knockedDown(x) || x.engulfed || x.heat + 1 > x.heatLimit || !this.reachable(x, 1).length) continue; if (await this.yesNo(`${x.name}: Just Like We Practised — Heat +1로 1칸 이동?`, false)) { x.gainHeat(1, { voluntary: true }); await this.knightMove(x, 1); } } return true;
      case 'knowThyself': { if (k.bane > 0 && await this.yesNo(`${k.name}: Bane 토큰 ${k.bane}개 버림?`, true)) { k.bane = 0; this.say(`${k.name}: Bane 0`, 'tech'); } for (const c of [...k.conditions]) if (await this.yesNo(`${k.name}: Condition ${c.id} 버림?`, true)) { k.conditions.splice(k.conditions.indexOf(c), 1); this.say(`${k.name}: ${c.id} 제거`, 'tech'); } const neg = Object.keys(k.modifiers || {}).filter(m => k.modifiers[m]); if (neg.length && await this.yesNo(`${k.name}: modifier 토큰 (${neg.map(m => `${m} ${k.modifiers[m] > 0 ? '+' : ''}${k.modifiers[m]}`).join(', ')}) 모두 버림?`, neg.some(m => k.modifiers[m] < 0))) { for (const m of neg) k.modifiers[m] = 0; this.say(`${k.name}: modifier 토큰 제거`, 'tech'); } return true; }
      case 'tumble': case 'keepHalfPool': case 'rebuke': case 'oathOfValor': case 'evasionDifficulty': case 'livingWeapon': return true; // resolved at their timing
    }
    return false;
  },
};
export const KARA_OPS = new Set(['turnSpeed', 'rushBoost', 'rushBoostEnd', 'hideNow', 'bpBottomOrFlip', 'unexhaustWeapon', 'motivateTotal', 'avertFate', 'moveAction', 'practised', 'knowThyself', 'tumble', 'keepHalfPool', 'rebuke', 'oathOfValor', 'evasionDifficulty', 'livingWeapon']);
/** Wrap core methods with Kara's hooks (Ally movement, surviving Grave Mortis / Judicium). */
export function installKara(Clash) {
  const km = Clash.prototype.knightMove; Clash.prototype.knightMove = async function (k, s) { const p = k.pos; { const t = this._turnKnight; if (this.phase === 'knight' && t && t !== k && t.alive && talentHas(t, 'weGoTogether') && s > 0) { s += 1; this.say(`We Go Together: ${k.name} 이동 +1칸`, 'tech'); } } await this.karaBypassOffer(k, s); const r = await km.call(this, k, s); k._jump = 0; k._bypass = 0; if (k.alive && k.pos && p && (k.pos.c !== p.c || k.pos.r !== p.r)) { this.karaShiningCheck(); await this.karaAllyMoved(k); } return r; };
  const dm = Clash.prototype.drawMortis; Clash.prototype.drawMortis = async function (k, tier, opt) { const r = await dm.call(this, k, tier, opt); if (tier === 'Grave' && !this._inJud) await this.karaSurvived(k); return r; };
  const dj = Clash.prototype.drawJudicium; Clash.prototype.drawJudicium = async function (k) { this._inJud = true; let r; try { r = await dj.call(this, k); } finally { this._inJud = false; } await this.karaSurvived(k); return r; };
}
