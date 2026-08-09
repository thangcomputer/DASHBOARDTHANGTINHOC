const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../routes');
const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));

const legacyAuthUsages = [];

const regexes = {
  guard: /const guard\s*=\s*\[(.*?)\];/g,
  inlineMiddleware: /router\.(get|post|put|delete|patch|use)\s*\(\s*['"`].*?['"`]\s*,\s*(.*?)(?=\)|async|\(req|function)/g,
  manualCheckRole: /req\.currentUser\.role(Code)?\s*===/g,
  manualCheckAdmin: /req\.currentUser\.adminRole\s*===/g,
  manualCheckPerms: /req\.currentUser\.permissions(\.includes)?/g
};

routeFiles.forEach(file => {
  const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
  
  let match;
  while ((match = regexes.guard.exec(content)) !== null) {
    legacyAuthUsages.push({ file, type: 'guard_definition', value: match[0], content: match[1] });
  }

  while ((match = regexes.inlineMiddleware.exec(content)) !== null) {
    const middlewareArgs = match[2];
    if (middlewareArgs.includes('checkPermission') || 
        middlewareArgs.includes('checkAnyPermission') || 
        middlewareArgs.includes('isSuperAdmin') || 
        middlewareArgs.includes('isAdmin') || 
        middlewareArgs.includes('isStaff') || 
        middlewareArgs.includes('authorizeRole') ||
        middlewareArgs.includes('isTeacher') ||
        middlewareArgs.includes('isStudent')
       ) {
      // Don't log if it's just 'guard' since we capture guard definition above, but log inline usages
      legacyAuthUsages.push({ file, type: 'inline_middleware', value: match[0], content: middlewareArgs });
    }
  }

  if (regexes.manualCheckRole.test(content)) {
    legacyAuthUsages.push({ file, type: 'manual_role_check' });
  }
  if (regexes.manualCheckAdmin.test(content)) {
    legacyAuthUsages.push({ file, type: 'manual_admin_check' });
  }
  if (regexes.manualCheckPerms.test(content)) {
    legacyAuthUsages.push({ file, type: 'manual_permissions_check' });
  }
});

const output = JSON.stringify(legacyAuthUsages, null, 2);
fs.writeFileSync(path.join(__dirname, 'legacy_auth_report.json'), output);
console.log('Legacy Auth Report generated.');
