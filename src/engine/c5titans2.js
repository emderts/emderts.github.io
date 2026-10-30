// Cycle V Titans, part 2 (Immortal Truthbearer, Helldiver, Feareater, Executioner, Trespasser)
// + Cycle V Pain tokens (Rage threshold), Truth X / AI Suppress / Pull X on the Kratos Table.
import { kw } from './core.js';

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
    rageCap(t) { const res = +this.inh(t, 'Pain Resilience') || 0; return 9 - Math.max(0, (t.pain || 0) - res); },
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
    for (const t of this.titans) if (t.alive && this.ab(t, 'Silver Strain')) { t.oxygen = (t.oxygen || 0) + 1; this.say(`${t.name}: Silver Strain — Oxygen 토큰 1 (Oxygen 규칙은 Cycle V 프라이모디얼 전투 전용 — 효과 없음)`, 'sys'); }
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
}
