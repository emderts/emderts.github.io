// Generates docs/audit/index.html: every transcribed table/card ↔ how the engine implements it ↔ which test covers it.
// Run: node tools/audit.mjs   (re-run after every data/engine change)
import fs from 'fs';
import path from 'path';
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = rd('data/rosegraal/monster_tables.json'), M = rd('data/rosegraal/map.json'), R = rd('data/rosegraal/rewards.json'), meta = rd('data/meta.json');
const E = rd('data/monsters/eggknight.json'); const MO = rd('data/decks/mortis.json'), CO = rd('data/decks/conditions.json'), TE = rd('data/terrain.json'), OP = rd('data/outpost/principality.json');
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
<h3>Portraits</h3><table><tr><th>Portrait</th><th>Tier</th><th>Power die</th><th>Card Refresh</th><th>Heat Refresh</th><th>Hand Limit</th><th>Speed</th><th>Bane Limit</th></tr>${(K.portraits || []).map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${p.tier}</td><td>${p.powerDie}</td><td>${p.cardRefresh}</td><td>${p.heatRefresh}</td><td>${p.handLimit}</td><td>${p.speed}</td><td>${p.baneLimit}</td></tr>`).join('')}</table><p class="small">${esc(K.portraitsNote || '')}</p>
<h3>Knight Setup (Knightbook p.4)</h3><p>Virtues: ${Object.entries(K.setup.virtues).map(([v, n]) => `${v} ${n}`).join(', ')} · Portrait: ${K.setup.portraits.join(', ')} · Talent/Arcs: ${K.setup.talent} · 시작 Technique: ${K.setup.techniques.join(', ')} · Gear: ${K.setup.gear.join(', ')} · Rapport Boon: ${esc(K.setup.rapportBoon.text)} <span class="warn">(${esc(K.setup.rapportBoon.note)})</span></p>
<p>First Death: ${esc(K.firstDeath.text)} <span class="small">(${esc(K.firstDeath.note)})</span></p>
<p><b>Kingdom Mysteries 9999 (Unknown Saint)</b>: ${esc(rd('data/rules/unknown_saint.json').event.text)} <span class="small warn">${esc(rd('data/rules/unknown_saint.json').unknownSaint.roguesPath)}</span></p>
<h3>Talents</h3><table><tr><th>Talent</th><th>Tier</th><th>능력</th></tr>${K.talents.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${t.tier}</td><td>${t.abilities.map(a => `<b>${esc(a.name)}</b>: ${esc(a.text)} ${a.ops ? '' : '<span class="warn">[ops 미작성]</span>'}${unc(a.unclear ? [a.unclear] : [])}`).join('<br>')}</td></tr>`).join('')}</table>
<h3>Heroic Arcs (8)</h3><table><tr><th>이름</th><th>+행</th><th>레벨별 옵션</th><th></th></tr>${K.heroicArcs.map(arcRow).join('')}</table>
<p class="small">토큰명은 Knight Tokens and Abilities 범례로 확정.</p>
<h3>Peril Arcs (전 기사 56장)</h3>${Object.keys(PA.arcs).map(k => `<details${k === 'fleischritter' ? ' open' : ''}><summary>${k} (${PA.arcs[k].length})</summary><table><tr><th>이름</th><th>최대 Vigor</th><th>Uninjured</th><th>Minor</th><th>Major</th><th>Grave</th><th>Judicium</th><th>보너스</th></tr>${PA.arcs[k].map(perilRow).join('')}</table></details>`).join('')}
<h3>Techniques (Clash 면, ${K.techniques.length})</h3><table><tr><th>이름</th><th>해금</th><th>비용</th><th>효과</th><th>게이트</th><th>소진</th></tr>${K.techniques.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.unlock)}</td><td>${esc(JSON.stringify(t.cost))}</td><td>${esc(t.text)}${unc(t.unclear)}</td><td>${t.gates.map(g => `<b>${g.gate}</b>: ${esc(g.text)}`).join('<br>')}</td><td>${t.depletion}</td></tr>`).join('')}</table></section>`);

