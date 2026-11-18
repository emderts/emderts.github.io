// Bog Witch (Vassal Clash): One with the Bog (Bog track / Bog Move), Hex Weaver (Hexes on AI cards, Party Hexes), Talisman Hunt,
// Wispers of the Bog (Mud Wisp, Wisper Zone, Stray), Misfortune's Mistress, Cookie Crumbs, The Crone of the Bog.
import { DIRS, rearCells } from './board.js';
import { GameOver } from './core.js';
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const man = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };
const SWAMP = () => ({ id: 'swamp', name: 'Swamp', obstacle: false, chasm: false, difficult: true });

export const WitchMixin = {
  bwSetup(cs) {
    const M = this.monster, B = this.board, C = this, fx = this.fx; this.isBw = true;
    this.bw = { track: 0, off: false, wisp: null, swamps: [], party: [], disabled: new Set(), doomed: false, crumbs: 0, cur: null, wispHit: null };
    for (const t of cs.terrain) if (t.tile === 'swamp') this.bw.swamps.push(t.cells.map(l => B.parse(l)));
    for (const k of this.knights) k.hexes = [];
    const tt = this.turnToward.bind(this); this.turnToward = c => { if (!C.bw.off) tt(c); };
    const mc = this.monsterCenter.bind(this); this.monsterCenter = () => C.bw.off ? { c: (B.cols + 1) / 2, r: (B.rows - 1) / 2 } : mc();
    const fm = this.faceMostKnights.bind(this); this.faceMostKnights = async () => { if (!C.bw.off) return fm(); };
    const ta = B.terrainAt.bind(B); B.terrainAt = c => { const t = ta(c); if (!c) return t; for (const k of C.knights) if (k.alive && k.pos && C.bwHexed(k, 'Burden of the Fen') && !cellEq(k.pos, c) && Math.abs(k.pos.c - c.c) <= 1 && Math.abs(k.pos.r - c.r) <= 1) return SWAMP(); return t; };
    const aot = this.attackOneTarget.bind(this); this.attackOneTarget = async (attack, k) => { const S = C.bw.cur; if (S && !S.first) S.first = k; try { return await aot(attack, k); } finally { if (S && attack.hits && attack.hits[k.id] > 0) S.anyHit = true; } };
    const rma = this.resolveMonsterAttack.bind(this); this.resolveMonsterAttack = async (card, ctx) => { const outer = C.bw.cur; const S = C.bw.cur = { first: null, anyHit: false }; C.bw.doomed = !!(card.ops && card.ops.doomed); if (C.bw.doomed) C.say('Doomed: 이 공격 동안 Heat로 Evasion/Judgement 재굴림 불가', 'ai'); try { return await rma(card, ctx); } finally { C.bw.doomed = false; C.bw.cur = outer; if (card.ops && card.ops.hex && !C.result) await C.guard(() => C.bwAfterAI(card, S)); } };
    const kt = this.knightTurn.bind(this); this.knightTurn = async k => { k._bwIgnorePower = false; k._noRefresh = C.bwHexed(k, 'Morass Malady'); if (k._noRefresh) C.say(`${k.name}: Morass Malady — Refresh 단계 건너뜀`, 'bp'); await C.bwTurnStart(k); if (!k.alive) return; try { return await kt(k); } finally { k._noRefresh = false; } };
    const rc = this.reachable.bind(this); this.reachable = (k, sp) => { let out = rc(k, sp); const w = C.bw.wisp; if (w && C.bwInWisper(k.pos)) out = out.filter(c => C.bwInWisper(c)); return out; };
    const mk = this.moveKnight.bind(this); this.moveKnight = (k, cell) => { mk(k, cell); if (C.bw.wisp && cellEq(cell, C.bw.wisp)) C.bw.wispHit = k; };
    for (const fn of ['knightMove', 'knockback', 'pushback']) { const o = this[fn].bind(this); this[fn] = async (...a) => { const r = await o(...a); await C.bwWispCheck(); return r; }; }
    const dj = this.drawJudicium.bind(this); this.drawJudicium = async k => { if (k.alive && C.bwHexed(k, 'The Marsh Will Claim You') && !C._judRedraw) { C.say(`${k.name}: The Marsh Will Claim You — Judicium 대신 "You died!"`, 'death'); return C.die(k, 'The Marsh Will Claim You'); } return dj(k); };
    const die = this.die.bind(this); this.die = async (k, why) => { const r = await die(k, why); if (!k.alive && k.hexes && k.hexes.length && !M.hasTrait('Misfortune’s Mistress')) { for (const h of k.hexes) M.ai.discard.push(h); C.say(`${k.name} 사망 — Hex ${k.hexes.map(h => h.ops.hex.name).join(', ')}를 AI 버림 더미로`); k.hexes = []; } return r; };
    const ka = this.knightAttack.bind(this); this.knightAttack = async (k, opts) => { const w0 = M.wounds; C.bw.talisman = !C.bw.off && k.alive && C.bwWeakspots().some(c => cellEq(c, k.pos)); try { return await ka(k, opts); } finally { C.bw.talisman = false; const dw = M.wounds - w0; if (dw > 0 && M.hasTrait('Cookie Crumbs')) { C.bw.crumbs += dw; C.say(`Cookie Crumbs: Generic 토큰 ${C.bw.crumbs}`, 'bp'); } } };
    const mr = this.monsterRound.bind(this); this.monsterRound = async () => {
      if (M.hasTrait('Misfortune’s Mistress') && !M.ai.cards.length && !M.ai.discard.length) { C.say('Misfortune’s Mistress: AI 덱에 카드가 없음 — 모든 기사 사망, 패배', 'end'); C.result = 'lose'; throw new GameOver('lose'); }
      await mr(); if (C.result) return;
      if (C.bwParty('Slough Contagion')) { const h = C.bw.party.find(x => x.ops.hex.name === 'Slough Contagion'); h._tok = (h._tok || 0) + 1; const tier = h._tok >= 3 ? 'Grave' : h._tok === 2 ? 'Major' : 'Minor'; C.say(`Slough Contagion: 토큰 ${h._tok} — 모든 기사 ${tier} Mortis`, 'bp'); for (const k of C.alive()) await C.guard(() => C.drawMortis(k, tier)); C.checkEnd(); }
      if (M.hasTrait('Cookie Crumbs')) { const n = C.bw.crumbs; if (n >= 3) { C.say(`Cookie Crumbs: Monster Round 종료 — 토큰 ${n}`, 'bp'); if (n < 6 || n >= 9) await C.guard(() => C.performSignature()); if (n >= 6 && !C.result) await C.guard(() => C.activationAI()); C.checkEnd(); } }
      if (M.hasTrait('The Crone of the Bog') && C.bw.off && !C.result) { const ks = C.alive(); const card = M.ai.cards[0]; if (ks.length && card && card.ops.hex) { const k = C.rng.pick(ks); C.say(`The Crone of the Bog: Witch가 보드 밖 — ${k.name}이(가) AI 맨 위 카드의 Hex를 얻음`, 'bp'); await C.bwGainHex(k, card, true); } }
    };
  },
  // ---------- Hexes ----------
  bwHexOn(h) { const x = h.ops.hex; return !this.bw.disabled.has(x.type.replace(/ Party Hex| Hex/g, '')) && !(x.party && this.bw.disabled.has('Party')); },
  /** Morass Residue: "You cannot use keywords and abilities that target other Knights." x = null → any other Knight. */
  bwMayTarget(k, x) { if (!this.isBw || !k || x === k || !this.bwHexed(k, 'Morass Residue')) return true; if (!this._mrSaid || this._mrSaid !== this.round + ':' + k.id) { this._mrSaid = this.round + ':' + k.id; this.say(`${k.name}: Morass Residue — 다른 기사를 대상으로 하는 키워드·능력 사용 불가`, 'bp'); } return false; },
  bwHexed(k, name) { return !!(this.isBw && k && ((k.hexes || []).some(h => h.ops.hex.name === name && this.bwHexOn(h)) || this.bwParty(name))); },
  bwParty(name) { return this.isBw && this.bw.party.some(h => h.ops.hex.name === name && this.bwHexOn(h)); },
  bwTake(card) { const M = this.monster; for (const pile of [M.ai.discard, M.ai.cards]) { const i = pile.indexOf(card); if (i >= 0) pile.splice(i, 1); } },
  async bwAfterAI(card, S) {
    const hx = card.ops.hex; if (!hx || this.monster.signature === card) return;
    if (hx.party) { if (!S.anyHit) return; this.bwTake(card); if (!this.monster.hasTrait('Misfortune’s Mistress')) for (const old of this.bw.party.splice(0)) { this.monster.ai.discard.push(old); this.say(`Party Hex ${old.ops.hex.name} → AI 버림 더미`); } this.bw.party.push(card); this.say(`Party Hex: ${hx.name} (${hx.type}) — ${hx.text}`, 'bp'); return; }
    const k = S.first; if (!k || !k.alive) return; await this.bwGainHex(k, card, false);
  },
  async bwGainHex(k, card, fromDeck) {
    const M = this.monster, hx = card.ops.hex; if (hx.party) { this.bwTake(card); this.bw.party.push(card); this.say(`Party Hex: ${hx.name} — ${hx.text}`, 'bp'); return; }
    if (k.hexes.length && !M.hasTrait('Misfortune’s Mistress')) { const old = k.hexes[0]; if (card.level >= old.level) { k.hexes = []; M.ai.discard.push(old); this.say(`${k.name}: 기존 Hex ${old.ops.hex.name} (Level ${old.level}) → AI 버림 더미`); } else { this.say(`${k.name}: 이미 더 높은 Level의 Hex — ${hx.name}는 AI 버림 더미로`); if (fromDeck) { this.bwTake(card); M.ai.discard.push(card); } return; } }
    this.bwTake(card); k.hexes.push(card); card._tok = 0; this.say(`${k.name} Hexed: ${hx.name} (${hx.type}) — ${hx.text}`, 'bp');
    if (hx.name === 'Mire Sores') card._tok = 1; if (hx.name === 'Fen’s Feast') card._tok = this.alive().filter(x => x !== k).length;
  },
  bwDropHex(k, card) { if (card.ops.hex.party) this.bw.party = this.bw.party.filter(x => x !== card); else k.hexes = k.hexes.filter(x => x !== card); this.monster.ai.discard.push(card); this.say(`Hex ${card.ops.hex.name} 버림 → AI 버림 더미`, 'tech'); },
  async bwTurnStart(k) {
    for (const h of [...(k.hexes || [])]) { if (!k.alive) return; if (!this.bwHexOn(h)) continue; const n = h.ops.hex.name;
      if (n === 'Mire Sores') { h._tok++; this.say(`${k.name}: Mire Sores — 토큰 ${h._tok}, Vigor -${h._tok}`, 'bp'); await this.loseVigor(k, h._tok, { source: 'hex', armor: false }); }
      else if (n === 'Damned to the Mire') { const d = this.rng.die(10), v = ((k.virtues || {}).Insight || 0) + this.fx.virtueBonus(k, 'Insight'); this.say(`${k.name}: Damned to the Mire — Test Insight 6+: d10 ${d} +${v} → ${d + v >= 6 ? '성공' : '실패 → Stray 3'}`, 'dice'); if (d + v < 6) await this.bwStray(k, 3); }
      else if (n === 'Slough Sickness') { this.say(`${k.name}: Slough Sickness — Poison 1`, 'bp'); await this.fx.runKnightOp({ op: 'poison', n: 1 }, k, {}); }
      else if (n === 'Quag Fever') { const max = Math.min(3, Math.max(0, k.heatLimit)); const x = await this.ask({ type: 'number', knight: k.id, text: `${k.name}: Quag Fever — Heat Limit을 X만큼 낮추고 Poison 3-X (X 선택)`, default: 0, options: Array.from({ length: max + 1 }, (_, i) => ({ label: `X=${i}: Heat Limit -${i}, Poison ${3 - i}`, value: i })) }) || 0; if (x) { k.heatLimitBonus = (k.heatLimitBonus || 0) - x; if (k.heat > k.heatLimit) k.heat = k.heatLimit; } this.say(`${k.name}: Quag Fever — Heat Limit -${x}, Poison ${3 - x}`, 'bp'); if (3 - x > 0) await this.fx.runKnightOp({ op: 'poison', n: 3 - x }, k, {}); }
      else if (n === 'Fen’s Feast') { if (h._tok > 0) { h._tok--; this.say(`${k.name}: Fen’s Feast — 토큰 1 버림 (남은 ${h._tok})`, 'bp'); } else { this.say(`${k.name}: Fen’s Feast — 버릴 토큰 없음 → 사망`, 'death'); await this.die(k, 'Fen’s Feast'); } }
      else if (n === 'Beast of the Swamp') { const d = this.rng.die(10); if (d <= 3) { k.permPrecision = (k.permPrecision || 0) - 1; this.say(`${k.name}: Beast of the Swamp d10 ${d} — 영구 음수 Precision 토큰`, 'bp'); } else if (d <= 6) { k.modifiers.speed = (k.modifiers.speed || 0) - 1; this.say(`${k.name}: Beast of the Swamp d10 ${d} — 영구 음수 Speed 토큰`, 'bp'); } else if (d <= 9) { k.permEvasion = (k.permEvasion || 0) - 1; this.say(`${k.name}: Beast of the Swamp d10 ${d} — 영구 음수 Evasion 토큰`, 'bp'); } else { k._bwIgnorePower = true; this.say(`${k.name}: Beast of the Swamp d10 10 — 이번 턴 공격에서 Power 1 무시`, 'bp'); } }
    }
  },
  /** Mortis hook: 'skip' = ignore the card, a card = resolve that card instead. */
  bwMortis(k, card, deck) {
    if (card.positive && this.bwParty('Deforming Quagmire')) { this.say('Deforming Quagmire: 긍정 Mortis — 효과 무시', 'bp'); deck.putBottom(card); return 'skip'; }
    if (card.positive && this.bwHexed(k, 'As Quag Prophesied') && !this.bw._redraw) { this.bw._redraw = true; deck.putBottom(card); const c2 = deck.draw(); this.bw._redraw = false; if (c2) { this.say(`As Quag Prophesied: 긍정 Mortis → 다시 뽑음: ${c2.name} — ${c2.text}`, 'bp'); return c2; } return 'skip'; }
    return null;
  },
  // ---------- Bog track ----------
  bwWeakspots() { const M = this.monster; if (!M.cells.length) return []; const f = DIRS[M.facing], r = DIRS[RIGHT[M.facing]]; const dot = (a, v) => a.c * v.c + a.r * v.r; const fmax = Math.max(...M.cells.map(c => dot(c, f))); const front = M.cells.filter(c => dot(c, f) === fmax); const rs = front.map(c => dot(c, r)); const hi = front.find(c => dot(c, r) === Math.max(...rs)), lo = front.find(c => dot(c, r) === Math.min(...rs)); return [{ c: hi.c + r.c, r: hi.r + r.r }, { c: lo.c - r.c, r: lo.r - r.r }].filter(c => this.board.inside(c)); },
  bwInWisper(c) { const w = this.bw.wisp; return !!w && Math.abs(w.c - c.c) <= 2 && Math.abs(w.r - c.r) <= 2; },
  bwPlace(cells, why) { const M = this.monster, B = this.board; if (M.cells.length) B.remove(M.cells); M.cells = cells; B.place({ kind: 'monster', id: M.id }, cells); this.bw.off = false; this.say(`Bog Witch → ${cells.map(c => B.label(c)).join('/')} (${why})`, 'ai'); },
  async bwBogMove(target) {
    const M = this.monster, B = this.board, S = this.bw; if (!M.hasTrait('One with the Bog')) { this.say('Bog Move: One with the Bog 비활성'); return; }
    const kind = this.monsterDef.bw.track[S.track]; S.track = (S.track + 1) % 3; const tp = target && target.pos ? target.pos : this.monsterCenter(); this.say(`Bog Move: ${kind}${target ? ` (Target ${target.name})` : ''}`, 'ai');
    if (kind === 'Swamp') {
      if (!S.off) { const cells = M.cells.map(c => ({ ...c })); for (const c of cells) B.terrain.set(B.key(c), SWAMP()); S.swamps.push(cells); this.say(`Swamp 2x2 → ${cells.map(c => B.label(c)).join(', ')}`); }
      const tiles = S.swamps.filter(t => t.every(c => { const x = B.terrain.get(B.key(c)); return x && x.id === 'swamp'; })); if (!tiles.length) return; const d = t => t.reduce((s, c) => s + man(c, tp), 0); const m = Math.max(...tiles.map(d)); const best = tiles.filter(t => d(t) === m);
      let t = best[0]; if (best.length > 1) { const v = await this.ask({ type: 'pick', text: 'Bog Move (Swamp): Target에서 가장 먼 Swamp 타일 (동률)', options: best.map((x, i) => ({ label: x.map(c => B.label(c)).join('/'), value: i })) }); t = best[v] || t; }
      this.bwPlace(t.map(c => ({ ...c })), 'Swamp 타일'); await this.displaceKnightsUnderMonster();
    } else if (kind === 'Mud Wisp') {
      if (S.off) { this.say('Bog Witch가 보드 밖 — Mud Wisp 배치·이동 생략'); return; }
      const ws = this.bwWeakspots().filter(c => !this.knightAt(c)); if (ws.length) { const cell = ws.length > 1 ? await this.ask({ type: 'move', text: 'Bog Move (Mud Wisp): 마커를 놓을 Weakspot 칸 선택', cells: ws, options: ws.map(c => ({ label: B.label(c), value: c })) }) || ws[0] : ws[0]; S.wisp = cell; this.say(`Mud Wisp 마커 → ${B.label(cell)} (Wisper Zone: 주변 Zone 2)`, 'ai'); }
      const dv = this.dirFromMonster(tp); const d = { c: -dv.c, r: -dv.r }; let n = 0; for (let i = 0; i < 4; i++) { if (await this.monsterStep(d) !== 'ok') break; n++; } await this.displaceKnightsUnderMonster(); this.say(`Bog Witch Target 반대쪽으로 ${n}칸 이동 (방향 유지)`, 'ai');
    } else {
      if (S.off) { this.say('Bog Witch가 이미 보드 밖'); return; }
      for (const c of M.cells) B.terrain.set(B.key(c), { id: 'rotten stump', name: 'Rotten Stump', obstacle: true, obscuring: false, destructible: true, chasm: false, difficult: false }); this.say(`Rotten Stump 2x2 → ${M.cells.map(c => B.label(c)).join(', ')} — Bog Witch 보드에서 제거 (보드 밖에서도 공격)`, 'ai'); B.remove(M.cells); M.cells = []; S.off = true;
    }
  },
  /** A Knight moved onto the Mud Wisp marker: the Witch is placed on it. */
  async bwWispCheck() {
    const S = this.bw, B = this.board; const k = S.wispHit; S.wispHit = null; if (!k || !S.wisp || !k.alive || !cellEq(k.pos, S.wisp)) return; const w = S.wisp; S.wisp = null; this.say(`${k.name}이(가) Mud Wisp 위로 이동 — Bog Witch가 Mud Wisp에 나타남`, 'ai'); await this.windowOfOpportunity('react', null);
    const cands = [{ c: w.c - 1, r: w.r - 1 }, { c: w.c, r: w.r - 1 }, { c: w.c - 1, r: w.r }, { c: w.c, r: w.r }].map(o => [o, { c: o.c + 1, r: o.r }, { c: o.c, r: o.r + 1 }, { c: o.c + 1, r: o.r + 1 }]).filter(t => t.every(c => B.inside(c)));
    if (!cands.length) return; const n = t => this.alive().filter(x => t.some(c => cellEq(c, x.pos))).length; const m = Math.max(...cands.map(n)); const best = cands.filter(t => n(t) === m); let t = best[0]; if (best.length > 1) { const v = await this.ask({ type: 'pick', text: 'Mud Wisp: Bog Witch 위치 — 기사를 가장 많이 덮는 위치 (동률)', options: best.map((x, i) => ({ label: x.map(c => B.label(c)).join('/'), value: i })) }); t = best[v] || t; }
    for (const c of t) { const x = B.terrain.get(B.key(c)); if (x && x.obstacle && x.destructible) B.terrain.delete(B.key(c)); } this.bwPlace(t, 'Mud Wisp'); await this.faceMostKnights(); await this.displaceKnightsUnderMonster();
  },
  /** Stray X: move X spaces directly toward the Mud Wisp marker (or the closest Terrain tile), around occupied spaces. */
  async bwStray(k, n) {
    const B = this.board, S = this.bw; if (!k || !k.alive || !(n > 0)) return; let goals = S.wisp ? [S.wisp] : [...B.terrain.keys()].map(key => { const [c, r] = key.split(',').map(Number); return { c, r }; }); if (!goals.length) return;
    const pass = c => B.inside(c) && !this.knightAt(c) && !this.monsterOccupies(c) && !B.isObstacle(c); const dist = new Map([[B.key(k.pos), 0]]); const prev = new Map(); let fr = [k.pos]; let hit = null;
    while (fr.length && !hit) { const nx = []; for (const c of fr) { if (goals.some(g => cellEq(g, c)) && !cellEq(c, k.pos)) { hit = c; break; } for (const m of B.neighbors(c)) { const key = B.key(m); if (dist.has(key) || !(pass(m) || goals.some(g => cellEq(g, m) && !this.knightAt(m) && !this.monsterOccupies(m)))) continue; dist.set(key, dist.get(B.key(c)) + 1); prev.set(key, c); nx.push(m); } } fr = nx; }
    if (!hit) { this.say(`${k.name} Stray ${n}: 갈 수 있는 경로 없음`); return; } const path = []; let c = hit; while (c && !cellEq(c, k.pos)) { path.unshift(c); c = prev.get(B.key(c)); }
    let m = 0; for (const step of path.slice(0, n)) { const t = B.terrain.get(B.key(step)); if (!S.wisp && t && (t.obstacle || t.id === 'swamp') ) break; this.moveKnight(k, step); m++; }
    this.say(`${k.name} Stray ${n}: ${S.wisp ? 'Mud Wisp' : '가장 가까운 Terrain'} 쪽으로 ${m}칸 → ${B.label(k.pos)}`, 'ai'); await this.bwWispCheck();
  },
  bwCarrionTargets() { const M = this.monster; if (this.bw.off || !M.cells.length) return this.alive(); const cs = M.cells.map(c => c.c), rs = M.cells.map(c => c.r); const c0 = Math.min(...cs) - 3, c1 = Math.max(...cs) + 3, r0 = Math.min(...rs) - 1, r1 = Math.max(...rs) + 1; return this.alive().filter(k => k.pos.c < c0 || k.pos.c > c1 || k.pos.r < r0 || k.pos.r > r1); },
  /** Talisman Hunt: before drawing a BP from a Weakspot space, a BP card of a chosen Level may be put on top (face unseen). */
  async bwTalisman(k) {
    const M = this.monster; if (!this.bw.talisman || !M.hasTrait('Talisman Hunt') || M.bp.cards.length < 2) return; const lvls = [...new Set(M.bp.cards.slice(1).map(c => c.level))].sort();
    const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Talisman Hunt (Weakspot에서 공격) — BP 덱의 다른 카드 한 장을 맨 위에 놓기`, options: [{ label: '사용 안 함', value: 'skip' }, ...lvls.map(l => ({ label: `BP ${l} 카드 한 장 (앞면 비공개)`, value: l }))] }); if (!v || v === 'skip') return;
    const pool = M.bp.cards.slice(1).filter(c => c.level === v); const card = this.rng.pick(pool); M.bp.cards.splice(M.bp.cards.indexOf(card), 1); M.bp.cards.unshift(card); this.say(`Talisman Hunt: BP ${v} 카드 한 장을 덱 맨 위에`, 'tech');
  },
  async bwMayEnd(k, A, bp) { if (bp.ops.mayEnd && k.alive && await this.yesNo(`${k.name}: ${bp.name} — Power Roll 전에 이 공격을 자발적으로 끝내기? (Knight Pool 비움)`, false)) { this.pool = []; this.say(`${k.name}: 공격을 끝냄 — Knight Pool 비움`, 'tech'); return true; } return false; },
  async bwPickHex(k, { party = false, any = false } = {}) {
    const opts = []; const ks = any ? this.alive() : [k]; for (const x of ks) for (const h of x.hexes || []) opts.push({ k: x, h }); if (party) for (const h of this.bw.party) opts.push({ k: null, h }); if (!opts.length) return;
    const v = await this.ask({ type: 'pick', knight: k && k.id, text: 'Hex 하나 버리기 (선택)', options: [...opts.map((o, i) => ({ label: `${o.h.ops.hex.name}${o.k ? ' — ' + o.k.name : ' (Party Hex)'}`, value: i })), { label: '안 함', value: 'skip' }] }); if (v == null || v === 'skip' || !opts[v]) return; this.bwDropHex(opts[v].k, opts[v].h);
  },
  async bwOp(o, ctx) {
    if (!this.isBw) return false; const M = this.monster, S = this.bw, B = this.board; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t; const gate = id => (ctx.gatesOn || []).some(g => g.op === id);
    switch (o.op) {
      case 'bwOnHit': if (ctx.hits > 0 && t && t.alive) for (const x of o.then) { if (!t.alive) break; await this.fx.runMonsterOp(x, ctx); } return true;
      case 'bwPerHit': for (let i = 0; i < (ctx.hits || 0) && t && t.alive; i++) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'bwIfHits': if ((ctx.hits || 0) >= o.gte && (o.lt == null || ctx.hits < o.lt) && t && t.alive) await this.fx.runMonsterOps(o.then, ctx); return true;
      case 'bwTable': if (t && t.alive && ctx.hits > 0) await this.loseVigor(t, o.table[Math.min(o.table.length, ctx.hits) - 1] + (M.bonuses.vigorLoss || 0), { source: 'attack', perilCheck: true }); return true;
      case 'bwPoison': if (t && t.alive) await this.fx.runKnightOp({ op: 'poison', n: o.n }, t, {}); return true;
      case 'bwToxify': if (t && t.alive) await this.fx.runKnightOp({ op: 'toxify', n: o.n === 'level' ? M.level : o.n }, t, {}); return true;
      case 'bwHeat': if (t && t.alive) await this.fx.runKnightOp({ op: 'gainHeat', n: o.n }, t, {}); return true;
      case 'bwStray': await this.bwStray(t, o.gated && gate('bwStray4') ? o.gated : o.n); return true;
      case 'bwSlimed': if (t && t.alive) await this.addCondition(t, gate('bwDrownInstead') ? 'Drowning' : 'Slimed'); return true;
      case 'bwDie': if (t && t.alive) { this.say(`${t.name}: 2회 이상 명중 → 사망`, 'death'); await this.die(t, this.lastAI ? this.lastAI.name : 'Bog Witch'); } return true;
      case 'bwBogMove': { const a = ctx.attack; const tg = ctx.primary || (a && a.targets && a.targets[0]) || ctx.attacker || [...this.alive()].sort((x, y) => man(x.pos, this.monsterCenter()) - man(y.pos, this.monsterCenter()))[0]; await this.bwBogMove(tg); return true; }
      case 'bwSquare': { const a = ctx.attack, p = ctx.primary; if (!a || !p) return true; a.targets = [p, ...this.alive().filter(x => x !== p && Math.abs(x.pos.c - p.pos.c) <= 1 && Math.abs(x.pos.r - p.pos.r) <= 1)]; this.say(`Zone (Target 주변 3x3): ${a.targets.map(x => x.name).join(', ')}`); return true; }
      case 'bwCarrion': { const a = ctx.attack; if (a) { a.targets = this.bwCarrionTargets(); this.say(`Carrion Zone: ${a.targets.map(x => x.name).join(', ') || '대상 없음'}`); } return true; }
      case 'bwPullAdjacent': { const p = ctx.primary; if (!p || !p.alive || S.off || this.adjacentToMonster(p)) return true; const free = []; for (const m of M.cells) for (const n of B.neighbors(m)) if (B.inside(n) && !M.cells.some(x => cellEq(x, n)) && !B.isObstacle(n) && !this.knightAt(n) && !free.some(x => cellEq(x, n))) free.push(n); if (!free.length) return true; free.sort((a, b) => man(a, p.pos) - man(b, p.pos)); this.moveKnight(p, free[0]); this.say(`${p.name}: Bog Witch 옆으로 옮겨짐 → ${B.label(free[0])}`, 'ai'); return true; }
      case 'bwSwampMiddle': { const mid = { c: Math.floor(B.cols / 2), r: Math.floor(B.rows / 2) - 1 }; const cands = []; for (let c = 1; c < B.cols; c++) for (let r = 0; r < B.rows - 1; r++) { const cells = [{ c, r }, { c: c + 1, r }, { c, r: r + 1 }, { c: c + 1, r: r + 1 }]; if (cells.some(x => B.terrain.get(B.key(x)) || M.cells.some(m => cellEq(m, x)))) continue; cands.push({ cells, d: man({ c, r }, mid) }); } if (!cands.length) return true; cands.sort((a, b) => a.d - b.d); const cells = cands[0].cells; for (const c of cells) B.terrain.set(B.key(c), SWAMP()); S.swamps.push(cells); this.say(`The Bog Cometh Alive: Swamp 2x2 → ${cells.map(c => B.label(c)).join(', ')} (보드 중앙)`, 'ai'); for (const x of this.alive()) if (cells.some(c => cellEq(c, x.pos))) this.say(`${x.name}: Swamp 위`, 'warn'); return true; }
      case 'bwDiscardHex': await this.bwPickHex(k, { party: !!o.party, any: o.who === 'any' }); return true;
      case 'bwDiscardAllHexes': for (const x of this.knights) for (const h of [...(x.hexes || [])]) this.bwDropHex(x, h); return true;
      case 'bwDisable': S.disabled.add(o.type); this.say(o.type === 'Party' ? 'Party Hex 비활성' : `${o.type} Hex 효과 비활성`, 'tech'); return true;
      case 'bwDiscardCondition': { const opts = []; for (const x of this.alive()) for (const c of x.conditions) if ((!o.ids || o.ids.includes(c.id)) && !/^Knockdown/.test(c.id)) opts.push({ x, c }); if (!opts.length) return true; const v = await this.ask({ type: 'pick', text: '기사 1명이 Condition 카드 1장 버리기 (선택)', options: [...opts.map((p, i) => ({ label: `${p.x.name}: ${p.c.id}`, value: i })), { label: '안 함', value: 'skip' }] }); if (v != null && v !== 'skip' && opts[v]) { opts[v].x.conditions = opts[v].x.conditions.filter(c => c !== opts[v].c); this.say(`${opts[v].x.name}: ${opts[v].c.id} 버림`, 'tech'); } return true; }
      case 'bwPriority': if (k && k.alive) { this.priorityTarget = k; this.say(`${k.name}: Priority Target 토큰 획득`); } return true;
      case 'bwPlaceAnywhere': { const cells = []; for (let c = 1; c < B.cols; c++) for (let r = 0; r < B.rows - 1; r++) { const t4 = [{ c, r }, { c: c + 1, r }, { c, r: r + 1 }, { c: c + 1, r: r + 1 }]; if (t4.every(x => !this.knightAt(x) && !(B.terrain.get(B.key(x)) && B.terrain.get(B.key(x)).obstacle))) cells.push({ c, r }); } if (!cells.length) return true; const o1 = await this.ask({ type: 'move', text: 'Bog Witch를 보드 어디에나 놓기 — 2x2의 왼쪽 아래 칸 선택', cells, options: cells.map(c => ({ label: B.label(c), value: c })) }) || cells[0]; this.bwPlace([o1, { c: o1.c + 1, r: o1.r }, { c: o1.c, r: o1.r + 1 }, { c: o1.c + 1, r: o1.r + 1 }], 'Bog-Devoured Carcass Critical'); return true; }
      case 'bwLose': if (k && k.alive) { k.heatLimitBonus = (k.heatLimitBonus || 0) - o.heatLimit; if (k.heat > k.heatLimit) k.heat = k.heatLimit; k.passion = Math.max(0, k.passion - o.passion); this.say(`${k.name}: Heat Limit -${o.heatLimit}, Passion -${o.passion}`, 'dmg'); await this.loseVigor(k, o.vigor, { source: 'response' }); } return true;
      case 'bwHeatLimitTo': if (k && k.alive) { k.heatLimitBonus = (k.heatLimitBonus || 0) - Math.max(0, k.heatLimit - o.n); if (k.heat > k.heatLimit) k.heat = k.heatLimit; this.say(`${k.name}: Heat Limit → ${k.heatLimit}`, 'dmg'); } return true;
      case 'bwExhaustWeapon': { if (!k || !k.alive) return true; const w = (ctx.attack && ctx.attack.weapon && k.gear.includes(ctx.attack.weapon)) ? ctx.attack.weapon : k.gear.find(g => g.type === 'weapon' && !g.discarded && !g.exhausted); if (w) { w.exhausted = true; this.say(`${k.name}: ${w.name} 소진`, 'dmg'); } return true; }
      case 'bwRoutine': for (const x of this.alive()) { await this.addCondition(x, 'Drowning'); await this.fx.runKnightOp({ op: 'toxify', n: 4 }, x, {}); } return true;
      case 'bwHeatReset': if (t && t.alive) { t.heatLimitBonus = (t.heatLimitBonus || 0) - (t.heatLimit - t.uninjuredHeatLimit); if (t.heat > t.heatLimit) t.heat = t.heatLimit; this.say(`${t.name}: Heat Limit → ${t.heatLimit} (Maximum Vigor threshold의 값)`, 'dmg'); } return true;
      case 'bwNote': this.say(o.text, 'warn'); return true;
      default: return false;
    }
  },
};
export const BW_OPS = ['bwOnHit', 'bwPerHit', 'bwIfHits', 'bwTable', 'bwPoison', 'bwToxify', 'bwHeat', 'bwStray', 'bwSlimed', 'bwDie', 'bwBogMove', 'bwSquare', 'bwCarrion', 'bwPullAdjacent', 'bwSwampMiddle', 'bwDiscardHex', 'bwDiscardAllHexes', 'bwDisable', 'bwDiscardCondition', 'bwPriority', 'bwPlaceAnywhere', 'bwLose', 'bwHeatLimitTo', 'bwExhaustWeapon', 'bwRoutine', 'bwNote', 'bwHeatReset', 'bwDoomed', 'bwKing', 'bwStray4', 'bwDrownInstead'];
