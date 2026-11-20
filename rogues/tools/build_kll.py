# Builds data/monsters/king-laid-low.json (King Clash) from docs/transcriptions/king_laid_low_raw.json (owner scans 2026-11-19)
# + hand-written ops + Clash Setup (Sunken Kingdom Codex p.52–53). Usage: python3 tools/build_kll.py data/monsters/king-laid-low.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/king_laid_low_raw.json')); S = raw['sheet']
ICON = lambda s: s.replace('[H]', '[Heat]').replace('[P]', '[Passion]').replace('[V]', '[Vigor]')
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; HT = lambda *t: {'op': 'klHits', 'table': list(t), 'perilCheck': True}
D = lambda n, **k: {'op': 'klDrill', 'n': n, **k}; COND = lambda i, who='target': {'op': 'klCond', 'id': i, 'who': who}; KD = {'op': 'knockdown'}; RX = {'op': 'reactWindow', 'at': 'mid'}
G = lambda gte, **k: {'stat': 'heat', 'gte': gte, **k}; DIE1 = lambda gte: G(gte, op='evasionDice', n=1); FACE = [{'op': 'faceMostKnights'}]
GATED = lambda gte, *ops: {'op': 'gated', 'stat': 'heat', 'gte': gte, 'then': list(ops)}
def bzone(rows):
    blk = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch in '^>v<']; xs = [x for x, _ in blk]; ys = [y for _, y in blk]
    rel = lambda x, y: (x - max(xs), y - min(ys))
    return {'red': [rel(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == 'R'], 'yellow': [], 'step': None, 'block': True}
AI = {
 'Churning Charge': dict(gates=[G(4, op='ignoreReact')], effects=[V(3), RX, KD], afterAttack=[D(4, after=True)]),
 'Slime Stampede': dict(pathAttack=True, pre=FACE, gates=[G(3, op='klAlso', alsoOps=[COND('Slimed')])], effects=[V(2)], afterFinalAttack=[D(2, after=True)]),
 "Ancestors' Admonition": dict(judge=['Fortitude', 'Might'], gates=[G(4, op='doomed')], effects=[V(1), {'op': 'klIfHits', 'gte': 4, 'then': [COND('Distracted')]}]),
 'Tongue-Lashing': dict(judge=['Tenacity', 'Insight'], move=False, effects=[V(2)], afterAttack=[{'op': 'klPull', 'n': 4}]),
 'Slippery Slope': dict(type='zone', gates=[G(5, op='vigorPerHitInstead', n=2)], effects=[V(1)], afterFinalAttack=[D(4, after=True)], zone=['..RR', '>>RR', '>>RR', '..RR']),
 'Ankle-Biter': dict(gates=[G(3, op='evasionDice', n=1)], effects=[V(2)], afterAttack=[{'op': 'klMalePass'}]),
 "Malediction's Momentum": dict(klMomentum=True, beforeAttack=[{'op': 'klMomentum'}], effects=[V(2)], afterAttack=[D(3, after=True)]),
 'Floodstrike': dict(effects=[{'op': 'klKnockback', 'n': 5}, V(2)]),
 'The Sinking Sin': dict(gates=[G(5, op='klAlso', alsoOps=[{'op': 'choke', 'n': 3}])], effects=[V(2)], afterAttack=[{'op': 'klIfSwampAdj'}]),
 'Tongue Strike': dict(pre=FACE, gates=[DIE1(4)], effects=[D(2), COND('Slimed'), V(2)], afterAttack=[D(5, after=True)]),
 'Royal Decree': dict(judge=['Sagacity', 'Tenacity'], move=False, effects=[HT(5)], afterFinalAttack=[{'op': 'klSwapStats'}]),
 'Off With Your Head!': dict(judge=['Bravery', 'Sagacity'], effects=[HT(2, 5, 'die')], afterAttack=[GATED(4, D(5, after=True))]),
 'Scorn of the Swamplands': dict(judge=['Might', 'Fortitude'], move=False, jump=True, effects=[V(3)], afterAttack=[D(5, after=True)]),
 'Musk of Fear': dict(effects=[V(3), {'op': 'klIfHits', 'gte': 4, 'then': [COND('Dread')]}], afterAttack=[{'op': 'klSwapPV'}]),
 'Goring Charge': dict(gates=[G(6, op='klAlso', alsoOps=[{'op': 'klDiscardWeapon'}])], effects=[V(2), D(4)], afterFinalAttack=[{'op': 'klKnockbackUp'}]),
 'Swamp of Smothering': dict(gates=[DIE1(4)], effects=[HT(3, 6, 6, 10), COND('Drowning')], afterAttack=[GATED(5, D(6, after=True))]),
 'Mudflood Tsunami': dict(type='zone', move=False, jump=True, zoneAroundSelf=2, gates=[G(5, op='klAlso', alsoOps=[KD])], effects=[V(3), {'op': 'klIfHits', 'gte': 3, 'then': [{'op': 'choke', 'n': 3}]}], afterFinalAttack=[{'op': 'klFlipRuts', 'zone': 2}]),
 "True Love's Kiss": dict(gates=[{'stat': 'knockdown', 'op': 'doomed'}], effects=[HT(4, 'devour', 'devourHeal')], afterAttack=[{'op': 'klCenter'}]),
}
SIG = dict(pre=FACE, gates=[DIE1(4)], effects=[V(2), COND('Slimed')], afterAttack=[D(4, after=True)])
SIGA = {'op': 'signatureAgainstAttacker'}; BA = {'op': 'klMoveBonus', 'n': 0}; A = 'attacker'
BP = {
 'Slimy Skin': dict(oc=4, wound=[D(5)], fail=[{'op': 'klPull', 'n': 2, 'who': A}, COND('Slimed', A)], critical=[{'op': 'additionalSingleWound'}]),
 'Dirty Feet': dict(oc=3, fail=[D(4)], critical=[{'op': 'klFlag', 'id': 'autoHope'}]),
 'Mucus-Clogged Nostrils': dict(oc=4, wound=[{'op': 'klPull', 'n': 2, 'who': A}, RX, {'op': 'klDrag', 'n': 2}], fail=[{'op': 'loseVigor', 'n': 2}, COND('Slimed', A)], critical=[{'op': 'gainPassion', 'n': 1}]),
 'Contorted Hand': dict(oc=3, instinct=[D(4)], critical=[BA]),
 'Bejewelled Skull': dict(op=3, top=[{'op': 'klOtherMove', 'n': 3}], wound=[D(5)], fail=[{'op': 'klRutAdj', 'who': A}], critical=[{'op': 'klTempEvasion'}]),
 'Malformed Jaw': dict(op=2, top=[{'op': 'klOtherMove', 'n': 2}], wound=[COND('Slimed', A)], fail=[{'op': 'klDrag', 'n': 2}], critical=[{'op': 'klScavenge', 'n': 1}]),
 'Royal Signet': dict(oc=6, wound=[{'op': 'signature'}], fail=[D(5)], critical=[{'op': 'klMoveBonus', 'n': 3}]),
 'Vile Tongue': dict(oc=5, instinct=[D(6)], critical=[{'op': 'klFlag', 'id': 'noCumbersome'}]),
 'Toad-Like Hind Leg': dict(oc=5, wound=[D(5)], fail=[{'op': 'klPull', 'n': 2, 'who': A}, KD], critical=[{'op': 'klRemoveTiles', 'n': 3}]),
 'Hunched Back': dict(op=3, top=[{'op': 'klOtherMove', 'n': 3}], wound=[{'op': 'klCenter'}], fail=[{'op': 'klPull', 'n': 2, 'who': A}, {'op': 'klDrag', 'n': 3}], critical=[{'op': 'klFlag', 'id': 'rutHeal'}]),
 'Torn Cape': dict(op=2, top=[{'op': 'klOtherMove', 'n': 2}], instinct=[{'op': 'klRutAdj', 'who': 'king'}, RX, {'op': 'klPull', 'n': 2, 'all': True}], critical=[{'op': 'klSpeed'}]),
 'Mud-Filled Lung': dict(op=3, top=[{'op': 'klDiscardCond'}], wound=[D(5)], fail=[{'op': 'klDrag', 'n': 3}, COND('Slimed', A)], critical=[{'op': 'klVP', 'elsePassion': 2}]),
 'Sky-Starved Face': dict(oc=6, wound=[D(7), COND('Drowning', A)], fail=[SIGA], critical=[{'op': 'klOtherMove', 'n': 5, 'bonus': True}]),
 'Hateful Tumor': dict(oc=7, instinct=[{'op': 'klAI'}], critical=[{'op': 'slayMonster'}]),
 'Mud-Stained Abdomen': dict(oc=6, wound=[{'op': 'klDiscardWeapon', 'who': A, 'active': True, 'orHeat': 3}], fail=[D(5), D(5)], critical=[{'op': 'klFlipSwamps'}]),
 'Throne of a Defiled Nation': dict(op=2, top=[{'op': 'klCritWound'}], wound=[RX, D(6, random=5)], fail=[{'op': 'judicium'}], critical=[{'op': 'klThrone'}]),
 'Golden Crown': dict(op=2, top=[{'op': 'klOtherMove', 'n': 2, 'count': 2}], instinct=[{'op': 'klFlipRuts'}], critical=[{'op': 'klFlag', 'id': 'drillDown'}]),
 'Scepter of Smothered Ages': dict(op=2, top=[{'op': 'klOtherMove', 'n': 3, 'count': 2}], wound=[{'op': 'klPull', 'n': 3, 'all': True}, D(7)], fail=[COND('Drowning', A)], critical=[{'op': 'klMaleDiscard'}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('tag') or ''; c['targeting'] = [ICON(t) for t in c['targeting']]; z = spec.pop('zone', None); notes = spec.pop('notes', [])
    ops = {'targeting': spec.pop('targeting', c['targeting']), 'move': spec.pop('move', 'MOVE' in tag), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'attack'); c['moveTag'] = tag; c['evasionDice'] = c['evasionDice'] if isinstance(c['evasionDice'], int) else 0; ops.update(spec)
    if z: ops['zoneDiagram'] = bzone(z)
    c['afterAttack'] = (c['afterTag'] + ': ' + c['after']) if c.get('after') else None; c['notes'] = notes; c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; n = spec.get('oc') or spec.get('op')
    ops = {'at': c['at'], 'overcome': {'n': n, 'kind': 'overpower' if 'op' in spec else 'overcome', 'ops': spec.get('top') or [{'op': 'power', 'n': 1}]}}
    c['overcomeTag'] = 'OVERPOWER' if 'op' in spec else 'OVERCOME'; c['overcome'] = {'n': n, 'effect': (c.get('top') or '').split(': ', 1)[-1]}
    c['responses'] = {k: c.get(k) for k in ('wound', 'fail', 'instinct', 'critical')}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI + Signature', 'traitsAdd': v['traitsAdd'], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
T = lambda tile, *cells: {'tile': tile, 'cells': list(cells)}
d = {'id': 'king-laid-low', 'name': S['name'], 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'], '_source': 'Owner scans 2026-11-19; Clash Setup: Sunken Kingdom Codex p.52–53',
 'footprint': {'size': 4, 'shape': '2x2', 'rear': 'the 2 cells directly behind the footprint', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 4}, {'name': 'Blindspot'}, {'name': 'VP'}, {'name': 'Ignore Difficult Terrain'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': 'VP — ' + S['vp']['name'], 'level': 1, 'text': S['vp']['text'], 'implemented': True}],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'klRoutine'}]}},
 'kl': True,
 'clashSetup': {'_source': 'Sunken Kingdom Codex p.52–53 (The King Laid Low Clash)', 'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the King Laid Low miniature on the space designated on the diagram. Determine facing direction: look at the bottom card from the Minor Mortis deck and turn the Monster in the direction indicated by the arrow in the lower left corner.', 'Additional Setup: Start of Clash: A random Knight gains the Malediction (Dormant) card, found in the Condition deck.'],
  'requiredTiles': ['4x Rut 2x2', '2x Ruined Wall L', '1x Ruined Wall 1x4'], 'monsterCells': ['E7', 'E8', 'F7', 'F8'], 'knightStart': ['G6', 'G9', 'D6', 'D9'],
  'terrain': [T('rut', 'G4', 'G5', 'H4', 'H5'), T('rut', 'G11', 'G12', 'H11', 'H12'), T('rut', 'B5', 'B6', 'C5', 'C6'), T('rut', 'C10', 'C11', 'D10', 'D11'),
              T('ruined wall', 'I3', 'I4', 'I5', 'H3'), T('ruined wall', 'D2', 'C2', 'C3', 'C4'), T('ruined wall', 'B10', 'B11', 'B12', 'B13')],
  'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 (소유자 확인 2026-11-20)']},
 'rulings': [
  'Zone 도식: Slippery Slope = King 정면 4칸 폭 x 2칸 깊이로 읽음. Mudflood Tsunami = King 주변 Zone 2.',
  'Drill X: 대상에게 인접할 때까지 다가간 뒤(지그재그), 남은 칸은 그 기사 쪽으로 직진. 대상이 VP에 있으면 정면으로 X칸 직진. King이 들어간 칸의 기사는 즉시 Unavoidable Knockback Y (Lv1 3 / Lv2–3 4 / Lv4 5), Crash 없음. Drill이 끝나면 Ditch Digger(뒤쪽 빈 칸에 1x2 Rut), 그다음 가장 많은 기사 쪽으로 회전',
  'King이 Drill 중 Rut 타일 위로 들어가면 그 타일을 뒤집음 (Rut 지형 카드: "When a Monster moves onto this tile, flip it") — 어떤 이동이든 적용 (소유자 확인 2026-11-20)',
  'Rut/Swamp 뒤집기: Rut ↔ Swamp. Swamp 위에는 Rut을 놓을 수 없음(Ditch Digger). 처음 배치된 2x2 Rut은 타일 단위로 뒤집힘',
  'Malediction 카드: 턴 시작에 뒤집힘(Dormant ↔ Manifested). Manifested: 공격 불가, 이동 중 Swamp 무시, 몬스터 공격의 명중당 추가 -1 [V](공격 효과를 모두 적용한 뒤 한 번에 잃음). 인접 기사에게 프리 액션으로 넘기면 Dormant 면으로 넘어감',
  'VP(Misshapen Hump): Wound Stack에 Wound 6개 이상이면 생성. Climb = 몬스터에 인접한 기사의 프리 액션(턴당 1회), Insight 7+ (실패 시 Slimed). VP 위 기사: +1 [Power], 몬스터 시야·Zone 밖, Knockdown이나 비자발 이동을 받으면 먼저 인접 칸으로 Displace. 내려오기 = Move action을 써서 몬스터 인접 칸으로',
  'Bridle: Response나 After Attack의 Drill 직전에 VP 기사가 Heat +2로 Drill 4를 원하는 방향으로 직진시킬 수 있음',
  'Putrid Penance: 기사의 공격으로 늘어난 Wound 수만큼 토큰. 4개 이상이면 현재 행동을 마친 뒤 모두 버리고 Signature',
  'Shallow Grave: Pushback/Knockback/Pull/Drag가 Rut 위에서 끝나면 타일을 뒤집고 그 기사 사망',
  'Guilt of Generations: Malediction을 가진 기사가 Move action을 마치면 인접한 빈 칸에 1x2 Rut (위치는 플레이어 선택)',
  'Shrug It Off (Lv4): Rut·Blindspot·VP 밖에서 공격하면 Power Roll의 Potential을 모두 무시 (무시되는 기호를 Potential로 읽음)',
  "Malediction's Momentum: 주사위 수 = 이동 전 대상과 King 사이의 칸 수(1~5)",
  'Royal Decree: Heat가 가장 높은 기사 2명(동률은 플레이어 선택 — 소유자 확인 2026-11-20). 둘 다 살아 있으면 [P]·[H]·[V] 교환 (최대치 초과분은 잘림)',
  "True Love's Kiss: 2회 명중 = Devoured(사망), 3회 이상 = Devoured + Heal 1(Wound Stack 맨 위 1장 제거)",
  'Burden of the Past(Routine): VP 기사는 Displace 후 Unavoidable Knockback 5, 무작위 기사 밑에 1x2 Swamp(위치 선택), Escalate 1',
  'AI·BP 카드 전사 확인 완료 (소유자 확인 2026-11-20): Churning Charge 게이트 = "H4+: Ignore all REACT! windows", Ankle-Biter 게이트 = "H3+: +1 Evasion die", Throne of a Defiled Nation Wound = REACT! 창 뒤 Drill 6',
  'Slimy Throne: Critical 시 빈 칸(미니어처·Terrain 없음)에 배치. 타일 위 기사는 Blindspot 취급, free action으로 Tenacity 4+ 테스트(성공: 타일과 기사를 Terrain 없는 빈 칸으로 / 실패: Slimed). King Laid Low 전체 확인 완료 (소유자 확인 2026-11-20)',
 ]}
# The whole King Laid Low sheet (AI, BP, traits, setup, rulings) was checked by the owner on 2026-11-20
OK = ' (소유자 확인 2026-11-20)'
d['rulings'] = [r if '소유자 확인' in r else r + OK for r in d['rulings']]
import reactfix; reactfix.apply('king-laid-low', d)
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
