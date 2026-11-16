from common import *
P = lambda n: (n, 'Power 1'); OU = ['Overcome 숫자 작은 글씨 — 확인 필요']; DH = 'You may discard a Hex you have.'; DHP = 'You may discard a Hex you have or a Party Hex.'
PTBA = 'Gain the [Priority Target] Priority Target token. You may perform a Bonus Attack!'
BP = [
 B('A Bundle of Elixirs', 1, 4, P(2), wound='Gain the Slimed Condition card.', fail='Poison 2.', critical='One Knight may discard a Condition card.', unclear=OU),
 B('Giant Leeches', 1, 5, P(3), instinct='Poison 2. Gain +2 [H].', critical='One Knight may discard a Poisoned X or Toxified X Condition card.', unclear=OU),
 B('Flayed Skull Amulets', 1, 6, P(3), wound=DH, fail='Bog Move. Stray 2.', critical=DH + ' Disable the effects of Mortal Fault Hexes.', unclear=OU),
 B('Idolatrous Athame', 1, 4, P(2), wound=DH, fail='Stray 3.', critical=DH + ' Disable the effects of Eternal Pain Hexes.', unclear=OU),
 B('Warped Lifeless Hand', 1, 5, P(2), wound='Pushback 3. Bog Move. You may discard a Hex you have.', fail='Gain +2 [H].', critical=DH + ' ' + PTBA, unclear=OU),
 B('Putrid Roots', 1, 6, P(3), wound='Bog Move. Stray 2.', fail='Poison 3.', critical='Clash Scavenge 2.', unclear=OU),
 B('Witch’s Poppet', 2, 5, P(4), wound=DH, fail='Stray 4.', critical=DH + ' Disable the effects of Master’s Hexes.', unclear=OU),
 B('Rotten Stump', 2, 7, P(5), wound='Gain the Slimed Condition card.', fail='Toxify 2. Bog Move.', critical='Scavenge 3.', unclear=OU),
 B('Bedeviled Nithing Staff', 2, 6, P(3), wound=DH, fail='Gain +2 [H]. Stray 3.', critical=DH + ' Disable Party Hexes.', unclear=OU),
 B('Bog-Devoured Carcass', 2, 6, P(4), wound='Pushback 3. Bog Move.', fail='Poison 3.', critical='Place the Bog Witch anywhere on the Board.', unclear=OU),
 B('Feathered Serpent Talisman', 2, 7, P(5), wound=DHP, fail='Lose -3 [V], lower your [H]! by 2 and lose -1 [P].', critical=DHP + ' Disable the effects of Bad Luck Hexes.', unclear=OU + ['Fail "lower your [H]! by 2" — Heat Limit을 뜻하는지 확인 필요']),
 B('Dead Eyes', 2, 5, P(3), wound='Stray 3.', fail='Poison 2. Bog Move.', critical='Deal an additional Single Wound!', unclear=OU),
 B('Dried Meat Amulet', 3, 8, P(6), wound='One Knight may discard a Hex they have. Stray 5.', fail='Pushback 5. Bog Move.', critical='One Knight may discard a Hex they have. Disable the effects of Tongue-tied Hexes. After the Clash, if Fleischritter is in the party, see 2636.', unclear=OU),
 B('A Long Lost Child', 3, 10, P(7), note='You may voluntarily end this Attack before performing a Power Roll. If you do, clear the Knight Pool.', wound='Exhaust your active Weapon [Gear] card. Gain +4 [H].', fail='Gain the Panicked Condition card. Lower your [H]! Limit to 1.', critical=PTBA + ' Immediately see 6371.', unclear=OU),
 B('Taproot of Malice', 3, 8, P(6), wound='Discard all Hexes from all Knights.', fail='Toxify 3. Gain +4 [H]. Stray 5.', critical='The Bog Witch dies!', unclear=OU),
 B('Still Heart', 3, 9, P(5), fail='Toxify 4. Gain +2 [H].', critical=PTBA, unclear=OU),
 B('Rotten Guts', 3, 7, P(4), instinct='Toxify 3. Bog Move.', critical='Disable the One With The Bog trait.', unclear=OU),
 B('Talisman of the Ancients', 3, 8, P(6), wound=DHP + ' Stray 3.', fail='Gain the Drowning Condition card. Bog Move.', critical=DHP + ' Disable the effects of Omen Hexes.', unclear=OU),
]
ROUTINE = dict(name='Call of the Bog', text='All Knights gain the Drowning Condition card and Toxify 4.')
