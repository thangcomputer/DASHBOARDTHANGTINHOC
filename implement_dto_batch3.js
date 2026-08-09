const fs = require('fs');
const path = require('path');

const inventory = JSON.parse(fs.readFileSync('dto_inventory_raw.json', 'utf8'));

const domainsToMigrate = [
  { domain: 'finance', services: ['FinanceApplicationService', 'BiApplicationService'] },
  { domain: 'payment', services: ['PaymentApplicationService'] },
  { domain: 'invoice', services: ['InvoiceApplicationService'] },
  { domain: 'transaction', services: ['TransactionApplicationService'] },
  { domain: 'exam', services: ['EvaluationApplicationService', 'ExamResultApplicationService', 'ProctorApplicationService', 'QuizApplicationService'] },
  { domain: 'analytics', services: ['AnalyticsApplicationService'] },
  { domain: 'report', services: ['BackupApplicationService', 'MonitoringApplicationService', 'SystemLogApplicationService'] }
];

const BASE_DIR = path.join(__dirname, 'modules');

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

for (const { domain, services } of domainsToMigrate) {
  const domainDir = path.join(BASE_DIR, domain);
  const dtoDir = path.join(domainDir, 'dto');
  
  fs.mkdirSync(path.join(dtoDir, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(dtoDir, 'queries'), { recursive: true });
  fs.mkdirSync(path.join(dtoDir, 'responses'), { recursive: true });
  fs.mkdirSync(path.join(dtoDir, 'mappers'), { recursive: true });
  fs.mkdirSync(path.join(dtoDir, 'validators'), { recursive: true });

  let indexExports = [];

  for (const serviceName of services) {
    const methods = inventory[serviceName] || {};
    const baseName = serviceName.replace('ApplicationService', '');
    
    // Generate Mapper
    const mapperName = `${baseName}Mapper`;
    const mapperPath = path.join(dtoDir, 'mappers', `${mapperName}.js`);
    if (!fs.existsSync(mapperPath)) {
      fs.writeFileSync(mapperPath, `'use strict';\n\nconst MapperMetrics = require('../../../../shared/metrics/MapperMetrics');\n\nclass ${mapperName} {\n  static _withMetrics(name, fn) {\n    const start = Date.now();\n    const result = fn();\n    MapperMetrics.logExecution('${domain}', '${mapperName}.' + name, Date.now() - start);\n    return result;\n  }\n\n  static fromCreateDTO(command) { return this._withMetrics('fromCreateDTO', () => ({ ...command })); }\n  static fromUpdateDTO(command) { return this._withMetrics('fromUpdateDTO', () => ({ ...command })); }\n  static toEntity(dto) { return this._withMetrics('toEntity', () => ({ ...dto })); }\n  static toResponse(entity) { return this._withMetrics('toResponse', () => ({ ...entity })); }\n  static toSummary(entity) { return this._withMetrics('toSummary', () => ({ ...entity })); }\n  static toDetail(entity) { return this._withMetrics('toDetail', () => ({ ...entity })); }\n}\n\nmodule.exports = ${mapperName};\n`);
    }
    indexExports.push(`module.exports.${mapperName} = require('./mappers/${mapperName}');`);

    // Generate Validator
    const validatorName = `${baseName}Validator`;
    const validatorPath = path.join(dtoDir, 'validators', `${validatorName}.js`);
    let validatorCode = `'use strict';\n\nconst { z } = require('zod');\nconst ValidationException = require('../../../../shared/errors/ValidationException');\nconst ValidationMetrics = require('../../../../shared/metrics/ValidationMetrics');\n\nclass ${validatorName} {\n`;
    
    // Process methods
    for (const [methodName, fields] of Object.entries(methods)) {
      const isQuery = methodName.startsWith('get') || methodName.startsWith('list') || methodName.startsWith('search') || methodName.startsWith('export');
      const dtoType = isQuery ? 'Query' : 'Command';
      const capMethod = capitalize(methodName);
      const dtoName = `${capMethod}${dtoType}`;
      
      const allFields = [...(fields.body || []), ...(fields.query || []), ...(fields.params || [])];
      let schemaFields = allFields.map(f => `    ${f}: z.any().optional(),`).join('\n');
      if (fields.file) schemaFields += `\n    file: z.any().optional(),`;
      if (fields.files) schemaFields += `\n    files: z.any().optional(),`;
      if (schemaFields === '') schemaFields = '    _placeholder: z.any().optional()';

      validatorCode += `
  static validate${capMethod}(req) {
    const schema = z.object({\n${schemaFields}\n    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('${domain}', '${dtoName}', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('${domain}', '${dtoName}', Date.now() - start);
    return Object.freeze(result.data);
  }
`;
    }
    
    validatorCode += `}\n\nmodule.exports = ${validatorName};\n`;
    fs.writeFileSync(validatorPath, validatorCode);
    indexExports.push(`module.exports.${validatorName} = require('./validators/${validatorName}');`);

    // Rewrite Controller
    const controllerPath = path.join(domainDir, 'controllers', `${baseName}Controller.js`);
    if (fs.existsSync(controllerPath)) {
      let code = fs.readFileSync(controllerPath, 'utf8');
      
      if (!code.includes(`${validatorName}`)) {
        code = code.replace(/(class \w+ \{)/, `const { ${validatorName}, ${mapperName} } = require('../dto');\n\n$1`);
      }
      
      const dataRegex = /const data = \{[\s\S]*?_res: res,?\s*\};/g;
      code = code.replace(dataRegex, `// Replaced by Zod Validator`);
      
      for (const methodName of Object.keys(methods)) {
        const callRegex = new RegExp(`await ${baseName.charAt(0).toLowerCase() + baseName.slice(1)}ApplicationService\\.${methodName}\\(data\\);`, 'g');
        const capMethod = capitalize(methodName);
        code = code.replace(callRegex, `await ${baseName.charAt(0).toLowerCase() + baseName.slice(1)}ApplicationService.${methodName}(${validatorName}.validate${capMethod}(req));`);
      }
      
      code = code.replace(/const status = err\.status \|\| err\.statusCode \|\| 500;/g, `const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);`);
      code = code.replace(/message: err\.message \|\| 'Lỗi server' \}\);/g, `message: err.message || 'Lỗi server', errors: err.errors });`);
      
      fs.writeFileSync(controllerPath, code);
    }
    
    // Rewrite Service
    const servicePath = path.join(domainDir, 'services', serviceName + '.js');
    if (fs.existsSync(servicePath)) {
      let code = fs.readFileSync(servicePath, 'utf8');
      code = code.replace(/data\.body\./g, 'data.');
      code = code.replace(/data\.query\./g, 'data.');
      code = code.replace(/data\.params\./g, 'data.');
      fs.writeFileSync(servicePath, code);
    }
  }
  
  fs.writeFileSync(path.join(dtoDir, 'index.js'), `'use strict';\n\n${indexExports.join('\n')}\n`);
  
  console.log(`✅ Migrated DTOs for ${domain}`);
}
