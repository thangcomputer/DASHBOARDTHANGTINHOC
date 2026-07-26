/**
 * Master admin — không hardcode mật khẩu trong source.
 * Production: cần MASTER_ADMIN_PASSWORD hoặc adminPasswordHash trong DB.
 * Development: fallback admin123 nếu chưa cấu hình env.
 */

const { verifyAdminPassword } = require('../utils/adminPassword');

async function verifyMasterAdminCredentials(identifier, password) {
  const expectedUser = process.env.MASTER_ADMIN_USER || 'admin';
  if (identifier !== expectedUser) return false;
  return verifyAdminPassword(password, null);
}

function getMasterAdminTokenPayload() {
  return {
    id: 'admin',
    role: 'admin',
    name: 'Admin Thắng Tin Học',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    branchId: null,
    branchCode: '',
  };
}

module.exports = { verifyMasterAdminCredentials, getMasterAdminTokenPayload };
