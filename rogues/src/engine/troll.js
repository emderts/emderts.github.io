// White Ape Troll Boss Clash (Monster Sheet traits + card ops): Firstmen Guardians (Mobs in a Boss Clash sharing one Trait BP),
// Coordinated Attack, Regeneration / Thick Skin, Reinforcements Have Arrived, Vantage Seeker (Tree Climb), Strength in Numbers,
// Avenger of the Tribe, We Are Legion, Unnerving Presence, and 2x2 Boss movement types (Jump, Land on Top, path attacks).
import { DIRS } from './board.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };

export const TrollMixin = {
  trollSetup(cs) {
    const M = this.monster, D = this.monsterDef; this.guardians = []; this.gNext = 1; this.gTokens = 0; this.avTokens = 0; this.flags = this.flags || {}; this.gBonusUsed = new Set();
    if (!D.guardian) return; this.isWAT = true;
    for (const g of cs.guardians || []) this.addGuardian(this.board.parse(g.cell), g.facing);
    if (this.guardians[0]) this.guardians[0].hasBP = true;
    this.thickSkin = null; const ts = (D.cards.bp || []).find(c => c.isThickSkin); if (ts) { this.thickSkin = { ...ts }; M.bp.putTop(this.thickSkin); this.say('Thick Skin BP를 BP 덱 맨 위에'); }
  },
  // ---------- Guardians ----------
  addGuardian(cell, facing = 'E') { const g = { n: this.gNext++, cells: [cell], facing, isGuardian: true, hasBP: false }; this.guardians.push(g); this.board.place({ kind: 'mob', n: 'G' + g.n }, [cell]); return g; },
  guardianAt(cell) { return (this.guardians || []).find(g => cellEq(g.cells[0], cell)) || null; },
  guardianLimit() { const L = this.monsterDef.guardian.limit; return L[String(Math.min(4, this.monster.level))]; },
  trollAdjacent(cell) { return this.monster.cells.some(c => this.board.adjacent(c, cell)); },
  guardianFree(c) { const B = this.board; return B.inside(c) && !B.isObstacle(c) && !this.knightAt(c) && !this.guardianAt(c) && !this.monster.cells.some(m => cellEq(m, c)); },
  async spawnGuardian() {
    const B = this.board; if (this.guardians.length >= this.guardianLimit()) { this.say(`Firstmen Guardians Limit ${this.guardianLimit()} — Spawn 없음`); return null; }
    const cand = []; for (const c of this.tileCells('great mangrove')) for (const n of B.neighbors(c)) if (this.guardianFree(n) && !cand.some(x => cellEq(x, n))) cand.push(n);
    if (!cand.length) { this.say('Guardian Spawn 칸 없음'); return null; } const d = c => B.distance(this.monster.cells, [c]); const best = Math.min(...cand.map(d)); const pool = cand.filter(c => d(c) === best);
    const cell = pool.length > 1 ? await this.ask({ type: 'move', text: 'Firstman Guardian Spawn — White Ape Troll에 가장 가까운 칸 (동률)', cells: pool, options: pool.map(c => ({ label: B.label(c), value: c })) }) || pool[0] : pool[0];
    const g = this.addGuardian(cell); if (!this.guardians.some(x => x.hasBP)) g.hasBP = true; this.say(`Firstman Guardian #${g.n} Spawn → ${B.label(cell)}`, 'ai'); return g;
  },
  killGuardian(g) {
    if (!g || !this.guardians.includes(g)) return; this.board.remove(g.cells); const i = this.guardians.indexOf(g); this.guardians.splice(i, 1); this.say(`Firstman Guardian #${g.n} 처치 (Wound/Escalation 없음)`, 'wound');
    if (g.hasBP && this.guardians.length) { (this.guardians[i] || this.guardians[0]).hasBP = true; }
    if (this.monster.hasTrait('Avenger of the Tribe')) { this.avTokens++; this.say(`Avenger of the Tribe 토큰 ${this.avTokens}/${this.avengerNeed()}`); }
  },
  avengerNeed() { return this.monster.level >= 4 ? 3 : this.monster.level === 3 ? 4 : 5; },
  async withGuardian(g, fn) {
    const M = this.monster; const save = { cells: M.cells, facing: M.facing }; const prev = this.actingGuardian; this.actingGuardian = g; M.cells = g.cells; M.facing = g.facing;
    try { return await fn(); } finally { g.cells = M.cells; g.facing = M.facing; M.cells = save.cells; M.facing = save.facing; this.actingGuardian = prev; }
  },
  async guardianMoveToward(target) {
    const B = this.board, g = this.actingGuardian; const start = g.cells[0]; if (B.adjacent(start, target)) return;
    const pass = c => B.inside(c) && !B.isObstacle(c); const dist = new Map([[B.key(start), 0]]); let fr = [start];
    while (fr.length) { const nx = []; for (const c of fr) for (const n of B.neighbors(c)) { const k = B.key(n); if (dist.has(k) || !pass(n)) continue; dist.set(k, dist.get(B.key(c)) + 1); nx.push(n); } fr = nx; }
    const ends = [...dist.keys()].map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(c => B.adjacent(c, target) && this.guardianFree(c)); if (!ends.length) return;
    const best = Math.min(...ends.map(c => dist.get(B.key(c)))); const pool = ends.filter(c => dist.get(B.key(c)) === best);
    const end = pool.length > 1 ? await this.ask({ type: 'move', text: `Guardian #${g.n} 이동 도착 칸 (동률)`, cells: pool, options: pool.map(c => ({ label: B.label(c), value: c })) }) || pool[0] : pool[0];
    B.remove([start]); g.cells = [end]; this.monster.cells = [end]; B.place({ kind: 'mob', n: 'G' + g.n }, [end]); this.say(`Guardian #${g.n} 이동 ${best}칸 → ${B.label(end)}`);
  },
  async coordinatedAttack(g) { if (!g || !this.alive().length) return; this.say(`Guardian #${g.n}: Coordinated Attack`, 'ai'); await this.withGuardian(g, () => this.resolveMonsterAttack(this.monsterDef.guardian.attack, { guardian: g })); },
  async guardiansToTroll(n = Infinity, { crash = false } = {}) {
    const B = this.board; const order = [...this.guardians].sort((a, b) => B.distance(this.monster.cells, a.cells) - B.distance(this.monster.cells, b.cells));
    for (const g of order) {
      if (this.trollAdjacent(g.cells[0])) continue; const cand = []; for (const c of this.monster.cells) for (const x of B.neighbors(c)) if (B.inside(x) && !B.isObstacle(x) && !this.guardianAt(x) && !this.monster.cells.some(m => cellEq(m, x)) && (crash || !this.knightAt(x)) && !cand.some(y => cellEq(y, x))) cand.push(x);
      if (!cand.length) continue; const d = c => B.distance(g.cells, [c]); const best = Math.min(...cand.map(d)); if (best > n) { await this.withGuardian(g, () => this.guardianMoveToward(this.monster.cells[0])); continue; }
      const pool = cand.filter(c => d(c) === best); const cell = pool.length > 1 ? await this.ask({ type: 'move', text: `Guardian #${g.n} → White Ape Troll 옆 (동률)`, cells: pool, options: pool.map(c => ({ label: B.label(c), value: c })) }) || pool[0] : pool[0];
      const k = this.knightAt(cell); if (k) { this.say(`${k.name}: Guardian이 이동해 옴 → Crash + Unavoidable Knockback 2`); await this.crash(k); if (k.alive) { const dir = { c: Math.sign(cell.c - g.cells[0].c), r: Math.sign(cell.r - g.cells[0].r) }; await this.pushback(k, 2, { unavoidable: true, dir: Math.abs(dir.c) >= Math.abs(dir.r) ? { c: dir.c || 1, r: 0 } : { c: 0, r: dir.r } }); } if (this.knightAt(cell)) continue; }
      B.remove(g.cells); g.cells = [cell]; B.place({ kind: 'mob', n: 'G' + g.n }, [cell]); this.say(`Guardian #${g.n} → ${B.label(cell)} (White Ape Troll 옆)`);
    }
  },
  trollToHit() { if (!this.isWAT || !this.monster.hasTrait('Firstmen Guardians') || this.flags.ignoreGuardianToHit) return { bonus: 0, fullMiss: false }; const n = this.guardians.filter(g => this.trollAdjacent(g.cells[0])).length; return { bonus: n, fullMiss: n >= 4 }; },
  // ---------- round hooks ----------
  async trollStartMR() {
    const M = this.monster; if (!this.isWAT) return; this.gBonusUsed = new Set();
    if (M.hasTrait('Regeneration') && this.thickSkin) { const ts = this.thickSkin; if (M.bp.cards[0] !== ts) { M.bp.cards = M.bp.cards.filter(c => c !== ts); M.bp.discard = M.bp.discard.filter(c => c !== ts); this.thickSkinAside = false; M.bp.putTop(ts); this.say('Regeneration: Thick Skin BP를 BP 덱 맨 위로', 'ai'); } }
    if (M.hasTrait('Firstmen Guardians')) { const n = M.hasTrait('We Are Legion') ? 2 : 1; for (let i = 0; i < n; i++) await this.spawnGuardian(); const h = this.guardians.find(g => g.hasBP); if (h) { await this.coordinatedAttack(h); if (this.guardians.includes(h) && this.guardians.length > 1) { h.hasBP = false; const i = this.guardians.indexOf(h); this.guardians[(i + 1) % this.guardians.length].hasBP = true; } } }
  },
  async trollEndMR() { if (!this.isWAT || !this.monster.hasTrait('Firstmen Guardians') || !this.guardians.length) return; this.say('Monster Round 종료 — Guardians가 White Ape Troll 옆으로', 'ai'); await this.guardiansToTroll(Infinity, { crash: true }); },
  async trollAfterAction() {
    const M = this.monster; if (!this.isWAT || this._trollAfter) return; this._trollAfter = true;
    try {
      if (M.hasTrait('Reinforcements Have Arrived') && this.gTokens >= 4) { this.gTokens = 0; this.say('Reinforcements Have Arrived: Guardian Spawn + Coordinated Attack', 'ai'); const g = await this.spawnGuardian(); const atk = g || this.guardians.find(x => x.hasBP) || this.guardians[0]; if (atk) await this.coordinatedAttack(atk); }
      if (M.hasTrait('Avenger of the Tribe') && this.avTokens >= this.avengerNeed()) { this.avTokens = 0; this.say('Avenger of the Tribe: AI 맨 위 카드 실행', 'ai'); await this.activationAI(); }
    } finally { this._trollAfter = false; }
  },
  onTrollWound(n) { if (this.isWAT && this.monster.hasTrait('Reinforcements Have Arrived') && n > 0) { this.gTokens += n; this.say(`Reinforcements Have Arrived 토큰 ${this.gTokens}/4`); } },
  // ---------- 2x2 movement types ----------
  footprintAt(tl) { return [{ c: tl.c, r: tl.r }, { c: tl.c + 1, r: tl.r }, { c: tl.c, r: tl.r - 1 }, { c: tl.c + 1, r: tl.r - 1 }]; },
  async placeBoss(cells, why) { const B = this.board; B.remove(this.monster.cells); this.monster.cells = cells; B.place({ kind: 'monster', id: this.monster.id }, cells); this.say(`White Ape Troll ${why} → ${cells.map(c => B.label(c)).join('/')}`, 'ai');
    for (const g of [...this.guardians]) if (cells.some(c => cellEq(c, g.cells[0]))) { const n = this.board.neighbors(g.cells[0]).find(x => this.guardianFree(x)); if (n) { B.remove(g.cells); g.cells = [n]; B.place({ kind: 'mob', n: 'G' + g.n }, [n]); } else this.killGuardian(g); } },
  async bossPositions(pred) { const B = this.board; const out = []; for (let c = 1; c < B.cols; c++) for (let r = 1; r < B.rows; r++) { const fp = this.footprintAt({ c, r }); if (fp.every(x => B.inside(x)) && pred(fp)) out.push(fp); } return out; },
  async pickBossPos(list, text) { const B = this.board; const cur = this.monster.cells; const d = fp => B.distance(cur, fp); const best = Math.min(...list.map(d)); const pool = list.filter(fp => d(fp) === best); if (pool.length === 1) return pool[0]; const i = await this.ask({ type: 'pick', text, options: pool.map((fp, i) => ({ label: fp.map(c => B.label(c)).join('/'), value: i })) }); return pool[i] || pool[0]; },
  async bossJump(k) { const B = this.board; const list = await this.bossPositions(fp => fp.some(c => B.adjacent(c, k.pos)) && !fp.some(c => cellEq(c, k.pos)) && fp.every(c => !this.knightAt(c) && !(B.terrainAt(c) && B.terrainAt(c).obstacle))); if (!list.length) return; await this.placeBoss(await this.pickBossPos(list, 'Jump 착지 위치 (동률)'), 'Jump'); this.turnToward(k.pos); },
  async bossLandOnTop(k) { const B = this.board; const list = await this.bossPositions(fp => fp.some(c => cellEq(c, k.pos)) && fp.every(c => !(B.terrainAt(c) && B.terrainAt(c).obstacle))); if (!list.length) return; await this.placeBoss(await this.pickBossPos(list, 'Land on Top 위치 (동률)'), 'Land on Top'); this.faceMostKnights();
    const f = DIRS[this.monster.facing]; const front = this.monster.cells.map(c => ({ c: c.c + f.c, r: c.r + f.r })).filter(c => B.inside(c) && !this.monster.cells.some(m => cellEq(m, c)) && !B.isObstacle(c) && !this.knightAt(c) && !this.guardianAt(c));
    for (const x of this.alive().filter(x => this.monster.cells.some(c => cellEq(c, x.pos)))) { if (x === k && front.length) { const to = front.length > 1 ? await this.ask({ type: 'move', text: `${k.name}: 앞 칸으로 Displace`, cells: front, options: front.map(c => ({ label: B.label(c), value: c })) }) || front[0] : front[0]; this.moveKnight(k, to); this.say(`${k.name} 앞 칸으로 Displace → ${B.label(to)}`); } else await this.displace(x); } },
  async bossTreeClimb() { const B = this.board; const groups = {}; for (const c of this.tileCells('great mangrove')) { const k = Object.keys(groups).find(g => groups[g].some(x => B.adjacent(x, c) || cellEq(x, c))); (groups[k] || (groups[Object.keys(groups).length] = [])).push(c); }
    const list = Object.values(groups).filter(g => g.length === 4).map(g => g.map(c => ({ c: c.c, r: c.r }))); if (!list.length) return; const fp = await this.pickBossPos(list, 'Tree Climb — 가장 가까운 Great Mangrove (동률)');
    for (const x of this.alive().filter(x => fp.some(c => cellEq(c, x.pos)))) await this.displace(x); await this.placeBoss(fp, 'Tree Climb (Vantage Seeker)'); },
  bossDiagramCells(z) { const M = this.monster; const f = DIRS[M.facing], r = DIRS[RIGHT[M.facing]]; const dot = (a, v) => a.c * v.c + a.r * v.r; const fmax = Math.max(...M.cells.map(c => dot(c, f))); const front = M.cells.filter(c => dot(c, f) === fmax); const o = front.reduce((a, b) => dot(a, r) <= dot(b, r) ? a : b);
    return z.red.map(([fw, rt]) => ({ c: o.c + f.c * fw + r.c * rt, r: o.r + f.r * fw + r.r * rt })).filter(c => this.board.inside(c)); },
  // ---------- ops ----------
  async trollOp(o, ctx) {
    const M = this.monster, B = this.board; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'guardianDies': if (ctx.attack && ctx.attack.guardian) this.killGuardian(ctx.attack.guardian); return true;
      case 'guardianBonusAttack': { if (!k || !k.alive) return true; if (!o.always && this.gBonusUsed.has(k.id)) { this.say(`${k.name}: 이번 라운드 Guardian Bonus Attack 이미 사용`); return true; } if (!await this.yesNo(`${k.name} Bonus Attack?`, true)) return true; if (!o.always) this.gBonusUsed.add(k.id); k.bonusAttacks++; return true; }
      case 'strengthInNumbers': if (t && t.alive && M.hasTrait('Strength in Numbers')) { const g = ctx.attack && ctx.attack.ctx && ctx.attack.ctx.guardian; const x = this.guardians.filter(y => y !== g).length; if (x && ctx.hits) { this.say(`Strength in Numbers: 다른 Guardian ${x} → 추가 Vigor -${x}`); await this.loseVigor(t, x, { source: 'attack', armor: false }); } } return true;
      case 'knockbackSide': { if (!t || !t.alive) return true; const f = DIRS[M.facing]; const sides = [{ c: f.r, r: -f.c }, { c: -f.r, r: f.c }]; const nm = d => d.c > 0 ? '오른쪽' : d.c < 0 ? '왼쪽' : d.r > 0 ? '위' : '아래'; const i = await this.ask({ type: 'pick', knight: t.id, text: `${t.name}: Knockback ${o.n} 옆 방향`, options: sides.map((d, i) => ({ label: nm(d), value: i })) }) || 0; await this.pushback(t, o.n, { dir: sides[i] }); return true; }
      case 'bossMoveAway': { if (!k) return true; const c0 = this.monsterCenter(); const dc = c0.c - k.pos.c, dr = c0.r - k.pos.r; const d = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc) || 1, r: 0 } : { c: 0, r: Math.sign(dr) || 1 }; let n = 0; for (let i = 0; i < o.n; i++) { const r = await this.monsterStep(d); if (r === 'edge' || r === 'obstacle') break; n++; } this.say(`White Ape Troll ${k.name}에게서 ${n}칸 멀어짐 (방향 유지)`); await this.displaceKnightsUnderMonster(); return true; }
      case 'guardiansToTroll': await this.guardiansToTroll(o.n); return true;
      case 'signatureAgainstAttacker': if (k && k.alive) { this.say(`${k.name}에게 Signature`, 'ai'); await this.performSignature({ forceTarget: k }); } return true;
      case 'discardMindConditions': if (k) { const before = k.conditions.length; k.conditions = k.conditions.filter(c => { const d = this.conditionDefs[c.id]; return !(d && d.type === 'mind'); }); this.say(`${k.name}: Mind Condition ${before - k.conditions.length}장 버림`); } return true;
      case 'allMayDiscardExposed': for (const x of this.alive()) if (this.hasCondition(x, 'Exposed') && await this.yesNo(`${x.name}: Exposed 버리기?`, true)) this.removeCondition(x, 'Exposed'); return true;
      case 'allDiscardExposed': for (const x of this.alive()) this.removeCondition(x, 'Exposed'); return true;
      case 'bossHeal': for (let i = 0; i < o.n; i++) { const w = M.woundStack.pop(); if (w) this.say(`Heal: Wound Stack 맨 위 제거 (${M.wounds}/${M.woundsToKill})`, 'ai'); } return true;
      case 'vigorByHitsTable': if (t && t.alive && ctx.hits) { const n = o.table[Math.min(o.table.length, ctx.hits) - 1] + M.bonuses.vigorLoss; await this.loseVigor(t, n, { source: 'attack', perilCheck: o.perilCheck }); } return true;
      default: return false;
    }
  },
};
export const TROLL_OPS = ['guardianDies', 'guardianBonusAttack', 'strengthInNumbers', 'knockbackSide', 'bossMoveAway', 'guardiansToTroll', 'signatureAgainstAttacker', 'discardMindConditions', 'allMayDiscardExposed', 'allDiscardExposed', 'bossHeal', 'vigorByHitsTable'];
