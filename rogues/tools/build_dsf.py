# Builds data/monsters/devil-of-the-smelted-fears.json (Devil Clash) from docs/transcriptions/devil_of_the_smelted_fears_raw.json
# + hand-written ops + Clash Setup (Principality of Stone Codex p.52–53). Usage: python3 tools/build_dsf.py data/monsters/devil-of-the-smelted-fears.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/devil_of_the_smelted_fears_raw.json')); S = raw['sheet']
ICON = lambda s: s.replace('[H]', '[Heat]').replace('[P]', '[Passion]').replace('[V]', '[Vigor]')
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}; K = lambda op, who='target', perHit=False, **kw: {'op': 'dsfK', 'k': {'op': op, **kw}, 'who': who, 'perHit': perHit}
HEAT = lambda n, who='target', perHit=False: K('gainHeat', who, perHit, n=n); BANE = lambda n, who='target': K('bane', who, n=n); KD = {'op': 'knockdown'}; RX = {'op': 'reactWindow', 'at': 'mid'}
F = lambda n, **k: {'op': 'dsfFerro', 'n': n, **k}; OUB = lambda who='target', **k: {'op': 'dsfOubliette', 'who': who, **k}; IFH = lambda gte, *ops: {'op': 'dsfIfHits', 'gte': gte, 'then': list(ops)}
GK = lambda who='target': {'op': 'dsfGatekeeper', 'who': who}; GC = lambda who='target': {'op': 'dsfGatecrasher', 'who': who}; EXH = lambda n, who='target', mode='exhaust': {'op': 'dsfExhaust', 'n': n, 'who': who, 'mode': mode}
G = lambda gte, **k: {'stat': 'heat', 'gte': gte, **k}; DIE1 = lambda gte: G(gte, op='evasionDice', n=1); HG = lambda gte, *ops: G(gte, op='dsfAlso', alsoOps=list(ops)); CD = lambda perHit=True: K('cooldown', perHit=perHit, n=1)
PULL = [{'op': 'dsfPullIn'}]; APP = [{'op': 'dsfAppear'}]; TB = ['Tenacity', 'Bravery']; SI = ['Sagacity', 'Insight']
def bzone(rows):
    blk = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch in '^>v<']; xs = [x for x, _ in blk]; ys = [y for _, y in blk]
    return {'red': [(x - max(xs), y - min(ys)) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == 'R'], 'yellow': [], 'step': None, 'block': True}
