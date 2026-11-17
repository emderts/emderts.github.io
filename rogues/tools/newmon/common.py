# Compact transcription helpers for the expansion monsters (owner scans 2026-11-17). Writes docs/transcriptions/<id>_raw.json.
# Icons: [V]=Vigor, [H]=Heat, [P]=Passion, [Peril]=Peril Check, [Armor]=Armor token, [Gear]=Gear card, [Bane]=Bane token, [die]=Evasion die, [AT]=Armor Toughness, [React]=React! window
import json, os
def A(name, level, typ, dice, diff, targeting, tag, lines, after=None, afterTag='AFTER ATTACK', gates=None, pre=None, extra=None, unclear=None):
    d = dict(name=name, level=level, type=typ, evasionDice=dice, evasionDifficulty=diff, preTargeting=pre, targeting=targeting, moveTag=tag, gates=gates or [], effects=lines,
             afterTag=afterTag if after else None, after=after, unclear=unclear or [])
    if extra: d.update(extra)
    return d
def B(name, level, at, oc=None, wound=None, fail=None, instinct=None, critical=None, whenRevealed=None, whileRevealed=None, note=None, unclear=None):
    return dict(name=name, level=level, at=at, overcome=({'n': oc[0], 'effect': oc[1]} if oc else None), note=note, whenRevealed=whenRevealed, whileRevealed=whileRevealed,
                responses=dict(wound=wound, fail=fail, instinct=instinct, critical=critical), unclear=unclear or [])
def L(toHit, wounds, exh, acts, traits, esc=0, at=0, vig=0, ev=0):
    return dict(toHit=toHit, wounds=wounds, exhibitionWounds=exh, activations=acts, traitsAdd=traits, bonuses=dict(escalations=esc, at=at, vigorLoss=vig, evasionDice=ev))
def write(id_, data):
    out = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'transcriptions', id_ + '_raw.json')
    S = data['sheet']; ex = data.setdefault('extra', [])
    for t in S.get('kingdomTraits', []): ex.append(dict(name=t['name'], kind='Kingdom Trait', kingdom=t['kingdom'], text=t['text']))
    for t in data.get('tactics', []): ex.append(dict(name=t['name'], kind=t['kind'].capitalize() + ' Battle Tactics', text='Tactics Target: ' + t['tacticsTarget'] + ((' · ' + t['whenDrawn']) if t.get('whenDrawn') else ''), tacticA=t['tacticA'], tacticB=t['tacticB'], endOfMonsterRound=t['endOfMonsterRound']))
    for c in data['ai']:
        c.setdefault('reactWindows', []); c.setdefault('afterAttack', ((c.get('afterTag') or '') + ': ' + c['after']) if c.get('after') else None)
        if c.get('pre'): c['preTargeting'] = c['pre']
        if c.get('hex'): h = c['hex']; ex.append(dict(name=h['name'], kind=h['type'] + ' — AI: ' + c['name'], text=h['text']))
    RW = json.load(open(os.path.join(os.path.dirname(out), 'react_windows.json'))).get(id_, {})
    for c in data['ai']: c['reactWindows'] = RW.get('ai', {}).get(c['name'], [])
    for c in data['bp']: c['reactWindows'] = RW.get('bp', {}).get(c['name'], [])
    S['notes'] = list(data.get('_notes', []))
    cs = json.load(open(os.path.join(os.path.dirname(out), 'ttsf_clash_setups.json'))).get({'panzergeists': 'panzergeists', 'stonemason_knight': 'stonemason-knight', 'knighteater': 'knighteater', 'firstmen_lictor_hunters': 'first-men-lictor-hunters', 'bog_witch': 'bog-witch', 'ratwolves': 'ratwolves'}[id_])
    if cs:
        data['clashSetup'] = cs; S['notes'].append('Clash Setup (' + str(cs.get('page')) + '): 기사 ' + ', '.join(cs['knightStart']) + (' · 몬스터 ' + ', '.join(cs['monsterCells']) + ' (' + cs.get('facing', '무작위') + ')' if cs.get('monsterCells') else ' · Mob ' + ', '.join(c + d for c, d in cs.get('mobStart', []))) + (' · Decoy ' + ', '.join(c + d for c, d in cs['decoyStart']) if cs.get('decoyStart') else '') + (' · Armor 토큰 ' + ', '.join(cs['armorTokens']) if cs.get('armorTokens') else ''))
        for t in cs['terrain']: S['notes'].append('지형 ' + t['tile'] + (' ' + t['shape'] if t.get('shape') else '') + (' #' + str(t['n']) if t.get('n') else '') + ': ' + ', '.join(t['cells']))
        S['unclear'] = list(S.get('unclear', [])) + list(cs.get('unclear', []))
    json.dump(data, open(out, 'w'), ensure_ascii=False, indent=1); print('wrote', id_, len(data['ai']), 'AI', len(data['bp']), 'BP')
