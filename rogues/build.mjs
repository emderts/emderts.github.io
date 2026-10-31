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
