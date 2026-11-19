# Builds data/monsters/puppet-king-edelhardt.json (King Clash) from docs/transcriptions/puppet_king_edelhardt_raw.json
# + hand-written ops + Clash Setup (Principality of Stone Codex p.50–51). Usage: python3 tools/build_pke.py data/monsters/puppet-king-edelhardt.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/puppet_king_edelhardt_raw.json')); S = raw['sheet']
ICON = lambda s: s.replace('[H]', '[Heat]').replace('[P]', '[Passion]').replace('[V]', '[Vigor]')
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; K = lambda op, who='target', perHit=False, **kw: {'op': 'pkeK', 'k': {'op': op, **kw}, 'who': who, 'perHit': perHit}
KD = {'op': 'knockdown'}; RX = {'op': 'reactWindow', 'at': 'mid'}; SUB = lambda who='target': {'op': 'pkeSub', 'who': who}; SHOCK = {'op': 'pkeShock'}
KB = lambda n, **k: {'op': 'pkeKb', 'n': n, **k}; BANE = lambda n, who='target': K('bane', who, n=n); IFH = lambda gte, *ops: {'op': 'pkeIfHits', 'gte': gte, 'then': list(ops)}
G = lambda gte, **k: {'stat': 'heat', 'gte': gte, **k}; DIE1 = G(3, op='evasionDice', n=1); HG = lambda gte, *ops: G(gte, op='pkeAlso', alsoOps=list(ops))
RANGE = dict(move=False, range='unlimited')
def CMD(obey, obeyText, disobeyText, effects, after, gates=None):
    return dict(type='zone', move=False, command={'obey': obey, 'obeyText': obeyText, 'disobeyText': disobeyText}, effects=effects, afterFinalAttack=[after], gates=gates or [])
