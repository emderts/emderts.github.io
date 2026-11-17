# Builds data/monsters/first-men-lictor-hunters.json (Mob Clash) from docs/transcriptions/firstmen_lictor_hunters_raw.json (owner scans 2026-11-17)
# + hand-written ops + Clash Setup (expansion Codex p.58). Usage: python3 tools/build_lictor.py data/monsters/first-men-lictor-hunters.json
import json, sys, copy, re
raw = json.load(open('docs/transcriptions/firstmen_lictor_hunters_raw.json')); S = raw['sheet']; CS = raw['clashSetup']
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; ON = lambda *ops: [{'op': 'lhOnHit', 'then': list(ops)}]
T = lambda w: {'op': 'tactic', 'which': w, 'n': 0}; COND = lambda i: {'op': 'condition', 'id': i}; POIS = lambda n: {'op': 'lhPoison', 'n': n}; KD = {'op': 'knockdown'}
NEXT = lambda what: {'op': 'lhNext', 'do': what}; HITS = lambda gte, then, lt=None: {'op': 'lhIfHits', 'gte': gte, 'lt': lt, 'then': then}
HD = lambda g, n=1: {'op': 'evasionDice', 'stat': 'heat', 'gte': g, 'n': n}; HA = lambda g, ops: {'op': 'noop', 'stat': 'heat', 'gte': g, 'alsoOps': ops}
PH = lambda ops: {'op': 'lhPerHit', 'then': ops}; NOSIG = 'No Target: Perform Signature'
PT = 'Priority Target'; CS_ = 'Closest Knight in sight'; LONE = 'Closest Lone Knight'; TT = 'Tactics Target'
AI = {
 'Gruesome Display': dict(type='judgement', judge=['Bravery', 'Sagacity'], targeting=[LONE, PT, CS_], gates=[HA(4, [{'op': 'lhPassion', 'n': -1}])], effects=ON(HITS(1, [COND('Distracted')], lt=2), HITS(2, [COND('Panicked')]), V(1), T('A'))),
 'Dastardly Distraction': dict(targeting=['Highest [Vigor]', CS_], gates=[HA(3, [T('A')])], effects=ON(V(1)), afterAttack=[NEXT('decoy')]),
 'Jungle Trickery': dict(range=8, targeting=[PT, 'Closest Engaged Knight in range', 'Closest Knight in range'], effects=ON(COND('Distracted'), V(2), T('B')), afterAttack=[NEXT('dwell')]),
 'Surprise Attack': dict(targeting=['Highest [Vigor]', PT, CS_], gates=[HD(2), HA(3, [T('B')])], effects=ON(V(1), T('A')), afterAttack=[KD]),
 'Fungal Poison-Tipped Dart': dict(range=6, targeting=[TT, 'Furthest Knight in range', 'Furthest Knight in sight'], gates=[HD(3)], effects=ON(POIS(1), V(1), T('B'))),
 'Hit & Run': dict(targeting=[TT, PT, CS_], gates=[HA(2, [T('B')])], effects=ON(V(1), T('A'), POIS(1)), afterAttack=[NEXT('dwell')]),
 'Mud Pit Trap': dict(type='judgement', judge=['Fortitude', 'Insight'], targeting=[LONE, PT, TT], gates=[HD(3)], effects=ON({'op': 'lhFlatVigor', 'n': 2}, HITS(1, [COND('Slimed')], lt=2), HITS(2, [COND('Drowning')]), T('A'))),
 'Toxic Gas': dict(type='zone', targeting=['Zone 2', NOSIG], effects=ON(V(2), PH([POIS(1)])), afterAttack=[T('B')]),
 'Gorilla Charge': dict(targeting=[TT, 'Closest Knight in front', CS_], effects=ON(V(1), T('A')), afterAttack=[KD]),
 'Coup de Grâce': dict(targeting=['Lowest [Vigor] in front', 'Lowest [Vigor]'], gates=[HA(2, [T('A')]), HD(3)], effects=ON(V(2), POIS(1), T('B')), afterAttack=[NEXT('dwell')]),
 'Treefrog Poison-Tipped Dart': dict(range=6, targeting=['Closest Knight with the Poisoned Condition card in range', 'Closest Engaged Knight in range', TT, 'Furthest Knight in range'], gates=[HA(2, [T('A')])], effects=ON(V(1), PH([POIS(1)]), T('B'))),
 'Below the Belt': dict(targeting=[TT, 'Last Knight to wound', CS_], gates=[{'op': 'difficultyInstead', 'stat': 'heat', 'gte': 3, 'n': 11}], effects=ON(V(2), HITS(1, [COND('Distracted')], lt=2), HITS(2, [COND('Panicked')]), T('B')), afterAttack=[KD]),
 'Thorn Snare': dict(range=7, targeting=[TT, 'Closest Knight in range', CS_], gates=[HA(2, [T('A')])], effects=ON(KD, V(5), PH([{'op': 'tempSpeed', 'n': -1}]), T('B'))),
 'Savage Display': dict(type='judgement', judge=['Bravery', 'Sagacity'], targeting=[TT, LONE, PT, CS_], gates=[HA(2, [{'op': 'lhPassion', 'n': -1}])], effects=ON(V(3), HITS(1, [COND('Fear'), {'op': 'lhHeat', 'n': 2}], lt=2), HITS(2, [COND('Dread')]), T('A'))),
 'Brutal Backstab': dict(targeting=[LONE, PT, TT], gates=[HA(3, [T('A')])], extraDice={'ifHit': 2}, effects=ON(V(2), COND('Exposed'), T('B'))),
 'Toxic Smokescreen': dict(type='zone', targeting=['Zone 3', NOSIG], gates=[HD(3, 2)], effects=ON(V(2), PH([POIS(1)])), afterAttack=[T('A')], afterFinalAttack=[NEXT('dwell')]),
 'Death from Above': dict(targeting=['Clash Board'], effects=ON({'op': 'lhTable', 'table': [3, 5, 5]}, HITS(3, [COND('Slimed')]), T('B')), afterAttack=[KD]),
 'Fighting Dirty': dict(targeting=['Closest Engaged Knight', 'Last Knight to wound', 'Closest Knight'], effects=ON(V(2), KD, HITS(2, [COND('Slimed')], lt=3), HITS(3, [COND('Drowning')]), T('A'), NEXT('decoy'))),
}
SIG = dict(range='unlimited', targeting=[TT, PT], gates=[HA(3, [T('A')])], effects=ON(V(1), POIS(1), NEXT('decoy')))
TOK = {'op': 'lhToken'}; DECOY = {'op': 'lhDecoy', 'who': 'this'}; ELU = {'op': 'escalateLowestUnrevealed'}; PERIL = {'op': 'lhPeril'}; SIGN = {'op': 'lhSignature'}
BAO = {'op': 'bonusAttack', 'who': 'otherKnight', 'optional': True}; BA = {'op': 'bonusAttack', 'who': 'self', 'optional': True}
DRAW3 = [{'op': 'drawAIFor', 'which': 'closestOther', 'level': 3}, TOK]
def pool(effect):
    out = []
    for m in re.finditer(r'(Fire|Power|Opening|Break) (\d)', effect): out.append({'op': 'power', 'n': int(m.group(2))} if m.group(1) == 'Power' else {'op': 'poolToken', 'token': m.group(1).lower(), 'n': int(m.group(2))})
    return out
