const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

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

const { MobileAuthApi, MobileAuthApiError } = require('../src/services/mobileAuthApi.ts');
const { createMobileAuthService } = require('../src/services/mobileAuthService.ts');
const { createMobileAuthStorage } = require('../src/services/mobileAuthStorage.ts');

function makeResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeStorage(initial = null) {
  let value = initial;
  return {
    async loadAuth() { return value; },
    async saveAuth(next) { value = next; },
    async clearAuth() { value = null; },
    current() { return value; },
  };
}

function makeSecureStore(initial = null, { failSave = false } = {}) {
  let value = initial;
  const calls = [];
  return {
    calls,
    adapter: {
      async getItemAsync(key) {
        calls.push(['read', key]);
        return value;
      },
      async setItemAsync(key, next) {
        calls.push(['write', key, next]);
        if (failSave) throw new Error('SecureStore write failed');
        value = next;
      },
      async deleteItemAsync(key) {
        calls.push(['clear', key]);
        value = null;
      },
    },
    current() { return value; },
  };
}

const storedSession = {
  refreshToken: 'refresh-old',
  sessionId: 'session-1',
  user: { id: 'user-1', name: 'POC User', phone: '0901234567', role: 'student' },
};

function loginResponse(role = 'student') {
  return {
    success: true,
    data: {
      user: { _id: 'user-1', name: 'POC User', phone: '0901234567', role },
      accessToken: 'access-login',
      refreshToken: 'refresh-login',
      sessionId: 'session-1',
    },
  };
}

test('login trusts the server role and persists only refresh token plus minimal identity', async () => {
  const calls = [];
  const storage = makeStorage();
  const api = {
    async request(path, options) {
      calls.push({ path, options });
      return loginResponse('teacher');
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'ios' });

  const user = await service.signIn('student', '0901234567', 'not-stored-password');
  const saved = storage.current();
  assert.equal(user.role, 'teacher');
  assert.equal(service.getSessionId(), 'session-1');
  assert.equal(calls[0].path, '/api/auth/login/mobile');
  assert.equal(calls[0].options.body.platform, 'ios');
  assert.equal(calls[0].options.body.appVersion, '1.0.0');
  assert.equal(saved.refreshToken, 'refresh-login');
  assert.deepEqual(saved.user, { id: 'user-1', name: 'POC User', phone: '0901234567', role: 'teacher' });
  assert.equal(JSON.stringify(saved).includes('not-stored-password'), false);
  assert.equal(JSON.stringify(saved).includes('access-login'), false);
});

test('invalid login does not persist tokens or credentials', async () => {
  const storage = makeStorage();
  const api = {
    async request() {
      throw new MobileAuthApiError('Số điện thoại hoặc mật khẩu không chính xác.', 401, 'INVALID_CREDENTIALS');
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'android' });

  await assert.rejects(service.signIn('student', '0901234567', 'wrong-password'), (error) => (
    error.code === 'INVALID_CREDENTIALS'
  ));
  assert.equal(storage.current(), null);
});

test('restore rotates refresh token before returning the stored user', async () => {
  const storage = makeStorage(storedSession);
  const calls = [];
  const api = {
    async request(path, options) {
      calls.push({ path, options });
      return { success: true, accessToken: 'access-new', refreshToken: 'refresh-new', sessionId: 'session-1' };
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'android' });

  const user = await service.restore();
  assert.equal(user.id, 'user-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/auth/refresh');
  assert.deepEqual(calls[0].options.body, { refreshToken: 'refresh-old' });
  assert.equal(storage.current().refreshToken, 'refresh-new');
  assert.equal(JSON.stringify(storage.current()).includes('access-new'), false);
});

