const fs = require('fs');

const inventory = JSON.parse(fs.readFileSync('dto_inventory_raw.json', 'utf8'));

let md = '# DTO Inventory — Phase 1 Analysis\n\n';
md += 'This document maps all identified `req.body`, `req.query`, `req.params`, and `req.file` dependencies accessed within the Application Service Layer.\n\n';

for (const [serviceName, methods] of Object.entries(inventory)) {
  md += `## ${serviceName}\n`;
  for (const [methodName, fields] of Object.entries(methods)) {
    md += `### ${methodName}\n`;
    if (fields.params && fields.params.length) md += `- **Params**: ${fields.params.join(', ')}\n`;
    if (fields.query && fields.query.length) md += `- **Query**: ${fields.query.join(', ')}\n`;
    if (fields.body && fields.body.length) md += `- **Body**: ${fields.body.join(', ')}\n`;
    if (fields.file) md += `- **File**: Single File Upload\n`;
    if (fields.files) md += `- **Files**: Multiple File Uploads\n`;
    md += '\n';
  }
}

fs.writeFileSync('docs/architecture/dto-inventory.md', md);
console.log('docs/architecture/dto-inventory.md generated.');