// 6. Gear
sec.push(`<section id="gear"><h2>6. Gear (${G.gear.length})</h2>
<p class="impl">데이터: <code>data/gear/gear.json</code> — 시작 장비 2 + Rosegraal 보상 Gear 35(7기사×5) + Laxlaw 뒷면 · 구현: 장비 슬롯/스탯 → <code>knight.js</code>(슬롯 예정), 능력 텍스트 → <code>effects.js</code>(예정)</p>
<table><tr><th>이름</th><th>기사</th><th>종류</th><th>티어</th><th>공격</th><th>방어</th><th>텍스트</th></tr>${G.gear.map(g => `<tr><td><b>${esc(g.name)}</b>${g.merchant ? ` <span class="small">(상점 ${g.price}G)</span>` : ''}</td><td>${g.knight || '-'}</td><td>${g.type}${g.hands ? ' ' + g.hands + 'H' : ''}</td><td>${g.tier}</td><td>${g.attackDice != null ? `⚔${g.attackDice} +${g.precision} ` : ''}${g.weaponPower ? esc(JSON.stringify(g.weaponPower)) : ''} ${g.bonusPower ? 'bonus ' + esc(JSON.stringify(g.bonusPower)) : ''}</td><td>${g.evasion != null ? 'Eva+' + g.evasion + ' ' : ''}${g.evasionReroll ? 'ER' + g.evasionReroll + ' ' : ''}${g.armorDice ? 'Armor ' + esc(JSON.stringify(g.armorDice)) : ''}</td><td>${esc(g.text).replace(/\n/g, '<br>')}${unc(g.unclear)}</td></tr>`).join('')}</table></section>`);

