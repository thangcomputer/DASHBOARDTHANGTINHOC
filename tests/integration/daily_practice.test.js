'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const rules = require('../../services/dailyPracticeRules');
const { STARTER_TOPICS } = require('../../services/dailyPracticeStarter');

const TEST_DB = process.env.TEST_DATABASE_URI || '';
const dbSkip = /test/i.test(TEST_DB) ? false : 'TEST_DATABASE_URI (test DB) chưa cấu hình';

const SAMPLES = {
  mcq: { type: 'mcq', difficulty: 'easy', prompt: 'Ctrl + C?', options: ['Sao chép', 'Dán', 'Cắt'], correctIndex: 0 },
  truefalse: { type: 'truefalse', difficulty: 'easy', prompt: 'Ctrl + Z là Undo', answerBool: true },
  order: { type: 'order', difficulty: 'medium', prompt: 'Sắp xếp', items: ['B1', 'B2', 'B3', 'B4'] },
  match: { type: 'match', difficulty: 'medium', prompt: 'Ghép', pairs: [{ left: 'Ctrl + X', right: 'Cắt' }, { left: 'Ctrl + V', right: 'Dán' }, { left: 'Ctrl + A', right: 'Chọn tất cả' }] },
  fill: { type: 'fill', difficulty: 'hard', prompt: 'Điền', text: 'Nhấn {{Ctrl}} + {{S}} để lưu', distractors: ['Alt'] },
  sort: { type: 'sort', difficulty: 'hard', prompt: 'Phân loại', groups: [{ name: 'Nhập', items: ['Chuột', 'Bàn phím'] }, { name: 'Xuất', items: ['Màn hình'] }] },
};

const CORRECT = {
  mcq: { index: 0 },
  truefalse: { value: true },
  order: { items: ['B1', 'B2', 'B3', 'B4'] },
  match: { pairs: [{ left: 'Ctrl + A', right: 'Chọn tất cả' }, { left: 'Ctrl + X', right: 'Cắt' }, { left: 'Ctrl + V', right: 'Dán' }] },
  fill: { blanks: ['ctrl', 's'] },
  sort: { placements: { Chuột: 'Nhập', 'Bàn phím': 'Nhập', 'Màn hình': 'Xuất' } },
};

const WRONG = {
  mcq: { index: 1 },
  truefalse: { value: false },
  order: { items: ['B2', 'B1', 'B3', 'B4'] },
  match: { pairs: [{ left: 'Ctrl + X', right: 'Dán' }, { left: 'Ctrl + V', right: 'Cắt' }, { left: 'Ctrl + A', right: 'Chọn tất cả' }] },
  fill: { blanks: ['Alt', 'S'] },
  sort: { placements: { Chuột: 'Xuất', 'Bàn phím': 'Nhập', 'Màn hình': 'Xuất' } },
};

test('chấm đúng/sai cho cả 6 dạng câu hỏi', () => {
  for (const type of rules.TYPES) {
    const q = rules.validateQuestion(SAMPLES[type]);
    assert.equal(rules.gradeAnswer(q, CORRECT[type]), true, `${type} đúng`);
    assert.equal(rules.gradeAnswer(q, WRONG[type]), false, `${type} sai`);
    assert.equal(rules.gradeAnswer(q, {}), false, `${type} bỏ trống`);
  }
  assert.equal(rules.gradeAnswer(rules.validateQuestion(SAMPLES.truefalse), { value: 'true' }), false, 'Đúng/Sai phải là boolean');
});

test('kiểm tra dữ liệu câu hỏi chặn câu sai cấu trúc', () => {
  const bad = [
    { ...SAMPLES.mcq, correctIndex: 5 },
    { ...SAMPLES.mcq, options: ['A', 'A'] },
    { ...SAMPLES.truefalse, answerBool: undefined },
    { ...SAMPLES.order, items: ['A', 'B'] },
    { ...SAMPLES.match, pairs: [{ left: 'A', right: '1' }] },
    { ...SAMPLES.fill, text: 'Không có chỗ trống' },
    { ...SAMPLES.fill, distractors: ['Ctrl'] },
    { ...SAMPLES.sort, groups: [{ name: 'Một', items: ['x'] }] },
    { ...SAMPLES.mcq, type: 'essay' },
    { ...SAMPLES.mcq, difficulty: 'expert' },
    { ...SAMPLES.mcq, prompt: '   ' },
  ];
  for (const input of bad) assert.throws(() => rules.validateQuestion(input), { status: 400 });
});

