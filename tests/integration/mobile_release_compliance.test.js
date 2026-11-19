'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '../..');
const read = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');

const pushService = require('../../services/mobilePushService');
const billingService = require('../../services/mobileBillingService');
const { normalizePreferences } = require('../../routes/mobilePushTokenRoutes');

test('Giai doan 1: self-service account deletion and public legal URLs are properly wired', () => {
  const serverJs = read('server.js');
  const authRoutes = read('routes/authRoutes.js');
  const policyRoutes = read('routes/publicPolicyRoutes.js');
  const mobileService = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const featureScreens = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');

  assert.ok(serverJs.includes("require('./routes/publicPolicyRoutes')"));
  assert.ok(authRoutes.includes("router.post('/delete-account', authMiddleware, sensitiveFlowLimiter"));
  assert.ok(authRoutes.includes('purgeStudentSideEffects'));
  assert.ok(authRoutes.includes('purgeTeacherSideEffects'));
  assert.ok(authRoutes.includes("'ACCOUNT_SELF_DELETED'"));
  assert.ok(authRoutes.includes("role === 'teacher' && (user.role !== 'teacher' || user.adminRole)"));

  assert.ok(policyRoutes.includes("router.get('/privacy-policy'"));
  assert.ok(policyRoutes.includes("router.get('/terms-of-service'"));
  assert.ok(policyRoutes.includes("router.get('/delete-account'"));
  assert.ok(policyRoutes.includes("router.post('/api/public/account-deletion-request'"));
  assert.ok(policyRoutes.includes('Content-Security-Policy'));

  assert.ok(mobileService.includes("mobileApiRequest<{ success?: boolean; message?: string }>('/auth/delete-account'"));
  assert.ok(featureScreens.includes('https://thangtinhoc.vn/privacy-policy'));
  assert.ok(featureScreens.includes('https://thangtinhoc.vn/terms-of-service'));
  assert.ok(featureScreens.includes('https://thangtinhoc.vn/delete-account'));
  assert.ok(featureScreens.includes('Xóa tài khoản vĩnh viễn'));
  assert.ok(featureScreens.includes('DeleteAccountModal'));
});

test('Giai doan 1 & 5: mobile app removes vulnerable xlsx package and round-trips quiz Excel via fflate', async () => {
  const pkg = JSON.parse(read('thang-tin-hoc-mobile/package.json'));
  assert.equal(Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, 'xlsx'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(pkg.devDependencies || {}, 'xlsx'), false);
  assert.ok(Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, 'fflate'));

  const tsSource = read('thang-tin-hoc-mobile/src/services/teacherQuizExcel.ts');
  assert.ok(tsSource.includes("from 'fflate'") || tsSource.includes('from "fflate"'));
  assert.ok(tsSource.includes('createTeacherQuizQuestionWorkbook'));
  assert.ok(tsSource.includes('parseTeacherQuizQuestionsExcel'));

  const tsPath = path.join(ROOT, 'thang-tin-hoc-mobile/node_modules/typescript');
  const fflatePath = path.join(ROOT, 'thang-tin-hoc-mobile/node_modules/fflate');
  if (!fs.existsSync(tsPath) || !fs.existsSync(fflatePath)) return;

  const ts = require(tsPath);
  const transpiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const mobileRequire = createRequire(path.join(ROOT, 'thang-tin-hoc-mobile/package.json'));
  const mod = { exports: {} };
  const fn = vm.runInNewContext(
    `(function(require, module, exports, globalThis) {\n${transpiled.outputText}\n})`,
    {},
  );
  fn(mobileRequire, mod, mod.exports, globalThis);

  const sampleQuestions = [
    {
      questionText: 'Phím tắt lưu văn bản trong Word là gì?',
      options: ['Ctrl + S', 'Ctrl + C', 'Ctrl + V', 'Ctrl + Z'],
      correctAnswer: 0,
      explanation: 'Ctrl + S dùng để Save tài liệu.',
    },
    {
      questionText: 'Hàm tính tổng trong Excel là hàm nào?',
      options: ['AVERAGE', 'SUM', 'COUNT', 'MAX'],
      correctAnswer: 1,
      explanation: 'Dùng =SUM(range) để cộng nhanh.',
    },
  ];

  const base64 = await mod.exports.createTeacherQuizQuestionWorkbook(sampleQuestions, 'Tin học văn phòng', true);
  assert.ok(typeof base64 === 'string' && base64.length > 100);

  const parsed = await mod.exports.parseTeacherQuizQuestionsExcel(base64);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.questions.length, 3);
  assert.equal(parsed.questions[0].questionText, sampleQuestions[0].questionText);
  assert.equal(parsed.questions[0].correctAnswer, 0);
  assert.equal(parsed.questions[1].questionText, sampleQuestions[1].questionText);
  assert.equal(parsed.questions[1].correctAnswer, 1);
  assert.deepEqual(Array.from(parsed.questions[1].options), sampleQuestions[1].options);
});

