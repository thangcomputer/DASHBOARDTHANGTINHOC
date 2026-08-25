/**
 * Thông báo in-app cho GV khi Admin thay đổi hồ sơ/lương, điểm danh bù, đạt mốc thưởng sao.
 * Fire-and-forget an toàn: lỗi notify không ảnh hưởng API nghiệp vụ.
 */
const logger = require('../config/logger');
const NotificationService = require('./NotificationService');
const { summarizeTeacherUpdates } = require('../utils/systemLogChangeSummary');
const { computeStarBonusSummary } = require('./teacherStarBonus');

function formatVnd(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n ?? '');
  return `${Math.round(v).toLocaleString('vi-VN')}đ`;
}

function formatMonthLabel(ym) {
  const [y, m] = String(ym || '').split('-');
  if (!y || !m) return String(ym || '');
  return `tháng ${Number(m)}/${y}`;
}

/**
 * Admin cập nhật GV → báo tăng/giảm lương và/hoặc đổi thông tin hồ sơ.
 * Không gửi khi GV tự sửa hồ sơ.
 */
async function notifyTeacherAdminUpdates(io, {
  teacherId,
  updates,
  prev,
  isAdminActor = false,
} = {}) {
  if (!io || !teacherId || !isAdminActor || !updates) return;
  try {
    const changes = summarizeTeacherUpdates(updates, prev);
    if (!changes.length) return;

    const salaryParts = changes.filter((c) => /lương\/buổi|Thưởng sao/i.test(c));
    const profileParts = changes.filter((c) => (
      !/lương\/buổi|Thưởng sao|kết quả thi|File thực hành/i.test(c)
    ));

    const tid = String(teacherId);

    if (salaryParts.length) {
      const from = Number(prev?.baseSalaryPerSession) || 0;
      const to = updates.baseSalaryPerSession !== undefined
        ? Number(updates.baseSalaryPerSession) || 0
        : from;
      const salaryChanged = updates.baseSalaryPerSession !== undefined && from !== to;
      const title = salaryChanged && to > from
        ? '💰 Lương buổi đã tăng'
        : salaryChanged && to < from
          ? '💵 Lương buổi đã điều chỉnh'
          : '💵 Cập nhật lương / thưởng sao';

      await NotificationService.send(io, {
        type: 'FINANCE',
        title,
        content: `Admin đã cập nhật: ${salaryParts.join('; ')}.`,
        receivers: tid,
        payload: {
          kind: 'teacher_salary_update',
          teacherId: tid,
          baseSalaryPerSession: updates.baseSalaryPerSession,
          customStarBonusAmount: updates.customStarBonusAmount,
        },
        link: '/teacher/finance',
      });
    }

    if (profileParts.length) {
      await NotificationService.send(io, {
        type: 'SYSTEM',
        title: 'ℹ️ Thông tin hồ sơ đã thay đổi',
        content: `Admin đã cập nhật hồ sơ của bạn: ${profileParts.join('; ')}.`,
        receivers: tid,
        payload: {
          kind: 'teacher_profile_update',
          teacherId: tid,
        },
        link: '/teacher#profile',
      });
    }
  } catch (err) {
    logger.warn('[teacherAdminNotifier] profile/salary: %s', err.message);
  }
}

/**
 * Admin điểm danh bù buổi của HV → báo GV phụ trách.
 */
async function notifyTeacherAdminMakeup(io, schedule, actor = {}) {
  if (!io || !schedule?.teacherId) return;
  try {
    const teacherId = String(schedule.teacherId._id || schedule.teacherId);
    const studentId = schedule.studentId?._id || schedule.studentId;
    const studentName = schedule.studentName || 'học viên';
    const course = schedule.course || 'khóa học';
    const d = schedule.date ? new Date(schedule.date) : null;
    const dateLabel = d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('vi-VN')
      : '—';
    const actorName = actor?.name ? ` (${actor.name})` : '';
    const hvLabel = studentId
      ? `⟦student_detail:${studentId}:profile|${studentName}⟧`
      : studentName;

    await NotificationService.send(io, {
      type: 'SCHEDULE',
      title: '📋 Admin đã điểm danh bù',
      content: `Admin${actorName} đã điểm danh bù cho ${hvLabel} — ${course}, ngày ${dateLabel}. Buổi học được tính vào tiến độ và lương buổi.`,
      receivers: teacherId,
      payload: {
        kind: 'admin_makeup_attendance',
        scheduleId: String(schedule._id || schedule.id || ''),
        studentId: studentId ? String(studentId) : null,
        course,
      },
      link: studentId
        ? `/teacher#students?studentId=${studentId}`
        : '/teacher#schedule',
    });
  } catch (err) {
    logger.warn('[teacherAdminNotifier] makeup: %s', err.message);
  }
}

/**
 * Khi GV vừa đủ điều kiện thưởng sao (tháng chưa chi) → báo 1 lần / tháng.
 */
async function maybeNotifyStarBonusEligibility(io, teacherId) {
  if (!io || !teacherId) return;
  try {
    const Teacher = require('../models/Teacher');
    const Notification = require('../models/Notification');
    const teacher = await Teacher.findById(teacherId)
      .select('starBonusPaidMonths startDate customStarBonusAmount name')
      .lean();
    if (!teacher) return;

    const summary = await computeStarBonusSummary(teacher);
    const unpaid = Array.isArray(summary.unpaidMonths) ? summary.unpaidMonths : [];
    if (!unpaid.length) return;

    const months = unpaid.map((m) => String(m.month));
    const tid = String(teacherId);
    const existing = await Notification.find({
      receivers: tid,
      'payload.kind': 'star_bonus_eligible',
      'payload.month': { $in: months },
    }).select('payload.month').lean();

    const already = new Set(
      (existing || []).map((n) => String(n.payload?.month || '')).filter(Boolean),
    );

    for (const row of unpaid) {
      const ym = String(row.month);
      if (already.has(ym)) continue;
      const amount = Number(row.amount) || summary.bonusPerMonth || 0;
      await NotificationService.send(io, {
        type: 'FINANCE',
        title: '⭐ Đã đạt mốc thưởng sao',
        content: `Bạn đã đủ điều kiện thưởng sao ${formatMonthLabel(ym)}`
          + ` (≥${summary.minStudents} HV + ≥${summary.minStars}★).`
          + ` Mức ${formatVnd(amount)} sẽ được cộng khi Admin chi lương tháng đó.`,
        receivers: tid,
        payload: {
          kind: 'star_bonus_eligible',
          month: ym,
          amount,
          studentsCount: row.studentsCount,
          avgStars: row.avgStars,
          teacherId: tid,
        },
        link: '/teacher/finance',
      });
    }
  } catch (err) {
    logger.warn('[teacherAdminNotifier] starBonus: %s', err.message);
  }
}

module.exports = {
  notifyTeacherAdminUpdates,
  notifyTeacherAdminMakeup,
  maybeNotifyStarBonusEligibility,
};
