const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const modulesDir = path.join(rootDir, 'modules');
const docsDir = path.join(rootDir, 'docs', 'architecture');

const boundedContexts = [
  'invoice',
  'payment',
  'refund',
  'wallet',
  'ledger'
];

// Subdirectories per module
const subdirs = [
  'models',
  'repositories',
  'cqrs/commands',
  'cqrs/queries',
  'cqrs/handlers',
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

// Generate 12 Documentation reports
fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'invoice-review.md',
  'payment-review.md',
  'refund-review.md',
  'wallet-review.md',
  'ledger-review.md',
  'finance-events-review.md',
  'finance-cqrs-review.md',
  'finance-security-review.md',
  'finance-performance-review.md',
  'finance-observability-review.md',
  'batch1-erp.md',
  'erp-regression-batch1.md'
];

reports.forEach(report => {
  fs.writeFileSync(path.join(docsDir, report), `# \${report.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\\n\\nGenerated artifact for Sprint 5.2 Batch 1 Enterprise Finance Foundation.`);
});

console.log('✅ Sprint 5.2 Batch 1 Enterprise Finance scaffolding generated successfully.');
