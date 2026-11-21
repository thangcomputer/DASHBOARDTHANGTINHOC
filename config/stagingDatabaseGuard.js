'use strict';

const { parseMongoTarget, redactMongoUri } = require('../utils/mongoUriUtils');

const PROTECTED_PROD_DB_NAMES = new Set([
  'dashboardthangtinhoc',
  'cms_prod',
  'thangtinhoc',
  'thangtinhoc_prod',
  'production',
  'prod',
]);

function assertStagingDatabaseEnvironment(env = process.env, { runtimeMongoUri = '' } = {}) {
  const rawUri = String(env.STAGING_MONGODB_URI || env.MONGODB_URI || '').trim();
  if (!rawUri) {
    throw new Error('Thiếu STAGING_MONGODB_URI / MONGODB_URI cho môi trường Staging');
  }
  const target = parseMongoTarget(rawUri, 'STAGING_MONGODB_URI');
  const dbLower = target.dbName.toLowerCase();

  if (PROTECTED_PROD_DB_NAMES.has(dbLower)) {
    throw new Error(
      `TỪ CHỐI KẾT NỐI STAGING: Database "${target.dbName}" nằm trong danh sách Production/Runtime được bảo vệ! Phải dùng DB riêng kết thúc bằng _staging (VD: dashboardthangtinhoc_staging).`,
    );
  }
  if (!/^staging_/i.test(target.dbName) && !/_staging$/i.test(target.dbName)) {
    throw new Error(
      `Tên database Staging "${target.dbName}" không hợp lệ: bắt buộc bắt đầu bằng "staging_" hoặc kết thúc bằng "_staging".`,
    );
  }

  const prodOrDevUri = String(runtimeMongoUri || env.PRODUCTION_MONGODB_URI || '').trim();
  if (prodOrDevUri) {
    try {
      const runtimeTarget = parseMongoTarget(prodOrDevUri, 'PRODUCTION_MONGODB_URI');
      if (runtimeTarget.dbName.toLowerCase() === dbLower && runtimeTarget.hostname === target.hostname) {
        throw new Error(
          `TỪ CHỐI KẾT NỐI STAGING: DB Staging "${target.dbName}" trùng trực tiếp với DB Production/Runtime "${runtimeTarget.dbName}"!`,
        );
      }
    } catch (err) {
      if (err.message.includes('TỪ CHỐI KẾT NỐI STAGING')) throw err;
    }
  }

  return target;
}

function isProtectedProductionDbName(dbName) {
  return PROTECTED_PROD_DB_NAMES.has(String(dbName || '').trim().toLowerCase());
}

module.exports = {
  PROTECTED_PROD_DB_NAMES,
  assertStagingDatabaseEnvironment,
  isProtectedProductionDbName,
  redactMongoUri,
};
