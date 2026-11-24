'use strict';

const SUPPORT_ADMIN_ROLES = ['SUPPORT', 'SUPPORT_AGENT'];

function isSupportAdminRole(adminRole) {
  return SUPPORT_ADMIN_ROLES.includes(String(adminRole || '').trim().toUpperCase());
}

async function resolveQueryResult(queryOrValue) {
  if (!queryOrValue) return null;
  if (typeof queryOrValue.select === 'function') {
    const selected = queryOrValue.select('_id name phone status adminRole');
    if (selected && typeof selected.lean === 'function') {
      return selected.lean();
    }
    return selected;
  }
  if (typeof queryOrValue.lean === 'function') {
    return queryOrValue.lean();
  }
  return queryOrValue;
}

async function findExistingSupportAgent(TeacherModel, excludeId = null) {
  if (!TeacherModel || typeof TeacherModel.findOne !== 'function') return null;
  const filter = {
    adminRole: { $in: SUPPORT_ADMIN_ROLES },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  const query = TeacherModel.findOne(filter);
  return resolveQueryResult(query);
}

/**
 * Đảm bảo chỉ có tối đa 1 tài khoản giữ vai trò Chuyên viên Hỗ trợ (SUPPORT).
 */
async function assertSingletonSupportAgent({ TeacherModel, adminRole, excludeId = null }) {
  if (!isSupportAdminRole(adminRole)) {
    return { ok: true };
  }
  const holder = await findExistingSupportAgent(TeacherModel, excludeId);
  if (!holder) {
    return { ok: true };
  }
  const holderName = (holder.name && String(holder.name).trim()) || holder.phone || 'tài khoản khác';
  return {
    ok: false,
    status: 409,
    code: 'SUPPORT_AGENT_ALREADY_ASSIGNED',
    holder: {
      id: String(holder._id),
      name: holder.name || holder.phone || 'Nhân viên hỗ trợ',
      phone: holder.phone || '',
    },
    message: `Vai trò Chuyên viên Hỗ trợ đã được gán cho "${holderName}". Chỉ được phép chọn 1 tài khoản duy nhất — hãy đổi vai trò của tài khoản này trước khi gán cho người khác.`,
  };
}

module.exports = {
  SUPPORT_ADMIN_ROLES,
  isSupportAdminRole,
  findExistingSupportAgent,
  assertSingletonSupportAgent,
};
