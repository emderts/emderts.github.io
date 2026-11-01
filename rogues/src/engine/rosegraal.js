// Rosegraal helpers: node → random Monster (Rulebook p.76–77).
// "When you choose which node to tackle, you will have to battle a random Monster from the chosen Kingdom, at the node's level."
// Starred Monsters: "If you don't own the Monster, re-roll."

export const TIER_NAMES = { 1: 'Mob', 2: 'Vassal', 3: 'King', 4: 'Devil', 5: 'Dragon' };

/** Rows of the monster table for a node (level 1–5, kingdom 'principality'|'sunken'). */
export function monsterTable(tables, level, kingdom) {
  const rows = tables.levels[String(level)] && tables.levels[String(level)][kingdom];
  if (!rows) throw new Error(`no monster table for level ${level} / ${kingdom}`);
  return rows;
}

/**
 * Roll a d10 on the node's table. Rows whose monster is not owned are re-rolled (max 100 tries, then throws).
 * owned: Set/array of monster ids the player owns, or null = owns everything.
 * Returns { roll, rolls:[...all rolls], monster, level, name, rerolled }.
 */
export function rollMonster(tables, rng, level, kingdom, owned = null) {
  const rows = monsterTable(tables, level, kingdom);
  const has = id => !owned || (owned instanceof Set ? owned.has(id) : owned.includes(id));
  if (!rows.some(r => has(r.monster))) throw new Error(`no owned monster in table ${level}/${kingdom}`);
  const rolls = [];
  for (let i = 0; i < 100; i++) {
    const roll = rng.die(10); rolls.push(roll);
    const row = rows.find(r => r.roll.includes(roll));
    if (!row) throw new Error(`table ${level}/${kingdom} has no row for roll ${roll}`);
    if (has(row.monster)) return { roll, rolls, monster: row.monster, level: row.level, name: tables.monsterNames[row.monster] || row.monster, rerolled: rolls.length - 1 };
  }
  throw new Error('rollMonster: too many re-rolls');
}

// ---- Rosegraal Rewards (Rulebook p.76 + pp.92–96) ----
// "each participating Knight also gains one reward of a given kind (…) of the current Node level or lower, as indicated by
//  the reward symbol next to the conquered node. (…) each reward can be claimed only once!"
export const SIGH = 'S';

/** Stable id for one reward checkbox: `${knight}:${level}:${kind}:${index}` */
export const rewardId = (knight, level, kind, index) => `${knight}:${level}:${kind}:${index}`;

/**
 * All unclaimed rewards a Knight may pick for a node of `nodeLevel` with reward symbol `kind` (C/H/P/T/V/G/W).
 * claimed: Set of rewardIds already taken by this Knight. Returns [] when nothing is left (node still gets crossed out).
 */
export function eligibleRewards(rewards, knight, kind, nodeLevel, claimed = new Set()) {
  if (kind === SIGH || !rewards.kinds[kind]) return [];
  const out = [];
  for (let lv = 1; lv <= nodeLevel; lv++) {
    const row = rewards.levels[String(lv)] && rewards.levels[String(lv)][knight];
    if (!row) continue;
    (row[kind] || []).forEach((r, i) => { const id = rewardId(knight, lv, kind, i); if (!claimed.has(id)) out.push({ id, level: lv, kind, reward: r }); });
  }
  return out;
}
