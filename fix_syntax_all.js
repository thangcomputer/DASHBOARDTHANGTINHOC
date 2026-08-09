const fs = require('fs');
const path = 'd:\\web\\WEB TỔNG HỢP\\DASHBOARDTHANGTINHOC\\modules\\teacher\\services\\TeacherApplicationService.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// We know there are a few syntax errors where `});` is on a line by itself, and it should be `} };`.
// Let's just iterate over all lines and if we see `    });` and the previous lines indicate it's closing a `_body: {`, we replace it with `    } };`

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('return { _status:') && lines[i].includes('_body: {') && lines[i].includes('});')) {
    lines[i] = lines[i].replace('});', '} };');
  }
}

// But wait, the `replace_file_content` completely DELETED lines 219-230.
// Let me write those lines back first.
// I will just use `git stash` and `git checkout`? Oh wait, it's untracked. I can't.
// Let me just replace the whole file using a backup from earlier if I have it in artifacts? No.

fs.writeFileSync(path, lines.join('\n'), 'utf8');
