import { DeviceEventEmitter } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getMobileApiBaseUrl } from './apiClient';

export const SOCKET_EVENTS = {
  MESSAGE_RECEIVED: 'socket:message:received',
  MESSAGE_SENT_ACK: 'socket:message:sent',
  MESSAGE_SEND_ERROR: 'socket:message:send-error',
  MESSAGE_REACTION: 'socket:message:reaction',
  MESSAGE_RECALLED: 'socket:message:recalled',
  MESSAGE_DELETED: 'socket:message:deleted',
  MESSAGE_PINNED: 'socket:message:pinned',
  TYPING_CHANGE: 'socket:typing',
  ONLINE_USERS: 'socket:online_users',
  LAST_SEEN_USERS: 'socket:last_seen_users',
  NOTIFICATION: 'socket:notification',
  DATA_REFRESH: 'socket:data_refresh',
  SCHEDULE_NEW: 'socket:schedule:new',
  SCHEDULE_UPDATED: 'socket:schedule:updated',
  SCHEDULE_CANCELLED: 'socket:schedule:cancelled',
  GROUP_NEW: 'socket:group:new',
  GROUP_DELETE: 'socket:group:delete',
  CONTACT_UPDATED: 'socket:contact:updated',
  READ_ACK: 'socket:read:ack',
  CONNECTED: 'socket:connected',
  DISCONNECTED: 'socket:disconnected',
  ERROR: 'socket:error',
  CALL_INCOMING: 'socket:call:incoming',
  CALL_CHECKING: 'socket:call:checking',
  CALL_RINGING: 'socket:call:ringing',
  CALL_ACCEPTED: 'socket:call:accepted',
  CALL_REJECTED: 'socket:call:rejected',
  CALL_OFFER: 'socket:call:offer',
  CALL_ANSWER: 'socket:call:answer',
  CALL_ICE: 'socket:call:ice',
  CALL_ENDED: 'socket:call:ended',
  CALL_TIMEOUT: 'socket:call:timeout',
  CALL_ERROR: 'socket:call:error',
  CALL_HISTORY_UPDATED: 'socket:call:history-updated',
  ATTENDANCE_AWAITING_CONFIRM: 'socket:attendance:awaiting-confirm',
  ATTENDANCE_DISPUTED: 'socket:attendance:disputed',
  ATTENDANCE_CONFIRMED: 'socket:attendance:confirmed',
  ATTENDANCE_REJECTED: 'socket:attendance:rejected',
  ATTENDANCE_ADMIN_MAKEUP_COMPLETED: 'socket:attendance:admin-makeup-completed',
  FINANCE_TRANSACTION: 'socket:finance:transaction',
  LMS_QA_UPDATED: 'socket:lms_qa:updated',
  QUIZ_SUBMITTED: 'socket:quiz:submitted',
  QUIZ_CHANGED: 'socket:quiz:changed',
  ASSIGNMENT_CHANGED: 'socket:assignment:changed',
  SUBMISSION_CHANGED: 'socket:submission:changed',
  STUDENT_CHANGED: 'socket:student:changed',
  AI_SUPPORT_STATUS: 'socket:ai-support:status',
} as const;

let socket: Socket | null = null;
let currentToken = '';
let currentUserId = '';
let currentRole = '';
let onlineUsersSnapshot: unknown[] = [];
let lastSeenUsersSnapshot: Record<string, string> = {};
let notificationSignalTimeout: ReturnType<typeof setTimeout> | null = null;
let notificationSignalPayload: unknown;

function queueNotificationSignal(data?: unknown) {
  if (data !== undefined) notificationSignalPayload = data;
  if (notificationSignalTimeout) clearTimeout(notificationSignalTimeout);
  notificationSignalTimeout = setTimeout(() => {
    notificationSignalTimeout = null;
    emitDeviceEvent(SOCKET_EVENTS.NOTIFICATION, notificationSignalPayload);
    notificationSignalPayload = undefined;
  }, 80);
}

function clearNotificationSignal() {
  if (notificationSignalTimeout) clearTimeout(notificationSignalTimeout);
  notificationSignalTimeout = null;
  notificationSignalPayload = undefined;
}

export function getOnlineUsersSnapshot() {
  return onlineUsersSnapshot;
}

export function getLastSeenUsersSnapshot() {
  return lastSeenUsersSnapshot;
}

function emitDeviceEvent(name: string, data?: unknown) {
  DeviceEventEmitter.emit(name, data);
}

