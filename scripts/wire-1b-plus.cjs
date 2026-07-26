const fs = require('fs');
const SRC = 'client/src/components/AdminDashboard.jsx';
const SHELL = 'client/src/components/admin/AdminLazyTabShell.jsx';
let dash = fs.readFileSync(SRC, 'utf8');
const nl = dash.includes('\r\n') ? '\r\n' : '\n';

const marker = '    setTeacherExamTimeLimitMinutes, teacherExamTimeLimitMinutes, setDeleteConfirm, safeTeachersList,';
if (!dash.includes(marker)) { console.error('marker missing'); process.exit(1); }
if (!dash.includes('getPrivateEvaluationsForAdmin, markEvaluationRead,')) {
  const extra = [
    '    // evaluations',
    '    getPrivateEvaluationsForAdmin, markEvaluationRead,',
    '    // finance',
    '    transactions, addSystemLog, financeStudents, isLoadingFinance, markStudentPaid, financialData,',
    '    // logs',
    '    isLoadingLogs, setIsLoadingLogs, dbLogs, setDbLogs,',
    '    // student-training',
    '    sCourseBuilderMode, setSCourseBuilderMode, updateStudentTrainingItem,',
    '    studentTrainingData, sTrainingTab, setSTrainingTab, setSTrainingForm,',
    '    students, studentQuestions, studentExamMinutes, updateStudentExamMinutes,',
    '    resetStudentQuestions, setSqForm, studentQuestionsExcelInputRef, handleStudentQuestionsExcelFile,',
    '    sTrainingForm, sTrainingFileUploading, addStudentTrainingItem,',
    '    erSearch, setErSearch, gradingRow, setGradingRow, gradingValue, setGradingValue,',
    '    addNotification, sqSection, setSqSection, sqSearch, setSqSearch, removeStudentQuestion,',
    '    removeStudentTrainingItem, sqForm, updateStudentQuestion, addStudentQuestion,',
    '    erForm, setErForm, safeStudentsList, updateExamResult, addExamResult,',
  ].join(nl);
  dash = dash.replace(marker, marker + nl + extra);
  console.log('extended adminTabValue');
}

const oldImp = "import { AdminLazyStudentsTab, AdminLazyTeachersTab, AdminLazyTrainingTab } from './admin/AdminLazyTabShell';";
const newImp = [
  'import {',
  '  AdminLazyStudentsTab,',
  '  AdminLazyTeachersTab,',
  '  AdminLazyTrainingTab,',
  '  AdminLazyEvaluationsTab,',
  '  AdminLazyFinanceTab,',
  '  AdminLazyLogsTab,',
  '  AdminLazyStudentTrainingTab,',
  "} from './admin/AdminLazyTabShell';",
].join(nl);
if (!dash.includes('AdminLazyEvaluationsTab')) {
  if (!dash.includes(oldImp)) { console.error('import missing'); process.exit(1); }
  dash = dash.replace(oldImp, newImp);
  console.log('updated imports');
}

function replaceBetween(src, startMarker, endMarker, replacement) {
  const start = src.indexOf(startMarker);
  if (start < 0) throw new Error('start not found: ' + JSON.stringify(startMarker.slice(0, 80)));
  const end = src.indexOf(endMarker, start);
  if (end < 0) throw new Error('end not found after: ' + JSON.stringify(startMarker.slice(0, 80)));
  return src.slice(0, start) + replacement + src.slice(end);
}

if (dash.includes("activeTab === 'evaluations' && (")) {
  dash = replaceBetween(
    dash,
    '          {/* ===== TAB: ĐÁNH GIÁ NỘI BỘ (Chỉ Admin) ===== */}' + nl + "          {activeTab === 'evaluations' && (",
    '          {/* ===== TAB: TÀI CHÍNH ===== */}' + nl + "          {activeTab === 'finance' && (",
    "          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}" + nl + nl
  );
  console.log('wired evaluations');
}

