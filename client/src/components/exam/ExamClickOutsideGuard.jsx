import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { playExamWarningSound, stopExamWarningSound, unlockAudio } from '../../utils/sound';
import { resolveMediaUrl } from '../../services/api';

/** Kiểm tra xem người dùng đã tương tác (gesture) với trang chưa (để tránh trigger âm thanh trước khi unlock) */
const hasUserGesture = () => {
  try { return sessionStorage.getItem('thvp_gesture') === '1'; } catch { return false; }
};
const markUserGesture = () => {
  try { sessionStorage.setItem('thvp_gesture', '1'); } catch { /* ignore */ }
};

const IGNORE_SELECTOR = [
  '[data-exam-surface]',
  '[data-exam-warning-overlay]',
  '[data-app-modal]',
  '[data-exam-modal]',
].join(', ');

/**
 * Chỉ bật ở giai đoạn trắc nghiệm.
 * Click ngoài vùng làm bài (hoặc blur cửa sổ) → overlay giữa màn + âm thanh + nút tiếp tục.
 * Tối đa maxStrikes lần (mặc định 2); lần cuối gọi onMaxStrikes để hủy bài.
 * Tự luận / thực hành: truyền enabled=false.
 */
export default function ExamClickOutsideGuard({
  enabled = false,
  soundUrl = '',
  /** Bật khi phòng thi không dùng ExamMonitor (quiz GV). Cert dùng ExamMonitor tab guard. */
  watchVisibility = false,
  /** Số lần bấm ra ngoài trước khi hủy bài. */
  maxStrikes = 2,
  /** Gọi khi đủ maxStrikes (trắc nghiệm). Không truyền = chỉ cảnh báo, không hủy. */
  onMaxStrikes,
  children,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const openRef = useRef(false);
  const cooldownRef = useRef(0);
  const strikesRef = useRef(0);
  const maxedRef = useRef(false);
  const onMaxStrikesRef = useRef(onMaxStrikes);

  useEffect(() => { onMaxStrikesRef.current = onMaxStrikes; }, [onMaxStrikes]);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setStrikeCount(0);
      strikesRef.current = 0;
      maxedRef.current = false;
    }
  }, [enabled]);

  const trigger = useCallback((source = 'click') => {
    if (!enabled || openRef.current || maxedRef.current) return;
    // FIX Bug 4: blur/visibility chỉ trigger sau khi người dùng đã có gesture
    // tránh false-positive + âm thanh không có khi chưa unlock audio
    if (source !== 'click' && !hasUserGesture()) return;
    const now = Date.now();
    if (now - cooldownRef.current < 400) return;
    cooldownRef.current = now;
    strikesRef.current += 1;
    const n = strikesRef.current;
    setStrikeCount(n);
    unlockAudio();
    playExamWarningSound(resolveMediaUrl(soundUrl) || soundUrl);
    const cap = Number.isFinite(maxStrikes) && maxStrikes > 0 ? maxStrikes : 2;
    if (n >= cap && typeof onMaxStrikesRef.current === 'function') {
      maxedRef.current = true;
      setOpen(false);
      onMaxStrikesRef.current();
      return;
    }
    setOpen(true);
  }, [enabled, soundUrl, maxStrikes]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onPointerDown = (e) => {
      if (openRef.current) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      // Ghi nhận gesture khi người dùng click trong vùng thi (exam-surface)
      if (t.closest('[data-exam-surface]')) markUserGesture();
      if (t.closest(IGNORE_SELECTOR)) return;
      trigger('click');
    };

    const onBlur = () => {
      // Đợi ngắn: tránh false-positive khi focus chuyển trong cùng trang / mở dialog hệ thống
      window.setTimeout(() => {
        if (!enabled || openRef.current) return;
        if (document.visibilityState === 'hidden') return; // tab/visibility xử lý riêng
        if (document.hasFocus()) return;
        trigger('blur');
      }, 120);
    };

    const onVisibility = () => {
      if (!watchVisibility || !document.hidden) return;
      trigger('visibility');
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    if (watchVisibility) document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
      if (watchVisibility) document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, trigger, watchVisibility]);

  const dismiss = () => {
    unlockAudio();
    markUserGesture(); // Bấm dismiss cũng là gesture → unlock cho lần sau
    stopExamWarningSound();
    setOpen(false);
    cooldownRef.current = Date.now();
  };

  const overlay = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        data-exam-warning-overlay
        className="fixed inset-0 z-[200000] flex items-center justify-center bg-red-950/90 backdrop-blur-md p-4 sm:p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exam-click-outside-title"
      >
        <div className="bg-white rounded-[40px] shadow-[0_32px_120px_-15px_rgba(220,38,38,0.5)] w-full max-w-sm overflow-hidden border-t-[12px] border-orange-500">
          <div className="p-10 text-center space-y-6">
            <div className="w-24 h-24 rounded-[35%] flex items-center justify-center mx-auto shadow-2xl bg-orange-100 text-orange-600 animate-bounce">
              <AlertTriangle size={48} />
            </div>
            <div>
              <h2
                id="exam-click-outside-title"
                className="text-gray-900 font-extrabold text-2xl sm:text-3xl uppercase tracking-tighter leading-none"
              >
                Cảnh báo!
              </h2>
              <p className="text-gray-400 font-bold mt-3 text-sm leading-relaxed">
                Bạn vừa thao tác ngoài vùng làm bài. Hãy quay lại màn hình thi và tiếp tục làm bài.
              </p>
              {maxStrikes > 0 && (
                <p className="text-orange-600 font-extrabold mt-3 text-xs uppercase tracking-wide">
                  Cảnh báo {strikeCount}/{maxStrikes}
                  {strikeCount < maxStrikes
                    ? ` — còn ${maxStrikes - strikeCount} lần, lần sau bài thi sẽ bị hủy.`
                    : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-sm tracking-wide shadow-lg shadow-red-500/25 hover:from-orange-400 hover:to-red-500 transition active:scale-[0.98]"
            >
              TÔI ĐÃ HIỂU, TIẾP TỤC THI
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div data-exam-surface className={className || undefined}>
        {children}
      </div>
      {overlay}
    </>
  );
}