function bindSocketEvents(instance: Socket, token: string) {
  instance.on('connect', () => {
    instance.emit('register', {});
    emitDeviceEvent(SOCKET_EVENTS.CONNECTED, {});
  });
  instance.on('disconnect', (reason) => {
    onlineUsersSnapshot = [];
    emitDeviceEvent(SOCKET_EVENTS.ONLINE_USERS, onlineUsersSnapshot);
    emitDeviceEvent(SOCKET_EVENTS.DISCONNECTED, { reason });
  });
  instance.on('connect_error', (error: Error) => emitDeviceEvent(SOCKET_EVENTS.ERROR, { message: error.message }));
  instance.on('auth:session-replaced', () => emitDeviceEvent('mobile:session-replaced', { token }));
  instance.on('message:receive', (data) => emitDeviceEvent(SOCKET_EVENTS.MESSAGE_RECEIVED, data));
  instance.on('message:sent', (data) => emitDeviceEvent(SOCKET_EVENTS.MESSAGE_SENT_ACK, data));
  instance.on('message:error', (data) => emitDeviceEvent(SOCKET_EVENTS.MESSAGE_SEND_ERROR, data));
  instance.on('message:reaction', (data) => emitDeviceEvent(SOCKET_EVENTS.MESSAGE_REACTION, data));
  instance.on('message:recall', (data) => emitDeviceEvent(SOCKET_EVENTS.MESSAGE_RECALLED, data));
  instance.on('message:delete', (data) => emitDeviceEvent(SOCKET_EVENTS.MESSAGE_DELETED, data));
  instance.on('message:pinned', (data) => emitDeviceEvent(SOCKET_EVENTS.MESSAGE_PINNED, data));
  instance.on('ai-support:status', (data) => emitDeviceEvent(SOCKET_EVENTS.AI_SUPPORT_STATUS, data));
  instance.on('message:read_ack', (data) => emitDeviceEvent(SOCKET_EVENTS.READ_ACK, data));
  instance.on('typing:show', (data) => emitDeviceEvent(SOCKET_EVENTS.TYPING_CHANGE, { ...(data as object), isTyping: true }));
  instance.on('typing:hide', (data) => emitDeviceEvent(SOCKET_EVENTS.TYPING_CHANGE, { ...(data as object), isTyping: false }));
  instance.on('users:online', (data) => {
    onlineUsersSnapshot = Array.isArray(data) ? data : [];
    emitDeviceEvent(SOCKET_EVENTS.ONLINE_USERS, onlineUsersSnapshot);
  });
  instance.on('users:lastSeen', (data) => {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      lastSeenUsersSnapshot = { ...lastSeenUsersSnapshot, ...(data as Record<string, string>) };
      emitDeviceEvent(SOCKET_EVENTS.LAST_SEEN_USERS, lastSeenUsersSnapshot);
    }
  });
  instance.on('RECEIVE_NOTIFICATION', queueNotificationSignal);
  instance.on('new-notification', queueNotificationSignal);
  instance.on('lms_qa:updated', (data) => emitDeviceEvent(SOCKET_EVENTS.LMS_QA_UPDATED, data));
  instance.on('quiz:submitted', (data) => emitDeviceEvent(SOCKET_EVENTS.QUIZ_SUBMITTED, data));
  instance.on('quiz:changed', (data) => emitDeviceEvent(SOCKET_EVENTS.QUIZ_CHANGED, data));
  for (const eventName of ['student:new', 'student:assigned', 'student:updated', 'student:history_reset', 'exam:locked', 'exam:unlocked']) {
    instance.on(eventName, (data) => emitDeviceEvent(SOCKET_EVENTS.STUDENT_CHANGED, data));
  }
  for (const eventName of ['assignment:new', 'assignment:updated', 'assignment:deleted']) {
    instance.on(eventName, (data) => emitDeviceEvent(SOCKET_EVENTS.ASSIGNMENT_CHANGED, data));
  }
  for (const eventName of ['submission:new', 'submission:graded']) {
    instance.on(eventName, (data) => emitDeviceEvent(SOCKET_EVENTS.SUBMISSION_CHANGED, data));
  }
  instance.on('group:new', (data) => emitDeviceEvent(SOCKET_EVENTS.GROUP_NEW, data));
  instance.on('group:deleted', (data) => emitDeviceEvent(SOCKET_EVENTS.GROUP_DELETE, data));
  instance.on('CONTACT_LIST_UPDATED', (data) => emitDeviceEvent(SOCKET_EVENTS.CONTACT_UPDATED, data));
  instance.on('data:refresh', (data) => emitDeviceEvent(SOCKET_EVENTS.DATA_REFRESH, data));
  instance.on('schedule:new', (data) => emitDeviceEvent(SOCKET_EVENTS.SCHEDULE_NEW, data));
  instance.on('schedule:updated', (data) => emitDeviceEvent(SOCKET_EVENTS.SCHEDULE_UPDATED, data));
  instance.on('schedule:cancelled', (data) => emitDeviceEvent(SOCKET_EVENTS.SCHEDULE_CANCELLED, data));
  instance.on('attendance:awaiting-confirm', (data) => emitDeviceEvent(SOCKET_EVENTS.ATTENDANCE_AWAITING_CONFIRM, data));
  instance.on('attendance:disputed', (data) => emitDeviceEvent(SOCKET_EVENTS.ATTENDANCE_DISPUTED, data));
  instance.on('attendance:confirmed', (data) => emitDeviceEvent(SOCKET_EVENTS.ATTENDANCE_CONFIRMED, data));
  instance.on('attendance:rejected', (data) => emitDeviceEvent(SOCKET_EVENTS.ATTENDANCE_REJECTED, data));
  instance.on('attendance:admin-makeup-completed', (data) => emitDeviceEvent(SOCKET_EVENTS.ATTENDANCE_ADMIN_MAKEUP_COMPLETED, data));
  instance.on('transactions:new', (data) => emitDeviceEvent(SOCKET_EVENTS.FINANCE_TRANSACTION, data));
  instance.on('teacher:financeUpdated', (data) => emitDeviceEvent(SOCKET_EVENTS.FINANCE_TRANSACTION, data));
  const callEvents = [
    ['call:incoming', SOCKET_EVENTS.CALL_INCOMING],
    ['call:checking', SOCKET_EVENTS.CALL_CHECKING],
    ['call:ringing', SOCKET_EVENTS.CALL_RINGING],
    ['call:accepted', SOCKET_EVENTS.CALL_ACCEPTED],
    ['call:rejected', SOCKET_EVENTS.CALL_REJECTED],
    ['call:offer', SOCKET_EVENTS.CALL_OFFER],
    ['call:answer', SOCKET_EVENTS.CALL_ANSWER],
    ['call:ice', SOCKET_EVENTS.CALL_ICE],
    ['call:ended', SOCKET_EVENTS.CALL_ENDED],
    ['call:timeout', SOCKET_EVENTS.CALL_TIMEOUT],
    ['call:error', SOCKET_EVENTS.CALL_ERROR],
  ] as const;
  const historyChangingEvents = new Set<string>([
    SOCKET_EVENTS.CALL_INCOMING,
    SOCKET_EVENTS.CALL_CHECKING,
    SOCKET_EVENTS.CALL_RINGING,
    SOCKET_EVENTS.CALL_ACCEPTED,
    SOCKET_EVENTS.CALL_REJECTED,
    SOCKET_EVENTS.CALL_ENDED,
    SOCKET_EVENTS.CALL_TIMEOUT,
    SOCKET_EVENTS.CALL_ERROR,
  ]);
  for (const [socketEvent, deviceEvent] of callEvents) {
    instance.on(socketEvent, (data) => {
      emitDeviceEvent(deviceEvent, data);
      if (historyChangingEvents.has(deviceEvent)) {
        setTimeout(() => emitDeviceEvent(SOCKET_EVENTS.CALL_HISTORY_UPDATED, data), 250);
      }
    });
  }
}

