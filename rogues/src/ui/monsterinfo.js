// Monster info viewer (floating 👁 button): Sheet levels · Traits · AI / BP / Signature / Routine · Clash Setup · rulings.
// Shows every monster in data/monsters plus owner-confirmed transcriptions that the engine does not implement yet (DATA.rawMonsters).
const arr = x => x == null ? [] : Array.isArray(x) ? x : [x];
const rwName = w => { const t = typeof w === 'string' ? w : JSON.stringify(w); return t.replace(/^targeting$/, 'Targeting 뒤').replace(/^effect:(\d+)$/, (_, n) => `효과 ${+n + 1}번째 줄 뒤`).replace(/^moveTag$/, '이동 태그 뒤').replace(/^afterAttack$/, 'After Attack 뒤').replace(/^afterFinalAttack$/, 'After Final Attack 뒤'); };

/** Normalise a data monster or a raw transcription into one shape. */
export const normaliseMonster = (m, raw = false) => {
  if (!raw) return { id: m.id, name: m.name, kind: m.kind, playable: !!m.clashSetup, traitsLine: m.traitsLine, levels: m.levels, basic: m.basicAbilities || [], footprint: m.footprint, traits: m.traits || [], ai: m.cards.ai, bp: m.cards.bp, signature: m.cards.signature, routine: m.cards.routine, extra: [...(m.guardian ? [{ title: 'Firstman Guardian — Coordinated Attack', ai: m.guardian.attack }, { title: 'Firstman Guardian — Trait BP', bp: m.guardian.bp, note: `Limit ${Object.entries(m.guardian.limit).map(([l, n]) => `Lv${l}: ${n}`).join(' · ')}` }] : []), ...(m.battleTactics ? Object.values(m.battleTactics).filter(x => x && x.name).map(x => ({ title: `Battle Tactics — ${x.name}`, text: [x.tacticsTarget && 'Tactics Target: ' + x.tacticsTarget, x.extraLine, x.tacticA, x.tacticB, x.endOfMonsterRound && 'End of Monster Round: ' + x.endOfMonsterRound].filter(Boolean).join('\n') })) : [])], setup: m.clashSetup, rulings: m.rulings || [] };
  const S = m.sheet || {};
  return { id: 'raw:' + S.name, name: S.name, kind: /boss|vassal/i.test(JSON.stringify(m._notes || '')) ? 'boss' : 'mob', playable: false, rawOnly: true, traitsLine: S.traitsLine, levels: S.levels, basic: S.basicAbilities || [], footprint: S.facingDiagram, traits: S.traits || [], ai: m.ai || [], bp: m.bp || [], signature: m.signature, routine: m.routine, extra: arr(m.extra).map(x => ({ title: `${x.kind || ''} — ${x.name}`, text: x.text })), setup: null, rulings: [] };
};

/** Full card renderers (shared by the monster info viewer and the Clash screen). */
export const makeCardViews = h => {
  const line = (label, v) => arr(v).filter(Boolean).length ? h('div', { class: 'mi-l' }, h('b', {}, label + ' '), arr(v).filter(Boolean).join(' ')) : null;
  const react = c => { const w = [...arr(c.reactWindows || c.react), ...(c.aiResponseReactMarker ? ['AI Response 앞'] : [])]; return w.length ? h('div', { class: 'mi-react' }, 'REACT! ' + w.map(rwName).join(' · ')) : null; };
  const gate = g => h('div', { class: 'mi-gate' }, `[${g.stat} ${g.gte ?? (g.lte != null ? '≤' + g.lte : g.eq ?? '')}${g.gte != null ? '+' : ''} ▸ ${g.effect}]`);
  const aiCard = c => h('div', { class: 'mi-card ai' },
    h('div', { class: 'mi-h' }, h('span', { class: 'mi-lv' }, c.level ? 'AI ' + c.level : (c.type || '').toUpperCase() === 'SIGNATURE' || !c.level ? 'SIG' : ''), h('b', {}, c.name), h('span', { class: 'mi-sub' }, `${c.type || ''}${c.evasionDice != null ? ` · 회피 ${c.evasionDice}d ${c.evasionDifficulty}+` : ''}`)),
    line('', c.preTargeting), h('div', { class: 'mi-l' }, h('b', {}, 'Targeting '), arr(c.targeting).map((t, i) => h('div', { class: 'mi-b' }, `${i + 1}. ${t}`))),
    c.moveTag ? h('div', { class: 'mi-tag' }, c.moveTag) : (c.move ? h('div', { class: 'mi-tag' }, 'MOVE & ATTACK') : null), ...arr(c.gates).map(gate),
    ...arr(c.effects).map(e => h('div', { class: 'mi-b' }, e)), line('After Attack:', c.afterAttack), line('After Final Attack:', c.afterFinalAttack), line('AI Response:', c.aiResponse), line('Doppelganger:', c.doppelganger), line('', c.bottomBox), react(c));
  const bpCard = c => h('div', { class: 'mi-card bp' },
    h('div', { class: 'mi-h' }, h('span', { class: 'mi-lv' }, 'BP ' + c.level), h('b', {}, c.name), h('span', { class: 'mi-sub' }, `AT ${c.at}`)),
    c.overcome ? h('div', { class: 'mi-tag' }, `${c.overcomeTag || 'OVERCOME'} ${String(c.overcome.n).replace(/\+$/, '')}+ ▸ ${c.overcome.effect || ''}`) : null,
    ...['wound', 'fail', 'instinct', 'critical'].map(k => line(k[0].toUpperCase() + k.slice(1) + ':', (c.responses || {})[k])), line('When revealed:', c.whenRevealed), line('', c.whileRevealed), react(c),
    c.back ? h('div', { class: 'mi-back' }, h('b', {}, `뒷면 — ${c.back.name} (AT ${c.back.at})`), ...['wound', 'fail', 'instinct', 'critical'].map(k => line(k[0].toUpperCase() + k.slice(1) + ':', (c.back.responses || {})[k])), line('When revealed:', c.back.whenRevealed), line('', c.back.whileRevealed)) : null);
  return { line, react, gate, aiCard, bpCard };
};

