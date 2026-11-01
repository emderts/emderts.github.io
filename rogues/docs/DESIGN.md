# Kingdoms Forlorn — Rogue's Path 웹 싱글플레이: 데이터 구조·엔진 설계 제안 (v0.1)

근거: KF Core Rulebook (업로드 PDF) — Rogue's Path pp.76–79, Clash Phase pp.42–65, Knights pp.15–24, Outpost pp.28–29, Spoils p.67, Other/Optional Rules pp.68–75, Keyword List pp.80–87, Rosegraal Rewards pp.92–96.
표기: **[확인]** = 규칙 해석이 필요해 사용자 결정 대기, **[자료]** = 카드/코덱스 스캔이 있어야 전사 가능.

---

## 1. Rogue's Path 게임 루프 (룰북 p.76–77 요약)

```
Setup: 기사 선택(Squire 금지) → Knight Setup(각 Knightbook) → 각 기사 Gold +10 → 파티 공용 부활(resurrection) 5 → S 노드 크로스아웃
loop Rosegraal Round:
  (언제든, 전투 전/후) Outpost Phase — 스토리/지도/Vision/Delve 관련 항목 제외 (상점·재련·용병만 유효)
  1. 크로스아웃된 노드에 연결된 노드 하나 선택
  2. 노드의 왕국(Principality / Sunken) × 노드 레벨(I–V) 표에서 d10 → 몬스터와 몬스터 레벨 결정 (★몬스터 미보유 시 재굴림)
  3. Clash (전투 엔진)
  4a. 패배: 일반 패배 페널티, 사망 기사 수만큼 부활 소모, 노드 유지(재도전 시 몬스터 재굴림), 보상 없음
  4b. 승리: Aftermath(사상자 → 부활 풀에서 복구, 몬스터 Loot, 표준 Loot deck → Loot Distribution)
      + Rosegraal 보상: 부활 +노드값(보통 = 레벨; 부활 0이고 생존자<4면 파티 풀 복구만큼),
        기사별 보상 1개(노드 심볼 종류, 현재 노드 레벨 이하, 각 보상은 1회만), Sigh of the Graal 노드면 획득
      → 노드 크로스아웃
  승리: 마지막 노드 크로스아웃 / 패배: 기사와 부활 모두 소진
Tier 게이트(Technique, Loot 등): 현재 공략 노드의 Tier (I Mob, II Vassal, III King, IV Devil, V Dragon)
Sigh of the Graal: Clash 종료 직후 결과 무효화하고 Clash 이전 상태로 복구(재도전)
```

구현 관점에서 필요한 시스템 = **Clash 엔진(대부분) + Rosegraal 캠페인 상태 + Outpost(상점/재련/용병) + Loot/보상 + 기사 성장 데이터**.

## 2. ATO Mnestis 엔진과의 대응 (재사용 가능한 설계)

| KF | ATO 대응 | 비고 |
|---|---|---|
| AI deck 1/2/3 (+AI 0) / BP deck 1/2/3, Escalation deck | AI/BP 덱, 에스컬레이션 | 거의 동일. KF는 AI 승급 시 **같은 레벨 카드 1장 제거 + 한 단계 위 1장 추가**, BP도 동일(Chart p.61) |
| Wound Stack, Double Wound(BP3) | Wound | BP3 일반 Wound = Generic Double Wound, 크리티컬이면 카드 자체 |
| Evasion Roll(몬스터는 명중 굴림 없음) | Evasion | 흰색 Crit die 1개 필수, 자연 10 = Crit Evade, 1 = Crit Evade Fail |
| Attack Roll(d10, To Hit) → Power Roll(커스텀 d6 빨/검/흰) vs AT | Attack → Power vs Armor | Potential 심볼 → Break 토큰으로 Power 전환; 주사위 상한(빨7·검4·흰3) 초과 시 승급 규칙 |
| Mortis deck Minor/Major/Grave + Judicium | Trauma 덱 | Peril Check 심볼 때만 드로우; Vigor ≤0 → 항상 Judicium; Massive Peril(-5/-9/-12) 추가 카드 |
| Knight Pool 토큰(Break/Opening/Fire/Black/Closing/Hope/Sunder/Rouse/Diversion/Power/Cantrip/Spell) | Kratos pool | 다음 기사 공격 때 사용 후 클리어 |
| Passion / Heat / Vigor (0–9/0–9/≤15) + Heat Limit·Peril Arc | Rage / Fate / Danger | Heat 초과분 = Vigor 손실 |
| Heroic Arc(Passion 게이트), Peril Arc(Vigor 임계) | Kratos table / Danger 티어 | 카드별 데이터 |
| Technique(Clash 면만 사용) + Cooldown/Delay/Discard/Instant | Mnemos/스킬 | Refresh step: Heat -HeatRefresh, Cooldown→손 X장, Delay→Cooldown |
| Gear: Weapon(손1–2)/Armor/Support(+Consumable), Knighves | Gear | Tier 초과 장착 시 최대 Vigor -2/티어 |
| Conditions, Bane(Limit 초과 즉사), Modifier 토큰 | Conditions | Aftermath에 Bane -2 |
| Targeting lines, Facing, LoS, Zone/Wave, Zigzag 이동, Crash | 동일 개념 | 보드 격자 크기 **[자료: Clash Board 사진]** |
| Mob Clash(Mob track 1–10, Activation 토큰 이동, Spawn) | 없음(신규) | Boss/Mob 두 모드 분기 필요 |
| Vantage Point(탑승) | 없음(신규) | 몬스터 시트에 정의 |

