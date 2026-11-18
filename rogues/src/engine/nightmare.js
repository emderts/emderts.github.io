// Winged Nightmare (single-Mob Clash): two-sided BP (Wide Wings / Slithering Tails) that never leaves the Mob track, Generic Single Wounds,
// AI Response (top card of the AI discard pile), Flank / Flee X, Endure X, Column perches (Marble Forest / Siren's Spite), Bloody Defiance,
// Nixie's Fury, Coiling Malice, Drag X / Drag toward (rulebook keyword box, owner scan 2026-11-15).
import { DIRS } from './board.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const man = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

export const NightmareMixin = {
  nightmareSetup(cs) {
    const M = this.monster, B = this.board, D = this.monsterDef; this.isWN = true; this.flags = this.flags || {}; this.wnEndure = 0; this.defianceOn = false;
    this.wnCards = { wide: { ...D.nightmare.wide }, tails: { ...D.nightmare.tails }, defiance: { ...D.nightmare.defiance } };
    const mob = this.addMob(this.wnCards.wide, B.parse(cs.monsterCells[0]), cs.facing, 1, { revealed: true }); mob.isNightmare = true; M.cur = mob; this.wn = mob;
    M.activations.forEach(a => mob.tokens.push({ type: a.type, ready: true })); this.necro = 0; this.scavengeBonus = 0; this.mobArmorDisabled = false;
    if (M.hasTrait('Bloody Defiance')) M.noWoundDeath = true;
    this.say(`Winged Nightmare 배치 ${cs.monsterCells[0]} · 방향 ${cs.facing} · Wide Wings 면`); this.wnEnsureDiscard();
    for (let i = 0; i < (M.bonuses.escalations || 0); i++) { this.say('시작 Escalation'); this.wnEscalate(); }
  },
  wnBypass() { return this.wn.card !== this.wnCards.tails; },
  wnChasm() { return [...this.board.terrain.entries()].filter(([, t]) => t.chasm).map(([k]) => { const [c, r] = k.split(',').map(Number); return { c, r }; }); },
  wnOnColumn(k) { const t = this.board.terrainAt(k.pos); return !!(t && t.id === 'column'); },
  wnTopAI() { this.wnEnsureDiscard(); return this.monster.ai.discard.at(-1) || null; },
  /** Unpredictable Nature: "If, at any point, the AI discard pile is empty, discard the top AI card." */
  wnEnsureDiscard() { const A = this.monster.ai; if (!A.discard.length && A.cards.length) { const c = A.cards.shift(); A.discard.push(c); this.say(`AI 버림 더미가 비어 있음 → 맨 위 AI 카드 버림 (${c.name})`); } },
  /** "Escalate only the AI deck … based on the AI Level of the top card of the AI discard pile." */
  wnEscalate() { const top = this.wnTopAI(); if (!top) return; this.say(`AI Escalation (버림 더미 맨 위 ${top.name} = AI ${top.level})`); this.monster.escalateAI(top.level); for (const m of this.monster.log.splice(0)) this.say(m); this.wnEnsureDiscard(); },
  nightmareWound(A) {
    const M = this.monster; M.woundStack.push({ generic: 'single', wounds: 1 }); this.say('Unpredictable Nature: Generic Single Wound → Wound Stack', 'wound'); this.wnEscalate();
    const t = this.board.terrainAt(this.wn.cells[0]);
    if (this.defianceOn && t && t.chasm) { this.wnDie('Bloody Defiance: Chasm 위에서 Wound'); return 1; }
    if (M.hasTrait('Bloody Defiance') && !this.defianceOn && M.wounds >= M.woundsToKill) { this.defianceOn = true; this.wn.card = this.wnCards.defiance; A.wnDefianceNow = true; this.say('Bloody Defiance: 마지막 Wound — BP Trait 카드를 BP 위에 놓고 그 Response를 대신 해결. 이후 이 카드를 공격', 'bp'); }
    return 1;
  },
  wnDie(why) { this.monster.forceSlain = true; this.say(`Winged Nightmare 사망 — ${why}`, 'wound'); },
  wnToHit(k) { return this.wn.card === this.wnCards.wide && !this.wnOnColumn(k) ? 2 : 0; },
  async wnStartMR() { if (this.wn.card === this.wnCards.tails) { this.wn.card = this.wnCards.wide; this.say('Monster Round 시작: Slithering Tails → Wide Wings로 뒤집음', 'bp'); } },
  async wnFlip() { if (this.defianceOn) return; const W = this.wnCards; this.wn.card = this.wn.card === W.wide ? W.tails : W.wide; this.say(`BP 뒤집음 → ${this.wn.card.name} (AT ${this.mobAT(this.wn)})${this.wn.card === W.tails ? ' · Superior Bypass 상실' : ''}`, 'bp'); },
  // ---------- Marble Forest ----------
  wnFreeActions(k) { if (!this.isWN || !this.monster.hasTrait('Marble Forest') || k.wnClimbRound === this.round) return []; const B = this.board; return B.neighbors(k.pos).filter(c => { const t = B.terrainAt(c); return t && t.id === 'column' && !this.knightAt(c) && !this.monsterOccupies(c); }).map(c => ({ id: 'climb:' + B.label(c), label: `Column 오르기 → ${B.label(c)} (Marble Forest)` })); },
  /** Marble Forest: "As a free action, or instead of a Reflex, Knights may climb adjacent Column Terrain tiles." */
  wnReflexColumns(k) { if (!this.isWN || !this.monster.hasTrait('Marble Forest') || !k.pos) return []; const B = this.board; return B.neighbors(k.pos).filter(c => { const t = B.terrainAt(c); return t && t.id === 'column' && !this.knightAt(c) && !this.monsterOccupies(c); }); },
  async wnClimb(k, label, viaReflex = false) { if (!viaReflex) k.wnClimbRound = this.round; const c = this.board.parse(label); this.moveKnight(k, c); this.say(`${k.name}: Column ${label} 위로 올라감 (Marble Forest)`); },
  /** On a Column: Knockdown / involuntary movement → Displaced + Crash instead. Returns true when it replaced the effect. */
  async wnColumnGuard(k, what) { if (!this.isWN || this._wnGuard || !k.alive || !this.wnOnColumn(k) || !this.monster.hasTrait('Marble Forest')) return false; this._wnGuard = true; try { this.say(`${k.name}: Column 위에서 ${what} → 대신 Displace + Crash (Marble Forest)`); await this.displace(k); if (k.alive) await this.crash(k); } finally { this._wnGuard = false; } return true; },
  // ---------- movement ----------
  wnDist(from) { const B = this.board, bp = this.wnBypass(); const pass = c => bp || (!(B.terrainAt(c) && B.terrainAt(c).obstacle) && !this.knightAt(c)); const dist = new Map([[B.key(from), 0]]); const prev = new Map(); let fr = [from];
    while (fr.length) { const nx = []; for (const c of fr) for (const n of B.neighbors(c)) { const k = B.key(n); if (dist.has(k)) continue; dist.set(k, dist.get(B.key(c)) + 1); prev.set(k, c); if (pass(n)) nx.push(n); } fr = nx; }
    const path = to => { const out = []; let c = to; while (c && !cellEq(c, from)) { out.unshift(c); c = prev.get(B.key(c)); } return out; }; return { d: c => dist.has(B.key(c)) ? dist.get(B.key(c)) : Infinity, path }; },
  async wnPick(cells, text) { const B = this.board; if (cells.length <= 1) return cells[0] || null; return await this.ask({ type: 'move', text, cells, options: cells.map(c => ({ label: B.label(c), value: c })) }) || cells[0]; },
  /** Place the Nightmare on `cell` after moving along `path`: Coiling Malice (Crash Knights moved through), Siren's Spite (Column left behind is destroyed),
   *  a Knight on the destination suffers Crash and is Displaced. */
  async wnMoveTo(cell, why, path = null, { involuntary = false } = {}) {
    const M = this.monster, B = this.board, mob = this.wn; const from = mob.cells[0]; if (!cell || cellEq(from, cell)) return false;
    if (this.slowToken && !involuntary) { this.slowToken = false; this.say('임시 Speed 토큰: 이번 이동은 3칸에서 멈춤 (토큰 버림)', 'tech'); if (path && path.length > 3) { path = path.slice(0, 3); cell = path[2]; } }
    if (path && M.hasTrait('Coiling Malice')) for (const c of path.slice(0, -1)) { const k = this.knightAt(c); if (k) { this.say(`Coiling Malice: ${k.name}을(를) 지나감`); await this.crash(k); } }
    if (involuntary) { const tc = B.terrainAt(cell); if (tc && tc.id === 'column') { B.terrain.delete(B.key(cell)); this.say(`Column ${B.label(cell)} 파괴 (Winged Nightmare가 비자발적으로 통과)`); } }
    const on = this.knightAt(cell); if (on) { this.say(`${on.name}: Winged Nightmare가 이 칸에서 이동 종료 → Crash + Displace`); await this.crash(on); if (on.alive) await this.displace(on); }
    this.mobStepTo(mob, cell); this.say(`Winged Nightmare ${why}: ${B.label(from)} → ${B.label(cell)}`, 'ai');
    const t = B.terrainAt(from); if (t && t.id === 'column' && M.hasTrait('Siren’s Spite')) { B.terrain.delete(B.key(from)); this.say(`Siren’s Spite: Column ${B.label(from)} 파괴`); const k = this.knightAt(from); if (k) void k; }
    for (const c of [...(path || []), cell]) this.wnFlipRut(c);
    const tt = B.terrainAt(cell); if (involuntary && this.defianceOn && tt && tt.chasm) this.wnDie('Bloody Defiance: Chasm으로 비자발적 이동');
    return true;
  },
  /** Rut: "When a Monster moves onto this tile, flip it" — the flipped side is a Swamp (owner reference sheet 2026-11-15). */
  wnFlipRut(c) { const B = this.board; const t = B.terrainAt(c); if (!t || t.id !== 'rut') return; const grp = [c]; for (let i = 0; i < grp.length; i++) for (const n of B.neighbors(grp[i])) { const tn = B.terrainAt(n); if (tn && tn.id === 'rut' && !grp.some(x => cellEq(x, n))) grp.push(n); } for (const x of grp) B.terrain.set(B.key(x), { id: 'swamp', obstacle: false, obscuring: false, destructible: false, chasm: false, difficult: true }); this.say(`Rut ${grp.map(x => B.label(x)).join('-')} 뒤집힘 → Swamp`); },
  wnFree(c) { const B = this.board; const t = B.terrainAt(c); return B.inside(c) && !(t && t.obstacle) && !this.knightAt(c); },
  async wnMoveToward(k) { const B = this.board; const me = this.wn.cells[0]; if (B.adjacent(me, k.pos)) { this.turnToward(k.pos); return; } const D = this.wnDist(me); const cand = B.neighbors(k.pos).filter(c => this.wnFree(c) && D.d(c) < Infinity); if (!cand.length) return; const best = Math.min(...cand.map(D.d)); const to = await this.wnPick(cand.filter(c => D.d(c) === best), 'Winged Nightmare 이동 도착 칸 (동률)'); await this.wnMoveTo(to, `이동 ${best}칸`, D.path(to)); this.turnToward(k.pos); },
  /** Flank: empty space adjacent to the Knight, furthest from the board centre, prioritising spaces in a straight line from a Chasm (Nightmare–Knight–Chasm aligned). */
  async wnFlank(k) {
    const B = this.board, me = this.wn.cells[0]; let cand = B.neighbors(k.pos).filter(c => this.wnFree(c) || cellEq(c, me)); if (!cand.length) { this.say('Flank: 빈 인접 칸 없음'); return; }
    const chasm = this.wnChasm(); const lined = c => { const d = { c: k.pos.c - c.c, r: k.pos.r - c.r }; for (let x = { c: k.pos.c + d.c, r: k.pos.r + d.r }; B.inside(x); x = { c: x.c + d.c, r: x.r + d.r }) if (chasm.some(h => cellEq(h, x))) return true; return false; };
    const pri = cand.filter(lined); if (pri.length) cand = pri; const ctr = { c: (B.cols + 1) / 2, r: (B.rows - 1) / 2 }; const far = c => (c.c - ctr.c) ** 2 + (c.r - ctr.r) ** 2; const best = Math.max(...cand.map(far));
    const to = await this.wnPick(cand.filter(c => far(c) === best), `Flank — ${k.name} 옆 칸 (동률)`); if (cellEq(to, me)) this.say('Flank: 이미 그 칸에 있음'); else await this.wnMoveTo(to, `Flank${pri.length ? ' (Chasm 일직선)' : ''}`, this.wnDist(me).path(to)); this.turnToward(k.pos);
  },
  /** Flee X: X spaces toward the closest Board Edge; on the edge, continue along it toward the next closest Board Edge. */
  async wnFlee(n) {
    const B = this.board, bp = this.wnBypass(); let cur = this.wn.cells[0]; const path = []; let pick = null;
    for (let i = 0; i < n; i++) {
      const e = [{ f: 'W', d: cur.c - 1, v: { c: -1, r: 0 } }, { f: 'E', d: B.cols - cur.c, v: { c: 1, r: 0 } }, { f: 'S', d: cur.r, v: { c: 0, r: -1 } }, { f: 'N', d: B.rows - 1 - cur.r, v: { c: 0, r: 1 } }];
      const pos = e.filter(x => x.d > 0); if (pos.length <= 2 && e.filter(x => x.d === 0).length >= 2) break; // corner
      const onEdge = e.filter(x => x.d === 0); let pool = pos; if (onEdge.length) pool = pos.filter(x => (x.v.c !== 0) !== (onEdge[0].v.c !== 0)); // move along the edge
      const m = Math.min(...pool.map(x => x.d)); const opts = pool.filter(x => x.d === m); let go = opts.find(x => x.f === pick) || opts[0];
      if (opts.length > 1 && !opts.some(x => x.f === pick)) { const f = await this.ask({ type: 'pick', text: `Flee — ${onEdge.length ? '다음으로 ' : ''}가장 가까운 Board Edge (동률)`, options: opts.map(x => ({ label: this.dirName(x.v), value: x.f })) }); go = opts.find(x => x.f === f) || opts[0]; } pick = go.f;
      const nx = { c: cur.c + go.v.c, r: cur.r + go.v.r }; if (!bp && !this.wnFree(nx)) break; cur = nx; path.push(nx);
    }
    if (!path.length) { this.say(`Flee ${n}: 이동 없음`); return; } await this.wnMoveTo(cur, `Flee ${n} (${path.length}칸)`, path); this.wn.facing = pick; this.say(`Winged Nightmare가 Board Edge(${pick}) 쪽을 향함`);
  },
  async wnToColumn() { const me = this.wn.cells[0]; { const t0 = this.board.terrainAt(me); if (t0 && t0.id === 'column') { this.say('이미 Column 위 — 제자리'); return; } } const D = this.wnDist(me); const cols = this.tileCells('column').filter(c => !cellEq(c, me) && !this.knightAt(c) && D.d(c) < Infinity); if (!cols.length) { this.say('빈 Column 타일 없음'); return; } const best = Math.min(...cols.map(D.d)); const col = await this.wnPick(cols.filter(c => D.d(c) === best).map(c => ({ c: c.c, r: c.r })), '가장 가까운 빈 Column (동률)');
    if (!this.wnBypass()) { if (this.board.adjacent(me, col)) { this.say('Slithering Tails: 이미 Column 옆'); return; } const adj = this.board.neighbors(col).filter(c => this.wnFree(c) && D.d(c) < Infinity); if (!adj.length) return; const b2 = Math.min(...adj.map(D.d)); const to = await this.wnPick(adj.filter(c => D.d(c) === b2), 'Column 옆 칸 (동률)'); await this.wnMoveTo(to, 'Column 옆으로 이동 (Slithering Tails — Superior Bypass 없음)', D.path(to)); return; }
    await this.wnMoveTo(col, 'Column 타일로 이동', D.path(col)); },
  async wnToChasmAdjacent() { const B = this.board, me = this.wn.cells[0]; const chasm = this.wnChasm(); const D = this.wnDist(me); const cand = []; for (const h of chasm) for (const c of B.neighbors(h)) if (this.wnFree(c) && !chasm.some(x => cellEq(x, c)) && !cellEq(c, me) && D.d(c) < Infinity && !cand.some(x => cellEq(x, c))) cand.push(c); if (!cand.length) return; const best = Math.max(...cand.map(c => man(c, me))); const to = await this.wnPick(cand.filter(c => man(c, me) === best), 'Chasm 옆의 가장 먼 빈 칸 (동률)'); await this.wnMoveTo(to, 'Chasm 옆 가장 먼 칸으로 이동', D.path(to)); },
  async wnToChasm() { const me = this.wn.cells[0]; const chasm = this.wnChasm().filter(c => !this.knightAt(c)); if (!chasm.length || chasm.some(c => cellEq(c, me))) { this.say('이미 Chasm 위'); return; } const D = this.wnDist(me); const best = Math.min(...chasm.map(D.d)); const to = await this.wnPick(chasm.filter(c => D.d(c) === best), '가장 가까운 Chasm 칸 (동률)'); await this.wnMoveTo(to, '가장 가까운 Chasm으로 이동', D.path(to)); },
  wnZoneTargets(x) { const cells = this.board.zone(this.wn.cells, x); return this.alive().filter(k => cells.some(c => cellEq(c, k.pos))); },
  inWnRear(k) { const f = DIRS[OPP[this.wn.facing]]; const me = this.wn.cells[0]; return cellEq(k.pos, { c: me.c + f.c, r: me.r + f.r }); },
  // ---------- Knight movement caused by cards ----------
  /** Voluntary-type movement of a Knight toward a set of goal cells (stops adjacent to them); Chasm / Obstacles cannot be entered. */
  async wnKnightWalk(k, steps, goals, why) { const B = this.board; const d = c => Math.min(...goals.map(g => man(g, c))); let m = 0; for (let i = 0; i < steps && k.alive && d(k.pos) > 1; i++) { const opts = B.neighbors(k.pos).filter(c => !B.isObstacle(c) && !this.knightAt(c) && !this.monsterOccupies(c) && d(c) < d(k.pos)); if (!opts.length) break; const to = opts.length > 1 ? await this.ask({ type: 'move', knight: k.id, text: `${k.name}: ${why} — 칸 선택`, cells: opts, options: opts.map(c => ({ label: B.label(c), value: c })) }) || opts[0] : opts[0]; this.moveKnight(k, to); m++; } this.say(`${k.name}: ${why} ${m}칸 → ${B.label(k.pos)}`); },
  async wnPushToChasm(k, n, front = false) { let chasm = this.wnChasm(); if (front) { const f = DIRS[this.wn.facing], me = this.wn.cells[0]; chasm = chasm.filter(c => (c.c - me.c) * f.c + (c.r - me.r) * f.r > 0); } if (!chasm.length) return this.pushback(k, n); const best = Math.min(...chasm.map(c => man(c, k.pos))); const h = chasm.find(c => man(c, k.pos) === best); const dc = h.c - k.pos.c, dr = h.r - k.pos.r; const dir = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) }; this.say(`Pushback ${n} — 가장 가까운 Chasm(${this.board.label(h)}) 방향`); return this.pushback(k, n, { dir }); },
  /** Drag toward (keyword box): the source moves toward and past the space along the shortest path until the Target could enter it (max X), then the Target follows the path until adjacent. */
  async wnDragToChasm(k, x) {
    const B = this.board, me = this.wn.cells[0]; if (!B.adjacent(me, k.pos) || await this.wnColumnGuard(k, 'Drag')) return; const chasm = this.wnChasm(); if (!chasm.length) return; const D = this.wnDist(me); const best = Math.min(...chasm.map(D.d)); const goal = chasm.find(c => D.d(c) === best);
    let path = cellEq(goal, me) ? [] : D.path(goal); const last = path.length >= 2 ? { c: path.at(-1).c - path.at(-2).c, r: path.at(-1).r - path.at(-2).r } : path.length ? { c: path[0].c - me.c, r: path[0].r - me.r } : { c: me.c - k.pos.c, r: me.r - k.pos.r }; const past = { c: goal.c + last.c, r: goal.r + last.r }; if (B.inside(past)) path = [...path, past];
    const took = []; for (const c of path) { if (took.length >= x) break; if (this.knightAt(c) || (!this.wnBypass() && B.terrainAt(c) && B.terrainAt(c).obstacle)) break; took.push(c); }
    if (!took.length) { this.say(`Drag ${x}: Winged Nightmare가 움직일 수 없음`); return; } const start = me; await this.wnMoveTo(took.at(-1), `Drag ${x} — Chasm ${B.label(goal)} 방향 ${took.length}칸`, took);
    const walk = [start, ...took.slice(0, -1)]; let m = 0;
    for (const c of walk) { if (!k.alive) break; const t = B.terrainAt(c); if (t && t.obstacle) { await this.crash(k); if (t.destructible) { B.terrain.delete(B.key(c)); this.say(`${t.id} 파괴 (${B.label(c)})`); } else break; if (!k.alive) break; } if (this.knightAt(c)) break; this.moveKnight(k, c); m++; if (t && t.chasm) { await this.die(k, 'Chasm'); break; } if (t && t.id === 'rubble') await this.knockdown(k); }
    if (k.alive) { this.turnToward(k.pos); this.say(`${k.name} Drag: ${m}칸 끌려감 → ${B.label(k.pos)}`); }
  },
  // ---------- Knight keywords against the Nightmare ----------
  async wnPushedBy(k, n) { const B = this.board; const me = this.wn.cells[0]; const dc = me.c - k.pos.c, dr = me.r - k.pos.r; const d = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc) || 1, r: 0 } : { c: 0, r: Math.sign(dr) }; let m = 0; for (let i = 0; i < n && !this.monster.forceSlain; i++) { const cur = this.wn.cells[0]; const nx = { c: cur.c + d.c, r: cur.r + d.r }; const t = B.terrainAt(nx); if (!B.inside(nx) || (t && t.obstacle && t.id !== 'column') || this.knightAt(nx)) break; await this.wnMoveTo(nx, 'Pushback', null, { involuntary: true }); m++; } this.say(`${k.name} Pushback ${n}: Winged Nightmare ${m}칸 밀림`); },
  /** Drag X by a Knight: the Knight moves X spaces directly away (stopping before occupied spaces / Obstacles / Chasm), then the Nightmare follows the path. */
  async wnDraggedBy(k, n) { const B = this.board; const me = this.wn.cells[0]; if (!B.adjacent(me, k.pos)) { this.say('Drag: 인접하지 않음'); return; } const d = { c: k.pos.c - me.c, r: k.pos.r - me.r }; const start = k.pos; let m = 0; for (let i = 0; i < n; i++) { const nx = { c: k.pos.c + d.c, r: k.pos.r + d.r }; if (!B.inside(nx) || B.isObstacle(nx) || this.knightAt(nx) || this.monsterOccupies(nx)) break; this.moveKnight(k, nx); m++; } if (!m) { this.say('Drag: 기사가 물러날 수 없음'); return; }
    const path = [start]; for (let i = 1; i < m; i++) path.push({ c: start.c + d.c * i, r: start.r + d.r * i }); for (const c of path) { if (this.monster.forceSlain) break; await this.wnMoveTo(c, 'Drag', null, { involuntary: true }); } this.say(`${k.name} Drag ${n}: ${m}칸 물러나고 Winged Nightmare가 따라옴 → ${B.label(this.wn.cells[0])}`); },
  async wnPushOrDrag(k, n) { if (!k || !k.alive || n <= 0) return; const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Pushback ${n} 또는 Drag ${n} (Winged Nightmare 대상)`, options: [{ label: `Pushback ${n}`, value: 'push' }, { label: `Drag ${n}`, value: 'drag' }, { label: '사용 안 함', value: 'skip' }] }); if (v === 'push') await this.wnPushedBy(k, n); else if (v === 'drag') await this.wnDraggedBy(k, n); },
  // ---------- AI Response / Nixie's Fury ----------
  async wnAIResponse(ctx) { const card = this.wnTopAI(); if (!card) return; this.say(`AI Response — ${card.name}: ${card.aiResponse}`, 'ai'); if (card.aiResponseReactMarker) await this.windowOfOpportunity('react', null); await this.fx.runMonsterOps(card.ops.aiResponse || [], { ...ctx, aiResponse: true }); },
  async wnNixie(slots) { if (!this.isWN || this._nixie || !this.monster.hasTrait('Nixie’s Fury') || slots < 2) return; this._nixie = true; this.say('Nixie’s Fury: 두 번째 기사 턴 종료 → AI 카드 수행', 'ai'); await this.withMob(this.wn, () => this.activationAI()); await this.afterAction(); this.checkEnd(); },
  // ---------- ops ----------
  async wnOp(o, ctx) {
    if (!this.isWN) return false; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t; const rearSkip = ctx.aiResponse && k && this.inWnRear(k);
    switch (o.op) {
      case 'wnEndure': this.wnEndure += o.n; this.say(`Endure ${o.n}: 임시 AT +${o.n} (다음 Power Roll까지, 현재 +${this.wnEndure})`); return true;
      case 'wnFlank': if (rearSkip) { this.say('AI Response: 공격자가 Rear → Flank 무시'); return true; } if (t && t.alive) await this.wnFlank(t); return true;
      case 'wnFlee': if (rearSkip) { this.say('AI Response: 공격자가 Rear → Flee 무시'); return true; } await this.wnFlee(o.n); return true;
      case 'wnToColumn': await this.wnToColumn(); return true;
      case 'wnToChasmAdjacent': await this.wnToChasmAdjacent(); return true;
      case 'wnToChasm': await this.wnToChasm(); return true;
      case 'wnDiscardTopAI': { const c = this.monster.ai.draw(); if (c) { this.monster.ai.toDiscard(c); this.say(`AI 덱 맨 위 카드 버림: ${c.name}`); } return true; }
      case 'wnAIResponse': await this.wnAIResponse(ctx); return true;
      case 'wnFlip': await this.wnFlip(); return true;
      case 'wnDie': this.wnDie('Bloody Defiance Critical'); return true;
      case 'wnPushOrDrag': await this.wnPushOrDrag(k, o.x === 'wounds' ? this.monster.wounds : o.n); return true;
      case 'wnReact': await this.windowOfOpportunity('react', ctx.attack && ctx.attack.card ? ctx.attack : null, t); return true;
      case 'wnIfRear': await this.fx.runMonsterOps(k && this.inWnRear(k) ? o.then : o.else, ctx); return true;
      case 'ifHits': if ((ctx.hits || 0) >= (o.gte || 0) && (o.lt == null || ctx.hits < o.lt) && t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'wnPull': if (t && t.alive) await this.pull(this.wn, t, o.n); return true;
      case 'wnPushbackHits': if (t && t.alive && ctx.hits) { if (o.toChasm) await this.wnPushToChasm(t, ctx.hits); else await this.pushback(t, ctx.hits); } return true;
      case 'wnPushToChasm': if (t && t.alive) await this.wnPushToChasm(t, o.n, o.front); return true;
      case 'wnDrag': if (t && t.alive) await this.wnDragToChasm(t, (ctx.hits || 0) + (o.plus || 0)); return true;
      case 'wnTowardNightmare': if (t && t.alive) await this.wnKnightWalk(t, o.n * (ctx.hits || 0), this.wn.cells, 'Winged Nightmare 쪽으로 이동'); return true;
      case 'wnTowardChasm': if (t && t.alive) await this.wnKnightWalk(t, o.n * (ctx.hits || 0), this.wnChasm(), '가장 가까운 Chasm 쪽으로 이동'); return true;
      case 'wnVigor0Knockback': if (t && t.alive && t.vigor <= 0) { this.say(`${t.name}: Vigor 0 → Knockback ${o.n}`); await this.pushback(t, o.n); } return true;
      case 'wnShriek': for (const x of this.alive()) { await this.addCondition(x, 'Panicked'); if (x.alive) await this.wnKnightWalk(x, this.fx.speed(x), this.wnChasm(), 'Shriek — 가장 가까운 Chasm으로 이동'); } return true;
      default: return false;
    }
  },
};
export const NIGHTMARE_OPS = ['wnEndure', 'wnFlank', 'wnFlee', 'wnToColumn', 'wnToChasmAdjacent', 'wnToChasm', 'wnDiscardTopAI', 'wnAIResponse', 'wnFlip', 'wnDie', 'wnPushOrDrag', 'wnReact', 'wnIfRear', 'ifHits', 'wnPull', 'wnPushbackHits', 'wnPushToChasm', 'wnDrag', 'wnTowardNightmare', 'wnTowardChasm', 'wnVigor0Knockback', 'wnShriek'];
