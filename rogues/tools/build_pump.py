# Builds data/monsters/pumpkinhead-monstrosities.json (Mob Clash, two-sided Pumpkinhead / Sapling BPs) from the owner-confirmed
# transcription (docs/transcriptions/pumpkinheads_raw.json) + hand-written ops + Clash Setup (Sunken Kingdom Codex p.40–41).
# Usage: python3 tools/build_pump.py data/monsters/pumpkinhead-monstrosities.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/pumpkinheads_raw.json')); S = raw['sheet']
V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
TBL = lambda *ns: {'op': 'vigorByHitsTable', 'table': list(ns), 'perilCheck': True}
PB = lambda n: {'op': 'pushback', 'n': n}; KD = {'op': 'knockdown'}; AFF = lambda n: {'op': 'pumpAfflict', 'n': n}
AA = [{'op': 'pumpFastRegrowth', 'zone': 3}, {'op': 'pumpTransformingSeed'}]
AI = {
 'Reaper’s Impalement': dict(effects=[V(2)]), 'Sickle Swipe': dict(effects=[V(2), PB(1)]), 'Seed Shot': dict(range=5, effects=[V(2)]),
 'Plant Rush': dict(effects=[V(2), AFF(1)]), 'Vine Whip': dict(pull=2, effects=[V(3)]), 'Pumpkin Smash': dict(effects=[TBL(2, 3, 4)]),
 'Bullet Seed': dict(range=5, effects=[V(2)]), 'Leaf Blade': dict(effects=[V(3)]), 'Root Rampage': dict(effects=[V(3), AFF(2)]), 'Bloody Harvest': dict(effects=[V(3), PB(2)]),
 'Knight Pie': dict(judge=['Fortitude', 'Tenacity'], judiciumDies=True, effects=[V(3), AFF(3)]),
 'Pumpkin Bomb': dict(range=5, zoneAroundTarget=1, effects=[V(4)]), 'Carve ’Em Up!': dict(effects=[V(2), PB(3)]),
}
SIG = dict(effects=[AFF(1), V(2)])
POW = {'op': 'power', 'n': 1}; REP = {'op': 'pumpReposition', 'n': 2}; BA = {'op': 'bonusAttack', 'who': 'self', 'optional': True}; TOK = {'op': 'pumpExtraToken'}
BP = {
 'Samhain Warlord': dict(over=[POW], wound=[{'op': 'pumpHeatToLimit'}], fail=[KD], critical=[{'op': 'pumpEachDiscardCondition'}]),
 'Cursed Cucurbit': dict(over=[REP], wound=[AFF(2)], fail=[PB(1)], critical=[BA]),
 'The Harvest Reaper': dict(over=[REP], wound=[{'op': 'forcedVault'}], fail=[PB(2), KD], critical=[{'op': 'gainPassion', 'n': 1}]),
 'Squashbrute': dict(over=[POW], wound=[KD], fail=[{'op': 'loseVigor', 'n': 2}], critical=[{'op': 'leaveTokens', 'n': 2, 'tokens': ['opening', 'break']}]),
 'Gourd Guardian': dict(over=[POW], wound=[AFF(2), {'op': 'loseVigor', 'n': 2}], fail=[PB(3)], critical=[TOK, {'op': 'bonusAttack', 'who': 'otherKnight', 'optional': True}]),
 'Pumpking': dict(over=[POW], wound=[{'op': 'pumpGather', 'n': 2}], fail=[{'op': 'pumpAIAgainstAttacker'}], critical=[TOK, {'op': 'pumpReposition', 'n': 2}, BA]),
}
BACK = {'Eerie Seed': {'saplingAT': 1}, 'Aggressive Seed': {'saplingAT': 1}, 'Cursed Seed': {'pumpkinAT': 1}, 'Death Seed': {'pumpkinAT': 1}, 'Tough Seed': {'whenRevealed': True}, 'Royal Seed': {'whenRevealed': True}}
TYPE = {'ATTACK': 'attack', 'RANGE ATTACK': 'attack', 'RANGE ZONE ATTACK': 'attack', 'JUDGEMENT': 'judgement', 'ZONE SIGNATURE': 'zone'}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': c['targeting'], 'move': 'MOVE' in tag, 'gates': [], 'before': [], 'effects': spec.pop('effects'), 'afterAttack': AA, 'afterFinalAttack': None}
    ops.update(spec)
    if c['type'] == 'ZONE SIGNATURE': ops['zoneAroundSelf'] = 2; ops['targeting'] = ['Closest Knight']
    c['typePrinted'] = c['type']; c['type'] = TYPE[c['type']]; c['evasionDifficulty'] = int(str(c['evasionDifficulty']).rstrip('+')); c['ops'] = ops; return c
