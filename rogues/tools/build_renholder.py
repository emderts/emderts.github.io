#!/usr/bin/env python3
"""Generates data/knights/renholder.json from the owner-supplied scans (2026-11-16):
Knightbook 'The Tale of Renholder and the Secrets of the Spirit' p.3-4, Portrait sheet, Talent sheets A/B,
Heroic Arc sheets A/B, Technique sheet (Clash side)."""
import json, os
T = lambda token, n=1: {"token": token, "n": n}
U = lambda guess, note: {"token": "Unknown", "guess": guess, "unclear": note}
H, M, VG = (lambda n: {"res": "Heat", "n": n}), (lambda n: {"res": "Magic", "n": -n if isinstance(n, int) else n}), (lambda n: {"res": "Vigor", "n": -n})
ACT = lambda *a: {"res": "Action", "actions": list(a)}
PR = {"token": "PowerReroll", "n": 1}
def ex(tok, dep): return {"token": tok, "n": 1, "depletion": dep}
def arc(name, plus, levels, unclear=()):
    return {"name": name, "plus": plus, "levels": [{"level": i + 1, "options": o} for i, o in enumerate(levels)], "unclear": list(unclear)}
AR1 = {"text": "Attack Re-roll 1", "ops": [T("AttackReroll", 1)]}
REPO = "figure with four outward arrows — read as Reposition"
arcs = [
 arc("Mage Knight", None, [[[T("Cantrip", 1)]], [[PR, T("Magic", 1)]], [[T("Cantrip", 2)]], [[PR, T("Magic", 1)]], [[T("PowerDieRed", 1)]], [[T("Cantrip", 2)]]]),
 arc("Illusionist", None, [[[T("Cantrip", 2)]], [[PR, T("Magic", 1)]], [[T("Cantrip", 1), T("Fire", 1)]], [[PR], [T("Fire", 1), T("Magic", 1)]], [[T("PowerDieRed", 1)]], [[T("Fire", 1), T("Cantrip", 1)]], [[T("Magic", 1)]]]),
 arc("Luxite", AR1, [[[T("Fire", 2)]], [[PR, T("Fire", 1)]], [[PR], [T("Spell", 1), T("Magic", 1)]], [[T("PowerDieRed", 1)]], [[T("Spell", 1)], [T("Magic", 1), T("Fire", 1)]], [[T("Fire", 2)]], [[T("Heartseeker", 1)]]]),
 arc("Tenebrist", None, [[[PR, T("Pass", 1)]], [[T("Magic", 1), T("Cantrip", 2)]], [[T("Pass", 1), T("Magic", 1)]], [[T("GreaterPass", 1)], [PR]], [[T("Spell", 1), T("Pass", 1)]], [[T("Diversion", 1)]]]),
 arc("Harmonized Soul", None, [[[PR, T("Magic", 1)]], [[T("Fire", 3)], [T("Pushback", 2), T("Fire", 1)]], [[T("Opening", 3), T("Magic", 1)], [T("Magic", 2)]], [[T("Black", 1), T("Break", 1)], [T("PowerReroll", 2)]], [[T("Closing", 1)], [T("Reposition", 3)]], [[T("Spell", 1)], [T("Cantrip", 1), T("Magic", 1)]], [[T("Diversion", 1)], [T("Heartseeker", 1)]], [[T("PowerDieBlack", 1)]]],
     []),
 arc("Luxfire Magus", AR1, [[[T("Spell", 1), T("Magic", 1)]], [[T("Cantrip", 2)]], [[T("Cantrip", 2), PR], [T("Magic", 2)]], [[T("Spell", 1), PR], [T("PowerDieRed", 1)]], [[T("Spell", 1)]], [[T("Cantrip", 1), T("Magic", 1)]], [[T("Cantrip", 2)]]]),
 arc("Theurgist", None, [[[T("Spell", 1)]], [[T("Cantrip", 1), T("Magic", 1)]], [[T("Cantrip", 2), PR]], [[T("PowerDieRed", 1)], [T("Magic", 1)]], [[T("Spell", 1), T("Cantrip", 1)]], [[T("Spell", 1), T("Magic", 1)]], [[T("Tireless", 1)]]]),
 arc("Hermetic Master", {"text": "Attack Re-roll 1, [PowerReroll] 1", "ops": [T("AttackReroll", 1), PR]},
     [[[T("Spell", 1), T("Magic", 1), T("Reposition", 2)]], [[T("Black", 1), T("Fire", 1), T("Magic", 1)]], [[T("Sunder", 1), PR]], [[T("Spell", 2), T("Magic", 1)]], [[T("PowerDieBlack", 1), T("Tireless", 1)]], [[PR, T("ImprovedDiversion", 1)]], [[T("Spell", 2), T("Magic", 1)]], [[T("Power", 1)]]],
     []),
]
ML = lambda n: f"Magic Limit {n}: There can't be more than {n} Magic [Magic] tokens in the Knight Pool at the same time. If multiple elements modify the Magic Limit, choose the highest Magic Limit."
talents = [
 {"id": "mage-knight", "name": "Mage Knight", "tier": "starting", "magicLimit": 2, "abilities": [
   {"name": "Critical Light", "text": "If you roll a Crit Chance during an Attack or Evasion Roll, place 1 Magic [Magic] token in the Knight Pool. " + ML(2), "ops": [{"op": "criticalLight"}]},
   {"name": "Up My Sleeve", "text": "Once per your turn you may spend 1 Magic [Magic] token to Refresh 1 card.", "ops": [{"op": "upMySleeve"}]}]},
 {"id": "luxite", "name": "Luxite", "tier": "vassal", "magicLimit": 3, "abilities": [
   {"name": "Power from Camaraderie", "text": "Once per Knight Round and once per Monster Round, when another Knight uses a Technique or when a Squire uses an ability, you may place 1 Magic [Magic] token in the Knight Pool. " + ML(3), "ops": [{"op": "powerFromCamaraderie"}]},
   {"name": "Aura of Illumination", "text": "Spend 1 Magic [Magic] token to place a Magic [Magic] token on your Knight Board. As long as there is at least 1 Magic [Magic] token on your Knight Board, you, and each Knight in Zone 1 from you, have Auto-fire 1 and \"Crit Chance: Gain +1 [Power].\" Discard the token at the end of your next turn.", "ops": [{"op": "auraOfIllumination"}]}]},
 {"id": "tenebrist", "name": "Tenebrist", "tier": "vassal", "magicLimit": 2, "abilities": [
   {"name": "Power from Pain", "text": "Whenever a Knight loses [Vigor], place 1 Magic [Magic] token in the Knight Pool. " + ML(2), "ops": [{"op": "powerFromPain"}]},
   {"name": "Cloak of Shadows", "text": "Spend 1 Magic [Magic] token to place a Magic [Magic] token on the Clash Board adjacent to you (up to 2 tokens on the Board). Each Knight on that token, or in Zone 1 from at least 1 of those tokens, gains Guard 2 and \"Crit Evade: Gain a temporary positive Evasion [Evasion] token.\"", "ops": [{"op": "cloakOfShadows"}]}]},
 {"id": "harmonized-soul", "name": "Harmonized Soul", "tier": "devil", "magicLimit": 4, "abilities": [
   {"name": "Sympathetic Magic", "text": "When another Knight is hit by an Attack or fails to deal a Wound, place 1 Magic [Magic] token on their Knight Board. At the start of your turn, you may move those tokens either to your Knight Board or into the Knight Pool. " + ML(4), "ops": [{"op": "sympatheticMagic"}]},
   {"name": "Manifestation", "text": "Knights with Magic [Magic] tokens on their Knight Boards may discard all their [Magic] tokens to gain Auto-black X or Soak X until the end of that Round. X is equal to the number of Magic [Magic] tokens discarded this way. They may use this ability as a free action or a [Reaction].", "ops": [{"op": "manifestation"}]}]},
 {"id": "luxfire-magus", "name": "Luxfire Magus", "tier": "devil", "magicLimit": 5, "abilities": [
   {"name": "Ebb and Flow of the Arcane", "text": "Whenever your [Heat] reaches Heat Limit [Heat Limit] or becomes 0, place 1 Magic [Magic] token in the Knight Pool. [JUDICIUM] 2 Magic [Magic] tokens instead. " + ML(5), "ops": [{"op": "ebbAndFlow"}]},
   {"name": "Unholy Furnace", "text": "Once per turn, you may spend 1 Magic [Magic] token to perform Heat Refresh. When you are about to perform Heat Refresh, you may perform Card Refresh instead and vice versa.", "ops": [{"op": "unholyFurnace"}]}]},
]
def tech(name, unlock, cost, text, depletion, ops, timing, exert, gates=None, gateOps=None, unclear=(), **kw):
    d = {"name": name, "unlock": unlock, "cost": cost, "text": text, "gates": gates or [], "depletion": depletion, "unclear": list(unclear), "ops": ops, "timing": timing, "gateOps": gateOps or {}, "exert": exert}
    d.update(kw); return d
