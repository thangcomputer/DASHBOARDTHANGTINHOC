const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs', 'architecture');
fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'workflow-engine-design.md',
  'workflow-definition.md',
  'workflow-runtime.md',
  'workflow-state-machine.md',
  'workflow-events.md',
  'workflow-security.md',
  'workflow-observability.md',
  'workflow-performance.md',
  'rule-engine-design.md',
  'expression-engine-design.md',
  'decision-table-design.md',
  'scheduler-design-v2.md',
  'queue-design.md',
  'retry-design.md',
  'dead-letter-design.md',
  'integration-platform.md',
  'connector-design.md',
  'webhook-design.md',
  'api-gateway-design.md',
  'provider-design.md',
  'automation-platform.md',
  'notification-platform.md',
  'document-platform.md',
  'global-search-design.md',
  'workflow-ai-design.md',
  'architecture-review-workflow.md',
  'technical-debt-v16.md',
  'enterprise-roadmap-v2.md',
  'sprint5.3-planning-final.md'
];

reports.forEach(report => {
  const content = `# \${report.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\\n\\nArchitecture design document for Sprint 5.3 Enterprise Workflow Automation & Integration Platform.\\n\\n## Overview\\nDesign for DDD, CQRS, Event-Driven, Saga, and Multi-tenant requirements.`;
  fs.writeFileSync(path.join(docsDir, report), content);
});

console.log('✅ Sprint 5.3 Workflow Automation Planning documents generated successfully.');