→ ATO의 `core.js`(Rng/Deck) · `game.js`(턴 루프 + `ask` 훅 + 로그) · 테스트 스타일(PASS/FAIL, `catchD`, 시뮬레이션 테스트)을 그대로 쓰고, 전투 규칙 모듈만 KF용으로 새로 작성.

## 3. 데이터 구조 (`data/`)

모든 카드는 `{ id, name, set, text(원문 전사), ops(구조화 효과), unclear?: [...] }` 공통 필드. `text`는 오딧 페이지와 UI 툴팁용 원문, `ops`는 엔진이 실행하는 구조화 명령.

```
data/
  meta.json
  rosegraal/
    map.json             Rosegraal 노드 그래프 (p.78–79) ← 다음 단계에서 PDF로부터 전사
    monster_tables.json  노드 레벨×왕국 → d10 몬스터 표 (p.77) ✔ 전사 완료
    rewards.json         Rosegraal Rewards 1–5 × 기사 7명 × 보상 종류 (p.92–96) ← PDF에서 전사 가능
  knights/<knight>.json  portraits[], heroicArcs[], perilArcs[], talents[], techniques[](Clash면), knighves, setup(시작 구성) [자료: 카드 스캔 + Knightbook Setup 페이지]
  monsters/<monster>.json  sheet(footprint 1/4/9, front/rear, basicAbilities, levels{toHit, wounds, activations, bonuses, traits±, exhibitionWounds}), signature, routine, ai{0?,1,2,3}, bp{1,2,3}, traits[], vp?, spawn?, clashSetup{level→board, terrain, knightStart, monsterPos} [자료: 몬스터 시트·AI/BP/Trait 카드·코덱스 Clash Setup]
  gear/merchant_principality.json, merchant_sunken.json, monster_loot.json, upgrades.json, consumables.json  [자료]
  decks/mortis.json(minor/major/grave/judicium), conditions.json, loot.json(Scavenge 덱 16장), mercenaries.json, saints.json?  [자료]
  terrain.json           타일·키워드(Obstacle/Destructible/Obscuring/Chasm/Difficult…)  [자료]
  dice.json              Power/Armor 주사위 3색 면 분포 [자료: 주사위 사진 — ATO 때처럼]
  keywords.json          키워드 원문(p.80–87) — 오딧/툴팁 + 구현 여부 표시
```

### 3.1 `rosegraal/map.json` (제안)
```json
{ "start": "S",
  "nodes": [
    { "id": "P01", "kingdom": "principality", "level": 1, "res": 1, "reward": "T", "pos": [120, 300], "links": ["S", "P02"] },
    { "id": "S",   "kingdom": "principality", "level": 0, "start": true, "pos": [60, 400], "links": ["P01", "P03", "P05"] }
  ],
  "unclear": ["P07–P12 간선: 뿌리 그림이 겹쳐 연결 여부 불명"] }
```
reward 코드: C Class · H Heroic Arc · P Peril Arc · T Technique · G Gear · V Virtue · W Wild Card · S Sigh of the Graal. `pos`는 UI 지도 렌더링용(원본 배치 유지). 두 페이지(Sunken p.78 / Principality p.79)는 뿌리가 페이지 경계를 넘어 이어지므로 **하나의 그래프**로 전사 **[확인 Q2]**.

