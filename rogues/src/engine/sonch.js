// Kingdoms Forlorn — Rogue's Path: Ser Sonch (Knightbook "A Knight's Tale: Ser Sonch") — the Little Ser token, Monkey Business, Talents and Techniques.
// Little Ser is on a Knight Board, on the Monster Sheet or on a Clash Board space (it does not occupy the space). It starts on Ser Sonch's Knight Board.
const mops = k => (k && k.talent ? k.talent.abilities.flatMap(a => (a.ops || []).filter(o => o.op === 'monkey')) : []);

export const SonchMixin = {
  lsOwner() { return this.knights.find(k => k.def && k.def.id === 'ser-sonch') || null; },
  /** Current Little Ser state { where: 'knight'|'monster'|'board'|'gone', knight, cell } (null without Ser Sonch). */
  ls() { const o = this.lsOwner(); if (!o) return null; if (!this.littleSer) this.littleSer = { where: 'knight', knight: o, cell: null }; const s = this.littleSer; if (s.where === 'knight' && !s.knight.alive && s.knight !== o) { s.knight = o; this.say(`Little Ser → ${o.name}의 Knight Board (기사 사망)`, 'tech'); } return s; },
  lsOn(k) { const s = this.ls(); return !!(s && s.where === 'knight' && s.knight === k); },
  lsOnMonster() { const s = this.ls(); return !!(s && s.where === 'monster'); },
  lsCell() { const s = this.ls(); return s && s.where === 'board' ? s.cell : null; },
  lsNear(k) { const c = this.lsCell(); return !!(c && k.pos && (this.board.adjacent(c, k.pos) || (c.c === k.pos.c && c.r === k.pos.r))); },
  lsLabel() { const s = this.ls(); return !s ? '' : s.where === 'knight' ? `${s.knight.name}의 Knight Board` : s.where === 'monster' ? 'Monster Sheet' : s.where === 'board' ? `Clash Board ${this.board.label(s.cell)}` : '버려짐'; },
  lsCfg() { const o = this.lsOwner(); return o && o.alive ? mops(o)[0] || null : null; },
  lsSet(where, x) { const s = this.ls(); if (!s || s.where === 'gone') return; s.where = where; s.knight = where === 'knight' ? x : null; s.cell = where === 'board' ? x : null; this.say(`Little Ser → ${this.lsLabel()}`, 'tech'); },
  /** Boons granted by Little Ser's position (Talent of Ser Sonch). */
  lsBoon(k, key) { const cfg = this.lsCfg(); const s = this.ls(); if (!cfg || !s) return 0; if (s.where === 'knight') return s.knight === k ? cfg.knight[key] || 0 : 0; if (s.where === 'monster') return cfg.monster[key] || 0; if (s.where === 'board') return this.lsNear(k) ? cfg.board[key] || 0 : 0; return 0; },
  async lsPlace(k, kinds, text) {
    const s = this.ls(); if (!s || s.where === 'gone') return false; const opts = [];
    if (kinds.includes('knight')) for (const x of this.alive()) if (!this.lsOn(x)) opts.push({ label: `${x.name}의 Knight Board`, value: 'k:' + x.id });
    if (kinds.includes('monster') && !this.lsOnMonster()) opts.push({ label: 'Monster Sheet', value: 'monster' });
    if (kinds.includes('board')) opts.push({ label: 'Clash Board (칸 선택)', value: 'board' });
    if (kinds.includes('adjacent')) opts.push({ label: `${k.name}에 인접한 칸`, value: 'adjacent' });
    if (kinds.includes('near') && s.where === 'board') opts.push({ label: '현재 칸에서 3칸 이내', value: 'near' });
    opts.push({ label: '옮기지 않음', value: 'skip' });
    const v = await this.ask({ type: 'pick', knight: k.id, text: `${text} — Little Ser 놓을 곳 (현재: ${this.lsLabel()})`, options: opts }); if (!v || v === 'skip') return false;
    if (v === 'monster') { this.lsSet('monster'); return true; } if (v.startsWith('k:')) { this.lsSet('knight', this.knights.find(x => x.id === v.slice(2))); return true; }
    const B = this.board; let cells = []; for (let r = 0; r < B.rows; r++) for (let c = 1; c <= B.cols; c++) { const p = { c, r }; if (B.isObstacle(p)) continue; cells.push(p); }
    if (v === 'adjacent') cells = cells.filter(p => B.adjacent(p, k.pos)); else if (v === 'near') cells = cells.filter(p => Math.abs(p.c - s.cell.c) + Math.abs(p.r - s.cell.r) <= 3);
    if (!cells.length) return false; const cell = await this.ask({ type: 'move', knight: k.id, text: 'Little Ser 놓을 칸', cells, options: cells.map(p => ({ label: B.label(p), value: p })) }); if (!cell) return false; this.lsSet('board', cell); return true;
  },
  sonchFreeActions(k) { const out = []; const cfg = mops(k)[0]; const s = this.ls(); if (cfg && s && s.where !== 'gone' && k.def && k.def.id === 'ser-sonch' && k.heat + cfg.cost <= k.heatLimit) out.push({ id: 'ser:mb', label: `Monkey Business (Heat +${cfg.cost}) — Little Ser 옮기기 (현재: ${this.lsLabel()})` }); if (s && !this.monster.isMob && this.monster.bp && this.monster.bp.cards.length && ((k === this.lsOwner() && this.lsBoon(k, 'lookBP') && s.where === 'monster') || (s.where === 'board' && this.lsBoon(k, 'lookBP'))) && !(k.freeUsed && k.freeUsed.has('ser:bp'))) out.push({ id: 'ser:bp', label: 'Little Ser — BP 덱 맨 위 확인' }); return out; },
  async sonchFreeRun(k, id) {
    if (id === 'ser:mb') { const cfg = mops(k)[0]; if (await this.lsPlace(k, ['knight', 'monster', 'board'], 'Monkey Business')) { k.gainHeat(cfg.cost, { voluntary: true }); this.say(`${k.name}: Monkey Business (Heat +${cfg.cost} → ${k.heat})`, 'tech'); } }
    else if (id === 'ser:bp') { const top = this.monster.bp.cards[0]; k.freeUsed.add('ser:bp'); this.say(`${k.name}: BP 덱 맨 위 — ${top.name}${top.level ? ` (Level ${top.level})` : ''}`, 'tech'); this.flash('card', { title: 'BP 덱 맨 위', name: top.name, text: top.text || '', cls: 'good' }); }
  },
  async sonchBeforeAttack(k, A) {
    const ar = this.lsBoon(k, 'attackReroll'), pr = this.lsBoon(k, 'powerReroll'); if (ar) A.attackRerolls = (A.attackRerolls || 0) + ar; if (pr) A.powerRerolls = (A.powerRerolls || 0) + pr; if (ar || pr) this.say(`Little Ser (${this.lsLabel()}):${ar ? ` Attack Re-roll ${ar}` : ''}${pr ? ` Power Re-roll ${pr}` : ''}`, 'tech');
    if (k.pendingSonch) { A.sonch = k.pendingSonch; k.pendingSonch = null; }
  },
  async sonchSecondWindow(k, A) { const s = A.sonch; if (!s || s.guess == null) return; A.sonch = null; const right = !!A.wounded === s.guess; if (right) { this.poolAdd('power', s.n); this.say(`Veteran's Insight: 예측 적중 → Power ${s.n}`, 'tech'); } else { this.poolAdd('break', 1); this.say("Veteran's Insight: 예측 빗나감 → Break 1", 'tech'); } },
  async sonchInspire(n) { for (let i = 0; i < n; i++) { const kd = this.alive().filter(x => this.knockedDown(x)); if (!kd.length) break; const id = kd.length > 1 ? await this.ask({ type: 'pickKnight', text: 'Inspire — 일으킬 기사', options: kd.map(x => ({ label: x.name, value: x.id })) }) : kd[0].id; const x = kd.find(y => y.id === id) || kd[0]; this.standUp(x); this.say(`Inspire: ${x.name} 일어남`, 'tech'); } },
  /** About to draw an AI card: Knowing Is Half the Battle. */
  async sonchAIDraw() {
    const d = this.monster.ai; if (!d || !d.cards || d.cards.length < 2) return;
    for (const k of this.alive()) { const t = k.hand.find(x => x.timing === 'onAIPeek' && x.ops); const ops = t && await this.paraUse(k, t); if (!ops) continue; const [a, b] = d.cards; const v = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: AI 덱 위 2장 — 맨 위에 둘 카드`, options: [a, b].map((c, i) => ({ label: `${c.name}${c.text ? ' — ' + String(c.text).slice(0, 70) : ''}`, value: i })) }); const keep = v === 1 ? b : a, other = v === 1 ? a : b; d.cards.splice(0, 2); d.cards.unshift(keep); if (this.lsOnMonster()) { d.discard.push(other); this.say(`${other.name} 버림 (Little Ser가 Monster Sheet 위)`, 'tech'); } else { d.cards.push(other); this.say(`${other.name} → AI 덱 맨 아래`, 'tech'); } return; }
  },
  async sonchOp(o, k, ctx) {
    switch (o.op) {
      case 'inspire': await this.sonchInspire(o.n); return true;
      case 'tokenSplit': { const [a, b] = o.tokens; const na = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: 토큰 ${o.n}개 — ${a} 개수 (나머지는 ${b})`, options: Array.from({ length: o.n + 1 }, (_, i) => ({ label: `${a} ${o.n - i} / ${b} ${i}`, value: o.n - i })) }); const n = typeof na === 'number' ? na : o.n; if (n) this.poolAdd(a, n); if (o.n - n) this.poolAdd(b, o.n - n); this.say(`${k.name}: ${a} ${n} · ${b} ${o.n - n}`, 'tech'); return true; }
      case 'placeLS': await this.lsPlace(k, ['knight', 'monster', 'adjacent', 'near'], ctx.technique ? ctx.technique.name : 'Little Ser'); return true;
      case 'placeLSAny': await this.lsPlace(k, ['board'], ctx.technique ? ctx.technique.name : 'Little Ser'); return true;
      case 'lsHeat': { const c = this.lsCell(); if (!c) { this.say('Little Ser가 Clash Board에 없음 — 효과 없음'); return true; } for (const x of this.alive()) { if (!this.board.adjacent(c, x.pos)) continue; if (o.reset) { if (x.heat > 0 && await this.yesNo(`${x.name}: Heat 리셋 (현재 ${x.heat})?`, true)) { x.heat = 0; this.say(`${x.name}: Heat 리셋`, 'tech'); } } else { x.heat = Math.max(0, x.heat - o.n); this.say(`${x.name}: Heat -${o.n} → ${x.heat}`, 'tech'); } } return true; }
      case 'simianSquire': { const s = this.ls(); const who = [k]; if (s && s.where === 'knight' && s.knight !== k && s.knight.alive) who.push(s.knight); for (const x of who) { const ex = x.gear.filter(g => g.exhausted && !g.discarded); if (!ex.length) continue; if (x !== k && !await this.yesNo(`${x.name}: Simian Squire — Gear Unexhaust?`, true)) continue; if (o.all) { for (const g of ex) g.exhausted = false; this.say(`${x.name}: 모든 Gear Unexhaust`, 'tech'); } else { const i = ex.length > 1 ? await this.ask({ type: 'pick', knight: x.id, text: `${x.name}: Unexhaust할 Gear`, options: ex.map((g, i) => ({ label: g.name, value: i })) }) : 0; const g = ex[i] || ex[0]; g.exhausted = false; this.say(`${g.name} Unexhaust`, 'tech'); } } if (o.refresh && k.delay.length) { k.hand.push(...k.delay); k.delay = []; this.say(`${k.name}: Delay의 카드 모두 Refresh`, 'tech'); } return true; }
      case 'rouseIfLS': { const s = this.ls(); if (s && s.where === 'knight' && s.knight !== k) { this.poolAdd('rouse', 1); this.say(`Little Ser가 ${s.knight.name}의 Board → Rouse 토큰`, 'tech'); } return true; }
      case 'leaderMotivate': { const al = this.alive().filter(x => x !== k && !this.knockedDown(x) && !x.engulfed); if (!al.length) return true; const id = await this.ask({ type: 'pickKnight', text: "Leader's Instinct — Motivate할 기사", options: [...al.map(x => ({ label: `${x.name}${this.lsOn(x) ? ' (Little Ser)' : ''}`, value: x.id })), { label: '그만', value: 'skip' }] }); const x = al.find(y => y.id === id); if (x) await this.knightMove(x, this.lsOn(x) ? o.ls : o.n); return true; }
      case 'chaosMonkey': { let mode = 'six'; if (this.lsOnMonster()) mode = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Chaos Monkey`, options: [{ label: 'Opening/Break 6개', value: 'six' }, { label: 'Opening/Break 4개 + Black 2개', value: 'four' }] }) || 'six'; await this.sonchOp({ op: 'tokenSplit', n: mode === 'six' ? 6 : 4, tokens: ['opening', 'break'] }, k, ctx); if (mode === 'four') this.poolAdd('black', 2); return true; }
      case 'tagTeam': { const c = this.lsCell(); if (!c) { this.say('Little Ser가 Clash Board에 없음 — Tag Team 불가', 'warn'); return true; } const cand = this.alive().filter(x => Math.abs(x.pos.c - c.c) + Math.abs(x.pos.r - c.r) <= o.n && !this.knightAt(c) && !this.monsterOccupies(c) && !x.engulfed); if (!cand.length) { this.say('범위 안에 바꿀 기사 없음'); return true; } const id = await this.ask({ type: 'pickKnight', text: `Tag Team — Little Ser(${this.board.label(c)})와 자리를 바꿀 기사`, options: [...cand.map(x => ({ label: x.name, value: x.id })), { label: '취소', value: 'skip' }] }); const x = cand.find(y => y.id === id); if (!x) return true; const old = { ...x.pos }; this.moveKnight(x, c); this.say(`${x.name} ↔ Little Ser: ${x.name} → ${this.board.label(c)}`, 'tech'); this.lsSet('board', old); return true; }
      case 'precisionNow': k.pendingExtraPrecision = (k.pendingExtraPrecision || 0) + o.n; this.say(`${k.name}: 이 공격 +${o.n} Precision`, 'tech'); return true;
      case 'vetInsight': { const g = await this.ask({ type: 'pick', knight: k.id, text: `${k.name}: Veteran's Insight — 이 공격으로 Wound를 줄까?`, options: [{ label: 'Wound를 준다', value: 'y' }, { label: '주지 못한다', value: 'n' }] }); k.pendingSonch = { guess: g !== 'n', n: o.n }; return true; }
      case 'carrot': this.poolAdd(o.token, 1); this.say(`${k.name}: ${o.token} 토큰`, 'tech'); if (this.lsOnMonster()) { k.pendingAttackFlags = k.pendingAttackFlags || new Set(); k.pendingAttackFlags.add('heartseeker'); this.say('Little Ser가 Monster Sheet 위 → Heartseeker', 'tech'); } return true;
      case 'timeToShine': this.priorityTarget = k; this.turnToward(k.pos); this.say(`Provoke: ${k.name}이 Priority Target, 몬스터가 바라봄`, 'tech'); if (this.lsOn(k)) { k.pendingPara = k.pendingPara || {}; k.pendingPara.spotlight = true; } return true;
      case 'rocksteadyIfLS': if (this.lsOnMonster()) { k.steady = true; this.say(`${k.name}: Rocksteady (다음 턴까지)`, 'tech'); } return true;
      case 'aiPeek': return true;
    }
    return false;
  },
};
export const SONCH_OPS = new Set(['inspire', 'tokenSplit', 'placeLS', 'placeLSAny', 'lsHeat', 'simianSquire', 'rouseIfLS', 'leaderMotivate', 'chaosMonkey', 'tagTeam', 'precisionNow', 'vetInsight', 'carrot', 'timeToShine', 'rocksteadyIfLS', 'aiPeek']);
export const SONCH_PRE = new Set(['precisionNow', 'vetInsight', 'carrot', 'timeToShine', 'rouseIfLS']);
export function installSonch(Clash) {
  const ai = Clash.prototype.activationAI; Clash.prototype.activationAI = async function (...a) { await this.sonchAIDraw(); return ai.apply(this, a); };
}
