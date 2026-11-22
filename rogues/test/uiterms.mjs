// Language option: interface terms inside Korean sentences + particle agreement
import fs from 'fs';
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { initI18n, trIn, setLang } = await import('../src/ui/i18n.js');
initI18n({ i18n: { ko: JSON.parse(fs.readFileSync('data/i18n/ko.json', 'utf8')) } });
let fail = 0; const eq = (a, b) => { if (trIn(a) !== b) { fail++; console.log('FAIL', a, '→', trIn(a), '≠', b); } };
setLang('en'); eq('Ser Ubar: Vigor를 0으로', 'Ser Ubar: Vigor를 0으로');
setLang('ko');
eq('Vigor를 0으로', '활기를 0으로'); eq('Wound를 입힘', '부상을 입힘'); eq('Heat로 Evasion/Judgement 재굴림 불가', '열기로 회피/심판 재굴림 불가');
eq('Knight Pool에 Fire 토큰이 없음', '기사 풀에 화염 토큰이 없음'); eq('Mob이(가) 이동', '개체가 이동'); eq('Target으로 이동', '대상으로 이동');
eq('2 피해 → -2 [V], Peril', '2 피해 → -2 [활기], 위험'); eq("Rogue's Path 캠페인", "Rogue's Path 캠페인"); eq('Attack the Monster.', 'Attack the Monster.');
eq('Armor 토큰 2', '방어구 토큰 2'); eq('Sigh of the Graal 사용', '성배의 한숨 사용');
console.log(fail ? `${fail} FAILED` : 'ALL PASS (ui terms)'); if (fail) process.exit(1);
