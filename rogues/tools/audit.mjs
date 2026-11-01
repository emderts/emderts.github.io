// Generates docs/audit/index.html: every transcribed table/card ↔ how the engine implements it ↔ which test covers it.
// Run: node tools/audit.mjs   (re-run after every data/engine change)
import fs from 'fs';
import path from 'path';
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = rd('data/rosegraal/monster_tables.json'), M = rd('data/rosegraal/map.json'), R = rd('data/rosegraal/rewards.json'), meta = rd('data/meta.json');
const K = rd('data/knights/fleischritter.json'), PA = rd('data/knights/peril_arcs.json'), G = rd('data/gear/gear.json'), DICE = rd('data/components/dice.json'), BOARD = rd('data/components/board.json');
const unc = arr => arr && arr.length ? `<div class="warn small">⚠ ${arr.map(esc).join(' · ')}</div>` : '';
const sec = [];

// 1. Monster tables
sec.push(`<section id="monsters"><h2>1. 노드 → 몬스터 표 (룰북 p.77)</h2>
<p class="impl">구현: <code>src/engine/rosegraal.js · rollMonster()</code> — d10, 미보유(★ optional) 몬스터면 재굴림 · 테스트: <code>test/rosegraal.mjs</code> (각 레벨/왕국 1–10 커버리지, 재굴림, 보유 몬스터 없음 예외)</p>
<table><tr><th>레벨</th><th>굴림</th><th>Principality of Stone</th><th>Lv</th><th>굴림</th><th>Sunken Kingdom</th><th>Lv</th></tr>
${[1, 2, 3, 4, 5].map(lv => { const p = T.levels[lv].principality, s = T.levels[lv].sunken; const n = Math.max(p.length, s.length);
  return Array.from({ length: n }, (_, i) => `<tr>${i === 0 ? `<td rowspan="${n}"><b>${['', 'I Mob', 'II Vassal', 'III King', 'IV Devil', 'V Dragon'][lv]}</b></td>` : ''}${[p[i], s[i]].map(r => r ? `<td>${r.roll.join('–')}</td><td>${esc(T.monsterNames[r.monster])}${r.optional ? ' ★' : ''}</td><td>${r.level}</td>` : '<td></td><td></td><td></td>').join('')}</tr>`).join(''); }).join('')}
</table><p class="small">★ = 미보유 시 재굴림(룰북 각주). 전사 불확실 항목 없음.</p></section>`);

// 2. Map
const byK = k => M.nodes.filter(n => n.kingdom === k && n.id !== 'S');
const cnt = (arr, f) => arr.reduce((a, n) => { const k = f(n); a[k] = (a[k] || 0) + 1; return a; }, {});
sec.push(`<section id="map"><h2>2. Rosegraal 지도 (룰북 p.78–79, 합본)</h2>
<p class="impl">데이터: <code>data/rosegraal/map.json</code> — 노드 ${M.nodes.length}(Sunken ${byK('sunken').length} + Principality ${byK('principality').length} + S), 간선 ${M.edges.length}(소유자가 물리 시트와 대조해 확정) · 테스트: <code>test/map.mjs</code> (노드 수, 레벨=부활, 보상 코드, 중복 간선, S에서 전 노드 도달) · 엔진: 노드 선택 규칙(크로스아웃 노드에 인접) → <code>campaign.js</code> 예정 · 간선 확인 페이지: <code>docs/audit/rosegraal_check.html</code></p>
<table><tr><th></th><th>I</th><th>II</th><th>III</th><th>IV</th><th>V</th><th>C</th><th>H</th><th>P</th><th>T</th><th>G</th><th>V</th><th>W</th><th>Sigh</th></tr>
${['sunken', 'principality'].map(k => { const L = cnt(byK(k), n => n.level), Rw = cnt(byK(k), n => n.reward); return `<tr><td><b>${k}</b></td>${[1, 2, 3, 4, 5].map(l => `<td>${L[l] || 0}</td>`).join('')}${['C', 'H', 'P', 'T', 'G', 'V', 'W', 'S'].map(c => `<td>${Rw[c] || 0}</td>`).join('')}</tr>`; }).join('')}
</table>
<details><summary>노드 목록</summary><table><tr><th>id</th><th>왕국</th><th>Lv</th><th>부활</th><th>보상</th><th>인접</th></tr>
${M.nodes.map(n => `<tr><td>${n.id}</td><td>${n.kingdom}</td><td>${n.level || '-'}</td><td>${n.res || '-'}</td><td>${n.reward ? esc(M.rewardCodes[n.reward]) : (n.start ? 'START' : '')}</td><td>${M.edges.filter(e => e.a === n.id || e.b === n.id).map(e => { const o = e.a === n.id ? e.b : e.a; return e.confidence === 'check' ? `<span class="warn">${o}?</span>` : o; }).join(' ')}</td></tr>`).join('')}
</table></details>
<p class="small">간선: 뿌리 그림 자동 추적(145) → 소유자 교정(-39, +7) → 114개 확정.</p></section>`);

