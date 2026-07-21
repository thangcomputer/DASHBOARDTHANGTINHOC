const mongoose = require('mongoose');
const logger = require('./logger');
const ensureIndexes = require('./ensureIndexes');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`✅ MongoDB đã kết nối: ${conn.connection.host}`);
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
