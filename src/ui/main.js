// ATO Mnestis Theatre — UI (vanilla JS, single page)
import { Game } from '../engine/game.js';
import { cellLabel, ROWS, Board } from '../engine/core.js';

const DATA = window.ATO_DATA;
const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); } for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };

const CLASSES = Object.keys(DATA.titans.classes);
const GEAR = DATA.gear.cards;
const DIEC = { r: '빨강', b: '검정', w: '하양', m: '회색' };
const gEva = g => (g.evasion || 0) + [...(g.text || '').matchAll(/(?:^|\. )Gain \+(\d) Evasion\./g)].reduce((a, m) => a + +m[1], 0);
const GSTAT = [
  ['armor', 'Armor 주사위', g => g.armor && g.armor.length ? `🛡 Armor ${g.armor.map(d => DIEC[d] || d).join('·')}` : ''],
  ['eva', 'Evasion 증가', g => gEva(g) ? `Evasion +${gEva(g)}` : ''],
  ['err', 'Evasion 재굴림', g => g.evasionReroll != null ? `Evasion 재굴림 ${g.evasionReroll === 'X' ? 'X(Opening)' : g.evasionReroll === 'XB' ? 'X(Break)' : g.evasionReroll}` : (/(\d) Evasion re-rolls?/.exec(g.text || '') ? `Evasion 재굴림 ${/(\d) Evasion re-rolls?/.exec(g.text)[1]}` : '')],
  ['block', 'Block', g => /Block( \d+)?/.test(g.text || '') ? (/Block( \d+)?/.exec(g.text)[0]) : ''],
  ['bpow', 'Bonus Power 주사위', g => g.bonusPower && g.bonusPower.length ? `Bonus Power ${g.bonusPower.map(d => DIEC[d] || d).join('·')}` : ''],
  ['raw', 'Raw Power', g => g.bonusRaw ? `Raw +${g.bonusRaw}` : ''],
  ['charge', 'Charge', g => g.charges ? `Charge ${g.charges}` : ''],
  ['dgate', 'Danger 효과', g => g.danger && Object.keys(g.danger).length ? `Λ ${Object.keys(g.danger).join('/')}` : ''],
  ['agate', 'Ambrosia 효과', g => g.amb ? `Amb ${Object.keys(g.amb).join('/')}` : ''],
  ['rgate', 'Rage 효과', g => g.rage ? `Ω ${Object.keys(g.rage).join('/')}` : ''],
  ['fgate', 'Fate 효과', g => g.fate ? `Ψ ${Object.keys(g.fate).join('/')}` : ''],
  ['bgate', 'Bleeding 효과', g => g.bleed ? `Bleed ${Object.keys(g.bleed).join('/')}` : ''],
];
const gStats = g => GSTAT.map(([, , f]) => f(g)).filter(Boolean);
const gCyc = g => /(^|\. )Mnestis\./.test(g.text || '') ? 'M' : String(g.cycle || 1); // Mnestis-keyword gear is its own group
const gCycName = c => c === 'M' ? 'Mnestis' : 'Cycle ' + (['', 'I', 'II', 'III', 'IV', 'V'][+c] || c);
const SLOT_ICON = { hand1: '✊', hand2: '✊✊', hand3: '✊✊✊', handAll: '✱✊', armor: '🛡', support: '🎒', attachment: '📎' };
const DEFAULT_LOADOUT = {
  primordial: 'hekaton', level: 1,
  argo: ['Arrow Barrage', 'Pursuer Protocol'], aaLimit: 2, awakening: { enabled: true, spark: false, godforms: ['Zeus', 'Poseidon', 'Demeter', 'Hephaestus', 'Hermes', 'Ares', 'Athena', 'Artemis', 'Dionysus', 'Aphrodite', 'Helios Apollon Exalted'] }, cannon: { enabled: false, payload: 'Spartan Payload', unlimited: true, res: {} },
  titans: [
    { name: 'Herodotus', portrait: 'AH0147', mnemos: [{ name: 'Family Feud', level: 2 }, { name: 'Imprisonment', level: 1 }], cls: 'dreamwalker', gear: ['Sirenblade', 'Siren Shield', 'Siren Panoply Armor', 'Iapetus Lifeguard'] },
    { name: 'Ulyssea', portrait: 'AH0148', mnemos: [{ name: 'Someone Waiting', level: 2 }, { name: 'A Broken Promise', level: 1 }], cls: 'dreamwalker', gear: ['Boatmace', 'Sail Spolas', 'Spring Harness'] },
    { name: 'Philoctera', portrait: 'AH0152', mnemos: [{ name: 'Death Follows', level: 2 }, { name: 'A Dream You Hold', level: 1 }], cls: 'dreamwalker', gear: ['Sirenteeth', 'Sail Spolas', 'Makesheath'] },
    { name: 'Solon', portrait: 'AH0153', mnemos: [{ name: 'Siren Survivor', level: 2 }, { name: 'Blood on Your Hands', level: 1 }], cls: 'dreamwalker', gear: ['Kratos Kopis', 'Shipwrecker Shield', 'Siren Panoply Armor', 'Ares Aulos'] },
  ],
};
let loadout = DEFAULT_LOADOUT;
try { const s = localStorage.getItem('ato.loadout'); if (s) { const L = JSON.parse(s); const REN = { 'Pyramidion (\uD53C\uB77C\uBBF8\uB514\uC628)': 'Pyramidion', 'Pyrasclepios (\uD53C\uB77C\uC2A4\uD074\uB808\uD53C\uC624\uC2A4)': 'Pyrasclepios' }; for (const t of L.titans || []) t.gear = (t.gear || []).map(n => REN[n] || n); if (L.titans.every(t => t.gear.every(n => GEAR.find(x => x.name === n)))) loadout = L; } } catch (e) { }
const saveLoadout = () => { try { localStorage.setItem('ato.loadout', JSON.stringify(loadout)); } catch (e) { } };
// ---------------- Tree of Knowledge ----------------
const TREE = DATA.tree || { nodes: [], loot: {} };
let tree = { done: {}, rewards: [], ignoreExt: true, pending: null };
try { const t = JSON.parse(localStorage.getItem('ato.tree') || 'null'); if (t && t.done) tree = { ...tree, ...t }; } catch (e) { }
const saveTree = () => { try { localStorage.setItem('ato.tree', JSON.stringify(tree)); } catch (e) { } };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const nodeName = n => `${n.name || DATA.primordials[n.prim]?.name || n.prim} ${ROMAN[n.level]}`;
const nodeUnlocked = n => n.pre.every(id => tree.done[id]);
const rewardGear = r => GEAR.find(g => g.reward === r);
const gearLocked = g => !!(g && g.reward && !TREE.nodes.some(n => n.reward === g.reward && tree.done[n.id]) && !(tree.manual || {})[g.name]);
const tearName = n => ({ 1: 'Labyrinthized', 2: 'Excavated', 3: 'Accursed', 4: 'Blackburned', 5: 'Moonfell' })[n.cycle || 1];
const nodeRewardText = n => [n.reward ? (n.reward === 'Guaranteed Loot' ? `Guaranteed Loot (${(TREE.loot[n.prim] || []).join(' / ')} 중 무작위 1)` : /^Secret deck/.test(n.reward) ? (n.rewardCard ? `보상 카드 (${n.reward}${tree.showNames ? ' — ' + n.rewardName : ''})` : `Mnestis Gear (${n.reward}${tree.showNames && rewardGear(n.reward) ? ' — ' + rewardGear(n.reward).name : ''})`) : n.reward) : null, n.core ? `${tearName(n)} Ascended Core` : null, `${tearName(n)} Tear`].filter(Boolean).join(' + ');
function completeNode(id) {
  const n = TREE.nodes.find(x => x.id === id); if (!n || tree.done[id]) return null;
  tree.done[id] = new Date().toISOString().slice(0, 10);
  const TN = tearName(n); const got = [`${TN} Tear`]; if (n.core) got.push(`${TN} Ascended Core`);
  if (n.reward === 'Guaranteed Loot') { const pool = TREE.loot[n.prim] || []; got.push(pool.length ? `Guaranteed Loot: ${pool[Math.floor(Math.random() * pool.length)]}` : 'Guaranteed Loot'); } else if (n.reward) got.push(n.rewardCard ? `보상 카드: ${n.rewardName} (${n.reward})` : /^Secret deck/.test(n.reward) ? `Mnestis Gear (${n.reward}${rewardGear(n.reward) ? ' — ' + rewardGear(n.reward).name + ' 해금' : ''})` : n.reward);
  tree.rewards.push({ node: id, name: nodeName(n), got }); saveTree(); return got;
}
let presets = []; try { presets = JSON.parse(localStorage.getItem('ato.presets') || '[]'); if (!Array.isArray(presets)) presets = []; } catch (e) { presets = []; }
const savePresets = () => { try { localStorage.setItem('ato.presets', JSON.stringify(presets)); } catch (e) { } };
// card copy limits: gear copies = number of printed codes; each Mnemos card exists once
const gearCopies = name => { const g = GEAR.find(x => x.name === name); return g ? Math.max(1, (g.codes || []).length) : 1; };
const gearUsed = (name, except = null) => loadout.titans.reduce((a, t) => a + (t === except ? 0 : t.gear.filter(n => n === name).length), 0);
const mnemosUsedBy = (name, except = null) => loadout.titans.filter(t => t !== except && (t.mnemos || []).some(m => m && m.name === name));
function dupErrors() {
  const errs = []; const seen = {};
  for (const t of loadout.titans) for (const n of t.gear) { if (n === 'Fists') continue; seen[n] = (seen[n] || 0) + 1; }
  for (const [n, c] of Object.entries(seen)) if (c > gearCopies(n)) errs.push(`「${n}」 ${c}장 사용 (보유 ${gearCopies(n)}장)`);
  const mseen = {}; for (const t of loadout.titans) for (const m of t.mnemos || []) if (m && m.name) mseen[m.name] = (mseen[m.name] || 0) + 1;
  for (const [n, c] of Object.entries(mseen)) if (c > 1) errs.push(`Mnemos 「${n}」 ${c}명 중복`);
  return errs;
}

// ---------------- Card detail views ----------------
const SLOT_NAME = { hand1: '한손 무기', hand2: '양손 무기', hand3: '세손 무기', handAll: '무기 슬롯 전부', armor: '방어구', support: '서포트', attachment: '부착물' };
const DIE = { r: '빨강', b: '검정', w: '흰색', m: '회색(Mortal)' };
function gearCard(g, t = null) {
  const dangerNow = t ? t.danger : null;
  const rows = [];
  if (g.atk != null) rows.push(h('div', { class: 'stats' }, h('span', { class: 'st' }, `◆ 공격 주사위 ${g.atk}`), h('span', { class: 'st' }, `정밀 ${g.prec >= 0 ? '+' : ''}${g.prec}`), h('span', { class: 'st' }, `Power/hit: ${g.power.map(d => DIE[d]).join('+')}`), g.bonusPower ? h('span', { class: 'st' }, `Bonus Power: ${g.bonusPower.map(d => DIE[d]).join('+')}`) : null, g.bonusRaw ? h('span', { class: 'st' }, `+${g.bonusRaw} Power`) : null, g.fullHitPower ? h('span', { class: 'st' }, `Full Hit: +${g.fullHitPower.map(d => DIE[d]).join('+')}`) : null));
  if (g.powerByHits) rows.push(h('div', { class: 'stats' }, ...Object.entries(g.powerByHits).map(([k, v]) => h('span', { class: 'st' }, `${k} hit: ${v.map(d => DIE[d]).join('+')}`)), h('span', { class: 'st muted' }, '(hit 수별 Power 주사위 — 합계)')));
  if (g.armor || g.evasion || g.evasionReroll) rows.push(h('div', { class: 'stats' }, g.armor ? h('span', { class: 'st def' }, `🛡 Armor dice ${g.armor.length} (${g.armor.map(d => DIE[d]).join('+')})`) : null, g.evasion ? h('span', { class: 'st def' }, `회피 +${g.evasion}`) : null, g.evasionReroll ? h('span', { class: 'st def' }, `회피 재굴림 ${g.evasionReroll}`) : null));
  const gates = Object.entries(g.danger || {});
  const labN = t ? t.gear.filter(x => !x.discarded && (x.card.traits || []).includes('Labyrinth')).length : null; const ambN = t ? t.ambrosia : null;
  return h('div', { class: 'cardview' },
    h('div', { class: 'cv-title' }, `${SLOT_ICON[g.slot]} ${g.name}`, h('span', { class: 'muted small' }, ` ${SLOT_NAME[g.slot]}${g.charges ? ` · charges ${g.charges}` : ''}`)),
    ...rows,
    h('div', { class: 'cv-text' }, g.text || '—'),
    ...gates.map(([k, v]) => h('div', { class: 'cv-gate' + (dangerNow != null && dangerNow >= parseInt(k) ? ' on' : '') }, h('b', {}, `Danger ${k}`), ' ', v)),
    ...Object.entries(g.lab || {}).map(([k, v]) => h('div', { class: 'cv-gate' + (labN != null && labN >= parseInt(k) ? ' on' : '') }, h('b', {}, `Labyrinth Set ${k}`), ' ', v)),
    ...Object.entries(g.amb || {}).map(([k, v]) => h('div', { class: 'cv-gate' + (ambN != null && ambN >= parseInt(k) ? ' on' : '') }, h('b', {}, `Ambrosia Set ${k}`), ' ', v)),
    ...Object.entries(g.rage || {}).map(([k, v]) => h('div', { class: 'cv-gate' + (t && t.rage >= parseInt(k) ? ' on' : '') }, h('b', {}, `Rage ${k}`), ' ', v)),
    ...Object.entries(g.fate || {}).map(([k, v]) => h('div', { class: 'cv-gate' + (t && t.fate >= parseInt(k) ? ' on' : '') }, h('b', {}, `Fate ${k}`), ' ', v)),
    ...Object.entries(g.midasGate || {}).map(([k, v]) => h('div', { class: 'cv-gate' + (t && t.gear && t.gear.reduce((a, x) => a + (x.midas || 0), 0) >= parseInt(k) ? ' on' : '') }, h('b', {}, `Midas ${k}`), ' ', v)),
    ...Object.entries(g.condGate || {}).map(([k, v]) => h('div', { class: 'cv-gate' + (t && t.conditions && (k === 'Any Condition' ? t.conditions.length : t.conditions.includes(k)) ? ' on' : '') }, h('b', {}, k), ' ', v)),
    ...Object.entries(g.omega || {}).map(([k, v]) => h('div', { class: 'cv-gate' }, h('b', {}, `Ω ${k} (미구현)`), ' ', v)),
    g.strikebackSide ? h('div', { class: 'cv-back', style: 'border-top:1px dashed #888;margin-top:8px;padding-top:6px' }, h('div', { class: 'muted small' }, '⇄ Strikeback Attack 전용 면'), gearCard({ ...g.strikebackSide, tech: g.tech, cycle: g.cycle }, t)) : null,
    ...(g.anyGate || []).map(ag => h('div', { class: 'cv-gate' }, h('b', {}, [ag.danger != null ? `Danger ${ag.danger}+` : '', ag.fate != null ? `Fate ${ag.fate}+` : '', ag.rage != null ? `Rage ${ag.rage}+` : '', ag.amb != null ? `Ambrosia ${ag.amb}+` : ''].filter(Boolean).join(' OR ')), ' ', ag.text)),
    g.transformBackMissing ? h('div', { class: 'muted small' }, '⇄ Transform 반대면 카드 스캔 없음 (Transform 효과 없음)') : null,
    g.requires ? h('div', { class: 'muted small' }, `필요: ${g.requires}`) : null,
    g.transform ? h('div', { class: 'cv-back', style: 'border-top:1px dashed #888;margin-top:8px;padding-top:6px' }, h('div', { class: 'muted small' }, '⇄ Transform 반대면'), gearCard({ ...g.transform, tech: g.tech, cycle: g.cycle }, t)) : null,
    h('div', { class: 'muted small' }, `${(g.traits || []).join(', ')} · ${g.tech}${g.codes ? ' · ' + g.codes[0] : ''} · ${g.loot ? 'Mnestis 전리품 · ' : ''}${gCycName(gCyc(g))}`),
    h('div', { class: 'muted small cv-legend' }, 'Ψ = Fate +1 · ⟳ = 카드 소진 · X = 카드 버림 · [R] = 리액션 · A/N+ = Danger N 이상 · Labyrinth Set = Labyrinth 특성 장비 수 · Ambrosia Set = Ambrosia 토큰 수'));
}
const AR = DATA.argonauts;
function mnemosCard(c, level = 3, danger = null) {
  return h('div', { class: 'cardview mn' }, h('div', { class: 'cv-title' }, c.name, h('span', { class: 'tag' }, `Cycle ${'I'.repeat(c.cycle)}`), h('span', { class: 'muted small' }, ' ' + c.traits.join(' · '))),
    ...['1', '2', '3'].map(l => { const L = c.levels[l]; const on = +l <= level; return h('div', { class: 'cv-gate' + (on && (L.gate == null || danger == null || danger >= L.gate) ? ' on' : '') + (on ? '' : ' off') }, h('b', {}, `Lv${l}`), L.gate ? h('span', { class: 'tag warn' }, `Danger ${L.gate}+`) : null, ' ' + L.text, L.adventure ? h('span', { class: 'muted small' }, ' (모험 전용)') : null, L.unimplemented ? h('span', { class: 'muted small' }, ' (미구현)') : null, L.note ? h('span', { class: 'muted small' }, ` (${L.note})`) : null); }),
    h('div', { class: 'muted small' }, `스킬 +1: ${c.skills.join(', ')} · ${c.code}`), h('div', { class: 'muted small cv-legend' }, '⟳ = Mnemos 소진 · X = Mnemos 버림 · Ψ = Fate +1 · Mnestis: Lv2 Mnemos는 Lv1+2, Lv1 Mnemos는 Lv1만 활성'));
}
function condCard(c) { const D = DATA.decks; const x = D.conditions[c] || [...D.kratos, ...D.moiros].find(k => k.name === c); return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, c, x && x.type ? h('span', { class: 'tag' }, x.type) : null), h('div', { class: 'cv-text' }, x ? x.text : '(카드 텍스트 없음)'), ...(x ? Object.entries(x).filter(([k]) => !['text', 'type', 'codes', 'code', 'name', 'backOf'].includes(k)).map(([k, v]) => h('div', { class: 'cv-text' }, h('b', {}, k + ': '), v)) : [])); }
const GODS = DATA.decks.godforms; const DIEK = { r: '빨강', b: '검정', w: '흰색', m: '회색(Mortal)' };
function godCard(g, tr = null) { return h('div', { class: 'cardview god' }, h('div', { class: 'cv-title' }, `🔱 ${g.name}`, tr != null ? h('span', { class: 'tag' }, `Trespass ${tr}`) : null),
  h('div', { class: 'stats' }, h('span', { class: 'st' }, `Power die: ${DIEK[g.powerDie]}`), h('span', { class: 'st' }, g.speedDouble ? 'Speed ×2 (Titan Speed 두 배)' : `Speed +${g.speed}`), g.precision ? h('span', { class: 'st' }, `Precision +${g.precision}`) : null, g.evasion ? h('span', { class: 'st def' }, `회피 +${g.evasion}`) : null, g.armor ? h('span', { class: 'st def' }, `Armor dice +${g.armor.length} (${g.armor.map(d => DIEK[d]).join('')})`) : null, h('span', { class: 'st' }, `Trespass ${g.trespass}`)),
  ...Object.entries(g.abilities).map(([n, t]) => h('div', { class: 'cv-text' }, h('b', {}, n + ': '), t)),
  h('div', { class: 'muted small cv-legend' }, '각성 시: Chain Break, PT 고정, Condition/Despair 제거, 기립 선택, Speed까지 이동/Pushback 후 보너스 공격. 내 턴 시작마다 Trespass 1개 소모, 없으면 각성 종료(Obol로 각성했으면 사망). 각성 중 Obol 덱에 You Live! 1장 추가. 각 Godform은 전투당 1회.')); }
