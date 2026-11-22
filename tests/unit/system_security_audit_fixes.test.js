'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16
  ? process.env.JWT_SECRET
  : 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length >= 16
  ? process.env.JWT_REFRESH_SECRET
  : 'b'.repeat(40);

const centerInfoRoutes = require('../../routes/centerInfoRoutes');
const feedRoutes = require('../../routes/feedRoutes');
const blogRoutes = require('../../routes/blogRoutes');
const authRoutes = require('../../routes/authRoutes');
const monitoringRoutes = require('../../routes/monitoringRoutes');
const deviceSessionService = require('../../services/deviceSessionService');
const adminOtp2faService = require('../../services/adminOtp2faService');
const formService = require('../../services/formService');
const { isFreePortalRequestBlocked } = require('../../middleware/auth');
const UserDeviceSession = require('../../models/UserDeviceSession');
const AuthSession = require('../../models/AuthSession');

const read = (rel) => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

function invokeFilter(filterFn, file) {
  return new Promise((resolve) => {
    filterFn({}, file, (err, accepted) => {
      resolve({ err: err || null, accepted: Boolean(accepted) });
    });
  });
}

test('centerInfoRoutes.canManage properly awaits async permissions and denies student/teacher', async () => {
  const { canManage, manageOnly } = centerInfoRoutes._test;

  assert.equal(await canManage(null), false);
  assert.equal(await canManage({ id: 'stu1', role: 'student' }), false);
  assert.equal(await canManage({ id: 'tea1', role: 'teacher' }), false);
  assert.equal(await canManage({ id: 'admin', role: 'admin' }), true);
  assert.equal(await canManage({ id: 'sup1', role: 'admin', adminRole: 'SUPER_ADMIN' }), true);

  for (const deniedUser of [
    { id: 'stu1', role: 'student' },
    { id: 'tea1', role: 'teacher' },
  ]) {
    let statusCode = null;
    let payload = null;
    let nextCalled = false;
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            payload = body;
          },
        };
      },
    };
    await manageOnly({ user: deniedUser }, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.equal(payload?.success, false);
  }

  let adminNextCalled = false;
  await manageOnly(
    { user: { id: 'admin', role: 'admin' } },
    { status() { throw new Error('should not fail'); } },
    () => { adminNextCalled = true; },
  );
  assert.equal(adminNextCalled, true);

  const src = read('routes/centerInfoRoutes.js');
  assert.ok(!src.includes('canManage: canManage(req.user)'));
  assert.ok(src.includes('canManage(req.user)'));
});

