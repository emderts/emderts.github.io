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
 'puppet-king-edelhardt': ['Dragged by the Ear', 'The King Commands: Bow Down!', 'The King Commands: Begone!', 'Eye Poke', 'The King Commands: Obey Me!', 'The King Commands: Get Out of My Sight!', 'The King Commands: Entertain Me!', 'Crushing Burden', 'The King Commands: Yield!', 'The King Commands: Get Away From Me!', 'The King Commands: Lay Down Your Arms!'],
}
def is_rx(o): return isinstance(o, dict) and o.get('op') == 'reactWindow'
def apply(mid, d):
    """d: the built monster def. Only the AI deck cards are touched (Signature / Trait Attack / BP windows were not re-read)."""
    import re
    cards = d['cards']['ai']
    d['rulings'] = [x for x in (re.sub(r'(, )?각 AI 카드의 REACT! 창 위치(\([^)]*\))?', '', r).strip() for r in d.get('rulings', [])) if x and x != '미구현:'] + ['REACT! 창: AI 카드는 인쇄된 위치대로 — Targeting 목록 아래 표시가 있는 카드만 Targeting 뒤 창, 효과 줄 사이 표시는 그 자리, 마지막 효과 줄 뒤 표시는 After Attack / After Final Attack 앞 (스캔 재판독 2026-11-19). Signature·Trait Attack·BP 카드의 REACT! 표시는 재판독 전이라 이전 처리 그대로 [확인 필요]']
    for c in cards:
        ops = c['ops']; eff = list(ops.get('effects') or []); end = c['name'] in END.get(mid, [])
        while eff and is_rx(eff[-1]): eff.pop(); end = True
        if end:
            key = 'afterAttack' if ops.get('afterAttack') else 'afterFinalAttack' if ops.get('afterFinalAttack') else None
            if key:
                if not is_rx(ops[key][0]): ops[key] = [dict(RXA)] + list(ops[key])
            else: eff.append(dict(RX))
        ops['effects'] = eff; t = c['name'] not in NO_T.get(mid, [])
        c['reactWindows'] = (['targeting'] if t else []) + [f'effect:{i}' for i, o in enumerate(eff) if is_rx(o)] + (['After Attack 앞'] if end else []); c['reactExact'] = True
    return cards
