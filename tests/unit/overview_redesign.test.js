'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('Tổng quan học viên (web): mỗi thông tin một chỗ, việc cần làm bấm thẳng vào việc', () => {
  const overview = read('client/src/components/student/StudentOverviewTab.jsx');
  for (const removed of ['StatCard', 'CourseSwitcher', 'Tin nhắn & Phản hồi', 'Lịch học sắp tới', 'downloadMediaFile']) {
    assert.ok(!overview.includes(removed), `bỏ khối trùng: ${removed}`);
  }
  assert.ok(overview.includes('Khóa học của tôi') && overview.includes('Việc cần làm hôm nay') && overview.includes('Hoạt động gần đây'));
  assert.ok(overview.includes("navigate(`/student#materials-assignments${firstId ? `?assignmentId=${firstId}` : ''}`)"), 'mở thẳng bài tập gần hạn nhất');
  assert.ok(overview.includes('Học tiếp: ${nextSubject.name}'), 'nút học tiếp phần đang dở');
  assert.ok(
    overview.includes('const RECENT_ACTIVITY_LIMIT = 5;')
    || overview.includes('Hoạt động gần đây')
  );
  assert.ok(overview.includes("label: `Buổi tới: Ca ${sessionRange}"), 'buổi học tới chỉ ở thẻ chào mừng');

  const dashboard = read('client/src/components/StudentDashboard.jsx');
  assert.match(dashboard, /\{currentHash && \(\s*<ClassReminder/, 'không lặp thanh đếm ngược trên Tổng quan');
  assert.ok(dashboard.includes('focusAssignmentId='));
  assert.ok(read('client/src/components/StudentTrainingLMS.jsx').includes('id={`lms-assignment-${aKey}`}'));
  assert.ok(!read('client/src/components/student/LearningLeaderboardCard.jsx').includes('openLearningGoal'), 'bỏ nút Đặt mục tiêu trùng');
});

test('Tổng quan giảng viên (web): cần xử lý chỉ hiện việc tồn, bỏ lịch tháng và chỉ số trùng', () => {
  const overview = read('client/src/components/teacher/TeacherOverviewTab.jsx');
  for (const removed of ['Lịch dạy sắp tới trong tháng', "label: 'Tin nhắn'", "label: 'Xếp lịch'", "label: 'HV mới'", "label: 'Đang dạy'", "label: 'Uy tín'"]) {
    assert.ok(!overview.includes(removed), `bỏ khối trùng: ${removed}`);
  }
  assert.ok(overview.includes('Ca chưa điểm danh (${unmarkedToday.length})'));
  assert.ok(overview.includes("String(s.studentConfirmStatus || 'none') !== 'pending'"), 'ca đã gửi xác nhận không tính là chưa điểm danh');
  assert.ok(overview.includes("String(s?.status || '') === 'completed'"), 'buổi đã dạy = đã xác nhận');
  assert.ok(overview.includes('Lịch dạy hôm nay'));
});

test('Trang chủ mobile: cùng bố cục, bỏ khối trùng (thẻ lớp, KPI, tài liệu, truy cập nhanh, hỗ trợ)', () => {
  const home = read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  for (const removed of ['styles.studentCourseCard}', 'styles.studentKpiGrid}', 'Truy cập nhanh', 'styles.helpCard}', 'styles.liveClassCard}', 'Lịch dạy trong tháng', 'Bài tập cần chấm" action', 'styles.materialPanel}']) {
    assert.ok(!home.includes(removed), `bỏ khối trùng: ${removed}`);
  }
  assert.ok(home.includes('Việc cần làm hôm nay') && home.includes('Khóa học của tôi') && home.includes('Hoạt động gần đây'));
  assert.ok(home.includes('Cần xử lý') && home.includes('Lịch dạy hôm nay') && home.includes('title="Tháng này"'));
  assert.ok(home.includes("navigation?.navigate('Assignments', { assignmentId: nextHomework.id })"));
  assert.ok(home.includes("navigation?.navigate('Attendance', { scheduleId: first.id })"));
  assert.ok(home.includes('showProgress={false}'), 'chọn khóa không lặp thanh tiến độ');
});
