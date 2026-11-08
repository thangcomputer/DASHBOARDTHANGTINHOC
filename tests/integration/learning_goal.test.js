'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const learningGoalService = require('../../services/learningGoalService');
const LearningGoal = require('../../models/LearningGoal');
const StudyTimeLog = require('../../models/StudyTimeLog');

const TEST_DB = process.env.TEST_DATABASE_URI || '';
const dbSkip = /test/i.test(TEST_DB) ? false : 'TEST_DATABASE_URI (test DB) chưa cấu hình';

test('vnDayKey dùng ngày theo giờ Việt Nam', () => {
  assert.equal(learningGoalService.vnDayKey(new Date('2026-11-03T17:30:00Z')), '2026-11-04');
  assert.equal(learningGoalService.vnDayKey(new Date('2026-11-03T16:59:00Z')), '2026-11-03');
});

test('mục tiêu học: đặt, tính tiến độ, heartbeat chống bơm phút', { skip: dbSkip }, async () => {
  await mongoose.connect(TEST_DB);
  const studentId = new mongoose.Types.ObjectId();
  try {
    const empty = await learningGoalService.getLearningGoal(studentId);
    assert.equal(empty.goal, null);
    assert.equal(empty.progress.todayMinutes, 0);

    await assert.rejects(learningGoalService.setLearningGoal(studentId, { period: 'year', hoursPerDay: 2 }), { status: 400 });
    await assert.rejects(learningGoalService.setLearningGoal(studentId, { period: 'week', hoursPerDay: 6 }), { status: 400 });
    await assert.rejects(learningGoalService.setLearningGoal(studentId, { period: 'week', hoursPerDay: 0 }), { status: 400 });

    const saved = await learningGoalService.setLearningGoal(studentId, { period: 'month', hoursPerDay: 3 });
    assert.equal(saved.goal.period, 'month');
    assert.equal(saved.goal.hoursPerDay, 3);
    assert.equal(saved.goal.expired, false);
    assert.equal(saved.progress.totalDays, 30);
    assert.equal(saved.progress.dailyTargetMinutes, 180);
    assert.equal(saved.progress.periodTargetMinutes, 180 * 30);

    const now = new Date();
    assert.equal((await learningGoalService.recordStudyMinute(studentId, now)).todayMinutes, 1);
    assert.equal((await learningGoalService.recordStudyMinute(studentId, new Date(now.getTime() + 10 * 1000))).todayMinutes, 1, 'heartbeat quá sát bị bỏ qua');
    assert.equal((await learningGoalService.recordStudyMinute(studentId, new Date(now.getTime() + 60 * 1000))).todayMinutes, 2);

    const progress = await learningGoalService.getLearningGoal(studentId);
    assert.equal(progress.progress.periodMinutes, 2);

    await LearningGoal.updateOne({ studentId }, { $set: { endsAt: new Date(Date.now() - 1000) } });
    const expired = await learningGoalService.getLearningGoal(studentId);
    assert.equal(expired.goal.expired, true, 'hết hạn thì popup hỏi lại');
    assert.equal(expired.progress.daysLeft, 0);

    const renewed = await learningGoalService.setLearningGoal(studentId, { period: 'week', hoursPerDay: 1 });
    assert.equal(renewed.goal.expired, false);
    assert.equal(await LearningGoal.countDocuments({ studentId }), 1, 'mỗi học viên chỉ một mục tiêu');
  } finally {
    await LearningGoal.deleteMany({ studentId });
    await StudyTimeLog.deleteMany({ studentId });
    await mongoose.disconnect();
  }
});

test('countAnswered chỉ đếm câu có trả lời thật', () => {
  const { countAnswered } = learningGoalService;
  assert.equal(countAnswered(['A', '', null, 'C', []]), 2);
  assert.equal(countAnswered({ q1: 'A', q2: '', q3: ['x'] }), 2);
  assert.equal(countAnswered([{ value: 'A' }, { value: '' }, { value: { a: 1 } }]), 2);
  assert.equal(countAnswered(undefined), 0);
});

