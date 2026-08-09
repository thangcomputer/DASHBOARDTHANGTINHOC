const fs = require('fs');
const path = require('path');

const studentDir = path.join(__dirname, 'modules', 'student');
const cqrsDir = path.join(__dirname, 'shared', 'cqrs');

// 1. Create global CQRS singleton exports for simple wiring
fs.writeFileSync(path.join(cqrsDir, 'index.js'), `'use strict';
const CommandBus = require('./CommandBus');
const CommandRegistry = require('./CommandRegistry');
const QueryBus = require('./QueryBus');
const QueryRegistry = require('./QueryRegistry');
const EventBus = require('../events/EventBus');
const EventRegistry = require('../events/EventRegistry');
const EventDispatcher = require('../events/EventDispatcher');

const commandRegistry = new CommandRegistry();
const queryRegistry = new QueryRegistry();
const eventRegistry = new EventRegistry();
const eventDispatcher = new EventDispatcher(eventRegistry);

const eventBus = new EventBus(eventDispatcher, [{
  beforeExecute: async (event) => console.log(\`[EventBus] Publishing \${event.eventName}\`)
}]);

const commandBus = new CommandBus(commandRegistry, [{
  beforeExecute: async (cmd) => console.log(\`[CommandBus] Executing \${cmd.constructor.name}\`)
}]);

const queryBus = new QueryBus(queryRegistry, [{
  beforeExecute: async (q) => console.log(\`[QueryBus] Executing \${q.constructor.name}\`)
}]);

module.exports = { commandBus, commandRegistry, queryBus, queryRegistry, eventBus, eventRegistry };
`);

// 2. Parse Controller to find methods
const controllerPath = path.join(studentDir, 'controllers', 'StudentController.js');
let controllerCode = fs.readFileSync(controllerPath, 'utf8');

const regex = /async (\w+)\(req, res\)/g;
let m;
const methods = [];
while (m = regex.exec(controllerCode)) {
  methods.push(m[1]);
}

// 3. Create Handlers & Events
fs.mkdirSync(path.join(studentDir, 'commands'), { recursive: true });
fs.mkdirSync(path.join(studentDir, 'queries'), { recursive: true });
fs.mkdirSync(path.join(studentDir, 'events'), { recursive: true });

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

let handlerRegistrations = [];

for (const methodName of methods) {
  const isQuery = methodName.startsWith('get') || methodName.startsWith('list') || methodName.startsWith('search') || methodName.startsWith('export');
  const type = isQuery ? 'Query' : 'Command';
  const capMethod = capitalize(methodName);
  const className = `${capMethod}${type}`;
  const handlerName = `${capMethod}Handler`;
  
  // DTO Class
  const dtoCode = `'use strict';\nclass ${className} {\n  constructor(payload) { Object.assign(this, payload); }\n}\nmodule.exports = ${className};\n`;
  
  // Handler Class
  let handlerCode = `'use strict';\nconst studentApplicationService = require('../../services/StudentApplicationService');\n`;
  
  if (!isQuery) {
    const eventName = `Student${capMethod}Completed`;
    const eventCode = `'use strict';\nconst DomainEvent = require('../../../shared/events/DomainEvent');\nclass ${eventName} extends DomainEvent {}\nmodule.exports = ${eventName};\n`;
    fs.writeFileSync(path.join(studentDir, 'events', `${eventName}.js`), eventCode);
    handlerCode += `const { eventBus } = require('../../../shared/cqrs');\nconst ${eventName} = require('../events/${eventName}');\n`;
    handlerCode += `\nclass ${handlerName} {\n  async execute(command) {\n    const result = await studentApplicationService.${methodName}(command);\n    await eventBus.publish(new ${eventName}(command));\n    return result;\n  }\n}\nmodule.exports = ${handlerName};\n`;
  } else {
    handlerCode += `\nclass ${handlerName} {\n  async execute(query) {\n    return await studentApplicationService.${methodName}(query);\n  }\n}\nmodule.exports = ${handlerName};\n`;
  }
  
  const folder = isQuery ? 'queries' : 'commands';
  fs.writeFileSync(path.join(studentDir, folder, `${className}.js`), dtoCode);
  fs.writeFileSync(path.join(studentDir, folder, `${handlerName}.js`), handlerCode);
  
  handlerRegistrations.push({ type, className, handlerName, folder });
}

