const fs = require('fs');
const path = 'd:\\web\\WEB TỔNG HỢP\\DASHBOARDTHANGTINHOC\\modules\\teacher\\services\\TeacherApplicationService.js';
let content = fs.readFileSync(path, 'utf8');

// The naive refactor turned: return res.status(400).json({ success: false });
// into: return { _status: 400, _body: ({ success: false });
// We need to fix this regex disaster.
content = content.replace(/_body: \(\{(.*?)\}\);/g, '_body: {$1} };');

// Also check for `_body: ({ ... })`
content = content.replace(/_body: \(\{(.*?)\}\)/g, '_body: {$1}');

// Wait, the error is: `return { _status: 400, _body: ({ success: false, message: '...' });`
// So we need to match `return { _status: (\d+), _body: \(\{(.*?)\}\);`
// And replace with `return { _status: $1, _body: {$2} };`
content = content.replace(/return \{ _status: (\d+), _body: \(\{(.*?)\}\);/g, 'return { _status: $1, _body: {$2} };');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed syntax errors in TeacherApplicationService.js');
