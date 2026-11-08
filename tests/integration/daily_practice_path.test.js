'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pathService = require('../../services/dailyPracticePathService');

const TEST_DB = process.env.TEST_DATABASE_URI || '';
const dbSkip = /test/i.test(TEST_DB) ? false : 'TEST_DATABASE_URI (test DB) chưa cấu hình';

test('computeUnits: chặng sau mở khi chặng trước xong; bước sau mở khi bước trước xong', () => {
  const units = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];
  let computed = pathService.computeUnits(units, new Map());
  assert.deepEqual(computed.map((u) => u.state), ['active', 'locked', 'locked']);
  assert.equal(computed[0].pathNodes[0].kind, 'study');
  assert.equal(computed[0].pathNodes[0].state, 'completed', 'Học bài trống bài → bỏ qua');
  const firstQuiz = computed[0].pathNodes.find((node) => node.kind === 'quiz');
  assert.deepEqual(firstQuiz.levels.map((s) => s.state), ['active', 'locked', 'locked']);
  assert.equal(computed[1].canTestOut, true);

  computed = pathService.computeUnits(units, new Map([
    ['a', { completedSteps: ['learn', 'practice', 'challenge'], completedAt: new Date() }],
    ['b', { completedSteps: ['practice-1:learn'] }],
  ]));
  assert.deepEqual(computed.map((u) => u.state), ['completed', 'active', 'locked']);
  const bPractice = computed[1].pathNodes.find((node) => node.key === 'practice-1');
  assert.deepEqual(bPractice.levels.map((s) => s.state), ['completed', 'active', 'locked']);
  assert.equal(computed[0].canTestOut, false);
  assert.equal(firstQuiz.levels.find((s) => s.key === 'challenge').passPercent, 60);
});

test('quyền kiểm tra vượt lấy theo trạng thái gói đang hiệu lực, không theo cờ freePortal', () => {
  const now = new Date('2026-11-08T00:00:00.000Z');
  const paidStudent = {
    freePortal: true,
    subscription: {
      plan: '3m',
      activatedAt: new Date('2026-10-01T00:00:00.000Z'),
      expiresAt: new Date('2027-02-08T00:00:00.000Z'),
    },
  };
  assert.equal(pathService.hasTestOutAccess(paidStudent, now), true);
  assert.equal(pathService.hasTestOutAccess({
    freePortal: true,
    subscription: { plan: '3m', expiresAt: new Date('2026-11-07T00:00:00.000Z') },
  }, now), false);

  const pathView = read('client/src/components/student/dailyPractice/PathView.jsx');
  assert.ok(pathView.includes('canTestOut={path?.canTestOut === true}'));
  assert.ok(pathView.includes('onClick={onUpgrade}'));
  assert.ok(!pathView.includes('isFreePortalAccount'));

  const practicePage = read('client/src/components/student/dailyPractice/DailyPracticePage.jsx');
  assert.ok(practicePage.includes('testOutLocked={stakeConfirm.testOut && path?.canTestOut !== true}'));
  assert.ok(!practicePage.includes('isFreePortal={isFreePortalAccount()}'));
});

