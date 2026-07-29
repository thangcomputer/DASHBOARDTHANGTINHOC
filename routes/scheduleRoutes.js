const express  = require('express');
const router   = express.Router();
const Schedule = require('../models/Schedule');
const Student  = require('../models/Student');
const Teacher  = require('../models/Teacher');
const ScheduleHistory = require('../models/ScheduleHistory');
const { authMiddleware, branchFilter } = require('../middleware/auth');
const logger = require('../config/logger');
const { studentMatchesTeacher } = require('../services/enrollmentService');
const { assertStudentBranch, assertTeacherBranch, assertBranchMatch, getStudentBranchId } = require('../utils/branchScope');

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

  const existing = await Schedule.find(filter)
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

// ─── Helper: Kiểm tra và tự động Unlock Thi cho Học Viên ─────────────────────
// Workflow 2: Đếm buổi hoàn thành theo từng khóa → set enrollment.examUnlocked
async function checkAndUnlockExam(studentId, io, courseNameHint) {
  try {
    const student = await Student.findById(studentId);
    if (!student) return;

    if (!student.enrollments?.length && student.course) {
      const { legacyEnrollmentFromStudent } = require('../services/enrollmentService');
      student.enrollments = [legacyEnrollmentFromStudent(student)];
      student.enrollments[0].isPrimary = true;
    }

    const enrollments = student.enrollments || [];
    if (!enrollments.length) {
      if (student.studentExamUnlocked) return;
      const completedSessions = await Schedule.countDocuments({
        studentId,
        course: student.course,
        status: 'completed',
      });
      const totalRequired = student.totalSessions || 12;
      if (completedSessions >= totalRequired) {
        await Student.findByIdAndUpdate(studentId, { studentExamUnlocked: true });
        if (io) {
          const NotificationService = require('../services/NotificationService');
          NotificationService.send(io, {
            type: 'EXAM',
            title: '🎉 Phòng thi đã được mở khóa!',
            content: `Chúc mừng! Bạn đã hoàn thành ${completedSessions} buổi học. Phòng thi đã được mở khóa!`,
            receivers: student._id.toString(),
            link: '/student/exam'
          });
          io.emit('exam:unlocked', {
            studentId: student._id.toString(),
            studentName: student.name,
          });
          io.emit('data:refresh', { type: 'student', id: student._id });
        }
        logger.info(`✅ [SCHEDULE] Unlock thi cho HV: ${student.name} (${completedSessions}/${totalRequired} buổi)`);
      }
      return;
    }

    let changed = false;
    const hint = String(courseNameHint || '').trim().toLowerCase();
    for (let i = 0; i < enrollments.length; i++) {
      const enr = enrollments[i];
      if (enr.examUnlocked === true) continue;
      const courseName = enr.courseName || enr.course || '';
      if (hint && String(courseName).trim().toLowerCase() !== hint) continue;

      const completedSessions = await Schedule.countDocuments({
        studentId,
        course: courseName || student.course,
        status: 'completed',
      });
      const totalRequired = enr.totalSessions || student.totalSessions || 12;
      if (completedSessions >= totalRequired) {
        student.enrollments[i].examUnlocked = true;
        changed = true;
        logger.info(`✅ [SCHEDULE] Unlock thi khóa "${courseName}" cho HV: ${student.name} (${completedSessions}/${totalRequired} buổi)`);
      }
    }

    if (!changed) return;

    student.studentExamUnlocked = (student.enrollments || []).some((e) => e.examUnlocked === true);
    student.markModified('enrollments');
    await student.save({ validateModifiedOnly: true });

    if (io) {
      const NotificationService = require('../services/NotificationService');
      NotificationService.send(io, {
        type: 'EXAM',
        title: '🎉 Phòng thi đã được mở khóa!',
        content: 'Bạn đã hoàn thành đủ buổi học của khóa. Phòng thi khóa học đó đã được mở khóa!',
        receivers: student._id.toString(),
        link: '/student/exam'
      });
      io.emit('exam:unlocked', {
        studentId: student._id.toString(),
        studentName: student.name,
      });
      io.emit('data:refresh', { type: 'student', id: student._id });
    }
  } catch (err) {
    logger.error('[SCHEDULE] checkAndUnlockExam error:', err.message);
  }
}

