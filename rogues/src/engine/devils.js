// Devil Clashes. Shared: Stains of Profanity (Heat Limit 9, Peril by Heat), the Fool's deck, "You may Bargain before the Power Roll".
// Devil of the Ancient Dusk: Primordial Soup (5 pairs of Swamp tiles + Swamp spaces beyond them), Rising Tide (Deluge), Devil's Bargain,
// Devil of the Crossroads (Swampwalk), Ancestral Recollection.
import { DIRS, inFront } from './board.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const TIER = ['Uninjured', 'Minor', 'Major', 'Grave', 'Judicium'];
const SWAMP = { id: 'swamp', obstacle: false, obscuring: false, destructible: false, chasm: false, difficult: true, noFlip: true };
const COLUMN = { id: 'column', obstacle: true, obscuring: true, destructible: true, chasm: false, difficult: false };

export const DevilMixin = {
  // ---------- shared ----------
  dvSetup() {
    const C = this; this.isDevil = true; this.dv = { free: false, reveal: false, lastStains: null };
    const FD = this.data.decks && this.data.decks.fools; this.dvFools = FD ? this.rng.shuffle([...FD.cards]) : []; this.dvFoolsDiscard = [];
    for (const k of this.knights) k.heatLimitBonus = 9; this.say('Stains of Profanity: 모든 기사의 Heat Limit → 9', 'ai');
    const pc = this.perilCheck.bind(this); this.perilCheck = async k => { if (!k.alive || !C.monster.hasTrait('Stains of Profanity')) return pc(k); const arc = k.peril.call(k); const st = k.heat >= 9 ? 'Judicium' : k.heat >= 6 ? 'Grave' : k.heat >= 3 ? 'Major' : 'Minor'; const used = TIER.indexOf(st) >= TIER.indexOf(arc); C.dv.lastStains = used ? st : null; if (!used) return pc(k); C.say(`Stains of Profanity: ${k.name} Heat ${k.heat} → ${st} (Peril Arc: ${arc})`, 'ai'); const own = Object.prototype.hasOwnProperty.call(k, 'peril'), p0 = k.peril; k.peril = () => st; try { await pc(k); } finally { if (own) k.peril = p0; else delete k.peril; } if (C.isDsf) await C.dsfMolten(k, st); };
  },
  dvDrawFool() { if (!this.dvFools.length) { this.dvFools = this.rng.shuffle(this.dvFoolsDiscard); this.dvFoolsDiscard = []; this.say("Fool's deck 섞음"); } return this.dvFools.shift() || null; },
  dvShuffleFools() { this.dvFools = this.rng.shuffle([...this.dvFools, ...this.dvFoolsDiscard]); this.dvFoolsDiscard = []; this.say("Fool's deck: 버림 더미를 섞어 넣음"); },
  /** "You may Bargain before the Power Roll." */
  async dvBargainOffer(k, A, bp) { if (!this.isDevil || !bp || !bp.ops || !k.alive) return; if (bp.ops.rearPower && this.inBlindspot(k)) { A.extraPool.raw = (A.extraPool.raw || 0) + 1; this.say(`${bp.name}: Rear 칸에서 공격 → +1 [Power]`, 'bp'); } if (!bp.ops.bargain) return; if (this.isDsf && (k.panzergate || 0) > 0) return; if (bp.ops.relic) this.dvShuffleFools(); if (!await this.yesNo(`${k.name}: Power Roll 전에 Bargain? (${this.dv.free ? 'Bane 없음' : 'Bane 1'}${this.dv.reveal && this.dvFools[0] ? ` · Fool's deck 맨 위: ${this.dvFools[0].name} (${this.dvFools[0].letter})` : ''})`, false)) return; const n = await this.dvBargain(k, A); if (bp.ops.relic && n > 0) { A.extraPool.raw = (A.extraPool.raw || 0) + n; this.say(`Relic of an Age of Profanity: 뽑은 카드 ${n}장 → +${n} [Power]`, 'bp'); } },
  async dvBargain(k, A = null) { if (!this.dv.free) await this.fx.runKnightOp({ op: 'bane', n: 1 }, k, {}); if (!k.alive) return 0; return this.isDsf ? this.dsfBargain(k) : this.dadBargain(k, A); },

  // ---------- Devil of the Ancient Dusk ----------
  dadSetup(cs) {
    const B = this.board, M = this.monster, C = this; this.isDad = true; this.dvSetup();
    const lv = M.level >= 2 ? 'level2' : 'level1'; const S = cs.dad[lv];
    this.dad = { pairs: S.pairs.map(p => ({ rows: p.rows.map(l => B.rowLabels.indexOf(l)), L: p.left, R: p.right, L0: p.left, R0: p.right })), flags: {}, noDeluge: false };
    for (const l of S.columns) B.terrain.set(B.key(B.parse(l)), { ...COLUMN }); this.dadPaint(); this.say(`Primordial Soup: Swamp 타일 5쌍 + ${lv === 'level2' ? '바깥 Swamp 칸' : '보드 양 끝'} · Column ${S.columns.length}개 (Level ${lv === 'level2' ? '2+' : '1'} 배치)`, 'ai');
    const mr = this.monsterRound.bind(this); this.monsterRound = async () => { if (M.hasTrait('Ancestral Recollection')) { C.say('Start of Monster Round — Ancestral Recollection: 정면의 기사 Choke 2', 'ai'); for (const k of C.alive()) if (inFront(B, M.cells, M.facing, k.pos)) await C.fx.runMonsterOp({ op: 'choke', n: 2 }, { target: k }); } return mr(); };
    const kr = this.knightRound.bind(this); this.knightRound = async () => { if (C.dad.noDeluge) { C.dad.noDeluge = false; C.say('Deluge 다시 활성', 'ai'); } return kr(); };
    const mt = this.monsterMoveToward.bind(this); this.monsterMoveToward = async t => { if (C.dad.flags.slowSwamp && M.cells.some(c => C.dadSwamp(c))) { C.slowToken = true; C.say('Tail End Critical: Swamp에서 출발 → 3칸에서 멈춤', 'tech'); } const cr = C.crash; if (C.dad.noCrash) C.crash = async () => {}; try { return await mt(t); } finally { C.crash = cr; } };
  },
  dadSwamp(c) { const t = this.board.terrainAt(c); return !!(t && t.id === 'swamp'); },
  dadPair(row) { return this.dad.pairs.find(p => p.rows.includes(row)); },
  /** Re-paint the Swamp spaces: each pair's tiles and every space beyond them (Primordial Soup). */
  dadPaint() { const B = this.board; const id = this.dad.flags.rut ? 'rut' : 'swamp'; for (const p of this.dad.pairs) for (const r of p.rows) for (let c = 1; c <= B.cols; c++) { const cell = { c, r }, key = B.key(cell), t = B.terrain.get(key); const sw = c <= p.L || c >= p.R; if (sw) { if (!t || t.id === 'swamp' || t.id === 'rut') B.terrain.set(key, { ...SWAMP, id, difficult: id === 'swamp' }); } else if (t && (t.id === 'swamp' || t.id === 'rut')) B.terrain.delete(key); } },
  /** Deluge (Rising Tide): the pair of Swamp tiles in the Knight's row close in until one moves onto a Column (destroyed) or they are adjacent. */
  async dadDeluge(k, why = 'Deluge') { if (this.dad.noDeluge || this.dad.flags.noDeluge) { this.say('Deluge 비활성'); return; } if (!k || !k.pos) return; const p = this.dadPair(k.pos.r); if (!p) return; await this.dadDelugePair(p, why); },
  async dadDelugePair(p, why) { const B = this.board; const lab = `${B.rowLabels[p.rows[0]]}-${B.rowLabels[p.rows[1]]}행`; if (p.L + 1 >= p.R) { this.say(`${why} (${lab}): 이미 맞닿아 있음`); return; }
    const hit = c => p.rows.some(r => { const t = B.terrain.get(B.key({ c, r })); return t && t.id === 'column'; }); const smash = c => { for (const r of p.rows) { const key = B.key({ c, r }); const t = B.terrain.get(key); if (t && t.id === 'column') { B.terrain.delete(key); this.say(`Column 파괴 (${B.label({ c, r })})`, 'ai'); } } };
    const l0 = p.L, r0 = p.R; while (p.L + 1 < p.R) { p.L++; if (hit(p.L)) { smash(p.L); break; } } while (p.L + 1 < p.R) { p.R--; if (hit(p.R)) { smash(p.R); break; } }
    this.dadPaint(); this.say(`${why} (${lab}): 왼쪽 타일 ${l0} → ${p.L}열, 오른쪽 타일 ${r0} → ${p.R}열`, 'ai');
    for (const k of this.alive()) if (p.rows.includes(k.pos.r) && this.dadSwamp(k.pos)) k._moved = true; await this.swampSweep(); },
  dadColumns() { const B = this.board; const out = []; for (const [key, t] of B.terrain) if (t.id === 'column') { const [c, r] = key.split(',').map(Number); out.push({ c, r }); } return out; },
  dadDestroy(cells, why) { const B = this.board; let n = 0; for (const c of cells) { const t = B.terrainAt(c); if (t && t.id === 'column') { B.terrain.delete(B.key(c)); n++; } } if (n) this.say(`${why}: Column ${n}개 파괴`, 'ai'); return n; },
  dadDestroyNear(pos, n, far = false, why = 'Column 파괴') { const cols = this.dadColumns().sort((a, b) => (Math.abs(a.c - pos.c) + Math.abs(a.r - pos.r)) - (Math.abs(b.c - pos.c) + Math.abs(b.r - pos.r))); if (far) cols.reverse(); this.dadDestroy(cols.slice(0, n), why); },
  /** Swampwalk: the Devil appears in the Target's row at the closest short Board Edge, then moves adjacent to the Target. */
  async dadSwampwalk(k) { const B = this.board, M = this.monster; if (!k || !k.alive) return; const left = k.pos.c <= B.cols / 2; const c0 = left ? 1 : B.cols - 1; const r0 = Math.max(0, Math.min(B.rows - 2, k.pos.r)); const opts = [r0, r0 - 1].filter(r => r >= 0 && r <= B.rows - 2).map(r => [{ c: c0, r }, { c: c0 + 1, r }, { c: c0, r: r + 1 }, { c: c0 + 1, r: r + 1 }]).filter(fp => fp.some(c => c.r === k.pos.r) && !fp.some(c => cellEq(c, k.pos)));
    if (!opts.length) { this.turnToward(k.pos); await this.monsterMoveToward(k); return; } const i = opts.length === 1 ? 0 : await this.ask({ type: 'pick', text: `Swampwalk — Devil이 나타날 위치 (${k.name}의 행, ${left ? '왼쪽' : '오른쪽'} 끝)`, options: opts.map((fp, i) => ({ label: fp.map(c => B.label(c)).join('/'), value: i, cells: fp })) }); const fp = opts[i] || opts[0];
    B.remove(M.cells); M.cells = fp; B.place({ kind: 'monster', id: M.id }, fp); M.facing = left ? 'E' : 'W'; this.say(`Swampwalk: Devil → ${fp.map(c => B.label(c)).join('/')} (${k.name} 쪽으로 이동)`, 'ai'); for (const x of this.alive()) if (fp.some(c => cellEq(c, x.pos))) { await this.crash(x); if (x.alive) await this.displace(x); } if (k.alive) { await this.monsterMoveToward(k); this.turnToward(k.pos); } },
  /** Devil's Bargain (Ancient Dusk). Returns the number of cards drawn. */
  async dadBargain(k, A) { const B = this.board; const max = this.dvFools.length + this.dvFoolsDiscard.length; const n = await this.ask({ type: 'pick', knight: k.id, text: `${k.name} Bargain — Fool's deck에서 뽑을 장수 (같은 글자 한 쌍마다 벌칙, 2장마다 Column 1개)`, options: Array.from({ length: Math.min(max, 10) + 1 }, (_, i) => ({ label: `${i}장`, value: i })) }) || 0; if (!n) return 0;
    const drawn = []; for (let i = 0; i < n; i++) { const c = this.dvDrawFool(); if (c) drawn.push(c); } this.say(`${k.name} Bargain: ${drawn.map(c => `${c.name}(${c.letter})`).join(', ')}`, 'ai'); const cnt = {}; for (const c of drawn) cnt[c.letter] = (cnt[c.letter] || 0) + 1;
    for (const L of Object.keys(cnt).sort()) for (let i = 0; i < Math.floor(cnt[L] / 2) && k.alive; i++) await this.dadLetter(k, L, A);
    for (let i = 0; i < Math.floor(drawn.length / 2); i++) { const rows = [...new Set(this.alive().map(x => x.pos.r))]; const cells = []; for (const r of rows) for (let c = 1; c <= B.cols; c++) { const cell = { c, r }; if (!B.terrainAt(cell) && !this.knightAt(cell) && !this.monsterOccupies(cell)) cells.push(cell); } if (!cells.length) break; const cell = await this.ask({ type: 'move', knight: k.id, text: `Bargain: Column을 놓을 빈 칸 (기사가 있는 행) ${i + 1}/${Math.floor(drawn.length / 2)}`, cells, options: cells.map(c => ({ label: B.label(c), value: c })) }) || cells[0]; B.terrain.set(B.key(cell), { ...COLUMN }); this.say(`Column 배치 (${B.label(cell)})`, 'tech'); }
    this.dvFoolsDiscard.push(...drawn); if (drawn.some(c => c.letter === 'C')) this.dvShuffleFools(); return drawn.length; },
  async dadLetter(k, L, A) { const K = op => this.fx.runKnightOp(op, k, {}); this.say(`Fool's deck ${L}: ${{ A: 'Pull 2 (가까운 짧은 Board Edge 쪽)', B: 'Drowning', C: '사망', D: '공격한 BP에 "Overcome 6+: Knockdown"', E: 'Exposed', F: 'Discard (못 하면 사망)' }[L]}`, 'ai');
    switch (L) { case 'A': await this.dadPullEdge(k, 2); break; case 'B': await this.addCondition(k, 'Drowning'); break; case 'C': await this.die(k, "Devil's Bargain"); break; case 'D': if (A) A.dadKnockdown = true; break; case 'E': await this.addCondition(k, 'Exposed'); break; case 'F': if (k.hand.length) await K({ op: 'discard', n: 1 }); else await this.die(k, "Devil's Bargain (Discard 불가)"); break; } },
  async dadPullEdge(k, n) { if (!k.alive) return; const B = this.board; const dir = { c: k.pos.c <= B.cols / 2 ? -1 : 1, r: 0 }; this.say(`${k.name}: Pull ${n} → ${dir.c < 0 ? '왼쪽' : '오른쪽'} Board Edge 쪽`, 'ai'); await this.pushback(k, n, { dir, unavoidable: false }); },
  /** The Devil moves N spaces toward the closest short Board Edge without turning. */
  async dadRetreat(n) { const B = this.board, M = this.monster; const mc = this.monsterCenter(); const d = { c: mc.c <= (B.cols + 1) / 2 ? -1 : 1, r: 0 }; let s = 0; for (; s < n; s++) if (await this.monsterStep(d) !== 'ok') break; this.say(`Devil이 ${d.c < 0 ? '왼쪽' : '오른쪽'} Board Edge 쪽으로 ${s}칸 이동 (회전 없음)`, 'ai'); await this.endMoveOnKnights(); },
  async dadOp(o, ctx) {
    if (!this.isDad) return false; const M = this.monster, S = this.dad, B = this.board; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t; const K = (op, who = t) => who && who.alive ? this.fx.runKnightOp(op, who, {}) : null; const P = n => (S.flags.softPush ? Math.max(0, n - 2) : n);
    switch (o.op) {
      case 'dadDeluge': if (o.all) { for (const p of S.pairs) await this.dadDelugePair(p, 'Deluge (전체)'); } else await this.dadDeluge(o.who === 'attacker' ? k : t); return true;
      case 'dadSwampwalk': S.noCrash = !!o.noCrash; try { await this.dadSwampwalk(ctx.primary || t); } finally { S.noCrash = false; } return true;
      case 'dadNoCrash': S.noCrash = true; return true;
      case 'dadFaceClosest': { const a = this.alive(); if (!a.length) return true; const x = [...a].sort((p, q) => this.distKM(p) - this.distKM(q))[0]; this.turnToward(x.pos); return true; }
      case 'dadDestroyZone': { const z = ctx.attack && ctx.attack.card && ctx.attack.card.ops.zoneDiagram; if (z) this.dadDestroy(this.bossDiagramCells(z), 'Zone 안의 Column'); return true; }
      case 'dadDestroyNear': { const x = o.who === 'attacker' ? k : t; if (x && x.pos) this.dadDestroyNear(x.pos, (o.perHit ? ctx.hits : 1) * (o.n || 1), !!o.far, o.far ? '가장 먼 Column' : '가장 가까운 Column'); return true; }
      case 'dadHits': { if (!t || !t.alive || !(ctx.hits > 0)) return true; const e = o.table[Math.min(o.table.length, ctx.hits) - 1]; const pg = (ctx.gatesOn || []).find(g => g.op === 'dadFlatInstead'); await this.loseVigor(t, (pg ? pg.n : e.v ?? e) + (M.bonuses.vigorLoss || 0), { source: 'attack', perilCheck: !!o.perilCheck }); for (const x of (e.then || [])) { if (!t.alive) break; await this.fx.runMonsterOp(x, ctx); } return true; }
      case 'dadIfHits': if (ctx.hits >= o.gte && t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'dadK': await K(o.k, o.who === 'attacker' ? k : t); return true;
      case 'dadCond': { const x = o.who === 'attacker' ? k : t; if (x && x.alive && !(o.ifAdjacent && !this.adjacentToMonster(x))) await this.addCondition(x, o.id); return true; }
      case 'dadHeatPerHit': if (t && t.alive && ctx.hits > 0) await K({ op: 'gainHeat', n: ctx.hits * (o.n || 1) }); return true;
      case 'dadPush': { const x = o.who === 'attacker' ? k : t; if (!x || !x.alive) return true; const n = P(o.n === 'hits' ? ctx.hits : o.n === 'heat' ? x.heat : o.n === 'hits+0' ? ctx.hits : o.n); if (n > 0) await this.pushback(x, n, { isPush: true }); return true; }
      case 'dadPullEdge': await this.dadPullEdge(k, o.n); return true;
      case 'dadRetreat': await this.dadRetreat(o.n); return true;
      case 'dadGate': { const v = o.stat === 'passion' ? t.passion : t.heat; if (t && t.alive && v >= o.gte) { this.say(`${o.stat === 'passion' ? 'Passion' : 'Heat'} ${v} ≥ ${o.gte} → 게이트 효과`); await this.fx.runMonsterOps(o.then, ctx); } return true; }
      case 'dadFool': { for (let i = 0; i < ctx.hits && t.alive; i++) { await K({ op: 'gainHeat', n: 1 }); const c = this.dvDrawFool(); if (!c) break; this.say(`Back to Your Fathers!: ${c.name} (${c.letter})`, 'ai'); await this.dadLetter(t, c.letter, null); this.dvFools.push(c); } this.dvFools = this.rng.shuffle(this.dvFools); return true; }
      case 'dadRitual': { if (!t || !t.alive) return true; await K({ op: 'bane', n: 2 }); if (!t.alive) return true; t.vigor = Math.max(0, t.vigor - 9 - (M.bonuses.vigorLoss || 0)); this.say(`${t.name}: Lose -9 [V] → ${t.vigor}`, 'dmg'); if (t.vigor <= 0) { this.say(`${t.name}: 이 공격 중 [V] 0 → 사망`, 'death'); await this.die(t, 'Ritual Macabre'); return true; } await K({ op: 'gainHeat', n: 3 }); await this.perilCheck(t); return true; }
      case 'dadGrave': { const d = this.mortis.Grave; const c = d.cards[0]; if (!c) return true; this.say(`Grave Mortis 맨 위 공개: ${c.name}${c.name === 'Disemboweled' ? ' — 맨 위에 그대로' : ' → 덱 맨 아래로'}`, 'mortis'); if (c.name !== 'Disemboweled') d.cards.push(d.cards.shift()); return true; }
      case 'dadDiscardExposed': { const who = this.alive().filter(x => this.hasCondition(x, 'Exposed')); if (!who.length) return true; const id = await this.ask({ type: 'pick', text: '기사 1명이 Exposed Condition 버리기 (선택)', options: [...who.map(x => ({ label: x.name, value: x.id })), { label: '안 함', value: 'skip' }] }); const x = who.find(y => y.id === id); if (x) this.removeCondition(x, 'Exposed'); return true; }
      case 'dadBaneOff': { for (const x of (o.all ? this.alive() : [k])) { if (!x || !x.alive || !(x.bane > 0)) continue; const mx = o.n === 'all' ? x.bane : Math.min(x.bane, o.n); const v = o.force ? mx : await this.ask({ type: 'pick', knight: x.id, text: `${x.name}: 버릴 Bane 토큰 (최대 ${mx})`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: `${i}`, value: mx - i })) }); if (v > 0) { x.bane -= v; this.say(`${x.name}: Bane -${v} (${x.bane})`, 'tech'); } } return true; }
      case 'dadHeatOff': { for (const x of (o.all ? this.alive() : [k])) { if (!x || !x.alive || !(x.heat > 0)) continue; if (o.reset) { if (await this.yesNo(`${x.name}: Heat 리셋?`, true)) { x.heat = 0; this.say(`${x.name}: Heat 리셋`, 'tech'); } continue; } const mx = Math.min(x.heat, o.n); const v = await this.ask({ type: 'pick', knight: x.id, text: `${x.name}: 줄일 Heat (최대 ${mx})`, options: Array.from({ length: mx + 1 }, (_, i) => ({ label: `${mx - i}`, value: mx - i })) }); if (v > 0) { x.heat -= v; this.say(`${x.name}: Heat -${v} (${x.heat})`, 'tech'); } } return true; }
      case 'dadFlag': S.flags[o.id] = true; if (o.id === 'free') this.dv.free = true; if (o.id === 'reveal') this.dv.reveal = true; if (o.id === 'rut') { S.flags.noDeluge = true; this.dadPaint(); } this.say({ softPush: 'Devil의 모든 Pushback·Knockback -2', free: 'Bargain의 Bane 1 무시', slowSwamp: 'Clash 종료까지 Devil이 Swamp에서 이동을 시작하면 3칸에서 멈춤', reveal: "Clash 종료까지 Fool's deck 맨 위 카드 공개", rut: '모든 Swamp 칸/타일 → Rut (다시 뒤집을 수 없음). Deluge 비활성', noDeluge: 'Deluge 비활성' }[o.id] || o.id, 'tech'); return true;
      case 'dadReset': for (const p of S.pairs) { p.L = p.L0; p.R = p.R0; } this.dadPaint(); S.noDeluge = true; this.say('모든 Swamp 타일을 시작 위치로 — 다음 Knight Round까지 Deluge 비활성', 'tech'); return true;
      case 'dadMoveBonus': if (k && k.alive) { if (o.n && await this.yesNo(`${k.name}: 최대 ${o.n}칸 이동?`, false)) await this.knightMove(k, o.n); if (k.alive && this.canAttack(k) && await this.yesNo(`${k.name}: Bonus Attack 수행?`, true)) await this.knightAttack(k, { bonus: true }); } return true;
      case 'dadScavenge': this.scavengeBonus = (this.scavengeBonus || 0) + o.n; this.say(`Scavenge ${o.n}: Aftermath Loot +${o.n}`, 'tech'); return true;
      case 'dadCenter': await this.fx.runMonsterOp({ op: 'moveToCenter' }, ctx); await this.faceMostKnights(); return true;
      case 'dadRoutine': await this.fx.runMonsterOp({ op: 'moveToCenter' }, ctx); for (const p of S.pairs) await this.dadDelugePair(p, 'Return to the Past'); for (const x of this.alive()) await this.addCondition(x, 'Drowning'); return true;
      case 'dadNote': this.say(o.text, 'warn'); return true;
      default: return false;
    }
  },
};
export const DEVIL_OPS = ['dadDeluge', 'dadSwampwalk', 'dadNoCrash', 'dadFaceClosest', 'dadDestroyZone', 'dadDestroyNear', 'dadHits', 'dadIfHits', 'dadK', 'dadCond', 'dadHeatPerHit', 'dadPush', 'dadPullEdge', 'dadRetreat', 'dadGate', 'dadFool', 'dadRitual', 'dadGrave', 'dadDiscardExposed', 'dadBaneOff', 'dadHeatOff', 'dadFlag', 'dadReset', 'dadMoveBonus', 'dadScavenge', 'dadCenter', 'dadRoutine', 'dadNote'];