AI = {
 'I Revel in Your Torment': dict(judge=TB, move=False, gates=[DIE1(5)], effects=[V(2), HEAT(1, perHit=True), IFH(2, OUB()), RX], afterAttack=[F(2)]),
 'Tail Swipe': dict(gates=[G(5, op='dsfDouble')], effects=[{'op': 'dsfHits', 'n': 5, 'flat': True, 'perilCheck': True}, KD, RX, {'op': 'dsfKnockLeft', 'n': 7}], afterAttack=[F(2)]),
 'Spear Downthrust': dict(type='zone', move=False, beforeAttack=[{'op': 'dsfLand'}], zoneAroundSelf=1, gates=[HG(4, GC())], effects=[V(2), IFH(2, EXH(1)), RX], afterFinalAttack=[F(2)]),
 'Spear Thrust': dict(pathAttack=True, gates=[HG(4, GC())], effects=[V(2), HEAT(1, perHit=True), BANE(1)], afterFinalAttack=[{'op': 'dsfPush', 'n': 3}, F(2)]),
 'Spear Bash': dict(gates=[HG(4, GK())], effects=[{'op': 'dsfHits', 'n': 5, 'flat': True, 'perilCheck': True}, HEAT(2), KD, RX], afterAttack=[F(2), {'op': 'dsfKnockLeft', 'n': 5}]),
 'The Jaws of Hell': dict(judge=TB, move=False, beforeAttack=PULL, effects=[{'op': 'dsfHits', 'n': 3, 'shield': 2, 'perilCheck': True}, CD()], afterAttack=[F(2), OUB()]),
 'The Decalogue of Suffering': dict(judge=TB, move=False, gates=[DIE1(5)], effects=[V(2), HEAT(2, perHit=True), IFH(2, OUB(elseDie=True)), RX], afterAttack=[F(3)]),
 'Merciless Impalement': dict(type='zone', move=False, beforeAttack=[{'op': 'dsfLand'}], zoneAroundSelf=2, gates=[HG(5, GC())], effects=[V(3), IFH(3, EXH(2))], afterFinalAttack=[F(3)]),
 'Vile Vortex': dict(gates=[HG(5, GC())], effects=[V(4), HEAT(1, perHit=True), {'op': 'dsfVortex', 'vault': True}], afterFinalAttack=[F(3), {'op': 'dsfVortex'}]),
 'Tormentor of Souls': dict(judge=TB, move=False, beforeAttack=PULL, effects=[{'op': 'dsfHits', 'n': 4, 'shield': 3, 'perilCheck': True}, CD(), {'op': 'dsfBaneFill'}, RX], afterAttack=[F(3)]),
 'Dragged Down Under': dict(judge=SI, gates=[HG(4, GK())], effects=[{'op': 'dsfHits', 'n': 'X', 'flat': True, 'perilCheck': True}, HEAT(2), KD, RX], afterAttack=[{'op': 'dsfOubKD'}, F(3)]),
 'Flaming Arc': dict(type='zone', gates=[HG(5, GC())], effects=[V(3), HEAT(1, perHit=True), BANE(1), RX], afterFinalAttack=[F(3)], zone=['..R.', '.RRR', '>>RR', '>>RR', '.RRR', '..R.']),
 'Smelting Point': dict(gates=[G(7, op='evasionDice', n=1, orLevel=3)], effects=[{'op': 'dsfSmelt'}], afterAttack=[F(4), EXH(1, mode='discard'), {'op': 'dsfPush', 'n': 3}]),
 'Molten Rain': dict(type='zone', move=False, targeting=['All Knights'], gates=[HG(6, GC())], effects=[V(2), HEAT(1, perHit=True), GK()], afterFinalAttack=[F(4)]),
 'Hell-ter Smelter': dict(pathAttack=True, effects=[V(2), HEAT(2, perHit=True), {'op': 'dsfFerro', 'n': 1, 'perHit': True}, RX], afterAttack=[{'op': 'dsfRepeatUnattacked'}]),
 'Smelting Kiss': dict(judge=TB, move=False, beforeAttack=PULL, gates=[HG(6, GC())], effects=[{'op': 'dsfHits', 'n': 4, 'shield': 2, 'perilCheck': True}, CD(), KD, RX], afterAttack=[F(4)]),
 'Searing Iron': dict(judge=SI, beforeAttack=[K('gainHeat', n=3)], effects=[{'op': 'dsfFerro', 'n': 1, 'perHit': True}, {'op': 'dsfHits', 'n': 'X', 'flat': True, 'perilCheck': True}, KD, RX], afterAttack=[F(2), {'op': 'dsfOubKD'}]),
 "Perdition's Flame": dict(move=False, beforeAttack=APP, gates=[HG(6, GK())], effects=[{'op': 'dsfHeatLose'}, RX], afterAttack=[{'op': 'dsfRepeatIfDied'}]),
}
SIG = dict(move=False, beforeAttack=APP, gates=[HG(6, GC())], effects=[{'op': 'dsfPush', 'n': 1}, V(2), HEAT(1, perHit=True), RX], afterAttack=[F(2, sig=True)])
SIGA = {'op': 'signatureAgainstAttacker'}; A = 'attacker'; BARG = {'op': 'dsfBargain'}; PT = {'op': 'dsfPriority'}; BA = {'op': 'dsfMoveBonus'}; FLAG = lambda i: {'op': 'dsfFlag', 'id': i}; CDA = K('cooldown', A, n=1)
BP = {
 'Rancid Loincloth': dict(oc=3, nb=True, wound=[OUB(A), PT], fail=[BARG, CDA], critical=[BA]),
 'Grotesque Tail': dict(oc=2, nb=True, wound=[{'op': 'dsfCenter'}, F(1)], fail=[KD, CDA], critical=[{'op': 'dsfScavenge', 'n': 1}]),
 'Tainted Gauntlet': dict(oc=3, wound=[F(1), GK(A)], fail=[BARG], critical=[{'op': 'dsfReset', 'choked': True}]),
 'Infested Knee Armor': dict(oc=3, wound=[F(1), CDA], fail=[BARG], critical=[{'op': 'dsfReset'}]),
 'Pale Hand': dict(oc=3, wound=[SIGA], fail=[GK(A)], critical=[BA]),
 'Scrap Metal Breastplate': dict(oc=2, wound=[F(1), PT], fail=[HEAT(1, A)], critical=[FLAG('ferroDown')]),
 'Exposed Tendon': dict(op=2, wound=[F(2), PT], fail=[BARG, K('delay', A, n=1)], critical=[FLAG('noSeqZone'), {'op': 'dsfNote', 'text': 'Sequential·Zone Attack 비활성은 아직 AI 카드에 적용되지 않음 (미구현)'}]),
 'Rotting Visage': dict(op=2, nb=True, wound=[{'op': 'dsfAI'}], fail=[K('discard', A, n=1)], critical=[FLAG('noGate')]),
 "Blasphemer's Horn": dict(op=3, wound=[F(2), {'op': 'dsfBaneOff', 'n': 1}], fail=[GK(A)], critical=[{'op': 'devote'}]),
 'Flayed Back': dict(op=2, instinct=[F(2)], wound=[GK(A)], critical=[{'op': 'additionalSingleWound'}]),
 'Skull Trophies': dict(op=3, nb=True, wound=[HEAT(2, A), PT], fail=[GK(A), GC(A)], critical=[{'op': 'dsfBaneOff', 'all': True, 'n': 'all', 'optional': True}]),
 'Spear of the Third Sacrament': dict(op=3, wound=[F(2), K('delay', A, n=1)], fail=[SIGA], critical=[BA]),
 'Smelting Tongue': dict(op=4, wound=[F(3), HEAT(2, A), PT], fail=[KD], critical=[{'op': 'dsfReset', 'all': True, 'choked': True}]),
 'Crucible of Smelted Fears': dict(op=3, instinct=[F(3)], critical=[{'op': 'dsfTithe', 'n': 'all', 'why': 'Critical'}]),
 'Smelter Oubliette': dict(op=3, wound=[{'op': 'dsfBaneOff', 'n': 1}], fail=[EXH(1, A, 'discard'), OUB(A)], critical=[FLAG('noOub')]),
 'Cursed Offertory Box': dict(op=3, wound=[{'op': 'dsfBaneOff', 'n': 2}], fail=[BANE(2, A), K('discard', A, n=1)], critical=[FLAG('free')]),
 'Chains of an Ancient Ritual': dict(op=2, fail=[BARG, K('discard', A, n=1)], instinct=[{'op': 'dsfAI'}], critical=[{'op': 'dsfScavenge', 'n': 2}]),
 'Fragment of a Primal Soul': dict(op=3, wound=[F(3)], fail=[BARG], critical=[{'op': 'slayMonster'}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('tag') or ''; c['targeting'] = [ICON(t) for t in c['targeting']]; z = spec.pop('zone', None)
    ops = {'targeting': spec.pop('targeting', c['targeting']), 'move': spec.pop('move', tag.startswith('MOVE')), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'attack'); c['moveTag'] = tag; ops.update(spec)
    if z: ops['zoneDiagram'] = bzone(z)
    c['afterAttack'] = (c['afterTag'] + ': ' + c['after']) if c.get('after') else None; c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; n = spec.get('oc') or spec.get('op')
    ops = {'at': c['at'], 'bargain': not spec.get('nb'), 'overcome': {'n': n, 'kind': 'overpower' if 'op' in spec else 'overcome', 'ops': [{'op': 'dsfTithe', 'n': 1, 'why': 'Overcome/Overpower'}]}}
    c['overcomeTag'] = 'OVERPOWER' if 'op' in spec else 'OVERCOME'; c['overcome'] = {'n': n, 'effect': 'Move 1 Armor token from the Devil onto the Smelter Oubliette Trait card'}
    c['responses'] = {k: c.get(k) for k in ('wound', 'fail', 'instinct', 'critical')}
    for k in ('wound', 'fail', 'instinct', 'critical'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI + Signature', 'traitsAdd': v['traitsAdd'], 'bonuses': {k: v['bonuses'].get(k, 0) for k in ('escalations', 'at', 'vigorLoss', 'evasionDice')}} for l, v in S['levels'].items()}
T = lambda *cells: [{'tile': 'column', 'cells': [c]} for c in cells]
d = {'id': 'devil-of-the-smelted-fears', 'name': S['name'], 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'], '_source': 'Owner scans 2026-11-19; Clash Setup: Principality of Stone Codex p.52–53',
 'footprint': {'size': 4, 'shape': '2x2', 'rear': 'the 2 cells directly behind the footprint', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 9}, {'name': 'Blindspot'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': 'Smelter Oubliette (Trait card)', 'level': 1, 'text': raw['traitCards'][0]['text'], 'implemented': True}],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG), 'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'dsfRoutine'}]}},
 'dsf': True,
 'clashSetup': {'_source': 'Principality of Stone Codex p.52–53 (Devil of the Smelted Fears Clash)', 'steps': ['Standard Preparations (Rulebook p.44)', 'Monster Positioning: Place the Devil of the Smelted Fears miniature on the space designated on the diagram. Note the facing direction indicated by the arrow.', "Additional Setup: Place the Smelter Oubliette Trait card, Panzergate tokens, and the Fool's deck near the Monster Sheet."],
  'requiredTiles': ['10x Column'], 'monsterCells': ['H2', 'H3', 'I2', 'I3'], 'facing': 'E', 'knightStart': ['G8', 'F10', 'E7', 'D9'], 'terrain': T('J9', 'I7', 'I13', 'G12', 'F4', 'E13', 'D5', 'B4', 'B10', 'A8'),
  'notes': ['Column·시작 칸은 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Ferrobaptism X: Devil이 Armor 토큰 X개를 얻음. Armor 토큰 1개당 모든 BP의 AT +1. Level 3+: Signature의 Ferrobaptism +1',
  'Bargain: Bane 1 → 버림 더미를 섞거나 카드를 한 장씩 뽑음(멈추거나 A/B가 나올 때까지). A가 나오면 뽑은 카드를 모두 버리고(다른 카드 효과 없음) Oubliette로 이동, 버림 더미를 덱에 섞음. 그 외에는 뽑은 순서대로 C/D/E = Armor 토큰 3/2/1개, F = Heat +1로 1개, B = 중단 + Discard. 버린 Armor 토큰은 Smelter Oubliette 카드로 (The Iron Tithe) [해석, 확인 필요]',
  'Smelter Oubliette: 안에 있는 기사는 보드 밖(Devil에 인접·사거리 무관 공격 가능, 몬스터 시야 밖, 비자발 이동 없음). Escape = Move action, 카드의 Armor 토큰 X개(5 + Baptized in Metal을 가진 기사 수)를 버리고 Board Edge에서 4칸 이상 떨어진 칸으로, Baptized in Metal 획득. 턴 종료 시 Choke(Passion) 후 Heat만큼 [V] 손실 [해석, 확인 필요]',
  'Gatekeeper: Panzergate 토큰이 없으면 1개. Wound를 주거나 Knight Round 종료 시 다른 기사에 인접하면 버림. 토큰이 있으면 Bargain과 Escape 불가. Gatecrasher: Armor(Armor Gear)·Shield Trait Gear를 모두 Exhaust, Panzergate 토큰이 있으면 Discard',
  'Molten Chains (Lv2+): Stains of Profanity 표로 Peril 등급이 정해진 Peril Check 뒤에 벌칙 — Cooldown/Delay/Discard는 손패에서 무작위 1장, Gear Exhaust는 플레이어 선택',
  'Only Fear Will Remain (Lv3): 이 몬스터의 효과(공격·Gatecrasher·Molten Chains·Shield/Helmet 대체)로 Gear를 Exhaust/Discard할 때만 Choke 1 — 기사가 스스로 비용으로 Exhaust하는 경우는 아직 미연결 [해석, 확인 필요]',
  'Zone 도식: Flaming Arc = 정면의 호 모양(작은 그림에서 읽음) [해석, 확인 필요]. Spear Downthrust / Merciless Impalement = Land on Top + Knockdown 후 Devil 주변 Zone 1 / 2',
  '"Knockback N to the left" = Devil이 바라보는 방향 기준 왼쪽 [해석, 확인 필요]',
  'Pull Unlimited & Judge: 대상을 Devil에 인접할 때까지 끌어옴',
  'Appear Behind: 대상에 인접한 칸 중 Devil의 현재 위치에서 가장 먼 쪽(대상의 반대편)에 나타남 [해석, 확인 필요]',
  'Vile Vortex: 명중 시 Devil이 중앙에 더 가까우면 Forced Vault. After: [V]를 잃었다면 대상을 보드 중앙 쪽으로 Pushback(중앙까지), 그 중 Crash는 -4 [V]로 대체 [해석, 확인 필요]',
  'Smelting Point: 명중 1/2/3회 = Massive Peril -5/-9/-12의 You Died 카드를 이번 Judicium에만 추가 [해석, 확인 필요]',
  'Hell-ter Smelter: [V]를 잃었으면 이번에 공격받지 않은 기사 중 가장 먼 기사에게 반복, 모두 공격받거나 [V] 손실이 없을 때까지 [해석, 확인 필요]',
  'Blessing of Fear(Routine): Ferrobaptism 2, 모든 기사 Bane X(X = Devil의 Armor 토큰), 무작위 기사를 중앙 4칸 중 한 곳으로',
  '미구현: "You may voluntarily fail this Attack"(Rancid Loincloth, Rotting Visage), Exposed Tendon Critical의 Sequential·Zone Attack 비활성, Hell-ter Smelter의 Heat 6+ 게이트(Bonus Attack·Chain Break 무시), 각 AI 카드의 REACT! 창 위치(효과 사이 창은 넣음)',
 ]}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
