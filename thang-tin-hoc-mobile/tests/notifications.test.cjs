const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

global.__DEV__ = false;
require.extensions['.ts'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  loadedModule._compile(compiled, filename);
};

const featuresPath = path.resolve(__dirname, '../src/features/notifications');

function loadFeature(name) {
  const modulePath = require.resolve(path.join(featuresPath, `${name}.ts`));
  delete require.cache[modulePath];
  return require(modulePath);
}

function notificationResponse(rows, { page = 1, limit = 100, total = rows.length, pages = 1, unread = 0 } = {}) {
  return { success: true, data: rows, pagination: { page, limit, total, pages }, unread };
}

function backendRow(id, fields = {}) {
  return {
    _id: id,
    type: 'SYSTEM',
    title: `Title ${id}`,
    content: `Message ${id}`,
    createdAt: '2026-10-24T10:00:00.000Z',
    read: false,
    path: '',
    payload: {},
    ...fields,
  };
}

test('mapper separates type/category and maps read state and timestamp safely', () => {
  const { mapBackendNotification, notificationCategoryForType } = loadFeature('notificationMapper');
  const unread = mapBackendNotification(backendRow('n1', { type: 'SCHEDULE', read: false }));
  const read = mapBackendNotification(backendRow('n2', { type: 'UNRECOGNIZED', read: true, createdAt: 'bad-date' }));

  assert.equal(unread.type, 'SCHEDULE');
  assert.equal(unread.category, 'Lịch dạy');
  assert.equal(unread.unread, true);
  assert.equal(read.category, 'Khác');
  assert.equal(read.unread, false);
  assert.equal(read.time, '—');
  assert.equal(notificationCategoryForType('Tin nhắn'), 'Tin nhắn');
  assert.deepEqual(mapBackendNotification(backendRow('non-object-payload', { payload: 'unstructured' })).payload, {});
  assert.throws(() => mapBackendNotification(null), /invalid notification item/);
  assert.throws(() => mapBackendNotification(backendRow('')), /without an ID/);
});

test('known destinations route to supported screens; unknown and exam destinations remain in detail', () => {
  const { resolveNotificationDestination } = loadFeature('notificationRouting');
  const base = { id: 'n1', title: '', message: '', time: '', category: '', unread: false };

  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: 'MESSAGE' }, 'student'),
    { kind: 'tab', name: 'Messages' },
  );
  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: '', category: 'Bài tập' }, 'student'),
    { kind: 'screen', name: 'Assignments' },
  );
  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: '', targetPath: '/student/schedule' }, 'student'),
    { kind: 'tab', name: 'Schedule' },
  );
  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: 'FINANCE' }, 'teacher'),
    { kind: 'screen', name: 'TeacherFinance' },
  );
  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: 'EXAM' }, 'student'),
    { kind: 'unsupported', reason: 'web-only' },
  );
  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: 'CERTIFICATION' }, 'student'),
    { kind: 'unsupported', reason: 'web-only' },
  );
  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: '', targetPath: '/teacher/onboarding' }, 'teacher'),
    { kind: 'unsupported', reason: 'web-only' },
  );
  assert.deepEqual(
    resolveNotificationDestination({ ...base, type: 'UNKNOWN' }, 'student'),
    { kind: 'unsupported', reason: 'unknown' },
  );
});

