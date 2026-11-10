import { mobileApiRequest } from './apiClient';

export type SubscriptionPlanId = '1m' | '3m' | '6m' | '12m' | 'lifetime';

export type StudentSubscription = {
  plan: SubscriptionPlanId;
  planLabel: string;
  expiresAt: string | null;
  state: 'lifetime' | 'active' | 'expiring' | 'expired';
  daysLeft: number | null;
  activated: boolean;
  meetLifetime?: boolean;
};

export type SubscriptionPlan = { id: SubscriptionPlanId; label: string; months: number | null; price: number };

export type SubscriptionHistoryRow = {
  id: string;
  source: 'code' | 'payment' | 'admin';
  plan: SubscriptionPlanId;
  planLabel: string;
  newExpiresAt: string | null;
  amount: number;
  createdAt: string;
};

export type SubscriptionOverview = {
  subscription: StudentSubscription;
  plans: SubscriptionPlan[];
  history: SubscriptionHistoryRow[];
};

export type SubscriptionCheckout = { sessionId: string; ref: string; amount: number; plan: SubscriptionPlanId; planLabel: string };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const payload = await mobileApiRequest<{ data?: T }>(
    `/subscription/my${path}`,
    body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) },
  );
  if (payload.data === undefined) throw new Error('Máy chủ không trả dữ liệu gói tài khoản');
  return payload.data;
}

/** Gói tài khoản HV - cùng API với web; dùng được cả khi đã hết hạn. */
export const subscriptionApi = {
  overview: () => call<SubscriptionOverview>(''),
  redeem: (code: string) => call<StudentSubscription & { redeemedPlanLabel?: string }>('/redeem', { code }),
  checkout: (plan: SubscriptionPlanId) => call<SubscriptionCheckout>('/checkout', { plan }),
  session: (sessionId: string) => call<{ paid: boolean; status: string }>(`/sessions/${encodeURIComponent(sessionId)}`),
  simulatePaid: (sessionId: string) => call<unknown>(`/sessions/${encodeURIComponent(sessionId)}/simulate-paid`, {}),
};

export function formatExpiryDate(iso: string | null | undefined) {
  if (!iso) return '';
  const date = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

export function subscriptionShortLabel(subscription: StudentSubscription | null | undefined) {
  if (!subscription) return '';
  if (subscription.state === 'lifetime') return 'Gói Vĩnh viễn';
  if (subscription.state === 'expired') {
    return subscription.activated ? `Đã hết hạn ${formatExpiryDate(subscription.expiresAt)}` : 'Chưa kích hoạt';
  }
  return `Hạn: ${formatExpiryDate(subscription.expiresAt)} · còn ${subscription.daysLeft} ngày`;
}

export function formatActivationCodeInput(value: string) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TTH/, '').slice(0, 8);
  if (!raw) return '';
  return raw.length > 4 ? `TTH-${raw.slice(0, 4)}-${raw.slice(4)}` : `TTH-${raw}`;
}