def spell(dice, prec, colour, text, bonus=0, n=1): return {"name": None, "type": "weapon", "hands": 0, "attackDice": dice, "precision": prec, "weaponPower": {"n": n, "colour": colour}, "bonusPower": ({"raw": bonus} if bonus else None), "text": text, "traits": ["Magic"], "spell": True}
G = lambda g, t: {"gate": g, "text": t}
ALT = lambda *a: [list(x) if isinstance(x, (list, tuple)) else [x] for x in a]
techniques = [
 tech("Second Chance", "Start", ALT(H(1), M(1)), "Second Chance.", "discard", [{"op": "secondChance"}], "onMortisDraw", ex("Break", "discard"), [G("DEVIL", "Superior Chance.")], {"DEVIL": [{"op": "superiorChance"}]}),
 tech("Knight Roll", "Start", [H(1)], "[Reaction] Reflex.", "cooldown", [{"op": "reflex", "n": 1}], "reaction", ex("PowerReroll", "cooldown"), [G("KING", "[Reaction] Advanced Reflex.")], {"KING": [{"op": "reflex", "n": 2}]}),
 tech("Knight Pose", "Start", [H(1)], "Stand up.", "cooldown", [{"op": "standUp"}], "free", ex("PowerReroll", "cooldown"), [G("DRAGON", "Stand up, then place 1 Magic [Magic] token in the Knight Pool.")], {"DRAGON": [{"op": "standUp"}, {"op": "magic", "n": 1}]}),
 tech("Lux Step", "Start", [ACT("move")], "Place your miniature on an empty space up to 3 spaces away from you (treat this Technique as performing movement).", "cooldown", [{"op": "teleport", "n": 3}], "free", ex("PowerReroll", "cooldown"), [G("DEVIL", "5 spaces instead.")], {"DEVIL": [{"op": "teleport", "n": 5}]}),
 tech("Conjurer of Cheap Tricks", "Start", ALT(H(1), M(1)), "Place 1 Cantrip [Cantrip] token in the Knight Pool.", "delay", [{"op": "poolToken", "token": "cantrip", "n": 1}], "free", ex("PowerReroll", "delay"), [G("KING", "2 tokens instead."), G("DRAGON", "3 tokens instead.")], {"KING": [{"op": "poolToken", "token": "cantrip", "n": 2}], "DRAGON": [{"op": "poolToken", "token": "cantrip", "n": 3}]}),
 tech("Dazzling Light", "Investigation 1-2", [ACT("combat"), H(2)], "Perform an Attack with your Lux Magic! Dice: 1. Precision: +3. Power Die: [black die]*. Bonus Power: +2 [Power]. Deadly. Daze. Diversion. Cantrip 2.", "cooldown",
      [{"op": "spellAttack", "weapon": spell(1, 3, "black", "Deadly.\nDaze.\nDiversion 1.\nCantrip 2.", 2)}], "attack", ex("PowerReroll", "cooldown"), [G("KING", "*[white die] instead.")],
      {"KING": [{"op": "spellAttack", "weapon": spell(1, 3, "white", "Deadly.\nDaze.\nDiversion 1.\nCantrip 2.", 2)}]}, ["No range printed — treated as a Melee (range 1) attack"]),
 tech("Mirage", "Investigation 1-3", [M(1)], "Guard 2. Pass the Priority Target token to the Knight with the highest [Passion] (if there's any).", "discard", [{"op": "guard", "n": 2}, {"op": "passPriority"}], "onTargeted", ex("Break", "discard"),
      [G("DEVIL", "Guard 3 instead."), G("DRAGON", "Guard 4 instead.")], {"DEVIL": [{"op": "guard", "n": 3}, {"op": "passPriority"}], "DRAGON": [{"op": "guard", "n": 4}, {"op": "passPriority"}]}),
 tech("Brain over Brawn", "Quest: Illusionist", [H(1)], "When you attack, if you're on a Rear [Rear] space, gain Deadly. Additionally, if you attack with a Catalyst Weapon, you may spend 1 Magic [Magic] token to ignore this Technique's Rear space requirement.", "cooldown", [{"op": "deadlyIfRear"}], "beforeAttack", ex("PowerReroll", "cooldown")),
 tech("Inspiring Light", "Investigation 2-2", ALT(H("X"), M(2)), "Choose X Knights. Motivate 1 all chosen Knights. If you spend Magic [Magic] tokens to use this Technique, Motivate 1 all Knights other than you instead.", "cooldown", [{"op": "inspiringLight", "n": 1}], "free", ex("PowerReroll", "cooldown"), [G("DEVIL", "Motivate 2 instead.")], {"DEVIL": [{"op": "inspiringLight", "n": 2}]}),
 tech("Gaze Beyond the Veil", "Investigation 2-3", [M(2)], "Look at the top card of a chosen Mortis deck.", "instant", [{"op": "lookMortis", "all": False}], "free", None, [G("DEVIL", "Each Mortis deck instead.")], {"DEVIL": [{"op": "lookMortis", "all": True}]}, ["No Exert icon on this card", "Depletion icon is the lightning card — read as Instant"]),
 tech("Luxite Purification", "Quest: Luxite", [M("X")], "Choose X Knights other than you. Each chosen Knight performs a Card Refresh.", "cooldown", [{"op": "luxitePurification"}], "free", ex("PowerReroll", "cooldown"), [G("JUDICIUM", "Each of those Knights may choose to perform a Heat Refresh instead.")]),
 tech("Burning Barrage", "Quest: Luxite", [ACT("combat"), H("X"), M(1)], "Perform an Attack with a stream of fire! Dice: 1. Precision: +2. Power die: [2 red dice]. Bonus Power: +2 [Power]. Unwieldy. Reach 2. Area: All spaces in the same direction as the Target in this Attack's effective range. If you wounded your original Target, Fire X*.", "cooldown",
      [{"op": "spellAttack", "weapon": spell(1, 2, "red", "Unwieldy.\nReach 2.", 2, 2), "fireXOnWound": True}], "attack", ex("PowerReroll", "cooldown"), [G("DRAGON", "Dice: 2 instead. Loses Unwieldy.")],
      {"DRAGON": [{"op": "spellAttack", "weapon": spell(2, 2, "red", "Reach 2.", 2, 2), "fireXOnWound": True}]}, ["Power die icon shows two red dice", "Area (every space in the Target's direction) is not implemented — single Target only"]),
 tech("Dark Augury", "Quest: Tenebrist", ALT(H(2), M(1)), "Look at the top or the leftmost unrevealed BP or top AI card.", "cooldown", [{"op": "darkAugury", "suppress": False}], "free", ex("PowerReroll", "cooldown"), [G("DRAGON", "Additionally you may Suppress the deck of the card you looked at.")], {"DRAGON": [{"op": "darkAugury", "suppress": True}]}),
 tech("Shadow Manipulation", "Quest: Tenebrist", [VG(3)], "When the Monster is about to draw an AI, it performs Signature instead.", "discard", [{"op": "signatureInstead"}], "onAIDraw", ex("Break", "discard")),
 tech("Shadowslip", "Investigation 3-2", ALT(H(1), VG(2)), "[Reaction] Advanced Reflex.", "cooldown", [{"op": "reflex", "n": 2}], "reaction", ex("PowerReroll", "cooldown"), [G("DEVIL", "[Reaction] Superior Reflex instead."), G("DRAGON", "[Reaction] Place your miniature on an empty space up to 4 spaces away from you instead.")], {"DEVIL": [{"op": "reflex", "n": 3}], "DRAGON": [{"op": "teleport", "n": 4}]}),
 tech("Infernal Bargain", "Investigation 3-3", ALT(H(2), M(2)), "Superior Chance.", "discard", [{"op": "superiorChance"}], "onMortisDraw", ex("Fire", "discard"), [G("DEVIL", "Grant Superior Chance to another Knight instead."), G("JUDICIUM", "*This card costs +1 [Heat] or -1 [Magic] instead.")], {"DEVIL": [{"op": "superiorChance", "grant": True}]}, [], judiciumCost=ALT(H(1), M(1))),
 tech("Placeholder", "Quest: Theurgist", [M(1)], "Place the Placeholder token on your space. If the token is already on the Clash Board, discard it and place your miniature on its space instead. If that space is occupied, Displace Renholder onto the closest empty space.", "instant", [{"op": "placeholder"}], "free", None, unclear=["No Exert icon on this card"]),
 tech("Soulscorch", "Investigation 4-2", ALT(M(2), VG(4)), "When you deal a Wound, place temporary negative AT [AT], To Hit [To Hit], and Precision [Precision] tokens on the Monster Sheet.", "cooldown", [{"op": "soulscorch"}], "onWound", ex("PowerReroll", "cooldown")),
 tech("Incandescent Aura", "Investigation 4-3", [H(1)], "Until your next turn, whenever a Monster moves through or ends their movement on a space adjacent to you, place a temporary negative AT [AT] token in the Knight Pool (once per movement).", "cooldown", [{"op": "incandescentAura"}], "free", ex("PowerReroll", "cooldown")),
 tech("Chiaroscuro", "Quest: Harmonized Soul", [ACT("move"), M(1)], "Place your miniature on an empty space up to 7 spaces away from you. (Treat this Technique as performing a movement.)", "cooldown", [{"op": "teleport", "n": 7}], "free", ex("PowerReroll", "cooldown")),
 tech("Blackfire", "Quest: Harmonized Soul", [ACT("combat"), VG(3), M(2)], "Perform an Attack using both Tenebrae and Lux Magic! Dice: 2. Precision: +2. Power die: [black die]. Auto-black 3. Fire 3. Area: Zone 1 around the Target.", "cooldown",
      [{"op": "spellAttack", "weapon": spell(2, 2, "black", "Auto-black 3.\nFire 3.")}], "attack", ex("PowerReroll", "cooldown"), unclear=["Area: Zone 1 around the Target is not implemented — single Target only", "No range printed — treated as a Melee (range 1) attack"]),
 tech("The Maelstrom Within", "Quest: Luxfire Magus", [M("X")], "Place X Spell [Spell] tokens in the Knight Pool. *If there are no Opening [Opening] or Break [Break] tokens in the Knight Pool, this Technique's Depletion becomes [Instant].", "cooldown", [{"op": "maelstrom"}], "free", ex("PowerReroll", "cooldown"), unclear=["Depletion icon is Cooldown with an asterisk"]),
 tech("Doublestrike Enchantment", "Quest: Luxfire Magus", [M(3)], "Use this Technique only if you have 5+ [Passion]. When you attack, draw an additional BP. After performing the Power Roll, resolve it separately against both BPs' AT [AT], potentially dealing two Wounds! Resolve Responses only for the first BP you've drawn.", "discard", [{"op": "doublestrike"}], "beforeAttack", ex("Hope", "discard"), unclear=["Not against Mobs / Guardians; both BPs are drawn at the BP step; Responses only for the first", "Exert icon is the dove — read as Hope"], minPassion=5),
 tech("Final Flash", "Investigation 5-2", [ACT("combat"), H(3), M(2)], "Perform an Attack with the sun itself! Dice: 2. Precision: +5. Power die: [white die]. Each hit: +1 [Power]. Unwieldy. Ranged 5–10. Fire 5. When you deal a Wound, if your Total Power surpassed AT [AT] by 3+, ignore Responses, resolve the rest of the Attack Sequence, then repeat this Technique Attack (once).", "discard",
      [{"op": "spellAttack", "weapon": spell(2, 5, "white", "Each hit: +1 [Power].\nUnwieldy.\nRanged 5-10.\nFire 5."), "repeatOver": 3}], "attack", ex("PowerReroll", "discard")),
 tech("Shadows Between Worlds", "Investigation 5-3", [M(2)], "If you have the Priority Target token, pass it to another Knight with the highest [Passion] (if there's any). As long as this card is in either the Delay or Cooldown area, gain Advanced Bypass, +1 Evasion [Evasion], and you cannot become the Target if there's at least 1 other viable Target. You may use this Technique as a free action or as a [Reaction].", "cooldown", [{"op": "passPriority"}], "free", ex("PowerReroll", "cooldown"), unclear=["Only the free-action use, the Priority Target pass and the +1 Evasion are implemented (not Advanced Bypass / untargetable / Reaction use)"]),
 tech("Power Overwhelming", "Quest: Hermetic Master", [M("X")], "When you attack, gain +X [Power] and draw X BP cards. Do not reveal BP cards when drawing them during this Attack. After performing the Power Roll, distribute your Total Power between all BPs you've drawn, while they're still face down. Then reveal all drawn BPs and check if you wounded them. Ignore all Responses. After fully resolving the Attack, you die.", "discard", [{"op": "overwhelm"}], "beforeAttack", ex("Hope", "discard"), unclear=["Not against Mobs / Guardians", "Exert icon is the dove — read as Hope"]),
]
for t in techniques:
    for o in (t["ops"] or []) + [x for v in t["gateOps"].values() for x in v]:
        if o.get("op") == "spellAttack": o["weapon"]["name"] = t["name"]
