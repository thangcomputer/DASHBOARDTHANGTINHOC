const fs = require('fs');
const path = 'client/src/context/DataContext.jsx';
let s = fs.readFileSync(path, 'utf8');

// 1) Imports
if (!s.includes("from './useDataTraining'")) {
  s = s.replace(
    "import { useSocket } from './SocketContext';\n",
    "import { buildConversationId } from '../utils/chatConversationId';\n" +
      "import { useSocket } from './SocketContext';\n" +
      "import { loadState, applyDataVersionReset } from './dataStorage';\n" +
      "import { useDataTraining } from './useDataTraining';\n\n" +
      "export { buildConversationId } from '../utils/chatConversationId';\n",
  );
  console.log('imports updated');
}

// 2) Remove inline buildConversationId (from comment or export function)
const bStart = s.indexOf('/** Đồng bộ với server utils/chatConversationId.js');
const bStart2 = s.indexOf('export function buildConversationId');
const start = bStart >= 0 ? bStart : bStart2;
const afterBuild = s.indexOf('\n// ═══════════════════════════════════════════════════════════════════════════════\n// DỮ LIỆU GỐC');
if (start >= 0 && afterBuild > start) {
  s = s.slice(0, start) + s.slice(afterBuild);
  console.log('removed buildConversationId');
}

// 3) Remove DATA_VERSION + loadState helpers
const resetComment = s.indexOf('// ── One-time Reset:');
const providerStart = s.indexOf('export const DataProvider');
if (resetComment >= 0 && providerStart > resetComment) {
  s = s.slice(0, resetComment) + s.slice(providerStart);
  console.log('removed storage helpers');
}

// 4) Version reset effect
s = s.replace(
  /\/\/ One-time reset local caches when schema\/version changes\n  useEffect\(\(\) => \{\n    try \{\n      const vKey = 'thvp_data_version';\n      const prev = localStorage\.getItem\(vKey\);\n      if \(prev !== DATA_VERSION\) \{[\s\S]*?localStorage\.setItem\(vKey, DATA_VERSION\);\n      \}\n    \} catch \(e\) \{\}\n  \}, \[\]\);/,
  `// One-time reset local caches when schema/version changes\n  useEffect(() => {\n    applyDataVersionReset();\n  }, []);`,
);

// 5) Replace training block with hook
const trainingOnlyStart = s.indexOf('  // ── TRAINING DATA');
const socketStart = s.indexOf('  // ── SOCKET LISTENERS');
if (trainingOnlyStart < 0 || socketStart < 0) {
  console.error('train/socket markers', trainingOnlyStart, socketStart);
  process.exit(1);
}

const insertHook = `  const {
    trainingData, setTrainingData,
    studentTrainingData, setStudentTrainingData,
    questions, setQuestions,
    teacherExamTimeLimitMinutes, setTeacherExamTimeLimitMinutes,
    studentQuestions, setStudentQuestions,
    studentExamMinutes, updateStudentExamMinutes,
    applyStudentExamConfigFromServer,
    addStudentTrainingItem, updateStudentTrainingItem, removeStudentTrainingItem,
    addTrainingItem, updateTrainingItem, removeTrainingItem,
    addQuestion, addQuestionsBulk, updateQuestion, removeQuestion, resetQuestions,
    addStudentQuestion, addStudentQuestionsBulk, updateStudentQuestion,
    removeStudentQuestion, resetStudentQuestions, copyTeacherQuestionBankToStudents,
  } = useDataTraining(currentUser);

`;

s = s.slice(0, trainingOnlyStart) + insertHook + s.slice(socketStart);
console.log('inserted useDataTraining');

// 6) Remove training persist effects
const persistRemovals = [
  /  useEffect\(\(\) => \{ localStorage\.setItem\('thvp_trainingData', JSON\.stringify\(trainingData\)\); \}, \[trainingData\]\);\r?\n/,
  /  useEffect\(\(\) => \{ localStorage\.setItem\('thvp_studentTrainingData', JSON\.stringify\(studentTrainingData\)\); \}, \[studentTrainingData\]\);\r?\n/,
  /  useEffect\(\(\) => \{ localStorage\.setItem\('thvp_questions', JSON\.stringify\(questions\)\); \}, \[questions\]\);\r?\n/,
  /  useEffect\(\(\) => \{\r?\n    localStorage\.setItem\(TEACHER_EXAM_TIME_LIMIT_KEY, JSON\.stringify\(teacherExamTimeLimitMinutes\)\);\r?\n  \}, \[teacherExamTimeLimitMinutes\]\);\r?\n/,
  /  useEffect\(\(\) => \{ localStorage\.setItem\('thvp_studentQuestions', JSON\.stringify\(studentQuestions\)\); \}, \[studentQuestions\]\);\r?\n/,
  /  useEffect\(\(\) => \{ localStorage\.setItem\(STUDENT_EXAM_MINUTES_KEY, JSON\.stringify\(studentExamMinutes\)\); \}, \[studentExamMinutes\]\);\r?\n/,
];
for (const re of persistRemovals) s = s.replace(re, '');

// 7) Remove training CRUD (now in hook)
const crudStart = s.indexOf('  const addStudentTrainingItem = useCallback');
const sysLogStart = s.indexOf('  const addSystemLog = useCallback');
if (crudStart > 0 && sysLogStart > crudStart) {
  s = s.slice(0, crudStart) + s.slice(sysLogStart);
  console.log('removed training CRUD');
}

fs.writeFileSync(path, s, 'utf8');
console.log('done, lines=', s.split(/\n/).length);
