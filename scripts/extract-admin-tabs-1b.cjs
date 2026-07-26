/**
 * One-time helper: extract tab JSX from AdminDashboard.jsx into tab components.
 * Run: node scripts/extract-admin-tabs-1b.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'client/src/components/AdminDashboard.jsx');
const OUT = path.join(ROOT, 'client/src/components/admin/tabs');

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const STUDENTS_BODY = slice(1851, 2139);
const TEACHERS_BODY = slice(2144, 2397) + '\n\n' + slice(2400, 2525);
const TRAINING_BODY = slice(2826, 3578);

const COMMON_IMPORTS = `import React from 'react';
import { useAdminTab } from '../AdminTabContext';
`;

const studentsImports = `${COMMON_IMPORTS}import {
  BookOpen, Search, Download, FileSpreadsheet, Plus, Users, CheckCircle2, AlertTriangle,
  MoreHorizontal, ClipboardList, Edit3, Bell, Unlock, Lock, Camera, Printer, Trash2,
  ChevronLeft, ChevronRight, Loader2, MapPin,
} from 'lucide-react';
import Avatar from '../shared/Avatar';
`;

const teachersImports = `${COMMON_IMPORTS}import {
  GraduationCap, Search, Plus, Star, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Download, Clock, XCircle, Lock, Unlock, UserCheck, DollarSign, Edit3, Trash2, User,
  Phone, CalendarCheck, MessageSquare,
} from 'lucide-react';
import Avatar from '../shared/Avatar';
import { resolveTeacherExamDate, isTeacherExamDateApproximate } from '../utils/teacherExam';
import { isTeacherPending } from '../../../constants/teacherStatus';
`;

const trainingImports = `${COMMON_IMPORTS}import {
  BookOpen, Video, FileText, Download, ClipboardList, Trophy, Plus, HelpCircle,
  Edit3, Trash2, Save, Upload, Loader2, Star, CheckCircle2, X, PlayCircle,
} from 'lucide-react';
import AdminCourseBuilder from '../../AdminCourseBuilder';
import RichTextEditor from '../shared/RichTextEditor';
import { resolveTeacherExamDate } from '../utils/teacherExam';
import { trainingUploadDisplayName } from '../utils/trainingUpload';
import {
  downloadTeacherQuestionsExcelTemplate,
  parseQuestionBankExcel,
} from '../../../utils/studentQuestionsExcel';
import { applyAnchorNewTabPolicy } from '../../../utils/htmlContent';
`;

function wrap(name, imports, body, extraHooks = '') {
  return `${imports}
export default function ${name}() {
  const t = useAdminTab();
${extraHooks}
  return (
${body}
  );
}
`;
}

const wireOnly = process.argv.includes('--wire-only');

if (!wireOnly) {
fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(
  path.join(OUT, 'AdminStudentsTab.jsx'),
  wrap('AdminStudentsTab', studentsImports, STUDENTS_BODY),
  'utf8'
);

fs.writeFileSync(
  path.join(OUT, 'AdminTeachersTab.jsx'),
  wrap('AdminTeachersTab', teachersImports, TEACHERS_BODY),
  'utf8'
);

fs.writeFileSync(
  path.join(OUT, 'AdminTrainingTab.jsx'),
  wrap('AdminTrainingTab', trainingImports, TRAINING_BODY, '  const RichTextEditor = t.RichTextEditor;'),
  'utf8'
);

console.log('Extracted AdminStudentsTab, AdminTeachersTab, AdminTrainingTab');
}

// ── Phase 1b wire: shared utils, RichTextEditor, patch AdminDashboard ──
const SHARED = path.join(ROOT, 'client/src/components/admin/shared');
const UTILS = path.join(ROOT, 'client/src/components/admin/utils');
fs.mkdirSync(SHARED, { recursive: true });
fs.mkdirSync(UTILS, { recursive: true });

const teacherExamJs = `export function resolveTeacherExamDate(t) {
  if (!t) return null;
  if (t.testDate) {
    const d = new Date(t.testDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const attempted =
    t.testStatus === 'passed' ||
    t.testStatus === 'failed' ||
    Number(t.testScore) > 0 ||
    (String(t.status) === 'Locked' && t.lockReason);
  if (attempted && t.updatedAt) {
    const d = new Date(t.updatedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function isTeacherExamDateApproximate(t) {
  return !t?.testDate && resolveTeacherExamDate(t) != null;
}
`;
fs.writeFileSync(path.join(UTILS, 'teacherExam.js'), teacherExamJs, 'utf8');

const dashLines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const rteBody = dashLines.slice(46, 249).join('\n').replace('const RichTextEditor', 'export default function RichTextEditor');
const rteFile = [
  "import React from 'react';",
  "import { applyAnchorNewTabPolicy } from '../../../utils/htmlContent';",
  '',
  rteBody,
  '',
].join('\n');
fs.writeFileSync(path.join(SHARED, 'RichTextEditor.jsx'), rteFile, 'utf8');

let dash = fs.readFileSync(SRC, 'utf8');
dash = dash.replace(
  /\/\/ ─── RICH TEXT EDITOR[\s\S]*?^function trainingUploadDisplayName[\s\S]*?^}\r?\n\r?\n/m,
  ''
);

const newImports = `import RichTextEditor from './admin/shared/RichTextEditor';
import { resolveTeacherExamDate, isTeacherExamDateApproximate } from './admin/utils/teacherExam';
import { trainingUploadDisplayName } from './admin/utils/trainingUpload';
import { AdminTabProvider } from './admin/AdminTabContext';
import { AdminLazyStudentsTab, AdminLazyTeachersTab, AdminLazyTrainingTab } from './admin/AdminLazyTabShell';
`;

if (!dash.includes('AdminTabProvider')) {
  dash = dash.replace(
    "import { applyAnchorNewTabPolicy } from '../utils/htmlContent';",
    `import { applyAnchorNewTabPolicy } from '../utils/htmlContent';\n${newImports}`
  );
}

function cut(startMarker, endMarker) {
  const s = dash.indexOf(startMarker);
  const e = dash.indexOf(endMarker, s);
  if (s !== -1 && e !== -1) dash = dash.slice(0, s) + dash.slice(e);
}

cut('          {/* ===== TAB: H\u1ECCC VI\u00CAN ===== */}', '          {/* ===== TAB: GI\u1EA2NG VI\u00CAN ===== */}');
cut('          {/* ===== TAB: GI\u1EA2NG VI\u00CAN ===== */}', '          {/* ===== TAB: \u0110\u00C1NH GI\u00C1 N\u1ED8I B\u1ED8 (Ch\u1EC9 Admin) ===== */}');
cut('          {/* ===== MODAL: KI\u1EC2M TRA FILE TH\u1EF0C H\u00C0NH ===== */}', '          {/* ===== TAB: \u0110\u00C1NH GI\u00C1 N\u1ED8I B\u1ED8 (Ch\u1EC9 Admin) ===== */}');
cut('          {/* ===== \u0110\u00C0O T\u1EA0O GI\u1EA2NG VI\u00CAN ===== */}', '          {/* ===== \u0110\u00C0O T\u1EA0O H\u1ECCC VI\u00CAN ===== */}');
cut('          {/* ===== MODAL K\u1EBET QU\u1EA2 THI GI\u1EA2NG VI\u00CAN ===== */}', '          {/* ===== \u0110\u00C0O T\u1EA0O H\u1ECCC VI\u00CAN ===== */}');

