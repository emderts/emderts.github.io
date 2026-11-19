# Builds data/monsters/devil-of-the-ancient-dusk.json (Devil Clash) from docs/transcriptions/devil_of_the_ancient_dusk_raw.json
# + hand-written ops + Clash Setup (Sunken Kingdom Codex p.54–55). Usage: python3 tools/build_dad.py data/monsters/devil-of-the-ancient-dusk.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/devil_of_the_ancient_dusk_raw.json')); S = raw['sheet']
ICON = lambda s: s.replace('[H]', '[Heat]').replace('[P]', '[Passion]').replace('[V]', '[Vigor]')
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; HT = lambda *t, peril=True: {'op': 'dadHits', 'table': list(t), 'perilCheck': peril}
K = lambda op, who='target', **kw: {'op': 'dadK', 'k': {'op': op, **kw}, 'who': who}; BANE = lambda n, who='target': K('bane', who, n=n); HEAT = lambda n, who='target': K('gainHeat', who, n=n)
COND = lambda i, who='target', **kw: {'op': 'dadCond', 'id': i, 'who': who, **kw}; KD = {'op': 'knockdown'}; DEL = lambda who='target': {'op': 'dadDeluge', 'who': who}
G = lambda gte, stat='heat', **k: {'stat': stat, 'gte': gte, **k}; DIE1 = lambda gte: G(gte, op='evasionDice', n=1); PG = lambda gte, *ops: G(gte, 'passion', op='dadAlso', alsoOps=list(ops)); HG = lambda gte, *ops: G(gte, op='dadAlso', alsoOps=list(ops))
GATE = lambda stat, gte, *ops: {'op': 'dadGate', 'stat': stat, 'gte': gte, 'then': list(ops)}; SW = {'op': 'dadSwampwalk'}; PUSH = lambda n, who='target': {'op': 'dadPush', 'n': n, 'who': who}
CENTER = {'op': 'dadCenter'}; EXP = COND('Exposed'); SL = COND('Slimed'); DR = COND('Drowning'); TOX = lambda n: K('toxify', n=n)
def bzone(rows):
    blk = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch in '^>v<']; xs = [x for x, _ in blk]; ys = [y for _, y in blk]
    return {'red': [(x - max(xs), y - min(ys)) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == 'R'], 'yellow': [], 'step': None, 'block': True}
