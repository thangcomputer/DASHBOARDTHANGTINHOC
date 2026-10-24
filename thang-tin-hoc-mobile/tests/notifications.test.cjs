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

const servicePath = path.resolve(__dirname, '../src/services/mockService.ts');

function loadNotificationService(flag) {
  process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API = flag;
  delete require.cache[servicePath];
  return require(servicePath).notificationService;
}

test('notifications remain mock-backed by default and fail explicitly when real mode lacks auth transport', async () => {
  const mockItems = await loadNotificationService('false').list('student');
  assert.ok(mockItems.length > 0);
  assert.ok(mockItems.every((item) => typeof item.id === 'string'));

  const realModeService = loadNotificationService('true');
  await assert.rejects(
    realModeService.list('student'),
    /authenticated mobile API client is available/,
  );
});
