// Cycle I Gamechanger + Cycle V Titans (Lunarlander, Wishender, Shadowdancer, Cloudsoarer)
import { Board } from './core.js';

export function installC5Titans(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const yn = (g, t, title) => g.ask({ type: 'yn', titan: t, title, options: [{ label: '사용', value: true }, { label: '패스', value: false }] });
  const solo = async (g, fn) => { try { await fn(); } catch (e) { if (e instanceof BattleOver) throw e; if (e instanceof TitanDied) return; throw e; } };
  const aiLevel = card => (card && typeof card.aiTier === 'number') ? card.aiTier : (card && typeof card.tier === 'number') ? card.tier : null;
  const laserCard = card => !!(card && ((card.oracle && card.oracle.laser) || (card.midas && card.midas.laser) || (card.sun && card.sun.mode === 'laser') || (card.oh && card.oh.mode === 'laser') || card.eclipse || card.laser || /LASER|MICROWAVE/.test(card.kind || '')));

  Object.assign(P, {
    // ---------- generic token tracks (Wish Engine / Carry the Weight) ----------
    genAb(t) { return this.ab(t, 'Wish Engine') ? 'Wish Engine' : this.ab(t, 'Carry the Weight') ? 'Carry the Weight' : null; },
    genGain(t, n, why) { const a = this.genAb(t); if (!a || !t.alive || n <= 0) return; t.genTok = (t.genTok || 0) + n; this.say(`${t.name}: ${a} — Generic 토큰 +${n} (${why}) → ${t.genTok}`, 'good'); this.notify(); },
    async genSpend(t, n, what) { const a = this.genAb(t); if (!a || !t.alive || (t.genTok || 0) < n) return false; if (!(await yn(this, t, `${a}: Generic 토큰 ${n}개 버리고 ${what}? (보유 ${t.genTok})`))) return false; t.genTok -= n; this.say(`${t.name}: ${a} — 토큰 ${n}개 버림 → ${what} (남은 ${t.genTok})`, 'good'); this.notify(); return true; },
    // ---------- Wish Shield ----------
    // Wish Shield (Wish + Laser) / Electromagnetic Shield (Laser + Microwave): self or an adjacent Titan with it
    shieldsFor(k) { return k === 'Wish' ? ['Wish Shield'] : ['Wish Shield', 'Electromagnetic Shield']; },
    wishShieldSrc(t, k = 'Laser') { if (!t || !t.alive) return null; const L = this.shieldsFor(k); const own = L.find(n => this.ab(t, n)); if (own) return own; if (t.offBoard || t.onVP || t.stair || !t.pos) return null; for (const x of this.liveTitans()) { if (x === t || x.offBoard || x.stair || this.tDist(x, t) !== 1) continue; const n = L.find(n => this.ab(x, n)); if (n) return n; } return null; },
    wishShieldOn(t, k = 'Laser') { return !!this.wishShieldSrc(t, k); },
    wishShieldKind(t, card, laser = false) { return (laser || laserCard(card)) ? 'Laser' : (this._wishNoArmor === t ? 'Wish' : null); },
    c5WishShieldPer(t, card, per) { const k = this.wishShieldKind(t, card); if (!k || per <= 1 || !this.wishShieldOn(t, k)) return per; this.say(`${t.name}: ${this.wishShieldSrc(t, k)} — ${k} Attack hit당 Danger −1 (${per} → ${per - 1})`, 'good'); return per - 1; },
    // ---------- One Small Step ----------
    oneSmallStep(t) { return !!(t && this.ab(t, 'One Small Step') && (t.onVP || t.stair)); },
    // ---------- weapon restrictions ----------
    c5WeaponBanned(t, g) { if (!g || g.godform || g.card.name === 'Fists') return false; const s = g.card.slot; if (!/^hand/.test(s || '')) return false; if (this.ab(t, 'Four-Armed Centimanes') && (s === 'hand2' || s === 'hand3')) return true; if (this.ab(t, 'Nimble Feet') && s === 'hand3') return true; if (this.ab(t, 'Lightweight Curse') && (s === 'hand1' || s === 'hand1x3')) return true; return false; },
    // ---------- Power roll (Djinnslayer, Raw Power inherent, token +1 Power) ----------
    async c5Power(t, g, A) {
      const rp = this.inh(t, 'Raw Power'); if (rp) { A.raw += rp; this.say(`${t.name}: +${rp} Power (Titan sheet)`); }
      if (this.ab(t, 'Djinnslayer') && (t.stair || t.impaled || t.absorbed || t.offBoard === 'omega')) { A.raw += 1; this.say(`${t.name}: Djinnslayer — ${t.stair ? 'Endless Staircase' : 'Status 카드'} 위, +1 Power`, 'good'); }
      if (await this.genSpend(t, 4, 'Power Roll +1 Power')) A.raw += 1;
    },
    // ---------- Kratos Table: Scale X / Unburden X / Pole Position (1st or 2nd ability window) ----------
    async c5KratosWindow(t, A, kt, win) {
      if (!t || !t.alive || !kt || !A) return;
      if (win === 1 && kt.scale && !A.c5scale) { A.c5scale = true; await this.c5Scale(t, kt.scale); if (!t.alive) return; }
      if (kt.unburden && !A.c5unburden && await this.c5Unburden(t, kt.unburden, win)) A.c5unburden = true;
      if (kt.pole && !A.pole && !t.onVP && !t.offBoard && !t.stair && this.isAdj(t)) {
        const cells = []; for (const p of this.primCells()) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = { c: p.c + dx, r: p.r + dy }; if (this.freeCell(q) && !this.board.isChasm(q.c, q.r) && !cells.some(z => z.c === q.c && z.r === q.r) && !(q.c === t.pos.c && q.r === t.pos.r)) cells.push(q); }
        if (cells.length) { const q = await this.ask({ type: 'move', titan: t, title: `Kratos: Pole Position (${win === 1 ? '1st' : '2nd'} 윈도우) — Primordial에 인접한 빈 칸으로 이동?`, cells, options: [{ label: '안 함', value: null }, ...cells.map(c => ({ label: `${'ABCDEFGHIJKLMN'[c.r - 1]}${c.c}`, value: c }))] }); if (q) { A.pole = true; t.pos = { ...q }; this.say(`${t.name}: Pole Position (Kratos) → ${'ABCDEFGHIJKLMN'[q.r - 1]}${q.c}`); this.notify(); await this.landOn(t); } }
      }
    },
    async c5Scale(t, x) {
      if (t.stair && this.stairClimb) { if (await yn(this, t, `Kratos: Scale ${x} — Endless Staircase를 ${x}칸 오르기?`)) { this.say(`${t.name}: Scale ${x} — 계단 ${x}칸 위로`, 'good'); await this.stairClimb(t, x); } return; }
      const V = this.prim.vp; if (!V || t.knockdown || t.offBoard) return;
      const sunMode = !!this.prim.def.sunD;
      if (t.onVP) { if (!sunMode || !(this.vpFree && this.vpFree().length)) return; if (!(await yn(this, t, `Kratos: Scale ${x} — 다른 VP로 이동?`))) return; const free = this.vpFree(); const lvl = free.length === 1 ? free[0] : await this.ask({ type: 'choice', titan: t, title: 'Scale: VP 선택', options: free.map(l => ({ label: `VP ${'I'.repeat(l)}`, value: l })) }); this.prim.vp.occupants = this.prim.vp.occupants.filter(y => y !== t); t.onVP = false; this.sunMount(t, lvl || free[0]); return; }
      if (!this.isAdj(t)) return; const room = sunMode ? (this.vpFree ? this.vpFree().length : 0) : this.vpRoom(); if (!room) return;
      if (!(await yn(this, t, `Kratos: Scale ${x} — 테스트 없이 VP 「${this.prim.def.vp.name}」에 오르기?`))) return;
      if (sunMode) { const free = this.vpFree(); this.sunMount(t, free[0]); return; }
      if (V.slots > 1) await this.vpSlotChoose(t); this.mountVP(t, 'Scale (Kratos)');
    },
    async c5Unburden(t, x, win) {
      const others = this.liveTitans().filter(o => o !== t && !o.offBoard && !t.offBoard && o.pos && t.pos); if (!others.length) return false;
      const NOT = new Set([...(this.data.decks.kratos || []).map(c => c.name), 'Time-clocked', 'Omega Terminus', 'Roused', ...(this.curses ? this.curses(t) : [])]);
      const items = () => [...t.conditions.filter(c => !NOT.has(c)).map(c => ({ label: `Condition 「${c}」`, value: { k: 'cond', c } })), ...(t.despair ? [{ label: `Despair 1 (보유 ${t.despair})`, value: { k: 'despair' } }] : []), ...(t.ambrosia ? [{ label: `Ambrosia 1 (보유 ${t.ambrosia})`, value: { k: 'ambrosia' } }] : [])];
      if (!items().length) return false; let used = false;
      for (let i = 0; i < x && t.alive; i++) {
        const opts = items(); if (!opts.length) break; const dmin = Math.min(...others.filter(o => o.alive).map(o => this.tDist(t, o))); const near = others.filter(o => o.alive && this.tDist(t, o) === dmin); if (!near.length) break;
        const v = await this.ask({ type: 'choice', titan: t, title: `Kratos: Unburden ${x} (${win === 1 ? '1st' : '2nd'} 윈도우, ${i + 1}/${x}) — 가장 가까운 타이탄(${near.map(o => o.name).join(', ')})에게 줄 토큰`, options: [{ label: '안 함', value: null }, ...opts] }); if (!v) break;
        const o = near.length === 1 ? near[0] : await this.ask({ type: 'choice', titan: t, title: 'Unburden: 받을 타이탄', options: near.map(y => ({ label: y.name, value: y })) }); used = true;
        if (v.k === 'despair') { t.despair--; this.say(`Unburden: ${t.name}의 Despair 1개 → ${o.name}`); await solo(this, () => this.gainDespair(o, 1, true)); }
        else if (v.k === 'ambrosia') { t.ambrosia--; this.say(`Unburden: ${t.name}의 Ambrosia 1개 → ${o.name}`); await solo(this, () => this.gainAmbrosia(o, 1)); }
        else { const c = v.c; const tok = c === 'Bleeding' ? (t.bleeding || 1) : c === 'Death' ? (t.deathTokens || 1) : undefined; t.conditions = t.conditions.filter(z => z !== c); if (c === 'Bleeding') t.bleeding = 0; if (c === 'Death') t.deathTokens = 0; if (c === 'Float') t.float = null; this.say(`Unburden: ${t.name}의 Condition 「${c}」 → ${o.name}`); await solo(this, () => this.addCondition(o, c, tok !== undefined ? { tokens: tok } : {})); }
      }
      return used;
    },
    // ---------- Shadowdance ----------
    async shadowdanceFlush() {
      for (const t of this.titans) {
        const card = t._sdCard; t._sdCard = null;
        if (!card || !t.alive || !this.ab(t, 'Shadowdance') || t.offBoard || t.knockdown || t.impaled || t.stair || t.float === 'up' || this.paralyzed(t) || t.fatigue) continue;
        if (this.prim.def.dahakaD && card._dhUsed) { this.say(`${t.name}: Shadowdance — 이미 Interrupt Attack이 해결된 Dahaka 공격이라 사용 불가`); continue; }
        const lv = aiLevel(card); if (lv == null || card.kind === 'SIGNATURE' || card.kind === 'ROUTINE' || card.isSignature) continue; const X = Math.max(0, 3 - lv); if (X > this.fr(t)) continue;
        if (!(await yn(this, t, `Shadowdance: 「${card.name}」 해결 후 — Fate +${X}로 이동 액션 + 전투 액션 (공격은 Interrupt 취급), Combat Fatigue 토큰`))) continue;
        if (X) await this.gainFate(t, X); this.say(`${t.name}: SHADOWDANCE!`, 'good');
        const prevActor = this._actor;
        await solo(this, async () => { if (!t.onVP) await this.chooseMove(t, this.speedOf(t), 'Reposition (Shadowdance)'); if (!t.alive) return; await this.combatActionNow(t, 'Shadowdance', { interrupt: true }); }); // FAQ: misprint — Shadowdance grants a Combat Action, not just an Attack
        this._actor = prevActor;
        if (t.alive && !t.fatigue) { t.fatigue = 'combat'; this.say(`${t.name}: Shadowdance — Combat Fatigue 토큰`); }
        this.notify();
      }
    },
  });

  // ---------- Gamechanger ----------
  wrap('afterSurvive', async function (o, t, tier, card = null) {
    await o.call(this, t, tier, card);
    if (t && t.alive && (tier === 'Major' || tier === 'Grave' || tier === 'Obol') && this.ab(t, 'Ruse')) { this.kratosPool.opening += 1; this.say(`${t.name}: Ruse — ${tier} 생존, Kratos Pool에 Opening 1`, 'good'); }
  });
  wrap('c4AfterRoll', async function (o, t, g, A, ...r) { if (A && A.critMiss && this.ab(t, 'Disturbance in Fate')) this.say(`${t.name}: Disturbance in Fate — Crit Miss (캠페인 효과, 무시)`, 'sys'); return o.call(this, t, g, A, ...r); });
  wrap('c4Reactions', function (o, x, t, card) {
    const out = o.call(this, x, t, card);
    if (this.ab(x, 'Advanced Reflex') && x.advReflexRound !== this.round && this.fr(x) > 0 && this.hopeless(x) < 2 && !x.knockdown && !x.onVP && !x.offBoard && !x.stair && !x.impaled && x.float !== 'up')
      out.push({ label: `${x.name}: Advanced Reflex (최대 2칸 이동) [Fate+1, 라운드 1회]`, value: async () => { x.advReflexRound = this.round; await this.gainFate(x, 1); this.say(`${x.name}: [R] Advanced Reflex`); await this.chooseMove(x, 2, 'Advanced Reflex'); } });
    return out;
  });

  // ---------- Lunarlander ----------
  wrap('startOfBattle', async function (o) { for (const t of this.liveTitans()) if (this.ab(t, 'Selenian Strain')) this.say(`${t.name}: Selenian Strain — Aether 토큰 1개 (Cycle V 메커니즘 미구현, 효과 없음)`, 'sys'); return o.call(this); });
  wrap('kwUse', async function (o, t, name, what) { if (name === 'Rocksteady' && this.oneSmallStep(t)) { this.say(`${t.name}: One Small Step — ${t.onVP ? 'VP' : 'Endless Staircase'} 위, Rocksteady`, 'good'); return true; } return o.call(this, t, name, what); });
  wrap('hasKW', function (o, t, name, ...r) { const v = o.call(this, t, name, ...r); if (v === null && name === 'Rocksteady' && this.oneSmallStep(t)) return 0; return v; });
  wrap('afterAttack', async function (o, card, t, targets = null) {
    const a = card && card.after;
    if (a && this.currentAI && (card.afterWindow || /⚡/.test(a))) for (const x of this.liveTitans()) {
      if (!this.ab(x, 'Forgotten Curse') || x.forgottenUsed || x.knockdown === 'falling' || x.offBoard || this.paralyzed(x)) continue;
      if (!(await yn(this, x, `Forgotten Curse (전투당 1회): Despair 3개를 받고 After Attack 「${a}」을(를) 건너뛸까요?`))) continue;
      x.forgottenUsed = true; this.say(`${x.name}: Forgotten Curse — After Attack 건너뜀 (Despair +3)`, 'good');
      await solo(this, () => this.gainDespair(x, 3)); return;
    }
    return o.call(this, card, t, targets);
  });

  // ---------- Wishender ----------
  wrap('primAttackOn0', async function (o, t, card) {
    const r = await o.call(this, t, card);
    if (t && t.alive && this._wishNoArmor === t && this.ab(t, 'Wish Engine')) { const lv = aiLevel(card) || 0; if (lv > 0) this.genGain(t, lv, `Wish Attack 생존, AI 레벨 ${lv}`); else this.say(`${t.name}: Wish Engine — AI 레벨 없음 (Signature 등), 토큰 없음`, 'sys'); }
    return r;
  });
  wrap('primAttackOn', async function (o, t, card) { if (t && t.alive && card && this.ab(t, 'Shadowdance')) t._sdCard = card; return o.call(this, t, card); });
  wrap('resolveAIInner', async function (o, ...a) { let r; try { r = await o.call(this, ...a); } catch (e) { if (e && e.chainBreak && this._aiDepth === 1) await this.shadowdanceFlush(); throw e; } if (this._aiDepth === 1) await this.shadowdanceFlush(); return r; });
  wrap('midasCondition', async function (o, t, nm, ...r) {
    const outerTangle = (nm === 'Wishkeen' || nm === 'Wishagog') && this.trait('Wishtanglement') && !this._tangle;
    const k0 = t && t.conditions.includes('Wishkeen'), g0 = t && t.conditions.includes('Wishagog'); const res = await o.call(this, t, nm, ...r);
    if (!outerTangle && t && t.alive && this.ab(t, 'Wish Engine')) { if (!g0 && t.conditions.includes('Wishagog')) this.genGain(t, 2, 'Wishagog 획득'); else if (!k0 && t.conditions.includes('Wishkeen')) this.genGain(t, 1, 'Wishkeen 획득'); }
    return res;
  });
  wrap('c4AttackStart', async function (o, t, g, A) {
    await o.call(this, t, g, A);
    if (this.ab(t, 'Wish Engine')) {
      if (await this.genSpend(t, 1, '이번 공격 +1 Precision')) A.c4prec = (A.c4prec || 0) + 1;
      if (await this.genSpend(t, 2, '이번 공격 Auto-break 1')) { this.kratosPool.break += 1; this.say('Wish Engine: Auto-break 1 — Kratos Pool에 Break 토큰'); }
    }
  });
  wrap('evasionRoll', async function (o, t, dice, diff, card, judge = null) {
    let hits = await o.call(this, t, dice, diff, card, judge);
    if (hits > 0 && !judge && t && t.alive && this.ab(t, 'Wish Engine') && await this.genSpend(t, 3, `Block 1 (hit ${hits} → ${hits - 1})`)) { hits -= 1; this.say(`Block 1 → hit ${hits}`); }
    return hits;
  });
  wrap('dealFD', async function (o, t, f, d, card, hits = 1, dFn = null, opts = {}) {
    if (t && d > 0 && hits > 0 && d > hits) { const k = this.wishShieldKind(t, card, !!opts.laser); if (k && this.wishShieldOn(t, k)) { const nd = Math.max(hits, d - hits); this.say(`${t.name}: ${this.wishShieldSrc(t, k)} — ${k} Attack hit당 Danger −1 (${d} → ${nd})`, 'good'); d = nd; } }
    return o.call(this, t, f, d, card, hits, dFn, opts);
  });
  if (P.babelDeal) wrap('babelDeal', function (o, t, card, per, hits) { per = this.c5WishShieldPer(t, card, per); return o.call(this, t, card, per, hits); });
  if (P.dhDeal) wrap('dhDeal', async function (o, t, card, base, hits, perHit, opts = {}) {
    if (this.wishShieldKind(t, card) && this.wishShieldOn(t, this.wishShieldKind(t, card))) { const nb = perHit ? Math.max(1, base - 1) : Math.max(hits, base - hits); if (nb < base) { this.say(`${t.name}: Wish Shield — hit당 Danger −1 (${perHit ? `hit당 ${base} → ${nb}` : `${base} → ${nb}`})`, 'good'); base = nb; } }
    return o.call(this, t, card, base, hits, perHit, opts);
  });
  wrap('secondWindow', async function (o, t, A, kt, ...r) {
    const res = await o.call(this, t, A, kt, ...r);
    if (t && t.alive && kt && kt.closing) { this.kratosPool.closing = (this.kratosPool.closing || 0) + kt.closing; this.say(`Kratos: 2nd window — Kratos Pool ← Closing ${kt.closing}`); }
    if (t && t.alive && kt) await this.c5KratosWindow(t, A, kt, 2);
    return res;
  });

  // ---------- Shadowdancer ----------
  wrap('obolDraw', async function (o, t, v = 10, extra = 0) {
    if (!t || !t.alive || t.pendingObol || !this.ab(t, 'Dance of Fate') || this.fr(t) < 2) return o.call(this, t, v, extra);
    if (!(await yn(this, t, 'Dance of Fate: Fate +2로 이번 드로우에만 Obol 덱에 「You Live!」 1장 추가?'))) return o.call(this, t, v, extra);
    await this.gainFate(t, 2); if (!t.alive) return;
    const D = this.data.decks.obol; const live = this.obolBase.find(x => x.result === 'live') || D.find(x => x.code === 'AM0353');
    const base = this.obolBase; this.obolBase = [...base, live]; this.say(`${t.name}: Dance of Fate — 이번 Obol 드로우에 「${live.name}」 1장 추가`, 'good');
    try { return await o.call(this, t, v, extra); } finally { this.obolBase = base; }
  });

  // ---------- Cloudsoarer ----------
  wrap('skyLifeline', async function (o, t, what) {
    const r = await o.call(this, t, what); if (r) return r;
    if (!t || !t.alive || this.ab(t, 'Lifeline') || !this.ab(t, 'Fall and Soar') || !/Knockdown to Lifeline/.test(t.def.abilities['Fall and Soar']) || this.fr(t) <= 0) return false;
    if (!(await yn(this, t, `Lifeline (Fall and Soar): ${what} — Fate+1, Knockdown을 받고 살아남기?`))) return false;
    await this.gainFate(t, 1); this.say(`${t.name}: Lifeline! (Fall and Soar — Knockdown)`, 'good'); await this.knockdown(t, true); return true;
  });
  wrap('gainMidas', async function (o, t, ...a) { const b = t && t.gear ? this.midas(t) : 0; const r = await o.call(this, t, ...a); if (t && t.alive && this.ab(t, 'Carry the Weight') && this.midas(t) > b) this.genGain(t, 1, 'Midas 토큰 획득'); return r; });
  wrap('hermesMove0', async function (o, t, x, ...r) { if (t && this.ab(t, 'Carry the Weight') && await this.genSpend(t, 1, `Hermes Move ${x} → ${x + 1}`)) x += 1; return o.call(this, t, x, ...r); });
  wrap('c4IgnoreAirFloat', async function (o, t, what) { if (what === 'Float' && t && this.ab(t, 'Carry the Weight') && await this.genSpend(t, 2, 'Float 무시')) return true; return o.call(this, t, what); });
  wrap('c4TurnStart', async function (o, t, ...a) {
    const r = await o.call(this, t, ...a);
    if (t && t.alive && this.ab(t, 'Levitate') && !t.offBoard && !t.onVP && !t.stair && !t.impaled && t.pos && this.board.isChasm(t.pos.c, t.pos.r)) {
      if (this.fr(t) > 0) { await this.gainFate(t, 1); this.say(`${t.name}: Chasm 위에서 턴 시작 — Levitate 사용 (Fate +1)`, 'good'); }
      else { this.say(`${t.name}: Chasm 위에서 턴 시작 — Levitate를 쓸 수 없어 사망`, 'bad'); await this.kill(t); }
    }
    return r;
  });
  wrap('usableWeapons', function (o, t, ...a) { const l = o.call(this, t, ...a); return l.some(g => this.c5WeaponBanned(t, g)) ? l.filter(g => !this.c5WeaponBanned(t, g)) : l; });

  // ---------- free actions: Grey Alchemy, token spends ----------
  wrap('freeActions', function (o, t) {
    const out = o.call(this, t);
    if (this.ab(t, 'Grey Alchemy') && this.fr(t) > 0 && (this.midas(t) > 0 || (t.pain || 0) > 0)) out.push({ label: `Grey Alchemy: Midas 또는 Pain 토큰 1개 → Ambrosia 1 (Fate+1) [Midas ${this.midas(t)}, Pain ${t.pain || 0}]`, value: async () => {
      const opts = [...(this.midas(t) > 0 ? [{ label: `Midas 토큰 (${this.midas(t)})`, value: 'm' }] : []), ...((t.pain || 0) > 0 ? [{ label: `Pain 토큰 (${t.pain})`, value: 'p' }] : [])];
      const v = opts.length === 1 ? opts[0].value : await this.ask({ type: 'choice', titan: t, title: 'Grey Alchemy: 바꿀 토큰', options: opts }); if (!v) return;
      await this.gainFate(t, 1); if (!t.alive) return;
      if (v === 'm') { const has = t.gear.filter(g => (g.midas || 0) > 0); const g = has.length === 1 ? has[0] : await this.ask({ type: 'choice', titan: t, title: 'Midas 토큰을 뺄 카드', options: has.map(x => ({ label: `${x.card.name} (${x.midas})`, value: x })) }); g.midas--; this.midasRemoved && this.midasRemoved(t, 1); this.say(`${t.name}: Grey Alchemy — ${g.card.name}의 Midas 토큰 → Ambrosia`); }
      else { t.pain--; this.say(`${t.name}: Grey Alchemy — Pain 토큰 → Ambrosia (Pain ${t.pain})`); }
      await this.ambDirect(t, 1, 'Grey Alchemy');
    } });
    const a = this.genAb(t); const n = t.genTok || 0;
    if (a && n > 0) {
      const add = (k, label, cond, fn) => { if (n >= k && cond) out.push({ label: `${a} (토큰 ${k}/${n}): ${label}`, noFate: true, value: async () => { t.genTok -= k; this.say(`${t.name}: ${a} — 토큰 ${k}개 버림 → ${label} (남은 ${t.genTok})`, 'good'); await fn(); this.notify(); } }); };
      const myTurn = this._actor === t;
      if (a === 'Carry the Weight') { const cs = t.conditions.filter(c => !this.curses(t).includes(c) && !['Time-clocked', 'Omega Terminus'].includes(c)); add(3, 'Condition 카드 1장 버림', cs.length > 0, async () => { const c = cs.length === 1 ? cs[0] : await this.ask({ type: 'choice', titan: t, title: '버릴 Condition', options: cs.map(x => ({ label: x, value: x })) }); if (!c) return; if (c === 'Float' && this.deflate) { this.deflate(t, 'Carry the Weight'); return; } t.conditions = t.conditions.filter(x => x !== c); if (c === 'Bleeding') t.bleeding = 0; if (c === 'Death') t.deathTokens = 0; this.say(`${t.name}: Condition 「${c}」 버림`, 'good'); }); }
      add(5, '이동 액션 1회 추가', myTurn && t.turn.moved, async () => { t.turn.moved = false; });
      if (a === 'Wish Engine') add(6, '전투 액션 1회 추가', myTurn && t.turn.attacked, async () => { t.turn.attacked = false; });
      if (a === 'Carry the Weight') { const cu = this.curses(t); add(6, 'Curse Affliction 1개 제거', cu.length > 0, async () => { const c = cu.length === 1 ? cu[0] : await this.ask({ type: 'choice', titan: t, title: '제거할 Curse Affliction', options: cu.map(x => ({ label: x, value: x })) }); if (c) { t.conditions = t.conditions.filter(x => x !== c); this.say(`${t.name}: ${c} Curse 제거`, 'good'); } }); }
      add(7, '각성 (Awaken)', !!this.awk && !this.wentBeyond(t) && (!!t.godform || this.godformChoices().length > 0), async () => { const ok = await this.awaken(t); if (ok === false) { t.genTok += 7; this.say(`${t.name}: 각성할 수 없어 토큰 7개 반환`); } });
    }
    return out;
  });
}
