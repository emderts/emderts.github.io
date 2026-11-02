// Kingdoms Forlorn — Rogue's Path: UI (vanilla JS, single page, mobile-first).
import { Clash } from '../engine/clash.js';
import { Campaign } from '../engine/campaign.js';
import { DIRS, inFront, rearCells } from '../engine/board.js';

const DATA = window.KF_DATA;
const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v); for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const SAVE_KEY = 'kf.rogues.campaign';

const app = $('#app');
const _rc = app.replaceChildren.bind(app); app.replaceChildren = (...kids) => _rc(...kids.flat().filter(k => k != null));
let screen = 'home'; let clash = null; let camp = null; let pending = null; let tab = 'log'; let seedInput = ''; let selNode = null; let mapScale = Math.min(1, Math.max(.55, (window.innerWidth - 30) / 700)); let outpostKnight = 0; let flash = '';
let raf = 0; const scheduleRender = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); };
const askViaSheet = q => new Promise(res => { pending = { q, res }; render(); });
const save = () => { if (!camp) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(camp.serialize())); } catch (e) { } };
const loadSaved = () => { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };

// ---------- home ----------
const renderHome = () => {
  const mons = Object.values(DATA.monsters); const saved = loadSaved();
  app.replaceChildren(
    h('h1', {}, "Kingdoms Forlorn — Rogue's Path"),
    h('p', { class: 'sub' }, `웹 싱글플레이 · v${DATA.meta.version} · 빌드 ${DATA.meta.builtAt.slice(0, 16).replace('T', ' ')} UTC`),
    h('div', { class: 'card' },
      h('h2', {}, 'Rogue\'s Path 캠페인'),
      h('p', { class: 'small muted' }, `기사 4명(Fleischritter ×4 — 다른 기사는 데이터 입력 후), Rosegraal 103 노드. 구현된 몬스터: ${mons.map(m => m.name).join(', ')} — 표에 그 몬스터가 없는 노드는 아직 선택 불가.`),
      h('div', { class: 'row' },
        saved ? h('button', { class: 'primary', onclick: () => { camp = Campaign.restore(DATA, saved); camp.ask = askViaSheet; screen = 'map'; render(); } }, `이어하기 (라운드 ${saved.round}, 노드 ${saved.crossed.length - 1}/102)`) : null,
        h('button', { class: saved ? '' : 'primary', onclick: newCampaign }, '새 캠페인'),
        h('button', { onclick: () => { const t = prompt('저장 JSON 붙여넣기'); if (!t) return; try { camp = Campaign.restore(DATA, JSON.parse(t)); camp.ask = askViaSheet; save(); screen = 'map'; render(); } catch (e) { alert('불러오기 실패: ' + e.message); } } }, 'JSON 가져오기'),
      ),
    ),
    h('div', { class: 'card' },
      h('h2', {}, 'Clash 단독 테스트'),
      h('div', { class: 'row' },
        h('label', {}, '몬스터 ', h('select', { id: 'mon' }, mons.map(m => h('option', { value: m.id }, m.name)))),
        h('label', {}, '레벨 ', h('select', { id: 'lv' }, [1, 2, 3, 4].map(l => h('option', { value: l }, `Lv ${l}`)))),
        h('label', {}, '시드 ', h('input', { id: 'seed', type: 'number', placeholder: '무작위', style: 'width:110px', value: seedInput })),
        h('button', { onclick: startTestClash }, 'Clash 시작'),
      ),
    ),
    h('p', { class: 'small muted' }, h('a', { href: '../' }, '← ATO Mnestis Theatre')),
  );
};
const newCampaign = () => { if (loadSaved() && !confirm('저장된 캠페인을 덮어씁니다. 계속할까요?')) return; camp = new Campaign(DATA, { seed: Math.floor(Math.random() * 1e9), knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter' })), ask: askViaSheet, ownedMonsters: null }); save(); screen = 'map'; render(); };
const startTestClash = () => {
  const seed = +$('#seed').value || Math.floor(Math.random() * 1e9); seedInput = String(seed);
  clash = new Clash({ data: DATA, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'Fleischritter ' + (i + 1) })), monster: $('#mon').value, level: +$('#lv').value, kingdom: 'principality', seed, listeners: { log: () => scheduleRender() } });
  clash.ask = askViaSheet; clash.setup(); screen = 'clash'; tab = 'log'; render();
  clash.run().then(() => { pending = null; render(); });
};