test('Giai doan 2: unified push service handles all 8 event groups, preferences, dedup, deep links, and revocation', () => {
  const cases = [
    ['class:reminder', { offsetMinutes: 1440 }],
    ['class:reminder', { offsetMinutes: 60 }],
    ['class:reminder', { offsetMinutes: 15 }],
    ['class:started', {}],
    ['schedule:new', {}],
    ['schedule:updated', {}],
    ['schedule:cancelled', {}],
    ['message:receive', { conversationId: 'conv-1' }],
    ['call:incoming', { callId: 'c1', conversationId: 'conv-1', caller: { id: 'u1', role: 'teacher', name: 'GV' } }],
    ['call:missed', {}],
    ['assignment:new', { assignmentId: 'a1' }],
    ['assignment:deadline', { assignmentId: 'a1' }],
    ['assignment:graded', { assignmentId: 'a1' }],
    ['quiz:assigned', { quizId: 'q1' }],
    ['notification', { type: 'SYSTEM', title: 'Bảo trì', content: 'Lịch bảo trì' }],
    ['notification', { type: 'FINANCE', content: 'amount' }],
    ['notification', { type: 'COURSE' }],
  ];
  for (const [ev, data] of cases) {
    const built = pushService.buildEventNotification(ev, data);
    assert.ok(built && built.title && built.body, `expected notification for ${ev}`);
  }

  const deviceAll = { token: 'ExponentPushToken[abc]', soundEnabled: true, preferences: normalizePreferences({}) };
  assert.equal(pushService.shouldDeliverToDevice(deviceAll, 'class:reminder', { offsetMinutes: 60 }), true);

  const deviceMutedMessages = {
    token: 'ExponentPushToken[abc]',
    soundEnabled: true,
    preferences: normalizePreferences({ messages: false, reminderOffsetsMinutes: [15] }),
  };
  assert.equal(pushService.shouldDeliverToDevice(deviceMutedMessages, 'message:receive', {}), false);
  assert.equal(pushService.shouldDeliverToDevice(deviceMutedMessages, 'class:reminder', { offsetMinutes: 1440 }), false);
  assert.equal(pushService.shouldDeliverToDevice(deviceMutedMessages, 'class:reminder', { offsetMinutes: 15 }), true);

  const msg = pushService.makePushMessage(
    deviceAll,
    { title: 'Nhắc lịch học', body: 'Còn 15 phút', channelId: 'schedule' },
    'class:reminder',
    { scheduleId: 'sched-99', offsetMinutes: 15, badge: 3 },
  );
  assert.equal(msg.data.deepLink, 'thangtinhoc://schedule?focusScheduleId=sched-99');
  assert.equal(msg.data.category, 'schedule');
  assert.equal(msg.badge, 3);

  pushService._test.DEDUP_CACHE.clear();
  assert.equal(pushService.shouldDeduplicate('student:1:class:reminder:sched-99:15', 10_000), false);
  assert.equal(pushService.shouldDeduplicate('student:1:class:reminder:sched-99:15', 10_000), true);

  const emitted = [];
  const fakeIo = {
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        },
      };
    },
  };
  pushService.revokeScheduleReminders(fakeIo, { scheduleId: 'sched-99', userIds: ['1'] });
  assert.equal(pushService._test.DEDUP_CACHE.has('student:1:class:reminder:sched-99:15'), false);
  assert.equal(emitted[0].event, 'schedule:reminder-revoked');
  assert.equal(emitted[0].payload.scheduleId, 'sched-99');

  const notifRoutes = read('routes/notificationRoutes.js');
  assert.ok(notifRoutes.includes("io.to(userId).emit('notification:read-sync'"));
  assert.ok(notifRoutes.includes("router.put('/read-all'"));
  assert.ok(notifRoutes.includes("router.put('/:id/read'"));
});

