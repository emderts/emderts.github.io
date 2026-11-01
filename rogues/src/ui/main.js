// Kingdoms Forlorn — Rogue's Path: UI (vanilla JS, single page, mobile-first).
import { Clash } from '../engine/clash.js';
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

const app = $('#app');
let screen = 'home'; let clash = null; let pending = null; let tab = 'log'; let seedInput = '';

// ---------- home ----------
const renderHome = () => {
  const mons = Object.values(DATA.monsters);
  app.replaceChildren(
    h('h1', {}, "Kingdoms Forlorn — Rogue's Path"),
    h('p', { class: 'sub' }, `웹 싱글플레이 · v${DATA.meta.version} · 빌드 ${DATA.meta.builtAt.slice(0, 16).replace('T', ' ')} UTC`),
    h('div', { class: 'card' },
      h('h2', {}, 'Clash 테스트 (Rosegraal 캠페인 UI는 다음 단계)'),
      h('div', { class: 'row' },
        h('label', {}, '몬스터 ', h('select', { id: 'mon' }, mons.map(m => h('option', { value: m.id }, m.name)))),
        h('label', {}, '레벨 ', h('select', { id: 'lv' }, [1, 2, 3, 4].map(l => h('option', { value: l }, `Lv ${l}`)))),
        h('label', {}, '시드 ', h('input', { id: 'seed', type: 'number', placeholder: '무작위', style: 'width:110px', value: seedInput })),
      ),
      h('p', { class: 'small muted' }, '기사: Fleischritter ×4 (시작 구성 — Fleischknecht, Knighves + Chipped Axe, 시작 기술 5장)'),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: startClash }, 'Clash 시작')),
    ),
    h('p', { class: 'small muted' }, h('a', { href: '../' }, '← ATO Mnestis Theatre')),
  );
};
const startClash = () => {
  const seed = +$('#seed').value || Math.floor(Math.random() * 1e9); seedInput = String(seed);
  clash = new Clash({ data: DATA, knights: [0, 1, 2, 3].map(i => ({ def: 'fleischritter', name: 'Fleischritter ' + (i + 1) })), monster: $('#mon').value, level: +$('#lv').value, kingdom: 'principality', seed, listeners: { log: () => scheduleRender() } });
  clash.ask = q => new Promise(res => { pending = { q, res }; render(); });
  clash.setup(); screen = 'clash'; tab = 'log'; render();
  clash.run().then(r => { pending = null; render(); });
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
  // monster footprint
  const mc = M.cells; const minC = Math.min(...mc.map(c => c.c)), maxC = Math.max(...mc.map(c => c.c)), minR = Math.min(...mc.map(c => c.r)), maxR = Math.max(...mc.map(c => c.r));
  s.append(svg('rect', { x: x(minC) + 1, y: y(maxR) + 1, width: (maxC - minC + 1) * CW - 2, height: (maxR - minR + 1) * CW - 2, rx: 2, class: 'mon' }));
  const cx = x(minC) + (maxC - minC + 1) * CW / 2, cy = y(maxR) + (maxR - minR + 1) * CW / 2; const d = DIRS[M.facing];
  s.append(svg('polygon', { points: `${cx + d.c * 7},${cy - d.r * 7} ${cx - d.r * 3 + d.c * 2},${cy - d.c * 3 - d.r * 2} ${cx + d.r * 3 + d.c * 2},${cy + d.c * 3 - d.r * 2}`, fill: '#ffd27a' }));
  s.append(svg('text', { x: cx, y: cy + 1.8, class: 'lbl' }, M.name[0]));
  for (const k of clash.knights) { if (!k.pos) continue; const dead = !k.alive, kd = clash.knockedDown(k); s.append(svg('circle', { cx: x(k.pos.c) + CW / 2, cy: y(k.pos.r) + CW / 2, r: CW * .4, class: 'kn' + (dead ? ' dead' : '') + (kd ? ' kd' : '') })); s.append(svg('text', { x: x(k.pos.c) + CW / 2, y: y(k.pos.r) + CW * .68, class: 'lbl' }, k.name.replace(/\D/g, '') || k.name[0])); }
  return s;
};

