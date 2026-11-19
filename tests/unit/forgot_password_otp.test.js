'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');

function withEnv(vars, fn) {
  const backup = {};
  for (const [k, v] of Object.entries(vars)) {
    backup[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [k, v] of Object.entries(backup)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });
}

test('Email & SMS messaging config detection resolves Gmail, SMTP, and SMS gateways', async () => {
  const emailSvc = require('../../services/messaging/email');
  const smsSvc = require('../../services/messaging/sms');

  await withEnv(
    {
      GMAIL_USER: undefined,
      GMAIL_APP_PASSWORD: undefined,
      SMTP_HOST: undefined,
      SMTP_FROM: undefined,
      SMTP_USER: undefined,
      ESMS_API_KEY: undefined,
      ESMS_SECRET_KEY: undefined,
      SPEEDSMS_ACCESS_TOKEN: undefined,
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_FROM_NUMBER: undefined,
      SMS_WEBHOOK_URL: undefined,
    },
    async () => {
      assert.equal(emailSvc.isEmailConfigured(), false);
      assert.equal(smsSvc.isSmsConfigured(), false);

      process.env.GMAIL_USER = 'demo@gmail.com';
      process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
      assert.equal(emailSvc.isEmailConfigured(), true);

      delete process.env.GMAIL_USER;
      delete process.env.GMAIL_APP_PASSWORD;
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'noreply@example.com';
      assert.equal(emailSvc.isEmailConfigured(), true);

      process.env.ESMS_API_KEY = 'key';
      process.env.ESMS_SECRET_KEY = 'secret';
      assert.equal(smsSvc.isSmsConfigured(), true);
      assert.equal(smsSvc.getSmsProvider(), 'esms');

      delete process.env.ESMS_API_KEY;
      delete process.env.ESMS_SECRET_KEY;
      process.env.SPEEDSMS_ACCESS_TOKEN = 'speed_tok';
      assert.equal(smsSvc.getSmsProvider(), 'speedsms');

      delete process.env.SPEEDSMS_ACCESS_TOKEN;
      process.env.SMS_WEBHOOK_URL = 'https://sms.example.local/send';
      assert.equal(smsSvc.getSmsProvider(), 'webhook');
    },
  );
});

test('Forgot password OTP service verifies valid code once and enforces max attempts', async () => {
  const svc = require('../../services/forgotPasswordOtpService');
  svc._memoryStoreForTest.clear();

  const origRandomInt = crypto.randomInt;
  crypto.randomInt = () => 654321;
  try {
    const res = await svc.createAndSendForgotPasswordOtp({
      user: { _id: 'u-stu-1', name: 'Nguyen Van A', email: 'student@gmail.com' },
      role: 'student',
      contactType: 'email',
      contactValue: 'student@gmail.com',
    });
    assert.equal(res.ok, true);
    assert.equal(Object.hasOwn(res, 'otp'), false);
    assert.equal(Object.hasOwn(res, 'devOtp'), false);
  } finally {
    crypto.randomInt = origRandomInt;
  }

  const wrong = await svc.verifyForgotPasswordOtp({
    role: 'student',
    contactType: 'email',
    contactValue: 'student@gmail.com',
    code: '111111',
  });
  assert.equal(wrong.ok, false);
  assert.match(wrong.message, /còn 4 lần thử/);

  const good = await svc.verifyForgotPasswordOtp({
    role: 'student',
    contactType: 'email',
    contactValue: 'student@gmail.com',
    code: '654321',
  });
  assert.equal(good.ok, true);
  assert.equal(good.userId, 'u-stu-1');

  // Single-use: second verification fails
  const replay = await svc.verifyForgotPasswordOtp({
    role: 'student',
    contactType: 'email',
    contactValue: 'student@gmail.com',
    code: '654321',
  });
  assert.equal(replay.ok, false);

  // Max 5 failed attempts locks and deletes challenge
  crypto.randomInt = () => 222333;
  try {
    await svc.createAndSendForgotPasswordOtp({
      user: { _id: 'u-tch-1', name: 'Teacher B', phone: '0912345678' },
      role: 'teacher',
      contactType: 'sms',
      contactValue: '0912345678',
    });
  } finally {
    crypto.randomInt = origRandomInt;
  }

  for (let i = 0; i < 4; i += 1) {
    const fail = await svc.verifyForgotPasswordOtp({
      role: 'teacher',
      contactType: 'sms',
      contactValue: '0912345678',
      code: '999999',
    });
    assert.equal(fail.ok, false);
  }
  const fifth = await svc.verifyForgotPasswordOtp({
    role: 'teacher',
    contactType: 'sms',
    contactValue: '0912345678',
    code: '999999',
  });
  assert.equal(fifth.ok, false);
  assert.match(fifth.message, /quá 5 lần/);

  const afterExhaustion = await svc.verifyForgotPasswordOtp({
    role: 'teacher',
    contactType: 'sms',
    contactValue: '0912345678',
    code: '222333',
  });
  assert.equal(afterExhaustion.ok, false);
});

