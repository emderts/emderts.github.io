import fs from 'fs';
import { build } from 'esbuild';
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const data = { primordials: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt', 'meduketos', 'titanx', 'dragonofphobos', 'urfleece'].map(i => [i, rd('data/primordials/' + i + '.json')])), scenarios: Object.fromEntries(['hekaton', 'labyrinthauros', 'temenos', 'pursuer', 'cyclonus', 'chimera', 'nietzschean', 'burden', 'hypertime', 'harpy', 'sun', 'midascore', 'demidjinn', 'dahaka', 'babel', 'oldhaunt', 'meduketos', 'titanx', 'dragonofphobos', 'urfleece'].map(i => [i, rd('data/scenarios/' + i + '.json')])), titans: rd('data/titans.json'), gear: rd('data/gear.json'), decks: rd('data/decks.json'), argonauts: rd('data/argonauts.json'), labyrinth: rd('data/labyrinth.json'), tree: rd('data/tree.json') };
const r = await build({ entryPoints: ['src/ui/main.js'], bundle: true, format: 'iife', write: false, minify: false, target: 'es2020', define: { __PRIMVIEW__: JSON.stringify(fs.readFileSync('src/ui/primview.html', 'utf8')) } });
const js = r.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
let html = fs.readFileSync('src/index.html', 'utf8').replace('__DATA__', () => JSON.stringify(data).replace(/<\/script>/g, '<\\/script>')).replace('__BUNDLE__', () => js);
fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/mnestis.html', html);
console.log('built dist/mnestis.html', (html.length / 1024).toFixed(0), 'KB');