data = {
 "id": "renholder", "name": "Renholder",
 "_source": "Knightbook 'The Tale of Renholder and the Secrets of the Spirit' (p.3–4 rules & Knight Setup, p.122 First Death Special Event) + Portrait / Talent / Heroic Arc / Technique sprite sheets (owner-supplied 2026-11-16).",
 "resourceToken": {"id": "magic", "name": "Magic", "keyword": "Magic X: During the second ability window, place X Magic tokens in the Knight Pool.",
   "rule": "Renholder uses special Magic tokens as a resource to power his spells and abilities. Magic tokens are mainly placed in the Knight Pool, and they can be spent from there. Each Renholder's Talent has a Magic Limit, which denotes how many Magic tokens can be in the Knight Pool at the same time. Magic Limit X: There can't be more than X Magic tokens in the Knight Pool. If multiple elements modify the Magic Limit, choose the highest Magic Limit. Magic tokens placed in other places than the Knight Pool cannot be spent to pay for Magic costs and do not count toward the Magic Limit."},
 "setup": {"virtues": {"Insight": 1, "Fortitude": 1, "Sagacity": 2}, "rapportBoon": {"text": "Start of Clash: Cantrip 1.", "ops": [{"op": "poolToken", "token": "cantrip", "n": 1}], "note": "[해석, 확인 필요] Rogue's Path에서 Rapport boon을 적용할지 — 현재 미적용 (Fleischritter와 동일하게 처리)."},
   "explorationCipher": "**13", "portraits": ["Mage Knight"], "portrait": "mage-knight", "talent": "Mage Knight", "heroicArc": "Mage Knight", "perilArc": "Mage Knight",
   "techniques": ["Second Chance", "Knight Roll", "Knight Pose", "Lux Step", "Conjurer of Cheap Tricks"],
   "techniquesNote": "Knightbook lists 'Clash side // Delve side' pairs (Knight Pose // Knight Prowess, Knight Roll // Prismatic Focus, Second Chance // Purifying Ritual, Lux Step // Light Our Way, Conjurer of Cheap Tricks // Divine the Heavens). Delve sides are not used in Rogue's Path.",
   "gear": ["Knighves", "Crude Bow"], "gearNote": "Knightbook: '1 set of Knighves and the Crude Bow (Merchant gear)'. Crude Bow = Principality Merchant gear (data/gear/merchant_principality.json); two-handed, so the Knighves stay in reserve while it is equipped (소유자 확인 2026-11-16: 시작 장비의 Merchant 표기는 상점 Gear)."},
 "firstDeath": {"text": "Renholder's First Death Special Event (Knightbook p.122): if the Unknown Saint is not yet unlocked, see 9999 first; otherwise the event proceeds. Mark the First Death box on your Knight Sheet. Gain +1 Sigh of the Graal.",
   "ops": [{"op": "markFirstDeath"}, {"op": "gainSigh", "n": 1}], "note": "[해석, 확인 필요] 이벤트 결말 문단을 스캔에서 찾지 못해 Fleischritter와 같은 보상(+1 Sigh of the Graal)으로 처리."},
 "components": {"portraits": 2, "talents": 3, "heroicArcs": 4, "perilArcs": 4, "techniques": 26, "gear": 5, "magicTokens": 5, "placeholderToken": 1},
 "talents": talents, "heroicArcs": arcs, "perilArcsRef": "data/knights/peril_arcs.json → arcs.renholder", "techniques": techniques,
 "missing": ["First Death Special Event closing paragraph (reward)"],
 "portraits": [
  {"id": "mage-knight", "name": "Mage Knight", "tier": "starting", "classes": ["Mage Knight"], "powerDie": "red", "cardRefresh": 1, "heatRefresh": 3, "handLimit": 6, "speed": 4, "baneLimit": 4},
  {"id": "luxite-tenebrist", "name": "Luxite / Tenebrist", "tier": "vassal", "classes": ["Luxite", "Tenebrist"], "powerDie": "red", "cardRefresh": 1, "heatRefresh": 4, "handLimit": 7, "speed": 4, "baneLimit": 5},
  {"id": "harmonized-luxfire", "name": "Harmonized Soul / Luxfire Magus", "tier": "devil", "classes": ["Harmonized Soul", "Luxfire Magus"], "powerDie": "red", "powerDice": 2, "cardRefresh": 2, "heatRefresh": 6, "handLimit": 8, "speed": 4, "baneLimit": 6}],
 "portraitsNote": "Devil tier portrait shows two red dice as the Knight Power die (stored as powerDie red × powerDice 2).",
}
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'knights', 'renholder.json')
json.dump(data, open(out, 'w'), ensure_ascii=False, indent=1)
print('wrote', os.path.normpath(out), len(techniques), 'techniques', len(arcs), 'arcs')
