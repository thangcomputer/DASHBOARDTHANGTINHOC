const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../routes');
const batch1Files = ['studentRoutes.js', 'teacherRoutes.js', 'courseRoutes.js'];

batch1Files.forEach(file => {
  const filePath = path.join(ROUTES_DIR, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update imports
  // Remove checkPermission from authMiddleware import
  content = content.replace(
    /const\s*\{\s*([^}]*)\s*\}\s*=\s*require\('\.\.\/shared\/middleware\/authMiddleware'\);/g,
    (match, imports) => {
      let newImports = imports.split(',').map(i => i.trim())
        .filter(i => i !== 'checkPermission' && i !== 'checkAnyPermission' && i !== 'isAdmin' && i !== 'isSuperAdmin' && i !== 'isTeacher' && i !== 'isStaff');
      
      // We still need branchFilter and maybe userHasPermission (for business logic).
      return `const { ${newImports.join(', ')} } = require('../shared/middleware/authMiddleware');\nconst { authorize, authorizeAny, authorizeAll } = require('../shared/middleware/authorize');\nconst legacyMapping = require('../shared/constants/legacyPermissionMapping');\nconst NEW_PERMISSIONS = require('../shared/constants/permissions');`;
    }
  );

  // If the file imports old PERMISSIONS, we'll keep it for business logic but also have NEW_PERMISSIONS
  
  // 2. Replace checkPermission(PERMISSIONS.XXX) -> authorizeAny(...legacyMapping.resolve(PERMISSIONS.XXX))
  content = content.replace(
    /checkPermission\((PERMISSIONS\.[A-Z_]+)\)/g,
    'authorizeAny(...legacyMapping.resolve($1))'
  );

  // 3. Replace checkAnyPermission(PERMISSIONS.XXX, PERMISSIONS.YYY) -> authorizeAny(...legacyMapping.resolve(PERMISSIONS.XXX), ...legacyMapping.resolve(PERMISSIONS.YYY))
  content = content.replace(
    /checkAnyPermission\(([^)]+)\)/g,
    (match, args) => {
      const parts = args.split(',').map(a => `...legacyMapping.resolve(${a.trim()})`);
      return `authorizeAny(${parts.join(', ')})`;
    }
  );

  // 4. Replace isTeacher as middleware -> authorizeAny(...legacyMapping.resolve('view_teachers'))
  content = content.replace(
    /(?:\[|,\s*)isTeacher(?:\s*,|\s*\])/g,
    match => match.replace('isTeacher', "authorizeAny(...legacyMapping.resolve('view_teachers'))")
  );
  
  // 5. Replace isAdmin -> map to authorizeAny(NEW_PERMISSIONS.USER_MANAGE) for now, or something appropriate
  // We need to be careful with isAdmin. In studentRoutes it's rarely used. In teacherRoutes it's used.
  // Actually, ARB said "Never use PERMISSIONS.ALL except for SUPER_ADMIN."
  content = content.replace(
    /(?:\[|,\s*)isAdmin(?:\s*,|\s*\])/g,
    match => match.replace('isAdmin', "authorizeAny(NEW_PERMISSIONS.USER_MANAGE, NEW_PERMISSIONS.STUDENT_CREATE, NEW_PERMISSIONS.TEACHER_UPDATE)")
  );

  // 6. Replace superAdminOnlyTeacher -> authorize(NEW_PERMISSIONS.TEACHER_UPDATE)
  content = content.replace(
    /(?:\[|,\s*)superAdminOnlyTeacher(?:\s*,|\s*\])/g,
    match => match.replace('superAdminOnlyTeacher', 'authorizeAll(NEW_PERMISSIONS.TEACHER_UPDATE)')
  );

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${file}`);
});
