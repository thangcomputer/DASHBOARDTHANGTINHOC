'use strict';
module.exports = {
  mongo: {
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 100,
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE, 10) || 10,
    socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 45000,
    keepAlive: true,
    keepAliveInitialDelay: 300000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
    retryReads: true
  },
  http: {
    etag: true,
    compression: true,
    conditionalGet: true
  },
  profiling: {
    slowQueryThresholdMs: 200,
    logIndexes: false
  }
};