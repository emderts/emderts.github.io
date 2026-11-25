// Technique texts and names inside the composite strings the UI builds (loadout rows, reward options, REACT options) are translated whole.
import fs from 'fs';
globalThis.localStorage = { getItem: () => 'ko', setItem() { } };
const I = await import('../src/ui/i18n.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
I.initI18n({ i18n: { ko: JSON.parse(fs.readFileSync(new URL('../data/i18n/ko.json', import.meta.url), 'utf8')) } }); I.setLang('ko');
const eng = s => (String(s).match(/[A-Za-z]{3,}/g) || []).filter(w => !/^(BP|AI|AT|VP|Lv|CD|DL|DC|AND|OR)$/.test(w));
let n = 0; const bad = []; const dir = new URL('../data/knights/', import.meta.url);
for (const f of fs.readdirSync(dir)) { const d = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')); for (const t of d.techniques || []) for (const fn of ['auto', 'trLabel', 'trDetail']) for (const s of [`${t.text} · 분발: 파쇄 (대기)`, `${t.text} · Exert: Break (cooldown)`, `L2: ${t.name} (Technique)`, `${d.name}: ${t.name} (Heat +1 · cooldown) — ${t.text}`]) { n++; const r = I[fn](s); if (eng(r).length >= 2) bad.push(`${fn} | ${r.slice(0, 160)}`); } }
bad.slice(0, 10).forEach(b => console.log(b));
ok(n > 1000 && bad.length === 0, `technique text / name in composite labels: ${n} strings, ${bad.length} left in English`);
ok(I.auto('L2: One for All (Technique)') === 'L2: 모두를 위한 하나 (기술)', 'a card name containing "All" is not rewritten as the stat word');
console.log(fails ? `${fails} FAIL` : 'ALL PASS (technique labels)'); process.exit(fails ? 1 : 0);
