// Boss Monster state: AI/BP decks by level, Escalation decks, Wound Stack, Escalation Chart (rulebook pp.44–47, 60–61).
import { Deck } from './core.js';

export class Monster {
  /**
   * def = monster json (levels, traits, cards:{ai:[],bp:[],signature,routine}); level = node-determined Monster level.
   * Cards are plain objects with .level (1–3). Level-1 cards start in the decks; level 2/3 cards form the Escalation decks.
   */
  constructor(def, level, rng) {
    this.def = def; this.id = def.id; this.name = def.name; this.level = level; this.rng = rng;
    const L = def.levels[String(level)]; if (!L) throw new Error(`${def.id}: no level ${level}`);
    this.toHit = L.toHit; this.woundsToKill = L.wounds; this.bonuses = { at: 0, vigorLoss: 0, evasionDice: 0, escalations: 0, ...L.bonuses };
    this.activations = (L.activations || ['AI']).map(t => ({ type: t, ready: true }));
    this.traits = new Set(); for (let l = 1; l <= level; l++) { const x = def.levels[String(l)]; (x.traitsAdd || []).forEach(t => this.traits.add(t)); (x.traitsRemove || []).forEach(t => this.traits.delete(t)); }
    this.disabledTraits = new Set();
    const cards = def.cards || { ai: [], bp: [] };
    const byLv = (arr, lv) => arr.filter(c => c.level === lv).map(c => ({ ...c }));
    this.ai = new Deck(byLv(cards.ai, 1), rng).shuffle(); this.aiEsc = { 2: new Deck(byLv(cards.ai, 2), rng).shuffle(), 3: new Deck(byLv(cards.ai, 3), rng).shuffle() };
    this.bp = new Deck(byLv(cards.bp, 1), rng).shuffle(); this.bpEsc = { 2: new Deck(byLv(cards.bp, 2), rng).shuffle(), 3: new Deck(byLv(cards.bp, 3), rng).shuffle() };
    this.removed = []; this.setAsideBp3 = null;
    this.woundStack = []; // entries: { card?, generic?:'single'|'double', wounds: 1|2 }
    this.signature = cards.signature || null; this.routine = cards.routine || null;
    this.modifiers = { toHit: 0, at: 0, precision: 0 }; // permanent Modifier tokens on the Monster Sheet
    this.generic = {}; // Generic tokens per trait id
    this.facing = 'N'; this.cells = []; this.log = [];
    /** Extra per-escalation stat bonuses granted when no AI 3 cards are left (chart): order vigorLossPerHit, +1 ?, +1 ?, +1 ? */
    this.noAiBonus = 0;
  }
  say(m) { this.log.push(m); return m; }
  hasTrait(name) { return this.traits.has(name) && !this.disabledTraits.has(name); }
  get wounds() { return this.woundStack.reduce((a, w) => a + w.wounds, 0); }
  get slain() { return this.wounds >= this.woundsToKill; }
  /** Effective AT of a BP card: printed AT + level AT bonus + permanent AT modifiers (+ Panzeronion-style per-level tokens handled by caller hooks). */
  atOf(card, extra = 0) { return card.at + this.bonuses.at + this.modifiers.at + extra; }