// ---------- campaign: map ----------
const partyBar = () => h('div', { class: 'row', style: 'margin:0 0 6px' },
  h('b', { style: 'color:var(--gold)' }, `라운드 ${camp.round}`), h('span', { class: 'tag' }, `부활 ${camp.resurrections}`), h('span', { class: 'tag' }, `노드 ${camp.crossed.length - 1}/102`),
  camp.knights.map(k => h('span', { class: 'tag' + (k.dead ? ' err' : '') }, `${k.name.replace('Fleischritter', 'F')} ${k.gold}G${k.sigh ? ' ✦' : ''}${k.dead ? ' ☠' : ''}`)),
  h('span', { style: 'flex:1' }),
  h('button', { class: 'sm', onclick: () => { save(); flash = '저장됨'; render(); setTimeout(() => { flash = ''; render(); }, 1200); } }, '저장'),
  h('button', { class: 'sm', onclick: () => { screen = 'outpost'; render(); } }, 'Outpost'),
  h('button', { class: 'sm', onclick: () => { screen = 'camplog'; render(); } }, '로그'),
  h('button', { class: 'sm', onclick: () => { save(); screen = 'home'; render(); } }, '홈'),
);
const renderMapSvg = () => {
  const M = camp.map; const [W, H] = M.size; const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, style: `width:${W * mapScale}px;height:${H * mapScale}px;display:block` });
  s.append(svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#1a1714' }));
  s.append(svg('line', { x1: W / 2, y1: 0, x2: W / 2, y2: H, stroke: '#3a3128', 'stroke-dasharray': '6 6' }));
  s.append(svg('text', { x: 20, y: 30, fill: '#6f8f8a', 'font-size': 18 }, 'SUNKEN KINGDOM')); s.append(svg('text', { x: W - 260, y: 30, fill: '#9a8c78', 'font-size': 18 }, 'PRINCIPALITY OF STONE'));
  const pos = Object.fromEntries(M.nodes.map(n => [n.id, n.pos])); const avail = new Set(camp.availableNodes().map(n => n.id));
  for (const e of M.edges) { const done = camp.crossed.includes(e.a) && camp.crossed.includes(e.b); const open = (camp.crossed.includes(e.a) && avail.has(e.b)) || (camp.crossed.includes(e.b) && avail.has(e.a)); s.append(svg('line', { x1: pos[e.a][0], y1: pos[e.a][1], x2: pos[e.b][0], y2: pos[e.b][1], stroke: done ? '#c9a85a' : open ? '#8a7446' : '#4a4036', 'stroke-width': done ? 4 : 2.5 })); }
  for (const n of M.nodes) {
    const [x, y] = n.pos; const crossed = camp.crossed.includes(n.id); const av = avail.has(n.id); const playable = n.id === 'S' || camp.nodePlayable(n); const r = n.id === 'S' ? 30 : 22;
    const g = svg('g', { style: av ? 'cursor:pointer' : '' });
    g.append(svg('circle', { cx: x, cy: y, r, fill: crossed ? '#3b3020' : n.kingdom === 'sunken' ? '#24403c' : '#3a3128', stroke: selNode === n.id ? '#fff' : av ? '#c9a85a' : '#6b5a44', 'stroke-width': av ? 4 : 2, 'stroke-dasharray': av && !playable ? '4 4' : null, opacity: crossed ? .7 : 1 }));
    g.append(svg('text', { x, y: y + 6, fill: crossed ? '#7a6a4a' : '#f0e6d2', 'font-size': 17, 'font-weight': 700, 'text-anchor': 'middle' }, n.id === 'S' ? 'S' : ROMAN[n.level]));
    if (n.reward) { g.append(svg('rect', { x: x + 14, y: y - 30, width: 18, height: 18, rx: 3, fill: { C: '#5a4630', H: '#3a6a3c', P: '#5a2a3a', T: '#2f4f7a', G: '#222', V: '#8a8a9a', W: '#6a2a7a', S: '#2a7a8a' }[n.reward] || '#444', stroke: '#000' })); g.append(svg('text', { x: x + 23, y: y - 17, fill: '#fff', 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle' }, n.reward)); }
    if (crossed && n.id !== 'S') { g.append(svg('line', { x1: x - 14, y1: y - 14, x2: x + 14, y2: y + 14, stroke: '#c9a85a', 'stroke-width': 3 })); g.append(svg('line', { x1: x - 14, y1: y + 14, x2: x + 14, y2: y - 14, stroke: '#c9a85a', 'stroke-width': 3 })); }
    if (av) g.addEventListener('click', () => { selNode = n.id; render(); });
    s.append(g);
  }
  return s;
};
const monsterOptions = n => camp.tables.levels[String(n.level)][n.kingdom].map(r => ({ ...r, name: camp.tables.monsterNames[r.monster], ok: (!camp.owned || camp.owned.includes(r.monster)) && !!DATA.monsters[r.monster] }));
let mapScroll = null;
const renderMap = () => {
  const n = selNode ? camp.node(selNode) : null; const playable = n && camp.nodePlayable(n);
  const prev = $('#mapwrap'); if (prev) mapScroll = { l: prev.scrollLeft, t: prev.scrollTop };
  app.replaceChildren(
    partyBar(), flash ? h('div', { class: 'good small' }, flash) : null,
    camp.result ? h('div', { class: 'card ' + (camp.result === 'win' ? 'good' : 'err') }, camp.result === 'win' ? '🏆 Rosegraal 완료 — 캠페인 승리!' : '☠ 캠페인 패배 — 기사와 부활이 모두 소진되었습니다.') : null,
    h('div', { class: 'row' }, h('span', { class: 'small muted' }, '금색 테두리 = 선택 가능 · 점선 = 몬스터 데이터 없음 · ✕ = 완료'), h('span', { style: 'flex:1' }), h('button', { class: 'sm', onclick: () => { mapScale = Math.min(3, mapScale * 1.3); render(); } }, '＋'), h('button', { class: 'sm', onclick: () => { mapScale = Math.max(.25, mapScale / 1.3); render(); } }, '－')),
    h('div', { id: 'mapwrap', style: 'overflow:auto;border:1px solid var(--line);border-radius:10px;max-height:55vh;touch-action:pan-x pan-y pinch-zoom' }, renderMapSvg()),
    n ? h('div', { class: 'card' },
      h('div', {}, h('b', {}, `${n.id} — ${n.kingdom === 'sunken' ? 'Sunken Kingdom' : 'Principality of Stone'} · Lv ${ROMAN[n.level]} (${camp.tierOf(n.level)} 티어)`)),
      h('div', { class: 'small' }, `부활 +${n.res} · 보상: ${camp.rewards.kinds[n.reward] || camp.map.rewardCodes[n.reward] || n.reward}`),
      h('div', { class: 'small muted' }, '몬스터 표: ', monsterOptions(n).map(r => h('span', { class: 'tag', style: r.ok ? '' : 'opacity:.45;text-decoration:line-through' }, `${r.roll.join('–')} ${r.name} L${r.level}`))),
      h('div', { class: 'row' }, h('button', { class: 'primary', disabled: !playable || !!camp.result || !!camp.current, onclick: () => { camp.chooseNode(n.id); save(); screen = 'encounter'; render(); } }, playable ? '이 노드로 출정 (d10 굴림)' : '구현된 몬스터 없음'), h('button', { onclick: () => { selNode = null; render(); } }, '닫기')),
    ) : h('p', { class: 'small muted' }, '노드를 탭하면 정보가 표시됩니다. 크로스아웃된 노드에 인접한 노드만 선택할 수 있습니다.'),
  );
  const wrap = $('#mapwrap'); if (wrap) { if (mapScroll) { wrap.scrollLeft = mapScroll.l; wrap.scrollTop = mapScroll.t; } else { const S = camp.node('S'); wrap.scrollLeft = S.pos[0] * mapScale - wrap.clientWidth / 2; wrap.scrollTop = S.pos[1] * mapScale - wrap.clientHeight / 2; mapScroll = { l: wrap.scrollLeft, t: wrap.scrollTop }; } }
};
const renderEncounter = () => {
  const cur = camp.current; const n = camp.node(cur.nodeId);
  app.replaceChildren(partyBar(),
    h('div', { class: 'card' },
      h('h2', {}, `${n.id} · Lv ${ROMAN[n.level]} — d10 ${cur.roll.join(' → ')}`),
      h('p', {}, h('b', { style: 'font-size:20px;color:var(--rose)' }, `${cur.monsterName} Lv${cur.level}`)),
      h('p', { class: 'small muted' }, 'Clash 전에 Outpost(상점·용병·장비 구성)를 방문할 수 있습니다. 이번 라운드의 상점 티어 = 이 노드의 티어.'),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: startCampaignClash }, 'Clash 시작'), h('button', { onclick: () => { screen = 'outpost'; render(); } }, 'Outpost'), h('button', { onclick: () => { screen = 'map'; render(); } }, '지도')),
    ));
};
const startCampaignClash = () => {
  clash = camp.buildClash({ ask: askViaSheet, listeners: { log: () => scheduleRender() } }); clash.setup(); screen = 'clash'; tab = 'log'; render();
  clash.run().then(async () => { pending = null; render(); const res = await camp.aftermath(clash); pending = null; save(); if (res === 'replay') { startCampaignClash(); return; } screen = 'aftermath'; render(); });
};
const renderAftermath = () => {
  const last = camp.history.at(-1); const logs = camp.log.filter(l => l.round === camp.round);
  app.replaceChildren(partyBar(), h('div', { class: 'card' }, h('h2', {}, `라운드 ${camp.round} 결과 — ${last ? (last.result === 'win' ? '승리' : '패배') : ''}`), h('div', { class: 'log' }, logs.map(l => h('div', { class: l.kind }, l.msg))),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { screen = 'map'; selNode = null; render(); } }, '지도로'), h('button', { onclick: () => { screen = 'outpost'; render(); } }, 'Outpost'))));
};
const renderCampLog = () => app.replaceChildren(partyBar(), h('div', { class: 'card log' }, camp.log.slice(-300).map(l => h('div', { class: l.kind }, `[R${l.round}] ${l.msg}`))), h('button', { onclick: () => { screen = 'map'; render(); } }, '지도로'));