### 3.2 카드 효과 표현: `ops` 구조화 (제안)
ATO는 카드 문장을 정규식으로 해석(`doSentence`)했다. KF는 카드 텍스트가 더 다양하고(AI 카드 Targeting lines / 게이트 배너 / After Attack, BP Responses 4종, Technique Exert, Keyword 숫자형) 효과가 대부분 키워드로 환원되므로, **전사 시 구조화**하는 편이 검증·오딧에 유리하다고 본다.

```json
// AI 카드 예
{ "id": "eggknight-ai2-03", "level": 2, "name": "…", "evasion": { "dice": 2, "difficulty": 6, "gates": [{ "if": { "stat": "heat", "gte": 3 }, "dice": 1 }] },
  "types": ["melee"], "targeting": [["inFront", "closest"], ["closest"], ["noTarget"]],
  "move": "move", "windows": ["beforeAttack"],
  "effects": [{ "op": "loseVigor", "n": "perHit" }, { "op": "perilCheck" }, { "op": "condition", "id": "knockdown" }],
  "afterAttack": [{ "op": "discard" }],
  "text": "원문 전사…" }
// BP 카드 예
{ "id": "eggknight-bp1-02", "level": 1, "name": "…", "at": 7,
  "responses": { "wound": [{ "op": "pushback", "n": 4 }], "fail": [{ "op": "signature", "vs": "attacker" }], "instinct": [], "ultrainstinct": null,
                 "critical": [{ "op": "additionalWound" }] },
  "overcome": { "x": 4, "ops": [...] }, "text": "…" }
```
`ops` 어휘는 `keywords.json`의 키워드 + 소수의 원시 명령(loseVigor, gainStat, perilCheck, condition, escalate, spawn, moveMonster, turn, placeTerrain, aiAttack/signature/routine, test…)으로 제한하고, 엔진에 없는 op는 **빌드 시 테스트가 실패**하도록 해서 "구현 안 된 카드"가 조용히 지나가지 않게 한다. 구조화가 애매한 카드는 `ops: null` + `unclear`로 두고 UI에서 "수동 처리" 안내. **[확인 Q13]**

## 4. 엔진 모듈 (`src/engine/`)

```
core.js       Rng(mulberry32, 시드), Deck, GameOver ✔
rosegraal.js  노드→몬스터 굴림(재굴림 규칙) ✔ / map 탐색(선택 가능 노드), 보상 가능 목록 계산
campaign.js   Rogue's Path 상태(기사들, Gold, 부활 풀, 크로스아웃 노드, 획득 보상, Armory), 라운드 루프, 저장/불러오기(localStorage + JSON 내보내기), Sigh 스냅샷
knight.js     기사 상태: vigor/heat/passion + limits, Peril 임계(perilArc), techniques(hand/cooldown/delay/discard), gear slots(+Knighves 자동 장착), bane, conditions, modifier tokens, 사망/부활
dice.js       d10(크릿 다이 분리), 재굴림 규칙(각 주사위 1회, Heat 재굴림 +1/개), Power 풀 생성(색 상한·승급), Power/Armor 굴림, Potential→Power 변환
board.js      격자, 몬스터 footprint(1/4/9)·facing·front/rear, 기본 거리(직교 최단, 경로 없으면 비유효), LoS(모서리 규칙), Zone X / Wave, Blindspot/VP
targeting.js  Targeting lines 해석기(adjacent/engaged/closest/furthest/grouped/highest X/inFront/inRange/inSight/in-on X/lastToWound/least-most X/lone/lowest X/noTarget/priorityTarget/with X/X knights/zone) + Priority/Divine Target 타이브레이크(동률이면 ask)
movement.js   몬스터 이동(target 향해 회전, zigzag — 분기 시 ask, Boss는 통과+Crash, Mob은 우회), Move to/Behind/Lateral/Jump/Land on Top/Appear, 보드 가장자리 미끄러짐, 비자발 이동(Knockback/Pushback/Drag/Pull, 장애물 Crash, Chasm 사망, Displace)
monsterTurn.js  Monster Round: 토큰 준비 → Activation(AI 드로우/Signature) → targeting → move → Out of Reach 체크 → Evasion Roll(크릿) → Attack Consequences(Vigor loss→Armor Roll→Peril Check/Mortis→Judicium/Massive Peril) → After Attack → Routine 폴백, Chain Break, Windows of Opportunity(REACT!) → Resolve Other Actions → End
knightTurn.js Refresh → Movement/Combat/Free/Complicated actions → Attack 10단계(선언·Passion+1·Attack Roll·1st window·BP 결정·Power Roll·Responses·Wound/Escalation·Pool clear·2nd window) → Attack Responses/Follow-up
escalation.js Escalation Chart(p.61): AI/BP 승급, BP3 set-aside, 전부 BP3일 때 예외, AI3 소진 시 보너스 순서(+1 loss/hit, +1 …), Escalate X / AI-only / BP-only, Mob: Mob track 적용
mobs.js       Mob track(1–10), Activation 토큰 이동 규칙(루프, 중첩), Spawn(immediate/interval/odd/nevermore), Revealed BP 효과, Mob 개별 Modifier
effects.js    ops 인터프리터(§3.2) + keywords 레지스트리
aftermath.js  Clash Aftermath(p.63): 부활·스탯 리셋·Technique 복귀·Condition 제거·Bane -2·Gear 복구(Consumable 제외)·Scavenge → Loot Distribution(공동 보관→기사당 1장→Spare Scrap 순환; 티어 제한, Gold 교환) → Rosegraal 보상
outpost.js    Merchant(개인 티어 이하 구매), Reforge(당일 구매품 불가), Mercenary 고용(최대 4, 동명 불가, Clash 능력만)
game.js       위 모듈을 묶는 파사드: new Game(data,{seed}) · setup(cfg) · ask 훅 · log · state(직렬화 가능)
```

