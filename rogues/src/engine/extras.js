// Kingdoms Forlorn — Rogue's Path: Techniques that hook into specific timings (Monster Attack targeting, Evasion Roll, involuntary movement,
// death, Judicium draws, BP draws) for Kara, Paracelsa, Ser Sonch, Ser Ubar and Stoneface.
import { ChainBreak } from './clash.js';
const inHand = (k, name) => k && k.hand ? k.hand.find(t => t.name === name && t.ops) : null;

export const ExtrasMixin = {
  /** Start of turn: Unshakeable's ignored Condition cards come back; Armed with Truth expires. */
  extrasTurnStart(k) { this._turnKnight = k; if (k._shelved && k._shelved.length) { for (const c of k._shelved) { k.conditions.push(c); this.say(`${k.name}: ${c.id} 다시 적용 (Unshakeable 종료)`, 'cond'); } k._shelved = []; } k._keepRanged = false; k._keepAny = false; },
  /** Know Thine Enemy: draw the first BP of a chosen Level. */
  async extrasDrawBP(k) {
    const d = this.monster.bp; const t = inHand(k, 'Know Thine Enemy'); const lv = t ? [...new Set(d.cards.map(c => c.level))].sort() : [];
    if (t && lv.length) { const ops = await this.paraUse(k, t); if (ops) { const v = lv.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Know Thine Enemy — 뽑을 BP Level`, options: lv.map(l => ({ label: `Level ${l} (${d.cards.filter(c => c.level === l).length}장)`, value: l })) }) : lv[0]; const i = Math.max(0, d.cards.findIndex(c => c.level === v)); const c = d.cards.splice(i, 1)[0]; this.say(`Know Thine Enemy: Level ${c.level} BP — ${c.name}`, 'tech'); if (this.lsOnMonster()) { this.poolAdd('power', 1); this.say('Little Ser가 Monster Sheet 위 → Power 토큰 1', 'tech'); } return c; } }
    return this.monster.drawBP();
  },
  /** Attacks that draw several BP cards (Renholder): Doublestrike Enchantment, Power Overwhelming. Boss Monsters only. */
  multiBPActive(A) { return !this.monster.isMob && !A.guardian; },
  extrasBeforeAttack(k, A) { if (k.pendingOverwhelm) { const X = k.pendingOverwhelm; k.pendingOverwhelm = 0; if (this.multiBPActive(A)) { A.overwhelm = X; A.extraPool.raw += X; A.ignoreResponses = true; A.dieAfter = true; this.say(`${k.name}: Power Overwhelming — +${X} Power, BP ${X}장, 모든 Response 무시`, 'tech'); } } if (A.flags.has('doublestrike') && this.multiBPActive(A)) A.double = true; },
  /** Power Overwhelming: distribute the Total Power between the X face-down BPs; returns the share of the first BP. */
  async overwhelmDistribute(k, A, power, bp) {
    const extra = []; for (let i = 1; i < A.overwhelm; i++) { const c = this.monster.drawBP(); if (!c) break; extra.push({ bp: c, power: 0 }); }
    const n = extra.length + 1; let rem = power; const share = [];
    for (let i = 0; i < n; i++) { if (i === n - 1) { share.push(rem); break; } const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Power Overwhelming — 뒷면 BP ${i + 1}/${n}에 배분할 Power (남은 ${rem})`, options: Array.from({ length: rem + 1 }, (_, j) => ({ label: `${rem - j}`, value: rem - j })) }); const s = typeof v === 'number' ? v : rem; share.push(s); rem -= s; }
    extra.forEach((e, i) => { e.power = share[i + 1]; }); A.extraBPs = extra; this.say(`Power Overwhelming: Total Power ${power} → ${share.join(' / ')} (BP ${n}장)`, 'tech'); this.say(`BP ${bp.level}: ${bp.name} (AT ${this.bpAT(bp)}) 공개`, 'bp'); return share[0];
  },
  /** Resolve the additional BPs after the first one: wound when the Power reaches the AT (no Responses). */
  async multiBPResolve(k, A) {
    if (!this.multiBPActive(A)) return; const list = A.extraBPs || [];
    for (const e of list) if (e.power == null) e.power = A.totalPower;
    for (const e of list) { const at = this.bpAT(e.bp) - (A.armorPiercing || 0); this.say(`추가 BP ${e.bp.level}: ${e.bp.name} (AT ${at}) — Power ${e.power}`, 'bp'); if (this.monster.slain) { this.monster.discardBP(e.bp); continue; } if (e.power >= at) { const dealt = this.monster.wound(e.bp, { critical: false }); this.onTrollWound(dealt); this.monster.generic.counter = (this.monster.generic.counter || 0) + dealt; this.say(`Wound! — Wound Stack ${this.monster.wounds}/${this.monster.woundsToKill}`, 'wound'); const w0 = A.wounded; A.wounded = true; await this.fx.onWound(k, A); A.wounded = w0 || true; this.priorityLast = k; } else { this.say('Fail to wound'); this.monster.discardBP(e.bp); } }
    A.extraBPs = null; A.double = false;
  },
  /** Techniques used during an ability window of the Knight's own Attack (timing 'firstWindow' / 'secondWindow'), and window Talents. */
  async windowTechs(k, A, which) {
    await this.ubarDrainAll();
    for (const t of k.hand.filter(x => x.ops && (x.timing === which || x.window === which))) { const ops = await this.paraUse(k, t, `${which === 'firstWindow' ? '1차' : '2차'} 창 — ${t.text}`); if (!ops) continue; for (const o of ops) { if (o.op === 'heartseeker') A.flags.add('heartseeker'); else await this.fx.runKnightOp(o, k, { technique: t, window: which, A }); } if (k.pendingAttackFlags) { for (const f of k.pendingAttackFlags) A.flags.add(f); k.pendingAttackFlags = null; } if (k.pendingExtraPool) { for (const c in k.pendingExtraPool) A.extraPool[c] = (A.extraPool[c] || 0) + k.pendingExtraPool[c]; k.pendingExtraPool = null; } }
    await this.stoneWindow(k, A, which);
  },
  /** Armed with Truth: when a Gear card has just been exhausted (voluntarily or not) — ignore it (Ranged Weapon), or spend 1 Zeal for any Gear card. */
  async armedDrain() {
    await this.ubarDrainAll();
    for (const k of this.alive()) { const t = inHand(k, 'Armed with Truth'); const fresh = k.gear.filter(g => g.exhausted && !g.discarded && !g._seenEx);
      if (t) for (const g of fresh) { if (!k.hand.includes(t)) break; const ranged = g.type === 'weapon' && /Ranged/.test(g.text || ''); if (!ranged && this.zealAvail(k) < 1) continue; if (!this.fx.canPay(k, this.fx.costOf(k, t))) break; if (!await this.paraUse(k, t, `${g.name}의 Exhaust 무시${ranged ? '' : ' (Zeal 1 추가)'}`)) continue; if (!ranged) { await this.paraChooseSource(k, 1); this.spendZeal(k, 1); } g.exhausted = false; this.say(`${k.name}: Armed with Truth — ${g.name} Exhaust 무시`, 'tech'); }
      for (const g of k.gear) g._seenEx = !!g.exhausted; }
  },
  async extrasOp(o, k, ctx) {
    switch (o.op) {
      case 'timed': case 'doublestrike': case 'overwhelm': return true;
      case 'unshakeable': { if (!k.conditions.length) { this.say(`${k.name}: Condition 카드 없음`); return true; } const i = k.conditions.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Unshakeable — ${o.discard ? '버릴' : '다음 턴 시작까지 무시할'} Condition`, options: k.conditions.map((c, i) => ({ label: c.id, value: i })) }) : 0; const c = k.conditions.splice(i || 0, 1)[0]; if (o.discard) this.say(`${k.name}: ${c.id} 버림`, 'tech'); else { (k._shelved = k._shelved || []).push(c); this.say(`${k.name}: ${c.id} — 다음 턴 시작까지 무시`, 'tech'); } return true; }
      case 'piousAttack': { const mx = this.zealAvail(k); const extra = mx > 0 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Power of the Pious — X (Zeal, 1개는 이미 지불)`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: `X = ${mx + 1 - i}`, value: mx - i })) }) : 0; const ex = typeof extra === 'number' ? extra : 0; if (ex > 0) { await this.paraChooseSource(k, ex); this.spendZeal(k, ex); } const X = 1 + ex;
        const w = { name: 'Sword of Smiting', type: 'weapon', hands: 0, attackDice: 1, precision: 2, weaponPower: { n: 3, colour: 'red', dice: ['red', 'red', 'red'] }, bonusPower: { dice: ['black', 'black'] }, text: `Reach ${X}. Daze.${X >= 1 ? ' Break 3.' : ''}${X >= 2 ? ' Deadly.' : ''}`, traits: [], exhausted: false, discarded: false };
        if (!this.attackTargets(k, w).length) { this.say('Sword of Smiting: 사거리 안에 대상 없음'); return true; }
        if (X >= 3) k.pendingPowerRerolls = (k.pendingPowerRerolls || 0) + 1; if (X >= 4) k.pendingAttackRerolls = (k.pendingAttackRerolls || 0) + 1; if (X >= 5) this.poolAdd('hope', 2); if (X >= 6) { k.pendingAttackFlags = k.pendingAttackFlags || new Set(); k.pendingExtraPool = k.pendingExtraPool || { red: 0, black: 0, white: 0, raw: 0 }; k.pendingExtraPool.raw += 2; }
        this.say(`${k.name}: Power of the Pious — X = ${X}`, 'tech'); await this.knightAttack(k, { weapon: w }); return true; }
    }
    return false;
  },
};
export const EXTRA_OPS = new Set(['timed', 'unshakeable', 'armedWithTruth', 'piousAttack', 'doublestrike', 'overwhelm']);
export function installExtras(Clash) {
  const P = Clash.prototype;
  const aot = P.attackOneTarget; P.attackOneTarget = async function (attack, k) {
    // Take the Hit: another Knight adjacent to the attacking Monster becomes the Target instead
    for (const x of this.alive()) { const t = inHand(x, 'Take the Hit'); if (!t || x === k || attack.targets.includes(x) || !(this.monster.isMob ? this.adjacentMobs(x).length : this.adjacentToMonster(x))) continue; if (await this.paraUse(x, t, `${k.name} 대신 대상이 됨`)) { this.say(`${x.name}: Take the Hit — ${k.name} 대신 대상`, 'tech'); this.leash(x, this.fx.tierOk(x, 'DRAGON') ? 3 : 2, 'Take the Hit'); k = x; k._noER = true; break; } }
    { const cfg = this.lsCfg(); const o = this.lsOwner(); if (cfg && cfg.chainBreak && this.lsCell() && this.board.adjacent(this.lsCell(), k.pos) && await this.yesNo(`${o.name}: Steadfast Supporter — Little Ser를 Clash 끝까지 버리고 ${k.name}에 대한 이 공격을 Chain Break?`, false)) { this.lsSet('gone'); this.say('Little Ser 버림 (Clash 끝까지) — Chain Break', 'tech'); throw new ChainBreak('Steadfast Supporter'); } }
    // Call an Undertaker!: gain Knockdown (Standing Up) and skip the Attack
    { const t = inHand(k, 'Call an Undertaker!'); if (t && !this.knockedDown(k) && await this.paraUse(k, t)) { await this.addCondition(k, 'Knockdown (Standing Up)'); this.say(`${k.name}: Call an Undertaker! — 이 공격을 건너뜀`, 'tech'); return; } }
    { const t = inHand(k, 'Eye of the Storm'); if (t && await this.paraUse(k, t)) { k._eyeStorm = true; if (k.form === 'human') { k.braced = true; this.say(`${k.name}: Braced`, 'tech'); } } }
    { const judge = attack.card && attack.card.ops && attack.card.ops.judge; const t = judge && inHand(k, 'Adrenaline Rush'); if (t && await this.paraUse(k, t, k.form === 'ape' ? 'Advanced Defy' : 'Virtue Test 결과마다 +2')) { if (k.form === 'ape') k._preBlock = 2; else k._adrenaline = true; } }
    try { const r0 = await aot.call(this, attack, k); await this.armedDrain(); return r0; } finally { k._eyeStorm = false; k._adrenaline = false; k._preBlock = 0; k._noER = false; }
  };
  const pb = P.pushback; P.pushback = async function (k, n, opt = {}) {
    { const cfg = this.lsCfg(); const at = this.currentAttack; if (cfg && cfg.kbReduce && this.lsOnMonster() && at && (at.targets || []).length === 1 && n > 0 && await this.yesNo(`${k.name}: Steadfast Supporter (Little Ser — Monster Sheet) — Knockback ${n} → ${Math.max(0, n - cfg.kbReduce)}?`, true)) { n = Math.max(0, n - cfg.kbReduce); this.say(`${k.name}: Knockback -${cfg.kbReduce}`, 'tech'); if (!n) return; } }
    const t = k.alive && n > 0 && !k.braced ? inHand(k, 'Knight Stand') : null;
    if (t && await this.paraUse(k, t, `비자발적 이동 ${n}칸`)) { const red = this.fx.tierOk(k, 'DEVIL') ? 4 : 3; let v = 'reduce'; if (this.canUnleash(k, 7)) v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Knight Stand`, options: [{ label: 'Unleash 7 → Braced', value: 'braced' }, { label: `이동을 최대 ${red}칸 줄임`, value: 'reduce' }] }) || 'reduce'; if (v === 'braced') { this.unleash(k, 7); this.say(`${k.name} Braced: 밀려나지 않음`, 'tech'); return; } n = Math.max(0, n - red); this.say(`${k.name}: Knight Stand — 비자발적 이동 → ${n}칸`, 'tech'); if (!n) return; }
    return pb.call(this, k, n, opt);
  };
  const kd = P.knockdown; P.knockdown = async function (k, ...a) { const cfg = this.lsCfg(); const at = this.currentAttack; if (k.alive && cfg && cfg.kbReduce && this.lsOnMonster() && at && (at.targets || []).length === 1 && await this.yesNo(`${k.name}: Steadfast Supporter (Little Ser — Monster Sheet) — Knockdown 무시?`, true)) { this.say(`${k.name}: Knockdown 무시`, 'tech'); return; } return kd.call(this, k, ...a); };
  const dm = P.drawMortis; P.drawMortis = async function (...a) { this._inMortis = (this._inMortis || 0) + 1; try { return await dm.apply(this, a); } finally { this._inMortis--; } };
  const die = P.die; P.die = async function (k, reason) {
    if (!k.alive) return;
    if (this._inJud) { const t = inHand(k, 'Vita Ex Mortis'); if (t && await this.paraUse(k, t, `Judicium으로 인한 죽음 무시 (${reason})`)) { this.say(`${k.name}: Vita Ex Mortis — 죽음 무시`, 'tech'); return; } }
    else if (!this._inMortis && this.currentAttack) { const t = inHand(k, 'Through the Fires of Anatiocha'); const cells = t ? this.board.neighbors(k.pos).filter(c => !this.knightAt(c) && !this.board.isObstacle(c) && !this.monsterOccupies(c)) : []; if (t && cells.length && await this.paraUse(k, t, `Instant Death 무시 후 Displace (${reason})`)) { const to = await this.ask({ type: 'move', knight: k.id, text: `${k.name}: Displace — 인접한 빈 칸`, cells, options: cells.map(c => ({ label: this.board.label(c), value: c })) }) || cells[0]; this.moveKnight(k, to); this.say(`${k.name}: Through the Fires of Anatiocha — 죽음 무시, ${this.board.label(to)}로 Displace`, 'tech'); return; } }
    return die.call(this, k, reason);
  };
  const ka = P.knightAttack; P.knightAttack = async function (k, opts) { const r = await ka.call(this, k, opts); await this.armedDrain(); const A = this.lastAttack; if (A && A.knight === k && A.dieAfter && k.alive) { A.dieAfter = false; this.say(`${k.name}: Power Overwhelming — 공격을 마치고 사망`, 'death'); await this.die(k, 'Power Overwhelming'); } return r; };
  const pc = P.perilCheck; P.perilCheck = async function (k) {
    const r = await pc.call(this, k); if (!k.alive || !this.currentAttack) return r;
    { const t = inHand(k, 'My Turn'); if (t && await this.paraUse(k, t, 'Peril check 뒤 Chain Break + BP 공개')) { const top = !this.monster.isMob && this.monster.bp.cards[0]; if (top) { const at = this.bpAT(top); this.say(`My Turn: BP 덱 맨 위 공개 — ${top.name} (AT ${at})`, 'tech'); this.flash('card', { title: 'BP 덱 맨 위', name: top.name, text: top.text || '', cls: 'good' }); if (!top.isThickSkin && this.canUnleash(k, at) && await this.yesNo(`${k.name}: My Turn — Unleash ${at}로 ${top.name}에 Wound? (Response 해결, Wound Stack, Escalate)`, true)) { this.unleash(k, at); this.monster.bp.cards.shift(); const A0 = { knight: k, bp: top, wounded: true, critical: false, flags: new Set(), kw: [], extraPool: { raw: 0 } }; for (const [kind, rops] of [['Wound', top.ops && top.ops.wound], ['Instinct', top.ops && top.ops.instinct]]) { if (!rops || !rops.length) continue; this.say(`${kind} Response`); try { await this.runResponseOps(rops, this.bpReactIndices(top, kind), { attacker: k, attack: A0, target: k }); } catch (e) { if (!e.chainBreak) throw e; this.say(`Chain Break: ${e.message}`, 'warn'); } } const dealt = this.monster.wound(top, { critical: false }); this.onTrollWound(dealt); this.monster.generic.counter = (this.monster.generic.counter || 0) + dealt; this.say(`My Turn: Wound! — Wound Stack ${this.monster.wounds}/${this.monster.woundsToKill}`, 'wound'); this.ubarWound(k); this.priorityLast = k; this.checkEnd(); } } throw new ChainBreak('My Turn'); } }
    { const t = inHand(k, 'Become a Stumbling Block'); if (t && await this.paraUse(k, t, 'Peril check 뒤 Chain Break')) throw new ChainBreak('Become a Stumbling Block'); }
    return r;
  };
}
