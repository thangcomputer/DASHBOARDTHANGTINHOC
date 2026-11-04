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
  let subject;
  try {
    await Student.collection.insertOne({ _id: studentId, name: 'HV Resume', course: slug });
    subject = await LessonSubject.create({ name: slug, slug, examSubjectId: slug, unlockMode: 'sequential' });
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
      service.saveResumePoint(studentId, { unitId: String(unit2._id), sectionId: 'video:v3' }),
      { status: 403 },
      'buổi còn khóa thì không lưu',
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
    if (subject) {
      await LessonUnit.deleteMany({ subjectId: subject._id });
      await LessonSubject.deleteOne({ _id: subject._id });
    }
    await Student.collection.deleteOne({ _id: studentId });
    await mongoose.disconnect();
  }
});

test('API học tiếp: route + web/mobile lưu vị trí và popup mục tiêu trỏ tới video đang học dở', () => {
  const routes = read('routes/lessonPracticeRoutes.js');
  assert.ok(routes.includes("router.get('/my/resume-point'"));
  assert.ok(routes.includes("router.put('/my/resume-point'"));

  const webPage = read('client/src/components/student/lessonPractice/LessonPracticeUnitsPage.jsx');
  assert.ok(webPage.includes('lessonPracticeApi.student.saveResumePoint({'), 'web lưu vị trí lên server');
  assert.ok(webPage.includes("searchParams.get('unitId')"), 'web mở đúng buổi từ link');
  assert.ok(webPage.includes("searchParams.get('section')"), 'web mở đúng mục từ link');
  const webModal = read('client/src/components/student/LearningGoalModal.jsx');
  assert.ok(webModal.includes('lessonPracticeApi.student.resumePoint()'));
  assert.ok(webModal.includes("'Tiếp tục xem video'"));

  const mobileScreen = read('thang-tin-hoc-mobile/src/screens/CourseVideosScreen.tsx');
  assert.ok(mobileScreen.includes('saveStudyResumePoint({ unitId: displayedUnit.id, sectionId: displayedSectionId, courseId })'));
  assert.ok(mobileScreen.includes('void openSubject(course, subject, {'));
  const mobileModal = read('thang-tin-hoc-mobile/src/components/LearningGoalModal.tsx');
  assert.ok(mobileModal.includes('getStudyResumePoint()'));
  assert.ok(mobileModal.includes("screen: 'CourseVideos'"));
  assert.ok(mobileModal.includes("'Tiếp tục xem video'"));
});
