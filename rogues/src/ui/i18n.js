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
export const tx = text => { if (typeof text !== 'string' || lang === 'en') return text; const d = sec('text'); if (!d) return text; const whole = hit(d, text); if (whole) return whole; return text.split('\n').map(l => hit(d, l) || hit(d, l.trim()) || l).join('\n'); };
/** An interface string by key. */
export const tu = (key, fallback) => hit(sec('ui'), key) || fallback;
/** Used by the DOM helper: a text node that is exactly a known name or text line is shown translated (no effect in English). */
export const auto = s => { if (lang === 'en' || typeof s !== 'string' || !s) return s; return hit(sec('names'), s) || hit(sec('text'), s) || trIn(s, true); };
// Names inside a longer sentence (log lines, prompts, button labels): every dictionary name that is not a glossary keyword
// (DICT[lang]._inlineSkip) is replaced where it stands as a whole word. `multiOnly` limits this to names of two or more words —
// used for arbitrary text nodes, where a one-word name ("Slash", "Ruin", "Counter") could be an ordinary word.
const RX = {};
const rxFor = multiOnly => { const key = lang + (multiOnly ? ':m' : ':a'); if (key in RX) return RX[key]; const d = sec('names') || {}; const skip = new Set((DICT[lang] && DICT[lang]._inlineSkip) || []); const ns = Object.keys(d).filter(n => d[n] && !skip.has(n) && n.length > 2 && /^[A-Z0-9]/.test(n) && (!multiOnly || /\s/.test(n))).sort((a, b) => b.length - a.length); RX[key] = ns.length ? new RegExp('(?<![A-Za-z])(?:' + ns.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z])', 'g') : null; return RX[key]; };
export const trIn = (s, multiOnly = false) => { if (lang === 'en' || typeof s !== 'string' || !s || !/[A-Za-z]{3}/.test(s)) return s; const rx = rxFor(multiOnly); if (!rx) return s; const d = sec('names'); return s.replace(rx, m => d[m] || m); };
export const translatedCount = () => { const d = DICT[lang] || {}; return ['names', 'text', 'ui'].reduce((a, s) => a + Object.values(d[s] || {}).filter(v => typeof v === 'string' && v).length, 0); };
