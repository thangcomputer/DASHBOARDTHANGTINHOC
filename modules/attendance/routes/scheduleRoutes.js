const express  = require('express');
const router   = express.Router();
const { scheduleRepository } = require('../repositories');
const Schedule = require('../models/Schedule'); // Temp for new Schedule
const Student  = require('../../student/models/Student');
const Teacher  = require('../../teacher/models/Teacher');
const { scheduleHistoryRepository } = require('../repositories');
const ScheduleHistory = require('../models/ScheduleHistory'); // Temp for new ScheduleHistory
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const logger = require('../../../config/logger');
const { studentMatchesTeacher } = require('../../enrollment/services/enrollmentService');

function isAdminOrStaff(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'staff';
}

async function teacherCanAccessStudent(teacherId, studentId) {
  const student = await Student.findById(studentId)
    .select('teacherId enrollments')
    .lean();
  if (!student) return false;
  if (studentMatchesTeacher(student, teacherId)) return true;
  const teacher = await Teacher.findById(teacherId).select('assignedStudents').lean();
  const assigned = (teacher?.assignedStudents || []).map((id) => String(id));
  return assigned.includes(String(studentId));
}

function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

const SESSION_DURATION_MINS = 90;

function addMinutesToTimeHHmm(time, addMins) {
  const mins = parseTimeToMinutes(time);
  if (mins == null) return '';
  const total = Math.min(mins + addMins, 23 * 60 + 59);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Buổi học cố định 1h30 — luôn suy ra end từ start */
function endTimeFromStartOrDefault(startTime, endTime) {
  const fromStart = addMinutesToTimeHHmm(startTime, SESSION_DURATION_MINS);
  if (!fromStart) return String(endTime || '').trim();
  return fromStart;
}

function timeRangesOverlap(start1, end1, start2, end2) {
  const s1 = parseTimeToMinutes(start1);
  const s2 = parseTimeToMinutes(start2);
  if (s1 == null || s2 == null) return false;
  const e1 = parseTimeToMinutes(end1) ?? (s1 + SESSION_DURATION_MINS);
  const e2 = parseTimeToMinutes(end2) ?? (s2 + SESSION_DURATION_MINS);
  return s1 < e2 && s2 < e1;
}

function dayRange(dateInput) {
  const d = new Date(dateInput);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function findStudentScheduleClash({ studentId, date, startTime, endTime, excludeScheduleId }) {
  const { start, end } = dayRange(date);
  const filter = {
    studentId,
    date: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' },
  };
  if (excludeScheduleId) filter._id = { $ne: excludeScheduleId };

  const existing = await scheduleRepository.findMany(filter)
    .select('startTime endTime studentName course teacherName')
    .lean();

  return existing.find((ex) => timeRangesOverlap(startTime, endTime, ex.startTime, ex.endTime)) || null;
}

function formatStudentClashMessage(clash) {
  const course = clash.course ? ` (${clash.course})` : '';
  const end = clash.endTime ? ` - ${clash.endTime}` : '';
  return `TRÙNG LỊCH: Học viên đã có buổi học${course} từ ${clash.startTime}${end} trong ngày này.`;
}

function assertEndAfterStart(startTime, endTime) {
  const end = String(endTime || '').trim();
  if (!end) return null;
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(end);
  if (s == null || e == null) return 'Giờ bắt đầu hoặc kết thúc không hợp lệ';
  if (e <= s) return 'Giờ kết thúc phải lớn hơn giờ bắt đầu';
  return null;
}

/** Thông báo điểm danh: HV + Admin (GV nào · HV nào · buổi thứ mấy). */
async function notifyAttendanceTaken(io, {
  studentId, studentName, teacherName, course, date,
}) {
  if (!io || !studentId) return;
  const NotificationService = require('../../notification/services/NotificationService');
  const courseName = String(course || '').trim();
  const match = {
    studentId,
    status: 'completed',
    ...(courseName ? { course: courseName } : {}),
  };
  const completedSessions = await scheduleRepository.count(match);
  const student = await Student.findById(studentId)
    .select('name course totalSessions enrollments')
    .lean();
  const name = studentName || student?.name || 'Học viên';
  let totalRequired = student?.totalSessions || 12;
  if (courseName && Array.isArray(student?.enrollments)) {
    const enr = student.enrollments.find(
      (e) => String(e.courseName || e.course || '').trim().toLowerCase() === courseName.toLowerCase(),
    );
    if (enr?.totalSessions) totalRequired = enr.totalSessions;
  }
  const notifDate = date
    ? new Date(date).toLocaleDateString('vi-VN')
    : new Date().toLocaleDateString('vi-VN');
  const gv = teacherName || 'Giảng viên';
  const courseLabel = courseName || student?.course || 'khóa học';
  const progress = `${completedSessions}/${totalRequired}`;

  await NotificationService.send(io, {
    type: 'SCHEDULE',
    title: '✅ Đã điểm danh buổi học',
    content: `${gv} đã điểm danh bạn ngày ${notifDate} (${courseLabel} · buổi ${progress}).`,
    receivers: String(studentId),
    payload: { studentId: String(studentId), course: courseLabel, completedSessions, totalRequired },
    link: '/student#schedule',
  });

  await NotificationService.notifyAdmins(
    io,
    '📋 Điểm danh buổi học',
    `GV ${gv} điểm danh HV ${name} — ${courseLabel}: buổi ${progress}.`,
    {
      studentId: String(studentId),
      teacherName: gv,
      course: courseLabel,
      completedSessions,
      totalRequired,
    },
    '/admin/students',
  );

  return { completedSessions, totalRequired, courseLabel, name };
}

/** Thông báo HV hoàn thành khóa (HV + Admin). */
async function notifyCourseCompleted(io, {
  studentId, studentName, courseName, completedSessions, totalRequired,
}) {
  if (!io || !studentId) return;
  const NotificationService = require('../../notification/services/NotificationService');
  const name = studentName || 'Học viên';
  const course = courseName || 'khóa học';
  const progress = `${completedSessions}/${totalRequired}`;

  await NotificationService.send(io, {
    type: 'COURSE',
    title: '🎓 Hoàn thành khóa học',
    content: `Chúc mừng! Bạn đã hoàn thành khóa ${course} (${progress} buổi).`,
    receivers: String(studentId),
    payload: { studentId: String(studentId), course, completedSessions, totalRequired },
    link: '/student',
  });

  await NotificationService.notifyAdmins(
    io,
    '🎓 Học viên hoàn thành khóa',
    `HV ${name} đã hoàn thành khóa ${course} (${progress} buổi).`,
    { studentId: String(studentId), course, completedSessions, totalRequired },
    '/admin/students',
  );
}

// ─── Helper: Kiểm tra và tự động Unlock Thi cho Học Viên ─────────────────────
// Workflow 2: Đếm buổi hoàn thành theo từng khóa → set enrollment.examUnlocked
async function checkAndUnlockExam(studentId, io, courseNameHint) {
  try {
    const student = await Student.findById(studentId);
    if (!student) return;

    if (!student.enrollments?.length && student.course) {
      const { legacyEnrollmentFromStudent } = require('../../enrollment/services/enrollmentService');
      student.enrollments = [legacyEnrollmentFromStudent(student)];
      student.enrollments[0].isPrimary = true;
    }

    const enrollments = student.enrollments || [];
    if (!enrollments.length) {
      const completedSessions = await scheduleRepository.count({
        studentId,
        course: student.course,
        status: 'completed',
      });
      const totalRequired = student.totalSessions || 12;
      if (completedSessions < totalRequired) return;

      const justUnlocked = !student.studentExamUnlocked;
      const justCompleted = String(student.status || '') !== 'Hoàn thành';
      if (!justUnlocked && !justCompleted) return;

      const statusPatch = {};
      if (justUnlocked) statusPatch.studentExamUnlocked = true;
      if (justCompleted) statusPatch.status = 'Hoàn thành';
      if (Object.keys(statusPatch).length) {
        await Student.findByIdAndUpdate(studentId, statusPatch);
      }

      if (io) {
        const NotificationService = require('../../notification/services/NotificationService');
        if (justUnlocked) {
          NotificationService.send(io, {
            type: 'EXAM',
            title: '🎉 Phòng thi đã được mở khóa!',
            content: `Chúc mừng! Bạn đã hoàn thành ${completedSessions} buổi học. Phòng thi đã được mở khóa!`,
            receivers: student._id.toString(),
            link: '/student/exam',
          });
          io.emit('exam:unlocked', {
            studentId: student._id.toString(),
            studentName: student.name,
          });
        }
        if (justCompleted) {
          await notifyCourseCompleted(io, {
            studentId: student._id,
            studentName: student.name,
            courseName: student.course,
            completedSessions,
            totalRequired,
          });
        }
        io.emit('data:refresh', { type: 'student', id: student._id });
      }
      logger.info(`✅ [SCHEDULE] Unlock thi cho HV: ${student.name} (${completedSessions}/${totalRequired} buổi)`);
      return;
    }

    let changed = false;
    let justUnlockedAny = false;
    const completedCourses = [];
    const hint = String(courseNameHint || '').trim().toLowerCase();
    for (let i = 0; i < enrollments.length; i++) {
      const enr = enrollments[i];
      const courseName = enr.courseName || enr.course || '';
      if (hint && String(courseName).trim().toLowerCase() !== hint) continue;

      const completedSessions = await scheduleRepository.count({
        studentId,
        course: courseName || student.course,
        status: 'completed',
      });
      const totalRequired = enr.totalSessions || student.totalSessions || 12;
      if (completedSessions < totalRequired) continue;

      const wasUnlocked = enr.examUnlocked === true;
      const wasCompleted = String(enr.status || '').toLowerCase() === 'completed'
        || String(enr.status || '') === 'Hoàn thành';
      if (!wasUnlocked) {
        student.enrollments[i].examUnlocked = true;
        changed = true;
        justUnlockedAny = true;
      }
      if (!wasCompleted) {
        student.enrollments[i].status = 'completed';
        changed = true;
        completedCourses.push({ courseName, completedSessions, totalRequired });
      }
      logger.info(`✅ [SCHEDULE] Unlock thi khóa "${courseName}" cho HV: ${student.name} (${completedSessions}/${totalRequired} buổi)`);
    }

    if (!changed) return;

    student.studentExamUnlocked = (student.enrollments || []).some((e) => e.examUnlocked === true);
    if ((student.enrollments || []).every((e) => {
      const st = String(e.status || '').toLowerCase();
      return st === 'completed' || e.status === 'Hoàn thành';
    })) {
      student.status = 'Hoàn thành';
    }
    student.markModified('enrollments');
    await student.save({ validateModifiedOnly: true });

    if (io) {
      const NotificationService = require('../../notification/services/NotificationService');
      if (justUnlockedAny) {
        NotificationService.send(io, {
          type: 'EXAM',
          title: '🎉 Phòng thi đã được mở khóa!',
          content: 'Bạn đã hoàn thành đủ buổi học của khóa. Phòng thi khóa học đó đã được mở khóa!',
          receivers: student._id.toString(),
          link: '/student/exam',
        });
        io.emit('exam:unlocked', {
          studentId: student._id.toString(),
          studentName: student.name,
        });
      }
      for (const c of completedCourses) {
        await notifyCourseCompleted(io, {
          studentId: student._id,
          studentName: student.name,
          courseName: c.courseName || student.course,
          completedSessions: c.completedSessions,
          totalRequired: c.totalRequired,
        });
      }
      io.emit('data:refresh', { type: 'student', id: student._id });
    }
  } catch (err) {
    logger.error('[SCHEDULE] checkAndUnlockExam error:', err.message);
  }
}

// ─── GET /api/schedules ────────────────────────────────────────────────────────
// Admin/Staff: Lấy lịch học (STAFF chỉ thấy chi nhánh của mình)
router.get('/', [authMiddleware, branchFilter],attendanceController.get_root);

// ─── GET /api/schedules/stats (branch-aware, secured) ────────────────────────
router.get('/stats', [authMiddleware, branchFilter],attendanceController.get_stats);

// ─── GET /api/schedules/teacher/:teacherId ─────────────────────────────────────
// Giảng viên xem lịch dạy của mình
router.get('/teacher/:teacherId', authMiddleware,attendanceController.get_teacher_teacherId);

// ─── GET /api/schedules/student/:studentId ─────────────────────────────────────
// Học viên xem lịch học của mình
router.get('/student/:studentId', authMiddleware,attendanceController.get_student_studentId);

// ─── POST /api/schedules ───────────────────────────────────────────────────────
// Giảng viên / Admin tạo lịch học mới
router.post('/', authMiddleware,attendanceController.post_root);

// ─── PUT /api/schedules/:scheduleId ───────────────────────────────────────────
// Cập nhật lịch học (hoàn thành, huỷ, điểm danh...)
router.put('/:scheduleId', authMiddleware,attendanceController.put_scheduleId);

// ─── DELETE /api/schedules/:scheduleId ────────────────────────────────────────
router.delete('/:scheduleId', authMiddleware,attendanceController.delete_scheduleId);

// ─── PATCH /api/schedules/:scheduleId/cancel ─────────────────────────────────
router.patch('/:scheduleId/cancel', authMiddleware,attendanceController.patch_scheduleId_cancel);

// ─── GET /api/schedules/history/:teacherId ───────────────────────────────
// Trả về lịch sử sắp lịch của 1 giảng viên (cho Admin xem)
router.get('/history/:teacherId', authMiddleware,attendanceController.get_history_teacherId);

module.exports = router;