function replaceTabBlock(startMarker, endMarker, lazyLine) {
  const s = dash.indexOf(startMarker);
  const e = dash.indexOf(endMarker, s);
  if (s === -1 || e === -1) {
    console.warn('replaceTabBlock miss:', startMarker.slice(0, 40));
    return;
  }
  dash = dash.slice(0, s) + `${startMarker}\n          ${lazyLine}\n\n          ` + dash.slice(e);
}

if (!dash.includes('<AdminLazyStudentsTab />')) {
  replaceTabBlock(
    '          {/* ===== TAB: H\u1ECCC VI\u00CAN ===== */}',
    '          {/* ===== TAB: GI\u1EA2NG VI\u00CAN ===== */}',
    "{activeTab === 'students' && <AdminLazyStudentsTab />}"
  );
  replaceTabBlock(
    '          {/* ===== TAB: GI\u1EA2NG VI\u00CAN ===== */}',
    '          {/* ===== TAB: \u0110\u00C1NH GI\u00C1 N\u1ED8I B\u1ED8 (Ch\u1EC9 Admin) ===== */}',
    "{activeTab === 'teachers' && <AdminLazyTeachersTab />}"
  );
  replaceTabBlock(
    '          {/* ===== \u0110\u00C0O T\u1EA0O GI\u1EA2NG VI\u00CAN ===== */}',
    '          {/* ===== \u0110\u00C0O T\u1EA0O H\u1ECCC VI\u00CAN ===== */}',
    "{activeTab === 'training' && <AdminLazyTrainingTab />}"
  );
  // Remove orphan teacher modals if still present
  const modalStart = '          {/* ===== MODAL: KI\u1EC2M TRA FILE TH\u1EF0C H\u00C0NH ===== */}';
  const modalEnd = '          {/* ===== TAB: \u0110\u00C1NH GI\u00C1 N\u1ED8I B\u1ED8 (Ch\u1EC9 Admin) ===== */}';
  const ms = dash.indexOf(modalStart);
  const me = dash.indexOf(modalEnd, ms);
  if (ms !== -1 && me !== -1 && ms < me) dash = dash.slice(0, ms) + dash.slice(me);
  const erGvStart = '          {/* ===== MODAL K\u1EBET QU\u1EA2 THI GI\u1EA2NG VI\u00CAN ===== */}';
  const erGvEnd = '          {/* ===== \u0110\u00C0O T\u1EA0O H\u1ECCC VI\u00CAN ===== */}';
  const es = dash.indexOf(erGvStart);
  const ee = dash.indexOf(erGvEnd, es);
  if (es !== -1 && ee !== -1 && es < ee) dash = dash.slice(0, es) + dash.slice(ee);
}

