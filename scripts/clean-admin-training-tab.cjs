const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'client', 'src', 'components', 'admin', 'tabs', 'AdminTrainingTab.jsx');
let s = fs.readFileSync(p, 'utf8');

const listStart = s.indexOf('(trainingData?.[trainingTab] || []).slice(0, trainingTab === \'videos\'');
if (listStart < 0) {
  console.error('list start not found');
  process.exit(1);
}

const divStart = s.lastIndexOf('<div className="divide-y divide-gray-50">', listStart);
if (divStart < 0) {
  console.error('div start not found');
  process.exit(1);
}

const before = s.slice(0, divStart + '<div className="divide-y divide-gray-50">'.length);
const after = s.slice(listStart);
s = `${before}\n                    ${after}`;

// Remove leftover ternary closers if any
s = s.replace(/\s*\)\s*:\s*\(\s*\n\s*\(trainingData/, '\n                    (trainingData');
s = s.replace(/\s*\}\)\(\)\s*\n\s*\)\s*:\s*\(\s*\n\s*\(trainingData/, '\n                    (trainingData');

fs.writeFileSync(p, s, 'utf8');
console.log('cleaned AdminTrainingTab orphan questions UI');
