const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../routes/studentRoutes.js');
let s = fs.readFileSync(p, 'utf8');

const ctx = `(typeof student !== 'undefined' && student ? student : (typeof claimed !== 'undefined' && claimed ? claimed : (typeof fresh !== 'undefined' && fresh ? fresh : (typeof populated !== 'undefined' && populated ? populated : {}))))`;

function replaceEmitCall(src, eventName, helperCallBuilder) {
  const needle = `io.emit('${eventName}',`;
  let out = '';
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf(needle, i);
    if (idx === -1) {
      out += src.slice(i);
      break;
    }
    // Keep prefix "if (io) " as-is
    out += src.slice(i, idx);
    let depth = 0;
    let j = idx + needle.length - 1; // at '('
    for (; j < src.length; j++) {
      const ch = src[j];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    const args = src.slice(idx + needle.length, j - 1);
    out += helperCallBuilder(args.trim());
    i = j;
  }
  return out;
}

s = replaceEmitCall(s, 'data:refresh', (args) => `studentDataRefresh(io, ${ctx}, ${args})`);
s = replaceEmitCall(s, 'student:updated', (args) => `studentRealtime(io, ${ctx}, 'student:updated', ${args})`);
s = replaceEmitCall(s, 'revenue:updated', (args) => `studentRealtime(io, ${ctx}, 'revenue:updated', ${args})`);
s = replaceEmitCall(s, 'student:new', (args) => `studentRealtime(io, student, 'student:new', ${args})`);
s = replaceEmitCall(s, 'exam:unlocked', (args) => `studentRealtime(io, student, 'exam:unlocked', ${args})`);
s = replaceEmitCall(s, 'exam:locked', (args) => `studentRealtime(io, student, 'exam:locked', ${args})`);
s = replaceEmitCall(s, 'student:assigned', (args) => `studentRealtime(io, student, 'student:assigned', ${args})`);
s = replaceEmitCall(s, 'student:history_reset', (args) => `studentRealtime(io, student, 'student:history_reset', ${args})`);

fs.writeFileSync(p, s);
console.log('remaining io.emit:', (s.match(/io\.emit\(/g) || []).length);
