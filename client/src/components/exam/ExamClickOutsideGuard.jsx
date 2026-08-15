import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { playExamWarningSound, unlockAudio } from '../../utils/sound';
import { resolveMediaUrl } from '../../services/api';

const IGNORE_SELECTOR = [
  '[data-exam-surface]',
  '[data-exam-warning-overlay]',
  '[data-app-modal]',
  '[data-exam-modal]',
].join(', ');

/**
 * Chỉ bật ở giai đoạn trắc nghiệm.
 * Click ngoài vùng làm bài (hoặc blur cửa sổ) → overlay giữa màn + âm thanh + nút tiếp tục.
 * Tự luận / thực hành: truyền enabled=false.
 */
export default function ExamClickOutsideGuard({
  enabled = false,
  soundUrl = '',
  /** Bật khi phòng thi không dùng ExamMonitor (quiz GV). Cert dùng ExamMonitor tab guard. */
  watchVisibility = false,
  children,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const cooldownRef = useRef(0);

  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  const trigger = useCallback(() => {
    if (!enabled || openRef.current) return;
    const now = Date.now();
    if (now - cooldownRef.current < 400) return;
    cooldownRef.current = now;
    unlockAudio();
    playExamWarningSound(resolveMediaUrl(soundUrl) || soundUrl);
    setOpen(true);
  }, [enabled, soundUrl]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onPointerDown = (e) => {
      if (openRef.current) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(IGNORE_SELECTOR)) return;
      trigger();
    };

    const onBlur = () => {
      // Đợi ngắn: tránh false-positive khi focus chuyển trong cùng trang / mở dialog hệ thống
      window.setTimeout(() => {
        if (!enabled || openRef.current) return;
        if (document.visibilityState === 'hidden') return; // tab/visibility xử lý riêng
        if (document.hasFocus()) return;
        trigger();
      }, 120);
    };

    const onVisibility = () => {
      if (!watchVisibility || !document.hidden) return;
      trigger();
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
