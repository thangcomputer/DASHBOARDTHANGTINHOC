'use strict';

const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const LedgerEntry = require('../models/LedgerEntry');
const UserDeviceSession = require('../models/UserDeviceSession');
const AuthSession = require('../models/AuthSession');
const RegisteredDevice = require('../models/RegisteredDevice');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');
const LmsLearnerProgress = require('../models/LmsLearnerProgress');
const presenceStore = require('../config/presenceStore');
const { FREE_COURSE_NAME } = require('./freePortal');
const { sumFinancialRevenue } = require('./ledgerService');
const { vnDateKey, vnStartOfDay } = require('../utils/vnTimezone');

const ONLINE_WINDOW_MS = 15 * 60_000;
const DAY_MS = 86_400_000;
const FREE_NAME_LOWER = FREE_COURSE_NAME.toLowerCase();
const PAID_PLANS = new Set(['1m', '3m', '6m', '12m']);
const INACTIVE_RISK_STATUSES = new Set([
  'completed',
  'hoàn thành',
  'hoan thanh',
  'inactive',
  'suspended',
  'cancelled',
  'refunded',
  'hủy',
  '(đã hủy)',
  'thôi học',
  'đã hoàn phí',
]);

function normalizeCourseLabel(value) {
  return String(value || '').trim().toLowerCase();
}

function isFreeCourseLabel(value) {
  return normalizeCourseLabel(value) === FREE_NAME_LOWER;
}

function isDroppedEnrollmentStatus(status) {
  const st = String(status || '').trim().toLowerCase();
  return st === 'cancelled' || st === 'refunded';
}

function toIdString(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

/**
 * Computes exam progress status aligned with FE getExamProgressDisplayStatus.
 */
function getExamProgressDisplayStatus(entry) {
  const status = String(entry?.status || '');
  const score = Number(entry?.tracNghiem?.score ?? entry?.score);
  const total = Number(entry?.tracNghiem?.total ?? entry?.total);
  const tnPassed = Number.isFinite(score) && Number.isFinite(total) && total > 0 && score / total >= 0.5;

  if (status === 'dang_thi' && tnPassed && entry?.thucHanh !== 'da_nop') return 'cho_nop';
  if (
    status === 'dang_thi'
    && tnPassed
    && entry?.thucHanh === 'da_nop'
    && (entry?.essayScore === null || entry?.essayScore === undefined)
  ) {
    return 'cho_cham';
  }
  if (status === 'dang_thi') return 'dang_thi';
  if (status === 'khong_dat') return 'khong_dat';
  if (!tnPassed) return 'khong_dat';
  if (entry?.thucHanh !== 'da_nop') return status;
  if (entry?.essayScore === null || entry?.essayScore === undefined) return 'cho_cham';
  return Number(entry.essayScore) >= 5 ? 'dat' : 'khong_dat';
}

function summarizeExamProgress(students = []) {
  const summary = { total: 0, dat: 0, choNop: 0, choCham: 0, dangThi: 0, khongDat: 0 };
  for (const student of Array.isArray(students) ? students : []) {
    for (const entry of Array.isArray(student?.examProgress) ? student.examProgress : []) {
      if (!entry?.status || entry.status === 'chua_thi') continue;
      summary.total += 1;
      const displayStatus = getExamProgressDisplayStatus(entry);
      if (displayStatus === 'dat') summary.dat += 1;
      else if (displayStatus === 'cho_nop') summary.choNop += 1;
      else if (displayStatus === 'cho_cham') summary.choCham += 1;
      else if (displayStatus === 'dang_thi') summary.dangThi += 1;
      else if (displayStatus === 'khong_dat') summary.khongDat += 1;
    }
  }
  return summary;
}

/**
 * Determines whether a student completed tuition or purchased a paid package/course.
 * Free-portal accounts have paid:true, price:0 at registration and must not inflate paid KPIs
 * unless they actually paid for a subscription/XP/course.
 */
function isStudentPaidOrPurchased(student, ledgerNet = 0) {
  if (!student) return false;
  if (Number(ledgerNet) > 0) return true;
  if (Number(student.paidAmount) > 0) return true;
  if (student.freeUnlocked === true) return true;
  if (PAID_PLANS.has(String(student?.subscription?.plan || ''))) return true;

  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  if (enrollments.length > 0) {
    return enrollments.some((enr) => {
      if (isDroppedEnrollmentStatus(enr?.status)) return false;
      if (enr?.paid !== true) return false;
      const price = Number(enr?.price) || 0;
      const courseName = enr?.courseName || enr?.name || '';
      if (price > 0) return true;
      return student.freePortal !== true && !isFreeCourseLabel(courseName);
    });
  }

  const rootStatus = String(student.status || '').trim().toLowerCase();
  if (isDroppedEnrollmentStatus(rootStatus)) return false;
  if (student.paid !== true) return false;
  if (student.freePortal === true) return (Number(student.price) || 0) > 0;
  return true;
}

/**
 * Determines whether a student genuinely logged in, learned, or practiced.
 */
function isStudentEngaged(student, engagedSessionIds = new Set()) {
  if (!student) return false;
  const sid = toIdString(student._id || student.id);
  if (sid && engagedSessionIds.has(sid)) return true;
  if (student.lastAccessAt) return true;
  if ((Number(student.completedSessions) || 0) > 0) return true;
  if (Array.isArray(student.attendanceDates) && student.attendanceDates.length > 0) return true;
  if (student?.freeSurvey?.answeredAt) return true;
  if (Array.isArray(student.enrollments) && student.enrollments.some((e) => (Number(e?.completedSessions) || 0) > 0)) {
    return true;
  }
  if (Array.isArray(student.examProgress) && student.examProgress.some((e) => e?.status && e.status !== 'chua_thi')) {
    return true;
  }
  return false;
}

function getStudentRemainingSessions(student) {
  const direct = Number(student?.remainingSessions);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  if (Array.isArray(student?.enrollments)) {
    return student.enrollments
      .filter((e) => !isDroppedEnrollmentStatus(e?.status))
      .reduce((sum, enr) => sum + Math.max(0, Number(enr?.remainingSessions) || 0), 0);
  }
  return 0;
}

function getStudentCourseLabel(student) {
  if (student?.course) return String(student.course);
  if (Array.isArray(student?.enrollments) && student.enrollments.length) {
    const active = student.enrollments.find((e) => String(e?.status || '').toLowerCase() === 'active')
      || student.enrollments[0];
    if (active?.courseName || active?.name) return String(active.courseName || active.name);
  }
  return 'Chưa gắn khóa';
}

function toScheduleDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return vnDateKey(d);
}

