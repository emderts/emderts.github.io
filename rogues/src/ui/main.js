// Kingdoms Forlorn — Rogue's Path: UI (vanilla JS, single page, mobile-first).
import { Clash } from '../engine/clash.js';
import { Campaign } from '../engine/campaign.js';
import { DIRS, inFront, rearCells } from '../engine/board.js';
import { mountMonsterInfo, makeCardViews } from './monsterinfo.js';

const DATA = window.KF_DATA;
const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (typeof v === 'function' && k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
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
const KNIGHT_IDS = Object.keys(DATA.knights).filter(id => DATA.knights[id].setup); const partySel = [0, 1, 2, 3].map(i => KNIGHT_IDS[i % KNIGHT_IDS.length]);
const renderHome = () => {
  const mons = Object.values(DATA.monsters).filter(m => m.clashSetup || /[?&]dev/.test(location.search)); const saved = loadSaved();
  app.replaceChildren(
    h('h1', {}, "Kingdoms Forlorn — Rogue's Path"),
    h('p', { class: 'sub' }, `웹 싱글플레이 · v${DATA.meta.version} · 빌드 ${DATA.meta.builtAt.slice(0, 16).replace('T', ' ')} UTC`),
    h('div', { class: 'card' },
      h('h2', {}, '기사 선택'),
      h('p', { class: 'small muted' }, '캠페인과 Clash 단독 테스트 모두 여기서 고른 기사 4명으로 시작합니다. 같은 기사는 중복할 수 없습니다 (이미 고른 기사를 고르면 두 자리가 서로 바뀝니다).'),
      h('div', { class: 'row' }, ...[0, 1, 2, 3].map(i => h('label', {}, `${i + 1} `, h('select', { id: 'kn' + i, onchange: e => { const v = e.target.value, old = partySel[i]; const o = partySel.indexOf(v); if (o >= 0 && o !== i) { partySel[o] = old; const el = $('#kn' + o); if (el) el.value = old; } partySel[i] = v; syncGearChoice(); } }, KNIGHT_IDS.map(id => h('option', { value: id, selected: partySel[i] === id ? '' : null }, DATA.knights[id].name)))))),
      h('div', { id: 'kgrow', class: 'small' }, ...[0, 1, 2, 3].map(i => h('label', { id: 'kgl' + i, style: 'display:none;margin-right:8px' }, `기사 ${i + 1} 시작 장비 `, h('select', { id: 'kg' + i })))),
    ),
    h('div', { class: 'card' },
      h('h2', {}, 'Rogue\'s Path 캠페인'),
      h('p', { class: 'small muted' }, `기사 4명, Rosegraal 103 노드. 구현된 몬스터: ${mons.map(m => m.name).join(', ')} — 표에 그 몬스터가 없는 노드는 아직 선택 불가.`),
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
        h('label', {}, '노드 레벨 ', h('select', { id: 'nlv' }, [1, 2, 3, 4, 5].map(l => h('option', { value: l }, `${l} · ${['Mob', 'Vassal', 'King', 'Devil', 'Dragon'][l - 1]}`)))),
        h('label', {}, '시드 ', h('input', { id: 'seed', type: 'number', placeholder: '무작위', style: 'width:110px', value: seedInput })),
        h('button', { onclick: startTestClash }, 'Clash 시작'),
      ),
    ),
    h('p', { class: 'small muted' }, h('a', { href: '../' }, '← ATO Mnestis Theatre')),
  );
};
const syncGearChoice = () => { for (let i = 0; i < 4; i++) { const el = $('#kn' + i), lab = $('#kgl' + i), sel = $('#kg' + i); if (!el || !lab || !sel) continue; const ch = DATA.knights[el.value] && DATA.knights[el.value].setup.gearChoice; if (!ch) { lab.style.display = 'none'; sel.dataset.kn = ''; continue; } lab.style.display = ''; if (sel.dataset.kn !== el.value) { sel.dataset.kn = el.value; sel.innerHTML = ''; for (const n of ch.options) { const o = document.createElement('option'); o.value = n; o.textContent = n; if (n === ch.default) o.selected = true; sel.appendChild(o); } } } };
const startGearOf = i => { const el = $('#kn' + i), sel = $('#kg' + i); const ch = el && DATA.knights[el.value] && DATA.knights[el.value].setup.gearChoice; return ch ? (sel && ch.options.includes(sel.value) ? sel.value : ch.default) : null; };
const partyDefs = () => [0, 1, 2, 3].map(i => { const el = $('#kn' + i); return el && DATA.knights[el.value] ? el.value : partySel[i]; });
const newCampaign = () => { if (loadSaved() && !confirm('저장된 캠페인을 덮어씁니다. 계속할까요?')) return; camp = new Campaign(DATA, { seed: Math.floor(Math.random() * 1e9), knights: partyDefs().map((def, i) => ({ def, startGear: startGearOf(i) })), ask: askViaSheet, ownedMonsters: null }); save(); screen = 'map'; render(); };
const startTestClash = () => {
  const seed = +$('#seed').value || Math.floor(Math.random() * 1e9); seedInput = String(seed);
  clash = new Clash({ data: DATA, knights: partyDefs().map((def, i, all) => ({ def, ...(startGearOf(i) ? { gear: ['Knighves', startGearOf(i)] } : {}), name: DATA.knights[def].name + (all.filter(x => x === def).length > 1 ? ' ' + (all.slice(0, i + 1).filter(x => x === def).length) : '') })), monster: $('#mon').value, level: +$('#lv').value, nodeLevel: +($('#nlv') ? $('#nlv').value : $('#lv').value), kingdom: 'principality', seed, listeners: { log: () => scheduleRender(), flash: onFlash } });
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
const monsterOptions = n => camp.tables.levels[String(n.level)][n.kingdom].map(r => ({ ...r, name: camp.tables.monsterNames[r.monster], ok: (!camp.owned || camp.owned.includes(r.monster)) && camp.monsterReady(r.monster) }));
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
  clash = camp.buildClash({ ask: askViaSheet, listeners: { log: () => scheduleRender(), flash: onFlash } }); clash.setup(); screen = 'clash'; tab = 'log'; render();
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
  const gearRow = name => { const g = camp.gearDef(name); if (!g) return h('div', { class: 'small err' }, name + ' (데이터 없음)'); const on = k.loadout.gear.includes(name); return h('label', { class: 'row', style: 'margin:3px 0' }, h('input', { type: 'checkbox', checked: on, disabled: name === 'Knighves', onchange: e => { const next = e.target.checked ? [...k.loadout.gear.filter(x => x !== 'Knighves'), name] : k.loadout.gear.filter(x => x !== name && x !== 'Knighves'); try { camp.setLoadoutGear(k, next); } catch (err) { alert(err.message); } save(); render(); } }), h('span', {}, h('b', {}, name), (g.traits && g.traits.length ? h('i', { class: 'small muted' }, ' ' + g.traits.join(', ')) : ''), ' — ' + camp.gearStats(name), k.loadout.upgrades && k.loadout.upgrades[name] ? h('span', { class: 'tag' }, '+ ' + k.loadout.upgrades[name]) : ''), h('div', { class: 'small muted' }, (g.text || '').split('\n').join(' / ')), (rf => rf && rf.reforgedName ? h('button', { class: 'sm', disabled: camp.boughtNow(k, name) || k.gold < rf.reforgePrice, title: camp.boughtNow(k, name) ? '이번 Outpost Phase에 산 장비 — 다음 Outpost부터 재련 가능' : '', onclick: () => { try { camp.reforge(k, name); } catch (err) { alert(err.message); } save(); render(); } }, camp.boughtNow(k, name) ? `재련 → ${rf.reforgedName} (${rf.reforgePrice}G) — 다음 Outpost부터` : `재련 → ${rf.reforgedName} (${rf.reforgePrice}G)`) : null)(camp.data.gear.merchant_principality.gear.find(m => m.name === name))); };
  const techRow = name => { const t = def.techniques.find(t => t.name === name); const on = k.loadout.techniques.includes(name); return h('label', { class: 'row', style: 'margin:3px 0' }, h('input', { type: 'checkbox', checked: on, onchange: e => { const next = e.target.checked ? [...k.loadout.techniques, name] : k.loadout.techniques.filter(x => x !== name); try { camp.setLoadoutTechniques(k, next); } catch (err) { alert(err.message); } save(); render(); } }), h('span', {}, h('b', {}, name), h('span', { class: 'small muted' }, ` — ${t ? t.text : ''}${t && t.exert ? ` · Exert: ${t.exert.token === 'PowerReroll' ? 'Power Re-roll' : t.exert.token} (${t.exert.depletion})` : ''}`))); };
  const pickList = (label, key, opts, val) => h('div', { style: 'margin:6px 0' }, h('b', {}, label), h('div', { class: 'optlist' }, opts.map(o => h('label', { class: 'kbox optrow' + (o.value === val ? ' on' : '') }, h('input', { type: 'radio', name: 'ld-' + key, checked: o.value === val, onchange: () => { camp.setLoadoutCards(k, { [key]: o.value }); save(); render(); } }), h('span', {}, h('b', {}, o.label), o.detail ? h('div', { class: 'small muted' }, o.detail) : null)))));
  const sel = (label, key, opts, val) => h('label', { class: 'row' }, label, h('select', { onchange: e => { camp.setLoadoutCards(k, { [key]: e.target.value }); save(); render(); } }, opts.map(o => h('option', { value: o.value, selected: o.value === val }, o.label))));
  app.replaceChildren(partyBar(),
    h('div', { class: 'card' }, h('h2', {}, `Outpost — Half-ruined Keep (상점 티어 ≤ ${camp.tierOf(tierLevel)})`),
      h('div', { class: 'tabs' }, ks.map((kk, i) => h('button', { class: i === outpostKnight ? 'on' : '', onclick: () => { outpostKnight = i; render(); } }, `${kk.name} ${kk.gold}G`))),
      h('div', { class: 'pane', style: 'max-height:none' },
        h('h3', {}, '카드 구성'),
        pickList('Portrait', 'portrait', k.unlocked.portraits.map(p => ({ value: p, label: def.portraits.find(x => x.id === p).name, detail: camp.portraitDetail(k, p) })), k.loadout.portrait),
        pickList('Heroic Arc', 'heroicArc', k.unlocked.heroicArcs.map(a => ({ value: a, label: a, detail: camp.heroicArcDetail(k, a) })), k.loadout.heroicArc),
        pickList('Peril Arc', 'perilArc', k.unlocked.perilArcs.map(a => ({ value: a, label: a, detail: camp.perilArcDetail(k, a) })), k.loadout.perilArc),
        pickList('Talent', 'talent', k.unlocked.talents.map(a => ({ value: a, label: a, detail: camp.talentDetail(k, a) })), k.loadout.talent),
        h('h3', {}, `Technique 손패 (${k.loadout.techniques.length}/${camp.handLimit(k)})`), k.unlocked.techniques.map(techRow),
        h('h3', {}, 'Gear (손 2 · 갑옷 1 · 보조 2)'), ['Knighves', ...k.armory.filter(n => n !== 'Knighves')].map(gearRow),
        (k.upgrades && k.upgrades.length) ? h('div', {}, h('h3', {}, `Upgrade (${k.upgrades.length})`), k.upgrades.map(un => { const u = camp.upgradeDef(un); const att = Object.entries((k.loadout.upgrades) || {}).find(([g, x]) => x === un); const elig = k.armory.filter(n => { const g = camp.gearDef(n); return g && !g.merchant && (u.kind === 'weapon' ? g.type === 'weapon' : g.type === 'armor'); });
          return h('div', { class: 'kbox', style: 'margin:4px 0' }, h('b', {}, un), h('span', { class: 'small muted' }, ` ${u.tier} ${u.kind === 'weapon' ? 'Weapon' : 'Armor'} Upgrade`), h('div', { class: 'small' }, u.text), h('label', { class: 'row small' }, '부착: ', h('select', { onchange: e => { try { if (att) camp.setUpgrade(k, att[0], null); if (e.target.value) camp.setUpgrade(k, e.target.value, un); } catch (err) { alert(err.message); } save(); render(); } }, h('option', { value: '' }, '— 없음 —'), elig.map(n => h('option', { value: n, selected: att && att[0] === n ? '' : null }, n + (k.loadout.upgrades && k.loadout.upgrades[n] && k.loadout.upgrades[n] !== un ? ` (현재 ${k.loadout.upgrades[n]})` : ''))))), elig.length ? null : h('div', { class: 'small muted' }, '붙일 수 있는 비-Merchant ' + (u.kind === 'weapon' ? 'Weapon' : 'Armor') + ' 없음')); })) : null,
        (() => { const others = camp.knights.filter(o => o !== k && !o.dead); const pend = (k.rapport && k.rapport._pending) || 0; const rows = others.filter(o => (k.rapport || {})[o.name] || pend); if (!rows.length) return null; return h('div', { class: 'kbox', style: 'margin:4px 0' }, h('b', {}, 'Rapport'), pend ? h('span', { class: 'small warn' }, ` — 줄 수 있는 Rapport ${pend}`) : null, rows.map(o => { const n = (k.rapport || {})[o.name] || 0; return h('div', { class: 'row small' }, `${o.name} ${'♥'.repeat(n)}${'♡'.repeat(3 - n)}`, n >= 3 ? h('span', { class: 'small muted' }, ` Boon: ${camp.rapportBoonText(o)}`) : null, (pend && n < 3) ? h('button', { class: 'sm', onclick: () => { try { camp.gainRapport(k, o.name); save(); render(); } catch (e) { alert(e.message); } } }, '+1') : null); })); })(),
        h('p', { class: 'small muted' }, `Virtues: ${Object.entries(k.virtues).map(([v, n]) => v + ' ' + n).join(', ')} · Bane ${k.bane} · Sigh ${k.sigh} · 획득 보상 ${k.claimed.length}`),
      )),
    (() => { const st = camp.outpostState(); const OP = camp.data.outpost.principality.sections; const EBN = { mercenaryGuild: 'Mercenary Guild', inn: 'Inn', merchantsWorkshop: "Merchant's Workshop" }; const R = OP.inn.results;
      return h('div', { class: 'card' }, h('h2', {}, 'Early Bird · Inn'),
        h('div', { class: 'small muted' }, '처음 방문한 섹션 하나만 Early Bird 효과를 받습니다 (구매·고용·Inn 중 먼저 한 것). 직접 고를 수도 있습니다.'),
        st.earlyBird ? h('div', {}, 'Early Bird: ', h('b', {}, EBN[st.earlyBird]), ' — ', h('span', { class: 'small' }, OP[st.earlyBird].earlyBird.text)) : h('div', { class: 'row' }, Object.keys(EBN).map(sec => h('button', { class: 'sm', title: OP[sec].earlyBird.text + (OP[sec].earlyBird.devil ? ' / Devil: ' + OP[sec].earlyBird.devil : ''), onclick: async () => { await camp.earlyBird(sec, tierLevel); save(); render(); } }, `먼저 방문: ${EBN[sec]}`))),
        st.earlyBird ? null : Object.keys(EBN).map(sec => h('div', { class: 'small muted' }, h('b', {}, `${EBN[sec]}: `), OP[sec].earlyBird.text + (OP[sec].earlyBird.devil ? ` Devil 티어: ${OP[sec].earlyBird.devil}` : ''))),
        h('h3', {}, 'Inn'), st.inn ? h('div', {}, `결과 ${st.inn}: ${R[st.inn].text}`) : st.earlyBird === 'inn' ? h('div', {}, h('div', { class: 'optlist' }, Object.keys(R).filter(n => n !== '6' && n !== '7').map(n => h('button', { class: 'wide', onclick: async () => { await camp.innVisit(tierLevel, +n); save(); render(); } }, h('b', {}, `${n}`), h('div', { class: 'small optd' }, R[n].text)))), h('button', { class: 'sm', onclick: async () => { await camp.innVisit(tierLevel); save(); render(); } }, 'd10 굴리기')) : h('button', { class: 'sm', onclick: async () => { await camp.innVisit(tierLevel); save(); render(); } }, 'Inn 방문 — d10 굴리기 (6·7은 다시 굴림)'),
        camp.roundBuffs && Object.keys(camp.roundBuffs).length ? h('div', { class: 'small' }, '이번 라운드 효과: ' + Object.entries(camp.roundBuffs).map(([n, b]) => `${n} ${Object.entries(b).map(([kk, v]) => kk + (v === true ? '' : ' ' + v)).join(', ')}`).join(' · ')) : null); })(),
    h('div', { class: 'card' }, h('h2', {}, 'Merchant\'s Workshop'), h('div', { class: 'grid2' }, camp.merchantDeck(tierLevel).filter((g, i, a) => g.consumable || a.findIndex(x => !x.consumable && x.name === g.name) === i).map((g, _i, _a) => h('div', { class: 'kbox' }, h('b', {}, g.name), (n => n > 1 ? h('span', { class: 'small muted' }, ` ×${n}`) : null)(g.consumable ? 1 : camp.merchantDeck(tierLevel).filter(x => !x.consumable && x.name === g.name).length), h('div', { class: 'small muted' }, h('i', {}, (g.traits || []).join(', '))), ` ${g.price}G`, h('div', { class: 'small' }, camp.gearStats(g.name) || `${g.tier} · ${g.type}`), h('div', { class: 'small muted' }, (g.side.text || '').split('\n').join(' / ')), h('button', { class: 'sm', disabled: k.gold < g.price, onclick: async () => { await camp.earlyBird('merchantsWorkshop', tierLevel); try { camp.buyGear(k, g.name, tierLevel); } catch (err) { alert(err.message); } save(); render(); } }, `${k.name.replace('Fleischritter', 'F')} 구매`))))),
    h('div', { class: 'card' }, h('h2', {}, `Mercenary Guild (고용 ${camp.hired.length}/4)`), h('div', {}, camp.hired.map(m => h('span', { class: 'tag' }, `${m.class} L${m.level} (${m.side}면)`))), h('div', { class: 'grid2' }, camp.mercPool.map(m => { const md = camp.data.decks.mercenaries.mercenaries.find(x => x.class === m.class && x.level === m.level); return h('div', { class: 'kbox' }, h('b', {}, `${m.class} L${m.level ?? '-'}`), ` ${m.cost}G`, h('div', { class: 'small muted' }, 'A: ' + md.sideA.clash), h('div', { class: 'small muted' }, 'B: ' + md.sideB.clash), h('button', { class: 'sm', disabled: k.gold < m.cost || camp.hired.length >= 4 || camp.hired.some(x => x.class === m.class), onclick: async () => { await camp.earlyBird('mercenaryGuild', tierLevel); try { camp.hire(k, m.class, m.level); } catch (err) { alert(err.message); } save(); render(); } }, `${k.name.replace('Fleischritter', 'F')}이 고용`)); })), h('p', { class: 'small muted' }, '용병 Clash 능력은 전투 중 "몬스터" 탭에서 수동으로 발동(카드 뒤집기/버리기)합니다.')),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { camp.endOutpost(); save(); screen = camp.current ? 'encounter' : 'map'; render(); } }, '나가기')),
  );
};

