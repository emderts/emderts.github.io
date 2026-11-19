# Builds data/monsters/stonemason-knight.json (Vassal Clash) from docs/transcriptions/stonemason_knight_raw.json (owner scans 2026-11-17)
# + hand-written ops + Clash Setup (expansion Codex p.56–57). Usage: python3 tools/build_stonemason.py data/monsters/stonemason-knight.json
import json, sys, copy, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'newmon'))
from common import apply_react
raw = json.load(open('docs/transcriptions/stonemason_knight_raw.json')); S = raw['sheet']; CS = raw['clashSetup']
def bzone(rows):
    blk = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch in '^>v<']; xs = [x for x, _ in blk]; ys = [y for _, y in blk]
    f = rows[blk[0][1]][blk[0][0]]; rel = (lambda x, y: (min(ys) - y, x - min(xs))) if f == '^' else (lambda x, y: (x - max(xs), y - min(ys)))
    return {'red': [rel(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == 'R'], 'yellow': [], 'step': None, 'block': True}
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; HT = lambda *t: {'op': 'smHits', 'table': list(t), 'perilCheck': True}
BANE = lambda n: {'op': 'smBane', 'n': n}; KB = lambda n: {'op': 'knockback', 'n': n}; PB = lambda n: {'op': 'pushback', 'n': n}; KD = {'op': 'knockdown'}
EX1 = {'op': 'smMetal', 'mode': 'exhaust', 'n': 1}; EXA = {'op': 'smMetal', 'mode': 'exhaust', 'n': 'all'}; DI1 = {'op': 'smMetal', 'mode': 'discard', 'n': 1}
RUIN = {'op': 'smRuin'}; PEN = {'op': 'penetrate'}
ON = lambda *ops: [{'op': 'smOnHit', 'then': list(ops)}]
G3 = lambda n: [{'op': 'smThree', 'stat': 'heat', 'gte': 3, 'n': n}]
CF = ['Closest Knight in front', 'Closest Knight in sight']; CN = ['Closest Knight not in front', 'Closest Knight in sight']
Z = {'Backhand Swat': ['>>R', '>>R'], 'Flattening Swipe': ['.RR.', '>>RR', '>>RR', '.RR.'], 'Hammer Launch': ['>>RRRR', '>>RRRR'], 'Stone Smite': ['...R', '>>RR', '>>RR', '...R'], 'Mass Driver': ['>>' + 'R' * 8, '>>' + 'R' * 8],
     'Toppling Sweep': ['..RR..', '.RRRR.', 'RR^^RR', 'RR^^RR', '.RRRR.', '..RR..'], 'Force Discharge': ['...RR...', '..RRRR..', '.RRRRRR.', 'RRR^^RRR', 'RRR^^RRR', '.RRRRRR.', '..RRRR..', '...RR...']}
AI = {
 'Kick!': dict(effects=ON(BANE(1), V(2), KB(4))),
 'Demolishing Blow': dict(gates=G3(2), effects=ON(HT(3, 5), EX1), afterAttack=[RUIN]),
 'Hammer Rise': dict(gates=G3(2), effects=ON(HT(3, 5), EX1, PB(2)), afterAttack=[RUIN]),
 'Backhand Swat': dict(type='zone', effects=ON(BANE(1), V(2)), afterFinalAttack=[RUIN]),
 'Hammer Throw': dict(range=7, move=False, effects=ON(PEN, HT(3), EX1, {'op': 'smPull', 'n': 3})),
 'Flattening Swipe': dict(type='zone', effects=ON(V(1), EX1)),
 'Hammer Launch': dict(type='zone', move=False, smLateral=True, gates=[{'op': 'smDiscardInstead', 'stat': 'heat', 'gte': 3}], effects=ON(PEN, HT(4), EX1), afterFinalAttack=[RUIN]),
 'Stone Smite': dict(type='zone', effects=ON(BANE(1), V(3), KB(4)), afterFinalAttack=[RUIN]),
 'Wrecking Ball': dict(pathAttack=True, effects=ON(BANE(1), V(2), {'op': 'knockbackSide', 'n': 4})),
 'Toppling Sweep': dict(type='zone', targeting=['Zone'], move=False, gates=G3(2), effects=ON(HT(3, 5), EX1, KD)),
 'Anvil Fall': dict(gates=G3(2), effects=ON(HT(3, 5), EX1, PB(3)), afterAttack=[RUIN]),
 'Bulldozing Stomp': dict(gates=G3(3), effects=ON(BANE(1), HT(4, 6)), afterAttack=[RUIN]),
 'Mass Driver': dict(type='zone', move=False, smLateral=True, effects=ON(PEN, HT(5), {'op': 'knockbackSide', 'n': 3}), afterFinalAttack=[RUIN]),
 'Reduce to Ruins': dict(targeting=['All Knights'], move=False, gates=G3(3), effects=ON(BANE(2), HT(3, 6)), afterAttack=[{'op': 'smRubbleUnder', 'who': 'target'}]),
 'March of Devastation': dict(targeting=['Closest Knight'], effects=ON(BANE(1), V(2), DI1), afterAttack=[RUIN], afterFinalAttack=[{'op': 'smMarch'}]),
 'Mason Grasp': dict(effects=ON(BANE(2), V(3), {'op': 'choke', 'n': 3})),
 'Force Discharge': dict(type='zone', targeting=['Zone'], move=False, gates=G3(2), effects=ON(HT(4, 7), EXA, {'op': 'smPull', 'n': 2})),
 'Pulverize': dict(gates=G3('die'), effects=ON(HT(7, 9), EXA, KD), afterAttack=[RUIN]),
}
SIG = dict(gates=[{'op': 'evasionDice', 'stat': 'heat', 'gte': 3, 'n': 1}], effects=ON(V(2), KB(4)), afterAttack=[RUIN])
SIGA = {'op': 'signatureAgainstAttacker'}; RUB = {'op': 'smRubbleUnder', 'who': 'attacker'}; UNEX = {'op': 'smMetal', 'mode': 'unexhaust', 'n': 1}; HEAT = lambda n: {'op': 'smHeat', 'n': n}
BA = {'op': 'bonusAttack', 'who': 'self', 'optional': True}; REPO = {'op': 'smMoveBonus', 'who': 'self', 'n': 2}
BP = {
 'Stone Greaves': dict(wound=[RUB], fail=[SIGA], critical=[UNEX, {'op': 'monsterModifier', 'stat': 'toHit', 'n': -1}]),
 'Sturdy Backplate': dict(instinct=[EX1], critical=[{'op': 'smMoveBonus', 'who': 'other', 'n': 1, 'hug': True}]),
 'Hollow Plackart': dict(wound=[KB(4)], fail=[SIGA], critical=[{'op': 'smNoToken'}, {'op': 'smDiscardNode'}]),
 'Vambraces of the Builders': dict(wound=[KD], fail=[BANE(1)], critical=[BA]),
 'Layered Tassets': dict(wound=[KB(4)], fail=[RUB], critical=[{'op': 'gainPassion', 'n': 1}, {'op': 'leaveTokens', 'n': 2, 'tokens': ['opening', 'break']}]),
 'Waist Gap': dict(wound=[EX1], fail=[BANE(1)], critical=[UNEX, {'op': 'resetHeat'}]),
 'Ornate Visor': dict(wound=[BANE(1)], fail=[SIGA], critical=[{'op': 'monsterNegPrecision', 'permanent': True}]),
 'Gauntlets of Ruin': dict(wound=[SIGA], fail=[RUB], critical=[REPO]),
 'Lodestone Chestplate': dict(wound=[EX1, HEAT(1)], fail=[DI1, HEAT(2)], critical=[{'op': 'smClearNodes', 'lock': 'knightRound'}]),
 'Carved Pauldrons': dict(wound=[EX1, HEAT(1)], fail=[BANE(1), KB(5)], critical=[{'op': 'additionalSingleWound'}]),
 'Heavy Chain': dict(wound=[SIGA], fail=[{'op': 'smZoneKnockdown', 'z': 1}], critical=[{'op': 'smFlag', 'id': 'noGearExhaust'}]),
 'Flexible Joints': dict(wound=[BANE(1), KB(4)], fail=[RUB], critical=[REPO]),
 'Ruinous Engine': dict(instinct=[{'op': 'smRubbleSides'}], critical=[{'op': 'smFlag', 'id': 'noRubble'}]),
 'Ferrofluid Veins': dict(wound=[SIGA], fail=[DI1, HEAT(2)], critical=[{'op': 'smFlag', 'id': 'ignoreNodes'}]),
 'Splinter of Corrupted Purpose': dict(instinct=[BANE(2)], critical=[{'op': 'smFlag', 'id': 'noBane'}]),
 'Circlet of Andermainz': dict(wound=[KD, KB(6)], fail=[SIGA], critical=[{'op': 'smFlag', 'id': 'noGates'}, {'op': 'smBonusNoLodestone'}]),
 'Sliver of Faith': dict(fail=[BANE(2)], instinct=[SIGA], critical=[{'op': 'devote'}]),
 'Magnetite Core': dict(instinct=[DI1, HEAT(2)], critical=[{'op': 'slayMonster'}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': spec.pop('targeting', c['targeting']), 'move': spec.pop('move', tag.startswith('MOVE')), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'attack'); ops.update(spec)
    if c['name'] in Z: ops['zoneDiagram'] = bzone(Z[c['name']])
    c['ops'] = ops; return apply_react(c)
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; oc = c['overcome']; ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': [{'op': 'power', 'n': 1}]} if oc else None}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI', 'traitsAdd': v['traitsAdd'], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
d = {
 'id': 'stonemason-knight', 'name': 'Stonemason Knight', 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'],
 '_source': 'Monster Sheet (2 pages), AI/BP/Routine card sheet, Signature card — owner scans 2026-11-17; reference sheet Stonemason Knight; Clash Setup: expansion Codex p.56–57',
 'footprint': {'size': 4, 'shape': '2x2', 'rear': 'the 2 cells directly behind the footprint', 'facingOnSheet': 'down', 'wardNodes': 'one per side'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 5}, {'name': 'Ignore Difficult Terrain'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'smRoutine'}]}},
 'sm': True,
 'clashSetup': {'_source': 'Expansion Codex p.56–57 (Stonemason Knight Clash)', 'steps': CS['steps'], 'requiredTiles': CS['requiredTiles'], 'monsterCells': CS['monsterCells'], 'facing': 'S',
  'knightStart': CS['knightStart'], 'terrain': CS['terrain'], 'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 (소유자 확인 2026-11-18)']},
 'zoneNote': 'Zone 도식(카드에서 읽음): Backhand Swat = 정면 2칸; Flattening Swipe = 정면 2x2 + 양 옆 대각 2칸씩; Hammer Launch = 정면 2줄 x 4칸; Stone Smite = 정면 2x2 + 바깥 대각 2칸; Mass Driver = 정면 2x8; Toppling Sweep = 주변 마름모(가로 2·4·6·6·4·2칸); Force Discharge = 더 큰 마름모(2·4·6·8·8·6·4·2칸) (소유자 확인 2026-11-18)',
 'rulings': [
  'Lodestone Armor: 기사가 공격을 시작한 위치 기준으로 면(앞/뒤/좌/우)을 정함. 대각선 위치는 맞닿은 두 면 중 플레이어가 선택 (소유자 확인 2026-11-18). 그 면에 Armor 토큰이 있으면 AT +1, 없으면 공격을 모두 해결한 뒤 그 면 Ward Node에 토큰 1개. 네 번째 Node에 놓게 되면 대신 모든 Node에서 1개씩 버리고 Zone 2의 기사들 Knockback 2, 이번 Round 끝까지 토큰 획득 불가',
  'Heat 3+ "THREE OR MORE HITS, LOSE -N [V]": 3회 이상 명중 시 추가로 -N (예: 1회 -3 / 2회+ -5 / 게이트·3회+ → -5 -2) (소유자 확인 2026-11-18)',
  'Ruin: Stonemason 정면에 인접한 2x2. 보드 밖이면 놓지 않음. Rubble을 기사 밑에 놓을 때: 그 기사 칸을 포함하는 2x2 중 Stonemason에 가장 가까운 위치(Stonemason과 겹치지 않게). 기존 Rubble 타일과 겹치면 그 타일을 치우고 새 타일에 가장 많은 변으로 인접하게 다시 놓음(동률이면 선택) (Architect of Destruction)',
  'Move Lateral (Hammer Launch, Mass Driver): 가로 또는 세로 직선으로 최단 이동해 대상이 Zone 안에 들어오는 칸으로 이동 (Rulebook)',
  'March of Devastation: 가장 가까운 기사부터 한 명씩 Move & Attack',
  'Penetrate (확장 Codex p.9): "During Armor Roll, ignore one of your Armor dice of the highest tier." — 그 공격의 Armor Roll에서 가장 높은 tier(white > black > red) 주사위 1개를 굴리지 않음 (소유자 확인 2026-11-18)',
  'Ornate Visor Critical(영구 음수 Precision 토큰): 이후 모든 Monster Attack의 Difficulty -1 — Ratwolves의 임시 토큰(다음 Monster Attack Difficulty -1 후 버림, 소유자 확인 2026-11-18)과 같은 효과가 계속되는 것으로 처리 (소유자 확인 2026-11-18)',
  'Sliver of Faith Critical: Devote — 공격한 기사가 Devotion 토큰 +1 (Clash 뒤 Knight Sheet에 반영, Incarnation 이동 칸 수에 더해짐)',
  'Reposition 2 + Bonus Attack: 최대 2칸 이동 후 Bonus Attack. Hug 1 + Bonus Attack(Sturdy Backplate): Hug 정의대로 — 몬스터에 인접해 있을 때만, 인접을 유지하며 최대 1칸 (소유자 확인 2026-11-18)',
  'Ferrospikes: Rubble 칸으로 들어갈 때마다 Vigor -1 — 스스로 이동, 밀리거나 끌려감, 발밑에 Rubble이 놓임 모두 적용 (소유자 확인 2026-11-18)',
  'Magnetite Reinforcement: 기사가 가장 많이 있는 면의 Node에 토큰 2개 (동률이면 선택). 대각선 위치의 기사는 맞닿은 두 면 모두에 있는 것으로 셈 (소유자 확인 2026-11-18)',
 ],
}
d['rulings'].insert(0, d['zoneNote'])
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