test('bằng chứng học: cộng số câu / video theo ngày và trả về trong tiến độ', { skip: dbSkip }, async () => {
  await mongoose.connect(TEST_DB);
  const studentId = new mongoose.Types.ObjectId();
  try {
    await learningGoalService.recordStudyActivity(studentId, { questions: 3 });
    await learningGoalService.recordStudyActivity(studentId, { questions: 2, videos: 1 });
    await learningGoalService.recordStudyActivity(studentId, { questions: -5, videos: 'x' });
    const noGoal = await learningGoalService.getLearningGoal(studentId);
    assert.equal(noGoal.progress.todayQuestions, 5);
    assert.equal(noGoal.progress.todayVideos, 1);

    await learningGoalService.setLearningGoal(studentId, { period: 'week', hoursPerDay: 1 });
    await learningGoalService.recordStudyMinute(studentId);
    const withGoal = await learningGoalService.getLearningGoal(studentId);
    assert.equal(withGoal.progress.periodQuestions, 5);
    assert.equal(withGoal.progress.periodVideos, 1);
    assert.equal(withGoal.progress.todayMinutes, 1, 'phút học và bằng chứng dùng chung một nhật ký ngày');
  } finally {
    await LearningGoal.deleteMany({ studentId });
    await StudyTimeLog.deleteMany({ studentId });
    await mongoose.disconnect();
  }
});

test('luyện tập hằng ngày: thời lượng lượt chơi cộng vào phút học trong ngày', { skip: dbSkip }, async () => {
  await mongoose.connect(TEST_DB);
  const studentId = new mongoose.Types.ObjectId();
  try {
    const first = await learningGoalService.recordStudyDuration(studentId, 90);
    assert.equal(first.addedMinutes, 2);
    assert.equal(first.todayMinutes, 2);
    const second = await learningGoalService.recordStudyDuration(studentId, 240);
    assert.equal(second.addedMinutes, 4);
    assert.equal(second.todayMinutes, 6);
    const progress = await learningGoalService.getLearningGoal(studentId);
    assert.equal(progress.progress.todayMinutes, 6);
  } finally {
    await StudyTimeLog.deleteMany({ studentId });
    await mongoose.disconnect();
  }
});

test('bằng chứng học được ghi ở mọi nơi HV làm bài / xem video', () => {
  assert.ok(read('routes/lessonPracticeRoutes.js').includes('if (data && !data.retry && data.alreadyConfirmed === false)'), 'chỉ câu luyện tập được chấp nhận lần đầu');
  const lessonService = read('services/lessonPracticeService.js');
  assert.ok(lessonService.includes("if (section === 'video' && marked.modifiedCount)"), 'mỗi video chỉ tính một lần');
  assert.ok(read('services/certPrepService.js').includes('trackStudyActivity(sid, { questions: newlyAnswered })'), 'ôn thi chỉ đếm câu mới trả lời');
  assert.ok(read('routes/quizRoutes.js').includes('trackStudyActivity(student._id, { questions: learningGoalService.countAnswered(userAnswers) })'));
  assert.ok(read('routes/studentRoutes.js').includes('trackStudyActivity(student._id, { questions: learningGoalService.countAnswered(req.body?.answers) })'));
});

test('bộ đếm phút: rảnh 3 phút thì dừng, video đang phát vẫn tính, cần focus trên web', () => {
  const web = read('client/src/components/student/StudyHeartbeat.jsx');
  assert.ok(web.includes('const IDLE_MS = 3 * 60 * 1000;'));
  assert.ok(web.includes('if (!isStudyMediaPlaying()) {'));
  assert.ok(web.includes('if (!document.hasFocus()) return;'));
  assert.ok(read('client/src/components/lms/StudentVideoPlayer.jsx').includes('setStudyMediaPlaying(key, isPlaying)'));

  const mobile = read('thang-tin-hoc-mobile/src/services/studyActivity.ts');
  assert.ok(mobile.includes('const IDLE_MS = 3 * 60 * 1000;'));
  assert.ok(mobile.includes('return isStudyMediaPlaying(now) || now - lastTouchAt <= IDLE_MS;'));
  assert.ok(read('thang-tin-hoc-mobile/src/screens/VideoPlayerFrame.native.tsx').includes('noteStudyMediaProgress(progress.playing)'));
  assert.ok(read('thang-tin-hoc-mobile/src/screens/VideoPlayerFrame.web.tsx').includes('noteStudyMediaProgress(playing)'));
  assert.ok(read('thang-tin-hoc-mobile/src/components/LearningGoalModal.tsx').includes("routeName === 'DailyPractice'"));
  assert.ok(web.includes('onDailyPractice'));
  assert.ok(read('services/dailyPracticeService.js').includes('trackStudyDuration'));
});