FRONT = {'red': [(f, l) for f in range(1, 14) for l in range(-12, 14)], 'yellow': [], 'step': None, 'block': True}
EXPT = ['Each Knight with the Exposed Condition card, starting from the closest']
AI = {
 'Snake Bite': dict(sw=True, effects=[K('poison', n=2), V(5), BANE(2)], afterAttack=[GATE('heat', 4, PUSH(3))]),
 'Join the Dead': dict(sw=True, gates=[DIE1(5), HG(4, KD)], effects=[HT(4, 9, 13), HEAT(2)], afterAttack=[PUSH(3)]),
 'Toss Away': dict(sw=True, gates=[DIE1(5)], effects=[V(3), PUSH('hits')], afterAttack=[CENTER]),
 'Tail Thrust': dict(gates=[DIE1(4)], effects=[V(4), {'op': 'dadHeatPerHit'}, EXP], afterAttack=[COND('Slimed', ifAdjacent=True)]),
 'Savage Swing': dict(type='zone', move=False, targeting=['Zone'], pre=[{'op': 'dadFaceClosest'}], beforeAttack=[{'op': 'dadDestroyZone'}], gates=[PG(3, KD)], effects=[V(4), EXP, BANE(1)], zone=['..RRR', '..RRR', '>>RRR', '>>RRR', '..RRR', '..RRR']),
 'Sink or Swim': dict(judge=['Tenacity', 'Insight'], move=False, gates=[G(4, op='difficultyInstead', n=10)], effects=[BANE(1), V(3), {'op': 'dadDestroyNear', 'perHit': True}], afterAttack=[GATE('heat', 4, SL)]),
 'Sideswipe': dict(sw=True, gates=[DIE1(5)], effects=[BANE(1), V(4)], afterAttack=[{'op': 'knockbackSide', 'n': 5}]),
 'Drag to the Depths': dict(judge=['Fortitude', 'Tenacity'], move=False, gates=[DIE1(5)], effects=[V(5), DEL(), HEAT(3)], afterAttack=[KD, CENTER]),
 'Devilish Embrace': dict(sw=True, gates=[DIE1(3)], effects=[HT({'v': 6, 'then': [TOX(1)]}, {'v': 9, 'then': [TOX(2), SL]}, {'v': 11, 'then': [TOX(4), DR]})], afterAttack=[GATE('passion', 3, KD)]),
 'Tail Pierce': dict(type='zone', gates=[DIE1(5), PG(4, KD)], effects=[HT(7, 10, 15, peril=False), BANE(1)], afterAttack=[DEL()], zone=['>>RR', '>>RR']),
 'Sunder Foundations': dict(type='zone', move=False, beforeAttack=[SW, {'op': 'dadDestroyZone'}], gates=[G(3, 'passion', op='vigorPerHitInstead', n=5)], effects=[V(4), {'op': 'dadHeatPerHit'}], afterAttack=[EXP, GATE('passion', 3, KD)], zone=['RRRRR', 'RRRRR', '>>RRR', '>>RRR', 'RRRRR', 'RRRRR']),
 'Crushing Grasp': dict(gates=[G(3, 'passion', op='dadFlatInstead', n=10)], effects=[HT(8, 8), {'op': 'dadIfHits', 'gte': 2, 'then': [KD]}, BANE(1), EXP, SL], afterAttack=[DEL()]),
 'Nudge of the Finger': dict(effects=[BANE(1), V(4), PUSH('heat')], afterAttack=[DEL()]),
 'Manic Mudslide': dict(targeting=EXPT + ['No Target: Perform Signature'], beforeAttack=[{'op': 'dadNoCrash'}], gates=[G(6, op='difficultyInstead', n=10)], effects=[HT(7, {'v': 9, 'then': [HEAT(2), EXP]}, {'v': 13, 'then': [EXP, DR]})], afterAttack=[DEL()]),
 'Back to Your Fathers!': dict(judge=['Bravery', 'Sagacity'], sw=True, effects=[{'op': 'dadFool'}, {'op': 'dadK', 'k': {'op': 'perilCheck'}}]),
 'The Oldest Trick': dict(type='zone', sw=True, gates=[G(5, 'passion', op='vigorPerHitInstead', n=5)], effects=[V(4), DR, EXP], afterAttack=[GATE('heat', 4, KD)], zone=['>>RRR', '>>RRR']),
 'Ravening Mire': dict(type='zone', move=False, targeting=['Zone'], beforeAttack=[{'op': 'dadDestroyZone'}], gates=[HG(8, SL)], effects=[V(3), {'op': 'dadHeatPerHit'}], zoneRaw=FRONT),
 'Ritual Macabre': dict(targeting=EXPT + ['Closest Knight in sight'], sw=True, swNoCrash=True, gates=[DIE1(6)], effects=[{'op': 'dadRitual'}], afterAttack=[{'op': 'dadGrave'}]),
}
SIG = dict(move=False, jump=True, type='zone', gates=[DIE1(5)], effects=[V(3), HEAT(2)], afterAttack=[DEL()], zone=['>>R', '>>R'])
SIGA = {'op': 'signatureAgainstAttacker'}; A = 'attacker'; RET = lambda n: [DEL(A), {'op': 'dadRetreat', 'n': n}]; BA = lambda n=0: {'op': 'dadMoveBonus', 'n': n}; FLAG = lambda i: {'op': 'dadFlag', 'id': i}
BP = {
 "Devil's Foot": dict(wound=[COND('Exposed', A)], fail=[KD], critical=[{'op': 'dadDiscardExposed'}]),
 'Visage of the Endless': dict(instinct=[COND('Slimed', A)], fail=[{'op': 'loseVigor', 'n': 3}], critical=[BA()]),
 'Honed Abs': dict(wound=[HEAT(2, A), BANE(1, A)], fail=[COND('Distracted', A)], critical=[{'op': 'dadBaneOff', 'all': True, 'n': 2}]),
 'Amulet of Beginnings': dict(nb=True, wound=RET(1), fail=[{'op': 'dadDestroyNear', 'who': A}], critical=[FLAG('softPush')]),
 'Uncovered Back': dict(nb=True, rear=True, wound=[KD, PUSH(2, A)], critical=[BA()]),
 'Golden Bracers': dict(wound=RET(1), critical=[{'op': 'dadHeatOff', 'n': 3}]),
 'Serpent-Nest Crown': dict(nb=True, wound=[HEAT(3, A)], fail=[K('toxify', A, n=4)], critical=[BA(3)]),
 'Stolen Countenance': dict(wound=RET(2), fail=[{'op': 'dadPullEdge', 'n': 2}], critical=[{'op': 'monsterModifier', 'stat': 'toHit', 'n': -1}]),
 'Leering Pelvis Guard': dict(wound=[COND('Exposed', A)], fail=[PUSH(4, A)], critical=[{'op': 'dadScavenge', 'n': 1}]),
 'Pearl White Ribcage': dict(wound=RET(2), fail=[COND('Slimed', A)], critical=[FLAG('free')]),
 'Tail End': dict(instinct=[COND('Exposed', A)], fail=[COND('Slimed', A)], critical=[FLAG('slowSwamp')]),
 "The Deal-Taker's Razor": dict(wound=[{'op': 'loseVigor', 'n': 3}, HEAT(2, A)], fail=[SIGA], critical=[{'op': 'monsterNegPrecision', 'permanent': True}]),
 'Oozing Heart': dict(wound=[{'op': 'dadBaneOff', 'n': 1, 'force': True}], instinct=RET(3), critical=[{'op': 'slayMonster'}]),
 'Your Deepest Desire': dict(wound=[DEL(A), {'op': 'choke', 'n': 3}, {'op': 'dadRetreat', 'n': 3}], fail=[COND('Exposed', A), HEAT(2, A)], critical=[{'op': 'dadScavenge', 'n': 1}, BA(3)]),
 'Rattling Body': dict(instinct=[{'op': 'dadDestroyNear', 'who': A, 'n': 3, 'far': True}], fail=[SIGA], critical=[{'op': 'dadReset'}]),
 '11th Finger': dict(wound=[DEL(A), HEAT(3, A), {'op': 'dadRetreat', 'n': 3}], fail=[COND('Drowning', A)], critical=[{'op': 'dadBaneOff', 'all': True, 'n': 'all', 'force': True}, FLAG('reveal')]),
 'Relic of an Age of Profanity': dict(relic=True, wound=[{'op': 'devote'}], fail=[{'op': 'judicium'}], critical=[{'op': 'devote'}, FLAG('rut')]),
 'History of the Past': dict(wound=[BANE(2, A)], fail=[KD, COND('Slimed', A)], critical=[{'op': 'dadHeatOff', 'all': True, 'reset': True}, BA()]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('tag') or ''; c['targeting'] = [ICON(t) for t in c['targeting']]; z = spec.pop('zone', None); zr = spec.pop('zoneRaw', None); sw = spec.pop('sw', False); nc = spec.pop('swNoCrash', False)
    ops = {'targeting': spec.pop('targeting', c['targeting']), 'move': spec.pop('move', (not sw) and 'MOVE' in tag), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    if sw: ops['beforeAttack'] = [{'op': 'dadSwampwalk', 'noCrash': nc}]
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'attack'); c['moveTag'] = tag; ops.update(spec)
    if z: ops['zoneDiagram'] = bzone(z)
    if zr: ops['zoneDiagram'] = zr
    c['afterAttack'] = (c['afterTag'] + ': ' + c['after']) if c.get('after') else None; c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; ops = {'at': c['at'], 'overcome': None, 'bargain': not spec.get('nb'), 'rearPower': bool(spec.get('rear')), 'relic': bool(spec.get('relic'))}
    c['responses'] = {k: c.get(k) for k in ('wound', 'fail', 'instinct', 'critical')}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI + Signature', 'traitsAdd': v['traitsAdd'], 'bonuses': {k: v['bonuses'].get(k, 0) for k in ('escalations', 'at', 'vigorLoss', 'evasionDice')}} for l, v in S['levels'].items()}
PAIR = lambda rows, l, r: {'rows': rows, 'left': l, 'right': r}
d = {'id': 'devil-of-the-ancient-dusk', 'name': S['name'], 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'], '_source': 'Owner scans 2026-11-19; Clash Setup: Sunken Kingdom Codex p.54–55',
 'footprint': {'size': 4, 'shape': '2x2', 'rear': 'the 2 cells directly behind the footprint', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 5}, {'name': 'Blindspot'}, {'name': 'Ignore Difficult Terrain'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG), 'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'dadRoutine'}]}},
 'dad': True,
 'clashSetup': {'_source': 'Sunken Kingdom Codex p.54–55 (Devil of the Ancient Dusk Clash)', 'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Devil of the Ancient Dusk miniature on the space designated on the diagram. Determine facing direction: look at the bottom card from the Minor Mortis deck and turn the Monster in the direction indicated by the arrow in the lower left corner.', "Additional Setup: Place the Fool's deck near the Monster Sheet."],
  'requiredTiles': ['Level 1: 15x Column, 10x Swamp 1x2', 'Level 2+: 14x Column, 10x Swamp 1x2'], 'monsterCells': ['E7', 'E8', 'F7', 'F8'], 'knightStart': ['H5', 'H10', 'C5', 'C10'], 'terrain': [],
  'dad': {'level1': {'pairs': [PAIR(['I', 'J'], 1, 14), PAIR(['G', 'H'], 1, 14), PAIR(['E', 'F'], 1, 14), PAIR(['C', 'D'], 1, 14), PAIR(['A', 'B'], 1, 14)], 'columns': ['J6', 'I4', 'I9', 'H2', 'H7', 'G11', 'F3', 'F13', 'E11', 'D12', 'C4', 'C8', 'B6', 'B10', 'A8']},
          'level2': {'pairs': [PAIR(['I', 'J'], 5, 13), PAIR(['G', 'H'], 3, 14), PAIR(['E', 'F'], 2, 13), PAIR(['C', 'D'], 1, 12), PAIR(['A', 'B'], 2, 10)], 'columns': ['J6', 'J11', 'I9', 'H4', 'H8', 'H12', 'F11', 'E4', 'D3', 'D11', 'C8', 'B6', 'B9', 'A4']}},
  'notes': ['Swamp 타일·Column·시작 칸은 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Zone 도식(작은 그림에서 읽음): Savage Swing = 정면 3칸 깊이 x 6칸 폭, Tail Pierce = 정면 2x2, Sunder Foundations = 정면 3칸 깊이 x 6칸 폭 + 양 옆, The Oldest Trick = 정면 3칸 깊이 x 2칸 폭, Ravening Mire = 정면 전체, Signature = 정면 2칸 [해석, 확인 필요]',
  'Primordial Soup: 행 2개마다 Swamp 타일 한 쌍. 타일과 그 바깥쪽 칸은 모두 Swamp로 취급(끝난 이동이 Swamp면 기존 Swamp 규칙대로 사망). Level 1은 양 끝 열(1·14), Level 2+는 도식의 계단 모양 배치',
  'Deluge: 대상(또는 공격자)이 있는 행의 타일 쌍 — 왼쪽 타일이 오른쪽으로 한 칸씩 가다가 Column을 만나면 파괴하고 그 자리에 멈춤, 아니면 맞닿을 때까지. 그다음 오른쪽 타일도 같은 방식. 물에 잠긴 기사는 즉시 Swamp 효과를 해결 [해석, 확인 필요]',
  'Swampwalk: Devil이 대상의 행, 대상에게 가까운 짧은 Board Edge(1열 또는 13–14열)에 나타난 뒤 대상에게 인접할 때까지 이동. 나타난 칸의 기사는 Crash + Displace [해석, 확인 필요]',
  "Devil's Bargain: Bane 1 → 장수를 정해 Fool's deck에서 뽑음 → 같은 글자 2장(한 쌍)마다 그 글자의 벌칙 → 뽑은 카드 2장마다 기사가 있는 행의 빈 칸에 Column 1개(위치 선택) → 버림. C 카드를 뽑았으면 버림 더미를 덱에 섞음. Bargain의 이득은 Column 배치(Deluge를 막음)로 이해함 [해석, 확인 필요]",
  'Bargain D: 그 공격에서 Wound 실패 + Power 6 이상이면 공격자 Knockdown [해석, 확인 필요]',
  'Stains of Profanity: Heat Limit 9. Peril Check 때 Heat 표(0–2 Minor / 3–5 Major / 6–8 Grave / 9 Judicium)와 Peril Arc 중 높은 쪽 사용',
  'Purple 게이트는 Passion 게이트로 처리 (드래곤 카드의 같은 아이콘으로 확인)',
  'Drag to the Depths: "For each hit lose -5 [V] and Deluge" — Deluge는 한 번만 수행 [해석, 확인 필요]',
  'Crushing Grasp: 명중 수와 무관하게 -8 [V] (Passion 3+면 -10) [해석, 확인 필요]',
  'Ritual Macabre: Bane 2 → -9 [V](Armor Roll 없음) → [V] 0이면 사망 → Heat +3 → Peril Check [해석, 확인 필요]',
  "Back to Your Fathers!: 명중당 Heat +1, Fool's deck 1장을 뽑아 그 글자의 벌칙을 바로 적용(D는 효과 없음), 뽑은 카드는 덱에 다시 섞음 [해석, 확인 필요]",
  'Relic of an Age of Profanity Critical: 모든 Swamp 칸이 Rut이 되고 Deluge 비활성',
  '미구현: 각 AI 카드의 REACT! 창 위치(Targeting 뒤 창만 공통 적용), Level 2+의 [Heat] 보너스 아이콘(의미 미확인)',
 ]}
import reactfix; reactfix.apply('devil-of-the-ancient-dusk', d)
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
