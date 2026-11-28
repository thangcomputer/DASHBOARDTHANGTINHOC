import { Infinity as InfinityIcon, Sparkles, ArrowUpRight } from 'lucide-react';
import { formatAiPlanExpiry } from '../../data/aiPackagesData';
import { formatAiResetCountdown } from '../ui/AiUsageIndicator';
import { getDewSkillThemeAttr } from '../../utils/dewskillTheme';
import { useData } from '../../context/DataContext';

/**
 * Thanh hiển thị Dung lượng Hỏi AI theo % (3 trạng thái: >20%, 1-20%, 0%)
 * hoặc huy hiệu Không giới hạn khi đã kích hoạt gói AI.
 * Tự nhận CSS Giọt Nước 3D qua [data-theme="dewskill"] cho học viên DewSkill,
 * giữ giao diện chuẩn trung tâm cho học viên Trung tâm.
 */
export default function AIQuotaMeter({
  percent = 100,
  isUnlimited = false,
  isAdminUnlimited = false,
  expiresAt = null,
  planModelQuota = null,
  resetInMs = null,
  resetsAt = null,
  onUpgrade = null,
  compact = false,
  dark = false,
  user = null,
  className = '',
}) {
  const { currentUser } = useData() || {};
  const effectiveUser = user || currentUser || null;
  const themeAttr = getDewSkillThemeAttr(effectiveUser);
  const clampedPct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const expiryText = formatAiPlanExpiry(expiresAt);
  const countdown = formatAiResetCountdown(resetInMs, resetsAt, false);

  if (isAdminUnlimited) {
    return (
      <div
        data-theme={themeAttr}
        className={`flex flex-wrap items-center justify-between gap-2 ${compact ? 'text-[11px]' : 'rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3'} ${className}`}
      >
        <span className={`font-bold ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
          Dung lượng hỏi AI: 100%
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-xs">
          <Sparkles size={11} />
          Không giới hạn · Quản trị
        </span>
      </div>
    );
  }

  if (isUnlimited) {
    return (
      <div
        data-theme={themeAttr}
        className={`flex flex-wrap items-center justify-between gap-2 ${
          compact
            ? 'rounded-xl px-2.5 py-1.5 ' + (dark ? 'border border-emerald-400/25 bg-emerald-500/15' : 'border border-emerald-200/90 bg-gradient-to-r from-[#ECFDF5] to-[#D1FAE5]/85')
            : 'dew-card rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-[#ECFDF5] via-white to-[#D1FAE5]/70 px-4 py-3 shadow-sm'
        } ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#34D399] to-[#059669] text-white shadow-xs">
            <InfinityIcon size={13} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <span className={`block truncate font-extrabold ${compact ? 'text-[11.5px]' : 'text-xs sm:text-sm'} ${dark ? 'text-emerald-200' : 'text-emerald-900'}`}>
              Không giới hạn{expiryText ? ` · Hạn đến ${expiryText}` : ''}
            </span>
            {!compact && planModelQuota ? (
              <span className={`block truncate text-[11px] font-semibold ${dark ? 'text-emerald-300/80' : 'text-emerald-700/85'}`}>
                Ưu tiên hôm nay · Câu khó/Ảnh: {planModelQuota.standard?.remaining ?? 0}/{planModelQuota.standard?.limit ?? 0}
                {Number(planModelQuota.filePro?.limit) > 0
                  ? ` · File Pro: ${planModelQuota.filePro?.remaining ?? 0}/${planModelQuota.filePro?.limit ?? 0}`
                  : (Number(planModelQuota.fileFlash?.limit) > 0
                    ? ` · Giải file: ${planModelQuota.fileFlash?.remaining ?? 0}/${planModelQuota.fileFlash?.limit ?? 0}`
                    : '')}
              </span>
            ) : null}
          </div>
        </div>
        {onUpgrade ? (
          <button
            type="button"
            onClick={() => onUpgrade()}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold transition cursor-pointer ${
              dark
                ? 'border border-emerald-400/35 bg-white/10 text-emerald-200 hover:bg-white/20'
                : 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span>Gia hạn</span>
            <ArrowUpRight size={11} />
          </button>
        ) : null}
      </div>
    );
  }

  const isEmpty = clampedPct <= 0;
  const isLow = clampedPct > 0 && clampedPct <= 20;

  const trackClass = isEmpty
    ? (dark
      ? 'border-rose-400 bg-rose-950/35 shadow-[0_0_0_2px_rgba(244,63,94,0.18)]'
      : 'border-rose-400 bg-white shadow-[inset_0_2px_6px_rgba(244,63,94,0.15),0_0_0_2px_rgba(251,113,133,0.18)]')
    : (dark
      ? 'border-white/15 bg-white/10'
      : 'border-slate-200/90 bg-slate-100/90 shadow-[inset_0_2px_5px_rgba(15,23,42,0.08)]');

  const fillClass = isLow
    ? 'bg-gradient-to-r from-[#EA580C] via-[#F59E0B] to-[#FBBF24] shadow-[0_2px_10px_rgba(245,158,11,0.4),inset_0_2px_3px_rgba(255,255,255,0.65)]'
    : 'bg-gradient-to-r from-[#047857] via-[#10B981] to-[#34D399] shadow-[0_2px_10px_rgba(16,185,129,0.4),inset_0_2px_3px_rgba(255,255,255,0.65)]';

  const statusPill = isEmpty ? (
    <button
      type="button"
      onClick={() => onUpgrade?.()}
      className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#EF4444] to-[#F97316] px-2.5 py-0.5 text-[10.5px] font-extrabold text-white shadow-[0_3px_10px_-2px_rgba(239,68,68,0.55),inset_0_1px_1px_rgba(255,255,255,0.45)] hover:brightness-105 transition cursor-pointer"
    >
      <span>Đã hết · Nâng cấp</span>
    </button>
  ) : isLow ? (
    <button
      type="button"
      onClick={() => onUpgrade?.()}
      className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] px-2.5 py-0.5 text-[10.5px] font-extrabold text-white shadow-[0_3px_10px_-2px_rgba(245,158,11,0.5),inset_0_1px_1px_rgba(255,255,255,0.45)] hover:brightness-105 transition cursor-pointer"
    >
      <span>Sắp hết · Mua thêm</span>
    </button>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#059669] to-[#10B981] px-2.5 py-0.5 text-[10.5px] font-extrabold text-white shadow-[0_3px_10px_-2px_rgba(16,185,129,0.45),inset_0_1px_1px_rgba(255,255,255,0.45)]">
      Sẵn sàng
    </span>
  );

  return (
    <div data-theme={themeAttr} className={`space-y-1.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`${compact ? 'text-[11px]' : 'text-xs sm:text-[13px]'} font-extrabold tabular-nums ${
            isEmpty
              ? (dark ? 'text-rose-300' : 'text-rose-600')
              : (dark ? 'text-slate-200' : 'text-slate-800')
          }`}>
            Dung lượng hỏi AI: {clampedPct}%
          </span>
          {compact ? (
            <span className={`text-[10.5px] font-medium ${dark ? 'text-slate-400' : 'text-slate-400'}`}>
              · Reset sau {countdown}
            </span>
          ) : null}
        </div>
        {statusPill}
      </div>

      <div
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Dung lượng hỏi AI còn ${clampedPct}%`}
        className={`relative w-full overflow-hidden rounded-full border ${compact ? 'h-2.5' : 'h-4'} ${trackClass}`}
      >
        {clampedPct > 0 ? (
          <div
            className={`h-full rounded-full transition-all duration-300 ${fillClass}`}
            style={{ width: `${Math.max(4, clampedPct)}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
