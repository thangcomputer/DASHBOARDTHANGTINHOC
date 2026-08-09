const fs = require('fs');
const path = 'd:\\web\\WEB TỔNG HỢP\\DASHBOARDTHANGTINHOC\\modules\\teacher\\services\\TeacherApplicationService.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\}\s*\};\s*\}\s*catch/g, '});\n    } catch');
content = content.replace(/\}\s*\};\s*async/g, '});\n\n  async');
content = content.replace(/\}\s*\};\s*module\.exports/g, '});\n\nmodule.exports');

// But wait, the REAL ones that need `} };` are the ones returning `_body`.
// Let's first fix all `} };` back to `});` where they shouldn't be.
// Wait, the easiest is to just revert to the original `TeacherApplicationService.js`?
// I don't have the original!
// Let's just fix them. The only things that SHOULD be `} };` are those that start with `return { _status: \d+, _body: {`
content = content.replace(/_body:\s*\{\s*([\s\S]*?)\s*\}\s*\};\s*\}\s*catch/g, '_body: { $1 } };\n    } catch');

// Wait, the easiest way to fix line 81: `await assertUniqueContact({ phone, zalo: phone, email } };` -> `});`
content = content.replace(/await assertUniqueContact\(\{\s*phone,\s*zalo:\s*phone,\s*email\s*\}\s*\};\s*\}\s*catch/g, 'await assertUniqueContact({ phone, zalo: phone, email });\n    } catch');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed line 81');
