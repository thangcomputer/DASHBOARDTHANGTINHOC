/**
 * Gộp nhật ký hoạt động học viên từ nhiều nguồn (điểm danh, hủy DD/hủy ca, BT, TN, đánh giá).
 */

function parseDateToMs(dStr) {
  if (!dStr) return 0;
  if (dStr instanceof Date) return dStr.getTime();
  if (typeof dStr === 'number') return dStr;
  const str = String(dStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const dt = new Date(year, month, day);
      if (!Number.isNaN(dt.getTime())) return dt.getTime();
    }
  }
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
}

function formatDateVi(raw) {
  if (!raw) return '';
  const ms = parseDateToMs(raw);
  if (!ms) {
    const s = String(raw);
    return s.includes('T') ? new Date(s).toLocaleDateString('vi-VN') : s;
  }
  return new Date(ms).toLocaleDateString('vi-VN');
}

function formatTimeVi(raw) {
  const ms = parseDateToMs(raw);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/** Nhãn ngày giờ thao tác: "14:32 · 16/8/2026" (không bịa 00:00 khi chỉ có ngày) */
function formatActedAtLabel(raw, fallbackTime = '') {
  const t = String(fallbackTime || '').trim();
  const rawStr = String(raw || '').trim();
  const dateOnlyPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (dateOnlyPattern.test(rawStr) && !t) {
    return rawStr;
  }
  const ms = parseDateToMs(raw);
  if (ms) {
    const d = new Date(ms);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN');
    if (t) return `${t} · ${date}`;
    // Date-only ISO midnight → chỉ hiện ngày
    if (
      !rawStr.includes('T')
      && !(raw instanceof Date)
      && typeof raw !== 'number'
      && (time === '00:00' || time === '0:00')
    ) {
      return date;
    }
    return `${time} · ${date}`;
  }
  const dateOnly = formatDateVi(raw);
  if (t && dateOnly) return `${t} · ${dateOnly}`;
  if (t) return t;
  return dateOnly || '';
}

function normCourse(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Lấy timestamp thao tác từ grade / note / lịch completed cùng ngày */
function resolveGradeActedAt(g, schedules = [], sid = '', course = '') {
  if (g?.at) return g.at;
  if (g?.actedAt) return g.actedAt;
  if (g?.createdAt) return g.createdAt;
  const note = String(g?.note || '');
  const isoInNote = note.match(/@\s*(\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?)/);
  if (isoInNote?.[1]) return isoInNote[1];
  const dateVi = formatDateVi(g?.date);
  if (dateVi && Array.isArray(schedules) && schedules.length) {
    const match = schedules.find((sch) => {
      if (!sch || String(sch.status || '').toLowerCase() !== 'completed') return false;
      const schSid = String(sch.studentId?._id || sch.studentId || '');
      if (sid && schSid && schSid !== sid) return false;
      if (course && sch.course && normCourse(sch.course) !== course) return false;
      return formatDateVi(sch.date) === dateVi;
    });
    if (match?.updatedAt) return match.updatedAt;
    if (match?.completedAt) return match.completedAt;
  }
  if (g?.time && g?.date) {
    const parts = String(g.date).split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts.map((x) => parseInt(x, 10));
      const tm = String(g.time).match(/(\d{1,2}):(\d{2})/);
      if (tm && Number.isFinite(dd) && Number.isFinite(mm) && Number.isFinite(yyyy)) {
        const dt = new Date(yyyy, mm - 1, dd, Number(tm[1]), Number(tm[2]));
        if (!Number.isNaN(dt.getTime())) return dt;
      }
    }
  }
  return null;
}

function classifyGradeNote(note) {
  const noteLower = String(note || '').toLowerCase();
  if (noteLower.includes('hủy điểm danh')) return 'attendance_cancel';
  if (noteLower.includes('hủy ca')) return 'schedule_cancel';
  if (noteLower.includes('cập nhật điểm') || noteLower.includes('sửa điểm')) return 'grade_update';
  if (noteLower.includes('bài nộp')) return 'homework';
  if (noteLower.includes('trắc nghiệm')) return 'quiz';
  if (noteLower.includes('đánh giá')) return 'evaluation';
  return 'attendance';
}

function normalizeAttendanceNote(note, sessionNumber) {
  const raw = String(note || '').trim();
  if (/buổi\s*\d+/i.test(raw)) return raw || 'Đã điểm danh hoàn thành buổi học';
  if (sessionNumber) return `Buổi ${sessionNumber}: ${raw || 'Đã điểm danh hoàn thành buổi học'}`;
  return raw || 'Đã điểm danh hoàn thành buổi học';
}

/**
 * @returns {Array<{ id, type, date, time, note, grade, timestamp, actedAt, actedAtLabel, meta? }>}
 */
export function buildStudentActivityLogs({
  student,
  assignments = [],
  quizzes = [],
  evaluations = [],
  schedules = [],
} = {}) {
  const logs = [];
  const seen = new Set();
  /** Tránh trùng hủy ca: activityLog + Schedule.status=cancelled */
  const seenScheduleCancels = new Set();
  const sid = String(student?.id || student?._id || '');
  const course = normCourse(student?.course);

  const cancelFingerprint = ({ scheduleId, date, note, startTime, endTime }) => {
    if (scheduleId) return `sid:${String(scheduleId)}`;
    const d = formatDateVi(date);
    const range = [startTime, endTime].filter(Boolean).join('–')
      || (String(note || '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/) || []).slice(1, 3).join('–');
    return `d:${d}|t:${range || String(note || '').slice(0, 80)}`;
  };

  const push = (entry) => {
    if (!entry?.id || seen.has(entry.id)) return;
    if (entry.type === 'schedule_cancel') {
      const fp = cancelFingerprint({
        scheduleId: entry.meta?.scheduleId,
        date: entry.date,
        note: entry.note,
      });
      if (seenScheduleCancels.has(fp)) return;
      seenScheduleCancels.add(fp);
    }
    const actedRaw = entry.actedAt || entry.timestamp;
    const actedAtLabel = entry.actedAtLabel
      || formatActedAtLabel(actedRaw, entry.time);
    seen.add(entry.id);
    logs.push({
      ...entry,
      actedAt: actedRaw || null,
      actedAtLabel: actedAtLabel || '',
    });
  };

  // 0) activityLog server (hủy điểm danh / hủy ca / bổ sung)
  (student?.activityLog || []).forEach((ev, idx) => {
    if (!ev) return;
    if (course && ev.course && normCourse(ev.course) !== course) return;
    const type = ev.type || classifyGradeNote(ev.note);
    const at = ev.at || ev.date;
    const sessionNumber = ev.sessionNumber;
    let note = ev.note || '';
    if (type === 'attendance') note = normalizeAttendanceNote(note, sessionNumber);
    else if (type === 'attendance_cancel' && sessionNumber && !/buổi\s*\d+/i.test(note)) {
      note = `Hủy điểm danh buổi ${sessionNumber}${note ? ` — ${note}` : ''}`;
    }
    push({
      id: `alog_${ev._id || ''}_${type}_${parseDateToMs(at)}_${idx}`,
      type,
      date: formatDateVi(ev.date || at),
      time: formatTimeVi(at),
      note,
      grade: null,
      timestamp: parseDateToMs(at) || Date.now() - idx * 1000,
      actedAt: at,
      meta: { sessionNumber, scheduleId: ev.scheduleId },
    });
  });

  // 1) Điểm danh / ghi chú đã sync vào grades (kể cả BT đã chấm)
  (student?.grades || []).forEach((g, idx) => {
    const type = classifyGradeNote(g.note);
    const actedAt = resolveGradeActedAt(g, schedules, sid, course);
    const ts = parseDateToMs(actedAt) || parseDateToMs(g.date) || Date.now() - idx * 1000;
    const sessionMatch = /buổi\s*(\d+)/i.exec(String(g.note || ''));
    const sessionNumber = sessionMatch ? Number(sessionMatch[1]) : null;
    push({
      id: `grade_${g.assignmentId || ''}_${g.date || ''}_${idx}_${(g.note || '').slice(0, 40)}`,
      type,
      date: formatDateVi(g.date),
      time: g.time || formatTimeVi(actedAt) || '',
      note: type === 'attendance'
        ? normalizeAttendanceNote(g.note, sessionNumber)
        : (g.note || 'Đã điểm danh hoàn thành buổi học'),
      grade: g.grade != null && g.grade !== '' ? Number(g.grade) : null,
      timestamp: ts,
      actedAt: actedAt || g.date,
      meta: { sessionNumber },
    });
  });

  // 1b) Lịch đã hủy (Schedule) — chỉ bổ sung nếu chưa có trong activityLog
  (schedules || []).forEach((sch, idx) => {
    if (!sch || String(sch.status || '').toLowerCase() !== 'cancelled') return;
    const schSid = String(sch.studentId?._id || sch.studentId || '');
    if (schSid && schSid !== sid) return;
    if (course && sch.course && normCourse(sch.course) !== course) return;
    const schId = String(sch._id || sch.id || '');
    const at = sch.updatedAt || sch.cancelledAt || sch.date;
    const d = formatDateVi(sch.date);
    const timeRange = [sch.startTime, sch.endTime].filter(Boolean).join('–');
    const reasonBit = sch.note ? ` — ${sch.note}` : '';
    const note = timeRange
      ? `Hủy ca ngày ${d} · ${timeRange}${reasonBit}`
      : `Hủy ca ngày ${d}${reasonBit}`;
    push({
      id: `sched_cancel_${schId || idx}`,
      type: 'schedule_cancel',
      date: d,
      time: formatTimeVi(at),
      note,
      grade: null,
      timestamp: parseDateToMs(at) || parseDateToMs(sch.date) || Date.now() - idx * 1000,
      actedAt: at,
      meta: { scheduleId: schId },
    });
  });

  // 2) Bài tập
  (assignments || []).forEach((assign) => {
    const sub = assign.mySubmission
      || (assign.submissions || []).find((s) => String(s.studentId?._id || s.studentId) === sid)
      || (assign.submissions || [])[0];
    if (!sub) return;

    const title = assign.title || 'Bài tập';
    const alreadyInGrades = (student?.grades || []).some((g) => {
      if (g.assignmentId && String(g.assignmentId) === String(assign._id)) return true;
      const n = String(g.note || '').toLowerCase();
      return n.includes(String(title).toLowerCase())
        && (n.startsWith('bài nộp:') || n.startsWith('cập nhật điểm:') || n.startsWith('sửa điểm:'));
    });

    const submittedAt = sub.createdAt || sub.submittedAt || sub.updatedAt;
    if (!alreadyInGrades && submittedAt) {
      push({
        id: `hw_submit_${assign._id}_${sub._id || ''}`,
        type: 'homework',
        date: formatDateVi(submittedAt),
        time: formatTimeVi(submittedAt),
        note: `Bài nộp: ${title}`,
        grade: null,
        timestamp: parseDateToMs(submittedAt),
        actedAt: submittedAt,
      });
    }

    const history = Array.isArray(sub.gradeHistory) ? sub.gradeHistory : [];
    if (history.length) {
      history.forEach((h, hIdx) => {
        const at = h.at || h.createdAt;
        const isUpdate = h.oldGrade != null;
        push({
          id: `hw_hist_${assign._id}_${hIdx}_${parseDateToMs(at)}`,
          type: 'grade_update',
          date: formatDateVi(at),
          time: formatTimeVi(at),
          note: isUpdate
            ? `Cập nhật điểm: ${title} (${h.oldGrade} → ${h.newGrade})${h.note ? ` - ${h.note}` : ''}`
            : `Chấm điểm: ${title}${h.note ? ` - ${h.note}` : ''}`,
          grade: h.newGrade != null ? Number(h.newGrade) : null,
          timestamp: parseDateToMs(at) || Date.now(),
          actedAt: at,
        });
      });
    } else if (!alreadyInGrades && sub.status === 'graded' && sub.grade != null) {
      const at = sub.updatedAt || sub.gradedAt || submittedAt;
      push({
        id: `hw_grade_${assign._id}_${sub._id || ''}`,
        type: 'grade_update',
        date: formatDateVi(at),
        time: formatTimeVi(at),
        note: `Chấm điểm: ${title}${sub.teacherFeedback ? ` - ${sub.teacherFeedback}` : ''}`,
        grade: Number(sub.grade),
        timestamp: parseDateToMs(at) || Date.now(),
        actedAt: at,
      });
    }
  });

  // 3) Trắc nghiệm
  (quizzes || []).forEach((q, qIdx) => {
    const targets = (q.targetStudentIds || []).map(String);
    const forStudent = targets.length
      ? targets.includes(sid)
      : (!q.courseName || !course || normCourse(q.courseName) === course);
    if (!forStudent) return;

    const sub = (q.submissions || []).find((s) => String(s.studentId?._id || s.studentId) === sid);
    if (!sub) return;

    const at = sub.submittedAt || sub.createdAt || q.updatedAt;
    const scorePct = sub.score;
    const score10 = scorePct != null ? Math.round((scorePct / 10) * 10) / 10 : null;
    const forfeit = !!sub.forfeit;
    push({
      id: `quiz_${q._id || qIdx}_${parseDateToMs(at)}`,
      type: 'quiz',
      date: formatDateVi(at),
      time: formatTimeVi(at),
      note: forfeit
        ? `Trắc nghiệm: ${q.title || 'Bài TN'} — Rớt (thoát giữa giờ)`
        : `Trắc nghiệm: ${q.title || 'Bài TN'} (${sub.correctCount ?? 0}/${sub.totalQuestions ?? 0} câu)`,
      grade: score10,
      rawScore: scorePct,
      timestamp: parseDateToMs(at) || Date.now() - qIdx * 1000,
      actedAt: at,
      meta: { isPassed: !forfeit && (sub.status === 'passed' || (scorePct != null && scorePct >= 70)), forfeit },
    });
  });

  // 4) Đánh giá
  (evaluations || []).forEach((ev, eIdx) => {
    if (String(ev.studentId?._id || ev.studentId || '') !== sid) return;
    const at = ev.updatedAt || ev.createdAt || ev.date;
    const kind = ev.type === 'teacher_rating' ? 'HV đánh giá GV' : (ev.milestone ? `Cột mốc: ${ev.milestone}` : 'Đánh giá');
    const score = ev.criteria && typeof ev.criteria === 'object'
      ? (() => {
          const vals = Object.values(ev.criteria).map(Number).filter((n) => Number.isFinite(n));
          if (!vals.length) return null;
          return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        })()
      : null;
    push({
      id: `eval_${ev._id || ev.id || eIdx}_${parseDateToMs(at)}`,
      type: 'evaluation',
      date: formatDateVi(at),
      time: formatTimeVi(at),
      note: `${kind}${ev.content ? ` — ${ev.content}` : ''}${ev.courseName ? ` (${ev.courseName})` : ''}`,
      grade: score,
      timestamp: parseDateToMs(at) || Date.now() - eIdx * 1000,
      actedAt: at,
    });
  });

  return logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export const ACTIVITY_LOG_META = {
  attendance: {
    label: 'Điểm danh',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconWrap: 'bg-blue-100 text-blue-700',
  },
  attendance_cancel: {
    label: 'Hủy điểm danh',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    iconWrap: 'bg-rose-100 text-rose-700',
  },
  schedule_cancel: {
    label: 'Hủy ca',
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    iconWrap: 'bg-slate-200 text-slate-700',
  },
  homework: {
    label: 'Bài nộp',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconWrap: 'bg-emerald-100 text-emerald-700',
  },
  grade_update: {
    label: 'Cập nhật điểm',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    iconWrap: 'bg-amber-100 text-amber-700',
  },
  quiz: {
    label: 'Trắc nghiệm',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    iconWrap: 'bg-purple-100 text-purple-700',
  },
  evaluation: {
    label: 'Đánh giá',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    iconWrap: 'bg-orange-100 text-orange-700',
  },
};