// 7. Eggknight
const aiRow = c => `<tr><td>${c.level ?? 'Sig'}</td><td><b>${esc(c.name)}</b><br><span class="small">${c.type}${c.zone && c.zone.cells ? ' (앞 2칸)' : ''}</span></td><td>${c.evasionDice}d ${c.evasionDifficulty}+</td><td>${c.targeting.map(esc).join('<br>')}</td><td>${c.move ? 'Move & Attack' : 'Attack'}<br>${c.gates.map(g => `<span class="warn">[${g.stat} ${g.gte}+ ▸ ${esc(g.effect)}]</span>`).join('<br>')}</td><td>${(c.keywordsBeforeAttack || []).map(esc).join(' ')} ${c.effects.map(esc).join('<br>')}</td><td>${c.afterAttack ? 'AA: ' + esc(c.afterAttack) : ''}${c.afterFinalAttack ? 'AFA: ' + esc(c.afterFinalAttack) : ''}</td><td class="small">${c.react.map(esc).join('<br>')}${unc(c.unclear)}</td></tr>`;
const bpRow = c => `<tr><td>${c.level}</td><td><b>${esc(c.name)}</b></td><td>${c.at}</td><td>Overcome ${c.overcome.n}+: ${esc(c.overcome.effect)}</td>${['wound', 'fail', 'instinct', 'critical'].map(k => `<td>${c.responses[k] ? esc(c.responses[k]) : ''}</td>`).join('')}<td class="small">${c.react.map(esc).join('<br>')}${unc(c.unclear)}</td></tr>`;
sec.push(`<section id="eggknight"><h2>7. Eggknight — Monster Sheet · AI/BP · Signature · Routine</h2>
<p class="impl">데이터: <code>data/monsters/eggknight.json</code> · 구현: 레벨 스탯/덱/Escalation Chart → <code>monster.js</code> ✔ (<code>test/monster.mjs</code>), Trait·AI·BP 효과 → <code>effects.js</code>(예정, ops 미작성) · 테스트: <code>test/eggknight.mjs</code></p>
<p>Footprint ${E.footprint.shape}, Rear/Blindspot: ${esc(E.footprint.blindspots)} · Basic: ${E.basicAbilities.map(b => b.name + (b.value ? ' ' + b.value : '')).join(', ')} · Clash Setup(코덱스 p.48–49): 몬스터 ${E.clashSetup.monsterCells.join('/')} (방향 = Minor Mortis 바닥 카드 화살표), 기사 시작 ${E.clashSetup.knightStart.join('/')}, Column ×${E.clashSetup.requiredTiles.column} @ ${E.clashSetup.terrain.map(t => t.cells[0]).join(' ')}${unc(E.clashSetup.unclear)}</p>
<table><tr><th>Lv</th><th>To Hit</th><th>Wounds</th><th>Exh.</th><th>Activations</th><th>보너스</th><th>Trait +</th></tr>${Object.entries(E.levels).map(([l, v]) => `<tr><td>${l}</td><td>${v.toHit}+</td><td>${v.wounds}</td><td>${v.exhibitionWounds}</td><td>${v.activations.join(',')}</td><td>${Object.entries(v.bonuses).map(([k, n]) => `${k} +${n}`).join(', ')}</td><td>${v.traitsAdd.join(', ')}</td></tr>`).join('')}</table>
<h3>Traits</h3><table><tr><th>Lv</th><th>Trait</th><th>텍스트</th></tr>${E.traits.map(t => `<tr><td>${t.level}</td><td><b>${esc(t.name)}</b></td><td>${esc(t.text)}${unc(t.unclear ? [t.unclear] : [])}${t.setup && t.setup.unclear ? unc([t.setup.unclear]) : ''}</td></tr>`).join('')}</table>
<h3>AI 카드 (18) + Signature</h3><table><tr><th>Lv</th><th>이름</th><th>회피</th><th>Targeting</th><th>이동/게이트</th><th>효과</th><th>After</th><th>REACT!</th></tr>${[...E.cards.ai, E.cards.signature].map(aiRow).join('')}</table>
<h3>BP 카드 (18)</h3><table><tr><th>Lv</th><th>이름</th><th>AT</th><th>Overcome</th><th>Wound</th><th>Fail</th><th>Instinct</th><th>Critical</th><th>REACT!</th></tr>${E.cards.bp.map(bpRow).join('')}</table>
<p><b>Routine — ${esc(E.cards.routine.name)}</b>: ${E.cards.routine.effects.map(esc).join(' ')}</p></section>`);