const lazyTabs = `
          {activeTab === 'students' && <AdminLazyStudentsTab />}
          {activeTab === 'teachers' && <AdminLazyTeachersTab />}
          {activeTab === 'training' && <AdminLazyTrainingTab />}
`;

if (!dash.includes('AdminLazyStudentsTab')) {
  dash = dash.replace(
    /(\{activeTab === 'dashboard' && \([\s\S]*?\)\}\)\r?\n)/,
    `$1${lazyTabs}`
  );
}

const adminTabValueBlock = `
  const adminTabValue = {
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
  };
`;

if (!dash.includes('const adminTabValue')) {
  dash = dash.replace(
    '  return (\n    <div className="bg-transparent h-full">',
    `${adminTabValueBlock}\n  return (\n    <div className="bg-transparent h-full">`
  );
}

if (!dash.includes('<AdminTabProvider')) {
  dash = dash.replace(
    '        <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 sm:space-y-8">',
    `        <AdminTabProvider value={adminTabValue}>
        <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 sm:space-y-8">`
  );
  dash = dash.replace(
    `          {activeTab === 'hr' && <AdminLazyExternalTab tab="hr" />}\n\n        </div>`,
    `          {activeTab === 'hr' && <AdminLazyExternalTab tab="hr" />}\n\n        </div>\n        </AdminTabProvider>`
  );
}

// Final pass: swap inline students tab for lazy tabs (idempotent)
if (!dash.includes('<AdminLazyStudentsTab />')) {
  const hocM = '          {/* ===== TAB: H\u1ECCC VI\u00CAN ===== */}';
  const danhM = '          {/* ===== TAB: \u0110\u00C1NH GI\u00C1 N\u1ED8I B\u1ED8 (Ch\u1EC9 Admin) ===== */}';
  const s = dash.indexOf(hocM);
  const e = dash.indexOf(danhM);
  if (s >= 0 && e > s) {
    const rep = [
      hocM,
      "          {activeTab === 'students' && <AdminLazyStudentsTab />}",
      '',
      '          {/* ===== TAB: GI\u1EA2NG VI\u00CAN ===== */}',
      "          {activeTab === 'teachers' && <AdminLazyTeachersTab />}",
      '',
      '          {/* ===== \u0110\u00C0O T\u1EA0O GI\u1EA2NG VI\u00CAN ===== */}',
      "          {activeTab === 'training' && <AdminLazyTrainingTab />}",
      '',
      '          ',
    ].join('\n');
    dash = dash.slice(0, s) + rep + dash.slice(e);
    console.log('Replaced inline students tab with lazy tabs');
  } else {
    console.warn('Could not find students/evaluations markers', s, e);
  }
}

fs.writeFileSync(SRC, dash, 'utf8');
console.log('Wired AdminDashboard for Phase 1b');

