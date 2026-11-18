# Builds data/monsters/knighteater.json (Vassal Clash) from docs/transcriptions/knighteater_raw.json (owner scans 2026-11-17) + hand-written ops
# + Clash Setup (expansion Codex p.50–51). Usage: python3 tools/build_knighteater.py data/monsters/knighteater.json
import json, sys, copy, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'newmon'))
from common import apply_react
import re
raw = json.load(open('docs/transcriptions/knighteater_raw.json')); S = raw['sheet']; CS = raw['clashSetup']
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}
WD = lambda n: {'op': 'keWolf', 'n': n}; ON = lambda *ops: [{'op': 'keOnHit', 'then': list(ops)}]; COND = lambda i: {'op': 'keCondition', 'id': i}
DRAG = lambda n: {'op': 'keDrag', 'n': n}; FV = {'op': 'keVault'}; FVP = {'op': 'keVault', 'crashToPeril': True}; PEN = {'op': 'penetrate'}
HD = lambda g: {'op': 'evasionDice', 'stat': 'heat', 'gte': g, 'n': 1}; HV = lambda g, n: {'op': 'vigorPerHitInstead', 'stat': 'heat', 'gte': g, 'n': n}
GEAR = lambda mode, typ: {'op': 'keGear', 'mode': mode, 'type': typ}; CENTER = [{'op': 'moveToCenter'}, {'op': 'faceMostKnights'}, {'op': 'keSettle'}]
HT = lambda *t: {'op': 'keHits', 'table': list(t)}
LP = ['Lowest Peril Threshold', 'Closest Squire']; HP = ['Highest Peril Threshold', 'Closest Squire']
AI = {
 'Tongue Twister': dict(targeting=LP, effects=ON(V(1), {'op': 'kePerHit', 'then': [WD(1), DRAG(1)]})),
 'Terrorizing Presence': dict(type='judgement', judge=['Bravery', 'Fortitude'], pre=[WD(1)], gates=[HD(3)], effects=ON(V(2), COND('Fear')), afterFinalAttack=[WD(1)]),
 'Armor Cracker': dict(pre=[WD(2)], gates=[HD(3)], effects=ON(PEN, V(3)), afterFinalAttack=[GEAR('exhaust', 'armor')]),
 'Fencer’s Thrust': dict(gates=[{'op': 'keNoteGate', 'stat': 'heat', 'gte': 4}], effects=ON(HT(2, 5, 7)), afterFinalAttack=[{'op': 'keArmor', 'n': 1}]),
 'Lung Vorspeisen': dict(gates=[HD(3)], effects=ON(V(3), COND('Fear'), DRAG(2)), afterFinalAttack=[WD(2)]),
 'Scraps Disposal': dict(pre=[WD(2)], gates=[HV(3, 2)], effects=ON(V(1), GEAR('exhaust', 'weapon'), FV), afterFinalAttack=[{'op': 'keAway', 'n': 2, 'from': 'target'}]),
 'Ritterspieße': dict(targeting=HP, effects=ON(V(3), GEAR('exhaust', 'armor'), FVP), afterFinalAttack=[WD(3)]),
 'Debilitating Crush': dict(targeting=['Knight with a Two-handed Weapon', 'Highest Peril Threshold'], pre=[WD(2)], gates=[HD(3), {'op': 'keAfterWolf', 'stat': 'heat', 'gte': 2, 'n': 1}], effects=ON(PEN, V(4), COND('Dread')), afterFinalAttack=[GEAR('exhaust', 'weapon'), {'op': 'keGatedWolf'}]),
 'Can Opener': dict(pre=[WD(2)], gates=[HD(3)], effects=ON(PEN, V(3), FV), afterFinalAttack=[{'op': 'keGear', 'mode': 'discard', 'type': 'armor', 'perilToExhaust': True}]),
 'Lamb to Slaughter': dict(gates=[{'op': 'keNoteGate', 'stat': 'heat', 'gte': 3}], effects=ON(V(3), COND('Fear'), DRAG(3)), afterFinalAttack=[WD(2), WD(1)]),
 'Playing with Your Food': dict(targeting=['Highest [Passion]'], gates=[HV(2, 5)], beforeAttack=[{'op': 'keOtherSide'}], effects=ON(V(4), FV, {'op': 'knockback', 'n': 3}), afterFinalAttack=[GEAR('exhaust', 'all')]),
 'Hit and Run': dict(pre=[WD(3)], effects=ON(HT(3, 7, 10, 'devour')), afterFinalAttack=CENTER),
 'Offal Harvest': dict(pre=[WD(3)], gates=[HD(5)], effects=ON(PEN, {'op': 'keJudDevour'}, V(5), COND('Fear')), afterFinalAttack=[WD(2)]),
 'Knight Smash!': dict(targeting=['Lowest [Passion]'], effects=ON(DRAG(2), V(2), {'op': 'kePerHit', 'then': [FV]}, {'op': 'keKnockbackRandom', 'n': 5})),
 'Blood-Drenched Butchery': dict(pre=[WD(2)], gates=[{'op': 'difficultyInstead', 'stat': 'heat', 'gte': 3, 'n': 10}], effects=ON(PEN, V(4), COND('Dread'), FV), afterFinalAttack=[GEAR('exhaust', 'armor'), WD(2)]),
 'Knight Opener': dict(pre=[WD(3)], effects=[GEAR('discard', 'armor')] + ON(HT(5, 11, 'devour')), afterFinalAttack=[{'op': 'keDreadLoS'}]),
 'Dine and Dash': dict(targeting=HP, gates=[HD(4)], effects=ON(V(2), {'op': 'kePerHit', 'then': [WD(2)]}), afterFinalAttack=CENTER),
 'Personal Vendetta': dict(targeting=['Fleischritter', 'Highest Peril Threshold'], gates=[HD(3)], effects=ON({'op': 'keDevourOnHit'}) + [{'op': 'keIfSurvived', 'then': [COND('Dread')]}], afterFinalAttack=[GEAR('discard', 'weapon'), {'op': 'keWolf', 'n': 'fleisch'}]),
}
SIG = dict(targeting=['Highest [Passion]'], gates=[{'op': 'keNoteGate', 'stat': 'heat', 'gte': 3}], effects=ON(V(1), {'op': 'keIfHits', 'gte': 3, 'then': [COND('Fear')]}), afterFinalAttack=[WD(2)])
FL = lambda n: {'op': 'keFleisch', 'n': n}; DA = lambda n: {'op': 'keArmor', 'n': -n}; WDX = [{'op': 'keWolf', 'n': 'level', 'minLevel': 2}]
AWAY = lambda n, stop=True: [{'op': 'keAway', 'n': n, 'from': 'attacker', 'stop': stop}]; PBS = lambda n: [{'op': 'kePushback', 'n': n}]
PTBA = [{'op': 'kePriority'}, {'op': 'bonusAttack', 'who': 'self', 'optional': True}]; F2 = [{'op': 'keFleischUpTo', 'n': 2}]; FWD = {'op': 'keForward', 'n': 3}
BP = {
 'Trophy Knight': dict(ultra=WDX, wound=[DRAG(2), FV], fail=[DA(1)], critical=F2),
 'Rusting Breastplate': dict(ultra=WDX, wound=[FL(1), FWD], critical=PTBA),
 'Emergency Snack': dict(ultra=WDX, wound=[COND('Fear'), FL(1), FV], critical=F2),
 'Tattered Garments': dict(ultra=AWAY(1), fail=[WD(2)], critical=PTBA),
 'Tight Tassets': dict(ultra=WDX, wound=[FWD], fail=[WD(2), DA(1)], critical=PTBA),
 'Tarnished Sabatons': dict(ultra=AWAY(1), fail=[WD(2)], critical=[{'op': 'keFlag', 'id': 'tumble'}]),
 'Gruesome Display': dict(ultra=WDX, wound=[FVP, COND('Fear')], critical=F2),
 'Riddled Plackart': dict(ultra=PBS(2), fail=[WD(2), DA(1)], critical=[{'op': 'scavenge', 'n': 2}]),
 'Grim Visage': dict(ultra=AWAY(1), wound=[FL(1), COND('Dread')], fail=[WD(2), COND('Fear'), DA(2)], critical=[{'op': 'keFlag', 'id': 'noFear'}]),
 'Spiky Pauldron': dict(ultra=WDX, instinct=AWAY(3, False) + [FL(1)], critical=PTBA),
 'Cannibal’s Mouthpiece': dict(ultra=WDX, mayEnd=True, wound=[FL(1), DRAG(2)], fail=[WD(2), DA(2), {'op': 'keAdjacentDevour'}], critical=[{'op': 'keFlag', 'id': 'noDeath'}]),
 'Rickety Knees': dict(ultra=AWAY(2), instinct=[WD(1), DRAG(2)], critical=[{'op': 'keFlag', 'id': 'ultraToInstinct'}]),
 'Famished Maw': dict(ultra=PBS(3), wound=[COND('Dread'), FV], fail=[WD(4), DA(2)], critical=[{'op': 'keFlag', 'id': 'noWolf'}]),
 'Overtuned Ear Canal': dict(ultra=AWAY(3), wound=[{'op': 'keRandomMove', 'n': 5}], fail=[{'op': 'moveToCenter'}, {'op': 'keFaceAttacker'}, {'op': 'keSettle'}], critical=[{'op': 'keFlag', 'id': 'noUltra'}]),
 'Monstrous Stomach': dict(ultra=WDX, mayEnd=True, wound=[WD(3), WD(2), WD(1)], fail=[WD(4), DA(1), {'op': 'keAdjacentDevour'}], critical=[{'op': 'keCalm'}, {'op': 'keFleischUpTo', 'n': 4}]),
 'Intestinal Panzerparasite': dict(ultra=WDX, wound=[{'op': 'parasitize', 'n': 2}, FL(1)], fail=[WD(2), DA(2)], critical=[{'op': 'keFlag', 'id': 'noArmor'}]),
 'Knightcrackers': dict(ultra=PBS(3), instinct=[WD(2), DA(2), FVP], critical=[{'op': 'scavenge', 'n': 2}]),
 'Ravenous Heart': dict(ultra=AWAY(2), wound=[COND('Dread'), FL(1)] + AWAY(4, False), fail=[{'op': 'keAdjacentFear'}], critical=[{'op': 'slayMonster'}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    tgt = spec.pop('targeting', [t.replace('[P]', '[Passion]') for t in c['targeting']])
    ops = {'targeting': tgt, 'move': tag.startswith('MOVE'), 'keAppear': tag.startswith('APPEAR BEHIND'), 'gates': spec.pop('gates', []), 'before': spec.pop('before', []), 'effects': spec.pop('effects'), 'afterAttack': None, 'afterFinalAttack': spec.pop('afterFinalAttack', None)}
    c['typePrinted'] = c['type']; c['type'] = spec.pop('type', 'attack'); ops.update(spec); c['ops'] = ops; return apply_react(c)
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; oc = c['overcome']; m = re.search(r'(\d)', oc['effect'])
    ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': [FL(int(m.group(1)))] if oc['tag'] == 'OVERPOWER' else [DA(int(m.group(1)))]}}
    c['overcomeTag'] = oc['tag']
    for k in ('wound', 'fail', 'instinct', 'critical', 'ultra', 'mayEnd'): ops[k] = spec.get(k)
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI', 'traitsAdd': [t for t in v['traitsAdd'] if not t.startswith('Kingdom Trait')], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
KT = {x['name']: x for x in raw['extra']}
d = {
 'id': 'knighteater', 'name': 'Knighteater', 'kind': 'boss', 'code': S['code'], 'traitsLine': S['traitsLine'],
 '_source': 'Monster Sheet (2 pages), AI/BP/Routine/Kingdom Trait card sheet, Signature card — owner scans 2026-11-17; reference sheet Knighteater; Clash Setup: expansion Codex p.50–51',
 'footprint': {'size': 4, 'shape': '2x2', 'rear': 'the 2 cells directly behind the footprint', 'blindspots': 'both rear cells', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Unavoidable Knockback', 'value': 4}, {'name': 'Blindspot'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']] + [{'name': n, 'level': 1, 'text': f"[Kingdom Trait — {KT[n]['kingdom']}] " + KT[n]['text'], 'implemented': True} for n in ('Iron Confines', 'Adaptable')],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'keRoutine'}]}},
 'ke': {'kingdomTrait': {'sunken': 'Adaptable', 'principality': 'Iron Confines'}},
 'clashSetup': {'_source': 'Expansion Codex p.50–51 (Knighteater Clash)', 'steps': CS['steps'], 'requiredTiles': CS['requiredTiles'], 'monsterCells': CS['monsterCells'], 'monsterFacing': 'bottom Minor Mortis arrow: ↑/↓ → facing ↓, ←/→ → facing ←',
  'knightStart': CS['knightStart'], 'terrain': CS['terrain'], 'notes': ['지형·시작 칸은 코덱스 도식에서 읽음 (소유자 확인 2026-11-18)']},
 'rulings': [
  'Armor 토큰: 개수만큼 모든 BP의 AT +1 (Mob이면 BP마다 적용) (소유자 확인 2026-11-18)',
  'Ultrainstinct: BP를 정한 직후, Power Roll 전에 처리 (Rulebook p.58). Crit Chance면 무시 (Eggknight와 같은 처리)',
  'Frenzied Hunger: Berserk 동안 Priority Target 토큰은 Knighteater Sheet에 있고 기사는 얻을 수 없음. Targeting 동률이면 동률인 기사 전원을 가까운 순서로 이동·공격(Sequential). Berserk가 공격 중에 풀리면 그 공격은 Chain Break',
  'Starved Slaughterman Additional Setup: 각 기사가 Peril check를 할지 선택 — 하면 Fleisch 토큰 1개. 긍정 Mortis 카드는 효과 무시',
  'Meatbait: 공격 선언 시 선택 — Precision -2로 공격하고 Fleisch 토큰을 Knighteater Level만큼 Knight Pool에',
  'Measured Movement: 이동 중 지나간 Column은 그대로 두고, 이동을 마쳤을 때 밑에 있는 Column은 인접한 빈 칸으로 옮김',
  'Appear Behind (Rulebook): 대상에 인접한 위치 중 현재 위치에서 가장 먼 곳에 놓고 대상을 향함',
  'Forced Vault (Rulebook): 인접한 기사를 Knighteater 반대편 인접 칸으로 옮김(비자발 이동). 보드 밖/파괴 불가 Obstacle이면 사망. "If this Vault would cause Crash, [Peril] instead": 도착 칸이 Obstacle/다른 미니어처면 Peril check로 대체 (소유자 확인 2026-11-18)',
  'Drag X: Knighteater가 대상 반대쪽으로 X칸 이동하고 대상이 같은 방향으로 따라옴 (인접해야 시작)',
  'Lowest / Highest Peril Threshold: Uninjured < Minor < Major < Grave < Judicium 순 (소유자 확인 2026-11-18)',
  '"Closest Squire" Targeting 줄: Squire 미구현이라 건너뜀',
  'Debilitating Crush Targeting 첫 줄: "Knight with a [Two-handed] Weapon" (소유자 확인 2026-11-17) — Two-handed 무기를 든 기사 중 가장 가까운 기사',
  '카드 맨 위 "Wolf Down X"(9장): 그 앞에 REACT! 창, Wolf Down은 Targeting보다 먼저 해결 (소유자 확인 2026-11-17)',
  'Penetrate (확장 Codex p.9): "During Armor Roll, ignore one of your Armor dice of the highest tier." — 그 공격의 Armor Roll에서 가장 높은 tier(white > black > red) 주사위 1개를 굴리지 않음 (소유자 확인 2026-11-18)',
  'devoured (die): 즉사. Cannibal’s Mouthpiece Critical 이후에는 Judicium Draw로 대체',
  '"You may voluntarily end this Attack before performing a Power Roll" (Cannibal’s Mouthpiece, Monstrous Stomach): Ultrainstinct 뒤에 물음. 끝내면 Knight Pool을 비우고 Response 없이 BP는 버림 (소유자 확인 2026-11-18)',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
