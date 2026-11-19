import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import {
  Award, Check, Clock, Copy, Download, ExternalLink, Flame, Share, Sparkles, Star, Target, Trophy, X, Zap,
} from 'lucide-react';
import { buildPlatformShareUrls } from '../../../../shared/dailyPractice/shareAchievement.mjs';
import { translateText } from '../../../../shared/i18n/translate.mjs';
import { useLanguage } from '../../context/LanguageContext';
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

function StatCardIcon({ name, color, bg }) {
  const Icon = STAT_ICONS[name] || Award;
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
      style={{ backgroundColor: bg, color }}
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={2.5} />
    </span>
  );
}

/**
 * Nút bấm chuẩn có chữ SHARE để gắn đồng nhất trên các màn hoàn thành.
 */
export function ShareTriggerButton({
  onClick,
  label = 'SHARE',
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
 * Modal thẻ thành tích kiểu Duolingo: huy hiệu · mascot · 4 chỉ số · nút SHARE + chia sẻ nhanh lên nền tảng khác.
 */
export default function ShareAchievementModal({ open, onClose, data }) {
  const { language } = useLanguage();
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setStatusNotice('');
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

  const copyCaption = useCallback(async (noticeText = 'Đã sao chép nội dung để dán lên nền tảng khác!') => {
    try {
      await navigator.clipboard.writeText(translatedShareText || translatedHeadline || '');
      setCopied(true);
      setStatusNotice(noticeText);
      window.setTimeout(() => setCopied(false), 2400);
      return true;
    } catch {
      return false;
    }
  }, [translatedHeadline, translatedShareText]);

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
    setStatusNotice('');
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
            setStatusNotice('Đã gửi thẻ thành tích!');
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
          setStatusNotice('Đã mở chia sẻ!');
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }

      const downloaded = downloadBlob(blob);
      await copyCaption(
        downloaded
          ? 'Đã tải ảnh thẻ thành tích & sao chép nội dung — hãy đăng lên Facebook / Zalo nhé!'
          : 'Đã sao chép nội dung thành tích để chia sẻ lên nền tảng khác!',
      );
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
        setStatusNotice('Đã lưu ảnh thẻ thành tích (.png)!');
      } else {
        await copyCaption();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOpenExternal = async (platform) => {
    await copyCaption(
      platform === 'zalo'
        ? 'Đã chép nội dung thành tích — mở Zalo để dán chia sẻ nhé!'
        : 'Đã mở trang chia sẻ & chép sẵn nội dung thành tích!',
    );
    const href = platform === 'facebook'
      ? urls.facebook
      : platform === 'telegram'
        ? urls.telegram
        : urls.zaloWeb;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  if (!open || !data || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chia sẻ thành tích lên nền tảng khác"
      className="fixed inset-0 z-[10050] flex items-center justify-center overflow-y-auto p-3 sm:p-5"
      style={{
        background: 'radial-gradient(circle at 50% 18%, rgba(30, 102, 208, 0.96), rgba(7, 42, 94, 0.98))',
      }}
      onClick={onClose}
    >
      <div
        className="relative my-auto flex w-full max-w-[400px] flex-col items-center gap-3.5 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cửa sổ chia sẻ"
          className="absolute -top-1 right-0 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white transition hover:bg-white/25 cursor-pointer !shadow-none"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <h2 className="max-w-[300px] pt-1 text-lg font-black leading-snug tracking-tight text-white sm:text-xl">
          {data.topPrompt}
        </h2>

        {/* Thẻ thành tích nền xanh trời kiểu Duolingo (được chụp thành ảnh PNG khi SHARE) */}
        <div
          ref={cardRef}
          className="relative w-full overflow-hidden rounded-[26px] p-4 pb-5 text-center shadow-[0_24px_60px_-12px_rgba(2,12,34,0.6)] sm:p-5"
          style={{
            background: 'linear-gradient(180deg, #53BAFA 0%, #99DAFE 44%, #E3F4FF 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 70%)' }}
          />
          <div
            className="pointer-events-none absolute -right-6 top-10 h-24 w-24 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(186,230,253,0.45) 0%, rgba(186,230,253,0) 70%)' }}
          />

          {/* Header thương hiệu + tag mục tiêu */}
          <div className="relative z-10 flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/25 text-white">
                <Sparkles size={13} strokeWidth={2.5} />
              </span>
              <span className="text-sm font-black leading-[1.35] tracking-tight">DewSkill</span>
            </div>
            <span className="max-w-[62%] break-words text-right text-[10.5px] font-black uppercase leading-[1.4] tracking-[0.12em] text-white">
              {data.eyebrow}
            </span>
          </div>

          {/* Linh vật + Huy hiệu số nổi */}
          <div className="relative z-10 mt-2 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <Sparkles size={16} className="absolute -left-7 top-4 text-white/90" aria-hidden="true" />
              <Mascot mood={data.mood || 'graduate'} size={94} />
              <Sparkles size={14} className="absolute -right-6 bottom-5 text-amber-200" aria-hidden="true" />
            </div>
            <div
              className="relative z-20 mt-1.5 inline-block rounded-2xl border-2 border-white bg-[#FFFDF4] px-5 py-1.5 text-center text-xl font-black leading-[1.3] tracking-tight text-[#1E3A8A] shadow-[0_5px_0_#BAE6FD]"
            >
              {data.heroLabel}
            </div>
          </div>

          {/* Câu tiêu đề thành tích */}
          <p className="relative z-10 mt-3 px-1 text-lg font-black leading-[1.35] text-slate-900 sm:text-[19px]">
            {data.headline}
          </p>

          {/* Lưới 4 chỉ số 2x2 chuẩn Duolingo */}
          <div className="relative z-10 mt-3.5 grid grid-cols-2 gap-2.5 text-left">
            {(data.stats || []).map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-2.5 rounded-2xl bg-white/95 px-2.5 py-2.5 shadow-[0_3px_0_rgba(14,165,233,0.14)]"
              >
                <StatCardIcon name={item.icon} color={item.color} bg={item.bg} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[13.5px] font-black leading-[1.35] text-slate-900 sm:text-sm">
                    {item.value}
                  </p>
                  <p className="mt-0.5 break-words text-[10.5px] font-semibold leading-[1.35] text-slate-500">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] font-semibold text-sky-200/85">
          {data.footerNote}
        </p>

        {/* Nút trắng SHARE nổi bật giống ảnh mẫu */}
        <button
          type="button"
          disabled={busy}
          onClick={handlePrimaryShare}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-sky-200 bg-white py-3.5 text-sm font-black uppercase tracking-[0.12em] text-[#0EA5E9] shadow-xl transition hover:bg-sky-50 active:translate-y-[2px] active:border-b-2 disabled:opacity-60 cursor-pointer"
        >
          <Share size={18} strokeWidth={2.6} aria-hidden="true" />
          <span>{busy ? 'ĐANG CHUẨN BỊ...' : 'SHARE'}</span>
        </button>

        {/* Thanh chia sẻ nhanh sang các nền tảng phổ biến */}
        <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenExternal('facebook')}
            className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/20 cursor-pointer"
          >
            <ExternalLink size={12} aria-hidden="true" /> Facebook
          </button>
          <button
            type="button"
            onClick={() => handleOpenExternal('zalo')}
            className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/20 cursor-pointer"
          >
            <ExternalLink size={12} aria-hidden="true" /> Zalo
          </button>
          <button
            type="button"
            onClick={() => handleOpenExternal('telegram')}
            className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/20 cursor-pointer"
          >
            <ExternalLink size={12} aria-hidden="true" /> Telegram
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadImage}
            className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/20 disabled:opacity-60 cursor-pointer"
          >
            <Download size={12} aria-hidden="true" /> Tải ảnh
          </button>
          <button
            type="button"
            onClick={() => copyCaption()}
            className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/20 cursor-pointer"
          >
            {copied ? <Check size={12} className="text-emerald-300" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            {copied ? 'Đã chép' : 'Sao chép'}
          </button>
        </div>

        {statusNotice ? (
          <p role="status" className="rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/35">
            {statusNotice}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
