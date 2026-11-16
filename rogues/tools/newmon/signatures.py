# Signature cards (owner screenshots 2026-11-17) — merged into docs/transcriptions/<id>_raw.json by merge_signatures()
import json, os
from common import A
SIG = {
 'panzergeists': A('Ghostly Miasma', None, 'SIGNATURE', '4!', 11, ['Closest Knight in sight'], 'MOVE & ATTACK', ['For each hit lose -4 [V]. [Peril].'], 'Lower your Maximum [V] by 3.'),
 'stonemason_knight': A('Tear Down', None, 'SIGNATURE', 2, 9, ['Closest Knight not in front', 'Closest Knight in sight'], 'MOVE & ATTACK', ['For each hit lose -2 [V]. [Peril].', 'Knockback 4.'], 'Ruin.', gates=[dict(stat='Heat', gte=3, effect='+1 [die]', where='moveTag')]),
 'knighteater': A('A Succulent Meal', None, 'SIGNATURE', 3, 8, ['Highest [P]'], 'MOVE & ATTACK', ['For each hit lose -1 [V]. [Peril]. Three or more hits, gain the Fear Condition card.'], 'Wolf Down 2.', 'AFTER FINAL ATTACK', gates=[dict(stat='Heat', gte=3, effect='PENETRATE', where='moveTag')]),
 'firstmen_lictor_hunters': A('Suppressing Fire', None, 'RANGE SIGNATURE', 2, 8, ['Tactics Target', '[Priority Target] Priority Target'], 'RANGE ATTACK UNLIMITED', ['For each hit lose -1 [V]. Poison 1. [Peril].', 'The next non-Decoying Mob performs Decoy.'], gates=[dict(stat='Heat', gte=3, effect='TACTIC A', where='moveTag')]),
 'bog_witch': A('Curseword: Drown', None, 'RANGE SIGNATURE', 3, 9, ['Lowest [H]'], 'RANGE ATTACK UNLIMITED', ['For each hit lose -2 [V] and gain +1 [H].', '[Peril]. Gain the Slimed Condition card. 3+ hits, gain the Drowning Condition card instead.'], gates=[dict(stat='Heat', gte=3, effect='+1 [die]', where='moveTag')]),
 'ratwolves': A('Split the Herd', None, 'SIGNATURE', 2, 9, ['Closest Lone Knight', 'Closest Knight in front', 'Closest Knight in sight'], 'MOVE & ATTACK', ['For each hit lose -1 [V]. [Peril].'], 'Drag 2.', gates=[dict(stat='ConditionTokens', gte=3, effect='KNOCKDOWN', where='moveTag')]),
}
if __name__ == '__main__':
    d = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'transcriptions')
    for k, s in SIG.items():
        f = os.path.join(d, k + '_raw.json')
        if not os.path.exists(f): print('skip', k); continue
        r = json.load(open(f)); r['signature'] = s; r['_notes'] = [n.replace('Signature 카드, ', '') for n in r.get('_notes', [])]; json.dump(r, open(f, 'w'), ensure_ascii=False, indent=1); print('sig', k)
