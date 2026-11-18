from common import *
CF = ['Closest Knight in front', 'Closest Knight in sight']; CN = ['Closest Knight not in front', 'Closest Knight in sight']; PT = ['[Priority Target] Priority Target', 'Closest Knight not in front', 'Closest Knight in sight']
MA = 'MOVE & ATTACK'; EX = '[Peril]. Exhaust 1 Gear [Gear] card with the Metal Trait.'
G = lambda t: [dict(stat='Heat', gte=3, effect=t, where='effect')]
T35 = ['One hit, lose -3 [V].', 'Two or more hits, lose -5 [V].']; SIG = 'Perform Signature against the Attacker.'; RUB = 'Place a 2x2 Rubble Terrain tile under the Attacker.'
ZU = ['@ZONE']; GU = []
sheet = dict(name='Stonemason Knight', code='26B1077', traitsLine=['Vassal', 'Knight', 'Construct', 'Stone'], footprint='2x2, rear = the two cells behind (R R), four Ward Nodes (one per side)', basicAbilities=['Unavoidable Knockback 5', 'Ignore Difficult Terrain'],
 levels={1: L('6+', 8, 2, ['AI'], ['Lodestone Armor', 'Architect of Destruction', 'Ruin']), 2: L('7+', 10, 4, ['AI'], ['Uneven Footing', 'Buried Alive'], at=1, vig=2),
         3: L('8+', 10, 4, ['AI'], ['Magnetite Reinforcement', 'Impervious Armor'], esc=1, at=2, vig=3), 4: L('10+', 10, 4, ['AI'], ['Unwavering Devotion', 'Ferrospikes'], esc=1, at=3, vig=6)},
 traits=[
  dict(name='Lodestone Armor', level=1, text='When a Knight attacks the Stonemason from a side without an Armor [Armor] token, after fully resolving that Attack, place an Armor [Armor] token on the matching Ward Node. The Stonemason gains +1 [AT] if attacked from the side with an Armor [Armor] token on it. If you would place an Armor [Armor] token on the fourth Ward Node, instead discard one Armor [Armor] token from all Ward Nodes, and each Knight in Zone 2 suffers Knockback 2. The Stonemason Knight cannot gain any more Armor [Armor] tokens until the end of this Round.'),
  dict(name='Architect of Destruction', level=1, text='When the Stonemason is instructed to place a Rubble Terrain tile under a Knight, place it as close to the Stonemason as possible. Rubble Terrain tiles cannot be placed under the Stonemason (partially or fully). If you would place a Rubble Terrain tile on other Rubble Terrain tiles, remove them from the Clash Board, then place them adjacent to the newly placed Rubble Terrain tile via as many edges as possible.'),
  dict(name='Ruin', level=1, text='Ruin: Place a 2x2 Rubble Terrain tile in front of and adjacent to the Stonemason.'),
  dict(name='Uneven Footing', level=2, text='After you discard Armor [Armor] tokens via the Lodestone Armor Trait, finish resolving the current action and perform Signature.'),
  dict(name='Buried Alive', level=2, text='If a Rubble Terrain tile would be placed on a Knight already standing on a Rubble Terrain tile, that Knight draws a Judicium.'),
  dict(name='Magnetite Reinforcement', level=3, text='End of Monster Round: The Stonemason gains two Armor [Armor] tokens on the Ward Node matching the side of the Monster facing most Knights.'),
  dict(name='Impervious Armor', level=3, text='The Stonemason cannot be dealt a Wound from a side matching a Ward Node with two or more Armor [Armor] tokens.'),
  dict(name='Unwavering Devotion', level=4, text='The Lodestone Armor Trait also places Armor [Armor] tokens on sides with one Armor [Armor] token.'),
  dict(name='Ferrospikes', level=4, text='When a Knight moves through or ends their movement on a Rubble Terrain tile, they lose -1 [V].')])
