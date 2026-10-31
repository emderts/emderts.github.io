// Cycle V — Dragon of Phobos: Vanish X, Phobian Hierarchy, Pale Grin, A Truth for a Truth / A Lie for a Truth, Inkblot, Titan Facing.
import { Board, key, DIRS, DIR_LIST, cellLabel } from './core.js';

export function installDragon(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const OFF = { c: -40, r: -40 };
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const PERP = { N: ['E', 'W'], S: ['W', 'E'], E: ['S', 'N'], W: ['N', 'S'] };
  const HIER = ['Holy Terror', 'Terror', 'Dread', 'Fear'];
  const dirTo = (from, to) => { const dx = to.c - from.c, dy = to.r - from.r; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'N' : dy < 0 ? 'S' : (dx >= 0 ? 'E' : 'W')); };
  const man = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

  Object.assign(P, {
    dpD() { return !!(this.prim && this.prim.def.dpD); },
    c5x() { return !!(this.prim && (this.prim.def.dpD || this.prim.def.ufD)); },
    dpTrait(n) { return this.dpD() && this.trait(n) && !this.prim.disabled[n]; },
    // ---------- Titan facing (Cycle V) ----------
    dpCenterCell() { const a = this.prim.offBoard ? this.prim._last : this.prim.anchor; if (!a || a.c < 0) return null; return { c: a.c + 0.5, r: a.r + 0.5 }; },
    dpFace(t) { if (t._face) return t._face; const c = this.dpCenterCell(); return c && t.pos ? dirTo(t.pos, c) : 'N'; },
    dpFaceToward(t) { if (!t || !t.alive || !t.pos || t.onVP || t.offBoard || this.prim.offBoard) return; const c = this.dpCenterCell(); if (c) t._face = dirTo(t.pos, c); },
    dpBehindCell(t, f = this.dpFace(t)) { const d = DIRS[OPP[f]]; return { c: t.pos.c + d[0], r: t.pos.r + d[1] }; },
    dpFromBehind(t) {
      if (!t || !t.pos || t.onVP || this.prim.offBoard) return false;
      if (this.dpTrait('Light Is Dimming') && this.gearLightCount(t) === 0) return true;
      const f = this.dpFace(t); const d = DIRS[f]; const cells = this.primCells(); const b = this.dpBehindCell(t, f);
      if (cells.some(p => p.c === b.c && p.r === b.r)) return true;
      return cells.every(p => (p.c - t.pos.c) * d[0] + (p.r - t.pos.r) * d[1] < 0);
    },
    // ---------- light ----------
    dpLit(p) {
      const here = this.board.terrainAt(p.c, p.r); if (here && here.lightVoid) return false;
      for (const t of this.liveTitans()) { if (!t.pos || t.onVP || t.offBoard) continue; const L = this.lightOf(t); if (L <= 0) continue; const d = DIRS[this.dpFace(t)]; const pr = (p.c - t.pos.c) * d[0] + (p.r - t.pos.r) * d[1]; if (pr >= 0 && man(p, t.pos) <= L) return true; }
      for (const z of this.board.terrain.values()) if (z.light && man(p, z.cell) <= z.light) return true;
      return false;
    },
    dpVanishN(n) { const dead = this.dpTrait('Fat with Fear') ? this.titans.filter(t => !t.alive).length : 0; return Math.max(0, n - dead - (this.prim.vanishMinus || 0)); },
    async dpVanish(n0, who) {
      if (this.prim.offBoard) return; const n = this.dpVanishN(n0);
      if (n0 !== n) this.say(`Vanish ${n0} → ${n} (Fat with Fear/감소)`); if (n <= 0) { this.say('Vanish 0 — 이동 없음'); return; }
      const a = this.prim.anchor, B = this.board; const s = this.prim.size || 2;
      const d = { N: B.rows - (a.r + s - 1), S: a.r - 1, E: B.cols - (a.c + s - 1), W: a.c - 1 };
      let cand = [...DIR_LIST];
      if (who && who.alive && who.pos && !who.onVP && !this.dpTrait('Blacker Than The Night')) { const toward = dirTo({ c: a.c + (s - 1) / 2, r: a.r + (s - 1) / 2 }, who.pos); cand = cand.filter(x => x !== toward); }
      const m = Math.min(...cand.map(x => d[x])); const ties = cand.filter(x => d[x] === m); const dir = ties.length === 1 ? ties[0] : this.rng.pick(ties);
      const f0 = this.prim.facing; this.say(`Vanish ${n}: 가장 가까운 보드 끝(${dir}) 쪽으로${who ? ` (${who.name} 쪽 보드 끝 제외)` : ''}`, 'ai');
      let k = 0;
      for (let i = 0; i < n; i++) {
        const na = { c: this.prim.anchor.c + DIRS[dir][0], r: this.prim.anchor.r + DIRS[dir][1] }; const cs = this.primCells(na);
        if (cs.some(p => !B.inBounds(p.c, p.r))) { if (k) await this.primEndMove([]); this.prim.facing = f0; return this.dpGoOff('보드 끝 너머로 사라짐'); }
        if (!cs.some(p => this.dpLit(p))) { if (k) await this.primEndMove([]); this.prim.facing = f0; return this.dpGoOff('빛의 범위 밖으로 사라짐'); }
        await this.primStep(na, []); k++;
      }
      if (k) await this.primEndMove([]); this.prim.facing = f0; this.say(`Vanish: ${k}칸 → ${cellLabel(this.prim.anchor)} 기준 (회전 없음)`, 'ai'); this.notify();
    },
    async dpGoOff(why) {
      if (this.prim.offBoard) return; this.prim.offBoard = true; this.prim._last = { ...this.prim.anchor }; this.prim.anchor = { ...OFF };
      this.say(`${this.prim.name}: ${why} — 보드 밖 (공격·대상 불가)`, 'ai'); this.notify();
      if (this.dpTrait('A Truth for a Truth')) this.dpTruth(1, '사라짐');
      if (this.dpTrait('Relentless Anxiety')) {
        if ((this._dpChain || 0) >= 4) { this.say('(Relentless Anxiety: 연쇄 한도 4 — 더 이상 AI를 뽑지 않음)', 'sys'); return; }
        this.say('Relentless Anxiety: 사라짐 — 즉시 AI 카드', 'ai'); this._dpChain = (this._dpChain || 0) + 1;
        try { const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); } } finally { this._dpChain--; }
      }
    },
    dpTruth(n, why) { this.prim.truth = (this.prim.truth || 0) + n; const lim = this.dpTrait('A Lie for a Truth') ? 3 : 4; this.say(`${this.dpTrait('A Lie for a Truth') ? 'A Lie for a Truth' : 'A Truth for a Truth'}: 토큰 +${n} (${why}) → ${this.prim.truth}/${lim}`, 'ai'); if (this.prim.truth >= lim) this.prim.truthPending = true; },
    async dpTruthCheck() {
      if (!this.dpD() || !this.prim.truthPending || this._dpTC || !this.liveTitans().length) return; this._dpTC = true;
      try {
        this.prim.truthPending = false; this.prim.truth = 0;
        if (this.dpTrait('A Lie for a Truth')) { this.say('A Lie for a Truth: 토큰 3개 — 버림, Dragon of Phobos 사라짐, AI 카드', 'ai'); await this.dpGoOff('A Lie for a Truth'); }
        else this.say('A Truth for a Truth: 토큰 4개 — 버림, AI 카드', 'ai');
        const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); }
      } finally { this._dpTC = false; }
    },
    // ---------- Hierarchy & targeting ----------
    dpHier(exclude = []) {
      const L = this.liveTitans().filter(t => !t.offBoard && !exclude.includes(t)); if (!L.length) return null;
      const best = c => { const m = Math.max(...c.map(t => t.despair || 0)); const c2 = c.filter(t => (t.despair || 0) === m); return c2.find(t => t.pt) || c2[0]; };
      for (const k of HIER) { const c = L.filter(t => (t.conditions || []).includes(k)); if (c.length) return best(c); }
      const c = L.filter(t => (t.despair || 0) > 0); if (c.length) return best(c);
      return L.find(t => t.pt) || L[0];
    },
    dpPick(lines, exclude = []) {
      for (const line of lines || []) {
        if (line === 'Hierarchy') { const h = this.dpHier(exclude); if (h) return h; continue; }
        const r = this.pickTarget([line], true); if (r && !exclude.includes(r)) return r;
      }
      return null;
    },
    // Phobian Hierarchy: appear behind the Target (else side, then front)
    async dpAppear(t) {
      const f = this.dpFace(t); const B = this.board; const free = p => B.inBounds(p.c, p.r) && !this.titanAt(p.c, p.r) && !B.isObstacle(p.c, p.r);
      const back = this.dpBehindCell(t, f); const sides = PERP[f].map(x => ({ c: t.pos.c + DIRS[x][0], r: t.pos.r + DIRS[x][1] })); const front = { c: t.pos.c + DIRS[f][0], r: t.pos.r + DIRS[f][1] };
      const order = [[back, '뒤'], ...sides.map(s => [s, '옆']), [front, '앞']];
      const anchorsFor = (cell) => { const out = []; const s = this.prim.size || 2; for (let dc = -(s - 1); dc <= 0; dc++) for (let dr = -(s - 1); dr <= 0; dr++) { const a = { c: cell.c + dc, r: cell.r + dr }; const cs = this.primCells(a); if (cs.some(p => !B.inBounds(p.c, p.r) || (p.c === t.pos.c && p.r === t.pos.r))) continue; const occ = cs.filter(p => this.titanAt(p.c, p.r)).length * 10 + cs.filter(p => B.isObstacle(p.c, p.r) || B.isChasm(p.c, p.r)).length; const d = DIRS[f]; const behind = cs.reduce((acc, p) => acc + (p.c - t.pos.c) * d[0] + (p.r - t.pos.r) * d[1], 0); out.push({ a, occ, behind }); } return out; };
      let pick = null, where = '';
      for (let i = 0; i < order.length && !pick; i++) { const [cell, w] = order[i]; if (!B.inBounds(cell.c, cell.r)) continue; if (w !== '앞' && !free(cell)) continue; const L = anchorsFor(cell); if (!L.length) continue; L.sort((x, y) => x.occ - y.occ || (w === '앞' ? y.behind - x.behind : x.behind - y.behind)); if (w !== '앞' && L[0].occ >= 10) continue; pick = L[0].a; where = w; }
      if (!pick) { this.say(`${this.prim.name}: ${t.name} 주변에 나타날 공간 없음 — 가장 가까운 빈 곳`); this.prim.offBoard = false; this.prim.anchor = { ...(this.prim._last || { c: 10, r: 7 }) }; await this.appearAt(t, 'near'); this.facePrim(t.pos); return; }
      this.prim.offBoard = false; this.prim.anchor = { ...pick }; this.facePrim(t.pos);
      this.say(`Phobian Hierarchy: ${this.prim.name}이(가) ${t.name}의 ${where}에 나타남 → ${cellLabel(pick)} 기준 (${this.prim.facing} 방향)`, 'ai'); this.notify();
      for (const p of this.primCells()) { const o = this.titanAt(p.c, p.r); if (o && o !== t && o.alive && !o.onVP) await this.solo(() => this.crashPrim(o)); }
      await this.ukbOverlap([t]);
    },
    async dpMoveTo(t, card) {
      if (!t.pos || t.onVP) return; this.facePrim(t.pos);
      const path = await this.choosePrimPath(t.pos, 99, [t], card); for (const st of path) await this.primStep(st, [t]); await this.primEndMove([]); if (t.pos) this.facePrim(t.pos);
    },
    async dpInkblot() {
      if (this.prim.offBoard) return; if (this.prim.disabled.inkblot) { this.say('(Inkblot 비활성화)'); return; }
      const cells = this.primCells().filter(p => this.board.inBounds(p.c, p.r) && !this.board.terrainAt(p.c, p.r)); if (!cells.length) { this.say('(Inkblot: 빈 칸 없음)'); return; }
      const id = 'ink' + (this._inkN = (this._inkN || 0) + 1); for (const q of cells) this.board.terrain.set(key(q.c, q.r), { id, type: 'Inkblot', obstacle: false, obscuring: true, destructible: false, indestructible: true, cloud: true, ambrosia: true, cell: { ...q } });
      this.say(`Inkblot: ${cells.map(cellLabel).join(', ')}에 Inkblot (Ambrosia Cloud) 배치`, 'ai'); this.notify();
    },
    async dpDiscardLight(t) {
      if (!t || !t.alive) return; const L = t.gear.filter(g => !g.discarded && typeof this.kwLight(g, t) === 'number'); if (!L.length) { this.say(`${t.name}: Light X 장비 없음`); return; }
      const mx = Math.max(...L.map(g => this.kwLight(g, t))); const c = L.filter(g => this.kwLight(g, t) === mx); const g = c.length === 1 ? c[0] : await this.pickGear(t, c) || c[0];
      this.discardGear(t, g); this.say(`${t.name}: Light ${mx} 장비 「${g.card.name}」 버림`, 'bad');
    },
    kwLight(g, t) { const m = /(?:^|[^\w])Light (\d+)/.exec(this.gearText(g, t)); return m ? +m[1] : null; },
    dpPhobia(t) { if (!t || !t.alive) return; t.phobias = (t.phobias || 0) + 1; this.say(`${t.name}: 무작위 Phobia Affliction 획득 (캠페인 — 전투 효과 수동 확인)`, 'bad'); },
    async dpBothDie(t) { this.say(`${t.name}: 타이탄과 Argonaut 모두 사망 (Argonaut 사망 — 캠페인)`, 'bad'); t.argoDied = true; await this.kill(t); },
    // ---------- AI ----------
    async dpPre(t, s, card) {
      let m;
      if (/^Inkblot\.?$/.test(s)) { await this.dpInkblot(); return; }
      if (/^FATE 7\+: You die instead\.?$/.test(s)) return;
      if ((m = /^Gain (\d) Despair tokens?\.?$/.exec(s))) { await this.gainDespair(t, +m[1]); return; }
      if ((m = /^Gain the (Holy Terror|Terror|Fear|Dread) Condition card\.?$/.exec(s))) { await this.addCondition(t, m[1]); return; }
      await this.doSentence(t, s, { card });
    },
    async dpAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const D = card.dp || {}; this.zoneShow = null;
      if (D.routine) {
        this.say('Churning Black: 모든 타이탄 Oxygen 1개와 Light X가 가장 높은 장비 버림 → Dragon of Phobos 사라짐', 'ai');
        for (const t of [...this.liveTitans()]) await this.solo(async () => { await this.discardOxygen(t, 1, 'Churning Black'); if (t.alive) await this.dpDiscardLight(t); });
        await this.dpGoOff('Churning Black'); return;
      }
      const off = this.prim.offBoard && this.dpTrait('Phobian Hierarchy');
      let t = forcedTarget && forcedTarget.alive && !forcedTarget.offBoard ? forcedTarget : off ? this.dpHier() : this.dpPick(card.target);
      if (!t) { if (card !== this.routine) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); } return; }
      this.say(`타겟${off ? ' (Hierarchy — 보드 밖)' : ''}: ${t.name}`);
      const F = this.effFate(t);
      if ((D.pre || []).includes('FATE 7+: You die instead.') && F >= 7) { for (const s of D.pre) if (/Despair/.test(s)) await this.solo(() => this.dpPre(t, s, card)); if (t.alive) { this.say(`Fate 7+: ${t.name} 사망 (The Ur-Call)`, 'bad'); await this.solo(() => this.kill(t)); } return; }
      let inkLater = false;
      for (const s of D.pre || []) { if (/^Inkblot/.test(s) && this.prim.offBoard) { inkLater = true; continue; } await this.solo(() => this.dpPre(t, s, card)); if (!t.alive) return; }
      if (D.fm && F >= D.fm[0]) {
        if (D.fm[1] === 'phobia') { this.say(`Fate ${D.fm[0]}+: 무작위 Phobia`); this.dpPhobia(t); }
        else if (D.fm[1] === 'paling') { this.say(`Fate ${D.fm[0]}+: 다른 모든 타이탄 Holy Terror`, 'bad'); for (const o of this.liveTitans()) if (o !== t) await this.solo(() => this.addCondition(o, 'Holy Terror')); }
      }
      if (this.prim.offBoard) {
        if (!this.dpTrait('Phobian Hierarchy')) { this.say('(보드 밖 — 공격 불가)'); return; }
        await this.dpAppear(t); if (!t.alive) return;
      } else {
        if (D.win) { await this.reactionWindow(t, card, card.steps[0].replace(/^⚡ /, '').split(' | ')[0]); if (!t.alive || t.offBoard) return; }
        if (D.move) await this.dpMoveTo(t, card); else if (t.pos && !t.onVP) this.facePrim(t.pos);
      }
      if (inkLater) await this.dpInkblot();
      if (!t.alive || this.prim.offBoard) return;
      let c2 = { ...card, steps: card.steps.map(x => x.replace(/^⚡ (MOVE|JUDGE)/, '$1')) };
      if (D.judge) c2 = { ...c2, kind: 'JUDGEMENT', judge: D.judge };
      if (D.doomed) c2.doomed = true;
      const behind = this.dpFromBehind(t);
      if (behind && this.dpTrait('Pale Grin of Death')) { this.say(`Pale Grin of Death: ${t.name} 뒤에서 공격받음 — 회피 굴림 없이 집어삼켜짐 (사망)`, 'bad'); await this.solo(() => this.kill(t)); return; }
      if (behind && this.dpTrait('Pale Grin of Doom')) { t._dpAuto = true; this.say(`Pale Grin of Doom: ${t.name} 뒤에서 공격받음 — 회피 굴림 없이 자동 hit`, 'bad'); }
      let hits = 0; try { hits = await this.primAttackOn(t, c2) || 0; } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied) && !e.chainBreak) throw e; if (e.chainBreak) throw e; } finally { t._dpAuto = false; }
      if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); }
      if (card.after) {
        if (D.afterWin && this.liveTitans().length) await this.reactionWindow(t.alive ? t : this.liveTitans()[0], card, 'After Attack');
        this.say(`After Attack: ${card.after}`); await this.solo(() => this.dpAfter(t, card.after, card));
      }
      void hits; void isSignature;
    },
    async dpAfter(t, s, card) {
      for (const q of (s.match(/[^.]+\.?/g) || []).map(x => x.trim()).filter(Boolean)) {
        let m;
        if (/^Inkblot\.?$/.test(q)) await this.dpInkblot();
        else if ((m = /^Vanish (\d+)\.?$/.exec(q))) await this.dpVanish(+m[1], t);
        else if (/^Knockdown\.?$/.test(q)) { if (t.alive && !t.onVP) await this.knockdown(t); }
        else await this.doEffects(t, q, { card, after: true });
      }
    },
    async dpEffect(t, s, hits, card) {
      let m; const D = card; const F = this.effFate(t); const deal = (d, extra = {}) => this.dealFD(t, 0, d, D, hits, null, extra);
      if (/^(?:MOVE|JUDGE|ATTACK)/.test(s)) return true;
      { const im = /^(.*?) \| FATE (\d)\+: (.*?)(?: instead)?$/.exec(s); if (im && !/^(MOVE|JUDGE)/.test(s)) {
          if (/^(\d) DANGER$/.test(im[3]) && F >= +im[2]) { const nm = /^Each hit deals (\d) DANGER and (\d) (Despair|Ambrosia) tokens?\.?$/.exec(im[1]); if (nm) { this.say(`Fate ${im[2]}+: hit당 ${im[3]}`); await deal(+/^(\d)/.exec(im[3])[1] * hits); if (t.alive) await (nm[3] === 'Despair' ? this.gainDespair(t, +nm[2] * hits) : this.gainAmbrosia(t, +nm[2] * hits)); return true; } }
          if (/^Gain the Holy Terror Condition card$/.test(im[3]) && F >= +im[2]) { const x = im[1].replace(/the Terror Condition card/, 'the Holy Terror Condition card'); this.say(`Fate ${im[2]}+: Holy Terror로 대신`); await this.applyAttackEffect(t, x, hits, card); return true; }
          if (/If you draw a You Live! Obol, ignore the result and redraw/.test(im[3])) { if (F >= +im[2]) { this._dpNoLive = true; this.say(`Fate ${im[2]}+: You Live! Obol은 무시하고 다시 뽑음`, 'bad'); } try { await this.applyAttackEffect(t, im[1], hits, card); } finally { this._dpNoLive = false; } return true; }
          await this.applyAttackEffect(t, im[1], hits, card); return true; } }
      if ((m = /^FATE (\d)\+: (.+)$/.exec(s))) { if (F >= +m[1]) { this.say(`Fate ${m[1]}+: ${m[2]}`); await this.applyAttackEffect(t, m[2], hits, card); } return true; }
      if ((m = /^Each hit deals (\d+) DANGER(?: and (\d) (Ambrosia|Despair) tokens?)?\.$/.exec(s))) { await deal(+m[1] * hits); if (t.alive && m[2]) await (m[3] === 'Despair' ? this.gainDespair(t, +m[2] * hits) : this.gainAmbrosia(t, +m[2] * hits)); return true; }
      if ((m = /^(Two|Three|Four) or more hits, additionally (?:gain the (\w[\w ]*?) Condition card|flip 1 Oxygen token)\.$/.exec(s))) { const n = { Two: 2, Three: 3, Four: 4 }[m[1]]; if (hits >= n) { if (m[2]) await this.addCondition(t, m[2]); else await this.flipOxygen(t, 1, card.name); } return true; }
      if ((m = /^Four or more hits, additionally flip 1 Oxygen token\.$/.exec(s))) { if (hits >= 4) await this.flipOxygen(t, 1, card.name); return true; }
      if ((m = /^One hit deals (\d+) DANGER and (\d) Ambrosia tokens?, two or more hits deal (\d+) DANGER and (\d) Ambrosia tokens\.$/.exec(s))) { const two = hits >= 2; await deal(two ? +m[3] : +m[1]); if (t.alive) await this.gainAmbrosia(t, two ? +m[4] : +m[2]); return true; }
      if ((m = /^If the Attack hits, it deals (\d+) DANGER and gain (\d) Ambrosia tokens?\. Two or more hits, additionally gain the (\w+) Condition card\.$/.exec(s))) { await deal(+m[1]); if (t.alive) await this.gainAmbrosia(t, +m[2]); if (t.alive && hits >= 2) await this.addCondition(t, m[3]); return true; }
      if ((m = /^Knockdown\. Each hit deals (\d) DANGER and 1 Despair token\. Three or more hits, additionally flip 1 Oxygen token\.$/.exec(s))) { await this.knockdown(t); if (!t.alive) return true; await deal(+m[1] * hits); if (t.alive) await this.gainDespair(t, hits); if (t.alive && hits >= 3) await this.flipOxygen(t, 1, card.name); return true; }
      if ((m = /^Gain (\d) Ambrosia tokens and the (Terror|Holy Terror) Condition card\.$/.exec(s))) { await this.gainAmbrosia(t, +m[1]); if (t.alive) await this.addCondition(t, m[2]); return true; }
      if (/^One hit, gain the Terror Condition card; two hits, gain the Holy Terror Condition card; three or more hits, gain a random Phobia Affliction and die\.$/.test(s)) { if (hits >= 3) { this.dpPhobia(t); await this.kill(t); } else await this.addCondition(t, hits >= 2 ? 'Holy Terror' : 'Terror'); return true; }
      if (/^One hit, gain the Terror Condition card; two hits, gain the Holy Terror Condition card; three hits, you die; four or more hits, the Titan and the Argonaut die\.$/.test(s)) { if (hits >= 4) await this.dpBothDie(t); else if (hits === 3) { this.say(`${t.name}: 3 hit — 사망`, 'bad'); await this.kill(t); } else await this.addCondition(t, hits >= 2 ? 'Holy Terror' : 'Terror'); return true; }
      if (/^One hit, gain the Holy Terror Condition card; two hits, you die; three or more hits, the Titan and the Argonaut die\.$/.test(s)) { if (hits >= 3) await this.dpBothDie(t); else if (hits === 2) { this.say(`${t.name}: 2 hit — 사망`, 'bad'); await this.kill(t); } else await this.addCondition(t, 'Holy Terror'); return true; }
      if ((m = /^Pushback (\d+)\.$/.exec(s))) { if (!t.onVP) await this.knockback(t, +m[1], this.awayDir(t.pos, this.primCells())); return true; }
      if (/^One hit deals 3 DANGER and 1 Ambrosia token; two hits deal 5 DANGER, 2 Ambrosia tokens and 1 Despair token; three or more hits deal 5 DANGER, 3 Ambrosia tokens and 2 Despair tokens\.$/.test(s)) { const [d, a, p] = hits >= 3 ? [5, 3, 2] : hits === 2 ? [5, 2, 1] : [3, 1, 0]; await deal(d); if (t.alive) await this.gainAmbrosia(t, a); if (t.alive && p) await this.gainDespair(t, p); return true; }
      if (/^Gain as many Despair tokens as there are hits\.$/.test(s)) { await this.gainDespair(t, hits); return true; }
      if (/^If the Attack hits, raise DANGER to 9 and draw an Obol\.$/.test(s)) { if (t.danger < 9) { t.danger = 9; this.say(`${t.name}: Danger 9`, 'bad'); } await this.obolDraw(t, 10); return true; }
      if ((m = /^Gain (\d) Ambrosia tokens\. Each hit deals (\d) DANGER\.$/.exec(s))) { await this.gainAmbrosia(t, +m[1]); if (t.alive) await deal(+m[2] * hits); return true; }
      if (/^Each Titan discards a Gear card with the highest Light X keyword\.$/.test(s)) { for (const o of this.liveTitans()) await this.solo(() => this.dpDiscardLight(o)); return true; }
      if (/^Discard 1 Oxygen or Aether token per 2 hits\.$/.test(s)) { const n = Math.floor(hits / 2); for (let i = 0; i < n; i++) { if (!t.alive) break; if ((t.oxygen || 0) > 0 && (t.aether || 0) > 0) { const k = await this.ask({ type: 'choice', titan: t, title: `Drainage of Hope: 버릴 토큰 (${i + 1}/${n})`, options: [{ label: `Aether (${t.aether})`, value: 'a' }, { label: `Oxygen (${t.oxygen})`, value: 'o' }] }); if (k === 'o') await this.discardOxygen(t, 1, card.name); else this.discardAether(t, 1); } else if ((t.aether || 0) > 0) this.discardAether(t, 1); else await this.discardOxygen(t, 1, card.name); } return true; }
      if (/^If the Attack hits, you die\.$/.test(s)) { this.say(`${t.name}: 피격 — 사망`, 'bad'); await this.kill(t); return true; }
      if ((m = /^Flip (\d) Oxygen tokens?\.$/.exec(s))) { await this.flipOxygen(t, +m[1], card.name); return true; }
      if ((m = /^Gain (\d) Despair tokens?\.$/.exec(s))) { await this.gainDespair(t, +m[1]); return true; }
      if ((m = /^Gain the (Holy Terror|Terror|Fear|Dread) Condition card\.$/.exec(s))) { await this.addCondition(t, m[1]); return true; }
      if (/^Knockdown\.$/.test(s)) { await this.knockdown(t); return true; }
      { const parts = (s.match(/[^.]+\.?/g) || []).map(x => x.trim()).filter(Boolean); if (parts.length > 1) { for (const q of parts) { await this.applyAttackEffect(t, q, hits, card); if (!t.alive) throw new TitanDied(t); } return true; } }
      return false;
    },
    async dpSentence(t, p, ctx = {}) {
      let m; const alive = !!(t && t.alive);
      if (/^(?:⚡ )?Inkblot\.?$/.test(p)) { await this.dpInkblot(); return true; }
      if ((m = /^(?:⚡ )?Vanish (\d+)\.?$/.exec(p))) { await this.dpVanish(+m[1], alive ? t : null); return true; }
      if (/^Inkblot\. (?:⚡ )?Vanish (\d+)\.?$/.test(p)) { const n = +/Vanish (\d+)/.exec(p)[1]; await this.dpInkblot(); await this.dpVanish(n, alive ? t : null); return true; }
      if (/^Gain DANGER equal to the Primordial level\.?$/.test(p)) { if (alive) await this.gainDanger(t, this.prim.level, { source: 'BP' }); return true; }
      if ((m = /^Gain (1) Despair token and \+(\d) DANGER\.?$/.exec(p))) { if (alive) { await this.gainDespair(t, +m[1]); if (t.alive) await this.gainDanger(t, +m[2], { source: 'Full Miss' }); } return true; }
      if ((m = /^Gain the (Terror|Holy Terror) Condition card and \+(\d) DANGER\.?$/.exec(p))) { if (alive) { await this.addCondition(t, m[1]); if (t.alive) await this.gainDanger(t, +m[2], { source: 'Full Miss' }); } return true; }
      if ((m = /^Gain the (Holy Terror|Terror|Fear|Dread) Condition card\.?$/.exec(p))) { if (alive) await this.addCondition(t, m[1]); return true; }
      if (/^Gain a random Phobia Affliction and die\.?$/.test(p)) { if (alive) { this.dpPhobia(t); this.say(`${t.name}: 사망`, 'bad'); await this.kill(t); } return true; }
      if (/^Die\.?$/.test(p)) { if (alive) { this.say(`${t.name}: 사망`, 'bad'); await this.kill(t); } return true; }
      if ((m = /^Gain the (Fear|Terror) Condition card and \+1 DANGER\.?$/.exec(p))) { if (alive) { await this.addCondition(t, m[1]); if (t.alive) await this.gainDanger(t, 1, { source: 'BP' }); } return true; }
      if (/^Gain DANGER equal to the Primordial level and the Dread Condition card\.?$/.test(p)) { if (alive) { await this.gainDanger(t, this.prim.level, { source: 'BP' }); if (t.alive) await this.addCondition(t, 'Dread'); } return true; }
      if (/^Gain a random Phobia Affliction\.?$/.test(p)) { this.dpPhobia(t); return true; }
      if (/^Gain the Terror Condition card and (?:DANGER|Λ) equal to the Primordial level\.?$/.test(p)) { if (alive) { await this.addCondition(t, 'Terror'); if (t.alive) await this.gainDanger(t, this.prim.level, { source: 'BP' }); } return true; }
      if (/^Pushback 3, perform Signature against the Attacker\.?$/.test(p)) { if (alive && !t.onVP && !this.prim.offBoard) await this.knockback(t, 3, this.awayDir(t.pos, this.primCells())); if (t && t.alive) await this.safe(() => this.resolveAI(this.sig, { isSignature: true, forcedTarget: t })); return true; }
      if (/^During the second ability window, turn all your Despair tokens into Hope tokens or place 2 Hope tokens in the Kratos Pool\.?$/.test(p)) { if (!alive) return true; const n = t.despair || 0; const v = n > 2 ? 'd' : await this.ask({ type: 'choice', titan: t, title: 'Doom-Shaped Heart: Despair → Hope, 또는 Hope 2개', options: [{ label: `Despair ${n}개를 모두 Hope로`, value: 'd' }, { label: 'Kratos Pool에 Hope 2개', value: 'h' }] }); if (v === 'd') { t.despair = 0; this.kratosPool.hope = (this.kratosPool.hope || 0) + n; this.say(`${t.name}: Despair ${n} → Hope ${n}`, 'good'); } else { this.kratosPool.hope = (this.kratosPool.hope || 0) + 2; this.say('Kratos Pool: Hope +2', 'good'); } return true; }
      if (/^Discard up to 3 Ambrosia and\/or Despair tokens\.?$/.test(p)) { if (!alive) return true; let left = 3; while (left > 0 && ((t.ambrosia || 0) + (t.despair || 0)) > 0) { const v = await this.ask({ type: 'choice', titan: t, title: `Antediluvian Tooth: 토큰 버리기 (남은 ${left})`, options: [...(t.despair ? [{ label: `Despair (${t.despair})`, value: 'd' }] : []), ...(t.ambrosia ? [{ label: `Ambrosia (${t.ambrosia})`, value: 'a' }] : []), { label: '그만', value: null }] }); if (!v) break; if (v === 'd') t.despair--; else t.ambrosia--; left--; } this.say(`${t.name}: 토큰 ${3 - left}개 버림`, 'good'); return true; }
      if (/[.] /.test(p) && /Vanish|Inkblot|Phobia/.test(p)) { for (const q of (p.match(/[^.]+\.?/g) || []).map(x => x.trim()).filter(Boolean)) await this.doSentence(t, q, ctx); return true; }
      return false;
    },
    async dpCritical(t, A) {
      const c = A.bp.critical || ''; const parts = (c.match(/[^.!]+[.!]?/g) || []).map(x => x.trim()).filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        const x = parts[i]; let m;
        if ((m = /^Reduce Vanish by (\d)(?: and perform a Bonus Attack)?/.exec(x))) { this.prim.vanishMinus = (this.prim.vanishMinus || 0) + +m[1]; this.say(`Vanish 영구 −${m[1]} (누적 −${this.prim.vanishMinus})`, 'good'); if (/Bonus Attack/.test(x)) this.pendingFollowUp = t; continue; }
        if ((m = /^Disable the (Pale Grin of Doom|Blacker Than the Night) Trait/.exec(x))) { const n = m[1] === 'Blacker Than the Night' ? 'Blacker Than The Night' : m[1]; if (n === 'Blacker Than The Night' && !this.trait(n)) { this.say('Blacker Than the Night 없음 — 대신 보너스 공격', 'good'); this.pendingFollowUp = t; i++; continue; } this.prim.disabled[n] = true; this.say(`${n} 비활성화`, 'good'); if (/If it's not in play/.test(parts[i + 1] || '')) i++; continue; }
        if (/^Disable the Inkblot keyword/.test(x)) { this.prim.disabled.inkblot = true; this.say('Inkblot 비활성화', 'good'); continue; }
        if (/^Disable gaining Ambrosia tokens/.test(x)) { this.prim.disabled.ambGain = true; this.say('Ambrosia 토큰 획득 비활성화', 'good'); continue; }
        if (/^Disable the effects of Despair tokens/.test(x)) { this.prim.disabled.despairFx = true; this.say('Despair 토큰 효과 비활성화', 'good'); continue; }
        if ((m = /^Disable (Fear and Dread|Terror and Holy Terror) Condition card effects/.exec(x))) { const L = m[1] === 'Fear and Dread' ? ['Fear', 'Dread'] : ['Terror', 'Holy Terror']; this.prim.dpNoCond = [...(this.prim.dpNoCond || []), ...L]; for (const o of this.liveTitans()) o.conditions = o.conditions.filter(k => !L.includes(k)); this.say(`${L.join('/')} 효과 비활성화 — 모든 타이탄의 해당 Condition 버림`, 'good'); continue; }
        if (/^Discard all .* Condition cards from all Titans/.test(x)) continue;
        if ((m = /^You may discard (all|1) Despair tokens? and perform a Bonus Attack/.exec(x))) { const ok = await this.ask({ type: 'yn', titan: t, title: `${A.bp.name}: Despair ${m[1] === 'all' ? '전부' : '1개'} 버리고 보너스 공격?`, options: [{ label: '예', value: true }, { label: '아니오', value: false }] }); if (ok) { if (m[1] === 'all') t.despair = 0; else t.despair = Math.max(0, (t.despair || 0) - 1); this.pendingFollowUp = t; } continue; }
        if (/^The Dragon of Phobos dies/.test(x)) { this.say(`${A.bp.name} — ${this.prim.name} 즉사!`, 'good'); A.slay = true; continue; }
        if (/^(?:You may )?perform a Bonus Attack/i.test(x)) { this.pendingFollowUp = t; continue; }
        if (/Secret deck|campaign|Special Event|permanent|Lifetime|Divine resource|Gain \+1/.test(x)) { this.say(`(${x} — 캠페인 보상)`, 'sys'); continue; }
        this.say(`(Critical 효과 수동 적용 필요: ${x})`, 'sys');
      }
      return true;
    },
    async dpFullMiss(t) {
      if (!this.dpD() || !t || !t.alive) return; let top = this.bp.peek(); if (!top && this.bp.discard.length) { this.bp.shuffleDiscardIn(); top = this.bp.peek(); } if (!top || !top.fullMiss) return;
      this.say(`FULL MISS — BP 덱 맨 위 카드 뒷면 (BP ${'I'.repeat(top.tier)}): ${top.fullMiss}`, 'bad');
      if (/^Perform AI against the Attacker/.test(top.fullMiss)) { const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c, { forcedTarget: t })); if (!c._removed) this.ai.discard.push(c); } return; }
      await this.doEffects(t, top.fullMiss, { response: true });
    },
    // Dragon of the Lightless Void: Kratos Pool use capped by Light X
    dpVoidCap(t) {
      if (!this.dpTrait('Dragon of the Lightless Void')) return null; const K = this.kratosPool; const L = this.lightOf(t); const save = { cut: {} }; const cutK = k => { K[k]--; save.cut[k] = (save.cut[k] || 0) + 1; };
      let oc = (K.opening || 0) + (K.closing || 0); let cut = []; while (oc > L) { if (K.closing > 0) cutK('closing'); else cutK('opening'); oc--; cut.push('O/C'); }
      let bf = ['break', 'fire', 'black', 'hope'].reduce((a, k) => a + (K[k] || 0), 0); for (const k of ['hope', 'black', 'fire', 'break']) while (bf > L && K[k] > 0) { cutK(k); bf--; cut.push(k); }
      if (cut.length) this.say(`Dragon of the Lightless Void: Light ${L} — Kratos Pool 토큰 ${cut.length}개 사용 불가 (공격 후 복원)`, 'bad');
      return cut.length ? save : null;
    },
  });

  // ---------- wiring ----------
  wrap('startOfBattle', async function (o, ...a) {
    if (this.dpD()) {
      for (const t of this.titans) if (t.alive && t.pos) this.dpFaceToward(t);
      if (this.trait('Original Trench')) { this.board.allChasm = 'empty'; for (const z of this.board.terrain.values()) z.elevated = true; }
    }
    const r = await o.call(this, ...a);
    if (this.dpD() && this.trait('Fear is Constant')) {
      const live = [...this.liveTitans()]; const pick = async (title, list) => list.length <= 1 ? list[0] : (await this.ask({ type: 'choice', title, options: list.map(x => ({ label: x.name, value: x })) }) || list[0]);
      const a1 = await pick('Fear is Constant: Fear Condition을 받을 타이탄', live); if (a1) { await this.solo(() => this.addCondition(a1, 'Fear')); }
      const a2 = await pick('Fear is Constant: Terror Condition을 받을 다른 타이탄', live.filter(x => x !== a1)); if (a2) await this.solo(() => this.addCondition(a2, 'Terror'));
      const a3 = await pick('Fear is Constant: Oxygen 1개를 뒤집을 세 번째 타이탄', live.filter(x => x !== a1 && x !== a2)); if (a3) await this.solo(() => this.flipOxygen(a3, 1, 'Fear is Constant'));
    }
    return r;
  });
  wrap('resolveAI', async function (o, card, ...r) {
    if (!this.dpD()) return o.call(this, card, ...r);
    this._dpAID = (this._dpAID || 0) + 1; let res;
    try { res = await o.call(this, card, ...r); } finally { this._dpAID--; }
    if (!this._dpAID) await this.dpTruthCheck();
    return res;
  });
  wrap('titanAttack', async function (o, t, ...r) {
    if (!this.dpD()) return o.call(this, t, ...r);
    this.dpFaceToward(t); const save = this.dpVoidCap(t);
    try { return await o.call(this, t, ...r); } finally {
      if (save) { const K = this.kratosPool; const any = Object.keys(K).some(k => typeof K[k] === 'number' && K[k] > 0); if (any) for (const k of ['opening', 'closing', 'break', 'fire', 'black', 'hope']) K[k] = (K[k] || 0) + (save.cut[k] || 0); }
      await this.dpTruthCheck();
    }
  });
  wrap('chooseMove', async function (o, t, ...r) { const res = await o.call(this, t, ...r); if (this.dpD() && t && t.alive) this.dpFaceToward(t); return res; });
  wrap('titanTurn', async function (o, t, ...r) {
    if (this.c5x() && t && t.alive && this.trait('Psychosomatic Poisoning') && (t.conditions || []).length) { this.say(`Psychosomatic Poisoning: ${t.name} Condition 카드를 가진 채 턴 시작 — Ambrosia +1`, 'bad'); await this.solo(() => this.gainAmbrosia(t, 1)); if (!t.alive) return; }
    try { return await o.call(this, t, ...r); } finally { if (this.dpD() && t && t.alive) this.dpFaceToward(t); }
  });
  wrap('addCondition', async function (o, t, name, ...r) {
    if (this.c5x() && (this.prim.dpNoCond || []).includes(name)) { this.say(`${t.name}: ${name} — 효과 비활성화됨 (받지 않음)`, 'good'); return; }
    const had = t && (t.conditions || []).length; const res = await o.call(this, t, name, ...r);
    if (this.c5x() && t && t.alive && this.trait('Psychosomatic Poisoning') && (t.conditions || []).length > had) { this.say(`Psychosomatic Poisoning: ${t.name} Condition 획득 — Ambrosia +1`, 'bad'); await this.gainAmbrosia(t, 1); }
    return res;
  });
  wrap('gainAmbrosia', async function (o, t, n, ...r) { if (this.c5x() && this.prim.disabled.ambGain && n > 0) { this.say(`${t.name}: Ambrosia 획득 비활성화 (Ambrosia Ink Sac)`, 'good'); return; } return o.call(this, t, n, ...r); });
  wrap('despairEff', function (o, t) { if (this.c5x() && this.prim.disabled.despairFx) return 0; return o.call(this, t); });
  wrap('trait', function (o, n) { if (n === 'Temporal Ruthlessness' && this._dpNoLive) return true; return o.call(this, n); });
  wrap('applyWound', async function (o, A) {
    const b = this.woundCount(); const res = await o.call(this, A);
    if (this.dpD() && (this.dpTrait('A Truth for a Truth') || this.dpTrait('A Lie for a Truth'))) { const d = this.woundCount() - b; if (d > 0) this.dpTruth(d, 'Wound'); }
    return res;
  });
}
