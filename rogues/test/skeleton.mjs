// Skeleton test: engine loads, RNG is deterministic, Deck recycles, Game.setup works, build output exists.
import fs from 'fs';
import { Rng, Deck, GameOver } from '../src/engine/core.js';
import { Game } from '../src/engine/game.js';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = { meta: rd('../data/meta.json') };
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

{ const a = new Rng(7), b = new Rng(7); ok([1, 2, 3].every(() => a.int(100) === b.int(100)), 'Rng deterministic for same seed'); }
{ const r = new Rng(3); const rolls = Array.from({ length: 200 }, () => r.die(6)); ok(rolls.every(v => v >= 1 && v <= 6) && new Set(rolls).size === 6, 'die(6) stays in 1..6 and covers all faces'); }
{ const d = new Deck(['a', 'b', 'c'], new Rng(1)); const x = d.draw(); d.toDiscard(x); d.draw(); d.draw(); ok(d.size === 0, 'deck empties'); const y = d.draw(); ok(y === x, 'empty deck reshuffles discard'); ok(d.draw() === null, 'nothing left → null'); }
{ const g = new Game(data, { seed: 5 }); g.setup({ knights: [{ name: 'A' }, { name: 'B' }] }); ok(g.state.phase === 'campaign' && g.state.knights.length === 2 && g.state.knights[1].name === 'B', 'Game.setup creates knights'); const v = g.roll(10); ok(v >= 1 && v <= 10 && g.log.at(-1).kind === 'dice', 'Game.roll logs dice'); }
{ const g = new Game(data); let caught = null; try { g.end('win'); } catch (e) { caught = e; } ok(caught instanceof GameOver && caught.result === 'win' && g.state.phase === 'over', 'Game.end throws GameOver'); }
{ const p = new URL('../dist/rogues.html', import.meta.url); const exists = fs.existsSync(p); ok(exists, 'dist/rogues.html exists (run build first)'); if (exists) { const html = fs.readFileSync(p, 'utf8'); ok(html.includes('window.KF_DATA = {') && !html.includes('__BUNDLE__') && html.includes("Rogue's Path"), 'build injected data + bundle'); } }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
