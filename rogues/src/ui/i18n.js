// Language option: English (original card text) ↔ 한국어 (translation).
// The game data stays in English; a dictionary (data/i18n/<lang>.json) maps original strings to translated ones.
//   names — card / Knight / Monster / Gear / Condition / Terrain names           { "Chipped Axe": "이 빠진 도끼" }
//   text  — card text, matched as a whole card text first, then line by line     { "Break 1.": "Break 1." }
//   ui    — interface strings by key (optional; the interface itself is Korean)  { "lang.toggle": "언어" }
// A missing entry always falls back to the original, so a dictionary can be filled in gradually.
// tools/i18n_extract.mjs writes docs/i18n/<lang>.template.json with every name and text line used by the data.
export const LANGS = [{ id: 'ko', label: '한국어 (번역)' }, { id: 'en', label: 'English (원문)' }];
let lang = 'ko'; try { const v = localStorage.getItem('kf.lang'); if (LANGS.some(l => l.id === v)) lang = v; } catch (e) { }
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
const GATE_TAG = { JUDICIUM: '판결', GRAVE: '심각', MAJOR: '주요', MINOR: '경미', APE: '유인원', HUMAN: '인간', KING: '왕', DEVIL: '악마', DRAGON: '용', VASSAL: '가신', 'ANY CONDITION': '모든 상태', 'PRINCIPALITY OF STONE': '돌의 공국', 'SUNKEN KINGDOM': '가라앉은 왕국', SLIMED: '점액 범벅', POSTGAME: '포스트게임' };
const gateTag = g => GATE_TAG[g] || (/^HEAT \d+\+$/.test(g) ? '열기 ' + g.slice(5) : null) || (/^(P|PASSION) (\d+\+)$/.test(g) ? '격정 ' + g.replace(/^\S+ /, '') : /^(Bane|BANE) \d+\+$/.test(g) ? '해악 ' + g.slice(5) : null);
// a line the dictionary does not hold whole: a gate tag + a known line, or several known sentences ("Break 2. Commit.")
const line = (d, l) => { const v = line0(d, l); if (v) return v; const t = l.trim();
  const g = t.match(/^\[([A-Z][A-Za-z0-9+ ]*)\] (.+)$/); if (g && gateTag(g[1])) { const r = line(d, g[2]); if (r) return `[${gateTag(g[1])}] ${r}`; }
  const th = t.match(/^\[Two-handed(?: icon)?\]: (.+)$/); if (th) { const r = line(d, th[1]); if (r) return `[양손]: ${r}`; }
  const one = x => line0(d, x) || (/ instead\.$/.test(x) ? (r => (r ? '대신 ' + r : null))(line0(d, x.replace(/ instead\.$/, '.'))) : null); // "Closing 3 instead." = 대신 결착 3.
  const parts = t.split(/(?<=[.!])\s+/); const tr = parts.map(one); if (tr.every(Boolean)) return tr.join(' ');
  if (!/[.!:?)"]$/.test(t)) { const ls = t.split(', ').map(x => one(x + '.')); if (ls.every(Boolean)) return ls.map(x => x.replace(/\.$/, '')).join(', '); } // a bare keyword list without the full stop: "Auto-break 1, +1 [Precision]"
  return null; };
export const tx = text => { if (typeof text !== 'string' || lang === 'en') return text; const d = sec('text'); if (!d) return text; const whole = hit(d, text); if (whole) return whole; return text.split('\n').map(l => line(d, l) || l).join('\n'); };
/** An interface string by key. */
export const tu = (key, fallback) => hit(sec('ui'), key) || fallback;
/** Used by the DOM helper: a text node that is exactly a known name or text line is shown translated (no effect in English). */
// Joined display lines ("Break 1. Commit. / [GRAVE] Armor-piercing 1.", "weapon 2H · Mob · Attack 1d10 (Precision +1) · Power black + red", "Axe, Metal"):
// each piece is translated on its own; a short stat piece gets its game terms replaced even without Korean around it.
const STAT = { weapon: '무기', armor: '방어구', support: '지원', red: '붉은', black: '검은', white: '흰', '1H': '한손', '2H': '양손', cooldown: '대기', delay: '지연', discard: '버리기', All: '공통', 'Armor dice': '방어 주사위', Exert: '분발', 'Power Re-roll': '위력 재굴림', Consumable: '소모품', PowerReroll: '위력 재굴림', PowerDieRed: '붉은 위력 주사위', PowerDieBlack: '검은 위력 주사위', PowerDieWhite: '흰 위력 주사위', Portrait: '초상', VIGOR: '활기', HEAT: '열기', PASSION: '격정', BLOOD: '피', 'LITTLE SER': '꼬마 경', ROUSE: '자극', LEASH: '속박', FORM: '형태', APE: '유인원', HUMAN: '인간', ZEAL: '열의', MAGIC: '마법', Traits: '특성', Arc: '서사' };
const EXACT = { 'When revealed:': '공개될 때:', Heroic: '영웅 서사', Peril: '위험 서사', 'REACT! 없음': '⚡ 반응 없음', 'SUNKEN KINGDOM': '가라앉은 왕국', 'PRINCIPALITY OF STONE': '돌의 공국' }; // short button labels
const STATRX = new RegExp('(?<![A-Za-z])(' + Object.keys(STAT).sort((a, b) => b.length - a.length).join('|') + ')(?![A-Za-z])', 'g');
const FUNC = /\b([Tt]he|[Yy]ou|[Yy]our|[Tt]hey|[Tt]heir|is|are|[Ii]f|[Tt]hen|may|[Tt]his|[Tt]hat|with|from|[Ww]hen|[Aa]|[Aa]n|or|and|[Uu]se|to|at)\b/;
const piece = p => { const t = p.trim(); if (!t || !/[A-Za-z]/.test(t)) return p; const d = sec('text') || {}; const k = hit(sec('names'), t) || line(d, t) || (/[.!]$/.test(t) ? '' : line(d, t + '.')); if (k) return p.replace(t, /[.!]$/.test(t) || !/[.!]$/.test(k) ? k : k.replace(/[.!]$/, '')); if (t.length > 48 || FUNC.test(t)) return trIn(p, true); const u = uiRx(); const r = t.replace(STATRX, m => STAT[m]); return p.replace(t, u ? r.replace(u.rx, (m, w, j) => (u.d[w] || w) + (j || '')) : r); };
const SEP = /( · | — |, |: )/; const DEPL = /(?<![A-Za-z])(cooldown|delay|discard)(?![A-Za-z])/g; const flip = x => x.replace(/(\d+) (붉은|검은|흰)(?![가-힣])/g, '$2 $1');
const chunk = c => { const t = c.trim(); if (!t || !/[A-Za-z]/.test(t)) return c; const k = EXACT[t] || hit(sec('names'), t) || (sec('uiterms') || {})[t] || line(sec('text') || {}, t); if (k) return c.replace(t, k); if (/[가-힣]/.test(t)) return trIn(c).replace(DEPL, m => STAT[m]); { const m = /^([^:]{1,40}): (.+)$/.exec(t); if (m) { const b = line(sec('text') || {}, m[2]); if (b) return c.replace(t, chunk(m[1]) + ': ' + b); } } /* "Name: card text" */ if (/[.!?]$/.test(t) && FUNC.test(t)) return trIn(c, true); /* an untranslated sentence stays whole */ return flip(c.split(SEP).map((p, i) => i % 2 ? p : piece(p)).join('')); };
// A prompt / option label that quotes one card line after a name ("Parasite Lure: [GRAVE] 1 [Heat] [Discard] Discard 1 …")
export const trLabel = s => { if (lang === 'en' || typeof s !== 'string' || !s) return s; const m = /^([^:\n]{1,48}): (.+)$/.exec(s); if (m && !/[가-힣]/.test(m[2])) { const b = line(sec('text') || {}, m[2]); if (b) return (hit(sec('names'), m[1]) || trIn(m[1])) + ': ' + b; } return /[가-힣]/.test(s) ? trIn(s) : auto(s); };
// An option's detail line: "stats — traits — card text / card text"
export const trDetail = s => (lang === 'en' || typeof s !== 'string' || !s ? s : s.split(' — ').map(x => auto(x)).join(' — '));
export const auto = s => { if (lang === 'en' || typeof s !== 'string' || !s) return s; if (EXACT[s.trim()]) return s.replace(s.trim(), EXACT[s.trim()]); const k = hit(sec('names'), s) || line(sec('text') || {}, s); if (k) return k; if (s.includes('\n')) return s.split('\n').map(auto).join('\n'); if (/[가-힣]/.test(s)) return trIn(s, true).replace(DEPL, m => STAT[m]); return s.split(' / ').map(chunk).join(' / '); };
// Names inside a longer sentence (log lines, prompts, button labels): every dictionary name that is not a glossary keyword
// (DICT[lang]._inlineSkip) is replaced where it stands as a whole word. `multiOnly` limits this to names of two or more words —
// used for arbitrary text nodes, where a one-word name ("Slash", "Ruin", "Counter") could be an ordinary word.
const RX = {};
const rxFor = multiOnly => { const key = lang + (multiOnly ? ':m' : ':a'); if (key in RX) return RX[key]; const d = sec('names') || {}; const skip = new Set((DICT[lang] && DICT[lang]._inlineSkip) || []); const ns = Object.keys(d).filter(n => d[n] && !skip.has(n) && n.length > 2 && /^[A-Z0-9]/.test(n) && (!multiOnly || /\s/.test(n))).sort((a, b) => b.length - a.length); RX[key] = ns.length ? new RegExp('(?<![A-Za-z])(?:' + ns.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z])', 'g') : null; return RX[key]; };
// Korean particles written after an English term ("Wound를", "Heat로") are matched to the translated word ("부상을", "열기로")
const JOSA = [['을(를)', '을', '를'], ['이(가)', '이', '가'], ['은(는)', '은', '는'], ['와(과)', '과', '와'], ['(으)로', '으로', '로'], ['을', '을', '를'], ['를', '을', '를'], ['이', '이', '가'], ['가', '이', '가'], ['은', '은', '는'], ['는', '은', '는'], ['과', '과', '와'], ['와', '과', '와'], ['으로', '으로', '로'], ['로', '으로', '로']];
const JRX = '(?:(' + JOSA.map(j => j[0].replace(/[()]/g, '\\$&')).join('|') + ')(?![가-힣]))?';
const josa = (w, p) => { if (!p) return w; const c = w.charCodeAt(w.length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + p; const b = (c - 0xAC00) % 28; const j = JOSA.find(x => x[0] === p); return w + (j[1] === '으로' ? (b && b !== 8 ? '으로' : '로') : b ? j[1] : j[2]); };
// Interface terms (DICT[lang].uiterms: confirmed keywords + tools/i18n/uiterms_ko.txt) are replaced only inside Korean sentences
const ICON = { '[V]': '[활기]', '[H]': '[열기]', '[P]': '[격정]' };
const uiRx = () => { const key = lang + ':u'; if (key in RX) return RX[key]; const d = { ...(sec('names') || {}), ...(sec('uiterms') || {}) }; const skip = new Set((DICT[lang] && DICT[lang]._inlineSkip) || []); const u = sec('uiterms') || {}; const ns = Object.keys(d).filter(n => d[n] && d[n] !== n && n.length > 2 && /^[A-Z0-9]/.test(n) && (n in u || !skip.has(n))).sort((a, b) => b.length - a.length); RX[key] = ns.length ? { d, rx: new RegExp('(?<![A-Za-z]|of |the |\\w[\'’]s )(' + ns.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z]|[\'’]s | of | the [A-Z])' + JRX, 'g') } : null; return RX[key]; };
// internal ids that reach a sentence ("fullClash Loot 교환", "Knight Pool +1 opening")
const IDS = { fullClash: '온전 격돌', exhibitionClash: '시범 격돌', kingdomGear: '왕국 장비', consumableGear: '소모품 장비' }; const IDRX = /\b(fullClash|exhibitionClash|kingdomGear|consumableGear)\b/g;
const TOK = { opening: '틈새', break: '파쇄', cantrip: '소마법', closing: '결착', fire: '화염', hope: '희망', black: '칠흑', rouse: '자극', spell: '주문', power: '위력', sunder: '쪼개기', magic: '마법', diversion: '견제', zeal: '열의', fleisch: '살코기' };
export const trIn = (s, multiOnly = false) => { if (lang === 'en' || typeof s !== 'string' || !s || !/[A-Za-z]{3}|\[[VHP]\]/.test(s)) return s;
  { const m = !multiOnly && /^Targeting: (.+?)( → .+)?$/.exec(s); if (m && !/[가-힣]/.test(m[1])) { const d = sec('text') || {}; const b = line(d, m[1]) || line(d, m[1].replace(/^\[[^\]]+\] /, '')); if (b) return ((sec('uiterms') || {}).Targeting || 'Targeting') + ': ' + b + (m[2] ? trIn(m[2]) : ''); } } /* the targeting line that picked the Target, as printed on the card */
  { const j = s.lastIndexOf(' — '); if (j > 0 && !multiOnly) { const tail = s.slice(j + 3); if (tail.length > 12 && !/[가-힣]/.test(tail)) { const b = line(sec('text') || {}, tail); if (b) return trIn(s.slice(0, j)) + ' — ' + b; } } } /* "… — <card text>" */
  if (/[가-힣]/.test(s)) { const u = uiRx(); if (u) return s.replace(u.rx, (m, w, p) => josa(u.d[w] || w, p)).replace(/\[[VHP]\]/g, m => ICON[m]).replace(IDRX, m => IDS[m]).replace(/(풀 [+-]?\d+ )([a-z]+)/g, (m, a, b) => a + (TOK[b] || b)); }
  if (s.length <= 64 && !FUNC.test(s) && !multiOnly) { const u = uiRx(); if (u) { const d = sec('names'), rx2 = rxFor(false); const t = s.replace(/(Pool [+-]?\d+ )([a-z]+)/g, (m, a, b) => a + (TOK[b] || b)).replace(u.rx, (m, w, p) => (u.d[w] || w) + (p || '')); return rx2 ? t.replace(rx2, m => d[m] || m) : t; } } /* a short English log line ("Total Power 6 vs AT 6 (Break 1)") */
  const rx = rxFor(multiOnly); if (!rx) return s; const d = sec('names'); return s.replace(rx, m => d[m] || m); };
export const translatedCount = () => { const d = DICT[lang] || {}; return ['names', 'text', 'ui'].reduce((a, s) => a + Object.values(d[s] || {}).filter(v => typeof v === 'string' && v).length, 0); };
