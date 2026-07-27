/**
 * Kiem tra quyen nhan tin 1-1 theo ma tran contacts (RBAC/ABAC).
 */
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { studentMatchesTeacher } = require('./enrollmentService');

function isStaff(u) {
  return u?.role === 'staff' || u?.adminRole === 'STAFF';
}
function isSuper(u) {
  return u?.id === 'admin' || u?.adminRole === 'SUPER_ADMIN';
}

/**
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function assertCanDirectMessage(sender, receiverId, receiverRole) {
  if (!sender) return { ok: false, message: 'Chua xac thuc' };
  const rid = String(receiverId || '');
  const rRole = String(receiverRole || '').toLowerCase();

  if (rid.startsWith('ALL_')) return { ok: true };
  if (isSuper(sender)) return { ok: true };

  if (sender.role === 'student' && (rRole === 'admin' || rid === 'admin')) {
    return { ok: true };
  }

  if (sender.role === 'student') {
    if (rRole === 'teacher') {
      const st = await Student.findById(sender.id).select('teacherId enrollments').lean();
      if (!st) return { ok: false, message: 'Khong tim thay hoc vien' };
      if (studentMatchesTeacher(st, rid)) return { ok: true };
      return { ok: false, message: 'Chi nhan tin giao vien dang day ban' };
    }
    if (rRole === 'staff' || rRole === 'admin') {
      if (rid === 'admin') return { ok: true };
      const [st, staff] = await Promise.all([
        Student.findById(sender.id).select('branchId branchCode').lean(),
        Teacher.findById(rid).select('adminRole branchId branchCode role').lean(),
      ]);
      if (!staff) return { ok: false, message: 'Khong tim thay lien he' };
      if (staff.adminRole === 'SUPER_ADMIN' || staff.role === 'admin') return { ok: true };
      if (staff.adminRole === 'STAFF' || staff.role === 'staff') {
        const sb = st?.branchId ? String(st.branchId) : '';
        const tb = staff.branchId ? String(staff.branchId) : '';
        if (sb && tb && sb === tb) return { ok: true };
        if (st?.branchCode && staff.branchCode && st.branchCode === staff.branchCode) return { ok: true };
        return { ok: false, message: 'Chi nhan tin giao vu cung chi nhanh' };
      }
      return { ok: false, message: 'Lien he khong hop le' };
    }
    return { ok: false, message: 'Khong duoc nhan tin den doi tuong nay' };
  }

  if (sender.role === 'teacher') {
    if (rRole === 'student') {
      const st = await Student.findById(rid).select('teacherId enrollments').lean();
      if (!st) return { ok: false, message: 'Khong tim thay hoc vien' };
      if (studentMatchesTeacher(st, sender.id)) return { ok: true };
      return { ok: false, message: 'Chi nhan tin hoc vien duoc phan cong' };
    }
    if (rRole === 'admin' || rRole === 'staff' || rid === 'admin') {
      if (rid === 'admin') return { ok: true };
      const [t, peer] = await Promise.all([
        Teacher.findById(sender.id).select('branchId branchCode').lean(),
        Teacher.findById(rid).select('adminRole branchId branchCode role').lean(),
      ]);
      if (!peer) return { ok: false, message: 'Khong tim thay lien he' };
      if (peer.adminRole === 'SUPER_ADMIN') return { ok: true };
      const tb = t?.branchId ? String(t.branchId) : '';
      const pb = peer.branchId ? String(peer.branchId) : '';
      if (tb && pb && tb === pb) return { ok: true };
      if (t?.branchCode && peer.branchCode && t.branchCode === peer.branchCode) return { ok: true };
      return { ok: false, message: 'Chi nhan tin giao vu cung chi nhanh' };
    }
    return { ok: false, message: 'Khong duoc nhan tin den doi tuong nay' };
  }

  if (isStaff(sender) || sender.role === 'admin') {
    if (rRole === 'student') {
      const [me, st] = await Promise.all([
        sender.id === 'admin' ? null : Teacher.findById(sender.id).select('branchId branchCode adminRole').lean(),
        Student.findById(rid).select('branchId branchCode').lean(),
      ]);
      if (!st) return { ok: false, message: 'Khong tim thay hoc vien' };
      if (!me || me.adminRole === 'SUPER_ADMIN') return { ok: true };
      const mb = me.branchId ? String(me.branchId) : '';
      const sb = st.branchId ? String(st.branchId) : '';
      if (mb && sb && mb === sb) return { ok: true };
      if (me.branchCode && st.branchCode && me.branchCode === st.branchCode) return { ok: true };
      return { ok: false, message: 'Khong duoc nhan tin hoc vien chi nhanh khac' };
    }
    if (rRole === 'teacher') {
      const [me, t] = await Promise.all([
        sender.id === 'admin' ? null : Teacher.findById(sender.id).select('branchId branchCode adminRole').lean(),
        Teacher.findById(rid).select('branchId branchCode').lean(),
      ]);
      if (!t) return { ok: false, message: 'Khong tim thay giao vien' };
      if (!me || me.adminRole === 'SUPER_ADMIN') return { ok: true };
      const mb = me.branchId ? String(me.branchId) : '';
      const tb = t.branchId ? String(t.branchId) : '';
      if (mb && tb && mb === tb) return { ok: true };
      if (me.branchCode && t.branchCode && me.branchCode === t.branchCode) return { ok: true };
      return { ok: false, message: 'Khong duoc nhan tin giao vien chi nhanh khac' };
    }
    return { ok: true };
  }

  return { ok: false, message: 'Khong duoc nhan tin' };
}

module.exports = { assertCanDirectMessage };