// ---------- panes ----------
const track = (cls, n, max, lim) => h('div', { class: 'track ' + cls }, Array.from({ length: max + 1 }, (_, i) => h('i', { class: (i <= n && i > 0 ? 'on' : '') + (lim != null && i === lim ? ' lim' : '') })));
const knightBox = k => h('div', { class: 'kbox' + (k.alive ? '' : ' dead') },
  h('div', {}, h('b', {}, k.name), ' ', h('span', { class: 'small muted' }, k.pos ? clash.board.label(k.pos) : '—'), k.alive ? '' : h('span', { class: 'err' }, ' ☠')),
  h('div', { class: 'small' }, `V ${k.vigor}/${k.maxVigor} (${k.peril()})`), track('v', k.vigor, 15),
  h('div', { class: 'small' }, `H ${k.heat} / 한계 ${k.heatLimit}`), track('h', k.heat, 9, k.heatLimit),
  h('div', { class: 'small' }, `P ${k.passion}${clash.priorityTarget === k ? ' · ★Priority' : ''}`), track('p', k.passion, 9),
  h('div', { class: 'small' }, `Bane ${k.bane}/${k.baneLimit} · 손패 ${k.hand.length} (CD ${k.cooldown.length} / DL ${k.delay.length} / DC ${k.discard.length})`),
  h('div', {}, k.conditions.map(c => h('span', { class: 'tag' }, c.id + (c.tokens ? ' ×' + c.tokens : ''))), k.gear.map(g => h('span', { class: 'tag', style: g.exhausted ? 'opacity:.5' : '' }, g.name))),
  h('div', { class: 'small muted' }, '손패: ' + k.hand.map(t => t.name).join(', ')),
);
const monsterPane = () => { const M = clash.monster; return h('div', {},
  h('div', {}, h('b', {}, `${M.name} Lv${M.level}`), ` · To Hit ${M.toHit + M.modifiers.toHit}+ · 방향 ${M.facing}`),
  h('div', {}, `Wound Stack ${M.wounds} / ${M.woundsToKill}`), track('v', M.wounds, M.woundsToKill),
  h('div', { class: 'small' }, `AI 덱 ${M.ai.size} (버림 ${M.ai.discard.length}) · BP 덱 ${M.bp.size} (버림 ${M.bp.discard.length}) · Esc AI2 ${M.aiEsc[2].size} AI3 ${M.aiEsc[3].size} · BP2 ${M.bpEsc[2].size} BP3 ${M.bpEsc[3].size}`),
  h('div', { class: 'small' }, `AT 보너스 +${M.bonuses.at + M.modifiers.at} · Armor 토큰 BP1 ${clash.armorTokens[1]} / BP2 ${clash.armorTokens[2]} / BP3 ${clash.armorTokens[3]}${M.hasTrait('Jacked') ? ' · Jacked ' + clash.jackedTokens : ''} · Counter ${M.generic.counter || 0}/3`),
  h('div', {}, [...M.traits].map(t => h('span', { class: 'tag' + (M.disabledTraits.has(t) ? ' muted' : '') }, t))),
  h('div', { class: 'small' }, h('b', {}, 'Knight Pool: '), clash.pool.length ? clash.pool.map(t => h('span', { class: 'chip' }, t.token)) : '비어 있음'),
  h('div', { class: 'small muted' }, `Judicium 덱: ${[...clash.judiciumBase, ...clash.judiciumExtra].map(c => c.name).join(', ')}`),
); };
const logPane = () => { const el = h('div', { class: 'log' }, clash.log.slice(-200).map(l => h('div', { class: l.kind }, l.msg))); setTimeout(() => { el.scrollTop = el.scrollHeight; }, 0); return el; };

// ---------- bottom sheet (ask) ----------
const answer = v => { const p = pending; pending = null; p.res(v); render(); };
let diceSel = new Set(); let orderSel = [];
const sheet = () => {
  if (!pending) return null; const q = pending.q;
  const title = { action: '행동 선택', move: '이동할 칸을 보드에서 탭하세요', dice: '재굴림할 주사위 선택', confirm: '확인', pickKnight: '기사 선택', weapon: '무기 선택', pick: '선택', heartseeker: 'Heartseeker — BP 선택', arcOption: 'Heroic Arc 옵션', number: '개수 선택', order: '순서 선택' }[q.type] || q.type;
  const who = q.knight ? clash.knights.find(k => k.id === q.knight) : null;
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
let raf = 0; const scheduleRender = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); };
const renderClash = () => {
  const done = clash.result;
  app.replaceChildren(h('div', { class: 'clash' },
    h('div', { class: 'row', style: 'margin:0' }, h('b', { style: 'color:var(--gold)' }, `${clash.monster.name} Lv${clash.monster.level}`), h('span', { class: 'small muted' }, `라운드 ${clash.round} · 시드 ${clash.rng.seed}`), done ? h('span', { class: done === 'win' ? 'good' : 'err' }, done === 'win' ? ' 승리!' : ' 패배') : null, h('span', { style: 'flex:1' }), h('button', { class: 'sm', onclick: () => { screen = 'home'; clash = null; pending = null; renderHome(); } }, done ? '처음으로' : '중단')),
    h('div', { id: 'board' }, renderBoard()),
    h('div', { class: 'tabs' }, ['log', 'knights', 'monster'].map(t => h('button', { class: tab === t ? 'on' : '', onclick: () => { tab = t; render(); } }, { log: '로그', knights: '기사', monster: '몬스터' }[t]))),
    h('div', { class: 'pane' }, tab === 'log' ? logPane() : tab === 'knights' ? h('div', { class: 'kstat' }, clash.knights.map(knightBox)) : monsterPane()),
    pending ? h('div', { style: 'height:40vh' }) : null,
  ), sheet());
};
const render = () => { if (screen === 'clash' && clash) renderClash(); else renderHome(); };
render();
