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

const { createApiClient } = require('../src/services/apiClient.ts');
const { profileService, ProfileApiError } = require('../src/services/profileService.ts');
const { createMobileAuthService } = require('../src/services/mobileAuthService.ts');
const { MobileAuthApiError } = require('../src/services/mobileAuthApi.ts');

function makeStorage(initial = null) {
  let current = initial;
  return {
    async loadAuth() { return current; },
    async saveAuth(next) { current = next; },
    async clearAuth() { current = null; },
    current() { return current; },
  };
}

test('student profile read maps only profile fields from the self endpoint', async () => {
  const calls = [];
  const client = createApiClient(async (path, options) => {
    calls.push([path, options]);
    return {
      success: true,
      data: {
        _id: 'student/1',
        name: 'Student One',
        studentCode: 'HV001',
        phone: '0900000001',
        email: 'student@example.test',
        zalo: '0900000002',
        address: 'District 1',
        gender: 'female',
        status: 'active',
        course: 'Office',
        password: 'never map',
        tuition: 5000000,
      },
    };
  });

  const profile = await profileService.getProfile(client, 'student', 'student/1');
  assert.deepEqual(calls, [['/api/students/student%2F1', undefined]]);
  assert.deepEqual(profile, {
    id: 'student/1',
    role: 'student',
    name: 'Student One',
    code: 'HV001',
    phone: '0900000001',
    email: 'student@example.test',
    zalo: '0900000002',
    address: 'District 1',
    status: 'active',
    gender: 'female',
    age: '',
    course: 'Office',
    specialty: '',
    bio: '',
    voiceRegion: '',
    bankAccount: '',
  });
});

test('teacher profile read maps supported fields and omits unrelated finance and credential values', async () => {
  const client = createApiClient(async () => ({
    success: true,
    data: {
      _id: 'teacher-1',
      name: 'Teacher One',
      teacherCode: 'GV001',
      phone: '0900000003',
      email: 'teacher@example.test',
      zalo: '0900000004',
      address: 'District 3',
      status: 'pending',
      age: 30,
      specialty: 'English',
      bio: 'Experienced teacher',
      voiceRegion: 'bac',
      bankAccount: { accountNumber: '123456', accountHolder: 'Teacher One' },
      password: 'never map',
      baseSalaryPerSession: 100000,
      ratings: [{ score: 5 }],
    },
  }));

  const profile = await profileService.getProfile(client, 'teacher', 'teacher-1');
  assert.equal(profile.role, 'teacher');
  assert.equal(profile.code, 'GV001');
  assert.equal(profile.age, '30');
  assert.equal(profile.bankAccount, '123456');
  assert.equal(profile.specialty, 'English');
  assert.equal(Object.hasOwn(profile, 'password'), false);
  assert.equal(Object.hasOwn(profile, 'baseSalaryPerSession'), false);
});

test('optional profile fields map to empty display values instead of invented data', async () => {
  const client = createApiClient(async () => ({
    success: true,
    data: { _id: 'student-optional', name: 'Student Optional' },
  }));
  const profile = await profileService.getProfile(client, 'student', 'student-optional');
  assert.equal(profile.email, '');
  assert.equal(profile.address, '');
  assert.equal(profile.course, '');
  assert.equal(profile.status, '');
});

test('student update sends only the self-edit allowlist and consumes the updated profile', async () => {
  const calls = [];
  const client = createApiClient(async (path, options) => {
    calls.push([path, options]);
    return {
      success: true,
      data: {
        _id: 'student-2',
        name: 'Student Two',
        email: 'new@example.test',
        zalo: '0900000005',
        address: 'New address',
      },
    };
  });
  const result = await profileService.updateProfile(client, 'student', 'student-2', {
    email: 'new@example.test',
    zalo: '0900000005',
    address: 'New address',
  });

  assert.deepEqual(calls, [[
    '/api/students/student-2',
    {
      method: 'PUT',
      body: {
        email: 'new@example.test',
        zalo: '0900000005',
        address: 'New address',
      },
    },
  ]]);
  assert.equal(result.email, 'new@example.test');
});

