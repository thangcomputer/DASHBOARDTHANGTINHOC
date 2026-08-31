const mongoose = require('mongoose');
const logger = require('./logger');
const ensureIndexes = require('./ensureIndexes');

function resolveDatabaseUri(env = process.env) {
  if (env.NODE_ENV === 'test') {
    const { assertTestDatabaseEnvironment } = require('../tests/setup/testDatabaseGuard');
    return assertTestDatabaseEnvironment(env).uri;
  }
  const uri = String(env.MONGODB_URI || '').trim();
  if (!uri) throw new Error('MONGODB_URI is required');
  return uri;
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(resolveDatabaseUri());
    logger.info(`✅ MongoDB đã kết nối: ${conn.connection.host}`);
    if (process.env.NODE_ENV === 'test') return conn;
    // Không block boot nếu index sync chậm / lỗi tạm thời
    ensureIndexes().catch((err) => {
      logger.warn(`⚠️  ensureIndexes: ${err.message}`);
    });
    // Multi-tenant: tenant mac dinh + gan chi nhanh orphan
    try {
      const tenantService = require('../services/tenantService');
      tenantService.ensureDefaultTenant().catch((err) => {
        logger.warn(`⚠️  ensureDefaultTenant: ${err.message}`);
      });
    } catch (err) {
      logger.warn(`⚠️  tenantService: ${err.message}`);
    }
  } catch (error) {
    logger.error(`❌ Lỗi kết nối MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.resolveDatabaseUri = resolveDatabaseUri;
