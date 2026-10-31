// ATO Mnestis — engine core: RNG, dice, decks, board geometry
export class RNG {
  constructor(seed = Date.now() % 2147483647) { this.s = seed || 1; }
  next() { // Park-Miller
    this.n = (this.n || 0) + 1; this.s = (this.s * 48271) % 2147483647; return this.s / 2147483647;
  }
  int(n) { return Math.floor(this.next() * n); }
  d10() { return this.int(10) + 1; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

// Power die faces, read from a photo of the physical dice (P = Power, O = Potential, Q = ??? symbol).
// red:   [Q] [O] [P] [PO] [PO] [QPP]
// black: [QO] [PO] [PO] [QPP] [PPO] [QPPOO]
// white: [QPO] [QPOO] [POOO] [QPPO] [PPOOO] [QPPPOO]
// mortal: [QPOO] [QPOOO] [QPPOOO] [PPOOOO] [PPPOO] [QPPPOOOO]
export const POWER_DIE_FACES = {
  r: ['Q', 'O', 'P', 'PO', 'PO', 'QPP'],
  b: ['QO', 'PO', 'PO', 'QPP', 'PPO', 'QPPOO'],
  w: ['QPO', 'QPOO', 'POOO', 'QPPO', 'PPOOO', 'QPPPOO'],
  // Mortal die — highest tier (above white).
  m: ['QPOO', 'QPOOO', 'QPPOOO', 'PPOOOO', 'PPPOO', 'QPPPOOOO'],
};
export const facePower = f => (f.match(/P/g) || []).length;
export const facePotential = f => (f.match(/O/g) || []).length;
export const TIER_UP = { r: 'b', b: 'w', w: 'm', m: 'm' }; // red < black < white < mortal

export class Deck {
  constructor(cards = [], rng) { this.cards = [...cards]; this.discard = []; this.rng = rng; }
  shuffle() { this.rng.shuffle(this.cards); return this; }
  draw() { if (this.rng) this.rng.draws = (this.rng.draws || 0) + 1; if (!this.cards.length) { if (!this.discard.length) return null; this.cards = this.discard; this.discard = []; this.shuffle(); } return this.cards.shift(); }
  size() { return this.cards.length; }
  putBottom(c) { this.cards.push(c); }
  putTop(c) { this.cards.unshift(c); }
  shuffleIn(c) { this.cards.push(c); this.shuffle(); }
  shuffleDiscardIn() { this.cards.push(...this.discard); this.discard = []; this.shuffle(); }
  peek() { return this.cards[0] || null; }
  // remove one card matching pred, deck first then discard. returns {card, from}
  removeFirst(pred) {
    let i = this.cards.findIndex(pred); if (i >= 0) return { card: this.cards.splice(i, 1)[0], from: 'deck' };
    i = this.discard.findIndex(pred); if (i >= 0) return { card: this.discard.splice(i, 1)[0], from: 'discard' };
    return null;
  }
}

// ---------- Board ----------
// Coordinates: {c: 1..cols, r: 1..rows}; r=1 is row A (bottom). Label e.g. "H10".
export const ROWS = 'ABCDEFGHIJKLMN';
export function parseCell(label) { const m = /^([A-N])(\d+)$/.exec(label); return { r: ROWS.indexOf(m[1]) + 1, c: +m[2] }; }
export function cellLabel({ c, r }) { return ROWS[r - 1] + c; }
export const key = (c, r) => `${c},${r}`;
export const DIRS = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
export const DIR_LIST = ['N', 'E', 'S', 'W'];
export const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

export class Board {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.terrain = new Map(); // key -> {type, id, obstacle, obscuring, destructible}
    this.walls = new Map(); // edgeKey -> labyrinth tile id (red lines)
    this.lab = new Map();   // cell key -> labyrinth tile id
    this.labTiles = new Map(); // id -> {id, shape, cells, edges}
  }
  static edgeKey(a, b) { const ka = key(a.c, a.r), kb = key(b.c, b.r); return ka < kb ? ka + '|' + kb : kb + '|' + ka; }
  hasWall(a, b) { if (this.labIsChasm) return false; return this.walls.has(Board.edgeKey(a, b)); }
  isChasm(c, r) { const t = this.terrainAt(c, r); if (this.allChasm === 'empty') { if (!t) return true; } else if (this.allChasm) return true; return !!((t && (t.chasm || (this.ambChasm && t.ambrosia))) || (this.labIsChasm && this.labAt(c, r))); }
  setTerrainProps(id, props) { for (const t of this.terrain.values()) if (t.id === id) Object.assign(t, props); }
  labAt(c, r) { return this.lab.get(key(c, r)) || null; }
  // Labyrinth geometry: returns [{cells:[{c,r}], edges:[[a,b]]}] for the given shape def, rotation (0-3, clockwise) and board anchor (top-left of the rotated bounding box)
  static labGeometry(def, rot, anchor, flip = false) {
    const order = ['N', 'E', 'S', 'W']; const rotDir = d => order[(order.indexOf(d) + rot) % 4]; const fl = { E: 'W', W: 'E', N: 'N', S: 'S' };
    const mxx = Math.max(...def.cells.map(c => c.x));
    let pts = def.cells.map(c => { let x = flip ? mxx - c.x : c.x, y = c.y; const w0 = flip ? c.walls.map(d => fl[d]) : c.walls; for (let i = 0; i < rot; i++) [x, y] = [-y, x]; return { x, y, walls: w0.map(rotDir) }; });
    const mx = Math.min(...pts.map(p => p.x)), my = Math.min(...pts.map(p => p.y)); pts = pts.map(p => ({ ...p, x: p.x - mx, y: p.y - my }));
    const D = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
    const cells = pts.map(p => ({ c: anchor.c + p.x, r: anchor.r - p.y })); const edges = [];
    pts.forEach((p, i) => p.walls.forEach(w => { const a = cells[i]; edges.push([a, { c: a.c + D[w][0], r: a.r + D[w][1] }]); }));
    return { cells, edges };
  }
  placeLab(id, shape, geo) { this.labTiles.set(id, { id, shape, cells: geo.cells, edges: geo.edges }); for (const c of geo.cells) this.lab.set(key(c.c, c.r), id); for (const [a, b] of geo.edges) this.walls.set(Board.edgeKey(a, b), id); }
  removeLab(id) { const t = this.labTiles.get(id); if (!t) return; for (const c of t.cells) if (this.lab.get(key(c.c, c.r)) === id) this.lab.delete(key(c.c, c.r)); for (const [a, b] of t.edges) if (this.walls.get(Board.edgeKey(a, b)) === id) this.walls.delete(Board.edgeKey(a, b)); this.labTiles.delete(id); }
  inBounds(c, r) { return c >= 1 && c <= this.cols && r >= 1 && r <= this.rows; }
  addTerrain(cells, props) { const id = props.id; for (const l of cells) { const p = parseCell(l); this.terrain.set(key(p.c, p.r), { ...props, id, cell: p }); } }
  terrainAt(c, r) { return this.terrain.get(key(c, r)) || null; }
  removeTerrainId(id) { for (const [k, t] of this.terrain) if (t.id === id) { if (t.reinforced) { t.reinforced = false; if (t.type === 'Arcology') t.type = 'Ruined Arcology'; t._downgraded = true; } else this.terrain.delete(k); } } // Reinforced Destructible: first destruction downgrades (Arcology → Ruined Arcology)
  isObstacle(c, r) { if (this.tf != null && c <= this.tf) return true; const t = this.terrainAt(c, r); return !!(t && t.obstacle && !(this._elevMove && !t.cloud)); }
  static dist(a, b) { return Math.abs(a.c - b.c) + Math.abs(a.r - b.r); }
  // distance from a point to the nearest of a set of cells
  static distToCells(a, cells) { return Math.min(...cells.map(x => Board.dist(a, x))); }
  static adjacentCells(cells) { // cells orthogonally adjacent to a footprint (excluding the footprint)
    const set = new Set(cells.map(x => key(x.c, x.r))); const out = [];
    for (const x of cells) for (const d of DIR_LIST) { const n = { c: x.c + DIRS[d][0], r: x.r + DIRS[d][1] }; if (!set.has(key(n.c, n.r))) { set.add(key(n.c, n.r)); out.push(n); } }
    return out;
  }
  static isAdjacent(a, cells) { return cells.some(x => Board.dist(a, x) === 1); }

  // ----- Line of Sight (corner-to-corner, obscuring terrain and red lines block) -----
  // Each cell c,r occupies square [c-1,c]x[r-1,r] in continuous coords.
  hasLoS(cellsA, cellsB, ignoreLab = false) {
    this._ignoreLab = ignoreLab;
    const blockers = []; for (const t of this.terrain.values()) if (t.obscuring) blockers.push(t.cell);
    const selfSet = new Set([...cellsA, ...cellsB].map(x => key(x.c, x.r)));
    const corners = cells => { const s = new Set(); const out = []; for (const x of cells) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const p = [x.c - 1 + dx, x.r - 1 + dy]; const k = p.join(','); if (!s.has(k)) { s.add(k); out.push(p); } } return out; };
    for (const p of corners(cellsA)) for (const q of corners(cellsB)) {
      if (p[0] === q[0] && p[1] === q[1]) continue;
      if (this._segmentClear(p, q, blockers, selfSet)) return true;
    }
    return false;
  }
  _segmentClear(p, q, blockers, selfSet) {
    const EPS = 1e-9;
    const touchedCorners = new Map(); // corner key -> count of blockers touched only at that corner
    for (const b of blockers) {
      if (selfSet.has(key(b.c, b.r))) continue; // tiles never block LoS to miniatures on them
      const x0 = b.c - 1, y0 = b.r - 1, x1 = b.c, y1 = b.r;
      // clip segment to the square; measure overlap length
      const res = clipSegment(p, q, x0, y0, x1, y1);
      if (!res) continue;
      const len = Math.hypot(res[1][0] - res[0][0], res[1][1] - res[0][1]);
      if (len > EPS) return false; // passes through interior or along an edge
      // touches a single point: corner?
      const pt = res[0]; const isCorner = (Math.abs(pt[0] - x0) < EPS || Math.abs(pt[0] - x1) < EPS) && (Math.abs(pt[1] - y0) < EPS || Math.abs(pt[1] - y1) < EPS);
      if (!isCorner) return false; // touching an edge midpoint = along edge (degenerate); treat as blocked
      const ck = `${Math.round(pt[0])},${Math.round(pt[1])}`; touchedCorners.set(ck, (touchedCorners.get(ck) || 0) + 1);
    }
    // two diagonal features meeting at the crossed corner block LoS
    for (const n of touchedCorners.values()) if (n >= 2) return false;
    if (!this._ignoreLab && !this.labIsChasm) { const ends = new Map(); for (const ek of this.walls.keys()) { const [a, b] = ek.split('|').map(k => k.split(',').map(Number)); const r = segBlocksWall(p, q, a, b); if (r === true) return false; if (r) ends.set(r, (ends.get(r) || 0) + 1); }
      // passing through a point where two red-line segments meet (continuing or turning) is passing through the line
      for (const n of ends.values()) if (n >= 2) return false; }
    return true;
  }
}
// wall segment between cells a=[c,r] and b=[c,r] (orthogonal neighbours): the shared edge in continuous coords
function segBlocksWall(p, q, a, b) {
  let w1, w2; if (a[0] !== b[0]) { const x = Math.max(a[0], b[0]) - 1; w1 = [x, a[1] - 1]; w2 = [x, a[1]]; } else { const y = Math.max(a[1], b[1]) - 1; w1 = [a[0] - 1, y]; w2 = [a[0], y]; }
  const EPS = 1e-9; const cross = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  const d1 = cross(w1, w2, p), d2 = cross(w1, w2, q), d3 = cross(p, q, w1), d4 = cross(p, q, w2);
  if (Math.abs(d1) < EPS && Math.abs(d2) < EPS) { // collinear: blocked if overlapping with positive length
    const ax = w1[0] === w2[0] ? 1 : 0; const lo = Math.max(Math.min(p[ax], q[ax]), Math.min(w1[ax], w2[ax])), hi = Math.min(Math.max(p[ax], q[ax]), Math.max(w1[ax], w2[ax])); return hi - lo > EPS; }
  if ((d1 > EPS && d2 < -EPS || d1 < -EPS && d2 > EPS) && (d3 > EPS && d4 < -EPS || d3 < -EPS && d4 > EPS)) return true; // proper crossing
  // touching the interior of the wall (not its endpoints) also blocks
  const onSeg = (o, u, v) => Math.min(u[0], v[0]) - EPS <= o[0] && o[0] <= Math.max(u[0], v[0]) + EPS && Math.min(u[1], v[1]) - EPS <= o[1] && o[1] <= Math.max(u[1], v[1]) + EPS;
  const isEnd = o => (Math.abs(o[0] - w1[0]) < EPS && Math.abs(o[1] - w1[1]) < EPS) || (Math.abs(o[0] - w2[0]) < EPS && Math.abs(o[1] - w2[1]) < EPS);
  for (const o of [p, q]) if (Math.abs(cross(w1, w2, o)) < EPS && onSeg(o, w1, w2) && !isEnd(o)) return true;
  // segment passes through one of the wall's endpoints → report that point
  for (const e of [w1, w2]) if (Math.abs(cross(p, q, e)) < EPS && onSeg(e, p, q)) return `${Math.round(e[0])},${Math.round(e[1])}`;
  return false;
}
// Liang–Barsky clipping of segment p->q against axis-aligned box; returns clipped endpoints or null
function clipSegment(p, q, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1; const dx = q[0] - p[0], dy = q[1] - p[1];
  const checks = [[-dx, p[0] - x0], [dx, x1 - p[0]], [-dy, p[1] - y0], [dy, y1 - p[1]]];
  for (const [pp, qq] of checks) {
    if (Math.abs(pp) < 1e-12) { if (qq < -1e-12) return null; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  if (t0 > t1) return null;
  return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
}

// BFS for Titan voluntary movement: returns Map key->dist of reachable cells (excluding start) within max steps
export function reachable(board, start, max, blockedSet, ignoreTerrain = false, ignoreLab = false) {
  if (!ignoreTerrain && !board._noSlip && (board.allSlip || [...board.terrain.values()].some(t => t.slippery))) return reachableSlip(board, start, max, blockedSet, ignoreLab);
  return reachablePlain(board, start, max, blockedSet, ignoreTerrain, ignoreLab);
}
// Slippery (Black Glacier / Black Lake): after moving onto a slippery space, keep moving in the same cardinal direction while on the tile
export function reachableSlip(board, start, max, blockedSet, ignoreLab = false) {
  const slip = (c, r) => !!(board.allSlip || (board.terrainAt(c, r) && board.terrainAt(c, r).slippery));
  const ok = (cur, n) => board.inBounds(n.c, n.r) && !blockedSet.has(key(n.c, n.r)) && !(!ignoreLab && board.hasWall(cur, n)) && !board.isObstacle(n.c, n.r) && !board.isChasm(n.c, n.r);
  const out = new Map(); const seen = new Set(); const q = [{ p: start, d: 0, dir: null }];
  while (q.length) {
    const { p, d, dir } = q.shift(); const sk = `${p.c},${p.r},${dir}`; if (seen.has(sk)) continue; seen.add(sk);
    const forced = dir && slip(p.c, p.r);
    if (d > 0) { const nf = forced ? { c: p.c + DIRS[dir][0], r: p.r + DIRS[dir][1] } : null; const canStop = !forced || d >= max || !ok(p, nf); if (canStop) { const k2 = key(p.c, p.r); if (!out.has(k2) || out.get(k2) > d) out.set(k2, d); } }
    if (d >= max) continue;
    for (const dn of (forced ? [dir] : DIR_LIST)) { const n = { c: p.c + DIRS[dn][0], r: p.r + DIRS[dn][1] }; if (!ok(p, n)) continue; q.push({ p: n, d: d + 1, dir: dn }); }
  }
  out.delete(key(start.c, start.r)); return out;
}
export function reachablePlain(board, start, max, blockedSet, ignoreTerrain = false, ignoreLab = false) {
  const dist = new Map([[key(start.c, start.r), 0]]); const q = [start];
  while (q.length) {
    const cur = q.shift(); const d = dist.get(key(cur.c, cur.r)); if (d >= max) continue;
    for (const dn of DIR_LIST) {
      const n = { c: cur.c + DIRS[dn][0], r: cur.r + DIRS[dn][1] }; const k = key(n.c, n.r);
      if (!board.inBounds(n.c, n.r) || dist.has(k) || blockedSet.has(k)) continue;
      if (!ignoreLab && board.hasWall(cur, n)) continue;
      if (!ignoreTerrain && (board.isObstacle(n.c, n.r) || board.isChasm(n.c, n.r))) continue;
      dist.set(k, d + 1); q.push(n);
    }
  }
  dist.delete(key(start.c, start.r));
  if (ignoreTerrain) for (const k of [...dist.keys()]) { const [c, r] = k.split(',').map(Number); if (board.isObstacle(c, r) || board.isChasm(c, r)) dist.delete(k); }
  return dist;
}
export function bfsPath(board, start, goalSet, blockedSet) { // shortest path to any goal cell; returns array of cells (excluding start) or null
  const prev = new Map([[key(start.c, start.r), null]]); const q = [start];
  while (q.length) {
    const cur = q.shift(); const ck = key(cur.c, cur.r);
    if (goalSet.has(ck) && ck !== key(start.c, start.r)) { const path = []; let k = ck; while (k && prev.get(k) !== null) { const [c, r] = k.split(',').map(Number); path.unshift({ c, r }); k = prev.get(k); } return path; }
    for (const dn of DIR_LIST) {
      const n = { c: cur.c + DIRS[dn][0], r: cur.r + DIRS[dn][1] }; const k = key(n.c, n.r);
      if (!board.inBounds(n.c, n.r) || prev.has(k) || board.isObstacle(n.c, n.r) || (blockedSet.has(k) && !goalSet.has(k))) continue;
      prev.set(k, ck); q.push(n);
    }
  }
  return null;
}

const KWPRE = `(?:^|[.;!)]\\s+|\\*|(?:Double|and) (?=Commit))`;
// keyword lookup: only at the start of a clause (after '.', ';', cost symbols). [R]-costed matches are reactions, not passive keywords.
// Passive (cost-free) numeric matches are summed; otherwise the first costed match is returned.
const kwRe = name => new RegExp(`${KWPRE}((?:\\[(?:R|charge|Midas|Amb|Fire|Λ|Movement|Aether|Speed|Hermes|Oxygen)\\]|[Ψ⟳Λ]|X(?=[\\s:\\[ΨΛ⟳]))*):?\\s*${name}(?: (\\d+))?(?: \\([^)]*\\))?(?=[.;]|$)`, 'gi');
export const kw = (text, name) => { const re = kwRe(name); let m, pas = null, first = null; while ((m = re.exec(text || ''))) { if (/\[R\]/i.test(m[1])) continue; const v = m[2] !== undefined ? +m[2] : true; if (first === null) first = v; if (!m[1]) pas = (typeof v === 'number') ? (typeof pas === 'number' ? pas : 0) + v : (pas === null ? true : pas); } return pas !== null ? pas : first; };
// cost prefix of a keyword ('' = passive/free, null = absent). Prefers a free match.
export const kwCost = (text, name) => { const re = kwRe(name); let m, c = null; while ((m = re.exec(text || ''))) { if (/\[R\]/i.test(m[1])) continue; if (!m[1]) return ''; if (c === null) c = m[1]; } return c; };
