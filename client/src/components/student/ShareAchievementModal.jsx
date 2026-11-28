import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import {
  Award, Check, Clock, Copy, Download, Flame, Share, Share2, Star, Target, Trophy, X, Zap,
} from 'lucide-react';
import { buildPlatformShareUrls } from '../../../../shared/dailyPractice/shareAchievement.mjs';
import { translateText } from '../../../../shared/i18n/translate.mjs';
import { useLanguage } from '../../context/LanguageContext';
import { dewClass, getDewSkillThemeAttr } from '../../utils/dewskillTheme';
import Mascot from './dailyPractice/Mascot';

const STAT_ICONS = {
  award: Award,
  trophy: Trophy,
  flame: Flame,
  zap: Zap,
  clock: Clock,
  check: Check,
  target: Target,
  star: Star,
};

const STAT_3D_TONES = {
  award: 'bg-gradient-to-b from-[#EDE9FE] via-[#DDD6FE] to-[#C4B5FD] text-[#7C3AED] shadow-[0_6px_14px_-4px_rgba(124,58,237,0.35),inset_0_2px_3px_#fff]',
  trophy: 'bg-gradient-to-b from-[#EDE9FE] via-[#DDD6FE] to-[#C4B5FD] text-[#7C3AED] shadow-[0_6px_14px_-4px_rgba(124,58,237,0.35),inset_0_2px_3px_#fff]',
  flame: 'bg-gradient-to-b from-[#FFEDD5] via-[#FED7AA] to-[#FDBA74] text-[#EA580C] shadow-[0_6px_14px_-4px_rgba(234,88,12,0.35),inset_0_2px_3px_#fff]',
  zap: 'bg-gradient-to-b from-[#FEF9C3] via-[#FEF08A] to-[#FDE047] text-[#D97706] shadow-[0_6px_14px_-4px_rgba(217,119,6,0.35),inset_0_2px_3px_#fff]',
  star: 'bg-gradient-to-b from-[#FEF9C3] via-[#FEF08A] to-[#FDE047] text-[#D97706] shadow-[0_6px_14px_-4px_rgba(217,119,6,0.35),inset_0_2px_3px_#fff]',
  clock: 'bg-gradient-to-b from-[#E0F2FE] via-[#BAE6FD] to-[#7DD3FC] text-[#0284C7] shadow-[0_6px_14px_-4px_rgba(2,132,199,0.35),inset_0_2px_3px_#fff]',
  target: 'bg-gradient-to-b from-[#E0F2FE] via-[#BAE6FD] to-[#7DD3FC] text-[#0284C7] shadow-[0_6px_14px_-4px_rgba(2,132,199,0.35),inset_0_2px_3px_#fff]',
  check: 'bg-gradient-to-b from-[#D1FAE5] via-[#A7F3D0] to-[#6EE7B7] text-[#059669] shadow-[0_6px_14px_-4px_rgba(5,150,105,0.35),inset_0_2px_3px_#fff]',
};

