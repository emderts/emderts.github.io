// Stonemason Knight (Vassal Clash): Lodestone Armor (Ward Nodes), Architect of Destruction / Ruin (2x2 Rubble tiles), Uneven Footing,
// Buried Alive, Magnetite Reinforcement, Impervious Armor, Unwavering Devotion, Ferrospikes, Move Lateral.
import { DIRS, faceToward } from './board.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' }, BACK = { N: 'S', S: 'N', E: 'W', W: 'E' };
const SIDES = ['front', 'right', 'rear', 'left'], SIDE_KO = { front: '앞', right: '오른쪽', rear: '뒤', left: '왼쪽' };
const dot = (a, v) => a.c * v.c + a.r * v.r;

export const MasonMixin = {
  smSetup(cs) {
    const M = this.monster, B = this.board, C = this, fx = this.fx; this.isSm = true;
    this.sm = { nodes: { front: 0, right: 0, rear: 0, left: 0 }, locked: false, lockKR: false, tiles: [], flags: {}, side: null, pendingSig: false, noToken: false };
    for (const t of cs.terrain) if (t.tile === 'rubble') this.sm.tiles.push(t.cells.map(l => B.parse(l)));
    const at = this.bpAT.bind(this); this.bpAT = bp => at(bp) + (C.sm.side && !C.sm.flags.ignoreNodes && C.sm.nodes[C.sm.side] > 0 ? 1 : 0);
    const ka = this.knightAttack.bind(this); this.knightAttack = async (k, opts) => {
      if (C.sm.side || !k.alive) return ka(k, opts); const side = C.smSide(k.pos); C.sm.side = side; C.sm.noToken = !!(opts && opts.smNoLodestone); if (C.sm.nodes[side] > 0 && !C.sm.flags.ignoreNodes) C.say(`Lodestone Armor: ${SIDE_KO[side]} 면 Armor 토큰 → AT +1`, 'bp');
      try { return await ka(k, opts); } finally { const skip = C.sm.noToken; C.sm.side = null; C.sm.noToken = false; if (!skip && !C.result && !M.slain) await C.guard(() => C.smLodestone(side)); if (C.sm.pendingSig && !C.result && !M.slain) { C.sm.pendingSig = false; C.say('Uneven Footing: Signature', 'bp'); await C.guard(() => C.performSignature()); } }
    };
    const mr = this.monsterRound.bind(this); this.monsterRound = async () => { C.sm.locked = false; await mr(); if (!C.result && M.hasTrait('Magnetite Reinforcement')) await C.guard(() => C.smMagnetite()); };
    const kr = this.knightRound.bind(this); this.knightRound = async () => { await kr(); C.sm.lockKR = false; };
    const mk = this.moveKnight.bind(this); this.moveKnight = (k, cell) => { mk(k, cell); if (M.hasTrait('Ferrospikes') && C.smRubbleAt(cell)) k._ferro = (k._ferro || 0) + 1; };
    for (const fn of ['knightMove', 'knockback', 'pushback']) { const orig = this[fn].bind(this); this[fn] = async (...a) => { const r = await orig(...a); await C.smFerro(); return r; }; }
  },
  /** Ferrospikes: Vigor loss for the Rubble spaces a Knight entered since the last check. */
  async smFerro() { if (!this.isSm) return; for (const k of this.alive()) if (k._ferro) { const n = k._ferro; k._ferro = 0; this.say(`Ferrospikes: ${k.name} Rubble ${n}칸 → Vigor -${n}`, 'bp'); await this.loseVigor(k, n, { source: 'terrain', armor: false }); } },
  smSide(pos) { const M = this.monster; const f = DIRS[M.facing], r = DIRS[RIGHT[M.facing]]; const fs = M.cells.map(c => dot(c, f)), rs = M.cells.map(c => dot(c, r)); const kf = dot(pos, f), kr = dot(pos, r);
    const df = kf > Math.max(...fs) ? kf - Math.max(...fs) : kf < Math.min(...fs) ? kf - Math.min(...fs) : 0; const dl = kr > Math.max(...rs) ? kr - Math.max(...rs) : kr < Math.min(...rs) ? kr - Math.min(...rs) : 0;
    if (df !== 0 && Math.abs(df) >= Math.abs(dl)) return df > 0 ? 'front' : 'rear'; return dl > 0 ? 'right' : dl < 0 ? 'left' : 'front'; },
  smNodeText() { const n = this.sm.nodes; return SIDES.map(s => `${SIDE_KO[s]} ${n[s]}`).join(' · '); },
  smCanGain() { return !this.sm.locked && !this.sm.lockKR; },
  /** Lodestone Armor: after an Attack from a side without an Armor token (Lv4: or with one). */
  async smLodestone(side) {
    const M = this.monster, S = this.sm, n = S.nodes; if (!M.hasTrait('Lodestone Armor') || !this.smCanGain()) return; const max = M.hasTrait('Unwavering Devotion') ? 1 : 0; if (n[side] > max) return;
    if (n[side] === 0 && SIDES.filter(s => s !== side).every(s => n[s] > 0)) {
      for (const s of SIDES) n[s] = Math.max(0, n[s] - 1); S.locked = true; this.say(`Lodestone Armor: 네 번째 Ward Node — 대신 모든 Node에서 Armor 토큰 1개씩 버림 (${this.smNodeText()}), Zone 2 기사 Knockback 2, 이번 Round 끝까지 토큰 획득 불가`, 'bp');
      const z = this.board.zone(M.cells, 2); for (const k of this.alive().filter(k => z.some(c => cellEq(c, k.pos)))) await this.knockback(k, 2);
      if (M.hasTrait('Uneven Footing')) S.pendingSig = true; return;
    }
    n[side]++; this.say(`Lodestone Armor: ${SIDE_KO[side]} 면 Ward Node에 Armor 토큰 (${this.smNodeText()})`, 'bp');
  },
  async smMagnetite() {
    if (!this.smCanGain()) return; const cnt = {}; for (const s of SIDES) cnt[s] = 0; for (const k of this.alive()) cnt[this.smSide(k.pos)]++; const m = Math.max(...SIDES.map(s => cnt[s])); const best = SIDES.filter(s => cnt[s] === m);
    const side = best.length > 1 ? await this.ask({ type: 'pick', text: 'Magnetite Reinforcement: 기사가 가장 많은 면 (동률)', options: best.map(s => ({ label: `${SIDE_KO[s]} (${cnt[s]}명)`, value: s })) }) || best[0] : best[0];
    this.sm.nodes[side] += 2; this.say(`Magnetite Reinforcement: ${SIDE_KO[side]} 면 Ward Node +2 (${this.smNodeText()})`, 'bp');
  },
  smImpervious(A) { if (!this.monster.hasTrait('Impervious Armor') || this.sm.flags.ignoreNodes || !this.sm.side) return false; if (this.sm.nodes[this.sm.side] >= 2) { this.say(`Impervious Armor: ${SIDE_KO[this.sm.side]} 면 Armor 토큰 ${this.sm.nodes[this.sm.side]}개 → 부상시킬 수 없음`, 'bp'); return true; } return false; },
  // ---------- Rubble ----------
  smRubbleAt(c) { const t = this.board.terrainAt(c); return !!(t && t.id === 'rubble'); },
  smTileCells(o) { return [o, { c: o.c + 1, r: o.r }, { c: o.c, r: o.r + 1 }, { c: o.c + 1, r: o.r + 1 }]; },
  smTileOk(cells, ignore = []) { const B = this.board, M = this.monster; return cells.every(c => B.inside(c) && !M.cells.some(m => cellEq(m, c)) && (!B.terrainAt(c) || this.smRubbleAt(c)) && !ignore.some(t => t.some(x => cellEq(x, c)))); },
  smSetTile(cells) { const B = this.board; for (const c of cells) B.terrain.set(B.key(c), { id: 'rubble', name: 'Rubble', obstacle: false, obscuring: false, destructible: false, chasm: false, difficult: true }); this.sm.tiles.push(cells); },
  smClearTile(t) { const B = this.board; this.sm.tiles = this.sm.tiles.filter(x => x !== t); for (const c of t) if (!this.sm.tiles.some(x => x.some(y => cellEq(y, c)))) B.terrain.delete(B.key(c)); },
  async smPlaceTile(cells, why) {
    const B = this.board, S = this.sm, M = this.monster; if (S.flags.noRubble) { this.say(`${why}: Rubble 배치 무시 (Ruinous Engine Critical)`); return false; }
    const before = new Map(this.alive().map(k => [k, this.smRubbleAt(k.pos)]));
    const hit = S.tiles.filter(t => t.some(c => cells.some(x => cellEq(x, c)))); for (const t of hit) this.smClearTile(t);
    this.smSetTile(cells); this.say(`${why}: Rubble 2x2 → ${cells.map(c => B.label(c)).join(', ')}`, 'ai');
    for (const old of hit) { // Architect of Destruction: re-place adjacent to the new tile via as many edges as possible
      const cands = []; for (let c = 1; c < B.cols; c++) for (let r = 0; r < B.rows - 1; r++) { const t = this.smTileCells({ c, r }); if (!this.smTileOk(t, S.tiles)) continue; const edges = t.reduce((s, x) => s + B.neighbors(x).filter(n => cells.some(y => cellEq(y, n))).length, 0); if (edges > 0) cands.push({ t, edges }); }
      if (!cands.length) { this.say('Architect of Destruction: 다시 놓을 자리 없음 — Rubble 타일 제거'); continue; } const m = Math.max(...cands.map(x => x.edges)); const best = cands.filter(x => x.edges === m);
      let pick = best[0]; if (best.length > 1) { const v = await this.ask({ type: 'pick', text: 'Architect of Destruction: 치운 Rubble 타일을 새 타일 옆에 다시 놓기 (동률)', options: best.map((x, i) => ({ label: x.t.map(c => B.label(c)).join('/'), value: i })) }); pick = best[v] || best[0]; }
      this.smSetTile(pick.t); this.say(`Architect of Destruction: 치운 Rubble → ${pick.t.map(c => B.label(c)).join(', ')}`);
    }
    if (M.hasTrait('Buried Alive')) for (const [k, was] of before) if (was && k.alive && cells.some(c => cellEq(c, k.pos))) { this.say(`Buried Alive: ${k.name} — 이미 Rubble 위 → Judicium`, 'bp'); await this.drawJudicium(k); }
    return true;
  },
  async smRuin(why = 'Ruin') { const M = this.monster; const f = DIRS[M.facing]; const fmax = Math.max(...M.cells.map(c => dot(c, f))); const front = M.cells.filter(c => dot(c, f) === fmax); const cells = [...front.map(c => ({ c: c.c + f.c, r: c.r + f.r })), ...front.map(c => ({ c: c.c + 2 * f.c, r: c.r + 2 * f.r }))];
    if (!this.smTileOk(cells)) { this.say(`${why}: 정면에 Rubble 2x2를 놓을 수 없음 (보드 밖/지형)`); return; } await this.smPlaceTile(cells, why); },
  async smRubbleUnder(k, why) { if (!k || !k.alive) return; const B = this.board; const c0 = this.monsterCenter(); const opts = [{ c: k.pos.c - 1, r: k.pos.r - 1 }, { c: k.pos.c, r: k.pos.r - 1 }, { c: k.pos.c - 1, r: k.pos.r }, { c: k.pos.c, r: k.pos.r }].map(o => this.smTileCells(o)).filter(t => this.smTileOk(t));
    if (!opts.length) { this.say(`${why}: ${k.name} 밑에 Rubble을 놓을 수 없음`); return; } const d = t => t.reduce((s, c) => s + Math.abs(c.c - c0.c) + Math.abs(c.r - c0.r), 0); const m = Math.min(...opts.map(d)); const best = opts.filter(t => d(t) === m);
    let t = best[0]; if (best.length > 1) { const v = await this.ask({ type: 'pick', text: `${why}: ${k.name} 밑 Rubble 2x2 위치 (Stonemason에 가장 가까운 위치, 동률)`, options: best.map((x, i) => ({ label: x.map(c => B.label(c)).join('/'), value: i })) }); t = best[v] || best[0]; }
    await this.smPlaceTile(t, why); },
  // ---------- Move Lateral ----------
  async smLateral(card, k) {
    const M = this.monster, B = this.board; if (!k || !k.alive) return; const z = card.ops.zoneDiagram; const cells0 = M.cells.map(c => ({ ...c })), f0 = M.facing;
    const hits = () => { M.facing = faceToward(M.cells, k.pos, M.facing); return this.bossDiagramCells(z).some(c => cellEq(c, k.pos)); };
    let best = null; for (let n = 0; n <= 13 && !best; n++) { const found = []; for (const d of n ? Object.values(DIRS) : [{ c: 0, r: 0 }]) { M.cells = cells0.map(c => ({ c: c.c + d.c * n, r: c.r + d.r * n })); if (M.cells.every(c => B.inside(c)) && !M.cells.some(c => cellEq(c, k.pos)) && hits()) found.push(d); } M.cells = cells0; M.facing = f0; if (found.length) best = { n, dirs: found }; }
    if (!best) { this.say('Move Lateral: 대상을 Zone에 넣을 수 있는 직선 이동 없음'); return; } if (!best.n) return;
    let d = best.dirs[0]; if (best.dirs.length > 1) { const nm = x => x.c > 0 ? '→' : x.c < 0 ? '←' : x.r > 0 ? '↑' : '↓'; const v = await this.ask({ type: 'pick', text: `Move Lateral ${best.n}칸 — 방향 (동률)`, options: best.dirs.map((x, i) => ({ label: nm(x), value: i })) }); d = best.dirs[v] || d; }
    let m = 0; for (let i = 0; i < best.n; i++) { const r = await this.monsterStep(d); if (r !== 'ok') break; m++; } await this.displaceKnightsUnderMonster(); this.say(`Move Lateral: ${m}칸 이동`, 'ai');
  },
  async smMetal(k, mode, n) {
    if (!k || !k.alive) return; if (mode !== 'unexhaust' && this.sm.flags.noGearExhaust && mode === 'exhaust' && this.currentAttack) { this.say(`${k.name}: AI의 Gear 소진 효과 무시 (Heavy Chain Critical)`); return; }
    const pool = () => k.gear.filter(g => !g.discarded && this.fx.gearTraits(k, g).includes('Metal') && (mode === 'unexhaust' ? g.exhausted : mode === 'exhaust' ? !g.exhausted : true)); const verb = { exhaust: '소진', discard: '버림', unexhaust: '소진 해제' }[mode];
    const apply = g => { if (mode === 'exhaust') g.exhausted = true; else if (mode === 'discard') g.discarded = true; else g.exhausted = false; this.say(`${k.name}: ${g.name} ${verb} (Metal)`, mode === 'unexhaust' ? 'tech' : 'dmg'); };
    if (n === 'all') { for (const g of pool()) apply(g); return; }
    for (let i = 0; i < n; i++) { const p = pool(); if (!p.length) { this.say(`${k.name}: ${verb}할 Metal Gear 없음`); return; } const nm = p.length === 1 ? p[0].name : await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Metal Trait Gear 1장 ${verb}`, options: p.map(g => ({ label: g.name, value: g.name })) }); apply(p.find(g => g.name === nm) || p[0]); }
  },
  async smPull(k, n) { if (!k || !k.alive) return; n = await this.reduceDragPull(k, n, 'Pull'); const B = this.board; let m = 0; for (let i = 0; i < n && !this.adjacentToMonster(k); i++) { const c0 = this.monsterCenter(); const opts = B.neighbors(k.pos).filter(c => B.inside(c) && !B.isObstacle(c) && !this.knightAt(c) && !this.monsterOccupies(c)); const d = c => Math.abs(c.c - c0.c) + Math.abs(c.r - c0.r); const best = opts.sort((a, b) => d(a) - d(b))[0]; if (!best || d(best) >= d(k.pos)) break; this.moveKnight(k, best); m++; } this.say(`${k.name} Pull ${n}: ${m}칸 → ${B.label(k.pos)}`); await this.smFerro(); },
  async smOp(o, ctx) {
    if (!this.isSm) return false; const M = this.monster, S = this.sm; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'smOnHit': if (ctx.hits > 0 && t && t.alive) for (const x of o.then) { if (!t.alive) break; await this.fx.runMonsterOp(x, ctx); } await this.smFerro(); return true;
      case 'smHits': { if (!t || !t.alive || !(ctx.hits > 0)) return true; let n = o.table[Math.min(o.table.length, ctx.hits) - 1] + (M.bonuses.vigorLoss || 0); const g = (ctx.gatesOn || []).find(x => x.op === 'smThree');
        if (g && ctx.hits >= 3) { if (g.n === 'die') { this.say(`${t.name}: Heat ${t.heat} ≥ 3, 3회 이상 명중 → YOU DIE`, 'death'); await this.die(t, this.lastAI ? this.lastAI.name : 'Pulverize'); return true; } n += g.n; this.say(`Heat ≥ 3 · 3회 이상 명중 → 추가 -${g.n}`); }
        await this.loseVigor(t, n, { source: 'attack', perilCheck: !!o.perilCheck }); return true; }
      case 'smBane': if (S.flags.noBane) { this.say('Bane 무시 (Splinter of Corrupted Purpose Critical)'); return true; } if (t && t.alive) await this.fx.runKnightOp({ op: 'bane', n: o.n }, t, {}); return true;
      case 'smMetal': { let mode = o.mode; if (mode === 'exhaust' && (ctx.gatesOn || []).some(x => x.op === 'smDiscardInstead')) { mode = 'discard'; this.say('Heat ≥ 3 → Discard instead'); } await this.smMetal(t, mode, o.n); return true; }
      case 'smHeat': if (t && t.alive) await this.fx.runKnightOp({ op: 'gainHeat', n: o.n }, t, {}); return true;
      case 'smPull': await this.smPull(t, o.n); return true;
      case 'smRuin': await this.smRuin(); return true;
      case 'smRubbleUnder': await this.smRubbleUnder(o.who === 'attacker' ? k : t, 'Rubble'); return true;
      case 'smRubbleSides': { const f0 = M.facing; for (const f of [f0, RIGHT[f0], BACK[f0], RIGHT[BACK[f0]]]) { M.facing = f; await this.smRuin('Ruinous Engine'); } M.facing = f0; return true; }
      case 'smMarch': { if (ctx.repeated || S.marching) return true; S.marching = true; try { const card = this.lastAI; const done = new Set([t]); while (card) { const rest = this.alive().filter(x => !done.has(x)); if (!rest.length) break; const c0 = this.monsterCenter(); const d = x => Math.abs(x.pos.c - c0.c) + Math.abs(x.pos.r - c0.r); const x = rest.sort((a, b) => d(a) - d(b))[0]; done.add(x); this.say(`${card.name}: 다음 대상 ${x.name}`, 'ai'); await this.resolveMonsterAttack({ ...card, ops: { ...card.ops, afterFinalAttack: null } }, { forceTarget: x, repeated: true }); } } finally { S.marching = false; } return true; }
      case 'smZoneKnockdown': { const z = this.board.zone(M.cells, o.z); for (const x of this.alive().filter(x => z.some(c => cellEq(c, x.pos)))) await this.knockdown(x); return true; }
      case 'smFlag': S.flags[o.id] = true; this.say({ noGearExhaust: 'Clash 종료까지 AI 카드의 Gear 소진 효과 무시 가능', noRubble: 'Clash 종료까지 Ruin Trait와 Rubble 배치 무시', ignoreNodes: 'Clash 종료까지 공격 시 Ward Node의 Armor 토큰 무시', noBane: "Stonemason의 Bane X 키워드 비활성", noGates: 'Clash 종료까지 모든 기사가 Gated Effect 무시' }[o.id] || o.id, 'tech'); return true;
      case 'smNoToken': S.noToken = true; this.say('이번 공격 후 Armor 토큰을 놓지 않음', 'tech'); return true;
      case 'smDiscardNode': { const have = SIDES.filter(s => S.nodes[s] > 0); if (!have.length) return true; const v = await this.ask({ type: 'pick', text: 'Ward Node 하나에서 Armor 토큰 1개 버리기 (선택)', options: [...have.map(s => ({ label: `${SIDE_KO[s]} (${S.nodes[s]})`, value: s })), { label: '안 함', value: 'skip' }] }); if (v && v !== 'skip') { S.nodes[v]--; this.say(`Ward Node ${SIDE_KO[v]} 토큰 -1 (${this.smNodeText()})`, 'tech'); } return true; }
      case 'smClearNodes': for (const s of SIDES) S.nodes[s] = 0; S.lockKR = true; this.say('모든 Ward Node의 Armor 토큰 버림 — Knight Round 끝까지 토큰 획득 불가', 'tech'); return true;
      case 'smMoveBonus': { let x = k; if (o.who === 'other') { const others = this.alive().filter(y => y !== k); if (!others.length) return true; const id = await this.ask({ type: 'pick', text: `다른 기사 1명: 최대 ${o.n}칸 이동 후 Bonus Attack (선택)`, options: [...others.map(y => ({ label: y.name, value: y.id })), { label: '안 함', value: 'skip' }] }); x = others.find(y => y.id === id); if (!x) return true; } if (!x || !x.alive) return true; if (await this.yesNo(`${x.name}: 최대 ${o.n}칸 이동?`, false)) await this.knightMove(x, o.n); if (x.alive && this.canAttack(x) && await this.yesNo(`${x.name}: Bonus Attack 수행?`, true)) await this.knightAttack(x, { bonus: true }); return true; }
      case 'smBonusNoLodestone': if (k && k.alive && this.canAttack(k) && await this.yesNo(`${k.name}: Bonus Attack 수행 (Lodestone Armor 무시)?`, true)) { const s = S.side; S.side = null; try { await this.knightAttack(k, { bonus: true, smNoLodestone: true }); } finally { S.side = s; } } return true;
      case 'smRoutine': for (const x of this.alive()) { await this.smMetal(x, 'exhaust', 1); if (!S.flags.noBane) await this.fx.runKnightOp({ op: 'bane', n: 1 }, x, {}); } return true;
      case 'smNote': this.say(o.text, 'warn'); return true;
      default: return false;
    }
  },
};
export const SM_OPS = ['smOnHit', 'smHits', 'smBane', 'smMetal', 'smHeat', 'smPull', 'smRuin', 'smRubbleUnder', 'smRubbleSides', 'smMarch', 'smZoneKnockdown', 'smFlag', 'smNoToken', 'smDiscardNode', 'smClearNodes', 'smMoveBonus', 'smBonusNoLodestone', 'smRoutine', 'smNote', 'smThree', 'smDiscardInstead'];
