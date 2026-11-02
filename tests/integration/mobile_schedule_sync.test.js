'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('mobile schedule screens refresh from shared realtime schedule events', () => {
  const socket = read('thang-tin-hoc-mobile/src/services/socketService.ts');
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const conversationScreen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');

  for (const event of ['schedule:new', 'schedule:updated', 'schedule:cancelled']) {
    assert.ok(socket.includes(`instance.on('${event}'`), `socket relays ${event}`);
  }
  assert.ok(scheduleScreen.includes('SOCKET_EVENTS.SCHEDULE_NEW'));
  assert.ok(scheduleScreen.includes('SOCKET_EVENTS.DATA_REFRESH'));
  assert.ok(scheduleScreen.includes('useFocusEffect'));
  assert.ok(conversationScreen.includes('SOCKET_EVENTS.SCHEDULE_CANCELLED'));
  assert.ok(conversationScreen.includes('scheduleResource.reload()'));
});

test('backend records schedule changes in chat without duplicate client sends', () => {
  const routes = read('routes/scheduleRoutes.js');
  const conversationService = read('services/scheduleConversationService.js');
  const messageService = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const conversation = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  const inbox = read('client/src/components/Inbox.jsx');

  assert.ok(routes.includes("notifyScheduleConversation(req, schedule, 'created')"));
  assert.ok(routes.includes("notifyScheduleConversation(req, updated, 'changed'"));
  assert.ok(routes.includes("notifyScheduleConversation(req, updated, 'cancelled'"));
  assert.ok(routes.includes("notifyScheduleConversation(req, schedule, 'cancelled'"));
  assert.ok(conversationService.includes('sendCanonicalMessage'));
  assert.ok(conversationService.includes("messageType: 'system'"));
  assert.ok(!messageService.includes('sendScheduleEvent'));
  assert.ok(!conversation.includes('notifyScheduleInConversation'));
  assert.ok(!inbox.includes('notifyInboxScheduleEvent'));
});

test('mobile schedule view follows the web schedule page structure for both roles', () => {
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');

  assert.ok(scheduleScreen.includes('Quản lý Lịch học & Điểm danh'));
  assert.ok(scheduleScreen.includes('Quản lý Lịch dạy & Điểm danh'));
  assert.ok(!scheduleScreen.includes('Xem lịch học theo tuần và nhật ký học tập'));
  assert.ok(scheduleScreen.includes('studentDiaryFilterContainer'));
  assert.ok(scheduleScreen.includes('studentDiaryLogMeta'));
  assert.ok(scheduleScreen.includes('Xếp lịch học viên theo tuần'));
  assert.ok(scheduleScreen.includes('Nhật ký học tập'));
  assert.ok(scheduleScreen.includes('Nhật ký giảng dạy'));
  assert.ok(scheduleScreen.includes('scheduleHero'));
});

test('student diary puts cancel beside day, week, and month with compact button corners', () => {
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');

  assert.ok(scheduleScreen.includes("{ value: 'Lịch hủy', label: 'Hủy', dateFilter: true }"));
  assert.ok(scheduleScreen.includes("{ value: 'Chưa điểm danh', label: 'Chưa điểm danh', dateFilter: false }"));
  assert.ok(scheduleScreen.includes("studentDiaryFilter === 'Lịch hủy' && item.status !== 'cancelled'"));
  assert.ok(scheduleScreen.includes("studentDiaryFilter === 'Lịch hủy' ? 'Không có lịch hủy.'"));
  assert.ok(scheduleScreen.includes("borderRadius: radius.sm, backgroundColor: colors.surface }"));
  assert.ok(scheduleScreen.includes("studentDiaryDateFilter: { flexBasis: '22%', flexGrow: 1, minWidth: 0 }"));
  assert.ok(scheduleScreen.includes("studentDiaryStatusFilter: { flexBasis: '48%', flexGrow: 0 }"));
});