// 3. Rewards
const fmt = r => r.kind === 'technique' ? `<i>${esc(r.name)}</i> Technique` : r.kind === 'portrait' ? `<i>${esc(r.name)}</i> Portrait+Talent` : r.kind === 'rapport' ? `+${r.n} Rapport with a chosen Knight` : r.kind === 'mercenary' ? `Tier ${r.tier} <i>${r.cls}</i> Mercenary` : r.kind === 'saint' ? `Devote to Saint ${esc(r.name)}` : r.kind === 'gold' ? `+${r.n} Gold` : r.bonuses ? Object.entries(r.bonuses).map(([v, n]) => `+${n} ${v}`).join(' & ') : `<i>${esc(r)}</i>`;
sec.push(`<section id="rewards"><h2>3. Rosegraal Rewards (룰북 pp.92–96)</h2>
<p class="impl">데이터: <code>data/rosegraal/rewards.json</code> — 체크박스 ${Object.values(R.levels).reduce((a, lv) => a + Object.values(lv).reduce((b, row) => b + Object.values(row).reduce((c, arr) => c + arr.length, 0), 0), 0)}개 · 구현: <code>rosegraal.js · eligibleRewards()</code> — 정복 노드 심볼 종류, 노드 레벨 이하, 미획득 중 하나 선택(사용자 해석: Technique 2개 중 하나) · 테스트: <code>test/rewards.mjs</code></p>
${[1, 2, 3, 4, 5].map(lv => `<h3>Level ${lv}</h3><table class="rw"><tr><th></th>${Object.keys(R.knights).map(k => `<th>${esc(R.knights[k].name)}${R.knights[k].expansion ? '<br><span class="small">(TTSF)</span>' : ''}</th>`).join('')}</tr>
${Object.entries(R.kinds).map(([c, name]) => `<tr><td><b>${name}</b> ${c}</td>${Object.keys(R.knights).map(k => `<td>${(R.levels[lv][k][c] || []).map(r => `☐ ${fmt(r)}`).join('<br>')}</td>`).join('')}</tr>`).join('')}</table>`).join('')}
<p class="small warn">불확실: ${R.unclear.map(esc).join(' · ')}</p></section>`);


// 4. Components
sec.push(`<section id="components"><h2>4. 구성물 — Clash Board · 주사위 · Knight Board</h2>
<p class="impl">데이터: <code>data/components/{board,dice,knight_board}.json</code> · 구현: <code>board.js</code> (14×10 격자, 직교 인접·거리, LoS, Zone, facing/rear) · <code>dice.js</code> (Crit d10, Power 풀 상한·승급, Power/Armor 굴림) · <code>knight.js</code> (Vigor/Heat/Passion 트랙, Heat Limit, Peril 임계, Bane, Refresh, Aftermath) · 테스트: <code>test/engine1.mjs</code></p>
<p>Clash Board ${BOARD.cols}×${BOARD.rows} (열 1–14, 행 A–J). Power 주사위 색 상한 빨 ${DICE.limits.red} / 검 ${DICE.limits.black} / 흰 ${DICE.limits.white}.</p>
<table><tr><th>색</th><th>면 1</th><th>면 2</th><th>면 3</th><th>면 4</th><th>면 5</th><th>면 6</th></tr>${['red', 'black', 'white'].map(c => `<tr><td><b>${c}</b></td>${DICE.faces[c].map(f => `<td>${Object.entries(f).map(([k, n]) => `${{ P: '⚔', T: '✦', H: '🕊' }[k]}${n}`).join(' ')}</td>`).join('')}</tr>`).join('')}</table>
${unc(DICE.unclear)}</section>`);

