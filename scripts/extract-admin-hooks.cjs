/**
 * Extract AdminDashboard logic into useAdminDashboardState + domain hooks.
 * Run: node scripts/extract-admin-hooks.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../client/src/components/AdminDashboard.jsx');
const HOOKS = path.join(__dirname, '../client/src/components/admin/hooks');
fs.mkdirSync(HOOKS, { recursive: true });

let dash = fs.readFileSync(SRC, 'utf8');
const nl = dash.includes('\r\n') ? '\r\n' : '\n';

const startMarker = 'const AdminDashboard = ({ onNavigate }) => {';
const returnMarker = '  return (' + nl + '    <div className="bg-transparent h-full">';
const si = dash.indexOf(startMarker);
const ri = dash.indexOf(returnMarker);
if (si < 0 || ri < 0) {
  console.error('markers', si, ri);
  process.exit(1);
}

const logicBody = dash.slice(si + startMarker.length, ri);

// Fix known bug: addTeacher -> ctxAddTeacher in logic if present
// (logic doesn't include modal onSubmit which is in JSX)

const hookPath = path.join(HOOKS, 'useAdminDashboardState.js');
const hookContent = `import React, { useState, useMemo, useEffect, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { useData } from '../../../context/DataContext';
import { useSocket } from '../../../context/SocketContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';
import InvoiceTemplate from '../../InvoiceTemplate';
import exportPDF, { printInvoice } from '../../../utils/exportPDF';
import { exportToCSV } from '../../../utils/exportExcel';
import {
  parseQuestionBankExcel,
} from '../../../utils/studentQuestionsExcel';
import api from '../../../services/api';
import { useModal } from '../../../utils/Modal.jsx';

/** Cap fetch HV khi tab Kết quả thi */
export const EXAM_RESULTS_STUDENTS_FETCH_CAP = 5000;

/**
 * State + handlers for AdminDashboard.
 * Domain sections are grouped; prefer extracting to useAdminStudents / useAdminTeachers
 * when a section is edited next.
 */
export function useAdminDashboardState() {
${logicBody}
  return {
    activeTab,
    navigate,
    statTotalStudents,
    statPaidStudents,
    statTotalTeachers,
    statActiveTeachers,
    statTotalRevenue,
    statPendingTeachers,
    filteredStudents,
    safeTeachers,
    adminTabValue,
    deleteConfirm,
    setDeleteConfirm,
    removeTrainingItem,
    showModal,
    setShowModal,
    teachers,
    addStudent,
    payoutModal,
    setPayoutModal,
    handleGoToQR,
    handlePayout,
    printStudent,
    showTeacherModal,
    setShowTeacherModal,
    teacherForm,
    setTeacherForm,
    isSuperAdmin,
    safeBranches,
    ctxAddTeacher,
    toast,
    fetchTeachers,
    editTeacher,
    setEditTeacher,
    handleOpenResetPw,
    ctxUpdateTeacher,
    editStudent,
    setEditStudent,
    globalTeachers,
    ctxUpdateStudent,
    selectedBranchId,
    currentPage,
    PAGE_SIZE,
    search,
    filterPaid,
    filterCourse,
    fetchStudentsPaginated,
    grantModal,
    setGrantModal,
    grantPending,
    deleteModal,
    setDeleteModal,
    confirmDelete,
    showStudentDetailId,
    setShowStudentDetailId,
    showImportModal,
    setShowImportModal,
    resetPwModal,
    setResetPwModal,
  };
}
`;

fs.writeFileSync(hookPath, hookContent.replace(/\r\n/g, '\n'), 'utf8');
console.log('wrote useAdminDashboardState.js');

// Domain re-exports for clearer imports (thin wrappers)
fs.writeFileSync(
  path.join(HOOKS, 'useAdminStudents.js'),
  `/**
 * Student-domain slice of admin dashboard state.
 * Currently re-exports from useAdminDashboardState; expand when students logic is isolated.
 */
export { useAdminDashboardState as useAdminStudents } from './useAdminDashboardState';
`,
  'utf8',
);

fs.writeFileSync(
  path.join(HOOKS, 'useAdminTeachers.js'),
  `/**
 * Teacher-domain slice of admin dashboard state.
 * Currently re-exports from useAdminDashboardState; expand when teachers logic is isolated.
 */
