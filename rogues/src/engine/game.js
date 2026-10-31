// Kingdoms Forlorn — Rogue's Path: game state + flow (skeleton).
// The UI talks to the engine only through: new Game(data, opts), game.ask (async prompt), game.log, game.state.
import { Rng, GameOver } from './core.js';

export class Game {
  constructor(data, opts = {}) {
    this.data = data;
    this.rng = new Rng(opts.seed);
    this.log = [];
    this.state = { phase: 'setup', knights: [], node: null };
    /** UI hook: async (question) => answer. Tests replace it with an auto-answer. */
    this.ask = async q => { throw new Error('game.ask not wired: ' + JSON.stringify(q)); };
  }
  say(msg, kind = 'info') { this.log.push({ msg, kind }); return msg; }
  /** Placeholder setup — will take the Rogue's Path campaign setup (Knights, starting gear, Rosegraal map) once data exists. */
  setup(cfg = {}) {
    this.state.knights = (cfg.knights || []).map((k, i) => ({ id: i, name: k.name || `Knight ${i + 1}`, ...k }));
    this.state.phase = 'campaign';
    this.say(`Rogue's Path 캠페인 시작 — 기사 ${this.state.knights.length}명`);
    return this;
  }
  roll(sides = 6) { const v = this.rng.die(sides); this.say(`d${sides} → ${v}`, 'dice'); return v; }
  end(result) { this.state.phase = 'over'; throw new GameOver(result); }
}
