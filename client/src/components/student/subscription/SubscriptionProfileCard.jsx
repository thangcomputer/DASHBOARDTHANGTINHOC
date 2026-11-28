import { useState } from 'react';
import { ChevronDown, Crown, History, Sparkles } from 'lucide-react';
import { useStudentSubscription } from './subscriptionContext';
import useAIQuota from '../../../hooks/useAIQuota';
import { deriveSidebarAiPlan } from '../../../utils/sidebarAiPlan';
import { formatAiPlanExpiry } from '../../../data/aiPackagesData';
import { formatExpiryDate, formatVnd } from '../../../utils/subscription';

const SOURCE_LABELS = { code: 'Mã kích hoạt', payment: 'Thanh toán', admin: 'Trung tâm cập nhật' };

/** Thẻ "Gói hỗ trợ AI" trong Hồ sơ học viên: trạng thái gói AI, hạn, lịch sử gia hạn. */
export default function SubscriptionProfileCard() {
  const ctx = useStudentSubscription();
  const aiQuota = useAIQuota({ autoFetch: true });
  const [showAllHistory, setShowAllHistory] = useState(false);

  const aiPlanCard = deriveSidebarAiPlan({
    aiQuotaPercent: aiQuota.aiQuotaPercent,
    aiPlan: aiQuota.aiPlan,
    isPaidUnlimited: aiQuota.isPaidUnlimited,
  });
  const aiExpiryText = formatAiPlanExpiry(aiQuota.aiPlan?.expiresAt);
  const durationSummary = aiPlanCard.remainingDays > 0
    ? `Còn ${aiPlanCard.remainingDays} ngày sử dụng`
    : `Còn ${aiPlanCard.remainingHours} giờ`;

  const statusTone = aiPlanCard.isSubscribed
    ? {
      box: 'bg-amber-50/75 ring-1 ring-amber-200',
      icon: 'bg-gradient-to-br from-amber-400 to-amber-600',
      sub: 'text-amber-700',
    }
    : aiPlanCard.quotaPercent <= 0
      ? {
        box: 'bg-rose-50/75 ring-1 ring-rose-200',
        icon: 'bg-gradient-to-br from-rose-500 to-red-600',
        sub: 'text-rose-600',
      }
      : aiPlanCard.quotaPercent <= 20
        ? {
          box: 'bg-orange-50/75 ring-1 ring-orange-200',
          icon: 'bg-gradient-to-br from-orange-400 to-orange-600',
          sub: 'text-orange-600',
        }
        : {
          box: 'bg-emerald-50/60 ring-1 ring-emerald-100',
          icon: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
          sub: 'text-emerald-600',
        };

  const history = ctx?.overview?.history || [];

  return (
    <section className="cms-sd-card !p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 lg:px-5 lg:py-3.5">
        <div className="flex items-center gap-2">
          <Crown size={16} className="shrink-0 text-amber-500" aria-hidden="true" />
          <span className="text-sm font-extrabold text-slate-800 lg:text-base">Gói hỗ trợ AI</span>
        </div>
        {aiPlanCard.isSubscribed && (
          <span
            title="Không giới hạn"
            className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800"
          >
            Unlimited
          </span>
        )}
      </div>
      <div className="space-y-3 px-4 py-3 lg:px-5 lg:py-4">
        <div className={`flex items-center justify-between gap-3 rounded-2xl p-3 ${statusTone.box}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${statusTone.icon}`}>
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900">
                {aiPlanCard.isSubscribed ? aiPlanCard.planName : 'Gói AI Miễn phí'}
              </p>
              <p className={`text-xs font-semibold ${statusTone.sub}`}>
                {aiPlanCard.isSubscribed
                  ? `Không giới hạn${aiExpiryText ? ` · Hạn đến ${aiExpiryText}` : ''} · ${durationSummary}`
                  : (aiPlanCard.quotaPercent > 0
                    ? `Còn ${aiPlanCard.quotaPercent}% dung lượng AI hôm nay`
                    : 'Đã hết dung lượng AI hôm nay')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => aiQuota.openPackagesModal()}
            className="cms-btn cms-btn-primary cms-btn-brand shrink-0 !py-2 !px-3.5 text-xs"
          >
            {aiPlanCard.isSubscribed ? 'Gia hạn' : 'Nâng cấp'}
          </button>
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <History size={12} aria-hidden="true" /> Lịch sử gia hạn
            </p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {(showAllHistory ? history : history.slice(0, 3)).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate font-semibold text-slate-700">
                    {SOURCE_LABELS[row.source] || row.source} · {row.planLabel || 'Gói hỗ trợ AI'}
                    {row.amount ? ` · ${formatVnd(row.amount)}` : ''}
                    {row.note && row.planLabel !== 'Miễn phí' ? ` · ${row.note}` : ''}
                  </span>
                  <span className="shrink-0 text-slate-400">{formatExpiryDate(row.createdAt)}</span>
                </li>
              ))}
            </ul>
            {history.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="mt-2 w-full py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-bold text-emerald-600 flex items-center justify-center gap-1 transition cursor-pointer !shadow-none"
              >
                <span>{showAllHistory ? 'Thu gọn' : `Xem thêm (${history.length - 3})`}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showAllHistory ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