원칙: 엔진은 DOM 없이 순수 함수/클래스, 모든 난수는 `Rng` 경유(시드 재현), 플레이어 선택은 전부 `await game.ask({type, options…})`로 UI에 위임(테스트는 자동 응답기로 대체) — ATO와 동일.

## 5. UI 흐름 (`src/ui/`, 모바일 세로 우선)

1. **홈/저장 슬롯**: 새 캠페인 / 이어하기 / JSON 내보내기·가져오기
2. **캠페인 설정**: 기사 선택(1–4명 **[확인 Q1]**), 보유 몬스터 체크(★ 재굴림용), 시작 구성 확인
3. **Rosegraal 지도**(SVG, 핀치 줌/드래그): 크로스아웃·선택 가능 노드 강조, 노드 탭 → 레벨/부활/보상/왕국 표시 → "출정"
4. **몬스터 결정**: d10 굴림 애니메이션 → 몬스터·레벨 → Clash Setup 요약(보드·지형·배치)
5. **Clash 화면**: 상단 보드(SVG, 이동 가능 칸 하이라이트), 하단 탭(기사 보드 — Vigor/Heat/Passion 트랙·손패·장비 / 몬스터 — AI/BP 덱 수·Wound Stack·Trait / 로그). 선택은 바텀시트 버튼. 세로 화면에서 보드는 정사각형 비율 고정
6. **Aftermath/Loot**: 사망·부활 처리, Loot 분배 UI, Gold 교환
7. **보상 선택**: 노드 심볼 종류 중 레벨 이하·미획득 보상 선택(기사별)
8. **Outpost**: 상점(구매·재련) / 용병
9. **오딧 페이지**(별도 HTML artifact, 빌드 산출물 아님): 카드·규칙마다 전사 원문 ↔ `ops` ↔ 구현 함수/테스트 링크, `unclear` 표시

## 6. 테스트 전략 (`test/*.mjs`)
- 데이터 무결성: 표/덱 커버리지(✔ monster_tables), map 연결성(S에서 모든 노드 도달), rewards 각 셀 존재, 모든 `ops`가 엔진 어휘에 존재
- 규칙 단위: Escalation Chart 8케이스, Evasion/Crit, Power 풀 상한·승급, Peril/Massive Peril, Targeting lines 각각, zigzag/Crash/Knockback, Mob track 토큰 이동·루프
- 몬스터별: AI/BP 카드 한 장씩 자동 실행(ask=기본 선택) → 예외 없이 끝나는지
- 시뮬레이션: 시드 N개로 Clash 완주(ATO `sim*.mjs` 방식), 캠페인 수 라운드 완주
- UI: Playwright로 빌드 HTML 열어 모바일 뷰포트 흐름 클릭(ATO `ui*.mjs` 방식)

