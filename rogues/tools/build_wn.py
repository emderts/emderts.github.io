# Builds data/monsters/winged-nightmare.json (single-Mob Clash) from the owner-confirmed transcription
# (docs/transcriptions/winged_nightmare_raw.json) + hand-written ops + Clash Setup (Sunken Kingdom Codex p.38).
# Usage: python3 tools/build_wn.py data/monsters/winged-nightmare.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/winged_nightmare_raw.json')); S = raw['sheet']
V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
TBL = lambda *ns, **kw: {'op': 'vigorByHitsTable', 'table': list(ns), 'perilCheck': True, **kw}
HITS = lambda gte, then, lt=None: {'op': 'ifHits', 'gte': gte, 'lt': lt, 'then': then}
COND = lambda i: {'op': 'condition', 'id': i}
KD = {'op': 'knockdown'}; KB = lambda n: {'op': 'knockback', 'n': n}; PB = lambda n: {'op': 'pushback', 'n': n}; CH3 = {'op': 'choke', 'n': 3}
FLANK = {'op': 'wnFlank'}; FLEE = lambda n: {'op': 'wnFlee', 'n': n}; COL = {'op': 'wnToColumn'}; CHADJ = {'op': 'wnToChasmAdjacent'}; DISC = {'op': 'wnDiscardTopAI'}; REACT = {'op': 'wnReact'}
END = lambda n: [{'op': 'wnEndure', 'n': n}]
HD = {'op': 'evasionDice', 'stat': 'heat', 'gte': 3, 'n': 1}
LV = lambda n: {'op': 'loseVigor', 'n': n}
AI = {
 'Tail Grab': dict(gates=[HD], effects=[TBL(2, 5, 8, perilFrom=3), HITS(2, [CH3])], afterAttack=[KB(3)], aiResponse=[KD, DISC]),
 'Alluring Lullaby': dict(flank=True, judge=['Insight', 'Sagacity'], effects=[V(2), COND('Distracted'), FLEE(2), {'op': 'wnPull', 'n': 1}], aiResponse=[COL, DISC]),
 'Bloodseeker': dict(gates=[HD], effects=[V(2)], afterAttack=[COL], aiResponse=[FLEE(3)]),
 'Slithering Shove': dict(effects=[V(2), {'op': 'wnPushbackHits'}], afterAttack=[FLEE(2)], aiResponse=[FLANK, LV(1)]),
 'Forceful Swoop': dict(effects=[V(3), FLANK, PB(3)], aiResponse=[FLANK, KB(1)]),
 'Constricting Coils': dict(pre=END(1), effects=[TBL(2, 5, 8, perilFrom=3, dieAtZero=True), HITS(2, [CH3])], afterAttack=[FLANK, REACT, KB(3)], aiResponse=[FLEE(3)]),
 'Misleading Melody': dict(pre=END(1), judge=['Bravery', 'Sagacity'], gates=[HD], effects=[COND('Fear'), V(2), {'op': 'wnTowardNightmare', 'n': 1}], afterFinalAttack=[FLEE(3)], aiResponse=[LV(2), REACT, FLANK]),
 'Go for the Eyes': dict(pre=END(1), flank=True, gates=[{'op': 'vigorPerHitInstead', 'stat': 'heat', 'gte': 3, 'n': 3}], effects=[V(2)], afterAttack=[KD, COL], aiResponse=[FLANK, FLEE(2)]),
 'Drag to the Abyss': dict(pre=END(1), gates=[HD], effects=[V(2), {'op': 'wnDrag'}], afterAttack=[FLEE(3)], aiResponse=[COL, DISC]),
 'Dive Slam': dict(pre=END(1), effects=[V(2), FLANK, PB(3), KD], aiResponse=[CHADJ, DISC]),
 'Death Grip': dict(pre=END(2), gates=[HD], effects=[HITS(3, [{'op': 'die'}]), HITS(1, [TBL(3, 6)], lt=3), HITS(2, [CH3], lt=3)], afterAttack=[FLANK, KB(3)], aiResponse=[CHADJ, DISC]),
 'Aria of Doom': dict(pre=END(2), judge=['Fortitude', 'Sagacity'], beforeAttack=[{'op': 'wnToChasm'}], gates=[HD], effects=[COND('Distracted'), V(3), {'op': 'wnTowardChasm', 'n': 2}], afterFinalAttack=[FLEE(4)], aiResponse=[FLANK, REACT, KB(3)]),
 'Evisceration': dict(pre=END(2), diceFromVigor=True, effects=[V(1)], afterAttack=[FLANK, {'op': 'wnVigor0Knockback', 'n': 3}, COL], aiResponse=[FLEE(3)]),
 'Cast to the Depths': dict(pre=END(2), gates=[HD], effects=[V(2), HITS(3, [KD]), {'op': 'wnDrag', 'plus': 1}], afterAttack=[FLEE(4)], aiResponse=[COL, DISC]),
 'Rending Swoop': dict(pre=END(2), effects=[V(4), FLANK, {'op': 'wnPushToChasm', 'n': 3, 'front': True}], afterAttack=[{'op': 'repeatCard'}], aiResponse=[{'op': 'wnIfRear', 'then': [DISC], 'else': [REACT, KB(2), FLANK]}]),
}
SIG = dict(flank=True, gates=[{'op': 'vigorPerHitInstead', 'stat': 'heat', 'gte': 4, 'n': 2}], effects=[V(1), {'op': 'wnPushbackHits', 'toChasm': True}], afterAttack=[COL])
POD = {'op': 'wnPushOrDrag', 'n': 2}; PODX = {'op': 'wnPushOrDrag', 'x': 'wounds'}; AIR = {'op': 'wnAIResponse'}; BA = {'op': 'bonusAttack', 'who': 'self', 'optional': True}
BP = {
 'Wide Wings': dict(over=[POD], wound=[{'op': 'wnFlip'}, {'op': 'signatureAgainstAttacker'}], fail=[AIR], critical=[{'op': 'wnFlip'}, BA]),
 'Slithering Tails': dict(over=[POD], instinct=[AIR], wound=[PODX], critical=[PODX]),
 'Bloody Defiance': dict(over=[POD], wound=[AIR, DISC, PODX], fail=[{'op': 'signatureAgainstAttacker'}], critical=[{'op': 'wnDie'}]),
}
TYPE = {'ATTACK': 'attack', 'SEQUENTIAL ATTACK': 'attack', 'SIGNATURE': 'attack', 'JUDGEMENT': 'judgement', 'SIMULTANEOUS JUDGEMENT': 'judgement'}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': c['targeting'], 'move': tag.startswith('MOVE &'), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    ops.update(spec); c['typePrinted'] = c['type']; c['type'] = TYPE[c['type']]; c['evasionDifficulty'] = int(str(c['evasionDifficulty']).rstrip('+'))
    if c['evasionDice'] == 'X': c['evasionDice'] = 0
    c['ops'] = ops; return c