// ---------- board ----------
const renderBoard = () => {
  const B = clash.board; const CW = 10, PAD = 4; const W = B.cols * CW + PAD * 2, H = B.rows * CW + PAD * 2;
  const x = c => PAD + (c - 1) * CW, y = r => PAD + (B.rows - 1 - r) * CW;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bsvg' });
  const M = clash.monster; const shade = !M.isMob || (M.cur && M.cur.cells.length && (clash.currentAttack || clash.currentKnightAttack)); const front = new Set(), rear = new Set(shade ? rearCells(B, M.cells, M.facing).map(c => B.key(c)) : []);
  if (shade) for (let r = 0; r < B.rows; r++) for (let c = 1; c <= B.cols; c++) { const cell = { c, r }; if (inFront(B, M.cells, M.facing, cell)) front.add(B.key(cell)); }
  const selCells = pending && pending.q.type === 'move' ? pending.q.cells : [];
  const pv = pending && pending.q.preview === 'path' ? (pending.q.options[previewSel] || pending.q.options[0]).path || [] : [];
  for (let r = 0; r < B.rows; r++) for (let c = 1; c <= B.cols; c++) {
    const cell = { c, r }; const k = B.key(cell); const sel = selCells.find(x => x.c === c && x.r === r);
    const rect = svg('rect', { x: x(c), y: y(r), width: CW, height: CW, class: 'cell' + ((c + r) % 2 ? ' alt' : '') + (rear.has(k) ? ' rear' : front.has(k) ? ' front' : '') + (sel ? ' sel' : '') });
    if (sel) rect.addEventListener('click', () => answer(sel));
    s.append(rect);
  }
  for (let r = 0; r < B.rows; r++) s.append(svg('text', { x: PAD - 2, y: y(r) + CW * .65, class: 'coord' }, B.rowLabels[r]));
  for (let c = 1; c <= B.cols; c++) s.append(svg('text', { x: x(c) + CW / 2, y: H - 1, class: 'coord' }, c));
  for (const [key, t] of B.terrain) { const [c, r] = key.split(',').map(Number); s.append(svg('rect', { x: x(c) + 1.5, y: y(r) + 1.5, width: CW - 3, height: CW - 3, rx: 1.5, class: 'ter t-' + t.id.replace(/\s+/g, '-'), style: selCells.some(q => q.c === c && q.r === r) ? null : 'pointer-events:auto;cursor:pointer', onclick: () => openModal(`지형 — ${B.label({ c, r })}`, terrainView(t, key)) })); s.append(svg('text', { x: x(c) + CW / 2, y: y(r) + CW * .68, class: 'lbl' }, t.id === 'paleburrow' ? '◎' + (t.num || '') : t.id === 'bloodgeyser' ? '' : t.id === 'rut' ? '≈' : t.id === 'loose string' ? '⤴' : t.id === 'bottomless well' ? '◯' : t.id[0].toUpperCase())); }
  pv.forEach((fp, i) => { const last = i === pv.length - 1; for (const c of fp) s.append(svg('rect', { x: x(c.c) + .8, y: y(c.r) + .8, width: CW - 1.6, height: CW - 1.6, rx: 1, class: last ? 'pvend' : 'pvpath' })); const cc = fp.reduce((a, c) => ({ c: a.c + c.c / fp.length, r: a.r + c.r / fp.length }), { c: 0, r: 0 }); s.append(svg('text', { x: x(cc.c) + CW / 2, y: y(cc.r) + CW * .62, class: 'pvtxt' }, String(i + 1))); });
  if (clash.isTd) for (const t of clash.td.toads) s.append(svg('text', { x: x(t.c) + CW / 2, y: y(t.r) + CW * .7, class: 'lbl', style: 'font-size:' + CW * .55 + 'px' }, t.divine ? '✹' : '🐸'));
  if (!M.isMob && clash.guardians) for (const gd of clash.guardians) { const c = gd.cells[0]; const cx = x(c.c) + CW / 2, cy = y(c.r) + CW / 2; const d = DIRS[gd.facing]; const act = clash.actingGuardian === gd;
    const g = svg('g', { class: 'mobg', onclick: () => gd.isDopp ? openModal(`Doppelknight #${gd.n}`, h('div', {}, h('div', { class: 'small' }, `To Hit ${clash.guardianToHit(gd)}+ · ${gd.revealed ? gd.cards.map(c => `${c.name} (BP${c.level})`).join(' + ') + ` · AT ${clash.doppAT(gd)}` : `BP ${gd.cards.length}장 (뒷면)`} · 방향 ${gd.facing}${gd.armor ? ' · Armor ' + gd.armor : ''}`), h('div', { class: 'small' }, `Doppelknights ${clash.guardians.length}/${clash.monsterDef.fen.tokens} · We Are Many ${clash.wamTokens}/4 · Sheet Armor 토큰 ${clash.fenArmor} · Engulfed: ${clash.knights.filter(k => k.engulfed).map(k => k.name).join(', ') || '없음'}`))) : gd.isRemnant ? openModal('Primal Remnant', h('div', {}, h('div', { class: 'small' }, `Lumbering · 활성화하지 않음 · To Hit ${clash.guardianToHit(gd)}+ · AT ${clash.bpAT(clash.guardianBP(gd))} (5 + Remnant Armor 토큰 ${clash.pv.armor.remnant} ×2)`), h('div', { class: 'small' }, 'Overpower X: 이 카드의 Armor 토큰 X개까지 버림 · Ultrainstinct: Germinate (Dragon) · Wound: +1 [P], Signature (공격자) · Fail: Clockwise Remnant Move 4 · Critical: 이 카드의 Armor 토큰 모두 버림, Devote'), h('div', { class: 'small' }, 'Armor 토큰 7개 이상 → Iron Apotheosis (패배). 지나가거나 멈춘 칸의 기사는 사망, Terrain은 소멸'))) : gd.isFK ? openModal(`Fallen Knight #${gd.n}`, h('div', {}, h('div', { class: 'small' }, `Obstacle · Destructible · To Hit ${clash.guardianToHit(gd)}+ · AT ${clash.bpAT(clash.guardianBP(gd))} (Armor 토큰 ${clash.pke.armor} 포함)`), h('div', { class: 'small' }, `Overcome 3+: Power 1 · Overpower 3+: 보드에서 제거 · Wound: Subjugated 버림, Column으로 뒤집음 · Fail: Parasitize 1 · Critical: Mind Condition 모두 버림, Column + 인접 Loose String, 2칸 이동 + Bonus Attack`), h('div', { class: 'small' }, `Trait BP 카드의 Generic 토큰 ${clash.pke.tokens}/2 → Generic Single Wound + Escalate 1`))) : openModal(`Firstman Guardian #${gd.n}`, h('div', {}, h('div', { class: 'small' }, `To Hit ${clash.monsterDef.guardian.bp.ops.toHit} · AT ${clash.monsterDef.guardian.bp.at} · 방향 ${gd.facing}${gd.hasBP ? ' · Trait BP 보유 (다음 Coordinated Attack)' : ''}`), h('div', { class: 'small' }, `Guardians ${clash.guardians.length}/${clash.guardianLimit()} · Reinforcements ${clash.gTokens}/4 · Avenger ${clash.avTokens}/${clash.avengerNeed()}`))) });
    g.append(svg('rect', { x: x(c.c) + 1, y: y(c.r) + 1, width: CW - 2, height: CW - 2, rx: 2, class: 'mon mob rev' + (act ? ' act' : ''), style: 'fill:#d9cfae;stroke:#6b5a2a' }));
    g.append(svg('polygon', { points: `${cx + d.c * 4.6},${cy - d.r * 4.6} ${cx - d.r * 2 + d.c * 2.4},${cy - d.c * 2 - d.r * 2.4} ${cx + d.r * 2 + d.c * 2.4},${cy + d.c * 2 - d.r * 2.4}`, fill: '#8a6d3b' }));
    g.append(svg('text', { x: cx, y: cy + 1.6, class: 'lbl', style: 'fill:#2a1a08' }, (gd.isDopp ? 'D' : 'G') + gd.n));
    if (gd.hasBP) g.append(svg('circle', { cx: x(c.c) + CW - 2, cy: y(c.r) + 2, r: 1.4, fill: '#ff5a4a', stroke: '#000', 'stroke-width': .3 })); s.append(g); }
  if (M.isMob) {
    const pickable = pending && pending.q.kind === 'mob' ? new Set(pending.q.options.map(o => o.value)) : null;
    if (clash.troll) { const T = clash.troll; const xs = T.cells.map(c => x(c.c)), ys = T.cells.map(c => y(c.r)); const tx = Math.min(...xs), ty = Math.min(...ys); const pick = pending && pending.q.kind === 'mob' && (pending.q.options || []).some(o => o.value === 'W');
      const g = svg('g', { class: 'mobg' + (pick ? ' pick' : ''), onclick: pick ? () => answer('W') : () => openModal('White Ape Troll (Long Howl)', h('div', {}, h('div', { class: 'small' }, `Muscular Chest · AT ${clash.mobAT(T)} · Generic 토큰 ${T.trollTokens}/4 · 방향 ${T.facing}`), h('div', { class: 'small' }, 'Rampage Strike로 Warriors 다음에 활성화'))) });
      g.append(svg('rect', { x: tx + 1, y: ty + 1, width: CW * 2 - 2, height: CW * 2 - 2, rx: 3, class: 'mon mob', style: 'fill:#e8e2d0;stroke:#8a6d3b' })); g.append(svg('text', { x: tx + CW, y: ty + CW * 1.15, class: 'lbl', style: 'font-size:6px;fill:#3a2a12' }, 'W')); g.append(svg('text', { x: tx + CW, y: ty + CW * 1.7, class: 'pvtxt', style: 'font-size:3px;fill:#3a2a12' }, `${T.trollTokens}/4`)); s.append(g); }
    for (const m of M.mobs) { const c = m.cells[0]; if (!c) continue; const cx = x(c.c) + CW / 2, cy = y(c.r) + CW / 2; const d = DIRS[m.facing]; const act = M.cur === m && (clash.currentAttack || clash.currentKnightAttack);
      const g = svg('g', { class: 'mobg' + (pickable && pickable.has(m.n) ? ' pick' : '') });
      g.append(svg('rect', { x: x(c.c) + 1, y: y(c.r) + 1, width: CW - 2, height: CW - 2, rx: 2, class: 'mon mob' + (m.revealed ? ' rev' : '') + (act ? ' act' : ''), style: m.isPump && m.side === 'sapling' ? `fill:${m.red ? '#7a2a22' : '#2f6b2f'};stroke:${m.red ? '#ff8a7a' : '#9be89b'}` : null }));
      g.append(svg('polygon', { points: `${cx + d.c * 4.6},${cy - d.r * 4.6} ${cx - d.r * 2 + d.c * 2.4},${cy - d.c * 2 - d.r * 2.4} ${cx + d.r * 2 + d.c * 2.4},${cy + d.c * 2 - d.r * 2.4}`, fill: '#ffd27a' }));
      g.append(svg('text', { x: cx, y: cy + 1.6, class: 'lbl' }, m.decoying ? 'D' : String(m.n))); if (m.gen) g.append(svg('text', { x: x(c.c) + 2.4, y: y(c.r) + CW - 1.2, class: 'pvtxt', style: 'fill:#ffd27a;font-size:3px' }, '●' + m.gen)); if (m.isPump && m.generic) g.append(svg('text', { x: x(c.c) + 2.4, y: y(c.r) + CW - 1.2, class: 'pvtxt', style: 'fill:#ffd27a;font-size:3px' }, '●' + m.generic));
      if (m.tokens.length) g.append(svg('circle', { cx: x(c.c) + CW - 2, cy: y(c.r) + 2, r: 1.4, fill: m.tokens.some(t => t.ready) ? '#ff5a4a' : '#6b5a4a', stroke: '#000', 'stroke-width': .3 }));
      if (m.armor) g.append(svg('text', { x: x(c.c) + 2.2, y: y(c.r) + 3.4, class: 'pvtxt', style: 'fill:#9fd0ff;font-size:3px' }, '🛡' + m.armor));
      if (clash.bloodOn && m.blood) g.append(svg('text', { x: x(c.c) + 2.4, y: y(c.r) + CW - 1.4, class: 'pvtxt', style: 'fill:#ff6b6b;font-size:3px' }, '●' + m.blood));
      if (pickable && pickable.has(m.n)) { g.style.pointerEvents = 'auto'; g.style.cursor = 'pointer'; g.addEventListener('click', () => answer(m.n)); }
      s.append(g);
    }
  } else if (M.cells.length) {
  const mc = clash._bossSave ? clash._bossSave.cells : M.cells; const minC = Math.min(...mc.map(c => c.c)), maxC = Math.max(...mc.map(c => c.c)), minR = Math.min(...mc.map(c => c.r)), maxR = Math.max(...mc.map(c => c.r));
  s.append(svg('rect', { x: x(minC) + 1, y: y(maxR) + 1, width: (maxC - minC + 1) * CW - 2, height: (maxR - minR + 1) * CW - 2, rx: 2, class: 'mon' }));
  const cx = x(minC) + (maxC - minC + 1) * CW / 2, cy = y(maxR) + (maxR - minR + 1) * CW / 2; const d = DIRS[clash._bossSave ? clash._bossSave.facing : M.facing];
  s.append(svg('polygon', { points: `${cx + d.c * 7},${cy - d.r * 7} ${cx - d.r * 3 + d.c * 2},${cy - d.c * 3 - d.r * 2} ${cx + d.r * 3 + d.c * 2},${cy + d.c * 3 - d.r * 2}`, fill: '#ffd27a' }));
  s.append(svg('text', { x: cx, y: cy + 1.8, class: 'lbl' }, M.name[0]));
  }
  for (const t of clash.traps || []) for (const c of t.cells) s.append(svg('text', { x: x(c.c) + CW / 2, y: y(c.r) + CW / 2 + 1.6, class: 'lbl', style: `fill:${t.kind === 'bait' ? '#ffd27f' : '#ff8a5c'};font-size:4.2px;text-anchor:middle` }, t.kind === 'bait' ? '☠' : '✸'));
  if (clash.isBw && clash.bw.wisp) { const w = clash.bw.wisp; s.append(svg('text', { x: x(w.c) + CW / 2, y: y(w.r) + CW / 2 + 1.6, class: 'lbl', style: 'fill:#9fffd0;font-size:4.5px;text-anchor:middle' }, '✺')); }
  for (const k of clash.knights) { if (!k.pos || !k.alive || k.engulfed || k.possessed) continue; const dead = !k.alive, kd = clash.knockedDown(k); s.append(svg('circle', { cx: x(k.pos.c) + CW / 2, cy: y(k.pos.r) + CW / 2, r: CW * .4, class: 'kn' + (dead ? ' dead' : '') + (kd ? ' kd' : '') })); s.append(svg('text', { x: x(k.pos.c) + CW / 2, y: y(k.pos.r) + CW * .68, class: 'lbl' }, k.name.replace(/\D/g, '') || k.name[0])); }
  return s;
};


