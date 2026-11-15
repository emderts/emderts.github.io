# Builds data/monsters/white-ape-troll.json (Boss Clash with Firstmen Guardian Mobs) from the owner-confirmed transcription
# (docs/transcriptions/white_ape_troll_raw.json) + hand-written ops + Clash Setup (Sunken Kingdom Codex p.50–51).
# Usage: python3 tools/build_wat.py data/monsters/white-ape-troll.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/white_ape_troll_raw.json'))
S = raw['sheet']

def bzone(rows):
    """2x2-boss diagram ('>' block) → offsets (fwd, right): fwd 1 = first row beyond the front edge, right 0 = the block's leftmost lane."""
    blk = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch in '^>v<']; f = rows[blk[0][1]][blk[0][0]]
    xs = [x for x, _ in blk]; ys = [y for _, y in blk]
    def rel(x, y):
        if f == '>': return (x - max(xs), y - min(ys))
        if f == '<': return (min(xs) - x, max(ys) - y)
        if f == '^': return (min(ys) - y, x - min(xs))
        return (y - max(ys), max(xs) - x)
    return {'red': [rel(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == 'R'], 'yellow': [], 'step': None, 'block': True}

V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
EXP = {'op': 'condition', 'id': 'Exposed'}; KD = {'op': 'knockdown'}
KB = lambda n: {'op': 'knockback', 'n': n}; KBS = lambda n: {'op': 'knockbackSide', 'n': n}; PB = lambda n: {'op': 'pushback', 'n': n}
HD = {'op': 'evasionDice', 'stat': 'heat', 'gte': 3, 'n': 1}; DIF8 = {'op': 'difficultyInstead', 'stat': 'heat', 'gte': 2, 'n': 8}
TBL = lambda *ns: {'op': 'vigorByHitsTable', 'table': list(ns), 'perilCheck': True}
GUARD5 = {'op': 'guardiansToTroll', 'n': 5}
SIGA = {'op': 'signatureAgainstAttacker'}
AI = {
 'Roaring Stomp': dict(zoneAroundSelf=1, prePushback=3, gates=[DIF8], effects=[V(1), KD]),
 'Ramming Charge': dict(pathAttack=True, gates=[HD], effects=[V(1)], afterAttack=[KBS(3)], afterFinalAttack=[PB(3), KBS(3)]),
 'Big Bonk': dict(jump=True, gates=[{'op': 'knockdownOnHit', 'stat': 'heat', 'gte': 3}], effects=[V(2), KB(4)]),
 'Wild Punch': dict(prePushback=3, gates=[HD], effects=[EXP, V(1), {'op': 'cooldown'}, KB(3)]),
 'Stone Toss': dict(treeClimb=True, range='unlimited', gates=[HD], effects=[EXP, V(1)]),
 'Fierce Swing': dict(effects=[TBL(1, 3), KB(4)]),
 'Ground Smash': dict(zoneAroundSelf=1, prePushback=3, gates=[DIF8], effects=[V(2), KD]),
 'Skull Crusher': dict(gates=[HD], effects=[EXP, V(2), {'op': 'choke', 'n': 3}, {'op': 'forcedVault'}, PB(3)]),
 'Monkey Flip': dict(jump=True, effects=[V(2), KD, KB(5)]),
 'Rampage Strike': dict(prePushback=3, gates=[HD], effects=[EXP, V(2), {'op': 'delay'}, KB(4)]),
 'Rock Hurl': dict(treeClimb=True, range='unlimited', gates=[HD], effects=[EXP, V(2), {'op': 'condition', 'id': 'Distracted'}]),
 'Savage Sweep': dict(effects=[TBL(1, 3, 5), KB(5)]),
 'Unstoppable Momentum': dict(pathAttack=True, gates=[HD], effects=[V(2), KD], afterAttack=[KBS(4)], afterFinalAttack=[PB(4), KBS(4)]),
 'Headhunter': dict(gates=[HD], effects=[{'op': 'vigorToZero', 'perilCheck': False}, {'op': 'judicium'}], afterAttack=[EXP, {'op': 'choke', 'n': 3}, {'op': 'forcedVault'}, PB(3)]),
 'Ape Out': dict(landOnTop=True, zoneAroundSelf=2, gates=[{'op': 'ignoreReact', 'stat': 'heat', 'gte': 3}, DIF8], effects=[V(2), KD]),
 'Feral Blow': dict(prePushback=3, gates=[HD], effects=[EXP, V(2), {'op': 'discard'}, KB(5), KD]),
 'Boulder Lob': dict(treeClimb=True, range='unlimited', gates=[HD], effects=[EXP, V(2), {'op': 'condition', 'id': 'Panicked'}]),
 'Ferocious Slam': dict(effects=[EXP, TBL(3, 5, 7), KB(6)]),
}
SIG = dict(prePushback=3, gates=[HD], effects=[EXP, V(1), KBS(3)])
COORD = dict(effects=[EXP, {'op': 'strengthInNumbers'}, V(1)])
MBA2 = {'op': 'bonusAttack', 'who': 'self', 'optional': True, 'autoBreak': 2}
BP = {
 'Thick Skin': dict(over=[{'op': 'bonusAttack', 'who': 'self', 'optional': True}], fail=[EXP], wound=[], critical=[{'op': 'bonusAttack', 'who': 'self', 'optional': True}]),
 'Bulky Biceps': dict(wound=[PB(3)], fail=[SIGA], critical=[{'op': 'clashFlag', 'flag': 'trollNoRange'}]),
 'Saggy Gut': dict(wound=[{'op': 'cooldown'}], fail=[EXP], critical=[{'op': 'bonusAttack', 'who': 'self', 'optional': True}]),
 'Furry Shoulder': dict(wound=[EXP, GUARD5], fail=[KD], critical=[{'op': 'discardMindConditions'}, {'op': 'condition', 'id': 'Courage'}]),
 'Misshapen Toes': dict(wound=[{'op': 'bossMoveAway', 'n': 2}], fail=[EXP], critical=[{'op': 'leaveTokens', 'n': 2, 'tokens': ['opening', 'break']}]),
 'Clenched Fist': dict(wound=[SIGA], fail=[PB(3)], critical=[{'op': 'gainPassion', 'n': 1}, {'op': 'monsterModifier', 'stat': 'precision', 'n': -1}]),
 'Massive Thigh': dict(wound=[KB(4), GUARD5], fail=[EXP], critical=[{'op': 'bonusAttack', 'who': 'otherKnight', 'optional': True}]),
 'Muscular Chest': dict(wound=[PB(4)], fail=[EXP], critical=[MBA2]),
 'Monstrous Head': dict(wound=[EXP, GUARD5], fail=[SIGA], critical=[MBA2]),
 'Round Shield Trophy': dict(wound=[EXP, {'op': 'delay'}, GUARD5], fail=[KD], critical=[{'op': 'scavenge', 'n': 2}]),
 'Heavy Lower Jaw': dict(wound=[SIGA], fail=[{'op': 'loseVigor', 'n': 3}], critical=[{'op': 'allMayDiscardExposed'}]),
 'Strong Knee': dict(wound=[{'op': 'bossMoveAway', 'n': 3}], fail=[EXP, PB(4)], critical=[{'op': 'leaveTokens', 'n': 3, 'tokens': ['opening', 'break']}]),
 'Hairy Back': dict(wound=[SIGA], fail=[KB(5)], critical=[{'op': 'additionalSingleWound'}]),
 'Spine Column': dict(wound=[SIGA], fail=[PB(5), KD], critical=[{'op': 'disableTrait', 'id': 'Regeneration'}]),
 'Monkey Brain': dict(instinct=[EXP, SIGA], critical=[{'op': 'clashFlag', 'flag': 'ignoreGuardianToHit'}]),
 'Wild Heart': dict(wound=[EXP, {'op': 'discard'}, GUARD5], fail=[{'op': 'judicium'}], critical=[{'op': 'slayMonster'}]),
 'Milky Eyes': dict(wound=[SIGA], fail=[EXP], critical=[{'op': 'allDiscardExposed'}, {'op': 'clashFlag', 'flag': 'noExposed'}]),
 'Exposed Armpit': dict(instinct=[{'op': 'loseVigor', 'n': 3}, EXP, KB(6), GUARD5], critical=[{'op': 'clashFlag', 'flag': 'trollMinusDie'}]),
 'Covered Groin': dict(wound=[{'op': 'bossMoveAway', 'n': 4}], fail=[PB(5)], critical=[{'op': 'bonusAttack', 'who': 'self', 'optional': True, 'power': 1}]),
}
TYPE = {'ATTACK': 'attack', 'RANGE ATTACK': 'attack', 'ZONE ATTACK': 'zone', 'SEQUENTIAL ATTACK': 'attack', 'SIGNATURE': 'attack', 'TRAIT ATTACK': 'attack'}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': [t for t in c['targeting'] if 'Squire' not in t], 'move': 'MOVE' in tag, 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'),
           'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    ops.update(spec)
    if c.get('zoneDiagram') and c['zoneDiagram'].get('rows'): ops['zoneDiagram'] = bzone(c['zoneDiagram']['rows'])
    c['evasionDifficulty'] = int(str(c['evasionDifficulty']).rstrip('+')); c['type'] = TYPE.get(c['type'], c['type'].lower()); c['ops'] = ops; return c
