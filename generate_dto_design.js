const fs = require('fs');

const inventory = JSON.parse(fs.readFileSync('dto_inventory_raw.json', 'utf8'));

let md = '# DTO Design Strategy — Phase 2\n\n';
md += 'This document outlines the conceptual DTO hierarchy for each Application Service. **No implementation has been made; this is strictly architectural design.**\n\n';

for (const [serviceName, methods] of Object.entries(inventory)) {
  const domain = serviceName.replace('ApplicationService', '');
  md += `## ${domain} DTOs\n\n`;
  
  let queries = [];
  let commands = [];
  
  for (const [methodName, fields] of Object.entries(methods)) {
    const isQuery = methodName.startsWith('get') || methodName.startsWith('list') || methodName.startsWith('search') || methodName.startsWith('export');
    const isCommand = !isQuery;
    
    const capitalizedMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1);
    
    if (isQuery) {
      queries.push({
         name: `${capitalizedMethod}Query`,
         fields: [...(fields.query || []), ...(fields.params || [])]
      });
    } else {
      commands.push({
         name: `${capitalizedMethod}Command`,
         fields: [...(fields.body || []), ...(fields.params || [])]
      });
    }
  }
  
  if (queries.length) {
    md += '### Query DTOs\n';
    for (const q of queries) {
      md += `- **\`${q.name}\`**: ${q.fields.length ? q.fields.join(', ') : '(No arguments)'}\n`;
    }
    md += '\n';
  }
  
  if (commands.length) {
    md += '### Command DTOs\n';
    for (const c of commands) {
      md += `- **\`${c.name}\`**: ${c.fields.length ? c.fields.join(', ') : '(No payload)'}\n`;
    }
    md += '\n';
  }
  
  md += '### Response DTOs\n';
  md += `- **\`${domain}Response\`**: Standard representation of a single ${domain} entity.\n`;
  md += `- **\`${domain}SummaryResponse\`**: Lightweight representation for lists.\n`;
  md += '\n---\n\n';
}

fs.writeFileSync('docs/architecture/dto-design.md', md);
console.log('docs/architecture/dto-design.md generated.');
