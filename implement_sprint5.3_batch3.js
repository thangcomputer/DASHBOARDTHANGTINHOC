const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const modulesDir = path.join(rootDir, 'modules');
const sharedProvidersDir = path.join(rootDir, 'shared', 'providers');
const docsDir = path.join(rootDir, 'docs', 'architecture');

const boundedContexts = ['integration', 'notification', 'document', 'global-search'];

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
  'services',
  'runtime'
];

const writeSafeJsFile = (filePath) => {
  fs.writeFileSync(filePath, `'use strict';\nmodule.exports = {};\n`);
};

// Create modules and subdirs
boundedContexts.forEach(mod => {
  const modDir = path.join(modulesDir, mod);
  fs.mkdirSync(modDir, { recursive: true });
  subdirs.forEach(sub => fs.mkdirSync(path.join(modDir, sub), { recursive: true }));
});

// Models
const integrationModels = [
  'Connector', 'ConnectorDefinition', 'ConnectorInstance', 'Webhook', 'WebhookSubscription',
  'WebhookDelivery', 'ApiGateway', 'ApiEndpoint', 'ApiCredential', 'IntegrationLog', 'IntegrationHistory'
];
integrationModels.forEach(m => writeSafeJsFile(path.join(modulesDir, 'integration', 'models', `\${m}.js`)));

const notificationModels = [
  'Notification', 'NotificationTemplate', 'NotificationChannel', 'NotificationPreference',
  'NotificationQueue', 'NotificationDelivery', 'NotificationHistory',
  'EmailProvider', 'SmsProvider', 'PushProvider', 'ZaloProvider'
];
notificationModels.forEach(m => writeSafeJsFile(path.join(modulesDir, 'notification', 'models', `\${m}.js`)));

const documentModels = [
  'Document', 'DocumentTemplate', 'DocumentVersion', 'DocumentRenderJob',
  'PdfJob', 'CertificateJob', 'InvoiceJob', 'DocumentHistory', 'DocumentStorage'
];
documentModels.forEach(m => writeSafeJsFile(path.join(modulesDir, 'document', 'models', `\${m}.js`)));

const searchModels = [
  'SearchIndex', 'SearchDocument', 'SearchProjection', 'SearchHistory',
  'SearchQuery', 'AuditSearch', 'GlobalSearchResult'
];
searchModels.forEach(m => writeSafeJsFile(path.join(modulesDir, 'global-search', 'models', `\${m}.js`)));

// Runtime Services
const runtimeServices = [
  { mod: 'integration', srvs: ['IntegrationEngine', 'WebhookEngine', 'ConnectorEngine', 'ApiGatewayEngine'] },
  { mod: 'notification', srvs: ['NotificationEngine', 'NotificationDispatcher', 'NotificationQueueEngine'] },
  { mod: 'document', srvs: ['DocumentEngine', 'DocumentRenderEngine', 'TemplateEngine', 'StorageEngine'] },
  { mod: 'global-search', srvs: ['GlobalSearchEngine', 'SearchIndexer', 'SearchProjectionEngine', 'AuditSearchEngine'] }
];
runtimeServices.forEach(item => {
  item.srvs.forEach(srv => writeSafeJsFile(path.join(modulesDir, item.mod, 'runtime', `\${srv}.js`)));
});

// CQRS Commands
const commands = [
  { mod: 'integration', cmds: ['CreateConnector', 'UpdateConnector', 'PublishConnector', 'CreateWebhook', 'DeliverWebhook', 'RetryWebhook'] },
  { mod: 'notification', cmds: ['CreateNotification', 'SendNotification', 'RetryNotification'] },
  { mod: 'document', cmds: ['CreateDocument', 'GenerateDocument', 'ArchiveDocument'] },
  { mod: 'global-search', cmds: ['IndexSearchDocument', 'RebuildSearchIndex'] }
];
commands.forEach(item => {
  item.cmds.forEach(cmd => writeSafeJsFile(path.join(modulesDir, item.mod, 'cqrs', 'commands', `\${cmd}Handler.js`)));
});

// CQRS Queries
const queries = [
  { mod: 'integration', qrys: ['GetConnector', 'SearchConnector'] },
  { mod: 'notification', qrys: ['GetNotification', 'SearchNotification'] },
  { mod: 'document', qrys: ['GetDocument', 'SearchDocument'] },
  { mod: 'global-search', qrys: ['SearchGlobal', 'GetSearchHistory'] }
];
queries.forEach(item => {
  item.qrys.forEach(qry => writeSafeJsFile(path.join(modulesDir, item.mod, 'cqrs', 'queries', `\${qry}Handler.js`)));
});

// Repositories
const repositories = [
  { mod: 'integration', repos: ['IntegrationRepository', 'WebhookRepository'] },
  { mod: 'notification', repos: ['NotificationRepository'] },
  { mod: 'document', repos: ['DocumentRepository'] },
  { mod: 'global-search', repos: ['SearchRepository', 'AuditSearchRepository'] }
];
repositories.forEach(item => {
  item.repos.forEach(repo => writeSafeJsFile(path.join(modulesDir, item.mod, 'repositories', `\${repo}.js`)));
});

// Controllers
const controllers = [
  { mod: 'integration', ctrls: ['IntegrationController', 'WebhookController'] },
  { mod: 'notification', ctrls: ['NotificationController'] },
  { mod: 'document', ctrls: ['DocumentController'] },
  { mod: 'global-search', ctrls: ['SearchController'] }
];
controllers.forEach(item => {
  item.ctrls.forEach(ctrl => writeSafeJsFile(path.join(modulesDir, item.mod, 'api', `\${ctrl}.js`)));
});

// Events
const events = [
  { mod: 'integration', evts: ['IntegrationEvents'] },
  { mod: 'notification', evts: ['NotificationEvents'] },
  { mod: 'document', evts: ['DocumentEvents'] },
  { mod: 'global-search', evts: ['SearchEvents'] }
];
events.forEach(item => {
  item.evts.forEach(evt => writeSafeJsFile(path.join(modulesDir, item.mod, 'events', `\${evt}.js`)));
});

// Create shared providers
fs.mkdirSync(sharedProvidersDir, { recursive: true });
const sharedProviders = [
  'EmailProvider', 'SmsProvider', 'ZaloProvider', 'PushProvider',
  'PdfProvider', 'StorageProvider', 'WebhookProvider', 'SearchProvider'
];
sharedProviders.forEach(srv => writeSafeJsFile(path.join(sharedProvidersDir, `\${srv}.js`)));

// Generate Documentation reports
fs.mkdirSync(docsDir, { recursive: true });

const reports = [
  'integration-review.md',
  'connector-review.md',
  'webhook-review.md',
  'notification-review.md',
  'notification-runtime-review.md',
  'document-review.md',
  'document-render-review.md',
  'template-engine-review.md',
  'storage-review.md',
  'global-search-review.md',
  'search-index-review.md',
  'audit-search-review.md',
  'provider-review.md',
  'integration-events-review.md',
  'integration-security-review.md',
  'integration-performance-review.md',
  'integration-observability-review.md',
  'batch3-workflow.md',
  'workflow-regression-batch3.md'
];

reports.forEach(report => {
  fs.writeFileSync(path.join(docsDir, report), `# \${report.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\\n\\nGenerated artifact for Sprint 5.3 Batch 3 Enterprise Integration, Notification, Document & Global Search Platform.`);
});

console.log('✅ Sprint 5.3 Batch 3 scaffolding generated successfully.');