test('mobile schedule actions call matching authenticated API endpoints', () => {
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const mobileService = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const routes = read('routes/scheduleRoutes.js');

  assert.ok(scheduleScreen.includes('scheduleService.create('));
  assert.ok(scheduleScreen.includes('scheduleService.update('));
  assert.ok(scheduleScreen.includes('scheduleService.cancel('));
  assert.ok(scheduleScreen.includes('scheduleService.markAttendance('));
  assert.ok(scheduleScreen.includes("navigation.navigate('Attendance', { scheduleId: item.id })"));
  assert.ok(mobileService.includes("'/schedules?limit=500'"));
  assert.ok(mobileService.includes("method: 'POST'"));
  assert.ok(mobileService.includes("method: 'PUT'"));
  assert.ok(mobileService.includes("method: 'PATCH'"));
  assert.ok(mobileService.includes('`/schedules/${encodeURIComponent(scheduleId)}/cancel`'));
  assert.ok(routes.includes("router.post('/',"));
  assert.ok(routes.includes("router.put('/:scheduleId'"));
  assert.ok(routes.includes("router.patch('/:scheduleId/cancel'"));
});

test('teacher attendance and cancellation controls wait for the eligible attendance window', () => {
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const scheduleRoutes = read('routes/scheduleRoutes.js');

  assert.ok(scheduleScreen.includes('now >= bounds.startAt + 15 * 60 * 1000'));
  assert.ok(scheduleScreen.includes('now <= bounds.deadline'));
  assert.ok(scheduleScreen.includes('function canTeacherRequestMakeup('));
  assert.ok(scheduleScreen.includes('disabled={makeupOverdue ? makeupRequestSent : !attendanceAvailable}'));
  assert.ok(scheduleScreen.includes("'Điểm danh bù'"));
  assert.ok(scheduleScreen.includes('teacherDiaryCancelButton'));
  assert.ok(scheduleScreen.includes('attendanceAvailable || makeupOverdue'));
  assert.ok(scheduleScreen.includes('styles.calendarMakeupAction'));
  assert.ok(scheduleScreen.includes('styles.teacherDiaryMakeupButton'));
  assert.ok(scheduleScreen.includes('if (!makeupRequestSent) setMakeupTarget(item)'));
  assert.ok(scheduleScreen.includes('visible={Boolean(makeupTarget)}'));
  assert.ok(scheduleScreen.includes("'[Yêu cầu điểm danh bù]'"));
  assert.ok(scheduleScreen.includes('sendMakeupRequestToAdmin'));
  assert.ok(scheduleScreen.includes('mobileMakeupRequestsSent.has(`${user.id}:${item.id}`)'));
  assert.ok(scheduleScreen.includes('makeupOverdue ? makeupRequestSent : !attendanceAvailable'));
  assert.ok(scheduleScreen.includes("'Đã gửi Admin' : 'Điểm danh bù'"));
  assert.ok(scheduleScreen.includes('calendarMakeupActionTextSent'));
  assert.ok(scheduleScreen.includes('teacherDiaryMakeupButtonTextSent'));
  assert.ok(scheduleScreen.includes('function isScheduleRescheduleLocked(item: ScheduleItem)'));
  assert.ok(scheduleScreen.includes('!isScheduleRescheduleLocked(item)'));
  assert.ok(scheduleScreen.includes("Alert.alert('Không thể sửa ca dạy', 'Buổi học đã được điểm danh bù và không thể thay đổi lịch.')"));
  assert.ok(scheduleRoutes.includes("String(schedule.studentConfirmStatus || '') === 'admin_approved'"));
  assert.ok(scheduleRoutes.includes("code: 'ATTENDANCE_MAKEUP_ALREADY_APPROVED'"));
  assert.ok(scheduleScreen.includes("if (confirmStatus === 'pending' || item.attendanceConfirmPending) return 'Chờ học viên xác nhận'"));
  assert.ok(scheduleScreen.includes('isTeacherAttendanceActionPending(item)'));
  assert.ok(scheduleScreen.includes('attendanceAwaitingConfirmation'));
  assert.ok(scheduleScreen.includes('accessibilityState={{ disabled: true }}'));
  assert.ok(scheduleScreen.includes('calendarAttendanceActionSubmitted'));
  assert.ok(scheduleScreen.includes('teacherDiaryAttendanceButtonSubmitted'));
  assert.ok(scheduleScreen.includes('styles.calendarActionsSubmitted'));
  assert.ok(scheduleScreen.includes('<StatusBadge label={attendanceStatusLabel(item, scheduleNow)} compact />'));
  assert.ok(scheduleScreen.includes("{ label: 'Chờ xác nhận', count: allScheduleItems.filter(isAttendanceAwaitingStudentConfirmation).length }"));
  assert.ok(scheduleScreen.includes("if (diaryFilter === 'Chờ xác nhận' && !isAttendanceAwaitingStudentConfirmation(item)) return false"));
  assert.ok(scheduleScreen.includes("diaryFilter === 'Chờ xác nhận' ? 'Không có ca chờ xác nhận'"));
  assert.ok(scheduleScreen.includes("{ label: 'Hủy', count: allScheduleItems.filter((item) => item.status === 'cancelled').length }"));
  assert.ok(scheduleScreen.includes('teacherDiaryDateFilterCancelled'));
  assert.ok(scheduleScreen.includes('teacherDiaryStatusFilters'));
  assert.ok(scheduleScreen.includes("if (diaryFilter === 'Chưa điểm danh' && !isTeacherAttendanceActionPending(item)) return false"));
  const ui = read('thang-tin-hoc-mobile/src/components/ui.tsx');
  assert.ok(ui.includes("'Đã điểm danh': { backgroundColor: colors.greenSoft, color: colors.green }"));
  assert.ok(ui.includes("'Đã xác nhận': { backgroundColor: colors.greenSoft, color: colors.green }"));
  assert.ok(scheduleScreen.includes("teacherDiaryAttendanceButtonSubmitted: { backgroundColor: '#FEE2E2' }"));
  assert.ok(scheduleScreen.includes('setInterval(() => setScheduleNow(Date.now()), 15_000)'));
});

