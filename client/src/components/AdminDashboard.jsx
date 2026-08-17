import React from 'react';
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
  AdminLazyCertPrepTab,
} from './admin/AdminLazyTabShell';
import ConfirmDeleteTrainingModal from './admin/shared/ConfirmDeleteTrainingModal';
import ConfirmDeleteEntityModal from './admin/shared/ConfirmDeleteEntityModal';
import GrantAccessModal from './admin/shared/GrantAccessModal';
import AddEnrollmentModal from './admin/shared/AddEnrollmentModal';
import AddStudentModal from './admin/shared/AddStudentModal';
import EditStudentModal from './admin/shared/EditStudentModal';
import TeacherPayoutModal from './admin/shared/TeacherPayoutModal';
import AddTeacherModal from './admin/shared/AddTeacherModal';
import EditTeacherModal from './admin/shared/EditTeacherModal';
import ResetPasswordOtpModal from './admin/shared/ResetPasswordOtpModal';
import StudentDetailModal from './StudentDetailModal';
import { useAdminDashboardState } from './admin/hooks/useAdminDashboardState';
import { formatSubjectIdsAsSpecialty, resolveTeacherSubjectIds } from '../utils/examSubjects';

const StudentImportModal = React.lazy(() => import('./StudentImportModal'));

const AdminDashboard = () => {
  const s = useAdminDashboardState();
  const {
    activeTab,
    statTotalStudents, statPaidStudents, statTotalTeachers, statActiveTeachers,
    statTotalRevenue, statPendingTeachers, filteredStudents, safeTeachers,
    adminTabValue,
    deleteConfirm, setDeleteConfirm, removeTrainingItem,
    showModal, setShowModal, teachers, addStudent,
    payoutModal, setPayoutModal, handleGoToQR, handlePayout, handleSaveHoaHongRate,
    printStudent,
    showTeacherModal, setShowTeacherModal, teacherForm, setTeacherForm,
    isSuperAdmin, isHighAdmin, safeBranches, ctxAddTeacher, toast, fetchTeachers,
    editTeacher, setEditTeacher, handleOpenResetPw, ctxUpdateTeacher, examSubjectsCatalog,
    getTeacherRating,
    editStudent, setEditStudent, globalTeachers, ctxUpdateStudent,
    selectedBranchId, currentPage, PAGE_SIZE, search, filterPaid, filterCourse,
    fetchStudentsPaginated,
    grantModal, setGrantModal, grantPending,
    deleteModal, setDeleteModal, confirmDelete,
    showStudentDetailId, setShowStudentDetailId,
    studentDetailTab, studentDetailScheduleId,
    showImportModal, setShowImportModal,
    enrollmentModalStudent, setEnrollmentModalStudent,
    addEnrollment,
    resetPwModal, setResetPwModal,
  } = s;

  return (
    <div className="bg-transparent h-full min-h-0">
      <div className="min-w-0 h-full min-h-0">
        <AdminTabProvider value={adminTabValue}>
        <div className="px-0 py-1 sm:px-0 sm:py-2 md:px-0 lg:px-0 h-full min-h-0">
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
              session={(() => {
                try {
                  return JSON.parse(localStorage.getItem('admin_user') || localStorage.getItem('staff_user') || '{}') || {};
                } catch {
                  return {};
                }
              })()}
            />
          )}

          {activeTab === 'students' && <AdminLazyStudentsTab />}
          {activeTab === 'teachers' && <AdminLazyTeachersTab />}
          {activeTab === 'training' && <AdminLazyTrainingTab />}
          {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}
          {activeTab === 'finance' && <AdminLazyFinanceTab />}
          {activeTab === 'student-training' && <AdminLazyStudentTrainingTab />}
          {activeTab === 'cert-prep' && <AdminLazyCertPrepTab />}
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

      {enrollmentModalStudent && (
        <AddEnrollmentModal
          student={enrollmentModalStudent}
          teachers={(teachers?.length ? teachers : globalTeachers) || []}
          onClose={() => setEnrollmentModalStudent(null)}
          onSubmit={(payload) => addEnrollment(enrollmentModalStudent, payload)}
        />
      )}

      {payoutModal && (
        <TeacherPayoutModal
          payoutModal={payoutModal}
          setPayoutModal={setPayoutModal}
          onGoToQR={handleGoToQR}
          onConfirm={handlePayout}
          onSaveRate={handleSaveHoaHongRate}
        />
      )}

      {printStudent && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <InvoiceTemplate data={{
            studentName: printStudent.name,
            courseName: printStudent.course,
            tuitionFee: printStudent.price,
            date: new Date(),
            receiverName: 'Há»“ Thá»‹ Nga',
            isPaid: printStudent.paid,
          }} />
        </div>
      )}

      {showTeacherModal && (
        <AddTeacherModal
          teacherForm={teacherForm}
          setTeacherForm={setTeacherForm}
          isSuperAdmin={isSuperAdmin || isHighAdmin}
          safeBranches={safeBranches}
          onClose={() => setShowTeacherModal(false)}
          onSubmit={async () => {
            if (!teacherForm.name?.trim() || !teacherForm.phone?.trim()) {
              toast.error('Vui lòng nhập họ tên và số điện thoại');
              return;
            }
            if (!teacherForm.subjectIds?.length) {
              toast.error('Vui lòng chọn ít nhất một môn chuyên môn');
              return;
            }
            try {
              await ctxAddTeacher({
                name: teacherForm.name,
                phone: teacherForm.phone,
                email: teacherForm.email,
                specialty: teacherForm.specialty,
                subjectIds: teacherForm.subjectIds || [],
                startDate: teacherForm.startDate,
                address: teacherForm.address,
                status: 'inactive',
                branchId: teacherForm.branchId || undefined,
                branchCode: teacherForm.branchCode || undefined,
                baseSalaryPerSession: Number(teacherForm.baseSalaryPerSession) || 0,
              });
              setTeacherForm({
                name: '', phone: '', email: '', specialty: '', subjectIds: [],
                startDate: new Date().toISOString().split('T')[0],
                address: '', branchId: '', branchCode: '',
                baseSalaryPerSession: 150000,
              });
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
          isSuperAdmin={isSuperAdmin || isHighAdmin}
          safeBranches={safeBranches}
          getTeacherRating={getTeacherRating}
          onClose={() => setEditTeacher(null)}
          onResetPassword={(id, name) => handleOpenResetPw(id, name, 'teacher')}
          onSave={async () => {
            try {
              const subjectIds = (editTeacher.subjectIds?.length
                ? editTeacher.subjectIds
                : resolveTeacherSubjectIds(editTeacher, examSubjectsCatalog));
              const specialty = formatSubjectIdsAsSpecialty(subjectIds, examSubjectsCatalog)
                || editTeacher.specialty
                || '';
              await ctxUpdateTeacher(editTeacher.id, {
                name: editTeacher.name,
                phone: editTeacher.phone,
                specialty,
                subjectIds,
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
            const total = Number(updatedForm.totalSessions) > 0 ? Number(updatedForm.totalSessions) : 12;
            const completed = Math.max(0, Math.min(total, Number(updatedForm.completedSessions) || 0));
            const remaining = updatedForm.remainingSessions != null && updatedForm.remainingSessions !== ''
              ? Math.max(0, Math.min(total, Number(updatedForm.remainingSessions) || 0))
              : Math.max(0, total - completed);
            const payload = {
              name: updatedForm.name,
              age: updatedForm.age,
              phone: updatedForm.phone,
              zalo: updatedForm.zalo,
              courseId: updatedForm.courseId,
              course: updatedForm.course,
              price: updatedForm.price,
              totalSessions: total,
              completedSessions: completed,
              remainingSessions: remaining,
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
              fetchStudentsPaginated({
                page: currentPage,
                limit: PAGE_SIZE,
                search,
                paid: filterPaid,
                course: filterCourse,
                branch_id: selectedBranchId,
                forceBranchIdAll: selectedBranchId === 'all' && ['students', 'dashboard'].includes(activeTab),
              });
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
            try {
              await grantPending(grantModal.id);
              await fetchTeachers();
              toast.success('Đã cấp lại quyền làm bài thi thành công!');
              setGrantModal(null);
            } catch (err) {
              toast.error(err?.message || 'Không thể cấp quyền thi');
            }
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
          initialTab={studentDetailTab || undefined}
          highlightScheduleId={studentDetailScheduleId || undefined}
          onClose={() => setShowStudentDetailId(null)}
        />
      )}

      {showImportModal && (
        <React.Suspense fallback={null}>
          <StudentImportModal
            onClose={() => setShowImportModal(false)}
            branchId={selectedBranchId}
          />
        </React.Suspense>
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
