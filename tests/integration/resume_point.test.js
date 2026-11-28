'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const service = require('../../services/lessonPracticeService');
const Student = require('../../models/Student');
const LessonSubject = require('../../models/LessonSubject');
const LessonUnit = require('../../models/LessonUnit');
const LessonUnitProgress = require('../../models/LessonUnitProgress');
const StudyResumePoint = require('../../models/StudyResumePoint');

const TEST_DB = process.env.TEST_DATABASE_URI || '';
const dbSkip = /test/i.test(TEST_DB) ? false : 'TEST_DATABASE_URI (test DB) chưa cấu hình';

test('vị trí học dở: lưu, đọc, bỏ mục không còn, nhảy sang buổi kế khi buổi cũ xong', { skip: dbSkip }, async () => {
  await mongoose.connect(TEST_DB);
  const studentId = new mongoose.Types.ObjectId();
  const slug = `resume-test-${Date.now()}`;
  const otherSlug = `resume-other-${Date.now()}`;
  let subject;
  let otherSubject;
  try {
    await Student.collection.insertOne({ _id: studentId, name: 'HV Resume', course: slug, accountType: 'center', freePortal: false });
    subject = await LessonSubject.create({ name: slug, slug, examSubjectId: slug, unlockMode: 'open' });
    otherSubject = await LessonSubject.create({ name: otherSlug, slug: otherSlug, examSubjectId: otherSlug, unlockMode: 'open' });
    const unit1 = await LessonUnit.create({
      subjectId: subject._id,
      title: 'Buổi 1',
      sortOrder: 1,
      videos: [{ id: 'v1', title: 'Mở đầu', url: 'https://youtu.be/a' }, { id: 'v2', title: 'Định dạng', url: 'https://youtu.be/b' }],
    });
    const unit2 = await LessonUnit.create({
      subjectId: subject._id,
      title: 'Buổi 2',
      sortOrder: 2,
      videos: [{ id: 'v3', title: 'Bảng', url: 'https://youtu.be/c' }],
    });
    const otherUnit = await LessonUnit.create({
      subjectId: otherSubject._id,
      title: 'Buổi môn chưa đăng ký',
      sortOrder: 1,
      videos: [{ id: 'v-other', title: 'Khóa', url: 'https://youtu.be/x' }],
    });

    assert.equal(await service.getResumePoint(studentId), null, 'chưa học gì thì không có điểm học dở');

    await service.saveResumePoint(studentId, { unitId: String(unit1._id), sectionId: 'video:v2', courseId: 'c1' });
    let point = await service.getResumePoint(studentId);
    assert.equal(point.unitId, String(unit1._id));
    assert.equal(point.subjectId, String(subject._id));
    assert.equal(point.courseId, 'c1');
    assert.equal(point.sectionId, 'video:v2');
    assert.equal(point.kind, 'video');
    assert.equal(point.itemTitle, 'Định dạng');

    await assert.rejects(
      service.saveResumePoint(studentId, { unitId: String(otherUnit._id), sectionId: 'video:v-other' }),
      { status: 403 },
      'môn chưa đăng ký thì không lưu',
    );

    await service.saveResumePoint(studentId, { unitId: String(unit1._id), sectionId: 'video:da-xoa' });
    point = await service.getResumePoint(studentId);
    assert.equal(point.sectionId, 'video:v1', 'mục không còn thì mở video chưa xem đầu tiên');
    assert.equal(await StudyResumePoint.countDocuments({ studentId }), 1, 'mỗi học viên một vị trí');

    await LessonUnitProgress.create({
      studentId,
      subjectId: subject._id,
      unitId: unit1._id,
      status: 'completed',
      videoDone: true,
      completedVideoIds: ['v1', 'v2'],
      completedAt: new Date(),
    });
    point = await service.getResumePoint(studentId);
    assert.equal(point.unitId, String(unit2._id), 'buổi đã xong thì học tiếp buổi kế');
    assert.equal(point.sectionId, 'video:v3');

    await StudyResumePoint.deleteMany({ studentId });
    point = await service.getResumePoint(studentId);
    assert.equal(point?.unitId, String(unit2._id), 'không có vị trí đã lưu thì suy ra từ tiến độ');
  } finally {
    await StudyResumePoint.deleteMany({ studentId });
    await LessonUnitProgress.deleteMany({ studentId });
    for (const doc of [subject, otherSubject].filter(Boolean)) {
      await LessonUnit.deleteMany({ subjectId: doc._id });
      await LessonSubject.deleteOne({ _id: doc._id });
    }
    await Student.collection.deleteOne({ _id: studentId });
    await mongoose.disconnect();
  }
});

test('API học tiếp: route + web/mobile lưu vị trí và popup mục tiêu trỏ tới video đang học dở', () => {
  const routes = read('routes/lessonPracticeRoutes.js');
  assert.ok(routes.includes("router.get('/my/resume-point'"));
  assert.ok(routes.includes("router.put('/my/resume-point'"));

  const webRedirect = read('client/src/components/student/lessonPractice/LessonPracticeUnitsPage.jsx');
  assert.ok(webRedirect.includes("searchParams.get('unitId')") && webRedirect.includes('/student/daily-practice'), 'web nhận unitId từ link mục tiêu');
  const webCatalog = read('client/src/components/student/lessonPractice/LessonPracticeCatalogPage.jsx');
  assert.ok(webCatalog.includes("searchParams.get('lesson') || searchParams.get('unitId')"), 'web mở đúng bài từ query');
  const webModal = read('client/src/components/student/LearningGoalModal.jsx');
  assert.ok(webModal.includes('lessonPracticeApi.student.resumePoint()'));
  assert.ok(webModal.includes("'Tiếp tục xem video'"));

  const mobileScreen = read('thang-tin-hoc-mobile/src/screens/CourseVideosScreen.tsx');
  assert.ok(mobileScreen.includes('resumeSubjectId={route.params?.resumeSubjectId}'));
  assert.ok(mobileScreen.includes('openUnitDetail'));
  const mobileModal = read('thang-tin-hoc-mobile/src/components/LearningGoalModal.tsx');
  assert.ok(mobileModal.includes('getStudyResumePoint()'));
  assert.ok(mobileModal.includes("screen: 'DailyPractice'"));
  assert.ok(mobileModal.includes('resumeSubjectId: resume.subjectId'));
  assert.ok(mobileModal.includes("'Tiếp tục xem video'"));
});
