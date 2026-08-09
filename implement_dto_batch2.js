const fs = require('fs');
const path = require('path');

const inventory = JSON.parse(fs.readFileSync('dto_inventory_raw.json', 'utf8'));

const domainsToMigrate = [
  { domain: 'student', services: ['StudentApplicationService'] },
  { domain: 'teacher', services: ['TeacherApplicationService', 'EmployeeApplicationService', 'StaffApplicationService'] },
  { domain: 'course', services: ['CourseApplicationService', 'AssignmentApplicationService', 'TrainingApplicationService', 'TeachingGuideApplicationService'] },
  { domain: 'enrollment', services: ['EnrollmentApplicationService'] },
  { domain: 'attendance', services: ['AttendanceApplicationService'] }
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
      fs.writeFileSync(mapperPath, `'use strict';

class ${mapperName} {
  static fromCreateDTO(command) { return { ...command }; }
  static fromUpdateDTO(command) { return { ...command }; }
  static toEntity(dto) { return { ...dto }; }
  static toResponse(entity) { return { ...entity }; }
  static toSummary(entity) { return { ...entity }; }
  static toDetail(entity) { return { ...entity }; }
}

module.exports = ${mapperName};
`);
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
      // Generate DTO Data Container (Optional as per new guidelines, object returned is enough, but we can generate them if requested. ARB says DTO is immutable plain object).
      // We will skip explicit class files for DTOs to avoid boilerplate, relying on Object.freeze returned from Validator.
    }
    
    validatorCode += `}\n\nmodule.exports = ${validatorName};\n`;
    fs.writeFileSync(validatorPath, validatorCode);
    indexExports.push(`module.exports.${validatorName} = require('./validators/${validatorName}');`);

    // Rewrite Controller
    const controllerPath = path.join(domainDir, 'controllers', `${baseName}Controller.js`);
    if (fs.existsSync(controllerPath)) {
      let code = fs.readFileSync(controllerPath, 'utf8');
      
      // Inject Validator require
      if (!code.includes(`${validatorName}`)) {
        code = code.replace(/(class \w+ \{)/, `const { ${validatorName}, ${mapperName} } = require('../dto');\n\n$1`);
      }
      
      // Replace data map with Validator call
      const dataRegex = /const data = \{[\s\S]*?_res: res,?\s*\};/g;
      code = code.replace(dataRegex, (match) => {
        return `// Replaced by Zod Validator`;
      });
      
      // Replace service calls
      for (const methodName of Object.keys(methods)) {
        const callRegex = new RegExp(`await ${baseName.charAt(0).toLowerCase() + baseName.slice(1)}ApplicationService\\.${methodName}\\(data\\);`, 'g');
        const capMethod = capitalize(methodName);
        code = code.replace(callRegex, `await ${baseName.charAt(0).toLowerCase() + baseName.slice(1)}ApplicationService.${methodName}(${validatorName}.validate${capMethod}(req));`);
      }
      
      // Update error handling
      code = code.replace(/const status = err\.status \|\| err\.statusCode \|\| 500;/g, `const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);`);
      code = code.replace(/message: err\.message \|\| 'Lỗi server' \}\);/g, `message: err.message || 'Lỗi server', errors: err.errors });`);
      
      fs.writeFileSync(controllerPath, code);
    }
    
    // Rewrite Service
    const servicePath = path.join(domainDir, 'services', serviceName + '.js');
    if (fs.existsSync(servicePath)) {
      let code = fs.readFileSync(servicePath, 'utf8');
      
      // Method signature is already async methodName(data)
      // Replace internal data usage
      code = code.replace(/data\.body\./g, 'data.');
      code = code.replace(/data\.query\./g, 'data.');
      code = code.replace(/data\.params\./g, 'data.');
      // Keep data.file, data.user since they are now top level in validated payload
      
      fs.writeFileSync(servicePath, code);
    }
  }
  
  // Write index.js
  fs.writeFileSync(path.join(dtoDir, 'index.js'), `'use strict';\n\n${indexExports.join('\n')}\n`);
  
  console.log(`✅ Migrated DTOs for ${domain}`);
}