test('centerInfoRoutes sanitizes HTML and rejects unsafe URL schemes', () => {
  const { sanitizeCenterHtml, sanitizeSafeUrl, pickItemBody, pickOverviewBody } = centerInfoRoutes._test;

  const dirtyHtml = '<p>Chào</p><script>alert(1)</script><iframe src="https://evil.test"></iframe><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">x</a>';
  const cleaned = sanitizeCenterHtml(dirtyHtml);
  assert.ok(!/<script/i.test(cleaned));
  assert.ok(!/<iframe/i.test(cleaned));
  assert.ok(!/onerror\s*=/i.test(cleaned));
  assert.ok(!/javascript:/i.test(cleaned));
  assert.ok(cleaned.includes('<p>Chào</p>'));

  assert.equal(sanitizeSafeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeSafeUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(sanitizeSafeUrl('https://giasutinhoc.com/about'), 'https://giasutinhoc.com/about');
  assert.equal(sanitizeSafeUrl('/uploads/center-info/banner.png'), '/uploads/center-info/banner.png');
  assert.equal(sanitizeSafeUrl('/uploads/../secrets.txt'), '');

  const pickedItem = pickItemBody({
    title: 'Chi nhánh Q1',
    url: 'javascript:alert(1)',
    mapsUrl: 'https://maps.google.com/?q=1',
    verifyUrl: 'data:text/html,evil',
    detailHtml: '<p>OK</p><script>bad()</script>',
  });
  assert.equal(pickedItem.url, '');
  assert.equal(pickedItem.mapsUrl, 'https://maps.google.com/?q=1');
  assert.equal(pickedItem.verifyUrl, '');
  assert.ok(!pickedItem.detailHtml.includes('<script'));

  const pickedOverview = pickOverviewBody({
    website: 'javascript:alert(1)',
    introVideoUrl: 'https://www.youtube.com/embed/abc',
    galleryUrls: ['/uploads/center-info/1.png', 'javascript:alert(1)'],
  });
  assert.equal(pickedOverview.website, '');
  assert.equal(pickedOverview.introVideoUrl, 'https://www.youtube.com/embed/abc');
  assert.deepEqual(pickedOverview.galleryUrls, ['/uploads/center-info/1.png']);
});

test('upload filters block XSS-capable SVG/HTML/JS extensions on public upload dirs', async () => {
  const { centerImageFileFilter } = centerInfoRoutes._test;
  const { feedImageFileFilter } = feedRoutes._test;
  const { blogFileFilter } = blogRoutes._test;

  for (const filterFn of [centerImageFileFilter, feedImageFileFilter]) {
    assert.equal((await invokeFilter(filterFn, { originalname: 'xss.svg', mimetype: 'image/svg+xml' })).accepted, false);
    assert.equal((await invokeFilter(filterFn, { originalname: 'xss.html', mimetype: 'image/jpeg' })).accepted, false);
    assert.equal((await invokeFilter(filterFn, { originalname: 'xss.js', mimetype: 'image/png' })).accepted, false);
    assert.equal((await invokeFilter(filterFn, { originalname: 'ok.jpg', mimetype: 'image/jpeg' })).accepted, true);
    assert.equal((await invokeFilter(filterFn, { originalname: 'ok.webp', mimetype: 'image/webp' })).accepted, true);
  }

  assert.equal((await invokeFilter(blogFileFilter, { originalname: 'xss.html', mimetype: 'text/html' })).accepted, false);
  assert.equal((await invokeFilter(blogFileFilter, { originalname: 'xss.svg', mimetype: 'image/svg+xml' })).accepted, false);
  assert.equal((await invokeFilter(blogFileFilter, { originalname: 'xss.js', mimetype: 'application/javascript' })).accepted, false);
  assert.equal((await invokeFilter(blogFileFilter, { originalname: 'doc.pdf', mimetype: 'application/pdf' })).accepted, true);
  assert.equal((await invokeFilter(blogFileFilter, { originalname: 'img.png', mimetype: 'image/png' })).accepted, true);
  assert.equal((await invokeFilter(blogFileFilter, { originalname: 'clip.mp4', mimetype: 'video/mp4' })).accepted, true);

  const settingsSrc = read('routes/settingsRoutes.js');
  assert.ok(settingsSrc.includes("const uploadLogo = createSafeImageUpload(logoDir, 'logo', 5 * 1024 * 1024);"));
  assert.ok(settingsSrc.includes("const uploadInvLogo = createSafeImageUpload(invLogoDir, 'inv_logo', 2 * 1024 * 1024);"));
  assert.ok(!settingsSrc.includes("file.mimetype === 'image/svg+xml'"));

  const serverSrc = read('server.js');
  assert.ok(serverSrc.includes("'Content-Security-Policy'"));
  assert.ok(serverSrc.includes('isScriptable'));
});

test('device session remote-logout RBAC protects other users and admin sessions', async () => {
  const { canViewAllDeviceSessions, canManageAllDeviceSessions } = authRoutes._test;
  const logsOnlyStaff = { id: 'staff1', role: 'staff', permissions: ['logs'] };
  const settingsStaff = { id: 'staff2', role: 'staff', permissions: ['settings'] };

  assert.equal(canViewAllDeviceSessions(logsOnlyStaff), true);
  assert.equal(canManageAllDeviceSessions(logsOnlyStaff), false);
  assert.equal(canManageAllDeviceSessions(settingsStaff), true);

  const { canActorRevokeSession } = deviceSessionService;
  const studentA = { id: 'stuA', role: 'student' };
  const highAdmin = { id: 'ha1', role: 'admin', adminRole: 'HIGH_ADMIN' };
  const superAdmin = { id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' };

  assert.equal(canActorRevokeSession(studentA, { userId: 'stuA', role: 'student' }).ok, true);
  assert.equal(canActorRevokeSession(studentA, { userId: 'stuB', role: 'student' }).status, 403);
  assert.equal(canActorRevokeSession(logsOnlyStaff, { userId: 'stuB', role: 'student' }).status, 403);
  assert.equal(canActorRevokeSession(settingsStaff, { userId: 'stuB', role: 'student' }).ok, true);
  assert.equal(canActorRevokeSession(settingsStaff, { userId: 'ha1', role: 'admin', adminRole: 'HIGH_ADMIN' }).status, 403);
  assert.equal(canActorRevokeSession(highAdmin, { userId: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }).status, 403);
  assert.equal(canActorRevokeSession(superAdmin, { userId: 'ha1', role: 'admin', adminRole: 'HIGH_ADMIN' }).ok, true);

  // Verify revokeDeviceSession enforces ownership on mobile branch too
  const origReadyDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const origAuthFindOne = AuthSession.findOne;
  const origWebFindOne = UserDeviceSession.findOne;
  try {
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
    AuthSession.findOne = () => ({
      lean: async () => ({ sessionId: 'mob-1', userId: 'stuB', role: 'student' }),
    });
    const deniedMob = await deviceSessionService.revokeDeviceSession({
      sessionId: 'mob-1',
      clientType: 'mobile',
      actor: studentA,
    });
    assert.equal(deniedMob.ok, false);
    assert.equal(deniedMob.status, 403);

    UserDeviceSession.findOne = () => ({
      lean: async () => ({ sessionId: 'web-1', userId: 'ha1', role: 'admin', adminRole: 'HIGH_ADMIN' }),
    });
    const deniedWeb = await deviceSessionService.revokeDeviceSession({
      sessionId: 'web-1',
      actor: settingsStaff,
    });
    assert.equal(deniedWeb.ok, false);
    assert.equal(deniedWeb.status, 403);
  } finally {
    if (origReadyDescriptor) Object.defineProperty(mongoose.connection, 'readyState', origReadyDescriptor);
    AuthSession.findOne = origAuthFindOne;
    UserDeviceSession.findOne = origWebFindOne;
  }
});

test('monitoring ingest prevents source/user spoofing, formService escapes CSV formulas, and Free Portal allows center-info', () => {
  const { buildIngestErrorPayload, buildIngestVitalPayload } = monitoringRoutes._test;

  const anonErr = buildIngestErrorPayload({
    body: { source: 'backend', userId: 'admin', userRole: 'admin', message: 'spoof' },
    user: null,
  });
  assert.equal(anonErr.source, 'frontend');
  assert.equal(anonErr.userId, '');
  assert.equal(anonErr.userRole, 'anonymous');

  const authVital = buildIngestVitalPayload({
    body: { name: 'LCP', value: 1200, userId: 'admin', userRole: 'admin' },
    user: { id: 'stu99', role: 'student' },
  });
  assert.equal(authVital.userId, 'stu99');
  assert.equal(authVital.userRole, 'student');

  const csv = formService.submissionsToCsv(
    { fields: [{ key: 'note' }] },
    [{ createdAt: new Date('2026-01-01T00:00:00Z'), submittedBy: '=HYPERLINK("http://x")', answers: { note: '+cmd|calc' } }],
  );
  assert.ok(csv.includes('"\'=HYPERLINK(""http://x"")"'));
  assert.ok(csv.includes('"\'+cmd|calc"'));

  const escapedName = adminOtp2faService.escapeHtml('<img src=x onerror="alert(1)">');
  assert.ok(!escapedName.includes('<img'));
  assert.ok(escapedName.includes('&lt;img'));

  const freeBlockedCenterInfo = isFreePortalRequestBlocked(
    { originalUrl: '/api/center-info', url: '/api/center-info' },
    { freePortal: true, freeUnlocked: false, enrollments: [] },
  );
  assert.equal(freeBlockedCenterInfo, false);

  const freeBlockedSchedule = isFreePortalRequestBlocked(
    { originalUrl: '/api/schedules', url: '/api/schedules' },
    { freePortal: true, freeUnlocked: false, enrollments: [] },
  );
  assert.equal(freeBlockedSchedule, true);

  assert.equal(
    isFreePortalRequestBlocked(
      { originalUrl: '/api/ai-support/quick-ask', url: '/api/ai-support/quick-ask' },
      { freePortal: true, freeUnlocked: false, enrollments: [] },
    ),
    false,
  );
  assert.equal(
    isFreePortalRequestBlocked(
      { originalUrl: '/api/ai-support/status', url: '/api/ai-support/status' },
      { freePortal: true, freeUnlocked: false, enrollments: [] },
    ),
    false,
  );
  assert.equal(
    isFreePortalRequestBlocked(
      { originalUrl: '/api/ai-support/open', url: '/api/ai-support/open' },
      { freePortal: true, freeUnlocked: false, enrollments: [] },
    ),
    true,
  );
  assert.equal(
    isFreePortalRequestBlocked(
      { originalUrl: '/api/ai-support/message', url: '/api/ai-support/message' },
      { freePortal: true, freeUnlocked: false, enrollments: [] },
    ),
    true,
  );

  const centerInfoPageSrc = read('client/src/components/centerInfo/CenterInfoPage.jsx');
  assert.ok(centerInfoPageSrc.includes('safeExternalHref('));
  assert.ok(centerInfoPageSrc.includes('safeVideoEmbedUrl('));

  const builderSrc = read('routes/builderRoutes.js');
  assert.ok(builderSrc.includes('safeFileName'));
});

