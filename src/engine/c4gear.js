// Cycle IV gear mechanics (Sunbask/Sunstarved, Startup, Closing, Strikeback, Pursuit, Hermes Reflex, Midas costs, ...)
import { Board, key, cellLabel, DIRS, DIR_LIST, kw } from './core.js';


const COST = '((?:Ψ|⟳|X|\\[Movement\\]|\\[Amb\\]|\\[Midas\\]|\\[Fire\\]|\\[charge\\])*)';
const KP_KEYS = ['opening', 'break', 'diversion', 'fire', 'black', 'hope', 'closing', 'rouse'];

export function installC4(Game, { TitanDied, BattleOver }) {
  Object.assign(Game.prototype, {
    // ---------- text: gates, Sunbask / Sunstarved ----------
    c4Gates(c, t, text) {
      for (const [k, v] of Object.entries(c.midasGate || {})) if (this.midas(t) >= parseInt(k)) text += ' ' + v;
      for (const [k, v] of Object.entries(c.condGate || {})) if (k === 'Any Condition' ? (t.conditions || []).length > 0 : (t.conditions || []).includes(k)) text += ' ' + v;
      if (/Sunstarved:|Sunbask \d:/.test(text)) {
        const fire = (this.kratosPool && this.kratosPool.fire) || 0;
        text = text.replace(/Sunstarved: ([^.]*\.)/g, (m0, eff) => fire === 0 ? eff : '');
        const acts = []; text = text.replace(/Sunbask (\d): ([^.]*\.)/g, (m0, n, eff) => { if (fire >= +n) acts.push(eff); return ''; });
        for (let eff of acts) {
          eff = eff.replace(/ instead, /, ' instead. ');
          for (const part of eff.split(/(?<=\.) /)) { const km = /^(Opening|Break|Fire|Black|Hope|Closing) (\d)\.$/.exec(part.trim()); const re = km ? new RegExp(`(^|\\.\\s+)${km[1]} (\\d)\\.`) : null; const cur = re ? re.exec(text) : null; if (cur) { if (+km[2] > +cur[2]) text = text.replace(re, `$1${km[1]} ${km[2]}.`); } else text += ' ' + part.trim(); }
        }
        text = text.replace(/\s{2,}/g, ' ').trim();
      }
      return text;
    },
    kpTokens() { const P = this.kratosPool; return KP_KEYS.reduce((a, k) => a + (P[k] || 0), 0); },
    sunActive(txt) { return txt; },
    // ---------- cost helpers ([Midas] / [Amb]) ----------
    async payC4(t, cost) { const nf = (cost.match(/\[Fire\]/g) || []).length; if (nf) { this._kpRaw.fire = Math.max(0, (this._kpRaw.fire || 0) - nf); this.say(`Kratos Pool에서 Fire 토큰 ${nf}개 버림`); } const nm = (cost.match(/\[Midas\]/g) || []).length; const na = (cost.match(/\[Amb\]/g) || []).length; if (nm) await this.gainMidas(t, nm, true, true); if (na && t.alive) await this.gainAmbrosia(t, na); },
    // ---------- attack start ----------
    async c4AttackStart(t, g, A) {
      const txt = A.txt; let m;
      A.c4prec = 0; A.c4raw = 0;
      if (this.gwActive && this.gwActive('Sand to Silica') && this.kratosPool.fire) { A.c4prec -= this.kratosPool.fire; this.say(`Sand to Silica: Fire 토큰 ${this.kratosPool.fire} → Precision −${this.kratosPool.fire}`, 'bad'); }
      if (t.conditions.includes('Resolve')) { A.c4prec += 2; this._kpRaw.break = (this._kpRaw.break || 0) + 1; this.say(`${t.name}: Resolve — Precision +2, Auto-break 1`, 'good'); }
      // Commit (X)
      for (const cm of txt.matchAll(/Commit \((\[Midas\]|\[charge\]|\[Amb\]|\[Fire\])\)/g)) { if (cm[1] === '[Fire]') { if ((this._kpRaw.fire || 0) > 0) { this._kpRaw.fire--; this.say(`${g.card.name}: Commit (Fire) — Kratos Pool Fire 토큰 1개 버림`); } else this.say(`${g.card.name}: Commit (Fire) — Fire 토큰 없음`, 'sys'); continue; } if (cm[1] === '[Midas]') { this.say(`${g.card.name}: Commit (Midas) — Midas 1`); await this.gainMidas(t, 1, true, true); } else if (cm[1] === '[charge]') { g.charges = Math.max(0, (g.charges || 0) - 1); this.say(`${g.card.name}: Commit (charge) — 남은 ${g.charges}`); } else { this.say(`${g.card.name}: Commit (Ambrosia) — Ambrosia 1`); await this.gainAmbrosia(t, 1); } if (!t.alive) throw new TitanDied(t); }
      // Startup X
      { const su = (kw(txt, 'Startup') || 0) + this.nonWeaponKW(t, g, 'Startup'); if (su && this.kpTokens() === 0) { const k = await this.ask({ type: 'choice', titan: t, title: `Startup ${su}: Kratos Pool이 비어 있음 — Opening/Break 배분`, options: Array.from({ length: su + 1 }, (_, i) => ({ label: `Opening ${su - i} / Break ${i}`, value: su - i })) }); const o = k == null ? su : k; this._kpRaw.opening = (this._kpRaw.opening || 0) + o; this._kpRaw.break = (this._kpRaw.break || 0) + (su - o); this.say(`Startup ${su}: Opening ${o}, Break ${su - o}`); } }
      // Closing tokens in the pool: +1 Precision each, free Attack re-roll each
      { const cl = this.kpUse(this.kratosPool.closing || 0); if (cl) { A.c4prec += cl; A.closingRR = cl; this.say(`Closing 토큰 ${cl}: Precision +${cl}, 공격 무료 재굴림 ${cl}`); } }
      // footnote options
      if (/\*When you attack, gain 1 or 3 Midas tokens to gain \+1 Attack die or \+2 Attack die respectively/.test(txt)) { const v = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: Midas 토큰을 받아 공격 주사위 추가?`, options: [{ label: '안 함', value: 0 }, { label: 'Midas 1 → 공격 주사위 +1', value: 1 }, { label: 'Midas 3 → 공격 주사위 +2', value: 3 }] }); if (v) { await this.gainMidas(t, v, true, true); if (!t.alive) throw new TitanDied(t); A.extraAtk = (A.extraAtk || 0) + (v === 3 ? 2 : 1); } }
      if (/\*When you attack, you may gain 1 or 3 Ambrosia tokens to gain \+1 Power or \+2 Power respectively/.test(txt)) { const v = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: Ambrosia를 받아 Power 추가?`, options: [{ label: '안 함', value: 0 }, { label: 'Ambrosia 1 → +1 Power', value: 1 }, { label: 'Ambrosia 3 → +2 Power', value: 3 }] }); if (v) { await this.gainAmbrosia(t, v); if (!t.alive) throw new TitanDied(t); A.c4raw += v === 3 ? 2 : 1; } }
      if (/\*When you attack, you may discard a Fire token from the Kratos Pool to gain \+1 Attack die \(up to 3 times\)/.test(txt) && this.kratosPool.fire > 0) { const mx = Math.min(3, this.kratosPool.fire); const v = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: Fire 토큰을 버리고 공격 주사위 추가 (최대 ${mx})`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: i ? `Fire ${i}개 → +${i}` : '안 함', value: i })) }); if (v) { this._kpRaw.fire -= v; A.extraAtk = (A.extraAtk || 0) + v; } }
      if (/\*Gain \+1 Attack die for every 2 Midas tokens you have \(up to \+3\)/.test(txt)) { const n = Math.min(3, Math.floor(this.midas(t) / 2)); if (n) { A.extraAtk = (A.extraAtk || 0) + n; this.say(`${g.card.name}: Midas ${this.midas(t)} → 공격 주사위 +${n}`); } }
      if (/\*Gain \+1 Attack die for each Midas token you have \(up to \+3\)/.test(txt)) { const n = Math.min(3, this.midas(t)); if (n) { A.extraAtk = (A.extraAtk || 0) + n; this.say(`${g.card.name}: Midas ${this.midas(t)} → 공격 주사위 +${n}`); } }
      if (/(?:\*|^|\.\s)When you attack, you may gain the Wishkeen Condition card to gain \+1 Power/.test(txt)) { const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: Wishkeen Condition을 받고 +1 Power?`, options: [{ label: '받는다', value: true }, { label: '패스', value: false }] }); if (ok) { await this.midasCondition(t, 'Wishkeen', true); A.c4raw += 1; } }
      if (/\*Gain \+1 Power for each empty Gear slot \(up to \+2\)/.test(txt)) { const sl = t.def.slots || {}; const es = t.cls === 'earthshaker' && !sl.hands; const nS = t.gear.filter(x => !x.discarded && x.card.slot === 'support').length; const capH = sl.hands || (es && nS < 3 ? 3 : 2); const capS = (sl.support || (es && nS >= 3 ? 3 : 2)) + (t.gear.some(x => !x.discarded && /You have 1 additional Support slot/i.test(x.card.text || '')) ? 1 : 0); const real = t.gear.filter(x => x.card.name !== 'Fists'); const usedH = real.filter(x => /^hand/.test(x.card.slot)).reduce((a, x) => a + this.handCost(t, x), 0); const empty = Math.max(0, capH - usedH) + Math.max(0, (sl.armor || 1) - real.filter(x => x.card.slot === 'armor').length) + Math.max(0, capS - real.filter(x => x.card.slot === 'support').length); const n = Math.min(2, empty); if (n) { A.c4raw += n; this.say(`${g.card.name}: 빈 장비 슬롯 ${n} → +${n} Power`); } }
      if (/\*Precision \+4 instead, if your Hermes Movement this turn ended closer to the Primordial/.test(txt) && t._hermesCloser === this.round) { A.c4prec += 2; this.say(`${g.card.name}: Hermes 이동으로 더 가까워짐 — Precision +4`); }
      // Sunbask / Sunstarved resolved effects
      for (const pm of txt.matchAll(/(?:^|\. )Gain \+(\d) Precision\./g)) A.c4prec += +pm[1];
      for (const pm of txt.matchAll(/(?:^|\. )Gain \+(\d) Power\./g)) A.c4raw += +pm[1];
      if (/(?:^|\. )Deadly or Precise or \+1 Power\./.test(txt)) { const v = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: Sunbask 2 — 선택`, options: [{ label: 'Deadly', value: 'd' }, { label: 'Precise', value: 'p' }, { label: '+1 Power', value: 'w' }] }); if (v === 'd') A.c4deadly = true; else if (v === 'p') A.c4precise = true; else A.c4raw += 1; }
      if (/(?:^|\. )Discard 1 Midas token\./.test(txt) && this.midas(t)) { const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: Midas 토큰 1개 버리기?`, options: [{ label: '버린다', value: true }, { label: '패스', value: false }] }); if (ok) await this.loseMidas(t, 1); }
      if (/(?:^|\. )Place 1 Fire token in the Kratos Pool\./.test(txt)) { this._kpRaw.fire = (this._kpRaw.fire || 0) + 1; this.say(`${g.card.name}: Sunstarved — Fire 토큰 1개`); }
      if ((/Gain \+1 Power when on a VP/.test(txt) || /When on a VP, you gain \+1 Power/.test(txt)) && t.onVP) { A.c4raw += 1; this.say(`${g.card.name}: VP 위 — +1 Power`); }
      if (A.mods && A.mods.strikeback && this.currentAI) { A.c4raw += 1; this.say('Strikeback (Interrupt Attack): Primordial Round 중 +1 Power'); }
      if (A.c4prec) this.say(`${g.card.name}: Precision ${A.c4prec >= 0 ? '+' : ''}${A.c4prec}`);
    },
    // ---------- after attack roll ----------
    async c4AfterRoll(t, g, A, rolls, isHit) {
      const txt = A.txt; let m;
      if (A.crit) {
        if (/Crit Chance: Lose any 1 Curse Affliction/.test(txt)) { const cs = this.curses(t); if (cs.length) { const c = cs.length === 1 ? cs[0] : await this.ask({ type: 'choice', titan: t, title: '잃을 Curse Affliction', options: cs.map(x => ({ label: x, value: x })) }); t.conditions = t.conditions.filter(x => x !== c); this.say(`${t.name}: Curse ${c} 잃음`, 'good'); } }
        if (/Crit Chance: Lose -1 Ψ/.test(txt) && t.fate > 0) { t.fate--; this.say(`${t.name}: Crit Chance — Fate −1`, 'good'); }
      }
      if (A.critMiss) {
        const cm = (/Crit Miss: ([^.]+)\./.exec(txt) || [])[1] || '';
        if (/^Gain 1 Midas token$/.test(cm)) { await this.gainMidas(t, 1); }
        else if ((m = /^Gain the (Wishkeen|Wishagog|Covetous|Greed-crazed) Condition card$/.exec(cm))) await this.midasCondition(t, m[1]);
        else if (/^Immediately fully miss the Attack and gain 1 Midas token$/.test(cm)) { A.hits = 0; await this.gainMidas(t, 1); }
        else if (/^After the Attack, discard this Gear$/.test(cm)) A.discardAfter = true;
        else if (/^Wish Away \d+$/.test(cm)) await this.wishAway(t, +/\d+/.exec(cm)[0]);
        else if (/^Turn all your Midas tokens into Ambrosia tokens$/.test(cm)) this.unholyAlchemy(t);
        if (!t.alive) throw new TitanDied(t);
      }
      if (/The Crit Die hit grants you 1 black Power die instead/.test(txt) && rolls.some(r => r.crit && isHit(r))) A.critBlack = true;
      if (A.hits === 0 && t.conditions.includes('Resolve')) { t.conditions = t.conditions.filter(c => c !== 'Resolve'); this.say(`${t.name}: 완전 빗나감 — Resolve 버림`, 'bad'); }
      const fullHit = A.hits > 0 && A.hits === rolls.length;
      if (fullHit && /Full Hit: Ignore Wound Responses/.test(txt)) { A.ignoreWoundResp = true; this.say(`${g.card.name}: Full Hit — Wound Response 무시`, 'good'); }
      if (fullHit && /Full Hit: During the second ability window, place 1 negative AT token in the Kratos Pool/.test(txt)) A.c4negAT = 1;
      // Each hit / Each miss
      const misses = rolls.length - A.hits;
      for (const em of txt.matchAll(/Each (hit|miss): (Fire|Opening|Break|Black|Hope) (\d)\./g)) { const n = (em[1] === 'hit' ? A.hits : misses) * +em[3]; if (n) { const k = em[2].toLowerCase(); A.late = A.late || {}; A.late[k] = (A.late[k] || 0) + n; this.say(`${g.card.name}: ${em[1] === 'hit' ? 'hit' : 'miss'} ${n / +em[3]} → ${em[2]} ${n} (2nd window)`); } }
      if (/For each hit, choose one \(you may choose each effect more than once\)/.test(txt)) for (let h = 0; h < A.hits; h++) { const opts = [{ label: 'Scorpion: 다음 Primordial Response/After Attack 이동 −1', value: 's' }, { label: 'Lion: Midas +1 → Auto-break 1', value: 'l' }]; if (this.midas(t) > 0) opts.unshift({ label: 'Mortal: Midas −1 → Hope 1', value: 'm' }); const v = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: hit ${h + 1}/${A.hits} 효과 선택`, options: opts }); if (v === 'm') { await this.loseMidas(t, 1); A.late = A.late || {}; A.late.hope = (A.late.hope || 0) + 1; } else if (v === 'l') { await this.gainMidas(t, 1); this.kratosPool.break = (this.kratosPool.break || 0) + 1; } else { this.prim.scorpion = (this.prim.scorpion || 0) + 1; } this.say(`${g.card.name}: ${v === 'm' ? 'Mortal' : v === 'l' ? 'Lion' : 'Scorpion'}`); }
      if (/Each hit: Turn 1 Midas token into Break 1/.test(txt)) { let n = 0; for (let h = 0; h < A.hits && this.midas(t) > 0; h++) { await this.loseMidas(t, 1); n++; } if (n) { A.late = A.late || {}; A.late.break = (A.late.break || 0) + n; this.say(`${g.card.name}: Midas ${n} → Break ${n} (2nd window)`); } }
    },
    async c4FullMiss(t, eff) { let m; if ((m = /^(Break|Fire|Opening|Rouse|Black|Hope) (\d)\.$/.exec(eff.trim()))) { const k = m[1].toLowerCase(); this._kpRaw[k] = (this._kpRaw[k] || 0) + +m[2]; this.say(`Full Miss: ${m[1]} ${m[2]} — Kratos Pool`); return true; } return false; },
    c4Power(t, g, A) { if (A.c4raw) { A.raw += A.c4raw; this.say(`${g.card.name}: +${A.c4raw} Power`); } if (A.critBlack) { const i = A.pool.indexOf('r'); if (i >= 0) { A.pool[i] = 'b'; this.say(`${g.card.name}: Crit 주사위 hit — Power die 빨강 → 검정`); } } },
    async c4SecondWindow(t, A, add = null) {
      const txt = A.txt; const cl = (kw(txt, 'Closing') || 0) + this.nonWeaponKW(t, A.g, 'Closing'); if (cl) { this.kratosPool.closing = (this.kratosPool.closing || 0) + cl; this.say(`2nd window: Kratos Pool ← Closing ${cl}`); }
      if (A.late) { for (const [k, n] of Object.entries(A.late)) this.kratosPool[k] = (this.kratosPool[k] || 0) + n; this.say(`2nd window: Kratos Pool ← ${Object.entries(A.late).map(([k, n]) => `${k} ${n}`).join(', ')}`); A.late = null; }
      if (A.c4negAT) { this.kratosPool.negAT = (this.kratosPool.negAT || 0) + 1; this.say('Full Hit: Kratos Pool에 −AT 토큰 1개'); }
      { const hr = (kw(txt, 'Hermes Reposition') || 0) + this.nonWeaponKW(t, A.g, 'Hermes Reposition') || null; const run = async () => { if (typeof hr === 'number' && t.alive && !t.offBoard && !t.knockdown) { const ok = await this.ask({ type: 'yn', titan: t, title: `Hermes Reposition ${hr}: Hermes Move ${hr}회?`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) await this.hermesMove(t, hr, 'Hermes Reposition'); } else if (typeof hr === 'number' && t.knockdown) this.say(`${t.name}: Knockdown 상태 — Hermes Reposition 불가`); }; if (typeof hr === 'number') { if (add) add(`Hermes Reposition ${hr}`, run); else await run(); } }
      if (/When you use this card's Unholy Alchemy, place as many Black tokens/.test(txt)) {}
      if (!A.wound && t.conditions.includes('Resolve')) { t.conditions = t.conditions.filter(c => c !== 'Resolve'); this.say(`${t.name}: Wound 실패 — Resolve 버림`, 'bad'); }
      if (A.discardAfter && A.g && !A.g.discarded) { this.say(`${A.g.card.name}: Crit Miss — 공격 후 버림`, 'bad'); this.discardGear(t, A.g); }
    },
    // ---------- Strikeback ----------
    async c4Strikeback(t) {
      if (!t.alive || t.offBoard || t.knockdown || t.fatigue || !this.currentAI || this.isJudge(this.currentAI.card)) return;
      let X = -1; for (const g of t.gear) { if (g.discarded) continue; const v = kw(this.gearText(g, t), 'Strikeback'); if (typeof v === 'number') X = Math.max(X, v); }
      if (X < 0) return;
      const ok = await this.ask({ type: 'yn', titan: t, title: `Strikeback ${X}: Full Evade — 최대 ${X}칸 이동 후 공격? (Interrupt Attack, Combat Fatigue 토큰${this._aiDepth > 0 ? ', 원래 공격은 Chain Break로 종료' : ''})`, options: [{ label: 'Strikeback!', value: true }, { label: '패스', value: false }] });
      if (!ok) return;
      if (this.prim.def.dahakaD && this.trait('The Dragon Does Not Sleep') && this.trait('Semicorporeal Wraith') && this.currentAI && this.currentAI.card && this.currentAI.card.dahaka && !this.currentAI.card._dhUsed) { const broken = await this.dhComboBreak(this.currentAI.card); if (!broken) { this.say(`${t.name}: Combo Break 없이는 AI 카드에 Interrupt Attack(Strikeback) 불가`, 'bad'); return; } }
      let bonusAfter = false; if ((this.pendingBonus && this.pendingBonus.titan === t && !this.pendingBonus.awaken) || this.pendingFollowUp === t) { if (this.pendingFollowUp === t) this.pendingFollowUp = null; else { if (this.pendingBonus.cb) this._cbNow = t; this.pendingBonus = null; } const ord = await this.ask({ type: 'choice', titan: t, title: `${t.name}: Strikeback과 보너스 공격(Crit Evade) 순서`, options: [{ label: 'Strikeback 먼저', value: 'sb' }, { label: '보너스 공격 먼저', value: 'bonus' }] }); if (ord === 'bonus') { this.say(`${t.name}: 보너스 공격 먼저`, 'good'); await this.chainSafe(() => this.bonusAttackFlow(t)); if (this._aiDepth > 0) this._cbNow = t; if (!t.alive) return; } else bonusAfter = true; }
      try {
      if (X > 0 && !t.knockdown) await this.chooseMove(t, X, 'Reposition (Strikeback)');
      const weps = this.usableWeapons(t).filter(w => this.inWeaponRange(t, w)); if (!weps.length) { this.say(`${t.name}: Strikeback — 사거리 내 무기 없음`); t.fatigue = 'combat'; return; }
      this.say(`${t.name}: STRIKEBACK!`, 'good'); const swaps = [];
      for (const w of t.gear) if (w.card.strikebackSide && !w.discarded) { swaps.push([w, w.card]); w.card = { ...w.card, ...w.card.strikebackSide, codes: w.card.codes, tech: w.card.tech, cycle: w.card.cycle }; }
      const prevActor = this._actor;
      try { await this.chainSafe(() => this.titanAttack(t, { strikeback: true, interrupt: true })); } finally { for (const [w, c] of swaps) w.card = c; this._actor = prevActor; }
      if (this._aiDepth > 0) this._cbNow = t;
      if (t.alive) { t.fatigue = 'combat'; this.say(`${t.name}: Combat Fatigue 토큰`); }
      } finally { if (bonusAfter && t.alive) { this.say(`${t.name}: 이어서 보너스 공격`, 'good'); await this.chainSafe(() => this.bonusAttackFlow(t)); } }
    },
    // ---------- reactions ----------
    c4Reactions(x, t, card) {
      const out = []; if (x.offBoard || x.float === 'up' || x.knockdown === 'falling') return out;
      for (const g of x.gear) {
        if (g.discarded || g.blank) continue; const txt = this.gearText(g, x); let m;
        const add = (cost, label, fn) => { if (!this.costOK(x, cost, g)) return; out.push({ label: `${x.name}: ${g.card.name} — ${label} [${this.costLbl(cost)}]`, noFate: !/Ψ/.test(cost), value: async () => { await this.payCost(x, cost, g); await fn(); } }); };
        if ((m = new RegExp(`\\[R\\]${COST} ?(Advanced Hermes Reflex|Hermes Reflex)(, then suffer Float)?\\.`).exec(txt)) && !x.onVP && !x.impaled && !x.knockdown) { const adv = /Advanced/.test(m[2]); const nm = m[2]; const fl = !!m[3]; add(m[1], `${nm} (Hermes Move ${adv ? '최대 2회' : '1회'})${fl ? ' 후 Float' : ''}`, async () => { await this.hermesMove(x, adv ? 2 : 1, nm); if (fl && x.alive && this.float) await this.float(x); }); }
        if ((m = new RegExp(`\\[R\\]${COST} ?Pursuit (\\d)\\.`).exec(txt)) && card && card.kind && x !== t && !x.onVP && !x.impaled && !x.knockdown) { const n = +m[2]; add(m[1], `Pursuit ${n} (Primordial 방향 ${this.prim.facing}로 직선 ${n}칸)`, () => this.pursuitMove(x, n)); }
        if ((m = new RegExp(`(?:^|\\. )Pursuit (\\d)\\.`).exec(txt)) && card && card.kind && x !== t && !x.onVP && !x.impaled && !x.knockdown && !/\[R\]/.test(txt.slice(Math.max(0, m.index - 6), m.index + 2))) { const n = +m[1]; add('', `Pursuit ${n}`, () => this.pursuitMove(x, n)); }
        if ((m = new RegExp(`\\[R\\]${COST} ?Place an Irem Tower Terrain tile on an adjacent space\\.`).exec(txt))) add(m[1], 'Irem Tower 타일을 인접 칸에', () => this.placeIremAdj(x));
        if (/Ψ⟳ Choose a Condition card\. You may ignore its effects until the end of this Round\. May be used as a \[R\]/.test(txt) && x.conditions.length) add('Ψ⟳', 'Condition 1장 이번 라운드 무시', () => this.suspendCondition(x));
        if (/You may use this card's ability as \[R\]/.test(txt) && /Ψ⟳ Stand up\./.test(txt) && x.knockdown) add('Ψ⟳', '일어서기', async () => this.standUp(x));
        if (/Ψ⟳ Deflate\. You may use this ability while floating/.test(txt) && x.float) add('Ψ⟳', 'Deflate', async () => this.deflate(x, g.card.name));
      }
      return out;
    },
    async pursuitMove(x, n) { const [dx, dy] = DIRS[this.prim.facing]; let k = 0; for (; k < n; k++) { const p = { c: x.pos.c + dx, r: x.pos.r + dy }; if (!this.freeCell(p) || this.board.hasWall(x.pos, p)) break; x.pos = p; } this.say(`${x.name}: Pursuit — ${k}칸 이동 → ${cellLabel(x.pos)}`); this.notify(); await this.landOn(x); },
    async placeIremAdj(x) { const cs = DIR_LIST.map(d => ({ c: x.pos.c + DIRS[d][0], r: x.pos.r + DIRS[d][1] })).filter(p => this.board.inBounds(p.c, p.r) && !this.board.terrainAt(p.c, p.r) && !this.titanAt(p.c, p.r) && !this.primContains(p)); if (!cs.length) { this.say('인접한 빈 칸 없음'); return; } const p = cs.length === 1 ? cs[0] : (await this.ask({ type: 'move', titan: x, title: 'Irem Tower를 놓을 칸', cells: cs, options: cs.map(q => ({ label: cellLabel(q), value: q })) })) || cs[0]; this._iremN = (this._iremN || 0) + 1; this.board.addTerrain([cellLabel(p)], { id: 'iremX' + this._iremN, type: 'Irem Tower', irem: 'tower', obstacle: true, obscuring: true, destructible: false, elevated: true, shifting: true, climb: 4 }); this.say(`${x.name}: ${cellLabel(p)}에 Irem Tower 배치`, 'good'); this.notify(); },
    async suspendCondition(x) { const c = x.conditions.length === 1 ? x.conditions[0] : await this.ask({ type: 'choice', titan: x, title: '이번 라운드 동안 무시할 Condition', options: x.conditions.map(k => ({ label: k, value: k })) }); if (!c) return; x.conditions = x.conditions.filter(k => k !== c); x._suspended = [...(x._suspended || []), { c, round: this.round }]; this.say(`${x.name}: ${c} — 이번 라운드 끝까지 무시`, 'good'); },
    c4RoundCleanup() { for (const x of this.titans) if (x._suspended && x._suspended.length) { for (const s of x._suspended) if (!x.conditions.includes(s.c)) x.conditions.push(s.c); this.say(`${x.name}: 무시하던 ${x._suspended.map(s => s.c).join(', ')} 다시 적용`); x._suspended = []; } },
    // ---------- free actions ----------
    c4GearActions(t) {
      const out = []; if (t.offBoard) return out;
      for (const g of t.gear) {
        if (g.discarded || g.blank) continue; const txt = this.gearText(g, t); let m;
        const add = (cost, label, fn, cond = true) => { if (!cond || !this.costOK(t, cost, g)) return; out.push({ label: `${g.card.name}: ${label} [${this.costLbl(cost)}]`, noFate: !/Ψ/.test(cost), value: async () => { await this.payCost(t, cost, g); await fn(); } }); };
        if ((m = new RegExp(`(?:^|\\. )${COST} ?Discard 1 Midas token from this card\\.`).exec(txt)) && m[1]) add(m[1], 'Midas 토큰 1개 버림 (이 카드)', () => this.loseMidasFrom(t, g, 1), (g.midas || 0) > 0);
        if ((m = new RegExp(`(?:^|\\. )${COST} ?Discard all Midas tokens from this card\\.`).exec(txt)) && m[1]) add(m[1], 'Midas 토큰 전부 버림 (이 카드)', () => this.loseMidasFrom(t, g, g.midas || 0), (g.midas || 0) > 0);
        if ((m = new RegExp(`(?:^|\\. )${COST} ?Discard up to 2 Midas tokens\\.`).exec(txt)) && m[1]) add(m[1], 'Midas 토큰 최대 2개 버림', async () => { const n = Math.min(2, this.midas(t)); const v = n <= 1 ? n : await this.ask({ type: 'choice', titan: t, title: '버릴 Midas 토큰 수', options: [1, 2].map(i => ({ label: `${i}개`, value: i })) }); await this.loseMidas(t, v || n); }, this.midas(t) > 0);
        if ((m = new RegExp(`(?:^|\\. )${COST} ?Discard up to 2 Ambrosia tokens\\.`).exec(txt)) && m[1]) add(m[1], 'Ambrosia 최대 2개 버림', async () => { t.ambrosia = Math.max(0, t.ambrosia - 2); this.say(`${t.name}: Ambrosia → ${t.ambrosia}`, 'good'); }, t.ambrosia > 0);
        if ((m = new RegExp(`(?:^|\\. )${COST} ?Unholy Alchemy\\.`).exec(txt)) && m[1]) add(m[1], `Unholy Alchemy (Midas ${this.midas(t)} → Ambrosia)`, async () => { const n = this.midas(t); await this.unholyAlchemy(t); if (/place as many Black tokens in the Kratos Pool as Midas tokens you've turned/.test(txt) && n) { this.kratosPool.black += n; this.say(`${g.card.name}: Black 토큰 ${n}`); } }, this.midas(t) > 0);
        if ((m = new RegExp(`(?:^|\\. )${COST} ?Reverse Unholy Alchemy\\.`).exec(txt)) && m[1]) add(m[1], `Reverse Unholy Alchemy (Ambrosia ${t.ambrosia} → Midas)`, async () => { const n = t.ambrosia; t.ambrosia = 0; this.say(`${t.name}: Reverse Unholy Alchemy — Ambrosia ${n} → Midas`); await this.gainMidas(t, n, true, true, 'convert'); }, t.ambrosia > 0);
        if (/Ψ⟳ Flip a Mind Condition card/.test(txt)) { const fl = { 'Greed-crazed': 'Covetous', Covetous: 'Greed-crazed', Wishagog: 'Wishkeen', Wishkeen: 'Wishagog', Enriched: 'Enlightened', Enlightened: 'Enriched' }; const cs = t.conditions.filter(c => fl[c]); add('Ψ⟳', 'Mind Condition 뒤집기', async () => { const c = cs.length === 1 ? cs[0] : await this.ask({ type: 'choice', titan: t, title: '뒤집을 Condition', options: cs.map(x => ({ label: `${x} → ${fl[x]}`, value: x })) }); if (!c) return; t.conditions = t.conditions.map(x => x === c ? fl[c] : x); this.say(`${t.name}: ${c} → ${fl[c]}`, 'good'); }, cs.length > 0); }
        // ---- added: assorted gear actions ----
        if (/Ψ\[charge\]⟳ Move a Rapid Adaptation token 1 space to the left or right/.test(txt) && this.prim.ra && this.prim.ra.spaces.some(s => s.n > 0 && !s.locked)) add('Ψ[charge]⟳', 'Rapid Adaptation 토큰 1칸 이동', async () => { const R = this.prim.ra; const L = R.spaces.length; const from = R.spaces.map((s, i) => i).filter(i => R.spaces[i].n > 0 && !R.spaces[i].locked); const i = from.length === 1 ? from[0] : await this.ask({ type: 'choice', titan: t, title: '옮길 Rapid Adaptation 토큰', options: from.map(i => ({ label: this.raName(i), value: i })) }); const d = await this.ask({ type: 'choice', titan: t, title: `방향 — ${this.raName(i)}에서`, options: [{ label: `왼쪽 → ${this.raName(i - 1)}`, value: L - 1 }, { label: `오른쪽 → ${this.raName(i + 1)}`, value: 1 }] }); const j = (i + d) % L; R.spaces[i].n--; R.spaces[j].n++; this.say(`Regression Agent: Rapid Adaptation 토큰 ${this.raName(i)} → ${this.raName(j)}`, 'good'); });
        if (/Trampling Rush \(Move action \+ Combat action\): Perform Improved Rush, then move up to your Speed in a straight line/.test(txt) && !t.turn.moved && !t.turn.attacked && !t.knockdown && !t.onVP && this.fr(t) > 0) add('', 'Trampling Rush (이동+전투 행동, Fate+1): Improved Rush 후 Speed만큼 직선 이동', async () => { t.turn.moved = t.turn.attacked = true; await this.gainFate(t, 1); await this.chooseMove(t, this.speedOf(t) + 2, 'Rush', 3); if (t.alive && this.usableWeapons(t, w => !/Ranged/.test(w.card.text)).length) await this.titanAttack(t, { autoBreak: 1, precision: 1, meleeOnly: true }); if (t.alive && !t.onVP) await this.straightMove(t, this.speedOf(t), 'Trampling Rush'); });
        if (/\[Movement\]X Wish Away 8 from the Primordial/.test(txt) && !t.turn.moved && this.wishAway) add('X', 'Wish Away 8 (이동 행동 사용, Staircase에서도 가능)', async () => { t.turn.moved = true; await this.wishAway(t, 8, { escape: true }); });
        if (/X Choose a Titan\. That Titan arrives from Time-clocked/.test(txt)) { const tc = this.titans.filter(x => x.alive && x.offBoard === 'clock' && x.clockSide !== 'arriving'); add('X', 'Time-clocked 타이탄 귀환', async () => { const o = tc.length === 1 ? tc[0] : await this.pickTitan(t, tc); if (o) { o.clockSide = 'arriving'; this.say(`${o.name}: Time-clocked에서 귀환`, 'good'); } }, tc.length > 0); }
        if (/ΨX Place an Airsac Mine token on your space/.test(txt) && !t.onVP && t.pos) add('ΨX', `Airsac Mine 토큰 설치 (${cellLabel(t.pos)})`, async () => { (this.airsac = this.airsac || []).push({ ...t.pos }); this.say(`${t.name}: Airsac Mine 토큰 ${cellLabel(t.pos)}`); });
        if (/⟳ Authority: All other Titans gain the Knockdown \(standing up\) Condition card and become shaded/.test(txt)) add('⟳', 'Authority (다른 타이탄 Knockdown(일어서는 중) + Shaded)', async () => { for (const o of this.liveTitans()) { if (o === t || o.offBoard || o.onVP) continue; o.knockdown = 'standing'; o.shadedTok = true; o._authShade = true; } this.say(`${t.name}: Authority — 다른 타이탄 Knockdown(일어서는 중), 일어설 때까지 Shaded`); });
        if (/ΨΨΨX Place the Primordial adjacent to you/.test(txt) && !t.onVP && t.pos && !this.isAdj(t)) add('ΨΨΨX', 'Primordial을 내 옆으로', async () => { await this.primAdjacentTo(t); });
        if (/(?:^|\. )X Discard all Ambrosia tokens from any Titan/.test(txt)) { const am = this.liveTitans().filter(x => x.ambrosia > 0); add('X', '타이탄 1명의 Ambrosia 전부 버림', async () => { const o = am.length === 1 ? am[0] : await this.pickTitan(t, am); if (o) { o.ambrosia = 0; this.say(`${o.name}: Ambrosia 전부 버림`); } }, am.length > 0); }
        if (/X Stand up and deflate\. You may use this ability when knocked down and\/or floating/.test(txt)) add('X', '일어서기 + Deflate', async () => { if (t.knockdown) this.standUp(t); if (t.float) await this.deflate(t, g.card.name); }, !!(t.knockdown || t.float));
        if (/⟳ Gain \+X Danger to gain Light X and Fire X until end of turn/.test(txt) && t.danger < 9) add('⟳', 'Danger +X → 이번 턴 Fire X', async () => { const X = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: X 선택 (Danger +X, 이번 턴 공격에 Fire X)`, options: Array.from({ length: Math.max(1, 9 - t.danger) }, (_, i) => ({ label: `X = ${i + 1}`, value: i + 1 })) }); await this.gainDanger(t, X, { source: g.card.name }); t.turnFire = (t.turnFire || 0) + X; t.turnFireRound = this.round; this.say(`${t.name}: 이번 턴 Fire +${X} (Light는 Cycle V)`); });
        if (/\[charge\]\[charge\]\[charge\]⟳ The next time you would draw AI, perform Signature instead/.test(txt) && (g.charges || 0) >= 3 && !g.exhausted) add('⟳', 'charge 3: 다음 AI 대신 Signature', async () => { g.charges -= 3; this.nextAISig = true; this.say(`${g.card.name}: 다음 AI 드로우는 Signature로 대체`); });
        if (/ΨX BP or AI Suppress/.test(txt) && false) {}
        if (/(?:^|\. )Unholy Alchemy\./.test(txt) && !t.turn.usedAbilities.has('UA:' + g.card.name) && this.midas(t) > 0) add('', `Unholy Alchemy (Midas ${this.midas(t)} → Ambrosia)`, async () => { t.turn.usedAbilities.add('UA:' + g.card.name); await this.unholyAlchemy(t); });
        if (/Ψ⟳ Deflate\. You may use this ability while floating/.test(txt)) add('Ψ⟳', 'Deflate', async () => this.deflate(t, g.card.name), !!t.float);
        if (/Ψ⟳ Stand up\. You may use this ability while knocked down/.test(txt)) add('Ψ⟳', '일어서기', async () => this.standUp(t), !!t.knockdown);
        if ((m = new RegExp(`(?:^|\\. )${COST} ?Place an Irem Tower Terrain tile on an adjacent space\\.`).exec(txt)) && !/\[R\]/.test(m[0])) add(m[1], 'Irem Tower 타일을 인접 칸에', () => this.placeIremAdj(t));
        if (/Ψ⟳ Choose a Condition card\. You may ignore its effects until the end of this Round/.test(txt)) add('Ψ⟳', 'Condition 1장 이번 라운드 무시', () => this.suspendCondition(t), t.conditions.length > 0);
        if (/(?:^|\. )X Discard a Condition card\./.test(txt)) add('X', 'Condition 1장 버림', async () => { const c = t.conditions.length === 1 ? t.conditions[0] : await this.ask({ type: 'choice', titan: t, title: '버릴 Condition', options: t.conditions.map(k => ({ label: k, value: k })) }); if (c === 'Float') return this.deflate(t, g.card.name); t.conditions = t.conditions.filter(k => k !== c); if (c === 'Bleeding') t.bleeding = 0; this.say(`${t.name}: ${c} 버림`, 'good'); }, t.conditions.length > 0);
        if (/Ψ⟳ If the Kratos Pool is empty, immediately place 2 Opening and 2 Break tokens, or 2 Fire tokens there/.test(txt)) add('Ψ⟳', 'Kratos Pool이 비었으면 Opening 2+Break 2 또는 Fire 2', async () => { const v = await this.ask({ type: 'choice', titan: t, title: 'Kaleidoscope Module', options: [{ label: 'Opening 2 + Break 2', value: 'ob' }, { label: 'Fire 2', value: 'f' }] }); this._kpRaw[v === 'f' ? 'fire' : 'opening'] = (this._kpRaw[v === 'f' ? 'fire' : 'opening'] || 0) + 2; if (v !== 'f') this._kpRaw.break = (this._kpRaw.break || 0) + 2; this.say(`Kratos Pool ← ${v === 'f' ? 'Fire 2' : 'Opening 2, Break 2'}`); }, this.kpTokens() === 0);
        if (/Ψ⟳ Immediately place 2 Opening or 2 Break tokens in the Kratos Pool/.test(txt)) add('Ψ⟳', 'Opening 2 또는 Break 2', async () => { const v = await this.ask({ type: 'choice', titan: t, title: 'Kaleidoscope Module', options: [{ label: 'Opening 2', value: 'opening' }, { label: 'Break 2', value: 'break' }] }); this.kratosPool[v || 'opening'] += 2; this.say(`Kratos Pool ← ${v} 2`); });
      }
      return out;
    },
    loseMidasFrom(t, g, n) { n = Math.min(n, g.midas || 0); if (!n) return; g.midas -= n; this.say(`${t.name}: ${g.card.name}의 Midas 토큰 −${n}`); if (this.prim && this.prim.def.midasD) this.painAdd(n, `${t.name}이(가) Midas 버림`); this.midasRemoved(t, n); },
    // ---------- Hermes Move options (move action) ----------
    hermesOptions(t) {
      const out = [];
      for (const g of t.gear) { if (g.discarded || g.blank) continue; const txt = this.gearText(g, t);
        for (const hm of txt.matchAll(new RegExp(`(?<=^|\\.\\s)${COST} ?Hermes Move (\\d)(?: \\([^)]*\\))?\\.`, 'g'))) { const cost = hm[1] || ''; if (!cost && g.exhausted) continue; if (cost && !this.costOK(t, cost, g)) continue; const X = Math.max(0, +hm[2] - this.liquidityPen(t)); if (X > 0) out.push({ g, cost, X }); } }
      return out;
    },
    // ---------- Midas gain modifiers ----------
    async c4MidasGain(t, n) {
      if (n <= 1) return n;
      for (const g of t.gear) { if (g.discarded || n <= 1) continue; const txt = this.gearText(g, t); let m;
        for (const mm of txt.matchAll(new RegExp(`(?<=^|\\.\\s)${COST} ?When you are about to gain Midas tokens, lower this gain (by 1 \\(to a minimum of 1\\)|to 1)`, 'g'))) { const cost = mm[1] || ''; if (!this.costOK(t, cost, g) || n <= 1) continue; const to1 = /to 1$/.test(mm[2]); const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: Midas ${n}개 획득 → ${to1 ? 1 : n - 1}개로? [${this.costLbl(cost)}]`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (!ok) continue; await this.payCost(t, cost, g); n = to1 ? 1 : Math.max(1, n - 1); this.say(`${g.card.name}: Midas 획득 → ${n}`, 'good'); }
      }
      return n;
    },
    async c4IgnoreAirFloat(t, what) {
      for (const g of t.gear) { if (g.discarded) continue; const txt = this.gearText(g, t); const m = new RegExp(`(?:^|\\. )${COST} ?When you are about to suffer Airburst or Float, ignore it`).exec(txt); if (!m || !this.costOK(t, m[1], g)) continue; const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: ${what} 무시? [${this.costLbl(m[1])}]`, options: [{ label: '무시', value: true }, { label: '패스', value: false }] }); if (ok) { await this.payCost(t, m[1], g); this.say(`${t.name}: ${g.card.name} — ${what} 무시`, 'good'); return true; } }
      return false;
    },
    async c4KnockdownReplace(t) {
      for (const g of t.gear) { if (g.discarded) continue; const txt = this.gearText(g, t); const m = new RegExp(`(?:^|\\. )${COST} ?When you are about to suffer Knockdown, Reposition (\\d) instead`).exec(txt); if (!m || !this.costOK(t, m[1], g) || t.onVP || t.impaled) continue; const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: Knockdown 대신 Reposition ${m[2]}? [${this.costLbl(m[1])}]`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) { await this.payCost(t, m[1], g); await this.chooseMove(t, +m[2], 'Reposition'); return true; } }
      return false;
    },
    async c4FlyOption(t) {
      for (const g of t.gear) { if (g.discarded) continue; const txt = this.gearText(g, t); const m = new RegExp(`(?:^|\\. )${COST} ?(Skim|Fly): (?:During|Use during) voluntary movement`).exec(txt); if (!m || !m[1] && false) continue; if (!m || !this.costOK(t, m[1], g)) continue; const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: ${m[2]} — 이번 이동에서 지형(Obstacle/Chasm) 무시? [${this.costLbl(m[1])}]`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) { await this.payCost(t, m[1], g); this.say(`${t.name}: ${m[2]}`); return true; } }
      return false;
    },
    terror(t) { return !!(t && t.conditions && (t.conditions.includes('Terror') || t.conditions.includes('Holy Terror'))); },
    curses(t) { return (t.conditions || []).filter(c => ['Goldthirst', 'Windblight', 'Abyss', 'Pursuer'].includes(c)); },
    async randomCurse(t) { const all = ['Goldthirst', 'Windblight', 'Abyss', 'Pursuer'].filter(c => !t.conditions.includes(c)); if (!all.length) { this.say(`${t.name}: 이미 모든 Curse 보유`); return; } const c = this.rng.pick(all); this.say(`${t.name}: 무작위 Curse Affliction → ${c}`, 'bad'); await this.addCurse(t, c); },
    c4TerrorRoll(t, A, rolls) {
      if (!this.terror(t)) return;
      if (rolls.some(r => r.v === 1 && !r.auto)) { A.hits = 0; A.crit = false; this.say(`${t.name}: ${t.conditions.includes('Holy Terror') ? 'Holy Terror' : 'Terror'} — '1'이 나와 공격이 즉시 완전 빗나감`, 'bad'); return; }
      if (t.conditions.includes('Holy Terror') && !rolls.some(r => r.crit && r.v === 10) && A.hits > 0) { A.hits--; this.say(`${t.name}: Holy Terror — Crit Chance 없음, hit 1개 버림 → ${A.hits}`, 'bad'); }
    },
    c4OnWound(t) {
      if (!t || !t.alive) return;
      if (this.terror(t)) { const was = t.conditions.includes('Holy Terror') ? 'Holy Terror' : 'Terror'; t.conditions = t.conditions.filter(c => c !== 'Terror' && c !== 'Holy Terror'); this.say(`${t.name}: Calm as the Sea — ${was} 버리고 Bravery 획득`, 'good'); if (!t.conditions.includes('Bravery')) t.conditions.push('Bravery'); }
    },
    async c4AddCondition(t, name) { // returns true if handled
      if (name === 'Terror' || name === 'Holy Terror') {
        if (t.conditions.includes('Bravery')) { t.conditions = t.conditions.filter(c => c !== 'Bravery'); this.say(`${t.name}: Bravery — ${name} 무시, Bravery 버림`, 'good'); return true; }
        if (this.noInvol(t, `Condition 「${name}」`)) return true;
        if (t.conditions.includes('Holy Terror')) { this.say(`${t.name}: Holy Terror 상태에서 ${name} — 사망`, 'bad'); await this.kill(t); return true; }
        if (t.conditions.includes('Terror') || name === 'Holy Terror') { t.conditions = t.conditions.filter(c => c !== 'Terror'); t.conditions.push('Holy Terror'); this.say(`${t.name}: Holy Terror`, 'bad'); return true; }
        t.conditions.push('Terror'); this.say(`${t.name}: Condition 「Terror」 — Awakening Lock, Precision 보너스 무시, '1'이 나오면 완전 빗나감`, 'bad'); return true;
      }
      if (name === 'Bravery') { const rm = t.conditions.filter(c => ['Fear', 'Dread', 'Terror', 'Holy Terror'].includes(c)); t.conditions = t.conditions.filter(c => !rm.includes(c)); if (!t.conditions.includes('Bravery')) t.conditions.push('Bravery'); this.say(`${t.name}: Bravery${rm.length ? ` — ${rm.join(', ')} 버림` : ''}`, 'good'); return true; }
      if ((name === 'Fear' || name === 'Dread') && false) return true;
      if (['Covetous', 'Greed-crazed', 'Enriched', 'Enlightened', 'Wishkeen', 'Wishagog', 'Float'].includes(name)) { if (name === 'Float') await this.float(t); else await this.midasCondition(t, name); return true; }
      if (name === 'Resolve' || name === 'Lander') { if (this.noInvol(t, `Condition 「${name}」`)) return true; if (!t.conditions.includes(name)) t.conditions.push(name); this.say(`${t.name}: Condition 「${name}」`, 'good'); return true; }
      return false;
    },
    lander(t) { return !!(t && t.onVP && t.conditions && t.conditions.includes('Lander')); },
    c4TurnTriggers(t, add) { if (t.conditions.includes('Abyss')) add(t, 'Abyss Curse: Ambrosia +1', async () => { this.say(`${t.name}: Abyss Curse — Ambrosia +1`, 'bad'); await this.gainAmbrosia(t, 1); }); },
    async c4TurnStart(t) {
      if (t.conditions.includes('Lander')) { t.conditions = t.conditions.filter(c => c !== 'Lander'); this.say(`${t.name}: Lander 버림 (턴 시작)`); }
    },
    async c4TurnEnd(t) {
      if (t.conditions.includes('Pursuer') && t.alive) { if (this.midas(t) > 0) { const has = t.gear.filter(g => (g.midas || 0) > 0); const g = has.length === 1 ? has[0] : await this.ask({ type: 'choice', titan: t, title: 'Pursuer Curse: Ambrosia로 바꿀 Midas 토큰이 있는 카드', options: has.map(x => ({ label: `${x.card.name} (${x.midas})`, value: x })) }); g.midas--; this.midasRemoved(t, 1); await this.ambDirect(t, 1, 'Pursuer Curse (Midas 1 →)'); } else { this.say(`${t.name}: Pursuer Curse — 바꿀 Midas 토큰이 없어 사망`, 'bad'); await this.kill(t, { curse: true }); } }
    },
    wishActions(t) {
      const out = []; if (t.offBoard || this._actor !== t) return out;
      if (t.conditions.includes('Wishkeen') && !t.conditions.includes('Wishagog')) out.push({ label: 'Wishkeen — What You Wish For: Primordial이 나에게 즉시 Signature (살아남으면 Wishkeen 버리고 Enriched + Precision 토큰 1)', noFate: true, value: async () => { t._wishImmune = true; try { await this.safe(() => this.resolveAI(this.sig, { isSignature: true, forcedTarget: t })); } finally { t._wishImmune = false; } if (t.alive && t.conditions.includes('Wishkeen')) { t.conditions = t.conditions.filter(c => c !== 'Wishkeen'); t.tokens.precision += 1; this.say(`${t.name}: 살아남음 — Wishkeen 버리고 Precision +1`, 'good'); await this.midasCondition(t, 'Enriched', true); } } });
      if (t.conditions.includes('Wishagog')) out.push({ label: 'Wishagog — What You Wish For: Primordial이 나에게 AI 카드 (살아남으면 Wishagog 버리고 Enlightened + Precision 토큰 3)', noFate: true, value: async () => { t._wishImmune = true; const c = this.drawAI(); try { if (c) { await this.safe(() => this.resolveAI(c, { forcedTarget: t })); this.ai.discard.push(c); } } finally { t._wishImmune = false; } if (t.alive && t.conditions.includes('Wishagog')) { t.conditions = t.conditions.filter(x => x !== 'Wishagog'); t.tokens.precision += 3; this.say(`${t.name}: 살아남음 — Wishagog 버리고 Precision +3`, 'good'); await this.midasCondition(t, 'Enlightened', true); } } });
      return out;
    },
    async c4RageCheck(t) {
      if (!t || !t.alive || !this.sig) return;
      for (const g of t.gear) { if (g.discarded || g._sigOnce) continue; if (/The Primordial immediately performs Signature against you \(once\)/.test(this.gearText(g, t))) { g._sigOnce = true; this.say(`${g.card.name}: Rage ${t.rage} — ${this.prim.name}이(가) 즉시 Signature를 수행 (1회)`, 'bad'); await this.safe(() => this.resolveAI(this.sig, { isSignature: true, forcedTarget: t })); } }
    },
    c4SobTriggers(t, add) {
      for (const g of t.gear) { if (g.discarded) continue; const tx = this.gearText(g, t);
        if (/Start of Battle: Gain 1 Midas token\./.test(tx)) add(t, `${g.card.name}: Midas 1`, async () => { this.say(`${g.card.name}: 전투 시작 — Midas 1`); await this.safe(() => this.gainMidas(t, 1, true, true)); });
        if (/Start of Battle: Gain the Wishkeen Condition card/.test(tx)) add(t, `${g.card.name}: Wishkeen Condition`, () => this.safe(() => this.midasCondition(t, 'Wishkeen', true)));
        if (/Start of Battle: Gain 1 Ambrosia token or 1 Midas token/.test(tx)) add(t, `${g.card.name}: Ambrosia 1 또는 Midas 1`, async () => { const v = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: 전투 시작 — 선택`, options: [{ label: 'Ambrosia 1', value: 'a' }, { label: 'Midas 1', value: 'm' }] }); if (v === 'm') await this.safe(() => this.gainMidas(t, 1, true, true)); else await this.safe(() => this.gainAmbrosia(t, 1)); });
      }
    },
  });
  const gr = Game.prototype.gainRage; Game.prototype.gainRage = async function (t, ...a) { const r = await gr.call(this, t, ...a); await this.c4RageCheck(t); return r; };
}