BP = {
 'Delator': dict(whenRevealed=[{'op': 'lookBP', 'side': 'rightmost'}], wound=[{'op': 'revealBP', 'side': 'rightmost'}], fail=[DECOY], critical=[BA]),
 'Evocati': dict(whenRevealed=[ELU], wound=[COND('Exposed')], fail=[TOK], critical=[BAO]),
 'Censor': dict(wound=[{'op': 'lhFlipDown', 'side': 'leftmost'}], fail=[PERIL], critical=[{'op': 'flipChosenBP'}], aura={'noFlipDown': True}),
 'Peregrini': dict(wound=[{'op': 'lhHeat', 'n': -1}], fail=[T('B'), PERIL], critical=[{'op': 'resetHeat'}]),
 'Auxiliari': dict(wound=[{'op': 'revealBP', 'side': 'leftmost'}], fail=[ELU, DECOY], critical=[{'op': 'lookBP'}]),
 'Frumentari': dict(whenRevealed=[{'op': 'lhFlipDown', 'side': 'rightmost'}], wound=[{'op': 'lhFlipDown', 'side': 'rightmost'}], fail=[ELU], critical=[{'op': 'flipChosenBP'}]),
 'Exploratore': dict(wound=[{'op': 'mobSignatureAgainst', 'which': 'furthest'}], fail=[TOK], critical=[{'op': 'moveAndBonusAttack', 'n': 3, 'upTo': True}], aura={'mobAttackVigor': 1}),
 'Speculatore': dict(wound=[{'op': 'escalateLowestAI'}], fail=[PERIL, T('A')], critical=[{'op': 'lhAttach', 'n': 'all'}], aura={'lhToHit': 1}),
 'Arcani': dict(whenRevealed=[{'op': 'revealBP', 'side': 'rightmost'}], wound=[NEXT('decoy')], fail=[SIGN], critical=[{'op': 'lhDiscardConditions'}]),
 'Umbra': dict(whenRevealed=[NEXT('decoy')], instinct=[SIGN, TOK], critical=[{'op': 'lhAttach', 'n': 2}]),
 'Invictus': dict(instinct=DRAW3, critical=[{'op': 'winClash'}], aura={'noMangrove': True}),
 'Invictus Ultimae': dict(whenRevealed=[{'op': 'lhAI3LastWound'}], wound=[{'op': 'winClash'}], fail=DRAW3, critical=[{'op': 'winClash'}]),
 'Stilicho': dict(instinct=[{'op': 'activate', 'n': 1}], critical=[{'op': 'lhSpeedBonus'}], aura={'stilicho': True}),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': spec.pop('targeting'), 'move': tag.startswith('MOVE'), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'attack'); ops.update(spec); c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; oc = c['overcome']; ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': pool(oc['effect'])} if oc else None}
    for k in ('wound', 'fail', 'instinct', 'critical', 'whenRevealed', 'aura'):
        if k in spec: ops[k] = spec[k]
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI, 1 S', 'traitsAdd': v['traitsAdd'], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
TA = {'Gain the Exposed Condition card.': [COND('Exposed')], 'Gain the Slimed Condition card.': [COND('Slimed')], 'Gain the Distracted Condition card.': [COND('Distracted')], 'Gain the Panicked Condition card.': [COND('Panicked')], 'Gain the Fear Condition card.': [COND('Fear')], 'Decoy.': [DECOY], 'Poison 1.': [POIS(1)], 'Poison 2.': [POIS(2)]}
def tactic(t):
    e = t['endOfMonsterRound']; to = 'engaged' if 'Engaged' in e else 'mangrove' if 'Mangrove' in e else 'swamp' if 'Swamp' in e else 'away'
    return {'name': t['name'], 'kind': t['kind'], 'tacticsTarget': t['tacticsTarget'], 'tacticA': t['tacticA'], 'tacticB': t['tacticB'], 'endOfMonsterRound': e, 'whenDrawn': t.get('whenDrawn'),
            'ops': {'target': t['tacticsTarget'], 'loneExtraVigor': 0, 'A': TA[t['tacticA']], 'B': TA[t['tacticB']], 'endOfMonsterRound': {'move': 2, 'lh': to}, 'escalateOnDraw': bool(t.get('whenDrawn'))}}
