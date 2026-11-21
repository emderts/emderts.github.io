// Language option: dictionary lookups fall back to the original text.
import { initI18n, getLang, setLang, tn, tx, tu, auto } from '../src/ui/i18n.js';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
initI18n({ i18n: { ko: { names: { 'Chipped Axe': '이 빠진 도끼', Empty: '' }, text: { 'Break 1.': 'Break 1 (번역).', 'Whole\ntext': '전체 문구' }, ui: { 'lang.toggle': '언어' } } } });
ok(getLang() === 'en' && tn('Chipped Axe') === 'Chipped Axe' && tx('Break 1.') === 'Break 1.' && auto('Chipped Axe') === 'Chipped Axe', 'English: everything is the original');
setLang('ko'); ok(getLang() === 'ko' && tn('Chipped Axe') === '이 빠진 도끼' && tn('Unknown') === 'Unknown' && tn('Empty') === 'Empty', 'names: translated when present, original otherwise (empty values too)');
ok(tx('Break 1.\nCommit.') === 'Break 1 (번역).\nCommit.' && tx('Whole\ntext') === '전체 문구', 'text: whole text first, then line by line');
ok(auto('Chipped Axe') === '이 빠진 도끼' && auto('Break 1.') === 'Break 1 (번역).' && auto('Chipped Axe (Exhausted)') === 'Chipped Axe (Exhausted)' && tu('lang.toggle', 'x') === '언어' && tu('none', 'x') === 'x', 'auto() for exact text nodes; ui keys with fallback');
setLang('xx'); ok(getLang() === 'ko', 'unknown languages are ignored'); setLang('en'); ok(tn('Chipped Axe') === 'Chipped Axe', 'back to English');
console.log(fails ? `${fails} FAIL` : 'ALL PASS (i18n)'); process.exit(fails ? 1 : 0);
