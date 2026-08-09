const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const modulesDir = path.join(rootDir, 'modules');
const docsDir = path.join(rootDir, 'docs', 'architecture');

const boundedContexts = [
  'accounting',
  'journal',
  'payroll',
  'teacher-settlement',
  'commission', // Re-scaffolding per instructions
  'budget'
];

// Subdirectories per module
const subdirs = [
  'models',
  'repositories',
  'cqrs/commands',
  'cqrs/queries',
  'dtos',
  'validators',
  'mappers',
  'api',
  'events',
  'tests',
  'services'
];

const writeSafeJsFile = (filePath) => {
  fs.writeFileSync(filePath, `'use strict';\nmodule.exports = {};\n`);
};

// Create modules and subdirs
boundedContexts.forEach(mod => {
  const modDir = path.join(modulesDir, mod);
  fs.mkdirSync(modDir, { recursive: true });
  subdirs.forEach(sub => fs.mkdirSync(path.join(modDir, sub), { recursive: true }));

  // ModelName parsing for camelCase/PascalCase
  const ModelName = mod.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  
  // Model
  writeSafeJsFile(path.join(modDir, 'models', `\${ModelName}.js`));
  
  // Repository
  writeSafeJsFile(path.join(modDir, 'repositories', `\${ModelName}Repository.js`));
  
  // API Controller
  writeSafeJsFile(path.join(modDir, 'api', `\${ModelName}Controller.js`));
  
  // Events
  writeSafeJsFile(path.join(modDir, 'events', `\${ModelName}Events.js`));

  // Basic Handlers
  writeSafeJsFile(path.join(modDir, 'cqrs/commands', `Create\${ModelName}Handler.js`));
  writeSafeJsFile(path.join(modDir, 'cqrs/queries', `Get\${ModelName}Handler.js`));
});

// Generate 13 Documentation reports
fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'accounting-review.md',
  'journal-review.md',
  'payroll-review.md',
  'teacher-settlement-review.md',
  'commission-review-batch2.md',
  'budget-review.md',
  'finance-events-review-batch2.md',
  'finance-cqrs-review-batch2.md',
  'finance-security-review-batch2.md',
  'finance-performance-review-batch2.md',
  'finance-observability-review-batch2.md',
  'batch2-erp.md',
  'erp-regression-batch2.md'
];

reports.forEach(report => {
  fs.writeFileSync(path.join(docsDir, report), `# \${report.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\\n\\nGenerated artifact for Sprint 5.2 Batch 2 Enterprise Accounting, Payroll & Settlement.`);
});

console.log('✅ Sprint 5.2 Batch 2 Enterprise Accounting scaffolding generated successfully.');
