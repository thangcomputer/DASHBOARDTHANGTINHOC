const fs = require('fs');
const path = require('path');

const models = [
  'Assignment', 'Course', 'Submission', 'TeachingGuide', 
  'TrainingCourse', 'TrainingLesson', 'TrainingProgress'
];

const routesDir = path.join(__dirname, 'modules/course/routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

routeFiles.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace imports
  models.forEach(m => {
    const camelName = m.charAt(0).toLowerCase() + m.slice(1) + 'Repository';
    
    // Some routes might import multiple models, so we'll do this carefully
    content = content.replace(
      new RegExp(`const ${m} \\s*=\\s*require\\('\\.\\./models/${m}'\\);`, 'g'),
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
      { from: new RegExp(`new ${m}\\(`, 'g'), to: `${camelName}.createInstance(` },
    ];

    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
  });

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Migrated Course Routes');