function StatCardIcon({ name }) {
  const Icon = STAT_ICONS[name] || Award;
  const toneClass = STAT_3D_TONES[name] || STAT_3D_TONES.award;
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/90 ${toneClass}`}
      aria-hidden="true"
    >
      <Icon size={19} strokeWidth={2.5} />
    </span>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function ZaloIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="19" height="16" rx="5.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7.5 18.5 5 21l.6-3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="13.8" textAnchor="middle" fill="currentColor" fontSize="7" fontWeight="800" fontFamily="sans-serif">
        Zalo
      </text>
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.4 4.2 2.9 11.4c-1.2.5-1.2 1.2-.2 1.5l4.7 1.5 11-6.9c.5-.3 1-.1.6.2l-8.9 8-.3 4.8c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.3-1.7z" />
    </svg>
  );
}

function resolveTierBadgeClass(eyebrow) {
  const upper = String(eyebrow || '').toUpperCase();
  if (/KHÓ|HARD/.test(upper)) {
    return 'bg-gradient-to-b from-[#F87171] via-[#EF4444] to-[#DC2626] shadow-[0_6px_14px_-3px_rgba(239,68,68,0.48),inset_0_1.5px_0_rgba(255,255,255,0.5)]';
  }
  if (/VỪA|TRUNG BÌNH|MEDIUM/.test(upper)) {
    return 'bg-gradient-to-b from-[#FB923C] via-[#F97316] to-[#EA580C] shadow-[0_6px_14px_-3px_rgba(249,115,22,0.48),inset_0_1.5px_0_rgba(255,255,255,0.5)]';
  }
  return 'bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#059669] shadow-[0_6px_14px_-3px_rgba(16,185,129,0.48),inset_0_1.5px_0_rgba(255,255,255,0.5)]';
}

/**
 * Nút bấm chuẩn có chữ SHARE để gắn đồng nhất trên các màn hoàn thành.
 */
export function ShareTriggerButton({
  onClick,
  label = 'Chia sẻ',
  size = 'md',
  variant = 'sky',
  className = '',
  ariaLabel = 'Chia sẻ thành tích lên nền tảng khác',
}) {
  const toneClass = variant === 'white'
    ? 'border border-sky-200 border-b-[3px] border-b-sky-300 bg-white text-sky-700 hover:bg-sky-50'
    : variant === 'dark'
      ? 'border border-sky-400/40 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30'
      : 'border border-sky-200 border-b-[3px] border-b-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100';

  const padClass = size === 'sm'
    ? 'px-3 py-1.5 text-[11px] rounded-xl gap-1.5'
    : 'px-4 py-2.5 text-xs rounded-2xl gap-2';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center font-black uppercase tracking-wider transition active:translate-y-[1px] cursor-pointer ${toneClass} ${padClass} ${className}`}
    >
      <Share size={size === 'sm' ? 13 : 15} strokeWidth={2.6} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Modal Chia sẻ thành tích phong cách Giọt Nước 3D (Dewdrop Glossy).
 */