// ---------- modal (card / trait / pile viewer) & flash overlay (ATO-style) ----------
let modal = null; const openModal = (title, ...body) => { modal = { title, body }; render(); };
const modalEl = () => modal ? h('div', { class: 'overlay', onclick: e => { if (e.target.classList.contains('overlay')) { modal = null; render(); } } }, h('div', { class: 'modal' }, h('button', { class: 'sm close', onclick: () => { modal = null; render(); } }, '✕'), h('h3', {}, modal.title), ...modal.body)) : null;
const techView = t => h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, t.name), h('div', { class: 'small muted' }, `${t.unlock || ''} · 비용 ${clash ? clash.fx.costLabel(null, t) : JSON.stringify(t.cost)} · 소진 ${t.depletion}`), h('div', { class: 'cv-text' }, t.text), ...(t.gates || []).map(g => h('div', { class: 'cv-gate' }, h('b', {}, g.gate + ' '), g.text)), t.exert ? h('div', { class: 'cv-gate' }, h('b', {}, 'Exert '), `${t.exert.token === 'PowerReroll' ? 'Power Re-roll' : t.exert.token} ${t.exert.n} → ${t.exert.depletion}`) : null);
const RWN = w => { const t = typeof w === 'string' ? w : JSON.stringify(w); return t.replace(/^targeting$/, 'Targeting 뒤').replace(/^effect:(\d+)$/, (_, n) => `효과 ${+n + 1}번째 줄 뒤`).replace(/^moveTag$/, '이동 태그 뒤').replace(/^afterAttack$/, 'After Attack 뒤').replace(/^afterFinalAttack$/, 'After Final Attack 뒤'); };
const reactLine = c => { const a = c.reactWindows || c.react; const w = [...(a == null ? [] : Array.isArray(a) ? a : [a]), ...(c.aiResponseReactMarker ? ['AI Response 앞'] : [])]; return h('div', { class: 'cv-gate' }, h('b', {}, 'REACT! '), w.length ? w.map(RWN).join(' · ') : '없음'); };
let _cv = null; const cardViews = () => _cv || (_cv = makeCardViews(h));
// Same full rendering as the monster info viewer (move tag, gates, every effect line, After Attack, AI Response, REACT! windows).
const aiView = c => h('div', { class: 'cardview ai' }, cardViews().aiCard({ ...c, name: c.name || 'Attack' }), c.reactWindows || c.react || c.aiResponseReactMarker ? null : h('div', { class: 'mi-react' }, 'REACT! 없음'));
const bpView = c => h('div', { class: 'cardview bp' }, cardViews().bpCard(c), h('div', { class: 'small muted' }, `${c.toughness ? 'Toughness ' + c.toughness + ' · ' : ''}${clash ? `현재 AT ${clash.bpAT(c)}` : ''}`));
const anyView = x => x.at != null && x.responses ? bpView(x) : x.targeting || x.evasionDice ? aiView(x) : h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, x.name), h('div', { class: 'cv-text' }, x.text || ''));
const pileBtn = (label, cards, view = anyView) => h('button', { class: 'sm link', onclick: () => openModal(`${label} (${cards.length})`, cards.length ? h('div', {}, cards.map(view)) : h('div', { class: 'muted' }, '비어 있음')) }, `${label} ${cards.length}`);
let flashOn = true; try { flashOn = localStorage.getItem('kf.flash') !== '0'; } catch (e) { }
const flashQ = []; let flashBusy = false;
const PFACE = f => ('⚔'.repeat(f.P || 0) + '✦'.repeat(f.T || 0) + '🕊'.repeat(f.H || 0)) || '—';
const flashNode = (kind, d) => { const box = h('div', { class: 'fcard ' + (d.cls || '') }, h('div', { class: 'ft' }, d.title || ''));
  if (kind === 'dice') box.append(h('div', { class: 'fdice' }, d.dice.map(x => h('div', { class: 'die ' + (x.ok ? 'hit' : 'miss') + (x.crit ? ' crit' : '') }, String(x.v)))));
  else if (kind === 'power') box.append(h('div', { class: 'fdice' }, d.dice.map(x => h('div', { class: 'pdie ' + x.colour[0] }, PFACE(x.face))), d.raw ? h('div', { class: 'pdie m' }, '+⚔' + d.raw) : null));
  else if (kind === 'card' && d.card) { const v = aiView(d.card); v.style.textAlign = 'left'; v.style.maxHeight = '60vh'; v.style.overflow = 'auto'; box.append(v); }
  else if (kind === 'card') { box.append(h('div', { class: 'fname' }, d.name || '')); if (d.text) box.append(h('div', { class: 'ftext' }, d.text)); }
  if (d.sub) box.append(h('div', { class: 'fs' }, d.sub)); return box; };
