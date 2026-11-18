// Pumpkinhead Monstrosities (Mob Clash): two-sided BPs (Pumpkinhead / Sapling) that never Escalate, Cursed Overgrowth (Fool's deck Sapling
// placement), Fast Regrowth, Ecological Cataclysm (Generic tokens → AT, 4 = defeat), Controlled Burn, Fire Walk with Me (Campfire),
// Spore Spreader, Pumpkin Plague, Accelerated Regrowth, Kingdom Traits (Venomous Quagmire / Floraforge Fury: Afflict, growth, Transforming Seed).
import { GameOver } from './core.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const man = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const SWAMP = { id: 'swamp', obstacle: false, obscuring: false, destructible: false, chasm: false, difficult: true };

export const PumpMixin = {
  pumpSetup(cs) {
    const M = this.monster, B = this.board, D = this.monsterDef; this.isPump = true; this.flags = this.flags || {};
    const kt = D.pump.kingdomTrait[this.kingdom] || D.pump.kingdomTrait.sunken; M.traits.add(kt); this.pumpKingdom = kt;
    const FD = this.data.decks && this.data.decks.fools; this.pumpFools = FD ? this.rng.shuffle([...FD.cards]) : []; this.pumpFoolsDiscard = [];
    const cards = this.rng.shuffle(D.cards.bp.map(c => ({ front: { ...c }, back: { ...c.back } }))); const sapIdx = new Set(this.rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, 2));
    const pSpots = this.rng.shuffle(cs.pumpkinStart.map(s => ({ ...s }))); const sSpots = this.rng.shuffle([...cs.saplingStart]);
    cards.forEach((c, i) => { const sap = sapIdx.has(i); const spot = sap ? { cell: sSpots.pop(), facing: 'S' } : pSpots.pop(); const mob = this.addMob(sap ? c.back : c.front, B.parse(spot.cell), spot.facing, i + 1, { revealed: true }); mob.isPump = true; mob.front = c.front; mob.back = c.back; mob.side = sap ? 'sapling' : 'pumpkin'; mob.red = sap && !M.hasTrait('Accelerated Regrowth'); mob.generic = sap ? 1 : 0; });
    M.activations.forEach((a, i) => { const mob = M.mobs[i]; if (mob) mob.tokens.push({ type: a.type, ready: true }); }); this.necro = 0; this.scavengeBonus = 0; this.mobArmorDisabled = false;
    this.say(`Kingdom Trait: ${kt} · Mob track: ${M.mobs.map(m => `#${m.n} ${m.card.name}${m.side === 'sapling' ? ' (Sapling)' : ''} ${B.label(m.cells[0])}`).join(' · ')}`);
  },
  pumpLose(why) { this.say(`패배 — ${why}`, 'end'); this.result = 'lose'; throw new GameOver('lose'); },
  pumpToken(mob, n = 1) { mob.generic = (mob.generic || 0) + n; this.say(`#${mob.n} ${mob.card.name}: Generic 토큰 ${mob.generic} (AT +${mob.generic})`, 'bp'); if (mob.generic >= 4) this.pumpLose('Ecological Cataclysm: BP 위 Generic 토큰 4개'); },
  pumpATBonus(mob) { let n = mob.generic || 0; const key = mob.side === 'sapling' ? 'saplingAT' : 'pumpkinAT'; for (const o of this.monster.mobs) if (o.side === 'sapling' && o.cells.length && o.card.ops.aura && o.card.ops.aura[key]) n += o.card.ops.aura[key]; return n; },
  pumpFreeCell(c, self = null) { const B = this.board; const t = B.terrainAt(c); return B.inside(c) && !(t && (t.obstacle || t.chasm)) && !this.knightAt(c) && (!this.mobAt(c) || this.mobAt(c) === self); },
  // ---------- Campfire ----------
  pumpFreeActions(k) { const B = this.board; if (!this.isPump || k.heat >= k.heatLimit || !B.neighbors(k.pos).some(c => { const t = B.terrainAt(c); return t && t.id === 'campfire'; })) return []; return [{ id: 'campfire', label: `Campfire: Heat +X → Fire 토큰 X (Heat ${k.heat}/${k.heatLimit})` }]; },
  async pumpCampfire(k) { const max = k.heatLimit - k.heat; if (max <= 0) return; const x = await this.askCount(`${k.name}: Campfire — 얻을 Fire 토큰 수 (Heat +X)`, max, 1); if (!x) return; k.gainHeat(x, { voluntary: true }); this.poolAdd('fire', x); this.say(`${k.name}: Campfire에서 Heat +${x} → Fire 토큰 ${x}`); },
  // ---------- movement (Advanced Bypass) ----------
  /** Shortest path toward a space within `near` of the target, moving through miniatures; returns { path, burn } or null. Players choose between equally short paths with / without the Campfire. */
  async pumpMoveToward(mob, target, { max = Infinity, range = 1 } = {}) {
    if (mob && mob.slowToken) { mob.slowToken = false; max = Math.min(max, 3); this.say(`임시 Speed 토큰: Mob #${mob.n}의 이번 이동은 3칸에서 멈춤 (토큰 버림)`, 'tech'); }
    const B = this.board; const start = mob.cells[0]; const near = c => man(c, target) <= range && (range > 1 || B.adjacent(c, target)); if (near(start)) return 0;
    const fire = c => { const t = B.terrainAt(c); return !!(t && t.id === 'campfire'); };
    const bfs = avoid => { const pass = c => B.inside(c) && !(B.terrainAt(c) && B.terrainAt(c).obstacle) && !(avoid && fire(c)); const dist = new Map([[B.key(start), 0]]); const prev = new Map(); let fr = [start]; while (fr.length) { const nx = []; for (const c of fr) for (const n of B.neighbors(c)) { const k = B.key(n); if (dist.has(k) || !pass(n)) continue; dist.set(k, dist.get(B.key(c)) + 1); prev.set(k, c); nx.push(n); } fr = nx; }
      const ends = [...dist.keys()].map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(c => near(c) && this.pumpFreeCell(c, mob)); if (!ends.length) return null; const best = Math.min(...ends.map(c => dist.get(B.key(c)))); return { best, ends: ends.filter(c => dist.get(B.key(c)) === best), path: e => { const out = []; for (let c = e; c && !cellEq(c, start); c = prev.get(B.key(c))) out.unshift(c); return out; } }; };
    const any = bfs(false); if (!any) return 0; const safe = bfs(true); let use = any; if (safe && safe.best === any.best) { const viaFire = any.ends.some(e => any.path(e).some(fire)); use = safe; if (viaFire && mob.side === 'pumpkin' && await this.yesNo(`Pumpkinhead #${mob.n}: 같은 거리의 경로 중 Campfire를 지나는 경로로 이동시킬까요? (Fire Walk with Me)`, true)) use = any; }
    const end = use.ends.length > 1 ? await this.ask({ type: 'move', text: `Pumpkinhead #${mob.n} 이동 도착 칸 (동률)`, cells: use.ends, options: use.ends.map(c => ({ label: B.label(c), value: c })) }) || use.ends[0] : use.ends[0];
    let path = use.path(end); if (path.length > max) { path = path.slice(0, max); while (path.length && !this.pumpFreeCell(path.at(-1), mob)) path.pop(); } if (!path.length) return 0;
    const burn = mob.side === 'pumpkin' && path.find(fire); const stop = burn || path.at(-1); if (this.pumpFreeCell(stop, mob) || burn) this.mobStepTo(mob, stop);
    this.say(`Pumpkinhead #${mob.n} 이동 ${path.indexOf(stop) + 1}칸 → ${B.label(stop)}${burn ? ' (Campfire!)' : ''}`); if (burn) mob.burning = true; return path.length;
  },
  /** Fire Walk with Me: resolved at the end of the current action (or as a wound when it was the Target of a Knight Attack — not possible while it moves). */
  async pumpBurn() { for (const mob of [...this.monster.mobs]) { if (!mob.burning) continue; mob.burning = false; this.say(`Fire Walk with Me: Pumpkinhead #${mob.n} ${mob.card.name}이(가) Campfire 위로 이동 → 사망`, 'wound'); this.monster.woundStack.push({ generic: 'single', wounds: 1 }); this.say(`Generic Single Wound → Wound Stack ${this.monster.wounds}/${this.monster.woundsToKill}`, 'wound'); await this.pumpToSapling(mob, this.monster.level >= 2 ? 2 : 1); this.pumpEscalate(mob.generic || 1); } },
  pumpEscalate(level) { const M = this.monster; level = Math.max(1, Math.min(3, level)); this.say(`AI Escalation (Generic 토큰 ${level} → AI ${level} 제거)`); M.escalateAI(level); for (const m of M.log.splice(0)) this.say(m); },
  // ---------- Cursed Overgrowth / wounds ----------
  async pumpToSapling(mob, tokens = 1, at = null) {
    const B = this.board; if (!this.pumpFools.length) { this.pumpFools = this.rng.shuffle(this.pumpFoolsDiscard); this.pumpFoolsDiscard = []; } const f = this.pumpFools.shift(); if (f) this.pumpFoolsDiscard.push(f);
    let coord = f ? f.coord : null; if (f && !coord && f.coordChoice) coord = await this.ask({ type: 'pick', text: `Fool's deck ${f.name}: Sapling 좌표 선택`, options: f.coordChoice.map(c => ({ label: c, value: c })) }) || f.coordChoice[0];
    B.remove(mob.cells); mob.lastCell = mob.cells[0]; mob.cells = []; let cell = at || (coord ? B.parse(coord) : mob.lastCell);
    if (!this.pumpFreeCell(cell)) { let ring = B.neighbors(cell).filter(c => this.pumpFreeCell(c)); for (let r = 2; !ring.length && r < 8; r++) ring = B.zone([cell], r).filter(c => this.pumpFreeCell(c)); cell = ring.length > 1 ? await this.ask({ type: 'move', text: `${coord} 칸이 차 있음 — Sapling을 놓을 인접 칸`, cells: ring, options: ring.map(c => ({ label: B.label(c), value: c })) }) || ring[0] : ring[0]; }
    mob.side = 'sapling'; mob.card = mob.back; mob.red = !this.monster.hasTrait('Accelerated Regrowth'); mob.armor = 0; mob.cells = [cell]; B.place({ kind: 'mob', n: mob.n }, [cell]);
    this.say(`Cursed Overgrowth: BP 뒤집음 → ${mob.card.name} · Fool's deck ${f ? f.name + ' ' + coord : '-'} → ${mob.red ? 'Red' : 'Green'} Sapling #${mob.n} ${B.label(cell)}`, 'bp'); this.pumpToken(mob, tokens); await this.pumpRevealed(mob);
  },
  async pumpRevealed(mob) { if (!mob.card.ops.aura || !mob.card.ops.aura.whenRevealed) return; const B = this.board; this.say(`When revealed — ${mob.card.name}: Terrain 타일에 인접한 기사는 Afflict 1`); for (const k of this.alive()) if (B.neighbors(k.pos).some(c => B.terrainAt(c))) await this.pumpAfflict(k, 1); },
  /** Called from the Knight Attack wound step. Pumpkinhead: flip happens after the responses (A.pumpFlip). Sapling: token discarded, BP → Wound Stack, AI Escalation. */
  pumpWound(A) { const M = this.monster, mob = A.mob; if (mob.side === 'pumpkin') { A.pumpFlip = mob; return 0; }
    mob.lastCell = mob.cells[0]; this.board.remove(mob.cells); M.mobs = M.mobs.filter(x => x !== mob); M.woundStack.push({ card: mob.front, wounds: 1, mob, generic0: mob.generic }); for (const tok of [...mob.tokens]) this.moveToken(mob.n, tok, false); mob.tokens = []; mob.cells = []; mob.dead = true;
    this.say(`Sapling #${mob.n} ${mob.card.name} 제거 — BP → Wound Stack`, 'wound'); this.pumpEscalate(mob.generic || 1); return 1; },
  async pumpAfterResponses(k, A) { if (A.pumpFlip) { const mob = A.pumpFlip; A.pumpFlip = null; if (this.monster.mobs.includes(mob) && mob.side === 'pumpkin') { const need = this.fx.gearAbilities(k, ['saplingInPlace']).some(x => x.o.overcomeMelee); const here = (!need || (A.overcame && A.overcameMelee)) && await this.fx.gearUse(k, ['saplingInPlace'], 'Pumpkinhead Wound — Sapling을 무작위 좌표 대신 제자리에 놓기?') ? mob.cells[0] : null; await this.pumpToSapling(mob, 1 + (A.pumpExtra || 0), here); } } if (A.wounded && this.monster.hasTrait('Pumpkin Plague')) await this.pumpPlague(k); },
  async pumpPlague(k) { if (!k.alive) return; const cap = g => (g.type === 'weapon' && g.hands === 2 ? 2 : 1); const gear = k.gear.filter(g => !g.discarded && g.type !== 'upgrade' && (g.plague || 0) < cap(g));
    if (!gear.length) { this.say(`Pumpkin Plague: ${k.name}의 모든 Gear가 가득 → Pumpkinhead가 됨 (사망)`, 'death'); const pos = k.pos; await this.die(k, 'Pumpkin Plague'); if (!k.alive) { const e = this.monster.woundStack.findLast ? this.monster.woundStack.findLast(w => w.mob && w.mob.isPump) : null; if (e) { this.monster.woundStack.splice(this.monster.woundStack.indexOf(e), 1); const mob = e.mob; mob.dead = false; mob.side = 'pumpkin'; mob.card = mob.front; mob.cells = [pos]; mob.facing = 'S'; this.monster.mobs.push(mob); this.monster.mobs.sort((a, b) => a.n - b.n); this.board.place({ kind: 'mob', n: mob.n }, [pos]); this.say(`Heal 1: ${mob.card.name}이(가) ${k.name}의 칸(${this.board.label(pos)})에 Pumpkinhead로 복귀 (Wound ${this.monster.wounds}/${this.monster.woundsToKill})`, 'wound'); } } return; }
    const nm = gear.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name} Pumpkin Plague — Generic 토큰을 놓을 Gear`, options: gear.map(g => ({ label: `${g.name} (${g.plague || 0}/${cap(g)})`, value: g.name })) }) : gear[0].name; const g = gear.find(x => x.name === nm) || gear[0]; g.plague = (g.plague || 0) + 1; this.say(`Pumpkin Plague: ${k.name}의 ${g.name}에 Generic 토큰 (${g.plague}/${cap(g)})`); },
  // ---------- Fast Regrowth / Kingdom Trait ----------
  async pumpGrow(mob) {
    const B = this.board, M = this.monster; mob.side = 'pumpkin'; mob.card = mob.front; mob.red = false; this.say(`Fast Regrowth: Sapling #${mob.n} → Pumpkinhead ${mob.card.name} (${B.label(mob.cells[0])})`, 'ai'); await this.withMob(mob, () => this.faceMostKnights());
    if (this.pumpKingdom === 'Venomous Quagmire') { const c0 = mob.cells[0]; const blocks = [[0, 0], [-1, 0], [0, -1], [-1, -1]].map(([dc, dr]) => [{ c: c0.c + dc, r: c0.r + dr }, { c: c0.c + dc + 1, r: c0.r + dr }, { c: c0.c + dc, r: c0.r + dr + 1 }, { c: c0.c + dc + 1, r: c0.r + dr + 1 }]).filter(b => b.every(c => B.inside(c))); let bi = 0; if (blocks.length > 1) bi = await this.ask({ type: 'pick', text: `Venomous Quagmire — Pumpkinhead #${mob.n}(${B.label(c0)}) 칸을 포함하는 2x2 Swamp 위치`, options: blocks.map((b, i) => ({ label: b.map(c => B.label(c)).join('/'), value: i })) }) || 0; const blk = (blocks[bi] || blocks[0] || [c0]).filter(c => !B.terrainAt(c)); for (const c of blk) B.terrain.set(B.key(c), { ...SWAMP }); this.say(`Venomous Quagmire: 2x2 Swamp 배치 (${blk.map(c => B.label(c)).join(', ')})`); const ks = this.alive(); if (ks.length) { const d = Math.min(...ks.map(k => man(k.pos, c0))); const near = ks.filter(k => man(k.pos, c0) === d); let k = near[0]; if (near.length > 1) { const id = await this.ask({ type: 'pickKnight', text: `Pumpkinhead #${mob.n}: 가장 가까운 기사 (동률)`, options: near.map(x => ({ label: x.name, value: x.id })) }); k = near.find(x => x.id === id) || near[0]; } await this.pumpMoveToward(mob, k.pos, { max: 3 }); await this.withMob(mob, async () => this.turnToward(k.pos)); } }
    else { const x = mob.armor || 0; mob.armor = 0; this.say(`Floraforge Fury: Armor 토큰 ${x}개 버림 → Priority Target 쪽으로 ${x}칸`); if (x && this.priorityTarget && this.priorityTarget.alive) await this.pumpMoveToward(mob, this.priorityTarget.pos, { max: x }); }
  },
  async pumpFastRegrowth(src, zone) {
    const B = this.board, M = this.monster; const center = src && src.cells.length ? src.cells : (src && src.lastCell ? [src.lastCell] : null); const inZone = m => zone === 'all' || (center && (B.zone(center, zone).some(c => cellEq(c, m.cells[0])) || center.some(c => cellEq(c, m.cells[0]))));
    const green = M.mobs.filter(m => m.side === 'sapling' && !m.red && m.cells.length && inZone(m)); this.say(`Fast Regrowth (${zone === 'all' ? 'Clash Board 전체' : 'Zone ' + zone}): Green Sapling ${green.length}개`); const grown = []; for (const m of green) { await this.pumpGrow(m); grown.push(m); }
    const red = M.mobs.filter(m => m.side === 'sapling' && m.red); for (const m of red) m.red = false; if (red.length) this.say(`Red Sapling ${red.map(m => '#' + m.n).join(', ')} → Green`);
    await this.pumpBurn(); if (M.hasTrait('Spore Spreader') && (this._spore || 0) < 2) { this._spore = (this._spore || 0) + 1; try { for (const m of grown) if (M.mobs.includes(m) && m.side === 'pumpkin' && this.alive().length) { this.say(`Spore Spreader: Pumpkinhead #${m.n} Signature`, 'ai'); await this.withMob(m, () => this.performSignature()); } } finally { this._spore--; } }
  },
  async pumpAfflict(k, n) { if (!k || !k.alive) return; if (this.pumpKingdom === 'Venomous Quagmire') { this.say(`${k.name}: Afflict ${n} → Poison ${n}`); await this.fx.runKnightOp({ op: 'poison', n }, k, {}); } else this.say(`${k.name}: Afflict ${n} → Parasitize ${n} [미구현 — 키워드 정의 필요]`, 'warn'); },
  async pumpAfterAction() { if (!this.isPump || this._pumpBusy) return; this._pumpBusy = true; try { await this.pumpBurn(); } finally { this._pumpBusy = false; } },
  // ---------- ops ----------
  async pumpOp(o, ctx) {
    if (!this.isPump) return false; const M = this.monster, B = this.board; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t; const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur;
    switch (o.op) {
      case 'pumpAfflict': await this.pumpAfflict(t, o.n); return true;
      case 'pumpFastRegrowth': await this.pumpFastRegrowth(src, o.zone); return true;
      case 'pumpTransformingSeed': { if (this.pumpKingdom === 'Venomous Quagmire') { const lost = (ctx.attack && ctx.attack.vigorLostTotal) || 0; const x = Math.ceil(lost / 2); this.say(`Transforming Seed: 대상이 잃은 Vigor ${lost} → Swamp에 인접한 기사 -${x} Vigor`); if (x) for (const kn of this.alive()) if (B.neighbors(kn.pos).some(c => { const tt = B.terrainAt(c); return tt && tt.id === 'swamp'; })) await this.loseVigor(kn, x, { source: 'effect', armor: false }); }
        else if (src && src.cells.length) { const z = B.zone(src.cells, 3); const sap = M.mobs.filter(m => m.side === 'sapling' && m.cells.length && z.some(c => cellEq(c, m.cells[0]))); for (const m of sap) m.armor = (m.armor || 0) + 1; this.say(`Transforming Seed: Zone 3의 Sapling ${sap.length}개에 Armor 토큰`); } return true; }
      case 'pumpTokensAll': for (const m of [...M.mobs]) this.pumpToken(m, o.n); return true;
      case 'pumpReposition': if (k && k.alive && await this.yesNo(`${k.name}: Reposition ${o.n} (최대 ${o.n}칸 이동)?`, true)) await this.knightMove(k, o.n); return true;
      case 'pumpExtraToken': if (ctx.attack) ctx.attack.pumpExtra = (ctx.attack.pumpExtra || 0) + 1; return true;
      case 'pumpHeatToLimit': if (k && k.alive) { k.heat = k.heatLimit; this.say(`${k.name}: Heat → Heat Limit (${k.heat})`); } return true;
      case 'pumpEachDiscardCondition': for (const kn of this.alive()) { if (!kn.conditions.length) continue; const v = await this.ask({ type: 'pick', knight: kn.id, text: `${kn.name}: 버릴 Condition 카드 (선택)`, options: [...kn.conditions.map(c => ({ label: c.id, value: c.id })), { label: '버리지 않음', value: 'skip' }] }); if (v && v !== 'skip') this.removeCondition(kn, v); } return true;
      case 'pumpGather': { const at = (src && (src.cells[0] || src.lastCell)) || null; if (!at) return true; this.say(`각 Pumpkinhead가 Pumpking 쪽으로 ${o.n}칸 이동`); for (const m of [...M.mobs]) if (m !== src && m.side === 'pumpkin' && m.cells.length) await this.pumpMoveToward(m, at, { max: o.n }); await this.pumpBurn(); return true; }
      case 'pumpAIAgainstAttacker': { if (!k || !k.alive || !src || !M.mobs.includes(src)) return true; const card = M.drawAI(); if (!card) return true; this.say(`Perform AI against the Attacker — AI ${card.level}: ${card.name}`, 'ai'); await this.withMob(src, () => this.resolveMonsterAttack(card, { isAI: true, forceTarget: k })); M.discardAI(card); return true; }
      default: return false;
    }
  },
};
export const PUMP_OPS = ['pumpAfflict', 'pumpFastRegrowth', 'pumpTransformingSeed', 'pumpTokensAll', 'pumpReposition', 'pumpExtraToken', 'pumpHeatToLimit', 'pumpEachDiscardCondition', 'pumpGather', 'pumpAIAgainstAttacker'];