// 4. Update Controller
if (!controllerCode.includes('commandBus')) {
  controllerCode = controllerCode.replace(
    /const studentApplicationService = require\('\.\.\/services\/StudentApplicationService'\);/,
    `const { commandBus, queryBus } = require('../../../shared/cqrs');\nconst commands = require('../commands');\nconst queries = require('../queries');`
  );
  
  for (const reg of handlerRegistrations) {
    const capMethod = capitalize(reg.className.replace(reg.type, ''));
    
    // Instead of completely dropping the req structure, we must maintain whatever was originally passed.
    // Let's replace the actual call: studentApplicationService.methodName(...) -> bus.dispatch(new Command(...))
    // We will do a generic regex replace for the function call.
    
    const busVar = reg.type === 'Command' ? 'commandBus' : 'queryBus';
    const importObj = reg.type === 'Command' ? 'commands' : 'queries';
    
    const oldCallStr = `studentApplicationService.${reg.className.replace(reg.type, '').toLowerCase()}`;
    // The previous script had a naive replace which might fail depending on casing.
    // Let's explicitly search for `studentApplicationService.xxx(`
    const originalMethodName = reg.className.replace(reg.type, '').replace(/^./, c => c.toLowerCase());
    
    const replacer = (match, args) => {
      return `await ${busVar}.dispatch(new ${importObj}.${reg.className}(${args}))`;
    };
    
    const oldRegex = new RegExp(`await studentApplicationService\\.${originalMethodName}\\((.*?)\\)`, 'g');
    controllerCode = controllerCode.replace(oldRegex, replacer);
  }
  
  fs.writeFileSync(controllerPath, controllerCode);
}

// 5. Generate index.js for commands/queries to export DTOs & Register Handlers
let cmdIndex = `'use strict';\nconst { commandRegistry } = require('../../../shared/cqrs');\n`;
let qryIndex = `'use strict';\nconst { queryRegistry } = require('../../../shared/cqrs');\n`;

for (const reg of handlerRegistrations) {
  if (reg.type === 'Command') {
    cmdIndex += `const ${reg.className} = require('./${reg.className}');\n`;
    cmdIndex += `const ${reg.handlerName} = require('./${reg.handlerName}');\n`;
    cmdIndex += `commandRegistry.register('${reg.className}', new ${reg.handlerName}());\n`;
    cmdIndex += `module.exports.${reg.className} = ${reg.className};\n`;
  } else {
    qryIndex += `const ${reg.className} = require('./${reg.className}');\n`;
    qryIndex += `const ${reg.handlerName} = require('./${reg.handlerName}');\n`;
    qryIndex += `queryRegistry.register('${reg.className}', new ${reg.handlerName}());\n`;
    qryIndex += `module.exports.${reg.className} = ${reg.className};\n`;
  }
}
fs.writeFileSync(path.join(studentDir, 'commands', 'index.js'), cmdIndex);
fs.writeFileSync(path.join(studentDir, 'queries', 'index.js'), qryIndex);

// 6. Generate Event Handler (Log only)
let evtIndex = `'use strict';\nconst { eventBus } = require('../../../shared/cqrs');\n`;
for (const reg of handlerRegistrations.filter(r => r.type === 'Command')) {
  const eventName = `Student${capitalize(reg.className.replace('Command', ''))}Completed`;
  evtIndex += `eventBus.subscribe('${eventName}', { handle: async (event) => console.log('[Event Handler]', event.eventName, 'processed successfully.') });\n`;
}
fs.writeFileSync(path.join(studentDir, 'events', 'index.js'), evtIndex);

// Add event handlers registration to commands/index.js so it runs
fs.appendFileSync(path.join(studentDir, 'commands', 'index.js'), `require('../events');\n`);

console.log('✅ Student Domain CQRS Migration Complete.');
