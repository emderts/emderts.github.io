// Paleblood Worms (Principality of Stone Codex p.44–45; Monster Sheet traits): Knight Blood tokens (Bloodrush), Blood on BP cards
// (It Sucks! / Suck X / Blood gates), Bloodbath / Bloodline, Subterranean Menace (Worms outside the board, Burrow X, Paleburrows),
// Red Soil, Scab Armor, Bloodgeyser, Paleburrow lure. Mixed into Clash.prototype; every hook is inert unless the trait is present.
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const MAX_BLOOD = 5;

export const BloodMixin = {
  // ---------- setup ----------
  bloodSetup() {
    const M = this.monster; this.bloodOn = M.hasTrait('Bloodrush'); this.redSoil = 0; this.pendingDeaths = []; this.burrowChoice = false;
    if (!this.bloodOn) return;
    for (const k of this.knights) k.blood = MAX_BLOOD;
    this.say(`Bloodrush: 각 기사 Blood ${MAX_BLOOD}`);
    for (const m of M.mobs) m.blood = 0;
    if (M.hasTrait('Scab Armor')) { for (const m of M.mobs) m.blood = 1; this.say('Scab Armor: Mob track의 모든 BP에 Blood 1'); }
  },
  tileCells(id) { return [...this.board.terrain.entries()].filter(([, t]) => t.id === id).map(([k, t]) => { const [c, r] = k.split(',').map(Number); return { c, r, num: t.num }; }); },
  paleburrow(n) { return this.tileCells('paleburrow').find(c => c.num === n) || null; },
  onBoard(m) { return !!(m && m.cells && m.cells.length); },
  mobBlood(m = this.monster.cur) { return m ? m.blood || 0 : 0; },
  bloodAura(key) { let n = 0; for (const m of this.monster.mobs || []) if (m.revealed && m.card.ops.aura && m.card.ops.aura[key]) n += m.card.ops.aura[key] === true ? 1 : m.card.ops.aura[key]; return n; },

  // ---------- Knight Blood ----------
  async knightGainBlood(k, n) {
    if (!this.bloodOn || !k.alive || n <= 0) return; const before = k.blood; k.blood = Math.min(MAX_BLOOD, k.blood + n); const over = before + n - k.blood;
    this.say(`${k.name} Blood +${k.blood - before} → ${k.blood}${over ? ` (초과 ${over} 버림)` : ''}`); if (over) this.bloodDiscarded(over);
  },
  /** Remove Blood from a Knight. `discard` = the tokens go to the supply (Red Soil catches them); otherwise they are moved elsewhere by the caller. */
  async knightLoseBlood(k, n, { discard = true, why = '' } = {}) {
    if (!this.bloodOn || !k.alive || n <= 0) return 0; const take = Math.min(n, k.blood); k.blood -= take;
    this.say(`${k.name} Blood -${take} → ${k.blood}${why ? ' (' + why + ')' : ''}`); if (discard && take) this.bloodDiscarded(take);
    if (k.blood <= 0 && !k.incarnated) { this.say(`${k.name}: Blood 0 → 출혈사 (Bloodrush)`, 'death'); await this.die(k, 'Bled out (Bloodrush)'); }
    return take;
  },
  bloodDiscarded(n) { if (!this.bloodOn || n <= 0) return; if (this.monster.hasTrait('Red Soil')) { this.redSoil += n; this.say(`Red Soil 토큰 ${this.redSoil}`); } },
  mobAddBlood(m, n, why = '') { if (!m || n <= 0) return; m.blood = (m.blood || 0) + n; this.say(`Mob #${m.n} Blood +${n} → ${m.blood}${why ? ' (' + why + ')' : ''}`); },
  mobDiscardBlood(m, n = 'all') { if (!m) return 0; const take = n === 'all' ? m.blood || 0 : Math.min(n, m.blood || 0); m.blood = (m.blood || 0) - take; if (take) { this.say(`Mob #${m.n} Blood -${take} → ${m.blood}`); this.bloodDiscarded(take); } return take; },
  /** Suck X (It Sucks!): move X Blood from the Target / Attacker onto this Worm's BP. Revealed BPs may raise every Suck value. */
  async suck(m, k, n) {
    const M = this.monster; if (!M.hasTrait('It Sucks!')) { this.say('Suck: It Sucks! 비활성'); return; } if (!m || !k || !k.alive) return;
    n += this.bloodAura('suckBonus'); const got = await this.knightLoseBlood(k, n, { discard: false, why: `Suck ${n}` }); this.mobAddBlood(m, got, 'Suck');
  },

  // ---------- Worms on / off the board ----------
  removeFromBoard(m, why = '') { if (!this.onBoard(m)) return; m.lastCell = m.cells[0]; this.board.remove(m.cells); m.cells = []; m.offboard = true; this.say(`Mob #${m.n} 보드 밖으로${why ? ' (' + why + ')' : ''}`); },
  freePaleburrows(ignore = null) { return this.tileCells('paleburrow').filter(c => { const o = this.mobAt(c); return !this.knightAt(c) && (!o || o === ignore); }); },
  async placeMob(m, cell, why) {
    const B = this.board; if (this.onBoard(m)) B.remove(m.cells); m.cells = [{ c: cell.c, r: cell.r }]; m.offboard = false; B.place({ kind: 'mob', n: m.n }, m.cells);
    await this.withMob(m, () => this.faceMostKnights()); this.say(`Mob #${m.n} → ${B.label(cell)}${why ? ' (' + why + ')' : ''}`, 'ai');
  },
  /** Burrow X: onto Paleburrow X; if another Worm is there, the closest free Paleburrow to it. */
  async burrow(m, x) {
    if (!m || !this.monster.mobs.includes(m)) return;
    if (this.bloodAura('burrowRoll')) { const r = this.rng.die(10); this.say(`Tunnelling Bloodworm: Burrow → d10 = ${r}`, 'dice'); x = r; }
    if (this.burrowChoice) { const v = await this.ask({ type: 'number', text: `Burrow X 값 선택 (Tunnelling Bloodworm Critical) — 원래 ${x}`, min: 1, max: 10, default: x, options: [...Array(10)].map((_, i) => ({ label: String(i + 1), value: i + 1 })) }); if (v) x = v; }
    const tile = this.paleburrow(x); if (!tile) { this.say(`Burrow ${x}: Paleburrow 없음`); return; }
    const occ = this.mobAt(tile); if (occ && occ !== m) await this.displaceMob(occ, tile, m);
    const kn = this.knightAt(tile); if (kn) { this.say(`${kn.name}: Paleburrow #${x}의 Worm 등장 → Displace`); await this.displace(kn); }
    await this.placeMob(m, tile, `Burrow ${x}`);
  },
  /** Displace (p.80-ish): the Mob moves to the closest unoccupied space adjacent to where it stood (ties → player). */
  async displaceMob(o, from, incoming = null) {
    const B = this.board; const free = x => this.cellFree(x, o) && !cellEq(x, from); let cand = B.neighbors(from).filter(free);
    if (!cand.length) { const seen = new Set([B.key(from)]); let fr = [from]; while (fr.length && !cand.length) { const nx = []; for (const c of fr) for (const n of B.neighbors(c)) { if (seen.has(B.key(n))) continue; seen.add(B.key(n)); nx.push(n); } cand = nx.filter(free); fr = nx; } }
    if (!cand.length) { this.removeFromBoard(o, 'Displace 불가'); return; }
    const cell = cand.length > 1 ? await this.ask({ type: 'move', text: `Mob #${o.n} Displace — 옮길 칸`, cells: cand, options: cand.map(c => ({ label: B.label(c), value: c })) }) || cand[0] : cand[0];
    B.remove(o.cells); o.cells = [cell]; B.place({ kind: 'mob', n: o.n }, [cell]); this.say(`Mob #${o.n} Displace → ${B.label(cell)}`);
  },
  /** Subterranean Menace: a Worm outside the board that is about to activate goes to the Paleburrow closest to the Priority Target. */
  async emergeIfOffboard(m) {
    if (!m || this.onBoard(m)) return true; if (m.mangrove) { this.say(`Mob #${m.n}: Great Mangrove 위 — 활성화 불가`); return false; } const pt = this.priorityTarget && this.priorityTarget.alive ? this.priorityTarget : this.alive()[0]; if (!pt) return false;
    const free = this.freePaleburrows(); if (!free.length) { this.say(`Mob #${m.n}: 빈 Paleburrow 없음 — 보드 밖에 머묾`); return false; }
    const d = c => this.board.distance([c], [pt.pos]); const best = Math.min(...free.map(d)); const cand = free.filter(c => d(c) === best);
    const cell = cand.length > 1 ? await this.ask({ type: 'move', text: `Mob #${m.n} 등장: Priority Target(${pt.name})에 가장 가까운 Paleburrow (동률)`, cells: cand, options: cand.map(c => ({ label: `${this.board.label(c)} (#${c.num})`, value: c })) }) || cand[0] : cand[0];
    await this.placeMob(m, cell, `Subterranean Menace — Paleburrow #${cell.num}`); return true;
  },
  /** Knight action (Paleburrow tile text): adjacent to a Paleburrow, discard 1 Blood to lure a Worm that is off the board onto it. */
  lureOptions(k) {
    if (!this.bloodOn || !k.alive || k.blood < 1) return []; const off = this.monster.mobs.filter(m => !this.onBoard(m)); if (!off.length) return [];
    return this.freePaleburrows().filter(c => this.board.adjacent(c, k.pos)).map(c => ({ id: 'lure:' + this.board.label(c), label: `Paleburrow #${c.num}(${this.board.label(c)})로 Worm 유인 (Blood 1 버림)` }));
  },
  async lure(k, label) {
    const cell = this.board.parse(label); const t = this.board.terrainAt(cell); const off = this.monster.mobs.filter(m => !this.onBoard(m)); if (!off.length) return;
    const m = await this.pickMob(off, '유인할 보드 밖 Worm'); await this.knightLoseBlood(k, 1, { why: 'Paleburrow 유인' }); if (!k.alive) return;
    await this.placeMob(m, { ...cell, num: t && t.num }, `${k.name}이 유인`);
  },

  // ---------- death / spawn ----------
  /** Called from killMob: Bloodbath waits until the current Knight Attack finished its Responses (the Worm dies at step 8). */
  queueMobDeath(m) { if (this.bloodOn || this.monster.hasTrait('Subterranean Menace')) this.pendingDeaths.push(m); },
  async resolveMobDeaths() {
    const M = this.monster, B = this.board;
    while (this.pendingDeaths.length) {
      const m = this.pendingDeaths.shift(); m.spawnPending = M.hasTrait('Subterranean Menace');
      const n = m.blood || 0; if (!n || !M.hasTrait('Bloodbath') || this.bloodAura('disableBloodbath')) { if (n && this.bloodAura('disableBloodbath')) { this.say('Bursting Bloodworm: Bloodbath 비활성'); } continue; }
      const origin = m.lastCell; const zone = origin ? B.zone([origin], n) : [];
      if (M.hasTrait('Bloodline')) { const others = M.mobs.filter(o => this.onBoard(o) && zone.some(c => cellEq(c, o.cells[0]))); if (others.length) { const o = await this.pickMob(others, `Bloodline: Blood ${n}을 받을 Worm`); m.blood = 0; this.mobAddBlood(o, n, 'Bloodline'); continue; } }
      const ks = this.alive().filter(k => zone.some(c => cellEq(c, k.pos)));
      this.say(`Bloodbath: Mob #${m.n}의 Blood ${n} → Zone ${n} 안의 기사 ${ks.length}명`, 'ai'); m.blood = 0;
      if (!ks.length) { this.bloodDiscarded(n); continue; }
      let left = n; while (left > 0) { const id = ks.length === 1 ? ks[0].id : await this.ask({ type: 'pickKnight', text: `Bloodbath: Blood 1 받을 기사 (남은 ${left})`, options: ks.map(k => ({ label: `${k.name} (Blood ${k.blood})`, value: k.id })) }); const k = ks.find(x => x.id === id) || ks[0]; await this.knightGainBlood(k, 1); left--; }
    }
  },
  /** Immediate Spawn (p.62) via Subterranean Menace: a BP one level higher than the wounded one, outside the board. */
  async spawnWorms() {
    const M = this.monster;
    for (const st of M.woundStack) {
      const m = st.mob; if (!m || !m.spawnPending) continue; m.spawnPending = false;
      const lv = m.card.level + 1; const slot = this.freeSlot(); const deck = M.bpPool[lv];
      if (!deck || !deck.size) { this.say(`Spawn: BP${lv} 없음 → Bloodbath: Mob track의 모든 카드에 Blood 1`, 'ai'); for (const o of M.mobs) this.mobAddBlood(o, 1, 'Escalation 덱 소진'); continue; }
      if (!slot) { this.say('Spawn 불가 (Mob track 가득)'); continue; }
      const nm = this.addMob(deck.draw(), null, 'N', slot); nm.blood = M.hasTrait('Scab Armor') ? 1 : 0;
      this.say(`Subterranean Menace: 새 Worm #${slot} (BP${lv}) — 보드 밖에서 대기${nm.blood ? ' · Scab Armor Blood 1' : ''}`, 'ai');
    }
  },
  /** Activate X (keyword and Red Soil, owner 2026-11-15): like a normal Mob activation — the Mob holding the (AI) Activation token draws AI,
   *  then the token passes to the next Mob to the right; repeated X times. The token keeps its spent/unspent state. */
  async activateMobs(src, n) {
    const M = this.monster;
    for (let i = 0; i < n; i++) {
      const holder = M.mobs.find(m => m.tokens.some(t => t.type === 'AI')) || M.mobs.find(m => m.tokens.length); if (!holder) { this.say('Activate: Activation 토큰 없음'); return; }
      const tok = holder.tokens.find(t => t.type === 'AI') || holder.tokens[0]; const ready = tok.ready;
      this.say(`Activate: ${tok.type} 토큰을 가진 Mob #${holder.n}`, 'ai');
      if (await this.emergeIfOffboard(holder)) { if (tok.type === 'AI') await this.withMob(holder, () => this.activationAI()); else await this.withMob(holder, () => this.performSignature()); }
      if (M.mobs.includes(holder) && holder.tokens.includes(tok)) { this.moveToken(holder.n, tok, false); tok.ready = ready; }
    }
  },
  async bloodAfterAction() {
    const M = this.monster; if (this._bloodAfter) return; this._bloodAfter = true;
    try {
      await this.resolveMobDeaths(); await this.spawnWorms();
      if (M.hasTrait('Red Soil') && this.redSoil >= 3) { const n = Math.floor(this.redSoil / 3); this.say(`Red Soil: 토큰 ${this.redSoil} → Activate ${n}`, 'ai'); this.redSoil = 0; await this.activateMobs(null, n); await this.resolveMobDeaths(); await this.spawnWorms(); }
    } finally { this._bloodAfter = false; }
  },

  // ---------- Bloodgeyser ----------
  onGeyser(cell) { const t = cell && this.board.terrainAt(cell); return !!(t && t.id === 'bloodgeyser'); },
  async geyserMob(m, start) { if (!this.bloodOn || !m || !this.onBoard(m)) return; if (this.onGeyser(start) || this.onGeyser(m.cells[0])) this.mobAddBlood(m, 1, 'Bloodgeyser'); },
  async geyserKnight(k, start) { if (!this.bloodOn || !k.alive) return; if ((this.onGeyser(start) || this.onGeyser(k.pos)) && k.passion > 0) await this.knightLoseBlood(k, k.passion, { why: 'Bloodgeyser (Passion만큼)' }); },

  // ---------- ops ----------
  async bloodOp(o, ctx) {
    const M = this.monster, B = this.board; const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    const knightPick = async (list, text) => { if (!list.length) return null; if (list.length === 1) return list[0]; const id = await this.ask({ type: 'pickKnight', text, options: list.map(x => ({ label: `${x.name} (Blood ${x.blood})`, value: x.id })) }); return list.find(x => x.id === id) || list[0]; };
    const closestKnight = async () => { if (!src) return null; const origin = src.cells[0] || src.lastCell; if (!origin) return null; const ks = this.alive(); const d = x => B.distance([origin], [x.pos]); const best = Math.min(...ks.map(d)); return knightPick(ks.filter(x => d(x) === best), '가장 가까운 기사 (동률)'); };
    switch (o.op) {
      case 'suck': if (t) await this.suck(src, t, o.n); return true;
      case 'suckPerHits': { const h = ctx.attack && ctx.attack.firstHits ? ctx.attack.firstHits[t.id] || 0 : ctx.hits || 0; const n = Math.floor(h / o.per) * o.n; if (n) await this.suck(src, t, n); return true; }
      case 'burrow': await this.burrow(src, o.n); return true;
      case 'burrowRoll': { const r = this.rng.die(10); this.say(`Burrow X: d10 = ${r}`, 'dice'); await this.burrow(src, r); return true; }
      case 'closestWormBurrow': { const origin = src && (src.cells[0] || src.lastCell); const pool = M.mobs.filter(m => m !== src && this.onBoard(m)); if (!pool.length || !origin) return true; const d = m => Math.abs(m.cells[0].c - origin.c) + Math.abs(m.cells[0].r - origin.r); const best = Math.min(...pool.map(d)); const m = await this.pickMob(pool.filter(x => d(x) === best), '가장 가까운 Worm (동률)'); await this.burrow(m, o.n); return true; }
      case 'chooseBurrow': this.burrowChoice = true; this.say('Tunnelling Bloodworm Critical: Clash 끝까지 Burrow X 값을 선택'); return true;
      case 'activate': await this.activateMobs(src, o.n); return true;
      case 'removeOtherWorms': for (const m of M.mobs.filter(m => m !== src)) this.removeFromBoard(m, 'Bite from Below'); return true;
      case 'removeSelf': if (src && M.mobs.includes(src)) this.removeFromBoard(src); return true;
      case 'discardMobBlood': this.mobDiscardBlood(src, 'all'); return true;
      case 'discardHalfMobBlood': this.mobDiscardBlood(src, Math.ceil((src.blood || 0) / 2)); return true;
      case 'vigorToZero': if (t && t.alive) { const n = t.vigor; this.say(`${t.name}: Vigor를 0으로`); await this.loseVigor(t, n, { source: 'attack', perilCheck: o.perilCheck, armor: false }); } return true;
      case 'dieIfAdjacentToTile': if (t && t.alive && this.tileCells(o.tile).some(c => B.adjacent(c, t.pos))) { this.say(`${t.name}: Paleburrow에 인접 → 사망`, 'death'); await this.die(t, 'Suppertime!'); } return true;
      case 'repeatIfTargetDied': if (t && !t.alive && ctx.attack) ctx.attack.repeatAfter = 'chain'; return true;
      case 'loseVigorFromBlood': if (k) await this.loseVigor(k, src ? src.blood || 0 : 0, { source: 'response', perilCheck: o.perilCheck, armor: false }); return true;
      case 'loseVigorPerBlood': if (k) await this.loseVigor(k, o.n * (src ? src.blood || 0 : 0), { source: 'response', perilCheck: o.perilCheck, armor: false }); return true;
      case 'attackerGainVigor': if (k) { k.gainVigor(o.n); this.say(`${k.name} Vigor +${o.n} → ${k.vigor}`); } return true;
      case 'bloodFromBPToAttacker': { const pool = M.mobs.filter(m => (m.blood || 0) > 0); if (!pool.length || !k) return true; const m = await this.pickMob(pool, 'Blood 1을 가져올 BP 카드'); m.blood--; this.say(`Mob #${m.n} Blood -1 → ${m.blood}`); await this.knightGainBlood(k, 1); return true; }
      case 'closestKnightDiscardsBlood': { const x = await closestKnight(); if (x) await this.knightLoseBlood(x, o.n, { why: src ? src.card.name : '' }); return true; }
      case 'eachKnightDiscardsBlood': for (const x of this.alive()) await this.knightLoseBlood(x, o.n, { why: ctx.routine ? 'Global Worming' : (src ? src.card.name : '') }); return true;
      case 'stealBlood': { const list = o.from === 'each' ? this.alive() : [await closestKnight()].filter(Boolean); for (const x of list) { const got = await this.knightLoseBlood(x, o.n, { discard: false, why: src.card.name }); this.mobAddBlood(src, got); } return true; }
      case 'bloodOrVigor': for (const x of this.alive()) { const opt = await this.ask({ type: 'pick', knight: x.id, text: `Diseased Bloodworm — ${x.name}: Vigor -${x.blood}(가진 Blood만큼) 또는 Blood -${x.passion}(Passion만큼)`, options: [{ label: `Vigor -${x.blood}`, value: 'vigor' }, { label: `Blood -${x.passion}`, value: 'blood' }] }); if (opt === 'blood') await this.knightLoseBlood(x, x.passion, { why: 'Diseased Bloodworm' }); else await this.loseVigor(x, x.blood, { source: 'response', armor: false }); } return true;
      case 'knightsGainBlood': {
        const ask = async x => { const n = await this.ask({ type: 'number', knight: x.id, text: `${x.name}: Blood 얻기 (최대 ${o.upTo})`, min: 0, max: o.upTo, default: o.upTo, options: [...Array(o.upTo + 1)].map((_, i) => ({ label: String(i), value: i })) }); await this.knightGainBlood(x, n ?? o.upTo); };
        if (o.who === 'attacker') { if (k) await ask(k); } else if (o.who === 'each') { for (const x of this.alive()) await ask(x); } else { const x = await knightPick(this.alive(), `Blood 최대 ${o.upTo}개를 얻을 기사`); if (x) await ask(x); }
        return true;
      }
      case 'bloodToAdjacentBP': {
        const n = o.n === 'all' ? src.blood || 0 : Math.min(o.n, src.blood || 0); if (!n) return true;
        const adj = M.mobs.filter(m => m !== src && Math.abs(m.n - src.n) === 1); if (!adj.length) { this.mobDiscardBlood(src, n); return true; }
        const m = await this.pickMob(adj, `Blood ${n}을 옮길 인접 BP 카드 (Mob track)`); src.blood -= n; this.mobAddBlood(m, n, `#${src.n}에서 이동`); return true;
      }
      case 'moveAndBonusAttack': { if (o.who === 'other') { const others = this.alive().filter(x => x !== k); if (!others.length) return true; const id = await this.ask({ type: 'pickKnight', text: `다른 기사 선택 — ${o.upTo ? '최대 ' : ''}${o.n}칸 이동 후 Bonus Attack`, options: others.map(x => ({ label: x.name, value: x.id })) }); const x = others.find(y => y.id === id) || others[0]; return this.bloodOp({ ...o, who: null }, { ...ctx, attacker: x, target: x }); } if (!k || !k.alive) return true; if (!await this.yesNo(`${k.name}: ${o.upTo ? '최대 ' : ''}${o.n}칸 이동 후 Bonus Attack?`, true)) return true; await this.knightMove(k, o.n); if (this.canAttack(k)) k.bonusAttacks++; else this.say(`${k.name}: 인접한 Mob 없음 → Bonus Attack 불가`); return true; }
      default: return false;
    }
  },
};
export const BLOOD_OPS = ['suck', 'suckPerHits', 'burrow', 'burrowRoll', 'closestWormBurrow', 'chooseBurrow', 'activate', 'removeOtherWorms', 'removeSelf', 'discardMobBlood', 'discardHalfMobBlood', 'vigorToZero', 'dieIfAdjacentToTile', 'repeatIfTargetDied', 'loseVigorFromBlood', 'loseVigorPerBlood', 'attackerGainVigor', 'bloodFromBPToAttacker', 'closestKnightDiscardsBlood', 'eachKnightDiscardsBlood', 'stealBlood', 'bloodOrVigor', 'knightsGainBlood', 'bloodToAdjacentBP', 'moveAndBonusAttack'];
