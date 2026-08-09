const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const modulesDir = path.join(rootDir, 'modules');
const docsDir = path.join(rootDir, 'docs', 'architecture');

const boundedContexts = [
  'campaign',
  'customer-segment',
  'customer-journey',
  'communication',
  'notification',
  'marketing-source',
  'marketing-channel'
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
  'campaign-review.md',
  'segment-review.md',
  'journey-review.md',
  'communication-review.md',
  'notification-review.md',
  'marketing-source-review.md',
  'marketing-channel-review.md',
  'crm-events-review-batch3.md',
  'crm-security-review-batch3.md',
  'crm-performance-review-batch3.md',
  'crm-observability-review-batch3.md',
  'batch3-crm.md',
  'crm-regression-batch3.md'
];

reports.forEach(report => {
  fs.writeFileSync(path.join(docsDir, report), `# \${report.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\\n\\nGenerated artifact for Sprint 5.1 Batch 3 CRM Marketing & Communication.`);
});

console.log('✅ Sprint 5.1 Batch 3 CRM Marketing scaffolding generated successfully.');
