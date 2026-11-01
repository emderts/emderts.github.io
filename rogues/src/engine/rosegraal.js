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
