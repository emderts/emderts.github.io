const OPPD_M = { N: 'S', S: 'N', E: 'W', W: 'E' };
// Cycle IV — Midascore (Imperial Impetus, Airburst, Midas X, Impaled, Incremental Painment, Curses)
import { Board, key, cellLabel, DIRS, DIR_LIST, OPP } from './core.js';

export function installMidas(Game, { TitanDied, BattleOver }) {
  Object.assign(Game.prototype, {
    midasSetup() {
      this.prim.painment = 0; this.prim.gold = {}; // gold[terrainId] = generic tokens (Cities of Gold)
      if (this.trait('Amongst the Bleached Bones')) { this.board.allChasm = 'empty'; this.say('Amongst the Bleached Bones: 지형이 아닌 칸은 모두 Chasm', 'ai'); }
    },
    // ---------- helpers ----------
    goldthirst(t) { return !!(t && t.conditions.includes('Goldthirst')); },
    windblight(t) { return !!(t && t.conditions.includes('Windblight')); },
    goldtaste(t) { return this.trait('Goldtaste') && this.goldthirst(t); },
    mGate(t, m, f) { if (!t) return false; if (this.goldtaste(t)) return true; return (m != null && this.midas(t) >= m) || (f != null && this.effFate(t) >= f); },
    async midasX(t, n, why = '') {
      if (!t || !t.alive || n <= 0) return; if (this.prim.disabled.midasX && (!why || why === 'Impaled')) { this.say('(Midas X 비활성)'); return; }
      this.say(`${t.name}: Midas ${n}${why ? ` (${why})` : ''}`, 'bad'); await this.gainMidas(t, n);
    },
    iremTowers() { const seen = new Map(); for (const ter of this.board.terrain.values()) if (ter.irem === 'tower' && !seen.has(ter.id)) seen.set(ter.id, ter); return [...seen.values()]; },
    iremCellsFree(self) { const out = []; for (const [k, ter] of this.board.terrain) { if (ter.irem !== 'tower') continue; const [c, r] = k.split(',').map(Number); const p = { c, r }; if (this.primContains(p)) continue; const o = this.titanAt(c, r); if (o && o !== self) continue; out.push(p); } return out; },
    async toClosestIrem(t, why) {
      const from = t.onVP || t.impaled ? this.prim.anchor : t.pos; const cs = this.iremCellsFree(t);
      if (!cs.length) { this.say(`${t.name}: ${why} — 비어 있는 Irem Tower 없음, displace`); return this.displace(t); }
      const m = Math.min(...cs.map(p => Board.dist(p, from))); const best = cs.filter(p => Board.dist(p, from) === m);
      const p = best.length === 1 ? best[0] : await this.ask({ type: 'move', titan: t, title: `${why}: 가장 가까운 Irem Tower 선택`, cells: best, options: best.map(q => ({ label: cellLabel(q), value: q })) });
      t.pos = { ...(p || best[0]) }; this.say(`${t.name}: ${why} — ${cellLabel(t.pos)}의 Irem Tower로`); this.notify();
    },
    // ---------- Airburst X ----------
    async airburst(x, fromCard = true) {
      if (this.prim.disabled.airburst) { this.say(`(Airburst ${x} — 비활성)`); return []; }
      const hit = this.liveTitans().filter(t => !t.offBoard && !t.onVP && !t.impaled && !t.stair && this.zoneDist(t.pos) <= x + (this.windblight(t) ? 2 : 0));
      this.say(`💨 Airburst ${x}: ${hit.map(t => t.name).join(', ') || '(대상 없음)'}`, 'ai');
      for (const t of hit) await this.solo(async () => { if (await this.c4IgnoreAirFloat(t, 'Airburst')) return; await this.knockdown(t); if (t.alive) await this.knockback(t, 1); });
      return hit;
    },
    // ---------- Imperial Impetus ----------
    impetusDist() { const L = this.prim.level; let n = L >= 4 ? 11 : L === 3 ? 10 : L === 2 ? 9 : 8; if (this.prim.halfImpetus) n = Math.ceil(n / 2); return n; },
    async imperialImpetus() {
      if (!this.trait('Imperial Impetus')) return; if (this.prim.disabled.impetus) { this.say('(Imperial Impetus 비활성)'); return; }
      const n = this.impetusDist(); let dir = this.prim.facing; this.say(`👑 Imperial Impetus: ${dir} 방향으로 ${n}칸 직진`, 'ai');
      const fits = (a, d) => this.primCells({ c: a.c + DIRS[d][0], r: a.r + DIRS[d][1] }).every(p => this.board.inBounds(p.c, p.r));
      const room = d => { let a = { ...this.prim.anchor }, k = 0; while (fits(a, d) && k < 40) { a = { c: a.c + DIRS[d][0], r: a.r + DIRS[d][1] }; k++; } return k; };
      for (let k = 0; k < n; k++) {
        if (!fits(this.prim.anchor, dir)) {
          const perp = DIRS[dir][0] ? ['N', 'S'] : ['E', 'W']; const rs = perp.map(room); let nd;
          if (!rs[0] && !rs[1]) { this.say(`보드 모서리 — ${k}칸 후 정지`); break; }
          if (rs[0] !== rs[1]) nd = rs[0] > rs[1] ? perp[0] : perp[1];
          else nd = await this.ask({ type: 'choice', title: `Imperial Impetus: 보드 가장자리 — 양쪽 공간이 같음 (${rs[0]}칸). 회전 방향 선택`, options: perp.map(d => ({ label: d, value: d })) }) || perp[0];
          this.say(`보드 가장자리 — 더 긴 쪽(${nd}, ${Math.max(...rs)}칸)으로 90° 회전`, 'ai'); dir = nd; this.prim.facing = nd;
        }
        const a = this.prim.anchor; await this.primStep({ c: a.c + DIRS[dir][0], r: a.r + DIRS[dir][1] }, [], false, false, { impetus: true });
      }
      await this.primEndMove([]); this.notify();
    },
    async impetusVictim(o) { // titan in the path of Imperial Impetus
      if (o.gear.some(g => !g.discarded && /Ignore Imperial Impetus/.test(this.gearText(g, o)))) { this.say(`${o.name}: Ignore Imperial Impetus`, 'good'); return; }
      if (o.knockdown || o.float) {
        if (this.trait('Soundspeed Impetus')) { this.say(`${o.name}: Soundspeed Impetus — ${o.float ? '떠 있는' : '넘어진'} 채 휩쓸려 사망`, 'bad'); return this.kill(o); }
        if (o.knockdown) { this.say(`${o.name}: 넘어진 채 Imperial Impetus에 휩쓸림 — Obol`, 'bad'); return this.obolDraw(o, 10); }
      }
      await this.crash(o); if (o.alive) await this.midasX(o, 1, 'Impetus Crash');
    },
    // ---------- Shifting tiles / Cities of Gold ----------
    async midasEndMove() {
      if (this.trait('Refuse Credit')) return; // Shifting disabled; towers already destroyed during movement
      for (const p of this.primCells()) {
        const ter = this.board.terrainAt(p.c, p.r); if (!ter || ter.irem !== 'tower') continue;
        const dest = this.nearFreeTile(p); this.board.removeTerrainId(ter.id);
        if (!dest) { this.say(`${ter.type} (${cellLabel(p)}): 밀어낼 곳이 없어 제거`); continue; }
        this.board.addTerrain([cellLabel(dest)], { ...ter }); this.say(`Shifting: ${ter.type} ${cellLabel(p)} → ${cellLabel(dest)}`);
        if (this.trait('Cities of Gold')) { this.prim.gold[ter.id] = (this.prim.gold[ter.id] || 0) + 1; this.say(`Cities of Gold: ${cellLabel(dest)} 타일에 금 토큰 (${this.prim.gold[ter.id]})`, 'ai'); }
      }
    },
    nearFreeTile(from) { const seen = new Set([key(from.c, from.r)]); const q = [from]; while (q.length) { const c = q.shift(); for (const d of DIR_LIST) { const n = { c: c.c + DIRS[d][0], r: c.r + DIRS[d][1] }; const k = key(n.c, n.r); if (seen.has(k) || !this.board.inBounds(n.c, n.r)) continue; seen.add(k); if (!this.board.terrainAt(n.c, n.r) && !this.primContains(n) && !this.titanAt(n.c, n.r)) return n; q.push(n); } } return null; },
    async citiesOfGold(t, when) {
      if (!this.trait('Cities of Gold') || !t.alive || t.offBoard || t.onVP || t.impaled) return; const ter = this.board.terrainAt(t.pos.c, t.pos.r); const n = ter ? (this.prim.gold[ter.id] || 0) : 0;
      if (n) await this.midasX(t, n, `Cities of Gold (${when})`);
    },
    // ---------- Float ----------
    async float(t) {
      if (t.gear.some(g => !g.discarded && /Immune to Float/.test(this.gearText(g, t)))) { this.say(`${t.name}: Float 면역`, 'good'); return; }
      if (this.lander(t)) { this.say(`${t.name}: Lander — VP 위에서 Float 무시`, 'good'); return; }
      if (await this.c4IgnoreAirFloat(t, 'Float')) return;
      if (this.windblight(t) && this.trait('Unholy Inflation')) { const cm = t.gear.find(g => !g.discarded && /X When you are about to die from any Curse effect, draw an Obol instead/.test(this.gearText(g, t))); if (cm && await this.ask({ type: 'yn', titan: t, title: `${cm.card.name}: Curse 효과로 사망 직전 — 카드 버리고 Obol?`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] })) { this.discardGear(t, cm); return this.obolDraw(t, 10); } this.say(`${t.name}: Windblight 상태로 Float — 사망 (Unholy Inflation)`, 'bad'); return this.kill(t, { curse: true }); }
      if (t.float) { this.say(`${t.name}: Float를 두 번째로 얻음 — 사망`, 'bad'); return this.kill(t); }
      if (this.noInvol(t, 'Condition 「Float」')) return;
      if (t.onVP) await this.leaveVP(t); t.float = 'up'; t.floatFresh = this._actor === t && !this.currentAI; if (!t.conditions.includes('Float')) t.conditions.push('Float');
      this.say(`${t.name}: FLOAT (UP) — 떠오름. 자발적 이동·공격·액션/능력 불가, ${t.floatFresh ? '다음' : '자기'} 턴 끝에 DOWN으로 뒤집음`, 'bad'); this.notify();
    },
    deflate(t, why) { if (!t.float) return; t.float = null; t.floatFresh = false; t.conditions = t.conditions.filter(c => c !== 'Float'); this.say(`${t.name}: Deflate (${why}) — 정상 자세로, Float 버림`); this.notify(); },
    async knockdownHook(t) { // returns true if handled instead of a normal Knockdown
      if (!this.prim || !((this.prim.def.cycle || 0) >= 4) || !t.alive || t.knockdown || t.float === 'up') return false;
      if (this.windblight(t)) { this.say(`${t.name}: Windblight — Knockdown 대신 Float`, 'bad'); await this.float(t); return true; }
      if (this.trait('Unholy Inflation') && this.midas(t) >= 3) { this.say(`${t.name}: Unholy Inflation (Midas ${this.midas(t)}) — Knockdown 대신 Float`, 'bad'); await this.float(t); return true; }
      return false;
    },
    // ---------- Impaled ----------
    async impale(t) {
      if (!t || !t.alive || t.impaled) return; if (this.prim.disabled.impaled) { this.say('(Impaled 비활성)'); return; }
      if (t.onVP) await this.leaveVP(t); t.impaled = true; t.knockdown = null; t.pos = { ...this.prim.anchor };
      this.say(`${t.name}: IMPALED! — Midascore의 뿔에 꿰뚫림 (턴에 Get Free 또는 근접 무기로 공격만 가능)`, 'bad'); this.notify();
    },
    async unimpale(t, why) {
      if (!t.impaled) return; t.impaled = false; const cand = Board.adjacentCells(this.primCells()).filter(p => this.freeCell(p));
      if (!cand.length) { this.say(`${t.name}: ${why} — 인접 빈 칸 없음`); return this.toClosestIrem(t, why); }
      const p = cand.length === 1 ? cand[0] : await this.ask({ type: 'move', titan: t, title: `${t.name}: ${why} — Displace 1 (내려갈 칸)`, cells: cand, options: cand.map(q => ({ label: cellLabel(q), value: q })) });
      t.pos = { ...(p || cand[0]) }; this.say(`${t.name}: ${why} — ${cellLabel(t.pos)}로`, 'good'); this.notify();
    },
    async getFree(t) {
      const sk = this.skill(t, 'Endurance') >= this.skill(t, 'Fury') ? 'Endurance' : 'Fury';
      if ((await this.skillTest(t, sk, 9))) await this.unimpale(t, 'Get Free!'); else this.say(`${t.name}: Get Free! 실패`, 'bad');
    },
    async impaledEndTurn(t) {
      if (!t.alive || !t._startImpaled) return; t._startImpaled = false; this.say(`${t.name}: 턴 시작부터 Impaled — Midas 2, Danger X+5, Trauma Draw`, 'bad');
      await this.midasX(t, 2, 'Impaled'); if (!t.alive) return; const x = this.midas(t); await this.gainDanger(t, x + 5, { source: 'Impaled', skipTrauma: true }); if (!t.alive) return; await this.traumaDraw(t);
    },
    // ---------- Incremental Painment ----------
    painAdd(n, why) { if (!this.trait('Incremental Painment') || n <= 0) return; this.prim.painment = (this.prim.painment || 0) + n; this.say(`Incremental Painment +${n} (${why}) → ${this.prim.painment}/5`, 'ai'); while (this.prim.painment >= 5) { this.prim.painment -= 5; this.say('Incremental Painment 5 — 현재 액션 후 Signature!', 'bad'); this.pendingSigN = (this.pendingSigN || 0) + 1; this.pendingSignature = true; } },
    async midasOnDeath(t) {
      const n = this.midas(t); if (!n || !(this.trait('Weight of Greed') || this.trait('Debts of Succession'))) return;
      let rest = n; if (this.trait('Weight of Greed')) { const h = Math.ceil(n / 2); rest = n - h; this.painAdd(h, `Weight of Greed: ${t.name}`); }
      if (this.trait('Debts of Succession') && rest > 0) { const o = this.liveTitans().filter(x => x !== t); if (!o.length) return; const each = Math.floor(rest / o.length); let r = rest % o.length; const give = new Map(o.map(x => [x, each]));
        if (r) { const picks = await this.ask({ type: 'multi', titan: o[0], title: `Debts of Succession: Midas ${rest}개 분배 — ${each}개씩 받고 남은 ${r}개를 1개씩 더 받을 타이탄 ${r}명 선택`, max: r, okLabel: '확인', noLabel: '자동 선택', options: o.map((x, i) => ({ label: `${x.name} (Midas ${this.midas(x)})`, value: i })) }) || []; const chosen = [...new Set(picks)].slice(0, r).map(i => o[i]); for (const x of o) { if (chosen.length >= r) break; if (!chosen.includes(x)) chosen.push(x); } for (const x of chosen) give.set(x, give.get(x) + 1); }
        this.say(`Debts of Succession: 남은 Midas ${rest}개 분배 — ${o.map(x => `${x.name} ${give.get(x)}`).join(', ')}`, 'bad'); for (const x of o) if (give.get(x)) await this.solo(() => this.gainMidas(x, give.get(x), true)); }
      for (const g of t.gear) g.midas = 0;
    },
    // ---------- attack header (MIDAS/FATE gates) ----------
    midasHeader(t, card, dice, diff) {
      const s0 = card.steps[0] || ''; let m;
      if (card.midas && card.midas.diceMidas) { dice = Math.max(card.midas.diceMidas, this.midas(t)) + (this.prim.bonus.EVADE_DICE || 0); this.say(`Horn of Crooked Alchemy: 주사위 = Midas ${this.midas(t)} (최소 ${card.midas.diceMidas}) → ${dice}`); }
      if ((m = /(?:MIDAS (\d)\+ or )?FATE (\d)\+: \+(\d) EVADE_DICE/.exec(s0)) && this.mGate(t, m[1] != null ? +m[1] : null, +m[2])) { dice += +m[3]; this.say(`${m[1] ? `Midas ${m[1]}+ 또는 ` : ''}Fate ${m[2]}+ — 회피 주사위 +${m[3]}`); }
      if ((m = /(?:MIDAS (\d)\+ or )?FATE (\d)\+: Evasion Roll difficulty (\d+)\+ instead/.exec(s0)) && this.mGate(t, m[1] != null ? +m[1] : null, +m[2])) { diff = +m[3]; this.say(`Fate ${m[2]}+ — 회피 난이도 ${diff}+`); }
      t._noKDWin = !!((m = /(?:MIDAS (\d)\+ or )?FATE (\d)\+: Ignore ⚡ preceding Knockdown/.exec(s0)) && this.mGate(t, m[1] != null ? +m[1] : null, +m[2]));
      if (t._noKDWin) this.say(`${m[1] ? `Midas ${m[1]}+ 또는 ` : ''}Fate ${m[2]}+ — Knockdown 앞의 ⚡ 무시`, 'bad');
      return { dice, diff };
    },
    // ---------- attack sentences ----------
    async midasEffect(t, s, hits, card) {
      const parts = s.split(/(?<=\.)\s+(?=[A-Z⚡])/).map(x => x.trim()).filter(Boolean); let m;
      const laser = !!(card.midas && card.midas.laser);
      const deal = (d, h = hits) => this.dealFD(t, 0, d, card, h, null, { laser });
      for (let i = 0; i < parts.length; i++) {
        if (!t.alive || t.offBoard) return true; let p = parts[i]; const win = p.startsWith('⚡'); p = p.replace(/^⚡\s*/, '');
        if (win) { if ((/^Knockdown/.test(p) && t._noKDWin) || (/^If you're not Impaled/.test(p) && t.impaled)) {} else await this.reactionWindow(t, card, p); if (!t.alive) return true; }
        if (/^Turn the Midascore to face directly away from the Target\.$/.test(p)) continue;
        if (/^X is the number of Midas tokens you have/.test(p)) continue;
        if ((m = /^Midas (\d)\.$/.exec(p))) { await this.midasX(t, +m[1]); continue; }
        if ((m = /^Each hit deals (\d) DANGER and Midas (\d)\.$/.exec(p))) { await deal(+m[1] * hits); if (t.alive) await this.midasX(t, +m[2] * hits); continue; }
        if ((m = /^If the Attack hits, it deals (\d) DANGER and Midas (\d)\.$/.exec(p))) { await deal(+m[1], 1); if (t.alive) await this.midasX(t, +m[2]); continue; }
        if ((m = /^Each hit deals (\d) DANGER\.$/.exec(p))) { await deal(+m[1] * hits); continue; }
        if (/^Two or more hits, you are Impaled\.$/.test(p)) { if (hits >= 2) await this.impale(t); continue; }
        if (/^If you're not Impaled, Knockdown\.$/.test(p)) { if (!t.impaled) await this.knockdown(t); continue; }
        if (/^Three hits or MIDAS 3\+, you die\.$/.test(p)) { const mm = /^Otherwise, each hit deals (\d) DANGER and Midas (\d)\.$/.exec(parts[i + 1] || ''); i++; if (hits >= 3 || this.mGate(t, 3, null)) { this.say(`${t.name}: Auric Ray — ${hits >= 3 ? '3 hit' : `Midas ${this.midas(t)}`} → 황금으로 변해 사망`, 'bad'); await this.kill(t); return true; } if (mm) { await deal(+mm[1] * hits); if (t.alive) await this.midasX(t, +mm[2] * hits); } continue; }
        if (/^If you survive, gain the Goldthirst Curse Affliction\.$/.test(p)) { await this.addCurse(t, 'Goldthirst'); continue; }
        if ((m = /^Knockback (\d+) to the left or right\.$/.exec(p))) { const fr = this.frame(); const d = await this.ask({ type: 'choice', titan: t, title: `Knockback ${m[1]}: 방향 (Midascore 기준 좌/우)`, options: [{ label: `왼쪽 (${fr.left})`, value: fr.left }, { label: `오른쪽 (${fr.right})`, value: fr.right }] }); await this.knockback(t, +m[1], d || fr.left); continue; }
        if ((m = /^Airburst (\d+)\.$/.exec(p))) { await this.airburst(+m[1]); continue; }
        if (/^Knockdown\.$/.test(p)) { await this.knockdown(t); continue; }
        await this.applyAttackEffect(t, p, hits, { ...card, midas: null, _m: card.midas });
      }
      return true;
    },
    async addCurse(t, name) {
      if (!t || !t.alive) return; if (t.conditions.includes(name)) { this.say(`${t.name}: 이미 ${name} Curse`); return; }
      t.conditions.push(name); this.say(`${t.name}: ${name} Curse Affliction 획득${({ Goldthirst: ' — 턴 시작마다 Midas 1', Windblight: ' — 이동 +1, Knockback/Pushback/Kickback/Airburst +2, Knockdown 대신 Float', Abyss: ' — 턴 시작마다 Ambrosia 1', Pursuer: ' — 턴 끝마다 Midas 1개를 Ambrosia로, 못 하면 사망' })[name] || ''}`, 'bad');
    },
    async midasSentence(t, p, ctx = {}) {
      const alive = !!(t && t.alive); let m;
      if (/^Imperial Impetus$/.test(p)) { await this.imperialImpetus(); return true; }
      if ((m = /^Airburst (\d+)$/.exec(p))) { await this.airburst(+m[1]); return true; }
      if ((m = /^Midas (\d)$/.exec(p))) { if (alive) await this.midasX(t, +m[1]); return true; }
      if (/^Gain the (Covetous|Greed-crazed|Enriched) Condition card$/.test(p)) { const nm = /^Gain the (\S+) Condition/.exec(p)[1]; if (alive) await this.midasCondition(t, nm); return true; }
      if (/^Gain the (Goldthirst|Windblight) Curse Affliction$/.test(p)) { if (alive) await this.addCurse(t, /Goldthirst/.test(p) ? 'Goldthirst' : 'Windblight'); return true; }
      if (/^You are Impaled$/.test(p)) { if (alive) await this.impale(t); return true; }
      if (/^Any Impaled Titan becomes not Impaled$/.test(p)) { for (const x of this.liveTitans().filter(y => y.impaled)) await this.unimpale(x, 'Impaled 해제'); return true; }
      if (/^Unholy Alchemy$/.test(p)) { if (alive) this.unholyAlchemy(t); return true; }
      if (/^Immediately perform the Hold On test$/.test(p)) { if (alive && t.onVP) await this.holdOn(t); return true; }
      if (/^Turn the Midascore in a random direction$/.test(p)) { this.prim.facing = this.rng.pick(DIR_LIST); this.say(`${this.prim.name}: 무작위 방향(${this.prim.facing})으로 회전`, 'ai'); this.notify(); return true; }
      return false;
    },
    unholyAlchemy(t) { const n = this.midas(t); if (!n) { this.say(`${t.name}: Unholy Alchemy — Midas 토큰 없음`); return; } for (const q of t.gear) q.midas = 0; this.midasRemoved(t, n); return this.ambDirect(t, n, `Unholy Alchemy (Midas ${n} →)`); },
    async midasCondition(t, nm, vol = false) {
      if ((nm === 'Wishkeen' || nm === 'Wishagog') && t._wishImmune) { this.say(`${t.name}: What You Wish For — ${nm} 획득 불가`); return; }
      if (!vol && this.noInvol(t, `Condition 「${nm}」`)) return;
      const cov = t.conditions.includes('Covetous'), gc = t.conditions.includes('Greed-crazed');
      if (nm === 'Covetous' || nm === 'Greed-crazed') {
        if (gc) { this.say(`${t.name}: Greed-crazed 상태에서 ${nm} 획득 — 사망`, 'bad'); return this.kill(t); }
        if (cov) { t.conditions = t.conditions.filter(c => c !== 'Covetous'); t.conditions.push('Greed-crazed'); this.say(`${t.name}: Covetous → Greed-crazed로 뒤집힘 (Kratos Pool 토큰을 절반만 놓고 절반만 사용)`, 'bad'); return; }
        t.conditions.push(nm); this.say(`${t.name}: Condition 「${nm}」 — Kratos Pool에 토큰을 절반만 놓음${nm === 'Greed-crazed' ? ', 절반만 사용' : ''}`, 'bad'); return;
      }
      if ((nm === 'Wishkeen' || nm === 'Wishagog') && this.prim && this.prim.disabled[nm]) { this.say(`(${nm} 비활성화됨)`); return; }
      if ((nm === 'Wishkeen' || nm === 'Wishagog') && this.trait('Wishtanglement') && !this._tangle) { this._tangle = true; try { await this.midasCondition(t, nm, vol); for (const o of this.liveTitans().filter(x => x !== t)) { this.say(`Wishtanglement: ${o.name}도 ${nm}`, 'bad'); await this.solo(() => this.midasCondition(o, nm, vol)); } } finally { this._tangle = false; } return; }
      if (nm === 'Wishkeen' || nm === 'Wishagog') { if (t.conditions.includes('Wishagog')) { this.say(`${t.name}: Wishagog 상태에서 ${nm} 획득 — 사망`, 'bad'); return this.kill(t); } if (t.conditions.includes('Wishkeen')) { t.conditions = t.conditions.map(c => c === 'Wishkeen' ? 'Wishagog' : c); this.say(`${t.name}: Wishkeen → Wishagog`, 'bad'); return; } t.conditions.push(nm); this.say(`${t.name}: Condition 「${nm}」`, 'bad'); return; }
      if (nm === 'Enriched' || nm === 'Enlightened') { t.conditions = t.conditions.filter(c => c !== nm); t.conditions.push(nm); t[nm === 'Enriched' ? 'enrichedExp' : 'enlightenedExp'] = this.round + 1; this.say(`${t.name}: Condition 「${nm}」 — 비자발적 토큰/Condition 획득 불가(Ambrosia·Trespass 제외)${nm === 'Enlightened' ? ', 토큰·Condition 자유롭게 버리기 가능' : ''}. 다음 Primordial Round 끝에 버림`, 'good'); return; }
      if (t.conditions.includes(nm)) { this.say(`${t.name}: 이미 ${nm}`); return; }
      t.conditions.push(nm); this.say(`${t.name}: Condition 「${nm}」`, 'bad');
    },
    noInvol(t, what) { if (!t || !t.conditions || !(t.conditions.includes('Enriched') || t.conditions.includes('Enlightened'))) return false; if (/Ambrosia|Trespass/.test(what)) return false; this.say(`${t.name}: ${t.conditions.includes('Enlightened') ? 'Enlightened' : 'Enriched'} — ${what} 획득 무시`, 'good'); return true; },
    kpUse(n) { const t = this._actor; if (t && t.conditions.includes('Greed-crazed') && n > 0) { const h = Math.floor(n / 2); if (!this._kpUseSaid) { this._kpUseSaid = true; this.say(`${t.name}: Greed-crazed — Kratos Pool 토큰 절반만 사용`, 'bad'); setTimeout(() => { this._kpUseSaid = false; }, 0); } return h; } return n; },
    midasRemoved(t, n) {
      if (!t || !t.alive || n < 2) return;
      if (t.conditions.includes('Greed-crazed') && n >= 4) { t.conditions = t.conditions.filter(c => c !== 'Greed-crazed'); t.tokens.precision += 2; this.say(`${t.name}: GIVEAWAY — Midas ${n}개 제거, Greed-crazed 버리고 Enlightened + Precision 토큰 2`, 'good'); this.midasCondition(t, 'Enlightened', true); }
      else if (t.conditions.includes('Covetous')) { t.conditions = t.conditions.filter(c => c !== 'Covetous'); t.tokens.precision += 1; this.say(`${t.name}: GIVEAWAY — Midas ${n}개 제거, Covetous 버리고 Enriched + Precision 토큰 1`, 'good'); this.midasCondition(t, 'Enriched', true); }
    },
    // ---------- custom AI (curses, routine, Auric Ray) ----------
    async midasAI(card, { isSignature = false, forcedTarget = null } = {}) {
      const M = card.midas || {};
      if (M.routine) { this.say(`ROUTINE 「${card.name}」: ${card.text}`, 'ai'); for (const x of this.liveTitans()) await this.solo(async () => { await this.midasX(x, 2, 'tokens'); if (x.alive) await this.gainAmbrosia(x, 2); }); return; }
      if (M.curse) {
        const [head, ...rest] = card.text.split(' — ')[1].split(/:\s/); const body = rest.join(': ');
        const fm = /FATE (\d)\+/.exec(head); const need = fm ? +fm[1] : 6;
        const cands = this.liveTitans().filter(x => !x.offBoard && (x.impaled || this.primLos(x)) && this.mGate(x, null, need));
        let tg = forcedTarget || null; if (!tg && cands.length) { const mn = Math.min(...cands.map(x => this.distTo(x))); const c2 = cands.filter(x => this.distTo(x) === mn); tg = c2.find(x => x.pt) || c2[0]; }
        const sents = (body.match(/[^.]+\./g) || []).map(x => x.trim());
        // first sentences up to the first "board-wide" one apply to the cursed titan
        const boardIdx = sents.findIndex(x => /^(Airburst|Remove \d+ empty|Each Titan)/.test(x)); const own = boardIdx < 0 ? sents : sents.slice(0, boardIdx); const all = boardIdx < 0 ? [] : sents.slice(boardIdx);
        this.say(`CURSE 「${card.name}」 — ${tg ? `${tg.name} (Fate ${tg.fate}${this.goldtaste(tg) ? ', Goldtaste' : ''})` : `Fate ${need}+ 타이탄 없음`}`, 'ai');
        this._curseImm = new Set(); for (const x of this.liveTitans()) if (await this.curseIgnore(x, card)) this._curseImm.add(x);
        if (tg && !this._curseImm.has(tg)) { await this.reactionWindow(tg, card, head.trim()); if (tg.alive) for (const s of own) await this.solo(() => this.doEffects(tg, s, { card })); }
        for (let i = 0; i < all.length; i++) {
          let s = all[i]; const win = s.startsWith('⚡'); s = s.replace(/^⚡\s*/, '');
          if (win) await this.reactionWindow(this.liveTitans()[0], card, s);
          let m;
          if ((m = /^Airburst (\d+)\.$/.exec(s))) { const hit = await this.airburst(+m[1]); const nx = all[i + 1] || ''; let mm; if ((mm = /^Every affected Titan gains (\d) Midas tokens\.$/.exec(nx))) { i++; for (const x of hit) if (x.alive && !this._curseImm.has(x)) await this.solo(() => this.midasX(x, +mm[1], 'tokens')); } continue; }
          if ((m = /^Remove (\d+) empty Terrain tiles from the Battle Board\.$/.exec(s))) { await this.removeEmptyTiles(+m[1]); continue; }
          if ((m = /^Each Titan gains (\d) Midas tokens\.$/.exec(s))) { for (const x of this.liveTitans().filter(y => !this._curseImm.has(y))) await this.solo(() => this.midasX(x, +m[1], 'tokens')); continue; }
          if ((m = /^Each Titan without an Umbrella Gear card gains (\d) Midas tokens and (\d) Ambrosia tokens\.$/.exec(s))) { for (const x of this.liveTitans().filter(y => !this._curseImm.has(y))) { if (x.gear.some(g => !g.discarded && (g.card.traits || []).includes('Umbrella'))) { this.say(`${x.name}: Umbrella — Auric Rain 무시`, 'good'); continue; } await this.solo(async () => { await this.midasX(x, +m[1], 'tokens'); if (x.alive) await this.gainAmbrosia(x, +m[2]); }); } continue; }
          await this.solo(() => this.doEffects(this.liveTitans()[0], s, { card }));
        }
        this._curseImm = null;
        if (card.midas.after) await this.doEffects(this.liveTitans()[0], card.midas.after, { card });
        return;
      }
      if (M.laser) {
        let tgt = forcedTarget || await this.unearthly(card, this.pickTarget(card.target, true)); if (!tgt) { this.say('유효한 타겟 없음 → Routine', 'ai'); return this.resolveRoutine(this.routine); }
        this.say(`타겟: ${tgt.name}`);
        if (this.mGate(tgt, null, 6)) this.say(`${tgt.name}: Fate 6+ — ⚡ 무시`, 'bad'); else { await this.reactionWindow(tgt, card, 'MOVE LATERAL & ATTACK'); if (!tgt.alive) return; }
        if (!tgt.impaled && !tgt.onVP) await this.laserLateral(tgt);
        const hits = tgt.onVP || tgt.impaled ? [tgt] : this.laserTargets({ ...card, oracle: { laser: 'single' } }, tgt).hits;
        for (const x of hits) { if (!x.alive) continue; try { await this.primAttackOn(x, card); } catch (e) { if (e instanceof BattleOver) throw e; if (!(e instanceof TitanDied)) throw e; } }
        return;
      }
    },
    async removeEmptyTiles(n) {
      const ids = []; const seen = new Set(); for (const [k, ter] of this.board.terrain) { if (seen.has(ter.id)) continue; seen.add(ter.id); const cells = [...this.board.terrain].filter(([, x]) => x.id === ter.id).map(([kk]) => kk.split(',').map(Number)); if (cells.some(([c, r]) => this.titanAt(c, r))) continue; ids.push({ id: ter.id, type: ter.type, at: cellLabel({ c: cells[0][0], r: cells[0][1] }) }); }
      const pick = [];
      while (pick.length < n && ids.length) {
        const cellOf = x => { const [c, r] = [...this.board.terrain].find(([, y]) => y.id === x.id)[0].split(',').map(Number); return { c, r }; };
        const x = ids.length + pick.length <= n ? ids[0] : await this.ask({ type: 'move', title: `The Grand Crash: 제거할 빈 지형 타일 선택 (${pick.length + 1}/${n})`, cells: ids.map(cellOf), options: ids.map(y => ({ label: `${y.type} ${y.at}`, value: cellOf(y) })) }).then(p => (p && ids.find(y => { const q = cellOf(y); return q.c === p.c && q.r === p.r; })) || ids[0]);
        ids.splice(ids.indexOf(x), 1); pick.push(x); this.board.removeTerrainId(x.id); this.notify();
      }
      this.say(`The Grand Crash: 빈 지형 타일 ${pick.length}개 제거 — ${pick.map(x => x.at).join(', ')}`, 'ai'); this.notify();
    },
    // ---------- critical wounds ----------
    async midasCritical(t, A) {
      const c = A.bp.critical || '';
      if (/^Gain the Priority Target token\. You may perform a Bonus Attack/.test(c)) { if (!this.ptHolder()?.ptLocked) { for (const x of this.titans) x.pt = false; t.pt = true; this.say(`${t.name}: Priority Target`); } this.pendingFollowUp = t; this.say(`${t.name}: 보너스 공격 예약`, 'good'); return true; }
      if (/^Deal an additional Single Wound/.test(c)) { A.extraWound = 1; return true; }
      if (/^Each Titan may perform Unholy Alchemy/.test(c)) { for (const x of this.liveTitans().filter(y => this.midas(y) > 0)) { const ok = await this.ask({ type: 'yn', titan: x, title: `${x.name}: Unholy Alchemy? (Midas ${this.midas(x)} → Ambrosia)`, options: [{ label: '사용', value: true }, { label: '패스', value: false }] }); if (ok) await this.solo(() => this.unholyAlchemy(x)); } return true; }
      if (/^Create the Vantage Point\. If the VP is already in play, gain \+2 Precision/.test(c)) { if (this.prim.vp.created) { this.prim.longNeck = true; this.say('Long Neck: 전투 끝까지 VP 위 또는 Impaled 상태로 공격 시 +2 Precision', 'good'); } else this.createVP(null); return true; }
      if (/^Create the Vantage Point\. If the VP is already in play, during the second ability window place 1 negative AT/.test(c)) { if (this.prim.vp.created) { A.vpNegAT = true; (0) && 0; this.say('Muscle Floaters: VP 이미 있음 — Kratos Pool에 −AT 토큰 1개', 'good'); } else this.createVP(null); return true; }
      if (/^Create the Vantage Point and immediately climb it/.test(c)) { this.createVP(null); if (t.alive && !t.onVP && this.vpRoom()) { if (t.impaled) t.impaled = false; this.mountVP(t, 'Immovable Horn'); } this.say('(Bihorn Lance — 캠페인 보상)', 'sys'); return true; }
      if (/^Gain the Enriched Condition card/.test(c)) { await this.midasCondition(t, 'Enriched'); return true; }
      if (/^Until the end of Battle, Imperial Impetus distance is halved/.test(c)) { this.prim.halfImpetus = true; this.say(`Imperial Impetus 거리 절반 → ${this.impetusDist()}`, 'good'); return true; }
      if (/^Each Titan may discard up to 3 Midas tokens/.test(c)) { for (const x of this.liveTitans().filter(y => this.midas(y) > 0)) { const n = await this.ask({ type: 'choice', titan: x, title: `${x.name}: Midas 토큰 최대 3개 버리기 (현재 ${this.midas(x)})`, options: Array.from({ length: Math.min(3, this.midas(x)) + 1 }, (_, i) => ({ label: i ? `${i}개` : '안 함', value: i })) }); if (n) await this.loseMidas(x, n); } return true; }
      if (/^Disable the Airburst X keyword/.test(c)) { this.prim.disabled.airburst = true; this.say('Airburst 비활성화', 'good'); return true; }
      if (/^Disable the Impaled Status card/.test(c)) { for (const x of this.liveTitans().filter(y => y.impaled)) await this.unimpale(x, 'Hind Horns'); this.prim.disabled.impaled = true; this.say('Impaled 비활성화', 'good'); return true; }
      if (/^The Midascore dies/.test(c)) { this.say(`🏆 ${this.prim.name}이(가) 죽었습니다!`, 'good'); throw new BattleOver('victory'); }
      if (/^Disable the Midas X keyword/.test(c)) { this.prim.disabled.midasX = true; this.say('Midas X 키워드 비활성화 (Midascore 효과)', 'good'); return true; }
      if (/^Disable the Imperial Impetus Trait/.test(c)) { this.prim.disabled.impetus = true; this.say('Imperial Impetus 비활성화', 'good'); return true; }
      if (/^You may discard an Affliction or Condition card/.test(c)) { const list = [...t.conditions]; if (list.length) { const v = await this.ask({ type: 'choice', titan: t, title: "King's Scroll: 버릴 Affliction/Condition", options: [{ label: '안 함', value: null }, ...list.map(x => ({ label: x, value: x }))] }); if (v) { if (v === 'Float') this.deflate(t, "King's Scroll"); else { t.conditions = t.conditions.filter(x => x !== v); if (v === 'Bleeding') t.bleeding = 0; this.say(`${t.name}: ${v} 버림`, 'good'); } } return true; } this.pendingFollowUp = t; this.say(`${t.name}: 버릴 카드가 없어 보너스 공격`, 'good'); return true; }
      if (/\(campaign\)/.test(c)) { this.say(`(${c} — 캠페인 보상)`, 'sys'); return true; }
      return false;
    },
    // ---------- round / turn hooks ----------
    async midasPrimRoundStart() { if (this.trait('Aggressive Expansion')) { this.say('Aggressive Expansion: ⚡ Airburst 3', 'ai'); const w = this.liveTitans()[0]; if (w) await this.reactionWindow(w, { name: 'Aggressive Expansion' }, 'Airburst 3'); await this.airburst(3); } },
    async midasPrimRoundEnd() { for (const t of this.liveTitans()) for (const [nm, k] of [['Enriched', 'enrichedExp'], ['Enlightened', 'enlightenedExp']]) if (t.conditions.includes(nm) && (t[k] || 0) <= this.round) { t.conditions = t.conditions.filter(c => c !== nm); this.say(`${t.name}: ${nm} 버림 (Primordial Round 종료)`); }
      if (this.trait('Sunken Costs')) for (const t of this.liveTitans()) { const n = this.midas(t); if (n) { this.say(`Sunken Costs: ${t.name} Midas ${n} → Danger +${n}`, 'bad'); await this.solo(() => this.gainDanger(t, n, { source: 'Sunken Costs' })); } } },
    async midasTurnStart(t) {
      t._startImpaled = !!t.impaled; if (t.float === 'down') this.deflate(t, '턴 시작');
      if (this.goldthirst(t)) { this.say(`${t.name}: Goldthirst Curse — Midas 1`, 'bad'); await this.midasX(t, 1, 'Goldthirst'); if (!t.alive) return; }
      await this.citiesOfGold(t, '턴 시작');
    },
    async midasTurnEnd(t) {
      if (!t.alive) return; if (t.float === 'up') { if (t.floatFresh) t.floatFresh = false; else { t.float = 'down'; this.say(`${t.name}: Float 카드 뒤집음 (DOWN) — 자발적 이동·공격·능력 사용 또는 다음 턴 시작 시 Deflate`); } } await this.impaledEndTurn(t); if (!t.alive) return; await this.citiesOfGold(t, '턴 종료'); if (!t.alive) return;
      if (this.trait('Loss of Liquidity') && !t._movedThisTurn && !t.offBoard) { this.say(`${t.name}: Loss of Liquidity — 이번 턴 이동하지 않음, 사망`, 'bad'); await this.kill(t); }
    },
    enlightenedActions(t) {
      if (!t.conditions.includes('Enlightened')) return [];
      const out = []; const disc = t.conditions.filter(c => !['Enlightened', 'Goldthirst', 'Windblight'].includes(c));
      for (const c of disc) out.push({ label: `Enlightened: Condition 「${c}」 버리기`, noFate: true, value: async () => { if (c === 'Float') return this.deflate(t, 'Enlightened'); t.conditions = t.conditions.filter(x => x !== c); if (c === 'Bleeding') t.bleeding = 0; if (c === 'Death') t.deathTokens = 0; this.say(`${t.name}: Enlightened — ${c} 버림`, 'good'); } });
      if (this.midas(t)) out.push({ label: `Enlightened: Midas 토큰 버리기 (${this.midas(t)}개)`, noFate: true, value: async () => { await this.loseMidas(t, this.midas(t)); } });
      if (t.despair) out.push({ label: `Enlightened: Despair 토큰 버리기 (${t.despair})`, noFate: true, value: async () => { t.despair = 0; this.say(`${t.name}: Despair 토큰 버림`, 'good'); } });
      if (t.tokens.precision < 0 || t.tokens.evasion < 0) out.push({ label: 'Enlightened: 음수 Precision/Evasion 토큰 버리기', noFate: true, value: async () => { t.tokens.precision = Math.max(0, t.tokens.precision); t.tokens.evasion = Math.max(0, t.tokens.evasion); this.say(`${t.name}: 음수 토큰 버림`, 'good'); } });
      return out;
    },
    liquidityPen(t) { if (!this.prim || !this.prim.def.midasD || !this.trait('Loss of Liquidity')) return 0; return t.gear.filter(g => !g.discarded && !this.isWeaponGear(g)).reduce((a, g) => a + (g.midas || 0), 0); },
  });
}
