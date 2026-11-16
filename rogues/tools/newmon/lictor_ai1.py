from common import *
H = lambda n, t, w='moveTag': dict(stat='Heat', gte=n, effect=t, where=w)
GU = ['Heat 게이트 숫자 작은 글씨 — 확인 필요']; MA = 'MOVE & ATTACK'; DEC = 'The next non-Decoying Mob performs Decoy.'; DW = 'The next non-Decoying Mob performs Dwell.'
PT = '[Priority Target] Priority Target'
AI1 = [
 A('Gruesome Display', 1, 'JUDGEMENT', 2, 11, ['Lone Knight', PT, 'Closest Knight in sight'], 'JUDGE', ['Bravery / Sagacity.', 'One hit, gain the Distracted Condition card. Two hits, gain the Panicked Condition card. For each hit lose -1 [V]. Tactic A. [Peril].'], gates=[H(4, 'LOSE -1 [P]')], unclear=GU),
 A('Dastardly Distraction', 1, 'ATTACK', 3, 8, ['Highest [V]', 'Closest Knight in sight'], MA, ['For each hit lose -1 [V]. [Peril].'], DEC, gates=[H(3, 'TACTIC A')], unclear=GU),
 A('Jungle Trickery', 1, 'RANGE ATTACK', 3, 8, [PT, 'Engaged Knight in range', 'Closest Knight in range'], 'RANGE ATTACK 8', ['Gain the Distracted Condition card.', 'For each hit lose -2 [V].', 'Tactic B. [Peril].'], DW),
 A('Surprise Attack', 1, 'ATTACK', 3, 8, ['Highest [V]', PT, 'Closest Knight in sight'], MA, ['For each hit lose -1 [V].', 'Tactic A. [Peril].'], 'Knockdown.', gates=[H(2, '+1 [die]'), H(3, 'TACTIC B')], unclear=GU),
 A('Fungal Poison-Tipped Dart', 1, 'RANGE ATTACK', 4, 8, ['Tactics Target', 'Furthest Knight in range', 'Furthest Knight in sight'], 'RANGE ATTACK 6', ['Poison 1. For each hit lose -1 [V].', 'Tactic B. [Peril].'], gates=[H(3, '+1 [die]')], unclear=GU),
 A('Hit & Run', 1, 'ATTACK', 3, 9, ['Tactics Target', PT, 'Closest Knight in sight'], MA, ['For each hit lose -1 [V].', 'Tactic A. [Peril]. Poison 1.'], DW, gates=[H(2, 'TACTIC B')], unclear=GU),
 A('Mud Pit Trap', 2, 'JUDGEMENT', 2, 11, ['Lone Knight', PT, 'Tactics Target'], 'JUDGE', ['Fortitude / Insight.', 'If the Attack hits, lose -2 [V]. One hit, gain the Slimed Condition card. Two or more hits, gain the Drowning Condition card. Tactic A. [Peril].'], gates=[H(3, '+1 [die]')], unclear=GU),
 A('Toxic Gas', 2, 'ZONE ATTACK', 3, 8, ['Zone 2', 'No Knight in Zone: This Mob performs Signature'], 'ATTACK', ['For each hit lose -2 [V] and Poison 1. [Peril].'], 'Tactic B.'),
 A('Gorilla Charge', 2, 'ATTACK', 5, 8, ['Tactics Target', 'Closest Knight in front', 'Closest Knight in sight'], MA, ['For each hit lose -1 [V].', 'Tactic A. [Peril].'], 'Knockdown.'),
 A('Coup de Grâce', 2, 'ATTACK', 3, 10, ['Lowest [V] in front', 'Lowest [V] in sight'], MA, ['For each hit lose -2 [V]. Poison 1.', 'Tactic B. [Peril].'], DW, gates=[H(2, 'TACTIC A'), H(3, '+1 [die]')], unclear=GU),
 A('Treefrog Poison-Tipped Dart', 2, 'RANGE ATTACK', 4, 9, ['Knight with the Poisoned Condition card in range', 'Engaged Knight in range', 'Tactics Target', 'Furthest Knight in range, in sight'], 'RANGE ATTACK 6', ['For each hit lose -1 [V] and Poison 1.', 'Tactic B. [Peril].'], gates=[H(2, 'TACTIC A')], unclear=GU),
 A('Below the Belt', 2, 'ATTACK', 3, 10, ['Tactics Target', 'Last Knight to wound', 'Closest Knight in sight'], MA, ['For each hit lose -2 [V]. One hit, gain the Distracted Condition card. Two or more hits, gain the Panicked Condition card. Tactic B. [Peril].'], 'Knockdown.', gates=[H(3, 'DIFFICULTY 11+ INSTEAD')], unclear=GU),
 A('Thorn Snare', 3, 'RANGE ATTACK', 2, 8, ['Tactics Target', 'Closest Knight in range', 'Closest Knight in sight'], 'RANGE ATTACK 7', ['Knockdown. For each hit lose -5 [V] and gain a temporary negative Speed token. Tactic B. [Peril].'], gates=[H(2, 'TACTIC A')], unclear=GU),
 A('Savage Display', 3, 'JUDGEMENT', 3, 11, ['Tactics Target', 'Lone Knight', PT, 'Closest Knight in sight'], 'JUDGE', ['Bravery / Sagacity.', 'For each hit lose -3 [V]. One hit, gain the Fear Condition card and +2 [H]. Two or more hits, gain the Dread Condition card. Tactic A. [Peril].'], gates=[H(2, 'LOSE -1 [P]')], unclear=GU),
 A('Brutal Backstab', 3, 'ATTACK', 3, 9, ['Lone Knight in front', PT, 'Tactics Target'], MA, ['If the Attack hits, roll +2 additional [die]. For each hit lose -2 [V]. Gain the Exposed Condition card. Tactic B. [Peril].'], gates=[H(3, 'TACTIC A')], unclear=GU),
]
