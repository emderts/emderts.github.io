// Kingdoms Forlorn — Rogue's Path: Ser Ubar (Knightbook "A Knight's Tale: Ser Ubar") — Human / Ape forms, Shapeshift, Talents and Techniques.
const tops = (k, op) => (k && k.talent ? k.talent.abilities.flatMap(a => (a.ops || []).filter(o => o.op === op)) : []);
const techAt = (k, timing) => k.hand.find(t => t.timing === timing && t.ops);
const isUbar = k => !!(k && k.def && k.def.id === 'ser-ubar');

export const UbarMixin = {
  isUbar,
  ubarSetup(k) {
    if (!isUbar(k)) return; k.form = k.form || 'human'; k.generic = 0; k._heatQ = [];
    let h = k.heat; const desc = Object.getOwnPropertyDescriptor(k, 'heat'); if (!desc || !desc.get) Object.defineProperty(k, 'heat', { enumerable: true, configurable: true, get: () => h, set(v) { const b = h; h = v; if (v !== b && !k._draining) k._heatQ.push(v); } });
  },
  /** Which side of the Monster a Knight stands on (quadrant by the larger axis). */
  ubarSide(k) { const m = this.monsterCenter(); const dc = k.pos.c - m.c, dr = k.pos.r - m.r; return Math.abs(dc) >= Math.abs(dr) ? (dc >= 0 ? 'E' : 'W') : (dr >= 0 ? 'N' : 'S'); },
  ubarOtherSide(k) { const w = this._lastWounder; return !!(w && w !== k && w.alive && this.ubarSide(w) !== this.ubarSide(k)); },
  /** Shapeshift: swap the current form; "When you Shapeshift, you may move 1 space" (swap places for Simian Strategist). */
  async shapeshift(k, why = '') {
    k.form = k.form === 'ape' ? 'human' : 'ape'; this.say(`${k.name}: Shapeshift → ${k.form === 'ape' ? 'Ape' : 'Human'}${why ? ` (${why})` : ''}`, 'tech');
    const o = tops(k, 'shiftMove')[0]; if (!o || !k.alive || this.knockedDown(k) || k.engulfed) return;
    const adj = o.swap ? this.alive().filter(x => x !== k && this.board.adjacent(x.pos, k.pos) && !x.engulfed) : [];
    const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Shapeshift — 이동?`, options: [{ label: `${o.n}칸 이동`, value: 'move' }, ...adj.map(x => ({ label: `${x.name}와 자리 교환`, value: 'swap:' + x.id })), { label: '이동 안 함', value: 'skip' }] });
    if (v === 'move') await this.knightMove(k, o.n); else if (v && String(v).startsWith('swap:')) { const x = adj.find(y => y.id === v.slice(5)); if (x) { const a = { ...k.pos }, b = { ...x.pos }; this.board.remove([a]); this.board.remove([b]); k.pos = b; x.pos = a; this.board.place({ kind: 'knight', id: k.id }, [b]); this.board.place({ kind: 'knight', id: x.id }, [a]); this.say(`${k.name} ↔ ${x.name} 자리 교환`, 'tech'); } }
  },
  /** Resolve queued Heat changes: Master of the Battlefield (exact 3 / 5 / 8), Heart's Thunder. */
  async ubarDrain(k) {
    if (!isUbar(k) || !k._heatQ || !k._heatQ.length || k._draining || !k.alive) return; const q = k._heatQ.splice(0); k._draining = true;
    try {
      for (const v of q) {
        for (const o of tops(k, 'heatShift')) { const e = o.at[String(v)]; if (!e) continue; await this.shapeshift(k, `Heat ${v}`); if (e.self && !this.knockedDown(k) && await this.yesNo(`${k.name}: Master of the Battlefield — 최대 ${e.self}칸 이동?`, false)) await this.knightMove(k, e.self); if (e.other) { const al = this.alive().filter(x => x !== k && !this.knockedDown(x) && !x.engulfed); const id = al.length ? await this.ask({ type: 'pickKnight', text: `Master of the Battlefield — 최대 ${e.other}칸 이동할 다른 기사`, options: [...al.map(x => ({ label: x.name, value: x.id })), { label: '없음', value: 'skip' }] }) : null; const x = al.find(y => y.id === id); if (x) await this.knightMove(x, e.other); } }
        if (tops(k, 'heartsThunder').length && k.generic > 0 && v === Math.max(1, k.generic)) { await this.shapeshift(k, `Heart's Thunder — Heat ${v} = Generic ${k.generic}`); k.heat = 0; k.generic = 0; this.say(`${k.name}: Heat 리셋, Generic 토큰 모두 버림`, 'tech'); }
      }
    } finally { k._draining = false; k._heatQ.length = 0; }
  },
  async ubarTurnStart(k) {
    if (!isUbar(k)) return;
    if (!k._formAsked) { k._formAsked = true; const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 이 Clash를 시작하는 형태`, options: [{ label: 'Human', value: 'human' }, { label: 'Ape', value: 'ape' }] }); k.form = v === 'ape' ? 'ape' : 'human'; this.say(`${k.name}: ${k.form === 'ape' ? 'Ape' : 'Human'} 형태로 시작`, 'tech'); }
    k._bypassMove = false;
    if (tops(k, 'shiftersGrace').length) { const d = this.rng.die(10); const r = d + (k.bane || 0); this.say(`${k.name} Shifter's Grace: d10 ${d}${k.bane ? ` + Bane ${k.bane}` : ''} = ${r} vs Heat ${k.heat}`, 'dice'); if (r <= k.heat) await this.shapeshift(k, "Shifter's Grace"); }
    for (const o of tops(k, 'beastMode')) if (k.heat + o.cost <= k.heatLimit && await this.yesNo(`${k.name}: Beast Mode — Heat +${o.cost}로 Shapeshift? (현재 ${k.form === 'ape' ? 'Ape' : 'Human'})`, false)) { k.gainHeat(o.cost, { voluntary: true }); await this.shapeshift(k, 'Beast Mode'); }
    if (tops(k, 'heartsThunder').length && await this.yesNo(`${k.name}: Heart's Thunder — Generic 토큰 1개 놓기? (현재 ${k.generic}, Heat가 그 수와 같아지면 Shapeshift + Heat 리셋)`, false)) { k.generic++; this.say(`${k.name}: Generic 토큰 ${k.generic}`, 'tech'); }
    await this.ubarDrain(k);
  },
  /** Constantly Evolving: about to use a Technique with a Gated Effect of the other shape. */
  async ubarPreTechnique(k, t) { if (!isUbar(k) || !t || !t.formOps || !tops(k, 'constantlyEvolving').length) return; const other = k.form === 'ape' ? 'HUMAN' : 'APE'; if (t.formOps[other] && await this.yesNo(`${k.name}: Constantly Evolving — ${t.name}의 ${other} 효과를 위해 Shapeshift?`, false)) await this.shapeshift(k, 'Constantly Evolving'); },
  async ubarBeforeAttack(k, A) {
    for (const x of this.alive()) { if (x === k) continue; const o = tops(x, 'partOfTribe')[0]; if (!o || this.knockedDown(x) || x.engulfed || this.ubarSide(x) === this.ubarSide(k)) continue; const n = await this.ask({ type: 'pick', knight: x.id, text: `${x.name}: Part of the Tribe — Generic 토큰 X개를 놓고 최대 X칸 이동 (${k.name}의 공격)`, options: [{ label: '사용 안 함', value: 0 }, ...Array.from({ length: o.max }, (_, i) => ({ label: `X = ${i + 1}`, value: i + 1 }))] }); if (n > 0) { x.generic = (x.generic || 0) + n; this.say(`${x.name}: Generic 토큰 +${n} (${x.generic})`, 'tech'); await this.knightMove(x, n); } }
    if (!isUbar(k)) return;
    if (tops(k, 'troopTactics').length && this.ubarOtherSide(k)) { this.poolAdd('break', 1); this.say(`${k.name}: Troop Tactics — Auto-break 1`, 'tech'); }
    if (tops(k, 'knightsTogether').length && this.ubarOtherSide(k) && await this.yesNo(`${k.name}: Knights Together Strong — +2 Precision · Auto-hope 1?`, true)) { A.extraPrecision = (A.extraPrecision || 0) + 2; this.poolAdd('hope', 1); this.say(`${k.name}: Knights Together Strong`, 'tech'); }
    if (tops(k, 'bestOfBoth').length) { const adj = this.fx.targetCells(A).some(c => this.board.adjacent(c, k.pos)); if (k.form === 'human' && !adj) { this.poolAdd('diversion', 1); this.say(`${k.name}: Best of Both Worlds (Human, 비인접) — Diversion`, 'tech'); } else if (k.form === 'ape' && adj && !this.monster.isMob) this.ubarSuppress('bp', `${k.name}: Best of Both Worlds (Ape, 인접)`); }
    if (k.pendingUbar) { A.ubar = k.pendingUbar; k.pendingUbar = null; }
  },
  ubarSuppress(which, why) { const d = this.monster[which]; if (d && d.cards) { d.cards.push(...d.discard); d.discard = []; d.shuffle(); this.say(`${why} — ${which.toUpperCase()} Suppress`, 'tech'); } },
  /** Skull Crack: one missed non-Crit die becomes an automatic hit. */
  ubarAfterAttackRoll(k, A, roll, isHit) { const u = A.ubar; if (!u || !u.autoHit) return; const d = roll.dice.find((x, i) => i > 0 && !isHit(x)) || roll.dice.find(x => !isHit(x)); if (d) { d.v = 10; d.rerolled = true; this.say('Skull Crack: 빗나간 주사위 1개 → 자동 명중', 'tech'); } u.autoHit = 0; },
  ubarWound(k) { this._lastWounder = k; },
  async ubarSecondWindow(k, A) { const u = A.ubar; if (u && u.overRouse && A.wounded && (A.overAT || 0) >= u.overRouse.need) { this.poolAdd('rouse', u.overRouse.n); this.say(`Overpower ${u.overRouse.need}+: Rouse ${u.overRouse.n}`, 'tech'); } },
  /** After a Monster moved outside the Knight's turn: move up to 2 spaces toward it when it left weapon range. */
  async ubarMonsterMoved(cells) { if (this._inChase || this.phase === 'knight') return; for (const k of this.alive()) { const o = tops(k, 'chaseMonster').find(x => !x.form || x.form === k.form); if (!o || k._chaseSeq === this._moveSeq || this.knockedDown(k) || k.engulfed || this.canAttack(k)) continue; k._chaseSeq = this._moveSeq; if (!await this.yesNo(`${k.name}: 몬스터가 무기 사거리를 벗어남 — 최대 ${o.n}칸 다가가기?`, false)) continue; this._inChase = true; try { await this.fx.motivateKnight(k, o.n, cells[0]); } finally { this._inChase = false; } } },
  /** About to draw an AI card: Inner Turmoil. */
  async ubarAIDraw() { for (const k of this.alive()) { const t = techAt(k, 'onAIForm'); if (!t || !isUbar(k) || this.knockedDown(k)) continue; if (k.form === 'ape' && !this.canAttack(k)) continue; const ops = await this.paraUse(k, t, k.form === 'ape' ? 'Ape: Bonus Attack (Attack Responses 무시)' : 'Human: Move action'); if (!ops) continue; if (k.form === 'ape') { k.pendingAttackFlags = k.pendingAttackFlags || new Set(); k.pendingAttackFlags.add('ignoreResponses'); await this.knightAttack(k, { bonus: true }); } else await this.knightMove(k, this.fx.speed(k)); if (this.result) return; } },
  async ubarOp(o, k, ctx) {
    const U = () => (k.pendingUbar = k.pendingUbar || {}); const flags = () => (k.pendingAttackFlags = k.pendingAttackFlags || new Set()); const pool = () => (k.pendingExtraPool = k.pendingExtraPool || { red: 0, black: 0, white: 0, raw: 0 });
    switch (o.op) {
      case 'bypassMove': k._bypassMove = true; this.say(`${k.name}: 이번 턴 다른 기사를 지나 이동 가능`, 'tech'); return true;
      case 'coldOpen': if (!this.pool.some(t => !t.resource)) { this.poolAdd('opening', 1); this.poolAdd('break', 1); this.say(`${k.name}: Cold Open — Opening + Break`, 'tech'); } else this.say(`${k.name}: Knight Pool이 비어 있지 않음 — 토큰 없음`); return true;
      case 'monkeySee': { const M = this.monster; if (o.deck === 'bp' && M.isMob) { const m = (M.mobs || []).find(x => !x.revealed); if (m) { this.say(`Monkey See: 공개 안 된 BP — ${m.card.name}`, 'tech'); this.flash('card', { title: '공개 안 된 BP', name: m.card.name, text: m.card.text || '', cls: 'good' }); } return true; } const d = M[o.deck]; const top = d && d.cards && d.cards[0]; if (!top) return true; this.say(`Monkey See: ${o.deck.toUpperCase()} 덱 맨 위 — ${top.name}`, 'tech'); this.flash('card', { title: `${o.deck.toUpperCase()} 덱 맨 위`, name: top.name, text: top.text || '', cls: o.deck === 'ai' ? 'bad' : 'good' }); if (await this.yesNo(`${k.name}: ${top.name}을(를) 덱 맨 아래로?`, false)) { d.cards.push(d.cards.shift()); this.say(`${top.name} → 덱 맨 아래`, 'tech'); } return true; }
      case 'exploitFlaw': { let v = 'deadly'; if (o.precise) v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Exploit Flaw`, options: [{ label: 'Deadly', value: 'deadly' }, { label: 'Precise', value: 'precise' }] }) || 'deadly'; flags().add(v); this.say(`${k.name}: ${v === 'deadly' ? 'Deadly' : 'Precise'}`, 'tech'); return true; }
      case 'jump': k._jump = o.n || 1; this.say(`${k.name}: ${k._jump > 1 ? 'Advanced Jump' : 'Jump'} — 다음 이동에서 Terrain 칸 ${k._jump}개(Obstacle 포함) 무시`, 'tech'); return true;
      case 'fieryEyes': { const f = (k.pendingAttackFlags = k.pendingAttackFlags || new Set()); if (!this.monster.isMob && await this.yesNo(`${k.name}: Fiery Eyes, Golden Pupils — 이 카드를 버리고 Heartseeker 대신 Soulseeker?`, false)) { f.add('soulseeker'); if (ctx.technique) ctx.technique._depletion = 'discard'; this.say(`${k.name}: Soulseeker`, 'tech'); } else f.add('heartseeker'); return true; }
      case 'overRouse': U().overRouse = { need: o.need, n: o.n }; return true;
      case 'heartRelentless': { if (k.form === 'ape' && await this.yesNo(`${k.name}: The Heart Relentless (Ape) — 대신 Vigor +3?`, false)) { k.gainVigor(3); this.say(`${k.name}: Vigor +3 (${k.vigor})`, 'tech'); return true; } const body = k.conditions.filter(c => this.conditionDefs[c.id] && this.conditionDefs[c.id].type === 'body' && (o.discard || this.conditionDefs[c.id].flipSide)); if (!body.length) { this.say(`${k.name}: 대상 Body Condition 없음`); return true; } const i = body.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `Body Condition ${o.discard ? '버리기' : '뒤집기'}`, options: body.map((c, i) => ({ label: c.id, value: i })) }) : 0; const c = body[i] || body[0]; if (o.discard) this.removeCondition(k, c.id); else { c.id = this.conditionDefs[c.id].flipSide; this.say(`${k.name}: Condition 뒤집음 → ${c.id}`, 'tech'); } return true; }
      case 'warcry': { const opts = [{ label: `Inspire ${o.inspire}`, value: 'i' }]; if (k.form !== 'ape') opts.push({ label: `Motivate ${o.motivate}`, value: 'm' }); const v = opts.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Warcry`, options: opts }) : 'i'; if (v === 'm') await this.karaMotivate(k, o.motivate); else await this.sonchInspire(o.inspire); return true; }
      case 'bpSuppressNow': if (!this.monster.isMob && await this.yesNo(`${k.name}: BP Suppress 수행?`, true)) this.ubarSuppress('bp', k.name); return true;
      case 'unexhaustUpTo': { for (let n = 0; n < o.n; n++) { const ex = k.gear.filter(g => g.exhausted && !g.discarded); if (!ex.length) break; const i = ex.length > 1 ? await this.ask({ type: 'pick', knight: k.id, text: `Unexhaust할 Gear (${n + 1}/${o.n})`, options: ex.map((g, i) => ({ label: g.name, value: i })) }) : 0; const g = ex[i] || ex[0]; g.exhausted = false; this.say(`${g.name} Unexhaust`, 'tech'); } return true; }
      case 'canopySwing': { const B = this.board; const cells = []; for (let r = 0; r < B.rows; r++) for (let c = 1; c <= B.cols; c++) { const p = { c, r }; const d = Math.abs(c - k.pos.c) + Math.abs(r - k.pos.r); if (d < 1 || d > o.n || B.isObstacle(p) || this.knightAt(p) || this.monsterOccupies(p)) continue; const t = B.terrainAt(p); if (t && t.id === 'swamp') continue; cells.push(p); } if (!cells.length) return true; const to = await this.ask({ type: 'move', knight: k.id, text: `${k.name}: Canopy Swing — 최대 ${o.n}칸 떨어진 빈 칸`, cells, options: cells.map(p => ({ label: B.label(p), value: p })) }); if (to) { this.moveKnight(k, to); k.movedThisTurn = true; this.say(`${k.name} Canopy Swing → ${B.label(to)}`, 'tech'); } return true; }
      case 'mindOverBody': { if (this.knockedDown(k) && await this.yesNo(`${k.name}: 일어서기?`, true)) this.standUp(k); const cs = k.conditions.filter(c => this.conditionDefs[c.id] && this.conditionDefs[c.id].type === o.type); if (cs.length) { const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 버릴 ${o.type === 'mind' ? 'Mind' : 'Body'} Condition`, options: [...cs.map((c, i) => ({ label: c.id, value: i })), { label: '버리지 않음', value: 'skip' }] }); if (v != null && v !== 'skip' && cs[v]) this.removeCondition(k, cs[v].id); } return true; }
      case 'fistFirstmen': this.poolAdd('hope', 1); pool().raw += o.ape ? 2 : 1; flags(); this.say(`${k.name}: Auto-hope 1 · +${o.ape ? 2 : 1} Power`, 'tech'); if (o.ape && this.adjacentToMonster(k) && !this.monster.isMob) { const f = this.monster.facing; this.monster.facing = { N: 'S', S: 'N', E: 'W', W: 'E' }[f]; this.say('Daze: 몬스터가 등을 돌림', 'tech'); } return true;
      case 'skullCrack': U().autoHit = 1; return true;
      case 'feralAggression': pool().raw += 2; flags(); if (o.token) this.poolAdd('power', o.token); this.say(`${k.name}: +2 Power${o.token ? ` · Power 토큰 ${o.token}` : ''}`, 'tech'); return true;
      case 'gainMoveAction': k.actions.move = true; this.say(`${k.name}: Move action 획득`, 'tech'); return true;
      case 'techDodge': case 'techGuard': case 'techReinforce': case 'techArmorReroll': case 'innerTurmoil': return true;
    }
    return false;
  },
};
export const UBAR_OPS = new Set(['bypassMove', 'coldOpen', 'monkeySee', 'exploitFlaw', 'jump', 'overRouse', 'heartRelentless', 'warcry', 'bpSuppressNow', 'unexhaustUpTo', 'canopySwing', 'mindOverBody', 'fistFirstmen', 'skullCrack', 'feralAggression', 'gainMoveAction', 'techDodge', 'techGuard', 'techReinforce', 'techArmorReroll', 'fieryEyes', 'innerTurmoil']);
export const UBAR_PRE = new Set(['fieryEyes', 'exploitFlaw', 'overRouse', 'bpSuppressNow', 'fistFirstmen', 'skullCrack', 'feralAggression']);
export function installUbar(Clash) {
  const ai = Clash.prototype.activationAI; Clash.prototype.activationAI = async function (...a) { await this.ubarAIDraw(); if (this.result) return; return ai.apply(this, a); };
}