// 5. Fleischritter
const arcRow = a => `<tr><td><b>${esc(a.name)}</b></td><td>${a.plus ? esc(a.plus.text) : ''}</td><td>${a.levels.map(l => `L${l.level}: ${l.options.map(o => o.map(t => `${esc(t.token)}${t.n != null ? ' ' + t.n : ''}`).join(' + ')).join(' <b>|</b> ')}`).join('<br>')}</td><td>${unc(a.unclear)}</td></tr>`;
const perilRow = a => `<tr><td><b>${esc(a.name)}</b></td><td>${a.maxVigor}</td>${['Uninjured', 'Minor', 'Major', 'Grave', 'Judicium'].map(k => `<td>${a.levels[k].vigor[0]}–${a.levels[k].vigor[1]} · H${a.levels[k].heatLimit}</td>`).join('')}<td>${a.bonus ? esc(a.bonus.text) + (a.bonus.guess ? ` <span class="warn">(${esc(a.bonus.guess)})</span>` : '') : ''}</td></tr>`;
sec.push(`<section id="fleischritter"><h2>5. Fleischritter — Knight Setup · Talent · Heroic/Peril Arc · Technique</h2>
<p class="impl">데이터: <code>data/knights/fleischritter.json</code>, <code>data/knights/peril_arcs.json</code> · 구현: Knight Setup → <code>campaign.js</code>(예정), Peril Arc → <code>knight.js · peril()/heatLimit</code> ✔, Heroic Arc/Talent/Technique → <code>effects.js</code>(예정, <code>ops</code> 미작성) · 테스트: <code>test/knightdata.mjs</code> (보상표의 Arc/Technique/Gear 이름이 모두 데이터에 존재, Peril 구간 연속성)</p>
<h3>Knight Setup (Knightbook p.4)</h3><p>Virtues: ${Object.entries(K.setup.virtues).map(([v, n]) => `${v} ${n}`).join(', ')} · Portrait: ${K.setup.portraits.join(', ')} · Talent/Arcs: ${K.setup.talent} · 시작 Technique: ${K.setup.techniques.join(', ')} · Gear: ${K.setup.gear.join(', ')} · Rapport Boon: ${esc(K.setup.rapportBoon.text)} <span class="warn">(${esc(K.setup.rapportBoon.note)})</span></p>
<p>First Death: ${esc(K.firstDeath.text)} <span class="warn">(${esc(K.firstDeath.note)})</span></p>
<h3>Talents</h3><table><tr><th>Talent</th><th>Tier</th><th>능력</th></tr>${K.talents.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${t.tier}</td><td>${t.abilities.map(a => `<b>${esc(a.name)}</b>: ${esc(a.text)} ${a.ops ? '' : '<span class="warn">[ops 미작성]</span>'}${unc(a.unclear ? [a.unclear] : [])}`).join('<br>')}</td></tr>`).join('')}</table>
<h3>Heroic Arcs (8)</h3><table><tr><th>이름</th><th>+행</th><th>레벨별 옵션</th><th></th></tr>${K.heroicArcs.map(arcRow).join('')}</table>
<p class="small warn">토큰명 끝의 ?는 아이콘 추정(미확인).</p>
<h3>Peril Arcs (전 기사 56장)</h3>${Object.keys(PA.arcs).map(k => `<details${k === 'fleischritter' ? ' open' : ''}><summary>${k} (${PA.arcs[k].length})</summary><table><tr><th>이름</th><th>최대 Vigor</th><th>Uninjured</th><th>Minor</th><th>Major</th><th>Grave</th><th>Judicium</th><th>보너스</th></tr>${PA.arcs[k].map(perilRow).join('')}</table></details>`).join('')}
<h3>Techniques (Clash 면, ${K.techniques.length})</h3><table><tr><th>이름</th><th>해금</th><th>비용</th><th>효과</th><th>게이트</th><th>소진</th></tr>${K.techniques.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.unlock)}</td><td>${esc(JSON.stringify(t.cost))}</td><td>${esc(t.text)}${unc(t.unclear)}</td><td>${t.gates.map(g => `<b>${g.gate}</b>: ${esc(g.text)}`).join('<br>')}</td><td>${t.depletion}</td></tr>`).join('')}</table></section>`);

