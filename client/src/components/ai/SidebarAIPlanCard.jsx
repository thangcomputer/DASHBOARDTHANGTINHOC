import { Crown, Zap } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { dispatchOpenAiPackagesModal } from '../../hooks/useAIQuota';
import { getDewSkillThemeAttr, isDewSkillAccount } from '../../utils/dewskillTheme';
import { resolveSidebarAiCardVariant } from '../../utils/sidebarAiPlan';

const VARIANT_CLASSES = {
  subscribed:
    'bg-gradient-to-b from-[#FDE68A] via-[#F59E0B] to-[#B45309] shadow-[0_10px_22px_-6px_rgba(217,119,6,0.42),inset_0_2px_0_rgba(255,255,255,0.55)]',
  free_high:
    'bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#047857] shadow-[0_10px_22px_-6px_rgba(4,120,87,0.42),inset_0_2px_0_rgba(255,255,255,0.48)]',
  free_low:
    'bg-gradient-to-b from-[#FDBA74] via-[#F97316] to-[#C2410C] shadow-[0_10px_22px_-6px_rgba(194,65,12,0.42),inset_0_2px_0_rgba(255,255,255,0.5)]',
  free_empty:
    'bg-gradient-to-b from-[#FCA5A5] via-[#EF4444] to-[#B91C1C] shadow-[0_10px_22px_-6px_rgba(185,28,28,0.42),inset_0_2px_0_rgba(255,255,255,0.48)]',
};

/**
 * Thẻ hiển thị trạng thái Gói AI & Dung lượng Hỏi AI ở đầu Sidebar học viên.
 * Dùng chung cho Học viên DewSkill (hiện hiệu ứng kính giọt nước 3D qua [data-theme="dewskill"])
 * và Học viên Trung tâm (giao diện chuẩn qua [data-theme="center"]).
 */
