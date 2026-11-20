# REACT! windows as printed on the AI cards (owner scans 2026-11-19, re-read 2026-11-19 for window positions).
# no_t: cards WITHOUT a REACT! tag under the Targeting list; end: cards with a tag after the last effect line (= before After Attack /
# After Final Attack). Mid-effect windows are written as reactWindow ops in the card's effect list by the build scripts.
RX = {'op': 'reactWindow', 'at': 'mid'}; RXA = {'op': 'reactWindow', 'at': 'after'}
NO_T = {
 'king-laid-low': ['Tongue-Lashing', 'Royal Decree', 'Scorn of the Swamplands', 'Swamp of Smothering', "True Love's Kiss"],
 'devil-of-the-ancient-dusk': ['Savage Swing'],
 'devil-of-the-smelted-fears': ['Molten Rain'],
 'puppet-king-edelhardt': ['The King Commands: Bow Down!', 'The King Commands: Begone!', 'The King Commands: Get Out of My Sight!', 'The King Commands: Lay Down Your Arms!'],
 'toadragon-of-the-great-marsh': ['Overwhelming Croak', 'Poison the Waters', 'Engulf in Slime', 'Swamplands Surge'],
 'panzerdragon-veldr': [],
 'young-devour-dragon': ['Damning Discharge', 'Skewer', 'Thunder Storm', 'Command of the Famishing', 'Bile Cannon', 'Madness of the Famishing', "Slice 'n' Dice"],
}
END = {
 'king-laid-low': ['Churning Charge', 'Slime Stampede', 'Tongue-Lashing', 'Slippery Slope', "Malediction's Momentum", 'The Sinking Sin', 'Tongue Strike', 'Off With Your Head!', 'Scorn of the Swamplands', 'Swamp of Smothering', 'Mudflood Tsunami', "True Love's Kiss"],
 'devil-of-the-ancient-dusk': ['Join the Dead', 'Tail Thrust', 'Sideswipe', 'Tail Pierce', 'Sunder Foundations', 'Crushing Grasp', 'Nudge of the Finger', 'Manic Mudslide'],
 'young-devour-dragon': ['Damning Discharge'],
 'puppet-king-edelhardt': ['Dragged by the Ear', 'The King Commands: Bow Down!', 'The King Commands: Begone!', 'Eye Poke', 'The King Commands: Obey Me!', 'The King Commands: Get Out of My Sight!', 'Crushing Burden', 'The King Commands: Yield!', 'The King Commands: Get Away From Me!', 'The King Commands: Lay Down Your Arms!'],
}
# Signature / Trait Attack cards: (targeting tag?, tag after the last effect line?)
SIG = {'king-laid-low': (True, True), 'devil-of-the-ancient-dusk': (True, True), 'devil-of-the-smelted-fears': (True, True), 'toadragon-of-the-great-marsh': (True, False), 'panzerdragon-veldr': (True, True), 'young-devour-dragon': (True, False)}
TRAIT = {'puppet-king-edelhardt': (False, True)}
# BP cards: REACT! tag on a response header (window before the whole response). Mid-response tags are reactWindow ops in the response.
BP = {
 'king-laid-low': {'Slimy Skin': ['wound', 'fail'], 'Mucus-Clogged Nostrils': ['wound'], 'Contorted Hand': ['instinct'], 'Bejewelled Skull': ['wound'], 'Malformed Jaw': ['fail'], 'Vile Tongue': ['instinct'], 'Toad-Like Hind Leg': ['fail'], 'Hunched Back': ['wound', 'fail'], 'Mud-Filled Lung': ['wound', 'fail'], 'Golden Crown': ['instinct'], 'Scepter of Smothered Ages': ['wound']},
 'devil-of-the-ancient-dusk': {"Devil's Foot": ['fail'], 'Amulet of Beginnings': ['wound'], 'Uncovered Back': ['wound'], 'Golden Bracers': ['wound'], 'Stolen Countenance': ['wound'], 'Leering Pelvis Guard': ['fail'], 'Pearl White Ribcage': ['wound']},
 'devil-of-the-smelted-fears': {},
 'puppet-king-edelhardt': {'Heavy-Settled Crown': ['instinct'], 'Five Fingers: The Ring Finger': ['instinct'], 'Five Fingers: The Little Finger': ['wound'], 'Panzerthrone': ['fail'], 'Cold Feet': ['instinct'], 'Chaos Ladder': ['fail'], 'Five Fingers: The Middle Finger': ['fail'], 'Five Fingers: The Index Finger': ['wound'], 'Five Fingers: The Thumb': ['wound']},
}
def one(c, t, end):
    ops = c['ops']; eff = list(ops.get('effects') or [])
    while eff and is_rx(eff[-1]): eff.pop(); end = True
    if end:
        key = 'afterAttack' if ops.get('afterAttack') else 'afterFinalAttack' if ops.get('afterFinalAttack') else None
        if key:
            if not is_rx(ops[key][0]): ops[key] = [dict(RXA)] + list(ops[key])
        else: eff.append(dict(RX))
    ops['effects'] = eff
    c['reactWindows'] = (['targeting'] if t else []) + [f'effect:{i}' for i, o in enumerate(eff) if is_rx(o)] + (['After Attack 앞'] if end else []); c['reactExact'] = True
def is_rx(o): return isinstance(o, dict) and o.get('op') == 'reactWindow'
def apply(mid, d):
    """d: the built monster def. Only the AI deck cards are touched (Signature / Trait Attack / BP windows were not re-read)."""
    import re
    cards = d['cards']['ai']
    d['rulings'] = [x for x in (re.sub(r'(, )?각 AI 카드의 REACT! 창 위치(\([^)]*\))?', '', r).strip() for r in d.get('rulings', [])) if x and x != '미구현:'] + ['REACT! 창: AI 카드는 인쇄된 위치대로 — Targeting 목록 아래 표시가 있는 카드만 Targeting 뒤 창, 효과 줄 사이 표시는 그 자리, 마지막 효과 줄 뒤 표시는 After Attack / After Final Attack 앞 (스캔 재판독 2026-11-19). Signature·Trait Attack도 같은 방식. BP 카드는 Response 머리글의 표시 = 그 Response 앞, 문장 사이 표시 = 그 자리']
    for c in cards: one(c, c['name'] not in NO_T.get(mid, []), c['name'] in END.get(mid, []))
    if mid in SIG and d['cards'].get('signature') and d['cards']['signature'].get('ops', {}).get('effects') is not None: one(d['cards']['signature'], *SIG[mid])
    if mid in TRAIT and d.get('traitAttack'): one(d['traitAttack'], *TRAIT[mid])
    if mid in BP:
        for c in d['cards']['bp']: c['reactWindows'] = list(BP[mid].get(c['name'], []))
        miss = [n for n in BP[mid] if n not in [c['name'] for c in d['cards']['bp']]]; assert not miss, miss
    return cards
