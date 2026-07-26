const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'client', 'src', 'components', 'admin', 'tabs', 'AdminTrainingTab.jsx');
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('TeacherQuestionBankPanel')) {
  s = s.replace(
    "import AdminCourseBuilder from '../../AdminCourseBuilder';",
    "import AdminCourseBuilder from '../../AdminCourseBuilder';\nimport TeacherQuestionBankPanel from './TeacherQuestionBankPanel';",
  );
}

const start = s.indexOf("                  {trainingTab === 'questions' ? (");
const end = s.indexOf('                  ) : (', start);
if (start < 0 || end < 0) {
  console.error('markers not found', start, end);
  process.exit(1);
}
s = s.slice(0, start) + s.slice(end + '                  ) : ('.length);

s = s.replace(
  "{trainingTab !== 'exam-results-gv' && (",
  "{trainingTab === 'questions' && (\n                <TeacherQuestionBankPanel />\n              )}\n              {trainingTab !== 'exam-results-gv' && trainingTab !== 'questions' && (",
);

fs.writeFileSync(p, s, 'utf8');
console.log('patched AdminTrainingTab');
