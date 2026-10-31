// Cycle V — Ur-Fleece (Harsh Truth): Black Abyss lanes, Flicker / Black March / Fade In, Race Through Dark Places,
// Abyss Track (Outrun Darkness), Always There, Ur-Knockback / Ur-Pull, Mortal Kindling, Smother.
import { Board, key, DIRS, DIR_LIST, cellLabel } from './core.js';

export function installUrFleece(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const LANE = { 1: [11, 12, 13], 2: [8, 9, 10], 3: [5, 6, 7], 4: [2, 3, 4] };
  const START = { 1: [4, 8], 2: [5, 10], 3: [6, 12], 4: [8, 16] };
  const NEG = ['Fear', 'Dread', 'Terror', 'Holy Terror', 'Bleeding', 'Paralyzed', 'Frenzy', 'Death', 'Egolock'];

  Object.assign(P, {
    ufD() { return !!(this.prim && this.prim.def.ufD); },
    ufT(n) { return this.ufD() && this.trait(n) && !this.prim.disabled[n]; },
    // ---------- setup ----------
    ufSetup(variant) {
      const R = this.prim; const B = this.board; B.inBounds = (c, r) => c >= 1 && c <= B.cols && r >= 2 && r <= B.rows - 1;
      R.tiles = (variant.ufTiles || []).map((x, i) => ({ id: 't' + i, lane: x.lane, c: x.c })); R.tileN = R.tiles.length;
      const [ag, uf] = START[Math.min(4, Math.max(1, this.prim.level))] || [10, 18]; const lvl = this.prim.level; const st = lvl >= 5 ? [10, 18] : START[lvl] || START[1];
      R.argo = st[0]; R.track = st[1]; void ag; void uf; R.escaped = false; R.dawn = 0; R.aetherSheet = 0;
      if (this.trait('Just a Memory')) R.bonus.AT -= 1;
      this.ufRebuild();
    },
    ufRebuild() {
      for (const [k, z] of [...this.board.terrain]) if (z.abyss) this.board.terrain.delete(k);
      for (const T of this.prim.tiles) for (const r of LANE[T.lane]) for (let c = T.c; c < T.c + 3; c++) if (c >= 1 && c <= this.board.cols) this.board.terrain.set(key(c, r), { id: 'abyss_' + T.id, type: 'Black Abyss', obstacle: false, obscuring: true, destructible: false, indestructible: true, chasm: true, abyss: true, cell: { c, r } });
      this.notify();
    },
    ufTile() { const a = this.prim.anchor; return this.prim.tiles.find(T => LANE[T.lane].includes(a.r) && LANE[T.lane].includes(a.r + 1) && a.c >= T.c && a.c + 1 <= T.c + 2) || null; },
    ufPlace(T, side) {
      const L = LANE[T.lane]; const cur = this.prim.anchor; let r = L[1]; if (cur && cur.r >= 1) { const off = cur.r - (LANE[(this.ufTile() || {}).lane] || [cur.r])[0]; if (off === 0) r = L[0]; }
      this.prim.anchor = { c: side === 'left' ? T.c : T.c + 1, r }; this.notify();
    },
    async ufDefeat(why) { this.say(`☠ ${why} — 패배`, 'bad'); throw new BattleOver('defeat'); },
    async ufDevour(cells, why) {
      for (const t of this.liveTitans()) { if (t.onVP || t.offBoard || !t.pos) continue; if (cells.some(p => p.c === t.pos.c && p.r === t.pos.r)) { this.say(`${t.name}: ${why} — Black Abyss에 삼켜짐 (사망)`, 'bad'); await this.solo(() => this.kill(t)); } }
    },
    // move one tile n spaces (positive = right); pushes overlapped tiles 5 to the right; returns false if removed
    async ufTileMove(T, n, why = 'Black Abyss 이동', defer = null) {
      const R = this.prim; const ufOn = this.ufTile() === T; const old = T.c; const nc = T.c + n; const rows = LANE[T.lane];
      if (n > 0 && nc + 2 > this.board.cols) {
        const off = ufOn ? this.prim.anchor.c - T.c : null; R.tiles = R.tiles.filter(x => x !== T); this.ufRebuild(); this.say(`Black Abyss (레인 ${T.lane}): 보드 끝을 넘어 제거 → 같은 레인 왼쪽 끝에 다시 배치${ufOn ? ' (Ur-Fleece 함께)' : ''}`, 'ai');
        const swept = []; for (const r of rows) for (let c = old + 3; c <= this.board.cols; c++) swept.push({ c, r }); await this.ufDevour(swept, why);
        if (defer) { defer.push({ T, off }); return false; }
        await this.ufRespawn(T, off, why); return false;
      }
      const lo = Math.min(old, nc), hi = Math.max(old, nc) + 2; const swept = []; for (const r of rows) for (let c = lo; c <= hi; c++) if (c < old || c > old + 2) swept.push({ c, r });
      T.c = nc; if (ufOn) this.prim.anchor = { ...this.prim.anchor, c: this.prim.anchor.c + n };
      for (const o of [...R.tiles]) if (o !== T && o.lane === T.lane && R.tiles.includes(o) && o.c <= nc + 2 && o.c + 2 >= nc) { this.say(`Black Abyss 겹침 — 레인 ${o.lane}의 다른 타일도 5칸 오른쪽으로`, 'ai'); await this.ufTileMove(o, 5, why); }
      this.ufRebuild(); await this.ufDevour(swept, why); return true;
    },
    // a tile removed past the right edge is placed again on the left-most spaces of its lane (Ur-Fleece rides along)
    async ufRespawn(T, off, why) {
      const R = this.prim; T.c = 1; R.tiles.push(T); if (off != null) this.prim.anchor = { ...this.prim.anchor, c: 1 + off };
      for (const o of [...R.tiles]) if (o !== T && o.lane === T.lane && R.tiles.includes(o) && o.c <= 3) { this.say(`Black Abyss 겹침 — 레인 ${o.lane}의 기존 타일 5칸 오른쪽으로`, 'ai'); await this.ufTileMove(o, 5, why); }
      this.ufRebuild(); const cells = []; for (const r of LANE[T.lane]) for (let c = 1; c <= 3; c++) cells.push({ c, r }); await this.ufDevour(cells, why);
      if (off != null) await this.ukbOverlap([]);
    },
    async ufSpawn(lane, why = 'Black Abyss 생성') {
      const R = this.prim; const T = { id: 't' + (R.tileN++), lane, c: 1 }; R.tiles.push(T);
      for (const o of [...R.tiles]) if (o !== T && o.lane === lane && o.c <= 3) { this.say(`새 Black Abyss가 겹침 — 기존 타일 5칸 오른쪽으로`, 'ai'); await this.ufTileMove(o, 5, why); }
      this.ufRebuild(); this.say(`Black Abyss: 레인 ${lane} 왼쪽 끝(1-3열)에 새 타일`, 'ai');
      const cells = []; for (const r of LANE[lane]) for (let c = 1; c <= 3; c++) cells.push({ c, r }); await this.ufDevour(cells, why);
    },
    async ufRace(why = 'Race Through Dark Places') {
      const R = this.prim; this.say(`${why}: 모든 Black Abyss 타일 5칸 오른쪽으로`, 'ai');
      const order = [...R.tiles].sort((a, b) => b.c - a.c); const gone = [];
      for (const T of order) { if (!R.tiles.includes(T)) continue; await this.ufTileMove(T, 5, why, gone); }
      for (const g of gone) await this.ufRespawn(g.T, g.off, why);
    },
    async ufFlicker(again = false) {
      const cur = this.ufTile(); const cands = this.prim.tiles.filter(T => T !== cur && cur && T.c < cur.c);
      if (!cands.length) { if (again) { this.say('(Flicker: 여전히 왼쪽 타일 없음)'); return; } this.say('Flicker: 왼쪽에 Black Abyss 없음 — Race Through Dark Places 발동', 'ai'); await this.ufRace('Flicker → Race Through Dark Places'); return this.ufFlicker(true); }
      const mx = Math.max(...cands.map(T => T.c)); const L = cands.filter(T => T.c === mx); const T = L.sort((a, b) => Math.abs(a.lane - cur.lane) - Math.abs(b.lane - cur.lane))[0];
      this.ufPlace(T, 'left'); this.faceMost(); this.say(`Flicker: ${this.prim.name} → 레인 ${T.lane} 타일 왼쪽 ${cellLabel(this.prim.anchor)} (${this.prim.facing} 방향)`, 'ai'); await this.ukbOverlap([]);
    },
    async ufFadeIn() {
      if (this.prim.disabled.fadeIn) { this.say('(Fade In 비활성화)'); return; }
      const cur = this.ufTile(); const cands = this.prim.tiles.filter(T => T !== cur && cur && T.c > cur.c);
      if (!cands.length) return this.ufDefeat('Fade In: 오른쪽에 Black Abyss가 없음 — Ur-Fleece가 보드 밖으로 나가 승리');
      const mn = Math.min(...cands.map(T => T.c)); const L = cands.filter(T => T.c === mn); const T = L.sort((a, b) => Math.abs(a.lane - cur.lane) - Math.abs(b.lane - cur.lane))[0];
      this.ufPlace(T, 'right'); this.say(`Fade In: ${this.prim.name} → 레인 ${T.lane} 타일 오른쪽 ${cellLabel(this.prim.anchor)}`, 'ai'); await this.ukbOverlap([]);
    },
    async ufMarch() {
      if (this.prim.disabled.march) { this.say('(Black March 비활성화)'); return; }
      const T = this.ufTile(); if (!T) { this.say('(Black March: Ur-Fleece가 타일 위에 없음)'); return; }
      this.say(`Black March: ${this.prim.name}과 레인 ${T.lane} 타일 5칸 오른쪽으로`, 'ai'); await this.ufTileMove(T, 5, 'Black March'); await this.ukbOverlap([]);
    },
    // ---------- Abyss Track ----------
    async ufTrack(n, why) {
      const R = this.prim; if (R.escaped) { this.say(`(Argo 탈출 — Ur-Fleece 토큰 이동 없음: ${why})`); return; } if (n <= 0) return;
      R.track = Math.max(R.argo, R.track - n); this.say(`Abyss Track: Ur-Fleece ${n}칸 전진 (${why}) → ${R.track} / Argo ${R.argo}`, 'ai'); this.notify();
      if (R.track <= R.argo) await this.ufDefeat('Ur-Fleece가 Abyss Track에서 Argo를 따라잡음');
    },
    async ufArgo(n, why) {
      const R = this.prim; if (R.escaped || n <= 0) return; R.argo -= n; this.say(`Abyss Track: Argo ${n}칸 전진 (${why}) → ${Math.max(0, R.argo)} / Ur-Fleece ${R.track}`, 'good'); this.notify();
      if (R.argo < 1) { R.escaped = true; this.say('🏁 Argo가 Abyss Track을 탈출!', 'good'); await this.ufDeclare(); }
    },
    async ufDeclare() {
      const v = await this.ask({ type: 'choice', title: 'Argo 탈출 — 승리(Harsh Truth)를 선언할까요? 계속하면 이후 Primordial Round가 끝날 때마다 선언 가능', options: [{ label: '승리 선언', value: true }, { label: '전투 계속', value: false }] });
      if (v) { this.say('Victory (Harsh Truth)!', 'good'); throw new BattleOver('victory'); }
    },
    // ---------- targeting ----------
    ufPick(lines, exclude = []) {
      const base = () => this.liveTitans().filter(t => !t.offBoard && !exclude.includes(t));
      for (const line of lines || []) {
        let c = base(); let custom = true;
        if (/Most Light/.test(line)) { c = c.filter(t => this.lightOf(t) > 0); const m = Math.max(...c.map(t => this.lightOf(t))); c = c.filter(t => this.lightOf(t) === m); }
        else if (/Most Oxygen/.test(line)) { c = c.filter(t => (t.oxygen || 0) > 0); const m = Math.max(...c.map(t => t.oxygen || 0)); c = c.filter(t => (t.oxygen || 0) === m); }
        else if (/Least Despair/.test(line)) { c = c.filter(t => (t.despair || 0) > 0); const m = Math.min(...c.map(t => t.despair)); c = c.filter(t => t.despair === m); }
        else if (/Most Despair/.test(line)) { c = c.filter(t => (t.despair || 0) > 0); const m = Math.max(...c.map(t => t.despair)); c = c.filter(t => t.despair === m); }
        else if (/Priority Target/.test(line)) c = c.filter(t => t.pt);
        else custom = false;
        if (custom) { if (c.length) return c.find(t => t.pt) || c[0]; continue; }
        const r = this.pickTarget([line], true); if (r && !exclude.includes(r)) return r;
      }
      return null;
    },
    // ---------- knockback / pull ----------
    async ufKnock(t, n) {
      if (!t || !t.alive || t.onVP || !t.pos) return; if (this.prim.disabled.urKnock) { this.say('(Ur-Knockback 비활성화)'); return; }
      const dir = t.pos.c <= (this.board.cols + 1) / 2 ? 'W' : 'E'; this.say(`Ur-Knockback ${n}: ${t.name} → 가까운 짧은 보드 끝(${dir})`, 'bad');
      this._ufLeft = dir === 'W'; try { await this.knockback(t, n, dir); } finally { this._ufLeft = false; }
    },
    async ufPull(t, n) {
      if (!t || !t.alive || t.onVP || !t.pos) return; if (this.prim.disabled.urPull) { this.say('(Ur-Pull 비활성화)'); return; }
      this.say(`Ur-Pull ${n}: ${t.name}을(를) Ur-Fleece 쪽으로`, 'bad'); await this.pullTitan(t, n);
    },
    async ufPullToAbyss(t, n) {
      if (!t || !t.alive || t.onVP || !t.pos) return; const AB = [...this.board.terrain.values()].filter(z => z.abyss).map(z => z.cell); if (!AB.length) return;
      for (let i = 0; i < n && t.alive; i++) {
        const d0 = Math.min(...AB.map(p => Board.dist(p, t.pos))); if (d0 === 0) break;
        const opts = DIR_LIST.map(d => ({ c: t.pos.c + DIRS[d][0], r: t.pos.r + DIRS[d][1] })).filter(q => this.board.inBounds(q.c, q.r) && Math.min(...AB.map(p => Board.dist(p, q))) < d0 && !this.primContains(q) && !this.titanAt(q.c, q.r));
        if (!opts.length) break; t.pos = opts[0]; if (this.board.isChasm(t.pos.c, t.pos.r)) { this.say(`${t.name}: Black Abyss로 끌려가 삼켜짐 (사망)`, 'bad'); await this.kill(t); return; }
      }
      this.notify();
    },
    // ---------- Smother ----------
    ufSmoFix(t) { const L = t.gear.filter(g => (g.smo || 0) > 0); let s = L.reduce((a, g) => a + g.smo, 0); for (const g of L) { if (s <= (t.ambrosia || 0)) break; if (g.discarded) { s -= g.smo; g.smo = 0; continue; } const k = Math.min(g.smo, s - (t.ambrosia || 0)); g.smo -= k; s -= k; } for (const g of L) if (g.discarded) g.smo = 0; },
    ufSmothered(t) { this.ufSmoFix(t); return t.gear.filter(g => !g.discarded && (g.smo || 0) > 0); },
    ufHasLightKW(t) { return t.gear.some(g => !g.discarded && !(g.smo > 0) && this.kwLight(g, t) != null); },
    async ufDiscardSmothered(t, n, perm = false) {
      for (let i = 0; i < n && t.alive; i++) { const L = this.ufSmothered(t); if (!L.length) { this.say(`${t.name}: 버릴 smothered 장비 없음`); return; } const g = L.length === 1 ? L[0] : await this.pickGear(t, L) || L[0]; g.smo = 0; this.discardGear(t, g); this.say(`${t.name}: smothered 장비 「${g.card.name}」 ${perm ? '영구 상실 (캠페인)' : '버림'} — Ambrosia는 시트로`, 'bad'); }
    },
    async ufKindleCheck() {
      if (!this.ufT('Mortal Kindling') || this.trait('Mortal Embers')) return;
      for (const t of this.liveTitans()) { if (t.onVP || !t.pos) continue; const z = this.board.terrainAt(t.pos.c, t.pos.r); if (z && z.abyss && !this.ufHasLightKW(t)) { this.say(`Mortal Kindling: ${t.name} Black Abyss 위에서 Light X 키워드 없음 — 사망`, 'bad'); await this.solo(() => this.kill(t)); } }
    },
    // All for All (Secret 322): BP III Ultimate Power over up to four consecutive Attacks
    async ufAFA(t, A, at) {
      if (!this.trait('All for All')) return null; let F = this.prim.afa;
      if (A.bp.tier !== 3) { if (F) { this.say(`All for All: 다른 BP 공격 — 누적 Power ${F.power} 지움`, 'bad'); this.prim.afa = null; } return null; }
      if (F && F.name !== A.bp.name) { this.say(`All for All: 다른 BP III — 누적 Power ${F.power} 지움`, 'bad'); F = null; }
      const k = (F ? F.n : 0) + 1; const add = k < 4 ? Math.ceil(A.total / 2) + (A.crit ? 1 : 0) : A.total; const U = (F ? F.power : 0) + add;
      this.say(`All for All (${k}/4번째 공격): ${k < 4 ? `Power ${A.total} → ${add}${A.crit ? ' (Crit +1)' : ''}` : `Power ${A.total} 전부`} → Ultimate Power ${U} vs AT ${at}`, U >= at ? 'good' : 'ai');
      if (U >= at) { this.prim.afa = null; A.total = Math.max(A.total, at); this.say('All for All: Ultimate Power가 AT 이상 — Wound!', 'good'); return 'wound'; }
      if (k < 4) { this.prim.afa = { name: A.bp.name, n: k, power: U }; this.say('All for All: Escalation·Response 없음 → Ur-Fleece Flicker, Kratos Pool 비움, BP는 덱 맨 위로', 'ai'); await this.ufFlicker(); return 'store'; }
      this.prim.afa = null; this.say('All for All: 네 번째 공격에도 Wound 실패 — 누적 Power 지우고 Fail/Instinct 응답', 'bad'); return null;
    },
    // ---------- AI ----------
    async ufPre(t, s, card) {
      let m;
      if ((m = /^Gain (\d) Despair tokens?\.?$/.exec(s))) { await this.gainDespair(t, +m[1]); await this.checkDespairAll(); return; }
      await this.doSentence(t, s, { card });
    },
    async ufMove(U) { if (U.move === 'flicker') await this.ufFlicker(); else if (U.move === 'fadein') await this.ufFadeIn(); else if (U.move === 'march') await this.ufMarch(); },
    ufCard(card, U) { let c2 = { ...card }; if (U.judge) c2 = { ...c2, judge: U.judge }; return c2; },
    async ufAttackOne(t, c2) {
      let h = 0; try { h = await this.primAttackOn(t, c2) || 0; } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied) && !e.chainBreak) throw e; if (e.chainBreak) throw e; }
      if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); }
      return h;
    },
    async ufAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const U = card.uf || {}; this.zoneShow = null;
      if (U.routine) { this.say('Coming of Darkness: 모든 타이탄 Terror · Black March · ⚡ Black March', 'ai'); for (const t of [...this.liveTitans()]) await this.solo(() => this.addCondition(t, 'Terror')); await this.ufMarch(); if (this.liveTitans()[0]) await this.reactionWindow(this.liveTitans()[0], card, 'Black March'); await this.ufMarch(); return; }
      if (U.argoBurns) { this.say('Argo Burns: Argo 자원 −1 (캠페인), Ur-Fleece 6칸'); await this.ufTrack(6, 'Argo Burns'); return; }
      if (U.ai0) {
        const L = this.rng.shuffle([...this.liveTitans()]); this.say('Fate of All Things: 무작위 타이탄 3명', 'ai');
        if (L[0]) await this.solo(() => this.addCondition(L[0], 'Fear')); if (L[1]) await this.solo(() => this.addCondition(L[1], 'Terror')); if (L[2]) await this.solo(() => this.gainDespair(L[2], 2));
        await this.escalate(1, false, true); card._removed = true; this._endRound = true; this.say('Fate of All Things: Primordial Round 종료, 이 카드는 덱에서 제거', 'ai'); return;
      }
      if (U.aethervoid) { let n = 0; for (const t of this.liveTitans()) { n += t.aether || 0; t.aether = 0; } this.prim.aetherSheet = (this.prim.aetherSheet || 0) + n; this.say(`Aethervoid: 모든 타이탄의 Aether ${n}개를 Primordial Sheet로 → X = ${this.prim.aetherSheet}`, 'ai'); }
      const X = this.prim.aetherSheet || 0; const fix = c => U.aethervoid ? { ...c, dice: X, steps: c.steps.map(s => s.replace(/X DANGER/, `${X} DANGER`)) } : c;
      if (U.zone) {
        const tg = forcedTarget && forcedTarget.alive ? [forcedTarget] : this.liveTitans().filter(t => !t.offBoard); this.say(`Zone 대상: ${tg.map(t => t.name).join(', ') || '(없음)'}`, 'ai'); if (!tg.length) return;
        for (const t of tg) for (const s of U.pre || []) { if (t.alive) await this.solo(() => this.ufPre(t, s, card)); }
        if (U.move) { await this.reactionWindow(this.liveTitans()[0], card, card.steps[0].split(' | ')[0]); await this.ufMove(U); }
        const c2 = fix(this.ufCard(card, U)); const done = [];
        for (const t of tg) { if (!t.alive) continue; if (U.fm && U.fm[1] === 'die' && this.effFate(t) >= U.fm[0]) { this.say(`Fate ${U.fm[0]}+: ${t.name} 사망`, 'bad'); await this.solo(() => this.kill(t)); continue; } await this.ufAttackOne(t, c2); done.push(t); }
        if (card.afterFinal) { if (U.afterWin && this.liveTitans()[0]) await this.reactionWindow(this.liveTitans()[0], card, 'After Final Attack'); this.say(`After Final Attack: ${card.afterFinal}`); await this.ufAfter(null, card.afterFinal, card); }
        return;
      }
      const ex = []; let t = forcedTarget && forcedTarget.alive && !forcedTarget.offBoard ? forcedTarget : this.ufPick(card.target, ex);
      if (!t) { if (card !== this.routine) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); } return; }
      this.say(`타겟: ${t.name}`);
      for (const s of U.pre || []) { await this.solo(() => this.ufPre(t, s, card)); }
      if (!t.alive) { if (U.retargetDespair) { ex.push(t); t = this.ufPick(card.target, ex); if (!t) return; this.say(`Despair로 사망 — 다음 타겟 ${t.name}`, 'ai'); } else return; }
      if (U.fm && U.fm[1] === 'phobia' && this.effFate(t) >= U.fm[0]) { this.say(`Fate ${U.fm[0]}+: 무작위 Phobia`); this.dpPhobia(t); }
      if (U.fm && U.fm[1] === 'argo' && this.effFate(t) >= U.fm[0]) { const L = this.argo || []; if (L.length) { const a = L.length === 1 ? L[0] : await this.ask({ type: 'choice', titan: t, title: 'Aethervoid Fate 9+: 영구히 잃을 Argo Ability', options: L.map(x => ({ label: x.card.name, value: x })) }) || L[0]; this.argo = L.filter(x => x !== a); this.say(`Argo Ability 「${a.card.name}」 영구 상실`, 'bad'); } }
      await this.reactionWindow(t, card, card.steps[0].split(' | ')[0]); if (!t.alive) return;
      await this.ufMove(U); if (!t.alive) return;
      const c2 = fix(this.ufCard(card, U)); if (U.aethervoid && !X) { this.say('Aethervoid: X = 0 — 공격 주사위 없음'); return; } let h = await this.ufAttackOne(t, c2);
      if (U.repeat4) { const done = [t]; while (h >= 4) { const nx = this.ufPick(card.target, done); if (!nx) break; done.push(nx); this.say(`4 hit 이상 — 다음 대상 ${nx.name}에게 반복`, 'ai'); h = await this.ufAttackOne(nx, c2); } }
      if (card.after) { if (U.afterWin && this.liveTitans().length) await this.reactionWindow(t.alive ? t : this.liveTitans()[0], card, 'After Attack'); this.say(`After Attack: ${card.after}`); await this.solo(() => this.ufAfter(t, card.after, card, h)); }
      void isSignature;
    },
    async ufAfter(t, s, card, hits = 0) {
      const parts = (s.replace(/ ⚡ /g, ' ').match(/[^.]+\.?/g) || []).map(x => x.trim()).filter(Boolean);
      for (const q0 of parts) { const q = q0.replace(/^Then, /, ''); let m;
        if ((m = /^Ur-Pull (\d+)( each Titan)?\.?$/.exec(q))) { for (const o of m[2] ? [...this.liveTitans()] : [t]) if (o && o.alive) await this.solo(() => this.ufPull(o, +m[1])); continue; }
        if ((m = /^Ur-Knockback (\d+|X)( each Titan on the Battle Board)?\.?$/.exec(q))) { const n = m[1] === 'X' ? (this.prim.aetherSheet || 0) : +m[1]; for (const o of m[2] ? [...this.liveTitans()] : [t]) if (o && o.alive) await this.solo(() => this.ufKnock(o, n)); continue; }
        if (/^Black March\.?$/.test(q)) { await this.ufMarch(); continue; }
        if (/^Knockdown\.?$/.test(q)) { if (t && t.alive && !t.onVP) await this.knockdown(t); continue; }
        if (/^Discard X Gear cards smothered with Ambrosia, where X is the number of hits\.?$/.test(q)) { if (t && t.alive && hits) await this.ufDiscardSmothered(t, hits); continue; }
        if (/^move Ur-Fleece X spaces on the Abyss Track, where X is the number of Aether tokens you have\.?$/i.test(q)) { await this.ufTrack(t && t.alive ? (t.aether || 0) : 0, card.name); continue; }
        if (/^move Ur-Fleece X spaces on the Abyss Track, where X is the number of Despair tokens and Conditions you have\.?$/i.test(q)) { await this.ufTrack(t && t.alive ? (t.despair || 0) + (t.conditions || []).length : 0, card.name); continue; }
        if (/^Move each Black Abyss tile so that they all line up with the tile Ur-Fleece is currently on\.?$/.test(q)) { const T = this.ufTile(); if (T) { this.say(`Fademelt: 모든 Black Abyss 타일을 ${T.c}열에 정렬`, 'ai'); for (const o of [...this.prim.tiles]) if (o !== T && this.prim.tiles.includes(o) && o.c !== T.c) await this.ufTileMove(o, T.c - o.c, 'Fademelt'); } continue; }
        if (/^Pull 3 each Titan on the Battle Board toward the closest Black Abyss tile\.?$/.test(q)) { for (const o of [...this.liveTitans()]) await this.solo(() => this.ufPullToAbyss(o, 3)); continue; }
        if (/^FATE 5\+: Gain \+1 Doom\.?$/.test(q)) { if (t && t.alive && this.effFate(t) >= 5) this.say(`Fate 5+: +1 Doom (캠페인 — 수동 확인)`, 'sys'); continue; }
        if (t && t.alive) await this.doEffects(t, q, { card, after: true });
      }
    },
    async ufEffect(t, s, hits, card) {
      let m; const deal = d => this.dealFD(t, 0, d, card, hits);
      if (/^(?:FADE IN|FLICKER|BLACK MARCH|ATTACK|JUDGE)/.test(s)) return true;
      if (/^One hit, gain the Terror Condition card; two hits, gain the Holy Terror Condition card; three hits, gain a random Phobia Affliction and die\. Four or more hits, same as three, but (repeat this Attack for the next eligible Target|also permanently lose a chosen Mnemos card and remove it from the game)\. Additionally, gain as many Ambrosia tokens as there are hits\.$/.test(s.replace(/^No Skill\. /, ''))) {
        if (hits >= 3) { if (hits >= 4 && /Mnemos/.test(s)) { const L = (t.mnemos || []).filter(x => !x.discarded); if (L.length) { const x = L.length === 1 ? L[0] : await this.ask({ type: 'choice', titan: t, title: '영구히 잃을 Mnemos', options: L.map(y => ({ label: y.card.name, value: y })) }) || L[0]; x.discarded = true; this.say(`${t.name}: Mnemos 「${x.card.name}」 영구 상실`, 'bad'); } } await this.gainAmbrosia(t, hits); this.dpPhobia(t); this.say(`${t.name}: ${hits} hit — 사망`, 'bad'); await this.kill(t); }
        else { await this.addCondition(t, hits >= 2 ? 'Holy Terror' : 'Terror'); if (t.alive) await this.gainAmbrosia(t, hits); }
        return true;
      }
      if (/^Each hit deals 4 DANGER and either a Fear or Terror Condition card\.$/.test(s)) { await deal(4 * hits); if (t.alive) { const c = await this.ask({ type: 'choice', titan: t, title: 'Sum of All Fears: 받을 Condition', options: [{ label: 'Fear', value: 'Fear' }, { label: 'Terror', value: 'Terror' }] }) || 'Fear'; await this.addCondition(t, c); } return true; }
      if ((m = /^Each hit deals (\d+) DANGER(?: and (\d) Ambrosia(?: tokens?)?)?\.$/.exec(s))) { await deal(+m[1] * hits); if (t.alive && m[2]) await this.gainAmbrosia(t, +m[2] * hits); return true; }
      if ((m = /^Flip (\d) Oxygen tokens?\.$/.exec(s))) { await this.flipOxygen(t, +m[1], card.name); return true; }
      if ((m = /^Ur-Knockback (\d+)\.$/.exec(s))) { await this.ufKnock(t, +m[1]); return true; }
      if (/^You permanently lose 1 smothered Gear card\.$/.test(s)) { await this.ufDiscardSmothered(t, 1, true); return true; }
      if ((m = /^Gain the (Fear|Terror|Holy Terror|Dread) Condition card\.$/.exec(s))) { await this.addCondition(t, m[1]); return true; }
      { const parts = (s.match(/[^.]+\.?/g) || []).map(x => x.trim()).filter(Boolean); if (parts.length > 1) { for (const q of parts) { await this.applyAttackEffect(t, q, hits, card); if (!t.alive) throw new TitanDied(t); } return true; } }
      return false;
    },
    async ufSentence(t, p, ctx = {}) {
      let m; const alive = !!(t && t.alive);
      if (/^Flicker\.?$/.test(p)) { await this.ufFlicker(); return true; }
      if (/^Fade In\.?$/.test(p)) { await this.ufFadeIn(); return true; }
      if (/^Black March\.?$/.test(p)) { await this.ufMarch(); return true; }
      if ((m = /^(?:Then, )?Ur-Knockback (\d+)\.?$/.exec(p))) { if (alive) await this.ufKnock(t, +m[1]); return true; }
      if ((m = /^(?:Then, )?Ur-Pull (\d+)( each Titan)?\.?$/.exec(p))) { for (const o of m[2] ? [...this.liveTitans()] : (alive ? [t] : [])) await this.solo(() => this.ufPull(o, +m[1])); return true; }
      if ((m = /^Gain (\d) Aether tokens?\.?$/.exec(p))) { if (alive) { t.aether = (t.aether || 0) + +m[1]; this.say(`${t.name}: Aether +${m[1]} → ${t.aether}`); } return true; }
      if (/^Burn\. Each Titan gains 1 Despair token, then suffers Ur-Knockback 4\.?$/.test(p)) { if (alive) { await this.burn(t, true); await this.flushBurn(); } for (const o of [...this.liveTitans()]) await this.solo(async () => { await this.gainDespair(o, 1); if (o.alive) await this.ufKnock(o, 4); }); return true; }
      if (/^Disable the Just a Memory Trait\.?$/.test(p)) { if (this.trait('Just a Memory') && !this.prim.disabled['Just a Memory']) { this.prim.disabled['Just a Memory'] = true; this.prim.bonus.AT += 1; this.say('Just a Memory 비활성화 (AT −1 해제)', 'bad'); } return true; }
      if (/^Gain a random Phobia Affliction and die\.?$/.test(p)) { if (alive) { this.dpPhobia(t); this.say(`${t.name}: 사망`, 'bad'); await this.kill(t); } return true; }
      if (/^Gain the Dread and Holy Terror Condition cards\.?$/.test(p)) { if (alive) { await this.addCondition(t, 'Dread'); if (t.alive) await this.addCondition(t, 'Holy Terror'); } return true; }
      if ((m = /^Flip (\d) Oxygen tokens?\.?$/.exec(p))) { if (alive) await this.flipOxygen(t, +m[1]); return true; }
      if ((m = /^Gain the (Fear|Terror|Holy Terror|Dread) Condition card\.?$/.exec(p))) { if (alive) await this.addCondition(t, m[1]); return true; }
      if ((m = /^Gain \+(\d) FATE\.?$/.exec(p))) { if (alive) await this.gainFate(t, +m[1]); return true; }
      if (/[.] /.test(p) && /Flicker|Fade In|Black March|Ur-|Aether|Just a Memory|Phobia/.test(p)) { for (const q of (p.match(/[^.]+\.?/g) || []).map(x => x.trim()).filter(Boolean)) await this.doSentence(t, q, ctx); return true; }
      return false;
    },
    async ufCritical(t, A) {
      const c = (A.bp.critical || '').replace('You live!', 'You Live'); const parts = (c.match(/[^.!]+[.!]?(?:\s*\([^)]*\))?/g) || []).map(x => x.trim()).filter(Boolean);
      for (const x of parts) { let m;
        if (/^(?:Then, )?perform a Bonus Attack/i.test(x)) { this.pendingFollowUp = t; continue; }
        if (/^Each Titan may discard either their Despair tokens or a Condition card/.test(x)) { for (const o of this.liveTitans()) { const opts = [{ label: '안 함', value: null }]; if (o.despair) opts.push({ label: `Despair ${o.despair}개 모두 버림`, value: 'd' }); for (const k of o.conditions) opts.push({ label: `Condition 「${k}」 버림`, value: k }); if (opts.length === 1) continue; const v = await this.ask({ type: 'choice', titan: o, title: `${A.bp.name}: ${o.name} — Despair 전부 또는 Condition 1장 버리기`, options: [...opts.slice(1), opts[0]] }); if (v === 'd') o.despair = 0; else if (v) o.conditions = o.conditions.filter(k => k !== v); if (v) this.say(`${o.name}: ${v === 'd' ? 'Despair 전부' : v} 버림`, 'good'); } continue; }
        if (/^Immediately move Ur-Fleece to a chosen Black Abyss tile/.test(x)) { const L = this.prim.tiles.filter(T => T !== this.ufTile()); if (L.length) { const T = L.length === 1 ? L[0] : await this.ask({ type: 'choice', titan: t, title: 'Ur-Fleece를 옮길 Black Abyss 타일', options: L.map(T => ({ label: `레인 ${T.lane} · ${T.c}-${T.c + 2}열`, value: T })) }) || L[0]; this.ufPlace(T, 'left'); this.faceMost(); this.say(`Ur-Fleece → 레인 ${T.lane} 타일 (${cellLabel(this.prim.anchor)})`, 'good'); await this.ukbOverlap([]); } continue; }
        if (/^Immediately discard all Ambrosia tokens/.test(x)) { t.ambrosia = 0; this.ufSmoFix(t); this.say(`${t.name}: Ambrosia 전부 버림`, 'good'); continue; }
        if (/^Immediately remove from Battle all cards from the Obol deck except 1 You Live and 1 You died/.test(x)) { const live = this.obolBase.find(o => o.result === 'live'), die = this.obolBase.find(o => o.result === 'die'); this.obolBase = [live, die].filter(Boolean); this.obolExtra = []; this.say('Obol 덱: You Live! 1장 + You Died 1장만 남김', 'good'); continue; }
        if (/^Disable the Fade In keyword/.test(x)) { this.prim.disabled.fadeIn = true; this.say('Fade In 비활성화', 'good'); continue; }
        if (/^Disable the Ur-Knockback X keyword/.test(x)) { this.prim.disabled.urKnock = true; this.say('Ur-Knockback 비활성화', 'good'); continue; }
        if (/^Disable the Ur-Pull X keyword/.test(x)) { this.prim.disabled.urPull = true; this.say('Ur-Pull 비활성화', 'good'); continue; }
        if (/^Disable Ambrosia gain/.test(x)) { this.prim.disabled.ambGain = true; this.say('Ambrosia 획득 비활성화', 'good'); continue; }
        if (/^Disable Fear, Dread, Terror, and Holy Terror Condition cards/.test(x)) { const L = ['Fear', 'Dread', 'Terror', 'Holy Terror']; this.prim.dpNoCond = L; for (const o of this.liveTitans()) o.conditions = o.conditions.filter(k => !L.includes(k)); this.say('Fear/Dread/Terror/Holy Terror 비활성화 — 모두 버림', 'good'); continue; }
        if (/^Disable Despair effects/.test(x)) { this.prim.disabled.despairFx = true; this.say('Despair 효과 비활성화', 'good'); continue; }
        if (/^Each Titan gains 1 Oxygen token and 2 Aether tokens/.test(x)) { for (const o of this.liveTitans()) { o.oxygen = (o.oxygen || 0) + 1; o.aether = (o.aether || 0) + 2; } this.say('모든 타이탄 Oxygen +1, Aether +2', 'good'); continue; }
        if (/^Disable the Black March keyword/.test(x)) { this.prim.disabled.march = true; this.say('Black March 비활성화', 'good'); continue; }
        if ((m = /^Each Titan resets their FATE to 0/.exec(x))) { for (const o of this.liveTitans()) o.fate = 0; this.say('모든 타이탄 Fate 0 (Doom 0은 캠페인)', 'good'); continue; }
        if (/Secret deck|campaign|Special Event|Rare resource|Permanently gain|Argonaut Lifetime|reset Doom|If you already have it|^\(/.test(x)) { this.say(`(${x} — 캠페인 보상)`, 'sys'); continue; }
        this.say(`(Critical 효과 수동 적용 필요: ${x})`, 'sys');
      }
      return true;
    },
  });

  // ---------- wiring ----------
  wrap('boundless', function (o) { if (this.ufD() && this._ufLeft) return true; return o.call(this); });
  wrap('knockback', async function (o, t, x, dir = null, ...r) { if (this.ufD() && dir === 'W' && !this._ufLeft) { this._ufLeft = true; try { return await o.call(this, t, x, dir, ...r); } finally { this._ufLeft = false; } } return o.call(this, t, x, dir, ...r); });
  wrap('startOfBattle', async function (o, ...a) {
    const r = await o.call(this, ...a);
    if (this.ufD()) {
      if (this.trait('Unfathomable Depths')) { for (const t of this.liveTitans()) t.oxygen = Math.max(0, (t.oxygen || 0) - 2); this.say('Unfathomable Depths: Oxygen 2개 적게 시작', 'sys'); }
      if (this.trait("Argo's Parting Gift")) { const n = 89 - this.prim.level; this.woundStack.unshift({ card: null, value: n, name: "Argo's Parting Gift" }); this.say(`Argo's Parting Gift: Wound Stack에 ${n} Wounds (누적 ${this.woundCount()}/${this.prim.wounds})`, 'sys'); }
      this.faceMost(); this.say(`Abyss Track: Argo ${this.prim.argo} · Ur-Fleece ${this.prim.track} (Lv ${this.prim.level})`, 'sys');
    }
    return r;
  });
  wrap('primordialRound', async function (o, ...a) {
    if (this.ufD() && this.round >= 1 && !this._gamMid && !this._ufRound) {
      this._ufRound = true;
      try { this.say('━━ Primordial Round 시작: Race Through Dark Places / Outrun Darkness ━━', 'hdr'); await this.ufRace(); await this.ufTrack(4, 'Outrun Darkness'); } finally { this._ufRound = false; }
    }
    const res = await o.call(this, ...a);
    if (this.ufD() && this.prim.escaped && this.liveTitans().length) await this.ufDeclare();
    return res;
  });
  wrap('applyWound', async function (o, A) {
    const b = this.woundCount(); const res = await o.call(this, A);
    if (this.ufD()) { const d = this.woundCount() - b; if (d > 0 && A && A.bp) {
      const X = typeof A.bp.tier === 'number' ? A.bp.tier : 1; await this.ufArgo(X, `${A.t ? A.t.name : '타이탄'}의 Wound (BP ${'I'.repeat(X)})`);
      if (A.t && this.ufT('Mortal Kindling') && !this.trait('Mortal Embers')) { const L = this.ufSmothered(A.t); let k = X; for (const g of L) { if (k <= 0) break; const n = Math.min(k, g.smo); g.smo -= n; k -= n; } if (k < X) this.say(`Relight: ${A.t.name} Light X 장비의 Ambrosia ${X - k}개를 시트로`, 'good'); }
      if (this.ufT('Darkest Before Dawn')) { this.prim.dawn += d; this.say(`Darkest Before Dawn: 토큰 +${d} → ${this.prim.dawn}`, 'ai'); if (this.prim.dawn >= 4) this.prim.dawnPending = true; }
    } }
    return res;
  });
  wrap('titanAttack', async function (o, t, ...r) {
    try { return await o.call(this, t, ...r); } finally {
      if (this.ufD() && this.prim.dawnPending) { this.prim.dawnPending = false; this.prim.dawn = 0; const T = this.ufTile(); this.say('Darkest Before Dawn: 토큰 4개 — Ur-Fleece 레인 왼쪽 끝에 Black Abyss 추가', 'ai'); if (T) await this.safe(() => this.ufSpawn(T.lane, 'Darkest Before Dawn')); }
    }
  });
  wrap('addCondition', async function (o, t, name, ...r) {
    const had = t && (t.conditions || []).includes(name); const res = await o.call(this, t, name, ...r);
    if (this.ufD() && this.trait('Contagious Fear') && !this._ufContag && t && t.alive && !had && (t.conditions || []).includes(name) && NEG.includes(name)) { this._ufContag = true; try { this.say(`Contagious Fear: 다른 타이탄 모두 ${name}`, 'bad'); for (const x of this.liveTitans()) if (x !== t) await this.solo(() => this.addCondition(x, name)); } finally { this._ufContag = false; } }
    return res;
  });
  wrap('awaken', async function (o, t, ...r) { if (this.ufD() && this.trait('End of an Age')) { this.say(`${t.name}: End of an Age — 각성 불가`, 'bad'); return false; } return o.call(this, t, ...r); });
  wrap('kill', async function (o, t, ...r) { const aw = t && t.alive && t.godform; const res = await o.call(this, t, ...r); if (this.ufD() && aw && t && !t.alive && this.trait('No Other Gods Before Me')) this.say(`No Other Gods Before Me: ${t.name} 각성 상태로 사망 — 그 각성 영구 제거 (캠페인)`, 'bad'); return res; });
  // Smother: Ambrosia goes onto Light X game elements first
  wrap('gainAmbrosia', async function (o, t, n, ...r) {
    const a0 = t ? t.ambrosia || 0 : 0; const res = await o.call(this, t, n, ...r);
    if (this.ufD() && this.trait('Smother') && t && t.alive) { let k = (t.ambrosia || 0) - a0; if (k > 0) { const L = t.gear.filter(g => !g.discarded && !(g.smo > 0) && this.kwLight(g, t) != null); const used = []; for (const g of L) { if (k <= 0) break; g.smo = 1; k--; used.push(g.card.name); } if (used.length) this.say(`Smother: ${t.name} — Ambrosia를 Light X 장비에 (${used.join(', ')}) — Light X 비활성화`, 'bad'); } }
    return res;
  });
  wrap('lightOf', function (o, t) { if (!this.ufD() || !t || !t.gear) return o.call(this, t); this.ufSmoFix(t); const hide = t.gear.filter(g => g.smo > 0 && !g.exhausted); for (const g of hide) g.exhausted = true; try { return o.call(this, t); } finally { for (const g of hide) g.exhausted = false; } });
  // Mortal Kindling: Titans with Light X may move through / onto Black Abyss spaces
  wrap('chooseMove', async function (o, t, max, label = '이동', ...r) {
    if (!this.ufD() || !t || !t.alive) return o.call(this, t, max, label, ...r);
    const kindle = this.ufT('Mortal Kindling') && !this.trait('Mortal Embers') && this.ufHasLightKW(t) && ['이동', 'Rush', 'Run'].includes(label);
    const Z = kindle ? [...this.board.terrain.values()].filter(z => z.abyss) : []; for (const z of Z) z.chasm = false;
    let res; try { res = await o.call(this, t, max, label, ...r); } finally { for (const z of Z) z.chasm = true; }
    if (kindle && t.alive && t.pos && !t.onVP) { const z = this.board.terrainAt(t.pos.c, t.pos.r); if (z && z.abyss) { this.say(`Mortal Kindling: ${t.name} Black Abyss 위에서 이동 종료 — Ambrosia +1`, 'bad'); await this.gainAmbrosia(t, 1); } }
    t._ufMoved = true; return res;
  });
  wrap('titanTurn', async function (o, t, ...r) {
    if (!this.ufD() || !t) return o.call(this, t, ...r);
    const p0 = t.pos ? { ...t.pos } : null; const z0 = p0 && this.board.terrainAt(p0.c, p0.r); t._ufMoved = false;
    try { return await o.call(this, t, ...r); } finally {
      if (t.alive && z0 && z0.abyss && !t._ufMoved && t.pos && t.pos.c === p0.c && t.pos.r === p0.r && this.ufT('Mortal Kindling') && !this.trait('Mortal Embers')) { this.say(`Mortal Kindling: ${t.name} Black Abyss 위에서 턴 시작·이동 없음 — Ambrosia +1`, 'bad'); await this.solo(() => this.gainAmbrosia(t, 1)); }
      await this.ufKindleCheck();
    }
  });
  wrap('resolveAI', async function (o, ...a) { const r = await o.call(this, ...a); if (this.ufD()) await this.ufKindleCheck(); return r; });
}
