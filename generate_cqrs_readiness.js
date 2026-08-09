const fs = require('fs');

const inventory = JSON.parse(fs.readFileSync('dto_inventory_raw.json', 'utf8'));

let md = '# CQRS Readiness Analysis — Phase 4\n\n';
md += 'This report identifies which Application Services naturally split into Command (state mutating) and Query (data fetching) operations. This forms the foundation for a formal CQRS implementation in future sprints.\n\n';

for (const [serviceName, methods] of Object.entries(inventory)) {
  const domain = serviceName.replace('ApplicationService', '');
  
  let queries = [];
  let commands = [];
  
  for (const methodName of Object.keys(methods)) {
    const isQuery = methodName.startsWith('get') || methodName.startsWith('list') || methodName.startsWith('search') || methodName.startsWith('export');
    if (isQuery) {
      queries.push(methodName);
    } else {
      commands.push(methodName);
    }
  }
  
  if (queries.length > 0 && commands.length > 0) {
    md += `## ${domain} Domain\n`;
    md += `Naturally splits into **\`${domain}CommandService\`** and **\`${domain}QueryService\`**.\n\n`;
    
    md += '### Commands (Mutations)\n';
    for (const c of commands) {
      md += `- \`${c}\`\n`;
    }
    md += '\n';
    
    md += '### Queries (Reads)\n';
    for (const q of queries) {
      md += `- \`${q}\`\n`;
    }
    md += '\n---\n\n';
  } else if (queries.length > 0) {
    md += `## ${domain} Domain\n`;
    md += `Currently acts purely as a **Query Service** (No commands detected).\n\n`;
  } else if (commands.length > 0) {
    md += `## ${domain} Domain\n`;
    md += `Currently acts purely as a **Command Service** (No queries detected).\n\n`;
  }
}

fs.writeFileSync('docs/architecture/cqrs-readiness.md', md);
console.log('docs/architecture/cqrs-readiness.md generated.');
