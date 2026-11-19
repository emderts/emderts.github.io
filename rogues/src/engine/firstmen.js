// Firstmen Warriors (Monster Sheet traits + card ops): Battle Tactics (Tactics Target, Tactic A/B, End of Monster Round movement),
// Mangrove Deployment, Long Howl (White Ape Troll 2x2 inside the Mob Clash), Show of Strength, Retribution, Keeping Up the Pressure,
// Pull / Drag / Herd / Splinter, Range and Land-on-Top attacks, BP auras and the BP 3 Gladiators. Mixed into Clash.prototype; inert otherwise.
import { DIRS } from './board.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;

export const FirstmenMixin = {
  firstmenSetup() {
    const M = this.monster, D = this.monsterDef; this.flags = this.flags || {}; this.troll = null; this.longHowlUsed = false; this.mangroveNext = 1; this.pressureQueue = [];
    if (M.hasTrait('Battle Tactics') && D.battleTactics) { const all = Object.values(D.battleTactics); this.tactics = this.rng.pick(all); this.say(`Battle Tactics: ${this.tactics.name} — Tactics Target: ${this.tactics.ops.target}`, 'ai'); }
  },
  tacticsOn() { return !!(this.tactics && this.monster.hasTrait('Battle Tactics')); },
  isLone(k) { return !this.alive().some(o => o !== k && this.board.distance([o.pos], [k.pos]) <= 3); },
  isGrouped(k) { return this.alive().some(o => o !== k && this.board.adjacent(o.pos, k.pos)); },
  /** "Tactics Target" line → the Battle Tactics card's own targeting. */
  tacticsTargetPool(alive) {
    if (!this.tacticsOn()) return []; const L = this.tactics.ops.target.toLowerCase();
    if (L.includes('non-engaged')) return alive.filter(k => !this.engaged(k)); if (L.includes('lone')) return alive.filter(k => this.isLone(k)); if (L.includes('grouped')) return alive.filter(k => this.isGrouped(k)); return alive;
  },
  // ---------- auras / modifiers ----------
  revealedAura(key) { return (this.monster.mobs || []).filter(m => m.revealed && m.cells.length && m.card.ops.aura && m.card.ops.aura[key]); },
  inZoneOf(src, mob, z = 2) { if (src === mob) return true; return mob && mob.cells.length && src.cells.length && this.board.zone([src.cells[0]], z).some(c => mob.cells.some(x => cellEq(x, c))); },
  firstmenToHit(mob) { let n = 0; for (const g of this.revealedAura('zone2ToHit')) if (this.inZoneOf(g, mob)) n += g.card.ops.aura.zone2ToHit; if (this.flags && this.flags.firstmenMinusToHit) n -= 1; return n; },
  firstmenAT(mob) { let n = 0; for (const g of this.revealedAura('zone2AT')) if (this.inZoneOf(g, mob)) n += g.card.ops.aura.zone2AT; if (this.flags && this.flags.firstmenMinusAT) n -= 1; if (mob.card.ops.aura && mob.card.ops.aura.murmillo && mob.revealed && !(mob.generic > 0)) n -= 2; return n; },
  firstmenVigorPerHit(mob) { let n = 0; for (const g of this.revealedAura('zone2VigorPerHit')) if (this.inZoneOf(g, mob)) n += g.card.ops.aura.zone2VigorPerHit; return n; },
  firstmenVigorFlat(k, mob) { let n = 0; if (this.tacticsOn() && this.tactics.ops.loneExtraVigor && k && this.isLone(k)) n += this.tactics.ops.loneExtraVigor; if (this.flags && this.flags.firstmenLessVigor) n -= 2; return n; },
  firstmenDice() { return this.flags && this.flags.firstmenMinusDie ? -1 : 0; },
  /** Cestus: a Knight that started its turn / moved in Zone 1 of revealed Cestus may attack only Cestus this turn. */
  cestusCheck(k) { const c = this.revealedAura('cestus').find(g => this.board.zone([g.cells[0]], 1).some(x => cellEq(x, k.pos))); if (c) { k.cestusLock = c; this.say(`${k.name}: Cestus의 Zone 1 — 이번 턴 Cestus만 공격 가능`); } },

  // ---------- Tactic ops ----------
  async pull(src, k, n) { if (n > 0 && k && k.alive && await this.fx.ignoreInvol(k, `Pull ${n}`)) return; n = await this.reduceDragPull(k, n, 'Pull'); if (n > 0) { const u = await this.fx.gearUse(k, ['reducePull'], `Pull ${n} — 줄이기?`); if (u) { n = Math.max(0, n - u.n); this.say(`${k.name}: Pull → ${n} (Gear)`, 'tech'); } } const B = this.board; let moved = 0; for (let i = 0; i < n && !src.cells.some(c => B.adjacent(c, k.pos)); i++) { const opts = B.neighbors(k.pos).filter(c => !B.isObstacle(c) && !this.knightAt(c) && !this.monsterOccupies(c)); if (!opts.length) break; const d = c => Math.min(...src.cells.map(x => B.distance([x], [c]))); const best = Math.min(...opts.map(d)); if (best >= Math.min(...src.cells.map(x => B.distance([x], [k.pos])))) break; this.moveKnight(k, opts.find(c => d(c) === best)); moved++; } this.turnTowardFor(src, k.pos); this.say(`${k.name} Pull ${n}: ${moved}칸 → ${B.label(k.pos)}`); },
  async reduceDragPull(k, n, what) { if (n > 0 && this.fx.gearHas(k, 'ignorePullDrag')) { this.say(`${k.name}: ${what} 무시 (Gear)`, 'tech'); return 0; } if (n > 0 && what === 'Drag' && await this.fx.gearUse(k, ['ignoreDrag'], `Drag ${n} — 무시?`)) { this.say(`${k.name}: Drag 무시 (Gear)`, 'tech'); return 0; } const r = this.fx.gearSum(k, 'reduceDragPull'); if (r && n > 0 && await this.yesNo(`${k.name}: ${what} ${n} → ${Math.max(0, n - r)}로 줄이기 (Gear)?`, true)) n = Math.max(0, n - r); return n; },
  async drag(src, k, n) { if (n > 0 && k && k.alive && await this.fx.ignoreInvol(k, `Drag ${n}`)) return; n = await this.reduceDragPull(k, n, 'Drag'); const B = this.board; if (!src.cells.length || !B.adjacent(src.cells[0], k.pos)) return; const d = { c: Math.sign(src.cells[0].c - k.pos.c), r: Math.sign(src.cells[0].r - k.pos.r) }; let m = 0; for (let i = 0; i < n; i++) { const nx = { c: src.cells[0].c + d.c, r: src.cells[0].r + d.r }; if (!this.cellFree(nx, src)) break; const prev = src.cells[0]; this.mobStepTo(src, nx); if (!this.knightAt(prev)) this.moveKnight(k, prev); m++; } this.turnTowardFor(src, k.pos); this.say(`Drag ${n}: Mob #${src.n}와 ${k.name} ${m}칸 끌려감 → ${B.label(k.pos)}`); },
  async herd(src, k, n) {
    const B = this.board; const others = this.alive().filter(o => o !== k); if (others.some(o => B.adjacent(o.pos, k.pos))) { this.say(`Herd: ${k.name}이 이미 다른 기사와 인접 → Knockdown`); k.knockedDown = true; }
    else { const before = B.distance([src.cells[0]], [k.pos]); const used = Math.min(n, Math.max(0, before - 1)); if (used) await this.mobMoveToward(src, k.pos, used, { ask: false }); let left = n - used; const tgt = others.sort((a, b) => B.distance([a.pos], [k.pos]) - B.distance([b.pos], [k.pos]))[0];
      while (left-- > 0 && tgt && !B.adjacent(tgt.pos, k.pos)) { const opts = B.neighbors(k.pos).filter(c => !B.isObstacle(c) && !this.knightAt(c) && !this.monsterOccupies(c)); if (!opts.length) break; const best = opts.sort((a, b) => B.distance([a], [tgt.pos]) - B.distance([b], [tgt.pos]))[0]; if (B.distance([best], [tgt.pos]) >= B.distance([k.pos], [tgt.pos])) break; this.moveKnight(k, best); }
      this.say(`Herd ${n}: ${k.name} → ${B.label(k.pos)}`); }
    if (!B.adjacent(src.cells[0], k.pos)) await this.mobMoveToward(src, k.pos, Infinity, { ask: false });
  },
  async splinter(k, n) { for (const o of this.alive().filter(o => o !== k && this.board.adjacent(o.pos, k.pos))) { this.say(`Splinter ${n}: ${o.name}`); await this.loseVigor(o, n, { source: 'attack', perilCheck: true }); } },
  turnTowardFor(src, pos) { if (src === this.monster.cur) this.turnToward(pos); else this.withMob(src, () => this.turnToward(pos)); },

  // ---------- Mangrove Deployment ----------
  mangroveCells(n) { return this.tileCells('great mangrove').filter(c => c.num === n); },
  async mangroveSpawn(dead) {
    const M = this.monster; if (!M.hasTrait('Mangrove Deployment')) return; const lv = Math.min(3, dead.card.level + 1); const deck = M.bpPool[lv]; const slot = this.freeSlot();
    if (!deck || !deck.size || !slot) { this.say(`Mangrove Deployment: BP${lv} 없음 또는 Mob track 가득 — Spawn 없음`); return; }
    const loc = this.mangroveNext; this.mangroveNext = loc % 3 + 1; const m = this.addMob(deck.draw(), null, 'S', slot); m.mangrove = loc;
    this.say(`Mangrove Deployment: 새 Warrior #${slot} (BP${lv}) — Great Mangrove #${loc}에서 대기 (보드 밖 취급)`, 'ai');
  },
  async firstmenEndKnightRound() {
    const M = this.monster, B = this.board; if (!M.hasTrait('Mangrove Deployment')) return;
    for (const m of M.mobs.filter(x => x.mangrove)) {
      const tile = this.mangroveCells(m.mangrove); const adj = []; for (const c of tile) for (const n of B.neighbors(c)) if (this.cellFree(n) && !adj.some(x => cellEq(x, n)) && !tile.some(t => cellEq(t, n))) adj.push(n);
      if (!adj.length) { this.say(`Mob #${m.n}: Mangrove 주변에 빈 칸 없음`); continue; } const ks = this.alive(); const d = c => Math.min(...ks.map(k => B.distance([c], [k.pos]))); const best = Math.min(...adj.map(d)); const cand = adj.filter(c => d(c) === best);
      const cell = cand.length > 1 ? await this.ask({ type: 'move', text: `Mob #${m.n} Mangrove에서 등장 — 기사에게 가장 가까운 칸 (동률)`, cells: cand, options: cand.map(c => ({ label: B.label(c), value: c })) }) || cand[0] : cand[0];
      delete m.mangrove; await this.placeMob(m, cell, `Great Mangrove에서 등장`);
    }
  },
  async firstmenDeaths() { const q = this.pendingMangrove || []; this.pendingMangrove = []; for (const m of q) await this.mangroveSpawn(m); },
  // ---------- Long Howl: White Ape Troll ----------
  async longHowl({ oncePerClash = false } = {}) {
    const M = this.monster, B = this.board; if (!M.hasTrait('Long Howl') || !this.monsterDef.troll) return;
    if (this.troll) { this.say('Long Howl: White Ape Troll이 이미 보드에 있음 → 무시'); return; } if (oncePerClash && this.longHowlUsed) { this.say('Long Howl: 이번 Clash에 이미 사용 (once per Clash)'); return; }
    if (this.trollFled) { this.say('Long Howl: White Ape Troll은 이미 도망침'); return; }
    if (oncePerClash) this.longHowlUsed = true; const cells = ['F7', 'F8', 'E7', 'E8'].map(l => B.parse(l));
    for (const c of cells) { const k = this.knightAt(c); if (k) await this.displace(k); const o = this.mobAt(c); if (o && o !== this.troll) await this.displaceMob(o, c); }
    const T = this.monsterDef.troll; this.troll = { n: 'W', isTroll: true, card: T.bp, ai: T.ai, revealed: true, cells, facing: 'S', armor: 0, tokens: [], trollTokens: 0, blood: 0 };
    B.place({ kind: 'mob', n: 'W' }, cells); await this.withMob(this.troll, () => this.faceMostKnights()); this.say('Long Howl! White Ape Troll이 보드 중앙에 등장 (Muscular Chest / Rampage Strike)', 'ai');
  },
  async trollActivate() { if (!this.troll || !this.alive().length) return; this.say('▷ White Ape Troll 활성화 — Rampage Strike', 'ai'); await this.withMob(this.troll, () => this.resolveMonsterAttack(this.troll.ai, {})); },
  trollWound() {
    const M = this.monster, T = this.troll; T.trollTokens++; const lv = Math.min(...[...M.ai.cards, ...M.ai.discard].map(c => c.level)); M.escalateAI(lv);
    M.woundStack.push({ card: { name: 'Generic Single Wound (White Ape Troll)', level: 1 }, wounds: 1, troll: true }); this.say(`White Ape Troll 부상: Generic 토큰 ${T.trollTokens}/4, Wound Stack +1`, 'wound');
    if (T.trollTokens >= 4) { this.board.remove(T.cells); this.troll = null; this.trollFled = true; this.say('White Ape Troll이 Clash에서 도망침', 'wound'); }
    return 1;
  },
  // ---------- round hooks ----------
  async firstmenStartMR() {
    const M = this.monster; if (!this.monsterDef.battleTactics) return;
    if (M.hasTrait('Show of Strength')) { const un = M.mobs.filter(m => !m.revealed); if (un.length) { this.say('Show of Strength: 가장 왼쪽 비공개 BP 공개'); await this.revealMob(un[0]); } }
    for (const v of this.revealedAura('venator')) { if (v.generic > 0) { v.generic--; this.say(`Venator: Generic 토큰 1 버림 (남은 ${v.generic})`); } else { this.say('Venator: 버릴 토큰 없음 → Long Howl'); await this.longHowl({ oncePerClash: true }); } }
    for (const a of this.revealedAura('augur')) { const ks = this.alive(); if (!ks.length) break; const d = k => this.board.distance(a.cells, [k.pos]); const best = Math.min(...ks.map(d)); const k = ks.find(x => d(x) === best); this.say(`Augur: ${k.name}의 칸을 대상으로 Swamp 1x2`, 'ai'); await this.windowOfOpportunity('react', null); if (k.alive) await this.placeSwamp(k.pos); }
  },
  async firstmenEndMR() {
    const M = this.monster, B = this.board; if (!this.monsterDef.battleTactics) return;
    if (this.troll) await this.trollActivate();
    if (!this.tacticsOn()) return; const e = this.tactics.ops.endOfMonsterRound; this.say(`Monster Round 종료 — ${this.tactics.name}`, 'ai');
    for (const m of M.mobs.filter(x => x.cells.length)) {
      if (e.toward === 'closestMob') { const others = M.mobs.filter(o => o !== m && o.cells.length); if (!others.length) continue; const d = o => B.distance(m.cells, o.cells); const best = Math.min(...others.map(d)); const o = others.find(x => d(x) === best); if (!B.adjacent(m.cells[0], o.cells[0])) await this.mobMoveToward(m, o.cells[0], e.move, { ask: false }); }
      else if (e.awayFromMostKnights) { const ks = this.alive(); if (!ks.length) continue; const cx = ks.reduce((s, k) => s + k.pos.c, 0) / ks.length, cy = ks.reduce((s, k) => s + k.pos.r, 0) / ks.length; const dc = m.cells[0].c - cx, dr = m.cells[0].r - cy; const dir = Math.abs(dc) >= Math.abs(dr) ? { c: Math.sign(dc) || 1, r: 0 } : { c: 0, r: Math.sign(dr) || 1 }; let cur = m.cells[0]; for (let i = 0; i < e.move; i++) { const nx = { c: cur.c + dir.c, r: cur.r + dir.r }; if (!this.cellFree(nx, m)) break; cur = nx; } if (!cellEq(cur, m.cells[0])) { this.mobStepTo(m, cur); this.say(`Mob #${m.n} 기사 무리에게서 멀어짐 → ${B.label(cur)}`); } }
    }
  },
  async placeSwamp(at) { const B = this.board; const adj = B.neighbors(at).filter(c => B.inside(c) && !B.terrainAt(c)); const pick = adj.length > 1 ? await this.ask({ type: 'move', text: 'Swamp 1x2 타일의 두 번째 칸', cells: adj, options: adj.map(c => ({ label: B.label(c), value: c })) }) || adj[0] : adj[0]; for (const c of [at, pick].filter(Boolean)) B.terrain.set(B.key(c), { id: 'swamp', name: 'Swamp', obstacle: false, chasm: false, difficult: true }); this.say(`Swamp 1x2 → ${[at, pick].filter(Boolean).map(c => B.label(c)).join(', ')}`); },
  /** Keeping Up the Pressure (L4) and "When X attacks, add its Instinct Response to the After Attack". */
  async firstmenAfterAttack(attack) {
    const M = this.monster; const src = attack.mob; if (!this.monsterDef.battleTactics || !src) return;
    if (src.revealed && src.card.ops.aura && src.card.ops.aura.instinctOnAttack && src.card.ops.instinct) for (const t of attack.targets.filter(x => x.alive)) { this.say(`${src.card.name}: Instinct Response를 After Attack에 추가`); await this.fx.runMonsterOps(src.card.ops.instinct, { attack, source: src, target: t, primary: t }); }
    if (M.hasTrait('Keeping Up the Pressure') && !attack.card.isSignature) for (const t of attack.targets.filter(x => x.alive && (attack.hits[x.id] === 0 || attack.noVigorLost && attack.noVigorLost.has(x.id)))) {
      const order = [...M.mobs.filter(m => m.n > src.n), ...M.mobs.filter(m => m.n < src.n)].filter(m => m.cells.length); const nx = order[0]; if (!nx) continue;
      this.say(`Keeping Up the Pressure: ${t.name} — Mob #${nx.n} Signature`, 'ai'); await this.withMob(nx, () => this.performSignature({ forceTarget: t }));
    }
  },
  // ---------- ops ----------
  async firstmenOp(o, ctx) {
    const M = this.monster, B = this.board; const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t;
    switch (o.op) {
      case 'tactic': { if (!this.tacticsOn()) { this.say(`Tactic ${o.which}: Battle Tactics 비활성`); return true; } if (!t || !t.alive) return true; const list = this.tactics.ops[o.which].map(x => ({ ...x, n: x.n === 'X' ? o.n : x.n })); this.say(`Tactic ${o.which}: ${o.n} (${this.tactics.name})`); for (const x of list) await this.fx.runMonsterOp(x, { ...ctx, target: t }); return true; }
      case 'pull': if (t && t.alive && src && src.cells.length) await this.pull(src, t, o.n); return true;
      case 'drag': if (t && t.alive && src && src.cells.length) await this.drag(src, t, o.n); return true;
      case 'herd': if (t && t.alive && src && src.cells.length) await this.herd(src, t, o.n); return true;
      case 'splinter': if (t) await this.splinter(t, o.n); return true;
      case 'pushbackPerHit': { const h = ctx.attack && ctx.attack.hits ? ctx.attack.hits[t.id] || 0 : ctx.hits || 0; if (t && t.alive && h) await this.pushback(t, h * o.n); return true; }
      case 'tempSpeed': if (t && t.alive) { if (this.flags.noAiSpeed && o.n < 0) { this.say('Venator Critical: 음수 Speed 토큰 무시'); return true; } t.tempSpeed = (t.tempSpeed || 0) + o.n; this.say(`${t.name}: 임시 Speed ${o.n > 0 ? '+' : ''}${o.n} 토큰`); } return true;
      case 'vigorPerAdjacentMob': { if (!t || !t.alive || !src || !src.cells.length) return true; const n = M.mobs.filter(m => m !== src && m.cells.length && B.adjacent(m.cells[0], src.cells[0])).length * o.n; if (n) await this.loseVigor(t, n, { source: 'attack', perilCheck: o.perilCheck, armor: false }); else if (o.perilCheck) await this.perilCheck(t); return true; }
      case 'graveToJudicium': if (this.currentAttack) this.currentAttack.graveToJudicium = true; return true;
      case 'genericToken': if (src) { src.generic = Math.max(0, (src.generic || 0) + o.n); this.say(`Mob #${src.n} Generic 토큰 ${o.n > 0 ? '+' : ''}${o.n} → ${src.generic}`); } return true;
      case 'activateFromTokens': { const n = src ? src.generic || 0 : 0; this.say(`Venator: Activate ${n}`); if (n) await this.activateMobs(src, n); return true; }
      case 'clashFlag': this.flags[o.flag] = true; this.say(`Clash 끝까지: ${{ noAiSpeed: '기사는 AI로 음수 Speed 토큰을 받지 않음', firstmenMinusDie: 'Firstmen 공격 -1 주사위', firstmenMinusAT: 'Firstmen -1 AT', firstmenMinusToHit: 'Firstmen -1 To Hit', firstmenLessVigor: 'Firstmen 공격 Vigor 손실 2 감소' }[o.flag] || o.flag}`, 'warn'); return true;
      case 'swampUnder': { const at = o.where === 'attacker' ? (k && k.pos) : src && (src.cells[0] || src.lastCell); if (at) await this.placeSwamp(at); return true; }
      case 'removeAllSwamps': { let n = 0; for (const [key, ter] of [...B.terrain]) if (ter.id === 'swamp') { B.terrain.delete(key); n++; } this.say(`Swamp 타일 모두 제거 (${n}칸)`); return true; }
      case 'exhaustActiveWeapon': { if (!k) return true; const ws = k.gear.filter(g => g.type === 'weapon' && !g.exhausted && !g.discarded); if (!ws.length) return true; const nm = ws.length === 1 ? ws[0].name : await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 소진할 활성 Weapon`, options: ws.map(g => ({ label: g.name, value: g.name })) }); const w = ws.find(g => g.name === nm) || ws[0]; if (await this.fx.keepGear(k, w, 'exhaust')) return true; w.exhausted = true; this.say(`${k.name}: ${w.name} 소진 (Murmillo)`); return true; }
      case 'longHowl': await this.longHowl({ oncePerClash: o.oncePerClash }); return true;
      case 'escalateX': M.escalateX(o.n); return true;
      case 'drawAIFor': {
        if (o.which !== 'closestOther') return false; if (!src) return true; const origin = src.cells[0] || src.lastCell; const pool = M.mobs.filter(m => m !== src && m.cells.length); if (!pool.length || !origin) return true;
        const d = m => B.distance([origin], m.cells); const best = Math.min(...pool.map(d)); const m = await this.pickMob(pool.filter(x => d(x) === best), '가장 가까운 다른 Mob (동률)');
        if (o.level) { const pick = M.ai.cards.find(c => c.level === o.level) || M.ai.discard.find(c => c.level === o.level); if (!pick) { this.say(`AI ${o.level} 카드 없음`); return true; } this.say(`Mob #${m.n}: AI ${o.level} ${pick.name}`, 'ai'); await this.withMob(m, () => this.resolveMonsterAttack(pick, {})); return true; }
        this.say(`Draw AI for Mob #${m.n}`, 'ai'); await this.withMob(m, () => this.activationAI()); return true;
      }
      default: return false;
    }
  },
};
export const FIRSTMEN_OPS = ['tactic', 'pull', 'drag', 'herd', 'splinter', 'pushbackPerHit', 'tempSpeed', 'vigorPerAdjacentMob', 'graveToJudicium', 'genericToken', 'activateFromTokens', 'clashFlag', 'swampUnder', 'removeAllSwamps', 'exhaustActiveWeapon', 'longHowl', 'escalateX'];