AFT = lambda need, **k: {'op': 'pkeCmdAfter', 'need': need, **k}
BEGONE = CMD([KB(6, voluntary=True)], 'Knockback 6', '명중당 -2 [V], 2회 이상 명중 시 Subjugated, Peril', [V(2), IFH(2, SUB())], AFT('all', shock=True))
AI = {
 'Dismissive Flick': dict(**RANGE, effects=[V(3), KB(6), KD], afterAttack=[SUB()]),
 'Dragged by the Ear': dict(**RANGE, gates=[DIE1, HG(6, KD)], effects=[V(3), K('gainHeat', perHit=True, n=1), {'op': 'pkeVPDisplace'}, RX], afterAttack=[KB(4)]),
 'Puppeteer': dict(move=False, judge=['Tenacity', 'Sagacity'], effects=[V(3), KB(5, dir='random')], afterAttack=[SUB()]),
 'The King Commands: Bow Down!': CMD([KD, BANE(2)], 'Knockdown, Bane 2', 'Subjugated, 명중당 -2 [V], Peril', [SUB(), V(2)], AFT('all', shock=True)),
 'The King Commands: Begone!': BEGONE,
 'Slap in the Face': dict(**RANGE, gates=[DIE1], effects=[V(5), KB(10, dir='side')], afterAttack=[{'op': 'condition', 'id': 'Distracted'}]),
 'Eye Poke': dict(**RANGE, effects=[V(5)], afterAttack=[{'op': 'pkeExhaust', 'mode': 'weaponOrHelm'}]),
 'Puppet Sword Dance': dict(type='zone', move=False, pkeZone='fk2', effects=[V(4)], afterFinalAttack=[SHOCK]),
 'The King Commands: Obey Me!': CMD([{'op': 'pkeExhaust', 'mode': 'all'}], '모든 Gear Exhaust', '명중당 -2 [V], Bane 1, Peril, Subjugated', [V(2), BANE(1), SUB()], AFT(2, zoneKD=2)),
 'The King Commands: Get Out of My Sight!': CMD([KB(8, voluntary=True), BANE(2)], 'Knockback 8, Bane 2', '명중당 -3 [V], Subjugated, Peril', [V(3), SUB()], AFT(2, shock=True)),
 'The King Commands: Entertain Me!': CMD([{'op': 'pkeEntertain'}], 'Speed만큼 이동해 가장 가까운 다른 기사를 Weapon 사거리에 넣고, 모든 Attack dice 명중으로 Power Roll — 그 기사가 Total Power만큼 [V] 손실', '명중당 -3 [V], Peril', [V(3)], AFT('all', targetsCond='Subjugated')),
 'Shadow Punch': dict(**RANGE, effects=[{'op': 'choke', 'n': 3}, V(4), RX, KD, KB(4, plusHits=True)]),
 'Crushing Burden': dict(**RANGE, gates=[DIE1], effects=[V(3), KD, {'op': 'pkeCrush'}], afterAttack=[{'op': 'pkeSpeedNeg'}]),
 'Marionette Massacre': dict(type='zone', move=False, pkeZone=4, gates=[G(3, op='vigorPerHitInstead', n=6)], effects=[V(5)]),
 'The King Commands: Yield!': CMD([{'op': 'pkeRestrainAll'}], 'Hand와 Cooldown의 모든 카드 Restrain', '명중당 -2 [V], Bane 3, Peril', [V(2), BANE(3)], AFT(2, targetsCond='Courage')),
 'The King Commands: Get Away From Me!': CMD([KB(10, voluntary=True), BANE(2)], 'Knockback 10, Bane 2', '명중당 -3 [V], Peril', [V(3)], AFT(1, shock=True), gates=[DIE1]),
 'The King Commands: Lay Down Your Arms!': CMD([{'op': 'pkeExhaust', 'mode': 'all'}], '모든 Gear Exhaust', '명중당 -3 [V], Bane 1, Peril', [V(3), K('bane', perHit=True, n=1)], AFT(2, shock=True), gates=[HG(3, KD)]),
}
TRAIT = CMD([{'op': 'pkeComeToMe', 'n': 4}, SUB()], 'King 쪽으로 직선 4칸 이동, Subjugated', '명중당 -2 [V], Peril', [V(2)], AFT('all', shock=True))
A = 'attacker'; ST = lambda where='outside2': {'op': 'pkeString', 'where': where}; OC = lambda n, power=0, armor=0, kind='overcome': {'n': n, 'kind': kind, 'ops': [{'op': 'pkeOvercome', 'power': power, 'armor': armor}]}
BONUS = {'op': 'pkeBonus'}; FKM = {'op': 'pkeFkMove', 'n': 1}; AIX = {'op': 'pkeAI'}; W1 = {'op': 'additionalSingleWound'}
BP = {
 'Heavy-Settled Crown': dict(oc=OC(2, 1), instinct=[SHOCK], critical=[{'op': 'pkeScavenge', 'n': 1}]),
 'Five Fingers: The Ring Finger': dict(instinct=[SHOCK, ST()], critical=[{'op': 'leaveTokens', 'n': 2, 'tokens': ['opening', 'break']}]),
 'Five Fingers: The Little Finger': dict(oc=OC(3, 1), wound=[SHOCK, ST()], fail=[SUB(A)], critical=[BONUS]),
 'Panzerthrone': dict(wound=[{'op': 'pkeRemoveColumn'}], fail=[FKM], critical=[{'op': 'pkeFlag', 'id': 'noFog', 'text': 'Dark Fog Trait 비활성'}]),
 'Feeble Chest': dict(oc=OC(2, 1), instinct=[{'op': 'loseVigor', 'n': 2, 'who': A}, KB(2, who=A)], critical=[W1]),
 'Cold Feet': dict(oc=OC(3, 1), instinct=[SHOCK], critical=[W1]),
 'Chaos Ladder': dict(oc=OC(4, 1, 1), wound=[{'op': 'pkeClimb'}], fail=[FKM], critical=[{'op': 'pkeBonus', 'autoBreak': 2}]),
 'Five Fingers: The Middle Finger': dict(oc=OC(5, 0, 2), wound=[KB(4, who=A), ST()], fail=[SHOCK], critical=[BONUS]),
 'Five Fingers: The Index Finger': dict(oc=OC(3, 0, 2), wound=[SHOCK, ST()], fail=[{'op': 'loseVigor', 'n': 3, 'who': A}, {'op': 'pkePrecNeg', 'who': A}], critical=[{'op': 'pkePrecision'}, BONUS]),
 'Shield of the Fallen': dict(oc=OC(5, 1, 1), wound=[{'op': 'pkeNote', 'text': 'Armor-piercing 1 (Wound Response) — 미구현'}], fail=[FKM], critical=[{'op': 'pkeScavenge', 'n': 2}]),
 'Shadowy Influence': dict(oc=OC(4, 1, 1), wound=[{'op': 'pkeRemoveColumn'}], fail=[FKM], critical=[{'op': 'pkeSigReduce', 'n': 2}]),
 'Heart of the Throne': dict(oc=OC(4, 1, 1), wound=[ST('any'), {'op': 'pkeNote', 'text': 'Armor-piercing 1 (Wound Response) — 미구현'}], fail=[AIX], critical=[BONUS]),
 'Fluchaura': dict(oc=OC(2, 1), instinct=[SUB(A)], critical=[{'op': 'pkeUnsub'}]),
 'Hoary Codger': dict(oc=OC(4, 2), instinct=[AIX], critical=[{'op': 'slayMonster'}]),
 'Five Fingers: Hidden Finger': dict(oc=OC(2, 2, 3), instinct=[{'op': 'pkeSignature'}, ST()], critical=[W1, BONUS]),
 'Five Fingers: The Thumb': dict(oc=OC(4, 3, 3), wound=[SHOCK, ST()], fail=[{'op': 'pkeAI', 'against': True}], critical=[W1]),
 'Riesenmörder Sword': dict(oc=OC(3, 1, 1), wound=[AIX], fail=[{'op': 'choke', 'n': 3}, {'op': 'condition', 'id': 'Panicked'}], critical=[{'op': 'pkeFlag', 'id': 'noShock', 'text': 'Shockwave Trait 비활성 — "Immediately see 2329" (스토리 항목, 미구현)'}]),
 'Strands of the Wyrd': dict(oc=OC(4, 0, 2), instinct=[{'op': 'pkeSignature'}], critical=[{'op': 'pkeScavenge', 'n': 2}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('tag') or ''; c['targeting'] = [ICON(t) for t in c['targeting']]
    ops = {'targeting': c['targeting'], 'move': spec.pop('move', False), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'attack'); c['moveTag'] = tag; ops.update(spec)
    c['afterAttack'] = (c['afterTag'] + ': ' + c['after']) if c.get('after') and c.get('afterTag') else c.get('after'); c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; ops = {'at': c['at'], 'overcome': spec.get('oc')}
    c['responses'] = {k: c.get(k) for k in ('wound', 'fail', 'instinct', 'critical')}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI + Signature', 'traitsAdd': v['traitsAdd'], 'bonuses': {k: v['bonuses'].get(k, 0) for k in ('escalations', 'at', 'vigorLoss', 'evasionDice')}} for l, v in S['levels'].items()}
tc = raw['traitCards']; ta = dict(tc[0]); ta.update({'level': 0, 'afterTag': None, 'tag': 'COMMAND', 'targeting': tc[0]['targeting']}); ta = ai(ta, TRAIT); ta['kind'] = 'traitAttack'
fk = tc[1]; fkbp = {'name': 'Fallen Knight', 'at': fk['at'], 'header': fk['header'], 'top': fk['top'], 'responses': {'wound': fk['wound'], 'fail': fk['fail'], 'critical': fk['critical']},
 'ops': {'at': fk['at'], 'overcome': {'n': 3, 'kind': 'overcome', 'ops': [{'op': 'power', 'n': 1}]}, 'wound': [{'op': 'pkeFkWound'}], 'fail': [K('parasitize', A, n=1)], 'instinct': None, 'critical': [{'op': 'pkeMind'}, {'op': 'pkeFkWound', 'crit': True}, {'op': 'pkeBonus', 'move': 2}]}}
T = lambda *cells: [{'tile': 'column', 'cells': [c]} for c in cells]
d = {'id': 'puppet-king-edelhardt', 'name': S['name'], 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'], '_source': 'Owner scans 2026-11-19; PKE reference v1.2 (owner); Clash Setup: Principality of Stone Codex p.50–51',
 'footprint': {'size': 4, 'shape': '2x2', 'rear': 'the 2 cells directly behind the footprint', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 5}, {'name': 'Blindspot'}, {'name': 'Always There'}, {'name': 'VP'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': {**raw['signature'], 'type': 'signature', 'ops': {'targeting': [], 'move': False, 'gates': [], 'before': [], 'effects': []}}, 'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'pkeRoutine'}]}},
 'traitAttack': ta, 'fallenKnight': {'bp': fkbp}, 'pke': True,
 'clashSetup': {'_source': 'Principality of Stone Codex p.50–51 (Puppet King Edelhardt Clash)', 'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Puppet King Edelhardt miniature on the space designated on the diagram. Note the facing direction indicated by the arrow.', 'Additional Setup: Place the Fallen Knight BP card near the BP deck. Place The King Commands: Come to Me AI card near the AI deck. Follow additional Clash Setup instructions introduced by Traits (if any).'],
  'requiredTiles': ['4x Column', '10x Fallen Knight'], 'monsterCells': ['E12', 'E13', 'F12', 'F13'], 'facing': 'W', 'knightStart': ['G4', 'F4', 'E4', 'D4'], 'terrain': T('I11', 'G9', 'D9', 'B11'),
  'notes': ['Fallen Knight 10개: 1열의 모든 행 (A1–J1)', 'Column·시작 칸은 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Welcome to My Castle!: Grave Mortis 2장의 좌표에 Loose String 타일(같은 좌표면 다시 뽑음, 점유된 칸이면 가장 가까운 빈 칸). Start of Clash: The King Commands: Come to Me (AI activation 아님)',
  'Command: 대상 기사마다 Obey / Disobey를 고름. Obey → Obey 효과를 자발적으로 수행(Evasion Roll 없음), Disobey → 일반 Monster Attack처럼 Evasion Roll 후 Disobey 효과. Subjugated인 기사는 반드시 Obey. 선택은 Evasion Roll 전에 함 [해석, 확인 필요 — 레퍼런스 v1.2는 "Evasion dice를 굴린 뒤 결정"처럼 읽힘]',
  'Wave Attack (Command·Shockwave): King의 가장 가까운 칸의 가장 가까운 모서리에서 기사 칸의 가장 먼 모서리까지 그은 선이 그 기사에 인접한 Obstacle(Column·Fallen Knight, 서로 인접한 Obstacle은 하나로 취급)을 지나면 그 기사는 제외. 대상이 한 명도 없으면 Signature',
  'Shockwave: X = 4 + King Level − (기사와 King 사이의 칸 수). 인접 = 0칸 [해석, 확인 필요]. X ≥ 1이면 -X [V], Knockback X',
  'Five Fingers: 1st = Thumb, 2nd = Index, 3rd = Middle, 4th = Ring, 5th = Little Finger로 대응시킴. Hidden Finger는 Trait 효과 없음 [해석, 확인 필요 — BP 카드가 6장이라 대응이 인쇄되어 있지 않음]',
  'Five Fingers: "cannot be involuntarily moved and turned" — 현재 King을 움직이거나 돌리는 기사 효과가 없어 별도 처리 없음',
  'Dark Fog: 공격자와 대상(King 또는 Fallen Knight) 사이의 칸 수만큼 Precision 감소. VP 위에서는 0',
  'Fallen Knight Army: Fallen Knight는 같은 행에서 열 번호가 커지는 쪽으로만 직선 이동, Column을 파괴. 다음 칸에 기사나 다른 Fallen Knight가 있으면 멈춤(Lv3+ Unstoppable Force: 기사는 Forced Vault + Knockdown 후 계속) [해석, 확인 필요 — 레퍼런스 v1.2: "기사에 인접하면 멈춤"]',
  'Fallen Knight Army — End of your turn: 같은 행의 Fallen Knight 1개가 5칸(여러 개면 플레이어 선택) [해석, 확인 필요 — 레퍼런스 v1.2는 "같은 행의 모든 FK"]. 없으면 고른 인접 행에서 기사로부터 가장 먼 Fallen Knight. VP 위면 아무 Fallen Knight 1개. 하나도 움직이지 않았으면 자기 행 1열에 Spawn (VP 위에서는 Spawn 없음 [해석])',
  'Fallen Knight가 King 주위 Zone 1 또는 14열로 이동/배치되면 제거하고 Armor 토큰 1 (Lv3+: 2). 5번째 Armor 토큰 → 모두 버리고 모든 기사 Bane 5. Armor 토큰 1개당 King·Fallen Knight BP의 AT +1',
  'Fallen Knight: To Hit = King과 같음, AT 7 + Level 보너스 + Armor 토큰. Wound → Trait BP 카드에 Generic 토큰(Escalate 없음), Column으로 뒤집음(Overpower 3+: 보드에서 제거). 현재 액션이 끝날 때 토큰 2개 이상이면 Generic Single Wound + Escalate 1',
  'The Seat of Power (VP): Loose String 위에서 이동을 끝내면 즉시 VP(타일 제거), 또는 Blindspot에서 Move action으로 오름(테스트 없음). VP에는 기사 1명만. VP 위 공격: Precise 또는 Heartseeker 선택, Armor 토큰 무시, +1 Power, 일반 Response(Critical 포함) 무시 [해석, 확인 필요] — WOUND: Subjugated + King 앞 Zone 1 칸으로, FAIL: Shockwave + King 앞 인접 칸으로 Displace',
  'VP 위의 기사는 Fallen Knight를 공격할 수 없음 [해석, 확인 필요]',
  'Obedient Knights (Lv2+): Five Fingers가 아닌 King BP를 VP 밖에서 Wound → 그 기사에 인접한 칸 중 King에 가장 가까운 칸에 Fallen Knight. VP에서 Wound → 공격을 마친 뒤 Signature',
  'On Command (Lv4): AI 맨 위 2장 중 Level이 높은 카드, 같으면 Command인 카드, 둘 다 Command가 아니면 Routine. 수행하지 않은 카드는 덱 맨 위로 돌려놓음 [해석, 확인 필요]',
  'String Pull (Signature): 왼쪽 Board Edge(1열)에 가장 가까운 Fallen Knight 2개가 3칸 이동 (동률: King에서 먼 쪽)',
  'Subjugated: Start of your turn에 고른 Virtue 테스트(9+), 성공하면 뒤집음. 두 번째로 얻으면 사망',
  'Entertain Me! (Obey): 가장 가까운 다른 기사가 Weapon 사거리에 들어오도록 Speed만큼 이동 → 모든 Attack dice가 명중한 것으로 Power Roll(무기 Power dice × Attack dice 수 + Knight Power die) → 그 기사가 Total Power만큼 [V] 손실 (Armor Roll 없음) [해석, 확인 필요]',
  '"Knockback N to the side" = King이 바라보는 방향 기준 왼쪽/오른쪽 중 플레이어 선택, "random direction" = 4방향 무작위 [해석, 확인 필요]',
  '미구현: Armor-piercing 1 (Shield of the Fallen, Heart of the Throne의 Wound Response), Riesenmörder Sword Critical의 "see 2329", 각 AI 카드의 REACT! 창 위치(효과 사이 창은 넣음), Fallen Knight의 비자발적 이동(기사의 Pushback 등)',
 ]}
import reactfix; reactfix.apply('puppet-king-edelhardt', d)
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