const flashNext = () => { const el = $('#flash'); if (!el) return; if (!flashQ.length) { flashBusy = false; return; } flashBusy = true; const { kind, d } = flashQ.shift(); const node = flashNode(kind, d); let dur = kind === 'card' ? (d.card ? 4500 : 2400) : 1600; if (flashQ.length) dur = Math.max(700, Math.round(dur / (1 + flashQ.length * 0.6))); node.style.setProperty('--fdur', dur + 'ms'); el.replaceChildren(node); let done = false; const fin = () => { if (done) return; done = true; node.remove(); flashNext(); }; node.addEventListener('click', fin); setTimeout(fin, dur + 350); };
const onFlash = (kind, d) => { if (!flashOn) return; if (flashQ.length >= 6) flashQ.shift(); flashQ.push({ kind, d }); if (!flashBusy) flashNext(); };
const poolChips = pool => { const g = new Map(); for (const t of pool) g.set(t.token, (g.get(t.token) || 0) + 1); return [...g].map(([t, n]) => h('span', { class: 'chip' }, `${t[0].toUpperCase() + t.slice(1)} ${n}`)); };

// ---------- clash panes ----------
const track = (cls, n, max, lim) => h('div', { class: 'track ' + cls }, Array.from({ length: max + 1 }, (_, i) => h('i', { class: (i <= n && i > 0 ? 'on' : '') + (lim != null && i === lim ? ' lim' : '') })));
const openDetails = new Set();
const tokTxt = t => `${t.token}${t.n != null ? ' ' + t.n : ''}`;
const heroicView = k => { const a = k.heroicArc; if (!a) return h('div', { class: 'muted' }, '없음'); const lv = k.passion + (clash && clash.poolCount('rouse') ? 1 : 0);
  return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, `Heroic Arc — ${a.name}`), h('div', { class: 'small muted' }, `현재 Passion ${k.passion}${lv > k.passion ? ' (+Rouse)' : ''} → L${Math.min(lv, a.levels.length)}까지 사용 · 레벨당 옵션 1개, 2차 창에서 남은 것 강제`),
    a.plus && a.plus.ops ? h('div', { class: 'cv-gate' }, h('b', {}, '+ '), a.plus.ops.map(tokTxt).join(' + ')) : null,
    h('table', { class: 'kt' }, a.levels.map(L => h('tr', { class: L.level <= lv ? 'on' : 'off' }, h('td', { class: 'ktlv' }, `L${L.level}${L.level <= lv ? ' ✓' : ''}`), h('td', {}, L.options.map(o => o.map(tokTxt).join(' + ')).join('  또는  '))))));
};
const perilView = k => { const a = k.perilArcDef; if (!a) return h('div', { class: 'muted' }, '없음'); const cur = k.peril();
  return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, `Peril Arc — ${a.name}`), h('div', { class: 'small muted' }, `최대 Vigor ${a.maxVigor} · 현재 Vigor ${k.vigor} (${cur}) · Heat ${k.heat}/${k.heatLimit}`),
    h('table', { class: 'kt' }, h('tr', {}, h('td', { class: 'small muted' }, 'Peril'), h('td', { class: 'small muted' }, 'Vigor'), h('td', { class: 'small muted' }, 'Heat Limit')), Object.entries(a.levels).map(([p, v]) => h('tr', { class: p === cur ? 'on' : '' }, h('td', { class: 'ktlv' }, p + (p === cur ? ' ◀' : '')), h('td', {}, v.vigor[0] === v.vigor[1] ? String(v.vigor[0]) : `${v.vigor[0]}–${v.vigor[1]}`), h('td', {}, String(v.heatLimit))))),
    a.bonus ? h('div', { class: 'cv-gate' }, h('b', {}, '보너스 '), typeof a.bonus === 'string' ? a.bonus : (a.bonus.text || JSON.stringify(a.bonus))) : null);
};
const talentView = k => { const t = k.talent; if (!t) return null; return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, `Talent — ${t.name}`), t.abilities.map(a => h('div', { class: 'cv-text' }, h('b', {}, a.name + ': '), a.text))); };

