// Rosegraal map (p.78–79): structure checks + reachability report.
import fs from 'fs';
const rd = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const M = rd('../data/rosegraal/map.json');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const ids = new Set(M.nodes.map(n => n.id));
ok(M.nodes.length === 103 && ids.size === 103, `103 unique nodes (51 Sunken + 51 Principality + S): ${M.nodes.length}`);
ok(M.nodes.filter(n => n.kingdom === 'sunken').length === 51 && M.nodes.filter(n => n.kingdom === 'principality').length === 52, 'kingdom split 51 / 51+S');
const S = M.nodes.find(n => n.id === 'S'); ok(S && S.start && M.start === 'S', 'start node S');
ok(M.nodes.filter(n => n.id !== 'S').every(n => n.level >= 1 && n.level <= 5 && n.res === n.level), 'every node: level 1–5 and resurrections == level');
ok(M.nodes.filter(n => n.id !== 'S').every(n => Object.keys(M.rewardCodes).includes(n.reward)), 'every node has a legal reward code');
ok(M.nodes.filter(n => n.reward === 'S').length === 5, 'five Sigh of the Graal nodes');
ok(M.edges.every(e => ids.has(e.a) && ids.has(e.b) && e.a !== e.b), 'all edges reference existing distinct nodes');
const seen = new Set(); ok(M.edges.every(e => { const k = [e.a, e.b].sort().join('-'); if (seen.has(k)) return false; seen.add(k); return true; }), 'no duplicate edges');
// reachability (informational until edges are confirmed against the physical sheet)
const adj = {}; for (const n of M.nodes) adj[n.id] = []; for (const e of M.edges) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
const reach = new Set(['S']); const q = ['S']; while (q.length) { const u = q.shift(); for (const v of adj[u]) if (!reach.has(v)) { reach.add(v); q.push(v); } }
const unreached = M.nodes.map(n => n.id).filter(id => !reach.has(id));
console.log(`INFO reachable from S: ${reach.size}/103; unreached: ${unreached.join(', ') || 'none'}; edges ${M.edges.length} (confirmed: ${M.edges.filter(e => e.confidence === 'confirmed').length})`);
ok(unreached.length === 0, 'every node reachable from S');
ok(M.edges.every(e => e.confidence === 'confirmed'), 'all edges confirmed by the owner');
ok(adj.S.length === 6 && adj.S.filter(x => x[0] === 'K').length === 3, 'S has 3 Sunken + 3 Principality neighbours');
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