export { useAdminDashboardState as useAdminTeachers } from './useAdminDashboardState';
`,
  'utf8',
);

// Slim AdminDashboard
const slimDash = `import React from 'react';
import { mutate } from 'swr';
import InvoiceTemplate from './InvoiceTemplate';
import { AdminTabProvider } from './admin/AdminTabContext';
import {
  AdminLazyExternalTab,
  AdminLazyOverviewTab,
  AdminLazyStudentsTab,
  AdminLazyTeachersTab,
  AdminLazyTrainingTab,
  AdminLazyEvaluationsTab,
  AdminLazyFinanceTab,
  AdminLazyLogsTab,
  AdminLazyStudentTrainingTab,
} from './admin/AdminLazyTabShell';
import ConfirmDeleteTrainingModal from './admin/shared/ConfirmDeleteTrainingModal';
import ConfirmDeleteEntityModal from './admin/shared/ConfirmDeleteEntityModal';
import GrantAccessModal from './admin/shared/GrantAccessModal';
import AddStudentModal from './admin/shared/AddStudentModal';
import EditStudentModal from './admin/shared/EditStudentModal';
import TeacherPayoutModal from './admin/shared/TeacherPayoutModal';
import AddTeacherModal from './admin/shared/AddTeacherModal';
import EditTeacherModal from './admin/shared/EditTeacherModal';
import ResetPasswordOtpModal from './admin/shared/ResetPasswordOtpModal';
import StudentDetailModal from './StudentDetailModal';
import StudentImportModal from './StudentImportModal';
import { useAdminDashboardState } from './admin/hooks/useAdminDashboardState';

