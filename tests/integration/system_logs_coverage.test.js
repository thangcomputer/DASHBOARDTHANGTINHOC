/**
 * Test: Full Admin System Logs Coverage for Students, Teachers, Refunds & Reports
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const { isVisibleSystemLogAction } = require(path.join(ROOT, 'constants/systemLogActions'));
const { describeAction } = require(path.join(ROOT, 'middleware/systemLogger'));
const {
  summarizeTeacherUpdates,
  summarizeStudentUpdates,
  describeAssignTeacher,
} = require(path.join(ROOT, 'utils/systemLogChangeSummary'));

describe('Admin System Logs Coverage Verification', () => {

  it('1. Student Creation is logged as THÊM HỌC VIÊN and included in visible actions', () => {
    const res = describeAction('POST', '/api/students', { name: 'Nguyễn Văn A', course: 'Tin học văn phòng', paid: true, paidAmount: 1500000 }, { success: true, data: { name: 'Nguyễn Văn A', course: 'Tin học văn phòng', paid: true, paidAmount: 1500000 } });
    assert.equal(res.action, 'THÊM HỌC VIÊN');
    assert.equal(res.category, 'student');
    assert.ok(res.desc.includes('Nguyễn Văn A'));
    assert.equal(res.amount, 1500000);
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('2. Student Deletion is logged as XÓA HỌC VIÊN', () => {
    const res = describeAction('DELETE', '/api/students/std_123', {}, { success: true, data: { name: 'Trần Văn B' } });
    assert.equal(res.action, 'XÓA HỌC VIÊN');
    assert.equal(res.category, 'student');
    assert.ok(res.desc.includes('Trần Văn B'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('3. Student Profile Update lists changed fields', () => {
    const res = describeAction(
      'PUT',
      '/api/students/std_123',
      { name: 'Trần Văn B (Sửa)', totalSessions: 24 },
      {
        success: true,
        data: { name: 'Trần Văn B (Sửa)' },
        meta: {
          changes: ['Họ tên: Trần Văn B → Trần Văn B (Sửa)', 'Tổng buổi học: 12 → 24'],
        },
      },
    );
    assert.equal(res.action, 'CẬP NHẬT HV');
    assert.ok(res.desc.includes('Tổng buổi học'));
    assert.ok(res.desc.includes('Trần Văn B'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('3b. Student password change is described clearly', () => {
    const res = describeAction(
      'PUT',
      '/api/students/std_123',
      {},
      { success: true, data: { name: 'HV A' }, meta: { passwordChanged: true, changes: ['Đổi mật khẩu'] } },
    );
    assert.ok(res.desc.includes('Đổi mật khẩu'));
  });

  it('4. Student Assign Teacher includes GV names and course', () => {
    const res = describeAction(
      'PUT',
      '/api/students/std_123/assign-teacher',
      { teacherId: 't1' },
      {
        success: true,
        data: { name: 'Lê Thị C' },
        meta: {
          teacherName: 'Thầy Thắng',
          previousTeacherName: 'Thầy Cũ',
          targetCourse: 'Excel VIP',
          reassign: true,
        },
      },
    );
    assert.equal(res.action, 'CẬP NHẬT HV');
    assert.ok(res.desc.includes('Thầy Cũ'));
    assert.ok(res.desc.includes('Thầy Thắng'));
    assert.ok(res.desc.includes('Lê Thị C'));
    assert.ok(res.desc.includes('Excel VIP'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('4b. Assign helper formats unassign / first assign', () => {
    assert.ok(describeAssignTeacher({
      studentName: 'HV1',
      teacherName: 'GV1',
      targetCourse: 'Word',
    }).includes('Phân công GV GV1'));
    assert.ok(describeAssignTeacher({
      studentName: 'HV1',
      previousTeacherName: 'GV cũ',
      unassign: true,
    }).includes('Bỏ phân công'));
  });

  it('5. Student Add Course / Enrollment is logged as CẬP NHẬT HV', () => {
    const res = describeAction('POST', '/api/students/std_123/enrollments', { courseName: 'Word Nâng Cao' }, { success: true, data: { name: 'Lê Thị C' } });
    assert.equal(res.action, 'CẬP NHẬT HV');
    assert.equal(res.category, 'student');
    assert.ok(res.desc.includes('Word Nâng Cao'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('6. Student Price Adjustment is logged as CẬP NHẬT HV', () => {
    const res = describeAction('PATCH', '/api/students/std_123/price', { newPrice: 1200000 }, { success: true, data: { name: 'Lê Thị C' } });
    assert.equal(res.action, 'CẬP NHẬT HV');
    assert.equal(res.category, 'student');
    assert.ok(res.desc.includes('1.200.000'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('7. Student Tuition Refund is logged as HOÀN HỌC PHÍ with negative amount', () => {
    const res = describeAction('PUT', '/api/students/std_123/refund', { amount: 500000 }, { success: true, data: { refundedAmount: 500000, student: { name: 'Phạm D' } } });
    assert.equal(res.action, 'HOÀN HỌC PHÍ');
    assert.equal(res.category, 'finance');
    assert.equal(res.amount, -500000);
    assert.ok(res.desc.includes('Phạm D'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('8. Cancel Course with Refund is logged as HOÀN HỌC PHÍ', () => {
    const res = describeAction('DELETE', '/api/students/std_123/enrollments/enr_456', { courseName: 'Photoshop', refundAmount: 800000 }, { success: true, data: { name: 'Hoàng E' }, meta: { refundedAmount: 800000 } });
    assert.equal(res.action, 'HOÀN HỌC PHÍ');
    assert.equal(res.category, 'finance');
    assert.equal(res.amount, -800000);
    assert.ok(res.desc.includes('Hoàng E'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('9. Teacher Creation is logged as THÊM GIẢNG VIÊN', () => {
    const res = describeAction('POST', '/api/teachers', { name: 'Thầy Hùng' }, { success: true, data: { name: 'Thầy Hùng' } });
    assert.equal(res.action, 'THÊM GIẢNG VIÊN');
    assert.equal(res.category, 'teacher');
    assert.ok(res.desc.includes('Thầy Hùng'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('10. Teacher Profile Update lists salary / status changes', () => {
    const changes = summarizeTeacherUpdates(
      { baseSalaryPerSession: 180000, status: 'active' },
      { baseSalaryPerSession: 150000, status: 'pending', name: 'Thầy Hùng' },
    );
    assert.ok(changes.some((c) => c.includes('Tăng lương')));
    assert.ok(changes.some((c) => c.includes('Trạng thái')));

    const res = describeAction(
      'PUT',
      '/api/teachers/tch_789',
      { baseSalaryPerSession: 180000 },
      {
        success: true,
        data: { name: 'Thầy Hùng' },
        meta: { changes },
      },
    );
    assert.equal(res.action, 'CẬP NHẬT GV');
    assert.ok(res.desc.includes('Tăng lương'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('10b. summarizeStudentUpdates covers sessions and password', () => {
    const parts = summarizeStudentUpdates(
      { totalSessions: 20, completedSessions: 5, _passwordChanged: true },
      { totalSessions: 12, completedSessions: 3, name: 'HV' },
      { passwordChanged: true },
    );
    assert.ok(parts.some((p) => p.includes('Đổi mật khẩu')));
    assert.ok(parts.some((p) => p.includes('Tổng buổi học')));
    assert.ok(parts.some((p) => p.includes('Buổi đã học')));
  });

  it('11. Teacher Deletion is logged as XÓA GIẢNG VIÊN', () => {
    const res = describeAction('DELETE', '/api/teachers/tch_789', {}, { success: true, message: 'Đã xóa giảng viên Thầy Hùng' });
    assert.equal(res.action, 'XÓA GIẢNG VIÊN');
    assert.equal(res.category, 'teacher');
    assert.ok(res.desc.includes('Thầy Hùng'));
    assert.ok(isVisibleSystemLogAction(res.action));
  });

  it('12. Revenue Report Export is recognized in SYSTEM_LOG_VISIBLE_ACTIONS', () => {
    assert.ok(isVisibleSystemLogAction('TẢI BÁO CÁO DOANH THU'));
    assert.ok(isVisibleSystemLogAction('TẢI BÁO CÁO TÀI CHÍNH'));
  });
});
