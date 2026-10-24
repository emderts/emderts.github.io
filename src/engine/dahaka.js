// Cycle IV — Dahaka (combined AI/BP deck, Interrupt Attacks, Drift, Shadowstep, Dissipate, Soulrend, status cards)
import { Board, Deck, key, cellLabel, DIRS, DIR_LIST } from './core.js';

// Single combined AI/BP deck. Cards that left the deck for the Wound Stack (or were placed elsewhere)
// carry _dhAway so the AI flow's "discard after resolving" doesn't duplicate them.
class DhDeck extends Deck {
  get discard() { return this._d; }
  set discard(a) { const arr = a; const push = Array.prototype.push; Object.defineProperty(arr, 'push', { value: (...xs) => push.apply(arr, xs.filter(c => !(c && c._dhAway))), configurable: true, writable: true }); this._d = arr; }
  draw() { if (!this.cards.length) { if (!this._d.length) return null; this.cards = [...this._d]; this.discard = []; this.shuffle(); } const c = this.cards.shift(); if (c) { c._dhAway = false; c._dhUsed = false; c._removed = false; } return c; }
  putBottom(c) { if (c) c._dhAway = false; this.cards.push(c); }
  putTop(c) { if (c) c._dhAway = false; this.cards.unshift(c); }
  shuffleIn(c) { if (c) c._dhAway = false; this.cards.push(c); this.shuffle(); }
}

