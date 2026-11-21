# Builds data/monsters/panzerdragon-veldr.json (Dragon Clash) from docs/transcriptions/panzerdragon_veldr_raw.json
# + hand-written ops + Clash Setup (Principality of Stone Codex p.54–55). Usage: python3 tools/build_pv.py data/monsters/panzerdragon-veldr.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/panzerdragon_veldr_raw.json')); S = raw['sheet']
ICON = lambda s: s.replace('[H]', '[Heat]').replace('[P]', '[Passion]').replace('[V]', '[Vigor]')
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; K = lambda op, who='target', perHit=False, **kw: {'op': 'pvK', 'k': {'op': op, **kw}, 'who': who, 'perHit': perHit}
KD = {'op': 'knockdown'}; RX = {'op': 'reactWindow', 'at': 'mid'}; A = 'attacker'; FACE = {'op': 'faceMostKnights'}; MIG = {'op': 'pvMig'}
G = lambda loc, n=1, **k: {'op': 'pvGerm', 'loc': loc, 'n': n, **k}; P = lambda n=1, **k: {'op': 'pvP', 'n': n, **k}; BN = lambda n, alt=None, **k: {'op': 'pvBane', 'n': n, 'alt': alt if alt is not None else n, **k}
EX = lambda **k: {'op': 'pvExhaust', **k}; KB = lambda n, **k: {'op': 'pvKb', 'n': n, **k}; FW = lambda n: {'op': 'pvForward', 'n': n}; TIER = lambda *t: {'op': 'pvTier', 'tiers': list(t), 'perilCheck': True}
GP = lambda gte, **k: {'stat': 'passion', 'gte': gte, **k}; ALT = lambda gte: GP(gte, op='pvAlt'); DIE = dict(op='evasionDice', n=1); MG = lambda gte: GP(gte, op='pvMigGate', alsoOps=[MIG])
Z = lambda rows: {'red': [(f, r) for f, (a, b) in rows.items() for r in range(a, b + 1)], 'yellow': [], 'step': None, 'block': True}
TRI = lambda depth: Z({f: (-(f - 1), 2 + (f - 1)) for f in range(1, depth + 1)}); BEAM = lambda w: dict(type='zone', zoneFn='pvZone', pvZone={'beam': w}, isBeam=True)
T2 = ['Furthest Knight in front', 'Furthest Knight in sight']
AI = {
 'Rust Beam': dict(**BEAM(1), pre=[FACE], gates=[ALT(4)], effects=[V(3), EX(perHit=True), BN(1, 2)], afterAttack=[G('dragon'), KB(3)]),
 'Rend the Armor': dict(move=True, gates=[GP(4, op='difficultyInstead', n=11)], effects=[V(5), BN(2), P(1), EX(armor=True, discard=True), RX], afterAttack=[{'op': 'pvIfDied', 'then': [G('remnant')], 'else': [G('field'), KD, KB(10)]}]),
 'Sedimentalis': dict(type='zone', wave=True, zoneX=True, pre=[FACE], gates=[ALT(4)], effects=[V(2), BN(1, 2), EX(perHit=True)], afterFinalAttack=[G('dragon', 2), FW(3)]),
 'Rustgasp': dict(type='zone', wave=True, pre=[FACE, MIG], zoneDiagram=TRI(3), gates=[ALT(4)], effects=[P(1), TIER((1, 5), (2, 9), (3, 15)), BN(1, 2), EX(armor=True)], afterAttack=[G('field')]),
 'Scrap Divebomb': dict(landOnTop=True, before=[MIG], effects=[{'op': 'pvDieKD'}, P(1), {'op': 'pvFlat', 'n': 9, 'perilCheck': True}, BN(2), G('dragon', 2)], afterAttack=[KD, KB(6)]),
 'Stampede of Steel': dict(move=True, pathAttack=True, gates=[MG(4)], effects=[V(4), BN(1, perHit=True), RX, KB(6, side=True), G('dragon'), RX], afterFinalAttack=[FW(3)]),
 'Swarmsong': dict(judge=['Bravery', 'Tenacity'], gates=[MG(6)], effects=[{'op': 'pvCondTier', 'one': 'Fear', 'two': 'Dread'}, K('parasitize', perHit=True, n=1), RX], afterAttack=[MIG]),
 'There and Back': dict(move=True, pathAttack=True, gates=[GP(5, **DIE)], effects=[V(4), BN(1, perHit=True), KD, KB(6, side=True), G('dragon', 2), RX], afterFinalAttack=[{'op': 'pvRepeat'}]),
 'Pall of Rust': dict(type='zone', wave=True, zoneX=True, pre=[FACE], gates=[ALT(5)], effects=[V(3), EX(perHit=True), BN(2, 3)], afterFinalAttack=[G('remnant', 2), FW(4)]),
 'Metal Beam': dict(**BEAM(3), pre=[FACE], gates=[ALT(5)], effects=[V(3), BN(1, 2), EX(perHit=True)], afterAttack=[G('dragon', 2), KB(4)]),
 'Deep Impact': dict(landOnTop=True, before=[MIG], effects=[{'op': 'pvDieKD'}, BN(1, perHit=True), P(1, perHit=True), {'op': 'pvLoseP', 'perilCheck': True}], afterAttack=[KD, KB(7)]),
 'Rustbreath': dict(type='zone', wave=True, pre=[FACE, MIG], zoneDiagram=TRI(4), gates=[ALT(5)], effects=[TIER((1, 5), (2, 9), (3, 'zero')), BN(1, 2), P(1, gateAlt=2), KD], afterAttack=[G('field', 2)]),
 'Ultrametal Beam': dict(**BEAM(3), pre=[FACE], gates=[ALT(6)], effects=[V(3), BN(1, 2), EX(all=True)], afterAttack=[G('dragon', 2), KB(7)]),
 'Plague of Parasites': dict(type='zone', zoneFn='pvZone', pvZone={'board': True}, effects=[V(2), BN(1, perHit=True), K('parasitize', perHit=True, n=1), KD, RX], afterFinalAttack=[MIG, G('remnant', 2), FW(5)]),
 'Decaying Miasma': dict(type='zone', wave=True, zoneX=True, pre=[MIG], gates=[ALT(6)], effects=[V(3), EX(per2=True, discard=True), BN(2, 3)], afterFinalAttack=[G('dragon', 2), {'op': 'pvAppear'}]),
 'Rubiginous Disgorge': dict(type='zone', wave=True, pre=[RX, FACE, MIG], zoneDiagram=TRI(5), effects=[TIER((1, 9), (2, 15), (3, 'zero')), P(1, perHit=True), BN(1, perHit=True), KD], afterAttack=[G('remnant', 2)]),
 'Feed the Hive': dict(move=True, effects=[G('dragon', 2, perHit=True), V(6), EX(armor=True, discard=True), RX], afterAttack=[MIG, KB(8)]),
 'Shadow of Doom': dict(judge=['Bravery', 'Tenacity'], before=[MIG], effects=[{'op': 'pvDoom'}], afterAttack=[{'op': 'pvSaint'}]),
}
SIG = dict(move=True, gates=[GP(5, op='pvNoArmorGear')], effects=[V(2), BN(1), RX], afterAttack=[G('field', 2)])
OC = lambda n, *ops, kind='overcome': {'n': n, 'kind': kind, 'ops': list(ops)}; OFF = lambda **k: {'op': 'pvArmorOff', **k}; SUN = lambda n: {'op': 'pvSunder', 'n': n}; RM = lambda n, **k: {'op': 'pvRemnant', 'n': n, **k}
SIGA = {'op': 'signatureAgainstAttacker'}; VP = {'op': 'pvVP'}; BONUS = {'op': 'pvBonus'}; SC = lambda n: {'op': 'pvScavenge', 'n': n}; PA = lambda n: P(n, who=A)
DIS = lambda text, *m: {'op': 'pvDisable', 'match': list(m), 'text': text}; FL = lambda i, text: {'op': 'pvFlag', 'id': i, 'text': text}
BP = {
 'Panzerclaws': dict(oc=OC(9, OFF(all=True, germ=True)), wound=[G('remnant')], fail=[G('dragon')], critical=[DIS('Wave Attack 비활성 — 뽑히면 수행하지 않고 무시', 'wave')]),
 'Corroded Scales': dict(oc=OC(8, OFF(n=2, germIf=True)), ultrainstinct=[RM(4)], instinct=[MIG], critical=[VP]),
 'Maultail': dict(oc=OC(8, OFF(n=2, germIf=True)), ultrainstinct=[RM(4)], instinct=[SIGA], critical=[SC(2)]),
 'Inscribed Pauldron': dict(oc=OC(9, OFF(all=True)), wound=[MIG], fail=[G('remnant')], critical=[OFF(all=True)]),
 'Loose Parasite Plate': dict(oc=OC(5, SUN(1)), wound=[G('field')], fail=[PA(1), G('remnant')], critical=[BONUS]),
 'Plated Abdomen': dict(oc=OC(4, OFF(n=1, must=True), kind='overpower'), wound=[G('field')], fail=[PA(1), G('remnant')], critical=[BONUS]),
 'Panzerscale Throatpouch': dict(oc=OC(6, SUN(1)), wound=[MIG], fail=[PA(1), G('remnant')], critical=[FL('noUltra', 'Ultrainstinct Response 비활성')]),
 'Scalehorde': dict(oc=OC(8, OFF(n=4, germPer2=True)), ultrainstinct=[RM(8)], instinct=[G(['dragon', 'field', 'remnant'])], wound=[{'op': 'pvRegain'}], critical=[OFF(all=True), OFF(all=True, loc='remnant')]),
 'Serrated Nape': dict(oc=OC(12, OFF(all=True, germPer2=True)), ultrainstinct=[K('gainHeat', A, n=2)], wound=[EX(weapon=True, who=A)], critical=[FL('noPGain', 'Panzerdragon 공격 중 [P] 획득 비활성')]),
 'Tattered Wing': dict(oc=OC(6, SUN(1)), wound=[SIGA], fail=[PA(2), G('field')], critical=[VP]),
 'Royal Gorget': dict(oc=OC(8, OFF(n=4, germPer2=True)), wound=[PA(1), G('field', 2)], fail=[KD, KB(10, who=A)], critical=[SC(2)]),
 'Cruel Chamfron': dict(oc=OC(6, SUN(1)), ultrainstinct=[RM(4)], instinct=[G('dragon', 2), SIGA], critical=[DIS('Beam Zone Attack 비활성 — 뽑히면 수행하지 않고 무시', 'isBeam')]),
 'Rustlung': dict(oc=OC(8, SUN(2)), wound=[MIG, K('bane', A, n=2)], fail=[EX(n=2, discard=True, who=A)], critical=[DIS('"Target: Zone X" Zone Attack 비활성 — 뽑히면 수행하지 않고 무시', 'zoneX')]),
 'Larval Sac': dict(oc=OC(10, OFF(n=6, germPer2=True)), ultrainstinct=[G('field', 2)], instinct=[G(['dragon', 'remnant'], 2)], critical=[FL('germChosen', '각 Germinate가 Germinate (chosen)이 됨')]),
 'Parasite Queenking': dict(oc=OC(10, OFF(n=6, germPer2=True)), ultrainstinct=[RM(8, ccw=True)], instinct=[MIG], fail=[G('remnant', 2)], critical=[FL('noMigrate', 'Migrate 키워드 비활성')]),
 'Sliver of Lost Glory': dict(oc=OC(12, OFF(all=True, germPer2=True)), ultrainstinct=[RM(8)], instinct=[{'op': 'pvBaneGerm'}], critical=[{'op': 'pvBaneAll'}, {'op': 'pvNote', 'text': '"Immediately see 9350" — 스토리 항목, 미구현'}]),
 'Spiked Spinal Column': dict(ultrainstinct=[{'op': 'pvChainBreak'}], critical=[VP]),
 'Drachenhertz': dict(oc=OC(8, SUN(2)), ultrainstinct=[RM(8)], wound=[PA(1), MIG], fail=[G('remnant')], critical=[{'op': 'slayMonster'}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('tag') or ''; c['targeting'] = [ICON(t) for t in c.get('targeting') or []]
    ops = {'targeting': spec.pop('targeting', c['targeting']), 'move': spec.pop('move', False), 'gates': spec.pop('gates', []), 'before': spec.pop('before', []), 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c.get('type'); c['type'] = spec.pop('type', 'attack'); c['moveTag'] = tag; ops.update(spec)
    c['evasionDice'] = c.get('evasionDice') or 0; c['evasionDifficulty'] = c.get('evasionDifficulty') or 0
    c['afterAttack'] = (c['afterTag'] + ': ' + c['after']) if c.get('after') and c.get('afterTag') else c.get('after'); c['ops'] = ops; return c
def bp(c, spec=None):
    c = copy.deepcopy(c); spec = spec or BP[c['name']]; ops = {'at': c['at'], 'overcome': spec.get('oc'), 'ultrainstinct': spec.get('ultrainstinct')}
    c['responses'] = {k: c.get(k) for k in ('ultrainstinct', 'instinct', 'wound', 'fail', 'critical')}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
roar = [c for c in raw['ai'] if c['name'] == 'Dragon Roar'][0]; deck = [c for c in raw['ai'] if c is not roar]
missing = [c['name'] for c in deck if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '2 AI', 'traitsAdd': [t.replace(' (see card)', '') for t in v['traitsAdd']], 'bonuses': {k: v['bonuses'].get(k, 0) for k in ('escalations', 'at', 'vigorLoss', 'evasionDice')}} for l, v in S['levels'].items()}
tc = {c['name']: c for c in raw['traitCards']}
field = bp(tc['Field of Parasites'], dict(oc=OC(1, OFF(loc='field', x='over'), kind='overpower'), ultrainstinct=[G('dragon')], instinct=[MIG, K('parasitize', A, n=1)], critical=[OFF(all=True, loc='field'), BONUS]))
remn = bp(tc['Primal Remnant'], dict(oc=OC(1, OFF(loc='remnant', x='over'), kind='overpower'), ultrainstinct=[G('dragon')], wound=[PA(1), SIGA], fail=[RM(4)], critical=[OFF(all=True, loc='remnant'), {'op': 'devote'}]))
COL = lambda *cells: [{'tile': 'column', 'cells': [c]} for c in cells]
d = {'id': 'panzerdragon-veldr', 'name': S['name'], 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'], '_source': 'Owner scans 2026-11-19; Clash Setup: Principality of Stone Codex p.54–55',
 'footprint': {'size': 9, 'shape': '3x3', 'rear': 'the 3 cells directly behind the footprint', 'sides': 'left / right adjacent cells = Field of Parasites (!)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 12}, {'name': 'Lumbering'}, {'name': 'Blindspot'}, {'name': 'VP'}],
 'vp': {'name': S['vp']['name'], 'text': S['vp']['text'], 'unlocked': False, 'climb': {'virtue': 'Might', 'n': 8}, 'hold': {'virtue': 'Fortitude', 'n': 9}},
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': 'Mortal Retribution', 'level': 1, 'text': tc['Mortal Retribution']['text'], 'implemented': True}],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in deck], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG), 'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'pvRoutine'}]}},
 'roar': ai(roar, dict(effects=[])), 'traitBP': {'field': field, 'remnant': remn}, 'pv': True,
 'clashSetup': {'_source': 'Principality of Stone Codex p.54–55 (Panzerdragon Veldr Clash)', 'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Panzerdragon Veldr miniature on the space designated on the diagram. Note the facing direction indicated by the arrow.', "Additional Setup: Place the Field of Parasites BP card and the Primal Remnant BP card near the Monster Sheet. Place the Divine Target token and Fool's deck near the Monster Sheet. Follow additional Clash Setup instructions introduced by Traits (if any)."],
  'requiredTiles': ['10x Column', '1x Primal Remnant'], 'monsterCells': [r + str(c) for r in 'IHG' for c in (7, 8, 9)], 'facing': 'S', 'knightStart': ['G3', 'G13', 'E5', 'D10'], 'remnant': 'J8',
  'terrain': COL('I13', 'H2', 'H6', 'H10', 'F12', 'E4', 'C2', 'C6', 'C10', 'B13'),
  'notes': ['Panzerdragon 3x3 = G7–I9, Primal Remnant = J8, Column·시작 칸은 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Dragon Roar: 첫 AI로 수행 — 모든 기사 Fear, +1 [P], Knockdown, Devotion 토큰이 가장 많은 기사가 Divine Target. Germinate (Dragon) ×4, (Remnant) ×4, (Field) ×3 후 카드를 제거하고 다음 AI를 뽑음',
  'Panzercolony: Armor 토큰은 Field(Knight Pool) / Dragon(Sheet) / Remnant(Primal Remnant BP)에 놓임. Migrate = Remnant → Field → Dragon → Remnant로 동시에 이동 [해석, 확인 필요 — 도식 방향]. Dragon의 Armor 토큰 1개당 Panzerdragon BP AT +1',
  'Field of Parasites: Second Ability Window 종료 시 Field의 Armor 토큰 수만큼 Knight Pool의 Knight 토큰을 버림(플레이어 선택). Panzerdragon의 왼쪽/오른쪽 면에 인접한 기사는 Field of Parasites BP(AT 5 + Field 토큰)를 대신 공격할 수 있음 — Wound해도 Escalate·Wound Stack 없음',
  'Primal Remnant: 절대 활성화하지 않는 Lumbering 몬스터. BP AT 5 + Remnant 토큰 ×2. Remnant에 토큰 7개 이상이면 Iron Apotheosis(패배). Remnant Move X = Panzerdragon 주위 고리(모서리 포함 16칸)를 시계 방향으로 X칸. 고리의 칸이 보드 밖이면 보드 밖에 있는 채로 돎(그동안은 공격할 수 없고 아무것도 밟지 않음). 지나가거나 멈춘 칸의 기사는 사망, Terrain 타일은 소멸. Panzerdragon이 이동하면 고리의 같은 자리로 따라감',
  'Divine Fervor: Divine Target 기사가 공격 대상이 되면 +1 [P], Priority Target 기사가 대상이 되면 Parasitize 1. Divine Target 기사는 프리 액션으로 Peril Check를 하고 토큰을 넘길 수 있음. 토큰 보유자가 죽으면 Devotion 토큰이 가장 많은 기사에게',
  'Turn to Rust: [P]가 9를 넘게 되면 사망 (공격 중이면 공격을 마친 뒤)',
  'Mortal Retribution: Armor 토큰을 버릴 때마다 Generic 토큰 1 (최대 8). 8개면 기사 1명이 모두 버리고 추가 Combat action (프리 액션으로 선언)',
  'VP (Ruptured Carapace): Critical로 생성. Climb = Might 8+, Monster Round 종료 시 Fortitude 9+ (실패: Displace, Knockdown). VP 위에서는 Armor 토큰 무시, 자기 턴 종료 시 +1 [P]와 Migrate',
  'Beam: Rust Beam = 정면 가운데 1줄, Metal / Ultrametal Beam = Panzerdragon 폭(3줄), 보드 끝까지. Lateral Movement = 대상이 Beam 안에 들어올 때까지 옆으로 이동 [해석, 확인 필요]',
  'Zone 도식: 정면에서 넓어지는 삼각형 — Rustgasp 3/5/7 (15칸), Rustbreath 3/5/7/9 (24칸), Rubiginous Disgorge 3/5/7/9/11 (35칸)',
  '"P4+: Bane 2 instead" 등 [P] 게이트는 대상 기사의 [P]로 판정',
  '"Disable Wave Attacks / Beam Zone Attacks / Zone X" Critical: 카드를 제거하지 않음 — 해당 AI 카드가 뽑혀 수행하려 할 때 그냥 무시하고 버림',
  'Drachendämmerung(Routine): 모든 기사 Bane 3, [P]가 가장 높은 기사 사망, Panzerdragon이 보드 중앙으로 이동해 가장 많은 기사를 바라봄',
  'Lumbering: 기사의 Pushback / Knockback / Drag / Pull은 Panzerdragon에 무효(Ignore Lumbering 제외). Septic Slash "P5+: Ignore your Armor Gear card" = 대상의 [P]가 5 이상이면 Armor Roll에서 Armor Gear 카드의 주사위를 빼고 굴림(Reinforce 등은 유지) [해석, 확인 필요]. Shadow of Doom의 Saint 카드: 특정 Saint에 Devote한 기사만 해당(현재 캠페인에서 얻는 경로 없음)',
  "미구현(스토리 항목): Sliver of Lost Glory Critical의 \"see 9350\". Fool's deck은 이 Clash에서 참조하는 카드가 없음",
 ]}
# The whole Panzerdragon sheet was checked by the owner on 2026-11-21 (items still marked [해석, 확인 필요] are new questions)
import re
OK = ' (소유자 확인 2026-11-21)'
KEEP = ('Septic Slash "P5+',)
d['rulings'] = [r if any(x in r for x in KEEP) else re.sub(r' ?\[해석, 확인 필요[^\]]*\]', '', r) for r in d['rulings']]
d['rulings'] = [r if '소유자 확인' in r or '확인 필요' in r else r + OK for r in d['rulings']]
d['clashSetup']['notes'] = [re.sub(r' ?\[해석, 확인 필요[^\]]*\]', OK, x) for x in d['clashSetup'].get('notes', [])]
import reactfix; reactfix.apply('panzerdragon-veldr', d)
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
