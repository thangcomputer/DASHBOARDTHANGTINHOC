/**
 * Shared VPS SSH config — credentials via env only (never commit passwords).
 *
 * Required:
 *   VPS_HOST
 *   VPS_PASSWORD  or  VPS_SSH_KEY_PATH
 * Optional:
 *   VPS_USER (default root)
 *   VPS_APP_DIR
 *
 * Loads project-root .env when present.
 */
const path = require('path');
const fs = require('fs');

function loadDotenvOnce() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
  } catch {
    // dotenv optional for scripts that set env in shell
  }
}

function getVpsSshConfig() {
  loadDotenvOnce();

  const host = (process.env.VPS_HOST || process.env.DEPLOY_SSH_HOST || '').trim();
  const username = (process.env.VPS_USER || process.env.DEPLOY_SSH_USER || 'root').trim();
  const password = (process.env.VPS_PASSWORD || process.env.DEPLOY_SSH_PASSWORD || '').trim();
  const privateKeyPath = (process.env.VPS_SSH_KEY_PATH || '').trim();

  if (!host) {
    throw new Error('Missing VPS_HOST (or DEPLOY_SSH_HOST) in .env');
  }
  if (!password && !privateKeyPath) {
    throw new Error('Need VPS_PASSWORD (or DEPLOY_SSH_PASSWORD) or VPS_SSH_KEY_PATH in .env');
  }

  return {
    host,
    username,
    ...(privateKeyPath ? { privateKeyPath } : { password }),
  };
}

/** Alias used by older scripts */
function getVpsConnection() {
  return getVpsSshConfig();
}

module.exports = { getVpsSshConfig, getVpsConnection };