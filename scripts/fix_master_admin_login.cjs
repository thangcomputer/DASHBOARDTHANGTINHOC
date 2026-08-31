/**
 * Đồng bộ mật khẩu Super Admin từ .env → DB + báo cáo trùng SĐT.
 * Chạy trên VPS:
 *   cd /www/wwwroot/dashboard-thangtinhoc-edu-vn
 *   node scripts/fix_master_admin_login.cjs
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function main() {
  const uri = process.env.MONGODB_URI;
  const phone = String(process.env.MASTER_ADMIN_PHONE || '').trim();
  const password = String(process.env.MASTER_ADMIN_PASSWORD || '').trim();

  if (!uri) throw new Error('Thiếu MONGODB_URI');
  if (!phone) throw new Error('Thiếu MASTER_ADMIN_PHONE');
  if (!password) throw new Error('Thiếu MASTER_ADMIN_PASSWORD');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const teachers = await db.collection('teachers').find({ phone }).project({ name: 1, role: 1, phone: 1 }).toArray();
  const students = await db.collection('students').find({ phone }).project({ name: 1, phone: 1 }).toArray();
  console.log('Teachers trùng SĐT admin:', teachers.length ? teachers : '(không)');
  console.log('Students trùng SĐT admin:', students.length ? students : '(không)');

  const hash = await bcrypt.hash(password, 10);
  const r = await db.collection('systemsettings').updateOne(
    { _key: 'main' },
    { $set: { adminPasswordHash: hash } },
    { upsert: true },
  );
  console.log('Đã đồng bộ adminPasswordHash từ MASTER_ADMIN_PASSWORD:', {
    matched: r.matchedCount,
    modified: r.modifiedCount,
    upserted: r.upsertedCount,
  });
  console.log('Đăng nhập cổng Admin bằng SĐT', phone, '+ mật khẩu trong .env (nhớ nhập captcha).');
  console.log('Nếu trước đây bị chặn do trùng HV/GV: pull code mới (auth không chặn nữa khi mật khẩu đúng) rồi pm2 restart.');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