export function installDahaka(Game, { TitanDied, BattleOver, ChainBreak }) {
  const origKill = Game.prototype.kill;
  Game.prototype.kill = async function (t, opts = {}) { const was = t && t.alive; try { await origKill.call(this, t, opts); } finally { if (was && !t.alive && this.prim && this.prim.def.dahakaD) await this.dhOnDeath(t); } };
  const origAmbLimit = Game.prototype.ambLimit;
  Game.prototype.ambLimit = function (t) { const v = origAmbLimit.call(this, t); return t && t._ambLimit6 ? Math.max(v, 6) : v; };
  const origMn = Game.prototype.mn;
  Game.prototype.mn = function (t, ...a) { if (t && t.dhOar === 'winnowed') return null; return origMn.call(this, t, ...a); };
  const origUW = Game.prototype.usableWeapons;
  Game.prototype.usableWeapons = function (t, ...a) { if (this.prim && this.prim.trojan && this.prim.trojan.side === 'TI' && this.prim.trojan.holder === t) return []; return origUW.call(this, t, ...a); };
  const origPrec = Game.prototype.precisionMods;
  Game.prototype.precisionMods = function (t) { return origPrec.call(this, t) + (this.prim && this.prim.def.dahakaD ? this.dhPrec(t) : 0); };

  Object.assign(Game.prototype, {
    dahakaSetup() {
      const P = this.prim.def;
      const cards = P.ai.filter(a => a.dahaka).map(c => ({ ...c, responses: { ...c.responses } }));
      this.ai = new DhDeck(cards.filter(c => c.tier === 1), this.rng).shuffle(); this.bp = this.ai;
      this.aiEsc = { 2: [], 3: [] }; this.bpEsc = { 2: this.rng.shuffle(cards.filter(c => c.tier === 2)), 3: this.rng.shuffle(cards.filter(c => c.tier === 3)) };
      this.say(`Dahaka AI/BP 통합 덱: BP I 카드 ${this.ai.size()}장 (AI·BP가 한 장에 — Escalation은 BP 레벨 기준)`, 'sys');
      this.prim.comboIdx = 0; this.prim.status = null; this.prim.trojan = null;
      const live = this.titans.filter(t => t.alive);
      if (this.trait('Winnowing')) {
        if (live.length) { const v = this.rng.pick(live); this.prim.trojan = { holder: v, side: 'TI' }; this.say(`Winnowing: Fearful Hospitality 대신 ${v.name}이(가) Trojan Ire를 받음 — 공격 불가, 다른 타겟이 없을 때만 타겟이 됨`, 'sys'); }
      } else if (live.length) { const v = this.rng.pick(live); this.prim.status = { holder: v, side: 'FH' }; this.say(`Fearful Hospitality: ${v.name}이(가) 받음 — Precise 키워드`, 'sys'); }
      if (this.trait('The Dragon Does Not Sleep')) this.say('The Dragon Does Not Sleep: Combo 토큰을 Cleaver 칸에', 'sys');
      if (this.trait('Shackles of Regret')) this.say('Shackles of Regret: Dahaka 공격 회피 주사위 −1, hit당 Danger −1 (최소 1) · End of Hope 비활성', 'sys');
    },
    dhShackles() { return this.trait('Shackles of Regret') && !this.liveTitans().some(x => x.gear.some(g => !g.discarded && g.card.name === 'Dahaka Mask')); },
    dhDisableShackles() { if (!this.prim.traits['Shackles of Regret'] || this.prim.disabled['Shackles of Regret']) { this.say('(Shackles of Regret 이미 비활성)'); return; } this.prim.disabled['Shackles of Regret'] = true; this.say('Shackles of Regret 비활성 — 이제 End of Hope가 작동', 'bad'); },
    dhComboName() { const C = this.prim.def.comboTrack || []; return C.length ? C[this.prim.comboIdx % C.length][0] : ''; },
    // ---------- precision / attack text ----------
    dhArgoSupport(t) { if (!t || t.onVP || t.offBoard || t.stair || this.prim.argoSupportOff) return false; for (const z of this.board.terrain.values()) if (z.type === 'Argo Hull' && Board.dist(z.cell, t.pos) <= 3) return true; return false; },
    dhPrec(t) { return this.dhArgoSupport(t) ? 1 : 0; },
    dhAtkText(t, g, txt) {
      if (this.prim.status && this.prim.status.holder === t && this.prim.status.side === 'FH' && !/Precise/.test(txt)) { txt += ' Precise.'; this.say(`${t.name}: Fearful Hospitality — Precise`); }
      if (t.dhOar === 'oar' && !/Precise/.test(txt)) { txt += ' Precise.'; this.say(`${t.name}: The Oar — Precise`); }
      if (this.dhArgoSupport(t)) { txt += ' Power Re-roll 1. Auto-break 1.'; this.say(`${t.name}: Argo Support (Hull 3칸 이내) — Precision +1, Power Re-roll 1, Auto-break 1`); }
      return txt;
    },
    // which card is the BP for this attack (Interrupt: the interrupted AI card; Bonus Attack: Interrupt rules on a drawn card)
    dhInterruptCard(t, A, mods) {
      if (!this.trait('Semicorporeal Wraith')) return false;
      let card = null;
      if (mods.dhInterrupt && this._dhInt) card = this._dhInt;
      else if (mods.interrupt && this.currentAI && this.currentAI.card && this.currentAI.card.dahaka && !this.currentAI.card._dhUsed && !this._dhInt) { card = this.currentAI.card; card._dhUsed = true; this.currentAI.dhChain = t; this.say('Strikeback = Interrupt Attack — 진행 중인 AI 카드의 BP 부분을 공격 (Chain Break)', 'good'); }
      if (mods.bonus || card) A.dhInterrupt = true;
      if (A.dhInterrupt && !card) this.say('Bonus Attack = Interrupt Attack (Interrupt AT·응답 사용)');
      if (!card) return false;
      A.dhCard = card; this.say(`Interrupt Attack: 새 카드를 뽑지 않고 「${card.name}」의 BP 부분 「${card.bpName}」을 공격`, 'good');
      return true;
    },
    dhAT(A) { if (!A.bp || A.bp.atLo == null) return 0; if (A.t && A.t.gear.some(g => !g.discarded && g.card.name === 'Dahaka Mask')) { this.say('Dahaka Mask: 낮은 AT 사용'); return A.bp.atLo - A.bp.at; } if (this.trait('Incorporeal Wraith')) return 0; return A.dhInterrupt ? A.bp.atLo - A.bp.at : 0; },
    dhResp(A) { const r = A.bp.responses || {}; if (A.bp.atLo == null) return r; return A.dhInterrupt ? { WOUND: r['INTERRUPT WOUND'], FAIL: r['INTERRUPT FAIL'], INSTINCT: r['INTERRUPT INSTINCT'] } : { WOUND: r.WOUND, FAIL: r.FAIL, INSTINCT: r.INSTINCT }; },
    // ---------- resolution ----------
    async dahakaAI(card, opts = {}) {
      this._dhTarget = null; this._dhTargetPos = null;
      if (card.dhRoutine) { await this.moveToCenter(true); this.say('(Hull −1, 보급 −1 — 캠페인 효과, 무시)', 'sys'); const v = this.rng.pick(this.liveTitans()); if (v) { this.say(`Right All Wrongs: 무작위 타이탄 ${v.name} 사망`, 'bad'); await this.kill(v); } return; }
      if (card.kind === 'CURSE') return this.dhCurse(card);
      await this.safe(() => this.dahakaBody(card, opts));
      if (!card.dahaka) return; // Signature: no special window
      const interrupted = await this.dhWindow(card, this._dhTarget);
      if (!interrupted && card.noInterrupt === 'next') { this.say(`「${card.name}」: Interrupt Attack 없음 — 다음 AI 카드 수행`, 'ai'); await this.dhNextAI(); }
    },
    async dhCurse(card) {
      this.say(`DROWN: ${this.prim.name} Heal 1`, 'ai'); this.dhHeal(1);
      const interrupted = await this.dhWindow(card, null);
      if (interrupted) return;
      this.say(`After Curse: Interrupt Attack 없음 — 「${card.name}」과(와) 버림 더미를 덱에 섞고 AI 카드 한 장 더`, 'ai');
      card._removed = true; this.ai.cards.push(card); card._dhAway = false; this.ai.shuffleDiscardIn();
      await this.dhNextAI();
    },
    async dhNextAI() { const c = this.drawAI(); if (!c) return; const pi = this._dhInt; this._dhInt = null; try { await this.safe(() => this.resolveAI(c)); } finally { this._dhInt = pi; } if (!c._removed) this.ai.discard.push(c); },
    dhHullDamage(why) { if (this.prim.hullRolled || this.prim.argoSupportOff) return; const r = this.rng.d10(); this.say(`Hull Damage (${why}): d10=${r}${r >= 6 ? ' — 장갑이 버팀' : ' — Hull −1 (캠페인), Argo Support 비활성 (전투당 1회)'}`, r >= 6 ? 'good' : 'bad'); if (r < 6) { this.prim.argoSupportOff = true; this.prim.hullRolled = true; } },
    async dahakaBody(card, { isSignature = false, forcedTarget = null } = {}) {
      const s0 = card.steps[0] || ''; const atk = { ...card, steps: [s0.replace(/^⚡\s*/, '').replace(/^DRIFT & ATTACK( ALL ADJACENT TITANS)?/, 'ATTACK'), ...card.steps.slice(1)] };
      const zone = /ZONE/.test(card.kind) && !card.pattern;
      if (zone) {
        const z = +(/Zone (\d+)/.exec(card.target[0])[1]); const targets = this.liveTitans().filter(t => !t.onVP && !t.stair && !t.offBoard && this.zoneDist(t.pos) <= z);
        this.zoneShow = this.patternCells({ zone: z }); this.notify();
        this.say(`Zone ${z} 공격: ${targets.map(t => t.name).join(', ') || '(대상 없음)'}`); this._dhTarget = targets[0] || null;
        if (!targets.length) { if (card.afterFinal) await this.afterAttack({ ...card, after: card.afterFinal }, null, []); return; }
        return this.attackGroup(card, targets);
      }
      const primary = forcedTarget || await this.unearthly(card, this.pickTarget(card.target, true));
      if (!primary) { this.say('유효한 타겟 없음 → Routine', 'ai'); if (this.currentAI) this.currentAI.noAtk = true; return this.dahakaAI(this.routine); }
      this._dhTarget = primary; this._dhTargetPos = { ...primary.pos };
      if (this.isJudge(card)) return this.attackSingle(card, primary);
      this.say(`타겟: ${primary.name}`);
      if (card.drift) { if (s0.startsWith('⚡')) await this.reactionWindow(primary, card, 'Drift'); if (!primary.alive) throw new TitanDied(primary); await this.dhDrift(primary); if (!primary.alive) throw new TitanDied(primary); this._dhTargetPos = { ...primary.pos }; }
      if (card.pattern) { const cells = this.patternCells(card); this.zoneShow = cells; this.notify(); const set = new Set(cells.map(p => key(p.c, p.r))); const targets = this.liveTitans().filter(t => !t.onVP && !t.stair && !t.offBoard && set.has(key(t.pos.c, t.pos.r))); this.say(`Zone 공격 범위: ${targets.map(t => t.name).join(', ') || '(대상 없음)'}`); if (!targets.length) { if (card.afterFinal) await this.afterAttack({ ...card, after: card.afterFinal }, primary, []); return; } return this.attackGroup(atk, targets, true); }
      if (card.driftAll) { const targets = this.liveTitans().filter(t => this.isAdj(t) && !t.stair); this.say(`인접한 모든 타이탄 공격: ${targets.map(t => t.name).join(', ') || '(없음)'}`); if (!targets.length) { if (card.afterFinal) await this.afterAttack({ ...card, after: card.afterFinal }, primary, []); return; } return this.attackGroup(atk, targets, true); }
      return this.attackSingle(atk, primary);
    },
    // ---------- special Window of Opportunity ----------
    async dhWindow(card, target) {
      if (!this.trait('Semicorporeal Wraith') || card._dhUsed || this._dhInt) return false;
      const live = this.liveTitans(); if (!live.length) return false;
      this.say(`◆! Interrupt Window — 「${card.name}」`, 'sys');
      const tt = target && target.alive ? target : live[0];
      try { await this.safe(() => this.reactionWindow(tt, card, 'Interrupt Window')); } catch (e) { if (e instanceof BattleOver) throw e; }
      if (card._dhUsed) return true;
      if (this.trait('The Dragon Does Not Sleep')) { const broken = await this.dhComboBreak(card); if (!broken) return false; }
      const cands = this.liveTitans().filter(x => !x.onVP && !x.offBoard && !x.stair && !x.knockdown && x.fatigue !== 'combat' && this.isAdj(x) && this.usableWeapons(x).length);
      if (!cands.length) { this.say('(Interrupt Attack 가능한 인접 타이탄 없음)'); return false; }
      const pick = await this.ask({ type: 'choice', title: `◆! Interrupt Window: Dahaka에 인접한 타이탄이 「${card.name}」에 Interrupt Attack? (BP 「${card.bpName}」 AT ${(this.trait('Incorporeal Wraith') ? card.at : card.atLo) + (this.prim.bonus.AT || 0)}, Interrupt 응답 · 공격 후 Fatigue 토큰)`, options: [{ label: '안 함', value: null }, ...cands.map(x => ({ label: x.name, value: x }))] });
      if (!pick) return false;
      card._dhUsed = true; this._dhInt = card; this.say(`${pick.name}: Interrupt Attack!`, 'good');
      try { await this.chainSafe(() => this.titanAttack(pick, { interrupt: true, dhInterrupt: true })); }
      catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied)) throw e; }
      finally { this._dhInt = null; }
      if (pick.alive && !pick.fatigue) { pick.fatigue = 'combat'; this.say(`${pick.name}: Interrupt Attack — Combat Fatigue 토큰 (가지고 있는 동안 Interrupt Attack 불가)`); }
      return true;
    },
    async dhComboBreak(card) {
      const C = this.prim.def.comboTrack; const [nm, classes] = C[this.prim.comboIdx % C.length];
      const cands = []; for (const x of this.liveTitans()) { if (x.pt || x.onVP || x.offBoard || x.stair) continue; for (const g of x.gear) { if (g.discarded || g.exhausted || g.card.atk == null) continue; const tr = g.card.traits || []; if (!tr.some(k => classes.some(cl => k === cl || k === cl.replace(/s$/, '')))) continue; if (!this.inWeaponRange(x, g)) continue; cands.push({ x, g }); } }
      let broken = false;
      this.say(`Combo (${nm}: ${classes.join(', ')}) — Combo Break 없이는 Interrupt Attack 불가`, 'ai');
      if (cands.length) { const v = await this.ask({ type: 'choice', title: `Combo Break (${nm}): PT가 아닌 타이탄이 ${classes.join('/')} 무기를 소진해 Combo를 깨기? (PT 토큰 획득)`, options: [{ label: '안 함', value: null }, ...cands.map(o => ({ label: `${o.x.name}: ${o.g.card.name}`, value: o }))] }); if (v) { v.g.exhausted = true; if (!this.ptHolder()?.ptLocked) { for (const y of this.titans) y.pt = false; v.x.pt = true; } this.say(`${v.x.name}: Combo Break! (${v.g.card.name} 소진, PT 획득)`, 'good'); broken = true; } }
      this.prim.comboIdx++; this.say(`Combo 토큰 → ${this.dhComboName()}`);
      return broken;
    },
    // ---------- movement ----------
    dhAnchorOK(an, ignore = []) { const cs = this.primCells(an); return cs.every(p => this.board.inBounds(p.c, p.r)) && !cs.some(p => { const o = this.titanAt(p.c, p.r); if (o && !ignore.includes(o)) return true; const z = this.board.terrainAt(p.c, p.r); return z && z.obstacle && (z.indestructible || z.blocksPrim); }); },
    async dhTeleport(na) { await this.primStep(na, this.liveTitans(), false, false, { noCrash: true }); },
    async dhDrift(t) {
      if (!t || !t.alive || t.onVP || t.offBoard || t.stair) return;
      if (this.prim.driftMove) { this.say('Drift → Move Unlimited (Roiling Shadowmass)', 'ai'); this.facePrim(t.pos); const path = await this.choosePrimPath(t.pos, 99, [t], null); for (const st of path) await this.primStep(st, [t]); await this.primEndMove([]); if (t.alive) this.facePrim(t.pos); return; }
      const n = this.prim.size || 2; const T = t.pos; const C = this.primCenter(); const a0 = { ...this.prim.anchor };
      let vx = T.c - C.x, vy = T.r - C.y; if (!vx && !vy) vy = 1; const m = Math.max(Math.abs(vx), Math.abs(vy)); const k = (n / 2 + 0.5) / m;
      const cx = T.c + vx * k, cy = T.r + vy * k; const ideal = { c: Math.round(cx - (n - 1) / 2), r: Math.round(cy - (n - 1) / 2) };
      const ring = []; for (let dc = -n; dc <= 1; dc++) for (let dr = -n; dr <= 1; dr++) { const an = { c: T.c + dc, r: T.r + dr }; const cs = this.primCells(an); if (cs.some(p => p.c === T.c && p.r === T.r)) continue; if (Board.isAdjacent(T, cs)) ring.push(an); }
      const ctr = an => ({ x: an.c + (n - 1) / 2, y: an.r + (n - 1) / 2 });
      const far = ring.filter(an => { const c = ctr(an); return (c.x - T.c) * vx + (c.y - T.r) * vy > 0; }).sort((p, q) => Math.hypot(ctr(p).x - cx, ctr(p).y - cy) - Math.hypot(ctr(q).x - cx, ctr(q).y - cy));
      const cand = [ideal, ...far].filter((an, i, arr) => arr.findIndex(b => b.c === an.c && b.r === an.r) === i && ring.some(b => b.c === an.c && b.r === an.r));
      const dest = cand.find(an => this.dhAnchorOK(an));
      // titans the Dahaka passes through
      const passed = new Set(); const to = dest || ideal; for (let i = 1; i <= 24; i++) { const f = i / 24; const an = { c: Math.round(a0.c + (to.c - a0.c) * f), r: Math.round(a0.r + (to.r - a0.r) * f) }; for (const p of this.primCells(an)) { const o = this.titanAt(p.c, p.r); if (o && o.alive) passed.add(o); } }
      passed.add(t);
      if (!dest) {
        const near = ring.filter(an => this.dhAnchorOK(an)).sort((p, q) => Board.dist(p, a0) - Board.dist(q, a0))[0];
        if (near && !this.isAdj(t)) await this.dhTeleport(near);
        await this.primEndMove([]); this.facePrim(T);
        this.say(`Drift: ${t.name}의 반대편으로 건너갈 수 없음 — 인접한 곳에 멈추고 ${t.name} 사망`, 'bad'); await this.kill(t); return;
      }
      for (const o of passed) { if (!o.alive) continue; if (o.gear.some(g => !g.discarded && /Ignore Drift Precision Penalty/.test(this.gearText(g, o)))) { this.say(`${o.name}: Drift Precision 페널티 무시`, 'good'); continue; } o.tokens.precision -= 1; this.say(`Drift: ${this.prim.name}이(가) ${o.name}을(를) 통과 — −Precision 토큰`, 'bad'); }
      await this.dhTeleport(dest); await this.primEndMove([]); this.facePrim(T);
      this.say(`Drift: ${this.prim.name} → ${cellLabel(dest)} 기준 (${t.name} 반대편), ${this.prim.facing} 방향`, 'ai'); this.notify();
    },
    async dhShadowstep(t, ...a) { try { return await this.dhShadowstep0(t, ...a); } finally { await this.stillsuitFollow(); } },
    async dhShadowstep0(t, X) {
      const n = this.prim.size || 2; const from = t && t.alive && !t.onVP && !t.stair ? t.pos : this._dhTargetPos;
      const OPPD = { N: 'S', S: 'N', E: 'W', W: 'E' }; const dir = from ? OPPD[this.awayDir(from, this.primCells())] : OPPD[this.prim.facing];
      const [dx, dy] = DIRS[dir]; let wrapped = false; const cols = this.board.cols, rows = this.board.rows;
      const step = () => { const a = this.prim.anchor; let na = { c: a.c + dx, r: a.r + dy }; let w = false; if (na.c < 1) { na.c = cols - n + 1; w = true; } if (na.c + n - 1 > cols) { na.c = 1; w = true; } if (na.r < 1) { na.r = rows - n + 1; w = true; } if (na.r + n - 1 > rows) { na.r = 1; w = true; } return { na, w }; };
      for (let i = 0; i < X; i++) { const { na, w } = step(); if (w) wrapped = true; await this.dhTeleport(na); }
      let guard = 0; while (!this.dhAnchorOK(this.prim.anchor, this.liveTitans()) && guard++ < 25) { const { na, w } = step(); if (w) wrapped = true; await this.dhTeleport(na); }
      await this.primEndMove([]);
      this.say(`Shadowstep ${X}: ${this.prim.name} → ${cellLabel(this.prim.anchor)} 기준 (${dir} 방향으로, 회전 없음)${wrapped ? ' — 보드 가장자리를 넘어 반대편에서 나타남' : ''}`, 'ai'); this.notify();
      if (wrapped && this.trait('Shadow Backstep')) { this.say('Shadow Backstep: Heal 1', 'bad'); this.dhHeal(1); }
    },
    dhClouds() { const seen = new Map(); for (const z of this.board.terrain.values()) if (z.type === 'Ambrosia Cloud') { if (!seen.has(z.id)) seen.set(z.id, { id: z.id, cells: [] }); seen.get(z.id).cells.push(z.cell); } return [...seen.values()]; },
    async dhDissipate(...a) { try { return await this.dhDissipate0(...a); } finally { await this.stillsuitFollow(); } },
    async dhDissipate0() {
      const n = this.prim.size || 2; const here = new Set(this.primCells().map(p => { const z = this.board.terrainAt(p.c, p.r); return z && z.type === 'Ambrosia Cloud' ? z.id : null; }).filter(Boolean));
      const C = this.primCenter(); const opts = [];
      for (const z of this.dhClouds()) { if (here.has(z.id)) continue; const set = new Set(z.cells.map(p => key(p.c, p.r))); for (const p of z.cells) { const an = { c: p.c, r: p.r }; if (!this.primCells(an).every(q => set.has(key(q.c, q.r)))) continue; const c2 = this.primCenter(an); opts.push({ an, d: Math.max(Math.abs(c2.x - C.x), Math.abs(c2.y - C.y)) + Math.hypot(c2.x - C.x, c2.y - C.y) / 100 }); } }
      if (!opts.length) { this.say('Dissipate: 이동할 Ambrosia Cloud 없음'); return; }
      opts.sort((a, b) => a.d - b.d); const dest = opts[0].an;
      await this.dhTeleport(dest); await this.primEndMove([]); this.faceMost();
      this.say(`Dissipate: ${this.prim.name} → Ambrosia Cloud (${cellLabel(dest)} 기준), 가장 많은 타이탄 쪽(${this.prim.facing})으로 회전`, 'ai'); this.notify();
    },
    dhHeal(n) { for (let i = 0; i < n; i++) { const w = this.woundStack.filter(x => !x.secondary).pop(); if (!w) { this.say('(Heal: Wound 없음)'); return; } this.woundStack.splice(this.woundStack.lastIndexOf(w), 1); if (w.card) { w.card._dhAway = false; this.ai.shuffleIn(w.card); } this.say(`${this.prim.name}: Heal 1 — Wound Stack에서 ${w.card ? `「${w.card.bpName || w.card.name}」을(를) 덱에 섞음` : (w.name || 'Wound')} 제거 (${this.woundCount()}/${this.prim.wounds})`, 'bad'); } this.notify(); },
    // ---------- Mnemos ----------
    async dhSoulrend(t) {
      if (!t || !t.alive) return; if (!this.trait('Soulrend')) { this.say('(Soulrend 비활성)'); return; }
      const ms = (t.mnemos || []).filter(m => !m.discarded && this.dhNodes(m) > 0);
      if (!ms.length) { this.say(`Soulrend: ${t.name} — 잃을 Mnemos node 없음`); return; }
      for (const m of ms) this.dhNode(m, -1); this.say(`Soulrend: ${t.name}의 모든 Mnemos node −1 (${ms.map(m => `${m.card.name} ${m.nodes}node/L${m.level}`).join(', ')})`, 'bad');
    },
    dhNodes(m) { if (m.nodes == null) m.nodes = ({ 1: 3, 2: 7, 3: 12 })[m.level] || 0; return m.nodes; },
    dhNode(m, d) { const n0 = this.dhNodes(m); m.nodes = Math.max(0, Math.min(12, n0 + d)); const L0 = m.level; m.level = m.nodes >= 8 ? 3 : m.nodes >= 4 ? 2 : m.nodes >= 1 ? 1 : 0; if (m.level !== L0) this.say(`Mnemos 「${m.card.name}」: node ${m.nodes} → 레벨 ${L0} → ${m.level}${m.level === 0 ? ' (능력 사용 불가)' : ''}`, d < 0 ? 'bad' : 'good'); },
    async dhLoseNode(t, allowFated = false) {
      const ms = (t.mnemos || []).filter(m => !m.discarded && this.dhNodes(m) > 0); const fs = allowFated ? (t.fated || []) : [];
      if (!ms.length && !fs.length) { this.say(`${t.name}: 잃을 Mnemos node 없음`); return; }
      const v = await this.ask({ type: 'choice', titan: t, title: `${t.name}: 잃을 Mnemos node`, options: [...ms.map(m => ({ label: `${m.card.name} (node ${m.nodes}, L${m.level})`, value: { m } })), ...fs.map(f => ({ label: `Fated Mnemos 「${f}」 제거`, value: { f } }))] });
      const pick = v || (ms.length ? { m: ms[0] } : { f: fs[0] });
      if (pick.m) { this.dhNode(pick.m, -1); this.say(`${t.name}: Mnemos 「${pick.m.card.name}」 node −1 → ${pick.m.nodes}node / L${pick.m.level}`, 'bad'); }
      else { t.fated = t.fated.filter(x => x !== pick.f); this.say(`${t.name}: Fated Mnemos 「${pick.f}」 node 상실`, 'bad'); }
    },
    // ---------- attack header / effects ----------
    async dahakaHeader(t, card, dice, diff) {
      const s0 = card.steps[0] || '';
      for (const seg of s0.split(' | ').slice(1)) { const m = /^FATE (\d)\+: Soulrend$/.exec(seg); if (m && this.effFate(t) >= +m[1]) { this.say(`Fate ${m[1]}+ — Soulrend`, 'bad'); await this.dhSoulrend(t); } }
      if (this.dhShackles() && dice > 1) { dice -= 1; this.say('Shackles of Regret: 회피 주사위 −1'); }
      return { dice, diff };
    },
    async dhDeal(t, card, base, hits, perHit, opts = {}) {
      let total = perHit ? base * hits : base; const b = this.prim.bonus.DANGER * (this.prim.bonusPerHit ? hits : 1); total += b + (this.prim.tokens.danger || 0);
      if (opts.add) total += opts.add;
      if (this.dhShackles()) { total -= hits; total = Math.max(1, total); this.say(`Shackles of Regret: hit당 Danger −1 (${hits})`); }
      this.currentAI && (this.currentAI.dangerDealt += total);
      if (opts.dieAt) { const r = await this.gainDanger(t, total, { fromAttack: true, source: card.name, noArmor: this.isJudge(card), dieAt: opts.dieAt }); return r; }
      await this.gainDanger(t, total, { fromAttack: true, source: card.name, noArmor: this.isJudge(card) });
    },
    async dahakaEffect(t, s, hits, card) {
      let m; const F = this.effFate(t);
      if (this.currentAI && this.currentAI.dhChain && (this.currentAI.dhChain === true || this.currentAI.dhChain === t)) throw new ChainBreak('Interrupt Attack');
      if ((m = /^If the Attack hits, it deals (\d+) DANGER, gain (\d) Ambrosia tokens, Pushback (\d)\.$/.exec(s))) { await this.dhDeal(t, card, +m[1], 1, false); if (!t.alive) return true; await this.gainAmbrosia(t, +m[2]); if (t.alive && !t.onVP) { this.say(`${t.name}: Pushback ${m[3]} (타겟이 밀려남)`); await this.knockback(t, +m[3]); } return true; }
      if ((m = /^Each hit deals (\d) DANGER\. Gain (\d) Ambrosia tokens?\.$/.exec(s))) { await this.dhDeal(t, card, +m[1], hits, true); if (t.alive) await this.gainAmbrosia(t, +m[2]); return true; }
      if ((m = /^Each hit deals (\d) DANGER and (\d) Ambrosia tokens?\.$/.exec(s))) { await this.gainAmbrosia(t, +m[2] * hits); if (t.alive) await this.dhDeal(t, card, +m[1], hits, true); return true; }
      if ((m = /^One hit deals (\d) DANGER and (\d) Ambrosia token; two or more hits deal (\d) DANGER and (\d) Ambrosia tokens\.$/.exec(s))) { const two = hits >= 2; await this.gainAmbrosia(t, two ? +m[4] : +m[2]); if (t.alive) await this.dhDeal(t, card, two ? +m[3] : +m[1], hits, false); return true; }
      if ((m = /^For each hit discard 1 Gear card\. Each hit deals (\d) DANGER\.$/.exec(s))) { for (let i = 0; i < hits && t.alive; i++) { const list = t.gear.filter(g => !g.discarded && g.card.name !== 'Fists' && !g.card.isTech); if (!list.length) break; const g = await this.pickGear(t, list); if (g) this.discardGear(t, g); } if (t.alive) await this.dhDeal(t, card, +m[1], hits, true); return true; }
      if (/^If the Attack hits, gain 3 Ambrosia tokens\. Then, gain \+3 DANGER for each Ambrosia token you have\.$/.test(s)) { await this.gainAmbrosia(t, 3); if (!t.alive) return true; const add = 3 * (t.ambrosia || 0); this.say(`${t.name}: Ambrosia ${t.ambrosia}개 × 3 = Danger +${add}`, 'bad'); await this.dhDeal(t, card, 0, 1, false, { add }); return true; }
      if ((m = /^Each hit deals (\d) DANGER\. If you gain 10\+ DANGER, you die without a Trauma Draw\.$/.exec(s))) { await this.dhDeal(t, card, +m[1], hits, true, { dieAt: 10 }); return true; }
      if ((m = /^Each hit deals (\d) DANGER\. \| FATE (\d)\+: (\d) DANGER instead$/.exec(s))) { const per = F >= +m[2] ? +m[3] : +m[1]; if (per !== +m[1]) this.say(`Fate ${m[2]}+ — hit당 ${per} Danger`); await this.dhDeal(t, card, per, hits, true); return true; }
      if (/^Lose -1 RAGE and 1 Mnemos or Fated Mnemos node per hit\.$/.test(s)) { const r0 = t.rage; t.rage = Math.max(0, t.rage - hits); this.say(`${t.name}: Rage −${r0 - t.rage} → ${t.rage}`); this.checkPT && this.checkPT(t); for (let i = 0; i < hits; i++) await this.dhLoseNode(t, true); return true; }
      if (/^Courage\/Will\. One hit, gain the Covetous Condition card; two hits, gain the Greed-crazed Condition card; three hits, you die\.$/.test(s)) { if (hits >= 3) { this.say(`${t.name}: 3 hit — 사망`, 'bad'); await this.kill(t); } else if (hits === 2) await this.midasCondition(t, 'Greed-crazed'); else if (hits === 1) await this.midasCondition(t, 'Covetous'); return true; }
      if (/^Courage\/Will\. One hit, Death 2; two hits, Death 1; three or more hits, you die\.$/.test(s)) { if (hits >= 3) { this.say(`${t.name}: ${hits} hit — 사망`, 'bad'); await this.kill(t); } else if (hits >= 1) await this.addCondition(t, 'Death', { tokens: hits === 2 ? 1 : 2 }); return true; }
      if (/^Soulrend\. One hit, raise DANGER to 9; two or three hits, you die; four or more hits, you die, and the Argonaut dies\.$/.test(s)) { await this.dhSoulrend(t); if (hits >= 2) { this.say(`${t.name}: ${hits} hit — 사망${hits >= 4 ? ' (Argonaut도 사망 — 캠페인)' : ''}`, 'bad'); await this.kill(t); } else if (hits === 1) { const d = 9 - t.danger; if (d > 0) { this.currentAI.dangerDealt += d; t.danger = 9; } this.say(`${t.name}: Danger 9로 상승`, 'dmg'); } return true; }
      if (/^Doomed\. Wisdom\/Courage\/Will\. If the Attack hits, the Titan and the Argonaut die/.test(s)) { if (hits > 0) { this.say(`${t.name}: Ur-Doom Unmake — 타이탄과 Argonaut 사망 (Argo 토큰 +1 — 캠페인)`, 'bad'); await this.kill(t); } return true; }
      if ((m = /^Gain 1 Midas token for each hit and Ambrosia token you have\. Each hit deals (\d) DANGER\.$/.exec(s))) { const n = hits + (t.ambrosia || 0); this.say(`${t.name}: Midas ${n} (hit ${hits} + Ambrosia ${t.ambrosia || 0})`, 'bad'); await this.gainMidas(t, n); if (t.alive) await this.dhDeal(t, card, +m[1], hits, true); return true; }
      if ((m = /^FATE (\d)\+: (.*)$/.exec(s))) { if (F < +m[1]) return true; this.say(`Fate ${m[1]}+ 적용: ${m[2]}`); await this.doEffects(t, m[2], { card, hits }); return true; }
      return false;
    },
    async dahakaSentence(t, p, ctx = {}) {
      const alive = !!(t && t.alive); let m;
      if ((m = /^Shadowstep (\d+)$/.exec(p))) { await this.dhShadowstep(t, +m[1]); return true; }
      if (/^Dissipate$/.test(p)) { await this.dhDissipate(); return true; }
      if (/^The Dahaka moves to the center of the Board,? (?:then |and )?turns to face the most Titans$/.test(p)) { await this.moveToCenter(true); return true; }
      if (/^Soulrend$/.test(p)) { if (alive) await this.dhSoulrend(t); return true; }
      if (/^Perform next AI$/.test(p)) { this.say('Response: 다음 AI 카드 수행', 'ai'); await this.dhNextAI(); return true; }
      if ((m = /^Gain the (Covetous|Greed-crazed|Wishkeen|Wishagog) Condition card$/.exec(p))) { if (alive) await this.midasCondition(t, m[1]); return true; }
      if (/^Place this card on top of the AI deck$/.test(p)) { this._dhTopReq = true; return true; }
      if (/^Reverse Unholy Alchemy$/.test(p)) { if (alive) { const n = t.ambrosia || 0; t.ambrosia = 0; this.say(`${t.name}: Reverse Unholy Alchemy — Ambrosia ${n} → Midas`, 'bad'); if (n) await this.gainMidas(t, n, true, true, 'convert'); } return true; }
      if (/^Discard 1 Condition card$/.test(p)) { if (alive) { const cs = (t.conditions || []).filter(c => !this.curses || !this.curses(t).includes(c)); if (cs.length) { const c = cs.length === 1 ? cs[0] : await this.ask({ type: 'choice', titan: t, title: '버릴 Condition 카드', options: cs.map(x => ({ label: x, value: x })) }); t.conditions = t.conditions.filter(x => x !== (c || cs[0])); if (c === 'Death' || (!c && cs[0] === 'Death')) t.deathTokens = 0; this.say(`${t.name}: Condition 「${c || cs[0]}」 버림`, 'good'); } else this.say(`${t.name}: 버릴 Condition 카드 없음`); } return true; }
      if (/^Lose 1 Mnemos node$/.test(p)) { if (alive) await this.dhLoseNode(t, false); return true; }
      if (/^Raise DANGER to 9, draw an Obol$/.test(p)) { if (alive) { t.danger = 9; this.say(`${t.name}: Danger 9, Obol`, 'bad'); await this.obolDraw(t, 10); } return true; }
      if (/^Disable the Shackles of Regret Trait$/.test(p)) { this.dhDisableShackles(); return true; }
      if (/^Heal (\d)$/.test(p)) { this.dhHeal(+/\d/.exec(p)[0]); return true; }
      if (/^Gain 1 negative Precision token$/.test(p)) { if (alive) { t.tokens.precision -= 1; this.say(`${t.name}: −Precision 토큰`, 'bad'); } return true; }
      if (/^Float$/.test(p)) { if (alive) await this.float(t); return true; }
      if ((m = /^Gain (\d+) Ambrosia tokens?$/.exec(p))) { if (alive) await this.gainAmbrosia(t, +m[1]); return true; }
      return false;
    },
    async dahakaCritical(t, A) {
      const c = A.bp.critical || '';
      if (/^Gain the Priority Target token\. You may perform a Bonus Attack/.test(c)) { if (!this.ptHolder()?.ptLocked) { for (const x of this.titans) x.pt = false; t.pt = true; } this.say(`${t.name}: Priority Target 토큰 획득`, 'good'); const ok = await this.ask({ type: 'yn', titan: t, title: 'Critical: 보너스 공격 (Interrupt Attack으로 취급) 하시겠습니까?', options: [{ label: '보너스 공격', value: true }, { label: '패스', value: false }] }); if (ok) this.pendingFollowUp = t; return true; }
      if (/^Another Titan may perform a Bonus Attack/.test(c)) { const others = this.liveTitans().filter(x => x !== t); this.say('Critical: 다른 타이탄이 보너스 공격 가능', 'good'); if (others.length) { const o = await this.ask({ type: 'choice', titan: t, title: '보너스 공격을 할 다른 타이탄', options: [{ label: '안 함', value: null }, ...others.map(x => ({ label: x.name, value: x }))] }); if (o) this.pendingFollowUp = o; } return true; }
      if (/^Resolve a Fated Mnemos!/.test(c)) { this.say('(Fated Mnemos 해결 / Memory of the Boiling Sea 이벤트 — 캠페인)', 'sys'); return true; }
      if (/^Disable the Soulrend Trait/.test(c)) { this.prim.disabled['Soulrend'] = true; this.say('Soulrend 비활성', 'good'); return true; }
      if (/^The Dahaka gains 1 negative To Hit token/.test(c)) { this.prim.tokens.toHit -= 1; this.say(`${this.prim.name}: −1 To Hit 토큰 (To Hit ${this.prim.toHit + this.prim.tokens.toHit}+)`, 'good'); return true; }
      if (/^Disable the Shackles of Regret Trait\. You may perform a Bonus Attack/.test(c)) { this.dhDisableShackles(); const ok = await this.ask({ type: 'yn', titan: t, title: 'Critical: 보너스 공격 하시겠습니까?', options: [{ label: '보너스 공격', value: true }, { label: '패스', value: false }] }); if (ok) this.pendingFollowUp = t; return true; }
      if (/^Drift becomes Move Unlimited/.test(c)) { this.prim.driftMove = true; this.say('이제 Drift가 Move Unlimited로 바뀜', 'good'); return true; }
      if (/^Gain 1 Mnemos node for a chosen Mnemos/.test(c)) { const ms = (t.mnemos || []).filter(m => !m.discarded && this.dhNodes(m) < 12); if (!ms.length) { this.say(`${t.name}: node를 올릴 Mnemos 없음`); return true; } const m = (ms.length === 1 ? ms[0] : await this.ask({ type: 'choice', titan: t, title: 'node +1 할 Mnemos', options: ms.map(x => ({ label: `${x.card.name} (node ${x.nodes}, L${x.level})`, value: x })) })) || ms[0]; this.dhNode(m, 1); this.say(`${t.name}: Mnemos 「${m.card.name}」 node +1 → ${m.nodes}node / L${m.level}`, 'good'); return true; }
      if (/^Remove all Ambrosia tokens from each Titan/.test(c)) { for (const x of this.liveTitans()) x.ambrosia = 0; this.say('모든 타이탄 Ambrosia 제거', 'good'); return true; }
      if (/^Wish Attacks become normal Attacks/.test(c)) { this.prim.disabled.wishAtk = true; this.say('이제 Wish Attack은 일반 공격', 'good'); return true; }
      if (/^Permanently gain Ambrosia Limit 6/.test(c)) { t._ambLimit6 = true; this.say(`${t.name}: Ambrosia Limit 6`, 'good'); return true; }
      if (/^Deal an additional Single Wound/.test(c)) { A.extraWound = 1; this.say('(Trench and the Cosmos 이벤트 — 캠페인)', 'sys'); return true; }
      if (/^Draw an Obol\. Then the Dahaka dies/.test(c)) { await this.obolDraw(t, 10); this.say(`${A.bp.bpName} — ${this.prim.name} 즉사!`, 'good'); A.slay = true; return true; }
      return false;
    },
    // ---------- status cards ----------
    dhStatusEligible(from) { return this.liveTitans().filter(x => x !== from && (x.tokens.precision || 0) <= 0); },
    dhWipePrecision(why) { for (const x of this.titans) if ((x.tokens.precision || 0) > 0) x.tokens.precision = 0; this.say(`${why}: 카드를 버리고 게임 안의 모든 +Precision 토큰 제거`, 'bad'); this.prim.status = null; this.notify(); },
    dhActions(t) {
      const out = []; if (t.offBoard) return out; const S = this.prim.status;
      if (S && S.holder === t) for (const x of this.dhStatusEligible(t).filter(x => !x.onVP && !t.onVP && Board.dist(x.pos, t.pos) === 1)) {
        if (S.side === 'FH') out.push({ label: `Fearful Hospitality를 ${x.name}에게 넘기기 (자유 행동, 나는 영구 +Precision 토큰)`, noFate: true, value: async () => { S.holder = x; t.tokens.precision += 1; this.say(`${t.name} → ${x.name}: Fearful Hospitality 전달 — ${t.name} +Precision 토큰`, 'good'); this.notify(); } });
        else out.push({ label: `Outstaying Your Welcome를 ${x.name}에게 넘기기 (자유 행동, 뒤집어 Fearful Hospitality로)`, noFate: true, value: async () => { S.holder = x; S.side = 'FH'; this.say(`${t.name} → ${x.name}: Outstaying Your Welcome 전달 — 뒤집어 Fearful Hospitality`, 'good'); this.notify(); } });
      }
      const T = this.prim.trojan; if (T && T.holder === t) for (const x of this.dhIreEligible(t).filter(x => !x.onVP && !t.onVP && Board.dist(x.pos, t.pos) === 1)) {
        if (T.side === 'TI') out.push({ label: `Trojan Ire를 ${x.name}에게 넘기기 (자유 행동, 나는 The Oar 카드)`, noFate: true, value: async () => { T.holder = x; this.say(`${t.name} → ${x.name}: Trojan Ire 전달`, 'good'); await this.dhGainOar(t); this.notify(); } });
        else out.push({ label: `Lotus Eaters Curse를 ${x.name}에게 넘기기 (자유 행동, 뒤집어 Trojan Ire로 · 나는 Winnowed)`, noFate: true, value: async () => { T.holder = x; T.side = 'TI'; t.dhOar = 'winnowed'; this.say(`${t.name} → ${x.name}: Lotus Eaters Curse 전달 — 뒤집어 Trojan Ire, ${t.name}은(는) Winnowed (Mnemos 사용 불가)`, 'good'); this.notify(); } });
      }
      const seen = new Set(); for (const p of [t.pos, ...DIR_LIST.map(d => ({ c: t.pos.c + DIRS[d][0], r: t.pos.r + DIRS[d][1] }))]) { const z = this.board.inBounds(p.c, p.r) && this.board.terrainAt(p.c, p.r); if (z && z.type === 'Abandoned Temple' && !z.searched && !seen.has(z.id) && !t.onVP) { seen.add(z.id); out.push({ label: 'Abandoned Temple Treasure 찾기 (전투당 1회, d10)', noFate: true, value: async () => this.dhTempleTreasure(t, z) }); } }
      return out;
    },
    async dhTempleTreasure(t, z) {
      this.board.setTerrainProps(z.id, { searched: true }); z.searched = true;
      const r = this.rng.d10(); this.say(`${t.name}: Abandoned Temple Treasure d10=${r}`, r >= 6 ? 'good' : 'bad');
      if (r === 1) { t.mazetouched = true; this.say(`${t.name}: Mazetouched Affliction 획득`, 'bad'); }
      else if (r <= 5) { this.say(`새떼가 ${this.prim.name}을(를) 불러옴 — ${t.name}에게 Signature`, 'bad'); await this.safe(() => this.resolveAI(this.sig, { isSignature: true, forcedTarget: t })); }
      else if (r <= 9) this.say('(Priest +1 — 캠페인 자원)', 'sys');
      else this.say('(Sisyphus Tear — 캠페인 보상)', 'sys');
    },
    dhIreEligible(from) { return this.liveTitans().filter(x => x !== from && !x.dhOar); },
    async dhGainOar(t) {
      if (this.trait('Land That Knows Nothing of the Sea')) { t.dhOar = 'winnowed'; this.say(`${t.name}: The Oar 획득 — Land That Knows Nothing of the Sea: 즉시 뒤집어 Winnowed (Mnemos 사용 불가, Trojan Ire/Lotus Eaters 못 받음)`, 'bad'); return; }
      t.dhOar = 'oar'; this.say(`${t.name}: The Oar 획득 — Precise 키워드, Trojan Ire/Lotus Eaters 못 받음`, 'good');
      if (!this.bp.discard.length && this.bp.size()) { const ok = await this.ask({ type: 'yn', titan: t, title: 'The Oar: 버림 더미에 BP가 없음 — 맨 위 BP 카드를 버리기?', options: [{ label: '버린다', value: true }, { label: '패스', value: false }] }); if (ok) { const c = this.bp.cards.shift(); this.bp.discard.push(c); this.say(`The Oar: 맨 위 카드 「${c.bpName || c.name}」 버림`); } }
    },
    async dhTurnStart(t) {
      const T = this.prim.trojan;
      if (T && T.holder === t && T.side === 'LE') { const ms = (t.mnemos || []).filter(m => !m.discarded); if (!ms.length) { this.say(`Lotus Eaters Curse: ${t.name} — 잃을 Mnemos 카드가 없어 존재에서 지워짐`, 'bad'); await this.kill(t, { erased: true, curse: true }); return; } const m = ms.length === 1 ? ms[0] : (await this.ask({ type: 'choice', titan: t, title: 'Lotus Eaters Curse: 영구히 잃을 Mnemos 카드', options: ms.map(x => ({ label: `${x.card.name} (L${x.level})`, value: x })) })) || ms[0]; m.discarded = true; m.lotus = true; this.say(`Lotus Eaters Curse: ${t.name} — Mnemos 「${m.card.name}」와 모든 node를 영구히 잃음`, 'bad'); }
    },
    async dhTurnEnd(t) {
      if (this.trait('Contaminated Cuts') && t.alive && (t.ambrosia || 0) > 0) { this.say(`Contaminated Cuts: ${t.name} Ambrosia ${t.ambrosia} — Danger +${t.ambrosia}`, 'bad'); await this.gainDanger(t, t.ambrosia, { source: 'Contaminated Cuts' }); if (!t.alive) return; }
      const S = this.prim.status;
      if (S && S.holder === t) {
        if (S.side === 'OYW') this.dhWipePrecision(`${t.name}: 턴 종료 시 Outstaying Your Welcome 보유`);
        else if (!this.dhStatusEligible(t).length) this.dhWipePrecision(`${t.name}: Fearful Hospitality를 넘길 수 있는 타이탄 없음`);
        else { S.side = 'OYW'; this.say(`${t.name}: 턴 종료 — Fearful Hospitality를 뒤집어 Outstaying Your Welcome (다음 턴 종료까지 넘기지 않으면 모든 +Precision 제거)`, 'bad'); this.notify(); }
      }
      const T = this.prim.trojan;
      if (T && T.holder === t) {
        if (!this.dhIreEligible(t).length) { this.say(`${T.side === 'TI' ? 'Trojan Ire' : 'Lotus Eaters Curse'}: 넘길 수 있는 타이탄이 없음 — 모든 타이탄 사망`, 'bad'); const cur = T.side !== 'TI'; this.prim.trojan = null; for (const x of this.liveTitans()) await this.solo(() => this.kill(x, { curse: cur })); return; }
        if (T.side === 'TI' && this.trait('Bane of Odysseus')) { this.say(`Bane of Odysseus: ${t.name}이(가) Trojan Ire를 넘기지 않음 — 사망`, 'bad'); T.holder = null; await this.solo(() => this.kill(t)); const el = this.dhIreEligible(null); if (el.length) { const v = this.rng.pick(el); T.holder = v; T.side = 'TI'; this.say(`Bane of Odysseus: 무작위 타이탄 ${v.name}이(가) Trojan Ire를 받음`, 'bad'); } else this.prim.trojan = null; return; }
        if (T.side === 'TI') { T.side = 'LE'; this.say(`${t.name}: 턴 종료 — Trojan Ire를 뒤집어 Lotus Eaters Curse (다음 턴 시작에 Mnemos 카드 1장 영구 상실)`, 'bad'); this.notify(); }
      }
    },
    async dhOnDeath(t) {
      const S = this.prim.status;
      if (S && S.holder === t) { const live = this.liveTitans(); if (live.length) { const near = live.reduce((a, b) => Board.dist(b.pos, t.pos) < Board.dist(a.pos, t.pos) ? b : a); S.holder = near; this.say(`${S.side === 'FH' ? 'Fearful Hospitality' : 'Outstaying Your Welcome'}: ${t.name} 사망 — 가장 가까운 ${near.name}에게`, 'sys'); } else this.prim.status = null; }
      const T = this.prim.trojan;
      if (T && T.holder === t) { const live = this.liveTitans(); if (live.length) { const near = live.reduce((a, b) => Board.dist(b.pos, t.pos) < Board.dist(a.pos, t.pos) ? b : a); T.holder = near; this.say(`${T.side === 'TI' ? 'Trojan Ire' : 'Lotus Eaters Curse'}: ${t.name} 사망 — 가장 가까운 ${near.name}에게`, 'sys'); } else this.prim.trojan = null; }
    },
  });
}
