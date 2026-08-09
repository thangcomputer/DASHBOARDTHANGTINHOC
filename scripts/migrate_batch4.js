const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../routes');

const replaceInFile = (filename, replacements) => {
  const filePath = path.join(ROUTES_DIR, filename);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Common imports replacement
  content = content.replace(
    /const\s*\{\s*([^}]*)\s*\}\s*=\s*require\('\.\.\/shared\/middleware\/authMiddleware'\);/g,
    (match, imports) => {
      let newImports = imports.split(',').map(i => i.trim())
        .filter(i => i !== 'checkPermission' && i !== 'checkAnyPermission' && i !== 'isAdmin' && i !== 'isSuperAdmin' && i !== 'isTeacher' && i !== 'isStaff');
      
      // Keep authMiddleware and branchFilter if they exist
      const toKeep = newImports.length ? `const { ${newImports.join(', ')} } = require('../shared/middleware/authMiddleware');\n` : '';
      return `${toKeep}const { authorize, authorizeAny, authorizeAll } = require('../shared/middleware/authorize');\nconst legacyMapping = require('../shared/constants/legacyPermissionMapping');\nconst NEW_PERMISSIONS = require('../shared/constants/permissions');`;
    }
  );

  // 2. Specific replacements
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${filename}`);
};

// aiRoutes.js
replaceInFile('aiRoutes.js', [
  { from: /isAdmin/g, to: "authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)" }
]);

// backupRoutes.js
replaceInFile('backupRoutes.js', [
  { from: /isSuperAdmin/g, to: "authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)" }
]);

// biRoutes.js
replaceInFile('biRoutes.js', [
  { from: /checkAnyPermission\(PERMISSIONS\.MANAGE_FINANCE,\s*PERMISSIONS\.VIEW_BRANCH_REVENUE\)/g, to: "authorize(NEW_PERMISSIONS.FINANCE_VIEW)" }
]);

// branchRoutes.js
replaceInFile('branchRoutes.js', [
  { from: /checkPermission\(PERMISSIONS\.SYSTEM_SETTINGS\)/g, to: "authorize(NEW_PERMISSIONS.BRANCH_MANAGE)" }
]);

// courseRoutes.js
replaceInFile('courseRoutes.js', [
  { from: /checkPermission\('system_settings'\)/g, to: "authorize(NEW_PERMISSIONS.COURSE_UPDATE)" }
]);

// employeeRoutes.js
replaceInFile('employeeRoutes.js', [
  { from: /isAdmin/g, to: "authorize(NEW_PERMISSIONS.USER_MANAGE)" }
]);

// staffRoutes.js
replaceInFile('staffRoutes.js', [
  { from: /checkPermission\('manage_staff'\)/g, to: "authorize(NEW_PERMISSIONS.USER_MANAGE)" }
]);

// tenantRoutes.js
replaceInFile('tenantRoutes.js', [
  { from: /isSuperAdmin/g, to: "authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)" }
]);

// systemLogRoutes.js
replaceInFile('systemLogRoutes.js', [
  { from: /isAdmin/g, to: "authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)" }
]);

// monitoringRoutes.js
replaceInFile('monitoringRoutes.js', [
  { from: /isAdmin/g, to: "authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)" }
]);

// proctorRoutes.js
replaceInFile('proctorRoutes.js', [
  { from: /isAdmin/g, to: "authorize(NEW_PERMISSIONS.EXAM_MANAGE)" }
]);

// teachingGuideRoutes.js
replaceInFile('teachingGuideRoutes.js', [
  { from: /isAdmin/g, to: "authorize(NEW_PERMISSIONS.COURSE_UPDATE)" }
]);

// workflowRoutes.js
replaceInFile('workflowRoutes.js', [
  { from: /isAdmin/g, to: "authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)" }
]);

// settingsRoutes.js
replaceInFile('settingsRoutes.js', [
  { from: /checkPermission\(PERMISSIONS\.SYSTEM_SETTINGS\)/g, to: "authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)" },
  { from: /checkPermission\(PERMISSIONS\.MANAGE_TRAINING\)/g, to: "authorizeAny(NEW_PERMISSIONS.COURSE_UPDATE, NEW_PERMISSIONS.EXAM_MANAGE)" },
  { from: /checkPermission\(PERMISSIONS\.MANAGE_STUDENT_TRAINING\)/g, to: "authorize(NEW_PERMISSIONS.COURSE_UPDATE)" },
  { from: /checkAnyPermission\(PERMISSIONS\.MANAGE_TRAINING,\s*PERMISSIONS\.MANAGE_STUDENT_TRAINING\)/g, to: "authorizeAny(NEW_PERMISSIONS.COURSE_UPDATE, NEW_PERMISSIONS.EXAM_MANAGE)" }
]);
