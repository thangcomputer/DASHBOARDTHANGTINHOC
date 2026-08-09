const fs = require('fs');
const path = require('path');

const models = [
  'Assignment', 'Course', 'Submission', 'TeachingGuide', 
  'TrainingCourse', 'TrainingLesson', 'TrainingProgress'
];
const repoDir = path.join(__dirname, 'modules/course/repositories');
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
console.log('Generated Course repositories');
