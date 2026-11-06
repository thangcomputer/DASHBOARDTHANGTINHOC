'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { resetAllToWelcomeXp } = require('../services/lmsProgressService');

if (!process.argv.includes('--confirm')) {
  console.error('Thêm --confirm để xóa XP học bài rồi tặng 100 XP cho mọi học viên.');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const result = await resetAllToWelcomeXp();
  console.log(JSON.stringify(result));
  await mongoose.disconnect();
}).catch(async (err) => {
  console.error(err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
