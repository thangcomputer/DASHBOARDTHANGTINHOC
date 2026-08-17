import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { playMessageSound, playNotifySound } from '../utils/sound';
import { getMessagingRole, isMessageFromSelf } from '../lib/messagingRoles';
import { API_BASE, SOCKET_BASE, apiFetch } from '../services/api';

const SocketContext = createContext(null);
const SOCKET_URL = SOCKET_BASE;

/** Refresh events owned by SocketProvider (must off by same reference). */
const DATA_REFRESH_EVENTS = [
  'schedule:new', 'schedule:updated', 'schedule:completed', 'schedule:cancelled',
  'assignment:new', 'assignment:graded', 'assignment:submitted', 'assignment:updated', 'assignment:deleted',
  'teacher:updated', 'exam:unlocked',
  'student:new', 'student:assigned', 'student:history_reset',
  'submission:new', 'submission:graded',
  'transactions:new', 'teacher:financeUpdated', 'tuition:paid', 'revenue:updated',
  'teacher:scored', 'teacher:approved', 'teacher:practical_submitted', 'teacher:rejected', 'teacher:new',
  'evaluation:admin_feedback', 'evaluation:teacher_rating',
];

export const SocketProvider = ({ userId, role, name, token, adminRole, children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSeenUsers, setLastSeenUsers] = useState({});
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);
  const messageCallbacksRef = useRef(new Set());
  const messageSentCallbacksRef = useRef(new Set());
  const reactionCallbacksRef = useRef(new Set());
  const recallCallbacksRef = useRef(new Set());
  const groupNewCallbackRef = useRef(null);
  const dataRefreshCallbacksRef = useRef(new Set());
  const contactListUpdatedCallbackRef = useRef(null);
  const readAckCallbackRef = useRef(new Set());
  const typingCallbacksRef = useRef(new Set());

  const onTypingChange = useCallback((callback) => {
    typingCallbacksRef.current.add(callback);
    return () => typingCallbacksRef.current.delete(callback);
  }, []);

  const emitTypingStart = useCallback((conversationId, userName) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:start', { conversationId, userName });
    }
  }, []);

  const emitTypingStop = useCallback((conversationId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:stop', { conversationId });
    }
  }, []);

  const onMessageReceive = useCallback((callback) => {
    messageCallbacksRef.current.add(callback);
    return () => messageCallbacksRef.current.delete(callback);
  }, []);

  const onMessageSent = useCallback((callback) => {
    messageSentCallbacksRef.current.add(callback);
    return () => messageSentCallbacksRef.current.delete(callback);
  }, []);

  const onReactionReceive = useCallback((callback) => {
    reactionCallbacksRef.current.add(callback);
    return () => reactionCallbacksRef.current.delete(callback);
  }, []);

  const onRecallReceive = useCallback((callback) => {
    recallCallbacksRef.current.add(callback);
    return () => recallCallbacksRef.current.delete(callback);
  }, []);

  const onGroupNew = useCallback((callback) => {
    groupNewCallbackRef.current = callback;
    return () => {
      if (groupNewCallbackRef.current === callback) groupNewCallbackRef.current = null;
    };
  }, []);

  const onDataRefresh = useCallback((callback) => {
    dataRefreshCallbacksRef.current.add(callback);
    return () => dataRefreshCallbacksRef.current.delete(callback);
  }, []);

  const onContactListUpdated = useCallback((callback) => {
    contactListUpdatedCallbackRef.current = callback;
    return () => {
      if (contactListUpdatedCallbackRef.current === callback) {
        contactListUpdatedCallbackRef.current = null;
      }
    };
  }, []);

  const onReadAck = useCallback((callback) => {
    readAckCallbackRef.current.add(callback);
    return () => readAckCallbackRef.current.delete(callback);
  }, []);

  useEffect(() => {
    const resolveToken = () => {
      if (token) return token;
      for (const r of ['staff', 'admin', 'teacher', 'student']) {
        const direct = localStorage.getItem(`${r}_access_token`);
        if (direct) return direct;
        try {
          const u = JSON.parse(localStorage.getItem(`${r}_user`) || 'null');
          if (u?.accessToken || u?.token) return u.accessToken || u.token;
        } catch { /* noop */ }
      }
      return null;
    };

    const effectiveToken = resolveToken();
    const sessionUser = { id: userId, role, adminRole };

    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.4,
      timeout: 20000,
      auth: { token: effectiveToken },
    });

    let refreshDebounceTimer = null;
    const triggerRefresh = (data) => {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = setTimeout(() => {
        refreshDebounceTimer = null;
        dataRefreshCallbacksRef.current.forEach((cb) => cb(data));
      }, 320);
    };

    const pauseReconnectIfOffline = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        try { newSocket.io.opts.reconnection = false; } catch { /* ignore */ }
      }
    };
    const resumeReconnectIfOnline = () => {
      try {
        newSocket.io.opts.reconnection = true;
        if (!newSocket.connected) newSocket.connect();
      } catch { /* ignore */ }
    };

    const onBrowserOffline = () => {
      setIsConnected(false);
      pauseReconnectIfOffline();
      try {
        window.dispatchEvent(new CustomEvent('cms:connectivity', { detail: { online: false } }));
      } catch { /* ignore */ }
    };
    const onBrowserOnline = () => {
      resumeReconnectIfOnline();
      try {
        window.dispatchEvent(new CustomEvent('cms:connectivity', { detail: { online: true } }));
      } catch { /* ignore */ }
    };

    const onConnect = () => {
      setIsConnected(true);
      try {
        window.dispatchEvent(new CustomEvent('cms:connectivity', { detail: { online: true } }));
      } catch { /* ignore */ }

      if (userId && role && name) {
        newSocket.emit('register', { userId, role, name });
      }
      if (userId && role === 'student') {
        newSocket.emit('student:join', { studentId: userId });
      }
      if (userId && role === 'teacher') {
        newSocket.emit('teacher:join', { teacherId: userId });
      }
      if (role === 'admin' || role === 'staff') {
        newSocket.emit('admin:join');
      }
      try {
        window.dispatchEvent(new CustomEvent('cms:socket-reconnected'));
      } catch { /* ignore */ }
    };

    const onConnectError = () => {
      setIsConnected(false);
      pauseReconnectIfOffline();
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onUsersOnline = (users) => setOnlineUsers(users);
    const onUsersLastSeen = (map) => {
      setLastSeenUsers((prev) => ({ ...prev, ...map }));
    };

    const onMessageReceive = (data) => {
      if (!isMessageFromSelf(data, sessionUser)) {
        playMessageSound();
      }
      messageCallbacksRef.current.forEach((cb) => cb(data));
    };

    const onMessageSentEvt = (data) => {
      messageSentCallbacksRef.current.forEach((cb) => cb(data));
    };

    const onMessageReaction = (data) => {
      reactionCallbacksRef.current.forEach((cb) => cb(data));
    };

    const onMessageRecall = (data) => {
      recallCallbacksRef.current.forEach((cb) => cb(data));
    };

    const onMessageReadAck = (data) => {
      readAckCallbackRef.current.forEach((cb) => cb(data));
    };

    const onTypingShow = (data) => {
      typingCallbacksRef.current.forEach((cb) => cb({ ...data, show: true }));
    };
    const onTypingHide = (data) => {
      typingCallbacksRef.current.forEach((cb) => cb({ ...data, show: false }));
    };

    const onGroupNewEvt = (data) => {
      if (groupNewCallbackRef.current) groupNewCallbackRef.current(data);
    };

    const ignoredAnyEvents = new Set([
      'connect',
      'disconnect',
      'users:online',
      'users:lastSeen',
      'message:read_ack',
      'message:receive',
      'message:sent',
      'message:reaction',
      'message:recall',
    ]);
    const onAnyEvent = (eventName, payload) => {
      if (ignoredAnyEvents.has(eventName)) return;
      if (String(eventName || '').startsWith('message:')) return;
      triggerRefresh({ type: 'socket:any', eventName, payload });
    };

    const onReceiveNotification = (data) => {
      playNotifySound();
      setNotifications((prev) => [{ ...data, id: data._id || Date.now(), read: false }, ...prev]);
    };

    // Legacy signal: chỉ refresh danh sách unread — KHÔNG kêu (tránh double beep + beep nhầm cho Admin)
    const onNewNotification = () => {
      triggerRefresh({ type: 'notifications' });
      apiFetch('/notifications/unread')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setNotifications(data.data.map((n) => ({
              ...n,
              id: n._id,
              read: Array.isArray(n.read_by) && n.read_by.includes(String(userId)),
              message: n.content || n.message,
              time: n.createdAt || n.time,
            })));
          }
        })
        .catch(() => {});
    };

    const onClassReminder = (data) => {
      playNotifySound();
      setNotifications((prev) => [{
        id: Date.now(), read: false, type: 'reminder',
        ...data,
      }, ...prev]);
    };

    const onSystemReset = () => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login?msg=system_cleared';
    };

    const onContactListUpdated = (data) => {
      if (contactListUpdatedCallbackRef.current) {
        contactListUpdatedCallbackRef.current(data);
      }
    };

    const onPaymentConfirmed = (data) => {
      playNotifySound();
      setNotifications((prev) => [{
        id: Date.now(), read: false, type: 'payment',
        ...data,
      }, ...prev]);
      triggerRefresh({ type: 'payment' });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', onBrowserOffline);
      window.addEventListener('online', onBrowserOnline);
    }

    newSocket.on('connect', onConnect);
    newSocket.on('connect_error', onConnectError);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('users:online', onUsersOnline);
    newSocket.on('users:lastSeen', onUsersLastSeen);
    newSocket.on('message:receive', onMessageReceive);
    newSocket.on('message:sent', onMessageSentEvt);
    newSocket.on('message:reaction', onMessageReaction);
    newSocket.on('message:recall', onMessageRecall);
    newSocket.on('message:read_ack', onMessageReadAck);
    newSocket.on('typing:show', onTypingShow);
    newSocket.on('typing:hide', onTypingHide);
    newSocket.on('group:new', onGroupNewEvt);
    newSocket.on('data:refresh', triggerRefresh);
    newSocket.on('student:updated', triggerRefresh);
    DATA_REFRESH_EVENTS.forEach((ev) => newSocket.on(ev, triggerRefresh));
    newSocket.onAny(onAnyEvent);
    newSocket.on('RECEIVE_NOTIFICATION', onReceiveNotification);
    newSocket.on('new-notification', onNewNotification);
    newSocket.on('class:reminder', onClassReminder);
    newSocket.on('SYSTEM_RESET', onSystemReset);
    newSocket.on('CONTACT_LIST_UPDATED', onContactListUpdated);
    newSocket.on('payment:confirmed', onPaymentConfirmed);

    if (userId) {
      apiFetch('/notifications/unread')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setNotifications(data.data.map((n) => ({
              ...n,
              id: n._id,
              read: Array.isArray(n.read_by) && n.read_by.includes(String(userId)),
              message: n.content || n.message,
              time: n.createdAt || n.time,
            })));
          }
        })
        .catch(() => {});
    }

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', onBrowserOffline);
        window.removeEventListener('online', onBrowserOnline);
      }

      // Remove ONLY listeners owned by this effect (same function references).
      newSocket.off('connect', onConnect);
      newSocket.off('connect_error', onConnectError);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('users:online', onUsersOnline);
      newSocket.off('users:lastSeen', onUsersLastSeen);
      newSocket.off('message:receive', onMessageReceive);
      newSocket.off('message:sent', onMessageSentEvt);
      newSocket.off('message:reaction', onMessageReaction);
      newSocket.off('message:recall', onMessageRecall);
      newSocket.off('message:read_ack', onMessageReadAck);
      newSocket.off('typing:show', onTypingShow);
      newSocket.off('typing:hide', onTypingHide);
      newSocket.off('group:new', onGroupNewEvt);
      newSocket.off('data:refresh', triggerRefresh);
      newSocket.off('student:updated', triggerRefresh);
      DATA_REFRESH_EVENTS.forEach((ev) => newSocket.off(ev, triggerRefresh));
      newSocket.offAny(onAnyEvent);
      newSocket.off('RECEIVE_NOTIFICATION', onReceiveNotification);
      newSocket.off('new-notification', onNewNotification);
      newSocket.off('class:reminder', onClassReminder);
      newSocket.off('SYSTEM_RESET', onSystemReset);
      newSocket.off('CONTACT_LIST_UPDATED', onContactListUpdated);
      newSocket.off('payment:confirmed', onPaymentConfirmed);

      if (socketRef.current === newSocket) socketRef.current = null;
      try { newSocket.io.opts.reconnection = false; } catch { /* ignore */ }
      if (newSocket.connected) newSocket.disconnect();
      else {
        try { newSocket.close(); } catch { /* ignore */ }
      }
    };
  }, [userId, role, name, token, adminRole]);

  const sendMessage = useCallback((data) => {
    if (socketRef.current) socketRef.current.emit('message:send', data);
  }, []);

  const markRead = useCallback((conversationId) => {
    if (socketRef.current) {
      socketRef.current.emit('message:read', { conversationId, readerId: userId });
    }
  }, [userId]);

  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const joinGroupChat = useCallback((groupId) => {
    if (socketRef.current) socketRef.current.emit('group:join', groupId);
  }, []);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    lastSeenUsers,
    notifications,
    sendMessage,
    markRead,
    clearNotification,
    setNotifications,
    onMessageReceive,
    onMessageSent,
    onReactionReceive,
    onRecallReceive,
    onGroupNew,
    onDataRefresh,
    onContactListUpdated,
    onReadAck,
    onTypingChange,
    emitTypingStart,
    emitTypingStop,
    joinGroupChat,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    return {
      socket: null,
      isConnected: false,
      onlineUsers: [],
      notifications: [],
      sendMessage: () => {},
      markRead: () => {},
      clearNotification: () => {},
      setNotifications: () => {},
      onMessageReceive: () => () => {},
      onMessageSent: () => () => {},
      onReactionReceive: () => () => {},
      onDataRefresh: () => () => {},
    };
  }
  return ctx;
};

export default SocketContext;