test('Models, backend authRoutes, Web UI, and Mobile UI wire OTP reset and forced password change end-to-end', () => {
  const Student = require('../../models/Student');
  const Teacher = require('../../models/Teacher');
  assert.ok(Student.schema.path('mustChangePassword'));
  assert.ok(Teacher.schema.path('mustChangePassword'));

  const authRoutes = fs.readFileSync(path.join(ROOT, 'routes/authRoutes.js'), 'utf8');
  assert.ok(authRoutes.includes('forgotPasswordOtpService.createAndSendForgotPasswordOtp'));
  assert.ok(authRoutes.includes('forgotPasswordOtpService.verifyForgotPasswordOtp'));
  assert.ok(authRoutes.includes('user.mustChangePassword = true'));
  assert.ok(authRoutes.includes('if (!user.isFirstLogin && !user.mustChangePassword)'));
  assert.ok(authRoutes.includes('mustChangePassword: !!user.mustChangePassword'));

  const webModal = fs.readFileSync(path.join(ROOT, 'client/src/components/ForgotPasswordModal.jsx'), 'utf8');
  assert.ok(webModal.includes('/auth/forgot-password/request'));
  assert.ok(webModal.includes('/auth/forgot-password/verify'));

  const webLayout = fs.readFileSync(path.join(ROOT, 'client/src/components/DashboardLayout.jsx'), 'utf8');
  assert.ok(webLayout.includes('mustChangePassword'));
  assert.ok(webLayout.includes('Đặt lại mật khẩu mới'));
  assert.ok(webLayout.includes('const mustResetPw = session?.mustChangePassword === true'));
  assert.ok(!webLayout.includes("session?.isFirstLogin === true && role !== 'teacher'"));

  const webFreePortal = fs.readFileSync(path.join(ROOT, 'client/src/components/FreePortalPage.jsx'), 'utf8');
  assert.ok(webFreePortal.includes('/auth/free-portal/send-otp'));
  assert.ok(webFreePortal.includes('/auth/free-portal/verify-otp'));
  assert.ok(!webFreePortal.includes('/auth/register-free'));

  const mobileLogin = fs.readFileSync(path.join(ROOT, 'thang-tin-hoc-mobile/src/screens/LoginScreen.tsx'), 'utf8');
  assert.ok(mobileLogin.includes('requestForgotPasswordOtp'));
  assert.ok(mobileLogin.includes('verifyForgotPasswordOtp'));
  assert.ok(mobileLogin.includes('/auth/free-portal/send-otp'));
  assert.ok(mobileLogin.includes('/auth/free-portal/verify-otp'));

  const mobileNav = fs.readFileSync(path.join(ROOT, 'thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx'), 'utf8');
  assert.ok(mobileNav.includes('ForcePasswordResetModal'));
  assert.ok(mobileNav.includes('user.mustChangePassword'));
});

