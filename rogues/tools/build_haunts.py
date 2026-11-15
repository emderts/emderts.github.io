# Builds data/monsters/haunts-of-utrebant.json from the owner-confirmed transcription (docs/transcriptions/haunts_of_utrebant_raw.json)
# plus hand-written engine ops. Clash Setup comes from the Sunken Kingdom Codex (not yet supplied → clashSetup null → not playable).
# Usage: python3 tools/build_haunts.py data/monsters/haunts-of-utrebant.json docs/transcriptions/haunts_clash_setup.json
import json, sys, copy
raw = json.load(open('docs/transcriptions/haunts_of_utrebant_raw.json'))
S = raw['sheet']

def zone(rows):
    """Diagram rows → offsets (fwd, right) relative to the Haunt; R = red, Y = yellow (No Mercy), ⇑/» = Spectral Step space."""
    mk = None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in '^>v<': mk = (x, y, ch)
    mx, my, f = mk
    def rel(x, y):
        dx, dy = x - mx, y - my
        return {'^': (-dy, dx), '>': (dx, dy), 'v': (dy, -dx), '<': (-dx, -dy)}[f]
    out = {'red': [], 'yellow': [], 'step': None}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == 'R': out['red'].append(rel(x, y))
            elif ch == 'Y': out['yellow'].append(rel(x, y))
            elif ch in '⇑»': out['step'] = rel(x, y)
    return out

V = lambda n, peril=True: {'op': 'loseVigorPerHit', 'n': n, 'perilCheck': peril}
L = lambda n, peril=True: {'op': 'attackVigor', 'n': n, 'perilCheck': peril}  # Judgement 'If hit, lose -N' (level / Ethereal bonuses apply)
COND = lambda c: {'op': 'condition', 'id': c}
HD = lambda gte, n=1: {'op': 'evasionDice', 'stat': 'heat', 'gte': gte, 'n': n}
KB = lambda n: {'op': 'knockback', 'n': n}
KD = {'op': 'knockdown'}; CD = {'op': 'cooldown'}; RS = {'op': 'restrain'}; DL = {'op': 'delay'}; DC = {'op': 'discard'}; FV = {'op': 'forcedVault'}
CH = lambda n: {'op': 'choke', 'n': n}
AWAY = lambda n: {'op': 'moveAway', 'n': n}

AI = {
 'Fleeting Visitation': dict(appearBehind=True, effects=[V(2)], afterAttack=[AWAY(3)]),
 'Poltergeist Pirouette': dict(effects=[V(3)], afterAttack=[KB(3)]),
 'Phantom Pain': dict(gates=[HD(3)], effects=[CH(1), V(2)], afterAttack=[KD]),
 'Piercing Gaze': dict(judge=['Bravery', 'Insight'], zoneJudge={'z': 1}, effects=[L(4), COND('Fear')], afterAttack=[CD, RS]),
 'Cut Down': dict(gates=[{'op': 'vigorPerHitInstead', 'stat': 'heat', 'gte': 3, 'n': 3}], effects=[V(2)], afterAttack=[CD]),
 'Polearm Thrust': dict(gates=[HD(3)], effects=[V(2)], afterAttack=[KB(3)]),
 'Blast from the Beyond': dict(gates=[HD(4)], effects=[V(2)], afterAttack=[KB(3), KD]),
 'Childish Kick': dict(appearBehind=True, gates=[HD(4)], effects=[{'op': 'vigorByHits', 'one': 3, 'more': 5, 'perilCheck': True}], afterAttack=[KB(3)]),
 'Blood-Curdling Whispers': dict(judge=['Bravery'], zoneJudge={'z': 1}, effects=[COND('Fear'), L(4)], afterAttack=[CD, CD]),
 'Overhead Smite': dict(effects=[V(2)], afterAttack=[DL]),
 'Terrorize': dict(effects=[CH(2), V(2)], afterAttack=[KB(4)]),
 'Hysterical Screech': dict(judge=['Fortitude'], effects=[COND('Dread'), L(3)], afterAttack=[RS, FV]),
 'A Wraith’s Lament': dict(judge=['Bravery'], gates=[HD(4)], effects=[L(6), COND('Dread')], afterAttack=[CD, RS, FV]),
 'Addled by Fear': dict(judge=['Bravery', 'Tenacity', 'Fortitude', 'Might', 'Insight', 'Sagacity'], effects=[L(8), CH(2), COND('Panicked')], afterAttack=[DL]),
 'The Ghastly Truth': dict(judge=['Bravery', 'Insight'], zoneAroundTile={'tile': '*', 'z': 1}, effects=[COND('Dread'), L(7)], afterAttack=[DL, DC]),
 'Spectral Strike': dict(effects=[V(3)], afterAttack=[KB(4)]),
 'Touch of Death': dict(appearBehind=True, effects=[CH(3), V(2)], afterAttack=[KB(3), KD]),
 'Phantom Fissure': dict(effects=[V(4)], afterAttack=[DC, FV]),
}
SIG = dict(gates=[HD(3)], effects=[V(1)], afterAttack=[FV, AWAY(4)])

