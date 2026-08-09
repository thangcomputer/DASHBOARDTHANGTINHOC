const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'modules');
const modules = fs.readdirSync(modulesDir).filter(m => fs.statSync(path.join(modulesDir, m)).isDirectory());

let inventory = '# Service Inventory\n\n## Overview\nAnalysis of business logic currently embedded in Express Route/Controller handlers.\n\n';
let useCases = '# Use Case Catalog\n\n## Overview\nCandidate Application Services (Use Cases) identified per domain.\n\n';
let dtoReadiness = '# DTO Readiness\n\n## Overview\nAnalysis of payloads and validation duplication.\n\n';

modules.forEach(mod => {
  const routesDir = path.join(modulesDir, mod, 'routes');
  if (!fs.existsSync(routesDir)) return;

  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
  if (files.length === 0) return;

  inventory += `### Domain: ${mod}\n`;
  useCases += `### Domain: ${mod}\n`;
  dtoReadiness += `### Domain: ${mod}\n`;

  files.forEach(file => {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const lineCount = lines.length;

    let classification = 'LOW';
    if (lineCount > 1000) classification = 'CRITICAL';
    else if (lineCount > 500) classification = 'HIGH';
    else if (lineCount > 200) classification = 'MEDIUM';

    inventory += `- **${file}** (${lineCount} lines) - **${classification} Complexity**\n`;
    
    // Naive extraction of "router.post", "router.put", etc as Use Cases
    const endpoints = content.match(/router\.(post|put|patch|delete)\(['"](.*?)['"]/g) || [];
    endpoints.forEach(ep => {
      const parts = ep.replace('router.', '').split('(');
      const method = parts[0];
      const route = parts[1].replace(/['"]/g, '');
      const actionName = `${method.toUpperCase()} ${route}`;
      useCases += `- ${actionName}\n`;
      dtoReadiness += `- Request DTO candidate: \`req.body\` payload for ${actionName}\n`;
    });
  });
  
  inventory += '\n';
  useCases += '\n';
  dtoReadiness += '\n';
});

const docsDir = path.join(__dirname, 'docs', 'architecture');
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

fs.writeFileSync(path.join(docsDir, 'service-inventory.md'), inventory);
fs.writeFileSync(path.join(docsDir, 'usecase-catalog.md'), useCases);
fs.writeFileSync(path.join(docsDir, 'dto-readiness.md'), dtoReadiness);

console.log('Analyzed and generated inventory, use cases, and DTO readiness.');