def bp(c, spec):
    c = copy.deepcopy(c); oc = c['overcome']
    ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': spec.get('over') or [{'op': 'power', 'n': 1}], 'tag': c.get('overcomeTag') or 'OVERCOME'} if oc else None}
    for k in ('wound', 'fail', 'instinct', 'critical'):
        if k in spec: ops[k] = spec[k]
    if c['name'] == 'Thick Skin': c['level'] = 'X'; c['isThickSkin'] = True
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
coord = next(x for x in raw['extra'] if x['name'] == 'Coordinated Attack'); guard = next(x for x in raw['extra'] if x['name'] == 'Firstman Guardian')
TR = {'Regeneration': 'regeneration', 'Firstmen Guardians': 'firstmen-guardians', 'Reinforcements Have Arrived': 'reinforcements', 'Vantage Seeker': 'vantage-seeker', 'Strength in Numbers': 'strength-in-numbers', 'Avenger of the Tribe': 'avenger', 'We Are Legion': 'we-are-legion', 'Unnerving Presence': 'unnerving-presence'}
levels = {}
for l, v in S['levels'].items():
    b = v['bonuses']; levels[l] = {'toHit': int(str(v['toHit']).rstrip('+!')), 'toHitNote': v['toHit'], 'wounds': v['wounds'], 'exhibitionWounds': v.get('exhibitionWounds'), 'activations': ['AI'], 'traitsAdd': v['traitsAdd'], 'bonuses': {'escalations': b.get('escalations', 0), 'at': b.get('at', 0), 'vigorLoss': b.get('vigorLoss', 0)}}
