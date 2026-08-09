const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs', 'architecture');
fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'business-capability-inventory.md',
  'lms-design.md', 'learning-path-design.md', 'gamification-design.md', 'assessment-design.md',
  'erp-design.md', 'crm-design.md', 'finance-evolution.md',
  'ai-platform-design.md', 'rag-design.md', 'prompt-management.md', 'vector-search-design.md',
  'workflow-design.md', 'automation-design.md', 'scheduler-design.md',
  'reporting-design.md', 'dashboard-design.md', 'kpi-design.md',
  'search-design.md', 'indexing-design.md',
  'mobile-readiness.md', 'offline-sync-design.md',
  'technical-debt-v12.md',
  'architecture-review-v5.md', 'enterprise-roadmap.md', 'sprint5-planning-final.md'
];

reports.forEach(report => {
  const content = `# \${report.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\\n\\nGenerated artifact for Sprint 5.0 Enterprise Feature Platform - Planning Phase.`;
  fs.writeFileSync(path.join(docsDir, report), content);
});

console.log('✅ Sprint 5.0 Planning artifacts generated successfully.');
