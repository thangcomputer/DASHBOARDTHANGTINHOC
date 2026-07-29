/**
 * Remap primary blue/sky/indigo CTA color classes to brand red.
 * Skips examSubjects.js (semantic subject colors).
 */
const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(p, acc);
    } else if (/\.(jsx|js|css)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const root = path.join(__dirname, '..', 'client', 'src');
const files = walk(root);

const pairs = [
  ['from-sky-600', 'from-red-600'],
  ['to-sky-700', 'to-red-700'],
  ['to-sky-500', 'to-red-500'],
  ['hover:from-sky-700', 'hover:from-red-700'],
  ['bg-sky-600', 'bg-red-600'],
  ['hover:bg-sky-700', 'hover:bg-red-700'],
  ['from-blue-600', 'from-red-600'],
  ['from-blue-700', 'from-red-700'],
  ['from-blue-500', 'from-red-500'],
  ['to-blue-800', 'to-red-800'],
  ['to-blue-700', 'to-red-700'],
  ['to-blue-600', 'to-red-600'],
  ['hover:from-blue-700', 'hover:from-red-700'],
  ['hover:from-blue-500', 'hover:from-red-500'],
  ['hover:bg-blue-700', 'hover:bg-red-700'],
  ['hover:bg-blue-600', 'hover:bg-red-600'],
  ['hover:bg-blue-500', 'hover:bg-red-500'],
  ['bg-blue-600', 'bg-red-600'],
  ['bg-blue-500', 'bg-red-500'],
  ['from-indigo-700', 'from-red-700'],
  ['from-indigo-600', 'from-red-600'],
  ['to-indigo-700', 'to-red-700'],
  ['to-indigo-600', 'to-red-600'],
  ['hover:bg-indigo-700', 'hover:bg-red-700'],
  ['hover:bg-indigo-600', 'hover:bg-red-600'],
  ['bg-indigo-600', 'bg-red-600'],
  ['bg-indigo-500', 'bg-red-500'],
  ['from-violet-600', 'from-red-600'],
  ['to-purple-600', 'to-red-700'],
  ['shadow-blue-200', 'shadow-red-200'],
  ['shadow-blue-100', 'shadow-red-100'],
  ['shadow-blue-900/20', 'shadow-red-900/20'],
  ['shadow-blue-600/30', 'shadow-red-600/30'],
  ['shadow-blue-500/30', 'shadow-red-500/30'],
  ['shadow-blue-500/50', 'shadow-red-500/50'],
  ['shadow-indigo-100', 'shadow-red-100'],
  ['shadow-indigo-200', 'shadow-red-200'],
  ['shadow-indigo-500/50', 'shadow-red-500/50'],
  ['shadow-sky-100', 'shadow-red-100'],
  ['shadow-sky-200', 'shadow-red-200'],
  ['focus-visible:ring-sky-300', 'focus-visible:ring-red-300'],
  ['ring-sky-300', 'ring-red-300'],
];

const skipNames = new Set(['examSubjects.js']);
let changed = 0;

for (const f of files) {
  if (skipNames.has(path.basename(f))) continue;
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  for (const [a, b] of pairs) s = s.split(a).join(b);
  if (s !== orig) {
    fs.writeFileSync(f, s);
    changed += 1;
    console.log(path.relative(path.join(__dirname, '..'), f));
  }
}

console.log('files changed:', changed);
