// Cycle V gear keywords (Storybook p.10-14): Liquid Edge, Non-euclidean, Unwieldy, Tilt, Stuck, Dare, Deny, Abysswalk, Acrobatics,
// Terrain Vault, Rescan / Remote Scan, Microwave / Pain / Despair Resilience, Ignore Burn, Ignore Skitter, Commit (Pain).
import { Board, key, DIRS, DIR_LIST, cellLabel, kw } from './core.js';

export function installC5Gear(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const COST = '((?:Ψ|⟳|X|ⓐ|ⓟ|ⓓ|ⓞ|\\[Amb\\]|\\[charge\\])*)';
  const yn = (g, t, title) => g.ask({ type: 'yn', titan: t, title, options: [{ label: '사용', value: true }, { label: '패스', value: false }] });
  const cheb = (p, cells) => Math.min(...cells.map(q => Math.max(Math.abs(q.c - p.c), Math.abs(q.r - p.r))));
  Object.assign(P, {
    gearKWSum(t, name) { let n = 0; for (const g of t.gear || []) { if (g.discarded || g.blank) continue; const v = kw(this.gearText(g, t), name); if (typeof v === 'number') n += v; } return n; },
    // find a gear ability "<cost> Name." the titan can pay; returns {g, cost} list
    c5Abil(t, re, gears = null) { const out = []; for (const g of gears || t.gear || []) { if (!g || g.discarded || g.blank) continue; const txt = this.gearText(g, t); const m = new RegExp(`(?:^|[.:!]\\s+)${COST} ?${re}`).exec(txt); if (!m) continue; const cost = m[1] || ''; if (cost && !this.costOK(t, cost, g)) continue; out.push({ g, cost }); } return out; },
    async c5Use(t, a, label) { if (!a) return false; const ok = await yn(this, t, `${a.g.card.name}: ${label}${a.cost ? ` [${this.costLbl(a.cost)}]` : ''}?`); if (!ok) return false; if (a.cost) await this.payCost(t, a.cost, a.g); return true; },
    async c5Tilt(t, g, A, drawBP) {
      const L = this.c5Abil(t, 'Tilt\\.'); if (!L.length || !A.bp) return A.bp;
      for (const a of L) { if (await this.c5Use(t, a, 'Tilt — 뽑은 BP 카드를 버리고 다음 카드')) { this.bp.discard.push(A.bp); this.say(`Tilt: BP 「${A.bp.name}」 버림 — 다음 카드`, 'good'); return drawBP(); } }
      return A.bp;
    },
    async c5Deny(why) {
      if (this.prim.offBoard) return false;
      for (const t of this.liveTitans()) {
        if (t.offBoard || t.knockdown) continue;
        const L = this.c5Abil(t, 'Deny\\.', t.gear.filter(g => /^hand/.test(g.card.slot || '') && this.inWeaponRange(t, g)));
        for (const a of L) {
          if (!(await this.c5Use(t, a, `Deny — ${why}를 무시하고 공격 (그 뒤 Fatigue 토큰 + Obol)`))) continue;
          this.say(`${t.name}: Deny! ${why} 무시`, 'good');
          await this.safe(() => this.bonusAttackFlow(t)); if (t.alive) { this.say(`${t.name}: Deny — Combat Fatigue 토큰 (수동) · Obol`, 'bad'); await this.solo(() => this.obolDraw(t, 10)); }
          return true;
        }
      }
      return false;
    },
    async c5TerrainVault(t, a) {
      const cands = []; for (const d of DIR_LIST) { const q = { c: t.pos.c + DIRS[d][0], r: t.pos.r + DIRS[d][1] }; const z = this.board.terrainAt(q.c, q.r); if (!z) continue; let p = { ...q }; let n = 0; while (this.board.terrainAt(p.c, p.r) && this.board.terrainAt(p.c, p.r).id === z.id && n++ < 20) p = { c: p.c + DIRS[d][0], r: p.r + DIRS[d][1] }; if (this.board.inBounds(p.c, p.r) && this.freeCell(p) && !this.board.isChasm(p.c, p.r)) cands.push({ p, z, d }); }
      if (!cands.length) { this.say('(Terrain Vault: 넘을 수 있는 지형 없음)'); return; }
      const c = cands.length === 1 ? cands[0] : await this.ask({ type: 'choice', titan: t, title: 'Terrain Vault: 넘을 지형', options: cands.map(x => ({ label: `${x.z.type} (${x.d}) → ${cellLabel(x.p)}`, value: x })) }) || cands[0];
      if (a.cost) await this.payCost(t, a.cost, a.g); t.pos = { ...c.p }; this.say(`${t.name}: Terrain Vault — ${c.z.type} 너머 ${cellLabel(c.p)}`, 'good'); this.notify();
    },
  });
  // ---------- Start of Battle (Cycle V gear) ----------
  wrap('startOfBattle', async function (o, ...a) {
    const r = await o.call(this, ...a);
    for (const t of this.liveTitans()) for (const g of t.gear) {
      if (g.discarded || (g.card.cycle || 0) !== 5) continue; const tx = this.gearText(g, t);
      if (/Start of Battle: Gain 1 Oxygen token\./.test(tx)) { t.oxygen = (t.oxygen || 0) + 1; this.say(`${g.card.name}: 전투 시작 — Oxygen +1 (${t.oxygen})`); }
      if (/Start of Battle: Gain 1 Aether token\./.test(tx)) { t.aether = (t.aether || 0) + 1; this.say(`${g.card.name}: 전투 시작 — Aether +1 (${t.aether})`); }
      { const m = /Start of Battle: Gain the (Fear|Terror|Holy Terror|Bravery) Condition card\./.exec(tx); if (m) { this.say(`${g.card.name}: 전투 시작 — ${m[1]}`); await this.solo(() => this.addCondition(t, m[1])); } }
      if (/Start of Battle: You may gain 1 Despair token\./.test(tx) && await yn(this, t, `${g.card.name}: 전투 시작 — Despair 1개 받기?`)) await this.solo(() => this.gainDespair(t, 1));
      if (/(?:^|\.\s)Start of Battle: Move up to 5 spaces and Hide\./.test(tx) && t.pos && !t.onVP) { await this.chooseMove(t, 5, `${g.card.name}: 전투 시작 이동`); if (t.alive) this.becomeHidden(t); this.say(`${t.name}: ${g.card.name} — Hide`); }
      if (!t.alive) break;
    }
    return r;
  });
  // ---------- range keywords ----------
  wrap('inWeaponRange', function (o, t, g) {
    const base = o.call(this, t, g); if (!t || !t.pos || t.onVP || t.offBoard || this.prim.offBoard) return base;
    const txt = (g.godform || g.blank ? g.card.text : this.gearText(g, t)) || ''; if (!/Liquid Edge|Non-euclidean|Unwieldy/.test(txt)) return base;
    const cells = this.primCells(); const ch = cheb(t.pos, cells); const diag = ch === 1 && this.distTo(t) === 2;
    if (/Non-euclidean/.test(txt)) return diag;
    let r = base || (/Liquid Edge/.test(txt) && diag);
    if (r && /(?:^|\.\s)Unwieldy\./.test(txt) && !cells.some(q => q.c === t.pos.c || q.r === t.pos.r)) r = false;
    return r;
  });
  // ---------- Stuck / Abysswalk (after an attack) ----------
  wrap('c4AttackStart', async function (o, t, g, A, ...r) { t._c5w = g; t._c5A = A; t._c5adj0 = this.isAdj(t); return o.call(this, t, g, A, ...r); });
  wrap('titanAttack', async function (o, t, ...r) {
    const res = await o.call(this, t, ...r);
    const g = t && t._c5w; if (t) t._c5w = null;
    if (g && t.alive) {
      const txt = this.gearText(g, t) || '';
      { const A = t._c5A; t._c5A = null; if (A && A.hits > 0 && /(?:^|\.\s)Harpooned\./.test(txt) && this.prim.vp && !t.onVP && this.isAdj(t) && this.climbVP) { this.say(`${t.name}: Harpooned — VP로 이동`, 'good'); await this.safe(() => this.climbVP(t, true)); } }
      if (/(?:^|\.\s)Stuck\./.test(txt) && !/Loses Stuck/.test(txt) && t.turn) { t.turn.moved = true; t._stuck = this.round; this.say(`${t.name}: Stuck — 이번 턴 자발적 이동 불가`); }
      if (t._c5adj0 && !this.prim.offBoard && !t.onVP && t.pos && !this.isAdj(t) && t.gear.some(x => !x.discarded && /(?:^|\.\s)Abysswalk\./.test(this.gearText(x, t)))) {
        const adj = []; for (const p of this.primCells()) for (const d of DIR_LIST) { const q = { c: p.c + DIRS[d][0], r: p.r + DIRS[d][1] }; if (this.board.inBounds(q.c, q.r) && this.freeCell(q) && !this.primContains(q) && !this.board.isChasm(q.c, q.r) && !this.board.isObstacle(q.c, q.r)) adj.push(q); }
        if (adj.length) { const q = adj.reduce((x, y) => Board.dist(y, t.pos) < Board.dist(x, t.pos) ? y : x); t.pos = q; this.say(`${t.name}: Abysswalk — Primordial에게 다시 인접 (${cellLabel(q)})`, 'good'); this.notify(); }
      }
    }
    return res;
  });
  wrap('chooseMove', async function (o, t, max, label = '이동', ...r) { if (t && t._stuck === this.round && ['이동', 'Rush', 'Run'].includes(label)) { this.say(`${t.name}: Stuck — 자발적 이동 불가`); return null; } return o.call(this, t, max, label, ...r); });
  // ---------- Toying / Pale Grin / Husk (gear passives) ----------
  wrap('trait', function (o, n) { if (n === 'Toying' && this.titans && this.liveTitans().some(t => t.gear.some(x => !x.discarded && /(?:^|\.\s)Disable the Toying Trait\./.test(this.gearText(x, t))))) return false; return o.call(this, n); });
  if (P.dpFromBehind) wrap('dpFromBehind', function (o, t) { const r = o.call(this, t); if (!r || !t || !t.gear) return r; if (t.gear.some(x => !x.discarded && /Ignore the Pale Grin of (?:Death and Pale Grin of )?Doom Traits?\./.test(this.gearText(x, t))) && !this.trait('Pale Grin of Death')) { this.say(`${t.name}: Pale Grin of Doom 무시 (장비)`); return false; } if (t.gear.some(x => !x.discarded && /Ignore the Pale Grin of Death and Pale Grin of Doom Traits\./.test(this.gearText(x, t)))) { this.say(`${t.name}: Pale Grin 무시 (장비)`); return false; } return r; });
  wrap('checkDespair', async function (o, t, ...r) { if (t && t.gear && t.gear.some(x => !x.discarded && /You cannot die from Despair\./.test(this.gearText(x, t)))) return; return o.call(this, t, ...r); });
  // ---------- defence ----------
  wrap('knockdown', async function (o, t, force = false, ...r) {
    if (t && t.alive && !t.knockdown && !t.onVP && this.isAdj(t) && t.gear.some(x => !x.discarded && /(?:^|\.\s)Acrobatics\./.test(this.gearText(x, t)))) { this.say(`${t.name}: Acrobatics — Knockdown 대신 Vault`, 'good'); if (this.vault) await this.vault(t); return; }
    return o.call(this, t, force, ...r);
  });
  wrap('burn', async function (o, t, ...r) { if (t && t.gear && t.gear.some(x => !x.discarded && /(?:^|\.\s)Ignore Burn\./.test(this.gearText(x, t)))) { this.say(`${t.name}: Ignore Burn`, 'good'); return; } return o.call(this, t, ...r); });
  wrap('dealFD', async function (o, t, f, d, card, hits, ...r) {
    if (t && d > 0 && card && ((card.med && card.med.mw) || /MICROWAVE/.test(card.kind || ''))) { const X = this.gearKWSum(t, 'Microwave Resistance') + (+this.inh(t, 'Microwave Resistance') || 0); if (X) { const nd = Math.max(0, d - X * (hits || 1)); this.say(`${t.name}: Microwave Resistance ${X} — Danger ${d} → ${nd}`, 'good'); d = nd; } }
    return o.call(this, t, f, d, card, hits, ...r);
  });
  // ---------- Dare ----------
  wrap('obolDraw', async function (o, t, ...r) {
    if (t && t.alive && !this._dareAsk) {
      const L = [...this.c5Abil(t, 'Dare\\.'), ...t.gear.filter(g => !g.discarded && /Gain the (?:Fear|Dread) Condition card to Dare/.test(this.gearText(g, t))).map(g => ({ g, cost: '', cond: /Gain the (Fear|Dread) Condition card to Dare/.exec(this.gearText(g, t))[1] }))];
      for (const a of L) { this._dareAsk = true; let ok = false; try { ok = await yn(this, t, `${a.g.card.name}: Dare — 이번 Obol은 반대 결과로 해결?${a.cost ? ` [${this.costLbl(a.cost)}]` : ''}${a.cond ? ` (${a.cond} Condition 획득)` : ''}`); } finally { this._dareAsk = false; } if (!ok) continue; if (a.cost) await this.payCost(t, a.cost, a.g); if (a.cond) await this.addCondition(t, a.cond); if (!t.alive) return; this._dareT = t; break; }
    }
    try { return await o.call(this, t, ...r); } finally { if (this._dareT === t) this._dareT = null; }
  });
  // ---------- Deny hooks (Vanish / Lightbend / Flicker) ----------
  if (P.dpVanish) wrap('dpVanish', async function (o, n, who, ...r) { if (await this.c5Deny('Vanish')) return; return o.call(this, n, who, ...r); });
  if (P.ufFlicker) wrap('ufFlicker', async function (o, again, ...r) { if (!again && await this.c5Deny('Flicker')) return; return o.call(this, again, ...r); });
  if (P.medSentence) wrap('medSentence', async function (o, t, p, ...r) { if (/^Lightbend\.?$/.test(p) && await this.c5Deny('Lightbend')) return true; return o.call(this, t, p, ...r); });
  if (P.medSkitter) wrap('medSkitter', async function (o, n, who, ...r) { if (who && who.gear && who.gear.some(x => !x.discarded && /(?:^|\.\s)Ignore Skitter\./.test(this.gearText(x, who)))) { this.say(`${who.name}: Ignore Skitter`, 'good'); return; } return o.call(this, n, who, ...r); });
  // ---------- Scan: Remote Scan / Rescan ----------
  if (P.ventsAdj) wrap('ventsAdj', function (o, t, used) { const base = o.call(this, t, used); if (!t || !t.pos || t.onVP || !t.gear || !t.gear.some(x => !x.discarded && /(?:^|\.\s)Remote Scan\./.test(this.gearText(x, t)))) return base; const seen = new Set(base.map(z => z.id)); for (const z of this.board.terrain.values()) if (z.vent && !used.has(z.id) && !seen.has(z.id) && Board.dist(t.pos, z.cell) <= 3) { seen.add(z.id); base.push(z); } return base; });
  // ---------- Terrain Vault (free action) ----------
  wrap('freeActions', function (o, t) {
    const out = o.call(this, t);
    if (t && t.alive && t.pos && !t.onVP && !t.knockdown && !t.offBoard) for (const a of this.c5Abil(t, 'Terrain Vault\\.')) { if (!DIR_LIST.some(d => this.board.terrainAt(t.pos.c + DIRS[d][0], t.pos.r + DIRS[d][1]))) break; out.push({ label: `${a.g.card.name}: Terrain Vault${a.cost ? ` [${this.costLbl(a.cost)}]` : ''}`, noFate: true, value: () => this.c5TerrainVault(t, a) }); break; }
    return out;
  });
}
