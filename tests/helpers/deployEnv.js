'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ENV_PATH = path.join(__dirname, '../../.env');

/**
 * Nội dung .env của máy chủ đã triển khai (có cờ POLICY_CUTOVER_*), hoặc null khi chạy ở
 * CI / máy dev - khi đó các assertion về cấu hình triển khai được bỏ qua.
 */
function readDeployEnv() {
  let content;
  try {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    return null;
  }
  return /^\s*POLICY_CUTOVER_ENABLED\s*=/m.test(content) ? content : null;
}

const DEPLOY_ENV_SKIP = readDeployEnv() === null
  ? 'requires the deployed .env with POLICY_CUTOVER_* flags'
  : false;

module.exports = { readDeployEnv, DEPLOY_ENV_SKIP };