test('câu gửi học viên không lộ đáp án; câu sắp xếp luôn bị xáo', () => {
  for (const type of rules.TYPES) {
    const view = rules.publicQuestion({ ...rules.validateQuestion(SAMPLES[type]), _id: 'q1' });
    for (const secret of ['correctIndex', 'answerBool', 'pairs', 'text', 'distractors', 'explanation', 'hint']) {
      assert.equal(view[secret], undefined, `${type} lộ ${secret}`);
    }
    if (type === 'sort') assert.ok(view.groups.every((g) => typeof g === 'string'), 'chỉ gửi tên nhóm');
  }
  const order = rules.validateQuestion(SAMPLES.order);
  for (let i = 0; i < 20; i += 1) {
    assert.notDeepEqual(rules.publicQuestion({ ...order, _id: 'q' }).items, order.items);
  }
  const fill = rules.publicQuestion({ ...rules.validateQuestion(SAMPLES.fill), _id: 'q' });
  assert.deepEqual([...fill.bank].sort(), ['Alt', 'Ctrl', 'S']);
  assert.deepEqual(fill.segments.filter((s) => s.blank !== undefined).map((s) => s.blank), [0, 1]);
});

test('gợi ý loại phương án sai / lộ một phần đáp án đúng', () => {
  const mcq = rules.validateQuestion({ ...SAMPLES.mcq, options: ['A', 'B', 'C', 'D'], correctIndex: 2 });
  const { reveal } = rules.hintReveal(mcq);
  assert.equal(reveal.eliminate.length, 2);
  assert.ok(!reveal.eliminate.includes(2));
  assert.equal(rules.hintReveal(rules.validateQuestion(SAMPLES.order)).reveal.first, 'B1');
  assert.deepEqual(rules.hintReveal(rules.validateQuestion(SAMPLES.fill)).reveal.blank, { index: 0, word: 'Ctrl' });
  assert.ok(rules.hintReveal(rules.validateQuestion(SAMPLES.truefalse)).hint, 'luôn có lời gợi ý mặc định');
});

test('XP, sao, thưởng và chuỗi ngày', () => {
  assert.equal(rules.xpFor('hard', { correct: true, hintUsed: false }), 20);
  assert.equal(rules.xpFor('hard', { correct: true, hintUsed: true }), 10, 'dùng gợi ý nửa XP');
  assert.equal(rules.xpFor('easy', { correct: false }), 0);
  assert.deepEqual([10, 9, 7, 4, 3].map((c) => rules.starsFor(c, 10)), [3, 3, 2, 1, 0]);
  assert.deepEqual([10, 8, 7].map((c) => rules.bonusFor(c, 10)), [20, 10, 0]);
  assert.equal(rules.nextStreak({ lastPlayedDay: '2026-11-03', streak: 4 }, '2026-11-04'), 5);
  assert.equal(rules.nextStreak({ lastPlayedDay: '2026-11-04', streak: 5 }, '2026-11-04'), 5, 'chơi nhiều lượt trong ngày không tăng thêm');
  assert.equal(rules.nextStreak({ lastPlayedDay: '2026-11-01', streak: 9 }, '2026-11-04'), 1, 'bỏ ngày thì tính lại');
  assert.equal(rules.nextStreak({ lastPlayedDay: '2026-02-28', streak: 2 }, '2026-03-01'), 3, 'qua tháng');
  assert.equal(rules.liveStreak({ lastPlayedDay: '2026-11-01', streak: 9 }, '2026-11-04'), 0);
});

test('trạng thái chuỗi chọn đúng lời nhắc: mới / đã luyện / sắp mất / đã lỡ', () => {
  const today = '2026-11-04';
  assert.deepEqual(rules.streakStatus(null, today), { state: 'new', lostStreak: 0, missedDays: 0 });
  assert.equal(rules.streakStatus({ lastPlayedDay: today, streak: 3 }, today).state, 'active');
  assert.equal(rules.streakStatus({ lastPlayedDay: '2026-11-03', streak: 3 }, today).state, 'at_risk');
  assert.deepEqual(rules.streakStatus({ lastPlayedDay: '2026-11-01', streak: 7 }, today), { state: 'lost', lostStreak: 7, missedDays: 2 });
  assert.deepEqual(rules.streakStatus({ lastPlayedDay: '2026-10-31', streak: 1 }, '2026-11-02'), { state: 'lost', lostStreak: 1, missedDays: 1 });
});