// ─── GET /api/schedules ────────────────────────────────────────────────────────
// Admin/Staff: Lấy lịch học (STAFF chỉ thấy chi nhánh của mình)
router.get('/', [authMiddleware, branchFilter], async (req, res) => {
  try {
    const { status, date, teacherId, studentId, page, limit } = req.query;
    const filter = { ...req.branchFilter }; // {} for admin, {branchId:...} for staff
    const role = String(req.user.role || '').toLowerCase();

    // Scope theo role — chặn IDOR dump toàn bộ lịch
    if (role === 'teacher') {
      filter.teacherId = req.user.id;
    } else if (role === 'student') {
      filter.studentId = req.user.id;
    } else if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem lịch' });
    } else {
      if (teacherId) filter.teacherId = teacherId;
      if (studentId) filter.studentId = studentId;
    }

    if (status)    filter.status    = status;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: d, $lt: nextDay };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(2000, Math.max(1, parseInt(limit, 10) || 500));
    const skip = (pageNum - 1) * limitNum;

    const [schedules, total] = await Promise.all([
      Schedule.find(filter)
        .populate('teacherId', 'name phone')
        .populate('studentId', 'name course phone zalo')
        .sort({ date: 1, startTime: 1 })
        .skip(skip)
        .limit(limitNum),
      Schedule.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: schedules.length,
      total,
      page: pageNum,
      limit: limitNum,
      data: schedules,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/schedules/stats (branch-aware, secured) ────────────────────────
router.get('/stats', [authMiddleware, branchFilter], async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    let bf = { ...req.branchFilter };
    if (role === 'teacher') bf = { teacherId: req.user.id };
    else if (role === 'student') bf = { studentId: req.user.id };
    else if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [total, scheduled, completed, cancelled, thisMonth] = await Promise.all([
      Schedule.countDocuments(bf),
      Schedule.countDocuments({ ...bf, status: 'scheduled' }),
      Schedule.countDocuments({ ...bf, status: 'completed' }),
      Schedule.countDocuments({ ...bf, status: 'cancelled' }),
      Schedule.countDocuments({ ...bf, date: { $gte: startOfMonth, $lte: endOfMonth }, status: { $ne: 'cancelled' } }),
    ]);

    res.json({ success: true, data: { total, scheduled, completed, cancelled, thisMonth } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/schedules/teacher/:teacherId ─────────────────────────────────────
// Giảng viên xem lịch dạy của mình
router.get('/teacher/:teacherId', authMiddleware, branchFilter, async (req, res) => {
  try {
    const { status, month } = req.query;
    const filter = { teacherId: req.params.teacherId };
    
    // Authorization: Chỉ chính GV đó hoặc Admin/Staff mới được xem
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && String(req.user.id) !== String(req.params.teacherId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch của người khác' });
    }
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      const ok = await assertTeacherBranch(req, res, req.params.teacherId);
      if (!ok) return undefined;
    }

    if (status) filter.status = status;

    if (month) {
      // month = "YYYY-MM"
      const [year, m] = month.split('-').map(Number);
      filter.date = {
        $gte: new Date(year, m - 1, 1),
        $lt:  new Date(year, m,     1),
      };
    }

    const schedules = await Schedule.find(filter)
      .populate('studentId', 'name course zalo')
      .sort({ date: 1, startTime: 1 });

    res.json({ success: true, count: schedules.length, data: schedules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/schedules/student/:studentId ─────────────────────────────────────
// Học viên xem lịch học của mình
router.get('/student/:studentId', authMiddleware, branchFilter, async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    // Authorization: HV chỉ xem mình; Admin/Staff xem; Teacher chỉ HV được gán
    if (role === 'student' && String(req.user.id) !== String(req.params.studentId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch của học viên khác' });
    }
    if (role === 'teacher') {
      const ok = await teacherCanAccessStudent(req.user.id, req.params.studentId);
      if (!ok) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch học viên này' });
      }
    } else if (role !== 'student' && !isAdminOrStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    if (isAdminOrStaff(req.user)) {
      const ok = await assertStudentBranch(req, res, req.params.studentId);
      if (!ok) return undefined;
    }

    const schedules = await Schedule.find({ studentId: req.params.studentId })
      .populate('teacherId', 'name phone avatar specialty')
      .sort({ date: 1, startTime: 1 });

    // Thống kê buổi học
    const completed = schedules.filter(s => s.status === 'completed').length;
    const upcoming  = schedules.filter(s => s.status === 'scheduled').length;

    res.json({
      success: true,
      data: schedules,
      stats: { total: schedules.length, completed, upcoming },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/schedules ───────────────────────────────────────────────────────
// Giảng viên / Admin tạo lịch học mới
router.post('/', authMiddleware, branchFilter, async (req, res) => {
  try {
    // Authorization: Chỉ Admin, Staff, hoặc Teacher mới được tạo lịch
    if (!['admin', 'staff', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền tạo lịch học' });
    }
    let {
      teacherId, teacherName: teacherNameInput,
      studentId, studentName: studentNameInput,
      date, startTime, endTime,
      course, linkHoc, note, topic, status
    } = req.body;

    // Teacher chỉ được tạo lịch cho chính mình + HV được gán
    if (req.user.role === 'teacher') {
      teacherId = req.user.id;
      const ok = await teacherCanAccessStudent(req.user.id, studentId);
      if (!ok) {
        return res.status(403).json({ success: false, message: 'Bạn chỉ được tạo lịch cho học viên được phân công' });
      }
    }

    if (isAdminOrStaff(req.user) && studentId) {
      const ok = await assertStudentBranch(req, res, studentId);
      if (!ok) return undefined;
    }

    if (!teacherId || !studentId || !date || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: teacherId, studentId, date, startTime',
      });
    }

    // Validate ObjectId format
    const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id));
    if (!isValidObjectId(teacherId)) {
      return res.status(400).json({ success: false, message: `teacherId không hợp lệ: "${teacherId}"` });
    }
    if (!isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: `studentId không hợp lệ: "${studentId}". Vui lòng chọn học viên từ danh sách.` });
    }

    // Auto-lookup names nếu không được cung cấp
    let teacherName = teacherNameInput;
    let studentName = studentNameInput;
    let courseFinal = course;

    if (!teacherName || !studentName || !courseFinal) {
      const [teacher, student] = await Promise.all([
        !teacherName ? Teacher.findById(teacherId).select('name').lean() : null,
        (!studentName || !courseFinal) ? Student.findById(studentId).select('name course').lean() : null,
      ]);
      if (!teacherName) teacherName = teacher?.name || 'Giảng viên';
      if (!studentName) studentName = student?.name || 'Học viên';
      if (!courseFinal) courseFinal = student?.course || '';
    }

    if (!courseFinal) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin khóa học (course)' });
    }

    // Mỗi buổi cố định 1h30 — nếu thiếu/lệch endTime thì chuẩn hóa theo startTime
    const resolvedEndTime = endTimeFromStartOrDefault(startTime, endTime);

    const timeErr = assertEndAfterStart(startTime, resolvedEndTime);
    if (timeErr) {
      return res.status(400).json({ success: false, message: timeErr });
    }

    const studentClash = await findStudentScheduleClash({
      studentId, date, startTime, endTime: resolvedEndTime,
    });
    if (studentClash) {
      return res.status(409).json({ success: false, message: formatStudentClashMessage(studentClash) });
    }

    // ✅ ARCHITECTURAL UPGRADE: Anti-Clash Logic (Chống trùng lịch Giảng viên)
    const existingClash = await Schedule.findOne({
      teacherId,
      date: new Date(date),
      startTime,
      status: { $ne: 'cancelled' }
    });
    
    if (existingClash) {
      return res.status(409).json({ 
        success: false, 
        message: `TRÙNG LỊCH: Giảng viên đã có lịch dạy vào ${startTime} ngày ${new Date(date).toLocaleDateString('vi-VN')} (Học viên: ${existingClash.studentName}).` 
      });
    }

    // ✅ COOLDOWN 12H: Chống điểm danh trùng lặp giữa Admin và Giảng viên
    // Chỉ áp dụng khi tạo schedule với status = 'completed' (tức là đang điểm danh)
    const incomingStatus = status || 'scheduled';
    if (incomingStatus === 'completed') {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const lastAttendance = await Schedule.findOne({
        studentId,
        course: courseFinal,
        status: 'completed',
        createdAt: { $gte: twelveHoursAgo },
      }).sort({ createdAt: -1 });

      if (lastAttendance) {
        const diffMs = Date.now() - new Date(lastAttendance.createdAt).getTime();
        const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
        const remainHrs = (12 - parseFloat(diffHrs)).toFixed(1);
        return res.status(400).json({
          success: false,
          cooldown: true,
          message: `Học viên này đã được điểm danh. Vui lòng thử lại sau ${remainHrs} tiếng.`,
          lastAttendanceAt: lastAttendance.createdAt,
          remainingHours: parseFloat(remainHrs),
        });
      }
    }

    let finalPaidToTeacher = false;
    let paymentStatus = 'pending';
    const studentDoc = await Student.findById(studentId).lean();
    if (studentDoc && studentDoc.teacher_payment_status === 'PAID_IN_ADVANCE') {
       finalPaidToTeacher = true;
       paymentStatus = 'paid';
    }

    const schedule = await Schedule.create({
      teacherId, teacherName,
      studentId, studentName,
      date: new Date(date),
      startTime, endTime: resolvedEndTime,
      course: courseFinal, 
      linkHoc: linkHoc || '',
      note: note || topic || '',
      status: status || 'scheduled',
      is_paid_to_teacher: finalPaidToTeacher,
      paymentStatus: paymentStatus,
      branchId: studentDoc?.branchId || null,
      branchCode: studentDoc?.branchCode || '',
    });

    // Populate để trả về đầy đủ
    await schedule.populate([
      { path: 'teacherId', select: 'name phone' },
      { path: 'studentId', select: 'name course' },
    ]);

    // Thông báo real-time cho học viên
    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/NotificationService');
      if (studentId) {
         const notifDate = new Date(date).toLocaleDateString('vi-VN');
         NotificationService.send(io, {
           type: 'SCHEDULE',
           title: '📅 Lịch học mới',
           content: `Lịch học mới vào ngày ${notifDate} lúc ${startTime} đã được thêm.`,
           receivers: studentId.toString(),
           link: '/student#schedule'
         });
      }
      
      io.emit('schedule:new', {
        studentId: studentId.toString(),
        schedule,
      });
      io.emit('data:refresh', { type: 'schedule', action: 'create' });

      // 🔐 Nếu là điểm danh (status=completed), broadcast lock cho toàn hệ thống
      if (schedule.status === 'completed') {
        io.emit('attendance:locked', {
          studentId: studentId.toString(),
          course: courseFinal,
          lockedUntil: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          attendedAt: new Date().toISOString(),
          can_check_in: false,
        });
      }
    }

    res.status(201).json({ success: true, data: schedule });

    // 📝 GHI AUDIT LOG: CREATED
    ScheduleHistory.create({
      scheduleId: schedule._id,
      actorId: teacherId,
      actorName: teacherName,
      actorRole: req.user?.role || 'teacher',
      action: 'CREATED',
      reason: '',
      oldValue: null,
      newValue: { status: schedule.status, date: schedule.date, startTime, endTime: resolvedEndTime, studentId, course: courseFinal },
      studentName,
      teacherName,
      scheduledDate: schedule.date,
      course: courseFinal,
    }).catch(e => logger.error('[ScheduleHistory] CREATED log err:', e));

  } catch (err) {
    logger.error('[SCHEDULE] Create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/schedules/:scheduleId ───────────────────────────────────────────
// Cập nhật lịch học (hoàn thành, huỷ, điểm danh...)
router.put('/:scheduleId', authMiddleware, branchFilter, async (req, res) => {
  try {
    // Authorization:
    // - Admin/Staff/Teacher: sửa lịch đầy đủ
    // - Student: chỉ được gửi ghi chú (studentNote) cho lịch của chính mình
    const role = String(req.user.role || '').toLowerCase();
    const isStaffSide = ['admin', 'staff', 'teacher'].includes(role);
    const isStudent = role === 'student';

    if (!isStaffSide && !isStudent) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa lịch học' });
    }
    const { status, note, linkHoc, startTime, endTime, date, topic } = req.body;

    const schedule = await Schedule.findById(req.params.scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });
    }

    // Teacher chỉ sửa lịch của mình
    if (role === 'teacher' && String(schedule.teacherId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ được chỉnh sửa lịch của chính mình' });
    }

    if (isAdminOrStaff(req.user)) {
      const targetBranch = schedule.branchId || await getStudentBranchId(schedule.studentId);
      const ok = await assertBranchMatch(req, res, targetBranch);
      if (!ok) return undefined;
    }

    const effectiveStart = startTime || schedule.startTime;
    // Khi đổi giờ bắt đầu (hoặc gửi endTime), luôn khóa kết thúc = start + 1h30
    const effectiveEnd = (startTime || endTime !== undefined)
      ? endTimeFromStartOrDefault(effectiveStart, endTime)
      : (schedule.endTime || endTimeFromStartOrDefault(effectiveStart));
    const effectiveDate = date || schedule.date;
    const timeErr = assertEndAfterStart(effectiveStart, effectiveEnd);
    if (timeErr) {
      return res.status(400).json({ success: false, message: timeErr });
    }

    const timeFieldsChanging = Boolean(startTime || endTime !== undefined || date);
    if (timeFieldsChanging) {
      const studentClash = await findStudentScheduleClash({
        studentId: schedule.studentId,
        date: effectiveDate,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        excludeScheduleId: schedule._id,
      });
      if (studentClash) {
        return res.status(409).json({ success: false, message: formatStudentClashMessage(studentClash) });
      }
    }

    // Student restriction: chỉ cho phép cập nhật studentNote/hasUnreadStudentNote, đúng lịch của chính mình
    if (isStudent) {
      const myId = String(req.user.id || req.user._id);
      const scheduleStudentId = schedule.studentId ? String(schedule.studentId) : '';
      const onlyStudentNoteChange =
        Object.keys(req.body || {}).every((k) => ['studentNote', 'hasUnreadStudentNote'].includes(k));

      if (!scheduleStudentId || scheduleStudentId !== myId) {
        return res.status(403).json({ success: false, message: 'Bạn chỉ có thể gửi ghi chú cho lịch của chính mình' });
      }
      if (!('studentNote' in req.body) && !('hasUnreadStudentNote' in req.body)) {
        return res.status(400).json({ success: false, message: 'Thiếu studentNote' });
      }
      if (!onlyStudentNoteChange) {
        return res.status(403).json({ success: false, message: 'Bạn chỉ được phép cập nhật ghi chú học viên' });
      }
    }

    // Cập nhật các field được phép
    const updates = {};
    if (status)    updates.status    = status;
    // Đồng bộ attendanceStatus khi client vẫn gửi status cũ (completed/no_show)
    if (status === 'completed' && schedule.attendanceStatus == null) {
      updates.attendanceStatus = 'present';
      updates.attendanceMarkedAt = new Date();
      if (req.user?.id && String(req.user.id).match(/^[a-f\d]{24}$/i)) {
        updates.attendanceMarkedBy = req.user.id;
      }
    }
    if (status === 'no_show' && schedule.attendanceStatus == null) {
      updates.attendanceStatus = 'absent';
      updates.attendanceMarkedAt = new Date();
      if (req.user?.id && String(req.user.id).match(/^[a-f\d]{24}$/i)) {
        updates.attendanceMarkedBy = req.user.id;
      }
    }
    if (linkHoc)   updates.linkHoc   = linkHoc;
    if (startTime) {
      updates.startTime = startTime;
      updates.endTime = endTimeFromStartOrDefault(startTime);
    } else if (endTime !== undefined) {
      updates.endTime = endTimeFromStartOrDefault(schedule.startTime, endTime);
    }
    if (date)      updates.date      = new Date(date);
    const noteVal = note !== undefined ? note : topic;
    if (noteVal !== undefined) updates.note = String(noteVal).trim();
    if ('studentNote' in req.body) {
      updates.studentNote = req.body.studentNote;
      updates.hasUnreadStudentNote = true; // Bật cờ có tin nhắn mới cho Giảng viên
    }
    if ('hasUnreadStudentNote' in req.body) {
      // Giảng viên click vào xem thì tắt cờ đi
      updates.hasUnreadStudentNote = req.body.hasUnreadStudentNote;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin để cập nhật' });
    }

    const io = req.app.get('io');
    if (schedule.studentId && io) {
      const NotificationService = require('../services/NotificationService');
      const notifDate = new Date(schedule.date).toLocaleDateString();
      
      if (status === 'cancelled' && schedule.status !== 'cancelled') {
         // Persist cancel reason into `note` so student UI can render it
         const cancelReason = String(req.body?.cancelReason || req.body?.reason || req.body?.note || '').trim();
         if (cancelReason) updates.note = cancelReason;

         NotificationService.send(io, {
           type: 'SCHEDULE',
           title: '❌ Lịch học bị hủy',
           content: cancelReason
             ? `Lịch học ngày ${notifDate} đã bị hủy. Lý do: ${cancelReason}`
             : `Lịch học ngày ${notifDate} đã bị hủy.`,
           receivers: schedule.studentId.toString(),
           payload: { scheduleId: schedule._id.toString(), reason: cancelReason },
           link: '/student#schedule'
         });

         // Emit cancelled event so clients refetch / update UI immediately
         io.emit('schedule:cancelled', { scheduleId: schedule._id.toString(), reason: cancelReason });
      }
      else if (status === 'completed' && schedule.status !== 'completed') {
         NotificationService.send(io, {
           type: 'SCHEDULE',
           title: '✅ Hệ thống đã điểm danh',
           content: `Giảng viên đã điểm danh buổi học ngày ${notifDate}.`,
           receivers: schedule.studentId.toString(),
           link: '/student#schedule'
         });
         try {
           const { writeAudit } = require('../services/auditLogService');
           await writeAudit({
             action: 'attendance.mark',
             actorUserId: req.user.id,
             actorRole: req.user.role,
             branchId: req.userBranchId || schedule.branchId || null,
             entityType: 'schedule',
             entityId: String(schedule._id),
             studentId: schedule.studentId,
             teacherId: schedule.teacherId,
             sessionId: schedule._id,
             oldValue: { status: schedule.status, attendanceStatus: schedule.attendanceStatus || null },
             newValue: { status: 'completed', attendanceStatus: 'present' },
             ip: req.ip || '',
             userAgent: req.headers['user-agent'] || '',
           });
         } catch { /* ignore */ }
      }
      else if ((startTime && startTime !== schedule.startTime) || (date && new Date(date).getTime() !== schedule.date.getTime())) {
         NotificationService.send(io, {
           type: 'SCHEDULE',
           title: '🔄 Lịch học đã thay đổi',
           content: `Lịch học đã cập nhật thành: ${startTime || schedule.startTime} ngày ${date ? new Date(date).toLocaleDateString() : notifDate}.`,
           receivers: schedule.studentId.toString(),
           link: '/student#schedule'
         });
      }
    }

    const updated = await Schedule.findByIdAndUpdate(
      req.params.scheduleId,
      updates,
      { returnDocument: 'after', runValidators: true }
    ).populate([
      { path: 'teacherId', select: 'name phone' },
      { path: 'studentId', select: 'name course totalSessions studentExamUnlocked' },
    ]);

    // BUSINESS LOGIC: Nếu đánh dấu hoàn thành → kiểm tra unlock thi
    if (status === 'completed' && schedule.studentId) {
      await checkAndUnlockExam(schedule.studentId.toString(), io, schedule.course);

      // Cập nhật remainingSessions của học viên (Tách biệt logic trừ buổi và cộng buổi)
      const student = await Student.findById(schedule.studentId);
      if (student) {
        // Automatically mark as paid if Admin paid in advance
        if (student.teacher_payment_status === 'PAID_IN_ADVANCE') {
           await Schedule.findByIdAndUpdate(schedule._id, { 
             is_paid_to_teacher: true,
             paymentStatus: 'paid'
           });
        }
      }
    }

    // BUSINESS LOGIC: Gửi thông báo chuông cho Giảng viên nếu Học viên gửi Ghi chú (studentNote)
    if ('studentNote' in req.body && schedule.teacherId && io) {
      try {
         const NotificationService = require('../services/NotificationService');
         await NotificationService.send(io, {
           type: 'SYSTEM',
           title: '📝 Ghi chú mới từ học viên',
           content: `Học viên ${schedule.studentName} vừa để lại ghi chú trên lịch học ngày ${new Date(schedule.date).toLocaleDateString('vi-VN')}.`,
           receivers: [schedule.teacherId.toString()],
           payload: { scheduleId: schedule._id, studentId: schedule.studentId, type: 'schedule' }
         });
         
         // Báo chuông
         io.to(schedule.teacherId.toString()).emit('RECEIVE_NOTIFICATION', {
           _id: Date.now(),
           type: 'schedule',
           title: '📝 Ghi chú mới từ học viên',
           message: `Học viên ${schedule.studentName} vừa để lại ghi chú trên lịch học`,
           time: new Date(),
           userId: schedule.teacherId.toString()
         });

         // Báo cập nhật calendar
         io.emit('schedule:updated', schedule._id);
      } catch (e) {
         logger.error('[SCHEDULE] Notify error:', e);
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[SCHEDULE] Update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/schedules/:scheduleId/attendance — Phase 8 điểm danh chuẩn ─────
router.post('/:scheduleId/attendance', authMiddleware, branchFilter, async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    if (!['admin', 'staff', 'teacher'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền điểm danh' });
    }

    const schedule = await Schedule.findById(req.params.scheduleId).lean();
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });
    }

    if (role === 'teacher' && String(schedule.teacherId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ được điểm danh lịch của mình' });
    }
    if (isAdminOrStaff(req.user)) {
      const targetBranch = schedule.branchId || await getStudentBranchId(schedule.studentId);
      const ok = await assertBranchMatch(req, res, targetBranch);
      if (!ok) return undefined;
    }

    const { attendanceStatus, note } = req.body || {};
    if (!attendanceStatus) {
      return res.status(400).json({ success: false, message: 'Thiếu attendanceStatus (present|absent|late|excused)' });
    }

    const { markAttendance } = require('../services/attendanceService');
    const result = await markAttendance({
      scheduleId: req.params.scheduleId,
      attendanceStatus,
      note,
      actor: { id: req.user.id, role: req.user.role },
      io: req.app.get('io') || global.io,
      reqMeta: {
        ip: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        branchId: req.userBranchId || null,
      },
      checkAndUnlockExam,
    });

    const populated = await Schedule.findById(result.schedule._id)
      .populate([
        { path: 'teacherId', select: 'name phone' },
        { path: 'studentId', select: 'name course' },
      ]);

    return res.json({
      success: true,
      message: result.isCorrection ? 'Đã sửa điểm danh' : 'Đã điểm danh',
      data: populated,
      meta: {
        previous: result.previous,
        payable: result.payable,
        isCorrection: result.isCorrection,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) {
      return res.status(status).json({ success: false, message: err.message });
    }
    logger.error('[SCHEDULE] Attendance error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/schedules/:scheduleId ────────────────────────────────────────
router.delete('/:scheduleId', authMiddleware, branchFilter, async (req, res) => {
  try {
    // Authorization: Chỉ Admin/Staff mới được xóa vĩnh viễn lịch
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa lịch học' });
    }
    const schedule = await Schedule.findById(req.params.scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });
    }
    const targetBranch = schedule.branchId || await getStudentBranchId(schedule.studentId);
    const ok = await assertBranchMatch(req, res, targetBranch);
    if (!ok) return undefined;

    await Schedule.findByIdAndDelete(req.params.scheduleId);
    res.json({ success: true, message: 'Đã xóa lịch học' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/schedules/:scheduleId/cancel ─────────────────────────────────
router.patch('/:scheduleId/cancel', authMiddleware, branchFilter, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const schedule = await Schedule.findById(req.params.scheduleId);
    if (!schedule) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });

    // Authorization: Chỉ Admin/Staff/Teacher được hủy lịch
    if (!['admin', 'staff', 'teacher'].includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy lịch học' });
    }
    if (String(req.user.role).toLowerCase() === 'teacher'
        && String(schedule.teacherId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ được hủy lịch của chính mình' });
    }
    if (isAdminOrStaff(req.user)) {
      const targetBranch = schedule.branchId || await getStudentBranchId(schedule.studentId);
      const ok = await assertBranchMatch(req, res, targetBranch);
      if (!ok) return undefined;
    }

    if (schedule.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lịch này đã bị hủy rồi' });
    }
    if (schedule.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Không thể hủy lịch đã hoàn thành' });
    }
    // Ngăn hủy lịch trong quá khứ (chỉ cho hủy lịch tương lai)
    const schedDate = new Date(schedule.date);
    schedDate.setHours(23, 59, 59, 999);
    if (schedDate < new Date()) {
      return res.status(400).json({ success: false, message: 'Không thể hủy lịch trong quá khứ' });
    }

    const oldValue = { status: schedule.status, note: schedule.note || '' };
    schedule.status = 'cancelled';
    // Persist reason so Student UI can show it (frontend currently renders `sch.note`)
    if (typeof reason === 'string' && reason.trim()) {
      schedule.note = reason.trim();
    }
    await schedule.save();

    const actor = req.user || {};
    await ScheduleHistory.create({
      scheduleId: schedule._id,
      actorId: actor.id || actor._id || schedule.teacherId,
      actorName: actor.name || schedule.teacherName || 'Unknown',
      actorRole: actor.role || 'teacher',
      action: 'CANCELLED',
      reason,
      oldValue: { ...oldValue, startTime: schedule.startTime, endTime: schedule.endTime },
      newValue: { status: 'cancelled', startTime: schedule.startTime, endTime: schedule.endTime },
      studentName: schedule.studentName,
      teacherName: schedule.teacherName,
      scheduledDate: schedule.date,
      course: schedule.course,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('schedule:cancelled', { scheduleId: schedule._id.toString(), reason });

      // Notify student with reason (if any)
      if (schedule.studentId) {
        try {
          const NotificationService = require('../services/NotificationService');
          const d = new Date(schedule.date).toLocaleDateString('vi-VN');
          await NotificationService.send(io, {
            type: 'SCHEDULE',
            title: '❌ Lịch học bị hủy',
            content: reason && String(reason).trim()
              ? `Lịch học ngày ${d} đã bị hủy. Lý do: ${String(reason).trim()}`
              : `Lịch học ngày ${d} đã bị hủy.`,
            receivers: schedule.studentId.toString(),
            payload: { scheduleId: schedule._id.toString(), type: 'schedule', reason: String(reason || '') },
            link: '/student#schedule'
          });
        } catch (e) {
          logger.error('[SCHEDULE] Cancel notify student error:', e);
        }
      }
    }

    res.json({ success: true, data: schedule });
  } catch (err) {
    logger.error('[SCHEDULE] Cancel error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/schedules/history/:teacherId ───────────────────────────────
// Trả về lịch sử sắp lịch của 1 giảng viên (cho Admin xem)
router.get('/history/:teacherId', authMiddleware, async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!isAdminOrStaff(req.user) && String(req.user.id) !== String(teacherId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem lịch sử lịch dạy này' });
    }
    const { limit = 50, action } = req.query;
    const filter = { actorId: teacherId };
    if (action) filter.action = action;

    const history = await ScheduleHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    // Thống kê nhanh
    const stats = {
      total: history.length,
      created: history.filter(h => h.action === 'CREATED').length,
      cancelled: history.filter(h => h.action === 'CANCELLED').length,
      cancelRate: history.length > 0
        ? Math.round((history.filter(h => h.action === 'CANCELLED').length / history.length) * 100)
        : 0,
    };

    res.json({ success: true, data: history, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