ai = [
 A('Kick!', 1, 'ATTACK', 2, 10, CF, MA, ['Bane 1. For each hit lose -2 [V]. [Peril].', 'Knockback 4.']),
 A('Demolishing Blow', 1, 'ATTACK', 3, 8, CN, MA, T35 + [EX], 'Ruin.', gates=G('THREE OR MORE HITS, LOSE -2 [V]'), unclear=GU),
 A('Hammer Rise', 1, 'ATTACK', 3, 8, CF, MA, T35 + [EX, 'Pushback 2.'], 'Ruin.', gates=G('THREE OR MORE HITS, LOSE -2 [V]'), unclear=GU),
 A('Backhand Swat', 1, 'ZONE ATTACK', 2, 9, ['Knight in Rear', 'Closest Knight not in front', 'Closest Knight in sight'], MA, ['Bane 1.', 'For each hit lose -2 [V]. [Peril].'], 'Ruin.', 'AFTER FINAL ATTACK', unclear=ZU),
 A('Hammer Throw', 1, 'RANGE ATTACK', 2, 9, ['Furthest Knight in front, in range', 'Furthest Knight in sight, in range', 'Furthest Knight in sight'], 'RANGE ATTACK 7', ['Penetrate. If hit, lose -3 [V]. [Peril].', 'Exhaust 1 Gear [Gear] card with the Metal Trait. Pull 3.']),
 A('Flattening Swipe', 1, 'ZONE ATTACK', 5, 8, PT, MA, ['For each hit lose -1 [V]. [Peril].', 'Exhaust 1 Gear [Gear] card with the Metal Trait.'], unclear=ZU),
 A('Hammer Launch', 2, 'ZONE ATTACK', 2, 9, ['Closest Knight in sight'], 'MOVE LATERAL & ATTACK', ['Penetrate. If hit, lose -4 [V].', 'Exhaust 1 Gear [Gear] card with the Metal Trait.'], 'Ruin.', 'AFTER FINAL ATTACK', gates=G('DISCARD INSTEAD'), unclear=ZU),
 A('Stone Smite', 2, 'ZONE ATTACK', 2, 8, ['[Priority Target] Priority Target', 'Closest Knight in front', 'Closest Knight in sight'], MA, ['Bane 1. For each hit lose -3 [V]. [Peril].', 'Knockback 4.'], 'Ruin.', 'AFTER FINAL ATTACK', unclear=ZU),
 A('Wrecking Ball', 2, 'SEQUENTIAL ATTACK', 3, 8, ['Furthest Knight in front', 'Furthest Knight in sight'], 'MOVE & ATTACK ALL KNIGHTS IN PATH', ['Bane 1.', 'For each hit lose -2 [V]. [Peril].', 'Knockback 4 to the side.']),
 A('Toppling Sweep', 2, 'ZONE ATTACK', 3, 7, ['Zone'], 'ATTACK', T35 + [EX, 'Knockdown.'], gates=G('THREE OR MORE HITS, LOSE -2 [V]'), unclear=ZU + GU),
 A('Anvil Fall', 2, 'ATTACK', 3, 9, CN, MA, T35 + [EX + ' Pushback 3.'], 'Ruin.', gates=G('THREE OR MORE HITS, LOSE -2 [V]'), unclear=GU),
 A('Bulldozing Stomp', 2, 'ATTACK', 3, 8, CF, MA, ['Bane 1.', 'One hit, lose -4 [V].', 'Two or more hits, lose -6 [V].', '[Peril].'], 'Ruin.', gates=G('THREE OR MORE HITS, LOSE -3 [V]'), unclear=GU),
 A('Mass Driver', 3, 'ZONE ATTACK', 2, 10, ['Closest Knight in sight'], 'MOVE LATERAL & ATTACK', ['Penetrate. If hit, lose -5 [V]. [Peril].', 'Knockback 3 to the side.'], 'Ruin.', 'AFTER FINAL ATTACK', unclear=ZU),
 A('Reduce to Ruins', 3, 'SIMULTANEOUS ATTACK', 3, 8, ['All Knights'], 'ATTACK', ['Bane 2. One hit, lose -3 [V].', 'Two or more hits, lose -6 [V].', '[Peril].'], 'Place a 2x2 Rubble Terrain tile under the Target.', gates=G('THREE OR MORE HITS, LOSE -3 [V]'), unclear=GU),
 A('March of Devastation', 3, 'SEQUENTIAL ATTACK', 4, 8, ['All Knights, starting from the closest'], MA, ['Bane 1.', 'For each hit lose -2 [V]. [Peril].', 'Discard 1 Gear [Gear] card with the Metal Trait.'], 'Ruin.'),
 A('Mason Grasp', 3, 'ATTACK', 2, 9, PT, MA, ['Bane 2.', 'For each hit lose -3 [V]. [Peril].', 'Choke 3.']),
 A('Force Discharge', 3, 'ZONE ATTACK', 3, 7, ['Zone'], 'ATTACK', ['One hit, lose -4 [V].', 'Two or more hits, lose -7 [V].', '[Peril]. Exhaust all Gear [Gear] cards with the Metal Trait. Pull 2.'], gates=G('THREE OR MORE HITS, LOSE -2 [V]'), unclear=ZU + GU),
 A('Pulverize', 3, 'ATTACK', 3, 8, CF, MA, ['One hit, lose -7 [V].', 'Two or more hits, lose -9 [V].', '[Peril]. Exhaust all Gear [Gear] cards with the Metal Trait.', 'Knockdown.'], 'Ruin.', gates=G('THREE OR MORE HITS, YOU DIE')),
]
P = lambda n: (n, 'Power 1'); OU = []
EXM = 'Exhaust 1 Gear [Gear] card with the Metal Trait.'; DIS = 'Discard 1 Gear [Gear] card with the Metal Trait. Gain +2 [H].'
bp = [
 B('Stone Greaves', 1, 5, P(3), wound=RUB, fail=SIG, critical='Unexhaust 1 Gear [Gear] card with the Metal Trait. The Stonemason Knight gains a permanent negative To Hit [To Hit] token.', unclear=OU),
 B('Sturdy Backplate', 1, 6, P(3), instinct=EXM, critical='Another Knight may immediately Hug 1 and perform a Bonus Attack!', unclear=OU),
 B('Hollow Plackart', 1, 6, P(3), wound='Knockback 4.', fail=SIG, critical='Do not place an Armor [Armor] token after this Attack. You may discard 1 Armor [Armor] token from a chosen Ward Node.', unclear=OU),
 B('Vambraces of the Builders', 1, 5, P(2), wound='Knockdown.', fail='Bane 1.', critical='You may perform a Bonus Attack!', unclear=OU),
 B('Layered Tassets', 1, 4, P(2), wound='Knockback 4.', fail=RUB, critical='Gain +1 [P]. Leave 2 additional Opening and/or Break tokens in the Knight Pool.', unclear=OU),
 B('Waist Gap', 1, 4, P(2), wound=EXM, fail='Bane 1.', critical='Unexhaust 1 Gear [Gear] card with the Metal Trait. Reset [H].', unclear=OU),
 B('Ornate Visor', 2, 7, P(4), wound='Bane 1.', fail=SIG, critical='The Stonemason Knight gains a permanent negative Precision token.', unclear=OU),
 B('Gauntlets of Ruin', 2, 8, P(4), wound=SIG, fail=RUB, critical='Reposition 2. You may perform a Bonus Attack!', unclear=OU),
 B('Lodestone Chestplate', 2, 8, P(4), wound=EXM + ' Gain +1 [H].', fail=DIS, critical='Discard all Armor [Armor] tokens from Ward Nodes. Until the end of Knight Round, the Stonemason Knight cannot gain any Armor [Armor] tokens.', unclear=OU),
 B('Carved Pauldrons', 2, 7, P(3), wound=EXM + ' Gain +1 [H].', fail='Bane 1. Knockback 5.', critical='Deal an additional Single Wound!', unclear=OU),
 B('Heavy Chain', 2, 6, P(3), wound=SIG, fail='All Knights in Zone 1 suffer Knockdown.', critical='Until the end of Clash, you may ignore Gear [Gear] exhaust effects on AI cards.', unclear=OU),
 B('Flexible Joints', 2, 6, P(3), wound='Bane 1. Knockback 4.', fail=RUB, critical='Reposition 2. You may perform a Bonus Attack!', unclear=OU),
 B('Ruinous Engine', 3, 8, P(4), instinct='Place a 2x2 Rubble Terrain tile on each side of and adjacent to Stonemason Knight.', critical='Until the end of Clash ignore the Ruin Trait and any Rubble Terrain tile placement.', unclear=OU),
 B('Ferrofluid Veins', 3, 8, P(5), wound=SIG, fail=DIS, critical='Until the end of Clash you may ignore Armor [Armor] tokens on Ward Nodes when performing an Attack.', unclear=OU),
 B('Splinter of Corrupted Purpose', 3, 9, P(5), instinct='Bane 2.', critical='Disable the Stonemason’s Bane X keyword.', unclear=OU),
 B('Circlet of Andermainz', 3, 7, P(4), wound='Knockdown. Knockback 6.', fail=SIG, critical='Until the end of Clash, all Knights may ignore Gated Effects. You may perform a Bonus Attack, ignoring the Lodestone Armor Trait!', unclear=OU),
 B('Sliver of Faith', 3, 7, P(4), fail='Bane 2.', instinct=SIG, critical='Devote.', unclear=OU),
 B('Magnetite Core', 3, 9, P(5), instinct=DIS, critical='The Stonemason Knight dies! See 5442.', unclear=OU),
]
ZD = {'Backhand Swat': '정면에 붙은 2칸 [▶▶■ / ▶▶■]', 'Flattening Swipe': '정면 2x2 + 그 안쪽 열의 위·아래 대각 2칸씩 = 8칸 [·■■· / ▶▶■■ / ▶▶■■ / ·■■·]', 'Hammer Launch': '정면 2줄 x 4칸 = 8칸 [▶▶■■■■ / ▶▶■■■■]',
      'Stone Smite': '정면 2칸 + 그 바깥 대각 2칸 = 4칸 [···■ / ▶▶■· / ▶▶■· / ···■]', 'Toppling Sweep': 'Stonemason 주변 마름모 20칸 [가로 2·4·6·6·4·2칸, 가운데 2x2가 Stonemason]', 'Mass Driver': '정면 2줄이 보드 끝까지 [▶▶■■■■…]',
      'Force Discharge': 'Stonemason 주변 큰 마름모 36칸 [가로 2·4·6·8·8·6·4·2칸, 가운데 2x2가 Stonemason]'}
for c in ai: c['unclear'] = ['Zone (카드 도식에서 읽음, ▶=Stonemason 정면 방향): ' + ZD[c['name']] + '. 구현됨 — 판독 확인만 필요' if u == '@ZONE' else u for u in c['unclear']]
write('stonemason_knight', dict(sheet=sheet, ai=ai, bp=bp, routine=dict(name='Magnetopress', text='Each Knight exhausts 1 Gear [Gear] card with the Metal Trait and gains 1 Bane [Bane] token.'), signature=None,
 _notes=['Signature 카드, Clash Setup 다이어그램 미수령']))
