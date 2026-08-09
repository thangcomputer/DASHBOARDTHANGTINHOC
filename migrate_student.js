const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules/student/routes/studentRoutes.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace imports
content = content.replace(
  "const Student = require('../models/Student');",
  "const { studentRepository } = require('../repositories');"
);

const replacements = [
  { from: /Student\.countDocuments\(/g, to: 'studentRepository.count(' },
  { from: /Student\.find\(/g, to: 'studentRepository.findMany(' },
  { from: /Student\.findById\(/g, to: 'studentRepository.findById(' },
  { from: /Student\.aggregate\(/g, to: 'studentRepository.aggregate(' },
  { from: /Student\.insertMany\(/g, to: 'studentRepository.insertMany(' },
  { from: /Student\.findByIdAndUpdate\(/g, to: 'studentRepository.updateById(' },
  { from: /Student\.findOneAndUpdate\(/g, to: 'studentRepository.updateOne(' },
  { from: /Student\.findByIdAndDelete\(/g, to: 'studentRepository.deleteById(' },
  { from: /new Student\(/g, to: 'studentRepository.createInstance(' },
  { from: /\.save\(/g, to: '.save(' } // Just ensuring we remember that save is on the doc
];

replacements.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Migrated Student');
