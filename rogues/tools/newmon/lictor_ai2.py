from common import *
from lictor_ai1 import H, GU
AI2 = [
 A('Toxic Smokescreen', 3, 'ZONE ATTACK', 3, 10, ['Zone 3', 'No Knight in Zone: This Mob performs Signature'], 'ATTACK', ['For each hit lose -2 [V] and Poison 1. [Peril].'], 'Tactic A. The next non-Decoying Mob performs Dwell.', gates=[H(3, '+2 [die]')], unclear=GU),
 A('Death from Above', 3, 'SIMULTANEOUS ATTACK', 3, 9, ['Clash Board'], 'ATTACK', ['One hit, lose -3 [V]. Two hits, lose -5 [V]. Three or more hits, lose -5 [V] and gain the Slimed Condition card. Tactic B. [Peril].'], 'Knockdown.', 'AFTER FINAL ATTACK'),
 A('Fighting Dirty', 3, 'ATTACK', 3, 10, ['Engaged Knight', 'Last Knight to wound', 'Closest Knight'], 'MOVE & ATTACK', ['For each hit lose -2 [V]. Knockdown. Two hits, gain the Slimed Condition card. Three or more hits, gain the Drowning Condition card. Tactic A. [Peril]. The next non-Decoying Mob performs Decoy.']),
]
OU = []
EV = dict(whenRevealed='Escalate the lowest unrevealed BP on the Mob track.', wound='Gain the Exposed Condition card.', fail='Place a Generic token on the Taunt & Decoy Trait.', critical='Another Knight may perform a Bonus Attack!', unclear=OU)
PE = dict(wound='Lose -1 [H].', fail='Tactic B. [Peril].', critical='Reset your [H].', unclear=OU)
AU = dict(wound='Reveal the leftmost unrevealed BP.', fail='Escalate the lowest unrevealed BP. Decoy.', critical='Look at a chosen BP card.', unclear=OU)
FR = dict(whenRevealed='Flip the rightmost revealed BP card face down.', wound='Flip the rightmost revealed BP card face down.', fail='Escalate the lowest unrevealed BP.', critical='You may flip a chosen BP card face down.', unclear=OU)
BP1 = [
 B('Delator', 1, 4, (2, 'Fire 1'), whenRevealed='Look at the rightmost unrevealed BP on the Mob track.', wound='Reveal the rightmost unrevealed BP.', fail='Decoy.', critical='You may perform a Bonus Attack!', unclear=OU),
 B('Evocati', 1, 4, (3, 'Power 1'), **EV), B('Evocati', 1, 4, (3, 'Power 1'), **EV),
 B('Censor', 1, 3, (2, 'Fire 1'), wound='Flip the leftmost revealed BP face down.', fail='[Peril].', critical='You may flip a chosen BP card face down.', whileRevealed='Disable Responses that flip BP cards face down.', unclear=OU),
 B('Peregrini', 1, 2, (3, 'Fire 2'), **PE), B('Peregrini', 1, 2, (3, 'Fire 2'), **PE),
 B('Auxiliari', 1, 3, (3, 'Fire 1'), **AU), B('Auxiliari', 1, 3, (3, 'Fire 1'), **AU),
 B('Frumentari', 2, 5, (3, 'Fire 1'), **FR), B('Frumentari', 2, 5, (3, 'Fire 1'), **FR),
 B('Exploratore', 2, 6, (4, 'Power 1'), wound='The furthest Mob performs Signature against the Attacker.', fail='Place a Generic token on the Taunt & Decoy Trait.', critical='You may move up to 3 spaces and perform a Bonus Attack! After the Clash, see 3584.', whileRevealed='All Monster Attacks additionally cause -1 [V] loss.', unclear=OU),
 B('Speculatore', 2, 4, (4, 'Opening 1'), wound='Escalate the lowest AI.', fail='[Peril]. Tactic A.', critical='For each Decoy, choose one Decoying Mob and attach its miniature to a base ring. That mob is no longer a Decoy.', whileRevealed='All Monsters have +1 [To Hit].', unclear=OU),
]
