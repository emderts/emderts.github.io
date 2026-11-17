// Places the REACT! windows recorded on AI / Signature cards (reactWindows / react) into the card ops as `reactWindow` ops, so that
// windows open exactly where the card prints them: 'targeting' (after Targeting — handled by the attack flow), 'effect:N' / "after '<sentence>'"
// (after the N-th printed effect line), 'afterAttack' / 'afterFinalAttack'. Cards built with exact windows (reactExact) are left alone.
const norm = x => String(x).replace(/\s+/g, ' ').trim().toLowerCase();
/** Printed lines and ops do not line up one-to-one on these cards: op index before which the mid-effect window opens. */
const MID = {
  'eggknight|Eggbutt': { 1: 3 }, 'eggknight|Knightscramble': { 1: 3 }, 'eggknight|Humpty Quake': { 1: 3 },
  'first-men-warriors|Fierce Charge': { 2: 4 }, 'ironcast-dead|Automated Slash': { 2: 2 },
  'white-ape-troll|Rampage Strike': { 1: 3 }, 'white-ape-troll|Feral Blow': { 2: 4 },
  'winged-nightmare|Dive Slam': { 1: 2 }, 'winged-nightmare|Rending Swoop': { 0: 2 },
};
const AFTER = { 'white-ape-troll|Ramming Charge': { afterFinalAttack: 1 } };
const RW = at => ({ op: 'reactWindow', at });
const has = list => JSON.stringify(list || []).match(/"(wnReact|reactWindow)"/);

export function applyReactPlan(def) {
  if (!def || def._reactPlanned || !def.cards) return []; def._reactPlanned = true; const unresolved = [];
  for (const card of [...(def.cards.ai || []), def.cards.signature].filter(Boolean)) {
    if (card.reactExact || !card.ops) continue; const w = card.reactWindows ?? card.react; if (w == null) continue; card.reactExact = true;
    const ops = card.ops, lines = card.effects || [], key = def.id + '|' + card.name; const mids = new Set(); let end = false;
    for (const raw of [].concat(w)) {
      const x = String(raw); if (/^(after )?targeting$/i.test(x) || x === 'moveTag') continue;
      const aa = x.match(/^(afterAttack|afterFinalAttack)/);
      if (aa) { const k = aa[1]; if (!ops[k] || has(ops[k])) continue; const i = (AFTER[key] || {})[k] || 0; ops[k] = [...ops[k].slice(0, i), RW('after'), ...ops[k].slice(i)]; continue; }
      const m = x.match(/^effect:(\d+)$/), s = x.match(/^after '(.+)'$/); let i = null;
      if (m) i = +m[1]; else if (s) { i = lines.findIndex(l => norm(l).startsWith(norm(s[1])) || norm(s[1]).startsWith(norm(l))); if (i < 0) i = null; }
      if (i == null) { unresolved.push(`${key}: ${x}`); continue; }
      if (i >= lines.length - 1) end = true; else mids.add(i);
    }
    if (has(ops.effects)) continue; const eff = [...(ops.effects || [])]; const at = [];
    for (const i of mids) { const o = (MID[key] || {})[i]; if (o != null) at.push(o); else if (lines.length === eff.length) at.push(i + 1); else unresolved.push(`${key}: effect:${i}`); }
    for (const i of at.sort((a, b) => b - a)) eff.splice(Math.min(i, eff.length), 0, RW('mid'));
    if (end) { if (ops.afterAttack && ops.afterAttack.length && !has(ops.afterAttack)) ops.afterAttack = [RW('after'), ...ops.afterAttack]; else if (ops.afterFinalAttack && ops.afterFinalAttack.length && !ops.afterAttack && !has(ops.afterFinalAttack)) ops.afterFinalAttack = [RW('after'), ...ops.afterFinalAttack]; else eff.push(RW('mid')); }
    ops.effects = eff;
  }
  return unresolved;
}
