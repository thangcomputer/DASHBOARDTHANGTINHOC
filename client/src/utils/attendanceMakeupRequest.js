/**
 * Draft + peer resolution for teacher → admin makeup attendance request.
 */

import { buildChatDeepLinkToken, buildStudentDetailDeepLinkToken } from './messageRichText';

export function formatScheduleDateLabel(dateRaw) {
  const s = String(dateRaw || '').slice(0, 10) || '—';
  try {
    const d = new Date(dateRaw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  } catch {
    /* keep fallback */
  }
  return s;
}

export function getMakeupSessionSummary({ student, schedule } = {}) {
  const name = student?.name || 'Học viên';
  const course = student?.course || schedule?.course || '';
  const done = Number(student?.completedSessions ?? 0);
  const remaining = Number(student?.remainingSessions ?? 0);
  const total = Number(student?.totalSessions ?? 0) || (done + remaining) || 0;
  const sessionNo = done + 1;
  const dateLabel = formatScheduleDateLabel(schedule?.date);
  const start = schedule?.startTime || '—';
  const end = schedule?.endTime || '—';
  return {
    name,
    course,
    done,
    remaining,
    total,
    sessionNo,
    dateLabel,
    start,
    end,
    timeRange: `${start}–${end}`,
  };
}

export function buildAttendanceMakeupDraft({ student, schedule, teacherName } = {}) {
  const s = getMakeupSessionSummary({ student, schedule });
  const gv = teacherName || 'Giảng viên';
  const studentId = student?._id || student?.id || '';
  // Token deep-link: Admin bấm tên HV → mở modal hồ sơ HV (tab điểm danh)
  const hvLabel = studentId
    ? buildStudentDetailDeepLinkToken({ id: studentId, name: s.name, tab: 'attendance', scheduleId: schedule?._id })
    : s.name;

  return [
    '[Yêu cầu điểm danh bù]',
    `GV gửi yêu cầu: ${gv}`,
    `HV: ${hvLabel}`,
    s.course ? `Khóa: ${s.course}` : null,
    s.total > 0 ? `Buổi: ${s.sessionNo}/${s.total}` : `Buổi tiếp theo (đã học ${s.done})`,
    `Lịch: ${s.dateLabel} · ${s.timeRange}`,
    '',
    '› Bấm tên học viên ở dòng HV để mở hồ sơ và điểm danh bù.',
    '',
    'Nội dung xác nhận:',
    '- Giảng viên chịu trách nhiệm về buổi học này.',
    '- Admin sẽ liên hệ học viên để xác nhận học viên đã học buổi này chưa.',
    '- Chỉ khi học viên đồng ý đã học, buổi này mới được tính cho giảng viên.',
    '',
    'Lý do: Quá hạn cửa sổ điểm danh 1 giờ của giảng viên — nhờ Admin xử lý điểm danh bù.',
  ].filter((line) => line !== null).join('\n');
}

/** Prefer legacy admin mailbox, then SUPER/HIGH from contacts. */
export function pickAdminContactForMakeup(contacts = []) {
  const list = Array.isArray(contacts) ? contacts.filter(Boolean) : [];
  return (
    list.find((c) => String(c.id) === 'admin')
    || list.find((c) => c.adminRole === 'SUPER_ADMIN')
    || list.find((c) => c.adminRole === 'HIGH_ADMIN')
    || list.find((c) => c.adminRole === 'STAFF' || c.role === 'staff' || c.role === 'admin')
    || { id: 'admin', name: 'Admin', role: 'admin', adminRole: 'SUPER_ADMIN' }
  );
}