const AdminDashboard = () => {
  const s = useAdminDashboardState();
  const {
    activeTab,
    statTotalStudents, statPaidStudents, statTotalTeachers, statActiveTeachers,
    statTotalRevenue, statPendingTeachers, filteredStudents, safeTeachers,
    adminTabValue,
    deleteConfirm, setDeleteConfirm, removeTrainingItem,
    showModal, setShowModal, teachers, addStudent,
    payoutModal, setPayoutModal, handleGoToQR, handlePayout,
    printStudent,
    showTeacherModal, setShowTeacherModal, teacherForm, setTeacherForm,
    isSuperAdmin, safeBranches, ctxAddTeacher, toast, fetchTeachers,
    editTeacher, setEditTeacher, handleOpenResetPw, ctxUpdateTeacher,
    editStudent, setEditStudent, globalTeachers, ctxUpdateStudent,
    selectedBranchId, currentPage, PAGE_SIZE, search, filterPaid, filterCourse,
    fetchStudentsPaginated,
    grantModal, setGrantModal, grantPending,
    deleteModal, setDeleteModal, confirmDelete,
    showStudentDetailId, setShowStudentDetailId,
    showImportModal, setShowImportModal,
    resetPwModal, setResetPwModal,
  } = s;

  return (
    <div className="bg-transparent h-full">
      <div className="min-w-0">
        <AdminTabProvider value={adminTabValue}>
        <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 sm:space-y-8">
          {activeTab === 'dashboard' && (
            <AdminLazyOverviewTab
              statTotalStudents={statTotalStudents}
              statPaidStudents={statPaidStudents}
              statTotalTeachers={statTotalTeachers}
              statActiveTeachers={statActiveTeachers}
              statTotalRevenue={statTotalRevenue}
              statPendingTeachers={statPendingTeachers}
              filteredStudents={filteredStudents}
              safeTeachers={safeTeachers}
            />
          )}

          {activeTab === 'students' && <AdminLazyStudentsTab />}
          {activeTab === 'teachers' && <AdminLazyTeachersTab />}
          {activeTab === 'training' && <AdminLazyTrainingTab />}
          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}
          {activeTab === 'finance' && <AdminLazyFinanceTab />}
          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}
          {activeTab === 'logs' && <AdminLazyLogsTab />}
          {['settings', 'staff', 'analytics', 'hr'].includes(activeTab) && (
            <AdminLazyExternalTab tab={activeTab} />
          )}
        </div>
        </AdminTabProvider>
      </div>

      {deleteConfirm && (
        <ConfirmDeleteTrainingModal
          item={deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => { removeTrainingItem(deleteConfirm.category, deleteConfirm.id); setDeleteConfirm(null); }}
        />
      )}

      {showModal && <AddStudentModal teachers={teachers} onAdd={addStudent} onClose={() => setShowModal(false)} />}

      {payoutModal && (
        <TeacherPayoutModal
          payoutModal={payoutModal}
          setPayoutModal={setPayoutModal}
          onGoToQR={handleGoToQR}
          onConfirm={handlePayout}
        />
      )}

      {printStudent && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <InvoiceTemplate data={{
            studentName: printStudent.name,
            courseName: printStudent.course,
            tuitionFee: printStudent.price,
            date: new Date(),
            receiverName: 'Hồ Thị Nga',
            isPaid: printStudent.paid,
          }} />
        </div>
      )}

      {showTeacherModal && (
        <AddTeacherModal
          teacherForm={teacherForm}
          setTeacherForm={setTeacherForm}
          isSuperAdmin={isSuperAdmin}
          safeBranches={safeBranches}
          onClose={() => setShowTeacherModal(false)}
          onSubmit={async () => {
            try {
              await ctxAddTeacher({
                name: teacherForm.name,
                phone: teacherForm.phone,
                specialty: teacherForm.specialty,
                startDate: teacherForm.startDate,
                address: teacherForm.address,
                status: 'inactive',
                branchId: teacherForm.branchId || undefined,
                branchCode: teacherForm.branchCode || undefined,
              });
              setTeacherForm({ name: '', phone: '', specialty: '', startDate: new Date().toISOString().split('T')[0], address: '', branchId: '', branchCode: '' });
              setShowTeacherModal(false);
              toast.success('Đã thêm giảng viên thành công!');
              fetchTeachers();
            } catch (err) {
              toast.error('Lỗi thêm giảng viên: ' + (err.message || 'Không xác định'));
            }
          }}
        />
      )}

      {editTeacher && (
        <EditTeacherModal
          editTeacher={editTeacher}
          setEditTeacher={setEditTeacher}
          isSuperAdmin={isSuperAdmin}
          safeBranches={safeBranches}
          onClose={() => setEditTeacher(null)}
          onResetPassword={(id, name) => handleOpenResetPw(id, name, 'teacher')}
          onSave={async () => {
            try {
              await ctxUpdateTeacher(editTeacher.id, {
                name: editTeacher.name,
                phone: editTeacher.phone,
                specialty: editTeacher.specialty,
                startDate: editTeacher.startDate,
                address: editTeacher.address,
                status: editTeacher.status,
                baseSalaryPerSession: editTeacher.baseSalaryPerSession,
                bankAccount: editTeacher.bankAccount || {},
                branchId: editTeacher.branchId,
                branchCode: editTeacher.branchCode,
              });
              setEditTeacher(null);
              toast.success('Đã cập nhật thông tin giảng viên!');
              fetchTeachers();
            } catch (err) {
              toast.error('Lỗi cập nhật giảng viên: ' + (err.message || 'Không xác định'));
            }
          }}
        />
      )}

      {editStudent && (
        <EditStudentModal
          student={editStudent}
          teachers={globalTeachers}
          onClose={() => setEditStudent(null)}
          onResetPassword={(id, name) => handleOpenResetPw(id, name, 'student')}
          onSave={async (updatedForm) => {
            const payload = {
              name: updatedForm.name,
              age: updatedForm.age,
              phone: updatedForm.phone,
              zalo: updatedForm.zalo,
              courseId: updatedForm.courseId,
              course: updatedForm.course,
              price: updatedForm.price,
              totalSessions: updatedForm.totalSessions,
              paid: updatedForm.paid,
              studentExamUnlocked: updatedForm.studentExamUnlocked,
              teacherId: updatedForm.teacherId || null,
              learningMode: updatedForm.learningMode,
              branchId: updatedForm.branchId || undefined,
            };
            try {
              await ctxUpdateStudent(editStudent.id || editStudent._id, payload);
              setEditStudent(null);
              toast.success('Đã cập nhật học viên!');
              mutate(['admin_stats', selectedBranchId]);
              mutate(['admin_finance', selectedBranchId]);
              fetchStudentsPaginated({ page: currentPage, limit: PAGE_SIZE, search, paid: filterPaid, course: filterCourse, branch_id: selectedBranchId });
            } catch (err) {
              toast.error('Lỗi cập nhật học viên: ' + (err.message || 'Không xác định'));
            }
          }}
        />
      )}

      {grantModal && (
        <GrantAccessModal
          modal={grantModal}
          onCancel={() => setGrantModal(null)}
          onConfirm={async () => {
            await grantPending(grantModal.id);
            toast.success('Đã cấp lại quyền làm bài thi thành công!');
            setGrantModal(null);
          }}
        />
      )}

      {deleteModal && (
        <ConfirmDeleteEntityModal
          modal={deleteModal}
          onCancel={() => setDeleteModal(null)}
          onConfirm={confirmDelete}
        />
      )}

      {showStudentDetailId && (
        <StudentDetailModal
          studentId={showStudentDetailId}
          onClose={() => setShowStudentDetailId(null)}
        />
      )}

      {showImportModal && (
        <StudentImportModal
          onClose={() => setShowImportModal(false)}
          branchId={selectedBranchId}
        />
      )}

      {resetPwModal && (
        <ResetPasswordOtpModal
          modal={resetPwModal}
          onClose={() => setResetPwModal(null)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
`;

fs.writeFileSync(SRC, slimDash.replace(/\r\n/g, '\n'), 'utf8');
console.log('wrote slim AdminDashboard.jsx lines=', slimDash.split('\n').length);
