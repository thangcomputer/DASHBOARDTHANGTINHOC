'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('notification records include identifiers required by mobile deep links', () => {
  const assignments = read('routes/assignmentRoutes.js');
  const schedules = read('routes/scheduleRoutes.js');
  const quizNotifications = read('services/quizAssignedNotifier.js');

  assert.ok(assignments.includes("assignmentId: String(newAssignment._id)"));
  assert.ok(assignments.includes("assignmentId: String(assignment?._id || submission.assignmentId || '')"));
  assert.ok(schedules.includes("scheduleId: String(schedule._id || schedule.id)"));
  assert.ok(schedules.includes("scheduleId: String(updated._id || schedule._id)"));
  assert.ok(quizNotifications.includes('payload: { quizId: payload.quizId }'));
});

test('mobile notification taps open the matching assignment, schedule, quiz, or conversation', () => {
  const notifications = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const assignments = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const exams = read('thang-tin-hoc-mobile/src/screens/StudentExamScreen.tsx');
  const types = read('thang-tin-hoc-mobile/src/navigation/types.ts');

  assert.ok(notifications.includes("navigation.navigate('Assignments', assignmentId ? { assignmentId } : undefined)"));
  assert.ok(notifications.includes("params: { focusScheduleId: String(payload.scheduleId) }"));
  assert.ok(notifications.includes("navigation.navigate('StudentExam', { quizId })"));
  assert.ok(notifications.includes("navigation.navigate('Conversation', {"));
  assert.ok(assignments.includes('resource.data.find((item) => item.id === targetAssignmentId)'));
  assert.ok(assignments.includes('setSelected(assignment)'));
  assert.ok(assignments.includes('Buổi học trong thông báo'));
  const quizRouteEffect = exams.match(/useEffect\(\(\) => \{\s*const quizId = route\.params\?\.quizId;[\s\S]*?\n  \}, \[loading, navigation, quizzes, route\.params\?\.quizId\]\);/);
  assert.ok(quizRouteEffect, 'quiz notification route effect should be present');
  assert.ok(quizRouteEffect[0].includes('quizzes.find((item) => item.id === quizId)'));
  assert.ok(quizRouteEffect[0].includes('setNotificationQuizId(quiz.id)'));
  assert.ok(!quizRouteEffect[0].includes('openQuiz(quiz)'), 'a notification must not start a timed exam automatically');
  assert.ok(types.includes('focusScheduleId?: string'));
});

test('mobile quiz room shows a compact answer overview and progress summary', () => {
  const exams = read('thang-tin-hoc-mobile/src/screens/StudentExamScreen.tsx');

  assert.ok(exams.includes('Tiến độ làm bài'));
  assert.ok(exams.includes('examProgressTrack'));
  assert.ok(exams.includes('<ScrollView horizontal showsHorizontalScrollIndicator={false}>'));
  assert.ok(exams.includes('roomContent: { paddingBottom: spacing.lg, gap: spacing.sm }'));
  assert.ok(exams.includes('option: { minHeight: 44'));
  assert.ok(exams.includes('questionNumber: { minWidth: 38, height: 36'));
  assert.ok(exams.includes('examScreen: { flex: 1, paddingBottom: spacing.sm }'));
  assert.ok(exams.includes('examScroll: { flex: 1 }'));
  assert.ok(exams.includes('<ScrollView style={styles.examScroll} contentContainerStyle={styles.roomContent}'));
  assert.ok(exams.includes('setSubmitConfirmationVisible(true)'));
  assert.ok(exams.includes('visible={submitConfirmationVisible}'));
  assert.ok(exams.includes('setSubmitConfirmationVisible(false);'));
  assert.ok(exams.includes('void submitAnswers();'));
  assert.equal(exams.includes("Alert.alert(\n      'Xác nhận nộp bài?'"), false);
});

test('exam categories open in a separate view with a back action', () => {
  const exams = read('thang-tin-hoc-mobile/src/screens/StudentExamScreen.tsx');

  assert.ok(exams.includes("useState<RoomTab | null>(null)"));
  assert.ok(exams.includes('showBackButton={activeTab !== null}'));
  assert.ok(exams.includes('onBack={activeTab ? () => setActiveTab(null) : undefined}'));
  assert.ok(exams.includes('centered={activeTab === null}'));
  assert.ok(exams.includes('{activeTab === null ? ('));
  assert.ok(exams.includes('{activeTab !== null ? (activeTab === \'quiz\' ? ('));
  assert.ok(exams.includes(': setActiveTab(key)'));
});
