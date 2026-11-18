# Builds data/monsters/ratwolves.json (Mob Clash) from docs/transcriptions/ratwolves_raw.json (owner scans 2026-11-17) + hand-written ops
# + Clash Setup (Sunken Kingdom / Principality of Stone Codex p.36–37). Usage: python3 tools/build_ratwolves.py data/monsters/ratwolves.json
import json, sys, copy, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'newmon'))
from common import apply_react
raw = json.load(open('docs/transcriptions/ratwolves_raw.json')); S = raw['sheet']; CS = raw['clashSetup']
V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
AFF = lambda n: {'op': 'ratAfflict', 'n': n}; DRAG = lambda n: {'op': 'ratDrag', 'n': n}; KD = {'op': 'knockdown'}; COND = lambda i: {'op': 'condition', 'id': i}
HITS = lambda gte, then, lt=None: {'op': 'ratIfHits', 'gte': gte, 'lt': lt, 'then': then}; ALONE = lambda z: {'op': 'ratIfAlone', 'z': z, 'then': [KD]}
HD = lambda g: {'op': 'evasionDice', 'stat': 'heat', 'gte': g, 'n': 1}; HV = lambda g, n: {'op': 'vigorPerHitInstead', 'stat': 'heat', 'gte': g, 'n': n}
HA = lambda g, ops: {'op': 'noop', 'stat': 'heat', 'gte': g, 'alsoOps': ops}
AI = {
 'Toppling Charge': dict(gates=[HV(4, 2)], effects=[V(1)], afterAttack=[KD]),
 'Tearing Bite': dict(effects=[V(1), AFF(1)], afterAttack=[DRAG(3)]),
 'Furious Pull': dict(gates=[HD(3)], effects=[V(1)], afterAttack=[DRAG(5)]),
 'Fanged Snap': dict(gates=[HA(3, [AFF(1)])], effects=[V(1)], afterAttack=[DRAG(2)]),
 'Pestilent Bite': dict(effects=[V(2), AFF(1)], afterAttack=[DRAG(3)]),
 'Dire Howl': dict(judge=['Bravery'], gates=[HA(4, [{'op': 'escalateLowestUnrevealed'}])], effects=[HITS(1, [COND('Fear')], lt=3), HITS(3, [COND('Dread')]), ALONE(2)], afterAttack=[{'op': 'knockback', 'n': 3}]),
 'Isolating Pull': dict(gates=[HD(3)], effects=[V(1), AFF(1)], afterAttack=[DRAG(6)]),
 'Verminous Gnawing': dict(gates=[HA(3, [AFF(1)])], effects=[V(2), {'op': 'swarm', 'n': 1}, KD], afterAttack=[DRAG(2)]),
 'Cursed Bite': dict(gates=[{'op': 'evasionDice', 'stat': 'condTokens', 'gte': 3, 'n': 1}], effects=[V(2), {'op': 'ratCurseIfDied', 'n': 1}], afterAttack=[{'op': 'activate', 'n': 1}]),
 'Ratswarm': dict(gates=[HV(4, 2)], extraDice={'perHits': 2}, effects=[V(1), {'op': 'ratAfflictPerHit', 'n': 1}, ALONE(1)], afterAttack=[{'op': 'pushback', 'n': 5}]),
}
SIG = dict(gates=[{'op': 'noop', 'stat': 'condTokens', 'gte': 3, 'alsoOps': [KD]}], effects=[V(1)], afterAttack=[DRAG(2)])
POW = [{'op': 'power', 'n': 1}]; SIGN = {'op': 'ratSignature'}
BP = {
 'Famished Ratwolf': dict(fail=[{'op': 'escalateAI'}], aura={'ratInstinctPoison': 1}),
 ('Ratwolf', 'rightmost'): dict(wound=[{'op': 'revealBP', 'side': 'rightmost'}], fail=[SIGN], critical=[{'op': 'lookBP'}]),
 ('Ratwolf', 'leftmost'): dict(wound=[{'op': 'revealBP', 'side': 'leftmost'}], fail=[SIGN], critical=[{'op': 'lookBP'}]),
 'Stalking Ratwolf': dict(wound=[{'op': 'ratPriority'}], instinct=[{'op': 'drawAIFor', 'which': 'furthest'}], critical=[{'op': 'bonusAttack', 'who': 'otherKnight', 'optional': True}], aura={'allGates': True}),
 'Giant Ratwolf': dict(wound=[{'op': 'ratMoveToken'}], fail=[SIGN], critical=[{'op': 'flipBPDown'}], aura={'atAll': 1}),
 'Plague-Ridden Ratwolf': dict(whenRevealed=[{'op': 'armorToken', 'to': 'this'}, {'op': 'armorToken', 'to': 'otherMobsInZone', 'z': 2}], instinct=[{'op': 'parasitize', 'n': 1}], fail=[SIGN], critical=[{'op': 'monsterNegPrecision'}]),
 'Leader of the Pack': dict(wound=[{'op': 'drawAIFor', 'which': 'furthest'}], fail=[DRAG(3)], critical=[COND('Courage'), {'op': 'resetHeat'}], winOnDeath=True),
 'Alpha Ratwolf': dict(wound=[{'op': 'activate', 'n': 1}], fail=[{'op': 'escalateAI'}], critical=[{'op': 'bonusAttack', 'who': 'self', 'optional': True}], aura={'mobAttackVigor': 1}, winOnDeath=True),
}
TYPE = {'ATTACK': 'attack', 'JUDGEMENT': 'judgement', 'SIGNATURE': 'attack'}
WL = {'op': 'ratWeakest'}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': c['targeting'], 'move': tag.startswith('MOVE'), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects') + [WL], 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': None}
    ops.update(spec); c['typePrinted'] = c['type']; c['type'] = TYPE[c['type']]; c['ops'] = ops; return apply_react(c)
