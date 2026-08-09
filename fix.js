const fs = require('fs');
const file = 'modules/student/services/StudentApplicationService.js';
let content = fs.readFileSync(file, 'utf8');

// I need to undo the damage. Luckily, the damage is only on a chunk. Wait, the previous replace also did damage.
// I will just download the original file if I can, but I can't.