/**
 * Computes at-risk students across the full filtered student list with live session timestamps
 * and real schedule rows (VN calendar).
 */
function computeAtRiskStudentsServer(students = [], schedules = [], latestActivityByStudent = new Map(), now = new Date()) {
  const nowMs = now.getTime();
  const todayKey = vnDateKey(now);

  const upcomingStudentIds = new Set();
  const lastCompletedByStudent = new Map();
  for (const sch of schedules || []) {
    const sid = toIdString(sch?.studentId);
    if (!sid) continue;
    const dateKey = toScheduleDateKey(sch?.date);
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
    const id = toIdString(student?._id || student?.id);
    if (!id) continue;

    const status = String(student?.enrollmentStatus || student?.status || '').trim().toLowerCase();
    if (INACTIVE_RISK_STATUSES.has(status)) continue;

    const reasons = [];
    let riskScore = 0;

    const accessCandidates = [
      student?.lastAccessAt ? new Date(student.lastAccessAt).getTime() : NaN,
      latestActivityByStudent.get(id) ?? NaN,
    ].filter(Number.isFinite);
    const bestAccessMs = accessCandidates.length ? Math.max(...accessCandidates) : NaN;
    const createdMs = student?.createdAt ? new Date(student.createdAt).getTime() : NaN;
    const lastRefMs = Number.isFinite(bestAccessMs) ? bestAccessMs : createdMs;
    const daysInactive = Number.isFinite(lastRefMs)
      ? Math.max(0, Math.floor((nowMs - lastRefMs) / DAY_MS))
      : 0;
    if (daysInactive >= 5) {
      reasons.push(`Không truy cập ${daysInactive} ngày`);
      riskScore += daysInactive >= 10 ? 40 : 25;
    }

    const avg = Number(student?.avgGrade);
    const lastGrade = Number(student?.lastGrade);
    if (Number.isFinite(avg) && avg > 0 && avg < 5.5) {
      reasons.push(`Điểm TB thấp (${avg.toFixed(1)})`);
      riskScore += 30;
    } else if (Number.isFinite(lastGrade) && lastGrade > 0 && lastGrade < 5) {
      reasons.push(`Điểm gần nhất yếu (${lastGrade.toFixed(1)})`);
      riskScore += 25;
    }

    const remaining = getStudentRemainingSessions(student);
    if (remaining > 0 && !upcomingStudentIds.has(id)) {
      const attDates = Array.isArray(student?.attendanceDates) ? student.attendanceDates : [];
      const latestAtt = attDates.map(toScheduleDateKey).filter(Boolean).sort().pop() || '';
      const lastSchedule = lastCompletedByStudent.get(id) || '';
      const latestStudyKey = [latestAtt, lastSchedule].filter(Boolean).sort().pop() || '';
      const latestStudyMs = latestStudyKey
        ? new Date(`${latestStudyKey}T00:00:00+07:00`).getTime()
        : lastRefMs;
      const studyGapDays = Number.isFinite(latestStudyMs)
        ? Math.max(0, Math.floor((nowMs - latestStudyMs) / DAY_MS))
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
      course: getStudentCourseLabel(student),
      phone: student?.phone || '',
      remainingSessions: remaining,
      daysInactive,
      reasons,
      riskScore,
      level: riskScore >= 40 ? 'high' : 'medium',
    });
  }

  flagged.sort((a, b) => b.riskScore - a.riskScore || b.daysInactive - a.daysInactive);
  return { total: flagged.length, items: flagged };
}