test('popup nhắc dùng lời thúc đẩy "đã lỡ chuỗi — lấy lại phong độ" (web + mobile cùng nội dung)', async () => {
  const web = await import('../../client/src/utils/dailyPractice.js').catch(() => null);
  const source = read('client/src/utils/dailyPractice.js');
  assert.ok(source.includes('title: `Bạn đã lỡ chuỗi 🔥 ${stats.lostStreak} ngày!`'));
  assert.ok(source.includes('luyện tập ngay bây giờ để lấy lại phong độ'));
  assert.ok(source.includes("cta: 'Lấy lại phong độ ngay'"));
  assert.ok(source.includes('title: `Chuỗi 🔥 ${streak} ngày sắp mất!`'));
  if (web?.reminderCopy) {
    assert.equal(web.reminderCopy({ streakState: 'lost', lostStreak: 5, missedDays: 2 }).cta, 'Lấy lại phong độ ngay');
    assert.equal(web.reminderCopy({ streakState: 'at_risk', streak: 4 }).cta, 'Giữ chuỗi ngay');
    assert.equal(web.reminderCopy({ streakState: 'new' }, 6).cta, 'Luyện tập ngay');
  }
  const mobile = read('thang-tin-hoc-mobile/src/services/dailyPracticeApi.ts');
  assert.ok(mobile.includes('title: `Bạn đã lỡ chuỗi 🔥 ${stats.lostStreak} ngày!`'));
  assert.ok(mobile.includes("cta: 'Lấy lại phong độ ngay'"));
  assert.ok(read('services/dailyPracticeService.js').includes('todayPlayers,'), 'kèm số học viên đã luyện hôm nay');
});

test('bộ câu hỏi mẫu hợp lệ, đủ 6 dạng và 3 độ khó', () => {
  assert.equal(STARTER_TOPICS.length, 6);
  const types = new Set();
  const levels = new Set();
  for (const topic of STARTER_TOPICS) {
    for (const q of topic.questions) {
      rules.validateQuestion(q);
      types.add(q.type);
      levels.add(q.difficulty);
      assert.ok(q.hint && q.explanation, `${topic.name}: "${q.prompt}" cần gợi ý + giải thích`);
    }
  }
  assert.deepEqual([...types].sort(), [...rules.TYPES].sort());
  assert.deepEqual([...levels].sort(), ['easy', 'hard', 'medium']);
});

