const fs = require('fs');
const path = require('path');

const models = ['Schedule', 'ScheduleHistory'];
const repoDir = path.join(__dirname, 'modules/attendance/repositories');
if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir);

let indexContent = '';

models.forEach(m => {
  const repoName = m + 'Repository';
  const mongoName = 'Mongo' + repoName;
  
  // Interface
  fs.writeFileSync(path.join(repoDir, repoName + '.js'), `const BaseRepository = require('../../../shared/repositories/BaseRepository');\n\nclass ${repoName} extends BaseRepository {\n}\n\nmodule.exports = ${repoName};\n`);
  
  // Impl
  fs.writeFileSync(path.join(repoDir, mongoName + '.js'), `const ${repoName} = require('./${repoName}');\nconst ${m} = require('../models/${m}');\n\nclass ${mongoName} extends ${repoName} {\n  constructor() {\n    super(${m});\n  }\n}\n\nmodule.exports = ${mongoName};\n`);
  
  indexContent += `const ${mongoName} = require('./${mongoName}');\n`;
});

indexContent += '\nmodule.exports = {\n';
models.forEach(m => {
  const camelName = m.charAt(0).toLowerCase() + m.slice(1) + 'Repository';
  const mongoName = 'Mongo' + m + 'Repository';
  indexContent += `  ${camelName}: new ${mongoName}(),\n`;
});
indexContent += '};\n';

fs.writeFileSync(path.join(repoDir, 'index.js'), indexContent);

// Migrate scheduleRoutes.js
const routeFile = path.join(__dirname, 'modules/attendance/routes/scheduleRoutes.js');
let content = fs.readFileSync(routeFile, 'utf8');

// Replace imports
models.forEach(m => {
  const camelName = m.charAt(0).toLowerCase() + m.slice(1) + 'Repository';
  content = content.replace(
    new RegExp(`const ${m}\\s*=\\s*require\\('\\.\\./models/${m}'\\);`, 'g'),
    `const { ${camelName} } = require('../repositories');\nconst ${m} = require('../models/${m}'); // Temp for new ${m}`
  );

  const replacements = [
    { from: new RegExp(`${m}\\.countDocuments\\(`, 'g'), to: `${camelName}.count(` },
    { from: new RegExp(`${m}\\.find\\(`, 'g'), to: `${camelName}.findMany(` },
    { from: new RegExp(`${m}\\.findById\\(`, 'g'), to: `${camelName}.findById(` },
    { from: new RegExp(`${m}\\.findOne\\(`, 'g'), to: `${camelName}.findOne(` },
    { from: new RegExp(`${m}\\.aggregate\\(`, 'g'), to: `${camelName}.aggregate(` },
    { from: new RegExp(`${m}\\.create\\(`, 'g'), to: `${camelName}.create(` },
    { from: new RegExp(`${m}\\.insertMany\\(`, 'g'), to: `${camelName}.insertMany(` },
    { from: new RegExp(`${m}\\.findByIdAndUpdate\\(`, 'g'), to: `${camelName}.updateById(` },
    { from: new RegExp(`${m}\\.findOneAndUpdate\\(`, 'g'), to: `${camelName}.updateOne(` },
    { from: new RegExp(`${m}\\.findByIdAndDelete\\(`, 'g'), to: `${camelName}.deleteById(` },
    { from: new RegExp(`${m}\\.findOneAndDelete\\(`, 'g'), to: `${camelName}.deleteOne(` },
    { from: new RegExp(`${m}\\.updateMany\\(`, 'g'), to: `${camelName}.updateMany(` },
    { from: new RegExp(`new ${m}\\(`, 'g'), to: `${camelName}.createInstance(` },
  ];

  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });
});

fs.writeFileSync(routeFile, content, 'utf8');
console.log('Migrated Attendance Domain');
