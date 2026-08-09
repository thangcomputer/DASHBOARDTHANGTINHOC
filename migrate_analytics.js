const fs = require('fs');
const path = require('path');

function migrateAnalyticsRoutes() {
  const filePath = path.join(__dirname, 'modules/analytics/routes/analyticsRoutes.js');
  let content = fs.readFileSync(filePath, 'utf8');
  
  const replacements = [
    { from: /Student\.countDocuments\(/g, to: 'studentRepository.count(' },
    { from: /Student\.find\(/g, to: 'studentRepository.findMany(' },
    { from: /Schedule\.countDocuments\(/g, to: 'scheduleRepository.count(' },
    { from: /Branch\.find\(/g, to: 'branchRepository.findMany(' },
    { from: /Student\.aggregate\(/g, to: 'studentRepository.aggregate(' },
  ];

  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });

  fs.writeFileSync(filePath, content, 'utf8');
}

migrateAnalyticsRoutes();
console.log('Migrated Analytics Routes');
