const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../routes');
const batch2Files = ['financeRoutes.js', 'invoiceRoutes.js', 'analyticsRoutes.js', 'transactionRoutes.js'];

batch2Files.forEach(file => {
  const filePath = path.join(ROUTES_DIR, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update imports
  content = content.replace(
    /const\s*\{\s*([^}]*)\s*\}\s*=\s*require\('\.\.\/shared\/middleware\/authMiddleware'\);/g,
    (match, imports) => {
      let newImports = imports.split(',').map(i => i.trim())
        .filter(i => i !== 'checkPermission' && i !== 'checkAnyPermission' && i !== 'isAdmin' && i !== 'isSuperAdmin' && i !== 'isTeacher' && i !== 'isStaff');
      
      return `const { ${newImports.join(', ')} } = require('../shared/middleware/authMiddleware');\nconst { authorize, authorizeAny, authorizeAll } = require('../shared/middleware/authorize');\nconst legacyMapping = require('../shared/constants/legacyPermissionMapping');\nconst NEW_PERMISSIONS = require('../shared/constants/permissions');`;
    }
  );

  // 2. Replace checkPermission(PERMISSIONS.MANAGE_FINANCE) -> authorizeAny(...legacyMapping.resolve('MANAGE_FINANCE'))
  content = content.replace(
    /checkPermission\((PERMISSIONS\.[A-Z_]+)\)/g,
    'authorizeAny(...legacyMapping.resolve($1))'
  );

  // 3. Replace checkAnyPermission(PERMISSIONS.XXX, PERMISSIONS.YYY)
  content = content.replace(
    /checkAnyPermission\(([^)]+)\)/g,
    (match, args) => {
      const parts = args.split(',').map(a => `...legacyMapping.resolve(${a.trim()})`);
      return `authorizeAny(${parts.join(', ')})`;
    }
  );

  // 4. Replace isTeacher
  content = content.replace(
    /(?:\[|,\s*)isTeacher(?:\s*,|\s*\])/g,
    match => match.replace('isTeacher', "authorizeAny(...legacyMapping.resolve('view_teachers'))")
  );

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${file}`);
});
