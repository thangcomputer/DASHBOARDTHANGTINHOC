import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Infinity as InfinityIcon, Sparkles, X } from 'lucide-react';
import {
  AI_PACKAGES,
  AI_PACKAGE_CARDS,
  formatAiPackagePrice,
  formatAiPlanExpiry,
} from '../../data/aiPackagesData';
import useAIQuota from '../../hooks/useAIQuota';
import { aiSupportAPI } from '../../services/api';
import CourseEnrollmentModal from '../student/courses/CourseEnrollmentModal';
import { getDewSkillThemeAttr, isDewSkillAccount } from '../../utils/dewskillTheme';
import { useData } from '../../context/DataContext';

const PLAN_RANK = {
  '1d': 1,
  '1m': 2,
  '3m': 3,
  '6m': 4,
  '12m': 5,
};

const ACCENT_STYLES = {
  blue: {
    topBar: 'bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#0EA5E9]',
    badge: 'bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] text-white shadow-[0_6px_16px_-4px_rgba(14,165,233,0.5)]',
    card: 'border-sky-200/80 bg-gradient-to-b from-[#F0F9FF]/95 via-white to-[#E0F2FE]/65 shadow-[0_18px_42px_-16px_rgba(14,165,233,0.22),inset_0_2px_0_#fff]',
    checkBg: 'bg-sky-500/15 text-sky-600 border border-sky-200',
    ctaDew: 'dew-btn-white text-slate-900 border border-slate-200/90 hover:border-sky-300',
    ctaCenter: 'rounded-full border border-sky-200 bg-white text-sky-800 shadow-sm hover:bg-sky-50',
  },
  emerald: {
    topBar: 'bg-gradient-to-r from-[#34D399] via-[#10B981] to-[#059669]',
    badge: 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-[0_6px_16px_-4px_rgba(16,185,129,0.55)]',
    card: 'border-emerald-400/90 ring-2 ring-emerald-400/35 bg-gradient-to-b from-[#ECFDF5]/95 via-white to-[#D1FAE5]/70 shadow-[0_24px_54px_-14px_rgba(5,150,105,0.3),inset_0_2px_0_#fff]',
    checkBg: 'bg-gradient-to-b from-[#34D399] to-[#059669] text-white shadow-xs',
    pillActive: 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-sm',
    ctaDew: 'dew-btn-primary text-white',
    ctaCenter: 'rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-md hover:brightness-105',
  },
  amber: {
    topBar: 'bg-gradient-to-r from-[#FBBF24] via-[#F59E0B] to-[#EA580C]',
    badge: 'bg-gradient-to-r from-[#F59E0B] to-[#EA580C] text-white shadow-[0_6px_16px_-4px_rgba(245,158,11,0.5)]',
    card: 'border-amber-200/90 bg-gradient-to-b from-[#FFFBEB]/95 via-white to-[#FEF3C7]/65 shadow-[0_18px_42px_-16px_rgba(245,158,11,0.22),inset_0_2px_0_#fff]',
    checkBg: 'bg-gradient-to-b from-[#FBBF24] to-[#EA580C] text-white shadow-xs',
    pillActive: 'bg-gradient-to-r from-[#F59E0B] to-[#EA580C] text-white shadow-sm',
    ctaDew: 'dew-btn-orange text-white',
    ctaCenter: 'rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] text-white shadow-md hover:brightness-105',
  },
};

/**
 * Màn hình / Modal Mua 3 Gói Hỏi AI Không Giới Hạn (5 mốc: 1 ngày, 1/3 tháng, 6/12 tháng).
 * Áp dụng chung cho cả Học viên DewSkill (style Giọt Nước 3D) & Học viên Trung tâm (style Trung tâm).
 */
