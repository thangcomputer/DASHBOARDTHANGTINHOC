/**
 * Tính toán danh sách học viên có nguy cơ bỏ học (At-Risk Students) dựa trên:
 * 1) Lâu không đăng nhập (>= 5 ngày kể từ lastAccessAt / createdAt)
 * 2) Kết quả học tập giảm / yếu (avgGrade < 5.5 hoặc lastGrade < 5)
 * 3) Còn buổi học nhưng bị đứt quãng >= 7 ngày mà chưa có lịch học sắp tới
 */

function normalizeDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function getStudentId(student) {
  return String(student?._id || student?.id || '').trim();
}

function getRemainingSessions(student) {
  const direct = Number(student?.remainingSessions);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  if (Array.isArray(student?.enrollments)) {
    return student.enrollments.reduce((sum, enr) => sum + Math.max(0, Number(enr?.remainingSessions) || 0), 0);
  }
  return 0;
}

function getCourseLabel(student) {
  if (student?.course) return String(student.course);
  if (Array.isArray(student?.enrollments) && student.enrollments.length) {
    const active = student.enrollments.find((e) => e?.status === 'active') || student.enrollments[0];
    if (active?.courseName || active?.name) return String(active.courseName || active.name);
  }
  return 'Chưa gắn khóa';
}

export function computeAtRiskStudents(students = [], schedules = [], now = new Date()) {
  const nowMs = now.getTime();
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  const dayMs = 86_400_000;

  const upcomingStudentIds = new Set();
  const lastCompletedByStudent = new Map();
  for (const sch of schedules || []) {
    const sid = String(sch?.studentId?._id || sch?.studentId?.id || sch?.studentId || '').trim();
    if (!sid) continue;
    const dateKey = normalizeDateKey(sch?.date);
    if (!dateKey) continue;
    if (sch?.status === 'scheduled' && dateKey >= todayKey) {
      upcomingStudentIds.add(sid);
    } else if (sch?.status === 'completed') {
      const prev = lastCompletedByStudent.get(sid) || '';
      if (dateKey > prev) lastCompletedByStudent.set(sid, dateKey);
    }
  }

  const flagged = [];
  for (const student of students || []) {
    const id = getStudentId(student);
    if (!id) continue;

    const status = String(student?.enrollmentStatus || student?.status || '').toLowerCase();
    if (status === 'completed' || status === 'inactive' || status === 'suspended') continue;

    const reasons = [];
    let riskScore = 0;

    // 1. Kiểm tra số ngày chưa đăng nhập
    const lastRefRaw = student?.lastAccessAt || student?.createdAt;
    const lastRefMs = lastRefRaw ? new Date(lastRefRaw).getTime() : NaN;
    const daysInactive = Number.isFinite(lastRefMs)
      ? Math.max(0, Math.floor((nowMs - lastRefMs) / dayMs))
      : 0;
    if (daysInactive >= 5) {
      reasons.push(`Không truy cập ${daysInactive} ngày`);
      riskScore += daysInactive >= 10 ? 40 : 25;
    }

    // 2. Kiểm tra điểm số thấp
    const avg = Number(student?.avgGrade);
    const lastGrade = Number(student?.lastGrade);
    if (Number.isFinite(avg) && avg > 0 && avg < 5.5) {
      reasons.push(`Điểm TB thấp (${avg.toFixed(1)})`);
      riskScore += 30;
    } else if (Number.isFinite(lastGrade) && lastGrade > 0 && lastGrade < 5) {
      reasons.push(`Điểm gần nhất yếu (${lastGrade.toFixed(1)})`);
      riskScore += 25;
    }

    // 3. Còn buổi nhưng gián đoạn lịch >= 7 ngày
    const remaining = getRemainingSessions(student);
    if (remaining > 0 && !upcomingStudentIds.has(id)) {
      const attDates = Array.isArray(student?.attendanceDates) ? student.attendanceDates : [];
      const latestAtt = attDates
        .map(normalizeDateKey)
        .filter(Boolean)
        .sort()
        .pop() || '';
      const lastSchedule = lastCompletedByStudent.get(id) || '';
      const latestStudyKey = [latestAtt, lastSchedule].filter(Boolean).sort().pop() || '';
      const latestStudyMs = latestStudyKey
        ? new Date(`${latestStudyKey}T00:00:00+07:00`).getTime()
        : lastRefMs;
      const studyGapDays = Number.isFinite(latestStudyMs)
        ? Math.max(0, Math.floor((nowMs - latestStudyMs) / dayMs))
        : 0;
      if (studyGapDays >= 7) {
        reasons.push(`Còn ${remaining} buổi chưa xếp lịch (${studyGapDays} ngày)`);
        riskScore += 20;
      }
    }

    if (!reasons.length) continue;
    flagged.push({
      id,
      name: student?.name || 'Học viên',
      course: getCourseLabel(student),
      phone: student?.phone || '',
      remainingSessions: remaining,
      avgGrade: Number.isFinite(avg) ? avg : 0,
      daysInactive,
      riskScore,
      level: riskScore >= 45 ? 'high' : 'medium',
      reasons,
    });
  }

  return flagged.sort((a, b) => b.riskScore - a.riskScore || b.daysInactive - a.daysInactive);
}

