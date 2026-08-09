const fs = require('fs');
const path = require('path');

const clientSrcPath = path.join(__dirname, '../client/src');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modifiedCount = 0;

walkDir(clientSrcPath, (filePath) => {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  const replacePatterns = [
    // Admin
    { regex: /(\w+)\?\.role\s*===\s*'admin'/g, repl: "['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF'].includes($1?.roleCode)" },
    { regex: /(\w+)\.role\s*===\s*'admin'/g, repl: "['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF'].includes($1.roleCode)" },
    { regex: /([^.\w])role\s*===\s*'admin'/g, repl: "$1['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF'].includes(roleCode)" },

    // Teacher
    { regex: /(\w+)\?\.role\s*===\s*'teacher'/g, repl: "$1?.roleCode === 'TEACHER'" },
    { regex: /(\w+)\.role\s*===\s*'teacher'/g, repl: "$1.roleCode === 'TEACHER'" },
    { regex: /([^.\w])role\s*===\s*'teacher'/g, repl: "$1roleCode === 'TEACHER'" },

    // Student
    { regex: /(\w+)\?\.role\s*===\s*'student'/g, repl: "$1?.roleCode === 'STUDENT'" },
    { regex: /(\w+)\.role\s*===\s*'student'/g, repl: "$1.roleCode === 'STUDENT'" },
    { regex: /([^.\w])role\s*===\s*'student'/g, repl: "$1roleCode === 'STUDENT'" },

    // Staff
    { regex: /(\w+)\?\.role\s*===\s*'staff'/g, repl: "$1?.roleCode === 'ADMIN_STAFF'" },
    { regex: /(\w+)\.role\s*===\s*'staff'/g, repl: "$1.roleCode === 'ADMIN_STAFF'" },
    { regex: /([^.\w])role\s*===\s*'staff'/g, repl: "$1roleCode === 'ADMIN_STAFF'" },

    // adminRole
    { regex: /(\w+)\?\.adminRole\s*===\s*'SUPER_ADMIN'/g, repl: "$1?.roleCode === 'SUPER_ADMIN'" },
    { regex: /(\w+)\.adminRole\s*===\s*'SUPER_ADMIN'/g, repl: "$1.roleCode === 'SUPER_ADMIN'" },
    { regex: /(\w+)\?\.adminRole\s*===\s*'HIGH_ADMIN'/g, repl: "$1?.roleCode === 'HIGH_ADMIN'" },
    { regex: /(\w+)\.adminRole\s*===\s*'HIGH_ADMIN'/g, repl: "$1.roleCode === 'HIGH_ADMIN'" },
    { regex: /(\w+)\?\.adminRole\s*===\s*'SUPPORT'/g, repl: "$1?.roleCode === 'SUPPORT_AGENT'" },
    { regex: /(\w+)\.adminRole\s*===\s*'SUPPORT'/g, repl: "$1.roleCode === 'SUPPORT_AGENT'" },
    { regex: /(\w+)\?\.adminRole\s*===\s*'STAFF'/g, repl: "$1?.roleCode === 'ADMIN_STAFF'" },
    { regex: /(\w+)\.adminRole\s*===\s*'STAFF'/g, repl: "$1.roleCode === 'ADMIN_STAFF'" }
  ];

  replacePatterns.forEach(({ regex, repl }) => {
    content = content.replace(regex, repl);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    modifiedCount++;
  }
});

console.log(`Frontend Refactor Script complete. Modified ${modifiedCount} files.`);
