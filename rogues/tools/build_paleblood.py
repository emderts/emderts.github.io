# Builds data/monsters/paleblood-worms.json from the owner-confirmed transcription (docs/transcriptions/paleblood_worms_raw.json)
# plus hand-written engine ops for every card, and the Clash Setup read from the Principality of Stone Codex p.44–45.
# Usage: python3 tools/build_paleblood.py data/monsters/paleblood-worms.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/paleblood_worms_raw.json'))
S = raw['sheet']

V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
VX = lambda peril=True: {'op': 'loseVigorPerHit', 'nFrom': 'blood', 'perilCheck': peril}
SUCK = lambda n: {'op': 'suck', 'n': n}
BURROW = lambda n: {'op': 'burrow', 'n': n}
G = lambda gte, then, els=None, stat='blood': {'op': 'gated', 'stat': stat, 'gte': gte, 'then': then, **({'else': els} if els else {})}
KD = {'op': 'knockdown'}
KB = lambda n: {'op': 'knockback', 'n': n}
ACT = lambda n: {'op': 'activate', 'n': n}
REPEAT = {'op': 'repeatCard'}

# ---- AI / Signature ops (attack-level gates: stat 'blood' = Blood tokens on the attacking Mob, 'heat' = the Target's Heat) ----
AI = {
 'Infectious Leech': dict(effects=[V(1), {'op': 'mobIf', 'cond': {'vigorLostAtLeast': 2}, 'then': [SUCK(2)]}], afterAttack=[G(3, [KD]), BURROW(6)]),
 'Bloodsucker’s Proboscis': dict(effects=[V(2), SUCK(1)], afterAttack=[G(2, [KD]), BURROW(3)]),
 'Snapping at Your Heels': dict(gates=[{'op': 'evasionDice', 'stat': 'blood', 'gte': 1, 'n': 1}], effects=[V(1), SUCK(1)], afterAttack=[G(2, [BURROW(2)], [BURROW(4)])]),
 'Swarming Bite': dict(effects=[V(1), SUCK(1), G(2, [REPEAT])], afterFinalAttack=[BURROW(7)]),
 'Feeding Frenzy': dict(effects=[SUCK(1), VX(), SUCK(1), G(3, [REPEAT])], afterFinalAttack=[G(2, [BURROW(1)], [BURROW(10)])]),
 'Brutal Bloodletting': dict(judge=['Fortitude', 'Might'], diceFromBlood=2, moveOps=[SUCK(1)], effects=[V(2)], afterAttack=[SUCK(1), BURROW(2)]),
 'Bite from Below': dict(zoneAroundTile={'tile': 'paleburrow', 'z': 1, 'gate': {'stat': 'blood', 'gte': 3, 'z': 2}}, beforeAttack=[{'op': 'removeOtherWorms'}], effects=[V(2)], afterAttack=[G(1, [KD])]),
 'Vicious Bite': dict(gates=[{'op': 'discardArmorGear', 'stat': 'blood', 'gte': 3}], effects=[V(2), SUCK(1), {'op': 'mobIf', 'cond': {'vigorLostAtLeast': 4}, 'then': [SUCK(1)]}], afterAttack=[G(2, [KB(4)]), BURROW(8)]),
 'Paint the Swamp Red': dict(gates=[{'op': 'ignoreReact', 'stat': 'blood', 'gte': 2}], effects=[G(2, [{'op': 'die', 'reason': 'Blown to pieces'}], [{'op': 'vigorToZero', 'perilCheck': True}])], afterAttack=[{'op': 'discardMobBlood'}, {'op': 'removeSelf'}]),
 'Violent Dismemberment': dict(gates=[{'op': 'vigorPerHitInstead', 'stat': 'blood', 'gte': 2, 'n': 2}], effects=[V(1), {'op': 'repeatIfTargetDied'}], afterFinalAttack=[SUCK(1), BURROW(1)]),
 'Suppertime!': dict(judge=['Bravery', 'Tenacity'], effects=[{'op': 'dieIfAdjacentToTile', 'tile': 'paleburrow'}, VX(False)], afterAttack=[{'op': 'discardMobBlood'}]),
 'Death by a Thousand Bites': dict(extraDice={'perHits': 2}, effects=[{'op': 'suckPerHits', 'per': 2, 'n': 1}, V(2)], afterAttack=[G(3, [SUCK(1)], stat='heat'), BURROW(9)]),
}
SIG = dict(gates=[{'op': 'evasionDice', 'stat': 'blood', 'gte': 1, 'n': 1}], effects=[SUCK(1), V(1), G(2, [KD]), SUCK(1)], afterAttack=[{'op': 'burrowRoll'}])

