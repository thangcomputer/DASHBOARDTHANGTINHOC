const { Server } = require('socket.io');
const { attachSocketIoAdapter } = require('../../config/socketIoAdapter');
const logger = require('../../shared/logger/logger');

let ioInstance = null;

/**
 * Socket.IO Real-time service adapter.
 */
const socketService = {
  /**
   * Initialize Socket.io Server instance attached to HTTP server.
   *
   * @param {Object} httpServer - HTTP Server instance
   * @returns {Object} Socket.io Server instance
   */
  init: async (httpServer) => {
    if (ioInstance) return ioInstance;

    ioInstance = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || '*',
        credentials: true,
      },
    });

    try {
      await attachSocketIoAdapter(ioInstance);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to attach Socket.io Redis adapter');
    }

    return ioInstance;
  },

  /**
   * Get current Socket.io Server instance.
   */
  getIO: () => {
    if (!ioInstance) {
      throw new Error('Socket.IO is not initialized yet. Call init(server) first.');
    }
    return ioInstance;
  },

  /**
   * Send real-time event to a specific user room.
   */
  sendToUser: (userId, event, data) => {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit(event, data);
  },

  /**
   * Send real-time event to a specific room.
   */
  sendToRoom: (roomName, event, data) => {
    if (!ioInstance) return;
    ioInstance.to(roomName).emit(event, data);
  },
};

module.exports = socketService;
