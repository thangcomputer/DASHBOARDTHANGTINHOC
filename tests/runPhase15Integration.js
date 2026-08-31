'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertTestDatabaseEnvironment } = require('./setup/testDatabaseGuard');

try {
  assertTestDatabaseEnvironment(process.env);
} catch (error) {
  console.error(`Phase 1.5 integration blocked: ${error.message}`);
  process.exit(2);
}

const testFile = path.join(__dirname, 'integration', 'phase15_exam_auth_routes.test.js');
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', testFile], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
});
process.exit(result.status == null ? 1 : result.status);
