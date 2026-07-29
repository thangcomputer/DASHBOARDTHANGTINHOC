/**
 * Local DB snapshot for QA reporting.
 * Prints counts for branches/roles/students/courses/ledger/notifications/audit.
 *
 * Run: node scripts/_qa_db_snapshot.cjs
 * Note: This file is for QA evidence; do not commit secrets.
 */
require('dotenv').config();

const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Branch = require('../models/Branch');
  const Teacher = require('../models/Teacher');
  const Student = require('../models/Student');
  const Course = require('../models/Course');
  const Notification = require('../models/Notification');
  const AuditLog = require('../models/AuditLog');
  const LedgerEntry = require('../models/LedgerEntry');

  const branches = await Branch.find({ code: { $in: ['CN1', 'CN2', 'CN3'] } })
    .lean();

  const teachers = await Teacher.find({ name: { $regex: '^QA ' } })
    .select('role adminRole branchId status')
    .lean();

  const byRole = { superAdmin: 0, admins: 0, staff: 0, teacher: 0 };
  for (const t of teachers) {
    if (t.role === 'admin' && t.adminRole === 'SUPER_ADMIN') byRole.superAdmin++;
    if (t.role === 'admin' && t.adminRole !== 'SUPER_ADMIN') byRole.admins++;
    if (t.role === 'staff') byRole.staff++;
    if (t.role === 'teacher') byRole.teacher++;
  }

  const qaStudents = await Student.find({ name: { $regex: '^QA ' } })
    .select('name enrollments paid paidAmount studentExamUnlocked examApproved')
    .lean();
  const totalQaStudents = qaStudents.length;
  const withEnrollAtLeast2 = qaStudents.filter((s) => (s.enrollments || []).length >= 2).length;

  const courseNames = ['Tin học văn phòng', 'Excel MOS', 'Word MOS', 'PowerPoint MOS', 'Canva', 'IC3'];
  const courses = await Course.find({ name: { $in: courseNames } })
    .select('name slug status deletedAt')
    .lean();

  const softDeletedCourseCount = await Course.countDocuments({ deletedAt: { $ne: null } });
  const notificationExamCount = await Notification.countDocuments({ type: 'EXAM' });
  const auditExamUnlockCount = await AuditLog.countDocuments({ action: 'exam.unlock' });

  const ledgerPayments = await LedgerEntry.countDocuments({ type: 'payment' });
  const ledgerRefunds = await LedgerEntry.countDocuments({ type: 'refund' });

  console.log(
    JSON.stringify(
      {
        branches: branches.map((b) => ({ code: b.code, id: String(b._id), name: b.name, isActive: b.isActive })),
        byRole,
        qaStudents: { total: totalQaStudents, withEnrollAtLeast2 },
        coursesFound: courses.map((c) => ({ name: c.name, status: c.status, deletedAt: c.deletedAt })),
        softDeletedCourseCount,
        notificationExamCount,
        auditExamUnlockCount,
        ledger: { payments: ledgerPayments, refunds: ledgerRefunds },
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

