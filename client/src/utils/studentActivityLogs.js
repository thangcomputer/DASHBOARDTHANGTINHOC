/**
 * Gộp nhật ký hoạt động học viên từ nhiều nguồn (điểm danh, BT, TN, đánh giá).
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

function normCourse(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function classifyGradeNote(note) {
  const noteLower = String(note || '').toLowerCase();
  if (noteLower.includes('cập nhật điểm') || noteLower.includes('sửa điểm')) return 'grade_update';
  if (noteLower.includes('bài nộp')) return 'homework';
  if (noteLower.includes('trắc nghiệm')) return 'quiz';
  if (noteLower.includes('đánh giá')) return 'evaluation';
  return 'attendance';
}

/**
 * @returns {Array<{ id, type, date, time, note, grade, timestamp, meta? }>}
 */
export function buildStudentActivityLogs({
  student,
  assignments = [],
  quizzes = [],
  evaluations = [],
} = {}) {
  const logs = [];
  const seen = new Set();
  const sid = String(student?.id || student?._id || '');
  const course = normCourse(student?.course);

  const push = (entry) => {
    if (!entry?.id || seen.has(entry.id)) return;
    seen.add(entry.id);
    logs.push(entry);
  };

  // 1) Điểm danh / ghi chú đã sync vào grades (kể cả BT đã chấm)
  (student?.grades || []).forEach((g, idx) => {
    const type = classifyGradeNote(g.note);
    const ts = parseDateToMs(g.date) || Date.now() - idx * 1000;
    push({
      id: `grade_${g.assignmentId || ''}_${g.date || ''}_${idx}_${(g.note || '').slice(0, 40)}`,
      type,
      date: formatDateVi(g.date),
      time: g.time || '',
      note: g.note || 'Đã điểm danh hoàn thành buổi học',
      grade: g.grade != null && g.grade !== '' ? Number(g.grade) : null,
      timestamp: ts,
    });
  });

  // 2) Bài tập — nộp + lịch sử chấm (bổ sung nếu chưa có trong grades)
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
      meta: { isPassed: !forfeit && (sub.status === 'passed' || (scorePct != null && scorePct >= 70)), forfeit },
    });
  });

  // 4) Đánh giá (HV đánh giá GV / milestone)
  (evaluations || []).forEach((ev, eIdx) => {
    if (String(ev.studentId?._id || ev.studentId || '') !== sid) return;
    if (course && ev.courseName && normCourse(ev.courseName) !== course) {
      // vẫn hiển thị nếu cùng HV (đánh giá có thể không gắn course)
    }
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