test('parallel expired requests share exactly one refresh and retry with the rotated access token', async () => {
  const storage = makeStorage();
  const calls = [];
  let refreshCount = 0;
  const api = {
    async request(path, options) {
      calls.push({ path, options });
      if (path === '/api/auth/login/mobile') return loginResponse();
      if (path === '/api/auth/refresh') {
        refreshCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { success: true, accessToken: 'access-new', refreshToken: 'refresh-new', sessionId: 'session-1' };
      }
      if (options.accessToken === 'access-login') {
        throw new MobileAuthApiError('Access token expired.', 401, 'TOKEN_EXPIRED');
      }
      return { success: true, data: [] };
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'android' });
  await service.signIn('student', '0901234567', 'mobile-test-password');

  const results = await Promise.all([
    service.getSessions(),
    service.getSessions(),
    service.getSessions(),
  ]);

  assert.equal(refreshCount, 1);
  assert.equal(results.length, 3);
  assert.equal(calls.filter((call) => call.path === '/api/auth/sessions').length, 6);
  assert.ok(calls.some((call) => call.path === '/api/auth/sessions' && call.options.accessToken === 'access-new'));
  assert.equal(storage.current().refreshToken, 'refresh-new');
});

test('session API methods use bearer auth and backend contract paths', async () => {
  const storage = makeStorage();
  const calls = [];
  const api = {
    async request(path, options) {
      calls.push({ path, options });
      if (path === '/api/auth/login/mobile') return loginResponse();
      if (path === '/api/auth/sessions') return { success: true, data: [] };
      return { success: true };
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'android' });
  await service.signIn('student', '0901234567', 'mobile-test-password');

  assert.deepEqual(await service.getSessions(), []);
  await service.revokeSession('session-other');
  assert.equal(calls[1].path, '/api/auth/sessions');
  assert.equal(calls[1].options.accessToken, 'access-login');
  assert.equal(calls[2].path, '/api/auth/sessions/session-other');
  assert.equal(calls[2].options.method, 'DELETE');
  assert.equal(calls[2].options.accessToken, 'access-login');
});

test('shared authenticated request supports PUT and retains bearer credentials', async () => {
  const storage = makeStorage();
  const calls = [];
  const api = {
    async request(path, options) {
      calls.push({ path, options });
      if (path === '/api/auth/login/mobile') return loginResponse();
      return { success: true };
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'android' });
  await service.signIn('student', '0901234567', 'mobile-test-password');

  await service.request('/api/notifications/mark-read', {
    method: 'PUT',
    body: { notificationId: 'notice-1' },
  });

  assert.equal(calls[1].path, '/api/notifications/mark-read');
  assert.equal(calls[1].options.method, 'PUT');
  assert.deepEqual(calls[1].options.body, { notificationId: 'notice-1' });
  assert.equal(calls[1].options.accessToken, 'access-login');
});

test('refresh replay clears local auth state', async () => {
  const storage = makeStorage(storedSession);
  let invalidations = 0;
  const service = createMobileAuthService({
    api: {
      async request() {
        throw new MobileAuthApiError('Refresh replay.', 401, 'REFRESH_REPLAY');
      },
    },
    storage,
    platform: 'android',
    onSessionInvalidated: () => { invalidations += 1; },
  });

  assert.equal(await service.restore(), null);
  assert.equal(storage.current(), null);
  assert.equal(invalidations, 1);
});

test('logout clears local credentials even when the server request fails', async () => {
  const storage = makeStorage();
  const api = {
    async request(path) {
      if (path === '/api/auth/login/mobile') return loginResponse();
      throw new MobileAuthApiError('Server unavailable.', 503, 'API_UNAVAILABLE');
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'android' });
  await service.signIn('student', '0901234567', 'mobile-test-password');

  await assert.rejects(service.signOut(), (error) => error.code === 'API_UNAVAILABLE');
  assert.equal(storage.current(), null);
  assert.equal(service.getSessionId(), null);
});

