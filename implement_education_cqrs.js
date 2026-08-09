const fs = require('fs');
const path = require('path');

const domains = ['teacher', 'course', 'enrollment', 'attendance'];

function capitalize(str) { 
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1); 
}

let allRegistrations = [];

for (const domain of domains) {
  console.log(`Migrating ${domain}...`);
  const domainDir = path.join(__dirname, 'modules', domain);
  
  // Create folders
  const cmdDir = path.join(domainDir, 'commands');
  const qryDir = path.join(domainDir, 'queries');
  const evtDir = path.join(domainDir, 'events');
  fs.mkdirSync(cmdDir, { recursive: true });
  fs.mkdirSync(qryDir, { recursive: true });
  fs.mkdirSync(evtDir, { recursive: true });

  // Locate Controller
  const controllersDir = path.join(domainDir, 'controllers');
  if (!fs.existsSync(controllersDir)) {
    console.log(`Warning: No controllers folder for ${domain}`);
    continue;
  }
  
  const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('Controller.js'));
  if (files.length === 0) {
    console.log(`Warning: No controller found for ${domain}`);
    continue;
  }
  
  const controllerPath = path.join(controllersDir, files[0]);
  let controllerCode = fs.readFileSync(controllerPath, 'utf8');
  
  // Find application service variable name (e.g., teacherApplicationService)
  let appServiceMatch = controllerCode.match(/const (\w+) = require\('\.\.\/services\/\w+'\);/);
  if (!appServiceMatch) {
    // try one level up or different naming
    appServiceMatch = controllerCode.match(/const (\w+) = require\('[\.\/a-zA-Z]+ApplicationService'\);/);
  }
  let appServiceVar = appServiceMatch ? appServiceMatch[1] : `${domain}ApplicationService`;

  // Parse Controller methods
  const regex = /async (\w+)\(req, res\)/g;
  let m;
  const methods = [];
  while ((m = regex.exec(controllerCode)) !== null) {
    methods.push(m[1]);
  }
  
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
    let handlerCode = `'use strict';\nconst ${appServiceVar} = require('../../services/${capitalize(domain)}ApplicationService');\n`;
    
    if (!isQuery) {
      const eventName = `${capitalize(domain)}${capMethod}Completed`;
      const eventCode = `'use strict';\nconst DomainEvent = require('../../../shared/events/DomainEvent');\nclass ${eventName} extends DomainEvent {}\nmodule.exports = ${eventName};\n`;
      fs.writeFileSync(path.join(evtDir, `${eventName}.js`), eventCode);
      handlerCode += `const { eventBus } = require('../../../shared/cqrs');\nconst ${eventName} = require('../events/${eventName}');\n`;
      handlerCode += `\nclass ${handlerName} {\n  async execute(command) {\n    const result = await ${appServiceVar}.${methodName}(command);\n    await eventBus.publish(new ${eventName}(command));\n    return result;\n  }\n}\nmodule.exports = ${handlerName};\n`;
    } else {
      handlerCode += `\nclass ${handlerName} {\n  async execute(query) {\n    return await ${appServiceVar}.${methodName}(query);\n  }\n}\nmodule.exports = ${handlerName};\n`;
    }
    
    const folder = isQuery ? 'queries' : 'commands';
    fs.writeFileSync(path.join(domainDir, folder, `${className}.js`), dtoCode);
    fs.writeFileSync(path.join(domainDir, folder, `${handlerName}.js`), handlerCode);
    
    handlerRegistrations.push({ type, className, handlerName, folder });
  }

  // Update Controller Code
  if (!controllerCode.includes('commandBus')) {
    const serviceRequireRegex = new RegExp(`const ${appServiceVar} = require\\('[\\.\\/a-zA-Z]+'\\);`);
    controllerCode = controllerCode.replace(
      serviceRequireRegex,
      `const { commandBus, queryBus } = require('../../../shared/cqrs');\nconst commands = require('../commands');\nconst queries = require('../queries');`
    );
    
    for (const reg of handlerRegistrations) {
      const busVar = reg.type === 'Command' ? 'commandBus' : 'queryBus';
      const importObj = reg.type === 'Command' ? 'commands' : 'queries';
      
      const originalMethodName = reg.className.replace(reg.type, '').replace(/^./, c => c.toLowerCase());
      
      const replacer = (match, args) => {
        return `await ${busVar}.dispatch(new ${importObj}.${reg.className}(${args}))`;
      };
      
      const oldRegex = new RegExp(`await ${appServiceVar}\\.${originalMethodName}\\((.*?)\\)`, 'g');
      controllerCode = controllerCode.replace(oldRegex, replacer);
    }
    
    fs.writeFileSync(controllerPath, controllerCode);
  }

  // Generate index.js for commands/queries
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
  
  // Generate Event Handlers and attach them to cmdIndex
  let evtIndex = `'use strict';\nconst { eventBus } = require('../../../shared/cqrs');\n`;
  const commandsList = handlerRegistrations.filter(r => r.type === 'Command');
  if (commandsList.length > 0) {
    for (const reg of commandsList) {
      const eventName = `${capitalize(domain)}${capitalize(reg.className.replace('Command', ''))}Completed`;
      evtIndex += `eventBus.subscribe('${eventName}', { handle: async (event) => console.log('[${capitalize(domain)} Event Handler]', event.eventName, 'processed successfully.') });\n`;
    }
    fs.writeFileSync(path.join(evtDir, 'index.js'), evtIndex);
    cmdIndex += `require('../events');\n`;
  }
  
  fs.writeFileSync(path.join(cmdDir, 'index.js'), cmdIndex);
  fs.writeFileSync(path.join(qryDir, 'index.js'), qryIndex);
  
  allRegistrations = allRegistrations.concat(handlerRegistrations);
}

console.log('✅ Core Education Domains CQRS Migration Complete.');