# ---- BP ops (responses resolve against the Attacker; Blood gates read the Blood on this BP) ----
MBA = lambda n, upTo=True: {'op': 'moveAndBonusAttack', 'n': n, 'upTo': upTo}
BP = {
 'Pustulent Bloodworm': dict(wound=[G(2, [KD])], fail=[SUCK(1), BURROW(6)], critical=[{'op': 'bloodFromBPToAttacker', 'n': 1}]),
 'Pinkish Bloodworm': dict(whenRevealed=[{'op': 'closestKnightDiscardsBlood', 'n': 1}], wound=[KB(4)], fail=[SUCK(1)], critical=[{'op': 'attackerGainVigor', 'n': 3}]),
 'Albino Bloodworm': dict(whenRevealed=[{'op': 'closestKnightDiscardsBlood', 'n': 1}], wound=[KB(4)], fail=[BURROW(4)], critical=[MBA(3)]),
 'Desiccated Bloodworm': dict(whenRevealed=[{'op': 'stealBlood', 'from': 'closest', 'n': 1}], wound=[G(2, [ACT(1)])], fail=[SUCK(1)], critical=[MBA(3, False)]),
 'Tunnelling Bloodworm': dict(wound=[G(1, [ACT(1)])], fail=[KD, G(1, [KB(4)])], critical=[{'op': 'chooseBurrow'}], aura={'burrowRoll': True}),
 'Diseased Bloodworm': dict(whenRevealed=[{'op': 'bloodOrVigor'}], instinct=[SUCK(1), {'op': 'loseVigorFromBlood', 'perilCheck': True}], critical=[{'op': 'knightsGainBlood', 'who': 'one', 'upTo': 5}]),
 'Writhing Bloodworm': dict(wound=[{'op': 'closestWormBurrow', 'n': 5}], fail=[SUCK(1)], critical=[{'op': 'bonusAttack', 'who': 'self', 'optional': True}]),
 'Famished Bloodworm': dict(wound=[G(3, [{'op': 'discardMobBlood'}])], fail=[SUCK(1)], critical=[{'op': 'bonusAttack', 'who': 'self', 'optional': True}], aura={'suckBonus': 1}),
 'The Perfect Specimen': dict(whenRevealed=[{'op': 'stealBlood', 'from': 'each', 'n': 1}], wound=[{'op': 'knightsGainBlood', 'who': 'attacker', 'upTo': 2}], fail=[{'op': 'loseVigorPerBlood', 'n': 2, 'perilCheck': True}, {'op': 'discardHalfMobBlood'}], critical=[MBA(5)]),
 'Bursting Bloodworm': dict(wound=[SUCK(2), {'op': 'bloodToAdjacentBP', 'n': 'all'}], fail=[SUCK(2), BURROW(1)], critical=[{'op': 'knightsGainBlood', 'who': 'each', 'upTo': 5}], aura={'disableBloodbath': True}),
 'Siamese Bloodworm': dict(whenRevealed=[{'op': 'eachKnightDiscardsBlood', 'n': 1}], wound=[G(2, [KD]), KB(4)], fail=[SUCK(2), G(3, [ACT(1)])], critical=[MBA(3, False)]),
 'Bloated Broodmother': dict(wound=[ACT(1), G(1, [ACT(1)])], fail=[SUCK(2), {'op': 'bloodToAdjacentBP', 'n': 1}], critical=[{'op': 'disableTrait', 'id': 'It Sucks!'}], aura={'suckBonus': 2}),
}
OVER = {'Power 1': [{'op': 'power', 'n': 1}], 'Power 1 and Break 1': [{'op': 'power', 'n': 1}, {'op': 'poolToken', 'token': 'break', 'n': 1}]}
TYPE = {'ATTACK': 'attack', 'SEQUENTIAL ATTACK': 'sequential', 'ZONE ATTACK': 'zone', 'JUDGEMENT': 'judgement', 'SIGNATURE': 'attack'}