test('bảng xếp hạng: tuần bắt đầu thứ Hai (giờ VN) và rút gọn tên', () => {
  const { vnWeek, shortName } = require('../../services/learningLeaderboardService');
  const wed = vnWeek(new Date('2026-11-04T05:00:00Z'));
  assert.equal(wed.startKey, '2026-11-02');
  assert.equal(wed.endKey, '2026-11-08');
  assert.equal(wed.daysSoFar, 3);
  assert.equal(vnWeek(new Date('2026-11-08T16:30:00Z')).startKey, '2026-11-02', '23:30 Chủ nhật VN vẫn là tuần cũ');
  const mondayVn = vnWeek(new Date('2026-11-08T17:30:00Z'));
  assert.equal(mondayVn.startKey, '2026-11-09', '0:30 sáng thứ Hai VN sang tuần mới');
  assert.equal(mondayVn.daysSoFar, 1);
  assert.equal(shortName('Nguyễn Văn An'), 'Nguyễn V. An');
  assert.equal(shortName('Trần thị bích Ngọc'), 'Trần T. B. Ngọc');
  assert.equal(shortName('Lan Anh'), 'Lan Anh');
  assert.equal(shortName(''), 'Học viên');
});

test('bảng xếp hạng: xếp theo số ngày đạt mục tiêu, bằng nhau so phút; luôn có hạng của bạn', { skip: dbSkip }, async () => {
  const Student = require('../../models/Student');
  const leaderboard = require('../../services/learningLeaderboardService');
  await mongoose.connect(TEST_DB);
  const now = new Date('2026-11-04T05:00:00Z');
  const ids = [];
  try {
    await LearningGoal.deleteMany({});
    await StudyTimeLog.deleteMany({ day: { $gte: '2026-11-02', $lte: '2026-11-08' } });
    const make = async (name, hoursPerDay, dayMinutes) => {
      const student = await Student.collection.insertOne({ name, phone: `09${Date.now()}${ids.length}`.slice(0, 11) });
      const id = student.insertedId;
      ids.push(id);
      await LearningGoal.create({
        studentId: id, period: 'month', hoursPerDay,
        startedAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2026-12-01T00:00:00Z'),
      });
      for (const [day, minutes] of Object.entries(dayMinutes)) {
        await StudyTimeLog.create({ studentId: id, day, minutes });
      }
      return id;
    };
    // A: 2 ngày đạt mục tiêu 1h. B: 1 ngày đạt mục tiêu 5h nhưng học nhiều phút hơn. C: 2 ngày đạt, ít phút hơn A.
    const a = await make('Nguyễn Văn An', 1, { '2026-11-02': 60, '2026-11-03': 70 });
    const b = await make('Lê Bình', 5, { '2026-11-02': 300, '2026-11-03': 200 });
    const c = await make('Phạm Thị Cúc', 1, { '2026-11-02': 60, '2026-11-04': 60 });
    const lazy = await make('Đỗ Lười', 2, {});

    leaderboard.resetLeaderboardCache();
    const forB = await leaderboard.getWeeklyLeaderboard(b, now);
    assert.deepEqual(forB.top.map((row) => row.name), ['Nguyễn V. An', 'Phạm T. Cúc', 'Lê Bình']);
    assert.deepEqual(forB.top.map((row) => row.rank), [1, 2, 3]);
    assert.equal(forB.participants, 3, 'HV chưa học phút nào không lên bảng');
    assert.equal(forB.me.rank, 3);
    assert.ok(forB.top[2].isMe);
    assert.deepEqual(forB.me.ahead, { rank: 2, goalDays: 2, minutes: 120 });

    const forA = await leaderboard.getWeeklyLeaderboard(a, now);
    assert.equal(forA.me.rank, 1);
    assert.equal(forA.me.ahead, null);
    assert.equal(forA.daysSoFar, 3);

    const forLazy = await leaderboard.getWeeklyLeaderboard(lazy, now);
    assert.equal(forLazy.me.hasGoal, true);
    assert.equal(forLazy.me.rank, null);

    const forNoGoal = await leaderboard.getWeeklyLeaderboard(new mongoose.Types.ObjectId(), now);
    assert.equal(forNoGoal.me.hasGoal, false);
    assert.ok(!forNoGoal.top.some((row) => row.isMe));
    assert.ok(c);
  } finally {
    await LearningGoal.deleteMany({ studentId: { $in: ids } });
    await StudyTimeLog.deleteMany({ studentId: { $in: ids } });
    await Student.collection.deleteMany({ _id: { $in: ids } });
    leaderboard.resetLeaderboardCache();
    await mongoose.disconnect();
  }
});