test('teacher update sends only supported editable profile fields', async () => {
  const calls = [];
  const client = createApiClient(async (path, options) => {
    calls.push([path, options]);
    return { success: true, data: { _id: 'teacher-2', name: 'Teacher Two', email: 'new@example.test' } };
  });

  await profileService.updateProfile(client, 'teacher', 'teacher-2', {
    email: 'new@example.test',
    zalo: '',
    bio: 'Updated bio',
    voiceRegion: 'nam',
    address: 'New address',
    age: 32,
  });
  assert.deepEqual(calls, [[
    '/api/teachers/teacher-2',
    {
      method: 'PUT',
      body: {
        email: 'new@example.test',
        zalo: '',
        bio: 'Updated bio',
        voiceRegion: 'nam',
        address: 'New address',
        age: 32,
      },
    },
  ]]);
});

test('profile response errors and role-mismatched update data never fall back to mock data', async () => {
  const client = createApiClient(async () => ({ success: false, message: 'Profile unavailable' }));
  await assert.rejects(profileService.getProfile(client, 'student', 'student-3'), ProfileApiError);
  await assert.rejects(profileService.updateProfile(client, 'student', 'student-3', {
    email: 'student@example.test',
    zalo: '',
    address: '',
    bio: 'wrong role',
    voiceRegion: '',
    age: null,
  }), ProfileApiError);
});

test('profile read retries through auth refresh and stores rotated credentials', async () => {
  const calls = [];
  const storage = makeStorage();
  const api = {
    async request(path, options = {}) {
      calls.push([path, options.method || 'GET', options.accessToken || '']);
      if (path === '/api/auth/login/mobile') {
        return {
          success: true,
          data: {
            user: { _id: 'student-4', name: 'Student Four', phone: '0900000006', role: 'student' },
            accessToken: 'access-old',
            refreshToken: 'refresh-old',
            sessionId: 'session-stable',
          },
        };
      }
      if (path === '/api/students/student-4' && options.accessToken === 'access-old') {
        throw new MobileAuthApiError('Access token expired.', 401, 'TOKEN_EXPIRED');
      }
      if (path === '/api/auth/refresh') {
        return {
          success: true,
          accessToken: 'access-new',
          refreshToken: 'refresh-new',
          sessionId: 'session-stable',
        };
      }
      if (path === '/api/students/student-4') {
        return { success: true, data: { _id: 'student-4', name: 'Student Four', email: 'four@example.test' } };
      }
      throw new Error(`Unexpected request path: ${path}`);
    },
  };
  const auth = createMobileAuthService({ api, storage, platform: 'android' });
  await auth.signIn('student', '0900000006', 'test-password');
  const client = createApiClient((path, options) => auth.request(path, options));

  const profile = await profileService.getProfile(client, 'student', 'student-4');

  assert.equal(profile.email, 'four@example.test');
  assert.equal(storage.current().refreshToken, 'refresh-new');
  assert.equal(auth.getSessionId(), 'session-stable');
  assert.deepEqual(calls.map(([path, method]) => [path, method]), [
    ['/api/auth/login/mobile', 'POST'],
    ['/api/students/student-4', 'GET'],
    ['/api/auth/refresh', 'POST'],
    ['/api/students/student-4', 'GET'],
  ]);
});

test('profile API errors are surfaced without a success-shaped fallback', async () => {
  const client = createApiClient(async () => {
    throw new MobileAuthApiError('Profile server unavailable.', 503, 'API_UNAVAILABLE');
  });
  await assert.rejects(profileService.getProfile(client, 'teacher', 'teacher-3'), (error) => (
    error instanceof MobileAuthApiError && error.status === 503
  ));
});
