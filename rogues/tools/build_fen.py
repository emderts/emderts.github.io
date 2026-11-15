# Builds data/monsters/knight-of-the-fen.json (Boss Clash with Doppelknight Mobs) from the owner-confirmed transcription
# (docs/transcriptions/knight_of_the_fen_raw.json) + hand-written ops + Clash Setup (Sunken Kingdom Codex p.42–43).
# Usage: python3 tools/build_fen.py data/monsters/knight-of-the-fen.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/knight_of_the_fen_raw.json')); S = raw['sheet']
def bzone(rows):
    blk = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch in '^>v<']; f = rows[blk[0][1]][blk[0][0]]; xs = [x for x, _ in blk]; ys = [y for _, y in blk]
    def rel(x, y):
        if f == '>': return (x - max(xs), y - min(ys))
        if f == '<': return (min(xs) - x, max(ys) - y)
        if f == '^': return (min(ys) - y, x - min(xs))
        return (y - max(ys), max(xs) - x)
    return {'red': [rel(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == 'R'], 'yellow': [], 'step': None, 'block': True}
V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
TBL = lambda *ns, **kw: {'op': 'vigorByHitsTable', 'table': list(ns), 'perilCheck': True, **kw}
HITS = lambda gte, then, lt=None: {'op': 'ifHits', 'gte': gte, 'lt': lt, 'then': then}
COND = lambda i: {'op': 'condition', 'id': i}; SL = COND('Slimed'); DR = COND('Drowning'); KD = {'op': 'knockdown'}; ENG = {'op': 'fenEngulf'}; DWELL = {'op': 'fenDwell'}
HD = lambda g=3: {'op': 'evasionDice', 'stat': 'heat', 'gte': g, 'n': 1}; D11 = {'op': 'difficultyInstead', 'stat': 'heat', 'gte': 3, 'n': 11}
PSN = lambda n, perHit=False: {'op': 'fenPoison', 'n': n, 'perHit': perHit}
SLDR = [HITS(1, [SL], lt=2), HITS(2, [DR])]
def DG(target, effects, rng=None, **kw): return {'target': target, 'effects': effects, 'range': rng, **kw}
SW = lambda n: {'op': 'fenSwarm', 'n': n}; HEAT = {'op': 'fenHeatPerHit', 'n': 1}
AI = {
 'Encroaching Slime': dict(gates=[D11], effects=[V(1), PSN(1, True), HITS(3, [ENG])], dg=DG('closest', [V(1)])),
 'Uncertain Footing': dict(gates=[HD()], effects=SLDR, dg=DG('furthest', [HEAT])),
 'Shortsword Jab': dict(gates=[HD(4)], effects=[TBL(3, 5, 5, perilFrom=3), HITS(3, [KD])], dg=DG('closest', [V(1), SW(2)])),
 'Mud in Your Eye': dict(range=6, gates=[{'op': 'ignoreReact', 'stat': 'heat', 'gte': 3}], effects=[V(1), HITS(2, [SL]), DWELL], critEvadeFail=[SL], dg=DG('closest', [V(1)], 4)),
 'Retaliatory Thrust': dict(range=2, moveRange=True, effects=[TBL(5), DWELL], dg=DG('furthest', [TBL(3)])),
 'Slimy Stab': dict(gates=[HD(2)], effects=[V(2), HITS(3, [SL])], dg=DG('closest', [V(1)])),
 'Stifling Sludge': dict(gates=[HD()], effects=[V(1, False), *SLDR], dg=DG('furthest', [V(1), HEAT])),
 'Tornado of Blades': dict(extraDice={'ifHit': 2}, gates=[{'op': 'noop', 'stat': 'heat', 'gte': 3, 'alsoOps': [SL]}], effects=[TBL(3, 5, 7, 7, 7, perilFrom=5), HITS(3, [KD], lt=5), HITS(5, [ENG])], dg=DG('other', None, repeatMain=True)),
 'Tandem Strike': dict(effects=[V(1)], dg=DG('last', [V(1), SW(1)])),
 'Surging Slime': dict(extraDice={'ifHit': 1}, gates=[D11], effects=[V(2, False), HITS(2, [SL]), DWELL], dg=DG('furthest', [V(1)])),
 'Blade Barrage': dict(extraDice={'ifHit': 2}, effects=[V(1)], dg=DG('furthest', [V(1), SW(2)])),
 'From Every Angle': dict(extraDice={'ifHit': 1}, gates=[HD()], effects=[V(2, False), HITS(2, [SL])], dg=DG('closest', [V(1), SW(2)])),
 'Drowning Sorrows': dict(gates=[HD(5)], effects=[V(2, False), HITS(1, [SL], lt=2), HITS(2, [DR], lt=3), HITS(3, [{'op': 'die'}])], dg=DG('closestSwamp', [V(2), HEAT, SW(2)])),
 'The Thousand Arms': dict(extraDice={'perHits': 1}, effects=[V(3, False), HITS(3, [COND('Fear')])], dg=DG('closest', [V(2), SL])),
 'All as One': dict(effects=[V(3)], dg=DG('last', [V(2), SW(2)])),
 'One with the Slime': dict(gates=[D11], effects=[V(2), PSN(2), ENG, DWELL], dg=DG('furthestFront', [V(2)])),
 'Final Cut': dict(pathAttack=True, thenZone=2, extraDice={'ifHit': 2}, effects=[TBL(5, 7, 7, perilFrom=3), HITS(3, [KD])], dg=DG('furthest', [V(2)])),
 'Forest of the Fallen': dict(extraDice={'ifHit': 2}, effects=[V(2, False), HITS(2, [SL])], dg=DG('furthestSight', [V(2), SW(2)])),
}
SIG = dict(diceFromDopps=True, effects=[V(2)], dg=DG('furthest', [V(1)]))
POW = lambda n=1: {'op': 'power', 'n': n}; SUN = {'op': 'fenSunder', 'n': 1}; BA = {'op': 'bonusAttack', 'who': 'self', 'optional': True}; BAO = {'op': 'bonusAttack', 'who': 'otherKnight', 'optional': True}
ORARM = lambda first, n: [{'op': 'fenOrArmor', 'first': first, 'armor': n}]
EXP = COND('Exposed'); SPAWN = {'op': 'fenSpawn'}; AIA = {'op': 'fenPerformAI'}; KB = lambda n: {'op': 'knockback', 'n': n}
MV3 = {'op': 'fenKnightMove', 'n': 3}; RST = {'op': 'fenResetHeat'}; DISC = lambda opt: {'op': 'fenDiscardConditions', 'optional': opt}
BP = {
 'Crusty Helm': dict(over=[SUN], wound=[{'op': 'fenSwampUnder'}], fail=[EXP], critical=[BA]),
 'Incorporated Carcass': dict(over=[POW()], wound=[SL], fail=[ENG], critical=[COND('Courage'), BA]),
 'Sludge-Bloated Rope': dict(over=[POW()], wound=[SL], fail=[KD], critical=[{'op': 'fenUnexhaustOrHeat', 'n': 3}]),
 'Rusty Kneepad': dict(over=ORARM('power', 1), wound=[{'op': 'pushback', 'n': 3}], fail=[EXP], critical=[RST]),
 'Corroded Pauldron': dict(over=ORARM('power', 1), wound=[{'op': 'fenMoveToFurthest'}], fail=[EXP], critical=[BAO]),
 'Slime Hand': dict(over=[POW()], wound=[SPAWN], fail=[KB(4)], critical=[MV3, BA]),
 'Cluster of Rotting Eyes': dict(over=[POW()], wound=[DWELL], fail=[AIA], critical=[{'op': 'clashFlag', 'flag': 'fenRearAT'}]),
 'Decaying Brain Collection': dict(over=[POW()], instinct=[SPAWN], critical=[{'op': 'clashFlag', 'flag': 'fenIgnoreSignature'}]),
 'Discarded Arsenal': dict(over=ORARM('sunder', 1), instinct=[SPAWN], critical=[BAO]),
 'Muck Gambeson': dict(over=[SUN], instinct=[SPAWN], critical=[DISC(False)]),
 'Ooze-Choked Armor': dict(over=ORARM('power', 1), wound=[SL], fail=[KB(5)], critical=[DISC(True)]),
 'Shambling Graveyard': dict(over=[POW()], wound=[SL, PSN(1)], fail=[ENG], critical=[RST, BA]),
 'Doppelknight Buds': dict(over=ORARM('power', 2), instinct=[SPAWN], critical=[{'op': 'disableTrait', 'id': 'Doppelknight'}]),
 'Primeval Slime': dict(over=[POW()], instinct=[DR], critical=[MV3, BA]),
 'Slimesoul': dict(over=ORARM('sunder', 2), instinct=[SPAWN, AIA], critical=[{'op': 'slayMonster'}]),
 'Gunk Maw': dict(over=[SUN], wound=[{'op': 'choke', 'n': 3}], fail=[ENG], critical=[{'op': 'fenEscape'}]),
 'Swallowed Siege Engine': dict(over=ORARM('power', 2), wound=[SL], fail=[ENG], critical=[RST, BA]),
 'Trinket of a Lost Lightfoot': dict(over=[POW()], instinct=[DWELL], critical=[{'op': 'disableTrait', 'id': 'Doppelganger'}]),
}
TYPE = {'ATTACK': 'attack', 'RANGE ATTACK': 'attack', 'ZONE ATTACK': 'zone', 'SEQUENTIAL ATTACK': 'attack', 'SEQUENTIAL ZONE ATTACK': 'attack', 'SIGNATURE': 'attack'}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': c['targeting'], 'move': 'MOVE' in tag, 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': None, 'afterFinalAttack': None}
    ops.update(spec)
    if c.get('zoneDiagram'): ops['zoneDiagram'] = bzone(c['zoneDiagram']['rows'])
    c['typePrinted'] = c['type']; c['type'] = TYPE[c['type']]; c['evasionDifficulty'] = int(str(c['evasionDifficulty']).rstrip('+'))
    if not isinstance(c['evasionDice'], int): c['evasionDice'] = 0
    c['ops'] = ops; return c
