// Cycle III — Hypertime Oracle and shared Cycle III mechanics (Time Anchors, Rewind, Laser Attacks,
// Glaciate, Teleport, Death by Fate, Danger/Fate bonus, Time-clocked, Omega Terminus, Timefront).
import { Board, key, DIRS, DIR_LIST, cellLabel, facePower } from './core.js';

const PERP = { N: ['E', 'W'], S: ['E', 'W'], E: ['N', 'S'], W: ['N', 'S'] };
const add = (p, d, k = 1) => ({ c: p.c + DIRS[d][0] * k, r: p.r + DIRS[d][1] * k });

export function installOracle(Game, { TitanDied, BattleOver }) {
  Object.assign(Game.prototype, {
    // ---------------- setup / state ----------------
    oracleSetup(S, opts = {}) {
      this.c3 = true; this.paradox = +opts.paradox || 0;
      this.anchors = this.titans.map(t => ({ ...t.pos }));
      this.setTF(S.timefront != null ? S.timefront : null);
      this.prim.ouat = 0;
      const ae = this.prim.def.ai.find(a => a.setAside); this.setAsideAI = ae || null;
      this.faceMost();
      this.say(`Time Anchor: 각 타이탄의 시작 칸에 배치. ${this.timefront != null ? `Timefront: ${this.timefront}열.` : ''}${this.paradox ? ` Paradox ${this.paradox}.` : ''}`, 'sys');
    },
    setTF(v) { this.timefront = v; if (this.board) this.board.tf = v; },
    onBoard(t) { return !!(t && t.alive && !t.offBoard); },
    boardTitans() { return this.liveTitans().filter(t => !t.offBoard); },
    pdx(cond, t) { if (!cond) return false; return (cond.p != null && (t ? this.parFor(t) : this.paradox) >= cond.p) || (cond.f != null && t && this.effFate(t) >= cond.f); },
    tfStep() { if (this.trait('Quantumfront')) return 6; if (this.trait('Hypertimefront')) return this.prim.level >= 4 ? 5 : 4; return 3; },

    // ---------------- Timefront ----------------
    async moveTF(n, why = '') {
      if (this.timefront == null) { this.say('(Timefront가 보드에서 제거됨 — 효과 없음)'); return; }
      if (!n) return;
      if (n < 0) { const from = this.timefront; this.setTF(Math.max(0, this.timefront + n)); this.say(`Timefront ${-n}칸 후퇴: ${from} → ${this.timefront}열${why ? ' (' + why + ')' : ''}`, 'good'); this.notify(); return; }
      await this.timefrontAdvance(n, why);
    },

    // ---------------- Time Anchors / Rewind ----------------
    async reestablishAnchor(t) { if (!this.onBoard(t)) return;
      if (t.onVP || t.stair) { // FAQ: VPs (and the Endless Staircase) are not spaces — place the Time Anchor adjacent to the Primordial instead
        const cells = Board.adjacentCells(this.primCells()).filter(p => this.board.inBounds(p.c, p.r) && !this.board.isObstacle(p.c, p.r) && !this.board.isChasm(p.c, p.r) && !this.primContains(p)); if (!cells.length) return;
        const p = cells.length === 1 ? cells[0] : await this.ask({ type: 'move', titan: t, title: `${t.name}: ${t.stair ? 'Endless Staircase' : 'VP 위'} — Time Anchor를 Primordial 인접 칸에 놓기`, cells, options: cells.map(c => ({ label: cellLabel(c), value: c })) }); if (!p) return;
        if (this.anchors) this.anchors[t.id] = { ...p }; else t.anchor = { ...p }; this.say(`${t.name}: VP 위 — Time Anchor ${cellLabel(p)} (Primordial 인접)`); return; }
      if (this.anchors) this.anchors[t.id] = { ...t.pos }; else t.anchor = { ...t.pos }; },
    async anchorChoice(t, a) { const m = this.anchors && this.mn(t, 'Time-Crossed Lovers', 3); if (!m) return a; const others = this.titans.filter(o => o !== t && this.anchors[o.id]); if (!others.length) return a; const v = await this.ask({ type: 'choice', titan: t, title: 'Time-Crossed Lovers L3: 다른 타이탄의 Time Anchor를 내 것처럼 사용? (Mnemos 버림)', options: [{ label: a ? `내 Anchor (${cellLabel(a)})` : '내 Anchor (없음)', value: null }, ...others.map(o => ({ label: `${o.name}의 Anchor (${cellLabel(this.anchors[o.id])})`, value: o }))] }); if (!v) return a; this.mnUse(t, m, 'X'); this.say(`${t.name}: Time-Crossed Lovers — ${v.name}의 Time Anchor 사용`); return { ...this.anchors[v.id] }; },
    consumeAnchor(id, how) { if (!this.anchors || !this.anchors[id]) return; this.anchors[id] = null; const t = this.titans[id]; this.say(`Voracious Parasite: ${t.name}의 Time Anchor를 삼킴 (${how})`, 'bad'); if (this.trait('Once Upon A Time')) { this.prim.ouat++; this.say(`Once Upon A Time 토큰 +1 → ${this.prim.ouat}/4`); } },
    voraciousStep() { if (!this.anchors || !this.trait('Voracious Parasite')) return; const cells = this.primCells(); for (let i = 0; i < this.anchors.length; i++) { const a = this.anchors[i]; if (a && cells.some(p => p.c === a.c && p.r === a.r)) this.consumeAnchor(i, '이동 경로'); } },
    voraciousEnd() { if (!this.anchors || !this.trait('Voracious Parasite')) return; const cells = this.primCells(); for (let i = 0; i < this.anchors.length; i++) { const a = this.anchors[i]; if (a && Board.isAdjacent(a, cells)) this.consumeAnchor(i, 'Primordial Round 종료 시 인접'); } },
    async oracleRewind(t) {
      if (!t || !t.alive || t.offBoard === 'omega') return;
      if (!t._selfRewind) { const lg = this.gearHas(t, /Ψ⟳ (When you are about to suffer Rewind, ignore it|Sisyphean Rebound)/, true); if (lg && this.fr(t) > 0) { const ok = await this.ask({ type: 'yn', titan: t, title: `${lg.card.name}: Rewind 무시? (Fate+1, 소진)`, options: [{ label: '무시', value: true }, { label: '받는다', value: false }] }); if (ok) { lg.exhausted = true; await this.gainFate(t, 1); if (/then gain 1 positive Precision token/.test(lg.card.text || '')) t.tokens.precision++; this.say(`${t.name}: Rewind 무시`, 'good'); return; } } }
      if (this.prim.disabled.rewind && !t._selfRewind) { this.say(`${t.name}: Rewind 비활성 (Ontological Antennae)`); return; }
      const a = await this.anchorChoice(t, this.anchorOf(t));
      if (!a) { this.say(`${t.name}: Rewind — Time Anchor가 없음 → 존재에서 지워짐`, 'bad'); return this.kill(t, { erased: true }); }
      if (t.onVP) await this.leaveVP(t);
      if (t.offBoard === 'clock') { if (t.clockSide !== 'arriving') { this.say(`${t.name}: Time-clocked (Departing) — Rewind 무시`); return; } t.offBoard = null; t.clockSide = null; t.conditions = t.conditions.filter(c => c !== 'Time-clocked'); }
      const prev = { ...t.pos }; let dest = a;
      if (!this.freeCellFor(t, a)) dest = this.nearestFree(a, t);
      if (!dest) { this.say(`${t.name}: Rewind — 놓을 칸 없음`); return; }
      t._prevPos = prev; t.pos = { ...dest }; this.say(`${t.name}: Rewind → Time Anchor ${cellLabel(dest)}`, 'bad'); this.notify();
      await this.landOn(t);
    },
    freeCellFor(t, p) { const o = this.titanAt(p.c, p.r); return this.board.inBounds(p.c, p.r) && !this.board.isObstacle(p.c, p.r) && !this.board.isChasm(p.c, p.r) && (!o || o === t) && !this.primContains(p); },
    nearestFree(p, t = null) { let best = null, bd = 1e9; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const q = { c, r }; if (!(t ? this.freeCellFor(t, q) : this.freeCell(q))) continue; const d = Board.dist(p, q); if (d < bd) { bd = d; best = q; } } return best; },

    // ---------------- off-board: Time-clocked / Omega Terminus ----------------
    async takeOffBoard(t, kind) {
      if (t.onVP) await this.leaveVP(t);
      t._prevPos = { ...t.pos }; t.offBoard = kind; t.pos = { c: -20 - t.id * 3, r: -20 }; t.knockdown = null;
      if (t.pt && kind === 'clock') { /* PT stays */ }
      this.notify();
    },
    async timeClock(t) {
      if (!t || !t.alive || (t.offBoard && t.offBoard !== 'omega')) return; if (this.prim.disabled.clock) { this.say('(Time-clocked 비활성)'); return; }
      if (t.offBoard === 'omega') { t.offBoard = 'clock'; t.conditions = t.conditions.filter(c => c !== 'Omega Terminus'); this.say(`${t.name}: Omega Terminus에서 Time-clocked — Omega Terminus에서 나오는 것은 무시`, 'bad'); } else await this.takeOffBoard(t, 'clock'); t.clockSide = 'departing'; if (!t.conditions.includes('Time-clocked')) t.conditions.push('Time-clocked');
      this.say(`${t.name}: Time-clocked — Departing, 보드에서 빠짐 (다음 자기 턴 끝에 Arriving으로 뒤집고, 그 다음 턴 시작에 Time Anchor로 귀환)`, 'bad');
    },
    async timeArrive(t) {
      const a = await this.anchorChoice(t, this.anchors ? this.anchors[t.id] : (t.anchor || t._prevPos || null));
      t.offBoard = null; t.clockSide = null; t.conditions = t.conditions.filter(c => c !== 'Time-clocked');
      if (!a) { this.say(`${t.name}: Time-clocked — 도착 순간 Time Anchor가 보드에 없음 → 존재에서 지워짐`, 'bad'); return this.kill(t, { erased: true }); }
      const dest = this.freeCell(a) ? a : this.nearestFree(a);
      if (!dest) { this.say(`${t.name}: Time-clocked — 돌아올 칸이 없어 존재에서 지워짐`, 'bad'); return this.kill(t, { erased: true }); }
      t.pos = { ...dest }; this.say(`${t.name}: Time-clocked — Arriving, ${cellLabel(dest)}에 귀환`, 'good'); if (this.gearHas(t, /When you arrive from Time-clocked, gain 1 positive Evasion token/)) { t.tokens.evasion++; this.say(`${t.name}: Hourglass Necklace — +Evasion 토큰`, 'good'); } if (this.mn(t, "Timekeeper's Child", 3)) { t.tkBuff = true; this.say(`${t.name}: Timekeeper's Child L3 — 이번 턴 끝까지 Speed +1, Auto-black 1`, 'good'); } this.notify(); await this.landOn(t);
    },
    async toOmega(t, why) {
      if (!t || !t.alive || t.offBoard) return;
      await this.takeOffBoard(t, 'omega'); this.say(`${t.name}: Omega Terminus로 이동 (${why}) — 자기 턴에 준비/공격만 가능, Wound 실패 시 Response 무시, 턴 끝까지 남아 있으면 존재에서 지워짐`, 'bad');
    },
    async omegaPlace(t) {
      const tf = this.timefront == null ? 0 : this.timefront; const col = tf + 1; const rows = [...new Set(this.primCells().map(p => p.r))];
      let cand = rows.map(r => ({ c: col, r })).filter(p => this.freeCell(p));
      if (!cand.length) { const all = []; for (let r = 1; r <= this.board.rows; r++) if (this.freeCell({ c: col, r })) all.push({ c: col, r }); all.sort((a, b) => Math.min(...rows.map(r => Math.abs(r - a.r))) - Math.min(...rows.map(r => Math.abs(r - b.r)))); cand = all.slice(0, 1); }
      let dest = cand.length > 1 ? await this.ask({ type: 'move', titan: t, title: `${t.name}: Omega Terminus에서 Timefront 옆으로 나올 칸`, cells: cand, options: cand.map(q => ({ label: cellLabel(q), value: q })) }) : cand[0];
      if (!dest) dest = this.nearestFree({ c: col, r: rows[0] });
      t.offBoard = null; if (dest) { t.pos = { ...dest }; this.say(`${t.name}: Wound! Omega Terminus에서 ${cellLabel(dest)}로 나옴`, 'good'); } else { this.say(`${t.name}: 나올 칸이 없음 — 존재에서 지워짐`, 'bad'); return this.kill(t, { erased: true }); }
      this.notify();
    },

    // ---------------- Primordial movement ----------------
    async oracleMoveAway(from, n) {
      const prev = this.primCells(); if (!from) return prev;
      const { x: cx, y: cy } = this.primCenter(); const dx = cx - from.c, dy = cy - from.r;
      const dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'N' : 'S');
      let k = 0;
      for (let i = 0; i < n; i++) { const na = add(this.prim.anchor, dir); const nc = this.primCells(na); if (nc.some(p => !this.board.inBounds(p.c, p.r) || (this.timefront != null && p.c <= this.timefront) || this.board.terrainAt(p.c, p.r)?.blocksPrim)) break; await this.primStep(na, []); k++; }
      if (k) { await this.primEndMove([]); this.say(`${this.prim.name}: ${dir} 방향으로 ${k}칸 멀어짐 → ${cellLabel(this.prim.anchor)} 기준`, 'ai'); }
      this.notify(); return k ? prev : [];
    },
    async oracleMoveTF(n, face = false) {
      const prev = this.primCells();
      if (this.prim.disabled.tfMove) { this.say('(Timefront 쪽 이동 비활성 — Unholy Chasuble)'); if (face) this.faceMost(); return []; }
      if (this.timefront == null) { this.say('(Timefront 없음 — 이동 없음)'); if (face) this.faceMost(); return []; }
      let k = 0;
      for (let i = 0; i < n; i++) { const minC = Math.min(...this.primCells().map(p => p.c)); if (minC <= this.timefront + 1) break; const na = add(this.prim.anchor, 'W'); if (this.primCells(na).some(p => !this.board.inBounds(p.c, p.r) || this.board.terrainAt(p.c, p.r)?.blocksPrim)) break; await this.primStep(na, []); k++; }
      if (k) { await this.primEndMove([]); this.say(`${this.prim.name}: Timefront 쪽으로 ${k}칸 → ${cellLabel(this.prim.anchor)} 기준`, 'ai'); }
      if (face) { this.faceMost(); this.say(`${this.prim.name}: 가장 많은 타이탄 쪽(${this.prim.facing})으로 회전`); }
      this.notify(); return k ? prev : [];
    },
    placeIce(cells, giant) {
      const ok = (cells || []).filter(p => this.board.inBounds(p.c, p.r) && !this.primContains(p) && !this.titanAt(p.c, p.r) && !this.board.terrainAt(p.c, p.r) && !(this.timefront != null && p.c <= this.timefront));
      if (!ok.length) { this.say('Glaciate: 놓을 빈 칸 없음'); return; }
      this._iceN = (this._iceN || 0) + 1;
      ok.forEach((p, i) => { const id = giant ? 'gice' + this._iceN : 'ice' + this._iceN + '_' + i; this.board.terrain.set(key(p.c, p.r), { id, type: giant ? 'Giant Black Iceberg' : 'Black Iceberg', obstacle: true, obscuring: true, destructible: true, iceberg: true, trap: true, cell: p }); });
      this.say(`${giant ? 'Giant Glaciate' : 'Glaciate'}: ${ok.map(cellLabel).join(', ')}에 ${giant ? 'Giant ' : ''}Black Iceberg`, 'ai'); this.notify();
    },
    async teleportTitan(t) {
      if (!this.onBoard(t) || t.onVP) return;
      let cand = this.frontAdjCells().filter(p => this.freeCellFor(t, p)); if (!cand.length) cand = Board.adjacentCells(this.primCells()).filter(p => this.freeCellFor(t, p));
      if (!cand.length) { this.say(`${t.name}: 텔레포트할 칸 없음`); return; }
      const dest = cand.length === 1 ? cand[0] : (await this.ask({ type: 'move', titan: t, title: `${t.name}: ${this.prim.name} 옆 텔레포트 칸 (정면 우선)`, cells: cand, options: cand.map(q => ({ label: cellLabel(q), value: q })) })) || cand[0];
      t._prevPos = { ...t.pos }; t.pos = { ...dest }; this.say(`${t.name}: ${cellLabel(dest)}로 텔레포트`, 'ai'); this.notify(); await this.landOn(t);
    },

    // ---------------- Laser geometry ----------------
    sideCells(d) { const cells = this.primCells(); return cells.map(x => add(x, d)).filter(y => !this.primContains(y)); },
    beam(start, d) {
      let p = { ...start };
      for (let i = 0; i < 40 && this.board.inBounds(p.c, p.r); i++) {
        if (this.primContains(p)) return null;
        const o = this.titanAt(p.c, p.r); if (o) return { kind: 'titan', t: o, cell: p, dir: d };
        const ter = this.board.terrainAt(p.c, p.r); if (ter && ter.obstacle) return { kind: 'ter', ter, cell: p, dir: d };
        p = add(p, d);
      }
      return null;
    },
    async laserLateral(t) {
      if (!this.onBoard(t) || t.onVP) return;
      this.facePrim(t.pos); const f = this.prim.facing; const lat = PERP[f]; const axis = DIRS[f][0] ? 'r' : 'c';
      const lanes = () => this.sideCells(f).map(p => p[axis]);
      const aligned = () => lanes().includes(t.pos[axis]) && this.inFront(t.pos);
      let g = 0;
      while (!aligned() && g++ < 20) {
        const L = lanes(); const want = t.pos[axis]; const dirSign = want > Math.max(...L) ? 1 : -1;
        const d = lat.find(x => DIRS[x][axis === 'r' ? 1 : 0] === dirSign); if (!d) break;
        const na = add(this.prim.anchor, d); if (this.primCells(na).some(p => !this.board.inBounds(p.c, p.r) || (this.timefront != null && p.c <= this.timefront) || this.board.terrainAt(p.c, p.r)?.blocksPrim)) break;
        await this.primStep(na, [t]);
      }
      if (g) { await this.primEndMove([t]); this.facePrim(t.pos); this.say(`${this.prim.name}: Lateral 이동 → ${cellLabel(this.prim.anchor)} 기준 (${t.name} 정렬${aligned() ? '' : ' 실패'})`, 'ai'); }
      this.notify(); if (!t.alive) throw new TitanDied(t);
    },
    mainBeam(t) {
      const f = this.prim.facing; const axis = DIRS[f][0] ? 'r' : 'c';
      let origin = this.sideCells(f).find(p => p[axis] === t.pos[axis]);
      let before = null;
      if (origin && this.inFront(t.pos)) { before = { c: t.pos.c - DIRS[f][0], r: t.pos.r - DIRS[f][1] }; }
      else { // not aligned: approximate with the nearest outside cell toward the target
        const cells = Board.adjacentCells(this.primCells()); origin = cells.reduce((a, b) => Board.dist(b, t.pos) < Board.dist(a, t.pos) ? b : a);
        const dx = Math.sign(origin.c - t.pos.c), dy = Math.sign(origin.r - t.pos.r); before = Math.abs(origin.c - t.pos.c) >= Math.abs(origin.r - t.pos.r) ? { c: t.pos.c + dx, r: t.pos.r } : { c: t.pos.c, r: t.pos.r + dy };
      }
      // Rule: only a Titan / Obstacle in the laser's path AND adjacent to the original Target replaces it (once per Attack)
      if (before && !this.primContains(before) && !(before.c === t.pos.c && before.r === t.pos.r) && Board.dist(before, t.pos) === 1) {
        const o = this.titanAt(before.c, before.r); const ter = this.board.terrainAt(before.c, before.r);
        if (o && o !== t) { this.say(`Laser: 경로상 ${o.name}이(가) ${t.name} 앞에 있음 — 타겟 변경`, 'ai'); return { res: { kind: 'titan', t: o, cell: before, dir: f }, origin }; }
        if (ter && ter.obstacle) { this.say(`Laser: 경로상 ${ter.type}이(가) ${t.name} 앞에 있음 — 타겟 변경`, 'ai'); return { res: { kind: 'ter', ter, cell: before, dir: f }, origin }; }
      }
      if (!t.onVP && this.board.labAt && this.board.labAt(t.pos.c, t.pos.r)) { this.say(`Laser: ${t.name}은(는) Labyrinth 타일 안 — 보호됨 (FAQ)`, 'good'); return { res: null, origin }; }
      return { res: { kind: 'titan', t, cell: t.pos, dir: f }, origin };
    },
    laserHandle(r, card, hits, ctx, depth = 0) {
      if (!r) return;
      if (r.kind === 'titan') { hits.push(r.t); return; }
      const ter = r.ter;
      if (card.oracle && card.oracle.sideways && (ter.iceberg || card.oracle.sidewaysAll) && depth < 4) {
        this.say(`Laser: ${ter.type} ${cellLabel(r.cell)}에서 옆으로 반사`, 'ai');
        for (const p of PERP[r.dir]) { let s = { ...r.cell }; while (this.board.terrainAt(s.c, s.r)?.id === ter.id) s = add(s, p); const k = `${s.c},${s.r},${p}`; if (ctx.seen.has(k)) continue; ctx.seen.add(k); this.laserHandle(this.beam(s, p), card, hits, ctx, depth + 1); }
        return;
      }
      if (ter.indestructible) { this.say(`Laser: ${ter.type}에 막힘`); return; }
      if (!ctx.destroyed.has(ter.id)) { ctx.destroyed.add(ter.id); this.board.removeTerrainId(ter.id); this.say(`Laser: ${ter.type} (${cellLabel(r.cell)}) 파괴`, 'ai'); }
    },
    laserKind(card, t) {
      const O = card.oracle; let k = O.laser;
      if (k === 'single' && O.up && this.pdx(O.up, t)) { k = 'double'; this.say(`${O.up.p ? `Paradox ${O.up.p}+` : ''}${O.up.f ? ` 또는 Fate ${O.up.f}+` : ''} — Double Laser`, 'ai'); }
      if (k === 'double' && this.prim.disabled.doubleLaser) { k = 'single'; this.say('(Double Laser 비활성 — Living Lenses)'); }
      return k;
    },
    laserTargets(card, primary) {
      const hits = []; const ctx = { seen: new Set(), destroyed: new Set() }; const kind = primary ? this.laserKind(card, primary) : card.oracle.laser;
      if (kind === 'timefront') {
        if (this.timefront == null) { this.say('(Timefront 없음 — Timefront Laser 없음)'); return { hits, kind }; }
        for (let r = 1; r <= this.board.rows; r++) this.laserHandle(this.beam({ c: this.timefront + 1, r }, 'E'), card, hits, ctx);
        return { hits, kind };
      }
      const { res, origin } = this.mainBeam(primary); this.laserHandle(res, card, hits, ctx);
      this._laserSwap = (res && !(res.kind === 'titan' && res.t === primary)) ? { from: primary, to: res.kind === 'titan' ? res.t : null } : null;
      const used = k => origin && k.c === origin.c && k.r === origin.r;
      if (kind === 'double') for (const s of this.sideCells(this.prim.facing)) if (!used(s)) this.laserHandle(this.beam(s, this.prim.facing), card, hits, ctx);
      if (kind === 'omni') for (const d of DIR_LIST) for (const s of this.sideCells(d)) if (!(d === this.prim.facing && used(s))) this.laserHandle(this.beam(s, d), card, hits, ctx);
      for (const x of hits) { x._laserX = (typeof card.tier === 'number' ? card.tier : (card.level || (this.prim.level >= 7 ? 3 : this.prim.level >= 4 ? 2 : 1))) + 1; x._laserR = this.round; }
      this.say(`${kind === 'single' ? 'Laser' : kind === 'double' ? (this.prim.size === 3 ? 'Triple Laser' : 'Double Laser') : kind === 'omni' ? 'Omnilaser' : 'Laser'} 대상: ${hits.map(x => x.name).join(', ') || '(타이탄 없음)'}`, 'ai');
      return { hits, kind };
    },

    // ---------------- dealing FATE / DANGER (Death by Fate, Danger/Fate bonus) ----------------
    async dealFD(t, f, d, card, hits = 1, dFn = null, opts = {}) {
      if (!t || !t.alive) return;
      if (d > 0 && (opts.laser || opts.sunHit || (card && card.oracle && card.oracle.laser)) && this.ab(t, 'In Light and Shade')) { const nd = Math.max(hits, d - hits); if (nd < d) { this.say(`${t.name}: In Light and Shade — 명중당 Danger −1 (${d} → ${nd})`, 'good'); d = nd; } }
      if (d > 0 && (opts.laser || opts.sunHit || (card && ((card.oracle && card.oracle.laser) || (card.midas && card.midas.laser) || card.sun))) && this.gearHas(t, /Each Laser Attack hit and Sun Attack hit deals 1 DANGER less to you/)) { const nd = Math.max(hits, d - hits); if (nd < d) { this.say(`${t.name}: Scorch Conditioning — hit당 Danger −1 (${d} → ${nd})`, 'good'); d = nd; } }
      const B = opts.noBonus ? 0 : (this.prim.bonus.DF || 0); const bonus = B ? (this.prim.bonusPerHit ? B * hits : B) : 0;
      if (bonus) { if (f > 0) f += bonus; else d += bonus; }
      { const DB = opts.noBonus ? 0 : (this.prim.bonus.DANGER || 0); if (DB && (d > 0 || f > 0)) { const add = this.prim.bonusPerHit ? DB * hits : DB; d += add; this.say(`Danger 보너스 +${add}`); } }
      if (d > 0 && (opts.laser || (card && card.oracle && card.oracle.laser)) && this.laserRes(t)) { const nd = Math.max(0, d - this.laserRes(t) * hits); this.say(`${t.name}: Laser Resistance — Danger ${d} → ${nd}`, 'good'); d = nd; }
      if (d > 0 && (opts.sunHit || (card && card.sun))) { let sr = 0; for (const g of t.gear) { if (g.discarded || g.exhausted) continue; const m = /Sun Resistance (\d)/.exec(this.gearText(g, t)); if (m) sr += +m[1]; } if (sr) { const nd = Math.max(0, d - sr * hits); this.say(`${t.name}: Sun Resistance ${sr} — Danger ${d} → ${nd}`, 'good'); d = nd; } }
      if (opts.laser && this.prim.laserMalus && d > 0) { const nd = Math.max(1, d - this.prim.laserMalus); this.say(`Lens-Eyes: Laser Danger ${d} → ${nd}`); d = nd; }
      const judge = this.isJudge(card);
      let fateArmored = false;
      if (f > 0 && !judge && !opts.noArmor && !dFn && !(t.conditions || []).includes('Paralyzed')) { const fa = t.gear.filter(g => !g.discarded && !g.exhausted && /Fate Armor/.test(this.gearText(g, t)) && (g.card.armor || []).length); if (fa.length) { const faDice = fa.flatMap(g => [...g.card.armor, ...(/If you are on your Time Anchor, this card has \+1 Armor die \(r\)/.test(this.gearText(g, t)) ? ['r'] : [])]); const other = this.armorDice(t); for (const x of faDice) { const i = other.indexOf(x); if (i >= 0) other.splice(i, 1); } const rf = this.rollPower(faDice), ro = this.rollPower(other); const mf = rf.reduce((a, x) => a + facePower(x.face), 0), mo = ro.reduce((a, x) => a + facePower(x.face), 0); this.say(`${t.name}: Armor Roll (Fate Armor) [${rf.map(x => x.face).join(' ')}] + [${ro.map(x => x.face).join(' ')}] → Fate Armor ${mf}, 기타 ${mo}`); let toF = Math.min(mf, f); if (mf && d > 0) toF = await this.ask({ type: 'choice', titan: t, title: `Fate Armor 감소 ${mf}: Fate(${f})와 Danger(${d})에 배분 — Fate에 몇?`, options: Array.from({ length: Math.min(mf, f) + 1 }, (_, i) => ({ label: `Fate −${i}, Danger −${Math.min(d, mf - i + mo)}`, value: i })).reverse() }); f -= toF; d = Math.max(0, d - (mf - toF) - mo); fateArmored = true; this.say(`Fate Armor: Fate −${toF} → ${f}, Danger → ${d}`, 'good'); } }
      let vf = t.fate;
      if (f > 0) { vf = t.fate + f; t.fate = Math.min(9, vf); this.say(`${t.name}: Fate +${f}${bonus && f > 0 ? ` (보너스 +${bonus} 포함)` : ''} → ${t.fate}${vf > 9 ? ` (가상 ${vf})` : ''}`, 'dmg'); if (this.currentAI) this.currentAI.fateDealt = (this.currentAI.fateDealt || 0) + f; }
      if (dFn) d += dFn(vf);
      let vd = null;
      if (d > 0) { const before = t.danger; if (this.currentAI) this.currentAI.dangerDealt += d; const n = await this.gainDanger(t, d, { fromAttack: true, noArmor: judge || !!dFn || !!opts.noArmor || fateArmored, source: card.name, skipTrauma: true }); if (!t.alive) return; if (n > 0) vd = before + n; }
      const dbf = this.trait('Death by Fate');
      if (t._gfDone) t._gfDone = false; else if (vd != null || (dbf && f > 0)) { const virtual = Math.max(vd != null ? vd : t.danger, dbf ? vf : 0); await this.traumaDraw(t, virtual); }
      return f;
    },
    async discardGearN(t, n, weaponOnly) {
      for (let i = 0; i < n; i++) { const list = t.gear.filter(g => !g.discarded && g.card.name !== 'Fists' && !g.card.isTech && (!weaponOnly || (/^hand/.test(g.card.slot) && g.card.atk != null))); if (!list.length) return; const g = list.length === 1 ? list[0] : await this.pickGear(t, list); if (g) this.discardGear(t, g); }
    },

    // ---------------- attack-effect sentences (inside primAttackOn) ----------------
    async oracleEffect(t, s, hits, card) {
      let m; s = s.trim();
      if ((m = /^FATE (\d)\+: (.*)$/.exec(s))) { if (this.effFate(t) >= +m[1]) { this.say(`(Fate ${m[1]}+ 적용)`); await this.oracleEffect(t, m[2], hits, card); } return true; }
      if ((m = /^If the Laser Attack hits an Iceberg, it continues sideways\. (.*)$/.exec(s))) return this.oracleEffect(t, m[1], hits, card);
      if ((m = /^Each hit deals (\d) (FATE|DANGER)(?: and (\d) (FATE|DANGER))?\.(.*)$/.exec(s))) {
        let f = 0, d = 0; const a1 = +m[1] * hits; if (m[2] === 'FATE') f += a1; else d += a1; if (m[3]) { const a2 = +m[3] * hits; if (m[4] === 'FATE') f += a2; else d += a2; }
        const tail = (m[5] || '').trim(); let dFn = null; if (/^If hit, gain DANGER equal to your FATE/.test(tail)) dFn = vf => Math.min(vf, 9);
        const dealt = await this.dealFD(t, f, d, card, hits, dFn); if (!t.alive) return true;
        let mm;
        if ((mm = /If 2\+ FATE was dealt, discard 1 Gear card, if 4\+ FATE was dealt, discard 2 Gear cards instead/.exec(tail))) { if (dealt >= 2) await this.discardGearN(t, dealt >= 4 ? 2 : 1, false); }
        else if (/If 2\+ FATE was dealt, discard 1 Gear card\. \| FATE (\d)\+: Discard 1 Weapon card instead/.test(tail)) { const ff = +/FATE (\d)\+/.exec(tail)[1]; if (dealt >= 2) await this.discardGearN(t, 1, this.effFate(t) >= ff); }
        return true;
      }
      if ((m = /^If the Attack hits, it deals (\d+) DANGER\. Death (\d)\.(?: \| FATE (\d)\+: Death (\d) instead)?$/.exec(s))) { const fateNow = this.effFate(t); await this.dealFD(t, 0, +m[1], card, 1); if (!t.alive) return true; const x = m[3] && fateNow >= +m[3] ? +m[4] : +m[2]; await this.addCondition(t, 'Death', { tokens: x }); return true; }
      if (/^Time-clocked\.?$/.test(s)) { await this.timeClock(t); return true; }
      if (/^Rewind\.?$/.test(s)) { await this.oracleRewind(t); return true; }
      if (/^One hit, draw Major Trauma, two hits, draw Grave Trauma, three or more hits, draw an Obol/.test(s)) { if (hits >= 3) await this.obolDraw(t, 10); else await this.traumaDraw(t, Math.max(t.danger, t.fate, 1), hits >= 2 ? 'Grave' : 'Major'); return true; }
      if (/^One hit, draw Grave Trauma, two hits, draw an Obol, three hits, you die, four hits, you are erased from existence/.test(s)) { if (hits >= 4) { this.say(`${t.name}: 4 hit — 존재에서 지워짐`, 'bad'); await this.kill(t, { erased: true }); } else if (hits === 3) { this.say(`${t.name}: 3 hit — 사망`, 'bad'); await this.kill(t); } else if (hits === 2) await this.obolDraw(t, 10); else await this.traumaDraw(t, Math.max(t.danger, t.fate, 1), 'Grave'); return true; }
      if (/^If you are hit, draw an Obol/.test(s)) { await this.obolDraw(t, 10); return true; }
      if (/^If you are hit, you die/.test(s)) { this.say(`${t.name}: 맞음 — 사망`, 'bad'); await this.kill(t); return true; }
      return false;
    },

    // ---------------- response / after sentences (doSentence) ----------------
    async oracleSentence(t, p, ctx = {}) {
      let m; const alive = !!(t && t.alive);
      if (/^Rewind all Titans$/.test(p)) { for (const x of this.liveTitans()) if (x.offBoard !== 'omega') await this.solo(() => this.oracleRewind(x)); return true; }
      if (/^Rewind$/.test(p)) { if (alive) await this.oracleRewind(t); return true; }
      if (/^Glaciate the previous Attacker space$/.test(p)) { if (t && t._prevPos) this.placeIce([t._prevPos], false); else this.say('(이전 칸 없음 — Glaciate 생략)'); return true; }
      if (/^Gain FATE equal to the Primordial LVL$/.test(p)) { if (alive) { this.say(`${t.name}: Fate +${this.prim.level}`); await this.gainFate(t, this.prim.level, { nc: true }); } return true; }
      if (/^Time-clocked$/.test(p)) { if (alive) await this.timeClock(t); return true; }
      if ((m = /^Gain \+(\d) FATE and the (Muffled|Sealed) Condition card$/.exec(p))) { if (alive) { await this.gainFate(t, +m[1], { nc: true }); if (t.alive) await this.addCondition(t, m[2]); } return true; }
      if ((m = /^Gain the (Muffled|Sealed) Condition card$/.exec(p))) { if (alive) await this.addCondition(t, m[1]); return true; }
      if ((m = /^Gain \+(\d) FATE$/.exec(p))) { if (alive) { this.say(`${t.name}: Fate +${m[1]}`); await this.gainFate(t, +m[1], { nc: true }); } return true; }
      if ((m = /^The Oracle moves (\d) spaces directly away from the (Attacker|Target)(?: \(without turning\))?$/.exec(p))) { this._prevPrim = await this.oracleMoveAway(t ? (t.offBoard ? t._prevPos : t.pos) : null, +m[1]); return true; }
      if (/^Giant Glaciate the previous Primordial space$/.test(p)) { this.placeIce(this._prevPrim || [], true); return true; }
      if ((m = /^Move the Timefront (\d) spaces? (forward|backward)$/.exec(p))) { await this.moveTF(m[2] === 'forward' ? +m[1] : -m[1]); return true; }
      if (/^Draw a Moiros card$/.test(p)) { if (alive) await this.drawMoiros(t); return true; }
      return false;
    },

    // ---------------- criticals ----------------
    async oracleCritical(t, A) {
      const c = A.bp.critical || '';
      if (/^Disable the Atemporal effect/.test(c)) { this.prim.disabled.atemporal = true; this.say('Atemporal 효과 비활성화', 'good'); return true; }
      if (/^Disable 'The Oracle moves towards the Timefront' effects/.test(c)) { this.prim.disabled.tfMove = true; this.say("'Oracle이 Timefront 쪽으로 이동' 효과 비활성화", 'good'); return true; }
      if (/^You may reset FATE and perform a Bonus Attack/.test(c)) { if (t.fate > 0) { const ok = await this.ask({ type: 'yn', titan: t, title: `Temporal Icicle Gland: Fate ${t.fate} → 0으로 초기화?`, options: [{ label: '초기화', value: true }, { label: '유지', value: false }] }); if (ok) { t.fate = 0; this.say(`${t.name}: Fate 0`, 'good'); } } this.pendingFollowUp = t; return true; }
      if (/^Move the Timefront 3 spaces backward/.test(c)) { await this.moveTF(-3, 'Critical'); return true; }
      if (/^Disable the Quantum Eye Trait/.test(c)) { this.prim.disabled['Quantum Eye'] = true; this.say('Quantum Eye 비활성화', 'good'); return true; }
      if (/^Disable Double Laser Attacks/.test(c)) { this.prim.disabled.doubleLaser = true; this.say('Double Laser 비활성화', 'good'); return true; }
      if (/^Disable Hypertime Oracle's Rewinds/.test(c)) { this.prim.disabled.rewind = true; this.say('Oracle의 Rewind 비활성화', 'good'); return true; }
      if (/^The Oracle dies/.test(c)) { this.say(`🏆 ${this.prim.name}이(가) 죽었습니다!`, 'good'); throw new BattleOver('victory'); }
      if (/^Remove the Timefront from the Board/.test(c)) { this.setTF(null); this.say('Timefront를 보드에서 제거', 'good'); this.notify(); return true; }
      if (/\(campaign\)/.test(c)) { this.say(`(${c} — 캠페인 보상)`, 'sys'); return true; }
      return false;
    },

    // ---------------- AI card resolution ----------------
    async oracleWindow(t, card, label) { if (this.trait('Overclocked') && card.oracle && card.oracle.laser) { this.say('Overclocked: Laser 앞의 ⚡ 무시', 'sys'); return; } if (t) await this.reactionWindow(t, card, label); },
    async oracleAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const O = card.oracle;
      if (O.special) return this.oracleSpecial(card, { isSignature, forcedTarget });
      if (O.laser === 'timefront') {
        const { hits } = this.laserTargets(card, null); await this.oracleResolveHits(card, hits); await this.oracleAfter(card, null, hits); return;
      }
      const primary = forcedTarget && this.onBoard(forcedTarget) ? forcedTarget : await this.unearthly(card, this.pickTarget(card.target, true));
      if (!primary) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); }
      if (O.sequential) return this.oracleSequential(card, primary);
      this._lastHits = [primary];
      try { await this.oracleOne(card, primary); } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied)) throw e; }
      await this.oracleAfter(card, primary, this._lastHits || [primary]);
    },
    async oracleOne(card, primary) {
      const O = card.oracle; this.say(`타겟: ${primary.name}`);
      if (card.steps[0] && card.steps[0].startsWith('⚡')) await this.oracleWindow(primary, card, card.steps[0].replace('⚡ ', '').split(' |')[0]);
      for (const pr of O.pre || []) { if (!this.pdx(pr.cond, primary)) continue; if (pr.win) await this.reactionWindow(primary, card, pr.k); if (pr.k === 'tf+') await this.moveTF(pr.n, card.name); if (pr.k === 'erase' && primary.alive) { this.say(`${primary.name}: ${pr.cond.p ? `Paradox ${pr.cond.p}+ 또는 ` : ''}Fate ${pr.cond.f}+ — 존재에서 지워짐`, 'bad'); await this.solo(() => this.kill(primary, { erased: true })); } }
      if (!this.onBoard(primary)) { this._lastHits = []; return; }
      if (O.move === 'move' && !primary.onVP) { this.facePrim(primary.pos); const path = await this.choosePrimPath(primary.pos, 99, [primary], card); for (const st of path) { await this.primStep(st, [primary]); if (!primary.alive) throw new TitanDied(primary); } await this.primEndMove([]); if (path.length) this.say(`${this.prim.name} 이동 → ${cellLabel(this.prim.anchor)} 기준`); if (!primary.alive) throw new TitanDied(primary); this.facePrim(primary.pos); }
      else if (O.move === 'lateral') await this.laserLateral(primary);
      else if (O.move === 'teleport') await this.teleportTitan(primary);
      if (O.laser) { const { hits } = this.laserTargets(card, primary); this._lastHits = hits.length ? hits : []; await this.oracleResolveHits(card, hits); return; }
      this._lastHits = [primary];
      if (!this.isJudge(card) && !this.isAdj(primary)) { this.say('타겟이 사거리 밖 — 공격 생략'); return; }
      if (!primary.onVP) this.facePrim(primary.pos);
      const h = await this.primAttackOn(primary, card); this.currentAI.lastHits = h || 0;
    },
    async oracleResolveHits(card, hits) {
      this._oracleKills = 0;
      for (const t of hits) { if (!this.onBoard(t)) continue; try { await this.primAttackOn(t, card); } catch (e) { if (e instanceof BattleOver) throw e; if (e instanceof TitanDied) { this._oracleKills++; continue; } throw e; } if (!t.alive) this._oracleKills++; }
      if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); }
    },
    async oracleAfter(card, primary, hits) {
      const O = card.oracle; const list = O.after || []; if (!list.length) return;
      if (O.laser && primary && this._laserSwap && this._laserSwap.from === primary) { const to = this._laserSwap.to; this.say(to ? `Laser: 타겟이 ${to.name}(으)로 바뀜 — After Attack 효과도 ${to.name}에게` : 'Laser: 장애물이 타겟이 됨 — 원래 타겟 기준 After Attack 효과 무시', 'ai'); primary = to; hits = hits.filter(x => x !== this._laserSwap.from); }
      this._laserSwap = null;
      const tgts = [...new Set([...(primary ? [primary] : []), ...hits])];
      if (O.afterWin) await this.reactionWindow(tgts.find(x => x.alive) || this.liveTitans()[0] || this.titans[0], card, 'After Attack');
      for (const a of list) {
        if (a.k === 'away') { if (!primary || !primary.alive) { this.say('(Mercy Rule: 대상이 죽음 — 대상 기준 After Attack 효과 생략)'); continue; } const ref = !primary.offBoard ? primary.pos : primary._prevPos; const prev = await this.oracleMoveAway(ref, a.n); if (a.glac && prev) this.placeIce(prev, a.glac === 'giant'); }
        else if (a.k === 'tf') { const prev = await this.oracleMoveTF(a.n, a.face); if (a.glac) this.placeIce(prev, a.glac === 'giant'); }
        else if (a.k === 'rewind') { for (const x of tgts) if (x.alive) await this.solo(() => this.oracleRewind(x)); }
        else if (a.k === 'clock') { for (const x of tgts) if (this.onBoard(x)) await this.solo(() => this.timeClock(x)); }
        else if (a.k === 'tfKill') { const k = this._oracleKills || 0; if (k) await this.moveTF(k, `사망 ${k}명`); else this.say('(이 공격으로 죽은 타이탄 없음)'); }
        else if (a.k === 'tfFate6') { const k = this.liveTitans().filter(x => x.fate >= 6).length; if (k) await this.moveTF(k, `Fate 6+ ${k}명`); else this.say('(Fate 6+ 타이탄 없음)'); }
      }
    },
    async oracleSequential(card, first) {
      const done = new Set(); let t = first; let g = 0;
      while (t && g++ < 8) { done.add(t.id); this._otHit = done; try { await this.solo(async () => { await this.oracleOne(card, t); }); } finally { this._otHit = null; } const rest = this.boardTitans().filter(x => !done.has(x.id)); if (!rest.length) break; const m = Math.max(...rest.map(x => this.distTo(x))); t = rest.find(x => this.distTo(x) === m); if (t) this.say(`${card.name} 반복 → ${t.name}`, 'ai'); }
      await this.oracleAfter(card, null, []);
    },
    async oracleSpecial(card, opts) {
      const k = card.oracle.special;
      if (k === 'skip') { this.say(`ROUTINE 「${card.name}」: ${card.text}`, 'ai'); await this.oracleMoveTF(4, false); await this.escalateX(1); return; }
      if (k === 'medias') {
        const tiers = ['Minor', 'Major', 'Grave']; const doneM = new Set();
        for (let i = 0; i < 3; i++) { const rest = this.liveTitans().filter(x => !doneM.has(x)); if (!rest.length) break; const mn = Math.min(...rest.map(x => x.fate)); const tie = rest.filter(x => x.fate === mn); const t = tie.length === 1 ? tie[0] : (await this.ask({ type: 'choice', title: `In Medias Res: Fate ${mn}로 같은 타이탄이 여럿 — ${tiers[i]} Trauma를 받을 타이탄 선택`, options: tie.map(x => ({ label: `${x.name} (Fate ${x.fate})`, value: x })) }) || tie[0]); doneM.add(t); this.say(`In Medias Res: ${t.name} (Fate ${t.fate}) — ${tiers[i]} Trauma`, 'ai'); await this.solo(async () => { try { await this.traumaDraw(t, Math.max(t.danger, t.fate, 1), tiers[i]); } catch (e) { if (!e.chainBreak) throw e; this.say('In Medias Res: Chain Break 불가 — 보너스 공격 해결 후 계속', 'sys'); if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); } } }); } // In Medias Res cannot be Chain Broken: bonus attacks resolve, then the card continues
        card._removed = true; this.say('In Medias Res: 전투에서 제거, AI 카드 한 장 더', 'ai'); const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); } return;
      }
      if (k === 'darkest') {
        await this.oracleMoveTF(4, false);
        for (const x of this.liveTitans()) if (x.offBoard !== 'omega') await this.solo(() => this.oracleRewind(x));
        await this.oracleLevelUp();
        card._removed = true; if (this.setAsideAI) { this.ai.shuffleIn(this.setAsideAI); this.say(`「${this.setAsideAI.name}」을(를) AI 덱에 섞음`, 'ai'); this.setAsideAI = null; }
        const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); } return;
      }
      if (k === 'tyranny') {
        const all = this.boardTitans(); if (!all.length) { this.say('타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); }
        await this.oracleWindow(all[0], { name: card.name }, 'Teleport All Titans');
        for (const t of all) { if (!this.onBoard(t) || t.onVP) continue; await this.solo(async () => { await this.teleportTitan(t); await this.reestablishAnchor(t); }); }
        this.say('Tyranny of Stars: 텔레포트된 타이탄의 Time Anchor 재설정', 'ai');
        await this.reactionWindow(this.boardTitans()[0] || this.titans[0], card, 'Signature vs 인접 타이탄');
        const sig = { ...this.sig, oracle: { ...this.sig.oracle, after: [] } };
        for (const t of this.boardTitans().filter(x => this.isAdj(x))) { if (!this.onBoard(t)) continue; this.say(`Tyranny of Stars: ${t.name}에게 Signature (After Attack 무시)`, 'ai'); await this.safe(() => this.oracleAI(sig, { isSignature: true, forcedTarget: t })); }
        await this.reactionWindow(this.liveTitans()[0] || this.titans[0], card, 'After Final Attack');
        const mx = Math.max(0, ...this.liveTitans().map(x => this.effFate(x)));
        if (this.paradox >= 4 || mx >= 8) await this.moveTF(1, 'Tyranny of Stars');
        await this.oracleMoveTF(5, true); return;
      }
    },
    async oracleLevelUp() {
      const P = this.prim.def; const nl = Math.min(9, this.prim.level + 1); if (nl === this.prim.level) { this.say('(이미 최고 레벨)'); return; }
      const L = P.levels[String(nl)]; const L0 = P.levels[String(this.prim.level)] || {}; const b0 = L0.bonus || {}, b1 = L.bonus || {}; this.prim.level = nl; this.prim.toHit = L.toHit; this.prim.wounds = L.wounds; const nb = { AT: 0, PRECISION: 0, EVADE_DICE: 0, DANGER: 0, ESCALATION: 0, ...this.prim.bonus }; for (const k of new Set([...Object.keys(b0), ...Object.keys(b1)])) nb[k] = (nb[k] || 0) + (b1[k] || 0) - (b0[k] || 0); this.prim.bonus = nb; const escD = (b1.ESCALATION || 0) - (b0.ESCALATION || 0); this.prim.bonusPerHit = !!L.bonusPerHit;
      for (const tr of L.traits || []) this.prim.traits[tr] = true;
      this.say(`Darkest Timeline: ${this.prim.name} Lv.${nl}로 상승 — To Hit ${L.toHit}+, 상처 ${L.wounds}, 새 트레이트: ${(L.traits || []).join(', ') || '없음'}`, 'bad'); this.notify(); if (escD > 0) { this.say(`Darkest Timeline: Escalation +${escD}`); await this.escalateX(escD); }
    },

    // ---------------- round hooks ----------------
    async oraclePrimRoundStart(add = null) { const direct = !add; const T = []; if (direct) add = (l, r) => T.push(r);
      if (this.trait('Gaze of the Void')) add('Gaze of the Void (트레이트)', async () => { if (this.trait('Gaze of the Void') && this.round > 1) { const v = this.boardTitans().filter(t => !t.onVP && this.inFront(t.pos)); if (v.length) { this.say(`Gaze of the Void: 정면의 타이탄 사망 — ${v.map(t => t.name).join(', ')}`, 'bad'); for (const t of v) await this.solo(() => this.kill(t)); } } });
      if (this.trait('Extinguish Possibilities')) add('Extinguish Possibilities (트레이트)', async () => { if (this.trait('Extinguish Possibilities')) { for (const [n, d] of Object.entries(this.trauma)) { const c = d.peek(); if (!c) continue; if (c.pol === '+') { d.cards.shift(); this.say(`Extinguish Possibilities: ${n} Trauma 맨 위 「${c.name}」(긍정) 전투에서 제거`, 'ai'); } else this.say(`Extinguish Possibilities: ${n} Trauma 맨 위 「${c.name}」(부정) — 그대로`); } } });
      if (direct) for (const r of T) await r();
    },
    async oracleTitanRoundStart() {
      if (this.trait('Layover')) { const b = this.boardTitans(); if (b.length) { const mx = Math.max(...b.map(t => t.fate)); const c = b.filter(t => t.fate === mx); const v = c.length === 1 ? c[0] : (await this.ask({ type: 'choice', title: `Layover: Fate 최고(${mx}) 타이탄이 여럿 — Omega Terminus로 보낼 타이탄 선택`, options: c.map(t => ({ label: `${t.name} (Fate ${t.fate})`, value: t })) }) || c[0]); await this.solo(() => this.toOmega(v, `Layover — Fate 최고 ${mx}`)); } }
    },
    async ouatCheck() { if (this.trait('Once Upon A Time') && this.prim.ouat >= 4) { this.prim.ouat = 0; this.say('Once Upon A Time: 토큰 4개 — AI 카드 추가!', 'ai'); const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); } } },
    async quantumEye(t, bp) { if (!bp || !bp.qeye || this.prim.disabled['Quantum Eye'] || !t || !t.alive) return; this.say(`Quantum Eye: BP 「${bp.name}」(BP ${bp.tier}) 공개 — ${t.name} Fate +${bp.tier}`, 'bad'); await this.gainFate(t, bp.tier, { nc: true }); },
  });
}
