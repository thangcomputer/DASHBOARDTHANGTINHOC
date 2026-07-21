import { useCallback } from 'react';
import { playNotifySound } from '../utils/sound';
import { apiFetch } from '../services/api';
import { useSocket } from './SocketContext';

/**
 * Socket-backed notifications for DataProvider.
 */
export function useDataNotifications({ currentUser }) {
  const {
    notifications: socketNotifications,
    setNotifications: setSocketNotifications,
  } = useSocket();

  const addNotification = useCallback((userId, role, text, type = 'system', path = null) => {
    // Chỉ phát âm thanh nếu mình là người nhận
    if (String(userId) === String(currentUser?.id || currentUser?._id)) {
      playNotifySound();
    }
    setSocketNotifications(prev => [{
      id: Date.now(), userId, role, message: text, // Map to bell's expected 'message' key
      time: new Date().toISOString(), read: false, type, path,
      title: type === 'SYSTEM' ? 'Thông báo hệ thống' : 'Thông báo'
    }, ...prev]);
  }, [setSocketNotifications, currentUser]);

  const markNotificationRead = useCallback((notifId) => {
    setSocketNotifications(prev => prev.map(n => (!notifId || n.id === notifId || n._id === notifId) ? { ...n, read: true } : n));

    // Persist to server
    if (notifId) {
      apiFetch('/notifications/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notifId })
      }).catch(e => void 0);
    } else {
      apiFetch('/notifications/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true })
      }).catch(e => void 0);
    }
  }, [setSocketNotifications]);

  /** Ẩn khỏi chuông (local). Gọi API dismiss ở nơi dùng nếu cần. */
  const dismissNotificationLocal = useCallback((notifId) => {
    if (!notifId) return;
    setSocketNotifications((prev) =>
      (prev || []).filter((n) => String(n.id || n._id) !== String(notifId)),
    );
  }, [setSocketNotifications]);

  const getNotifications = useCallback((userId, role) => {
    return (socketNotifications || []).filter(n =>
      (String(n.userId) === String(userId) || !n.userId) && (n.role === role || !n.role)
    );
  }, [socketNotifications]);

  return {
    socketNotifications,
    setSocketNotifications,
    addNotification,
    markNotificationRead,
    dismissNotificationLocal,
    getNotifications,
  };
}