test('Registration OTP service supports Gmail & phone SMS and creates new students with mustChangePassword=false', async () => {
  const Student = require('../../models/Student');
  const uniqueContact = require('../../utils/uniqueContact');
  const freePortalSocial = require('../../services/freePortalSocial');

  const origFindOne = Student.findOne;
  const origCreate = Student.create;
  const origAssertUnique = uniqueContact.assertUniqueContact;
  const origIssueSession = freePortalSocial.issueSession;
  const origRandomInt = crypto.randomInt;

  const createdPayloads = [];
  Student.findOne = async () => null;
  Student.create = async (doc) => {
    createdPayloads.push(doc);
    return { _id: 'new-student-1', ...doc };
  };
  uniqueContact.assertUniqueContact = async () => true;
  freePortalSocial.issueSession = async (student) => ({
    accessToken: 'tok-access',
    refreshToken: 'tok-refresh',
    user: { id: student._id, role: 'student', isFirstLogin: Boolean(student.isFirstLogin), mustChangePassword: Boolean(student.mustChangePassword) },
  });

  // Clear cached freePortalOtp & freePortalSocial references so stubs apply cleanly
  const otpSvcPath = require.resolve('../../services/freePortalOtp');
  delete require.cache[otpSvcPath];
  const freePortalOtp = require('../../services/freePortalOtp');
  freePortalOtp._pendingRegistrationsForTest.clear();

  try {
    // 1. Register via Vietnamese Phone -> OTP -> Verify -> Student created without forcing password change
    crypto.randomInt = () => 135791;
    const phoneSend = await freePortalOtp.sendRegisterOtp({
      name: 'Hoc Vien Test',
      age: 22,
      identifier: '0912345678',
      phone: '0912345678',
      password: 'Password!1',
    });
    assert.equal(phoneSend.success, true);
    assert.equal(phoneSend.channel, 'sms');
    assert.equal(phoneSend.identifier, '0912345678');

    await assert.rejects(
      () => freePortalOtp.verifyOtpAndRegister({ identifier: '0912345678', otp: '000000' }),
      /còn 4 lần thử/,
    );

    const phoneVerified = await freePortalOtp.verifyOtpAndRegister({
      identifier: '0912345678',
      otp: '135791',
    });
    assert.equal(phoneVerified.success, true);
    assert.equal(phoneVerified.data.user.isFirstLogin, false);
    assert.equal(phoneVerified.data.user.mustChangePassword, false);
    assert.equal(createdPayloads[0].phone, '0912345678');
    assert.equal(createdPayloads[0].age, 22);
    assert.equal(createdPayloads[0].isFirstLogin, false);
    assert.equal(createdPayloads[0].mustChangePassword, false);

    // 2. Register via Gmail -> OTP -> Verify -> Student created cleanly
    crypto.randomInt = () => 246802;
    const mailSend = await freePortalOtp.sendRegisterOtp({
      name: 'Hoc Vien Gmail',
      age: 19,
      identifier: 'newbie@gmail.com',
      email: 'newbie@gmail.com',
      password: 'Password!2',
    });
    assert.equal(mailSend.success, true);
    assert.equal(mailSend.channel, 'email');
    assert.equal(mailSend.identifier, 'newbie@gmail.com');

    const mailVerified = await freePortalOtp.verifyOtpAndRegister({
      identifier: 'newbie@gmail.com',
      otp: '246802',
    });
    assert.equal(mailVerified.success, true);
    assert.equal(mailVerified.data.user.isFirstLogin, false);
    assert.equal(mailVerified.data.user.mustChangePassword, false);
    assert.equal(createdPayloads[1].email, 'newbie@gmail.com');

    // 3. Existing student rejects with 409 ACCOUNT_ALREADY_EXISTS
    Student.findOne = async () => ({ _id: 'existing-1', freePortal: true });
    await assert.rejects(
      () => freePortalOtp.sendRegisterOtp({
        name: 'Dup Student',
        age: 20,
        identifier: '0912345678',
        phone: '0912345678',
        password: 'Password!1',
      }),
      (err) => err.status === 409 && err.code === 'ACCOUNT_ALREADY_EXISTS',
    );
  } finally {
    crypto.randomInt = origRandomInt;
    Student.findOne = origFindOne;
    Student.create = origCreate;
    uniqueContact.assertUniqueContact = origAssertUnique;
    freePortalSocial.issueSession = origIssueSession;
    delete require.cache[otpSvcPath];
  }
});

test('Login, Forgot Password, and Register UI + backend check account existence (ACCOUNT_NOT_FOUND / ACCOUNT_ALREADY_EXISTS)', () => {
  const authRoutes = fs.readFileSync(path.join(ROOT, 'routes/authRoutes.js'), 'utf8');
  assert.ok(authRoutes.includes("code: 'ACCOUNT_NOT_FOUND'"));
  assert.ok(authRoutes.includes("code: 'ACCOUNT_ALREADY_EXISTS'"));
  assert.ok(authRoutes.includes('return res.status(404).json(accountNotFoundPayload(role'));

  const mobileLogin = fs.readFileSync(path.join(ROOT, 'thang-tin-hoc-mobile/src/screens/LoginScreen.tsx'), 'utf8');
  assert.ok(mobileLogin.includes('ACCOUNT_NOT_FOUND'));
  assert.ok(mobileLogin.includes('ACCOUNT_ALREADY_EXISTS'));
  assert.ok(mobileLogin.includes('Đăng ký tài khoản ngay'));
  assert.ok(mobileLogin.includes('onSwitchToRegister'));

  const webModal = fs.readFileSync(path.join(ROOT, 'client/src/components/ForgotPasswordModal.jsx'), 'utf8');
  assert.ok(webModal.includes('ACCOUNT_NOT_FOUND'));
  assert.ok(webModal.includes('onSwitchToRegister'));

  const webLogin = fs.readFileSync(path.join(ROOT, 'client/src/components/LoginPage.jsx'), 'utf8');
  assert.ok(webLogin.includes('ACCOUNT_NOT_FOUND'));
  assert.ok(webLogin.includes('onSwitchToRegister'));

  const webFree = fs.readFileSync(path.join(ROOT, 'client/src/components/FreePortalPage.jsx'), 'utf8');
  assert.ok(webFree.includes('ACCOUNT_NOT_FOUND'));
  assert.ok(webFree.includes('onSwitchToRegister'));
});