test('CSRF_INVALID refreshes the CSRF token and retries a mutation exactly once with credentials', async () => {
  const calls = [];
  let csrfRequests = 0;
  let mutationRequests = 0;
  const api = new MobileAuthApi('https://auth-poc.example.test', async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/api/auth/csrf-token')) {
      csrfRequests += 1;
      return makeResponse({ success: true, csrfToken: `csrf-${csrfRequests}` });
    }
    mutationRequests += 1;
    if (mutationRequests === 1) {
      return makeResponse({ success: false, code: 'CSRF_INVALID', message: 'CSRF invalid' }, 403);
    }
    return makeResponse({ success: true });
  });

  const result = await api.request('/api/auth/login/mobile', {
    method: 'POST',
    body: { identifier: '0901234567' },
  });
  assert.equal(result.success, true);
  assert.equal(csrfRequests, 2);
  assert.equal(mutationRequests, 2);
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.init.credentials === 'include'));
  assert.equal(calls[1].init.headers['X-CSRF-Token'], 'csrf-1');
  assert.equal(calls[3].init.headers['X-CSRF-Token'], 'csrf-2');
  assert.ok(calls.every((call) => !('Cookie' in call.init.headers)));
});

test('a second CSRF_INVALID is surfaced without another retry', async () => {
  let csrfRequests = 0;
  let mutationRequests = 0;
  const api = new MobileAuthApi('https://auth-poc.example.test', async (url) => {
    if (url.endsWith('/api/auth/csrf-token')) {
      csrfRequests += 1;
      return makeResponse({ success: true, csrfToken: `csrf-${csrfRequests}` });
    }
    mutationRequests += 1;
    return makeResponse({ success: false, code: 'CSRF_INVALID' }, 403);
  });

  await assert.rejects(api.request('/api/auth/logout', { method: 'POST', body: {} }), (error) => (
    error.code === 'CSRF_INVALID' && error.status === 403
  ));
  assert.equal(csrfRequests, 2);
  assert.equal(mutationRequests, 2);
});

test('Expo Web storage remains memory-only and supports explicit clearing', async () => {
  const secureStore = makeSecureStore();
  const storage = createMobileAuthStorage({
    isWebRuntime: () => true,
    loadSecureStore: async () => secureStore.adapter,
  });
  await storage.saveAuth(storedSession);
  assert.deepEqual(await storage.loadAuth(), storedSession);
  await storage.clearAuth();
  assert.equal(await storage.loadAuth(), null);
  assert.deepEqual(secureStore.calls, []);
});

test('native SecureStore supports missing, write, read, replace, and clear lifecycle', async () => {
  const secureStore = makeSecureStore();
  const storage = createMobileAuthStorage({
    isWebRuntime: () => false,
    loadSecureStore: async () => secureStore.adapter,
  });

  assert.equal(await storage.loadAuth(), null);
  await storage.saveAuth(storedSession);
  assert.deepEqual(await storage.loadAuth(), storedSession);
  const rotated = { ...storedSession, refreshToken: 'refresh-rotated' };
  await storage.saveAuth(rotated);
  assert.deepEqual(await storage.loadAuth(), rotated);
  await storage.clearAuth();
  assert.equal(await storage.loadAuth(), null);
  assert.deepEqual(secureStore.calls.map(([operation]) => operation), [
    'read', 'write', 'read', 'write', 'read', 'clear', 'read',
  ]);
});

test('native runtime does not select Web storage just because window exists', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const secureStore = makeSecureStore();
  global.window = {};
  delete global.document;
  try {
    const storage = createMobileAuthStorage({
      loadSecureStore: async () => secureStore.adapter,
    });
    await storage.saveAuth(storedSession);
    assert.equal(JSON.parse(secureStore.current()).refreshToken, storedSession.refreshToken);
    assert.deepEqual(secureStore.calls.map(([operation]) => operation), ['write']);
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});

test('native SecureStore discards corrupted or invalid stored state', async () => {
  for (const serialized of ['{broken', JSON.stringify({ refreshToken: 'refresh-only' })]) {
    const secureStore = makeSecureStore(serialized);
    const storage = createMobileAuthStorage({
      isWebRuntime: () => false,
      loadSecureStore: async () => secureStore.adapter,
    });
    assert.equal(await storage.loadAuth(), null);
    assert.equal(secureStore.current(), null);
    assert.deepEqual(secureStore.calls.map(([operation]) => operation), ['read', 'clear']);
  }
});

