/**
 * Nội dung chuyển khoản lương GV theo buổi FIFO + học viên.
 */

export function formatSessionDateVi(raw) {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN');
}

/**
 * @param {Array<{ sessionNo?: number|null, studentName?: string, date?: any, course?: string }>} sessions
 * @param {{ monthLabel?: string, maxLen?: number }} [opts]
 */
export function buildTeacherPayoutTransferNote(sessions, opts = {}) {
  const maxLen = opts.maxLen ?? 120;
  const monthLabel = opts.monthLabel || '';
  const list = Array.isArray(sessions) ? sessions.filter(Boolean) : [];

  if (!list.length) {
    return monthLabel || 'Lương giảng dạy';
  }

  const parts = list.map((s) => {
    const name = String(s.studentName || 'Học viên').trim() || 'Học viên';
    const buoi = s.sessionNo != null && Number(s.sessionNo) > 0
      ? `Buổi ${Number(s.sessionNo)}`
      : 'Buổi';
    const dateStr = formatSessionDateVi(s.date);
    return dateStr ? `${buoi} - ${name} (${dateStr})` : `${buoi} - ${name}`;
  });

  let note = parts.join('; ');
  if (monthLabel) note = `${note} · ${monthLabel}`;
  if (note.length > maxLen) {
    note = `${note.slice(0, Math.max(0, maxLen - 1))}…`;
  }
  return note;
}

/** Lấy N buổi đầu (FIFO) từ danh sách pending. */
export function pickFifoPendingSessions(pendingSessions, count) {
  const n = Math.max(0, Number(count) || 0);
  if (!n || !Array.isArray(pendingSessions)) return [];
  return pendingSessions.slice(0, n);
}
