export function normalizeTeacherStatus(status) {
  return String(status || "").toLowerCase();
}

export function isTeacherActive(status) {
  return normalizeTeacherStatus(status) === "active";
}

export function isTeacherPending(status) {
  return normalizeTeacherStatus(status) === "pending";
}

export function isTeacherInactive(status) {
  return normalizeTeacherStatus(status) === "inactive";
}

export function isTeacherLocked(status) {
  return normalizeTeacherStatus(status) === "locked";
}

export const TEACHER_STATUS_LABELS = {
  active: "Đã cấp quyền giảng dạy",
  pending: "Chờ duyệt",
  inactive: "Chưa cấp quyền",
  locked: "Đã khóa (Trượt)",
  suspended: "Đã vô hiệu hóa",
};

export function getTeacherStatusLabel(status) {
  const key = normalizeTeacherStatus(status);
  return TEACHER_STATUS_LABELS[key] || status || "Chưa cấp quyền";
}
