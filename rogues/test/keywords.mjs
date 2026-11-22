// Keyword dictionary data: rulebook KEYWORD LIST entries keyed by the glossary spelling
import fs from 'fs';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const K = JSON.parse(fs.readFileSync('data/rules/keywords.json', 'utf8')).keywords; const G = JSON.parse(fs.readFileSync('data/i18n/ko.json', 'utf8')).glossary;
const gk = new Set(Object.keys(G).map(e => e.replace(/^\[/, '').trim()));
ok(Object.keys(K).length >= 130, 'at least 130 entries'); for (const k in K) { ok(gk.has(k), `${k}: not a glossary keyword`); ok(K[k].length > 15 && !/ token [a-z]|See box/.test(K[k].slice(0, 40)), `${k}: looks broken`); }
ok(/^Move the affected miniature up to X spaces directly away/.test(K['Knockback X']), 'Knockback X from the box'); ok(/^Activate at the start of movement/.test(K['Jump']), 'Jump');
console.log(fail ? `${fail} FAILED` : 'ALL PASS (keywords)'); if (fail) process.exit(1);
const KD = JSON.parse(fs.readFileSync('data/i18n/ko.json', 'utf8')).kwdefs; let f2 = 0; for (const k in K) { if (!KD[k]) { f2++; console.log('FAIL no Korean', k); } else if ((K[k].match(/▢/g) || []).length !== (KD[k].match(/▢/g) || []).length) { f2++; console.log('FAIL icon count', k); } } if (f2) process.exit(1); console.log('ALL PASS (keyword translations)');
