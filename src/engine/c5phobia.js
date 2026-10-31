// Cycle V Phobia Afflictions (Storybook "New Afflictions"). Random affliction = d5.
import { DIRS } from './core.js';
export const PHOBIAS = ['Truth of the Primal Dark', 'Truth of Imminent Drowning', 'Truth of the Inevitable Failure', 'Truth of Eternal Loneliness', 'Truth of the Unbearable Responsibility'];
export const PHOBIA_TEXT = {
  'Truth of the Primal Dark': "If you start your turn outside of every other Titan's Light X keyword range, gain 1 Despair token.",
  'Truth of Imminent Drowning': 'At the start of each Battle, flip 1 Oxygen token.',
  'Truth of the Inevitable Failure': 'Gain the following effects: "Full Miss: Gain 1 Despair token. Crit Miss: Gain 1 Despair token. All BP cards you attack during this Battle gain: FAIL Gain +1 Ψ".',
  'Truth of Eternal Loneliness': 'Awakening Lock. You do not benefit from the Song of Life or Titan adjacency (for example, for the purposes of Despair). You cannot use Hope tokens.',
  'Truth of the Unbearable Responsibility': 'If you go first during the Titan Round, or become the Party Leader, or gain the Priority Target token, gain 1 Despair token.',
};
export function installC5Phobia(Game, { TitanDied, BattleOver }) {
  const P = Game.prototype; const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { return fn.call(this, o, ...a); }; };
  const short = n => n.replace(/^Truth of (the )?/, '');
  Object.assign(P, {
    phobia(t, n) { return !!(t && (t.phobia || []).some(x => x === n || x === 'Truth of ' + n || x === 'Truth of the ' + n)); },
    gainPhobia(t, name = null) {
      if (!t) return null; t.phobia = t.phobia || [];
      if (!name) { const r = this.rng.d10(); let i = Math.ceil(r / 2) - 1; const miss = PHOBIAS.filter(x => !t.phobia.includes(x)); if (!miss.length) { this.say(`${t.name}: d5=${i + 1} — 이미 모든 Phobia Affliction 보유`, 'bad'); return null; } let tries = 0; while (t.phobia.includes(PHOBIAS[i]) && tries++ < 20) { i = Math.ceil(this.rng.d10() / 2) - 1; } name = t.phobia.includes(PHOBIAS[i]) ? this.rng.pick(miss) : PHOBIAS[i]; this.say(`${t.name}: 무작위 Phobia Affliction (d5=${i + 1}) → ${name}`, 'bad'); }
      else this.say(`${t.name}: Phobia Affliction — ${name}`, 'bad');
      if (!t.phobia.includes(name)) t.phobia.push(name); this.say(`  ${name}: ${PHOBIA_TEXT[name]}`, 'sys'); this.notify(); return name;
    },
    inOthersLight(t) {
      if (!t || !t.pos || t.onVP || t.offBoard) return true; const here = this.board.terrainAt(t.pos.c, t.pos.r); if (here && here.lightVoid) return false;
      for (const o of this.liveTitans()) { if (o === t || !o.pos || o.onVP || o.offBoard) continue; const L = this.lightOf ? this.lightOf(o) : 0; if (L <= 0) continue; const f = this.dpFace ? this.dpFace(o) : 'N'; const d = DIRS[f]; const pr = (t.pos.c - o.pos.c) * d[0] + (t.pos.r - o.pos.r) * d[1]; if (pr >= 0 && Math.abs(t.pos.c - o.pos.c) + Math.abs(t.pos.r - o.pos.r) <= L) return true; }
      return false;
    },
    async phobiaPT() { for (const t of this.titans) { const had = !!t._phPT; t._phPT = !!t.pt; if (t.pt && !had && t.alive && this.phobia(t, 'Unbearable Responsibility') && this._phReady) { this.say(`${t.name}: Truth of the Unbearable Responsibility — Priority Target 획득, Despair +1`, 'bad'); await this.solo(() => this.gainDespair(t, 1)); } } },
  });
  wrap('dpPhobia', function (o, t) { if (!t || !t.alive) return; this.gainPhobia(t); });
  wrap('startOfBattle', async function (o, ...a) {
    for (const t of this.titans) t._phPT = false;
    const r = await o.call(this, ...a);
    for (const t of this.liveTitans()) if (this.phobia(t, 'Imminent Drowning')) { this.say(`${t.name}: Truth of Imminent Drowning — 전투 시작, Oxygen 1개 뒤집기`, 'bad'); if (this.flipOxygen) await this.solo(() => this.flipOxygen(t, 1, 'Truth of Imminent Drowning')); }
    this._phReady = true; await this.phobiaPT(); return r;
  });
  wrap('titanTurn', async function (o, t, ...r) {
    if (t && t.alive) {
      if (this._phFirst !== this.round) { this._phFirst = this.round; if (this.phobia(t, 'Unbearable Responsibility')) { this.say(`${t.name}: Truth of the Unbearable Responsibility — Titan Round 첫 번째, Despair +1`, 'bad'); await this.solo(() => this.gainDespair(t, 1)); } }
      if (t.alive && this.phobia(t, 'Primal Dark') && !this.inOthersLight(t)) { this.say(`${t.name}: Truth of the Primal Dark — 다른 모든 타이탄의 Light 범위 밖에서 턴 시작, Despair +1`, 'bad'); await this.solo(() => this.gainDespair(t, 1)); }
      await this.phobiaPT();
    }
    try { return await o.call(this, t, ...r); } finally { if (this._phReady) await this.phobiaPT().catch(() => {}); }
  });
  wrap('resolveAI', async function (o, ...a) { try { return await o.call(this, ...a); } finally { if (this._phReady) await this.phobiaPT().catch(() => {}); } });
  wrap('awaken', async function (o, t, ...r) { if (t && this.phobia(t, 'Eternal Loneliness')) { this.say(`${t.name}: Truth of Eternal Loneliness — Awakening Lock (각성 불가)`, 'bad'); return false; } return o.call(this, t, ...r); });
  wrap('despairEff', function (o, t) {
    if (!t || !this.phobia(t, 'Eternal Loneliness') || !t.alive || !t.despair || t.ignoreMind) return o.call(this, t);
    const ign = t.gear.filter(g => !g.discarded && (g.card.name === 'Vulture Mask' || g.card.name === 'Yarn Talisman')).length + (+this.inh(t, 'Despair Resilience') || 0) + (this.gearKWSum ? this.gearKWSum(t, 'Despair Resilience') : 0);
    return Math.max(0, t.despair - ign);
  });
  wrap('titanAttack', async function (o, t, ...r) {
    const lone = t && this.phobia(t, 'Eternal Loneliness') && this.kratosPool && this.kratosPool.hope > 0; const h = lone ? this.kratosPool.hope : 0;
    if (lone) { this.kratosPool.hope = 0; this.say(`${t.name}: Truth of Eternal Loneliness — Hope 토큰 사용 불가 (이번 공격 동안 제외)`, 'bad'); }
    try { return await o.call(this, t, ...r); } finally { if (lone) this.kratosPool.hope = (this.kratosPool.hope || 0) + h; }
  });
  P.phobiaAttackHook = async function (t, A, stage) {
    if (!t || !t.alive || !this.phobia(t, 'Inevitable Failure')) return;
    if (stage === 'critMiss') { this.say(`${t.name}: Truth of the Inevitable Failure — Crit Miss, Despair +1`, 'bad'); await this.gainDespair(t, 1); }
    if (stage === 'fullMiss') { this.say(`${t.name}: Truth of the Inevitable Failure — Full Miss, Despair +1`, 'bad'); await this.gainDespair(t, 1); }
    if (stage === 'fail') { this.say(`${t.name}: Truth of the Inevitable Failure — BP FAIL: Fate +1`, 'bad'); await this.gainFate(t, 1); }
  };
}