// ---------- Knight info: every tag / stat on a Knight box opens its card text ----------
const gearView = g => h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, g.name + (g.exhausted ? ' (Exhausted)' : '') + (g.discarded ? ' (버려짐)' : '')), h('div', { class: 'small muted' }, Campaign.prototype.gearStats.call(null, g) + (g.consumable ? ` · 남은 Charge ${g.chargesLeft}` : '')), g.traits && g.traits.length ? h('div', { class: 'cv-gate' }, h('b', {}, 'Traits '), g.traits.join(', ')) : null, g.text ? h('div', { class: 'cv-text' }, g.text) : h('div', { class: 'small muted' }, '카드 문구 없음'));
const condView = c => { const defs = clash.conditionDefs || {}; const d = defs[c.id] || Object.values(defs).find(x => x.name.startsWith(c.id) || c.id.startsWith(x.name));
  return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, `Condition — ${c.id}` + (c.tokens ? ` ×${c.tokens}` : '')), d ? [h('div', { class: 'small muted' }, [d.type, d.flipSide ? `뒷면: ${d.flipSide}` : ''].filter(Boolean).join(' · ')), h('div', { class: 'cv-text' }, d.text), d.squire ? h('div', { class: 'cv-gate' }, h('b', {}, 'Squire '), d.squire) : null] : h('div', { class: 'small muted' }, '카드 문구 자료 없음')); };
/** Printed texts (Talent / Gear / Technique / Monster Trait / Terrain) that mention a keyword — for board-state stats that have no card of their own. */
const mentionView = (k, title, words) => { const re = new RegExp(words.join('|'), 'i'); const out = [];
  if (k.talent) for (const a of k.talent.abilities) if (re.test(a.name + ' ' + a.text)) out.push(h('div', { class: 'cv-text' }, h('b', {}, `Talent ${a.name}: `), a.text));
  for (const g of k.gear) if (re.test(g.name + ' ' + (g.text || ''))) out.push(h('div', { class: 'cv-text' }, h('b', {}, `Gear ${g.name}: `), g.text || ''));
  for (const t of (clash.monsterDef.traits || [])) if (re.test(t.name + ' ' + (t.text || ''))) out.push(h('div', { class: 'cv-text' }, h('b', {}, `Trait ${t.name}: `), t.text || ''));
  for (const t of (DATA.terrain && (DATA.terrain.terrain || DATA.terrain.tiles || DATA.terrain) || [])) if (t && t.name && re.test(t.name + ' ' + (t.text || '')) && [...clash.board.terrain.values()].some(x => x.id === t.name.toLowerCase())) out.push(h('div', { class: 'cv-text' }, h('b', {}, `Terrain ${t.name}: `), t.text || ''));
  return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, title), out.length ? out : h('div', { class: 'small muted' }, '관련 카드 문구를 찾지 못함'), ); };
const knightSheet = k => h('div', {}, h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, k.name), h('div', { class: 'small muted' }, `Power die ${k.powerDie} · Speed ${clash.fx.speed ? clash.fx.speed(k) : k.speed} · Hand Limit ${k.handLimit} · Card Refresh ${k.cardRefresh} · Heat Refresh ${k.heatRefresh} · Bane ${k.bane}/${k.baneLimit}`), h('div', { class: 'small muted' }, `Vigor ${k.vigor}/${k.maxVigor} (${k.peril()}) · Heat ${k.heat}/${k.heatLimit} · Passion ${k.passion}`)),
  k.talent ? talentView(k) : null, k.conditions.map(condView), k.gear.map(gearView), heroicView(k), perilView(k));