// ---------- outpost ----------
const renderOutpost = () => {
  const tierLevel = camp.current ? camp.current.nodeLevel : (camp.history.at(-1) ? camp.node(camp.history.at(-1).node).level : 1);
  const ks = camp.knights.filter(k => !k.dead); if (outpostKnight >= ks.length) outpostKnight = 0; const k = ks[outpostKnight]; const def = camp.knightDef(k);
  const gearRow = name => { const g = camp.gearDef(name); if (!g) return h('div', { class: 'small err' }, name + ' (데이터 없음)'); const on = k.loadout.gear.includes(name); return h('label', { class: 'row', style: 'margin:3px 0' }, h('input', { type: 'checkbox', checked: on, disabled: name === 'Knighves', onchange: e => { const next = e.target.checked ? [...k.loadout.gear.filter(x => x !== 'Knighves'), name] : k.loadout.gear.filter(x => x !== name && x !== 'Knighves'); try { camp.setLoadoutGear(k, next); } catch (err) { alert(err.message); } save(); render(); } }), h('span', {}, h('b', {}, name), (g.traits && g.traits.length ? h('i', { class: 'small muted' }, ' ' + g.traits.join(', ')) : ''), ` — ${g.type}${g.hands ? ' ' + g.hands + 'H' : ''} · ${g.tier}`, g.attackDice != null ? ` · ⚔${g.attackDice} +${g.precision}` : '', g.armorDice ? ' · Armor ' + Object.entries(g.armorDice).map(([c, n]) => n + c[0]).join('') : '', g.evasion ? ` · Eva+${g.evasion}` : ''), h('div', { class: 'small muted' }, (g.text || '').split('\n').join(' / ')), g.reforgedName && camp.data.gear.merchant_principality.gear.some(m => m.name === name) ? h('button', { class: 'sm', onclick: () => { try { camp.reforge(k, name); } catch (err) { alert(err.message); } save(); render(); } }, `재련 → ${g.reforgedName} (${g.reforgePrice}G)`) : null); };
  const techRow = name => { const t = def.techniques.find(t => t.name === name); const on = k.loadout.techniques.includes(name); return h('label', { class: 'row', style: 'margin:3px 0' }, h('input', { type: 'checkbox', checked: on, onchange: e => { const next = e.target.checked ? [...k.loadout.techniques, name] : k.loadout.techniques.filter(x => x !== name); try { camp.setLoadoutTechniques(k, next); } catch (err) { alert(err.message); } save(); render(); } }), h('span', {}, h('b', {}, name), h('span', { class: 'small muted' }, ` — ${t ? t.text : ''}${t && t.exert ? ` · Exert: ${t.exert.token === 'PowerReroll' ? 'Power Re-roll' : t.exert.token} (${t.exert.depletion})` : ''}`))); };
  const sel = (label, key, opts, val) => h('label', { class: 'row' }, label, h('select', { onchange: e => { camp.setLoadoutCards(k, { [key]: e.target.value }); save(); render(); } }, opts.map(o => h('option', { value: o.value, selected: o.value === val }, o.label))));
  app.replaceChildren(partyBar(),
    h('div', { class: 'card' }, h('h2', {}, `Outpost — Half-ruined Keep (상점 티어 ≤ ${camp.tierOf(tierLevel)})`),
      h('div', { class: 'tabs' }, ks.map((kk, i) => h('button', { class: i === outpostKnight ? 'on' : '', onclick: () => { outpostKnight = i; render(); } }, `${kk.name} ${kk.gold}G`))),
      h('div', { class: 'pane', style: 'max-height:none' },
        h('h3', {}, '카드 구성'),
        sel('Portrait ', 'portrait', k.unlocked.portraits.map(p => ({ value: p, label: def.portraits.find(x => x.id === p).name })), k.loadout.portrait),
        sel('Heroic Arc ', 'heroicArc', k.unlocked.heroicArcs.map(a => ({ value: a, label: a })), k.loadout.heroicArc),
        sel('Peril Arc ', 'perilArc', k.unlocked.perilArcs.map(a => ({ value: a, label: a })), k.loadout.perilArc),
        sel('Talent ', 'talent', k.unlocked.talents.map(a => ({ value: a, label: a })), k.loadout.talent),
        h('h3', {}, `Technique 손패 (${k.loadout.techniques.length}/${camp.handLimit(k)})`), k.unlocked.techniques.map(techRow),
        h('h3', {}, 'Gear (손 2 · 갑옷 1 · 보조 2)'), ['Knighves', ...k.armory.filter(n => n !== 'Knighves')].map(gearRow),
        h('p', { class: 'small muted' }, `Virtues: ${Object.entries(k.virtues).map(([v, n]) => v + ' ' + n).join(', ')} · Bane ${k.bane} · Sigh ${k.sigh} · 획득 보상 ${k.claimed.length}`),
      )),
    h('div', { class: 'card' }, h('h2', {}, 'Merchant\'s Workshop'), h('div', { class: 'grid2' }, camp.merchantDeck(tierLevel).map(g => h('div', { class: 'kbox' }, h('b', {}, g.name), h('div', { class: 'small muted' }, h('i', {}, (g.traits || []).join(', '))), ` ${g.price}G · ${g.tier} · ${g.type}${g.hands ? ' ' + g.hands + 'H' : ''}`, h('div', { class: 'small muted' }, (g.side.text || '').split('\n').join(' / ')), h('button', { class: 'sm', disabled: k.gold < g.price, onclick: () => { try { camp.buyGear(k, g.name, tierLevel); } catch (err) { alert(err.message); } save(); render(); } }, `${k.name.replace('Fleischritter', 'F')} 구매`))))),
    h('div', { class: 'card' }, h('h2', {}, `Mercenary Guild (고용 ${camp.hired.length}/4)`), h('div', {}, camp.hired.map(m => h('span', { class: 'tag' }, `${m.class} L${m.level} (${m.side}면)`))), h('div', { class: 'grid2' }, camp.mercPool.map(m => { const md = camp.data.decks.mercenaries.mercenaries.find(x => x.class === m.class && x.level === m.level); return h('div', { class: 'kbox' }, h('b', {}, `${m.class} L${m.level ?? '-'}`), ` ${m.cost}G`, h('div', { class: 'small muted' }, 'A: ' + md.sideA.clash), h('div', { class: 'small muted' }, 'B: ' + md.sideB.clash), h('button', { class: 'sm', disabled: k.gold < m.cost || camp.hired.length >= 4 || camp.hired.some(x => x.class === m.class), onclick: () => { try { camp.hire(k, m.class, m.level); } catch (err) { alert(err.message); } save(); render(); } }, `${k.name.replace('Fleischritter', 'F')}이 고용`)); })), h('p', { class: 'small muted' }, '용병 Clash 능력은 전투 중 "몬스터" 탭에서 수동으로 발동(카드 뒤집기/버리기)합니다.')),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { camp.endOutpost(); save(); screen = camp.current ? 'encounter' : 'map'; render(); } }, '나가기')),
  );
};