test('lượt chơi đầy đủ: bắt đầu → trả lời → gợi ý → kết thúc → XP, chuỗi ngày, mục tiêu học, bảng xếp hạng', { skip: dbSkip }, async () => {
  const DailyPracticeTopic = require('../../models/DailyPracticeTopic');
  const DailyPracticeQuestion = require('../../models/DailyPracticeQuestion');
  const DailyPracticeSession = require('../../models/DailyPracticeSession');
  const DailyPracticeProfile = require('../../models/DailyPracticeProfile');
  const StudyTimeLog = require('../../models/StudyTimeLog');
  const service = require('../../services/dailyPracticeService');
  const studentId = new mongoose.Types.ObjectId();
  await mongoose.connect(TEST_DB);
  let topicId;
  try {
    const topic = await service.createTopic({ name: `Test ${Date.now()}`, icon: 'keyboard', color: 'purple' });
    topicId = topic.id;
    for (const type of rules.TYPES) await service.createQuestion({ ...SAMPLES[type], topicId, difficulty: 'easy' });
    await service.createQuestion({ ...SAMPLES.mcq, topicId, difficulty: 'easy', status: 'draft', prompt: 'Câu nháp' });

    const overview = await service.getOverview(studentId);
    const listed = overview.topics.find((t) => t.id === topicId);
    assert.equal(listed.counts.easy, 6, 'câu nháp không hiện cho học viên');
    assert.equal(listed.counts.draft, undefined);

    const session = await service.startSession(studentId, { topicId, difficulty: 'easy' });
    assert.equal(session.total, 6);
    assert.ok(!session.questions.some((q) => q.prompt === 'Câu nháp'));

    const byType = Object.fromEntries(session.questions.map((q) => [q.type, q]));
    await service.useHint(studentId, session.id, { questionId: byType.mcq.id });
    const mcq = await service.answerQuestion(studentId, session.id, { questionId: byType.mcq.id, answer: CORRECT.mcq });
    assert.equal(mcq.correct, true);
    assert.equal(mcq.xp, 0, 'luyện tự do không cộng XP từng câu');
    assert.ok(session.xpDisabled || session.mode === 'free');
    await assert.rejects(service.answerQuestion(studentId, session.id, { questionId: byType.mcq.id, answer: CORRECT.mcq }), { status: 409 });
    await assert.rejects(service.useHint(studentId, session.id, { questionId: byType.mcq.id }), { status: 409 });

    const wrong = await service.answerQuestion(studentId, session.id, { questionId: byType.order.id, answer: WRONG.order });
    assert.equal(wrong.correct, false);
    assert.deepEqual(wrong.correctAnswer.items, SAMPLES.order.items);
    for (const type of ['truefalse', 'match', 'fill', 'sort']) {
      const res = await service.answerQuestion(studentId, session.id, { questionId: byType[type].id, answer: CORRECT[type] });
      assert.equal(res.correct, true, type);
    }

    await assert.rejects(service.finishSession(new mongoose.Types.ObjectId(), session.id), { status: 404 }, 'không kết thúc lượt của người khác');
    const summary = await service.finishSession(studentId, session.id);
    assert.equal(summary.correctCount, 5);
    assert.equal(summary.stars, 2);
    assert.equal(summary.xp, 0);
    assert.equal(summary.bonusXp, 0);
    assert.equal(summary.gainedXp, 0, 'luyện tự do không đổi ví');
    assert.equal(summary.xpDisabled, true);
    assert.equal(summary.passed, true, '≥60% vẫn tính đạt lượt tự do');
    assert.equal(summary.stats.streak, 1);
    assert.equal(summary.streakIncreased, true);
    assert.deepEqual(summary.review.map((r) => r.type), ['order']);
    await assert.rejects(service.finishSession(studentId, session.id), { status: 409 });

    const profile = await DailyPracticeProfile.findOne({ studentId }).lean();
    assert.equal(profile.xpTotal, 200, 'mới tạo hồ sơ nhận allowance ngày, không cộng từ luyện tự do');

    await new Promise((resolve) => { setTimeout(resolve, 200); });
    const log = await StudyTimeLog.findOne({ studentId }).lean();
    assert.equal(log.questions, 6, 'mỗi câu trả lời tính vào mục tiêu học');

    const now = new Date();
    const xpMap = await service.xpByStudent(new Date(now.getTime() - 3600e3), new Date(now.getTime() + 3600e3), [studentId]);
    assert.equal(xpMap.get(String(studentId)) || 0, 0, 'BXH tuần tính net XP lộ trình, không gồm luyện tự do');

    const again = await service.startSession(studentId, { topicId, difficulty: 'hard' });
    assert.equal(again.total, 6, 'thiếu câu đúng độ khó thì bù từ độ khó khác cùng chủ đề');
  } finally {
    if (topicId) {
      await DailyPracticeQuestion.deleteMany({ topicId });
      await DailyPracticeTopic.deleteOne({ _id: topicId });
    }
    await DailyPracticeSession.deleteMany({ studentId });
    await DailyPracticeProfile.deleteMany({ studentId });
    await StudyTimeLog.deleteMany({ studentId });
    await mongoose.disconnect();
  }
});

test('popup nhắc luyện tập: một lần mỗi ngày, sau popup mục tiêu học, chỉ khi chưa luyện (web + mobile)', () => {
  const layout = read('client/src/components/DashboardLayout.jsx');
  assert.ok(layout.includes('if (dailyReminder.stats?.playedToday || !dailyReminder.topics?.length) return;'));
  assert.ok(layout.includes('if (showWelcomeCelebration || courseCelebration || learningGoalOpen || !learningGoalData) return;'));
  assert.ok(layout.includes('if (localStorage.getItem(dailyReminderKey) === vnTodayKey()) return;'));
  assert.ok(layout.includes("if (location.pathname.startsWith('/student/daily-practice')) return;"));
  assert.ok(layout.includes("navigate('/student/daily-practice')"));
  const { isPreservedPreferenceKey } = require('../../client/src/utils/logoutStorage.js');
  assert.equal(isPreservedPreferenceKey('cms_daily_practice_reminder:abc'), true, 'đăng xuất/đăng nhập lại trong ngày không hiện lại');

  const host = read('thang-tin-hoc-mobile/src/components/LearningGoalModal.tsx');
  assert.ok(host.includes('<DailyPracticeReminder userId={user.id} ready={goalSettled && !pinLocked} />'));
  const reminder = read('thang-tin-hoc-mobile/src/components/dailyPractice/DailyPracticeReminder.tsx');
  assert.ok(reminder.includes('if (data.stats.playedToday || !data.topicCount) return;'));
  assert.ok(reminder.includes('if (seen === today) return;'));
  assert.ok(reminder.includes("navigationRef.navigate('DailyPractice')"));
});

