/**
 * Socket.IO Redis adapter — multi-instance fan-out when REDIS_URL is set.
 * Falls back to in-memory adapter if Redis is missing or connect fails.
 */
const logger = require('./logger');

/**
 * @param {import('socket.io').Server} io
 * @returns {Promise<{ mode: 'redis'|'memory', error?: string }>}
 */
async function attachSocketIoAdapter(io) {
  const url = (process.env.REDIS_URL || '').trim();
  if (!url) {
    process.env.__SOCKET_ADAPTER_MODE = 'memory';
    logger.info('Socket.IO adapter: memory (REDIS_URL unset)');
    return { mode: 'memory' };
  }

  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const Redis = require('ioredis');

    const pubClient = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    process.env.__SOCKET_ADAPTER_MODE = 'redis';

    const onErr = (label) => (err) => {
      logger.warn({ err: err && err.message, client: label }, 'Socket.IO Redis client error');
    };
    pubClient.on('error', onErr('pub'));
    subClient.on('error', onErr('sub'));

    logger.info('Socket.IO adapter: redis');
    return { mode: 'redis' };
  } catch (err) {
    process.env.__SOCKET_ADAPTER_MODE = 'memory';
    logger.warn({ err: err.message }, 'Socket.IO Redis adapter failed — using memory');
    return { mode: 'memory', error: err.message };
  }
}

module.exports = { attachSocketIoAdapter };
