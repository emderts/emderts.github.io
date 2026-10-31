// Kingdoms Forlorn — Rogue's Path: engine core utilities (pure, no DOM).

/** Deterministic PRNG (mulberry32). Same seed → same sequence; lets tests reproduce games. */
export class Rng {
  constructor(seed = Date.now() >>> 0) { this.seed = seed >>> 0; this.s = this.seed || 1; }
  next() { let t = (this.s += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  /** integer in [0, n) */
  int(n) { return Math.floor(this.next() * n); }
  /** die roll 1..sides */
  die(sides = 6) { return 1 + this.int(sides); }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

/** Generic deck: draw pile + discard pile, reshuffles discard when empty. */
export class Deck {
  constructor(cards = [], rng = new Rng()) { this.cards = [...cards]; this.discard = []; this.rng = rng; }
  shuffle() { this.rng.shuffle(this.cards); return this; }
  get size() { return this.cards.length; }
  draw() {
    if (!this.cards.length) { if (!this.discard.length) return null; this.cards = this.discard; this.discard = []; this.shuffle(); }
    return this.cards.shift();
  }
  putTop(c) { this.cards.unshift(c); }
  putBottom(c) { this.cards.push(c); }
  toDiscard(c) { this.discard.push(c); }
}

/** Game-flow interruptions thrown by the engine (caught by the game loop / tests). */
export class GameOver extends Error { constructor(result, msg = '') { super(msg || result); this.result = result; } }