// 8. Decks
const mrow = (c, mk) => `<tr><td>${c.kingdom ? c.kingdom[0].toUpperCase() : ''}</td><td><b>${esc(c.name)}</b> <span class="small">${c.code}</span></td><td>${c.symbol === 'cross' ? '✚' : ''}</td><td>${esc(c.text)}${c.flavor ? ` <i class="small">${esc(c.flavor)}</i>` : ''}${unc(c.unclear)}</td><td>${mk(c)}</td></tr>`;
sec.push(`<section id="decks"><h2>8. Mortis · Condition · Terrain · Outpost</h2>
<p class="impl">데이터: <code>data/decks/mortis.json</code>, <code>data/decks/conditions.json</code>, <code>data/terrain.json</code>, <code>data/outpost/principality.json</code> · 구현: Peril Check → Mortis 드로우(임계별 덱, 처리 후 바닥으로), Judicium(기본 2장 + Massive Peril 추가), Condition 부여/양면 뒤집기, 지형 키워드 → <code>effects.js</code>/<code>board.js</code>(예정) · 테스트: <code>test/decks.mjs</code></p>
<h3>Minor Mortis (${MO.minor.length}) — 화살표 = 무작위 방향</h3><table><tr><th>K</th><th>이름</th><th></th><th>텍스트</th><th>표식</th></tr>${MO.minor.map(c => mrow(c, x => '→↓←↑'['right down left up'.split(' ').indexOf(x.marker.arrow)])).join('')}</table>
<h3>Major Mortis (${MO.major.length}) — 숫자 = 무작위 기사</h3><table><tr><th>K</th><th>이름</th><th></th><th>텍스트</th><th>표식</th></tr>${MO.major.map(c => mrow(c, x => x.marker.number)).join('')}</table>
<h3>Grave Mortis (${MO.grave.length}) — 좌표 = 지형 배치</h3><table><tr><th>K</th><th>이름</th><th></th><th>텍스트</th><th>표식</th></tr>${MO.grave.map(c => mrow(c, x => x.marker.coord)).join('')}</table>
<h3>Judicium (${MO.judicium.length})</h3><table><tr><th></th><th>이름</th><th></th><th>텍스트</th><th>Massive Peril</th></tr>${MO.judicium.map(c => mrow(c, x => x.massivePerilThreshold ?? (x.death ? '사망' : '생존'))).join('')}</table>
<h3>Conditions (${CO.conditions.length})</h3><table><tr><th>이름</th><th>종류</th><th>텍스트</th><th>뒷면</th></tr>${CO.conditions.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.type || '-'}</td><td>${esc(c.text)}${c.squire ? `<br><span class="small">Squire: ${esc(c.squire)}</span>` : ''}${unc(c.unclear)}</td><td>${c.flipSide ? esc(c.flipSide) : ''}</td></tr>`).join('')}</table>
<h3>Terrain (${TE.terrain.length})</h3><table><tr><th>이름</th><th>크기</th><th>키워드</th><th>텍스트</th></tr>${TE.terrain.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${(t.sizes || []).join(', ')}</td><td>${t.keywords.join(', ')}</td><td>${esc(t.text)}${unc(t.unclear)}</td></tr>`).join('')}</table>
<h3>Outpost — ${esc(OP.name)} (코덱스 p.6)</h3><table><tr><th>섹션</th><th>Early Bird</th><th>내용</th><th>Rogue's Path</th></tr>${Object.entries(OP.sections).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v.earlyBird ? esc(v.earlyBird.text) : ''}</td><td>${esc(v.text || '')}${v.results ? '<br>' + Object.entries(v.results).map(([n, r]) => `${n}. ${esc(r.text)} <span class="small warn">${esc(r.roguesPath)}</span>`).join('<br>') : ''}</td><td>${esc(v.roguesPath || '')}</td></tr>`).join('')}</table></section>`);

// 9. Engine implementation map
sec.push(`<section id="engine"><h2>9. 전투 엔진 — 규칙 ↔ 구현 대응</h2>
<p class="impl">소스: <code>src/engine/clash.js</code>(흐름) · <code>effects.js</code>(카드 ops 해석) · <code>monster.js</code>(덱·Escalation) · <code>board.js</code> · <code>dice.js</code> · <code>knight.js</code> · 테스트: <code>test/clash.mjs</code>(ops 커버리지, 셋업, Targeting, Humpty Charge, 공격, 시드 시뮬레이션 12+1), <code>test/ui.mjs</code>(모바일 UI 스모크)</p>
<table><tr><th>룰북</th><th>구현</th><th>비고 / 해석</th></tr>
<tr><td>p.44 Clash Setup</td><td><code>Clash.setup()</code></td><td>코덱스 p.48–49 배치, Column 8, 방향 = Minor Mortis 바닥 카드 화살표, Panzeronion 토큰 1/2/3(+1 at L2+), 시작 Escalation(레벨 보너스)</td></tr>
<tr><td>p.47 Monster Round / Activation</td><td><code>monsterRound, activationAI, performSignature, performRoutine</code></td><td>AI 드로우 → Targeting → 이동 → 회피 → 결과 → After Attack → 버림; 유효 대상 없으면 Routine</td></tr>
<tr><td>p.48 Targeting lines</td><td><code>resolveTargeting</code></td><td>Priority Target / Knight in Blindspot / Closest in front / Closest in sight / Zone X / "and 1 space behind Target". 동률은 Priority Target, 아니면 첫 후보 <span class="warn">[룰: 플레이어 선택 → 추후 ask]</span></td></tr>
<tr><td>p.49 Facing, LoS, Blindspot</td><td><code>board.inFront/rearCells/hasLoS</code></td><td>Eggknight 뒤 2칸 = Rear = Blindspot; Obscuring(Column)이 LoS 차단</td></tr>
<tr><td>p.50 Monster movement</td><td><code>monsterMoveToward, monsterStep</code></td><td>인접할 때까지 직교 이동, 축 선택은 기사를 덜 밟는 쪽(플레이어 선택 규칙의 자동화), 통과 시 Crash, Destructible 지형 파괴</td></tr>
<tr><td>p.51 Zone / Out of Reach</td><td><code>resolveMonsterAttack</code></td><td>Zone 다이어그램 = 정면 2칸(+Target 뒤 1칸); Zone X = 체비쇼프 거리; 근접 대상이 비인접이면 After Attack만</td></tr>
<tr><td>p.52 Evasion Roll</td><td><code>attackOneTarget</code></td><td>Crit die 포함, 자연 10 성공/1 실패, 게이트(+1 die, 난이도 9+, -2 instead, Pushback, Discard, You die), Jacked 임계, Heat 재굴림(ask), Block</td></tr>
<tr><td>p.53 Vigor loss / Armor Roll / Peril Check</td><td><code>loseVigor, perilCheck, drawMortis</code></td><td>Armor 주사위(잔 심볼) 경감 → 0이면 Peril Check 없음; Vigor≤0 → Massive Peril(-5/-9/-12) + Judicium</td></tr>
<tr><td>p.53 Mortis / Judicium</td><td><code>drawMortis, drawJudicium, effects.runMortis</code></td><td>덱 = 일반 + 현재 왕국 카드; 처리 후 바닥(Gash류는 셔플), Second Chance 창; Judicium = You Live!/You Died + 추가 카드, 무작위</td></tr>
<tr><td>p.54 After Attack / Chain Break / REACT!</td><td><code>resolveMonsterAttack, ChainBreak, reactions</code></td><td>AFA는 마지막 대상 기준; Egged On이 Zone 공격에 AFA Humpty Charge 부여; Zone/다중 대상은 Chain Break가 해당 기사만 종료; REACT!에 Knight Roll(Reflex) 제공</td></tr>
<tr><td>p.55 Knight Round / Refresh</td><td><code>knightRound, knightTurn, Knight.refresh</code></td><td>순서 선택(ask), Heat -Refresh, Cooldown→손 X장, Delay→Cooldown; Knockdown(Falling)은 행동 불가·턴 끝 뒤집기·다음 턴 시작 기립</td></tr>
<tr><td>p.56 Movement</td><td><code>reachable, knightMove</code></td><td>직교, 장애물·미니어처 통과 불가, Difficult Terrain 비용 2</td></tr>
<tr><td>p.56–59 Knight Attack 10단계</td><td><code>knightAttack</code></td><td>무기 선택 → Commit → Passion+1/Priority → Attack Roll(+Precision, Opening/Closing, 재굴림) → Full Miss/Hit → 1차 창(Pushback/Vault/Hug/Provoke/Daze, Armor-piercing) → BP(Heartseeker) → Ultrainstinct(Impenetrable Shell) → Power 풀(무기 색 주사위×명중 + 보너스 + 기사 주사위 + Arc) → 재굴림 → 잔→Break/Sunder/Hope → Total Power vs AT(+Panzeronion) → Overcome → Response(Critical/Wound/Fail/Instinct, Diversion/Distracting Bait 무시) → Wound/Escalation → 풀 정리 → 2차 창(Arc 토큰, 무기 Break) → 지연 Response/Bonus Attack → Counter</td></tr>
<tr><td>p.60–61 Wound Stack / Escalation</td><td><code>Monster.wound, escalateAI, escalateBP</code></td><td>Escalation Chart 전 케이스(테스트 monster.mjs)</td></tr>
<tr><td>p.63 Death / Mercy Rule / Bane</td><td><code>die, Knight.gainBane</code></td><td>사망 시 Mercy Rule(Chain Break); First Death/Unknown Saint 훅(<code>listeners.beforeDeath</code>) — 캠페인 레이어에서 연결 예정</td></tr>
<tr><td>p.64 Conditions</td><td><code>addCondition, conditions ops</code></td><td>두 번째 획득 시 뒤집기/사망(카드 데이터), Knockdown 양면, Distracted/Panicked 손패 제한, Choked(Choke Limit, 행동 소모로 -3), Exposed, Courage(Auto-break), Panzer Parasite(5개 사망), Poisoned(턴 종료 피해)</td></tr>
<tr><td>p.56/80 Pushback / Knockback / Crash / Displace</td><td><code>pushback, crash, displace</code></td><td>직선, 가장자리 미끄러짐, 장애물 Crash(+파괴), Chasm 사망, Braced 무시, Unavoidable Knockback 5</td></tr>
<tr><td>Eggknight Traits</td><td><code>humptyCharge, loseArmorToken, afterAction</code></td><td>Humpty Charge(공격자 방향 6칸 돌진, Crash/Judicium, 장애물·가장자리 정지 + Armor 토큰 -1 → Grave 좌표에 Column), Humpty Fate/Hardboiled, Counter(3→Signature), Panzeronion(AT+토큰), Jacked, Just a Scratch, Coup de Grace <span class="warn">[미구현: Coup de Grace 사망 치환]</span>, Impenetrable Shell</td></tr>
<tr><td>미구현 / 수동</td><td>—</td><td>Meat Puppet, Curse Save(Curse Level 0 가정), Squire 라인, Mercenary, Saint Incarnation(캠페인 레이어), 플레이어 선택이 필요한 동률 Targeting</td></tr>
</table></section>`);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KF Rogue's Path — 데이터·규칙 오딧</title>
<style>body{margin:0;padding:16px;font:14px/1.5 system-ui,sans-serif;background:#1a1714;color:#e8dcc8;max-width:1400px}h1{color:#c9a85a;font-size:22px}h2{color:#c9a85a;margin-top:28px;border-bottom:1px solid #3a3128}h3{color:#d9c89a;margin:16px 0 6px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #3a3128;padding:4px 6px;vertical-align:top;text-align:left}th{background:#26211b}code{background:#2a241d;padding:1px 5px;border-radius:4px;color:#f0d9a0}
.impl{background:#26211b;padding:8px 10px;border-left:3px solid #c9a85a;border-radius:4px}.small{font-size:12px;color:#998b76}.warn{color:#d9a441}details summary{cursor:pointer;color:#c9a85a}table.rw td{min-width:120px}nav a{color:#c9a85a;margin-right:12px}</style></head><body>
<h1>Kingdoms Forlorn — Rogue's Path: 데이터·규칙 오딧</h1><p class="small">v${meta.version} · 생성 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 각 섹션: 전사 데이터 ↔ 엔진 구현 ↔ 테스트. 전사 불확실 항목은 노란색.</p>
<nav><a href="#monsters">몬스터 표</a><a href="#map">Rosegraal 지도</a><a href="#rewards">Rewards</a><a href="#components">구성물</a><a href="#fleischritter">Fleischritter</a><a href="#gear">Gear</a><a href="#eggknight">Eggknight</a><a href="#decks">Mortis·Condition·Terrain·Outpost</a><a href="#engine">엔진 대응</a></nav>
${sec.join('\n')}
</body></html>`;
fs.mkdirSync('docs/audit', { recursive: true }); fs.writeFileSync('docs/audit/index.html', html);
console.log('wrote docs/audit/index.html', (html.length / 1024).toFixed(0), 'KB');
