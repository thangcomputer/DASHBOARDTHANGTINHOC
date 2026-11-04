'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const TEST_DB = process.env.TEST_DATABASE_URI || '';
const dbSkip = /test/i.test(TEST_DB) ? false : 'TEST_DATABASE_URI (test DB) chưa cấu hình';

test('chủ đề luyện tập ↔ video: admin gắn môn/buổi, kết quả gợi ý video, bài học gợi ý chủ đề', { skip: dbSkip }, async () => {
  const service = require('../../services/dailyPracticeService');
  const Student = require('../../models/Student');
  const LessonSubject = require('../../models/LessonSubject');
  const LessonUnit = require('../../models/LessonUnit');
  const DailyPracticeTopic = require('../../models/DailyPracticeTopic');
  const DailyPracticeQuestion = require('../../models/DailyPracticeQuestion');
  const DailyPracticeSession = require('../../models/DailyPracticeSession');
  const DailyPracticeProfile = require('../../models/DailyPracticeProfile');
  const StudyResumePoint = require('../../models/StudyResumePoint');

  await mongoose.connect(TEST_DB);
  const studentId = new mongoose.Types.ObjectId();
  const slug = `dp-link-${Date.now()}`;
  const otherSlug = `${slug}-other`;
  const topicIds = [];
  let subject;
  let other;
  try {
    await Student.collection.insertOne({ _id: studentId, name: 'HV Link', course: slug });
    subject = await LessonSubject.create({ name: slug, slug, examSubjectId: slug });
    other = await LessonSubject.create({ name: otherSlug, slug: otherSlug, examSubjectId: otherSlug });
    const unit1 = await LessonUnit.create({ subjectId: subject._id, title: 'Buổi 1', sortOrder: 1, videos: [{ id: 'a', title: 'Mở đầu', url: 'https://youtu.be/a' }] });
    const unit2 = await LessonUnit.create({ subjectId: subject._id, title: 'Buổi 2', sortOrder: 2, videos: [{ id: 'b', title: 'Hàm', url: 'https://youtu.be/b' }] });
    const foreignUnit = await LessonUnit.create({ subjectId: other._id, title: 'Buổi lạ', sortOrder: 1 });

    const topic = await service.createTopic({
      name: `Link ${Date.now()}`,
      lessonSubjectId: String(subject._id),
      lessonUnitIds: [String(unit1._id), String(foreignUnit._id), 'khong-hop-le'],
    });
    topicIds.push(topic.id);
    assert.equal(topic.lessonSubjectId, String(subject._id));
    assert.deepEqual(topic.lessonUnitIds, [String(unit1._id)], 'chỉ giữ buổi thuộc đúng môn');

    const renamed = await service.updateTopic(topic.id, { name: `${topic.name} mới` });
    assert.deepEqual(renamed.lessonUnitIds, [String(unit1._id)], 'sửa tên không làm mất liên kết video');

    await assert.rejects(
      service.createTopic({ name: 'Sai môn', lessonSubjectId: String(new mongoose.Types.ObjectId()) }),
      { status: 400 },
    );

    const wholeSubject = await service.createTopic({ name: `Cả môn ${Date.now()}`, lessonSubjectId: String(subject._id) });
    topicIds.push(wholeSubject.id);
    for (const id of topicIds) {
      await DailyPracticeQuestion.create({ topicId: id, difficulty: 'easy', type: 'truefalse', status: 'published', prompt: 'Đúng?', answerBool: true });
    }

    const forUnit1 = await service.relatedTopics({ subjectId: String(subject._id), unitId: String(unit1._id) });
    assert.deepEqual(forUnit1.map((t) => t.id).sort(), [...topicIds].sort(), 'buổi 1: chủ đề gắn buổi + chủ đề gắn cả môn');
    const forUnit2 = await service.relatedTopics({ subjectId: String(subject._id), unitId: String(unit2._id) });
    assert.deepEqual(forUnit2.map((t) => t.id), [wholeSubject.id], 'buổi 2: chỉ chủ đề gắn cả môn');
    assert.deepEqual(await service.relatedTopics({ subjectId: String(other._id) }), []);

    const session = await service.startSession(studentId, { topicId: topic.id, difficulty: 'easy' });
    const summary = await service.finishSession(studentId, session.id);
    assert.equal(summary.relatedLesson.unitId, String(unit1._id), 'kết quả gợi ý đúng buổi đã gắn');
    assert.equal(summary.relatedLesson.sectionId, 'video:a');
    assert.equal(summary.relatedLesson.subjectName, slug);

    await service.updateTopic(topic.id, { name: topic.name, lessonSubjectId: '' });
    const unlinkedSession = await service.startSession(studentId, { topicId: topic.id, difficulty: 'easy' });
    assert.equal((await service.finishSession(studentId, unlinkedSession.id)).relatedLesson, null, 'bỏ gắn thì không gợi ý video');
  } finally {
    await DailyPracticeQuestion.deleteMany({ topicId: { $in: topicIds } });
    await DailyPracticeTopic.deleteMany({ _id: { $in: topicIds } });
    await DailyPracticeSession.deleteMany({ studentId });
    await DailyPracticeProfile.deleteMany({ studentId });
    await StudyResumePoint.deleteMany({ studentId });
    for (const doc of [subject, other].filter(Boolean)) {
      await LessonUnit.deleteMany({ subjectId: doc._id });
      await LessonSubject.deleteOne({ _id: doc._id });
    }
    await Student.collection.deleteOne({ _id: studentId });
    await mongoose.disconnect();
  }
});

