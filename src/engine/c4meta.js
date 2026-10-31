// Cycle IV (and some Cycle V) Mnemos, Fated Mnemos and Argo Abilities
import { Board, key, cellLabel, DIRS, DIR_LIST, facePotential, facePower } from './core.js';

const MIND = ['Fear', 'Dread', 'Hatred', 'Frenzy', 'Muffled', 'Sealed', 'Terror', 'Holy Terror', 'Berserk', 'Egolock', 'Abandon'];
const FLIP = { Dread: 'Fear', Fear: 'Dread', Frenzy: 'Hatred', Hatred: 'Frenzy', Sealed: 'Muffled', Muffled: 'Sealed', 'Greed-crazed': 'Covetous', Covetous: 'Greed-crazed', Wishagog: 'Wishkeen', Wishkeen: 'Wishagog', 'Holy Terror': 'Terror', Terror: 'Holy Terror' };

export function installC4Meta(Game, { TitanDied, BattleOver, ChainBreak }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const yn = (g, t, title) => g.ask({ type: 'yn', titan: t, title, options: [{ label: '사용', value: true }, { label: '패스', value: false }] });
  const fated = (g, t, n) => g.hasFated(t, n);

  // ---------- Mnemos gate kinds (Cycle V: Pain / Despair gates) ----------
  wrap('mn', function (o, t, name, lvl, needReady = false) {
    const m = (t && t.mnemos || []).find(x => x.card.name === name && !x.discarded); const L = m && m.card.levels[String(lvl)];
    if (!L || !L.gateKind) return o.call(this, t, name, lvl, needReady);
    if (this.prim && this.hopeless(t) >= 1) return null; if (t.dhOar === 'winnowed') return null; if (m.level < lvl) return null; if (needReady && m.exhausted) return null;
    const v = L.gateKind === 'despair' ? (t.despair || 0) : (t.pain || 0); return v >= (L.gate || 0) ? m : null;
  });
  // ---------- Fated: cycle filter for random gains ----------
  wrap('gainFated', async function (o, t) {
    const all = this.data.argonauts.fatedMnemos; const cyc = (this.prim && this.prim.def.cycle) || 4; const keep = all.slice();
    this.data.argonauts.fatedMnemos = all.filter(f => f.cycle == null || f.cycle <= cyc); try { return await o.call(this, t); } finally { this.data.argonauts.fatedMnemos = keep; }
  });
  // ---------- start of battle ----------
  wrap('sobExtra', function (o, add) { o.call(this, add); for (const t of this.liveTitans()) { if (fated(this, t, 'Cursed') && !t.conditions.includes('Goldthirst')) add(t, 'Cursed (Fated): Goldthirst 저주', () => this.safe(() => this.addCurse(t, 'Goldthirst'))); if (fated(this, t, 'Twice-Cursed') && !t.conditions.includes('Windblight')) add(t, 'Twice-Cursed (Fated): Windblight 저주', () => this.safe(() => this.addCurse(t, 'Windblight'))); } });
  wrap('startOfBattle', async function (o) {
    for (const t of this.liveTitans()) {
      if (fated(this, t, 'Hoarder')) this.say(`${t.name}: Hoarder — 토큰·카드 자발적 버림 불가 (X 비용 능력, Discard 능력 사용 불가)`, 'sys');
    }
    if ((this.prim.def.cycle || 0) >= 4) {
      for (const a of this.argo || []) if (a.card.name === 'Trireme Ballista Fire') { a.charges = 0; this.say('Cycle IV: 이전 Cycle의 Trireme Argo Ability 「Trireme Ballista Fire」 비활성', 'sys'); }
    }
    if (this.argoCard('Cloud Support Fleet') && !this.trireme) { this.trireme = { pos: null, spent: false, movedRound: -1 }; this.say('Cloud Support Fleet: Cirrotrireme 토큰 준비 (Argo Ability를 써서 보드에 배치)', 'sys'); }
    return o.call(this);
  });
  // ---------- Midas gain: Beggar L2 / Cursed ----------
  wrap('gainMidas', async function (o, t, n = 1, raw = false, vol = false) {
    if (!vol && n > 0 && t && t.alive && !this._fodInner) { const m = this.mn(t, 'The Beggar and the Prince', 2, true); if (m && this.fr(t) > 0 && await yn(this, t, `The Beggar and the Prince L2: Midas +${n} 무시? (Fate+1, 소진)`)) { this.mnUse(t, m, '⟳'); await this.gainFate(t, 1); this.say(`${t.name}: Midas 획득 무시`, 'good'); return; } }
    const before = this.midas ? this.midas(t) : 0; await o.call(this, t, n, raw, vol);
    if (t.alive && fated(this, t, 'Cursed') && this.midas(t) > before) { this.say(`${t.name}: Cursed — Midas 획득, Fate +1`, 'bad'); await this.gainFate(t, 1, { nc: true }); }
  });
  // ---------- Indebted ----------
  wrap('gainAmbrosia', async function (o, t, n, terrain = false) { if (t && n >= 1 && fated(this, t, 'Indebted') && !this._indebt) { n += 1; this.say(`${t.name}: Indebted — Ambrosia +1 더`, 'bad'); } return o.call(this, t, n, terrain); });
  wrap('gainDespair', async function (o, t, n, ...r) { if (t && n >= 1 && fated(this, t, 'Indebted')) { n += 1; this.say(`${t.name}: Indebted — Despair +1 더`, 'bad'); } return o.call(this, t, n, ...r); });
  wrap('addCondition', async function (o, t, name, opts = {}) {
    const had = t && (t.conditions || []).includes(name); const r = await o.call(this, t, name, opts);
    if (t && t.alive && !had && MIND.includes(name) && (t.conditions || []).includes(name) && fated(this, t, 'Godfearing')) { t.tokens.precision -= 1; this.say(`${t.name}: Godfearing — −Precision 토큰`, 'bad'); }
    return r;
  });
  wrap('bleedGain', async function (o, t, n) { const r = await o.call(this, t, n); if (t && r >= 1 && fated(this, t, 'Indebted')) { this.say(`${t.name}: Indebted — Bleeding 토큰 +1 더`, 'bad'); return r + 1; } return r; });
  // ---------- Twice-Cursed ----------
  const tc = async (g, t, why) => { if (t && t.alive && fated(g, t, 'Twice-Cursed')) { g.say(`${t.name}: Twice-Cursed — ${why}, Fate +1`, 'bad'); await g.gainFate(t, 1, { nc: true }); } };
  wrap('knockdown', async function (o, t, ...a) { const k0 = t && t.knockdown; const r = await o.call(this, t, ...a); if (t && !k0 && t.knockdown) await tc(this, t, 'Knockdown'); return r; });
  for (const nm of ['knockback', 'pullTitan', 'displace', 'pushbackTitan', 'teleportTitan']) if (P[nm]) wrap(nm, async function (o, t, ...a) { const p0 = t && t.pos && !this._tcIn ? { ...t.pos } : null; const in0 = this._tcIn; this._tcIn = true; let r; try { r = await o.call(this, t, ...a); } finally { this._tcIn = in0; } if (t && p0 && t.alive && t.pos && (p0.c !== t.pos.c || p0.r !== t.pos.r)) await tc(this, t, '비자발적 이동'); return r; });
  wrap('float', async function (o, t, ...a) { const f0 = t && t.float; const r = await o.call(this, t, ...a); if (t && !f0 && t.float) await tc(this, t, 'Float'); return r; });
  wrap('wishAway', async function (o, t, x = null, opts = {}) {
    if (t && t.alive && !opts.escape && !t.stair) { const a = this.argoAvail('Cloud Scout Fleet'); if (a && await yn(this, t, `[Argo] Cloud Scout Fleet (charge ${a.charges}): ${t.name}의 Wish Away를 최대 −4, 앞쪽이 아닌 타워도 허용?`)) { a.charges--; a.exhausted = true; this.say('Argo Ability 「Cloud Scout Fleet」', 'sys'); const base = x == null ? this.wishAwayBase() : x; const v = await this.ask({ type: 'choice', titan: t, title: 'Cloud Scout Fleet: 감소량', options: [0, 1, 2, 3, 4].filter(i => i <= base).map(i => ({ label: `−${i} → ${base - i}`, value: i })) }); x = Math.max(0, base - (v || 0)); opts = { ...opts, anyDir: true }; } }
    const p0 = t && t.pos ? { ...t.pos } : null; const r = await o.call(this, t, x, opts); if (t && p0 && t.alive && t.pos && (p0.c !== t.pos.c || p0.r !== t.pos.r)) await tc(this, t, '비자발적 이동'); return r;
  });
  // ---------- Deprived / Expendable / Messianic ----------
  wrap('awaken', async function (o, t, ...a) { if (fated(this, t, 'Deprived')) { this.say(`${t.name}: Deprived — 각성할 수 없음`, 'bad'); return false; } return o.call(this, t, ...a); });
  wrap('maybeSecondChance', async function (o, t, card, what = 'Trauma') {
    if (what === 'Obol' && fated(this, t, 'Expendable')) { this.say(`${t.name}: Expendable — Obol을 다시 뽑을 수 없음`); return false; }
    { const m = !t._noChance && !fated(this, t, 'Superstitious') && this.mn(t, 'The Thousandth Night', 2); if (m && card.pol !== '+' && card.result !== 'live' && await yn(this, t, `The Thousandth Night L2: Second Chance — 「${card.name}」 무시하고 다시 뽑기? (Mnemos 버림)`)) { this.mnUse(t, m, 'X'); this.say(`${t.name}: Second Chance! (The Thousandth Night)`, 'good'); return true; } }
    return o.call(this, t, card, what);
  });
  wrap('obolDraw', async function (o, t, v = 10, extra = 0) { if (t && t.alive && fated(this, t, 'Messianic')) { extra += 1; this.say(`${t.name}: Messianic — 이번 드로우에 You Died Obol 1장 추가`, 'bad'); } return o.call(this, t, v, extra); });
  // ---------- death: True Value of Life / Thousandth Night L3 ----------
  wrap('kill', async function (o, t, opts = {}) {
    if (t && t.alive && !opts.erased && !opts.flash && !opts.final) {
      const a = this.argoAvail('True Value of Life'); if (a && await yn(this, t, `[Argo] True Value of Life (charge ${a.charges}): ${t.name}의 죽음을 무시? (Argo Fate +1 — 캠페인)`)) { a.charges--; a.exhausted = true; this.say(`Argo Ability 「True Value of Life」: ${t.name} 죽음 무시`, 'good'); return; }
      const m = this.mn(t, 'The Thousandth Night', 3); if (m && !t._postpone && await yn(this, t, `The Thousandth Night L3: 죽음을 다음 턴 종료까지 미루기? (Mnemos 버림, 막을 수 없음)`)) { this.mnUse(t, m, 'X'); t._postpone = this._actor === t ? 2 : 1; t._tnCurse = true; this.say(`${t.name}: 죽음이 미뤄짐 — 다음 턴 종료 시 사망`, 'bad'); return; }
    }
    return o.call(this, t, opts);
  });
  // ---------- turns ----------
  // ---------- precision / evasion ----------
  wrap('precisionMods', function (o, t) { let p = o.call(this, t); if (t && fated(this, t, 'Fear of Heights') && this.c4Elevated(t)) p -= 1; return p; });
  wrap('evasionBonus', function (o, t) { return o.call(this, t) + (t && t._tnEv ? 1 : 0); });
  wrap('evasionRoll', async function (o, t, dice, diff, card, judge = null) {
    if (t && !judge) { const m = this.mn(t, 'The Thousandth Night', 1, true); if (m) { const X = this.evasionBonus(t) + 1; if (X <= this.fr(t) && await yn(this, t, `The Thousandth Night L1: Fate +${X}로 Evasion +1? (소진)`)) { this.mnUse(t, m, '⟳'); await this.gainFate(t, X); t._tnEv = 1; } } }
    const tmp = t && !judge ? (t._tmpEv || 0) : 0;
    try { return await o.call(this, t, dice, diff, card, judge); } finally { if (t) { t._tnEv = 0; if (tmp) { t.tokens.evasion -= tmp; t._tmpEv = Math.max(0, (t._tmpEv || 0) - tmp); this.say(`${t.name}: 임시 Evasion 토큰 ${tmp}개 사용 후 제거`); } } }
  });
  // ---------- Airburst / Curse immunity ----------
  wrap('c4IgnoreAirFloat', async function (o, t, what) {
    if (this._curseImm && this._curseImm.has(t)) { this.say(`${t.name}: Curse Attack 무시 — ${what} 무시`, 'good'); return true; }
    if (/Airburst/.test(what) && this.currentAI) { const m = this.mn(t, 'Too Big to Fail', 2); if (m && await yn(this, t, `Too Big to Fail L2: Airburst 무시? (Mnemos 버림)`)) { this.mnUse(t, m, 'X'); this.say(`${t.name}: Airburst 무시`, 'good'); return true; } }
    return o.call(this, t, what);
  });
  // ---------- attack start: Peddler L1, Seed L1/L3, Beggar L3 ----------
  wrap('c4AttackStart', async function (o, t, g, A) {
    let m;
    if ((m = this.mn(t, 'Seed of Paradise', 1, true)) && await yn(this, t, 'Seed of Paradise L1: 이번 공격 동안 Kratos Pool을 Sunstarved 또는 Sunbask 2로 취급? (소진)')) { const v = await this.ask({ type: 'choice', titan: t, title: 'Seed of Paradise', options: [{ label: 'Sunstarved (Fire 0으로 취급)', value: 0 }, { label: 'Sunbask 2 (Fire 2로 취급)', value: 2 }] }); this.mnUse(t, m, '⟳'); const base = this.gearText(g, t); this._seedFire = v == null ? 0 : v; this.say(`Seed of Paradise: Kratos Pool을 ${this._seedFire ? 'Sunbask 2' : 'Sunstarved'}로 취급`); const nb = this.gearText(g, t); A.txt = (A.txt || '').startsWith(base) ? nb + A.txt.slice(base.length) : nb; A._txtRe = true; }
    await o.call(this, t, g, A);
    if ((m = this.mn(t, 'Peddler of Misery', 1, true)) && this.kpTokens() === 0 && await yn(this, t, 'Peddler of Misery L1: Startup 2? (소진)')) { this.mnUse(t, m, '⟳'); const k = await this.ask({ type: 'choice', titan: t, title: 'Startup 2: Opening/Break 배분', options: [0, 1, 2].map(i => ({ label: `Opening ${2 - i} / Break ${i}`, value: 2 - i })) }); const op = k == null ? 2 : k; this._kpRaw.opening = (this._kpRaw.opening || 0) + op; this._kpRaw.break = (this._kpRaw.break || 0) + (2 - op); this.say(`Startup 2: Opening ${op}, Break ${2 - op}`); }
    if ((m = this.mn(t, 'Seed of Paradise', 3, true)) && this.fr(t) > 0 && this.kpTokens() > 1 && await yn(this, t, 'Seed of Paradise L3: Kratos Pool 토큰 절반을 이 카드로 옮겼다가 2nd window에 되돌리기? (Fate+1, 소진)')) { this.mnUse(t, m, '⟳'); await this.gainFate(t, 1); const K = this._kpRaw; const held = {}; for (const k of ['opening', 'break', 'diversion', 'fire', 'black', 'hope', 'closing', 'rouse']) { const h = Math.floor((K[k] || 0) / 2); if (h) { held[k] = h; K[k] -= h; } } A.seedHeld = held; this.say(`Seed of Paradise: ${Object.entries(held).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}을 카드에 보관`); }
    if ((m = this.mn(t, 'The Beggar and the Prince', 3)) && this.midas(t) > 0 && await yn(this, t, `The Beggar and the Prince L3: Midas ${this.midas(t)}개를 모두 버리고 그만큼 Precision? (Mnemos 버림)`)) { this.mnUse(t, m, 'X'); const n = this.midas(t); for (const q of t.gear) q.midas = 0; this.midasRemoved && this.midasRemoved(t, n); A.c4prec = (A.c4prec || 0) + n; this.say(`${t.name}: Midas ${n} 버림 → Precision +${n}`, 'good'); }
  });
  wrap('c4Gates', function (o, c, t, text) { if (this._seedFire == null || !/Sunstarved:|Sunbask \d:/.test(text)) return o.call(this, c, t, text); const K = this.kratosPool; const f0 = K.fire; try { this._kpRaw ? (this._kpRaw.fire = this._seedFire) : null; return o.call(this, c, t, text); } finally { if (this._kpRaw) this._kpRaw.fire = f0; } });
  wrap('c4SecondWindow', async function (o, t, A, ...r) { if (A && A.seedHeld) { for (const [k, v] of Object.entries(A.seedHeld)) this._kpRaw[k] = (this._kpRaw[k] || 0) + v; this.say('Seed of Paradise: 보관한 토큰을 Kratos Pool로'); A.seedHeld = null; } return o.call(this, t, A, ...r); });
  wrap('endAttack', async function (o, A) {
    this._seedFire = null;
    if (A && A.seedHeld) { for (const [k, v] of Object.entries(A.seedHeld)) this._kpRaw[k] = (this._kpRaw[k] || 0) + v; this.say('Seed of Paradise: 보관한 토큰을 Kratos Pool로 (공격 종료)'); A.seedHeld = null; }
    if (A && A.wound && A.t && fated(this, A.t, 'Wishful Thinker')) { const top = this.ai.cards[0]; if (top && !(top.tier === 3 || top.tier === 4)) { this.ai.shuffle(); this.say(`${A.t.name}: Wishful Thinker — AI 덱 맨 위가 AI III/IV가 아님 → AI 덱 섞음`, 'bad'); } }
    return o.call(this, A);
  });
  wrap('kpClear', async function (o, t, A) {
    const m = t && this.mn(t, 'Seed of Paradise', 2, true); let held = null, P0 = null;
    if (m && this.fr(t) > 0 && this.kpTokens() > 1 && await yn(this, t, 'Seed of Paradise L2: Kratos Pool 정리 때 쓰지 않은 토큰 절반을 남기기? (Fate+1, 소진)')) { this.mnUse(t, m, '⟳'); await this.gainFate(t, 1); held = {}; const K = this._kpRaw; P0 = { ...K }; for (const k of ['opening', 'break', 'diversion', 'black', 'hope', 'closing', 'rouse']) { const h = Math.floor((K[k] || 0) / 2); if (h) held[k] = h; } }
    const r = await o.call(this, t, A);
    if (held) { for (const [k, v] of Object.entries(held)) { const cur = this._kpRaw[k] || 0; this._kpRaw[k] = Math.min(P0[k] || 0, cur + v); held[k] = this._kpRaw[k] - cur; } this.say(`Seed of Paradise: ${Object.entries(held).map(([k, v]) => `${k} ${v}`).join(', ')} 남김`, 'good'); }
    return r;
  });
  // ---------- Fear of Heights crit fail ----------
  wrap('c4AfterRoll', async function (o, t, g, A, ...r) { const res = await o.call(this, t, g, A, ...r); if (A && A.critMiss && fated(this, t, 'Fear of Heights') && this.c4Elevated(t)) { this.say(`${t.name}: Fear of Heights — Crit Fail: Knockdown, 공격 종료`, 'bad'); await this.knockdown(t); this.clearPool && this.clearPool(); throw new ChainBreak('Fear of Heights'); } return res; });
  // ---------- reactions ----------
  wrap('c4Reactions', function (o, x, t, card) {
    const out = o.call(this, x, t, card); let m;
    if ((m = this.mn(x, 'Updraft', 2, true)) && !x.onVP && !x.knockdown && !x.offBoard) { const mu = m; out.push({ label: `${x.name}: [Mnemos] Updraft L2 — Hermes Reflex (Hermes Move 1) [소진]`, noFate: true, value: async () => { this.mnUse(x, mu, '⟳'); await this.hermesMove(x, 1, 'Hermes Reflex'); } }); }
    if ((m = this.mn(x, 'Too Big to Fail', 1, true)) && x.float) { const mt = m; out.push({ label: `${x.name}: [Mnemos] Too Big to Fail L1 — Deflate [소진]`, noFate: true, value: async () => { this.mnUse(x, mt, '⟳'); this.deflate(x, 'Too Big to Fail'); } }); }
    return out;
  });
  // ---------- Mnemos free actions ----------
  wrap('mnemosActions', function (o, t) {
    const out = o.call(this, t); let m; const add = (mm, lvl, label, fn, cost = '⟳', fate = 0) => { if (fate > this.fr(t)) return; out.push({ label: `[Mnemos] ${mm.card.name} L${lvl}: ${label}`, noFate: !fate, value: async () => { this.mnUse(t, mm, cost); if (fate) await this.gainFate(t, fate); await fn(); } }); };
    const mid = this.midas ? this.midas(t) : 0;
    if ((m = this.mn(t, 'Peddler of Misery', 2, true)) && mid > 0) add(m, 2, 'Midas 1 버리고 Kratos Pool에 Black 1 (Fate+1)', async () => { await this.loseMidas(t, 1); this.kratosPool.black++; this.say('Kratos Pool: Black +1'); }, '⟳', 1);
    if ((m = this.mn(t, 'Peddler of Misery', 3)) && mid > 0) add(m, 3, `Unholy Alchemy (Midas ${mid} → Ambrosia) + Closing ${mid} (버림)`, async () => { const n = this.midas(t); await this.unholyAlchemy(t); this.kratosPool.closing = (this.kratosPool.closing || 0) + n; this.say(`Kratos Pool: Closing +${n}`); }, 'X');
    if ((m = this.mn(t, 'The Beggar and the Prince', 1, true)) && mid > 0) add(m, 1, 'Midas 1 버림', () => this.loseMidas(t, 1));
    const tw = this.iremTowers ? this.iremTowers() : [];
    if ((m = this.mn(t, 'The Mule', 1, true)) && tw.length) add(m, 1, 'Irem Tower 1칸 이동', () => this.c4mMoveTower(t, 1));
    if ((m = this.mn(t, 'The Mule', 2)) && tw.length) add(m, 2, 'Irem Tower 최대 3칸 이동 (버림)', () => this.c4mMoveTower(t, 3), 'X');
    if ((m = this.mn(t, 'The Mule', 3)) && this.prim && (this.prim.def.cycle || 0) >= 4) add(m, 3, 'Irem Tower를 보드 아무 곳에 배치 (버림)', () => this.c4mPlaceTower(t), 'X');
    if ((m = this.mn(t, 'The Third Wish', 3)) && t.conditions.some(c => c === 'Wishkeen' || c === 'Wishagog')) add(m, 3, 'Wishkeen/Wishagog 버리고 Enriched 또는 Lander (버림)', async () => { const c = t.conditions.find(x => x === 'Wishagog') || 'Wishkeen'; t.conditions = t.conditions.filter(x => x !== c); this.say(`${t.name}: ${c} 버림`, 'good'); const v = await this.ask({ type: 'choice', titan: t, title: '얻을 Condition', options: [{ label: 'Enriched', value: 'Enriched' }, { label: 'Lander', value: 'Lander' }] }); await this.addCondition(t, v || 'Enriched'); }, 'X');
    if ((m = this.mn(t, 'Too Big to Fail', 1, true)) && t.float) add(m, 1, 'Deflate', async () => this.deflate(t, 'Too Big to Fail'));
    if ((m = this.mn(t, 'Updraft', 1, true)) && !t.onVP && !t.knockdown && !t.offBoard && !t.stair) add(m, 1, 'Hermes Move 1', () => this.hermesMove(t, 1, 'Updraft'));
    if ((m = this.mn(t, 'Updraft', 3)) && !t.onVP && !t.knockdown && !t.offBoard && !t.stair) add(m, 3, 'Hermes Move 3 (버림)', () => this.hermesMove(t, 3, 'Updraft'), 'X');
    // Cycle V (partial)
    const adj = this.liveTitans().filter(x => x !== t && this.tDist(t, x) === 1);
    if ((m = this.mn(t, 'Words and Deeds', 1, true)) && adj.some(x => x.conditions.some(c => c === 'Fear' || c === 'Dread'))) add(m, 1, '인접 타이탄의 Fear/Dread를 가져오고 Rage +1 (Fate+1)', async () => { const o2 = await this.pickTitan(t, adj.filter(x => x.conditions.some(c => c === 'Fear' || c === 'Dread'))); if (!o2) return; const c = o2.conditions.find(x => x === 'Dread') || 'Fear'; o2.conditions = o2.conditions.filter(x => x !== c); this.say(`${t.name}: ${o2.name}의 ${c}를 가져옴`); await this.addCondition(t, c); await this.gainRage(t, 1); }, '⟳', 1);
    if ((m = this.mn(t, 'Words and Deeds', 2, true)) && adj.some(x => x.conditions.some(c => c === 'Terror' || c === 'Holy Terror'))) add(m, 2, '인접 타이탄의 Terror/Holy Terror를 가져옴 (Aether 토큰은 Cycle V — 무시) (Fate+1)', async () => { const o2 = await this.pickTitan(t, adj.filter(x => x.conditions.some(c => c === 'Terror' || c === 'Holy Terror'))); if (!o2) return; const c = o2.conditions.find(x => x === 'Holy Terror') || 'Terror'; o2.conditions = o2.conditions.filter(x => x !== c); this.say(`${t.name}: ${o2.name}의 ${c}를 가져옴`); await this.addCondition(t, c); }, '⟳', 1);
    if ((m = this.mn(t, 'Words and Deeds', 3)) && t.conditions.length) add(m, 3, '모든 Condition 카드 버림 (버림)', async () => { this.say(`${t.name}: Condition 전부 버림 (${t.conditions.join(', ')})`, 'good'); t.conditions = []; t.bleeding = 0; t.deathTokens = 0; }, 'X');
    if ((m = this.mn(t, 'Vanishing Point', 2, true)) && this.isAdj(t) && !this.prim.disabled.pushback) add(m, 2, 'Pushback 2 (Fate+1)', () => this.pushbackPrim(t, 2), '⟳', 1);
    if ((m = this.mn(t, 'Dogma', 2)) && t.despair) add(m, 2, '이번 턴 끝까지 Despair 효과 무시 (Fate+1, 버림)', async () => { t._ignoreDespair = true; this.say(`${t.name}: 이번 턴 Despair 무시`); }, 'X', 1);
    return out;
  });
  wrap('despairEff', function (o, t) { return t && t._ignoreDespair ? 0 : o.call(this, t); });
  // ---------- Wish Armor / Wishrod / Wish Deflector ----------
  wrap('wishArmor', async function (o, t, card) {
    if (!(t.conditions.includes('Wishkeen') || t.conditions.includes('Wishagog'))) {
      const a = this.argoAvail('Wish Deflector'); const m = this.mn(t, 'The Third Wish', 1, true);
      const opts = [{ label: '사용 안 함 (장비 Wish Armor 확인으로)', value: null }]; if (a) opts.push({ label: `[Argo] Wish Deflector (charge ${a.charges}) — Wish Armor`, value: 'argo' }); if (m && this.fr(t) >= 2) opts.push({ label: '[Mnemos] The Third Wish L1 — Wish Armor (Fate+2, 소진)', value: 'mn' });
      if (opts.length > 1) { const v = await this.ask({ type: 'choice', titan: t, title: `WISH ATTACK 「${card.name}」 — Argo/Mnemos로 Wish Armor?`, options: opts }); if (v === 'argo') { a.charges--; a.exhausted = true; this.say(`Argo Ability 「Wish Deflector」: ${t.name} Wish Armor`, 'good'); return true; } if (v === 'mn') { this.mnUse(t, m, '⟳'); await this.gainFate(t, 2); this.say(`${t.name}: The Third Wish — Wish Armor`, 'good'); return true; } }
    }
    return o.call(this, t, card);
  });
  wrap('primAttackOn', async function (o, t, card) {
    const wish = card && !this._wishrod && ((card.wish && (this.prim.def.dahakaD || this.prim.def.babelD)) || (card.djinn && card.djinn.wish));
    if (wish && t && t.alive) {
      const cands = this.liveTitans().filter(x => x !== t && !x.offBoard && ((this.mn(x, 'The Third Wish', 2) && this.fr(x) >= 2) || x.gear.some(g => { if (g.discarded) return false; const wm = /(?:^|\. )((?:Ψ|⟳|ⓐ|ⓟ|ⓓ|ⓞ|X|\[charge\])*) ?Wishrod[.,]/.exec(this.gearText(g, x)); return !!wm && this.costOK(x, wm[1], g); })));
      if (cands.length) { const v = await this.ask({ type: 'choice', title: `Wishrod: WISH ATTACK 「${card.name}」의 타겟(${t.name})을 대신 맡을 타이탄? (공격이 Doomed)`, options: [{ label: '안 함', value: null }, ...cands.map(x => ({ label: x.name, value: x }))] });
        if (v) { const m = this.mn(v, 'The Third Wish', 2); if (m && this.fr(v) >= 2) await this.gainFate(v, 2); else { const g = v.gear.find(q => { if (q.discarded) return false; const wm = /(?:^|\. )((?:Ψ|⟳|ⓐ|ⓟ|ⓓ|ⓞ|X|\[charge\])*) ?Wishrod[.,]/.exec(this.gearText(q, v)); return !!wm && this.costOK(v, wm[1], q); }); const mm = /(?:^|\. )((?:Ψ|⟳|ⓐ|ⓟ|ⓓ|ⓞ|X|\[charge\])*) ?Wishrod[.,]/.exec(this.gearText(g, v)); await this.payCost(v, mm[1] || '', g); }
          this.say(`Wishrod: ${v.name}이(가) 대신 타겟이 됨 — Doomed`, 'bad'); this._wishrod = true; try { return await o.call(this, v, { ...card, doomed: true }); } finally { this._wishrod = false; } } }
    }
    return o.call(this, t, card);
  });
  // ---------- Ascent: Ascension Protocols ----------
  wrap('ascentAction', async function (o, t) { const a = this.argoAvail('Ascension Protocols'); if (a && await yn(this, t, `[Argo] Ascension Protocols (charge ${a.charges}): 이번 Ascent Check +3?`)) { a.charges--; a.exhausted = true; this.say('Argo Ability 「Ascension Protocols」: Ascent +3', 'sys'); this.prim.ascentBonus = (this.prim.ascentBonus || 0) + 3; try { return await o.call(this, t); } finally { this.prim.ascentBonus -= 3; } } return o.call(this, t); });
  // ---------- Ropeseller Theorem ----------
  wrap('resolveAIInner', async function (o, card, opts = {}) {
    const a = this.argoAvail('Ropeseller Theorem'); const tl = card && card.target ? (Array.isArray(card.target) ? card.target : ((this.prim.def.targetPresets || {})[card.target] || [])) : []; const single = tl.length && !/Zone|All Titans|Each Titan|Eclipse|2 Titans/.test(tl.join(' ')) && !opts.forcedTarget && !/ZONE|SIMULTANEOUS/.test(card.kind || '');
    if (a && single && this.liveTitans().some(x => this.midas(x) > 0)) {
      const mx = Math.max(...this.liveTitans().map(x => this.midas(x))); const best = this.liveTitans().filter(x => this.midas(x) === mx);
      if (await yn(this, best[0], `[Argo] Ropeseller Theorem (charge ${a.charges}): 「${card.name}」 타겟을 Midas가 가장 많은 타이탄(${best.map(x => x.name).join('/')}, ${mx})으로?`)) { a.charges--; a.exhausted = true; const v = best.length === 1 ? best[0] : (await this.ask({ type: 'choice', title: 'Ropeseller Theorem: 타겟', options: best.map(x => ({ label: x.name, value: x })) })) || best[0]; this.say(`Argo Ability 「Ropeseller Theorem」: 타겟 → ${v.name} (Midas ${mx})`, 'sys'); return o.call(this, card, { ...opts, forcedTarget: v }); }
    }
    return o.call(this, card, opts);
  });
  // ---------- Argo Abilities ----------
  wrap('resolveArgo0', async function (o, name, t) {
    const live = this.liveTitans();
    if (name === 'Archimedean Ballista') { const v = await this.ask({ type: 'choice', titan: t, title: 'Archimedean Ballista', options: [{ label: 'Opening 3', value: 'o' }, { label: 'Fire 2', value: 'f' }] }); if (v === 'f') this.kratosPool.fire += 2; else this.kratosPool.opening += 3; this.say(`Kratos Pool: ${v === 'f' ? 'Fire +2' : 'Opening +3'}`); return; }
    if (name === 'Curse Resistor') { const o2 = await this.pickTitan(t, live.filter(x => x.conditions.length)); if (!o2) return; const a = this.argoCard('Curse Resistor'); const opts = o2.conditions.filter(c => FLIP[c]).map(c => ({ label: `뒤집기: ${c} → ${FLIP[c]} (charge 1)`, value: { c, flip: true } })); if (a && a.charges >= 1) opts.push(...o2.conditions.map(c => ({ label: `버리기: ${c} (charge 1 추가)`, value: { c, flip: false } }))); if (!opts.length) { this.say(`Curse Resistor: ${o2.name}에게 뒤집거나 버릴 수 있는 Condition 없음`); return; } const v = await this.ask({ type: 'choice', titan: t, title: 'Curse Resistor', options: opts }); if (!v) return; if (v.flip) { o2.conditions = o2.conditions.map(c => c === v.c ? FLIP[c] : c); this.say(`Curse Resistor: ${o2.name}의 ${v.c} → ${FLIP[v.c]}`, 'good'); } else { a.charges--; o2.conditions = o2.conditions.filter(c => c !== v.c); if (v.c === 'Bleeding') o2.bleeding = 0; if (v.c === 'Death') o2.deathTokens = 0; this.say(`Curse Resistor: ${o2.name}의 ${v.c} 버림 (charge 2)`, 'good'); } return; }
    if (name === 'Dahaka Phasing') { const o2 = await this.pickTitan(t, live.filter(x => !x.offBoard && !x.onVP && !x.stair && !x.knockdown)); if (o2) await this.hermesMove(o2, 1, 'Dahaka Phasing'); return; }
    if (name === 'Gold Transmogrifier') { const o2 = await this.pickTitan(t, live.filter(x => this.midas(x) > 0)); if (!o2) { this.say('(Midas 토큰이 있는 타이탄 없음)'); return; } const res = this.rollPower(['b', 'b']); const n = res.reduce((s, r) => s + facePower(r.face), 0); const k = Math.min(n, this.midas(o2)); this.say(`Gold Transmogrifier: 검정 Power die 2개 → Power ${n} — ${o2.name} Midas ${k} → Ambrosia`, 'good'); if (k) { await this.loseMidas(o2, k); await this.gainAmbrosia(o2, k); } return; }
    if (name === 'Irem Protocols') { await this.c4mMoveTower(t, 99, true); return; }
    if (name === 'Cloud Support Fleet') { await this.triremeMove(t); return; }
    return o.call(this, name, t);
  });
  wrap('argoActions', function (o, t, reactionOnly = false) {
    const out = o.call(this, t, reactionOnly).filter(x => !/Cloud Support Fleet/.test(x.label) || !this.trireme || this.trireme.movedRound !== this.round);
    const T = this.trireme; if (!reactionOnly && T && T.pos && !T.spent && t && !t.offBoard && !t.onVP && !t.stair && Board.dist(t.pos, T.pos) <= 1) out.push({ label: `[Argo] Cirrotrireme Rearm: 토큰을 뒤집고 Armory 무기 1개 장착`, noFate: true, value: async () => { T.spent = true; this.say('Cirrotrireme: Rearm (토큰 소모)', 'sys'); await this.quantumArmory(t); } });
    return out;
  });
  wrap('primStep', async function (o, na, ...r) { const T = this.trireme; if (T && T.pos && this.primCells(na).some(p => p.c === T.pos.c && p.r === T.pos.r)) { this.board.terrain.delete(key(T.pos.c, T.pos.r)); if (T.under) this.board.terrain.set(key(T.pos.c, T.pos.r), T.under); this.trireme = null; this.say('Primordial이 Cirrotrireme 위로 — 토큰 파괴 (이번 전투 사용 불가)', 'bad'); for (const a of this.argo || []) if (a.card.name === 'Cloud Support Fleet') a.charges = 0; this.notify(); } return o.call(this, na, ...r); });


  // ---------- Cycle IV loot & godforms (2026-10-20) ----------
  wrap('ab', function (o, t, n) { return o.call(this, t, n) || !!(t && t.godform && t.godform.def.abilities && t.godform.def.abilities[n] && n === 'Fly'); });
  wrap('addCondition', async function (o, t, name, opts = {}) {
    if (t && name === 'Fear' && t.gear.some(g => !g.discarded && g.card.name === 'Dahaka Mask')) { this.say(`${t.name}: Dahaka Mask — Fear 면역`); return; }
    return o.call(this, t, name, opts);
  });
  wrap('usableWeapons', function (o, t, ...a) { if (t) this.c4lFlips(t); return o.call(this, t, ...a); });
  wrap('evasionRoll', async function (o, t, ...a) { if (t) this.c4lTiers(t); return o.call(this, t, ...a); });
  wrap('primAttackOn', async function (o, t, card) {
    const r = await o.call(this, t, card);
    const wish = card && ((card.wish && !this.prim.disabled.wishAtk) || (card.djinn && card.djinn.wish));
    if (wish && t && t.alive) for (const g of t.gear) if (!g.discarded && g.card.chargeTiers) { const lv = typeof card.tier === 'number' ? card.tier : (card.aiTier || 0); g.charges = (g.charges || 0) + 1 + lv; this.say(`${g.card.name}: Wish Attack 해결 — charge +${1 + lv} → ${g.charges}`); this.c4lTiers(t); }
    return r;
  });
  Object.assign(P, {
    async unearthly(card, tg) { // Aphrodite: after a singular Target is chosen, may become the Target instead
      if (!tg || !card || /ZONE|SIMULTANEOUS|ROUTINE|CURSE/.test(card.kind || '')) return tg;
      const ap = this.liveTitans().find(x => x !== tg && x.godform && x.godform.def.name === 'Aphrodite' && x.godform.trespass > 0 && !x.offBoard && this.fr(x) > 0); if (!ap) return tg;
      if (!(await yn(this, ap, `Unearthly Beauty (Aphrodite): 「${card.name}」의 타겟 ${tg.name} → ${ap.name}(으)로 바꾸기? (Fate+1, Trespass −1)`))) return tg;
      await this.gainFate(ap, 1); ap.godform.trespass--; this.say(`${ap.name}: Unearthly Beauty — 타겟을 자신으로`, 'good'); return ap; },
    c4lTiers(t) { for (const g of t.gear) { const T = g.card.chargeTiers; if (!T || g.discarded) continue; const k = Object.keys(T).map(Number).filter(x => x <= (g.charges || 0)).sort((a, b) => b - a)[0]; const st = T[String(k)]; if (st && (g._tier !== k)) { g._tier = k; g.card = { ...g.card, ...st }; this.say(`${g.card.name}: charge ${g.charges} — Power ${st.power.join('')}, Evasion Re-roll ${st.evasionReroll}`); } } },
    c4lFlips(t) { for (const g of t.gear) { const f = g.card.autoFlip; if (!f || g.discarded || !g.alt) continue; const z = !t.onVP && !t.offBoard && this.board.terrainAt(t.pos.c, t.pos.r); const on = !!((z && z.cloud) || this.inBlindspot(t)); if ((f === 'cloudBlind' && on) || (f === 'notCloudBlind' && !on)) { this.transformGear(t, g); this.say(`${t.name}: ${g.card.name}로 뒤집힘 (${on ? 'Cloud/Blindspot' : 'Cloud/Blindspot 벗어남'})`); } } },
    async dionysusRoll(t) { const r = this.rng.d10(); const [dice, ev] = r <= 3 ? [['r'], 3] : r <= 5 ? [['b'], 2] : r <= 7 ? [['r', 'r'], 1] : r <= 9 ? [['w'], 0] : [['w', 'w'], -1]; t.godform.def = { ...t.godform.def, powerDie: dice[0], powerDieList: dice, evasion: ev, precision: 0 }; this.say(`${t.name}: Drunken Enlightenment d10=${r} — Power die ${dice.map(x => ({ r: '빨강', b: '검정', w: '흰색', m: '회색(Mortal)' })[x]).join('+')}, Evasion ${ev >= 0 ? '+' : ''}${ev}`, 'good'); },
    argoCard(name) { return (this.argo || []).find(a => a.card.name === name) || null; },
    c4Elevated(t) { if (!t || t.offBoard) return false; if (t.onVP) return true; const z = this.board.terrainAt(t.pos.c, t.pos.r); return !!(z && z.elevated); },
    async c4mMoveTower(t, max, straight = false) {
      const tw = this.iremTowers().filter(x => !this.titanAt(x.cell.c, x.cell.r)); if (!tw.length) { this.say('(움직일 수 있는 빈 Irem Tower 없음)'); return; }
      const pick = tw.length === 1 ? tw[0] : await this.ask({ type: 'choice', titan: t, title: `움직일 Irem Tower (최대 ${max === 99 ? '무제한' : max}칸${straight ? ', 직선' : ''})`, options: tw.map(x => ({ label: cellLabel(x.cell), value: x })) }); if (!pick) return;
      const ok = q => this.board.inBounds(q.c, q.r) && !this.board.terrainAt(q.c, q.r) && !this.primContains(q) && !this.titanAt(q.c, q.r);
      const cells = []; if (straight) { for (const d of DIR_LIST) { let q = { ...pick.cell }; for (let i = 0; i < max; i++) { q = { c: q.c + DIRS[d][0], r: q.r + DIRS[d][1] }; if (!ok(q)) break; cells.push(q); } } }
      else { const seen = new Set([key(pick.cell.c, pick.cell.r)]); let fr = [pick.cell]; for (let i = 0; i < max; i++) { const nx = []; for (const p of fr) for (const d of DIR_LIST) { const q = { c: p.c + DIRS[d][0], r: p.r + DIRS[d][1] }; const k = key(q.c, q.r); if (seen.has(k) || !ok(q)) continue; seen.add(k); nx.push(q); cells.push(q); } fr = nx; } }
      if (!cells.length) { this.say('(갈 곳 없음)'); return; }
      const dest = (await this.ask({ type: 'move', titan: t, title: `Irem Tower ${cellLabel(pick.cell)} → 목적지`, cells, options: cells.map(q => ({ label: cellLabel(q), value: q })) })) || cells[0];
      this.board.removeTerrainId(pick.id); this.board.addTerrain([cellLabel(dest)], { ...pick, cell: undefined }); this.say(`Irem Tower ${cellLabel(pick.cell)} → ${cellLabel(dest)}`, 'good'); this.notify();
    },
    async c4mPlaceTower(t) {
      const cells = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const q = { c, r }; if (!this.board.terrainAt(c, r) && !this.primContains(q) && !this.titanAt(c, r)) cells.push(q); }
      if (!cells.length) return; const dest = (await this.ask({ type: 'move', titan: t, title: 'The Mule L3: Irem Tower를 놓을 칸', cells, options: cells.slice(0, 40).map(q => ({ label: cellLabel(q), value: q })) })) || cells[0];
      this._muleN = (this._muleN || 0) + 1; this.board.addTerrain([cellLabel(dest)], { id: 'mule' + this._muleN, type: 'Irem Tower', irem: 'tower', obstacle: true, obscuring: true, destructible: false, elevated: true, shifting: true, climb: 4 }); this.say(`Irem Tower 배치 → ${cellLabel(dest)}`, 'good'); this.notify();
    },
    async triremeMove(t, sub = false) {
      const T = this.trireme || (this.trireme = { pos: null, spent: false, movedRound: -1, sub }); T.movedRound = this.round; const NM = T.sub ? 'Subreme' : 'Cirrotrireme';
      const edgeAdj = q => q.c === 1 || q.r === 1 || q.c === this.board.cols || q.r === this.board.rows;
      const cells = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const q = { c, r }; if (this.primContains(q)) continue; const z = this.board.terrainAt(c, r); if (z && z.obstacle) continue;
        if (T.sub) { const near = T.pos ? Math.abs(T.pos.c - c) + Math.abs(T.pos.r - r) <= 5 : [...Array(this.board.cols)].some((_, i) => [...Array(this.board.rows)].some((__, j) => edgeAdj({ c: i + 1, r: j + 1 }) && Math.abs(i + 1 - c) + Math.abs(j + 1 - r) <= 5)); if (!near) continue; }
        cells.push(q); }
      const opts = [...(T.pos && !this.titanAt(T.pos.c, T.pos.r) ? [{ label: 'Argo Ability 카드로 회수', value: 'home' }] : [])];
      const dest = await this.ask({ type: 'move', titan: t, title: `${NM}${T.spent ? ' (소모됨)' : ''}: 옮길 칸${T.sub ? ' (보드 끝 옆 칸에 놓고 / 놓인 곳에서 최대 5칸)' : ' (타이탄이 있으면 함께 이동)'}`, cells, options: [...opts, ...cells.slice(0, 40).map(q => ({ label: cellLabel(q), value: q }))] });
      const rider = T.pos && !T.sub ? this.titanAt(T.pos.c, T.pos.r) : null;
      if (T.pos) { this.board.terrain.delete(key(T.pos.c, T.pos.r)); if (T.under) this.board.terrain.set(key(T.pos.c, T.pos.r), T.under); }
      if (dest === 'home' || !dest) { T.pos = null; T.under = null; this.say(`${NM}: 카드로 회수`); this.notify(); return; }
      T.under = this.board.terrainAt(dest.c, dest.r); T.pos = { ...dest };
      this.board.terrain.set(key(dest.c, dest.r), T.sub ? { id: 'trireme', type: 'Subreme', obstacle: false, obscuring: false, destructible: false, indestructible: true, light: 2, cell: dest } : { id: 'trireme', type: 'Cirrotrireme', obstacle: false, obscuring: false, elevated: true, shifting: true, destructible: false, indestructible: true, cell: dest });
      const occ = this.titanAt(dest.c, dest.r);
      if (rider && rider.alive) { rider.pos = { ...dest }; this.say(`${rider.name}: Cirrotrireme와 함께 이동`); }
      this.say(`${NM} → ${cellLabel(dest)}${occ && occ !== rider ? ` (${occ.name} 위)` : ''}`, 'sys'); this.notify();
    },
    async c4mTurnStart(t) { for (const x of this.titans) for (const g of x.gear) this.hookExhaust(x, g); t._moveSteps = 0; t._hermesUsed = 0; t._hermesAvail = this.hermesX ? this.hermesX(t) > 0 : false; this.c4lTiers(t); this.c4lFlips(t); if (t.godform && t.godform.def.name === 'Dionysus') await this.dionysusRoll(t); if (t.gear.some(g => !g.discarded && g.card.name === 'Dahaka Mask')) { this.say(`${t.name}: Dahaka Mask — Ambrosia +1`); await this.gainAmbrosia(t, 1); if (!t.alive) return; } if (fated(this, t, 'Depressed')) { this.say(`${t.name}: Depressed — Despair +1`, 'bad'); await this.gainDespair(t, 1); } t._moveSteps = 0; t._hermesUsed = 0; },
    async c4mTurnEnd(t) {
      t._ignoreDespair = false; t._vaultTurn = false;
      if (t._postpone) { t._postpone--; if (t._postpone <= 0) { this.say(`${t.name}: The Thousandth Night — 미뤘던 죽음`, 'bad'); t._postpone = 0; await this.kill(t, { final: true, noCastoff: true }); return; } }
      const hermesLeft = t._hermesAvail && !(t._hermesUsed > 0) && this.hermesX(t) > 0; if (t.alive && fated(this, t, 'Thrice-Cursed') && !t.offBoard && ((t._moveSteps || 0) < this.speedOf(t) || hermesLeft)) { this.say(`${t.name}: Thrice-Cursed — 이번 턴 ${hermesLeft ? 'Hermes Move를 다 쓰지 않음' : `Speed만큼 움직이지 않음 (${t._moveSteps || 0}/${this.speedOf(t)})`}, Fate +1`, 'bad'); await this.gainFate(t, 1, { nc: true }); }
    },
  });
}
