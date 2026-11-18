from common import *
H = lambda n, t, w='moveTag': dict(stat='Heat', gte=n, effect=t, where=w)
GU = []; MA = 'MOVE & ATTACK'
CF = ['Closest Knight in front', 'Closest Knight in sight']; KD = ['Closest knocked down Knight'] + CF; LK = ['Closest Lone Knight'] + CF
sheet = dict(name='Ratwolves', code='26A1073', traitsLine=['Mob', 'Beast', 'Hunter'], footprint='1x1, rear = the cell behind (R)', basicAbilities=['Immediate Spawn'],
 levels={1: L('6+', 4, 1, ['AI', 'AI'], ['Strength of the Pack', 'Rising Pressure', 'Go for the Weakest Link', 'Kingdom Trait (see Clash Setup)']), 2: L('6+', 5, 2, ['AI', 'AI'], ['Relentless Pull', 'Into the Chittering Shadows'], at=1, vig=1),
         3: L('7+', 5, 2, ['AI', 'AI'], ['Kinderfänger', 'Adaptability'], esc=1, at=2, vig=2), 4: L('8+', 5, 2, ['AI', 'AI'], ['Ravening Ratswarm', 'Rat King'], esc=1, at=3, vig=2, ev=1)},
 traits=[
  dict(name='Strength of the Pack', level=1, text='A Ratwolf’s Toughness value, shown directly above the AT value, indicates how many times it can survive a Knight Attack that would otherwise be deadly. When you are about to wound a BP card, if the number of Generic tokens on it is equal to its Toughness value, you simply deal a Wound and the Ratwolf dies. Otherwise, instead of dealing a Wound, place a Generic token on this BP card and leave it revealed on the Mob track, then resolve Responses as if you dealt a Wound.\n\nWhen a Ratwolf dies, finish resolving the current action, then Spawn a new Ratwolf with a BP of one Level higher. If there are no valid BP cards, Spawn a Ratwolf of the same BP Level or lower (prioritizing higher Levels). New Ratwolves Spawn adjacent to a random Knight, on a space closest to the Board Edge and without an Obstacle. If that space is occupied by another miniature, Displace it. Then, the spawned Ratwolf performs Signature.'),
  dict(name='Rising Pressure', level=1, text='When a Knight gains Condition tokens, they gain that much [H].'),
  dict(name='Go for the Weakest Link', level=1, text='After resolving all other Attack Consequences:\n• If you are knocked down, Afflict 1.\n• If you are a Lone Knight, Afflict 1.'),
  dict(name='Relentless Pull', level=2, text='Increase each Drag performed by Ratwolves by 1 for every Condition token on the Target.'),
  dict(name='Into the Chittering Shadows', level=2, text='Ratwolves always perform Drag toward the closest short Board Edge.'),
  dict(name='Kinderfänger', level=3, text='At the end of a Drag performed by a Ratwolf, if you are a Lone Knight, suffer Knockdown.'),
  dict(name='Adaptability', level=3, text='This Trait changes depending on the Kingdom. Refer to the Kingdom Trait.'),
  dict(name='Ravening Ratswarm', level=4, text='During a Drag performed by a Ratwolf, if it would cause that Ratwolf to move past a short Board Edge, the Target dies. Place the Ratwolf adjacent to a random Knight on a space closest to a short Board Edge and without an Obstacle. If that space is occupied by another miniature, Displace it.'),
  dict(name='Rat King', level=4, text='Knights cannot discard Condition cards with Condition tokens, or discard any tokens from those cards, unless adjacent to another Knight.')],
 kingdomTraits=[dict(name='Parasite Bed', kingdom='Principality of Stone', text='Afflict X: Parasitize X.\n\nAdaptability (Level 3+): After you perform a [Peril], suffer a penalty based on the number of Condition tokens you have:\n2–3: Cooldown.\n4+: Delay.'),
                dict(name='Bile and Poison', kingdom='Sunken Kingdom', text='Afflict X: Poison X.\n\nAdaptability (Level 3+): During an Armor Roll, ignore X rolled [Armor symbol], where X is the number of your Condition tokens.')])
