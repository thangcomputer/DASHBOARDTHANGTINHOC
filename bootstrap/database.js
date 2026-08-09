const mongoose = require('mongoose');
const MongoProfiler = require('../shared/performance/MongoProfiler');
MongoProfiler.init();
const config = require('../config/appConfig');
const logger = require('../shared/logger/logger');

/**
 * Perform startup validations for optional infrastructure services.
 */
const validateInfrastructure = () => {
  const StartupValidator = require('../shared/config/StartupValidator');
  StartupValidator.validateAll();
  // 1. Validate Redis (Optional)
  try {
    const { getRedis, isRedisEnabled } = require('../config/redis');
    if (isRedisEnabled()) {
      const redisClient = getRedis();
      if (redisClient) {
        redisClient.ping()
          .then(() => logger.info('✅ Kiểm tra Redis: Kết nối thành công.'))
          .catch((err) => logger.warn(`⚠️  Kiểm tra Redis: Không kết nối được (${err.message})`));
      } else {
        logger.warn('⚠️  Kiểm tra Redis: Khởi tạo thất bại.');
      }
    } else {
      logger.info('ℹ️  Kiểm tra Redis: Không bật (Sử dụng bộ nhớ tạm In-Memory).');
    }
  } catch (err) {
    logger.warn(`⚠️  Lỗi kiểm tra Redis: ${err.message}`);
  }

  // 2. Validate Mail Configuration (Optional)
  const isMailConfigured = Boolean(config.mail.host && config.mail.from);
  if (isMailConfigured) {
    logger.info(`✅ Kiểm tra Mail: Đã cấu hình SMTP Host (${config.mail.host}).`);
  } else {
    logger.warn('⚠️  Kiểm tra Mail: Chưa cấu hình SMTP_HOST / SMTP_FROM (Không gửi được email).');
  }

  // 3. Validate Storage Provider
  const provider = config.storage.provider || 'local';
  logger.info(`✅ Kiểm tra Storage: Sử dụng Provider [${provider.toUpperCase()}].`);
  if (provider === 's3' && (!config.storage.s3.bucket || !config.storage.s3.accessKey)) {
    logger.warn('⚠️  Kiểm tra Storage: Chọn provider S3 nhưng cấu hình AWS S3 thiếu tham số.');
  }

  // 4. Validate Payment integration (SePay) (Optional)
  const isPaymentConfigured = Boolean(config.sepay.apiKey || config.sepay.secretKey);
  if (isPaymentConfigured) {
    logger.info('✅ Kiểm tra Payment: Đã cấu hình SePay API.');
  } else {
    logger.warn('⚠️  Kiểm tra Payment: Thiếu cấu hình SePay API Key / Secret Key.');
  }
};

/**
 * Bootstrap MongoDB database connection & validate services.
 */
const connectDB = async () => {
  try {
    // MongoDB is MANDATORY -> Fail-fast if not available
    const conn = await mongoose.connect(config.database.uri, require('../config/performance').mongo);
    logger.info(`✅ MongoDB đã kết nối thành công: ${conn.connection.host}`);

    // Asynchronously ensure database indexes matching schemas
    try {
      const ensureIndexes = require('../config/ensureIndexes');
      ensureIndexes().catch((err) => {
        logger.warn(`⚠️  Đồng bộ database indexes thất bại: ${err.message}`);
      });
    } catch (err) {
      logger.warn(`⚠️  Không tìm thấy module ensureIndexes: ${err.message}`);
    }

    // Tenant check or default setup integration
    try {
      const tenantService = require('../modules/tenant/tenantService');
      tenantService.ensureDefaultTenant().catch((err) => {
        logger.warn(`⚠️  Tạo mặc định tenant thất bại: ${err.message}`);
      });
    } catch (err) {
      logger.warn(`⚠️  Không tìm thấy dịch vụ tenantService: ${err.message}`);
    }

    // Perform non-blocking infrastructure validation
    validateInfrastructure();

    return conn;
  } catch (error) {
    logger.error(`❌ Lỗi kết nối MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
