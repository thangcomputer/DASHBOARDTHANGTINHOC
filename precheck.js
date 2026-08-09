const fs = require('fs');

const files = [
  'routes/authRoutes.js',
  'models/Employee.js',
  'routes/branchRoutes.js',
  'controllers/branchController.js',
  'models/Branch.js',
  'routes/tenantRoutes.js',
  'services/tenantService.js',
  'models/Tenant.js',
  'routes/settingsRoutes.js',
  'controllers/settingsController.js',
  'models/SystemSettings.js',
  'services/settingsCache.js'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const code = fs.readFileSync(f, 'utf8');
    const imports = [...code.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
    console.log('FILE:', f);
    console.log('IMPORTS:', imports.join(', '));
  }
});