// ---------- board ----------
const renderBoard = () => {
  const B = clash.board; const CW = 10, PAD = 4; const W = B.cols * CW + PAD * 2, H = B.rows * CW + PAD * 2;
  const x = c => PAD + (c - 1) * CW, y = r => PAD + (B.rows - 1 - r) * CW;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bsvg' });
  const M = clash.monster; const front = new Set(), rear = new Set(rearCells(B, M.cells, M.facing).map(c => B.key(c)));
  for (let r = 0; r < B.rows; r++) for (let c = 1; c <= B.cols; c++) { const cell = { c, r }; if (inFront(B, M.cells, M.facing, cell)) front.add(B.key(cell)); }
  const selCells = pending && pending.q.type === 'move' ? pending.q.cells : [];
  for (let r = 0; r < B.rows; r++) for (let c = 1; c <= B.cols; c++) {
    const cell = { c, r }; const k = B.key(cell); const sel = selCells.find(x => x.c === c && x.r === r);
    const rect = svg('rect', { x: x(c), y: y(r), width: CW, height: CW, class: 'cell' + ((c + r) % 2 ? ' alt' : '') + (rear.has(k) ? ' rear' : front.has(k) ? ' front' : '') + (sel ? ' sel' : '') });
    if (sel) rect.addEventListener('click', () => answer(sel));
    s.append(rect);
  }
  for (let r = 0; r < B.rows; r++) s.append(svg('text', { x: PAD - 2, y: y(r) + CW * .65, class: 'coord' }, B.rowLabels[r]));
  for (let c = 1; c <= B.cols; c++) s.append(svg('text', { x: x(c) + CW / 2, y: H - 1, class: 'coord' }, c));
  for (const [key, t] of B.terrain) { const [c, r] = key.split(',').map(Number); s.append(svg('rect', { x: x(c) + 1.5, y: y(r) + 1.5, width: CW - 3, height: CW - 3, rx: 1.5, class: 'ter' })); s.append(svg('text', { x: x(c) + CW / 2, y: y(r) + CW * .68, class: 'lbl' }, t.id[0].toUpperCase())); }
  const mc = M.cells; const minC = Math.min(...mc.map(c => c.c)), maxC = Math.max(...mc.map(c => c.c)), minR = Math.min(...mc.map(c => c.r)), maxR = Math.max(...mc.map(c => c.r));
  s.append(svg('rect', { x: x(minC) + 1, y: y(maxR) + 1, width: (maxC - minC + 1) * CW - 2, height: (maxR - minR + 1) * CW - 2, rx: 2, class: 'mon' }));
  const cx = x(minC) + (maxC - minC + 1) * CW / 2, cy = y(maxR) + (maxR - minR + 1) * CW / 2; const d = DIRS[M.facing];
  s.append(svg('polygon', { points: `${cx + d.c * 7},${cy - d.r * 7} ${cx - d.r * 3 + d.c * 2},${cy - d.c * 3 - d.r * 2} ${cx + d.r * 3 + d.c * 2},${cy + d.c * 3 - d.r * 2}`, fill: '#ffd27a' }));
  s.append(svg('text', { x: cx, y: cy + 1.8, class: 'lbl' }, M.name[0]));
  for (const k of clash.knights) { if (!k.pos || !k.alive) continue; const dead = !k.alive, kd = clash.knockedDown(k); s.append(svg('circle', { cx: x(k.pos.c) + CW / 2, cy: y(k.pos.r) + CW / 2, r: CW * .4, class: 'kn' + (dead ? ' dead' : '') + (kd ? ' kd' : '') })); s.append(svg('text', { x: x(k.pos.c) + CW / 2, y: y(k.pos.r) + CW * .68, class: 'lbl' }, k.name.replace(/\D/g, '') || k.name[0])); }
  return s;
};

