import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BatteryLow, Sparkles, X } from 'lucide-react';
import { AI_QUICK_CHIPS } from '../../data/aiPackagesData';
import { formatAiResetCountdown } from '../ui/AiUsageIndicator';
import { getDewSkillThemeAttr, isDewSkillAccount } from '../../utils/dewskillTheme';
import { useData } from '../../context/DataContext';

/**
 * Modal thông báo đã hết 0% dung lượng hỏi AI hôm nay + 3 chip chọn nhanh gói nâng cấp.
 * Giữ style Giọt Nước 3D trên tài khoản DewSkill, style chuẩn trung tâm trên tài khoản Trung tâm.
 */
export default function AIOutOfQuotaModal({
  open,
  resetInMs = null,
  resetsAt = null,
  user = null,
  onClose,
  onViewPackages,
}) {
  const { currentUser } = useData() || {};
  const effectiveUser = user || currentUser || null;
  const isDewSkill = isDewSkillAccount(effectiveUser);
  const themeAttr = getDewSkillThemeAttr(effectiveUser);
  const [selectedGroup, setSelectedGroup] = useState('standard');

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const countdown = formatAiResetCountdown(resetInMs, resetsAt, false);

  const modal = (
    <div
      data-theme={themeAttr}
      className="fixed inset-0 z-[10150] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-out-of-quota-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full max-w-[92vw] sm:max-w-[400px]">
        {isDewSkill ? (
          <>
            <span
              aria-hidden="true"
              className="dew-water-orb pointer-events-none absolute -top-4 -left-4 z-20 hidden h-11 w-11 opacity-85 lg:block"
            />
            <span
              aria-hidden="true"
              className="dew-water-orb pointer-events-none absolute bottom-6 -right-4 z-20 hidden h-9 w-9 opacity-80 lg:block"
            />
          </>
        ) : null}

        <div className="dew-modal relative max-h-[88dvh] overflow-y-auto overflow-x-hidden rounded-2xl sm:rounded-[24px] border border-white/90 bg-white/95 shadow-[0_26px_60px_-14px_rgba(15,23,42,0.28),inset_0_2px_0_#fff] backdrop-blur-2xl">
          {/* Thanh nhấn cam-đỏ san hô */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B]" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo hết dung lượng AI"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            <X size={16} />
          </button>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Nội dung trên + Mascot / Icon pin cạn */}
            <div className="flex items-start justify-between gap-3 pr-4">
              <div className="min-w-0 space-y-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10.5px] font-extrabold text-rose-600">
                  0% còn lại hôm nay
                </span>
                <h3
                  id="ai-out-of-quota-title"
                  className="text-base font-black leading-snug text-slate-900 sm:text-lg"
                >
                  Đã hết dung lượng hỏi AI hôm nay!
                </h3>
                <p className="text-xs font-medium leading-relaxed text-slate-600">
                  Dung lượng miễn phí đã chạm <strong className="text-rose-600">0%</strong>. Nâng cấp gói để hỏi AI không giới hạn cho cả tài khoản{' '}
                  <strong>DewSkill</strong> và <strong>Trung tâm</strong>.
                </p>
              </div>

              {isDewSkill ? (
                <div className="relative flex h-18 w-18 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-gradient-to-b from-amber-50/90 to-emerald-50/70 p-1.5 shadow-inner">
                  <img
                    src="/mascot/nang-dong.gif"
                    alt="Mascot DewSkill pin yếu"
                    className="h-14 w-14 object-contain drop-shadow"
                  />
                  <span className="absolute -bottom-1.5 -left-1.5 flex h-7 w-7 items-center justify-center rounded-xl border-2 border-white bg-gradient-to-b from-[#FB7185] to-[#EF4444] text-white shadow-md">
                    <BatteryLow size={14} />
                  </span>
                </div>
              ) : (
                <div className="relative flex h-16 w-16 sm:h-18 sm:w-18 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 shadow-inner">
                  <BatteryLow size={30} />
                  <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-sm">
                    <Sparkles size={11} />
                  </span>
                </div>
              )}
            </div>

            {/* 3 chip chọn nhanh */}
            <div className="grid grid-cols-3 gap-2">
              {AI_QUICK_CHIPS.map((chip) => {
                const active = selectedGroup === chip.group;
                return (
                  <button
                    key={chip.group}
                    type="button"
                    onClick={() => setSelectedGroup(chip.group)}
                    className={`rounded-full px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                      active
                        ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-800 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.45)]'
                        : 'border border-slate-200/90 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40 shadow-xs'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Nút hành động */}
            <div className="space-y-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onViewPackages?.(selectedGroup);
                }}
                className={`${isDewSkill ? 'dew-btn-primary' : 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white rounded-full shadow-md hover:brightness-105'} flex w-full items-center justify-center gap-2 py-2.5 sm:py-3 text-xs sm:text-sm font-extrabold transition cursor-pointer`}
              >
                <span>Xem &amp; Mua gói không giới hạn</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-700 cursor-pointer"
              >
                Chờ làm mới vào ngày mai (reset sau {countdown})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