ai = [
 A('Toppling Charge', 1, 'ATTACK', 3, 8, CF, MA, ['For each hit lose -1 [V]. [Peril].'], 'Knockdown.', gates=[H(4, '-2 [V] INSTEAD', 'effect:0')], unclear=GU),
 A('Tearing Bite', 1, 'ATTACK', 2, 9, CF, MA, ['For each hit lose -1 [V]. [Peril].', 'Afflict 1.'], 'Drag 3.'),
 A('Furious Pull', 1, 'ATTACK', 3, 8, CF, MA, ['For each hit lose -1 [V]. [Peril].'], 'Drag 5.', gates=[H(3, '+1 [die]')], unclear=GU),
 A('Fanged Snap', 1, 'ATTACK', 4, 7, CF, MA, ['For each hit lose -1 [V]. [Peril].'], 'Drag 2.', gates=[H(3, 'AFFLICT 1', 'effect')], unclear=GU),
 A('Pestilent Bite', 2, 'ATTACK', 2, 8, KD, MA, ['For each hit lose -2 [V]. [Peril].', 'Afflict 1.'], 'Drag 3.'),
 A('Dire Howl', 2, 'JUDGEMENT', 3, 9, LK, 'JUDGE', ['Bravery.', 'One or two hits, gain the Fear Condition card. Three or more hits, gain the Dread Condition card.', 'If no other Knight in Zone 2, Knockdown.'], 'Knockback 3.', gates=[H(4, 'ESCALATE THE LOWEST UNREVEALED BP')], unclear=GU),
 A('Isolating Pull', 2, 'ATTACK', 3, 8, KD, MA, ['For each hit lose -1 [V]. [Peril].', 'Afflict 1.'], 'Drag 6.', gates=[H(3, '+1 [die]')], unclear=GU),
 A('Verminous Gnawing', 2, 'ATTACK', 2, 8, LK, MA, ['For each hit lose -2 [V]. [Peril].', 'Swarm 1.', 'Knockdown.'], 'Drag 2.', gates=[H(3, 'AFFLICT 1', 'effect')], unclear=GU),
 A('Cursed Bite', 3, 'ATTACK', 3, 8, ['Closest Lone Knight', '[Priority Target] Priority Target in sight'], MA, ['For each hit lose -2 [V]. [Peril].', 'If a Knight dies from this Attack, gain +1 [Curse].'], 'Activate 1.', gates=[dict(stat='ConditionTokens', gte=3, effect='+1 [die]', where='moveTag')]),
 A('Ratswarm', 3, 'ATTACK', 4, 7, ['[Priority Target] Priority Target in sight'], MA, ['For each hit lose -1 [V] and Afflict 1.', 'For every 2 hits roll 1 additional [die] (resolve once). [Peril].', 'If no other Knight in Zone 1, Knockdown.'], 'Pushback 5.', gates=[H(4, '-2 [V] INSTEAD', 'effect:0')], unclear=GU),
]
def R(name, level, tough, at, oc=None, **kw): b = B(name, level, at, oc, **kw); b['toughness'] = tough; return b
FAM = dict(fail='Escalate AI 1.', whileRevealed='All other Ratwolves gain “Instinct: Poison 1.”', note='Pitiful vermin.')
bp = [
 R('Famished Ratwolf', 1, 1, 2, **FAM), R('Famished Ratwolf', 1, 1, 2, **FAM),
 R('Ratwolf', 1, 1, 3, wound='Reveal the rightmost unrevealed Mob BP on the Mob track.', fail='Perform Signature against the Attacker.', critical='Look at a chosen BP card.'),
 R('Ratwolf', 1, 1, 3, wound='Reveal the leftmost unrevealed Mob BP on the Mob track.', fail='Perform Signature against the Attacker.', critical='Look at a chosen BP card.'),
 R('Stalking Ratwolf', 2, 1, 4, (3, 'Power 1'), wound='Gain the [Priority Target] Priority Target token.', instinct='Draw AI for the furthest Mob.', critical='Another Knight may perform a Bonus Attack!', whileRevealed='Always trigger [H] effects.'),
 R('Giant Ratwolf', 2, 2, 5, wound='Move one Activation token to the next unassigned Mob.', fail='Perform Signature against the Attacker.', critical='You may flip a chosen BP card face down.', whileRevealed='All Ratwolves gain +1 [AT].'),
 R('Plague-Ridden Ratwolf', 2, 1, 3, whenRevealed='This Ratwolf and every other Ratwolf in Zone 2 gain an Armor [Armor] token.', instinct='Parasitize 1.', fail='Perform Signature against the Attacker.', critical='Place a temporary negative Precision token in the Knight Pool.'),
 R('Leader of the Pack', 3, 1, 7, (5, 'Power 1'), wound='Draw AI for the furthest Mob.', fail='Drag 3.', critical='Gain the Courage Condition card. Reset your [H].', whileRevealed='When Leader of the Pack dies: You win!'),
 R('Alpha Ratwolf', 3, 1, 5, (4, 'Power 1'), wound='Activate 1.', fail='Escalate AI.', critical='You may perform a Bonus Attack!', whileRevealed='Increase [V] loss caused by each Monster Attack by 1. When Alpha Ratwolf dies: You win!'),
]
write('ratwolves', dict(sheet=sheet, ai=ai, bp=bp, routine=dict(name='Chittering Pack', text='Each Knight gains the Fear Condition card and suffers Poison 2.'), signature=None,
 _notes=['AI 10장, BP 9장', 'Lone Knight = 3칸 이내에 다른 기사 없음 (참고 시트 v1.2)', 'Parasitize, Swarm 키워드 정의 확인 필요']))
