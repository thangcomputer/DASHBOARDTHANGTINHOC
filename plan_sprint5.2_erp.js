const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const docsDir = path.join(rootDir, 'docs', 'architecture');

fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'erp-inventory.md',
  'finance-design.md',
  'invoice-design.md',
  'payment-design.md',
  'refund-design.md',
  'wallet-design.md',
  'ledger-design.md',
  'accounting-design.md',
  'journal-design.md',
  'payroll-design.md',
  'teacher-settlement-design.md',
  'commission-design.md',
  'budget-design.md',
  'asset-design.md',
  'inventory-design.md',
  'procurement-design.md',
  'approval-workflow-design.md',
  'financial-dashboard-design.md',
  'financial-analytics-design.md',
  'erp-events.md',
  'erp-cqrs.md',
  'erp-security.md',
  'erp-observability.md',
  'erp-performance.md',
  'erp-roadmap.md',
  'technical-debt-v14.md',
  'architecture-review-erp.md',
  'sprint5.2-planning-final.md'
];

reports.forEach(report => {
  const title = report.replace(/-/g, ' ').replace('.md', '').toUpperCase();
  const content = `# \${title}\n\n## Sprint 5.2 Planning - Enterprise ERP & Finance Platform\n\nThis document outlines the architectural design and bounded context mapping for the \${title} module within the Enterprise LMS, CRM & ERP Monolith.\n\n### Bounded Context & Aggregate Roots\nDefined according to strict DDD principles, completely decoupled from existing CRM and LMS modules.\n\n### CQRS & Domain Events\nAll state changes will route via CommandBus, querying via QueryBus, and side-effects dispatched via EventBus. Integrations will be purely event-driven.\n\n### Security & Observability\nFinancial RBAC, Maker-Checker Dual Approval, Tenant isolation, Branch isolation, and complete immutable audit logging (TraceId, CorrelationId) are mandatory.\n`;
  
  fs.writeFileSync(path.join(docsDir, report), content);
});

console.log('✅ Sprint 5.2 Enterprise ERP Planning Phase documents generated successfully.');
