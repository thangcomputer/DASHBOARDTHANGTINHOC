/**
 * Centralized Application Configurations.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  isProduction: process.env.NODE_ENV === 'production',

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'secret',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    masterAdminPassword: process.env.MASTER_ADMIN_PASSWORD || 'admin',
    sessionSecret: process.env.SESSION_SECRET || 'session_secret',
  },

  redis: {
    url: process.env.REDIS_URL || null,
  },

  mail: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'no-reply@thangtinhoc.edu.vn',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local', // 'local' | 's3'
    s3: {
      bucket: process.env.S3_BUCKET || '',
      accessKey: process.env.AWS_ACCESS_KEY_ID || '',
      secretKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'ap-southeast-1',
    },
    local: {
      uploadDir: process.env.UPLOAD_DIR || 'uploads',
    },
  },

  sepay: {
    apiKey: process.env.SEPAY_API_KEY || '',
    secretKey: process.env.SEPAY_SECRET_KEY || '',
  },
};

module.exports = config;
