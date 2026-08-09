const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../routes');

// 1. blogRoutes.js
{
  const filePath = path.join(ROUTES_DIR, 'blogRoutes.js');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update imports
    content = content.replace(
      /const\s*\{\s*authMiddleware,\s*checkPermission,\s*userHasPermission\s*\}\s*=\s*require\('\.\.\/shared\/middleware\/authMiddleware'\);/g,
      "const { authMiddleware, userHasPermission } = require('../shared/middleware/authMiddleware');\nconst { authorize } = require('../shared/middleware/authorize');\nconst NEW_PERMISSIONS = require('../shared/constants/permissions');"
    );

    // Replace checkPermission(PERMISSIONS.MANAGE_BLOG)
    content = content.replace(
      /checkPermission\((PERMISSIONS\.[A-Z_]+)\)/g,
      "authorize(NEW_PERMISSIONS.CMS_PUBLISH)"
    );

    fs.writeFileSync(filePath, content);
    console.log('Processed blogRoutes.js');
  }
}

// 2. builderRoutes.js
{
  const filePath = path.join(ROUTES_DIR, 'builderRoutes.js');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update imports
    content = content.replace(
      /const\s*\{\s*authMiddleware,\s*isAdmin\s*\}\s*=\s*require\('\.\.\/shared\/middleware\/authMiddleware'\);/g,
      "const { authMiddleware } = require('../shared/middleware/authMiddleware');\nconst { authorize } = require('../shared/middleware/authorize');\nconst NEW_PERMISSIONS = require('../shared/constants/permissions');"
    );

    // Replace isAdmin in guard
    content = content.replace(
      /const adminGuard = \[authMiddleware, isAdmin\];/g,
      "const adminGuard = [authMiddleware, authorize(NEW_PERMISSIONS.CMS_PUBLISH)];"
    );

    fs.writeFileSync(filePath, content);
    console.log('Processed builderRoutes.js');
  }
}

// 3. notificationRoutes.js
{
  const filePath = path.join(ROUTES_DIR, 'notificationRoutes.js');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update imports
    content = content.replace(
      /const\s*\{\s*authMiddleware,\s*isAdmin\s*\}\s*=\s*require\('\.\.\/shared\/middleware\/authMiddleware'\);/g,
      "const { authMiddleware } = require('../shared/middleware/authMiddleware');\nconst { authorize } = require('../shared/middleware/authorize');\nconst NEW_PERMISSIONS = require('../shared/constants/permissions');"
    );

    // Replace isAdmin in router.post
    content = content.replace(
      /router\.post\('\/', authMiddleware, isAdmin,/g,
      "router.post('/', authMiddleware, authorize(NEW_PERMISSIONS.NOTIFICATION_BROADCAST),"
    );

    fs.writeFileSync(filePath, content);
    console.log('Processed notificationRoutes.js');
  }
}

// 4. fileRoutes.js
{
  const filePath = path.join(ROUTES_DIR, 'fileRoutes.js');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update imports
    content = content.replace(
      /const\s*\{\s*authMiddleware,\s*checkPermission,\s*checkAnyPermission\s*\}\s*=\s*require\('\.\.\/shared\/middleware\/authMiddleware'\);/g,
      "const { authMiddleware } = require('../shared/middleware/authMiddleware');\nconst { authorize, authorizeAny } = require('../shared/middleware/authorize');\nconst legacyMapping = require('../shared/constants/legacyPermissionMapping');\nconst NEW_PERMISSIONS = require('../shared/constants/permissions');"
    );

    // This file uses checkPermission dynamically:
    // return checkPermission(PERMISSIONS.SYSTEM_SETTINGS)(req, res, next);
    // return checkAnyPermission(PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_FINANCE)(req, res, next);
    
    content = content.replace(
      /checkAnyPermission\(([^)]+)\)\(req, res, next\)/g,
      (match, args) => {
        const parts = args.split(',').map(a => `...legacyMapping.resolve(${a.trim()})`);
        return `authorizeAny(${parts.join(', ')})(req, res, next)`;
      }
    );

    content = content.replace(
      /checkPermission\((PERMISSIONS\.[A-Z_]+)\)\(req, res, next\)/g,
      "authorizeAny(...legacyMapping.resolve($1))(req, res, next)"
    );

    content = content.replace(
      /checkPermission\((PERMISSIONS\.[A-Z_]+)\)/g,
      "authorizeAny(...legacyMapping.resolve($1))"
    );

    fs.writeFileSync(filePath, content);
    console.log('Processed fileRoutes.js');
  }
}
