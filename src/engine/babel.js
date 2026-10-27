// Cycle IV — Babelian Lunacy (Eclipse Attacks, Rotate, Staircase Entrance, Tower of Madness, Heavenward, Dome of Folly VPs)
import { Board, key, cellLabel, parseCell, DIRS, DIR_LIST } from './core.js';

const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const CW = { N: 'E', E: 'S', S: 'W', W: 'N' };

export function installBabel(Game, { TitanDied, BattleOver }) {
  const origKill = Game.prototype.kill;
  Game.prototype.kill = async function (t, opts = {}) {
    const was = t && t.alive; try { await origKill.call(this, t, opts); }
    finally { if (was && !t.alive && this.prim && this.prim.def.babelD && this.prim.level === 1) { const dead = this.titans.filter(x => !x.alive).length; if (dead >= 2 && this.liveTitans().length) { this.say(`Pandora Horizon: 타이탄 ${dead}명 사망 — 패배`, 'bad'); throw new BattleOver('defeat'); } } }
  };
  const origGainMidas = Game.prototype.gainMidas;
  Game.prototype.gainMidas = async function (t, n = 1, ...rest) {
    await origGainMidas.call(this, t, n, ...rest);
    if (this.prim && this.prim.def.babelD && this.trait('Fate of a Debtor') && !this._fod && n > 0 && rest[2] !== 'convert') { this._fod = true; try { this.say(`Fate of a Debtor: 다른 타이탄 모두 Midas ${n}`, 'bad'); for (const x of this.liveTitans().filter(y => y !== t)) await this.solo(() => origGainMidas.call(this, x, n, ...rest)); } finally { this._fod = false; } }
  };
  const origMount = Game.prototype.mountVP;
  Game.prototype.mountVP = function (t, why) { origMount.call(this, t, why); if (this.prim.def.babelD) { this.prim.vpReached = this.prim.vpReached || new Set(); this.prim.vpReached.add(t.id); } };
  const origEsc = Game.prototype.escapeStair;
  Game.prototype.escapeStair = async function (t) { if (!this.prim.def.babelD) return origEsc.call(this, t); return this.babelTop(t); };
  const origEndAttack = Game.prototype.endAttack;
  Game.prototype.endAttack = async function (A) {
    if (this.prim && this.prim.def.babelD && this.trait('Built to Be Broken') && A.bp && !A.wound && !A.combined) await this.safe(() => this.babelLockTier('Built to Be Broken'));
    return origEndAttack.call(this, A);
  };

  Object.assign(Game.prototype, {
    babelSetup() {
      const P = this.prim.def; const L = this.prim.level;
      this.prim.tierLimit = L >= 2 ? 4 : 1; this.prim.stairSegs = []; this.prim.allSegs = [...P.stairs];
      this.prim.ascentBonus = 0; this.prim.babelSVMalus = 0; this.prim.entr = null; this.prim.vpReached = new Set(); this.prim.vpWounders = new Set();
      if (this.trait('Amongst the Bleached Bones')) { this.board.allChasm = 'empty'; this.say('Amongst the Bleached Bones: 지형이 아닌 칸은 모두 Chasm', 'sys'); }
      this.say(`Tower of Madness: Endless Staircase와 VP 잠김 (계단 한도 ${this.prim.tierLimit}단 = ${this.babelLimitLen()}칸) — 계단 밖에서 Wound를 낼 때마다 한 단씩, 다 열리면 VP가 열림`, 'sys');
      if (this.trait('True Babylon')) this.say('True Babylon: (언어 제한 — 싱글플레이에서는 무시)', 'sys');
      if (L === 1) this.say('Pandora Horizon: VP에서 Wound를 내면 승리 · 타이탄 2명이 죽으면 패배', 'sys');
    },
    babelLimitLen() { return this.prim.allSegs.slice(0, this.prim.tierLimit).reduce((a, b) => a + b, 0); },
    // ---------- Staircase Entrance ----------
    babelEntrCell() { return this.prim.entr ? this.prim.entr.cell : null; },
    babelRemoveEntr(why) {
      const E = this.prim.entr; if (!E) return; this.board.terrain.delete(key(E.cell.c, E.cell.r)); if (E.under) this.board.terrain.set(key(E.cell.c, E.cell.r), E.under);
      this.prim.entr = null; this.say(`Staircase Entrance 사라짐${why ? ` (${why})` : ''}`, 'ai'); this.notify();
    },
    babelMoveEntr(spec) {
      if (!spec || spec === 'stay') { if (spec === 'stay') this.say('Staircase: 움직이지 않음'); return; }
      if (spec === 'gone') { this.babelRemoveEntr('Staircase: Disappears!'); return; }
      const p = parseCell(spec); if (this.primContains(p)) return;
      if (this.prim.entr) this.babelRemoveEntr();
      const under = this.board.terrainAt(p.c, p.r);
      this.board.terrain.set(key(p.c, p.r), { id: 'bentr', type: 'Staircase Entrance', obstacle: true, obscuring: true, elevated: true, indestructible: true, destructible: false, climb: 4, entrance: true, cell: p });
      this.prim.entr = { cell: p, under }; this.say(`Staircase Entrance → ${spec}`, 'ai'); this.notify();
    },
    async babelAfterMove(t) {
      const E = this.prim.entr; if (!E || !t.alive || t.onVP || t.stair || t.offBoard) return;
      if (t.pos.c !== E.cell.c || t.pos.r !== E.cell.r) return;
      if (this.stairLen() <= 0) { this.say(`${t.name}: Staircase Entrance — Endless Staircase가 아직 잠김 (Tower of Madness)`); return; }
      await this.moveToStair(t, 'Staircase Entrance');
      if (this.trait('One Fool at a Time')) this.babelRemoveEntr('One Fool at a Time');
    },
    // ---------- Staircase tiers ----------
    babelUnlockTier() { const n = this.prim.stairSegs.length; if (n >= this.prim.tierLimit) return false; this.prim.stairSegs.push(this.prim.allSegs[n]); this.say(`Tower of Madness: Endless Staircase ${n + 1}단 열림 (${this.stairLen()}칸)`, 'good'); this.notify(); return true; },
    async babelLockTier(why) {
      const segs = this.prim.stairSegs; if (!segs.length) return; const len0 = this.stairLen(); segs.pop(); const len = this.stairLen();
      this.say(`${why}: Endless Staircase 맨 위 단 잠김 (${len0} → ${len}칸)`, 'bad');
      for (const x of this.liveTitans().filter(y => y.stair > len)) { this.say(`${x.name}: 잠긴 단 위에 있음 — 사망`, 'bad'); await this.solo(() => this.kill(x)); }
      this.notify();
    },
    async babelTop(t) {
      if (this.vpRoom()) { t.stair = 0; this.mountVP(t, 'Endless Staircase 정상'); await this.addCondition(t, 'Lander'); return; }
      t.stair = this.stairLen(); this.say(`${t.name}: Endless Staircase 정상 — 열린 빈 VP가 없어 맨 위 칸(${t.stair})에 머묾`); this.notify();
    },
    async babelEvac(t) {
      const free = this.iremCellsFree(t); if (!free.length) return false;
      const ok = await this.ask({ type: 'yn', titan: t, title: 'Ascent Check 통과 — 오르는 대신 가장 가까운 빈 Irem Tower로 Wish Away해서 계단을 빠져나갈까요?', options: [{ label: '계속 오름', value: false }, { label: '빠져나감', value: true }] });
      if (!ok) return false;
      const d = p => Board.distToCells(p, this.primCells()); const m = Math.min(...free.map(d)); const c = free.filter(p => d(p) === m);
      const p = c.length === 1 ? c[0] : (await this.ask({ type: 'move', titan: t, title: '빠져나갈 Irem Tower', cells: c, options: c.map(q => ({ label: cellLabel(q), value: q })) })) || c[0];
      t.stair = 0; t.pos = { ...p }; this.say(`${t.name}: Babelian Staircase에서 ${cellLabel(p)}의 Irem Tower로 Wish Away`, 'good'); this.notify(); await this.landOn(t); return true;
    },
    // ---------- Irem Towers (Heavenward / Moon Call) ----------
    async babelRemoveTowers(n, why = '') {
      for (let i = 0; i < n; i++) {
        const tw = this.iremTowers(); if (!tw.length) { this.say('(제거할 Irem Tower 없음)'); return; }
        const d = x => Board.distToCells(x.cell, this.primCells());
        let pool = tw.filter(x => !this.titanAt(x.cell.c, x.cell.r));
        if (!pool.length) { if (!this.trait('Moon Call')) { this.say('(빈 Irem Tower 없음 — 제거 생략)'); return; } pool = tw; this.say('Moon Call: 빈 Irem Tower가 없어 타이탄이 있는 타워를 제거'); }
        const m = Math.min(...pool.map(d)); const c = pool.filter(x => d(x) === m);
        const pick = c.length === 1 ? c[0] : (await this.ask({ type: 'choice', title: `제거할 Irem Tower (Babelian Lunacy에 가장 가까운 빈 타워)${why ? ' — ' + why : ''}`, options: c.map(x => ({ label: cellLabel(x.cell), value: x })) })) || c[0];
        this.board.removeTerrainId(pick.id); this.say(`Irem Tower ${cellLabel(pick.cell)} 제거${why ? ` (${why})` : ''}`, 'ai'); this.notify(); await this.afterTileRemoved(pick.cell);
      }
    },
    babelTowerSpots() { const out = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const p = { c, r }; if (this.board.terrainAt(c, r) || this.primContains(p) || this.titanAt(c, r)) continue; let adj = false; for (let dc = -1; dc <= 1 && !adj; dc++) for (let dr = -1; dr <= 1; dr++) { if ((!dc && !dr) || (dc && dr)) continue; if (this.board.inBounds(c + dc, r + dr) && this.board.terrainAt(c + dc, r + dr)) { adj = true; break; } } if (!adj) out.push(p); } return out; },
    async babelCreateTower(t = null) {
      const spots = this.babelTowerSpots(); if (!spots.length) { this.say('(Irem Tower를 놓을 곳 없음 — Heavenward)'); return; }
      const p = (await this.ask({ type: 'move', titan: t || this.liveTitans()[0], title: 'Heavenward: 새 Irem Tower를 놓을 칸 (다른 지형과 인접하지 않은 빈 칸)', cells: spots, options: spots.slice(0, 40).map(q => ({ label: cellLabel(q), value: q })) })) || spots[0];
      this._bTw = (this._bTw || 0) + 1; this.board.addTerrain([cellLabel(p)], { id: 'birem' + this._bTw, type: 'Irem Tower', irem: 'tower', obstacle: true, obscuring: true, destructible: false, elevated: true, shifting: true, climb: 4 });
      this.say(`Irem Tower 생성 → ${cellLabel(p)}`, 'good'); this.notify();
    },
    async babelShiftTowers(toward) {
      const tw = this.iremTowers().filter(x => this.zoneDist(x.cell) <= 5); const moves = [];
      for (const x of tw) { const dir = this.awayDir(x.cell, this.primCells()); const d = toward ? OPP[dir] : dir; const [dx, dy] = DIRS[d]; moves.push({ x, dx, dy, rider: this.titanAt(x.cell.c, x.cell.r) }); }
      for (const mv of moves) this.board.removeTerrainId(mv.x.id);
      for (const mv of moves) {
        let p = { ...mv.x.cell }; let steps = 0;
        for (let i = 0; i < 2; i++) { const q = { c: p.c + mv.dx, r: p.r + mv.dy }; if (!this.board.inBounds(q.c, q.r) || this.primContains(q) || this.board.terrainAt(q.c, q.r)) break; p = q; steps++; }
        if (toward && steps < 2) { this.say(`Irem Tower ${cellLabel(mv.x.cell)}: 2칸 움직일 수 없어 제거`, 'ai'); await this.afterTileRemoved(mv.x.cell); continue; }
        this.board.addTerrain([cellLabel(p)], { ...mv.x });
        if (mv.rider && mv.rider.alive) { mv.rider.pos = { ...p }; }
        if (steps) this.say(`Irem Tower ${cellLabel(mv.x.cell)} → ${cellLabel(p)}${mv.rider ? ` (${mv.rider.name} 함께)` : ''}`, 'ai');
      }
      this.notify();
    },
    async babelTopple(n) {
      const tiles = new Map(); for (const z of this.board.terrain.values()) { if (z.entrance) continue; if (!tiles.has(z.id)) tiles.set(z.id, { id: z.id, type: z.type, cells: [] }); tiles.get(z.id).cells.push(z.cell); }
      const empty = [...tiles.values()].filter(z => !z.cells.some(p => this.titanAt(p.c, p.r)));
      const d = z => Math.min(...z.cells.map(p => Board.distToCells(p, this.primCells())));
      empty.sort((a, b) => d(a) - d(b)); const rm = empty.slice(0, n);
      for (const z of rm) this.board.removeTerrainId(z.id);
      this.say(`TOPPLE: 빈 지형 타일 ${rm.length}개 제거 (${rm.map(z => `${z.type} ${cellLabel(z.cells[0])}`).join(', ') || '없음'})`, 'ai'); this.notify();
    },
    // ---------- Eclipse ----------
    babelEclipseCells() {
      const dirs = [this.prim.facing]; if (this.trait('Total Eclipse')) dirs.push(OPP[this.prim.facing]);
      const out = new Map();
      for (const f of dirs) {
        const cells = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const p = { c, r }; if (!this.primContains(p) && this.inFront(p, f)) cells.push(p); }
        const depth = p => Board.distToCells(p, this.primCells()); cells.sort((a, b) => depth(a) - depth(b));
        const lit = new Set();
        for (const p of cells) {
          const q = { c: p.c - DIRS[f][0], r: p.r - DIRS[f][1] }; let sh = false;
          if (this.board.inBounds(q.c, q.r) && !this.primContains(q)) { const ter = this.board.terrainAt(q.c, q.r); if (ter && (ter.obstacle || ter.obscuring)) sh = true; else { const o = this.titanAt(q.c, q.r); if (o && lit.has(key(q.c, q.r))) sh = true; } }
          if (!sh) { lit.add(key(p.c, p.r)); out.set(key(p.c, p.r), p); }
        }
      }
      return [...out.values()];
    },
    babelRotate(spec, exclude = []) {
      const live = this.liveTitans().filter(t => !t.offBoard && !t.onVP && !t.stair && !exclude.includes(t));
      if (spec === 'Clockwise') { this.prim.facing = CW[this.prim.facing]; this.say(`Rotate: 시계방향 → ${this.prim.facing}`, 'ai'); this.notify(); return true; }
      if (spec === 'most') { this.faceMost(); this.say(`Rotate: 가장 많은 타이탄 쪽 → ${this.prim.facing}`, 'ai'); return true; }
      if (!live.length) return false;
      const ds = live.map(t => this.distTo(t)); const v = /Furthest/.test(spec) ? Math.max(...ds) : Math.min(...ds); const t = live.find(x => this.distTo(x) === v);
      this.facePrim(t.pos); this.say(`Rotate: ${spec === 'Furthest Titan' ? '가장 먼' : '가장 가까운'} 타이탄 ${t.name} 쪽 → ${this.prim.facing}`, 'ai'); this.notify(); return t;
    },
    // ---------- AI resolution ----------
    babelCond(t, spec) { // "MIDAS 2+ or FATE 4+" / "FATE 6+"
      let ok = false; for (const m of spec.matchAll(/(MIDAS|FATE|RAGE) (\d)\+/g)) { const v = m[1] === 'MIDAS' ? this.midas(t) : m[1] === 'FATE' ? this.effFate(t) : t.rage; if (v >= +m[2]) ok = true; } return ok;
    },
    babelHdr(card) { const h = card.hdr || ''; const i = h.indexOf(':'); return i < 0 ? null : { cond: h.slice(0, i), eff: h.slice(i + 1).trim() }; },
    async babelWindow(targets, card, label) {
      const H = this.babelHdr(card); const list = targets.filter(t => t.alive);
      if (H && /^Ignore ⚡$/.test(H.eff)) { const open = list.filter(t => !this.babelCond(t, H.cond)); if (!open.length) { this.say(`(${H.cond}: ◆! 무시)`); return; } return this.reactionWindow(open[0], card, label); }
      if (list.length) await this.reactionWindow(list[0], card, label);
    },
    async babelAI(card, { isSignature = false, forcedTarget = null } = {}) {
      this.babelMoveEntr(card.stair);
      if (card.kind === 'ROUTINE') { const v = this.rng.pick(this.liveTitans()); if (v) { this.say(`Total Lunacy: 무작위 타이탄 ${v.name} 사망`, 'bad'); await this.kill(v); } return; }
      if (card.curse) {
        if (this.prim.disabled.curseAI) { this.say(`${card.name}: Curse AI 비활성 — 버리고 다른 AI 카드`, 'ai'); return this.babelNextAI(); }
        await this.safe(() => this.babelCurse(card)); this.say('After Curse: AI 카드 한 장 더', 'ai'); return this.babelNextAI();
      }
      const noTarget = async () => { if (card.noTarget === 'Signature' && card !== this.sig) { this.say('유효한 타겟 없음 → Signature', 'ai'); return this.resolveAI(this.sig, { isSignature: true }); } this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveRoutine(this.routine); };
      if (card.eclipse) return this.babelEclipse(card, forcedTarget, noTarget, []);
      const line0 = card.target[0] || ''; let targets = []; let mode = 'single';
      if (forcedTarget) targets = [forcedTarget];
      else if (/^All Titans on VPs$/.test(line0)) { const vp = this.liveTitans().filter(t => t.onVP); const st = this.liveTitans().filter(t => t.stair); targets = vp.length ? vp : st; mode = 'group'; if (targets.length) this.say(`대상: ${vp.length ? 'VP 위의 모든 타이탄' : 'Endless Staircase의 모든 타이탄'} — ${targets.map(t => t.name).join(', ')}`); }
      else if (/^Each Titan on a VP and Terrain tile$/.test(line0)) { targets = this.liveTitans().filter(t => !t.offBoard && !t.stair && (t.onVP || this.board.terrainAt(t.pos.c, t.pos.r))); mode = 'group'; this.say(`대상: VP·지형 타일 위의 모든 타이탄 — ${targets.map(t => t.name).join(', ') || '(없음)'}`); }
      else if (/^2 Titans, starting from the closest Titan$/.test(line0)) { targets = this.liveTitans().filter(t => !t.offBoard).sort((a, b) => this.distTo(a) - this.distTo(b)).slice(0, 2); mode = 'seq'; this.say(`대상: 가장 가까운 타이탄부터 2명 — ${targets.map(t => t.name).join(', ')}`); }
      else {
        let t = null;
        for (const line of card.target) { if (/^Titan on a VP$/.test(line)) t = this.liveTitans().find(x => x.onVP) || null; else if (/^Titan on the highest Endless Staircase space$/.test(line)) { const st = this.liveTitans().filter(x => x.stair); t = st.length ? st.reduce((a, b) => b.stair > a.stair ? b : a) : null; } else t = this.pickTarget([line], true); if (t) break; }
        if (t) targets = [t];
      }
      if (!targets.length) return noTarget();
      if (mode !== 'seq') { if (!targets[0].onVP && !targets[0].stair && targets.length === 1) this.facePrim(targets[0].pos); }
      return this.babelAttack(card, targets, mode);
    },
    async babelNextAI() { const c = this.drawAI(); if (!c) return; await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); },
    async babelEclipse(card, forcedTarget, noTarget, done) {
      if (card.rotate) { const r = this.babelRotate(card.rotate); if (!r) return noTarget(); }
      const cells = this.babelEclipseCells(); this.zoneShow = cells; this.notify(); const set = new Set(cells.map(p => key(p.c, p.r)));
      let targets = forcedTarget ? [forcedTarget] : this.liveTitans().filter(t => !t.offBoard && !t.onVP && !t.stair && set.has(key(t.pos.c, t.pos.r)));
      this.say(`Eclipse Zone (${this.prim.facing}${this.trait('Total Eclipse') ? ' + Rear' : ''}): ${targets.map(t => t.name).join(', ') || '(대상 없음)'}`, 'ai');
      if (card.allDie) {
        await this.babelWindow(targets, card, 'Eclipse');
        for (const t of targets.filter(x => x.alive)) { this.say(`${t.name}: Eclipse Zone 안 — 사망`, 'bad'); await this.solo(() => this.kill(t)); }
        if (targets.length) { const s = this.liveTitans(); if (s.length) { const v = this.rng.pick(s); this.say(`무작위 생존자 ${v.name}: 무작위 Curse Affliction`); await this.solo(() => this.randomCurse(v)); } }
      } else if (targets.length) await this.babelAttack({ ...card, after: card.after }, targets, 'group', true);
      if (card.repeat && !done.length) {
        const prev = targets; this.say(`After Final Attack: 「${card.name}」 한 번 더 (${card.repeat === 'most' ? '가장 많은 타이탄 쪽으로' : '다른 타겟 쪽으로'} 회전)`, 'ai');
        const r = card.repeat === 'most' ? this.babelRotate('most') : this.babelRotate('Closest Titan', prev);
        if (!r) { this.say('(회전할 다른 타겟 없음)'); return; }
        return this.babelEclipse({ ...card, rotate: null }, null, async () => {}, [1]);
      }
    },
    async babelAttack(card, targets, mode, windowDone = false) {
      const H = this.babelHdr(card);
      if (H && /Gain the Greed-crazed Condition card/.test(H.eff)) for (const t of targets) if (t.alive && this.babelCond(t, H.cond)) { this.say(`${H.cond}: ${t.name} Greed-crazed`); await this.solo(() => this.midasCondition(t, 'Greed-crazed')); }
      if (H && /^Midas 2$/.test(H.eff)) for (const t of targets) if (t.alive && this.babelCond(t, H.cond)) { this.say(`${H.cond}: ${t.name} Midas 2`); await this.solo(() => this.midasX(t, 2)); }
      if (H && /Knockdown/.test(H.eff)) for (const t of targets) if (t.alive && this.babelCond(t, H.cond) && !t.onVP && !t.stair) { await this.solo(async () => { await this.reactionWindow(t, card, 'Knockdown'); await this.knockdown(t); }); }
      const dealt = new Map();
      const one = async t => { if (!t.alive) return; const d0 = this.currentAI.dangerDealt; this.currentAI.curHits = 0; try { const h = await this.primAttackOn(t, card); this.currentAI.lastHits = h || 0; dealt.set(t, { d: this.currentAI.dangerDealt - d0, h: h || 0 }); } catch (e) { dealt.set(t, { d: this.currentAI.dangerDealt - d0, h: this.currentAI.curHits || 0 }); throw e; } };
      if (mode === 'seq') {
        for (const t of targets) { if (!t.alive) continue; await this.solo(async () => { await this.babelWindow([t], card, 'Attack'); try { await one(t); } catch (e) { if (!(e instanceof TitanDied) || !card.after) throw e; await this.babelAfter(card, t, dealt.get(t)); throw e; } if (card.after) await this.babelAfter(card, t, dealt.get(t)); }); }
      } else {
        if (!windowDone || card.eclipse) await this.babelWindow(targets, card, card.eclipse ? 'Eclipse' : 'Attack');
        const cbSet = new Set();
        for (const t of targets) { try { await this.solo(() => one(t)); } catch (e) { if (!(e && e.chainBreak && this.isZoneCard(card))) throw e; cbSet.add(t); this.say(`Chain Break — ${t.name}에 대한 남은 효과·After Attack 무시`, 'sys'); if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); } } }
        if (card.after) for (const t of targets) if (!cbSet.has(t) && (t.alive || /^(⚡\s*)?Remove X Irem Towers/.test(card.after))) await this.solo(() => this.babelAfter(card, t, dealt.get(t) || { d: 0, h: 0 }));
      }
      if (card.afterFinal && !card.repeat) { const mx = Math.max(0, ...[...dealt.values()].map(v => v.d)); await this.solo(() => this.babelAfterFinal(card, mx)); }
    },
    async babelAfter(card, t, r) {
      const a = card.after; const s = a.replace(/^⚡\s*/, ''); const win = a.startsWith('⚡'); this.say(`After Attack: ${s}`);
      const h = r ? r.h : 0, d = r ? r.d : 0;
      const boardWide = /^Remove X Irem Towers, where X is the number of hits/.test(s);
      if (win && t.alive) await this.reactionWindow(t, card, 'After Attack'); if (!t.alive && !boardWide) return;
      if (boardWide) { if (!t.alive) this.say('(Mercy Rule: 대상 사망 — 타워 제거는 계속 해결)'); return this.babelRemoveTowers(h, card.name); }
      if (/^Wish Away [XY], where [XY] is the DANGER (dealt|gained)/.test(s)) { if (d > 0) return this.wishAway(t, d); this.say('(Danger 0 — Wish Away 없음)'); return; }
      if (/^Midas Y and gain Y Ambrosia tokens, where Y is the number of hits/.test(s)) { if (h) { await this.midasX(t, h); if (t.alive) await this.gainAmbrosia(t, h); } return; }
      if (/^Midas Y, where Y is the number of hits - 1/.test(s)) { if (h > 1) await this.midasX(t, h - 1); return; }
      if (/^Midas Y, where Y is the number of hits/.test(s)) { if (h) await this.midasX(t, h); return; }
      if (/^AMBROSIA 1\+/.test(s)) { const a2 = t.ambrosia || 0; if (a2 >= 5) { await this.midasCondition(t, 'Greed-crazed'); if (t.alive) await this.addCurse(t, 'Goldthirst'); } else if (a2 >= 3) await this.midasCondition(t, 'Greed-crazed'); else if (a2 >= 1) await this.midasCondition(t, 'Covetous'); else this.say(`${t.name}: Ambrosia 0 — 효과 없음`); return; }
      await this.doEffects(t, a, { card });
    },
    async babelAfterFinal(card, mx) {
      const s = card.afterFinal.replace(/^⚡\s*/, ''); this.say(`After Final Attack: ${s}`); if (card.afterFinal.startsWith('⚡') && this.liveTitans().length) await this.reactionWindow(this.liveTitans()[0], card, 'After Final Attack');
      if (/^Remove X Irem Towers, where X is the highest DANGER/.test(s)) return this.babelRemoveTowers(mx, card.name);
    },
    async babelCurse(card) {
      this._curseImm = new Set(); for (const t of this.liveTitans()) if (await this.curseIgnore(t, card)) this._curseImm.add(t);
      try { return await this.babelCurse0(card); } finally { this._curseImm = null; }
    },
    async babelCurse0(card) {
      const imm = t => !!(this._curseImm && this._curseImm.has(t));
      if (card.curse === 'wind') {
        const c = this.liveTitans().filter(t => !imm(t) && this.primLos(t) && this.effFate(t) >= 6).sort((a, b) => this.distTo(a) - this.distTo(b))[0];
        await this.reactionWindow(c || this.liveTitans()[0], card, 'WIND');
        if (c && c.alive) { this.say(`WIND: ${c.name} (Fate 6+) Covetous`); await this.solo(() => this.midasCondition(c, 'Covetous')); }
        const before = new Map(this.liveTitans().map(t => [t, this.distTo(t)]));
        const hit = await this.airburst(5);
        for (const t of hit || []) if (t.alive && !imm(t)) { const x = 6 - (before.get(t) || 6); if (x > 0) await this.solo(() => this.midasX(t, x)); }
      } else if (card.curse === 'eclipse') {
        const c = this.liveTitans().filter(t => !imm(t) && this.primLos(t) && t.rage >= 5).sort((a, b) => this.distTo(a) - this.distTo(b))[0];
        await this.reactionWindow(c || this.liveTitans()[0], card, 'ECLIPSE');
        if (c && c.alive) { this.say(`ECLIPSE: ${c.name} (Rage 5+) Covetous`); await this.solo(() => this.midasCondition(c, 'Covetous')); }
        for (const t of this.liveTitans()) if (!imm(t)) await this.solo(() => this.midasX(t, this.effFate(t) + 1));
      } else if (card.curse === 'topple') { await this.reactionWindow(this.liveTitans()[0], card, 'Topple'); await this.babelTopple(10); }
    },
    // ---------- attack header / effects ----------
    async babelHeader(t, card, dice, diff) {
      const H = this.babelHdr(card); t._bAdd = 0;
      if (card.dice === 'X') { dice = 2 + this.midas(t); if (this.effFate(t) >= 4) { dice *= 2; this.say(`Fate 4+ — X 두 배`); } dice += this.prim.bonus.EVADE_DICE; this.say(`Shadow Economy: 회피 주사위 X = ${dice}`); }
      if (H && this.babelCond(t, H.cond)) { let m; if ((m = /^\+(\d) EVADE_DICE$/.exec(H.eff))) { dice += +m[1]; this.say(`${H.cond}: 회피 주사위 +${m[1]}`); } if ((m = /^Add \+(\d) hits?$/.exec(H.eff))) { t._bAdd = +m[1]; this.say(`${H.cond}: hit +${m[1]} 추가 예정`, 'bad'); } }
      return { dice, diff };
    },
    babelDeal(t, card, per, hits) {
      let total = per * hits; if (card.eclipse && this.laserRes(t)) { const nd = Math.max(0, total - this.laserRes(t) * hits); this.say(`${t.name}: Laser Resistance — Danger ${total} → ${nd}`); total = nd; } if (card.eclipse && this.ab(t, 'In Light and Shade') && total > hits) { const nd = Math.max(hits, total - hits); this.say(`${t.name}: In Light and Shade — 명중당 Danger −1 (${total} → ${nd})`, 'good'); total = nd; }
      total += this.prim.bonus.DANGER * (this.prim.bonusPerHit ? hits : 1) + (this.prim.tokens.danger || 0); this.currentAI.dangerDealt += total;
      return this.gainDanger(t, total, { fromAttack: true, source: card.name, noArmor: this.isJudge(card) });
    },
    async babelEffect(t, s, hits, card) {
      let m;
      if (/^X is equal to 2/.test(s)) return true;
      if ((m = /^(Three|Two) hits or MIDAS (\d)\+, you die\. Otherwise, each hit deals (\d) DANGER and Midas (\d)\.$/.exec(s)) || (m = /^()MIDAS (\d)\+, you die\. Otherwise, each hit deals (\d) DANGER and Midas (\d)\.$/.exec(s))) {
        const need = m[1] === 'Three' ? 3 : m[1] === 'Two' ? 2 : 99; if (hits >= need || this.midas(t) >= +m[2]) { this.say(`${t.name}: ${hits >= need ? `${hits} hit` : `Midas ${this.midas(t)}`} — 사망`, 'bad'); await this.kill(t); return true; }
        await this.babelDeal(t, card, +m[3], hits); if (t.alive) await this.midasX(t, +m[4] * hits); return true;
      }
      if ((m = /^Each hit deals (\d) DANGER and Midas (\d)\.$/.exec(s))) { await this.babelDeal(t, card, +m[1], hits); if (t.alive) await this.midasX(t, +m[2] * hits); return true; }
      if ((m = /^Each hit deals (\d) DANGER and 1 Ambrosia token\.$/.exec(s)) || (m = /^(?:Wisdom\/Cunning\. )Each hit deals (\d) DANGER and 1 Ambrosia token\.$/.exec(s))) { await this.gainAmbrosia(t, hits); if (t.alive) await this.babelDeal(t, card, +m[1], hits); return true; }
      if ((m = /^Each hit deals (\d) DANGER\.$/.exec(s))) { await this.babelDeal(t, card, +m[1], hits); return true; }
      if (/^Courage\/Wisdom\. For each hit gain \+3 DANGER and Midas 1\. Gain Death 4 - X/.test(s)) { await this.babelDeal(t, card, 3, hits); if (!t.alive) return true; await this.midasX(t, hits); if (!t.alive) return true; const n = 4 - hits; if (n <= 0) { this.say(`${t.name}: Death ${n} — 사망`, 'bad'); await this.kill(t); } else await this.addCondition(t, 'Death', { tokens: n }); return true; }
      if (/^Wish Away X, where X is the DANGER dealt\.$/.test(s)) { const d = this.currentAI.dangerDealt - (t._bD0 || 0); if (d > 0) await this.wishAway(t, d); return true; }
      if (/^Gain the (Covetous|Greed-crazed) Condition card\.$/.test(s)) { await this.midasCondition(t, /Covetous/.test(s) ? 'Covetous' : 'Greed-crazed'); return true; }
      if (/^Unholy Alchemy\.$/.test(s)) { await this.unholyAlchemy(t); return true; }
      return false;
    },
    async babelSentence(t, p, ctx = {}) {
      const alive = !!(t && t.alive); let m;
      if (/^Create an Irem Tower$/.test(p)) { await this.babelCreateTower(t); return true; }
      if ((m = /^Remove (an|\d) Irem Towers?$/.exec(p))) { await this.babelRemoveTowers(m[1] === 'an' ? 1 : +m[1]); return true; }
      if (/^Remove all Irem Towers from the two outermost rings of the Battle Board \(even if occupied\)$/.test(p)) { const B = this.board; let n = 0; for (const ter of this.iremTowers()) { const c = ter.cell; if (c.c <= 2 || c.r <= 2 || c.c >= B.cols - 1 || c.r >= B.rows - 1) { B.removeTerrainId(ter.id); n++; await this.afterTileRemoved(c); } } this.say(`바깥 두 줄의 Irem Tower ${n}개 제거`, 'ai'); this.notify(); return true; }
      if (/^Gain as many DANGER as you have Ambrosia tokens$/.test(p)) { if (alive && t.ambrosia) await this.gainDanger(t, t.ambrosia, { source: 'Response' }); return true; }
      if ((m = /^Gain \+(\d) DANGER$/.exec(p))) { if (alive) await this.gainDanger(t, +m[1], { source: 'Response' }); return true; }
      if (/^Then move every Irem Tower in Zone 5 around the Babelian Lunacy 2 spaces directly away from it$/.test(p)) { await this.babelShiftTowers(false); return true; }
      if (/^Move every Irem Tower in Zone 5 around the Babelian Lunacy 2 spaces directly toward it$/.test(p)) { await this.babelShiftTowers(true); return true; }
      if (/^Remove any Irem Tower that cannot be moved 2 spaces/.test(p)) return true;
      if (/^Reverse Unholy Alchemy$/.test(p)) { if (alive) { const n = t.ambrosia || 0; t.ambrosia = 0; this.say(`${t.name}: Reverse Unholy Alchemy — Ambrosia ${n} → Midas`, 'bad'); if (n) await this.gainMidas(t, n, true, true, 'convert'); } return true; }
      if (/^You die$/.test(p)) { if (alive) { this.say(`${t.name}: 사망`, 'bad'); await this.kill(t); } return true; }
      if (/^Gain a random Curse Affliction$/.test(p)) { if (alive) await this.randomCurse(t); return true; }
      if (/^Perform an Obol Draw$/.test(p)) { if (alive) await this.obolDraw(t, 10); return true; }
      if (/^Wish Away each Titan$/.test(p)) { for (const x of this.liveTitans()) await this.solo(() => this.wishAway(x)); return true; }
      if (/^Perform Signature against the Attacker$/.test(p)) { if (ctx.queue) ctx.queue.push({ card: this.sig, sig: true, target: t }); else await this.resolveAI(this.sig, { isSignature: true, forcedTarget: alive ? t : null }); return true; }
      if (/^Wish Away$/.test(p)) { if (alive) await this.wishAway(t); return true; }
      if (this.midasSentence && await this.midasSentence(t, p, ctx)) return true;
      return false;
    },
    async babelCritical(t, A) {
      const c = A.bp.critical || ''; const V = this.prim.vp;
      if (/^You may perform a Bonus Attack!$/.test(c)) { this.say('Critical: 보너스 공격 가능', 'good'); const ok = await this.ask({ type: 'yn', titan: t, title: 'Critical: 보너스 공격?', options: [{ label: '보너스 공격', value: true }, { label: '패스', value: false }] }); if (ok) this.pendingFollowUp = t; return true; }
      if (/^Create all Vantage Points!$/.test(c)) { V.count = V.slots; V.created = true; this.say('Dome of Folly: VP 3개 모두 열림', 'good'); this.notify(); return true; }
      if (/^Remove the highest Staircase tier/.test(c)) { if (this.prim.tierLimit > 1) { this.prim.tierLimit--; if (this.prim.stairSegs.length > this.prim.tierLimit) { this.prim.stairSegs.pop(); const len = this.stairLen(); for (const x of this.liveTitans().filter(y => y.stair > len)) x.stair = len; } this.say(`Endless Staircase 맨 위 단 제거 — 한도 ${this.prim.tierLimit}단 (${this.babelLimitLen()}칸)`, 'good'); } else this.say('(이미 1단 — 더 줄일 수 없음)'); this.notify(); return true; }
      if (/^Until the end of Battle, all Titans gain a \+1 bonus to Ascent Checks/.test(c)) { this.prim.ascentBonus++; this.say(`모든 타이탄 Ascent Check +${this.prim.ascentBonus}`, 'good'); return true; }
      if (/-1 AT when attacked from the Endless Staircase or VPs/.test(c)) { this.prim.babelSVMalus++; this.say(`계단·VP에서 공격 시 AT −${this.prim.babelSVMalus}`, 'good'); return true; }
      if (/^Gain the Priority Target token\. You may perform a Bonus Attack/.test(c)) { if (!this.ptHolder()?.ptLocked) { for (const x of this.titans) x.pt = false; t.pt = true; } this.say(`${t.name}: Priority Target 획득`, 'good'); const ok = await this.ask({ type: 'yn', titan: t, title: 'Critical: PT 획득 — 보너스 공격?', options: [{ label: '보너스 공격', value: true }, { label: '패스', value: false }] }); if (ok) this.pendingFollowUp = t; return true; }
      if (/^Create all Vantage Points or create 4 Irem Towers/.test(c)) { const v = await this.ask({ type: 'choice', titan: t, title: 'Critical: 선택', options: [{ label: 'VP 모두 열기', value: 'vp' }, { label: 'Irem Tower 4개 생성', value: 'tw' }] }); if (v === 'tw') { for (let i = 0; i < 4; i++) await this.babelCreateTower(t); } else { V.count = V.slots; V.created = true; this.say('Dome of Folly: VP 3개 모두 열림', 'good'); } this.notify(); return true; }
      if (/^You may move to an empty VP and gain the Lander/.test(c)) { if (this.vpRoom() && !t.onVP) { const ok = await this.ask({ type: 'yn', titan: t, title: '빈 VP로 이동하고 Lander를 받을까요?', options: [{ label: '이동', value: true }, { label: '패스', value: false }] }); if (ok) { t.stair = 0; this.mountVP(t, 'Glass Ceiling of Babel'); await this.addCondition(t, 'Lander'); } } else this.say('(열린 빈 VP 없음)'); return true; }
      if (/^The Babelian Lunacy dies/.test(c)) { this.say(`${A.bp.name} — ${this.prim.name} 즉사!`, 'good'); A.slay = true; return true; }
      if (/^Disable the Midas X keyword/.test(c)) { this.prim.disabled.midasX = true; this.say('Midas X 키워드 비활성', 'good'); return true; }
      if (/^Disable Curse AI cards/.test(c)) { this.prim.disabled.curseAI = true; this.say('Curse AI 카드 비활성 (Heart of Gold 이벤트는 캠페인)', 'good'); return true; }
      if (/\(campaign\)/.test(c)) { this.say(`(${c} — 캠페인 보상)`, 'sys'); return true; }
      return false;
    },
    babelAT(t) { return (t.stair || t.onVP) ? -(this.prim.babelSVMalus || 0) : 0; },
    async babelOnWound(A) {
      const t = A.t;
      if (!t.stair) { if (!this.babelUnlockTier()) { const V = this.prim.vp; if (V.count < V.slots) this.createVP(null); } }
      if (t.onVP && this.prim.level === 1) { this.say(`${t.name}: VP에서 Wound — Pandora Horizon 승리 (Outran the Infinite)!`, 'good'); throw new BattleOver('victory'); }
    },
    async babelPrimRoundStart(add = null) { const direct = !add; const T = []; if (direct) add = (l, r) => T.push(r);
      if (this.trait('Moon Call')) add('Moon Call (트레이트)', async () => { if (this.trait('Moon Call')) { if (!this.iremTowers().length) { this.say('Moon Call: Irem Tower가 하나도 없음 — Babelian Lunacy 승리', 'bad'); throw new BattleOver('defeat'); } this.say('Moon Call: Irem Tower 4개 제거', 'ai'); await this.babelRemoveTowers(4, 'Moon Call'); } });
      if (this.trait('Endless Escalator') && this.liveTitans().some(t => t.stair)) add('Endless Escalator (트레이트)', () => this.endlessEscalator());
      if (this.trait("God's Breath")) add("God's Breath (트레이트)", async () => { if (this.trait("God's Breath")) { const list = this.liveTitans().filter(t => !t.onVP && !t.stair && !t.offBoard && this.zoneDist(t.pos) <= 6); this.say(`God's Breath: Zone 6의 타이탄 Pull 3 — ${list.map(t => t.name).join(', ') || '없음'}`, 'ai'); for (const t of list) await this.solo(() => this.pullTitan(t, 3, { noPrimMove: true })); } });
      if (direct) for (const r of T) await r();
    },
    async babelPrimRoundEnd(add = null) { const direct = !add; const T = []; if (direct) add = (l, r) => T.push(r);
      if (this.trait("God's Breath")) add("God's Breath (트레이트)", async () => { if (this.trait("God's Breath")) { const list = this.liveTitans().filter(t => !t.onVP && !t.stair && !t.offBoard && this.zoneDist(t.pos) <= 3); this.say(`God's Breath: Zone 3의 타이탄 Knockback 6 — ${list.map(t => t.name).join(', ') || '없음'}`, 'ai'); for (const t of list) await this.solo(() => this.knockback(t, 6, this.awayDir(t.pos, this.primCells()))); } });
      if (direct) for (const r of T) await r();
    },
    async babelTurnStart(t) { },
    babelTurnTriggers(t, add) { if (t.stair) add(null, 'Endless Staircase: Wishkeen', async () => { if (!t.stair) return; this.say(`${t.name}: Endless Staircase에서 턴 시작 — Wishkeen`, 'bad'); await this.midasCondition(t, 'Wishkeen'); }); },
    async babelHoldFail(t) {
      const cfg = this.vpCfg(); const len = this.stairLen(); const X = Math.max(1, cfg.stairHalf ? Math.ceil(len / 2) : len);
      const V = this.prim.vp; V.occupants = (V.occupants || []).filter(x => x !== t); V.occupant = V.occupants[0] || null; t.onVP = false; await this.moveToStair(t, 'Hold On 실패'); if (!t.alive) return; t.stair = 1; this.say(`${t.name}: Dome of Folly에서 떨어짐 — Endless Staircase ${t.stair}번 칸으로`, 'bad'); await this.knockdown(t); this.notify();
    },
  });
}
