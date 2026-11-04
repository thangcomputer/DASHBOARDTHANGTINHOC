import { mobileApiRequest } from './apiClient';

export type TeacherPaymentNotice = {
  id: string;
  teacherId: string;
  amount: number;
  sessions: number;
  starBonusAmount: number;
  description: string;
  month: string;
  confirmedAt: string | null;
};

function toNotice(raw: unknown): TeacherPaymentNotice | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;
  return {
    id,
    teacherId: typeof row.teacherId === 'string' ? row.teacherId : '',
    amount: Number(row.amount) || 0,
    sessions: Number(row.sessions) || 0,
    starBonusAmount: Number(row.starBonusAmount) || 0,
    description: typeof row.description === 'string' ? row.description : '',
    month: typeof row.month === 'string' ? row.month : '',
    confirmedAt: typeof row.confirmedAt === 'string' ? row.confirmedAt : null,
  };
}

export function parseTeacherPaymentNotice(raw: unknown) {
  return toNotice(raw);
}

/** Các phiếu lương đã chi mà GV chưa xem popup (dùng chung API với web). */
export async function getTeacherPaymentNotices(): Promise<TeacherPaymentNotice[]> {
  const payload = await mobileApiRequest<{ data?: unknown[] }>('/transactions/me/payment-notices');
  return (Array.isArray(payload.data) ? payload.data : [])
    .map(toNotice)
    .filter((notice): notice is TeacherPaymentNotice => notice !== null);
}

export async function markTeacherPaymentNoticeSeen(id: string) {
  await mobileApiRequest(`/transactions/${encodeURIComponent(id)}/payment-notice-seen`, { method: 'PUT' });
}
