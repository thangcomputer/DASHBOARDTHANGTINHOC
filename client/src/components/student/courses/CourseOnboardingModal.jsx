import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check } from 'lucide-react';
import { TIER_STYLES } from './catalogMarketplaceData';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';

const ONBOARDING_TIERS = [
  { key: 'cap-1', label: 'Tiểu học (1–5)' },
  { key: 'cap-2', label: 'THCS (6–9)' },
  { key: 'cap-3', label: 'THPT (10–12)' },
  { key: 'mos', label: 'MOS Quốc tế' },
  { key: 'hs-sv', label: 'HS – Sinh viên' },
  { key: 'nguoi-di-lam', label: 'Người đi làm' },
  { key: 'chung-chi', label: 'Chứng chỉ' },
];

function TierIcon3D({ tierKey }) {
  if (tierKey === 'cap-1') {
    return (
      <img
        src="/mascot/nang-dong.gif"
        alt="Tiểu học"
        className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_6px_12px_rgba(16,185,129,0.32)]"
      />
    );
  }
  if (tierKey === 'hs-sv') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0 drop-shadow-[0_6px_12px_rgba(37,99,235,0.28)]" aria-hidden="true">
        <defs>
          <linearGradient id="dew-onb-cap" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path d="M6 20L24 11l18 9-18 9-18-9z" fill="url(#dew-onb-cap)" stroke="#DBEAFE" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13 24v8c0 3.5 5 6 11 6s11-2.5 11-6v-8l-11 5.5L13 24z" fill="#2563EB" />
        <path d="M38 22v10" stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="38" cy="34" r="2.2" fill="#F59E0B" />
      </svg>
    );
  }
  if (tierKey === 'nguoi-di-lam') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0 drop-shadow-[0_6px_12px_rgba(234,88,12,0.28)]" aria-hidden="true">
        <defs>
          <linearGradient id="dew-onb-bag" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDBA74" />
            <stop offset="55%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>
        <path d="M18 14v-2a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2" fill="none" stroke="#EA580C" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="8" y="14" width="32" height="24" rx="6" fill="url(#dew-onb-bag)" stroke="#FFEDD5" strokeWidth="1.5" />
        <path d="M8 22h32" stroke="#FED7AA" strokeWidth="2" />
        <rect x="21" y="19" width="6" height="5" rx="1.5" fill="#FFF7ED" />
      </svg>
    );
  }
  const palette = {
    'cap-2': ['#34D399', '#059669'],
    'cap-3': ['#A78BFA', '#6D28D9'],
    mos: ['#FBBF24', '#D97706'],
    'chung-chi': ['#FB7185', '#E11D48'],
  }[tierKey] || ['#38BDF8', '#0284C7'];

  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0 drop-shadow-sm" aria-hidden="true">
      <defs>
        <linearGradient id={`dew-onb-${tierKey}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette[0]} />
          <stop offset="100%" stopColor={palette[1]} />
        </linearGradient>
      </defs>
      <rect x="8" y="10" width="32" height="28" rx="9" fill={`url(#dew-onb-${tierKey})`} stroke="#FFFFFF" strokeWidth="1.6" />
      <rect x="14" y="17" width="20" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.9" />
      <rect x="14" y="24" width="14" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.65" />
    </svg>
  );
}

function CourseMonitor3D() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/90 bg-gradient-to-br from-[#E0F2FE] via-[#DBEAFE] to-[#CCFBF1] shadow-[0_8px_18px_-6px_rgba(14,165,233,0.28),inset_0_2px_0_#fff]" aria-hidden="true">
      <svg viewBox="0 0 56 56" className="h-11 w-11 drop-shadow-sm">
        <defs>
          <linearGradient id="dew-onb-scr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <rect x="7" y="10" width="42" height="29" rx="5" fill="#FFFFFF" stroke="#60A5FA" strokeWidth="2" />
        <rect x="10.5" y="13.5" width="35" height="22" rx="3" fill="url(#dew-onb-scr)" />
        <path d="M13 17l12 0c-3 4-7 10-12 14V17z" fill="#FFFFFF" fillOpacity="0.26" />
        <rect x="24" y="39" width="8" height="5" rx="1" fill="#94A3B8" />
        <rect x="17" y="44" width="22" height="3.5" rx="1.75" fill="#64748B" />
      </svg>
    </div>
  );
}

