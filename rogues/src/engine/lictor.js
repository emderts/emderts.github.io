// Firstmen Lictor Hunters (Mob Clash): Taunt & Decoy, Seek & Destroy, Mangrove Deployment + Dwell, It's a Trap!, Advanced Tactics,
// Combat Flexibility. Battle Tactics / Tactic A·B / Great Mangroves reuse firstmen.js.
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const man = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

export const LictorMixin = {
  lhSetup() {
    const M = this.monster, B = this.board, C = this, D = this.monsterDef; this.isLh = true; this.lh = { tokens: 0, activated: new Set(), pending4: false, flex: null };
    // 4 randomly chosen numbered Lictor Hunters are real; the others start as Decoys
    const cells = this.rng.shuffle ? this.rng.shuffle(M.mobs.map(m => m.cells[0])) : M.mobs.map(m => m.cells[0]).sort(() => this.rng.die(2) - 1.5); for (const m of M.mobs) B.remove(m.cells); M.mobs.forEach((m, i) => { m.cells = [cells[i]]; B.place({ kind: 'mob', id: 'mob' + m.n }, m.cells); });
    const dec = D.lh.decoyStart.map(l => B.parse(l)); for (const m of M.mobs) if (dec.some(c => cellEq(c, m.cells[0]))) m.decoying = true;
    this.say(`Lictor Hunters: #${M.mobs.filter(m => !m.decoying).map(m => m.n).join(', #')} · Decoy 위치: ${M.mobs.filter(m => m.decoying).map(m => B.label(m.cells[0])).join(', ')}`);
    if (M.hasTrait('Advanced Tactics')) { this.tactics = this.rng.pick(Object.values(D.lh.advancedTactics)); this.say(`Advanced Tactics: ${this.tactics.name} — Tactics Target: ${this.tactics.ops.target}`, 'ai'); if (this.tactics.ops.escalateOnDraw) { this.say(`${this.tactics.name}: Escalate 1`); this.escalateLowestMob({ unrevealedOnly: true }); } }
    const cur = () => M.cur && M.cur.decoying && (C.currentAttack || C._lhAct);
    const adj = this.adjacentToMonster.bind(this); this.adjacentToMonster = k => cur() ? true : adj(k);
    const ins = this.inSight.bind(this); this.inSight = k => cur() ? true : ins(k);
    const dk = this.distKM.bind(this); this.distKM = k => cur() ? 1 : dk(k);
    for (const fn of ['mobMoveToward', 'bypassMoveToward']) { const o = this[fn].bind(this); this[fn] = async (mob, ...a) => mob && mob.decoying ? 0 : o(mob, ...a); }
    const aura = this.mobAura.bind(this); this.mobAura = key => aura(key) + (key === 'mobAttackVigor' && C.lh.tokens >= 1 ? 1 : 0);
    const th = this.firstmenToHit.bind(this); this.firstmenToHit = mob => th(mob) + C.revealedAura('lhToHit').length + (mob && mob.decoying ? (C.lhOnSwamp(mob) ? 2 : 0) - C.poolCount('fire') : 0);
    const at = this.mobAT.bind(this); this.mobAT = mob => at(mob) - (mob.decoying && C.lhOnSwamp(mob) ? 1 : 0) - (mob.revealed && mob.card.ops.aura && mob.card.ops.aura.stilicho && M.mobs.some(o => o !== mob && o.cells.length && mob.cells.length && B.adjacent(o.cells[0], mob.cells[0])) ? 1 : 0);
    const rma = this.resolveMonsterAttack.bind(this); this.resolveMonsterAttack = async (card, ctx) => { if (M.cur) C.lh.activated.add(M.cur); C._lhAct = true; try { return await rma(card, ctx); } finally { C._lhAct = false; } };
    const faa = this.firstmenAfterAttack.bind(this); this.firstmenAfterAttack = async attack => { await faa(attack); if (C.lh.tokens >= 3) for (const t of attack.targets.filter(x => x.alive)) { C.say(`Taunt & Decoy (토큰 3+): After Attack — ${t.name} Exposed`, 'bp'); await C.addCondition(t, 'Exposed'); } };
    const ms = this.mangroveSpawn.bind(this); this.mangroveSpawn = async dead => { if (C.revealedAura('noMangrove').length) { C.say('Invictus: Mangrove Deployment 비활성 — Spawn 없음', 'bp'); return; } return ms(dead); };
    this.firstmenEndKnightRound = async () => { for (const m of [...M.mobs].filter(x => x.mangrove).sort((a, b) => a.n - b.n)) await C.lhDwell(m); };
    this.firstmenEndMR = async () => { await C.lhEndMR(); };
    const tp = this.tacticsTargetPool.bind(this); this.tacticsTargetPool = alive => { if (!C.tacticsOn()) return []; const L = C.tactics.ops.target.toLowerCase(); if (L.includes('last knight to wound')) return alive.filter(k => k === C.priorityLast); if (L.includes('highest [v]')) { const m = Math.max(...alive.map(k => k.vigor)); return alive.filter(k => k.vigor === m); } if (L.includes('poisoned or toxified')) return alive.filter(k => C.hasCondition(k, 'Poisoned') || C.hasCondition(k, 'Toxified')); return tp(alive); };
    const fx = this.fx; const dice = fx.c; void dice;
  },
  lhOnSwamp(mob) { const t = mob.cells.length && this.board.terrainAt(mob.cells[0]); return !!(t && t.id === 'swamp'); },
  lhDice() { return this.lh.tokens >= 2 ? 1 : 0; },
  lhToken() { const S = this.lh; S.tokens++; this.say(`Taunt & Decoy: Generic 토큰 ${S.tokens} — ${['', 'Vigor 손실 +1', '+1 주사위', 'After Attack: Exposed', '다음 Lictor Hunter 활성화 + AI 토큰 추가'][Math.min(4, S.tokens)]}`, 'bp'); if (S.tokens === 4) S.pending4 = true; },
  lhNextMob(src, pred) { const M = this.monster; const all = [...M.mobs].sort((a, b) => a.n - b.n); const order = src ? [...all.filter(m => m.n > src.n), ...all.filter(m => m.n < src.n)] : all; return order.find(pred) || null; },
  /** Decoy keyword. */
  lhDecoy(mob) { if (!mob || !this.monster.mobs.includes(mob) || mob.decoying || mob.mangrove || !mob.cells.length) { this.say('Decoy 무시 (이미 Decoying / 보드 밖)'); return; } mob.decoying = true; mob.revealed = false; this.say(`Decoy: Mob #${mob.n} → Decoy (${this.board.label(mob.cells[0])}), BP는 뒷면`, 'ai'); this.lhToken(); },
  lhMangrove(mob) { const B = this.board; const loc = this.mangroveNext; this.mangroveNext = loc % 3 + 1; B.remove(mob.cells); mob.lastCell = mob.cells[0]; mob.cells = []; mob.offboard = true; mob.mangrove = loc; this.say(`Mob #${mob.n} → Great Mangrove #${loc}에서 대기 (보드 밖 취급)`, 'ai'); },
  /** Dwell: move to the closest unoccupied space on a Swamp Terrain tile. */
  async lhDwell(mob) {
    const B = this.board, M = this.monster; if (!mob || !M.mobs.includes(mob) || mob.decoying) return; const from = mob.mangrove ? this.mangroveCells(mob.mangrove) : mob.cells; if (!from.length) return;
    const sw = this.tileCells('swamp').filter(c => this.cellFree(c, mob)); if (!sw.length) { this.say(`Dwell: Mob #${mob.n} — 빈 Swamp 칸 없음`); return; } const d = c => Math.min(...from.map(f => man(f, c))); const m = Math.min(...sw.map(d)); const best = sw.filter(c => d(c) === m);
    const cell = best.length > 1 ? await this.ask({ type: 'move', text: `Dwell: Mob #${mob.n} — 가장 가까운 빈 Swamp 칸 (동률)`, cells: best, options: best.map(c => ({ label: B.label(c), value: c })) }) || best[0] : best[0];
    if (mob.mangrove) { delete mob.mangrove; await this.placeMob(mob, cell, 'Dwell (Great Mangrove에서)'); } else { this.mobStepTo(mob, cell); this.say(`Dwell: Mob #${mob.n} → ${B.label(cell)}`, 'ai'); }
  },
  /** A Decoy was hit: pair it with the leftmost unrevealed Decoying BP. Returns 'routine' when every Decoying BP is already revealed. */
  async lhDecoyHit(k, A) {
    const M = this.monster, B = this.board; const pool = M.mobs.filter(m => m.decoying && m.cells.length && !m.revealed).sort((a, b) => a.n - b.n);
    if (!pool.length) { this.say('Seek & Destroy: Decoying BP가 모두 공개되어 있음 → 즉시 Routine', 'ai'); await this.performRoutine(); return 'routine'; }
    const L = pool[0], X = A.mob; if (L !== X) { const lc = L.cells, xc = X.cells; B.remove(lc); B.remove(xc); L.cells = xc; X.cells = lc; B.place({ kind: 'mob', id: 'mob' + L.n }, L.cells); B.place({ kind: 'mob', id: 'mob' + X.n }, X.cells); const f = L.facing; L.facing = X.facing; X.facing = f; }
    A.mob = L; A.lhDecoy = true; A.lhCell = L.cells[0]; this.say(`Seek & Destroy: Decoy 명중 — 가장 왼쪽 비공개 Decoying BP #${L.n} 공개`, 'bp'); return 'ok';
  },
  /** Before the Responses of an Attack against a Decoy: attach the base ring; on a failed wound it goes to a Great Mangrove. */
  lhAttach(A) { const L = A.mob; if (!A.lhDecoy || !L || !L.decoying) return; L.decoying = false; this.say(`Mob #${L.n}: base ring 부착 — 더 이상 Decoy 아님`, 'bp'); if (!A.wounded) this.lhMangrove(L); },
  async lhAfterResponses(k, A) {
    const M = this.monster, B = this.board, S = this.lh;
    if (A.lhDecoy && M.hasTrait('It’s a Trap!') && !A.critical && !A.ignoreResponses) { const z = B.zone([A.lhCell], 1); const ks = this.alive().filter(x => z.some(c => cellEq(c, x.pos))); let n = 0; this.say('It’s a Trap!: Instinct — Zone 1의 모든 기사 Vigor -1', 'bp'); for (const x of ks) { const v = x.vigor; await this.loseVigor(x, 1, { source: 'attack' }); if (x.vigor < v || !x.alive) n++; } if (n) this.poolAdd('fire', n); }
    if (A.wounded && !A.lhDecoy && M.hasTrait('Combat Flexibility') && k.alive && A.mob) { const nx = this.lhNextMob(A.mob, m => !m.decoying && m.cells.length); if (nx) { this.say(`Combat Flexibility: Mob #${nx.n} — ${k.name}에게 Signature`, 'ai'); await this.withMob(nx, () => this.performSignature({ forceTarget: k })); } }
  },
  /** Taunt & Decoy 4th token: activate the next Lictor Hunter and add an AI Activation token. */
  async lhAfterAction() {
    const M = this.monster, S = this.lh; if (!S.pending4 || S._in4) return; S.pending4 = false; S._in4 = true;
    try { const free = [...M.mobs].sort((a, b) => a.n - b.n).find(m => !m.tokens.length); if (free) { free.tokens.push({ type: 'AI', ready: false }); this.say(`Taunt & Decoy (토큰 4): Mob #${free.n}에 AI Activation 토큰 추가`, 'bp'); }
      const nx = this.lhNextMob(M.cur, m => m.cells.length && !m.mangrove); if (nx) { this.say(`Taunt & Decoy (토큰 4): 다음 Lictor Hunter #${nx.n} 활성화`, 'ai'); await this.withMob(nx, () => this.activationAI()); } } finally { S._in4 = false; }
  },
  async lhEndMR() {
    const M = this.monster, B = this.board, S = this.lh; if (!this.tacticsOn()) { S.activated.clear(); return; } const e = this.tactics.ops.endOfMonsterRound; const mobs = [...S.activated].filter(m => M.mobs.includes(m) && m.cells.length && !m.decoying && !m.mangrove).sort((a, b) => a.n - b.n); S.activated.clear(); if (!mobs.length) return;
    this.say(`Monster Round 종료 — ${this.tactics.name}: 활성화된 Monster 2칸 이동`, 'ai');
    for (const m of mobs) {
      if (e.lh === 'away') { const ks = this.alive(); if (!ks.length) continue; const cx = ks.reduce((s, k) => s + k.pos.c, 0) / ks.length, cy = ks.reduce((s, k) => s + k.pos.r, 0) / ks.length; const dc = m.cells[0].c - cx, dr = m.cells[0].r - cy; const dir = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc) || 1, r: 0 } : { c: 0, r: Math.sign(dr) || 1 }; let c = m.cells[0]; for (let i = 0; i < e.move; i++) { const nx = { c: c.c + dir.c, r: c.r + dir.r }; if (!this.cellFree(nx, m)) break; c = nx; } if (!cellEq(c, m.cells[0])) { this.mobStepTo(m, c); this.say(`Mob #${m.n} 기사 무리에게서 멀어짐 → ${B.label(c)}`); } continue; }
      let targets = e.lh === 'engaged' ? this.alive().filter(k => this.engaged(k)).map(k => k.pos) : e.lh === 'mangrove' ? this.tileCells('great mangrove') : this.tileCells('swamp'); if (!targets.length) continue;
      const d = c => man(c, m.cells[0]); const t = targets.sort((a, b) => d(a) - d(b))[0]; if (e.lh === 'engaged' ? B.adjacent(m.cells[0], t) : d(t) === 0) continue; await this.mobMoveToward(m, t, e.move, { ask: false });
    }
  },
  async lhOp(o, ctx) {
    if (!this.isLh) return false; const M = this.monster, S = this.lh; const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'lhOnHit': if (ctx.hits > 0 && t && t.alive) for (const x of o.then) { if (!t.alive) break; await this.fx.runMonsterOp(x, ctx); } return true;
      case 'lhPerHit': for (let i = 0; i < (ctx.hits || 0) && t && t.alive; i++) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'lhIfHits': if ((ctx.hits || 0) >= o.gte && (o.lt == null || ctx.hits < o.lt) && t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'lhFlatVigor': if (t && t.alive && ctx.hits > 0) await this.loseVigor(t, o.n + (M.bonuses.vigorLoss || 0) + this.mobAura('mobAttackVigor'), { source: 'attack', perilCheck: true }); return true;
      case 'lhTable': if (t && t.alive && ctx.hits > 0) await this.loseVigor(t, o.table[Math.min(o.table.length, ctx.hits) - 1] + (M.bonuses.vigorLoss || 0) + this.mobAura('mobAttackVigor'), { source: 'attack', perilCheck: true }); return true;
      case 'lhPassion': if (t && t.alive) { t.passion = Math.max(0, t.passion + o.n); this.say(`${t.name} Passion ${o.n} → ${t.passion}`); } return true;
      case 'lhHeat': if (t && t.alive) await this.fx.runKnightOp(o.n > 0 ? { op: 'gainHeat', n: o.n } : { op: 'loseHeat', n: -o.n }, t, {}); return true;
      case 'lhPoison': if (t && t.alive) await this.fx.runKnightOp({ op: 'poison', n: o.n }, t, {}); return true;
      case 'lhPeril': if (t && t.alive) await this.perilCheck(t); return true;
      case 'lhToken': this.lhToken(); return true;
      case 'lhDecoy': this.lhDecoy(src); return true;
      case 'lhNext': { const nx = this.lhNextMob(src, m => !m.decoying && (o.do === 'dwell' ? (m.cells.length || m.mangrove) : m.cells.length && !m.mangrove)); if (!nx) { this.say(`다음 non-Decoying Mob 없음 (${o.do})`); return true; } if (o.do === 'decoy') this.lhDecoy(nx); else await this.lhDwell(nx); return true; }
      case 'lhSignature': if (k && k.alive && src && M.mobs.includes(src) && src.cells.length) { this.say(`Mob #${src.n}: ${k.name}에게 Signature`, 'ai'); await this.withMob(src, () => this.performSignature({ forceTarget: k })); } return true;
      case 'lhFlipDown': { if (this.revealedAura('noFlipDown').length) { this.say('Censor: BP를 뒷면으로 뒤집는 Response 비활성', 'bp'); return true; } const rev = [...M.mobs].filter(m => m.revealed && m !== src).sort((a, b) => a.n - b.n); const m = o.side === 'leftmost' ? rev[0] : rev.at(-1); if (m) { m.revealed = false; this.say(`BP #${m.n} 뒷면으로`, 'bp'); } return true; }
      case 'lhAttach': { const n = o.n === 'all' ? 99 : o.n; for (let i = 0; i < n; i++) { const pool = M.mobs.filter(m => m.decoying && m.cells.length); if (!pool.length) break; const m = o.n === 'all' && pool.length === 1 ? pool[0] : await this.pickMob(pool, `Decoying Mob 선택 — base ring 부착 (더 이상 Decoy 아님) ${o.n === 'all' ? '' : `(${i + 1}/${o.n})`}`); if (!m) break; m.decoying = false; this.say(`Mob #${m.n}: base ring 부착 — 더 이상 Decoy 아님 (${this.board.label(m.cells[0])})`, 'tech'); } return true; }
      case 'lhDiscardConditions': if (k && k.alive && k.conditions.length && await this.yesNo(`${k.name}: 모든 Condition 카드 버리기?`, true)) await this.fx.runKnightOp({ op: 'discardAllConditions' }, k, {}); return true;
      case 'lhAI3LastWound': { const tg = this.priorityLast && this.priorityLast.alive ? this.priorityLast : null; const pile = [M.ai.cards, M.ai.discard].find(p => p.some(c => c.level === 3)); if (!tg || !pile || !src || !src.cells.length) { this.say('Invictus Ultimae: AI 3 또는 대상(Last Knight to wound) 없음'); return true; } const card = pile.find(c => c.level === 3); pile.splice(pile.indexOf(card), 1); this.say(`Invictus Ultimae: AI 3 ${card.name} — ${tg.name}에게 즉시 해결`, 'ai'); try { await this.withMob(src, () => this.resolveMonsterAttack(card, { forceTarget: tg })); } finally { M.ai.discard.push(card); } return true; }
      case 'lhSpeedBonus': { if (!k || !k.alive) return true; const sp = this.fx.speed(k); if (await this.yesNo(`${k.name}: 최대 Speed(${sp})칸 이동?`, false)) await this.knightMove(k, sp); if (k.alive && this.canAttack(k) && await this.yesNo(`${k.name}: Bonus Attack 수행?`, true)) await this.knightAttack(k, { bonus: true }); return true; }
      case 'lhRoutine': for (const x of this.alive()) { await this.loseVigor(x, 5, { source: 'routine' }); if (!x.alive) continue; await this.addCondition(x, 'Panicked'); await this.knockdown(x); } return true;
      default: return false;
    }
  },
};
export const LH_OPS = ['lhOnHit', 'lhPerHit', 'lhIfHits', 'lhFlatVigor', 'lhTable', 'lhPassion', 'lhHeat', 'lhPeril', 'lhPoison', 'lhToken', 'lhDecoy', 'lhNext', 'lhSignature', 'lhFlipDown', 'lhAttach', 'lhDiscardConditions', 'lhAI3LastWound', 'lhSpeedBonus', 'lhRoutine'];
