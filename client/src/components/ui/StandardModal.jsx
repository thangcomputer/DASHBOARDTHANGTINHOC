import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZE_CLASS = {
  sm: '',
  md: 'cms-sheet--md',
  lg: 'cms-sheet--wide',
  xl: 'cms-sheet--xl',
  '2xl': 'cms-sheet--xl',
  '3xl': 'cms-sheet--invoice',
};

/**
 * StandardModal — 1 mẫu Popup / Bottom Sheet dùng chung toàn hệ thống DewSkill:
 * - Mobile: Bottom Sheet có thanh kéo + bo tròn đỉnh.
 * - Desktop: Hộp thoại căn giữa bo góc 20px, Header cố định → Body cuộn mượt → Footer (Hủy trái, CTA phải).
 */
export default function StandardModal({
  open,
  onClose,
  title,
  subtitle = '',
  icon = null,
  iconToneClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200/70',
  size = 'md',
  footer = null,
  closeOnBackdrop = true,
  children,
}) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const node = dialogRef.current;
    if (!node) return undefined;

    const focusables = () => Array.from(node.querySelectorAll(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);

    const list = focusables();
    const initial = list.find((el) => el.dataset.autofocus === 'true')
      || list.find((el) => el.classList.contains('cms-btn-primary'))
      || list[0];
    if (initial) initial.focus();
    else node.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !node.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch { /* ignore */ }
      }
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const sizeClass = SIZE_CLASS[size] || '';

  return createPortal(
    <>
      <div
        className="cms-sheet-backdrop"
        data-app-modal
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-app-modal
        aria-label={typeof title === 'string' ? title : 'Hộp thoại'}
        tabIndex={-1}
        className={`cms-sheet w-full ${sizeClass}`.trim()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6 sm:py-4 shrink-0 bg-[var(--cms-surface)]">
          <div className="flex items-center gap-3 min-w-0">
            {icon ? (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconToneClass}`} aria-hidden="true">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-[15px] sm:text-lg font-extrabold tracking-tight text-slate-900 leading-snug truncate">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-0.5 text-xs font-medium text-slate-500 leading-snug truncate">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              title="Đóng"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800 cursor-pointer"
            >
              <X size={17} />
            </button>
          ) : null}
        </div>

        <div className={`cms-sheet-body ${size === '3xl' ? 'cms-sheet-body--invoice' : ''}`}>
          {children}
        </div>

        {footer ? (
          <div className="cms-sheet-footer">
            {footer}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}

