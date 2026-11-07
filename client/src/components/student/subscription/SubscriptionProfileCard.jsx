import { CalendarClock, Crown, History, KeyRound, Zap } from 'lucide-react';
import { useStudentSubscription } from './subscriptionContext';
import { formatExpiryDate, formatVnd } from '../../../utils/subscription';

const SOURCE_LABELS = { code: 'Mã kích hoạt', payment: 'Thanh toán', admin: 'Trung tâm cập nhật' };

/** Thẻ "Gói tài khoản" trong Hồ sơ học viên: gói, hạn, lịch sử, nút gia hạn / nhập mã. */
export default function SubscriptionProfileCard() {
  const ctx = useStudentSubscription();
  const subscription = ctx?.subscription;
  if (!subscription) return null;
  const isLifetime = subscription.state === 'lifetime';
  const freePortalAccount = (() => {
    try { return JSON.parse(localStorage.getItem('student_user') || '{}')?.freePortal === true; } catch { return false; }
  })();
  const freeTier = subscription.freeTier === true || (freePortalAccount && isLifetime && !subscription.meetLifetime);
  const expiring = subscription.state === 'expiring';
  const history = ctx.overview?.history || [];
  const xpPurchases = ctx.overview?.xpPurchases || [];
  const heading = freeTier ? 'Gói miễn phí' : (subscription.meetLifetime || !isLifetime ? 'Gói học Meet' : 'Gói tài khoản');

  return (
    <section className="cms-sd-card !p-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 lg:px-5 lg:py-3.5">
        <Crown size={16} className="shrink-0 text-amber-500" aria-hidden="true" />
        <span className="text-sm font-extrabold text-slate-800 lg:text-base">{heading}</span>
      </div>
      <div className="space-y-3 px-4 py-3 lg:px-5 lg:py-4">
        <div className={`flex items-center gap-3 rounded-2xl p-3 ${expiring ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50 ring-1 ring-slate-100'}`}>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${isLifetime ? 'bg-gradient-to-br from-red-500 to-rose-700' : expiring ? 'bg-gradient-to-br from-amber-400 to-orange-600' : 'bg-gradient-to-br from-emerald-400 to-teal-600'}`}>
            <CalendarClock size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900">{freeTier ? 'Miễn phí' : `Gói ${subscription.planLabel}`}</p>
            <p className={`text-xs font-semibold ${expiring ? 'text-orange-600' : 'text-slate-500'}`}>
              {freeTier ? '60 XP mỗi ngày' : isLifetime ? 'Không giới hạn thời gian' : `Hết hạn ${formatExpiryDate(subscription.expiresAt)} · còn ${subscription.daysLeft} ngày`}
            </p>
          </div>
        </div>
        {!isLifetime && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={ctx.openRenew} className="cms-btn cms-btn-primary !py-2 text-sm">Gia hạn</button>
            <button type="button" onClick={ctx.openRenew} className="cms-btn cms-btn-outline !py-2 text-sm">
              <KeyRound size={14} aria-hidden="true" /> Nhập mã
            </button>
          </div>
        )}
        {history.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <History size={12} aria-hidden="true" /> Lịch sử gia hạn
            </p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {history.slice(0, 5).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate font-semibold text-slate-700">
                    {SOURCE_LABELS[row.source] || row.source} · {row.planLabel}
                    {row.amount ? ` · ${formatVnd(row.amount)}` : ''}
                    {row.note && row.planLabel !== 'Miễn phí' ? ` · ${row.note}` : ''}
                  </span>
                  <span className="shrink-0 text-slate-400">{formatExpiryDate(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {xpPurchases.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Zap size={12} className="fill-amber-300 text-amber-500" aria-hidden="true" /> Lịch sử mua XP
            </p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {xpPurchases.slice(0, 5).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate font-semibold text-slate-700">
                    +{row.xp} XP{row.amount ? ` · ${formatVnd(row.amount)}` : ''}
                  </span>
                  <span className="shrink-0 text-slate-400">{formatExpiryDate(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
