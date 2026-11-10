import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlarmClock, CalendarX2, Loader2, LogOut, X } from 'lucide-react';
import api, { clearTokens } from '../../../services/api';
import subscriptionApi from '../../../services/subscriptionApi';
import { clearStorageKeepingPreferences } from '../../../utils/logoutStorage';
import { hasBlockingLoginOverlay, setLoginOverlay, subscribeLoginOverlays } from '../../../utils/loginOverlayGate';
import {
  SUBSCRIPTION_EXPIRED_EVENT, formatExpiryDate, reminderMilestoneKey, reminderStorageKey,
} from '../../../utils/subscription';
import SubscriptionRenewPanel from './SubscriptionRenewPanel';
import { SubscriptionContext, useStudentSubscription } from './subscriptionContext';

async function logoutToLogin() {
  try { await api.auth.logout(); } catch { /* ignore */ }
  clearTokens('student');
  clearStorageKeepingPreferences();
  window.location.replace('/login');
}

function RenewModal({ overview, onClose, onRenewed }) {
  return createPortal(
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/55 p-2.5 sm:p-4 backdrop-blur-[2px]" role="presentation">
      <div className="flex max-h-[92dvh] w-full max-w-3xl lg:max-w-4xl flex-col overflow-hidden rounded-[22px] sm:rounded-[26px] bg-white shadow-2xl border border-slate-100" role="dialog" aria-modal="true" aria-label="Gia hạn tài khoản">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 sm:px-5 sm:py-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900">Gói học Meet</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1 sm:p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none"><X size={17} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-5">
          <SubscriptionRenewPanel overview={overview} onRenewed={onRenewed} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Trang tự học: hết hạn thì hiện bảng gói, layout chat/lịch vẫn ở ngoài. Tài khoản miễn phí vẫn vào luyện tập. */
export function SelfStudyLock({ children, allowWhenExpired = false }) {
  const ctx = useStudentSubscription();
  if (allowWhenExpired || ctx?.subscription?.state !== 'expired') return children;
  return <ExpiredScreen overview={ctx.overview} onRenewed={ctx.refresh} />;
}

function ExpiredScreen({ overview, onRenewed }) {
  const subscription = overview?.subscription;
  const neverActivated = subscription && !subscription.activated;
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-red-50 via-white to-amber-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col items-center gap-3 rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-red-100">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-red-700 text-white shadow-lg">
            <CalendarX2 size={30} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
            {neverActivated ? 'Tài khoản chưa được kích hoạt' : 'Tài khoản đã hết hạn'}
          </h1>
          <p className="max-w-xl text-sm text-slate-600">
            {neverActivated
              ? 'Nhập mã kích hoạt trung tâm cấp hoặc chọn gói để bắt đầu học.'
              : `Gói tự học đã hết hạn ngày ${formatExpiryDate(subscription?.expiresAt)}. Gia hạn để luyện tập, xem video và nhờ giáo viên hỗ trợ. Tiến độ học vẫn giữ. Lịch học, chat và link lớp vẫn dùng được.`}
          </p>
          <button type="button" onClick={logoutToLogin} className="cms-btn cms-btn-outline !py-2 text-sm">
            <LogOut size={15} aria-hidden="true" /> Đăng xuất
          </button>
        </div>
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <SubscriptionRenewPanel overview={overview} onRenewed={onRenewed} />
        </div>
      </div>
    </div>
  );
}

function ExpiringReminder({ subscription, studentId, onRenew }) {
  const [open, setOpen] = useState(false);
  const milestoneKey = reminderMilestoneKey(subscription);

  useEffect(() => {
    if (!milestoneKey) return undefined;
    try {
      if (localStorage.getItem(reminderStorageKey(studentId)) === milestoneKey) return undefined;
    } catch { /* ignore */ }
    let timer = null;
    const tryOpen = () => {
      if (hasBlockingLoginOverlay(['subscription-reminder'])) return;
      setOpen(true);
    };
    timer = window.setTimeout(tryOpen, 2500);
    const unsubscribe = subscribeLoginOverlays(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tryOpen, 1200);
    });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [milestoneKey, studentId]);

  useEffect(() => {
    setLoginOverlay('subscription-reminder', open);
    return () => setLoginOverlay('subscription-reminder', false);
  }, [open]);

  if (!open || !milestoneKey) return null;
  const lastDay = Number(subscription.daysLeft) <= 1;
  // "Để sau" / "Gia hạn ngay": mốc này coi như đã nhắc; mốc kế tiếp (ngày cuối) vẫn nhắc.
  const close = () => {
    try { localStorage.setItem(reminderStorageKey(studentId), milestoneKey); } catch { /* ignore */ }
    setOpen(false);
  };
  return createPortal(
    <div className="fixed inset-0 z-[9450] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div className="w-full max-w-sm overflow-hidden rounded-[24px] bg-white text-center shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="sub-reminder-title">
        <div className="bg-gradient-to-br from-amber-50 via-white to-red-50 px-6 pb-4 pt-6">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-amber-400 to-orange-600 text-white shadow-lg">
            <AlarmClock size={26} aria-hidden="true" />
          </span>
          <h2 id="sub-reminder-title" className="mt-3 text-lg font-black text-slate-900">
            {lastDay ? 'Hôm nay là ngày cuối của gói' : 'Tài khoản sắp hết hạn'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {lastDay ? (
              <>Tài khoản hết hạn <strong className="text-red-600">{formatExpiryDate(subscription.expiresAt)}</strong>. Gia hạn ngay để không bị gián đoạn việc học nhé!</>
            ) : (
              <>Còn <strong className="text-orange-600">{subscription.daysLeft} ngày</strong> (hết hạn {formatExpiryDate(subscription.expiresAt)}). Gia hạn sớm để việc học không bị gián đoạn nhé!</>
            )}
          </p>
        </div>
        <div className="flex gap-2 p-4">
          <button type="button" onClick={close} className="cms-btn cms-btn-outline flex-1">Để sau</button>
          <button type="button" onClick={() => { close(); onRenew(); }} className="cms-btn cms-btn-primary flex-1">Gia hạn ngay</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Gói tài khoản HV: hết hạn → chỉ còn màn gia hạn (server cũng chặn API);
 * còn hạn → cung cấp trạng thái cho sidebar/hồ sơ + popup nhắc khi sắp hết hạn.
 */
export default function SubscriptionGate({ session, children }) {
  const role = String(session?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const studentId = session?.id || session?._id || '';
  const [overview, setOverview] = useState(() => (session?.subscription ? { subscription: session.subscription, plans: [], history: [] } : null));
  const [renewOpen, setRenewOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isStudent) return;
    try {
      const data = await subscriptionApi.student.overview();
      setOverview(data);
    } catch { /* giữ trạng thái cũ khi lỗi mạng */ }
  }, [isStudent]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!isStudent) return undefined;
    const onExpired = () => refresh();
    window.addEventListener(SUBSCRIPTION_EXPIRED_EVENT, onExpired);
    window.addEventListener('free-portal-unlocked', onExpired);
    window.addEventListener('cms:subscription-updated', onExpired);
    return () => {
      window.removeEventListener(SUBSCRIPTION_EXPIRED_EVENT, onExpired);
      window.removeEventListener('free-portal-unlocked', onExpired);
      window.removeEventListener('cms:subscription-updated', onExpired);
    };
  }, [isStudent, refresh]);

  const onRenewed = useCallback(() => {
    setRenewOpen(false);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (e) => setRenewOpen(Boolean(e.detail));
    window.addEventListener('dewskill-test-renew-modal', handler);
    return () => window.removeEventListener('dewskill-test-renew-modal', handler);
  }, []);

  const value = useMemo(() => ({
    overview,
    subscription: overview?.subscription || null,
    refresh,
    openRenew: () => setRenewOpen(true),
  }), [overview, refresh]);

  if (!isStudent) return children;

  const subscription = overview?.subscription;

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      {renewOpen && overview && (
        <RenewModal overview={overview} onClose={() => setRenewOpen(false)} onRenewed={onRenewed} />
      )}
      {subscription && session?.freePortal !== true && (
        <ExpiringReminder subscription={subscription} studentId={studentId} onRenew={() => setRenewOpen(true)} />
      )}
    </SubscriptionContext.Provider>
  );
}
