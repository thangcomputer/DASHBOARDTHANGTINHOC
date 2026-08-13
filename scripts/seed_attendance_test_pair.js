/**
 * Xóa toàn bộ lịch THẮNG333 + LAN KHUÊ rồi seed lại sạch để test:
 *   - THẮNG333 → đã điểm danh (Hủy điểm danh)
 *   - LAN KHUÊ → quá hạn (Điểm danh bù)
 *
 *   node scripts/seed_attendance_test_pair.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');

function pad(n) {
  return String(n).padStart(2, '0');
}

function hm(mins) {
  const m = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function localDateOnly(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findStudent(name) {
  const s = await Student.findOne({ name: { $regex: escapeRe(name), $options: 'i' } });
  if (!s) throw new Error(`Không tìm thấy HV: ${name}`);
  return s;
}

async function wipeStudent(student, todayVi) {
  const del = await Schedule.deleteMany({ studentId: student._id });

  const scrubGrades = (grades) => (grades || []).filter((g) => g && g.date !== todayVi);

  student.grades = scrubGrades(student.grades);
  if (Array.isArray(student.enrollments)) {
    student.enrollments = student.enrollments.map((enr) => {
      const grades = scrubGrades(enr.grades);
      const completed = grades.filter((g) => !g.assignmentId).length; // rough; prefer keep existing if no date scrub needed
      const total = enr.totalSessions || student.totalSessions || 12;
      return {
        ...(enr.toObject ? enr.toObject() : enr),
        grades,
        completedSessions: grades.length,
        remainingSessions: Math.max(0, total - grades.length),
      };
    });
    student.markModified('enrollments');
  }

  const primary = (student.enrollments || []).find((e) => e.isPrimary) || (student.enrollments || [])[0];
  if (primary) {
    student.completedSessions = primary.completedSessions;
    student.remainingSessions = primary.remainingSessions;
    student.grades = primary.grades || student.grades;
  } else {
    student.completedSessions = student.grades.length;
    student.remainingSessions = Math.max(0, (student.totalSessions || 12) - student.grades.length);
  }

  student.can_check_in = true;
  student.set('last_attendance_at', undefined);
  student.markModified('grades');
  await student.save();
  console.log(`[wipe] ${student.name}: deleted ${del.deletedCount} schedules, gradesTodayCleared, completed=${student.completedSessions}`);
  return student;
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
  await mongoose.connect(uri);

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const today = localDateOnly(now);
  const yesterday = localDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const todayVi = now.toLocaleDateString('vi-VN');

  let thang = await findStudent('THẮNG333');
  let lan = await findStudent('LAN KHUÊ');
  thang = await wipeStudent(thang, todayVi);
  lan = await wipeStudent(lan, todayVi);

  const teacher = await Teacher.findById(thang.teacherId || lan.teacherId);
  if (!teacher) throw new Error('Không tìm thấy giáo viên phụ trách');

  // ── THẮNG333: completed + grade hôm nay → Hủy điểm danh ───────────────────
  const attStart = hm(Math.max(0, nowMins - 15));
  const attEnd = hm(Math.min(23 * 60 + 59, nowMins + 75));
  await Schedule.deleteMany({
    teacherId: teacher._id,
    date: { $gte: today, $lt: new Date(today.getTime() + 86400000) },
    startTime: attStart,
  });
  const attSch = await Schedule.create({
    teacherId: teacher._id,
    teacherName: teacher.name,
    studentId: thang._id,
    studentName: thang.name,
    date: today,
    startTime: attStart,
    endTime: attEnd,
    course: thang.course || 'khóa học test',
    status: 'completed',
    paymentStatus: 'paid',
    note: '[SIM] Đã điểm danh — thử Hủy điểm danh',
    topic: '[SIM] Đã điểm danh — thử Hủy điểm danh',
    branchId: thang.branchId || teacher.branchId || null,
    branchCode: thang.branchCode || teacher.branchCode || '',
  });
  const tGrades = [...(thang.grades || [])];
  tGrades.push({
    date: todayVi,
    grade: 8,
    note: `Buổi ${tGrades.length + 1}: [SIM] Đã điểm danh`,
  });
  thang.grades = tGrades;
  thang.completedSessions = tGrades.length;
  thang.remainingSessions = Math.max(0, (thang.totalSessions || 12) - tGrades.length);
  thang.can_check_in = false;
  thang.last_attendance_at = now;
  if (Array.isArray(thang.enrollments) && thang.enrollments.length) {
    const idx = thang.enrollments.findIndex((e) => e.isPrimary) >= 0
      ? thang.enrollments.findIndex((e) => e.isPrimary)
      : 0;
    const enr = thang.enrollments[idx];
    const eg = [...(enr.grades || []).filter((g) => g && g.date !== todayVi), tGrades[tGrades.length - 1]];
    enr.grades = eg;
    enr.completedSessions = eg.length;
    enr.remainingSessions = Math.max(0, (enr.totalSessions || 12) - eg.length);
    thang.completedSessions = enr.completedSessions;
    thang.remainingSessions = enr.remainingSessions;
    thang.markModified('enrollments');
  }
  thang.markModified('grades');
  await thang.save();

  // ── LAN KHUÊ: chỉ 1 ca scheduled quá hạn, KHÔNG có completed hôm nay ───────
  const overdueDate = nowMins < 150 ? yesterday : today;
  const overdueStart = nowMins < 150 ? '18:00' : hm(nowMins - 150);
  const overdueEnd = nowMins < 150 ? '19:30' : hm(nowMins - 90);
  await Schedule.deleteMany({
    teacherId: teacher._id,
    date: { $gte: overdueDate, $lt: new Date(overdueDate.getTime() + 86400000) },
    startTime: overdueStart,
  });
  const ovSch = await Schedule.create({
    teacherId: teacher._id,
    teacherName: teacher.name,
    studentId: lan._id,
    studentName: lan.name,
    date: overdueDate,
    startTime: overdueStart,
    endTime: overdueEnd,
    course: lan.course || 'khóa học test',
    status: 'scheduled',
    paymentStatus: 'pending',
    note: '[SIM] Quá hạn — thử Điểm danh bù',
    topic: '[SIM] Quá hạn — thử Điểm danh bù',
    branchId: lan.branchId || teacher.branchId || null,
    branchCode: lan.branchCode || teacher.branchCode || '',
  });

  const tSch = await Schedule.find({ studentId: thang._id }).lean();
  const lSch = await Schedule.find({ studentId: lan._id }).lean();
  const t2 = await Student.findById(thang._id).lean();
  const l2 = await Student.findById(lan._id).lean();

  console.log('[seed_pair] OK');
  console.log(JSON.stringify({
    now: `${now.toLocaleString('vi-VN')}`,
    todayVi,
    teacher: { id: String(teacher._id), name: teacher.name },
    thang333: {
      id: String(t2._id),
      completedSessions: t2.completedSessions,
      can_check_in: t2.can_check_in,
      gradesToday: (t2.grades || []).filter((g) => g.date === todayVi),
      schedules: tSch.map((s) => ({
        id: String(s._id),
        date: s.date,
        start: s.startTime,
        end: s.endTime,
        status: s.status,
      })),
      expect: 'Đã điểm danh + Hủy điểm danh',
      scheduleId: String(attSch._id),
    },
    lanKhue: {
      id: String(l2._id),
      completedSessions: l2.completedSessions,
      gradesToday: (l2.grades || []).filter((g) => g.date === todayVi),
      schedules: lSch.map((s) => ({
        id: String(s._id),
        date: s.date,
        start: s.startTime,
        end: s.endTime,
        status: s.status,
      })),
      expect: 'Điểm danh bù + Hủy ca',
      scheduleId: String(ovSch._id),
      overdueSlot: `${overdueDate.getFullYear()}-${pad(overdueDate.getMonth() + 1)}-${pad(overdueDate.getDate())} ${overdueStart}-${overdueEnd}`,
    },
    hint: 'Hard refresh (Ctrl+Shift+R) trang GV → Học viên. Nếu vẫn cũ: xóa localStorage key thvp_schedules rồi reload.',
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed_pair] FAIL:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
