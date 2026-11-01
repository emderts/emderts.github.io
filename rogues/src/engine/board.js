// Clash Board geometry (rulebook pp.42–49): 14×10 grid, cardinal adjacency, shortest-path distance, facing, zones, LoS.
// Cells are {c, r} with c = 1..cols (left→right) and r = 0..rows-1 (row A = 0, bottom).

export class Board {
  constructor(cfg = { cols: 14, rows: 10, rowLabels: 'ABCDEFGHIJ'.split('') }) {
    this.cols = cfg.cols; this.rows = cfg.rows; this.rowLabels = cfg.rowLabels || 'ABCDEFGHIJ'.split('').slice(0, this.rows);
    /** blocked[key] = { obstacle: bool, chasm: bool, obscuring: bool, difficult: bool, id } — terrain tiles */
    this.terrain = new Map();
    /** occupant per cell key: { kind: 'knight'|'monster'|'mob', id } */
    this.occ = new Map();
  }
  key(cell) { return `${cell.c},${cell.r}`; }
  label(cell) { return `${this.rowLabels[cell.r]}${cell.c}`; }
  parse(label) { const m = /^([A-Z])(\d+)$/.exec(label); if (!m) throw new Error('bad cell ' + label); return { c: +m[2], r: this.rowLabels.indexOf(m[1]) }; }
  inside(cell) { return cell.c >= 1 && cell.c <= this.cols && cell.r >= 0 && cell.r < this.rows; }
  neighbors(cell) { return [{ c: cell.c + 1, r: cell.r }, { c: cell.c - 1, r: cell.r }, { c: cell.c, r: cell.r + 1 }, { c: cell.c, r: cell.r - 1 }].filter(x => this.inside(x)); }
  adjacent(a, b) { return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1; }
  /** A footprint is an array of cells; two footprints are adjacent if any pair of cells shares an edge. */
  footprintsAdjacent(fa, fb) { return fa.some(a => fb.some(b => this.adjacent(a, b))); }
  terrainAt(cell) { return this.terrain.get(this.key(cell)) || null; }
  isObstacle(cell) { const t = this.terrainAt(cell); return !!(t && (t.obstacle || t.chasm)); }
  occupantAt(cell) { return this.occ.get(this.key(cell)) || null; }
  place(occupant, cells) { for (const c of cells) this.occ.set(this.key(c), occupant); }
  remove(cells) { for (const c of cells) this.occ.delete(this.key(c)); }
  /**
   * Shortest path length in cardinal steps from any cell of `from` to any cell of `to` (rulebook p.48: distance is measured
   * along the shortest path through orthogonally adjacent spaces). `passable(cell)` says which intermediate cells may be used;
   * returns Infinity if no path exists ("If there is no viable path to the Target, it is not a viable Target").
   */
  distance(from, to, passable = () => true) {
    const target = new Set(to.map(c => this.key(c)));
    const seen = new Set(from.map(c => this.key(c)));
    let frontier = [...from], d = 0;
    if (frontier.some(c => target.has(this.key(c)))) return 0;
    while (frontier.length) {
      d++; const next = [];
      for (const cell of frontier) for (const n of this.neighbors(cell)) {
        const k = this.key(n); if (seen.has(k)) continue; seen.add(k);
        if (target.has(k)) return d;
        if (passable(n)) next.push(n);
      }
      frontier = next;
    }
    return Infinity;
  }
  /** Shortest path (list of cells, excluding start) from a cell to a goal predicate; BFS; null if unreachable. */
  path(start, isGoal, passable = () => true) {
    const prev = new Map([[this.key(start), null]]); const q = [start];
    while (q.length) {
      const cell = q.shift();
      if (isGoal(cell) && this.key(cell) !== this.key(start)) { const out = []; let k = this.key(cell), c = cell; while (prev.get(k)) { out.unshift(c); c = prev.get(k); k = this.key(c); } return out; }
      for (const n of this.neighbors(cell)) { const k = this.key(n); if (prev.has(k)) continue; if (!passable(n) && !isGoal(n)) continue; prev.set(k, cell); q.push(n); }
    }
    return null;
  }
  /** Zone X: all cells within X horizontally, vertically and diagonally (Chebyshev) from any source cell (p.51). */
  zone(source, x) {
    const out = new Map();
    for (const s of source) for (let dc = -x; dc <= x; dc++) for (let dr = -x; dr <= x; dr++) { const cell = { c: s.c + dc, r: s.r + dr }; if (this.inside(cell) && !source.some(q => q.c === cell.c && q.r === cell.r)) out.set(this.key(cell), cell); }
    return [...out.values()];
  }
  /**
   * Line of Sight (p.49): a straight line from a corner of any attacker cell to a corner of any target cell that does not pass
   * through (or along the edge of) an Obscuring terrain cell. Miniatures never block LoS. Corners touching are fine.
   */
  hasLoS(from, to) {
    const obscuring = [...this.terrain.entries()].filter(([, t]) => t.obscuring).map(([k]) => { const [c, r] = k.split(',').map(Number); return { c, r }; });
    if (!obscuring.length) return true;
    const corners = cell => [[cell.c - 0.5, cell.r - 0.5], [cell.c + 0.5, cell.r - 0.5], [cell.c - 0.5, cell.r + 0.5], [cell.c + 0.5, cell.r + 0.5]];
    const blocked = (p, q) => obscuring.some(o => this._segmentCrossesCell(p, q, o));
    for (const a of from) for (const b of to) for (const p of corners(a)) for (const q of corners(b)) if (!blocked(p, q)) return true;
    return false;
  }
  _segmentCrossesCell(p, q, cell) {
    // open square (x0,x1)×(y0,y1); segment "passes through" if it intersects the open interior, or runs along an edge (p.49).
    const x0 = cell.c - 0.5, x1 = cell.c + 0.5, y0 = cell.r - 0.5, y1 = cell.r + 0.5; const eps = 1e-9;
    const [px, py] = p, [qx, qy] = q;
    // along an edge: collinear with an edge and overlapping it
    const along = (fixed, a0, a1, bothFixedCoord, lo, hi) => Math.abs(bothFixedCoord[0] - fixed) < eps && Math.abs(bothFixedCoord[1] - fixed) < eps && Math.min(a0, a1) < hi - eps && Math.max(a0, a1) > lo + eps;
    if (along(x0, py, qy, [px, qx], y0, y1) || along(x1, py, qy, [px, qx], y0, y1) || along(y0, px, qx, [py, qy], x0, x1) || along(y1, px, qx, [py, qy], x0, x1)) return true;
    // interior: clip segment to the box (Liang–Barsky) and check the clipped length is positive
    let t0 = 0, t1 = 1; const dx = qx - px, dy = qy - py;
    for (const [pp, qq] of [[-dx, px - x0], [dx, x1 - px], [-dy, py - y0], [dy, y1 - py]]) {
      if (Math.abs(pp) < eps) { if (qq < 0) return false; continue; }
      const t = qq / pp; if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t1 - t0 > 1e-6;
  }
}

/** Monster facing helpers. facing ∈ 'N'|'S'|'E'|'W' (N = toward higher rows). */
export const DIRS = { N: { c: 0, r: 1 }, S: { c: 0, r: -1 }, E: { c: 1, r: 0 }, W: { c: -1, r: 0 } };
/** Cells "in front" (p.49): beyond the front edge line of the footprint, in the facing direction. */
export function inFront(board, footprint, facing, cell) {
  const d = DIRS[facing];
  if (d.r) { const edge = d.r > 0 ? Math.max(...footprint.map(x => x.r)) : Math.min(...footprint.map(x => x.r)); return d.r > 0 ? cell.r > edge : cell.r < edge; }
  const edge = d.c > 0 ? Math.max(...footprint.map(x => x.c)) : Math.min(...footprint.map(x => x.c)); return d.c > 0 ? cell.c > edge : cell.c < edge;
}
/** Rear cells (p.49): the cells adjacent to the footprint directly behind it. */
export function rearCells(board, footprint, facing) {
  const d = DIRS[facing]; const back = { c: -d.c, r: -d.r };
  const out = footprint.map(x => ({ c: x.c + back.c, r: x.r + back.r })).filter(x => board.inside(x) && !footprint.some(f => f.c === x.c && f.r === x.r));
  const seen = new Set(); return out.filter(x => { const k = board.key(x); if (seen.has(k)) return false; seen.add(k); return true; });
}
/** Which way to face to look from footprint toward target cell (turn toward target, p.50); ties → prefer current facing. */
export function faceToward(footprint, target, current = 'N') {
  const cc = footprint.reduce((a, x) => a + x.c, 0) / footprint.length, cr = footprint.reduce((a, x) => a + x.r, 0) / footprint.length;
  const dc = target.c - cc, dr = target.r - cr;
  if (Math.abs(dc) === Math.abs(dr)) { if (dc === 0) return current; const opts = [dc > 0 ? 'E' : 'W', dr > 0 ? 'N' : 'S']; return opts.includes(current) ? current : opts[0]; }
  return Math.abs(dc) > Math.abs(dr) ? (dc > 0 ? 'E' : 'W') : (dr > 0 ? 'N' : 'S');
}
