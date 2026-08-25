/** Normalize branch ref (string | ObjectId | populated doc) → id string. */
export function toBranchId(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') {
    const id = raw._id ?? raw.id;
    if (id != null && typeof id === 'object') return String(id._id || id.id || '');
    return id != null ? String(id) : '';
  }
  const s = String(raw).trim();
  if (!s || s === '[object Object]') return '';
  return s;
}

export function sameBranchId(a, b) {
  const idA = toBranchId(a);
  const idB = toBranchId(b);
  return Boolean(idA && idB && idA === idB);
}

/** GV chỉ được phân cho HV cùng chi nhánh. */
export function teacherInStudentBranch(teacher, studentBranchId) {
  const studentBid = toBranchId(studentBranchId);
  if (!studentBid) return false;
  return sameBranchId(teacher?.branchId, studentBid);
}

export function branchOptionLabel(branch) {
  if (!branch) return 'Chi nhánh';
  const rawName = branch.name;
  const name = typeof rawName === 'object' && rawName
    ? String(rawName.name || rawName.label || rawName.vi || '')
    : String(rawName || '');
  const code = branch.code != null && typeof branch.code !== 'object'
    ? String(branch.code)
    : '';
  if (name && code) return `${name} (${code})`;
  return name || code || 'Chi nhánh';
}
