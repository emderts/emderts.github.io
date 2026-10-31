// Cycle V — Meduketos (hide & heatseek, Microwave Attacks, Lightbend / Skitter / Retreat, Slow Boiling)
// + Cycle V battle rules: Oxygen & Aether, Light X, Intermediary, new targeting lines.
import { Board, key, DIRS, DIR_LIST, cellLabel } from './core.js';
import { kw } from './core.js';

export function installMeduketos(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const OFF = { c: -40, r: -40 };
  const SCAN = { 1: 9, 2: 10, 3: 11, 4: 12, 5: 13, 6: 14, 7: 15, 8: 16, 9: 18 };
  const yn = (g, t, title, a = '예', b = '아니오') => g.ask({ type: 'yn', titan: t, title, options: [{ label: a, value: true }, { label: b, value: false }] });
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

  Object.assign(P, {
    c5b() { return !!(this.prim && (this.prim.def.cycle || 0) === 5); },
    medD() { return !!(this.prim && this.prim.def.medD); },
    // ---------- Oxygen & Aether (Cycle V battles) ----------
    async flipOxygen(t, n = 1, why = '') {
      for (let i = 0; i < n && t.alive; i++) {
        if ((t.oxygen || 0) > 0) { t.oxygen--; t.aether = (t.aether || 0) + 1; this.say(`${t.name}: Oxygen 1 → Aether${why ? ` (${why})` : ''} (O₂ ${t.oxygen}, Aether ${t.aether})`, 'bad'); }
        else if (this.c5b() && !this.prim.def.txD) { this.say(`${t.name}: 뒤집을 Oxygen 토큰이 없음 — 질식 사망`, 'bad'); await this.kill(t); return; }
        else this.say(`${t.name}: Oxygen 없음 (Cycle V 전투가 아니라 사망하지 않음)`);
      }
    },
    async discardOxygen(t, n = 1, why = '') {
      for (let i = 0; i < n && t.alive; i++) {
        if ((t.oxygen || 0) > 0) { t.oxygen--; this.say(`${t.name}: Oxygen 1 버림${why ? ` (${why})` : ''} → ${t.oxygen}`, 'bad'); }
        else if (this.c5b() && !this.prim.def.txD) { this.say(`${t.name}: 버릴 Oxygen 토큰이 없음 — 사망`, 'bad'); await this.kill(t); return; }
      }
    },
    flipAether(t, n = 1) { const k = Math.min(n, t.aether || 0); if (!k) { this.say(`${t.name}: 뒤집을 Aether 없음`); return; } t.aether -= k; t.oxygen = (t.oxygen || 0) + k; this.say(`${t.name}: Aether ${k} → Oxygen (O₂ ${t.oxygen})`, 'good'); },
    discardAether(t, n = 1) { const k = Math.min(n, t.aether || 0); if (!k) return; t.aether -= k; this.say(`${t.name}: Aether ${k} 버림 → ${t.aether}`); },
    // ---------- Light X ----------
    lightOf(t) {
      if (!t || !t.alive || t.offBoard) return 0; if (t.knockdown || (t.conditions || []).includes('Paralyzed') || (t.conditions || []).includes('Time-clocked')) return 0;
      let L = 0; for (const g of t.gear) { if (g.discarded || g.exhausted || g.blank) continue; const v = kw(this.gearText(g, t), 'Light'); if (typeof v === 'number') L += v; }
      const ih = this.inh(t, 'Light'); if (typeof ih === 'number') L += ih;
      if (this.ab(t, 'Aether Lamp')) L += t.aether || 0;
      if (!t.onVP && t.pos) { const ter = this.board.terrainAt(t.pos.c, t.pos.r); if (ter && ter.allied) L += 1; if (ter && ter.lightVoid) return 0; }
      return L;
    },
    gearLightCount(t) { return t.gear.filter(g => !g.discarded && kw(this.gearText(g, t), 'Light') !== null).length; },
    // ---------- targeting (Cycle V lines) ----------
    medPick(lines, exclude = [], opts = {}) {
      const base = () => this.liveTitans().filter(t => !t.offBoard && !exclude.includes(t));
      const pass = (hideVP) => {
        for (const line of lines || []) {
          let c = base(); if (hideVP) c = c.filter(t => !t.onVP);
          if (/Titans? on (all )?VP/.test(line)) { c = c.filter(t => t.onVP); if (/all VP/.test(line) && c.length) return { list: c }; }
          else if (/Most Light/.test(line)) { c = c.filter(t => this.lightOf(t) > 0); const m = Math.max(...c.map(t => this.lightOf(t))); c = c.filter(t => this.lightOf(t) === m); }
          else if (/Least Light/.test(line)) { c = c.filter(t => this.lightOf(t) > 0); const m = Math.min(...c.map(t => this.lightOf(t))); c = c.filter(t => this.lightOf(t) === m); }
          else if (/Most Oxygen/.test(line)) { c = c.filter(t => (t.oxygen || 0) > 0); const m = Math.max(...c.map(t => t.oxygen || 0)); c = c.filter(t => (t.oxygen || 0) === m); }
          else if (/Most Aether/.test(line)) { c = c.filter(t => (t.aether || 0) > 0); const m = Math.max(...c.map(t => t.aether || 0)); c = c.filter(t => (t.aether || 0) === m); }
          else if (/Least Ambrosia/.test(line)) { c = c.filter(t => (t.ambrosia || 0) > 0); const m = Math.min(...c.map(t => t.ambrosia || 0)); c = c.filter(t => (t.ambrosia || 0) === m); }
          else if (/Highest FATE/.test(line)) { const m = Math.max(...c.map(t => t.fate)); c = c.filter(t => t.fate === m); }
          else if (/Lowest FATE/.test(line)) { const m = Math.min(...c.map(t => t.fate)); c = c.filter(t => t.fate === m); }
          else if (/Intermediary/.test(line)) c = c.filter(t => t.intermediary);
          else if (/Priority Target/.test(line)) c = c.filter(t => t.pt);
          else if (/Random Titan/.test(line)) { if (c.length) return { list: [this.rng.pick(c)] }; continue; }
          else if (/Battle Board/.test(line)) { if (c.length) return { list: c }; continue; }
          if (!c.length) continue;
          return { list: [c.find(t => t.pt) || c[0]] };
        }
        return null;
      };
      return (this.prim.offBoard && this.medD() && !opts.allVP) ? (pass(true) || pass(false)) : pass(false);
    },
    // ---------- board presence ----------
    async medGoOff(why) {
      if (this.prim.offBoard) return; const cells = this.primCells(); const ctr = { c: this.prim.anchor.c + 1, r: this.prim.anchor.r + 1 };
      this.prim.offBoard = true; this.prim._last = { ...this.prim.anchor }; this.prim.anchor = { ...OFF };
      for (const o of this.titans) if (o.alive && o.onVP) o.pos = { ...OFF };
      this.say(`${this.prim.name}: ${why || 'Lightbend'} — 보드 밖으로 사라짐`, 'ai');
      if (!this.board.terrainAt(ctr.c, ctr.r) && !this.titanAt(ctr.c, ctr.r) && this.board.inBounds(ctr.c, ctr.r)) { this.board.addTerrain([`${'ABCDEFGHIJKLMN'[ctr.r - 1]}${ctr.c}`], { id: 'vent_' + (this._ventN = (this._ventN || 0) + 1), type: 'Petrified Vent', obstacle: true, obscuring: true, destructible: true, vent: true }); this.say(`${cellLabel(ctr)}에 Petrified Vent 배치`); }
      void cells; this.notify();
    },
    async medAppear(vent, who) {
      const vc = vent.cell; const cand = [];
      for (let dc = -2; dc <= 0; dc++) for (let dr = -2; dr <= 0; dr++) { const a = { c: vc.c + dc, r: vc.r + dr }; const cs = this.primCells(a); if (cs.some(p => !this.board.inBounds(p.c, p.r))) continue; const tit = cs.filter(p => this.titanAt(p.c, p.r)).length; const obs = cs.filter(p => { const z = this.board.terrainAt(p.c, p.r); return z && z.id !== vent.id && (z.obstacle || z.blocksPrim); }).length; cand.push({ a, score: tit * 10 + obs }); }
      if (!cand.length) { this.say('(Meduketos가 나타날 공간 없음)'); return; }
      const best = Math.min(...cand.map(x => x.score)); const ok = cand.filter(x => x.score === best);
      const pick = ok.length === 1 ? ok[0].a : (await this.ask({ type: 'choice', titan: who, title: `Meduketos 배치 (Vent ${cellLabel(vc)}를 포함하는 3x3)`, options: ok.map(x => ({ label: `${cellLabel(x.a)} 기준`, value: x.a })) }) || ok[0].a);
      this.board.removeTerrainId(vent.id); this.prim.offBoard = false; this.prim.anchor = { ...pick };
      for (const o of this.titans) if (o.alive && o.onVP) o.pos = { ...pick };
      this.faceMost(); this.say(`☀ Meduketos 발견! ${cellLabel(pick)} 기준에 나타남 (${this.prim.facing} 방향)`, 'good'); this.notify();
      await this.ukbOverlap([]);
      await this.medSkitter(this.prim.level, who, true);
    },
    async medSkitter(n, who, win = true) {
      if (this.prim.offBoard) return; if (this.prim.disabled.skitter) { this.say('Skitter 비활성화 — 이동 없음'); return; }
      if (win && this.trait('Candle in the Dark') && who && this.lightOf(who) < Math.ceil(this.prim.level / 2)) { win = false; this.say(`Candle in the Dark: ${who.name}의 Light ${this.lightOf(who)} < ${Math.ceil(this.prim.level / 2)} — Skitter의 ⚡ 없음`); }
      if (win && who && who.alive) await this.reactionWindow(who, { name: 'Skitter' }, `Skitter ${n}`);
      const dir = this.rng.pick(DIR_LIST); let k = 0;
      for (let i = 0; i < n; i++) { const na = { c: this.prim.anchor.c + DIRS[dir][0], r: this.prim.anchor.r + DIRS[dir][1] }; if (this.primCells(na).some(p => !this.board.inBounds(p.c, p.r) || this.board.terrainAt(p.c, p.r)?.blocksPrim)) break; await this.primStep(na, []); k++; }
      if (k) await this.primEndMove([]); this.say(`Skitter ${n}: 무작위 방향 ${dir}로 ${k}칸 → ${cellLabel(this.prim.anchor)} 기준`, 'ai'); this.notify();
    },
    async medRetreat(n, from) {
      if (this.prim.offBoard) return;
      if (!from || from.onVP || !from.pos) { const d = await this.ask({ type: 'choice', titan: from, title: `Retreat ${n}: 방향 선택 (VP 위)`, options: DIR_LIST.map(x => ({ label: x, value: x })) }) || 'N'; let k = 0; for (let i = 0; i < n; i++) { const na = { c: this.prim.anchor.c + DIRS[d][0], r: this.prim.anchor.r + DIRS[d][1] }; if (this.primCells(na).some(p => !this.board.inBounds(p.c, p.r) || this.board.terrainAt(p.c, p.r)?.blocksPrim)) break; await this.primStep(na, []); k++; } if (k) await this.primEndMove([]); this.say(`Retreat ${n}: ${d}로 ${k}칸 (회전 없음)`, 'ai'); this.notify(); return; }
      await this.oracleMoveAway(from.pos, n);
    },
    scanDiff() { const dead = this.titans.filter(t => !t.alive).length; return SCAN[this.prim.level] - (this.prim.scanMinus || 0) - (this.trait('Fat with Light') ? dead : 0) + (this.prim.scanPlus || 0); },
    ventsAdj(t, used) { const V = [...this.board.terrain.values()].filter(z => z.vent && !used.has(z.id)); const seen = new Set(); const out = []; for (const z of V) { if (seen.has(z.id)) continue; seen.add(z.id); if (t.onVP || (t.pos && Board.dist(t.pos, z.cell) === 1)) out.push(z); } return out; },
    async medScan(first) {
      const R = this.prim; R.scanRound = this.round; R.scanCards = R.scanCards || []; const usedT = R.scanUsedT = R.scanUsedT || new Set(); const usedV = R.scanUsedV = R.scanUsedV || new Set();
      const diff = this.scanDiff(); this.say(`Seabed Scan — 난이도 ${diff}${R.scanPlus ? ` (Smokestack +${R.scanPlus} 포함)` : ''}`, 'sys');
      let nxt = first;
      while (this.prim.offBoard) {
        const cands = this.liveTitans().filter(t => !t.offBoard && !usedT.has(t.id) && !t.knockdown && !(t.conditions || []).includes('Paralyzed') && this.ventsAdj(t, usedV).length);
        if (!cands.length) { this.say('(더 Scan할 수 있는 타이탄 없음)'); break; }
        let t = nxt && cands.includes(nxt) ? nxt : null; nxt = null;
        if (!t) t = await this.ask({ type: 'choice', title: `Seabed Scan: 다음 타이탄 (누적 ${R.scanCards.reduce((a, c) => a + (c.num || 0), 0)}, 난이도 ${diff})`, options: [...cands.map(x => ({ label: `${x.name} (Light ${this.lightOf(x)})`, value: x })), { label: 'Scan 끝내기', value: null }] });
        if (!t) break;
        const vs = this.ventsAdj(t, usedV); const v = vs.length === 1 ? vs[0] : await this.ask({ type: 'choice', titan: t, title: `${t.name}: Scan할 Petrified Vent`, options: vs.map(z => ({ label: cellLabel(z.cell), value: z })) }) || vs[0];
        usedT.add(t.id); usedV.add(v.id);
        let decl = null; if (this.trait('Truth or Death')) decl = await yn(this, t, `Truth or Death: ${cellLabel(v.cell)}에 Meduketos가 있다고 선언?`, '있다', '없다');
        let card = this.trauma.major.draw(); if (!card) { this.say('(Major Trauma 덱이 비었음)'); break; } R.scanCards.push(card);
        let tot = R.scanCards.reduce((a, c) => a + (c.num || 0), 0); const L = this.lightOf(t); let found = tot + L >= diff;
        if (!found && this.c5Abil) for (const a of this.c5Abil(t, 'Rescan\\.')) { if (!(await this.c5Use(t, a, `Rescan — 「${card.name}」(${card.num || 0}) 대신 Major Trauma 다시 뽑기 (현재 ${tot + L}/${diff})`))) continue; R.scanCards.pop(); this.trauma.major.shuffleIn(card); const c2 = this.trauma.major.draw(); if (!c2) break; R.scanCards.push(c2); this.say(`${t.name}: Rescan — 「${card.name}」 → 「${c2.name}」 (${c2.num || 0})`, 'good'); card = c2; tot = R.scanCards.reduce((a2, c) => a2 + (c.num || 0), 0); found = tot + L >= diff; break; }
        this.flash && this.flash('card', { kind: 'SCAN', titan: t.name, name: `${card.name} (${card.num || 0})`, text: `누적 ${tot} + Light ${L} = ${tot + L} / ${diff}`, cls: found ? 'good' : 'obol' });
        this.say(`${t.name}: Scan ${cellLabel(v.cell)} — 「${card.name}」 ${card.num || 0} · 누적 ${tot} + Light ${L} = ${tot + L} vs ${diff} → ${found ? '발견!' : '실패'}`, found ? 'good' : '');
        if (found) { R.scanPlus = 0; await this.medAppear(v, t); }
        if (decl !== null && decl !== found) { this.say(`Truth or Death: 선언이 틀림 — ${t.name} Obol`, 'bad'); await this.solo(() => this.obolDraw(t, 10)); }
        if (found) break;
      }
      if (this.prim.offBoard && R.scanPlus) { R.scanPlus = 0; }
      this.notify();
    },
    // ---------- AI ----------
    async medAttackList(card, list) {
      const res = new Map(); const c2 = card;
      for (const t of list) { if (!t.alive || t.offBoard) continue; const d0 = this.currentAI ? this.currentAI.dangerDealt : 0; let h = 0; try { h = await this.primAttackOn(t, c2) || 0; } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied) && !e.chainBreak) throw e; } res.set(t, { hits: h, danger: (this.currentAI ? this.currentAI.dangerDealt : 0) - d0 }); }
      if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); }
      return res;
    },
    medEdgeBeam(card, t) {
      const B = this.board; const d = { N: B.rows - t.pos.r, S: t.pos.r - 1, E: B.cols - t.pos.c, W: t.pos.c - 1 }; const m = Math.min(...Object.values(d)); const side = DIR_LIST.filter(x => d[x] === m)[0];
      const origin = side === 'N' ? { c: t.pos.c, r: B.rows } : side === 'S' ? { c: t.pos.c, r: 1 } : side === 'E' ? { c: B.cols, r: t.pos.r } : { c: 1, r: t.pos.r };
      const dir = OPP[side]; const before = { c: t.pos.c + DIRS[side][0], r: t.pos.r + DIRS[side][1] };
      this.say(`${this.prim.name}: 보드 밖 — 가장 가까운 보드 끝(${side})에서 Microwave Attack`, 'ai');
      if (B.inBounds(before.c, before.r) && !(origin.c === t.pos.c && origin.r === t.pos.r)) { const o = this.titanAt(before.c, before.r); const ter = B.terrainAt(before.c, before.r); if (o && o !== t) { this.say(`경로상 ${o.name}이(가) ${t.name} 앞 — 타겟 변경`, 'ai'); return { hits: [o], origin, dir }; } if (ter && ter.obstacle && !card.med.noBlock) { this.laserHandle({ kind: 'ter', ter, cell: before, dir }, card, [], { seen: new Set(), destroyed: new Set() }); return { hits: [], origin, dir }; } }
      return { hits: [t], origin, dir };
    },
    medTrench(origin, dir) {
      const cells = []; let p = { ...origin }; if (this.primContains(p) || !this.board.inBounds(p.c, p.r)) p = { c: p.c + DIRS[dir][0], r: p.r + DIRS[dir][1] };
      for (let i = 0; i < 5 && this.board.inBounds(p.c, p.r); i++) { if (!this.board.terrainAt(p.c, p.r) && !this.titanAt(p.c, p.r) && !this.primContains(p)) cells.push(p); p = { c: p.c + DIRS[dir][0], r: p.r + DIRS[dir][1] }; }
      if (!cells.length) { this.say('(Trench를 놓을 칸 없음)'); return; }
      const id = 'mtr' + (this._trN = (this._trN || 0) + 1); for (const q of cells) this.board.terrain.set(key(q.c, q.r), { id, type: 'Trench', obstacle: false, obscuring: false, destructible: false, indestructible: true, chasm: true, lightVoid: true, cell: q });
      this.say(`Trench 1x5 배치: ${cells.map(cellLabel).join(', ')}`, 'ai'); this.notify();
    },
    async medAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const M = card.med || {}; this.zoneShow = null;
      if (M.routine) { this.say('Black Immolation: 모든 타이탄 Oxygen 1 버림 · Burn · Ambrosia +1', 'ai'); for (const t of [...this.liveTitans()]) await this.solo(async () => { await this.discardOxygen(t, 1, 'Black Immolation'); if (t.alive) await this.burn(t, true); await this.flushBurn(); if (t.alive) await this.gainAmbrosia(t, 1); }); return; }
      const winOK = () => !this.trait('Three Seconds') && !(this.prim.offBoard && !this.prim.keepWin && M.mw);
      const routine = async () => { if (card !== this.routine) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); } };
      if (M.zone) {
        const att = forcedTarget && forcedTarget.alive ? [forcedTarget] : this.liveTitans().filter(t => !t.offBoard);
        this.say(`Zone Attack 대상: ${att.map(t => t.name).join(', ') || '(없음)'}`, 'ai'); if (!att.length) return;
        if (!this.trait('Three Seconds')) await this.reactionWindow(att[0], card, 'ATTACK');
        const res = await this.medAttackList(card, att);
        for (const [t, r] of res) if (t.alive && card.after) await this.solo(() => this.doEffects(t, card.after, { card, after: true, hits: r.hits }));
        { const AF = M.afterFinal || card.afterFinal; if (AF) { this.say(`After Final Attack: ${AF}`); await this.doSentence(null, AF, { card }); } }
        return;
      }
      const sel = forcedTarget && forcedTarget.alive ? { list: [forcedTarget] } : this.medPick(card.target);
      if (!sel || !sel.list.length) return routine();
      let primary = sel.list[0]; this.say(`타겟: ${sel.list.map(t => t.name + (t.onVP ? ' (VP)' : '')).join(', ')}`);
      if (winOK()) await this.reactionWindow(primary, card, 'MOVE LATERAL & ATTACK'); else if (M.mw) this.say(this.trait('Three Seconds') ? 'Three Seconds: Microwave Attack 앞 ⚡ 무시' : '보드 밖 공격 — 처음 ⚡와 이동 명령 무시');
      const once = async (tg) => {
        if (!tg.alive || tg.offBoard) return { dealt: false };
        let att, origin = null, dir = null;
        if (tg.onVP) att = [tg];
        else if (this.prim.offBoard) ({ hits: att, origin, dir } = this.medEdgeBeam(card, tg));
        else { await this.laserLateral(tg); if (!tg.alive) return { dealt: false }; dir = this.prim.facing; origin = this.sideCells(dir).find(p => (DIRS[dir][0] ? p.r === tg.pos.r : p.c === tg.pos.c)) || this.sideCells(dir)[0];
          if (M.noBlock) att = [tg]; else { const c2 = { ...card, oracle: { laser: 'single' } }; att = [...new Set(this.laserTargets(c2, tg).hits)]; } }
        const res = await this.medAttackList(card, att); let dealt = false;
        for (const [t, r] of res) { if (r.danger > 0) dealt = true; if (card.after && !/repeat this Attack|Trench Terrain tile/.test(card.after) && t.alive) await this.solo(() => this.doEffects(t, card.after, { card, after: true, hits: r.hits })); }
        if (M.trench && origin && dir) { if (winOK() && this.liveTitans()[0]) await this.reactionWindow(this.liveTitans()[0], card, 'After Attack: Trench'); this.medTrench(origin, dir); }
        return { dealt };
      };
      const done = [...sel.list]; let r0 = { dealt: false };
      for (const tg of sel.list) { const r = await once(tg); r0.dealt = r0.dealt || r.dealt; }
      let n = M.repeat || 0;
      while (n-- > 0 && r0.dealt) {
        const nx = this.medPick(card.target, done); if (!nx || !nx.list.length) { this.say('(반복할 다른 타겟 없음)'); break; }
        const tg = nx.list[0]; done.push(tg); this.say(`After Attack: DANGER를 줬음 — ${tg.name}에게 반복`, 'ai');
        if (winOK()) await this.reactionWindow(tg, card, 'After Attack: 반복'); r0 = await once(tg);
      }
    },
    async medEffect(t, s, hits, card) {
      let m;
      { const parts = (s.match(/[^.]+\.?/g) || []).map(x => x.trim()).filter(Boolean); if (parts.length > 1 && !/^FATE \d+\+:/.test(s)) { for (const q of parts) { await this.applyAttackEffect(t, q, hits, card); if (!t.alive) throw new TitanDied(t); } return true; } }
      if (/^Each hit deals \d+ DANGER$/.test(s)) return this.applyAttackEffect0(t, s + '.', hits, { ...card, med: null }).then(() => true);
      if ((m = /^FATE (\d+)\+: (.+)$/.exec(s))) { if (this.effFate(t) >= +m[1]) { this.say(`Fate ${m[1]}+: ${m[2]}`); await this.doEffects(t, m[2], { card, hits }); } return true; }
      if ((m = /^Each hit deals (\d+) DANGER and 1 Despair token\.?$/.exec(s))) { await this.dealFD(t, 0, +m[1] * hits, card, hits, null, { laser: !!card.laser }); if (t.alive) await this.gainDespair(t, hits); return true; }
      if ((m = /^Each hit deals (\d+) DANGER and flips 1 Oxygen token\.?$/.exec(s))) { await this.dealFD(t, 0, +m[1] * hits, card, hits, null, { laser: !!card.laser }); if (t.alive) await this.flipOxygen(t, hits, card.name); return true; }
      if ((m = /^Each hit deals (\d+) DANGER \+1 additional DANGER for each Gear card with the Light X keyword\.?$/.exec(s))) { const per = +m[1] + this.gearLightCount(t); this.say(`Lights Out: Light X 장비 ${this.gearLightCount(t)}개 — hit당 ${per} Danger`); await this.dealFD(t, 0, per * hits, card, hits, null, { laser: !!card.laser }); return true; }
      if (/^Gain as many Despair tokens as there are hits\.?$/.test(s)) { if (hits) await this.gainDespair(t, hits); return true; }
      if (/^Then, if adjacent to a Petrified Vent Terrain tile, gain 5 Ambrosia tokens and remove that Vent\.?$/.test(s)) { const vs = this.ventsAdj({ ...t, onVP: false }, new Set()); if (!t.onVP && vs.length) { const v = vs.length === 1 ? vs[0] : await this.ask({ type: 'choice', titan: t, title: '제거할 인접 Petrified Vent', options: vs.map(z => ({ label: cellLabel(z.cell), value: z })) }) || vs[0]; await this.gainAmbrosia(t, 5); this.board.removeTerrainId(v.id); this.say(`${t.name}: 인접 Vent ${cellLabel(v.cell)} 제거, Ambrosia +5`, 'bad'); } return true; }
      return false;
    },
    async medSentence(t, p, ctx = {}) {
      let m; const alive = !!(t && t.alive);
      if (/^(?:⚡ )?If DANGER was dealt, repeat this Attack/.test(p) || /^(?:⚡ )?Place a 1x5 Trench Terrain tile/.test(p)) return true;
      if ((m = /^Gain the (Holy Terror|Terror|Paralyzed|Bravery) Condition card\.?$/.exec(p))) { if (alive) await this.addCondition(t, m[1]); return true; }
      if ((m = /^Retreat (\d+)\.?$/.exec(p))) { await this.medRetreat(+m[1], t); return true; }
      if ((m = /^Skitter (\d+)\.?$/.exec(p))) { await this.medSkitter(+m[1], t, false); return true; }
      if (/^Lightbend\.?$/.test(p)) { await this.medGoOff('Lightbend'); return true; }
      if (/^Create a VP\.?$/.test(p)) { this.createVP(null); return true; }
      if ((m = /^Flip (\d+) Oxygen tokens?\.?$/.exec(p))) { if (alive) await this.flipOxygen(t, +m[1]); return true; }
      if ((m = /^Discard (\d+) Oxygen tokens?\.?$/.exec(p))) { if (alive) await this.discardOxygen(t, +m[1]); return true; }
      if ((m = /^Flip (\d+) Aether tokens?\.?$/.exec(p))) { if (alive) this.flipAether(t, +m[1]); return true; }
      if ((m = /^Discard (\d+) Aether tokens?\.?$/.exec(p))) { if (alive) this.discardAether(t, +m[1]); return true; }
      if (/^Gain 1 Ambrosia token and 1 Aether token\.?$/.test(p)) { if (alive) { await this.gainAmbrosia(t, 1); if (t.alive) { t.aether = (t.aether || 0) + 1; this.say(`${t.name}: Aether +1 → ${t.aether}`); } } return true; }
      if (/^Gain X Despair tokens, where X is the Primordial level\.?$/.test(p)) { if (alive) await this.gainDespair(t, this.prim.level); return true; }
      if (/^Gain the Holy Terror Condition card and as many Despair tokens as you have Aether tokens\.?$/.test(p)) { if (alive) { await this.addCondition(t, 'Holy Terror'); if (t.alive && t.aether) await this.gainDespair(t, t.aether); } return true; }
      if (/^Gain as many Ambrosia tokens as you have Aether tokens \(minimum 1\)\.?$/.test(p)) { if (alive) await this.gainAmbrosia(t, Math.max(1, t.aether || 0)); return true; }
      if (/^You are petrified \(die\)\.?$/.test(p)) { if (alive) { this.say(`${t.name}: 석화 — 사망`, 'bad'); await this.kill(t); } return true; }
      if (/^(?:⚡ )?Three or more hits, gain the Paralyzed Condition card\.?$/.test(p)) { if (alive && (ctx.hits || 0) >= 3) await this.addCondition(t, 'Paralyzed'); return true; }
      if (/^(?:⚡ )?Three or more hits, Burn\.?$/.test(p)) { if (alive && (ctx.hits || 0) >= 3) { await this.burn(t, true); await this.flushBurn(); } return true; }
      if (/^Gain the Terror Condition card and as many Ambrosia tokens as there were hits\.?$/.test(p)) { if (alive) { await this.addCondition(t, 'Terror'); if (t.alive && ctx.hits) await this.gainAmbrosia(t, ctx.hits); } return true; }
      if (/^Raise the difficulty of the next Scan by X, where X is the Primordial level\.?$/.test(p)) { this.prim.scanPlus = (this.prim.scanPlus || 0) + this.prim.level; this.say(`다음 Scan 난이도 +${this.prim.level}`, 'ai'); return true; }
      return false;
    },
    async medCritical(t, A) {
      const c = A.bp.critical || ''; const parts = (c.match(/[^.!]+[.!]?/g) || []).map(x => x.trim()).filter(Boolean);
      for (const x of parts) {
        if (/^Create a VP/.test(x)) { this.createVP(null); continue; }
        if (/^Perform a Bonus Attack/.test(x)) { this.pendingFollowUp = t; continue; }
        if (/^Permanently lower Scan Difficulty by (\d)/.test(x)) { const n = +/by (\d)/.exec(x)[1]; this.prim.scanMinus = (this.prim.scanMinus || 0) + n; this.say(`Scan 난이도 영구 −${n} (현재 ${this.scanDiff()})`, 'good'); continue; }
        if (/^Disable Ambrosia Responses/.test(x)) { this.prim.disabled.ambResp = true; this.say('Ambrosia 아이콘 BP의 Response 비활성화', 'good'); continue; }
        if (/^Disable the Microwave Shield Trait/.test(x)) { this.prim.disabled['Microwave Shield'] = true; this.say('Microwave Shield 비활성화', 'good'); continue; }
        if (/^Disable Incineration on Crash/.test(x)) { this.prim.disabled.incinerate = true; this.say('Crash 소각 비활성화', 'good'); continue; }
        if (/^Disable the Burn keyword/.test(x)) { this.prim.disabled.burn = true; this.say('Burn 키워드 비활성화', 'good'); continue; }
        if (/^Disable the Skitter keyword/.test(x)) { this.prim.disabled.skitter = true; this.say('Skitter 비활성화', 'good'); continue; }
        if (/^Attacks from outside of the Battle Board don't lose/.test(x)) { this.prim.keepWin = true; this.say('보드 밖 공격도 ⚡ 유지', 'good'); continue; }
        if (/^Discard all Fear, Dread, Terror, and Holy Terror Condition cards/.test(x)) { for (const o of this.liveTitans()) o.conditions = o.conditions.filter(k => !['Fear', 'Dread', 'Terror', 'Holy Terror'].includes(k)); this.say('모든 타이탄 Fear/Dread/Terror/Holy Terror 버림', 'good'); continue; }
        if (/^Disable gaining those Condition cards/.test(x)) { this.prim.disabled.fearConds = true; continue; }
        if (/^Flip 1 Aether token/.test(x)) { this.flipAether(t, 1); continue; }
        if (/^Gain the Bravery Condition card/.test(x)) { await this.addCondition(t, 'Bravery'); continue; }
        if (/^Gain the .+ card \(Secret deck/.test(x)) { this.say(`(${x} — 캠페인 보상, 전투 효과 없음)`, 'sys'); continue; }
        if (/^The Meduketos dies/.test(x)) { this.say(`${A.bp.name} — ${this.prim.name} 즉사!`, 'good'); A.slay = true; continue; }
        this.say(`(Critical 효과 수동 적용 필요: ${x})`, 'sys');
      }
      return true;
    },
    // Microwave Shield: before the Attack Roll, discard 1 Kratos Pool token per space between attacker and Meduketos
    async medShield(t, A) {
      if ((!this.medD() && !(this.ufD && this.ufD())) || !this.trait('Microwave Shield') || t.onVP) return; const n = Math.max(0, this.distTo(t) - 1); if (!n) return;
      const K = this.kratosPool; const NM = { opening: 'Opening', break: 'Break', fire: 'Fire', black: 'Black', hope: 'Hope', rouse: 'Rouse', closing: 'Closing', diversion: 'Diversion' };
      let left = n; this.say(`Microwave Shield: 사이 칸 ${n} — Kratos Pool 토큰 ${n}개 버림`, 'bad');
      while (left > 0) { const have = Object.keys(NM).filter(k => (K[k] || 0) > 0); if (!have.length) break; const k = have.length === 1 ? have[0] : await this.ask({ type: 'choice', titan: t, title: `Microwave Shield: 버릴 토큰 (${n - left + 1}/${n})`, options: have.map(x => ({ label: `${NM[x]} (${K[x]})`, value: x })) }) || have[0]; K[k]--; left--; this.say(`Kratos Pool: ${NM[k]} −1`); }
    },
    async medHoldOn(t) {
      const off = this.prim.offBoard; const [sk, n] = off ? ['Courage', 7] : ['Endurance', 9];
      const ok = await this.skillTest(t, sk, n); this.say(`${t.name}: Hold On (${sk} ${n}+) — ${ok ? '성공' : '실패'}`, ok ? 'good' : 'bad'); if (ok) return;
      if (off) { this.say(`${t.name}: Meduketos가 보드 밖 — Falling Down으로 사망 (무시 불가)`, 'bad'); await this.kill(t, { unavoidable: true }); return; }
      await this.discardOxygen(t, 1, 'Hold On 실패'); if (!t.alive) return; await this.knockdown(t, true); if (t.alive && t.onVP) await this.leaveVP(t);
    },
  });

  // ---------- wiring ----------
  wrap('startOfBattle', async function (o, ...a) {
    for (const t of this.titans) if (t.alive && this.ab(t, 'Selenian Strain')) { t.aether = (t.aether || 0) + 1; this.say(`${t.name}: Selenian Strain — Aether 토큰 1`, 'sys'); }
    if (this.c5b()) {
      const dd = this.trait('Deeper Depths') ? 1 : 0; for (const t of this.titans) if (t.alive) { t.oxygen = (t.oxygen || 0) + 2 - dd; t.aether = t.aether || 0; }
      this.say(`Oxygen and Aether: 각 타이탄 Oxygen ${2 - dd}개로 시작${dd ? ' (Deeper Depths −1)' : ''}`, 'sys');
      const live = this.liveTitans(); if (live.length && !live.some(t => t.intermediary)) { const im = live.length === 1 ? live[0] : await this.ask({ type: 'choice', title: 'Intermediary (Dodona Sage) 선택 — 전투 시작 Rage +1', options: live.map(t => ({ label: t.name, value: t })) }) || live[0]; im.intermediary = true; this.say(`${im.name}: Intermediary — Rage +1`, 'sys'); await this.gainRage(im, 1, false); }
    }
    return o.call(this, ...a);
  });
  wrap('kill', async function (o, t, ...r) { const was = t && t.alive && t.intermediary; try { return await o.call(this, t, ...r); } finally { if (was && !t.alive) { t.intermediary = false; const live = this.liveTitans(); if (live.length && this.c5b()) { const im = live.length === 1 ? live[0] : await this.ask({ type: 'choice', title: 'Intermediary 사망 — 새 Intermediary 선택', options: live.map(x => ({ label: x.name, value: x })) }) || live[0]; im.intermediary = true; this.say(`${im.name}: 새 Intermediary`, 'sys'); } } } });
  wrap('titanTurn', async function (o, t, ...r) {
    if (this.medD() && t.alive && t.onVP && this.trait('Invisible Flame')) { this.say(`Invisible Flame: ${t.name} VP에서 턴 시작 — Ambrosia +1, Pain +1`, 'bad'); await this.solo(async () => { await this.gainAmbrosia(t, 1); if (t.alive) await this.gainPain(t, 1, 'Invisible Flame'); }); if (!t.alive) return; }
    const end = async () => { if (!t.alive || !this.c5b()) return; if (this.medD() && t.onVP) { this.say(`Black Back: ${t.name} 턴 종료 — Burn`, 'bad'); await this.solo(async () => { await this.burn(t, false); }); } if (t.alive) await this.solo(() => this.flipOxygen(t, 1, '턴 종료')); };
    try { const res = await o.call(this, t, ...r); await end(); return res; } catch (e) { if (e && e.chainBreak && !(e instanceof BattleOver)) await end(); throw e; }
  });
  wrap('burn', async function (o, t, ...r) { if (this.medD() && this.prim.disabled.burn) { this.say('(Burn 비활성화)'); return; } if (this.c5b() && t && t.alive && t.aether) this.discardAether(t, 1); return o.call(this, t, ...r); });
  wrap('awaken', async function (o, t, ...r) { const res = await o.call(this, t, ...r); if (this.c5b() && t && t.aether && t.godform) { this.say(`${t.name}: 각성 — Aether ${t.aether}개 모두 버림`); t.aether = 0; } return res; });
  wrap('addCondition', async function (o, t, name, ...r) { if (this.medD() && this.prim.disabled.fearConds && ['Fear', 'Dread', 'Terror', 'Holy Terror'].includes(name)) { this.say(`${t.name}: ${name} 획득 비활성화됨`, 'good'); return; } return o.call(this, t, name, ...r); });
  wrap('crashPrim', async function (o, t, ...r) { if (this.medD() && this.trait('Heat Death') && !this.prim.disabled.incinerate && t && t.alive) { this.say(`Heat Death: ${t.name} Crash — 소각`, 'bad'); return this.kill(t, { instant: true, incinerate: true }); } return o.call(this, t, ...r); });
  wrap('primStep', async function (o, na, ...r) { if (!this.medD() || this.trait('Nap of the Vent')) return o.call(this, na, ...r); const V = [...this.board.terrain.values()].filter(z => z.vent && z.destructible); for (const z of V) z.destructible = false; try { return await o.call(this, na, ...r); } finally { for (const z of V) z.destructible = true; } });
  wrap('holdOn', async function (o, t) { if (this.medD() && t && t.alive && t.onVP) return this.medHoldOn(t); return o.call(this, t); });
  wrap('climbVP', async function (o, t, ...r) { const res = await o.call(this, t, ...r); if (this.medD() && t.alive && t.onVP && this.trait('Invisible Flame')) { this.say(`Invisible Flame: ${t.name} VP 등반 — Ambrosia +1, Pain +1`, 'bad'); await this.gainAmbrosia(t, 1); if (t.alive) await this.gainPain(t, 1, 'Invisible Flame'); } return res; });
  wrap('chooseMove', async function (o, t, max, label = '이동', ...r) {
    if (this.medD() && t && t.onVP && this.trait('Tigerback') && ['이동', 'Rush', 'Run'].includes(label) && !this.prim.offBoard) { const ok = await this.skillTest(t, 'Will', 7); this.say(`Tigerback: ${t.name} VP에서 내려가기 — Climb Down (Will 7+) ${ok ? '성공' : '실패'}`, ok ? 'good' : 'bad'); if (!ok) return null; }
    return o.call(this, t, max, label, ...r);
  });
  wrap('freeActions', function (o, t) {
    const out = o.call(this, t);
    if (this.medD() && this.prim.offBoard && this.prim.scanRound !== this.round && t && t.alive && !t.knockdown && !(t.conditions || []).includes('Paralyzed') && this.liveTitans().some(x => this.ventsAdj(x, new Set()).length)) out.push({ label: `[Seabed Scan] 그룹 탐색 (라운드 1회 · 난이도 ${this.scanDiff()})`, noFate: true, value: () => this.medScan(this.ventsAdj(t, new Set()).length ? t : null) });
    return out;
  });
  wrap('titanRound', async function (o, ...a) {
    const off0 = this.medD() && this.prim.offBoard; if (this.medD()) { this.prim.scanUsedT = new Set(); this.prim.scanUsedV = new Set(); }
    const res = await o.call(this, ...a);
    if (this.medD()) {
      for (const c of this.prim.scanCards || []) this.trauma.major.shuffleIn(c); if ((this.prim.scanCards || []).length) this.say('Titan Round 종료: Scan한 Major Trauma 카드를 덱에 섞음'); this.prim.scanCards = [];
      if (off0 && this.prim.offBoard && this.trait('Black Soup')) { this.say('Black Soup: 이번 Titan Round에 Meduketos를 찾지 못함 — 모든 타이탄 사망', 'bad'); for (const t of [...this.liveTitans()]) await this.solo(() => this.kill(t, { unavoidable: true })); }
    }
    return res;
  });
  // Slow Boiling: Wounds not dealt from a VP
  wrap('applyWound', async function (o, A) {
    const b = this.woundCount(); const res = await o.call(this, A);
    if (this.medD() && this.trait('Slow Boiling') && A && A.t && !A.t.onVP) { const d = this.woundCount() - b; if (d > 0) { this.prim.boil = (this.prim.boil || 0) + d; this.say(`Slow Boiling: 토큰 +${d} → ${this.prim.boil}`, 'ai'); if (this.prim.boil >= 3) this.prim.boilPending = true; } }
    return res;
  });
  wrap('titanAttack', async function (o, t, ...r) {
    try { return await o.call(this, t, ...r); } finally {
      if (this.medD() && this.prim.boilPending) { this.prim.boilPending = false; this.prim.boil = 0; this.say('Slow Boiling: 토큰 3개 — Lightbend, VP 1개 생성, AI 카드 1장', 'ai'); await this.medGoOff('Slow Boiling'); this.createVP(null); const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (!c._removed) this.ai.discard.push(c); } }
    }
  });
}
