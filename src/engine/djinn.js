// Cycle IV — Demidjinn (Wish Away, Wish Attacks, Endless Staircase, Global Wish, Sandstorm Spiral)
import { Board, key, cellLabel, DIRS, DIR_LIST, OPP } from './core.js';

export function installDjinn(Game, { TitanDied, BattleOver }) {
  Object.assign(Game.prototype, {
    djinnSetup() {
      const P = this.prim.def; const L = this.prim.level;
      this.prim.stairSegs = [...(P.stairs[String(Math.min(4, L))] || [5])];
      this.prim.wishTokens = 0;
      this.prim.ai4 = P.ai.find(a => a.tier === 4) || null; this.prim.ai0 = P.ai.find(a => a.tier === 0) || null; this.prim.ai4In = false;
      if (this.trait('The Last') && this.prim.ai0) { this.prim.aiBottom = this.prim.ai0; this.say('The Last: AI 0 「The Last Wish」을 AI 덱 맨 아래에 (섞이거나 버려지지 않음)', 'ai'); }
      const gw = (P.globalWish || []).filter(c => c.level <= L);
      this.prim.gw = { stack: this.rng.shuffle(gw.map(c => ({ ...c }))), discard: [], active: null };
      this.say(`Global Wish: ${gw.length}장을 섞어 스택에 (1라운드에는 공개하지 않음)`, 'sys');
    },
    // ---------- helpers ----------
    stairLen() { return (this.prim.stairSegs || []).reduce((a, b) => a + b, 0); },
    gwActive(name) { const A = this.prim.gw && this.prim.gw.active; return !!(A && A.name === name && !this.prim.disabled.globalWish); },
    wishAwayBase() { const W = this.prim.def.wishAway || {}; return W[String(Math.min(4, this.prim.level))] || 9; },
    // ---------- Endless Staircase ----------
    async moveToStair(t, why = '') {
      if (!t || !t.alive || t.offBoard) return; if (t.stair) { this.say(`${t.name}: 이미 Endless Staircase 안 — 무시`); return; }
      if (t.onVP) await this.leaveVP(t); if (t.impaled) t.impaled = false; if (t.float) this.deflate(t, 'Staircase');
      t.stair = 1; t.knockdown = null; t.pos = { ...this.prim.anchor };
      this.say(`${t.name}: Endless Staircase로 이동 (1/${this.stairLen()})${why ? ` — ${why}` : ''}`, 'bad'); this.notify();
    },
    async stairDown(t, x, why) { const n0 = t.stair; t.stair = Math.max(1, t.stair - x); this.say(`${t.name}: ${why} — Staircase ${n0} → ${t.stair}`, 'bad'); this.notify(); },
    async escapeStair(t) { this.say(`${t.name}: Endless Staircase 끝을 넘어섬 — 탈출! 아무 Irem Tower로 Wish Away`, 'good'); t.stair = 0; await this.wishAway(t, 0, { anyTower: true, escape: true }); },
    async stairClimb(t, n) {
      const len = this.stairLen(); const to = t.stair + n;
      if (to > len) return this.escapeStair(t);
      this.say(`${t.name}: Ascent — Staircase ${t.stair} → ${to}/${len}`, 'good'); t.stair = to; this.notify();
    },
    async ascentAction(t) {
      t.turn.attacked = true; const drawn = []; let sum = 0;
      for (;;) { const c = this.trauma.major.draw(); if (!c) { this.trauma.major.shuffleDiscardIn(); continue; } drawn.push(c); sum += c.num || 0; this.say(`${t.name}: Ascent — Major Trauma 「${c.name}」 ${c.num || 0}걸음 (합계 ${sum})`);
        const more = await this.ask({ type: 'yn', titan: t, title: `Ascent: 지금까지 ${sum}걸음. 한 장 더 뽑을까요? (공격 Total Power ≥ 걸음 합이면 올라감)`, options: [{ label: '그만 — 공격', value: false }, { label: '한 장 더', value: true }] }); if (!more) break; if (drawn.length > 8) break; }
      t._lastAtk = null;
      await this.chainSafe(() => this.titanAttack(t));
      const A = t._lastAtk; if (!t.alive) return;
      let total = A ? A.total : 0; let bonus = this.prim.ascentBonus || 0; for (const g of t.gear) { if (g.discarded) continue; const tx = this.gearText(g, t); const m = /(?:^|\. )Ascent Check \+(\d)/.exec(tx); if (m) bonus += +m[1]; { const sk = /You gain \+(\d) bonus to the Ascent Check/.exec(tx); if (sk) bonus += +sk[1]; } { const ax = /(?:^|\. )Ascent Check \+X, where X is the number of Hope tokens in the Kratos Pool when you attacked/.test(tx); if (ax && A && A.g === g) bonus += A.hopeAtStart || 0; } { const cm = /(?:^|\. )((?:Ψ|⟳)+) Ascent Check \+(\d)/.exec(tx); if (cm && this.costOK(t, cm[1], g)) { const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: Ascent Check +${cm[2]}? [${this.costLbl(cm[1])}]`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) { await this.payCost(t, cm[1], g); bonus += +cm[2]; } } } if (A && A.g === g && /Each hit: Ascent Check \+1/.test(tx)) bonus += A.hits || 0; }
      this.say(`Ascent Check: Total Power ${total}${bonus ? ` + Ascent Check ${bonus}` : ''} vs ${sum}걸음`, total + bonus >= sum ? 'good' : 'bad');
      if (total + bonus >= sum && t.stair) {
        for (const c of drawn) this.trauma.major.putBottom(c);
        let n = sum; const hg = t.gear.filter(g => !g.discarded && !g.exhausted && typeof (/(?:^|\. )Hermes Move (\d)/.exec(this.gearText(g, t)) || [])[1] === 'string');
        if (hg.length) { const g = hg.reduce((a, b) => (+/Hermes Move (\d)/.exec(this.gearText(b, t))[1] > +/Hermes Move (\d)/.exec(this.gearText(a, t))[1] ? b : a)); const X = +/Hermes Move (\d)/.exec(this.gearText(g, t))[1]; const ok = await this.ask({ type: 'yn', titan: t, title: `Hermes Move Bonus: ${g.card.name}를 소진하고 +${X}칸?`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) { g.exhausted = true; n += X; } }
        if (this.prim.def.babelD && await this.babelEvac(t)) return;
        await this.stairClimb(t, n);
      } else { for (const c of drawn) this.trauma.major.shuffleIn(c); if (t.stair) this.say(`${t.name}: Ascent 실패 — 제자리`); if (t.stair && this.prim.def.babelD && this.trait('Thread Lightly')) { this.say('Thread Lightly: Ascent 실패 — Obol', 'bad'); await this.obolDraw(t, 10); } }
    },
    async endlessEscalator() {
      if (!this.trait('Endless Escalator') || !this.liveTitans().some(t => t.stair)) return;
      const segs = this.prim.stairSegs; const s0 = segs[0]; this.prim.stairSegs = [...segs.slice(1), s0];
      this.say(`Endless Escalator: Staircase 맨 아래 구간(1-${s0})이 맨 위로`, 'ai');
      for (const t of this.liveTitans().filter(x => x.stair)) { if (t.stair <= s0) { this.say(`${t.name}: 맨 아래 구간 — 사망`, 'bad'); await this.solo(() => this.kill(t)); } else { t.stair -= s0; } }
    },
    // ---------- Wish Away ----------
    async wishAway(t, x = null, opts = {}) {
      if (!t || !t.alive || t.offBoard) return;
      if (!opts.escape && !opts.terrain && this.prim.def.djinnD && this.prim.disabled.wishAway) { this.say('(Wish Away 비활성 — The Lamp)'); return; }
      if (x == null) x = this.wishAwayBase();
      if (this.prim.halfWish && !opts.escape) x = Math.ceil(x / 2);
      if (!opts.escape) { if (t.conditions.includes('Wishkeen')) x += 1; if (t.conditions.includes('Wishagog')) x += 2; x = await this.wishAwayReduce(t, x); }
      if (t.stair && !opts.escape) return this.stairDown(t, x, `Wish Away ${x}`);
      if (this.trait('Djinnian Determination')) { const a = this.primCells(); const dists = { S: Math.min(...a.map(p => p.r - 1)), N: Math.min(...a.map(p => this.board.rows - p.r)), W: Math.min(...a.map(p => p.c - 1)), E: Math.min(...a.map(p => this.board.cols - p.c)) }; const m = Math.min(...Object.values(dists)); this.prim.facing = DIR_LIST.find(d => dists[d] === m); this.say(`Djinnian Determination: 가장 가까운 보드 가장자리(${this.prim.facing})로 회전`, 'ai'); }
      const free = this.iremCellsFree(t).filter(p => !(t.pos && p.c === t.pos.c && p.r === t.pos.r && !t.onVP));
      const dist = p => Board.distToCells(p, this.primCells());
      let cand = opts.anyTower ? free : free.filter(p => this.inFront(p) && (this.trait('Djinnian Precision') ? dist(p) === x : dist(p) >= x));
      this.say(`${t.name}: WISH AWAY ${opts.anyTower ? '(아무 Irem Tower)' : `${x}`}`, 'bad');
      if (!cand.length) { if (opts.escape && !this.iremTowers().length) { t.stair = this.stairLen(); this.say(`${t.name}: 보드에 Irem Tower가 없어 탈출 불가 — Staircase 맨 위(${t.stair})에 머묾`, 'sys'); this.notify(); return; } this.say(`${t.name}: 갈 수 있는 Irem Tower가 없음 — 사망`, 'bad'); return this.kill(t); }
      const p = cand.length === 1 ? cand[0] : (await this.ask({ type: 'move', titan: t, title: `Wish Away${opts.anyTower ? '' : ` ${x}`}: 놓일 Irem Tower`, cells: cand, options: cand.map(q => ({ label: `${cellLabel(q)} (거리 ${dist(q)})`, value: q })) })) || cand[0];
      if (t.onVP) { const V = this.prim.vp; t.onVP = false; t.vpLevel = 0; if (V) { V.occupants = (V.occupants || []).filter(x => x !== t); V.occupant = V.slots > 1 ? (V.occupants[0] || null) : null; } } if (t.impaled) t.impaled = false;
      const waFrom = t.pos && !t.stair ? { ...t.pos } : null; t.pos = { ...p }; t.stair = 0; this.notify(); this.say(`${t.name}: ${cellLabel(p)}의 Irem Tower로 Wish Away`); if (waFrom) await this.djinnAfterMove(t, waFrom);
      await this.landOn(t, true);
    },
    async wishAwayReduce(t, x) {
      let red = 0; for (const g of t.gear) { if (g.discarded) continue; const tx = this.gearText(g, t); for (const m of tx.matchAll(/(?:^|\. )((?:[A-Z][a-z]+(?: [A-Z][a-z]+)?(?:, | and |, and ))*(?:[A-Z][a-z]+(?: [A-Z][a-z]+)?)) Reduction (\d)/g)) if (/Wish Away/.test(m[1])) red += +m[2]; }
      if (red && x > 0) { const v = await this.ask({ type: 'choice', titan: t, title: `Wish Away ${x}: 감소 (최대 ${red})`, options: Array.from({ length: Math.min(red, x) + 1 }, (_, i) => ({ label: i ? `−${i} → ${x - i}` : '감소 안 함', value: i })) }); x -= v || 0; }
      for (const g of t.gear) { if (g.discarded || g.exhausted) continue; if (/⟳ Gain \+XΨ when you suffer Wish Away to reduce it by X/.test(this.gearText(g, t)) && this.fr(t) > 0 && x > 0) { const mx = Math.min(x, this.fr(t)); const v = await this.ask({ type: 'choice', titan: t, title: `${g.card.name}: Fate +X로 Wish Away X 감소 (소진)`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: i ? `Fate +${i} → ${x - i}` : '안 함', value: i })) }); if (v) { g.exhausted = true; await this.gainFate(t, v); x -= v; } } }
      return Math.max(0, x);
    },
    // ---------- Sandstorm Spiral ----------
    async sandstormSpiral(t) {
      if (!t || !t.alive || t.offBoard || t.stair || t.onVP || t.impaled || !this.isAdj(t)) { this.say('Sandstorm Spiral: 타겟과 인접하지 않음 — 이동 없음'); return; }
      const a = this.prim.anchor; const n = this.prim.size || 2; const T = t.pos;
      const na = { c: 2 * T.c - a.c - (n - 1), r: 2 * T.r - a.r - (n - 1) };
      const inb = an => this.primCells(an).every(p => this.board.inBounds(p.c, p.r));
      const ring = []; for (let dc = -n; dc <= 1; dc++) for (let dr = -n; dr <= 1; dr++) { const an = { c: T.c + dc, r: T.r + dr }; const cs = this.primCells(an); if (cs.some(p => p.c === T.c && p.r === T.r)) continue; if (Board.isAdjacent(T, cs)) ring.push(an); }
      // board rows grow northward (up), so the true clockwise order is decreasing atan2(dy, dx)
      const ctr = an => ({ x: an.c + (n - 1) / 2 - T.c, y: an.r + (n - 1) / 2 - T.r }); const ang = an => { const { x, y } = ctr(an); return Math.atan2(y, x); };
      ring.sort((p, q) => ang(q) - ang(p));
      let i = ring.findIndex(p => p.c === a.c && p.r === a.r); const j = ring.findIndex(p => p.c === na.c && p.r === na.r);
      const path = []; if (i >= 0 && j >= 0) { let g = 0; while (i !== j && g++ < 20) { i = (i + 1) % ring.length; path.push(ring[i]); } } else path.push(na);
      if (!inb(na) || path.some(q => !inb(q))) { const cells = this.primCells(); const near = cells.reduce((p, q) => Board.dist(T, q) < Board.dist(T, p) ? q : p); const dx = Math.sign(near.c - T.c), dy = Math.sign(near.r - T.r); const dir = Math.abs(near.c - T.c) >= Math.abs(near.r - T.r) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'N' : 'S'); this.say(`Sandstorm Spiral: 보드 가장자리에 막힘 — ${t.name}에게서 ${dir}로 6칸 직진 (회전 없음)`, 'ai'); for (let i = 0; i < 6; i++) { const cur = this.prim.anchor; const nx = { c: cur.c + DIRS[dir][0], r: cur.r + DIRS[dir][1] }; if (!inb(nx)) break; await this.primStep(nx, []); } await this.primEndMove([]); this.notify(); return; }
      this.say(`Sandstorm Spiral: ${t.name} 주위를 시계방향으로 돌아 반대편으로`, 'ai');
      for (const q of path) await this.primStep(q, [t]);
      await this.primEndMove([t]); if (t.alive) this.facePrim(t.pos); this.notify();
    },
    async moveDemidjinn(n, title) {
      const opts = [{ c: 0, r: 0, path: [] }]; const seen = new Set([key(this.prim.anchor.c, this.prim.anchor.r)]); let frontier = [{ a: this.prim.anchor, path: [] }];
      for (let d = 0; d < n; d++) { const nxt = []; for (const f of frontier) for (const dd of DIR_LIST) { const na = { c: f.a.c + DIRS[dd][0], r: f.a.r + DIRS[dd][1] }; const k = key(na.c, na.r); if (seen.has(k) || !this.primCells(na).every(p => this.board.inBounds(p.c, p.r))) continue; seen.add(k); const e = { a: na, path: [...f.path, na] }; nxt.push(e); opts.push(e); } frontier = nxt; }
      const pick = await this.ask({ type: 'placement', title: `${title}: ${this.prim.name}을(를) 최대 ${n}칸 이동 (기준 칸 선택)`, options: opts.map(o => ({ label: o.path.length ? `→ ${cellLabel(o.a)} 기준 (${o.path.length}칸)` : '이동 안 함', value: o, preview: o.path.length ? { cells: this.primCells(o.a), edges: [] } : undefined })) });
      if (!pick || !pick.path.length) return; for (const st of pick.path) await this.primStep(st, []); await this.primEndMove([]); this.notify(); this.say(`${this.prim.name}: ${cellLabel(this.prim.anchor)} 기준으로 이동`);
    },
    async placeWishstorm() {
      const [dx, dy] = DIRS[this.prim.facing]; const n = this.prim.size || 2; const cells = this.primCells().map(p => ({ c: p.c + dx * n, r: p.r + dy * n }));
      if (cells.some(p => !this.board.inBounds(p.c, p.r))) { this.say('Wishstorm: 앞쪽 공간이 보드 밖 — 배치 생략'); return; }
      this._wsN = (this._wsN || 0) + 1; for (const p of cells) { const o = this.titanAt(p.c, p.r); if (o) await this.solo(() => this.displace(o)); }
      this.board.addTerrain(cells.map(cellLabel), { id: 'wstorm' + this._wsN, type: 'Wishstorm', obstacle: false, obscuring: true, cloud: true, trap: true, treasure: true, elevated: true, climb: 7, destructible: false });
      this.say(`Wishstorm 타일 (${cells.map(cellLabel).join(', ')})`, 'ai'); this.notify();
    },
    async wishstormTreasure(t, ter) {
      this.board.setTerrainProps(ter.id, { searched: true }); ter.searched = true; const r = this.rng.d10(); this.say(`${t.name}: Wishstorm Treasure d10=${r}`, r >= 6 ? 'good' : 'bad');
      if (r === 1) await this.midasCondition(t, 'Wishagog'); else if (r <= 5) { await this.gainFate(t, 1, { nc: true }); await this.wishAway(t, 12, { terrain: true }); } else if (r <= 9) this.say('(Echo of Recollection / Golden Bough — 캠페인 자원)', 'sys'); else { const cs = this.curses(t); if (cs.length) { const c = cs.length === 1 ? cs[0] : await this.ask({ type: 'choice', titan: t, title: '잃을 Curse', options: cs.map(x => ({ label: x, value: x })) }); t.conditions = t.conditions.filter(x => x !== c); this.say(`${t.name}: ${c} Curse 잃음`, 'good'); } else this.say('(Sisyphus Tear / Titan / Debtguard — 캠페인 보상)', 'sys'); }
    },
    // ---------- Wish Attack ----------
    isWishAttack(t, card) {
      if (this.prim.disabled.wishAtk) return false;
      if (card.djinn && card.djinn.wish) return true;
      if (/FATE (\d)\+: Wish Attack instead/.test(card.steps[0] || '') && this.effFate(t) >= +/FATE (\d)\+: Wish Attack instead/.exec(card.steps[0])[1]) { this.say(`Fate ${/FATE (\d)\+/.exec(card.steps[0])[1]}+ — Wish Attack으로 변경`, 'bad'); return true; }
      return this.trait('Endless Wish') && !!this.currentAI;
    },
    async wishArmor(t, card) { // returns true if the titan used Wish Armor (normal Evasion/Armor Rolls)
      if (t.conditions.includes('Wishkeen') || t.conditions.includes('Wishagog')) { this.say(`${t.name}: ${t.conditions.includes('Wishagog') ? 'Wishagog' : 'Wishkeen'} — Wish Armor 사용 불가`, 'bad'); return false; }
      const opts = [];
      for (const g of t.gear) { if (g.discarded) continue; const tx = this.gearText(g, t); for (const m of tx.matchAll(/(?<=^|\.\s)((?:Ψ|⟳|X|\[Amb\]|\[Midas\]|\[Fire\]|\[charge\])*) ?Wish Armor( and Wish Dodge)?(?: \((\d+)\+\))?\./g)) { const cost = m[1] || ''; if (!this.costOK(t, cost, g)) continue; opts.push({ g, cost, dodge: m[2] ? 1 : 0, label: `${g.card.name}: Wish Armor${m[2] ? ' + Wish Dodge' : ''} [${this.costLbl(cost)}]` }); } if (/(?:^|\.\s)Ψ Wishrod, Wish Armor, and Advanced Wish Dodge\./.test(tx) && this.costOK(t, 'Ψ', g)) opts.push({ g, cost: 'Ψ', dodge: 2, label: `${g.card.name}: Wish Armor + Advanced Wish Dodge [Fate+1]` }); if (/Armor gains ΨΨΨX Wish Armor/.test(tx) && g.card.slot === 'attachment' && this.fr(t) >= 3) opts.push({ g, cost: 'ΨΨΨX', dodge: 0, label: `${g.card.name}: Wish Armor [Fate+3, 버림]` }); }
      if (!opts.length) return false;
      const pick = await this.ask({ type: 'choice', titan: t, title: `WISH ATTACK 「${card.name}」 — Wish Armor를 쓰지 않으면 회피/방어 굴림 없이 모든 주사위가 hit`, options: [{ label: '사용 안 함', value: null }, ...opts.map(o => ({ label: o.label, value: o }))] });
      if (!pick) return false;
      await this.payCost(t, pick.cost, pick.g); this.say(`${t.name}: Wish Armor (${pick.g.card.name})`, 'good');
      for (const g of t.gear) if (!g.discarded && /(?:^|\. )Wishcursed\./.test(this.gearText(g, t))) { await this.gainFate(t, 1, { nc: true }); this.say(`${g.card.name}: Wishcursed — Fate +1`, 'bad'); }
      if (this.trait('Feedback Loop')) this.wishAdd(1, 'Feedback Loop');
      let dodge = pick.dodge;
      for (const g of t.gear) { if (g.discarded) continue; const tx = this.gearText(g, t); const m = /(?<=^|\.\s)((?:Ψ|⟳|X|\[Amb\]|\[Midas\]|\[Fire\]|\[charge\])*) ?(Advanced )?Wish Dodge\./.exec(tx); if (!m || /Wish Armor and Wish Dodge/.test(m[0])) continue; if (!this.costOK(t, m[1] || '', g)) continue; const ok = await this.ask({ type: 'yn', titan: t, title: `${g.card.name}: ${m[2] ? 'Advanced ' : ''}Wish Dodge (+${m[2] ? 2 : 1} Evasion) [${this.costLbl(m[1] || '')}]`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) { await this.payCost(t, m[1] || '', g); dodge += m[2] ? 2 : 1; } }
      { const lw = t.gear.find(g => !g.discarded && /If you exhausted this card to gain Wish Armor, XΨ to gain Advanced Wish Dodge/.test(this.gearText(g, t))); if (lw && lw === pick.g && this.fr(t) > 0) { const ok = await this.ask({ type: 'yn', titan: t, title: `${lw.card.name}: 버리고 Fate+1로 Advanced Wish Dodge?`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) { this.discardGear(t, lw); await this.gainFate(t, 1); dodge += 2; } } }
      if (dodge) { t._wishDodge = dodge; this.say(`${t.name}: Wish Dodge +${dodge} Evasion`, 'good'); }
      return true;
    },
    // header effects (FATE N+: Gain ..., OTHER N+: ...)
    async djinnHeader(t, card) {
      const s0 = card.steps[0] || ''; let m;
      for (const seg of s0.split(' | ').slice(1)) {
        if ((m = /^FATE (\d)\+: (Gain the (?:Wishkeen|Wishagog) Condition card)$/.exec(seg)) && this.effFate(t) >= +m[1]) { this.say(`Fate ${m[1]}+ : ${m[2]}`); await this.doSentence(t, m[2], { card }); }
        if ((m = /^OTHER (\d)\+: (.*)$/.exec(seg))) { const c = this.liveTitans().filter(x => !x.offBoard && this.primLos(x) && this.effFate(x) >= +m[1]); if (c.length) { const mx = Math.max(...c.map(x => this.distTo(x))); const o = c.find(x => this.distTo(x) === mx); this.say(`가장 먼 시야 내 Fate ${m[1]}+ 타이탄 ${o.name}: ${m[2]}`, 'bad'); await this.solo(() => this.doSentence(o, m[2], { card })); } }
      }
    },
    async djinnEffect(t, s, hits, card) {
      const parts = s.split(/(?<=\.)\s+(?=[A-Z⚡])/).map(x => x.trim()).filter(Boolean); let m;
      const deal = (d, h = hits) => this.dealFD(t, 0, d, card, h);
      for (let i = 0; i < parts.length; i++) {
        if (!t.alive || t.offBoard) return true; const p = parts[i];
        if ((m = /^If the Attack hits, it deals (\d+) DANGER\.$/.exec(p))) { await deal(+m[1], 1); continue; }
        if ((m = /^Each hit deals (\d) DANGER and Midas (\d)\.$/.exec(p))) { await deal(+m[1] * hits); if (t.alive) await this.midasX(t, +m[2] * hits); continue; }
        if ((m = /^Midas (\d)(?: \| FATE (\d)\+: Midas (\d) instead)?\.$/.exec(p))) { const n = m[2] && this.effFate(t) >= +m[2] ? +m[3] : +m[1]; await this.midasX(t, n); continue; }
        if ((m = /^Two hits, gain the Wishkeen Condition card; three hits, gain the Wishagog Condition card(; four or more hits, you die)?\.$/.exec(p))) { if (m[1] && hits >= 4) { this.say(`${t.name}: ${hits} hit — 사망`, 'bad'); await this.kill(t); return true; } if (hits >= 3) await this.midasCondition(t, 'Wishagog'); else if (hits === 2) await this.midasCondition(t, 'Wishkeen'); continue; }
        if (/^Two or more hits, Airburst 1\.$/.test(p)) { if (hits >= 2) await this.airburst(1); continue; }
        if (/^One hit deals 4 DANGER and moves you to the Endless Staircase; two hits deal 9 DANGER and make you disappear \(you die\)\.$/.test(p)) { if (hits >= 2) { await deal(9, hits); if (t.alive) { this.say(`${t.name}: 사라짐 — 사망`, 'bad'); await this.kill(t); } return true; } await deal(4, 1); if (t.alive) await this.moveToStair(t, 'Disappear!'); continue; }
        if (/^One hit deals 5 DANGER; two hits deal 10 DANGER; three or more hits, you die\.$/.test(p)) { if (hits >= 3) { this.say(`${t.name}: ${hits} hit — 사망`, 'bad'); await this.kill(t); return true; } await deal(hits >= 2 ? 10 : 5, hits); continue; }
        if (/^If you survive, gain a random Curse Affliction\.$/.test(p)) { if (t.alive) await this.randomCurse(t); continue; }
        await this.applyAttackEffect(t, p, hits, { ...card, djinn: null, _d: card.djinn });
      }
      return true;
    },
    async djinnSentence(t, p, ctx = {}) {
      const alive = !!(t && t.alive); let m; const lh = (this.currentAI && this.currentAI.lastHits) || 0;
      if (/^Wish Away$/.test(p)) { if (alive) await this.wishAway(t); return true; }
      if (/^Reverse Unholy Alchemy$/.test(p)) { if (alive) { const n = t.ambrosia || 0; t.ambrosia = 0; this.say(`${t.name}: Reverse Unholy Alchemy — Ambrosia ${n} → Midas`, 'bad'); if (n) await this.gainMidas(t, n, true, true, 'convert'); } return true; }
      if (/^Sandstorm Spiral$/.test(p)) { if (alive) await this.sandstormSpiral(t); return true; }
      if (/^(Move Target|Move) to the Endless Staircase$/.test(p)) { if (alive) await this.moveToStair(t); return true; }
      if ((m = /^(Two|Three) or more hits, move Target to the Endless Staircase$/.exec(p))) { if (alive && lh >= (m[1] === 'Two' ? 2 : 3)) await this.moveToStair(t); return true; }
      if (/^If you survived, move Target to the Endless Staircase$/.test(p)) { if (alive) await this.moveToStair(t); return true; }
      if (/^Remove every Irem Tower Terrain tile from the two outermost rings of the Battle Board \(even if occupied\)$/.test(p)) { const B = this.board; let n = 0; for (const ter of this.iremTowers()) { const c = ter.cell; if (c.c <= 2 || c.r <= 2 || c.c >= B.cols - 1 || c.r >= B.rows - 1) { B.removeTerrainId(ter.id); n++; await this.afterTileRemoved(c); } } this.say(`바깥 두 줄의 Irem Tower ${n}개 제거`, 'ai'); this.notify(); return true; }
      if (/^Remove the closest Irem Tower Terrain tile from the Battle Board$/.test(p)) { const from = alive && !t.stair && !t.onVP ? t.pos : this.prim.anchor; const tw = this.iremTowers(); if (!tw.length) { this.say('(Irem Tower 없음)'); return true; } const m0 = Math.min(...tw.map(x => Board.dist(x.cell, from))); const c = tw.filter(x => Board.dist(x.cell, from) === m0); const pick = c.length === 1 ? c[0] : (await this.ask({ type: 'choice', title: '제거할 가장 가까운 Irem Tower', options: c.map(x => ({ label: cellLabel(x.cell), value: x })) })) || c[0]; this.board.removeTerrainId(pick.id); this.say(`가장 가까운 Irem Tower ${cellLabel(pick.cell)} 제거`, 'ai'); this.notify(); await this.afterTileRemoved(pick.cell); return true; }
      if (/^Gain X Ambrosia tokens where X is the Primordial level$/.test(p)) { if (alive) await this.gainAmbrosia(t, this.prim.level); return true; }
      if (/^Midas X, where X is the Primordial level$/.test(p)) { if (alive) await this.midasX(t, this.prim.level); return true; }
      if (/^Discard a Condition card$/.test(p)) { if (alive && t.conditions.length) { const c = t.conditions.length === 1 ? t.conditions[0] : await this.ask({ type: 'choice', titan: t, title: '버릴 Condition', options: t.conditions.map(x => ({ label: x, value: x })) }); if (c === 'Float') this.deflate(t, 'Response'); else { t.conditions = t.conditions.filter(x => x !== c); if (c === 'Bleeding') t.bleeding = 0; this.say(`${t.name}: ${c} 버림`); } } return true; }
      if ((m = /^Move the Demidjinn up to (\d) spaces$/.exec(p))) { await this.moveDemidjinn(+m[1], 'Response'); return true; }
      if (/^The Demidjinn moves to the Attacker and performs Sandstorm Spiral against them$/.test(p)) { if (alive && !t.stair) { if (!this.isAdj(t)) { const path = this.primPathToward(t.pos, 99); for (const st of path) await this.primStep(st, [t]); await this.primEndMove([t]); } await this.sandstormSpiral(t); } return true; }
      if (/^The Demidjinn moves 4 spaces directly forward$/.test(p)) { const [dx, dy] = DIRS[this.prim.facing]; for (let i = 0; i < 4; i++) { const a = this.prim.anchor; const na = { c: a.c + dx, r: a.r + dy }; if (!this.primCells(na).every(q => this.board.inBounds(q.c, q.r))) break; await this.primStep(na, []); } await this.primEndMove([]); this.notify(); return true; }
      if (/^Place a Wishstorm Terrain tile directly in front of the Demidjinn$/.test(p)) { await this.placeWishstorm(); return true; }
      if (/^Discard the lowest level AI card, then shuffle the AI IV card into the AI deck/.test(p)) { await this.hiddenEyeAI(); return true; }
      if (/^If it's already in the deck, do not discard the AI card/.test(p)) return true;
      if (/^All Titans die$/.test(p)) { this.say('THE LAST WISH — 모든 타이탄 사망', 'bad'); for (const x of this.liveTitans()) { x.alive = false; } throw new BattleOver('defeat'); }
      if (/^Random Titan dies$/.test(p)) { const v = this.rng.pick(this.liveTitans()); if (v) { this.say(`무작위 타이탄 ${v.name} 사망`, 'bad'); await this.solo(() => this.kill(v)); } return true; }
      if (/^Discard 1 random Gear card$/.test(p)) { if (alive) { const list = t.gear.filter(g => !g.discarded && g.card.name !== 'Fists' && !g.card.isTech); if (list.length) { const g = this.rng.pick(list); this.say(`${t.name}: 무작위 장비 「${g.card.name}」 버림`, 'bad'); this.discardGear(t, g); } } return true; }
      return false;
    },
    async afterTileRemoved(c) { const o = this.titanAt(c.c, c.r); if (o && this.board.isChasm(c.c, c.r)) await this.solo(async () => { if (this.useLifeline(o) || await this.skyLifeline(o, 'Chasm에 떨어짐')) { o._lifeline = true; await this.displace(o); return; } this.say(`${o.name}: 발밑 타워가 사라져 Chasm으로 추락 — 사망`, 'bad'); await this.kill(o); }); },
    // ---------- AI deck specials ----------
    djinnDrawFallback() { if (this.prim.aiBottom) { this.say('AI 덱이 바닥남 — 맨 아래의 AI 0 「The Last Wish」!', 'bad'); return this.prim.aiBottom; } return null; },
    async djinnEscalateAI(tier) {
      if (tier !== 3 || this.prim.ai4In || !this.prim.ai4) return false;
      const rem = this.ai.removeFirst(a => a.tier === 3) || (() => { const i = this.ai.discard.findIndex(a => a.tier === 3); return i >= 0 ? { card: this.ai.discard.splice(i, 1)[0], from: 'discard' } : null; })();
      if (rem) this.say(`첫 BP III Wound: AI ${this.remLbl(rem)} 제거`, 'ai');
      this.ai.shuffleIn(this.prim.ai4); this.prim.ai4In = true; this.say('AI IV 「The Last Wish」를 AI 덱에 섞음!', 'bad'); return true;
    },
    async djinnAfterEscalation() {
      if (!this.trait('The Last')) return; const top = this.ai.cards[0];
      if (top && top.tier !== 4 && top.tier !== 0) { this.ai.cards.shift(); this.ai.discard.push(top); this.say(`The Last: AI 덱 맨 위 「${top.name}」 버림`, 'ai'); }
    },
    async hiddenEyeAI() {
      const A4 = this.prim.ai4; if (!A4) return;
      if (this.ai.cards.includes(A4)) { this.ai.cards = [A4, ...this.ai.cards.filter(c => c !== A4)]; this.say('Hidden Eye: AI IV를 덱 맨 위로!', 'bad'); return; }
      const low = this.lowest(this.ai, 'tier'); if (low) { this.ai.discard.push(low.card); this.say(`Hidden Eye: 가장 낮은 AI 「${low.card.name}」 버림`); }
      this.ai.discard = this.ai.discard.filter(c => c !== A4); this.ai.shuffleIn(A4); this.prim.ai4In = true; this.say('Hidden Eye: AI IV 「The Last Wish」를 덱에 섞음', 'bad');
    },
    // ---------- Wish for a Wish ----------
    wishAdd(n, why) { if (!this.trait('Wish for a Wish') || n <= 0) return; this.prim.wishTokens = (this.prim.wishTokens || 0) + n; this.say(`Wish for a Wish +${n} (${why}) → ${this.prim.wishTokens}/3`, 'ai'); if (this.prim.wishTokens >= 3) { this.prim.wishTokens = 0; this.say('Wish for a Wish 3 — 현재 액션 후 Signature!', 'bad'); this.pendingSignature = true; } },
    djinnAT(t) { if (!this.prim.def.djinnD) return 0; let b = 0; if (this.trait('Curse Carapace')) b += this.liveTitans().reduce((a, x) => a + (x.conditions.includes('Wishkeen') ? 1 : 0) + (x.conditions.includes('Wishagog') ? 1 : 0), 0); if (t.stair) b -= this.prim.stairATMalus || 0; return b; },
    // ---------- Global Wish ----------
    async gwRotate() {
      const G = this.prim.gw; if (!G || this.prim.disabled.globalWish) return;
      if (G.active) { await this.gwLeave(G.active); G.discard.push(G.active); G.active = null; }
      const c = G.stack.shift(); if (!c) return;
      if (!G.stack.length) { G.stack = this.rng.shuffle(G.discard); G.discard = []; }
      G.active = c; this.say(`🌀 Global Wish 「${c.name}」: ${c.text}`, 'ai'); await this.gwEnter(c); this.notify();
    },
    async gwEnter(c) {
      if (c.name === 'Sand to Sea') { this._prevChasm = this.board.allChasm; this.board.allChasm = 'empty'; for (const x of this.liveTitans()) if (!x.offBoard && !x.onVP && !x.stair && !x.impaled && this.board.isChasm(x.pos.c, x.pos.r)) await this.solo(async () => { if (this.useLifeline(x) || await this.skyLifeline(x, 'Chasm에 떨어짐')) { x._lifeline = true; await this.displace(x); return; } this.say(`${x.name}: Sand to Sea — Chasm 위 — 사망`, 'bad'); await this.kill(x); }); }
      if (c.name === 'Pillars to Pyres') { const on = this.liveTitans().filter(x => !x.offBoard && !x.onVP && !x.stair && !x.impaled && this.board.terrainAt(x.pos.c, x.pos.r)?.irem === 'tower'); if (on.length) { await this.reactionWindow(on[0], { name: 'Pillars to Pyres' }, 'All Titans on pyres die'); for (const x of on.filter(y => y.alive && this.board.terrainAt(y.pos.c, y.pos.r)?.irem === 'tower')) { this.say(`${x.name}: Pyre 위 — 사망`, 'bad'); await this.solo(() => this.kill(x)); } } }
    },
    async gwLeave(c) { if (c.name === 'Sand to Sea') { this.board.allChasm = this._prevChasm || false; } },
    async pyreCheck(t, why, win = false) { if (!this.gwActive('Pillars to Pyres') || !t || !t.alive || t.offBoard || t.onVP || t.stair || t.impaled) return; if (this.board.terrainAt(t.pos.c, t.pos.r)?.irem !== 'tower') return; if (win) { await this.reactionWindow(t, { name: 'Pillars to Pyres' }, 'you die'); if (!t.alive || t.offBoard || t.onVP || t.stair || this.board.terrainAt(t.pos.c, t.pos.r)?.irem !== 'tower') return; } this.say(`${t.name}: Pyre 위에서 ${why} — 사망 (Pillars to Pyres)`, 'bad'); await this.kill(t); },
    // ---------- round / turn hooks ----------
    async djinnPrimRoundStart() { await this.endlessEscalator(); if (this.round > 1 && !this.trait('Flickering Wishes')) await this.gwRotate(); },
    async djinnTurnStart(t) { t._turnTower = !t.offBoard && !t.stair && this.board.terrainAt(t.pos.c, t.pos.r)?.irem === 'tower' ? this.board.terrainAt(t.pos.c, t.pos.r) : null; if (t.stair) { this.say(`${t.name}: Endless Staircase에서 턴 시작 — Wishkeen`, 'bad'); await this.midasCondition(t, 'Wishkeen'); } },
    async djinnTurnEnd(t) {
      if (!t.alive) return;
      if (this.gwActive('Stones to Sticks') && !t.stair && !t.onVP) { const ter = this.board.terrainAt(t.pos.c, t.pos.r); if (ter && ter.irem === 'tower') { this.board.removeTerrainId(ter.id); this.say(`Stones to Sticks: ${t.name} 아래 Irem Tower 파괴 → Crash`, 'bad'); await this.crash(t); if (!t.alive) return; } }
      await this.pyreCheck(t, '턴 종료'); if (!t.alive) return;
      if (this.trait('Imminent Destruction') && !t._atkTurn && !(t._attackedWith || []).length) { this.say(`Imminent Destruction: ${t.name}이(가) 이번 턴 공격하지 않음 — AI 맨 위 카드 수행`, 'ai'); const c = this.drawAI(); if (c) { await this.safe(() => this.resolveAI(c)); if (c.tier !== 0) this.ai.discard.push(c); } }
    },
    async djinnAfterMove(t, from) { // voluntary move finished
      if (this.gwActive('Stones to Sticks') && from && (from.c !== t.pos.c || from.r !== t.pos.r)) { const ter = this.board.terrainAt(from.c, from.r); if (ter && ter.irem === 'tower') { this.board.removeTerrainId(ter.id); this.say(`Stones to Sticks: ${cellLabel(from)} Irem Tower 파괴`, 'ai'); } }
    },
    async djinnAfterAttack() { if (this.trait('Flickering Wishes')) { this.say('Flickering Wishes: 공격 후 Global Wish 교체', 'ai'); await this.gwRotate(); } },
    djinnActions(t) { const out = []; if (t.offBoard || t.stair) return out; const seen = new Set(); for (const p of [t.pos, ...DIR_LIST.map(d => ({ c: t.pos.c + DIRS[d][0], r: t.pos.r + DIRS[d][1] }))]) { const ter = this.board.inBounds(p.c, p.r) && this.board.terrainAt(p.c, p.r); if (ter && ter.treasure && !ter.searched && !seen.has(ter.id)) { seen.add(ter.id); out.push({ label: 'Wishstorm Treasure 찾기 (전투당 1회, d10)', noFate: true, value: async () => this.wishstormTreasure(t, ter) }); } } return out; },
    // ---------- critical ----------
    async djinnCritical(t, A) {
      const c = A.bp.critical || '';
      if (/^Gain the Priority Target token\. You may perform a Bonus Attack/.test(c)) { if (!this.ptHolder()?.ptLocked) { for (const x of this.titans) x.pt = false; t.pt = true; } this.pendingFollowUp = t; this.say(`${t.name}: PT + 보너스 공격`, 'good'); return true; }
      if (/^Deal an additional Single Wound/.test(c)) { A.extraWound = 1; return true; }
      if (/^You may get rid of a Curse Affliction/.test(c)) { const cs = this.curses(t); if (cs.length) { const v = await this.ask({ type: 'choice', titan: t, title: '없앨 Curse Affliction', options: [{ label: '안 함', value: null }, ...cs.map(x => ({ label: x, value: x }))] }); if (v) { t.conditions = t.conditions.filter(x => x !== v); this.say(`${t.name}: ${v} Curse 제거`, 'good'); } } else { this.pendingFollowUp = t; this.say(`${t.name}: Curse 없음 — 보너스 공격`, 'good'); } return true; }
      if ((/^Disable the (Wishkeen|Wishagog) Condition/.exec(c))) { const nm = /^Disable the (Wishkeen|Wishagog)/.exec(c)[1]; this.prim.disabled[nm] = true; for (const x of this.titans) x.conditions = x.conditions.filter(k => k !== nm); this.say(`${nm} 비활성화, 모든 타이탄에서 제거`, 'good'); return true; }
      if (/^Move the Demidjinn up to (\d) spaces\. (?:You may perform|Perform) a Bonus Attack/.test(c)) { const n = +/up to (\d)/.exec(c)[1]; await this.moveDemidjinn(n, 'Critical'); this.pendingFollowUp = t; if (/\+1 Power/.test(c)) t.bonusRaw = 1; this.say(`${t.name}: 보너스 공격${/\+1 Power/.test(c) ? ' (+1 Power)' : ''}`, 'good'); return true; }
      if (/^Until the end of Battle, Wish Away distance is halved/.test(c)) { this.prim.halfWish = true; this.say('Wish Away 거리 절반 (올림)', 'good'); return true; }
      if (/^Until the end of Battle, the Demidjinn gains -1 AT during Attacks performed from the Blindspot or Endless Staircase/.test(c)) { this.prim.blindATMalus = (this.prim.blindATMalus || 0) + 1; this.prim.stairATMalus = (this.prim.stairATMalus || 0) + 1; this.say('Blindspot/Staircase에서 공격 시 AT −1', 'good'); return true; }
      if (/^Disable the Global Wish Trait/.test(c)) { const G = this.prim.gw; if (G && G.active) await this.gwLeave(G.active); if (G) G.active = null; this.prim.disabled.globalWish = true; this.say('Global Wish 비활성화', 'good'); return true; }
      if (/^Wish Attacks become normal Attacks/.test(c)) { this.prim.disabled.wishAtk = true; this.say('Wish Attack이 일반 공격이 됨', 'good'); return true; }
      if (/^The Demidjinn dies/.test(c)) { this.say(`🏆 ${this.prim.name}이(가) 죽었습니다! (Wish Granted — 캠페인 이벤트)`, 'good'); throw new BattleOver('victory'); }
      if (/^Disable the Wish Away keyword/.test(c)) { this.prim.disabled.wishAway = true; this.say('Demidjinn 공격·BP의 Wish Away 비활성화', 'good'); return true; }
      if (/\(campaign\)/.test(c)) { this.say(`(${c} — 캠페인 보상)`, 'sys'); return true; }
      return false;
    },
  });
}