function argoCard(c) { return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, c.name, h('span', { class: 'tag' }, `charges ${c.charges}`), c.reaction ? h('span', { class: 'tag' }, '◆! 리액션') : null), h('div', { class: 'cv-text' }, c.text), h('div', { class: 'muted small' }, 'Titan Round 중 언제든(액션 도중 제외) 라운드당 1회. 매 라운드 끝에 준비.')); }
function titanCard(clsKey) {
  const c = DATA.titans.classes[clsKey]; const K = DATA.titans.kratosAbilities;
  return h('div', { class: 'cardview' },
    h('div', { class: 'cv-title' }, c.name, c.cycle ? h('span', { class: 'tag' }, `Cycle ${c.cycle}`) : null, h('span', { class: 'muted small' }, ` Speed ${c.speed} · Power die ${c.powerDice}(${c.powerDie === 'b' ? '검정' : '빨강'})${c.ambrosiaLimit ? ` · Ambrosia Limit ${4 + c.ambrosiaLimit}` : ''}${c.despairLimit ? ` · Despair Limit ${c.despairLimit}` : ''}${c.bleedingLimit ? ` · Bleeding Limit ${c.bleedingLimit}` : ''}${c.inherentKeywords ? ' · ' + c.inherentKeywords.join(', ') : ''}`)),
    ...Object.entries(c.abilities).map(([n, txt]) => h('div', { class: 'cv-text' }, h('b', {}, n + ': '), txt)),
    h('div', { class: 'cv-sub' }, 'Trauma Table'), h('div', { class: 'stats' }, ...c.trauma.map(r => h('span', { class: 'st' }, `Danger ${r.danger} → ${r.tier}`))),
    h('div', { class: 'cv-sub' }, 'Kratos Table (Rage 단계별, 두 옵션은 택1)'),
    h('table', { class: 'kt' }, ...Object.entries(c.kratos).map(([lv, opts]) => h('tr', {}, h('td', { class: 'ktlv' }, lv), h('td', {}, opts.map(o => o.join(' + ')).join('  /  '))))),
    h('details', { class: 'small' }, h('summary', {}, 'Kratos 능력 설명'), ...Object.entries(K).map(([n, d]) => h('div', { class: 'muted' }, h('b', {}, n + ': '), d))));
}
const pretty = x => String(x).replace(/EVADE_DICE/g, '회피 주사위').replace(/PRECISION/g, 'Precision').replace(/FATE (\d)\+/g, 'Ψ$1+').replace(/\bFATE\b/g, 'Fate(Ψ)').replace(/\bDANGER\b/g, 'Danger(Λ)').replace(/\bRAGE\b/g, 'Rage(Ω)').replace(/MOVE UNLIMITED & ATTACK/g, 'Move(무제한) & Attack').replace(/MOVE & ATTACK/g, 'Move & Attack').replace(/ALL TITANS IN PATH/g, '경로상의 모든 타이탄').replace(/\| LAB: (\d) Danger\(Λ\) instead/g, '| Labyrinth 통과 시: $1 Danger 대신').replace(/: GRAVE\b/g, ': Grave Trauma로 드로우').replace(/: OBOL\b/g, ': Trauma 대신 Obol').replace(/JUDGE (\w+)\/(\w+)/g, 'Judgement ($1/$2 테스트)');
function aiCardView(card, prim) {
  if (!card) return h('div', { class: 'muted small' }, '(아직 AI 카드 없음)');
  const lines = Array.isArray(card.target) ? card.target : card.target ? prim.def.targetPresets[card.target] : [];
  return h('div', { class: 'cardview ai' },
    h('div', { class: 'cv-title' }, card.name, h('span', { class: 'tag' }, card.displayKind || card.kind), card.tier != null ? h('span', { class: 'tag' }, `AI ${card.tier === 'X' ? '★' : card.tier === 0 ? '0' : 'I'.repeat(card.aiTier || card.tier)}`) : null, card.bpName ? h('span', { class: 'tag' }, `BP ${'I'.repeat(card.tier)} 「${card.bpName}」 AT ${card.atLo}/${card.at}`) : null),
    card.dice ? h('div', { class: 'stats' }, h('span', { class: 'st' }, `회피 주사위 ${card.dice}◆`), h('span', { class: 'st' }, `난이도 ${card.toHit}+`)) : null,
    lines.length ? h('div', { class: 'cv-sub' }, 'Target') : null, ...lines.map(l => h('div', { class: 'cv-text' }, '· ' + l)),
    card.noTarget ? h('div', { class: 'cv-text muted' }, `대상 없음: ${card.noTarget}`) : null,
    card.text_pre ? h('div', { class: 'cv-text sub' }, '· ' + card.text_pre) : null,
    (card.pre || []).length ? h('div', { class: 'cv-sub' }, '공격 전') : null, ...(card.pre || []).map(st => st.startsWith('⚡ ') ? h('div', { class: 'cv-text win' }, h('span', { class: 'wtag' }, '◆!'), ' ' + pretty(st.slice(2))) : h('div', { class: 'cv-text sub' }, '· ' + pretty(st))),
    (card.pattern || card.zone) ? zoneDiagram(card) : null,
    (card.steps && card.steps.length) ? h('div', { class: 'cv-sub' }, 'Move & Attack') : null, ...(card.steps || []).map(st => st.startsWith('⚡ ') ? h('div', { class: 'cv-text win' }, h('span', { class: 'wtag', title: 'Window of Opportunity — 이 지시를 해결하기 직전에 리액션 능력 사용 가능' }, '◆!'), ' ' + pretty(st.slice(2))) : h('div', { class: 'cv-text sub' }, '· ' + pretty(st))),
    card.text ? h('div', { class: 'cv-text' }, pretty(card.text)) : null,
    card.after ? h('div', { class: 'cv-after' }, (card.afterWindow || (card.oracle && card.oracle.afterWin && !card.after.startsWith('⚡'))) ? h('span', { class: 'wtag', title: 'Window of Opportunity' }, '◆!') : null, h('b', {}, ' After Attack: '), pretty(card.after)) : null,
    card.afterFinal ? h('div', { class: 'cv-after' }, card.afterWindow ? h('span', { class: 'wtag' }, '◆!') : null, h('b', {}, ' After Final Attack: '), pretty(card.afterFinal)) : null,
    h('div', { class: 'muted small cv-legend' }, '◆! = Window of Opportunity: 그 지시 직전에 각 타이탄이 [R] 리액션 능력(Reflex 등)을 사용할 수 있음'));
}
function zoneDiagram(card) {
  const n = 3; const set = new Set(); let maxD = 1;
  if (card.pattern) for (const [d, l] of card.pattern) { set.add(d + ',' + l); maxD = Math.max(maxD, d); }
  const R = card.zone || 0; const W = card.zone ? n + 2 * R : n + 2; const rows = card.zone ? n + 2 * R : n + maxD + 1;
  const g = h('div', { class: 'zdiag', style: `grid-template-columns:repeat(${W},10px)` });
  const top = card.zone ? R : 1; const left = card.zone ? R : 1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < W; x++) {
    let cls = 'zc'; const inPrim = y >= top && y < top + n && x >= left && x < left + n;
    if (inPrim) cls += ' p';
    else if (card.zone) cls += ' on';
    else { const d = y - (top + n - 1); const l = (left + 1) - x; if (d >= 1 && set.has(d + ',' + l)) cls += ' on'; }
    g.append(h('span', { class: cls }));
  }
  return h('div', {}, h('div', { class: 'cv-sub' }, card.zone ? `Zone ${card.zone}` : 'Zone (아래쪽이 정면)'), g);
}
function bpCardView(bp, prim) {
  if (!bp) return null;
  return h('div', { class: 'cardview bp' }, h('div', { class: 'cv-title' }, bp.bpName || bp.name, h('span', { class: 'tag' }, bp.tier === 'X' ? 'BP ★' : `BP ${'I'.repeat(bp.tier)}`), bp.trap ? h('span', { class: 'tag bad' }, 'TRAP') : h('span', { class: 'tag' }, bp.atLo != null ? `AT ${bp.atLo + (prim ? prim.bonus.AT : 0)} (Interrupt) / ${bp.at + (prim ? prim.bonus.AT : 0)}` : bp.atStair != null ? `AT ${bp.at + (prim ? prim.bonus.AT : 0)} / Staircase ${bp.atStair + (prim ? prim.bonus.AT : 0)}` : `AT ${bp.at + (prim ? prim.bonus.AT : 0)}`)), bp.text ? h('div', { class: 'cv-text' }, pretty(bp.text)) : null,
    ...Object.entries(bp.responses).map(([k, v]) => h('div', { class: 'cv-text' }, h('b', {}, k + ': '), ...v.split('⚡ ').flatMap((seg, i) => i ? [h('span', { class: 'wtag', title: 'Window of Opportunity' }, '◆!'), ' ' + pretty(seg)] : [pretty(seg)]))), ...(bp.pre || []).map(x => h('div', { class: 'cv-text muted' }, pretty(x))), bp.critical ? h('div', { class: 'cv-after' }, h('b', {}, 'CRITICAL: '), pretty(bp.critical)) : null);
}
function openModal(content) {
  const ov = h('div', { class: 'overlay', onclick: e => { if (e.target === ov) ov.remove(); } }, h('div', { class: 'modal' }, h('button', { class: 'x close', onclick: () => ov.remove() }, '×'), content));
  document.body.append(ov);
}

