const fs = require("fs");
const c = `export function normalizeTeacherStatus(status) {
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
  active: "\u0110\u00e3 c\u1ea5p quy\u1ec1n gi\u1ea3ng d\u1ea1y",
  pending: "Ch\u1edd duy\u1ec7t",
  inactive: "Ch\u01b0a c\u1ea5p quy\u1ec1n",
  locked: "\u0110\u00e3 kh\u00f3a (Tr\u01b0\u1ee3t)",
  suspended: "\u0110\u00e3 v\u00f4 hi\u1ec7u h\u00f3a",
};

export function getTeacherStatusLabel(status) {
  const key = normalizeTeacherStatus(status);
  return TEACHER_STATUS_LABELS[key] || status || "Ch\u01b0a c\u1ea5p quy\u1ec1n";
}
`;
fs.writeFileSync("d:/QUANLYCMS/client/src/constants/teacherStatus.js", c, "utf8");