export default function AIPackagesView({
  inModal = false,
  initialGroup = null,
  onClose = null,
  user = null,
}) {
  const { currentUser } = useData() || {};
  const effectiveUser = user || currentUser || null;
  const isDewSkill = isDewSkillAccount(effectiveUser);
  const themeAttr = getDewSkillThemeAttr(effectiveUser);

  const {
    aiQuotaPercent,
    aiPlan,
    isPaidUnlimited,
    refresh,
  } = useAIQuota();

  const currentPlanId = isPaidUnlimited ? String(aiPlan?.plan || '').trim().toLowerCase() : '';
  const currentPlanRank = currentPlanId ? (PLAN_RANK[currentPlanId] || 0) : (isPaidUnlimited ? 99 : 0);
  const currentPlanObj = currentPlanId ? AI_PACKAGES[currentPlanId] : null;

  const [selectedStandardPlan, setSelectedStandardPlan] = useState('3m');
  const [selectedLongTermPlan, setSelectedLongTermPlan] = useState('12m');
  const [checkoutPackage, setCheckoutPackage] = useState(null);
  const [livePolicyByPlan, setLivePolicyByPlan] = useState(null);

  useEffect(() => {
    let active = true;
    aiSupportAPI.getPackages?.()
      .then((res) => {
        if (!active) return;
        const tiers = res?.data?.planModelPolicy;
        if (tiers && typeof tiers === 'object') {
          setLivePolicyByPlan(tiers);
        }
      })
      .catch(() => { /* keep static fallback benefits */ });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (currentPlanId === '1m' || currentPlanId === '3m') {
      setSelectedStandardPlan(currentPlanId);
    } else if (currentPlanId === '6m' || currentPlanId === '12m') {
      setSelectedLongTermPlan(currentPlanId);
    }
  }, [currentPlanId]);

  useEffect(() => {
    if (initialGroup === 'standard' && currentPlanId !== '1m' && currentPlanId !== '3m') {
      setSelectedStandardPlan('3m');
    } else if (initialGroup === 'longterm' && currentPlanId !== '6m' && currentPlanId !== '12m') {
      setSelectedLongTermPlan('12m');
    }
  }, [initialGroup, currentPlanId]);

  const expiryText = useMemo(() => formatAiPlanExpiry(aiPlan?.expiresAt), [aiPlan?.expiresAt]);

  const statusBadgeClass = aiQuotaPercent <= 0
    ? 'bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white shadow-sm'
    : aiQuotaPercent <= 20
      ? 'bg-gradient-to-r from-[#F59E0B] to-[#EA580C] text-white shadow-sm'
      : 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-sm';

  const getActivePlanForCard = (card) => {
    if (card.key === 'standard') return AI_PACKAGES[selectedStandardPlan] || AI_PACKAGES['3m'];
    if (card.key === 'longterm') return AI_PACKAGES[selectedLongTermPlan] || AI_PACKAGES['12m'];
    return AI_PACKAGES['1d'];
  };

  return (
    <div
      data-theme={themeAttr}
      className={`relative ${
        inModal
          ? 'max-h-[88dvh] overflow-x-hidden overflow-y-auto rounded-2xl sm:rounded-[24px] border border-white/90 bg-gradient-to-br from-[#ECFDF5] via-[#F8FAFC] to-[#E0F2FE] p-3.5 sm:p-5 md:p-6 shadow-2xl'
          : 'overflow-hidden min-h-[calc(100dvh-5rem)] rounded-[28px] bg-gradient-to-br from-[#ECFDF5]/85 via-white to-[#E0F2FE]/80 px-4 py-8 sm:px-8 sm:py-10'
      }`}
    >
      {/* Giọt nước 3D trang trí cho DewSkill */}
      {isDewSkill ? (
        <>
          <span
            aria-hidden="true"
            className="dew-water-orb pointer-events-none absolute top-10 left-8 hidden h-12 w-12 opacity-60 lg:block"
          />
          <span
            aria-hidden="true"
            className="dew-water-orb pointer-events-none absolute top-20 right-10 hidden h-14 w-14 opacity-55 lg:block"
          />
          <span
            aria-hidden="true"
            className="dew-water-orb pointer-events-none absolute bottom-10 left-16 hidden h-10 w-10 opacity-50 lg:block"
          />
        </>
      ) : null}

      {inModal && onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng gói Hỏi AI Không Giới Hạn"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-600 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
        >
          <X size={16} />
        </button>
      ) : null}

      {/* Header */}
      <div className={`relative z-10 mx-auto max-w-3xl text-center ${inModal ? 'space-y-2' : 'space-y-3.5'}`}>
        <div className={`inline-flex items-center gap-1.5 rounded-full border border-white bg-white/90 font-extrabold text-slate-700 shadow-[0_6px_18px_-6px_rgba(15,23,42,0.12),inset_0_1px_0_#fff] backdrop-blur-md ${inModal ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'}`}>
          <Sparkles size={inModal ? 12 : 13} className="text-emerald-600" />
          <span>Áp dụng cho Học viên DewSkill &amp; Học viên Trung tâm</span>
        </div>

        <h1 className={`font-black tracking-tight text-slate-900 ${inModal ? 'text-xl sm:text-2xl lg:text-[26px]' : 'text-2xl sm:text-4xl'}`}>
          Nâng cấp gói{' '}
          <span className="relative inline-block text-emerald-700">
            Hỏi AI Không Giới Hạn
            <svg
              aria-hidden="true"
              viewBox="0 0 260 14"
              fill="none"
              className="pointer-events-none -mt-1 w-full"
            >
              <path
                d="M4 9.5C68 2.5 188 1.5 256 9"
                stroke="#F59E0B"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        {/* Thanh trạng thái dung lượng hiện tại */}
        <div className={`inline-flex flex-wrap items-center justify-center rounded-full border border-white bg-white/90 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.15),inset_0_2px_0_#fff] backdrop-blur-xl ${inModal ? 'gap-2 px-3 py-1.5' : 'gap-2.5 px-4 py-2'}`}>
          {isPaidUnlimited ? (
            <>
              <span className={`font-bold text-slate-700 ${inModal ? 'text-[11.5px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
                Trạng thái Hỏi AI:
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] px-3 py-0.5 text-xs font-extrabold text-white shadow-xs">
                <InfinityIcon size={13} />
                Không giới hạn{expiryText ? ` · Hạn đến ${expiryText}` : ''}
              </span>
            </>
          ) : (
            <>
              <span className={`font-bold text-slate-700 ${inModal ? 'text-[11.5px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
                Dung lượng hỏi AI hiện tại:
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-extrabold tabular-nums ${statusBadgeClass}`}>
                {aiQuotaPercent}% còn lại
              </span>
            </>
          )}
        </div>

        <p className={`font-medium text-slate-600 ${inModal ? 'text-[11.5px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
          {isPaidUnlimited
            ? (currentPlanId === '12m' || !currentPlanId
              ? `Bạn đang sử dụng ${currentPlanObj?.name || 'Gói Hỏi AI Không Giới Hạn'}${expiryText ? ` (hạn đến ${expiryText})` : ''}.`
              : `Bạn đang sử dụng ${currentPlanObj?.name || 'Gói Không Giới Hạn'}${expiryText ? ` (hạn đến ${expiryText})` : ''}. Bạn có thể nâng cấp lên gói dài hạn hơn bất kỳ lúc nào.`)
            : aiQuotaPercent <= 0
              ? 'Hết dung lượng miễn phí — chọn gói bên dưới để hỏi AI không giới hạn.'
              : 'Chọn gói bên dưới để hỏi AI không giới hạn mỗi ngày trên cả Web & Mobile.'}
        </p>
      </div>

      {/* Lưới 3 thẻ gói cân đối */}
      <div className={`relative z-10 mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-3 lg:items-stretch ${inModal ? 'mt-4 sm:mt-5 gap-3.5 sm:gap-4' : 'mt-7 gap-6'}`}>
        {AI_PACKAGE_CARDS.map((card) => {
          const style = ACCENT_STYLES[card.accent];
          const activePlan = getActivePlanForCard(card);
          const hasToggle = card.options.length > 1;
          const selectedId = activePlan.id;
          const hasDiscount = Number(activePlan.originalPrice) > Number(activePlan.price);
          const isHighlightedGroup = initialGroup && initialGroup === card.key;
          const isCurrentPlan = Boolean(isPaidUnlimited && (activePlan.id === currentPlanId || !currentPlanId));
          const isLowerThanCurrent = Boolean(
            isPaidUnlimited
            && !isCurrentPlan
            && currentPlanRank > 0
            && (PLAN_RANK[activePlan.id] || 0) < currentPlanRank,
          );
          const isDisabled = isCurrentPlan || isLowerThanCurrent;

          return (
            <div
              key={card.key}
              className={`dew-card relative flex flex-col justify-between overflow-hidden border backdrop-blur-xl transition-transform duration-200 ${
                inModal ? 'rounded-[22px]' : 'rounded-[28px]'
              } ${style.card} ${
                isHighlightedGroup ? 'ring-2 ring-emerald-500 -translate-y-0.5' : ''
              }`}
            >
              {/* Thanh accent trên cùng */}
              <div className={`${inModal ? 'h-1.5' : 'h-2'} w-full ${style.topBar}`} />

              {/* Pill nhãn gói nổi ở top giữa */}
              <div className={`flex justify-center ${inModal ? 'pt-3' : 'pt-4'}`}>
                <span className={`inline-flex items-center rounded-full font-black tracking-wide ${inModal ? 'px-3.5 py-0.5 text-[10.5px]' : 'px-4 py-1 text-[11px]'} ${style.badge}`}>
                  {card.badge}
                </span>
              </div>

              <div className={`flex flex-1 flex-col justify-between text-center ${inModal ? 'p-4 pt-3 sm:p-4.5 space-y-3.5' : 'p-6 pt-4 space-y-5'}`}>
                <div className={inModal ? 'space-y-2.5' : 'space-y-3.5'}>
                  <h2 className={`font-black text-slate-900 ${inModal ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>
                    {card.title}
                  </h2>

                  {/* Toggle 2 pill ngay trong thẻ (cho Tiêu Chuẩn 1/3 tháng và Dài Hạn 6/12 tháng) */}
                  {hasToggle ? (
                    <div className="mx-auto inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-inner">
                      {card.options.map((optId) => {
                        const opt = AI_PACKAGES[optId];
                        const isActive = selectedId === optId;
                        return (
                          <button
                            key={optId}
                            type="button"
                            onClick={() => {
                              if (card.key === 'standard') setSelectedStandardPlan(optId);
                              if (card.key === 'longterm') setSelectedLongTermPlan(optId);
                            }}
                            className={`inline-flex items-center gap-1 rounded-full font-extrabold transition cursor-pointer ${
                              inModal ? 'px-3 py-0.5 text-[11.5px]' : 'px-4 py-1 text-xs'
                            } ${
                              isActive
                                ? style.pillActive
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {isPaidUnlimited && optId === currentPlanId ? <Check size={11} strokeWidth={3} /> : null}
                            <span>{opt.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Giá động + Nhãn tiết kiệm */}
                  <div className="space-y-1">
                    <div className="flex flex-nowrap items-baseline justify-center gap-1.5 whitespace-nowrap">
                      <span className={`font-black text-slate-900 tabular-nums ${inModal ? 'text-xl sm:text-[22px]' : 'text-2xl sm:text-[26px]'}`}>
                        {formatAiPackagePrice(activePlan.price)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        / {activePlan.durationLabel}
                      </span>
                    </div>
                    <div className={`flex items-center justify-center gap-2 ${inModal ? 'min-h-[18px]' : 'min-h-[22px]'}`}>
                      {hasDiscount ? (
                        <span className="text-xs font-semibold text-slate-400 line-through tabular-nums">
                          {formatAiPackagePrice(activePlan.originalPrice)}
                        </span>
                      ) : null}
                      {activePlan.savingsLabel ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-extrabold text-amber-800">
                          {activePlan.savingsLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className={`font-semibold leading-relaxed text-slate-600 ${inModal ? 'text-[11.5px]' : 'text-xs'}`}>
                    {activePlan.subtitle || card.subtitle}
                  </p>

                  {/* Quyền lợi */}
                  <ul className={`text-left ${inModal ? 'space-y-1.5 pt-1' : 'space-y-2.5 pt-2'}`}>
                    {(() => {
                      const tierCfg = livePolicyByPlan?.[activePlan.id];
                      const dynamicBenefits = tierCfg ? [
                        activePlan.id === '1d'
                          ? 'Hỏi văn bản không giới hạn 24h (Model Nhanh)'
                          : `Hỏi văn bản không giới hạn mỗi ngày (${tierCfg.allow38Fallback ? 'có fallback nâng cao' : 'Model Nhanh'})`,
                        `${tierCfg.standardDailyLimit} lượt câu khó & đọc ảnh/ngày (tối đa ${tierCfg.imageDailyLimit} ảnh) · Gemini Flash`,
                        Number(tierCfg.fileProDailyLimit) > 0
                          ? `${tierCfg.fileProDailyLimit} lượt giải file chuyên sâu Gemini Pro + ${tierCfg.fileFlashDailyLimit} lượt file Flash/ngày`
                          : `${tierCfg.fileFlashDailyLimit} lượt giải file bài tập/ngày · Tự hạ model nhanh khi hết lượt`,
                      ] : (activePlan.benefits || card.benefits);
                      return dynamicBenefits;
                    })().map((benefit) => (
                      <li key={benefit} className={`flex items-start font-semibold text-slate-700 ${inModal ? 'gap-2 text-[11.5px] sm:text-xs' : 'gap-2.5 text-xs sm:text-[13px]'}`}>
                        <span className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full ${inModal ? 'h-4 w-4' : 'h-5 w-5'} ${style.checkBg}`}>
                          <Check size={inModal ? 10 : 12} strokeWidth={3} />
                        </span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Nút CTA */}
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) setCheckoutPackage(activePlan);
                  }}
                  className={
                    isCurrentPlan
                      ? `flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/95 font-extrabold text-emerald-700 cursor-not-allowed opacity-90 shadow-none ${inModal ? 'py-2.5 text-xs sm:text-[13px]' : 'py-3.5 text-sm'}`
                      : isLowerThanCurrent
                        ? `flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-100 font-bold text-slate-400 cursor-not-allowed shadow-none ${inModal ? 'py-2.5 text-xs sm:text-[13px]' : 'py-3.5 text-sm'}`
                        : `${isDewSkill ? style.ctaDew : style.ctaCenter} flex w-full items-center justify-center gap-2 font-extrabold transition cursor-pointer ${inModal ? 'py-2.5 text-xs sm:text-[13px]' : 'py-3.5 text-sm'}`
                  }
                >
                  {isCurrentPlan ? (
                    <>
                      <Check size={15} strokeWidth={3} />
                      <span>Đang sử dụng</span>
                    </>
                  ) : isLowerThanCurrent ? (
                    <span>Đã gồm trong gói hiện tại</span>
                  ) : (
                    <>
                      <span>
                        {isPaidUnlimited
                          ? `Nâng cấp gói ${activePlan.shortLabel}`
                          : activePlan.ctaLabel.replace(/\s*→$/, '')}
                      </span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className={`relative z-10 text-center ${inModal ? 'mt-4 space-y-1' : 'mt-6 space-y-1.5'}`}>
        <p className={`font-medium text-slate-500 ${inModal ? 'text-[10.5px] sm:text-[11px]' : 'text-[11.5px]'}`}>
          Chính sách Fair-Use: Khi hết lượt Model Mạnh ưu tiên trong ngày, hệ thống tự hạ sang Model Nhanh để bạn tiếp tục hỏi không gián đoạn (reset 00:00 mỗi ngày).
        </p>
        <p className={`font-semibold text-slate-500 ${inModal ? 'text-[11px] sm:text-xs' : 'text-xs'}`}>
          Kích hoạt tự động qua VietQR trong 1–3 phút · Dùng chung trên Web &amp; Mobile · Hỗ trợ:{' '}
          <a href="tel:0984623486" className="font-extrabold text-emerald-700 hover:underline">
            0984 623 486
          </a>
        </p>
      </div>

      {/* Modal VietQR chung với CourseEnrollmentModal */}
      <CourseEnrollmentModal
        open={Boolean(checkoutPackage)}
        aiPackage={checkoutPackage}
        user={effectiveUser}
        onClose={() => setCheckoutPackage(null)}
        onActivated={() => {
          refresh();
        }}
      />
    </div>
  );
}