test('nối chủ đề ↔ video có mặt ở admin, web và mobile', () => {
  const admin = read('client/src/components/admin/tabs/AdminDailyPracticeTab.jsx');
  assert.ok(admin.includes('Video bài giảng liên quan'));
  assert.ok(admin.includes('lessonPracticeApi.admin.units(subjectId)'));

  assert.ok(read('routes/dailyPracticeRoutes.js').includes("router.get('/my/related-topics'"));
  const webResult = read('client/src/components/student/dailyPractice/DailyPracticePage.jsx');
  assert.ok(webResult.includes('summary.relatedLesson && <RelatedLessonCard'));
  assert.ok(webResult.includes("searchParams.get('topicId')"));
  assert.ok(read('client/src/components/student/lessonPractice/LessonPracticeUnitsPage.jsx').includes('dailyPracticeApi.student.relatedTopics('));

  const mobileResult = read('thang-tin-hoc-mobile/src/screens/DailyPracticeScreen.tsx');
  assert.ok(mobileResult.includes('summary.relatedLesson ? <RelatedLessonCard'));
  assert.ok(mobileResult.includes('route.params?.topicId'));
  const mobileLesson = read('thang-tin-hoc-mobile/src/screens/CourseVideosScreen.tsx');
  assert.ok(mobileLesson.includes('dailyPracticeApi.relatedTopics('));
  assert.ok(mobileLesson.includes("stackNavigation.navigate('DailyPractice', { topicId })"));
});

test('trang bài học web và mobile giống nhau: gợi ý luyện tập ở đáy + điều hướng mục/bài + nút đọc xong', () => {
  const web = read('client/src/components/student/lessonPractice/LessonPracticeUnitsPage.jsx');
  assert.ok(web.includes('<LessonNavigationBar'), 'web có thanh Mục trước / Mục sau / Bài tiếp theo như mobile');
  assert.ok(web.includes("disabled={!next || !currentDone}"), 'mục sau chỉ mở khi xong mục hiện tại (như mobile)');
  assert.ok(web.includes("'Đã đọc xong · Tiếp tục'"));

  const mobile = read('thang-tin-hoc-mobile/src/screens/CourseVideosScreen.tsx');
  assert.match(mobile, /\{relatedStrip\}\s*\{lessonNavigation\}/, 'mobile đặt gợi ý luyện tập ngay trên thanh điều hướng đáy');
  assert.ok(mobile.includes('Luyện tập chủ đề liên quan:'));
});