test('lối vào luyện tập hằng ngày khi HV chưa luyện nằm trong “Việc cần làm hôm nay” (web + mobile)', () => {
  const web = read('client/src/components/student/StudentOverviewTab.jsx');
  assert.ok(web.includes("if (practiceStats && !practiceStats.playedToday && practice.topics?.length) {"));
  assert.ok(web.includes("onClick: () => navigate('/student/daily-practice')"));
  assert.ok(!read('client/src/components/student/LearningGoalCard.jsx').includes('DailyStreakCta'), 'không lặp ở thẻ Mục tiêu');

  const mobile = read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  assert.ok(mobile.includes('if (practiceStats && !practiceStats.playedToday && practice?.topics.length) {'));
  assert.ok(mobile.includes("onPress: () => navigation?.navigate('DailyPractice')"));
  assert.ok(!read('thang-tin-hoc-mobile/src/components/LearningGoalCard.tsx').includes('DailyStreakCta'));
});

test('nút Thoát có popup xác nhận "sẽ mất chuỗi hôm nay" thay cho hộp thoại trình duyệt', () => {
  const web = read('client/src/components/student/dailyPractice/DailyPracticePage.jsx');
  assert.ok(!web.includes('window.confirm('), 'không dùng confirm mặc định');
  assert.ok(web.includes("'Bạn sẽ mất chuỗi hôm nay!'"));
  assert.ok(web.includes('Ở lại luyện tiếp'));
  assert.ok(web.includes('<LogOut size={16} aria-hidden="true" /> Thoát'));
  const mobile = read('thang-tin-hoc-mobile/src/screens/DailyPracticeScreen.tsx');
  assert.ok(!mobile.includes('Alert.alert('));
  assert.ok(mobile.includes("'Bạn sẽ mất chuỗi hôm nay!'"));
  assert.ok(mobile.includes('<Text style={styles.quitBtnText}>Thoát</Text>'));
});

test('gắn đủ: route server, menu + trang web, admin, màn mobile, đếm giờ học', () => {
  const server = read('server.js');
  assert.ok(server.includes("app.use('/api/daily-practice', dailyPracticeRoutes);"));
  const routes = read('routes/dailyPracticeRoutes.js');
  assert.ok(routes.includes("router.get('/my/overview', ...requireStudent"));
  assert.ok(routes.includes("router.post('/questions/ai-generate', ...requireAdmin"));
  assert.ok(!/router\.(get|post|put|delete)\('\/(topics|questions|starter)[^']*', (?!\.\.\.requireAdmin)/.test(routes), 'mọi route admin đều cần quyền');

  const sidebar = read('client/src/components/AppSidebar.jsx');
  assert.ok(sidebar.includes("{ key: 'daily-practice', icon: Gamepad2, label: 'Luyện tập hằng ngày', path: '/student/daily-practice'"));
  assert.ok(sidebar.includes("hash: 'daily-practice', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING"));
  assert.ok(read('client/src/App.jsx').includes('<Route path="/student/daily-practice"'));
  assert.ok(read('client/src/components/AdminDashboard.jsx').includes("activeTab === 'daily-practice' && <AdminLazyDailyPracticeTab />"));
  assert.ok(read('client/src/utils/learningGoal.js').includes('lesson-practice|daily-practice'));
  assert.ok(read('client/src/utils/sound.js').includes('export const gameSounds'));

  const navigator = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.ok(navigator.includes('<Stack.Screen name="DailyPractice" component={DailyPracticeScreen} />'));
  assert.ok(navigator.includes("{ label: 'Luyện tập hằng ngày', destination: 'DailyPractice', icon: Gamepad2 }"));
  assert.ok(read('thang-tin-hoc-mobile/src/components/LearningGoalModal.tsx').includes("'DailyPractice',"));
  for (const sound of ['tap', 'pick', 'drop', 'correct', 'wrong', 'hint', 'win', 'sad']) {
    assert.ok(fs.existsSync(path.join(ROOT, `thang-tin-hoc-mobile/src/assets/audio/game-${sound}.wav`)), `thiếu âm thanh ${sound}`);
  }
});
