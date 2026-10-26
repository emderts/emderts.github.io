// Cycle III — Icarian Harpy (Rapid Adaptation, Predator, Regurgitate, Bleeding attacks, Pulls, Consume)
import { Board, key, cellLabel } from './core.js';

export const RA_SPACES = [
  { name: 'Sword', classes: ['Sword'] },
  { name: 'Knife & Spear', classes: ['Knife', 'Spear'] },
  { name: 'Club & Slabsword', classes: ['Club', 'Slabsword'] },
  { name: 'Cestus & Hammer & Discus', classes: ['Cestus', 'Hammer', 'Discus'] },
  { name: 'Shield', classes: ['Shield'] },
  { name: 'Whip & Axe & Other', classes: ['Whip', 'Axe'], other: true },
  { name: 'Javelin & Bow & Blade', classes: ['Javelin', 'Bow', 'Blade'] },
];
const ALL_CLASSES = RA_SPACES.flatMap(s => s.classes);

export function installHarpy(Game, { TitanDied, BattleOver }) {
  Object.assign(Game.prototype, {
    harpySetup() {
      const n = (this.prim.def.raTokens || {})[String(this.prim.level)] || 1;
      this.prim.ra = { supply: n, spaces: RA_SPACES.map(() => ({ n: 0, locked: false })) };
      this.prim.predGrace = 0;
      this.say(`Rapid Adaptation: Adaptation 토큰 ${n}개`, 'sys');
    },
    // ---------- Rapid Adaptation ----------
    raSpacesFor(g) {
      if (!g) return [5]; const own = this.titans.find(x => x.gear && x.gear.includes(g)); const tr = (own && this.gTraits) ? this.gTraits(own, g) : (g.card.traits || []); const out = [];
      RA_SPACES.forEach((s, i) => { if (s.classes.some(c => tr.includes(c))) out.push(i); });
      if (!out.length) out.push(5); // Other
      return out;
    },
    raCovered(i) { return this.prim.ra && this.prim.ra.spaces[i].n > 0; },
    raAdj(i) { const L = RA_SPACES.length; return [(i + 1) % L, (i + L - 1) % L].filter(j => this.raCovered(j)).length; },
    raIgnored(t, g) { if (!g || !t) return false; const tx = this.gearText(g, t); return /Ignore the Rapid Adaptation Trait|Ignore the Metamorphosis, Rapid Adaptation/.test(tx); },
    raBlocks(t, g, A) { if (!this.prim.ra || !this.trait('Rapid Adaptation') || (A && A.ignoreRA) || this.raIgnored(t, g)) return false; if ((A && A.quantum) || (g && /this Weapon can have any Weapon Trait/.test(g.card.text || ''))) return RA_SPACES.every((s, i) => this.raCovered(i)); return this.raSpacesFor(g).some(i => this.raCovered(i)); },
    raAT(t, g, A) { if (!this.prim.ra || !this.trait('Rapid Adaptation') || (A && A.ignoreRA) || this.raIgnored(t, g)) return 0; return Math.max(0, ...this.raSpacesFor(g).map(i => this.raAdj(i))); },
    raLabel() { const R = this.prim.ra; if (!R) return ''; return RA_SPACES.map((s, i) => `${s.name}${R.spaces[i].n ? (R.spaces[i].locked ? ' ●🔒' : ' ●') : ''}`).join(' · ') + ` (남은 토큰 ${R.supply})`; },
    async raPlace(t, g, opts = {}) {
      const R = this.prim.ra; if (!R) return;
      const cand = opts.space != null ? [opts.space] : this.raSpacesFor(g);
      const i = cand.length === 1 ? cand[0] : await this.ask({ type: 'choice', titan: t, title: 'Rapid Adaptation: 토큰을 놓을 무기 클래스 칸', options: cand.map(j => ({ label: RA_SPACES[j].name, value: j })) });
      if (R.supply > 0) { R.supply--; }
      else {
        const from = R.spaces.map((s, j) => j).filter(j => R.spaces[j].n > 0 && !R.spaces[j].locked && j !== i);
        if (!from.length) { this.say('Rapid Adaptation: 옮길 수 있는 토큰이 없음'); return; }
        const j = from.length === 1 ? from[0] : await this.ask({ type: 'choice', titan: t, title: `Rapid Adaptation: 남은 토큰이 없음 — ${RA_SPACES[i].name}(으)로 옮길 토큰 선택`, options: from.map(k => ({ label: RA_SPACES[k].name, value: k })) });
        R.spaces[j].n--; this.say(`Rapid Adaptation: ${RA_SPACES[j].name}의 토큰을 옮김`);
      }
      R.spaces[i].n++; this.say(`🧬 Rapid Adaptation: ${RA_SPACES[i].name} 칸에 토큰 — 이 클래스로는 Wound 불가, 인접 칸 클래스는 AT +1`, 'ai'); this.notify();
    },
    async raDiscard(fromBattle) {
      const R = this.prim.ra; if (!R) return false; const list = R.spaces.map((s, j) => j).filter(j => R.spaces[j].n > 0 && !R.spaces[j].locked);
      if (!list.length) return false;
      const j = list.length === 1 ? list[0] : await this.ask({ type: 'choice', title: `Rapid Adaptation 토큰 1개 ${fromBattle ? '전투에서 제거' : '보드에서 제거'}`, options: list.map(k => ({ label: RA_SPACES[k].name, value: k })) });
      R.spaces[j].n--; if (!fromBattle) R.supply++; this.say(`Rapid Adaptation: ${RA_SPACES[j].name} 토큰 ${fromBattle ? '전투에서 제거' : '보드에서 제거 (공급으로)'}`, 'good'); this.notify(); return true;
    },
    async raPerfection() {
      const R = this.prim.ra; if (!R) return; const list = R.spaces.map((s, j) => j).filter(j => R.spaces[j].n > 0 && !R.spaces[j].locked);
      if (!list.length) return; const j = this.rng.pick(list); R.spaces[j].locked = true; this.say(`Perfection: ${RA_SPACES[j].name} Adaptation 토큰 고정 (전투 끝까지 이동/제거 불가)`, 'ai'); this.notify();
    },
    // ---------- Bleeding helpers ----------
    bleeds(t) { return !!(t && t.conditions.includes('Bleeding') && (t.bleeding || 0) > 0); },
    predBleeds(t) { return this.bleeds(t) && (t.bleeding || 0) > (this.prim.predGrace || 0); },
    async harpyBleed(t, n, card) { if (!t || !t.alive || n <= 0) return; if (card && this.prim.disabled.bleedAtk) { this.say('(Harpy 공격의 Bleeding 비활성)'); return; } await this.addCondition(t, 'Bleeding', { tokens: n }); },
    async harpyRegurgitate() {
      const cs = this.primCells().filter(q => { const ter = this.board.terrainAt(q.c, q.r); return !ter || (!ter.indestructible && !ter.obstacle); });
      if (!cs.length) { this.say('Regurgitate: 놓을 칸 없음 (Indestructible 지형 위)'); return; }
      this._regN = (this._regN || 0) + 1; const glac = this.prim.level >= 2;
      for (const q of cs) this.board.terrain.set(key(q.c, q.r), { id: 'reg' + this._regN, type: glac ? 'Ambrosia Pool (Black Glacier)' : 'Ambrosia Pool', obstacle: false, obscuring: false, destructible: false, ambrosia: !glac, slippery: glac, cell: { ...q } });
      this.say(`Regurgitate: ${cs.map(cellLabel).join(', ')}에 Ambrosia Pool${glac ? ' (Lv2+: Black Glacier로 취급 — Slippery)' : ''}`, 'ai'); this.notify();
    },
    async consume(t, why) { if (!t || !t.alive) return; this.say(`${t.name}: ${why} — Harpy에게 삼켜짐 (Consumed, 즉사)`, 'bad'); await this.solo(() => this.kill(t, { instant: true })); },
    adjKD() { return this.liveTitans().filter(x => !x.offBoard && !x.onVP && x.knockdown && this.isAdj(x)); },
    async raiseTraumaLevel(t, n, card) {
      const rows = t.def.trauma; const base = this.trait('Death by Fate') ? Math.max(t.danger, t.fate) : t.danger; let cur = base; let need = 0;
      for (let k = 0; k < n; k++) { const lbs = rows.map(r => +r.danger.replace('+', '').split('-')[0]).sort((a, b) => a - b); const nx = lbs.find(lb => lb > cur) ?? (cur + 1); need += nx - cur; cur = nx; } need = Math.max(need, cur - t.danger);
      this.say(`${t.name}: Trauma 레벨 ${n} 상승 — Danger ${need} 받음`, 'bad');
      await this.dealFD(t, 0, need, card, 1, null, { noBonus: true, noArmor: true });
    },
    // ---------- attack sentences ----------
    async harpyEffect(t, s, hits, card) {
      const parts = s.split(/(?<=\.)\s+(?=[A-Z⚡])/).map(x => x.trim()).filter(Boolean); let m;
      const shield = () => t.gear.some(g => !g.discarded && (g.card.traits || []).some(x => /^(Shield|Helm|Headgear)$/.test(x)));
      const deal = (f, d, dFn) => this.dealFD(t, f, d, card, hits, dFn);
      for (let i = 0; i < parts.length; i++) {
        if (!t.alive || t.offBoard) return true; let p = parts[i]; const nx = parts[i + 1] || '';
        if ((m = /^Bleeding (\d)\.$/.exec(p))) { await this.harpyBleed(t, +m[1], card); continue; }
        if (/^Knockdown\.$/.test(p)) { await this.knockdown(t); continue; }
        if ((m = /^If the Attack hits, raise your Trauma level by (\d) and resolve a Trauma Draw\.(?: \| FATE (\d)\+: (\d) Trauma levels instead)?/.exec(p))) { const n = m[2] && this.effFate(t) >= +m[2] ? +m[3] : +m[1]; await this.raiseTraumaLevel(t, n, card); continue; }
        if ((m = /^If the Attack hits, it deals (\d) DANGER and (\d) FATE\.$/.exec(p))) { await this.dealFD(t, +m[2], +m[1], card, 1); continue; }
        if ((m = /^Each hit deals (\d) DANGER and (\d) FATE\.$/.exec(p))) { await deal(+m[2] * hits, +m[1] * hits); continue; }
        if ((m = /^Each hit deals (\d) DANGER\.$/.exec(p))) { await deal(0, +m[1] * hits); continue; }
        if ((m = /^Each hit deals (\d) FATE\.$/.exec(p))) { if (/^If the Attack hits, gain DANGER equal to your FATE/.test(nx)) { i++; await deal(+m[1] * hits, 0, vf => Math.min(vf, 9)); } else await deal(+m[1] * hits, 0); continue; }
        if (/^Each hit deals DANGER equal to the number of your Bleeding tokens\.$/.test(p)) { const b = this.bleeds(t) ? t.bleeding : 0; await deal(0, b * hits); continue; }
        if (/^If the Attack hits, it deals DANGER equal to 2 \+ the number of your Bleeding tokens\.$/.test(p)) { await this.dealFD(t, 0, 2 + (this.bleeds(t) ? t.bleeding : 0), card, 1); continue; }
        if ((m = /^Gain \+(\d) FATE\.$/.exec(p))) { await this.gainFate(t, +m[1], { nc: true }); this.say(`${t.name}: Fate +${m[1]}`); continue; }
        if ((m = /^If you have a Shield or Helm Gear card, each hit deals (\d) DANGER\.$/.exec(p))) { i++; if (shield()) await deal(0, +m[1] * hits); else { let mm; if ((mm = /^If not, each hit deals (\d) DANGER\.$/.exec(nx))) await deal(0, +mm[1] * hits); else if (/^If not, raise DANGER to 9 and draw an Obol/.test(nx)) { t.danger = 9; this.say(`${t.name}: Shield/Helm 없음 — Danger 9, Obol`, 'bad'); await this.obolDraw(t, 10); } else if (/^If not, you die/.test(nx)) { this.say(`${t.name}: Shield/Helm 없음 — 사망`, 'bad'); await this.kill(t); } } continue; }
        if (/^Pull 1\+2 per hit until adjacent\.$/.test(p)) { i += 2; let x = 1 + 2 * hits; if (card.harpy && card.harpy.dbl && this.effFate(t) >= card.harpy.dbl) { x *= 2; this.say(`Fate ${card.harpy.dbl}+ — Double the Pull (${x})`); } if (this.prim.disabled.pull) this.say('(Harpy 공격의 Pull 비활성)'); else await this.pullTitan(t, x); if (!t.alive) return true; if (this.isAdj(t)) { await deal(0, 3 * hits); if (t.alive) await this.knockdown(t); } else await deal(0, 2 * hits); continue; }
        if (/^If the Attack hits, you die\.$/.test(p)) { this.say(`${t.name}: Vorpal Cut — 사망`, 'bad'); await this.kill(t); return true; }
        if (/^If the Attack hits, draw an Obol\.$/.test(p)) { i++; this.say(`Tear to Pieces: Obol 덱에 You Died ${hits}장 추가 (이번 드로우만)`, 'bad'); await this.obolDraw(t, 10, hits); continue; }
        if (/^One hit, raise DANGER to 9 and draw an Obol/.test(p)) { const h = hits; if (h >= 2) { this.say(`${t.name}: Apex Predator ${h} hit — 사망${h === 3 ? ', Argonaut는 Fated Mnemos 획득' : h >= 4 ? ' (Argonaut도 사망 — 캠페인)' : ''}`, 'bad'); if (h === 3) await this.gainFated(t); await this.kill(t); return true; } t.danger = 9; this.say(`${t.name}: Danger 9, Obol`, 'bad'); await this.obolDraw(t, 10); continue; }
        if ((m = /^PARADOX (\d)\+ or FATE (\d)\+: Gain the (Muffled|Sealed) Condition card\.$/.exec(p))) { if (this.parFor(t) >= +m[1] || this.effFate(t) >= +m[2]) await this.addCondition(t, m[3]); continue; }
        this.say(`(미구현 Harpy 효과: ${p})`, 'sys');
      }
      return true;
    },
    async harpySentence(t, p) {
      const alive = !!(t && t.alive); let m;
      if (/^Regurgitate$/.test(p)) { await this.harpyRegurgitate(); return true; }
      if (/^Discard a Gear card with the Shield or Helm Trait$/.test(p)) { if (!alive) return true; const list = t.gear.filter(g => !g.discarded && (g.card.traits || []).some(x => /^(Shield|Helm|Headgear)$/.test(x))); if (!list.length) { this.say(`${t.name}: Shield/Helm 장비 없음`); return true; } const g = list.length === 1 ? list[0] : await this.pickGear(t, list); this.discardGear(t, g); return true; }
      if (/^All adjacent Titans suffer Knockdown$/.test(p)) { for (const x of this.liveTitans().filter(y => !y.offBoard && this.isAdj(y))) await this.solo(() => this.knockdown(x)); return true; }
      if (/^Discard the Bleeding Condition card$/.test(p)) { if (alive) { t.conditions = t.conditions.filter(c => c !== 'Bleeding'); t.bleeding = 0; this.say(`${t.name}: Bleeding 카드 버림`, 'good'); } return true; }
      if (/^Place an additional generic token as a Rapid Adaptation token on any space of the Icarian Adaptation Board$/.test(p)) { const R = this.prim.ra; if (!R) return true; R.supply++; const sp = await this.ask({ type: 'choice', titan: t, title: 'Evolutionary Gland: 추가 Adaptation 토큰을 놓을 칸 선택', options: R.spaces.map((x, i) => ({ label: `${RA_SPACES[i].name}${x.n ? ' (이미 토큰 있음)' : ''}`, value: i })) }); this.say('Evolutionary Gland: Adaptation 토큰 1개 추가'); await this.raPlace(t, null, { space: sp }); return true; }
      if ((m = /^Consume (1|all) adjacent knocked down Titans?$/.exec(p))) { await this.harpyConsume(m[1] === 'all' ? 'all' : 1, t); return true; }
      return false;
    },
    async harpyConsume(n, pref) {
      const list = this.adjKD(); if (!list.length) { this.say('(인접한 넘어진 타이탄 없음 — Consume 없음)'); return; }
      const pick = n === 'all' ? list : [list.length === 1 ? list[0] : await this.ask({ type: 'choice', title: 'Consume: 삼켜질 넘어진 타이탄 선택', options: list.map(x => ({ label: `${x.name} (D${x.danger} R${x.rage} F${x.fate})`, value: x })) })];
      for (const x of pick) await this.consume(x, '넘어진 채 인접');
    },
    async harpyCritical(t, A) {
      const c = A.bp.critical || '';
      if (/ignoring the Rapid Adaptation Trait/.test(c) && /Bonus Attack/.test(c)) { if (/Priority Target token/.test(c) && !this.ptHolder()?.ptLocked) { for (const x of this.titans) x.pt = false; t.pt = true; this.say(`${t.name}: Priority Target`); } t._ignoreRA = true; this.pendingFollowUp = t; this.say(`${t.name}: 보너스 공격 (Rapid Adaptation 무시)`, 'good'); return true; }
      if (/^The Predator Trait treats 1 Bleeding token/.test(c)) { this.prim.predGrace = (this.prim.predGrace || 0) + 1; this.say(`Predator: Bleeding 토큰 ${this.prim.predGrace}개 이하는 Bleeding이 없는 것으로 취급`, 'good'); return true; }
      if ((m => m)(/^Discard 1 Rapid Adaptation token from the (Battle|Board)\. If there aren't any, another Titan may move up to (\d) spaces and perform a Bonus Attack/.exec(c))) { const m = /from the (Battle|Board)\. .* up to (\d) spaces/.exec(c); const ok = await this.raDiscard(m[1] === 'Battle'); if (!ok) await this.anotherBonus(t, +m[2]); return true; }
      if (/^Another Titan may move up to (\d) spaces and perform a Bonus Attack/.test(c)) { await this.anotherBonus(t, +/up to (\d)/.exec(c)[1]); return true; }
      if (/^Disable the Pull X keyword on Harpy Attacks/.test(c)) { this.prim.disabled.pull = true; this.say('Harpy 공격의 Pull 비활성화', 'good'); return true; }
      if (/^Disable Bleeding effects on Harpy Attacks/.test(c)) { this.prim.disabled.bleedAtk = true; this.say('Harpy 공격의 Bleeding 비활성화', 'good'); return true; }
      if (/^Until the end of Battle, when attacked from a Blindspot space, the Harpy has -1 AT/.test(c)) { this.prim.blindATMalus = (this.prim.blindATMalus || 0) + 1; this.say('Blindspot에서 공격 시 AT −1', 'good'); return true; }
      if (/^Deal an additional Single Wound/.test(c)) { A.extraWound = 1; return true; }
      if (/^Disable the Muffled and Sealed Conditions/.test(c)) { this.prim.disabled.muffled = true; for (const x of this.titans) x.conditions = x.conditions.filter(k => k !== 'Muffled' && k !== 'Sealed'); this.say('Muffled/Sealed 비활성화, 모든 타이탄에서 제거', 'good'); return true; }
      if (/^The Harpy dies/.test(c)) { this.say(`🏆 ${this.prim.name}이(가) 죽었습니다!`, 'good'); throw new BattleOver('victory'); }
      if (/\(campaign\)/.test(c)) { this.say(`(${c} — 캠페인 보상)`, 'sys'); return true; }
      return false;
    },
    async anotherBonus(t, n) {
      const others = this.liveTitans().filter(x => x !== t && !x.offBoard); if (!others.length) { this.say('(다른 타이탄 없음)'); return; }
      const o = others.length === 1 ? others[0] : await this.ask({ type: 'choice', titan: t, title: `다른 타이탄 1명: 최대 ${n}칸 이동 후 보너스 공격`, options: [{ label: '안 함', value: null }, ...others.map(x => ({ label: x.name, value: x }))] });
      if (!o) return; await this.chooseMove(o, n, '보너스 이동'); this.pendingFollowUp = o; this.say(`${o.name}: 보너스 공격 예약`, 'good');
    },
    // ---------- AI resolution ----------
    async harpyAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const H = card.harpy;
      if (H.special === 'shriek') { this.say(`ROUTINE 「${card.name}」: ${card.text}`, 'ai'); for (const x of this.liveTitans()) await this.solo(() => this.addCondition(x, 'Bleeding', { tokens: 3 })); return; }
      if (H.move === 'all') {
        if (H.regurg) await this.harpyRegurgitate();
        const tg = this.liveTitans().filter(x => !x.offBoard && this.primLos(x) && this.distTo(x) <= (card.range || 99));
        this.say(`대상: 시야 안 모든 타이탄 (${tg.map(x => x.name).join(', ') || '없음'})`);
        if (!tg.length) { this.say('타겟 없음 → Routine', 'ai'); return this.resolveAI(this.routine); }
        await this.reactionWindow(tg[0], card, 'Range Attack'); for (const x of tg) { if (!x.alive) continue; try { await this.primAttackOn(x, card); } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied)) throw e; } }
        return this.harpyAfter(card, tg[0]);
      }
      let tgt = forcedTarget && forcedTarget.alive && !forcedTarget.offBoard ? forcedTarget : null;
      if (!tgt && H.predation) tgt = this.predatorTarget();
      if (!tgt) { this._rangeCard = card.range ? card : null; tgt = this.pickTarget(card.target, !card.range); this._rangeCard = null; tgt = await this.unearthly(card, tgt); }
      if (!tgt) { if (/Signature/.test(card.noTarget || '') && card !== this.sig) { this.say('유효한 타겟 없음 → Signature', 'ai'); return this.resolveAI(this.sig, { isSignature: true }); } if (this.routine && card !== this.routine && !this.prim.disabled.routine) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveRoutine(this.routine); } return; }
      this.say(`타겟: ${tgt.name}`);
      if (H.regurg) await this.harpyRegurgitate();
      try { await this.harpyOne(card, tgt); } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied)) throw e; }
      await this.harpyAfter(card, tgt);
    },
    async harpyOne(card, t) {
      const H = card.harpy; const s0 = card.steps[0] || '';
      if (s0.startsWith('⚡')) { await this.reactionWindow(t, card, s0.replace('⚡ ', '').split(' |')[0]); if (!t.alive || t.offBoard) return; }
      if (t.onVP) {} else if (H.move === 'move') { if (!this.isAdj(t)) { this.facePrim(t.pos); const path = await this.choosePrimPath(t.pos, 99, [t], card); for (const st of path) { await this.primStep(st, [t]); if (!t.alive) return; } await this.primEndMove([]); if (path.length) this.say(`${this.prim.name} 이동 → ${cellLabel(this.prim.anchor)} 기준`); } this.facePrim(t.pos); }
      else if (H.move === 'appear') await this.appearAt(t, 'behind');
      else if (H.move === 'land') { await this.landOnTop(t); if (!t.alive) return; }
      else if (H.move === 'range') this.facePrim(t.pos);
      if (H.pb && t.alive && this.isAdj(t) && !t.onVP) await this.pushbackTitan(t, H.pb);
      if (!t.alive || t.offBoard) return;
      if (H.move === 'range') { if (this.distTo(t) > card.range || !this.primLos(t)) { this.say('타겟이 사거리/시야 밖 — 공격 생략'); return; } }
      else if (!this.isAdj(t)) { this.say('타겟이 사거리 밖 — 공격 생략'); return; }
      let c2 = card; if (H.dieGate && (this.prim.level >= H.dieGate.lvl || this.effFate(t) >= H.dieGate.f)) { c2 = { ...card, dice: card.dice + H.dieGate.n }; this.say(`Level ${H.dieGate.lvl}+ 또는 Fate ${H.dieGate.f}+ — 회피 주사위 +${H.dieGate.n}`); }
      this._blockGear = null;
      const h = await this.primAttackOn(t, c2); this.currentAI.lastHits = h || 0;
      if (H.vorpal && !h && this._blockGear && t.alive) { const g = this._blockGear; this.say(`Vorpal Cut: Block으로 막음 — Danger 9, 「${g.card.name}」 버림, Knockdown`, 'bad'); t.danger = 9; this.discardGear(t, g); await this.knockdown(t); }
    },
    async harpyAfter(card, t) {
      const list = (card.harpy && card.harpy.after) || []; if (!list.length) return;
      for (const a of list) {
        if (a.win) await this.reactionWindow((t && t.alive ? t : this.liveTitans()[0]) || this.titans[0], card, 'After Attack');
        if (a.k === 'bleed') { if (t && t.alive) await this.harpyBleed(t, a.n, card); }
        else if (a.k === 'kd') { if (t && t.alive && !t.offBoard) await this.solo(() => this.knockdown(t)); }
        else if (a.k === 'consume1') await this.harpyConsume(1, t);
        else if (a.k === 'consumeAll') await this.harpyConsume('all', t);
        else if (a.k === 'text') { if (t && t.alive) await this.doEffects(t, a.t + '.', { card }); }
      }
    },
    predatorTarget() { const b = this.liveTitans().filter(x => !x.offBoard && this.predBleeds(x) && this.primLos(x) && !this.attackedThisRound.has(x)); if (!b.length) return null; const mx = Math.max(...b.map(x => x.bleeding)); const c = b.filter(x => x.bleeding === mx); return c.find(x => x.pt) || c[0]; },
    // ---------- round / battle hooks ----------
    async harpyStartOfBattle() {
      if (!this.trait('Bloodlost') && !this.trait('Predator')) return;
      const L0 = this.prim.level; const need = this.trait('Bloodlost') ? 4 : (L0 >= 3 ? 3 : 2); const order = []; const rest = [...this.liveTitans()]; while (rest.length && order.length < need) { const mx = Math.max(...rest.map(x => x.danger)); const tie = rest.filter(x => x.danger === mx); const pick = tie.length === 1 ? tie[0] : (await this.ask({ type: 'choice', title: `${this.trait('Bloodlost') ? 'Bloodlost' : 'Predator'} 시작 Bleeding: Danger ${mx}로 같은 타이탄이 여럿 — ${order.length + 1}번째로 받을 타이탄 선택`, options: tie.map(x => ({ label: `${x.name} (Danger ${x.danger})`, value: x })) }) || tie[0]); order.push(pick); rest.splice(rest.indexOf(pick), 1); }
      if (this.trait('Bloodlost')) { const ns = [4, 3, 2, 2]; this.say('Bloodlost: Danger 높은 순으로 Bleeding 4/3/2/2', 'ai'); for (let i = 0; i < order.length; i++) await this.solo(() => this.addCondition(order[i], 'Bleeding', { tokens: ns[i] || 2 })); }
      else if (this.trait('Predator') && order.length) { const L = this.prim.level; const ns = L >= 4 ? [3, 2, 2] : L === 3 ? [2, 2, 1] : L === 2 ? [2, 2] : [2, 1]; this.say(`Predator: Danger 높은 순으로 Bleeding ${ns.join('/')}`, 'ai'); for (let i = 0; i < Math.min(ns.length, order.length); i++) await this.solo(() => this.addCondition(order[i], 'Bleeding', { tokens: ns[i] })); }
    },
    async harpyPrimRoundStart() {
      if (this.trait('Devour Whole')) { const adj = this.liveTitans().filter(x => !x.offBoard && this.isAdj(x)); for (const x of adj) await this.consume(x, 'Devour Whole (Primordial Round 시작에 인접)'); }
    },
    async harpyPredation() {
      if (!this.trait('Predator')) return; const t = this.predatorTarget(); if (!t) { this.say('Predator: 시야 안에 이번 라운드 공격받지 않은 Bleeding 타이탄 없음 — Predation 없음'); return; }
      const card = this.prim.def.ai.find(a => a.harpy && a.harpy.predation); this.say(`Predator: ${t.name} (Bleeding ${t.bleeding}) — Predation!`, 'ai');
      await this.safe(() => this.resolveAI(card, { forcedTarget: t }));
    },
  });
}