test('native app restore obtains CSRF, rotates persisted refresh, and authenticates with new access token', async () => {
  const secureStore = makeSecureStore(JSON.stringify(storedSession));
  const storage = createMobileAuthStorage({
    isWebRuntime: () => false,
    loadSecureStore: async () => secureStore.adapter,
  });
  const requests = [];
  const api = new MobileAuthApi('https://auth-poc.example.test', async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith('/api/auth/csrf-token')) {
      return makeResponse({ success: true, csrfToken: 'csrf-native-test' });
    }
    if (url.endsWith('/api/auth/refresh')) {
      return makeResponse({
        success: true,
        accessToken: 'access-after-restore',
        refreshToken: 'refresh-after-restore',
        sessionId: storedSession.sessionId,
      });
    }
    if (url.endsWith('/api/auth/sessions')) {
      return makeResponse({ success: true, data: [] });
    }
    throw new Error(`Unexpected auth request: ${url}`);
  });
  const service = createMobileAuthService({ api, storage, platform: 'android' });

  const restoredUser = await service.restore();
  assert.equal(restoredUser.id, storedSession.user.id);
  assert.equal(service.getSessionId(), storedSession.sessionId);
  assert.deepEqual(JSON.parse(secureStore.current()), {
    ...storedSession,
    refreshToken: 'refresh-after-restore',
  });
  assert.ok(requests[0].url.endsWith('/api/auth/csrf-token'));
  assert.ok(requests[1].url.endsWith('/api/auth/refresh'));
  assert.equal(requests[1].init.headers['X-CSRF-Token'], 'csrf-native-test');
  assert.equal(requests[1].init.credentials, 'include');

  await service.getSessions();
  assert.equal(requests[2].init.headers.Authorization, 'Bearer access-after-restore');
  assert.equal(requests[2].init.credentials, 'include');
});

test('native restore clears SecureStore after invalid refresh and remains unauthenticated', async () => {
  const secureStore = makeSecureStore(JSON.stringify(storedSession));
  const storage = createMobileAuthStorage({
    isWebRuntime: () => false,
    loadSecureStore: async () => secureStore.adapter,
  });
  const api = new MobileAuthApi('https://auth-poc.example.test', async (url) => {
    if (url.endsWith('/api/auth/csrf-token')) {
      return makeResponse({ success: true, csrfToken: 'csrf-native-test' });
    }
    return makeResponse({ success: false, code: 'REFRESH_REPLAY' }, 401);
  });
  const service = createMobileAuthService({ api, storage, platform: 'android' });

  assert.equal(await service.restore(), null);
  assert.equal(secureStore.current(), null);
  await assert.rejects(service.getSessions(), (error) => error.code === 'AUTH_REQUIRED');
  assert.equal(secureStore.calls.filter(([operation]) => operation === 'clear').length, 1);
});

test('failed SecureStore rotation clears memory and persisted auth instead of continuing authenticated', async () => {
  const secureStore = makeSecureStore(JSON.stringify(storedSession), { failSave: true });
  const storage = createMobileAuthStorage({
    isWebRuntime: () => false,
    loadSecureStore: async () => secureStore.adapter,
  });
  const api = {
    async request() {
      return {
        success: true,
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        sessionId: storedSession.sessionId,
      };
    },
  };
  const service = createMobileAuthService({ api, storage, platform: 'android' });

  assert.equal(await service.restore(), null);
  assert.equal(secureStore.current(), null);
  assert.equal(service.getSessionId(), null);
  await assert.rejects(service.getSessions(), (error) => error.code === 'AUTH_REQUIRED');
  assert.equal(secureStore.calls.filter(([operation]) => operation === 'clear').length, 1);
});
