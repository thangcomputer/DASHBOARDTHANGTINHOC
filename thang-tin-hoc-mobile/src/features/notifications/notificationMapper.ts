import type { AppNotification } from '../../types';

export type BackendNotification = {
  _id?: string;
  id?: string;
  type?: string;
  title?: string;
  content?: string;
  message?: string;
  createdAt?: string;
  time?: string;
  read?: boolean;
  payload?: unknown;
  path?: string;
};

const categoryLabels: Record<string, string> = {
  SYSTEM: 'Hệ thống',
  COURSE: 'Khóa học',
  FINANCE: 'Tài chính',
  EVALUATION: 'Đánh giá',
  MESSAGE: 'Tin nhắn',
  EXAM: 'Thi',
  SCHEDULE: 'Lịch dạy',
};

function formatNotificationTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapPayload(payload: unknown): AppNotification['payload'] {
  if (!isRecord(payload)) return {};
  const mapped: NonNullable<AppNotification['payload']> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      mapped[key] = value;
    }
  }
  return mapped;
}

export function mapBackendNotification(value: unknown): AppNotification {
  if (!isRecord(value)) throw new Error('Notifications API returned an invalid notification item.');
  const raw = value as BackendNotification;
  const id = String(raw.id || raw._id || '').trim();
  if (!id) throw new Error('Notifications API returned an item without an ID.');
  const type = String(raw.type || '').trim().toUpperCase();
  const title = String(raw.title || '').trim();
  const message = String(raw.content || raw.message || '').trim();
  return {
    id,
    title,
    message,
    time: formatNotificationTime(raw.createdAt || raw.time),
    category: categoryLabels[type] || 'Khác',
    type,
    targetPath: raw.path || undefined,
    payload: mapPayload(raw.payload),
    unread: raw.read !== true,
  };
}

export function notificationTypeForCategory(category: string) {
  const entry = Object.entries(categoryLabels).find(([, label]) => label === category);
  return entry?.[0];
}

export function notificationCategoryForType(type?: string) {
  const normalized = String(type || '').trim().toUpperCase();
  const aliases: Record<string, string> = {
    'LỊCH HỌC': 'Lịch dạy',
    'HỌC PHÍ': 'Tài chính',
    'BÀI TẬP': 'Khóa học',
    'BÀI KIỂM TRA': 'Thi',
    'TRUNG TÂM': 'Hệ thống',
    'TIN NHẮN': 'Tin nhắn',
    'TIN TỨC': 'Tin tức',
    ADMIN: 'Admin',
    'ĐÀO TẠO': 'Đào tạo',
    'THÔNG BÁO': 'Thông báo',
  };
  return categoryLabels[normalized] || aliases[normalized] || 'Khác';
}
