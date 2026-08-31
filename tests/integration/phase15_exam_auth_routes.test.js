'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Phase15LiveHarness } = require('../helpers/phase15LiveHarness');

const harness = new Phase15LiveHarness();
const ids = {};
const tokens = {};

const studentBank = [{
  id: 'student-word-1',
  section: 'word',
  type: 'multiple',
  q: 'Ứng dụng nào dùng để soạn thảo?',
  options: ['Word', 'Excel'],
  answer: 'A',
  explanation: 'Secret explanation',
  nested: { answerKey: 'A' },
}];
const teacherBank = [{
  id: 'teacher-word-1',
  section: 'word',
  type: 'multiple',
  q: 'Định dạng nào là tài liệu Word?',
  options: ['DOCX', 'XLSX'],
  answer: 'A',
  explanation: 'Secret explanation',
  nested: { correctAnswer: 0 },
}];

function containsSecretField(value) {
  const names = new Set([
    'answer', 'correct', 'correctanswer', 'correctanswers', 'iscorrect',
    'explanation', 'sampleanswer', 'answerkey', 'key',
  ]);
  if (Array.isArray(value)) return value.some(containsSecretField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => (
    names.has(key.toLowerCase()) || containsSecretField(child)
  ));
}

async function seedFixtures() {
  const Student = require('../../models/Student');
  const Teacher = require('../../models/Teacher');
  const SystemSettings = require('../../models/SystemSettings');
  const LessonQuiz = require('../../models/LessonQuiz');
  const { generateSecret } = require('../../utils/totp');

  const student = await Student.create({
    name: 'Phase15 Student',
    phone: '0901234567',
    zalo: '0977777777',
    email: 'student.phase15@example.test',
    password: 'StudentPass!1',
    course: 'Word căn bản',
    status: 'Đang học',
    paid: true,
    totalSessions: 12,
    remainingSessions: 6,
    studentExamUnlocked: true,
  });
  const studentTwo = await Student.create({
    name: 'Phase15 Student Two',
    phone: '0981234567',
    password: 'StudentPass!2',
    course: 'Word căn bản',
    status: 'Đang học',
    paid: true,
    studentExamUnlocked: true,
  });
  const teacher = await Teacher.create({
    name: 'Phase15 Teacher',
    phone: '0912345678',
    zalo: '0977777776',
    email: 'teacher.phase15@example.test',
    password: 'TeacherPass!1',
    role: 'teacher',
    status: 'pending',
    subjectIds: ['word'],
  });
  const staff = await Teacher.create({
    name: 'Phase15 Staff',
    phone: '0932345678',
    password: 'StaffPass!1',
    role: 'staff',
    adminRole: 'STAFF',
    status: 'active',
    permissions: ['manage_training', 'manage_student_training'],
  });
  const limitedStaff = await Teacher.create({
    name: 'Phase15 Limited Staff',
    phone: '0972345678',
    password: 'StaffPass!2',
    role: 'staff',
    adminRole: 'STAFF',
    status: 'active',
    permissions: [],
  });
  const admin = await Teacher.create({
    name: 'Phase15 Admin',
    phone: '0942345678',
    password: 'AdminPass!1',
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    status: 'active',
    permissions: ['manage_training', 'manage_student_training'],
  });
  await Teacher.create({
    name: 'Phase15 MFA Staff',
    phone: '0952345678',
    password: 'MfaPass!1',
    role: 'staff',
    adminRole: 'STAFF',
    status: 'active',
    mfaEnabled: true,
    mfaSecret: generateSecret(),
  });
  await Student.create({
    name: 'Duplicate Student',
    phone: '0962345678',
    password: 'Duplicate!1',
    course: 'Word căn bản',
    status: 'Đang học',
    paid: true,
  });
  await Teacher.create({
    name: 'Duplicate Teacher',
    phone: '0962345678',
    password: 'Duplicate!1',
    role: 'teacher',
    status: 'pending',
    subjectIds: ['word'],
  });
  await SystemSettings.create({
    _key: 'main',
    studentExamBankRawData: studentBank,
    studentExamMinutesRaw: { word: 30 },
    studentEssayRequiredRaw: { word: false },
    teacherExamBankRawData: teacherBank,
    teacherExamMinutesRaw: { word: 30 },
    adminMfaEnabled: false,
  });
  const quiz = await LessonQuiz.create({
    title: 'Phase15 Atomic Quiz',
    courseName: 'Word căn bản',
    teacherId: teacher._id,
    teacherName: teacher.name,
    targetStudentIds: [student._id],
    questions: [{
      questionText: '2 + 2 = ?',
      options: ['4', '5'],
      correctAnswer: 0,
    }],
    startTime: new Date(Date.now() - 60_000),
    deadline: new Date(Date.now() + 60 * 60_000),
    status: 'active',
  });
  Object.assign(ids, {
    student: String(student._id),
    studentTwo: String(studentTwo._id),
    teacher: String(teacher._id),
    staff: String(staff._id),
    limitedStaff: String(limitedStaff._id),
    admin: String(admin._id),
    quiz: String(quiz._id),
  });
}