tac = [tactic(t) for t in raw['tactics']]
FACE = {'N': 'up', 'S': 'down', 'E': 'right', 'W': 'left'}
d = {
 'id': 'first-men-lictor-hunters', 'name': 'Firstmen Lictor Hunters', 'kind': 'mob', 'code': S['code'], 'traitsLine': S['traitsLine'],
 '_source': 'Monster Sheet (2 pages), AI/BP/Battle Tactics/Routine card sheet, Signature card — owner scans 2026-11-17; Clash Setup: expansion Codex p.58',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the cell directly behind (R on the sheet diagram)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Advanced Bypass'}, {'name': 'Ignore Difficult Terrain'}, {'name': 'Immediate Spawn'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'lhRoutine'}]}},
 'battleTactics': {t['name']: t for t in tac if t['kind'] == 'basic'}, 'lh': {'advancedTactics': {t['name']: t for t in tac if t['kind'] == 'advanced'}, 'decoyStart': [c for c, _ in CS['decoyStart']]},
 'clashSetup': {'_source': 'Expansion Codex p.58 (Firstmen Lictor Hunters Clash)', 'steps': CS['steps'], 'requiredTiles': CS['requiredTiles'],
  'mobStart': [{'cell': c, 'facing': FACE[f]} for c, f in CS['mobStart'] + CS['decoyStart']], 'mobTrack': {'1': 8, '2': 2}, 'knightStart': CS['knightStart'],
  'terrain': [{'tile': t['tile'], 'cells': t['cells'], **({'num': t['n']} if t.get('n') else {})} for t in CS['terrain']], 'unclear': CS.get('unclear', []), 'notes': ['지형·시작 칸·Decoy 위치는 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Decoy 모델: Decoy 미니어처는 어느 BP와도 묶이지 않으므로, Decoy를 명중시키면 Mob track에서 가장 왼쪽의 비공개 Decoying BP를 공개해 그 칸의 Decoy와 짝지어 Power Roll을 해결. Response 전에 base ring을 붙이고(더 이상 Decoy 아님), 부상 실패면 새 Lictor Hunter를 Spawn하듯 Great Mangrove로 이동. Decoying BP가 모두 공개되어 있으면 즉시 Routine',
  'Decoy 키워드: 그 Lictor Hunter가 Decoy가 됨(미니어처는 그 자리에 남음, BP는 뒷면으로). Taunt & Decoy에 Generic 토큰 +1. 이미 Decoying이거나 Great Mangrove 위면 무시',
  'Taunt & Decoy 토큰(누적): 1개 모든 Monster Attack Vigor 손실 +1 / 2개 +1 주사위 / 3개 After Attack: Exposed / 4개가 되는 순간 현재 행동 해결 뒤 다음 Lictor Hunter 활성화 + 가장 왼쪽의 토큰 없는 BP에 AI Activation 토큰 추가 (5개째부터는 추가 발동 없음) [해석, 확인 필요]',
  'Decoying Lictor Hunter가 활성화되면 그 공격 동안 모든 기사를 인접·시야 내로 취급하고 이동하지 않음',
  'Seek & Destroy: Decoy는 Lumbering(이동하지 않음). Swamp 위 Decoy는 AT -1, To Hit +2. Decoy를 공격할 때 Knight Pool의 Fire 토큰 1개당 To Hit -1',
  'Mangrove Deployment: 죽으면 한 Level 높은 BP(없으면 BP 3)로 새 Lictor Hunter가 Great Mangrove #1부터 시계 방향으로 대기. Knight Round 종료 시 번호 순으로 Dwell(가장 가까운 빈 Swamp 칸으로 이동)',
  'It’s a Trap!: Decoy를 공격했을 때 Instinct로 처리 — 그 Decoy 주변 Zone 1의 모든 기사 Vigor -1, 잃은 기사 수만큼 Fire 토큰',
  'Battle Tactics의 "in range": Tactics Target 줄에서는 사거리 조건을 적용하지 않음 [해석, 확인 필요]',
  'End of Monster Round(Battle Tactics): 이번 Monster Round에 활성화된 Monster만 2칸 이동 (Decoying은 이동하지 않음)',
  'Censor "While revealed: Disable Responses that flip BP cards face down": 이 덱의 "flip … face down" Response(Censor·Frumentari)에만 적용, Critical의 "You may flip a chosen BP"는 그대로 [해석, 확인 필요]',
  'Stilicho "-1 AT when adjacent to any other Monster", Speculatore "All Monsters have +1 To Hit", Exploratore "+1 Vigor loss": 공개된 동안 적용',
  'Combat Flexibility: Decoying이 아닌 Mob을 죽이면 그 공격의 Response 뒤에 Mob track의 다음 non-Decoying Mob이 공격자에게 Signature',
  'Advanced Ambush Tactics "When you draw this card, Escalate 1": 가장 낮은 비공개 BP를 Escalate [해석, 확인 필요]',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP', len(tac), 'tactics')
