# Builds data/monsters/toadragon-of-the-great-marsh.json (Dragon Clash) from docs/transcriptions/toadragon_of_the_great_marsh_raw.json
# + hand-written ops + Clash Setup (Sunken Kingdom Codex p.56–57). Usage: python3 tools/build_td.py data/monsters/toadragon-of-the-great-marsh.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/toadragon_of_the_great_marsh_raw.json')); S = raw['sheet']
ICON = lambda s: s.replace('[H]', '[Heat]').replace('[P]', '[Passion]').replace('[V]', '[Vigor]')
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; K = lambda op, who='target', perHit=False, **kw: {'op': 'tdK', 'k': {'op': op, **kw}, 'who': who, 'perHit': perHit}
KD = {'op': 'knockdown'}; RX = {'op': 'reactWindow', 'at': 'mid'}; A = 'attacker'
BANE = lambda n, who='target', perHit=False: K('bane', who, perHit, n=n); POI = lambda n, who='target', perHit=False: K('poison', who, perHit, n=n)
SP = lambda **k: {'op': 'tdSpawn', **k}; HOP = lambda *d: {'op': 'tdHop', 'dirs': list(d)}; COND = lambda *ids, who='target': {'op': 'tdCond', 'ids': list(ids), 'who': who}
GH = lambda gte, **k: {'stat': 'heat', 'gte': gte, **k}; GP = lambda gte, **k: {'stat': 'passion', 'gte': gte, **k}; DIE = dict(op='evasionDice', n=1)
TIER = lambda *t: {'op': 'tdTier', 'perilCheck': True, 'tiers': [dict(zip(('hits', 'v', 'poison', 'cond', 'die'), x)) for x in t]}
Z = lambda rows: {'red': [(f, r) for f, (a, b) in rows.items() for r in range(a, b + 1)], 'yellow': [], 'step': None, 'block': True}
ZF = lambda **z: dict(type='zone', zoneFn='tdZone', tdZone=z)
AI = {
 'Lunge': dict(**ZF(self=2), wave=True, move=False, beforeAttack=[HOP('forward')], gates=[GH(4, **DIE)], effects=[{'op': 'tdFlat', 'n': 8, 'perilCheck': True}, KD, RX], afterFinalAttack=[SP(zone=2)]),
 'Tongue Whip': dict(move=False, range=7, gates=[GP(5, **DIE)], effects=[V(3), {'op': 'tdPull', 'n': 2}, {'op': 'tdEvNeg'}], afterAttack=[{'op': 'tdKbObstacle', 'n': 6}]),
 'Overwhelming Croak': dict(**ZF(swamp={'pick': 'closest', 'n': None, 'z': 1}), sigIfEmpty=True, move=False, judge=['Bravery', 'Sagacity'], effects=[BANE(1), V(4), {'op': 'tdDieAt', 'gte': 3}, COND('Slimed', 'Distracted'), RX], afterFinalAttack=[HOP('forward')]),
 'Putrescent Stench': dict(type='zone', move=True, judge=['Tenacity', 'Fortitude'], zoneDiagram={'red': [(f, r) for f in (1, 2) for r in range(-2, 5)] + [(f, r) for f in (0, -1) for r in (-2, -1, 3, 4)], 'yellow': [], 'step': None, 'block': True}, effects=[{'op': 'tdFlat', 'n': 10, 'perilCheck': True}, POI(2), SP(perHit=True)]),
 'Poisonous Bile': dict(type='zone', wave=True, move=True, zoneDiagram=Z({f: (0, 2) for f in (1, 2, 3)}), gates=[GP(3, op='difficultyInstead', n=12)], effects=[TIER((1, 7, 0), (2, 10, 1), (3, 12, 2)), BANE(2)], afterAttack=[SP()]),
 'Toadlet Pack': dict(**ZF(swamp={'pick': 'closest', 'n': 2, 'z': 2}), wave=True, move=False, effects=[V(6), BANE(1, perHit=True), COND('Slimed'), RX], afterFinalAttack=[HOP('forward')]),
 'Rancid Breath': dict(type='zone', move=True, judge=['Sagacity', 'Fortitude'], zoneDiagram=Z({f: (-(f - 1), 2 + (f - 1)) for f in (1, 2, 3, 4)}), effects=[V(7), POI(2, perHit=True), SP(perHit=True)]),
 'Mighty Slam': dict(**ZF(self=4), wave=True, move=False, beforeAttack=[HOP('forward')], gates=[GH(5, **DIE)], effects=[{'op': 'tdFlat', 'n': 12, 'perilCheck': True}, KD, {'op': 'knockback', 'n': 2}, RX], afterFinalAttack=[SP(zone=4)]),
 'Maw of the Marsh': dict(move=False, jump=True, effects=[BANE(2), V(5), SP(perHit=True)]),
 'Regurgitate Young': dict(type='zone', wave=True, move=True, zoneDiagram=Z({f: (0, 2) for f in range(1, 7)}), gates=[GP(4, op='difficultyInstead', n=10)], effects=[TIER((1, 8, 1), (2, 12, 2), (3, 15, 3)), BANE(2)], afterAttack=[SP()]),
 'Toadlet Horde': dict(**ZF(swamp={'pick': 'furthest', 'n': 3, 'z': 3}), wave=True, move=False, effects=[V(5), BANE(2, perHit=True), COND('Slimed'), RX, {'op': 'tdKdSwamp'}, RX], afterFinalAttack=[SP(targeted=True), {'op': 'faceMostKnights'}]),
 'Tongue Twister': dict(move=False, range=8, gates=[GP(6, **DIE)], effects=[V(3), {'op': 'tdPull', 'n': 3}, {'op': 'tdEvNeg'}, RX], afterAttack=[{'op': 'tdDieAdjacent'}]),
 'Poison the Waters': dict(**ZF(board=True), move=False, judge=['Tenacity', 'Insight', 'Fortitude'], gates=[GH(5, **DIE)], effects=[V(8), POI(2, perHit=True), SP(perHit=True), RX], afterFinalAttack=[HOP('forward', 'left')]),
 'Gore-Gorger': dict(move=False, jump=True, effects=[V(7), BANE(1, perHit=True), SP(perHit=True)], afterAttack=[{'op': 'tdHeal'}]),
 'Engulf in Slime': dict(**ZF(toads=True), move=False, tdDiceToads=True, pre=[RX, {'op': 'tdToadMove1'}], effects=[V(5), BANE(2, perHit=True), {'op': 'tdDieAt', 'gte': 3}, COND('Drowning'), RX], afterFinalAttack=[HOP('forward', 'right')]),
 'Toadlet Swarm': dict(type='zone', wave=True, move=True, tdLateral=True, zoneDiagram=Z({f: (-(f - 1), 2 + (f - 1)) for f in range(1, 7)}), effects=[TIER((1, 10, 0, 'Slimed'), (3, 15, 0, 'Drowning'), (4, 0, 0, None, True)), BANE(2), POI(2)], afterAttack=[SP()]),
 'Swamplands Surge': dict(**ZF(board='rearEdge'), wave=True, move=False, gates=[{'stat': 'passion', 'gte': 6, 'op': 'ignoreReact'}], effects=[V(6), BANE(2, perHit=True), COND('Drowning'), {'op': 'tdSurgeKb', 'n': 3}]),
 'Fenland Fling': dict(move=False, range=9, pre=[RX], gates=[GP(7, **DIE)], effects=[V(5), {'op': 'tdKbShort', 'n': 5}, {'op': 'tdEvNeg'}]),
}
SIG = dict(move=True, range=2, gates=[GH(4, **DIE)], effects=[V(3), BANE(1), POI(1)], afterAttack=[SP(ifLevel=2)])
CRES = dict(move=False, targeting=['All Knights'], effects=[{'op': 'tdCrescendo'}])
OC = lambda n, *ops, kind='overcome': {'n': n, 'kind': kind, 'ops': list(ops)}; P1 = {'op': 'power', 'n': 1}; REPO = {'op': 'tdMove', 'n': 2}; ICUMB = {'op': 'tdIgnoreCumb'}; VP = {'op': 'tdVP'}
SIGA = {'op': 'signatureAgainstAttacker'}; KB = lambda n: {'op': 'knockback', 'n': n}; LV = lambda n: {'op': 'loseVigor', 'n': n}; FLAG = lambda i, text, td=False: {'op': 'tdFlag', 'id': i, 'text': text, 'td': td}
BP = {
 'Crown of Fins': dict(oc=OC(4, P1), wound=[RX, HOP('forward'), SP()], fail=[POI(1, A), COND('Slimed', who=A)], critical=[FLAG('halfResist', 'Clash 종료까지 Resist 시 [V] 손실이 절반(내림)', True)]),
 'Giant Tail': dict(oc=OC(4, P1), wound=[SIGA], fail=[RX, KB(4)], critical=[VP]),
 'Soft Underbelly': dict(oc=OC(5, ICUMB, kind='overpower'), instinct=[SP(n=2)], wound=[RX, HOP('forward'), POI(1, A), BANE(1, A)], critical=[{'op': 'tdMonToHit'}]),
 'Hind Leg': dict(oc=OC(3, REPO, kind='overpower'), instinct=[RX, HOP('toad')], wound=[SP()], critical=[{'op': 'tdPool', 'token': 'hope', 'n': 1}, {'op': 'tdPool', 'token': 'closing', 'n': 1}]),
 'Front Leg': dict(oc=OC(3, REPO, kind='overpower'), wound=[SIGA], fail=[KD], critical=[FLAG('heatStep', 'Clash 종료까지 Toadragon이 이동하려 할 때 각 기사가 +1 [H]로 1칸 이동 가능')]),
 'Spiny Trunk': dict(oc=OC(4, P1), ultrainstinct=[{'op': 'tdCumbersome'}], wound=[POI(1, A)], fail=[LV(2), RX, KD], critical=[VP]),
 'Glider Wing': dict(oc=OC(4, {'op': 'tdMove', 'n': 2}), instinct=[RX, HOP('random')], critical=[FLAG('noCrashDeath', 'Crash로 인한 사망 비활성 (Bounding Behemoth)')]),
 'Distended Jaw': dict(oc=OC(3, P1), ultrainstinct=[SP()], instinct=[SP()], wound=[HOP('toad')], critical=[{'op': 'tdScavenge', 'n': 2}]),
 'Slimy Tongue': dict(oc=OC(5, P1), ultrainstinct=[{'op': 'tdPullA', 'n': 3}], wound=[COND('Slimed', who=A), {'op': 'tdSpeedNeg'}], fail=[BANE(2, A)], critical=[{'op': 'tdRange3'}]),
 'Gorged Innards': dict(oc=OC(6, ICUMB, kind='overpower'), wound=[BANE(2, A), SP()], fail=[LV(3), RX, KB(4)], critical=[FLAG('baneLess', '각 Bane X가 1 줄어듦'), {'op': 'tdMonToHit'}]),
 'Razor Claws': dict(oc=OC(5, P1), wound=[{'op': 'tdExhaustWeapon'}, RX, HOP('random')], fail=[LV(4), RX, KD], critical=[{'op': 'tdBonus', 'move': 3, 'power': 1}]),
 'Warty Skin': dict(oc=OC(5, P1), instinct=[POI(2, A), BANE(1, A)], wound=[SP(n=2)], critical=[VP, {'op': 'tdBonus'}]),
 'Ichor Gland': dict(oc=OC(5, REPO, kind='overpower'), instinct=[POI(2, A), {'op': 'choke', 'n': 4}], wound=[{'op': 'tdRemoveAI'}], critical=[FLAG('noPoison', 'Poison X 키워드 비활성'), VP]),
 'Clogged Lungs': dict(oc=OC(7, ICUMB, kind='overpower'), ultrainstinct=[{'op': 'tdToadWeapon'}], wound=[POI(2, A), LV(2)], fail=[RX, HOP('random')], critical=[FLAG('noJudge', 'Judgement 비활성. 이후 Dirge of Dominion에서 한 명이라도 Submit하면 Generic Single Wound')]),
 'The Oldest One': dict(oc=OC(8, {'op': 'tdCritInstead'}, kind='overpower'), wound=[RX, BANE(2, A), HOP('toad')], fail=[COND('Slimed', who=A), SP(adjacent=True, who=A)], critical=[FLAG('noToadMove', 'Toadlet 이동 비활성')]),
 'Toad Heart': dict(reveal=[{'op': 'tdHeart'}], wound=[{'op': 'tdBaneFull'}], fail=[{'op': 'tdJudFear'}], critical=[{'op': 'slayMonster'}]),
 'Spawn Sack': dict(oc=OC(6, P1), ultrainstinct=[SP(n=3)], instinct=[SIGA], wound=[{'op': 'tdEvNeg', 'permanent': True, 'who': A}], fail=[BANE(2, A)], critical=[FLAG('noSpawn', 'Toadlet Spawn 비활성 — "Immediately see 4567" (스토리 항목, 미구현)')]),
 'Withered Old Scale': dict(oc=OC(6, P1), ultrainstinct=[{'op': 'tdAtPlus', 'n': 2}], instinct=[RX, KB(7), LV(3), HOP('random')], critical=[FLAG('wCrit', 'Clash 종료까지 [W] 칸에서 공격하면 Crit Chance')]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('tag') or ''; c['targeting'] = [ICON(t) for t in c.get('targeting') or []]
    ops = {'targeting': spec.pop('targeting', c['targeting']), 'move': spec.pop('move', False), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c.get('type'); c['type'] = spec.pop('type', 'attack'); c['moveTag'] = tag; ops.update({k: v for k, v in spec.items() if v is not None})
    c['evasionDice'] = c.get('evasionDice') if isinstance(c.get('evasionDice'), int) else 0; c['evasionDifficulty'] = c.get('evasionDifficulty') or 0
    c['afterAttack'] = (c['afterTag'] + ': ' + c['after']) if c.get('after') and c.get('afterTag') else c.get('after'); c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; ops = {'at': c['at'], 'overcome': spec.get('oc'), 'reveal': spec.get('reveal'), 'ultrainstinct': spec.get('ultrainstinct')}
    c['responses'] = {k: c.get(k) for k in ('ultrainstinct', 'instinct', 'wound', 'fail', 'critical')}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
cres = [c for c in raw['ai'] if c['name'] == 'Crescendo of Subjugation'][0]; deck = [c for c in raw['ai'] if c is not cres]
missing = [c['name'] for c in deck if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI', 'traitsAdd': v['traitsAdd'], 'bonuses': {k: v['bonuses'].get(k, 0) for k in ('escalations', 'at', 'vigorLoss', 'evasionDice')}} for l, v in S['levels'].items()}
SW = lambda *p: [{'tile': 'swamp', 'cells': list(x)} for x in p]; GM = lambda *p: [{'tile': 'great mangrove', 'cells': list(x)} for x in p]
d = {'id': 'toadragon-of-the-great-marsh', 'name': S['name'], 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'], '_source': 'Owner scans 2026-11-19; Clash Setup: Sunken Kingdom Codex p.56–57',
 'footprint': {'size': 9, 'shape': '3x3', 'rear': 'the 3 cells directly behind the footprint', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Lumbering'}, {'name': 'Blindspot'}, {'name': 'Unavoidable Knockback', 'value': 5}, {'name': 'VP'}, {'name': 'Ignore Difficult Terrain'}],
 'vp': {'name': S['vp']['name'], 'text': S['vp']['text'], 'unlocked': False, 'climb': {'virtue': 'Might', 'n': 11}, 'hold': {'virtue': 'Tenacity', 'n': 12, 'rear': True, 'knockback': 3}},
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in deck], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG), 'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'tdRoutine'}]}},
 'crescendo': ai(cres, CRES), 'td': True,
 'clashSetup': {'_source': 'Sunken Kingdom Codex p.56–57 (Toadragon of the Great Marsh Clash)', 'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Toadragon miniature on the space designated on the diagram. Note the facing direction indicated by the arrow.', 'Additional Setup: Place the Divine Target token and 6 Toadlet tokens near the Monster Sheet. Follow additional Clash Setup instructions introduced by Traits (if any).'],
  'requiredTiles': ['3x Great Mangrove', '7x Swamp 1x2'], 'monsterCells': [r + str(c) for r in 'DCB' for c in (8, 9, 10)], 'facing': 'N', 'knightStart': ['I11', 'G6', 'G12', 'E4'],
  'terrain': GM(('I9', 'I10', 'H9', 'H10'), ('F12', 'F13', 'E12', 'E13'), ('C5', 'C6', 'B5', 'B6')) + SW(('J10', 'J11'), ('I1', 'H1'), ('H14', 'G14'), ('G5', 'F5'), ('F11', 'E11'), ('C1', 'B1'), ('A12', 'A13')),
  'notes': ['Toadragon 3x3 = B8–D10, 타일·시작 칸은 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Crescendo of Subjugation: 첫 Monster Round에 수행(모든 기사 Poison 1, 추가 AI) 후 AI 덱 맨 아래에 앞면으로 고정. AI 덱이 바닥나 이 카드가 뽑히거나 버려지게 되면 모든 기사 사망. AI Suppress나 Escalation으로 버림 더미가 덱에 섞일 때 Crescendo는 함께 섞지 않고 맨 아래에 그대로 둠 — 이렇게 덱을 다시 채워 피하는 것이 정상 (소유자 확인 2026-11-21). 덱이 비었다고 버림 더미를 자동으로 섞지는 않음',
  'Dirge of Dominion: 2라운드부터 Start of Monster Round에 기사마다 Submit / Resist. Resist = [P]만큼 [V] 손실, Submit하거나 죽은 기사 1명당 AI 덱 맨 위 1장 버림. Poisoned 카드로 [V]를 잃을 때 그만큼 [P]를 얻음 (Toxified: 턴 종료 시 빨간 Power die를 굴려 ⚔마다 Poison 토큰 +1, 그 뒤 토큰 수만큼 — 이 Clash에서는 [V] 대신 [P])',
  'The Great Unknowable: AI 버림 더미는 뒷면 — 로그에는 버린 카드 이름을 표시하지 않음 (수행한 카드는 이미 공개됨)',
  'Bounding Behemoth: Toadragon은 한 번에 3칸씩 직선으로 Hop. 이동 공격은 대상이 유효 사거리(근접 = 인접, Range X = X칸, Zone 도식 = 도식 안)에 들어오는 최소 Hop 수만 이동하고, 닿을 수 없으면 전혀 이동하지 않음. Hop 경로의 기사는 Crash 대신 사망, 살아남으면 가장 가까운 빈 칸으로 Displace. Obstacle은 Hop을 막지 않음 — Boss는 지형을 무시하고 Destructible만 파괴 (소유자 확인 2026-11-21)',
  'Hop X: 방향으로 3칸. Board Edge 밖으로 나가게 되면 그 Edge의 반대쪽을 향해 돌아선 뒤 3칸 이동',
  'Spawneater: Spawn = Toadlet이 없는 Swamp 타일 중 Toadragon에서 가장 먼 타일. 보드+Sheet에 6개면 Spawn 대신 가장 먼 Toadlet을 Sheet로. Toadragon이 지나가거나 멈춘 칸의 Toadlet은 Sheet로. 기사가 이동을 Toadlet 위나 인접한 칸에서 끝내면 버리고 Poison 1 — 이동 중 지나간 Toadlet도 같음(Toadlet을 가장 적게 지나는 경로로 판정)',
  'Spawneater — End of Monster Round: 가까운 Toadlet부터 3칸까지 Toadragon 쪽으로 이동. 이미 인접했거나 인접한 뒤 이동력이 남으면 Sheet로 [해석, 확인 필요]. Sheet에 2개 이상이면 버리고 Signature',
  'Favorite Child (Lv2): Divine Target 토큰이 보드에 없을 때 Spawn하면 Toadlet 대신 Divine Target 토큰을 놓음(Toadlet 취급). Sheet로 가게 되면 버리고 AI 수행',
  'VP (Severed Ichor Spines): Critical로 생성. Climb = Might 11+ (프리 액션, 인접), Hold On = Monster Round 종료 시 Tenacity 12+ (실패: Rear 칸으로 Displace, Knockdown, Knockback 3). VP 위: +2 Power, 일반 Response(Critical 포함) 대신 WOUND: Toxify 1 → Hop Forward → Hold On 테스트 / FAIL: 앞 칸으로 Displace, Knockdown [해석, 확인 필요]',
  'Zone 도식: Putrescent Stench = 정면 7칸 폭 × 2칸 깊이 + 양옆 앞쪽 2x2씩, Regurgitate Young = 정면 3칸 폭 × 6칸 깊이, Toadlet Swarm = 정면으로 3/5/7/9/11/13칸씩 넓어지는 6줄(48칸) (소유자 확인 2026-11-21). Poisonous Bile = 정면 3×3, Rancid Breath = 정면에서 넓어지는 원뿔 4칸 깊이 [해석, 확인 필요]',
  'Wave Attack: Obstacle(Great Mangrove) 뒤에 인접한 기사는 제외. Toadlet Pack/Horde는 대상 Swamp 타일이, Swamplands Surge는 Toadragon 바로 뒤쪽 Board Edge가 Wave의 출발점',
  'Tongue Whip After Attack: 인접해 있으면 가장 가까운 Obstacle 쪽(가로/세로 중 더 먼 축)으로 Knockback 6 [해석, 확인 필요]. Fenland Fling: 가까운 짧은 Board Edge(1열/14열) 쪽으로 명중당 Knockback 5, Obstacle 무시, Boundless(보드 밖 = 사망) [해석, 확인 필요]',
  'Engulf in Slime: Evasion dice X = 그 기사 주위 Zone 1의 Toadlet 수 × 2',
  'Ultrainstinct Response는 BP 공개 직후(Power Roll 전)에 처리',
  'Swamplands Surge {P6+: IGNORE [React window]}: Passion 6 이상인 기사는 이 공격에 REACT! 불가 (기사별 적용 [해석, 확인 필요]). Fenland Fling의 "Run!" = Targeting 앞 REACT! 창. Passion 게이트는 녹색 아이콘 = Passion 맞음 (소유자 확인 2026-11-21). Weakspot 없음 (소유자 확인 2026-11-21)',
  'Lumbering: 기사의 Pushback / Knockback / Drag / Pull은 Toadragon에 무효(Ignore Lumbering 제외). Toadlet Swarm의 Move Lateral: 방향을 바꾸지 않고 옆으로 Hop해 대상을 Zone에 넣는 최소 횟수만 이동, 불가능하면 이동 없음',
  'Front Leg Critical: Toadragon이 이동하려 할 때마다 각 기사가 Heat +1로 1칸 이동 가능(한 번의 이동 공격·Hop 지시당 1회). Clogged Lungs Critical: Judgement 카드는 수행하지 않고, Dirge에서 한 명이라도 Submit하면 Generic Single Wound. Crescendo of Subjugation은 Judgement 비활성의 영향을 받지 않는 것으로 처리 [해석, 확인 필요]',
  'Ultrainstinct: Spiny Trunk = 이번 공격 동안 Weapon에 Cumbersome, Withered Old Scale = 그 카드 AT +2(이후에도 유지), Clogged Lungs = 가장 가까운 Toadlet이 active Weapon 위로(그 Gear는 Cumbersome, Toadlet은 그 기사의 칸에 있는 것으로 취급 — 다른 기사가 인접해 이동을 끝내거나 Toadragon이 그 칸을 지나면 떨어짐)',
  '미구현(스토리 항목): Spawn Sack Critical의 "Immediately see 4567" — Toadlet Spawn 비활성만 적용',
 ]}
# The whole Toadragon sheet was checked by the owner on 2026-11-21 (items still marked [해석, 확인 필요] are new questions)
import re
OK = ' (소유자 확인 2026-11-21)'
KEEP = ('Crescendo of Subjugation은 Judgement',)
d['rulings'] = [r if any(x in r for x in KEEP) else re.sub(r' ?\[해석, 확인 필요[^\]]*\]', '', r) for r in d['rulings']]
d['rulings'] = [r if '소유자 확인' in r or '확인 필요' in r else r + OK for r in d['rulings']]
d['clashSetup']['notes'] = [re.sub(r' ?\[해석, 확인 필요[^\]]*\]', OK, x) for x in d['clashSetup'].get('notes', [])]
import reactfix; reactfix.apply('toadragon-of-the-great-marsh', d)
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