/** Modal Onboarding bắt buộc chọn cấp + lớp lần đầu cho tài khoản DewSkill (không cho bỏ qua). */
export default function CourseOnboardingModal({ open, classes = [], onSelectTrial }) {
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setSelectedTier('');
    setSelectedClassId('');

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const availableTiers = useMemo(() => {
    const tierSet = new Set((classes || []).map((c) => c.tier).filter(Boolean));
    const filtered = ONBOARDING_TIERS.filter((t) => tierSet.has(t.key));
    return filtered.length > 0 ? filtered : ONBOARDING_TIERS;
  }, [classes]);

  const displayTier = selectedTier || availableTiers[0]?.key || '';

  const tierClasses = useMemo(() => {
    const list = (classes || []).filter((c) => !displayTier || c.tier === displayTier);
    return list.length > 0 ? list : (classes || []);
  }, [classes, displayTier]);

  const chosenClass = useMemo(
    () => (selectedClassId
      ? tierClasses.find((c) => String(c._id) === String(selectedClassId)) || null
      : null),
    [tierClasses, selectedClassId],
  );

  const canSubmit = Boolean(selectedTier && chosenClass);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      className="fixed inset-0 z-[9400] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dew-onboarding-title"
    >
      <div className="relative mt-8 w-full max-w-2xl">
        {/* Các giọt nước 3D trang trí xung quanh modal */}
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute -top-5 left-10 z-20 hidden h-10 w-10 opacity-80 sm:block"
        />
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute top-12 -right-4 z-20 hidden h-9 w-9 opacity-80 sm:block"
        />
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute -bottom-4 left-8 z-20 hidden h-11 w-11 opacity-75 sm:block"
        />
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute bottom-10 -right-5 z-20 hidden h-8 w-8 opacity-75 sm:block"
        />

        <div className="dew-modal dew-app-card !overflow-visible relative w-full max-w-2xl rounded-[32px] border border-white bg-gradient-to-b from-white/95 via-[#F0FDF9]/95 to-[#E0F2FE]/90 p-7 md:p-8 shadow-[0_28px_70px_-14px_rgba(4,120,87,0.34),inset_0_2px_0_#fff]">
          {/* Thanh nhấn xanh ngọc cắt khớp chính xác theo bo góc của modal */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#34D399] via-[#10B981] to-[#059669]" />
          </div>

          {/* Header căn giữa với Mascot nhô nhẹ lên mép trên */}
          <div className="relative z-10 text-center">
            <img
              src="/mascot/nang-dong.gif"
              alt="Mascot DewSkill"
              className="-mt-16 mx-auto h-24 w-24 object-contain drop-shadow-[0_14px_24px_rgba(4,120,87,0.28)]"
            />
            <span className="mt-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1 text-[11px] font-extrabold text-emerald-700 shadow-xs">
              Chọn lộ trình trong 10 giây
            </span>
            <h2 id="dew-onboarding-title" className="mt-2.5 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Bạn muốn bắt đầu học lớp nào?
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs font-medium leading-relaxed text-slate-600 sm:text-[13px]">
              Chọn cấp học và lớp để mở ngay Chặng 1 miễn phí — bạn có thể thêm nhiều lớp khác bất cứ lúc nào.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {/* 1. Chọn cấp học / mục tiêu */}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                1. Chọn cấp học / mục tiêu
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {availableTiers.map((tier) => {
                  const active = tier.key === selectedTier;
                  return (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => {
                        setSelectedTier(tier.key);
                        setSelectedClassId('');
                      }}
                      className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition cursor-pointer ${
                        active
                          ? 'border-2 border-emerald-500 bg-gradient-to-b from-[#D1FAE5]/85 to-[#ECFDF5]/95 shadow-[0_12px_26px_-8px_rgba(16,185,129,0.42),inset_0_2px_0_rgba(255,255,255,0.9)]'
                          : 'border border-white bg-white/90 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.14),inset_0_2px_0_#fff] hover:border-emerald-200 hover:bg-white'
                      }`}
                    >
                      <TierIcon3D tierKey={tier.key} />
                      <span className="min-w-0 flex-1 text-xs font-extrabold leading-snug text-slate-900 sm:text-[13px]">
                        {tier.label}
                      </span>
                      {active ? (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                          <Check size={12} strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Chọn lớp học thử */}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                2. Chọn lớp học thử
              </p>
              <div
                className={`mt-2.5 ${
                  tierClasses.length <= 1
                    ? 'grid grid-cols-1'
                    : 'grid max-h-[220px] grid-cols-1 gap-3 overflow-y-auto pr-0.5 sm:grid-cols-2'
                }`}
              >
                {tierClasses.map((cls) => {
                  const cid = String(cls._id);
                  const active = Boolean(chosenClass && String(chosenClass._id) === cid);
                  const meta = TIER_STYLES[cls.tier] || TIER_STYLES['cap-2'];
                  const badgeText = `${cls.badge || meta.cardTag || meta.shortLabel} · Miễn phí Chặng 1`;
                  const descText = cls.shortDescription || meta.tagline;

                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => {
                        if (!selectedTier) setSelectedTier(cls.tier || displayTier);
                        setSelectedClassId(cid);
                      }}
                      className={`flex w-full items-center justify-between gap-3.5 rounded-2xl p-4 text-left transition cursor-pointer ${
                        active
                          ? 'border-2 border-emerald-500 bg-gradient-to-r from-[#ECFDF5] via-white to-[#F0FDFA] shadow-[0_14px_28px_-10px_rgba(16,185,129,0.35),inset_0_2px_0_#fff]'
                          : 'border border-white bg-white/90 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.12),inset_0_2px_0_#fff] hover:border-emerald-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <CourseMonitor3D />
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                            {badgeText}
                          </span>
                          <p className="mt-1 truncate text-sm font-black text-slate-900 sm:text-[15px]">
                            {cls.name}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-600">
                            {descText}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                          active
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'border-2 border-slate-300 bg-white text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        <Check size={13} strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chân modal căn giữa */}
          <div className="mt-6 flex flex-col items-center gap-2.5 pt-1 text-center">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => canSubmit && onSelectTrial?.(chosenClass)}
              className="dew-btn-primary inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-extrabold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:brightness-100"
            >
              <span>Bắt đầu học thử ngay</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p className="text-[11px] font-medium italic text-slate-500">
              Bắt buộc chọn 1 lớp để hệ thống tạo đúng lộ trình cho bạn
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
