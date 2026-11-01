// Generates docs/audit/index.html: every transcribed table/card ↔ how the engine implements it ↔ which test covers it.
// Run: node tools/audit.mjs   (re-run after every data/engine change)
import fs from 'fs';
import path from 'path';
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = rd('data/rosegraal/monster_tables.json'), M = rd('data/rosegraal/map.json'), R = rd('data/rosegraal/rewards.json'), meta = rd('data/meta.json');
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
<p class="impl">데이터: <code>data/rosegraal/map.json</code> — 노드 ${M.nodes.length}(Sunken ${byK('sunken').length} + Principality ${byK('principality').length} + S), 간선 ${M.edges.length}(확실 ${M.edges.filter(e => e.confidence === 'high').length} / 확인 필요 ${M.edges.filter(e => e.confidence === 'check').length}), 후보 ${M.candidateEdges.length} · 테스트: <code>test/map.mjs</code> (노드 수, 레벨=부활, 보상 코드, 중복 간선, S에서 전 노드 도달) · 엔진: 노드 선택 규칙(크로스아웃 노드에 인접) → <code>campaign.js</code> 예정 · 간선 확인 페이지: <code>docs/audit/rosegraal_check.html</code></p>
<table><tr><th></th><th>I</th><th>II</th><th>III</th><th>IV</th><th>V</th><th>C</th><th>H</th><th>P</th><th>T</th><th>G</th><th>V</th><th>W</th><th>Sigh</th></tr>
${['sunken', 'principality'].map(k => { const L = cnt(byK(k), n => n.level), Rw = cnt(byK(k), n => n.reward); return `<tr><td><b>${k}</b></td>${[1, 2, 3, 4, 5].map(l => `<td>${L[l] || 0}</td>`).join('')}${['C', 'H', 'P', 'T', 'G', 'V', 'W', 'S'].map(c => `<td>${Rw[c] || 0}</td>`).join('')}</tr>`; }).join('')}
</table>
<details><summary>노드 목록</summary><table><tr><th>id</th><th>왕국</th><th>Lv</th><th>부활</th><th>보상</th><th>인접</th></tr>
${M.nodes.map(n => `<tr><td>${n.id}</td><td>${n.kingdom}</td><td>${n.level || '-'}</td><td>${n.res || '-'}</td><td>${n.reward ? esc(M.rewardCodes[n.reward]) : (n.start ? 'START' : '')}</td><td>${M.edges.filter(e => e.a === n.id || e.b === n.id).map(e => { const o = e.a === n.id ? e.b : e.a; return e.confidence === 'check' ? `<span class="warn">${o}?</span>` : o; }).join(' ')}</td></tr>`).join('')}
</table></details>
<p class="small warn">불확실: 간선은 뿌리 그림을 자동 추적한 결과 — '?' 표시 간선은 물리 시트와 대조 필요. ${M.candidateEdges.length}개 후보 간선은 확인 페이지에서만 표시.</p></section>`);

// 3. Rewards
const fmt = r => r.kind === 'technique' ? `<i>${esc(r.name)}</i> Technique` : r.kind === 'portrait' ? `<i>${esc(r.name)}</i> Portrait+Talent` : r.kind === 'rapport' ? `+${r.n} Rapport with a chosen Knight` : r.kind === 'mercenary' ? `Tier ${r.tier} <i>${r.cls}</i> Mercenary` : r.kind === 'saint' ? `Devote to Saint ${esc(r.name)}` : r.kind === 'gold' ? `+${r.n} Gold` : r.bonuses ? Object.entries(r.bonuses).map(([v, n]) => `+${n} ${v}`).join(' & ') : `<i>${esc(r)}</i>`;
sec.push(`<section id="rewards"><h2>3. Rosegraal Rewards (룰북 pp.92–96)</h2>
<p class="impl">데이터: <code>data/rosegraal/rewards.json</code> — 체크박스 ${Object.values(R.levels).reduce((a, lv) => a + Object.values(lv).reduce((b, row) => b + Object.values(row).reduce((c, arr) => c + arr.length, 0), 0), 0)}개 · 구현: <code>rosegraal.js · eligibleRewards()</code> — 정복 노드 심볼 종류, 노드 레벨 이하, 미획득 중 하나 선택(사용자 해석: Technique 2개 중 하나) · 테스트: <code>test/rewards.mjs</code></p>
${[1, 2, 3, 4, 5].map(lv => `<h3>Level ${lv}</h3><table class="rw"><tr><th></th>${Object.keys(R.knights).map(k => `<th>${esc(R.knights[k].name)}${R.knights[k].expansion ? '<br><span class="small">(TTSF)</span>' : ''}</th>`).join('')}</tr>
${Object.entries(R.kinds).map(([c, name]) => `<tr><td><b>${name}</b> ${c}</td>${Object.keys(R.knights).map(k => `<td>${(R.levels[lv][k][c] || []).map(r => `☐ ${fmt(r)}`).join('<br>')}</td>`).join('')}</tr>`).join('')}</table>`).join('')}
<p class="small warn">불확실: ${R.unclear.map(esc).join(' · ')}</p></section>`);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KF Rogue's Path — 데이터·규칙 오딧</title>
<style>body{margin:0;padding:16px;font:14px/1.5 system-ui,sans-serif;background:#1a1714;color:#e8dcc8;max-width:1400px}h1{color:#c9a85a;font-size:22px}h2{color:#c9a85a;margin-top:28px;border-bottom:1px solid #3a3128}h3{color:#d9c89a;margin:16px 0 6px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #3a3128;padding:4px 6px;vertical-align:top;text-align:left}th{background:#26211b}code{background:#2a241d;padding:1px 5px;border-radius:4px;color:#f0d9a0}
.impl{background:#26211b;padding:8px 10px;border-left:3px solid #c9a85a;border-radius:4px}.small{font-size:12px;color:#998b76}.warn{color:#d9a441}details summary{cursor:pointer;color:#c9a85a}table.rw td{min-width:120px}nav a{color:#c9a85a;margin-right:12px}</style></head><body>
<h1>Kingdoms Forlorn — Rogue's Path: 데이터·규칙 오딧</h1><p class="small">v${meta.version} · 생성 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 각 섹션: 전사 데이터 ↔ 엔진 구현 ↔ 테스트. 전사 불확실 항목은 노란색.</p>
<nav><a href="#monsters">몬스터 표</a><a href="#map">Rosegraal 지도</a><a href="#rewards">Rewards</a></nav>
${sec.join('\n')}
</body></html>`;
fs.mkdirSync('docs/audit', { recursive: true }); fs.writeFileSync('docs/audit/index.html', html);
console.log('wrote docs/audit/index.html', (html.length / 1024).toFixed(0), 'KB');
