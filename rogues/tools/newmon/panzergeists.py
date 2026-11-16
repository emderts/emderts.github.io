from common import *
F = ['Furthest Knight in front', 'Furthest Knight']; LO = ['Lowest [V] in front', 'Lowest [V]']; NP = ['Not Possessed [Priority Target] Priority Target', 'No Target: Perform Signature']
MB = 'MOVE BEHIND & ATTACK'
WR = 'Lower your Maximum [V] by 1 for each Wound on the Wound Stack.'
BA3 = 'Another Knight may move up to 3 spaces and perform a Bonus Attack!'
sheet = dict(name='Panzergeists', code='26B1076', traitsLine=['Mob', 'Undead', 'Knight'], footprint='1x1, rear = the cell behind (R)', basicAbilities=['Superior Bypass', 'Nevermore Spawn'],
 levels={1: L('6+!', 7, 1, ['AI', 'S'], ['Suit Up!', 'Ceaseless Hunger', 'All Things Die']), 2: L('7+!', 8, 2, ['AI', 'S'], ['Panzer Cascade', 'Muffled Potential'], at=2),
         3: L('9+!', 8, 2, ['AI', 'S'], ['Soul of the Metal', 'Armored Contagion'], at=3, vig=1), 4: L('10+!', 8, 2, ['AI', 'S'], ['No Rest for Any'], esc=1, at=4, vig=3)},
 traits=[
  dict(name='Suit Up!', level=1, text='Additional Setup: Place 10 Armor [Armor] tokens on the Clash Board as indicated in Clash Setup. Whenever a Panzergeist moves onto or through a space with an Armor [Armor] token on it, place it on that Mob’s BP. When you deal a Wound to a Panzergeist with Armor [Armor] tokens, place all those tokens on the space it occupied.'),
  dict(name='Ceaseless Hunger', level=1, text='When your Maximum [V] becomes 0 or lower, do not draw a Judicium. Instead, immediately place the closest Mob on your Knight Board and end your turn—you are Possessed. As long as you’re Possessed, treat your miniature as that Mob’s miniature. You cannot attack, use abilities, or move voluntarily, and you skip your turns. When you die, place the Mob that Possessed you on the space you occupied. When that Mob is wounded, remove it from your Knight Board and reset your Maximum [V]—you’re no longer Possessed. If all Knights are Possessed at any point, you immediately lose the Clash.\n\nRecover X: Raise your Maximum [V] by X until the end of the Clash, then gain +X [V].\n\nEnd of Clash: If you’re still Possessed, die and permanently lower your Maximum [V] by 1 (note this on your Knight Sheet).'),
  dict(name='All Things Die', level=1, text='! Panzergeists without any Armor [Armor] tokens gain +4 [To Hit] when attacked with a Weapon [Gear] card without the Rust, Ethereal, or Holy Trait.\nRust: Place a Bane [Bane] token on each Gear [Gear] card with the Metal Trait equipped on your Knight. Gear [Gear] cards with Bane [Bane] tokens on them gain the Rust Trait and lose the Metal Trait. Those Bane [Bane] tokens still count toward your Bane Limit.'),
  dict(name='Panzer Cascade', level=2, text='! Panzergeist Attacks gain +1 [die] for each Armor [Armor] token on the attacking Mob.\n\nDuring Escalation, if there are no more AI cards in the Escalation decks, instead place an Armor [Armor] token on the Mob with the lowest BP Level.'),
  dict(name='Muffled Potential', level=2, text='Ignore 1 [Potential] on each Power die you roll when attacking with a Weapon [Gear] card with the Rust Trait.'),
  dict(name='Soul of the Metal', level=3, text='End of each Activation: Move this Mob onto the closest Armor [Armor] token.'),
  dict(name='Armored Contagion', level=3, text='All Gear [Gear] cards without the Ethereal, Holy, or Rust Trait gain the Metal Trait.'),
  dict(name='No Rest for Any', level=4, text='End of Knight Round: The Knight with the [Priority Target] Priority Target token lowers their Maximum [V] by 6.\n\nStart of your turn: If Possessed, the Mob on your Knight Board performs Signature (you still skip your turn).')],
 unclear=['Muffled Potential: 시트는 "Rust Trait가 있는 무기로 공격할 때 Potential 1 무시", 참고 시트(v1.1)는 "Rust 없이 공격하면" — 서로 반대. 시트 원문대로 전사함.'])
