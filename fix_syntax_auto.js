const fs = require('fs');
const { execSync } = require('child_process');

const path = 'd:\\web\\WEB TỔNG HỢP\\DASHBOARDTHANGTINHOC\\modules\\teacher\\services\\TeacherApplicationService.js';

let maxAttempts = 100;
let attempts = 0;

while (attempts < maxAttempts) {
  attempts++;
  try {
    execSync(`node -c "${path}"`, { stdio: 'pipe' });
    console.log('Compiled successfully!');
    break;
  } catch (err) {
    const output = err.stderr.toString();
    const match = output.match(/TeacherApplicationService\.js:(\d+)/);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      let content = fs.readFileSync(path, 'utf8').split('\n');
      
      // Let's look at the error line.
      let line = content[lineNum - 1];
      
      console.log(`Fixing error at line ${lineNum}: ${line.trim()}`);
      
      if (line.includes('});')) {
        content[lineNum - 1] = line.replace('});', '} };');
      } else if (line.includes('}')) {
        // sometimes it's just `}` if it's unexpected token }
        if (content[lineNum - 2] && content[lineNum - 2].includes('});')) {
            content[lineNum - 2] = content[lineNum - 2].replace('});', '} };');
        } else {
            // Can't auto fix
            console.log('Cannot auto fix:', line);
            break;
        }
      } else if (output.includes('teacherRepository')) {
         // This is line 229 from our previous run, missing async get_root(data) { try { ... } }
         console.log('Found teacherRepository error, manual fix needed');
         break;
      } else {
         console.log('Unknown error:', output);
         break;
      }
      
      fs.writeFileSync(path, content.join('\n'), 'utf8');
    } else {
      console.log('Could not find line number in output:', output);
      break;
    }
  }
}