const terrainView = (t, key) => { const d = (DATA.terrain.terrain || []).find(x => x.name.toLowerCase() === t.id); const B = clash.board; const same = [...B.terrain].filter(([, x]) => x.id === t.id).map(([k]) => { const [c, r] = k.split(',').map(Number); return B.label({ c, r }); });
  const flags = [t.obstacle && 'Obstacle', t.destructible && 'Destructible', t.obscuring && 'Obscuring', t.difficult && 'Difficult', t.chasm && 'Chasm', t.num != null && `#${t.num}`].filter(Boolean);
  return h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, d ? d.name : t.name || t.id), h('div', { class: 'small muted' }, [d && d.sizes && d.sizes.length ? `크기 ${d.sizes.join(' / ')}` : '', (d && d.keywords && d.keywords.length ? d.keywords : flags).join(' · ')].filter(Boolean).join(' · ')),
    (d && d.text) || t.text ? h('div', { class: 'cv-text', style: 'white-space:pre-line' }, (d && d.text) || t.text) : h('div', { class: 'small muted' }, '카드 문구 자료 없음'), h('div', { class: 'small muted' }, `보드 위 칸: ${same.join(', ')}`)); };

const knightBox = k => { const active = pending && pending.q.knight === k.id;
  const info = (title, words) => () => openModal(`${k.name} — ${title}`, mentionView(k, title, words));
  const stat = (cls, n, v, sub, on) => h('div', { class: 'stat ' + cls + (on ? ' link' : ''), onclick: on || null }, h('div', { class: 'sn' }, n), h('div', { class: 'sv' }, v), sub ? h('div', { class: 'ss' }, sub) : null);
  return h('div', { class: 'kbox' + (k.alive ? '' : ' dead') + (active ? ' active' : '') },
    h('div', {}, h('b', { class: 'link', onclick: () => openModal(`${k.name} — 기사 정보`, knightSheet(k)) }, k.name + ' ▸'), ' ', h('span', { class: 'small muted' }, k.possessed ? `빙의됨 (Mob #${k.possessed.n})` : k.engulfed ? 'Engulfed' : k.pos ? clash.board.label(k.pos) : '—'), k.engulfed ? h('span', { class: 'tag warn link', onclick: () => openModal('Engulfed', mentionView(k, 'Engulfed', ['Engulf'])) }, 'Engulfed') : null, clash.priorityTarget === k ? h('span', { class: 'tag warn link', onclick: () => openModal('Priority Target', h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, 'Priority Target (룰북 p.49)'), h('div', { class: 'cv-text' }, 'Targeting 동률을 가르는 토큰. 같은 Targeting 줄을 똑같이 만족하는 Knight가 여럿이면 이 토큰을 가진 Knight가 Target이 된다.'), h('div', { class: 'cv-text' }, 'Clash 중 Passion이 오를 때 토큰 보유자의 Passion보다 높아지면 그 Knight가 토큰을 가져온다.'))) }, '★Priority') : null, k.alive ? '' : h('span', { class: 'err' }, ' ☠')),
    h('div', { class: 'trisk' }, stat('v', 'VIGOR', `${k.vigor}/${k.maxVigor}`, k.peril(), () => openModal(`${k.name} — Peril Arc`, perilView(k))), stat('h', 'HEAT', `${k.heat}/${k.heatLimit}`, '', () => openModal(`${k.name} — Peril Arc`, perilView(k))), stat('p', 'PASSION', k.passion, k.heroicArc ? `Arc L${Math.min(k.passion, 6)}` : '', () => openModal(`${k.name} — Heroic Arc`, heroicView(k))), clash.bloodOn ? stat('v', 'BLOOD', `${k.blood}/5`, '', info('Blood', ['Blood'])) : null, clash.lsOn(k) ? stat('p', 'LITTLE SER', '🐒', '', info('Little Ser', ['Little Ser'])) : null, k.boardRouse ? stat('p', 'ROUSE', k.boardRouse, '다음 공격', info('Rouse', ['Rouse'])) : null, clash.isStone(k) ? stat('p', 'LEASH', k.leash || 0, 'Generic', info('Leash', ['Leash'])) : null, k.form ? stat('p', 'FORM', k.form === 'ape' ? 'APE' : 'HUMAN', k.generic ? `Generic ${k.generic}` : '', info('Form', ['Form', 'Ape', 'Human'])) : null, clash.zealCfg(k) || k.zeal ? stat('p', 'ZEAL', k.zeal || 0, clash.zealCfg(k) && clash.zealCfg(k).threshold ? `한도 ${clash.zealCfg(k).threshold}` : '', info('Zeal', ['Zeal'])) : null),
    h('div', { class: 'small' }, k.conditions.map(c => h('span', { class: 'tag cond link', onclick: () => openModal(`${k.name} — Condition`, condView(c)) }, c.id + (c.tokens ? ' ×' + c.tokens : ''))), k.gear.map(g => h('span', { class: 'tag link', style: g.exhausted ? 'opacity:.5;text-decoration:line-through' : '', onclick: () => openModal(`${k.name} — Gear`, gearView(g)) }, g.name))),
    ...k.gear.filter(g => g.consumable && !g.discarded).map(g => h('div', { class: 'small row', style: 'margin:2px 0;gap:4px' }, h('span', { class: 'link', onclick: () => openModal(g.name, h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, g.name), h('div', { class: 'small muted' }, `Consumable · Charge ${g.chargesLeft}/${g.charges}`), h('div', { class: 'cv-text' }, g.text))) }, `${g.name} ⚡${g.chargesLeft}`), h('button', { class: 'kbtn', style: 'flex:0 0 auto', disabled: !(g.chargesLeft > 0), onclick: () => { const n = +prompt(`${g.name}: 사용할 Charge 수 (남은 ${g.chargesLeft})\n${g.text}`, '1'); if (n > 0 && n <= g.chargesLeft) { g.chargesLeft -= n; clash.say(`${k.name}: ${g.name} Charge ${n} 사용 (수동 적용) — 남은 ${g.chargesLeft}`, 'tech'); render(); } } }, 'Charge 사용'))),
    h('div', { class: 'kbtns' }, h('button', { class: 'kbtn', title: k.heroicArc ? k.heroicArc.name : '', onclick: () => openModal(`${k.name} — Heroic Arc`, heroicView(k)) }, 'Heroic'), h('button', { class: 'kbtn', title: k.perilArcDef ? k.perilArcDef.name : '', onclick: () => openModal(`${k.name} — Peril Arc`, perilView(k)) }, 'Peril'), k.talent ? h('button', { class: 'kbtn', onclick: () => openModal(`${k.name} — Talent`, talentView(k)) }, 'Talent') : null),
    h('details', { open: openDetails.has(k.id) ? '' : null, ontoggle: e => { if (e.target.open) openDetails.add(k.id); else openDetails.delete(k.id); } },
      h('summary', { class: 'small muted' }, `손패 ${k.hand.length} · CD ${k.cooldown.length} / DL ${k.delay.length} / DC ${k.discard.length} · Bane ${k.bane}/${k.baneLimit}`),
      h('div', { class: 'small' }, k.hand.length ? k.hand.map(t => h('span', { class: 'tag link', onclick: () => openModal(`${k.name} — 손패`, techView(t)) }, t.name + (t.exert ? ` [${t.exert.token === 'PowerReroll' ? 'PR' : t.exert.token}]` : ''))) : '—'),
      h('div', { class: 'small' }, pileBtn('Cooldown', k.cooldown, techView), ' ', pileBtn('Delay', k.delay, techView), ' ', pileBtn('Discard', k.discard, techView)),
      k.heroicArc ? h('div', { class: 'small muted' }, `Arc ${k.heroicArc.name}: ` + k.heroicArc.levels.map(l => `L${l.level}${l.level <= k.passion ? '✓' : ''}`).join(' ')) : null,
      h('div', { class: 'small muted' }, k.gear.map(g => `${g.name}${g.traits && g.traits.length ? ' (' + g.traits.join(', ') + ')' : ''}`).join(' · '))));
};
const mercPane = () => { if (!clash.hired || !clash.hired.length) return null; return h('div', {}, h('h3', { style: 'margin:8px 0 4px' }, '용병 (수동 발동)'), clash.hired.map(m => { const md = DATA.decks.mercenaries.mercenaries.find(x => x.class === m.class && x.level === m.level); const side = m.side === 'A' ? md.sideA : md.sideB; return h('div', { class: 'kbox' }, h('b', {}, `${m.class} L${m.level ?? '-'} — ${m.side}면`), h('div', { class: 'small' }, side.clash), m.side === 'X' ? h('span', { class: 'small muted' }, '사용 완료') : h('button', { class: 'sm', onclick: () => { clash.say(`용병 ${m.class} ${m.side}면 능력 사용: ${side.clash}`, 'tech'); m.side = m.side === 'A' ? 'B' : 'X'; render(); } }, m.side === 'A' ? '사용 → 뒤집기' : '사용 → 버리기')); })); };
const monsterPane = () => { const M = clash.monster; const curAI = clash.currentAttack ? clash.currentAttack.card : clash.lastAI; const curBP = clash.currentKnightAttack && clash.currentKnightAttack.bp ? clash.currentKnightAttack.bp : clash.lastBP;
  return h('div', {},
  h('div', {}, h('b', {}, `${M.name} Lv${M.level}`), ` · To Hit ${M.toHit + M.modifiers.toHit}+ · 방향 ${M.facing}`),
  h('div', {}, h('span', { class: 'link', onclick: () => openModal(`Wound Stack ${M.wounds}/${M.woundsToKill}`, M.woundStack.length ? h('div', {}, M.woundStack.map(w => w.card ? bpView(w.card) : h('div', { class: 'cardview' }, `Generic ${w.generic} Wound (${w.wounds})`))) : h('div', { class: 'muted' }, '비어 있음')) }, `Wound Stack ${M.wounds} / ${M.woundsToKill} ▸`)), track('v', M.wounds, M.woundsToKill),
  h('div', { class: 'cards2' }, h('div', {}, h('div', { class: 'small muted' }, clash.currentAttack ? '현재 AI' : '최근 AI'), curAI ? h('div', { class: 'link', onclick: () => openModal('AI 카드', aiView(curAI)) }, aiView(curAI)) : h('div', { class: 'small muted' }, '—')), h('div', {}, h('div', { class: 'small muted' }, clash.currentKnightAttack && clash.currentKnightAttack.bp ? '현재 BP' : '최근 BP'), curBP ? h('div', { class: 'link', onclick: () => openModal('BP 카드', bpView(curBP)) }, bpView(curBP)) : h('div', { class: 'small muted' }, '—'))),
  M.isMob ? h('div', { class: 'mtrack' }, Array.from({ length: 10 }, (_, i) => { const m = M.mobs.find(x => x.n === i + 1); if (!m) return h('div', { class: 'mslot empty' }, String(i + 1)); const known = m.revealed || m.peeked;
    return h('div', { class: 'mslot link' + (m.revealed ? ' rev' : '') + (M.cur === m && (clash.currentAttack || clash.currentKnightAttack) ? ' act' : ''), onclick: () => openModal(`Mob #${m.n} — ${m.cells[0] ? clash.board.label(m.cells[0]) : '보드 밖'}`, known ? bpView(m.card) : h('div', { class: 'cardview bp' }, h('div', { class: 'cv-title' }, `BP ${m.card.level} (비공개)`), h('div', { class: 'small muted' }, '카드 뒷면의 레벨만 보입니다. 공격하면 공개됩니다.')), h('div', { class: 'small' }, `${clash.bloodOn ? `Blood ${m.blood || 0} · ` : ''}Armor 토큰 ${m.armor} · Activation 토큰 ${m.tokens.map(t => t.type + (t.ready ? '' : '(사용)')).join(', ') || '없음'}`)) },
      h('b', {}, '#' + m.n + (m.decoying ? ' (Decoying)' : '')), h('div', { class: 'small' }, known ? m.card.name : `BP${m.card.level} ?`), h('div', { class: 'small muted' }, `${m.cells[0] ? clash.board.label(m.cells[0]) : m.mangrove ? `Mangrove #${m.mangrove}` : '보드 밖'}${known ? ' · AT ' + clash.mobAT(m) : ''}${known && m.card.toughness ? ` · Toughness ${m.gen || 0}/${m.card.toughness}` : ''}${m.armor ? ' 🛡' + m.armor : ''}${clash.bloodOn ? ' 🩸' + (m.blood || 0) : ''}`), m.tokens.length ? h('div', { class: 'small', style: 'color:' + (m.tokens.some(t => t.ready) ? 'var(--rose)' : 'var(--muted)') }, m.tokens.map(t => t.type).join('+')) : null); })) : null,
  M.isMob ? h('div', { class: 'small muted' }, `Rear: 각 Mob 바로 뒤 1칸 · ${(clash.monsterDef.basicAbilities || []).map(b => b.name).join(', ')}`) : null,
  clash.tactics ? h('div', { class: 'small' }, `Battle Tactics: ${clash.tactics.name} · Target ${clash.tactics.ops.target}${clash.troll ? ` · White Ape Troll ${clash.troll.trollTokens}/4` : clash.trollFled ? ' · Troll 도망' : ''}`) : null,
  M.isMob && M.hasTrait('Necrofusion') ? h('div', { class: 'small' }, `Necrofusion 토큰 ${clash.necro}/3`) : null,
  clash.bloodOn ? h('div', { class: 'small' }, `🩸 기사 Blood: ${clash.knights.filter(k => k.alive).map(k => `${k.name} ${k.blood}`).join(' · ')}${M.hasTrait('Red Soil') ? ` · Red Soil ${clash.redSoil}` : ''}${clash.burrowChoice ? ' · Burrow X 선택 가능' : ''}`) : null,
  h('div', { class: 'small row', style: 'margin:4px 0' }, `AI 덱 ${M.ai.size}${M.ai.cards[0] && M.ai.cards[0].faceUp ? ` (앞면 · 맨 위: ${M.ai.cards[0].name})` : ''}`, pileBtn('AI 버림', M.ai.discard, aiView), M.isMob ? `BP 풀 L1 ${M.bpPool[1].size} / L2 ${M.bpPool[2].size} / L3 ${M.bpPool[3].size}` : `BP 덱 ${M.bp.size}${M.bp.cards[0] && M.bp.cards[0].faceUp ? ` (앞면 · 맨 위: ${M.bp.cards[0].name})` : ''}`, M.isMob ? null : pileBtn('BP 버림', M.bp.discard, bpView), h('span', { class: 'muted' }, `Esc AI2 ${M.aiEsc[2].size} AI3 ${M.aiEsc[3].size} · BP2 ${M.bpEsc[2].size} BP3 ${M.bpEsc[3].size}`)),
  clash.traps && clash.traps.length ? h('div', { class: 'small' }, '설치: ' + clash.traps.map(tr => `${tr.g.name} ${tr.kind === 'bait' ? '☠' : '✸'} ${tr.cells.map(c => clash.board.label(c)).join(',')}`).join(' · ')) : null,
  clash.isBw ? h('div', { class: 'small' }, `Bog track: ${clash.monsterDef.bw.track.map((t, i) => i === clash.bw.track ? '▶' + t : t).join(' → ')}${clash.bw.off ? ' · Witch 보드 밖' : ''}${clash.bw.wisp ? ' · Mud Wisp ' + clash.board.label(clash.bw.wisp) : ''}${M.hasTrait('Cookie Crumbs') ? ' · Crumbs ' + clash.bw.crumbs : ''}`) : null,
  clash.isBw ? h('div', { class: 'small' }, `Hex: ${clash.knights.filter(k => (k.hexes || []).length).map(k => `${k.name} — ${k.hexes.map(x => x.ops.hex.name + (x._tok ? `(${x._tok})` : '')).join(', ')}`).join(' · ') || '없음'}${clash.bw.party.length ? ' · Party: ' + clash.bw.party.map(x => x.ops.hex.name).join(', ') : ''}`) : null,
  clash.isLh ? h('div', { class: 'small' }, `Taunt & Decoy 토큰 ${clash.lh.tokens} · Decoy ${M.mobs.filter(m => m.decoying).length}${clash.tactics ? ' · ' + clash.tactics.name : ''}`) : null,
  clash.isKe ? h('div', { class: 'small' }, `${clash.ke.berserk ? '🔥 BERSERK (Priority Target 토큰 보유)' : 'Berserk 아님'} · 🛡 Armor 토큰 ${clash.ke.armor}${M.hasTrait('Brute') ? ` · Brute ${clash.ke.brute}/3` : ''} · Fleisch ${clash.poolCount('fleisch')}`) : null,
  clash.isYdd ? h('div', { class: 'small' }, `🐉 ${['', 'Phase I — Flying High (To Hit +4, Ruined Wall +2, Terrain·VP·Lunge 0 · Climb 실패)', 'Phase II — Floating Low (To Hit +2, Terrain·VP·Lunge 0)', 'Phase III — Grounded (Crash = Devour, Climb +3)'][clash.ydd.phase]} · Wound ${clash.monster.wounds} (3 → II, 6 → III) · Divine Target: ${(clash.divineTarget || {}).name || '—'} · Called by the Heavens: ${clash.knights.filter(k => k.alive && clash.hasCondition(k, 'Called by the Heavens')).map(k => k.name).join(', ') || '—'} · VP: ${(clash.vpKnight() || {}).name || '비어 있음'} · Devoured: ${clash.ydd.devoured.map(k => k.name).join(', ') || '—'}`) : null,
  clash.isPv ? h('div', { class: 'small' }, `🪲 Armor 토큰 — Field ${clash.pv.armor.field} (Knight Pool, 공격마다 토큰 ${clash.pv.armor.field}개 버림) · Dragon ${clash.pv.armor.dragon} (AT +${clash.pv.armor.dragon}) · Remnant ${clash.pv.armor.remnant}/7 (패배) · Mortal Retribution ${clash.pv.mortal}/8 · Divine Target: ${(clash.divineTarget || {}).name || '—'} · VP: ${clash.dg.vp ? ((clash.vpKnight() || {}).name || '비어 있음') : '없음'}`) : null,
  clash.isTd ? h('div', { class: 'small' }, `🐸 AI 덱 ${clash.monster.ai.cards.length}장 + Crescendo (바닥나면 패배) · Toadlet 보드 ${clash.td.toads.length} / Sheet ${clash.td.sheet} (2개 → Signature) · VP: ${clash.dg.vp ? ((clash.vpKnight() || {}).name || '비어 있음') : '없음'}${clash.td.halfResist ? ' · Resist 절반' : ''}`) : null,
  clash.isPke ? h('div', { class: 'small' }, `👑 King Armor 토큰 ${clash.pke.armor}/5 (AT +${clash.pke.armor}) · Fallen Knights ${clash.guardians.length} · FK 토큰 ${clash.pke.tokens}/2 · VP: ${(clash.vpKnight() || {}).name || '—'} · Loose String: ${clash.pkeStrings().map(c => clash.board.label(c)).join(', ') || '—'} · Subjugated: ${clash.knights.filter(k => k.alive && clash.hasCondition(k, 'Subjugated')).map(k => k.name).join(', ') || '—'}`) : null,
  clash.isDsf ? h('div', { class: 'small' }, `⛓ Devil의 Armor 토큰 ${clash.dsf.armor} (AT +${clash.dsf.armor}) · Oubliette 카드 ${clash.dsf.oub} (Escape ${clash.dsfEscapeCost()}) · Oubliette: ${clash.knights.filter(k => k.alive && k.inOub).map(k => k.name).join(', ') || '—'} · Panzergate: ${clash.knights.filter(k => k.alive && k.panzergate > 0).map(k => k.name).join(', ') || '—'} · Fool's deck ${clash.dvFools.length}`) : null,
  clash.isDad ? h('div', { class: 'small' }, `🌊 Swamp 타일(행: 왼쪽/오른쪽 열): ${clash.dad.pairs.map(p => `${clash.board.rowLabels[p.rows[0]]}${clash.board.rowLabels[p.rows[1]]} ${p.L}/${p.R}`).join(' · ')}${clash.dad.noDeluge || clash.dad.flags.noDeluge ? ' · Deluge 비활성' : ''} · Fool's deck ${clash.dvFools.length}${clash.dv.reveal && clash.dvFools[0] ? ` (맨 위: ${clash.dvFools[0].name} ${clash.dvFools[0].letter})` : ''}`) : null,
  clash.isKl ? h('div', { class: 'small' }, `👑 VP: ${clash.kl.vp ? (clash.vpKnight() ? clash.vpKnight().name + ' 탑승' : '열림 (Climb: Insight 7+)') : '잠김 (Wound 6+에 생성)'}${clash.monster.hasTrait('Putrid Penance') ? ` · Putrid Penance ${clash.kl.penance}/4` : ''} · Malediction: ${clash.klHolder() ? clash.klHolder().name : '—'} · Drill Knockback ${clash.klKnockY()}`) : null,
  clash.isSm ? h('div', { class: 'small' }, `🛡 Ward Node (Armor 토큰): ${clash.smNodeText()}${clash.sm.locked || clash.sm.lockKR ? ' · 획득 불가' : ''}`) : null,
  M.isMob ? h('div', { class: 'small' }, `AT 보너스 +${M.bonuses.at + M.modifiers.at} · Vigor 손실 보너스 +${M.bonuses.vigorLoss || 0}${clash.mobArmorDisabled ? ' · Armor 토큰 효과 없음' : ''}`) :
  h('div', { class: 'small' }, `AT 보너스 +${M.bonuses.at + M.modifiers.at} · Armor 토큰 BP1 ${clash.armorTokens[1]} / BP2 ${clash.armorTokens[2]} / BP3 ${clash.armorTokens[3]}${M.hasTrait('Jacked') ? ' · Jacked ' + clash.jackedTokens : ''} · Counter ${M.generic.counter || 0}/3`),
  h('div', {}, [...M.traits].map(t => { const td = clash.monsterDef.traits.find(x => x.name === t); return h('span', { class: 'tag link' + (M.disabledTraits.has(t) ? ' muted' : ''), onclick: () => openModal(`Trait — ${t}`, h('div', { class: 'cardview' }, h('div', { class: 'cv-title' }, t + (td && td.level ? ` (Lv${td.level})` : '')), h('div', { class: 'cv-text' }, td ? td.text : '설명 없음'), M.disabledTraits.has(t) ? h('div', { class: 'warn small' }, '비활성') : null)) }, t); })),
  h('div', { class: 'small' }, h('b', {}, 'Knight Pool: '), clash.pool.length ? poolChips(clash.pool) : '비어 있음', clash.ls() ? ` · 🐒 Little Ser: ${clash.lsLabel()}` : ''),
  h('div', { class: 'small muted' }, `Judicium 덱: ${[...clash.judiciumBase, ...clash.judiciumExtra].map(c => c.name).join(', ')}`),
  mercPane(),
); };
const logPane = () => h('div', { class: 'log' }, clash.log.slice(-300).map(l => h('div', { class: l.kind }, l.msg)));

// ---------- bottom sheet (ask) ----------
const answer = v => { const p = pending; pending = null; p.res(v); render(); };
let diceSel = new Set(); let orderSel = []; let previewSel = 0;
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
  if (q.preview === 'path') return h('div', { class: 'sheet' },
    h('div', { class: 'q' }, title), q.text ? h('div', { class: 'small', style: 'margin-bottom:8px' }, q.text) : null,
    h('div', { class: 'opts' }, opts.map((o, i) => h('button', { class: 'tog' + (i === previewSel ? ' on' : ''), onclick: () => { previewSel = i; render(); } }, `${o.label} (${(o.path || []).length}칸)`))),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { const v = opts[previewSel] ? opts[previewSel].value : opts[0].value; previewSel = 0; answer(v); } }, '이 경로로 확정')));
  const numeric = q.type === 'number';
  const curCard = clash && clash.currentAttack && clash.currentAttack.card;
  return h('div', { class: 'sheet' },
    h('div', { class: 'q' }, who ? `${who.name} — ` : '', title),
    q.text ? h('div', { class: 'small', style: 'margin-bottom:8px' }, q.text) : null,
    curCard ? h('div', { class: 'small link', style: 'margin-bottom:8px;color:var(--gold)', onclick: () => openModal('해결 중인 공격 카드', aiView(curCard)) }, `▸ 해결 중인 카드 보기: ${curCard.name || 'Attack'}`) : null,
    q.type === 'move' ? h('div', { class: 'row' }, /Displace/.test(q.text || '') ? null : h('button', { onclick: () => answer(null) }, '이동 안 함')) : null,
    h('div', { class: 'opts' + (numeric ? ' num' : '') }, opts.filter(o => q.type !== 'move').map(o => h('button', { class: (o.value === 'attack' || o.value === true || (numeric && o.value === q.default) ? 'primary' : '') + (o.detail ? ' wide' : ''), onclick: () => answer(o.value) }, o.detail ? [h('b', {}, o.label), h('div', { class: 'small optd' }, o.detail)] : o.label))),
  );
};

// ---------- clash screen (ATO-style: board + monster left, prompt + knights + log right; stacks on phones) ----------
const renderClash = () => {
  const done = clash.result;
  const header = h('div', { class: 'row bhead' }, h('b', { style: 'color:var(--gold)' }, `${clash.monster.name} Lv${clash.monster.level}`), h('span', { class: 'small muted' }, `라운드 ${clash.round} · 시드 ${clash.rng.seed}`), done ? h('span', { class: done === 'win' ? 'good' : 'err' }, done === 'win' ? ' 승리!' : ' 패배') : null, h('span', { style: 'flex:1' }), h('label', { class: 'small muted', title: '주사위·카드 결과를 화면 가운데에 잠깐 표시' }, h('input', { type: 'checkbox', checked: flashOn ? '' : null, style: 'min-height:auto', onchange: e => { flashOn = e.target.checked; try { localStorage.setItem('kf.flash', flashOn ? '1' : '0'); } catch (er) { } } }), ' 결과 팝업'), camp ? null : h('button', { class: 'sm', onclick: () => { screen = 'home'; clash = null; pending = null; render(); } }, done ? '처음으로' : '중단'));
  const prompt = pending ? sheet() : h('div', { class: 'sheet idle' }, h('span', { class: 'small muted' }, done ? 'Clash 종료' : '진행 중…'));
  document.body.classList.add('wide');
  const keep = id => { const e = document.getElementById(id); return e ? { top: e.scrollTop, bottom: e.scrollHeight - e.scrollTop - e.clientHeight < 40 } : null; };
  const was = { lpane: keep('lpane'), mpane: keep('mpane'), kpane: keep('kpane') };
  app.replaceChildren(h('div', { class: 'battle' },
    h('div', { class: 'bleft' }, header, h('div', { id: 'board' }, renderBoard()), h('div', { id: 'mpane', class: 'pane' }, monsterPane())),
    h('div', { class: 'bright' }, prompt, h('div', { id: 'kpane', class: 'kstat' }, clash.knights.map(knightBox)), h('div', { id: 'lpane', class: 'pane' }, logPane())),
  ), modalEl());
  const lp = document.getElementById('lpane'); if (lp) lp.scrollTop = !was.lpane || was.lpane.bottom ? lp.scrollHeight : was.lpane.top; // log sticks to the bottom unless the reader scrolled up
  for (const id of ['mpane', 'kpane']) { const e = document.getElementById(id); if (e && was[id]) e.scrollTop = was[id].top; }
};
const render = () => { setTimeout(syncGearChoice, 0);
  if (!(screen === 'clash' && clash)) document.body.classList.remove('wide');
  if (screen === 'clash' && clash) return renderClash();
  if (camp && screen === 'map') { renderMap(); if (pending) app.append(sheet()); return; }
  if (camp && screen === 'encounter') return renderEncounter();
  if (camp && screen === 'aftermath') { renderAftermath(); if (pending) app.append(sheet()); return; }
  if (camp && screen === 'outpost') { renderOutpost(); if (pending) app.append(sheet()); if (modal) app.append(modalEl()); return; }
  if (camp && screen === 'camplog') return renderCampLog();
  renderHome();
};
render();
mountMonsterInfo(DATA, h, () => (clash && clash.monsterDef && clash.monsterDef.id) || null);
