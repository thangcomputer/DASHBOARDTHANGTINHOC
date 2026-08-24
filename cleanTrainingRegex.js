const fs = require('fs');
const p = 'd:/web/WEB TỔNG HỢP/DASHBOARDTHANGTINHOC/client/src/components/admin/hooks/useAdminDashboardState.jsx';
let content = fs.readFileSync(p, 'utf8');

const regexToRemove = [
  /trainingData,[\s\S]*?removeStudentTrainingItem,/g,
  /questions,[\s\S]*?resetQuestions,/g,
  /replaceTeacherQuestionsForSubject,/g,
  /teacherExamTimeLimitMinutes,[\s\S]*?setTeacherExamTimeLimitMinutes,/g,
  /studentQuestions,[\s\S]*?resetStudentQuestions,/g,
  /studentExamMinutes,[\s\S]*?updateStudentExamMinutes,/g,
  /studentExamFiles,[\s\S]*?setStudentExamFile,/g,
  /addExamResult,[\s\S]*?updateExamResult,/g,
  /examSubjectsCatalog,/g,
  /const \[trainingTab[\s\S]*?const \[deleteConfirm, setDeleteConfirm\] = useState\(null\);/g,
  /const \[sTrainingTab[\s\S]*?extToTrainingFileType\(file\.name\),/g,
  /fileSize: formatTrainingFileSize\(file\.size\),[\s\S]*?setBusy\(false\);\s+\}\s+\};/g,
  /const BLANK_Q =[\s\S]*?const confirmDelete = async \(\) => \{/g
];

// Wait, doing this via regex might be too dangerous.
// Let's use string replacements for specific parts.
