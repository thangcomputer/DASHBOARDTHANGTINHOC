/**
 * Xac thuc mat khau Super Admin (id === 'admin').
 * Production: can adminPasswordHash trong DB hoac MASTER_ADMIN_PASSWORD.
 */
const bcrypt = require('bcryptjs');

const DEV_FALLBACK_PASSWORD = 'admin123';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

async function verifyAdminPassword(password, sysSettings) {
  if (!password) return false;

  const dbAdminHash = sysSettings?.adminPasswordHash || '';
  if (dbAdminHash) {
    return bcrypt.compare(password, dbAdminHash);
  }

  const envPassword = (process.env.MASTER_ADMIN_PASSWORD || '').trim();
  if (envPassword) {
    return password === envPassword;
  }

  if (!isProduction()) {
    return password === DEV_FALLBACK_PASSWORD;
  }

  return false;
}

module.exports = { verifyAdminPassword, DEV_FALLBACK_PASSWORD };