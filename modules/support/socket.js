const SupportAgent = require('./SupportAgent');
const { SupportStatus, OnlineStatus } = require('../../shared/enums');

module.exports = function (io) {
  // Support Namespace
  const supportNs = io.of('/support');

  supportNs.use(async (socket, next) => {
    // Basic auth logic here
    // Verify JWT, set socket.user
    next();
  });

  supportNs.on('connection', (socket) => {
    console.log(`Support socket connected: ${socket.id}`);

    // Join their own user room to receive direct notifications
    if (socket.user) {
      socket.join(socket.user._id.toString());
      
      // Update agent status if they are an agent
      if (socket.user.roleCode === 'SUPPORT_AGENT') {
        SupportAgent.findOneAndUpdate(
          { userId: socket.user._id },
          { onlineStatus: OnlineStatus.ONLINE }
        ).exec();
        
        // Broadcast to other agents or admins
        supportNs.emit('support:online', { userId: socket.user._id });
      }
    }

    socket.on('support:typing', (data) => {
      // data: { conversationId, isTyping }
      socket.to(data.conversationId).emit('support:typing', {
        userId: socket.user._id,
        ...data
      });
    });

    socket.on('support:joined', (data) => {
      // data: { conversationId }
      socket.join(data.conversationId);
      socket.to(data.conversationId).emit('support:joined', { userId: socket.user._id });
    });

    socket.on('support:left', (data) => {
      socket.leave(data.conversationId);
      socket.to(data.conversationId).emit('support:left', { userId: socket.user._id });
    });

    socket.on('disconnect', () => {
      if (socket.user && socket.user.roleCode === 'SUPPORT_AGENT') {
        SupportAgent.findOneAndUpdate(
          { userId: socket.user._id },
          { onlineStatus: OnlineStatus.OFFLINE }
        ).exec();
        supportNs.emit('support:offline', { userId: socket.user._id });
      }
    });
  });

  // Export functions to trigger events from controllers
  return {
    emitAssigned: (conversationId, agentId) => {
      supportNs.to(conversationId).emit('support:assigned', { conversationId, agentId });
      // Notify the agent specifically
      supportNs.to(agentId.toString()).emit('support:assigned', { conversationId, agentId });
    },
    emitConversationCreated: (conversation) => {
      supportNs.emit('conversation:created', conversation);
    },
    emitConversationClosed: (conversationId) => {
      supportNs.to(conversationId).emit('conversation:closed', { conversationId });
    },
    emitMessageSent: (conversationId, message) => {
      supportNs.to(conversationId).emit('message:sent', message);
    },
    emitMessageRead: (conversationId, messageId, userId) => {
      supportNs.to(conversationId).emit('message:read', { conversationId, messageId, userId });
    },
    emitNotification: (userId, notification) => {
      supportNs.to(userId.toString()).emit('notification:new', notification);
    }
  };
};