MBA_OTHER = {'op': 'moveAndBonusAttack', 'n': 3, 'upTo': True, 'who': 'other'}
MBA_SELF = {'op': 'moveAndBonusAttack', 'n': 3, 'upTo': True}
PREC = {'op': 'permanentPrecision', 'n': 1}
BP = {
 'Executed Prisoner': dict(instinct=[KB(3)], critical=[PREC]),
 'Unknown Soldier': dict(wound=[CH(1)], critical=[PREC], aura={'knockbackBonus': 2}),
 'Man Denied Burial': dict(wound=[COND('Fear')], fail=[KB(3)], critical=[MBA_OTHER]),
 'Percy, Doomed by the Tide': dict(wound=[{'op': 'placeSwampUnderMob'}], instinct=[COND('Slimed')], critical=[COND('Courage')]),
 'The Unremarkable One': dict(wound=[{'op': 'escalateLowestAI'}], critical=[MBA_SELF, {'op': 'story', 'ref': '8915'}]),
 'Gordon, Adored by Many': dict(instinct=[FV], critical=[MBA_SELF], aura={'zone2Vigor': 2}),
 'Amelie, Peacefully Asleep': dict(wound=[{'op': 'loseVigor', 'n': 2}], fail=[FV], critical=[MBA_OTHER], aura={'allGates': True}),
 'Peter, Gone Too Young': dict(whenRevealed=[{'op': 'gainCurse', 'n': 1}], wound=[KB(5)], fail=[CH(2)], critical=[{'op': 'flipChosenBP'}]),
 'Woolf, the Unyielding': dict(instinct=[{'op': 'mobSignatureAgainst', 'which': 'furthest'}], critical=[COND('Courage')], aura={'woolfLock': 2}),
}
TYPE = {'ATTACK': 'attack', 'ZONE ATTACK': 'zone', 'JUDGEMENT': 'judgement', 'ZONE JUDGEMENT': 'judgement', 'SIGNATURE': 'attack'}

def ai(c, spec):
    c = copy.deepcopy(c); spec = dict(spec)
    ops = {'targeting': c['targeting'], 'move': 'MOVE' in (c.get('moveTag') or ''), 'gates': spec.pop('gates', []), 'before': [], 'effects': spec.pop('effects'),
           'afterAttack': spec.pop('afterAttack', None), 'afterFinalAttack': None}
    ops.update(spec)
    if c.get('zoneDiagram') and c['zoneDiagram'].get('rows'): ops['zoneDiagram'] = zone(c['zoneDiagram']['rows'])
    c['type'] = TYPE.get(c['type'], c['type'].lower()); c['ops'] = ops; return c

def bp(c, spec):
    c = copy.deepcopy(c); oc = c['overcome']
    ops = {'at': c['at'], 'overcome': {'n': oc['n'], 'ops': [{'op': 'power', 'n': 1}]} if oc else None}
    for k in ('wound', 'fail', 'instinct', 'critical', 'whenRevealed', 'aura'):
        if k in spec: ops[k] = spec[k]
    c['ops'] = ops; return c

missing = [c['name'] for c in raw['ai'] if c['name'] not in AI] + [c['name'] for c in raw['bp'] if c['name'] not in BP]
assert not missing, missing
TR = {'Intangible': 'intangible', 'Ethereal Unity': 'ethereal-unity', 'Spectral Step': 'spectral-step', 'Obscured Vision': 'obscured-vision', 'The Grim Gift': 'grim-gift', 'Revenge Served Ghastly Cold': 'revenge', 'No Mercy': 'no-mercy'}
levels = {}
for l, v in S['levels'].items():
    acts = v.get('activations') or (['AI', 'S'] if 'S' in v['activationsText'] else ['AI', 'AI'])
    b = v['bonuses']; levels[l] = {'toHit': v['toHit'], 'wounds': v['wounds'], 'exhibitionWounds': v.get('exhibitionWounds'), 'activations': acts, 'activationsText': v['activationsText'], 'traitsAdd': v['traitsAdd'], 'bonuses': {'escalations': b.get('escalations', 0), 'at': b.get('at', 0), 'vigorLoss': b.get('vigorLoss', 0)}}