// ---------- clash panes ----------
const track = (cls, n, max, lim) => h('div', { class: 'track ' + cls }, Array.from({ length: max + 1 }, (_, i) => h('i', { class: (i <= n && i > 0 ? 'on' : '') + (lim != null && i === lim ? ' lim' : '') })));
const knightBox = k => h('div', { class: 'kbox' + (k.alive ? '' : ' dead') },
  h('div', {}, h('b', {}, k.name), ' ', h('span', { class: 'small muted' }, k.pos ? clash.board.label(k.pos) : '—'), k.alive ? '' : h('span', { class: 'err' }, ' ☠')),
  h('div', { class: 'small' }, `V ${k.vigor}/${k.maxVigor} (${k.peril()})`), track('v', k.vigor, 15),
  h('div', { class: 'small' }, `H ${k.heat} / 한계 ${k.heatLimit}`), track('h', k.heat, 9, k.heatLimit),
  h('div', { class: 'small' }, `P ${k.passion}${clash.priorityTarget === k ? ' · ★Priority' : ''}`), track('p', k.passion, 9),
  h('div', { class: 'small' }, `Bane ${k.bane}/${k.baneLimit} · 손패 ${k.hand.length} (CD ${k.cooldown.length} / DL ${k.delay.length} / DC ${k.discard.length})`),
  h('div', {}, k.conditions.map(c => h('span', { class: 'tag' }, c.id + (c.tokens ? ' ×' + c.tokens : ''))), k.gear.map(g => h('span', { class: 'tag', style: g.exhausted ? 'opacity:.5' : '', title: ((g.traits || []).join(', ') + '\n' + (g.text || '')).trim() }, g.name + (g.traits && g.traits.length ? ` (${g.traits.join(', ')})` : '')))),
  h('div', { class: 'small muted' }, '손패: ' + k.hand.map(t => t.name + (t.exert ? ` [Exert ${t.exert.token === 'PowerReroll' ? 'PR' : t.exert.token}]` : '')).join(', ')),
  k.heroicArc ? h('div', { class: 'small muted' }, `Arc ${k.heroicArc.name}: ` + k.heroicArc.levels.map(l => `L${l.level}${l.level <= k.passion ? '✓' : ''}`).join(' ')) : null,
);
const mercPane = () => { if (!clash.hired || !clash.hired.length) return null; return h('div', {}, h('h3', { style: 'margin:8px 0 4px' }, '용병 (수동 발동)'), clash.hired.map(m => { const md = DATA.decks.mercenaries.mercenaries.find(x => x.class === m.class && x.level === m.level); const side = m.side === 'A' ? md.sideA : md.sideB; return h('div', { class: 'kbox' }, h('b', {}, `${m.class} L${m.level ?? '-'} — ${m.side}면`), h('div', { class: 'small' }, side.clash), m.side === 'X' ? h('span', { class: 'small muted' }, '사용 완료') : h('button', { class: 'sm', onclick: () => { clash.say(`용병 ${m.class} ${m.side}면 능력 사용: ${side.clash}`, 'tech'); m.side = m.side === 'A' ? 'B' : 'X'; render(); } }, m.side === 'A' ? '사용 → 뒤집기' : '사용 → 버리기')); })); };
const monsterPane = () => { const M = clash.monster; return h('div', {},
  h('div', {}, h('b', {}, `${M.name} Lv${M.level}`), ` · To Hit ${M.toHit + M.modifiers.toHit}+ · 방향 ${M.facing}`),
  h('div', {}, `Wound Stack ${M.wounds} / ${M.woundsToKill}`), track('v', M.wounds, M.woundsToKill),
  h('div', { class: 'small' }, `AI 덱 ${M.ai.size} (버림 ${M.ai.discard.length}) · BP 덱 ${M.bp.size} (버림 ${M.bp.discard.length}) · Esc AI2 ${M.aiEsc[2].size} AI3 ${M.aiEsc[3].size} · BP2 ${M.bpEsc[2].size} BP3 ${M.bpEsc[3].size}`),
  h('div', { class: 'small' }, `AT 보너스 +${M.bonuses.at + M.modifiers.at} · Armor 토큰 BP1 ${clash.armorTokens[1]} / BP2 ${clash.armorTokens[2]} / BP3 ${clash.armorTokens[3]}${M.hasTrait('Jacked') ? ' · Jacked ' + clash.jackedTokens : ''} · Counter ${M.generic.counter || 0}/3`),
  h('div', {}, [...M.traits].map(t => { const td = clash.monsterDef.traits.find(x => x.name === t); return h('span', { class: 'tag' + (M.disabledTraits.has(t) ? ' muted' : ''), title: td ? td.text : '' }, t); })),
  h('div', { class: 'small' }, h('b', {}, 'Knight Pool: '), clash.pool.length ? clash.pool.map(t => h('span', { class: 'chip' }, t.token)) : '비어 있음'),
  h('div', { class: 'small muted' }, `Judicium 덱: ${[...clash.judiciumBase, ...clash.judiciumExtra].map(c => c.name).join(', ')}`),
  mercPane(),
); };
const logPane = () => { const el = h('div', { class: 'log' }, clash.log.slice(-200).map(l => h('div', { class: l.kind }, l.msg))); setTimeout(() => { el.scrollTop = el.scrollHeight; }, 0); return el; };