if (dash.includes("activeTab === 'finance' && (")) {
  dash = replaceBetween(
    dash,
    "          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}" + nl + nl +
    '          {/* ===== TAB: TÀI CHÍNH ===== */}' + nl + "          {activeTab === 'finance' && (",
    '          {/* ===== ĐÀO TẠO HỌC VIÊN ===== */}' + nl + "          {activeTab === 'student-training' && (",
    "          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}" + nl +
    "          {activeTab === 'finance' && <AdminLazyFinanceTab />}" + nl + nl
  );
  console.log('wired finance');
}

if (dash.includes("activeTab === 'student-training' && (")) {
  dash = replaceBetween(
    dash,
    "          {activeTab === 'finance' && <AdminLazyFinanceTab />}" + nl + nl +
    '          {/* ===== ĐÀO TẠO HỌC VIÊN ===== */}' + nl + "          {activeTab === 'student-training' && (",
    '          {/* ===== TAB: NHẬT KÝ HỆ THỐNG (Enhanced) ===== */}' + nl + "          {activeTab === 'logs' && (",
    "          {activeTab === 'finance' && <AdminLazyFinanceTab />}" + nl +
    "          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}" + nl + nl
  );
  console.log('wired student-training');
}

if (dash.includes("activeTab === 'logs' && (")) {
  dash = replaceBetween(
    dash,
    "          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}" + nl + nl +
    '          {/* ===== TAB: NHẬT KÝ HỆ THỐNG (Enhanced) ===== */}' + nl + "          {activeTab === 'logs' && (",
    '          {/* ===== TAB: CÀI ĐẶT HỆ THỐNG ===== */}' + nl + "          {activeTab === 'settings' && (",
    "          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}" + nl +
    "          {activeTab === 'logs' && <AdminLazyLogsTab />}" + nl + nl
  );
  console.log('wired logs');
}

fs.writeFileSync(SRC, dash, 'utf8');

let shell = fs.readFileSync(SHELL, 'utf8');
if (!shell.includes('AdminEvaluationsTab')) {
  const shellNl = shell.includes('\r\n') ? '\r\n' : '\n';
  shell = shell.replace(
    "const LazyTrainingTab = lazy(() => import('./tabs/AdminTrainingTab'));",
    [
      "const LazyTrainingTab = lazy(() => import('./tabs/AdminTrainingTab'));",
      "const LazyEvaluationsTab = lazy(() => import('./tabs/AdminEvaluationsTab'));",
      "const LazyFinanceTab = lazy(() => import('./tabs/AdminFinanceTab'));",
      "const LazyLogsTab = lazy(() => import('./tabs/AdminLogsTab'));",
      "const LazyStudentTrainingTab = lazy(() => import('./tabs/AdminStudentTrainingTab'));",
    ].join(shellNl)
  );
  const trainFn = [
    'export function AdminLazyTrainingTab() {',
    '  return <LazyAdminTab Component={LazyTrainingTab} />;',
    '}',
    '',
  ].join(shellNl);
  const extraFns = [
    'export function AdminLazyTrainingTab() {',
    '  return <LazyAdminTab Component={LazyTrainingTab} />;',
    '}',
    '',
    'export function AdminLazyEvaluationsTab() {',
    '  return <LazyAdminTab Component={LazyEvaluationsTab} />;',
    '}',
    '',
    'export function AdminLazyFinanceTab() {',
    '  return <LazyAdminTab Component={LazyFinanceTab} />;',
    '}',
    '',
    'export function AdminLazyLogsTab() {',
    '  return <LazyAdminTab Component={LazyLogsTab} />;',
    '}',
    '',
    'export function AdminLazyStudentTrainingTab() {',
    '  return <LazyAdminTab Component={LazyStudentTrainingTab} />;',
    '}',
    '',
  ].join(shellNl);
  if (!shell.includes(trainFn)) {
    console.error('trainFn not found in shell');
    process.exit(1);
  }
  shell = shell.replace(trainFn, extraFns);
  fs.writeFileSync(SHELL, shell, 'utf8');
  console.log('patched shell');
}

const verify = fs.readFileSync(SRC, 'utf8');
for (const tab of ['evaluations', 'finance', 'student-training', 'logs']) {
  console.log(tab, 'inline=', verify.includes("activeTab === '" + tab + "' && ("), 'lazy=', verify.includes("activeTab === '" + tab + "' && <AdminLazy"));
}