setup = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
d = {
 'id': 'haunts-of-utrebant', 'name': 'Haunts of Utrebant', 'kind': 'mob', 'code': S.get('code'), 'traitsLine': S.get('traitsLine'),
 '_source': 'Monster Sheet (2 pages), AI/BP/Routine card sheet, Signature card — owner scans 2026-11-15 (readings owner-confirmed). Clash Setup: Sunken Kingdom Codex (pending)',
 'footprint': {'size': 1, 'shape': '1x1', 'rear': 'the single cell directly behind (R on the sheet diagram)', 'facingOnSheet': 'down'},
 'basicAbilities': [{'name': 'Superior Bypass', 'rule': 'Rulebook p.80: may move through other miniatures and enter/end on Obstacle spaces; cannot end voluntary movement on another miniature.'},
                    {'name': 'Interval Spawn', 'rule': 'Owner 2026-11-15: spawns at the interval its Trait sets — Ethereal Unity (3 tokens → 3 Haunts at Fool\'s deck coordinates).'}],
 'levels': levels, 'traits': [{'id': TR[t['name']], **t, 'implemented': True} for t in S['traits']],
 'cards': {'ai': [ai(c, AI[c['name']]) for c in raw['ai']], 'bp': [bp(c, BP[c['name']]) for c in raw['bp']], 'signature': ai(raw['signature'], SIG),
           'routine': {**raw['routine'], 'type': 'routine', 'ops': [{'op': 'condition', 'id': 'Drowning', 'all': True}]}},
 'clashSetup': setup,
 'rulings': [
  'Ethereal Unity "removed from the Board" = a Haunt dies (its BP goes to the Wound Stack) (소유자 확인 2026-11-15)',
  'Ethereal Unity Spawn: three lowest-level BPs from the Escalation decks on the leftmost empty Mob-track spaces; a coordinate held by a Knight or another Haunt → an unoccupied adjacent space (ties: player) (소유자 확인 2026-11-15)',
  'Ethereal Unity "Assign Activation tokens starting from the left of the Mob track": all Activation tokens are re-dealt one per Mob from the leftmost, keeping their spent/unspent state (소유자 확인 2026-11-15)',
  'Ethereal Unity bonuses stack: 1+ token → +1 To Hit, 2 tokens → +1 To Hit and +1 Vigor loss on every Haunt Attack',
  'Zone Attack with MOVE: the Haunt moves toward the Target until adjacent, turns to face it, then the card diagram (rotated to its facing) gives the Zone; Spectral Step moves it to the marked space after the After Attack. When several movement paths are possible the player picks (소유자 확인 2026-11-15)',
  'Judgement effect lines without "If hit" (e.g. "Gain the Dread Condition card") still need a hit: a Full Evade cancels every effect line (소유자 확인 2026-11-15, 이전 해석 정정)',
  'Zone Judgement: the Target plus every Knight in Zone 1 (No Mercy: Zone 2) around it are judged',
  'Intangible: Haunts path through Terrain and miniatures (Superior Bypass) and ignore Terrain for Line of Sight; they still cannot end a move on another miniature',
  'Gordon: every Monster Attack made by a Haunt within Zone 2 of revealed Gordon causes an additional -2 Vigor [해석]',
  'Woolf: a Knight within Zone 2 of revealed Woolf can only attack Woolf',
  'Amelie: every Gated Effect on AI cards resolves regardless of Heat',
  'Peter "Gain +1 Curse": Curse is shared — the party Curse level +1 (소유자 확인 2026-11-15)', 'Spectral Step onto a Knight: the Knight is knocked back 3 in a direction the player chooses (소유자 확인 2026-11-15)',
  'Percy wound: a 1x2 Swamp tile on the dead Haunt\'s space plus an adjacent space without Terrain (player picks)',
  'The Unremarkable One Critical "see 8915": story reference — logged only',
 ],
}
json.dump(d, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('wrote', sys.argv[1], len(d['cards']['ai']), 'AI', len(d['cards']['bp']), 'BP', 'setup' if setup else 'NO SETUP')
