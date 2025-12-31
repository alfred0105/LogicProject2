import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modulesDir = path.join(__dirname, '../src/modules');

if (!fs.existsSync(modulesDir)) {
    console.error("Modules dir not found");
    process.exit(1);
}

fs.readdirSync(modulesDir).forEach(file => {
    if (!file.endsWith('.js') || file === 'CircuitSimulator.js') return;

    const filePath = path.join(modulesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    const searchPattern = /Object\.assign\(\s*CircuitSimulator\.prototype\s*,\s*\{/g;

    if (content.match(searchPattern)) {
        console.log(`Patching ${file}...`);
        content = content.replace(searchPattern, 'Object.assign(window.CircuitSimulator.prototype, {');
        fs.writeFileSync(filePath, content, 'utf8');
    }
});