async function publicLogin(phone, password, role) {
  const result = await harness.request('POST', '/api/auth/login/public', {
    body: { phone, password, role },
  });
  return result;
}

async function internalLogin(phone, password) {
  const captcha = await harness.captcha();
  return harness.request('POST', '/api/auth/login/internal', {
    body: { phone, password, ...captcha },
  });
}

test.before(async () => {
  await harness.resetAndSeed(seedFixtures);
  await harness.start();
});

test.after(async () => {
  await harness.stop();
});

test('Phase 1.5 live auth and exam route matrix', async (t) => {
  await t.test('phone-only login covers every role and 0/+84 equivalence', async () => {
    const student = await publicLogin('0901 234 567', 'StudentPass!1', 'student');
    assert.equal(student.response.status, 200);
    assert.equal(student.json.data.user.role, 'student');
    tokens.student = student.json.data.accessToken;

    const studentTwo = await publicLogin('0981234567', 'StudentPass!2', 'student');
    assert.equal(studentTwo.response.status, 200);
    tokens.studentTwo = studentTwo.json.data.accessToken;

    const teacher = await publicLogin('+84 912 345 678', 'TeacherPass!1', 'teacher');
    assert.equal(teacher.response.status, 200);
    assert.equal(teacher.json.data.user.role, 'teacher');
    tokens.teacher = teacher.json.data.accessToken;

    const staff = await internalLogin('+84932345678', 'StaffPass!1');
    assert.equal(staff.response.status, 200);
    assert.equal(staff.json.data.user.role, 'staff');
    tokens.staff = staff.json.data.accessToken;

    const limited = await internalLogin('0972345678', 'StaffPass!2');
    assert.equal(limited.response.status, 200);
    tokens.limitedStaff = limited.json.data.accessToken;

    const admin = await internalLogin('0942345678', 'AdminPass!1');
    assert.equal(admin.response.status, 200);
    assert.equal(admin.json.data.user.role, 'admin');
    tokens.admin = admin.json.data.accessToken;

    const master = await internalLogin(process.env.MASTER_ADMIN_PHONE || '0900000001', process.env.MASTER_ADMIN_PASSWORD || 'phase15-master-password');
    assert.equal(master.response.status, 200);
    assert.equal(master.json.data.user._id, 'admin');
    tokens.master = master.json.data.accessToken;

    const refresh = await harness.request('POST', '/api/auth/refresh', {
      body: { refreshToken: student.json.data.refreshToken },
    });
    assert.equal(refresh.response.status, 200);
    assert.equal(refresh.json.success, true);
  });

  await t.test('invalid identifiers, contacts, duplicates and wrong portals fail generically', async () => {
    const attempts = [
      () => publicLogin('student.phase15@example.test', 'StudentPass!1', 'student'),
      () => publicLogin('0977777777', 'StudentPass!1', 'student'),
      () => publicLogin('0962345678', 'Duplicate!1', 'student'),
      () => internalLogin('admin', 'phase15-master-password'),
      () => publicLogin('0942345678', 'AdminPass!1', 'student'),
    ];
    for (const attempt of attempts) {
      const result = await attempt();
      assert.equal(result.response.status, 401);
      assert.equal(result.json.code, 'INVALID_CREDENTIALS');
      assert.equal(result.json.message, 'Số điện thoại hoặc mật khẩu không đúng');
    }
  });

  await t.test('check-role and forgot-password do not enumerate accounts', async () => {
    const knownRole = await harness.request('POST', '/api/auth/check-role', {
      body: { phone: '0901234567' },
    });
    const unknownRole = await harness.request('POST', '/api/auth/check-role', {
      body: { phone: '0999999999' },
    });
    assert.deepEqual(knownRole.json, unknownRole.json);
    assert.equal(knownRole.json.data, null);

    const knownForgot = await harness.request('POST', '/api/auth/forgot-password/request', {
      body: { phone: '0901234567', role: 'student' },
    });
    const unknownForgot = await harness.request('POST', '/api/auth/forgot-password/request', {
      body: { phone: '0999999999', role: 'student' },
    });
    assert.equal(knownForgot.response.status, 202);
    assert.equal(unknownForgot.response.status, 202);
    assert.equal(knownForgot.json.message, unknownForgot.json.message);
    assert.equal(Object.hasOwn(knownForgot.json, 'data'), false);
  });

  await t.test('CAPTCHA and MFA remain gates on internal login', async () => {
    const noCaptcha = await harness.request('POST', '/api/auth/login/internal', {
      body: { phone: '0932345678', password: 'StaffPass!1' },
    });
    assert.equal(noCaptcha.response.status, 400);
    assert.equal(noCaptcha.json.captchaError, true);

    const mfa = await internalLogin('0952345678', 'MfaPass!1');
    assert.equal(mfa.response.status, 200);
    assert.equal(mfa.json.mfaRequired, true);
    assert.ok(mfa.json.mfaToken);

    const denied = await harness.request('POST', '/api/auth/mfa/verify', {
      body: { mfaToken: mfa.json.mfaToken, code: '000000' },
    });
    assert.equal(denied.response.status, 401);
    assert.equal(Boolean(denied.json.accessToken || denied.json.data?.accessToken), false);
  });

  await t.test('Google and Zalo OAuth routes are terminal 410 responses', async () => {
    for (const route of ['/api/auth/google', '/api/auth/google/callback', '/api/auth/zalo', '/api/auth/zalo/callback']) {
      const result = await harness.request('GET', route, { csrf: false });
      assert.equal(result.response.status, 410, route);
      assert.equal(result.response.headers.get('location'), null, route);
      assert.equal(result.response.headers.get('set-cookie'), null, route);
      assert.match(result.json.code, /_OAUTH_DISABLED$/);
    }
  });

  await t.test('exam banks enforce role matrix and recursively hide secrets', async () => {
    const studentConfig = await harness.request('GET', '/api/settings/student-exam-config', {
      token: tokens.student,
    });
    assert.equal(studentConfig.response.status, 200);
    assert.equal(studentConfig.json.data.questionDelivery, 'server_attempt');
    assert.deepEqual(studentConfig.json.data.studentQuestions, []);
    assert.equal(containsSecretField(studentConfig.json), false);

    const teacherConfig = await harness.request('GET', '/api/settings/teacher-exam-config', {
      token: tokens.teacher,
    });
    assert.equal(teacherConfig.response.status, 200);
    assert.deepEqual(teacherConfig.json.data.questions, []);
    assert.equal(containsSecretField(teacherConfig.json), false);

    const wrongRole = await harness.request('GET', '/api/settings/teacher-exam-config', {
      token: tokens.student,
    });
    assert.equal(wrongRole.response.status, 403);

    const managerStudent = await harness.request('GET', '/api/settings/student-exam-config', {
      token: tokens.staff,
    });
    assert.equal(managerStudent.response.status, 200);
    assert.equal(managerStudent.json.data.studentQuestions[0].answer, 'A');

    const managerTeacher = await harness.request('GET', '/api/settings/teacher-exam-config', {
      token: tokens.admin,
    });
    assert.equal(managerTeacher.response.status, 200);
    assert.equal(managerTeacher.json.data.questions[0].answer, 'A');

    const limited = await harness.request('GET', '/api/settings/student-exam-config', {
      token: tokens.limitedStaff,
    });
    assert.equal(limited.response.status, 403);
  });

  await t.test('student attempt is owned, answer-free, server-graded and idempotent', async () => {
    const created = await harness.request('POST', `/api/students/${ids.student}/exam-attempt`, {
      token: tokens.student,
      body: { subjectId: 'word' },
    });
    assert.equal(created.response.status, 200);
    assert.equal(containsSecretField(created.json.data.questions), false);
    const question = created.json.data.questions[0];
    const correctIndex = question.options.indexOf('Word');
    assert.notEqual(correctIndex, -1);

    const stolen = await harness.request('POST', `/api/students/${ids.studentTwo}/exam-attempt/submit`, {
      token: tokens.studentTwo,
      body: {
        attemptToken: created.json.data.attemptToken,
        answers: [{ questionId: question.id, selectedOption: correctIndex }],
      },
    });
    assert.equal(stolen.response.status, 403);

    const malformed = await harness.request('POST', `/api/students/${ids.student}/exam-attempt/submit`, {
      token: tokens.student,
      body: { attemptToken: created.json.data.attemptToken, answers: [] },
    });
    assert.equal(malformed.response.status, 400);

    const submitted = await harness.request('POST', `/api/students/${ids.student}/exam-attempt/submit`, {
      token: tokens.student,
      body: {
        attemptToken: created.json.data.attemptToken,
        answers: [{ questionId: question.id, selectedOption: correctIndex }],
        score: 0,
        passed: false,
      },
    });
    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.json.data.score, 1);
    assert.equal(submitted.json.data.passed, true);

    const retry = await harness.request('POST', `/api/students/${ids.student}/exam-attempt/submit`, {
      token: tokens.student,
      body: {
        attemptToken: created.json.data.attemptToken,
        answers: [{ questionId: question.id, selectedOption: correctIndex }],
      },
    });
    assert.equal(retry.response.status, 200);
    assert.equal(retry.json.data.idempotent, true);
  });

  await t.test('teacher attempt protects profile/results and validates practical URL', async () => {
    const profileTamper = await harness.request('PUT', `/api/teachers/${ids.teacher}`, {
      token: tokens.teacher,
      body: { testScore: 100, testStatus: 'passed' },
    });
    assert.equal(profileTamper.response.status, 403);

    const resultTamper = await harness.request('POST', '/api/exam-results', {
      token: tokens.teacher,
      body: { teacherId: ids.teacher, score: 100 },
    });
    assert.equal(resultTamper.response.status, 403);

    const created = await harness.request('POST', `/api/teachers/${ids.teacher}/exam-attempt`, {
      token: tokens.teacher,
      body: {},
    });
    assert.equal(created.response.status, 200);
    assert.equal(containsSecretField(created.json.data.questions), false);
    const question = created.json.data.questions[0];
    const correctIndex = question.options.indexOf('DOCX');

    const submitted = await harness.request('POST', `/api/teachers/${ids.teacher}/exam-attempt/submit`, {
      token: tokens.teacher,
      body: {
        attemptToken: created.json.data.attemptToken,
        answers: [{ questionId: question.id, selectedOption: correctIndex }],
        score: 0,
      },
    });
    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.json.data.score, 100);
    assert.equal(submitted.json.data.passed, true);

    const invalidUrl = await harness.request('POST', `/api/teachers/${ids.teacher}/submit-practical`, {
      token: tokens.teacher,
      body: { fileUrl: 'https://attacker.example/payload' },
    });
    assert.equal(invalidUrl.response.status, 400);

    const practical = await harness.request('POST', `/api/teachers/${ids.teacher}/submit-practical`, {
      token: tokens.teacher,
      body: { fileUrl: '/uploads/practical/phase15.docx' },
    });
    assert.equal(practical.response.status, 200);
    assert.equal(practical.json.data.practicalStatus, 'submitted');
  });

  await t.test('quiz concurrent submissions are atomic and server-graded', async () => {
    const body = { answers: [0], score: 0, status: 'failed' };
    const [first, second] = await Promise.all([
      harness.request('POST', `/api/quizzes/${ids.quiz}/submit`, { token: tokens.student, body }),
      harness.request('POST', `/api/quizzes/${ids.quiz}/submit`, { token: tokens.student, body }),
    ]);
    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.equal(first.json.data.score, 100);
    assert.equal(second.json.data.score, 100);

    const retry = await harness.request('POST', `/api/quizzes/${ids.quiz}/submit`, {
      token: tokens.student,
      body: { answers: [1] },
    });
    assert.equal(retry.response.status, 200);
    assert.equal(retry.json.data.score, 100);
  });
});
