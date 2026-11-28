/**
 * Helper nhận diện & cô lập theme Giọt Nước 3D cho riêng tài khoản DewSkill.
 * Tài khoản Trung tâm (học viên khóa TT, giảng viên, admin, nhân viên) trả 'center'
 * để không bị áp dụng bất kỳ CSS [data-theme="dewskill"] nào.
 */
export function isDewSkillAccount(explicitUser = null) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (root.classList.contains('cms-app-shell')) {
      return root.hasAttribute('data-free-portal-student');
    }
    if (root.hasAttribute('data-free-portal-student')) {
      return true;
    }
  }

  let candidate = explicitUser;
  if (!candidate && typeof window !== 'undefined') {
    try {
      const hasOtherRole = Boolean(
        localStorage.getItem('admin_access_token')
        || localStorage.getItem('staff_access_token')
        || localStorage.getItem('teacher_access_token'),
      );
      const studentToken = localStorage.getItem('student_access_token');
      if (hasOtherRole && !studentToken) return false;
      candidate = JSON.parse(localStorage.getItem('student_user') || 'null');
    } catch {
      candidate = null;
    }
  }

  if (!candidate || typeof candidate !== 'object') return false;
  if (candidate.role && candidate.role !== 'student') return false;

  if (
    candidate.accountType === 'dewskill'
    || candidate.platform === 'dewskill'
    || candidate.freePortal === true
  ) {
    return true;
  }

  const course = String(candidate.course || '').toLowerCase();
  return course === 'tài khoản miễn phí' || course.includes('miễn phí');
}

export function getDewSkillThemeAttr(explicitUser = null) {
  return isDewSkillAccount(explicitUser) ? 'dewskill' : 'center';
}

export function dewClass(dewCls, centerCls = '', explicitUser = null) {
  return isDewSkillAccount(explicitUser) ? dewCls : centerCls;
}
