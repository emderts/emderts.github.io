// Knight of the Fen (Boss Clash with Doppelknight Mobs): Doppelknight Spawn / BP stacks / Doppelganger attacks, We Are Many, Spread Thin,
// Ooze Trap / Inescapable Slime / Engulfed (+ Sabotage), One with the Swamp (Dwell), Living Wasteheap, Absorb the Fallen,
// Concentrated Strength, Kingdom Traits (Quick Summons / Recycled Armor). Doppelknights reuse the `guardians` list of troll.js (g.isDopp).
import { DIRS, rearCells } from './board.js';
import { GameOver } from './core.js';
import { d10Success } from './dice.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const man = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

export const FenMixin = {
  fenSetup() {
    const M = this.monster, D = this.monsterDef; if (!D.fen) return; this.isFen = true; this.flags = this.flags || {}; this.fenArmor = 0; this.wamTokens = 0; this.wasteheap = [];
    const kt = D.fen.kingdomTrait[this.kingdom] || D.fen.kingdomTrait.sunken; M.traits.add(kt); this.say(`Kingdom Trait: ${kt}`);
    if (M.hasTrait('We Are Legion')) M.disabledTraits.add('Spread Thin'); if (M.hasTrait('Inescapable Slime')) M.disabledTraits.add('Ooze Trap');
  },
  /** Start of Clash (after the Knights are placed): Spawn a Doppelknight (We Are Legion: one more). */
  async fenStart() { if (!this.isFen || this._fenStarted) return; this._fenStarted = true; this.say('Start of Clash: Doppelknight Spawn', 'ai'); await this.fenSpawn(); if (this.monster.hasTrait('We Are Legion')) await this.fenSpawn(); },
  fenKnights() { return this.alive().filter(k => !k.engulfed); },
  fenBoss() { return this._realBoss || this.monster.cells; },
  fenLose(why) { this.say(`패배 — ${why}`, 'end'); this.result = 'lose'; throw new GameOver('lose'); },
  fenCheckBP() { const bp = this.monster.bp; if (!bp.cards.length && !bp.discard.length) this.fenLose('BP 덱과 버림 더미에 카드가 없음 (Doppelknight)'); },
  swampTiles() { const B = this.board; const cells = this.tileCells('swamp').map(c => ({ c: c.c, r: c.r })); const out = []; const seen = new Set(); for (const c of cells) { if (seen.has(B.key(c))) continue; const grp = [c]; seen.add(B.key(c)); for (let i = 0; i < grp.length; i++) for (const n of B.neighbors(grp[i])) { if (seen.has(B.key(n)) || !cells.some(x => cellEq(x, n))) continue; seen.add(B.key(n)); grp.push(n); } out.push(grp); } return out; },
  doppFree(c) { const B = this.board; const t = B.terrainAt(c); return B.inside(c) && !(t && (t.obstacle || t.chasm)) && !this.knightAt(c) && !this.guardianAt(c) && !this.fenBoss().some(m => cellEq(m, c)); },
  // ---------- Doppelknights ----------
  async fenSpawn(near = null) {
    const M = this.monster, B = this.board; if (!M.hasTrait('Doppelknight')) { this.say('Doppelknight Trait 비활성 — Spawn 없음'); return null; }
    if (this.guardians.length >= this.monsterDef.fen.tokens) { this.say(`Doppelknight 토큰 ${this.monsterDef.fen.tokens}개 모두 사용 중 — Spawn 없음`); return null; }
    const boss = near && near.alive && !near.engulfed ? [near.pos] : this.fenBoss(); const d = c => Math.min(...boss.map(m => man(m, c))); const tiles = this.swampTiles().filter(t => !t.some(c => this.guardianAt(c)) && t.some(c => this.doppFree(c))).map(t => t.filter(c => this.doppFree(c)));
    if (!tiles.length) { this.say('Doppelknight가 없는 Swamp 타일이 없음 — Spawn 없음'); return null; }
    const best = Math.min(...tiles.map(t => Math.min(...t.map(d)))); const cand = tiles.filter(t => Math.min(...t.map(d)) === best).flatMap(t => t.filter(c => d(c) === best));
    const cell = cand.length > 1 ? await this.ask({ type: 'move', text: 'Doppelknight Spawn — 가장 가까운 Swamp 칸 (동률)', cells: cand, options: cand.map(c => ({ label: B.label(c), value: c })) }) || cand[0] : cand[0];
    const n = M.hasTrait('Concentrated Strength') ? 2 : 1; const cards = []; for (let i = 0; i < n; i++) { const c = M.drawBP(); if (!c) this.fenLose(n === 2 ? 'Concentrated Strength: BP 카드 2장을 뽑을 수 없음' : 'BP 덱이 비어 있음'); cards.push(c); }
    for (let x = 1; ; x++) if (!this.guardians.some(g => g.n === x)) { this.gNext = x; break; }
    if (near && boss.length === 1) this.say(`Spawn 기준: 공격한 기사 ${near.name}에게 가장 가까운 Swamp`); const g = this.addGuardian(cell, 'S'); g.isDopp = true; g.cards = cards; g.revealed = false; g.armor = 0; this.guardians.sort((a, b) => a.n - b.n);
    const ks = this.fenKnights(); if (ks.length) { const kd = Math.min(...ks.map(k => man(k.pos, cell))); const near = ks.filter(k => man(k.pos, cell) === kd); const f = near[0].pos; g.facing = Math.abs(f.c - cell.c) >= Math.abs(f.r - cell.r) ? (f.c > cell.c ? 'E' : 'W') : (f.r > cell.r ? 'N' : 'S');
      if (M.hasTrait('Quick Summons')) { let k = near[0]; if (near.length > 1) { const id = await this.ask({ type: 'pickKnight', text: 'Quick Summons — 가장 가까운 기사 (동률)', options: near.map(x => ({ label: x.name, value: x.id })) }); k = near.find(x => x.id === id) || near[0]; } this.say(`Quick Summons: ${k.name} Exposed`); await this.addCondition(k, 'Exposed'); } }
    this.say(`Doppelknight #${g.n} Spawn → ${B.label(cell)} (BP ${cards.length}장 뒷면)`, 'ai'); this.fenCheckBP(); return g;
  },
  guardianName(g) { return g.isDopp ? `Doppelknight #${g.n}` : `Firstman Guardian #${g.n}`; },
  guardianToHit(g) { return g.isDopp ? this.monster.toHit + this.monster.modifiers.toHit : this.monsterDef.guardian.bp.ops.toHit; },
  guardianBP(g) { if (!g.isDopp) return { ...this.monsterDef.guardian.bp, level: 'G', isGuardianBP: true }; if (!g.revealed) { g.revealed = true; this.say(`Doppelknight #${g.n} BP 공개: ${g.cards.map(c => `${c.name} (AT ${this.monster.atOf(c)})`).join(' + ')}`, 'bp'); } return g.cards[0]; },
  doppAT(g) { return g.cards.reduce((a, c) => a + this.monster.atOf(c), 0) + (g.armor || 0); },
  fenAT(bp) { const M = this.monster; const A = this.currentKnightAttack; let at = M.atOf(bp, this.fenArmor); if (this.flags.fenRearAT && A && rearCells(this.board, M.cells, M.facing).some(c => cellEq(c, A.knight.pos))) at -= 1; if (M.hasTrait('Spread Thin')) at = Math.max(1, at - this.guardians.length); return at; },
  /** Wounding a Doppelknight: its BP(s) go to the Wound Stack (+Escalation), the token is removed and a 1x2 Swamp is placed on its space. */
  async doppWound(A) {
    const M = this.monster, B = this.board, g = A.guardian; let dealt = 0; for (const [i, card] of g.cards.entries()) dealt += M.wound(card, { critical: A.critical && i === 0 }); for (const m of M.log.splice(0)) this.say(m);
    const cell = g.cells[0]; B.remove(g.cells); this.guardians.splice(this.guardians.indexOf(g), 1); this.say(`Doppelknight #${g.n} 처치 — BP ${g.cards.map(c => c.name).join(' + ')} → Wound Stack`, 'wound');
    const sw = { id: 'swamp', obstacle: false, obscuring: false, destructible: false, chasm: false, difficult: true }; if (!B.terrainAt(cell)) B.terrain.set(B.key(cell), { ...sw }); const adj = B.neighbors(cell).filter(c => !B.terrainAt(c));
    if (adj.length) { const c2 = adj.length > 1 ? await this.ask({ type: 'move', text: `Swamp 1x2 — ${B.label(cell)} 옆 두 번째 칸`, cells: adj, options: adj.map(c => ({ label: B.label(c), value: c })) }) || adj[0] : adj[0]; B.terrain.set(B.key(c2), { ...sw }); this.say(`Swamp 1x2 배치: ${B.label(cell)}-${B.label(c2)}`); await this.swampSweep(); }
    if (M.hasTrait('Absorb the Fallen')) { this.fenArmor++; this.say(`Absorb the Fallen: Armor 토큰 +1 (${this.fenArmor})`); }
    this.fenCheckBP(); return dealt;
  },
  async fenWithDopp(g, fn) { const prev = this._realBoss; this._realBoss = this.monster.cells; try { return await this.withGuardian(g, fn); } finally { this._realBoss = prev; } },
  /** Knight of the Fen moved through `k`: resolved when the movement ends (a Knight still under the base is Engulfed instead — one Slimed only). */
  fenPass(k) { if (k.alive && !k.engulfed) (this._fenPassed = this._fenPassed || new Set()).add(k); },
  async fenOoze(k, who) { const M = this.monster; if (!k.alive || k.engulfed) return; const lv4 = M.hasTrait('Inescapable Slime'); if (!lv4 && !M.hasTrait('Ooze Trap')) { await this.crash(k); return; }
    if (lv4 && who === 'boss') { this.say(`Inescapable Slime: ${k.name}을(를) 지나감 → Engulfed`); await this.fenEngulf(k); return; }
    this.say(`${lv4 ? 'Inescapable Slime' : 'Ooze Trap'}: ${who === 'boss' ? 'Knight of the Fen' : 'Doppelknight'}이(가) ${k.name}을(를) 지나감 → Slimed${lv4 || M.level >= 2 ? ', -2 Vigor' : ''}`); await this.addCondition(k, 'Slimed'); if (k.alive && (lv4 || (M.level >= 2 && M.level <= 3))) await this.loseVigor(k, 2, { source: 'effect', armor: false }); },
  /** Advanced Bypass movement of the acting Doppelknight until adjacent to (or within `range` of) the target space. */
  async doppMoveToward(target, range = null) {
    const B = this.board, g = this.actingGuardian; const start = g.cells[0]; const near = c => range ? man(c, target) <= range : B.adjacent(c, target); if (near(start)) return;
    const pass = c => B.inside(c) && !(B.terrainAt(c) && B.terrainAt(c).obstacle); const dist = new Map([[B.key(start), 0]]); const prev = new Map(); let fr = [start];
    while (fr.length) { const nx = []; for (const c of fr) for (const n of B.neighbors(c)) { const k = B.key(n); if (dist.has(k) || !pass(n)) continue; dist.set(k, dist.get(B.key(c)) + 1); prev.set(k, c); nx.push(n); } fr = nx; }
    const ends = [...dist.keys()].map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(c => near(c) && this.doppFree(c)); if (!ends.length) return;
    const best = Math.min(...ends.map(c => dist.get(B.key(c)))); const pool = ends.filter(c => dist.get(B.key(c)) === best);
    const end = pool.length > 1 ? await this.ask({ type: 'move', text: `Doppelknight #${g.n} 이동 도착 칸 (동률)`, cells: pool, options: pool.map(c => ({ label: B.label(c), value: c })) }) || pool[0] : pool[0];
    // Rulebook p.50: with more than one shortest path the Monster "zigzags" — it switches the movement axis after each space; the players choose the starting direction.
    const dE = new Map([[B.key(end), 0]]); { let f2 = [end]; while (f2.length) { const nx = []; for (const c of f2) for (const n of B.neighbors(c)) { const k = B.key(n); if (dE.has(k) || !pass(n)) continue; dE.set(k, dE.get(B.key(c)) + 1); nx.push(n); } f2 = nx; } }
    const path = []; { let cur = start, axis = null; while (!cellEq(cur, end)) { const opts = B.neighbors(cur).filter(n => dE.has(B.key(n)) && dE.get(B.key(n)) === dE.get(B.key(cur)) - 1); if (!opts.length) break; const ax = n => (n.c !== cur.c ? 'h' : 'v'); let nxt; if (opts.length === 1) nxt = opts[0]; else if (axis == null) nxt = await this.ask({ type: 'move', text: `Doppelknight #${g.n} — 지그재그 이동의 시작 방향 (도착 ${B.label(end)})`, cells: opts, options: opts.map(c => ({ label: B.label(c), value: c })) }) || opts[0]; else { const sw = opts.filter(n => ax(n) !== axis); /* zigzag: switch the axis; when that leaves a choice (or the zigzag cannot go on and several shortest paths remain) the players decide */ const pool2 = sw.length ? sw : opts; nxt = pool2.length === 1 ? pool2[0] : await this.ask({ type: 'move', text: `Doppelknight #${g.n} — 최단 경로가 여럿: 다음 칸 선택 (도착 ${B.label(end)})`, cells: pool2, options: pool2.map(c => ({ label: B.label(c), value: c })) }) || pool2[0]; } axis = ax(nxt); path.push(nxt); cur = nxt; } }
    B.remove([start]); g.cells = [end]; this.monster.cells = [end]; B.place({ kind: 'mob', n: 'G' + g.n }, [end]); this.say(`Doppelknight #${g.n} 이동 ${best}칸 → ${B.label(end)}`);
    for (const c of path.slice(0, -1)) { const k = this.knightAt(c); if (k) await this.fenOoze(k, 'dopp'); }
    if (this.monster.hasTrait('Recycled Armor') && path.some(c => B.terrainAt(c) && B.terrainAt(c).id === 'swamp')) { g.armor = (g.armor || 0) + 1; this.say(`Recycled Armor: Doppelknight #${g.n} Armor 토큰 +1 (${g.armor})`); }
  },
  /** One Doppelknight performs the Doppelganger effect of `card`. Returns false when a Chain Break happened. */
  async fenDoppAttack(g, card) {
    const spec = card.ops.dg; if (!spec || !this.guardians.includes(g)) return true; const ks = this.fenKnights(); if (!ks.length) return true; const B = this.board; const me = g.cells[0];
    const pickBy = async (pool, f, text) => { if (!pool.length) return null; const m = Math.min(...pool.map(f)); const c = pool.filter(k => f(k) === m); if (c.length === 1) return c[0]; if (c.includes(this.priorityTarget)) return this.priorityTarget; const id = await this.ask({ type: 'pickKnight', text: `Doppelknight #${g.n} — ${text} (동률)`, options: c.map(k => ({ label: `${k.name} (${B.label(k.pos)})`, value: k.id })) }); return c.find(k => k.id === id) || c[0]; };
    const dk = k => man(k.pos, me); const f = DIRS[g.facing]; const front = k => (k.pos.c - me.c) * f.c + (k.pos.r - me.r) * f.r > 0; const last = this.lastAttackPrimary; let t = null;
    if (spec.target === 'closest') t = await pickBy(ks, dk, '가장 가까운 기사'); else if (spec.target === 'furthest') t = await pickBy(ks, k => -dk(k), '가장 먼 기사');
    else if (spec.target === 'furthestFront') t = await pickBy(ks.filter(front), k => -dk(k), '앞쪽의 가장 먼 기사'); else if (spec.target === 'furthestSight') t = await pickBy(ks.filter(k => B.hasLoS([me], [k.pos])), k => -dk(k), '시야 안의 가장 먼 기사');
    else if (spec.target === 'last') t = last && last.alive && !last.engulfed ? last : null; else if (spec.target === 'other') t = await pickBy(ks.filter(k => k !== last), dk, '다른 대상');
    else if (spec.target === 'closestSwamp') { const sw = this.tileCells('swamp'); t = await pickBy(ks, k => Math.min(...sw.map(s => man(s, k.pos)), 99), 'Swamp에 가장 가까운 기사'); }
    if (!t) { this.say(`Doppelknight #${g.n}: 유효 대상 없음 — 공격 생략`); return true; }
    const dice = card.ops.diceFromDopps ? 1 + this.guardians.length : card.evasionDice;
    const pc = spec.repeatMain ? { ...card, name: `${card.name} — Doppelganger`, ops: { ...card.ops, dg: null, afterAttack: null, afterFinalAttack: null } } : { name: `${card.name} — Doppelganger`, level: card.level, type: 'attack', evasionDice: dice, evasionDifficulty: card.evasionDifficulty, targeting: [`Doppelknight #${g.n} → ${t.name}`], effects: [card.doppelganger || ''].filter(Boolean), reactWindows: [], ops: { targeting: [], move: true, range: spec.range || null, gates: [], before: [], effects: spec.effects, afterAttack: null, afterFinalAttack: null } };
    this.say(`Doppelknight #${g.n}: Doppelganger — ${card.doppelganger || card.name}`, 'ai'); this.lastChainBreak = false;
    await this.fenWithDopp(g, () => this.resolveMonsterAttack(pc, { dopp: g, forceTarget: t })); return !this.lastChainBreak;
  },
  /** Doppelganger: all Doppelknights activate after the Knight of the Fen, lowest number first; a Chain Break stops the rest. */
  async fenDoppelgangers(card) { if (!this.isFen || this.actingGuardian || this._inDG || !this.monster.hasTrait('Doppelganger') || !card.ops.dg) return; if (this.lastChainBreak) { this.say('Chain Break → 이번에는 Doppelknight가 활성화하지 않음'); return; }
    this._inDG = true; try { for (const g of [...this.guardians].sort((a, b) => a.n - b.n)) { if (!this.alive().length) break; if (!await this.fenDoppAttack(g, card)) { this.say('Chain Break → 남은 Doppelknight 활성화 중단'); break; } } } finally { this._inDG = false; } },
  // ---------- Engulfed ----------
  async fenEngulf(k) { if (!k || !k.alive || k.engulfed) return; k.engulfed = true; this.board.remove([k.pos]); k.pos = { ...this.fenBoss()[0] }; this.say(`${k.name}: Engulfed — 미니어처를 Engulfed 카드 위로`, 'cond'); await this.addCondition(k, 'Slimed'); },
  async fenFree(k, why) { if (!k.engulfed) return; const B = this.board; const boss = this.fenBoss(); let cand = []; for (const m of boss) for (const c of B.neighbors(m)) if (!B.isObstacle(c) && !this.knightAt(c) && !this.guardianAt(c) && !boss.some(x => cellEq(x, c)) && !cand.some(x => cellEq(x, c))) cand.push(c);
    const dry = cand.filter(c => !(B.terrainAt(c) && B.terrainAt(c).id === 'swamp')); if (dry.length) cand = dry; k.engulfed = false; if (!cand.length) { this.say(`${k.name}: 풀려났지만 Displace할 칸이 없음`); await this.die(k, 'Displace 불가'); return; }
    const to = cand.length > 1 ? await this.ask({ type: 'move', knight: k.id, text: `${k.name}: Engulfed 탈출 — Displace 칸`, cells: cand, options: cand.map(c => ({ label: B.label(c), value: c })) }) || cand[0] : cand[0]; k.pos = to; B.place({ kind: 'knight', id: k.id }, [to]); this.say(`${k.name}: Engulfed에서 풀려남 (${why}) → ${B.label(to)}`, 'cond'); },
  fenSync() { if (!this.isFen) return; for (const k of this.knights) if (k.engulfed) k.pos = { ...this.monster.cells[0] }; },
  async fenAfterMove() { if (!this.isFen || this.actingGuardian) return; const passed = [...(this._fenPassed || [])]; this._fenPassed = null; for (const k of passed) if (k.alive && !k.engulfed && !this.monster.cells.some(c => cellEq(c, k.pos))) await this.fenOoze(k, 'boss'); for (const k of this.fenKnights()) if (this.monster.cells.some(c => cellEq(c, k.pos))) { this.say(`Knight of the Fen이 ${k.name} 위에서 이동 종료`); await this.fenEngulf(k); if (k.alive && this.monster.level >= 2 && this.monster.level <= 3 && this.monster.hasTrait('Ooze Trap')) { this.say(`Ooze Trap (Level 2–3): ${k.name} -2 Vigor`); await this.loseVigor(k, 2, { source: 'effect', armor: false }); } } this.fenSync(); },
  /** started: the Knight began this turn Engulfed (the end-of-turn Poison 2 applies only then). When a Knight becomes Engulfed during their own turn, the rest of the turn follows the Engulfed card: only Sabotage or attack, no movement. */
  async fenEngulfedTurn(k, started = true, combat = true) {
    const M = this.monster; let sab = false;
    while (k.alive && k.engulfed) {
      const hasW = k.gear.some(g => g.type === 'weapon' && !g.exhausted && !g.discarded); const opts = [];
      if (combat && hasW) opts.push({ label: '공격 (Engulfed — Knight of the Fen, Melee만)', value: 'attack' }); if (combat && !sab) opts.push({ label: 'Sabotage (Combat action)', value: 'sabC' }); if (!sab && k.heat + 3 <= k.heatLimit) opts.push({ label: `Sabotage (Heat +3, 현재 ${k.heat}/${k.heatLimit})`, value: 'sabH' }); opts.push({ label: '턴 종료', value: 'end' });
      const v = await this.ask({ type: 'action', knight: k.id, text: `${k.name} — Engulfed`, options: opts }); if (v === 'end' || !v) break;
      if (v === 'attack') { combat = false; k.actions.combat = false; await this.knightAttack(k); this.checkEnd(); continue; }
      sab = true; if (v === 'sabC') { combat = false; k.actions.combat = false; } else k.gainHeat(3, { voluntary: true });
      const vs = ['Fortitude', 'Might']; const vt = await this.ask({ type: 'pick', knight: k.id, text: `${k.name} Sabotage — Test (10+) Virtue`, options: vs.map(x => ({ label: `${x} +${(k.virtues || {})[x] || 0}`, value: x })) }) || vs[0]; const d = await this.d10For(k, 'Sabotage Test'); const b = ((k.virtues || {})[vt] || 0) + await this.fx.virtueCharge(k, `${vt} Test`); const okk = d10Success(d, b, 10);
      this.say(`${k.name} Sabotage: Test ${vt} d10 ${d} +${b} vs 10+ → ${okk ? '성공' : '실패'}`, 'dice');
      if (okk) { const c = await this.ask({ type: 'pick', knight: k.id, text: 'Sabotage 성공 — 효과 선택', options: [{ label: 'AI Suppress (AI 버림 더미를 덱에 섞음)', value: 'ai' }, { label: `Armor 토큰 모두 버림 (현재 ${this.fenArmor})`, value: 'armor' }] }); if (c === 'armor') { this.fenArmor = 0; this.say('Sabotage: Armor 토큰 모두 버림'); } else { M.ai.cards.push(...M.ai.discard); M.ai.discard = []; M.ai.shuffle(); this.say('Sabotage: AI Suppress'); } }
    }
    if (started && k.alive && k.engulfed) { this.say(`${k.name}: Engulfed 상태로 턴 시작·종료 → Poison 2`); await this.fx.runKnightOp({ op: 'poison', n: 2 }, k, {}); }
  },
  // ---------- Knight of the Fen movement ----------
  async fenStepUntil(cell, done) { for (let i = 0; i < 30 && !done(); i++) { const m = this.monsterCenter(); const dc = cell.c - m.c, dr = cell.r - m.r; if (Math.abs(dc) < 0.5 && Math.abs(dr) < 0.5) break; const d = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) }; const r = await this.monsterStep(d); if (r !== 'ok') { const alt = d.c ? { c: 0, r: Math.sign(dr) } : { c: Math.sign(dc), r: 0 }; if ((!alt.c && !alt.r) || await this.monsterStep(alt) !== 'ok') break; } } await this.fenAfterMove(); },
  async fenDwell() { const B = this.board, M = this.monster; const sw = this.tileCells('swamp').map(c => ({ c: c.c, r: c.r })); if (sw.some(c => M.cells.some(m => cellEq(m, c)))) { this.say('Dwell: 이미 Swamp 위'); return; } const free = sw.filter(c => !this.knightAt(c) && !this.guardianAt(c)); if (!free.length) { this.say('Dwell: 비어 있는 Swamp 칸 없음'); return; }
    const d = c => Math.min(...M.cells.map(m => man(m, c))); const best = Math.min(...free.map(d)); const pool = free.filter(c => d(c) === best); const to = pool.length > 1 ? await this.ask({ type: 'move', text: 'Dwell — 가장 가까운 빈 Swamp 칸 (동률)', cells: pool, options: pool.map(c => ({ label: B.label(c), value: c })) }) || pool[0] : pool[0];
    this.say(`Dwell: Knight of the Fen → Swamp ${B.label(to)}`, 'ai'); await this.fenStepUntil(to, () => M.cells.some(m => cellEq(m, to))); this.say(`Knight of the Fen 위치 ${M.cells.map(c => B.label(c)).join('/')}`); },
  async fenMoveWithin(k, range) { const B = this.board, M = this.monster; const d = () => Math.min(...M.cells.map(m => man(m, k.pos))); this.turnToward(k.pos); if (d() > range) { await this.fenStepUntil(k.pos, () => d() <= range); this.say(`Knight of the Fen 이동 → ${M.cells.map(c => B.label(c)).join('/')} (Range ${range})`); } this.turnToward(k.pos); },
  async fenAfterAction() { if (!this.isFen || this._fenBusy) return; if (this._fenPassed) await this.fenAfterMove(); this.fenSync(); const M = this.monster; if (M.hasTrait('We Are Many') && this.wamTokens >= 4) { this._fenBusy = true; try { this.wamTokens = 0; this.say('We Are Many: 토큰 4 → Doppelknight Spawn + Signature', 'ai'); await this.fenSpawn(this.wamKnight); await this.performSignature(); } finally { this._fenBusy = false; } } },
  async fenCritMiss(k) { const M = this.monster; if (!this.isFen || !M.hasTrait('Living Wasteheap')) return; const gear = k.gear.filter(g => !g.discarded); if (!gear.length) return; const nm = gear.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name} Crit Miss — Living Wasteheap에 놓을 Gear 선택`, options: gear.map(g => ({ label: `${g.name} (${g.type})`, value: g.name })) }) : gear[0].name; const g = gear.find(x => x.name === nm) || gear[0]; g.discarded = true; this.wasteheap.push(g.name);
    if (g.type === 'weapon') { M.bonuses.vigorLoss++; this.say(`Living Wasteheap: ${g.name} (Weapon) → Knight of the Fen 공격 Vigor 손실 +1`, 'bp'); } else if (g.type === 'armor') { this.fenArmor += 2; this.say(`Living Wasteheap: ${g.name} (Armor) → Armor 토큰 +2 (${this.fenArmor})`, 'bp'); } else { M.modifiers.toHit++; this.say(`Living Wasteheap: ${g.name} (Support) → To Hit +1`, 'bp'); } },
  // ---------- ops ----------
  async fenOp(o, ctx) {
    if (!this.isFen) return false; const M = this.monster, B = this.board; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'ifHits': if ((ctx.hits || 0) >= (o.gte || 0) && (o.lt == null || ctx.hits < o.lt) && t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'noop': return true;
      case 'fenEngulf': if (t && t.alive) await this.fenEngulf(t); return true;
      case 'fenDwell': await this.fenDwell(); return true;
      case 'fenPoison': if (t && t.alive) { const n = o.n * (o.perHit ? (ctx.hits || 0) : 1); if (n) { this.say(`${t.name}: Poison ${n}`); await this.fx.runKnightOp({ op: 'poison', n }, t, {}); } } return true;
      case 'fenSwarm': if (t && t.alive) { const g = this.actingGuardian; const n = this.guardians.filter(x => x !== g && B.adjacent(x.cells[0], t.pos)).length + (g && this.fenBoss().some(m => B.adjacent(m, t.pos)) ? 1 : 0); this.say(`Swarm ${o.n}: 인접한 다른 몬스터 ${n}`); if (n) await this.loseVigor(t, o.n * n, { source: 'effect', armor: false }); } return true;
      case 'fenHeatPerHit': if (t && t.alive && ctx.hits) { t.gainHeat(o.n * ctx.hits); this.say(`${t.name}: Heat +${o.n * ctx.hits}`); } return true;
      case 'fenSunder': this.poolAdd('sunder', o.n); return true;
      case 'fenOrArmor': { const lab = o.first === 'sunder' ? 'Sunder 1' : 'Power 1'; let v = 'first'; if (this.fenArmor > 0) v = await this.ask({ type: 'pick', knight: k && k.id, text: `Overcome — ${lab} 또는 Armor 토큰 ${o.armor}개 버림 (현재 ${this.fenArmor})`, options: [{ label: lab, value: 'first' }, { label: `Armor 토큰 ${o.armor}개 버림`, value: 'armor' }] }); if (v === 'armor') { this.fenArmor = Math.max(0, this.fenArmor - o.armor); this.say(`Armor 토큰 버림 → ${this.fenArmor}`); } else this.poolAdd(o.first === 'sunder' ? 'sunder' : 'power', 1); return true; }
      case 'fenSpawn': await this.fenSpawn(ctx.attacker || null); return true;
      case 'fenPerformAI': this.say('Perform AI', 'ai'); await this.activationAI(); return true;
      case 'fenSwampUnder': { let n = 0; for (const c of M.cells) if (!B.terrainAt(c)) { B.terrain.set(B.key(c), { id: 'swamp', obstacle: false, obscuring: false, destructible: false, chasm: false, difficult: true }); n++; } this.say(`Knight of the Fen 아래에 2x2 Swamp 배치 (${n}칸)`); return true; }
      case 'fenMoveToFurthest': { const ks = this.fenKnights(); if (!ks.length) return true; const d = x => Math.min(...M.cells.map(m => man(m, x.pos))); const best = Math.max(...ks.map(d)); const pool = ks.filter(x => d(x) === best); let x = pool[0]; if (pool.length > 1) { const id = await this.ask({ type: 'pickKnight', text: '가장 먼 기사 (동률)', options: pool.map(p => ({ label: p.name, value: p.id })) }); x = pool.find(p => p.id === id) || pool[0]; } this.say(`Knight of the Fen이 가장 먼 기사(${x.name}) 옆으로 이동`, 'ai'); this.turnToward(x.pos); await this.monsterMoveToward(x); return true; }
      case 'fenKnightMove': if (k && k.alive && !k.engulfed && await this.yesNo(`${k.name}: 최대 ${o.n}칸 이동?`, true)) await this.knightMove(k, o.n); return true;
      case 'fenResetHeat': if (k && k.alive && await this.yesNo(`${k.name}: Heat 리셋?`, true)) { k.heat = 0; this.say(`${k.name} Heat 리셋`); } return true;
      case 'fenDiscardConditions': if (k && k.alive && (!o.optional || await this.yesNo(`${k.name}: Condition 카드 모두 버림?`, true))) { this.say(`${k.name}: Condition 카드 ${k.conditions.length}장 모두 버림`); k.conditions = []; k.chokeLimit = 0; } return true;
      case 'fenUnexhaustOrHeat': { if (!k || !k.alive) return true; const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Weapon 모두 Unexhaust 또는 Heat 최대 -${o.n}`, options: [{ label: 'Weapon 모두 Unexhaust', value: 'w' }, { label: `Heat -${Math.min(o.n, k.heat)}`, value: 'h' }] }); if (v === 'h') { k.heat = Math.max(0, k.heat - o.n); this.say(`${k.name} Heat → ${k.heat}`); } else { for (const g of k.gear) if (g.type === 'weapon') g.exhausted = false; this.say(`${k.name}: Weapon 모두 Unexhaust`); } return true; }
      case 'fenEscape': { const en = this.alive().filter(x => x.engulfed); if (!en.length) return true; let x = en[0]; if (en.length > 1) { const id = await this.ask({ type: 'pickKnight', text: 'Engulfed에서 탈출할 기사', options: en.map(p => ({ label: p.name, value: p.id })) }); x = en.find(p => p.id === id) || en[0]; } await this.fenFree(x, 'Gunk Maw Critical'); return true; }
      case 'fenRoutine': { await this.fenSpawn(); await this.fenSpawn(); for (const g of [...this.guardians].sort((a, b) => a.n - b.n)) { if (!this.guardians.includes(g) || !this.alive().length) continue; const card = M.drawAI(); if (!card) break; this.say(`Dopplergenesis: Doppelknight #${g.n} — AI ${card.level} ${card.name}`, 'ai'); const okk = await this.fenDoppAttack(g, card); M.discardAI(card); if (!okk) break; } return true; }
      default: return false;
    }
  },
};
export const FEN_OPS = ['noop', 'fenEngulf', 'fenDwell', 'fenPoison', 'fenSwarm', 'fenHeatPerHit', 'fenSunder', 'fenOrArmor', 'fenSpawn', 'fenPerformAI', 'fenSwampUnder', 'fenMoveToFurthest', 'fenKnightMove', 'fenResetHeat', 'fenDiscardConditions', 'fenUnexhaustOrHeat', 'fenEscape', 'fenRoutine'];