test('real list requests server pagination and maps page two without duplicating items', async () => {
  const { listNotifications } = loadFeature('notificationApiRepository');
  const calls = [];
  const request = async (path) => {
    calls.push(path);
    return notificationResponse(
      path.includes('page=2') ? [backendRow('n2')] : [backendRow('n1')],
      { page: path.includes('page=2') ? 2 : 1, limit: 1, total: 2, pages: 2, unread: 2 },
    );
  };

  const page = await listNotifications(request, { page: 2, limit: 1, type: 'SYSTEM', unreadOnly: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /page=2/);
  assert.match(calls[0], /limit=1/);
  assert.match(calls[0], /type=SYSTEM/);
  assert.match(calls[0], /unreadOnly=true/);
  assert.deepEqual(page.items.map((item) => item.id), ['n2']);
  assert.equal(page.pagination.pages, 2);
  assert.equal(page.unread, 2);
});

test('category filters use backend types and unknown categories are filtered safely across pages', async () => {
  const { listNotifications } = loadFeature('notificationApiRepository');
  const knownCalls = [];
  await listNotifications(async (path) => {
    knownCalls.push(path);
    return notificationResponse([backendRow('schedule-1', { type: 'SCHEDULE' })]);
  }, { category: 'Lịch dạy' });
  assert.match(knownCalls[0], /type=SCHEDULE/);

  const unknownCalls = [];
  const page = await listNotifications(async (path) => {
    unknownCalls.push(path);
    if (path.includes('page=2')) {
      return notificationResponse(
        [backendRow('unknown-2', { type: 'OTHER' })],
        { page: 2, limit: 100, total: 2, pages: 2 },
      );
    }
    return notificationResponse(
      [backendRow('known-1', { type: 'SYSTEM' })],
      { page: 1, limit: 100, total: 2, pages: 2 },
    );
  }, { category: 'Khác', limit: 20 });
  assert.equal(unknownCalls.length, 2);
  assert.deepEqual(page.items.map((item) => item.id), ['unknown-2']);
});

test('read-only filter loads backend pages, removes duplicates and paginates filtered results', async () => {
  const { listNotifications } = loadFeature('notificationApiRepository');
  const calls = [];
  const request = async (path) => {
    calls.push(path);
    if (path.includes('page=2')) {
      return notificationResponse(
        [backendRow('read-2', { read: true }), backendRow('read-1', { read: true })],
        { page: 2, limit: 100, total: 4, pages: 2, unread: 2 },
      );
    }
    return notificationResponse(
      [backendRow('unread-1'), backendRow('read-1', { read: true }), backendRow('read-2', { read: true })],
      { page: 1, limit: 100, total: 4, pages: 2, unread: 2 },
    );
  };

  const page = await listNotifications(request, { page: 2, limit: 1, readOnly: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(page.items.map((item) => item.id), ['read-2']);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.pages, 2);
});

test('real mutations use backend methods and reject unsuccessful response envelopes', async () => {
  process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API = 'true';
  const { notificationService } = loadFeature('notificationService');
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, options });
    return { success: true };
  };

  await notificationService.markRead('student', 'notice/1', request);
  await notificationService.markAllRead('student', request);
  await notificationService.hide('notice/1', request);
  assert.deepEqual(calls.map(({ path, options }) => [path, options.method, options.body]), [
    ['/api/notifications/mark-read', 'PUT', { notificationId: 'notice/1' }],
    ['/api/notifications/mark-read', 'PUT', { markAll: true }],
    ['/api/notifications/notice%2F1', 'DELETE', undefined],
  ]);
  await assert.rejects(
    notificationService.markRead('student', 'notice-2', async () => ({ success: false })),
    /did not confirm mark read/,
  );
});

test('feature flag keeps mock mode offline and requires authenticated transport in real mode', async () => {
  process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API = 'false';
  const mockService = loadFeature('notificationService').notificationService;
  const mockPage = await mockService.list('student', { page: 1, limit: 1 });
  assert.equal(mockPage.items.length, 1);
  assert.equal(mockPage.pagination.limit, 1);

  process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API = 'true';
  const realService = loadFeature('notificationService').notificationService;
  await assert.rejects(realService.list('student'), /authenticated mobile API client/);

  const realPage = await realService.list('student', { page: 1, limit: 1 }, async (requestPath) => {
    assert.match(requestPath, /\/api\/notifications\?/);
    return notificationResponse([backendRow('real-1')], { limit: 1, total: 1 });
  });
  assert.equal(realPage.items[0].id, 'real-1');
});

test('mock repository paginates fixtures and applies read/category filters without API transport', async () => {
  process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API = 'false';
  const { notificationService } = loadFeature('notificationService');
  const firstPage = await notificationService.list('student', { page: 1, limit: 2 });
  const secondPage = await notificationService.list('student', { page: 2, limit: 2 });
  const lastPage = await notificationService.list('student', { page: 3, limit: 2 });

  assert.deepEqual(firstPage.items.map((item) => item.id), ['notice-1', 'notice-2']);
  assert.deepEqual(secondPage.items.map((item) => item.id), ['notice-3', 'notice-4']);
  assert.deepEqual(lastPage.items.map((item) => item.id), ['notice-5']);
  assert.equal(lastPage.pagination.pages, 3);

  const unread = await notificationService.list('student', { unreadOnly: true, category: 'Lịch dạy' });
  assert.deepEqual(unread.items.map((item) => item.id), ['notice-1']);
  assert.ok(unread.items.every((item) => item.unread));

  const messages = await notificationService.list('student', { category: 'Tin nhắn' });
  assert.deepEqual(messages.items.map((item) => item.id), ['notice-4']);

  await notificationService.markRead('student', 'notice-2');
  const readStudent = await notificationService.list('student', { category: 'Khóa học', readOnly: true });
  assert.deepEqual(readStudent.items.map((item) => item.id), ['notice-2']);
  const readTeacherBeforeMutation = await notificationService.list('teacher', { readOnly: true });
  assert.deepEqual(readTeacherBeforeMutation.items.map((item) => item.id), ['teacher-notice-3']);
  await notificationService.markAllRead('teacher');
  const readTeacher = await notificationService.list('teacher', { readOnly: true });
  assert.deepEqual(readTeacher.items.map((item) => item.id), [
    'teacher-notice-1',
    'teacher-notice-2',
    'teacher-notice-3',
  ]);
});

test('list API errors are surfaced and do not fall back to mock notifications', async () => {
  process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API = 'true';
  const { notificationService } = loadFeature('notificationService');
  await assert.rejects(
    notificationService.list('student', {}, async () => { throw new Error('HTTP 503'); }),
    /HTTP 503/,
  );
  await assert.rejects(
    notificationService.list('student', {}, async () => ({ success: false, data: null })),
    /invalid list response/,
  );
  await assert.rejects(
    notificationService.list('student', {}, async () => ({ success: true, data: [], unread: 0 })),
    /invalid pagination response/,
  );
});
