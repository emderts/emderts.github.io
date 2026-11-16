// Kingdoms Forlorn — Rogue's Path: Stoneface (Knightbook "A Knight's Tale: Stoneface") — Leash / Unleash (Generic tokens), Talents and Techniques.
const tops = (k, op) => (k && k.talent ? k.talent.abilities.flatMap(a => (a.ops || []).filter(o => o.op === op)) : []);
const techAt = (k, timing) => k.hand.find(t => t.timing === timing && t.ops);
const isStone = k => !!(k && k.def && k.def.id === 'stoneface');

export const StonefaceMixin = {
  isStone,
  /** Leash X: place X Generic tokens on the Knight Board. */
  leash(k, n, why = '') { if (!n || n < 0) return; k.leash = (k.leash || 0) + n; this.say(`${k.name}: Leash ${n}${why ? ` (${why})` : ''} → Generic 토큰 ${k.leash}`, 'tech'); },
  /** Unleash X: with X or more Generic tokens, discard all of them. */
  canUnleash(k, n) { return (k.leash || 0) >= n; },
  unleash(k, n) { if (!this.canUnleash(k, n)) return false; this.say(`${k.name}: Unleash ${n} — Generic 토큰 ${k.leash}개 모두 버림`, 'tech'); k.leash = 0; return true; },
  /** "Whenever you mitigate [Vigor] loss by 1 or more, Leash X." */
  stoneMitigated(k, n) { if (isStone(k) && n > 0) this.leash(k, n, 'Vigor 손실 경감'); },
  stoneAccursed(k) { return tops(k, 'accursedStrength').length ? 1 : 0; },
  stoneFreeActions(k) {
    const out = []; if (!isStone(k) || !k.actions) return out;
    for (const o of tops(k, 'rollingStone')) if (this.canUnleash(k, o.unleash) && k.actions.move && k.actions.combat && !this.knockedDown(k)) out.push({ id: 'stone:rush', label: `Rolling Stone — Unleash ${o.unleash}: Rush (전투+이동 행동)` });
    for (const o of tops(k, 'tremortrialThrow')) if (k.bane + o.bane <= k.baneLimit && this.alive().some(x => x !== k && this.board.adjacent(x.pos, k.pos))) out.push({ id: 'stone:throw', label: `Tremortrial Throw — Bane +${o.bane}: 인접 기사를 X칸 이동, Leash X (X = Bane 수)` });
    for (const o of tops(k, 'transmutePain')) if (k.bane + o.bane <= k.baneLimit && k.actions.move && k.actions.combat && this.canAttack(k)) out.push({ id: 'stone:pain', label: `Transmute Pain to Power — Bane +${o.bane}: 공격, Wound 시 Leash ${k.maxVigor - k.vigor} (전투+이동 행동)` });
    return out;
  },
  async stoneFreeRun(k, id) {
    if (id === 'stone:rush') { const o = tops(k, 'rollingStone')[0]; if (this.unleash(k, o.unleash)) await this.fx.runKnightOp({ op: 'rush' }, k, {}); }
    else if (id === 'stone:hope') { const o = tops(k, 'undyingHope')[0]; if (this.unleash(k, o.unleash)) { const n = this.poolCount('break'); this.poolTake('break', n); this.poolAdd('hope', n); this.say(`Undying Hope: Break ${n} → Hope ${n}`, 'tech'); } }
    else if (id === 'stone:throw') { const o = tops(k, 'tremortrialThrow')[0]; const adj = this.alive().filter(x => x !== k && this.board.adjacent(x.pos, k.pos)); const xid = adj.length > 1 ? await this.ask({ type: 'pickKnight', text: 'Tremortrial Throw — 던질 기사', options: adj.map(x => ({ label: x.name, value: x.id })) }) : adj[0].id; const x = adj.find(y => y.id === xid) || adj[0]; k.gainBane(o.bane); this.say(`${k.name} Bane +${o.bane} (${k.bane}/${k.baneLimit})`, 'tech'); const X = k.bane; await this.knightMove(x, X); this.leash(k, X, 'Tremortrial Throw'); }
    else if (id === 'stone:pain') { const o = tops(k, 'transmutePain')[0]; k.gainBane(o.bane); this.say(`${k.name} Bane +${o.bane} (${k.bane}/${k.baneLimit})`, 'tech'); k.actions.move = false; k.actions.combat = false; const X = k.maxVigor - k.vigor; await this.knightAttack(k); if (this.lastAttack && this.lastAttack.knight === k && this.lastAttack.wounded) this.leash(k, X, 'Transmute Pain to Power'); }
  },
  /** Undying Hope: during either ability window, Unleash 9 to turn all Break tokens into Hope tokens. */
  async stoneWindow(k, A, which) { for (const o of tops(k, 'undyingHope')) { const n = this.poolCount('break'); if (n && this.canUnleash(k, o.unleash) && await this.yesNo(`${k.name}: Undying Hope (${which === 'firstWindow' ? '1차' : '2차'} 창) — Unleash ${o.unleash}로 Break ${n}개를 Hope로?`, false)) { this.unleash(k, o.unleash); this.poolTake('break', n); this.poolAdd('hope', n); this.say(`Undying Hope: Break ${n} → Hope ${n}`, 'tech'); } } },
  /** Another Knight performs a Move action while adjacent: Gather No Moss. */
  async stoneMoveAction(mover) { for (const k of this.alive()) { const t = techAt(k, 'onOtherMove'); if (k === mover || !t || !this.board.adjacent(k.pos, mover.pos)) continue; const ops = await this.paraUse(k, t, `${mover.name}의 Move action에 +Speed`); const o = ops && ops.find(x => x.op === 'gatherNoMoss'); if (o) { mover.moveBoost = (mover.moveBoost || 0) + o.n; mover._jump = this.fx.tierOk(k, 'KING') ? 2 : 1; this.say(`${mover.name}: 이 이동 Speed +${o.n}`, 'tech'); this.leash(k, 1, 'Gather No Moss'); } } },
  async stoneBeforeAttack(k, A) {
    if (!isStone(k)) return; const w = A.weapon || {}; const traits = (this.fx.gearTraits ? this.fx.gearTraits(k, w) : w.traits || []).join(' ');
    for (const o of tops(k, 'sticksAndStones')) if (/Spear|Polearm/i.test(traits)) this.leash(k, o.n, 'Sticks and Stones');
    if (tops(k, 'martialMonolith').length && !/Ranged/i.test(w.text || '')) { let n = 0; if (await this.yesNo(`${k.name}: Martial Monolith — Provoke? (Leash 1)`, false)) { this.priorityTarget = k; this.turnToward(k.pos); this.say(`Provoke: ${k.name}이 Priority Target`, 'tech'); n++; } if (await this.yesNo(`${k.name}: Martial Monolith — Tireless? (Leash 1)`, false)) { A.flags.add('tireless'); n++; } if (!this.monster.isMob && await this.yesNo(`${k.name}: Martial Monolith — Pull 1? (Leash 1)`, false)) { await this.fx.pullMonster(k, A, 1); n++; } if (n) this.leash(k, n, 'Martial Monolith'); }
    if (k.pendingStone) { A.stone = k.pendingStone; k.pendingStone = null; }
  },
  async stoneWound(k, A) { for (const o of tops(k, 'rockslide')) if (this.canUnleash(k, o.unleash) && !this.monster.isMob && await this.yesNo(`${k.name}: Rockslide — Unleash ${o.unleash}로 Pushback ${o.n}?`, false)) { this.unleash(k, o.unleash); await this.fx.pushMonster(k, o.n, A); } },
  async stoneSecondWindow(k, A) { for (const o of tops(k, 'juggernaut')) { const tc = this.fx.targetCells(A); if (k.alive && !this.knockedDown(k) && this.canUnleash(k, o.unleash) && tc.length && !tc.some(c => this.board.adjacent(c, k.pos)) && await this.yesNo(`${k.name}: Juggernaut — Unleash ${o.unleash}로 대상 쪽으로 최대 ${o.n}칸 이동?`, false)) { this.unleash(k, o.unleash); await this.fx.motivateKnight(k, o.n, tc[0]); } } const s = A.stone; if (!s || !s.danger) return; A.stone = null; this.leash(k, s.danger.leash, 'Danger Zone'); if (!this.monster.isMob && k.alive) await this.fx.pushMonster(k, s.danger.n, A); },
  /** Full Miss, before the Knight Pool is cleared: Unstoppable Force. */
  async stoneFullMiss(k, A) { const ops = await this.paraUse(k, techAt(k, 'onFullMissKeep')); const o = ops && ops.find(x => x.op === 'unstoppable'); if (!o) return; A.keepPool = true; this.say(`${k.name}: Clear the Knight Pool 단계 건너뜀`, 'tech'); this.leash(k, 2, 'Unstoppable Force'); if (o.power) this.poolAdd('power', o.power); },
  /** Stone Sentinel: a Monster is about to perform an After Attack — Unleash 11 for a Bonus Attack. */
  async stoneAfterAttack() { for (const k of this.alive()) for (const o of tops(k, 'stoneSentinel')) if (this.canUnleash(k, o.unleash) && !this.knockedDown(k) && this.canAttack(k) && await this.yesNo(`${k.name}: Stone Sentinel — Unleash ${o.unleash}로 Bonus Attack?`, true)) { this.unleash(k, o.unleash); await this.knightAttack(k, { bonus: true }); } },
  /** Shell of Stone: about to perform an Armor Roll — exhaust the Armor to Reinforce 1 (its Armor dice still count). */
  async stoneDefense(k) { if (!tops(k, 'shellOfStone').length) return; const g = k.gear.find(x => x.type === 'armor' && !x.exhausted && !x.discarded); if (!g || !await this.yesNo(`${k.name}: Shell of Stone — ${g.name}을(를) Exhaust하고 Reinforce 1?`, false)) return; k.reinforce = k.reinforce || { red: 0, black: 0, white: 0 }; k.reinforce.red += 1; if (g.armorDice) { if (Array.isArray(g.armorDice.dice)) { for (const col of g.armorDice.dice) k.reinforce[col] = (k.reinforce[col] || 0) + 1; } else for (const col in g.armorDice) if (typeof g.armorDice[col] === 'number') k.reinforce[col] = (k.reinforce[col] || 0) + g.armorDice[col]; } g.exhausted = true; this.say(`${k.name}: Shell of Stone — ${g.name} Exhaust, Reinforce 1`, 'tech'); },
  async stoneOp(o, k, ctx) {
    const S = () => (k.pendingStone = k.pendingStone || {});
    switch (o.op) {
      case 'leash': this.leash(k, o.n, ctx.technique ? ctx.technique.name : ''); return true;
      case 'unleashKeep': if (this.canUnleash(k, o.n) && ctx.technique && await this.yesNo(`${k.name}: Unleash ${o.n}로 ${ctx.technique.name}을(를) 손에 유지?`, false)) { this.unleash(k, o.n); ctx.technique._depletion = 'hand'; } return true;
      case 'getClear': { const adj = this.alive().filter(x => x !== k && this.board.adjacent(x.pos, k.pos) && !x.engulfed); if (!adj.length) return true; const id = await this.ask({ type: 'pickKnight', text: `Get Clear! — ${o.n}칸 Knockback할 인접 기사`, options: [...adj.map(x => ({ label: x.name, value: x.id })), { label: '취소', value: 'skip' }] }); const x = adj.find(y => y.id === id); if (x) await this.knightMove(x, o.n); return true; }
      case 'dangerZone': S().danger = { leash: o.leash, n: o.n }; return true;
      case 'scrapeClean': { let left = o.n; for (const c of k.conditions) { while (left > 0 && c.tokens > 0) { c.tokens--; left--; } } this.say(`${k.name}: Condition 토큰 ${o.n - left}개 버림`, 'tech'); if (o.bane && k.bane > 0) { const b = Math.min(o.bane, k.bane); k.bane -= b; this.say(`${k.name}: Bane -${b} → ${k.bane}`, 'tech'); } return true; }
      case 'repositionNow': if (!this.knockedDown(k) && await this.yesNo(`${k.name}: Reposition ${o.n}?`, true)) await this.knightMove(k, o.n); return true;
      case 'avalanche': { let big = false; if (this.canUnleash(k, 6) && await this.yesNo(`${k.name}: Avalanche Hammerstrike — Unleash 6으로 Attack Re-roll ${o.n} · Power Re-roll ${o.n} · Auto-hope ${o.hope}?`, true)) { this.unleash(k, 6); big = true; } const n = big ? o.n : 1; k.pendingAttackRerolls = (k.pendingAttackRerolls || 0) + n; k.pendingPowerRerolls = (k.pendingPowerRerolls || 0) + n; this.poolAdd(big ? 'hope' : 'break', big ? o.hope : 1); this.say(`${k.name}: Attack Re-roll ${n} · Power Re-roll ${n} · ${big ? `Auto-hope ${o.hope}` : 'Auto-break 1'}`, 'tech'); return true; }
      case 'provokeNow': this.priorityTarget = k; this.turnToward(k.pos); this.say(`Provoke: ${k.name}이 Priority Target, 몬스터가 바라봄`, 'tech'); return true;
      case 'techSoak': k.roundSoak = (k.roundSoak || 0) + o.n; this.say(`${k.name}: Soak ${o.n}`, 'tech'); return true;
      case 'rockPull': { const z = this.board.zone([k.pos], o.zone); const al = this.alive().filter(x => x !== k && !x.engulfed && z.some(c => c.c === x.pos.c && c.r === x.pos.r)); if (!al.length) { this.say('Zone 3에 다른 기사 없음'); return true; } const id = await this.ask({ type: 'pickKnight', text: `I'll Be Your Rock — Pull ${o.n}할 기사`, options: [...al.map(x => ({ label: x.name, value: x.id })), { label: '취소', value: 'skip' }] }); const x = al.find(y => y.id === id); if (x) { await this.fx.motivateKnight(x, o.n, k.pos); this.leash(k, o.leash, "I'll Be Your Rock"); } return true; }
      case 'moveBoosted': k.moveBoost = (k.moveBoost || 0) + o.n; await this.knightMove(k, this.fx.speed(k)); return true;
      case 'splitHeavens': { const g = k.gear.find(x => x.type === 'armor' && !x.exhausted && !x.discarded); if (g && await this.yesNo(`${k.name}: Split the Heavens — ${g.name}을(를) Exhaust하고 +2 Speed · Spotlight · Auto-hope 1?`, false)) { g.exhausted = true; k.turnSpeed = (k.turnSpeed || 0) + 2; k.pendingPara = k.pendingPara || {}; k.pendingPara.spotlight = true; this.poolAdd('hope', 1); this.say(`${k.name}: ${g.name} Exhaust → +2 Speed · Spotlight · Auto-hope 1`, 'tech'); } return true; }
      case 'gatherNoMoss': case 'unstoppable': return true;
    }
    return false;
  },
};
export const STONE_OPS = new Set(['leash', 'unleashKeep', 'getClear', 'dangerZone', 'scrapeClean', 'repositionNow', 'avalanche', 'provokeNow', 'techSoak', 'rockPull', 'moveBoosted', 'splitHeavens', 'gatherNoMoss', 'unstoppable']);
export const STONE_PRE = new Set(['dangerZone', 'repositionNow', 'avalanche', 'provokeNow']);
