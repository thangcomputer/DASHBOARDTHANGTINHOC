import type { AppNotification } from '../../types';
import type { MobileAuthenticatedRequestOptions } from '../../services/mobileAuthService';
import { mapBackendNotification, notificationTypeForCategory } from './notificationMapper';

export type NotificationListOptions = {
  page?: number;
  limit?: number;
  type?: string;
  category?: string;
  unreadOnly?: boolean;
  readOnly?: boolean;
};

export type NotificationPage = {
  items: AppNotification[];
  unread: number;
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type AuthenticatedNotificationRequest = <T>(
  path: string,
  options?: MobileAuthenticatedRequestOptions,
) => Promise<T>;

type BackendListResponse = {
  success?: boolean;
  data?: unknown;
  unread?: number;
  pagination?: { page?: number; limit?: number; total?: number; pages?: number };
};

function requiredNonNegativeInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Notifications API returned an invalid ${field}.`);
  }
  return parsed;
}

function requiredPositiveInteger(value: unknown, field: string) {
  const parsed = requiredNonNegativeInteger(value, field);
  if (parsed === 0) throw new Error(`Notifications API returned an invalid ${field}.`);
  return parsed;
}

function buildListPath(options: NotificationListOptions, page = options.page || 1, limit = options.limit || 20) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const type = options.type || '';
  if (type) query.set('type', type);
  if (options.unreadOnly) query.set('unreadOnly', 'true');
  return `/api/notifications?${query.toString()}`;
}

async function fetchPage(
  request: AuthenticatedNotificationRequest,
  options: NotificationListOptions,
  page: number,
  limit: number,
): Promise<NotificationPage> {
  const result = await request<BackendListResponse>(buildListPath(options, page, limit));
  if (result?.success !== true || !Array.isArray(result.data)) {
    throw new Error('Notifications API returned an invalid list response.');
  }
  const pagination = result.pagination;
  if (!pagination) throw new Error('Notifications API returned an invalid pagination response.');
  return {
    items: result.data.map(mapBackendNotification),
    unread: requiredNonNegativeInteger(result.unread, 'unread count'),
    pagination: {
      page: requiredPositiveInteger(pagination.page, 'pagination page'),
      limit: requiredPositiveInteger(pagination.limit, 'pagination limit'),
      total: requiredNonNegativeInteger(pagination.total, 'pagination total'),
      pages: Math.max(1, requiredNonNegativeInteger(pagination.pages, 'pagination page count')),
    },
  };
}

export async function listNotifications(
  request: AuthenticatedNotificationRequest,
  options: NotificationListOptions = {},
): Promise<NotificationPage> {
  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit || 20)));

  const categoryType = options.type || notificationTypeForCategory(options.category || '');
  const needsClientFiltering = options.readOnly || (!!options.category && !categoryType);
  const requestOptions = { ...options, type: categoryType || undefined, readOnly: false };
  if (!needsClientFiltering) return fetchPage(request, requestOptions, page, limit);

  const firstPage = await fetchPage(request, requestOptions, 1, 100);
  const allItems = [...firstPage.items];
  for (let nextPage = 2; nextPage <= firstPage.pagination.pages; nextPage += 1) {
    const next = await fetchPage(request, requestOptions, nextPage, 100);
    allItems.push(...next.items);
  }
  const uniqueItems = [...new Map(
    allItems
      .filter((item) => !options.readOnly || !item.unread)
      .filter((item) => !options.category || item.category === options.category)
      .map((item) => [item.id, item]),
  ).values()];
  const pages = Math.max(1, Math.ceil(uniqueItems.length / limit));
  return {
    items: uniqueItems.slice((page - 1) * limit, page * limit),
    unread: firstPage.unread,
    pagination: { page, limit, total: uniqueItems.length, pages },
  };
}

export async function markNotificationRead(
  request: AuthenticatedNotificationRequest,
  notificationId: string,
) {
  return request<{ success: true }>('/api/notifications/mark-read', {
    method: 'PUT',
    body: { notificationId },
  });
}

export async function markAllNotificationsRead(request: AuthenticatedNotificationRequest) {
  return request<{ success: true }>('/api/notifications/mark-read', {
    method: 'PUT',
    body: { markAll: true },
  });
}

export async function hideNotification(
  request: AuthenticatedNotificationRequest,
  notificationId: string,
) {
  return request<{ success: true }>(`/api/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
  });
}
