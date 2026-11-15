# Builds data/monsters/first-men-warriors.json from the owner-confirmed transcription (docs/transcriptions/firstmen_warriors_raw.json)
# + hand-written engine ops + Clash Setup (Sunken Kingdom Codex p.46–47). The White Ape Troll (Long Howl) uses AI 2 Rampage Strike and
# BP 2 Muscular Chest from docs/transcriptions/white_ape_troll_raw.json.
# Usage: python3 tools/build_firstmen.py data/monsters/first-men-warriors.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/firstmen_warriors_raw.json'))
wat = json.load(open('docs/transcriptions/white_ape_troll_raw.json'))
S = raw['sheet']

def zone(rows):
    mk = None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in '^>v<': mk = (x, y, ch)
    mx, my, f = mk
    rel = lambda x, y: {'^': (my - y, x - mx), '>': (x - mx, y - my), 'v': (y - my, mx - x), '<': (mx - x, my - y)}[f]
    return {'red': [rel(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == 'R'], 'yellow': [], 'step': None}

V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
VH = lambda one, more: {'op': 'vigorByHits', 'one': one, 'more': more, 'perilCheck': True}
T = lambda w, n: {'op': 'tactic', 'which': w, 'n': n}
EXP = {'op': 'condition', 'id': 'Exposed'}
HD = {'op': 'evasionDice', 'stat': 'heat', 'gte': 3, 'n': 1}
KD = {'op': 'knockdown'}; FV = {'op': 'forcedVault'}; PB1 = {'op': 'pushbackPerHit', 'n': 1}
SPD = {'op': 'tempSpeed', 'n': -1}

AI = {
 'Quick Jab': dict(effects=[T('A', 2), VH(1, 3), T('B', 1)]),
 'Shield Ram': dict(gates=[HD], effects=[EXP, T('A', 2), V(1), T('B', 1)], afterAttack=[FV, PB1]),
 'Sling-Bullet': dict(gates=[HD], range='unlimited', effects=[EXP, V(1)]),
 'Probing Incursion': dict(gates=[HD], effects=[T('A', 2), V(1), T('B', 1)]),
 'Pommel Strike': dict(gates=[HD], effects=[EXP, T('A', 2), V(1), T('B', 1)]),
 'Net Snare': dict(range='unlimited', effects=[V(1), {'op': 'cooldown'}, SPD]),
 'Piercing Thrust': dict(gates=[HD], effects=[T('A', 3), V(1), T('B', 1)]),
 'Heavy Javelin Throw': dict(gates=[HD], range='unlimited', effects=[EXP, V(2)]),
 'Fierce Charge': dict(gates=[HD], effects=[EXP, T('A', 3), V(1), T('B', 1), KD], afterAttack=[FV, PB1]),
 'Hidden Blade': dict(effects=[EXP, T('A', 3), V(2), T('B', 1)]),
 'Pinning Throw': dict(range='unlimited', effects=[V(1), {'op': 'delay'}]),
 'Centurion Strike': dict(gates=[HD], effects=[T('A', 3), V(1), T('B', 1)]),
 'Fall of an Empire': dict(gates=[HD], landOnTop=True, effects=[EXP, V(2), KD], afterFinalAttack=[T('A', 4), T('B', 2)]),
 'Iron Rain': dict(gates=[HD], range='unlimited', effects=[EXP, {'op': 'loseVigorPerHit', 'n': 2, 'perilCheck': False}, {'op': 'vigorPerAdjacentMob', 'n': 1, 'perilCheck': True}]),
 'Et Tu': dict(gates=[HD], effects=[T('A', 3), V(2), T('B', 2), {'op': 'graveToJudicium'}]),
 'Brutal Skewering': dict(effects=[EXP, T('A', 3), VH(3, 5), T('B', 2)]),
 'Razor Snare': dict(range='unlimited', effects=[V(2), {'op': 'discard'}, SPD]),
 'Vicious Stab': dict(gates=[HD], effects=[T('A', 3), V(2), T('B', 2)]),
}
SIG = dict(gates=[HD], range='unlimited', effects=[V(1), T('B', 2)], afterAttack=[{'op': 'moveAway', 'n': 2}])

SIGN = {'op': 'mobSignatureAgainst', 'which': 'furthest'}
FLIP = {'op': 'flipBPDown'}
LOOK = {'op': 'lookBP'}
MBA = lambda n, who=None, exact=False: {'op': 'moveAndBonusAttack', 'n': n, 'upTo': not exact, **({'who': who} if who else {})}
OVER = {'Opening 1': [{'op': 'poolToken', 'token': 'opening', 'n': 1}], 'Break 1': [{'op': 'poolToken', 'token': 'break', 'n': 1}],
        'Break 1 and Opening 1': [{'op': 'poolToken', 'token': 'break', 'n': 1}, {'op': 'poolToken', 'token': 'opening', 'n': 1}], 'Power 1': [{'op': 'power', 'n': 1}]}
BP = {
 ('Hastati', 3): dict(wound=[{'op': 'revealBP', 'side': 'rightmost'}], fail=[T('A', 2)], critical=[FLIP]),
 ('Hastati', 2): dict(wound=[{'op': 'revealBP', 'side': 'rightmost'}], fail=[T('A', 2)], critical=[FLIP]),
 ('Principes', 3): dict(wound=[SIGN], fail=[T('A', 2)], critical=[MBA(1, 'other', True)], aura={'zone2ToHit': 1}),
 ('Triarii', 3): dict(wound=[SIGN], fail=[T('A', 2)], critical=[MBA(1, None, True)], aura={'zone2Vigor': 1}),
 ('Velites', 2): dict(wound=[{'op': 'revealBP', 'side': 'leftmost'}], fail=[T('A', 2)], critical=[LOOK]),
 ('Legionary', 4): dict(wound=[SIGN], fail=[T('A', 3)], critical=[FLIP], aura={'zone2AT': 1}),
 ('Legionary', 3): dict(wound=[SIGN], fail=[T('A', 3)], critical=[FLIP], aura={'zone2AT': 1}),
 ('Centurion', 4): dict(whenRevealed=[{'op': 'escalateLowestUnrevealed'}], wound=[{'op': 'drawAIFor', 'which': 'closestOther'}], fail=[T('A', 3)], critical=[MBA(2, 'other')]),
 ('Praetorian', 5): dict(wound=[{'op': 'escalateLowestUnrevealed'}], fail=[T('A', 3)], critical=[MBA(2)], aura={'zone2Vigor': 2}),
 ('Venator', 3): dict(whenRevealed=[{'op': 'genericToken', 'n': 1}], wound=[{'op': 'activateFromTokens'}], fail=[T('A', 3), {'op': 'genericToken', 'n': -1}], critical=[{'op': 'clashFlag', 'flag': 'noAiSpeed'}], aura={'venator': True}),
 ('Augur', 3): dict(wound=[{'op': 'swampUnder', 'where': 'mob'}, {'op': 'condition', 'id': 'Slimed'}], fail=[{'op': 'swampUnder', 'where': 'attacker'}], critical=[{'op': 'removeAllSwamps'}], aura={'augur': True}),
 ('Cestus', 5): dict(instinct=[FV, KD], critical=[{'op': 'clashFlag', 'flag': 'firstmenMinusDie'}], aura={'cestus': True, 'instinctOnAttack': True}),
 ('Murmillo', 5): dict(whenRevealed=[{'op': 'genericToken', 'n': 1}], instinct=[{'op': 'exhaustActiveWeapon'}], critical=[{'op': 'clashFlag', 'flag': 'firstmenMinusAT'}], aura={'murmillo': True, 'instinctOnAttack': True}),
 ('Scissor', 5): dict(instinct=[{'op': 'drawAIFor', 'which': 'closestOther', 'level': 3}], critical=[{'op': 'winClash'}], aura={'extraSignatureToken': True, 'instinctOnAttack': True}),
 ('Retiarius', 4): dict(whenRevealed=[{'op': 'genericToken', 'n': 1}], instinct=[EXP, SPD], critical=[{'op': 'clashFlag', 'flag': 'firstmenMinusToHit'}], aura={'retiarius': True, 'instinctOnAttack': True}),
 ('Hoplomachus', 4): dict(instinct=[{'op': 'loseVigor', 'n': 2}], critical=[{'op': 'clashFlag', 'flag': 'firstmenLessVigor'}], aura={'hoplomachus': True, 'instinctOnAttack': True}),
 ('Thraex', 4): dict(instinct=[{'op': 'discard'}], critical=[{'op': 'disableTrait', 'id': 'Battle Tactics'}], aura={'zone2VigorPerHit': 1, 'instinctOnAttack': True}),
}
TYPE = {'ATTACK': 'attack', 'RANGE ATTACK': 'attack', 'ZONE ATTACK': 'zone', 'RANGE SIGNATURE': 'attack', 'SIGNATURE': 'attack'}

def ai(c, spec, moveTag=None):
    c = copy.deepcopy(c); spec = dict(spec); tag = moveTag or c.get('moveTag') or ''
    ops = {'targeting': c['targeting'], 'move': tag.startswith('MOVE'), 'gates': spec.pop('gates', []), 'before': spec.pop('before', []), 'effects': spec.pop('effects'),
           'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    ops.update(spec)
    if c.get('zoneDiagram') and c['zoneDiagram'].get('rows'): ops['zoneDiagram'] = zone(c['zoneDiagram']['rows'])
    c['type'] = TYPE.get(c['type'], c['type'].lower()); c['ops'] = ops; return c

def bp(c, spec):
    c = copy.deepcopy(c); oc = c['overcome']
    ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': OVER[oc['effect']]} if oc else None}
    for k in ('wound', 'fail', 'instinct', 'critical', 'whenRevealed', 'aura'):
        if k in spec: ops[k] = spec[k]
    c['ops'] = ops; return c

cards_bp = []
for c in raw['bp']:
    key = (c['name'], c['overcome']['n'] if c['overcome'] else None)
    assert key in BP, key
    cards_bp.append(bp(c, BP[key]))
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI]; assert not missing, missing

# Battle Tactics cards
TAC = {}
for x in raw['extra']:
    nm = x['name']
    if nm.startswith('Horde'): a, b, eom = [{'op': 'gangup', 'n': 'X'}], [{'op': 'swarm', 'n': 'X'}], {'move': 2, 'toward': 'closestMob'}
    elif nm.startswith('Predator'): a = b = [{'op': 'pull', 'n': 'X'}, {'op': 'drag', 'n': 'X'}]; eom = {'move': 2, 'awayFromMostKnights': True}
    else: a, b, eom = [{'op': 'herd', 'n': 'X'}], [{'op': 'splinter', 'n': 'X'}], {'move': 2, 'toward': 'closestMob'}
    TAC[nm] = {**x, 'ops': {'target': x['tacticsTarget'], 'loneExtraVigor': 2 if nm.startswith('Predator') else 0, 'A': a, 'B': b, 'endOfMonsterRound': eom}}

# White Ape Troll pieces (Long Howl)
rs = next(c for c in wat['ai'] if c['name'] == 'Rampage Strike'); mc = next(c for c in wat['bp'] if c['name'] == 'Muscular Chest')
troll = {
 'ai': ai(rs, dict(gates=[HD, {'op': 'pushback', 'stat': 'always', 'n': 3}], effects=[EXP, V(2), {'op': 'delay'}, {'op': 'knockback', 'n': 4}])),
 'bp': bp({**mc, 'overcome': mc['overcome']}, dict(wound=[{'op': 'pushback', 'n': 4}], fail=[EXP], critical=[{'op': 'bonusAttack', 'who': 'self', 'optional': True, 'autoBreak': 2}])),
}

TR = {'Battle Tactics': 'battle-tactics', 'Mangrove Deployment': 'mangrove-deployment', 'Long Howl': 'long-howl', 'Show of Strength': 'show-of-strength', 'Retribution': 'retribution', 'Keeping Up the Pressure': 'keeping-up-the-pressure'}
levels = {}
for l, v in S['levels'].items():
    b = v['bonuses']; levels[l] = {'toHit': v['toHit'], 'wounds': v['wounds'], 'exhibitionWounds': v.get('exhibitionWounds'), 'activations': ['AI', 'AI'], 'activationsText': v.get('activationsText', '2 AI'), 'traitsAdd': v['traitsAdd'], 'bonuses': {'escalations': b.get('escalations', 0), 'at': b.get('at', 0), 'vigorLoss': b.get('vigorLoss', 0)}}
d = {
 'id': 'first-men-warriors', 'name': 'Firstmen Warriors', 'kind': 'mob', 'code': S.get('code'), 'traitsLine': S.get('traitsLine'),
 '_source': 'Monster Sheet (2 pages), AI/BP/Battle Tactics card sheet, Signature — owner scans 2026-11-15 (readings owner-confirmed); Clash Setup: Sunken Kingdom Codex p.46–47',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the cell directly behind (R / eye on the sheet diagram = Rear + Blindspot)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Advanced Bypass', 'rule': 'Rulebook p.80: may move through other miniatures; cannot end on one.'}, {'name': 'Blindspot', 'rule': 'The space behind each Warrior is a Blindspot: Knights there are not in sight and gain +1 Precision.'}, {'name': 'Immediate Spawn', 'rule': 'Rulebook p.62 + Mangrove Deployment: a killed Warrior is replaced at once (BP one level higher) on a Great Mangrove tile, cycling 1→2→3.'}],
 'levels': levels, 'traits': [{'id': TR[t['name']], **t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': cards_bp, 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'longHowl', 'oncePerClash': True}, {'op': 'escalateX', 'n': 1}]}},
 'battleTactics': TAC, 'troll': troll,
 'clashSetup': {
  '_source': 'Sunken Kingdom Codex p.46–47 (Firstmen Warriors Clash)',
  'requiredTiles': {'swamp 1x2': 8, 'swamp 2x2': 1, 'great mangrove': 3, 'rubble 2x2': 2, 'rubble L': 1},
  'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Randomly place Firstmen Warrior miniatures numbered 1–6 on the designated spaces (facing per arrows). Then place 6 BP 1 cards face down in a random order on spaces 1–6 of the Mob track.', 'Additional Setup: Follow Trait instructions (Battle Tactics: draw one Battle Tactics card). Set aside all Battle Tactics cards not used in this Clash.', 'Numbered Terrain tiles: Great Mangrove 1–3.'],
  'mobStart': [{'cell': c, 'facing': 'right'} for c in ['G5', 'G6', 'G7', 'D5', 'D6', 'D7']], 'mobTrack': {'1': 6}, 'knightStart': ['H9', 'F9', 'E9', 'C9'],
  'terrain': [
   {'tile': 'great mangrove', 'cells': ['J7', 'J8', 'I7', 'I8'], 'num': 1}, {'tile': 'great mangrove', 'cells': ['D11', 'D12', 'C11', 'C12'], 'num': 2}, {'tile': 'great mangrove', 'cells': ['E2', 'E3', 'D2', 'D3'], 'num': 3},
   {'tile': 'swamp', 'cells': ['J1', 'J2']}, {'tile': 'swamp', 'cells': ['J3', 'J4']}, {'tile': 'swamp', 'cells': ['I1', 'H1']}, {'tile': 'swamp', 'cells': ['J12', 'J13']}, {'tile': 'swamp', 'cells': ['J14', 'I14']},
   {'tile': 'swamp', 'cells': ['A1', 'A2']}, {'tile': 'swamp', 'cells': ['A3', 'A4']}, {'tile': 'swamp', 'cells': ['D13', 'C13']}, {'tile': 'swamp', 'cells': ['B13', 'B14', 'A13', 'A14'], 'shape': '2x2'},
   {'tile': 'rubble', 'cells': ['I2', 'I3', 'H2', 'H3'], 'shape': '2x2'}, {'tile': 'rubble', 'cells': ['B5', 'B6', 'A5', 'A6'], 'shape': '2x2'}, {'tile': 'rubble', 'cells': ['I12', 'I13', 'H13', 'G13'], 'shape': 'L'}],
  'unclear': ['지형 칸 위치는 코덱스 도식에서 읽음 — 확인 필요']},
 'rulings': [
  'Tactic A/B lines resolve in card order on a hit, using the drawn Battle Tactics card with X = the printed number; on BP Fail responses they target the Attacker [해석, 확인 필요]',
  'Tactics Target = the Battle Tactics card\'s targeting line (Closest non-Engaged / Closest Lone / Closest Grouped Knight)',
  'Predator Tactics "Lone Knights additionally lose -2 Vigor" applies to every Firstmen Attack that causes Vigor loss to a Lone Knight [해석, 확인 필요]',
  'Mangrove Deployment: the new Warrior (BP one level higher, leftmost empty track space) waits on the Mangrove tile — off the Clash Board — until the End of the Knight Round, then moves adjacent to that tile onto the free space closest to any Knight (lowest number first)',
  'RANGE ATTACK UNLIMITED: no movement; any Knight in sight can be targeted',
  'LAND ON TOP: the Warrior moves onto the Target\'s space, the Target is Displaced to a front space; the Zone is the card diagram around the Warrior',
  'Iron Rain "every Mob adjacent to the Attacker": Mobs adjacent to the attacking Warrior [해석, 확인 필요]',
  'Long Howl: the White Ape Troll (2x2) Spawns on the centre (F7/F8/E7/E8, Displacing miniatures), faces the most Knights, uses the Firstmen To Hit/AT/Vigor bonuses, activates after the Warriors each Monster Round with Rampage Strike; Knights attacking it always hit Muscular Chest; wounding it Escalates the Firstmen AI deck, adds a Generic token and a Single Wound to the Wound Stack; 4 tokens → it flees',
  'Rampage Strike "MOVE, PUSHBACK 3 & ATTACK": Pushback 3 on a hit, before the effects [해석, 확인 필요]',
  '"When X attacks, add its Instinct Response to the After Attack": the revealed BP3 Warrior\'s own Instinct Response is resolved against its Target after its attacks',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP', list(TAC))
