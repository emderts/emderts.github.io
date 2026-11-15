// Haunts of Utrebant (Monster Sheet traits + card ops): Intangible / Superior Bypass movement, diagram Zone Attacks with Spectral Step,
// Appear Behind, Zone Judgements, Ethereal Unity (Fool's deck Spawn), Obscured Vision, The Grim Gift, Revenge Served Ghastly Cold, No Mercy,
// and the revealed-BP auras. Mixed into Clash.prototype; inert unless the Haunts traits / ops are present.
import { DIRS } from './board.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' };

export const HauntsMixin = {
  hauntsSetup() {
    const M = this.monster; this.intangible = M.hasTrait('Intangible'); this.ethereal = 0;
    this.bypassMobs = (this.monsterDef.basicAbilities || []).some(b => /bypass/i.test(b.name));
    if (M.hasTrait('Ethereal Unity')) { const FD = this.data.decks && this.data.decks.fools; this.fools = FD ? this.rng.shuffle([...FD.cards]) : []; this.foolsDiscard = []; }
  },
  losTo(k) { return this.intangible || this.board.hasLoS(this.monster.cells, [k.pos]); },

  // ---------- movement (Superior Bypass + Intangible) ----------
  /** Path through miniatures (and Terrain if Intangible); the end space must be free. Returns the steps taken. */
  async bypassMoveToward(mob, target, max = Infinity) {
    const B = this.board; const start = mob.cells[0]; const pass = c => B.inside(c) && (this.intangible || !(B.terrainAt(c) && B.terrainAt(c).obstacle));
    const dist = new Map([[B.key(start), 0]]); const prev = new Map(); let fr = [start];
    while (fr.length) { const nx = []; for (const c of fr) for (const n of B.neighbors(c)) { const k = B.key(n); if (dist.has(k) || !pass(n)) continue; dist.set(k, dist.get(B.key(c)) + 1); prev.set(k, c); nx.push(n); } fr = nx; }
    if (B.adjacent(start, target)) return 0;
    const ends = [...dist.keys()].map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(c => B.adjacent(c, target) && this.cellFree(c, mob));
    if (!ends.length) return 0; const best = Math.min(...ends.map(c => dist.get(B.key(c)))); let cand = ends.filter(c => dist.get(B.key(c)) === best);
    let end = cand.length > 1 ? await this.ask({ type: 'move', text: `Mob #${mob.n} 이동 도착 칸 (Bypass, 동률)`, cells: cand, options: cand.map(c => ({ label: B.label(c), value: c })) }) || cand[0] : cand[0];
    if (best > max) { // stop part-way: any free space reachable in `max` steps that still lies on a shortest path to the chosen end
      const de = new Map([[B.key(end), 0]]); let f2 = [end]; while (f2.length) { const nx = []; for (const c of f2) for (const n of B.neighbors(c)) { const k = B.key(n); if (de.has(k) || !pass(n)) continue; de.set(k, de.get(B.key(c)) + 1); nx.push(n); } f2 = nx; }
      let stop = []; for (let s = max; s > 0 && !stop.length; s--) stop = [...dist.keys()].filter(k => dist.get(k) === s && de.get(k) === best - s).map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(c => this.cellFree(c, mob));
      if (!stop.length) return 0; end = stop.length > 1 ? await this.ask({ type: 'move', text: `Mob #${mob.n} 이동 경로 선택 — 멈출 칸`, cells: stop, options: stop.map(c => ({ label: B.label(c), value: c })) }) || stop[0] : stop[0];
    }
    const from = B.label(start); this.mobStepTo(mob, end); const steps = dist.get(B.key(end)) || 0; this.say(`Mob #${mob.n} 이동 ${steps}칸 (Bypass${this.intangible ? '·Intangible' : ''}): ${from} → ${B.label(end)}`); return steps;
  },
  /** Appear Behind (p.50): the furthest space adjacent to the Target. */
  async appearBehind(mob, k) {
    const B = this.board; const from = mob.cells[0]; const cand0 = B.neighbors(k.pos).filter(c => this.cellFree(c, mob)); if (!cand0.length) { this.say('Appear Behind: 빈 칸 없음'); return; }
    const d = c => Math.abs(c.c - from.c) + Math.abs(c.r - from.r); const best = Math.max(...cand0.map(d)); const cand = cand0.filter(c => d(c) === best);
    const cell = cand.length > 1 ? await this.ask({ type: 'move', text: `Appear Behind — ${k.name} 뒤 가장 먼 칸 (동률)`, cells: cand, options: cand.map(c => ({ label: B.label(c), value: c })) }) || cand[0] : cand[0];
    this.mobStepTo(mob, cell); this.turnToward(k.pos); this.say(`Mob #${mob.n} Appear Behind → ${B.label(cell)}`, 'ai');
  },

  // ---------- zones ----------
  /** Card diagram offsets (fwd, right) → board cells for the current Mob position/facing. No Mercy adds the yellow cells. */
  diagramCells(z, mob = this.monster.cur) {
    const o = mob.cells[0]; const f = DIRS[mob.facing]; const r = DIRS[LEFT[LEFT[LEFT[mob.facing]]]]; // right of facing
    const at = ([fw, rt]) => ({ c: o.c + f.c * fw + r.c * rt, r: o.r + f.r * fw + r.r * rt });
    const cells = [...z.red, ...(this.monster.hasTrait('No Mercy') ? z.yellow : [])].map(at).filter(c => this.board.inside(c));
    return { cells, step: z.step ? at(z.step) : null };
  },
  /** Spectral Step: the Haunt appears on the marked space; a Knight there suffers Unavoidable Knockback 3 + Crash (No Mercy: dies). */
  async spectralStep(mob, cell) {
    const B = this.board; if (!this.monster.hasTrait('Spectral Step') || !cell || !this.monster.mobs.includes(mob) || !mob.cells.length) return;
    const c = { c: Math.max(1, Math.min(B.cols, cell.c)), r: Math.max(0, Math.min(B.rows - 1, cell.r)) };
    const other = this.mobAt(c); if (other && other !== mob) { this.say(`Spectral Step: ${B.label(c)}에 다른 Haunt — 이동 생략`); return; }
    const k = this.knightAt(c); B.remove(mob.cells); mob.cells = [c]; B.place({ kind: 'mob', n: mob.n }, [c]); this.say(`Spectral Step: Mob #${mob.n} → ${B.label(c)}`, 'ai');
    if (k) {
      if (this.monster.hasTrait('No Mercy')) { this.say(`${k.name}: No Mercy — Haunt가 기사 칸으로 이동 → 사망`, 'death'); await this.die(k, 'No Mercy'); return; }
      this.say(`${k.name}: Spectral Step — Crash + Unavoidable Knockback 3`); await this.crash(k); if (!k.alive) return; const DN = { N: '위', S: '아래', E: '오른쪽', W: '왼쪽' }; const dk = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Knockback 3 방향 선택 (Spectral Step)`, options: Object.keys(DIRS).map(d => ({ label: DN[d], value: d })) }) || 'N'; await this.pushback(k, 3, { unavoidable: true, dir: DIRS[dk] });
    }
  },

  // ---------- Ethereal Unity ----------
  hauntToHit() { return this.monster.hasTrait('Ethereal Unity') && this.ethereal >= 1 ? 1 : 0; },
  hauntVigorBonus(mob) {
    let n = this.monster.hasTrait('Ethereal Unity') && this.ethereal >= 2 ? 1 : 0;
    if (mob && mob.cells.length) for (const g of this.monster.mobs) if (g.revealed && g.cells.length && g.card.ops.aura && g.card.ops.aura.zone2Vigor && this.board.zone([g.cells[0]], 2).some(c => cellEq(c, mob.cells[0]))) n += g.card.ops.aura.zone2Vigor;
    return n;
  },
  etherealOnDeath() { if (!this.monster.hasTrait('Ethereal Unity')) return; this.ethereal++; this.say(`Ethereal Unity 토큰 ${this.ethereal}${this.ethereal >= 2 ? ' (+1 To Hit, 공격 Vigor -1 추가)' : ' (+1 To Hit)'}`); },
  drawFool() { if (!this.fools.length) { this.fools = this.rng.shuffle(this.foolsDiscard); this.foolsDiscard = []; this.say("Fool's deck 섞음"); } const c = this.fools.shift(); if (c) this.foolsDiscard.push(c); return c; },
  async etherealSpawn() {
    const M = this.monster, B = this.board; if (!M.hasTrait('Ethereal Unity') || this.ethereal < 3) return;
    this.say(`Ethereal Unity: 토큰 ${this.ethereal} → 버리고 Haunt 3마리 Spawn`, 'ai'); this.ethereal = 0; const spawned = [];
    for (let i = 0; i < 3; i++) {
      const slot = this.freeSlot(); const lv = [1, 2, 3].find(l => M.bpPool[l] && M.bpPool[l].size); if (!slot || !lv) { this.say('Spawn 불가 (Mob track 가득 또는 BP 없음)'); break; }
      const fc = this.drawFool(); let lab = fc.coord; if (!lab && fc.coordChoice) lab = await this.ask({ type: 'pick', text: `${fc.name}: 좌표 선택`, options: fc.coordChoice.map(x => ({ label: x, value: x })) }) || fc.coordChoice[0];
      let cell = B.parse(lab); this.say(`Fool's deck: ${fc.name} (${fc.letter}) → ${lab}`);
      if (this.knightAt(cell) || this.mobAt(cell)) { const cand = B.neighbors(cell).filter(c => this.cellFree(c)); if (!cand.length) { this.say(`${lab} 주변에 빈 칸 없음 — Spawn 생략`); continue; } cell = cand.length > 1 ? await this.ask({ type: 'move', text: `${lab}이 점유됨 — 인접한 빈 칸 선택`, cells: cand, options: cand.map(c => ({ label: B.label(c), value: c })) }) || cand[0] : cand[0]; }
      const m = this.addMob(M.bpPool[lv].draw(), cell, 'S', slot); await this.withMob(m, () => this.faceMostKnights()); spawned.push(m); this.say(`Spawn: Haunt #${slot} (BP${lv}) → ${B.label(cell)}`, 'ai');
    }
    // Assign Activation tokens starting from the left of the Mob track
    const toks = [...M.mobs.flatMap(m => m.tokens.splice(0)), ...(this.orphanTokens || []).splice(0)]; M.mobs.forEach((m, i) => { if (toks[i]) m.tokens.push(toks[i]); }); if (toks.length > M.mobs.length) M.mobs[M.mobs.length - 1].tokens.push(...toks.slice(M.mobs.length));
    this.say(`Activation 토큰 재배치: ${M.mobs.filter(m => m.tokens.length).map(m => `#${m.n}:${m.tokens.map(t => t.type).join('')}`).join(' ')}`);
    if (spawned.length && M.hasTrait('Revenge Served Ghastly Cold') && !(this.round === 1 && this.phase === 'monster')) { const lm = M.mobs[0]; this.say(`Revenge Served Ghastly Cold: 가장 왼쪽 Haunt #${lm.n} Signature`, 'ai'); await this.withMob(lm, () => this.performSignature()); }
  },

  // ---------- Knight-side modifiers ----------
  hauntPrecision(k) { let p = k.permPrecision || 0; if (this.monster.hasTrait('Obscured Vision') && this.tileCells('ruined wall').some(c => this.board.adjacent(c, k.pos))) p -= 2; return p; },
  /** Woolf: a Knight within Zone 2 of revealed Woolf can only attack Woolf. */
  attackableMobs(k) {
    const adj = this.adjacentMobs(k); const lock = this.monster.mobs.find(m => m.revealed && m.cells.length && m.card.ops.aura && m.card.ops.aura.woolfLock && this.board.zone([m.cells[0]], m.card.ops.aura.woolfLock).some(c => cellEq(c, k.pos)));
    return lock ? adj.filter(m => m === lock) : adj;
  },
  allGatesOn() { return (this.monster.mobs || []).some(m => m.revealed && m.card.ops.aura && m.card.ops.aura.allGates); },

  // ---------- ops ----------
  async hauntOp(o, ctx) {
    const M = this.monster, B = this.board; const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'attackVigor': if (t && t.alive) await this.loseVigor(t, o.n + M.bonuses.vigorLoss + this.hauntVigorBonus(src), { source: 'attack', perilCheck: o.perilCheck, armor: false }); return true;
      case 'vigorByHits': if (t && t.alive) { const n = Math.max(0, (ctx.hits >= 2 ? o.more : o.one) + M.bonuses.vigorLoss + this.hauntVigorBonus(src) + (this.monsterDef.battleTactics ? this.firstmenVigorFlat(t, src) : 0)); await this.loseVigor(t, n, { source: 'attack', perilCheck: o.perilCheck }); } return true;
      case 'moveAway': { if (!src || !src.cells.length || !t) return true; const d = { c: Math.sign(src.cells[0].c - t.pos.c), r: Math.sign(src.cells[0].r - t.pos.r) }; const dir = Math.abs(src.cells[0].c - t.pos.c) >= Math.abs(src.cells[0].r - t.pos.r) ? { c: d.c || 1, r: 0 } : { c: 0, r: d.r || 1 }; let cur = src.cells[0], last = null; for (let i = 0; i < o.n; i++) { const nx = { c: cur.c + dir.c, r: cur.r + dir.r }; if (!B.inside(nx)) break; cur = nx; if (this.cellFree(nx, src)) last = nx; } if (last) { const from = B.label(src.cells[0]); this.mobStepTo(src, last); this.say(`Mob #${src.n} ${t.name}에게서 멀어짐: ${from} → ${B.label(last)}`); } return true; }
      case 'forcedVault': { if (!t || !t.alive || !src || !src.cells.length || !B.adjacent(src.cells[0], t.pos)) return true; const c = { c: 2 * src.cells[0].c - t.pos.c, r: 2 * src.cells[0].r - t.pos.r }; const ter = B.inside(c) && B.terrainAt(c); if (!B.inside(c) || (ter && ter.obstacle && ter.indestructible)) { this.say(`${t.name}: Forced Vault — 보드 밖/파괴불가 장애물 → 사망`, 'death'); await this.die(t, 'Forced Vault'); return true; } if (this.knightAt(c) || this.mobAt(c)) { this.say(`${t.name}: Forced Vault 칸이 점유됨 → 인접 칸으로 Displace`); this.moveKnight(t, c); await this.displace(t); return true; } this.moveKnight(t, c); this.say(`${t.name}: Forced Vault → ${B.label(c)}`); return true; }
      case 'permanentPrecision': if (k) { k.permPrecision = (k.permPrecision || 0) + o.n; this.say(`${k.name}: 영구 Precision +${o.n} 토큰 (총 ${k.permPrecision})`); } return true;
      case 'placeSwampUnderMob': { const at = src && (src.cells[0] || src.lastCell); if (!at) return true; const free = c => B.inside(c) && !B.terrainAt(c); const adj = B.neighbors(at).filter(free); const pick = adj.length > 1 ? await this.ask({ type: 'move', text: 'Percy: 1x2 Swamp 타일의 두 번째 칸 (Terrain 없는 칸 우선)', cells: adj, options: adj.map(c => ({ label: B.label(c), value: c })) }) || adj[0] : adj[0] || B.neighbors(at).find(c => B.inside(c)); const def = this.data.terrain.terrain.find(x => x.name === 'Swamp'); for (const c of [at, pick].filter(Boolean)) B.terrain.set(B.key(c), { id: 'swamp', name: 'Swamp', obstacle: false, chasm: false, difficult: def ? def.keywords.includes('Difficult Terrain') : true }); this.say(`Percy: Swamp 1x2 → ${[at, pick].filter(Boolean).map(c => B.label(c)).join(', ')}`); return true; }
      case 'escalateLowestAI': { const lv = Math.min(...[...M.ai.cards, ...M.ai.discard].map(c => c.level)); M.escalateAI(lv); return true; }
      case 'delay': if (t && t.alive) { this.say(`${t.name}: Delay`); await this.fx.runKnightOps([{ op: 'delay', n: o.n || 1 }], t, {}); } return true;
      case 'story': this.say(`이야기 참조: ${o.ref} (Clash 후 확인)`, 'warn'); return true;
      case 'gainCurse': this.curseLevel = (this.curseLevel || 0) + o.n; this.say(`Curse +${o.n} → 공용 Curse ${this.curseLevel}`, 'warn'); return true;
      case 'flipChosenBP': { if (!await this.yesNo('BP 카드 하나를 뒤집을까요?', true)) return true; const m = await this.pickMob(M.mobs, '뒤집을 BP 카드'); if (m) { m.revealed = !m.revealed; this.say(`Mob #${m.n} BP ${m.revealed ? '앞면' : '뒷면'}으로`); } return true; }
      case 'mobSignatureAgainst': { if (!k || !k.alive) return true; const pool = M.mobs.filter(m => m.cells.length && m !== src); if (!pool.length) return true; const d = m => B.distance(m.cells, [k.pos]); const v = pool.map(d); const want = o.which === 'furthest' ? Math.max(...v) : Math.min(...v); const m = await this.pickMob(pool.filter((x, i) => v[i] === want), `${o.which === 'furthest' ? '가장 먼' : '가장 가까운'} Mob (동률)`); this.say(`Mob #${m.n}이 ${k.name}에게 Signature`, 'ai'); await this.withMob(m, () => this.performSignature({ forceTarget: k })); return true; }
      default: return false;
    }
  },
};
export const HAUNT_OPS = ['delay', 'attackVigor', 'vigorByHits', 'moveAway', 'forcedVault', 'permanentPrecision', 'placeSwampUnderMob', 'escalateLowestAI', 'story', 'gainCurse', 'flipChosenBP', 'mobSignatureAgainst'];