function buildAutomationsForStudents(students = [], atRiskItems = [], now = new Date()) {
  const todayKey = vnDateKey(now);
  const thisMonth = todayKey.slice(5, 7);
  const items = [];

  for (const s of students || []) {
    const sid = toIdString(s?._id || s?.id);
    if (!sid) continue;
    const status = String(s?.status || '').trim().toLowerCase();
    if (INACTIVE_RISK_STATUSES.has(status)) continue;

    const dobRaw = s?.dob || s?.birthDate || s?.dateOfBirth || '';
    if (dobRaw) {
      const dobDate = new Date(dobRaw);
      if (!Number.isNaN(dobDate.getTime())) {
        const dobKey = vnDateKey(dobDate);
        if (dobKey.slice(5, 7) === thisMonth) {
          items.push({
            id: `bday-${sid}`,
            kind: 'birthday',
            badge: dobKey.slice(5) === todayKey.slice(5) ? '🎂 Sinh nhật hôm nay' : '🎂 Sinh nhật tháng này',
            tone: 'bg-pink-50 text-pink-700 border-pink-200/70',
            studentName: s.name || 'Học viên',
            message: `Chúc mừng sinh nhật bạn ${s.name || ''}! Trung tâm Thắng Tin Học gửi tặng bạn +50 XP & chúc bạn học tập thật vui!`,
          });
        }
      }
    }

    const rem = getStudentRemainingSessions(s);
    if (rem > 0 && rem <= 2) {
      items.push({
        id: `renew-${sid}`,
        kind: 'renewal',
        badge: `⏰ Còn ${rem} buổi`,
        tone: 'bg-amber-50 text-amber-800 border-amber-200/70',
        studentName: s.name || 'Học viên',
        message: `Chào ${s.name || 'bạn'}, khóa ${getStudentCourseLabel(s)} của bạn chỉ còn ${rem} buổi. Hãy gia hạn sớm để giữ lịch học cố định nhé!`,
      });
    }
  }

  for (const r of atRiskItems || []) {
    if (r.daysInactive >= 5) {
      items.push({
        id: `nudge-${r.id}`,
        kind: 'nudge',
        badge: `📩 Vắng ${r.daysInactive} ngày`,
        tone: 'bg-sky-50 text-sky-700 border-sky-200/70',
        studentName: r.name,
        message: `Chào ${r.name}, đã ${r.daysInactive} ngày chưa thấy bạn vào luyện DewSkill! Hôm nay dành 10 phút hoàn thành mục tiêu nhé!`,
      });
    }
  }

  return { total: items.length, items: items.slice(0, 12) };
}

/**
 * Pure calculation for distinct online users (all roles including Admin/Staff) and today's active students.
 */
