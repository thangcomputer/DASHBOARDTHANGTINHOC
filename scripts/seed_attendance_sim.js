/**
 * Tạo lịch mô phỏng để thử điểm danh / điểm danh bù / hủy điểm danh (local DB).
 *
 * Usage:
 *   node scripts/seed_attendance_sim.js
 *   node scripts/seed_attendance_sim.js --student "THẮNG333" --mode attended
 *   node scripts/seed_attendance_sim.js --student "LAN KHUÊ" --mode overdue
 *   node scripts/seed_attendance_sim.js --mode overdue|ready|grace|attended|all
 *
 * Modes:
 *   overdue  — kết thúc > 60 phút trước → nút "Điểm danh bù"
 *   grace    — vừa kết thúc, còn trong 60 phút grace → điểm danh bổ sung
 *   ready    — đang trong giờ học → nút "Điểm danh"
 *   attended — đã điểm danh hôm nay (giờ hiện tại) → nút "Hủy điểm danh"
 *   all      — tạo overdue+grace+ready (không gồm attended)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');

function argVal(flag, fallback = '') {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

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

function todayViLabel(d = new Date()) {
  return d.toLocaleDateString('vi-VN');
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
  const studentQuery = argVal('--student', 'THẮNG333');
  const mode = String(argVal('--mode', 'overdue') || 'overdue').toLowerCase();

  await mongoose.connect(uri);
  console.log('[sim] connected');

  let student = await Student.findOne({
    name: { $regex: studentQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  });

  if (!student) {
    student = await Student.findOne({ status: { $in: ['Đang học', 'active'] } })
      .sort({ updatedAt: -1 });
  }
  if (!student) {
    throw new Error('Không tìm thấy học viên. Truyền --student "Tên HV"');
  }

  const teacherId = student.teacherId
    || student.enrollments?.find((e) => e.teacherId)?.teacherId
    || null;
  if (!teacherId) {
    throw new Error(`HV ${student.name} chưa có teacherId — gán GV trước`);
  }

  const teacher = await Teacher.findById(teacherId).lean();
  if (!teacher) throw new Error(`Không tìm thấy GV ${teacherId}`);

  const course = student.course
    || student.enrollments?.find((e) => e.status === 'active')?.courseName
    || 'khóa học test';

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const today = localDateOnly(now);
  const yesterday = localDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const dayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // Đêm/sáng sớm: không thể tạo overdue "hôm nay" → dùng hôm qua
  const overdueNeedsYesterday = nowMins < 150;
  const overdueDate = overdueNeedsYesterday ? yesterday : today;
  const overdueStart = overdueNeedsYesterday ? '18:00' : hm(nowMins - 150);
  const overdueEnd = overdueNeedsYesterday ? '19:30' : hm(nowMins - 90);

  const presets = {
    overdue: {
      date: overdueDate,
      startTime: overdueStart,
      endTime: overdueEnd,
      status: 'scheduled',
      note: '[SIM] Quá hạn — thử nút Điểm danh bù',
      markAttended: false,
    },
    grace: {
      date: today,
      startTime: hm(Math.max(0, nowMins - 80)),
      endTime: hm(Math.max(30, nowMins - 20)),
      status: 'scheduled',
      note: '[SIM] Trong cửa sổ grace 60 phút',
      markAttended: false,
    },
    ready: {
      date: today,
      startTime: hm(Math.max(0, nowMins - 10)),
      endTime: hm(Math.min(23 * 60 + 59, nowMins + 80)),
      status: 'scheduled',
      note: '[SIM] Đang trong giờ học — thử Điểm danh',
      markAttended: false,
    },
    attended: {
      date: today,
      startTime: hm(Math.max(0, nowMins - 20)),
      endTime: hm(Math.min(23 * 60 + 59, nowMins + 70)),
      status: 'completed',
      note: '[SIM] Đã điểm danh — thử Hủy điểm danh',
      markAttended: true,
    },
  };

  const modes = mode === 'all' ? ['overdue', 'grace', 'ready'] : [mode];
  if (!presets[modes[0]] && mode !== 'all') {
    throw new Error(`Mode không hợp lệ: ${mode}. Dùng overdue|grace|ready|attended|all`);
  }

  // Tránh MAX 1 ca/HV/ngày + unique teacher+date+startTime
  if (modes.some((m) => ['attended', 'ready', 'grace'].includes(m))) {
    await Schedule.deleteMany({
      studentId: student._id,
      date: { $gte: today, $lt: dayEnd },
      status: { $in: ['scheduled', 'completed'] },
    });
  }

  const created = [];
  for (const m of modes) {
    const p = presets[m];
    const dayStart = p.date;
    const rangeEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // Xóa SIM cũ cùng ngày của HV + mọi lịch trùng slot GV (unique index)
    await Schedule.deleteMany({
      studentId: student._id,
      date: { $gte: dayStart, $lt: rangeEnd },
      note: { $regex: '^\\[SIM\\]' },
    });
    await Schedule.deleteMany({
      teacherId: teacher._id,
      date: { $gte: dayStart, $lt: rangeEnd },
      startTime: p.startTime,
    });

    const doc = await Schedule.create({
      teacherId: teacher._id,
      teacherName: teacher.name || 'Giảng viên',
      studentId: student._id,
      studentName: student.name,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      course,
      status: p.status,
      paymentStatus: p.markAttended ? 'paid' : 'pending',
      note: p.note,
      topic: p.note,
      branchId: student.branchId || teacher.branchId || null,
      branchCode: student.branchCode || teacher.branchCode || '',
    });

    if (p.markAttended) {
      const todayLabel = todayViLabel(now);
      const grades = Array.isArray(student.grades) ? [...student.grades] : [];
      const withoutToday = grades.filter((g) => g && g.date !== todayLabel);
      withoutToday.push({
        date: todayLabel,
        grade: 8,
        note: `Buổi ${(student.completedSessions || 0) + 1}: [SIM] Đã điểm danh hoàn thành buổi học`,
      });
      const newCompleted = withoutToday.length;
      const total = student.totalSessions || 12;
      student.grades = withoutToday;
      student.completedSessions = newCompleted;
      student.remainingSessions = Math.max(0, total - newCompleted);
      student.last_attendance_at = now;
      student.can_check_in = false;
      student.markModified('grades');
      await student.save();
    } else if (m === 'overdue') {
      // Đảm bảo chưa điểm danh hôm nay để hiện Điểm danh bù
      const todayLabel = todayViLabel(now);
      const grades = Array.isArray(student.grades) ? student.grades.filter((g) => g && g.date !== todayLabel) : [];
      if (grades.length !== (student.grades || []).length) {
        student.grades = grades;
        student.completedSessions = grades.length;
        student.remainingSessions = Math.max(0, (student.totalSessions || 12) - grades.length);
        student.can_check_in = true;
        student.markModified('grades');
        await student.save();
      }
    }

    created.push({
      mode: m,
      id: String(doc._id),
      status: p.status,
      date: `${p.date.getFullYear()}-${pad(p.date.getMonth() + 1)}-${pad(p.date.getDate())}`,
      startTime: p.startTime,
      endTime: p.endTime,
      note: p.note,
      attended: Boolean(p.markAttended),
    });
  }

  console.log('[sim] OK');
  console.log(JSON.stringify({
    student: {
      id: String(student._id),
      name: student.name,
      course,
      completedSessions: student.completedSessions,
      remainingSessions: student.remainingSessions,
    },
    teacher: { id: String(teacher._id), name: teacher.name },
    today: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    now: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    schedules: created,
    hint: modes.includes('attended')
      ? 'Đăng nhập GV → Học viên → chọn HV → thấy Đã điểm danh + Hủy điểm danh.'
      : modes.includes('overdue')
        ? 'Đăng nhập GV → Học viên → chọn HV → nút Điểm danh bù.'
        : 'Đăng nhập GV phụ trách HV → tab Tiến độ để test.',
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[sim] FAIL:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