// 6. Gear
sec.push(`<section id="gear"><h2>6. Gear (${G.gear.length})</h2>
<p class="impl">데이터: <code>data/gear/gear.json</code> — 시작 장비 2 + Rosegraal 보상 Gear 35(7기사×5) + Laxlaw 뒷면 · 구현: 장비 슬롯/스탯 → <code>knight.js</code>(슬롯 예정), 능력 텍스트 → <code>effects.js</code>(예정)</p>
<table><tr><th>이름</th><th>기사</th><th>종류</th><th>티어</th><th>공격</th><th>방어</th><th>텍스트</th></tr>${G.gear.map(g => `<tr><td><b>${esc(g.name)}</b>${g.merchant ? ` <span class="small">(상점 ${g.price}G)</span>` : ''}</td><td>${g.knight || '-'}</td><td>${g.type}${g.hands ? ' ' + g.hands + 'H' : ''}</td><td>${g.tier}</td><td>${g.attackDice != null ? `⚔${g.attackDice} +${g.precision} ` : ''}${g.weaponPower ? esc(JSON.stringify(g.weaponPower)) : ''} ${g.bonusPower ? 'bonus ' + esc(JSON.stringify(g.bonusPower)) : ''}</td><td>${g.evasion != null ? 'Eva+' + g.evasion + ' ' : ''}${g.evasionReroll ? 'ER' + g.evasionReroll + ' ' : ''}${g.armorDice ? 'Armor ' + esc(JSON.stringify(g.armorDice)) : ''}</td><td>${esc(g.text).replace(/\n/g, '<br>')}${unc(g.unclear)}</td></tr>`).join('')}</table></section>`);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KF Rogue's Path — 데이터·규칙 오딧</title>
<style>body{margin:0;padding:16px;font:14px/1.5 system-ui,sans-serif;background:#1a1714;color:#e8dcc8;max-width:1400px}h1{color:#c9a85a;font-size:22px}h2{color:#c9a85a;margin-top:28px;border-bottom:1px solid #3a3128}h3{color:#d9c89a;margin:16px 0 6px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #3a3128;padding:4px 6px;vertical-align:top;text-align:left}th{background:#26211b}code{background:#2a241d;padding:1px 5px;border-radius:4px;color:#f0d9a0}
.impl{background:#26211b;padding:8px 10px;border-left:3px solid #c9a85a;border-radius:4px}.small{font-size:12px;color:#998b76}.warn{color:#d9a441}details summary{cursor:pointer;color:#c9a85a}table.rw td{min-width:120px}nav a{color:#c9a85a;margin-right:12px}</style></head><body>
<h1>Kingdoms Forlorn — Rogue's Path: 데이터·규칙 오딧</h1><p class="small">v${meta.version} · 생성 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 각 섹션: 전사 데이터 ↔ 엔진 구현 ↔ 테스트. 전사 불확실 항목은 노란색.</p>
<nav><a href="#monsters">몬스터 표</a><a href="#map">Rosegraal 지도</a><a href="#rewards">Rewards</a><a href="#components">구성물</a><a href="#fleischritter">Fleischritter</a><a href="#gear">Gear</a></nav>
${sec.join('\n')}
</body></html>`;
fs.mkdirSync('docs/audit', { recursive: true }); fs.writeFileSync('docs/audit/index.html', html);
console.log('wrote docs/audit/index.html', (html.length / 1024).toFixed(0), 'KB');
