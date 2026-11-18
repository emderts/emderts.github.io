// Panzergeists (Mob Clash): Suit Up! (Armor tokens on the Board), All Things Die (Rust / Metal), Ceaseless Hunger (Maximum Vigor, Possession,
// Recover), Panzer Cascade, Muffled Potential, Soul of the Metal, Armored Contagion, No Rest for Any.
const cellEq = (a, b) => a && b && a.c === b.c && a.r === b.r;
const man = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

export const PanzerMixin = {
  pzSetup(cs) {
    const M = this.monster, B = this.board, C = this, fx = this.fx; this.isPz = true; this.intangible = true;
    const P = this.icdPiles(); for (const l of cs.armorTokens || []) { const c = B.parse(l); this.pzPut(c, 1); }
    for (const k of this.knights) k._pzMax = k.maxVigor;
    const gt = fx.gearTraits.bind(fx); fx.gearTraits = (k, g) => { let t = gt(k, g); if (g.rustBane > 0) t = [...t.filter(x => x !== 'Metal'), 'Rust']; else if (M.hasTrait('Armored Contagion') && !t.some(x => ['Ethereal', 'Holy', 'Rust', 'Metal'].includes(x))) t = [...t, 'Metal']; return t; };
    const esc = M.escalateAI.bind(M); M.escalateAI = level => { if (M.hasTrait('Panzer Cascade') && !M.aiEsc[2].size && !M.aiEsc[3].size) { const mobs = M.mobs.filter(m => m.cells.length); if (mobs.length) { const lv = Math.min(...mobs.map(m => m.card.level)); const m = mobs.find(x => x.card.level === lv); m.armor++; C.say(`Panzer Cascade: Escalation 덱에 AI 없음 → Mob #${m.n} Armor 토큰 +1 (${m.armor})`, 'bp'); } return { removed: null, added: null }; } return esc(level); };
    const km = this.killMob.bind(this); this.killMob = mob => { const n = mob.armor, cell = mob.cells[0], host = mob.possess; const w = km(mob); if (n > 0 && cell) { C.pzPut(cell, n); C.say(`Suit Up!: Armor 토큰 ${n}개 → ${B.label(cell)}`, 'bp'); } if (host) C.pzRelease(host, cell); return w; };
    const bm = this.bypassMoveToward.bind(this); this.bypassMoveToward = async (mob, target, max) => { const from = mob.cells[0]; const r = await bm(mob, target, max); await C.pzThrough(mob, from); return r; };
    const ab = this.appearBehind.bind(this); this.appearBehind = async (mob, k) => { const from = mob.cells[0]; const r = await ab(mob, k); await C.pzThrough(mob, from); return r; };
    const kr = this.knightRound.bind(this); this.knightRound = async () => {
      await kr();
      if (M.hasTrait('No Rest for Any')) { const pt = C.priorityTarget; if (pt && pt.alive && !pt.possessed) { C.say(`No Rest for Any: End of Knight Round — ${pt.name}(Priority Target) Maximum Vigor -6`, 'bp'); await C.guard(() => C.pzLower(pt, 6)); C.checkEnd(); } }
    };
    this.say(`Suit Up!: Armor 토큰 ${P.size}개 배치 (${[...P.keys()].map(k => { const [c, r] = k.split(',').map(Number); return B.label({ c, r }); }).join(', ')})`);
  },
  /** No Rest for Any — "Start of your turn: If Possessed, the Mob on your Knight Board performs Signature (you still skip your turn)": Possessed Knights take their (skipped) turn in the order the players choose. */
  pzTurnKnights() { return this.isPz && this.monster.hasTrait('No Rest for Any') ? this.knights.filter(k => k.possessed && this.monster.mobs.includes(k.possessed)) : []; },
  async pzPossessedTurn(k) { const mob = k.possessed; if (!mob || !this.monster.mobs.includes(mob)) return; this.say(`No Rest for Any: ${k.name} 턴 시작 (빙의) — Mob #${mob.n} Signature, 턴은 건너뜀`, 'ai'); await this.withMob(mob, () => this.performSignature()); this.checkEnd(); },
  pzPut(cell, n) { const B = this.board, key = B.key(cell), P = this.icdPiles(); P.set(key, (P.get(key) || 0) + n); if (!B.terrainAt(cell)) B.terrain.set(key, { id: 'armor tokens', pile: true, obstacle: false, obscuring: false, destructible: false, chasm: false, difficult: false }); },
  pzPiles() { const out = []; for (const [key, n] of this.icdPiles()) { const [c, r] = key.split(',').map(Number); out.push({ cell: { c, r }, n }); } return out; },
  pzBoardTokens() { return this.pzPiles().reduce((s, p) => s + p.n, 0); },
  /** Tokens on the spaces a Geist moved through: the player picks the route whenever the possible (shortest) routes pass different Armor tokens. */
  async pzThrough(mob, from) {
    if (!mob.cells.length || !from || cellEq(from, mob.cells[0]) || !this.armorPiles || !this.armorPiles.size) return; const B = this.board, to = mob.cells[0]; const P = this.armorPiles;
    const dx = Math.sign(to.c - from.c), dy = Math.sign(to.r - from.r); const routes = new Map();
    const walk = (c, got) => { if (routes.size > 40) return; if (cellEq(c, to)) { const key = got.map(x => B.key(x)).join('|'); if (!routes.has(key)) routes.set(key, got); return; }
      for (const d of [{ c: dx, r: 0 }, { c: 0, r: dy }]) { if (!d.c && !d.r) continue; const n = { c: c.c + d.c, r: c.r + d.r }; if ((to.c - n.c) * dx < 0 || (to.r - n.r) * dy < 0 || !B.inside(n)) continue; walk(n, !cellEq(n, to) && P.get(B.key(n)) ? [...got, n] : got); } };
    walk(from, []); const cnt = r => r.reduce((a, c) => a + (P.get(B.key(c)) || 0), 0); const list = [...routes.values()].sort((a, b) => cnt(b) - cnt(a)); if (!list.length) return;
    let pick = list[0]; if (list.length > 1) { const i = await this.ask({ type: 'pick', text: `Mob #${mob.n} 이동 경로 (${B.label(from)} → ${B.label(to)}) — 지나갈 Armor 토큰 칸 선택`, options: list.map((r, i) => ({ label: r.length ? `${r.map(c => B.label(c)).join(', ')} (토큰 ${cnt(r)})` : '토큰 없는 경로', value: i })) }); pick = list[i] || list[0]; }
    for (const c of pick) this.icdPickup(mob, c);
  },
  pzClosestPiles(from) { const ps = this.pzPiles(); if (!ps.length) return []; const m = Math.min(...ps.map(p => man(p.cell, from))); return ps.filter(p => man(p.cell, from) === m); },
  /** Move a Geist up to `max` spaces toward / onto the closest Armor token (Superior Bypass). */
  async pzToToken(mob, max = 99) {
    if (mob && mob.slowToken) { mob.slowToken = false; max = Math.min(max, 3); this.say(`임시 Speed 토큰: Mob #${mob.n}의 이번 이동은 3칸에서 멈춤 (토큰 버림)`, 'tech'); }
    const B = this.board, M = this.monster; if (!mob || !M.mobs.includes(mob) || !mob.cells.length) return; const from = mob.cells[0]; if (this.icdPiles().has(B.key(from))) { this.icdPickup(mob, from); return; }
    const cand = this.pzClosestPiles(from); if (!cand.length) { this.say(`Mob #${mob.n}: 보드에 Armor 토큰 없음`); return; }
    let p = cand[0]; if (cand.length > 1) { const c = await this.ask({ type: 'move', text: `Mob #${mob.n}: 가장 가까운 Armor 토큰 (동률)`, cells: cand.map(x => x.cell), options: cand.map(x => ({ label: B.label(x.cell), value: x.cell })) }); p = cand.find(x => cellEq(x.cell, c)) || cand[0]; }
    const ok = c => B.inside(c) && (cellEq(c, from) || (!this.knightAt(c) && (!this.mobAt(c) || this.mobAt(c) === mob)));
    let all = []; for (let c = 1; c <= B.cols; c++) for (let r = 0; r < B.rows; r++) { const x = { c, r }; if (ok(x) && man(x, from) <= max) all.push(x); }
    const d = x => man(x, p.cell); const m = Math.min(...all.map(d)); let ends = all.filter(x => d(x) === m); const m2 = Math.min(...ends.map(x => man(x, from))); ends = ends.filter(x => man(x, from) === m2);
    let end = ends[0]; if (ends.length > 1) end = await this.ask({ type: 'move', text: `Mob #${mob.n}: Armor 토큰(${B.label(p.cell)}) 쪽으로 이동 — 도착 칸`, cells: ends, options: ends.map(c => ({ label: B.label(c), value: c })) }) || ends[0];
    if (cellEq(end, from)) return; this.mobStepTo(mob, end); await this.pzThrough(mob, from); this.say(`Mob #${mob.n} → ${B.label(end)} (Armor 토큰 ${B.label(p.cell)} 쪽, 현재 Armor ${mob.armor})`, 'ai');
  },
  async pzEndActivation(mob) { if (this.isPz && this.monster.hasTrait('Soul of the Metal') && this.monster.mobs.includes(mob) && mob.cells.length && this.icdPiles().size) { this.say(`Soul of the Metal: Mob #${mob.n} → 가장 가까운 Armor 토큰`, 'bp'); await this.pzToToken(mob, 99); } },
  // ---------- Rust / Metal ----------
  async pzRust(k, times = 1) {
    if (!k || !k.alive || k.possessed) return; let n = 0; for (let i = 0; i < times; i++) for (const g of k.gear) { if (g.discarded) continue; if (!this.fx.gearTraits(k, g).includes('Metal')) continue; g.rustBane = (g.rustBane || 0) + 1; n++; }
    for (const g of k.gear) if (g.rustBane && !g.discarded) n += 0;
    if (!n) { this.say(`${k.name}: Rust — Metal Gear 없음`); return; } this.say(`${k.name}: Rust — Metal Gear ${n}장에 Bane 토큰 (Rust 획득, Metal 상실)`, 'bp'); await this.fx.runKnightOp({ op: 'bane', n }, k, {});
  },
  pzToHit(k, A) { const mob = A && A.mob; if (!mob || Math.max(0, (mob.armor || 0) - ((A && A.ignoreArmor) || 0)) > 0 || !this.monster.hasTrait('All Things Die') || !A.weapon) return 0; const t = this.fx.gearTraits(k, A.weapon); if (t.some(x => ['Rust', 'Ethereal', 'Holy'].includes(x))) return 0; this.say(`All Things Die: Armor 토큰 없는 Geist, ${A.weapon.name}에 Rust/Ethereal/Holy 없음 → To Hit +4`, 'bp'); return 4; },
  pzDice(mob) { let n = 0; if (this.monster.hasTrait('Panzer Cascade') && mob) n += mob.armor || 0; n += this.mobAura('pzDie'); return n; },
  pzPotential(k, A, dice, potential) { if (!this.monster.hasTrait('Muffled Potential') || !A.weapon || !this.fx.gearTraits(k, A.weapon).includes('Rust')) return potential; const x = dice.filter(d => (d.face.T || 0) > 0).length; if (x) this.say(`Muffled Potential: Rust 무기 — Power die ${x}개에서 Potential 1씩 무시`, 'bp'); return Math.max(0, potential - x); },
  pzCannotWound(A) { const cw = A.bp && A.bp.ops && A.bp.ops.cannotWound; if (!cw) return false; const n = this.monster.mobs.filter(m => m.card.level === 1).length; if (n >= cw.bp1OnTrack) { this.say(`${A.bp.name}: Mob track에 BP 1 카드 ${n}장 (4장 이상) → 부상시킬 수 없음`, 'bp'); return true; } return false; },
  // ---------- Maximum Vigor / Possession ----------
  async pzLower(k, n) {
    if (!k || !k.alive || k.possessed) return; const m0 = k.maxVigor; k.setMaxVigor(m0 - n); this.say(`${k.name}: Maximum Vigor ${m0} → ${k.maxVigor}${k.vigor < m0 ? ` (Vigor ${k.vigor})` : ''}`, 'dmg');
    if (m0 - n <= 0 && this.monster.hasTrait('Ceaseless Hunger')) await this.pzPossess(k);
  },
  async pzPossess(k) {
    const M = this.monster, B = this.board; const pool = M.mobs.filter(m => m.cells.length && !m.possess); if (!pool.length) { this.say(`${k.name}: 빙의할 Mob 없음`); return; }
    const d = m => man(m.cells[0], k.pos); const best = Math.min(...pool.map(d)); const mob = await this.pickMob(pool.filter(m => d(m) === best), `${k.name}에게 가장 가까운 Mob (빙의, 동률)`);
    const cell = k.pos; k.possessed = mob; mob.possess = k; B.remove(mob.cells); mob.cells = []; this.mobStepTo(mob, cell);
    this.say(`Ceaseless Hunger: ${k.name} Maximum Vigor 0 → Mob #${mob.n}에게 빙의됨 (기사 미니어처 = 그 Mob, 턴 건너뜀)`, 'death');
    if (!this.alive().length) { this.say('모든 기사가 빙의됨 — 패배', 'end'); this.checkEnd(); }
    if (this.phase === 'knight' && this._pzTurn === k) { const e = new Error(`${k.name} 빙의 — 턴 종료`); e.chainBreak = true; throw e; }
  },
  pzRelease(k, cell) { k.possessed = null; if (cell) k.pos = cell; k.setMaxVigor(k._pzMax); this.say(`${k.name}: 빙의 해제 — Maximum Vigor ${k.maxVigor} 복구 (Vigor ${k.vigor})`, 'wound'); },
  pzRecover(k, n) { if (!k || !k.alive) return; k.setMaxVigor(k.maxVigor + n); k.gainVigor(n); this.say(`${k.name}: Recover ${n} — Maximum Vigor ${k.maxVigor}, Vigor ${k.vigor}`, 'tech'); },
  /** "Discard Bane tokens": the player picks which ones — tokens on Gear (Rust) or the others. */
  async pzDiscardBane(k, n) { let x = 0; for (let i = 0; i < n && (k.bane || 0) > 0; i++) { const rusted = k.gear.filter(g => !g.discarded && g.rustBane > 0); const onGear = rusted.reduce((a, g) => a + g.rustBane, 0); const free = k.bane - onGear; const opts = [...(free > 0 ? [{ label: `Gear 위가 아닌 Bane (${free})`, value: '' }] : []), ...rusted.map(g => ({ label: `${g.name} 위 Bane (${g.rustBane})`, value: g.name }))]; if (!opts.length) break; const v = opts.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 버릴 Bane 토큰 (${i + 1}/${n})`, options: opts }) : opts[0].value; const g = rusted.find(y => y.name === v); if (g) g.rustBane--; k.bane--; x++; } this.say(`${k.name}: Bane 토큰 ${x}개 버림 (Bane ${k.bane})`, 'tech'); },
  pzEndOfClash() { for (const k of this.knights) if (k.possessed) { this.say(`${k.name}: Clash 종료 시 빙의 상태 → 사망`, 'death'); k.possessed = null; k.alive = false; k.permMaxVigor = (k.permMaxVigor || 0) - 1; this.say(`${k.name}: Maximum Vigor 영구 -1 (Knight Sheet)`, 'death'); } },
  async pzOp(o, ctx) {
    if (!this.isPz) return false; const M = this.monster, B = this.board; const src = ctx.source || (ctx.attack && ctx.attack.mob) || M.cur; const t = ctx.target || ctx.primary || ctx.attacker; const k = ctx.attacker || t; const live = m => m && M.mobs.includes(m) && m.cells.length;
    if (o.onHit && !(ctx.hits > 0)) return true;
    switch (o.op) {
      case 'pzRust': await this.pzRust(t, o.perHit ? ctx.hits || 0 : 1); return true;
      case 'pzKnockdown': if (t && t.alive) await this.knockdown(t); return true;
      case 'pzBanePerHit': if (t && t.alive && ctx.hits > 0) await this.fx.runKnightOp({ op: 'bane', n: o.n * ctx.hits }, t, {}); return true;
      case 'pzLower': if (t && t.alive) await this.pzLower(t, o.n === 'bane' ? t.bane || 0 : o.n === 'all' ? t.maxVigor : o.n); return true;
      case 'pzLowerPerWound': { const a = ctx.attacker || (this.currentKnightAttack && this.currentKnightAttack.knight); const n = M.wounds; if (a && a.alive && n > 0) { this.say(`When you reveal: ${a.name} Maximum Vigor -${n} (Wound Stack ${n})`, 'bp'); await this.pzLower(a, n); } return true; }
      case 'pzIngrid': { const a = ctx.attacker || (this.currentKnightAttack && this.currentKnightAttack.knight); if (M.mobs.some(m => m.card.level === 2)) for (const x of this.alive().filter(x => x !== a)) await this.pzLower(x, o.n); return true; }
      case 'pzRecover': this.pzRecover(k, o.n); return true;
      case 'pzRecoverOrBane': { if (!k || !k.alive) return true; const v = (k.bane || 0) > 0 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Recover ${o.recover} 또는 Bane 토큰 최대 ${o.bane}개 버리기`, options: [{ label: `Recover ${o.recover}`, value: 'r' }, { label: `Bane ${Math.min(o.bane, k.bane)}개 버리기`, value: 'b' }] }) : 'r'; if (v === 'b') await this.pzDiscardBane(k, o.bane); else this.pzRecover(k, o.recover); return true; }
      case 'pzStandOther': { const down = this.alive().filter(x => x !== k && this.knockedDown(x)); if (!down.length) return true; const id = await this.ask({ type: 'pick', text: '다른 기사 1명이 즉시 일어남 (선택)', options: [...down.map(x => ({ label: x.name, value: x.id })), { label: '안 함', value: 'skip' }] }); const x = down.find(y => y.id === id); if (x) this.standUp(x); return true; }
      case 'pzArmorGear': { if (!t || !t.alive) return true; const arm = t.gear.filter(g => g.type === 'armor' && !g.discarded && (o.mode === 'discard' || !g.exhausted)); if (!arm.length) { this.say(`${t.name}: ${o.mode === 'discard' ? '버릴' : '소진할'} Armor Gear 없음`); return true; } const nm = arm.length === 1 ? arm[0].name : await this.ask({ type: 'pick', knight: t.id, text: `${t.name}: Armor Gear 1장 ${o.mode === 'discard' ? '버리기' : '소진'}`, options: arm.map(g => ({ label: g.name, value: g.name })) }); const g = arm.find(x => x.name === nm) || arm[0]; if (o.mode === 'discard') g.discarded = true; else g.exhausted = true; this.say(`${t.name}: ${g.name} ${o.mode === 'discard' ? '버림' : '소진'}`, 'dmg'); return true; }
      case 'pzToToken': { if (o.who === 'this') { if (live(src)) await this.pzToToken(src, o.n); } else if (o.who === 'allOthers') { for (const m of M.mobs.filter(m => m !== src && m.cells.length)) await this.pzToToken(m, 99); } else { const origin = k && k.pos; const pool = M.mobs.filter(m => m !== src && m.cells.length); if (pool.length && origin) { const d = m => man(m.cells[0], origin); const best = Math.min(...pool.map(d)); const m = await this.pickMob(pool.filter(x => d(x) === best), '가장 가까운 Panzergeist (동률)'); if (m) await this.pzToToken(m, o.n); } } return true; }
      case 'pzAway': { if (!live(src) || !k || !k.pos) return true; const from = src.cells[0]; const d = { c: Math.sign(from.c - k.pos.c), r: Math.sign(from.r - k.pos.r) }; let end = from; for (let i = 1; i <= o.n; i++) { const c = { c: from.c + d.c * i, r: from.r + d.r * i }; if (!B.inside(c)) break; if (!this.knightAt(c) && !this.mobAt(c)) end = c; } if (!cellEq(end, from)) { this.mobStepTo(src, end); await this.pzThrough(src, from); this.say(`Mob #${src.n}: 공격자 반대쪽으로 이동 → ${B.label(end)}`, 'ai'); } return true; }
      case 'pzKnockdownAdjacent': { const ks = this.alive().filter(x => o.to === 'this' ? (src && src.lastCell || live(src)) && B.adjacent(src.cells[0] || src.lastCell, x.pos) : M.mobs.some(m => m.cells.length && B.adjacent(m.cells[0], x.pos))); for (const x of ks) await this.knockdown(x); return true; }
      case 'pzRustKnockedDown': for (const x of this.alive().filter(x => this.knockedDown(x))) await this.pzRust(x); return true;
      case 'pzDiscardBoardTokens': { for (let i = 0; i < o.n; i++) { const ps = this.pzPiles(); if (!ps.length) break; const c = await this.ask({ type: 'pick', text: `보드의 Armor 토큰 버리기 (${i + 1}/${o.n}, 선택)`, options: [...ps.map(p => ({ label: `${B.label(p.cell)} (${p.n})`, value: B.key(p.cell) })), { label: '안 함', value: 'skip' }] }); if (!c || c === 'skip') break; const n = this.icdPiles().get(c); if (n <= 1) this.icdClear(c); else this.icdPiles().set(c, n - 1); this.say('Armor 토큰 1개 버림', 'tech'); } return true; }
      case 'pzIfDied': { const died = t && !t.alive; await this.fx.runMonsterOps(died ? o.then : o.else, ctx); return true; }
      case 'pzRepeat': { const others = this.alive(); const card = this.lastAI; if (!others.length || !card || !live(src)) return true; const d = x => man(x.pos, src.cells[0]); const best = Math.min(...others.map(d)); const x = others.find(y => d(y) === best); this.say(`${card.name}: 대상 사망 → ${x.name}에게 반복`, 'ai'); await this.resolveMonsterAttack(card, { forceTarget: x, repeated: true }); return true; }
      case 'pzAllTokensToThis': { if (!live(src)) return true; const n = this.pzBoardTokens(); for (const p of this.pzPiles()) this.icdClear(B.key(p.cell)); src.armor += n; this.say(`보드의 Armor 토큰 ${n}개 전부 → Mob #${src.n} (Armor ${src.armor})`, 'bp'); return true; }
      case 'pzRoutine': { const x = 5 + this.pzBoardTokens(); this.say(`Panzer Awakening: 모든 기사 Maximum Vigor -${x} (5 + 보드의 Armor 토큰 ${x - 5})`, 'ai'); for (const kk of this.alive()) await this.pzLower(kk, x); for (const m of [...M.mobs]) if (m.cells.length) await this.pzToToken(m, 99); return true; }
      default: return false;
    }
  },
};
export const PZ_OPS = ['pzRust', 'pzKnockdown', 'pzBanePerHit', 'pzLower', 'pzLowerPerWound', 'pzIngrid', 'pzRecover', 'pzRecoverOrBane', 'pzStandOther', 'pzArmorGear', 'pzToToken', 'pzAway', 'pzKnockdownAdjacent', 'pzRustKnockedDown', 'pzDiscardBoardTokens', 'pzIfDied', 'pzRepeat', 'pzAllTokensToThis', 'pzRoutine', 'ignoreReact'];
