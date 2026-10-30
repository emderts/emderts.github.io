// Cycle V — Titan X (The Devil Himself): Man Among Sheep, Unholy Halo, Flash Step, Feints, Critical Strikes, Pain-based attacks.
import { Board, key, DIRS, DIR_LIST, cellLabel } from './core.js';

export function installTitanX(Game, { TitanDied, BattleOver, ChainBreak }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const TOK = { opening: 'Opening', break: 'Break', fire: 'Fire', black: 'Black', hope: 'Hope', rouse: 'Rouse', closing: 'Closing', diversion: 'Diversion' };

  Object.assign(P, {
    txD() { return !!(this.prim && this.prim.def.txD); },
    async txPain(t, n, why) { if (this.prim.disabled.painX) { this.say(`(Pain X 비활성화 — Pain ${n} 무시)`); return; } await this.gainPain(t, n, why); },
    // ---------- Unholy Halo movement ----------
    async txStep(dir, opts = {}) {
      const na = { c: this.prim.anchor.c + DIRS[dir][0], r: this.prim.anchor.r + DIRS[dir][1] };
      if (this.board.inBounds(na.c, na.r)) { await this.primStep(na, opts.ignore || [], false, false, { noCrash: !!opts.noCrash }); return true; }
      // beyond the edge: Titan X stays, everyone else moves the opposite way
      const od = OPP[dir]; this.say(`Unholy Halo: ${this.prim.name}이(가) 보드 끝 — 다른 타이탄과 지형이 ${od} 방향으로 1칸`, 'ai');
      const ts = this.liveTitans().filter(t => !t.offBoard && !t.onVP && t.pos);
      ts.sort((a, b) => (b.pos.c * DIRS[od][0] + b.pos.r * DIRS[od][1]) - (a.pos.c * DIRS[od][0] + a.pos.r * DIRS[od][1]));
      for (const t of ts) { const q = { c: t.pos.c + DIRS[od][0], r: t.pos.r + DIRS[od][1] }; if (!this.board.inBounds(q.c, q.r)) { this.say(`${t.name}: 하드라이트 판 밖으로 떨어져 익사`, 'bad'); await this.solo(() => this.kill(t)); continue; } if (this.primContains(q)) continue; t.pos = q; }
      const moved = new Map(); for (const [k, z] of this.board.terrain) { const q = { c: z.cell.c + DIRS[od][0], r: z.cell.r + DIRS[od][1] }; if (!moved.has(z.id)) moved.set(z.id, []); moved.get(z.id).push({ z, q }); }
      const nt = new Map(); for (const [id, L] of moved) { if (L.some(x => !this.board.inBounds(x.q.c, x.q.r))) { this.say(`${L[0].z.type}: 판 밖으로 — 제거`); continue; } for (const x of L) nt.set(key(x.q.c, x.q.r), { ...x.z, cell: x.q }); }
      this.board.terrain = nt; this.notify(); return false;
    },
    async txMove(dir, n, opts = {}) { for (let i = 0; i < n; i++) await this.txStep(dir, opts); await this.primEndMove(opts.ignore || []); this.notify(); },
    txDirTo(from, to) { const dx = to.c - from.c, dy = to.r - from.r; return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'N' : 'S'); },
    async txMoveAdj(t) {
      if (!t || !t.pos || t.onVP || this.isAdj(t)) { if (t && t.pos) this.facePrim(t.pos); return; }
      const cand = DIR_LIST.map(d => ({ c: t.pos.c + DIRS[d][0], r: t.pos.r + DIRS[d][1] })).filter(q => this.board.inBounds(q.c, q.r) && !this.titanAt(q.c, q.r) && !this.board.isObstacle(q.c, q.r));
      if (!cand.length) { this.say('(Titan X가 인접할 칸 없음)'); return; }
      const a = this.prim.anchor; const best = cand.reduce((x, y) => Board.dist(y, a) < Board.dist(x, a) ? y : x);
      this.prim.anchor = { ...best }; this.facePrim(t.pos); this.say(`${this.prim.name}: ${t.name}에게 인접 → ${cellLabel(best)}`, 'ai'); this.notify();
    },
    txFlashN() { return Math.max(0, 8 - (this.prim.flashMinus || 0)); },
    async txFlashStep(t) {
      if (!t || !t.alive || !t.pos || t.onVP || t.offBoard) return;
      const dir = this.txDirTo(this.prim.anchor, t.pos); const n = this.txFlashN();
      // move onto the Target's line: first along the main axis to the Target, then past them
      const start = { ...this.prim.anchor }; const axis = DIRS[dir][0] ? 'c' : 'r'; const other = axis === 'c' ? 'r' : 'c';
      this.prim.anchor = { ...this.prim.anchor, [other]: t.pos[other] }; if (this.titanAt(this.prim.anchor.c, this.prim.anchor.r) && this.titanAt(this.prim.anchor.c, this.prim.anchor.r) !== t) this.prim.anchor = { ...start };
      const dist = Math.abs(t.pos[axis] - this.prim.anchor[axis]);
      this.say(`Flash Step: ${this.prim.name}이(가) ${t.name}에게, 그리고 ${n}칸 더 (${dir})`, 'ai');
      for (let i = 0; i < dist + n; i++) { const na = { c: this.prim.anchor.c + DIRS[dir][0], r: this.prim.anchor.r + DIRS[dir][1] }; if (na.c === t.pos.c && na.r === t.pos.r) { this.prim.anchor = na; continue; } await this.txStep(dir, { ignore: [t] }); }
      if (this.titanAt(this.prim.anchor.c, this.prim.anchor.r)) { const back = { c: this.prim.anchor.c - DIRS[dir][0], r: this.prim.anchor.r - DIRS[dir][1] }; if (this.board.inBounds(back.c, back.r) && !this.titanAt(back.c, back.r)) this.prim.anchor = back; }
      await this.primEndMove([t]); if (t.pos) this.facePrim(t.pos); t._flashAdj = this.round + ':' + (this._aiSeq || 0); this.notify();
    },
    // ---------- Feints ----------
    async txFeint(fromAI0 = false) {
      if (this.prim.disabled.feints) { this.say('(Feint 비활성화)'); return; }
      const F = this.prim.feints; if (!F.deck.length) { F.deck = this.rng.shuffle([...F.discard]); F.discard = []; } if (!F.deck.length) { this.say('(Feint 덱 비어 있음)'); return; }
      if (this.trait('Nemesis Vow')) { this.say('Nemesis Vow: Feint 공개 전 — 모든 타이탄 Ambrosia +1', 'bad'); for (const x of this.liveTitans()) await this.solo(() => this.gainAmbrosia(x, 1)); }
      let c = F.deck.shift();
      if (fromAI0 && c.noAI0) { this.say(`Feint 「${c.name}」 — AI 0 효과로 뽑혀 버리고 다시 뽑음`); F.discard.push(c); if (!F.deck.length) { F.deck = this.rng.shuffle([...F.discard]); F.discard = []; } c = F.deck.shift(); if (!c) return; }
      this.flash && this.flash('card', { kind: c.kind === 'status' ? 'STATUS FEINT' : 'EFFECT FEINT', name: c.name, text: c.text, cls: 'obol' });
      this.say(`FEINT 「${c.name}」 (${c.kind === 'status' ? 'Status' : 'Effect'}): ${c.text}`, 'ai');
      if (c.kind === 'status') { if (F.status) F.discard.push(F.status); F.status = c; return; }
      let remove = false; const live = this.liveTitans();
      switch (c.name) {
        case 'Junction Seizure': { const tot = live.reduce((a, x) => a + (x.pain || 0), 0); if (tot >= 10) { for (const x of live) { const n = x.pain || 0; x.pain = 0; if (n) await this.solo(() => this.gainDanger(x, n, { source: 'Junction Seizure' })); } } else for (const x of live) await this.solo(() => this.gainPain(x, 2, 'Junction Seizure')); break; }
        case 'No Rules': { const L = this.argo || []; if (L.length) { const a = this.rng.pick(L); this.argo = L.filter(x => x !== a); this.say(`No Rules: Argo Ability 「${a.card.name}」 제거`, 'bad'); } else this.say('(Argo Ability 없음)'); break; }
        case 'Feint Injury': { const w = this.woundStack.pop(); if (w) { if (w.value > 1) this.woundStack.push({ ...w, value: w.value - 1 }); this.say(`Feint Injury: Titan X Heal 1 (Wound ${this.woundCount()}/${this.prim.wounds})`, 'bad'); } remove = true; break; }
        case 'Mind Games': { this.clearPool(); this.prim.mindGames = true; this.say('Mind Games: Kratos Pool 비움 — 다음에 Kratos Pool에 토큰을 놓을 때 대신 이 카드를 버림', 'bad'); return; }
        case 'Overstep (I)': case 'Overstep (II)': { const tier = c.name.includes('(II)') ? 2 : 1; const b = (this.bpAside || []).find(x => x.overstep && x.tier === tier); if (b) { this.bpAside = this.bpAside.filter(x => x !== b); this.bp.shuffleIn({ ...b }); this.say(`Overstep BP ${tier === 2 ? 'II' : 'I'}를 BP 덱에 섞음`, 'bad'); } remove = true; break; }
      }
      if (!remove) F.discard.push(c);
    },
    async txFullMiss(t) {
      if (!this.txD()) return; const S = this.prim.feints && this.prim.feints.status; if (!S || !t.alive) return;
      if (S.name === 'Met Your Match') { const top = this.bp.peek(); const x = top ? (typeof top.tier === 'number' ? top.tier : 1) : 1; this.say(`Met Your Match: Full Miss — Pain ${x}`, 'bad'); await this.gainPain(t, x, 'Met Your Match'); }
      if (S.name === 'Riposte') { this.say('Riposte: Full Miss — Titan X Signature', 'bad'); await this.safe(() => this.resolveAI(this.sig, { isSignature: true, forcedTarget: t })); }
    },
    async txOverstep(t, A) {
      this.lastBP = A.bp; this.notify(); this.say(`BP 「Overstep」! ${A.bp.text}`, 'bp');
      if (A.crit) { this.say('Crit Chance — 공격 종료, Overstep은 BP 버림 더미로', 'good'); this.bp.discard.push(A.bp); this.clearPool(); t.activeWeapon = null; await this.endAttack(A); return; }
      this.say('Overstep: Crit Chance 없음 — Chain Break, Titan X가 AI로 반격, 카드 제거', 'bad'); this.clearPool(); t.activeWeapon = null; await this.endAttack(A);
      const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c, { forcedTarget: t.alive ? t : null })); if (!c._removed) this.ai.discard.push(c); }
      throw new ChainBreak('Overstep');
    },
    // ---------- targeting ----------
    txPick(lines, exclude = []) {
      const base = () => this.liveTitans().filter(t => !t.offBoard && !exclude.includes(t));
      for (const line of lines || []) {
        let c = base();
        if (/Least Pain/.test(line)) { c = c.filter(t => (t.pain || 0) > 0); const m = Math.min(...c.map(t => t.pain)); c = c.filter(t => t.pain === m); }
        else if (/Zero Pain/.test(line)) c = c.filter(t => !(t.pain > 0));
        else if (/Intermediary/.test(line)) c = c.filter(t => t.intermediary);
        else if (/Priority Target/.test(line)) c = c.filter(t => t.pt);
        else if (/Closest/.test(line)) { const m = Math.min(...c.map(t => this.distTo(t))); c = c.filter(t => this.distTo(t) === m); }
        else if (/Furthest/.test(line)) { const m = Math.max(...c.map(t => this.distTo(t))); c = c.filter(t => this.distTo(t) === m); }
        if (!c.length) continue;
        if (c.length > 1 && /Least Pain|Zero Pain/.test(line)) { const sub = /Closest/.test(lines.join()) ? 'Closest' : /Furthest/.test(lines.join()) ? 'Furthest' : null; void sub; }
        return c;
      }
      return [];
    },
    txTargets(card, forced) {
      if (forced && forced.alive) return [forced];
      let c = this.txPick(card.target); if (!c.length) return [];
      if (c.length > 1 && this.trait('Faster Than Thought')) { this.say(`Faster Than Thought: 동률 ${c.length}명 — 동시 공격 (무작위 순서)`, 'ai'); return this.rng.shuffle([...c]); }
      if (c.length === 1 && this.trait('You Cannot Advance')) { const all = this.liveTitans().filter(t => !t.offBoard); this.say(`You Cannot Advance: 동률 없음 — 모든 타이탄 동시 공격`, 'ai'); return this.rng.shuffle([...all]); }
      return [c.find(t => t.pt) || c[0]];
    },
    async txPre(t, s, card) {
      let m;
      if ((m = /^PAIN (\d+)\+: (.+)$/.exec(s))) { if ((t.pain || 0) >= +m[1]) { this.say(`${t.name}: Pain ${t.pain} (${m[1]}+) — ${m[2]}`, 'bad'); await this.txPre(t, m[2], card); } return; }
      if ((m = /^Lose -(\d) RAGE\.?$/.exec(s))) { const n = Math.min(+m[1], t.rage || 0); t.rage = (t.rage || 0) - n; this.say(`${t.name}: Rage −${n} → ${t.rage}`, 'bad'); return; }
      if ((m = /^Death (\d)\.?$/.exec(s))) { await this.addCondition(t, 'Death', { tokens: +m[1] }); return; }
      if ((m = /^Pain (\d)\.?$/.exec(s))) { await this.txPain(t, +m[1], card.name); return; }
      if (/^Discard 1 Argo Ability\.?$/.test(s)) { const L = this.argo || []; if (!L.length) { this.say('(Argo Ability 없음)'); return; } const a = L.length === 1 ? L[0] : await this.ask({ type: 'choice', titan: t, title: '버릴 Argo Ability', options: L.map(x => ({ label: `${x.card.name} (charge ${x.charges})`, value: x })) }) || L[0]; this.argo = L.filter(x => x !== a); this.say(`Argo Ability 「${a.card.name}」 버림`, 'bad'); return; }
      if (/^This Titan can never Awaken/.test(s)) { t.noAwaken = true; this.say(`${t.name}: 이번 전투에서 각성 불가`, 'bad'); return; }
      if (/^Gain the Fear Condition card\.?$/.test(s)) { await this.addCondition(t, 'Fear'); return; }
      await this.doSentence(t, s, { card });
    },
    async txAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const X = card.tx || {}; this.zoneShow = null;
      if (X.routine) {
        const B = this.board, a = this.prim.anchor; const d = { N: B.rows - a.r, S: a.r - 1, E: B.cols - a.c, W: a.c - 1 }; const m = Math.min(...Object.values(d)); const dir = DIR_LIST.find(x => d[x] === m);
        this.say(`Eyes on the Gleaming Prize: ${this.prim.name}이(가) 가장 가까운 보드 끝(${dir})으로, 모든 타이탄은 반대쪽으로 8칸`, 'ai');
        await this.txMove(dir, m, { noCrash: true }); const od = OPP[dir];
        for (const t of this.liveTitans().filter(t => !t.offBoard && !t.onVP)) await this.solo(() => this.knockback(t, 8, od, true));
        this.faceMost(); this.say('(Argo 자원 손실 — 캠페인)'); return;
      }
      if (X.devil) { this.say('THE DEVIL HIMSELF — Feint', 'ai'); await this.txFeint(true); card._removed = true; this.say('The Devil Himself: AI 카드 한 장 더, 이 카드는 덱에서 제거', 'ai'); const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); } return; }
      const targets = this.txTargets(card, forcedTarget);
      if (!targets.length) { if (card !== this.routine) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); } return; }
      this.say(`타겟: ${targets.map(t => t.name).join(', ')}`);
      const done = [];
      for (const t of targets) {
        if (!t.alive || t.offBoard) continue;
        for (const s of X.pre || []) { await this.solo(() => this.txPre(t, s, card)); if (!t.alive) break; } if (!t.alive) continue;
        let c2 = { ...card }; const F = this.effFate(t);
        if (X.fm && F >= X.fm[0]) { if (X.fm[1] === 'feint') { this.say(`Fate ${X.fm[0]}+: Feint`); await this.txFeint(); } else if (X.fm[1] === 'die') { c2.dice += 1; this.say(`Fate ${X.fm[0]}+: 주사위 +1`); } else if (X.fm[1] === 'diff11') { c2.toHit = 11; this.say(`Fate ${X.fm[0]}+: 난이도 11+`); } }
        if (X.win) await this.reactionWindow(t, card, card.steps[0].replace(/^⚡ /, '').split(' | ')[0]);
        if (!t.alive || t.offBoard) continue;
        if (X.move === 'flash') await this.txFlashStep(t); else if (X.move === 'move') await this.txMoveAdj(t); else if (t.pos && !t.onVP) this.facePrim(t.pos);
        if (!t.alive) continue;
        c2.steps = card.steps.filter(x => !/^(?:⚡ )?(?:FLASH STEP|MOVE|JUDGE|ATTACK)/.test(x));
        if (X.judge) c2 = { ...c2, kind: 'JUDGEMENT', judge: X.judge };
        if (X.doomed) c2.doomed = true;
        if (this.trait('Toying')) { /* handled in primAttackOn0 (−1 die) and txEffect (−1 DANGER per hit) */ }
        t._txHits = 0; const d0 = this.currentAI ? this.currentAI.dangerDealt : 0; const aw0 = !!t.godform;
        try { t._txHits = await this.primAttackOn(t, c2) || 0; } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied) && !e.chainBreak) throw e; if (e.chainBreak) throw e; }
        done.push(t);
        if (card.after && (t.alive || /Awakened and died/.test(card.after))) { if (X.afterWin && t.alive) await this.reactionWindow(t, card, 'After Attack'); this.say(`After Attack: ${card.after}`); if (/Awakened and died/.test(card.after)) { if (!t.alive && aw0) this.say(`${t.name}: 각성 상태로 사망 — 그 각성을 영구히 잃음 (캠페인)`, 'bad'); } else await this.solo(() => this.txAfter(t, card.after, card)); }
      }
      if (card.afterFinal) {
        const last = done[done.length - 1];
        if (X.afterFinalWin && this.liveTitans()[0]) await this.reactionWindow(last && last.alive ? last : this.liveTitans()[0], card, 'After Final Attack');
        this.say(`After Final Attack: ${card.afterFinal}`);
        if (/If the Target is dead, repeat this AI/.test(card.afterFinal)) { if (last && !last.alive && !this._txRepeat) { this._txRepeat = true; try { this.say('The Message is Clear: 타겟 사망 — AI 반복', 'bad'); await this.safe(() => this.txAI(card)); } finally { this._txRepeat = false; } } else if (last && last.alive) await this.solo(() => this.txPushback(last, 9)); }
        else if (/^Pushback (\d+)/.test(card.afterFinal)) { const n = +/^Pushback (\d+)/.exec(card.afterFinal)[1]; for (const t of done) if (t.alive) await this.solo(() => this.txPushback(t, n)); }
      }
    },
    async txPushback(t, n) { if (!t.alive || t.onVP) return; const dir = this.txDirTo(this.prim.anchor, t.pos); await this.knockback(t, n, dir); },
    async txAfter(t, s, card) {
      let m;
      if ((m = /^PAIN (\d+)\+: (.+)$/.exec(s))) { if ((t.pain || 0) >= +m[1]) { this.say(`${t.name}: Pain ${t.pain} (${m[1]}+) — ${m[2]}`, 'bad'); if (/You die/.test(m[2])) await this.kill(t); else await this.doSentence(t, m[2], { card }); } return; }
      if ((m = /^Test (\w+)\/(\w+) \((\d+)\+\)\. Fail: Gain the (\w+) Condition card\.?$/.exec(s))) { const sk = this.skill(t, m[1]) >= this.skill(t, m[2]) ? m[1] : m[2]; const ok = await this.skillTest(t, sk, +m[3]); this.say(`${t.name}: ${sk} ${m[3]}+ — ${ok ? '성공' : '실패'}`, ok ? 'good' : 'bad'); if (!ok) await this.addCondition(t, m[4]); return; }
      if (/^Titan X moves to the furthest Board Edge/.test(s)) { const B = this.board, a = this.prim.anchor; const d = { N: B.rows - a.r, S: a.r - 1, E: B.cols - a.c, W: a.c - 1 }; const mx = Math.max(...Object.values(d)); const dir = DIR_LIST.find(x => d[x] === mx); await this.txMove(dir, mx); this.say(`${this.prim.name}: 가장 먼 보드 끝(${dir})으로`, 'ai'); return; }
      if (/^If your RAGE is lowered to 0, you die/.test(s)) { if ((t.rage || 0) <= 0) { this.say(`${t.name}: Rage 0 — 사망`, 'bad'); await this.kill(t); } return; }
      await this.doEffects(t, s, { card, after: true });
    },
    async txCrit(t, card) {
      const k = card.tx && card.tx.cf; const ck = 's' + (this._aiSeq || 0) + ':' + (this.currentAI ? this.currentAI.dangerDealt : 0); if (!k || !this.trait('Critical Strikes') || t._cfDone === ck) return; t._cfDone = ck;
      const pac = async () => { const ws = t.gear.filter(g => !g.discarded && /^hand/.test(g.card.slot || '') && g.card.name !== 'Fists' && !g.godform); if (!ws.length) { this.say(`${t.name}: 잃을 무기 없음`); return; } const g = ws.length === 1 ? ws[0] : await this.pickGear(t, ws); this.discardGear(t, g); this.say(`${t.name}: Pacify — 「${g.card.name}」 영구 상실`, 'bad'); };
      this.say(`CRITICAL STRIKE (Crit Evade Fail): ${{ cryptex: 'Go for the Cryptex', deadly: 'Deadly Wound', pacify: 'Pacify', mortal: 'Mortal Wound', pacify2: 'Pacify, then Pacify' }[k]}`, 'bad');
      if (k === 'deadly') await this.gainPain(t, 3, 'Deadly Wound');
      else if (k === 'mortal') await this.obolDraw(t, 10);
      else if (k === 'pacify') await pac();
      else if (k === 'pacify2') { await pac(); if (t.alive) await pac(); }
      else if (k === 'cryptex') { const cx = t.gear.filter(g => !g.discarded && /Cryptex/.test(g.card.name + ' ' + (g.card.traits || []).join(' '))); if (cx.length) { for (const g of cx) g.exhausted = true; t.cryptexOff = true; this.say(`${t.name}: Cryptex 비활성화`, 'bad'); } else { t.cryptexOff = true; this.say(`${t.name}: Go for the Cryptex — Cryptex 비활성화 (장비 없음)`); } }
    },
    async txEffect(t, s, hits, card) {
      if (this._critFailT === t) { this._critFailT = null; await this.txCrit(t, card); if (!t.alive) return true; }
      let m; const toy = this.trait('Toying') ? 1 : 0; const dmg = async (d) => { if (toy) { const nd = Math.max(hits, d - hits); if (nd < d) this.say(`Toying: hit당 Danger −1 (${d} → ${nd})`); d = nd; } await this.dealFD(t, 0, d, card, hits); };
      if (/^(?:⚡ )?(?:FLASH STEP|MOVE|JUDGE)/.test(s)) return true;
      if ((m = /^Pain (\d)\. (.+)$/.exec(s))) { await this.txPain(t, +m[1], card.name); if (!t.alive) return true; await this.applyAttackEffect(t, m[2], hits, card); return true; }
      if ((m = /^Each hit deals (\d+) DANGER(?: and Pain (\d))?\.(?: (Knockdown)\.)?$/.exec(s))) { await dmg(+m[1] * hits); if (t.alive && m[2]) await this.txPain(t, +m[2] * hits, card.name); if (t.alive && m[3]) await this.knockdown(t); return true; }
      if ((m = /^Each hit deals (\d+) DANGER\. Knockdown\.$/.exec(s))) { await dmg(+m[1] * hits); if (t.alive) await this.knockdown(t); return true; }
      if ((m = /^One hit deals (\d+) DANGER, Pain (\d); two (?:or more )?hits deal (\d+) DANGER, Pain (\d)(?:; three or more hits deal (\d+) DANGER, Pain (\d))?\.$/.exec(s))) { let d, p; if (hits >= 3 && m[5]) { d = +m[5]; p = +m[6]; } else if (hits >= 2) { d = +m[3]; p = +m[4]; } else { d = +m[1]; p = +m[2]; } if (toy) { const nd = Math.max(1, d - hits); this.say(`Toying: Danger −${d - nd}`); d = nd; } await this.dealFD(t, 0, d, card, hits); if (t.alive) await this.txPain(t, p, card.name); return true; }
      if (/^One hit, gain the Terror Condition card; two hits, gain the Holy Terror Condition card; three or more hits, you die\.$/.test(s)) { if (hits >= 3) { this.say(`${t.name}: ${hits} hit — 사망`, 'bad'); await this.kill(t); } else await this.addCondition(t, hits >= 2 ? 'Holy Terror' : 'Terror'); return true; }
      if (/^One hit, gain the Fear Condition card; two hits/.test(s)) { const L = hits >= 4 ? ['Dread', 'Holy Terror'] : hits === 3 ? ['Dread', 'Terror'] : hits === 2 ? ['Fear', 'Terror'] : ['Fear']; for (const c of L) { if (!t.alive) break; await this.addCondition(t, c); } return true; }
      if (/^For each two hits discard 1 Trespass or Aether token\.$/.test(s)) { const n = Math.floor(hits / 2); for (let i = 0; i < n; i++) { if (t.godform && t.godform.trespass > 0) { t.godform.trespass--; this.say(`${t.name}: Trespass −1`); } else if (t.aether > 0) { t.aether--; this.say(`${t.name}: Aether −1`); } } return true; }
      if (/^If the Attack hits, you die\. If you survive, gain a Fated Mnemos\.$/.test(s)) { if (hits > 0) { this.say(`${t.name}: 피격 — 사망`, 'bad'); await this.kill(t); } return true; }
      if ((m = /^Each hit deals (\d+) DANGER\. Gain as many negative Precision tokens as there are hits\.$/.exec(s))) { await dmg(+m[1] * hits); if (t.alive) { t.tokens.precision -= hits; this.say(`${t.name}: −Precision 토큰 ${hits}`, 'bad'); } return true; }
      if (/^Lose -1 RAGE for each hit\.$/.test(s)) { const n = Math.min(hits, t.rage || 0); t.rage -= n; this.say(`${t.name}: Rage −${n} → ${t.rage}`, 'bad'); return true; }
      if (/^One hit, raise DANGER to 9; two hits, raise DANGER to 9 and draw an Obol; three or more hits, you die\.$/.test(s)) { if (hits >= 3) { this.say(`${t.name}: ${hits} hit — 사망`, 'bad'); await this.kill(t); return true; } if (t.danger < 9) { t.danger = 9; this.say(`${t.name}: Danger 9`, 'bad'); } if (hits >= 2) await this.obolDraw(t, 10); return true; }
      if ((m = /^RAGE (\d)\+: Pain (\d)\.$/.exec(s))) { if ((t.rage || 0) >= +m[1]) await this.txPain(t, +m[2], card.name); return true; }
      if ((m = /^FATE (\d)\+: (Knockdown|Gain the Fear Condition card)\.$/.exec(s))) { if (this.effFate(t) >= +m[1]) { this.say(`Fate ${m[1]}+: ${m[2]}`); if (m[2] === 'Knockdown') await this.knockdown(t); else await this.addCondition(t, 'Fear'); } return true; }
      return false;
    },
    async txAnother(t) { const others = this.liveTitans().filter(x => x !== t && !x.offBoard); if (!others.length) return; const o = await this.ask({ type: 'choice', titan: t, title: '보너스 공격을 할 다른 타이탄', options: [{ label: '안 함', value: null }, ...others.map(x => ({ label: x.name, value: x }))] }); if (o) { this.pendingFollowUp = o; this.say(`${o.name}: 보너스 공격 예약`, 'good'); } },
    async txSentence(t, p, ctx = {}) {
      let m; const alive = !!(t && t.alive);
      if (/^Another Titan may (?:immediately )?perform a Bonus Attack/.test(p)) { await this.txAnother(t); return true; }
      if (/^Feint\.?$/.test(p)) { await this.txFeint(); return true; }
      if (/^Flash Step\.?$/.test(p)) { if (alive) await this.txFlashStep(t); return true; }
      if ((m = /^Pain (\d)\.?$/.exec(p))) { if (alive) await this.txPain(t, +m[1], 'Response'); return true; }
      if ((m = /^Knockback (\d+) to the left\.?$/.exec(p))) { if (alive && !t.onVP) await this.knockback(t, +m[1], this.frame().left); return true; }
      if ((m = /^Titan X moves (\d+) spaces directly away from the Attacker without turning\.?$/.exec(p))) { const f = this.prim.facing; const dir = alive && t.pos && !t.onVP ? this.txDirTo(t.pos, this.prim.anchor) : OPP[f]; await this.txMove(dir, +m[1]); this.prim.facing = f; this.say(`${this.prim.name}: ${dir}로 ${m[1]}칸 (회전 없음)`, 'ai'); return true; }
      if (/^Exhaust your Cryptex\.?$/.test(p)) { if (alive) { const cx = t.gear.filter(g => !g.discarded && /Cryptex/.test(g.card.name)); for (const g of cx) g.exhausted = true; this.say(`${t.name}: Cryptex 소진${cx.length ? '' : ' (없음)'}`); } return true; }
      if (/^Disable the Toying Trait\.?$/.test(p)) { this.prim.disabled['Toying'] = true; this.say('Toying 비활성화', 'good'); return true; }
      return false;
    },
    async txCritical(t, A) {
      const c = A.bp.critical || ''; const parts = (c.match(/[^.!]+[.!]?/g) || []).map(x => x.trim()).filter(Boolean);
      for (const x of parts) {
        if (/^Move Titan X 3 spaces directly backwards/.test(x)) { const f = this.prim.facing; await this.txMove(OPP[f], 3); if (t.alive && t.pos && !t.onVP) await this.txMoveAdj(t); continue; }
        if (/^then move 3 spaces forward/.test(x)) continue;
        if (/^Reduce the amount of spaces Titan X moves past its Target during Flash Step by (\d)/.test(x)) { this.prim.flashMinus = (this.prim.flashMinus || 0) + +/by (\d)/.exec(x)[1]; this.say(`Flash Step 추가 이동 −${/by (\d)/.exec(x)[1]} → ${this.txFlashN()}칸`, 'good'); continue; }
        if (/^Reduce the amount of spaces Titan X moves past its Target during Flash Step to 0/.test(x)) { this.prim.flashMinus = 99; this.say('Flash Step 추가 이동 0칸', 'good'); continue; }
        if (/^Disable the (Critical Strikes|Toying|Killjoy) Trait/.test(x)) { const n = /^Disable the (.+?) Trait/.exec(x)[1]; this.prim.disabled[n] = true; this.say(`${n} 비활성화`, 'good'); continue; }
        if (/^Disable the Pain X keyword/.test(x)) { this.prim.disabled.painX = true; this.say('Pain X 키워드 비활성화', 'good'); continue; }
        if (/^Disable Feints/.test(x)) { this.prim.disabled.feints = true; this.say('Feint 비활성화', 'good'); continue; }
        if (/^Discard all Pain tokens from each Titan/.test(x)) { for (const o of this.liveTitans()) o.pain = 0; this.say('모든 타이탄 Pain 토큰 제거', 'good'); continue; }
        if (/^Until the end of Battle, when attacked from the Blindspot space, Titan X has -1 AT/.test(x)) { this.prim.blindATMalus = (this.prim.blindATMalus || 0) + 1; this.say('Blindspot 공격 시 −1 AT', 'good'); continue; }
        if (/^You may gain \+2 RAGE/.test(x)) { if (t.rage <= 7 && await this.ask({ type: 'yn', titan: t, title: 'Rage +2?', options: [{ label: '예', value: true }, { label: '아니오', value: false }] })) await this.gainRage(t, 2, false); continue; }
        if (/^(?:You may )?perform a Bonus Attack/i.test(x)) { this.pendingFollowUp = t; continue; }
        if (/^Another Titan may (?:immediately )?perform a Bonus Attack/.test(x)) { await this.txAnother(t); continue; }
        if (/^Titan X and all remaining Titans die/.test(x)) { this.say(`${A.bp.name} — Titan X 사망! (남은 타이탄도 사망 — 캠페인)`, 'good'); A.slay = true; continue; }
        if (/^Permanently gain \+1 Fury/.test(x)) { const sk = t.argonaut && t.argonaut.skills; if (sk) sk.Fury = (sk.Fury || 0) + 1; this.say(`${t.name}: Fury +1 (영구)`, 'good'); continue; }
        if (/Secret deck|campaign|Rare resource|Special Event|Mark X1|If you already have it|Lifetime/.test(x)) { this.say(`(${x} — 캠페인 보상)`, 'sys'); continue; }
        this.say(`(Critical 효과 수동 적용 필요: ${x})`, 'sys');
      }
      return true;
    },
  });

  // ---------- wiring ----------
  wrap('trait', function (o, n) { if (this.prim && this.prim.def.txD && n === 'God Among Men') return this.woundStack.length >= 5; if (this.prim && this.prim.def.txD && n === 'Death of Hope' && o.call(this, 'Toying')) return false; return o.call(this, n); });
  wrap('primordialRound', async function (o, ...a) {
    if (!this.txD()) return o.call(this, ...a);
    if (this._gamMid) { this._gamMid = false; this.say('━━ Man Among Sheep: Wound Stack 5장 이상 — 타이탄 2턴 후 Titan X의 AI 카드 ━━', 'hdr'); const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); } return; }
    return o.call(this, ...a);
  });
  wrap('titanRound', async function (o, ...a) {
    const r = await o.call(this, ...a);
    if (this.txD() && this.trait('Death of Hope') && this.liveTitans().length) { this.say('Death of Hope (Titan Round 종료): Signature', 'ai'); await this.safe(() => this.resolveAI(this.sig, { isSignature: true })); }
    return r;
  });
  wrap('gainPain', async function (o, t, n, why) { if (this.txD() && this.trait('Truth of the Shoals') && n > 0) { this.say(`Truth of the Shoals: Pain ${n} → ${n * 2}`); n *= 2; } return o.call(this, t, n, why); });
  wrap('noReroll', function (o, t) { return o.call(this, t) || !!(this.txD() && this.trait('Dazzling Speed') && t && t.pos && !t.onVP && this.inFront(t.pos)); });
  wrap('primLos', function (o, t) { if (this.txD() && t && !t.offBoard) return true; return o.call(this, t); });
  wrap('isAdj', function (o, t) { if (this.txD() && t && t._flashAdj && t._flashAdj === this.round + ':' + (this._aiSeq || 0) && this._aiDepth > 0) return true; return o.call(this, t); });
  wrap('drawAI', function (o) { const S = this.txD() && this.prim.feints && this.prim.feints.status; if (S && S.name === 'Unreadable' && this.ai.cards.length) { const c = this.ai.cards.pop(); this.say(`Unreadable: AI 덱 맨 아래에서 뽑음 — 「${c.name}」`); return c; } return o.call(this); });
  wrap('awaken', async function (o, t, ...r) { if (this.txD() && (this.trait('End of an Age') || (t && t.noAwaken))) { this.say(`${t.name}: ${this.trait('End of an Age') ? 'End of an Age' : 'Deceitful Confession'} — 각성 불가`, 'bad'); return false; } return o.call(this, t, ...r); });
  wrap('titanAttack', async function (o, t, ...r) {
    const S = this.txD() && this.prim.feints && this.prim.feints.status;
    if (S && S.name === 'Blinding Lights' && t && t.pos && !t.onVP && this.inFront(t.pos) && (this.kratosPool.opening || this.kratosPool.closing)) { this.say('Blinding Lights: 정면 — Opening/Closing 토큰 무시', 'bad'); this.kratosPool.opening = 0; this.kratosPool.closing = 0; }
    return o.call(this, t, ...r);
  });
  wrap('secondWindow', async function (o, t, A, ...r) {
    if (!(this.txD() && this.prim.mindGames)) return o.call(this, t, A, ...r);
    const snap = { ...this.kratosPool }; const res = await o.call(this, t, A, ...r);
    if (Object.keys(TOK).some(k => (this.kratosPool[k] || 0) > (snap[k] || 0))) { for (const k of Object.keys(TOK)) this.kratosPool[k] = snap[k] || 0; this.prim.mindGames = false; this.prim.feints.discard.push(this.prim.def.feints.find(f => f.name === 'Mind Games')); this.say('Mind Games: 이번에 Kratos Pool에 놓을 토큰 대신 Mind Games 카드를 버림', 'bad'); }
    return res;
  });
  wrap('applyWound', async function (o, A) {
    const r = await o.call(this, A);
    const S = this.txD() && this.prim.feints && this.prim.feints.status; if (S && S.name === 'Unreadable' && A && A.bp && A.bp.tier === 3) { this.bp.shuffle(); this.say('Unreadable: BP III에 Wound — BP 덱 섞음'); }
    return r;
  });
}
