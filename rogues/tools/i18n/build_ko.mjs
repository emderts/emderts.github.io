// Builds data/i18n/ko.json from the owner's glossary (tools/i18n/glossary_ko.json) and the card-name list
// (tools/i18n/cards_ko.txt). Existing "text" / "ui" entries of data/i18n/ko.json are kept. Usage: node tools/i18n/build_ko.mjs
import fs from 'fs';
const G = JSON.parse(fs.readFileSync('tools/i18n/glossary_ko.json', 'utf8')).terms;
const old = fs.existsSync('data/i18n/ko.json') ? JSON.parse(fs.readFileSync('data/i18n/ko.json', 'utf8')) : {};
const names = {}, glossary = {};
// Monster names as the data spells them (the glossary spelling is kept too)
const ALIAS = { 'Knights of Fen': ['Knight of the Fen'], 'Panzergeist': ['Panzergeists'], 'First Men Warriors': ['Firstmen Warriors'], 'First Men Lictor Hunters': ['Firstmen Lictor Hunters'], 'King Laid Low': ['The King Laid Low'], 'Mob': [], 'clash': ['Clash'] };
const strip = s => s.replace(/^\[/, '').replace(/ (?:X-Y|X\/\+X|X\+|X Y|X)$/, '').trim();
for (const [en0, ko0] of G) { const en = en0.replace(/^\[/, ''); glossary[en] = ko0; if (/^(Auto-X Y|Devote to X|Immune to X)$/.test(en) || / X /.test(en)) continue; const e = strip(en0), k = strip(ko0); if (e === 'Mob') continue; /* "개체/개체군" — depends on context */ names[e] = k; for (const a of ALIAS[e] || []) names[a] = k; }
let missingSep = 0; for (const line of fs.readFileSync('tools/i18n/cards_ko.txt', 'utf8').split('\n')) { if (!line.trim() || line.startsWith('#')) continue; const i = line.indexOf(' = '); if (i < 0) { missingSep++; continue; } names[line.slice(0, i).trim()] = line.slice(i + 3).trim(); }
// coverage: every AI / BP / Signature / Routine / special card name in data/monsters
const need = new Set(); for (const f of fs.readdirSync('data/monsters')) { const d = JSON.parse(fs.readFileSync('data/monsters/' + f, 'utf8')); const c = d.cards || {}; names[d.name] || need.add('[monster] ' + d.name); for (const x of [...(c.ai || []), ...(c.bp || [])]) { need.add(x.name); if (x.back && x.back.name) need.add(x.back.name); } for (const k of ['signature', 'routine']) if (c[k] && c[k].name) need.add(c[k].name); for (const k of ['roar', 'bellow', 'crescendo']) if (d[k] && d[k].name) need.add(d[k].name); for (const v of Object.values(d.traitBP || {})) need.add(v.name); }
const miss = [...need].filter(n => !names[n.replace(/^\[monster\] /, '')]);
const out = { _doc: old._doc || '', _sources: 'names: owner glossary (tools/i18n/glossary_ko.json) + card names (tools/i18n/cards_ko.txt) — rebuild with node tools/i18n/build_ko.mjs. text / ui: edited here directly.', names, glossary, text: old.text || {}, ui: old.ui || {} };
fs.writeFileSync('data/i18n/ko.json', JSON.stringify(out, null, 1));
console.log(`wrote data/i18n/ko.json — names ${Object.keys(names).length}, glossary ${Object.keys(glossary).length}; card names without a translation: ${miss.length}${miss.length ? ' → ' + miss.join(' | ') : ''}${missingSep ? `; ${missingSep} malformed lines` : ''}`);
