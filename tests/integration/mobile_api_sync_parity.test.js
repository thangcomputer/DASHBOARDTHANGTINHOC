const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const mobile = (file) => read(path.join('thang-tin-hoc-mobile/src', file));

test('mobile has no lesson-practice screens calling routes the server does not mount', () => {
  assert.equal(fs.existsSync(path.join(root, 'thang-tin-hoc-mobile/src/screens/LessonPracticeScreens.tsx')), false);
  assert.equal(fs.existsSync(path.join(root, 'thang-tin-hoc-mobile/src/services/lessonPracticeApi.ts')), false);
  assert.ok(!mobile('screens/ParityScreens.tsx').includes('LessonPracticeCatalog'));
  const courseApi = mobile('services/courseVideoApi.ts');
  for (const route of ['/lesson-practice/my/subjects', '/lesson-practice/my/units/', '/lesson-practice/my/items/']) {
    assert.ok(courseApi.includes(route), route);
  }
});

test('assignment submit resolves the teacher before saving the submission', () => {
  assert.ok(!mobile('services/studentApi.ts').includes("teacherId: 'current'"));
  const routes = read('routes/assignmentRoutes.js');
  const submit = routes.slice(routes.indexOf("router.post('/:id/submit'"), routes.indexOf("router.put('/submissions/:submissionId/grade'"));
  assert.ok(submit.indexOf('resolvedTeacherId') < submit.indexOf('Submission.findOneAndUpdate'));
  assert.ok(submit.includes('mongoose.Types.ObjectId.isValid'));
});

test('teachers can edit and delete their own assignments from mobile', () => {
  const api = mobile('services/assignmentApi.ts');
  assert.ok(/method: 'PUT'[\s\S]*?\/assignments\/\$\{encodeURIComponent\(assignmentId\)\}|\/assignments\/\$\{encodeURIComponent\(assignmentId\)\}`, \{\s*method: 'PUT'/.test(api));
  assert.ok(api.includes("method: 'DELETE'"));
  const screen = mobile('screens/FeatureScreens.tsx');
  assert.ok(screen.includes('assignmentService.update('));
  assert.ok(screen.includes('assignmentService.remove('));
  const routes = read('routes/assignmentRoutes.js');
  const del = routes.slice(routes.indexOf("router.delete('/:id'"), routes.indexOf("router.post('/:id/submit'"));
  assert.ok(del.includes('Chỉ xóa bài tập của chính bạn'));
});

test('mobile video courses can be purchased with the same checkout API as web', () => {
  const api = mobile('services/courseVideoApi.ts');
  assert.ok(api.includes('/lesson-practice/my/courses/'));
  assert.ok(api.includes('/checkout'));
  assert.ok(api.includes('/lesson-practice/my/course-purchase-sessions/'));
  assert.ok(api.includes("'/settings/payment'"));
  const screen = mobile('screens/CourseVideosScreen.tsx');
  assert.ok(screen.includes('CoursePaymentModal'));
  assert.ok(!screen.includes('thanh toán khóa học trên Web app'));
});

test('exam room shows certification scores and cert prep shows attempt history', () => {
  assert.ok(mobile('services/studentApi.ts').includes("'/settings/exam-subjects'"));
  assert.ok(mobile('screens/StudentExamScreen.tsx').includes('getStudentCertExamScores'));
  assert.ok(mobile('services/certPrepApi.ts').includes('/attempts'));
  assert.ok(mobile('screens/CertPrepScreens.tsx').includes('certPrepApi.getAttempts'));
});

test('mobile revalidates the session with /auth/me like the web learning gate', () => {
  const auth = mobile('app/AuthContext.tsx');
  assert.ok(auth.includes("'/auth/me'"));
  assert.ok(auth.includes('learningAccess === false'));
  assert.ok(auth.includes("AppState.addEventListener('change'"));
  const authRoutes = read('routes/authRoutes.js');
  const me = authRoutes.slice(authRoutes.indexOf("router.get('/me'"));
  assert.ok(/learningAccess:\s+studentHasLearningAccess\(user\)/.test(me));
});