test('Tổng quan có thẻ mục tiêu + xếp hạng; chọn khóa nằm trong “Khóa học của tôi” (web + mobile)', () => {
  const overview = read('client/src/components/student/StudentOverviewTab.jsx');
  assert.match(overview, /<LearningGoalCard \/>\s*<LearningLeaderboardCard \/>/);
  assert.ok(overview.includes('aria-label="Chọn khóa học"'));
  assert.ok(read('client/src/services/lessonPracticeApi.js').includes('/lesson-practice/my/learning-leaderboard'));
  assert.ok(read('routes/lessonPracticeRoutes.js').includes("router.get('/my/learning-leaderboard', ...requireStudent"));

  const home = read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  assert.ok(home.includes('<LearningLeaderboardCard />'));
  assert.ok(home.includes('<CompactCoursePicker items={coursePickerItems}'));
  assert.ok(!home.includes('styles.courseSwitcher'), 'bỏ hàng thẻ khóa học lớn');
  assert.ok(read('thang-tin-hoc-mobile/src/services/learningGoalApi.ts').includes("'/lesson-practice/my/learning-leaderboard'"));
});

test('API chỉ dành cho học viên và dùng chung cho web + mobile', () => {
  const routes = read('routes/lessonPracticeRoutes.js');
  assert.match(routes, /router\.get\('\/my\/learning-goal', \.\.\.requireStudent/);
  assert.match(routes, /router\.put\('\/my\/learning-goal', \.\.\.requireStudent/);
  assert.match(routes, /router\.post\('\/my\/study-heartbeat', \.\.\.requireStudent/);

  const webApi = read('client/src/services/lessonPracticeApi.js');
  assert.ok(webApi.includes('/my/learning-goal'));
  assert.ok(webApi.includes('/my/study-heartbeat'));
  const mobileApi = read('thang-tin-hoc-mobile/src/services/learningGoalApi.ts');
  assert.ok(mobileApi.includes("'/lesson-practice/my/learning-goal'"));
  assert.ok(mobileApi.includes("'/lesson-practice/my/study-heartbeat'"));
});

test('popup chỉ tự mở khi chưa từng đặt mục tiêu, không đè khóa PIN trên mobile', () => {
  const layout = read('client/src/components/DashboardLayout.jsx');
  assert.ok(layout.includes('if (goal) return;'));
  assert.ok(layout.includes('const goalPromptPending = !goal && sessionStorage.getItem(learningGoalLaterKey) !== \'1\';'));
  assert.ok(layout.includes('<LearningGoalModal'));
  assert.ok(read('client/src/App.jsx').includes("session?.role === 'student' && <StudyHeartbeat />"));
  assert.ok(read('client/src/components/student/StudentProfileTab.jsx').includes('onClick={openLearningGoal}'));
  assert.ok(read('client/src/components/student/StudentOverviewTab.jsx').includes('<LearningGoalCard />'));

  const host = read('thang-tin-hoc-mobile/src/components/LearningGoalModal.tsx');
  assert.ok(host.includes('if (data.goal) return;'));
  assert.ok(host.includes('Boolean(data?.goal) || dismissedRef.current'));
  assert.ok(host.includes('{open && !pinLocked ? ('), 'không hiện đè khóa PIN');
  assert.ok(read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx').includes('<LearningGoalHost user={user} />'));
  assert.ok(read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx').includes('<LearningGoalCard />'));
  assert.ok(read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx').includes('DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT)'));
});

test('thẻ mục tiêu: "Nhiệm vụ hôm nay" gồm Luyện tập + Xem video, bấm là tới đúng chỗ (web + mobile)', () => {
  const web = read('client/src/components/student/LearningGoalCard.jsx');
  assert.ok(web.includes('Nhiệm vụ hôm nay'));
  assert.ok(!web.includes('Hôm nay đã học'));
  assert.ok(web.includes("navigate('/student/daily-practice')"));
  assert.ok(web.includes('lessonResumeUrl(res.data)'), 'xem video mở đúng video đang học dở');

  const mobile = read('thang-tin-hoc-mobile/src/components/LearningGoalCard.tsx');
  assert.ok(mobile.includes('Nhiệm vụ hôm nay'));
  assert.ok(!mobile.includes('Hôm nay đã học'));
  assert.ok(mobile.includes("navigation.navigate('DailyPractice')"));
  assert.ok(mobile.includes('getStudyResumePoint()'));
});
