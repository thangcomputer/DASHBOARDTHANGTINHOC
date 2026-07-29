/**
 * Recompute Student.paidAmount / paid từ Ledger (P4 cutover helper).
 * Usage: node scripts/_finance_sync_cache_from_ledger.cjs [--limit=100]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { syncStudentFinanceCache } = require('../services/ledgerService');

async function main() {
  const limArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limArg ? Number(limArg.split('=')[1]) || 0 : 0;
  await mongoose.connect(process.env.MONGODB_URI);
  const q = Student.find({}).select('_id name');
  if (limit > 0) q.limit(limit);
  const students = await q.lean();
  let ok = 0;
  let fail = 0;
  for (const s of students) {
    try {
      await syncStudentFinanceCache(s._id);
      ok += 1;
    } catch (err) {
      fail += 1;
      console.error('fail', s._id, err.message);
    }
  }
  console.log(JSON.stringify({ total: students.length, ok, fail }));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