export default function ShareAchievementModal({ open, onClose, data }) {
  const { language } = useLanguage();
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setCopied(false);
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const translatedShareTitle = language === 'en' ? translateText(data?.shareTitle, 'en') : data?.shareTitle;
  const translatedShareText = language === 'en' ? translateText(data?.shareText, 'en') : data?.shareText;
  const translatedHeadline = language === 'en' ? translateText(data?.headline, 'en') : data?.headline;

  const urls = buildPlatformShareUrls({
    title: translatedShareTitle,
    text: translatedShareText,
    url: data?.shareUrl,
  });

  const copyShareLink = useCallback(async (customToast = 'Đã sao chép liên kết chia sẻ') => {
    const payload = data?.shareUrl || translatedShareText || translatedHeadline || '';
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success(customToast);
      window.setTimeout(() => setCopied(false), 2400);
      return true;
    } catch {
      toast.error('Không thể sao chép tự động trên trình duyệt này');
      return false;
    }
  }, [data?.shareUrl, translatedHeadline, translatedShareText]);

  const captureCardBlob = useCallback(async () => {
    if (!cardRef.current) return null;
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready.catch(() => undefined);
      }
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        onclone(clonedDoc, clonedEl) {
          if (!clonedEl) return;
          const fixStyle = clonedDoc.createElement('style');
          fixStyle.textContent = 'img { display: inline-block !important; }';
          clonedDoc.head?.appendChild(fixStyle);
          clonedEl.style.overflow = 'hidden';
          const textEls = clonedEl.querySelectorAll('p, span, div');
          textEls.forEach((node) => {
            const cs = clonedDoc.defaultView?.getComputedStyle(node);
            if (cs && node !== clonedEl && cs.overflow === 'hidden') {
              node.style.overflow = 'visible';
            }
          });
        },
      });
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } catch {
      return null;
    }
  }, []);

  const downloadBlob = useCallback((blob) => {
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thanh-tich-dewskill.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  }, []);

  const handlePrimaryShare = async () => {
    if (!data || busy) return;
    setBusy(true);
    try {
      const blob = await captureCardBlob();
      const file = blob ? new File([blob], 'thanh-tich-dewskill.png', { type: 'image/png' }) : null;

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        if (file && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: translatedShareTitle,
              text: translatedShareText,
            });
            toast.success('Đã gửi thẻ thành tích!');
            return;
          } catch (err) {
            if (err?.name === 'AbortError') return;
          }
        }
        try {
          await navigator.share({
            title: translatedShareTitle,
            text: translatedShareText,
            url: data.shareUrl,
          });
          toast.success('Đã mở chia sẻ!');
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }

      const downloaded = downloadBlob(blob);
      if (downloaded) {
        toast.success('Đã tải ảnh thẻ thành tích PNG!');
      } else {
        await copyShareLink('Đã sao chép liên kết chia sẻ');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadImage = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await captureCardBlob();
      if (downloadBlob(blob)) {
        toast.success('Đã tải ảnh thẻ thành tích!');
      } else {
        await copyShareLink();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOpenExternal = async (platform) => {
    const caption = translatedShareText || translatedHeadline || data?.shareUrl || '';
    try {
      await navigator.clipboard.writeText(caption);
      toast.success(
        platform === 'zalo'
          ? 'Đã chép nội dung — dán lên Zalo để chia sẻ nhé!'
          : 'Đã chép nội dung & mở trang chia sẻ!',
      );
    } catch {
      /* ignore */
    }
    const href = platform === 'facebook'
      ? urls.facebook
      : platform === 'telegram'
        ? urls.telegram
        : urls.zaloWeb;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  if (!open || !data || typeof document === 'undefined') return null;

  const tierBadgeClass = resolveTierBadgeClass(data.eyebrow);

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      role="dialog"
      aria-modal="true"
      aria-label="Chia sẻ thành tích lên nền tảng khác"
      className="fixed inset-0 z-[10050] flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-[#0B253A]/90 via-[#083344]/92 to-[#042F2E]/95 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng cửa sổ chia sẻ"
        className="fixed right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 cursor-pointer !shadow-none sm:right-6 sm:top-6"
      >
        <X size={20} strokeWidth={2.4} />
      </button>

      <div
        className="my-auto flex w-full max-w-[400px] flex-col items-center text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 max-w-[360px] text-xl font-extrabold leading-snug tracking-tight text-white md:text-2xl">
          {data.topPrompt || 'Chia sẻ thành tích để lan tỏa cảm hứng học tập!'}
        </h2>

        {/* Thẻ Thành tích Giọt Nước 3D có thể xuất ảnh PNG */}
        <div
          ref={cardRef}
          className="relative w-full max-w-[400px] overflow-hidden rounded-[32px] border-2 border-white/80 bg-gradient-to-br from-[#BAE6FD] via-[#D1FAE5] to-[#A7F3D0] p-5 text-center shadow-[0_24px_60px_rgba(16,185,129,0.35),inset_0_2px_0_#fff]"
        >
          {/* Vệt sáng chéo mờ sau Mascot */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-12 -top-10 h-56 w-56 rotate-12 rounded-full opacity-55"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 72%)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-12 h-52 w-52 rounded-full opacity-45"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 70%)',
            }}
          />

          {/* 3 hạt giọt nước 3D trong suốt ở mép card */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-4 top-28 h-10 w-10 rounded-full border border-white/75"
            style={{
              background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.92), rgba(255,255,255,0.18) 65%, rgba(255,255,255,0.42))',
              boxShadow: '0 6px 14px rgba(15,23,42,0.1)',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-14 -top-4 h-9 w-9 rounded-full border border-white/75"
            style={{
              background: 'radial-gradient(circle at 32% 30%, rgba(255,255,255,0.92), rgba(255,255,255,0.16) 65%, rgba(255,255,255,0.4))',
              boxShadow: '0 6px 14px rgba(15,23,42,0.08)',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-3 bottom-24 h-11 w-11 rounded-full border border-white/75"
            style={{
              background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.92), rgba(255,255,255,0.16) 65%, rgba(255,255,255,0.42))',
              boxShadow: '0 6px 14px rgba(15,23,42,0.1)',
            }}
          />

          {/* Hàng đầu: Trái Logo DewSkill chính thức · Phải Pill mức độ đổi màu */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <img
              src="/brand/logo-horizontal.png"
              alt="DewSkill"
              className="h-8 max-w-[140px] object-contain object-left drop-shadow-[0_2px_4px_rgba(255,255,255,0.75)]"
            />
            <span
              className={`relative overflow-hidden rounded-full px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white before:pointer-events-none before:absolute before:inset-x-2 before:top-0.5 before:h-1/2 before:rounded-full before:bg-gradient-to-b before:from-white/45 before:to-transparent ${tierBadgeClass}`}
            >
              <span className="relative z-[1]">{data.eyebrow}</span>
            </span>
          </div>

          {/* Khối Mascot DewSkill 3D ôm trái tim trong vòng cầu pha lê tỏa sáng */}
          <div className="relative z-10 mt-2 flex flex-col items-center">
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full border-2 border-white bg-white/55 shadow-[0_14px_34px_-8px_rgba(16,185,129,0.28),inset_0_4px_14px_rgba(255,255,255,0.92)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-5 top-2 h-8 rounded-full bg-gradient-to-b from-white/75 to-transparent"
              />
              <Mascot mood="completed" size={102} className="relative z-[1] drop-shadow-md" />
            </div>

            <div className="relative z-20 -mt-4 inline-flex items-center justify-center rounded-full border-2 border-white bg-white/95 px-5 py-1.5 text-base font-extrabold tracking-tight text-slate-800 shadow-[0_8px_20px_-4px_rgba(15,23,42,0.16),inset_0_2px_0_#fff]">
              {data.heroLabel}
            </div>
          </div>

          {/* Tiêu đề đậm căn giữa */}
          <h3 className="relative z-10 mt-3 px-1 text-lg font-extrabold leading-snug text-slate-900">
            {translatedHeadline || data.headline}
          </h3>

          {/* Lưới 2×2 thẻ thông số kính mờ */}
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 text-left">
            {(data.stats || []).slice(0, 4).map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-2xl border border-white bg-white/88 p-3 shadow-[0_8px_18px_-8px_rgba(15,23,42,0.12),inset_0_1.5px_0_#fff] backdrop-blur-md"
              >
                <StatCardIcon name={item.icon} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold leading-tight text-slate-900">
                    {item.value}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-slate-500">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dòng bản quyền mảnh đặt gọn dưới card */}
        <p className="mt-3 text-xs font-medium text-teal-100/80">
          {data.footerNote}
        </p>

        {/* Cụm nút chia sẻ bên dưới */}
        <div className="mt-4 w-full max-w-[400px] space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={handlePrimaryShare}
            className={dewClass(
              'dew-btn-primary inline-flex w-full items-center justify-center gap-2 py-3.5 text-base font-extrabold cursor-pointer disabled:opacity-60',
              'flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-sky-200 bg-white py-3.5 text-sm font-black uppercase tracking-[0.12em] text-[#0EA5E9] shadow-xl transition hover:bg-sky-50 active:translate-y-[2px] active:border-b-2 disabled:opacity-60 cursor-pointer',
            )}
          >
            <Share2 size={18} strokeWidth={2.5} aria-hidden="true" />
            <span>{busy ? 'Đang tạo ảnh...' : 'Chia sẻ ngay'}</span>
          </button>

          <div className="space-y-2">
            {/* Hàng 1: Facebook, Zalo, Telegram */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenExternal('facebook')}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/22 cursor-pointer"
              >
                <FacebookIcon />
                <span>Facebook</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenExternal('zalo')}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/22 cursor-pointer"
              >
                <ZaloIcon />
                <span>Zalo</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenExternal('telegram')}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/22 cursor-pointer"
              >
                <TelegramIcon />
                <span>Telegram</span>
              </button>
            </div>

            {/* Hàng 2: Tải ảnh, Sao chép */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleDownloadImage}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/22 disabled:opacity-60 cursor-pointer"
              >
                <Download size={14} strokeWidth={2.3} aria-hidden="true" />
                <span>Tải ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => copyShareLink('Đã sao chép liên kết chia sẻ')}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/22 cursor-pointer"
              >
                {copied ? (
                  <Check size={14} strokeWidth={2.5} className="text-emerald-300" aria-hidden="true" />
                ) : (
                  <Copy size={14} strokeWidth={2.3} aria-hidden="true" />
                )}
                <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
