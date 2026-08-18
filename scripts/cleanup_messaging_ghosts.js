/**
 * Dọn tin nhắn orphan (peer đã xóa khỏi Student/Teacher) trên VPS/DB.
 *
 * Usage:
 *   node scripts/cleanup_messaging_ghosts.js
 *   node scripts/cleanup_messaging_ghosts.js --dry-run
 */
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const {
  purgeOrphanMessages,
  purgeCancelledOnlyStudents,
} = require('../services/userCascadeCleanup');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
  await mongoose.connect(uri);
  console.log('[cleanup] Connected:', uri.replace(/\/\/.*@/, '//***@'));

  if (dryRun) {
    const preview = await purgeCancelledOnlyStudents({ dryRun: true });
    console.log('[cleanup] Cancelled-only students (preview):', preview.count);
    if (preview.names?.length) {
      preview.names.forEach((name) => console.log('  -', name));
    }
    console.log('[cleanup] Dry-run — không xóa DB. Bỏ --dry-run để dọn thật.');
    await mongoose.disconnect();
    return;
  }

  const cancelled = await purgeCancelledOnlyStudents({ dryRun: false });
  console.log('[cleanup] Deleted cancelled-only students:', cancelled.deleted || 0);

  const orphan = await purgeOrphanMessages();
  console.log('[cleanup] Deleted orphan messages:', orphan.deletedMessages || 0);
  console.log('[cleanup] Dead peer ids:', orphan.deadPeerIds || 0);

  await mongoose.disconnect();
  console.log('[cleanup] Done.');
}

main().catch((err) => {
  console.error('[cleanup] Failed:', err.message);
  process.exit(1);
});
