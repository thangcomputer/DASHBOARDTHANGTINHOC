#!/usr/bin/env node
'use strict';

/**
 * scripts/setup-staging-db.cjs
 *
 * Khởi tạo, kiểm tra hoặc dọn dẹp database MongoDB Staging ĐỘC LẬP (`dashboardthangtinhoc_staging`)
 * chỉ với tài khoản giả lập & dữ liệu thử nghiệm — TUYỆT ĐỐI KHÔNG sao chép PII học viên thật
 * và TUYỆT ĐỐI KHÔNG ghi vào Production/Dev database (`dashboardthangtinhoc`).
 *
 * Cách dùng:
 *   node scripts/setup-staging-db.cjs --seed
 *   node scripts/setup-staging-db.cjs --verify
 *   node scripts/setup-staging-db.cjs --cleanup
 *   node scripts/setup-staging-db.cjs --print-least-privilege-script
 */

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { assertStagingDatabaseEnvironment, redactMongoUri } = require('../config/stagingDatabaseGuard');

// Đọc .env gốc chỉ để biết tên DB runtime nhằm CẤM trùng tuyệt đối
function readDotEnvMongoUri() {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
    const m = raw.match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

const DEFAULT_STAGING_URI = 'mongodb://127.0.0.1:27017/dashboardthangtinhoc_staging';

const STAGING_SYNTHETIC_ACCOUNTS = {
  teachers: [
    {
      _id: new mongoose.Types.ObjectId('690000000000000000000101'),
      name: 'Admin Thử Nghiệm Staging',
      email: 'staging-admin@dewskill.local',
      phone: '0900000101',
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      status: 'active',
      accountLocked: false,
      tokenVersion: 1,
      isSyntheticStagingAccount: true,
    },
    {
      _id: new mongoose.Types.ObjectId('690000000000000000000102'),
      name: 'Giảng Viên Thử Nghiệm Staging',
      email: 'staging-teacher@dewskill.local',
      phone: '0900000102',
      role: 'teacher',
      status: 'active',
      accountLocked: false,
      tokenVersion: 1,
      isSyntheticStagingAccount: true,
    },
    {
      _id: new mongoose.Types.ObjectId('690000000000000000000103'),
      name: 'Nhân Viên Thử Nghiệm Staging',
      email: 'staging-staff@dewskill.local',
      phone: '0900000103',
      role: 'staff',
      adminRole: 'STAFF',
      status: 'active',
      accountLocked: false,
      tokenVersion: 1,
      isSyntheticStagingAccount: true,
    },
  ],
  students: [
    {
      _id: new mongoose.Types.ObjectId('690000000000000000000104'),
      name: 'Học Viên Pilot Canary (Giả Lập)',
      phone: '0900000104',
      email: 'staging-pilot-student@dewskill.local',
      course: 'Tin học văn phòng MOS 365 (Staging)',
      enrollments: [
        {
          courseName: 'Tin học văn phòng MOS 365 (Staging)',
          status: 'active',
          learningAccess: true,
          completedSessions: 3,
          totalSessions: 12,
        },
      ],
      status: 'active',
      accountLocked: false,
      freePortal: false,
      freeUnlocked: true,
      tokenVersion: 1,
      isSyntheticStagingAccount: true,
    },
    {
      _id: new mongoose.Types.ObjectId('690000000000000000000105'),
      name: 'Học Viên Đối Chứng Legacy (Giả Lập)',
      phone: '0900000105',
      email: 'staging-control-student@dewskill.local',
      course: 'Tin học văn phòng cơ bản (Staging)',
      enrollments: [
        {
          courseName: 'Tin học văn phòng cơ bản (Staging)',
          status: 'active',
          learningAccess: true,
          completedSessions: 2,
          totalSessions: 10,
        },
      ],
      status: 'active',
      accountLocked: false,
      freePortal: false,
      freeUnlocked: true,
      tokenVersion: 1,
      isSyntheticStagingAccount: true,
    },
    {
      _id: new mongoose.Types.ObjectId('690000000000000000000106'),
      name: 'Học Viên FreePortal Khóa (Giả Lập)',
      phone: '0900000106',
      email: 'staging-locked-free@dewskill.local',
      course: 'Miễn phí (Staging)',
      enrollments: [],
      status: 'active',
      accountLocked: false,
      freePortal: true,
      freeUnlocked: false,
      tokenVersion: 1,
      isSyntheticStagingAccount: true,
    },
  ],
};

function printLeastPrivilegeMongoScript(dbName = 'dashboardthangtinhoc_staging') {
  console.log(`// Chạy bằng mongosh với quyền userAdmin khi MongoDB bật --auth:
use ${dbName};
db.createUser({
  user: "dewskill_staging_app",
  pwd: passwordPrompt(), // Thay mật khẩu mạnh >= 24 ký tự
  roles: [
    { role: "readWrite", db: "${dbName}" }
  ]
});
// Tài khoản này CHỈ có quyền đọc/ghi duy nhất trên "${dbName}", KHÔNG có quyền đọc/ghi Production DB hay admin DB.
// URI kết nối tương ứng:
// STAGING_MONGODB_URI=mongodb://dewskill_staging_app:<STRONG_PASSWORD>@127.0.0.1:27017/${dbName}?authSource=${dbName}
`);
}

async function seedStagingDb(target) {
  await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const syntheticPassHash = await bcrypt.hash('StagingPilot@2026!Only', 10);
  const now = new Date();

  for (const t of STAGING_SYNTHETIC_ACCOUNTS.teachers) {
    await db.collection('teachers').updateOne(
      { _id: t._id },
      { $set: { ...t, password: syntheticPassHash, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  for (const s of STAGING_SYNTHETIC_ACCOUNTS.students) {
    await db.collection('students').updateOne(
      { _id: s._id },
      { $set: { ...s, password: syntheticPassHash, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }

  const teacherCount = await db.collection('teachers').countDocuments({ isSyntheticStagingAccount: true });
  const studentCount = await db.collection('students').countDocuments({ isSyntheticStagingAccount: true });
  await mongoose.disconnect();

  return {
    dbName: target.dbName,
    uriSafe: redactMongoUri(target.uri),
    syntheticTeachers: teacherCount,
    syntheticStudents: studentCount,
    canaryUserIds: [
      '690000000000000000000101',
      '690000000000000000000102',
      '690000000000000000000103',
      '690000000000000000000104',
    ],
    controlStudentId: '690000000000000000000105',
    lockedFreeStudentId: '690000000000000000000106',
  };
}

async function cleanupStagingDb(target) {
  await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const delFb = await db.collection('aiquickaskfeedbacks').deleteMany({});
  const delStats = await db.collection('aiquickaskdailystats').deleteMany({});
  await mongoose.disconnect();
  return {
    dbName: target.dbName,
    deletedFeedbacks: delFb.deletedCount,
    deletedDailyStats: delStats.deletedCount,
  };
}

async function verifyStagingDb(target) {
  await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const totalTeachers = await db.collection('teachers').countDocuments();
  const syntheticTeachers = await db.collection('teachers').countDocuments({ isSyntheticStagingAccount: true });
  const totalStudents = await db.collection('students').countDocuments();
  const syntheticStudents = await db.collection('students').countDocuments({ isSyntheticStagingAccount: true });
  const feedbackCount = await db.collection('aiquickaskfeedbacks').countDocuments();
  const dailyStatCount = await db.collection('aiquickaskdailystats').countDocuments();
  await mongoose.disconnect();
  return {
    dbName: target.dbName,
    uriSafe: redactMongoUri(target.uri),
    onlySyntheticAccounts: totalTeachers === syntheticTeachers && totalStudents === syntheticStudents,
    totalTeachers,
    syntheticTeachers,
    totalStudents,
    syntheticStudents,
    feedbackCount,
    dailyStatCount,
  };
}

async function ensureStagingMongoAppUser(target, env = process.env) {
  const rootUser = String(env.STAGING_MONGO_ROOT_USER || '').trim();
  const rootPass = String(env.STAGING_MONGO_ROOT_PASSWORD || '').trim();
  const appUser = String(env.STAGING_MONGO_APP_USER || 'dewskill_staging_app').trim();
  const appPass = String(env.STAGING_MONGO_APP_PASSWORD || '').trim();
  if (!rootUser || !rootPass || !appPass) return { ensured: false, reason: 'no_root_or_app_creds' };

  const { MongoClient } = mongoose.mongo;
  const parsedPort = (() => {
    try {
      return new URL(String(target.uri || '')).port || '27017';
    } catch {
      return '27017';
    }
  })();
  const rootUri = `mongodb://${encodeURIComponent(rootUser)}:${encodeURIComponent(rootPass)}@${target.hostname}:${parsedPort}/admin?authSource=admin`;
  const client = new MongoClient(rootUri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const db = client.db(target.dbName);
    const info = await db.command({ usersInfo: appUser }).catch(() => ({ users: [] }));
    if (Array.isArray(info.users) && info.users.length > 0) {
      await db.command({
        updateUser: appUser,
        pwd: appPass,
        roles: [{ role: 'readWrite', db: target.dbName }],
      });
      return { ensured: true, action: 'updated', user: appUser, dbName: target.dbName };
    }
    await db.command({
      createUser: appUser,
      pwd: appPass,
      roles: [{ role: 'readWrite', db: target.dbName }],
    });
    return { ensured: true, action: 'created', user: appUser, dbName: target.dbName };
  } finally {
    await client.close();
  }
}

function loadStagingEnvFileIfPresent() {
  try {
    const envPath = path.resolve(__dirname, '../.env.staging');
    if (!fs.existsSync(envPath)) return;
    const dotenv = require('dotenv');
    const parsed = dotenv.parse(fs.readFileSync(envPath));
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch { /* ignore */ }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--print-least-privilege-script')) {
    printLeastPrivilegeMongoScript();
    return;
  }

  loadStagingEnvFileIfPresent();
  const runtimeUri = readDotEnvMongoUri();
  const stagingEnv = {
    ...process.env,
    STAGING_MONGODB_URI: process.env.STAGING_MONGODB_URI || DEFAULT_STAGING_URI,
  };
  const target = assertStagingDatabaseEnvironment(stagingEnv, { runtimeMongoUri: runtimeUri });

  if (args.has('--cleanup')) {
    const res = await cleanupStagingDb(target);
    console.log(JSON.stringify({ action: 'cleanup', ...res }, null, 2));
    return;
  }
  if (args.has('--verify')) {
    const res = await verifyStagingDb(target);
    console.log(JSON.stringify({ action: 'verify', ...res }, null, 2));
    return;
  }
  const userEnsure = await ensureStagingMongoAppUser(target, process.env).catch((err) => ({
    ensured: false,
    error: err.message,
  }));
  const res = await seedStagingDb(target);
  console.log(JSON.stringify({ action: 'seed', ...res }, null, 2));
  console.log(JSON.stringify({ action: 'seed', userEnsure, ...res }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[STAGING DB SETUP ERROR]', err.message);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_STAGING_URI,
  STAGING_SYNTHETIC_ACCOUNTS,
  ensureStagingMongoAppUser,
  seedStagingDb,
  cleanupStagingDb,
  verifyStagingDb,
};