export default function SidebarAIPlanCard({
  aiPlan = null,
  onOpenPackages = null,
  user = null,
  className = '',
}) {
  const { currentUser } = useData() || {};
  const effectiveUser = user || currentUser || null;
  const themeAttr = getDewSkillThemeAttr(effectiveUser);
  const isDewSkill = isDewSkillAccount(effectiveUser);

  const plan = aiPlan || {};
  const isSubscribed = Boolean(plan.isSubscribed);
  const quotaPercent = Math.max(0, Math.min(100, Math.round(Number(plan.quotaPercent ?? 100) || 0)));
  const planName = String(plan.planName || 'Gói AI 3 Tháng');
  const remainingDays = Math.max(0, Math.round(Number(plan.remainingDays) || 0));
  const remainingHours = Math.max(1, Math.round(Number(plan.remainingHours) || 24));
  const timeRemainingPercent = Math.max(
    0,
    Math.min(100, Math.round(Number(plan.timeRemainingPercent ?? 100) || 0)),
  );

  const variant = resolveSidebarAiCardVariant({ isSubscribed, quotaPercent });
  const handleOpen = typeof onOpenPackages === 'function'
    ? onOpenPackages
    : typeof plan.onOpenPackages === 'function'
      ? plan.onOpenPackages
      : () => dispatchOpenAiPackagesModal();

  const subscribedDurationText = remainingDays > 0
    ? `Còn ${remainingDays} ngày sử dụng`
    : `Còn ${remainingHours} giờ`;

  return (
    <button
      type="button"
      onClick={handleOpen}
      data-theme={themeAttr}
      data-ai-card-variant={variant}
      className={`dew-sidebar-ai-card w-full text-left rounded-[20px] px-3 py-2.5 text-white cursor-pointer relative overflow-hidden transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {isDewSkill && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="absolute -top-3 left-2 right-2 h-5 rounded-full bg-white/25 blur-[2px]" />
          <span className="absolute top-1.5 right-6 h-2.5 w-2.5 rounded-full bg-white/45 shadow-[0_2px_6px_rgba(255,255,255,0.5)]" />
          <span className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-white/15 blur-[1px]" />
        </span>
      )}

      {variant === 'subscribed' && (
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/30 text-amber-950 shadow-2xs">
                <Crown size={10} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span
                className="truncate font-extrabold tracking-tight text-white drop-shadow-[0_1px_1px_rgba(120,53,15,0.35)]"
                style={{ fontSize: '12px', lineHeight: '1.25' }}
              >
                {planName}
              </span>
            </div>
            <span
              className="shrink-0 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 font-extrabold text-amber-800 shadow-xs cursor-help"
              style={{ fontSize: '9.5px', lineHeight: '1.15' }}
              title="Không giới hạn"
              aria-label="Không giới hạn"
            >
              Unlimited
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/30 shadow-[inset_0_1px_2px_rgba(120,53,15,0.28)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FFFBEB] via-[#FDE68A] to-[#FBBF24] shadow-[0_0_8px_rgba(254,240,138,0.85)] transition-[width] duration-300"
              style={{ width: `${Math.max(4, timeRemainingPercent)}%` }}
            />
          </div>

          <div
            className="flex items-center justify-between gap-1.5 font-bold"
            style={{ fontSize: '10.5px', lineHeight: '1.25' }}
          >
            <span className="truncate text-amber-50">{subscribedDurationText}</span>
            <span className="shrink-0 whitespace-nowrap font-extrabold text-white">Gia hạn ›</span>
          </div>
        </div>
      )}

      {variant === 'free_high' && (
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/25 text-white shadow-2xs">
                <Zap size={10} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span
                className="truncate font-extrabold tracking-tight text-white"
                style={{ fontSize: '12px', lineHeight: '1.25' }}
              >
                Gói AI Miễn phí
              </span>
            </div>
            <span
              className="shrink-0 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 font-extrabold tabular-nums text-emerald-800 shadow-xs"
              style={{ fontSize: '9.5px', lineHeight: '1.15' }}
            >
              {quotaPercent}%
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/30 shadow-[inset_0_1px_2px_rgba(4,120,87,0.3)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#D1FAE5] via-[#A7F3D0] to-[#6EE7B7] shadow-[0_0_8px_rgba(167,243,208,0.85)] transition-[width] duration-300"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>

          <div
            className="flex items-center justify-between gap-1.5 font-bold"
            style={{ fontSize: '10.5px', lineHeight: '1.25' }}
          >
            <span className="truncate text-emerald-50">Còn {quotaPercent}% hôm nay</span>
            <span className="shrink-0 whitespace-nowrap font-extrabold text-white">Nâng cấp ›</span>
          </div>
        </div>
      )}

      {variant === 'free_low' && (
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/25 text-white shadow-2xs">
                <Zap size={10} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span
                className="truncate font-extrabold tracking-tight text-white"
                style={{ fontSize: '12px', lineHeight: '1.25' }}
              >
                Gói AI Miễn phí
              </span>
            </div>
            <span
              className="shrink-0 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 font-extrabold tabular-nums text-orange-700 shadow-xs"
              style={{ fontSize: '9.5px', lineHeight: '1.15' }}
            >
              {quotaPercent}%
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/30 shadow-[inset_0_1px_2px_rgba(154,52,18,0.28)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FFEDD5] via-[#FDBA74] to-[#FB923C] shadow-[0_0_8px_rgba(253,186,116,0.9)] transition-[width] duration-300"
              style={{ width: `${Math.max(8, quotaPercent)}%` }}
            />
          </div>

          <div
            className="flex items-center justify-between gap-1.5 font-bold"
            style={{ fontSize: '10.5px', lineHeight: '1.25' }}
          >
            <span className="truncate text-orange-50">Sắp hết dung lượng</span>
            <span className="shrink-0 whitespace-nowrap font-extrabold text-white">Mua gói ›</span>
          </div>
        </div>
      )}

      {variant === 'free_empty' && (
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-1.5">
            <span
              className="truncate font-extrabold tracking-tight text-white"
              style={{ fontSize: '12px', lineHeight: '1.25' }}
            >
              Hết dung lượng AI
            </span>
            <span
              className="shrink-0 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 font-extrabold tabular-nums text-red-700 shadow-xs"
              style={{ fontSize: '9.5px', lineHeight: '1.15' }}
            >
              0%
            </span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/30 shadow-[inset_0_1px_2px_rgba(127,29,29,0.28)]" />

          <span
            className="block w-full mt-2 py-1.5 rounded-full bg-white text-red-700 font-extrabold shadow-sm text-center"
            style={{ fontSize: '11px', lineHeight: '1.25' }}
          >
            Nâng cấp không giới hạn →
          </span>
        </div>
      )}
    </button>
  );
}
