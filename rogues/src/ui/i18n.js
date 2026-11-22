// Language option: English (original card text) ↔ 한국어 (translation).
// The game data stays in English; a dictionary (data/i18n/<lang>.json) maps original strings to translated ones.
//   names — card / Knight / Monster / Gear / Condition / Terrain names           { "Chipped Axe": "이 빠진 도끼" }
//   text  — card text, matched as a whole card text first, then line by line     { "Break 1.": "Break 1." }
//   ui    — interface strings by key (optional; the interface itself is Korean)  { "lang.toggle": "언어" }
// A missing entry always falls back to the original, so a dictionary can be filled in gradually.
// tools/i18n_extract.mjs writes docs/i18n/<lang>.template.json with every name and text line used by the data.
export const LANGS = [{ id: 'en', label: 'English (원문)' }, { id: 'ko', label: '한국어 (번역)' }];
let lang = 'en'; try { const v = localStorage.getItem('kf.lang'); if (LANGS.some(l => l.id === v)) lang = v; } catch (e) { }
let DICT = {};
export const initI18n = data => { DICT = (data && data.i18n) || {}; };
export const getLang = () => lang;
export const setLang = v => { if (!LANGS.some(l => l.id === v)) return; lang = v; try { localStorage.setItem('kf.lang', v); } catch (e) { } };
const sec = s => (lang === 'en' ? null : (DICT[lang] && DICT[lang][s]) || null);
const hit = (d, k) => (d && typeof d[k] === 'string' && d[k] ? d[k] : null);
/** A card / Knight / Monster / Gear name. */
export const tn = name => (typeof name === 'string' ? hit(sec('names'), name) || name : name);
/** Card text: the whole text if the dictionary has it, otherwise each line (and each " / "-joined part) on its own. */
// A line that differs from a dictionary entry only in its numbers uses that entry as a template: "Knockback 4." ← "Knockback #.": "튕겨내기 #."
// ('#' is filled with the numbers of the line in order; '#1', '#2' … pick a number by position when the order changes.)
const NUM = /(?<!\[d\d*)\d+/g; // numbers, except the 10 of the [d10] icon
const tpl = (d, l) => { const nums = l.match(NUM); if (!nums) return null; const v = hit(d, l.replace(NUM, '#')); if (!v) return null; let i = 0; return v.replace(/#(\d)?/g, (m, k) => (k ? nums[+k - 1] : nums[i++]) ?? m); };
// [V] / [H] / [P] / [Peril] are transcription variants of [Vigor] / [Heat] / [Passion] / [Peril Check]: looked up in the canonical spelling
export const canon = s => s.replace(/\[V\]/g, '[Vigor]').replace(/\[H\]/g, '[Heat]').replace(/\[P\]/g, '[Passion]').replace(/\[Peril\]/g, '[Peril Check]');
const line0 = (d, l) => { const t = l.trim(); const c = canon(t); return hit(d, l) || hit(d, t) || hit(d, c) || tpl(d, t) || (c !== t ? tpl(d, c) : null); };
// gate tags printed in front of a gated line: "[GRAVE] Falsity." / "[P 3+] Spotlight."
const GATE_TAG = { JUDICIUM: '판결', GRAVE: '중대', MAJOR: '상위', MINOR: '하위', APE: '유인원', HUMAN: '인간', KING: '왕', DEVIL: '악마', DRAGON: '용', VASSAL: '봉신', 'ANY CONDITION': '모든 상태', 'PRINCIPALITY OF STONE': '돌의 공국', 'SUNKEN KINGDOM': '가라앉은 왕국' };
const gateTag = g => GATE_TAG[g] || (/^(P|PASSION) (\d+\+)$/.test(g) ? '격정 ' + g.replace(/^\S+ /, '') : /^Bane \d+\+$/.test(g) ? '해악 ' + g.slice(5) : null);
// a line the dictionary does not hold whole: a gate tag + a known line, or several known sentences ("Break 2. Commit.")
const line = (d, l) => { const v = line0(d, l); if (v) return v; const t = l.trim();
  const g = t.match(/^\[([A-Z][A-Za-z0-9+ ]*)\] (.+)$/); if (g && gateTag(g[1])) { const r = line(d, g[2]); if (r) return `[${gateTag(g[1])}] ${r}`; }
  const th = t.match(/^\[Two-handed(?: icon)?\]: (.+)$/); if (th) { const r = line(d, th[1]); if (r) return `[양손]: ${r}`; }
  const one = x => line0(d, x) || (/ instead\.$/.test(x) ? (r => (r ? '대신 ' + r : null))(line0(d, x.replace(/ instead\.$/, '.'))) : null); // "Closing 3 instead." = 대신 결착 3.
  const parts = t.split(/(?<=[.!])\s+/); const tr = parts.map(one); if (tr.every(Boolean)) return tr.join(' ');
  return null; };
export const tx = text => { if (typeof text !== 'string' || lang === 'en') return text; const d = sec('text'); if (!d) return text; const whole = hit(d, text); if (whole) return whole; return text.split('\n').map(l => line(d, l) || l).join('\n'); };
/** An interface string by key. */
export const tu = (key, fallback) => hit(sec('ui'), key) || fallback;
/** Used by the DOM helper: a text node that is exactly a known name or text line is shown translated (no effect in English). */
export const auto = s => { if (lang === 'en' || typeof s !== 'string' || !s) return s; return hit(sec('names'), s) || line(sec('text') || {}, s) || trIn(s, true); };
// Names inside a longer sentence (log lines, prompts, button labels): every dictionary name that is not a glossary keyword
// (DICT[lang]._inlineSkip) is replaced where it stands as a whole word. `multiOnly` limits this to names of two or more words —
// used for arbitrary text nodes, where a one-word name ("Slash", "Ruin", "Counter") could be an ordinary word.
const RX = {};
const rxFor = multiOnly => { const key = lang + (multiOnly ? ':m' : ':a'); if (key in RX) return RX[key]; const d = sec('names') || {}; const skip = new Set((DICT[lang] && DICT[lang]._inlineSkip) || []); const ns = Object.keys(d).filter(n => d[n] && !skip.has(n) && n.length > 2 && /^[A-Z0-9]/.test(n) && (!multiOnly || /\s/.test(n))).sort((a, b) => b.length - a.length); RX[key] = ns.length ? new RegExp('(?<![A-Za-z])(?:' + ns.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z])', 'g') : null; return RX[key]; };
export const trIn = (s, multiOnly = false) => { if (lang === 'en' || typeof s !== 'string' || !s || !/[A-Za-z]{3}/.test(s)) return s; const rx = rxFor(multiOnly); if (!rx) return s; const d = sec('names'); return s.replace(rx, m => d[m] || m); };
export const translatedCount = () => { const d = DICT[lang] || {}; return ['names', 'text', 'ui'].reduce((a, s) => a + Object.values(d[s] || {}).filter(v => typeof v === 'string' && v).length, 0); };