def bp(c):
    c = copy.deepcopy(c); key = c['name']
    if key == 'Ratwolf': key = ('Ratwolf', 'rightmost' if 'rightmost' in c['responses']['wound'] else 'leftmost')
    spec = BP[key]; oc = c['overcome']; ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': POW, 'tag': 'OVERCOME'} if oc else None}
    for k in ('wound', 'fail', 'instinct', 'critical', 'whenRevealed', 'aura', 'winOnDeath'):
        if k in spec: ops[k] = spec[k]
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '2 AI', 'traitsAdd': [t for t in v['traitsAdd'] if not t.startswith('Kingdom Trait')], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
KT = {x['name']: x for x in raw['extra']}
FACE = {'N': 'up', 'S': 'down', 'E': 'right', 'W': 'left'}
d = {
 'id': 'ratwolves', 'name': 'Ratwolves', 'kind': 'mob', 'code': S['code'], 'traitsLine': S['traitsLine'],
 '_source': 'Monster Sheet (2 pages), AI/BP/Routine/Kingdom Trait card sheet, Signature card — owner scans 2026-11-17; reference sheet Ratwolves v1.2; Clash Setup: Sunken Kingdom / Principality of Stone Codex p.36–37',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the cell directly behind (R on the sheet diagram)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Immediate Spawn', 'rule': 'Strength of the Pack: a killed Ratwolf is replaced (BP one Level higher) adjacent to a random Knight and performs Signature.'}],
 'levels': levels,
 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': n, 'level': 1, 'text': f"[Kingdom Trait — {KT[n]['kingdom']}] " + KT[n]['text'], 'implemented': True} for n in ('Parasite Bed', 'Bile and Poison')],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'condition', 'id': 'Fear', 'all': True}, {'op': 'ratPoisonAll', 'n': 2}]}},
 'rat': {'kingdomTrait': {'sunken': 'Bile and Poison', 'principality': 'Parasite Bed'}},
 'clashSetup': {'_source': CS['page'], 'steps': CS['steps'], 'requiredTiles': CS['requiredTiles'],
  'mobStart': [{'cell': c, 'facing': FACE[f]} for c, f in CS['mobStart']], 'mobTrack': {'1': 4}, 'knightStart': CS['knightStart'], 'terrain': CS['terrain'],
  'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 (소유자 확인 2026-11-18)']},
 'rulings': [
  'Strength of the Pack: 처음 부상은 BP 위에 Generic 토큰(Toughness까지), 토큰 수 = Toughness일 때 부상하면 죽음. 토큰만 놓을 때는 Wound·Escalation 없음, Response는 Wound로 처리, 장비·Arc의 "부상 시" 효과는 발동하지 않음 (참고 시트 v1.2)',
  'Immediate Spawn: 죽은 Ratwolf의 Mob track 칸에 한 Level 높은 BP(없으면 같은 Level 이하 중 높은 것), 무작위 기사에 인접한 칸 중 Board Edge에 가장 가까운(Obstacle 없는) 칸, 점유 시 Displace, 이후 Signature(일반 Targeting)',
  'Lone Knight = 3칸 이내에 다른 기사 없음 (참고 시트 v1.2)',
  'Rising Pressure: Condition 토큰을 얻은 만큼 Heat (Poison/Toxify/Parasitize 토큰)',
  'Go for the Weakest Link: 명중이 있었을 때만(Full Evade면 생략), 다른 Attack Consequence 뒤에 처리 (참고 시트)',
  'Drag: 인접해야 시작; Ratwolf가 기사 반대쪽으로 이동하고 기사가 따라옴. Obstacle·미니어처에 막히면 멈춤. Board Edge에 닿으면 가장 가까운 짧은 변 쪽으로 가장자리를 따라 이동 (참고 시트). Lv2+ Into the Chittering Shadows: 처음부터 가장 가까운 짧은 변(1열/14열) 방향. 끌려가는 기사가 그 방향에 서 있으면 Ratwolf가 자리를 바꿔 지나간 뒤 계속 끌고 감. Lv4 Ravening Ratswarm: 짧은 변을 넘어가게 되면 대상 사망 (소유자 확인 2026-11-18)',
  '"If no other Knight in Zone N, Knockdown" (Dire Howl, Ratswarm): 대상 기사 주변 Zone N에 다른 기사가 없을 때로 처리 (소유자 확인 2026-11-18)',
  'Famished Ratwolf "All other Ratwolves gain Instinct: Poison 1": 공개된 Famished Ratwolf 한 장당, 다른 Ratwolf를 공격한 기사가 (Critical이 아니면) Poison 1',
  'Cursed Bite "If a Knight dies from this Attack, gain +1 [Curse]": 아이콘은 Curse (소유자 확인 2026-11-18) — 공용 Curse +1',
  'Plague-Ridden Ratwolf Critical "temporary negative Precision token in the Knight Pool": 다음 Monster Attack의 Difficulty -1, 그 뒤 버림 (소유자 확인 2026-11-18)',
  'Parasitize X / Swarm X: Rulebook 키워드 정의대로 (Parasitize: Panzer Parasite Condition + Generic 토큰 X / Swarm: 인접한 다른 Monster마다 Vigor -X)',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
