const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules/enrollment/services/enrollmentService.js');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "const Course = require('../../course/models/Course');",
  "const { courseRepository } = require('../../course/repositories');"
);
content = content.replace(
  "course = await Course.findById(courseId).lean();",
  "course = await courseRepository.findById(courseId);"
);
content = content.replace(
  "course = await Course.findOne({ name: new RegExp(`^\\$\\{escaped\\}\\$`, 'i') }).lean();",
  "course = await courseRepository.findOne({ name: new RegExp(`^\\$\\{escaped\\}\\$`, 'i') });"
);

content = content.replace(
  "const Teacher = require('../../teacher/models/Teacher');",
  "const { teacherRepository } = require('../../teacher/repositories');"
);
content = content.replace(
  "const rows = await Teacher.find({ _id: { $in: missingNameIds } }).select('name').lean();",
  "const rows = await teacherRepository.findMany({ _id: { $in: missingNameIds } }, { select: 'name' });"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Migrated enrollmentService.js');