## 7. 필요한 자료 (우선순위)
1. **Clash Board 사진**(격자 크기·행/열 라벨) + **Power/Armor 주사위 3색 면**(사진)
2. **기사 1명분 풀세트**(예: Fleischritter): Portrait·Heroic Arc·Peril Arc·Talent·Technique 전부, Knighves, Knightbook의 Knight Setup 페이지 → 기사 모델 확정
3. **몬스터 1종 풀세트**(권장: Eggknight — 룰북 예시가 많음): 몬스터 시트 양면, AI 1/2/3(+0), BP 1/2/3, Trait 카드, 코덱스 Clash Setup(레벨별 보드/지형/배치) → Boss Clash 엔진 완성
4. **Mortis 덱**(Minor/Major/Grave/Judicium + Massive Peril 카드), **Condition 카드**, **Terrain 카드/타일**
5. Mob 몬스터 1종(예: Ironcast Dead 또는 First Men Warriors) → Mob Clash 엔진
6. Merchant Gear(두 왕국), Loot 미니카드 16장(Gold 가치), Upgrade, Consumable, Mercenary
7. 나머지 기사·몬스터 순차 추가(표에 등장하는 몬스터 22종 — ★ 7종은 확장)

PDF만으로 지금 바로 전사 가능한 것: Rosegraal map(p.78–79, 간선은 불확실 표시), Rosegraal Rewards(p.92–96), Keyword list(p.80–87), 몬스터 표(✔).

## 8. 해석 결정 (2026-11-01 확정)
- **Q1** 기사 4명 고정 (True Solo 규칙 불필요).
- **Q2** p.78+p.79는 하나의 그래프. 사용자가 합친 지도 이미지 1장을 제공 → 그걸로 전사.
- **Q3** 승리 = 지도의 모든 노드 크로스아웃.
- **Q4** 몬스터는 전부 전사 예정(★ 포함). 설정의 "보유 몬스터" 체크는 유지(기본 전부 보유).
- **Q5** Rewards 표의 Technique 2장 중 **하나 선택**. 보상은 노드 레벨 이하 레벨 중 선택, 각 보상 1회.
- **Q6** 4명 고정이므로 "생존자<4" 규칙 그대로.
- **Q7** Outpost/상점 티어 = 그 Rosegraal 라운드에 선택한 노드의 티어.
- **Q8 Loot** (룰북 확인): Loot deck은 Scavenge 효과로만 채워짐(Scavenge 덱에서 뽑음). Rogue's Path에서 한 Clash의 Loot deck = Aftermath Victorious Search **Clash Scavenge 1 + Scavenge 3**(종류는 Kingdom Gear/Upgrade/Consumable 중 선택) + Clash 중 카드가 준 Scavenge. Full Clash Loot = 그 몬스터의 Gear로 교환(몬스터별 Gear 목록 [자료]). 교환 티어 = 노드 티어(몬스터 최저 레벨 티어가 더 높으면 그 티어까지). 분배: 기사당 1장 → 나머지 Spare Scrap은 파티 리더부터 순환, Gold로만 교환. Gambling Den은 코덱스 의존 → 1차 제외. 패배 시: Forlorn Search Scavenge 3 → "Loot는 유지"이므로 분배까지 수행 **[확인: 패배 시에도 Scavenge 3 + 분배?]**
- **Q9 Sigh** (룰북 p.14): "Clash를 다시 치른다, Clash 이전 상태로 복구" → 같은 몬스터·레벨로 재전투(굴림 유지), 덱/셋업만 새로 섞음. 1인 1개 보유 제한 → Sigh 노드 보상은 미보유 기사 중 선택. 사용 시점: Clash 종료 직후(승/패 무관) 결과 적용 전.
- **Q10** Rapport: 4명이라 유효 — Wild Card +2, 3하트에 Knightbook의 Rapport Boon [자료: 기사별 Boon 텍스트]. Saint: 스토리 해금 전용, Rosegraal 보상에도 없음 → 제외. Mercenary: Guild는 Outpost 정규 활동 → 유지(초기 레벨1 덱 + Wild Card "Tier 3 ○○ Mercenary"로 해금, Clash 능력만). First Death Event: Knightbook 서사 → 체크만 하고 생략. Exhibition/Full: Rogue's Path 본문에 구분 없음 → 전부 Full Clash(Exhibition Wounds 없음)로 구현.
- **Q13** 카드 효과는 전사 시 `ops` 구조화 + 원문 보관.
