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
  [/^Gain \+(\d+) \[Power\] against (?:the )?(Dragon|King|Devil|Stonemason Knight)s?$/, m => ({ op: 'powerVsTrait', trait: m[2], n: +m[1] })],
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
  [/^Falsity$/, () => ({ op: 'falsity' })],
  [/^Crit Evade Fail: Immediately Zeal (\d+)$/, m => ({ op: 'critEvadeFailZeal', n: +m[1] })],
  [/^When you are about to proceed to the second ability window, you may change your active Weapon to another .*Weapon you have equipped$/, () => ({ op: 'swapWeaponSecond' })],
  [/^If you don't, Zeal (\d+)$/, m => ({ op: 'elseZeal', n: +m[1] })],
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
  [/^When any Knight Full Misses, do not clear the Knight Pool$/, () => ({ op: 'anyFullMissKeepPool' })],
  [/^Flip a revealed card face down$/, () => ({ op: 'fBPFaceDown', free: true })],
  [/^Place the top BP or AI card at the bottom of the deck$/, () => ({ op: 'fBPorAIBottom', free: true })],
  [/^Each hit: (Sunder|Opening|Closing|Break|Hope|Black|Fire) (\d+)$/, m => ({ op: 'eachHitToken', token: m[1].toLowerCase(), n: +m[2] })],
  [/^Each hit: \+(\d+) \[Power\]$/, m => ({ op: 'eachHitPower', n: +m[1] })],
  [/^Full Hit: AI Suppress$/i, () => ({ op: 'fullHitAISuppress' })],
  [/^Full Miss: Gain \+(\d+) \[Passion\]$/, m => ({ op: 'fullMissPassion', n: +m[1] })],
  [/^Start of your turn: Gain \+(\d+) \[Vigor\] and Bane (\d+)$/, m => ({ op: 'turnVigorBane', v: +m[1], n: +m[2] })],
  [/^Start of your turn: Gain (\d+) Bane \[Bane\] token$/, m => ({ op: 'turnBane', n: +m[1] })],
  [/^When you are about to attack, Bane (\d+)$/, m => ({ op: 'attackBane', n: +m[1] })],
  [/^Place (?:a|(\d+)) (Fire|Break|Opening|Hope|Black|Closing|Power) \[\w+\] tokens? in the Knight Pool$/, m => ({ op: 'fPoolToken', token: m[2].toLowerCase(), n: +(m[1] || 1), free: true })],
  [/^You may use this ability multiple times per turn$/, () => ({ op: 'note', na: true })],
  [/^When you attack, place a Diversion \[Diversion\] token in the Knight Pool$/, () => ({ op: 'attackDiversion', active: true })],
  [/^Discard a Condition card$/, () => ({ op: 'fDiscardCond', free: true })],
  [/^Bane (\d+) to gain \+(\d+) \[Vigor\]$/, m => ({ op: 'fBaneVigor', b: +m[1], n: +m[2], free: true })],
  [/^Immune to Bane$/, () => ({ op: 'immuneBane' })],
  [/^Gain \+(\d+) \[Evasion\]$/, m => ({ op: 'plusEvasion', n: +m[1] })],
  [/^Gain \+(\d+) Precision \[Precision\] for each knocked down Knight$/, m => ({ op: 'precisionPerKnockedDown', n: +m[1] })],
  [/^When you(?:'re| are) about to gain Bane \[Bane\] tokens, lower that gain to (\d+)$/, m => ({ op: 'baneLower', n: +m[1], active: true })],
  [/^When you're about to gain Bane \[Bane\] tokens, you may lose that much \[Vigor\] instead$/, () => ({ op: 'baneToVigor' })],
  [/^When you(?:'re| are) about to die, ignore (?:that|this) death$/, () => ({ op: 'ignoreDeath', active: true })],
  [/^When drawing a Judicium, resolve the opposite Judicium to the one you drew$/, () => ({ op: 'judiciumOpposite', active: true })],
  [/^When you are about to resolve a \[Peril Check\], ignore it$/, () => ({ op: 'ignorePeril', active: true })],
  [/^When you're hit by a Mob Monster, you may reveal that Mob's BP card$/, () => ({ op: 'hitRevealMob' })],
  [/^When you're about to attack, you may reset your \[Passion\]$/, () => ({ op: 'attackResetPassion' })],
  [/^If you do, reset your \[Heat\]$/, () => ({ op: 'note', na: true })],
  [/^When you are hit, discard (\d+) \[Charge\]$/, m => ({ op: 'hitDiscardCharge', n: +m[1] })],
  [/^If you cannot, discard this card instead$/, () => ({ op: 'note', na: true })],
  [/^Spotlight$/, () => ({ op: 'spotlight' })],
  [/^(?:When you attack, gain Spotlight for that Attack|Your Weapon gains Spotlight)$/, () => ({ op: 'spotlightPaid', active: true })],
  [/^\+(\d+) \[d10\]$/, m => ({ op: 'plusAttackDice', n: +m[1] })],
  [/^Gain \+(\d+) \[d10\]$/, m => ({ op: 'plusAttackDice', n: +m[1] })],
  [/^Your Weapon gains \+(\d+) \[d10\]$/, m => ({ op: 'weaponPlusDice', n: +m[1] })],
  [/^For the purpose of gathering your Power Pool, ignore any hits that exceed your Weapon's regular \[d10\] value$/, () => ({ op: 'powerHitCapAll' })],
  [/^When (?:you perform|performing) ↑\[Heat\]↓, lose additional -(\d+) \[Heat\]$/, m => ({ op: 'heatRefreshExtra', n: +m[1] })],
  [/^Perform ↑\[Heat\]↓$/, () => ({ op: 'fHeatRefresh', free: true })],
  [/^When you attack, lose -(\d+) \[Heat\]$/, m => ({ op: 'attackLoseHeat', n: +m[1] })],
  [/^You do not benefit from Opening \[Opening\] tokens$/, () => ({ op: 'noOpening' })],
  [/^\+(\d+) Speed$/, m => ({ op: 'speed', n: +m[1] })],
  [/^Lose -X \[Heat\], where X is the Level of the top BP card$/, () => ({ op: 'fLoseHeatBP', free: true })],
  [/^Immediately gain \+(\d+) \[Passion\] \(once per Clash\)$/, m => ({ op: 'gatePassion', n: +m[1] })],
  [/^Reduce involuntary movement by up to X, where X is the amount of Bane \[Bane\] tokens you have$/, () => ({ op: 'reduceInvolBane' })],
  [/^End of your turn: If this card has no \[Charge\], lose -(\d+) \[Vigor\]$/, m => ({ op: 'endTurnNoCharge', n: +m[1] })],
  [/^(?:When you move, ignore Swamp Terrain tiles for this movement|When you're about to move, ignore a Swamp Terrain tile during that movement)$/, () => ({ op: 'fSwampFree', free: true })],
  [/^During movement, ignore all Terrain tiles$/, () => ({ op: 'fTerrainFree', free: true })],
  [/^When you are about to be moved involuntarily, gain Braced$/, () => ({ op: 'bracedPaid', active: true })],
  [/^When your Attack hits, gain a Crit Chance$/, () => ({ op: 'hitCritChance', active: true })],
  [/^When you Wound, move a chosen Monster up to X spaces away, where X is the Level of the wounded BP$/, () => ({ op: 'woundPushLevel' })],
  [/^During your Power Roll, if you fail to meet the \[AT\], place up to (\d+) Fire \[Fire\] tokens in the Knight Pool$/, m => ({ op: 'failFire', n: +m[1] })],
  [/^Start of Clash: Draw a Judicium without resolving it(?:, then return it to the deck)?$/, () => ({ op: 'startJudicium' })],
  [/^(?:The next time you would draw a Judicium, resolve (?:that Judicium|this one) instead|If you survive, discard all Armor \[Armor\] tokens from anywhere)$/, () => ({ op: 'note', na: true })],
  [/^Draw a Judicium$/, () => ({ op: 'fDrawJudicium', free: true })],
  [/^(?:This (?:Weapon|Armor|Armor \[Gear\] card|card)|Your active Weapon) gains the (\w+) Trait$/, m => ({ op: 'gainTrait', trait: m[1] })],
  [/^This Armor gains the (\w+) Trait and loses the (\w+) Trait$/, m => ({ op: 'gainTrait', trait: m[1], lose: m[2] })],
  [/^This card cannot be exhausted in any way$/, () => ({ op: 'noExhaust' })],
  [/^Pass (\d+)$/, m => ({ op: 'pass', n: +m[1] })],
  [/^Armor Re-roll (\d+)$/, m => ({ op: 'armorReroll', n: +m[1] })],
  [/^After rolling Armor dice, you may decide to mitigate damage with \[Power\] symbols instead of \[Potential\]$/, () => ({ op: 'armorPowerInstead' })],
  [/^Each \[Power\] symbol on your Armor dice mitigates \[Vigor\] loss as if it were \[Armor symbol\]$/, () => ({ op: 'armorPowerAlso' })],
  [/^During an Armor Roll, for each \[Potential\] you roll place a Break \[Break\] token in the Knight Pool$/, () => ({ op: 'armorBreakPerPotential' })],
  [/^When you perform an Armor Roll, you may place a Break \[Break\] token in the Knight Pool for each \[Power\] symbol you roll on your Armor dice$/, () => ({ op: 'armorBreakPerPower' })],
  [/^You cannot perform Armor Rolls$/, () => ({ op: 'noArmorRoll' })],
  [/^After performing an Armor Roll, treat each \[Potential\] you rolled as 2 \[Potential\]$/, () => ({ op: 'armorDoublePotential', active: true })],
  [/^Ignore Armor \[Armor\] tokens$/, () => ({ op: 'ignoreArmorAll' })],
  [/^During an Attack ignore up to X Armor \[Armor\] tokens, where X is the number of Bane \[Bane\] tokens you have$/, () => ({ op: 'ignoreArmorBane' })],
  [/^When you are about to attack, gain \+(\d+) \[Heat\] to ignore (\d+) Armor \[Armor\] token$/, m => ({ op: 'ignoreArmorHeat', h: +m[1], n: +m[2] })],
  [/^Full hit: \+(\d+) \[Power\]$/i, m => ({ op: 'fullHitRawPower', n: +m[1] })],
  [/^Reduce suffered Knockback or Pushback by up to (\d+)$/, m => ({ op: 'reduceKnockback', n: +m[1], active: true })],
  [/^\+(\d+) to Virtue tests$/, m => ({ op: 'virtueAll', n: +m[1] })],
  [/^When you spend the last \[Charge\] from this card, gain \+(\d+) \[Passion\]$/, m => ({ op: 'lastChargePassion', n: +m[1] })],
  [/^Ignore Rubble Terrain tiles$/, () => ({ op: 'ignoreRubble' })],
  [/^Ignore Body Condition cards$/, () => ({ op: 'ignoreCondType', type: 'body' })],
  [/^You may ignore gaining Mind Condition cards$/, () => ({ op: 'ignoreCondType', type: 'mind', ask: true })],
  [/^Start of Clash: Parasitize (\d+)$/, m => ({ op: 'startParasitize', n: +m[1] })],
  [/^Gain \+(\d+) \[Vigor\], raising your Maximum \[Vigor\] if needed$/, m => ({ op: 'fVigorOverMax', n: +m[1], free: true })],
  [/^Look at a chosen BP$/, () => ({ op: 'fLookAnyBP', free: true })],
  [/^Choose a direction$/, () => ({ op: 'fTurnMonster', free: true })],
  [/^Turn one Monster to face the chosen direction$/, () => ({ op: 'note', na: true })],
  [/^Wound: After resolving the Attack, exchange your \[Passion\] and \[Heat\]$/, () => ({ op: 'woundSwapPH' })],
  [/^You die immediately$/, () => ({ op: 'gateDie' })],
  [/^Flip a Condition card and gain \+(\d+) \[Vigor\]$/, m => ({ op: 'fFlipCondVigor', n: +m[1], free: true })],
  [/^Bane Limit(?: \[Bane Limit\])? ([+-]\d+)$/, m => ({ op: 'baneLimitMod', n: +m[1] })],
  [/^You may use your \[Combat action\] as a \[Move action\]$/, () => ({ op: 'combatAsMove' })],
  [/^Re-roll your Attack Roll \(all dice\)$/, () => ({ op: 'rerollAttackAll', active: true })],
  [/^Re-roll your Crit die, even if you already re-rolled it during this roll$/, () => ({ op: 'critReroll', active: true })],
  [/^Change a result of one \[d10\] you just rolled to a chosen result, then Bane (\d+)$/, m => ({ op: 'changeDie', n: +m[1], active: true })],
  [/^Each Miss: Gain a temporary positive Precision \[Precision\] token$/, () => ({ op: 'eachMissPrecision' })],
  [/^When you spend the last \[Charge\] from this card, perform a Bonus Attack!?$/, () => ({ op: 'lastChargeBonus' })],
  [/^When you trigger Overpower, you may perform a Bonus Attack \(once per Round\)$/, () => ({ op: 'overpowerBonus' })],
  [/^Once per Clash, immediately perform a Bonus Attack, then suffer Knockdown$/, () => ({ op: 'fBonusAttackKD', free: true })],
  [/^(?:Gain (Armor-piercing|Reach) (\d+), then )(Improved Rush|Rush)$/, m => ({ op: 'fRush', improved: m[3] !== 'Rush', pre: m[1], preN: +m[2], free: true })],
  [/^(Improved Rush|Rush), then perform Pushback (\d+)$/, m => ({ op: 'fRush', improved: m[1] !== 'Rush', push: +m[2], free: true })],
  [/^When you perform Rush, immediately Inspire (\d+) and gain Power Re-roll (\d+)$/, m => ({ op: 'rushBonus', inspire: +m[1], powerReroll: +m[2] })],
  [/^When you perform Rush, gain \+(\d+) Precision \[Precision\] and Reposition (\d+)$/, m => ({ op: 'rushBonus', precision: +m[1], reposition: +m[2] })],
  [/^When you're about to attack with a Melee Weapon, gain Reach (\d+) for that Attack$/, m => ({ op: 'atkReach', n: +m[1], active: true })],
  [/^When you attack with a Ranged Weapon, double its maximum range for this Attack$/, () => ({ op: 'atkRangeDouble', active: true })],
  [/^Ignore Unwieldy on your Weapons until the end of your turn$/, () => ({ op: 'fNoUnwieldy', free: true })],
  [/^Full Hit: During the second ability window, place a permanent negative AT \[AT\] token on the Monster Sheet$/i, () => ({ op: 'fullHitPermNegAT' })],
  [/^When you are about to draw a Mortis card, look at the top card of the respective Mortis deck$/, () => ({ op: 'mortisPeek', active: true })],
  [/^Then, you may shuffle it$/, () => ({ op: 'note', na: true })],
  [/^When you perform a \[Peril Check\] \(excluding Judicium Draw\), look at the top 2 cards and choose one to resolve instead$/, () => ({ op: 'mortisTwo', active: true })],
  [/^When you're about to draw a Judicium, you may resolve a You Live! or You Died Judicium instead$/, () => ({ op: 'judiciumChoose' })],
  [/^The next time you draw a Judicium, resolve the other one$/, () => ({ op: 'note', na: true })],
  [/^Monarch: (\d+) \[Heat\] \[Exhaust\] When you draw an AI, before resolving it, discard it and draw another AI$/, m => ({ op: 'aiRedraw', heat: +m[1] })],
  [/^You start each Clash with exactly (\d+) \[Passion\]$/, m => ({ op: 'startPassionExact', n: +m[1] })],
  [/^When you perform ↑\[Heat\]↓, gain \+(\d+) \[Passion\] for every (\d+) \[Heat\] lost this way$/, m => ({ op: 'heatRefreshPassion', n: +m[1], per: +m[2] })],
  [/^When you are about to die from a Judicium or an instant death effect, ignore it$/, () => ({ op: 'ignoreDeath', active: true })],
  [/^Ignore X Armor \[Armor token\] tokens$/, () => ({ op: 'ignoreArmorX' })],
  [/^Your Heat Limit \[Heat Limit\] becomes (\d+)$/, m => ({ op: 'heatLimitFixed', n: +m[1] })],
  [/^You cannot lose \[Heat\] in any way$/, () => ({ op: 'noHeatLoss' })],
  [/^When you end your movement adjacent to a Monster, place a Break \[Break\] token in the Knight Pool$/, () => ({ op: 'moveEndBreak' })],
  [/^Ignore Devour, Pull, and Drag$/, () => ({ op: 'ignorePullDrag' })],
  [/^When you're about to suffer Drag X, ignore that Drag$/, () => ({ op: 'ignoreDrag', active: true })],
  [/^Whenever you remove 1 unspent Fire \[Fire\] token from the Knight Pool, gain 1 \[Charge\]$/, () => ({ op: 'fireRemovedCharge' })],
  [/^When a Monster attacks, it loses -X \[d10\] \(to a minimum of 1\), where X is the number of Bane \[Bane\] tokens you have$/, () => ({ op: 'attackDiceMinusBane', active: true })],
  [/^Before an Evasion Roll, gain \+X Evasion \[Evasion\], where X is the number of your Bane \[Bane\] tokens$/, () => ({ op: 'evasionPlusBane', active: true })],
  [/^Move up to X\* spaces$/, () => ({ op: 'moveAfterEvasion', active: true })],
  [/^\*X is the amount of Evasion dice you rolled during this Attack$/, () => ({ op: 'note', na: true })],
  [/^When you're hit, AI and BP Suppress$/, () => ({ op: 'hitSuppress' })],
  [/^When you become the Target of an Attack, choose one:$/, () => ({ op: 'wilderPlate', active: true })],
  [/^• (?:Guard 1|\[red Armor die\]|1 Evasion Re-roll)$/, () => ({ op: 'note', na: true })],
  [/^If you survive, gain \+(\d+) \[Passion\]$/, () => ({ op: 'note', na: true })],
  [/^When you lose \[Vigor\], gain that many \[Charge\]$/, () => ({ op: 'vigorLossCharge' })],
  [/^When you're knocked down or ignore Knockdown, spend X \[Charge\] from this card to place X Opening \[Opening\] tokens in the Knight Pool$/, () => ({ op: 'knockdownOpenings' })],
  [/^When you're about to suffer Knockdown, if the Knight Pool is empty, place (\d+) Opening \[Opening\] and\/or Break \[Break\] tokens in the Knight Pool$/, m => ({ op: 'knockdownPool', n: +m[1] })],
  [/^During Clash: Spend all \[Charge\] from this card to Fire X, where X is the number of \[Charge\] spent$/, () => ({ op: 'fFireAllCharges', free: true })],
  [/^Lose up to -(\d+) \[Vigor\] to lose the same amount of \[Heat\] \(minimum 1\)$/, m => ({ op: 'fVigorForHeat', n: +m[1], free: true })],
  [/^Then, discard up to (\d+) Poison tokens$/, m => ({ op: 'note', na: true, poison: +m[1] })],
  [/^Discard X Armor \[Armor\] tokens from anywhere$/, () => ({ op: 'fDiscardArmor', n: 0, free: true })],
  [/^Gain Rocksteady and Stalwart until your next turn$/, () => ({ op: 'fSteady', free: true })],
  [/^Gain \+1 \[Heat\] to use this card's ability instead of its regular cost$/, () => ({ op: 'altCostHeat' })],
  [/^This Weapon gains the Flammable Trait and Fire (\d+) until the end of your turn$/, m => ({ op: 'fTempFire', n: +m[1], free: true })],
  [/^Return a Knight to life on a space adjacent to you and reset their \[Vigor\]$/, () => ({ op: 'fRevive', reset: true, free: true })],
  [/^When you're about to attack, you may discard X Opening \[Opening\], Break \[Break\], and\/or Fleisch \[Fleisch\] tokens in the Knight Pool to gain Pushback X$/, () => ({ op: 'attackDiscardPush' })],
  [/^When you are about to attack, you may discard any amount of tokens from the Knight Pool$/, () => ({ op: 'attackDiscardPower' })],
  [/^If you do, gain \+1 \[Power\] for each token discarded this way$/, () => ({ op: 'note', na: true })],
  [/^If there are no Opening \[Opening\] or Break \[Break\] tokens in the Knight Pool, Auto-hope (\d+)$/, m => ({ op: 'noTokensAutoHope', n: +m[1] })],
  [/^During the second ability window, if you deal a Wound, you may discard all Bane \[Bane\] tokens to place the same amount of Openings \[Opening\] and\/or Breaks \[Break\] in the Knight Pool$/, () => ({ op: 'woundBaneToTokens' })],
  [/^Each hit: \+(\d+) \[Power\], Reposition (\d+), either Closing (\d+) or Opening (\d+)$/, m => ({ op: 'eachHitCombo', power: +m[1], repo: +m[2], closing: +m[3], opening: +m[4] })],
  [/^Crit Chance: Ignore any additional \[AT\] \(including Armor \[Armor\] tokens\)$/, () => ({ op: 'critBaseAT' })],
  [/^When you attack, for each Swamp space in your effective range occupied by a Monster, place a Power \[Power\] token in the Knight Pool$/, () => ({ op: 'swampMonsterPower' })],
  [/^When you exhaust this card, double your Speed \[Speed\] until the end of turn$/, () => ({ op: 'exhaustDoubleSpeed' })],
  [/^Inspire (\d+)$/, m => ({ op: 'fInspire', n: +m[1], free: true, needsCost: true })],
  [/^Change up to (\d+) Knight tokens in the Knight Pool into Hope \[Hope\] tokens$/, m => ({ op: 'fTokensToHope', n: +m[1], free: true })],
  [/^If there are (\d+) or more Hope \[Hope\] tokens in the Knight Pool, each Knight gains \+(\d+) Precision \[Precision\]$/, m => ({ op: 'hopePrecision', need: +m[1], n: +m[2] })],
  [/^Reveal the top card of a chosen Mortis deck$/, () => ({ op: 'fRevealMortis', free: true })],
  [/^When you attack with this Weapon, you may gain \+(\d+) \[Heat\] to gain \+(\d+) \[Power\]$/, m => ({ op: 'attackHeatPower', h: +m[1], n: +m[2] })],
  [/^All Knights in Zone (\d+) gain Power Re-roll (\d+)$/, m => ({ op: 'zonePowerReroll', zone: +m[1], n: +m[2] })],
  [/^During the second ability window, place a Power \[Power\] token in the Knight Pool for each \[AT\] you exceeded during this Attack's Power Roll \(up to (\d+)\)$/, m => ({ op: 'overATPower', max: +m[1] })],
  [/^You may pay with \[Vigor\] to re-roll (?:your )?dice instead of \[Heat\]$/, () => ({ op: 'vigorReroll' })],
  [/^When moving through a Swamp Terrain tile, you may re-roll the \[d10\] rolled on the Swamp effect \(once\)$/, () => ({ op: 'swampReroll' })],
  [/^Destroy an adjacent [Dd]estructible (?:Obstacle )?Terrain tile$/, () => ({ op: 'fDestroyTerrain', free: true })],
  [/^Ignore Lumbering$/, () => ({ op: 'ignoreLumbering' })],
  [/^If you're using \[2 hands\] Weapons, they lose Cumbersome, Unwieldy, and Commit$/, () => ({ op: 'twoHandLose' })],
  [/^\*?When you resolve a negative Mortis card, this card gains (\d+) \[Charge\]$/, m => ({ op: 'mortisCharge', n: +m[1] })],
  [/^You may spend X \[Charge\] to gain Reinforce X$/, () => ({ op: 'chargeReinforce' })],
  [/^When you deal a Wound, move 1 Armor \[Armor\] token from the Monster to this card$/, () => ({ op: 'woundTakeArmor' })],
  [/^Advanced Reinforce \*X$/, () => ({ op: 'reinforceCardArmor', active: true })],
  [/^\*X is equal to the number of \[Armor\] on this card$/, () => ({ op: 'note', na: true })],
  [/^When you become the Target of an Attack, place (\d+) Fleisch \[Fleisch token\] token in the Knight Pool and spend (\d+) \[Charge\]$/, m => ({ op: 'targetFleisch', n: +m[1], c: +m[2] })],
  [/^If you cannot spend the \[Charge\], discard this card instead$/, () => ({ op: 'note', na: true })],
  [/^Start of Clash: Gain the \[Priority Target\] Priority Target token$/, () => ({ op: 'startPriority' })],
  [/^While you have this card, you cannot lose that token$/, () => ({ op: 'keepPriority' })],
  [/^Full Evade: Look at the top AI and BP cards of the closest Monster$/, () => ({ op: 'fullEvadeLook' })],
  [/^Full Evade: A Monster that attacked you moves X spaces directly away from you, where X is the amount of dice you evaded$/, () => ({ op: 'fullEvadePush' })],
  [/^Ignore Wound Responses$/, () => ({ op: 'ignoreWoundResp' })],
  [/^Your Crit die misses only on a Crit Miss$/, () => ({ op: 'critOnlyMiss' })],
  [/^At the end of the second ability window, double all tokens in the Knight Pool$/, () => ({ op: 'doublePool' })],
  [/^Immediately resolve an additional turn$/, () => ({ op: 'fExtraTurn', free: true })],
  [/^At the end of that turn, you die$/, () => ({ op: 'note', na: true })],
  [/^Flip a Condition card of a Knight in effective range of this Weapon$/, () => ({ op: 'fFlipOtherCond', free: true })],
  [/^That Knight gains \+(\d+) \[Vigor\]$/, m => ({ op: 'note', na: true, vigor: +m[1] })],
  [/^When you're about to attack, change up to (\d+) Break \[Break\] tokens in the Knight Pool into Black \[Black\] tokens and\/or Opening \[Opening\] tokens into Closing \[Closing\] tokens.*$/, m => ({ op: 'poolUpgrade', n: +m[1], active: true })],
  [/^When you deal a Wound, you may take a Condition card from the closest Knight$/, () => ({ op: 'woundTakeCondition' })],
  [/^When you attack, for each space occupied by a Monster in your effective range other than the space you're attacking, place a Black \[Black\] token in the Knight Pool \(up to (\d+)\)$/, m => ({ op: 'rangeBlack', max: +m[1] })],
  [/^Ignore up to -(\d+) Speed \[Speed\] penalty$/, m => ({ op: 'ignoreSpeedPenalty', n: +m[1] })],
  [/^Monsters on Swamp Terrain tiles gain -(\d+) \[To Hit\]$/, m => ({ op: 'swampToHit', n: +m[1] })],
  [/^If you're on a Swamp Terrain tile, you drown \(die\)$/, () => ({ op: 'note', na: true })],
  [/^Party Trick: (\d+) \[Heat\] You may place 1 card from your hand into the Cooldown area to Refresh (\d+)$/, m => ({ op: 'fPartyTrick', heat: +m[1], n: +m[2], free: true })],
  [/^Hand Limit \+(\d+)$/, m => ({ op: 'handLimitPlus', n: +m[1] })],
  [/^Place your Knight on a space in effective range of this Weapon$/, () => ({ op: 'fTeleportRange', free: true })],
  [/^Remove a (Swamp|Rubble)(?: Terrain)? tile in your effective range and place it on this card.*$/, m => ({ op: 'fTakeTerrain', tile: m[1].toLowerCase(), free: true })],
  [/^Place all (?:Swamps|Rubble tiles) from this card (on spaces in your effective range|anywhere on the Board)$/, m => ({ op: 'fPlaceTerrain', anywhere: /anywhere/.test(m[1]), free: true })],
  [/^Motivate (\d+) each Knight other than you$/, m => ({ op: 'motivateEach', n: +m[1] })],
  [/^Each hit: Closing (\d+), Fire (\d+), Inspire (\d+), Motivate (\d+)$/, m => ({ op: 'eachHitCFIM', closing: +m[1], fire: +m[2], inspire: +m[3], motivate: +m[4] })],
  [/^Inspire (\d+) and Motivate (\d+) a Knight in effective range of this Weapon$/, m => ({ op: 'fInspireMotivate', inspire: +m[1], n: +m[2], free: true })],
  [/^Spend X \[Charge\] to Motivate X$/, () => ({ op: 'fMotivateX', free: true })],
  [/^Reposition (\d+) toward another Knight$/, m => ({ op: 'repositionToward', n: +m[1] })],
  [/^Motivate (\d+) toward you$/, m => ({ op: 'motivateToward', n: +m[1] })],
  [/^When a Monster moves adjacent to you, immediately stop that movement$/, () => ({ op: 'stopMove', active: true, notInAI: true })],
  [/^When a moving Monster becomes adjacent to you, it immediately stops$/, () => ({ op: 'stopMove', active: true })],
  [/^(?:You cannot use this ability during an AI or (?:a )?Signature|This may cause a Chain Break)$/, () => ({ op: 'note', na: true })],
  [/^Place this card adjacent to you on 2 spaces on the Clash Board$/, () => ({ op: 'fPlaceTrap', free: true })],
  [/^When a Monster moves onto this card's spaces, regain this Gear \[Gear\] card, then roll a \[d10\]$/, () => ({ op: 'note', na: true, trap: 'caltrops' })],
  [/^On 6\+, stop the Monster's movement and place (\d+) Fire \[Fire\] tokens in the Knight Pool$/, m => ({ op: 'note', na: true })],
  [/^When a Monster enters any of this card's spaces, remove this card from the Board, and place (\d+) temporary negative AT \[AT\] tokens in the Knight Pool$/, m => ({ op: 'note', na: true, trap: 'bait', n: +m[1] })],
  [/^You may discard this Upgrade to discard a Mind Condition card$/, () => ({ op: 'fUpgradeMind', free: true })],
  [/^Additionally, you may gain \+(\d+) \[Heat\] to use this effect on an adjacent Knight instead$/, () => ({ op: 'note', na: true })],
  [/^During the second ability window, you may discard this Upgrade from your Weapon to gain Envenomed (\d+)$/, m => ({ op: 'upgradeEnvenomed', n: +m[1] })],
  [/^During the Power Roll step, you may discard this Upgrade to gain \+(\d+) \[Power\]$/, m => ({ op: 'upgradePower', n: +m[1], active: true })],
  [/^Move all \[Charge\] from this Weapon onto any of your other Gear \[Gear\] cards$/, () => ({ op: 'fMoveCharges', free: true })],
  [/^Draw a Mortis without resolving it$/, () => ({ op: 'fDrawMortisAhead', free: true })],
  [/^The next time you would perform a \[Peril Check\], resolve that card instead$/, () => ({ op: 'note', na: true })],
  [/^Start of your turn: Reveal the top card of each Mortis deck$/, () => ({ op: 'turnRevealMortis' })],
  [/^When you're about to draw a Judicium, resolve a chosen Mortis revealed by this card instead$/, () => ({ op: 'judiciumToMortis', active: true })],
  [/^When you become the Target of a Monster Attack, you may change all your \[Evasion Re-roll\] into \[red Armor die\] and vice versa$/, () => ({ op: 'swapERArmor' })],
  [/^You may exhaust another Gear \[Gear\] card with the Cloth Trait to gain a temporary positive Evasion \[Evasion\] token$/, () => ({ op: 'fClothEvasion', free: true })],
  [/^Puppeteer: (\d+) \[Heat\] When you deal a Wound, each other Knight gains (\d+) Bane \[Bane\] token and moves up to (\d+) spaces toward the closest Monster$/, m => ({ op: 'woundPuppeteer', heat: +m[1], bane: +m[2], n: +m[3] })],
  [/^This is considered involuntary movement$/, () => ({ op: 'note', na: true })],
  [/^Move the closest Swamp Terrain tile to any spaces in your effective range$/, () => ({ op: 'fMoveSwamp', free: true })],
  [/^Place a Rotten Stump Terrain tile on an empty space adjacent to you$/, () => ({ op: 'fPlaceStump', free: true })],
  [/^Discard a (Body|Mind) Condition card$/, m => ({ op: 'fDiscardCondType', type: m[1].toLowerCase(), free: true })],
  [/^When you die, the closest Knight equips this card \(discarding another Armor \[Gear\] card if needed\)$/, () => ({ op: 'deathPassOn' })],
  [/^When you are about to perform Card Refresh, perform Heat Refresh instead or vice versa$/, () => ({ op: 'refreshSwap', active: true })],
  [/^You may use this Weapon's Block as Defy$/, () => ({ op: 'blockAsDefy' })],
  [/^When you're about to perform a climb test, automatically succeed at that test instead$/, () => ({ op: 'note', na: true })],
  [/^Roll Out(?: \(.*\))?$/, () => ({ op: 'rollOut', active: true })],
  [/^Ignore Swamp Terrain tiles$/, () => ({ op: 'ignoreSwamp' })],
  [/^When you're about to suffer involuntary movement, you may reduce it by 1 \(to a minimum of 1\)$/, () => ({ op: 'reduceInvol' })],
  [/^Take Root: If you didn't move during your turn, gain Braced until you move$/, () => ({ op: 'takeRoot' })],
  [/^After you wound a Pumpkinhead, place the Sapling in its place instead of random coordinates$/, () => ({ op: 'saplingInPlace', active: true })],
];
function body(b) {
  let m;
  if ((m = /^Gain (Unwieldy|Deadly|Cumbersome|Commit|Tireless)$/.exec(b))) return body(m[1]);
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
    if ((m = /^\[BANE (\d+)\+\]\s*/i.exec(r))) { o.baneMin = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Move action\]\+\[Combat action\]\s*/i.exec(r))) { (o.cost = o.cost || {}).action = 'both'; r = r.slice(m[0].length); continue; }
    if ((m = /^\[(?:PASSION|P) (\d+)\+\]\s*/.exec(r))) { o.passionMin = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Combat action\]\+\[Move action\]\s*/i.exec(r)) || (m = /^\[Move\+Attack action\]\s*/i.exec(r))) { (o.cost = o.cost || {}).action = 'both'; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Move action\] or \[Combat action\]\s*/i.exec(r))) { o.eitherAction = true; r = r.slice(m[0].length); continue; }
    if ((m = /^X \[Charge\]\s*/.exec(r))) { o.chargeX = true; r = r.slice(m[0].length); continue; }
    if ((m = /^X \[Heat\]\s*/.exec(r))) { o.heatX = true; r = r.slice(m[0].length); continue; }
    if ((m = /^Start of your turn:\s*(?=\d+ \[Heat\])/.exec(r))) { o.atTurnStart = true; r = r.slice(m[0].length); continue; }
    if ((m = /^When you trigger Overcome X in Melee range:\s*/.exec(r))) { o.overcomeMelee = true; r = r.slice(m[0].length); continue; }
    if ((m = /^(\d+) \[Vigor\]\s+(?=\[|[A-Z])/.exec(r))) { (o.cost = o.cost || {}).vigor = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[(VASSAL|KING|DEVIL|DRAGON|POSTGAME)\]\s*/.exec(r))) { o.tier = m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[HEAT (\d+)\+\]\s*/.exec(r))) { o.heatMin = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^(\d+) \[Bane\]\s+(?=\d|\[|[A-Z])/.exec(r))) { (o.cost = o.cost || {}).bane = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Upgrade: ([^\]]+)\]\s*/.exec(r))) { o.upgrade = m[1]; r = r.slice(m[0].length); continue; }
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
  const k = { ...b, ...o, text }; if (k.atTurnStart && k.op === 'hide') k.op = 'hideStart'; if (k.op === 'tumble' && (k.cost || k.reaction)) { k.op = 'tumblePaid'; k.special = true; k.active = true; } if (k.op === 'soak' && k.cost) { k.op = 'soakPaid'; k.special = true; k.active = true; } if (k.status === 'ok' && (k.cost || k.reaction) && !ACTIVE_OK.has(k.op) && !k.special) k.status = 'pending'; // costed versions of constant keywords need their own timing window
  return k;
}
/** Parse a whole ability text → list of keywords (one per sentence). */
const xKind = t => /X\*? is (?:equal to )?(?:the )?(?:number|amount) of (?:your )?Bane/.test(t) ? 'bane' : /X is equal to your \[Passion\]/.test(t) ? 'passion' : /X is equal to your \[Heat\]/.test(t) ? 'heat' : /X is the number of Magic \[Magic\] tokens in the Knight Pool/.test(t) ? 'magic' : /X is the sum of all Evasion/.test(t) ? 'evasionSum' : /X is equal to half your \[Passion\]/.test(t) ? 'halfPassion' : null;
export function parseGearText(text) { if (!text) return []; const ss = String(text).replace(/(Crit Chance|in Melee range):\n/g, '$1: ').replace(/(\d)\.(?=[A-Z][a-z])/g, '$1. ').split(/\n|(?<=\.)\s+(?=[\[A-Z+\-\d])/).map(s => s.trim()).filter(Boolean);
  const xdef = ss.map(xKind).find(Boolean) || null; const out = []; let lastPrefix = null;
  for (const t of ss) { let m; const wasPrefix = lastPrefix; lastPrefix = null;
    if (xKind(t) && /^\*?X\b/.test(t)) { out.push({ op: 'note', status: 'na', special: true, text: t }); continue; }
    if ((m = /^((?:\[[^\]]+\]\s*)*)([A-Z][A-Za-z\- ]* \d+) instead, gain ([A-Z][a-z]+)\.?$/.exec(t))) { const p1 = parseSentence(m[1] + m[2] + '.'), p2 = parseSentence(m[1] + m[3] + '.'); if (p1.status === 'ok' && p2.status === 'ok') { p1.instead = true; p1.text = t; p2.text = t; out.push(p1, p2); continue; } }
    if ((m = /^((?:\[[^\]]+\]\s*)*)([A-Z][A-Za-z\- ]*(?: \d+)?(?:(?:, | and |, and )(?:gain )?[A-Z][A-Za-z\- ]*(?: \d+)?)*) instead\.?$/.exec(t))) { const prefix = m[1] || wasPrefix || ''; const ps = m[2].split(/, and |, | and /).map(p => parseSentence(prefix + p.replace(/^gain /, '') + '.')); if (ps.every(p => p.status === 'ok')) { for (const p of ps) { p.instead = true; p.text = t; } out.push(...ps); lastPrefix = prefix; continue; } }
    if ((m = /^((?:\[[^\]]+\]\s*)*[A-Z][A-Za-z\- ]*) \*?X\*?, where X is (the (?:number|amount) of Bane \[Bane\] tokens you have|your \[Heat\])\.?$/.exec(t))) { const p = parseSentence(m[1] + ' 0.'); if (typeof p.n === 'number' && p.status !== 'text') { p.status = 'ok'; p.x = /Bane/.test(m[2]) ? 'bane' : 'heat'; p.text = t; out.push(p); continue; } }
    if (xdef && (m = /^Ranged (\d+)[-–]X\.?$/.exec(t))) { out.push({ op: 'ranged', n: +m[1], m: 'X', x: xdef, status: 'ok', text: t }); continue; }
    if (xdef && (m = /^((?:\[[^\]]+\]\s*)*[A-Z][A-Za-z\- ]*) \*?X\*?\.?$/.exec(t))) { const p = parseSentence(m[1] + ' 0.'); if (typeof p.n === 'number' && p.status !== 'text' && p.op !== 'ranged') { p.status = 'ok'; p.x = xdef; p.text = t; out.push(p); continue; } }
    if ((m = /^((?:\[[^\]]+\]\s*|\d+ \[Heat\]\s*)+)(Superior Chance|Lifeline) or (Lifeline|[Dd]iscard a Body Condition card)\.?$/.exec(t))) { const cap = x => x[0].toUpperCase() + x.slice(1); const p1 = parseSentence(m[1] + m[2] + '.'), p2 = parseSentence(m[1] + cap(m[3]) + '.'); if (p1.status === 'ok' && p2.status === 'ok') { p1.text = t; p2.text = t; out.push(p1, p2); continue; } }
    if ((m = /^(.*\S )Block or Defy\.?$/.exec(t)) && /\[Heat\]|\[Exhaust\]|\[Discard\]|\[Charge\]/.test(m[1])) { const p1 = parseSentence(m[1] + 'Block.'), p2 = parseSentence(m[1] + 'Defy.'); if (p1.status === 'ok' && p2.status === 'ok') { p1.text = t; p2.text = t; out.push(p1, p2); continue; } }
    out.push(parseSentence(t)); }
  { let up = null; for (const o of out) { if (o.upgrade) up = o.upgrade; else if (up) o.upgrade = up; } }
  out.forEach((o, i) => { if (o.op === 'fDrawJudicium') { const nx = out[i + 1]; if (nx && /discard all Armor/.test(nx.text)) o.then = 'clearArmor'; else if (nx && /return a chosen Knight to life adjacent to you/.test(nx.text)) { o.then = 'revive'; nx.op = 'note'; nx.status = 'na'; } else { o.op = 'text'; o.status = 'text'; } } if (o.op === 'fVigorForHeat') { const nx = out[i + 1]; if (nx && nx.poison) o.poison = nx.poison; } if (o.op === 'fPlaceTrap') { const nx = out.slice(i + 1).find(x => x.trap); if (nx) { o.trap = nx.trap; o.trapN = nx.n; } } if (o.op === 'fFlipOtherCond') { const nx = out[i + 1]; if (nx && nx.vigor) o.vigor = nx.vigor; } if (o.op === 'fInspire' && !o.cost) { o.op = 'inspire'; delete o.free; } if (o.op === 'fPlaceTerrain') o.tile = /Rubble/.test(o.text) ? 'rubble' : 'swamp'; }); return out; }
export const isDefensive = op => DEFENSIVE.has(op);
export const KEYWORD_STATUS = { TOKENS, OK, PENDING, NA };