function computeOnlineAndTodayUsers({
  hasBranchScope = false,
  branchId = null,
  allowedAccountIds = new Set(),
  branchStudentIds = new Set(),
  presenceList = [],
  activeWebSessions = [],
  activeMobileSessions = [],
  todayWebStudentIds = [],
  todayMobileStudentIds = [],
  todayRegisteredStudentIds = [],
  studentsWithAccessToday = [],
  requesterUser = null,
} = {}) {
  const branchStr = branchId && typeof branchId !== 'object' ? String(branchId) : '';
  const isAccountInScope = (uid, rowBranchId = null) => {
    if (!uid) return false;
    if (!hasBranchScope) return true;
    if (allowedAccountIds.has(uid)) return true;
    if (branchStr && rowBranchId && String(rowBranchId) === branchStr) return true;
    return false;
  };

  const onlineUserIds = new Set();
  for (const row of presenceList || []) {
    const uid = String(row?.userId || '').trim();
    if (isAccountInScope(uid, row?.branchId)) onlineUserIds.add(uid);
  }
  for (const row of activeWebSessions || []) {
    const uid = String(row?.userId || '').trim();
    if (isAccountInScope(uid)) onlineUserIds.add(uid);
  }
  for (const row of activeMobileSessions || []) {
    const uid = String(row?.userId || '').trim();
    if (isAccountInScope(uid)) onlineUserIds.add(uid);
  }
  if (requesterUser?.id) {
    const reqUid = String(requesterUser.id).trim();
    if (!hasBranchScope || isAccountInScope(reqUid, requesterUser.branchId)) {
      onlineUserIds.add(reqUid);
    }
  }

  const activeTodayStudentIds = new Set();
  const addTodayStudent = (rawId) => {
    const sid = String(rawId || '').trim();
    if (sid && branchStudentIds.has(sid)) activeTodayStudentIds.add(sid);
  };
  for (const row of presenceList || []) {
    if (String(row?.role || '').toLowerCase() === 'student') addTodayStudent(row.userId);
  }
  for (const sid of todayWebStudentIds || []) addTodayStudent(sid);
  for (const sid of todayMobileStudentIds || []) addTodayStudent(sid);
  for (const sid of todayRegisteredStudentIds || []) addTodayStudent(sid);
  for (const sid of studentsWithAccessToday || []) addTodayStudent(sid);

  return {
    onlineTotal: onlineUserIds.size,
    activeToday: activeTodayStudentIds.size,
  };
}

function buildPendingAggregate(bf) {
  return Student.aggregate([
    { $match: { ...bf } },
    {
      $project: {
        pending: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ['$enrollments', []] } }, 0] },
            {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$enrollments',
                      as: 'e',
                      cond: {
                        $and: [
                          { $ne: ['$$e.paid', true] },
                          { $ne: ['$$e.status', 'cancelled'] },
                          { $ne: ['$$e.status', 'refunded'] },
                        ],
                      },
                    },
                  },
                  as: 'e',
                  in: { $ifNull: ['$$e.price', 0] },
                },
              },
            },
            {
              $cond: [
                { $or: [{ $eq: ['$paid', true] }, { $in: ['$status', ['cancelled', 'refunded']] }] },
                0,
                { $ifNull: ['$price', 0] },
              ],
            },
          ],
        },
      },
    },
    { $group: { _id: null, total: { $sum: '$pending' } } },
  ]);
}

function getLivePresenceList(req) {
  const io = req?.app?.get?.('io');
  if (io?.sockets?.sockets) {
    presenceStore.dropOfflineSockets((socketId) => io.sockets.sockets.has(socketId));
  }
  return presenceStore.listPresence();
}

/**
 * Computes full-database, branch-scoped stats for the Admin Overview Dashboard.
 */