// ---------- bottom sheet (ask) ----------
const answer = v => { const p = pending; pending = null; p.res(v); render(); };
let diceSel = new Set(); let orderSel = [];
const sheet = () => {
  if (!pending) return null; const q = pending.q;
  const title = { action: '행동 선택', move: '이동할 칸을 보드에서 탭하세요', dice: '재굴림할 주사위 선택', confirm: '확인', pickKnight: '기사 선택', weapon: '무기 선택', pick: '선택', heartseeker: 'Heartseeker — BP 선택', arcOption: 'Heroic Arc 옵션', number: '개수 선택', order: '순서 선택' }[q.type] || q.type;
  const who = q.knight && clash ? clash.knights.find(k => k.id === q.knight) : null;
  const opts = q.options || [];
  if (q.type === 'dice') return h('div', { class: 'sheet' },
    h('div', { class: 'q' }, who ? `${who.name} — ` : '', title, h('span', { class: 'small muted' }, ` (최대 ${q.max})`)),
    q.text ? h('div', { class: 'small', style: 'margin-bottom:8px' }, q.text) : null,
    h('div', { class: 'opts num' }, q.dice.map((d, i) => h('button', { class: (diceSel.has(i) ? 'primary' : '') + (d.hit ? ' good' : ''), style: d.crit ? 'border-color:#fff' : '', disabled: !d.canReroll, onclick: () => { if (diceSel.has(i)) diceSel.delete(i); else if (diceSel.size < q.max) diceSel.add(i); render(); } }, `${d.v}${d.crit ? '★' : ''}${d.colour ? ' ' + d.colour[0] : ''}${d.hit ? ' ✓' : ' ✗'}`))),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { const v = [...diceSel]; diceSel = new Set(); answer(v); } }, diceSel.size ? `${diceSel.size}개 재굴림` : '재굴림 안 함')));
  if (q.type === 'order') return h('div', { class: 'sheet' },
    h('div', { class: 'q' }, title), q.text ? h('div', { class: 'small' }, q.text) : null,
    h('div', { class: 'small muted' }, '순서대로 탭: ', orderSel.map(v => opts.find(o => o.value === v).label).join(' → ') || '—'),
    h('div', { class: 'opts' }, opts.filter(o => !orderSel.includes(o.value)).map(o => h('button', { onclick: () => { orderSel.push(o.value); if (orderSel.length === opts.length) { const v = orderSel; orderSel = []; answer(v); } else render(); } }, o.label))),
    h('div', { class: 'row' }, h('button', { class: 'sm', onclick: () => { orderSel = []; render(); } }, '초기화')));
  const numeric = q.type === 'number';
  return h('div', { class: 'sheet' },
    h('div', { class: 'q' }, who ? `${who.name} — ` : '', title),
    q.text ? h('div', { class: 'small', style: 'margin-bottom:8px' }, q.text) : null,
    q.type === 'move' ? h('div', { class: 'row' }, /Displace/.test(q.text || '') ? null : h('button', { onclick: () => answer(null) }, '이동 안 함')) : null,
    h('div', { class: 'opts' + (numeric ? ' num' : '') }, opts.filter(o => q.type !== 'move').map(o => h('button', { class: o.value === 'attack' || o.value === true || (numeric && o.value === q.default) ? 'primary' : '', onclick: () => answer(o.value) }, o.label))),
  );
};

