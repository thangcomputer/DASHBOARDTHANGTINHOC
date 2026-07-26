const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'client', 'src', 'components', 'admin', 'tabs', 'StudentQuestionBankPanel.jsx'),
  'utf8',
);

const out = src
  .replace(/StudentQuestionBankPanel/g, 'TeacherQuestionBankPanel')
  .replace(/studentQuestions/g, 'questions')
  .replace(/studentExamMinutes/g, 'teacherExamMinutes')
  .replace(/studentEssayExamMinutes/g, 'teacherEssayExamMinutes')
  .replace(/updateStudentExamMinutes/g, 'updateTeacherExamMinutes')
  .replace(/updateStudentEssayExamMinutes/g, 'updateTeacherEssayExamMinutes')
  .replace(/addStudentQuestion/g, 'addQuestion')
  .replace(/updateStudentQuestion/g, 'updateQuestion')
  .replace(/removeStudentQuestion/g, 'removeQuestion')
  .replace(/resetStudentQuestions/g, 'resetQuestions')
  .replace(/sqForm/g, 'qForm')
  .replace(/setSqForm/g, 'setQForm')
  .replace(/sqSection/g, 'qSection')
  .replace(/setSqSection/g, 'setQSection')
  .replace(/studentQuestionsExcelInputRef/g, 'teacherQuestionsExcelInputRef')
  .replace(/handleStudentQuestionsExcelFile/g, 'handleTeacherQuestionsExcelFile')
  .replace(/downloadStudentQuestionsExcelTemplate/g, 'downloadTeacherQuestionsExcelTemplate')
  .replace(/getExamSubjectOptions/g, 'getTeacherSectionOptions')
  .replace(/examSubjectsCatalog/g, 'teacherSectionCatalog')
  .replace(
    "import { getExamSubjectOptions } from '../../../utils/examSubjects';",
    "import { getTeacherSectionOptions } from '../../../utils/teacherExamSections';",
  )
  .replace(/updateStudentExamConfig/g, 'updateTeacherExamConfig')
  .replace(/studentExamFiles/g, 'teacherExamFilesUnused')
  .replace(/teacherExamFilesUnused,\n/g, '')
  .replace(/from '\.\.\/\.\.\/\.\.\/utils\/questionsExcel'/g, "from '../../../utils/studentQuestionsExcel'")
  .replace(/học viên/g, 'giảng viên')
  .replace(/Môn thi/g, 'Phần thi')
  .replace(/border-green-200/g, 'border-red-200')
  .replace(/text-green-900/g, 'text-red-900')
  .replace(/bg-green-50\/40/g, 'bg-red-50/40')
  .replace(/focus:border-green-500/g, 'focus:border-red-500')
  .replace(/activeSubject\?\.label/g, 'activeSection?.label')
  .replace(/activeSubject/g, 'activeSection')
  .replace(/subjectOpts/g, 'sectionOpts')
  .replace(
    /const teacherSectionCatalog = sectionOpts;/,
    '',
  )
  .replace(
    `  const sectionOpts = React.useMemo(
    () => getTeacherSectionOptions(teacherSectionCatalog),
    [teacherSectionCatalog],
  );`,
    `  const sectionOpts = React.useMemo(() => getTeacherSectionOptions(), []);`,
  );

// Fix accidental replacements in comments/strings if any - remove teacherExamFilesUnused from save
const fixed = out.replace(
  /await api\.settings\.updateTeacherExamConfig\(\{[\s\S]*?\}\);/,
  `await api.settings.updateTeacherExamConfig({
        questions: nextQuestions,
        teacherExamMinutes,
        teacherEssayExamMinutes,
      });`,
);

fs.writeFileSync(
  path.join(__dirname, '..', 'client', 'src', 'utils', 'teacherExamSections.js'),
  `export const TEACHER_EXAM_SECTIONS = [
  { id: 'excel', label: 'Excel' },
  { id: 'word', label: 'Word' },
  { id: 'powerpoint', label: 'PowerPoint' },
  { id: 'computer', label: 'M\\u00e1y t\\u00ednh & Windows' },
  { id: 'situation', label: 'T\\u00ecnh Hu\\u1ed1ng S\\u01b0 Ph\\u1ea1m' },
  { id: 'other', label: 'Ki\\u1ebfn th\\u1ee9c Kh\\u00e1c' },
];

export const DEFAULT_TEACHER_EXAM_MINUTES = Object.fromEntries(
  TEACHER_EXAM_SECTIONS.map((s) => [s.id, 90]),
);

export const DEFAULT_TEACHER_ESSAY_EXAM_MINUTES = Object.fromEntries(
  TEACHER_EXAM_SECTIONS.map((s) => [s.id, 60]),
);

export function getTeacherSectionOptions() {
  return TEACHER_EXAM_SECTIONS;
}
`,
  'utf8',
);

fs.writeFileSync(
  path.join(__dirname, '..', 'client', 'src', 'components', 'admin', 'tabs', 'TeacherQuestionBankPanel.jsx'),
  fixed,
  'utf8',
);

console.log('Wrote TeacherQuestionBankPanel.jsx');
