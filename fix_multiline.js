const fs = require('fs');
const path = 'd:\\web\\WEB TỔNG HỢP\\DASHBOARDTHANGTINHOC\\modules\\teacher\\services\\TeacherApplicationService.js';
let content = fs.readFileSync(path, 'utf8');

// Fix: _body: ({  ...  }); -> _body: { ... } };
content = content.replace(/_body:\s*\(\{(.*?)\}\);/gs, '_body: {$1} };');

// Fix multiline issues where `_body: ({` starts and ends with `});` before `catch`
// Basically any `_body: ({` that spans multiple lines and ends with `});`
content = content.replace(/_body:\s*\(\{([\s\S]*?)\}\);/g, '_body: {$1} };');

// Let's just blindly remove the parentheses around the body object
// Find `_body: ({` and replace with `_body: {`
content = content.replace(/_body:\s*\(\{/g, '_body: {');
// Now we need to find `});` that was closing it.
// We can just find `});` right before `} catch` and replace with `} };`
content = content.replace(/\}\);\s*\}\s*catch/g, '} };\n  } catch');
// And right before `  async ` 
content = content.replace(/\}\);\s*async/g, '} };\n\n  async');
// And at the end of functions
content = content.replace(/\}\);\s*module\.exports/g, '} };\n\nmodule.exports');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed multiline syntax errors in TeacherApplicationService.js');
