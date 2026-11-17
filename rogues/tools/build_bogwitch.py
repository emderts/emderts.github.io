# Builds data/monsters/bog-witch.json (Vassal Clash) from docs/transcriptions/bog_witch_raw.json (owner scans 2026-11-17) + hand-written ops
# + Clash Setup (expansion Codex p.60). Usage: python3 tools/build_bogwitch.py data/monsters/bog-witch.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/bog_witch_raw.json')); S = raw['sheet']; CS = raw['clashSetup']
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; ON = lambda *ops: [{'op': 'bwOnHit', 'then': list(ops)}]; PH = lambda *ops: {'op': 'bwPerHit', 'then': list(ops)}
POIS = lambda n: {'op': 'bwPoison', 'n': n}; TOX = lambda n: {'op': 'bwToxify', 'n': n}; COND = lambda i: {'op': 'condition', 'id': i}; STRAY = lambda n: {'op': 'bwStray', 'n': n}; HEAT = lambda n: {'op': 'bwHeat', 'n': n}
HITS = lambda gte, then, lt=None: {'op': 'bwIfHits', 'gte': gte, 'lt': lt, 'then': then}; BOG = {'op': 'bwBogMove'}; SQ = {'op': 'bwSquare'}
HD = lambda g: {'op': 'evasionDice', 'stat': 'heat', 'gte': g, 'n': 1}; KING = {'op': 'bwKing', 'stat': 'never', 'gte': 0}
NH = ['Knight without a Hex card', 'Highest [Heat]']; HH = ['Highest [Heat]']
AI = {
 'Fiendish Cackle': dict(judge=['Bravery', 'Insight'], targeting=NH, bog=1, effects=ON(PH(HEAT(1)), V(3))),
 'Broom Sweep': dict(targeting=NH, bog=1, gates=[{'op': 'bwStray4', 'stat': 'heat', 'gte': 3}], effects=ON(V(2), PH(POIS(1)), {'op': 'bwStray', 'n': 2, 'gated': 4})),
 'Mire of the Cursed': dict(targeting=HH, bog=1, square=True, effects=ON(POIS(2), V(1))),
 'Ancestors’ Memories': dict(judge=['Fortitude', 'Might'], targeting=NH, bog=1, gates=[KING], effects=ON({'op': 'bwTable', 'table': [4, 6]}, HITS(2, [STRAY(3)]))),
 'Manifest Hex': dict(targeting=NH, bog=1, effects=ON({'op': 'knockback', 'n': 3}, V(2))),
 'Vile Soup Spill': dict(targeting=HH, bog=1, square=True, effects=ON(COND('Slimed'), POIS(1), V(2))),
 'Witchfire Stove': dict(judge=['Bravery', 'Insight'], targeting=HH, bog=1, square=True, gates=[KING], effects=ON(PH(HEAT(1)), COND('Slimed'), V(2))),
 'Spice Up': dict(targeting=NH, bog=1, effects=ON(TOX('level'), V(3))),
 'Elixir Fling': dict(targeting=HH, bog=1, square=True, gates=[{'op': 'bwDrownInstead', 'stat': 'heat', 'gte': 4}], effects=ON(POIS(3), {'op': 'bwSlimed'}, V(2))),
 'Hex of the First': dict(judge=['Fortitude', 'Might'], targeting=NH, bog=3, gates=[KING], effects=ON(V(3), COND('Slimed'))),
 'Wisped': dict(targeting=NH, bog=1, gates=[HD(2)], effects=ON(V(2), PH(STRAY(1)))),
 'Birds of Carrion': dict(type='zone', targeting=['Carrion Zone'], bog=1, carrion=True, effects=ON(V(2), POIS(2))),
 'Child Eater': dict(judge=['Bravery', 'Insight'], targeting=NH, bog=1, doomed=True, gates=[KING], effects=ON({'op': 'bwTable', 'table': [11]}, HITS(2, [COND('Panicked')]), STRAY(4))),
 'Anthropophagy': dict(targeting=['Knight with the Poisoned or Toxified Condition card', 'Highest [Heat]'], bog=0, pull=True, effects=ON(TOX(4), HITS(2, [{'op': 'bwDie'}]))),
 'Mudcurse': dict(targeting=['All Knights'], bog=0, doomed=True, gates=[HD(2)], effects=ON(COND('Drowning'), {'op': 'bwNote', 'text': 'Mudcurse: "Reset your [H]! to your Maximum [V] threshold" — 문구 미확인, 미구현'}, STRAY(6))),
 'Sins of the Ancestors': dict(judge=['Fortitude', 'Might'], targeting=['Knight with a Hex card', 'Highest [Vigor]', 'Highest [Heat]'], bog=1, gates=[KING], effects=ON({'op': 'bwTable', 'table': [11]}, COND('Drowning'))),
 'Diableric Expulsion': dict(targeting=NH, bog=1, gates=[{'op': 'difficultyInstead', 'stat': 'heat', 'gte': 3, 'n': 10}], effects=ON(V(3), {'op': 'knockback', 'n': 5})),
 'The Bog Cometh Alive': dict(type='zone', targeting=['Zone 2 around every Terrain tile'], bog=1, zoneAroundTile={'tile': '*', 'z': 2}, effects=ON(V(2)), afterFinalAttack=[{'op': 'bwSwampMiddle'}]),
}
SIG = dict(targeting=['Lowest [Heat]'], bog=0, gates=[HD(3)], effects=ON(V(2), PH(HEAT(1)), HITS(1, [COND('Slimed')], lt=3), HITS(3, [COND('Drowning')])))
DH = {'op': 'bwDiscardHex'}; DHP = {'op': 'bwDiscardHex', 'party': True}; DIS = lambda t: {'op': 'bwDisable', 'type': t}
PTBA = [{'op': 'bwPriority'}, {'op': 'bonusAttack', 'who': 'self', 'optional': True}]
BP = {
 'A Bundle of Elixirs': dict(wound=[COND('Slimed')], fail=[POIS(2)], critical=[{'op': 'bwDiscardCondition', 'who': 'any'}]),
 'Giant Leeches': dict(instinct=[POIS(2), HEAT(2)], critical=[{'op': 'bwDiscardCondition', 'who': 'any', 'ids': ['Poisoned', 'Toxified']}]),
 'Flayed Skull Amulets': dict(wound=[DH], fail=[BOG, STRAY(2)], critical=[DH, DIS('Mortal Fault')]),
 'Idolatrous Athame': dict(wound=[DH], fail=[STRAY(3)], critical=[DH, DIS('Eternal Pain')]),
 'Warped Lifeless Hand': dict(wound=[{'op': 'pushback', 'n': 3}, BOG, DH], fail=[HEAT(2)], critical=[DH] + PTBA),
 'Putrid Roots': dict(wound=[BOG, STRAY(2)], fail=[POIS(3)], critical=[{'op': 'scavenge', 'n': 2}]),
 'Witch’s Poppet': dict(wound=[DH], fail=[STRAY(4)], critical=[DH, DIS('Master’s')]),
 'Rotten Stump': dict(wound=[COND('Slimed')], fail=[TOX(2), BOG], critical=[{'op': 'scavenge', 'n': 3}]),
 'Bedeviled Nithing Staff': dict(wound=[DH], fail=[HEAT(2), STRAY(3)], critical=[DH, DIS('Party')]),
 'Bog-Devoured Carcass': dict(wound=[{'op': 'pushback', 'n': 3}, BOG], fail=[POIS(3)], critical=[{'op': 'bwPlaceAnywhere'}]),
 'Feathered Serpent Talisman': dict(wound=[DHP], fail=[{'op': 'bwLose', 'vigor': 3, 'heatLimit': 2, 'passion': 1}], critical=[DHP, DIS('Bad Luck')]),
 'Dead Eyes': dict(wound=[STRAY(3)], fail=[POIS(2), BOG], critical=[{'op': 'additionalSingleWound'}]),
 'Dried Meat Amulet': dict(wound=[{'op': 'bwDiscardHex', 'who': 'any'}, STRAY(5)], fail=[{'op': 'pushback', 'n': 5}, BOG], critical=[{'op': 'bwDiscardHex', 'who': 'any'}, DIS('Tongue-Tied')]),
 'A Long Lost Child': dict(mayEnd=True, wound=[{'op': 'bwExhaustWeapon'}, HEAT(4)], fail=[COND('Panicked'), {'op': 'bwHeatLimitTo', 'n': 1}], critical=PTBA),
 'Taproot of Malice': dict(wound=[{'op': 'bwDiscardAllHexes'}], fail=[TOX(3), HEAT(4), STRAY(5)], critical=[{'op': 'slayMonster'}]),
 'Still Heart': dict(fail=[TOX(4), HEAT(2)], critical=PTBA),
 'Rotten Guts': dict(instinct=[TOX(3), BOG], critical=[{'op': 'disableTrait', 'id': 'One with the Bog'}]),
 'Talisman of the Ancients': dict(wound=[DHP, STRAY(3)], fail=[COND('Drowning'), BOG], critical=[DHP, DIS('Omen')]),
}
def ai(c, spec, sig=False):
    c = copy.deepcopy(c); spec = dict(spec); bog = spec.pop('bog', 0); before = [BOG] * bog + ([{'op': 'bwPullAdjacent'}] if spec.pop('pull', False) else []) + ([SQ] if spec.pop('square', False) else []) + ([{'op': 'bwCarrion'}] if spec.pop('carrion', False) else [])
    ops = {'targeting': spec.pop('targeting'), 'move': False, 'range': 'unlimited', 'gates': spec.pop('gates', []), 'before': [], 'beforeAttack': before or None, 'effects': spec.pop('effects'), 'afterAttack': None, 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'judgement' if spec.get('judge') else 'attack'); ops.update(spec)
    if c.get('hex'): ops['hex'] = c['hex']; c['effects'] = list(c['effects']) + [f"[{c['hex']['type']}] {c['hex']['name']}: {c['hex']['text']}"]
    c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; oc = c['overcome']; ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': [{'op': 'power', 'n': 1}]} if oc else None}
    for k in ('wound', 'fail', 'instinct', 'critical', 'mayEnd'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI', 'traitsAdd': v['traitsAdd'], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
d = {
 'id': 'bog-witch', 'name': 'Bog Witch', 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'],
 '_source': 'Monster Sheet (2 pages), AI (with Hexes)/BP/Routine card sheet, Signature card — owner scans 2026-11-17; reference sheet Bog Witch v1.3; Clash Setup: expansion Codex p.60',
 'footprint': {'size': 4, 'shape': '2x2', 'rear': 'the 2 cells directly behind the footprint', 'blindspots': 'both rear cells', 'weakspots': 'the cell to the left and the cell to the right of the front row', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 4}, {'name': 'Blindspot'}, {'name': 'Weakspots'}, {'name': 'Ignore Difficult Terrain'}],
 'levels': levels, 'traits': [{**{k: v for k, v in t.items() if k != 'track'}, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG, True),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'bwRoutine'}]}},
 'bw': {'track': ['Swamp', 'Mud Wisp', 'Rotten Stump']},
 'clashSetup': {'_source': 'Expansion Codex p.60 (Bog Witch Clash)', 'steps': CS['steps'], 'requiredTiles': CS['requiredTiles'], 'monsterCells': CS['monsterCells'], 'facing': 'N',
  'knightStart': CS['knightStart'], 'terrain': [{'tile': t['tile'], 'cells': t['cells']} for t in CS['terrain']], 'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Level 3 Vigor 보너스: 시트 인쇄대로 +4 (참고 시트 v1.3은 "Q&A: +1") [해석, 확인 필요]',
  'Bog Move — Target은 그 공격의 대상(여럿이면 먼저 해결하는 기사) 또는 공격자. Swamp: Witch 밑에 2x2 Swamp를 놓고 Target에서 가장 먼 Swamp 2x2 타일 위로 이동. Mud Wisp: Weakspot(W) 칸 하나에 Mud Wisp 마커(두 칸 다 가능하면 Target에 가까운 쪽 [해석, 확인 필요]), 그 뒤 Target 반대쪽으로 4칸(방향 유지). Rotten Stump: Witch 밑에 Rotten Stump 2x2를 놓고 Witch를 보드에서 제거(보드 밖에서도 공격 수행). 보드 밖일 때 Swamp/Mud Wisp/Rotten Stump의 "Witch 밑" 배치는 생략 [해석, 확인 필요]',
  'Hex Weaver: AI 카드를 해결한 뒤 그 카드의 대상이었던 기사(여럿이면 첫 대상) Knight Board에 놓음. 이미 Hexed면 Level이 같거나 낮은 쪽을 AI 버림 더미로 [해석, 확인 필요]. Party Hex는 한 명이라도 명중하면 Bog Witch Sheet에',
  'Range Zone Attack / Zone Judgement (Mire of the Cursed, Vile Soup Spill, Witchfire Stove, Elixir Fling): 카드 도식 = Target 칸과 그 주변 8칸(3x3) [해석, 확인 필요]',
  'Birds of Carrion "Carrion Zone": 카드 도식 = Witch를 중심으로 좌우 4칸·상하 2칸 직사각형 바깥의 모든 칸(∞). Witch가 보드 밖이면 보드 전체 [해석, 확인 필요]',
  'Doomed (Rulebook): 이 공격 동안 Heat를 써서 Evasion/Judgement를 재굴림할 수 없음',
  'Wispers of the Bog: Mud Wisp 주변 Zone 2 안의 기사는 자발적으로 Zone 밖으로 이동 불가. Mud Wisp 칸에 들어가면 이동을 멈추고 Witch를 그 칸을 포함하는 2x2 중 기사를 가장 많이 덮는 위치에 놓고 마커 제거. Stray X: Mud Wisp(없으면 가장 가까운 Terrain) 쪽으로 X칸 (자발 이동 취급)',
  'Talisman Hunt: Weakspot 칸에서 공격하면 BP를 뽑기 전에 BP 덱의 카드 한 장을 (앞면을 보지 않고) Level로 골라 맨 위에 놓을 수 있음 [해석, 확인 필요]',
  '"KING ▸ DIFFICULTY N+ INSTEAD" 게이트 (Judgement 5장): King 조건 미확인 — 미구현',
  'Anthropophagy 게이트 "[V] 4+ ▸ DOOMED": 판독 불확실 — 미구현',
  'Mudcurse "Reset your [H]! to your Maximum [V] threshold": 문구 미확인 — 미구현',
  'Hex "Morass Residue"(다른 기사를 대상으로 하는 키워드·능력 사용 불가), "Mouthful of Bog"(You cannot talk): 엔진에서 강제하지 않음 — 미구현',
  'Hex "Marsh Fumes": Heroic Arc 능력 전체를 사용할 수 없는 것으로 처리 [해석, 확인 필요]',
  'Hex "Slough Sickness" Poison Limit -1: Poison Limit 개념 미구현 (턴 시작 Poison 1만 적용)',
  'Hex "Beast of the Swamp": 영구 음수 Precision은 적용, 음수 Speed/Evasion 토큰과 10(Potential 1 무시)은 미구현',
  'Hex "Burden of the Fen": 그 기사 주변 Zone 1의 지형 없는 칸을 Swamp로 취급',
  'Cookie Crumbs: Monster Round 종료 시 토큰 3–5 Signature / 6–8 AI / 9+ Signature 후 AI',
  'A Long Lost Child "voluntarily end this Attack": Knighteater와 같은 방식 (Power Roll 전에 물음)',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
