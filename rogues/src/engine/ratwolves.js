// Ratwolves (Mob Clash): Strength of the Pack (Toughness tokens, Immediate Spawn + Signature), Rising Pressure, Go for the Weakest Link,
// Drag traits (Relentless Pull, Into the Chittering Shadows, Kinderfänger, Ravening Ratswarm), Rat King, Kingdom Traits (Afflict, Adaptability).
import { GameOver } from './core.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;

export const RatMixin = {
  ratSetup() {
    const M = this.monster, D = this.monsterDef; this.isRat = true; const kt = D.rat.kingdomTrait[this.kingdom] || D.rat.kingdomTrait.sunken; M.traits.add(kt); this.ratKingdom = kt; this.ratPending = [];
    this.say(`Kingdom Trait: ${kt} (Afflict X = ${kt === 'Parasite Bed' ? 'Parasitize' : 'Poison'} X)`);
    const fx = this.fx, C = this; const run = fx.runKnightOp.bind(fx);
    fx.runKnightOp = async (o, k, ctx) => {
      if (!k || !k.conditions) return run(o, k, ctx);
      // Rat King: Condition cards with Condition tokens cannot be discarded unless adjacent to another Knight
      let held = null; if (M.hasTrait('Rat King') && (o.op === 'discardCondition' || o.op === 'discardAllConditions') && k.pos && !C.alive().some(x => x !== k && C.board.adjacent(x.pos, k.pos))) { held = k.conditions.filter(c => c.tokens > 0); if (held.length) { k.conditions = k.conditions.filter(c => !held.includes(c)); C.say(`Rat King: ${k.name} — 다른 기사와 인접하지 않아 토큰이 있는 Condition은 버릴 수 없음`, 'bp'); } }
      const t0 = C.condTokens(k); const r = await run(o, k, ctx); if (held && held.length) k.conditions.push(...held);
      const gain = C.condTokens(k) - t0; if (gain > 0 && k.alive && M.hasTrait('Rising Pressure')) { C.say(`Rising Pressure: ${k.name} Condition 토큰 +${gain} → Heat +${gain}`, 'bp'); await run({ op: 'gainHeat', n: gain }, k, {}); }
      return r;
    };
    const arg = fx.armorRollGear.bind(fx); fx.armorRollGear = async (k, r) => { let mit = await arg(k, r); if (M.hasTrait('Adaptability') && C.ratKingdom === 'Bile and Poison') { const x = Math.min(mit, C.condTokens(k)); if (x > 0) { mit -= x; C.say(`Adaptability (Bile and Poison): ${k.name} Armor Roll 기호 ${x}개 무시`, 'bp'); } } return mit; };
    const pc = this.perilCheck.bind(this); this.perilCheck = async k => { const r = await pc(k); if (k.alive && M.hasTrait('Adaptability') && C.ratKingdom === 'Parasite Bed') { const n = C.condTokens(k); if (n >= 2) { const op = n >= 4 ? 'delay' : 'cooldown'; C.say(`Adaptability (Parasite Bed): ${k.name} Condition 토큰 ${n} → ${op === 'delay' ? 'Delay' : 'Cooldown'}`, 'bp'); await run({ op }, k, {}); } } return r; };
  },
  condTokens(k) { return (k.conditions || []).reduce((s, c) => s + (c.id === 'Panzer Parasite' ? Math.max(0, (c.tokens || 0) - this.fx.parasiteIgnore(k)) : (c.tokens || 0)), 0); },
  /** Strength of the Pack: Generic tokens up to Toughness, then the Ratwolf dies. Returns the Wounds dealt. */
  ratWound(A) {
    const mob = A.mob, T = mob.card.toughness || 0; mob.gen = mob.gen || 0;
    if (mob.gen < T) { mob.gen++; A.ratToken = true; this.say(`Strength of the Pack: ${mob.card.name} #${mob.n} — Generic 토큰 ${mob.gen}/${T} (Wound 아님, Response는 Wound로 처리)`, 'bp'); return 0; }
    const lv = mob.card.level, n = mob.n, win = mob.card.ops.winOnDeath, name = mob.card.name; const w = this.killMob(mob); this.ratPending.push({ lv, n });
    if (win) { this.say(`${name} 사망 — You win!`, 'wound'); this.result = 'win'; throw new GameOver('win'); }
    return w;
  },
  ratEdge(c, shortOnly) { const B = this.board; const s = Math.min(c.c - 1, B.cols - c.c); return shortOnly ? s : Math.min(s, c.r, B.rows - 1 - c.r); },
  /** Place a Ratwolf adjacent to a random Knight, on the space closest to the (short) Board Edge without an Obstacle; Displace an occupant. */
  async ratPlace(place, shortOnly) {
    const B = this.board; const ks = this.alive(); if (!ks.length) return null; const k = this.rng.pick(ks);
    const cand = B.neighbors(k.pos).filter(c => B.inside(c) && !B.isObstacle(c)); if (!cand.length) return null;
    const m = Math.min(...cand.map(c => this.ratEdge(c, shortOnly))); const best = cand.filter(c => this.ratEdge(c, shortOnly) === m);
    let cell = best[0]; if (best.length > 1) cell = await this.ask({ type: 'move', text: `Ratwolf 배치: ${k.name}에 인접, ${shortOnly ? '짧은 ' : ''}Board Edge에 가장 가까운 칸 (동률)`, cells: best, options: best.map(c => ({ label: B.label(c), value: c })) }) || best[0];
    const ok = this.knightAt(cell), om = this.mobAt(cell);
    if (om) { this.board.remove(om.cells); om.cells = []; }
    const mob = place(cell);
    if (ok) { this.say(`${ok.name} Displace`); await this.displace(ok); }
    if (om) { await this.displaceMob(om, cell); if (!om.cells.length && this.monster.mobs.includes(om)) { const f = B.neighbors(cell).find(c => this.cellFree(c)); if (f) this.mobStepTo(om, f); } }
    return { mob, k, cell };
  },
  async ratDeaths() {
    if (!this.isRat || this._ratSpawning || !this.ratPending.length) return; this._ratSpawning = true;
    try { while (this.ratPending.length) { const { lv, n } = this.ratPending.shift(); const M = this.monster; const L = [lv + 1, ...Array.from({ length: lv }, (_, i) => lv - i)].find(l => M.bpPool[l] && M.bpPool[l].size);
      if (!L) { this.say('Strength of the Pack: 남은 BP 카드 없음 — Spawn 없음'); continue; } const slot = M.mobs.some(m => m.n === n) ? this.freeSlot() : n; if (!slot) continue;
      const r = await this.ratPlace(cell => this.addMob(M.bpPool[L].draw(), cell, 'N', slot), false); if (!r) continue;
      await this.withMob(r.mob, () => this.faceMostKnights()); this.say(`Strength of the Pack: 새 Ratwolf #${slot} (BP${L}) → ${this.board.label(r.cell)} (${r.k.name} 인접) — Signature`, 'ai');
      await this.withMob(r.mob, () => this.performSignature()); this.checkEnd(); } } finally { this._ratSpawning = false; }
  },
  async ratAfflict(k, n) { if (!k || !k.alive || n <= 0) return; const op = this.ratKingdom === 'Parasite Bed' ? 'parasitize' : 'poison'; this.say(`${k.name}: Afflict ${n} → ${op === 'poison' ? 'Poison' : 'Parasitize'} ${n}`); await this.fx.runKnightOp({ op, n }, k, {}); },
  /** Drag X performed by a Ratwolf. */
  async ratDrag(src, k, n) {
    const B = this.board, M = this.monster; if (!src || !src.cells.length || !M.mobs.includes(src) || !k || !k.alive) return; if (!B.adjacent(src.cells[0], k.pos)) { this.say('Drag 무시 (비인접)'); return; }
    n = await this.reduceDragPull(k, n, 'Drag'); if (M.hasTrait('Relentless Pull')) { const t = this.condTokens(k); if (t) { n += t; this.say(`Relentless Pull: Condition 토큰 ${t} → Drag ${n}`, 'bp'); } }
    const toShort = c => ({ c: c.c - 1 <= B.cols - c.c ? -1 : 1, r: 0 });
    let d = M.hasTrait('Into the Chittering Shadows') ? toShort(src.cells[0]) : { c: Math.sign(src.cells[0].c - k.pos.c), r: Math.sign(src.cells[0].r - k.pos.r) }; let m = 0;
    for (let i = 0; i < n && k.alive; i++) {
      let nx = { c: src.cells[0].c + d.c, r: src.cells[0].r + d.r };
      if (!B.inside(nx)) {
        if (d.c !== 0) { if (M.hasTrait('Ravening Ratswarm')) { this.say(`Ravening Ratswarm: ${k.name} — 짧은 Board Edge 밖으로 끌려감`, 'ai'); await this.die(k, 'Ravening Ratswarm'); B.remove(src.cells); src.cells = []; const r = await this.ratPlace(cell => { this.mobStepTo(src, cell); return src; }, true); if (r) { await this.withMob(src, () => this.faceMostKnights()); this.say(`Ratwolf #${src.n} → ${B.label(r.cell)}`); } return; } break; }
        d = toShort(src.cells[0]); nx = { c: src.cells[0].c + d.c, r: src.cells[0].r + d.r }; if (!B.inside(nx)) break;
      }
      if (this.knightAt(nx) === k) { const prev = src.cells[0]; B.remove(src.cells); src.cells = []; this.moveKnight(k, prev); this.mobStepTo(src, nx); m++; continue; } // the dragged Knight stands in the way: the Ratwolf passes and pulls them behind
      if (!this.cellFree(nx, src)) break; const prev = src.cells[0]; this.mobStepTo(src, nx); if (!this.knightAt(prev)) this.moveKnight(k, prev); m++;
    }
    this.turnTowardFor(src, k.pos); this.say(`Drag ${n}: Ratwolf #${src.n}와 ${k.name} ${m}칸 → ${B.label(k.pos)}`);
    if (k.alive && M.hasTrait('Kinderfänger') && this.isLone(k)) { this.say(`Kinderfänger: ${k.name} Lone Knight → Knockdown`, 'bp'); await this.knockdown(k); }
  },
  /** Revealed Famished Ratwolves: all other Ratwolves gain "Instinct: Poison 1". */
  async ratAfterResponses(k, A) { if (!A || !A.mob || A.critical || !k.alive) return; const n = this.monster.mobs.filter(m => m !== A.mob && m.revealed && m.card.ops.aura && m.card.ops.aura.ratInstinctPoison).length + (A.mob.dead ? 0 : 0); for (let i = 0; i < n && k.alive; i++) { this.say(`Famished Ratwolf: Instinct — ${k.name} Poison 1`, 'bp'); await this.fx.runKnightOp({ op: 'poison', n: 1 }, k, {}); } },
  async ratOp(o, ctx) {
    if (!this.isRat) return false; const M = this.monster; const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'ratCurseIfDied': if (t && !t.alive) { this.curseLevel = (this.curseLevel || 0) + o.n; this.say(`${t.name} 사망 → Curse +${o.n} (공용 Curse ${this.curseLevel})`, 'warn'); } return true;
      case 'ratAfflict': await this.ratAfflict(t, o.n); return true;
      case 'ratAfflictPerHit': await this.ratAfflict(t, o.n * (ctx.hits || 0)); return true;
      case 'ratDrag': await this.ratDrag(src, t, o.n); return true;
      case 'ratIfHits': if ((ctx.hits || 0) >= (o.gte || 0) && (o.lt == null || ctx.hits < o.lt) && t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'ratIfAlone': { if (!t || !t.alive || !(ctx.hits > 0)) return true; const z = this.board.zone([t.pos], o.z); if (!this.alive().some(x => x !== t && z.some(c => cellEq(c, x.pos)))) await this.fx.runMonsterOps(o.then, ctx); return true; }
      case 'ratWeakest': { if (!t || !t.alive || !(ctx.hits > 0) || !M.hasTrait('Go for the Weakest Link')) return true; if (this.knockedDown(t)) { this.say(`Go for the Weakest Link: ${t.name} knocked down`, 'bp'); await this.ratAfflict(t, 1); } if (t.alive && this.isLone(t)) { this.say(`Go for the Weakest Link: ${t.name} Lone Knight`, 'bp'); await this.ratAfflict(t, 1); } return true; }
      case 'ratSignature': { if (!k || !k.alive || !src || !M.mobs.includes(src)) return true; this.say(`Ratwolf #${src.n}: ${k.name}에게 Signature`, 'ai'); await this.withMob(src, () => this.performSignature({ forceTarget: k })); return true; }
      case 'ratPriority': if (k && k.alive) { this.priorityTarget = k; this.say(`${k.name}: Priority Target 토큰 획득`); } return true;
      case 'ratMoveToken': { const m = M.mobs.find(x => x.tokens.length); if (m) { const tok = m.tokens[0]; this.moveToken(m.n, tok, false); const d = M.mobs.find(x => x.tokens.includes(tok)); this.say(`Activation 토큰 이동: #${m.n} → #${d ? d.n : '?'}`, 'bp'); } return true; }
      case 'ratPoisonAll': for (const x of this.alive()) await this.fx.runKnightOp({ op: 'poison', n: o.n }, x, {}); return true;
      case 'ratNote': this.say(o.text, 'warn'); return true;
      default: return false;
    }
  },
};
export const RAT_OPS = ['ratCurseIfDied', 'ratAfflict', 'ratAfflictPerHit', 'ratDrag', 'ratIfHits', 'ratIfAlone', 'ratWeakest', 'ratSignature', 'ratPriority', 'ratMoveToken', 'ratPoisonAll', 'ratNote', 'noop'];
