/**
 * Phase 1b+: extract evaluations, finance, logs, student-training tabs.
 * Run: node scripts/extract-admin-tabs-1b-plus.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'client/src/components/AdminDashboard.jsx');
const OUT = path.join(ROOT, 'client/src/components/admin/tabs');
const SHELL = path.join(ROOT, 'client/src/components/admin/AdminLazyTabShell.jsx');

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

function writeUtf8(file, content) {
  fs.writeFileSync(file, content, { encoding: 'utf8' });
}

const evaluationsBody = slice(1787, 1868);
const financeBody = slice(1873, 2079);
// student-training tab + erForm modal (manual exam result)
const studentTrainingBody = slice(2084, 2870) + '\n\n' + slice(2874, 3011);
const logsBody = slice(3018, 3133);

const evaluationsFile = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminTab } from '../AdminTabContext';
import { AlertTriangle, ShieldAlert, MessageSquare, CheckCircle2, MessageCircle } from 'lucide-react';

export default function AdminEvaluationsTab() {
  const {
    getPrivateEvaluationsForAdmin, markEvaluationRead,
  } = useAdminTab();
  const navigate = useNavigate();

  return (
${evaluationsBody}
  );
}
`;

const financeFile = `import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  DollarSign, Download, TrendingUp, RefreshCw, CreditCard, Users,
} from 'lucide-react';
import { exportToCSV } from '../../../utils/exportExcel';

export default function AdminFinanceTab() {
  const {
    isSuperAdmin, transactions, toast, addSystemLog,
    financeStudents, isLoadingFinance, markStudentPaid, financialData,
  } = useAdminTab();

  return (
${financeBody}
  );
}
`;

const logsFile = `import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import { Lock, RefreshCw, User } from 'lucide-react';
import api from '../../../services/api';

export default function AdminLogsTab() {
  const {
    isLoadingLogs, setIsLoadingLogs, dbLogs, setDbLogs,
  } = useAdminTab();

  return (
${logsBody}
  );
}
`;

const studentTrainingFile = `import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  BookOpen, Video, Download, HelpCircle, Trophy, Plus, Clock, Trash2,
  FileSpreadsheet, Edit3, X, Upload, Loader2, FileText, Save, Search,
  CheckCircle2, XCircle, Layers,
} from 'lucide-react';
import AdminCourseBuilder from '../../AdminCourseBuilder';
import RichTextEditor from '../shared/RichTextEditor';
import { trainingUploadDisplayName } from '../utils/trainingUpload';
import {
  downloadStudentQuestionsExcelTemplate,
} from '../../../utils/studentQuestionsExcel';
import { getStudentMcQuestionsForExam } from '../../../utils/htmlContent';

export default function AdminStudentTrainingTab() {
  const {
    sCourseBuilderMode, setSCourseBuilderMode, updateStudentTrainingItem,
    studentTrainingData, sTrainingTab, setSTrainingTab, setSTrainingForm,
    students, studentQuestions, studentExamMinutes, updateStudentExamMinutes,
    showGlobalModal, resetStudentQuestions, setSqForm, BLANK_Q,
    studentQuestionsExcelInputRef, handleStudentQuestionsExcelFile,
    sTrainingForm, sTrainingFileUploading, handleTrainingDocUpload,
    addStudentTrainingItem, erSearch, setErSearch, gradingRow, setGradingRow,
    gradingValue, setGradingValue, ctxUpdateStudent, toast, addNotification,
    sqSection, setSqSection, sqSearch, setSqSearch, removeStudentQuestion,
    removeStudentTrainingItem, sqForm, updateStudentQuestion, addStudentQuestion,
    erForm, setErForm, safeStudentsList, updateExamResult, addExamResult,
  } = useAdminTab();

  return (
    <>
${studentTrainingBody}
    </>
  );
}
`;

fs.mkdirSync(OUT, { recursive: true });
writeUtf8(path.join(OUT, 'AdminEvaluationsTab.jsx'), evaluationsFile);
writeUtf8(path.join(OUT, 'AdminFinanceTab.jsx'), financeFile);
writeUtf8(path.join(OUT, 'AdminLogsTab.jsx'), logsFile);
writeUtf8(path.join(OUT, 'AdminStudentTrainingTab.jsx'), studentTrainingFile);
console.log('Wrote 4 tab files');

// ── Patch AdminDashboard: extend adminTabValue ──
let dash = fs.readFileSync(SRC, 'utf8');

const oldTabValue = `  const adminTabValue = {
    search, setSearch, filterCourse, setFilterCourse, filterPaid, setFilterPaid,
    handleExportExcel, isExportingExcel, setShowImportModal, setShowModal,
    studentsPagination, filteredStudents, safeTeachers, safeBranches,
    assignTeacher, actionMenuId, setActionMenuId, setShowStudentDetailId, setEditStudent,
    sendDebtReminder, approveStudentExam, revokeStudentExam, ctxUpdateStudent, toast,
    handlePrintInvoice, removeStudent, currentPage, setCurrentPage,
    teachers, filteredTeachers, isSuperAdmin, setShowTeacherModal, getTeacherRating,
    setReviewModal, setGrantModal, setApproveModal, setEditTeacher, handlePayTeacher,
    removeTeacher, approveTeacher, fetchTeachers, reviewModal, approveModal, markFileReviewed,
    courseBuilderMode, setCourseBuilderMode, trainingData, updateTrainingItem, trainingTab, setTrainingTab,
    trainingForm, setTrainingForm, questions, setErGvForm, BLANK_ER_GV, trainingFileUploading,
    handleTrainingDocUpload, teacherQuestionsExcelInputRef, handleTeacherQuestionsExcelFile,
    addTrainingItem, showGlobalModal, erGvSearch, setErGvSearch, erGvForm, ctxUpdateTeacher,
    qSearch, setQSearch, qSection, setQSection, qDifficulty, setQDifficulty, qSort, qForm, setQForm,
    BLANK_Q, addQuestion, updateQuestion, removeQuestion, resetQuestions,
    setTeacherExamTimeLimitMinutes, teacherExamTimeLimitMinutes, setDeleteConfirm, safeTeachersList,
  };`;

const newTabValue = `  const adminTabValue = {
    search, setSearch, filterCourse, setFilterCourse, filterPaid, setFilterPaid,
    handleExportExcel, isExportingExcel, setShowImportModal, setShowModal,
    studentsPagination, filteredStudents, safeTeachers, safeBranches,
    assignTeacher, actionMenuId, setActionMenuId, setShowStudentDetailId, setEditStudent,
    sendDebtReminder, approveStudentExam, revokeStudentExam, ctxUpdateStudent, toast,
    handlePrintInvoice, removeStudent, currentPage, setCurrentPage,
    teachers, filteredTeachers, isSuperAdmin, setShowTeacherModal, getTeacherRating,
    setReviewModal, setGrantModal, setApproveModal, setEditTeacher, handlePayTeacher,
    removeTeacher, approveTeacher, fetchTeachers, reviewModal, approveModal, markFileReviewed,
    courseBuilderMode, setCourseBuilderMode, trainingData, updateTrainingItem, trainingTab, setTrainingTab,
    trainingForm, setTrainingForm, questions, setErGvForm, BLANK_ER_GV, trainingFileUploading,
    handleTrainingDocUpload, teacherQuestionsExcelInputRef, handleTeacherQuestionsExcelFile,
    addTrainingItem, showGlobalModal, erGvSearch, setErGvSearch, erGvForm, ctxUpdateTeacher,
    qSearch, setQSearch, qSection, setQSection, qDifficulty, setQDifficulty, qSort, qForm, setQForm,
    BLANK_Q, addQuestion, updateQuestion, removeQuestion, resetQuestions,
    setTeacherExamTimeLimitMinutes, teacherExamTimeLimitMinutes, setDeleteConfirm, safeTeachersList,
    // evaluations
    getPrivateEvaluationsForAdmin, markEvaluationRead,
    // finance
    transactions, addSystemLog, financeStudents, isLoadingFinance, markStudentPaid, financialData,
    // logs
    isLoadingLogs, setIsLoadingLogs, dbLogs, setDbLogs,
    // student-training
    sCourseBuilderMode, setSCourseBuilderMode, updateStudentTrainingItem,
    studentTrainingData, sTrainingTab, setSTrainingTab, setSTrainingForm,
    students, studentQuestions, studentExamMinutes, updateStudentExamMinutes,
    resetStudentQuestions, setSqForm, studentQuestionsExcelInputRef, handleStudentQuestionsExcelFile,
    sTrainingForm, sTrainingFileUploading, addStudentTrainingItem,
    erSearch, setErSearch, gradingRow, setGradingRow, gradingValue, setGradingValue,
    addNotification, sqSection, setSqSection, sqSearch, setSqSearch, removeStudentQuestion,
    removeStudentTrainingItem, sqForm, updateStudentQuestion, addStudentQuestion,
    erForm, setErForm, safeStudentsList, updateExamResult, addExamResult,
  };`;

if (!dash.includes(oldTabValue)) {
  console.error('adminTabValue block not found — abort patch');
  process.exit(1);
}
dash = dash.replace(oldTabValue, newTabValue);

// Update imports for lazy shell
const oldImport = `import { AdminLazyStudentsTab, AdminLazyTeachersTab, AdminLazyTrainingTab } from './admin/AdminLazyTabShell';`;
const newImport = `import {
  AdminLazyStudentsTab,
  AdminLazyTeachersTab,
  AdminLazyTrainingTab,
  AdminLazyEvaluationsTab,
  AdminLazyFinanceTab,
  AdminLazyLogsTab,
  AdminLazyStudentTrainingTab,
} from './admin/AdminLazyTabShell';`;

if (!dash.includes('AdminLazyEvaluationsTab')) {
  if (!dash.includes(oldImport)) {
    console.error('lazy import line not found');
    process.exit(1);
  }
  dash = dash.replace(oldImport, newImport);
}

// Replace tab blocks with lazy components.
// Use markers unique to each section.
function replaceBetween(src, startMarker, endMarker, replacement) {
  const start = src.indexOf(startMarker);
  if (start < 0) throw new Error('start marker not found: ' + startMarker.slice(0, 60));
  const end = src.indexOf(endMarker, start);
  if (end < 0) throw new Error('end marker not found after: ' + startMarker.slice(0, 60));
  return src.slice(0, start) + replacement + src.slice(end);
}

dash = replaceBetween(
  dash,
  `          {/* ===== TAB: ĐÁNH GIÁ NỘI BỘ (Chỉ Admin) ===== */}
          {activeTab === 'evaluations' && (`,
  `          {/* ===== TAB: TÀI CHÍNH ===== */}
          {activeTab === 'finance' && (`,
  `          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}

`
);

dash = replaceBetween(
  dash,
  `          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}

          {/* ===== TAB: TÀI CHÍNH ===== */}
          {activeTab === 'finance' && (`,
  `          {/* ===== ĐÀO TẠO HỌC VIÊN ===== */}
          {activeTab === 'student-training' && (`,
  `          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}
          {activeTab === 'finance' && <AdminLazyFinanceTab />}

`
);

// After finance replace, student-training + erForm + logs still inline.
// student-training starts at marker, erForm is between student-training and logs.
dash = replaceBetween(
  dash,
  `          {activeTab === 'finance' && <AdminLazyFinanceTab />}

          {/* ===== ĐÀO TẠO HỌC VIÊN ===== */}
          {activeTab === 'student-training' && (`,
  `          {/* ===== TAB: NHẬT KÝ HỆ THỐNG (Enhanced) ===== */}
          {activeTab === 'logs' && (`,
  `          {activeTab === 'finance' && <AdminLazyFinanceTab />}
          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}

`
);

dash = replaceBetween(
  dash,
  `          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}

          {/* ===== TAB: NHẬT KÝ HỆ THỐNG (Enhanced) ===== */}
          {activeTab === 'logs' && (`,
  `          {/* ===== TAB: CÀI ĐẶT HỆ THỐNG ===== */}
          {activeTab === 'settings' && (`,
  `          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}
          {activeTab === 'logs' && <AdminLazyLogsTab />}

`
);

writeUtf8(SRC, dash);
console.log('Patched AdminDashboard.jsx');

// ── Patch AdminLazyTabShell ──
let shell = fs.readFileSync(SHELL, 'utf8');
if (!shell.includes('AdminEvaluationsTab')) {
  shell = shell.replace(
    `const LazyTrainingTab = lazy(() => import('./tabs/AdminTrainingTab'));`,
    `const LazyTrainingTab = lazy(() => import('./tabs/AdminTrainingTab'));
const LazyEvaluationsTab = lazy(() => import('./tabs/AdminEvaluationsTab'));
const LazyFinanceTab = lazy(() => import('./tabs/AdminFinanceTab'));
const LazyLogsTab = lazy(() => import('./tabs/AdminLogsTab'));
const LazyStudentTrainingTab = lazy(() => import('./tabs/AdminStudentTrainingTab'));`
  );
  shell = shell.replace(
    `export function AdminLazyTrainingTab() {
  return <LazyAdminTab Component={LazyTrainingTab} />;
}
`,
    `export function AdminLazyTrainingTab() {
  return <LazyAdminTab Component={LazyTrainingTab} />;
}

export function AdminLazyEvaluationsTab() {
  return <LazyAdminTab Component={LazyEvaluationsTab} />;
}

export function AdminLazyFinanceTab() {
  return <LazyAdminTab Component={LazyFinanceTab} />;
}

export function AdminLazyLogsTab() {
  return <LazyAdminTab Component={LazyLogsTab} />;
}

export function AdminLazyStudentTrainingTab() {
  return <LazyAdminTab Component={LazyStudentTrainingTab} />;
}
`
  );
  writeUtf8(SHELL, shell);
  console.log('Patched AdminLazyTabShell.jsx');
}

// Verify no leftover activeTab blocks for extracted tabs
const verify = fs.readFileSync(SRC, 'utf8');
for (const tab of ['evaluations', 'finance', 'student-training', 'logs']) {
  const inline = verify.includes(`activeTab === '${tab}' && (`);
  const lazy = verify.includes(`activeTab === '${tab}' && <AdminLazy`);
  console.log(`${tab}: inline=${inline} lazy=${lazy}`);
}