def bp(c, spec):
    c = copy.deepcopy(c); oc = c['overcome']; ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': spec['over'], 'tag': c.get('overcomeTag') or 'OVERCOME'}}
    for k in ('wound', 'fail', 'instinct', 'critical'):
        if k in spec: ops[k] = spec[k]
    c['level'] = 'X'; c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
bps = {c['name']: bp(c, BP[c['name']]) for c in raw['bp']}
levels = {l: {'toHit': v['toHit'], 'wounds': v['wounds'], 'activations': ['AI'], 'traitsAdd': v['traitsAdd'], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
RUT_NOTE = 'Rut: 몬스터가 지나가면 뒤집혀 Swamp가 됨. 공격 중 한 번이라도 Rut 위에 있으면 그 공격 동안 사용 무기가 Cumbersome을 얻음'
d = {
 'id': 'winged-nightmare', 'name': 'Winged Nightmare', 'kind': 'mob', 'code': S.get('code'), 'traitsLine': S.get('traitsLine'),
 '_source': 'Monster Sheet, AI/BP/Trait cards, Signature, Routine — owner scans (readings owner-confirmed 2026-11-15); Clash Setup: Sunken Kingdom Codex p.38',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the single cell directly behind (R on the sheet diagram)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Superior Bypass', 'rule': 'Moves through Terrain and miniatures (lost while Slithering Tails is revealed).'}, {'name': 'Immediate Spawn'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': list(bps.values()), 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'wnShriek'}, FLEE(3)]}},
 'nightmare': {'wide': bps['Wide Wings'], 'tails': bps['Slithering Tails'], 'defiance': bps['Bloody Defiance']},
 'clashSetup': {
  '_source': 'Sunken Kingdom Codex p.38 (Winged Nightmare Clash — Sunken Kingdom diagram)',
  'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Winged Nightmare miniature on the space designated on the diagram. Note the facing direction indicated by the arrow.', 'Additional Setup: Place the Wide Wings BP card on space 1 on the Mob track. Level 2+: Place the Bloody Defiance BP Trait card next to the Monster Sheet.'],
  'requiredTiles': ['15x Column', '4x Rubble L', '4x Rut 1x2', '1x Bottomless Well'],
  'monsterCells': ['F8'], 'facing': 'S', 'knightStart': ['E4', 'D5', 'C10', 'B9'],
  'terrain': [
   {'tile': 'bottomless well', 'cells': ['F7', 'F8', 'E7', 'E8']},
   *[{'tile': 'column', 'cells': [c]} for c in ['J9', 'I4', 'H1', 'H6', 'H10', 'F10', 'E2', 'E5', 'E13', 'C6', 'C9', 'C14', 'B3', 'B11', 'A4']],
   {'tile': 'rubble', 'cells': ['J6', 'J7', 'J8', 'I8'], 'shape': 'L'}, {'tile': 'rubble', 'cells': ['G2', 'G3', 'G4', 'F2'], 'shape': 'L'}, {'tile': 'rubble', 'cells': ['E11', 'E12', 'D12', 'C12'], 'shape': 'L'}, {'tile': 'rubble', 'cells': ['B7', 'A7', 'A8', 'A9'], 'shape': 'L'},
   {'tile': 'rut', 'cells': ['G7', 'G8']}, {'tile': 'rut', 'cells': ['D7', 'D8']}, {'tile': 'rut', 'cells': ['F6', 'E6']}, {'tile': 'rut', 'cells': ['F9', 'E9']}],
  'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 (소유자 확인 2026-11-15)', RUT_NOTE]},
 'rulings': [
  'Single-Mob Clash: one 1x1 Mob with the two-sided BP on Mob-track space 1; one AI Activation token (소유자 확인 2026-11-15)',
  'Endure X: temporary +X AT until the next Power Roll (소유자 확인 2026-11-15)',
  'Flank priority "straight line from a Chasm": spaces where Nightmare–Knight–Chasm are aligned (소유자 확인 2026-11-15)',
  'AI Response: on Fail (Wide Wings) / Instinct (Slithering Tails) / Wound (Bloody Defiance) resolve the AI Response of the top AI discard; Attacker on the Rear → only Flank / Flee are ignored (소유자 확인 2026-11-15)',
  'Column tiles: the Nightmare perches on the tile; Knights climb onto it (Marble Forest) and leave by normal movement (소유자 확인 2026-11-15)',
  'Drag X / Drag toward: rulebook keyword box (소유자 스캔 2026-11-15). Monster "Drag X toward the closest Chasm": the Nightmare moves toward and one space past the Chasm (max X), the Knight follows the path — entering the Chasm kills',
  'Flee X ending on a Knight: Crash, then the Knight is Displaced — kept as Crash + Displace (소유자 확인 2026-11-15)',
  'Knight Pushback X / Drag X against the Nightmare (Overpower, Slithering Tails, Bloody Defiance): chosen and resolved immediately; Pushback moves it X spaces directly away (stops at Obstacles / Knights / board edge); with Bloody Defiance out, entering a Chasm this way kills it (소유자 확인 2026-11-15)',
  'Bloody Defiance: the final Wound is placed, then the BP Trait card replaces the BP and ITS Wound (or Critical → dies) response resolves instead (소유자 확인 2026-11-15)',
  '"moves to the closest empty Column tile" while already on a Column: she stays where she is (소유자 확인 2026-11-15)',
  '"MOVE TO THE CLOSEST CHASM & JUDGE" (Aria of Doom): moves onto the closest Chasm space, the judged Knights are those in Zone 4 of her ORIGINAL position (targeting comes first); Misleading Melody / Aria movement is per hit (1 / 2 spaces per hit), Knights stop adjacent to the Chasm (voluntary movement cannot enter it) (소유자 확인 2026-11-15)',
  'Owner reference sheet (WN v1.2, 2026-11-15): Superior Bypass lets her end a MOVE on Obstacle terrain (perches on Columns); on the Tail side "move to the closest empty Column" = move ADJACENT to it; climbing a Column is once per round per Knight; Flee turns her to face the board edge; pushed / dragged through a Column destroys it; Bloody Defiance keeps Superior Bypass; Overpower resolves before responses',
  'Marble Forest: free action(라운드당 1회) 또는 Reflex 대신 인접한 Column 오르기; ' + RUT_NOTE,
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
