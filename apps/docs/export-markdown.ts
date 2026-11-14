// Writes the Markdown documentation shipped with @navette-js/cli (`npx navette docs`): the .md pages, llms.txt and
// pages.json, with links relative to that directory. Usage: node export-markdown.ts <directory> [--version=x]
import path from 'node:path';
import { writeAgentFiles } from './agents.ts';
import { collect } from './build.ts';

const dir = process.argv[2];
if (!dir || dir.startsWith('--')) { console.error('Usage: node export-markdown.ts <directory> [--version=x]'); process.exit(2); }
const version = process.argv.find((arg) => arg.startsWith('--version='))?.slice('--version='.length) ?? '0.0.0';
const { pages, home } = collect();
// No llms-full.txt: it would double the size of the package, which has every page already.
writeAgentFiles(path.resolve(dir), pages, { prefix: '', version, home, full: false });
console.log(`Navette docs (Markdown): ${pages.length} pages written to ${dir}`);
