const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs', 'architecture');
fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'platform-hardening.md',
  'business-logic-roadmap.md',
  'api-governance.md',
  'event-governance.md',
  'database-governance.md',
  'security-hardening.md',
  'observability-governance.md',
  'performance-governance.md',
  'reliability-governance.md',
  'devops-roadmap.md',
  'testing-strategy.md',
  'ai-governance.md',
  'documentation-governance.md',
  'production-readiness.md',
  'technical-debt-v18.md',
  'architecture-review-v18.md',
  'enterprise-roadmap-v3.md',
  'sprint5.4-planning-final.md'
];

reports.forEach(report => {
  const content = `# \${report.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\\n\\nArchitecture design document for Sprint 5.4 Enterprise Platform Hardening & Production Readiness.\\n\\n## Overview\\nFocus on API standardization, DB hardening, observability, security, Devops, AI governance, and preparing LMS/CRM/ERP for production.`;
  fs.writeFileSync(path.join(docsDir, report), content);
});

console.log('✅ Sprint 5.4 Enterprise Platform Hardening Planning documents generated successfully.');
