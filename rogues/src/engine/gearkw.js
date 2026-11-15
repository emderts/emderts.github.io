// Gear keyword parser (Rulebook Keyword List pp.80–87, Gear rules p.21): turns the ability text of a Gear / Upgrade / Consumable card into
// structured keywords. Each sentence becomes { op, n?, m?, gate?, kingdom?, twoHanded?, reaction?, cost?, status, text }.
// status: 'ok' = resolved by the engine · 'pending' = recognised keyword, no engine effect yet · 'na' = irrelevant in these Kingdoms ·
// 'text' = free text the parser does not understand (resolved manually by the players).
const TOKENS = { 'Break': 'break', 'Opening': 'opening', 'Closing': 'closing', 'Hope': 'hope', 'Black': 'black', 'Sunder': 'sunder', 'Fire': 'fire', 'Power': 'power', 'Cantrip': 'cantrip', 'Spell': 'spell', 'Rouse': 'rouse', 'Diversion': 'diversion', 'Improved Diversion': 'improvedDiversion', 'Fleisch': 'fleisch' };
const OK = { 'Commit': 'commit', 'Cumbersome': 'cumbersome', 'Tireless': 'tireless', 'Deadly': 'deadly', 'Overbreak': 'overbreak', 'Envenomed': 'envenomed', 'Attack Re-roll': 'attackReroll', 'Power Re-roll': 'powerReroll',
  'Reposition': 'reposition', 'Pushback': 'pushback', 'Vault': 'vault', 'Hug': 'hug', 'Daze': 'daze', 'Provoke': 'provoke', 'Inspire': 'inspire', 'Motivate': 'motivate', 'Drag': 'drag', 'Reach': 'reach', 'Unwieldy': 'unwieldy',
  'Soak': 'soak', 'Poison Resilience': 'poisonResilience', 'Tumble': 'tumble', 'Stalwart': 'stalwart', 'Rocksteady': 'rocksteady', 'Braced': 'braced', 'Armor-piercing': 'armorPiercing',
  'Deploy': 'deploy', 'Guard': 'guard', 'Pull': 'pull', 'Knockback': 'knockback', 'Second Chance': 'secondChance', 'Superior Chance': 'secondChance', 'Lifeline': 'lifeline', 'Reflex': 'reflex', 'Advanced Reflex': 'reflex2', 'Superior Reflex': 'reflex3', 'Precise': 'precise', 'Bypass': 'bypass', 'Advanced Bypass': 'bypass', 'Defy': 'defy', 'Advanced Defy': 'defy2', 'Superior Defy': 'defy3',
  'Block': 'block', 'Advanced Block': 'block2', 'Superior Block': 'block3', 'Dodge': 'dodge', 'Lesser Dodge': 'dodge0', 'Advanced Dodge': 'dodge2', 'Superior Dodge': 'dodge3', 'Reinforce': 'reinforce', 'Advanced Reinforce': 'reinforceBlack', 'Superior Reinforce': 'reinforceWhite' };
const PENDING = ['Ammo Reserves', 'Superior Bypass', 'Armor Re-roll', 'Hide', 'Pass', 'Greater Pass', 'Spotlight', 'Heartseeker', 'Soulseeker', 'Fortify', 'Acrobatics', 'Roll Out', 'Jump', 'Advanced Jump', 'Area', 'Bane', 'Parasitize', 'Poison', 'Toxify', 'Sacrifice', 'Rush', 'Improved Rush', 'Refresh', 'Falsity', 'Zeal', 'Devote', 'Magic', 'Scavenge', 'Suppress', 'BP Suppress', 'AI Suppress', 'Immune to Fear', 'Ignore Lumbering', 'Ignore Obscuring'];
const NA = ['Wither', 'Growth', 'Clockwork', 'Bloodletter', 'Leech'];
const camel = s => s.replace(/[^A-Za-z ]/g, '').split(' ').map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('');
/** Keywords the engine resolves only when printed without a cost (constant) — with a cost they are 'pending' unless listed in ACTIVE_OK. */
const DEFENSIVE = new Set(['block', 'block2', 'block3', 'dodge', 'dodge0', 'dodge2', 'dodge3', 'reinforce', 'reinforceBlack', 'reinforceWhite', 'defy', 'defy2', 'defy3']);
const ACTIVE_OK = new Set([...DEFENSIVE, 'guard', 'secondChance', 'lifeline', 'reflex', 'reflex2', 'reflex3', 'precise', 'braced', 'stalwart']);

