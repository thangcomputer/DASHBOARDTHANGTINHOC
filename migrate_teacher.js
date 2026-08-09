const fs = require('fs');
const path = require('path');

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace imports
  content = content.replace(
    "const Teacher = require('../models/Teacher');",
    "const { teacherRepository } = require('../repositories');\nconst Teacher = require('../models/Teacher'); // Temp for new Teacher"
  );
  
  content = content.replace(
    "const Teacher  = require('../models/Teacher');",
    "const { teacherRepository } = require('../repositories');\nconst Teacher = require('../models/Teacher'); // Temp for new Teacher"
  );

  const replacements = [
    { from: /Teacher\.countDocuments\(/g, to: 'teacherRepository.count(' },
    { from: /Teacher\.find\(/g, to: 'teacherRepository.findMany(' },
    { from: /Teacher\.findById\(/g, to: 'teacherRepository.findById(' },
    { from: /Teacher\.findOne\(/g, to: 'teacherRepository.findOne(' },
    { from: /Teacher\.aggregate\(/g, to: 'teacherRepository.aggregate(' },
    { from: /Teacher\.create\(/g, to: 'teacherRepository.create(' },
    { from: /Teacher\.insertMany\(/g, to: 'teacherRepository.insertMany(' },
    { from: /Teacher\.findByIdAndUpdate\(/g, to: 'teacherRepository.updateById(' },
    { from: /Teacher\.findOneAndUpdate\(/g, to: 'teacherRepository.updateOne(' },
    { from: /Teacher\.findByIdAndDelete\(/g, to: 'teacherRepository.deleteById(' },
    { from: /new Teacher\(/g, to: 'teacherRepository.createInstance(' },
  ];

  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });

  fs.writeFileSync(filePath, content, 'utf8');
}

migrateFile(path.join(__dirname, 'modules/teacher/routes/teacherRoutes.js'));
migrateFile(path.join(__dirname, 'modules/teacher/routes/staffRoutes.js'));
console.log('Migrated Teacher');