// ---------------- Loadout screen ----------------
function slotsOf(cls) { const c = DATA.titans.classes[cls]; if (c && c.slots) return { ...c.slots }; return cls === 'earthshaker' ? { hands: 3, armor: 1, support: 2 } : { hands: 2, armor: 1, support: 2 }; }
function handCost(g, cls = null) { if (g.slot === 'handAll') return slotsOf(cls).hands; const c = g.slot === 'hand3' ? 3 : g.slot === 'hand2' ? 2 : g.slot === 'hand1' ? 1 : 0; const A = (cls && DATA.titans.classes[cls]?.abilities) || {}; return c === 3 && (A['Cyclopean Might'] || A['Elder Might'] || A['Unknown Might'] || A['Lightweight Curse']) ? 2 : c; }
// Earthshaker (Six-Armed Centimanes): 3 Weapon slots OR 3 Support slots
function slotsFor(t) { const s = { ...slotsOf(t.cls) }; if (t.traumaCard === 'Djinnian Strain') s.hands += 1; if (t.traumaCard === 'Support Specialization') s.support += 1; if (t.cls === 'earthshaker') { const sup = t.gear.filter(n => GEAR.find(x => x.name === n)?.slot === 'support').length; if (sup >= 3) { s.hands = 2; s.support = 3; } } s.support += t.gear.filter(n => /You have 1 additional Support slot(?! for)/i.test(GEAR.find(x => x.name === n)?.text || '')).length; if (DATA.titans.classes[t.cls]?.abilities['Unknown Might'] && t.gear.some(n => GEAR.find(x => x.name === n)?.slot === 'hand3')) s.support -= 1; return s; }
function validateTitan(t) {
  const s = slotsFor(t); let hands = 0, armor = 0, support = 0; const errs = [];
  for (const n of t.gear) { const g = GEAR.find(x => x.name === n); if (!g) continue; hands += handCost(g, t.cls); if (g.slot === 'armor') armor++; if (g.slot === 'support') support++; }
  if (t.gear.includes('Gaiaegis') && t.gear.some(n => { const g = GEAR.find(x => x.name === n); return g && n !== 'Gaiaegis' && /^hand/.test(g.slot) && (g.traits || []).some(x => /^(Gold|Sun|Divine)$/.test(x)); })) errs.push('Gaiaegis: Gold/Sun/Divine 무기와 함께 장착 불가');
  { const IO = DATA.titans.inward || { kratos: [], trauma: [] }; for (const [key, list] of [['kratosCard', IO.kratos], ['traumaCard', IO.trauma]]) { const c = t[key] && list.find(x => x.name === t[key]); if (c && loadout.titans.filter(o => o[key] === c.name).length > (c.copies || 1)) errs.push(`Pattern 「${c.name}」은(는) ${c.copies || 1}장뿐 — 다른 타이탄과 중복`); } }
  if (t.traumaCard === 'Djinnian Strain') { const base = slotsOf(t.cls).hands; const big = t.gear.map(n => GEAR.find(x => x.name === n)).filter(g => g && (g.slot === 'hand3' || g.slot === 'handAll')); let h0 = 0; for (const n of t.gear) h0 += handCost(GEAR.find(x => x.name === n) || {}, t.cls); if (big.length && h0 > base) errs.push(`Djinnian Strain: 추가 무기 칸으로는 3손 무기(${big.map(g => g.name).join(', ')})를 쓸 수 없음`); }
  for (const n of t.gear) { const g = GEAR.find(x => x.name === n); if (gearLocked(g)) errs.push(`「${n}」은(는) 트리 보상 미해금 (${g.reward})`); }
  for (const n of t.gear) { const g = GEAR.find(x => x.name === n); if (g && g.requires && !t.gear.includes(g.requires)) errs.push(`「${n}」은(는) 「${g.requires}」 장착 필요`); }
  if (t.cls === 'earthshaker' && hands > 2 && support > 2) errs.push('Six-Armed Centimanes: 무기 3칸 또는 서포트 3칸 중 하나만');
  else { if (t.gear.includes('Horseskull Pauldron') && t.gear.some(n => { const g = GEAR.find(x => x.name === n); return g && g.slot === 'support' && (g.traits || []).includes('Paradox'); })) s.support++; if (hands > s.hands) errs.push(`손 슬롯 초과 (${hands}/${s.hands})`); if (support > s.support) errs.push(`서포트 ${support}/${s.support}`); }
  if (armor > s.armor) errs.push('방어구 1개만');
  { const A = DATA.titans.classes[t.cls]?.abilities || {}; const ws = t.gear.map(n => GEAR.find(x => x.name === n)).filter(g => g && /^hand/.test(g.slot) && g.name !== 'Fists');
    if (A['Four-Armed Centimanes']) for (const g of ws) if (g.slot === 'hand2' || g.slot === 'hand3') errs.push(`Four-Armed Centimanes: 양손/세손 무기 「${g.name}」 사용 불가`);
    if (A['Nimble Feet']) for (const g of ws) if (g.slot === 'hand3') errs.push(`Nimble Feet: 세손 무기 「${g.name}」 사용 불가`);
    if (A['Lightweight Curse']) for (const g of ws) if (g.slot === 'hand1') errs.push(`Lightweight Curse: 한손 무기 「${g.name}」 사용 불가`); }
  { const rc = {}; for (const n of t.gear) { const g = GEAR.find(x => x.name === n); const m = g && /Restricted \(([^)]+)\)/.exec(g.text || ''); if (m) rc[m[1]] = (rc[m[1]] || 0) + 1; } for (const [k, v] of Object.entries(rc)) if (v > 1) errs.push(`Restricted (${k}): 1개만 장착 가능`); }
  return errs;
}
function renderLoadout(root) {
  root.innerHTML = '';
  const wrap = h('div', { class: 'loadout' });
  wrap.append(h('h1', {}, 'Mnestis Theatre'), h('p', { class: 'sub' }, 'Aeon Trespass: Odyssey — 시뮬레이션 전투 (Cycle I · II · III)'));
  const PID = DATA.primordials[loadout.primordial] ? loadout.primordial : 'hekaton'; const PD = DATA.primordials[PID];
  const levelsFor = id => { const S = DATA.scenarios[id]; const set = new Set(); for (const v of Object.values(S.variants)) for (const l of (v.levels || [])) set.add(l); return [...set].filter(l => DATA.primordials[id].levels[l]).sort((a, b) => a - b); };
  const lvs = levelsFor(PID); if (!lvs.includes(loadout.level)) { loadout.level = lvs[0]; saveLoadout(); }
  const lv = h('div', { class: 'row' }, h('label', {}, 'Primordial '), h('select', { onchange: e => { loadout.primordial = e.target.value; const l2 = levelsFor(loadout.primordial); if (!l2.includes(loadout.level)) loadout.level = l2[0]; saveLoadout(); renderLoadout(root); } }, ...Object.keys(DATA.scenarios).map(id => h('option', { value: id, selected: PID === id ? '' : null }, DATA.primordials[id].name))),
    h('label', {}, ' 레벨 '), h('select', { onchange: e => { loadout.level = +e.target.value; saveLoadout(); } }, ...lvs.map(l => { const L = PD.levels[l]; return h('option', { value: l, selected: loadout.level === l ? '' : null }, `Lv ${l} — To Hit ${L.toHit}+, Speed ${L.speed >= 99 ? '∞' : L.speed}, Wounds ${L.wounds}${(L.traits || []).length ? ' · ' + L.traits.join(', ') : ''}`); })),
    h('button', { class: 'x', onclick: () => showDetail(h('div', {}, h('div', { class: 'cv-title' }, PD.name + ' 트레이트'), ...Object.entries(PD.traits).map(([n, t]) => h('div', { class: 'cv-text' }, h('b', {}, n + ': '), t)), PD.vp ? h('div', { class: 'cv-text' }, h('b', {}, `VP ${PD.vp.name}: `), PD.vp.text) : null)) }, '트레이트 보기'));
  if ((PD.cycle || 0) >= 3) lv.append(h('label', { class: 'small', title: 'Argo 시트의 Paradox(▷) 수치. AI 카드의 "▷X+ 또는 ΨY+" 조건과 Break the Wheel에 쓰임' }, ' Paradox ▷ ', h('input', { type: 'number', min: 0, max: 20, value: loadout.paradox || 0, style: 'width:3.5em', onchange: e => { loadout.paradox = Math.max(0, +e.target.value || 0); saveLoadout(); } })));
  wrap.append(lv);
  { // ---- Gear browser (search by text / trait / cycle / slot) ----
    const GB = window.__gb || (window.__gb = { open: false, q: '', cyc: '', trait: '', slot: '', stat: '' });
    const box = h('div', { class: 'tcard argo' });
    const allTraits = [...new Set(GEAR.flatMap(g => g.traits || []))].sort();
    const SLOTS = [...new Set(GEAR.map(g => g.slot))];
    const list = h('div', { class: 'gblist' });
    const draw = () => { const q = GB.q.trim().toLowerCase(); const f = GEAR.filter(g => g.name !== 'Fists' && (!GB.cyc || gCyc(g) === GB.cyc) && (!GB.trait || (g.traits || []).includes(GB.trait)) && (!GB.slot || g.slot === GB.slot) && (!GB.stat || (GSTAT.find(x => x[0] === GB.stat) || [, , () => true])[2](g)) && (!q || [g.name, g.text, (g.traits || []).join(' '), g.tech, Object.values(g.danger || {}).join(' '), g.transform ? g.transform.name + ' ' + (g.transform.text || '') : ''].join(' ').toLowerCase().includes(q))).sort((a, b) => (a.cycle || 1) - (b.cycle || 1) || a.name.localeCompare(b.name));
      list.replaceChildren(h('div', { class: 'muted small' }, `${f.length}장`), ...f.slice(0, 150).map(g => h('div', { class: 'gearrow link', style: 'display:block', onclick: () => showDetail(gearCard(g)) }, h('span', {}, `${SLOT_ICON[g.slot] || ''} ${g.name}`), h('span', { class: 'muted small' }, ` ${gCyc(g) === 'M' ? 'Mnestis' : 'C' + gCyc(g)} · ${(g.traits || []).join(', ')}${g.atk ? ` · ◆${g.atk} +${g.prec ?? 'X'} ${(g.power || []).join('')}` : ''}`), gStats(g).length ? h('div', { class: 'small', style: 'color:#d9b45a' }, gStats(g).join(' · ')) : null, h('div', { class: 'small', style: 'opacity:.85' }, (g.text || '').slice(0, 160) + ((g.text || '').length > 160 ? '…' : '')))), ...(f.length > 150 ? [h('div', { class: 'muted small' }, '… 150장까지만 표시 — 조건을 좁혀 주세요')] : [])); };
    const sel = (val, opts, key, label) => h('select', { onchange: e => { GB[key] = e.target.value; draw(); } }, h('option', { value: '' }, label), ...opts.map(o => h('option', { value: o, selected: GB[key] === o ? '' : null }, key === 'cyc' ? gCycName(o) : key === 'stat' ? (GSTAT.find(x => x[0] === o) || [, o])[1] : o)));
    box.append(h('div', { class: 'row' }, h('b', { class: 'link', onclick: () => { GB.open = !GB.open; renderLoadout(root); } }, `${GB.open ? '▾' : '▸'} 장비 도감 (문구 검색 · 특성 / 사이클 / 슬롯 / 능력치 필터)`)));
    if (GB.open) { box.append(h('div', { class: 'row' }, h('input', { placeholder: '🔎 이름·문구·특성 검색', value: GB.q, style: 'flex:1;min-width:180px', oninput: e => { GB.q = e.target.value; draw(); } }), sel(GB.cyc, ['1', '2', '3', '4', '5', 'M'].filter(c => GEAR.some(g => gCyc(g) === c)), 'cyc', '사이클 전체'), sel(GB.trait, allTraits, 'trait', '특성 전체'), sel(GB.slot, SLOTS, 'slot', '슬롯 전체'), sel(GB.stat, GSTAT.map(x => x[0]).filter(k => GEAR.some(g => (GSTAT.find(x => x[0] === k))[2](g))), 'stat', '능력치 전체')), list); draw(); }
    wrap.append(box);
  }
  if (TREE.nodes.length) {
    const open = !!tree.open; const doneN = TREE.nodes.filter(n => tree.done[n.id]).length;
    const box = h('div', { class: 'tcard argo' });
    box.append(h('div', { class: 'row' }, h('b', { class: 'link', onclick: () => { tree.open = !tree.open; saveTree(); renderLoadout(root); } }, `${open ? '▾' : '▸'} Tree of Knowledge (Cycle I–V) — ${doneN}/${TREE.nodes.length} 완료`),
      tree.pending ? h('span', { class: 'tag warn' }, `다음 전투: ${nodeName(TREE.nodes.find(n => n.id === tree.pending) || { prim: '?', level: 0 })} (승리 시 자동 표시)`) : h('span', { class: 'muted small' }, '아래에서 전투를 고르면 Primordial/레벨이 설정되고 승리 시 자동으로 완료 표시됩니다'),
      h('label', { class: 'small' }, h('input', { type: 'checkbox', checked: tree.showNames ? '' : null, onchange: e => { tree.showNames = e.target.checked; saveTree(); renderLoadout(root); } }), ' Secret deck 보상 이름 공개')));
    if (open) {
      const cols = h('div', { class: 'treegrid' });
      for (const n of TREE.nodes) {
        const done = !!tree.done[n.id]; const un = nodeUnlocked(n); const cur = tree.pending === n.id;
        const el = h('div', { class: 'tnode' + (done ? ' done' : un ? ' open' : ' locked') + (cur ? ' cur' : '') },
          h('div', { class: 'tn-title' }, h('b', {}, nodeName(n)), done ? h('span', { class: 'tag' }, '✓ ' + tree.done[n.id]) : un ? h('span', { class: 'tag warn' }, '도전 가능') : h('span', { class: 'tag bad' }, '잠김')),
          h('div', { class: 'small' }, '보상: ' + nodeRewardText(n)),
          h('div', { class: 'small muted' }, '필요: ' + ([...n.pre.map(id => nodeName(TREE.nodes.find(x => x.id === id))), ...(n.extPre || [])].join(', ') || '없음')),
          (n.extUnlocks || []).length ? h('div', { class: 'small muted' }, '이후 해금: ' + n.extUnlocks.join(', ')) : null,
          h('div', { class: 'row', style: 'margin:4px 0 0' },
            !done && un ? h('button', { class: cur ? 'primary x' : 'x', onclick: () => { tree.pending = cur ? null : n.id; saveTree(); if (!cur) { loadout.primordial = n.prim; loadout.level = n.level; saveLoadout(); } renderLoadout(root); } }, cur ? '선택됨 (해제)' : '이 전투 하기') : null,
            h('button', { class: 'x', onclick: () => { if (done) { delete tree.done[n.id]; tree.rewards = tree.rewards.filter(r => r.node !== n.id); saveTree(); } else { completeNode(n.id); if (tree.pending === n.id) tree.pending = null; saveTree(); } renderLoadout(root); } }, done ? '완료 취소' : '수동 완료')));
        cols.append(el);
      }
      box.append(cols);
      if (tree.rewards.length) box.append(h('details', { class: 'small' }, h('summary', {}, `획득한 Mnestis 보상 (${tree.rewards.length})`), h('ul', {}, ...tree.rewards.map(r => h('li', {}, `${r.name}: ${r.got.join(', ')}`)))));
      { const orphan = GEAR.filter(g => g.reward && !TREE.nodes.some(n => n.reward === g.reward)); if (orphan.length) { tree.manual = tree.manual || {}; box.append(h('div', { class: 'small' }, h('b', {}, '트리에 없는 노드의 보상 (Cycle III 등) — 수동 해금: '), ...orphan.map(g => h('label', { class: 'argoitem' + (tree.manual[g.name] ? ' on' : '') }, h('input', { type: 'checkbox', checked: tree.manual[g.name] ? '' : null, onchange: e => { tree.manual[g.name] = e.target.checked; saveTree(); renderLoadout(root); } }), ` ${tree.showNames ? g.name + ' ' : ''}(${g.reward.replace('Secret deck ', 'SD')})`)))); } }
      box.append(h('div', { class: 'muted small' }, 'Secret deck 보상 장비는 해당 노드를 완료해야 로드아웃에서 장착할 수 있습니다(🔒 = 미해금). Skyseer, Ascended Core 등 다른 보상은 기록만 합니다. Guaranteed Loot 장비는 로드아웃에서 장착 가능.'));
    }
    wrap.append(box);
  }
  { const psel = h('select', {}, h('option', { value: '' }, presets.length ? '— 프리셋 불러오기 —' : '(저장된 프리셋 없음)'), ...presets.map((p, i) => h('option', { value: i }, `${p.name} (${DATA.primordials[p.loadout.primordial]?.name || '?'} Lv${p.loadout.level})`)));
    const pname = h('input', { placeholder: '프리셋 이름', style: 'width:160px' });
    const load = () => { const i = psel.value; if (i === '') return; loadout = JSON.parse(JSON.stringify(presets[+i].loadout)); saveLoadout(); renderLoadout(root); };
    const save = () => { const name = pname.value.trim() || (psel.value !== '' ? presets[+psel.value].name : '') || `프리셋 ${presets.length + 1}`; const i = presets.findIndex(p => p.name === name); const entry = { name, loadout: JSON.parse(JSON.stringify(loadout)) }; if (i >= 0) presets[i] = entry; else presets.push(entry); savePresets(); renderLoadout(root); };
    const del = () => { const i = psel.value; if (i === '') return; presets.splice(+i, 1); savePresets(); renderLoadout(root); };
    wrap.append(h('div', { class: 'tcard argo' }, h('div', { class: 'row' }, h('b', {}, '프리셋'), psel, h('button', { onclick: load }, '불러오기'), h('button', { onclick: del }, '삭제'), pname, h('button', { onclick: save }, '현재 구성 저장'), h('span', { class: 'muted small' }, '같은 이름으로 저장하면 덮어씀 · 브라우저(localStorage)에 보관'))));
  }
  const grid = h('div', { class: 'titan-grid' });
  loadout.titans.forEach((t, i) => {
    const card = h('div', { class: 'tcard' });
    const cls = DATA.titans.classes[t.cls];
    card.append(h('div', { class: 'row' }, h('input', { value: t.name, placeholder: '이름', oninput: e => { t.name = e.target.value; saveLoadout(); } }), h('select', { onchange: e => { t.cls = e.target.value; saveLoadout(); renderLoadout(root); } }, ...CLASSES.map(c => h('option', { value: c, selected: t.cls === c ? '' : null }, DATA.titans.classes[c].name)))));
    card.append(h('div', { class: 'muted small' }, `Speed ${cls.speed} · Power die ${cls.powerDice} · ` + Object.keys(cls.abilities).join(', '), ' ', h('button', { class: 'x', onclick: () => showDetail(titanCard(t.cls)) }, '티탄 정보')));
    { const IO = DATA.titans.inward || { kratos: [], trauma: [] }; const R = ['', 'I', 'II', 'III', 'IV', 'V'];
      const ioSel = (key, list, label) => h('select', { title: label, onchange: e => { t[key] = e.target.value || null; saveLoadout(); renderLoadout(root); } }, h('option', { value: '' }, `${label}: 시트 기본`), ...list.map(c => { const used = loadout.titans.filter(o => o !== t && o[key] === c.name).length; const lim = c.copies || 1; return h('option', { value: c.name, selected: t[key] === c.name ? '' : null, disabled: used >= lim && t[key] !== c.name ? '' : null }, `${c.name} (C${R[c.cycle]})${lim > 1 ? ` ${used + (t[key] === c.name ? 1 : 0)}/${lim}` : ''}${used >= lim && t[key] !== c.name ? ' — 사용 중' : ''}`); }));
      const cur = [IO.kratos.find(c => c.name === t.kratosCard), IO.trauma.find(c => c.name === t.traumaCard)].filter(Boolean);
      card.append(h('div', { class: 'row small' }, 'Pattern ', ioSel('kratosCard', IO.kratos, 'Kratos Pattern'), ioSel('traumaCard', IO.trauma, 'Trauma Pattern')));
      for (const c of cur) card.append(h('div', { class: 'muted small' }, `${c.name}: ${c.kratos ? 'Kratos ' + Object.entries(c.kratos).map(([r, o]) => `${r}) ${o.map(x => x.join('+')).join(' / ')}`).join(' · ') : 'Trauma ' + c.trauma.map(x => `${x.danger} ${x.tier}`).join(' · ')}${c.text ? ' — ' + c.text : ''}`)); }
    t.mnemos = t.mnemos || [{}, {}]; while (t.mnemos.length < 2) t.mnemos.push({});
    const por = AR.portraits.find(p => p.code === t.portrait);
    const arg = h('div', { class: 'argrow' },
      h('select', { onchange: e => { t.portrait = e.target.value; saveLoadout(); renderLoadout(root); } }, h('option', { value: '' }, '— Argonaut —'), ...AR.portraits.map(p => h('option', { value: p.code, selected: t.portrait === p.code ? '' : null }, `${p.name} (${p.skill === 'chosen' ? '스킬 선택' : p.skill} 1)`))),
      por && por.skill === 'chosen' ? h('select', { onchange: e => { t.chosenSkill = e.target.value; saveLoadout(); renderLoadout(root); } }, ...AR.skills.map(k => h('option', { value: k, selected: t.chosenSkill === k ? '' : null }, k))) : null);
    const mnRow = (idx, lvl) => { const cur = t.mnemos[idx]; const c = AR.mnemos.find(m => m.name === cur?.name);
      const sel = h('select', { onchange: e => { t.mnemos[idx] = { name: e.target.value, level: lvl }; saveLoadout(); renderLoadout(root); } }, h('option', { value: '' }, `— Mnemos Lv${lvl} —`), ...AR.mnemos.map(m => h('option', { value: m.name, selected: cur?.name === m.name ? '' : null, disabled: (t.mnemos[1 - idx]?.name === m.name || mnemosUsedBy(m.name, t).length) && cur?.name !== m.name ? '' : null }, `${m.name} (C${m.cycle}: ${m.skills.join('/')})${mnemosUsedBy(m.name, t).length ? ` — ${mnemosUsedBy(m.name, t)[0].name} 사용 중` : ''}`)));
      return h('div', { class: 'mnrow' }, h('span', { class: 'tag' }, `Lv${lvl}`), sel, c ? h('button', { class: 'x', onclick: () => showDetail(mnemosCard(c, lvl)) }, '보기') : null); };
    const sk = (() => { const o = Object.fromEntries(AR.skills.map(k => [k, 0])); const sk0 = por ? (por.skill === 'chosen' ? t.chosenSkill : por.skill) : null; if (sk0) o[sk0]++; for (const m of t.mnemos) { const c = AR.mnemos.find(x => x.name === m?.name); if (c) c.skills.forEach(k => o[k]++); } for (const n of t.fated || []) { const f = (AR.fatedMnemos || []).find(x => x.name === n); if (f) { o[f.skill[0]] += f.skill[1]; if (f.skill2) o[f.skill2[0]] += f.skill2[1]; } } return o; })();
    t.fated = (t.fated || []).filter(Boolean);
    const FM = AR.fatedMnemos || [];
    const fatedRow = h('div', { class: 'mnrow' }, h('span', { class: 'tag bad' }, 'Fated'),
      ...t.fated.map(n => { const f = FM.find(x => x.name === n); return h('span', { class: 'tag bad link', title: f ? f.text : '', onclick: () => f && showDetail(h('div', { class: 'cardview mn' }, h('div', { class: 'cv-title' }, f.name, h('span', { class: 'tag bad' }, 'FATED MNEMOS')), h('div', { class: 'cv-text' }, f.text), h('div', { class: 'small muted' }, `${f.skill[0]} ${f.skill[1]} · ${f.traits.join(' · ')}`))) }, `${n} `, h('span', { class: 'link', onclick: e => { e.stopPropagation(); t.fated = t.fated.filter(x => x !== n); saveLoadout(); renderLoadout(root); } }, '×')); }),
      h('select', { onchange: e => { if (e.target.value) { t.fated.push(e.target.value); saveLoadout(); renderLoadout(root); } } }, h('option', { value: '' }, t.fated.length ? '+ 추가' : '— Fated Mnemos (선택) —'), ...FM.filter(f => !t.fated.includes(f.name)).map(f => h('option', { value: f.name }, `${f.name} (C${f.cycle || 1}, ${f.skill[0]} −1): ${f.text.slice(0, 60)}`))));
    card.append(arg, mnRow(0, 2), mnRow(1, 1), fatedRow, h('div', { class: 'muted small' }, AR.skills.map(k => `${k} ${sk[k]}`).join(' · ')));
    const list = h('div', { class: 'gearlist' });
    t.gear.forEach((n, gi) => { const g = GEAR.find(x => x.name === n); list.append(h('div', { class: 'gearrow' }, h('span', { class: 'link', onclick: () => showDetail(gearCard(g)) }, `${SLOT_ICON[g.slot]} ${g.name}`), h('span', { class: 'muted small' }, g.atk ? `◆${g.atk} +${g.prec ?? "X"} ${(g.power || []).join('')}` : ''), h('button', { class: 'x', onclick: () => { t.gear.splice(gi, 1); saveLoadout(); renderLoadout(root); } }, '×'))); });
    const errs = validateTitan(t); for (const n of t.gear) if (n !== 'Fists' && gearUsed(n) > gearCopies(n)) errs.push(`「${n}」 보유 장수(${gearCopies(n)}) 초과`); for (const m of t.mnemos) if (m && m.name && mnemosUsedBy(m.name, t).length) errs.push(`Mnemos 「${m.name}」 중복`); if (errs.length) list.append(h('div', { class: 'err' }, [...new Set(errs)].join(' · ')));
    const gopt = g => h('option', { value: g.name }, `${SLOT_ICON[g.slot]} ${g.name}${g.transform ? ' ⇄ ' + g.transform.name : ''}${g.atk ? ` (◆${g.atk} +${g.prec ?? "X"} ${(g.power || []).join('')})` : ''} — ${g.tech}${gearCopies(g.name) > 1 ? ` [${gearCopies(g.name) - gearUsed(g.name)}/${gearCopies(g.name)}]` : ''}`);
    const avail = GEAR.filter(g => !t.gear.includes(g.name) && g.name !== 'Fists' && !gearLocked(g) && gearUsed(g.name) < gearCopies(g.name)).sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
    const sel = h('select', {}, h('option', { value: '' }, '+ 장비 추가…'), ...['1', '2', '3', '4', '5', 'M'].map(c => avail.filter(g => gCyc(g) === c)).map((l, i) => l.length ? h('optgroup', { label: gCycName(['1', '2', '3', '4', '5', 'M'][i]) }, ...l.map(gopt)) : null).filter(Boolean));
    sel.onchange = () => { if (sel.value) { showDetail(gearCard(GEAR.find(x => x.name === sel.value))); t.gear.push(sel.value); saveLoadout(); renderLoadout(root); } };
    { const dlId = 'gdl-' + Math.random().toString(36).slice(2, 8); const dl = h('datalist', { id: dlId }, ...avail.map(g => h('option', { value: g.name }, `${SLOT_ICON[g.slot]} ${(g.traits || []).join(', ')}`)));
      const si = h('input', { list: dlId, placeholder: '🔎 장비 이름 검색해서 추가', class: 'gsearch', style: 'width:100%;margin-top:4px' });
      let added = false; const tryAdd = () => { if (added) return; const v = si.value.trim(); const g = avail.find(x => x.name.toLowerCase() === v.toLowerCase()); if (g) { added = true; showDetail(gearCard(g)); t.gear.push(g.name); saveLoadout(); renderLoadout(root); } };
      si.addEventListener('change', tryAdd); si.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = si.value.trim().toLowerCase(); const g = avail.find(x => x.name.toLowerCase() === v) || avail.find(x => x.name.toLowerCase().includes(v)); if (g) { si.value = g.name; tryAdd(); } } });
      sel.after ? null : null; sel._search = [si, dl]; }
    const bl = GEAR.filter(g => g.name !== 'Fists').sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name)); const bo = g => h('option', { value: g.name }, `${gearLocked(g) ? '🔒 ' : ''}${SLOT_ICON[g.slot]} ${g.name}${g.transform ? ' ⇄ ' + g.transform.name : ''}`); const browse = h('select', {}, h('option', { value: '' }, '🔍 장비 카드 보기…'), ...['1', '2', '3', '4', '5', 'M'].map(c => bl.filter(g => gCyc(g) === c)).map((l, i) => l.length ? h('optgroup', { label: gCycName(['1', '2', '3', '4', '5', 'M'][i]) }, ...l.map(bo)) : null).filter(Boolean));
    browse.onchange = () => { if (browse.value) showDetail(gearCard(GEAR.find(x => x.name === browse.value))); browse.value = ''; };
    card.append(browse);
    card.append(list, sel, ...(sel._search || []));
    grid.append(card);
  });
  loadout.argo = loadout.argo || []; loadout.aaLimit = loadout.aaLimit || 2;
  const argoBox = h('div', { class: 'tcard argo' }, h('div', { class: 'row' }, h('b', {}, 'Argo Abilities'), h('label', { class: 'small' }, 'Argo Support: ', h('select', { onchange: e => { loadout.aaLimit = +e.target.value; loadout.argo = loadout.argo.slice(0, loadout.aaLimit); saveLoadout(); renderLoadout(root); } }, ...[[2, '기본 (AA 2)'], [3, 'Excursion Propylon II (AA 3)'], [4, 'War Propylon / Argo Support III (AA 4)'], [5, 'Argo Cloud Operations / Argo Support IV (AA 5)']].map(([v, l]) => h('option', { value: v, selected: loadout.aaLimit === v ? '' : null }, l)))), h('span', { class: 'muted small' }, `${loadout.argo.length}/${loadout.aaLimit}`)),
    h('div', { class: 'row small' }, h('label', { title: 'Critical 효과로 Primordial이 즉사하는 BP(Death Blow)를 즉사 대신 Double Wound 추가로 처리' }, h('input', { type: 'checkbox', checked: loadout.deathBlowDouble ? '' : null, onchange: e => { loadout.deathBlowDouble = e.target.checked; saveLoadout(); } }), ' Death Blow → Double Wound 추가로 대체 (즉사 없음)')),
    h('div', { class: 'row small' }, h('label', {}, '시작 Priority Target: ', h('select', { onchange: e => { loadout.ptIndex = +e.target.value; saveLoadout(); } }, ...loadout.titans.map((t, i) => h('option', { value: i, selected: (loadout.ptIndex || 0) === i ? '' : null }, t.name || `Titan ${i + 1}`))))),
    h('div', { class: 'row small' }, h('label', { title: '전투 전체에서 1회(모든 타이탄 통틀어): Power Roll 후 Fate를 원하는 만큼 올려서 그만큼 Power 주사위 면을 한 단계씩 다음 면으로 업그레이드' }, h('input', { type: 'checkbox', checked: loadout.hrUpgrade ? '' : null, onchange: e => { loadout.hrUpgrade = e.target.checked; saveLoadout(); } }), ' 하우스룰: 전투 전체 1회 Fate로 Power 주사위 면 업그레이드')),
    h('div', { class: 'row small' }, h('label', {}, h('input', { type: 'checkbox', checked: loadout.quantumPropylon ? '' : null, onchange: e => { loadout.quantumPropylon = e.target.checked; saveLoadout(); renderLoadout(root); } }), ' Quantum Propylon (Temporal Argo Support)'), loadout.quantumPropylon ? h('select', { onchange: e => { loadout.argoReserve = e.target.value || null; saveLoadout(); } }, h('option', { value: '' }, '— 예비 Argo Ability —'), ...AR.argoAbilities.cards.filter(c => !loadout.argo.includes(c.name)).map(c => h('option', { value: c.name, selected: loadout.argoReserve === c.name ? '' : null }, `${c.name} (C${['I', 'II', 'III', 'IV', 'V'][(c.cycle || 1) - 1]})`))) : null, loadout.quantumPropylon ? h('span', { class: 'muted' }, ' 전투 시작 시 예비 1개, Titan Round 시작마다 준비된 것 하나와 교체 가능(전체 charge)') : null),
    h('div', { class: 'argolist' }, ...AR.argoAbilities.cards.map(c => { const on = loadout.argo.includes(c.name); return h('label', { class: 'argoitem' + (on ? ' on' : '') }, h('input', { type: 'checkbox', checked: on ? '' : null, disabled: !on && loadout.argo.length >= loadout.aaLimit ? '' : null, onchange: e => { if (e.target.checked) loadout.argo.push(c.name); else loadout.argo = loadout.argo.filter(n => n !== c.name); saveLoadout(); renderLoadout(root); } }), ` ${c.name} `, h('span', { class: 'tag' }, `C${['I', 'II', 'III', 'IV', 'V'][(c.cycle || 1) - 1]}`), h('span', { class: 'muted small' }, ` (${c.charges}) ${c.text}`)); })));
  wrap.append(argoBox);
  loadout.awakening = loadout.awakening || { enabled: false, spark: false, godforms: GODS.map(g => g.name) }; const AW = loadout.awakening; if (!AW.seen3) { AW.seen3 = true; for (const n of ['Dionysus', 'Aphrodite', 'Helios Apollon Exalted']) if (!AW.godforms.includes(n)) AW.godforms.push(n); } if (!AW.seen2) { AW.seen2 = true; for (const n of ['Hephaestus', 'Hermes', 'Ares', 'Athena', 'Artemis']) if (!AW.godforms.includes(n)) AW.godforms.push(n); saveLoadout(); }
  wrap.append(h('div', { class: 'tcard argo' }, h('div', { class: 'row' }, h('b', {}, 'Awakening'), h('span', { class: 'muted small' }, '항상 적용: Awakening Grave Trauma, 각성 You Died Obol, Spark of the Dead Gods')),
    h('div', { class: 'argolist' }, ...GODS.map(g => { const on = AW.godforms.includes(g.name); return h('label', { class: 'argoitem' + (on ? ' on' : '') }, h('input', { type: 'checkbox', checked: on ? '' : null, onchange: e => { if (e.target.checked) AW.godforms.push(g.name); else AW.godforms = AW.godforms.filter(n => n !== g.name); saveLoadout(); } }), ` 🔱 ${g.name} `, h('span', { class: 'muted small link', onclick: ev => { ev.preventDefault(); showDetail(godCard(g)); } }, '(카드 보기)')); }))));
  { const GC = AR.grandCannon; loadout.cannon = loadout.cannon || { enabled: false, payload: 'Spartan Payload', unlimited: true, res: {} }; const C = loadout.cannon; C.res = C.res || {}; if (!GC.payloads.some(p => p.name === C.payload)) C.payload = 'Spartan Payload';
    const cannonCard = () => h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, GC.name, h('span', { class: 'tag' }, `charges ${GC.charges}`)), ...GC.text.map(x => h('div', { class: 'cv-text' }, x)), ...GC.payloads.map(p => h('div', { class: 'cv-text' }, h('b', {}, p.name + (p.secret ? ` (Secret ${p.secret})` : '') + ': '), h('ul', {}, ...p.effects.map(e => h('li', {}, h('b', {}, e.name + ` [${e.prime}+]`), ' ' + e.text))))));
    wrap.append(h('div', { class: 'tcard argo' }, h('div', { class: 'row' }, h('label', {}, h('input', { type: 'checkbox', checked: C.enabled ? '' : null, onchange: e => { C.enabled = e.target.checked; saveLoadout(); renderLoadout(root); } }), h('b', {}, ` 🎯 ${GC.name}`)), h('span', { class: 'muted small' }, ' Argo Upgrade · Payload 카드 1종 장착 '), h('span', { class: 'muted small link', onclick: () => showDetail(cannonCard()) }, '(카드 보기)')),
      C.enabled ? h('div', {}, h('div', { class: 'argolist' }, ...GC.payloads.map(p => { const on = C.payload === p.name; return h('label', { class: 'argoitem' + (on ? ' on' : '') }, h('input', { type: 'radio', name: 'payload', checked: on ? '' : null, onchange: () => { C.payload = p.name; saveLoadout(); renderLoadout(root); } }), ` ${p.name} `, h('span', { class: 'muted small' }, `${p.secret ? `(Secret ${p.secret}) ` : '(대포 카드 인쇄) '}${p.effects.map(e => `${e.name} ${e.prime}+`).join(' / ')}`)); })),
        h('div', { class: 'row small' }, h('label', {}, h('input', { type: 'checkbox', checked: C.unlimited ? '' : null, onchange: e => { C.unlimited = e.target.checked; saveLoadout(); renderLoadout(root); } }), ' 자원 무제한 (비용 무시)')),
        C.unlimited ? null : h('div', { class: 'argolist small' }, ...GC.resources.filter(r => r === 'Primordial (기타)' && C.payload === 'Spartan Payload' || GC.payloads.some(p => p.name === C.payload && p.effects.some(e => e.cost.some(c => c.res === r || (c.res === '*prim' && r !== 'Mortal' && r !== 'Ambrosia'))))).map(r => h('label', { class: 'argoitem' }, `${r} `, h('input', { type: 'number', min: 0, max: 99, value: C.res[r] || 0, style: 'width:3.5em', onchange: e => { C.res[r] = Math.max(0, +e.target.value || 0); saveLoadout(); } }))))) : null)); }
  const detail = h('div', { class: 'detail', id: 'lo-detail' }, h('div', { class: 'muted small' }, '장비 이름이나 "티탄 정보"를 클릭하면 여기에 카드가 표시됩니다.'));
  wrap.append(h('div', { class: 'lo-main' }, grid, detail));
  const dups = dupErrors(); const ok = loadout.titans.every(t => !validateTitan(t).length) && !dups.length;
  if (dups.length) wrap.append(h('div', { class: 'err' }, '중복: ' + dups.join(' · ')));
  wrap.append(h('div', { class: 'row' }, h('button', { class: 'primary', disabled: ok ? null : '', onclick: () => startBattle(root) }, '전투 시작'), h('button', { onclick: () => { loadout = JSON.parse(JSON.stringify(DEFAULT_LOADOUT)); saveLoadout(); renderLoadout(root); } }, '기본 로드아웃')));
  wrap.append(h('details', { class: 'muted small' }, h('summary', {}, '참고 / 미구현'), h('ul', {}, h('li', {}, 'Power 주사위: 빨강 •/▲/⟨/⟨▲/⟨▲/•⟨⟨ · 검정 •▲/⟨▲/⟨▲/•⟨⟨/⟨⟨▲/•⟨⟨▲▲ · 흰색 •⟨▲/•⟨▲▲/⟨⟨▲▲/⟨⟨⟨▲▲/•⟨⟨▲/•⟨⟨⟨▲▲'), h('li', {}, '13th Muse Grand Cannon의 The Final Deterrent (Inward Odyssey 18)는 캠페인 전용이라 미구현'), h('li', {}, '손 슬롯이 남으면 Fists가 자동 장착됨 (손 2개 비면 양손 Fists ◆1)'))));
  root.append(wrap);
}

