// Mob Clash support (rulebook pp.44–48, 50, 60–62, 80–87): the Mob track, per-Mob activations, Mob movement, Gangup / Swarm / Heal /
// Spawn, revealed-BP effects. Mixed into Clash.prototype. In a Mob Clash `monster.cells` / `monster.facing` are accessors for the
// *current* Mob (`monster.cur`), so the Boss attack code (targeting → movement → evasion → effects) is reused per activating Mob.
import { GameOver } from './core.js';
import { faceToward } from './board.js';

const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const axis = d => (d.c ? 'c' : 'r');
const DIR4 = [{ c: 1, r: 0 }, { c: -1, r: 0 }, { c: 0, r: 1 }, { c: 0, r: -1 }];
const FACE = { up: 'N', down: 'S', left: 'W', right: 'E', N: 'N', S: 'S', E: 'E', W: 'W' };

export const MobMixin = {
  // ---------- setup ----------
  setupMobs(cs) {
    const M = this.monster, B = this.board;
    const spots = this.rng.shuffle(cs.mobStart.map(s => ({ ...s })));
    const cards = []; for (const [lv, n] of Object.entries(cs.mobTrack)) for (let i = 0; i < n; i++) { const c = M.bpPool[lv].draw(); if (c) cards.push(c); }
    this.rng.shuffle(cards);
    cards.forEach((card, i) => { const s = spots[i]; this.addMob(card, B.parse(s.cell), FACE[s.facing], i + 1); });
    M.activations.forEach((a, i) => { const mob = M.mobs[i]; if (mob) mob.tokens.push({ type: a.type, ready: true }); });
    this.necro = 0; this.scavengeBonus = 0; this.mobArmorDisabled = false;
    for (const t of this.monsterDef.traits || []) if (M.hasTrait(t.name) && t.implemented === false) this.say(`⚠ Trait ${t.name} (Lv${t.level})는 아직 구현되지 않았습니다`, 'warn');
    this.say(`Mob 배치: ${M.mobs.map(m => `#${m.n} ${B.label(m.cells[0])}(BP${m.card.level})`).join(' · ')}`);
    this.say(`Activation 토큰: ${M.mobs.filter(m => m.tokens.length).map(m => `#${m.n} ${m.tokens.map(t => t.type).join('+')}`).join(', ')}`);
    for (let i = 0; i < (M.bonuses.escalations || 0); i++) { this.say('시작 Escalation'); this.escalateLowestMob({ unrevealedOnly: false }); }
  },
  addMob(card, cell, facing, n, { revealed = false } = {}) {
    const M = this.monster; const mob = { n, card, revealed, cells: cell ? [cell] : [], facing: facing || 'N', armor: 0, tokens: [], blood: 0, offboard: !cell };
    M.mobs.push(mob); M.mobs.sort((a, b) => a.n - b.n); if (cell) this.board.place({ kind: 'mob', n }, [cell]); return mob;
  },
  freeSlot() { for (let n = 1; n <= 10; n++) if (!this.monster.mobs.some(m => m.n === n)) return n; return null; },
  mobAt(cell) { return this.monster.isMob ? this.monster.mobs.find(m => cellEq(m.cells[0], cell)) || null : null; },
  monsterOccupies(cell) { return this.monster.isMob ? !!this.mobAt(cell) : this.monster.cells.some(m => cellEq(m, cell)); },
  adjacentMobs(k) { return this.monster.mobs.filter(m => m.cells.length && this.board.adjacent(m.cells[0], k.pos)); },
  engaged(k) { return this.monster.isMob ? this.adjacentMobs(k).length > 0 : this.adjacentToMonster(k); },
  mobLabel(m) { return `#${m.n} ${m.cells[0] ? this.board.label(m.cells[0]) : '보드 밖'}${m.revealed ? ' ' + m.card.name : ` (BP${m.card.level}?)`}`; },
  async withMob(mob, fn) { const M = this.monster; const prev = M.cur; M.cur = mob; try { return await fn(); } finally { M.cur = prev; } },
  /** Monsters may enter Chasm spaces (Chasm only restricts Knights, p.80); Obstacles and occupied spaces block. */
  cellFree(c, ignore = null) { const B = this.board; const t = B.terrainAt(c); if (!B.inside(c) || (t && t.obstacle) || this.knightAt(c)) return false; const m = this.mobAt(c); return !m || m === ignore; },
  /** Distance for Mob targeting / movement: shortest path excluding occupied and Obstacle spaces (p.50). */
  mobDist(mob, cell) { if (!mob || !mob.cells.length) return Infinity; return this.board.distance(mob.cells, [cell], c => this.cellFree(c, mob)); },

  // ---------- auras of revealed BPs ----------
  mobAura(key) { let n = 0; for (const m of this.monster.mobs || []) if (m.revealed && m.card.ops.aura && typeof m.card.ops.aura[key] === 'number') n += m.card.ops.aura[key]; return n; },
  mobAT(mob) {
    const M = this.monster; let at = mob.card.at + M.bonuses.at + M.modifiers.at + (this.mobArmorDisabled ? 0 : mob.armor) + this.difficultTerrainAT(mob.cells) + (M.hasTrait('Scab Armor') ? mob.blood || 0 : 0);
    for (const o of M.mobs) { if (o === mob || !o.revealed || !o.cells.length || !mob.cells.length) continue; const a = o.card.ops.aura && o.card.ops.aura.atOtherMobsZone; if (a && Math.max(Math.abs(o.cells[0].c - mob.cells[0].c), Math.abs(o.cells[0].r - mob.cells[0].r)) <= a.z) at += a.n; }
    return at;
  },

  // ---------- Monster Round (p.47) ----------
  async mobMonsterRound() {
    const M = this.monster;
    for (const m of M.mobs) for (const t of m.tokens) t.ready = true;
    for (let guard = 0; guard < 40; guard++) {
      const mob = M.mobs.find(m => m.tokens.some(t => t.ready)); if (!mob) break; const tok = mob.tokens.find(t => t.ready);
      M.cur = mob; this.say(`▷ Mob #${mob.n} (${mob.cells[0] ? this.board.label(mob.cells[0]) : '보드 밖'}) 활성화 — ${tok.type === 'AI' ? 'AI' : 'Signature'}`, 'ai');
      if (await this.emergeIfOffboard(mob)) { if (tok.type === 'AI') await this.activationAI(); else await this.performSignature(); }
      if (M.mobs.includes(mob) && mob.tokens.includes(tok)) this.moveToken(mob.n, tok, true); else tok.ready = false;
      await this.afterAction(); this.checkEnd();
    }
    // "While this BP is revealed: At the end of the Monster Round, …"
    for (const mob of [...M.mobs]) { const a = mob.revealed && mob.card.ops.aura && mob.card.ops.aura.endOfMonsterRound; if (!a || !M.mobs.includes(mob)) continue; this.say(`Monster Round 종료 — ${mob.card.name} (#${mob.n})`); await this.withMob(mob, () => this.fx.runMonsterOps(a, { source: mob, targets: this.alive() })); }
    this.checkEnd();
  },
  /** Move an Activation token to the next BP to the right without a token (the track loops); `flip` = spent (p.47). */
  moveToken(fromN, tok, flip) {
    const M = this.monster; const src = M.mobs.find(m => m.tokens.includes(tok)); if (src) src.tokens.splice(src.tokens.indexOf(tok), 1);
    const self = M.mobs.find(m => m.n === fromN); const order = [...M.mobs.filter(m => m.n > fromN), ...M.mobs.filter(m => m.n < fromN), ...(self ? [self] : [])];
    const dest = order.find(m => !m.tokens.length) || order[0]; if (!dest) return;
    dest.tokens.push(tok); if (flip) tok.ready = false;
  },

  // ---------- movement ----------
  /** Directions in which `mob` (standing on `from`) gets strictly closer to `target` along a shortest path around occupied / Obstacle spaces. */
  mobStepOptions(mob, target, from = mob.cells[0]) {
    const B = this.board; const dist = new Map([[B.key(target), 0]]); let frontier = [target];
    while (frontier.length) { const next = []; for (const c of frontier) for (const n of B.neighbors(c)) { const k = B.key(n); if (dist.has(k)) continue; if (!this.cellFree(n, mob) && !cellEq(n, from)) continue; dist.set(k, dist.get(B.key(c)) + 1); next.push(n); } frontier = next; }
    const here = dist.get(B.key(from)); if (here == null) return [];
    return DIR4.filter(d => { const n = { c: from.c + d.c, r: from.r + d.r }; return this.cellFree(n, mob) && dist.get(B.key(n)) === here - 1; });
  },
  /** Preview of a Mob's path for a starting direction (zigzag preference), as a list of footprints. */
  simulateMobPath(mob, target, first, max = Infinity) {
    const B = this.board; let cur = mob.cells[0]; const out = []; let lastAxis = null; let d = first;
    for (let s = 0; s < Math.min(max, 40) && !B.adjacent(cur, target); s++) {
      if (s > 0) { const opts = this.mobStepOptions(mob, target, cur); if (!opts.length) break; d = opts.find(x => axis(x) !== lastAxis) || opts[0]; }
      lastAxis = axis(d); cur = { c: cur.c + d.c, r: cur.r + d.r }; out.push([cur]);
    }
    return out;
  },
  mobStepTo(mob, cell) { const B = this.board; B.remove(mob.cells); mob.cells = [cell]; B.place({ kind: 'mob', n: mob.n }, [cell]); },
  /** Mob movement toward a cell until adjacent (or `max` spaces): shortest path around occupied and Obstacle spaces, zigzag on ties (p.50). */
  async mobMoveToward(mob, target, max = Infinity, { ask = true } = {}) {
    const B = this.board; let steps = 0, lastAxis = null; const from = B.label(mob.cells[0]); const start = mob.cells[0];
    mob.facing = faceToward(mob.cells, target, mob.facing);
    while (steps < max && steps < 60 && !B.adjacent(mob.cells[0], target)) {
      const opts = this.mobStepOptions(mob, target); if (!opts.length) break;
      let d = opts[0];
      if (opts.length > 1) { const alt = lastAxis ? opts.find(x => axis(x) !== lastAxis) : null; if (alt) d = alt; else if (ask) { const i = await this.ask({ type: 'pick', preview: 'path', text: `Mob #${mob.n} 이동 시작 방향 (지그재그) — 옵션을 눌러 경로 미리보기 후 확정`, options: opts.map((x, i) => ({ path: this.simulateMobPath(mob, target, x, max - steps), label: this.dirName(x), value: i })) }); d = opts[i] || opts[0]; } }
      lastAxis = axis(d); this.mobStepTo(mob, { c: mob.cells[0].c + d.c, r: mob.cells[0].r + d.r }); steps++;
    }
    mob.facing = faceToward(mob.cells, target, mob.facing);
    if (steps) this.say(`Mob #${mob.n} 이동 ${steps}칸: ${from} → ${B.label(mob.cells[0])}`);
    if (steps) await this.geyserMob(mob, start);
    return steps;
  },

  // ---------- keywords ----------
  /** Gangup X (p.81 box). */
  async gangup(mob, k, x) {
    const M = this.monster, B = this.board; if (!mob || !mob.cells.length || !M.mobs.includes(mob) || !k || !k.alive) return;
    x += this.mobAura('gangupBonus'); this.say(`Gangup ${x}: Mob #${mob.n} → ${k.name}`, 'ai');
    const moved = await this.mobMoveToward(mob, k.pos, x); const rem = x - moved;
    const others = M.mobs.filter(m => m !== mob && m.cells.length);
    if (others.some(m => B.adjacent(m.cells[0], k.pos))) { this.say(`${k.name}: 이미 다른 Mob과 인접 → Knockdown`); await this.knockdown(k); }
    else if (rem > 0 && others.length && !(k.braced)) {
      const n = Math.max(0, rem - this.fx.involuntaryReduction(k));
      const pass = c => !B.isObstacle(c) && !this.knightAt(c) && (!this.mobAt(c) || this.mobAt(c) === mob);
      const path = B.path(k.pos, c => pass(c) && others.some(m => B.adjacent(m.cells[0], c)), pass);
      if (path && n > 0) {
        const walk = path.slice(0, n); let rubble = false; let prev = k.pos; let end = k.pos;
        for (const c of walk) { const t = B.terrainAt(c); if (t && t.chasm) { this.moveKnight(k, c); await this.die(k, 'Chasm'); return; } if (t && t.id === 'rubble') rubble = true; prev = end; end = c; }
        if (cellEq(end, mob.cells[0])) { this.mobStepTo(mob, prev); this.say(`Mob #${mob.n} Displace → ${B.label(prev)}`); }
        if (!cellEq(end, k.pos)) { this.moveKnight(k, end); this.say(`${k.name} 끌려감 ${walk.length}칸 → ${B.label(end)} (비자발적 이동)`); }
        if (rubble && k.alive) { this.say(`${k.name}: Rubble로 비자발적 이동 → Knockdown`); await this.knockdown(k); }
      }
    }
    if (k.alive && M.mobs.includes(mob)) await this.mobMoveToward(mob, k.pos, Infinity, { ask: false });
  },
  /** Swarm X (p.87): the attacked Knight loses -X Vigor for each other adjacent Monster. */
  async swarm(mob, k, x) { const n = this.monster.mobs.filter(m => m !== mob && m.cells.length && this.board.adjacent(m.cells[0], k.pos)).length; this.say(`Swarm ${x}: 인접한 다른 Mob ${n}`); if (n) await this.loseVigor(k, x * n, { source: 'effect', armor: false }); },
  /** Heal 1 (Mob Clash, p.82): top BP of the Wound Stack returns to the leftmost empty space of the Mob track, adjacent to the source. */
  async healMob(source) {
    const M = this.monster, B = this.board; const i = M.woundStack.length - 1; if (i < 0 || !M.woundStack[i].card) { this.say('Heal: Wound Stack에 BP 없음'); return null; }
    const e = M.woundStack.pop(); const slot = this.freeSlot(); if (!slot) { M.removed.push(e.card); this.say(`Heal: Mob track 가득 → ${e.card.name} 제거 (Wound ${M.wounds}/${M.woundsToKill})`); return null; }
    const origin = source && (source.cells[0] || source.lastCell) || (this.priorityTarget && this.priorityTarget.pos) || { c: 7, r: 4 };
    let cells = B.neighbors(origin).filter(c => this.cellFree(c));
    if (!cells.length) { const all = []; for (let c = 1; c <= B.cols; c++) for (let r = 0; r < B.rows; r++) if (this.cellFree({ c, r })) all.push({ c, r }); const d = x => Math.abs(x.c - origin.c) + Math.abs(x.r - origin.r); const m = Math.min(...all.map(d)); cells = all.filter(x => d(x) === m); }
    if (!cells.length) { M.removed.push(e.card); return null; }
    let cell = cells[0]; if (cells.length > 1) cell = await this.ask({ type: 'move', text: `Heal: ${e.card.name} 배치할 칸`, cells, options: cells.map(c => ({ label: B.label(c), value: c })) }) || cells[0];
    const mob = this.addMob(e.card, cell, 'N', slot, { revealed: true }); await this.withMob(mob, () => this.faceMostKnights());
    this.say(`Heal: ${e.card.name} 복귀 → #${slot} ${B.label(cell)} (Wound ${M.wounds}/${M.woundsToKill})`, 'wound'); return mob;
  },
  /** Interval / Odd Spawn (p.62): lowest-level available BP from the Escalation decks → leftmost empty track space, on an empty Rubble space closest to the Priority Target. */
  async spawnMob() {
    const M = this.monster, B = this.board; const slot = this.freeSlot(); const lv = [1, 2, 3].find(l => M.bpPool[l].size);
    if (!slot || !lv) { this.say('Spawn 불가 (Mob track 가득 또는 BP 없음)'); return null; }
    const pt = this.priorityTarget && this.priorityTarget.alive ? this.priorityTarget : this.alive()[0]; if (!pt) return null;
    const rub = [...B.terrain.entries()].filter(([, t]) => t.id === 'rubble').map(([k]) => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(c => this.cellFree(c));
    if (!rub.length) { this.say('Spawn 불가 (빈 Rubble 칸 없음)'); return null; }
    const d = c => B.distance([c], [pt.pos]); const m = Math.min(...rub.map(d)); const best = rub.filter(c => d(c) === m);
    let cell = best[0]; if (best.length > 1) cell = await this.ask({ type: 'move', text: 'Spawn: Priority Target에 가장 가까운 Rubble 칸 (동률)', cells: best, options: best.map(c => ({ label: B.label(c), value: c })) }) || best[0];
    const mob = this.addMob(M.bpPool[lv].draw(), cell, 'N', slot); if (M.hasTrait('Armored Reawakening')) { mob.armor++; this.say('Armored Reawakening: Armor 토큰 +1'); }
    await this.withMob(mob, () => this.faceMostKnights());
    this.say(`Spawn: Mob #${slot} (BP${mob.card.level}) → ${B.label(cell)}`, 'ai'); return mob;
  },
  killMob(mob) {
    const M = this.monster; mob.lastCell = mob.cells[0]; this.board.remove(mob.cells); M.mobs = M.mobs.filter(x => x !== mob);
    const w = mob.card.level === 3 ? 2 : 1; M.woundStack.push({ card: mob.card, wounds: w, mob }); M.escalateAI(mob.card.level); this.queueMobDeath(mob); this.etherealOnDeath();
    for (const tok of [...mob.tokens]) this.moveToken(mob.n, tok, false); mob.tokens = []; mob.cells = []; mob.dead = true;
    if (M.hasTrait('Necrofusion')) { this.necro += w; this.say(`Necrofusion 토큰 ${this.necro}/3`); }
    this.say(`Mob #${mob.n} ${mob.card.name} 처치${w === 2 ? ' (Double Wound)' : ''}`, 'wound'); return w;
  },
  async mobAfterAction() {
    if (this.bloodOn || this.monster.hasTrait('Subterranean Menace')) await this.bloodAfterAction();
    if (this.monster.hasTrait('Ethereal Unity')) await this.etherealSpawn();
    if (this.monster.hasTrait('Necrofusion') && this.necro >= 3 && !this._spawning) { this.necro = 0; this._spawning = true; try { this.say('Necrofusion: 토큰 3 → Spawn + Signature', 'ai'); const mob = await this.spawnMob(); if (mob) await this.withMob(mob, () => this.performSignature()); } finally { this._spawning = false; } this.checkEnd(); }
  },
  /** Escalate the lowest (unrevealed) Mob: BP → a random BP one level higher in its place, and AI Escalation (p.62). */
  escalateLowestMob({ unrevealedOnly = true } = {}) {
    const M = this.monster; const cand = M.mobs.filter(m => !unrevealedOnly || !m.revealed); if (!cand.length) { this.say('Escalate: 대상 Mob 없음'); return; }
    const lv = Math.min(...cand.map(m => m.card.level)); const mob = cand.find(m => m.card.level === lv);
    const next = M.bpPool[lv + 1] && M.bpPool[lv + 1].size ? M.bpPool[lv + 1].draw() : null;
    if (next) { M.removed.push(mob.card); mob.card = next; mob.revealed = false; this.say(`Escalate: Mob #${mob.n} BP${lv} → BP${next.level}`, 'ai'); } else this.say(`Escalate: Mob #${mob.n} — 더 높은 BP 없음`);
    M.escalateAI(lv);
  },
  async revealMob(mob) {
    if (mob.revealed) return; mob.revealed = true; this.say(`BP 공개: #${mob.n} ${mob.card.name} (AT ${this.mobAT(mob)})`, 'bp');
    if (mob.card.ops.whenRevealed) { this.say(`When revealed — ${mob.card.name}`); await this.withMob(mob, () => this.fx.runMonsterOps(mob.card.ops.whenRevealed, { source: mob, targets: this.alive() })); }
  },
  async pickMob(list, text) { if (!list.length) return null; if (list.length === 1) return list[0]; const n = await this.ask({ type: 'pick', kind: 'mob', text, options: list.map(m => ({ label: this.mobLabel(m), value: m.n })) }); return list.find(m => m.n === n) || list[0]; },
  async pickMobTarget(k) { return this.pickMob(this.attackableMobs ? this.attackableMobs(k) : this.adjacentMobs(k), `${k.name}: 공격할 Mob 선택`); },
  async mobDrawAI(which, ctx) {
    const M = this.monster; let mob = null; const src = ctx.source;
    if (which === 'this') mob = src && M.mobs.includes(src) ? src : null;
    else if (which === 'new') mob = ctx.newMob || null;
    else { const k = ctx.attacker || ctx.target; const list = M.mobs.filter(m => (m !== src || M.mobs.length === 1)); if (!list.length || !k) return; const ds = list.map(m => this.mobDist(m, k.pos)); const fin = ds.filter(d => d < Infinity); const pool = fin.length ? list.filter((m, i) => ds[i] < Infinity) : list; const dd = pool.map(m => this.mobDist(m, k.pos)); const best = which === 'furthest' ? Math.max(...dd) : Math.min(...dd); mob = await this.pickMob(pool.filter((m, i) => dd[i] === best), `Draw AI — ${k.name}에게서 ${which === 'furthest' ? '가장 먼' : '가장 가까운'} Mob (동률)`); }
    if (!mob) { this.say('Draw AI: 대상 Mob 없음'); return; }
    this.say(`Draw AI for Mob #${mob.n}`, 'ai'); if (!(await this.emergeIfOffboard(mob))) return; await this.withMob(mob, () => this.activationAI()); await this.mobAfterAction();
  },

  /** Mob-specific monster ops; returns true when handled. */
  async mobOp(o, ctx) {
    const M = this.monster; if (!M.isMob) return false; const B = this.board;
    const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur; ctx.source = src;
    const t = ctx.target || ctx.primary || ctx.attacker; const live = m => m && M.mobs.includes(m);
    switch (o.op) {
      case 'swarm': if (t && t.alive) await this.swarm(src, t, o.n); return true;
      case 'gangup': if (t && t.alive && live(src)) await this.gangup(src, t, o.n); return true;
      case 'parasitize': case 'bane': if (t && t.alive) await this.fx.runKnightOp({ op: o.op, n: o.n }, t, {}); return true;
      case 'mobIf': {
        let ok = true; const c = o.cond;
        if (c.noOtherKnightInZone != null) { const z = live(src) ? B.zone(src.cells, c.noOtherKnightInZone) : []; ok = !this.alive().some(k => k !== t && z.some(x => cellEq(x, k.pos))); }
        if (c.knightNotAdjacentToOtherMob) ok = !!t && !M.mobs.some(m => m !== src && B.adjacent(m.cells[0], t.pos));
        if (c.knightAdjacentMobs != null) ok = !!t && this.adjacentMobs(t).length >= c.knightAdjacentMobs;
        if (c.vigorLostAtLeast != null) ok = !!ctx.attack && (ctx.attack.vigorLostTotal || 0) >= c.vigorLostAtLeast;
        if (ok) await this.fx.runMonsterOps(o.then, ctx); return true;
      }
      case 'escalateLowestUnrevealed': this.escalateLowestMob({ unrevealedOnly: true }); return true;
      case 'healMob': for (let i = 0; i < (o.n || 1); i++) ctx.newMob = await this.healMob(live(src) ? src : src) || ctx.newMob; return true;
      case 'drawAIFor': await this.mobDrawAI(o.which, ctx); return true;
      case 'armorToken': {
        let list = [];
        if (o.to === 'this') list = live(src) ? [src] : [];
        else if (o.to === 'otherMobsInZone') { const z = live(src) ? B.zone(src.cells, o.z) : []; list = M.mobs.filter(m => m !== src && z.some(x => cellEq(x, m.cells[0]))); }
        else if (o.to === 'closest') { const k = ctx.attacker || t; const origin = (src && (src.cells[0] || src.lastCell)) || (k && k.pos); const pool = M.mobs.filter(m => m !== src && m.cells.length); if (pool.length && origin) { const d = m => Math.abs(m.cells[0].c - origin.c) + Math.abs(m.cells[0].r - origin.r); const best = Math.min(...pool.map(d)); const m = await this.pickMob(pool.filter(x => d(x) === best), 'Armor 토큰을 받을 가장 가까운 Mob (동률)'); list = m ? [m] : []; } }
        for (const m of list) { if (o.ifNone && m.armor > 0) continue; m.armor += o.n || 1; this.say(`Mob #${m.n} Armor 토큰 +${o.n || 1} (${m.armor})`); }
        return true;
      }
      case 'moveOtherMobsToward': { if (!t) return true; const z = B.zone([t.pos], o.z); for (const m of M.mobs.filter(m => m !== src && z.some(x => cellEq(x, m.cells[0])))) await this.mobMoveToward(m, t.pos, o.n, { ask: false }); return true; }
      case 'revealBP': { const un = M.mobs.filter(m => !m.revealed); if (!un.length) return true; await this.revealMob(o.side === 'leftmost' ? un[0] : un.at(-1)); return true; }
      case 'flipBPDown': { const rev = M.mobs.filter(m => m.revealed); if (!rev.length) return true; const n = await this.ask({ type: 'pick', text: '공개된 BP 하나를 뒤집어 비공개로 (선택)', options: [...rev.map(m => ({ label: this.mobLabel(m), value: m.n })), { label: '안 함', value: 'skip' }] }); const m = rev.find(x => x.n === n); if (m) { m.revealed = false; this.say(`Mob #${m.n} BP 비공개로 뒤집음`); } return true; }
      case 'lookBP': { const un = M.mobs.filter(m => !m.revealed); if (!un.length) return true; const m = await this.pickMob(un, '살펴볼 BP 선택'); if (m) { m.peeked = true; this.say(`BP 확인: #${m.n} = ${m.card.name} (AT ${this.mobAT(m)})`, 'bp'); this.flash('card', { title: `BP 확인 — Mob #${m.n}`, name: m.card.name, text: `AT ${this.mobAT(m)}`, cls: 'bp' }); } return true; }
      case 'bonusAttackPower': { const k = ctx.attacker; if (!k || !k.alive) return true; if (o.optional && !await this.yesNo(`${k.name} Bonus Attack (+${o.n} Power)?`, true)) return true; k.pendingAttackFlags = k.pendingAttackFlags || []; k.pendingExtraPool = { ...(k.pendingExtraPool || {}), raw: ((k.pendingExtraPool || {}).raw || 0) + o.n }; k.bonusAttacks++; return true; }
      case 'scavenge': this.scavengeBonus += o.n; this.say(`Scavenge ${o.n}: Aftermath Loot +${o.n}`); return true;
      case 'escalateAI': { const lv = Math.min(...[...M.ai.cards, ...M.ai.discard].map(c => c.level), 3); M.escalateAI(lv); this.say('Escalate AI'); return true; }
      case 'kingdomTrack': this.say(`${o.stat} ${o.n > 0 ? '+' : ''}${o.n}: Rogue's Path에는 Kingdom 트랙 없음 — 효과 없음`); return true;
      case 'winClash': this.say(o.text || '승리 조건 달성!', 'wound'); this.result = 'win'; throw new GameOver('win');
      case 'disableArmorBenefit': this.mobArmorDisabled = true; this.say('Ironcast Dead: Armor 토큰 효과 상실'); return true;
      case 'poolToken': this.poolAdd(o.token, o.n || 1); return true;
      case 'ironcastMarch': {
        for (const mob of [...M.mobs]) { if (!live(mob)) continue; const ks = this.alive(); if (!ks.length) break; const ds = ks.map(k => this.mobDist(mob, k.pos)); const best = Math.min(...ds); let cand = ks.filter((k, i) => ds[i] === best && best < Infinity); if (!cand.length) continue; let k = cand[0]; if (cand.length > 1) { const id = await this.ask({ type: 'pickKnight', text: `Ironcast March: Mob #${mob.n}에 가장 가까운 기사 (동률)`, options: cand.map(x => ({ label: x.name, value: x.id })) }); k = cand.find(x => x.id === id) || cand[0]; } await this.mobMoveToward(mob, k.pos, Infinity, { ask: false }); if (B.adjacent(mob.cells[0], k.pos)) await this.swarm(mob, k, o.n); this.checkEnd(); }
        return true;
      }
      default: return false;
    }
  },
};
export const MOB_OPS = ['swarm', 'gangup', 'parasitize', 'bane', 'mobIf', 'escalateLowestUnrevealed', 'healMob', 'drawAIFor', 'armorToken', 'moveOtherMobsToward', 'revealBP', 'flipBPDown', 'lookBP', 'bonusAttackPower', 'scavenge', 'escalateAI', 'kingdomTrack', 'winClash', 'disableArmorBenefit', 'poolToken', 'ironcastMarch'];
