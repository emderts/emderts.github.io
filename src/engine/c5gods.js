// Cycle V Godform secret cards: Hera (255), Poseidon Exalted (256), Zeus Exalted (257).
export function installC5Gods(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const SCORNED = ['nietzschean', 'pitiless', 'urfleece', 'urfather', 'nekron', 'zalmoksis', 'urtoev', 'veiledbeing', 'watchress'];
  const yn = (g, t, title, a = '사용', b = '패스') => g.ask({ type: 'yn', titan: t, title, options: [{ label: a, value: true }, { label: b, value: false }] });
  Object.assign(P, {
    heraOf(t) { return this.liveTitans().find(h => h !== t && this.gf(h, 'Hera') && h.godform.heraBond === t) || null; },
    async loseTrespass(t, n, why) { if (!t.godform) return; for (let i = 0; i < n; i++) { if (t.godform.trespass > 0) { t.godform.trespass--; this.say(`${t.name}: ${why} — Trespass −1 (남은 ${t.godform.trespass})`, 'bad'); } else { this.say(`${t.name}: ${why} — Trespass 없음, 각성 종료`, 'bad'); await this.endAwakening(t); return; } } },
    scornedMother(t) { return !!(this.gf(t, 'Hera') && this.prim && SCORNED.includes(this.prim.def.id)); },
  });
  wrap('awaken', async function (o, t, ...r) {
    const before = t && t.godform && t.godform.def.name;
    try { return await o.call(this, t, ...r); } finally {
      if (t && t.godform && t.godform.def.name === 'Hera' && before !== 'Hera' && !t.godform.heraBond) {
        const others = this.liveTitans().filter(x => x !== t);
        if (others.length) { const b = others.length === 1 ? others[0] : await this.ask({ type: 'choice', titan: t, title: 'Till Death Do Us (Hera): Priority Target이 될 다른 타이탄', options: others.map(x => ({ label: x.name, value: x })) }) || others[0]; t.godform.heraBond = b; for (const x of this.titans) x.pt = false; t.ptLocked = false; b.pt = true; b.ptLocked = true; this.say(`Till Death Do Us: ${b.name}이(가) Priority Target — Hera가 살아 있는 동안 Obol로 죽지 않음`, 'good'); this.notify(); }
      }
    }
  });
  wrap('endAwakening', async function (o, t, ...r) { const b = t && t.godform && t.godform.heraBond; const res = await o.call(this, t, ...r); if (b) b.ptLocked = false; return res; });
  wrap('obolDraw', async function (o, t, ...r) { const h = t && t.alive && this.heraOf(t); if (h) await this.loseTrespass(h, 1, `Till Death Do Us (${t.name} Obol)`); return o.call(this, t, ...r); });
  wrap('kill', async function (o, t, opts = {}, ...r) {
    if (t && t.alive && !opts.unavoidable) {
      if (opts.fromObol && !opts.ambrosia && this.heraOf(t)) { this.say(`${t.name}: Till Death Do Us — Hera가 살아 있어 Obol로 죽지 않음`, 'good'); return; }
      if (opts.ambrosia && this.gf(t, 'Poseidon Exalted')) { this.say(`${t.name}: Trench of the Soul — Ambrosia로 죽지 않음`, 'good'); return; }
      if (this._c5GodCause === 'oxygen' && !opts.ambrosia && this.gf(t, 'Poseidon Exalted')) { this.say(`${t.name}: Trench of the Soul — Oxygen으로 죽지 않음`, 'good'); return; }
      if (this._c5GodCause === 'fear' && !opts.ambrosia && this.gf(t, 'Zeus Exalted')) { this.say(`${t.name}: Father of It All — 공포 Condition/Despair로 죽지 않음`, 'good'); return; }
    }
    return o.call(this, t, opts, ...r);
  });
  for (const n of ['flipOxygen', 'discardOxygen']) wrap(n, async function (o, ...a) { const c = this._c5GodCause; this._c5GodCause = 'oxygen'; try { return await o.call(this, ...a); } finally { this._c5GodCause = c; } });
  wrap('checkDespair', async function (o, ...a) { const c = this._c5GodCause; this._c5GodCause = 'fear'; try { return await o.call(this, ...a); } finally { this._c5GodCause = c; } });
  wrap('addCondition', async function (o, t, name, ...r) { const c = this._c5GodCause; if (['Fear', 'Dread', 'Terror', 'Holy Terror'].includes(name)) this._c5GodCause = 'fear'; try { return await o.call(this, t, name, ...r); } finally { this._c5GodCause = c; } });
  // Source and Sacrifice (Poseidon Exalted): free action, once per Battle
  wrap('freeActions', function (o, t) {
    const out = o.call(this, t);
    if (t && t.alive && this.gf(t, 'Poseidon Exalted') && !t.godform.sacrificeUsed && t.godform.trespass > 0 && !t.knockdown) out.push({ label: '[Poseidon Exalted] Source and Sacrifice: Trespass −1 → 보너스 공격 (전투당 1회, 그 뒤 Argo의 무작위 타이탄 사망)', noFate: true, value: async () => { t.godform.sacrificeUsed = true; await this.loseTrespass(t, 1, 'Source and Sacrifice'); await this.bonusAttackFlow(t); this.say('Source and Sacrifice: Argo에 있는 무작위 타이탄 1명 사망 (캠페인)', 'bad'); } });
    return out;
  });
  // Childeater (Zeus Exalted): bonus attack that kills you if it fails to wound
  wrap('titanAttack', async function (o, t, mods = {}, ...r) {
    const ce = !!(t && t._ceArmed && mods && mods.bonus); if (ce) t._ceArmed = false; const w0 = this.woundCount();
    const res = await o.call(this, t, mods, ...r);
    if (ce && t.alive && this.woundCount() <= w0) { this.say(`${t.name}: Childeater — 보너스 공격으로 Wound 실패, 사망`, 'bad'); await this.solo(() => this.kill(t)); }
    return res;
  });
}