function showDetail(node) { const d = $('#lo-detail'); if (d) { d.innerHTML = ''; d.append(node); d.scrollIntoView({ block: 'nearest' }); } else openModal(node); }

// ---------------- Battle screen ----------------
let game, ui;
function startBattle(root) {
  root.innerHTML = '';
  ui = { root, pending: null, moveCells: null, selected: null };
  const titans = loadout.titans.map(t => { const g = [...t.gear]; let hands = 0; for (const n of g) hands += handCost(GEAR.find(x => x.name === n), t.cls); if (hands < slotsFor(t).hands) g.push('Fists'); return { ...t, gear: g }; });
  game = new Game(DATA, { ask, onLog: addLog, onState: () => render() });
  window.__game = game;
  game.setup({ primordialId: DATA.primordials[loadout.primordial] ? loadout.primordial : 'hekaton', level: loadout.level, titans, argo: loadout.argo || [], argoReserve: loadout.quantumPropylon ? loadout.argoReserve || null : null, awakening: { ...loadout.awakening, enabled: true, spark: true }, cannon: loadout.cannon, paradox: loadout.paradox || 0, deathBlowDouble: !!loadout.deathBlowDouble, hrUpgrade: !!loadout.hrUpgrade, ptIndex: loadout.ptIndex || 0 });
  buildLayout(root);
  render();
  game.run().then(result => {
    let treeMsg = '';
    if (result === 'victory' && tree.pending) { const n = TREE.nodes.find(x => x.id === tree.pending); if (n && n.prim === loadout.primordial && n.level === loadout.level) { const got = completeNode(n.id); tree.pending = null; saveTree(); if (got) { treeMsg = ` Tree of Knowledge: ${nodeName(n)} 완료 — 보상 ${got.join(', ')}`; addLog(treeMsg, 'good'); } } }
    addLog(result === 'victory' ? '승리!' + (treeMsg ? '' : ' (Tree of Knowledge 전투가 아니었음)') : `전투 종료 (${result})`, 'hdr'); showPrompt({ title: result === 'victory' ? '🏆 승리!' : result === 'retreat' ? '후퇴' : '☠ 패배', options: [{ label: '로드아웃으로', value: 0 }] }).then(() => renderLoadout(root)); }).catch(e => { addLog('엔진 오류: ' + e.message, 'bad'); console.error(e); });
}
function buildLayout(root) {
  root.append(h('div', { class: 'battle' },
    h('div', { class: 'left' }, h('div', { id: 'board' }), h('div', { id: 'prim' })),
    h('div', { class: 'right' }, h('div', { id: 'prompt' }), h('div', { id: 'titans' }), h('div', { id: 'log' }))));
}
function addLog(msg, cls) { const el = $('#log'); if (!el) return; el.append(h('div', { class: 'l ' + (cls || '') }, pretty(msg))); el.scrollTop = el.scrollHeight; }
function ask(q) { return new Promise(resolve => { ui.pending = { q, resolve }; if (q.type === 'move') ui.moveCells = q.cells; render(); showPrompt(q).then(v => { ui.pending = null; ui.moveCells = null; render(); resolve(v); }); }); }
function showPrompt(q) {
  return new Promise(resolve => {
    const p = $('#prompt'); p.innerHTML = '';
    p.append(h('div', { class: 'ptitle' }, q.titan ? h('span', { class: 'tag' }, q.titan.name) : null, q.title));
    const opts = q.options || [];
    const btns = h('div', { class: 'pbtns' });
    const many = opts.length > 12;
    if (q.type === 'multi') {
      const sel = new Set(); const max = q.max ?? 99;
      const tb = opts.map(o => h('button', { class: 'tog', onclick: e => { if (sel.has(o.value)) sel.delete(o.value); else if (sel.size < max) sel.add(o.value); e.target.classList.toggle('on', sel.has(o.value)); cnt.textContent = `선택 ${sel.size}/${max}`; } }, o.label));
      const cnt = h('span', { class: 'muted small' }, `선택 0/${max}`);
      btns.append(...tb, h('button', { class: 'primary', onclick: () => resolve([...sel]) }, q.okLabel || (/재굴림|다시 굴|re-?roll/i.test(q.title || '') ? '재굴림 실행' : '확인')), h('button', { onclick: () => resolve([]) }, q.noLabel || (/재굴림|다시 굴|re-?roll/i.test(q.title || '') ? '재굴림 안 함' : '선택 안 함')), cnt);
      p.append(btns); return;
    }
    if (q.type === 'placement') { opts.forEach(o => { const b = h('button', { onclick: () => { ui.preview = null; resolve(o.value); } }, o.label); b.addEventListener('mouseenter', () => { ui.preview = o.preview; renderBoard(); }); b.addEventListener('mouseleave', () => { ui.preview = null; renderBoard(); }); btns.append(b); }); p.append(btns); ui.preview = opts[0]?.preview; renderBoard(); return; }
    (many ? opts.slice(0, 1) : opts).forEach(o => btns.append(h('button', { onclick: () => resolve(o.value) }, o.label)));
    if (q.type === 'move') { btns.append(h('span', { class: 'muted small' }, ' 보드에서 하이라이트된 칸을 클릭하세요')); ui.onCell = c => resolve(c); } else ui.onCell = null;
    p.append(btns);
  });
}
function render() {
  if (!game) return;
  renderBoard(); renderPrim(); renderTitans();
}
function renderBoard() {
  const B = game.board; const el = $('#board'); if (!el) return; const S = 34;
  const ns = 'http://www.w3.org/2000/svg'; const mk = (t, a) => { const e = document.createElementNS(ns, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const svg = mk('svg', { viewBox: `0 0 ${(B.cols + 1) * S} ${(B.rows + 1) * S}`, class: 'bsvg' });
  const X = c => c * S, Y = r => (B.rows - r) * S; // row 1 at bottom
  const moveSet = new Set((ui.moveCells || []).map(c => `${c.c},${c.r}`));
  const front = new Set(); for (let c = 1; c <= B.cols; c++) for (let r = 1; r <= B.rows; r++) if (game.inFront({ c, r })) front.add(`${c},${r}`);
  for (let c = 1; c <= B.cols; c++) for (let r = 1; r <= B.rows; r++) {
    const k = `${c},${r}`; const rect = mk('rect', { x: X(c), y: Y(r), width: S, height: S, class: 'cell' + (front.has(k) ? ' front' : '') + (moveSet.has(k) ? ' move' : '') });
    if (moveSet.has(k)) rect.addEventListener('click', () => ui.onCell && ui.onCell({ c, r }));
    else { rect.addEventListener('click', () => openModal(cellInfo({ c, r }))); rect.style.cursor = 'help'; }
    svg.append(rect);
  }
  for (let c = 1; c <= B.cols; c++) { const t = mk('text', { x: X(c) + S / 2, y: Y(0) + 14, class: 'lbl' }); t.textContent = c; svg.append(t); }
  for (let r = 1; r <= B.rows; r++) { const t = mk('text', { x: 14, y: Y(r) + S / 2 + 5, class: 'lbl' }); t.textContent = ROWS[r - 1]; svg.append(t); }
  if (B.allChasm === 'empty') for (let c = 1; c <= B.cols; c++) for (let r = 1; r <= B.rows; r++) if (!B.terrainAt(c, r)) svg.append(mk('rect', { x: X(c) + 1, y: Y(r) + 1, width: S - 2, height: S - 2, class: 'chasmcell' }));
  for (const t of B.terrain.values()) { const g = mk('rect', { x: X(t.cell.c) + 2, y: Y(t.cell.r) + 2, width: S - 4, height: S - 4, class: 'ter ' + t.type.replace(/ /g, '') }); svg.append(g); if (t.type === 'Column') { const tx = mk('text', { x: X(t.cell.c) + S / 2, y: Y(t.cell.r) + S / 2 + 5, class: 'ticon' }); tx.textContent = '▮'; svg.append(tx); } if (game.prim.gold && game.prim.gold[t.id]) { const tx = mk('text', { x: X(t.cell.c) + S / 2, y: Y(t.cell.r) + S / 2 + 5, class: 'ticon' }); tx.textContent = '🪙' + game.prim.gold[t.id]; svg.append(tx); } }
  // labyrinth
  const wallLine = (a, b, cls) => { let x1, y1, x2, y2; if (a.c !== b.c) { x1 = x2 = X(Math.max(a.c, b.c)); y1 = Y(a.r); y2 = y1 + S; } else { y1 = y2 = Y(Math.min(a.r, b.r)); x1 = X(a.c); x2 = x1 + S; } svg.append(mk('line', { x1, y1, x2, y2, class: cls })); };
  for (const [k, id] of B.lab) { const [c, r] = k.split(',').map(Number); svg.append(mk('rect', { x: X(c) + 1, y: Y(r) + 1, width: S - 2, height: S - 2, class: 'labcell' })); }
  for (const ek of B.walls.keys()) { const [a, b] = ek.split('|').map(x => { const [c, r] = x.split(',').map(Number); return { c, r }; }); wallLine(a, b, 'wall'); }
  if (ui.preview) { for (const c of ui.preview.cells) svg.append(mk('rect', { x: X(c.c) + 2, y: Y(c.r) + 2, width: S - 4, height: S - 4, class: 'labprev' })); for (const [a, b] of ui.preview.edges) wallLine(a, b, 'wallprev'); }
  // rear spaces
  for (const p of game.rearCells()) svg.append(mk('rect', { x: X(p.c) + 4, y: Y(p.r) + 4, width: S - 8, height: S - 8, class: 'rear' }));
  if (game.prim.wATMalus || game.prim.wToHitMalus) for (const p of game.wCells()) { const tx = mk('text', { x: X(p.c) + S / 2, y: Y(p.r) + S / 2 + 4, class: 'wtxt' }); tx.textContent = 'W'; svg.append(tx); }
  if (game.timefront != null) for (let c = 1; c <= Math.min(B.cols, game.timefront); c++) for (let r = 1; r <= B.rows; r++) svg.append(mk('rect', { x: X(c) + 1, y: Y(r) + 1, width: S - 2, height: S - 2, class: 'tfcell' }));
  if (game.prim.def.sunD) for (let c = 1; c <= B.cols; c++) for (let r = 1; r <= B.rows; r++) if (!game.primContains({ c, r }) && game.shaded({ c, r })) svg.append(mk('rect', { x: X(c) + 1, y: Y(r) + 1, width: S - 2, height: S - 2, class: 'shadecell' }));
  if (game.anchors) game.anchors.forEach((p, i) => { if (!p || !game.titans[i].alive) return; const g = mk('g', { class: 'anchor c' + i }); g.append(mk('rect', { x: X(p.c) + S - 13, y: Y(p.r) + 2, width: 11, height: 11, class: 'anc a' + i })); const tx = mk('text', { x: X(p.c) + S - 7.5, y: Y(p.r) + 11, class: 'anctxt' }); tx.textContent = '⚓'; g.append(tx); svg.append(g); });
  // primordial
  if (game.kbShow) { const k = game.kbShow; for (const p of k.path) svg.append(mk('rect', { x: X(p.c) + 6, y: Y(p.r) + 6, width: S - 12, height: S - 12, class: 'kbpath' })); const e = k.end; svg.append(mk('rect', { x: X(e.c) + 2, y: Y(e.r) + 2, width: S - 4, height: S - 4, class: 'kbend' })); const tx = mk('text', { x: X(e.c) + S / 2, y: Y(e.r) + S / 2 + 5, class: 'kbtxt' }); tx.textContent = '✕'; svg.append(tx); if (k.alt) { svg.append(mk('rect', { x: X(k.alt.c) + 2, y: Y(k.alt.r) + 2, width: S - 4, height: S - 4, class: 'kbalt' })); const t2 = mk('text', { x: X(k.alt.c) + S / 2, y: Y(k.alt.r) + S / 2 + 5, class: 'kbtxt alt' }); t2.textContent = '○'; svg.append(t2); } }
  if (game.zoneShow) for (const p of game.zoneShow) svg.append(mk('rect', { x: X(p.c) + 2, y: Y(p.r) + 2, width: S - 4, height: S - 4, class: 'zoneprev' }));
  for (const p of (game.weakspotCells ? game.weakspotCells() : [])) { svg.append(mk('rect', { x: X(p.c) + 3, y: Y(p.r) + 3, width: S - 6, height: S - 6, class: 'weakspot' })); const wt = mk('text', { x: X(p.c) + S / 2, y: Y(p.r) + S / 2 + 4, class: 'weaktxt' }); wt.textContent = 'W'; svg.append(wt); }
  if (game.prim.traits['Worm of the Labyrinth']) for (const p of game.whiteCells()) if (game.board.inBounds(p.c, p.r)) svg.append(mk('rect', { x: X(p.c) + 5, y: Y(p.r) + 5, width: S - 10, height: S - 10, class: 'white' }));
  const a = game.prim.anchor; const N = game.prim.size || 2; const pr = mk('rect', { x: X(a.c) + 3, y: Y(a.r + N - 1) + 3, width: N * S - 6, height: N * S - 6, class: 'prim' }); svg.append(pr);
  const arrow = { N: '▲', S: '▼', E: '▶', W: '◀' }[game.prim.facing]; const pt = mk('text', { x: X(a.c) + N * S / 2, y: Y(a.r + N - 1) + N * S / 2 + 8, class: 'primtxt' }); pt.textContent = arrow; svg.append(pt);
  const pn = mk('text', { x: X(a.c) + N * S / 2, y: Y(a.r + N - 1) + N * S / 2 - 10, class: 'primname' }); pn.textContent = game.prim.name.toUpperCase(); if (game.prim.name.length > 8 && N < 3) pn.setAttribute('style', 'font-size:6.5px;letter-spacing:0'); svg.append(pn);
  // titans
  if (game.oxy && game.oxy.cell) { const o = game.oxy.cell; const tx = mk('text', { x: X(o.c) + S / 2, y: Y(o.r) + S / 2 + 6, class: 'vptxt', style: 'font-size:18px' }); tx.textContent = '⚔'; svg.append(tx); }
  if (game.prim.vp && game.prim.vp.created) { const v = mk('text', { x: X(a.c) + N * S - 8, y: Y(a.r + N - 1) + 14, class: 'vptxt' }); v.textContent = '♞'; svg.append(v); }
  game.titans.forEach((t, i) => { if (!t.alive || t.offBoard) return; if (t.onStone) { const p = t.pos; const g = mk('g', { class: 'titan' }); g.append(mk('circle', { cx: X(p.c) + S - 10, cy: Y(p.r) + 10, r: 9, class: 'tc c' + i })); const tx = mk('text', { x: X(p.c) + S - 10, y: Y(p.r) + 14, class: 'ttxt', style: 'font-size:10px' }); tx.textContent = t.name[0] + '⛰'; g.append(tx); g.style.pointerEvents = 'none'; svg.append(g); return; } if (t.onVP || t.impaled || t.stair) { const g = mk('g', { class: 'titan' }); g.append(mk('circle', { cx: X(a.c) + N * S / 2, cy: Y(a.r + N - 1) + N * S / 2 - 14, r: 10, class: 'tc c' + i })); const tx = mk('text', { x: X(a.c) + N * S / 2, y: Y(a.r + N - 1) + N * S / 2 - 10, class: 'ttxt', style: 'font-size:11px' }); tx.textContent = t.name[0] + (t.impaled ? '⚔' : t.stair ? '↑' + t.stair : ''); g.append(tx); svg.append(g); return; } const g = mk('g', { class: 'titan' + (t.knockdown === 'falling' ? ' down' : '') + (t.pt ? ' pt' : '') }); if (!moveSet.has(`${t.pos.c},${t.pos.r}`)) { g.style.cursor = 'help'; g.addEventListener('click', () => openModal(cellInfo(t.pos))); } else g.style.pointerEvents = 'none'; g.append(mk('circle', { cx: X(t.pos.c) + S / 2, cy: Y(t.pos.r) + S / 2, r: S / 2 - 4, class: 'tc c' + i })); const tx = mk('text', { x: X(t.pos.c) + S / 2, y: Y(t.pos.r) + S / 2 + 5, class: 'ttxt' }); tx.textContent = t.name[0]; g.append(tx); if (t.pt) { const p = mk('text', { x: X(t.pos.c) + S - 6, y: Y(t.pos.r) + 10, class: 'pttxt' }); p.textContent = '◎'; g.append(p); } svg.append(g); });
  el.innerHTML = ''; el.append(svg);
}
const TERRAIN_KW = {
  Obstacle: '타이탄은 통과할 수 없음. Knockback/Pushback으로 부딪히면 Crash.',
  Obscuring: '시야(LoS)를 막음. 단, 이 타일 위에 서 있는 대상으로의 시야는 막지 않음.',
  Destructible: 'Primordial이 올라서거나 타이탄이 강제로 밀려 들어가면 파괴됨. (Knockback으로 지나가기만 하면 무시)',
  Indestructible: '어떤 방식으로도 파괴되지 않음. 그 위에 다른 지형을 놓을 수 없음.',
  Cover: '이 타일 위의 타이탄은 Evasion +1.',
  Chasm: '자발적으로 지나갈 수 없음. 이 칸에서 이동이 끝나거나, Pushback/Pull로 지나가거나, 밑에 놓이면 사망. (Knockback으로 지나가기만 하면 생존)',
  Ambrosia: '이 칸에서 이동을 멈추면 Ambrosia +1. 턴 시작부터 끝까지 움직이지 않아도 +1. 지나가기만 하면 6+ 테스트, 실패 시 +1.',
  Trap: 'Primordial을 이 타일로 밀어 넣으면 타일 제거 후 d10: 1–2 없음 / 3–8 Kratos Pool에 −Precision 1 / 9–10 −Precision 2.',
  Inhabited: '(캠페인 Diplomacy 관련 — Mnestis에서는 효과 없음)',
  'Black Ice': '이 타일에서 Crash를 겪으면 추가로 Ambrosia 1개.',
  Elevated: '높은 지형. Fury 4+로 올라가 아무 칸에나 설 수 있음. 위에서는 인접한 Primordial의 VP I로 무료 액션 이동 가능, Climb 테스트 +3. Supernova 등 비-Elevated 공격을 피함.',
  Slippery: '이 타일의 칸으로 들어가면, 타일 위에 있는 동안 남은 이동을 같은 방향으로 계속해야 함 (막히거나 이동력이 다하면 멈춤).',
  Timefront: 'Board Edge · Boundless · Indestructible. 이 Board Edge 위나 너머로 이동해 죽게 되면 대신 존재에서 지워짐. 모든 Timefront 타일은 하나의 타일로 취급.',
};
function cellInfo(p) {
  const G = game, B = G.board, P = G.prim; const out = [];
  const label = cellLabel(p);
  const ter = B.terrainAt(p.c, p.r); const labId = B.labAt(p.c, p.r); const tit = G.titans.find(t => t.alive && t.pos.c === p.c && t.pos.r === p.r && !t.onVP && !t.onStone);
  out.push(h('div', { class: 'cv-title' }, `칸 ${label}`));
  if (G.primContains(p)) { out.push(h('div', { class: 'cardview ai' }, h('div', { class: 'cv-title' }, P.name, h('span', { class: 'tag' }, `${P.size || 2}×${P.size || 2}`), h('span', { class: 'tag' }, `방향 ${P.facing}`)), h('div', { class: 'cv-text' }, `To Hit ${P.toHit + P.tokens.toHit}+ · Speed ${G.primSpeed() >= 99 ? '무제한' : G.primSpeed()} · Unavoidable Knockback ${P.ukb} · 상처 ${G.woundCount()}/${P.wounds}`), P.vp && P.vp.created ? h('div', { class: 'cv-text' }, `VP 「${P.def.vp.name}」: ${P.vp.occupant ? P.vp.occupant.name + ' 탑승' : '비어있음'}`) : null)); }
  if (G.timefront != null && p.c <= G.timefront) out.push(h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, 'Timefront'), h('div', { class: 'cv-text' }, TERRAIN_KW.Timefront)));
  if (ter) {
    const kws = []; if (ter.obstacle) kws.push('Obstacle'); if (ter.obscuring) kws.push('Obscuring'); if (ter.destructible) kws.push('Destructible'); if (ter.indestructible) kws.push('Indestructible'); if (ter.cover) kws.push('Cover'); if (ter.chasm) kws.push('Chasm'); if (ter.ambrosia) kws.push('Ambrosia'); if (ter.trap) kws.push('Trap'); if (ter.type === 'City' || ter.inhabited) kws.push('Inhabited'); if (ter.iceberg) kws.push('Black Ice'); if (ter.slippery) kws.push('Slippery'); if (ter.elevated) kws.push('Elevated');
    const cells = [...B.terrain.values()].filter(x => x.id === ter.id).map(x => cellLabel(x.cell));
    out.push(h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, ter.type, cells.length > 1 ? h('span', { class: 'muted small' }, ` (${cells.length}칸: ${cells.join(' ')})`) : null),
      h('div', { class: 'small muted' }, kws.join(' · ')), ...kws.map(k => h('div', { class: 'cv-text' }, h('b', {}, k + ': '), TERRAIN_KW[k]))));
  }
  if (labId) {
    const tile = B.labTiles.get(labId); const fis = B.labIsChasm;
    const walls = []; for (const [dn, d] of Object.entries({ N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] })) if (B.walls.has(Board.edgeKey(p, { c: p.c + d[0], r: p.r + d[1] }))) walls.push(dn);
    out.push(h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, `Labyrinth ${tile ? tile.shape : ''}`, fis ? h('span', { class: 'tag bad' }, 'Maze Fissure (Fissurebuilder)') : null, tile ? h('span', { class: 'muted small' }, ` ${tile.cells.map(cellLabel).join(' ')}`) : null),
      fis ? h('div', { class: 'cv-text' }, h('b', {}, 'Chasm: '), TERRAIN_KW.Chasm) : h('div', { class: 'cv-text' }, `이 칸의 붉은 벽: ${walls.length ? walls.join(', ') : '없음'}`),
      fis ? null : h('div', { class: 'cv-text' }, '붉은 선 = 타이탄에게 Obstacle + 시야 차단(벽 두 개가 만나는 모서리도 막음). Primordial은 이동·공격 시 무시하지만, 타겟팅 시야는 막음' + (P.traits['Mazesense'] ? ' — 단 Mazesense로 이 Primordial은 Labyrinth를 무시하고 봄.' : '.')),
      h('div', { class: 'cv-text' }, h('b', {}, 'Indestructible: '), TERRAIN_KW.Indestructible),
      P.traits["Ariadne's Logic"] ? h('div', { class: 'cv-text' }, "Ariadne's Logic: 이 칸에서 공격하면 AT −1.") : null,
      P.traits['Maze Reconfiguration'] ? h('div', { class: 'cv-text' }, 'Maze Reconfiguration: 이미 Labyrinth 위인 타이탄 밑에 타일을 놓으라는 지시 → 대신 Obol.') : null));
  }
  const zones = [];
  if (!G.primContains(p)) {
    if (G.inFront(p)) zones.push('Primordial 정면'); if (G.rearCells().some(x => x.c === p.c && x.r === p.r)) zones.push('Rear 칸' + (P.def.blindspots ? ' — Blindspot (타겟 제외, 시야 밖, Precision +1)' : ''));
    if (P.traits['Worm of the Labyrinth'] && G.inWhite(p)) zones.push('흰 칸 — 여기서만 Temenos 공격 가능');
    if ((P.wATMalus || P.wToHitMalus) && G.inW(p)) zones.push(`W칸 — 여기서 공격하면 ${P.wATMalus ? `AT −${P.wATMalus} ` : ''}${P.wToHitMalus ? `To Hit −${P.wToHitMalus}` : ''}`);
    if (P.frontATMalus && G.frontAdjCells().some(x => x.c === p.c && x.r === p.r)) zones.push(`정면 인접 칸 — AT −${P.frontATMalus}`);
    const d = Board.distToCells(p, G.primCells()); zones.push(`Primordial까지 거리 ${d}`);
  }
  if (zones.length) out.push(h('div', { class: 'cardview' }, h('div', { class: 'cv-sub' }, '위치'), ...zones.map(z => h('div', { class: 'cv-text' }, '· ' + z))));
  if (tit) out.push(h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, tit.name, h('span', { class: 'muted small' }, ` ${tit.def.name}`)), h('div', { class: 'cv-text' }, `Danger ${tit.danger} · Rage ${tit.rage} · Fate ${tit.fate}${tit.ambrosia ? ` · Ambrosia ${tit.ambrosia}` : ''}${tit.despair ? ` · Despair ${tit.despair}` : ''}`), tit.conditions.length ? h('div', { class: 'cv-text' }, 'Condition: ' + tit.conditions.join(', ')) : null, h('div', { class: 'cv-text small muted' }, `시야: ${G.primLos(tit) ? 'Primordial이 봄' : '시야 밖'} · ${G.isAdj(tit) ? '인접' : '비인접'}`)));
  if (!ter && !labId && !tit && !G.primContains(p)) out.push(h('div', { class: 'muted small' }, '빈 칸'));
  return h('div', {}, ...out);
}
function renderPrim() {
  const el = $('#prim'); if (!el) return; const P = game.prim; const K = game.kratosPool;
  el.innerHTML = ''; const app = (...xs) => el.append(...xs.filter(x => x != null));
  app(h('div', { class: 'phead' }, h('b', {}, `${P.name} Lv.${P.level}`), ` To Hit ${P.toHit + P.tokens.toHit}+ · Speed ${game.primSpeed() >= 99 ? '∞' : game.primSpeed()} · 방향 ${P.facing}${P.spot ? ` · 시작 ${P.spot}` : ''}`),
    (P.traits['Labyrinth X'] || P.vp) ? h('div', { class: 'small' }, P.traits['Labyrinth X'] ? `Labyrinth 트랙: ${(P.def.labyrinthTrack || []).map((x, i) => i === game.labIdx % P.def.labyrinthTrack.length ? `[${x}]` : x).join(' → ')}${P.disabled['Labyrinth X'] ? ' (비활성)' : ''}` : '', P.vp ? ` · VP ${P.def.vp.name}: ${P.vp.slots > 1 ? `${P.vp.count}/${P.vp.slots} 생성${P.vp.tokens ? ` · VP 토큰 ${P.vp.tokens}` : ''}${P.vp.occupants.length ? ' · 탑승: ' + P.vp.occupants.map(x => x.name).join(', ') : ''}` : P.vp.created ? (P.vp.occupant ? P.vp.occupant.name + ' 탑승 중' : '생성됨 (비어있음)') : '미생성'}` : '', P.mazeFragment ? ' · Maze Fragment' : '', P.combo ? ` · Combo 트랙: ${P.def.combo.track.map((x, i) => i === P.combo.idx % 3 ? `[${x}]` : x).join(' → ')} (${P.def.combo.classes[P.def.combo.track[P.combo.idx % 3]].join('/')})` : '', P.traits['Eye for an Eye'] ? ` · Eye for an Eye ${P.eyeTokens}/${P.eyeNeed}` : '', P.traits['Critical Mass'] ? ` · Critical Mass ${P.cmTokens}/3` : '', P.traits['Metamorphosis'] && !P.disabled['Metamorphosis'] ? ` · 상태: ${P.state || '없음'}` : '', P.leleges ? ` · Leleges ${P.leleges}` : '', game.timefront != null ? ` · Timefront ${game.timefront}열` : '', game.moirai && game.moirai.length ? ` · Moirai Vault: ${game.moirai.map(v => (v.g ? v.g.card.name : v.mn.card.name)).join(', ')}` : '', game.weakspotCard && game.weakspotCard() ? ` · Weakspot: ${game.weakspotCells().map(cellLabel).join(' ') || '(보드 밖)'} (버림 더미 맨 위 「${game.weakspotCard().name}」)` : (P.traits['All For One'] ? ' · Weakspot 없음 (버림 더미 맨 위 카드에 표시 없음)' : ''), (P.tokens.at || P.atTemp || P.snail) ? ` · AT 토큰 ${(P.tokens.at || 0) + (P.atTemp || 0) + (P.snail || 0) >= 0 ? '+' : ''}${(P.tokens.at || 0) + (P.atTemp || 0) + (P.snail || 0)}${P.snail ? ` (Snail ${P.snail})` : ''}${P.atTemp ? ` (임시 ${P.atTemp})` : ''}` : '', P.frontATMalus ? ` · 정면 AT −${P.frontATMalus}` : '', P.disabled.routine ? ' · Routine 비활성' : '', P.forceClosest ? ' · 항상 가장 가까운 타이탄' : '', P.disabled.labPlace ? ' · Labyrinth 배치 불가' : '', game.flares ? ` · Flare 덱 ${game.flares.size()}장${P.disabled.Flares ? ' (비활성)' : ''}` : '', Object.keys(P.disabled).filter(k => P.traits[k]).length ? ` · 비활성 트레이트: ${Object.keys(P.disabled).filter(k => P.traits[k]).join(', ')}` : '', P.blindATMalus ? ` · Blindspot AT −${P.blindATMalus}` : '', P.wATMalus ? ` · W칸 AT −${P.wATMalus}` : '', P.wToHitMalus ? ` · W칸 To Hit −${P.wToHitMalus}` : '', game.board.labIsChasm ? ' · Labyrinth = Maze Fissure' : '') : null,
    h('div', { class: 'wounds' }, '상처 ', ...Array.from({ length: P.wounds }, (_, i) => h('span', { class: 'w' + (i < game.woundCount() ? ' on' : '') })), ` ${game.woundCount()}/${P.wounds}`),
    h('div', { class: 'decks' }, deckBox('AI 덱', game.ai, c => `AI ${tierL(c.aiTier || c.tier)}`), deckBox('BP 덱', game.bp, c => `BP ${tierL(c.tier)}`), h('span', { class: 'small muted' }, ` Escalation ${game.escalations} · 트레이트: `, ...Object.keys(P.traits).flatMap((n, i) => [i ? ', ' : '', h('span', { class: 'link', onclick: () => openModal(h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, n), h('div', { class: 'cv-text' }, P.def.traits[n]))) }, n)]), P.traits['A Fist for a Fist'] ? ` [토큰 ${P.traitTokens}/3]` : '', h('button', { class: 'x', onclick: () => openModal(h('div', {}, h('h3', {}, 'Signature'), aiCardView(game.sig, P), h('h3', {}, 'Routine (Mnestis)'), aiCardView(game.routine, P), h('h3', {}, 'Traits'), ...Object.keys(P.traits).map(n => h('div', { class: 'cv-text' }, h('b', {}, n + ': '), P.def.traits[n])))) }, 'Sig/Routine/Traits'))),
    h('div', { class: 'small' }, `보너스: AT ${P.bonus.AT >= 0 ? '+' : ''}${P.bonus.AT} · Danger +${P.bonus.DANGER}${P.bonusPerHit ? '/hit' : ''} · 회피 주사위 +${P.bonus.EVADE_DICE}${P.bonus.ESCALATION ? ` · 시작 Escalation ${P.bonus.ESCALATION}` : ''}`),
    h('div', { class: 'small' }, `Kratos Pool: Opening ${K.opening} · Break ${K.break} · Diversion ${K.diversion}${K.negPrecision ? ` · −Precision ${K.negPrecision}` : ''}${K.fire ? ` · Fire ${K.fire}` : ''}${K.black ? ` · Black ${K.black}` : ''}${K.hope ? ` · Hope ${K.hope}` : ''}${K.rouse ? ` · Rouse ${K.rouse}` : ''}${game.ofaPower ? ` · One For All +${game.ofaPower}` : ''}${P.tokens.precision ? ` · ${P.name} Precision ${P.tokens.precision}` : ''}${P.atRound ? ` · AT −${P.atRound} (이번 라운드)` : ''}`),
    P.def.djinnD ? h('div', { class: 'small' }, `🌀 Global Wish: ${P.disabled.globalWish ? '비활성' : P.gw && P.gw.active ? `「${P.gw.active.name}」 — ${P.gw.active.text}` : '(없음)'} · 스택 ${P.gw ? P.gw.stack.length : 0} · Wish for a Wish ${P.wishTokens || 0}/3 · Endless Staircase ${game.stairLen()}칸 [${(P.stairSegs || []).join('|')}]${game.liveTitans().filter(x => x.stair).map(x => ` · ${x.name} ${x.stair}`).join('')}`) : null,
    P.def.babelD ? h('div', { class: 'small' }, `🗼 Endless Staircase ${game.stairLen()}/${game.babelLimitLen()}칸 열림 [${(P.stairSegs || []).join('|') || '잠김'}] · Dome of Folly VP ${P.vp.count}/${P.vp.slots} 열림 · Staircase Entrance ${P.entr ? `${'ABCDEFGHIJKLMN'[P.entr.cell.r - 1]}${P.entr.cell.c}` : '없음'} · Irem Tower ${game.iremTowers().length}개${game.liveTitans().filter(x => x.stair).map(x => ` · ${x.name} 계단 ${x.stair}`).join('')}${P.ascentBonus ? ` · Ascent +${P.ascentBonus}` : ''}${P.babelSVMalus ? ` · 계단/VP AT −${P.babelSVMalus}` : ''}${P.disabled.curseAI ? ' · Curse AI 비활성' : ''}${P.disabled.midasX ? ' · Midas X 비활성' : ''}`) : null,
    P.def.dahakaD ? h('div', { class: 'small' }, `🌫 통합 AI/BP 덱 ${game.ai.size()}장 (버림 ${game.ai.discard.length}) · ${P.status ? `${P.status.side === 'FH' ? 'Fearful Hospitality' : 'Outstaying Your Welcome'}: ${P.status.holder.name}` : (P.traits['Winnowing'] ? '' : 'Fearful Hospitality 없음')}${P.trojan && P.trojan.holder ? ` · ${P.trojan.side === 'TI' ? 'Trojan Ire' : 'Lotus Eaters Curse'}: ${P.trojan.holder.name}` : ''}${game.titans.filter(x => x.dhOar).map(x => ` · ${x.name}: ${x.dhOar === 'oar' ? 'The Oar' : 'Winnowed'}`).join('')}${P.traits['Shackles of Regret'] ? (P.disabled['Shackles of Regret'] ? ' · Shackles 비활성' : ' · Shackles of Regret 활성 (End of Hope 꺼짐)') : ''}${P.traits['The Dragon Does Not Sleep'] ? ` · Combo: ${game.dhComboName()}` : ''}${P.driftMove ? ' · Drift = Move Unlimited' : ''}${P.disabled.Soulrend ? ' · Soulrend 비활성' : ''}${P.disabled.wishAtk ? ' · Wish Attack → 일반' : ''}`) : null,
    P.def.midasD ? h('div', { class: 'small' }, `🪙 Incremental Painment ${P.painment || 0}/5 · Imperial Impetus ${game.impetusDist()}칸 ${P.facing}${P.disabled.impetus ? ' (비활성)' : ''}${P.disabled.airburst ? ' · Airburst 비활성' : ''}`) : null,
    P.def.sunD ? h('div', { class: 'small' }, `☀ 위치 ${P.sunPos} · 햇빛: ${({ N: 'S', S: 'N', E: 'W', W: 'E' })[P.facing]}쪽 가장자리 · Feathery Ascent VP ${P.vp.count}/3 열림 (점유: ${game.vpTitans().map(x => `${x.name}=VP ${'I'.repeat(x.vpLevel)}`).join(', ') || '없음'})${Object.entries({ merciless: 'Merciless Sun', laser: 'Laser', clock: 'Time-clocked' }).filter(([k]) => P.disabled[k]).map(([, v]) => ` · ${v} 비활성`).join('')}${P.laserMalus ? ` · Laser Danger −${P.laserMalus}` : ''}`) : null,
    P.ra ? h('div', { class: 'small' }, `🧬 Rapid Adaptation: ${game.raLabel()}${P.predGrace ? ` · Predator 유예 ${P.predGrace}` : ''}${Object.entries({ pull: 'Pull', bleedAtk: 'Bleeding', muffled: 'Muffled/Sealed' }).filter(([k]) => P.disabled[k]).map(([, v]) => ` · ${v} 비활성`).join('')}`) : null,
    game.c3 ? h('div', { class: 'small' }, `Timefront: ${game.timefront == null ? '없음' : game.timefront + '열' + (game.tfStep ? ` (전진 ${game.tfStep()}칸)` : '')} · Paradox ▷ ${game.paradox || 0}${P.traits['Once Upon A Time'] ? ` · Once Upon A Time ${P.ouat || 0}/4` : ''}${game.setAsideAI ? ` · 대기: ${game.setAsideAI.name}` : ''}${Object.entries({ atemporal: 'Atemporal', tfMove: 'TF 쪽 이동', 'Quantum Eye': 'Quantum Eye', doubleLaser: 'Double Laser', rewind: 'Rewind' }).filter(([k]) => P.disabled[k]).map(([, v]) => ` · ${v} 비활성`).join('')}`) : null,
    game.awk ? h('div', { class: 'small muted' }, `Godform: ${game.awk.avail.map(n => game.awk.used.includes(n) ? `${n}(사용)` : n).join(' · ')}${game.awk.spark ? ' · Spark' : ''}`) : null,
    game.cannon ? h('div', { class: 'small' }, `🎯 Grand Cannon: charge ${game.cannon.charges} · ${game.cannon.primed ? `장전됨 「${game.cannon.primed.name}」 (${game.cannon.primed.text.replace(/^[^:]*: /, '')})` : '장전 안 됨'}${game.cannon.res ? ' · 자원: ' + (Object.entries(game.cannon.res).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ') || '없음') : ' · 자원 무제한'}`) : null,
    ...game.titans.filter(t => t.alive && t.godform && t.godform.reveal).map(t => { const d = game[t.godform.reveal]; const top = d.peek(); return h('div', { class: 'small' }, `🦉 Poisoned Wisdom (${t.name}) — ${t.godform.reveal.toUpperCase()} 덱 맨 위: `, top ? h('span', { class: 'link', onclick: () => openModal(t.godform.reveal === 'ai' ? aiCardView(top, P) : bpCardView(top, P)) }, top.name) : '(비어 있음)'); }),
    game.argo.length ? h('div', { class: 'gear' }, h('span', { class: 'small muted' }, 'Argo: '), ...game.argo.map(a => h('span', { class: 'g link' + (a.exhausted || !a.charges ? ' ex' : ''), onclick: () => openModal(argoCard(a.card)) }, `${a.card.name} (${a.charges})`))) : null,
    h('div', { class: 'small muted' }, `Obol 덱: You Live / You Died${game.obolExtra.map(c => ' / ' + DATA.decks.obol.find(o => o.code === c).name).join('')}`),
    h('div', { class: 'cards2' }, h('div', {}, h('div', { class: 'cv-sub' }, game.currentAI ? '현재/최근 AI 카드' : 'AI 카드'), aiCardView(game.currentAI?.card, P)), game.lastBP ? h('div', {}, h('div', { class: 'cv-sub' }, '최근 BP 카드'), bpCardView(game.lastBP, P)) : null, game.lastFlare ? h('div', {}, h('div', { class: 'cv-sub' }, '최근 Flare'), h('div', { class: 'cardview ai' }, h('div', { class: 'cv-title' }, game.lastFlare.name, h('span', { class: 'tag' }, 'FLARE')), h('div', { class: 'cv-text' }, game.lastFlare.text))) : null));
}
function deckBox(label, deck, fmt) { const top = deck.peek(); const el = h('span', { class: 'deckbox' }, h('b', {}, label), ` ${deck.size()}장`, top ? h('span', { class: 'tag' }, '맨 위: ' + fmt(top)) : h('span', { class: 'tag' }, '비어있음'), h('span', { class: 'muted small' }, ` 버림 ${deck.discard.length}`)); el.title = '덱 구성: ' + summarize(deck.cards) + ' / 버림: ' + summarize(deck.discard); return el; }
const tierL = t => typeof t === 'number' ? 'I'.repeat(t) : '★';
function summarize(cards) { const c = {}; for (const x of cards) c[x.tier] = (c[x.tier] || 0) + 1; return Object.entries(c).map(([t, n]) => `${tierL(isNaN(+t) ? t : +t)}×${n}`).join(' ') || '-'; }
function renderTitans() {
  const el = $('#titans'); if (!el) return; el.innerHTML = '';
  game.titans.forEach((t, i) => {
    const tier = game.tierFor(t, t.danger || 1);
    const card = h('div', { class: 'tp c' + i + (t.alive ? '' : ' dead') + (ui.pending?.q?.titan === t ? ' active' : '') },
      h('div', { class: 'tphead' }, h('b', {}, t.name), h('span', { class: 'muted small link', onclick: () => openModal(titanCard(t.cls)) }, ` ${t.def.name} · ${t.offBoard ? '보드 밖' : cellLabel(t.pos)}`), t.pt ? h('span', { class: 'tag' }, 'PT') : null, t.absorbed ? h('span', { class: 'tag' }, 'Absorbed') : null, t.impaled ? h('span', { class: 'tag warn' }, 'Impaled') : null, t.stair ? h('span', { class: 'tag warn' }, `Endless Staircase ${t.stair}/${game.stairLen()}`) : null, t.floating ? h('span', { class: 'tag warn' }, 'Float') : null, t.sisyphean ? h('span', { class: 'tag link', onclick: () => openModal(condCard('Sisyphean')) }, `Sisyphean Lv${t.sisLevel || 1}`) : null, game.isBurden && t.alive && game.tetherExcess(t) > 0 ? h('span', { class: 'tag warn' }, `밧줄 초과 +${game.tetherExcess(t)}${game.untethered(t) ? ' (Chasm)' : ''}`) : null, t.knockdown ? h('span', { class: 'tag warn' }, t.knockdown === 'falling' ? '넘어짐' : '일어나는 중') : null, t.hidden ? h('span', { class: 'tag' }, 'Hidden') : null, t.def.abilities['Ascend!'] ? h('span', { class: 'tag' }, `Ascend ${t.ascend || 0}`) : null, t.def.abilities['Wish Engine'] ? h('span', { class: 'tag', title: 'Wish Engine 토큰: 1 Precision+1 · 2 Auto-break 1 · 3 Block 1 · 4 Power+1 · 5 이동 액션 · 6 전투 액션 · 7 각성' }, `Wish Engine ${t.genTok || 0}`) : null, t.def.abilities['Carry the Weight'] ? h('span', { class: 'tag', title: 'Carry the Weight 토큰: 1 Hermes Move+1 · 2 Float 무시 · 3 Condition 버림 · 4 Power+1 · 5 이동 액션 · 6 Curse 제거 · 7 각성' }, `Carry the Weight ${t.genTok || 0}`) : null, t.def.abilities['Forgotten Curse'] ? h('span', { class: 'tag' + (t.forgottenUsed ? ' warn' : '') }, t.forgottenUsed ? 'Forgotten Curse 사용됨' : 'Forgotten Curse 가능') : null, t.def.abilities['Advanced Reflex'] && t.advReflexRound === game.round ? h('span', { class: 'tag warn' }, 'Advanced Reflex 사용됨') : null, t.fatigue ? h('span', { class: 'tag warn' }, t.fatigue === 'move' ? 'Movement Fatigue' : 'Combat Fatigue') : null, t.def.abilities['Cheat Fate'] ? h('span', { class: 'tag' + (t.cheatUsed ? ' warn' : '') }, t.cheatNext ? `Cheat Fate: 다음 Obol = ${t.cheatNext === 'live' ? 'You Live!' : 'You Died'}` : t.cheatUsed ? 'Cheat Fate 사용됨' : 'Cheat Fate 가능') : null, t.onVP ? h('span', { class: 'tag' }, game.prim.def.sunD ? `VP ${'I'.repeat(t.vpLevel || 1)}` : 'VP 탑승') : null, t.offBoard === 'omega' ? h('span', { class: 'tag bad link', onclick: () => openModal(condCard('Omega Terminus')) }, 'Omega Terminus') : null, t.offBoard === 'clock' ? h('span', { class: 'tag warn link', onclick: () => openModal(condCard('Time-clocked')) }, `Time-clocked ${t.clockSide === 'arriving' ? '(Arriving)' : '(Departing)'} · 보드 밖`) : null, game.anchors && t.alive ? h('span', { class: 'tag' + (game.anchors[t.id] ? '' : ' bad') }, game.anchors[t.id] ? `⚓ ${cellLabel(game.anchors[t.id])}` : '⚓ 없음') : null, t.mazetouched ? h('span', { class: 'tag warn' }, 'Mazetouched') : null, ...(t.fated || []).map(n => { const f = (AR.fatedMnemos || []).find(x => x.name === n); return h('span', { class: 'tag bad link', title: f ? f.text : '', onclick: () => f && openModal(h('div', { class: 'cardview mn' }, h('div', { class: 'cv-title' }, f.name, h('span', { class: 'tag bad' }, 'FATED')), h('div', { class: 'cv-text' }, f.text))) }, n); }), t.castoffBuff ? h('span', { class: 'tag' }, 'Castoff 버프') : null, (t.ambrosia || game.prim.id === 'pursuer') ? h('span', { class: 'tag' + (t.ambrosia >= game.ambLimit(t) ? ' bad' : '') }, `Ambrosia ${t.ambrosia}/${game.ambLimit(t)}`) : null, t.alive && game.inBlindspot(t) ? h('span', { class: 'tag' }, 'Blindspot') : null, t.mayIgnoreResp ? h('span', { class: 'tag' }, '응답 무시 가능') : null, !t.alive ? h('span', { class: 'tag bad' }, t.erased ? '존재에서 지워짐' : '사망') : null),
      h('div', { class: 'trisk' }, stat('Danger', t.danger, 'd', t.danger ? tier : ''), stat('Rage', t.rage, 'r'), stat('Fate', t.fate, 'f')),
      h('div', { class: 'gear' }, ...t.gear.map(g => h('span', { class: 'g link' + (g.exhausted ? ' ex' : '') + (g.lost ? ' gone' : '') + (g.blank ? ' gated' : '') + (g.card.danger && Object.keys(g.card.danger).some(k => t.danger >= parseInt(k)) ? ' gated' : ''), title: game.gearText(g, t), onclick: () => openModal(gearCard(g.card, t)) }, `${SLOT_ICON[g.card.slot]} ${g.card.name}${g.alt ? ' ⇄' : ''}${g.card.atk != null ? ` ◆${g.card.atk}${g.card.prec ? (g.card.prec > 0 ? '+' : '') + g.card.prec : ''}` : ''}${g.charges ? ` (${g.charges})` : ''}${g.midas ? ` 🪙${g.midas}${game.aurified(t, g) ? ' Aurified' : ''}` : ''}`))),
      (t.moirosHeld || []).length ? h('div', { class: 'small warn' }, `Moiros 보유: ${t.moirosHeld.map(c => c.name).join(', ')} (두 번째 Moiros를 뽑으면 사망)`) : null, (t.kratosHeld || []).length ? h('div', { class: 'small warn' }, `Kratos 보유: ${t.kratosHeld.join(', ')} (두 번째 Kratos를 뽑으면 사망)`) : null, t.conditions.length || t.tokens.precision || t.tokens.evasion || t.despair ? h('div', { class: 'small warn' }, ...t.conditions.flatMap(c => [h('span', { class: 'link', onclick: () => openModal(condCard(c)) }, c === 'Bleeding' ? `Bleeding ${t.bleeding || 0}/${t.def.bleedingLimit || 4}` : c === 'Death' ? `Death 토큰 ${t.deathTokens || 0}` : c), ' · ']), [t.despair ? `Despair ${t.despair}${game.despairEff(t) ? ` (홀로: ${['', 'Precision −1', 'Precision −3', '공격 불가'][Math.min(3, game.despairEff(t))]})` : ' (인접 — 페널티 없음)'}` : null, t.tokens.precision ? `Precision ${t.tokens.precision > 0 ? '+' : ''}${t.tokens.precision}` : null, t.tokens.evasion ? `Evasion +${t.tokens.evasion}` : null].filter(Boolean).join(' · ')) : null,
      t.godform ? h('div', { class: 'gear' }, h('span', { class: 'g godchip link', onclick: () => openModal(godCard(t.godform.def, t.godform.trespass)) }, `🔱 ${t.godform.def.name} — Trespass ${t.godform.trespass}${t.godform.fromObol ? ' (Obol 각성)' : ''}`)) : null,
      t.mnemos.length ? h('div', { class: 'gear' }, ...t.mnemos.map(m => h('span', { class: 'g mnchip link' + (m.exhausted ? ' ex' : '') + (m.discarded ? ' gone' : ''), onclick: () => openModal(mnemosCard(m.card, m.level, t.danger)) }, `🜂 ${m.card.name} L${m.level}`))) : null,
      h('div', { class: 'small muted' }, `${t.argonaut.name} · ` + Object.entries(t.argonaut.skills).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ')),
      h('div', { class: 'small muted' }, 'Kratos: ' + game.kratosRows(t).map(r => `${r.level}:${r.options.map(o => o.join('+')).join('/')}`).join('  ')));
    el.append(card);
  });
}
function stat(name, v, cls, sub) { return h('div', { class: 'stat ' + cls }, h('div', { class: 'sn' }, name), h('div', { class: 'sv' }, v), sub ? h('div', { class: 'ss' }, sub) : null); }

renderLoadout($('#app'));

// ---------- searchable keyword glossary (loadout + battle) ----------
(function kwGlossary() {
  const entries = () => {
    const out = []; const add = (name, text, src) => { if (name && text) out.push({ name, text: String(text), src }); };
    for (const [k, v] of Object.entries(DATA.gear.keywords || {})) add(k, v, '키워드');
    for (const [k, v] of Object.entries(DATA.titans.kratosAbilities || {})) add(k, v, 'Kratos');
    for (const c of Object.values(DATA.titans.classes || {})) for (const [k, v] of Object.entries(c.abilities || {})) add(k, v, c.name);
    for (const [k, v] of Object.entries(DATA.decks.conditions || {})) add(k, [v.text, v.faceYourFear, v.endOfBattle].filter(Boolean).join(' / '), 'Condition');
    try { const P = (typeof game !== 'undefined' && game && game.prim) ? game.prim.def : (typeof loadout !== 'undefined' && loadout ? DATA.primordials[loadout.primordial] : null); if (P) { for (const [k, v] of Object.entries(P.traits || {})) add(k, v, P.name + ' Trait'); } } catch (e) {}
    return out;
  };
  const btn = h('button', { class: 'kwbtn', title: '키워드 정의 검색' }, '📖 키워드');
  const box = h('div', { class: 'kwbox', style: 'display:none' });
  const inp = h('input', { placeholder: '키워드 검색 (이름 또는 내용)', class: 'kwinp' });
  const list = h('div', { class: 'kwlist' });
  const draw = () => { const q = inp.value.trim().toLowerCase(); const all = entries(); const seen = new Set(); const f = all.filter(e => { const key = e.name + '|' + e.text; if (seen.has(key)) return false; seen.add(key); return !q || e.name.toLowerCase().includes(q) || e.text.toLowerCase().includes(q); }); f.sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)); list.replaceChildren(...f.slice(0, 120).map(e => h('div', { class: 'kwitem' }, h('b', {}, e.name), h('span', { class: 'kwsrc' }, ' ' + e.src), h('div', {}, e.text)))); if (!f.length) list.append(h('div', { class: 'small' }, '결과 없음')); };
  inp.addEventListener('input', draw);
  btn.addEventListener('click', () => { const open = box.style.display === 'none'; box.style.display = open ? '' : 'none'; if (open) { draw(); inp.focus(); } });
  box.append(h('div', { class: 'row' }, inp, h('button', { onclick: () => { box.style.display = 'none'; } }, '닫기')), list);
  const st = h('style', {}, '.kwbtn{position:fixed;right:14px;bottom:14px;z-index:9998;padding:6px 10px;border-radius:8px;border:1px solid #888;background:#222;color:#eee;cursor:pointer}.kwbox{position:fixed;right:14px;bottom:52px;z-index:9999;width:min(440px,calc(100vw - 28px));max-height:70vh;display:flex;flex-direction:column;background:#1b1b1b;color:#eee;border:1px solid #666;border-radius:10px;padding:8px;box-shadow:0 6px 24px rgba(0,0,0,.5)}.kwinp{flex:1;padding:5px;background:#111;color:#eee;border:1px solid #555;border-radius:6px}.kwlist{overflow:auto;margin-top:6px}.kwitem{padding:5px 2px;border-bottom:1px solid #333;font-size:13px;line-height:1.35}.kwsrc{color:#9a9;font-size:11px}');
  const mount = () => { document.head.append(st); document.body.append(btn, box); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();

// ---------- Primordial info viewer (audit-page style, floating button) ----------
(() => {
  const curPrim = () => { try { if (typeof game !== 'undefined' && game && game.prim) return game.prim.def.id || Object.keys(DATA.primordials).find(k => DATA.primordials[k] === game.prim.def); } catch (e) {} try { if (typeof loadout !== 'undefined' && loadout) return loadout.primordial; } catch (e) {} return Object.keys(DATA.primordials)[0]; };
  const page = id => __PRIMVIEW__.replace('__H__', () => JSON.stringify(DATA.primordials[id]).replace(/</g, '\\u003c'));
  const btn = h('button', { class: 'pvbtn', title: '프라이모디얼 정보 (레벨 · 트레이트 · AI · BP)' }, '👁 프라이모디얼');
  const sel = h('select', {}, ...Object.keys(DATA.primordials).map(k => h('option', { value: k }, DATA.primordials[k].name)));
  const frame = h('iframe', { class: 'pvframe' });
  const box = h('div', { class: 'pvbox', style: 'display:none' }, h('div', { class: 'row', style: 'gap:8px;align-items:center' }, h('b', {}, '프라이모디얼 정보'), sel, h('span', { style: 'flex:1' }), h('button', { onclick: () => { box.style.display = 'none'; } }, '닫기')), frame);
  const show = id => { sel.value = id; frame.srcdoc = page(id); };
  sel.addEventListener('change', () => show(sel.value));
  btn.addEventListener('click', () => { const open = box.style.display === 'none'; box.style.display = open ? 'flex' : 'none'; if (open) show(curPrim() || sel.value); });
  const st = h('style', {}, '.pvbtn{position:fixed;right:118px;bottom:14px;z-index:9998;padding:6px 10px;border-radius:8px;border:1px solid #888;background:#222;color:#eee;cursor:pointer}.pvbox{position:fixed;inset:24px;z-index:9999;flex-direction:column;gap:8px;padding:10px;background:#1b1b1b;color:#eee;border:1px solid #666;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5)}.pvframe{flex:1;width:100%;border:0;border-radius:6px;background:#fff}@media (max-width:600px){.pvbox{inset:6px}}');
  const mount = () => { document.head.append(st); document.body.append(btn, box); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();

