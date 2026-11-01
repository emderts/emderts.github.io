// Dice (rulebook pp.13–14, 52–53, 57–59): d10 with Crit die, Power/Armor custom d6 pools with colour limits and tier promotion.

export const TIERS = ['red', 'black', 'white'];
export const higherTier = c => TIERS[Math.min(TIERS.indexOf(c) + 1, TIERS.length - 1)];

/**
 * Roll n d10s; the first die is always the white Crit die (p.53/57).
 * Returns { dice:[{v, crit}], critChance (natural 10 on crit die), critFail (natural 1 on crit die) }.
 */
export function rollD10s(rng, n) {
  const dice = Array.from({ length: Math.max(1, n) }, (_, i) => ({ v: rng.die(10), crit: i === 0, rerolled: false }));
  return { dice, critChance: dice[0].v === 10, critFail: dice[0].v === 1 };
}
/** A d10 result is a success/hit when (natural 10) or (value + bonus >= difficulty) and never when natural 1 (p.13, p.57). */
export const d10Success = (v, bonus, difficulty) => v === 10 ? true : v === 1 ? false : v + bonus >= difficulty;

/**
 * Build a Power Pool from requested dice counts per colour, applying the box limits (p.59): red 7 / black 4 / white 3.
 * "If there are no dice of that type available, instead roll a die one tier higher instead of two of these dice (e.g. 8 red →
 *  6 red and 1 black). For each white die that would exceed the limit, gain +1 raw Power and 1 Potential instead."
 * pool: { red, black, white, raw, potential }  (raw = raw Power points, potential = free potentials)
 */
export function buildPowerPool(request, limits = { red: 7, black: 4, white: 3 }) {
  const pool = { red: request.red || 0, black: request.black || 0, white: request.white || 0, raw: request.raw || 0, potential: 0 };
  for (const colour of ['red', 'black']) {
    if (pool[colour] <= limits[colour]) continue;
    const over = pool[colour] - limits[colour]; const up = Math.ceil(over / 2);
    pool[colour] -= 2 * up; pool[higherTier(colour)] += up;
  }
  if (pool.white > limits.white) { const over = pool.white - limits.white; pool.white = limits.white; pool.raw += over; pool.potential += over; }
  return pool;
}

/** Roll a Power Pool with the given face tables. Returns { dice:[{colour, face}], power, potential, hope }. */
export function rollPowerPool(rng, pool, faces) {
  const dice = [];
  for (const colour of TIERS) for (let i = 0; i < (pool[colour] || 0); i++) dice.push({ colour, face: rng.pick(faces[colour]) });
  const sum = k => dice.reduce((a, d) => a + (d.face[k] || 0), 0);
  return { dice, power: sum('P') + (pool.raw || 0), potential: sum('T') + (pool.potential || 0), hope: sum('H') };
}
/** Armor Roll (p.53): roll Armor dice and count the armour symbol (goblet = Potential symbol, confirmed by owner). */
export function rollArmor(rng, counts, faces, symbol = 'T') {
  const dice = [];
  for (const colour of TIERS) for (let i = 0; i < (counts[colour] || 0); i++) dice.push({ colour, face: rng.pick(faces[colour]) });
  return { dice, mitigated: dice.reduce((a, d) => a + (d.face[symbol] || 0), 0) };
}
