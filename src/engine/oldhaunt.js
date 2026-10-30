// Cycle IV secret battle — The Old Haunt (Helios statue): laser / sun / zone Judgements, Merciless Sun,
// Pitiless Sun, God Among Men, Glass it All, Irem Tower destruction traits, Sun Circles, Eclipse Point VP.
import { Board, key, DIRS, DIR_LIST, cellLabel, parseCell } from './core.js';

export function installOldHaunt(Game, { TitanDied, BattleOver }) {
  Object.assign(Game.prototype, {
    ohSetup() {
      const P = this.prim;
      P._ohCenter = { ...P.anchor };
      this._ohTowersRemoved = 0; this._ohTowerQ = [];
      // Irem Tower destruction hook (God Taken Law counts every removed Tower)
      const B = this.board; const game = this;
      if (!B._ohHooked) { const orig = B.removeTerrainId.bind(B); B.removeTerrainId = function (id) { const cells = [...this.terrain.values()].filter(z => z.id === id); const tower = cells.find(z => z.type === 'Irem Tower'); const r = orig(id); if (tower) { game._ohTowersRemoved = (game._ohTowersRemoved || 0) + 1; (game._ohTowerQ = game._ohTowerQ || []).push({ cells: cells.map(z => z.cell), n: game._ohTowersRemoved }); } return r; }; B._ohHooked = true; }
      this.say(`Old Haunt: ${cellLabel(P.anchor)} 기준, ${P.facing} 방향. Eclipse Point VP는 BP로 생성.`, 'sys');
    },
    // ---------- shading (as Sun Descendant: light from the board edge behind the Old Haunt) ----------
    ohLightStep(p) { const f = this.prim.facing; return { c: p.c - DIRS[f][0], r: p.r - DIRS[f][1] }; },
    ohShadeSource(p) { const q = this.ohLightStep(p); if (!this.board.inBounds(q.c, q.r)) return null; const ter = this.board.terrainAt(q.c, q.r); if (ter && (ter.obstacle || ter.obscuring)) return { ter, cell: q }; const o = this.titanAt(q.c, q.r); if (o && o.alive && !o.onVP && !o.offBoard) return { titan: o, cell: q }; return null; },
    ohShaded(t) {
      if (!t || t.offBoard) return true;
      if (this.trait('Cannot Hide From the Sun') && t.pt) return false;
      if (t.onVP) return !this.trait('Magnifying Glass'); // Eclipse Point is always shaded
      if (t.stair) return true;
      if (t.shadedTok) return true;
      if (t.gear && t.gear.some(g => !g.discarded && /You are never considered to be on a Shaded space/.test(this.gearText(g, t)))) return false;
      return !!this.ohShadeSource(t.pos);
    },
    ohUnshadedCells() { const out = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const p = { c, r }; if (!this.primContains(p) && !this.ohShadeSource(p)) out.push(p); } return out; },
    ohGlass(shadedTitans, why = 'Glass it All') {
      for (const t of shadedTitans) { if (!t.alive || t.onVP || t.offBoard || t.stair || !t.pos) continue; const s = this.ohShadeSource(t.pos); if (s && s.ter) { this.board.removeTerrainId(s.ter.id); this.say(`${why}: ${t.name}을(를) 가린 ${s.ter.type} (${cellLabel(s.cell)}) 파괴`, 'ai'); } }
      this.notify();
    },
    // ---------- zones ----------
    ohZoneCells(z) { if (z === 'embrace') return this.diamondCells(0, 4); if (z === 'denial') return this.diamondCells(0, 7); return []; },
    ohDestroyCells(cells, why) { const ids = new Set(); for (const p of cells) { const z = this.board.terrainAt(p.c, p.r); if (z && !z.indestructible) ids.add(z.id); } for (const id of ids) this.board.removeTerrainId(id); this.say(`${why}: 지형 ${ids.size}개 파괴`, 'ai'); this.notify(); },
    // ---------- Irem Tower queue (God Taken Law) ----------
    async ohFlushTowers() {
      const Q = this._ohTowerQ || []; this._ohTowerQ = [];
      if (!this.trait('God Taken Law')) return;
      for (const q of Q) { const X = q.n - 1; if (X <= 0) { this.say('God Taken Law: 처음 무너진 Irem Tower — 피해 없음 (이미 제거된 탑 0개)'); continue; } const adj = this.liveTitans().filter(t => !t.offBoard && !t.onVP && t.pos && q.cells.some(c => Board.dist(c, t.pos) === 1 || (c.c === t.pos.c && c.r === t.pos.r))); this.say(`God Taken Law: Irem Tower 붕괴 — 인접 타이탄 ${adj.map(t => t.name).join(', ') || '(없음)'}에게 Danger ${X}`, 'ai'); for (const t of adj) await this.solo(() => this.gainDanger(t, X, { source: 'God Taken Law' })); }
    },
    ohClosestTower() { const T = [...this.board.terrain.values()].filter(z => z.type === 'Irem Tower'); if (!T.length) return null; const d = z => Board.distToCells(z.cell, this.primCells()); const m = Math.min(...T.map(d)); return T.find(z => d(z) === m); },
    // ---------- Sun Circles ----------
    async ohAppearAtSunCircle() {
      const L = (this.prim.def.sunCircles || []).map(parseCell); if (!L.length) return;
      const cur = this.primCells(); const onIdx = L.findIndex(a => this.primCells(a).some(p => cur.some(q => q.c === p.c && q.r === p.r)));
      let dest;
      if (onIdx >= 0) dest = L[(onIdx + 1) % L.length];
      else { const c = this.primCenter(); const dist = a => { const cc = { x: a.c + 0.5, y: a.r + 0.5 }; return Math.abs(cc.x - c.x) + Math.abs(cc.y - c.y); }; const m = Math.min(...L.map(dist)); dest = L.find(a => dist(a) === m); }
      await this.ohPlaceAt(dest, true);
    },
    async ohPlaceAt(dest, circle) {
      for (const p of this.primCells(dest)) { const ter = this.board.terrainAt(p.c, p.r); if (ter && !ter.indestructible) { this.board.removeTerrainId(ter.id); this.say(`${ter.type} 파괴 (Old Haunt 등장)`); } }
      this.prim.anchor = { ...dest }; for (const o of this.titans) if (o.alive && o.onVP) o.pos = { ...dest };
      for (const o of this.liveTitans()) if (!o.onVP && !o.offBoard && o.pos && this.primContains(o.pos)) { const d = this.nearestFree(o.pos, o); if (d) { o.pos = d; this.say(`${o.name}: Old Haunt 등장에 밀려 ${cellLabel(d)}로`); } }
      this.faceMost(); this.say(`☀ Old Haunt가 ${circle ? 'Sun Circle ' : '보드 중앙 '}${cellLabel(dest)}에 나타남 (${this.prim.facing} 방향)`, 'ai'); this.notify();
      if (circle && this.trait('Spontaneous Supernova')) {
        const live = this.liveTitans().filter(t => !t.offBoard); const un = live.filter(t => !this.ohShaded(t)); const sh = live.filter(t => this.ohShaded(t));
        this.say(`Spontaneous Supernova: 그늘 밖 타이탄 ${un.map(t => t.name).join(', ') || '(없음)'} 소각`, 'bad');
        for (const t of un) await this.solo(() => this.kill(t, { instant: true, incinerate: true }));
        this.ohGlass(sh, 'Spontaneous Supernova');
      }
      await this.ohFlushTowers();
    },
    // ---------- AI resolution ----------
    async ohAttackList(card, list, judge) {
      const hit = []; const c2 = judge ? { ...card, kind: 'JUDGEMENT', judge } : card;
      for (const t of list) { if (!t.alive || t.offBoard) continue; try { const h = await this.primAttackOn(t, c2); if (h) hit.push(t); } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied) && !(e.chainBreak && this.isZoneCard && this.isZoneCard(card))) throw e; } }
      if (this.pendingBonus) { const pb = this.pendingBonus; this.pendingBonus = null; await this.safe(() => this.bonusAttackFlow(pb.titan, pb)); }
      return hit;
    },
    async ohAfter(ops, card, att, ctx) {
      for (const op of ops || []) {
        if (op === 'burn') { for (const x of att) if (x.alive && !x.offBoard) await this.solo(() => this.burn(x, true)); }
        else if (op === 'kd') { for (const x of att) if (x.alive && !x.offBoard) await this.solo(() => this.knockdown(x)); }
        else if (/^kb(\d+)$/.test(op)) { const n = +/^kb(\d+)$/.exec(op)[1]; for (const x of att) if (x.alive && !x.offBoard && !x.onVP) await this.solo(() => this.knockback(x, n)); }
        else if (op === 'destroyZone') this.ohDestroyCells(ctx.zoneCells || [], 'After Final Attack (Zone)');
        else if (op === 'destroyZone3') { const cells = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const p = { c, r }; if (!this.primContains(p) && this.zoneDist(p) <= 3) cells.push(p); } this.ohDestroyCells(cells, 'After Final Attack (Zone 3)'); }
        else if (op === 'mercilessAfter') {
          const l = this.liveTitans().filter(x => !x.offBoard); if (!l.length) continue;
          const mn = Math.min(...l.map(x => x.fate)); const lo = l.filter(x => x.fate === mn); const a = lo.length === 1 ? lo[0] : await this.ask({ type: 'choice', title: `Merciless Sun: Fate 최저(${mn}) 타이탄이 여럿 — Wish Away 12 대상`, options: lo.map(x => ({ label: x.name, value: x })) });
          this.say(`Merciless Sun: Fate 최저 ${a.name} — Wish Away 12`, 'ai'); await this.solo(() => this.wishAway(a, 12, { terrain: true }));
          const l2 = this.liveTitans().filter(x => !x.offBoard); if (!l2.length) continue; const mx = Math.max(...l2.map(x => x.fate)); const hi = l2.filter(x => x.fate === mx); const b = hi.length === 1 ? hi[0] : await this.ask({ type: 'choice', title: `Merciless Sun: Fate 최고(${mx}) 타이탄이 여럿 — Midas 1 대상`, options: hi.map(x => ({ label: x.name, value: x })) });
          this.say(`Merciless Sun: Fate 최고 ${b.name} — Midas 1`, 'ai'); await this.solo(() => this.midasX(b, 1));
        }
      }
    },
    ohWinLabel(card) { return (card.steps[0] || '').replace('⚡ ', '').split(' |')[0]; },
    async ohAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const O = card.oh; const ctx = { zoneCells: null }; let att = [];
      const routine = async () => { if (card !== this.routine) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); } };
      const window = async (who) => { if (!O.win) return; if (O.merciless && this.trait('God Given Law')) { this.say('God Given Law: Merciless Sun 앞 ⚡ 무시'); return; } await this.reactionWindow(who || this.liveTitans()[0] || this.titans[0], card, this.ohWinLabel(card)); };
      if (O.mode === 'iwasthesun') {
        if (!card._revealed) { card._revealed = true; card._removed = true; this.ai.putTop(card); this._endRound = true; this.say('I WAS THE SUN — 공개된 채 AI 덱 맨 위에 남기고 Primordial Round 종료. 다음 Primordial Round 시작에 공개되어 있으면 모든 타이탄 소각!', 'bad'); return; }
        card._revealed = false; this.say('I WAS THE SUN — 모든 타이탄 소각', 'bad'); this.zoneShow = null;
        for (const t of [...this.liveTitans()]) await this.solo(() => this.kill(t, { instant: true, incinerate: true }));
        return;
      }
      if (O.mode === 'laser' || O.mode === 'range') {
        let primary = forcedTarget && forcedTarget.alive && !forcedTarget.offBoard ? forcedTarget : this.pickTarget(card.target, O.mode === 'range');
        if (!primary) { if (O.noTargetDie) { const l = this.liveTitans().filter(x => !x.offBoard); if (l.length) { const v = this.rng.pick(l); this.say(`유효한 타겟 없음 — 무작위 타이탄 ${v.name} 사망 (Instant Death)`, 'bad'); await this.solo(() => this.kill(v, { instant: true })); } return; } return routine(); }
        this.say(`타겟: ${primary.name}${primary.onVP ? ' (VP 위)' : ''}`);
        await window(primary);
        if (!primary.alive || primary.offBoard) return;
        if (O.mode === 'range' || primary.onVP) att = [primary];
        else {
          if (O.lateral) await this.laserLateral(primary); else this.facePrim(primary.pos);
          const c2 = { ...card, oracle: { laser: O.laser, sideways: !!O.sidewaysAll, sidewaysAll: !!O.sidewaysAll } }; const { hits } = this.laserTargets(c2, primary); att = [...new Set(hits)];
        }
        await this.ohAttackList(card, att, O.judge);
      } else if (O.mode === 'zone') {
        const cells = this.ohZoneCells(O.zone); ctx.zoneCells = cells; this.zoneShow = cells; this.notify(); const set = new Set(cells.map(p => key(p.c, p.r)));
        att = forcedTarget && forcedTarget.alive ? [forcedTarget] : this.liveTitans().filter(t => !t.offBoard && !t.onVP && !t.stair && t.pos && set.has(key(t.pos.c, t.pos.r)));
        this.say(`${O.zone === 'embrace' ? 'Embrace' : 'Denial'} Zone 대상: ${att.map(t => t.name).join(', ') || '(없음)'}`, 'ai');
        if (att.length) { await window(att[0]); await this.ohAttackList(card, att, O.judge); }
      } else if (O.mode === 'sun') {
        if (O.faceMost) { this.faceMost(); this.say(`${this.prim.name}: 가장 많은 타이탄 쪽(${this.prim.facing})으로 회전`, 'ai'); }
        await window(null);
        const live = this.liveTitans().filter(t => !t.offBoard); const sh = live.filter(t => this.ohShaded(t)); att = forcedTarget && forcedTarget.alive ? [forcedTarget] : live.filter(t => !this.ohShaded(t));
        this.zoneShow = this.ohUnshadedCells(); this.notify();
        this.say(`Unshaded Board 대상: ${att.map(t => t.name).join(', ') || '(없음)'}${sh.length ? ` · 그늘: ${sh.map(t => t.name).join(', ')}` : ''}`, 'ai');
        if (this.trait('Glass it All') && sh.length) this.ohGlass(sh);
        await this.ohAttackList(card, att, O.judge);
      } else if (O.mode === 'sunrise' || O.mode === 'sundown') {
        await window(null);
        const hits = []; const lc = { seen: new Set(), destroyed: new Set() }; const c2 = { ...card, oracle: { laser: 'single' } };
        if (O.mode === 'sunrise') { for (let r = 1; r <= this.board.rows; r++) this.laserHandle(this.beam({ c: 1, r }, 'E'), c2, hits, lc); }
        else { const T = [...this.board.terrain.values()].filter(z => z.type === 'Irem Tower').map(z => z.cell); for (const p of T) for (const d of DIR_LIST) { const s = { c: p.c + DIRS[d][0], r: p.r + DIRS[d][1] }; if (!this.board.inBounds(s.c, s.r)) continue; const k = `${s.c},${s.r},${d}`; if (lc.seen.has(k)) continue; lc.seen.add(k); this.laserHandle(this.beam(s, d), c2, hits, lc); } }
        att = [...new Set(hits)].filter(t => t.alive && !t.offBoard);
        this.say(`${O.mode === 'sunrise' ? 'Sunrise' : 'Sundown'} Laser 대상: ${att.map(t => t.name).join(', ') || '(없음)'}`, 'ai');
        await this.ohAttackList(card, att, null);
      }
      // after effects
      const live = att.filter(t => t.alive && !t.offBoard);
      if (O.after && O.after.length && live.length) { if (O.afterWin) await this.reactionWindow(live[0], card, 'After Attack'); await this.ohAfter(O.after, card, live, ctx); }
      if (O.afterFinal && O.afterFinal.length) { if (O.afterFinalWin && this.liveTitans().length) await this.reactionWindow(this.liveTitans()[0], card, 'After Final Attack'); await this.ohAfter(O.afterFinal, card, live, ctx); }
      await this.ohFlushTowers();
    },
    async ohEffect(t, s, hits, card) {
      let m;
      if (/^If you are hit, you are incinerated\.?$/.test(s)) { if (hits > 0) { this.say(`${t.name}: 맞음 — 소각`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); } return true; }
      if (/^If you are hit, draw an Obol\.?$/.test(s)) { if (hits > 0) await this.obolDraw(t, 10); return true; }
      if (/^If you are hit, Knockdown, then draw an Obol\.?$/.test(s)) { if (hits > 0) { await this.knockdown(t); if (t.alive) await this.obolDraw(t, 10); } return true; }
      if (/^If the Laser Attack hits a Terrain tile, it continues sideways\.?$/.test(s)) return true;
      if ((m = /^Each hit deals (\d+) DANGER and (\d+) FATE\.?$/.exec(s))) { await this.dealFD(t, +m[2] * hits, +m[1] * hits, card, hits, null, { sunHit: card.oh && card.oh.mode === 'sun' }); return true; }
      return false;
    },
    // ---------- round / turn hooks ----------
    async ohPitiless(list, when) { const adj = list.filter(t => t.alive && !t.offBoard && !t.onVP && !t.stair && t.pos && this.isAdj(t)); for (const t of adj) await this.solo(async () => { this.say(`Pitiless Sun: ${t.name}이(가) ${when}에 Old Haunt와 인접 — 소각`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); }); },
    async ohPrimRoundStart(add) {
      if (this.trait('Pitiless Sun')) add('Pitiless Sun (트레이트): 인접 타이탄 소각', () => this.ohPitiless(this.liveTitans(), 'Primordial Round 시작'));
      if (this.trait('God Among Men')) add('God Among Men (트레이트): Merciless Sun', async () => { const c = this.prim.def.ai.find(a => a.oh && a.oh.merciless); if (c) { this.say('God Among Men — Merciless Sun!', 'ai'); await this.safe(() => this.resolveAI(c)); } });
    },
    ohTurnTriggers(t, add) { if (this.trait('Pitiless Sun') && t.alive && !t.offBoard && !t.onVP && t.pos && this.isAdj(t)) add(null, 'Pitiless Sun (트레이트): Old Haunt와 인접해 턴 시작 — 소각', () => this.ohPitiless([t], '턴 시작')); },
    async ohPrimRoundEnd(add) {
      if (this.trait('Unworthy Will Die')) add('Unworthy Will Die (트레이트): 가장 가까운 Irem Tower 파괴', async () => { const z = this.ohClosestTower(); if (!z) { this.say('Unworthy Will Die: 남은 Irem Tower 없음'); return; } this.board.removeTerrainId(z.id); this.say(`Unworthy Will Die: ${cellLabel(z.cell)}의 Irem Tower 파괴`, 'ai'); this.notify(); await this.ohFlushTowers(); });
      if (this.trait('Make the Sun Move and the Earth Stand Still')) add('Make the Sun Move… (트레이트): Sun Circle에 등장', () => this.ohAppearAtSunCircle());
    },

    // ---------- BP responses / criticals ----------
    ohVPCreate() { const V = this.prim.vp; if (!V) return; if (V.created) { this.prim.tokens.at = (this.prim.tokens.at || 0) - 1; this.say(`VP가 이미 있음 — ${this.prim.name} −1 AT 토큰 (누적 ${this.prim.tokens.at})`, 'good'); } else { this.createVP(null); if (!V.created) { V.created = true; V.count = Math.max(1, V.count || 0); this.say(`Vantage Point 「${this.prim.def.vp.name}」 생성!`, 'good'); } } },
    async ohAnotherBonus(t) {
      const others = this.liveTitans().filter(x => x !== t && !x.offBoard); if (!others.length) { this.say('(다른 타이탄 없음)'); return; }
      const o = await this.ask({ type: 'choice', titan: t, title: '다른 타이탄 1명: Speed만큼 이동 후 보너스 공격', options: [{ label: '안 함', value: null }, ...others.map(x => ({ label: `${x.name} (Speed ${this.speedOf(x)})`, value: x }))] });
      if (!o) return; if (!o.onVP && !o.knockdown) await this.chooseMove(o, this.speedOf(o), '보너스 이동'); this.pendingFollowUp = o; this.say(`${o.name}: 보너스 공격 예약`, 'good');
    },
    async ohSentence(t, p, ctx = {}) {
      const alive = !!(t && t.alive); let m;
      p = p.replace(/^The Pitiless\b/, 'The Old Haunt');
      if ((m = /^The Old Haunt moves (\d) spaces directly away from the Attacker/.exec(p))) { await this.oracleMoveAway(t && t.pos && !t.onVP ? t.pos : null, +m[1]); return true; }
      if (/^The Old Haunt appears at the closest Sun Circle/.test(p)) { await this.ohAppearAtSunCircle(); return true; }
      if (/^The Old Haunt appears at the center of the Board/.test(p)) { await this.ohPlaceAt(this.prim._ohCenter || this.prim.anchor, false); return true; }
      if (/^Create the Vantage Point/.test(p)) { this.ohVPCreate(); return true; }
      if ((m = /^The Old Haunt gains (\d) negative AT tokens?/.exec(p))) { this.prim.tokens.at = (this.prim.tokens.at || 0) - +m[1]; this.say(`${this.prim.name}: −${m[1]} AT 토큰 (누적 ${this.prim.tokens.at})`, 'good'); return true; }
      if (/^Perform AI against the Attacker/.test(p)) { await this.doSentence(t, 'Draw and perform an AI card against the Attacker', ctx); return true; }
      if ((m = /^Each Titan gains \+(\d) FATE\.?$/.exec(p))) { for (const x of this.liveTitans()) await this.solo(() => this.gainFate(x, +m[1], { nc: true })); this.say(`모든 타이탄 Fate +${m[1]}`, 'bad'); return true; }
      if (/^You are incinerated\.?$/.test(p)) { if (alive) { this.say(`${t.name}: 소각`, 'bad'); await this.kill(t, { instant: true, incinerate: true }); } return true; }
      if (/^Do not escalate/.test(p) || /^You cannot use Hope tokens/.test(p)) return true;
      return false;
    },
    async ohCritical(t, A) {
      const c = A.bp.critical || ''; let m;
      const parts = (c.match(/[^.!]+[.!]?/g) || []).map(x => x.trim()).filter(Boolean);
      // "Create the Vantage Point! If the VP is already created, ..." is one instruction
      for (let i = 0; i < parts.length; i++) { const x = parts[i];
        if (/^Create the Vantage Point/.test(x)) { this.ohVPCreate(); if (/^If the VP is already created/.test(parts[i + 1] || '')) i++; continue; }
        if (/^Permanently gain \+1 Courage and \+1 Will/.test(x)) { const sk = t.argonaut && t.argonaut.skills; if (sk) { sk.Courage = (sk.Courage || 0) + 1; sk.Will = (sk.Will || 0) + 1; } this.say(`${t.name}: Courage +1, Will +1 (영구)`, 'good'); continue; }
        if (/^You may Motivate (\d) each Titan, then Reposition (\d)/.test(x)) { m = /Motivate (\d) each Titan, then Reposition (\d)/.exec(x);
          for (const o of this.liveTitans().filter(o => o !== t && !o.offBoard && !o.onVP && !o.knockdown)) await this.solo(() => this.chooseMove(o, +m[1], `Motivate ${m[1]}`));
          if (t.alive && !t.onVP && !t.knockdown) await this.solo(() => this.chooseMove(t, +m[2], `Reposition ${m[2]}`)); continue; }
        if (/^(?:You may )?perform a Bonus Attack/i.test(x)) { this.pendingFollowUp = t; continue; }
        if (/^Another Titan may immediately move up to their Speed and perform a Bonus Attack/.test(x)) { await this.ohAnotherBonus(t); continue; }
        if ((m = /^Knockback (\d+)/.exec(x))) { if (t.alive && this.isAdj(t)) await this.solo(() => this.knockback(t, +m[1])); continue; }
        if (/^Gain the .+ card \(Secret deck/.test(x)) { this.say(`(${x} — 캠페인 보상, 전투 효과 없음)`, 'sys'); continue; }
        if (/^\d+\), ?\.?$|^card \d+\)/.test(x)) continue;
        if (/^The Old Haunt dies/.test(x)) { this.say(`${A.bp.name} — ${this.prim.name} 즉사!`, 'good'); A.slay = true; continue; }
        if (await this.ohSentence(t, x, {})) continue;
        this.say(`(Critical 효과 수동 적용 필요: ${x})`, 'sys');
      }
      return true;
    },
  });
}
