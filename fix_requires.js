const fs = require('fs');
const path = require('path');
const dirs = ['modules/student/commands', 'modules/student/queries'];

dirs.forEach(d => {
  if (fs.existsSync(d)) {
    fs.readdirSync(d).forEach(f => {
      if (f.endsWith('.js')) {
        let p = path.join(d, f);
        let c = fs.readFileSync(p, 'utf8');
        let original = c;
        c = c.replace(/require\('\.\.\/\.\.\/services\/StudentApplicationService'\)/g, "require('../services/StudentApplicationService')");
        if (c !== original) {
          fs.writeFileSync(p, c);
          console.log('Fixed', p);
        }
      }
    });
  }
});
