import type { UserRole } from '../../types';
import type { AuthenticatedNotificationRequest, NotificationListOptions, NotificationPage } from './notificationApiRepository';
import {
  hideNotification as hideFromApi,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationApiRepository';
import { notificationMockRepository } from '../../services/mockService';
import { notificationTypeForCategory } from './notificationMapper';

export const isNotificationsApiEnabled =
  String(process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API || '').toLowerCase() === 'true';

function requireAuthenticatedRequest(request?: AuthenticatedNotificationRequest): AuthenticatedNotificationRequest {
  if (!request) {
    throw new Error('Notifications REST requires the authenticated mobile API client.');
  }
  return request;
}

function requireSuccessfulMutation(result: { success?: boolean }, operation: string) {
  if (result?.success !== true) {
    throw new Error(`Notifications API did not confirm ${operation}.`);
  }
}

export const notificationService = {
  async list(
    role: UserRole = 'student',
    options: NotificationListOptions = {},
    request?: AuthenticatedNotificationRequest,
  ): Promise<NotificationPage> {
    if (!isNotificationsApiEnabled) return notificationMockRepository.list(role, options);
    const normalizedOptions = {
      ...options,
      type: options.type || notificationTypeForCategory(options.category || ''),
    };
    return listNotifications(requireAuthenticatedRequest(request), normalizedOptions);
  },

  async markRead(role: UserRole, notificationId: string, request?: AuthenticatedNotificationRequest) {
    if (!isNotificationsApiEnabled) return notificationMockRepository.markRead(role, notificationId);
    requireSuccessfulMutation(
      await markNotificationRead(requireAuthenticatedRequest(request), notificationId),
      'mark read',
    );
    return { success: true };
  },

  async markAllRead(role: UserRole, request?: AuthenticatedNotificationRequest) {
    if (!isNotificationsApiEnabled) return notificationMockRepository.markAllRead(role);
    requireSuccessfulMutation(
      await markAllNotificationsRead(requireAuthenticatedRequest(request)),
      'mark all read',
    );
    return { success: true };
  },

  async hide(notificationId: string, request?: AuthenticatedNotificationRequest) {
    if (!isNotificationsApiEnabled) return { success: true };
    requireSuccessfulMutation(
      await hideFromApi(requireAuthenticatedRequest(request), notificationId),
      'hide notification',
    );
    return { success: true };
  },
};