d = {
 'id': 'white-ape-troll', 'name': 'White Ape Troll', 'kind': 'boss', 'code': S.get('code'), 'traitsLine': S.get('traitsLine'),
 '_source': 'Monster Sheet (2 pages), AI/BP/Trait cards, Thick Skin back, Signature — owner scans 2026-11-15 (readings owner-confirmed); Clash Setup: Sunken Kingdom Codex p.50–51',
 'footprint': {'size': 2, 'shape': '2x2', 'rear': 'the two cells behind (R / eye = Rear + Blindspot)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 4, 'rule': 'Rulebook p.51: a Knight on the space the Boss ends its movement on suffers Crash and Unavoidable Knockback 4.'}, {'name': 'Blindspot', 'rule': 'The two cells behind are Blindspots.'}],
 'unavoidableKnockback': 4,
 'levels': levels, 'traits': [{'id': TR[t['name']], **t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c, BP[c['name']]) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'moveToCenter'}, {'op': 'bossHeal', 'n': 1}, {'op': 'escalateX', 'n': 1}]}},
 'guardian': {'attack': ai(coord, COORD), 'bp': {**guard, 'ops': {'at': guard['at'], 'toHit': 7, 'overcome': None,
   'wound': [{'op': 'guardianDies'}, {'op': 'guardianBonusAttack'}], 'fail': [EXP], 'critical': [{'op': 'guardianDies'}, {'op': 'guardianBonusAttack', 'always': True}, {'op': 'leaveTokens', 'n': 2, 'tokens': ['opening', 'break']}]}},
   'limit': {'1': 4, '2': 4, '3': 5, '4': 6}},
 'clashSetup': {
  '_source': 'Sunken Kingdom Codex p.50–51 (White Ape Troll Clash)',
  'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the White Ape Troll on the designated space, then 2 Firstmen Warrior miniatures adjacent to it on the designated spaces (facing per arrows) — for this Clash they represent Firstmen Guardians.', 'Additional Setup: Place the Thick Skin BP card on top of the BP deck. Place the Coordinated Attack card and the Firstman Guardian BP card near the Monster Sheet (Firstmen Guardians: the Trait BP card goes on the leftmost Mob-track space).'],
  'monsterCells': ['F6', 'F7', 'E6', 'E7'], 'facing': 'E', 'guardians': [{'cell': 'G6', 'facing': 'E'}, {'cell': 'D6', 'facing': 'E'}], 'knightStart': ['G9', 'F9', 'E9', 'D9'],
  'terrain': [
   {'tile': 'great mangrove', 'cells': ['I6', 'I7', 'H6', 'H7']}, {'tile': 'great mangrove', 'cells': ['E12', 'E13', 'D12', 'D13']}, {'tile': 'great mangrove', 'cells': ['C3', 'C4', 'B3', 'B4']},
   {'tile': 'swamp', 'cells': ['J10', 'J11', 'I10', 'I11'], 'shape': '2x2'}, {'tile': 'swamp', 'cells': ['J12', 'J13']}, {'tile': 'swamp', 'cells': ['H1', 'G1']}, {'tile': 'swamp', 'cells': ['F1', 'F2']},
   {'tile': 'swamp', 'cells': ['C8', 'B8']}, {'tile': 'swamp', 'cells': ['B6', 'A6']}, {'tile': 'swamp', 'cells': ['A7', 'A8']}, {'tile': 'swamp', 'cells': ['C14', 'B14']}, {'tile': 'swamp', 'cells': ['B13', 'A13']}],
  'notes': ['지형 칸 위치는 코덱스 도식에서 읽음 (소유자 확인 2026-11-15)']},
 'rulings': [
  'Thick Skin wounded: set aside, no Wound/Escalation, gives 1 Reinforcements token; Strength in Numbers extra Vigor loss only on a hit; Avenger resolves the top AI card as an extra activation; Side Knockback direction is chosen by the player (소유자 확인 2026-11-15)',
  '"PUSHBACK 3 & ZONE ATTACK 1": the Troll turns to the Target (targeting line) and Pushes it back 3, then the Zone 1 Attack resolves against every Knight in Zone 1 (소유자 확인 2026-11-15)',
  'JUMP & ATTACK: the Troll is placed adjacent to the Target on the reachable position closest to it, without Crash or destroying Terrain (Jump, p.51) (소유자 확인 2026-11-15)',
  'LAND ON TOP (2x2): the Troll\'s base covers the Target\'s space (position closest to the Troll; ties → player); Knights under it are Displaced, the Target to a front space (소유자 확인 2026-11-15)',
  'MOVE & ATTACK ALL KNIGHTS IN PATH: every Knight the Troll moves through (Crash) plus the Target is attacked in turn; After Final Attack applies to the Target (소유자 확인 2026-11-15)',
  'Knockback X to the side: perpendicular to the Troll\'s facing; the Knight picks the side (소유자 확인 2026-11-15)',
  'Tree Climb (Vantage Seeker): moves onto the closest Great Mangrove tile (base fully on it) before the Range Attack; with "cannot perform Range Attacks" (Bulky Biceps) the card resolves without the attack (소유자 확인 2026-11-15)',
  'Thick Skin wounded: set next to the BP deck — no Wound, no Escalation; it returns to the top of the BP deck at the Start of the next Monster Round (Regeneration)',
  'Firstmen Guardians: Mobs sharing the single Firstman Guardian Trait BP (AT 4, To Hit 7+, Advanced Bypass); killing one adds no Wound and no Escalation; the Mob-track BP card passes to the next Guardian',
  'Guardian Bonus Attack "once per round, per Knight": tracked per Knight per round',
  'Owner reference sheet WAT v1.2 (2026-11-15): a failed attack on Thick Skin leaves it on top of the BP deck; the Guardian BP (AT 4) and Coordinated Attack gain the Troll\'s level AT / Vigor bonuses; End of Monster Round Guardians move in number order; attacking from the Blindspot gives +1 Precision',
  'Routine Lil\' Nap "Heal 1": remove the top card of the Wound Stack (소유자 확인 2026-11-15)',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
