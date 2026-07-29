/**
 * Debug helper (local QA): print QA teachers by branchCode/specialty.
 * Not intended for production; uncommitted by default.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Teacher = require('../models/Teacher');

  const teachers = await Teacher.find({ name: { $regex: '^QA ' } })
    .select('_id name role adminRole branchCode status specialty')
    .lean();

  const byBranch = new Map();
  for (const t of teachers) {
    const bc = t.branchCode || '(no-branchCode)';
    if (!byBranch.has(bc)) byBranch.set(bc, []);
    byBranch.get(bc).push(t);
  }

  const normalize = (s) => String(s || '').toLowerCase();

  const rows = [...byBranch.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([bc, list]) => {
      const excelCount = list.filter((t) => /excel/i.test(normalize(t.specialty))).length;
      return {
        branchCode: bc,
        total: list.length,
        excelSpecialtyCount: excelCount,
        teachers: list
          .map((t) => ({
            id: String(t._id),
            name: t.name,
            status: t.status,
            specialty: t.specialty,
          }))
          .slice(0, 10),
      };
    });

  console.log(JSON.stringify({ qaTeacherTotal: teachers.length, rows }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

