// Verifies every language has exactly the same translation keys as English
// (the source language), and that {{placeholders}} match. Run: npm run i18n:check
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../src/i18n/locales/', import.meta.url).pathname;
const languages = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
const source = 'en';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
  );
const placeholders = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

let problems = 0;
const namespaces = fs.readdirSync(path.join(root, source));
for (const ns of namespaces) {
  const base = new Map(flatten(JSON.parse(fs.readFileSync(path.join(root, source, ns), 'utf8'))));
  for (const lang of languages.filter((l) => l !== source)) {
    const file = path.join(root, lang, ns);
    if (!fs.existsSync(file)) {
      console.error(`✗ ${lang}/${ns} is missing`);
      problems++;
      continue;
    }
    const other = new Map(flatten(JSON.parse(fs.readFileSync(file, 'utf8'))));
    for (const [key, value] of base) {
      if (!other.has(key)) { console.error(`✗ ${lang}/${ns}: missing "${key}"`); problems++; }
      else if (placeholders(value) !== placeholders(other.get(key))) { console.error(`✗ ${lang}/${ns}: placeholder mismatch in "${key}"`); problems++; }
    }
    for (const key of other.keys()) if (!base.has(key)) { console.error(`✗ ${lang}/${ns}: extra key "${key}"`); problems++; }
  }
}
console.log(problems ? `\n${problems} problem(s)` : `✓ ${languages.length} languages × ${namespaces.length} namespaces in sync`);
process.exit(problems ? 1 : 0);
