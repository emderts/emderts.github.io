// Cycle V Titans, part 2 (Immortal Truthbearer, Helldiver, Feareater, Executioner, Trespasser)
// + Cycle V Pain tokens (Rage threshold), Truth X / AI Suppress / Pull X on the Kratos Table.
import { kw, cellLabel } from './core.js';

export function installC5Titans2(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const yn = (g, t, title) => g.ask({ type: 'yn', titan: t, title, options: [{ label: '사용', value: true }, { label: '패스', value: false }] });
  // stacking Generic-token tracks on the Titan sheet
  const TRACK = {
    'Fear is the Mind Killer': ['+1 Precision', '+1 Speed', 'Defy 1', '+1 Power'],
    'Pain Engine': ['+1 Speed', 'Movement action 대각선 이동', 'Power die → White', 'Auto-rouse 1', 'Deadly'],
    'To Dark We Will at Last Return': ['+1 Precision', 'Stalwart', 'Tireless', 'Rocksteady'],
  };

  Object.assign(P, {
    stackAb(t) { return t ? (Object.keys(TRACK).find(n => this.ab(t, n)) || null) : null; },
    stackN(t) { return this.stackAb(t) ? (t.stackTok || 0) : 0; },
    stackBenefits(t) { const a = this.stackAb(t); if (!a) return []; return TRACK[a].slice(0, Math.min(TRACK[a].length, t.stackTok || 0)); },
    async stackGain(t, n, why) {
      const a = this.stackAb(t); if (!a || !t.alive || n <= 0) return;
      const before = t.stackTok || 0; t.stackTok = before + n;
      const now = TRACK[a].slice(before, Math.min(TRACK[a].length, t.stackTok));
      this.say(`${t.name}: ${a} — Generic 토큰 +${n} (${why}) → ${t.stackTok}${now.length ? ` · 새 효과: ${now.join(', ')}` : ''}`, a === 'Fear is the Mind Killer' && t.stackTok >= 5 ? 'bad' : 'good');
      if (a === 'Fear is the Mind Killer' && t.stackTok >= 5) { this.say(`${t.name}: Fear is the Mind Killer — Generic 토큰 5개 — 즉사`, 'bad'); await this.kill(t); }
    },
    stackKW(t, name) {
      const a = this.stackAb(t); const n = (t && t.stackTok) || 0; if (!a || !n) return 0;
      if (a === 'Fear is the Mind Killer' && name === 'Defy' && n >= 3) return 1;
      if (a === 'Pain Engine') { if (name === 'Auto-rouse' && n >= 4) return 1; if (name === 'Deadly' && n >= 5) return true; }
      if (a === 'To Dark We Will at Last Return') { if (name === 'Stalwart' && n >= 2) return true; if (name === 'Tireless' && n >= 3) return true; if (name === 'Rocksteady' && n >= 4) return true; }
      return 0;
    },
    titanDie(t) { if (this.ab(t, 'Pain Engine') && (t.stackTok || 0) >= 3) return 'w'; return t.def.powerDie || 'r'; },
    // Pain tokens: each lowers the Rage death threshold by 1 (Pain Resilience X ignores X)
    rageCap(t) { const res = (+this.inh(t, 'Pain Resilience') || 0) + (this.gearKWSum ? this.gearKWSum(t, 'Pain Resilience') : 0); return 9 - Math.max(0, (t.pain || 0) - res); },
    async gainPain(t, n, why = '') {
      if (!t || !t.alive || n <= 0) return;
      t.pain = (t.pain || 0) + n; this.say(`${t.name}: Pain +${n}${why ? ` (${why})` : ''} → ${t.pain} (Rage 한계 ${this.rageCap(t)})`, 'bad');
      if (this.ab(t, 'Pain Engine')) await this.stackGain(t, n, 'Pain');
      if (t.alive && t.rage > this.rageCap(t) && !t.rageDoom) { t.rageDoom = true; this.say(`${t.name}: Rage ${t.rage}가 Pain 한계 ${this.rageCap(t)}를 넘음 — 현재 액션 후 분노에 삼켜져 사망합니다!`, 'bad'); }
    },
    // Kratos: Truth X — X tokens, each Break / Opening / Fire / Closing / Black
    async c5Truth(t, n) {
      const K = ['break', 'opening', 'fire', 'closing', 'black']; const L = { break: 'Break', opening: 'Opening', fire: 'Fire', closing: 'Closing', black: 'Black' };
      for (let i = 0; i < n; i++) { const k = await this.ask({ type: 'choice', titan: t, title: `Truth ${n}: Kratos Pool에 놓을 토큰 ${i + 1}/${n}`, options: K.map(x => ({ label: L[x], value: x })) }) || 'break'; this.kratosPool[k] = (this.kratosPool[k] || 0) + 1; this.say(`Truth: Kratos Pool ← ${L[k]} 1`); }
    },
  });

  wrap('inh', function (o, t, n) { const v = o.call(this, t, n); const d = this.stackKW(t, n); if (!d) return v; if (d === true) return v || true; return (v === true ? 0 : (v || 0)) + d; });
  wrap('hasKW', function (o, t, n, f) { const v = o.call(this, t, n, f); if (v !== null && v !== undefined) return v; const d = this.stackKW(t, n); return d ? (d === true ? 0 : d) : v; });
  wrap('precisionMods', function (o, t, ...r) { let p = o.call(this, t, ...r); const a = this.stackAb(t); if ((a === 'Fear is the Mind Killer' || a === 'To Dark We Will at Last Return') && (t.stackTok || 0) >= 1) p += 1; return p; });
  wrap('speedOf0', function (o, t) { let s = o.call(this, t); const a = this.stackAb(t); const n = t.stackTok || 0; if ((a === 'Fear is the Mind Killer' && n >= 2) || (a === 'Pain Engine' && n >= 1)) s += 1; return s; });
  if (P.c5Power) wrap('c5Power', async function (o, t, g, A) { await o.call(this, t, g, A); if (this.stackAb(t) === 'Fear is the Mind Killer' && (t.stackTok || 0) >= 4) { A.raw += 1; this.say(`${t.name}: Fear is the Mind Killer (4) — +1 Power`); } });

  // Feareater: Born in the Dark (immune to Fear / Dread / Despair) — each would-be gain still feeds Fear is the Mind Killer
  wrap('addCondition', async function (o, t, name, opts = {}) {
    if (t && t.alive && (name === 'Fear' || name === 'Dread') && this.ab(t, 'Born in the Dark')) { this.say(`${t.name}: Born in the Dark — ${name} 면역`); await this.stackGain(t, 1, name); return; }
    return o.call(this, t, name, opts);
  });
  wrap('gainDespair', async function (o, t, n, ...r) {
    if (t && t.alive && n > 0 && this.ab(t, 'Born in the Dark')) { this.say(`${t.name}: Born in the Dark — Despair 면역`); await this.stackGain(t, n, 'Despair'); return; }
    return o.call(this, t, n, ...r);
  });
  // Trespasser: each Ambrosia token gained feeds To Dark We Will at Last Return
  wrap('gainAmbrosia', async function (o, t, n, ...r) {
    const b = t ? (t.ambrosia || 0) : 0; const res = await o.call(this, t, n, ...r);
    if (t && t.alive && this.ab(t, 'To Dark We Will at Last Return')) { const d = (t.ambrosia || 0) - b; if (d > 0) await this.stackGain(t, d, 'Ambrosia'); }
    return res;
  });
  // Silver Strain: Oxygen token (the Oxygen rules only run in Cycle V Primordial battles)
  wrap('startOfBattle', async function (o, ...a) {
    for (const t of this.titans) if (t.alive && this.ab(t, 'Silver Strain')) { t.oxygen = (t.oxygen || 0) + 1; this.say(`${t.name}: Silver Strain — Oxygen 토큰 1 (비용으로 사용 가능 · 뒤집기/사망 규칙은 Cycle V 프라이모디얼 전투에서만)`, 'sys'); }
    return o.call(this, ...a);
  });

  // Kratos Table: Truth X, AI Suppress, Pull X
  wrap('ktStageOf', function (o, k) { if (/^Pull \d/.test(k)) return 'first'; return o.call(this, k); });
  wrap('kratosEffects', function (o, t, choices) {
    const eff = o.call(this, t, choices); eff.truth = 0; eff.aiSuppress = false; eff.pull = 0;
    for (const row of this.kratosRows(t)) { if (row.options.length >= 2 && choices[row.level] === undefined) continue; const opt = row.options.length >= 2 ? row.options[choices[row.level]] : row.options[0]; for (const k of opt || []) { let m; if ((m = /^Truth (\d)/.exec(k))) eff.truth += +m[1]; else if (/^AI Suppress/.test(k)) eff.aiSuppress = true; else if ((m = /^Pull (\d)/.exec(k))) eff.pull += +m[1]; } }
    return eff;
  });
  wrap('secondWindow', async function (o, t, A, kt, ...r) {
    const res = await o.call(this, t, A, kt, ...r);
    if (t && t.alive && kt && kt.truth) await this.c5Truth(t, kt.truth);
    if (t && t.alive && kt && kt.aiSuppress && A && A.wound) { if (this.ai.discard.length) { this.ai.shuffleDiscardIn(); this.say('Kratos: AI Suppress — AI 버림 더미를 AI 덱에 섞음', 'good'); } else this.say('Kratos: AI Suppress — AI 버림 더미가 비어 있음'); }
    return res;
  });
  if (P.c5KratosWindow) wrap('c5KratosWindow', async function (o, t, A, kt, win) {
    await o.call(this, t, A, kt, win);
    if (!t || !t.alive || !kt || !A || !kt.pull || A.c5pull || t.onVP || t.offBoard || t.stair) return;
    if (this.isAdj(t) && win === 1) { /* already adjacent — still allowed (the Pull pushes you away), ask */ }
    if (await yn(this, t, `Kratos: Pull ${kt.pull} (${win === 1 ? '1st' : '2nd'} 윈도우) — ${this.prim.name}을(를) 끌어올까요?${win === 1 ? ' (안 쓰면 2nd 윈도우에 다시 물음)' : ''}`)) { A.c5pull = true; await this.pullPrim(t, kt.pull); }
  });
  // ---------- Cycle V Argo Abilities (Technology) ----------
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  Object.assign(P, {
    // Truth Machine: reveal the Titan's next Obol now; the next Obol draw resolves that card
    truthMachineCard(t) { const D = this.data.decks.obol; const deck = [...this.obolBase, ...(this.obolExtra || []).map(c => D.find(o => o.code === c)), ...(t.godform ? [this.data.decks.secret.obol_you_live_tenacity || D.find(o => o.code === 'AM0356')] : [])].filter(Boolean); return this.rng.pick(deck); },
    async innerLight(t, why) {
      if (!t || !t.alive || !(await this.argoHook('Inner Light', `${t.name}이(가) ${why}(으)로 죽기 직전 — 대신 Grave Trauma를 뽑기?`, t))) return false;
      this.say(`[Argo] Inner Light: ${t.name} — ${why} 대신 Grave Trauma`, 'good'); this._innerLightDepth = (this._innerLightDepth || 0) + 1;
      try { await this.traumaDraw(t, t.danger, 'Grave'); } finally { this._innerLightDepth--; } return true;
    },
    async anchorDropPod(t) {
      const a = this.argoAvail('Anchor Drop Pod'); if (!a || this.round > 1 || t.alive || t.erased) return false;
      const ok = await this.ask({ type: 'yn', titan: this.liveTitans()[0] || null, title: `[Argo] Anchor Drop Pod (charge ${a.charges}): 죽은 ${t.name} 대신 새 타이탄을 투하할까요? (같은 Argonaut·로드아웃, 타이탄 시트만 교체)`, options: [{ label: '투하', value: true }, { label: '패스', value: false }] }); if (!ok) return false;
      a.charges--; a.exhausted = true; const C = this.data.titans.classes;
      const cls = await this.ask({ type: 'choice', title: 'Anchor Drop Pod: 새 타이탄 시트', options: Object.keys(C).filter(k => C[k].kratos).map(k => ({ label: C[k].name + (k === t.cls ? ' (같은 시트)' : ''), value: k })) }) || t.cls;
      t.cls = cls; t.def = C[cls]; t.speed = t.def.speed; const T0 = t._tri0 || { rage: 0, danger: 0, fate: 0 };
      Object.assign(t, { alive: true, rage: T0.rage, danger: T0.danger, fate: T0.fate, rageDoom: false, knockdown: null, conditions: [], despair: 0, ambrosia: 0, bleeding: 0, pain: 0, stackTok: 0, genTok: 0, deathTokens: 0, onVP: false, stair: null, offBoard: null, pendingObol: false, impaled: false, absorbed: false, floating: false, oxygen: 0 });
      t.tokens = Object.fromEntries(Object.keys(t.tokens || {}).map(k => [k, 0]));
      const free = []; for (let c = 1; c <= this.board.cols; c++) for (let r = 1; r <= this.board.rows; r++) { const q = { c, r }; if (!this.titanAt(c, r) || this.titanAt(c, r) === t) free.push(q); }
      const want = await this.ask({ type: 'move', titan: t, title: 'Anchor Drop Pod: 투하할 칸 (d10 1-5: 무작위 방향 3칸 빗나감)', cells: free, options: free.slice(0, 40).map(q => ({ label: cellLabel(q), value: q })) }) || free[0];
      const r = this.rng.d10(); this.flash && this.flash('d10', { title: 'Anchor Drop Pod', v: r });
      let land = { ...want }; if (r <= 5) { const [dx, dy] = this.rng.pick(DIRS4); land = { c: Math.min(this.board.cols, Math.max(1, want.c + 3 * dx)), r: Math.min(this.board.rows, Math.max(1, want.r + 3 * dy)) }; }
      this.say(`[Argo] Anchor Drop Pod: d10=${r} — ${r <= 5 ? `빗나가 ${cellLabel(land)}` : `${cellLabel(land)}에 정확히`} 착지 · 새 시트 ${t.def.name}`, 'good');
      if (this.primContains(land)) { this.kratosPool.closing = (this.kratosPool.closing || 0) + 2; this.kratosPool.hope = (this.kratosPool.hope || 0) + 1; this.say('Anchor Drop Pod: Primordial 위에 착지 — Kratos Pool에 Closing 2, Hope 1', 'good'); const adj = []; for (const p of this.primCells()) for (const [dx, dy] of DIRS4) { const q = { c: p.c + dx, r: p.r + dy }; if (this.freeCell(q) && !adj.some(z => z.c === q.c && z.r === q.r)) adj.push(q); } land = adj.length ? (adj.length === 1 ? adj[0] : await this.ask({ type: 'move', titan: t, title: 'Anchor Drop Pod: Primordial에 인접한 칸', cells: adj, options: adj.map(q => ({ label: cellLabel(q), value: q })) }) || adj[0]) : land; }
      else if (this.titanAt(land.c, land.r) && this.titanAt(land.c, land.r) !== t) land = this.nearestFree(land, t) || land;
      t.pos = { ...land }; if (!this.ptHolder()) t.pt = true; this.notify(); return true;
    },
  });
  wrap('obolDraw', async function (o, t, ...r) {
    if (t && t.alive && t.truthObol && !t.pendingObol) { const card = t.truthObol; t.truthObol = null; this.say(`${t.name}: Truth Machine — 미리 본 Obol 「${card.name}」을(를) 해결`, card.result === 'live' ? 'good' : 'bad'); const keep = this.obolBase, ex = this.obolExtra; this.obolBase = [card]; this.obolExtra = []; try { return await o.call(this, t, 10, 0); } finally { this.obolBase = keep; this.obolExtra = ex; } }
    return o.call(this, t, ...r);
  });
  wrap('cardAwaken', async function (o, t, c) {
    if (c && c.code === 'EN2590') { this.say(`${t.name}: Autodestructive Awakening — 각성 후 Pain 3 (전투 후 사망 — 캠페인)`, 'bad'); try { if (this.awk && t.alive && !this.wentBeyond(t) && (t.godform || this.godformChoices().length)) await this.awaken(t); } finally { if (t.alive) await this.gainPain(t, 3, 'Autodestructive Awakening'); } return; }
    if (c && c.code === 'EO2591') { const had = t.godform; try { await o.call(this, t, c); } finally { if (t.alive && t.godform && t.godform !== had) { t.fate = 0; this.say(`${t.name}: Defiant Awakening — Fate 0`, 'sys'); } } return; }
    return o.call(this, t, c);
  });
  wrap('mazeyFear', async function (o, t) { if (await o.call(this, t)) return true; return this.innerLight(t, 'Fear/Dread'); });
  wrap('kill', async function (o, t, opts = {}) {
    try { await o.call(this, t, opts); } catch (e) { if (e instanceof BattleOver && e.result === 'defeat' && !t.alive && this.argoAvail('Anchor Drop Pod') && this.round <= 1) { if (await this.anchorDropPod(t)) return; } if (e instanceof TitanDied && e.titan === t && !t.alive && this.argoAvail('Anchor Drop Pod') && this.round <= 1) await this.anchorDropPod(t); throw e; }
    if (t && !t.alive && this.argoAvail('Anchor Drop Pod') && this.round <= 1) await this.anchorDropPod(t);
  });
  wrap('rageCap', function (o, t) { if (t && t.painIgnore === this.round) return 9; return o.call(this, t); });
  wrap('gainPain', async function (o, t, n, why) { if (t && t.alive && n > 1 && await this.argoHook('Painkiller Shot', `${t.name}: Pain +${n} → 1로 낮추기?`, t)) { n = 1; } return o.call(this, t, n, why); });
  wrap('bleedGain', async function (o, t, n) { const r = await o.call(this, t, n); if (t && t.alive && r > 1 && await this.argoHook('Painkiller Shot', `${t.name}: Bleeding +${r} → 1로 낮추기?`, t)) { return 1; } return r; });
  wrap('resolveArgo0', async function (o, name, t) {
    const live = this.liveTitans();
    if (name === 'Calculate Statistical Certainty') { const x = await this.pickTitan(t, live.filter(y => !y.truthObol)); if (!x) return; const c = this.truthMachineCard(x); x.truthObol = c; this.say(`[Argo] Truth Machine: ${x.name}의 다음 Obol은 「${c.name}」`, c.result === 'live' ? 'good' : 'bad'); this.flash && this.flash('card', { kind: 'OBOL (Truth Machine)', titan: x.name, name: c.name, text: c.text || '', cls: c.result === 'live' ? 'good' : 'obol' }); return; }
    if (name === 'Triskelion Override') { const x = await this.pickTitan(t, live.filter(y => !y.offBoard)); if (!x) return; const v = await this.ask({ type: 'choice', titan: x, title: `Triskelion Override: ${x.name} — Pain 3을 얻고 어떤 액션?`, options: [{ label: 'Movement 액션', value: 'move' }, { label: 'Combat 액션', value: 'combat' }] }); if (!v) return; await this.gainPain(x, 3, 'Triskelion Override'); if (!x.alive) return; if (v === 'move') await this.moveActionNow(x, 'Triskelion Override'); else await this.combatActionNow(x, 'Triskelion Override'); if (x.alive) { const fv = await this.ask({ type: 'choice', titan: x, title: `Triskelion Override: ${x.name} — 받을 Fatigue 토큰 (방금 한 액션과 무관하게 선택)`, options: [{ label: 'Movement Fatigue', value: 'move' }, { label: 'Combat Fatigue', value: 'combat' }] }) || v; x.fatigue = fv; this.say(`${x.name}: ${fv === 'move' ? 'Movement' : 'Combat'} Fatigue 토큰`, 'bad'); } return; }
    if (name === 'Painkiller Shot') { const x = await this.pickTitan(t, live.filter(y => y.pain > 0)); if (!x) { this.say('(Pain 토큰이 있는 타이탄 없음)'); return; } x.painIgnore = this.round; this.say(`[Argo] Painkiller Shot: ${x.name} — 이번 라운드 Pain 토큰 무시 (Rage 한계 9)`, 'good'); return; }
    if (name === 'Drag It Back!') { if (!live.length) return; const d = Math.min(...live.filter(x => !x.offBoard && !x.onVP).map(x => this.distTo(x))); const c = live.filter(x => !x.offBoard && !x.onVP && this.distTo(x) === d); const x = c.length === 1 ? c[0] : await this.pickTitan(t, c); if (!x) return; const v = await this.ask({ type: 'choice', titan: x, title: `Drag It Back!: ${x.name} — Pushback 또는 Pull (최대 3)`, options: [1, 2, 3].flatMap(n => [{ label: `Pushback ${n}`, value: 'b' + n }, { label: `Pull ${n}`, value: 'l' + n }]) }); if (!v) return; const n = +v.slice(1); if (v[0] === 'l') await this.pullPrim(x, n); else if (this.isAdj(x)) await this.pushbackPrim(x, n); else this.say(`${x.name}: 인접하지 않아 Pushback 불가`); return; }
    if (name === 'Soulbalm') { const x = await this.pickTitan(t, live.filter(y => y.despair > 0 || y.conditions.some(c => c === 'Fear' || c === 'Terror'))); if (!x) { this.say('(대상 없음)'); return; } const opts = [...(x.despair ? [{ label: `Despair 토큰 ${x.despair}개 모두 버림`, value: 'd' }] : []), ...x.conditions.filter(c => c === 'Fear' || c === 'Terror').map(c => ({ label: `${c} Condition 버림`, value: c }))]; const v = opts.length === 1 ? opts[0].value : await this.ask({ type: 'choice', titan: x, title: 'Soulbalm', options: opts }); if (v === 'd') { x.despair = 0; this.say(`${x.name}: Despair 모두 버림`, 'good'); } else if (v) { x.conditions = x.conditions.filter(c => c !== v); this.say(`${x.name}: ${v} 버림`, 'good'); } return; }
    if (name === 'Underwater Support Fleet') { if (this.trireme && !this.trireme.sub) { this.say('(Cirrotrireme가 이미 있음 — Subreme 사용 불가)'); return; } await this.triremeMove(t, true); return; }
    if (name === 'Oxygen Tubes' || name === 'Flash Backstep' || name === 'Kintsukuroi Pharos') { this.say(`[Argo] ${name}: Cycle V 프라이모디얼 전투 전용 — 이 전투에서는 효과 없음`, 'sys'); return; }
    return o.call(this, name, t);
  });
}

// generic "Gain X Pain tokens" / "Pain X" sentences (Cycle V Trauma, gear)
export function installPainSentences(Game) {
  const P = Game.prototype; const o = P.doSentence;
  P.doSentence = async function (t, p, ctx = {}) { let m; const q = (p || '').replace(/^⚡\s*/, ''); if ((m = /^(?:Gain (\d+) Pain tokens?|Pain (\d+))\.?$/.exec(q))) { if (t && t.alive) await this.gainPain(t, +(m[1] || m[2]), 'Pain'); return; } return o.call(this, t, p, ctx); };
}
