const fs = require('fs');
const path = require('path');

const cqrsIndexPath = path.join(__dirname, 'shared', 'cqrs', 'index.js');
let cqrsIndexCode = fs.readFileSync(cqrsIndexPath, 'utf8');

// Replace naive logging with real hooks
const newHooks = `
const Metrics = require('../observability/Metrics');
const Tracer = require('../observability/Tracer');

const commandHooks = [{
  beforeExecute: async (cmd) => {
    Metrics.inc('command_total', { name: cmd.constructor.name });
  },
  afterExecute: async (cmd, result) => {
    // Tracer handles timing if wrapped
  },
  onError: async (cmd, err) => {
    err.isCommandError = true;
  }
}];

const queryHooks = [{
  beforeExecute: async (query) => {
    Metrics.inc('query_total', { name: query.constructor.name });
  },
  onError: async (query, err) => {
    err.isQueryError = true;
  }
}];

const eventHooks = [{
  beforeExecute: async (event) => {
    Metrics.inc('event_total', { name: event.eventName });
  }
}];

const commandRegistry = new CommandRegistry();
const queryRegistry = new QueryRegistry();
const eventRegistry = new EventRegistry();
const eventDispatcher = new EventDispatcher(eventRegistry);

const eventBus = new EventBus(eventDispatcher, eventHooks);
const commandBus = new CommandBus(commandRegistry, commandHooks);
const queryBus = new QueryBus(queryRegistry, queryHooks);
`;

cqrsIndexCode = cqrsIndexCode.replace(/const commandRegistry = new CommandRegistry\(\);[\s\S]*const queryBus = new QueryBus\(queryRegistry, \[\{\n.*?\n\}\]\);/, newHooks);
fs.writeFileSync(cqrsIndexPath, cqrsIndexCode);
console.log('✅ Updated shared/cqrs/index.js with Observability Hooks');

// Update server.js
const serverPath = path.join(__dirname, 'server.js');
let serverCode = fs.readFileSync(serverPath, 'utf8');

if (!serverCode.includes('ObservabilityMiddleware')) {
  // Inject middleware right after app initialization
  serverCode = serverCode.replace(
    /const app\s*=\s*express\(\);/,
    `const app    = express();\nconst { observabilityMiddleware, globalErrorHandler } = require('./shared/observability/ObservabilityMiddleware');\napp.use(observabilityMiddleware);\nconst healthController = require('./shared/observability/HealthController');\napp.use('/', healthController);`
  );

  // Inject global error handler at the end of routes but before current error handler
  serverCode = serverCode.replace(
    /app\.use\(\(err, req, res, next\) => \{/,
    `app.use(globalErrorHandler);\napp.use((err, req, res, next) => {`
  );
  
  fs.writeFileSync(serverPath, serverCode);
  console.log('✅ Updated server.js with ObservabilityMiddleware and globalErrorHandler');
} else {
  console.log('⚠️ server.js already contains ObservabilityMiddleware');
}
