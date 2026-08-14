require('dotenv').config();
const mongoose = require('mongoose');
const Schedule = require('../../models/Schedule');
const Student = require('../../models/Student');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const start = new Date(2026, 7, 13, 0, 0, 0, 0);
  const end = new Date(2026, 7, 14, 0, 0, 0, 0);
  const rows = await Schedule.find({ date: { $gte: start, $lt: end } })
    .select('teacherId studentId studentName teacherName startTime endTime status note course date')
    .lean();
  console.log('count', rows.length);
  for (const r of rows) {
    console.log({
      id: String(r._id),
      student: r.studentName,
      studentId: String(r.studentId || ''),
      teacher: r.teacherName,
      teacherId: String(r.teacherId || ''),
      dateISO: r.date,
      t: `${r.startTime}-${r.endTime}`,
      status: r.status,
      note: String(r.note || '').slice(0, 50),
      course: r.course,
    });
  }

  const s122 = await Student.findOne({ name: /THẮNG122/i }).select('name teacherId course').lean();
  console.log('student122', s122 && {
    id: String(s122._id),
    name: s122.name,
    teacherId: String(s122.teacherId || ''),
    course: s122.course,
  });

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
