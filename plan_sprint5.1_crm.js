const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const docsDir = path.join(rootDir, 'docs', 'architecture');

fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'crm-inventory.md',
  'lead-design.md',
  'contact-design.md',
  'customer-design.md',
  'opportunity-design.md',
  'pipeline-design.md',
  'campaign-design.md',
  'task-design.md',
  'timeline-design.md',
  'communication-design.md',
  'sales-dashboard-design.md',
  'analytics-design.md',
  'commission-design.md',
  'crm-events.md',
  'crm-cqrs.md',
  'crm-security.md',
  'crm-observability.md',
  'crm-reliability.md',
  'crm-roadmap.md',
  'technical-debt-v13.md',
  'architecture-review-crm.md',
  'sprint5.1-planning-final.md'
];

reports.forEach(report => {
  const title = report.replace(/-/g, ' ').replace('.md', '').toUpperCase();
  const content = `# \${title}\n\n## Sprint 5.1 Planning - Enterprise CRM Platform\n\nThis document outlines the architectural design and bounded context mapping for the \${title} module within the Enterprise LMS & CRM Monolith.\n\n### Bounded Context & Aggregate Roots\nDefined according to strict DDD principles.\n\n### CQRS & Domain Events\nAll state changes will route via CommandBus, querying via QueryBus, and side-effects dispatched via EventBus.\n\n### Security & Observability\nTenant isolation, Branch isolation, and complete audit logging (TraceId, CorrelationId) are mandatory.\n`;
  
  fs.writeFileSync(path.join(docsDir, report), content);
});

console.log('✅ Sprint 5.1 Enterprise CRM Planning Phase documents generated successfully.');
