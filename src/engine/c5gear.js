// Cycle V gear keywords (Storybook p.10-14): Liquid Edge, Non-euclidean, Unwieldy, Tilt, Stuck, Dare, Deny, Abysswalk, Acrobatics,
// Terrain Vault, Rescan / Remote Scan, Microwave / Pain / Despair Resilience, Ignore Burn, Ignore Skitter, Commit (Pain).
import { Board, key, DIRS, DIR_LIST, cellLabel, kw, reachable } from './core.js';

export function installC5Gear(Game, { TitanDied, BattleOver }) {
  const ML0 = /You start the Battle with 1 Oxygen token and you cannot gain Oxygen/;
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
      if (/Start of Battle: Gain 1 Oxygen token\./.test(tx) && !t.gear.some(x => !x.discarded && ML0.test(this.gearText(x, t)))) { t.oxygen = (t.oxygen || 0) + 1; this.say(`${g.card.name}: 전투 시작 — Oxygen +1 (${t.oxygen})`); }
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
    if (!r && /Liquid Edge/.test(txt)) { const rg = /(?:^|[.;]\s+)Ranged (\d+)-(\d+)/.exec(txt), re = /Reach (\d)/.exec(txt); if (rg) r = ch >= +rg[1] && ch <= +rg[2]; else if (re) r = ch <= +re[1]; } /* FAQ: Liquid Edge — count range diagonally */
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
    if (t && t.alive && !t.knockdown && !t.onVP && t.pos && !this.primContains(t.pos) && this.isAdj(t) && t.gear.some(x => !x.discarded && /(?:^|\.\s)Acrobatics\./.test(this.gearText(x, t)))) { this.say(`${t.name}: Acrobatics — Knockdown 대신 Vault`, 'good'); if (this.vault) await this.vault(t); return; }
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
  // ---------- Will Anthropos: Bravery at the start of the Battle and on each You Live! Obol ----------
  const WA = /At the start of the Battle and each time you draw a You Live! Obol, gain the Bravery Condition card/;
  wrap('startOfBattle', async function (o, ...a) { const r = await o.call(this, ...a); for (const t of this.liveTitans()) if (t.gear.some(g => !g.discarded && WA.test(this.gearText(g, t)))) { this.say(`${t.name}: Will Anthropos — 전투 시작, Bravery`, 'good'); await this.solo(() => this.addCondition(t, 'Bravery')); } return r; });
  wrap('obolDraw', async function (o, t, ...r) { const res = await o.call(this, t, ...r); if (t && t.alive && t._obolSurvived && t.gear.some(g => !g.discarded && WA.test(this.gearText(g, t)))) { this.say(`${t.name}: Will Anthropos — You Live!, Bravery`, 'good'); await this.addCondition(t, 'Bravery'); } return res; });
  // ---------- Aether Extinguisher: ignore Burn on you or an adjacent Titan ----------
  wrap('burn', async function (o, t, ...r) {
    if (t && t.alive && !this._extAsk) {
      for (const h of this.liveTitans()) { if (h !== t && !(h.pos && t.pos && !h.onVP && !t.onVP && this.tDist(h, t) === 1)) continue; const g = h.gear.find(x => !x.discarded && !x.exhausted && /Ψ⟳ When you, or an adjacent Titan, are about to suffer Burn, ignore it/.test(this.gearText(x, h))); if (!g || this.fr(h) < 1) continue;
        this._extAsk = true; let ok = false; try { ok = await yn(this, h, `${g.card.name}: ${t.name}의 Burn을 무시? (Fate+1, 소진${h !== t ? ` — ${t.name} Bravery 획득` : ''})`); } finally { this._extAsk = false; }
        if (!ok) continue; await this.payCost(h, 'Ψ⟳', g); this.say(`${g.card.name}: ${t.name} Burn 무시`, 'good'); if (h !== t) await this.addCondition(t, 'Bravery'); return; }
    }
    return o.call(this, t, ...r);
  });
  // ---------- Illuminating Blinder (FAQ): about to die from gaining a Condition → discard the card you already have and take the new one ----------
  const IB = /When you are about to die from gaining a Condition card, discard that card without effect instead/;
  const FAM = { Fear: ['Dread', 'Fear'], Dread: ['Dread', 'Fear'], Hatred: ['Frenzy', 'Hatred'], Frenzy: ['Frenzy', 'Hatred'], Muffled: ['Sealed', 'Muffled'], Sealed: ['Sealed', 'Muffled'], Terror: ['Holy Terror', 'Terror'], 'Holy Terror': ['Holy Terror', 'Terror'] };
  wrap('addCondition', async function (o, t, name, ...r) {
    if (!t || !t.alive || this._ib || !t.gear.some(g => !g.discarded && IB.test(this.gearText(g, t)))) return o.call(this, t, name, ...r);
    this._ib = { t, name }; try { return await o.call(this, t, name, ...r); } finally { this._ib = null; }
  });
  wrap('kill', async function (o, t, opts = {}, ...r) {
    const I = this._ib; if (I && I.t === t && t.alive && !opts.unavoidable) { const fam = FAM[I.name] || [I.name]; const had = t.conditions.filter(c => fam.includes(c)); t.conditions = t.conditions.filter(c => !fam.includes(c)); if (!t.conditions.includes(I.name)) t.conditions.push(I.name); this._ib = null; this.say(`${t.name}: Illuminating Blinder — 사망 대신 기존 ${had.join('/') || I.name} 카드를 버리고 「${I.name}」 획득`, 'good'); this.notify(); return; }
    return o.call(this, t, opts, ...r);
  });
  // ---------- Darklight Wiring (FAQ): the card itself gains Light X until the end of your turn (can be smothered) ----------
  wrap('gearText', function (o, g, t, ...r) { let s = o.call(this, g, t, ...r); if (s && /\[(Aether|Oxygen|Pain|Despair)\]/.test(s)) s = s.replace(/\[Aether\]/g, 'ⓐ').replace(/\[Oxygen\]/g, 'ⓞ').replace(/\[Pain\]/g, 'ⓟ').replace(/\[Despair\]/g, 'ⓓ'); /* gate texts too */ if (g && t && g._dlwTurn && g._dlwTurn === this._turnSeq && (t.ambrosia || 0) > 0) s += ` Light ${t.ambrosia}.`; return s; });
  wrap('freeActions', function (o, t) {
    const out = o.call(this, t);
    if (t && t.alive) for (const a of this.c5Abil(t, 'Gain Light X until the end of your turn')) { if (a.g._dlwTurn === this._turnSeq) continue; out.push({ label: `${a.g.card.name}: 턴 종료까지 이 카드가 Light X (X = Ambrosia ${t.ambrosia || 0}) [${this.costLbl(a.cost)}]`, noFate: !/Ψ/.test(a.cost), value: async () => { await this.payCost(t, a.cost, a.g); a.g._dlwTurn = this._turnSeq; this.say(`${a.g.card.name}: Light ${t.ambrosia || 0} (턴 종료까지, Smother 가능)`, 'good'); this.notify(); } }); }
    return out;
  });
  // ---------- [Argo] Flash Backstep (FAQ: the Titan must be adjacent when Flash Step / Vanish / Flicker is triggered) ----------
  for (const nm of ['dpVanish', 'ufFlicker', 'txFlashStep']) if (P[nm]) wrap(nm, async function (o, ...a) {
    const adj = this.argoAvail('Flash Backstep') ? this.liveTitans().filter(t => t.pos && !t.onVP && !t.offBoard && !t.impaled && !t.stair && this.isAdj(t)) : [];
    const res = await o.call(this, ...a);
    const L = adj.filter(t => t.alive && t.pos && !t.onVP && !this.isAdj(t)); if (!L.length || this.prim.offBoard || !this.argoAvail('Flash Backstep')) return res;
    const x = await this.ask({ type: 'choice', title: `[Argo] Flash Backstep (charge ${this.argoAvail('Flash Backstep').charges}): ${this.prim.name}에 인접해 있던 타이탄이 Pain 1을 얻고 최대 9칸 이동해 다시 인접?`, options: [{ label: '사용 안 함', value: null }, ...L.map(t => ({ label: t.name, value: t }))] });
    if (!x) return res; const A = this.argoAvail('Flash Backstep'); A.charges--; A.exhausted = true; this.say(`Argo Ability 「Flash Backstep」: ${x.name}`, 'sys');
    if (this.gainPain) await this.solo(() => this.gainPain(x, 1, 'Flash Backstep')); if (!x.alive) return res;
    const blocked = new Set(this.liveTitans().filter(y => y !== x && y.pos && !y.onVP).map(y => key(y.pos.c, y.pos.r))); for (const p of this.primCells()) blocked.add(key(p.c, p.r));
    const R = reachable(this.board, x.pos, 9, blocked); const cells = [...R.keys()].map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(q => Board.isAdjacent(q, this.primCells()) && this.freeCell(q));
    if (!cells.length) { this.say(`${x.name}: Flash Backstep — 9칸 안에 인접한 빈 칸이 없음`); return res; }
    const d = await this.ask({ type: 'move', titan: x, title: `Flash Backstep: ${x.name}의 목적지 (${this.prim.name}에 인접)`, cells, options: cells.map(q => ({ label: cellLabel(q), value: q })) }) || cells[0];
    x.pos = { ...d }; this.say(`${x.name}: Flash Backstep — ${cellLabel(d)}로 이동`, 'good'); await this.landOn(x); this.notify(); return res;
  });
  // ---------- Phobos Whip (FAQ): double the Kratos tokens placed from Kratos Table abilities (while it is the active Weapon); Truth X → 2 of each chosen token ----------
  wrap('ktStage', async function (o, t, A, ...r) {
    const kt = await o.call(this, t, A, ...r);
    if (kt && A && A.g && !A.g.discarded && /Double the number of Kratos tokens you place from your Kratos Table abilities/.test(this.gearText(A.g, t))) { for (const k of ['fire', 'black', 'hope', 'break', 'opening', 'closing', 'diversion', 'rouse']) if (typeof kt[k] === 'number') kt[k] *= 2; kt.truthX2 = true; if (!A._pwSaid) { A._pwSaid = true; this.say(`${A.g.card.name}: Kratos Table 토큰 2배`, 'good'); } }
    return kt;
  });
  // ---------- Moonlung ----------
  const ML = /You start the Battle with 1 Oxygen token and you cannot gain Oxygen/;
  const oxyBattle = g => !!(g.prim && (g.prim.def.basicTraits || []).includes('Oxygen and Aether'));
  wrap('startOfBattle', async function (o, ...a) { const r = await o.call(this, ...a); if (oxyBattle(this)) for (const t of this.liveTitans()) if (t.gear.some(g => !g.discarded && ML.test(this.gearText(g, t)))) { const v = Math.max(0, 1 - (this.trait('Deeper Depths') ? 1 : 0) - (this.trait('Unfathomable Depths') ? 2 : 0)); t.oxygen = v; this.say(`${t.name}: Moonlung — Oxygen ${v}개로 시작${v < 1 ? ' (Deeper Depths 등 적용, FAQ)' : ''}, Oxygen을 얻을 수 없음`, 'sys'); } return r; });
  wrap('titanTurn', async function (o, t, ...r) {
    if (t && t.alive && t.gear.some(g => !g.discarded && /Start of your turn: Gain 1 Pain token and flip 1 Aether token/.test(this.gearText(g, t)))) { this.say(`${t.name}: Moonlung — 턴 시작, Pain +1${oxyBattle(this) ? ', Aether 1개 뒤집기' : ''}`); if (this.gainPain) await this.solo(() => this.gainPain(t, 1, 'Moonlung')); if (t.alive && oxyBattle(this) && this.flipAether && (t.aether || 0) > 0) this.flipAether(t, 1); }
    return o.call(this, t, ...r);
  });
  // ---------- Costs of active abilities can never be prevented (FAQ: Spewed by the Abyss / In Your Image L1 do not apply) ----------
  wrap('payCost', async function (o, ...a) { const f = this._costPay; this._costPay = true; try { return await o.call(this, ...a); } finally { this._costPay = f; } });
  // ---------- In Your Image L1: test 8+ per Pain token about to be gained ----------
  if (P.gainPain) wrap('gainPain', async function (o, t, n, ...r) {
    if (t && t.alive && n > 0 && !this._costPay) { const m = this.mn(t, 'In Your Image', 1); if (m) { let red = 0; const rolls = []; for (let i = 0; i < n; i++) { const d = this.rng.d10(); rolls.push(d); if (d + this.testPen(t) >= 8 || d === 10) red++; } this.say(`${t.name}: In Your Image 테스트 [${rolls.join(' ')}] (8+) → Pain −${red}`, red ? 'good' : ''); n -= red; if (n <= 0) return; } }
    return o.call(this, t, n, ...r);
  });
  // ---------- Dogmatic (fated, FAQ): cannot discard Aether to activate abilities (flipping and Aether sets still work) ----------
  wrap('costOK', function (o, t, cost, ...r) { if (t && cost && /ⓐ/.test(cost) && this.hasFated(t, 'Dogmatic')) return false; if (t && cost && /ⓓ/.test(cost) && this.ab(t, 'Fearless')) return false; /* FAQ: cannot gain Despair → cannot pay Despair costs */ return o.call(this, t, cost, ...r); });
  // ---------- Rage doom timing (FAQ): over the Pain-lowered Rage limit → die as soon as the Attack finishes; immediately if not attacking ----------
  wrap('titanAttack', async function (o, t, ...r) {
    this._atkN = (this._atkN || 0) + 1; let res;
    try { res = await o.call(this, t, ...r); } finally { this._atkN--; }
    if (t && t.alive && t.rageDoom && !this._atkN) { this.say(`${t.name}: 공격 종료 — 분노에 삼켜져 사망 (FAQ)`, 'bad'); await this.solo(() => this.kill(t)); }
    return res;
  });
  if (P.gainPain) wrap('gainPain', async function (o, t, ...r) {
    const res = await o.call(this, t, ...r);
    if (t && t.alive && t.rageDoom && !this._atkN) { this.say(`${t.name}: 공격 중이 아님 — 즉시 분노에 삼켜져 사망 (FAQ)`, 'bad'); await this.kill(t); }
    return res;
  });
  // ---------- Heir Apparent Rage 6+: gain the Hatred and Fear Condition cards immediately ----------
  wrap('gainRage', async function (o, t, ...r) {
    const res = await o.call(this, t, ...r);
    if (t && t.alive) for (const g of t.gear) { if (g.discarded) continue; if (t.rage < 6) { g._heir = false; continue; } if (g._heir || !/Gain the Hatred and Fear Condition cards/.test(this.gearText(g, t))) continue; g._heir = true; this.say(`${g.card.name}: Rage ${t.rage} — Hatred, Fear 즉시 획득 (FAQ)`, 'bad'); await this.addCondition(t, 'Hatred'); if (t.alive) await this.addCondition(t, 'Fear'); if (!t.alive) break; }
    return res;
  });
  // ---------- [R] Terrain Vault (FAQ: Slabspear = reaction, Abyss Wetsuit = free action) ----------
  wrap('c4Reactions', function (o, x, t, card) {
    const out = o.call(this, x, t, card); if (!x || !x.alive || !x.pos || x.onVP || x.knockdown || x.offBoard) return out;
    for (const g of x.gear) { if (g.discarded || g.blank) continue; const m = new RegExp(`\\[R\\]${COST} ?Terrain Vault\\.`).exec(this.gearText(g, x)); if (!m) continue; const cost = m[1] || ''; if (cost && !this.costOK(x, cost, g)) continue; if (!DIR_LIST.some(d => this.board.terrainAt(x.pos.c + DIRS[d][0], x.pos.r + DIRS[d][1]))) continue; out.push({ label: `${x.name}: ${g.card.name} — Terrain Vault [${this.costLbl(cost)}]`, noFate: !/Ψ/.test(cost), value: () => this.c5TerrainVault(x, { g, cost }) }); break; }
    return out;
  });
  // ---------- Dodona Cryptex — Herd Sync (FAQ: you can't have two Fatigue tokens) ----------
  wrap('freeActions', function (o, t) {
    const out = o.call(this, t); if (!t || !t.alive) return out;
    for (const h of this.liveTitans()) { if (h.fatigue || this.fr(h) < 1) continue; const g = h.gear.find(x => !x.discarded && /Herd Sync: Ψ Move \[Combat\] or \[Movement\] Fatigue token from another Titan's sheet to your sheet/.test(this.gearText(x, h))); if (!g) continue; if (h !== t && !/You may use this ability during another Titan's turn/.test(this.gearText(g, h))) continue;
      for (const x of this.liveTitans()) { if (x === h || !x.fatigue) continue; out.push({ label: `${h.name}: ${g.card.name} Herd Sync — ${x.name}의 ${x.fatigue === 'combat' ? 'Combat' : 'Movement'} Fatigue를 가져옴 (Fate+1)`, value: async () => { if (h.fatigue) { this.say(`${h.name}: 이미 Fatigue 토큰이 있음 (FAQ: 2개 불가)`); return; } await this.gainFate(h, 1); h.fatigue = x.fatigue; x.fatigue = false; this.say(`${h.name}: Herd Sync — ${x.name}의 Fatigue 토큰을 가져옴`, 'good'); this.notify(); } }); } }
    return out;
  });
}
