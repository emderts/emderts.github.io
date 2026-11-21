// Writes docs/i18n/<lang>.template.json: every name and card-text line found in data/, with the translation already
// present in data/i18n/<lang>.json (or "") as the value. Usage: node tools/i18n_extract.mjs [lang=ko]
import fs from 'fs';
import path from 'path';
const lang = process.argv[2] || 'ko';
const have = fs.existsSync(`data/i18n/${lang}.json`) ? JSON.parse(fs.readFileSync(`data/i18n/${lang}.json`, 'utf8')) : {};
const names = new Set(), text = new Set();
const TEXT_KEYS = new Set(['text', 'effects', 'targeting', 'afterAttack', 'afterFinalAttack', 'aiResponse', 'commandment', 'infusionText', 'wound', 'fail', 'instinct', 'critical', 'ultrainstinct', 'whenRevealed', 'whileRevealed', 'clash', 'squire', 'bottomBox', 'preTargeting']);
const addText = v => { if (typeof v === 'string') for (const l of v.split('\n')) { const s = l.trim(); if (s && /[A-Za-z]/.test(s)) text.add(s); } else if (Array.isArray(v)) v.forEach(addText); else if (v && typeof v === 'object') Object.values(v).forEach(addText); };
const walk = (x, key = '') => { if (Array.isArray(x)) return x.forEach(v => walk(v, key)); if (!x || typeof x !== 'object') return; if (typeof x.name === 'string' && x.name && /[A-Za-z]/.test(x.name)) names.add(x.name); for (const [k, v] of Object.entries(x)) { if (k.startsWith('_') || k === 'ops' || k === 'rulings' || k === 'unclear' || k === 'note' || k === 'notes') continue; if (TEXT_KEYS.has(k)) addText(v); if (k === 'traits' && Array.isArray(v)) v.forEach(t => typeof t === 'string' && names.add(t)); walk(v, k); } };
const load = dir => { for (const ent of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) { if (ent.name !== 'i18n') load(full); } else if (ent.name.endsWith('.json')) walk(JSON.parse(fs.readFileSync(full, 'utf8'))); } };
load('data');
const fill = (set, sec) => Object.fromEntries([...set].sort((a, b) => a.localeCompare(b)).map(k => [k, (have[sec] && have[sec][k]) || '']));
const out = { _doc: `Template for data/i18n/${lang}.json — copy the entries you translate into the matching section there.`, names: fill(names, 'names'), text: fill(text, 'text'), ui: have.ui || {} };
fs.mkdirSync('docs/i18n', { recursive: true }); fs.writeFileSync(`docs/i18n/${lang}.template.json`, JSON.stringify(out, null, 1));
const done = s => Object.values(out[s]).filter(Boolean).length;
console.log(`wrote docs/i18n/${lang}.template.json — names ${done('names')}/${names.size}, text lines ${done('text')}/${text.size}`);