def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec)
    ops = {'targeting': c['targeting'], 'move': bool(c.get('move')), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'),
           'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    ops.update(spec)
    if 'react' not in ops: ops['reactWindows'] = c.get('reactWindows', [])
    c['type'] = TYPE.get(c['type'], c['type'].lower())
    if c['name'] == 'Paint the Swamp Red':  # printed type ZONE ATTACK, tag MOVE & ATTACK, no diagram → resolved as a single-target attack
        c['type'] = 'attack'; c.setdefault('notes', []).append('ZONE ATTACK로 인쇄됐지만 Zone 도식이 없고 태그가 MOVE & ATTACK → 단일 대상 공격으로 처리 [확인 필요]')
    if c['evasionDice'] == 'X': c['evasionDice'] = 0
    c['ops'] = ops; return c

def bp(c, spec):
    c = copy.deepcopy(c); spec = dict(spec)
    oc = c['overcome']
    ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': OVER[oc['effect']]} if oc else None,
           'wound': spec.get('wound'), 'fail': spec.get('fail'), 'instinct': spec.get('instinct'), 'critical': spec.get('critical')}
    for k in ('whenRevealed', 'aura'):
        if k in spec: ops[k] = spec[k]
    c['ops'] = ops; return c

missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]
assert not missing, missing
sig = ai(raw['signature'], SIG)
routine = {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'eachKnightDiscardsBlood', 'n': 2}]}

TR = {'Bloodrush': 'bloodrush', 'It Sucks!': 'it-sucks', 'Bloodbath': 'bloodbath', 'Subterranean Menace': 'subterranean-menace', 'Red Soil': 'red-soil', 'Scab Armor': 'scab-armor', 'Bloodline': 'bloodline'}
levels = {}
for l, v in S['levels'].items():
    levels[l] = {k: v[k] for k in ('toHit', 'wounds', 'exhibitionWounds', 'activations', 'activationsText', 'traitsAdd')}
    b = v['bonuses']; levels[l]['bonuses'] = {'escalations': b.get('escalations', 0), 'at': b.get('at', 0), 'vigorLoss': b.get('vigorLoss', 0)}