test('teacher weekly schedule uses student-sized text in a horizontally scrollable grid', () => {
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');

  assert.ok(scheduleScreen.includes('nestedScrollEnabled'));
  assert.ok(scheduleScreen.includes('weekDays.length * STUDENT_WEEK_CELL_WIDTH'));
  assert.ok(scheduleScreen.includes('teacherCompactDayText: { color: colors.ink, fontSize: typography.caption'));
  assert.ok(scheduleScreen.includes('teacherCompactCourse: { color: colors.muted, fontSize: typography.micro'));
  assert.ok(scheduleScreen.includes('teacherCompactStatus: { color: colors.muted, fontSize: typography.micro'));
});

test('student weekly schedule matches teacher course and week controls without adding a column', () => {
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const studentWeeklySchedule = scheduleScreen.split('<Text style={styles.weeklyGridTitle}>Lịch học theo tuần</Text>')[1]
    ?.split("{isTeacher && resource.data && !resource.error ? (")[0] || '';

  assert.ok(studentWeeklySchedule.includes('style={styles.courseFilterSelect}'));
  assert.ok(studentWeeklySchedule.includes('setShowStudentCoursePicker(true)'));
  assert.ok(studentWeeklySchedule.includes('style={styles.teacherWeekRange}'));
  assert.ok(studentWeeklySchedule.includes('weekDays.map((day, index)'));
  assert.ok(studentWeeklySchedule.includes("{index === 6 ? 'CN' : `T${index + 2}`}"));
  assert.ok(studentWeeklySchedule.includes('weekDays.map((day) =>'));
  assert.ok(studentWeeklySchedule.includes('styles.teacherCompactDayCell'));
  assert.ok(!studentWeeklySchedule.includes('teacherCompactNameCell'));
  assert.ok(scheduleScreen.includes('{studentCourses.map((course) => {'));
});
