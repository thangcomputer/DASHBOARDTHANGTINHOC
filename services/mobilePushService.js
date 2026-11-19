const MobilePushToken = require('../models/MobilePushToken');
const logger = require('../config/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TICKET_LIMIT = 100;
const DEDUP_CACHE = new Map();
const DEDUP_MAX_SIZE = 5000;

const ROOM_ROLES = {
  ALL_TEACHER: ['teacher'],
  ALL_STUDENT: ['student'],
  ALL_ADMIN: [],
  ALL_STAFF: [],
  ALL_SUPPORT: [],
};

function pruneDedupCache(now = Date.now()) {
  if (DEDUP_CACHE.size < DEDUP_MAX_SIZE) return;
  for (const [key, expiresAt] of DEDUP_CACHE.entries()) {
    if (expiresAt <= now) DEDUP_CACHE.delete(key);
  }
  if (DEDUP_CACHE.size >= DEDUP_MAX_SIZE) {
    DEDUP_CACHE.clear();
  }
}

function shouldDeduplicate(dedupKey, ttlMs = 30_000) {
  if (!dedupKey) return false;
  const now = Date.now();
  const existingExpiry = DEDUP_CACHE.get(dedupKey);
  if (existingExpiry && existingExpiry > now) {
    return true;
  }
  pruneDedupCache(now);
  DEDUP_CACHE.set(dedupKey, now + ttlMs);
  return false;
}

function buildDedupKey(targetKey, eventName, data = {}) {
  const entityId = String(
    data.notificationId
    || data.messageId
    || data.callId
    || data.scheduleId
    || data.assignmentId
    || data.quizId
    || data.id
    || '',
  );
  if (!entityId) return '';
  const extra = data.offsetMinutes != null ? `:${data.offsetMinutes}` : '';
  return `${targetKey}:${eventName}:${entityId}${extra}`;
}

function buildEventNotification(eventName, data = {}) {
  switch (eventName) {
    case 'message:receive':
      return { title: 'Tin nhắn mới', body: 'Bạn vừa nhận được tin nhắn mới.', channelId: 'default' };
    case 'call:incoming':
      return { title: 'Cuộc gọi đến', body: 'Bạn có một cuộc gọi đến.', channelId: 'calls', priority: 'high' };
    case 'call:missed':
      return { title: 'Cuộc gọi nhỡ', body: 'Bạn có một cuộc gọi nhỡ.', channelId: 'calls' };
    case 'quiz:assigned':
      return { title: 'Bài kiểm tra mới', body: 'Bạn vừa được giao một bài kiểm tra.', channelId: 'default' };
    case 'assignment:new':
      return { title: 'Bài tập mới', body: 'Bạn vừa được giao một bài tập mới.', channelId: 'default' };
    case 'assignment:deadline':
      return { title: 'Sắp đến hạn nộp bài', body: 'Bạn có bài tập sắp đến hạn nộp.', channelId: 'default' };
    case 'assignment:graded':
      return { title: 'Kết quả bài tập', body: 'Giảng viên đã chấm điểm bài tập của bạn.', channelId: 'default' };
    case 'class:started':
      return { title: 'Buổi học đang bắt đầu', body: 'Đã đến giờ vào lớp học trực tuyến.', channelId: 'schedule' };
    case 'class:reminder': {
      const offset = Number(data.offsetMinutes);
      if (offset === 1440) {
        return { title: 'Nhắc lịch học ngày mai', body: 'Bạn có buổi học vào ngày mai (trước 24 giờ).', channelId: 'schedule' };
      }
      if (offset === 60) {
        return { title: 'Lịch học sau 60 phút', body: 'Buổi học của bạn sẽ bắt đầu sau 60 phút.', channelId: 'schedule' };
      }
      if (offset === 15) {
        return { title: 'Lịch học sau 15 phút', body: 'Hãy chuẩn bị vào lớp, buổi học bắt đầu sau 15 phút.', channelId: 'schedule' };
      }
      if (data.isLive) {
        return { title: 'Buổi học đang bắt đầu', body: 'Đã đến giờ vào lớp học trực tuyến.', channelId: 'schedule' };
      }
      return { title: 'Nhắc lịch học', body: 'Bạn sắp có lịch học.', channelId: 'default' };
    }
    case 'schedule:new':
      return { title: 'Lịch học mới', body: 'Bạn có lịch học mới được cập nhật.', channelId: 'schedule' };
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
      if (type === 'SYSTEM' && (data.title || data.content)) {
        return {
          title: String(data.title || 'Thông báo từ trung tâm').slice(0, 100),
          body: String(data.content || 'Bạn có thông báo từ quản trị viên.').slice(0, 240),
          channelId: 'default',
        };
      }
      const titles = {
        SCHEDULE: 'Cập nhật lịch học',
        QUIZ: 'Bài kiểm tra mới',
        FINANCE: 'Thông báo tài chính',
        COURSE: 'Thông báo khóa học',
        EVALUATION: 'Thông báo đánh giá',
        EXAM: 'Thông báo kỳ thi',
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

function preferenceKeyForEvent(eventName, data = {}) {
  switch (eventName) {
    case 'class:reminder':
    case 'class:started':
      return 'scheduleReminders';
    case 'schedule:new':
    case 'schedule:updated':
    case 'schedule:cancelled':
      return 'scheduleChanges';
    case 'message:receive':
      return 'messages';
    case 'call:incoming':
    case 'call:missed':
      return 'calls';
    case 'quiz:assigned':
    case 'assignment:new':
    case 'assignment:deadline':
    case 'assignment:graded':
      return 'assignmentsAndQuizzes';
    case 'notification': {
      const type = String(data.type || '').toUpperCase();
      if (type === 'SCHEDULE') return 'scheduleChanges';
      if (type === 'FINANCE' || type === 'COURSE') return 'financeAndCourses';
      if (type === 'QUIZ' || type === 'EXAM' || type === 'EVALUATION' || type === 'ASSIGNMENT') return 'assignmentsAndQuizzes';
      return 'adminAnnouncements';
    }
    default:
      return null;
  }
}

function shouldDeliverToDevice(device, eventName, data = {}) {
  const prefs = device?.preferences;
  if (!prefs || typeof prefs !== 'object') return true;
  const prefKey = preferenceKeyForEvent(eventName, data);
  if (prefKey && prefs[prefKey] === false) {
    return false;
  }
  if (eventName === 'class:reminder' && data.offsetMinutes != null && Array.isArray(prefs.reminderOffsetsMinutes)) {
    const offset = Number(data.offsetMinutes);
    if ([1440, 60, 15].includes(offset) && !prefs.reminderOffsetsMinutes.includes(offset)) {
      return false;
    }
  }
  return true;
}

function resolveNotificationCategoryAndLink(eventName, data = {}) {
  const type = String(data.type || '').toUpperCase();
  if (eventName === 'call:incoming' || eventName === 'call:missed') {
    return { category: 'calls', deepLink: 'thangtinhoc://notifications' };
  }
  if (eventName === 'message:receive') {
    const cid = String(data.conversationId || '');
    return {
      category: 'message',
      deepLink: cid ? `thangtinhoc://messages/${encodeURIComponent(cid)}` : 'thangtinhoc://messages',
    };
  }
  if (
    eventName === 'class:reminder'
    || eventName === 'class:started'
    || eventName.startsWith('schedule:')
    || type === 'SCHEDULE'
  ) {
    const sid = String(data.scheduleId || data.payload?.scheduleId || '');
    return {
      category: 'schedule',
      deepLink: sid ? `thangtinhoc://schedule?focusScheduleId=${encodeURIComponent(sid)}` : 'thangtinhoc://schedule',
    };
  }
  if (eventName.startsWith('assignment:') || type === 'ASSIGNMENT') {
    const aid = String(data.assignmentId || data.payload?.assignmentId || '');
    return {
      category: 'default',
      deepLink: aid ? `thangtinhoc://assignments/${encodeURIComponent(aid)}` : 'thangtinhoc://assignments',
    };
  }
  if (eventName === 'quiz:assigned' || type === 'EXAM' || type === 'QUIZ') {
    const qid = String(data.quizId || data.payload?.quizId || '');
    return {
      category: 'default',
      deepLink: qid ? `thangtinhoc://exam/${encodeURIComponent(qid)}` : 'thangtinhoc://notifications',
    };
  }
  if (type === 'FINANCE') {
    return { category: 'default', deepLink: 'thangtinhoc://tuition' };
  }
  if (type === 'COURSE') {
    return { category: 'default', deepLink: 'thangtinhoc://courses' };
  }
  return { category: 'default', deepLink: 'thangtinhoc://notifications' };
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
  const { category, deepLink } = resolveNotificationCategoryAndLink(eventName, data);
  const pushData = {
    event: eventName,
    category,
    deepLink,
  };
  if (data.notificationId) pushData.notificationId = String(data.notificationId);
  if (data.scheduleId || data.payload?.scheduleId) pushData.scheduleId = String(data.scheduleId || data.payload?.scheduleId);
  if (data.conversationId || data.payload?.conversationId) pushData.conversationId = String(data.conversationId || data.payload?.conversationId);
  if (data.assignmentId || data.payload?.assignmentId) pushData.assignmentId = String(data.assignmentId || data.payload?.assignmentId);
  if (data.quizId || data.payload?.quizId) pushData.quizId = String(data.quizId || data.payload?.quizId);
  if (data.offsetMinutes != null) pushData.offsetMinutes = Number(data.offsetMinutes);

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
  if (typeof data.badge === 'number' && Number.isFinite(data.badge) && data.badge >= 0) {
    message.badge = data.badge;
  }
  if (device.soundEnabled) message.sound = 'default';
  return message;
}

async function sendToDevices(devices, notification, eventName, data) {
  const eligible = (devices || []).filter((device) => shouldDeliverToDevice(device, eventName, data));
  if (!eligible.length) return;
  await postMessages(eligible.map((device) => makePushMessage(device, notification, eventName, data)));
}

function dispatchToUser(role, userId, eventName, data = {}) {
  const notification = buildEventNotification(eventName, data);
  if (!notification || !userId || !['student', 'teacher'].includes(String(role))) return Promise.resolve(false);
  const dedupKey = buildDedupKey(`${role}:${userId}`, eventName, data);
  if (dedupKey && shouldDeduplicate(dedupKey, eventName === 'class:reminder' ? 90_000 : 20_000)) {
    return Promise.resolve(false);
  }
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

function dispatchToReceivers(receivers, notificationData = {}) {
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

  const dedupKey = buildDedupKey([...userIds, ...roles].sort().join(','), 'notification', notificationData);
  if (dedupKey && shouldDeduplicate(dedupKey, 20_000)) return;

  MobilePushToken.find({ enabled: true, $or: targets })
    .lean()
    .then((devices) => sendToDevices(devices, notification, 'notification', notificationData))
    .catch((error) => logDispatchError(error, 'notification'));
}

function revokeScheduleReminders(io, { scheduleId, userIds = [] } = {}) {
  const sid = String(scheduleId || '');
  if (!sid) return;
  for (const offset of [1440, 60, 15]) {
    for (const uid of userIds) {
      if (!uid) continue;
      DEDUP_CACHE.delete(`student:${uid}:class:reminder:${sid}:${offset}`);
      DEDUP_CACHE.delete(`teacher:${uid}:class:reminder:${sid}:${offset}`);
    }
  }
  if (io) {
    for (const uid of userIds) {
      if (uid) io.to(String(uid)).emit('schedule:reminder-revoked', { scheduleId: sid });
    }
  }
}

module.exports = {
  buildEventNotification,
  dispatchToReceivers,
  dispatchToUser,
  makePushMessage,
  preferenceKeyForEvent,
  revokeScheduleReminders,
  shouldDeliverToDevice,
  shouldDeduplicate,
  _test: { DEDUP_CACHE },
};
