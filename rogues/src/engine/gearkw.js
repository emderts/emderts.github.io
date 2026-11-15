// Gear keyword parser (Rulebook Keyword List pp.80–87, Gear rules p.21): turns the ability text of a Gear / Upgrade / Consumable card into
// structured keywords. Each sentence becomes { op, n?, m?, gate?, kingdom?, twoHanded?, reaction?, cost?, status, text }.
// status: 'ok' = resolved by the engine · 'pending' = recognised keyword, no engine effect yet · 'na' = irrelevant in these Kingdoms ·
// 'text' = free text the parser does not understand (resolved manually by the players).
const TOKENS = { 'Break': 'break', 'Opening': 'opening', 'Closing': 'closing', 'Hope': 'hope', 'Black': 'black', 'Sunder': 'sunder', 'Fire': 'fire', 'Power': 'power', 'Cantrip': 'cantrip', 'Spell': 'spell', 'Rouse': 'rouse', 'Diversion': 'diversion', 'Improved Diversion': 'improvedDiversion', 'Fleisch': 'fleisch' };
const OK = { 'Commit': 'commit', 'Cumbersome': 'cumbersome', 'Tireless': 'tireless', 'Deadly': 'deadly', 'Overbreak': 'overbreak', 'Envenomed': 'envenomed', 'Attack Re-roll': 'attackReroll', 'Power Re-roll': 'powerReroll',
  'Reposition': 'reposition', 'Pushback': 'pushback', 'Vault': 'vault', 'Hug': 'hug', 'Daze': 'daze', 'Provoke': 'provoke', 'Inspire': 'inspire', 'Motivate': 'motivate', 'Drag': 'drag', 'Reach': 'reach', 'Unwieldy': 'unwieldy',
  'Soak': 'soak', 'Poison Resilience': 'poisonResilience', 'Tumble': 'tumble', 'Stalwart': 'stalwart', 'Rocksteady': 'rocksteady', 'Braced': 'braced', 'Armor-piercing': 'armorPiercing',
  'Deploy': 'deploy', 'Guard': 'guard', 'Pull': 'pull', 'Knockback': 'knockback', 'Second Chance': 'secondChance', 'Superior Chance': 'secondChance', 'Lifeline': 'lifeline', 'Reflex': 'reflex', 'Advanced Reflex': 'reflex2', 'Superior Reflex': 'reflex3', 'Precise': 'precise', 'Bypass': 'bypass', 'Advanced Bypass': 'bypass', 'Defy': 'defy', 'Advanced Defy': 'defy2', 'Superior Defy': 'defy3',
  'Block': 'block', 'Advanced Block': 'block2', 'Superior Block': 'block3', 'Dodge': 'dodge', 'Lesser Dodge': 'dodge0', 'Advanced Dodge': 'dodge2', 'Superior Dodge': 'dodge3', 'Reinforce': 'reinforce', 'Advanced Reinforce': 'reinforceBlack', 'Superior Reinforce': 'reinforceWhite' };
const PENDING = ['Ammo Reserves', 'Superior Bypass', 'Armor Re-roll', 'Hide', 'Pass', 'Greater Pass', 'Spotlight', 'Heartseeker', 'Soulseeker', 'Fortify', 'Acrobatics', 'Roll Out', 'Jump', 'Advanced Jump', 'Area', 'Bane', 'Parasitize', 'Poison', 'Toxify', 'Sacrifice', 'Rush', 'Improved Rush', 'Refresh', 'Falsity', 'Zeal', 'Devote', 'Magic', 'Scavenge', 'Suppress', 'BP Suppress', 'AI Suppress', 'Immune to Fear', 'Ignore Lumbering', 'Ignore Obscuring'];
const NA = ['Wither', 'Growth', 'Clockwork', 'Bloodletter', 'Leech'];
const camel = s => s.replace(/[^A-Za-z ]/g, '').split(' ').map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('');
/** Keywords the engine resolves only when printed without a cost (constant) — with a cost they are 'pending' unless listed in ACTIVE_OK. */
const DEFENSIVE = new Set(['block', 'block2', 'block3', 'dodge', 'dodge0', 'dodge2', 'dodge3', 'reinforce', 'reinforceBlack', 'reinforceWhite', 'defy', 'defy2', 'defy3']);
const ACTIVE_OK = new Set([...DEFENSIVE, 'guard', 'secondChance', 'lifeline', 'reflex', 'reflex2', 'reflex3', 'precise', 'braced', 'stalwart']);

