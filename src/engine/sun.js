// Cycle III — Sun Descendant (Sun Move, Merciless Sun / Unshaded Board, Feathery Ascent multi-level VPs)
import { Board, key, DIRS, DIR_LIST, cellLabel, parseCell } from './core.js';

const ORDER = ['A', 'B', 'C', 'D'];
const OPPD = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function installSun(Game, { TitanDied, BattleOver }) {
  Object.assign(Game.prototype, {
    sunSetup() {
      this.prim.sunPos = 'A'; const P = this.prim.def.sunPos.A; this.prim.anchor = parseCell(P.anchor); this.prim.facing = P.facing;
      this.prim.vp = { created: true, occupant: null, slots: 3, count: 1, tokens: 0, occupants: [] }; this.prim.vpLvlAT = { 1: 0, 2: 0, 3: 0 };
      if (this.prim.traits['Ice Age']) this.board.allSlip = true;
      if (this.prim.traits['Trigger Happy']) { const tf = this.prim.def.ai.find(a => a.code === 'CV1800'); if (tf) { this.sig = tf; this.say('Trigger Happy: Signature가 Trigger Finger로 바뀜', 'sys'); } }
      if (this.prim.traits['Total Eclipse']) this.board.allChasm = true;
      this.say(`Sun Descendant: A 위치, ${P.facing} 방향. Feathery Ascent VP I 열림.${this.board.allSlip ? ' Ice Age: 모든 칸 Slippery.' : ''}${this.board.allChasm ? ' Total Eclipse: 모든 칸 Chasm.' : ''}`, 'sys');
    },
    // ---------- VPs ----------
    elevated(t) { return !!(t.onVP || (!t.offBoard && this.board.terrainAt(t.pos.c, t.pos.r)?.elevated)); },
    rockActions(t) {
      const out = []; const here = this.board.terrainAt(t.pos.c, t.pos.r);
      if (here && here.elevated) {
        const rockCells = [...this.board.terrain.values()].filter(x => x.id === here.id).map(x => x.cell);
        if (this.prim.def.sunD && this.vpFree().includes(1) && rockCells.some(p => Board.isAdjacent(p, this.primCells()))) out.push({ label: `${here.type}: 인접한 Sun Descendant의 VP I로 이동 (무료 액션)`, noFate: true, value: async () => this.sunMount(t, 1) });
        return out;
      }
      if (t.turn.rockClimbed) return out;
      const seen = new Set();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ter = this.board.terrainAt(t.pos.c + dx, t.pos.r + dy); if (!ter || !ter.elevated || seen.has(ter.id)) continue; seen.add(ter.id);
        out.push({ label: `${ter.type} 오르기 (Fury ${ter.climb}+ 테스트, 턴당 1회)`, noFate: true, value: async () => { t.turn.rockClimbed = true; if (!(await this.climbAuto(t, true)) && !this.skillTest(t, 'Fury', ter.climb, this.climbBonus(t))) return; const cells = [...this.board.terrain.values()].filter(x => x.id === ter.id).map(x => x.cell).filter(p => !this.titanAt(p.c, p.r)); if (!cells.length) { this.say('빈 칸 없음'); return; } const d = cells.length === 1 ? cells[0] : (await this.ask({ type: 'move', titan: t, title: `${ter.type}: 올라설 칸`, cells, options: cells.map(q => ({ label: cellLabel(q), value: q })) })) || cells[0]; t.pos = { ...d }; this.say(`${t.name}: ${ter.type} 위로 (${cellLabel(d)}, Elevated, Climb +3)`, 'good'); this.notify(); } }); }
      return out;
    },
    vpTitans() { return this.liveTitans().filter(t => t.onVP && !t.offBoard); },
    vpLvl(t) { return t.onVP ? (t.vpLevel || 1) : 0; },
    vpFree() { const used = new Set(this.vpTitans().map(t => t.vpLevel)); const out = []; for (let l = 1; l <= this.prim.vp.count; l++) if (!used.has(l)) out.push(l); return out; },
    vpUnshaded(t) { return !!(t.onVP && (this.trait('Magnifying Glass') || this.vpLvl(t) === 3)); },
    async sunClimb(t) {
      t.turn.climbed = true; const free = this.vpFree(); if (!free.length) { this.say('빈 VP 없음'); return; }
      const lvl = free.length === 1 ? free[0] : await this.ask({ type: 'choice', titan: t, title: 'Feathery Ascent: 오를 VP', options: free.map(l => ({ label: `VP ${'I'.repeat(l)} (Fury ${this.prim.def.vp.climbByLevel[l]}+)`, value: l })) });
      const n = Math.max(1, this.prim.def.vp.climbByLevel[lvl] - (this.prim.vp.tokens || 0));
      let auto = false; if (this.ab(t, 'Scale') && this.fr(t) > 0 && !t.turn.usedAbilities.has('Scale')) { auto = await this.ask({ type: 'yn', titan: t, title: 'Scale: Fate+1로 Climb 테스트 자동 성공?', options: [{ label: '사용', value: true }, { label: '테스트', value: false }] }); if (auto) { t.turn.usedAbilities.add('Scale'); await this.gainFate(t, 1); } }
      if (!auto) { const sg = t.gear.find(g => !g.discarded && !g.exhausted && /(\[charge\])?Ψ⟳ Scale/.test(this.gearText(g, t))); if (sg && this.fr(t) > 0 && (!/\[charge\]Ψ⟳ Scale/.test(this.gearText(sg, t)) || sg.charges > 0)) { auto = await this.ask({ type: 'yn', titan: t, title: `${sg.card.name}: Scale — Climb 자동 성공? (Fate+1, 소진)`, options: [{ label: '사용', value: true }, { label: '테스트', value: false }] }); if (auto) { if (/\[charge\]Ψ⟳ Scale/.test(this.gearText(sg, t))) sg.charges--; sg.exhausted = true; await this.gainFate(t, 1); } } }
      if (!auto) auto = await this.climbAuto(t);
      if (auto || this.skillTest(t, 'Fury', n, this.climbBonus(t))) { this.sunMount(t, lvl); }
    },
    sunMount(t, lvl) { if (t.knockdown) t.knockdown = null; this.prim.vp.occupants.push(t); this.prim.vp.occupant = this.prim.vp.occupants[0]; t.onVP = true; t.vpLevel = lvl; t.pos = { ...this.prim.anchor }; this.say(`${t.name}: Feathery Ascent VP ${'I'.repeat(lvl)}에 올라탐 (+${this.prim.def.vp.powerByLevel[lvl]} Power, Response 무시)`, 'good'); this.notify(); },
    async sunVPMove(t) { const free = this.vpFree(); const lvl = free.length === 1 ? free[0] : await this.ask({ type: 'choice', titan: t, title: '이동 액션: 옮겨갈 VP', options: free.map(l => ({ label: `VP ${'I'.repeat(l)}`, value: l })) }); t.vpLevel = lvl; this.say(`${t.name}: VP ${'I'.repeat(lvl)}로 이동`); this.notify(); },
    async sunHoldOn(t) {
      if (!t.onVP) return; const lvl = this.vpLvl(t); this.say(`${t.name}: Hold On! (VP ${'I'.repeat(lvl)}, Endurance 7+)`);
      if (this.skillTest(t, 'Endurance', Math.max(1, 7 - (this.prim.vp.tokens || 0)), t.conditions.includes('Bellerophonic') ? 2 : 0)) return;
      { const il = t.gear.find(g => !g.discarded && !g.exhausted && /Ψ⟳ When you fail the Hold On test, instead of suffering the Falling Down effect, move 2 spaces/.test(this.gearText(g, t))); if (il && this.fr(t) > 0) { const ok = await this.ask({ type: 'yn', titan: t, title: `${il.card.name}: Hold On 실패 — 떨어지는 대신 2칸 이동? (Fate+1, 소진)`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) { il.exhausted = true; await this.gainFate(t, 1); await this.leaveVP(t); t.vpLevel = 0; await this.chooseMove(t, 2, 'Reposition (Icarus Lot)'); return; } } }
      if (this.ab(t, 'Fall and Soar') && this.fr(t) > 0 && await this.ask({ type: 'yn', titan: t, title: 'Fall and Soar: Fate+1로 떨어지는 대신 2칸 이동?', options: [{ label: '사용', value: true }, { label: '패스', value: false }] })) { await this.gainFate(t, 1); await this.leaveVP(t); t.vpLevel = 0; this.say(`${t.name}: Fall and Soar`, 'good'); await this.chooseMove(t, 2, 'Fall and Soar'); return; }
      this.say(`${t.name}: Feathery Ascent에서 떨어짐 — Knockdown, Danger +${lvl}`, 'bad');
      await this.leaveVP(t); t.vpLevel = 0; await this.knockdown(t); if (t.alive) await this.gainDanger(t, lvl, { source: 'Hold On' });
      if (t.alive && this.trait('Magnifying Glass')) { this.say('Magnifying Glass: Hold On 실패 — Signature', 'ai'); await this.safe(() => this.resolveAI(this.sig, { isSignature: true, forcedTarget: t })); }
    },
    // ---------- Sun Move / shade ----------
    async sunMove() {
      const i = ORDER.indexOf(this.prim.sunPos || 'A'); const nx = ORDER[(i + 1) % 4]; const P = this.prim.def.sunPos[nx];
      const na = parseCell(P.anchor); const cells = this.primCells(na);
      for (const p of cells) { const ter = this.board.terrainAt(p.c, p.r); if (ter && !ter.indestructible) { this.board.removeTerrainId(ter.id); this.say(`${ter.type} 파괴 (Sun Move)`); } }
      this.prim.anchor = na; this.prim.facing = P.facing; this.prim.sunPos = nx; for (const o of this.titans) if (o.alive && o.onVP) o.pos = { ...na };
      this.say(`☀ Sun Move → ${nx} 위치 (${P.facing} 방향, 햇빛은 ${OPPD[P.facing]}쪽 가장자리에서)`, 'ai');
      for (const o of this.liveTitans()) if (!o.onVP && !o.offBoard && this.primContains(o.pos)) { const d = this.nearestFree(o.pos, o); if (d) { o.pos = d; this.say(`${o.name}: Sun Move에 밀려 ${cellLabel(d)}로 (Crash 없음)`); } }
      if (this.anchors) this.voraciousStep && this.trait('Voracious Parasite') && this.voraciousStep();
      this.notify();
    },
    shaded(p) { const f = this.prim.facing; const q = { c: p.c - DIRS[f][0], r: p.r - DIRS[f][1] }; if (!this.board.inBounds(q.c, q.r)) return false; const ter = this.board.terrainAt(q.c, q.r); return !!(ter && (ter.obstacle || ter.obscuring)); },
    unshadedCells() { const out = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const p = { c, r }; if (!this.primContains(p) && !this.shaded(p)) out.push(p); } return out; },
    sunTargets(allVP) { return this.liveTitans().filter(t => !t.offBoard && (t.onVP ? (allVP || this.vpUnshaded(t)) : !this.tShaded(t))); },
    // ---------- targeting helpers ----------
    sunPickVP(spec, n = 1) {
      const vt = this.vpTitans().sort((a, b) => b.vpLevel - a.vpLevel);
      if (/lowest occupied VP/.test(spec)) return vt.length ? [vt[vt.length - 1]] : [];
      return vt.slice(0, n);
    },
    sunPick(card) {
      for (const line of card.target) {
        if (/occupied VP/.test(line)) { const r = this.sunPickVP(line, /2 highest/.test(line) ? 2 : 1); if (r.length) return { list: r, vp: true }; continue; }
        if (/All Titans on VPs/.test(line)) { const r = this.vpTitans(); if (r.length) return { list: r, vp: true }; continue; }
        if (/^Zone (\d)/.test(line)) return { zone: +/^Zone (\d)/.exec(line)[1] };
        const t = this.pickTarget([line], true); if (t) return { list: [t] };
      }
      return null;
    },
    cond(c, t) { if (!c) return false; return (c.p != null && (t ? this.parFor(t) : (this.paradox || 0)) >= c.p) || (c.f != null && t && this.effFate(t) >= c.f); },
    // ---------- ops ----------
    async sunOp(o, card, primary, ctx) {
      const ref = primary && primary.alive ? primary : null;
      if (o.k === 'glac' || o.k === 'giant') { if (o.no && this.cond(o.no, ref)) { this.say(`${o.no.p ? `Paradox ${o.no.p}+` : `Fate ${o.no.f}+`} — Glaciate 하지 않음`); return; } this.placeIce(o.cells.map(parseCell), o.k === 'giant'); return; }
      if (o.k === 'rewindHigh') { const l = this.liveTitans().filter(x => !x.offBoard); if (!l.length) return; const mx = Math.max(...l.map(x => x.fate)); const v = l.find(x => x.fate === mx && x.pt) || l.find(x => x.fate === mx); this.say(`Fate 최고 ${v.name} — Rewind`); await this.solo(() => this.oracleRewind(v)); return; }
      if (o.k === 'glacAnchorLow') { const l = this.liveTitans().filter(x => this.anchors && this.anchors[x.id]); if (!l.length) return; const mn = Math.min(...l.map(x => x.fate)); const v = l.find(x => x.fate === mn); const a = this.anchors[v.id]; this.say(`Fate 최저 ${v.name}의 Time Anchor ${cellLabel(a)}에 Glaciate`); this.placeIce([a], false); return; }
      if (o.k === 'rewind') { for (const x of ctx.hit) if (x.alive) await this.solo(() => this.oracleRewind(x)); return; }
      if (o.k === 'kb') { for (const x of ctx.hit) if (x.alive && !x.offBoard && !x.onVP) await this.solo(() => this.knockback(x, o.n)); return; }
      if (o.k === 'burn') { for (const x of ctx.hit) if (x.alive) await this.solo(() => this.burn(x, true)); return; }
      if (o.k === 'sunMove') { await this.sunMove(); return; }
      if (o.k === 'anchorAdj') { for (const x of ctx.hit) { if (!x.alive || !this.anchors) continue; const cand = Board.adjacentCells(this.primCells()).filter(p => this.board.inBounds(p.c, p.r) && !this.board.isObstacle(p.c, p.r)); if (!cand.length) continue; const d = cand.length === 1 ? cand[0] : (await this.ask({ type: 'move', titan: x, title: `${x.name}: Time Anchor를 놓을 Sun Descendant 인접 칸`, cells: cand, options: cand.map(q => ({ label: cellLabel(q), value: q })) })) || cand[0]; this.anchors[x.id] = { ...d }; this.say(`${x.name}: Time Anchor → ${cellLabel(d)}`); } return; }
      if (o.k === 'blackLake') { const cells = (ctx.zoneCells || []).filter(p => this.board.inBounds(p.c, p.r) && !this.primContains(p) && !this.board.terrainAt(p.c, p.r)); this._blN = (this._blN || 0) + 1; for (const p of cells) this.board.terrain.set(key(p.c, p.r), { id: 'sbl' + this._blN, type: 'Black Lake', obstacle: false, obscuring: false, destructible: false, indestructible: true, slippery: true, cell: p }); this.say(`Zone 아래 Black Lake (${cells.length}칸, Slippery)`, 'ai'); this.notify(); return; }
    },
    // ---------- AI resolution ----------
    winSkip(card, t) { const S = card.sun; if (S.nowin) return true; if (S.skipWin && this.cond(S.skipWin, t)) { this.say(`${S.skipWin.p ? `Paradox ${S.skipWin.p}+ 또는 ` : ''}Fate ${S.skipWin.f}+ — ⚡ 무시`); return true; } if (S.merciless && this.trait('God Given Law')) { this.say('God Given Law: Merciless Sun 앞 ⚡ 무시'); return true; } if (S.mode === 'laser' && this.trait('Overclocked')) { this.say('Overclocked: Laser 앞 ⚡ 무시'); return true; } return false; },
    async sunAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const S = card.sun; const ctx = { hit: [], zoneCells: null };
      if (S.mode === 'laser' && this.prim.disabled.laser) { this.say(`(Sun Descendant의 Laser Attack 비활성 — 「${card.name}」 효과 없음)`, 'good'); return; }
      if (S.merciless && this.prim.disabled.merciless) { this.say('(Merciless Sun 비활성)'); return; }
      let pick = null;
      if (S.mode === 'laser' || S.mode === 'zone' || S.mode === 'vpOrZone') {
        pick = forcedTarget && forcedTarget.alive && !forcedTarget.offBoard ? { list: [forcedTarget], vp: forcedTarget.onVP } : this.sunPick(card);
        if (!pick) { this.say('유효한 타겟 없음 → Routine', 'ai'); if (card !== this.routine) return this.resolveAI(this.routine); return; }
      }
      const primary = pick && pick.list ? pick.list[0] : null; if (primary) this.say(`타겟: ${pick.list.map(x => x.name).join(', ')}${pick.vp ? ' (VP 위)' : ''}`);
      for (const o of S.pre || []) await this.sunOp(o, card, primary, ctx);
      const win = !this.winSkip(card, primary); const winLbl = (card.steps[0] || '').replace('⚡ ', '').split(' |')[0];
      if (S.erase && primary && this.cond(S.erase, primary)) { /* resolved per target below */ }
      // --- Sun attacks ---
      if (S.mode === 'sun' || S.mode === 'supernova') {
        if (win) await this.reactionWindow(this.liveTitans()[0] || this.titans[0], card, winLbl);
        await this.sunMove();
        let tg = S.mode === 'supernova' ? this.liveTitans().filter(t => !t.offBoard && !this.elevated(t)) : this.sunTargets(S.allVP);
        this.zoneShow = this.unshadedCells(); this.notify();
        this.say(`${S.mode === 'supernova' ? '비-Elevated 칸' : 'Unshaded'} 대상: ${tg.map(x => x.name).join(', ') || '(없음)'}`, 'ai');
        if (!tg.length) { if (S.noTargetDie && this.liveTitans().length) { const v = this.rng.pick(this.liveTitans()); this.say(`대상 없음 — 무작위 ${v.name} 사망`, 'bad'); await this.solo(() => this.kill(v)); } }
        else if (S.mode === 'supernova') { for (const t of tg) await this.solo(async () => { this.say(`${t.name}: Supernova — 소각 (Incinerated)`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); }); }
        else ctx.hit = await this.sunAttackAll(card, tg);
      } else if (S.mode === 'laser') {
        if (win && primary) await this.reactionWindow(primary, card, winLbl);
        if (!primary.alive || primary.offBoard) return;
        let kind = S.laser; if (S.up && this.cond(S.up, primary)) { kind = S.up.to; this.say(`Paradox ${S.up.p}+ 또는 Fate ${S.up.f}+ — ${kind === 'omni' ? 'Omnilaser' : 'Triple Laser'}`); }
        if (kind === 'triple' && this.prim.disabled.doubleLaser) kind = 'single';
        if (primary.onVP) { ctx.hit = await this.sunAttackAll(card, [primary]); }
        else { await this.laserLateral(primary); const c2 = { ...card, oracle: { laser: kind === 'triple' ? 'double' : kind, sideways: !!S.sideways } }; const { hits } = this.laserTargets(c2, primary); ctx.hit = await this.sunAttackAll(card, hits); }
      } else if (S.mode === 'zone' || S.mode === 'vpOrZone') {
        const zoneMode = !pick.vp && (S.mode === 'zone' || pick.zone);
        if (win) await this.reactionWindow(primary || this.liveTitans()[0] || this.titans[0], card, winLbl);
        if (!zoneMode) ctx.hit = await this.sunAttackAll(card, pick.list.filter(x => x.alive));
        else {
          if (S.mode === 'zone' && primary && !primary.onVP && S.move === 'move' && primary.alive) { this.facePrim(primary.pos); const path = await this.choosePrimPath(primary.pos, 99, [primary], card); for (const st of path) await this.primStep(st, [primary]); await this.primEndMove([]); if (path.length) this.say(`${this.prim.name} 이동 → ${cellLabel(this.prim.anchor)} 기준`); this.facePrim(primary.pos); }
          let cells; if (S.pattern) cells = this.patternCells({ pattern: S.pattern }); else { cells = []; const z = pick.zone || S.zone; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const p = { c, r }; if (!this.primContains(p) && this.zoneDist(p) <= z) cells.push(p); } }
          ctx.zoneCells = cells; this.zoneShow = cells; this.notify(); const set = new Set(cells.map(p => key(p.c, p.r)));
          const tg = this.liveTitans().filter(t => !t.offBoard && !t.onVP && set.has(key(t.pos.c, t.pos.r)));
          this.say(`Zone 범위: ${tg.map(x => x.name).join(', ') || '(대상 없음)'}`); ctx.hit = await this.sunAttackAll(card, tg);
        }
      }
      // --- after ---
      const tail = [...(S.after || []), ...(S.afterFinal || [])];
      for (const o of tail) { if (o.win && !(S.merciless && this.trait('God Given Law'))) await this.reactionWindow(ctx.hit.find(x => x.alive) || this.liveTitans()[0] || this.titans[0], card, 'After Attack'); await this.sunOp(o, card, primary, ctx); }
    },
    async sunAttackAll(card, list) {
      const S = card.sun; const hitList = [];
      for (const t of list) {
        if (!t.alive || t.offBoard) continue;
        try {
          if (S.erase && this.cond(S.erase, t)) { this.say(`${t.name}: ${S.erase.p ? `Paradox ${S.erase.p}+ 또는 ` : ''}Fate ${S.erase.f}+ — 존재에서 지워짐`, 'bad'); await this.kill(t, { erased: true }); continue; }
          if (S.auto) { this.say(`${t.name}: 회피 불가 — 맞음, 사망`, 'bad'); hitList.push(t); await this.kill(t); continue; }
          let c2 = card; if (S.dieUp && this.cond(S.dieUp, t)) { c2 = { ...card, dice: card.dice + S.dieUp.n }; this.say(`회피 주사위 +${S.dieUp.n}`); }
          if (S.judge) c2 = { ...c2, kind: 'JUDGEMENT', judge: S.judge };
          const h = await this.primAttackOn(t, c2); if (h) hitList.push(t);
          if (h && S.merciless && this.trait('Black Sun') && t.alive) { this.say(`${t.name}: Black Sun — Merciless Sun에 맞아 소각`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); }
        } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied) && !e.chainBreak) throw e; }
      }
      if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); }
      return hitList;
    },
    async sunEffect(t, s, hits, card) {
      const parts = s.split(/(?<=\.)\s+(?=[A-Z⚡])/).map(x => x.trim()).filter(Boolean); let m;
      const laser = card.sun && card.sun.mode === 'laser';
      for (let i = 0; i < parts.length; i++) {
        if (!t.alive || t.offBoard) return true; const p = parts[i];
        if ((m = /^Each hit deals (\d) (DANGER|FATE)(?: and (\d) (DANGER|FATE))?\.$/.exec(p))) { let f = 0, d = 0; const a = +m[1] * hits; if (m[2] === 'FATE') f += a; else d += a; if (m[3]) { const b = +m[3] * hits; if (m[4] === 'FATE') f += b; else d += b; } if (/^If all three hit, you are erased/.test(parts[i + 1] || '')) { i++; if (hits >= 3) { this.say(`${t.name}: 세 발 모두 맞음 — 존재에서 지워짐`, 'bad'); await this.kill(t, { erased: true }); return true; } } await this.dealFD(t, f, d, card, hits, null, { laser, sunHit: true }); continue; }
        if ((m = /^Gain \+(\d) FATE\.$/.exec(p))) { await this.gainFate(t, +m[1], { nc: true }); this.say(`${t.name}: Fate +${m[1]}`); continue; }
        if (/^Each Titan hit raises DANGER to 9 and draws an Obol\.$/.test(p)) { t.danger = 9; this.say(`${t.name}: Danger 9, Obol`, 'bad'); await this.obolDraw(t, 10); continue; }
        if (/^One hit, draw an Obol, two hits die, three hits you are incinerated\.$/.test(p)) { if (hits >= 3) { this.say(`${t.name}: 3 hit — 소각`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); } else if (hits === 2) { this.say(`${t.name}: 2 hit — 사망`, 'bad'); await this.kill(t); } else await this.obolDraw(t, 10); continue; }
        if (/^Time-clocked\.$/.test(p)) { await this.timeClock(t); continue; }
        if (/^If you are hit, you are incinerated\.$/.test(p)) { this.say(`${t.name}: 맞음 — 소각`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); return true; }
        if (/^If the Laser Attack hits an Iceberg/.test(p)) continue;
        await this.applyAttackEffect(t, p, hits, { ...card, sun: null });
      }
      return true;
    },
    async sunSentence(t, p) {
      let m; const alive = !!(t && t.alive);
      if ((m = /^All Titans in Zone (\d): Gain \+(\d) DANGER(?:, if adjacent, Time-clocked)?$/.exec(p))) { const z = +m[1]; const tg = this.liveTitans().filter(x => !x.offBoard && !x.onVP && this.zoneDist(x.pos) <= z); this.say(`Zone ${z} 타이탄: ${tg.map(x => x.name).join(', ') || '없음'} — Danger +${m[2]}`); for (const x of tg) await this.solo(() => this.gainDanger(x, +m[2], { source: 'Zone' })); this._zoneTg = tg; if (/if adjacent/.test(p)) for (const x of tg) if (x.alive && this.isAdj(x)) await this.solo(() => this.timeClock(x)); return true; }
      if (/^If adjacent, Time-clocked$/.test(p)) { for (const x of (this._zoneTg || [])) if (x.alive && !x.offBoard && this.isAdj(x)) await this.solo(() => this.timeClock(x)); this._zoneTg = null; return true; }
      if (/^Create a VP$/.test(p)) { this.createVP(null); return true; }
      if ((m = /^The Sun Descendant moves (\d) spaces directly away from the Attacker/.exec(p))) { await this.oracleMoveAway(t ? (t.onVP ? null : t.pos) : null, +m[1]); return true; }
      return false;
    },
    async sunCritical(t, A) {
      const c = A.bp.critical || '';
      if (/^Create a VP\. You may perform a Bonus Attack/.test(c)) { this.createVP(null); this.pendingFollowUp = t; return true; }
      if (/^Search the BP deck and choose 1 card to set aside/.test(c)) { if (!this.bp.cards.length) return true; const x = await this.ask({ type: 'choice', titan: t, title: 'Forewing: BP 덱에서 따로 둘 카드 (Escalation 후 BP 덱 맨 위로)', options: this.bp.cards.map(b => ({ label: `${b.name} (BP ${b.tier}, AT ${b.at})`, value: b })) }); this.bp.cards = this.bp.cards.filter(b => b !== x); this.prim.forewing = x; this.say(`Forewing: 「${x.name}」 따로 둠`, 'good'); return true; }
      if ((/^Create a VP\. Until the end of Battle, when attacked from VP (I|II or VP III), Sun Descendant has -1 AT/.exec(c))) { this.createVP(null); if (/from VP I,/.test(c)) this.prim.vpLvlAT[1]++; else { this.prim.vpLvlAT[2]++; this.prim.vpLvlAT[3]++; } this.say('VP 공격 AT −1 (해당 VP)', 'good'); return true; }
      if (/^Create a VP\. During Escalation, choose which BP II card/.test(c)) { this.createVP(null); this.chooseBP2 = true; this.chooseBP2Perm = true; return true; }
      if (/^Create a VP\. Disable the Time-clocked keyword/.test(c)) { this.createVP(null); this.prim.disabled.clock = true; this.say('Time-clocked 비활성화', 'good'); return true; }
      if (/^Until the end of Battle, Laser Attacks deal -2 DANGER/.test(c)) { this.prim.laserMalus = (this.prim.laserMalus || 0) + 2; this.say('Laser Attack Danger −2', 'good'); if (t.fate > 0) { const ok = await this.ask({ type: 'yn', titan: t, title: `Lens-Eyes: Fate ${t.fate} → 0?`, options: [{ label: '초기화', value: true }, { label: '유지', value: false }] }); if (ok) t.fate = 0; } this.pendingFollowUp = t; return true; }
      if (/^Create a VP\. Disable the Sun Descendant's Laser Attacks/.test(c)) { this.createVP(null); this.prim.disabled.laser = true; this.say("Sun Descendant의 Laser Attack 비활성화", 'good'); return true; }
      if (/^Disable the Merciless Sun Trait/.test(c)) { this.prim.disabled.merciless = true; this.say('Merciless Sun 비활성화', 'good'); return true; }
      if (/^The Sun Descendant dies/.test(c)) { this.say(`🏆 ${this.prim.name}이(가) 죽었습니다!`, 'good'); throw new BattleOver('victory'); }
      if (/^You may perform a Bonus Attack/.test(c)) { this.pendingFollowUp = t; return true; }
      return false;
    },
    async sunPrimRoundStart() {
      if (this.trait('Bow or Die')) { const v = this.liveTitans().filter(t => !t.offBoard && !t.knockdown); for (const t of v) await this.solo(async () => { this.say(`${t.name}: Bow or Die — 넘어져 있지 않음, 소각`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); }); }
      if (this.trait('Merciless Sun') && !this.prim.disabled.merciless) { const c = this.prim.def.ai.find(a => a.sun && a.sun.merciless); this.say('Merciless Sun!', 'ai'); await this.safe(() => this.resolveAI(c)); }
    },
  });
}