ai = [
 A('Flesh to Rust', 1, 'ATTACK', '4!', 8, LO, MB, ['For each hit lose -1 [V].', '[Peril].'], 'Rust. Lower your Maximum [V] by 3.', gates=[dict(stat='Heat', gte=3, effect='-2 [V] INSTEAD', where='effect:0')]),
 A('Tarnishing Touch', 1, 'ATTACK', '4!', 9, F, MB, ['For each hit lose -1 [V]. [Peril].', 'Rust.'], 'Exhaust your Armor [Gear] card.'),
 A('Phantasmal Backstab', 1, 'ATTACK', '2!', 9, F, MB, ['For each hit lose -2 [V]. [Peril].'], 'This Panzergeist moves up to 3 spaces toward the closest Armor [Armor] token.'),
 A('Chill the Spine', 1, 'ATTACK', '1!', 9, NP, 'MOVE & ATTACK', ['For each hit lose -6 [V]. [Peril].', 'Knockdown.'], 'Lower your Maximum [V] by 3.', gates=[dict(stat='Heat', gte=3, effect='IGNORE [React] PRECEDING MOVE & ATTACK', where='targeting')]),
 A('Geist Slam', 2, 'ATTACK', '1!', 11, LO, MB, ['For each hit lose -7 [V]. [Peril].'], 'Knockdown.'),
 A('Bewitching Brush', 2, 'ATTACK', '3!', 6, F, MB, ['For each hit lose -3 [V]. [Peril].', 'Rust.'], 'This Panzergeist moves up to 5 spaces toward the closest Armor [Armor] token.'),
 A('Corroding Grasp', 2, 'ATTACK', '2!', 7, F, MB, ['For each hit lose -4 [V]. [Peril].', 'Rust.'], 'Discard your Armor [Gear] card.'),
 A('Spectral Shriek', 2, 'ATTACK', '1!', 9, F, MB, ['For each hit lose -9 [V]. [Peril].'], 'Knockdown.', gates=[dict(stat='Heat', gte=3, effect='IGNORE [React] PRECEDING AFTER ATTACK', where='moveTag')]),
 A('Lifescourge', 3, 'ATTACK', '5!', 8, ['Highest [V] in front', 'Highest [V]'], MB, ['For each hit lose -2 [V] and suffer Rust. [Peril].', 'Knockdown.'], 'If you died, repeat this Attack against another Knight. If you survived, lower your Maximum [V] by X, where X is the number of your Bane [Bane] tokens.'),
 A('Rend the Spirit', 3, 'ATTACK', '2!', 11, NP, 'MOVE & ATTACK', ['For each hit lose -4 [V] and Bane 2. [Peril].'], 'If you died, place all Armor [Armor] tokens from the Clash Board on this Mob. If you survived, lower your Maximum [V] to 0.', gates=[dict(stat='Heat', gte=2, effect='+1 [die]', where='moveTag')]),
]
bp = [
 B('Ghostly Gaoler', 1, 2, whenRevealed=WR, fail='Rust.', critical='Recover 3 or discard up to 2 Bane [Bane] tokens.'),
 B('Damned Wiseman', 1, 4, wound='Knockdown.', fail='Lower your Maximum [V] by 3. Move this Panzergeist 3 spaces directly away from the Attacker.', critical=BA3),
 B('Spirit Guard', 1, 3, instinct='Rust. Knockdown.', critical='Recover 3. Another Knight may immediately stand up.'),
 B('Ethereal Servant', 1, 2, whenRevealed=WR, fail='Move this Panzergeist 3 spaces directly away from the Attacker.', critical='Recover 3.'),
 B('Phantasmal Clerk', 1, 3, wound='The closest Panzergeist moves 3 spaces toward the closest Armor [Armor] token.', fail='Lower your Maximum [V] by 3.', critical=BA3),
 B('Bastian, the Spook Cook', 2, 5, wound='The closest Panzergeist moves 5 spaces toward the closest Armor [Armor] token.', fail='All adjacent Knights suffer Knockdown.', critical='Recover 5.', whileRevealed='All Panzergeist Attacks gain +1 [die].'),
 B('Gisela, the Adviser Apparition', 2, 3, whenRevealed=WR, wound='Rust. The closest Panzergeist moves 5 spaces toward the closest Armor [Armor] token.', fail='Rust. Lower your Maximum [V] by 5.', critical=BA3),
 B('Ulrich, the Phantom Captain', 2, 4, wound='Knockdown.', fail='Move this Panzergeist 5 spaces directly away from the Attacker.', critical='Recover 5. Discard up to 2 Armor [Armor] tokens from the Clash Board. After the Clash, see 1150.', whileRevealed='All other Panzergeists gain +1 [AT].'),
 B('Stephen, the Revenant Knight', 3, 7, note='If there are four or more BP 1 cards on the Mob track, you cannot Wound this BP.', wound='Rust. All other Panzergeists move onto the closest Armor [Armor] token.', fail='All Knights adjacent to any Panzergeist suffer Knockdown. All knocked down Knights suffer Rust.', critical='You win the Clash!'),
 B('Ingrid, the Banshee Noble', 3, 6, whenRevealed='If there is at least one BP 2 card on the Mob track, all Knights other than the Attacker lower their Maximum [V] by 3.', wound='Rust.', fail='Rust. Lower your Maximum [V] to 0.', critical='Recover 5. Disable the Ceaseless Hunger Trait.'),
]
write('panzergeists', dict(sheet=sheet, ai=ai, bp=bp, routine=dict(name='Panzer Awakening', text='All Knights lower their Maximum [V] by X, where X is 5 + the amount of Armor [Armor] tokens on the Clash Board. Move all Panzergeists onto the closest space with an Armor [Armor] token.'), signature=None,
 _notes=['BP 카드에 Overcome/Overpower 줄 없음', 'Signature 카드, Clash Setup 다이어그램 미수령']))