async function computeAdminOverviewStats({
  branchFilter: bf = {},
  teacherBranchFilter = {},
  req = null,
  now = new Date(),
} = {}) {
  const branchId = bf.branchId || null;
  const hasBranchScope = Boolean(bf.branchId || bf._id);
  const isFailClosed = Boolean(bf._id && !bf.branchId);
  const startOfTodayVN = vnStartOfDay(now);
  const startOfTodayMs = startOfTodayVN.getTime();
  const fifteenMinsAgo = new Date(now.getTime() - ONLINE_WINDOW_MS);

  const [
    students,
    teacherAndStaffDocs,
    revenueAll,
    todayRevenueRow,
    pendingResult,
    activeWebSessions,
    activeMobileSessions,
  ] = await Promise.all([
    Student.find(bf)
      .select(
        'name phone course status createdAt lastAccessAt avgGrade lastGrade remainingSessions completedSessions attendanceDates paid paidAmount price studentExamUnlocked freePortal freeUnlocked subscription.plan examProgress enrollments.courseName enrollments.name enrollments.status enrollments.paid enrollments.price enrollments.remainingSessions enrollments.completedSessions freeSurvey.answeredAt dob birthDate dateOfBirth',
      )
      .lean(),
    Teacher.find({ ...teacherBranchFilter, role: { $in: ['teacher', 'admin', 'staff'] } })
      .select('_id role status branchId')
      .lean(),
    isFailClosed ? Promise.resolve({ net: 0 }) : sumFinancialRevenue({ branchId }),
    isFailClosed ? Promise.resolve({ net: 0 }) : sumFinancialRevenue({ branchId, from: startOfTodayVN, to: now }),
    buildPendingAggregate(bf),
    UserDeviceSession.find({
      revokedAt: null,
      expiresAt: { $gt: now },
      lastActiveAt: { $gte: fifteenMinsAgo },
    })
      .select('userId role')
      .lean(),
    AuthSession.find({
      revokedAt: null,
      absoluteExpiresAt: { $gt: now },
      lastUsedAt: { $gte: fifteenMinsAgo },
    })
      .select('userId role')
      .lean(),
  ]);

  const studentObjectIds = students.map((s) => s._id);
  const studentIdStrings = studentObjectIds.map((id) => String(id));
  const branchStudentIds = new Set(studentIdStrings);
  const allowedAccountIds = new Set([
    ...studentIdStrings,
    ...teacherAndStaffDocs.map((t) => String(t._id)),
  ]);

  const [
    todayWebStudentIds,
    todayMobileStudentIds,
    todayRegisteredStudentIds,
    webActivityAgg,
    mobileActivityAgg,
    registeredEngagedIds,
    practiceEngagedIds,
    lmsEngagedIds,
    ledgerRows,
    schedules,
  ] = studentObjectIds.length > 0
    ? await Promise.all([
      UserDeviceSession.distinct('userId', {
        role: 'student',
        userId: { $in: studentIdStrings },
        $or: [{ lastActiveAt: { $gte: startOfTodayVN } }, { createdAt: { $gte: startOfTodayVN } }],
      }),
      AuthSession.distinct('userId', {
        role: 'student',
        userId: { $in: studentObjectIds },
        $or: [{ lastUsedAt: { $gte: startOfTodayVN } }, { createdAt: { $gte: startOfTodayVN } }],
      }),
      RegisteredDevice.distinct('userId', {
        role: 'student',
        userId: { $in: studentIdStrings },
        lastActiveAt: { $gte: startOfTodayVN },
      }),
      UserDeviceSession.aggregate([
        { $match: { role: 'student', userId: { $in: studentIdStrings } } },
        { $group: { _id: '$userId', latestAt: { $max: '$lastActiveAt' } } },
      ]),
      AuthSession.aggregate([
        { $match: { role: 'student', userId: { $in: studentObjectIds } } },
        { $group: { _id: '$userId', latestAt: { $max: '$lastUsedAt' } } },
      ]),
      RegisteredDevice.distinct('userId', {
        role: 'student',
        status: 'active',
        userId: { $in: studentIdStrings },
      }),
      DailyPracticeProfile.distinct('studentId', { studentId: { $in: studentObjectIds } }),
      LmsLearnerProgress.distinct('studentId', {
        studentId: { $in: studentObjectIds },
        $or: [
          { lastStudyDay: { $nin: ['', null] } },
          { streak: { $gt: 0 } },
          { bestStreak: { $gt: 0 } },
        ],
      }),
      LedgerEntry.aggregate([
        {
          $match: {
            status: 'posted',
            type: { $in: ['payment', 'refund'] },
            studentId: { $in: studentObjectIds },
          },
        },
        {
          $group: {
            _id: '$studentId',
            payments: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } },
            refunds: { $sum: { $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0] } },
          },
        },
      ]),
      Schedule.find({
        studentId: { $in: studentObjectIds },
        status: { $in: ['scheduled', 'completed'] },
      })
        .select('studentId status date')
        .lean(),
    ])
    : [[], [], [], [], [], [], [], [], [], []];

  const ledgerNetByStudent = new Map();
  for (const row of ledgerRows || []) {
    ledgerNetByStudent.set(String(row._id), (Number(row.payments) || 0) - (Number(row.refunds) || 0));
  }

  const engagedSessionIds = new Set([
    ...registeredEngagedIds.map((id) => String(id)),
    ...practiceEngagedIds.map((id) => String(id)),
    ...lmsEngagedIds.map((id) => String(id)),
  ]);
  const latestActivityByStudent = new Map();
  const recordLatestActivity = (rawId, ts) => {
    const sid = String(rawId || '');
    const ms = ts ? new Date(ts).getTime() : NaN;
    if (!sid || !Number.isFinite(ms)) return;
    engagedSessionIds.add(sid);
    const prev = latestActivityByStudent.get(sid);
    if (!Number.isFinite(prev) || ms > prev) latestActivityByStudent.set(sid, ms);
  };
  for (const row of webActivityAgg || []) recordLatestActivity(row._id, row.latestAt);
  for (const row of mobileActivityAgg || []) recordLatestActivity(row._id, row.latestAt);

  const presenceList = getLivePresenceList(req);
  for (const row of presenceList || []) {
    if (String(row?.role || '').toLowerCase() === 'student') {
      recordLatestActivity(row.userId, row.connectedAt || now);
    }
  }

  const studentsWithAccessToday = [];
  let paidCount = 0;
  let unpaidCount = 0;
  let unlockedCount = 0;
  let engagedCount = 0;

  for (const s of students) {
    const sid = String(s._id);
    if (s.lastAccessAt) {
      const accessMs = new Date(s.lastAccessAt).getTime();
      if (Number.isFinite(accessMs) && accessMs >= startOfTodayMs) {
        studentsWithAccessToday.push(sid);
      }
    }
    if (s.studentExamUnlocked === true) unlockedCount += 1;
    if (s.paid === false) unpaidCount += 1;
    if (isStudentPaidOrPurchased(s, ledgerNetByStudent.get(sid) || 0)) paidCount += 1;
    if (isStudentEngaged(s, engagedSessionIds)) engagedCount += 1;
  }

  const { onlineTotal, activeToday } = computeOnlineAndTodayUsers({
    hasBranchScope,
    branchId,
    allowedAccountIds,
    branchStudentIds,
    presenceList,
    activeWebSessions,
    activeMobileSessions,
    todayWebStudentIds,
    todayMobileStudentIds,
    todayRegisteredStudentIds,
    studentsWithAccessToday,
    requesterUser: req?.user || null,
  });

  const teacherDocs = teacherAndStaffDocs.filter((t) => t.role === 'teacher');
  const activeTeachers = teacherDocs.filter((t) => String(t.status || '').toLowerCase() === 'active').length;
  const pendingTeachers = teacherDocs.filter((t) => String(t.status || '').toLowerCase() === 'pending').length;
  const totalTeachers = teacherDocs.length;

  const totalStudents = students.length;
  const funnel = [
    { key: 'reg', label: '1. Đăng ký tài khoản', count: totalStudents, pct: totalStudents ? 100 : 0, bar: 'bg-sky-500' },
    { key: 'use', label: '2. Dùng thử / Tham gia học', count: engagedCount, pct: totalStudents ? Math.round((engagedCount / totalStudents) * 100) : 0, bar: 'bg-amber-500' },
    { key: 'pay', label: '3. Hoàn tất học phí / Mua gói', count: paidCount, pct: totalStudents ? Math.round((paidCount / totalStudents) * 100) : 0, bar: 'bg-emerald-500' },
  ];

  const certificationStats = summarizeExamProgress(students);
  const atRisk = computeAtRiskStudentsServer(students, schedules, latestActivityByStudent, now);
  const automations = buildAutomationsForStudents(students, atRisk.items, now);

  return {
    total: totalStudents,
    paid: paidCount,
    unpaid: unpaidCount,
    unlocked: unlockedCount,
    totalRevenue: revenueAll.net || 0,
    pendingRevenue: pendingResult[0]?.total || 0,
    todayRevenue: todayRevenueRow.net || 0,
    activeTeachers,
    pendingTeachers,
    totalTeachers,
    realtime: {
      onlineTotal,
      activeToday,
    },
    funnel,
    certificationStats,
    atRisk: {
      total: atRisk.total,
      items: atRisk.items.slice(0, 6),
    },
    automations,
  };
}

module.exports = {
  getExamProgressDisplayStatus,
  summarizeExamProgress,
  isStudentPaidOrPurchased,
  isStudentEngaged,
  computeAtRiskStudentsServer,
  buildAutomationsForStudents,
  computeOnlineAndTodayUsers,
  computeAdminOverviewStats,
};