  // ---- Escalation Chart (p.61) ----
  /** Remove one card of `level` from deck+discard ("prioritize cards from the deck"); if none, remove the lowest-level card instead. Returns removed card or null. */
  _removeLevel(deck, level, exact = true) {
    const pick = (arr, lv) => arr.findIndex(c => c.level === lv);
    const tryLv = lv => { let i = pick(deck.cards, lv); if (i >= 0) return { card: deck.cards.splice(i, 1)[0], from: 'deck' }; i = pick(deck.discard, lv); if (i >= 0) return { card: deck.discard.splice(i, 1)[0], from: 'discard' }; return null; };
    let r = exact ? tryLv(level) : null;
    if (!r) { const lvls = [...new Set([...deck.cards, ...deck.discard].map(c => c.level))].sort(); for (const lv of lvls) { r = tryLv(lv); if (r) break; } }
    if (!r) return null;
    this.removed.push(r.card);
    if (r.from === 'discard') { deck.cards.push(...deck.discard); deck.discard = []; deck.shuffle(); }
    return r.card;
  }
  /** AI Escalation for a wounded BP of `level`: remove a matching AI card, shuffle in one a level higher (p.60). */
  escalateAI(level) {
    const target = Math.min(3, level + 1);
    const removed = this._removeLevel(this.ai, level, true);
    const src = this.aiEsc[target] || this.aiEsc[3];
    const add = src && src.size ? src.draw() : (this.aiEsc[3].size ? this.aiEsc[3].draw() : null);
    if (add) { this.ai.cards.push(add); if (!this.ai.cards.length || this.ai.cards.length === 1 && this.ai.discard.length) { /* only card in deck → shuffle discard in */ if (this.ai.cards.length === 1) { this.ai.cards.push(...this.ai.discard); this.ai.discard = []; } } this.ai.shuffle(); this.say(`AI Escalation: removed AI ${removed ? removed.level : '-'} , added AI ${add.level} (${add.name})`); }
    else { this.noAiBonus++; const order = ['+1 Vigor loss per hit', '+1 Evasion die', '+1 AT', '+1 To Hit'][Math.min(3, this.noAiBonus - 1)]; this.say(`AI Escalation: no AI 3 left → bonus ${this.noAiBonus}: ${order}`); if (this.noAiBonus === 1) this.bonuses.vigorLossPerHit = (this.bonuses.vigorLossPerHit || 0) + 1; if (this.noAiBonus === 2) this.bonuses.evasionDice++; if (this.noAiBonus === 3) this.bonuses.at++; if (this.noAiBonus >= 4) this.toHit++; }
    return { removed, added: add };
  }
  /** BP Escalation (Boss) for a wounded BP of `level`; `critical` = critically wounded BP 3. */
  escalateBP(level, { critical = false } = {}) {
    const all = [...this.bp.cards, ...this.bp.discard];
    const allBp3 = all.length && all.every(c => c.level === 3);
    if (level <= 2) {
      const add = this.bpEsc[level + 1].size ? this.bpEsc[level + 1].draw() : null;
      if (add) { this.bp.cards.push(add); if (this.bp.cards.length === 1 && this.bp.discard.length) { this.bp.cards.push(...this.bp.discard); this.bp.discard = []; } this.bp.shuffle(); this.say(`BP Escalation: added BP ${add.level} (${add.name})`); }
      else this.say('BP Escalation: no BP card to add');
      return;
    }
    // wounded BP 3
    if (allBp3) { this.bp.cards.push(...this.bp.discard); this.bp.discard = []; this.bp.shuffle(); if (!critical && this.setAsideBp3) { this.bp.putBottom(this.setAsideBp3); this.setAsideBp3 = null; } this.say('BP Escalation: all BP 3 → reshuffle discard' + (critical ? ' (deck 1 card smaller)' : '')); return; }
    this._removeLevel(this.bp, 0, false); // lowest-level card
    const n = critical ? 2 : 1;
    for (let i = 0; i < n; i++) { const add = this.bpEsc[3].size ? this.bpEsc[3].draw() : null; if (add) this.bp.cards.push(add); }
    if (this.bp.cards.length === 1 && this.bp.discard.length) { this.bp.cards.push(...this.bp.discard); this.bp.discard = []; }
    this.bp.shuffle();
    if (!critical && this.setAsideBp3) { this.bp.putBottom(this.setAsideBp3); this.setAsideBp3 = null; }
    this.say(`BP Escalation (BP 3${critical ? ' crit' : ''}): removed lowest, added ${n} BP 3`);
  }
  /**
   * Resolve a wound on `card` (p.60): BP1/2 → Wound Stack; BP3 → Generic Double Wound + set aside (or the card itself if critical).
   * Then Escalation. Returns wounds dealt (1 or 2).
   */
  wound(card, { critical = false } = {}) {
    let dealt;
    if (card.level === 3) { if (critical) { this.woundStack.push({ card, wounds: 2 }); } else { this.woundStack.push({ generic: 'double', wounds: 2 }); this.setAsideBp3 = card; } dealt = 2; }
    else { this.woundStack.push({ card, wounds: 1 }); dealt = 1; }
    this.escalateAI(card.level); this.escalateBP(card.level, { critical });
    return dealt;
  }
  addSingleWound() { this.woundStack.push({ generic: 'single', wounds: 1 }); }
  /** Escalate X (p.62): escalate the lowest AI and lowest BP card X times, removing the lowest BP from the deck (no wound). */
  escalateX(x = 1) { for (let i = 0; i < x; i++) { const lowest = Math.min(...[...this.bp.cards, ...this.bp.discard].map(c => c.level), 3); const lowestAi = Math.min(...[...this.ai.cards, ...this.ai.discard].map(c => c.level), 3); this.escalateAI(lowestAi); if (lowest <= 2) { this._removeLevel(this.bp, lowest, true); } this.escalateBP(lowest); } }
  readyActivations() { for (const a of this.activations) a.ready = true; }
  drawAI() { const c = this.ai.draw(); return c; }
  discardAI(c) { this.ai.toDiscard(c); }
  drawBP() { return this.bp.draw(); }
  discardBP(c) { this.bp.toDiscard(c); }
}
