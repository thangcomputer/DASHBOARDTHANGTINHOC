import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  Clock,
  CreditCard,
  Gamepad2,
  Loader2,
  Lock,
  Monitor,
  Play,
  Trophy,
  Video,
  X,
} from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import { getCourseTimeRemaining } from '../../../utils/courseAccessTime';
import { CURRICULUM_LABELS, TIER_STYLES } from './catalogMarketplaceData';

function formatExpiry(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN');
}

function formatPriceVnd(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? `${n.toLocaleString('vi-VN')}đ` : '';
}

function CourseHeaderBadge({ cls, tierInfo }) {
  const track = String(cls?.track || '').toLowerCase();
  const nameLower = String(cls?.name || '').toLowerCase();
  const isWord = track === 'word' || nameLower.includes('word');
  const isExcel = track === 'excel' || nameLower.includes('excel');
  const isPpt = track === 'powerpoint' || nameLower.includes('powerpoint') || nameLower.includes('ppt');

  let letter = null;
  let badgeGradient = tierInfo.gradient;
  if (isWord && !isExcel && !isPpt) {
    letter = 'W';
    badgeGradient = 'linear-gradient(145deg, #60A5FA 0%, #2563EB 60%, #1D4ED8 100%)';
  } else if (isExcel && !isWord) {
    letter = 'X';
    badgeGradient = 'linear-gradient(145deg, #34D399 0%, #10B981 55%, #047857 100%)';
  } else if (isPpt && !isWord) {
    letter = 'P';
    badgeGradient = 'linear-gradient(145deg, #FDBA74 0%, #F97316 55%, #EA580C 100%)';
  } else if (!badgeGradient) {
    badgeGradient = 'linear-gradient(145deg, #38BDF8 0%, #0EA5E9 55%, #0284C7 100%)';
  }

  return (
    <div className="relative h-16 w-16 shrink-0">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 text-white shadow-[0_12px_24px_-6px_rgba(4,47,46,0.42),inset_0_2px_4px_rgba(255,255,255,0.65)]"
        style={{ background: badgeGradient }}
        aria-hidden="true"
      >
        {letter ? (
          <span className="text-2xl font-black tracking-tight drop-shadow">{letter}</span>
        ) : (
          <Monitor size={26} strokeWidth={2.2} className="drop-shadow" />
        )}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#ECFDF5] to-[#A7F3D0] shadow-[0_6px_14px_rgba(4,120,87,0.35)]">
        <img
          src="/mascot/cam-xuc-vui.gif"
          alt="Mascot DewSkill"
          onError={(e) => {
            e.currentTarget.src = '/mascot/tot-nghiep-vui-ve.gif';
          }}
          className="h-8 w-8 object-contain"
        />
      </span>
    </div>
  );
}