/** Card-specific sentences resolved by dedicated engine hooks (gear of the implemented monsters first). `free` = free action on your turn. */
const SPECIAL = [
  [/^Gain \+(\d+) \[Vigor\]$/, m => ({ op: 'fGainVigor', n: +m[1], free: true })],
  [/^Discard all Condition cards$/, () => ({ op: 'fDiscardAllConditions', free: true })],
  [/^Flip a Condition card$/, () => ({ op: 'fFlipCondition', free: true })],
  [/^Gain the Slimed Condition card to discard another Condition card$/, () => ({ op: 'fSlimedSwap', free: true })],
  [/^Discard 1 Condition token$/, () => ({ op: 'fDiscardCondToken', free: true })],
  [/^Place the top BP card at the bottom of the deck$/, () => ({ op: 'fBPBottom', free: true })],
  [/^Move X spaces in a straight line, where X is twice your Speed \[Speed\]$/, () => ({ op: 'fStraight', free: true })],
  [/^Flip an adjacent Mob's BP card$/, () => ({ op: 'fFlipMobBP', free: true })],
  [/^Discard a Generic token from an adjacent Pumpkinhead$/, () => ({ op: 'fPumpToken', free: true })],
  [/^Perform a Climb action in Zone 2$/, () => ({ op: 'fClimbZone2', free: true })],
  [/^Full Miss: Exhaust this card$/, () => ({ op: 'fullMissExhaust' })],
  [/^When you attack a Monster with 1\+ Armor \[Armor\] tokens, gain Deadly$/, () => ({ op: 'deadlyVsArmor' })],
  [/^While you're on a Rear space, gain Deadly$/, () => ({ op: 'deadlyRear' })],
  [/^When adjacent to the Monster you're attacking, gain \+(\d+) \[Power\]$/, m => ({ op: 'powerAdjacent', n: +m[1] })],
  [/^During your attack, gain \+(\d+) \[Power\]$/, m => ({ op: 'attackPower', n: +m[1], active: true })],
  [/^Start of Clash: If fighting the Eggknight, gain \+(\d+) \[Passion\]$/, m => ({ op: 'startPassionVs', monster: 'eggknight', n: +m[1] })],
  [/^Loses Commit$/, () => ({ op: 'losesCommit' })],
  [/^Each hit: Reposition (\d+)$/, m => ({ op: 'repositionPerHit', n: +m[1] })],
  [/^When you deal a Wound, Knockback (\d+)$/, m => ({ op: 'woundKnockback', n: +m[1] })],
  [/^When you Pushback a Monster into an Obstacle, immediately place (\d+) Break \[Break\] token in the Knight Pool$/, m => ({ op: 'pushObstacleBreak', n: +m[1] })],
  [/^When you attack with another Weapon, that Weapon gains \+1 Precision \[Precision\] and Auto-break 1$/, () => ({ op: 'assistOtherWeapon', active: true })],
  [/^To attack with this Weapon, spend (\d+) \[Charge\]$/, m => ({ op: 'chargeToAttack', n: +m[1] })],
  [/^When you Escalate, (AI or BP|AI|BP) Suppress$/, m => ({ op: 'escalateSuppress', which: m[1] })],
  [/^You cannot involuntarily Discard \[Discard\] Technique cards from your hand$/, () => ({ op: 'noDiscard' })],
  [/^You cannot involuntarily Discard \[Discard\] or Delay \[Delay\] Technique cards from your hand$/, () => ({ op: 'noDiscardDelay' })],
  [/^Discard a Condition card and gain \+(\d+) \[Vigor\]$/, m => ({ op: 'fCondVigor', n: +m[1], free: true })],
  [/^Turn a chosen revealed BP face down$/, () => ({ op: 'fBPFaceDown', free: true })],
  [/^Gain \+(\d+) \[Power\] against Undead$/, m => ({ op: 'powerVsUndead', n: +m[1] })],
  [/^Wound: Gain (\d+) permanent positive Precision \[Precision\] tokens$/, m => ({ op: 'woundPermPrecision', n: +m[1] })],
  [/^Full Miss: Skip the Clear the Knight Pool step$/, () => ({ op: 'fullMissKeepPool' })],
  [/^Each hit: Opening (\d+)$/, m => ({ op: 'eachHitOpening', n: +m[1] })],
  [/^Full hit: Power (\d+)$/i, m => ({ op: 'fullHitPower', n: +m[1] })],
  [/^Full Hit: Daze$/i, () => ({ op: 'fullHitDaze' })],
  [/^Each hit: Hug 1, Pushback 1, and Armor-piercing 1$/, () => ({ op: 'eachHitHPA' })],
  [/^When attacking with a Reach or \[Hand\] Melee Weapon, gain \+(\d+) \[Power\]$/, m => ({ op: 'powerReachHand', n: +m[1] })],
  [/^Ignore the Gash and Giant Gash Mortis cards$/, () => ({ op: 'ignoreMortis', names: ['Gash', 'Giant Gash'] })],
  [/^When you're about to suffer Suck, ignore it$/, () => ({ op: 'ignoreSuck', active: true })],
  [/^You may reduce suffered Gangups by (\d+)$/, m => ({ op: 'reduceGangup', n: +m[1] })],
  [/^\+(\d+) \[Power\]$/, m => ({ op: 'flatPower', n: +m[1] })],
  [/^Start of your turn: Bane (\d+)$/, m => ({ op: 'turnBane', n: +m[1] })],
  [/^Ignore Burrow X$/, () => ({ op: 'ignoreBurrow', active: true })],
  [/^(Improved Rush|Rush)$/, m => ({ op: 'fRush', improved: m[1] !== 'Rush', free: true })],
  [/^(?:You must equip this card if you own it|You cannot discard this card in any way|When you die, return this card to the box \(you do not own it anymore\)|X must be \d+ or more|You cannot equip this Upgrade on a Weapon with .*|Use this ability only during a Monster Attack, after an Evasion Roll|You must use this ability before performing the draw)$/, () => ({ op: 'note', na: true })],
  [/^Start of your turn: Lose -(\d+) \[Vigor\]$/, m => ({ op: 'turnLoseVigor', n: +m[1] })],
  [/^Gain \+(\d+) Speed \[Speed\] for each Bane \[Bane\] token you have$/, m => ({ op: 'speedPerBane', n: +m[1] })],
  [/^Gain \+(\d+) Precision \[Precision\] for each Bane \[Bane\] token you have$/, m => ({ op: 'precisionPerBane', n: +m[1] })],
  [/^If you're (\d+) or more spaces away from the closest Monster, gain \+(\d+) Speed \[Speed\]$/, m => ({ op: 'speedFar', d: +m[1], n: +m[2] })],
  [/^When you deal a Wound, Bane (\d+)$/, m => ({ op: 'woundBane', n: +m[1] })],
  [/^Gain \+(\d+) \[Power\] against Dragons$/, m => ({ op: 'powerVsTrait', trait: 'Dragon', n: +m[1] })],
  [/^Gain \+(\d+) Precision \[Precision\]$/, m => ({ op: 'flatPrecision', n: +m[1] })],
  [/^Full Miss: Skip the Clear the Knight Pool step of your Attack$/, () => ({ op: 'fullMissKeepPool' })],
  [/^Lose -(\d+) \[Heat\]$/, m => ({ op: 'fLoseHeat', n: +m[1], free: true })],
  [/^Place (\d+) Break \[Break\] or \d+ Opening \[Opening\] token in the Knight Pool$/, m => ({ op: 'fPoolBreakOpening', n: +m[1], free: true })],
  [/^Gain \+(\d+) \[Vigor\] or discard (\d+) Poison token$/, m => ({ op: 'fVigorOrPoison', n: +m[1], p: +m[2], free: true })],
  [/^Move (\d+) space$/, m => ({ op: 'fMove', n: +m[1], free: true })],
  [/^Unexhaust (\d+) Weapon \[Gear\] card$/, () => ({ op: 'fUnexhaustWeapon', free: true })],
  [/^Gain a permanent positive Precision \[Precision\] token$/, () => ({ op: 'fPermPrecision', free: true })],
  [/^Reset your \[Vigor\]$/, () => ({ op: 'fResetVigor', free: true })],
  [/^Look at the top BP card of the closest Monster$/, () => ({ op: 'fLookBP', free: true })],
  [/^Gain (\d+) \[Charge\]$/, m => ({ op: 'fGainCharge', n: +m[1], free: true })],
  [/^Discard (\d+) Armor \[Armor\] tokens? from anywhere$/, m => ({ op: 'fDiscardArmor', n: +m[1], free: true })],
  [/^Hide$/, () => ({ op: 'hide', active: true })],
  [/^Full hit: You may trigger Overcome or Overpower$/i, () => ({ op: 'fullHitOvercome' })],
  [/^When you trigger Overpower, lose -(\d+) \[Heat\] and ignore Cumbersome$/, m => ({ op: 'overpowerBoon', n: +m[1] })],
  [/^Sacrifice$/, () => ({ op: 'sacrifice' })],
  [/^Your other Weapons gain Sacrifice$/, () => ({ op: 'othersSacrifice' })],
  [/^When you are about to attack, you may change up to (\d+) (?:Opening \[Opening\] tokens in the Knight Pool into Break \[Break\]|Break \[Break\] tokens in the Knight Pool into Opening \[Opening\]) tokens and vice versa$/, m => ({ op: 'poolSwap', n: +m[1], active: true })],
  [/^When you attack, you may lose -(\d+) \[Vigor\] to gain Auto-break (\d+)$/, m => ({ op: 'vigorAutoBreak', v: +m[1], n: +m[2] })],
  [/^All adjacent Knights have \+(\d+) Precision \[Precision\]$/, m => ({ op: 'auraPrecision', n: +m[1] })],
  [/^Start of Clash: Gain (\d+) \[Charge\]$/, m => ({ op: 'startCharge', n: +m[1] })],
  [/^Discard X Bane \[Bane\] tokens$/, () => ({ op: 'fDiscardBaneX', free: true })],
  [/^When you are hit by a Monster Attack, place (\d+) Opening \[Opening\] and (\d+) Black \[Black\] token in the Knight Pool$/, m => ({ op: 'hitPoolTokens', opening: +m[1], black: +m[2] })],
  [/^When you become the Target of a Monster Attack, you may gain \+(\d+) Evasion \[Evasion\] or (\d+) \[Evasion Re-roll\]$/, m => ({ op: 'targetEvasionChoice', e: +m[1], r: +m[2] })],
  [/^If you do, and fail to Fully Evade, lose -(\d+) \[Vigor\]$/, m => ({ op: 'targetEvasionPenalty', n: +m[1] })],
  [/^When drawing a Judicium, remove all Massive Peril Judicium cards from the deck \(for this draw only\)$/, () => ({ op: 'judiciumNoMassive', active: true })],
  [/^After drawing a Judicium, resolve the opposite Judicium$/, () => ({ op: 'judiciumOpposite', active: true })],
  [/^When you (?:perform a \[Move action\]|are performing a \[Move action\]|performing a \[Move action\]), gain \+(\d+) Speed \[Speed\](?: for that movement)?$/i, m => ({ op: 'fMoveSpeed', n: +m[1], free: true })],
  [/^When performing a \[Move action\], gain \+(\d+) Speed \[Speed\]$/, m => ({ op: 'fMoveSpeed', n: +m[1], free: true })],
  [/^Crit Chance: Armor-piercing (\d+)$/, m => ({ op: 'critAP', n: +m[1] })],
  [/^Reduce suffered Pull by up to (\d+)$/, m => ({ op: 'reducePull', n: +m[1], active: true })],
  [/^You may reduce suffered Drags and Pulls by (\d+)$/, m => ({ op: 'reduceDragPull', n: +m[1] })],
  [/^Full Miss: Do not clear the Knight Pool$/, () => ({ op: 'fullMissKeepPoolPaid', active: true })],
  [/^Discard (\d+) Bane \[Bane\] tokens?$/, m => ({ op: 'fDiscardBane', n: +m[1], free: true })],
  [/^(?:You may use this ability more than once per turn|Ignore this ability's costs when fighting the White Ape Troll)$/, () => ({ op: 'note', na: true })],
  [/^Immediately discard this card and Bane (\d+)$/, m => ({ op: 'gateDiscardBane', n: +m[1] })],
  [/^Move the closest Monster X spaces directly away from you$/, () => ({ op: 'fPushAway', free: true })],
  [/^Full Hit: During the second ability window, place a temporary negative AT \[AT\] token in the Knight Pool$/i, () => ({ op: 'fullHitNegAT' })],
  [/^When you deal a Wound, place (\d+) temporary negative AT \[AT\] token in the Knight Pool$/, m => ({ op: 'woundNegAT', n: +m[1], active: true })],
  [/^When you are hit with a Monster Attack, you may suffer Poison (\d+) to place (\d+) temporary negative AT \[AT\] token in the Knight Pool$/, m => ({ op: 'hitPoisonNegAT', p: +m[1], n: +m[2] })],
  [/^When you deal a Wound, place 1 temporary negative Speed \[Speed\] token on the Monster Sheet$/, () => ({ op: 'woundSlow', active: true })],
  [/^The next time that Monster moves, discard that token and stop the movement after 3 spaces$/, () => ({ op: 'note', na: true })],
  [/^\*(\d+) \[d10\] instead$/, m => ({ op: 'attackDiceInstead', n: +m[1] })],
  [/^For the purpose of gathering your Power Pool, ignore any hits that exceed this Weapon's original \[d10\] value$/, () => ({ op: 'powerHitCap' })],
  [/^Roll Out(?: \(.*\))?$/, () => ({ op: 'rollOut', active: true })],
  [/^Ignore Swamp Terrain tiles$/, () => ({ op: 'ignoreSwamp' })],
  [/^When you're about to suffer involuntary movement, you may reduce it by 1 \(to a minimum of 1\)$/, () => ({ op: 'reduceInvol' })],
  [/^Take Root: If you didn't move during your turn, gain Braced until you move$/, () => ({ op: 'takeRoot' })],
  [/^After you wound a Pumpkinhead, place the Sapling in its place instead of random coordinates$/, () => ({ op: 'saplingInPlace', active: true })],
];
function body(b) {
  let m;
  for (const [re, fn] of SPECIAL) if ((m = re.exec(b))) { const r = fn(m); return { ...r, status: r.na ? 'na' : 'ok', special: true }; }
  if ((m = /^Auto-([a-z]+) (\d+|X)$/i.exec(b))) { const t = TOKENS[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()]; return t ? { op: 'auto', token: t, n: m[2] === 'X' ? 'X' : +m[2], status: m[2] === 'X' ? 'pending' : 'ok' } : null; }
  if ((m = /^Ranged (\d+)[-–](\d+|X)$/.exec(b))) return { op: 'ranged', n: +m[1], m: m[2] === 'X' ? 'X' : +m[2], status: m[2] === 'X' ? 'pending' : 'ok' };
  if ((m = /^\+(\d+) \[Power\]$/.exec(b))) return { op: 'plusPower', n: +m[1], status: 'ok' };
  if ((m = /^\+(\d+) (?:Precision )?\[Precision\]$/.exec(b))) return { op: 'plusPrecision', n: +m[1], status: 'ok' };
  if ((m = /^([+-]\d+) Speed \[Speed\]$/.exec(b))) return { op: 'speed', n: +m[1], status: 'ok' };
  if ((m = /^\+(\d+) (?:Evasion )?\[Evasion\]$/.exec(b))) return { op: 'plusEvasion', n: +m[1], status: 'ok' };
  if ((m = /^Poison Limit \+(\d+)$/.exec(b))) return { op: 'poisonLimit', n: +m[1], status: 'ok' };
  if ((m = /^Bane Limit \+?(\d+)$/.exec(b))) return { op: 'baneLimit', n: +m[1], status: 'na' };
  if ((m = /^\+(\d+) (Bravery|Tenacity|Fortitude|Might|Insight|Sagacity) \[\2\]$/.exec(b))) return { op: 'virtue', virtue: m[2], n: +m[1], status: 'ok' };
  if ((m = /^(.+?) or (.+)$/.exec(b))) { const a = body(m[1]), c = body(m[2]); if (a && c && a.status !== 'text' && c.status !== 'text') return { op: 'choice', options: [a, c], status: a.status === 'ok' && c.status === 'ok' ? 'ok' : 'pending' }; }
  if ((m = /^([A-Z][A-Za-z\-]*(?: [A-Z][A-Za-z\-]*)*?)(?: (\d+|X))?$/.exec(b))) {
    const name = m[1], n = m[2] == null ? null : m[2] === 'X' ? 'X' : +m[2];
    if (TOKENS[name]) return { op: 'token', token: TOKENS[name], n: n == null ? 1 : n, status: n === 'X' ? 'pending' : 'ok' };
    if (OK[name]) return { op: OK[name], n, status: n === 'X' ? 'pending' : 'ok' };
    if (PENDING.includes(name)) return { op: camel(name), n, status: 'pending' };
    if (NA.includes(name)) return { op: camel(name), n, status: 'na' };
  }
  return null;
}
/** Parse one sentence of ability text. */
export function parseSentence(s) {
  const text = s.trim(); let r = text.replace(/\.$/, '').trim(); const o = {};
  for (let guard = 0; guard < 8; guard++) { let m;
    if ((m = /^\[(MINOR|MAJOR|GRAVE|JUDICIUM)\]\s*/.exec(r))) { o.gate = m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[(PRINCIPALITY OF STONE|SUNKEN KINGDOM)\]\s*/.exec(r))) { o.kingdom = m[1] === 'SUNKEN KINGDOM' ? 'sunken' : 'principality'; r = r.slice(m[0].length); continue; }
    if ((m = /^\[BANE (\d+)\+\]\s*/.exec(r))) { o.baneMin = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Move action\]\+\[Combat action\]\s*/i.exec(r))) { (o.cost = o.cost || {}).action = 'both'; r = r.slice(m[0].length); continue; }
    if ((m = /^\[(?:PASSION|P) (\d+)\+\]\s*/.exec(r))) { o.passionMin = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Combat action\]\+\[Move action\]\s*/i.exec(r)) || (m = /^\[Move\+Attack action\]\s*/i.exec(r))) { (o.cost = o.cost || {}).action = 'both'; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Move action\] or \[Combat action\]\s*/i.exec(r))) { o.eitherAction = true; r = r.slice(m[0].length); continue; }
    if ((m = /^X \[Charge\]\s*/.exec(r))) { o.chargeX = true; r = r.slice(m[0].length); continue; }
    if ((m = /^X \[Heat\]\s*/.exec(r))) { o.heatX = true; r = r.slice(m[0].length); continue; }
    if ((m = /^Start of your turn:\s*(?=\d+ \[Heat\])/.exec(r))) { o.atTurnStart = true; r = r.slice(m[0].length); continue; }
    if ((m = /^When you trigger Overcome X in Melee range:\s*/.exec(r))) { o.overcomeMelee = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[2H\]\s*/.exec(r))) { o.twoHanded = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Two-handed(?: icon)?\]:?\s*/i.exec(r))) { o.twoHanded = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Reaction\]\s*/.exec(r))) { o.reaction = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[(Combat|Move|Attack|Movement|Complicated) action\]\s*/i.exec(r))) { (o.cost = o.cost || {}).action = m[1].toLowerCase(); r = r.slice(m[0].length); continue; }
    if ((m = /^(\d+) \[Heat\]\s*/.exec(r))) { (o.cost = o.cost || {}).heat = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Exhaust\]\s*/.exec(r))) { (o.cost = o.cost || {}).exhaust = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Discard\]\s*/.exec(r))) { (o.cost = o.cost || {}).discard = true; r = r.slice(m[0].length); continue; }
    if ((m = /^(\d+) \[Charge\]\s*/.exec(r))) { (o.cost = o.cost || {}).charge = +m[1]; r = r.slice(m[0].length); continue; }
    break; }
  const b = body(r); if (!b) { if (/\b(Delve|Deep Fog|Trailmake|Wander|Rotation|Adventure|Ambush|Encounter|Exploration|Shortcuts?|Possessed|Clues?|District|Investigation)\b/.test(text)) return { op: 'nonClash', status: 'na', text }; return { op: 'text', status: 'text', text }; }
  const k = { ...b, ...o, text }; if (k.atTurnStart && k.op === 'hide') k.op = 'hideStart'; if (k.status === 'ok' && (k.cost || k.reaction) && !ACTIVE_OK.has(k.op) && !k.special) k.status = 'pending'; // costed versions of constant keywords need their own timing window
  return k;
}
/** Parse a whole ability text → list of keywords (one per sentence). */
export function parseGearText(text) { if (!text) return []; return String(text).replace(/(Crit Chance|in Melee range):\n/g, '$1: ').split(/\n|(?<=\.)\s+(?=[\[A-Z+\-\d])/).map(s => s.trim()).filter(Boolean).map(parseSentence); }
export const isDefensive = op => DEFENSIVE.has(op);
export const KEYWORD_STATUS = { TOKENS, OK, PENDING, NA };
