// Kingdoms Forlorn — Rogue's Path: UI (vanilla JS, single page, mobile-first).
import { Game } from '../engine/game.js';

const DATA = window.KF_DATA;
const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};

const app = $('#app');
let game = null;

const render = () => {
  app.replaceChildren(
    h('h1', {}, "Kingdoms Forlorn — Rogue's Path"),
    h('p', { class: 'sub' }, `웹 싱글플레이 · v${DATA.meta.version} · 빌드 ${DATA.meta.builtAt.slice(0, 16).replace('T', ' ')} UTC`),
    h('div', { class: 'card' },
      h('h2', {}, '뼈대 단계'),
      h('p', { class: 'muted' }, '엔진·UI·데이터·빌드 파이프라인만 연결된 상태입니다. 룰·카드 데이터가 들어오면 여기서 캠페인이 시작됩니다.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => { game = new Game(DATA).setup({ knights: [{ name: 'Knight 1' }] }); render(); } }, '엔진 연결 테스트'),
        game && h('button', { onclick: () => { game.roll(10); render(); } }, 'd10 굴리기'),
      ),
      game && h('div', { class: 'log' }, game.log.map(l => h('div', { class: l.kind === 'dice' ? 'warn' : '' }, l.msg))),
    ),
    h('p', { class: 'small muted' }, h('a', { href: '../' }, '← ATO Mnestis Theatre')),
  );
};
render();