def bp(c, spec):
    c = copy.deepcopy(c); oc = c['overcome']; ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': spec['over'], 'tag': 'OVERCOME'}, 'wound': spec['wound'], 'fail': spec['fail'], 'critical': spec['critical']}
    c['level'] = 'X'; c['ops'] = ops; b = c['back']; b['level'] = 'X'
    b['ops'] = {'at': b['at'], 'overcome': None, 'wound': [], 'fail': [AFF(1)], 'critical': [POW], 'aura': BACK[b['name']]}
    return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': v['toHit'], 'wounds': v['wounds'], 'exhibitionWounds': v.get('exhibitionWounds'), 'activations': v['activations'], 'traitsAdd': [t for t in v['traitsAdd'] if not t.startswith('Kingdom Trait')], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
X = {x['name']: x for x in raw['extra']}
d = {
 'id': 'pumpkinhead-monstrosities', 'name': 'Pumpkinhead Monstrosities', 'kind': 'mob', 'code': S.get('code'), 'traitsLine': S.get('traitsLine'),
 '_source': 'Monster Sheet, AI/BP (both sides)/Kingdom Trait cards, Signature, Routine — owner scans (readings owner-confirmed 2026-11-15); Clash Setup: Sunken Kingdom Codex p.40–41',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the single cell directly behind (R on the sheet diagram)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Advanced Bypass', 'rule': 'Moves through miniatures.'}, {'name': 'Nevermore Spawn'}],
 'levels': levels,
 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': X[n]['name'], 'level': 1, 'text': f"[Kingdom Trait — {X[n]['kingdom']}] " + X[n]['text'] + '\nTransforming Seed: ' + X[n]['transformingSeed'], 'implemented': n == 'Venomous Quagmire'} for n in ('Venomous Quagmire', 'Floraforge Fury')],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c, BP[c['name']]) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'pumpFastRegrowth', 'zone': 'all'}, {'op': 'pumpTokensAll', 'n': 2}]}},
 'pump': {'kingdomTrait': {'sunken': 'Venomous Quagmire', 'principality': 'Floraforge Fury'}},
 'clashSetup': {
  '_source': 'Sunken Kingdom Codex p.40–41 (Pumpkinhead Monstrosities Clash — Sunken Kingdom diagram)',
  'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Take all BP cards and randomly flip 2 of them Sapling side up. Then, place all BP cards in a random order on spaces 1–6 on the Mob track. Put numbered base rings on 4 Pumpkinhead miniatures and 2 Red Sapling tokens with numbers corresponding to the type of BP on the Mob track. Randomly place Pumpkinhead miniatures and Sapling tokens numbered 1–6 on the spaces designated on the diagram. Note the facing direction indicated by the arrows.', 'Additional Setup: Depending on the Kingdom, take the Floraforge Fury (Principality of Stone) or Venomous Quagmire (Sunken Kingdom) Trait card. Place unused Sapling tokens and the Fool’s deck near the Monster Sheet. Place a Generic token on each Sapling BP card on the Mob track.'],
  'requiredTiles': ['1x Campfire', '8x Swamp 1x2', '2x Red Sapling tokens'],
  'pumpkinStart': [{'cell': 'H5', 'facing': 'S'}, {'cell': 'F3', 'facing': 'E'}, {'cell': 'E12', 'facing': 'W'}, {'cell': 'C10', 'facing': 'N'}], 'saplingStart': ['I8', 'B7'],
  'mobStart': ['H5', 'F3', 'E12', 'C10', 'I8 (Sapling)', 'B7 (Sapling)'], 'knightStart': ['G7', 'F9', 'E6', 'D8'],
  'terrain': [{'tile': 'campfire', 'cells': ['F7', 'F8', 'E7', 'E8']},
   {'tile': 'swamp', 'cells': ['J5', 'J6']}, {'tile': 'swamp', 'cells': ['I9', 'I10']}, {'tile': 'swamp', 'cells': ['H4', 'G4']}, {'tile': 'swamp', 'cells': ['G12', 'F12']}, {'tile': 'swamp', 'cells': ['E3', 'D3']}, {'tile': 'swamp', 'cells': ['D11', 'C11']}, {'tile': 'swamp', 'cells': ['B5', 'B6']}, {'tile': 'swamp', 'cells': ['A9', 'A10']}],
  'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 (소유자 확인 2026-11-15)']},
 'rulings': [
  'Two-sided BPs are always face-up: the Sapling-side "While this BP is revealed" auras apply while that side is up, "When revealed" triggers when the card is flipped to that side during the Clash, ignored at Setup (owner reference sheet PHM v1.1, 2026-11-15)',
  'Fast Regrowth "flip all Red Sapling tokens to the Green side": every Red Sapling on the board, not only those in the Zone (reference sheet PHM v1.1)',
  'Sapling AI Escalation: the AI card removed has the Level equal to the Generic tokens on the wounded BP (1 → AI 1 out, AI 2 in; 2 → AI 2 out, AI 3 in; 3 → AI 3 swapped for another AI 3)',
  'Controlled Burn: a Sapling can only be wounded if a Fire token was in the Knight Pool when the Power Roll was resolved (Fire spent on that attack counts) (소유자 확인 2026-11-15)',
  'Fire Walk with Me: a Pumpkinhead whose shortest path crosses the Campfire burns; when equally short paths exist with and without the Campfire, the players choose (소유자 확인 2026-11-15). Level 2+: the new Sapling gets 2 Generic tokens instead of 1; its AI Escalation uses the tokens then on that BP (reference sheet PHM v1.1)',
  'Pumpkin Bomb (RANGE ZONE ATTACK, no diagram on the card): the Target and every Knight in Zone 1 around the Target (소유자 확인 2026-11-15)',
  'MOVE & RANGE ATTACK 5: moves until within 5 spaces of the Target; Vine Whip PULL 2: the Target is Pulled 2 toward the Pumpkinhead before it moves',
  'Venomous Quagmire growth: the players choose which 2x2 block containing the Pumpkinhead\'s space gets the Swamp (spaces with other Terrain are skipped) (소유자 확인 2026-11-15); Transforming Seed uses the Vigor the Target lost in this Attack',
  'Floraforge Fury (Principality): Afflict X = Parasitize X is NOT implemented (keyword definition needed); growth move and Transforming Seed (Armor token on Saplings in Zone 3) are implemented',
  'Pumpkin Plague (Level 3): the Knight chooses the Gear card for each Generic token; 1 token per Gear slot (2 for a 2-handed Weapon); death → Heal 1 puts the top Wound-Stack BP back as a Pumpkinhead on the Knight\'s space, without Fast Regrowth (reference sheet PHM v1.1)',
  'Lumbering = Saplings cannot be moved involuntarily (reference sheet); Accelerated Regrowth also applies to the Setup Saplings; "Nevermore Spawn" is not implemented (definition needed); "Reposition 2" = the Knight may move up to 2 spaces',
  'Lose condition: 4 Generic tokens on any BP (Ecological Cataclysm). Routine Photosynthesis: Fast Regrowth on the whole board, then 2 Generic tokens on each BP',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
