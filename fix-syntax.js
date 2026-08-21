const fs = require('fs');
const file = 'modules/enrollment/services/EnrollmentApplicationService.js';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/_body: \(\{([\s\S]*?)\}\);/g, '_body: {$1} };');
fs.writeFileSync(file, code);
console.log('Fixed syntax errors');