test('lộ trình trên DB: tự tạo chặng Tổng hợp, mở khóa tuần tự, kiểm tra vượt chặng', { skip: dbSkip }, async () => {
  const service = require('../../services/dailyPracticeService');
  const Student = require('../../models/Student');
  const DailyPracticeTopic = require('../../models/DailyPracticeTopic');
  const DailyPracticeUnit = require('../../models/DailyPracticeUnit');
  const DailyPracticeQuestion = require('../../models/DailyPracticeQuestion');
  const DailyPracticeSession = require('../../models/DailyPracticeSession');
  const DailyPracticeProfile = require('../../models/DailyPracticeProfile');
  const DailyPracticePathProgress = require('../../models/DailyPracticePathProgress');
  const LessonSubject = require('../../models/LessonSubject');
  const LessonUnit = require('../../models/LessonUnit');
  let lessonSubject = null;

  await mongoose.connect(TEST_DB);
  const studentId = new mongoose.Types.ObjectId();
  const otherStudentId = new mongoose.Types.ObjectId();
  const topicIds = [];
  const mcq = (difficulty, i, extra = {}) => ({
    type: 'mcq', difficulty, prompt: `${difficulty} câu ${i}`, options: ['Đúng', 'Sai 1', 'Sai 2'], correctIndex: 0, ...extra,
  });
  const playAll = async (sid, session, correctCount) => {
    for (const [index, question] of session.questions.entries()) {
      await service.answerQuestion(sid, session.id, { questionId: question.id, answer: { index: index < correctCount ? 0 : 1 } });
    }
    return service.finishSession(sid, session.id);
  };
  try {
    await Student.collection.insertMany([
      { _id: studentId, name: 'HV Lộ trình' },
      {
        _id: otherStudentId,
        name: 'HV Vượt',
        subscription: {
          plan: '3m',
          activatedAt: new Date(Date.now() - 86400000),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      },
    ]);
    const topic = await service.createTopic({ name: `Lộ trình ${Date.now()}` });
    topicIds.push(topic.id);
    const otherTopic = await service.createTopic({ name: `Khác ${Date.now()}` });
    topicIds.push(otherTopic.id);
    await DailyPracticeQuestion.insertMany(['easy', 'medium', 'hard'].flatMap((difficulty) => (
      [1, 2, 3, 4].map((i) => ({ ...mcq(difficulty, i), topicId: topic.id, status: 'published' }))
    )));

    // Chủ đề chưa có chặng → tự gom câu cũ vào chặng "Tổng hợp".
    const listed = await pathService.listUnits(topic.id);
    assert.equal(listed.units.length, 1);
    assert.equal(listed.units[0].title, 'Tổng hợp');
    assert.equal(listed.units[0].counts.total, 12);
    assert.equal(listed.unassigned, 0);
    await pathService.listUnits(topic.id);
    assert.equal(await DailyPracticeUnit.countDocuments({ topicId: topic.id }), 1, 'không tạo trùng chặng tự động');
    const unit1 = listed.units[0];

    await assert.rejects(
      pathService.createUnit(topic.id, { title: 'Sai link', videos: [{ title: 'Video', url: 'javascript:alert(1)' }] }),
      { status: 400 },
      'chỉ nhận link video http(s)',
    );
    const unit2 = await pathService.createUnit(topic.id, {
      title: 'Chặng 2',
      videos: [{ title: 'Giới thiệu chặng 2', url: 'https://youtu.be/dQw4w9WgXcQ' }],
    });
    assert.equal(unit2.sortOrder, 2);
    assert.equal(unit2.videos.length, 1);
    const unit2VideoId = unit2.videos[0].id;
    const renamed = await pathService.updateUnit(unit2.id, {
      title: 'Chặng 2',
      videos: [{ id: unit2VideoId, title: 'Giới thiệu (mới)', url: 'https://youtu.be/dQw4w9WgXcQ' }, { title: 'Video thêm', url: 'https://example.com/a.mp4' }],
    });
    assert.equal(renamed.videos[0].id, unit2VideoId, 'sửa video giữ nguyên id để không mất trạng thái đã xem');
    assert.equal(renamed.videos.length, 2);
    await assert.rejects(
      pathService.markVideoWatched(studentId, { unitId: unit2.id, videoId: unit2VideoId }),
      { status: 403 },
      'chặng còn khóa thì chưa ghi đã xem',
    );
    for (const i of [1, 2, 3, 4, 5]) {
      await service.createQuestion({ ...mcq(i <= 2 ? 'easy' : 'hard', i), topicId: topic.id, unitId: unit2.id }, null);
    }
    const otherUnit = await pathService.createUnit(otherTopic.id, { title: 'Lạ' });
    await assert.rejects(
      service.createQuestion({ ...mcq('easy', 9), topicId: topic.id, unitId: otherUnit.id }, null),
      { status: 400 },
      'không gắn câu vào chặng của chủ đề khác',
    );
    const filtered = await service.listQuestions({ topicId: topic.id, unitId: unit2.id });
    assert.equal(filtered.length, 5);
    assert.ok(filtered.every((q) => q.unitId === unit2.id));

    let myPath = (await pathService.getPath(studentId)).topics.find((t) => t.topic.id === topic.id);
    assert.deepEqual(myPath.units.map((u) => u.state), ['active', 'locked']);
    assert.equal(myPath.units[0].pathNodes[0].kind, 'study');
    assert.deepEqual(myPath.next, {
      unitId: unit1.id,
      unitTitle: 'Tổng hợp',
      nodeKey: 'practice-1',
      nodeLabel: 'Luyện tập',
      step: 'learn',
      stepLabel: 'Dễ',
      kind: 'quiz',
    });

    await assert.rejects(
      service.startSession(studentId, { mode: 'path', unitId: unit1.id, step: 'practice', nodeKey: 'practice-1' }),
      { status: 403 },
      'bước chưa mở thì không vào được',
    );

    // Luyện tập: đúng 2/4 (<60%) → chưa qua; đúng hết → qua, mở nấc Vừa.
    let session = await service.startSession(studentId, { mode: 'path', unitId: unit1.id, step: 'learn', nodeKey: 'practice-1' });
    assert.equal(session.path.step, 'learn');
    assert.equal(session.total, 10);
    assert.ok(session.questions.slice(0, 4).every((q) => q.difficulty === 'easy'), 'bước Dễ lấy câu dễ trước, thiếu thì bù câu khác của chặng');
    let result = await playAll(studentId, session, 2);
    assert.equal(result.path.passed, false);
    assert.equal(result.path.passPercent, 60);
    assert.equal(result.maxCombo, 2, 'combo = số câu đúng liên tiếp dài nhất');
    assert.ok(result.durationSeconds >= 1);
    assert.equal(result.firstToday, true, 'lượt đầu trong ngày → màn nhiệm vụ hằng ngày');
    assert.equal(result.week.length, 7);
    assert.deepEqual(result.week.map((d) => d.label), ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    assert.ok(result.week.some((d) => d.today && d.played));
    session = await service.startSession(studentId, { mode: 'path', unitId: unit1.id, step: 'learn', nodeKey: 'practice-1' });
    result = await playAll(studentId, session, session.questions.length);
    assert.equal(result.firstToday, false);
    assert.equal(result.maxCombo, session.questions.length);
    assert.equal(result.path.passed, true);
    assert.deepEqual(result.path.next, {
      unitId: unit1.id,
      unitTitle: 'Tổng hợp',
      nodeKey: 'practice-1',
      nodeLabel: 'Luyện tập',
      step: 'practice',
      stepLabel: 'Vừa',
      kind: 'quiz',
    });
    assert.equal(result.gainedXp, 50, 'đạt lượt có cược: 10 câu đúng +50 XP');

    const quizNodes = ['practice-1', 'challenge', 'practice-2', 'complete'];
    for (const nodeKey of quizNodes) {
      for (const step of ['learn', 'practice', 'challenge']) {
        if (nodeKey === 'practice-1' && step === 'learn') continue;
        session = await service.startSession(studentId, { mode: 'path', unitId: unit1.id, step, nodeKey });
        result = await playAll(studentId, session, session.questions.length);
        assert.equal(result.path.passed, true);
      }
    }
    assert.equal(result.path.unitCompleted, true);
    assert.equal(result.path.unlockedUnit.id, unit2.id, 'qua chặng 1 mở chặng 2');

    myPath = (await pathService.getPath(studentId)).topics.find((t) => t.topic.id === topic.id);
    assert.deepEqual(myPath.units.map((u) => u.state), ['completed', 'active']);
    assert.equal(myPath.completedUnits, 1);
    assert.deepEqual(myPath.units[1].videos.map((v) => v.state), ['active', 'active']);
    await pathService.markVideoWatched(studentId, { unitId: unit2.id, videoId: unit2VideoId });
    await pathService.markVideoWatched(studentId, { unitId: unit2.id, videoId: unit2VideoId });
    myPath = (await pathService.getPath(studentId)).topics.find((t) => t.topic.id === topic.id);
    assert.deepEqual(myPath.units[1].videos.map((v) => v.state), ['completed', 'active']);
    assert.deepEqual(myPath.units[1].steps.slice(0, 3).map((s) => s.state), ['active', 'locked', 'locked'], 'video không khóa các bước luyện');
    await assert.rejects(pathService.markVideoWatched(studentId, { unitId: unit2.id, videoId: 'khong-co' }), { status: 404 });

    // Popup video: video riêng + video buổi bài giảng (chỉ khi HV được mở buổi đó).
    const slug = `dp-path-video-${Date.now()}`;
    lessonSubject = await LessonSubject.create({ name: slug, slug, examSubjectId: slug });
    const lessonUnit = await LessonUnit.create({
      subjectId: lessonSubject._id, title: 'Buổi khóa trả phí', sortOrder: 1, videos: [{ id: 'v1', title: 'Video bài giảng', url: 'https://youtu.be/abcdefghijk' }],
    });
    await DailyPracticeUnit.updateOne({ _id: unit2.id }, { $set: { lessonUnitId: lessonUnit._id } });
    const playlist = await pathService.unitVideos(studentId, unit2.id);
    assert.equal(playlist.videos.length, 2);
    assert.equal(playlist.videos[0].state, 'completed');
    assert.equal(playlist.lesson.title, 'Buổi khóa trả phí');
    assert.equal(playlist.lesson.locked, true, 'chưa mua khóa thì không lộ link video bài giảng');
    assert.deepEqual(playlist.lesson.videos, []);

    // HV khác kiểm tra vượt chặng 2 → xong cả chặng 1 và 2.
    await assert.rejects(
      service.startSession(otherStudentId, { mode: 'path', unitId: unit2.id, step: 'learn' }),
      { status: 403 },
    );
    session = await service.startSession(otherStudentId, { mode: 'path', unitId: unit2.id, step: 'challenge', testOut: true });
    result = await playAll(otherStudentId, session, session.questions.length);
    assert.equal(result.path.passed, true);
    assert.equal(result.path.topicCompleted, true);
    const otherPath = (await pathService.getPath(otherStudentId)).topics.find((t) => t.topic.id === topic.id);
    assert.deepEqual(otherPath.units.map((u) => u.state), ['completed', 'completed']);
    assert.ok(otherPath.units.every((u) => u.testedOut));
    assert.equal(otherPath.next, null);

    // Xóa chặng: câu về "chưa xếp chặng", tiến độ chặng đó bị xóa.
    const removed = await pathService.deleteUnit(unit2.id);
    assert.equal(removed.releasedQuestions, 5);
    assert.equal(await DailyPracticePathProgress.countDocuments({ unitId: unit2.id }), 0);
    const assigned = await pathService.assignUnassigned(topic.id, { unitId: unit1.id });
    assert.equal(assigned.assigned, 5);
  } finally {
    if (lessonSubject) {
      await LessonUnit.deleteMany({ subjectId: lessonSubject._id });
      await LessonSubject.deleteOne({ _id: lessonSubject._id });
    }
    const ids = topicIds.map((id) => new mongoose.Types.ObjectId(id));
    await DailyPracticeQuestion.deleteMany({ topicId: { $in: ids } });
    await DailyPracticeUnit.deleteMany({ topicId: { $in: ids } });
    await DailyPracticeTopic.deleteMany({ _id: { $in: ids } });
    await DailyPracticePathProgress.deleteMany({ studentId: { $in: [studentId, otherStudentId] } });
    await DailyPracticeSession.deleteMany({ studentId: { $in: [studentId, otherStudentId] } });
    await DailyPracticeProfile.deleteMany({ studentId: { $in: [studentId, otherStudentId] } });
    await Student.collection.deleteMany({ _id: { $in: [studentId, otherStudentId] } });
    await mongoose.disconnect();
  }
});

test('giao diện lộ trình: web + mobile có màn lộ trình, luyện tự do và admin quản lý chặng', () => {
  const web = read('client/src/components/student/dailyPractice/DailyPracticePage.jsx');
  assert.ok(web.includes('<PathView'), 'web có màn lộ trình');
  assert.ok(web.includes('Luyện tự do'), 'web giữ chế độ luyện tự do');
  assert.ok(read('client/src/services/dailyPracticeApi.js').includes('/daily-practice/my/path'));
  const admin = read('client/src/components/admin/tabs/AdminDailyPracticeTab.jsx');
  assert.ok(admin.includes('<UnitsManager'), 'admin quản lý chặng');
  const mobile = read('thang-tin-hoc-mobile/src/screens/DailyPracticeScreen.tsx');
  assert.ok(mobile.includes('PathView'), 'mobile có màn lộ trình');
  assert.ok(mobile.includes('Luyện tự do'));
  assert.ok(web.includes('<Celebration'), 'web có chuỗi màn ăn mừng');
  assert.ok(web.includes('Combo x{combo}'), 'web hiện combo khi đúng liên tiếp');
  const webCelebration = read('client/src/components/student/dailyPractice/Celebration.jsx');
  for (const text of ['Đã luyện tập xong!', 'ngày liên tiếp', 'Hoàn thành nhiệm vụ hằng ngày!']) assert.ok(webCelebration.includes(text), text);
  assert.ok(read('client/src/components/student/dailyPractice/PathView.jsx').includes('<StepPopover'), 'web: bảng bắt đầu bật dưới nút');
  assert.ok(mobile.includes('<Celebration'), 'mobile có chuỗi màn ăn mừng');
  assert.ok(mobile.includes('<StepPopover'), 'mobile: bảng bắt đầu bật dưới nút');
  const mobileCelebration = read('thang-tin-hoc-mobile/src/components/dailyPractice/Celebration.tsx');
  for (const text of ['Đã luyện tập xong!', 'ngày liên tiếp', 'Hoàn thành nhiệm vụ hằng ngày!']) assert.ok(mobileCelebration.includes(text), text);
  assert.ok(read('client/src/components/student/dailyPractice/PathView.jsx').includes('<PathVideoModal'), 'web: bấm nút video mở popup');
  const webVideo = read('client/src/components/student/dailyPractice/PathVideoModal.jsx');
  assert.ok(webVideo.includes('<StudentVideoPlayer'), 'web: popup dùng trình phát Thắng Tin Học');
  assert.ok(webVideo.includes('appearance="window"'), 'web: trình phát kiểu cửa sổ video (nút đỏ lớn)');
  assert.ok(webVideo.includes('dp-video-backdrop'), 'web: nền blur popup video');
  assert.ok(!webVideo.includes('THẮNG TIN HỌC'), 'đầu popup không còn chữ THẮNG TIN HỌC');
  assert.ok(admin.includes('<UnitVideosPanel'), 'admin quản lý video chung chặng');
  assert.ok(admin.includes('<UnitPathNodesPanel'), 'admin quản lý nút lộ trình từng chặng');
  assert.ok(admin.includes('<UnitStepVideosPanel'), 'admin quản lý video theo cấp trong từng nút');
  assert.ok(admin.includes('Lưu danh sách video'));
  const pathView = read('client/src/components/student/dailyPractice/PathView.jsx');
  assert.ok(!pathView.includes('useNavigate'), 'nút Video trên chặng mở popup tại chỗ, không chuyển trang');
  assert.ok(webVideo.includes('Mở trang bài giảng'), 'popup vẫn có liên kết sang trang bài giảng');
  assert.ok(webVideo.includes('dailyPracticeApi.student.unitVideos'));
  assert.ok(mobile.includes('<PathVideoModal'), 'mobile: bấm nút video mở popup');
  assert.ok(read('thang-tin-hoc-mobile/src/components/dailyPractice/PathVideoModal.tsx').includes('<VideoPlayerFrame'));
  const mobileApi = read('thang-tin-hoc-mobile/src/services/dailyPracticeApi.ts');
  assert.ok(mobileApi.includes("call<{ topics: DpTopicPath[] }>('/path')"));
  assert.ok(mobileApi.includes('nodeKey'));
});