export function connect(token: string, userId: string, role: string) {
  if (!token || !userId || !role) return;
  if (socket?.active && currentToken === token && currentUserId === userId) return;
  if (currentUserId && currentUserId !== userId) {
    onlineUsersSnapshot = [];
    lastSeenUsersSnapshot = {};
  }
  if (socket) {
    clearNotificationSignal();
    socket.removeAllListeners();
    socket.disconnect();
  }
  currentToken = token;
  currentUserId = userId;
  currentRole = role;
  let baseUrl: string;
  try {
    baseUrl = getMobileApiBaseUrl();
  } catch (error) {
    emitDeviceEvent(SOCKET_EVENTS.ERROR, {
      message: error instanceof Error ? error.message : 'Chưa cấu hình địa chỉ máy chủ nhắn tin.',
    });
    return;
  }
  socket = io(baseUrl, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    timeout: 20000,
  });
  bindSocketEvents(socket, token);
}

export function disconnect() {
  clearNotificationSignal();
  currentToken = '';
  currentUserId = '';
  currentRole = '';
  onlineUsersSnapshot = [];
  lastSeenUsersSnapshot = {};
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function emit(event: string, data?: unknown) {
  if (!socket?.connected) return false;
  socket.emit(event, data);
  return true;
}

export function waitForConnection(timeoutMs = 10_000) {
  if (socket?.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let connectedSubscription: { remove: () => void } | null = null;
    let errorSubscription: { remove: () => void } | null = null;
    const timeout = setTimeout(() => finish(new Error('Hết thời gian kết nối máy chủ cuộc gọi.')), timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      connectedSubscription?.remove();
      errorSubscription?.remove();
    };
    const finish = (error?: Error) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    connectedSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.CONNECTED, () => finish());
    errorSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.ERROR, (error: { message?: string }) => {
      finish(new Error(error?.message || 'Không thể kết nối máy chủ cuộc gọi.'));
    });
    if (socket?.connected) finish();
  });
}

export function joinChatGroup(groupId: string) {
  if (groupId) emit('group:join', { groupId });
}

export function leaveChatGroup(groupId: string) {
  if (groupId) emit('group:leave', { groupId });
}

export function emitTypingStart(conversationId: string, userName: string) {
  emit('typing:start', { conversationId, userName });
}

export function emitTypingStop(conversationId: string) {
  emit('typing:stop', { conversationId });
}

export function emitMessageRead(conversationId: string) {
  emit('message:read', { conversationId });
}

export function getIsConnected() {
  return Boolean(socket?.connected);
}

export function getSocketIdentity() {
  return { userId: currentUserId, role: currentRole };
}