/** Modal Chi tiết khóa học phong cách Giọt Nước 3D (Dewdrop Glossy). */
export default function CoursePreviewModal({
  cls,
  user = null,
  onClose,
  onGoTopic,
  onGoCertPrep,
  onGoDailyPractice,
  onRegister,
  registeringId,
}) {
  const { currentUser } = useData() || {};
  const effectiveUser = user || currentUser || {};

  useEffect(() => {
    if (!cls) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cls, onClose]);

  if (!cls) return null;

  const tierInfo = TIER_STYLES[cls.tier] || TIER_STYLES['cap-2'];
  const topics = (cls.dailyPracticeTopicIds || []).filter(Boolean);
  const certs = (cls.certPrepCourseIds || []).filter(Boolean);
  const isFull = cls.accessLevel === 'full';
  const durationMonths = Math.max(1, Number(cls.durationMonths) || 12);
  const includesMeet = cls.includesMeet !== false;
  const timeInfo = getCourseTimeRemaining(cls.accessExpiresAt);
  const expiryText = formatExpiry(cls.accessExpiresAt);
  const allowReg = cls.allowRegistration !== false;
  const freePreviewCount = Math.max(0, Number(cls.freePreviewTopics ?? 1));
  const priceText = formatPriceVnd(cls.price);
  const isRegistering = registeringId === String(cls._id);

  const tierPillText = cls.badge && cls.badge !== tierInfo.shortLabel
    ? `${tierInfo.shortLabel} · ${cls.badge}`
    : tierInfo.shortLabel;
  const curriculumText = CURRICULUM_LABELS[cls.curriculumSource] || tierInfo.curriculum;
  const descText = String(cls.description || cls.shortDescription || '').trim();
  const headerSubtitle = [
    curriculumText,
    descText,
    expiryText ? `Hạn dùng đến ${expiryText}` : '',
  ].filter(Boolean).join(' · ');

  const modal = (
    <div
      data-theme={getDewSkillThemeAttr(effectiveUser)}
      className="fixed inset-0 z-[9600] flex items-center justify-center bg-slate-900/50 p-2.5 sm:p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={cls.name}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="dew-modal relative flex max-h-[88dvh] w-full max-w-[94vw] sm:max-w-xl md:max-w-[600px] flex-col overflow-hidden rounded-2xl sm:rounded-[24px] border border-white/80 bg-white shadow-2xl">
        {/* Header xanh ngọc - xanh trời */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-[#047857] via-[#0D9488] to-[#0284C7] p-4 sm:p-5 text-white">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1/3 h-20 w-40 rounded-full bg-cyan-200/15 blur-xl"
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết lớp học"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 cursor-pointer"
          >
            <X size={16} />
          </button>

          <div className="relative flex items-start gap-3 sm:gap-4 pr-9">
            <CourseHeaderBadge cls={cls} tierInfo={tierInfo} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="rounded-full bg-gradient-to-r from-[#FDE68A] to-[#F59E0B] px-2.5 py-0.5 text-[10.5px] font-extrabold text-amber-950 shadow-xs">
                  {tierPillText}
                </span>
                <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[10.5px] font-extrabold text-emerald-800 shadow-xs">
                  {isFull ? 'Đã mở khóa toàn bộ' : 'Đang học thử'}
                </span>
              </div>

              <h3 className="mt-2 text-base font-extrabold leading-snug text-white sm:text-lg">
                {cls.name}
              </h3>

              {headerSubtitle ? (
                <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-emerald-50/95 sm:text-xs">
                  {headerSubtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Thân Modal */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {isFull ? (
            <div
              className={`flex flex-col justify-between gap-2 rounded-[20px] border p-4 sm:flex-row sm:items-center ${
                timeInfo.isExpiringSoon
                  ? 'border-amber-200 bg-amber-50/90 text-amber-950'
                  : 'border-emerald-200 bg-emerald-50/85 text-emerald-950'
              }`}
            >
              <div className="space-y-0.5">
                <p className="inline-flex items-center gap-1.5 text-sm font-extrabold">
                  <Clock size={15} className={timeInfo.isExpiringSoon ? 'text-amber-600' : 'text-emerald-600'} />
                  <span>Thời hạn học {durationMonths} tháng: {timeInfo.detailNote}</span>
                </p>
                <p className="text-xs font-medium text-slate-600">
                  Khi hết thời hạn, khóa học sẽ bị khóa và lộ trình học sẽ tự động đặt lại về ban đầu.
                </p>
              </div>
              {includesMeet ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-800 shadow-2xs">
                  <Video size={14} className="text-emerald-600" />
                  Có học Meet cùng GV
                </span>
              ) : null}
            </div>
          ) : null}

          {!isFull && allowReg ? (
            <div className="flex flex-col justify-between gap-4 rounded-[22px] border border-amber-200/80 bg-gradient-to-r from-[#FEF3C7]/70 via-[#ECFDF5]/85 to-[#D1FAE5]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:flex-row sm:items-center">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-extrabold text-amber-950">
                  Bạn đang học thử ({freePreviewCount} chủ đề đầu miễn phí)
                </p>
                <p className="text-xs leading-relaxed text-slate-600">
                  Đăng ký gói <strong>{durationMonths} tháng</strong> để mở toàn bộ bài học, phòng thi chứng chỉ
                  {includesMeet ? ' & học Meet cùng giảng viên' : ''}
                  {priceText ? ` · Học phí: ${priceText}` : ''}. Hết hạn sẽ khóa &amp; đặt lại về ban đầu.
                </p>
              </div>
              <button
                type="button"
                disabled={isRegistering}
                onClick={() => onRegister?.(cls)}
                className="dew-btn-orange inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-5 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                {isRegistering ? <Loader2 size={15} className="animate-spin" /> : null}
                <span>Đăng ký mở toàn bộ →</span>
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            <h4 className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Gamepad2 size={15} aria-hidden="true" />
              </span>
              <span>Chủ đề bài học &amp; Luyện tập ({topics.length})</span>
            </h4>

            {topics.length === 0 ? (
              <div className="dew-card space-y-3 rounded-[22px] border-emerald-200/80 bg-emerald-50/40 p-5 text-center">
                <p className="text-xs font-medium text-slate-600 sm:text-sm">
                  Lớp học này chưa gắn chủ đề riêng. Bạn có thể vào thẳng khu Luyện tập để học các chặng hiện có.
                </p>
                <button
                  type="button"
                  onClick={() => onGoDailyPractice?.()}
                  className="dew-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm whitespace-nowrap cursor-pointer"
                >
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  <span>Đi tới khu Luyện tập chung</span>
                </button>
              </div>
            ) : (
              <div className={topics.length === 1 ? 'w-full space-y-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
                {topics.map((topic, idx) => {
                  const tid = String(topic._id || topic.id);
                  const lockedTopic = !isFull && idx >= freePreviewCount;
                  const handleTopicAction = () => {
                    if (lockedTopic && allowReg) onRegister?.(cls);
                    else onGoTopic?.(tid);
                  };
                  return (
                    <div
                      key={tid}
                      role="button"
                      tabIndex={0}
                      onClick={handleTopicAction}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTopicAction();
                        }
                      }}
                      className={`dew-card group flex cursor-pointer items-center justify-between gap-4 rounded-[22px] p-4 transition hover:-translate-y-0.5 ${
                        lockedTopic ? 'border-amber-200/80' : 'border-emerald-200'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-[0_6px_14px_-4px_rgba(5,150,105,0.45),inset_0_2px_2px_rgba(255,255,255,0.55)] ${
                            lockedTopic
                              ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 shadow-[0_6px_14px_-4px_rgba(245,158,11,0.4)]'
                              : 'bg-gradient-to-b from-[#34D399] to-[#059669] text-white'
                          }`}
                        >
                          {lockedTopic ? <Lock size={15} aria-hidden="true" /> : idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 sm:text-[15px]">
                            {topic.name}
                          </div>
                          <div className={`mt-0.5 text-xs font-semibold ${lockedTopic ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {lockedTopic
                              ? 'Cần đăng ký lớp để mở khóa'
                              : isFull
                                ? 'Đã mở khóa · Video bài giảng & Luyện tập'
                                : 'Học thử miễn phí · Video bài giảng & Luyện tập'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTopicAction();
                        }}
                        className={
                          lockedTopic
                            ? 'dew-btn-orange inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2 text-xs font-bold cursor-pointer'
                            : 'dew-btn-primary inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-5 py-2.5 text-sm cursor-pointer'
                        }
                      >
                        {lockedTopic ? (
                          <span>Mở khóa</span>
                        ) : (
                          <>
                            <Play size={13} fill="currentColor" aria-hidden="true" />
                            <span>Vào học ngay</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {certs.length > 0 ? (
            <div className="space-y-3">
              <h4 className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Trophy size={15} aria-hidden="true" />
                </span>
                <span>Phòng thi chứng chỉ đi kèm ({certs.length})</span>
              </h4>
              <div className={certs.length === 1 ? 'w-full space-y-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
                {certs.map((c) => {
                  const cid = String(c._id || c.id);
                  const handleCertAction = () => {
                    if (!isFull && allowReg) onRegister?.(cls);
                    else onGoCertPrep?.();
                  };
                  return (
                    <div
                      key={cid}
                      role="button"
                      tabIndex={0}
                      onClick={handleCertAction}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCertAction();
                        }
                      }}
                      className="dew-card flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border-amber-200/80 p-4 transition hover:-translate-y-0.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          {!isFull ? <Lock size={15} aria-hidden="true" /> : <Award size={17} aria-hidden="true" />}
                        </span>
                        <span className="truncate text-sm font-bold text-slate-900">{c.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCertAction();
                        }}
                        className="dew-btn-orange inline-flex shrink-0 items-center whitespace-nowrap px-4 py-2 text-xs font-bold cursor-pointer"
                      >
                        {!isFull && allowReg ? 'Đăng ký' : 'Vào thi'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Modal */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white bg-slate-50/70 px-6 py-4">
          {!isFull && allowReg ? (
            <button
              type="button"
              disabled={isRegistering}
              onClick={() => onRegister?.(cls)}
              className="dew-btn-white inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {isRegistering ? (
                <Loader2 size={15} className="animate-spin text-emerald-600" />
              ) : (
                <CreditCard size={15} className="text-emerald-600" aria-hidden="true" />
              )}
              <span>Đăng ký &amp; Chuyển khoản{priceText ? ` (${priceText})` : ''}</span>
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-200/70 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
