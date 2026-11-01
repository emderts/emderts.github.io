// Monster state + Escalation Chart (rulebook pp.60–61) with synthetic cards (6 per level, like Eggknight).
import { Rng } from '../src/engine/core.js';
import { Monster } from '../src/engine/monster.js';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const mkCards = () => ({ ai: [1, 2, 3].flatMap(l => [1, 2, 3, 4, 5, 6].map(i => ({ name: `AI${l}-${i}`, level: l }))), bp: [1, 2, 3].flatMap(l => [1, 2, 3, 4, 5, 6].map(i => ({ name: `BP${l}-${i}`, level: l, at: l + 2 }))) });
const def = { id: 'x', name: 'X', levels: { 1: { toHit: 6, wounds: 8, traitsAdd: ['A'] }, 2: { toHit: 7, wounds: 10, bonuses: { at: 2 }, traitsAdd: ['B'], traitsRemove: ['A'] } }, cards: mkCards() };
const mk = (lv = 1) => new Monster(def, lv, new Rng(3));
const lv = d => [...d.cards, ...d.discard].map(c => c.level).sort().join('');
{ const m = mk(); ok(m.ai.size === 6 && m.bp.size === 6 && m.aiEsc[2].size === 6 && m.bpEsc[3].size === 6, 'level-1 cards in decks, 2/3 in escalation decks'); ok(m.hasTrait('A') && !m.hasTrait('B'), 'level 1 traits'); }
{ const m = mk(2); ok(m.toHit === 7 && m.bonuses.at === 2 && m.hasTrait('B') && !m.hasTrait('A'), 'level 2: stats, AT bonus, trait removed'); ok(m.atOf({ at: 3 }) === 5, 'AT = printed + bonus'); }
{ const m = mk(); const c = m.drawBP(); m.wound(c); ok(m.wounds === 1 && lv(m.ai) === '111112' && lv(m.bp) === '111112', 'BP1 wound: AI 1 removed + AI 2 added; BP 2 added (deck 5+1)'); }
{ const m = mk(); const c = { name: 'BP2-x', level: 2, at: 4 }; m.wound(c); ok(lv(m.ai) === '111113' && lv(m.bp) === '1111113', 'BP2 wound: AI 2 (none) → removed lowest (AI 1), added AI 3; BP 3 added'); }
{ const m = mk(); const c = { name: 'BP3-x', level: 3, at: 5 }; const d = m.wound(c); ok(d === 2 && m.woundStack[0].generic === 'double' && m.setAsideBp3 === null && lv(m.bp) === '1111133', 'BP3 wound: Double Wound, lowest removed, BP 3 added, set-aside card at bottom (5+1+1)'); ok(m.bp.cards.at(-1) === c, 'set-aside BP 3 is the bottom card'); }
{ const m = mk(); const c = { name: 'BP3-x', level: 3, at: 5 }; m.wound(c, { critical: true }); ok(m.woundStack[0].card === c && m.woundStack[0].wounds === 2 && lv(m.bp) === '1111133', 'BP3 critical: card itself is the Double Wound, two BP 3 added'); }
{ const m = mk(); m.bp.cards = [{ name: 'a', level: 3, at: 5 }]; m.bp.discard = [{ name: 'b', level: 3, at: 5 }]; const c = { name: 'c', level: 3, at: 5 }; m.wound(c); ok(m.bp.cards.length === 3 && m.bp.cards.at(-1) === c, 'all BP 3: reshuffle discard, set-aside at bottom (no removal)'); }
{ const m = mk(); m.ai.cards = []; m.ai.discard = [{ name: 'AI1-d', level: 1 }, { name: 'AI1-e', level: 1 }]; m.escalateAI(1); ok(m.ai.discard.length === 0 && m.ai.cards.length === 2 && m.removed.length === 1, 'removing from the discard pile shuffles the discard into the deck'); }
{ const m = mk(); m.aiEsc[2].cards = []; m.aiEsc[3].cards = []; m.escalateAI(1); ok(m.noAiBonus === 1 && m.bonuses.vigorLossPerHit === 1, 'no AI 3 left → +1 Vigor loss per hit'); m.escalateAI(1); m.escalateAI(1); m.escalateAI(1); ok(m.bonuses.evasionDice === 1 && m.bonuses.at === 1 && m.toHit === 7, 'then +1 evasion die, +1 AT, +1 To Hit'); }
{ const m = mk(); m.escalateX(1); ok(lv(m.ai) === '111112' && lv(m.bp) === '111112' && m.wounds === 0, 'Escalate 1: lowest AI and BP escalated without a wound'); }
{ const m = mk(); for (let i = 0; i < 8; i++) m.addSingleWound(); ok(m.slain, 'slain when wounds ≥ Wounds value'); }
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