d = {
 'id': 'paleblood-worms', 'name': 'Paleblood Worms', 'kind': 'mob', 'code': S.get('code'), 'traitsLine': S.get('traitsLine'),
 '_source': 'Monster Sheet (2 pages), AI/BP/Routine card sheet, Signature card — owner scans 2026-11-15 (readings owner-confirmed); Clash Setup: Principality of Stone Codex p.44–45 (Paleblood Worms Clash)',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the single cell directly behind (R on the sheet diagram)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Immediate Spawn', 'rule': 'Rulebook p.62 + Subterranean Menace: when a Paleblood Worm dies, after the current action a new Worm Spawns outside the Clash Board — a random BP one level higher than the wounded BP on the leftmost empty Mob-track space. It is placed on the Paleburrow closest to the Priority Target when it is about to activate. If the Escalation decks have no such card, Bloodbath places 1 Blood on every card on the Mob track instead.'}],
 'levels': levels, 'traits': [{'id': TR[t['name']], **t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c, BP[c['name']]) for c in raw['bp']], 'signature': sig, 'routine': routine},
 'clashSetup': {
  '_source': 'Principality of Stone Codex p.44–45 (Paleblood Worms Clash)',
  'requiredTiles': {'column': 5, 'ruined wall L': 2, 'paleburrow': 10, 'bloodgeyser': 1},
  'steps': ['Standard Preparations (Rulebook p.44)',
            'Monster Positioning: Put numbered base rings on all Paleblood Worm miniatures. Randomly place Paleblood Worm miniatures numbered 1–4 on the spaces designated on the diagram. Note the facing direction indicated by the arrows. Then, place 4 BP 1 cards face down in a random order on spaces 1–4 on the Mob track.',
            'Additional Setup: Place Blood tokens near the Monster Sheet. Follow additional Clash Setup instructions introduced by Traits (if any).',
            'This Clash uses numbered Terrain tiles — the numbered Generic tokens on these tiles follow the diagram.'],
  'mobStart': [{'cell': 'H7', 'facing': 'down'}, {'cell': 'F7', 'facing': 'left'}, {'cell': 'E8', 'facing': 'right'}, {'cell': 'C7', 'facing': 'up'}],
  'mobTrack': {'1': 4}, 'knightStart': ['G6', 'F9', 'E6', 'D9'],
  'terrain': [
   {'tile': 'column', 'cells': ['C3', 'F4', 'B5', 'G9', 'H12']},
   {'tile': 'ruined wall', 'cells': ['J3', 'I3', 'H3', 'H2'], 'shape': 'L'},
   {'tile': 'ruined wall', 'cells': ['F12', 'F13', 'F14', 'E12'], 'shape': 'L'},
   {'tile': 'paleburrow', 'cells': ['I2', 'C2', 'G4', 'D5', 'A5', 'H9', 'C10', 'H13', 'E14', 'B13'], 'numbers': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]},
   {'tile': 'bloodgeyser', 'cells': ['F7', 'F8', 'F9', 'E7', 'E8', 'E9', 'D7', 'D8', 'D9'], 'shape': '3x3'}],
  'unclear': ['Ruined Wall L 두 개의 정확한 칸(J3·I3·H3·H2 / F12·F13·F14·E12)은 코덱스 도식에서 읽음', 'Bloodgeyser 3×3 = D7–F9로 읽음 (기사 F9·D9와 Mob F7·E8이 그 위에서 시작)']},
 'rulings': [
  'Blood gates on AI cards read the Blood tokens on the attacking Mob; on BP cards, the Blood on that BP (It Sucks!)',
  'Bloodbath/Bloodline resolve when the wounded Worm actually dies — after its Wound/Fail/Instinct Responses (Knight Attack step 8) [해석]',
  'Activate X = "Draw AI for the next X Mobs on the Mob track" (rulebook glossary); counted to the right of the source Mob, looping, skipping the source [해석, 확인 필요]',
  'Red Soil: Activate 1 per 3 tokens counts from the leftmost Mob on the track [해석, 확인 필요]',
  'Burrow X onto a Paleburrow already holding another Worm → the closest free Paleburrow to it [해석, 확인 필요]',
  'Sequential Attack with a single Target: "Repeat this Attack (once)" re-resolves the card (Targeting included) without its After Final Attack [해석, 확인 필요]',
  'Judgement: roll the Evasion dice adding the chosen Virtue to each die; no Armor Roll, no Block; Heat re-rolls allowed [해석, 확인 필요]',
  'Suppertime!: "All Knights adjacent to Paleburrow tiles die" applies to each Judged Knight that is hit [해석, 확인 필요]',
  'Brutal Bloodletting: the SUCK 1 box beside MOVE & JUDGE resolves after movement, before the dice X are counted [해석, 확인 필요]',
  'Bloodgeyser: a Worm/Knight that starts or ends a movement on it triggers once per movement [해석, 확인 필요]',
  'Paleburrow lure: a free action on your turn while adjacent to a Paleburrow and a Worm is off the board',
  'Monsters may move through and stop on Chasm spaces (Chasm only restricts Knights, rulebook p.80)',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