export const mountMonsterInfo = (DATA, h, current) => {
  const list = [...Object.values(DATA.monsters || {}).map(m => normaliseMonster(m)), ...Object.values(DATA.rawMonsters || {}).map(m => normaliseMonster(m, true))].sort((a, b) => a.name.localeCompare(b.name));
  const { line, aiCard, bpCard } = makeCardViews(h);
  const setupView = cs => { if (!cs) return h('div', { class: 'mi-l muted' }, '이 왕국의 Clash Setup 미입수 또는 엔진 미구현'); const pos = [cs.monsterCells && `몬스터 ${cs.monsterCells.join('/')}${cs.facing ? ' (방향 ' + cs.facing + ')' : ''}`, cs.mobStart && `Mob ${arr(cs.mobStart).map(x => typeof x === 'string' ? x : `${x.cell}${x.facing ? '→' + x.facing : ''}`).join(', ')}`, cs.guardians && `Guardian ${cs.guardians.map(g => g.cell).join(', ')}`, (cs.knightStart || cs.knights) && `기사 ${arr(cs.knightStart || cs.knights).join(', ')}`].filter(Boolean);
    return h('div', {}, ...arr(cs.steps).map((s, i) => h('div', { class: 'mi-b' }, `${i + 1}. ${s}`)), ...pos.map(p => h('div', { class: 'mi-l' }, p)), ...arr(cs.terrain).map(t => h('div', { class: 'mi-b' }, `${t.tile}${t.size ? ' ' + t.size : ''}: ${arr(t.cells).join(', ')}`))); };
  const page = m => { const lv = Object.entries(m.levels || {}); const sec = (t, ...k) => h('details', { class: 'mi-sec', open: '' }, h('summary', {}, t), ...k);
    return h('div', { class: 'mi-page' },
      h('div', { class: 'mi-top' }, h('b', {}, m.name), ' ', h('span', { class: 'mi-sub' }, `${arr(m.traitsLine).join(' · ')} · ${m.kind === 'mob' ? 'Mob Clash' : 'Boss Clash'}${m.rawOnly ? ' · 전사 완료, 엔진 미구현' : m.playable ? '' : ' · 선택 불가'}`)),
      sec('Monster Sheet', h('table', { class: 'mi-t' }, h('tr', {}, ...['Lv', 'To Hit', 'Wounds', '활성화', '보너스', '+Trait'].map(x => h('th', {}, x))), ...lv.map(([l, v]) => h('tr', {}, h('td', {}, l), h('td', {}, v.toHit + '+'), h('td', {}, v.wounds ?? '-'), h('td', {}, arr(v.activations).join(',')), h('td', {}, Object.entries(v.bonuses || {}).filter(([, n]) => n).map(([k, n]) => `${k} +${n}`).join(', ')), h('td', {}, arr(v.traitsAdd).join(', '))))),
        m.footprint ? h('div', { class: 'mi-l' }, `Footprint ${m.footprint.shape || m.footprint.footprint || ''} · Rear: ${m.footprint.rear || '-'}${m.footprint.blindspots ? ' · Blindspot: ' + m.footprint.blindspots : ''}`) : null,
        ...m.basic.map(b => h('div', { class: 'mi-l' }, h('b', {}, `${b.name}${b.value ? ' ' + b.value : ''}`), b.rule ? ' — ' + b.rule : ''))),
      sec(`Traits (${m.traits.length})`, ...m.traits.map(t => h('div', { class: 'mi-card' }, h('div', { class: 'mi-h' }, h('span', { class: 'mi-lv' }, 'Lv ' + t.level), h('b', {}, t.name)), ...String(t.text || '').split('\n').filter(Boolean).map(p => h('div', { class: 'mi-b' }, p))))),
      sec(`AI 카드 (${m.ai.length})`, ...[...m.ai].sort((a, b) => a.level - b.level).map(aiCard)),
      m.signature ? sec('Signature · Routine', aiCard({ ...m.signature, level: null }), m.routine ? h('div', { class: 'mi-card' }, h('div', { class: 'mi-h' }, h('span', { class: 'mi-lv' }, 'ROUTINE'), h('b', {}, m.routine.name)), ...arr(m.routine.effects || m.routine.text).map(e => h('div', { class: 'mi-b' }, e))) : null) : null,
      sec(`BP 카드 (${m.bp.length})`, ...[...m.bp].sort((a, b) => String(a.level).localeCompare(String(b.level))).map(bpCard)),
      m.extra.length ? sec('추가 카드', ...m.extra.map(x => h('div', {}, h('div', { class: 'mi-l' }, h('b', {}, x.title), x.note ? ' · ' + x.note : ''), x.ai ? aiCard(x.ai) : null, x.bp ? bpCard(x.bp) : null, x.text ? h('div', { class: 'mi-card' }, ...String(x.text).split('\n').filter(Boolean).map(p => h('div', { class: 'mi-b' }, p))) : null))) : null,
      sec('Clash Setup', setupView(m.setup)),
      m.rulings.length ? sec(`규칙 해석 (${m.rulings.length})`, ...m.rulings.map(r => h('div', { class: 'mi-b' }, '• ' + r))) : null);
  };
  const sel = h('select', {}, ...list.map(m => h('option', { value: m.id }, m.name + (m.rawOnly ? ' (미구현)' : ''))));
  const body = h('div', { class: 'mi-body' });
  const show = id => { const m = list.find(x => x.id === id) || list[0]; if (!m) return; sel.value = m.id; body.replaceChildren(page(m)); body.scrollTop = 0; };
  const box = h('div', { class: 'mi-box', style: 'display:none' }, h('div', { class: 'mi-bar' }, h('b', {}, '몬스터 정보'), sel, h('button', { class: 'sm', onclick: () => { box.style.display = 'none'; } }, '닫기')), body);
  sel.addEventListener('change', () => show(sel.value));
  const btn = h('button', { class: 'mi-btn', title: '몬스터 정보 (레벨 · Trait · AI · BP · Setup)', onclick: () => { const open = box.style.display === 'none'; box.style.display = open ? 'flex' : 'none'; if (open) show((current && current()) || sel.value); } }, '👁 몬스터');
  const st = h('style', {}, `.mi-btn{display:block;margin:6px 10px 0 auto;padding:5px 9px;border-radius:8px;border:1px solid #8a6d3b;background:#221c17;color:#eadfc8;font-size:13px}
.mi-box{position:fixed;inset:0;z-index:800;flex-direction:column;background:#17130f;color:#eadfc8}
.mi-bar{display:flex;gap:8px;align-items:center;padding:8px 10px calc(8px);border-bottom:1px solid #4a3d2c}.mi-bar select{flex:1;min-width:0;padding:5px;background:#221c17;color:#eadfc8;border:1px solid #4a3d2c;border-radius:6px}
.mi-body{flex:1;overflow:auto;padding:8px 10px calc(16px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}.mi-page{max-width:760px;margin:0 auto}
.mi-top{font-size:17px;margin-bottom:6px}.mi-sub{font-size:12px;color:#a8997f;font-weight:normal}
.mi-sec{margin:8px 0;border:1px solid #3a3024;border-radius:8px;padding:4px 8px}.mi-sec>summary{font-weight:bold;padding:4px 0;cursor:pointer;color:#e2b860}
.mi-card{border:1px solid #4a3d2c;border-left:3px solid #6b5a4a;border-radius:6px;padding:6px 8px;margin:6px 0;background:#1f1a14;font-size:13px;line-height:1.45}.mi-card.ai{border-left-color:#b5483a}.mi-card.bp{border-left-color:#4f7fb5}
.mi-h{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;margin-bottom:2px}.mi-lv{font-size:11px;padding:0 5px;border-radius:4px;background:#3a3024;color:#e2b860}
.mi-l{font-size:13px;margin:2px 0;line-height:1.45}.mi-b{font-size:13px;margin:1px 0 1px 6px;line-height:1.45}.mi-tag{display:inline-block;margin:3px 0;padding:1px 6px;border-radius:4px;background:#5a231c;color:#ffd9c9;font-size:12px;font-weight:bold}
.mi-gate{font-size:12px;color:#ffb37a;margin-left:6px}.mi-react{font-size:11px;color:#7fb3ff;margin-top:3px}.mi-back{margin-top:5px;padding-top:4px;border-top:1px dashed #555}
.mi-t{width:100%;border-collapse:collapse;font-size:12px;margin:4px 0}.mi-t th,.mi-t td{border:1px solid #3a3024;padding:3px 4px;text-align:left;vertical-align:top}.muted{color:#a8997f}`);
  document.head.append(st); document.body.prepend(btn); document.body.append(box);
  return { show: id => { box.style.display = 'flex'; show(id); } };
};
