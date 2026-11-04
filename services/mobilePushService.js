const MobilePushToken = require('../models/MobilePushToken');
const logger = require('../config/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TICKET_LIMIT = 100;
const ROOM_ROLES = {
  ALL_TEACHER: ['teacher'],
  ALL_STUDENT: ['student'],
  ALL_ADMIN: [],
  ALL_STAFF: [],
  ALL_SUPPORT: [],
};

function buildEventNotification(eventName, data = {}) {
  switch (eventName) {
    case 'message:receive':
      return { title: 'Tin nhắn mới', body: 'Bạn vừa nhận được tin nhắn mới.', channelId: 'default' };
    case 'call:incoming':
      return { title: 'Cuộc gọi đến', body: 'Bạn có một cuộc gọi đến.', channelId: 'calls', priority: 'high' };
    case 'quiz:assigned':
      return { title: 'Bài kiểm tra mới', body: 'Bạn vừa được giao một bài kiểm tra.', channelId: 'default' };
    case 'class:reminder':
      return { title: 'Nhắc lịch học', body: 'Bạn sắp có lịch học.', channelId: 'default' };
    case 'schedule:new':
    case 'schedule:updated':
    case 'schedule:cancelled':
      return { title: 'Lịch học được cập nhật', body: 'Có thay đổi trong lịch học của bạn.', channelId: 'default' };
    case 'notification': {
      const type = String(data.type || '').toUpperCase();
      if (type === 'MESSAGE') return null;
      if (data.payload?.kind === 'feed_interaction') {
        return {
          title: String(data.title || 'Thông báo mới').slice(0, 100),
          body: String(data.content || 'Bạn có thông báo mới.').slice(0, 240),
          channelId: 'default',
        };
      }
      const titles = {
        SCHEDULE: 'Cập nhật lịch học',
        QUIZ: 'Bài kiểm tra mới',
        FINANCE: 'Thông báo tài chính',
        COURSE: 'Thông báo khóa học',
        EVALUATION: 'Thông báo đánh giá',
      };
      return {
        title: titles[type] || 'Thông báo mới',
        body: 'Bạn có thông báo mới.',
        channelId: 'default',
      };
    }
    default:
      return null;
  }
}

function logDispatchError(error, eventName) {
  logger.error({ err: error, eventName }, '[MOBILE_PUSH] Failed to send push notification');
}

async function postMessages(messages) {
  for (let offset = 0; offset < messages.length; offset += EXPO_TICKET_LIMIT) {
    const batch = messages.slice(offset, offset + EXPO_TICKET_LIMIT);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Expo Push Service returned HTTP ${response.status}.`);
    }
    const result = await response.json();
    if (!Array.isArray(result.data) || result.data.length !== batch.length) {
      throw new Error('Expo Push Service returned an invalid ticket response.');
    }
    const tickets = result.data;
    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await MobilePushToken.updateOne(
          { token: batch[index]?.to },
          { $set: { enabled: false } },
        );
      } else if (ticket?.status === 'error') {
        logger.warn(
          { error: ticket.message, code: ticket.details?.error },
          '[MOBILE_PUSH] Expo rejected a push notification',
        );
      }
    }
  }
}

function makePushMessage(device, notification, eventName, data = {}) {
  const pushData = { event: eventName };
  if (eventName === 'call:incoming') {
    pushData.callId = String(data.callId || '');
    pushData.conversationId = String(data.conversationId || '');
    pushData.caller = {
      id: String(data.caller?.id || ''),
      role: String(data.caller?.role || ''),
      name: String(data.caller?.name || 'Người gọi').slice(0, 100),
    };
  }
  const message = {
    to: device.token,
    title: notification.title,
    body: notification.body,
    priority: notification.priority || 'high',
    channelId: device.soundEnabled ? notification.channelId : 'silent',
    data: pushData,
  };
  if (device.soundEnabled) message.sound = 'default';
  return message;
}

async function sendToDevices(devices, notification, eventName, data) {
  if (!devices.length) return;
  await postMessages(devices.map((device) => makePushMessage(device, notification, eventName, data)));
}

function dispatchToUser(role, userId, eventName, data) {
  const notification = buildEventNotification(eventName, data);
  if (!notification || !userId || !['student', 'teacher'].includes(String(role))) return Promise.resolve(false);
  return MobilePushToken.find({ userId: String(userId), role, enabled: true })
    .lean()
    .then((devices) => {
      if (!devices.length) return false;
      void sendToDevices(devices, notification, eventName, data)
        .catch((error) => logDispatchError(error, eventName));
      return true;
    })
    .catch((error) => {
      logDispatchError(error, eventName);
      return false;
    });
}

function dispatchToReceivers(receivers, notificationData) {
  const notification = buildEventNotification('notification', notificationData);
  if (!notification) return;
  const receiversList = Array.isArray(receivers) ? receivers : [receivers];
  const userIds = new Set();
  const roles = new Set();

  for (const receiver of receiversList) {
    const key = String(receiver || '');
    if (!key) continue;
    if (key === 'GLOBAL' || key === 'ALL') {
      roles.add('student');
      roles.add('teacher');
    } else if (ROOM_ROLES[key]) {
      ROOM_ROLES[key].forEach((role) => roles.add(role));
    } else if (!key.startsWith('ALL_')) {
      userIds.add(key);
    }
  }
  const targets = [];
  if (userIds.size) targets.push({ userId: { $in: [...userIds] } });
  if (roles.size) targets.push({ role: { $in: [...roles] } });
  if (!targets.length) return;

  MobilePushToken.find({ enabled: true, $or: targets })
    .lean()
    .then((devices) => sendToDevices(devices, notification, 'notification', notificationData))
    .catch((error) => logDispatchError(error, 'notification'));
}

module.exports = {
  buildEventNotification,
  dispatchToReceivers,
  dispatchToUser,
};