function body(b) {
  let m;
  if ((m = /^Auto-([a-z]+) (\d+|X)$/i.exec(b))) { const t = TOKENS[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()]; return t ? { op: 'auto', token: t, n: m[2] === 'X' ? 'X' : +m[2], status: m[2] === 'X' ? 'pending' : 'ok' } : null; }
  if ((m = /^Ranged (\d+)[-–](\d+|X)$/.exec(b))) return { op: 'ranged', n: +m[1], m: m[2] === 'X' ? 'X' : +m[2], status: m[2] === 'X' ? 'pending' : 'ok' };
  if ((m = /^\+(\d+) \[Power\]$/.exec(b))) return { op: 'plusPower', n: +m[1], status: 'ok' };
  if ((m = /^\+(\d+) (?:Precision )?\[Precision\]$/.exec(b))) return { op: 'plusPrecision', n: +m[1], status: 'ok' };
  if ((m = /^([+-]\d+) Speed \[Speed\]$/.exec(b))) return { op: 'speed', n: +m[1], status: 'ok' };
  if ((m = /^\+(\d+) (?:Evasion )?\[Evasion\]$/.exec(b))) return { op: 'plusEvasion', n: +m[1], status: 'ok' };
  if ((m = /^Poison Limit \+(\d+)$/.exec(b))) return { op: 'poisonLimit', n: +m[1], status: 'pending' };
  if ((m = /^Bane Limit \+?(\d+)$/.exec(b))) return { op: 'baneLimit', n: +m[1], status: 'na' };
  if ((m = /^\+(\d+) (Bravery|Tenacity|Fortitude|Might|Insight|Sagacity) \[\2\]$/.exec(b))) return { op: 'virtue', virtue: m[2], n: +m[1], status: 'ok' };
  if ((m = /^(.+?) or (.+)$/.exec(b))) { const a = body(m[1]), c = body(m[2]); if (a && c && a.status !== 'text' && c.status !== 'text') return { op: 'choice', options: [a, c], status: a.status === 'ok' && c.status === 'ok' ? 'ok' : 'pending' }; }
  if ((m = /^([A-Z][A-Za-z\-]*(?: [A-Z][A-Za-z\-]*)*?)(?: (\d+|X))?$/.exec(b))) {
    const name = m[1], n = m[2] == null ? null : m[2] === 'X' ? 'X' : +m[2];
    if (TOKENS[name]) return { op: 'token', token: TOKENS[name], n: n == null ? 1 : n, status: n === 'X' ? 'pending' : 'ok' };
    if (OK[name]) return { op: OK[name], n, status: n === 'X' ? 'pending' : 'ok' };
    if (PENDING.includes(name)) return { op: camel(name), n, status: 'pending' };
    if (NA.includes(name)) return { op: camel(name), n, status: 'na' };
  }
  return null;
}
/** Parse one sentence of ability text. */
export function parseSentence(s) {
  const text = s.trim(); let r = text.replace(/\.$/, '').trim(); const o = {};
  for (let guard = 0; guard < 8; guard++) { let m;
    if ((m = /^\[(MINOR|MAJOR|GRAVE|JUDICIUM)\]\s*/.exec(r))) { o.gate = m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[(PRINCIPALITY OF STONE|SUNKEN KINGDOM)\]\s*/.exec(r))) { o.kingdom = m[1] === 'SUNKEN KINGDOM' ? 'sunken' : 'principality'; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Two-handed(?: icon)?\]:?\s*/i.exec(r))) { o.twoHanded = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Reaction\]\s*/.exec(r))) { o.reaction = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[(Combat|Move|Attack|Movement|Complicated) action\]\s*/i.exec(r))) { (o.cost = o.cost || {}).action = m[1].toLowerCase(); r = r.slice(m[0].length); continue; }
    if ((m = /^(\d+) \[Heat\]\s*/.exec(r))) { (o.cost = o.cost || {}).heat = +m[1]; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Exhaust\]\s*/.exec(r))) { (o.cost = o.cost || {}).exhaust = true; r = r.slice(m[0].length); continue; }
    if ((m = /^\[Discard\]\s*/.exec(r))) { (o.cost = o.cost || {}).discard = true; r = r.slice(m[0].length); continue; }
    if ((m = /^(\d+) \[Charge\]\s*/.exec(r))) { (o.cost = o.cost || {}).charge = +m[1]; r = r.slice(m[0].length); continue; }
    break; }
  const b = body(r); if (!b) return { op: 'text', status: 'text', text };
  const k = { ...b, ...o, text }; if (k.status === 'ok' && (k.cost || k.reaction) && !ACTIVE_OK.has(k.op)) k.status = 'pending'; // costed versions of constant keywords need their own timing window
  return k;
}
/** Parse a whole ability text → list of keywords (one per sentence). */
export function parseGearText(text) { if (!text) return []; return String(text).split(/\n|(?<=\.)\s+(?=[\[A-Z+\-\d])/).map(s => s.trim()).filter(Boolean).map(parseSentence); }
export const isDefensive = op => DEFENSIVE.has(op);
export const KEYWORD_STATUS = { TOKENS, OK, PENDING, NA };