test('Giai doan 3: chat UGC report & user block routes precede :conversationId and enforce two-way blocks', () => {
  const msgRoutes = read('routes/messageRoutes.js');
  const dmService = read('services/directMessageService.js');
  const messageScreens = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');

  const getConvIdx = msgRoutes.indexOf("router.get('/:conversationId'");
  const getBlocksIdx = msgRoutes.indexOf("router.get('/blocks'");
  const postReportIdx = msgRoutes.indexOf("router.post('/report'");
  const postBlockIdx = msgRoutes.indexOf("router.post('/block'");
  const delBlockIdx = msgRoutes.indexOf("router.delete('/block/:blockedUserId'");

  assert.ok(getConvIdx > 0);
  assert.ok(getBlocksIdx > 0 && getBlocksIdx < getConvIdx, 'GET /blocks must register before /:conversationId');
  assert.ok(postReportIdx > 0 && postBlockIdx > 0 && delBlockIdx > 0);
  assert.ok(dmService.includes('MESSAGING_USER_BLOCKED'));
  assert.ok(messageScreens.includes('Báo cáo vi phạm'));
  assert.ok(messageScreens.includes('Chặn người dùng này'));
});

test('Giai doan 4: billing catalog covers 6 products, fails closed without store secrets, and disables native external QR', () => {
  assert.equal(billingService.PRODUCT_CLASSIFICATION_CATALOG.length, 6);
  const categories = billingService.PRODUCT_CLASSIFICATION_CATALOG.map((p) => p.category);
  for (const cat of [
    'digital_video_course',
    'digital_xp_pack',
    'digital_subscription',
    'live_1on1_tutoring',
    'live_group_class',
    'offline_classroom',
  ]) {
    assert.ok(categories.includes(cat), `missing category ${cat}`);
  }

  const prevApple = process.env.APPLE_IAP_ISSUER_ID;
  delete process.env.APPLE_IAP_ISSUER_ID;
  const status = billingService.getStoreConfigStatus();
  assert.equal(status.billingMode, 'reader_companion');
  assert.equal(status.appleConfigured, false);
  assert.ok(status.missingCredentials.apple_iap.includes('APPLE_IAP_ISSUER_ID'));
  if (prevApple !== undefined) process.env.APPLE_IAP_ISSUER_ID = prevApple;

  const modal = read('thang-tin-hoc-mobile/src/components/CoursePaymentModal.tsx');
  assert.ok(modal.includes('companionReadOnly'));
  assert.ok(modal.includes('Khôi phục giao dịch mua'));

  const parity = read('thang-tin-hoc-mobile/src/screens/ParityScreens.tsx');
  assert.equal(parity.includes('Để thanh toán hoặc xác nhận giao dịch, vui lòng thực hiện trên website.'), false);
  assert.ok(parity.includes('Khôi phục giao dịch mua'));
});