def bp(c, spec):
    c = copy.deepcopy(c); oc = c['overcome']; ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': spec['over'], 'tag': c.get('overcomeTag') or 'OVERCOME'}}
    for k in ('wound', 'fail', 'instinct', 'critical'):
        if k in spec: ops[k] = spec[k]
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': v['toHit'], 'wounds': v['wounds'], 'exhibitionWounds': v.get('exhibitionWounds'), 'activations': ['AI'], 'traitsAdd': [t for t in v['traitsAdd'] if not t.startswith('Kingdom Trait')], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
X = {x['name']: x for x in raw['extra']}
d = {
 'id': 'knight-of-the-fen', 'name': 'Knight of the Fen', 'kind': 'boss', 'code': S.get('code'), 'traitsLine': S.get('traitsLine'),
 '_source': 'Monster Sheet, AI/BP/Trait cards, Signature, Routine — owner scans (readings owner-confirmed 2026-11-15); Clash Setup: Sunken Kingdom Codex p.42–43',
 'footprint': {'size': 2, 'shape': '2x2', 'rear': 'the two cells behind (R on the sheet diagram)', 'blindspots': 'none', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Ignore Difficult Terrain'}],
 'levels': levels,
 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': X[n]['name'], 'level': 1, 'text': f"[Kingdom Trait — {X[n]['kingdom']}] " + X[n]['text'], 'implemented': True} for n in ('Quick Summons', 'Recycled Armor')] + [{'name': 'Engulfed', 'level': 1, 'text': X['Engulfed']['text'] + '\n' + X['Engulfed']['bottomBox'], 'implemented': True}],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c, BP[c['name']]) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'fenRoutine'}]}},
 'fen': {'tokens': 6, 'kingdomTrait': {'sunken': 'Quick Summons', 'principality': 'Recycled Armor'}},
 'clashSetup': {
  '_source': 'Sunken Kingdom Codex p.42–43 (Knight of the Fen Clash)',
  'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Knight of the Fen miniature on the space designated on the diagram. Note the facing direction indicated by the arrow.', 'Additional Setup: Place the Engulfed Trait card and 6 Doppleknight tokens near the Monster Sheet. Depending on the Kingdom, take the Recycled Armor (Principality of Stone) or Quick Summons (Sunken Kingdom) Trait card.'],
  'requiredTiles': ['6x Swamp 1x2', '3x Rubble L', '2x Rubble 2x2'],
  'monsterCells': ['F11', 'F12', 'E11', 'E12'], 'facing': 'W', 'knightStart': ['H7', 'G8', 'D8', 'C7'],
  'terrain': [
   {'tile': 'swamp', 'cells': ['I4', 'H4']}, {'tile': 'swamp', 'cells': ['H8', 'H9']}, {'tile': 'swamp', 'cells': ['I12', 'H12']}, {'tile': 'swamp', 'cells': ['E4', 'D4']}, {'tile': 'swamp', 'cells': ['C8', 'B8']}, {'tile': 'swamp', 'cells': ['C11', 'C12']},
   {'tile': 'rubble', 'cells': ['J1', 'J2', 'I1', 'I2'], 'shape': '2x2'}, {'tile': 'rubble', 'cells': ['B1', 'B2', 'A1', 'A2'], 'shape': '2x2'},
   {'tile': 'rubble', 'cells': ['J12', 'J13', 'J14', 'I14'], 'shape': 'L'}, {'tile': 'rubble', 'cells': ['F3', 'F4', 'F5', 'E3'], 'shape': 'L'}, {'tile': 'rubble', 'cells': ['B11', 'B12', 'B13', 'C13'], 'shape': 'L'}],
  'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 (소유자 확인 2026-11-15)']},
 'rulings': [
  'Doppelknights: Mobs without Activation tokens on the board with a face-down BP taken from the top of the BP deck; attacked like a Mob (To Hit = Knight of the Fen); wounding one puts its BP on the Wound Stack (counts toward the kill, Escalation as usual), removes the token and places a 1x2 Swamp on its space. Killing a Doppelknight also adds We Are Many tokens (owner reference sheet KotF v1.1, 2026-11-15)',
  'Doppelknight Spawn location: Start of Clash / Routine → the Swamp tile closest to the Knight of the Fen; We Are Many → closest to the attacking Knight (reference sheet); BP-response Spawns ("the closest Swamp") → also closest to the attacking Knight [해석, 확인 필요]. Odd Spawn = spawns at trait-specified times (rulebook box, owner scan 2026-11-15)',
  'Reference sheet KotF v1.1 (2026-11-15): Engulfed End-of-turn Poison 2 only while still on the Engulfed card; the Displace after wounding while Engulfed is involuntary (no Slimed/Drowning trigger) and kills if no adjacent space is free; Ooze Trap Level 2–3 -2 Vigor also applies when Engulfed by the Monster ending its move on the Knight',
  'Doppelganger: after every AI / Signature card the Knight of the Fen performs (Monster Round, We Are Many, "Perform AI" responses), each Doppelknight in number order performs the card\'s Doppelganger effect with the same Evasion dice / difficulty (소유자 확인 2026-11-15)',
  'Tornado of Blades Doppelganger "Repeat this Attack against another Target (once)": each Doppelknight performs the card\'s own attack once against a Knight other than the original Target (소유자 확인 2026-11-15)',
  'Routine Dopplergenesis "perform AI for each Doppelknight": one AI card is drawn per Doppelknight and that Doppelknight performs its Doppelganger effect (소유자 확인 2026-11-15)',
  'Armor tokens "on the Sheet" (Living Wasteheap, Absorb the Fallen): each gives the Knight of the Fen +1 AT; "discard X Armor tokens" removes them (소유자 확인 2026-11-15)',
  'Engulfed: the Knight leaves the board (cannot be targeted, moved or adjacent-checked), may only attack the Knight of the Fen (melee) or Sabotage (Sabotage once per turn — it is one action); Sabotage = d10 + Fortitude or Might vs 10+; freed (Displace next to the Monster) on dealing a Wound; End of turn: Poison 2 (소유자 확인 2026-11-15)',
  'Ooze Trap: moving through a Knight gives Slimed instead of Crash (Level 2–3: also -2 Vigor); a Knight under the Monster when it stops becomes Engulfed. Level 4 (Inescapable Slime): any Knight it moves through becomes Engulfed',
  'Dwell: the Monster moves (normal movement) until its base covers the closest unoccupied Swamp space (소유자 확인 2026-11-15)',
  'Concentrated Strength (Level 3+): Total Power ≥ summed AT of both BPs wounds both ("exceeds" read as the normal ≥ rule) (소유자 확인 2026-11-15)',
  '"For each hit lose -1 Vigor and Poison 1": Poison 1 per hit (소유자 확인 2026-11-15); Heat-gate "GAIN THE SLIMED CONDITION CARD" (Tornado of Blades) applies when the attack hits (소유자 확인 2026-11-15)',
  'Range Attack N: the Target must be within N spaces; "MOVE & RANGE ATTACK 2" moves until within 2 (소유자 확인 2026-11-15)',
  'Living Wasteheap Crit Miss = natural 1 on the Crit die of the Attack Roll; the Knight chooses the Gear card (소유자 확인 2026-11-15)',
  'Lose condition: no cards in the BP deck and discard pile (checked whenever a BP card is drawn or wounded)',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
