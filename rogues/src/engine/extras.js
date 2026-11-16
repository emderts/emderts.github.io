// Kingdoms Forlorn — Rogue's Path: Techniques that hook into specific timings (Monster Attack targeting, Evasion Roll, involuntary movement,
// death, Judicium draws, BP draws) for Kara, Paracelsa, Ser Sonch, Ser Ubar and Stoneface.
import { ChainBreak } from './clash.js';
const inHand = (k, name) => k && k.hand ? k.hand.find(t => t.name === name && t.ops) : null;

export const ExtrasMixin = {
  /** Start of turn: Unshakeable's ignored Condition cards come back; Armed with Truth expires. */
  extrasTurnStart(k) { if (k._shelved && k._shelved.length) { for (const c of k._shelved) { k.conditions.push(c); this.say(`${k.name}: ${c.id} 다시 적용 (Unshakeable 종료)`, 'cond'); } k._shelved = []; } k._keepRanged = false; },
  /** Know Thine Enemy: draw the first BP of a chosen Level. */
  async extrasDrawBP(k) {
    const d = this.monster.bp; const t = inHand(k, 'Know Thine Enemy'); const lv = t ? [...new Set(d.cards.map(c => c.level))].sort() : [];
    if (t && lv.length) { const ops = await this.paraUse(k, t); if (ops) { const v = lv.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Know Thine Enemy — 뽑을 BP Level`, options: lv.map(l => ({ label: `Level ${l} (${d.cards.filter(c => c.level === l).length}장)`, value: l })) }) : lv[0]; const i = Math.max(0, d.cards.findIndex(c => c.level === v)); const c = d.cards.splice(i, 1)[0]; this.say(`Know Thine Enemy: Level ${c.level} BP — ${c.name}`, 'tech'); if (this.lsOnMonster()) { this.poolAdd('power', 1); this.say('Little Ser가 Monster Sheet 위 → Power 토큰 1', 'tech'); } return c; } }
    return this.monster.drawBP();
  },
  async extrasOp(o, k, ctx) {
    switch (o.op) {
      case 'timed': return true;
      case 'unshakeable': { if (!k.conditions.length) { this.say(`${k.name}: Condition 카드 없음`); return true; } const i = k.conditions.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Unshakeable — ${o.discard ? '버릴' : '다음 턴 시작까지 무시할'} Condition`, options: k.conditions.map((c, i) => ({ label: c.id, value: i })) }) : 0; const c = k.conditions.splice(i || 0, 1)[0]; if (o.discard) this.say(`${k.name}: ${c.id} 버림`, 'tech'); else { (k._shelved = k._shelved || []).push(c); this.say(`${k.name}: ${c.id} — 다음 턴 시작까지 무시`, 'tech'); } return true; }
      case 'armedWithTruth': k._keepRanged = true; this.say(`${k.name}: 이번 턴 Ranged 무기의 다음 Exhaust 무시`, 'tech'); return true;
      case 'piousAttack': { const mx = this.zealAvail(k); const extra = mx > 0 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Power of the Pious — X (Zeal, 1개는 이미 지불)`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: `X = ${mx + 1 - i}`, value: mx - i })) }) : 0; const ex = typeof extra === 'number' ? extra : 0; if (ex > 0) { await this.paraChooseSource(k, ex); this.spendZeal(k, ex); } const X = 1 + ex;
        const w = { name: 'Sword of Smiting', type: 'weapon', hands: 0, attackDice: 1, precision: 2, weaponPower: { n: 3, colour: 'red', dice: ['red', 'red', 'red'] }, bonusPower: { dice: ['black', 'black'] }, text: `Reach ${X}. Daze.${X >= 1 ? ' Break 3.' : ''}${X >= 2 ? ' Deadly.' : ''}`, traits: [], exhausted: false, discarded: false };
        if (!this.attackTargets(k, w).length) { this.say('Sword of Smiting: 사거리 안에 대상 없음'); return true; }
        if (X >= 3) k.pendingPowerRerolls = (k.pendingPowerRerolls || 0) + 1; if (X >= 4) k.pendingAttackRerolls = (k.pendingAttackRerolls || 0) + 1; if (X >= 5) this.poolAdd('hope', 2); if (X >= 6) { k.pendingAttackFlags = k.pendingAttackFlags || new Set(); k.pendingExtraPool = k.pendingExtraPool || { red: 0, black: 0, white: 0, raw: 0 }; k.pendingExtraPool.raw += 2; }
        this.say(`${k.name}: Power of the Pious — X = ${X}`, 'tech'); await this.knightAttack(k, { weapon: w }); return true; }
    }
    return false;
  },
};
export const EXTRA_OPS = new Set(['timed', 'unshakeable', 'armedWithTruth', 'piousAttack']);
export function installExtras(Clash) {
  const P = Clash.prototype;
  const aot = P.attackOneTarget; P.attackOneTarget = async function (attack, k) {
    // Take the Hit: another Knight adjacent to the attacking Monster becomes the Target instead
    for (const x of this.alive()) { const t = inHand(x, 'Take the Hit'); if (!t || x === k || attack.targets.includes(x) || !(this.monster.isMob ? this.adjacentMobs(x).length : this.adjacentToMonster(x))) continue; if (await this.paraUse(x, t, `${k.name} 대신 대상이 됨`)) { this.say(`${x.name}: Take the Hit — ${k.name} 대신 대상`, 'tech'); this.leash(x, this.fx.tierOk(x, 'DRAGON') ? 3 : 2, 'Take the Hit'); k = x; break; } }
    // Call an Undertaker!: gain Knockdown (Standing Up) and skip the Attack
    { const t = inHand(k, 'Call an Undertaker!'); if (t && !this.knockedDown(k) && await this.paraUse(k, t)) { await this.addCondition(k, 'Knockdown (Standing Up)'); this.say(`${k.name}: Call an Undertaker! — 이 공격을 건너뜀`, 'tech'); return; } }
    { const t = inHand(k, 'Eye of the Storm'); if (t && await this.paraUse(k, t)) { k._eyeStorm = true; if (k.form === 'human') { k.braced = true; this.say(`${k.name}: Braced`, 'tech'); } } }
    { const judge = attack.card && attack.card.ops && attack.card.ops.judge; const t = judge && inHand(k, 'Adrenaline Rush'); if (t && await this.paraUse(k, t, k.form === 'ape' ? 'Advanced Defy' : 'Virtue Test 결과마다 +2')) { if (k.form === 'ape') k._preBlock = 2; else k._adrenaline = true; } }
    try { return await aot.call(this, attack, k); } finally { k._eyeStorm = false; k._adrenaline = false; k._preBlock = 0; }
  };
  const pb = P.pushback; P.pushback = async function (k, n, opt = {}) {
    const t = k.alive && n > 0 && !k.braced ? inHand(k, 'Knight Stand') : null;
    if (t && await this.paraUse(k, t, `비자발적 이동 ${n}칸`)) { const red = this.fx.tierOk(k, 'DEVIL') ? 4 : 3; let v = 'reduce'; if (this.canUnleash(k, 7)) v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Knight Stand`, options: [{ label: 'Unleash 7 → Braced', value: 'braced' }, { label: `이동을 최대 ${red}칸 줄임`, value: 'reduce' }] }) || 'reduce'; if (v === 'braced') { this.unleash(k, 7); this.say(`${k.name} Braced: 밀려나지 않음`, 'tech'); return; } n = Math.max(0, n - red); this.say(`${k.name}: Knight Stand — 비자발적 이동 → ${n}칸`, 'tech'); if (!n) return; }
    return pb.call(this, k, n, opt);
  };
  const dm = P.drawMortis; P.drawMortis = async function (...a) { this._inMortis = (this._inMortis || 0) + 1; try { return await dm.apply(this, a); } finally { this._inMortis--; } };
  const die = P.die; P.die = async function (k, reason) {
    if (!k.alive) return;
    if (this._inJud) { const t = inHand(k, 'Vita Ex Mortis'); if (t && await this.paraUse(k, t, `Judicium으로 인한 죽음 무시 (${reason})`)) { this.say(`${k.name}: Vita Ex Mortis — 죽음 무시`, 'tech'); return; } }
    else if (!this._inMortis && this.currentAttack) { const t = inHand(k, 'Through the Fires of Anatiocha'); const cells = t ? this.board.neighbors(k.pos).filter(c => !this.knightAt(c) && !this.board.isObstacle(c) && !this.monsterOccupies(c)) : []; if (t && cells.length && await this.paraUse(k, t, `Instant Death 무시 후 Displace (${reason})`)) { const to = await this.ask({ type: 'move', knight: k.id, text: `${k.name}: Displace — 인접한 빈 칸`, cells, options: cells.map(c => ({ label: this.board.label(c), value: c })) }) || cells[0]; this.moveKnight(k, to); this.say(`${k.name}: Through the Fires of Anatiocha — 죽음 무시, ${this.board.label(to)}로 Displace`, 'tech'); return; } }
    return die.call(this, k, reason);
  };
  const dj = P.drawJudicium; P.drawJudicium = async function (k) {
    const r = await dj.call(this, k); if (!k.alive || !this.currentAttack) return r;
    { const t = inHand(k, 'My Turn'); if (t && await this.paraUse(k, t, 'Judicium 뒤 Chain Break + BP 맨 위 공개')) { const top = !this.monster.isMob && this.monster.bp.cards[0]; if (top) { this.say(`My Turn: BP 덱 맨 위 공개 — ${top.name} (AT ${this.bpAT ? this.bpAT(top) : top.at})`, 'tech'); this.flash('card', { title: 'BP 덱 맨 위', name: top.name, text: top.text || '', cls: 'good' }); } throw new ChainBreak('My Turn'); } }
    { const t = inHand(k, 'Become a Stumbling Block'); if (t && await this.paraUse(k, t, 'Judicium 뒤 Chain Break')) throw new ChainBreak('Become a Stumbling Block'); }
    return r;
  };
}
