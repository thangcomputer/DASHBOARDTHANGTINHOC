import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Info, HelpCircle } from 'lucide-react';
import StandardModal from '../components/ui/StandardModal.jsx';

export { StandardModal };

const ModalContext = createContext(null);

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ModalProvider = ({ children }) => {
  const [modal, setModal] = useState(null);

  const showModal = useCallback(({
    title,
    content,
    type = 'info',
    onConfirm,
    onCancel,
    confirmText = 'Đóng',
    cancelText = null,
    size = 'sm',
    confirmButtonClass,
    prompt = null,
  }) => {
    setModal({ title, content, type, onConfirm, onCancel, confirmText, cancelText, size, confirmButtonClass, prompt });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  const confirmAsync = useCallback(({ title = 'Xác nhận', content, type = 'warning', confirmText = 'Chắc chắn', cancelText = 'Hủy', confirmButtonClass }) => {
    const resolvedBtnClass = confirmButtonClass
      || (['info', 'success', 'question'].includes(type)
        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
        : 'bg-red-600 hover:bg-red-700 text-white shadow-sm');
    return new Promise((resolve) => {
      showModal({
        title,
        content,
        type,
        confirmText,
        cancelText,
        confirmButtonClass: resolvedBtnClass,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [showModal]);

  const promptAsync = useCallback(({
    title = 'Nhập thông tin',
    content = '',
    label = '',
    placeholder = '',
    defaultValue = '',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    type = 'question',
  } = {}) => (
    new Promise((resolve) => {
      showModal({
        title,
        content: content || label,
        type,
        confirmText,
        cancelText,
        confirmButtonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
        prompt: { placeholder, defaultValue: String(defaultValue ?? '') },
        onConfirm: (value) => resolve(typeof value === 'string' ? value : String(value ?? '')),
        onCancel: () => resolve(null),
      });
    })
  ), [showModal]);

  useEffect(() => {
    window.cmsConfirm = (content) => confirmAsync({ content });
    window.cmsAlert = (content, type = 'info', title = 'Thông báo') => confirmAsync({
      title,
      content,
      type,
      cancelText: null,
      confirmText: 'Đã hiểu',
      confirmButtonClass: type === 'error'
        ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
    });
    window.cmsPrompt = (optionsOrContent, defaultValue = '') => promptAsync(
      typeof optionsOrContent === 'string'
        ? { content: optionsOrContent, defaultValue }
        : { defaultValue, ...(optionsOrContent || {}) },
    );
    window.cmsConfirmAdvanced = confirmAsync;
    return () => {
      delete window.cmsConfirm;
      delete window.cmsAlert;
      delete window.cmsPrompt;
      delete window.cmsConfirmAdvanced;
    };
  }, [confirmAsync, promptAsync]);

  const handleConfirm = useCallback((value) => {
    if (modal?.onConfirm) modal.onConfirm(value);
    setModal(null);
  }, [modal]);

  const handleCancel = useCallback(() => {
    if (modal?.onCancel) modal.onCancel();
    setModal(null);
  }, [modal]);

  return (
    <ModalContext.Provider value={{ showModal, closeModal, confirmAsync, promptAsync }}>
      {children}
      {modal && <ModalUI modal={modal} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </ModalContext.Provider>
  );
};

/** Mở popup xác nhận chuẩn DewSkill thay thế hoàn toàn `window.confirm`. */
export async function appConfirm(optionsOrContent) {
  if (typeof optionsOrContent === 'string') {
    if (typeof window !== 'undefined' && typeof window.cmsConfirm === 'function') {
      return Boolean(await window.cmsConfirm(optionsOrContent));
    }
    return false;
  }
  if (typeof window !== 'undefined' && typeof window.cmsConfirmAdvanced === 'function') {
    return Boolean(await window.cmsConfirmAdvanced(optionsOrContent || {}));
  }
  return false;
}

/** Mở popup thông báo chuẩn DewSkill thay thế hoàn toàn `window.alert`. */
export async function appAlert(content, type = 'info', title = 'Thông báo') {
  if (typeof window !== 'undefined' && typeof window.cmsAlert === 'function') {
    await window.cmsAlert(content, type, title);
    return true;
  }
  return false;
}

/** Mở popup nhập liệu chuẩn DewSkill thay thế hoàn toàn `window.prompt`. */
export async function appPrompt(optionsOrContent, defaultValue = '') {
  if (typeof window !== 'undefined' && typeof window.cmsPrompt === 'function') {
    return window.cmsPrompt(optionsOrContent, defaultValue);
  }
  return null;
}

const ModalUI = ({ modal, onConfirm, onCancel }) => {
  const dialogRef = useRef(null);
  const promptInputRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [promptValue, setPromptValue] = useState(() => modal.prompt?.defaultValue ?? '');

  useEffect(() => {
    setPromptValue(modal.prompt?.defaultValue ?? '');
  }, [modal]);

  const typeConfigs = {
    info: { icon: Info, tone: 'text-sky-600 bg-sky-50' },
    success: { icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
    warning: { icon: AlertCircle, tone: 'text-amber-600 bg-amber-50' },
    error: { icon: AlertCircle, tone: 'text-red-600 bg-red-50' },
    question: { icon: HelpCircle, tone: 'text-sky-600 bg-sky-50' },
  };

  const config = typeConfigs[modal.type] || typeConfigs.info;
  const Icon = config.icon;
  const sizeClass = ({
    sm: '',
    md: 'cms-sheet--md',
    lg: 'cms-sheet--wide',
    xl: 'cms-sheet--xl',
    '2xl': 'cms-sheet--xl',
    '3xl': 'cms-sheet--invoice',
  })[modal.size] || '';
  const showFooter = Boolean(modal.cancelText || modal.confirmText);
  const submitCurrent = () => {
    onConfirm(modal.prompt ? promptValue : undefined);
  };

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const node = dialogRef.current;
    if (!node) return undefined;

    const focusables = () => Array.from(node.querySelectorAll(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (modal.prompt && promptInputRef.current) {
      promptInputRef.current.focus();
      promptInputRef.current.select?.();
    } else {
      const list = focusables();
      const initial = list.find((el) => el.classList.contains('cms-btn-primary')) || list[0];
      if (initial) initial.focus();
      else node.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
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
  }, [onCancel, modal.prompt]);

  return (
    <>
      <div className="cms-sheet-backdrop" data-app-modal onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-app-modal
        aria-label={modal.title || 'Thông báo'}
        tabIndex={-1}
        className={`cms-sheet w-full ${sizeClass}`.trim()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className={`cms-sheet-header__side ${config.tone}`} aria-hidden="true">
            <Icon size={18} />
          </span>
          <h3 className="cms-sheet-header__title">{modal.title || 'Thông báo'}</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-100/80 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`cms-sheet-body ${modal.size === '3xl' ? 'cms-sheet-body--invoice' : ''}`}>
          {modal.content ? (
            <div className="text-sm text-slate-600 leading-relaxed">
              {modal.content}
            </div>
          ) : null}
          {modal.prompt ? (
            <form
              className={modal.content ? 'mt-3' : ''}
              onSubmit={(event) => {
                event.preventDefault();
                submitCurrent();
              }}
            >
              <input
                ref={promptInputRef}
                type="text"
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                placeholder={modal.prompt.placeholder || ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </form>
          ) : null}
        </div>

        {showFooter ? (
          <div className="cms-sheet-footer">
            {modal.cancelText ? (
              <button type="button" onClick={onCancel} className="cms-btn cms-btn-outline">
                {modal.cancelText}
              </button>
            ) : null}
            {modal.confirmText ? (
              <button
                type="button"
                onClick={submitCurrent}
                className={modal.confirmButtonClass ? `cms-btn ${modal.confirmButtonClass}` : 'cms-btn cms-btn-primary'}
              >
                {modal.confirmText}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
};

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be inside ModalProvider');
  return ctx;
};
