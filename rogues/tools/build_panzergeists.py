# Builds data/monsters/panzergeists.json (Mob Clash) from docs/transcriptions/panzergeists_raw.json (owner scans 2026-11-17) + hand-written ops
# + Clash Setup (expansion Codex p.54–55). Usage: python3 tools/build_panzergeists.py data/monsters/panzergeists.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/panzergeists_raw.json')); S = raw['sheet']; CS = raw['clashSetup']
V = lambda n: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': True}
RUST = {'op': 'pzRust', 'onHit': True}; LOW = lambda n: {'op': 'pzLower', 'n': n}; KD = {'op': 'knockdown'}; KDH = {'op': 'pzKnockdown', 'onHit': True}
TOK = lambda n: {'op': 'pzToToken', 'n': n, 'who': 'this'}; HV = lambda g, n: {'op': 'vigorPerHitInstead', 'stat': 'heat', 'gte': g, 'n': n}
IR = lambda g: {'op': 'ignoreReact', 'stat': 'heat', 'gte': g}
AI = {
 'Flesh to Rust': dict(gates=[HV(3, 2)], effects=[V(1)], afterAttack=[{'op': 'pzRust'}, LOW(3)]),
 'Tarnishing Touch': dict(effects=[V(1), RUST], afterAttack=[{'op': 'pzArmorGear', 'mode': 'exhaust'}]),
 'Phantasmal Backstab': dict(effects=[V(2)], afterAttack=[TOK(3)]),
 'Chill the Spine': dict(gates=[IR(3)], effects=[V(6), KDH], afterAttack=[LOW(3)]),
 'Geist Slam': dict(effects=[V(7)], afterAttack=[KD]),
 'Bewitching Brush': dict(effects=[V(3), RUST], afterAttack=[TOK(5)]),
 'Corroding Grasp': dict(effects=[V(4), RUST], afterAttack=[{'op': 'pzArmorGear', 'mode': 'discard'}]),
 'Spectral Shriek': dict(gates=[IR(3)], effects=[V(9)], afterAttack=[KD]),
 'Lifescourge': dict(effects=[V(2), {'op': 'pzRust', 'perHit': True, 'onHit': True}, KDH], afterAttack=[{'op': 'pzIfDied', 'then': [{'op': 'pzRepeat'}], 'else': [{'op': 'pzLower', 'n': 'bane'}]}]),
 'Rend the Spirit': dict(gates=[{'op': 'evasionDice', 'stat': 'heat', 'gte': 2, 'n': 1}], effects=[V(4), {'op': 'pzBanePerHit', 'n': 2}], afterAttack=[{'op': 'pzIfDied', 'then': [{'op': 'pzAllTokensToThis'}], 'else': [{'op': 'pzLower', 'n': 'all'}]}]),
}
SIG = dict(effects=[V(4)], afterAttack=[LOW(3)])
WR = [{'op': 'pzLowerPerWound'}]; REC = lambda n: {'op': 'pzRecover', 'n': n}; AWAY = lambda n: {'op': 'pzAway', 'n': n}
BA3 = {'op': 'moveAndBonusAttack', 'n': 3, 'upTo': True, 'who': 'other'}; CT = lambda n: {'op': 'pzToToken', 'n': n, 'who': 'closest'}
RUSTA = {'op': 'pzRust'}
BP = {
 'Ghostly Gaoler': dict(whenRevealed=WR, fail=[RUSTA], critical=[{'op': 'pzRecoverOrBane', 'recover': 3, 'bane': 2}]),
 'Damned Wiseman': dict(wound=[KD], fail=[LOW(3), AWAY(3)], critical=[BA3]),
 'Spirit Guard': dict(instinct=[RUSTA, KD], critical=[REC(3), {'op': 'pzStandOther'}]),
 'Ethereal Servant': dict(whenRevealed=WR, fail=[AWAY(3)], critical=[REC(3)]),
 'Phantasmal Clerk': dict(wound=[CT(3)], fail=[LOW(3)], critical=[BA3]),
 'Bastian, the Spook Cook': dict(wound=[CT(5)], fail=[{'op': 'pzKnockdownAdjacent', 'to': 'this'}], critical=[REC(5)], aura={'pzDie': 1}),
 'Gisela, the Adviser Apparition': dict(whenRevealed=WR, wound=[RUSTA, CT(5)], fail=[RUSTA, LOW(5)], critical=[BA3]),
 'Ulrich, the Phantom Captain': dict(wound=[KD], fail=[AWAY(5)], critical=[REC(5), {'op': 'pzDiscardBoardTokens', 'n': 2}], aura={'atOtherMobsZone': {'z': 99, 'n': 1}}),
 'Stephen, the Revenant Knight': dict(wound=[RUSTA, {'op': 'pzToToken', 'who': 'allOthers', 'n': 99}], fail=[{'op': 'pzKnockdownAdjacent', 'to': 'any'}, {'op': 'pzRustKnockedDown'}], critical=[{'op': 'winClash'}], cannotWound={'bp1OnTrack': 4}),
 'Ingrid, the Banshee Noble': dict(whenRevealed=[{'op': 'pzIngrid', 'n': 3}], wound=[RUSTA], fail=[RUSTA, {'op': 'pzLower', 'n': 'all'}], critical=[REC(5), {'op': 'disableTrait', 'id': 'Ceaseless Hunger'}]),
}
def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec); tag = c.get('moveTag') or ''
    ops = {'targeting': [t.replace('[V]', '[Vigor]').replace('Not Possessed ', '') for t in c['targeting']], 'move': tag.startswith('MOVE'), 'appearBehind': 'BEHIND' in tag, 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'), 'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': None, 'pzDice': True}
    c['typePrinted'] = c['type']; c['type'] = 'attack'; c['evasionDice'] = int(str(c['evasionDice']).rstrip('!')); c['ops'] = ops; return c
def bp(c):
    c = copy.deepcopy(c); spec = BP[c['name']]; ops = {'at': c['at'], 'overcome': None}
    for k in ('wound', 'fail', 'instinct', 'critical', 'whenRevealed', 'aura', 'cannotWound'):
        if k in spec: ops[k] = spec[k]
    c['ops'] = ops; return c
missing = [c['name'] for c in raw['ai'] if c['name'] not in AI]; assert not missing, missing
levels = {l: {'toHit': int(v['toHit'].rstrip('+!')), 'wounds': v['wounds'], 'exhibitionWounds': v['exhibitionWounds'], 'activations': v['activations'], 'activationsText': '1 AI, 1 S', 'traitsAdd': v['traitsAdd'], 'bonuses': v['bonuses']} for l, v in S['levels'].items()}
FACE = {'N': 'up', 'S': 'down', 'E': 'right', 'W': 'left'}
d = {
 'id': 'panzergeists', 'name': 'Panzergeists', 'kind': 'mob', 'code': S['code'], 'traitsLine': S['traitsLine'],
 '_source': 'Monster Sheet (2 pages), AI/BP/Routine card sheet, Signature card — owner scans 2026-11-17; reference sheet Panzergeists v1.1; Clash Setup: expansion Codex p.54–55',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the cell directly behind (R on the sheet diagram)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Superior Bypass', 'rule': 'Moves through miniatures and Terrain.'}, {'name': 'Nevermore Spawn', 'rule': 'Killed Panzergeists are not replaced.'}],
 'levels': levels, 'traits': [{**t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'pzRoutine'}]}},
 'pz': {'armorTokens': CS['armorTokens']},
 'clashSetup': {'_source': 'Expansion Codex p.54–55 (Panzergeists Clash)', 'steps': CS['steps'], 'requiredTiles': CS['requiredTiles'],
  'mobStart': [{'cell': c, 'facing': FACE[f]} for c, f in CS['mobStart']], 'mobTrack': {'1': 5, '2': 3, '3': 2}, 'knightStart': CS['knightStart'], 'terrain': CS['terrain'], 'armorTokens': CS['armorTokens'],
  'unclear': CS.get('unclear', []), 'notes': ['지형·시작 칸·Armor 토큰 위치는 코덱스 도식에서 읽음 [해석, 확인 필요]']},
 'rulings': [
  'Suit Up!: 보드의 Armor 토큰 칸을 지나거나 그 위에 멈추면 그 Mob의 BP로 옮김(Armor 토큰 1개 = AT +1). Armor 토큰이 있는 Geist를 부상시키면 토큰을 그 칸에 놓음 (참고 시트 v1.1)',
  'Superior Bypass 이동은 최단 경로 중 Armor 토큰을 가장 많이 줍는 경로로 처리 [해석, 확인 필요]',
  '"MOVE BEHIND & ATTACK": 대상에 인접한 빈 칸 중 Geist의 출발 칸에서 가장 먼 칸으로 이동 (Appear Behind와 같은 방식) [해석, 확인 필요]',
  'All Things Die: Armor 토큰이 없는 Geist를 Rust·Ethereal·Holy Trait가 없는 무기로 공격하면 To Hit +4. Rust: 장착한 Metal Gear마다 Bane 토큰 1개(Bane으로 계산), 그 Gear는 Rust를 얻고 Metal을 잃음',
  'Muffled Potential: 시트 문구대로 "Rust Trait가 있는 무기로 공격할 때" Power die마다 Potential 1 무시 (참고 시트 v1.1은 반대로 적혀 있음) [해석, 확인 필요]',
  'Ceaseless Hunger: Maximum Vigor가 0 이하가 되면 가장 가까운 (빙의 중이 아닌) Mob이 기사 칸으로 옮겨와 빙의. 빙의된 기사는 턴을 건너뛰고 대상이 되지 않음. 그 Mob을 부상시키면 그 칸에서 풀려나고 Maximum Vigor 복구(Vigor는 그대로). 모든 기사가 빙의되면 패배. Clash 종료 시 빙의 상태면 사망 [해석, 확인 필요]',
  'Clash 종료 시 빙의 → Maximum Vigor 영구 -1: 미구현 (캠페인 반영 안 됨)',
  'Recover X: Maximum Vigor +X (Clash 종료까지), 그 뒤 Vigor +X',
  'Panzer Cascade: Escalation 덱에 AI가 없으면 일반 보너스 대신 가장 낮은 BP Level의 Mob에 Armor 토큰 1개',
  'No Rest for Any: 빙의된 기사의 "턴 시작"은 Knight Round 시작 시 처리 [해석, 확인 필요]',
  'BP "When you reveal": 그 Mob을 명중시킨 기사 (참고 시트)',
  '"Discard Bane tokens": Gear 위(Rust)가 아닌 Bane 토큰부터 버림 [해석, 확인 필요]',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP')
