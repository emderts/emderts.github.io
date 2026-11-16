from common import *
from lictor_sheet import SHEET
from lictor_ai1 import AI1
from lictor_ai2 import AI2, BP1, OU
SPEC = B('Speculatore', 2, 4, (3, 'Opening 1'), wound='Escalate the lowest AI.', fail='[Peril]. Tactic A.', critical='For each Decoy, choose one Decoying Mob and attach its miniature to a base ring. That mob is no longer a Decoy.', whileRevealed='All Monsters have +1 [To Hit].', unclear=OU)
DRAW3 = 'Draw AI 3 for another closest Mob from the AI deck or discard pile (prioritize the deck). Place a Generic token on the Taunt & Decoy Trait.'
BP2 = [SPEC,
 B('Arcani', 2, 4, (3, 'Fire 1'), whenRevealed='Reveal the rightmost unrevealed BP on the Mob track.', wound='The next non-Decoying Mob performs Decoy.', fail='Perform Signature against the Attacker.', critical='You may discard all your Condition cards.', unclear=OU),
 B('Umbra', 3, 6, (4, 'Power 1'), whenRevealed='The next non-Decoying Monster performs Decoy.', instinct='Perform Signature against the Attacker. Place a Generic token on the Taunt & Decoy Trait.', critical='For two chosen Decoys, choose two Decoying Mobs and attach their miniatures to base rings. They are no longer Decoys.', unclear=OU),
 B('Invictus', 3, 8, (5, 'Opening 1 and Break 1'), instinct=DRAW3, critical='The Lictor Hunters flee in fear. You win!', whileRevealed='Disable the Mangrove Deployment Trait.', unclear=OU),
 B('Invictus Ultimae', 3, 9, (5, 'Opening 1 and Break 1'), whenRevealed='Immediately resolve AI 3 against the last Knight to wound.', wound='You win the Clash!', fail=DRAW3, critical='The Lictor Hunters flee in fear. You win!', unclear=OU),
 B('Stilicho', 3, 7, (4, 'Fire 2'), instinct='Activate 1.', critical='You may move up to your [Speed] and perform a Bonus Attack!', whileRevealed='Stilicho has -1 [AT] when adjacent to any other Monster.', unclear=OU)]
T = lambda name, kind, target, a, b, eor, draw=None: dict(name=name, kind=kind, tacticsTarget=target, tacticA=a, tacticB=b, endOfMonsterRound=eor, whenDrawn=draw)
EOR = 'Starting from the lowest number, move the activated Monsters 2 spaces '
tactics = [
 T('Ground Support Tactics', 'basic', 'Last Knight to wound in range', 'Gain the Exposed Condition card.', 'Decoy.', EOR + 'toward the closest Engaged Knight until adjacent.'),
 T('Guerrilla Tactics', 'basic', 'Lone Knight in range', 'Gain the Slimed Condition card.', 'Decoy.', EOR + 'toward the closest Great Mangrove Terrain tile.'),
 T('Ambush Tactics', 'basic', 'Highest [V] in range', 'Decoy.', 'Gain the Distracted Condition card.', EOR + 'toward the closest Swamp Terrain tile.'),
 T('Advanced Toxin Tactics', 'advanced', 'Closest Knight with the Poisoned or Toxified Condition card in range', 'Poison 1.', 'Poison 2.', EOR + 'directly away from most Knights.'),
 T('Advanced Ambush Tactics', 'advanced', 'Highest [V] in range', 'Gain the Panicked Condition card.', 'Decoy.', EOR + 'toward the closest Swamp Terrain tile.', 'When you draw this card, Escalate 1.'),
 T('Advanced Shock & Awe Tactics', 'advanced', 'Last Knight to wound in range', 'Gain the Fear Condition card.', 'Gain the Exposed Condition card.', EOR + 'directly away from most Knights.'),
]
write('firstmen_lictor_hunters', dict(sheet=SHEET, ai=AI1 + AI2, bp=BP1 + BP2, tactics=tactics, routine=dict(name='They’re in the Trees!', text='Each Knight loses -5 [V], gains the Panicked Condition card and suffers Knockdown.'), signature=None,
 _notes=['Clash Setup 다이어그램 미수령', 'Evocati·Peregrini·Auxiliari·Frumentari·Speculatore는 각 2장']))