// ---------- clash screen ----------
const renderClash = () => {
  const done = clash.result;
  app.replaceChildren(h('div', { class: 'clash' },
    h('div', { class: 'row', style: 'margin:0' }, h('b', { style: 'color:var(--gold)' }, `${clash.monster.name} Lv${clash.monster.level}`), h('span', { class: 'small muted' }, `라운드 ${clash.round} · 시드 ${clash.rng.seed}`), done ? h('span', { class: done === 'win' ? 'good' : 'err' }, done === 'win' ? ' 승리!' : ' 패배') : null, h('span', { style: 'flex:1' }), camp ? null : h('button', { class: 'sm', onclick: () => { screen = 'home'; clash = null; pending = null; render(); } }, done ? '처음으로' : '중단')),
    h('div', { id: 'board' }, renderBoard()),
    h('div', { class: 'tabs' }, ['log', 'knights', 'monster'].map(t => h('button', { class: tab === t ? 'on' : '', onclick: () => { tab = t; render(); } }, { log: '로그', knights: '기사', monster: '몬스터' }[t]))),
    h('div', { class: 'pane' }, tab === 'log' ? logPane() : tab === 'knights' ? h('div', { class: 'kstat' }, clash.knights.map(knightBox)) : monsterPane()),
    pending ? h('div', { style: 'height:40vh' }) : null,
  ), sheet());
};
const render = () => {
  if (screen === 'clash' && clash) return renderClash();
  if (camp && screen === 'map') { renderMap(); if (pending) app.append(sheet()); return; }
  if (camp && screen === 'encounter') return renderEncounter();
  if (camp && screen === 'aftermath') { renderAftermath(); if (pending) app.append(sheet()); return; }
  if (camp && screen === 'outpost') return renderOutpost();
  if (camp && screen === 'camplog') return renderCampLog();
  renderHome();
};
render();
