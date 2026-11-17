// Knighteater (Vassal Clash): Fleisch tokens / Wolf Down / Berserk (Starved Slaughterman, Frenzied Hunger), Meatbait, Measured Movement,
// Kingdom Traits (Iron Confines / Adaptable), Brute, Glutton (Ultrainstinct), Living Up to the Name, Feral Guard.
import { DIRS, faceToward, rearCells } from './board.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const PERIL = { Uninjured: 0, Minor: 1, Major: 2, Grave: 3, Judicium: 4 };

export const EaterMixin = {
  keSetup(cs) {
    const M = this.monster, B = this.board, C = this; this.isKe = true; const kt = this.monsterDef.ke.kingdomTrait[this.kingdom] || 'Iron Confines'; M.traits.add(kt);
    this.ke = { berserk: false, armor: 0, brute: 0, flags: {}, under: new Map(), touched: false, kingdom: kt, pendingSig: false, judDevour: null };
    const bottom = this.mortis.Minor.cards.at(-1); const arrow = bottom && bottom.marker && bottom.marker.arrow; M.facing = arrow === 'left' || arrow === 'right' ? 'W' : 'S'; this.say(`Knighteater 방향 ${M.facing} (Minor Mortis 바닥 화살표: ${arrow}) · Kingdom Trait: ${kt}`);
    let pt = this.priorityTarget; Object.defineProperty(this, 'priorityTarget', { configurable: true, get() { return C.ke.berserk ? null : pt; }, set(v) { if (C.ke.berserk && !C.ke._force) return; pt = v; } });
    const at = this.bpAT.bind(this); this.bpAT = bp => at(bp) + (C.ke.flags.noArmor ? 0 : C.ke.armor);
    const ms = this.monsterStep.bind(this); this.monsterStep = async (d, o) => { // Measured Movement: Terrain is not destroyed
      const nc = M.cells.map(x => ({ c: x.c + d.c, r: x.r + d.r })); if (nc.every(x => B.inside(x))) for (const x of nc) { const t = B.terrainAt(x); if (t) C.ke.touched = true; if (t && t.obstacle && t.destructible) { C.ke.under.set(B.key(x), t); B.terrain.delete(B.key(x)); } }
      const r = await ms(d, o); C.keRestore(false); return r; };
    const rma = this.resolveMonsterAttack.bind(this); this.resolveMonsterAttack = async (card, ctx) => { try { return await rma(card, ctx); } finally { C.ke.judDevour = null; await C.keSettle(); } };
    const dj = this.drawJudicium.bind(this); this.drawJudicium = async k => { if (C.ke.judDevour === k && !C.ke._inDevour) { C.say(`${k.name}: 이 공격으로 Judicium을 뽑게 됨 → devoured`, 'death'); return C.keDevour(k, 'Offal Harvest'); } return dj(k); };
    const ac = this.addCondition.bind(this); this.addCondition = async (k, id, o) => { if (C.ke.flags.noFear && (id === 'Fear' || id === 'Dread')) { C.say(`${k.name}: ${id} Condition 획득 비활성 (Grim Visage Critical)`); return; } return ac(k, id, o); };
    const cr = this.crash.bind(this); this.crash = async (k, o) => { if (C.ke.flags.tumble) { const d = C.rng.die(10); C.say(`${k.name} Tumble (Tarnished Sabatons Critical): d10 ${d} → ${d >= 6 ? 'Crash 무시' : '실패'}`, 'dice'); if (d >= 6) return; } return cr(k, o); };
    const ka = this.knightAttack.bind(this); this.knightAttack = async (k, opts) => { // Meatbait
      let bait = false; if (M.hasTrait('Meatbait') && k.alive && !C.ke._bait && await C.yesNo(`${k.name}: Meatbait — Precision -2로 공격하고 Fleisch 토큰 ${M.level}개를 Knight Pool에?`, false)) { bait = true; k.permPrecision = (k.permPrecision || 0) - 2; C.ke._bait = true; C.poolAdd('fleisch', M.level); }
      try { return await ka(k, opts); } finally { if (bait) { k.permPrecision += 2; C.ke._bait = false; } if (C.ke.pendingSig && !C.result && !M.slain) { C.ke.pendingSig = false; await C.guard(() => C.keBruteSig()); } } };
    const mr = this.monsterRound.bind(this); this.monsterRound = async () => { if (kt === 'Iron Confines' && !C.ke.berserk) { C.say('Iron Confines: Monster Round 시작 — Berserk 아님 → Armor 토큰 +1', 'bp'); C.keArmor(1); if (C.ke.pendingSig) { C.ke.pendingSig = false; await C.guard(() => C.keBruteSig()); } } await mr(); if (C.ke.pendingSig && !C.result) { C.ke.pendingSig = false; await C.guard(() => C.keBruteSig()); } };
  },
  /** Starved Slaughterman — Additional Setup (called once before the first Round). */
  async keStart() { if (!this.isKe || this.ke.started) return; this.ke.started = true; for (const k of this.alive()) { if (!await this.yesNo(`${k.name}: Starved Slaughterman — Peril check를 수행하고 Fleisch 토큰 1개를 Knight Pool에? (긍정 Mortis는 효과 무시)`, false)) continue; this.ke.setupPeril = true; try { await this.perilCheck(k); } finally { this.ke.setupPeril = false; } this.poolAdd('fleisch', 1); } },
  keRestore(final) { const B = this.board, M = this.monster; for (const [key, t] of [...this.ke.under]) { const [c, r] = key.split(',').map(Number); const cell = { c, r }; const underM = M.cells.some(m => cellEq(m, cell)); if (!underM) { B.terrain.set(key, t); this.ke.under.delete(key); } else if (final) { this.ke.under.delete(key); const free = []; for (const m of M.cells) for (const n of B.neighbors(m)) if (B.inside(n) && !M.cells.some(x => cellEq(x, n)) && !B.terrainAt(n) && !this.knightAt(n) && !free.some(x => cellEq(x, n))) free.push(n); const d = x => Math.abs(x.c - c) + Math.abs(x.r - r); free.sort((a, b) => d(a) - d(b)); if (free.length) { B.terrain.set(B.key(free[0]), t); this.say(`Measured Movement: ${t.id} ${B.label(cell)} → ${B.label(free[0])}`, 'bp'); } else this.say(`Measured Movement: ${t.id}를 옮길 빈 칸 없음 — 제거`); } } },
  /** End of a Knighteater movement: Columns under it are moved, Adaptable places a Swamp in its Blindspot. */
  async keSettle() { if (!this.isKe) return; const B = this.board, M = this.monster; this.keRestore(true); if (this.ke.touched) { this.ke.touched = false; if (this.ke.kingdom === 'Adaptable') { const cells = rearCells(B, M.cells, M.facing).filter(c => B.inside(c) && !B.terrainAt(c)); for (const c of cells) B.terrain.set(B.key(c), { id: 'swamp', name: 'Swamp', obstacle: false, chasm: false, difficult: true }); if (cells.length) this.say(`Adaptable: Blindspot에 Swamp 1x2 → ${cells.map(c => B.label(c)).join(', ')}`, 'bp'); } } },
  keArmor(n) { const S = this.ke; if (n > 0) { S.armor += n; this.say(`Knighteater Armor 토큰 +${n} (${S.armor})`, 'bp'); if (this.monster.hasTrait('Brute')) this.keBrute(n); } else { const x = Math.min(S.armor, -n); S.armor -= x; this.say(`Knighteater Armor 토큰 -${x} (${S.armor})`, 'tech'); } },
  keBrute(n) { const S = this.ke; if (!this.monster.hasTrait('Brute')) return; S.brute += n; this.say(`Brute: Generic 토큰 ${S.brute}/3`, 'bp'); if (S.brute >= 3) S.pendingSig = true; },
  async keBruteSig() { const S = this.ke; S.brute = 0; S.armor = 0; this.say('Brute: Generic 토큰과 Armor 토큰 전부 버림 → Signature', 'bp'); await this.performSignature(); },
  async keDevour(k, why) { if (!k || !k.alive) return; if (this.ke.flags.noDeath) { this.say(`${k.name}: devoured → Judicium Draw (Cannibal’s Mouthpiece Critical)`); this.ke._inDevour = true; try { await this.drawJudicium(k); } finally { this.ke._inDevour = false; } return; } this.say(`${k.name}: devoured (${why})`, 'death'); await this.die(k, why || 'devoured'); },
  keAdjacent() { return this.alive().filter(k => this.adjacentToMonster(k)); },
  async keBerserk(on) {
    const S = this.ke, M = this.monster; if (S.berserk === on) return; S._force = true; 
    if (on) { S.berserk = true; this.say('Knighteater Berserk! — Priority Target 토큰은 Knighteater Sheet로', 'ai'); S._force = false; return; }
    S.berserk = false; const al = this.alive(); if (al.length) { const m = Math.max(...al.map(k => k.passion)); const best = al.filter(k => k.passion === m); let k = best[0]; if (best.length > 1) { const id = await this.ask({ type: 'pickKnight', text: 'Berserk 종료 — Passion 동률, Priority Target 선택', options: best.map(x => ({ label: x.name, value: x.id })) }); k = best.find(x => x.id === id) || k; } this.priorityTarget = k; this.say(`Knighteater Berserk 종료 — ${k.name} Priority Target`, 'ai'); } S._force = false;
    if (S.kingdom === 'Iron Confines') { this.say('Iron Confines: Berserk 종료 → Armor 토큰 +1', 'bp'); this.keArmor(1); }
    if (this.currentAttack) { const e = new Error('Berserk 종료 — 공격 Chain Break'); e.chainBreak = true; throw e; }
  },
  /** Wolf Down X. */
  async keWolf(x) {
    const S = this.ke, M = this.monster; if (S.flags.noWolf) { this.say('Wolf Down 비활성 (Famished Maw Critical)'); return; } if (!(x > 0)) return; const got = this.poolTake('fleisch', x); this.say(`Wolf Down ${x}: Fleisch 토큰 ${got}개 버림${got < x ? ' (부족)' : ''}`, 'ai');
    if (!S.berserk) { if (got < x) await this.keBerserk(true); else this.keArmor(1); return; }
    if (got >= x) { this.keArmor(1); await this.keBerserk(false); return; }
    const adj = this.keAdjacent(); if (!adj.length) { this.say('Wolf Down: 인접한 기사 없음'); return; } const k = this.rng.pick(adj);
    if (M.hasTrait('Living Up to the Name')) { this.say(`Living Up to the Name: ${k.name} (무작위 인접 기사) devoured`, 'bp'); await this.keDevour(k, 'Living Up to the Name'); await this.keBerserk(false); }
    else { this.say(`Wolf Down: ${k.name} (무작위 인접 기사) Vigor -${x}`, 'ai'); await this.loseVigor(k, x, { source: 'attack' }); }
  },
  keFeral(A) { if (this.monster.hasTrait('Feral Guard') && this.ke.berserk) { this.say('Feral Guard: Berserk 상태 — 부상시킬 수 없음', 'bp'); return true; } return false; },
  /** Ultrainstinct (after the BP is determined, before the Power Roll). Returns true when the Knight voluntarily ends the Attack. */
  async keUltra(k, A, bp) {
    const S = this.ke, ops = bp.ops; S.w0 = this.monster.wounds; if (ops.ultra && !S.flags.noUltra && !S.flags.ultraToInstinct && !A.critChance) { this.say('Ultrainstinct', 'bp'); try { await this.fx.runMonsterOps(ops.ultra, { attacker: k, attack: A }); } catch (e) { if (!e.chainBreak) throw e; } }
    if (ops.mayEnd && k.alive && await this.yesNo(`${k.name}: ${bp.name} — Power Roll 전에 이 공격을 자발적으로 끝내기? (Knight Pool의 모든 토큰 제거)`, false)) { this.pool = []; this.say(`${k.name}: 공격을 끝냄 — Knight Pool 비움`, 'tech'); return true; }
    return false;
  },
  async keAfterResponses(k, A) { const S = this.ke, bp = A.bp; if (bp && bp.ops.ultra && S.flags.ultraToInstinct && !S.flags.noUltra && !A.critical) { this.say('Ultrainstinct → Instinct', 'bp'); await this.fx.runMonsterOps(bp.ops.ultra, { attacker: k, attack: A }); } const dw = this.monster.wounds - (S.w0 ?? this.monster.wounds); S.w0 = null; if (dw > 0) this.keBrute(dw); },
  async keShift(d, n, { stop = true, drag = null } = {}) { const M = this.monster, B = this.board; let m = 0; for (let i = 0; i < n; i++) { const nc = M.cells.map(x => ({ c: x.c + d.c, r: x.r + d.r })); if (!nc.every(x => B.inside(x))) break; if (stop && nc.some(x => { const t = B.terrainAt(x); return (t && t.obstacle) || (this.knightAt(x) && this.knightAt(x) !== drag); })) break; if (drag && nc.some(x => cellEq(x, drag.pos))) break; const r = await this.monsterStep(d); if (r !== 'ok') break; m++; if (drag && drag.alive) { const nk = { c: drag.pos.c + d.c, r: drag.pos.r + d.r }; if (B.inside(nk) && !B.isObstacle(nk) && !this.knightAt(nk) && !M.cells.some(x => cellEq(x, nk))) this.moveKnight(drag, nk); } } return m; },
  keDirAway(pos) { const d = this.dirFromMonster(pos); return { c: -d.c, r: -d.r }; },
  async keDrag(k, n) { if (!k || !k.alive || !this.adjacentToMonster(k)) { this.say('Drag 무시 (비인접)'); return; } n = await this.reduceDragPull(k, n, 'Drag'); const m = await this.keShift(this.keDirAway(k.pos), n, { stop: true, drag: k }); this.say(`Drag ${n}: Knighteater와 ${k.name} ${m}칸 → ${this.board.label(k.pos)}`, 'ai'); await this.keSettle(); },
  async keVault(k, crashToPeril) {
    const B = this.board, M = this.monster; if (!k || !k.alive || !this.adjacentToMonster(k)) return; const d = this.dirFromMonster(k.pos); const back = { c: -d.c, r: -d.r }; let c = { ...k.pos }; for (let i = 0; i < 4; i++) { c = { c: c.c + back.c, r: c.r + back.r }; if (!M.cells.some(m => cellEq(m, c))) break; }
    const t = B.inside(c) && B.terrainAt(c); if (!B.inside(c) || (t && t.obstacle && !t.destructible)) { this.say(`${k.name}: Forced Vault — 보드 밖/파괴 불가 Obstacle → 사망`, 'death'); await this.die(k, 'Forced Vault'); return; }
    const blocked = (t && t.obstacle) || this.knightAt(c); if (blocked) { if (crashToPeril) { this.say(`${k.name}: Forced Vault가 Crash를 일으킴 → 대신 Peril check`); await this.perilCheck(k); return; } if (t && t.obstacle) B.terrain.delete(B.key(c)); this.say(`${k.name}: Forced Vault → Crash`); if (this.knightAt(c)) { await this.crash(k); return; } this.moveKnight(k, c); await this.crash(k); return; }
    this.moveKnight(k, c); this.say(`${k.name}: Forced Vault → ${B.label(c)}`, 'ai'); if (t && t.id === 'rubble') await this.knockdown(k);
  },
  async keAppearBehind(k) {
    const B = this.board, M = this.monster; const c0 = this.monsterCenter(); const cands = []; for (let c = 1; c < B.cols; c++) for (let r = 0; r < B.rows - 1; r++) { const cells = [{ c, r }, { c: c + 1, r }, { c, r: r + 1 }, { c: c + 1, r: r + 1 }]; if (cells.some(x => this.knightAt(x)) || !B.footprintsAdjacent([k.pos], cells)) continue; if (cells.some(x => { const t = B.terrainAt(x); return t && t.obstacle && !t.destructible; })) continue; cands.push({ cells, d: Math.abs(c + 0.5 - c0.c) + Math.abs(r + 0.5 - c0.r) }); }
    if (!cands.length) { this.say('Appear Behind: 놓을 자리 없음'); return; } const m = Math.max(...cands.map(x => x.d)); const best = cands.filter(x => x.d === m); let p = best[0]; if (best.length > 1) { const v = await this.ask({ type: 'pick', text: `Appear Behind — ${k.name}에 인접한 가장 먼 위치 (동률)`, options: best.map((x, i) => ({ label: x.cells.map(c => B.label(c)).join('/'), value: i })) }); p = best[v] || p; }
    for (const x of p.cells) { const t = B.terrainAt(x); if (t) this.ke.touched = true; if (t && t.obstacle && t.destructible) { this.ke.under.set(B.key(x), t); B.terrain.delete(B.key(x)); } }
    B.remove(M.cells); M.cells = p.cells; B.place({ kind: 'monster', id: M.id }, M.cells); this.turnToward(k.pos); this.say(`Knighteater Appear Behind → ${p.cells.map(c => B.label(c)).join('/')}`, 'ai'); await this.keSettle();
  },
  async keGear(k, mode, type, perilToExhaust) {
    if (!k || !k.alive) return; const ok = g => !g.discarded && (type === 'all' ? !g.exhausted : g.type === type && (mode === 'discard' || !g.exhausted)); const pool = k.gear.filter(ok); const tn = { armor: 'Armor', weapon: 'Weapon', all: '소진 가능한 모든' }[type];
    if (!pool.length) { this.say(`${k.name}: ${mode === 'discard' ? '버릴' : '소진할'} ${tn} Gear 없음`); return; }
    if (type === 'all') { for (const g of pool) g.exhausted = true; this.say(`${k.name}: Gear ${pool.map(g => g.name).join(', ')} 소진`, 'dmg'); return; }
    const nm = pool.length === 1 ? pool[0].name : await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: ${tn} Gear 1장 ${mode === 'discard' ? '버리기' : '소진'}`, options: pool.map(g => ({ label: g.name, value: g.name })) }); const g = pool.find(x => x.name === nm) || pool[0];
    if (mode === 'discard' && perilToExhaust && !g.exhausted && await this.yesNo(`${k.name}: ${g.name}을 버리는 대신 Peril check를 하고 소진?`, false)) { await this.perilCheck(k); g.exhausted = true; this.say(`${k.name}: ${g.name} 소진 (Peril check)`, 'dmg'); return; }
    if (mode === 'discard') g.discarded = true; else g.exhausted = true; this.say(`${k.name}: ${g.name} ${mode === 'discard' ? '버림' : '소진'}`, 'dmg');
  },
  async keOp(o, ctx) {
    if (!this.isKe) return false; const M = this.monster, S = this.ke, B = this.board; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'keOnHit': if (ctx.hits > 0 && t && t.alive) for (const x of o.then) { if (!t.alive) break; await this.fx.runMonsterOp(x, ctx); } return true;
      case 'kePerHit': for (let i = 0; i < (ctx.hits || 0) && t && t.alive; i++) for (const x of o.then) { if (!t.alive) break; await this.fx.runMonsterOp(x, ctx); } return true;
      case 'keIfHits': if ((ctx.hits || 0) >= o.gte && t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'keIfSurvived': if (t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'keHits': { if (!t || !t.alive || !(ctx.hits > 0)) return true; const v = o.table[Math.min(o.table.length, ctx.hits) - 1]; if (v === 'devour') { this.say(`${t.name}: ${ctx.hits}회 명중 → Vigor 0, devoured`, 'death'); t.vigor = 0; await this.keDevour(t, this.lastAI ? this.lastAI.name : 'devoured'); return true; } await this.loseVigor(t, v + (M.bonuses.vigorLoss || 0), { source: 'attack', perilCheck: true }); return true; }
      case 'keDevourOnHit': if (t && t.alive && ctx.hits > 0) { t.vigor = 0; await this.keDevour(t, this.lastAI ? this.lastAI.name : 'devoured'); } return true;
      case 'keJudDevour': S.judDevour = t; return true;
      case 'keWolf': { if (o.minLevel && M.level < o.minLevel) return true; await this.keWolf(o.n === 'level' ? M.level : o.n === 'fleisch' ? this.poolCount('fleisch') : o.n); return true; }
      case 'keGatedWolf': { const g = (ctx.attack && ctx.attack.keGates || []).find(x => x.op === 'keAfterWolf'); if (g) await this.keWolf(g.n); return true; }
      case 'keCondition': if (t && t.alive) await this.addCondition(t, o.id); return true;
      case 'keDrag': await this.keDrag(t, o.n); return true;
      case 'keVault': await this.keVault(t, o.crashToPeril); return true;
      case 'keGear': await this.keGear(t, o.mode, o.type, o.perilToExhaust); return true;
      case 'keArmor': this.keArmor(o.n); return true;
      case 'keFleisch': this.poolAdd('fleisch', o.n); return true;
      case 'keFleischUpTo': { const n = await this.ask({ type: 'number', knight: k && k.id, text: `Fleisch 토큰을 Knight Pool에 놓기 (최대 ${o.n})`, default: o.n, options: Array.from({ length: o.n + 1 }, (_, i) => ({ label: String(i), value: i })) }); if (n > 0) this.poolAdd('fleisch', n); return true; }
      case 'keAway': { const from = o.from === 'target' ? t : k; if (!from || !from.pos) return true; const m = await this.keShift(this.keDirAway(from.pos), o.n, { stop: o.stop !== false }); this.say(`Knighteater ${from.name} 반대쪽으로 ${m}칸 이동 (방향 유지)`, 'ai'); await this.displaceKnightsUnderMonster(); await this.keSettle(); return true; }
      case 'kePushback': { if (!k || !k.alive) return true; const d = this.dirFromMonster(k.pos); let m = 0; for (let i = 0; i < o.n; i++) { const c = { c: k.pos.c + d.c, r: k.pos.r + d.r }; if (!B.inside(c) || B.isObstacle(c) || this.knightAt(c) || M.cells.some(x => cellEq(x, c))) break; this.moveKnight(k, c); m++; } this.say(`${k.name} Pushback ${o.n} (Obstacle 앞에서 멈춤): ${m}칸 → ${B.label(k.pos)}`, 'ai'); return true; }
      case 'keForward': { const m = await this.keShift(DIRS[M.facing], o.n, { stop: false }); await this.displaceKnightsUnderMonster(); if (k && k.pos) this.turnToward(k.pos); this.say(`Knighteater 정면으로 ${m}칸 이동 후 공격자를 향함`, 'ai'); await this.keSettle(); return true; }
      case 'keRandomMove': { const d = this.rng.pick(Object.values(DIRS)); const m = await this.keShift(d, o.n, { stop: false }); await this.displaceKnightsUnderMonster(); this.say(`Knighteater 무작위 방향으로 ${m}칸 이동`, 'ai'); await this.keSettle(); return true; }
      case 'keFaceAttacker': if (k && k.pos) this.turnToward(k.pos); return true;
      case 'keSettle': await this.displaceKnightsUnderMonster(); await this.keSettle(); return true;
      case 'keOtherSide': { if (!t || !t.alive) return true; const d = this.dirFromMonster(t.pos); const o1 = { c: t.pos.c + d.c, r: t.pos.r + d.r }; const opts = [o1, { c: o1.c - (d.r ? 1 : 0), r: o1.r - (d.c ? 1 : 0) }].map(x => { const base = { c: d.c < 0 ? x.c - 1 : x.c, r: d.r < 0 ? x.r - 1 : x.r }; return [base, { c: base.c + 1, r: base.r }, { c: base.c, r: base.r + 1 }, { c: base.c + 1, r: base.r + 1 }]; }).filter(cs => cs.every(c => B.inside(c) && !this.knightAt(c) && !(B.terrainAt(c) && B.terrainAt(c).obstacle && !B.terrainAt(c).destructible)) && B.footprintsAdjacent([t.pos], cs));
        if (!opts.length) { this.say('Playing with Your Food: 반대편에 놓을 자리 없음'); return true; } const cs = opts[0]; for (const x of cs) { const tt = B.terrainAt(x); if (tt) S.touched = true; if (tt && tt.obstacle && tt.destructible) { S.under.set(B.key(x), tt); B.terrain.delete(B.key(x)); } } B.remove(M.cells); M.cells = cs; B.place({ kind: 'monster', id: M.id }, cs); this.turnToward(t.pos); this.say(`Knighteater → ${t.name}의 반대편 (${cs.map(c => B.label(c)).join('/')})`, 'ai'); await this.keSettle(); return true; }
      case 'keKnockbackRandom': if (t && t.alive) { const d = this.rng.pick(Object.values(DIRS)); this.say(`Knockback ${o.n} — 무작위 방향`); await this.knockback(t, o.n, { dir: d, unavoidable: true }); } return true;
      case 'keDreadLoS': for (const x of this.alive()) if (this.losTo(x) || x === t) await this.addCondition(x, 'Dread'); return true;
      case 'kePriority': if (k && k.alive) { this.priorityTarget = k; this.say(S.berserk ? `${k.name}: Priority Target 토큰 — Berserk 중이라 얻을 수 없음` : `${k.name}: Priority Target 토큰 획득`); } return true;
      case 'keFlag': { S.flags[o.id] = true; if (o.id === 'noFear') for (const x of this.alive()) x.conditions = x.conditions.filter(c => c.id !== 'Fear' && c.id !== 'Dread'); if (o.id === 'noArmor') S.armor = 0; this.say({ tumble: '모든 기사가 Clash 종료까지 Tumble 획득', noFear: '모든 기사의 Fear·Dread 버림 — 이후 획득 불가', noDeath: '모든 즉사 효과가 Judicium Draw로 바뀜', ultraToInstinct: '모든 Ultrainstinct Response가 Instinct Response로 바뀜', noWolf: 'Wolf Down X 키워드 비활성', noUltra: 'Ultrainstinct Response 비활성', noArmor: 'Armor 토큰 비활성' }[o.id] || o.id, 'tech'); return true; }
      case 'keCalm': await this.keBerserk(false); return true;
      case 'keAdjacentDevour': { if (!k || !k.alive) return true; if (!this.adjacentToMonster(k)) { this.turnToward(k.pos); await this.monsterMoveToward(k); await this.keSettle(); } this.say(`Knighteater가 ${k.name}에게 인접 — devoured`, 'ai'); await this.keDevour(k, this.lastBP ? this.lastBP.name : 'devoured'); return true; }
      case 'keAdjacentFear': for (const x of this.keAdjacent()) await this.addCondition(x, 'Fear'); return true;
      case 'keRoutine': { const n = this.poolTake('fleisch', 99); this.say(`The Devouring: Fleisch 토큰 ${n}개 전부 버림`, 'ai'); const al = this.alive(); if (!al.length) return true; const c0 = this.monsterCenter(); const d = x => Math.abs(x.pos.c - c0.c) + Math.abs(x.pos.r - c0.r); const x = al.sort((a, b) => d(a) - d(b))[0]; if (!this.adjacentToMonster(x)) { this.turnToward(x.pos); await this.monsterMoveToward(x); await this.keSettle(); } for (const y of this.keAdjacent()) await this.keDevour(y, 'The Devouring'); return true; }
      case 'keNote': this.say(o.text, 'warn'); return true;
      default: return false;
    }
  },
};
export const KE_OPS = ['keOnHit', 'kePerHit', 'keIfHits', 'keIfSurvived', 'keHits', 'keDevourOnHit', 'keJudDevour', 'keWolf', 'keGatedWolf', 'keCondition', 'keDrag', 'keVault', 'keGear', 'keArmor', 'keFleisch', 'keFleischUpTo', 'keAway', 'kePushback', 'keForward', 'keRandomMove', 'keFaceAttacker', 'keSettle', 'keOtherSide', 'keKnockbackRandom', 'keDreadLoS', 'kePriority', 'keFlag', 'keCalm', 'keAdjacentDevour', 'keAdjacentFear', 'keRoutine', 'keNote', 'keNoteGate', 'keAfterWolf'];
