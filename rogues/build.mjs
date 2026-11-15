// Kingdoms Forlorn — Rogue's Path: bundle engine + UI + data into one self-contained HTML file.
// Output: dist/rogues.html (the Pages workflow copies this to site/rogues/index.html).
import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';

const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
// Every data/*.json becomes DATA[<basename>]; every data/<dir>/*.json becomes DATA[<dir>][<basename>].
const loadData = (dir = 'data') => {
  const out = {};
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out[ent.name] = loadData(full);
    else if (ent.name.endsWith('.json')) out[ent.name.replace(/\.json$/, '')] = rd(full);
  }
  return out;
};
const data = loadData();
// Owner-confirmed transcriptions the engine does not implement yet → shown in the in-game monster info viewer.
{ const names = new Set(Object.values(data.monsters || {}).map(m => String(m.name).toLowerCase())); data.rawMonsters = {}; const td = 'docs/transcriptions'; if (fs.existsSync(td)) for (const f of fs.readdirSync(td).filter(f => f.endsWith('_raw.json'))) { const r = rd(path.join(td, f)); if (r.sheet && !names.has(String(r.sheet.name).toLowerCase())) data.rawMonsters[f.replace('_raw.json', '')] = r; } }
data.meta = { ...(data.meta || {}), builtAt: new Date().toISOString() };

const r = await build({ entryPoints: ['src/ui/main.js'], bundle: true, format: 'iife', write: false, minify: false, target: 'es2020' });
const esc = s => s.replace(/<\/script>/g, '<\\/script>');
const js = esc(r.outputFiles[0].text);
const html = fs.readFileSync('src/index.html', 'utf8')
  .replace('__DATA__', () => esc(JSON.stringify(data)))
  .replace('__BUNDLE__', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/rogues.html', html);
console.log('built dist/rogues.html', (html.length / 1024).toFixed(0), 'KB');
