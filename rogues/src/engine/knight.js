// Knight state (rulebook pp.15–19, 55, 64): Vigor / Heat / Passion tracks with limits, Peril thresholds, Bane, Technique areas.

export const PASSION_MAX = 9, HEAT_MAX = 9, VIGOR_MAX = 15;
export const PERIL = ['Uninjured', 'Minor', 'Major', 'Grave', 'Judicium'];

export class Knight {
  /**
   * def: { id, name, portrait:{powerDie, cardRefresh, heatRefresh, handLimit, speed, baneLimit},
   *        perilArc:{ maxVigor, thresholds:[{peril:'Minor', atVigor:<=n, heatLimit}], uninjuredHeatLimit } }
   */
  constructor(def) {
    this.id = def.id; this.name = def.name || def.id; this.def = def;
    const p = def.portrait || {}; const arc = def.perilArc || {};
    this.powerDie = p.powerDie || 'red'; this.cardRefresh = p.cardRefresh ?? 1; this.heatRefresh = p.heatRefresh ?? 1; this.handLimit = p.handLimit ?? 4; this.speed = p.speed ?? 4; this.baneLimit = p.baneLimit ?? 4;
    this.maxVigor = Math.min(VIGOR_MAX, arc.maxVigor ?? 10); this.thresholds = arc.thresholds || []; this.uninjuredHeatLimit = arc.uninjuredHeatLimit ?? 3;
    this.vigor = this.maxVigor; this.heat = 0; this.passion = 0; this.bane = 0;
    this.alive = true; this.firstDeath = false; this.sigh = 0; this.gold = 0;
    this.conditions = []; this.modifiers = {}; this.hand = []; this.cooldown = []; this.delay = []; this.discard = [];
    this.gear = []; this.log = [];
  }
  say(m) { this.log.push(m); return m; }
  /** Current Peril threshold from Vigor (p.18/53): thresholds listed from mildest to worst; the first whose atVigor >= vigor wins, else Uninjured. */
  peril(vigor = this.vigor) {
    let out = 'Uninjured';
    for (const t of this.thresholds) if (vigor <= t.atVigor) out = t.peril;
    return out;
  }
  /** Heat Limit (black cube) rises as Vigor drops, per Peril Arc (p.17–18). */
  get heatLimit() { const p = this.peril(); const t = this.thresholds.find(x => x.peril === p); return Math.min(HEAT_MAX, (t ? t.heatLimit : this.uninjuredHeatLimit) + (this.heatLimitBonus || 0)); }
  /**
   * Gain Heat (p.17): "If any effect would force you to raise your Heat above your Heat Limit, raise your Heat to your current
   * limit, then lose Vigor equal to the value by which you exceeded your Heat Limit." Voluntary costs that would exceed the limit are illegal.
   */
  gainHeat(n, { voluntary = false } = {}) {
    if (voluntary && this.heat + n > this.heatLimit) throw new Error(`cannot pay ${n} Heat: limit ${this.heatLimit}, current ${this.heat}`);
    const over = Math.max(0, this.heat + n - this.heatLimit);
    this.heat = Math.min(this.heatLimit, this.heat + n);
    if (over) { this.say(`Heat over limit by ${over} → lose ${over} Vigor`); this.loseVigor(over); }
    return over;
  }
  /** Raise Passion (p.17/57): hard limit 9. */
  gainPassion(n = 1) { this.passion = Math.min(PASSION_MAX, this.passion + n); return this.passion; }
  /** Lose Vigor (p.53): track never shows below 0; the caller decides Peril Check / Judicium. Returns the (possibly negative) effective value. */
  loseVigor(n) { if (this.extraVigor > 0 && n > 0) { const a = Math.min(this.extraVigor, n); this.extraVigor -= a; n -= a; } const eff = this.vigor - n; this.vigor = Math.max(0, eff); return eff; }
  gainVigor(n) { this.vigor = Math.min(this.maxVigor, this.vigor + n); return this.vigor; }
  /** Lower maximum Vigor (e.g. gear of a higher tier, p.20): current clamps down to the new max. */
  setMaxVigor(n) { this.maxVigor = Math.max(0, Math.min(VIGOR_MAX, n)); if (this.vigor > this.maxVigor) this.vigor = this.maxVigor; }
  /** Bane (p.64): exceeding the Bane Limit kills immediately, no Mortis/Judicium. */
  gainBane(n = 1) { if (this.bane + n > this.baneLimit) { this.bane = this.baneLimit; this.die('Bane Limit exceeded'); return; } this.bane += n; }
  die(reason = '') { this.alive = false; this.say(`${this.name} dies${reason ? ' (' + reason + ')' : ''}`); if (!this.firstDeath) this.firstDeath = true; }
  /** Refresh step (p.55): Heat -HeatRefresh, Cooldown → hand ×CardRefresh, Delay → Cooldown. */
  refresh(choose = cards => cards.slice(0, this.cardRefresh)) {
    this.heat = Math.max(0, this.heat - this.heatRefresh);
    const back = choose(this.cooldown).slice(0, this.cardRefresh);
    for (const c of back) { this.cooldown.splice(this.cooldown.indexOf(c), 1); this.hand.push(c); }
    this.cooldown.push(...this.delay); this.delay = [];
  }
  /** Clash Aftermath for a Knight (p.63): stats reset, Techniques back, Conditions off, Bane -2, resurrect at max Vigor if dead. */
  aftermath() {
    if (!this.alive) { this.alive = true; }
    this.vigor = this.maxVigor; this.heat = 0; this.passion = 0;
    this.hand.push(...this.cooldown, ...this.delay, ...this.discard); this.cooldown = []; this.delay = []; this.discard = [];
    this.conditions = []; this.modifiers = {}; this.bane = Math.max(0, this.bane - 2);
    for (const g of this.gear) { g.exhausted = false; if (!g.consumable) g.discarded = false; }
  }
}
