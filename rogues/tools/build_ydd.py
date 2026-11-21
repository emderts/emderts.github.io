# Builds data/monsters/young-devour-dragon.json (Dragon Clash) from docs/transcriptions/young_devour_dragon_raw.json
# + hand-written ops + Clash Setup (TTSF Codex, Young Devour Dragon Clash). Usage: python3 tools/build_ydd.py data/monsters/young-devour-dragon.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/young_devour_dragon_raw.json')); S = raw['sheet']
ICON = lambda s: s.replace('[H]', '[Heat]').replace('[P]', '[Passion]').replace('[V]', '[Vigor]')
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; K = lambda op, who='target', perHit=False, **kw: {'op': 'yddK', 'k': {'op': op, **kw}, 'who': who, 'perHit': perHit}
KD = {'op': 'knockdown'}; RX = {'op': 'reactWindow', 'at': 'mid'}; A = 'attacker'
P = lambda n=1, **k: {'op': 'yddP', 'n': n, **k}; BANE = lambda n, who='target', perHit=False: K('bane', who, perHit, n=n); CBH = {'op': 'yddCbh'}
FW = lambda n, **k: {'op': 'yddForward', 'n': n, **k}; RAM = lambda **k: {'op': 'yddRam', **k}; FOOL = {'op': 'yddFool'}
GP = lambda gte: {'stat': 'passion', 'gte': gte, 'op': 'evasionDice', 'n': 1}; FN = lambda cond, **k: {'stat': 'fn', 'fn': 'yddGate', 'is': cond, 'gte': 0, **k}
Z = lambda rows: {'red': [(f, r) for f, (a, b) in rows.items() for r in range(a, b + 1)], 'yellow': [], 'step': None, 'block': True}
AI = {
 'Gulping Run': dict(move=True, gates=[GP(3)], before=[P(1)], effects=[V(3), RX], afterFinalAttack=[FW(4, after=True)]),
 'Damning Discharge': dict(type='zone', judge=['Fortitude', 'Might'], gates=[FN('both', op='doomed'), FN('both', op='evasionDice', n=1)], before=[CBH], effects=[V(4)], afterFinalAttack=[RAM()]),
 'Bile Vomit': dict(type='zone', wave=True, move=True, zoneDiagram=Z({1: (0, 2), 2: (-1, 3), 3: (-2, 4)}), gates=[GP(3)], effects=[V(2), BANE(1, perHit=True), P(1, perHit=True), RX], afterFinalAttack=[RAM()]),
 'Autotomic Evisceration': dict(move=True, gates=[GP(3)], before=[P(1)], effects=[V(4), BANE(1, perHit=True), RX], afterAttack=[FOOL]),
 'Skewer': dict(range=4, gates=[GP(3)], effects=[{'op': 'yddFlat', 'n': 8, 'perilCheck': True}, P(1), BANE(2), CBH, RX], afterAttack=[FOOL]),
 'Hungry Chomp': dict(move=True, gates=[FN('divine', op='evasionDice', n=1)], effects=[V(5), {'op': 'yddShield'}, RX], afterAttack=[FW(4, after=True)]),
 'Devouring Vortex': dict(range='unlimited', yddAllThree=True, gates=[GP(4)], effects=[{'op': 'yddPull', 'n': 3}, V(3), {'op': 'yddIfAdj', 'then': [{'op': 'loseVigor', 'n': 9}]}, RX], afterFinalAttack=[FOOL]),
 'Dive Attack': dict(move=True, gates=[GP(4)], before=[P(1)], effects=[V(6), RX], afterFinalAttack=[FW(6, after=True)]),
 'Thunder Storm': dict(type='zone', judge=['Fortitude', 'Might'], gates=[FN('either', op='doomed'), FN('either', op='yddAlso', alsoOps=[CBH])], before=[K('condition', id='Panicked')], effects=[V(4), P(1, perHit=True), {'op': 'yddIfHits', 'gte': 3, 'then': [KD]}, RX], afterFinalAttack=[RAM()]),
 'Command of the Famishing': dict(type='zone', judge=['Bravery', 'Tenacity'], gates=[GP(3)], before=[{'op': 'yddCommand'}], effects=[RX], afterFinalAttack=[RAM(devour=True)]),
 'Bile Cannon': dict(range='unlimited', zoneAroundTarget=1, gates=[GP(4)], effects=[V(4), BANE(1, perHit=True), P(1, perHit=True), RX], afterFinalAttack=[FOOL]),
 'Fearsome Feast': dict(move=True, gates=[FN('divine', op='evasionDice', n=1)], effects=[V(5), {'op': 'yddShield'}, RX], afterAttack=[FW(6, after=True)]),
 'Madness of the Famishing': dict(judge=['Bravery', 'Tenacity'], effects=[{'op': 'yddMad'}, RX], afterAttack=[FOOL]),
 'Grind to a Pulp': dict(move=True, zoneAroundTarget=1, effects=[{'op': 'yddGrind'}, RX], afterFinalAttack=[FW(8, after=True)]),
 "Slice 'n' Dice": dict(range=6, effects=[V(4), P(2), BANE(4), RX], afterAttack=[FOOL]),
 "Snatch 'n' Snap": dict(move=True, effects=[V(7), P(1, perHit=True), {'op': 'yddSlot'}, {'op': 'yddDevour', 'gte': 3}, RX], afterAttack=[FW(3, side='left', sideN=3, after=True)]),
 'World Eater': dict(move=True, gates=[FN('vp', op='evasionDice', n=1)], effects=[V(2), BANE(1, perHit=True), {'op': 'yddWorld'}, RX], afterAttack=[FW(3, side='right', sideN=3, after=True)]),
 'Black Hole': dict(type='zone', pre=[{'op': 'yddBlackHole'}], effects=[{'op': 'yddPull', 'n': 3}, V(5), {'op': 'yddIfAdj', 'then': [{'op': 'yddDevour'}]}, RX], afterFinalAttack=[FW(8, after=True)]),
}
SIG = dict(type='zone', move=True, zoneDiagram=Z({1: (0, 2)}), before=[P(1)], effects=[V(4), RX, KD], afterFinalAttack=[{'op': 'yddKbRight', 'n': 5}])
OC = lambda n, *ops, kind='overcome': {'n': n, 'kind': kind, 'ops': list(ops)}; P1 = {'op': 'power', 'n': 1}; MV = lambda n: {'op': 'yddMove', 'n': n}; IW = {'op': 'yddIgnoreWound'}
SIGA = {'op': 'signatureAgainstAttacker'}; LV = lambda n: {'op': 'loseVigor', 'n': n}; BONUS = {'op': 'yddBonus'}; EXW = {'op': 'yddExhaustWeapon'}; FL = lambda i, text: {'op': 'yddFlag', 'id': i, 'text': text}
FP = {'op': 'yddFrontP'}; CF = {'op': 'yddChainFront'}; LP = {'op': 'yddLoseP', 'who': A}; KB = lambda n: {'op': 'knockback', 'n': n}; SC = lambda n: {'op': 'yddScavenge', 'n': n}
BP = {
 'Greedy Claws': dict(oc=OC(7, P1), ultrainstinct=[K('gainHeat', A, n=2)], wound=[EXW, LV(2)], critical=[{'op': 'monsterModifier', 'stat': 'toHit', 'n': -1}]),
 'Unhinged Jaw': dict(oc=OC(2, MV(2), kind='overpower'), wound=[LV(2)], critical=[{'op': 'yddCbhChoice'}]),
 'Winding Tail': dict(oc=OC(3, MV(1)), fail=[BANE(1, A), RX, FW(2)], critical=[{'op': 'monsterNegPrecision', 'permanent': True}]),
 'Springy Hindlimbs': dict(oc=OC(5, MV(2)), ultrainstinct=[CF], wound=[RX, RAM()], fail=[KB(5)], critical=[FL('after3', 'Clash 종료까지 After Attack의 Dragon 이동은 3칸에서 멈춤')]),
 'Whiskerfin': dict(oc=OC(4, IW, kind='overpower'), instinct=[BANE(2, A)], wound=[KD], critical=[BONUS]),
 'Venomous Whiskers': dict(oc=OC(4, P1), ultrainstinct=[FP], fail=[BANE(1, A), K('toxify', A, n=3)], critical=[BONUS]),
 'Steelribbon Tendril': dict(oc=OC(4, IW, kind='overpower'), ultrainstinct=[K('toxify', A, n=2)], wound=[BANE(2, A), KD], critical=[BONUS]),
 'Hollow Bones': dict(oc=OC(2, MV(2), kind='overpower'), instinct=[RX, RAM()], critical=[SC(1)]),
 'Mucus-Coated Underbelly': dict(oc=OC(3, MV(1)), ultrainstinct=[CF], wound=[RX, RAM()], fail=[KB(6)], critical=[FL('noPLoss', 'Clash 종료까지 기사가 [P]만큼 [V]를 잃게 될 때 그 손실을 무시')]),
 'Barbed Palate': dict(oc=OC(5, MV(2)), ultrainstinct=[FP], instinct=[BANE(1, A), LV(3)], critical=[FL('noRamDestroy', 'Ram이 더 이상 Tower를 파괴하지 않음')]),
 'Pitted Cobalt Scales': dict(oc=OC(4, P1), ultrainstinct=[EXW], instinct=[BANE(2, A), RX, FW(2)], critical=[FL('noDivineGate', 'AI 카드의 Divine Target 게이트 효과 비활성')]),
 'Razor-Sharp Teeth': dict(oc=OC(7, P1), instinct=[EXW, LV(2)], critical=[FL('devourJud', 'Clash 종료까지 Devour 대신 Judicium을 뽑음')]),
 'Black-Bile Organ': dict(oc=OC(4, IW, kind='overpower'), wound=[BANE(3, A), KD], fail=[SIGA], critical=[FL('noBane', 'Bane X 키워드 비활성')]),
 'Hollow Body': dict(oc=OC(6, P1), instinct=[EXW, SIGA], critical=[SC(1)]),
 'Bottomless Stomach': dict(oc=OC(3, {'op': 'yddResetHeat'}, kind='overpower'), ultrainstinct=[K('gainHeat', A, n=3)], wound=[LP], fail=[{'op': 'yddDevour', 'who': A}], critical=[{'op': 'yddRegurgitate'}]),
 'Spinal Air Sac': dict(oc=OC(4, MV(1)), wound=[{'op': 'yddZoneKb'}], fail=[BANE(3, A)], critical=[K('condition', A, id='Courage'), BONUS]),
 'Glassy Eyes': dict(oc=OC(6, MV(3)), ultrainstinct=[FP], wound=[RX, FW(5, random=True)], fail=[RX, FW(3)], critical=[{'op': 'yddClimb'}, BONUS]),
 'Insatiable Heart': dict(oc=OC(6, MV(3)), ultrainstinct=[P(3, who=A)], instinct=[LP], critical=[{'op': 'devote'}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('tag') or ''; c['targeting'] = [ICON(t) for t in c.get('targeting') or []]
    ops = {'targeting': spec.pop('targeting', c['targeting']), 'move': spec.pop('move', False), 'gates': spec.pop('gates', []), 'before': spec.pop('before', []), 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c.get('type'); c['type'] = spec.pop('type', 'attack'); c['moveTag'] = tag; ops.update(spec)
    c['evasionDice'] = c.get('evasionDice') or 0; c['evasionDifficulty'] = c.get('evasionDifficulty') or 0
    c['afterAttack'] = (c['afterTag'] + ': ' + c['after']) if c.get('after') and c.get('afterTag') else c.get('after'); c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; ops = {'at': c['at'], 'overcome': spec.get('oc'), 'ultrainstinct': spec.get('ultrainstinct')}
    c['responses'] = {k: c.get(k) for k in ('ultrainstinct', 'instinct', 'wound', 'fail', 'critical')}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
bel = [c for c in raw['ai'] if c['name'] == 'Bellow of the Famished'][0]; deck = [c for c in raw['ai'] if c is not bel]
missing = [c['name'] for c in deck if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': None, 'activations': v['activations'], 'activationsText': '1 AI', 'traitsAdd': v['traitsAdd'], 'bonuses': {k: v['bonuses'].get(k, 0) for k in ('escalations', 'at', 'vigorLoss', 'evasionDice')}} for l, v in S['levels'].items()}
TW = lambda *p: [{'tile': 'tower', 'cells': list(x), 'shape': '2x2'} for x in p]; RW = lambda *p: [{'tile': 'ruined wall', 'cells': list(x)} for x in p]
d = {'id': 'young-devour-dragon', 'name': S['name'], 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'], '_source': 'Owner scans 2026-11-19; Clash Setup: TTSF Codex (Young Devour Dragon Clash)',
 'footprint': {'size': 9, 'shape': '3x3', 'rear': 'the 3 cells directly behind the footprint', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Lumbering'}, {'name': 'Unavoidable Knockback', 'value': 5}, {'name': 'VP'}],
 'vp': {'name': S['vp']['name'], 'text': S['vp']['text'], 'unlocked': True, 'climb': {'virtue': 'Might', 'n': 10}, 'hold': {'virtue': 'Tenacity', 'n': 12}},
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': c['name'] + ' (' + c['type'] + ')', 'level': 1, 'text': c['text'], 'implemented': True} for c in raw['traitCards']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in deck], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG), 'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'yddRoutine'}]}},
 'bellow': ai(bel, dict(effects=[])), 'ydd': True,
 'clashSetup': {'_source': 'TTSF Codex — Young Devour Dragon Clash', 'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Young Devour Dragon miniature on the space designated on the diagram (facing: all-direction marker — random arrow).', "Additional Setup: Place the Divine Target token and the Fool's deck near the Monster Sheet. Follow additional Clash Setup instructions introduced by Traits (if any)."],
  'requiredTiles': ['3x Tower', '3x Ruined Wall L', '2x Ruined Wall I'], 'monsterCells': [r + str(c) for r in 'IHG' for c in (8, 9, 10)], 'knightStart': ['G4', 'E6', 'E12', 'C8'],
  'terrain': TW(('G3', 'G4', 'F3', 'F4'), ('F11', 'F12', 'E11', 'E12'), ('C6', 'C7', 'B6', 'B7')) + RW(('I4', 'I5', 'I6', 'H4'), ('C8', 'B8', 'B9', 'B10'), ('D11', 'D12', 'C11', 'B11'), ('F5', 'E5', 'D5', 'C5'), ('I13', 'H13', 'G13', 'F13')),
  'notes': ['Dragon 3x3 = G8–I10 (방향 표시는 4방향 마커 — 무작위), 기사 시작 칸 G4·E12는 Tower 위, C8은 Ruined Wall 위. 타일·시작 칸은 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Bellow of the Famished: 첫 AI로 수행 — 무작위 기사 1명이 Divine Target, 다른 무작위 2명이 Called by the Heavens. 카드를 제거하고 AI 수행',
  'Falling Skies: Wound를 줘도 Escalate하지 않음. Phase I(Flying High) → Wound 3개에서 AI·BP 1을 제거하고 AI·BP 2 덱으로, Phase II(Floating Low) → Wound 6개에서 AI·BP 3 덱으로(Phase III Grounded). 전환할 때마다 Dragon이 AI를 수행. Exhibition Clash(Wound 6개에서 승리)는 이 구현에 없음 — 항상 Full Clash',
  'To Hit: Phase I +4 (Terrain 타일·VP·Lunging Attack에서는 0, Ruined Wall에서는 +2), Phase II +2 (Terrain 타일·VP·Lunging Attack에서는 0), Phase III 보정 없음',
  'Phase I: Dragon은 Terrain을 파괴하지 않고 Crash를 일으키지 않음 — Dragon 아래에 놓이게 된 기사는 가장 가까운 빈 칸으로 Displace만 함 [해석, 확인 필요]. Phase II: 일반 규칙대로 Crash. Phase III: Dragon의 Crash = Devour(사망)',
  'Ram: Dragon이 지정된 Tower에 인접한 위치로 이동(가장 가까운 유효 위치). Phase I: Tower 위의 기사 Crash / II: Tower 파괴(Rubble) / III: Tower 파괴 + 위의 기사 Devour. "Ram the furthest Tower" = Dragon에서 가장 먼 Tower',
  'Ruined Bastion: 기사는 자발적 이동으로 Ruined Wall 위로 올라갈 수 있고, Tower에는 Ruined Wall이나 VP에서 올라감(같은 Tower 안에서는 이동 가능). 비자발적 이동에서는 Tower·Ruined Wall이 Indestructible. Tower에서 비자발적으로 이동하게 되면 Crash 후 모든 Obstacle을 무시(Tower 타일 문구). 기사 이동은 일반 규칙(Bypass·Jump 등) 그대로',
  'Lunging Attack (Tower): Move + Combat action. Tower에서 Speed만큼 직선으로 이동해 Dragon에 인접한 뒤 공격 — 명중하면 즉시 VP로, 아니면 Knockdown. 이동 경로의 Terrain은 무시 [해석, 확인 필요]',
  'VP (Broad Back): 처음부터 열려 있음. Climb = Might 10+ (Phase I: 모두 실패, Phase III: +3, 내려올 때도 Climb Down 테스트). Hold On = Tenacity 12+ (실패: Knockdown, Displace). Divine Target은 VP로 이동할 수 없고, VP를 떠나면 Divine Target 토큰을 얻음. VP 위: +X Power (X = 공격한 BP의 Level), Wound를 주면 +1 [P]',
  'Called by the Heavens: Tower 위에서 Monster Attack을 받으면 모든 Gated Effect 적용, VP로 이동하면 버림. 턴 종료 시 가장 가까운 Tower 쪽으로 최단 경로 3칸, Tower 위면 +1 [P]',
  "Fool's deck 이동: 카드의 좌표가 Dragon 3x3의 가운데 칸이 되도록 배치(보드 밖이면 안쪽으로 보정) [해석, 확인 필요]",
  '"The Dragon moves N spaces forward": 바라보는 방향으로 한 칸씩. Board Edge에 걸리면 일반 이동 규칙대로 가장자리를 따라 계속 이동(처음에 기사가 더 적은 쪽으로)',
  'Zone 도식: Bile Vomit = 정면에서 넓어지는 삼각형 3줄, Tail Lash = 정면 3칸. Black Hole "All spaces in front" = Dragon의 앞쪽 호 전체',
  'Command of the Famishing: 모두 회피하면 Called by the Heavens 획득과 "[P]만큼 [V] 손실"도 없음. 이동과 [P] 획득은 명중 수에 따름',
  'Madness of the Famishing: 명중 시 일어나서 가장 가까운 다른 기사 쪽으로 Speed만큼 이동, 인접하면 Knight Power dice를 3번 굴려 나온 기호 수만큼 그 기사가 [V] 손실 + Peril Check [해석, 확인 필요]',
  'Lumbering: 기사의 Pushback / Knockback / Drag / Pull은 Dragon에 무효. Hungry Chomp·Fearsome Feast: 그 공격에서 Shield를 active Weapon으로 선언했으면 버림. Snatch \'n\' Snap 2 hits: Hand 슬롯 1개 비활성 — 넘치는 Weapon은 골라서 버림. World Eater 1+ hit: Talent 카드 버림(Clash 종료까지). Inescapable Maw: Devoured 기사는 이 Clash 동안 되살리는 효과의 대상이 아님(Bottomless Stomach Critical 제외)',
  '미구현: Exhibition Clash (항상 Full Clash)',
 ]}
# The whole Young Devour Dragon sheet was checked by the owner on 2026-11-21
import re
OK = ' (소유자 확인 2026-11-21)'
d['rulings'] = [re.sub(r' ?\[해석, 확인 필요[^\]]*\]', '', r) for r in d['rulings']]
d['rulings'] = [r if '소유자 확인' in r else r + OK for r in d['rulings']]
d['clashSetup']['notes'] = [re.sub(r' ?\[해석, 확인 필요[^\]]*\]', OK, x) for x in d['clashSetup'].get('notes', [])]
import reactfix; reactfix.apply('young-devour-dragon', d)
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
